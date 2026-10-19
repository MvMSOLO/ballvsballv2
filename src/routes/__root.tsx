import { useEffect } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { ArenaEntryExperience } from "@/components/arena-entry-experience";
import { loadSave, type Save } from "@/economy/save";
import { setAudioLevels, setMuted } from "@/audio/synth";
import appCss from "../styles.css?url";
import designSystemCss from "../design-system.css?url";
import uiPrimitivesCss from "../ui-primitives.css?url";
import nextgenUiCss from "../nextgen-ui.css?url";

const APP_NAME = "BALL ARENA";

function SavedPreferenceRuntime() {
  useEffect(() => {
    const apply = (save: Save) => {
      const settings = save.settings;
      document.documentElement.lang = settings.lang;
      document.documentElement.dataset.reduceMotion = String(settings.reduceMotion);
      document.documentElement.dataset.colorblind = String(settings.colorblind);
      setAudioLevels({ master: settings.master, music: settings.music, sfx: settings.sfx });
      // A settings-page visit must not start ambience without a user gesture.
      setMuted(!settings.sound, false);
    };
    const loadAndApply = () => {
      try { apply(loadSave()); } catch { /* Keep browser/app defaults if storage is blocked. */ }
    };
    const onSettingsChange = (event: Event) => {
      const detail = (event as CustomEvent<Save>).detail;
      if (detail && typeof detail === "object" && detail.settings) {
        try { apply(detail); } catch { loadAndApply(); }
      } else loadAndApply();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "ball-arena-save") loadAndApply();
    };
    loadAndApply();
    window.addEventListener("ball-arena-settings-change", onSettingsChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("ball-arena-settings-change", onSettingsChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}

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
      { rel: "stylesheet", href: nextgenUiCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body>
        <SavedPreferenceRuntime />
        <PreviewHostBridge />
        <AuthProvider><Outlet /></AuthProvider>
        <ArenaEntryExperience />
        <Scripts />
      </body>
    </html>
  ),
});
