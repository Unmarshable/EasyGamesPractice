namespace LuckySpin.Api.Models;

public sealed class AuthRequest
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    public string? PlayerName { get; set; }
}

public sealed class AuthResponse
{
    public string Token { get; set; } = "";
    public AccountSnapshot Account { get; set; } = new();
}

public sealed class AccountSnapshot
{
    public string PlayerName { get; set; } = "";
    public string Email { get; set; } = "";
    public decimal Balance { get; set; }
    public decimal WalletBalance { get; set; }
    public decimal Jackpot { get; set; }
    public int Spins { get; set; }
    public int Wins { get; set; }
    public int Losses { get; set; }
    public int FreeSpins { get; set; }
    public int WinStreak { get; set; }
    public List<WalletActivity> WalletActivity { get; set; } = [];
    public List<RecentPayout> RecentPayouts { get; set; } = [];
    public List<RoundRecord> RoundHistory { get; set; } = [];
}

public sealed class WalletRequest
{
    public decimal Amount { get; set; }
}

public sealed class WalletActivity
{
    public string Label { get; set; } = "";
    public decimal Amount { get; set; }
    public string Direction { get; set; } = "in";
}

public sealed class RecentPayout
{
    public string Symbol { get; set; } = "";
    public string Name { get; set; } = "";
    public decimal Amount { get; set; }
    public int Matches { get; set; }
}

public sealed class RoundRecord
{
    public string Outcome { get; set; } = "LOSS";
    public string Detail { get; set; } = "";
    public decimal Amount { get; set; }
}

public sealed class SpinRequest
{
    public decimal Bet { get; set; }
    public string BetType { get; set; } = "classic";
}

public sealed class WinningMatch
{
    public string Id { get; set; } = "";
    public string Label { get; set; } = "";
    public int[] Positions { get; set; } = [];
    public Outcome Outcome { get; set; } = new();
}

public sealed class Outcome
{
    public string Symbol { get; set; } = "";
    public string Name { get; set; } = "";
    public decimal Multiplier { get; set; }
    public int FreeSpins { get; set; }
}

public sealed class SpinResponse
{
    public string[] Reels { get; set; } = [];
    public List<WinningMatch> Matches { get; set; } = [];
    public decimal Bet { get; set; }
    public decimal Wager { get; set; }
    public decimal Winnings { get; set; }
    public decimal JackpotWin { get; set; }
    public decimal Balance { get; set; }
    public decimal Jackpot { get; set; }
    public int FreeSpins { get; set; }
    public int Spins { get; set; }
    public int Wins { get; set; }
    public int Losses { get; set; }
    public int WinStreak { get; set; }
    public List<RecentPayout> RecentPayouts { get; set; } = [];
    public List<RoundRecord> RoundHistory { get; set; } = [];
}

public sealed class PlayerProfile
{
    public string PlayerName { get; set; } = "";
    public string Email { get; set; } = "";
    public string SessionMode { get; set; } = "Demo play";
    public string TableAccess { get; set; } = "Premium play";
}

public sealed class UpdateProfileRequest
{
    public string PlayerName { get; set; } = "";
}

public sealed class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = "";
    public string NewPassword { get; set; } = "";
}

public sealed class ApiError
{
    public string Message { get; set; } = "";
}
