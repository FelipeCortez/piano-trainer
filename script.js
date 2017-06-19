

VF = Vex.Flow;

// Create an SVG renderer and attach it to the DIV element named "boo".
var div = document.getElementById("boo")
var renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);

// Configure the rendering context.
renderer.resize(300, 120);
var context = renderer.getContext();
context.setFont("Arial", 10, "").setBackgroundFillStyle("#eed");

// Create a stave of width 400 at position 10, 40 on the canvas.
var stave = new VF.Stave(0, 0, 200).addClef("treble");

// Connect it to the rendering context and draw!
stave.setContext(context).draw();

var tickContext = new VF.TickContext();

const visibleNoteGroups = [];

// ---------------------------------

var midi, data;
// request MIDI access
if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess({
        sysex: false
    }).then(onMIDISuccess, onMIDIFailure);
} else {
    alert("No MIDI support in your browser.");
}

// midi functions
function onMIDISuccess(midiAccess) {
    // when we get a succesful response, run this code
    midi = midiAccess; // this is our raw MIDI data, inputs, outputs, and sysex status

    var inputs = midi.inputs.values();
    // loop over all available inputs and listen for any MIDI input
    for (var input = inputs.next(); input && !input.done; input = inputs.next()) {
        // each time there is a midi message call the onMIDIMessage function
        input.value.onmidimessage = onMIDIMessage;
    }
}

function onMIDIFailure(error) {
    // when we get a failed response, run this code
    console.log("No access to MIDI devices or your browser doesn't support WebMIDI API. Please use WebMIDIAPIShim " + error);
}

function midiNote(noteValue) {
    notes = ["C",
            "Db",
            "D",
            "Eb",
            "E",
            "F",
            "Gb",
            "G",
            "Ab",
            "A",
            "Bb",
            "B"];

    note = {midi: noteValue, pitch: notes[noteValue % 12], octave: Math.floor(noteValue / 12)};
    note.string = note.pitch + note.octave;
    note.vex_string = note.pitch.toLowerCase() + "/" + (note.octave);
    note.acc = note.pitch[1];
    return note;
}



function generateInversionMap() {
    /*
    var inversions = [
        {intervals: [4, 3],
         name: "major",
         root: 0},
        {intervals: invertNotes([4, 3], 1),
         name: "major (1st inversion)",
         root: 2},
        {intervals: invertNotes([4, 3], 2),
         name: "major (2nd inversion)",
         root: 1},
        {intervals: [3, 4],
         name: "minor",
         root: 0},
        {intervals: invertNotes([3, 4], 1),
         name: "minor (1st inversion)",
         root: 2},
        {intervals: invertNotes([3, 4], 2),
         name: "minor (2nd inversion)",
         root: 1}
    ]
    */

    var inversions = [
        {intervals: [4, 3],
         name: "major",
         root: 0},
        {intervals: [3, 4],
         name: "minor",
         root: 0},
        {intervals: [3, 3],
         name: "diminished",
         root: 0},
        {intervals: [4, 3, 4],
         name: "maj7",
         root: 0},
        {intervals: [4, 3, 3],
         name: "7",
         root: 0},
        {intervals: [3, 4, 3],
         name: "min7",
         root: 0},
        {intervals: [3, 3, 3],
         name: "half dim",
         root: 0},
        {intervals: [3, 3, 4],
         name: "dim",
         root: 0},
        {intervals: [4, 4],
         name: "augmented",
         root: 0}
    ]

    for(i = inversions.length - 4; i >= 0; --i) {
        var inversion = inversions[i];
        for(j = 0; j < inversion.intervals.length; ++j) {
            inversions.push({intervals: invertNotes(inversion.intervals, j + 1),
                             name: inversion.name + " (inv" + (j + 1) + ")",
                             root: inversion.intervals.length - (j)});
        }
    }

    var inversionMap = [];
    for(i = 0; i < inversions.length; ++i) {
        var key = inversions[i].intervals.join("_");
        inversionMap[key] = inversions[i];
    }

    return inversionMap;
}

function invertNotes(intervalList, n = 1) {
    if(n < 0) {
        throw "Invalid inversion number"
    } else if(n == 0) {
        return intervalList;
    } else {
        var inverted = intervalList.slice(1);
        sum = intervalList.reduce((pv, cv) => pv + cv, 0);
        inverted.push(12 - sum);
        return invertNotes(inverted,
                           n - 1);
    }
}

function getInversion(notesHeld) {
    var notesList = notesHeld.sort().map(midiNote)
    var intervalList = intervals(notesHeld);
    var inv = inversionMap[intervalList.join("_")];

    if(inv) {
        return notesList[inv.root].pitch + " " + inv.name;
    } else {
        return "-";
    }
}

function intervals(notesHeld) {
    notesMidi = notesHeld.sort().map(midiNote).map(note => note.midi);

    intervalList = [];
    for(i = 0; i < notesMidi.length - 1; ++i) {
        intervalList.push(notesMidi[i + 1] - notesMidi[i]);
    }

    return intervalList;
}

function detectInversion(notesHeld) {
    inversionElement = document.getElementById("inversion");

    if(notesHeld.length >= 3) {
        inv = getInversion(notesHeld);
        if(inv) {
            inversionElement.innerHTML = inv;
        } else {
            inversionElement.innerHTML = "-";
        }
    } else {
        inversionElement.innerHTML = "-";
    }
}

function drawNote(note) {
    const group = context.openGroup();
    visibleNoteGroups[note] = group;
    const vex_note = new VF.StaveNote({clef: "treble",
                                       keys: [midiNote(note).vex_string],
                                       duration: "w" })
                        .setContext(context)
                        .setStave(stave);

    acc = midiNote(note).acc
    if(acc) vex_note.addAccidental(0, new VF.Accidental(acc));
    tickContext.addTickable(vex_note)
    tickContext.preFormat().setX(50);
    vex_note.draw();
    context.closeGroup();
}

function removeNote(note) {
    visibleNoteGroups[note].remove();
}

function onMIDIMessage(message) {
    data = message.data; // this gives us our [command/channel, note, velocity] data.
    if(data[0] == 144) {
        notesHeld.push(data[1]);
        drawNote(data[1]);
    } else if(data[0] == 128) {
        removeNote(data[1]);
        notesHeld.splice(notesHeld.indexOf(data[1]), 1);
    }

    notes_list = notesHeld.sort().map(midiNote).map(a => a.string);
    if(notes_list.length == 0) {
        notes_str = "-";
    } else {
        notes_str = notes_list.join(", ");
    }

    notesElement = document.getElementById("notes");
    notesElement.innerHTML = notes_str;

    detectInversion(notesHeld);
}

const ac = new AudioContext();

Soundfont.instrument(ac, 'acoustic_grand_piano').then(function (piano) {
    window.navigator.requestMIDIAccess().then(function (midiAccess) {
        midiAccess.inputs.forEach(function (midiInput) {
            piano.listenToMidi(midiInput)
        })
    })
})

function playNotes(noteList, duration = 0.25) {
    Soundfont.instrument(ac, 'acoustic_grand_piano').then(function (piano) {
        var t = 0;
        for(i = 0; i < noteList.length; ++i) {
            piano.play(noteList[i], ac.currentTime + t, { duration: 0.5})
            t += duration;
        }
    });
}

document.getElementById("major_normal").addEventListener("click", function() {
    playNotes(["C3", "E3", "G3", "E3", "C3"]);
});

notesHeld = [];
inversionMap = generateInversionMap();

