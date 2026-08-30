const WORLD_LIMIT = 86;
const ENTER_DISTANCE = 7;
const VEHICLE_COLLISION_RADIUS = 4.25;

export function createVehicleController({ scene, collisionWorld }) {
    const mesh = createVehicleMesh(scene);
    const input = createInputState();
    const movement = {
        speed: 0,
        steeringAngle: 0,
        wheelSpin: 0,
        active: false,
    };

    mesh.position.set(12, 0.8, 8);
    mesh.rotation.y = BABYLON.Tools.ToRadians(-25);

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
        get forward() {
            return getForward(mesh);
        },
        applyImpactSlowdown(multiplier) {
            movement.speed *= multiplier;
        },
        canEnter(playerMesh) {
            return BABYLON.Vector3.Distance(playerMesh.position, mesh.position) <= ENTER_DISTANCE;
        },
        enter() {
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

    addBox(scene, root, "truckChassis", { width: 4.1, height: 0.45, depth: 8.6 }, [0, -0.05, 0.25], darkTrim);
    addBox(scene, root, "truckCab", { width: 3.4, height: 1.9, depth: 2.6 }, [0, 1.0, 2.55], whitePaint);
    addBox(scene, root, "truckHood", { width: 3.4, height: 1.0, depth: 1.6 }, [0, 0.58, 4.65], whitePaint);
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

    root.metadata = {
        wheels,
    };

    return root;
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
    const heldButtons = new Set();
    const mobileButtons = [
        { id: "drive-gas", action: "gas" },
        { id: "drive-reverse", action: "reverse" },
        { id: "drive-left", action: "left" },
        { id: "drive-right", action: "right" },
    ].map(({ id, action }) => ({
        element: document.querySelector(`#${id}`),
        action,
    }));

    function onKeyDown(event) {
        pressed.add(event.code);
    }

    function onKeyUp(event) {
        pressed.delete(event.code);
    }

    function holdAction(action, element) {
        heldButtons.add(action);
        element.classList.add("is-held");
    }

    function releaseAction(action, element) {
        heldButtons.delete(action);
        element.classList.remove("is-held");
    }

    function createPointerDownHandler(action, element) {
        return function onPointerDown(event) {
            holdAction(action, element);
            element.setPointerCapture(event.pointerId);
            event.preventDefault();
        };
    }

    function createPointerEndHandler(action, element) {
        return function onPointerEnd(event) {
            releaseAction(action, element);
            event.preventDefault();
        };
    }

    const mobileListeners = mobileButtons
        .filter(({ element }) => element)
        .map(({ element, action }) => {
            const onPointerDown = createPointerDownHandler(action, element);
            const onPointerEnd = createPointerEndHandler(action, element);
            element.addEventListener("pointerdown", onPointerDown);
            element.addEventListener("pointerup", onPointerEnd);
            element.addEventListener("pointercancel", onPointerEnd);
            element.addEventListener("lostpointercapture", onPointerEnd);
            return { element, action, onPointerDown, onPointerEnd };
        });

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return {
        get throttle() {
            const keyboardThrottle = Number(pressed.has("KeyW")) - Number(pressed.has("KeyS"));
            const touchThrottle = Number(heldButtons.has("gas")) - Number(heldButtons.has("reverse"));
            return clamp(keyboardThrottle + touchThrottle, -1, 1);
        },
        get steering() {
            const keyboardSteering = Number(pressed.has("KeyD")) - Number(pressed.has("KeyA"));
            const touchSteering = Number(heldButtons.has("right")) - Number(heldButtons.has("left"));
            return clamp(keyboardSteering + touchSteering, -1, 1);
        },
        dispose() {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);

            for (const listener of mobileListeners) {
                listener.element.removeEventListener("pointerdown", listener.onPointerDown);
                listener.element.removeEventListener("pointerup", listener.onPointerEnd);
                listener.element.removeEventListener("pointercancel", listener.onPointerEnd);
                listener.element.removeEventListener("lostpointercapture", listener.onPointerEnd);
                releaseAction(listener.action, listener.element);
            }
        },
    };
}

function updateVehicle({ mesh, collisionWorld, input, movement, deltaSeconds }) {
    if (!movement.active) {
        updateWheelVisuals(mesh, movement);
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
        movement.speed *= -0.18;
    }

    movement.wheelSpin += (movement.speed / wheelRadius) * deltaSeconds;
    updateWheelVisuals(mesh, movement);
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

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
