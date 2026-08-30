const PISTOL_DAMAGE = 34;
const PISTOL_RANGE = 42;
const PISTOL_COOLDOWN_SECONDS = 0.32;
const AIM_CONE_DOT = 0.94;

export function createCombatSystem({ scene, playerController, vehicleController, itemSystem, npcSystem, audioSystem, onPromptChange }) {
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
            vehicleController,
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

function updateCombat({ scene, playerController, vehicleController, itemSystem, npcSystem, audioSystem, input, state, onPromptChange, deltaSeconds }) {
    state.cooldown = Math.max(0, state.cooldown - deltaSeconds);
    state.messageTime = Math.max(0, state.messageTime - deltaSeconds);

    const shootRequest = input.consumeShoot();

    if (!shootRequest) {
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
    const aimPoint = shootRequest.pointer
        ? getGroundAimPoint(scene, shootRequest.pointer.x, shootRequest.pointer.y)
        : null;
    const shooter = getActiveShooter({ playerController, vehicleController, npcSystem, aimPoint });

    shooter.animate();
    audioSystem.playGunshot();

    const shot = shooter.getShotVector();
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

function getActiveShooter({ playerController, vehicleController, npcSystem, aimPoint }) {
    if (playerController.active) {
        if (aimPoint) {
            playerController.facePoint(aimPoint);
        }

        return {
            animate() {
                playerController.playShootAnimation();
            },
            getShotVector() {
                return getShotVectorFromMesh({
                    mesh: playerController.mesh,
                    origin: playerController.getMuzzlePosition(),
                    aimPoint,
                });
            },
        };
    }

    if (vehicleController?.active) {
        return {
            animate() {},
            getShotVector() {
                const mesh = vehicleController.mesh;
                return getShotVectorFromMesh({
                    mesh,
                    origin: getVehicleMuzzlePosition(mesh),
                    aimPoint,
                });
            },
        };
    }

    if (npcSystem.activeMount) {
        return {
            animate() {
                npcSystem.activeMount.ride.walkTime += 0.18;
            },
            getShotVector() {
                const mesh = npcSystem.activeMount.proxy;
                return getShotVectorFromMesh({
                    mesh,
                    origin: mesh.position.add(new BABYLON.Vector3(0, 2.35, 0)).add(getForward(mesh).scale(1.45)),
                    aimPoint,
                });
            },
        };
    }

    return {
        animate() {},
        getShotVector() {
            return getShotVectorFromMesh({
                mesh: playerController.mesh,
                origin: playerController.getMuzzlePosition(),
                aimPoint,
            });
        },
    };
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

function getShotVectorFromMesh({ mesh, origin, aimPoint }) {
    const direction = aimPoint
        ? aimPoint.subtract(origin)
        : getForward(mesh);
    direction.y = 0;

    if (direction.lengthSquared() < 0.0001) {
        direction.copyFrom(getForward(mesh));
    }

    direction.normalize();

    return {
        origin,
        direction,
    };
}

function getVehicleMuzzlePosition(mesh) {
    return mesh.position
        .add(new BABYLON.Vector3(0, 1.75, 0))
        .add(getForward(mesh).scale(5.35));
}

function getForward(mesh) {
    const direction = new BABYLON.Vector3(Math.sin(mesh.rotation.y), 0, Math.cos(mesh.rotation.y));
    direction.normalize();
    return direction;
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
    const mobileShootButton = document.querySelector("#mobile-shoot");

    function requestShoot(event) {
        if (event.type === "keydown" && event.code !== "Space") {
            return;
        }

        if (event.type === "pointerdown" && event.button !== 0) {
            return;
        }

        if (event.defaultPrevented || (event.currentTarget === canvas && event.pointerType === "touch")) {
            return;
        }

        event.preventDefault();
        shootRequest = event.currentTarget === mobileShootButton
            ? {}
            : event.type === "pointerdown"
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

    mobileShootButton?.addEventListener("pointerdown", requestShoot);

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

            mobileShootButton?.removeEventListener("pointerdown", requestShoot);
        },
    };
}
