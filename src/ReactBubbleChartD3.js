//------------------------------------------------------------------------------
// Copyright Jonathan Kaufman 2015
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//------------------------------------------------------------------------------

import * as d3 from 'd3';

/**
 * Properties defined during construction:
 *   svg
 *   html
 *   legend
 *   bubble
 *   diameter
 *   colorRange
 *   colorLegend
 *   selectedColor
 *   legendSpacing
 *   smallDiameter
 *   textColorRange
 *   mediumDiameter
 *   configureLegend
 *   selectedTextColor
 *   fontSizeFactor
 *   duration
 *   delay
 */
export default class ReactBubbleChartD3 {
  constructor(el, props = {}) {
    this.legendSpacing = typeof props.legendSpacing === 'number' ? props.legendSpacing : 3;
    this.selectedColor = props.selectedColor;
    this.selectedTextColor = props.selectedTextColor;
    this.smallDiameter = props.smallDiameter || 40;
    this.mediumDiameter = props.mediumDiameter || 115;
    this.fontSizeFactor = props.fontSizeFactor;
    this.duration = props.duration === undefined ? 500 : props.duration;
    this.delay = props.delay === undefined ? 7 : props.delay;

    // Create an <svg> and <html> element - store a reference to it for later
    this.svg = d3.select(el).append('svg')
      .attr('class', 'bubble-chart-d3')
      .style('overflow', 'visible');
    this.html = d3.select(el).append('div')
      .attr('class', 'bubble-chart-text')
      .style('position', 'absolute')
      .style('left', 0) // Center horizontally
      .style('right', 0)
      .style('margin-left', 'auto')
      .style('margin-right', 'auto');
    this.legend = d3.select(el).append('svg')
      .attr('class', 'bubble-legend')
      .style('overflow', 'visible')
      .style('position', 'absolute');
    this.tooltip = this.html.append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('border-radius', '5px')
      .style('border', '3px solid')
      .style('padding', '5px')
      .style('z-index', 500);
    // Create legend and update
    this.adjustSize(el);
    this.update(el, props);
  }

  /**
   * Set this.diameter and this.bubble, also size this.svg and this.html
   */
  adjustSize(el) {
    // Helper values for positioning
    this.diameter = Math.min(el.offsetWidth, el.offsetHeight);
    const top = Math.max((el.offsetHeight - this.diameter) / 2, 0);
    // Center some stuff vertically
    this.svg.attr('width', this.diameter)
      .attr('height', this.diameter)
      .style('position', 'relative')
      .style('top', top + 'px'); // Center vertically
    this.html.style('width', this.diameter + 'px')
      .style('height', this.diameter + 'px')
      .style('top', top + 'px'); // Center vertically;

    // create the bubble layout that we will use to position our bubbles\
    this.bubble = d3.pack()
      .size([ this.diameter, this.diameter ])
      .padding(3);
  }

  /**
   * Create and configure the legend
   */
  configureLegend(el, props) {
    this.createLegend = props.legend;
    // For each color in the legend, remove any existing, then
    // create a g and set its transform
    this.legend.selectAll('.legend-key').remove();
    if (!this.createLegend) {
      return;
    }

    const legendRectSize = Math.min(((el.offsetHeight - 20) - (this.colorLegend.length - 1) * this.legendSpacing) / this.colorLegend.length, 18);
    const legendHeight = this.colorLegend.length * (legendRectSize + this.legendSpacing) - this.legendSpacing;
    this.legend.style('height', legendHeight + 'px')
      .style('width', legendRectSize + 'px')
      .style('top', (el.offsetHeight - legendHeight) / 2 + 'px')
      .style('left', 60 + 'px');

    const legendKeys = this.legend.selectAll('.legend-key')
      .data(this.colorLegend)
      .enter()
      .append('g')
      .attr('class', 'legend-key')
      .attr('transform', (d, i) => {
        const height = legendRectSize + this.legendSpacing;
        const vert = i * height;
        return 'translate(' + 0 + ',' + vert + ')';
      });

    // For each <g> create a rect and have its color... be the color
    legendKeys.append('rect')
      .attr('width', legendRectSize)
      .attr('height', legendRectSize)
      .style('fill', c => c.color)
      .style('stroke', c => c.color);

    // Add necessary labels to the legend
    legendKeys.append('text')
      .attr('x', legendRectSize + 2)
      .attr('y', legendRectSize - 4)
      .text(c => c.text);
  }

  /**
   * Create and configure the tooltip
   */
  configureTooltip(el, props) {
    this.createTooltip = props.tooltip;
    this.tooltipFunc = props.tooltipFunc;
    // Remove all existing divs from the tooltip
    this.tooltip.selectAll('div').remove();
    // Intialize the styling
    this.tooltip.style('display', 'none');
    if (!this.createTooltip) {
      return;
    }

    // Normalize the prop formats
    this.tooltipProps = (props.tooltipProps || []).map(tp =>
      typeof tp === 'string' ? { css: tp, prop: tp, display: tp } : tp
    );
    // Create a div for each of the tooltip props
    for (const { css } of this.tooltipProps) {
      this.tooltip.append('div')
        .attr('class', css);
    }
  }

  /**
   * This is where the magic happens.
   * Update the tooltip and legend.
   * Set up and execute transitions of existing bubbles to new size/location/color.
   * Create and initialize new bubbles.
   * Remove old bubbles.
   * Maintain consistencies between this.svg and this.html
   */
  update(el, props) {
    this.adjustSize(el);
    // Initialize color legend values and color range values
    // color range is just an array of the hex values
    // color legend is an array of the color/text objects
    const colorLegend = props.colorLegend || [];
    this.colorRange = colorLegend.map(c =>
      typeof c === 'string' ? c : c.color
    );
    this.colorLegend = colorLegend.slice(0).reverse().map(c =>
      typeof c === 'string' ? { color: c } : c
    );
    this.textColorRange = colorLegend.map(c =>
      typeof c === 'string' ? '#000000' : (c.textColor || '#000000')
    );
    this.configureLegend(el, props);
    this.configureTooltip(el, props);

    const { data } = props;
    if (!data) {
      return;
    }

    const fontFactor = this.fontSizeFactor;
    const { duration } = this;
    const { delay } = this;

    // Define a color scale for our colorValues
    const color = d3.scaleQuantize()
      .domain([
        props.fixedDomain ? props.fixedDomain.min : d3.min(data, d => d.data.colorValue),
        props.fixedDomain ? props.fixedDomain.max : d3.max(data, d => d.data.colorValue),
      ])
      .range(this.colorRange);

    // Define a color scale for text town
    const textColor = d3.scaleQuantize()
      .domain([
        props.fixedDomain ? props.fixedDomain.min : d3.min(data, d => d.data.colorValue),
        props.fixedDomain ? props.fixedDomain.max : d3.max(data, d => d.data.colorValue),
      ])
      .range(this.textColorRange);

    // Generate data with calculated layout values
    const nodes = d3.hierarchy(data.length > 0 ? { children: data } : data)
      .sum(d => d.value);

    // Assign new data to existing DOM for circles and labels
    const circles = this.svg.selectAll('circle')
      .data(this.bubble(nodes).descendants(), d => 'g' + d.data._id);
    const labels = this.html.selectAll('.bubble-label')
      .data(this.bubble(nodes).descendants(), d => 'g' + d.data._id);

    // Update - this is created before enter.append. it only applies to updating nodes.
    // create the transition on the updating elements before the entering elements
    // because enter.append merges entering elements into the update selection
    // for circles we transition their transform, r, and fill
    circles.transition()
      .duration(duration)
      .delay((d, i) => i * delay)
      .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
      .attr('r', d => d.r)
      .style('opacity', 1)
      .style('fill', d => d.data.selected ? this.selectedColor : color(d.data.colorValue));
    // For the labels we transition their height, width, left, top, and color
    labels
      .on('mouseover', this._tooltipMouseOver.bind(this, color, el))
      .transition()
      .duration(duration)
      .delay((d, i) => i * delay)
      .style('height', d => 2 * d.r + 'px')
      .style('width', d => 2 * d.r + 'px')
      .style('left', d => d.x - d.r + 'px')
      .style('top', d => d.y - d.r + 'px')
      .style('opacity', 1)
      .style('color', d => d.data.selected ? this.selectedTextColor : textColor(d.data.colorValue))
      .attr('class', d => {
        let size;
        if (2 * d.r < this.smallDiameter) {
          size = 'small';
        } else if (2 * d.r < this.mediumDiameter) {
          size = 'medium';
        } else {
          size = 'large';
        }

        return 'bubble-label ' + size;
      })
      // We can pass in a fontSizeFactor here to set the label font-size as a factor of its corresponding circle's radius; this overrides CSS font-size styles set with the small, medium and large classes
      .style('font-size', d => fontFactor ? fontFactor * d.r + 'px' : null);

    // Enter - only applies to incoming elements (once emptying data)
    if (this.bubble(nodes).descendants().length > 0) {
      // Initialize new circles
      circles.enter()
        .filter(d => !d.children)
        .append('circle')
        .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
        .attr('r', 0)
        .attr('class', d => d.children ? 'bubble' : 'bubble leaf')
        .style('fill', d => d.data.selected ? this.selectedColor : color(d.data.colorValue))
        .transition()
        .duration(duration * 1.2)
        .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
        .attr('r', d => d.r)
        .style('opacity', 1);
      // Intialize new labels
      labels.enter().append('div')
        .attr('class', d => {
          let size;
          if (2 * d.r < this.smallDiameter) {
            size = 'small';
          } else if (2 * d.r < this.mediumDiameter) {
            size = 'medium';
          } else {
            size = 'large';
          }

          return 'bubble-label ' + size;
        })
        .text(d => d.data.displayText || d.data._id)
        .on('click', d => {
          d3.event.stopPropagation();
          props.onClick(d);
        })
        .on('mouseover', this._tooltipMouseOver.bind(this, color, el))
        .on('mouseout', this._tooltipMouseOut.bind(this))
        .style('position', 'absolute')
        .style('height', d => 2 * d.r + 'px')
        .style('width', d => 2 * d.r + 'px')
        .style('left', d => d.x - d.r + 'px')
        .style('top', d => d.y - d.r + 'px')
        .style('color', d => d.data.selected ? this.selectedTextColor : textColor(d.data.colorValue))
        .style('opacity', 0)
        .transition()
        .duration(duration * 1.2)
        .style('opacity', 1)
        .style('font-size', d => fontFactor ? fontFactor * d.r + 'px' : null);
    }

    // Exit - only applies to... exiting elements
    // for circles have them shrink to 0 as they're flying all over
    circles.exit()
      .transition()
      .duration(duration)
      .attr('transform', d => {
        const dy = d.y - this.diameter / 2;
        const dx = d.x - this.diameter / 2;
        const theta = Math.atan2(dy, dx);
        const destX = this.diameter * (1 + Math.cos(theta)) / 2;
        const destY = this.diameter * (1 + Math.sin(theta)) / 2;
        return 'translate(' + destX + ',' + destY + ')';
      })
      .attr('r', 0)
      .remove();
    // For text have them fade out as they're flying all over
    labels.exit()
      .transition()
      .duration(duration)
      .style('top', d => {
        const dy = d.y - this.diameter / 2;
        const dx = d.x - this.diameter / 2;
        const theta = Math.atan2(dy, dx);
        const destY = this.diameter * (1 + Math.sin(theta)) / 2;
        return destY + 'px';
      })
      .style('left', d => {
        const dy = d.y - this.diameter / 2;
        const dx = d.x - this.diameter / 2;
        const theta = Math.atan2(dy, dx);
        const destX = this.diameter * (1 + Math.cos(theta)) / 2;
        return destX + 'px';
      })
      .style('opacity', 0)
      .style('width', 0)
      .style('height', 0)
      .remove();
  }

  /**
   * On mouseover of a bubble, populate the tooltip with that elements info
   * (if this.createTooltip is true of course)
   */
  _tooltipMouseOver(color, el, d) {
    if (!this.createTooltip) {
      return;
    }

    for (const { css, prop, display } of this.tooltipProps) {
      this.tooltip.select('.' + css).html((display ? display + ': ' : '') + d.data[prop]);
    }

    // Fade the popup fill mixing the shape fill with 80% white
    const fill = color(d.data.colorValue);
    const backgroundColor = d3.rgb(
      d3.rgb(fill).r + 0.8 * (255 - d3.rgb(fill).r),
      d3.rgb(fill).g + 0.8 * (255 - d3.rgb(fill).g),
      d3.rgb(fill).b + 0.8 * (255 - d3.rgb(fill).b)
    );
    this.tooltip.style('display', 'block');

    const tooltipNode = this.tooltip.node();
    if (this.tooltipFunc) {
      this.tooltipFunc(tooltipNode, d, fill);
    }

    const width = tooltipNode.offsetWidth + 1; // +1 for rounding reasons
    const height = tooltipNode.offsetHeight;
    const buffer = 5;

    // Calculate where the top is going to be. ideally it is
    // (d.y - height/2) which'll put the tooltip in the middle of the bubble.
    // we need to account for if this'll put it out of bounds.
    let top;
    // If it goes above the bounds, have the top be the buffer
    if (d.y - height < 0) {
      top = buffer;
    // If it goes below the bounds, have its buttom be a buffer length away
    } else if (d.y + height / 2 > el.offsetHeight) {
      top = el.offsetHeight - height - buffer;
    // Otherwise smack this bad boy in the middle of its bubble
    } else {
      top = d.y - height / 2;
    }

    // Calculate where the left is going to be. ideally it is
    // (d.x + d.r + buffer) which will put the tooltip to the right
    // of the bubble. we need to account for the case where this puts
    // the tooltip out of bounds.
    let left;
    // If there's room to put it on the right of the bubble, do so
    if (d.x + d.r + width + buffer < el.offsetWidth) {
      left = d.x + d.r + buffer;
    // If there's room to put it on the left of the bubble, do so
    } else if (d.x - d.r - width - buffer > 0) {
      left = d.x - d.r - width - buffer;
    // Otherwise put it on the right part of its container
    } else {
      left = el.offsetWidth - width - buffer;
    }

    this.tooltip.style('background-color', backgroundColor)
      .style('border-color', fill)
      .style('width', width + 'px')
      .style('left', left + 'px')
      .style('top', top + 'px');
  }

  /**
   * On tooltip mouseout, hide the tooltip.
   */
  _tooltipMouseOut() {
    if (!this.createTooltip) {
      return;
    }

    this.tooltip.style('display', 'none')
      .style('width', '')
      .style('top', '')
      .style('left', '');
  }

  /** Any necessary cleanup */
  destroy() { }
}
