# Phase 12 — Adaptive Performance Intelligence

## Scope

Phase 12 improves the existing Three.js quality governor rather than adding a second competing renderer. In **Auto** mode, the renderer uses sustained frame-time samples and hysteresis to choose Low, Medium, or High. A short spike must not churn the canvas size or quality setting.

- High -> Medium after sustained frame times above 24 ms.
- Medium -> Low after sustained frame times above 29 ms.
- Low -> Medium only after 8 seconds below 19 ms.
- Medium -> High only after 10 seconds below 16 ms.
- Every transition starts a 4-second cooldown.
- Time samples are capped so background-tab resume pauses cannot instantly downgrade quality.

A player selecting Low, Medium, or High in the arena gets a fixed preset. Choosing **Auto** in Settings enables the governor again. The HUD identifies automatic mode and shows the actual current rendering preset.

## Validation

The pure policy is covered by Node's built-in test runner. CI must additionally pass typecheck, lint, arena tests, pack validation, and production build before this phase is merged. Automated policy tests do not replace visual and performance checks on representative phones.
