"use client";

import { useState } from "react";

/** Menu photo, or a coloured block with the item's initial if there is no photo or it fails. */
export function ItemImage({
  src,
  name,
  className = "",
}: {
  src: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        className={`flex items-center justify-center bg-tint font-heading text-3xl font-bold text-primary ${className}`}
      >
        {name.trim().charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small local photos; next/image adds little here
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
