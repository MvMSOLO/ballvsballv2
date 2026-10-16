# Phase 13 — Mobile Session Lifecycle & Graphics Recovery

## Scope

- Pause the arena's render/simulation loop when the document is hidden or the WebGL context is lost.
- Reset RAF timing on resume so elapsed background time is not injected into the next frame.
- Clear held keyboard/touch/joystick inputs on hide, blur, page navigation, or graphics-context loss to prevent stuck movement.
- Let Three.js handle context restoration, then resize the renderer and resume only when the page is visible.
- Show an accessible recovery overlay while WebGL is unavailable.
- Test lifecycle transitions as a pure policy and add a design-system contract so the integration cannot silently disappear.

## Behavior

A hidden local match pauses rather than simulating while the player is away; it resumes from the same session when the tab/app becomes visible again. If WebGL restoration fails, the overlay stays visible instead of repeatedly trying to render into an unavailable context.

Automated checks validate the policy and app build, but do not replace real-device testing on Android WebView and mobile browsers.
