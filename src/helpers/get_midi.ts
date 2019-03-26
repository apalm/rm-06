import Midi from "jsmidgen";

export function get_midi(
  midi_note_number_track_map,
  ppqn: number,
  tempo: number,
  notes,
  tracks
) {
  const channel = 10; // General MIDI percussion

  const midi_file = new Midi.File({ ticks: ppqn });
  const midi_track = midi_file.addTrack();
  midi_track.setTempo(tempo);

  const track_id_to_midi_note_number = Object.entries(
    midi_note_number_track_map
  ).reduce(
    (acc, [k, v]) => ({
      ...acc,
      // @ts-ignore
      [v.id]: Number(k)
    }),
    {}
  );

  const events = notes
    .sort((a, b) => a.start - b.start)
    .map(note => {
      const track_id = note.track_id;
      const track = tracks.find(x => x.id === track_id);

      const duration = ppqn / (track.quantize / 4);

      return {
        channel,
        midi_note_number: track_id_to_midi_note_number[track_id],
        velocity: note.velocity,
        on: note.start,
        off: note.start + duration
      };
    })
    .reduce((acc, event) => {
      return acc.concat([
        {
          type: "NOTE_ON",
          channel: event.channel,
          midi_note_number: event.midi_note_number,
          time: event.on,
          velocity: event.velocity
        },
        {
          type: "NOTE_OFF",
          channel: event.channel,
          midi_note_number: event.midi_note_number,
          time: event.off,
          velocity: 0 // TODO?
        }
      ]);
    }, [])
    .sort((a, b) => a.time - b.time)
    .map((x, i, xs) => {
      const delta = i === 0 ? 0 : x.time - xs[i - 1].time;
      return { ...x, delta };
    });

  for (let event of events) {
    if (event.type === "NOTE_ON") {
      midi_track.addNoteOn(
        event.channel,
        event.midi_note_number,
        event.delta,
        event.velocity
      );
    } else {
      midi_track.addNoteOff(
        event.channel,
        event.midi_note_number,
        event.delta,
        event.velocity
      );
    }
  }

  return midi_file;
}
