import { getMobileMoveInput } from "./mobileInput.js";

const WORLD_LIMIT = 86;
const ENTER_DISTANCE = 7;
const VEHICLE_COLLISION_RADIUS = 4.25;
const SURFACE_DAMAGE_MIN_SPEED = 9;
const SURFACE_DAMAGE_MAX_SPEED = 24;
const SURFACE_DAMAGE_COOLDOWN_SECONDS = 0.55;
const SMOKE_DAMAGE = 45;
const FIRE_DAMAGE = 74;
const DESTROYED_DAMAGE = 100;

export function createVehicleController({ scene, collisionWorld }) {
    const mesh = createVehicleMesh(scene);
    const input = createInputState();
    const movement = {
        speed: 0,
        steeringAngle: 0,
        wheelSpin: 0,
        active: false,
        damage: 0,
        damageCooldown: 0,
        destroyed: false,
        smokeEffect: null,
        fireEffect: null,
        exploded: false,
    };

    mesh.position.set(72, 0.8, 23);
    mesh.rotation.y = BABYLON.Tools.ToRadians(28);

    const observer = scene.onBeforeRenderObservable.add(() => {
        const deltaSeconds = scene.getEngine().getDeltaTime() / 1000;
        updateVehicle({ mesh, collisionWorld, input, movement, deltaSeconds });
    });

    return {
        mesh,
        get active() {
            return movement.active;
        },
        get speed() {
            return movement.speed;
        },
        get damage() {
            return movement.damage;
        },
        get destroyed() {
            return movement.destroyed;
        },
        get forward() {
            return getForward(mesh);
        },
        applyImpactSlowdown(multiplier) {
            movement.speed *= multiplier;
        },
        applyTestDamage(amount) {
            movement.damage = clamp(movement.damage + amount, 0, DESTROYED_DAMAGE);
            updateVehicleDamageVisuals(mesh, movement.damage);

            if (movement.damage >= DESTROYED_DAMAGE) {
                destroyVehicle(mesh, movement);
            } else {
                updateVehicleDamageEffects(mesh, movement);
            }
        },
        canEnter(playerMesh) {
            return !movement.destroyed && BABYLON.Vector3.Distance(playerMesh.position, mesh.position) <= ENTER_DISTANCE;
        },
        enter() {
            if (movement.destroyed) {
                return;
            }

            movement.active = true;
        },
        exit(playerMesh) {
            movement.active = false;
            movement.speed = 0;
            movement.steeringAngle = 0;
            const exitOffset = getForward(mesh).scale(-4.8).add(getRight(mesh).scale(3.2));
            playerMesh.position.set(
                clamp(mesh.position.x + exitOffset.x, -WORLD_LIMIT, WORLD_LIMIT),
                1,
                clamp(mesh.position.z + exitOffset.z, -WORLD_LIMIT, WORLD_LIMIT),
            );
            playerMesh.rotation.y = mesh.rotation.y;
        },
        dispose() {
            scene.onBeforeRenderObservable.remove(observer);
            movement.smokeEffect?.dispose();
            movement.fireEffect?.dispose();
            input.dispose();
            mesh.dispose(false, true);
        },
    };
}

function createVehicleMesh(scene) {
    const root = BABYLON.MeshBuilder.CreateBox(
        "vehicleProxy",
        {
            width: 4.8,
            height: 1.6,
            depth: 9.6,
        },
        scene,
    );
    root.visibility = 0;

    const whitePaint = makeMaterial(scene, "truckWhitePaint", 0.86, 0.84, 0.76);
    const darkTrim = makeMaterial(scene, "truckDarkTrim", 0.08, 0.085, 0.08);
    const glassMaterial = makeMaterial(scene, "truckGlass", 0.08, 0.18, 0.22);
    const tireMaterial = makeMaterial(scene, "vehicleTires", 0.02, 0.02, 0.018);
    const rimMaterial = makeMaterial(scene, "truckWheelRims", 0.7, 0.68, 0.6);
    const redStripe = makeMaterial(scene, "mixerRedStripe", 0.74, 0.05, 0.04);
    const blueStripe = makeMaterial(scene, "mixerBlueStripe", 0.02, 0.12, 0.38);
    const amberMaterial = makeMaterial(scene, "truckAmberLights", 1.0, 0.52, 0.08);
    const dentMaterial = makeMaterial(scene, "truckImpactScars", 0.08, 0.07, 0.055);

    const bodyParts = [
        addBox(scene, root, "truckChassis", { width: 4.1, height: 0.45, depth: 8.6 }, [0, -0.05, 0.25], darkTrim),
        addBox(scene, root, "truckCab", { width: 3.4, height: 1.9, depth: 2.6 }, [0, 1.0, 2.55], whitePaint),
        addBox(scene, root, "truckHood", { width: 3.4, height: 1.0, depth: 1.6 }, [0, 0.58, 4.65], whitePaint),
    ];
    addBox(scene, root, "truckGrille", { width: 2.2, height: 1.05, depth: 0.14 }, [0, 0.62, 5.49], darkTrim);

    const windshield = addBox(scene, root, "truckWindshield", { width: 2.7, height: 0.78, depth: 0.08 }, [0, 1.42, 3.91], glassMaterial);
    windshield.rotation.x = BABYLON.Tools.ToRadians(-8);

    const mixer = BABYLON.MeshBuilder.CreateCylinder(
        "mixerDrum",
        {
            diameterTop: 2.65,
            diameterBottom: 3.05,
            height: 4.2,
            tessellation: 28,
        },
        scene,
    );
    mixer.parent = root;
    mixer.position.set(0, 1.22, -1.1);
    mixer.rotation.x = BABYLON.Tools.ToRadians(90);
    mixer.rotation.z = BABYLON.Tools.ToRadians(-7);
    mixer.material = whitePaint;

    const redBand = createMixerBand(scene, root, "mixerRedBand", redStripe, -0.7);
    const blueBand = createMixerBand(scene, root, "mixerBlueBand", blueStripe, 0.15);
    redBand.rotation.z = BABYLON.Tools.ToRadians(-7);
    blueBand.rotation.z = BABYLON.Tools.ToRadians(-7);

    addBox(scene, root, "rearMixerFrame", { width: 3.8, height: 1.4, depth: 0.45 }, [0, 0.78, -3.55], darkTrim);

    const chute = addBox(scene, root, "pourChute", { width: 0.45, height: 0.24, depth: 2.2 }, [0, 0.15, -5.05], darkTrim);
    chute.rotation.x = BABYLON.Tools.ToRadians(-12);

    const fuelTank = BABYLON.MeshBuilder.CreateCylinder(
        "truckFuelTank",
        {
            diameter: 0.7,
            height: 1.65,
            tessellation: 16,
        },
        scene,
    );
    fuelTank.parent = root;
    fuelTank.position.set(-2.25, 0.15, 1.45);
    fuelTank.rotation.z = Math.PI / 2;
    fuelTank.material = rimMaterial;

    addBox(scene, root, "leftMirror", { width: 0.08, height: 0.42, depth: 0.56 }, [-1.92, 1.36, 3.65], darkTrim);
    addBox(scene, root, "rightMirror", { width: 0.08, height: 0.42, depth: 0.56 }, [1.92, 1.36, 3.65], darkTrim);
    addBox(scene, root, "frontBumper", { width: 3.7, height: 0.32, depth: 0.28 }, [0, 0.02, 5.56], rimMaterial);

    for (const x of [-0.9, 0, 0.9]) {
        const marker = BABYLON.MeshBuilder.CreateSphere("cabMarkerLight", { diameter: 0.18, segments: 8 }, scene);
        marker.parent = root;
        marker.position.set(x, 2.03, 3.55);
        marker.material = amberMaterial;
    }

    const wheelSpecs = [
        { position: [-2.05, -0.42, 3.75], steers: true },
        { position: [2.05, -0.42, 3.75], steers: true },
        { position: [-2.05, -0.42, -1.9], steers: false },
        { position: [2.05, -0.42, -1.9], steers: false },
        { position: [-2.05, -0.42, -3.05], steers: false },
        { position: [2.05, -0.42, -3.05], steers: false },
    ];

    const wheels = [];

    for (const spec of wheelSpecs) {
        const wheel = createWheel(scene, root, tireMaterial, rimMaterial);
        wheel.root.position.set(spec.position[0], spec.position[1], spec.position[2]);
        wheel.steers = spec.steers;
        wheels.push(wheel);
    }

    const damageMarks = createDamageMarks(scene, root, dentMaterial);

    root.metadata = {
        wheels,
        bodyParts,
        damageMarks,
        paintMaterial: whitePaint,
    };

    return root;
}

function createDamageMarks(scene, root, material) {
    const marks = [
        addBox(scene, root, "frontImpactScar", { width: 2.4, height: 0.52, depth: 0.035 }, [0, 0.72, 5.58], material),
        addBox(scene, root, "leftDoorScrape", { width: 0.035, height: 0.7, depth: 1.55 }, [-1.72, 1.0, 2.42], material),
        addBox(scene, root, "rightDoorScrape", { width: 0.035, height: 0.7, depth: 1.55 }, [1.72, 1.0, 2.42], material),
        addBox(scene, root, "hoodDent", { width: 1.55, height: 0.04, depth: 0.82 }, [0.28, 1.1, 4.58], material),
    ];

    for (const mark of marks) {
        mark.setEnabled(false);
    }

    return marks;
}

function addBox(scene, parent, name, size, position, material) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
    mesh.parent = parent;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.material = material;
    return mesh;
}

function createMixerBand(scene, parent, name, material, offset) {
    const band = BABYLON.MeshBuilder.CreateCylinder(
        name,
        {
            diameterTop: 2.72,
            diameterBottom: 3.12,
            height: 0.34,
            tessellation: 28,
        },
        scene,
    );
    band.parent = parent;
    band.position.set(0, 1.22, -1.1 + offset);
    band.rotation.x = BABYLON.Tools.ToRadians(90);
    band.material = material;
    return band;
}

function createWheel(scene, parent, tireMaterial, rimMaterial) {
    const wheelRoot = new BABYLON.TransformNode("truckWheelRoot", scene);
    wheelRoot.parent = parent;

    const tire = BABYLON.MeshBuilder.CreateCylinder(
        "truckTire",
        {
            diameter: 0.95,
            height: 0.55,
            tessellation: 18,
        },
        scene,
    );
    tire.parent = wheelRoot;
    tire.rotation.z = Math.PI / 2;
    tire.material = tireMaterial;

    const rim = BABYLON.MeshBuilder.CreateCylinder(
        "truckRim",
        {
            diameter: 0.48,
            height: 0.59,
            tessellation: 16,
        },
        scene,
    );
    rim.parent = wheelRoot;
    rim.rotation.z = Math.PI / 2;
    rim.material = rimMaterial;

    return {
        root: wheelRoot,
        tire,
        rim,
        steers: false,
    };
}

function createInputState() {
    const pressed = new Set();

    function onKeyDown(event) {
        pressed.add(event.code);
    }

    function onKeyUp(event) {
        pressed.delete(event.code);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return {
        get throttle() {
            const keyboardThrottle = Number(pressed.has("KeyW")) - Number(pressed.has("KeyS"));
            return clamp(keyboardThrottle + getMobileMoveInput().forward, -1, 1);
        },
        get steering() {
            const keyboardSteering = Number(pressed.has("KeyD")) - Number(pressed.has("KeyA"));
            return clamp(keyboardSteering + getMobileMoveInput().right, -1, 1);
        },
        dispose() {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        },
    };
}

function updateVehicle({ mesh, collisionWorld, input, movement, deltaSeconds }) {
    movement.damageCooldown = Math.max(0, movement.damageCooldown - deltaSeconds);

    if (!movement.active) {
        updateWheelVisuals(mesh, movement);
        updateVehicleDamageEffects(mesh, movement);
        return;
    }

    if (movement.destroyed) {
        movement.speed = 0;
        updateVehicleDamageEffects(mesh, movement);
        return;
    }

    const acceleration = 15;
    const brakeDrag = 18;
    const rollingDrag = 1.7;
    const maxForward = 24;
    const maxReverse = -8;
    const maxSteeringAngle = BABYLON.Tools.ToRadians(32);
    const steeringReturnRate = BABYLON.Tools.ToRadians(95);
    const steeringTurnRate = BABYLON.Tools.ToRadians(115);
    const wheelBase = 6.9;
    const wheelRadius = 0.48;

    const targetSteeringAngle = input.steering * maxSteeringAngle;
    const steeringRate = input.steering === 0 ? steeringReturnRate : steeringTurnRate;
    movement.steeringAngle = approach(movement.steeringAngle, targetSteeringAngle, steeringRate * deltaSeconds);

    movement.speed += input.throttle * acceleration * deltaSeconds;

    if (input.throttle === 0) {
        movement.speed = approach(movement.speed, 0, rollingDrag * deltaSeconds);
    }

    if (Math.sign(input.throttle) !== Math.sign(movement.speed) && input.throttle !== 0) {
        movement.speed = approach(movement.speed, 0, brakeDrag * deltaSeconds);
    }

    movement.speed = clamp(movement.speed, maxReverse, maxForward);
    const speedBeforeCollision = movement.speed;

    if (Math.abs(movement.speed) > 0.02 && Math.abs(movement.steeringAngle) > 0.001) {
        const yawRate = (movement.speed / wheelBase) * Math.tan(movement.steeringAngle);
        mesh.rotation.y += yawRate * deltaSeconds;
    }

    const forward = getForward(mesh);
    const previousPosition = mesh.position.clone();
    mesh.position.x = clamp(mesh.position.x + forward.x * movement.speed * deltaSeconds, -WORLD_LIMIT, WORLD_LIMIT);
    mesh.position.z = clamp(mesh.position.z + forward.z * movement.speed * deltaSeconds, -WORLD_LIMIT, WORLD_LIMIT);
    const resolvedPosition = collisionWorld.resolveCircleMovement(mesh.position, previousPosition, VEHICLE_COLLISION_RADIUS);
    const collided = resolvedPosition.x !== mesh.position.x || resolvedPosition.z !== mesh.position.z;
    mesh.position.x = resolvedPosition.x;
    mesh.position.z = resolvedPosition.z;
    mesh.position.y = 0.8;

    if (collided) {
        applySurfaceImpactDamage(mesh, movement, Math.abs(speedBeforeCollision));
        movement.speed *= -0.18;
    }

    movement.wheelSpin += (movement.speed / wheelRadius) * deltaSeconds;
    updateWheelVisuals(mesh, movement);
    updateVehicleDamageEffects(mesh, movement);
}

function applySurfaceImpactDamage(mesh, movement, speed) {
    if (movement.damageCooldown > 0 || speed < SURFACE_DAMAGE_MIN_SPEED || movement.destroyed) {
        return;
    }

    const severity = clamp((speed - SURFACE_DAMAGE_MIN_SPEED) / (SURFACE_DAMAGE_MAX_SPEED - SURFACE_DAMAGE_MIN_SPEED), 0, 1);
    movement.damage = clamp(movement.damage + 10 + severity * 24, 0, DESTROYED_DAMAGE);
    movement.damageCooldown = SURFACE_DAMAGE_COOLDOWN_SECONDS;
    updateVehicleDamageVisuals(mesh, movement.damage);

    if (movement.damage >= DESTROYED_DAMAGE) {
        destroyVehicle(mesh, movement);
    }
}

function updateVehicleDamageVisuals(mesh, damage) {
    const damageMarks = mesh.metadata?.damageMarks ?? [];
    const visibleMarks = Math.ceil((damage / DESTROYED_DAMAGE) * damageMarks.length);

    for (let i = 0; i < damageMarks.length; i += 1) {
        damageMarks[i].setEnabled(i < visibleMarks);
    }

    const paintMaterial = mesh.metadata?.paintMaterial;
    if (paintMaterial) {
        const grime = damage / DESTROYED_DAMAGE;
        paintMaterial.diffuseColor = new BABYLON.Color3(
            0.86 - grime * 0.34,
            0.84 - grime * 0.38,
            0.76 - grime * 0.42,
        );
    }
}

function updateVehicleDamageEffects(mesh, movement) {
    if (movement.damage >= SMOKE_DAMAGE && !movement.smokeEffect) {
        movement.smokeEffect = createSmokeEffect(mesh);
    }

    if (movement.damage >= FIRE_DAMAGE && !movement.fireEffect) {
        movement.fireEffect = createFireEffect(mesh);
    }
}

function destroyVehicle(mesh, movement) {
    movement.destroyed = true;
    movement.speed = 0;
    movement.steeringAngle = 0;
    updateVehicleDamageEffects(mesh, movement);

    if (!movement.exploded) {
        movement.exploded = true;
        createExplosion(mesh);
    }
}

function createSmokeEffect(mesh) {
    const scene = mesh.getScene();
    const smoke = new BABYLON.ParticleSystem("truckSmoke", 140, scene);
    smoke.particleTexture = createParticleTexture(scene, "truckSmokeTexture", "rgba(120,120,120,0.95)");
    smoke.emitter = mesh;
    smoke.minEmitBox = new BABYLON.Vector3(-0.55, 1.7, 3.7);
    smoke.maxEmitBox = new BABYLON.Vector3(0.55, 2.1, 4.8);
    smoke.color1 = new BABYLON.Color4(0.18, 0.18, 0.18, 0.55);
    smoke.color2 = new BABYLON.Color4(0.45, 0.43, 0.39, 0.35);
    smoke.minSize = 0.65;
    smoke.maxSize = 1.9;
    smoke.minLifeTime = 0.8;
    smoke.maxLifeTime = 1.8;
    smoke.emitRate = 55;
    smoke.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
    smoke.direction1 = new BABYLON.Vector3(-0.35, 1.4, -0.15);
    smoke.direction2 = new BABYLON.Vector3(0.35, 2.2, 0.15);
    smoke.minEmitPower = 0.6;
    smoke.maxEmitPower = 1.3;
    smoke.updateSpeed = 0.018;
    smoke.start();
    return smoke;
}

function createFireEffect(mesh) {
    const scene = mesh.getScene();
    const fire = new BABYLON.ParticleSystem("truckFire", 120, scene);
    fire.particleTexture = createParticleTexture(scene, "truckFireTexture", "rgba(255,190,40,0.95)");
    fire.emitter = mesh;
    fire.minEmitBox = new BABYLON.Vector3(-0.45, 1.0, 4.2);
    fire.maxEmitBox = new BABYLON.Vector3(0.45, 1.45, 5.0);
    fire.color1 = new BABYLON.Color4(1, 0.55, 0.08, 0.9);
    fire.color2 = new BABYLON.Color4(0.9, 0.08, 0.01, 0.8);
    fire.colorDead = new BABYLON.Color4(0.08, 0.04, 0.02, 0);
    fire.minSize = 0.35;
    fire.maxSize = 1.1;
    fire.minLifeTime = 0.18;
    fire.maxLifeTime = 0.42;
    fire.emitRate = 95;
    fire.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
    fire.direction1 = new BABYLON.Vector3(-0.35, 1.8, -0.25);
    fire.direction2 = new BABYLON.Vector3(0.35, 2.8, 0.25);
    fire.minEmitPower = 0.8;
    fire.maxEmitPower = 1.7;
    fire.updateSpeed = 0.018;
    fire.start();
    return fire;
}

function createExplosion(mesh) {
    const scene = mesh.getScene();
    const flashMaterial = makeMaterial(scene, "truckExplosionFlash", 1, 0.48, 0.08);
    flashMaterial.emissiveColor = new BABYLON.Color3(1, 0.32, 0.04);
    const flash = BABYLON.MeshBuilder.CreateSphere("truckExplosionFlash", { diameter: 1.4, segments: 12 }, scene);
    flash.position.copyFrom(mesh.position).addInPlace(new BABYLON.Vector3(0, 1.2, 3.6));
    flash.material = flashMaterial;

    const debrisMaterial = makeMaterial(scene, "truckExplosionDebris", 0.05, 0.045, 0.04);
    const debris = [];

    for (let i = 0; i < 12; i += 1) {
        const piece = BABYLON.MeshBuilder.CreateBox("truckDebris", { width: 0.32, height: 0.2, depth: 0.48 }, scene);
        piece.position.copyFrom(flash.position);
        piece.material = debrisMaterial;
        piece.metadata = {
            velocity: new BABYLON.Vector3(Math.sin(i * 1.7) * 7, 3 + (i % 3), Math.cos(i * 1.7) * 7),
            spin: seededRange(i + 50, -0.25, 0.25),
        };
        debris.push(piece);
    }

    let time = 0;
    const observer = scene.onBeforeRenderObservable.add(() => {
        const deltaSeconds = scene.getEngine().getDeltaTime() / 1000;
        time += deltaSeconds;
        flash.scaling.setAll(1 + time * 9);
        flash.visibility = Math.max(0, 1 - time * 3.4);

        for (const piece of debris) {
            piece.position.addInPlace(piece.metadata.velocity.scale(deltaSeconds));
            piece.metadata.velocity.y -= 9.8 * deltaSeconds;
            piece.rotation.x += piece.metadata.spin;
            piece.rotation.z -= piece.metadata.spin * 0.7;
        }

        if (time > 1.4) {
            scene.onBeforeRenderObservable.remove(observer);
            flash.dispose();
            flashMaterial.dispose();
        }
    });
}

function createParticleTexture(scene, name, color) {
    const texture = new BABYLON.DynamicTexture(name, { width: 32, height: 32 }, scene, false);
    const context = texture.getContext();
    const gradient = context.createRadialGradient(16, 16, 1, 16, 16, 16);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.clearRect(0, 0, 32, 32);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    texture.update();
    return texture;
}

function updateWheelVisuals(mesh, movement) {
    const wheels = mesh.metadata?.wheels ?? [];

    for (const wheel of wheels) {
        wheel.root.rotation.y = wheel.steers ? movement.steeringAngle : 0;
        wheel.tire.rotation.x = movement.wheelSpin;
        wheel.rim.rotation.x = movement.wheelSpin;
    }
}

function getForward(mesh) {
    return new BABYLON.Vector3(Math.sin(mesh.rotation.y), 0, Math.cos(mesh.rotation.y));
}

function getRight(mesh) {
    return new BABYLON.Vector3(Math.cos(mesh.rotation.y), 0, -Math.sin(mesh.rotation.y));
}

function makeMaterial(scene, name, r, g, b) {
    const material = new BABYLON.StandardMaterial(name, scene);
    material.diffuseColor = new BABYLON.Color3(r, g, b);
    material.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04);
    return material;
}

function approach(value, target, amount) {
    if (value < target) {
        return Math.min(value + amount, target);
    }

    return Math.max(value - amount, target);
}

function seededRange(seed, min, max) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return min + (value - Math.floor(value)) * (max - min);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
