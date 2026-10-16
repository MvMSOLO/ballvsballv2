import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { defaultSave, loadSave, writeSave, type Save, type SaveSettings } from "@/economy/save";
import { hydrateArenaSave, syncArenaSave } from "@/economy/persistence";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authEnabled } from "@/lib/auth/client";
import { PortalShell } from "@/components/portal-shell";
import { setAudioLevels, setMuted, sfx, unlockAudio } from "../audio/synth";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function announceSettingsChange(save: Save) {
  window.dispatchEvent(new CustomEvent("ball-arena-settings-change", { detail: save }));
}

function applyAudioSettings(save: Save, startAmbience = false) {
  setAudioLevels({
    master: save.settings.master,
    music: save.settings.music,
    ui: save.settings.ui,
    sfx: save.settings.sfx,
  });
  setMuted(!save.settings.sound, startAmbience);
}

function SettingsPage() {
  const { user, isPending } = useCurrentUserState();
  const cloudSync = authEnabled && Boolean(user && !user.isDevFallback);
  const saveTimer = useRef<number | undefined>(undefined);
  const syncRevision = useRef(0);
  const [save, setSave] = useState<Save>(() => defaultSave());
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const local = loadSave();
    setSave(local);
    applyAudioSettings(local);
    announceSettingsChange(local);
    if (cloudSync) {
      void hydrateArenaSave(local).then((merged) => {
        setSave(merged);
        applyAudioSettings(merged);
        announceSettingsChange(merged);
      }).catch(() => setNotice("Cloud settings unavailable; local preferences are loaded."));
    }
  }, [cloudSync, isPending]);

  useEffect(() => () => {
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current);
  }, []);

  function update<K extends keyof SaveSettings>(key: K, value: SaveSettings[K]) {
    const next = { ...save, settings: { ...save.settings, [key]: value } };
    const revision = ++syncRevision.current;
    setSave(next);
    if (key === "sound") setMuted(!next.settings.sound, next.settings.sound);
    if (key === "master" || key === "music" || key === "ui" || key === "sfx") {
      setAudioLevels({ master: next.settings.master, music: next.settings.music, ui: next.settings.ui, sfx: next.settings.sfx });
    }
    try {
      writeSave(next);
      announceSettingsChange(next);
      setNotice(cloudSync ? "Saved on this device · syncing account…" : "Settings saved on this device.");
    } catch {
      setNotice("Settings could not be saved. Check this browser's storage permissions.");
      return;
    }
    if (cloudSync) {
      if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void syncArenaSave(next).then((merged) => {
          if (revision !== syncRevision.current) return;
          setSave(merged);
          announceSettingsChange(merged);
          setNotice("Settings saved and synced to your account.");
        }).catch(() => {
          if (revision === syncRevision.current) setNotice("Settings saved locally, but cloud sync failed.");
        });
      }, 650);
    }
  }

  function resetProgress() {
    if (!window.confirm("Reset all local game progress and preferences on this device? This cannot be undone. Account-synced progress is not deleted and may return after a future sync.")) return;
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current);
    syncRevision.current += 1;
    try { window.localStorage.removeItem("ball-arena-save"); } catch { /* writeSave handles storage denial below. */ }
    const next = defaultSave();
    setSave(next);
    try {
      writeSave(next);
      announceSettingsChange(next);
      setNotice("Local progress and preferences were reset on this device. Cloud account data was not deleted.");
    } catch {
      announceSettingsChange(next);
      setNotice("The reset could not be persisted in this browser. Cloud account data was not changed.");
    }
  }

  return <PortalShell active="settings" title="GAME SETTINGS" description="Tune the arena to your device and play style. These controls update saved preferences; local reset never deletes account data.">
    <section className="portal-panel settings-panel">
      <div className="portal-section-heading"><span className="portal-kicker">01 / DISPLAY</span><h2>Language & graphics</h2><p className="settings-category-intro">Auto adjusts rendering quality only after sustained frame-time changes. Low, Medium, and High stay fixed when selected here.</p></div>
      <div className="settings-list">
        <label className="setting-row"><span><strong>Language</strong><small>Saved as the interface locale; some screens may still display English.</small></span><select aria-label="Interface language" value={save.settings.lang} onChange={(event) => update("lang", event.target.value as SaveSettings["lang"])}><option value="en">English</option><option value="uz">O‘zbekcha</option><option value="ru">Русский</option></select></label>
        <label className="setting-row"><span><strong>Graphics quality</strong><small>Lower settings can help integrated GPUs and older phones.</small></span><select aria-label="Graphics quality" value={save.settings.quality} onChange={(event) => update("quality", event.target.value as SaveSettings["quality"])}><option value="auto">Auto</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      </div>
    </section>

    <section className="portal-panel settings-panel">
      <div className="portal-section-heading"><span className="portal-kicker">02 / ACCESSIBILITY</span><h2>Controls & comfort</h2><p className="settings-category-intro">Adjust input layout and reduce nonessential interface motion. The game simulation itself still runs normally.</p></div>
      <div className="settings-list">
        <label className="setting-row"><span><strong>Left-handed controls</strong><small>Move the virtual joystick to the preferred side where supported.</small></span><input aria-label="Left-handed controls" type="checkbox" checked={save.settings.leftHanded} onChange={(event) => update("leftHanded", event.target.checked)} /></label>
        <label className="setting-row"><span><strong>Haptic feedback</strong><small>Preference for vibration on supported mobile devices.</small></span><input aria-label="Haptic feedback" type="checkbox" checked={save.settings.haptics} onChange={(event) => update("haptics", event.target.checked)} /></label>
        <label className="setting-row"><span><strong>Reduce interface motion</strong><small>Shortens or disables nonessential UI transitions and animations.</small></span><input aria-label="Reduce interface motion" type="checkbox" checked={save.settings.reduceMotion} onChange={(event) => update("reduceMotion", event.target.checked)} /></label>
        <label className="setting-row"><span><strong>Color-blind friendly palette</strong><small>Changes shared semantic UI colors; text labels remain alongside color.</small></span><input aria-label="Color-blind friendly palette" type="checkbox" checked={save.settings.colorblind} onChange={(event) => update("colorblind", event.target.checked)} /></label>
      </div>
    </section>

    <section className="portal-panel settings-panel settings-audio-panel">
      <div className="portal-section-heading"><span className="portal-kicker">03 / AUDIO</span><h2>Audio mixer</h2><p className="settings-category-intro">Master scales all audio; ambience controls the quiet arena air bed, while SFX controls synthesized and sampled effects.</p></div>
      <div className="settings-list">
        <label className="setting-row"><span><strong>Sound enabled</strong><small>Mute or restore all game and interface sounds.</small></span><input aria-label="Sound enabled" type="checkbox" checked={save.settings.sound} onChange={(event) => update("sound", event.target.checked)} /></label>
      </div>
      <div className="volume-grid">
        <label>MASTER <strong>{Math.round(save.settings.master * 100)}%</strong><input aria-label="Master audio volume" type="range" min="0" max="1" step="0.05" value={save.settings.master} onChange={(event) => update("master", Number(event.target.value))} /></label>
        <label>AMBIENCE <strong>{Math.round(save.settings.music * 100)}%</strong><input aria-label="Arena ambience volume" type="range" min="0" max="1" step="0.05" value={save.settings.music} onChange={(event) => update("music", Number(event.target.value))} /></label>
        <label>INTERFACE <strong>{Math.round(save.settings.ui * 100)}%</strong><input aria-label="Interface sound volume" type="range" min="0" max="1" step="0.05" value={save.settings.ui} onChange={(event) => update("ui", Number(event.target.value))} /></label>
        <label>EFFECTS <strong>{Math.round(save.settings.sfx * 100)}%</strong><input aria-label="Gameplay sound effects volume" type="range" min="0" max="1" step="0.05" value={save.settings.sfx} onChange={(event) => update("sfx", Number(event.target.value))} /></label>
      </div>
      <div className="audio-preview-row" aria-label="Audio preview controls">
        <span className="portal-kicker">SOUND CHECK</span>
        <button className="portal-button" type="button" onClick={() => { unlockAudio(); sfx("confirm"); }}>UI CONFIRM</button>
        <button className="portal-button" type="button" onClick={() => { unlockAudio(); sfx("hit"); }}>IMPACT</button>
        <button className="portal-button" type="button" onClick={() => { unlockAudio(); sfx("win"); }}>VICTORY</button>
      </div>
      {notice && <p className="portal-notice" role="status" aria-live="polite">{notice}</p>}
    </section>

    <section className="portal-panel danger-panel">
      <div><span className="portal-kicker">04 / LOCAL DATA</span><h2>Reset this device</h2><p>This clears the locally stored wallet, collection, match history, and preferences for this browser. It does not delete server-side account data; progress from a signed-in account can return when the next cloud sync occurs.</p></div>
      <button className="portal-button danger" type="button" onClick={resetProgress}>RESET LOCAL PROGRESS</button>
    </section>
  </PortalShell>;
}
