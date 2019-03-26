import * as React from "react";
import { FLStandardKnob } from "precision-inputs/umd/precision-inputs.fl-controls";
import "precision-inputs/css/precision-inputs.fl-controls.css";

export default class Knob extends React.Component {
  constructor(props) {
    super(props);
    this.container = React.createRef();
    this.knob = null;
  }

  componentDidMount() {
    this.knob = new FLStandardKnob(this.container.current, {
      color: "#daf1a9",
      dragResistance: 50,
      wheelResistance: 10,
      min: this.props.min,
      max: this.props.max,
      step: this.props.step,
      initial: this.props.value
    });
    this.knob.value = this.props.value;
    this.knob.addEventListener("change", event => {
      this.props.onChange(event.target.value);
    });
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.value !== this.props.value) {
      this.knob.value = nextProps.value;
    }
    if (nextProps.min !== this.props.min) {
      this.knob.min = nextProps.min;
    }
    if (nextProps.max !== this.props.max) {
      this.knob.max = nextProps.max;
    }
    if (nextProps.step !== this.props.step) {
      this.knob.step = nextProps.step;
    }
  }

  render() {
    const size = this.props.size || 38;
    return <div ref={this.container} style={{ width: size, height: size }} />;
  }
}
