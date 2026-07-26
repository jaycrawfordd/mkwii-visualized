import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MKW Lounge All-Time Ladder Lab",
  description:
    "All-time MKW Lounge ladder visualizations for rank-one reigns, event records, score extremes, and comeback gaps.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
