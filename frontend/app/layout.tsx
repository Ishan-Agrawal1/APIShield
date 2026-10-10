import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'APIShield',
  description: 'Authorized REST API security assessment',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/*
          THESIS: The triage interface as a high-density stock trading terminal, prioritizing rapid scanning and split-pane deep analysis.
          OWN-WORLD: Deep charcoal background, stark white data, monospaced numerical readouts, vivid neon severity markers (red, amber, cyan) with distinct shapes.
          STORY: The security engineer monitors a constant flow of vulnerabilities, instantly separating noise from critical risk.
          FIRST VIEWPORT: A dense ticker-like list of findings on the left pane, and a comprehensive fundamental analysis of a selected finding on the right.
          FORM: Stock trading terminal (Candidate 6; seed key 605f283d).
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
        */}
        <div className="shell">
          <header className="top">
            <a href="/" className="brand">
              APIShield
            </a>
            <nav>
              <a href="/" className='m-4'>Scans</a>
              <a>|</a>
              <a href="/scans/route" className='m-4'>Route test</a>
              <a>|</a>
              <a href="/specifications/new" className='m-4'>Upload spec</a>
              <a>|</a>
              <a href="/scans/new" className='m-4'>New scan</a>
            </nav>
          </header>
          <p className="notice">
            Authorized use only. The UI selects an approved local target profile. Uploaded OpenAPI <code>servers</code> values
            cannot grant network access.
          </p>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
