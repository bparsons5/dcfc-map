import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppHeight from "./AppHeight";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Photographer Map — DMV",
  description:
    "An interactive map of helpful places for photographers in the DC / Maryland / Virginia area.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // NOTE: deliberately no `viewportFit: "cover"` — with it, mobile Chrome /
  // Custom Tabs render the page under the URL bar / status bar and rely on
  // env(safe-area-inset-*), which those contexts report as 0. The default
  // ("auto") keeps the page inside the visible, un-obscured area.
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden">
        <AppHeight />
        {children}
      </body>
    </html>
  );
}
