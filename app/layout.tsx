import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Sage Studio", template: "%s | Sage Studio" },
  description: "Free tools for artists. Build your website, track your time, create your work.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://sagestudio.org"),
  // Set declaratively (rather than via the app/favicon.ico file convention) so
  // published sites with their own favicon_url can actually override this —
  // file-convention icons are always injected in addition to dynamic ones.
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
