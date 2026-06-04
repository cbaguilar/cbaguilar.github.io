(async function () {
  "use strict";

  const { Model, Viewport, Storage, Render, Input } = window.MentalMap;

  const svg = document.getElementById("canvas");
  const world = document.getElementById("world");
  const grid = document.getElementById("grid");
  const zoomLevel = document.getElementById("zoomLevel");
  const drawModeButton = document.getElementById("drawModeButton");
  const selectModeButton = document.getElementById("selectModeButton");
  const clearButton = document.getElementById("clearButton");
  const exportButton = document.getElementById("exportButton");
  const importInput = document.getElementById("importInput");
  const resetViewButton = document.getElementById("resetViewButton");

  let loadedDocument = null;
  try {
    loadedDocument = Storage.load();
    if (!loadedDocument) loadedDocument = await Storage.loadDefault();
  } catch (error) {
    console.warn("Could not load saved or default canvas document.", error);
  }

  const state = Model.createState(loadedDocument);
  const viewport = Viewport.createViewport();
  const renderer = Render.createRenderer(svg, world);

  const callbacks = {
    documentChanged() {
      saveDocument();
      renderAll();
    },
    selectionChanged() {
      renderAll();
    },
    viewportChanged() {
      renderViewport();
    },
    setMode(mode) {
      state.mode = mode;
      syncModeControls();
    }
  };

  Input.attachInput({ svg, state, viewport, renderer, callbacks });

  drawModeButton.addEventListener("click", () => callbacks.setMode("draw"));
  selectModeButton.addEventListener("click", () => callbacks.setMode("select"));

  clearButton.addEventListener("click", () => {
    if (!window.confirm("Clear the canvas?")) return;
    Model.clearDocument(state);
    callbacks.documentChanged();
  });

  exportButton.addEventListener("click", () => Storage.exportJson(state.document));

  importInput.addEventListener("change", async () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    try {
      const imported = await Storage.readImportFile(file);
      Model.replaceDocument(state, imported);
      callbacks.documentChanged();
    } catch (error) {
      window.alert("Could not import that JSON file.");
      console.error(error);
    } finally {
      importInput.value = "";
    }
  });

  resetViewButton.addEventListener("click", () => {
    Viewport.resetViewport(viewport);
    callbacks.viewportChanged();
  });

  window.addEventListener("resize", renderViewport);

  function renderAll() {
    Render.render(renderer, state);
    renderViewport();
  }

  function renderViewport() {
    Viewport.applyViewport(world, grid, viewport);
    zoomLevel.value = `${Math.round(viewport.scale * 100)}%`;
  }

  function saveDocument() {
    try {
      Storage.save(state.document);
    } catch (error) {
      console.warn("Could not save canvas document.", error);
    }
  }

  function syncModeControls() {
    document.body.classList.toggle("mode-select", state.mode === "select");
    drawModeButton.classList.toggle("active", state.mode === "draw");
    selectModeButton.classList.toggle("active", state.mode === "select");
    drawModeButton.setAttribute("aria-pressed", String(state.mode === "draw"));
    selectModeButton.setAttribute("aria-pressed", String(state.mode === "select"));
  }

  syncModeControls();
  renderAll();
})();
