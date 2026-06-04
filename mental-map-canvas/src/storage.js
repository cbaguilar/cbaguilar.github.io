(function () {
  "use strict";

  const MentalMap = (window.MentalMap = window.MentalMap || {});
  const STORAGE_KEY = "mental-map-canvas-document";
  const DEFAULT_DOCUMENT_URL = "default-map.json";

  function save(document) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  }

  async function loadDefault() {
    const response = await fetch(DEFAULT_DOCUMENT_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Default document request failed: ${response.status}`);
    return response.json();
  }

  function exportJson(document) {
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: "application/json" });
    const link = documentElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "mental-map-canvas.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function readImportFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(String(reader.result)));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  function documentElement(tagName) {
    return window.document.createElement(tagName);
  }

  MentalMap.Storage = {
    save,
    load,
    loadDefault,
    exportJson,
    readImportFile
  };
})();
