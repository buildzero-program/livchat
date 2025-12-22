"use client";

import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import termsContent from "./terms-content.md?raw";

export default function TermsPage() {
  // Desabilita seleção de texto e context menu (proteção contra cópia)
  useEffect(() => {
    const preventSelection = (e: Event) => e.preventDefault();
    const preventContextMenu = (e: MouseEvent) => e.preventDefault();

    document.addEventListener("selectstart", preventSelection);
    document.addEventListener("contextmenu", preventContextMenu);

    return () => {
      document.removeEventListener("selectstart", preventSelection);
      document.removeEventListener("contextmenu", preventContextMenu);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground select-none">
      {/* Container principal */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Conteúdo dos termos */}
        <article className="prose prose-sm max-w-none font-serif sm:prose-base dark:prose-invert">
          <ReactMarkdown
            components={{
              // Header do documento (primeiro h1)
              h1: ({ children }) => (
                <div className="mb-8 border-b-2 border-border pb-6 text-center sm:mb-12">
                  <h1 className="mb-2 font-serif text-xl font-bold uppercase tracking-wide sm:text-2xl">
                    {children}
                  </h1>
                  <p className="mb-1 text-base font-semibold text-foreground sm:text-lg">
                    LivChat.ai
                  </p>
                  <p className="text-xs text-muted-foreground italic sm:text-sm">
                    Última atualização: Dezembro de 2024
                  </p>
                </div>
              ),
              // Seções principais
              h2: ({ children }) => (
                <h2 className="mt-8 mb-4 border-b border-border pb-2 font-serif text-base font-bold uppercase tracking-wide sm:text-lg">
                  {children}
                </h2>
              ),
              // Subseções
              h3: ({ children }) => (
                <h3 className="mt-6 mb-3 font-serif text-sm font-bold sm:text-base">
                  {children}
                </h3>
              ),
              // Parágrafos
              p: ({ children }) => (
                <p className="mb-4 text-justify font-serif text-sm leading-relaxed sm:text-base">
                  {children}
                </p>
              ),
              // Listas
              ul: ({ children }) => (
                <ul className="my-4 ml-6 list-disc space-y-1 font-serif text-sm sm:text-base">
                  {children}
                </ul>
              ),
              // Itens de lista
              li: ({ children }) => (
                <li className="text-sm sm:text-base">{children}</li>
              ),
              // Negrito
              strong: ({ children }) => (
                <strong className="font-bold">{children}</strong>
              ),
              // Itálico
              em: ({ children }) => <em className="italic">{children}</em>,
              // Links
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-primary underline hover:text-primary/80"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
              // Tabelas
              table: ({ children }) => (
                <div className="my-4 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-muted">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="border border-border p-2 text-left font-bold">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-border p-2">{children}</td>
              ),
              // Linha horizontal - ocultar para evitar linhas duplas
              hr: () => null,
              // Blocos de citação (para avisos importantes)
              blockquote: ({ children }) => (
                <blockquote className="my-4 border-l-4 border-primary bg-muted/50 p-4 italic">
                  {children}
                </blockquote>
              ),
            }}
          >
            {termsContent}
          </ReactMarkdown>
        </article>

        {/* Rodapé do documento - centralizado como na referência BuildZero */}
        <div className="mt-12 border-t-2 border-border pt-6 text-center">
          <p className="text-xs text-muted-foreground sm:text-sm">
            São Paulo/SP, dezembro de 2024.
          </p>
          <p className="mt-3 text-xs font-semibold text-muted-foreground sm:text-sm">
            © 2024-2025 LivChat.ai — LIVCHAT AI TECNOLOGIA LTDA
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            CNPJ: 54.363.876/0001-21
          </p>
        </div>
      </main>
    </div>
  );
}
