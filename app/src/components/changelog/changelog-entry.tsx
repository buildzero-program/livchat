"use client";

import { Badge } from "~/components/ui/badge";
import { type ChangelogEntry as ChangelogEntryType } from "~/lib/changelog-data";

// DEBUG MODE - set to true to visualize containers
const DEBUG = false;

interface ChangelogEntryProps {
  entry: ChangelogEntryType;
}

export function ChangelogEntry({ entry }: ChangelogEntryProps) {
  return (
    <article
      id={entry.id}
      className={`scroll-mt-24 ${DEBUG ? "border-2 border-red-500" : ""}`}
    >
      {/*
        Layout: Flex container com 3 "colunas"
        - Left: sticky label (flex-none, w-[180px])
        - Center: content (flex-1)
        - Right: spacer (flex-none, w-[180px])

        O STICKY está diretamente no flex item, não aninhado!
      */}
      <div
        className={`flex flex-col md:flex-row md:items-start gap-6 md:gap-8 ${DEBUG ? "border-2 border-blue-500" : ""}`}
      >
        {/*
          LEFT COLUMN - Sticky Label
          - sticky + self-start no MESMO elemento
          - É um flex item direto (não aninhado)
          - h-fit garante que não estica
        */}
        <div
          className={`
            flex-none w-full md:w-[180px]
            md:sticky md:top-24
            md:self-start
            md:h-fit
            flex flex-row md:flex-col items-start gap-2
            ${DEBUG ? "border-2 border-green-500 bg-green-500/10" : ""}
          `}
        >
          <Badge
            variant="secondary"
            className="px-3 py-1 text-sm font-mono font-medium bg-primary/10 text-primary border border-primary/20 rounded-md"
          >
            {entry.version}
          </Badge>
          <span className="text-sm text-muted-foreground">{entry.date}</span>
        </div>

        {/* CENTER COLUMN - Content (SEM padding - padding fica FORA do flex) */}
        <div
          className={`flex-1 min-w-0 ${DEBUG ? "border-2 border-yellow-500" : ""}`}
        >
          {/* Title */}
          <h2 className="text-2xl md:text-3xl font-bold mb-4">{entry.title}</h2>

          {/* Description */}
          <p className="text-lg text-muted-foreground mb-8">
            {entry.description}
          </p>

          {/* Features Grid */}
          {entry.features && entry.features.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {entry.features.map((feature, i) => (
                <div
                  key={i}
                  className="p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Highlights */}
          {entry.highlights && entry.highlights.length > 0 && (
            <ul className="space-y-2 mb-8">
              {entry.highlights.map((highlight, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-muted-foreground"
                >
                  <span className="text-primary text-lg leading-none">•</span>
                  <span className="leading-relaxed">{highlight}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Code Example */}
          {entry.codeExample && (
            <pre className="p-4 rounded-lg bg-[#0d0d0d] border border-border overflow-x-auto">
              <code className="text-sm text-muted-foreground font-mono">
                {entry.codeExample.code}
              </code>
            </pre>
          )}
        </div>

        {/* RIGHT COLUMN - Spacer for symmetry */}
        <div className="hidden md:block flex-none w-[180px]" />
      </div>

      {/* Espaçamento entre seções - FORA do flex para não afetar o sticky */}
      <div className="h-16 md:h-24" />
    </article>
  );
}
