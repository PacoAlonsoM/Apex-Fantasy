import Link from "next/link";
import { FOOTER_LINKS, PUBLIC_NAV, getSiteChrome } from "./siteData";

function Brand() {
  return (
    <Link className="public-brand" href="/">
      <span className="public-brand-mark">S</span>
      <span className="public-brand-copy">
        <strong>STINT</strong>
        <span>F1 Predictions</span>
      </span>
    </Link>
  );
}

function Nav({ active }) {
  return (
    <nav className="public-nav" aria-label="Primary">
      {PUBLIC_NAV.map((item) => (
        <Link key={item.href} className={`public-nav-link${active === item.key ? " is-active" : ""}`} href={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function AccountPill() {
  return (
    <div className="public-account-pill" aria-hidden="true">
      <span className="public-account-avatar">PA</span>
      <span className="public-account-copy">
        <strong>Pacoalonso</strong>
        <span>32 pts</span>
      </span>
    </div>
  );
}

function Footer() {
  const chrome = getSiteChrome();

  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div className="public-footer-top">
          <div className="public-footer-copy">
            <strong style={{ color: "#fafafa", fontWeight: 800 }}>{chrome.brandName}</strong> · {chrome.tagline}
          </div>
          <div className="public-footer-links">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="public-footer-copy">{chrome.disclaimer}</div>
        <div className="public-footer-copy">© 2026 {chrome.brandName}. Contact: {chrome.supportEmail}</div>
      </div>
    </footer>
  );
}

export default function PublicShell({ active, children }) {
  return (
    <div className="public-shell">
      <header className="public-topbar">
        <div className="public-topbar-inner">
          <Brand />
          <Nav active={active} />
          <AccountPill />
        </div>
      </header>
      <main className="public-main">{children}</main>
      <Footer />
    </div>
  );
}
