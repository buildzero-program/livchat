"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

import { NavbarB2B } from "~/components/b2b/navbar-b2b";
import { FooterB2B } from "~/components/b2b/footer-b2b";

export default function B2BLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setTheme, theme } = useTheme();

  // Forca dark mode na landing page B2B
  useEffect(() => {
    if (theme !== "dark") {
      setTheme("dark");
    }
  }, [setTheme, theme]);

  return (
    <div className="flex min-h-screen flex-col bg-[#050508]">
      <NavbarB2B />
      <main className="flex-1">{children}</main>
      <FooterB2B />
    </div>
  );
}
