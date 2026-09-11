import { useEffect, useRef, useState, type FormEvent } from "react";
import "./App.css";

import {
  getOutcomes,
  getRandomOutcome,
  type Outcome,
} from "./gameLogic";
import { api, type AccountSnapshot, type PlayerProfile, type RecentPayout, type RoundRecord, type WalletActivity, type WinningMatch } from "./api";

const startingReels = ["🍒", "🍋", "🍊", "🍇", "🍉", "🍓", "🍍", "🔔", "⭐"];
const startingSpinState = Array.from({ length: 9 }, () => false);

type BetType = "classic" | "boost";

type AuthMode = "login" | "register";
type AppView = "game" | "profile";

const formatWager = (amount: number): string =>
  amount < 1 ? `${Math.round(amount * 100)}¢` : `${amount.toLocaleString()} cr`;

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authError, setAuthError] = useState("");
  const [balance, setBalance] = useState(1000);
  const [walletBalance, setWalletBalance] = useState(2500);
  const [walletAmount, setWalletAmount] = useState(100);
  const [walletOpen, setWalletOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("game");
  const [walletMessage, setWalletMessage] = useState("");
  const [walletActivity, setWalletActivity] = useState<WalletActivity[]>([
    { label: "Opening play balance", amount: 1000, direction: "in" },
  ]);
  const [bet, setBet] = useState(10);
  const [betType, setBetType] = useState<BetType>("classic");
  const [reels, setReels] = useState(startingReels);
  const [spinning, setSpinning] = useState(startingSpinState);
  const [result, setResult] = useState("Place your bet and spin the reels");
  const [spins, setSpins] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);
  const [winningCells, setWinningCells] = useState<number[]>([]);
  const [matchPulse, setMatchPulse] = useState(false);
  const [activeMatches, setActiveMatches] = useState<WinningMatch[]>([]);
  const [recentPayouts, setRecentPayouts] = useState<RecentPayout[]>([]);
  const [jackpot, setJackpot] = useState(12500);
  const [winStreak, setWinStreak] = useState(0);
  const [roundHistory, setRoundHistory] = useState<RoundRecord[]>([]);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const matchPulseTimer = useRef<number | null>(null);

  const outcomes = getOutcomes();
  const isSpinning = spinning.some(Boolean);
  const topOutcome = outcomes.reduce((highest, outcome) =>
    outcome.multiplier > highest.multiplier ? outcome : highest,
  );
  const effectiveBet = betType === "boost" ? bet * 2 : bet;
  const potentialPayout = effectiveBet * topOutcome.multiplier;
  const burnPercent = Math.min(100, balance > 0 ? (effectiveBet / balance) * 100 : 100);
  const burnLabel = burnPercent >= 20 ? "Critical" : burnPercent >= 10 ? "Hot" : "Controlled";
  const missionProgress = Math.min(10, wins);
  const missionComplete = missionProgress >= 10;

  const applyAccount = (account: AccountSnapshot) => {
    setPlayerName(account.playerName);
    setBalance(account.balance);
    setWalletBalance(account.walletBalance);
    setWalletActivity(account.walletActivity);
    setRecentPayouts(account.recentPayouts);
    setRoundHistory(account.roundHistory);
    setJackpot(account.jackpot);
    setSpins(account.spins);
    setWins(account.wins);
    setLosses(account.losses);
    setFreeSpins(account.freeSpins);
    setWinStreak(account.winStreak);
  };

  useEffect(() => {
    if (!localStorage.getItem("lucky-spin-token")) return;
    api.account().then((account) => {
      applyAccount(account);
      setAuthenticated(true);
    }).catch(() => localStorage.removeItem("lucky-spin-token"));
  }, []);

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const submittedPlayerName = String(formData.get("playerName") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!email || !email.includes("@")) {
      setAuthError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setAuthError("Your password must be at least 6 characters.");
      return;
    }
    if (authMode === "register" && password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    try {
      const response = authMode === "register"
        ? await api.register(email, password, submittedPlayerName)
        : await api.login(email, password);
      localStorage.setItem("lucky-spin-token", response.token);
      applyAccount(response.account);
      setAuthError("");
      setAuthenticated(true);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to enter the table.");
    }
  };

  const signOut = async () => {
    await api.logout().catch(() => undefined);
    localStorage.removeItem("lucky-spin-token");
    setAuthenticated(false);
    setPlayerName("");
    setAuthMode("login");
  };

  useEffect(() => () => {
    if (matchPulseTimer.current !== null) {
      window.clearInterval(matchPulseTimer.current);
    }
  }, []);

  const flashMatches = (matches: WinningMatch[]) => {
    const cells = [...new Set(matches.flatMap((match) => match.positions))];
    setWinningCells(cells);
    setActiveMatches(matches);
    setMatchPulse(true);

    if (matchPulseTimer.current !== null) {
      window.clearInterval(matchPulseTimer.current);
    }

    matchPulseTimer.current = window.setInterval(() => {
      setMatchPulse((currentPulse) => !currentPulse);
    }, 220);
  };

  const depositFunds = async () => {
    if (walletAmount <= 0) {
      setWalletMessage("Enter an amount above zero.");
      return;
    }

    try {
      const account = await api.deposit(walletAmount);
      applyAccount(account);
      setWalletMessage(`${walletAmount.toLocaleString()} credits added to your wallet.`);
    } catch (error) { setWalletMessage(error instanceof Error ? error.message : "Unable to deposit funds."); }
  };

  const transferToPlay = async () => {
    try {
      const account = await api.transfer(walletAmount);
      applyAccount(account);
      setWalletMessage(`${walletAmount.toLocaleString()} credits moved to play.`);
    } catch (error) { setWalletMessage(error instanceof Error ? error.message : "Unable to fund play."); }
  };

  const withdrawFromPlay = async () => {
    try {
      const account = await api.withdraw(walletAmount);
      applyAccount(account);
      setWalletMessage(`${walletAmount.toLocaleString()} credits returned to your wallet.`);
    } catch (error) { setWalletMessage(error instanceof Error ? error.message : "Unable to withdraw funds."); }
  };

  const openProfile = async () => {
    try {
      const loadedProfile = await api.profile();
      setProfile(loadedProfile);
      setProfileName(loadedProfile.playerName);
      setProfileMessage("");
      setProfileError("");
      setActiveView("profile");
    } catch (error) {
      setWalletMessage(error instanceof Error ? error.message : "Unable to load your profile.");
    }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const updatedProfile = await api.updateProfile(profileName);
      setProfile(updatedProfile);
      setPlayerName(updatedProfile.playerName);
      setProfileMessage("Username updated successfully.");
      setProfileError("");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to update your username.");
      setProfileMessage("");
    }
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setProfileMessage("Password reset successfully.");
      setProfileError("");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to reset your password.");
      setProfileMessage("");
    }
  };

  const spin = async () => {
    if (isSpinning) return;
    if (bet <= 0) {
      setResult("Please enter a valid bet.");
      return;
    }
    const isFreeSpinRound = freeSpins > 0;
    if (matchPulseTimer.current !== null) {
      window.clearInterval(matchPulseTimer.current);
      matchPulseTimer.current = null;
    }
    setWinningCells([]);
    setMatchPulse(false);
    setActiveMatches([]);
    setSpinning(Array.from({ length: 9 }, () => true));
    setResult(isFreeSpinRound ? "Free spin in motion..." : "Reels in motion...");
    let revealedRows = 0;
    const interval = window.setInterval(() => {
      setReels((currentReels) => currentReels.map((currentReel, index) =>
        Math.floor(index / 3) < revealedRows ? currentReel : getRandomOutcome().symbol,
      ));
    }, 75);

    let spinResponse;
    try {
      spinResponse = await api.spin(bet, betType);
    } catch (error) {
      window.clearInterval(interval);
      setSpinning(Array.from({ length: 9 }, () => false));
      setResult(error instanceof Error ? error.message : "Unable to spin the reels.");
      return;
    }

    [0, 1, 2].forEach((row) => {
      window.setTimeout(() => {
        revealedRows = row + 1;
        setReels((currentReels) => currentReels.map((currentReel, index) =>
          Math.floor(index / 3) === row ? spinResponse.reels[index] : currentReel,
        ));
        setSpinning((currentSpinning) => currentSpinning.map((isCellSpinning, index) =>
          Math.floor(index / 3) === row ? false : isCellSpinning,
        ));
      }, 950 + row * 300);
    });

    window.setTimeout(() => {
      window.clearInterval(interval);
      setReels(spinResponse.reels);
      setSpinning(Array.from({ length: 9 }, () => false));
      setBalance(spinResponse.balance);
      setJackpot(spinResponse.jackpot);
      setFreeSpins(spinResponse.freeSpins);
      setSpins(spinResponse.spins);
      setWins(spinResponse.wins);
      setLosses(spinResponse.losses);
      setWinStreak(spinResponse.winStreak);
      setRecentPayouts(spinResponse.recentPayouts);
      setRoundHistory(spinResponse.roundHistory);
      if (spinResponse.matches.length > 0) {
        flashMatches(spinResponse.matches);
        const bonusMessage = spinResponse.freeSpins > 0 ? ` ${spinResponse.freeSpins} free spins ready!` : "";
        const jackpotMessage = spinResponse.jackpotWin > 0 ? ` + jackpot ${formatWager(spinResponse.jackpotWin)}!` : "";
        const matchMessage = spinResponse.matches.map((match) => match.label).join(", ");
        setResult(`${spinResponse.matches.length} match${spinResponse.matches.length === 1 ? "" : "es"}: ${matchMessage}. Won ${formatWager(spinResponse.winnings)}${bonusMessage}${jackpotMessage}`);
      } else {
        setResult(isFreeSpinRound ? "Free spin complete. No match this time." : `No match. You lost ${formatWager(spinResponse.wager)}.`);
      }
    }, 1900);
  };

  const winRate = spins > 0 ? ((wins / spins) * 100).toFixed(1) : "0.0";

  if (!authenticated) {
    return (
      <AuthScreen
        mode={authMode}
        error={authError}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthError("");
        }}
        onSubmit={handleAuth}
      />
    );
  }

  if (activeView === "profile") {
    return (
      <ProfilePage
        profile={profile}
        profileName={profileName}
        currentPassword={currentPassword}
        newPassword={newPassword}
        message={profileMessage}
        error={profileError}
        onBack={() => setActiveView("game")}
        onProfileNameChange={setProfileName}
        onCurrentPasswordChange={setCurrentPassword}
        onNewPasswordChange={setNewPassword}
        onSaveProfile={saveProfile}
        onResetPassword={resetPassword}
      />
    );
  }

  return (
    <main className="game-container">
      <section className="game-card" aria-label="BurnYourMoney game">
        <header className="game-header">
          <div className="brand-mark" aria-hidden="true">BYM</div>
          <div>
            <p className="eyebrow">LIVE TABLE / PREMIUM PLAY</p>
            <h1>BurnYourMoney</h1>
          </div>
          <div className="header-actions">
            <div className="account-actions">
              <span className="welcome-label">Hello, <strong>{playerName}</strong></span>
              <button className="wallet-button" onClick={() => setWalletOpen(true)}>
                <span className="wallet-button-label">Wallet</span>
                <strong>{walletBalance.toLocaleString()} cr</strong>
                <span aria-hidden="true">↗</span>
              </button>
            </div>
            <div className="profile-menu">
              <button
                className="menu-button"
                type="button"
                aria-label="Open account menu"
                aria-expanded={menuOpen}
                aria-controls="account-menu"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span aria-hidden="true" />
                <span aria-hidden="true" />
                <span aria-hidden="true" />
              </button>
              {menuOpen && (
                <div className="account-menu" id="account-menu" role="menu">
                  <p className="account-menu-heading">Account</p>
                  <button type="button" role="menuitem" onClick={() => { openProfile(); setMenuOpen(false); }}>
                    <span aria-hidden="true">◎</span> My profile
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); signOut(); }}>
                    <span aria-hidden="true">↪</span> Sign out
                  </button>
                </div>
              )}
            </div>
            <div className="status-dot" title="Game online" />
          </div>
        </header>

        <div className="casino-layout">
          <div className="play-column">
        <div className="balance">
          <span>Play balance</span>
          <strong>{balance.toLocaleString()}</strong>
          <small>credits</small>
          {freeSpins > 0 && (
            <div className="free-spin-badge" aria-live="polite">
              <span aria-hidden="true">↻</span> {freeSpins} free {freeSpins === 1 ? "spin" : "spins"}
            </div>
          )}
        </div>

        <div className="reels" aria-label="Three by three slot reels">
          {reels.map((reel, index) => (
            <div
              className={`reel ${spinning[index] ? "spinning" : ""} ${winningCells.includes(index) ? "winning-cell" : ""} ${winningCells.includes(index) && matchPulse ? "match-pulse" : ""}`}
              key={index}
            >
              <span>{reel}</span>
            </div>
          ))}
        </div>

        <p className={`result ${activeMatches.length > 0 ? "result-win" : ""}`} role="status">
          {result}
        </p>
        {activeMatches.length > 0 && (
          <div className="match-summary" aria-label="Winning matches">
            {activeMatches.map((match) => (
              <span className="match-chip" key={match.id}>
                <b>{match.outcome.symbol}</b> {match.label}
              </span>
            ))}
          </div>
        )}

        <button className="spin-button" onClick={spin} disabled={isSpinning}>
          <span>{isSpinning ? "Spinning" : freeSpins > 0 ? `Use free spin (${freeSpins})` : "Spin the reels"}</span>
          <span className="button-arrow" aria-hidden="true">↗</span>
        </button>

        <div className="bet-section">
          <div className="section-label-row">
            <p>Stake</p>
            <span>Credits / cents</span>
          </div>
          <div className="bet-controls">
            {[10, 25, 50, 100].map((amount) => (
              <button className={bet === amount ? "selected" : ""} key={amount} onClick={() => setBet(amount)}>
                {amount}
              </button>
            ))}
            <label className="custom-bet">
              <span className="sr-only">Custom bet amount</span>
              <input type="number" min="1" value={bet} onChange={(event) => setBet(Number(event.target.value))} />
            </label>
          </div>
          <div className="cents-label">Low stakes</div>
          <div className="bet-controls cents-controls" aria-label="Cents bet amounts">
            {[0.05, 0.1, 0.2].map((amount) => (
              <button className={bet === amount ? "selected" : ""} key={amount} onClick={() => setBet(amount)}>
                {formatWager(amount)}
              </button>
            ))}
          </div>
          <div className="bet-type-controls" aria-label="Bet type">
            <button className={betType === "classic" ? "selected" : ""} onClick={() => setBetType("classic")}>
              <span>Classic</span><small>1× stake</small>
            </button>
            <button className={betType === "boost" ? "selected" : ""} onClick={() => setBetType("boost")}>
              <span>Boost</span><small>2× stake / win</small>
            </button>
          </div>
          <p className="current-bet">Wagering <strong>{formatWager(effectiveBet)}</strong> per spin</p>
        </div>

        <section className="live-betting" aria-label="Live betting information">
          <div className="live-betting-header">
            <div>
              <p className="eyebrow">Live betting</p>
              <h2>Round monitor</h2>
            </div>
            <span className={`live-pill ${isSpinning ? "locked" : ""}`}>
              <i aria-hidden="true" /> {isSpinning ? "LOCKED" : "OPEN"}
            </span>
          </div>
          <div className="live-metrics">
            <div><span>Current stake</span><strong>{formatWager(effectiveBet)}</strong></div>
            <div><span>Top payout</span><strong>{formatWager(potentialPayout)}</strong></div>
            <div><span>Best odds</span><strong>{topOutcome.multiplier}x</strong></div>
          </div>
          <div className="live-ticker">
            <span className="ticker-dot" aria-hidden="true" />
            <span>{isSpinning ? "Bets locked while reels settle" : "Bets open for the next round"}</span>
            <strong>{topOutcome.symbol} {topOutcome.name}</strong>
          </div>
        </section>

        <div className="dashboard-grid">
          <section className="statistics">
            <div className="section-title"><h2>Session</h2><span>LIVE</span></div>
            <div className="statistics-grid">
              <Stat label="Spins" value={spins} />
              <Stat label="Wins" value={wins} />
              <Stat label="Losses" value={losses} />
            </div>
            <div className="win-rate"><span>Win rate</span><strong>{winRate}%</strong></div>
          </section>

          <section className="paytable">
            <div className="section-title"><h2>Paytable</h2><span>3 MATCH</span></div>
            {outcomes.map((outcome: Outcome) => (
              <div className="paytable-row" key={outcome.symbol}>
                <span><b>{outcome.symbol}</b>{outcome.name}</span>
                <strong>{outcome.multiplier}x</strong>
              </div>
            ))}
          </section>
        </div>

          </div>

          <aside className="casino-rail">
            <section className="table-overview">
              <p className="eyebrow">Table brief</p>
              <h2>All lines live</h2>
              <p className="rail-copy">Every spin checks the full board for connected wins.</p>
              <div className="rail-stats">
                <div><span>Board</span><strong>3 × 3</strong></div>
                <div><span>Active lines</span><strong>8</strong></div>
                <div><span>Bonus lines</span><strong>2</strong></div>
              </div>
              <div className="rail-status"><i aria-hidden="true" /> Live odds are updating</div>
            </section>

            <section className="jackpot-panel" aria-label="Progressive jackpot">
              <div className="section-title"><h2>House jackpot</h2><span>PROGRESSIVE</span></div>
              <strong className="jackpot-value">{formatWager(jackpot)}</strong>
              <div className="jackpot-track"><span style={{ width: `${Math.min(100, (jackpot / 20000) * 100)}%` }} /></div>
              <p>Three or more winning lines trigger the demo jackpot.</p>
            </section>

            <section className="best-bet-panel" aria-label="Best live bet">
              <div className="best-bet-header">
                <div>
                  <p className="eyebrow">Live recommendation</p>
                  <h2>Best bet live</h2>
                </div>
                <span className="best-bet-odds">{topOutcome.multiplier}x</span>
              </div>
              <div className="best-bet-pick">
                <span className="best-bet-symbol" aria-hidden="true">{topOutcome.symbol}</span>
                <div>
                  <span className="best-bet-label">Top payout symbol</span>
                  <strong>{topOutcome.name}</strong>
                </div>
              </div>
              <div className="best-bet-metrics">
                <div><span>Stake</span><strong>{formatWager(effectiveBet)}</strong></div>
                <div><span>Return</span><strong>{formatWager(potentialPayout)}</strong></div>
              </div>
              <p className="best-bet-note">Three matching symbols on any active line unlock this return.</p>
            </section>

            <section className="burn-meter-panel" aria-label="Live burn meter">
              <div className="best-bet-header">
                <div>
                  <p className="eyebrow">Live exposure</p>
                  <h2>Burn Meter</h2>
                </div>
                <span className="burn-level">{burnLabel}</span>
              </div>
              <div className="burn-meter-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={burnPercent}>
                <span style={{ width: `${burnPercent}%` }} />
              </div>
              <div className="burn-meter-caption"><span>{formatWager(effectiveBet)} at risk</span><strong>{burnPercent.toFixed(1)}% of play balance</strong></div>
              <p className="best-bet-note">A quick view of how aggressive this round is before you commit.</p>
            </section>

            <section className="mission-panel" aria-label="Session mission">
              <div className="best-bet-header">
                <div><p className="eyebrow">Session mission</p><h2>Hot streak</h2></div>
                <span className="mission-count">{missionProgress}/10</span>
              </div>
              <p className="best-bet-note">Win 10 rounds in this session to unlock the table badge.</p>
              <div className="mission-track"><span style={{ width: `${missionProgress * 10}%` }} /></div>
              <div className="mission-footer"><span>{missionComplete ? "Badge unlocked" : `${10 - missionProgress} wins remaining`}</span><strong>{winStreak} win streak</strong></div>
            </section>

            <section className="activity-panel" aria-label="Recent payouts">
              <div className="section-title"><h2>Recent payouts</h2><span>LIVE FEED</span></div>
              {recentPayouts.length > 0 ? recentPayouts.map((payout, index) => (
                <div className="activity-row" key={`${payout.amount}-${index}`}>
                  <span><b>{payout.symbol}</b>{payout.name}<small>{payout.matches} line{payout.matches === 1 ? "" : "s"}</small></span>
                  <strong>+{payout.amount.toLocaleString()} cr</strong>
                </div>
              )) : <p className="empty-feed">Your winning lines will appear here.</p>}
            </section>

            <section className="round-panel" aria-label="Recent rounds">
              <div className="section-title"><h2>Round ledger</h2><span>LAST 5</span></div>
              {roundHistory.length > 0 ? roundHistory.map((round, index) => (
                <div className="round-row" key={`${round.detail}-${index}`}>
                  <span className={round.outcome === "WIN" ? "round-win" : "round-loss"}>{round.outcome}</span>
                  <small>{round.detail}</small>
                  <strong className={round.outcome === "WIN" ? "positive" : "negative"}>{round.outcome === "WIN" ? "+" : "-"}{formatWager(round.amount)}</strong>
                </div>
              )) : <p className="empty-feed">Your last five rounds will appear here.</p>}
            </section>

            <section className="trust-panel" aria-label="Game status">
              <div><span className="trust-icon">✓</span><span>Session mode</span><strong>Demo play</strong></div>
              <div><span className="trust-icon">⌁</span><span>Funds</span><strong>Client-side only</strong></div>
              <p>Wallet values are for local play until account services are connected.</p>
            </section>

          </aside>
        </div>

        {walletOpen && (
          <div className="modal-backdrop" role="presentation" onClick={() => setWalletOpen(false)}>
            <section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title" onClick={(event) => event.stopPropagation()}>
              <div className="wallet-modal-header">
                <div>
                  <p className="eyebrow">Account funds</p>
                  <h2 id="wallet-title">Your wallet</h2>
                </div>
                <button className="close-button" onClick={() => setWalletOpen(false)} aria-label="Close wallet">×</button>
              </div>

              <div className="wallet-total">
                <span>Wallet balance</span>
                <strong>{walletBalance.toLocaleString()} cr</strong>
              </div>

              <div className="wallet-form">
                <label htmlFor="wallet-amount">Amount</label>
                <div className="wallet-input-row">
                  <input id="wallet-amount" type="number" min="1" value={walletAmount} onChange={(event) => setWalletAmount(Number(event.target.value))} />
                  <span>credits</span>
                </div>
                <div className="quick-amounts">
                  {[50, 100, 250, 500].map((amount) => (
                    <button key={amount} onClick={() => setWalletAmount(amount)}>{amount}</button>
                  ))}
                </div>
              </div>

              <div className="wallet-actions">
                <button className="wallet-action-primary" onClick={depositFunds}>Deposit money</button>
                <button onClick={transferToPlay}>Put credits in play</button>
                <button onClick={withdrawFromPlay}>Withdraw money</button>
              </div>
              {walletMessage && <p className="wallet-message" role="status">{walletMessage}</p>}

              <div className="wallet-history">
                <div className="section-title"><h3>Recent activity</h3><span>PRIVATE</span></div>
                {walletActivity.map((activity, index) => (
                  <div className="wallet-history-row" key={`${activity.label}-${index}`}>
                    <span>{activity.label}</span>
                    <strong className={activity.direction === "in" ? "positive" : "negative"}>
                      {activity.direction === "in" ? "+" : "-"}{activity.amount.toLocaleString()} cr
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function ProfilePage({
  profile,
  profileName,
  currentPassword,
  newPassword,
  message,
  error,
  onBack,
  onProfileNameChange,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onSaveProfile,
  onResetPassword,
}: {
  profile: PlayerProfile | null;
  profileName: string;
  currentPassword: string;
  newPassword: string;
  message: string;
  error: string;
  onBack: () => void;
  onProfileNameChange: (value: string) => void;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onSaveProfile: (event: FormEvent<HTMLFormElement>) => void;
  onResetPassword: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="game-container profile-page">
      <section className="game-card profile-card" aria-label="My profile">
        <header className="profile-page-header">
          <button className="back-button" type="button" onClick={onBack}>← Back to table</button>
          <div>
            <p className="eyebrow">Account settings</p>
            <h1>My profile</h1>
          </div>
          <div className="status-dot" title="Account online" />
        </header>

        <div className="profile-layout">
          <aside className="profile-summary">
            <div className="profile-avatar" aria-hidden="true">{(profile?.playerName ?? "P").slice(0, 1).toUpperCase()}</div>
            <p className="eyebrow">Player account</p>
            <h2>{profile?.playerName}</h2>
            <p>{profile?.email}</p>
            <div className="profile-details">
              <div><span>Session</span><strong>{profile?.sessionMode}</strong></div>
              <div><span>Table access</span><strong>{profile?.tableAccess}</strong></div>
            </div>
          </aside>

          <div className="profile-forms">
            <section className="profile-form-section">
              <div className="section-title"><h2>Player details</h2><span>PUBLIC</span></div>
              <form className="settings-form" onSubmit={onSaveProfile}>
                <label htmlFor="profile-name">Username</label>
                <input id="profile-name" value={profileName} onChange={(event) => onProfileNameChange(event.target.value)} minLength={2} maxLength={32} required />
                <button className="settings-submit" type="submit">Save username <span aria-hidden="true">↗</span></button>
              </form>
            </section>

            <section className="profile-form-section">
              <div className="section-title"><h2>Reset password</h2><span>PRIVATE</span></div>
              <form className="settings-form" onSubmit={onResetPassword}>
                <label htmlFor="current-password">Current password</label>
                <input id="current-password" type="password" value={currentPassword} onChange={(event) => onCurrentPasswordChange(event.target.value)} required />
                <label htmlFor="new-password">New password</label>
                <input id="new-password" type="password" value={newPassword} onChange={(event) => onNewPasswordChange(event.target.value)} minLength={6} required />
                <button className="settings-submit" type="submit">Reset password <span aria-hidden="true">↗</span></button>
              </form>
            </section>

            {message && <p className="settings-message" role="status">{message}</p>}
            {error && <p className="settings-error" role="alert">{error}</p>}
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong></div>;
}

function AuthScreen({
  mode,
  error,
  onModeChange,
  onSubmit,
}: {
  mode: AuthMode;
  error: string;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isRegistering = mode === "register";

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-showcase">
          <div className="auth-brand"><span>BYM</span><i aria-hidden="true" /></div>
          <p className="eyebrow">PRIVATE TABLE / EST. 2024</p>
          <h1><span>Burn</span><span>YourMoney</span></h1>
          <p className="auth-tagline">The house is ready. Your next spin is waiting.</p>
          <div className="auth-reel-preview" aria-hidden="true">
            <span>💎</span><span>⭐</span><span>7️⃣</span>
          </div>
          <div className="auth-showcase-footer"><span>3 × 3 BOARD</span><span>8 ACTIVE LINES</span><span>LIVE PAYOUTS</span></div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-heading">
            <p className="eyebrow">Welcome back</p>
            <h2>{isRegistering ? "Create your account" : "Enter the table"}</h2>
            <p>{isRegistering ? "Set up your player profile to start spinning." : "Sign in to continue to your private table."}</p>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button className={!isRegistering ? "active" : ""} onClick={() => onModeChange("login")} role="tab" aria-selected={!isRegistering}>Login</button>
            <button className={isRegistering ? "active" : ""} onClick={() => onModeChange("register")} role="tab" aria-selected={isRegistering}>Register</button>
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
            {isRegistering && (
              <label>Player name<input name="playerName" type="text" placeholder="Your table name" autoComplete="name" /></label>
            )}
            <label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label>
            <label>Password<div className="auth-password"><input name="password" type="password" placeholder="Minimum 6 characters" autoComplete={isRegistering ? "new-password" : "current-password"} required /><span aria-hidden="true">•••</span></div></label>
            {isRegistering && <label>Confirm password<input name="confirmPassword" type="password" placeholder="Repeat your password" autoComplete="new-password" required /></label>}
            {isRegistering && <label className="auth-check"><input type="checkbox" required /><span>I agree to the table rules and responsible-play terms.</span></label>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit">{isRegistering ? "Create player account" : "Enter BurnYourMoney"}<span aria-hidden="true">↗</span></button>
          </form>

          <p className="auth-legal">Demo access only. Account persistence and authentication services will be connected next.</p>
        </div>
      </section>
    </main>
  );
}

export default App;