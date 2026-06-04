# Mental Map Canvas

A minimal dependency-free prototype for an infinite, pannable SVG drawing canvas. It runs directly from `index.html` with plain HTML, CSS, and browser JavaScript.

## Open

For the committed default canvas document, serve the repository with a small web server:

```bash
cd /home/cbaguilar/coding/cbaguilar.github.io
python3 -m http.server 8000
```

Then open `http://localhost:8000/mental-map-canvas/`.

The page can still be opened directly as `mental-map-canvas/index.html`, but browsers usually block loading `default-map.json` from `file://`. Direct file opening will still use any existing localStorage document, and JSON can still be imported with the file input.

## Controls

- `D`: draw mode.
- `V`: select / pan mode.
- Left drag in draw mode: draw a freehand stroke.
- Double-click: create a labeled place node at the clicked world coordinate.
- Click a node in select mode: select it.
- `Escape`: clear selection.
- `Delete` / `Backspace`: delete the selected node.
- Wheel: zoom centered on the cursor.
- Spacebar + drag, middle drag, or right drag: pan.
- `Cmd+Z` / `Ctrl+Z`: undo the last document action.
- Reset view: return to 100% zoom and origin translation.
- Clear canvas: delete the current document.
- Export JSON: download the current document model.
- Import JSON: replace the current document with a JSON file.

## Data Model

The SVG DOM is only a rendered view. The document model is plain JavaScript data:

```json
{
  "schemaVersion": 1,
  "nextId": 3,
  "strokes": [
    {
      "id": "stroke-1",
      "points": [{ "x": 10, "y": 20 }, { "x": 24, "y": 28 }],
      "color": "#1f2937",
      "width": 3
    }
  ],
  "nodes": [
    {
      "id": "node-2",
      "x": 140,
      "y": 80,
      "label": "Idea"
    }
  ],
  "edges": []
}
```

All stroke points and node positions are stored in world coordinates. Panning and zooming update only the viewport transform on `<g id="world">`, preserving stable document geometry.

## Files

- `index.html`: canvas markup and controls.
- `styles.css`: full-window layout and SVG styling.
- `src/model.js`: document model, mutation helpers, undo snapshots, simplification.
- `src/viewport.js`: pan, zoom, and coordinate transforms.
- `src/render.js`: centralized SVG rendering from the model.
- `src/input.js`: pointer and keyboard interaction.
- `src/storage.js`: localStorage, JSON export, JSON import.
- `src/main.js`: wiring and application lifecycle.
