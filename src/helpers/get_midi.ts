import Midi from "jsmidgen";

export function get_midi(ppqn: number, tempo: number, notes) {
  const channel = 10; // General MIDI percussion

  const midi_file = new Midi.File({ ticks: ppqn });
  const midi_track = midi_file.addTrack();
  midi_track.setTempo(tempo);

  const events = notes
    .sort((a, b) => a.start - b.start)
    .map(note => {
      return {
        channel,
        midi_note_number: note.midi_note_number,
        velocity: note.velocity,
        on: note.start,
        off: note.start + note.duration
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
