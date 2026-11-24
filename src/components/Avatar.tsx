"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";

/** Аватар из Telegram; если его нет или картинка не загрузилась — инициалы. */
export function Avatar({ name, url, size = 36, className = "" }: { name: string; url?: string | null; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // картинка могла не загрузиться ещё до гидратации — тогда onError уже не сработает
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setBroken(true);
  }, [url]);
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  // инициалы лежат под картинкой: пока она грузится или если зависла, виден не пустой кружок, а инициалы
  return (
    <span
      className={`relative rounded-full shrink-0 inline-flex items-center justify-center overflow-hidden font-semibold text-white bg-[var(--color-accent)] ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-label={name}
    >
      {initials}
      {url && !broken && (
        <img
          ref={img}
          src={url}
          alt={name}
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </span>
  );
}
