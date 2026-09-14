'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  ['/', 'Standings'],
  ['/event', 'This week'],
  ['/players', 'Players'],
  ['/admin', 'Admin'],
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="tabs">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className={path === href ? 'active' : ''}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
