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
        <div className="shell">
          <header className="top">
            <a href="/" className="brand">
              APIShield
            </a>
            <nav>
              <a href="/">Scans</a>
              <a href="/specifications/new">Upload spec</a>
              <a href="/scans/new">New scan</a>
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
