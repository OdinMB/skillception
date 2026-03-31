import { useState, useEffect, useCallback } from "react";

/** Obfuscate email to deter scrapers */
function obfuscatedEmail(user: string, domain: string) {
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        window.location.href = `mailto:${user}@${domain}`;
      }}
    >
      {user}@{domain}
    </a>
  );
}

function obfuscatedAddress() {
  // Rendered via JS so it's not in static HTML
  return <span>Sonnenallee 50, 12045 Berlin, Germany</span>;
}

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="legal-overlay" onClick={onClose}>
      <div className="legal-modal" onClick={(e) => e.stopPropagation()}>
        <button className="legal-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
        <div className="legal-body">{children}</div>
      </div>
    </div>
  );
}

function ImpressumContent() {
  return (
    <>
      <div className="legal-profile">
        <img
          src="/odin-profile-medium-w.webp"
          alt="Odin Mühlenbein"
          className="legal-avatar"
        />
      </div>

      <h2>Impressum</h2>

      <p>
        <strong>Verantwortlich für den Inhalt:</strong>
        <br />
        Odin Mühlenbein
        <br />
        {obfuscatedAddress()}
      </p>

      <p>
        {obfuscatedEmail("odin", "muehlenbein.de")}
        <br />
        <a
          href="https://www.linkedin.com/in/odinmuehlenbein/"
          target="_blank"
          rel="noopener noreferrer"
        >
          LinkedIn
        </a>
        <br />
        <a
          href="https://odins.website"
          target="_blank"
          rel="noopener noreferrer"
        >
          odins.website
        </a>
      </p>

      <p>
        <strong>Bildnachweis:</strong>
        <br />
        Christian Klant Fotografie,{" "}
        <a
          href="https://christian-klant.de"
          target="_blank"
          rel="noopener noreferrer"
        >
          christian-klant.de
        </a>
      </p>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <h2>Datenschutz / Privacy</h2>

      <p>
        We do not use cookies, tracking pixels, Google Analytics, advertising
        scripts, or any other invasive data collection. When you visit this site,
        nothing is stored on your device.
      </p>

      <h3>What We Collect</h3>

      <h4>Website Analytics</h4>
      <p>
        We use Simple Analytics, a privacy-focused analytics service that does
        not use cookies, does not track individual visitors, does not collect
        personal data, does not store your IP address, respects Do Not Track
        settings, and is fully GDPR, CCPA, and PECR compliant. Simple Analytics
        collects only aggregated, anonymous data such as page views and referrer
        sources. No information is ever tied to you as an individual. You can
        view their privacy policy at{" "}
        <a
          href="https://simpleanalytics.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          simpleanalytics.com/privacy
        </a>
        .
      </p>

      <h4>Server Logs</h4>
      <p>
        Our server records basic request metadata (URL path, HTTP status,
        response time) for operational monitoring. These logs are retained for 14
        days and then automatically deleted. Sensitive information such as
        authentication headers and cookies is redacted from all logs.
      </p>

      <h3>What We Store on Your Device</h3>
      <p>
        Nothing. We do not set cookies, and we do not use localStorage,
        sessionStorage, IndexedDB, or any other browser storage mechanism.
      </p>

      <h3>Third-Party Services</h3>
      <div className="figure">
        <div className="figure-content table-scroll">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Purpose</th>
                <th>Data Shared</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Simple Analytics</td>
                <td>Privacy-first analytics</td>
                <td>Anonymous page views only. No cookies, no personal data.</td>
              </tr>
              <tr>
                <td>Render</td>
                <td>Website hosting</td>
                <td>
                  Standard HTTP data (IP address, user agent) as part of hosting
                  infrastructure.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p>
        All fonts used on this site are self-hosted. We do not load fonts,
        scripts, or other resources from external CDNs, meaning your IP address
        is not shared with third parties when you visit.
      </p>

      <hr className="thin-rule" />

      <h3>Datenschutzerklärung</h3>

      <p>Diese Webseite verwendet keine Cookies.</p>

      <p>
        Soweit auf dieser Seite personenbezogene Daten (beispielsweise Name,
        Anschrift oder E-Mail-Adressen) erhoben werden, erfolgt dies auf
        freiwilliger Basis. Diese Daten werden ohne Ihre ausdrückliche Zustimmung
        nicht an Dritte weitergegeben.
      </p>

      <p>
        Ich weise darauf hin, dass die Datenübertragung im Internet (z.B. bei
        der Kommunikation per E-Mail) Sicherheitslücken aufweisen kann. Ein
        lückenloser Schutz der Daten vor dem Zugriff durch Dritte ist nicht
        möglich.
      </p>

      <h4>Verantwortlicher für die Datenverarbeitung</h4>
      <p>
        Render Services, Inc.
        <br />
        525 Brannan Street, Suite 300
        <br />
        San Francisco, CA 94107
        <br />
        United States
      </p>

      <h4>Personenbezogene Daten</h4>
      <p>
        Personenbezogene Daten sind alle Informationen, die sich auf eine
        identifizierte oder identifizierbare natürliche Person beziehen. Als
        identifizierbar wird eine natürliche Person angesehen, die direkt oder
        indirekt, insbesondere mittels Zuordnung zu einer Kennung wie einem
        Namen, zu einer Kennnummer, zu Standortdaten, zu einer Online-Kennung
        oder zu einem oder mehreren besonderen Merkmalen identifiziert werden
        kann.
      </p>

      <h4>Daten beim Websiteaufruf</h4>
      <p>
        Wenn Sie diese Website nur nutzen, um sich zu informieren und keine Daten
        angeben, dann verarbeiten wir nur die Daten, die zur Anzeige der Website
        auf dem von Ihnen verwendeten internetfähigen Gerät erforderlich sind:
      </p>
      <ul>
        <li>IP-Adresse</li>
        <li>Datum und Uhrzeit der Anfrage</li>
        <li>jeweils übertragene Datenmenge</li>
        <li>die Website, von der die Anforderung kommt</li>
        <li>Browsertyp und Browserversion</li>
        <li>Betriebssystem</li>
      </ul>
      <p>
        Diese Daten können nicht bestimmten Personen zugeordnet werden. Ich führe
        die Daten nicht mit anderen Daten zusammen.
      </p>
      <p>
        Die IP-Adressen werden von meinem Provider gespeichert, um die Anzahl
        der Seitenbesucher zu zählen. Diese Funktion lässt sich leider nicht
        deaktivieren. Sobald das möglich ist, werde ich es tun. Ich verwende
        darüber hinaus keine Analyseportale wie Google Analytics.
      </p>
      <p>
        Rechtsgrundlage für die Verarbeitung dieser Daten sind berechtigte
        Interessen gemäß Art. 6 Abs. 1 UAbs. 1 Buchstabe f) DSGVO, um die
        Darstellung der Website grundsätzlich zu ermöglichen.
      </p>

      <h4>Ihre Rechte</h4>
      <p>Als betroffene Person haben Sie folgende Rechte:</p>
      <ul>
        <li>
          Auskunftsrecht bezüglich der Sie betreffenden personenbezogenen Daten
          (Art. 15 DSGVO)
        </li>
        <li>
          Recht auf Berichtigung unrichtiger oder unvollständiger Daten (Art. 16
          DSGVO)
        </li>
        <li>Recht auf Löschung (Art. 17 DSGVO)</li>
        <li>
          Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)
        </li>
        <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>Widerspruchsrecht (Art. 21 DSGVO)</li>
        <li>
          Recht auf Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)
        </li>
      </ul>

      <p>
        Bei Fragen zum Datenschutz:{" "}
        {obfuscatedEmail("contact", "skillception.study")}
      </p>
    </>
  );
}

export default function Footer() {
  const [modal, setModal] = useState<"impressum" | "privacy" | null>(null);
  const closeModal = useCallback(() => setModal(null), []);

  return (
    <>
      <footer className="site-footer">
        <button className="footer-link" onClick={() => setModal("impressum")}>
          Impressum
        </button>
        <span className="footer-sep">&middot;</span>
        <button className="footer-link" onClick={() => setModal("privacy")}>
          Privacy
        </button>
        <span className="footer-text">(no tracking)</span>
        <span className="footer-sep">&middot;</span>
        <a
          href="https://ko-fi.com/OdinMB"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link-a"
        >
          Send me a coffee
        </a>
      </footer>

      <Modal open={modal === "impressum"} onClose={closeModal}>
        <ImpressumContent />
      </Modal>

      <Modal open={modal === "privacy"} onClose={closeModal}>
        <PrivacyContent />
      </Modal>
    </>
  );
}
