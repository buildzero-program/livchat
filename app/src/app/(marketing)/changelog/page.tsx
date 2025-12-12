"use client";

import { ChangelogEntry } from "~/components/changelog/changelog-entry";
import { CHANGELOG_ENTRIES } from "~/lib/changelog-data";

export default function ChangelogPage() {
  return (
    <section className="min-h-screen pt-32 pb-24 px-6">
      <div className="mx-auto max-w-5xl">
        {/* Header - same flex structure as entries for alignment */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 mb-16">
          {/* Left spacer */}
          <div className="hidden md:block flex-none w-[180px]" />

          {/* Center - header content */}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-primary uppercase tracking-wider">
              Changelog
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-4">
              Novidades e atualizações
            </h1>
            <p className="text-lg text-muted-foreground">
              Acompanhe todas as novidades, melhorias e correções do LivChat.ai.
            </p>
          </div>

          {/* Right spacer */}
          <div className="hidden md:block flex-none w-[180px]" />
        </div>

        {/* Entries */}
        <div className="space-y-0">
          {CHANGELOG_ENTRIES.map((entry) => (
            <ChangelogEntry key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
    </section>
  );
}
