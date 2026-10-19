/**
 * Shape-aware SVG preview for battle draft cards.
 * Every authored silhouette and shell motif is previewed here as well as in the 3D renderer.
 */
import { useId, type ReactNode } from "react";
import type { BallDef } from "@/sim/types";

type Props = { ball: BallDef; selected?: boolean; confirmed?: boolean; reduceMotion?: boolean };

const BODY_PATHS: Record<string, string> = {
  sphere: "M48 16A32 32 0 1 0 48 80A32 32 0 1 0 48 16Z",
  shield: "M48 13L75 25L70 56L48 81L26 56L21 25Z",
  meteor: "M48 12L57 22L70 19L73 32L83 42L73 52L76 67L61 69L48 83L37 70L22 73L23 58L13 48L23 38L20 24L35 26Z",
  gear: "M48 15L55 22L64 19L69 27L77 29L76 38L83 44L77 51L80 60L70 64L67 73L57 71L51 81L43 75L35 79L30 70L20 70L20 60L12 54L17 45L12 37L21 31L22 22L32 24L38 16Z",
  leech: "M48 17C65 18 77 31 75 48C75 65 64 76 48 78C30 80 18 66 20 49C19 32 31 17 48 17Z",
  shardcluster: "M47 11L60 38L79 24L71 50L82 68L56 64L42 82L36 58L13 60L28 43L20 21L41 32Z",
  halo: "M48 17A31 31 0 1 0 48 79A31 31 0 1 0 48 17Z",
  comet: "M43 21C58 15 71 26 70 42C69 59 55 69 42 62L14 79L29 56C19 43 27 27 43 21Z",
  mite: "M48 22C61 22 67 32 66 46C65 60 59 67 48 67C36 67 30 59 30 46C29 33 36 22 48 22Z",
  knife: "M48 10L65 38L54 44L65 70L48 84L31 70L42 44L31 38Z",
  die: "M28 16L68 16L80 28L80 68L68 80L28 80L16 68L16 28Z",
  magma: "M47 14L59 25L73 24L71 38L82 47L70 58L72 72L56 68L46 82L37 69L22 73L25 56L14 47L26 37L22 22L38 26Z",
  lance: "M48 10L62 30L57 39L65 68L48 82L31 68L39 39L34 30Z",
  serpent: "M24 58C12 37 30 17 49 27C63 34 49 45 40 39C30 33 42 22 57 31C76 42 64 70 43 67C28 65 28 54 39 49C50 44 64 54 57 62C52 68 44 66 42 60",
  sprout: "M48 24C66 24 74 36 70 52C67 68 58 75 48 75C35 75 26 65 26 51C24 35 34 24 48 24Z",
  hive: "M48 13L68 25L75 47L64 69L42 78L22 64L18 42L30 23Z",
  webbed: "M48 14L75 31L75 63L48 81L21 63L21 31Z",
  reliquary: "M33 13L63 13L77 30L72 66L48 82L24 66L19 30Z",
  mandolin: "M48 12C62 22 68 32 63 43C80 48 81 67 65 75C53 81 43 74 40 66C22 76 11 62 23 47C28 41 35 40 40 43C34 30 37 20 48 12Z",
  monolith: "M31 12L65 12L74 22L71 75L25 75L22 22Z",
  book: "M17 21Q17 15 26 17L47 24L48 80L26 72Q17 72 17 63Z M48 24L70 17Q79 15 79 22L79 63Q79 72 70 72L48 80Z",
  windblade: "M48 12L57 35L80 25L66 46L84 61L59 60L48 83L37 60L12 61L30 46L16 25L39 35Z",
  shell: "M18 60C14 42 25 22 48 17C71 22 82 42 78 60L70 72L26 72Z",
  crystalcluster: "M46 12L59 39L77 27L69 54L79 70L55 66L43 82L36 61L17 63L28 44L22 25L40 35Z",
  abacus: "M48 16A31 31 0 1 0 48 78A31 31 0 1 0 48 16Z",
  void: "M48 15A33 33 0 1 0 48 81A33 33 0 1 0 48 15Z",
  kettle: "M26 33C26 22 37 16 49 19C61 21 68 31 65 44L78 41L73 53L65 51C62 68 54 74 43 73C27 72 20 61 24 47Z",
  crown: "M18 36L32 48L39 22L49 39L61 19L67 48L80 35L73 69L26 69Z",
  atlas: "M48 17C66 17 78 26 78 48C78 66 66 78 48 78C30 78 18 66 18 48C18 26 30 17 48 17Z",
  plum: "M48 15C66 16 74 31 70 50C67 69 57 80 45 78C30 76 21 63 23 46C24 29 33 17 48 15Z",
  orchid: "M48 17C59 15 66 24 63 34C77 28 83 42 72 50C82 61 69 73 58 64C58 81 40 81 39 64C24 75 13 61 25 50C13 39 24 27 37 34C34 23 40 16 48 17Z",
  mirror: "M48 12L76 48L48 84L20 48Z",
  moth: "M48 29C34 20 14 18 12 40C10 57 25 65 40 55L48 73L56 55C71 65 86 57 84 40C82 18 62 20 48 29Z",
  sonar: "M48 16A32 32 0 1 0 48 80A32 32 0 1 0 48 16Z",
  cathedral: "M21 77L21 45L35 45L35 28L48 12L61 28L61 45L75 45L75 77Z",
};

const FACELESS = new Set(["die","gear","knife","lance","reliquary","mandolin","monolith","book","windblade","abacus","void","kettle","atlas","mirror","sonar","cathedral"]);
const MARKS: Record<string, ReactNode> = {
  armor: <g><path d="M23 35L37 29L46 36L32 43Z M48 38L62 32L72 39L59 46Z M31 51L44 45L53 54L39 61Z"/><circle cx="28" cy="36" r="1.5"/><circle cx="67" cy="40" r="1.5"/></g>,
  fuse: <g><path d="M27 31L37 40L33 52L43 62M52 29L61 37L57 47L67 58" strokeWidth="1.8"/><circle cx="58" cy="29" r="2.3" fill="currentColor"/></g>,
  winding: <g><ellipse cx="48" cy="48" rx="21" ry="14"/><ellipse cx="48" cy="48" rx="14" ry="23" transform="rotate(38 48 48)"/><ellipse cx="48" cy="48" rx="9" ry="20" transform="rotate(-42 48 48)"/></g>,
  veins: <path d="M29 32L41 43L34 52L45 57M57 30L52 42L64 48L58 61" strokeWidth="1.7"/>,
  shards: <g><path d="M27 56L36 36L43 56ZM49 32L58 51L51 57ZM61 56L70 40L73 61Z"/><path d="M36 36L37 50L43 56M49 32L51 47L58 51"/></g>,
  rays: <g><path d="M48 20V31M48 65V77M20 48H31M65 48H77M28 28L36 36M60 60L69 69M68 28L60 36M36 60L27 69"/><circle cx="48" cy="48" r="17"/></g>,
  spiral: <g><path d="M48 32C66 31 68 50 53 57C39 64 30 51 37 42C42 35 53 40 51 46"/><circle cx="48" cy="48" r="24"/></g>,
  lightning: <path d="M28 30L43 43L36 51L49 59L45 71M58 26L54 40L65 46L57 57L62 69" strokeWidth="1.8"/>,
  blade_marks: <path d="M27 55L39 41M37 62L50 47M50 61L65 43M55 35L68 23" strokeWidth="1.9"/>,
  checker: <g><path d="M31 31H65V65H31Z M48 31V65M31 48H65"/><path d="M31 31H48V48H31ZM48 48H65V65H48Z" fill="currentColor" opacity=".22"/></g>,
  fissure: <path d="M32 30L42 40L36 49L48 58L44 69M58 28L54 41L64 46L59 58" strokeWidth="1.8"/>,
  prism: <g><path d="M48 26L62 48L48 70L34 48Z M48 26V70M34 48H62"/><path d="M26 48L34 44L34 53ZM62 44L70 48L62 53Z" fill="currentColor" opacity=".25"/></g>,
  scales: <path d="M27 38Q35 28 43 38T59 38T75 38M23 49Q31 39 39 49T55 49T71 49M27 60Q35 50 43 60T59 60T75 60"/>,
  growth_rings: <g><ellipse cx="48" cy="48" rx="23" ry="15"/><ellipse cx="48" cy="48" rx="16" ry="24" transform="rotate(35 48 48)"/><ellipse cx="48" cy="48" rx="9" ry="18" transform="rotate(-28 48 48)"/></g>,
  hive_hex: <g><path d="M36 31L44 35V44L36 48L28 44V35ZM58 42L66 46V55L58 59L50 55V46Z M42 53L50 57V66L42 70L34 66V57Z"/><circle cx="48" cy="48" r="3" fill="currentColor"/></g>,
  web: <g><path d="M48 24V72M24 48H72M31 31L65 65M65 31L31 65"/><circle cx="48" cy="48" r="11"/><circle cx="48" cy="48" r="21"/></g>,
  celestial: <g><path d="M31 34L48 42L65 30M48 42L58 63L39 66L31 34"/><path d="M31 27L33 31L37 32L33 34L31 38L29 34L25 32L29 31Z M67 54L69 58L73 59L69 61L67 65L65 61L61 59L65 58Z"/></g>,
  soundwaves: <path d="M27 34Q34 25 41 34T55 34T69 34M22 42Q34 29 46 42T70 42M25 51Q34 42 43 51T61 51T75 51M29 60Q36 54 43 60T57 60T71 60"/>,
  masonry: <path d="M28 30H48V42H28ZM50 30H68V42H50ZM20 44H39V56H20ZM41 44H62V56H41ZM29 58H49V70H29ZM51 58H70V70H51Z"/>,
  ledger: <g><path d="M31 28V70M37 35H68M37 44H68M37 53H68M37 62H68"/><path d="M42 34L47 39M52 34L57 39M42 43L47 48"/></g>,
  gusts: <path d="M20 34Q39 23 57 34T78 30M18 45Q38 33 57 45T79 41M22 57Q40 47 59 57T75 54M31 67Q43 59 57 67"/>,
  shell_ribs: <path d="M27 57Q48 19 69 57M32 61Q48 32 64 61M39 65Q48 45 57 65M48 24V64"/>,
  quartz_facets: <path d="M27 55L39 32L47 51L58 28L69 54L57 66L41 64Z M39 32L58 28L47 51L69 54M27 55L41 64L47 51"/>,
  beads: <g><path d="M28 35H68M28 48H68M28 61H68"/><circle cx="37" cy="35" r="3" fill="currentColor"/><circle cx="56" cy="48" r="3" fill="currentColor"/><circle cx="44" cy="61" r="3" fill="currentColor"/></g>,
  eclipse: <g><ellipse cx="48" cy="48" rx="25" ry="12" transform="rotate(-22 48 48)"/><ellipse cx="48" cy="48" rx="19" ry="8" transform="rotate(24 48 48)"/><circle cx="48" cy="48" r="8" fill="#080611"/></g>,
  orbit_map: <g><ellipse cx="48" cy="48" rx="26" ry="11" transform="rotate(-25 48 48)"/><ellipse cx="48" cy="48" rx="25" ry="16" transform="rotate(38 48 48)"/><circle cx="67" cy="35" r="2.5" fill="currentColor"/><circle cx="30" cy="60" r="2" fill="currentColor"/></g>,
  event_horizon: <g><ellipse cx="48" cy="48" rx="24" ry="14" transform="rotate(-32 48 48)"/><ellipse cx="48" cy="48" rx="20" ry="8" transform="rotate(34 48 48)"/><circle cx="48" cy="48" r="10" fill="#07040F"/></g>,
  topographic: <g><path d="M23 37Q37 25 49 37T74 35M21 45Q37 33 49 45T76 43M21 53Q37 41 49 53T76 51M26 62Q39 51 50 62T70 60"/><circle cx="58" cy="36" r="2" fill="currentColor"/></g>,
  plum_skin: <g><path d="M35 30Q48 23 61 30" strokeWidth="2.5"/><circle cx="34" cy="47" r="1.2" fill="currentColor"/><circle cx="62" cy="52" r="1.5" fill="currentColor"/><circle cx="43" cy="65" r="1.2" fill="currentColor"/><circle cx="55" cy="40" r="1.2" fill="currentColor"/></g>,
  petal_veins: <g><path d="M48 48Q32 35 30 29M48 48Q61 34 66 29M48 48Q28 52 23 62M48 48Q68 50 74 62M48 48V23"/><circle cx="48" cy="48" r="5"/></g>,
  mirror_facets: <path d="M29 46L40 29L49 43L64 28L70 48L55 65L39 63Z M40 29L39 63M49 43L55 65M64 28L55 65"/>,
  moth_scales: <path d="M28 39Q34 31 40 39T52 39T64 39T76 39M24 48Q30 40 36 48T48 48T60 48T72 48M28 57Q34 49 40 57T52 57T64 57T76 57"/>,
  sonar_rings: <g><circle cx="48" cy="48" r="8"/><circle cx="48" cy="48" r="16"/><circle cx="48" cy="48" r="25"/><path d="M48 23V73M23 48H73"/></g>,
  architecture: <g><path d="M29 69V43Q29 32 39 32Q49 32 49 43V69M49 69V50Q49 40 59 40Q69 40 69 50V69M25 69H73"/><path d="M35 55H42M55 56H63M48 26V16"/></g>,
};

export function BallCardSvg({ ball, selected, confirmed, reduceMotion }: Props) {
  const uid = useId().replace(/:/g, "");
  const face = ball.visual?.face ?? "grin";
  const base = ball.visual?.baseColor ?? "#4aa3ff";
  const accent = ball.visual?.accentColor ?? "#80c4ff";
  const rarity = ball.rarity ?? "common";
  const shape = ball.visual?.shape ?? "sphere";
  const pattern = ball.visual?.pattern ?? "none";
  const faces: Record<string, string> = {
    grin:"M9 13c1.2 1.6 3.2 2.4 5 2.4s3.8-.8 5-2.4M8 9.2h1.6M16.4 9.2H18",
    angry:"M8 13.5c1.4-1 3.2-1.4 5-1.4s3.6.4 5 1.4M8.2 8.2l2.2 1.4M17.8 8.2l-2.2 1.4",
    sleepy:"M9 13.2c1 .8 2.6 1.2 4 1.2s3-.4 4-1.2M8.5 9.5h2M15.5 9.5h2",
    cool:"M7.5 9.2h4.2M14.3 9.2h4.2M9 13.5c1.2.9 2.8 1.3 4 1.3s2.8-.4 4-1.3",
    cute:"M9 13.2c1.2 1.4 3 2 4 2s2.8-.6 4-2M8.5 9.2c.4-.6 1-.6 1.4 0M16.1 9.2c.4-.6 1-.6 1.4 0",
    robot:"M8 8.5h3v2.2H8zM15 8.5h3v2.2h-3zM10 13.5h6M9 16h8",
    ghost:"M9 13.5c1.2 1 3 1.5 4 1.5s2.8-.5 4-1.5M9 9.5c.3-.5.8-.5 1.1 0M15.9 9.5c.3-.5.8-.5 1.1 0",
    wink:"M8.5 9.2h2.2M15.5 8.8c.5-.4 1.2-.4 1.6 0M9 13.2c1.2 1.2 3 1.8 4 1.8s2.8-.6 4-1.8",
    focus:"M9 9.5h1.8M15.2 9.5H17M10 13.5c.8.6 1.8.9 3 .9s2.2-.3 3-.9",
  };
  const rarityStops: Record<string, [string, string]> = {
    common:["#8a97a8","#c2d2e6"], rare:["#3b82f6","#93c5fd"], epic:["#a855f7","#e9d5ff"],
    legendary:["#f59e0b","#fde68a"], mythic:["#ef4444","#fca5a5"],
  };
  const [r1, r2] = rarityStops[rarity] ?? rarityStops.common;
  return (
    <svg className={"ball-card-svg " + (selected ? "is-selected " : "") + (confirmed ? "is-confirmed " : "") + (reduceMotion ? "ba-reduced-motion" : "")}
      viewBox="0 0 96 96" width={88} height={88} aria-hidden>
      <defs>
        <radialGradient id={"ball-body-" + uid} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.95"/><stop offset="55%" stopColor={base}/><stop offset="100%" stopColor={base} stopOpacity="0.85"/>
        </radialGradient>
        <linearGradient id={"rarity-ring-" + uid} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={r1}/><stop offset="100%" stopColor={r2}/></linearGradient>
        <filter id={"ball-glow-" + uid} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx="48" cy="48" r="44" fill="none" stroke={"url(#rarity-ring-" + uid + ")"} strokeWidth={selected?3:1.8}
        strokeDasharray={rarity==="mythic"?"4 3":rarity==="legendary"?"6 2":undefined} className="ball-rarity-ring" opacity={selected?1:.75}/>
      {!reduceMotion && <circle cx="48" cy="48" r="38" fill={base} opacity={.12} className="ball-aura"/>}
      <path d={BODY_PATHS[shape]??BODY_PATHS.sphere} fill={"url(#ball-body-" + uid + ")"} filter={reduceMotion?undefined:"url(#ball-glow-" + uid + ")"} stroke="rgba(255,255,255,.32)" strokeWidth={1.5} strokeLinejoin="round"/>
      <ellipse cx="38" cy="36" rx="10" ry="7" fill="rgba(255,255,255,.28)"/>
      <g fill="none" stroke={accent} strokeWidth="1.1" opacity=".8">{MARKS[pattern]}</g>
      {!FACELESS.has(shape) && <g transform="translate(30 30) scale(1.5)" fill="none" stroke="rgba(8,10,14,.8)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d={faces[face]??faces.grin}/></g>}
      {selected && <g className="ball-select-mark"><circle cx="76" cy="20" r="10" fill="#61e6ac" stroke="#0b0e13" strokeWidth="2"/><path d="M71 20l3 3 6-6" fill="none" stroke="#0b0e13" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></g>}
    </svg>
  );
}
