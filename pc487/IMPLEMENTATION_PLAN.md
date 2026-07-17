# PC487 Implementation Plan

PC487 is a browser-playable 3D open-world game inspired by the systemic sandbox structure of crime/action games, without copying protected characters, maps, brands, missions, audio, or visual identity from any existing franchise. The long-term target is a BabylonJS-based open-world game loosely modeled after the Inland Empire region of Southern California, hosted under `https://www.cbaguilar.com/pc487/`.

This plan starts intentionally small: get a reliable web page rendering a 3D world, add a block player with movement, then expand toward vehicles, streaming terrain, missions, and a recognizable fictionalized Inland Empire environment.

## Working Assumptions

- Host target: GitHub Pages static site at `/pc487/`.
- Initial dev server: `python3 -m http.server` from the repo root, then browse to `http://localhost:8000/pc487/`.
- Initial framework: BabylonJS loaded from a CDN for the fastest first rendering spike.
- Compile option: move to TypeScript + Vite early if plain JavaScript starts slowing iteration, but keep the first playable version simple enough to understand without a heavy toolchain.
- First playable prototype: no backend, no build step, no external asset pipeline.
- Long-term art direction: fictionalized Inland Empire, inspired by regional geography and infrastructure rather than a literal map clone.
- Performance target: desktop browser first, then mobile/tablet compatibility once the scene architecture stabilizes.

## Repository Layout

Initial static layout, preferred for the first rendering and movement spike:

```text
pc487/
  index.html
  styles.css
  src/
    main.js
    engine/
      app.js
      input.js
      camera.js
      player.js
      world.js
      physics.js
    gameplay/
      vehicle.js
      wanted.js
      missions.js
    data/
      world-config.js
  assets/
    textures/
    models/
    audio/
  docs/
    architecture.md
    asset-pipeline.md
    world-design.md
  IMPLEMENTATION_PLAN.md
```

Possible TypeScript/Vite layout after the prototype proves itself, or earlier if the code starts wanting typed modules:

```text
pc487/
  package.json
  index.html
  src/
    main.ts
    engine/
    gameplay/
    world/
    ui/
  public/
    assets/
```

The project should stay under `pc487/` so it can be published as a subpage without interfering with the rest of the personal site.

## Milestone 0: Planning And Project Shell

Goal: create the foundation without committing to premature architecture.

Deliverables:

- `pc487/IMPLEMENTATION_PLAN.md`.
- Minimal `/pc487/` static entry point.
- Local dev instructions in `pc487/README.md`.
- Git commits for each coherent step.

Acceptance criteria:

- Visiting `/pc487/` from a local static server shows a page dedicated to PC487.
- No unrelated files are modified.
- Existing uncommitted work elsewhere in the repo is left alone.

## Milestone 1: BabylonJS Rendering Spike

Goal: prove BabylonJS works cleanly from the static GitHub Pages setup.

Deliverables:

- Full-window canvas.
- BabylonJS engine and scene initialization.
- Basic lighting.
- Ground plane.
- Sky color or simple skybox.
- Debug overlay toggle.
- Resize handling.

Implementation notes:

- Start with CDN imports in plain JavaScript.
- Keep engine setup in `src/engine/app.js`.
- Avoid large assets until loading paths and deployment behavior are proven.

Acceptance criteria:

- `python3 -m http.server` from repo root serves the game at `http://localhost:8000/pc487/`.
- The scene renders a nonblank 3D world.
- Browser resize does not distort or break the canvas.
- The page still works when served from `/pc487/`, not only from repo root.

## Milestone 2: Block Player Controller

Goal: make the first thing that feels like a game.

Deliverables:

- Simple capsule or box player mesh.
- Third-person follow camera.
- WASD movement.
- Mouse-look or orbit camera.
- Jump or step-up behavior if physics is ready.
- Movement tuning constants in one config object.

Implementation notes:

- Use BabylonJS input APIs directly at first.
- Prefer a simple kinematic controller before integrating full physics.
- Keep player logic deterministic and readable.
- Use `PointerLock` only after a click-to-focus screen exists.

Acceptance criteria:

- Player can move around the ground plane.
- Camera follows without nausea-inducing snapping.
- Player remains visible and does not fall through the world.
- Movement code is isolated from scene setup.

## Milestone 3: Physics Decision

Goal: choose a physics path before vehicles and collisions become expensive to rewrite.

Options:

- BabylonJS built-in physics abstraction with Havok.
- BabylonJS built-in physics abstraction with Ammo.js.
- Custom lightweight kinematic collision for early open-world traversal.

Recommended path:

- Use a kinematic character controller for the first player prototype.
- Add Havok when rigid bodies, vehicles, ramps, and world props become necessary.

Decision criteria:

- Browser load size.
- GitHub Pages compatibility.
- Vehicle support.
- Debuggability.
- API stability.

Acceptance criteria:

- A short decision record exists in `pc487/docs/architecture.md`.
- The first selected approach supports player/world collision.
- The choice does not block later vehicle work.

## Milestone 4: First Drivable Vehicle

Goal: add a crude but fun vehicle as early as practical.

Deliverables:

- Placeholder car mesh made from boxes.
- Enter/exit vehicle key.
- Basic acceleration, braking, steering, and reverse.
- Third-person vehicle camera.
- Player-to-vehicle state transition.

Implementation notes:

- Start arcade-style, not simulation-heavy.
- Use tunable constants for acceleration, turn rate, drag, and max speed.
- Do not start with wheel colliders unless physics integration is already mature.

Acceptance criteria:

- Player can walk to a vehicle, enter it, drive around, stop, exit, and continue walking.
- Vehicle cannot accelerate infinitely.
- Camera mode is readable at low and moderate speeds.

## Milestone 5: World Blockout

Goal: create the first Inland Empire-inspired sandbox without needing real GIS data yet.

Deliverables:

- Large terrain plane divided into named districts.
- Roads represented by simple meshes or textured strips.
- Early district concepts:
  - Riverside-like downtown grid.
  - San Bernardino-like civic/industrial area.
  - Ontario/Rancho-like logistics and airport corridor.
  - Fontana/Rialto-like warehouse belt.
  - Foothill/suburban edge.
  - Dry hills/desert transition.
- Landmarks represented as simple blockout geometry.

Implementation notes:

- Use fictional names.
- Prioritize navigability and line-of-sight over geographic accuracy.
- Keep terrain and district data declarative.

Acceptance criteria:

- Player can traverse multiple visually distinct districts.
- Roads provide basic navigation structure.
- The world has at least one long sightline and one denser urban area.

## Milestone 6: Asset Pipeline

Goal: move from primitive meshes to maintainable art content.

Deliverables:

- Asset naming conventions.
- Texture compression strategy.
- glTF/GLB import path.
- Placeholder asset library.
- Asset attribution tracking for anything not self-made.

Recommended tools:

- Blender for custom models.
- glTF/GLB for web delivery.
- KTX2/Basis textures when texture size becomes a bottleneck.
- Simple manifest files for asset registration.

Acceptance criteria:

- A model can be exported from Blender and loaded into the game.
- Asset loading errors are visible in the browser console.
- Large assets do not block the initial loading screen indefinitely.

## Milestone 7: Streaming And World Partitioning

Goal: scale beyond a single loaded scene.

Deliverables:

- World grid/chunk coordinate system.
- Chunk manifests.
- Load/unload radius around player or vehicle.
- Object pooling for repeated props.
- Loading budget per frame.

Implementation notes:

- Design world coordinates early so chunks do not need rework.
- Separate logical district data from render assets.
- Use deterministic chunk IDs.

Acceptance criteria:

- Driving across chunk boundaries loads new content without a hard page reload.
- Old chunks unload or deactivate.
- Frame time remains stable in the test world.

## Milestone 8: Game Systems

Goal: add sandbox behavior beyond locomotion.

Candidate systems:

- Traffic placeholders.
- Pedestrian placeholders.
- Simple interaction prompts.
- Pickup items.
- Basic wanted/heat system.
- Safehouse or garage.
- Minimap.
- Mission trigger volumes.

Implementation order:

1. Interaction prompts.
2. Mission trigger volumes.
3. Minimap.
4. Traffic placeholders.
5. Wanted/heat prototype.

Acceptance criteria:

- The player has at least one repeatable objective.
- The world responds to player actions.
- Systems are data-driven enough to add new interactions without rewriting core loops.

## Milestone 9: Mission Prototype

Goal: prove the game can support authored gameplay.

Deliverables:

- Mission state machine.
- Objective markers.
- Start/complete/fail states.
- One simple mission:
  - Walk or drive to a pickup.
  - Deliver it to another district.
  - Avoid or outrun a simple pursuit volume.

Acceptance criteria:

- Mission can be completed from a fresh page load.
- Mission can be restarted after failure.
- UI communicates objective state without cluttering the screen.

## Milestone 10: Audio And Feel

Goal: make the prototype feel responsive and intentional.

Deliverables:

- Engine hum placeholder.
- Tire/impact placeholder sounds.
- Footstep placeholder sounds.
- Ambient district loops.
- Input feedback sounds for UI.

Implementation notes:

- Keep audio assets small.
- Add mute and volume controls early.
- Track licensing.

Acceptance criteria:

- Audio starts only after user interaction, complying with browser autoplay rules.
- Player can mute the game.
- Vehicle speed affects vehicle audio in a basic way.

## Milestone 11: Save Data And Persistence

Goal: persist local progress without a backend.

Deliverables:

- LocalStorage save file.
- Versioned save schema.
- Player position save.
- Vehicle position save.
- Completed mission flags.
- Reset-save control.

Acceptance criteria:

- Refreshing the page restores basic state.
- Schema version mismatch does not crash the game.
- Resetting save data works.

## Milestone 12: Build System Migration

Goal: move to a maintainable engineering setup when it clearly helps, without making the first prototype depend on unnecessary ceremony.

Trigger conditions:

- More than roughly 10 source files.
- Need for TypeScript types.
- Need for unit tests.
- Need for npm-managed BabylonJS dependencies.
- Need for bundling, tree-shaking, or asset hashing.
- Plain script imports start obscuring module boundaries.

Deliverables:

- `package.json`.
- Vite config with base path set for `/pc487/`.
- TypeScript.
- ESLint or Biome.
- Basic test runner if useful.
- Build output compatible with GitHub Pages.

Acceptance criteria:

- `npm run dev` serves the game locally.
- `npm run build` emits deployable static assets.
- Built output works from `/pc487/`.

## Milestone 13: Performance Pass

Goal: keep the game browser-friendly as the world grows.

Work items:

- Scene instrumentation.
- Mesh instance/clone strategy.
- Draw call budget.
- Texture memory budget.
- LOD strategy.
- Physics body budget.
- Asset loading budget.
- Mobile capability check.

Acceptance criteria:

- Maintain a target frame rate on the primary development machine.
- Debug UI exposes frame time and active mesh count.
- A stress scene identifies the current bottleneck.

## Milestone 14: Visual Identity

Goal: make PC487 feel like its own project.

Work items:

- Fictional city/county naming.
- UI typography and color system.
- Diegetic brands/signage.
- Vehicle style guide.
- District mood boards.
- Loading screen.
- Title treatment.

Constraints:

- Do not use real GTA logos, UI, radio brands, city names as presented in the games, mission names, sound effects, or character references.
- Keep the Inland Empire inspiration observational and transformative.

Acceptance criteria:

- A player can describe the setting without thinking it is a direct clone.
- The page looks intentional even before full gameplay is present.

## Development Workflow

For the static prototype:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/pc487/
```

For each implementation step:

```bash
git status --short
git add pc487/<changed-files>
git commit -m "pc487: <short description>"
```

Before committing:

- Check `git status --short`.
- Avoid staging unrelated existing changes.
- Manually test `/pc487/` locally.
- Keep commits small enough to revert independently.

## Near-Term Task List

- [x] Write implementation plan.
- [ ] Add minimal `pc487/index.html`.
- [ ] Add `pc487/styles.css` with full-screen canvas styles.
- [ ] Add `pc487/src/main.js`.
- [ ] Load BabylonJS from CDN.
- [ ] Render a ground plane, light, camera, and test mesh.
- [ ] Add a simple player block.
- [ ] Add keyboard movement.
- [ ] Add follow camera.
- [ ] Add a placeholder vehicle if the controller stabilizes quickly.
- [ ] Add `pc487/README.md` with local dev commands.

## Open Technical Questions

- Should the first serious code version use TypeScript immediately, or should the project stay no-build for the first playable prototype?
- Should physics start with Havok, or should vehicles remain arcade-style until world collision is more mature?
- How literal should the Inland Empire modeling be: hand-authored fictional districts, GIS-derived road skeletons, or a hybrid?
- What is the target visual density for the first public version?
- Should the long-term game include networked multiplayer, or remain single-player?

## Recommended Next Step

Implement Milestone 1 as a small static BabylonJS spike:

- `pc487/index.html`
- `pc487/styles.css`
- `pc487/src/main.js`

Keep it dependency-free except for BabylonJS CDN imports. Once a cube, ground plane, camera, and resize loop are stable at `/pc487/`, move immediately to the block player controller.

If that first spike gets awkward, migrate to a minimal Vite setup immediately rather than accumulating script-tag complexity. The build output should still publish under `/pc487/`.
