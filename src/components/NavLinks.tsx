"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg whitespace-nowrap hover:bg-[var(--bg)] ${active ? "bg-[var(--bg)] font-medium" : ""}`}
          >
            {n.label}
          </Link>
        );
      })}
    </>
  );
}
