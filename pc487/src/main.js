import { createPc487App } from "./engine/app.js";

const canvas = document.getElementById("render-canvas");
const debugToggle = document.getElementById("debug-toggle");
const terrainToggle = document.getElementById("terrain-toggle");

const app = createPc487App({ canvas });
app.start();

terrainToggle.addEventListener("click", () => {
    const nextTerrain = app.toggleTerrainPreset();
    terrainToggle.textContent = nextTerrain.nextLabel;
});

debugToggle.addEventListener("click", async () => {
    const isVisible = await app.toggleDebugLayer();
    debugToggle.setAttribute("aria-pressed", String(isVisible));
});

window.addEventListener("beforeunload", () => {
    app.dispose();
});
