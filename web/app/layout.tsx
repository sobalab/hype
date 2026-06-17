import type { Metadata } from "next";
import { Host_Grotesk } from "next/font/google";
import "./globals.css";
import { FloatingSearch } from "@/components/floating-search";
import { FluidBackground } from "@/components/fluid-background";
import { IntroLoader } from "@/components/intro-loader";
import { TweaksPanel } from "@/components/tweaks-panel";

const hostGrotesk = Host_Grotesk({
  variable: "--font-host",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HYP3, The 2026 NCAA Tournament Hype Gap",
  description:
    "Measuring the gap between internet hype and tournament performance for the 2026 NCAA Men's Basketball Tournament.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${hostGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans font-medium">
        <FluidBackground />
        <IntroLoader />
        <div className="relative z-[1] flex min-h-full flex-1 flex-col">
          {children}
        </div>
        <FloatingSearch />
        {process.env.NODE_ENV === "development" && <TweaksPanel />}
      </body>
    </html>
  );
}
