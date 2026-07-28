# Giverny · 36-Second Product Promo Storyboard

**Format:** 1920×1080, 30fps, exactly 36.20 seconds
**Localization:** `?locale=zh` (default) and `?locale=en`; all authored overlay copy and narration switch from one locale dictionary
**Audio:** Kokoro bilingual voiceover variants; minimal warm electronic underscore and restrained paper/ripple SFX if available
**VO direction:** calm, assured, editorial; concise keynote register with visible breathing room between clauses
**Style basis:** `DESIGN.md` and captured production UI
**Motion basis:** seek-safe GSAP timelines, explicit frame-equivalent seconds, crisp UI Bézier entrances, gentle organic brand motion, overlapping transition windows
**Timing source:** final 36.053s Chinese and 31.552s English TTS tracks; authored overlays share a 36.20s deterministic master timeline

## Global Guardrails

- Every beat contains three depth layers and at least two focal points.
- Product screenshots stay readable and occupy 65–88% of the frame at their hero moment.
- Use `fromTo()` for deterministic entrances; never stack two transform tweens on one node.
- Ambient motion is finite, attached to the paused timeline, and varies by beat.
- Primary transition language is an editorial horizontal push; the opening and final return use a gentle focus/blur handoff.
- On-screen localization stays short enough for both Chinese and English at the same font sizes.

## Asset Audit

| Asset | Type | Beat | Role |
| --- | --- | --- | --- |
| `capture/assets/giverny-login-garden.webp` | Brand hero | 1, 5 | Full-bleed opening and closing garden |
| `capture/assets/2026-7.png` | Brand logo | 1, 6 | Opening seal and closing signature |
| `capture/product-ui/dashboard.png` | Product UI | 2 | Workspace overview, metrics, active tasks |
| `capture/product-ui/tasks.png` | Product UI | 3 | Task lifecycle and progress evidence |
| `capture/product-ui/files.png` | Product UI | 3 | Project-based delivery archive |
| `capture/product-ui/settlement.png` | Product UI | 4 | Branded settlement receipt and totals |
| `capture/product-ui/assistant.png` | Product UI | 4 | Alice contextual assistant overlay |

All five product screenshots are used. The brand logo appears first and last. The water-lily garden is the signature visual.

## BEAT 1 — FROM SCATTER TO GARDEN (0.00–5.12s)

**VO ZH:** “创作，不该散落在聊天、表格和网盘里。”
**VO EN:** “Creative work shouldn't be scattered across chats, spreadsheets, and drives.”

**Concept:** We begin already gliding across the water-lily garden. The water surface feels alive, but the center is briefly interrupted by three thin paper fragments—chat, spreadsheet, drive—drifting apart before a single sage line gathers them toward the Giverny mark.

**Visual:** Full-bleed garden slowly pushes from 1.02 to 1.07. A translucent paper veil makes the center readable. Three labeled fragments float at different depths; a hand-drawn sage path connects them. The Giverny logo settles left of the hook line. A small locale label sits at the upper-right.

**Techniques:** SVG path drawing; CSS 3D paper planes; per-word kinetic typography.

**Choreography:** Garden DRIFTS; fragments SEPARATE; connector line DRAWS; logo SETTLES; hook words CASCADE with decreasing travel distance.

**Transition:** Gentle focus push at 4.86s: a paper-colored veil sweeps from right to left while the dashboard enters beneath it.

**Depth:** BG garden; MG paper fragments and connector; FG logo and hook line.

**SFX:** Quiet water texture, three soft paper ticks, one warm low chime when the logo settles.

## BEAT 2 — ONE CLEAR WORKSPACE (5.13–12.31s)

**VO ZH:** “Giverny 把任务、进展与工时，放进同一条清晰链路。”
**VO EN:** “Giverny brings tasks, progress, and time into one clear flow.”

**Concept:** The viewer flies into the live workspace as if the browser were a physical editorial board. Numbers become anchors, status signals form a rhythm, and the selected task detail proves the system is not a static dashboard.

**Visual:** `dashboard.png` occupies 86% of frame in a shallow perspective plane. Three floating metric callouts—90.3h, 9 tasks, 40%—detach from the screenshot at different depths. A sage progress line travels from the task row into the right detail rail. Large localized statement sits in the quiet top-left margin.

**Techniques:** CSS 3D perspective; counter animation; SVG path drawing; screenshot pan.

**Choreography:** Dashboard SLIDES and TILTS into place; metrics COUNT UP; progress line TRACES; active row BRIGHTENS; camera PANS 36px toward the right detail rail.

**Transition:** Editorial horizontal push beginning 12.06s; task view enters from the right with matched `power3.inOut` velocity.

**Depth:** BG paper surface and oversized ghost “FLOW”; MG dashboard; FG metrics and tracing line.

**SFX:** Soft mechanical ticks under the metric count; muted paper slide on transition.

## BEAT 3 — EVIDENCE STAYS WITH THE WORK (12.33–18.61s)

**VO ZH:** “文件随项目归档，交付与验收都可追溯。”
**VO EN:** “Files stay with each project. Delivery and approval remain traceable.”

**Concept:** The task record and project archive become two sides of the same piece of evidence. The task view holds the timeline; the file library folds forward like the next page, keeping delivery attached to context.

**Visual:** `tasks.png` fills the left two-thirds while `files.png` enters as a front plane on the right. Three status chips—进行中 / 已验收 / 归档—move along a drawn lifecycle rail. A small evidence thumbnail lifts from the task timeline and lands inside the file project group.

**Techniques:** CSS 3D page turn; MotionPath-style SVG guide; kinetic labels; screenshot focus pull.

**Choreography:** Task rows CASCADE; status rail DRAWS; evidence thumbnail LIFTS and GLIDES; file plane FOLDS forward; approval label STAMPS once without bounce.

**Transition:** Deep-sage editorial wipe at 18.45s. The evidence planes remain visible until Alice covers them.

**Depth:** BG muted task screenshot; MG file archive plane; FG lifecycle rail, chips, and moving evidence thumbnail.

**SFX:** Three soft status clicks and a muted archive thump.

## BEAT 4 — VERIFIED ASSISTANCE (18.72–25.91s)

**VO ZH:** “爱丽丝会读取真实业务上下文，先分析、再验真，写入前向你确认。”
**VO EN:** “Alice reads real business context, analyzes first, verifies the facts, and asks before anything is written.”

**Concept:** Alice arrives as a governed product layer, not a disconnected chatbot. The scene makes trust visible: read, observe, verify, then ask for review before writing.

**Visual:** A deep-sage field anchors a localized thesis on the left. On the right, a bright execution panel traces three verified steps and ends with a review action, echoing the real `assistant.png` interaction pattern.

**Techniques:** Editorial panel push; verified-step path drawing; per-line cascade; finite agent-orb rotation.

**Choreography:** Thesis RISES; agent panel PUSHES in; execution steps CASCADE; verification path DRAWS; review action SETTLES.

**Transition:** Paper-colored wipe at 25.65s reveals the settlement receipt.

**Depth:** BG deep sage field; MG agent panel; FG execution markers and review action.

**SFX:** Quiet scan ticks, subtle confirmation chime, soft assistant-panel glide.

## BEAT 5 — FROM WORK TO PROOF (25.92–31.59s)

**VO ZH:** “月底，结算回单一键生成，数据、文件和金额都能清楚分享。”
**VO EN:** “At month end, generate a settlement receipt in one click, ready to review and share.”

**Concept:** The workflow resolves into formal, shareable evidence. This is the product payoff: the same task, time, file, and approval records become a settlement receipt without rebuilding the story in a spreadsheet.

**Visual:** The captured `settlement.png` fills the receipt plane. The camera pushes toward the branded table while the localized claim explains preview, export, sharing, and archive.

**Techniques:** Screenshot focus push; table scan; editorial text rise; deterministic scale drift.

**Choreography:** Receipt UNFOLDS; table rows SCAN into focus; proof statement RISES; export actions CASCADE.

**Transition:** Sage wipe at 31.32s returns to the brand resolution.

**Depth:** BG paper field; MG real settlement UI; FG localized proof statement.

**SFX:** Receipt stamp and restrained confirmation tone.

## BEAT 6 — BRAND RESOLUTION (31.59–36.20s)

**VO ZH:** “Giverny，让可靠的工作留下证据，也让创作在自己的花园里生长。”
**VO EN:** “Giverny makes reliable work traceable—and lets creation grow in its own garden.”

**Concept:** We return to the same garden, now calmer and more open. The product flow has resolved into a single idea: reliable work can still feel human, seasonal, and alive.

**Visual:** Garden fills the frame with a slower reverse pan. A faint horizontal ripple expands under the centered logo. The localized tagline types on in two clauses, followed by `mayeai.com` and a compact “Product demo · fictional data” note.

**Techniques:** Logo reveal; SVG ripple drawing; per-word kinetic typography; slow deterministic Ken Burns.

**Choreography:** Garden OPENS; ripple EXPANDS; logo RISES; tagline TYPES ON; URL SETTLES. Final 0.6s holds almost still, then elements soften by 4% opacity for closure.

**Transition / Exit:** Final-scene-only gentle fade to paper white from 35.70–36.20s.

**Depth:** BG garden; MG ripple and soft veil; FG logo, tagline, URL.

**SFX:** One resolved piano/synth chord with water tail.

## Production Architecture

```text
giverny-product-promo/
├── index.html
├── DESIGN.md
├── SCRIPT.md
├── STORYBOARD.md
├── locales.js
├── narration.zh.wav
├── narration.en.wav
├── transcript.zh.json
├── transcript.en.json
├── capture/
│   ├── assets/
│   ├── product-ui/
│   ├── screenshots/
│   └── extracted/
├── compositions/
│   ├── beat-1-garden.html
│   ├── beat-2-workspace.html
│   ├── beat-3-evidence.html
│   ├── beat-4-settlement-agent.html
│   └── beat-5-brand.html
└── snapshots/
```
