import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";

// Inter for English and numbers; Hindi letters fall through to Noto Sans Devanagari (see --font-sans in globals.css).
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const deva = Noto_Sans_Devanagari({ variable: "--font-deva", subsets: ["devanagari"], display: "swap" });

export const metadata: Metadata = {
  title: "Saksham Multitrade",
  description: "Advance-purchase installment schemes",
};

export const viewport: Viewport = { themeColor: "#ecedef" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={await getLocale()} className={`${inter.variable} ${deva.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-canvas text-[17px] leading-relaxed">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
