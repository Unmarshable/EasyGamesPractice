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

export const getRandomOutcome = (): Outcome =>
  outcomes[Math.floor(Math.random() * outcomes.length)];

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