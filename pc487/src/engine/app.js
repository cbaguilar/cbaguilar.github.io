import { createCombatSystem } from "./combat.js";
import { createAudioSystem } from "./audio.js";
import { createCollisionWorld } from "./collision.js";
import { createCutsceneSystem } from "./cutscenes.js";
import { createItemSystem } from "./items.js";
import { createNpcSystem } from "./npcs.js";
import { createPlayerController } from "./player.js";
import { createVehicleController } from "./vehicle.js";
import { createVehicleImpactSystem } from "./vehicleImpacts.js";
import { resetMobileMoveInput } from "./mobileInput.js";

const WORLD_SIZE = 180;
const OVERWORLD_THRESHOLD_X = 58;
const CAMERA_MODES = {
    forest: {
        radius: 7.2,
        lowerRadiusLimit: 5.8,
        upperRadiusLimit: 9.4,
        lowerBetaLimit: 72,
        upperBetaLimit: 86,
    },
    overworld: {
        radius: 15,
        lowerRadiusLimit: 10,
        upperRadiusLimit: 22,
        lowerBetaLimit: 45,
        upperBetaLimit: 82,
    },
    vehicle: {
        radius: 34,
        lowerRadiusLimit: 18,
        upperRadiusLimit: 52,
        lowerBetaLimit: 42,
        upperBetaLimit: 82,
    },
};
let promptHoldUntil = 0;

export function createPc487App({ canvas }) {
    if (!canvas) {
        throw new Error("PC487 requires a canvas element.");
    }

    if (!window.BABYLON) {
        throw new Error("BabylonJS did not load.");
    }

    const engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        antialias: true,
    });

    const sceneState = createScene(engine, canvas);
    const { scene } = sceneState;
    let debugVisible = false;

    function start() {
        engine.runRenderLoop(() => {
            scene.render();
        });

        window.addEventListener("resize", resize);
        sceneState.cutsceneSystem.startOpeningCutscene();
    }

    function resize() {
        engine.resize();
    }

    async function toggleDebugLayer() {
        if (!debugVisible) {
            await scene.debugLayer.show({
                embedMode: true,
                overlay: true,
            });
            debugVisible = true;
        } else {
            scene.debugLayer.hide();
            debugVisible = false;
        }

        return debugVisible;
    }

    function teleportToVehicle() {
        const playerMesh = sceneState.playerController.mesh;
        resetMobileMoveInput();

        if (sceneState.npcSystem.activeMount) {
            sceneState.npcSystem.exitMount(playerMesh);
        }

        if (sceneState.vehicleController.active) {
            sceneState.vehicleController.exit(playerMesh);
        }

        const vehicleMesh = sceneState.vehicleController.mesh;
        const forward = sceneState.vehicleController.forward;
        const right = new BABYLON.Vector3(forward.z, 0, -forward.x);
        const target = vehicleMesh.position
            .subtract(forward.scale(7.5))
            .add(right.scale(3.2));

        sceneState.playerController.setActive(true);
        playerMesh.position.set(
            clamp(target.x, -86, 86),
            1,
            clamp(target.z, -86, 86),
        );
        playerMesh.rotation.y = vehicleMesh.rotation.y;
        sceneState.camera.lockedTarget = playerMesh;
        applyCameraMode(sceneState.camera, getPedestrianCameraMode(playerMesh));
        document.querySelector("#game-shell")?.classList.remove("is-driving");
        updateInteractionPrompt("Teleported to truck", { holdMs: 900 });
    }

    function toggleNoclip() {
        const nextNoclip = !sceneState.playerController.noclip;
        sceneState.playerController.setNoclip(nextNoclip);
        updateInteractionPrompt(nextNoclip ? "Noclip on" : "Noclip off", { holdMs: 900 });
        return nextNoclip;
    }

    function dispose() {
        window.removeEventListener("resize", resize);
        sceneState.dispose();
        sceneState.cutsceneSystem.dispose();
        sceneState.combatSystem.dispose();
        sceneState.vehicleImpactSystem.dispose();
        sceneState.vehicleAudioController.dispose();
        sceneState.traversalCourseController.dispose();
        sceneState.cameraRegionController.dispose();
        sceneState.npcSystem.dispose();
        sceneState.itemSystem.dispose();
        sceneState.playerController.dispose();
        sceneState.vehicleController.dispose();
        scene.dispose();
        engine.dispose();
    }

    return {
        canvas,
        engine,
        scene,
        testControls: createTestControls(sceneState),
        start,
        toggleDebugLayer,
        teleportToVehicle,
        toggleNoclip,
        dispose,
    };
}

function createScene(engine, canvas) {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.56, 0.72, 0.87, 1);
    scene.collisionsEnabled = true;

    const camera = new BABYLON.ArcRotateCamera(
        "followCamera",
        BABYLON.Tools.ToRadians(45),
        BABYLON.Tools.ToRadians(80),
        CAMERA_MODES.forest.radius,
        new BABYLON.Vector3(0, 1, 0),
        scene,
    );
    applyCameraMode(camera, "forest");
    camera.checkCollisions = true;
    camera.collisionRadius = new BABYLON.Vector3(0.6, 0.6, 0.6);
    camera.wheelDeltaPercentage = 0.01;
    camera.panningSensibility = 70;
    camera.attachControl(canvas, true);
    camera.inputs.remove(camera.inputs.attached.keyboard);
    configureCameraPointerControls(camera, canvas);

    const sun = new BABYLON.DirectionalLight(
        "sun",
        new BABYLON.Vector3(-0.45, -0.85, 0.35),
        scene,
    );
    sun.intensity = 2.2;

    const ambient = new BABYLON.HemisphericLight(
        "ambient",
        new BABYLON.Vector3(0, 1, 0),
        scene,
    );
    ambient.intensity = 0.55;
    ambient.groundColor = new BABYLON.Color3(0.22, 0.18, 0.14);

    const sceneState = {
        scene,
        camera,
        playerController: null,
        vehicleController: null,
        audioSystem: null,
        itemSystem: null,
        npcSystem: null,
        combatSystem: null,
        cutsceneSystem: null,
        vehicleImpactSystem: null,
        vehicleAudioController: null,
        cameraRegionController: null,
        collisionWorld: null,
        traversalCourse: null,
        traversalCourseController: null,
        dispose: null,
        roads: [],
        buildings: [],
    };

    createFlatGround(scene);
    sceneState.roads = createRiverCorridor(scene);
    sceneState.buildings = createRiparianVegetation(scene);
    sceneState.traversalCourse = createTraversalCourse(scene);
    sceneState.collisionWorld = createCollisionWorld(sceneState.buildings);
    sceneState.audioSystem = createAudioSystem();
    sceneState.playerController = createPlayerController({
        scene,
        camera,
        collisionWorld: sceneState.collisionWorld,
        terrainWorld: sceneState.traversalCourse,
    });
    sceneState.vehicleController = createVehicleController({ scene, collisionWorld: sceneState.collisionWorld });
    sceneState.npcSystem = createNpcSystem({
        scene,
        collisionWorld: sceneState.collisionWorld,
        playerController: sceneState.playerController,
    });
    sceneState.itemSystem = createItemSystem({
        scene,
        playerController: sceneState.playerController,
        audioSystem: sceneState.audioSystem,
        onInventoryChange: updateInventoryHud,
        onPromptChange: updateInteractionPrompt,
    });
    sceneState.combatSystem = createCombatSystem({
        scene,
        playerController: sceneState.playerController,
        vehicleController: sceneState.vehicleController,
        itemSystem: sceneState.itemSystem,
        npcSystem: sceneState.npcSystem,
        audioSystem: sceneState.audioSystem,
        onPromptChange: updateInteractionPrompt,
    });
    sceneState.vehicleImpactSystem = createVehicleImpactSystem({
        scene,
        vehicleController: sceneState.vehicleController,
        npcSystem: sceneState.npcSystem,
        audioSystem: sceneState.audioSystem,
        onPromptChange: updateInteractionPrompt,
    });
    sceneState.vehicleAudioController = createVehicleAudioController(sceneState);
    camera.lockedTarget = sceneState.playerController.mesh;
    sceneState.cutsceneSystem = createCutsceneSystem({
        scene,
        camera,
        playerController: sceneState.playerController,
        onPromptChange: updateInteractionPrompt,
    });
    sceneState.dispose = createInteractionController(sceneState);
    sceneState.traversalCourseController = createTraversalCourseController(sceneState);
    sceneState.cameraRegionController = createCameraRegionController(sceneState);

    return sceneState;
}

function configureCameraPointerControls(camera, canvas) {
    const pointerInput = camera.inputs.attached.pointers;
    const touchZone = document.querySelector("#camera-touch-zone");

    if (pointerInput) {
        camera.inputs.remove(pointerInput);
    }

    let dragging = false;
    let pointerId = null;
    let lastX = 0;
    let lastY = 0;

    function startDrag(event, target) {
        event.preventDefault();
        dragging = true;
        pointerId = event.pointerId;
        lastX = event.clientX;
        lastY = event.clientY;
        target.setPointerCapture(pointerId);
    }

    canvas.addEventListener("pointerdown", (event) => {
        if (event.button !== 2) {
            return;
        }

        startDrag(event, canvas);
    });

    touchZone?.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse") {
            return;
        }

        startDrag(event, touchZone);
    });

    function updateDrag(event) {
        if (!dragging || event.pointerId !== pointerId) {
            return;
        }

        event.preventDefault();
        const deltaX = event.clientX - lastX;
        const deltaY = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;

        camera.alpha -= deltaX / 220;
        camera.beta = clamp(camera.beta - deltaY / 260, camera.lowerBetaLimit, camera.upperBetaLimit);
    }

    canvas.addEventListener("pointermove", updateDrag);
    touchZone?.addEventListener("pointermove", updateDrag);

    function stopDrag(event) {
        if (!dragging || event.pointerId !== pointerId) {
            return;
        }

        dragging = false;
        if (event.currentTarget.hasPointerCapture(pointerId)) {
            event.currentTarget.releasePointerCapture(pointerId);
        }
        pointerId = null;
    }

    canvas.addEventListener("pointerup", stopDrag);
    canvas.addEventListener("pointercancel", stopDrag);
    touchZone?.addEventListener("pointerup", stopDrag);
    touchZone?.addEventListener("pointercancel", stopDrag);
    canvas.addEventListener("wheel", (event) => {
        event.preventDefault();
        const zoomAmount = event.deltaY * 0.012;
        camera.radius = clamp(camera.radius + zoomAmount, camera.lowerRadiusLimit, camera.upperRadiusLimit);
    }, { passive: false });
    canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
    });
}

function applyCameraMode(camera, modeName) {
    if (camera.metadata?.modeName === modeName) {
        return;
    }

    const mode = CAMERA_MODES[modeName];
    camera.metadata = {
        ...(camera.metadata ?? {}),
        modeName,
    };
    camera.lowerRadiusLimit = mode.lowerRadiusLimit;
    camera.upperRadiusLimit = mode.upperRadiusLimit;
    camera.lowerBetaLimit = BABYLON.Tools.ToRadians(mode.lowerBetaLimit);
    camera.upperBetaLimit = BABYLON.Tools.ToRadians(mode.upperBetaLimit);
    camera.radius = clamp(camera.radius, mode.lowerRadiusLimit, mode.upperRadiusLimit);
    camera.beta = clamp(camera.beta, camera.lowerBetaLimit, camera.upperBetaLimit);

    if (camera.radius !== mode.radius) {
        camera.radius = mode.radius;
    }
}

function getPedestrianCameraMode(playerMesh) {
    return playerMesh.position.x >= OVERWORLD_THRESHOLD_X ? "overworld" : "forest";
}

function createCameraRegionController(sceneState) {
    const observer = sceneState.scene.onBeforeRenderObservable.add(() => {
        if (sceneState.cutsceneSystem?.active) {
            return;
        }

        if (sceneState.vehicleController.active || sceneState.npcSystem.activeMount) {
            applyCameraMode(sceneState.camera, "vehicle");
            return;
        }

        const target = sceneState.camera.lockedTarget ?? sceneState.playerController.mesh;
        applyCameraMode(sceneState.camera, target.position.x >= OVERWORLD_THRESHOLD_X ? "overworld" : "forest");
    });

    return {
        dispose() {
            sceneState.scene.onBeforeRenderObservable.remove(observer);
        },
    };
}

function createVehicleAudioController(sceneState) {
    const observer = sceneState.scene.onBeforeRenderObservable.add(() => {
        sceneState.audioSystem.updateTruckEngine({
            active: sceneState.vehicleController.active,
            speed: sceneState.vehicleController.speed,
        });
    });

    return {
        dispose() {
            sceneState.scene.onBeforeRenderObservable.remove(observer);
            sceneState.audioSystem.updateTruckEngine({ active: false, speed: 0 });
        },
    };
}

function createTraversalCourseController(sceneState) {
    const observer = sceneState.scene.onBeforeRenderObservable.add(() => {
        if (!sceneState.playerController.active || !sceneState.playerController.controlsEnabled) {
            return;
        }

        const respawnPoint = sceneState.traversalCourse.getRespawnPointIfHazard(sceneState.playerController.mesh.position);

        if (!respawnPoint) {
            return;
        }

        sceneState.playerController.mesh.position.copyFrom(respawnPoint);
        updateInteractionPrompt("Careful around the washout", { holdMs: 900 });
    });

    return {
        dispose() {
            sceneState.scene.onBeforeRenderObservable.remove(observer);
        },
    };
}

function createTestControls(sceneState) {
    return {
        grantPistol() {
            if (!sceneState.itemSystem.hasItem("pistol")) {
                sceneState.itemSystem.inventory.push({ id: "pistol", label: "Pistol" });
                sceneState.playerController.equipItem("pistol");
                updateInventoryHud(sceneState.itemSystem.inventory);
            }
        },
        grantStick() {
            if (!sceneState.itemSystem.hasItem("stick")) {
                sceneState.itemSystem.inventory.push({ id: "stick", label: "Stick" });
                sceneState.playerController.equipItem("stick");
                updateInventoryHud(sceneState.itemSystem.inventory);
            }
        },
        grantRocks(amount = 5) {
            sceneState.itemSystem.addRocks(amount);
        },
        enterVehicle() {
            sceneState.playerController.setActive(false);
            sceneState.vehicleController.enter();
            sceneState.camera.lockedTarget = sceneState.vehicleController.mesh;
            applyCameraMode(sceneState.camera, "vehicle");
            document.querySelector("#game-shell")?.classList.add("is-driving");
        },
        fire() {
            window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
        },
        get shotsFired() {
            return sceneState.combatSystem.shotsFired;
        },
        damageVehicle(amount) {
            sceneState.vehicleController.applyTestDamage(amount);
        },
        enterHorse() {
            if (sceneState.vehicleController.active) {
                sceneState.vehicleController.exit(sceneState.playerController.mesh);
            }

            const mount = sceneState.npcSystem.npcs.find((npc) => npc.mountable);

            if (!mount) {
                return false;
            }

            if (!mount.defeated) {
                sceneState.npcSystem.damageNpc(mount, mount.health);
            }

            mount.velocity.copyFromFloats(0, 0, 0);
            sceneState.playerController.setActive(false);

            if (!sceneState.npcSystem.enterMount(mount)) {
                return false;
            }

            sceneState.camera.lockedTarget = mount.proxy;
            applyCameraMode(sceneState.camera, "vehicle");
            document.querySelector("#game-shell")?.classList.add("is-driving");
            return true;
        },
        get activeMountLabel() {
            return sceneState.npcSystem.activeMount?.mountLabel ?? "";
        },
        get playerActive() {
            return sceneState.playerController.active;
        },
        get noclip() {
            return sceneState.playerController.noclip;
        },
        get distanceToVehicle() {
            return BABYLON.Vector3.Distance(sceneState.playerController.mesh.position, sceneState.vehicleController.mesh.position);
        },
    };
}

function updateInventoryHud(inventory) {
    const inventorySlot = document.querySelector("#inventory-slot");

    if (!inventorySlot) {
        return;
    }

    inventorySlot.textContent = inventory.length > 0
        ? inventory.map((item) => item.label).join(", ")
        : "Empty";
}

function updateInteractionPrompt(message, options = {}) {
    const prompt = document.querySelector("#interaction-prompt");

    if (!prompt) {
        return;
    }

    if (options.holdMs) {
        promptHoldUntil = performance.now() + options.holdMs;
    } else if (!message && performance.now() < promptHoldUntil) {
        return;
    }

    prompt.textContent = message;
}

function createInteractionController(sceneState) {
    const gameShell = document.querySelector("#game-shell");
    const mobileVehicleButton = document.querySelector("#mobile-vehicle-action");

    function enterVehicle() {
        sceneState.playerController.setActive(false);
        sceneState.vehicleController.enter();
        sceneState.camera.lockedTarget = sceneState.vehicleController.mesh;
        applyCameraMode(sceneState.camera, "vehicle");
        gameShell?.classList.add("is-driving");
    }

    function enterMount(mount) {
        if (!sceneState.npcSystem.enterMount(mount)) {
            return;
        }

        sceneState.playerController.setActive(false);
        sceneState.camera.lockedTarget = mount.proxy;
        applyCameraMode(sceneState.camera, "vehicle");
        gameShell?.classList.add("is-driving");
        updateMobileVehicleButton();
        updateInteractionPrompt(`Riding ${mount.mountLabel}`);
    }

    function exitVehicle() {
        sceneState.vehicleController.exit(sceneState.playerController.mesh);
        sceneState.playerController.setActive(true);
        sceneState.camera.lockedTarget = sceneState.playerController.mesh;
        applyCameraMode(sceneState.camera, getPedestrianCameraMode(sceneState.playerController.mesh));
        gameShell?.classList.remove("is-driving");
        updateMobileVehicleButton();
    }

    function exitMount() {
        sceneState.npcSystem.exitMount(sceneState.playerController.mesh);
        sceneState.playerController.setActive(true);
        sceneState.camera.lockedTarget = sceneState.playerController.mesh;
        applyCameraMode(sceneState.camera, getPedestrianCameraMode(sceneState.playerController.mesh));
        gameShell?.classList.remove("is-driving");
    }

    function useVehicleAction() {
        if (sceneState.vehicleController.active) {
            exitVehicle();
            return;
        }

        if (sceneState.npcSystem.activeMount) {
            exitMount();
            return;
        }

        if (sceneState.vehicleController.canEnter(sceneState.playerController.mesh)) {
            enterVehicle();
            return;
        }

        const availableMount = sceneState.npcSystem.findAvailableMount(sceneState.playerController.mesh);

        if (availableMount) {
            enterMount(availableMount);
        }
    }

    function updateMobileVehicleButton() {
        if (!mobileVehicleButton) {
            return;
        }

        const availableMount = sceneState.playerController.active
            ? sceneState.npcSystem.findAvailableMount(sceneState.playerController.mesh)
            : null;
        const canUseVehicle = sceneState.vehicleController.active
            || sceneState.npcSystem.activeMount
            || (
                sceneState.playerController.active
                && sceneState.vehicleController.canEnter(sceneState.playerController.mesh)
            )
            || Boolean(availableMount);

        mobileVehicleButton.classList.toggle("is-visible", canUseVehicle);
        mobileVehicleButton.textContent = sceneState.vehicleController.active || sceneState.npcSystem.activeMount
            ? "Exit"
            : availableMount
                ? "Ride"
                : "Enter";
    }

    function onKeyDown(event) {
        if (event.code !== "KeyE" || event.repeat) {
            return;
        }

        useVehicleAction();
    }

    function onMobileVehicleAction(event) {
        event.stopPropagation();
        useVehicleAction();
        event.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);
    mobileVehicleButton?.addEventListener("pointerdown", onMobileVehicleAction);

    const observer = sceneState.scene.onBeforeRenderObservable.add(updateMobileVehicleButton);

    return () => {
        window.removeEventListener("keydown", onKeyDown);
        mobileVehicleButton?.removeEventListener("pointerdown", onMobileVehicleAction);
        sceneState.scene.onBeforeRenderObservable.remove(observer);
    };
}

function createFlatGround(scene) {
    const groundMaterial = new BABYLON.StandardMaterial("flatGround", scene);
    groundMaterial.diffuseColor = new BABYLON.Color3(0.32, 0.41, 0.27);
    groundMaterial.specularColor = new BABYLON.Color3(0.025, 0.025, 0.02);

    const ground = BABYLON.MeshBuilder.CreateGround(
        "flatWorldPlane",
        {
            width: WORLD_SIZE,
            height: WORLD_SIZE,
            subdivisions: 12,
        },
        scene,
    );
    ground.material = groundMaterial;

    return ground;
}

function createRiverCorridor(scene) {
    const riverMaterial = makeMaterial(scene, "muckySantaAnaRiver", 0.39, 0.24, 0.11);
    riverMaterial.specularColor = new BABYLON.Color3(0.14, 0.1, 0.06);
    const sandMaterial = makeMaterial(scene, "riverSandbar", 0.68, 0.62, 0.47);
    const gravelMaterial = makeMaterial(scene, "dryWashGravel", 0.42, 0.39, 0.34);
    const trailMaterial = makeMaterial(scene, "singleTrackTrail", 0.5, 0.43, 0.31);
    const roadMaterial = makeMaterial(scene, "overworldAccessRoad", 0.1, 0.105, 0.1);
    const pieces = [];

    for (let i = 0; i < 21; i += 1) {
        const t = i / 20;
        const x = -86 + t * 172;
        const z = riverZ(x);
        const angle = riverAngle(x);
        const width = 12 + Math.sin(t * Math.PI * 4) * 2.5;

        pieces.push(addFlatBox(scene, "riverWater", { width: 11, depth: width }, [x, 0.045, z], angle, riverMaterial));
        pieces.push(addFlatBox(scene, "riverSandbarNorth", { width: 12, depth: 7 }, [x + 1.8, 0.055, z - width * 0.58], angle + 0.06, sandMaterial));
        pieces.push(addFlatBox(scene, "riverSandbarSouth", { width: 12, depth: 6 }, [x - 1.2, 0.052, z + width * 0.62], angle - 0.04, gravelMaterial));
    }

    for (const trail of [
        { name: "forestTrailStart", offset: -18, width: 5 },
        { name: "forestTrailSouth", offset: 24, width: 5 },
    ]) {
        for (let i = 0; i < 16; i += 1) {
            const t = i / 15;
            const x = -82 + t * 164;
            const z = riverZ(x) + trail.offset + Math.sin(t * 10) * 4;
            pieces.push(addFlatBox(scene, trail.name, { width: 11, depth: trail.width }, [x, 0.07, z], riverAngle(x) + Math.sin(t * 5) * 0.16, trailMaterial));
        }
    }

    pieces.push(addFlatBox(scene, "mazeExitTrail", { width: 92, depth: 5.5 }, [25, 0.09, 8], BABYLON.Tools.ToRadians(-12), trailMaterial));
    pieces.push(addFlatBox(scene, "overworldRoad", { width: 48, depth: 9 }, [70, 0.08, 20], BABYLON.Tools.ToRadians(18), roadMaterial));
    pieces.push(addFlatBox(scene, "cityThresholdRoad", { width: 36, depth: 7 }, [82, 0.085, 32], BABYLON.Tools.ToRadians(44), roadMaterial));

    return pieces;
}

function createRiparianVegetation(scene) {
    const trunkMaterial = makeMaterial(scene, "treeTrunk", 0.28, 0.17, 0.09);
    const leafMaterial = makeMaterial(scene, "cottonwoodLeaves", 0.18, 0.42, 0.17);
    const darkLeafMaterial = makeMaterial(scene, "willowLeaves", 0.12, 0.3, 0.12);
    const scrubMaterial = makeMaterial(scene, "sageScrub", 0.38, 0.48, 0.31);
    const reedMaterial = makeMaterial(scene, "riverReeds", 0.42, 0.5, 0.25);
    const rockMaterial = makeMaterial(scene, "riverBoulder", 0.32, 0.3, 0.27);
    const mudMaterial = makeMaterial(scene, "sinkingMud", 0.18, 0.11, 0.06);
    const blockers = [];

    const treeWallSpecs = [
        { name: "spawnNorthWall", start: [-18, -8], end: [34, -22], count: 18 },
        { name: "spawnSouthWall", start: [-20, 18], end: [18, 30], count: 16 },
        { name: "westWall", start: [-30, -26], end: [-34, 30], count: 16 },
        { name: "centerDivider", start: [-3, -6], end: [12, 17], count: 9 },
        { name: "mudApproachWall", start: [20, 1], end: [43, -15], count: 10 },
        { name: "exitNorthWall", start: [35, -24], end: [61, -11], count: 10 },
        { name: "exitSouthWall", start: [34, 25], end: [61, 13], count: 10 },
    ];

    for (const wall of treeWallSpecs) {
        createBrushWall(scene, wall, blockers, darkLeafMaterial, scrubMaterial);
    }

    for (const mud of [
        { name: "spawnMudPocket", x: 6, z: 9, width: 9, depth: 7 },
        { name: "forkMudSink", x: 24, z: 6, width: 11, depth: 8 },
        { name: "southMudSink", x: 33, z: 20, width: 13, depth: 7 },
        { name: "exitMudShelf", x: 51, z: 3, width: 11, depth: 9 },
    ]) {
        blockers.push(createMudBog(scene, mud, mudMaterial));
    }

    for (let i = 0; i < 46; i += 1) {
        const x = seededRange(i, -84, 84);
        const side = i % 2 === 0 ? -1 : 1;
        const z = riverZ(x) + side * seededRange(i + 100, 12, 34);

        if (Math.hypot(x, z) < 10 || (x > -26 && x < 62 && z > -28 && z < 32)) {
            continue;
        }

        blockers.push(createTree(scene, {
            name: `riparianTree${i}`,
            x,
            z,
            height: seededRange(i + 200, 4.2, 7.8),
            canopy: seededRange(i + 300, 2.2, 3.8),
            trunkMaterial,
            leafMaterial: i % 3 === 0 ? darkLeafMaterial : leafMaterial,
        }));
    }

    for (let i = 0; i < 120; i += 1) {
        const x = seededRange(i + 400, -88, 88);
        const z = riverZ(x) + seededRange(i + 500, -42, 42);
        const nearWater = Math.abs(z - riverZ(x)) < 16;
        createShrub(scene, {
            name: nearWater ? `riverReed${i}` : `sageScrub${i}`,
            x,
            z,
            scale: seededRange(i + 600, nearWater ? 0.45 : 0.75, nearWater ? 0.9 : 1.45),
            material: nearWater ? reedMaterial : scrubMaterial,
        });
    }

    for (let i = 0; i < 14; i += 1) {
        const x = seededRange(i + 700, -74, 74);
        const z = riverZ(x) + seededRange(i + 800, -10, 12);
        blockers.push(createBoulder(scene, `riverBoulder${i}`, x, z, seededRange(i + 900, 1.4, 2.9), rockMaterial));
    }

    return blockers;
}

function createTraversalCourse(scene) {
    const platformMaterial = makeMaterial(scene, "traversalPackedDirt", 0.43, 0.34, 0.2);
    const rampMaterial = makeMaterial(scene, "traversalRampDirt", 0.5, 0.41, 0.25);
    const chasmMaterial = makeMaterial(scene, "traversalChasm", 0.035, 0.032, 0.03);
    const edgeMaterial = makeMaterial(scene, "traversalEdge", 0.72, 0.62, 0.38);
    const platforms = [
        { minX: -44, maxX: -34, minZ: -10, maxZ: -3, height: 0.9 },
        { minX: -33, maxX: -22, minZ: -11, maxZ: -2, height: 2.15 },
        { minX: -30, maxX: -24, minZ: 2, maxZ: 11, height: 3.2 },
    ];
    const ramps = [
        { minX: -52, maxX: -44, minZ: -10, maxZ: -3, fromHeight: 0, toHeight: 0.9 },
        { minX: -38, maxX: -33, minZ: -11, maxZ: -2, fromHeight: 0.9, toHeight: 2.15 },
        { minX: -27, maxX: -24, minZ: -2, maxZ: 2, fromHeight: 2.15, toHeight: 3.2, axis: "z" },
    ];
    const hazards = [
        { minX: -34, maxX: -20, minZ: -1.8, maxZ: 1.9 },
        { minX: -23.8, maxX: -19, minZ: 1.9, maxZ: 12 },
    ];
    const respawnPoint = new BABYLON.Vector3(-49, 1, -6.5);

    for (const platform of platforms) {
        addRaisedBox(scene, "traversalPlatform", platform, platformMaterial);
    }

    for (const ramp of ramps) {
        addRamp(scene, ramp, rampMaterial);
    }

    for (const hazard of hazards) {
        addHazard(scene, hazard, chasmMaterial, edgeMaterial);
    }

    return {
        getHeightAt(position) {
            for (const ramp of ramps) {
                if (!pointInRect(position, ramp)) {
                    continue;
                }

                const progress = ramp.axis === "z"
                    ? (position.z - ramp.minZ) / (ramp.maxZ - ramp.minZ)
                    : (position.x - ramp.minX) / (ramp.maxX - ramp.minX);
                return ramp.fromHeight + (ramp.toHeight - ramp.fromHeight) * clamp(progress, 0, 1);
            }

            for (const platform of platforms) {
                if (pointInRect(position, platform)) {
                    return platform.height;
                }
            }

            return 0;
        },
        getRespawnPointIfHazard(position) {
            for (const hazard of hazards) {
                if (pointInRect(position, hazard)) {
                    return respawnPoint.clone();
                }
            }

            return null;
        },
    };
}

function addRaisedBox(scene, name, spec, material) {
    const height = spec.height;
    const box = BABYLON.MeshBuilder.CreateBox(name, {
        width: spec.maxX - spec.minX,
        height,
        depth: spec.maxZ - spec.minZ,
    }, scene);
    box.position.set((spec.minX + spec.maxX) / 2, height / 2, (spec.minZ + spec.maxZ) / 2);
    box.material = material;
    return box;
}

function addRamp(scene, spec, material) {
    const box = BABYLON.MeshBuilder.CreateBox("traversalRamp", {
        width: spec.maxX - spec.minX,
        height: 0.18,
        depth: spec.maxZ - spec.minZ,
    }, scene);
    box.position.set(
        (spec.minX + spec.maxX) / 2,
        (spec.fromHeight + spec.toHeight) / 2,
        (spec.minZ + spec.maxZ) / 2,
    );
    box.rotation.z = spec.axis === "z" ? 0 : -Math.atan2(spec.toHeight - spec.fromHeight, spec.maxX - spec.minX);
    box.rotation.x = spec.axis === "z" ? Math.atan2(spec.toHeight - spec.fromHeight, spec.maxZ - spec.minZ) : 0;
    box.material = material;
    return box;
}

function addHazard(scene, spec, chasmMaterial, edgeMaterial) {
    addFlatBox(scene, "traversalChasm", {
        width: spec.maxX - spec.minX,
        depth: spec.maxZ - spec.minZ,
    }, [(spec.minX + spec.maxX) / 2, 0.03, (spec.minZ + spec.maxZ) / 2], 0, chasmMaterial);

    addFlatBox(scene, "traversalChasmEdge", { width: spec.maxX - spec.minX, depth: 0.28 }, [(spec.minX + spec.maxX) / 2, 0.08, spec.minZ], 0, edgeMaterial);
    addFlatBox(scene, "traversalChasmEdge", { width: spec.maxX - spec.minX, depth: 0.28 }, [(spec.minX + spec.maxX) / 2, 0.08, spec.maxZ], 0, edgeMaterial);
}

function pointInRect(position, rect) {
    return position.x >= rect.minX
        && position.x <= rect.maxX
        && position.z >= rect.minZ
        && position.z <= rect.maxZ;
}

function createBrushWall(scene, wall, blockers, leafMaterial, scrubMaterial) {
    for (let i = 0; i < wall.count; i += 1) {
        const t = wall.count === 1 ? 0 : i / (wall.count - 1);
        const jitterX = seededRange(i + wall.name.length * 10, -1.4, 1.4);
        const jitterZ = seededRange(i + wall.name.length * 20, -1.4, 1.4);
        const x = wall.start[0] + (wall.end[0] - wall.start[0]) * t + jitterX;
        const z = wall.start[1] + (wall.end[1] - wall.start[1]) * t + jitterZ;

        blockers.push(createBrushClump(scene, {
            name: `${wall.name}Tree${i}`,
            x,
            z,
            width: seededRange(i + wall.name.length * 30, 6.8, 9.2),
            leafMaterial,
            scrubMaterial,
        }));
    }
}

function createBrushClump(scene, spec) {
    const root = new BABYLON.TransformNode(spec.name, scene);
    root.position.set(spec.x, 0, spec.z);

    for (let i = 0; i < 6; i += 1) {
        const brush = BABYLON.MeshBuilder.CreateSphere(`${spec.name}Brush${i}`, {
            diameter: spec.width * (i < 2 ? 1 : 0.74),
            segments: 8,
        }, scene);
        brush.parent = root;
        brush.position.set(
            Math.cos(i * 1.7) * spec.width * 0.18,
            2.3 + (i % 3) * 1.05,
            Math.sin(i * 1.7) * spec.width * 0.18,
        );
        brush.scaling.y = 0.92;
        brush.material = i === 0 ? spec.leafMaterial : spec.scrubMaterial;
        brush.checkCollisions = true;
    }

    root.size = {
        width: spec.width * 1.12,
        depth: spec.width * 1.12,
    };
    return root;
}

function createMudBog(scene, spec, material) {
    const bog = addFlatBox(scene, spec.name, {
        width: spec.width,
        depth: spec.depth,
    }, [spec.x, 0.11, spec.z], seededRange(spec.x + spec.z, -0.28, 0.28), material);
    bog.scaling.y = 0.55;
    bog.size = {
        width: spec.width,
        depth: spec.depth,
    };
    return bog;
}

function createTree(scene, spec) {
    const root = new BABYLON.TransformNode(spec.name, scene);
    root.position.set(spec.x, 0, spec.z);

    const trunk = BABYLON.MeshBuilder.CreateCylinder(`${spec.name}Trunk`, {
        diameterTop: 0.38,
        diameterBottom: 0.62,
        height: spec.height,
        tessellation: 8,
    }, scene);
    trunk.parent = root;
    trunk.position.y = spec.height / 2;
    trunk.material = spec.trunkMaterial;

    for (let i = 0; i < 3; i += 1) {
        const canopy = BABYLON.MeshBuilder.CreateSphere(`${spec.name}Canopy${i}`, {
            diameter: spec.canopy * (i === 0 ? 1 : 0.82),
            segments: 10,
        }, scene);
        canopy.parent = root;
        canopy.position.set((i - 1) * spec.canopy * 0.32, spec.height + i * 0.35, Math.sin(i * 2.1) * spec.canopy * 0.28);
        canopy.scaling.y = 0.74;
        canopy.material = spec.leafMaterial;
    }

    root.size = {
        width: spec.canopy * 0.82,
        depth: spec.canopy * 0.82,
    };
    return root;
}

function createShrub(scene, spec) {
    const shrub = BABYLON.MeshBuilder.CreateSphere(spec.name, {
        diameter: spec.scale,
        segments: 7,
    }, scene);
    shrub.position.set(spec.x, spec.scale * 0.34, spec.z);
    shrub.scaling.y = 0.55;
    shrub.material = spec.material;
    return shrub;
}

function createBoulder(scene, name, x, z, scale, material) {
    const boulder = BABYLON.MeshBuilder.CreateSphere(name, {
        diameter: scale,
        segments: 8,
    }, scene);
    boulder.position.set(x, scale * 0.28, z);
    boulder.scaling.set(1.25, 0.52, 0.86);
    boulder.rotation.y = seededRange(scale * 1000, 0, Math.PI);
    boulder.material = material;
    boulder.checkCollisions = true;
    boulder.size = {
        width: scale * 1.25,
        depth: scale * 0.86,
    };
    return boulder;
}

function addFlatBox(scene, name, size, position, rotationY, material) {
    const box = BABYLON.MeshBuilder.CreateBox(name, {
        width: size.width,
        height: 0.05,
        depth: size.depth,
    }, scene);
    box.position.set(position[0], position[1], position[2]);
    box.rotation.y = rotationY;
    box.material = material;
    return box;
}

function riverZ(x) {
    return Math.sin(x * 0.055) * 13 + Math.sin(x * 0.12 + 1.7) * 5;
}

function riverAngle(x) {
    const dz = riverZ(x + 1) - riverZ(x - 1);
    return Math.atan2(2, dz);
}

function seededRange(seed, min, max) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return min + (value - Math.floor(value)) * (max - min);
}

function makeMaterial(scene, name, r, g, b) {
    const material = new BABYLON.StandardMaterial(name, scene);
    material.diffuseColor = new BABYLON.Color3(r, g, b);
    material.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04);
    return material;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
