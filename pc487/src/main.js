import { createPc487App } from "./engine/app.js";

const canvas = document.getElementById("render-canvas");
const debugToggle = document.getElementById("debug-toggle");
const debugTeleport = document.getElementById("debug-teleport");
const debugNoclip = document.getElementById("debug-noclip");

const app = createPc487App({ canvas });
app.start();

if (new URLSearchParams(window.location.search).has("smoke")) {
    window.__pc487 = app;
}

debugToggle.addEventListener("click", async () => {
    const isVisible = await app.toggleDebugLayer();
    debugToggle.setAttribute("aria-pressed", String(isVisible));
});

debugTeleport?.addEventListener("click", () => {
    app.teleportToVehicle();
});

debugNoclip?.addEventListener("click", () => {
    const enabled = app.toggleNoclip();
    debugNoclip.setAttribute("aria-pressed", String(enabled));
});

window.addEventListener("beforeunload", () => {
    app.dispose();
});
