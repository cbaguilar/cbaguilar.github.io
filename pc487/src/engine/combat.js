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

    const shootRequest = input.consumeShoot();

    if (!shootRequest) {
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

    if (shootRequest.pointer) {
        const aimPoint = getGroundAimPoint(scene, shootRequest.pointer.x, shootRequest.pointer.y);

        if (aimPoint) {
            playerController.facePoint(aimPoint);
        }
    }

    playerController.playShootAnimation();
    audioSystem.playGunshot();

    const shot = getShotVector(playerController);
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

    const wasDefeated = hit.npc.defeated;
    const result = npcSystem.damageNpc(hit.npc, PISTOL_DAMAGE);

    if (!wasDefeated && result.defeated) {
        audioSystem.playNpcKnockdown();
    }

    showCombatMessage(onPromptChange, state, result.defeated ? "NPC down" : `Hit NPC (${result.health} HP)`);
}

function getGroundAimPoint(scene, screenX, screenY) {
    const ray = scene.createPickingRay(screenX, screenY, BABYLON.Matrix.Identity(), scene.activeCamera);

    if (Math.abs(ray.direction.y) < 0.0001) {
        return null;
    }

    const distance = -ray.origin.y / ray.direction.y;

    if (distance < 0) {
        return null;
    }

    return ray.origin.add(ray.direction.scale(distance));
}

function getShotVector(playerController) {
    const { mesh: playerMesh } = playerController;
    const direction = new BABYLON.Vector3(Math.sin(playerMesh.rotation.y), 0, Math.cos(playerMesh.rotation.y));
    direction.normalize();

    return {
        origin: playerController.getMuzzlePosition(),
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
    let shootRequest = null;

    function requestShoot(event) {
        if (event.type === "keydown" && event.code !== "Space") {
            return;
        }

        if (event.type === "pointerdown" && event.button !== 0) {
            return;
        }

        event.preventDefault();
        shootRequest = event.type === "pointerdown"
            ? {
                pointer: {
                    x: event.clientX,
                    y: event.clientY,
                },
            }
            : {};
    }

    window.addEventListener("keydown", requestShoot);

    if (canvas) {
        canvas.addEventListener("pointerdown", requestShoot);
    }

    return {
        consumeShoot() {
            const request = shootRequest;
            shootRequest = null;
            return request;
        },
        dispose() {
            window.removeEventListener("keydown", requestShoot);

            if (canvas) {
                canvas.removeEventListener("pointerdown", requestShoot);
            }
        },
    };
}
