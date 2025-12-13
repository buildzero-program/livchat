"use client";

import { Navbar } from "~/components/common/navbar";

/**
 * Layout específico para roadmap
 * - 100vh viewport height
 * - Sem footer
 * - Navbar fixa
 * - Scroll interno nas colunas
 */
export default function RoadmapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
