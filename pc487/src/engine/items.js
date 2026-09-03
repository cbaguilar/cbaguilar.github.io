const PICKUP_DISTANCE = 3.2;
const ROCK_SOURCE_DISTANCE = 4.1;
const ROCK_AMMO_MAX = 5;
const PICKUP_BOB_SPEED = 3.8;

export function createItemSystem({ scene, playerController, audioSystem, onInventoryChange, onPromptChange }) {
    const input = createInputState();
    const inventory = [];
    let rockAmmo = 0;
    const pickups = [
        createStickPickup(scene, new BABYLON.Vector3(-6, 0.72, 10)),
        createRockPickup(scene, new BABYLON.Vector3(13, 0.55, 5)),
        createStickPickup(scene, new BABYLON.Vector3(26, 0.72, -12)),
        createRockPickup(scene, new BABYLON.Vector3(39, 0.55, 15)),
        createGunPickup(scene, new BABYLON.Vector3(42, 0.9, 28)),
    ];
    const rockSources = [
        createRockSource(scene, new BABYLON.Vector3(-18.5, 0, 3.4), 1.75),
        createRockSource(scene, new BABYLON.Vector3(14.5, 0, 7.8), 1.45),
        createRockSource(scene, new BABYLON.Vector3(35.5, 0, 18.5), 1.65),
    ];

    function getInventorySnapshot() {
        const snapshot = [...inventory];

        if (rockAmmo > 0) {
            snapshot.push({ id: "rock", label: `Rocks x${rockAmmo}` });
        }

        return snapshot;
    }

    function notifyInventory() {
        onInventoryChange(getInventorySnapshot());
    }

    const observer = scene.onBeforeRenderObservable.add(() => {
        updatePickups({
            playerController,
            audioSystem,
            pickups,
            rockSources,
            input,
            inventory,
            getRockAmmo() {
                return rockAmmo;
            },
            setRockAmmo(nextRockAmmo) {
                rockAmmo = nextRockAmmo;
            },
            notifyInventory,
            onPromptChange,
        });
    });

    notifyInventory();

    return {
        inventory,
        get rockAmmo() {
            return rockAmmo;
        },
        hasItem(itemId) {
            if (itemId === "rock") {
                return rockAmmo > 0;
            }

            return inventory.some((item) => item.id === itemId);
        },
        addRocks(amount) {
            rockAmmo = Math.min(ROCK_AMMO_MAX, rockAmmo + amount);
            notifyInventory();
        },
        consumeRock() {
            if (rockAmmo <= 0) {
                return false;
            }

            rockAmmo -= 1;
            notifyInventory();
            return true;
        },
        dispose() {
            scene.onBeforeRenderObservable.remove(observer);
            input.dispose();

            for (const pickup of pickups) {
                pickup.mesh.dispose(false, true);
            }

            for (const source of rockSources) {
                source.mesh.dispose(false, true);
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

function createStickPickup(scene, position) {
    const mesh = new BABYLON.TransformNode("pickupStickRoot", scene);
    mesh.position.copyFrom(position);

    const marker = createPickupMarker(scene);
    marker.parent = mesh;

    const stick = BABYLON.MeshBuilder.CreateCylinder("pickupStick", {
        diameter: 0.12,
        height: 1.35,
        tessellation: 7,
    }, scene);
    stick.parent = mesh;
    stick.position.y = 0.22;
    stick.rotation.z = BABYLON.Tools.ToRadians(72);
    stick.rotation.x = BABYLON.Tools.ToRadians(8);
    stick.material = makeMaterial(scene, "pickupStickWood", 0.34, 0.2, 0.09);

    return {
        id: "stick",
        label: "Stick",
        mesh,
        gun: stick,
        marker,
        bobTime: 0,
        collected: false,
    };
}

function createRockPickup(scene, position) {
    const mesh = new BABYLON.TransformNode("pickupRockRoot", scene);
    mesh.position.copyFrom(position);

    const marker = createPickupMarker(scene);
    marker.parent = mesh;

    const rock = BABYLON.MeshBuilder.CreateSphere("pickupRock", {
        diameter: 0.62,
        segments: 8,
    }, scene);
    rock.parent = mesh;
    rock.position.y = 0.05;
    rock.scaling.set(1.25, 0.65, 0.9);
    rock.material = makeMaterial(scene, "pickupRockStone", 0.34, 0.33, 0.3);

    return {
        id: "rock",
        label: "Rock",
        mesh,
        gun: rock,
        marker,
        bobTime: 0,
        collected: false,
    };
}

function createRockSource(scene, position, scale) {
    const mesh = new BABYLON.TransformNode("rockSourceBoulder", scene);
    mesh.position.copyFrom(position);

    const stone = makeMaterial(scene, "rockSourceStone", 0.3, 0.29, 0.26);
    const moss = makeMaterial(scene, "rockSourceMoss", 0.2, 0.34, 0.16);

    const boulder = BABYLON.MeshBuilder.CreateSphere("rockSourceBoulderBody", {
        diameter: scale,
        segments: 8,
    }, scene);
    boulder.parent = mesh;
    boulder.position.y = scale * 0.28;
    boulder.scaling.set(1.25, 0.55, 0.92);
    boulder.material = stone;

    const chip = BABYLON.MeshBuilder.CreateSphere("rockSourceLooseStone", {
        diameter: scale * 0.32,
        segments: 6,
    }, scene);
    chip.parent = mesh;
    chip.position.set(scale * 0.72, scale * 0.12, scale * 0.25);
    chip.scaling.set(1.1, 0.55, 0.85);
    chip.material = moss;

    return {
        mesh,
        bobTime: 0,
    };
}

function updatePickups({ playerController, audioSystem, pickups, rockSources, input, inventory, getRockAmmo, setRockAmmo, notifyInventory, onPromptChange }) {
    if (!playerController.active) {
        onPromptChange("");
        input.setPickupAvailable(false);
        input.consumePickup();
        return;
    }

    const nearbyPickup = pickups.find((pickup) => (
        !pickup.collected
        && BABYLON.Vector3.Distance(playerController.mesh.position, pickup.mesh.position) <= PICKUP_DISTANCE
    ));

    if (!nearbyPickup) {
        const nearbyRockSource = rockSources.find((source) => (
            BABYLON.Vector3.Distance(playerController.mesh.position, source.mesh.position) <= ROCK_SOURCE_DISTANCE
        ));

        if (!nearbyRockSource) {
            onPromptChange("");
            input.setPickupAvailable(false);
            input.consumePickup();
            return;
        }

        input.setPickupAvailable(true);
        const rockAmmo = getRockAmmo();
        onPromptChange(rockAmmo >= ROCK_AMMO_MAX ? "Rock pouch full" : "Press F or tap Pick Up to gather rocks");
        animateRockSource(nearbyRockSource);

        if (!input.consumePickup() || rockAmmo >= ROCK_AMMO_MAX) {
            return;
        }

        const nextRockAmmo = Math.min(ROCK_AMMO_MAX, rockAmmo + 2);
        setRockAmmo(nextRockAmmo);
        audioSystem.playEquipGun();
        notifyInventory();
        onPromptChange(`Gathered rocks (${nextRockAmmo}/${ROCK_AMMO_MAX})`, { holdMs: 900 });
        return;
    }

    input.setPickupAvailable(true);
    onPromptChange(`Press F or tap Pick Up for ${nearbyPickup.label}`);
    animatePickup(nearbyPickup);

    if (!input.consumePickup()) {
        return;
    }

    nearbyPickup.collected = true;
    nearbyPickup.mesh.setEnabled(false);

    if (nearbyPickup.id === "rock") {
        setRockAmmo(Math.min(ROCK_AMMO_MAX, getRockAmmo() + 1));
    } else {
        inventory.push({ id: nearbyPickup.id, label: nearbyPickup.label });
        playerController.equipItem(nearbyPickup.id);
    }

    audioSystem.playEquipGun();
    notifyInventory();
    input.setPickupAvailable(false);
    onPromptChange(nearbyPickup.id === "rock" ? `Picked up Rock (${getRockAmmo()}/${ROCK_AMMO_MAX})` : `Picked up ${nearbyPickup.label}`);
}

function animatePickup(pickup) {
    pickup.bobTime += 1 / 60;
    pickup.gun.rotation.y += 0.025;
    pickup.gun.position.y = 0.35 + Math.sin(pickup.bobTime * PICKUP_BOB_SPEED) * 0.12;
    pickup.marker.rotation.y -= 0.018;
}

function animateRockSource(source) {
    source.bobTime += 1 / 60;
    source.mesh.rotation.y += 0.004;
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
    const mobilePickupButton = document.querySelector("#mobile-pickup");

    function onKeyDown(event) {
        if (event.code === "KeyF" && !event.repeat) {
            pickupRequested = true;
        }
    }

    function onMobilePickup(event) {
        pickupRequested = true;
        event.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);

    if (mobilePickupButton) {
        mobilePickupButton.addEventListener("pointerdown", onMobilePickup);
    }

    return {
        setPickupAvailable(isAvailable) {
            if (mobilePickupButton) {
                mobilePickupButton.classList.toggle("is-visible", isAvailable);
            }
        },
        consumePickup() {
            const requested = pickupRequested;
            pickupRequested = false;
            return requested;
        },
        dispose() {
            window.removeEventListener("keydown", onKeyDown);

            if (mobilePickupButton) {
                mobilePickupButton.removeEventListener("pointerdown", onMobilePickup);
            }
        },
    };
}

export function createEquippedGunMesh(scene) {
    const mesh = createGunMesh(scene, "equippedPistol");
    mesh.scaling.setAll(0.72);
    mesh.rotation.x = BABYLON.Tools.ToRadians(90);
    return mesh;
}

export function createEquippedStickMesh(scene) {
    const stick = BABYLON.MeshBuilder.CreateCylinder("equippedStick", {
        diameter: 0.09,
        height: 1.45,
        tessellation: 7,
    }, scene);
    stick.material = makeMaterial(scene, "equippedStickWood", 0.34, 0.2, 0.09);
    stick.rotation.x = BABYLON.Tools.ToRadians(15);
    return stick;
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
