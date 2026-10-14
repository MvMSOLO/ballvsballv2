import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { defaultSave, loadSave, writeSave, type Save, type SaveSettings } from "@/economy/save";
import { syncArenaSave } from "@/economy/persistence";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authEnabled } from "@/lib/auth/client";
import { PortalShell } from "@/components/portal-shell";

export const Route = createFileRoute("/settings")({ component: SettingsPage });
function SettingsPage() {
  const { user, isPending } = useCurrentUserState();
  const cloudSync = authEnabled && Boolean(user && !user.isDevFallback);
  const saveTimer = useRef<number | undefined>(undefined);
  const [save, setSave] = useState<Save>(() => defaultSave());
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const local = loadSave();
    setSave(local);
    if (cloudSync) {
      void syncArenaSave(local).then(setSave).catch(() => setNotice("Cloud settings unavailable; local preferences are loaded."));
    }
  }, [cloudSync, isPending]);
  useEffect(() => () => {
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current);
  }, []);
  function update<K extends keyof SaveSettings>(key: K, value: SaveSettings[K]) {
    const next = { ...save, settings: { ...save.settings, [key]: value } };
    setSave(next);
    try {
      writeSave(next);
      setNotice(cloudSync ? "Settings saved locally · syncing account…" : "Settings saved on this device.");
    } catch {
      setNotice("Settings could not be saved.");
      return;
    }
    if (cloudSync) {
      if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void syncArenaSave(next).then((merged) => {
          setSave(merged);
          setNotice("Settings saved and synced to your account.");
        }).catch(() => setNotice("Settings saved locally, but cloud sync failed."));
      }, 650);
    }
  }
  function resetProgress() {
    if (!window.confirm("Reset local game progress on this device? This cannot be undone.")) return;
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current);
    try { window.localStorage.removeItem("ball-arena-save"); } catch { /* ignore */ }
    const next = defaultSave();
    setSave(next);
    try { writeSave(next); } catch { /* ignore */ }
    setNotice("Local progress has been reset.");
  }
  return <PortalShell active="settings" title="GAME SETTINGS" description="Tune local controls, audio, language, and accessibility preferences.">
    <section className="portal-panel settings-panel"><div className="portal-section-heading"><span className="portal-kicker">PREFERENCES</span><h2>Gameplay & display</h2></div>
      <div className="settings-list">
        <label className="setting-row"><span><strong>Language</strong><small>Interface language preference</small></span><select value={save.settings.lang} onChange={(event) => update("lang", event.target.value as SaveSettings["lang"])}><option value="en">English</option><option value="uz">O‘zbekcha</option><option value="ru">Русский</option></select></label>
        <label className="setting-row"><span><strong>Graphics quality</strong><small>Lower settings may improve performance on phones</small></span><select value={save.settings.quality} onChange={(event) => update("quality", event.target.value as SaveSettings["quality"])}><option value="auto">Auto</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        <label className="setting-row"><span><strong>Sound effects</strong><small>Combat and interface audio preference</small></span><input type="checkbox" checked={save.settings.sound} onChange={(event) => update("sound", event.target.checked)} /></label>
        <label className="setting-row"><span><strong>Haptic feedback</strong><small>Preference for supported mobile devices</small></span><input type="checkbox" checked={save.settings.haptics} onChange={(event) => update("haptics", event.target.checked)} /></label>
        <label className="setting-row"><span><strong>Left-handed controls</strong><small>Preferred joystick side</small></span><input type="checkbox" checked={save.settings.leftHanded} onChange={(event) => update("leftHanded", event.target.checked)} /></label>
        <label className="setting-row"><span><strong>Reduce motion</strong><small>Accessibility preference for less animation</small></span><input type="checkbox" checked={save.settings.reduceMotion} onChange={(event) => update("reduceMotion", event.target.checked)} /></label>
        <label className="setting-row"><span><strong>Color-blind friendly</strong><small>Color accessibility preference</small></span><input type="checkbox" checked={save.settings.colorblind} onChange={(event) => update("colorblind", event.target.checked)} /></label>
      </div>
      <div className="portal-section-heading settings-audio-heading"><span className="portal-kicker">AUDIO MIXER</span><h2>Volume levels</h2></div>
      <div className="volume-grid">
        <label>MASTER <strong>{Math.round(save.settings.master * 100)}%</strong><input type="range" min="0" max="1" step="0.05" value={save.settings.master} onChange={(event) => update("master", Number(event.target.value))} /></label>
        <label>MUSIC <strong>{Math.round(save.settings.music * 100)}%</strong><input type="range" min="0" max="1" step="0.05" value={save.settings.music} onChange={(event) => update("music", Number(event.target.value))} /></label>
        <label>SFX <strong>{Math.round(save.settings.sfx * 100)}%</strong><input type="range" min="0" max="1" step="0.05" value={save.settings.sfx} onChange={(event) => update("sfx", Number(event.target.value))} /></label>
      </div>
      {notice && <p className="portal-notice" role="status">{notice}</p>}
    </section>
    <section className="portal-panel danger-panel"><div><span className="portal-kicker">LOCAL DATA</span><h2>Reset this device</h2><p>This clears the locally stored wallet, collection, match history, and settings for this browser. Account-synced progress can return on a later sync.</p></div><button className="portal-button danger" onClick={resetProgress}>RESET LOCAL PROGRESS</button></section>
  </PortalShell>;
}
