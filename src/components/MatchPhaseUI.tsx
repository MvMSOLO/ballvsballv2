/**
 * Next-gen match phase UI: pick cards, aim dial, fight HP bars, results.
 */
import type { BallDef, Action } from "@/sim/types";
import { AnimatedAimDial } from "@/components/AnimatedAimDial";
import { BallCardSvg } from "@/components/BallCardSvg";
import { FightHpBar } from "@/components/FightHpBar";

type OfferView = {
  offers: string[];
  picked: number;
  confirmed: boolean;
  rerollCost: number;
  oppStatus: string;
  aimLocked: boolean;
  oppAimLocked: boolean;
  hp: [number, number];
  maxHp: [number, number];
  round: number;
  hearts: [number, number];
  names: [string, string];
  timer: number;
  sudden?: boolean;
  matchSpeed?: number;
  matchWinner?: number;
  roundWinner?: number;
  oppBall?: string;
};

type Props = {
  flow: string;
  view: OfferView;
  aim: number;
  setAim: (n: number) => void;
  send: (cmd: { t: string; side: number; index?: number; angle?: number }) => void;
  ballMap: Map<string, BallDef>;
  selectedBall?: BallDef;
  opponentBall?: BallDef;
  reduceMotion: boolean;
  opponentName: string;
  onInspect: (ball: BallDef) => void;
  onRematch: () => void;
  onLobby: () => void;
  coinsReward?: number;
  xpReward?: number;
  abilityTriggerLabel: (trigger: string, interval?: number) => string;
  actionLabel: (action: Action) => string;
  abilityGlyph: (action?: Action) => string;
};

export function MatchPhaseUI({
  flow, view, aim, setAim, send, ballMap, selectedBall, opponentBall,
  reduceMotion, opponentName, onInspect, onRematch, onLobby,
  coinsReward = 0, xpReward = 0,
  abilityTriggerLabel, actionLabel, abilityGlyph,
}: Props) {
  return (
    <section
      className={
        "match-hud " +
        (flow === "fight" ? "fight-hud" : flow === "end" || flow === "round" ? "result-hud" : "setup-hud")
      }
      data-phase={flow}
    >
      <div className="match-head">
        <span className="eyebrow">ROUND {view.round} / BEST OF HEARTS</span>
        <strong>
          {view.names[0]} <i>VS</i> {view.names[1]}
        </strong>
        <div className="hearts">
          <span>{"♥ ".repeat(view.hearts[0])}</span>
          <span>{"♥ ".repeat(view.hearts[1])}</span>
        </div>
      </div>
      <div className="phase-chip">
        {flow === "pick"
          ? "01 · CHOOSE YOUR BALL"
          : flow === "aim"
            ? "02 · SET YOUR AIM"
            : flow === "countdown"
              ? "LOCKED IN"
              : flow === "fight"
                ? "AUTO FIGHT"
                : flow === "round"
                  ? view.roundWinner === 0
                    ? "ROUND WON"
                    : "ROUND LOST"
                  : "MATCH COMPLETE"}{" "}
        <span>
          {flow === "fight"
            ? view.sudden
              ? "SUDDEN DEATH"
              : view.matchSpeed === 2
                ? "2× SPEED"
                : "LIVE MATCH"
            : `${Math.max(0, Math.ceil(view.timer))}s`}
        </span>
      </div>

      {flow === "pick" && (
        <div className="pick-area">
          <p className="subline">Choose one of your owned balls. Your opponent&apos;s pick stays hidden.</p>
          <div className="ball-cards">
            {view.offers.length === 0 ? (
              <div className="ba-empty-state pick-empty-state" role="status">
                <strong>NO BALL OFFERS</strong>
                <span>Refresh offers to keep drafting.</span>
              </div>
            ) : (
              view.offers.map((id, index) => {
                const ball = ballMap.get(id);
                if (!ball) return null;
                const firstAbility = ball.abilities[0];
                const abilityName =
                  firstAbility?.actions.slice(0, 2).map(actionLabel).join(" + ") || "PHYSICS IMPACT";
                const skillWindow =
                  firstAbility?.cooldown ?? firstAbility?.interval ?? firstAbility?.seconds;
                const skillMeta = firstAbility
                  ? skillWindow !== undefined
                    ? `WINDOW ${skillWindow.toFixed(1)}S`
                    : `${firstAbility.actions.length} EFFECT${firstAbility.actions.length === 1 ? "" : "S"}`
                  : "CONTACT PASSIVE";
                return (
                  <article
                    key={id}
                    className={
                      "ball-card " +
                      (view.picked === index ? "selected " : "") +
                      (view.confirmed ? "confirmed" : "")
                    }
                    data-ball-id={ball.id}
                  >
                    <button
                      type="button"
                      className="ball-card-select"
                      disabled={view.confirmed}
                      onClick={() => send({ t: "pick", side: 0, index })}
                      aria-pressed={view.picked === index}
                      aria-label={
                        "Select " + ball.name.en + (view.picked === index ? ", selected" : "")
                      }
                    >
                      <div className="ball-card-meta">
                        <span className={"rarity rarity-" + ball.rarity}>{ball.rarity}</span>
                        {view.picked === index && (
                          <span className="ball-card-pick-state">
                            {view.confirmed ? "✓ LOCKED IN" : "✓ SELECTED"}
                          </span>
                        )}
                      </div>
                      <BallCardSvg
                        ball={ball}
                        selected={view.picked === index}
                        confirmed={view.confirmed}
                        reduceMotion={reduceMotion}
                      />
                      <h3>{ball.name.en}</h3>
                      <small>
                        {ball.ai_hints.role.toUpperCase()} · {ball.stats.hp} HP
                      </small>
                      <div className="ball-stat-bars" aria-label="Ball combat stats">
                        <span>
                          <i>HP</i>
                          <b>
                            <em style={{ width: Math.min(100, (ball.stats.hp / 220) * 100) + "%" }} />
                          </b>
                        </span>
                        <span>
                          <i>SPD</i>
                          <b>
                            <em
                              style={{ width: Math.min(100, (ball.stats.speed / 22) * 100) + "%" }}
                            />
                          </b>
                        </span>
                        <span>
                          <i>DMG</i>
                          <b>
                            <em
                              style={{
                                width: Math.min(100, (ball.stats.contactDamage / 16) * 100) + "%",
                              }}
                            />
                          </b>
                        </span>
                      </div>
                      <span className="ability-chip">
                        <i>
                          {abilityTriggerLabel(
                            firstAbility?.trigger ?? "onBallHit",
                            firstAbility?.interval,
                          )}
                        </i>
                        <b>
                          <em className="ability-glyph">{abilityGlyph(firstAbility?.actions[0])}</em>
                          <span>{abilityName}</span>
                        </b>
                        <small>
                          {skillMeta}
                          {ball.abilities.length > 1 ? ` · +${ball.abilities.length - 1} SKILLS` : ""}
                        </small>
                      </span>
                      <p>{ball.description.en}</p>
                    </button>
                    <button
                      type="button"
                      className="ball-card-inspect"
                      aria-label={"Inspect " + ball.name.en + " in 3D"}
                      title={"Inspect " + ball.name.en}
                      onClick={() => onInspect(ball)}
                    >
                      3D <span>↗</span>
                    </button>
                  </article>
                );
              })
            )}
          </div>
          <div className="action-row">
            <button
              className="secondary-button"
              disabled={view.confirmed}
              title={view.confirmed ? "Pick confirmed — reroll locked" : "Reroll your current offers"}
              onClick={() => send({ t: "reroll", side: 0 })}
            >
              {view.rerollCost === 0 ? "↻ FREE REROLL" : `↻ REROLL · ◈ ${view.rerollCost}`}
            </button>
            <button
              className="primary-button compact"
              disabled={view.offers.length === 0 || view.picked < 0 || view.confirmed}
              onClick={() => send({ t: "confirm", side: 0 })}
            >
              CONFIRM PICK ↗
            </button>
          </div>
          <p className="hint-line">
            Opponent: {view.oppStatus === "locked" ? "LOCKED IN" : "CHOOSING…"}
          </p>
        </div>
      )}

      {flow === "aim" && (
        <div className="aim-area">
          <h2>Set your launch vector</h2>
          <p>Drag the dial or swipe — your aim stays secret until both lock in.</p>
          <AnimatedAimDial
            angle={aim}
            locked={Boolean(view.aimLocked)}
            reduceMotion={reduceMotion}
            onChange={(n) => {
              setAim(n);
              send({ t: "aim", side: 0, angle: (n * Math.PI) / 180 });
            }}
            onLock={() => send({ t: "lock", side: 0 })}
          />
          <div className="aim-secret-badge" role="status">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 3l7 4v5c0 5-3 9-7 10-4-1-7-5-7-10V7l7-4z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path d="M12 11v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Opponent: {view.oppAimLocked ? "LOCKED" : "AIMING…"} · SECRET
          </div>
        </div>
      )}

      {flow === "countdown" && (
        <div className="status-panel">
          <div className="pulse-ring">{Math.max(1, Math.ceil(view.timer))}</div>
          <h2>GET READY</h2>
          <p>Balls revealed. The duel starts automatically.</p>
        </div>
      )}

      {flow === "fight" && (
        <div className="fight-panel">
          <div className="fight-player">
            <span>YOUR BALL</span>
            <b>{selectedBall?.name.en ?? "Locked"}</b>
            <FightHpBar
              current={view.hp[0]}
              max={view.maxHp[0]}
              accent={selectedBall?.visual?.baseColor ?? "#4aa3ff"}
              label="HP"
              side="you"
              reduceMotion={reduceMotion}
            />
            <em
              className="fight-ability"
              style={{ color: selectedBall?.visual?.accentColor ?? "#80c4ff" }}
            >
              {selectedBall?.abilities[0]
                ? `${abilityGlyph(selectedBall.abilities[0].actions[0])} ${abilityTriggerLabel(selectedBall.abilities[0].trigger, selectedBall.abilities[0].interval)} · ${selectedBall.abilities[0].actions.slice(0, 2).map(actionLabel).join(" + ")}`
                : "PHYSICS IMPACT"}
            </em>
          </div>
          <div className="fight-vs">VS</div>
          <div className="fight-player">
            <span>RIVAL BALL</span>
            <b>{opponentBall?.name.en ?? "Rival"}</b>
            <FightHpBar
              current={view.hp[1]}
              max={view.maxHp[1]}
              accent={opponentBall?.visual?.baseColor ?? "#ff657b"}
              label="HP"
              side="rival"
              reduceMotion={reduceMotion}
            />
            <em
              className="fight-ability"
              style={{ color: opponentBall?.visual?.accentColor ?? "#fb7185" }}
            >
              {opponentBall?.abilities[0]
                ? `${abilityGlyph(opponentBall.abilities[0].actions[0])} ${abilityTriggerLabel(opponentBall.abilities[0].trigger, opponentBall.abilities[0].interval)} · ${opponentBall.abilities[0].actions.slice(0, 2).map(actionLabel).join(" + ")}`
                : "PHYSICS IMPACT"}
            </em>
          </div>
        </div>
      )}

      {(flow === "round" || flow === "end") && (
        <div
          className={
            "status-panel " +
            (flow === "end"
              ? view.matchWinner === 0
                ? "result-victory"
                : "result-defeat"
              : view.roundWinner === 0
                ? "result-round-win"
                : "result-round-loss")
          }
        >
          <div className="pulse-ring">
            {view.matchWinner === 0
              ? "W"
              : view.matchWinner === 1
                ? "L"
                : view.roundWinner === 0
                  ? "✓"
                  : "×"}
          </div>
          <h2>
            {flow === "end"
              ? view.matchWinner === 0
                ? "VICTORY"
                : "DEFEAT"
              : view.roundWinner === 0
                ? "ROUND WON"
                : "ROUND LOST"}
          </h2>
          <p>{flow === "end" ? "Match rewards earned. Run it back?" : "Next round loading…"}</p>
          {flow === "end" && (
            <div className="reward-summary" aria-label="Match rewards">
              <span>
                <strong>+{coinsReward}</strong>
                <small>COINS</small>
              </span>
              <span>
                <strong>+{xpReward}</strong>
                <small>XP</small>
              </span>
            </div>
          )}
          {flow === "end" && (
            <button className="primary-button compact" onClick={onRematch}>
              REMATCH ↗
            </button>
          )}
        </div>
      )}

      <button className="lobby-button" onClick={onLobby}>
        ← LOBBY
      </button>
    </section>
  );
}
