"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useAuth, useSignUp } from "@clerk/nextjs";

import { Button } from "~/components/ui/button";
import { APP_NAME, NAV_LINKS } from "~/lib/constants";
import { AuthModal } from "~/components/auth/auth-modal";
import { UserMenu } from "~/components/auth/user-menu";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<"google" | "github" | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const { isSignedIn, isLoaded } = useAuth();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Redirect se já estiver logado e tentar abrir o modal
  useEffect(() => {
    if (isSignedIn && authModalOpen) {
      setAuthModalOpen(false);
      router.push("/app");
    }
  }, [isSignedIn, authModalOpen, router]);

  async function handleOAuth(provider: "oauth_github" | "oauth_google") {
    if (!signUpLoaded || !signUp) return;

    const providerKey = provider === "oauth_google" ? "google" : "github";
    setLoadingProvider(providerKey);
    setAuthError(null);

    try {
      const redirectUrl = `${window.location.origin}/sso-callback`;

      // Abre popup ANTES de chamar o Clerk
      const popup = window.open(
        "",
        "livchat_oauth",
        "width=480,height=640,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes"
      );

      // Se popup bloqueado, mostra erro amigável
      if (!popup) {
        setAuthError("Popup bloqueado. Habilite popups para este site e tente novamente.");
        setLoadingProvider(null);
        return;
      }

      // Usa signUp.authenticateWithPopup - funciona para novos E existentes
      // Clerk automaticamente faz sign-in se o usuário já existe
      await signUp.authenticateWithPopup({
        strategy: provider,
        redirectUrl,
        redirectUrlComplete: "/app",
        popup,
      });

      // Após autenticação bem-sucedida
      setAuthModalOpen(false);
      router.replace("/app");
    } catch (err) {
      console.error("OAuth error:", err);
      setAuthError("Erro ao autenticar. Tente novamente.");
    } finally {
      setLoadingProvider(null);
    }
  }

  const handleGoogleSignIn = () => handleOAuth("oauth_google");
  const handleGitHubSignIn = () => handleOAuth("oauth_github");

  // className seguro para hydration (SSR = cliente inicial)
  const navClassName = `fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
    isMounted ? "backdrop-blur-md" : ""
  } ${
    isScrolled
      ? "bg-background/80 border-b border-border"
      : "bg-background/40"
  }`;

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={navClassName}
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-primary">{APP_NAME}</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-4">
              {isLoaded && !isSignedIn && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAuthModalOpen(true)}
                  >
                    Entrar
                  </Button>
                  <Button size="sm" onClick={() => setAuthModalOpen(true)}>
                    Começar Grátis
                  </Button>
                </>
              )}

              {isLoaded && isSignedIn && (
                <>
                  <Link href="/app">
                    <Button variant="ghost" size="sm">
                      Dashboard
                    </Button>
                  </Link>
                  <UserMenu />
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-border py-4"
            >
              <div className="flex flex-col gap-4">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}

                <div className="flex flex-col gap-2 pt-4 border-t border-border">
                  {isLoaded && !isSignedIn && (
                    <>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          setAuthModalOpen(true);
                        }}
                      >
                        Entrar
                      </Button>
                      <Button
                        className="w-full"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          setAuthModalOpen(true);
                        }}
                      >
                        Começar Grátis
                      </Button>
                    </>
                  )}

                  {isLoaded && isSignedIn && (
                    <Link href="/app">
                      <Button variant="ghost" className="w-full justify-start">
                        Dashboard
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.nav>

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={(open) => {
          setAuthModalOpen(open);
          if (!open) setAuthError(null);
        }}
        onGoogleClick={handleGoogleSignIn}
        onGitHubClick={handleGitHubSignIn}
        loadingGoogle={loadingProvider === "google"}
        loadingGitHub={loadingProvider === "github"}
        error={authError ?? undefined}
      />
    </>
  );
}
