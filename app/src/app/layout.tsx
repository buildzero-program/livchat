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
  icons: [{ rel: "icon", url: "/icon.svg", type: "image/svg+xml" }],
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
