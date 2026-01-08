"use client";

import Link from "next/link";
import { Instagram, Linkedin } from "lucide-react";

import { APP_NAME } from "~/lib/constants";

const SOCIAL_LINKS = [
  { icon: Instagram, href: "https://instagram.com/livchat.ai", label: "Instagram" },
  { icon: Linkedin, href: "https://linkedin.com/company/livchat-ai", label: "LinkedIn" },
];

export function FooterB2B() {
  return (
    <footer className="relative bg-[#050508] border-t border-white/[0.06]">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-4">
            <Link href="/" className="inline-block">
              <span className="font-[family-name:var(--font-display)] text-lg font-bold text-white">
                {APP_NAME}
              </span>
            </Link>
            <span className="hidden md:block text-white/20">|</span>
            <p className="font-[family-name:var(--font-body)] text-sm text-white/40">
              API de WhatsApp + Agentes AI
            </p>
          </div>

          {/* Links + Social */}
          <div className="flex items-center gap-6">
            {/* Essential Links */}
            <div className="flex items-center gap-4">
              <Link
                href="mailto:team@livchat.ai"
                className="font-[family-name:var(--font-body)] text-sm text-white/40 hover:text-white transition-colors"
              >
                Contato
              </Link>
              <Link
                href="/privacidade"
                className="font-[family-name:var(--font-body)] text-sm text-white/40 hover:text-white transition-colors"
              >
                Privacidade
              </Link>
            </div>

            {/* Divider */}
            <span className="text-white/20">|</span>

            {/* Social */}
            <div className="flex gap-2">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10 transition-all"
                  aria-label={social.label}
                >
                  <social.icon className="h-3.5 w-3.5 text-white/50" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-6 pt-6 border-t border-white/[0.04] text-center">
          <p className="font-[family-name:var(--font-body)] text-xs text-white/25">
            © 2026 LivChat.ai. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
