const NPC_HEIGHT = 2;
const NPC_HALF_HEIGHT = NPC_HEIGHT / 2;
const NPC_MAX_HEALTH = 100;
const NPC_COLLISION_RADIUS = 0.48;
const WALK_CYCLE_SPEED = 5.5;
const KNOCKBACK_DRAG = 4.2;
const DEFEATED_DRAG = 1.8;

export function createNpcSystem({ scene, collisionWorld }) {
    const npcs = [
        createNpc(scene, {
            name: "npcWarehouseWorker",
            position: [-8, NPC_HALF_HEIGHT, -7],
            rotation: 35,
            shirt: [0.68, 0.22, 0.12],
            wanderRadius: 4.5,
            wanderSpeed: 1.7,
        }),
        createNpc(scene, {
            name: "npcDowntownPedestrian",
            position: [9, NPC_HALF_HEIGHT, -5],
            rotation: -80,
            shirt: [0.18, 0.48, 0.33],
            wanderRadius: 3.2,
            wanderSpeed: 1.25,
        }),
        createNpc(scene, {
            name: "npcRoadsidePedestrian",
            position: [-14, NPC_HALF_HEIGHT, 11],
            rotation: 130,
            shirt: [0.64, 0.5, 0.16],
            wanderRadius: 5.2,
            wanderSpeed: 1.45,
        }),
    ];

    const observer = scene.onBeforeRenderObservable.add(() => {
        const deltaSeconds = scene.getEngine().getDeltaTime() / 1000;

        for (const npc of npcs) {
            updateNpc(npc, collisionWorld, deltaSeconds);
        }
    });

    return {
        npcs,
        findTarget({ origin, direction, range, minDot }) {
            return findNpcTarget({ npcs, origin, direction, range, minDot });
        },
        damageNpc(npc, damage) {
            return damageNpc(npc, damage);
        },
        applyImpulseToNpc(npc, impulse) {
            applyImpulseToNpc(npc, impulse);
        },
        dispose() {
            scene.onBeforeRenderObservable.remove(observer);

            for (const npc of npcs) {
                npc.proxy.dispose(false, true);
            }
        },
    };
}

function createNpc(scene, spec) {
    const proxy = BABYLON.MeshBuilder.CreateBox(
        spec.name,
        {
            width: 0.95,
            height: NPC_HEIGHT,
            depth: 0.75,
        },
        scene,
    );
    proxy.visibility = 0;
    proxy.position.set(spec.position[0], spec.position[1], spec.position[2]);
    proxy.rotation.y = BABYLON.Tools.ToRadians(spec.rotation);

    const model = createBlockHumanoid(scene, proxy, spec);
    const healthBar = createHealthBar(scene, proxy, spec.name);

    return {
        proxy,
        model,
        healthBar,
        origin: proxy.position.clone(),
        health: NPC_MAX_HEALTH,
        maxHealth: NPC_MAX_HEALTH,
        defeated: false,
        velocity: new BABYLON.Vector3(),
        wanderRadius: spec.wanderRadius,
        wanderSpeed: spec.wanderSpeed,
        walkTime: Math.random() * Math.PI * 2,
        pathTime: Math.random() * Math.PI * 2,
    };
}

function createHealthBar(scene, parent, name) {
    const root = new BABYLON.TransformNode(`${name}HealthBar`, scene);
    root.parent = parent;
    root.position.set(0, 1.75, 0);

    const backMaterial = makeMaterial(scene, `${name}HealthBack`, 0.08, 0.08, 0.08);
    const fillMaterial = makeMaterial(scene, `${name}HealthFill`, 0.2, 0.85, 0.18);

    const back = addBodyBox(scene, root, `${name}HealthBack`, { width: 1.08, height: 0.1, depth: 0.08 }, [0, 0, 0], backMaterial);
    const fill = addBodyBox(scene, root, `${name}HealthFill`, { width: 1, height: 0.12, depth: 0.1 }, [0, 0.01, -0.01], fillMaterial);

    return {
        root,
        back,
        fill,
        fillMaterial,
    };
}

function createBlockHumanoid(scene, parent, spec) {
    const skin = makeMaterial(scene, `${spec.name}Skin`, 0.76, 0.56, 0.4);
    const shirt = makeMaterial(scene, `${spec.name}Shirt`, spec.shirt[0], spec.shirt[1], spec.shirt[2]);
    const pants = makeMaterial(scene, `${spec.name}Pants`, 0.1, 0.12, 0.15);
    const shoes = makeMaterial(scene, `${spec.name}Shoes`, 0.035, 0.035, 0.04);
    const hair = makeMaterial(scene, `${spec.name}Hair`, 0.07, 0.045, 0.025);

    const root = new BABYLON.TransformNode(`${spec.name}Humanoid`, scene);
    root.parent = parent;
    root.position.y = -NPC_HALF_HEIGHT;

    const torso = addBodyBox(scene, root, `${spec.name}Torso`, { width: 0.82, height: 0.85, depth: 0.42 }, [0, 1.1, 0], shirt);
    addBodyBox(scene, root, `${spec.name}Neck`, { width: 0.28, height: 0.16, depth: 0.24 }, [0, 1.6, 0], skin);
    addBodyBox(scene, root, `${spec.name}Head`, { width: 0.56, height: 0.56, depth: 0.5 }, [0, 1.95, 0], skin);
    addBodyBox(scene, root, `${spec.name}Hair`, { width: 0.6, height: 0.16, depth: 0.54 }, [0, 2.27, -0.02], hair);

    const leftArm = createArm(scene, root, `${spec.name}LeftArm`, [-0.62, 1.16, 0], shirt, skin);
    const rightArm = createArm(scene, root, `${spec.name}RightArm`, [0.62, 1.16, 0], shirt, skin);
    const leftLeg = createLeg(scene, root, `${spec.name}LeftLeg`, [-0.22, 0.38, 0], pants, shoes);
    const rightLeg = createLeg(scene, root, `${spec.name}RightLeg`, [0.22, 0.38, 0], pants, shoes);

    return {
        root,
        torso,
        leftArm,
        rightArm,
        leftLeg,
        rightLeg,
    };
}

function createArm(scene, parent, name, position, sleeveMaterial, handMaterial) {
    const armRoot = new BABYLON.TransformNode(name, scene);
    armRoot.parent = parent;
    armRoot.position.set(position[0], position[1], position[2]);

    addBodyBox(scene, armRoot, `${name}Sleeve`, { width: 0.26, height: 0.58, depth: 0.28 }, [0, -0.18, 0], sleeveMaterial);
    addBodyBox(scene, armRoot, `${name}Hand`, { width: 0.25, height: 0.24, depth: 0.26 }, [0, -0.6, 0], handMaterial);

    return armRoot;
}

function createLeg(scene, parent, name, position, pantsMaterial, shoeMaterial) {
    const legRoot = new BABYLON.TransformNode(name, scene);
    legRoot.parent = parent;
    legRoot.position.set(position[0], position[1], position[2]);

    addBodyBox(scene, legRoot, `${name}Pants`, { width: 0.31, height: 0.68, depth: 0.34 }, [0, -0.08, 0], pantsMaterial);
    addBodyBox(scene, legRoot, `${name}Shoe`, { width: 0.34, height: 0.18, depth: 0.48 }, [0, -0.5, 0.06], shoeMaterial);

    return legRoot;
}

function updateNpc(npc, collisionWorld, deltaSeconds) {
    if (npc.defeated) {
        integrateNpcVelocity(npc, collisionWorld, deltaSeconds, DEFEATED_DRAG);
        npc.model.root.rotation.z = approach(npc.model.root.rotation.z, BABYLON.Tools.ToRadians(82), deltaSeconds * 4);
        npc.healthBar.root.setEnabled(false);
        return;
    }

    if (npc.velocity.lengthSquared() > 0.01) {
        integrateNpcVelocity(npc, collisionWorld, deltaSeconds, KNOCKBACK_DRAG);
        npc.walkTime += deltaSeconds * WALK_CYCLE_SPEED;
        animateHumanoid(npc.model, npc.walkTime, 0.15);
        updateHealthBar(npc);
        return;
    }

    npc.pathTime += deltaSeconds * npc.wanderSpeed;

    const nextX = npc.origin.x + Math.sin(npc.pathTime * 0.65) * npc.wanderRadius;
    const nextZ = npc.origin.z + Math.cos(npc.pathTime * 0.43) * npc.wanderRadius * 0.55;
    const deltaX = nextX - npc.proxy.position.x;
    const deltaZ = nextZ - npc.proxy.position.z;
    const speed = Math.hypot(deltaX, deltaZ);

    const previousPosition = npc.proxy.position.clone();
    npc.proxy.position.x = nextX;
    npc.proxy.position.z = nextZ;
    const resolvedPosition = collisionWorld.resolveCircleMovement(npc.proxy.position, previousPosition, NPC_COLLISION_RADIUS);
    const collided = resolvedPosition.x !== npc.proxy.position.x || resolvedPosition.z !== npc.proxy.position.z;
    npc.proxy.position.x = resolvedPosition.x;
    npc.proxy.position.z = resolvedPosition.z;
    npc.proxy.position.y = NPC_HALF_HEIGHT;

    if (collided) {
        npc.pathTime += 1.2;
    }

    if (speed > 0.0001) {
        npc.proxy.rotation.y = Math.atan2(deltaX, deltaZ);
    }

    npc.walkTime += deltaSeconds * WALK_CYCLE_SPEED;
    animateHumanoid(npc.model, npc.walkTime, Math.min(speed * 12, 1));
    updateHealthBar(npc);
}

function integrateNpcVelocity(npc, collisionWorld, deltaSeconds, drag) {
    const previousPosition = npc.proxy.position.clone();
    npc.proxy.position.x += npc.velocity.x * deltaSeconds;
    npc.proxy.position.z += npc.velocity.z * deltaSeconds;

    const resolvedPosition = collisionWorld.resolveCircleMovement(npc.proxy.position, previousPosition, NPC_COLLISION_RADIUS);
    const collided = resolvedPosition.x !== npc.proxy.position.x || resolvedPosition.z !== npc.proxy.position.z;
    npc.proxy.position.x = resolvedPosition.x;
    npc.proxy.position.z = resolvedPosition.z;
    npc.proxy.position.y = NPC_HALF_HEIGHT;

    if (collided) {
        npc.velocity.scaleInPlace(0.18);
    }

    if (npc.velocity.lengthSquared() > 0.001) {
        npc.proxy.rotation.y = Math.atan2(npc.velocity.x, npc.velocity.z);
    }

    const dragFactor = Math.exp(-drag * deltaSeconds);
    npc.velocity.scaleInPlace(dragFactor);
    npc.origin.x += (npc.proxy.position.x - npc.origin.x) * 0.04;
    npc.origin.z += (npc.proxy.position.z - npc.origin.z) * 0.04;
}

function findNpcTarget({ npcs, origin, direction, range, minDot }) {
    let bestHit = null;

    for (const npc of npcs) {
        if (npc.defeated) {
            continue;
        }

        const target = npc.proxy.position.add(new BABYLON.Vector3(0, 0.85, 0));
        const toTarget = target.subtract(origin);
        const distance = toTarget.length();

        if (distance > range || distance < 0.001) {
            continue;
        }

        toTarget.normalize();
        const aimDot = BABYLON.Vector3.Dot(direction, toTarget);

        if (aimDot < minDot) {
            continue;
        }

        if (!bestHit || distance < bestHit.distance) {
            bestHit = {
                npc,
                distance,
                aimDot,
            };
        }
    }

    return bestHit;
}

function damageNpc(npc, damage) {
    if (npc.defeated) {
        return {
            health: 0,
            defeated: true,
        };
    }

    npc.health = Math.max(0, npc.health - damage);
    npc.defeated = npc.health <= 0;
    updateHealthBar(npc);

    if (npc.defeated) {
        npc.healthBar.root.setEnabled(false);
    }

    return {
        health: npc.health,
        defeated: npc.defeated,
    };
}

function applyImpulseToNpc(npc, impulse) {
    npc.velocity.x += impulse.x;
    npc.velocity.z += impulse.z;
    npc.pathTime += 1.5;

    if (impulse.lengthSquared() > 0.0001) {
        npc.proxy.rotation.y = Math.atan2(impulse.x, impulse.z);
    }
}

function updateHealthBar(npc) {
    const healthRatio = npc.health / npc.maxHealth;
    npc.healthBar.fill.scaling.x = Math.max(0.001, healthRatio);
    npc.healthBar.fill.position.x = -0.5 * (1 - healthRatio);
    npc.healthBar.fillMaterial.diffuseColor = healthRatio > 0.45
        ? new BABYLON.Color3(0.2, 0.85, 0.18)
        : new BABYLON.Color3(0.9, 0.18, 0.1);
}

function animateHumanoid(model, walkTime, moveAmount) {
    const stride = Math.sin(walkTime) * moveAmount;
    const counterStride = Math.sin(walkTime + Math.PI) * moveAmount;
    const bob = Math.abs(Math.sin(walkTime)) * 0.035 * moveAmount;

    model.root.position.y = -NPC_HALF_HEIGHT + bob;
    model.torso.rotation.x = -0.06 * moveAmount;
    model.leftArm.rotation.x = counterStride * 0.48;
    model.rightArm.rotation.x = stride * 0.48;
    model.leftLeg.rotation.x = stride * 0.36;
    model.rightLeg.rotation.x = counterStride * 0.36;
}

function approach(value, target, amount) {
    if (value < target) {
        return Math.min(value + amount, target);
    }

    return Math.max(value - amount, target);
}

function addBodyBox(scene, parent, name, size, position, material) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
    mesh.parent = parent;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.material = material;
    return mesh;
}

function makeMaterial(scene, name, r, g, b) {
    const material = new BABYLON.StandardMaterial(name, scene);
    material.diffuseColor = new BABYLON.Color3(r, g, b);
    material.specularColor = new BABYLON.Color3(0.025, 0.025, 0.025);
    return material;
}
