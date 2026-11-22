import type { Metadata, Viewport } from "next";
import { Anek_Devanagari } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";

// One family for Hindi and English. Its width axis gives condensed numerals for tokens and amounts.
const anek = Anek_Devanagari({
  variable: "--font-sans",
  subsets: ["latin", "devanagari"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Saksham Multitrade",
  description: "Advance-purchase installment schemes",
};

export const viewport: Viewport = { themeColor: "#22306b" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={await getLocale()} className={`${anek.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col text-[17px] leading-relaxed">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
