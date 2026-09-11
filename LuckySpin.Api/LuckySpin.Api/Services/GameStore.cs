using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using LuckySpin.Api.Models;

namespace LuckySpin.Api.Services;

public sealed class PlayerAccount
{
    public string Email { get; init; } = "";
    public string PlayerName { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public decimal Balance { get; set; } = 1000;
    public decimal WalletBalance { get; set; } = 2500;
    public decimal Jackpot { get; set; } = 12500;
    public int Spins { get; set; }
    public int Wins { get; set; }
    public int Losses { get; set; }
    public int FreeSpins { get; set; }
    public int WinStreak { get; set; }
    public List<WalletActivity> WalletActivity { get; } = [new() { Label = "Opening play balance", Amount = 1000, Direction = "in" }];
    public List<RecentPayout> RecentPayouts { get; } = [];
    public List<RoundRecord> RoundHistory { get; } = [];
}

public static class GameStore
{
    private static readonly ConcurrentDictionary<string, PlayerAccount> Accounts = new(StringComparer.OrdinalIgnoreCase);
    private static readonly ConcurrentDictionary<string, string> Sessions = new();

    private static readonly Outcome[] Outcomes =
    [
        new() { Symbol = "🍒", Name = "Cherry", Multiplier = 2 },
        new() { Symbol = "🍋", Name = "Lemon", Multiplier = 3 },
        new() { Symbol = "🍊", Name = "Orange", Multiplier = 4 },
        new() { Symbol = "🍇", Name = "Grapes", Multiplier = 5 },
        new() { Symbol = "🍉", Name = "Watermelon", Multiplier = 6 },
        new() { Symbol = "🍓", Name = "Strawberry", Multiplier = 7 },
        new() { Symbol = "🍍", Name = "Pineapple", Multiplier = 8 },
        new() { Symbol = "🔔", Name = "Bell", Multiplier = 10 },
        new() { Symbol = "⭐", Name = "Star Bonus", Multiplier = 12, FreeSpins = 3 },
        new() { Symbol = "7️⃣", Name = "Lucky 7 Bonus", Multiplier = 15, FreeSpins = 5 },
        new() { Symbol = "💎", Name = "Diamond", Multiplier = 20 }
    ];

    private static readonly (string Id, string Label, int[] Positions)[] Lines =
    [
        ("row-top", "Top row", [0, 1, 2]),
        ("row-middle", "Middle row", [3, 4, 5]),
        ("row-bottom", "Bottom row", [6, 7, 8]),
        ("column-left", "Left column", [0, 3, 6]),
        ("column-middle", "Middle column", [1, 4, 7]),
        ("column-right", "Right column", [2, 5, 8]),
        ("diagonal-down", "Diagonal", [0, 4, 8]),
        ("diagonal-up", "Reverse diagonal", [2, 4, 6])
    ];

    public static bool TryRegister(AuthRequest request, out AuthResponse response, out string error)
    {
        response = new();
        error = ValidateCredentials(request, true);
        if (error != "") return false;

        var email = request.Email.Trim().ToLowerInvariant();
        var account = new PlayerAccount
        {
            Email = email,
            PlayerName = string.IsNullOrWhiteSpace(request.PlayerName) ? email.Split('@')[0] : request.PlayerName.Trim(),
            PasswordHash = Hash(request.Password)
        };
        if (!Accounts.TryAdd(email, account))
        {
            error = "An account with that email already exists.";
            return false;
        }

        response = CreateSession(account);
        return true;
    }

    public static bool TryLogin(AuthRequest request, out AuthResponse response, out string error)
    {
        response = new();
        error = ValidateCredentials(request, false);
        if (error != "") return false;
        if (!Accounts.TryGetValue(request.Email.Trim(), out var account) || account.PasswordHash != Hash(request.Password))
        {
            error = "Email or password is incorrect.";
            return false;
        }

        response = CreateSession(account);
        return true;
    }

    public static bool TryGetAccount(string token, out PlayerAccount account)
    {
        account = null!;
        if (string.IsNullOrWhiteSpace(token) || !Sessions.TryGetValue(token, out var email)) return false;
        return Accounts.TryGetValue(email, out account!);
    }

    public static void SignOut(string token) => Sessions.TryRemove(token, out _);

    public static AccountSnapshot Snapshot(PlayerAccount account) => new()
    {
        PlayerName = account.PlayerName,
        Email = account.Email,
        Balance = account.Balance,
        WalletBalance = account.WalletBalance,
        Jackpot = account.Jackpot,
        Spins = account.Spins,
        Wins = account.Wins,
        Losses = account.Losses,
        FreeSpins = account.FreeSpins,
        WinStreak = account.WinStreak,
        WalletActivity = account.WalletActivity.ToList(),
        RecentPayouts = account.RecentPayouts.ToList(),
        RoundHistory = account.RoundHistory.ToList()
    };

    public static PlayerProfile Profile(PlayerAccount account) => new() { PlayerName = account.PlayerName, Email = account.Email };

    public static bool TryUpdateProfile(UpdateProfileRequest request, PlayerAccount account, out PlayerProfile profile, out string error)
    {
        profile = Profile(account);
        var playerName = request.PlayerName.Trim();
        if (playerName.Length < 2 || playerName.Length > 32)
        {
            error = "Username must be between 2 and 32 characters.";
            return false;
        }

        lock (account)
        {
            account.PlayerName = playerName;
            profile = Profile(account);
        }
        error = "";
        return true;
    }

    public static bool TryChangePassword(ChangePasswordRequest request, PlayerAccount account, out string error)
    {
        if (request.NewPassword.Length < 6)
        {
            error = "Your new password must be at least 6 characters.";
            return false;
        }
        if (account.PasswordHash != Hash(request.CurrentPassword))
        {
            error = "Your current password is incorrect.";
            return false;
        }

        lock (account) account.PasswordHash = Hash(request.NewPassword);
        error = "";
        return true;
    }

    public static bool TryDeposit(PlayerAccount account, decimal amount, out string error)
    {
        error = ValidateAmount(amount);
        if (error != "") return false;
        lock (account)
        {
            account.WalletBalance += amount;
            AddActivity(account, "Wallet deposit", amount, "in");
        }
        return true;
    }

    public static bool TryTransferToPlay(PlayerAccount account, decimal amount, out string error)
    {
        error = ValidateAmount(amount);
        if (error == "" && amount > account.WalletBalance) error = "That amount is not available in your wallet.";
        if (error != "") return false;
        lock (account)
        {
            account.WalletBalance -= amount;
            account.Balance += amount;
            AddActivity(account, "Transfer to play", amount, "out");
        }
        return true;
    }

    public static bool TryWithdraw(PlayerAccount account, decimal amount, out string error)
    {
        error = ValidateAmount(amount);
        if (error == "" && amount > account.Balance) error = "That amount is not available in your play balance.";
        if (error != "") return false;
        lock (account)
        {
            account.Balance -= amount;
            account.WalletBalance += amount;
            AddActivity(account, "Withdraw from play", amount, "in");
        }
        return true;
    }

    public static bool TrySpin(PlayerAccount account, SpinRequest request, out SpinResponse response, out string error)
    {
        response = new();
        error = ValidateAmount(request.Bet);
        if (error != "") return false;
        var betType = request.BetType.Equals("boost", StringComparison.OrdinalIgnoreCase) ? "boost" : "classic";
        var wager = betType == "boost" ? request.Bet * 2 : request.Bet;

        lock (account)
        {
            var freeRound = account.FreeSpins > 0;
            if (!freeRound && wager > account.Balance)
            {
                error = "Not enough credits.";
                return false;
            }

            if (freeRound) account.FreeSpins--;
            account.Spins++;
            account.Jackpot += freeRound ? 0 : wager * .08m;
            var reels = Enumerable.Range(0, 9).Select(_ => Outcomes[Random.Shared.Next(Outcomes.Length)]).ToArray();
            var matches = Lines
                .Where(line => line.Positions.All(position => reels[position].Symbol == reels[line.Positions[0]].Symbol))
                .Select(line => new WinningMatch { Id = line.Id, Label = line.Label, Positions = line.Positions, Outcome = reels[line.Positions[0]] })
                .ToList();
            var winnings = matches.Sum(match => wager * match.Outcome.Multiplier);
            var jackpotWin = matches.Count >= 3 ? account.Jackpot : 0;
            var awardedFreeSpins = matches.Sum(match => match.Outcome.FreeSpins);
            account.Balance += winnings + jackpotWin - (freeRound ? 0 : wager);
            account.FreeSpins += awardedFreeSpins;

            if (matches.Count > 0)
            {
                account.Wins++;
                account.WinStreak++;
                account.RecentPayouts.Insert(0, new RecentPayout { Symbol = matches[0].Outcome.Symbol, Name = matches[0].Outcome.Name, Amount = winnings, Matches = matches.Count });
                account.RoundHistory.Insert(0, new RoundRecord { Outcome = "WIN", Detail = $"{matches.Count} line{(matches.Count == 1 ? "" : "s")}", Amount = winnings + jackpotWin });
                if (jackpotWin > 0) account.Jackpot = 12500;
            }
            else
            {
                account.Losses++;
                account.WinStreak = 0;
                account.RoundHistory.Insert(0, new RoundRecord { Outcome = "LOSS", Detail = freeRound ? "Free spin" : "No match", Amount = wager });
            }
            account.RecentPayouts.RemoveRange(Math.Min(4, account.RecentPayouts.Count), Math.Max(0, account.RecentPayouts.Count - 4));
            account.RoundHistory.RemoveRange(Math.Min(5, account.RoundHistory.Count), Math.Max(0, account.RoundHistory.Count - 5));

            response = new SpinResponse
            {
                Reels = reels.Select(outcome => outcome.Symbol).ToArray(),
                Matches = matches,
                Bet = request.Bet,
                Wager = wager,
                Winnings = winnings,
                JackpotWin = jackpotWin,
                Balance = account.Balance,
                Jackpot = account.Jackpot,
                FreeSpins = account.FreeSpins,
                Spins = account.Spins,
                Wins = account.Wins,
                Losses = account.Losses,
                WinStreak = account.WinStreak,
                RecentPayouts = account.RecentPayouts.ToList(),
                RoundHistory = account.RoundHistory.ToList()
            };
        }
        return true;
    }

    private static AuthResponse CreateSession(PlayerAccount account)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        Sessions[token] = account.Email;
        return new AuthResponse { Token = token, Account = Snapshot(account) };
    }

    private static string ValidateCredentials(AuthRequest request, bool registration)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@')) return "Enter a valid email address.";
        if (request.Password.Length < 6) return "Your password must be at least 6 characters.";
        if (registration && string.IsNullOrWhiteSpace(request.PlayerName)) return "Enter a player name.";
        return "";
    }

    private static string ValidateAmount(decimal amount) => amount > 0 ? "" : "Enter an amount above zero.";

    private static void AddActivity(PlayerAccount account, string label, decimal amount, string direction)
    {
        account.WalletActivity.Insert(0, new WalletActivity { Label = label, Amount = amount, Direction = direction });
        account.WalletActivity.RemoveRange(Math.Min(4, account.WalletActivity.Count), Math.Max(0, account.WalletActivity.Count - 4));
    }

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}
