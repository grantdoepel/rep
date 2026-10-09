import type { Metadata, Viewport } from "next";
import { Outfit, DM_Sans } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ServiceWorker } from "@/components/ServiceWorker";
import { Toast } from "@/components/Toast";

const outfit = Outfit({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-outfit" });
const dm = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-dm" });

export const metadata: Metadata = {
  title: "uvu",
  description: "You vs. you. Five minutes a day, a streak worth protecting, friends who notice.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "uvu" },
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0C0D11",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${dm.variable}`}>
      <body>
        <StoreProvider>{children}<Toast /></StoreProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
