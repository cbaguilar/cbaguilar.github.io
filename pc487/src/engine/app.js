import {
    TERRAIN_PRESETS,
    createHeightmapTerrain,
    getTerrainHeightAtWorld,
} from "./terrain.js";

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
        scene.dispose();
        engine.dispose();
    }

    function toggleTerrainPreset() {
        const currentIndex = TERRAIN_PRESETS.findIndex((preset) => preset.id === sceneState.terrainId);
        const nextIndex = (currentIndex + 1) % TERRAIN_PRESETS.length;
        setTerrainPreset(sceneState, TERRAIN_PRESETS[nextIndex].id);

        return {
            active: TERRAIN_PRESETS[nextIndex],
            nextLabel: `Terrain ${TERRAIN_PRESETS[(nextIndex + 1) % TERRAIN_PRESETS.length].shortLabel}`,
        };
    }

    return {
        canvas,
        engine,
        scene,
        start,
        toggleTerrainPreset,
        toggleDebugLayer,
        dispose,
    };
}

function createScene(engine, canvas) {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.56, 0.72, 0.87, 1);

    const camera = new BABYLON.ArcRotateCamera(
        "debugCamera",
        BABYLON.Tools.ToRadians(45),
        BABYLON.Tools.ToRadians(62),
        52,
        new BABYLON.Vector3(0, 4, 0),
        scene,
    );
    camera.lowerRadiusLimit = 10;
    camera.upperRadiusLimit = 120;
    camera.wheelDeltaPercentage = 0.01;
    camera.panningSensibility = 70;
    camera.attachControl(canvas, true);

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
        terrainId: TERRAIN_PRESETS[0].id,
        terrainMesh: null,
        playerMarker: null,
        roads: [],
        buildings: [],
    };

    sceneState.terrainMesh = createHeightmapTerrain(scene, sceneState.terrainId);

    const playerMarker = createPlayerMarker(scene);
    sceneState.playerMarker = playerMarker;

    sceneState.roads = createRoadGrid(scene);
    sceneState.buildings = createBlockoutBuildings(scene);
    placeWorldObjects(sceneState);

    return sceneState;
}

function setTerrainPreset(sceneState, terrainId) {
    sceneState.terrainId = terrainId;
    sceneState.terrainMesh.dispose(false, true);
    sceneState.terrainMesh = createHeightmapTerrain(sceneState.scene, terrainId);
    placeWorldObjects(sceneState);
}

function placeWorldObjects(sceneState) {
    sceneState.playerMarker.position.y = getTerrainHeightAtWorld(0, 0, sceneState.terrainId) + 1;

    for (const road of sceneState.roads) {
        road.position.y = getTerrainHeightAtWorld(road.position.x, road.position.z, sceneState.terrainId) + 0.08;
    }

    for (const building of sceneState.buildings) {
        building.position.y =
            getTerrainHeightAtWorld(building.position.x, building.position.z, sceneState.terrainId) +
            building.metadata.pc487Height / 2;
    }
}

function createPlayerMarker(scene) {
    const bodyMaterial = new BABYLON.StandardMaterial("playerMarkerBlue", scene);
    bodyMaterial.diffuseColor = new BABYLON.Color3(0.14, 0.28, 0.74);

    const marker = BABYLON.MeshBuilder.CreateBox(
        "futurePlayerBlock",
        {
            width: 1.4,
            height: 2,
            depth: 1.4,
        },
        scene,
    );
    marker.material = bodyMaterial;

    return marker;
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
        road.position.set(spec.x, 0, spec.z);
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
        building.position.set(spec.x, 0, spec.z);
        building.metadata = {
            pc487Height: spec.height,
        };
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
