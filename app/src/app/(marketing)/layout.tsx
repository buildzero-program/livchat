"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

import { Navbar } from "~/components/common/navbar";
import { Footer } from "~/components/common/footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setTheme, theme } = useTheme();

  // Força dark mode na landing page
  useEffect(() => {
    if (theme !== "dark") {
      setTheme("dark");
    }
  }, [setTheme, theme]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
