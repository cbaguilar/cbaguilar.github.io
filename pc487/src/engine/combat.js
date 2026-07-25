const PISTOL_DAMAGE = 34;
const PISTOL_RANGE = 42;
const PISTOL_COOLDOWN_SECONDS = 0.32;
const AIM_CONE_DOT = 0.94;

export function createCombatSystem({ scene, playerController, itemSystem, npcSystem, audioSystem, onPromptChange }) {
    const input = createInputState(scene.getEngine().getRenderingCanvas());
    const state = {
        cooldown: 0,
        messageTime: 0,
    };

    const observer = scene.onBeforeRenderObservable.add(() => {
        const deltaSeconds = scene.getEngine().getDeltaTime() / 1000;
        updateCombat({
            scene,
            playerController,
            itemSystem,
            npcSystem,
            audioSystem,
            input,
            state,
            onPromptChange,
            deltaSeconds,
        });
    });

    return {
        dispose() {
            scene.onBeforeRenderObservable.remove(observer);
            input.dispose();
        },
    };
}

function updateCombat({ scene, playerController, itemSystem, npcSystem, audioSystem, input, state, onPromptChange, deltaSeconds }) {
    state.cooldown = Math.max(0, state.cooldown - deltaSeconds);
    state.messageTime = Math.max(0, state.messageTime - deltaSeconds);

    const shootRequested = input.consumeShoot();

    if (!shootRequested) {
        return;
    }

    if (!playerController.active) {
        showCombatMessage(onPromptChange, state, "Exit the vehicle to shoot");
        return;
    }

    if (!itemSystem.hasItem("pistol")) {
        showCombatMessage(onPromptChange, state, "Pick up the pistol first");
        return;
    }

    if (state.cooldown > 0) {
        return;
    }

    state.cooldown = PISTOL_COOLDOWN_SECONDS;
    playerController.playShootAnimation();
    audioSystem.playGunshot();

    const shot = getShotVector(playerController.mesh);
    const hit = npcSystem.findTarget({
        origin: shot.origin,
        direction: shot.direction,
        range: PISTOL_RANGE,
        minDot: AIM_CONE_DOT,
    });

    const tracerEnd = hit
        ? hit.npc.proxy.position.add(new BABYLON.Vector3(0, 0.9, 0))
        : shot.origin.add(shot.direction.scale(PISTOL_RANGE));

    createTracer(scene, shot.origin, tracerEnd, Boolean(hit));

    if (!hit) {
        showCombatMessage(onPromptChange, state, "Miss");
        return;
    }

    const result = npcSystem.damageNpc(hit.npc, PISTOL_DAMAGE);
    showCombatMessage(onPromptChange, state, result.defeated ? "NPC down" : `Hit NPC (${result.health} HP)`);
}

function getShotVector(playerMesh) {
    const direction = new BABYLON.Vector3(Math.sin(playerMesh.rotation.y), 0, Math.cos(playerMesh.rotation.y));
    direction.normalize();

    return {
        origin: playerMesh.position.add(new BABYLON.Vector3(0, 1.35, 0)).add(direction.scale(0.8)),
        direction,
    };
}

function createTracer(scene, start, end, hit) {
    const tracer = BABYLON.MeshBuilder.CreateTube(
        "pistolTracer",
        {
            path: [start, end],
            radius: hit ? 0.045 : 0.025,
            tessellation: 6,
        },
        scene,
    );
    const material = new BABYLON.StandardMaterial("pistolTracerMaterial", scene);
    material.emissiveColor = hit
        ? new BABYLON.Color3(1, 0.18, 0.08)
        : new BABYLON.Color3(1, 0.78, 0.24);
    material.diffuseColor = material.emissiveColor;
    tracer.material = material;

    window.setTimeout(() => {
        tracer.dispose();
        material.dispose();
    }, 85);
}

function showCombatMessage(onPromptChange, state, message) {
    state.messageTime = 0.9;
    onPromptChange(message, { holdMs: 900 });
}

function createInputState(canvas) {
    let shootRequested = false;

    function requestShoot(event) {
        if (event.type === "keydown" && event.code !== "Space") {
            return;
        }

        if (event.type === "pointerdown" && event.button !== 0) {
            return;
        }

        event.preventDefault();
        shootRequested = true;
    }

    window.addEventListener("keydown", requestShoot);

    if (canvas) {
        canvas.addEventListener("pointerdown", requestShoot);
    }

    return {
        consumeShoot() {
            const requested = shootRequested;
            shootRequested = false;
            return requested;
        },
        dispose() {
            window.removeEventListener("keydown", requestShoot);

            if (canvas) {
                canvas.removeEventListener("pointerdown", requestShoot);
            }
        },
    };
}
