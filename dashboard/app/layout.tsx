import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

import { logoutAction } from "./actions";
import { getSession } from "@/lib/scans";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WiFi AR Dashboard",
  description: "Saved Wi-Fi signal scans and heatmaps",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}

async function Nav() {
  const session = await getSession();
  if (!session) return null;
  return (
    <nav className="nav">
      <Link href="/">Recordings</Link>
      {session.user.role === "admin" && <Link href="/users">Users</Link>}
      <span className="navSpacer" />
      <span className="scanMeta">{session.user.name}</span>
      <form action={logoutAction}>
        <button type="submit" className="ghost">Log out</button>
      </form>
    </nav>
  );
}
