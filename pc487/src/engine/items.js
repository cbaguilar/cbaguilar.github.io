const PICKUP_DISTANCE = 3.2;
const PICKUP_BOB_SPEED = 3.8;

export function createItemSystem({ scene, playerController, audioSystem, onInventoryChange, onPromptChange }) {
    const input = createInputState();
    const inventory = [];
    const pickups = [
        createGunPickup(scene, new BABYLON.Vector3(2.6, 0.9, 1.4)),
    ];

    const observer = scene.onBeforeRenderObservable.add(() => {
        updatePickups({ playerController, audioSystem, pickups, input, inventory, onInventoryChange, onPromptChange });
    });

    onInventoryChange([...inventory]);

    return {
        inventory,
        hasItem(itemId) {
            return inventory.some((item) => item.id === itemId);
        },
        dispose() {
            scene.onBeforeRenderObservable.remove(observer);
            input.dispose();

            for (const pickup of pickups) {
                pickup.mesh.dispose(false, true);
            }
        },
    };
}

function createGunPickup(scene, position) {
    const mesh = new BABYLON.TransformNode("pickupPistolRoot", scene);
    mesh.position.copyFrom(position);

    const marker = createPickupMarker(scene);
    marker.parent = mesh;

    const gun = createGunMesh(scene, "pickupPistol");
    gun.parent = mesh;
    gun.position.y = 0.35;
    gun.rotation.y = BABYLON.Tools.ToRadians(-25);
    gun.rotation.z = BABYLON.Tools.ToRadians(8);
    gun.scaling.setAll(1.85);

    return {
        id: "pistol",
        label: "Pistol",
        mesh,
        gun,
        marker,
        bobTime: 0,
        collected: false,
    };
}

function updatePickups({ playerController, audioSystem, pickups, input, inventory, onInventoryChange, onPromptChange }) {
    if (!playerController.active) {
        onPromptChange("");
        input.consumePickup();
        return;
    }

    const nearbyPickup = pickups.find((pickup) => (
        !pickup.collected
        && BABYLON.Vector3.Distance(playerController.mesh.position, pickup.mesh.position) <= PICKUP_DISTANCE
    ));

    if (!nearbyPickup) {
        onPromptChange("");
        input.consumePickup();
        return;
    }

    onPromptChange(`Press F to pick up ${nearbyPickup.label}`);
    animatePickup(nearbyPickup);

    if (!input.consumePickup()) {
        return;
    }

    nearbyPickup.collected = true;
    nearbyPickup.mesh.setEnabled(false);
    inventory.push({ id: nearbyPickup.id, label: nearbyPickup.label });
    playerController.equipItem(nearbyPickup.id);
    audioSystem.playEquipGun();
    onInventoryChange([...inventory]);
    onPromptChange(`Picked up ${nearbyPickup.label}`);
}

function animatePickup(pickup) {
    pickup.bobTime += 1 / 60;
    pickup.gun.rotation.y += 0.025;
    pickup.gun.position.y = 0.35 + Math.sin(pickup.bobTime * PICKUP_BOB_SPEED) * 0.12;
    pickup.marker.rotation.y -= 0.018;
}

function createPickupMarker(scene) {
    const markerRoot = new BABYLON.TransformNode("pickupMarker", scene);
    const gold = makeMaterial(scene, "pickupMarkerGold", 1, 0.68, 0.14);
    const dark = makeMaterial(scene, "pickupMarkerDark", 0.12, 0.09, 0.04);

    const base = BABYLON.MeshBuilder.CreateCylinder(
        "pickupMarkerBase",
        {
            diameter: 1.25,
            height: 0.08,
            tessellation: 28,
        },
        scene,
    );
    base.parent = markerRoot;
    base.position.y = -0.86;
    base.material = dark;

    const ringA = addBox(scene, markerRoot, "pickupMarkerRingA", { width: 1.25, height: 0.06, depth: 0.08 }, [0, -0.78, 0], gold);
    const ringB = addBox(scene, markerRoot, "pickupMarkerRingB", { width: 0.08, height: 0.06, depth: 1.25 }, [0, -0.78, 0], gold);
    ringA.rotation.y = BABYLON.Tools.ToRadians(45);
    ringB.rotation.y = BABYLON.Tools.ToRadians(45);

    return markerRoot;
}

function createGunMesh(scene, name) {
    const gunRoot = new BABYLON.TransformNode(name, scene);
    const metal = makeMaterial(scene, `${name}Metal`, 0.08, 0.085, 0.09);
    const grip = makeMaterial(scene, `${name}Grip`, 0.025, 0.025, 0.022);
    const sight = makeMaterial(scene, `${name}Sight`, 0.7, 0.62, 0.35);

    addBox(scene, gunRoot, `${name}Slide`, { width: 0.18, height: 0.16, depth: 0.9 }, [0, 0.1, 0.08], metal);
    addBox(scene, gunRoot, `${name}Barrel`, { width: 0.11, height: 0.1, depth: 0.38 }, [0, 0.08, 0.72], metal);
    const handle = addBox(scene, gunRoot, `${name}Grip`, { width: 0.18, height: 0.48, depth: 0.24 }, [0, -0.25, -0.22], grip);
    handle.rotation.x = BABYLON.Tools.ToRadians(-12);
    addBox(scene, gunRoot, `${name}TriggerGuard`, { width: 0.2, height: 0.2, depth: 0.08 }, [0, -0.12, 0.18], metal);
    addBox(scene, gunRoot, `${name}FrontSight`, { width: 0.08, height: 0.06, depth: 0.08 }, [0, 0.22, 0.5], sight);

    return gunRoot;
}

function createInputState() {
    let pickupRequested = false;

    function onKeyDown(event) {
        if (event.code === "KeyF" && !event.repeat) {
            pickupRequested = true;
        }
    }

    window.addEventListener("keydown", onKeyDown);

    return {
        consumePickup() {
            const requested = pickupRequested;
            pickupRequested = false;
            return requested;
        },
        dispose() {
            window.removeEventListener("keydown", onKeyDown);
        },
    };
}

export function createEquippedGunMesh(scene) {
    const mesh = createGunMesh(scene, "equippedPistol");
    mesh.scaling.setAll(0.72);
    mesh.rotation.x = BABYLON.Tools.ToRadians(90);
    return mesh;
}

function addBox(scene, parent, name, size, position, material) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
    mesh.parent = parent;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.material = material;
    return mesh;
}

function makeMaterial(scene, name, r, g, b) {
    const material = new BABYLON.StandardMaterial(name, scene);
    material.diffuseColor = new BABYLON.Color3(r, g, b);
    material.specularColor = new BABYLON.Color3(0.06, 0.06, 0.06);
    return material;
}
