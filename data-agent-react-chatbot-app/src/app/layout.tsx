import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NFL Data Agent Chat",
  description: "Natural language analytics for NFL play-by-play data powered by Microsoft Fabric Data Agents",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
