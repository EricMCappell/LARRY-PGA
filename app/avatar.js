'use client';

import { useState } from 'react';

/**
 * Player photo from ESPN, falling back to initials when there's no headshot on
 * file or the image fails to load.
 */
export default function Avatar({ src, name }) {
  const [failed, setFailed] = useState(false);

  const initials = String(name || '')
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (!src || failed) {
    return <span className="avatar ghost" aria-hidden="true">{initials}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="avatar"
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
