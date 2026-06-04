(function () {
  "use strict";

  const MentalMap = (window.MentalMap = window.MentalMap || {});

  function createViewport() {
    return {
      x: 0,
      y: 0,
      scale: 1,
      minScale: 0.08,
      maxScale: 8
    };
  }

  function applyViewport(worldElement, gridElement, viewport) {
    worldElement.setAttribute("transform", `translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`);

    if (gridElement) {
      gridElement.setAttribute("transform", `translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`);
    }
  }

  function screenPoint(svg, clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function screenToWorld(svg, viewport, clientX, clientY) {
    const point = screenPoint(svg, clientX, clientY);

    /*
      The world group uses this SVG transform:
        screen = translate(viewport.x, viewport.y) then scale(viewport.scale)

      To convert a pointer position back into stable world coordinates, apply
      the inverse transform in reverse order:
        world = (screen - translation) / scale

      Every model point is stored in this world coordinate space, so panning and
      zooming only change viewport values. They never rewrite document geometry.
    */
    return {
      x: (point.x - viewport.x) / viewport.scale,
      y: (point.y - viewport.y) / viewport.scale
    };
  }

  function zoomAt(svg, viewport, clientX, clientY, factor) {
    const before = screenToWorld(svg, viewport, clientX, clientY);
    const nextScale = clamp(viewport.scale * factor, viewport.minScale, viewport.maxScale);
    const pointer = screenPoint(svg, clientX, clientY);
    viewport.scale = nextScale;

    /*
      Keep the world coordinate under the cursor fixed while zooming. After the
      new scale is chosen, solve the forward transform for the translation that
      places `before` back under the same screen-space pointer.
    */
    viewport.x = pointer.x - before.x * viewport.scale;
    viewport.y = pointer.y - before.y * viewport.scale;
  }

  function panBy(viewport, dx, dy) {
    viewport.x += dx;
    viewport.y += dy;
  }

  function resetViewport(viewport) {
    viewport.x = 0;
    viewport.y = 0;
    viewport.scale = 1;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  MentalMap.Viewport = {
    createViewport,
    applyViewport,
    screenToWorld,
    zoomAt,
    panBy,
    resetViewport
  };
})();
