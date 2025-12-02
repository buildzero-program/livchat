"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check } from "lucide-react";

import { MOCK_CODE_EXAMPLES, MOCK_TECH_BADGES } from "~/lib/mock-data";
import { CODE_LANGUAGES, type CodeLanguage } from "~/lib/constants";

export function Integration() {
  const [lang, setLang] = useState<CodeLanguage>(CODE_LANGUAGES.NODE);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const code = MOCK_CODE_EXAMPLES[lang]?.code ?? "";
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-24 px-6 bg-background relative">
      {/* Grid pattern background */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-sm font-medium text-primary uppercase tracking-wider">
            INTEGRAÇÃO
          </span>
          <h2 className="mt-4 text-3xl md:text-4xl font-bold">
            Integre em{" "}
            <span className="bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">
              minutos
            </span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            REST API simples. SDKs para as principais linguagens. Copie, cole e
            funciona.
          </p>
        </div>

        {/* Code Block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto bg-card rounded-xl border border-border overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex gap-2">
              {Object.entries(CODE_LANGUAGES).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setLang(value)}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    lang === value
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {key.charAt(0) + key.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-white/10 rounded transition-colors"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* Code */}
          <div className="p-6 overflow-x-auto">
            <pre className="font-mono text-sm text-muted-foreground">
              <code>{MOCK_CODE_EXAMPLES[lang]?.code}</code>
            </pre>
          </div>
        </motion.div>

        {/* Tech Badges */}
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          {MOCK_TECH_BADGES.map((tech) => (
            <span
              key={tech}
              className="px-4 py-2 bg-card border border-border rounded-full text-sm text-muted-foreground"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
