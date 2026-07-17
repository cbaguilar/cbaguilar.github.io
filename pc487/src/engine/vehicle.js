const WORLD_LIMIT = 86;
const ENTER_DISTANCE = 7;

export function createVehicleController({ scene }) {
    const mesh = createVehicleMesh(scene);
    const input = createInputState();
    const movement = {
        speed: 0,
        active: false,
    };

    mesh.position.set(12, 0.8, 8);
    mesh.rotation.y = BABYLON.Tools.ToRadians(-25);

    const observer = scene.onBeforeRenderObservable.add(() => {
        const deltaSeconds = scene.getEngine().getDeltaTime() / 1000;
        updateVehicle({ mesh, input, movement, deltaSeconds });
    });

    return {
        mesh,
        get active() {
            return movement.active;
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
        [-2.05, -0.42, 3.75],
        [2.05, -0.42, 3.75],
        [-2.05, -0.42, -1.9],
        [2.05, -0.42, -1.9],
        [-2.05, -0.42, -3.05],
        [2.05, -0.42, -3.05],
    ];

    for (const [x, y, z] of wheelSpecs) {
        const wheel = createWheel(scene, root, tireMaterial, rimMaterial);
        wheel.position.set(x, y, z);
    }

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

    return wheelRoot;
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
            return Number(pressed.has("KeyW")) - Number(pressed.has("KeyS"));
        },
        get steering() {
            return Number(pressed.has("KeyD")) - Number(pressed.has("KeyA"));
        },
        dispose() {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        },
    };
}

function updateVehicle({ mesh, input, movement, deltaSeconds }) {
    if (!movement.active) {
        return;
    }

    const acceleration = 20;
    const brakeDrag = 15;
    const rollingDrag = 2.2;
    const maxForward = 26;
    const maxReverse = -9;
    const turnRate = 1.25;

    movement.speed += input.throttle * acceleration * deltaSeconds;

    if (input.throttle === 0) {
        movement.speed = approach(movement.speed, 0, rollingDrag * deltaSeconds);
    }

    if (Math.sign(input.throttle) !== Math.sign(movement.speed) && input.throttle !== 0) {
        movement.speed = approach(movement.speed, 0, brakeDrag * deltaSeconds);
    }

    movement.speed = clamp(movement.speed, maxReverse, maxForward);

    const speedFactor = Math.min(Math.abs(movement.speed) / maxForward, 1);
    mesh.rotation.y += input.steering * turnRate * speedFactor * Math.sign(movement.speed || 1) * deltaSeconds;

    const forward = getForward(mesh);
    mesh.position.x = clamp(mesh.position.x + forward.x * movement.speed * deltaSeconds, -WORLD_LIMIT, WORLD_LIMIT);
    mesh.position.z = clamp(mesh.position.z + forward.z * movement.speed * deltaSeconds, -WORLD_LIMIT, WORLD_LIMIT);
    mesh.position.y = 0.8;
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
