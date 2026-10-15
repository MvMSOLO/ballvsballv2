import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";
import designSystemCss from "../design-system.css?url";
import uiPrimitivesCss from "../ui-primitives.css?url";

const APP_NAME = "BALL ARENA";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#080a0e" },
      { name: "description", content: "Enter Ball Arena: choose your ball, lock your aim, and let physics settle the fight." },
      { property: "og:site_name", content: "BALL ARENA" },
      { property: "og:title", content: "BALL ARENA — Physics Duel League" },
      { property: "og:description", content: "Choose your ball. Lock your aim. Let physics settle the fight." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/brand/ball-arena-wordmark.svg" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "BALL ARENA — Physics Duel League" },
      { name: "twitter:description", content: "Choose your ball. Lock your aim. Let physics settle the fight." },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: designSystemCss },
      { rel: "stylesheet", href: uiPrimitivesCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body>
        <PreviewHostBridge />
        <AuthProvider><Outlet /></AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
