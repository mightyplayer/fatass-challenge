import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Avatar } from "@/components/Avatar";
import { NavLinks } from "@/components/NavLinks";
import { config } from "@/lib/config";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/users";

export const metadata: Metadata = {
  title: config.competition.title,
  description: "Жиробас челлендж: соревнование друзей по похудению",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const nav = [
    { href: "/", label: "Дашборд" },
    { href: "/feed", label: "Лента" },
    { href: "/challenges", label: "Челленджи" },
    { href: "/fund", label: "Фонд" },
    ...(user && user.role !== "PENDING" ? [{ href: "/me", label: user.role === "PARTICIPANT" ? "Мой прогресс" : "Мой кабинет" }] : []),
    ...(isAdmin(user) ? [{ href: "/admin", label: "Админка" }] : []),
  ];
  return (
    <html lang="ru">
      <body className="min-h-screen">
        <header className="border-b border-[var(--line)] bg-[var(--card)]">
          <div className="mx-auto max-w-5xl px-4 py-2 lg:h-14 flex flex-wrap lg:flex-nowrap items-center gap-x-4 gap-y-2">
            <Link href="/" className="font-bold tracking-tight whitespace-nowrap">
              ⚖️ {config.competition.title}
            </Link>
            <nav className="order-last lg:order-none w-full lg:w-auto -ml-2.5 lg:ml-0 flex flex-wrap gap-x-1 gap-y-1 text-sm">
              <NavLinks items={nav} />
            </nav>
            <div className="ml-auto flex items-center gap-2">
              {user ? (
                <>
                  <Link href={user.role === "PARTICIPANT" ? `/p/${user.id}` : "/me"} className="flex items-center gap-2">
                    <Avatar name={user.name} url={user.avatarUrl} size={30} />
                    <span className="text-sm hidden sm:inline">{user.name}</span>
                  </Link>
                  <form action="/api/auth/logout" method="post">
                    <button className="text-sm muted hover:underline px-2">Выйти</button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="btn !py-1.5 !px-3 !bg-[#2aabee] hover:!bg-[#229ed9]">
                  Войти
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
