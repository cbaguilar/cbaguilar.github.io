const NPC_HEIGHT = 2;
const NPC_HALF_HEIGHT = NPC_HEIGHT / 2;
const NPC_MAX_HEALTH = 100;
const NPC_COLLISION_RADIUS = 0.48;
const WALK_CYCLE_SPEED = 5.5;
const KNOCKBACK_DRAG = 4.2;
const DEFEATED_DRAG = 1.8;
const MOUNT_ENTER_DISTANCE = 4.8;

export function createNpcSystem({ scene, collisionWorld }) {
    const rideInput = createRideInputState();
    let activeMount = null;
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
        createNpc(scene, {
            name: "npcMountedOfficer",
            position: [18, NPC_HALF_HEIGHT, 16],
            rotation: -145,
            shirt: [0.07, 0.16, 0.32],
            wanderRadius: 6.4,
            wanderSpeed: 0.92,
            collisionRadius: 1.35,
            healthBarY: 3.15,
            targetYOffset: 1.85,
            mountable: true,
            mountLabel: "Horse",
            modelFactory: createMountedOfficer,
        }),
    ];

    const observer = scene.onBeforeRenderObservable.add(() => {
        const deltaSeconds = scene.getEngine().getDeltaTime() / 1000;

        for (const npc of npcs) {
            updateNpc(npc, collisionWorld, rideInput, deltaSeconds);
        }
    });

    return {
        npcs,
        get activeMount() {
            return activeMount;
        },
        findAvailableMount(playerMesh) {
            return findAvailableMount(npcs, playerMesh);
        },
        enterMount(npc) {
            if (!npc?.mountable || !npc.defeated || npc.ridden) {
                return false;
            }

            activeMount = npc;
            npc.ridden = true;
            npc.velocity.copyFromFloats(0, 0, 0);
            npc.ride.speed = 0;
            npc.ride.steeringAngle = 0;
            npc.model.riderRoot?.setEnabled(false);
            npc.model.playerRiderRoot?.setEnabled(true);
            return true;
        },
        exitMount(playerMesh) {
            if (!activeMount) {
                return;
            }

            const mount = activeMount;
            mount.ridden = false;
            mount.ride.speed = 0;
            mount.ride.steeringAngle = 0;
            mount.model.playerRiderRoot?.setEnabled(false);
            const exitOffset = getForward(mount.proxy).scale(-2.2).add(getRight(mount.proxy).scale(1.8));
            playerMesh.position.set(
                clamp(mount.proxy.position.x + exitOffset.x, -86, 86),
                1,
                clamp(mount.proxy.position.z + exitOffset.z, -86, 86),
            );
            playerMesh.rotation.y = mount.proxy.rotation.y;
            activeMount = null;
        },
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
            rideInput.dispose();

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

    const model = (spec.modelFactory ?? createBlockHumanoid)(scene, proxy, spec);
    const healthBar = createHealthBar(scene, proxy, spec.name, spec.healthBarY ?? 1.75);

    return {
        proxy,
        model,
        healthBar,
        origin: proxy.position.clone(),
        health: NPC_MAX_HEALTH,
        maxHealth: NPC_MAX_HEALTH,
        defeated: false,
        collisionRadius: spec.collisionRadius ?? NPC_COLLISION_RADIUS,
        targetYOffset: spec.targetYOffset ?? 0.85,
        mountable: Boolean(spec.mountable),
        mountLabel: spec.mountLabel ?? "Mount",
        ridden: false,
        ride: {
            speed: 0,
            steeringAngle: 0,
            walkTime: 0,
        },
        velocity: new BABYLON.Vector3(),
        wanderRadius: spec.wanderRadius,
        wanderSpeed: spec.wanderSpeed,
        walkTime: Math.random() * Math.PI * 2,
        pathTime: Math.random() * Math.PI * 2,
    };
}

function createHealthBar(scene, parent, name, height) {
    const root = new BABYLON.TransformNode(`${name}HealthBar`, scene);
    root.parent = parent;
    root.position.set(0, height, 0);

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

function createMountedOfficer(scene, parent, spec) {
    const horseBody = makeMaterial(scene, `${spec.name}HorseBody`, 0.28, 0.16, 0.08);
    const horseMane = makeMaterial(scene, `${spec.name}HorseMane`, 0.045, 0.03, 0.02);
    const tack = makeMaterial(scene, `${spec.name}Tack`, 0.04, 0.035, 0.03);
    const metal = makeMaterial(scene, `${spec.name}Metal`, 0.72, 0.68, 0.52);
    const skin = makeMaterial(scene, `${spec.name}Skin`, 0.76, 0.56, 0.4);
    const shirt = makeMaterial(scene, `${spec.name}Shirt`, spec.shirt[0], spec.shirt[1], spec.shirt[2]);
    const pants = makeMaterial(scene, `${spec.name}Pants`, 0.08, 0.09, 0.12);
    const hat = makeMaterial(scene, `${spec.name}Hat`, 0.58, 0.39, 0.18);
    const black = makeMaterial(scene, `${spec.name}Black`, 0.025, 0.022, 0.018);

    const root = new BABYLON.TransformNode(`${spec.name}MountedRoot`, scene);
    root.parent = parent;
    root.position.y = -NPC_HALF_HEIGHT;

    const horseRoot = new BABYLON.TransformNode(`${spec.name}Horse`, scene);
    horseRoot.parent = root;

    addBodyBox(scene, horseRoot, `${spec.name}HorseTorso`, { width: 0.95, height: 0.82, depth: 2.15 }, [0, 0.92, 0], horseBody);
    addBodyBox(scene, horseRoot, `${spec.name}HorseChest`, { width: 0.86, height: 0.95, depth: 0.55 }, [0, 1.02, 0.98], horseBody);

    const neck = addBodyBox(scene, horseRoot, `${spec.name}HorseNeck`, { width: 0.46, height: 0.95, depth: 0.36 }, [0, 1.55, 1.12], horseBody);
    neck.rotation.x = BABYLON.Tools.ToRadians(-24);
    const head = addBodyBox(scene, horseRoot, `${spec.name}HorseHead`, { width: 0.52, height: 0.48, depth: 0.68 }, [0, 1.95, 1.55], horseBody);
    head.rotation.x = BABYLON.Tools.ToRadians(-8);
    addBodyBox(scene, horseRoot, `${spec.name}HorseMuzzle`, { width: 0.44, height: 0.28, depth: 0.34 }, [0, 1.82, 1.98], horseMane);
    addBodyBox(scene, horseRoot, `${spec.name}HorseMane`, { width: 0.12, height: 0.9, depth: 0.2 }, [0, 1.57, 0.88], horseMane);
    addBodyBox(scene, horseRoot, `${spec.name}HorseTail`, { width: 0.22, height: 0.22, depth: 0.86 }, [0, 1.06, -1.36], horseMane).rotation.x = BABYLON.Tools.ToRadians(-18);

    for (const [index, x] of [-0.38, 0.38].entries()) {
        for (const z of [-0.68, 0.72]) {
            const leg = addBodyBox(scene, horseRoot, `${spec.name}HorseLeg${index}${z}`, { width: 0.22, height: 0.88, depth: 0.24 }, [x, 0.3, z], horseBody);
            leg.rotation.x = BABYLON.Tools.ToRadians(z > 0 ? -4 : 5);
            addBodyBox(scene, horseRoot, `${spec.name}HorseHoof${index}${z}`, { width: 0.3, height: 0.14, depth: 0.34 }, [x, -0.2, z + 0.03], black);
        }
    }

    addBodyBox(scene, horseRoot, `${spec.name}Saddle`, { width: 1.02, height: 0.18, depth: 0.82 }, [0, 1.38, -0.02], tack);
    addBodyBox(scene, horseRoot, `${spec.name}SaddleBlanket`, { width: 1.08, height: 0.08, depth: 1.05 }, [0, 1.28, -0.02], shirt);

    const riderRoot = new BABYLON.TransformNode(`${spec.name}Officer`, scene);
    riderRoot.parent = root;
    riderRoot.position.set(0, 1.22, -0.06);

    const torso = addBodyBox(scene, riderRoot, `${spec.name}OfficerTorso`, { width: 0.68, height: 0.78, depth: 0.36 }, [0, 0.75, 0], shirt);
    addBodyBox(scene, riderRoot, `${spec.name}OfficerNeck`, { width: 0.22, height: 0.12, depth: 0.18 }, [0, 1.2, 0], skin);
    addBodyBox(scene, riderRoot, `${spec.name}OfficerHead`, { width: 0.46, height: 0.46, depth: 0.4 }, [0, 1.48, 0], skin);
    addBodyBox(scene, riderRoot, `${spec.name}Badge`, { width: 0.12, height: 0.12, depth: 0.03 }, [0.2, 0.84, 0.2], metal);

    const hatBrim = BABYLON.MeshBuilder.CreateCylinder(`${spec.name}CowboyHatBrim`, { diameter: 0.72, height: 0.06, tessellation: 20 }, scene);
    hatBrim.parent = riderRoot;
    hatBrim.position.set(0, 1.75, 0);
    hatBrim.scaling.z = 0.72;
    hatBrim.material = hat;

    const hatCrown = BABYLON.MeshBuilder.CreateCylinder(`${spec.name}CowboyHatCrown`, { diameterTop: 0.34, diameterBottom: 0.42, height: 0.28, tessellation: 16 }, scene);
    hatCrown.parent = riderRoot;
    hatCrown.position.set(0, 1.91, 0);
    hatCrown.material = hat;

    const leftArm = createArm(scene, riderRoot, `${spec.name}OfficerLeftArm`, [-0.49, 0.78, 0.06], shirt, skin);
    const rightArm = createArm(scene, riderRoot, `${spec.name}OfficerRightArm`, [0.49, 0.78, 0.06], shirt, skin);
    const leftLeg = createLeg(scene, riderRoot, `${spec.name}OfficerLeftLeg`, [-0.24, 0.32, 0.12], pants, black);
    const rightLeg = createLeg(scene, riderRoot, `${spec.name}OfficerRightLeg`, [0.24, 0.32, 0.12], pants, black);
    leftLeg.rotation.x = BABYLON.Tools.ToRadians(42);
    rightLeg.rotation.x = BABYLON.Tools.ToRadians(42);

    addBodyBox(scene, riderRoot, `${spec.name}LeftRein`, { width: 0.04, height: 0.04, depth: 1.26 }, [-0.16, 0.76, 0.72], tack).rotation.x = BABYLON.Tools.ToRadians(18);
    addBodyBox(scene, riderRoot, `${spec.name}RightRein`, { width: 0.04, height: 0.04, depth: 1.26 }, [0.16, 0.76, 0.72], tack).rotation.x = BABYLON.Tools.ToRadians(18);

    const playerRiderRoot = createMountedPlayerRider(scene, root, spec);
    playerRiderRoot.setEnabled(false);

    return {
        root,
        torso,
        leftArm,
        rightArm,
        leftLeg,
        rightLeg,
        horseRoot,
        riderRoot,
        playerRiderRoot,
    };
}

function createMountedPlayerRider(scene, parent, spec) {
    const skin = makeMaterial(scene, `${spec.name}PlayerRiderSkin`, 0.78, 0.58, 0.42);
    const shirt = makeMaterial(scene, `${spec.name}PlayerRiderShirt`, 0.13, 0.3, 0.72);
    const pants = makeMaterial(scene, `${spec.name}PlayerRiderPants`, 0.12, 0.13, 0.16);
    const shoes = makeMaterial(scene, `${spec.name}PlayerRiderShoes`, 0.035, 0.035, 0.04);
    const hair = makeMaterial(scene, `${spec.name}PlayerRiderHair`, 0.08, 0.045, 0.025);

    const riderRoot = new BABYLON.TransformNode(`${spec.name}PlayerRider`, scene);
    riderRoot.parent = parent;
    riderRoot.position.set(0, 1.36, 0);
    riderRoot.scaling.setAll(0.92);

    addBodyBox(scene, riderRoot, `${spec.name}PlayerRiderTorso`, { width: 0.68, height: 0.78, depth: 0.36 }, [0, 0.75, 0], shirt);
    addBodyBox(scene, riderRoot, `${spec.name}PlayerRiderHead`, { width: 0.46, height: 0.46, depth: 0.4 }, [0, 1.48, 0], skin);
    addBodyBox(scene, riderRoot, `${spec.name}PlayerRiderHair`, { width: 0.5, height: 0.12, depth: 0.42 }, [0, 1.75, -0.02], hair);
    createArm(scene, riderRoot, `${spec.name}PlayerRiderLeftArm`, [-0.49, 0.78, 0.06], shirt, skin);
    createArm(scene, riderRoot, `${spec.name}PlayerRiderRightArm`, [0.49, 0.78, 0.06], shirt, skin);

    const leftLeg = createLeg(scene, riderRoot, `${spec.name}PlayerRiderLeftLeg`, [-0.34, 0.28, 0.1], pants, shoes);
    const rightLeg = createLeg(scene, riderRoot, `${spec.name}PlayerRiderRightLeg`, [0.34, 0.28, 0.1], pants, shoes);
    leftLeg.rotation.x = BABYLON.Tools.ToRadians(50);
    leftLeg.rotation.z = BABYLON.Tools.ToRadians(-12);
    rightLeg.rotation.x = BABYLON.Tools.ToRadians(50);
    rightLeg.rotation.z = BABYLON.Tools.ToRadians(12);

    return riderRoot;
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

function updateNpc(npc, collisionWorld, rideInput, deltaSeconds) {
    if (npc.ridden) {
        updateMountedHorse(npc, collisionWorld, rideInput, deltaSeconds);
        return;
    }

    if (npc.defeated) {
        integrateNpcVelocity(npc, collisionWorld, deltaSeconds, DEFEATED_DRAG);
        if (npc.mountable) {
            npc.model.riderRoot?.setEnabled(false);
            npc.model.playerRiderRoot?.setEnabled(false);
            npc.model.root.rotation.z = approach(npc.model.root.rotation.z, 0, deltaSeconds * 5);
            npc.proxy.position.y = NPC_HALF_HEIGHT;
        } else {
            npc.model.root.rotation.z = approach(npc.model.root.rotation.z, BABYLON.Tools.ToRadians(82), deltaSeconds * 4);
        }
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
    const resolvedPosition = collisionWorld.resolveCircleMovement(npc.proxy.position, previousPosition, npc.collisionRadius);
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

    const resolvedPosition = collisionWorld.resolveCircleMovement(npc.proxy.position, previousPosition, npc.collisionRadius);
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

function updateMountedHorse(npc, collisionWorld, rideInput, deltaSeconds) {
    const acceleration = 11;
    const rollingDrag = 3.2;
    const brakeDrag = 12;
    const maxForward = 16;
    const maxReverse = -4.5;
    const maxSteeringAngle = BABYLON.Tools.ToRadians(42);
    const turnWheelBase = 3.2;

    const throttle = rideInput.throttle;
    const steering = rideInput.steering;
    npc.ride.steeringAngle = approach(npc.ride.steeringAngle, steering * maxSteeringAngle, BABYLON.Tools.ToRadians(130) * deltaSeconds);
    npc.ride.speed += throttle * acceleration * deltaSeconds;

    if (throttle === 0) {
        npc.ride.speed = approach(npc.ride.speed, 0, rollingDrag * deltaSeconds);
    }

    if (Math.sign(throttle) !== Math.sign(npc.ride.speed) && throttle !== 0) {
        npc.ride.speed = approach(npc.ride.speed, 0, brakeDrag * deltaSeconds);
    }

    npc.ride.speed = clamp(npc.ride.speed, maxReverse, maxForward);

    if (Math.abs(npc.ride.speed) > 0.02 && Math.abs(npc.ride.steeringAngle) > 0.001) {
        const yawRate = (npc.ride.speed / turnWheelBase) * Math.tan(npc.ride.steeringAngle);
        npc.proxy.rotation.y += yawRate * deltaSeconds;
    }

    const forward = getForward(npc.proxy);
    const previousPosition = npc.proxy.position.clone();
    npc.proxy.position.x = clamp(npc.proxy.position.x + forward.x * npc.ride.speed * deltaSeconds, -86, 86);
    npc.proxy.position.z = clamp(npc.proxy.position.z + forward.z * npc.ride.speed * deltaSeconds, -86, 86);
    const resolvedPosition = collisionWorld.resolveCircleMovement(npc.proxy.position, previousPosition, npc.collisionRadius);
    const collided = resolvedPosition.x !== npc.proxy.position.x || resolvedPosition.z !== npc.proxy.position.z;
    npc.proxy.position.x = resolvedPosition.x;
    npc.proxy.position.z = resolvedPosition.z;
    npc.proxy.position.y = NPC_HALF_HEIGHT;

    if (collided) {
        npc.ride.speed *= -0.18;
    }

    npc.origin.x = npc.proxy.position.x;
    npc.origin.z = npc.proxy.position.z;
    npc.ride.walkTime += Math.abs(npc.ride.speed) * deltaSeconds * 3.8;
    animateHorseRide(npc.model, npc.ride.walkTime, Math.min(Math.abs(npc.ride.speed) / maxForward, 1), npc.ride.steeringAngle);
}

function animateHorseRide(model, walkTime, moveAmount, steeringAngle) {
    if (!model.horseRoot) {
        return;
    }

    model.root.rotation.z = 0;
    model.horseRoot.rotation.y = steeringAngle * 0.12;
    model.horseRoot.position.y = Math.abs(Math.sin(walkTime)) * 0.045 * moveAmount;

    if (model.playerRiderRoot) {
        model.playerRiderRoot.rotation.z = -steeringAngle * 0.18;
        model.playerRiderRoot.position.y = 1.36 + Math.abs(Math.sin(walkTime)) * 0.035 * moveAmount;
    }
}

function findAvailableMount(npcs, playerMesh) {
    let nearestMount = null;

    for (const npc of npcs) {
        if (!npc.mountable || !npc.defeated || npc.ridden) {
            continue;
        }

        const distance = BABYLON.Vector3.Distance(playerMesh.position, npc.proxy.position);

        if (distance > MOUNT_ENTER_DISTANCE) {
            continue;
        }

        if (!nearestMount || distance < nearestMount.distance) {
            nearestMount = { npc, distance };
        }
    }

    return nearestMount?.npc ?? null;
}

function createRideInputState() {
    const pressed = new Set();
    const joystick = {
        active: false,
        pointerId: null,
        centerX: 0,
        centerY: 0,
        throttle: 0,
        steering: 0,
    };
    const joystickBase = document.querySelector("#move-joystick");
    const joystickRadius = 52;

    function onKeyDown(event) {
        pressed.add(event.code);
    }

    function onKeyUp(event) {
        pressed.delete(event.code);
    }

    function updateJoystick(event) {
        const rawX = event.clientX - joystick.centerX;
        const rawY = event.clientY - joystick.centerY;
        const distance = Math.hypot(rawX, rawY);
        const scale = distance > joystickRadius ? joystickRadius / distance : 1;

        joystick.steering = clamp((rawX * scale) / joystickRadius, -1, 1);
        joystick.throttle = clamp((-rawY * scale) / joystickRadius, -1, 1);
    }

    function resetJoystick() {
        joystick.active = false;
        joystick.pointerId = null;
        joystick.throttle = 0;
        joystick.steering = 0;
    }

    function onJoystickDown(event) {
        const bounds = joystickBase.getBoundingClientRect();
        joystick.active = true;
        joystick.pointerId = event.pointerId;
        joystick.centerX = bounds.left + bounds.width / 2;
        joystick.centerY = bounds.top + bounds.height / 2;
        updateJoystick(event);
    }

    function onJoystickMove(event) {
        if (!joystick.active || event.pointerId !== joystick.pointerId) {
            return;
        }

        updateJoystick(event);
    }

    function onJoystickEnd(event) {
        if (event.pointerId !== joystick.pointerId) {
            return;
        }

        resetJoystick();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    if (joystickBase) {
        joystickBase.addEventListener("pointerdown", onJoystickDown);
        joystickBase.addEventListener("pointermove", onJoystickMove);
        joystickBase.addEventListener("pointerup", onJoystickEnd);
        joystickBase.addEventListener("pointercancel", onJoystickEnd);
        joystickBase.addEventListener("lostpointercapture", resetJoystick);
    }

    return {
        get throttle() {
            const keyboardThrottle = Number(pressed.has("KeyW")) - Number(pressed.has("KeyS"));
            return clamp(keyboardThrottle + joystick.throttle, -1, 1);
        },
        get steering() {
            const keyboardSteering = Number(pressed.has("KeyD")) - Number(pressed.has("KeyA"));
            return clamp(keyboardSteering + joystick.steering, -1, 1);
        },
        dispose() {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);

            if (joystickBase) {
                joystickBase.removeEventListener("pointerdown", onJoystickDown);
                joystickBase.removeEventListener("pointermove", onJoystickMove);
                joystickBase.removeEventListener("pointerup", onJoystickEnd);
                joystickBase.removeEventListener("pointercancel", onJoystickEnd);
                joystickBase.removeEventListener("lostpointercapture", resetJoystick);
            }
        },
    };
}

function findNpcTarget({ npcs, origin, direction, range, minDot }) {
    let bestHit = null;

    for (const npc of npcs) {
        if (npc.defeated) {
            continue;
        }

        const target = npc.proxy.position.add(new BABYLON.Vector3(0, npc.targetYOffset, 0));
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

function getForward(mesh) {
    return new BABYLON.Vector3(Math.sin(mesh.rotation.y), 0, Math.cos(mesh.rotation.y));
}

function getRight(mesh) {
    return new BABYLON.Vector3(Math.cos(mesh.rotation.y), 0, -Math.sin(mesh.rotation.y));
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
