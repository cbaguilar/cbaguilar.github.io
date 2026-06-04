(function () {
  "use strict";

  const MentalMap = (window.MentalMap = window.MentalMap || {});

  function createDocument() {
    return {
      schemaVersion: 1,
      nextId: 1,
      strokes: [],
      nodes: [],
      edges: []
    };
  }

  function createState(document) {
    return {
      document: normalizeDocument(document || createDocument()),
      selected: null,
      mode: "draw",
      undoStack: []
    };
  }

  function normalizeDocument(input) {
    const base = createDocument();
    const source = input && typeof input === "object" ? input : {};
    const document = {
      schemaVersion: 1,
      nextId: Number.isFinite(source.nextId) ? source.nextId : 1,
      strokes: Array.isArray(source.strokes) ? source.strokes.map(normalizeStroke).filter(Boolean) : [],
      nodes: Array.isArray(source.nodes) ? source.nodes.map(normalizeNode).filter(Boolean) : [],
      edges: Array.isArray(source.edges) ? source.edges.map(normalizeEdge).filter(Boolean) : []
    };

    const maxNumericId = [...document.strokes, ...document.nodes, ...document.edges]
      .map((item) => Number(String(item.id).replace(/^\D+/, "")))
      .filter(Number.isFinite)
      .reduce((max, value) => Math.max(max, value), 0);
    document.nextId = Math.max(base.nextId, document.nextId, maxNumericId + 1);
    return document;
  }

  function normalizeStroke(stroke) {
    if (!stroke || !Array.isArray(stroke.points)) return null;
    const points = stroke.points.map(normalizePoint).filter(Boolean);
    if (points.length < 2) return null;
    return {
      id: String(stroke.id || makeLooseId("stroke")),
      points,
      color: typeof stroke.color === "string" ? stroke.color : "#1f2937",
      width: Number.isFinite(stroke.width) ? stroke.width : 3
    };
  }

  function normalizeNode(node) {
    if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return null;
    return {
      id: String(node.id || makeLooseId("node")),
      x: node.x,
      y: node.y,
      label: String(node.label || "Place")
    };
  }

  function normalizeEdge(edge) {
    if (!edge || !edge.from || !edge.to) return null;
    return {
      id: String(edge.id || makeLooseId("edge")),
      from: String(edge.from),
      to: String(edge.to)
    };
  }

  function normalizePoint(point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    return { x: point.x, y: point.y };
  }

  function makeLooseId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function nextId(document, prefix) {
    const id = `${prefix}-${document.nextId}`;
    document.nextId += 1;
    return id;
  }

  function snapshot(state) {
    state.undoStack.push(JSON.stringify(state.document));
    if (state.undoStack.length > 60) state.undoStack.shift();
  }

  function undo(state) {
    const previous = state.undoStack.pop();
    if (!previous) return false;
    state.document = normalizeDocument(JSON.parse(previous));
    state.selected = null;
    return true;
  }

  function addStroke(state, points) {
    const simplified = simplifyPoints(points, 1.2);
    if (simplified.length < 2) return null;
    snapshot(state);
    const stroke = {
      id: nextId(state.document, "stroke"),
      points: simplified,
      color: "#1f2937",
      width: 3
    };
    state.document.strokes.push(stroke);
    return stroke;
  }

  function addNode(state, x, y, label) {
    snapshot(state);
    const node = {
      id: nextId(state.document, "node"),
      x,
      y,
      label: label.trim() || "Place"
    };
    state.document.nodes.push(node);
    state.selected = { type: "node", id: node.id };
    return node;
  }

  function deleteSelected(state) {
    if (!state.selected) return false;
    if (state.selected.type === "node") {
      const before = state.document.nodes.length;
      snapshot(state);
      state.document.nodes = state.document.nodes.filter((node) => node.id !== state.selected.id);
      state.document.edges = state.document.edges.filter((edge) => edge.from !== state.selected.id && edge.to !== state.selected.id);
      state.selected = null;
      return state.document.nodes.length !== before;
    }
    return false;
  }

  function replaceDocument(state, document) {
    snapshot(state);
    state.document = normalizeDocument(document);
    state.selected = null;
  }

  function clearDocument(state) {
    snapshot(state);
    state.document = createDocument();
    state.selected = null;
  }

  function simplifyPoints(points, minDistance) {
    const result = [];
    for (const point of points) {
      const last = result[result.length - 1];
      if (!last || distance(last, point) >= minDistance) result.push({ x: point.x, y: point.y });
    }
    const finalPoint = points[points.length - 1];
    if (finalPoint && result[result.length - 1] !== finalPoint) {
      const last = result[result.length - 1];
      if (!last || last.x !== finalPoint.x || last.y !== finalPoint.y) result.push({ x: finalPoint.x, y: finalPoint.y });
    }
    return result;
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  MentalMap.Model = {
    createDocument,
    createState,
    normalizeDocument,
    addStroke,
    addNode,
    deleteSelected,
    replaceDocument,
    clearDocument,
    undo,
    simplifyPoints
  };
})();
