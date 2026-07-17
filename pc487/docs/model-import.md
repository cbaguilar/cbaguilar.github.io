# Character Model Import

BabylonJS cannot load Blender `.blend` files directly in the browser. Convert character rigs to glTF/GLB first, then place the exported file here:

```text
pc487/assets/models/player.glb
```

The current player controller treats the moving blue box as the gameplay proxy. If `player.glb` exists, the game imports it, parents it to that proxy, and hides the box.

## Blender Export Notes

1. Open the `.blend` file in Blender.
2. Check the license and source attribution before using it.
3. Remove unsupported or unnecessary objects.
4. Apply transforms where appropriate.
5. Export as `glTF 2.0`.
6. Prefer binary `.glb`.
7. Include skinning and animations if the rig has useful actions.
8. Name the exported file `player.glb`.

For public builds, avoid fan-art models based on protected characters. Even when a download page says CC-BY, the uploader usually cannot grant rights to the underlying copyrighted character.

## Renderpeople / Nathan Note

The downloaded `11-rp_nathan_animated_003_walking_c4d.zip` archive contains a usable `rp_nathan_animated_003_walking.fbx`, but this repo does not currently have Blender, Assimp, or FBX2glTF installed to convert it.

Renderpeople's current terms allow real-time rendering in video games, but prohibit making the raw 3D data easily downloadable or extractable by third parties. A public GitHub Pages `.glb` file is directly downloadable, so treat this model as local-prototype material unless the license source explicitly permits public redistribution in that form.

Local conversion path:

```text
rp_nathan_animated_003_walking.fbx -> player.glb
```

Then place:

```text
pc487/assets/models/player.glb
```
