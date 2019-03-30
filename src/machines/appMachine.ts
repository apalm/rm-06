import { Track, Note, Sample } from "../types";
import { Machine, assign } from "xstate";
import groupBy from "lodash/fp/groupBy";
import { basename } from "../helpers/basename";
import { extname } from "../helpers/extname";
import { get_midi_note_number_mapping } from "../helpers/get_midi_note_number_track_mapping";
import { get_midi } from "../helpers/get_midi";
import _timer_worker from "../helpers/timer_worker";
import samples from "../data/samples.json";
import midi_note_number_map from "../data/midi-map.json";
import default_project from "../projects/default.json";

let current_tick;
let next_note_time = 0.0;

const context = {
  min_tempo: 30,
  max_tempo: 240,
  min_velocity: 0,
  max_velocity: 127,
  min_volume: 0,
  max_volume: 1,
  min_pitch: 0,
  max_pitch: 1,
  min_pan: -1,
  max_pan: 1,
  min_swing: 0,
  max_swing: 1,
  tempo_default: 120,
  ppqn: 480,
  samples: objectify<Sample>(
    samples.map((x, i) => ({ ...x, id: String(i), sample: null }))
  ),
  selected_track_id: "0",
  edit_velocity_mode: false,
  project: default_project
};

// @ts-ignore
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audio_context = new AudioContext();

// https://hackernoon.com/unlocking-web-audio-the-smarter-way-8858218c0e09
web_audio_touch_unlock(audio_context).then(
  unlocked => {
    if (unlocked) {
      // AudioContext was unlocked from an explicit user action,
      // sound should start playing now
    } else {
      // There was no need for unlocking, devices other than iOS
    }
  },
  reason => {
    alert(reason);
  }
);

const timer_worker = new Worker(_timer_worker);
timer_worker.onmessage = event => {
  if (event.data === "TICK") {
    schedule(
      context.project.tempo,
      context.ppqn,
      context.project.beat_unit,
      context.project.beat_units_per_measure,
      context.project.swing,
      context.max_velocity,
      context.project.notes,
      context.project.tracks,
      context.samples
    );
  }
};
timer_worker.postMessage({
  interval: get_ms_per_tick(context.ppqn, context.project.tempo)
});

Promise.all(
  Object.keys(context.samples).map(id => {
    const sample = context.samples[id];
    return (
      fetch(new Request(sample.path))
        .then(res => res.arrayBuffer())
        // .then(array_buffer => audio_context.decodeAudioData(array_buffer))
        // https://stackoverflow.com/a/52536753
        .then(
          array_buffer =>
            new Promise((resolve, reject) =>
              audio_context.decodeAudioData(
                array_buffer,
                buffer => resolve(buffer),
                e => reject(e)
              )
            )
        )
        .then(audio_buffer => ({
          ...sample,
          sample: audio_buffer as AudioBuffer
        }))
    );
  })
).then(xs => {
  context.samples = objectify<Sample>(xs);
});

type AppCtx = typeof context;

export const appMachine = Machine<AppCtx>(
  {
    id: "app",
    initial: "stopped",
    context,
    states: {
      stopped: {
        on: {
          PLAY: {
            target: "playing"
          }
        }
      },
      playing: {
        activities: ["start_timer"],
        on: {
          STOP: {
            target: "stopped"
          }
        }
      }
    },
    on: {
      CHANGE_TEMPO: {
        actions: [
          assign({ project: (ctx, e) => ({ ...ctx.project, tempo: e.value }) }),
          "set_timer"
        ]
      },
      PAD_PRESS: {
        actions: [
          assign({
            project: (ctx, { value: { start, track_id } }) => {
              const notes = ctx.project.notes.slice();
              const note_index = notes.findIndex(
                x => x.track_id === track_id && x.start === start
              );

              if (note_index === -1) {
                notes.push({
                  track_id,
                  start,
                  velocity: 127
                });
              } else {
                notes.splice(note_index, 1);
              }

              return { ...ctx.project, notes };
            }
          }),
          "set_timer"
        ]
      },
      CHANGE_TRACK_QUANTIZE: {
        actions: [
          assign({
            project: (
              ctx,
              { value: { quantize, quantize_prev, track_id } }
            ) => {
              const tracks = ctx.project.tracks.slice();
              const i = tracks.findIndex(x => x.id === track_id);
              if (i !== -1) {
                tracks[i] = { ...tracks[i], quantize };
              }
              return {
                ...ctx.project,
                notes: quantize_notes(
                  ctx.ppqn,
                  quantize,
                  quantize_prev,
                  ctx.project.notes,
                  track_id
                ),
                tracks
              };
            }
          }),
          "set_timer"
        ]
      },
      ADD_TRACK: {
        actions: [
          assign({
            project: (ctx, { value: { track_id, sample } }) => {
              const tracks = ctx.project.tracks.slice();
              tracks.push({
                id: track_id,
                name: basename(sample.path, extname(sample.path)),
                sample_id: sample.id,
                quantize: 16,
                volume: 1,
                pan: 0,
                pitch: 0.5,
                solo: false,
                mute: false
              });
              return { ...ctx.project, tracks };
            },
            selected_track_id: (ctx, { value: { track_id } }) => track_id
          }),
          "set_timer"
        ]
      },
      DELETE_TRACK: {
        actions: [
          assign({
            project: (ctx, { value: track_id }) => {
              return {
                ...ctx.project,
                tracks: ctx.project.tracks.filter(x => x.id !== track_id),
                notes: ctx.project.notes.filter(x => x.track_id !== track_id)
              };
            }
          }),
          "set_timer"
        ]
      },
      DUPLICATE_TRACK: {
        actions: [
          assign({
            project: (ctx, { value: { track_id, new_track_id } }) => {
              const tracks = ctx.project.tracks.slice();
              const track_index = tracks.findIndex(x => x.id === track_id);
              if (track_index !== -1) {
                const track = { ...tracks[track_index], id: new_track_id };
                tracks.splice(track_index + 1, 0, track);
              }
              let notes = ctx.project.notes.slice();
              notes = notes.concat(
                notes
                  .filter(x => x.track_id === track_id)
                  .map(x => ({ ...x, track_id: new_track_id }))
              );

              return { ...ctx.project, tracks, notes };
            },
            selected_track_id: (ctx, { value: { new_track_id } }) => {
              return new_track_id;
            }
          }),
          "set_timer"
        ]
      },
      CLEAR_TRACK_NOTES: {
        actions: [
          assign({
            project: (ctx, { value: track_id }) => {
              return {
                ...ctx.project,
                notes: ctx.project.notes.filter(x => x.track_id !== track_id)
              };
            }
          }),
          "set_timer"
        ]
      },
      SET_TRACK_SAMPLE: {
        actions: [
          assign({
            project: (ctx, { value: { sample_id, track_id } }) => {
              const tracks = ctx.project.tracks.slice();
              const i = tracks.findIndex(x => x.id === track_id);
              if (i !== -1) {
                tracks[i] = { ...tracks[i], sample_id };
              }
              return { ...ctx.project, tracks };
            }
          }),
          "set_timer"
        ]
      },
      SET_TRACK_VOLUME: {
        actions: [
          assign({
            project: (ctx, { value: { volume, track_id } }) => {
              const tracks = ctx.project.tracks.slice();
              const i = tracks.findIndex(x => x.id === track_id);
              if (i !== -1) {
                tracks[i] = { ...tracks[i], volume };
              }
              return { ...ctx.project, tracks };
            }
          }),
          "set_timer"
        ]
      },
      SET_TRACK_PAN: {
        actions: [
          assign({
            project: (ctx, { value: { pan, track_id } }) => {
              const tracks = ctx.project.tracks.slice();
              const i = tracks.findIndex(x => x.id === track_id);
              if (i !== -1) {
                tracks[i] = { ...tracks[i], pan };
              }
              return { ...ctx.project, tracks };
            }
          }),
          "set_timer"
        ]
      },
      SET_TRACK_PITCH: {
        actions: [
          assign({
            project: (ctx, { value: { pitch, track_id } }) => {
              const tracks = ctx.project.tracks.slice();
              const i = tracks.findIndex(x => x.id === track_id);
              if (i !== -1) {
                tracks[i] = { ...tracks[i], pitch };
              }
              return { ...ctx.project, tracks };
            }
          }),
          "set_timer"
        ]
      },
      SET_TRACK_SOLO: {
        actions: [
          assign({
            project: (ctx, { value: { solo, track_id } }) => {
              const tracks = ctx.project.tracks.slice();
              const i = tracks.findIndex(x => x.id === track_id);
              if (i !== -1) {
                tracks[i] = { ...tracks[i], solo };
              }
              return { ...ctx.project, tracks };
            }
          }),
          "set_timer"
        ]
      },
      SET_TRACK_MUTE: {
        actions: [
          assign({
            project: (ctx, { value: { mute, track_id } }) => {
              const tracks = ctx.project.tracks.slice();
              const i = tracks.findIndex(x => x.id === track_id);
              if (i !== -1) {
                tracks[i] = { ...tracks[i], mute };
              }
              return { ...ctx.project, tracks };
            }
          }),
          "set_timer"
        ]
      },
      SET_NOTE_VELOCITY: {
        actions: [
          assign({
            project: (ctx, { value: { velocity, start, track_id } }) => {
              const notes = ctx.project.notes.slice();
              const noteIndex = notes.findIndex(
                x => x.track_id === track_id && x.start === start
              );
              if (noteIndex === -1) {
                notes.push({
                  start,
                  velocity,
                  track_id
                });
              } else if (velocity === 0) {
                notes.splice(noteIndex, 1);
              } else {
                notes[noteIndex].velocity = velocity;
              }
              return { ...ctx.project, notes };
            }
          }),
          "set_timer"
        ]
      },
      SET_TIME_SIGNATURE: {
        actions: [
          assign({
            project: (ctx, event) => {
              return {
                ...ctx.project,
                beat_units_per_measure: event.value.beat_units_per_measure,
                beat_unit: event.value.beat_unit
              };
            }
          }),
          "set_timer"
        ]
      },
      SET_SWING: {
        actions: [
          assign({
            project: (ctx, event) => {
              return { ...ctx.project, swing: event.value };
            }
          }),
          "set_timer"
        ]
      },
      SET_PROJECT: {
        actions: [
          assign({
            project: (ctx, event) => {
              return event.value;
            }
          }),
          "set_timer"
        ]
      },
      DOUBLE_PATTERN: {
        actions: [
          assign({
            project: (ctx, event) => {
              const ticks_per_measure = get_ticks_per_measure(
                ctx.ppqn,
                ctx.project.beat_units_per_measure,
                ctx.project.beat_unit
              );
              const num_measures = get_num_measures(
                ctx.project.notes,
                ctx.ppqn,
                ctx.project.beat_units_per_measure,
                ctx.project.beat_unit
              );
              const ticks_offset = ticks_per_measure * num_measures;
              const notes = ctx.project.notes.concat(
                ctx.project.notes.map(x => ({
                  ...x,
                  start: x.start + ticks_offset
                }))
              );
              return { ...ctx.project, notes };
            }
          }),
          "set_timer"
        ]
      },
      CLEAR_PATTERN: {
        actions: [
          assign({
            project: (ctx, event) => {
              return { ...ctx.project, notes: [] };
            }
          }),
          "set_timer"
        ]
      },
      RANDOMIZE_KIT: {
        actions: [
          assign({
            project: (ctx, event) => {
              const samples_by_kind = groupBy(x => x.kind, ctx.samples);
              const tracks = ctx.project.tracks.map(x => {
                const sample_old = ctx.samples[x.sample_id];
                if (sample_old) {
                  const kind = sample_old.kind;
                  const kind_samples = samples_by_kind[kind];
                  const sample_new =
                    kind_samples[get_random_int(0, kind_samples.length - 1)];
                  if (sample_new) {
                    return { ...x, sample_id: sample_new.id };
                  }
                  return x;
                }
                return x;
              });
              return { ...ctx.project, tracks };
            }
          }),
          "set_timer"
        ]
      },
      SET_SELECTED_TRACK_ID: {
        actions: assign({
          selected_track_id: (ctx, event) => event.value
        })
      },
      SET_EDIT_VELOCITY_MODE: {
        actions: assign({
          edit_velocity_mode: (ctx, event) => event.value
        })
      },
      EXPORT_PROJECT: {
        actions: ["export_project"]
      },
      EXPORT_MIDI: {
        actions: ["export_midi"]
      },
      PREVIEW_SAMPLE: {
        actions: ["play_sample"]
      }
    }
  },
  {
    activities: {
      start_timer: (ctx, event) => {
        current_tick = 0;
        next_note_time = audio_context.currentTime;
        timer_worker.postMessage("START");
        return () => timer_worker.postMessage("STOP");
      }
    },
    actions: {
      set_timer: ctx => {
        timer_worker.postMessage({
          interval: get_ms_per_tick(ctx.ppqn, ctx.project.tempo)
        });
        timer_worker.onmessage = event => {
          if (event.data === "TICK") {
            schedule(
              ctx.project.tempo,
              ctx.ppqn,
              ctx.project.beat_unit,
              ctx.project.beat_units_per_measure,
              ctx.project.swing,
              ctx.max_velocity,
              ctx.project.notes,
              ctx.project.tracks,
              ctx.samples
            );
          }
        };
      },
      play_sample: (ctx, event) => {
        const {
          value: { sample_id, track_id }
        } = event;
        const sample = ctx.samples[sample_id];
        const track = ctx.project.tracks.find(x => x.id === track_id);
        if (sample && sample.sample && track) {
          schedule_sound(
            audio_context,
            audio_context.currentTime,
            sample.sample,
            track.volume,
            track.pan,
            track.pitch,
            0
          );
        }
      },
      export_project: ctx => {
        const href =
          "data:text/json;charset=utf-8," +
          encodeURIComponent(JSON.stringify(ctx.project, null, 2));

        const a = document.createElement("a");
        a.href = href;
        a.download = Date.now() + ".json";

        a.click();
      },
      export_midi: ctx => {
        const midi_note_number_track_map = get_midi_note_number_mapping(
          midi_note_number_map,
          ctx.project.tracks,
          ctx.samples
        );

        const notes = ctx.project.notes.map(x => ({
          ...x,
          start: Math.max(
            0,
            x.start + get_swing_ticks(ctx.project.swing, x.start, ctx.ppqn)
          )
        }));

        const href =
          "data:audio/midi;base64," +
          btoa(
            get_midi(
              midi_note_number_track_map,
              ctx.ppqn,
              ctx.project.tempo,
              notes,
              ctx.project.tracks
            ).toBytes()
          );

        const a = document.createElement("a");
        a.href = href;
        a.download = Date.now() + ".mid";

        a.click();
      }
    }
  }
);

function schedule(
  tempo: number,
  ppqn: number,
  beat_unit: number,
  beat_units_per_measure: number,
  swing: number,
  max_velocity: number,
  notes: Array<Note>,
  tracks: Array<Track>,
  samples: { [id: string]: Sample }
) {
  // How far ahead to schedule audio (sec)
  const schedule_ahead_time = 0.1;

  while (next_note_time < audio_context.currentTime + schedule_ahead_time) {
    const are_some_tracks_solo = tracks.filter(x => x.solo).length > 0;

    for (let note of notes) {
      // parseInt because we may end up with fractions, e.g. on triplets.
      if (
        current_tick ===
        // @ts-ignore
        parseInt(note.start)
      ) {
        const track = tracks.find(x => x.id === note.track_id);

        if (!track) {
          continue;
        }

        if (track.mute && !track.solo) {
          continue;
        }

        if (are_some_tracks_solo && !track.solo) {
          continue;
        }

        const sample = samples[track.sample_id].sample;

        const swing_duration = swing
          ? get_swing_ticks(swing, current_tick, ppqn) *
            get_s_per_tick(ppqn, tempo)
          : 0;

        schedule_sound(
          audio_context,
          next_note_time,
          sample,
          track.volume * (note.velocity / max_velocity),
          track.pan,
          track.pitch,
          swing_duration
        );
      }
    }

    const ticks_per_measure = get_ticks_per_measure(
      ppqn,
      beat_units_per_measure,
      beat_unit
    );
    const num_measures = get_num_measures(
      notes,
      ppqn,
      beat_units_per_measure,
      beat_unit
    );

    next_note_time += get_s_per_tick(ppqn, tempo);
    current_tick++;

    if (
      // current_tick ===
      // TODO
      current_tick >=
      ticks_per_measure * num_measures
    ) {
      current_tick = 0;
    }
  }
}

function schedule_sound(
  audio_context: AudioContext,
  time: number,
  sample: AudioBuffer | null,
  volume: number,
  pan: number,
  pitch: number,
  swing_duration: number
) {
  const source = audio_context.createBufferSource();
  source.buffer =
    sample ||
    // Empty stereo buffer as default until sample loads.
    // 22050 frames / 44100 Hz = 0.5 seconds.
    audio_context.createBuffer(
      2,
      audio_context.sampleRate / 2,
      audio_context.sampleRate
    );

  // Min rate = 0.5, max rate = 2.0.
  const rate = Math.pow(2.0, 2.0 * (pitch - 0.5));
  source.playbackRate.value = rate;

  const panner = audio_context.createPanner();
  panner.panningModel = "equalpower";
  panner.setPosition(pan, 0, 1 - Math.abs(pan));

  // Prevent clipping when panned.
  const gain_node = audio_context.createGain();
  gain_node.gain.value = 1;
  gain_node.gain.value = volume * 0.8;

  source.connect(panner);
  panner.connect(gain_node);
  gain_node.connect(audio_context.destination);

  const start_time = Math.max(0, time + swing_duration);

  source.start(start_time);
  source.stop(
    start_time +
      source.buffer.duration * Math.pow(source.playbackRate.value, -1)
  );
}

export function get_num_measures(
  notes: Array<Note>,
  ppqn: number,
  beat_units_per_measure: number,
  beat_unit: number
) {
  const tick_max = Math.max(...notes.map(x => x.start));
  const ticks_per_measure = get_ticks_per_measure(
    ppqn,
    beat_units_per_measure,
    beat_unit
  );
  // Return at least 1 measure.
  return Math.max(1, Math.ceil((tick_max + 1) / ticks_per_measure));
}

function get_ticks_per_measure(
  ppqn: number,
  beat_units_per_measure: number,
  beat_unit: number
) {
  return ppqn * 4 * (beat_units_per_measure / beat_unit);
}

function get_ms_per_tick(ppqn: number, tempo: number) {
  return 60000 / (tempo * ppqn);
}

function get_s_per_tick(ppqn: number, tempo: number) {
  return 60 / (tempo * ppqn);
}

function get_swing_ticks(swing: number, tick: number, ppqn: number) {
  let swing_ticks = 0;
  if (swing) {
    if (tick % (ppqn / 2)) {
      swing_ticks = Math.ceil(swing * 30);
    } else {
      swing_ticks = Math.ceil(swing * -30);
    }
  }
  return swing_ticks;
}

function quantize_notes(
  ppqn: number,
  quantize: number,
  quantize_prev: number,
  notes: Array<Note>,
  track_id: string
) {
  if (quantize < quantize_prev) {
    const ticks_per_quantize = ppqn / (quantize / 4);
    return notes.filter(x =>
      x.track_id === track_id ? !(x.start % ticks_per_quantize) : true
    );
  }
  if (quantize > quantize_prev) {
    const ticks_per_quantize = ppqn / (quantize / 4);
    const ticks_per_quantize_prev = ppqn / (quantize_prev / 4);
    return notes.map(x => {
      if (x.track_id === track_id) {
        if (x.start % ticks_per_quantize === 0) {
          return x;
        }
        const i = x.start / ticks_per_quantize_prev;
        const start = ticks_per_quantize * i;
        return { ...x, start };
      }
      return x;
    });
  }
  return notes;
}

function objectify<T>(xs: Array<T>): { [id: string]: T } {
  return xs.reduce(
    (acc, x) => ({
      ...acc,
      // @ts-ignore
      [x.id]: x
    }),
    {}
  );
}

function web_audio_touch_unlock(audio_context: AudioContext) {
  return new Promise((resolve, reject) => {
    if (audio_context.state === "suspended" && "ontouchstart" in window) {
      const unlock = () => {
        audio_context.resume().then(
          () => {
            document.body.removeEventListener("touchstart", unlock);
            document.body.removeEventListener("touchend", unlock);
            resolve(true);
          },
          reason => {
            reject(reason);
          }
        );
      };
      document.body.addEventListener("touchstart", unlock, false);
      document.body.addEventListener("touchend", unlock, false);
    } else {
      resolve(false);
    }
  });
}

function get_random_int(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const quantizes = [
  { value: 4, label: "1/4" },
  { value: 6, label: "1/4T" },
  { value: 8, label: "1/8" },
  { value: 12, label: "1/8T" },
  { value: 16, label: "1/16" },
  { value: 24, label: "1/16T" },
  { value: 32, label: "1/32" },
  { value: 48, label: "1/32T" }
];

export const time_signatures = [
  { beat_units_per_measure: 1, beat_unit: 4 },
  { beat_units_per_measure: 2, beat_unit: 4 },
  { beat_units_per_measure: 3, beat_unit: 4 },
  { beat_units_per_measure: 4, beat_unit: 4 },
  { beat_units_per_measure: 5, beat_unit: 4 },
  { beat_units_per_measure: 6, beat_unit: 4 },
  { beat_units_per_measure: 7, beat_unit: 4 },
  { beat_units_per_measure: 8, beat_unit: 4 }
];
