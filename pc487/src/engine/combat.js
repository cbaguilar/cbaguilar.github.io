const PISTOL_DAMAGE = 34;
const PISTOL_RANGE = 42;
const PISTOL_COOLDOWN_SECONDS = 0.32;
const STICK_DAMAGE = 18;
const STICK_RANGE = 4.4;
const STICK_COOLDOWN_SECONDS = 0.48;
const AIM_CONE_DOT = 0.94;
const MELEE_CONE_DOT = 0.56;

export function createCombatSystem({ scene, playerController, vehicleController, itemSystem, npcSystem, audioSystem, onPromptChange }) {
    const input = createInputState(scene.getEngine().getRenderingCanvas());
    const state = {
        cooldown: 0,
        messageTime: 0,
        shotsFired: 0,
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
        get shotsFired() {
            return state.shotsFired;
        },
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

    if (playerController.active && !playerController.controlsEnabled) {
        return;
    }

    const weapon = getActiveWeapon(itemSystem);

    if (!weapon) {
        showCombatMessage(onPromptChange, state, "Find a stick or rock first");
        return;
    }

    if (state.cooldown > 0) {
        return;
    }

    state.cooldown = weapon.cooldown;
    state.shotsFired += 1;
    const aimPoint = shootRequest.pointer
        ? getGroundAimPoint(scene, shootRequest.pointer.x, shootRequest.pointer.y)
        : null;
    const shooter = getActiveShooter({ playerController, vehicleController, npcSystem, aimPoint });

    shooter.animate();

    if (weapon.id === "pistol") {
        audioSystem.playGunshot();
    } else if (weapon.id === "stick") {
        audioSystem.playStickSwing();
    }

    const shot = shooter.getShotVector();
    const hit = npcSystem.findTarget({
        origin: shot.origin,
        direction: shot.direction,
        range: weapon.range,
        minDot: weapon.minDot,
    });

    if (weapon.id === "pistol") {
        const tracerEnd = hit
            ? hit.npc.proxy.position.add(new BABYLON.Vector3(0, 0.9, 0))
            : shot.origin.add(shot.direction.scale(weapon.range));
        createTracer(scene, shot.origin, tracerEnd, Boolean(hit));
    } else {
        createStickSwing(scene, shot.origin, shot.direction, Boolean(hit));
    }

    if (!hit) {
        showCombatMessage(onPromptChange, state, weapon.id === "stick" ? "Swung wide" : "Miss");
        return;
    }

    const wasDefeated = hit.npc.defeated;
    const result = npcSystem.damageNpc(hit.npc, weapon.damage);

    audioSystem.playHit();

    if (!wasDefeated && result.defeated) {
        audioSystem.playNpcKnockdown();
    }

    showCombatMessage(onPromptChange, state, result.defeated ? "NPC down" : `Hit NPC (${result.health} HP)`);
}

function getActiveWeapon(itemSystem) {
    if (itemSystem.hasItem("pistol")) {
        return {
            id: "pistol",
            damage: PISTOL_DAMAGE,
            range: PISTOL_RANGE,
            cooldown: PISTOL_COOLDOWN_SECONDS,
            minDot: AIM_CONE_DOT,
        };
    }

    if (itemSystem.hasItem("stick")) {
        return {
            id: "stick",
            damage: STICK_DAMAGE,
            range: STICK_RANGE,
            cooldown: STICK_COOLDOWN_SECONDS,
            minDot: MELEE_CONE_DOT,
        };
    }

    return null;
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

function createStickSwing(scene, origin, direction, hit) {
    const side = new BABYLON.Vector3(direction.z, 0, -direction.x).normalize();
    const center = origin.add(direction.scale(2.35));
    const start = center.add(side.scale(-1.25));
    const end = center.add(side.scale(1.25));
    const swing = BABYLON.MeshBuilder.CreateTube(
        "stickSwing",
        {
            path: [start, center.add(new BABYLON.Vector3(0, 0.25, 0)), end],
            radius: hit ? 0.055 : 0.035,
            tessellation: 6,
        },
        scene,
    );
    const material = new BABYLON.StandardMaterial("stickSwingMaterial", scene);
    material.emissiveColor = hit
        ? new BABYLON.Color3(1, 0.72, 0.18)
        : new BABYLON.Color3(0.72, 0.52, 0.25);
    material.diffuseColor = material.emissiveColor;
    swing.material = material;

    window.setTimeout(() => {
        swing.dispose();
        material.dispose();
    }, 120);
}

function showCombatMessage(onPromptChange, state, message) {
    state.messageTime = 0.9;
    onPromptChange(message, { holdMs: 900 });
}

function createInputState(canvas) {
    let shootRequest = null;
    const mobileShootButton = document.querySelector("#mobile-shoot");

    function requestMobileShoot(event) {
        event.stopPropagation();
        event.preventDefault();
        shootRequest = {};
    }

    function requestShoot(event) {
        if (event.type === "keydown" && event.code !== "Space") {
            return;
        }

        if (event.type === "pointerdown" && event.button !== 0) {
            return;
        }

        if (event.currentTarget === canvas && event.pointerType === "touch") {
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

    mobileShootButton?.addEventListener("pointerdown", requestMobileShoot);
    mobileShootButton?.addEventListener("touchstart", requestMobileShoot, { passive: false });
    mobileShootButton?.addEventListener("click", requestMobileShoot);

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

            mobileShootButton?.removeEventListener("pointerdown", requestMobileShoot);
            mobileShootButton?.removeEventListener("touchstart", requestMobileShoot);
            mobileShootButton?.removeEventListener("click", requestMobileShoot);
        },
    };
}
