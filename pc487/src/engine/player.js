const PLAYER_HEIGHT = 2;
const PLAYER_HALF_HEIGHT = PLAYER_HEIGHT / 2;
const WORLD_LIMIT = 86;

export function createPlayerController({ scene, camera }) {
    const mesh = createPlayerMesh(scene);
    const input = createInputState();
    const movement = new BABYLON.Vector3();
    const desiredDirection = new BABYLON.Vector3();

    mesh.position.set(0, PLAYER_HALF_HEIGHT, 0);

    const observer = scene.onBeforeRenderObservable.add(() => {
        const deltaSeconds = scene.getEngine().getDeltaTime() / 1000;
        updatePlayer({ mesh, camera, input, movement, desiredDirection, deltaSeconds });
    });

    return {
        mesh,
        dispose() {
            scene.onBeforeRenderObservable.remove(observer);
            input.dispose();
            mesh.dispose(false, true);
        },
    };
}

function createPlayerMesh(scene) {
    const material = new BABYLON.StandardMaterial("playerBlockBlue", scene);
    material.diffuseColor = new BABYLON.Color3(0.14, 0.28, 0.74);
    material.specularColor = new BABYLON.Color3(0.02, 0.03, 0.08);

    const mesh = BABYLON.MeshBuilder.CreateBox(
        "playerBlock",
        {
            width: 1.2,
            height: PLAYER_HEIGHT,
            depth: 1.2,
        },
        scene,
    );
    mesh.material = material;

    return mesh;
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

function updatePlayer({ mesh, camera, input, movement, desiredDirection, deltaSeconds }) {
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
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
