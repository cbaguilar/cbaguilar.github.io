import { createPc487App } from "./engine/app.js";

const canvas = document.getElementById("render-canvas");
const debugToggle = document.getElementById("debug-toggle");
const debugTeleport = document.getElementById("debug-teleport");
const debugNoclip = document.getElementById("debug-noclip");
const mobileTeleport = document.getElementById("mobile-teleport");

const app = createPc487App({ canvas });
app.start();

if (new URLSearchParams(window.location.search).has("smoke")) {
    window.__pc487 = app;
}

debugToggle.addEventListener("click", async () => {
    const isVisible = await app.toggleDebugLayer();
    debugToggle.setAttribute("aria-pressed", String(isVisible));
});

function teleportToTruck(event) {
    event?.preventDefault();
    event?.stopPropagation();
    app.teleportToVehicle();
}

debugTeleport?.addEventListener("pointerdown", teleportToTruck);
debugTeleport?.addEventListener("click", teleportToTruck);
mobileTeleport?.addEventListener("pointerdown", teleportToTruck);
mobileTeleport?.addEventListener("click", teleportToTruck);

debugNoclip?.addEventListener("click", () => {
    const enabled = app.toggleNoclip();
    debugNoclip.setAttribute("aria-pressed", String(enabled));
});

window.addEventListener("beforeunload", () => {
    app.dispose();
});
