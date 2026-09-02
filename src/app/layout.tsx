import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";

// Fonts are the client's own (Tusker Grotesk display + IBM Plex Sans body),
// base64-embedded in fonts.css — extracted from the design reference, not from
// a font CDN. Tailwind's `font-display` / `font-sans` map to them.

export const metadata: Metadata = {
  title: "Mothership",
  description: "Mothership app",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
