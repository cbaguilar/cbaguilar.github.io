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

The first version is intentionally no-build: `index.html` loads BabylonJS from the CDN and the local source files use browser-native ES modules.

The current terrain presets are procedural stand-ins for the supplied Inland Empire heightmap screenshots:

- `34_235_-117_492_13_505_505_16bit.png`
- `34_044_-117_414_10_505_505_16bit.png`

When the source heightmap images are available in the repo, place them under `pc487/assets/heightmaps/` and replace the samplers in `src/engine/terrain.js` with image-backed height sampling.
