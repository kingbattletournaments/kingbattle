"use client";

import { useEffect, useState } from "react";
import { brand } from "@config/brand";
import { formatMatchDateTime } from "@/lib/format-match-datetime";
import type { LandingPageData } from "@/lib/landing-data";

function matchTypeLabel(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("duo")) return "Duo";
  if (t.includes("squad")) return "Squad";
  return "Solo";
}

function winPrize(match: LandingPageData["tournamentSections"][0]["matches"][0]): number {
  return match.prizePool?.totalPrizePool ?? 0;
}

function perKill(match: LandingPageData["tournamentSections"][0]["matches"][0]): number {
  return match.prizePool?.coinsPerKill ?? 0;
}

export default function LandingPage({ data }: { data: LandingPageData }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [typedIndex, setTypedIndex] = useState(0);
  const phrases = brand.hero.typedPhrases;
  const downloadHref = brand.download.apkUrl || "#download";

  useEffect(() => {
    const timer = setInterval(() => {
      setTypedIndex((i) => (i + 1) % phrases.length);
    }, 2800);
    return () => clearInterval(timer);
  }, [phrases.length]);

  const screenshots =
    data.banners.length > 0
      ? data.banners
      : [
          { id: "1", imageUrl: "", linkUrl: "" },
          { id: "2", imageUrl: "", linkUrl: "" },
          { id: "3", imageUrl: "", linkUrl: "" },
        ];

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <a href="#" className="landing-logo">
            KING <span>BATTLE</span>
          </a>
          <div className="landing-nav-links">
            <a href="#home">Home</a>
            <a href="#screenshot">Screenshots</a>
            <a href="#features">Features</a>
            <a href="#tournaments">Tournaments</a>
            <a href="#howtoplay">How To Play</a>
            <a href="#download">Download</a>
          </div>
          <button
            type="button"
            className="landing-nav-toggle"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            ☰
          </button>
        </div>
        <div className={`landing-nav-mobile${menuOpen ? " open" : ""}`}>
          <a href="#home" onClick={() => setMenuOpen(false)}>Home</a>
          <a href="#screenshot" onClick={() => setMenuOpen(false)}>Screenshots</a>
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#tournaments" onClick={() => setMenuOpen(false)}>Tournaments</a>
          <a href="#howtoplay" onClick={() => setMenuOpen(false)}>How To Play</a>
          <a href="#download" onClick={() => setMenuOpen(false)}>Download</a>
        </div>
      </nav>

      <header className="landing-hero" id="home">
        <div className="landing-hero-grid">
          <div>
            <h1>
              <span className="landing-hero-typed">{phrases[typedIndex]}</span>
              <br />
              with {brand.appName}
            </h1>
            <p className="landing-hero-sub">{brand.hero.subtitle}</p>
            <a className="landing-btn-primary" href={downloadHref}>
              {brand.download.buttonLabel}
            </a>
          </div>
          <div className="landing-hero-phone-wrap">
            <div className="landing-phone-mock" aria-hidden>
              <div className="landing-phone-screen">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brand.images.welcomeScreen}
                  alt={`${brand.appName} welcome screen`}
                  className="landing-phone-screen-img"
                  width={910}
                  height={1920}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="landing-section light" id="screenshot">
        <div className="landing-container">
          <h2 className="landing-section-title">App Screenshot</h2>
          <p className="landing-section-subtitle">
            Check the screenshots below to get an idea of the app flow and features.
          </p>
          <div className="landing-screenshots">
            {screenshots.map((banner, idx) => (
              <div key={banner.id} className="landing-screenshot">
                {banner.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={banner.imageUrl} alt={`App screenshot ${idx + 1}`} />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: `linear-gradient(160deg, #14532d, #${idx === 1 ? "166534" : idx === 2 ? "15803d" : "064e3b"})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 700,
                      padding: "1rem",
                      textAlign: "center",
                    }}
                  >
                    {brand.appName}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section dark" id="features">
        <div className="landing-container">
          <h2 className="landing-section-title">Features</h2>
          <p className="landing-section-subtitle">
            {brand.appName} gives you a stage to play eSports on your favourite mobile games.
          </p>
          <div className="landing-features-grid">
            {brand.features.map((feature) => (
              <div key={feature.title} className="landing-feature-card">
                <div className="landing-feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section light" id="tournaments">
        <div className="landing-container">
          <h2 className="landing-section-title">Tournaments</h2>
          <p className="landing-section-subtitle">
            Upcoming matches live from the platform. Download the app to join.
          </p>

          {data.tournamentSections.length === 0 ? (
            <p style={{ textAlign: "center", color: "#6b7280", padding: "2rem 0" }}>
              No upcoming tournaments right now. Check back soon or download the app for alerts.
            </p>
          ) : (
            data.tournamentSections.map((section) => (
              <div key={section.modeId} className="landing-tournament-block">
                <div className="landing-tournament-header">
                  <h3>{section.modeName}</h3>
                  <span className="hidden md:inline">Top 10 players</span>
                </div>
                <div className="landing-tournament-grid">
                  <div className="landing-tour-cards">
                    {section.matches.map((match) => {
                      const filled = match.participantCount ?? 0;
                      const max = match.maxParticipants || 1;
                      const pct = Math.min(100, Math.round((filled / max) * 100));
                      return (
                        <div key={match.id} className="landing-tour-card">
                          {match.image || section.modeImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={match.image || section.modeImage || ""}
                              alt={match.title}
                              className="landing-tour-img-fallback"
                            />
                          ) : (
                            <div className="landing-tour-img-fallback" />
                          )}
                          <div className="landing-tour-body">
                            <span className="landing-badge pink">{matchTypeLabel(match.matchType)}</span>
                            <span className="landing-badge blue">{match.map || "BERMUDA"}</span>
                            <div className="landing-tour-title">🎮 {match.title}</div>
                            <div className="landing-progress-row">
                              <div className="landing-progress">
                                <div className="landing-progress-bar" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="landing-progress-count">
                                {filled}/{max}
                              </div>
                            </div>
                            <div className="landing-tour-stats">
                              <div>
                                <span className="label">Starts</span>
                                <span className="value green">{formatMatchDateTime(match.scheduledAt)}</span>
                              </div>
                              <div>
                                <span className="label">Win Prize</span>
                                <span className="value pink">{winPrize(match)}</span>
                              </div>
                              <div>
                                <span className="label">Per Kill</span>
                                <span className="value blue">{perKill(match)}</span>
                              </div>
                            </div>
                            <a className="landing-join-btn" href={downloadHref}>
                              💵 {match.entryFee} Join &gt;
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="landing-leaderboard">
                    <h4>Top 10 players</h4>
                    <table>
                      <thead>
                        <tr>
                          <th>Place</th>
                          <th>User</th>
                          <th style={{ textAlign: "right" }}>Wins</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.leaderboard.map((player, index) => (
                          <tr key={player.id}>
                            <td>#{index + 1}</td>
                            <td>{player.displayName}</td>
                            <td className="wins">{player.wins}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="landing-section dark" id="howtoplay">
        <div className="landing-container">
          <h2 className="landing-section-title">{brand.howToPlay.title}</h2>
          <p className="landing-section-subtitle">{brand.howToPlay.subtitle}</p>
          <div className="landing-how-grid">
            {brand.howToPlay.steps.map((step, index) => (
              <div key={step.title} className="landing-how-step">
                <div className="landing-how-step-num">{index + 1}</div>
                <h3>{step.title}</h3>
                <p style={{ color: "#cbd5e1", fontSize: "0.9rem", lineHeight: 1.55 }}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section dark landing-download" id="download">
        <div className="landing-container">
          <h2 className="landing-section-title">{brand.prizes.title}</h2>
          <p>{brand.prizes.description}</p>
          <div className="landing-payment-tags">
            {brand.prizes.methods.map((method) => (
              <span key={method}>{method}</span>
            ))}
          </div>
          <p style={{ marginBottom: "1.25rem", color: "var(--cw-mint)", fontWeight: 600 }}>Happy earning!</p>
          <a className="landing-btn-solid" href={downloadHref}>
            Download Now
          </a>
          {!brand.download.apkUrl && (
            <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#9ca3af" }}>
              APK link will be available here once uploaded by the admin team.
            </p>
          )}
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-grid">
          <div>
            <h5>{brand.appName}</h5>
            <p style={{ color: "#9ca3af", fontSize: "0.9rem", lineHeight: 1.6 }}>
              Secure tournament platform for Free Fire players. Compete daily and win real rewards.
            </p>
          </div>
          <div>
            <h5>Quick Links</h5>
            <ul>
              <li><a href="#home">Home</a></li>
              <li><a href="#tournaments">Tournaments</a></li>
              <li><a href="#download">Download</a></li>
            </ul>
          </div>
          <div>
            <h5>Support</h5>
            <ul>
              <li><a href="#features">About</a></li>
              <li><a href={brand.footer.adminPath}>Admin Login</a></li>
            </ul>
          </div>
        </div>
        <div className="landing-footer-bottom">© {new Date().getFullYear()} {brand.footer.copyright}</div>
      </footer>
    </div>
  );
}
