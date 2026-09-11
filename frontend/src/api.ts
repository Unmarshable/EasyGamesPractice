const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5228/api";

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

type ApiError = { message?: string };

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const token = localStorage.getItem("lucky-spin-token");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({} as ApiError)) as ApiError;
    throw new Error(error.message ?? "The game service is unavailable.");
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
};

export const api = {
  login: (email: string, password: string) => request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, playerName: string) => request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, playerName }) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  account: () => request<AccountSnapshot>("/account"),
  profile: () => request<PlayerProfile>("/account/profile"),
  updateProfile: (playerName: string) => request<PlayerProfile>("/account/profile", { method: "PUT", body: JSON.stringify({ playerName }) }),
  changePassword: (currentPassword: string, newPassword: string) => request<void>("/account/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
  deposit: (amount: number) => request<AccountSnapshot>("/wallet/deposit", { method: "POST", body: JSON.stringify({ amount }) }),
  transfer: (amount: number) => request<AccountSnapshot>("/wallet/transfer", { method: "POST", body: JSON.stringify({ amount }) }),
  withdraw: (amount: number) => request<AccountSnapshot>("/wallet/withdraw", { method: "POST", body: JSON.stringify({ amount }) }),
  spin: (bet: number, betType: "classic" | "boost") => request<SpinResponse>("/Game/spin", { method: "POST", body: JSON.stringify({ bet, betType }) }),
};
