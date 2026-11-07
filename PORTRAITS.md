# Automatic Top Closer portrait fitting

`js/portrait-fit.js` measures nontransparent pixels in employee cutouts, ignores empty margins, and fits the visible silhouette into the available space above the nameplate. Default fitting preserves the whole silhouette with at least 14px of headroom and 16px side margins. It does not recognize faces or reconstruct missing parts of an image.

The analysis uses a maximum 384px canvas once per image URL and caches up to 50 results in memory. Google Drive photos are analyzed through their public `lh3.googleusercontent.com` image URL. No image is uploaded, edited, or written back to Drive. ResizeObserver updates positioning when the viewport or nameplate height changes; a window-resize fallback is included for older engines.

If image access prevents canvas analysis, the original image stays visible and fits fully inside the portrait space. Opaque backgrounds also fit as a whole image because alpha detection cannot distinguish a person from an opaque background. Failed image loads show “Photo unavailable.”

## Optional exceptions

Most transparent cutouts need no individual settings. For an exceptional pose, add an entry to `overrides` near the top of `js/portrait-fit.js`, keyed by the Google Drive file ID (the `id` value in the photo URL) or, for other hosts, the full image URL:

```js
const overrides = {
  "google-drive-file-id": { zoom: 1.05, x: 0, y: 0 },
};
```

- `zoom`: default `1`; supported range `0.5`–`2`. Values above `1` intentionally allow cropping.
- `x`: horizontal shift as a fraction of the portrait box width. Positive moves right.
- `y`: vertical shift as a fraction of box height. Positive moves down.

These settings affect display only. Keep them in code so all TVs use the same framing. Reload after changing settings and increment the script version in `index.html` when deploying.

The diagnostic `data-fit` attribute on `#portrait` reports `loading`, `auto`, `full-image`, `contain`, or `unavailable`. `auto` means visible-pixel bounds were used; `contain` is the safe fallback. No browser face-detection API, heavy filter, or continuous image scan is required.
