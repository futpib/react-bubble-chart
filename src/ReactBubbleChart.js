/* global window */
//------------------------------------------------------------------------------
// Copyright Jonathan Kaufman Corp. 2015
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

import React from 'react';
import ReactBubbleChartD3 from './ReactBubbleChartD3';

// Description of props!

// data format:
// An array of data objects (defined below) used to populate the bubble chart.
// {
//    _id: string,        // unique id (required)
//    value: number,      // used to determine relative size of bubbles (required)
//    displayText: string,// will use _id if undefined
//    colorValue: number, // used to determine color
//    selected: boolean,  // if true will use selectedColor/selectedTextColor for circle/text
// }
//
// Can also be a nested JSON object if you want a nested bubble chart. That would look like:
// {
//   _id: string,
//   children: [
//     {data object},
//     {data object},
//     {
//       _id: string,
//       children: [...]
//     }
//   ]

// legend (optional)
// boolean. if true, create and show a legend based on the passed on colors

// colorLegend (optional)
// an array of:
// string || {
//   color: string,
//   text: string used in legend,
//   textColor: string (optional) - if specified will use this for the text color when
//              over bubbles with that color
// }
// If this is left undefined everything will render black. But fear not! we add
// the css class `bubble` to all... bubbles and `bubble leaf` if it has no
// children. This way if you want all bubbles to be styled the same way you can do
// so with just css instead of defining a color legend array.

// fixedDomain (optional)
// Used in tandum with the color legend. If defined, the minimum number corresponds
// to the minimum value in the color legend array, and the maximum corresponds to
// the max. The rest of the `colorValue` values will use a quantized domain to find
// their spot.
// If this is undefined we will use the min and max of the `colorValue`s of the
// dataset.
// {
//   min: number,
//   max: number
// }

// tooltip (optional)
// If `true`, will create a `<div>` as a sibling of the main `<svg>` chart, whose
// content will be populated by highlighting over one of the bubbles. The class of
// this element is `tooltip`. For now all of the styling is handled by this module,
// not by CSS.

// tooltipProps (optional)
// This is where you configure what is populated (and from where) in the tooltip.
// This is an array of objects or strings. The objects take three properties -
// `css`, `prop`, and `display` (optional). If you use a string instead of an
// object, that strings values will be used for all three.

// For each object in this array, we create a `<div>` whose class is specified by
// `css`. `prop` specifies what property of the data object to display in the
// tooltip. `display` (if specified) will prepend the string with `Value: `, if
// unspecified, nothing is prepended.

// tooltipFunc (optional)
// A function that is passed the domNode, the d3 data object, and the color of the
// tooltip on hover. Can be used if you want to do fancier dom stuff than just set
// some text values.

// selectedColor
// String hex value.
// If defined, will use this to color the circle corresponding to the data object
// whose `selected` property is true.

// selectedTextColor
// String hex value.
// If defined, will use this to color the text corresponding to the data object
// whose `selected` property is true.

// onClick
// Can pass a function that will be called with the data object when that bubble is
// clicked on.

// smallDiameter
// Can pass a number below which the label div will have the `small` class added.
// defaults to 40

// mediumDiameter
// Can pass a number below which the label div will have the `medium` class added,
// and above which the `large` class will be added. Defaults to 115.

// legendSpacing
// The number of pixels between blocks in the legend

// fontSizeFactor
// A multiplier used to determine a bubble's font-size as a function of its radius.
// If not specified, the font-sizes depend on CSS styles for large, medium, and small classes, or 1em by default.

// duration
// Determines the length of time (in milliseconds) it takes for each bubble's transition animation to complete.
// defaults to 500 ms; can set to zero

// delay
// Staggers the transition between each bubble element.
// defaults to 7 ms

// for more info, see the README

class ReactBubbleChart extends React.Component {
  static getDerivedStateFromProps({ tooltipFunc, tooltipComponent, ...props }, state) {
    const tooltipMode = tooltipFunc ? 'func' : (tooltipComponent ? 'component' : 'none');

    const tooltipTargetChangedSinceLastDataUpdate = (state.prevData === props.data) ?
          state.tooltipTargetChangedSinceLastDataUpdate :
          false;

    return {
      tooltipMode,

      chartState: {
        data: props.data,
        colorLegend: props.colorLegend,
        fixedDomain: props.fixedDomain,
        selectedColor: props.selectedColor,
        selectedTextColor: props.selectedTextColor,
        onClick: props.onClick,
        smallDiameter: props.smallDiameter,
        mediumDiameter: props.mediumDiameter,
        legendSpacing: props.legendSpacing,
        legend: props.legend,

        tooltip: props.tooltip,
        tooltipProps: props.tooltipProps,
        tooltipMode,
        tooltipFunc,
        tooltipShouldShow: props.tooltipShouldShow,
        tooltipMargin: props.tooltipMargin,

        tooltippedDataId: tooltipTargetChangedSinceLastDataUpdate ?
          state.tooltippedDataId :
          props.initialTooltippedDataId,

        fontSizeFactor: props.fontSizeFactor,
        duration: props.duration,
        delay: props.delay,
      },

      prevData: props.data,
      tooltipTargetChangedSinceLastDataUpdate,
    };
  }

  constructor(props) {
    super(props);

    this.state = {
      tooltippedDataId: null,
      tooltipTargetChangedSinceLastDataUpdate: false,
    };

    // Define the method this way so that we have a clear reference to it
    // this is necessary so that window.removeEventListener will work properly
    this.handleResize = this._handleResize.bind(this);
    this.handleTooltip = this._handleTooltip.bind(this);

    this.containerRef = React.createRef();
    this.tooltipRef = React.createRef();
  }

  /** Render town */
  render() {
    const {
      className,
      tooltipClassName,
      tooltipComponent: TooltipComponent,
    } = this.props;
    const {
      tooltipMode,
      chartState: { tooltippedDataId },
      bubbleChartInitialized,
    } = this.state;

    const tooltippedNode = bubbleChartInitialized &&
          tooltippedDataId &&
          this.bubbleChart.findNodeByDataId(tooltippedDataId);

    return (
      <div
        ref={this.containerRef}
        className={'bubble-chart-container ' + className}
      >
        <div
          ref={this.tooltipRef}
          className={'bubble-chart-tooltip ' + tooltipClassName}
        >
          {tooltipMode === 'component' && tooltippedNode && (
            <TooltipComponent
              d={tooltippedNode}
            />
          )}
        </div>
      </div>
    );
  }

  /** When we mount, intialize resize handler and create the bubbleChart */
  componentDidMount() {
    window.addEventListener('resize', this.handleResize);

    this.bubbleChart = new ReactBubbleChartD3(
      this.containerRef.current,
      this.tooltipRef.current,
      this.state.chartState,
      this.handleTooltip,
    );

    this.setState({
      bubbleChartInitialized: true,
    });
  }

  /** When we update, update our friend, the bubble chart */
  componentDidUpdate(prevProps, prevState) {
    this.bubbleChart.update(this.state.chartState, prevState.chartState);
  }

  /** When we're piecing out, remove the handler and destroy the chart */
  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
    this.bubbleChart.destroy(this.containerRef.current);
  }

  /** On a debounce, adjust the size of our graph area and then update the chart */
  _handleResize() {
    if (this.__resizeTimeout) {
      clearTimeout(this.__resizeTimeout);
    }

    this.__resizeTimeout = setTimeout(() => {
      const { chartState } = this.state;
      this.bubbleChart.update(chartState, chartState);
      delete this.__resizeTimeout;
    }, 200);
  }

  _handleTooltip(tooltipped, d) {
    this.setState({
      tooltippedDataId: tooltipped ? d.data._id : null,
      tooltipTargetChangedSinceLastDataUpdate: true,
    });
  }
}

ReactBubbleChart.defaultProps = {
  className: '',
  tooltipClassName: '',
  tooltipMargin: 5,
  onClick: () => {},
  tooltipShouldShow: () => true,
};

export default ReactBubbleChart;
