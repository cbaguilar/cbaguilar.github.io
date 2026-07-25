import { createEquippedGunMesh } from "./items.js";

const PLAYER_HEIGHT = 2;
const PLAYER_HALF_HEIGHT = PLAYER_HEIGHT / 2;
const WORLD_LIMIT = 86;
const PLAYER_MODEL_PATH = "assets/models/";
const PLAYER_MODEL_FILE = "player.glb";
const WALK_CYCLE_SPEED = 9;

export function createPlayerController({ scene, camera }) {
    const mesh = createPlayerMesh(scene);
    const input = createInputState();
    const movement = new BABYLON.Vector3();
    const desiredDirection = new BABYLON.Vector3();
    let active = true;

    mesh.position.set(0, PLAYER_HALF_HEIGHT, 0);
    loadPlayerModel(scene, mesh);

    const observer = scene.onBeforeRenderObservable.add(() => {
        const deltaSeconds = scene.getEngine().getDeltaTime() / 1000;
        updatePlayer({ mesh, camera, input, movement, desiredDirection, active, deltaSeconds });
    });

    return {
        mesh,
        get active() {
            return active;
        },
        equipItem(itemId) {
            equipItem({ scene, playerModel: mesh.metadata, itemId });
        },
        setActive(nextActive) {
            active = nextActive;
            mesh.setEnabled(nextActive);
            movement.copyFromFloats(0, 0, 0);
        },
        dispose() {
            scene.onBeforeRenderObservable.remove(observer);
            input.dispose();
            mesh.dispose(false, true);
        },
    };
}

async function loadPlayerModel(scene, proxyMesh) {
    if (!BABYLON.SceneLoader) {
        console.warn("BabylonJS loader plugin is unavailable; using block humanoid.");
        return;
    }

    if (!(await optionalModelExists())) {
        console.info(`Optional player model not found at ${PLAYER_MODEL_PATH}${PLAYER_MODEL_FILE}; using block humanoid.`);
        return;
    }

    try {
        const result = await BABYLON.SceneLoader.ImportMeshAsync(
            "",
            PLAYER_MODEL_PATH,
            PLAYER_MODEL_FILE,
            scene,
        );

        if (result.meshes.length === 0) {
            return;
        }

        const modelRoot = new BABYLON.TransformNode("playerModelRoot", scene);
        modelRoot.parent = proxyMesh;
        modelRoot.position.set(0, -PLAYER_HALF_HEIGHT, 0);
        modelRoot.rotation.y = Math.PI;
        modelRoot.scaling.setAll(1);

        for (const importedMesh of result.meshes) {
            if (importedMesh.parent === null) {
                importedMesh.parent = modelRoot;
            }
        }

        proxyMesh.metadata.fallbackModel.setEnabled(false);
    } catch (error) {
        console.warn("Failed to import optional player model; using block humanoid.", error);
    }
}

async function optionalModelExists() {
    try {
        const response = await fetch(`${PLAYER_MODEL_PATH}${PLAYER_MODEL_FILE}`, {
            method: "HEAD",
        });
        return response.ok;
    } catch {
        return false;
    }
}

function createPlayerMesh(scene) {
    const mesh = BABYLON.MeshBuilder.CreateBox(
        "playerProxy",
        {
            width: 0.95,
            height: PLAYER_HEIGHT,
            depth: 0.75,
        },
        scene,
    );
    mesh.visibility = 0;
    mesh.metadata = createBlockHumanoid(scene, mesh);

    return mesh;
}

function createBlockHumanoid(scene, parent) {
    const skin = makeMaterial(scene, "playerSkin", 0.78, 0.58, 0.42);
    const shirt = makeMaterial(scene, "playerShirt", 0.13, 0.3, 0.72);
    const pants = makeMaterial(scene, "playerPants", 0.12, 0.13, 0.16);
    const shoes = makeMaterial(scene, "playerShoes", 0.035, 0.035, 0.04);
    const hair = makeMaterial(scene, "playerHair", 0.08, 0.045, 0.025);

    const fallbackModel = new BABYLON.TransformNode("playerBlockHumanoid", scene);
    fallbackModel.parent = parent;
    fallbackModel.position.y = -PLAYER_HALF_HEIGHT;

    const torso = addBodyBox(scene, fallbackModel, "playerTorso", { width: 0.82, height: 0.85, depth: 0.42 }, [0, 1.1, 0], shirt);
    addBodyBox(scene, fallbackModel, "playerNeck", { width: 0.28, height: 0.16, depth: 0.24 }, [0, 1.6, 0], skin);
    addBodyBox(scene, fallbackModel, "playerHead", { width: 0.56, height: 0.56, depth: 0.5 }, [0, 1.95, 0], skin);
    addBodyBox(scene, fallbackModel, "playerHair", { width: 0.6, height: 0.16, depth: 0.54 }, [0, 2.27, -0.02], hair);

    const leftArm = createLimb(scene, fallbackModel, "playerLeftArm", [-0.62, 1.16, 0], shirt, skin);
    const rightArm = createLimb(scene, fallbackModel, "playerRightArm", [0.62, 1.16, 0], shirt, skin);
    const leftLeg = createLeg(scene, fallbackModel, "playerLeftLeg", [-0.22, 0.38, 0], pants, shoes);
    const rightLeg = createLeg(scene, fallbackModel, "playerRightLeg", [0.22, 0.38, 0], pants, shoes);
    const rightHandSocket = new BABYLON.TransformNode("playerRightHandSocket", scene);
    rightHandSocket.parent = rightArm;
    rightHandSocket.position.set(0, -0.74, 0.16);

    return {
        fallbackModel,
        torso,
        leftArm,
        rightArm,
        leftLeg,
        rightLeg,
        rightHandSocket,
        equippedMesh: null,
        walkTime: 0,
    };
}

function createLimb(scene, parent, name, position, sleeveMaterial, handMaterial) {
    const limbRoot = new BABYLON.TransformNode(name, scene);
    limbRoot.parent = parent;
    limbRoot.position.set(position[0], position[1], position[2]);

    addBodyBox(scene, limbRoot, `${name}Sleeve`, { width: 0.26, height: 0.58, depth: 0.28 }, [0, -0.18, 0], sleeveMaterial);
    addBodyBox(scene, limbRoot, `${name}Hand`, { width: 0.25, height: 0.24, depth: 0.26 }, [0, -0.6, 0], handMaterial);

    return limbRoot;
}

function createLeg(scene, parent, name, position, pantsMaterial, shoeMaterial) {
    const legRoot = new BABYLON.TransformNode(name, scene);
    legRoot.parent = parent;
    legRoot.position.set(position[0], position[1], position[2]);

    addBodyBox(scene, legRoot, `${name}Pants`, { width: 0.31, height: 0.68, depth: 0.34 }, [0, -0.08, 0], pantsMaterial);
    addBodyBox(scene, legRoot, `${name}Shoe`, { width: 0.34, height: 0.18, depth: 0.48 }, [0, -0.5, 0.06], shoeMaterial);

    return legRoot;
}

function addBodyBox(scene, parent, name, size, position, material) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
    mesh.parent = parent;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.material = material;
    return mesh;
}

function makeMaterial(scene, name, r, g, b) {
    const material = new BABYLON.StandardMaterial(name, scene);
    material.diffuseColor = new BABYLON.Color3(r, g, b);
    material.specularColor = new BABYLON.Color3(0.025, 0.025, 0.025);
    return material;
}

function equipItem({ scene, playerModel, itemId }) {
    if (!playerModel?.rightHandSocket || itemId !== "pistol") {
        return;
    }

    if (playerModel.equippedMesh) {
        playerModel.equippedMesh.dispose(false, true);
    }

    const gun = createEquippedGunMesh(scene);
    gun.parent = playerModel.rightHandSocket;
    gun.position.set(0.02, -0.04, 0.16);
    gun.rotation.y = BABYLON.Tools.ToRadians(4);
    playerModel.equippedMesh = gun;
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
        get forward() {
            return Number(pressed.has("KeyW")) - Number(pressed.has("KeyS"));
        },
        get right() {
            return Number(pressed.has("KeyD")) - Number(pressed.has("KeyA"));
        },
        dispose() {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        },
    };
}

function updatePlayer({ mesh, camera, input, movement, desiredDirection, active, deltaSeconds }) {
    if (!active) {
        return;
    }

    const cameraForward = camera.getForwardRay().direction;
    cameraForward.y = 0;

    if (cameraForward.lengthSquared() < 0.0001) {
        return;
    }

    cameraForward.normalize();

    const cameraRight = BABYLON.Vector3.Cross(BABYLON.Axis.Y, cameraForward);
    cameraRight.normalize();

    desiredDirection.copyFromFloats(0, 0, 0);
    desiredDirection.addInPlace(cameraForward.scale(input.forward));
    desiredDirection.addInPlace(cameraRight.scale(input.right));

    if (desiredDirection.lengthSquared() > 0.0001) {
        desiredDirection.normalize();
        mesh.rotation.y = Math.atan2(desiredDirection.x, desiredDirection.z);
    }

    const targetSpeed = desiredDirection.lengthSquared() > 0 ? 13 : 0;
    const acceleration = targetSpeed > 0 ? 34 : 44;
    const targetVelocity = desiredDirection.scale(targetSpeed);
    const blend = 1 - Math.exp(-acceleration * deltaSeconds);

    movement.x += (targetVelocity.x - movement.x) * blend;
    movement.z += (targetVelocity.z - movement.z) * blend;

    mesh.position.x = clamp(mesh.position.x + movement.x * deltaSeconds, -WORLD_LIMIT, WORLD_LIMIT);
    mesh.position.z = clamp(mesh.position.z + movement.z * deltaSeconds, -WORLD_LIMIT, WORLD_LIMIT);
    mesh.position.y = PLAYER_HALF_HEIGHT;

    updateBlockHumanoid(mesh.metadata, movement, deltaSeconds);
}

function updateBlockHumanoid(playerModel, movement, deltaSeconds) {
    if (!playerModel?.fallbackModel.isEnabled()) {
        return;
    }

    const speed = Math.hypot(movement.x, movement.z);
    const moveAmount = Math.min(speed / 13, 1);

    playerModel.walkTime += deltaSeconds * WALK_CYCLE_SPEED * (0.25 + moveAmount);

    const stride = Math.sin(playerModel.walkTime) * moveAmount;
    const counterStride = Math.sin(playerModel.walkTime + Math.PI) * moveAmount;
    const bob = Math.abs(Math.sin(playerModel.walkTime)) * 0.05 * moveAmount;
    const lean = -0.12 * moveAmount;

    playerModel.fallbackModel.position.y = -PLAYER_HALF_HEIGHT + bob;
    playerModel.torso.rotation.x = lean;
    playerModel.leftArm.rotation.x = counterStride * 0.65;
    playerModel.rightArm.rotation.x = stride * 0.65;
    playerModel.leftLeg.rotation.x = stride * 0.48;
    playerModel.rightLeg.rotation.x = counterStride * 0.48;

    if (moveAmount < 0.02) {
        playerModel.torso.rotation.x *= 0.8;
        playerModel.leftArm.rotation.x *= 0.8;
        playerModel.rightArm.rotation.x *= 0.8;
        playerModel.leftLeg.rotation.x *= 0.8;
        playerModel.rightLeg.rotation.x *= 0.8;
    }
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
