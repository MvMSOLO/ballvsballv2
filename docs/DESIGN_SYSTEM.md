# Ball Arena — Design System Foundations

## Product direction

Arena Forge is a premium competitive game interface inspired by gaming hardware: deep graphite surfaces, signal-red for primary action, electric blue for information and focus, warm gold for reward/value, and restrained green for success/online states. The identity is original; it does not reuse REDMAGIC branding or assets.

The interface should support gameplay rather than compete with it. Idle screens remain calm; high-intensity motion and sound are reserved for meaningful events. UI must remain readable on mobile, support reduced motion and keyboard focus, and tell the truth about the product's current functionality.

## Source of truth

- Tokens and route-level art direction: `src/design-system.css`
- Reusable UI primitives: `src/ui-primitives.css`
- Root stylesheet registration and fonts: `src/routes/__root.tsx`
- Automated contract gate: `scripts/check-design-system.mjs`
- Validation runs at the start of `npm run build` and within `npm test`.

## Token families

| Family | Examples | Use |
|---|---|---|
| Core palette | `--ba-void`, `--ba-panel`, `--ba-red`, `--ba-blue` | Visual identity and surfaces |
| Semantic colors | `--ba-color-brand`, `--ba-color-info`, `--ba-color-success`, `--ba-color-danger` | State meaning; prefer these in components |
| Typography | `--ba-font-display`, `--ba-font-body`, `--ba-font-data`, `--ba-text-sm` | Display, reading, and technical data |
| Spacing | `--ba-space-1` through `--ba-space-20` | Consistent spacing based on a 4 px rhythm |
| Shape | `--ba-radius-xs` through `--ba-radius-pill` | Panels, cards, controls, and chips |
| Elevation | `--ba-shadow-sm`, `--ba-shadow-md`, `--ba-shadow-deep` | Depth hierarchy; avoid glowing every surface |
| Motion | `--ba-motion-fast`, `--ba-motion-ui`, `--ba-motion-scene`, easing tokens | Reusable timing and easing |
| Layers | `--ba-layer-world` through `--ba-layer-critical` | Predictable overlays and HUD stacking |
| Controls | `--ba-control-sm`, `--ba-control-md`, `--ba-touch-target` | Consistent control sizes and mobile hit targets |

## Primitive classes

### Layout and typography

- `.ba-page`, `.ba-stack`, `.ba-row`, `.ba-cluster`, `.ba-grid`
- `.ba-eyebrow`, `.ba-title`, `.ba-body-copy`, `.ba-caption`, `.ba-data`, `.ba-truncate`

### Surfaces and actions

- `.ba-card`, `.ba-card-pad`, `.ba-card-interactive`, `.ba-card-selected`
- `.ba-button`, `.ba-button-primary`, `.ba-button-secondary`, `.ba-button-quiet`, `.ba-button-danger`
- `.ba-icon-button`
- `.ba-field`, `.ba-field-label`, `.ba-field-control`, `.ba-field-help`, `.ba-field-error`
- `.ba-badge`, `.ba-chip`, `.ba-divider`, `.ba-status-dot`, `.ba-progress`
- `.ba-skeleton`, `.ba-empty-state`, `.ba-visually-hidden`

These primitives are intentionally additive. Route-specific screens should migrate to them in later phases rather than having all existing markup forcibly replaced during the foundation phase.

## Interaction and accessibility rules

1. Interactive controls have clear hover, press, disabled, and keyboard-focus states.
2. Never rely on color alone for success, error, selected, ownership, or status.
3. Use labels and accessible names for icon-only actions; keep visible navigation labels when space allows.
4. Touch targets should generally be at least 44 px even where the visible icon is smaller.
5. Honor `prefers-reduced-motion`; avoid looping attention-grabbing animation for core navigation.
6. Support forced-colors mode, text wrapping, safe areas, and narrow screens.
7. Destructive actions require explicit confirmation. Loading, empty, failure, and success states must be designed—not left to browser defaults.
8. Do not use fictional player counts, false online status, fake checkout, or other misleading UI.

## Change policy

- Use existing tokens before introducing new values.
- Add a semantic token if a value has product-wide meaning; avoid scattered one-off hex codes.
- Keep the component API additive until a route is migrated and tested.
- Test desktop, narrow mobile, landscape, keyboard focus, reduced motion, and disabled/error states.
- The validator checks contract coverage and CSS brace balance. It is not a substitute for a browser visual review, accessibility audit, or full project build.
