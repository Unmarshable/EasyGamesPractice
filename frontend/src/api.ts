import { playJackpotSpin, playSlotSpin } from "./gameLogic";

export type WalletActivity = { label: string; amount: number; direction: "in" | "out" };
export type RecentPayout = { symbol: string; name: string; amount: number; matches: number };
export type RoundRecord = { outcome: "WIN" | "LOSS"; detail: string; amount: number };
export type WinningMatch = { id: string; label: string; positions: number[]; outcome: Outcome };
export type Outcome = { symbol: string; name: string; multiplier: number; freeSpins?: number };

export type AccountSnapshot = {
  playerName: string;
  email: string;
  balance: number;
  walletBalance: number;
  jackpot: number;
  spins: number;
  wins: number;
  losses: number;
  freeSpins: number;
  winStreak: number;
  walletActivity: WalletActivity[];
  recentPayouts: RecentPayout[];
  roundHistory: RoundRecord[];
};

export type AuthResponse = { token: string; account: AccountSnapshot };
export type SpinResponse = {
  reels: string[];
  matches: WinningMatch[];
  bet: number;
  wager: number;
  winnings: number;
  jackpotWin: number;
  balance: number;
  jackpot: number;
  freeSpins: number;
  spins: number;
  wins: number;
  losses: number;
  winStreak: number;
  recentPayouts: RecentPayout[];
  roundHistory: RoundRecord[];
};
export type PlayerProfile = { playerName: string; email: string; sessionMode: string; tableAccess: string };

type StoredAccount = AccountSnapshot & { password: string };
const accountsKey = "lucky-spin-demo-accounts";
const sessionKey = "lucky-spin-token";
const readAccounts = (): StoredAccount[] => JSON.parse(localStorage.getItem(accountsKey) ?? "[]") as StoredAccount[];
const writeAccounts = (accounts: StoredAccount[]) => localStorage.setItem(accountsKey, JSON.stringify(accounts));
const getCurrent = (): StoredAccount => {
  const account = readAccounts().find(({ email }) => email === localStorage.getItem(sessionKey));
  if (!account) throw new Error("Your session is missing or expired.");
  return account;
};
const saveCurrent = (updated: StoredAccount) => writeAccounts(readAccounts().map((account) => account.email === updated.email ? updated : account));
const snapshot = ({ password: _password, ...account }: StoredAccount): AccountSnapshot => account;
const profile = (account: StoredAccount): PlayerProfile => ({ playerName: account.playerName, email: account.email, sessionMode: "Demo play", tableAccess: "Premium play" });

export const api = {
  async register(email: string, password: string, playerName: string): Promise<AuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    if (readAccounts().some((account) => account.email === normalizedEmail)) throw new Error("An account with that email already exists.");
    const account: StoredAccount = { playerName: playerName.trim(), email: normalizedEmail, password, balance: 1000, walletBalance: 2500, jackpot: 12500, spins: 0, wins: 0, losses: 0, freeSpins: 0, winStreak: 0, walletActivity: [{ label: "Opening play balance", amount: 1000, direction: "in" }], recentPayouts: [], roundHistory: [] };
    writeAccounts([...readAccounts(), account]); return { token: normalizedEmail, account: snapshot(account) };
  },
  async login(email: string, password: string): Promise<AuthResponse> {
    const account = readAccounts().find((entry) => entry.email === email.trim().toLowerCase() && entry.password === password);
    if (!account) throw new Error("Email or password is incorrect."); return { token: account.email, account: snapshot(account) };
  },
  async logout(): Promise<void> {},
  async account(): Promise<AccountSnapshot> { return snapshot(getCurrent()); },
  async profile(): Promise<PlayerProfile> { return profile(getCurrent()); },
  async updateProfile(playerName: string): Promise<PlayerProfile> { const account = getCurrent(); if (playerName.trim().length < 2 || playerName.trim().length > 32) throw new Error("Username must be between 2 and 32 characters."); const updated = { ...account, playerName: playerName.trim() }; saveCurrent(updated); return profile(updated); },
  async changePassword(currentPassword: string, newPassword: string): Promise<void> { const account = getCurrent(); if (account.password !== currentPassword) throw new Error("Your current password is incorrect."); if (newPassword.length < 6) throw new Error("Your new password must be at least 6 characters."); saveCurrent({ ...account, password: newPassword }); },
  async deposit(amount: number): Promise<AccountSnapshot> { const account = getCurrent(); if (amount <= 0) throw new Error("Enter an amount above zero."); const updated = { ...account, walletBalance: account.walletBalance + amount, walletActivity: [{ label: "Wallet deposit", amount, direction: "in" as const }, ...account.walletActivity].slice(0, 4) }; saveCurrent(updated); return snapshot(updated); },
  async transfer(amount: number): Promise<AccountSnapshot> { const account = getCurrent(); if (amount <= 0 || amount > account.walletBalance) throw new Error("That amount is not available in your wallet."); const updated = { ...account, walletBalance: account.walletBalance - amount, balance: account.balance + amount, walletActivity: [{ label: "Transfer to play", amount, direction: "out" as const }, ...account.walletActivity].slice(0, 4) }; saveCurrent(updated); return snapshot(updated); },
  async withdraw(amount: number): Promise<AccountSnapshot> { const account = getCurrent(); if (amount <= 0 || amount > account.balance) throw new Error("That amount is not available in your play balance."); const updated = { ...account, balance: account.balance - amount, walletBalance: account.walletBalance + amount, walletActivity: [{ label: "Withdraw from play", amount, direction: "in" as const }, ...account.walletActivity].slice(0, 4) }; saveCurrent(updated); return snapshot(updated); },
  async spin(bet: number, betType: "classic" | "boost", forceJackpot = false): Promise<SpinResponse> {
    const account = getCurrent(); const wager = betType === "boost" ? bet * 2 : bet; const isFree = account.freeSpins > 0; if (!isFree && wager > account.balance) throw new Error("Not enough credits.");
    const slotSpin = forceJackpot ? playJackpotSpin() : playSlotSpin(); const winnings = wager * slotSpin.payoutMultiplier; const jackpotWin = forceJackpot ? account.jackpot : 0; const won = slotSpin.matches.length > 0; const updated = { ...account, balance: account.balance + winnings + jackpotWin - (isFree ? 0 : wager), jackpot: forceJackpot ? 12500 : account.jackpot + (isFree ? 0 : wager * .08), freeSpins: account.freeSpins - (isFree ? 1 : 0) + slotSpin.awardedFreeSpins, spins: account.spins + 1, wins: account.wins + (won ? 1 : 0), losses: account.losses + (won ? 0 : 1), winStreak: won ? account.winStreak + 1 : 0, recentPayouts: won ? [{ symbol: slotSpin.matches[0].outcome.symbol, name: forceJackpot ? "House jackpot" : slotSpin.matches[0].outcome.name, amount: winnings + jackpotWin, matches: slotSpin.matches.length }, ...account.recentPayouts].slice(0, 4) : account.recentPayouts, roundHistory: [{ outcome: won ? "WIN" as const : "LOSS" as const, detail: forceJackpot ? "House jackpot" : `${slotSpin.matches.length} line${slotSpin.matches.length === 1 ? "" : "s"}`, amount: won ? winnings + jackpotWin : wager }, ...account.roundHistory].slice(0, 5) };
    saveCurrent(updated); return { reels: slotSpin.reels.map((outcome) => outcome.symbol), matches: slotSpin.matches, bet, wager, winnings, jackpotWin, ...snapshot(updated) };
  },
};
