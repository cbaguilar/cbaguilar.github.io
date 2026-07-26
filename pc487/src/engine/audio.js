const SOUND_PATH = "assets/sounds/";

export function createAudioSystem() {
    const sounds = {
        equipGun: createSound(`${SOUND_PATH}lowerguncock.wav`, 0.55),
        gunshot: createSound(`${SOUND_PATH}gunshot.wav`, 0.5),
        npcKnockdown: createSound(`${SOUND_PATH}npc-knockdown.wav`, 0.62),
        truckEngine: createLoopingSound(`${SOUND_PATH}truck-engine.mp3`, 0),
    };

    return {
        playEquipGun() {
            sounds.equipGun.play();
        },
        playGunshot() {
            sounds.gunshot.play();
        },
        playNpcKnockdown() {
            sounds.npcKnockdown.play();
        },
        updateTruckEngine({ active, speed }) {
            const speedRatio = Math.min(Math.abs(speed) / 24, 1);
            const targetVolume = active ? 0.14 + speedRatio * 0.42 : 0;
            const playbackRate = 0.7 + speedRatio * 0.95;

            sounds.truckEngine.setVolume(targetVolume);
            sounds.truckEngine.setPlaybackRate(playbackRate);

            if (active && targetVolume > 0.02) {
                sounds.truckEngine.play();
            } else {
                sounds.truckEngine.pause();
            }
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

function createLoopingSound(src, volume) {
    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = volume;

    return {
        play() {
            audio.play().catch(() => {
                // Browsers can reject playback until a user gesture unlocks audio.
            });
        },
        pause() {
            audio.pause();
        },
        setVolume(nextVolume) {
            audio.volume = clamp(nextVolume, 0, 1);
        },
        setPlaybackRate(nextPlaybackRate) {
            audio.playbackRate = clamp(nextPlaybackRate, 0.5, 2);
        },
    };
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
