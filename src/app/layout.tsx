import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gota REAL — Água Purificada com Entrega",
  description:
    "Peça água purificada Gota REAL em bidões de 5L e outros formatos, com entrega ao domicílio. Pague por TPA ou dinheiro e acompanhe o motoboy por GPS em tempo real.",
  keywords: [
    "Gota REAL",
    "água purificada",
    "entrega de água",
    "bidão 5 litros",
    "Luanda",
    "Angola",
  ],
  authors: [{ name: "Gota REAL" }],
  icons: {
    icon: "/gota-real-logo-square.png",
    apple: "/gota-real-logo-square.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0A3D7C",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
