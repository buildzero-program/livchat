import Link from "next/link";
import { Github, Twitter, MessageCircle } from "lucide-react";

import { APP_NAME, SOCIAL_LINKS } from "~/lib/constants";

const footerLinks = {
  product: {
    title: "Produto",
    links: [
      { label: "Recursos", href: "#features" },
      { label: "Preços", href: "#pricing" },
      { label: "Documentação", href: "https://docs.livchat.ai" },
      { label: "API Reference", href: "https://docs.livchat.ai/api-reference/overview" },
    ],
  },
  company: {
    title: "Empresa",
    links: [
      { label: "Sobre", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Contato", href: "/contact" },
    ],
  },
  legal: {
    title: "Legal",
    links: [
      { label: "Termos de Uso", href: "/terms" },
      { label: "Privacidade", href: "/privacy" },
      { label: "LGPD", href: "/lgpd" },
    ],
  },
};

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-xl font-bold text-primary">
              {APP_NAME}
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              WhatsApp API para desenvolvedores, martech e AI agents.
            </p>

            {/* Social Links */}
            <div className="mt-6 flex gap-4">
              <a
                href={SOCIAL_LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href={SOCIAL_LINKS.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href={SOCIAL_LINKS.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Discord"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-foreground">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} {APP_NAME}. Todos os direitos
            reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
