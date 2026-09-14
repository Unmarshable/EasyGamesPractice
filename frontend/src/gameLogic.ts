export type Outcome = {
  symbol: string;
  name: string;
  multiplier: number;
  freeSpins?: number;
};

export type WinningLine = {
  id: string;
  label: string;
  positions: number[];
};

export type WinningMatch = WinningLine & { outcome: Outcome };

export type SlotSpin = {
  reels: Outcome[];
  matches: WinningMatch[];
  payoutMultiplier: number;
  awardedFreeSpins: number;
};

const outcomes: Outcome[] = [
  { symbol: "🍒", name: "Cherry", multiplier: 2 },
  { symbol: "🍋", name: "Lemon", multiplier: 3 },
  { symbol: "🍊", name: "Orange", multiplier: 4 },
  { symbol: "🍇", name: "Grapes", multiplier: 5 },
  { symbol: "🍉", name: "Watermelon", multiplier: 6 },
  { symbol: "🍓", name: "Strawberry", multiplier: 7 },
  { symbol: "🍍", name: "Pineapple", multiplier: 8 },
  { symbol: "🔔", name: "Bell", multiplier: 10 },
  { symbol: "⭐", name: "Star Bonus", multiplier: 12, freeSpins: 3 },
  { symbol: "7️⃣", name: "Lucky 7 Bonus", multiplier: 15, freeSpins: 5 },
  { symbol: "💎", name: "Diamond", multiplier: 20 },
];

export const winningLines: WinningLine[] = [
  { id: "row-top", label: "Top row", positions: [0, 1, 2] },
  { id: "row-middle", label: "Middle row", positions: [3, 4, 5] },
  { id: "row-bottom", label: "Bottom row", positions: [6, 7, 8] },
  { id: "column-left", label: "Left column", positions: [0, 3, 6] },
  { id: "column-middle", label: "Middle column", positions: [1, 4, 7] },
  { id: "column-right", label: "Right column", positions: [2, 5, 8] },
  { id: "diagonal-down", label: "Diagonal", positions: [0, 4, 8] },
  { id: "diagonal-up", label: "Reverse diagonal", positions: [2, 4, 6] },
];

export const getOutcomes = (): Outcome[] => outcomes;

// With all eight lines active, these weights provide a 95.5% theoretical
// base-game RTP. Free-spin awards add a little more value on top.
export const DEMO_RTP = 60;
export const DEMO_HOUSE_EDGE = 40;
export const DEMO_HIT_FREQUENCY = 16;
export const DEMO_MAX_WIN = 69.4;
const outcomeWeights = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.85];
const totalOutcomeWeight = outcomeWeights.reduce((total, weight) => total + weight, 0);

// Each outcome is independent. The chance × payout table gives 59.1% direct
// return; the 0.5% bonus trigger awards three free spins. Including recursive
// bonus retriggers, that produces a 60% theoretical RTP over many spins.
const payoutTiers = [
  { chance: 0.08, symbol: "Cherry", payout: 1.05 },
  { chance: 0.05, symbol: "Lemon", payout: 1.6 },
  { chance: 0.02, symbol: "Bell", payout: 3 },
  { chance: 0.005, symbol: "Star Bonus", payout: 4, freeSpins: 3 },
  { chance: 0.005, symbol: "Diamond", payout: DEMO_MAX_WIN },
] as const;

export const getRandomOutcome = (): Outcome =>
  (() => {
    let selection = Math.random() * totalOutcomeWeight;
    for (let index = 0; index < outcomes.length; index += 1) {
      selection -= outcomeWeights[index];
      if (selection <= 0) return outcomes[index];
    }
    return outcomes[outcomes.length - 1];
  })();

export const generateSpinResult = (): Outcome[] =>
  Array.from({ length: 9 }, () => getRandomOutcome());

export const getWinningMatches = (reels: Outcome[]): WinningMatch[] =>
  winningLines.flatMap((line) => {
    const firstSymbol = reels[line.positions[0]].symbol;
    const isMatch = line.positions.every((position) => reels[position].symbol === firstSymbol);

    return isMatch ? [{ ...line, outcome: reels[line.positions[0]] }] : [];
  });

export const calculateWinnings = (
  bet: number,
  matches: Array<WinningLine & { outcome: Outcome }>,
): number => matches.reduce((total, match) => total + bet * match.outcome.multiplier, 0);

const noMatchReels = (): Outcome[] => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const reels = generateSpinResult();
    if (getWinningMatches(reels).length === 0) return reels;
  }
  return outcomes.slice(0, 9);
};

const winningSpin = (outcome: Outcome): Pick<SlotSpin, "reels" | "matches"> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const line = winningLines[Math.floor(Math.random() * winningLines.length)];
    const reels = noMatchReels();
    line.positions.forEach((position) => { reels[position] = outcome; });
    const matches = getWinningMatches(reels);
    if (matches.length === 1 && matches[0].id === line.id) return { reels, matches };
  }
  const line = winningLines[0];
  const reels = outcomes.slice(0, 9);
  line.positions.forEach((position) => { reels[position] = outcome; });
  return { reels, matches: [{ ...line, outcome }] };
};

export const playSlotSpin = (): SlotSpin => {
  let selection = Math.random();
  for (const tier of payoutTiers) {
    selection -= tier.chance;
    if (selection <= 0) {
      const baseOutcome = outcomes.find((outcome) => outcome.name === tier.symbol)!;
      const outcome = { ...baseOutcome, multiplier: tier.payout, freeSpins: tier.freeSpins };
      const { reels, matches } = winningSpin(outcome);
      return { reels, matches, payoutMultiplier: tier.payout, awardedFreeSpins: tier.freeSpins ?? 0 };
    }
  }
  return { reels: noMatchReels(), matches: [], payoutMultiplier: 0, awardedFreeSpins: 0 };
};

// Demo-only path used to verify the jackpot UI and balance reset behavior.
export const playJackpotSpin = (): SlotSpin => {
  const diamond = outcomes.find((outcome) => outcome.name === "Diamond")!;
  const reels = Array.from({ length: 9 }, () => diamond);
  return { reels, matches: getWinningMatches(reels), payoutMultiplier: 0, awardedFreeSpins: 0 };
};
