import './globals.css';
import Nav from './nav';

export const metadata = {
  title: "Larry's PGA Pool 2027",
  description: 'Live standings, leaderboard and projections for the PGA pool',
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="inner">
            <div className="brand"><span className="dot" />Larry&apos;s PGA Pool 2027</div>
            <Nav />
          </div>
        </header>
        <div className="wrap">{children}</div>
      </body>
    </html>
  );
}
