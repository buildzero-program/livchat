import "~/styles/globals.css";

import { type Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider } from "~/lib/theme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LivChat.ai - WhatsApp API para Desenvolvedores",
  description:
    "Envie fácil. Escale rápido. WhatsApp API para devs, martech e AI agents.",
  icons: [
    // Light mode (navegador claro) → ícone dark (vibrante) para contraste
    { rel: "icon", url: "/icon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
    // Dark mode (navegador escuro) → ícone light (pastel) para contraste
    { rel: "icon", url: "/icon-light.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
  ],
  openGraph: {
    title: "LivChat.ai - WhatsApp API para Desenvolvedores",
    description:
      "Envie fácil. Escale rápido. WhatsApp API para devs, martech e AI agents.",
    url: "https://livchat.ai",
    siteName: "LivChat.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LivChat.ai - WhatsApp API",
    description: "Envie fácil. Escale rápido.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html
        lang="pt-BR"
        className={`${inter.variable} ${jetbrainsMono.variable}`}
        suppressHydrationWarning
      >
        <body className="font-sans antialiased" suppressHydrationWarning>
          <ThemeProvider>
            <TRPCReactProvider>{children}</TRPCReactProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
