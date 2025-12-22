"use client";

import * as React from "react";
import {
  User,
  Key,
  Palette,
  Sun,
  Moon,
  Monitor,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { useCopyToClipboard } from "~/hooks/use-copy-to-clipboard";
import { api } from "~/trpc/react";
import { useQueryClient } from "@tanstack/react-query";

// ============================================================================
// Types
// ============================================================================

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SectionId = "profile" | "api-key" | "appearance";

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// ============================================================================
// Constants
// ============================================================================

const NAV_ITEMS: NavItem[] = [
  { id: "profile", label: "Perfil", icon: User },
  { id: "api-key", label: "Chave de API", icon: Key },
  { id: "appearance", label: "Aparência", icon: Palette },
];

// ============================================================================
// Helpers
// ============================================================================

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0]!.charAt(0).toUpperCase();
  }
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ============================================================================
// Sub Components
// ============================================================================

interface SectionProps {
  id: SectionId;
  title: string;
  description?: string;
  children: React.ReactNode;
}

function Section({ id, title, description, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-base font-semibold mb-1">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { user } = useUser();
  const { theme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = React.useState<SectionId>("profile");
  const [regenerateDialogOpen, setRegenerateDialogOpen] = React.useState(false);
  const { copy, copied } = useCopyToClipboard();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // ============================================================================
  // ESTADOS DE CONTROLE
  // ============================================================================
  const [isRevealed, setIsRevealed] = React.useState(false);
  // Token retornado diretamente pelo regenerate (evita race condition)
  const [regeneratedToken, setRegeneratedToken] = React.useState<string | null>(null);

  // Fetch API keys from tRPC
  const {
    data: apiKeysData,
    isLoading: isLoadingKeys,
    isError: isErrorKeys,
    refetch: refetchKeys,
  } = api.apiKeys.list.useQuery(undefined, {
    enabled: open,
  });

  // Get the first active API key (simplified view)
  const apiKey = apiKeysData?.find((k) => k.isActive) ?? apiKeysData?.[0];

  // ============================================================================
  // REVEAL QUERY - só executa se NÃO temos regeneratedToken
  // (evita chamada desnecessária após regenerate)
  // ============================================================================
  const { data: revealData } = api.apiKeys.reveal.useQuery(
    { keyId: apiKey?.id ?? "" },
    {
      enabled: isRevealed && !!apiKey?.id && !regeneratedToken,
      staleTime: 0,
    }
  );

  // Regenerate mutation - usa token retornado diretamente
  const regenerateMutation = api.apiKeys.regenerate.useMutation({
    onSuccess: async (data) => {
      toast.success("Chave regenerada com sucesso!");
      // Guarda token para quando usuário revelar (evita race condition)
      // NÃO muda isRevealed - mantém estado do olho como estava
      setRegeneratedToken(data.token);
      // Invalida cache e refetch para atualizar maskedToken na lista
      await queryClient.invalidateQueries({ queryKey: [["apiKeys"]] });
      await refetchKeys();
    },
    onError: () => {
      toast.error("Erro ao regenerar chave");
    },
  });

  // Reset ao fechar dialog
  React.useEffect(() => {
    if (!open) {
      setIsRevealed(false);
      setRegeneratedToken(null);
      setRegenerateDialogOpen(false);
    }
  }, [open]);

  // Scroll-spy
  React.useEffect(() => {
    if (!open) return;

    const timeoutId = setTimeout(() => {
      const content = contentRef.current;
      if (!content) return;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const id = entry.target.id as SectionId;
              if (NAV_ITEMS.some(item => item.id === id)) {
                setActiveSection(id);
              }
            }
          }
        },
        {
          root: content,
          rootMargin: "-20% 0px -60% 0px",
          threshold: 0,
        }
      );

      NAV_ITEMS.forEach((item) => {
        const element = document.getElementById(item.id);
        if (element) observer.observe(element);
      });

      return () => observer.disconnect();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [open]);

  const scrollToSection = (sectionId: SectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(sectionId);
    }
  };

  // ============================================================================
  // LÓGICA DE DISPLAY: respeita isRevealed (estado do olho)
  // ============================================================================
  const displayToken = React.useMemo(() => {
    // Se olho fechado, sempre mostra masked (mesmo tendo regeneratedToken guardado)
    if (!isRevealed) {
      return apiKey?.maskedToken;
    }
    // Olho aberto: prioriza regeneratedToken > revealData > masked
    if (regeneratedToken) return regeneratedToken;
    if (revealData?.token) return revealData.token;
    return apiKey?.maskedToken;
  }, [isRevealed, regeneratedToken, revealData?.token, apiKey?.maskedToken]);

  const handleCopyKey = async () => {
    if (!displayToken) return;
    const success = await copy(displayToken);
    if (success) {
      toast.success("Chave copiada!");
    }
  };

  // Toggle - inverte estado do olho (isRevealed é a intenção do usuário)
  const handleRevealToggle = () => {
    if (isRevealed) {
      // Escondendo: limpa regeneratedToken para forçar nova reveal query na próxima vez
      setIsRevealed(false);
      setRegeneratedToken(null);
    } else {
      // Revelando
      setIsRevealed(true);
    }
  };

  const handleRegenerate = () => {
    if (!apiKey) return;
    regenerateMutation.mutate({ keyId: apiKey.id });
    setRegenerateDialogOpen(false);
  };

  const initials = getInitials(user?.fullName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:!max-w-[900px] w-[95vw] h-[600px] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Configurações</DialogTitle>

        <div className="flex h-[600px]">
          {/* Sidebar */}
          <div className="w-[220px] shrink-0 bg-muted/40 p-3 flex flex-col">
            {/* User header - compact */}
            <button
              type="button"
              onClick={() => scrollToSection("profile")}
              className={cn(
                "flex items-center gap-2.5 px-2 py-2 rounded-md text-left w-full transition-colors mb-3",
                activeSection === "profile"
                  ? "bg-sidebar-accent"
                  : "hover:bg-sidebar-accent/50"
              )}
            >
              <Avatar className="h-8 w-8 rounded-md">
                <AvatarImage src={user?.imageUrl} alt={user?.fullName ?? ""} />
                <AvatarFallback className="rounded-md bg-primary/10 text-primary text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium truncate flex-1">
                {user?.fullName ?? "Usuário"}
              </span>
            </button>

            {/* Navigation */}
            <nav className="space-y-0.5">
              {NAV_ITEMS.filter(item => item.id !== "profile").map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div ref={contentRef} className="flex-1 overflow-y-auto scrollbar-notion bg-background">
            <div className="flex justify-center">
              <div className="p-8 space-y-10 w-full max-w-[600px]">

              {/* Profile */}
              <Section id="profile" title="Perfil">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 rounded-lg">
                    <AvatarImage src={user?.imageUrl} alt={user?.fullName ?? ""} />
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium">{user?.fullName ?? "Carregando..."}</div>
                    <div className="text-sm text-muted-foreground">
                      {user?.primaryEmailAddress?.emailAddress}
                    </div>
                  </div>
                </div>
              </Section>

              {/* API Key */}
              <Section
                id="api-key"
                title="Chave de API"
                description="Use esta chave para autenticar chamadas à API do LivChat."
              >
                {/* Loading State */}
                {isLoadingKeys && (
                  <div className="space-y-3">
                    <Skeleton className="h-9 w-full rounded-md" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                )}

                {/* Error State */}
                {isErrorKeys && !isLoadingKeys && (
                  <div className="flex items-center gap-3 text-sm">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    <span className="text-muted-foreground">Erro ao carregar chave.</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void refetchKeys()}
                      className="h-auto py-1 px-2"
                    >
                      Tentar novamente
                    </Button>
                  </div>
                )}

                {/* Empty State */}
                {!isLoadingKeys && !isErrorKeys && !apiKey && (
                  <div className="text-sm text-muted-foreground">
                    Conecte uma instância do WhatsApp para gerar uma chave de API automaticamente.
                  </div>
                )}

                {/* Key Display */}
                {!isLoadingKeys && !isErrorKeys && apiKey && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <code className="flex-1 text-sm font-mono bg-muted px-3 py-2 rounded-md">
                        {displayToken}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={handleRevealToggle}
                        title={isRevealed ? "Esconder" : "Revelar"}
                      >
                        {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={handleCopyKey}
                        title="Copiar"
                      >
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <AlertDialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => setRegenerateDialogOpen(true)}
                          disabled={regenerateMutation.isPending}
                          title="Regenerar chave"
                        >
                          <RefreshCw className={cn("h-4 w-4", regenerateMutation.isPending && "animate-spin")} />
                        </Button>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Regenerar chave de API?</AlertDialogTitle>
                            <AlertDialogDescription>
                              A chave atual será invalidada imediatamente. Aplicações que usam essa chave deixarão de funcionar até que você atualize com a nova chave.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleRegenerate}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Regenerar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Criada em {formatDate(apiKey.createdAt)}
                      {apiKey.lastUsedAt && (
                        <> · Último uso em {formatDate(apiKey.lastUsedAt)}</>
                      )}
                    </p>
                  </div>
                )}
              </Section>

              {/* Appearance */}
              <Section
                id="appearance"
                title="Aparência"
                description="Personalize como o LivChat aparece."
              >
                <div className="flex gap-2">
                  {[
                    { value: "light", label: "Claro", icon: Sun },
                    { value: "dark", label: "Escuro", icon: Moon },
                    { value: "system", label: "Sistema", icon: Monitor },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTheme(value)}
                      className={cn(
                        "flex flex-col items-center gap-2 px-4 py-3 rounded-md transition-colors flex-1",
                        theme === value
                          ? "bg-primary/10 text-primary"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </Section>

              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
