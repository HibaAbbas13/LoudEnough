import type { Metadata, Viewport } from "next";
import { Inter_Tight, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// A tight grotesk for the display type, so LOUD ENOUGH can be set very large
// without the letterspacing falling apart, and a serif reserved entirely for
// words a human said out loud.
const sans = Inter_Tight({ variable: "--font-sans", subsets: ["latin"] });
const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Loud Enough — say it badly, send it clearly",
  description:
    "A voice agent you can interrupt. Talk through a problem out of order, and it turns what you actually said into a message you can send — with nothing invented.",
};

export const viewport: Viewport = {
  themeColor: "#08080a",
  // The voice object is sized against the viewport; letting it zoom is fine,
  // but the initial frame should be the composed one.
  initialScale: 1,
  width: "device-width",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable} ${mono.variable} antialiased`}>
        <div className="atmosphere" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
