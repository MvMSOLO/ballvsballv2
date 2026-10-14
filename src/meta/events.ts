/** Rotating live-ops events. Add a row — no code change required to announce one. */
export interface ArenaEvent {
  id: string;
  start: string;
  end: string;
  en: { name: string; body: string };
  uz: { name: string; body: string };
  ru: { name: string; body: string };
  trophyMult: number;
  coinMult: number;
}

export const EVENTS: ArenaEvent[] = [
  {
    id: "double-trophy-weekend",
    start: "2026-10-16",
    end: "2026-10-19",
    trophyMult: 2,
    coinMult: 1,
    en: { name: "Double Trophy Weekend", body: "Ranked wins pay double trophies until Monday." },
    uz: { name: "Ikki karra kubok dam olishi", body: "Reytingdagi g'alaba dushanbagacha ikki karra kubok beradi." },
    ru: { name: "Уикенд двойных кубков", body: "Победы в рейтинге дают двойные кубки до понедельника." },
  },
  {
    id: "neon-forge",
    start: "2026-10-20",
    end: "2026-10-27",
    trophyMult: 1,
    coinMult: 2,
    en: { name: "Neon Forge", body: "Match coins are doubled while the forge is lit." },
    uz: { name: "Neon o'choq", body: "O'choq yonib turganda jang tangalari ikki baravar." },
    ru: { name: "Неоновый горн", body: "Монеты за бой удваиваются, пока горн горит." },
  },
  {
    id: "colosseum-night",
    start: "2026-11-01",
    end: "2026-11-08",
    trophyMult: 1.5,
    coinMult: 1.25,
    en: { name: "Colosseum Night", body: "The stands are full. Trophies and coins climb together." },
    uz: { name: "Kolizey kechasi", body: "Tribunalar to'la. Kubok ham, tanga ham ko'payadi." },
    ru: { name: "Ночь Колизея", body: "Трибуны полны. Кубки и монеты растут вместе." },
  },
];

export function activeEvent(now = new Date()): ArenaEvent | null {
  const key = now.toISOString().slice(0, 10);
  return EVENTS.find((event) => key >= event.start && key <= event.end) ?? EVENTS[0] ?? null;
}
