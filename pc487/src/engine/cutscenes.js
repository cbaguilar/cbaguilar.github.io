const INTRO_LINE = "wake up dawg, you can't sleep here, this is my mudpit! Get out!";
const INTRO_PLAYER_POSITION = new BABYLON.Vector3(-15.4, 0.44, 5.2);
const INTRO_NPC_START = new BABYLON.Vector3(-20.2, 1, 8.7);
const INTRO_NPC_END = new BABYLON.Vector3(-16.9, 1, 6.8);
const INTRO_FADE_HOLD_MS = 500;
const INTRO_SLEEPING_HOLD_MS = 1600;

export function createCutsceneSystem({ scene, camera, playerController, onPromptChange }) {
    const gameShell = document.querySelector("#game-shell");
    const layer = document.querySelector("#cutscene-layer");
    const fade = document.querySelector("#cutscene-fade");
    const dialogueBox = document.querySelector("#dialogue-box");
    const dialogueSpeaker = document.querySelector("#dialogue-speaker");
    const dialogueText = document.querySelector("#dialogue-text");
    const dialogueNext = document.querySelector("#dialogue-next");
    const focusTarget = new BABYLON.TransformNode("cutsceneFocusTarget", scene);
    const friendlyNpc = createFriendlyMudpitNpc(scene);
    const dirtPatch = createIntroDirtPatch(scene);
    let active = false;
    let started = false;
    let disposed = false;

    friendlyNpc.root.setEnabled(false);

    async function startOpeningCutscene() {
        if (started || disposed || shouldSkipIntro() || !layer || !fade || !dialogueBox) {
            return;
        }

        started = true;
        active = true;
        gameShell?.classList.add("is-cutscene");
        layer.hidden = false;
        dialogueBox.hidden = true;
        fade.style.opacity = "1";
        onPromptChange("");

        const previousAlpha = camera.alpha;
        const previousBeta = camera.beta;
        const previousRadius = camera.radius;

        playerController.setActive(true);
        playerController.setControlsEnabled(false);
        playerController.mesh.position.copyFrom(INTRO_PLAYER_POSITION);
        playerController.mesh.rotation.y = BABYLON.Tools.ToRadians(-30);
        playerController.setCutscenePose("lying");

        friendlyNpc.root.setEnabled(true);
        friendlyNpc.root.position.copyFrom(INTRO_NPC_START);
        friendlyNpc.root.rotation.y = BABYLON.Tools.ToRadians(120);
        friendlyNpc.setWalkAmount(0);

        focusTarget.position.copyFrom(playerController.mesh.position).addInPlace(new BABYLON.Vector3(-0.2, 1.1, 0.15));
        camera.lockedTarget = focusTarget;
        camera.alpha = BABYLON.Tools.ToRadians(32);
        camera.beta = BABYLON.Tools.ToRadians(67);
        camera.radius = 4.6;

        await sleep(INTRO_FADE_HOLD_MS);
        fade.style.opacity = "0";
        await sleep(INTRO_SLEEPING_HOLD_MS);
        await walkNpcTo(scene, friendlyNpc, {
            from: INTRO_NPC_START,
            to: INTRO_NPC_END,
            durationMs: 1150,
            focusTarget,
        });

        focusTarget.position.copyFrom(friendlyNpc.root.position).addInPlace(new BABYLON.Vector3(0, 1.4, 0));
        camera.alpha = BABYLON.Tools.ToRadians(54);
        camera.beta = BABYLON.Tools.ToRadians(68);
        camera.radius = 4.9;
        playerController.setCutscenePose("dazed");

        await showDialogue({
            speaker: "Friendly Forest Dweller",
            text: INTRO_LINE,
        });

        dialogueBox.hidden = true;
        playerController.setCutscenePose("standing");
        playerController.setControlsEnabled(true);
        camera.lockedTarget = playerController.mesh;
        camera.alpha = previousAlpha;
        camera.beta = previousBeta;
        camera.radius = previousRadius;
        gameShell?.classList.remove("is-cutscene");
        layer.hidden = true;
        active = false;
    }

    function showDialogue({ speaker, text }) {
        if (!dialogueBox || !dialogueSpeaker || !dialogueText || !dialogueNext) {
            return Promise.resolve();
        }

        dialogueSpeaker.textContent = speaker;
        dialogueText.textContent = text;
        dialogueBox.hidden = false;
        dialogueNext.focus({ preventScroll: true });

        return waitForAdvance(dialogueNext);
    }

    return {
        get active() {
            return active;
        },
        startOpeningCutscene,
        dispose() {
            disposed = true;
            friendlyNpc.root.dispose(false, true);
            dirtPatch.dispose();
            focusTarget.dispose();
        },
    };
}

function createIntroDirtPatch(scene) {
    const material = makeMaterial(scene, "introClearingDirt", 0.31, 0.2, 0.12);
    material.specularColor = new BABYLON.Color3(0.08, 0.055, 0.035);
    const patch = BABYLON.MeshBuilder.CreateDisc("introWakeupDirtPatch", {
        radius: 3.1,
        tessellation: 24,
    }, scene);
    patch.position.set(INTRO_PLAYER_POSITION.x, 0.075, INTRO_PLAYER_POSITION.z);
    patch.rotation.x = BABYLON.Tools.ToRadians(90);
    patch.rotation.z = BABYLON.Tools.ToRadians(18);
    patch.scaling.z = 0.68;
    patch.material = material;
    return patch;
}

function shouldSkipIntro() {
    const params = new URLSearchParams(window.location.search);
    return params.has("smoke") || params.has("skipIntro");
}

function waitForAdvance(button) {
    return new Promise((resolve) => {
        function finish(event) {
            event?.preventDefault();
            cleanup();
            resolve();
        }

        function onKeyDown(event) {
            if (!["Enter", "Space"].includes(event.code)) {
                return;
            }

            finish(event);
        }

        function cleanup() {
            button.removeEventListener("pointerdown", finish);
            button.removeEventListener("click", finish);
            window.removeEventListener("keydown", onKeyDown);
        }

        button.addEventListener("pointerdown", finish);
        button.addEventListener("click", finish);
        window.addEventListener("keydown", onKeyDown);
    });
}

function walkNpcTo(scene, npc, { from, to, durationMs, focusTarget }) {
    return new Promise((resolve) => {
        const start = performance.now();
        npc.root.position.copyFrom(from);

        const observer = scene.onBeforeRenderObservable.add(() => {
            const progress = Math.min((performance.now() - start) / durationMs, 1);
            const eased = 1 - ((1 - progress) ** 3);
            BABYLON.Vector3.LerpToRef(from, to, eased, npc.root.position);

            const delta = to.subtract(from);
            npc.root.rotation.y = Math.atan2(delta.x, delta.z);
            npc.setWalkAmount(progress < 1 ? 0.78 : 0);
            focusTarget.position.copyFrom(npc.root.position).addInPlace(new BABYLON.Vector3(0, 1.25, 0));

            if (progress >= 1) {
                npc.setWalkAmount(0);
                scene.onBeforeRenderObservable.remove(observer);
                resolve();
            }
        });
    });
}

function createFriendlyMudpitNpc(scene) {
    const root = new BABYLON.TransformNode("friendlyMudpitDweller", scene);
    const model = new BABYLON.TransformNode("friendlyMudpitDwellerModel", scene);
    model.parent = root;
    model.position.y = -1;

    const skin = makeMaterial(scene, "friendlyMudpitSkin", 0.72, 0.49, 0.34);
    const shirt = makeMaterial(scene, "friendlyMudpitShirt", 0.62, 0.26, 0.13);
    const pants = makeMaterial(scene, "friendlyMudpitPants", 0.12, 0.12, 0.13);
    const hair = makeMaterial(scene, "friendlyMudpitHair", 0.08, 0.045, 0.025);
    const mud = makeMaterial(scene, "friendlyMudpitMudSmear", 0.22, 0.12, 0.06);

    addBox(scene, model, "friendlyMudpitTorso", { width: 0.82, height: 0.82, depth: 0.42 }, [0, 1.1, 0], shirt);
    addBox(scene, model, "friendlyMudpitHead", { width: 0.55, height: 0.55, depth: 0.5 }, [0, 1.88, 0], skin);
    addBox(scene, model, "friendlyMudpitHair", { width: 0.59, height: 0.15, depth: 0.53 }, [0, 2.2, -0.02], hair);
    addBox(scene, model, "friendlyMudpitMudPatch", { width: 0.28, height: 0.08, depth: 0.44 }, [0.19, 1.3, -0.23], mud);

    const leftArm = createLimb(scene, model, "friendlyMudpitLeftArm", [-0.6, 1.12, 0], shirt, skin);
    const rightArm = createLimb(scene, model, "friendlyMudpitRightArm", [0.6, 1.12, 0], shirt, skin);
    const leftLeg = createLeg(scene, model, "friendlyMudpitLeftLeg", [-0.21, 0.38, 0], pants);
    const rightLeg = createLeg(scene, model, "friendlyMudpitRightLeg", [0.21, 0.38, 0], pants);

    const state = {
        walkTime: 0,
    };

    return {
        root,
        setWalkAmount(amount) {
            state.walkTime += scene.getEngine().getDeltaTime() / 1000 * 8;
            const stride = Math.sin(state.walkTime) * amount;
            leftArm.rotation.x = -stride * 0.55;
            rightArm.rotation.x = stride * 0.55;
            leftLeg.rotation.x = stride * 0.42;
            rightLeg.rotation.x = -stride * 0.42;
        },
    };
}

function createLimb(scene, parent, name, position, sleeveMaterial, handMaterial) {
    const limbRoot = new BABYLON.TransformNode(name, scene);
    limbRoot.parent = parent;
    limbRoot.position.set(position[0], position[1], position[2]);
    addBox(scene, limbRoot, `${name}Sleeve`, { width: 0.25, height: 0.55, depth: 0.27 }, [0, -0.18, 0], sleeveMaterial);
    addBox(scene, limbRoot, `${name}Hand`, { width: 0.23, height: 0.22, depth: 0.24 }, [0, -0.56, 0], handMaterial);
    return limbRoot;
}

function createLeg(scene, parent, name, position, material) {
    const legRoot = new BABYLON.TransformNode(name, scene);
    legRoot.parent = parent;
    legRoot.position.set(position[0], position[1], position[2]);
    addBox(scene, legRoot, `${name}Pants`, { width: 0.3, height: 0.66, depth: 0.32 }, [0, -0.08, 0], material);
    addBox(scene, legRoot, `${name}Shoe`, { width: 0.33, height: 0.16, depth: 0.45 }, [0, -0.48, 0.05], material);
    return legRoot;
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
    material.specularColor = new BABYLON.Color3(0.025, 0.025, 0.025);
    return material;
}

function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}
