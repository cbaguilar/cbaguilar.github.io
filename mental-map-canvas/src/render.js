(function () {
  "use strict";

  const MentalMap = (window.MentalMap = window.MentalMap || {});
  const SVG_NS = "http://www.w3.org/2000/svg";

  function createRenderer(svg, world) {
    const layers = {
      edges: makeSvg("g", { id: "edgesLayer" }),
      strokes: makeSvg("g", { id: "strokesLayer" }),
      nodes: makeSvg("g", { id: "nodesLayer" }),
      preview: makeSvg("g", { id: "previewLayer" })
    };
    world.append(layers.edges, layers.strokes, layers.nodes, layers.preview);

    return {
      svg,
      world,
      layers,
      strokeElements: new Map(),
      edgeElements: new Map(),
      nodeElements: new Map(),
      liveStroke: null
    };
  }

  function render(renderer, state) {
    renderEdges(renderer, state.document);
    renderStrokes(renderer, state.document);
    renderNodes(renderer, state.document, state.selected);
  }

  function renderEdges(renderer, document) {
    const nodes = new Map(document.nodes.map((node) => [node.id, node]));
    const active = new Set();
    const fragment = window.document.createDocumentFragment();

    for (const edge of document.edges) {
      const from = nodes.get(edge.from);
      const to = nodes.get(edge.to);
      if (!from || !to) continue;
      active.add(edge.id);
      let line = renderer.edgeElements.get(edge.id);
      if (!line) {
        line = makeSvg("line", { class: "edge", "data-id": edge.id });
        renderer.edgeElements.set(edge.id, line);
        fragment.append(line);
      }
      line.setAttribute("x1", from.x);
      line.setAttribute("y1", from.y);
      line.setAttribute("x2", to.x);
      line.setAttribute("y2", to.y);
    }

    removeStale(renderer.edgeElements, active);
    if (fragment.childNodes.length) renderer.layers.edges.append(fragment);
  }

  function renderStrokes(renderer, document) {
    const active = new Set();
    const fragment = window.document.createDocumentFragment();

    for (const stroke of document.strokes) {
      active.add(stroke.id);
      let path = renderer.strokeElements.get(stroke.id);
      if (!path) {
        path = makeSvg("path", { class: "stroke", "data-id": stroke.id });
        renderer.strokeElements.set(stroke.id, path);
        fragment.append(path);
      }
      path.setAttribute("d", pointsToPath(stroke.points));
      path.setAttribute("stroke", stroke.color || "#1f2937");
      path.setAttribute("stroke-width", stroke.width || 3);
    }

    removeStale(renderer.strokeElements, active);
    if (fragment.childNodes.length) renderer.layers.strokes.append(fragment);
  }

  function renderNodes(renderer, document, selected) {
    const active = new Set();
    const fragment = window.document.createDocumentFragment();

    for (const node of document.nodes) {
      active.add(node.id);
      let group = renderer.nodeElements.get(node.id);
      if (!group) {
        group = makeNodeElement(node);
        renderer.nodeElements.set(node.id, group);
        fragment.append(group);
      }
      group.setAttribute("transform", `translate(${node.x} ${node.y})`);
      group.classList.toggle("selected", Boolean(selected && selected.type === "node" && selected.id === node.id));
      const label = group.querySelector(".node-label");
      if (label.textContent !== node.label) label.textContent = node.label;
    }

    removeStale(renderer.nodeElements, active);
    if (fragment.childNodes.length) renderer.layers.nodes.append(fragment);
  }

  function renderLiveStroke(renderer, points) {
    if (!points || points.length < 2) {
      clearLiveStroke(renderer);
      return;
    }
    if (!renderer.liveStroke) {
      renderer.liveStroke = makeSvg("path", { class: "live-stroke" });
      renderer.layers.preview.append(renderer.liveStroke);
    }
    renderer.liveStroke.setAttribute("d", pointsToPath(points));
  }

  function clearLiveStroke(renderer) {
    if (renderer.liveStroke) {
      renderer.liveStroke.remove();
      renderer.liveStroke = null;
    }
  }

  function makeNodeElement(node) {
    const group = makeSvg("g", { class: "node", "data-type": "node", "data-id": node.id });
    const hit = makeSvg("circle", { class: "node-hit", r: 13 });
    const circle = makeSvg("circle", { class: "node-dot", r: 7 });
    const text = makeSvg("text", { class: "node-label", x: 13, y: 5 });
    text.textContent = node.label;
    group.append(hit, circle, text);
    return group;
  }

  function removeStale(map, active) {
    for (const [id, element] of map) {
      if (!active.has(id)) {
        element.remove();
        map.delete(id);
      }
    }
  }

  function pointsToPath(points) {
    if (!points.length) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let index = 1; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const midX = (current.x + next.x) / 2;
      const midY = (current.y + next.y) / 2;
      d += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
    }
    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }

  function makeSvg(tagName, attributes) {
    const element = window.document.createElementNS(SVG_NS, tagName);
    for (const [name, value] of Object.entries(attributes || {})) {
      element.setAttribute(name, value);
    }
    return element;
  }

  MentalMap.Render = {
    createRenderer,
    render,
    renderLiveStroke,
    clearLiveStroke,
    pointsToPath
  };
})();
