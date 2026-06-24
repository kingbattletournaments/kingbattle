"use client";

import { useEffect, useState } from "react";
import { brand } from "@config/brand";
import type { LandingPageData } from "@/lib/landing-data";

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
          <a href="#howtoplay" onClick={() => setMenuOpen(false)}>How To Play</a>
          <a href="#download" onClick={() => setMenuOpen(false)}>Download</a>
        </div>
      </nav>

      <header className="landing-hero" id="home">
        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <div className="landing-hero-app-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brand.images.appLogo}
                alt={`${brand.appName} logo`}
              />
            </div>
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
          <div className="landing-payment-methods">
            {brand.prizes.methods.map((method) => (
              <div key={method.name} className="landing-payment-method">
                <img src={method.logo} alt="" className="landing-payment-logo" aria-hidden="true" />
                <span>{method.name}</span>
              </div>
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
              <li><a href="#features">Features</a></li>
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
