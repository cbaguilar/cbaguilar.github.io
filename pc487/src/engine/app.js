import { createCombatSystem } from "./combat.js";
import { createAudioSystem } from "./audio.js";
import { createCollisionWorld } from "./collision.js";
import { createItemSystem } from "./items.js";
import { createNpcSystem } from "./npcs.js";
import { createPlayerController } from "./player.js";
import { createVehicleController } from "./vehicle.js";
import { createVehicleImpactSystem } from "./vehicleImpacts.js";

const WORLD_SIZE = 180;
const CAMERA_MODES = {
    pedestrian: {
        radius: 14,
        lowerRadiusLimit: 9,
        upperRadiusLimit: 20,
    },
    vehicle: {
        radius: 34,
        lowerRadiusLimit: 18,
        upperRadiusLimit: 52,
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

    function dispose() {
        window.removeEventListener("resize", resize);
        sceneState.dispose();
        sceneState.combatSystem.dispose();
        sceneState.vehicleImpactSystem.dispose();
        sceneState.vehicleAudioController.dispose();
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
        start,
        toggleDebugLayer,
        dispose,
    };
}

function createScene(engine, canvas) {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.56, 0.72, 0.87, 1);

    const camera = new BABYLON.ArcRotateCamera(
        "followCamera",
        BABYLON.Tools.ToRadians(45),
        BABYLON.Tools.ToRadians(68),
        CAMERA_MODES.pedestrian.radius,
        new BABYLON.Vector3(0, 1, 0),
        scene,
    );
    applyCameraMode(camera, "pedestrian");
    camera.lowerBetaLimit = BABYLON.Tools.ToRadians(35);
    camera.upperBetaLimit = BABYLON.Tools.ToRadians(82);
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
        vehicleImpactSystem: null,
        vehicleAudioController: null,
        collisionWorld: null,
        dispose: null,
        roads: [],
        buildings: [],
    };

    createFlatGround(scene);
    sceneState.roads = createRoadGrid(scene);
    sceneState.buildings = createBlockoutBuildings(scene);
    sceneState.collisionWorld = createCollisionWorld(sceneState.buildings);
    sceneState.audioSystem = createAudioSystem();
    sceneState.playerController = createPlayerController({ scene, camera, collisionWorld: sceneState.collisionWorld });
    sceneState.vehicleController = createVehicleController({ scene, collisionWorld: sceneState.collisionWorld });
    sceneState.npcSystem = createNpcSystem({ scene, collisionWorld: sceneState.collisionWorld });
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
    sceneState.dispose = createInteractionController(sceneState);

    return sceneState;
}

function configureCameraPointerControls(camera, canvas) {
    const pointerInput = camera.inputs.attached.pointers;

    if (pointerInput) {
        camera.inputs.remove(pointerInput);
    }

    let dragging = false;
    let pointerId = null;
    let lastX = 0;
    let lastY = 0;

    canvas.addEventListener("pointerdown", (event) => {
        if (event.button !== 2) {
            return;
        }

        event.preventDefault();
        dragging = true;
        pointerId = event.pointerId;
        lastX = event.clientX;
        lastY = event.clientY;
        canvas.setPointerCapture(pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
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
    });

    function stopDrag(event) {
        if (!dragging || event.pointerId !== pointerId) {
            return;
        }

        dragging = false;
        canvas.releasePointerCapture(pointerId);
        pointerId = null;
    }

    canvas.addEventListener("pointerup", stopDrag);
    canvas.addEventListener("pointercancel", stopDrag);
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
    const mode = CAMERA_MODES[modeName];
    camera.lowerRadiusLimit = mode.lowerRadiusLimit;
    camera.upperRadiusLimit = mode.upperRadiusLimit;
    camera.radius = clamp(camera.radius, mode.lowerRadiusLimit, mode.upperRadiusLimit);

    if (camera.radius !== mode.radius) {
        camera.radius = mode.radius;
    }
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

    function exitVehicle() {
        sceneState.vehicleController.exit(sceneState.playerController.mesh);
        sceneState.playerController.setActive(true);
        sceneState.camera.lockedTarget = sceneState.playerController.mesh;
        applyCameraMode(sceneState.camera, "pedestrian");
        gameShell?.classList.remove("is-driving");
    }

    function useVehicleAction() {
        if (sceneState.vehicleController.active) {
            exitVehicle();
            return;
        }

        if (sceneState.vehicleController.canEnter(sceneState.playerController.mesh)) {
            enterVehicle();
        }
    }

    function updateMobileVehicleButton() {
        if (!mobileVehicleButton) {
            return;
        }

        const canUseVehicle = sceneState.vehicleController.active
            || (
                sceneState.playerController.active
                && sceneState.vehicleController.canEnter(sceneState.playerController.mesh)
            );

        mobileVehicleButton.classList.toggle("is-visible", canUseVehicle);
        mobileVehicleButton.textContent = sceneState.vehicleController.active ? "Exit" : "Enter";
    }

    function onKeyDown(event) {
        if (event.code !== "KeyE" || event.repeat) {
            return;
        }

        useVehicleAction();
    }

    function onMobileVehicleAction(event) {
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
    groundMaterial.diffuseColor = new BABYLON.Color3(0.44, 0.49, 0.43);
    groundMaterial.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04);

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

function createRoadGrid(scene) {
    const roadMaterial = new BABYLON.StandardMaterial("asphalt", scene);
    roadMaterial.diffuseColor = new BABYLON.Color3(0.08, 0.085, 0.08);
    roadMaterial.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);

    const roadSpecs = [
        { name: "eastWestArterial", width: 92, depth: 7, x: 0, z: 0 },
        { name: "northSouthArterial", width: 7, depth: 92, x: 0, z: 0 },
        { name: "warehouseCutoff", width: 54, depth: 5, x: 18, z: -26 },
        { name: "foothillConnector", width: 5, depth: 58, x: -30, z: 17 },
    ];

    const roads = [];

    for (const spec of roadSpecs) {
        const road = BABYLON.MeshBuilder.CreateBox(
            spec.name,
            {
                width: spec.width,
                height: 0.04,
                depth: spec.depth,
            },
            scene,
        );
        road.position.set(spec.x, 0.03, spec.z);
        road.material = roadMaterial;
        roads.push(road);
    }

    return roads;
}

function createBlockoutBuildings(scene) {
    const materials = [
        makeMaterial(scene, "warehouseConcrete", 0.62, 0.58, 0.51),
        makeMaterial(scene, "civicBrick", 0.54, 0.25, 0.19),
        makeMaterial(scene, "suburbanStucco", 0.74, 0.67, 0.55),
    ];

    const buildings = [
        { name: "warehouseA", x: 18, z: -38, width: 16, height: 5, depth: 10, material: 0 },
        { name: "warehouseB", x: 40, z: -31, width: 14, height: 4, depth: 14, material: 0 },
        { name: "civicBlockA", x: -18, z: 18, width: 9, height: 13, depth: 9, material: 1 },
        { name: "civicBlockB", x: -7, z: 25, width: 8, height: 8, depth: 10, material: 1 },
        { name: "suburbA", x: -38, z: -12, width: 8, height: 3, depth: 7, material: 2 },
        { name: "suburbB", x: -48, z: -21, width: 7, height: 3, depth: 7, material: 2 },
    ];

    const meshes = [];

    for (const spec of buildings) {
        const building = BABYLON.MeshBuilder.CreateBox(
            spec.name,
            {
                width: spec.width,
                height: spec.height,
                depth: spec.depth,
            },
            scene,
        );
        building.position.set(spec.x, spec.height / 2, spec.z);
        building.material = materials[spec.material];
        building.size = {
            width: spec.width,
            depth: spec.depth,
        };
        meshes.push(building);
    }

    return meshes;
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
