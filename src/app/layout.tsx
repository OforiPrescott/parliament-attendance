import type { Metadata, Viewport } from "next";
import { Public_Sans, Source_Serif_4 } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const sans = Public_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "MP Attendance — Parliament of Ghana", template: "%s · MP Attendance" },
  description: "Attendance Management System for Members of Parliament",
  robots: { index: false, follow: false },
  icons: { icon: "/branding/favicon.png" },
};

export const viewport: Viewport = { themeColor: "#0B5337", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GH" className={`${sans.variable} ${serif.variable}`}>
      <body>
        {children}
        <Toaster position="top-right" richColors closeButton toastOptions={{ style: { fontFamily: "var(--font-sans)" } }} />
      </body>
    </html>
  );
}
