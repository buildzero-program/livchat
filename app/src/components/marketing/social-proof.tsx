"use client";

import { MOCK_COMPANIES } from "~/lib/mock-data";

export function SocialProof() {
  // Duplicate for seamless marquee
  const companies = [...MOCK_COMPANIES, ...MOCK_COMPANIES];

  return (
    <section className="py-12 bg-[#111111] border-y border-border overflow-hidden">
      <div className="relative">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#111111] to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#111111] to-transparent z-10" />

        {/* Marquee */}
        <div className="flex animate-marquee">
          {companies.map((company, index) => (
            <div
              key={index}
              className="flex-shrink-0 px-8 text-2xl font-bold text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-default"
            >
              {company.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
