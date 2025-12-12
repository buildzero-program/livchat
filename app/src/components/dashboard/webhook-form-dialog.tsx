"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Wand2,
  Eye,
  EyeOff,
  Loader2,
  Server,
  Zap,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import type { WebhookData, Instance } from "./webhook-card";

// ============================================
// TYPES
// ============================================

export interface WebhookFormData {
  url: string;
  signingSecret: string;
  headers: { key: string; value: string }[];
  instanceIds: string[] | null;
  subscriptions: string[] | null;
}

interface WebhookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook?: WebhookData | null;
  instances: Instance[];
  onSubmit: (data: WebhookFormData) => void;
  isSubmitting?: boolean;
}

// ============================================
// EVENT TYPES
// ============================================

const EVENT_TYPES = [
  { id: "message.received", label: "Mensagem recebida" },
  { id: "message.sent", label: "Mensagem enviada" },
  { id: "message.status", label: "Status de mensagem" },
  { id: "chat.presence", label: "Presença no chat" },
  { id: "history.sync", label: "Sincronização de histórico" },
] as const;

// ============================================
// HELPERS
// ============================================

function generateSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// ============================================
// MULTI SELECT POPOVER
// ============================================

interface MultiSelectOption {
  id: string;
  label: string;
}

function MultiSelectPopover({
  icon: Icon,
  label,
  placeholder,
  options,
  selectedIds,
  onSelectionChange,
}: {
  icon: React.ElementType;
  label: string;
  placeholder: string;
  options: MultiSelectOption[];
  selectedIds: string[] | null; // null = all selected
  onSelectionChange: (ids: string[] | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const allSelected = selectedIds === null;

  const getDisplayText = () => {
    if (allSelected) return placeholder;
    if (selectedIds.length === 0) return "Nenhum selecionado";
    if (selectedIds.length === 1) {
      const option = options.find((o) => o.id === selectedIds[0]);
      return option?.label ?? "1 selecionado";
    }
    return `${selectedIds.length} selecionados`;
  };

  const handleToggleAll = () => {
    if (allSelected) {
      // Desmarcar todas
      onSelectionChange([]);
    } else {
      // Marcar todas
      onSelectionChange(null);
    }
  };

  const handleToggleOption = (optionId: string) => {
    if (allSelected) {
      // Estava "todas", agora seleciona só essa
      onSelectionChange([optionId]);
    } else {
      const isSelected = selectedIds.includes(optionId);
      if (isSelected) {
        // Remover
        const newList = selectedIds.filter((id) => id !== optionId);
        onSelectionChange(newList.length === 0 ? [] : newList);
      } else {
        // Adicionar
        const newList = [...selectedIds, optionId];
        // Se selecionou todas individualmente, marca como "todas"
        if (newList.length === options.length) {
          onSelectionChange(null);
        } else {
          onSelectionChange(newList);
        }
      }
    }
  };

  const isOptionSelected = (optionId: string) => {
    return allSelected || (selectedIds?.includes(optionId) ?? false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between h-11 px-4 font-normal"
        >
          <span className="flex items-center gap-3">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{label}</span>
            <span className="text-sm text-muted-foreground">
              {getDisplayText()}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <ScrollArea className="max-h-64">
          <div className="p-2">
            {/* All option */}
            <button
              type="button"
              onClick={handleToggleAll}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md hover:bg-muted transition-colors text-left"
            >
              <div
                className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                  allSelected
                    ? "bg-primary border-primary"
                    : "border-input"
                }`}
              >
                <AnimatePresence>
                  {allSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <span className="text-sm font-medium">{placeholder}</span>
            </button>

            {/* Separator */}
            <div className="h-px bg-border my-1 mx-3" />

            {/* Individual options */}
            {options.map((option) => {
              const isSelected = isOptionSelected(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleToggleOption(option.id)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md hover:bg-muted transition-colors text-left"
                >
                  <div
                    className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-primary border-primary"
                        : "border-input"
                    }`}
                  >
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className="text-sm">{option.label}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function WebhookFormDialog({
  open,
  onOpenChange,
  webhook,
  instances,
  onSubmit,
  isSubmitting,
}: WebhookFormDialogProps) {
  const isEditing = !!webhook;

  // Form state
  const [url, setUrl] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
  const [selectedInstances, setSelectedInstances] = useState<string[] | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<string[] | null>(null);

  // Section visibility
  const [showSecretSection, setShowSecretSection] = useState(false);
  const [showHeadersSection, setShowHeadersSection] = useState(false);

  const [urlError, setUrlError] = useState("");

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (webhook) {
        setUrl(webhook.url);
        setSigningSecret(webhook.signingSecret ?? "");
        setHeaders(
          webhook.headers
            ? Object.entries(webhook.headers).map(([key, value]) => ({
                key,
                value,
              }))
            : []
        );
        setSelectedInstances(webhook.instanceIds);
        setSelectedEvents(webhook.subscriptions);
        setShowSecretSection(!!webhook.signingSecret);
        setShowHeadersSection(!!webhook.headers && Object.keys(webhook.headers).length > 0);
      } else {
        setUrl("");
        setSigningSecret("");
        setHeaders([]);
        setSelectedInstances(null);
        setSelectedEvents(null);
        setShowSecretSection(false);
        setShowHeadersSection(false);
      }
      setUrlError("");
      setShowSecret(false);
    }
  }, [open, webhook]);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (value && !isValidHttpsUrl(value)) {
      setUrlError("A URL deve usar HTTPS");
    } else {
      setUrlError("");
    }
  };

  const handleAddHeader = () => {
    setHeaders([...headers, { key: "", value: "" }]);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const handleHeaderChange = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    const newHeaders = [...headers];
    newHeaders[index] = { ...newHeaders[index]!, [field]: value };
    setHeaders(newHeaders);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url || !isValidHttpsUrl(url)) {
      setUrlError("URL HTTPS válida é obrigatória");
      return;
    }

    if (signingSecret && signingSecret.length < 32) {
      return;
    }

    onSubmit({
      url,
      signingSecret: showSecretSection ? signingSecret : "",
      headers: showHeadersSection ? headers.filter((h) => h.key.trim()) : [],
      instanceIds: selectedInstances,
      subscriptions: selectedEvents,
    });
  };

  const canSubmit =
    url &&
    isValidHttpsUrl(url) &&
    (!showSecretSection || !signingSecret || signingSecret.length >= 32);

  // Convert instances to options format
  const instanceOptions: MultiSelectOption[] = instances.map((i) => ({
    id: i.id,
    label: i.name,
  }));

  const eventOptions: MultiSelectOption[] = EVENT_TYPES.map((e) => ({
    id: e.id,
    label: e.label,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-8 pt-8 pb-6">
          <DialogTitle className="text-xl">
            {isEditing ? "Editar Webhook" : "Adicionar Webhook"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-8 pb-8 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* URL Field */}
            <div className="space-y-3">
              <Label htmlFor="url" className="text-sm font-medium">
                Endpoint URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="url"
                type="url"
                placeholder="https://..."
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                className={`h-11 ${urlError ? "border-destructive" : ""}`}
              />
              {urlError ? (
                <p className="text-xs text-destructive">{urlError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  A URL deve usar HTTPS
                </p>
              )}
            </div>

            {/* Signing Secret Section */}
            <Collapsible open={showSecretSection} onOpenChange={setShowSecretSection}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-between h-11 px-4 text-sm font-normal hover:bg-muted/50"
                >
                  <span className="flex items-center gap-3">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    Signing Secret
                  </span>
                  {showSecretSection ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="pt-3"
                >
                  <div className="space-y-3 pl-5 border-l-2 ml-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showSecret ? "text" : "password"}
                          placeholder="Mínimo 32 caracteres"
                          value={signingSecret}
                          onChange={(e) => setSigningSecret(e.target.value)}
                          className="pr-10 h-11"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowSecret(!showSecret)}
                        >
                          {showSecret ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11"
                        onClick={() => setSigningSecret(generateSecret())}
                        title="Gerar secret aleatório"
                      >
                        <Wand2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {signingSecret && signingSecret.length < 32 && (
                      <p className="text-xs text-destructive">
                        Mínimo 32 caracteres ({signingSecret.length}/32)
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Usado para validar autenticidade via HMAC-SHA256
                    </p>
                  </div>
                </motion.div>
              </CollapsibleContent>
            </Collapsible>

            {/* HTTP Headers Section */}
            <Collapsible open={showHeadersSection} onOpenChange={setShowHeadersSection}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-between h-11 px-4 text-sm font-normal hover:bg-muted/50"
                >
                  <span className="flex items-center gap-3">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    HTTP Headers
                  </span>
                  {showHeadersSection ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="pt-3"
                >
                  <div className="space-y-3 pl-5 border-l-2 ml-2">
                    {headers.map((header, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="X-Custom-Header"
                          value={header.key}
                          onChange={(e) =>
                            handleHeaderChange(index, "key", e.target.value)
                          }
                          className="flex-1 h-11"
                        />
                        <Input
                          placeholder="valor"
                          value={header.value}
                          onChange={(e) =>
                            handleHeaderChange(index, "value", e.target.value)
                          }
                          className="flex-1 h-11"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-11 w-11 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveHeader(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full h-10"
                      onClick={handleAddHeader}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Adicionar header
                    </Button>
                  </div>
                </motion.div>
              </CollapsibleContent>
            </Collapsible>

            {/* Divider */}
            <div className="h-px bg-border" />

            {/* Instances Multi-Select */}
            <MultiSelectPopover
              icon={Server}
              label="Instâncias"
              placeholder="Todas"
              options={instanceOptions}
              selectedIds={selectedInstances}
              onSelectionChange={setSelectedInstances}
            />

            {/* Events Multi-Select */}
            <MultiSelectPopover
              icon={Zap}
              label="Eventos"
              placeholder="Todos"
              options={eventOptions}
              selectedIds={selectedEvents}
              onSelectionChange={setSelectedEvents}
            />
          </div>

          <DialogFooter className="px-8 py-6 border-t bg-muted/30">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-11 px-6"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="h-11 px-6"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              {isEditing ? "Salvar" : "Conectar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
