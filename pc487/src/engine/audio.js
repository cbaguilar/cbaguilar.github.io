const SOUND_PATH = "assets/sounds/";

export function createAudioSystem() {
    const sounds = {
        equipGun: createSound(`${SOUND_PATH}lowerguncock.wav`, 0.55),
        gunshot: createSound(`${SOUND_PATH}gunshot.wav`, 0.5),
    };

    return {
        playEquipGun() {
            sounds.equipGun.play();
        },
        playGunshot() {
            sounds.gunshot.play();
        },
    };
}

function createSound(src, volume) {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = volume;

    return {
        play() {
            audio.currentTime = 0;
            audio.play().catch(() => {
                // Browsers can reject playback until the first user gesture unlocks audio.
            });
        },
    };
}
