# Reply-style card icons

Drop one image per reply style here. The reply card (`_cardHTML()` in
`script.js`) loads `assets/icons/{style}.{ext}` into the icon container and
falls back to the built-in drawn SVG for any style whose file is missing —
so partial sets are safe.

Expected files (default extension `.png` — change `ICON_EXT` in `script.js`
if the delivered files use a different one):

- `smooth.png`
- `funny.png`
- `bolder.png`
- `direct.png`
- `warmer.png`
- `shorter.png`
- `longer.png`

## Sizing
The icon container is **57×57 px** (`.yr-card-illustration`). Images are
rendered with `object-fit: contain`, so any square-ish artwork fits without
distortion. When a real image loads, the container's colored background is
cleared (via the `.has-img` class) so a self-contained icon shows cleanly;
if the image is missing, the colored square + white line-icon fallback shows.

Transparent PNGs (or SVGs) recommended.
