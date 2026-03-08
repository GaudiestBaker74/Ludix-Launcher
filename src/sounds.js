// assets/sounds.js - Base64 encoded tiny UI sound effects for Ludix OS

// Sound effects generated as minimal synth blips/clicks
const soundAssets = {
    // A subtle, low-pitch thud for hovering over items
    hover: 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',

    // A crisp, higher-pitch click for confirming actions/launching games
    click: 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',

    // A soft sci-fi swoosh for switching tabs
    tab: 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
};

// Simple audio pool to prevent overlapping sound cutoff
const audioPool = {};

window.playSound = function (type, volume = 0.4) {
    if (!soundAssets[type]) return;

    if (!audioPool[type]) {
        audioPool[type] = [];
        for (let i = 0; i < 3; i++) {
            const audio = new Audio(soundAssets[type]);
            audio.volume = volume;
            audioPool[type].push(audio);
        }
    }

    const freeAudio = audioPool[type].find(a => a.paused || a.ended);
    if (freeAudio) {
        freeAudio.volume = volume;
        freeAudio.currentTime = 0;
        freeAudio.play().catch(() => { });
    } else {
        audioPool[type][0].currentTime = 0;
        audioPool[type][0].volume = volume;
        audioPool[type][0].play().catch(() => { });
    }
};
