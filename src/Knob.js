import * as React from "react";
import { FLStandardKnob } from "precision-inputs/umd/precision-inputs.fl-controls";
import "precision-inputs/css/precision-inputs.fl-controls.css";

export default function Knob(props) {
  const { size = 38 } = props;
  const container = React.useRef(null);
  const knob = React.useRef(null);
  React.useEffect(() => {
    knob.current = new FLStandardKnob(container.current, {
      color: "#daf1a9",
      dragResistance: 50,
      wheelResistance: 10,
      min: props.min,
      max: props.max,
      step: props.step,
      initial: props.value,
    });
    knob.current.value = props.value;
    function handleChange(event) {
      props.onChange(event.target.value);
    }
    knob.current.addEventListener("change", handleChange);
    return () => {
      knob.current.removeEventListener("change", handleChange);
    };
  }, []);
  React.useEffect(() => {
    knob.current.value = props.value;
  }, [props.value]);
  React.useEffect(() => {
    knob.current.min = props.min;
  }, [props.min]);
  React.useEffect(() => {
    knob.current.max = props.max;
  }, [props.max]);
  React.useEffect(() => {
    knob.current.step = props.step;
  }, [props.step]);
  return <div ref={container} style={{ width: size, height: size }} />;
}
