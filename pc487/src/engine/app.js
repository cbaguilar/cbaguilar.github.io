import { createPlayerController } from "./player.js";
import { createVehicleController } from "./vehicle.js";

const WORLD_SIZE = 180;

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
        28,
        new BABYLON.Vector3(0, 1, 0),
        scene,
    );
    camera.lowerRadiusLimit = 12;
    camera.upperRadiusLimit = 48;
    camera.lowerBetaLimit = BABYLON.Tools.ToRadians(35);
    camera.upperBetaLimit = BABYLON.Tools.ToRadians(82);
    camera.wheelDeltaPercentage = 0.01;
    camera.panningSensibility = 70;
    camera.attachControl(canvas, true);
    camera.inputs.remove(camera.inputs.attached.keyboard);

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
        dispose: null,
        roads: [],
        buildings: [],
    };

    createFlatGround(scene);
    sceneState.roads = createRoadGrid(scene);
    sceneState.buildings = createBlockoutBuildings(scene);
    sceneState.playerController = createPlayerController({ scene, camera });
    sceneState.vehicleController = createVehicleController({ scene });
    camera.lockedTarget = sceneState.playerController.mesh;
    sceneState.dispose = createInteractionController(sceneState);

    return sceneState;
}

function createInteractionController(sceneState) {
    function onKeyDown(event) {
        if (event.code !== "KeyE" || event.repeat) {
            return;
        }

        if (sceneState.vehicleController.active) {
            sceneState.vehicleController.exit(sceneState.playerController.mesh);
            sceneState.playerController.setActive(true);
            sceneState.camera.lockedTarget = sceneState.playerController.mesh;
            sceneState.camera.radius = 28;
            return;
        }

        if (sceneState.vehicleController.canEnter(sceneState.playerController.mesh)) {
            sceneState.playerController.setActive(false);
            sceneState.vehicleController.enter();
            sceneState.camera.lockedTarget = sceneState.vehicleController.mesh;
            sceneState.camera.radius = 34;
        }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
        window.removeEventListener("keydown", onKeyDown);
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
