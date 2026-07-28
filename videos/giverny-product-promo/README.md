# Giverny Product Promo

65-second, 1920×1080 brand-led product promo built with HyperFrames and deterministic GSAP timelines. The edit uses real Giverny demo-workspace screen recordings, product-derived Agent and settlement UI, and an original ambient soundtrack.

The current review build is intentionally music-only. The earlier synthetic narration was removed after pronunciation QA failed; a replacement voiceover must pass language and intelligibility review before being reattached.

## Preview editions

- Simplified Chinese (default): `http://localhost:3017/#project/giverny-product-promo`
- English on-screen copy: `http://localhost:3017/?locale=en#project/giverny-product-promo`
- Japanese on-screen copy: `http://localhost:3017/?locale=ja#project/giverny-product-promo`

## Locale workflow

```bash
npm run locale:en
npm run locale:zh
npm run locale:ja
npm run check
npm run render:final
```

The default checked-in locale is Simplified Chinese. Locale switching changes deterministic on-screen copy only; all visual timing and motion remain identical. The review build is music-only.

## Source map

- `DESIGN.md` — captured brand reference
- `SCRIPT_V2.md` — 65-second narrative and copy plan
- `STORYBOARD_V2.md` — long-form motion direction and asset audit
- `index.html` — composition and GSAP timeline
- `locales.js` — English, Simplified Chinese, and Japanese on-screen copy
- `assets/footage-v2/` — real demo-workspace UI recordings
- `capture/product-ui/` — still UI captures used in the closing brand montage
- `assets/giverny-ambient-v2-65s.wav` — original ambient soundtrack
