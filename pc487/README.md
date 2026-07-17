# PC487

Browser-playable BabylonJS prototype hosted under `/pc487/`.

## Local Development

From the repository root:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/pc487/
```

The first version is intentionally no-build: `index.html` loads BabylonJS from the CDN and the local source files use browser-native ES modules. The current prototype uses a flat world plane so movement work stays fast.

## Optional Player Model

The game will try to load:

```text
pc487/assets/models/player.glb
```

If that file is missing, it falls back to the blue block player. See `docs/model-import.md` for Blender export notes.

## Controls

- `WASD`: move on foot or drive.
- `E`: enter or exit the nearby vehicle.
- Mouse drag: orbit the follow camera.
