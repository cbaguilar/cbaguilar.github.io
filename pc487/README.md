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
