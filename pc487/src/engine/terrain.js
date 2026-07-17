const TERRAIN_SIZE = 180;
const TERRAIN_SEGMENTS = 128;
const HEIGHT_SCALE = 18;

export const TERRAIN_PRESETS = [
    {
        id: "cajon-ridges",
        shortLabel: "A",
        source: "34_235_-117_492_13_505_505_16bit.png",
    },
    {
        id: "foothill-basin",
        shortLabel: "B",
        source: "34_044_-117_414_10_505_505_16bit.png",
    },
];

export function createHeightmapTerrain(scene, terrainId = TERRAIN_PRESETS[0].id) {
    const positions = [];
    const indices = [];
    const normals = [];
    const colors = [];
    const halfSize = TERRAIN_SIZE / 2;
    const stride = TERRAIN_SEGMENTS + 1;

    for (let zIndex = 0; zIndex <= TERRAIN_SEGMENTS; zIndex += 1) {
        const zRatio = zIndex / TERRAIN_SEGMENTS;
        const z = zRatio * TERRAIN_SIZE - halfSize;

        for (let xIndex = 0; xIndex <= TERRAIN_SEGMENTS; xIndex += 1) {
            const xRatio = xIndex / TERRAIN_SEGMENTS;
            const x = xRatio * TERRAIN_SIZE - halfSize;
            const sample = sampleTerrainPreset(terrainId, xRatio, zRatio);

            positions.push(x, sample.height * HEIGHT_SCALE, z);
            colors.push(sample.color.r, sample.color.g, sample.color.b, 1);
        }
    }

    for (let zIndex = 0; zIndex < TERRAIN_SEGMENTS; zIndex += 1) {
        for (let xIndex = 0; xIndex < TERRAIN_SEGMENTS; xIndex += 1) {
            const topLeft = zIndex * stride + xIndex;
            const topRight = topLeft + 1;
            const bottomLeft = topLeft + stride;
            const bottomRight = bottomLeft + 1;

            indices.push(topLeft, topRight, bottomLeft);
            indices.push(topRight, bottomRight, bottomLeft);
        }
    }

    BABYLON.VertexData.ComputeNormals(positions, indices, normals);

    const mesh = new BABYLON.Mesh(`proceduralHeightmapTerrain:${terrainId}`, scene);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;
    vertexData.applyToMesh(mesh);

    const material = new BABYLON.StandardMaterial("heightmapTerrainMaterial", scene);
    material.diffuseColor = new BABYLON.Color3(0.78, 0.72, 0.58);
    material.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    material.backFaceCulling = false;
    material.useVertexColor = true;
    mesh.material = material;
    mesh.receiveShadows = true;

    return mesh;
}

export function getTerrainHeightAtWorld(x, z, terrainId = TERRAIN_PRESETS[0].id) {
    const xRatio = x / TERRAIN_SIZE + 0.5;
    const zRatio = z / TERRAIN_SIZE + 0.5;
    return sampleTerrainPreset(terrainId, xRatio, zRatio).height * HEIGHT_SCALE;
}

function sampleTerrainPreset(terrainId, xRatio, zRatio) {
    if (terrainId === "foothill-basin") {
        return sampleFoothillBasinTerrain(xRatio, zRatio);
    }

    return sampleCajonRidgesTerrain(xRatio, zRatio);
}

// Approximation of 34_235_-117_492_13_505_505_16bit.png.
function sampleCajonRidgesTerrain(xRatio, zRatio) {
    const x = xRatio * 2 - 1;
    const z = zRatio * 2 - 1;

    const southwestRise = 0.62 - x * 0.26 + z * 0.22;
    const northeastBasin = valleyFalloff(x, z, 0.42, -0.24, -0.22, 0.92, 0.22) * 0.52;
    const centralDrainage = valleyFalloff(x, z, -0.55, 0.26, 0.36, -0.68, 0.17) * 0.38;
    const rightEdgeCut = valleyFalloff(x, z, 0.76, -0.88, 0.64, 0.82, 0.2) * 0.34;

    const ridgeField =
        ridgedNoise(x * 5.4 + z * 1.1, z * 5.7 - x * 0.9) * 0.2 +
        ridgedNoise(x * 11.2 - 1.7, z * 10.4 + 0.8) * 0.08 +
        ridgedNoise(x * 22.0 + z * 2.5, z * 21.0 - x * 1.3) * 0.035;

    const alluvialSoftening = smoothstep(-0.9, 0.5, z - x * 0.18) * 0.06;
    const height = softenTileEdge(clamp(
        southwestRise + ridgeField - northeastBasin - centralDrainage - rightEdgeCut - alluvialSoftening,
        0,
        1,
    ), xRatio, zRatio);

    return {
        height,
        color: terrainColor(height),
    };
}

// Approximation of 34_044_-117_414_10_505_505_16bit.png:
// a high, dissected mountain front in the northwest falling into a broad basin.
function sampleFoothillBasinTerrain(xRatio, zRatio) {
    const x = xRatio * 2 - 1;
    const z = zRatio * 2 - 1;

    const mountainFront = 1 - smoothstep(-0.46, 0.2, z + x * 0.2);
    const westHighlands = 1 - smoothstep(-0.9, 0.45, x);
    const basin = smoothstep(-0.16, 0.72, z + x * 0.12);
    const mainWash = valleyFalloff(x, z, -0.96, -0.2, 0.28, 0.12, 0.19) * 0.42;
    const southernWash = valleyFalloff(x, z, -0.74, 0.5, 0.52, 0.34, 0.22) * 0.25;

    const ridgeField =
        ridgedNoise(x * 7.8 - z * 1.8, z * 7.1 + 0.6) * mountainFront * 0.26 +
        ridgedNoise(x * 15.6 + 2.1, z * 14.3 - x * 0.8) * mountainFront * 0.11 +
        ridgedNoise(x * 28.0 - z * 2.1, z * 26.0 + 1.4) * mountainFront * 0.045;

    const height = softenTileEdge(clamp(
        0.18 +
            mountainFront * 0.58 +
            westHighlands * 0.16 +
            ridgeField -
            basin * 0.18 -
            mainWash -
            southernWash,
        0,
        1,
    ), xRatio, zRatio);

    return {
        height,
        color: terrainColor(height),
    };
}

function valleyFalloff(x, z, ax, az, bx, bz, width) {
    const distance = distanceToSegment(x, z, ax, az, bx, bz);
    return 1 - smoothstep(width * 0.35, width, distance);
}

function distanceToSegment(px, pz, ax, az, bx, bz) {
    const abx = bx - ax;
    const abz = bz - az;
    const apx = px - ax;
    const apz = pz - az;
    const denominator = abx * abx + abz * abz;
    const t = denominator === 0 ? 0 : clamp((apx * abx + apz * abz) / denominator, 0, 1);
    const closestX = ax + abx * t;
    const closestZ = az + abz * t;
    return Math.hypot(px - closestX, pz - closestZ);
}

function ridgedNoise(x, z) {
    const value =
        Math.sin(x * 1.73 + Math.cos(z * 0.61) * 1.5) *
        Math.cos(z * 1.91 + Math.sin(x * 0.47) * 1.4);
    return Math.pow(1 - Math.abs(value), 2.2);
}

function terrainColor(height) {
    const low = new BABYLON.Color3(0.34, 0.31, 0.25);
    const mid = new BABYLON.Color3(0.55, 0.49, 0.37);
    const high = new BABYLON.Color3(0.78, 0.74, 0.66);

    if (height < 0.45) {
        return BABYLON.Color3.Lerp(low, mid, smoothstep(0.08, 0.45, height));
    }

    return BABYLON.Color3.Lerp(mid, high, smoothstep(0.45, 1, height));
}

function softenTileEdge(height, xRatio, zRatio) {
    const edgeDistance = Math.min(xRatio, 1 - xRatio, zRatio, 1 - zRatio);
    const edgeBlend = smoothstep(0, 0.12, edgeDistance);
    const lowEdge = 0.12;
    return lowEdge + (height - lowEdge) * edgeBlend;
}

function smoothstep(edge0, edge1, value) {
    const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return x * x * (3 - 2 * x);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
