(function () {
  "use strict";

  const MentalMap = (window.MentalMap = window.MentalMap || {});

  function attachInput(context) {
    const { svg, state, viewport, renderer, callbacks } = context;
    const pointer = {
      activeId: null,
      action: null,
      lastX: 0,
      lastY: 0,
      points: []
    };
    const keys = {
      space: false
    };

    svg.addEventListener("contextmenu", (event) => event.preventDefault());

    svg.addEventListener("wheel", (event) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.001);
      MentalMap.Viewport.zoomAt(svg, viewport, event.clientX, event.clientY, factor);
      callbacks.viewportChanged();
    }, { passive: false });

    svg.addEventListener("dblclick", (event) => {
      event.preventDefault();
      const world = MentalMap.Viewport.screenToWorld(svg, viewport, event.clientX, event.clientY);
      const label = window.prompt("Place label", "Place");
      if (label === null) return;
      MentalMap.Model.addNode(state, world.x, world.y, label);
      callbacks.documentChanged();
    });

    svg.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
      svg.setPointerCapture(event.pointerId);
      pointer.activeId = event.pointerId;
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;

      const nodeElement = event.target.closest ? event.target.closest(".node") : null;
      const wantsPan = event.button === 1 || event.button === 2 || keys.space;

      if (wantsPan) {
        pointer.action = "pan";
        window.document.body.classList.add("is-panning");
        event.preventDefault();
        return;
      }

      if (nodeElement && event.button === 0) {
        pointer.action = "select";
        state.selected = { type: "node", id: nodeElement.dataset.id };
        callbacks.selectionChanged();
        return;
      }

      if (state.mode === "select") {
        pointer.action = "select";
        state.selected = null;
        callbacks.selectionChanged();
        return;
      }

      if (state.mode === "draw" && event.button === 0) {
        pointer.action = "draw";
        pointer.points = [MentalMap.Viewport.screenToWorld(svg, viewport, event.clientX, event.clientY)];
        state.selected = null;
        callbacks.selectionChanged();
        event.preventDefault();
      }
    });

    svg.addEventListener("pointermove", (event) => {
      if (pointer.activeId !== event.pointerId) return;

      if (pointer.action === "pan") {
        MentalMap.Viewport.panBy(viewport, event.clientX - pointer.lastX, event.clientY - pointer.lastY);
        pointer.lastX = event.clientX;
        pointer.lastY = event.clientY;
        callbacks.viewportChanged();
        return;
      }

      if (pointer.action === "draw") {
        const point = MentalMap.Viewport.screenToWorld(svg, viewport, event.clientX, event.clientY);
        const last = pointer.points[pointer.points.length - 1];
        if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= 0.8) {
          pointer.points.push(point);
          MentalMap.Render.renderLiveStroke(renderer, pointer.points);
        }
      }
    });

    svg.addEventListener("pointerup", finishPointer);
    svg.addEventListener("pointercancel", finishPointer);

    function finishPointer(event) {
      if (pointer.activeId !== event.pointerId) return;
      if (pointer.action === "draw") {
        MentalMap.Render.clearLiveStroke(renderer);
        MentalMap.Model.addStroke(state, pointer.points);
        callbacks.documentChanged();
      }
      pointer.activeId = null;
      pointer.action = null;
      pointer.points = [];
      window.document.body.classList.remove("is-panning");
    }

    window.addEventListener("keydown", (event) => {
      if (event.repeat && event.key !== "Backspace" && event.key !== "Delete") return;
      if (isTypingTarget(event.target)) return;

      if (event.code === "Space") {
        keys.space = true;
        window.document.body.classList.add("is-panning");
        event.preventDefault();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (MentalMap.Model.undo(state)) callbacks.documentChanged();
        return;
      }

      if (event.key.toLowerCase() === "d") {
        callbacks.setMode("draw");
        return;
      }

      if (event.key.toLowerCase() === "v") {
        callbacks.setMode("select");
        return;
      }

      if (event.key === "Escape") {
        state.selected = null;
        callbacks.selectionChanged();
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        if (MentalMap.Model.deleteSelected(state)) callbacks.documentChanged();
      }
    });

    window.addEventListener("keyup", (event) => {
      if (event.code === "Space") {
        keys.space = false;
        if (pointer.action !== "pan") window.document.body.classList.remove("is-panning");
      }
    });
  }

  function isTypingTarget(target) {
    return target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
  }

  MentalMap.Input = {
    attachInput
  };
})();
