import * as React from "react";
import { useMachine } from "@xstate/react";
import * as cx from "classnames";
import { css } from "emotion/macro";
import groupBy from "lodash/fp/groupBy";
import uuidv4 from "uuid/v4";
import {
  appMachine,
  get_num_measures,
  quantizes,
  time_signatures
} from "./machines/appMachine";
import { range } from "./helpers/range";
import { basename } from "./helpers/basename";
import { ReactComponent as ArrowLeftIcon } from "./svg/baseline-arrow_left-24px.svg";
import { ReactComponent as ArrowRightIcon } from "./svg/baseline-arrow_right-24px.svg";
import { MegaMenu, Wrapper, Menu, MenuItem, Button } from "./MegaMenu";
import Knob from "./Knob";
import styles from "./App.module.css";

const __DEV__ = process.env.NODE_ENV !== "production";

export default function App() {
  const [currentState, send] = useMachine(appMachine, { devTools: __DEV__ });
  const tempo_input = React.useRef(null);
  const {
    ppqn,
    tempo_default,
    min_tempo,
    max_tempo,
    min_volume,
    max_volume,
    min_pan,
    max_pan,
    min_swing,
    max_swing,
    min_velocity,
    max_velocity,
    samples,
    selected_track_id,
    edit_velocity_mode,
    project: { tempo, swing, beat_units_per_measure, beat_unit, tracks, notes }
  } = currentState.context;
  const num_measures = get_num_measures(
    notes,
    ppqn,
    beat_units_per_measure,
    beat_unit
  );
  const samples_by_kind = groupBy(x => x.kind, samples);

  return (
    <div className={styles.app}>
      <header>
        <h1>
          <a href="https://github.com/apalm/rm-06">RM-06</a>
        </h1>
        <button
          onClick={() =>
            send(currentState.matches("stopped") ? "PLAY" : "STOP")
          }
          className={styles.play_button}
        >
          {currentState.matches("stopped") ? "Play" : "Stop"}
        </button>
        <span>
          <span className={styles.tempo_units}>bpm</span>
          <input
            ref={tempo_input}
            className={styles.tempo}
            defaultValue={String(tempo)}
            onKeyPress={event => {
              if (event.key === "Enter") {
                let value = Math.min(
                  Math.max(min_tempo, parseInt(event.currentTarget.value)),
                  max_tempo
                );
                if (Number.isNaN(value)) {
                  value = tempo_default;
                }
                send({
                  type: "CHANGE_TEMPO",
                  value
                });
                if (tempo_input && tempo_input.current) {
                  // @ts-ignore
                  tempo_input.current.value = String(value);
                  // @ts-ignore
                  tempo_input.current.blur();
                }
              }
            }}
          />
        </span>
        <Knob
          size={30}
          value={swing}
          min={min_swing}
          max={max_swing}
          step={0.01}
          onChange={value => {
            send({
              type: "SET_SWING",
              value: parseFloat(value)
            });
          }}
        />
        <select
          value={JSON.stringify({ beat_units_per_measure, beat_unit })}
          onChange={event => {
            const v = JSON.parse(event.target.value);
            const beat_units_per_measure = parseInt(v.beat_units_per_measure);
            const beat_unit = parseInt(v.beat_unit);
            send({
              type: "SET_TIME_SIGNATURE",
              value: {
                beat_units_per_measure,
                beat_unit
              }
            });
          }}
        >
          {time_signatures.map((x, i) => (
            <option key={i} value={JSON.stringify(x)}>
              {x.beat_units_per_measure + "/" + x.beat_unit}
            </option>
          ))}
        </select>
        <Wrapper
          className="MegaMenu"
          onSelection={sample => {
            send({
              type: "ADD_TRACK",
              value: { track_id: uuidv4(), sample }
            });
          }}
        >
          <Button tag="button" className={styles.button}>
            track add
          </Button>
          <Menu>
            <MegaMenu
              items={Object.entries(samples_by_kind).map(([kind, samples]) => ({
                label: kind.toLowerCase(),
                items: samples
                  // @ts-ignore
                  .map(sample => (
                    <MenuItem key={sample.id} value={sample}>
                      {basename(sample.path)}
                    </MenuItem>
                  ))
              }))}
            />
          </Menu>
        </Wrapper>
        <label
          className={cx(
            styles.button,
            styles.edit_velocity_mode_button,
            edit_velocity_mode === true &&
              styles.edit_velocity_mode_button_active
          )}
        >
          <input
            type="checkbox"
            checked={edit_velocity_mode}
            onChange={event => {
              send({
                type: "SET_EDIT_VELOCITY_MODE",
                value: event.target.checked
              });
            }}
          />
          <span>velo edit</span>
        </label>
        <button
          type="button"
          onClick={() => {
            send("DOUBLE_PATTERN");
          }}
          className={styles.button}
        >
          pattern dup
        </button>
        <button
          type="button"
          onClick={() => {
            send("CLEAR_PATTERN");
          }}
          className={styles.button}
        >
          pattern clr
        </button>
        <button
          type="button"
          onClick={() => {
            send("RANDOMIZE_KIT");
          }}
          className={styles.button}
        >
          kit rnd
        </button>
        <label className={styles.button}>
          <input
            type="file"
            accept=".json"
            onChange={event => {
              const file =
                event.currentTarget.files && event.currentTarget.files[0];
              if (file != null) {
                const reader = new FileReader();
                reader.onload = event => {
                  try {
                    const project = JSON.parse(
                      // @ts-ignore
                      event.target.result
                    );
                    send({ type: "SET_PROJECT", value: project });
                  } catch (e) {
                    alert(e);
                  }
                };
                reader.readAsText(file);
              }
            }}
            style={{ display: "none" }}
          />
          <span>import</span>
        </label>
        <button
          type="button"
          onClick={() => {
            send("EXPORT_PROJECT");
          }}
          className={styles.button}
        >
          export
        </button>
        <button
          type="button"
          onClick={() => {
            send("EXPORT_MIDI");
          }}
          className={styles.button}
        >
          midi export
        </button>
      </header>
      <main>
        <section className={styles.sequencer}>
          <section className={styles.sequencer_tcps}>
            {tracks.map(track => (
              <label
                key={track.id}
                className={cx(
                  styles.sequencer_tcp,
                  track.id === selected_track_id &&
                    styles.sequencer_tcp_selected
                )}
              >
                <input
                  type="radio"
                  checked={track.id === selected_track_id}
                  onChange={() => {
                    send({ type: "SET_SELECTED_TRACK_ID", value: track.id });
                  }}
                />
                <div className={styles.sequencer_tcp_name}>{track.name}</div>
                <select
                  value={track.quantize}
                  onChange={event => {
                    const quantize = parseInt(event.target.value);
                    send({
                      type: "CHANGE_TRACK_QUANTIZE",
                      value: {
                        quantize,
                        quantize_prev: track.quantize,
                        track_id: track.id
                      }
                    });
                  }}
                >
                  {quantizes.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    send({
                      type: "DUPLICATE_TRACK",
                      value: { track_id: track.id, new_track_id: uuidv4() }
                    });
                  }}
                  className={styles.button}
                >
                  dup
                </button>
                <button
                  onClick={() => {
                    send({ type: "DELETE_TRACK", value: track.id });
                  }}
                  className={styles.button}
                >
                  del
                </button>
                <button
                  onClick={() => {
                    send({ type: "CLEAR_TRACK_NOTES", value: track.id });
                  }}
                  className={styles.button}
                >
                  clr
                </button>
              </label>
            ))}
          </section>
          <section className={styles.pads}>
            {/* {tracks.length === 0 ? null : (
              <section className={styles.step_indicators}>
                {range(0, 16 * num_measures).map(i => {
                  const steps_per_measure =
                    beat_units_per_measure * (16 / beat_unit);
                  return (
                    <div
                      key={i}
                      className={cx(
                        styles.step_indicator,
                        styles.pad_width_16,
                        i !== 0 &&
                          i % steps_per_measure === 0 &&
                          styles.pad_measure_start
                      )}
                    >
                      {i + 1}
                    </div>
                  );
                })}
              </section>
            )} */}
            {tracks.map(track => {
              const ticks = ppqn / (track.quantize / 4);
              const steps_per_measure =
                beat_units_per_measure * (track.quantize / beat_unit);
              // Add 1 so it's possible to quickly add a new measure.
              const num_extra_measures = 1;
              const num_steps =
                (num_measures + num_extra_measures) * steps_per_measure;

              if (edit_velocity_mode === true) {
                return (
                  <div key={track.id} className={styles.pads_row}>
                    {range(0, num_steps).map(i => {
                      const start = i * ticks;
                      const note_index = notes.findIndex(
                        x => x.track_id === track.id && x.start === start
                      );
                      const has_note = note_index !== -1;
                      const velocity = has_note
                        ? notes[note_index].velocity
                        : 0;
                      return (
                        <div
                          key={i}
                          className={cx(
                            styles.pad,
                            styles[`pad_width_${track.quantize}`],
                            has_note && styles.pad_on,
                            // TODO
                            css(
                              range(0, track.quantize / beat_unit).reduce(
                                (acc, i) => {
                                  // https://stackoverflow.com/a/23406564
                                  acc[
                                    `:nth-of-type(${(track.quantize /
                                      beat_unit) *
                                      2}n+${i +
                                      1 +
                                      track.quantize / beat_unit})`
                                  ] = {
                                    backgroundColor: has_note
                                      ? "#ffe7f0"
                                      : "#5b4a4b"
                                  };
                                  return acc;
                                },
                                {}
                              )
                            ),
                            track.mute && !track.solo && styles.pad_mute,
                            i !== 0 &&
                              i % steps_per_measure === 0 &&
                              styles.pad_measure_start,
                            i >=
                              num_steps -
                                steps_per_measure * num_extra_measures &&
                              styles.pad_extra_measure
                          )}
                        >
                          <input
                            type="range"
                            value={velocity}
                            min={min_velocity}
                            max={max_velocity}
                            step={1}
                            onChange={event => {
                              send({
                                type: "SET_NOTE_VELOCITY",
                                value: {
                                  velocity: parseFloat(event.target.value),
                                  start,
                                  track_id: track.id
                                }
                              });
                            }}
                            className={cx(
                              styles.velocity_input,
                              styles.pad,
                              styles[`pad_width_${track.quantize}`]
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div key={track.id} className={styles.pads_row}>
                  {range(0, num_steps).map(i => {
                    const has_note = !!notes.find(
                      x => x.track_id === track.id && x.start === i * ticks
                    );
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          const start = i * ticks;
                          send({
                            type: "PAD_PRESS",
                            value: { start, track_id: track.id }
                          });
                        }}
                        className={cx(
                          styles.pad,
                          styles[`pad_width_${track.quantize}`],
                          has_note && styles.pad_on,
                          // TODO
                          css(
                            range(0, track.quantize / beat_unit).reduce(
                              (acc, i) => {
                                // https://stackoverflow.com/a/23406564
                                acc[
                                  `:nth-of-type(${(track.quantize / beat_unit) *
                                    2}n+${i + 1 + track.quantize / beat_unit})`
                                ] = {
                                  backgroundColor: has_note
                                    ? "#ffe7f0"
                                    : "#5b4a4b"
                                };
                                return acc;
                              },
                              {}
                            )
                          ),
                          track.mute && !track.solo && styles.pad_mute,
                          i !== 0 &&
                            i % steps_per_measure === 0 &&
                            styles.pad_measure_start,
                          i >=
                            num_steps -
                              steps_per_measure * num_extra_measures &&
                            styles.pad_extra_measure
                        )}
                      />
                    );
                  })}
                </div>
              );
            })}
          </section>
        </section>
      </main>
      <footer>
        <section className={styles.fx}>
          {selected_track_id ? (
            <Sampler currentState={currentState} send={send} />
          ) : null}
        </section>
        <section className={styles.mcps}>
          {tracks.map((track, i) => (
            <label
              key={track.id}
              className={cx(
                styles.mcp,
                track.id === selected_track_id && styles.mcp_selected
              )}
            >
              <input
                type="radio"
                checked={track.id === selected_track_id}
                onChange={() => {
                  send({ type: "SET_SELECTED_TRACK_ID", value: track.id });
                }}
              />
              <div className={styles.mcp_inner}>
                <div className={styles.mcp_name}>{track.name}</div>
                <section className={styles.mcp_buttons}>
                  <button
                    onClick={event => {
                      const mute = !track.mute;
                      send({
                        type: "SET_TRACK_MUTE",
                        value: { mute, track_id: track.id }
                      });
                    }}
                    className={cx(
                      styles.button,
                      styles.mcp_button,
                      !!track.mute && styles.mcp_button_mute
                    )}
                  >
                    M
                  </button>
                  <button
                    onClick={() => {
                      const solo = !track.solo;
                      send({
                        type: "SET_TRACK_SOLO",
                        value: { solo, track_id: track.id }
                      });
                    }}
                    className={cx(
                      styles.button,
                      styles.mcp_button,
                      !!track.solo && styles.mcp_button_solo
                    )}
                  >
                    S
                  </button>
                </section>
                <label>
                  <Knob
                    value={track.volume}
                    min={min_volume}
                    max={max_volume}
                    step={0.01}
                    onChange={value => {
                      send({
                        type: "SET_TRACK_VOLUME",
                        value: { volume: parseFloat(value), track_id: track.id }
                      });
                    }}
                  />
                  <span>Vol</span>
                </label>
                <label>
                  <Knob
                    value={track.pan}
                    min={min_pan}
                    max={max_pan}
                    step={0.01}
                    onChange={value => {
                      send({
                        type: "SET_TRACK_PAN",
                        value: { pan: parseFloat(value), track_id: track.id }
                      });
                    }}
                  />
                  <span>Pan</span>
                </label>
              </div>
              <div className={styles.mcp_number}>{i + 1}</div>
            </label>
          ))}
        </section>
      </footer>
    </div>
  );
}

function Sampler(props) {
  // TODO figure out why useMachine doesn't work.
  // Work around by passing down currentState and send..
  const { currentState, send } = props;
  const {
    min_pitch,
    max_pitch,
    samples,
    selected_track_id,
    project: { tracks }
  } = currentState.context;

  const track = tracks.find(x => x.id === selected_track_id);

  if (!track) {
    return null;
  }

  const sample_id = track.sample_id;
  const samples_by_kind = groupBy(x => x.kind, samples);
  const ordered_samples = Object.values(samples_by_kind).flat();
  const sample_index = ordered_samples.findIndex(x => x.id === sample_id);

  return (
    <div className={styles.sampler}>
      <div>
        <button
          type="button"
          disabled={sample_index === 0}
          onClick={() => {
            const sample_id = ordered_samples[sample_index - 1].id;
            send({
              type: "SET_TRACK_SAMPLE",
              value: { sample_id, track_id: track.id }
            });
          }}
          className={styles.button}
        >
          <ArrowLeftIcon />
        </button>
        <select
          value={track.sample_id}
          onChange={event => {
            const sample_id = event.target.value;
            send({
              type: "SET_TRACK_SAMPLE",
              value: { sample_id, track_id: track.id }
            });
          }}
        >
          {Object.entries(samples_by_kind).map(([kind, samples]) => (
            <optgroup key={kind} label={kind}>
              {samples
                // @ts-ignore
                .map(sample => (
                  <option key={sample.id} value={sample.id}>
                    {basename(sample.path)}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          disabled={sample_index === ordered_samples.length - 1}
          onClick={() => {
            const sample_id = ordered_samples[sample_index + 1].id;
            send({
              type: "SET_TRACK_SAMPLE",
              value: { sample_id, track_id: track.id }
            });
          }}
          className={styles.button}
        >
          <ArrowRightIcon />
        </button>
      </div>
      <section className={styles.sampler_edits_section}>
        <button
          onClick={() => {
            send({
              type: "PREVIEW_SAMPLE",
              value: { sample_id, track_id: track.id }
            });
          }}
          className={styles.sample_preview_pad}
        />
        <label>
          <Knob
            value={track.pitch}
            min={min_pitch}
            max={max_pitch}
            step={0.01}
            onChange={value => {
              send({
                type: "SET_TRACK_PITCH",
                value: { pitch: parseFloat(value), track_id: track.id }
              });
            }}
          />
          <span>Pitch</span>
        </label>
      </section>
    </div>
  );
}
