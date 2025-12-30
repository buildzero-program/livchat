"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Copy, Loader2, LogOut } from "lucide-react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { formatPhone, isValidPhoneFormat } from "~/lib/phone";
import { getApiBaseUrl } from "~/lib/api-url";
import type { ValidationResult } from "~/server/api/routers/whatsapp";

import { TypeSelector, type MessageType } from "./type-selector";
import { RecipientInput } from "./recipient-input";
import { TextForm } from "./forms/text-form";
import { ImageForm } from "./forms/image-form";
import { CodePreview } from "./code-preview";
import { ResponseDisplay } from "./response-display";

// ============================================================================
// Types
// ============================================================================

interface SendResponse {
  success: boolean;
  messageId: string;
  timestamp: number;
}

interface TestPanelV2Props {
  // Connection
  jid?: string;
  apiKey?: string;

  // Quota
  messagesUsed?: number;
  messagesLimit?: number;

  // Actions
  onDisconnect: () => void;
  onSendMessage: (phone: string, message: string) => Promise<SendResponse>;
  onSendImage?: (phone: string, imageBase64: string, caption?: string) => Promise<SendResponse>;
  onValidatePhone: (phone: string) => Promise<ValidationResult>;

  // Loading states
  isSending?: boolean;
  isDisconnecting?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function maskToken(token: string): string {
  if (!token || token.length < 20) return token;
  const prefixMatch = token.match(/^(lc_\w+_)/);
  const prefix = prefixMatch?.[1] ?? "";
  const withoutPrefix = token.slice(prefix.length);
  if (withoutPrefix.length < 8) return prefix + "*".repeat(withoutPrefix.length);
  const first4 = withoutPrefix.slice(0, 4);
  const last4 = withoutPrefix.slice(-4);
  const maskedLength = Math.max(0, withoutPrefix.length - 8);
  return prefix + first4 + "*".repeat(maskedLength) + last4;
}


// ============================================================================
// Sub Components
// ============================================================================

function QuotaBar({ used, limit }: { used: number; limit: number }) {
  const percentage = Math.min((used / limit) * 100, 100);
  const isLow = percentage > 80;

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-muted/50 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", isLow ? "bg-yellow-500" : "bg-primary")}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={cn("text-xs tabular-nums", isLow ? "text-yellow-500" : "text-muted-foreground")}>
        {used}/{limit}
      </span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TestPanelV2({
  jid,
  apiKey,
  messagesUsed = 0,
  messagesLimit = 50,
  onDisconnect,
  onSendMessage,
  onSendImage,
  onValidatePhone,
  isSending = false,
  isDisconnecting = false,
}: TestPanelV2Props) {
  // Message type
  const [messageType, setMessageType] = useState<MessageType>("text");

  // Form fields
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Olá! Teste de integração LivChat");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  // Validation
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const debouncedPhone = useDebounce(phone, 500);

  // Response
  const [response, setResponse] = useState<SendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // UI
  const [isTokenRevealed, setIsTokenRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Refs
  const onValidatePhoneRef = useRef(onValidatePhone);
  useEffect(() => {
    onValidatePhoneRef.current = onValidatePhone;
  }, [onValidatePhone]);

  // Clear state on disconnect
  useEffect(() => {
    if (isDisconnecting) {
      setResponse(null);
      setError(null);
      setValidationResult(null);
    }
  }, [isDisconnecting]);

  // Phone validation
  useEffect(() => {
    const validate = async () => {
      const cleaned = debouncedPhone.replace(/\D/g, "");
      if (!isValidPhoneFormat(debouncedPhone)) {
        setValidationResult(null);
        return;
      }

      setIsValidating(true);
      try {
        const result = await onValidatePhoneRef.current(cleaned);
        setValidationResult(result);
      } catch {
        setValidationResult(null);
      } finally {
        setIsValidating(false);
      }
    };

    void validate();
  }, [debouncedPhone]);

  // Derived state
  const cleanedPhone = phone.replace(/\D/g, "");
  const apiBaseUrl = getApiBaseUrl();

  const validationStatus = (() => {
    if (validationResult?.status === "valid_unique") return "valid" as const;
    if (validationResult?.status === "valid_variant") return "variant" as const;
    if (validationResult?.status === "invalid") return "invalid" as const;
    return "idle" as const;
  })();

  const canSend = (() => {
    if (!isValidPhoneFormat(phone) || isSending) return false;
    if (validationResult?.status === "invalid") return false;
    if (messageType === "text") return message.trim().length > 0;
    if (messageType === "image") return imageFile !== null;
    return false;
  })();

  // Handlers
  const handleSend = async () => {
    setError(null);
    setResponse(null);

    const targetPhone = validationResult?.normalizedNumber ?? cleanedPhone;

    try {
      if (messageType === "text") {
        const result = await onSendMessage(targetPhone, message);
        setResponse(result);
      } else if (messageType === "image" && imagePreview && onSendImage) {
        const result = await onSendImage(targetPhone, imagePreview, caption || undefined);
        setResponse(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar mensagem");
    }
  };

  const handleImageChange = (file: File | null, preview: string | null) => {
    setImageFile(file);
    setImagePreview(preview);
  };

  const handleCopyApiKey = () => {
    if (apiKey) {
      void navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-5xl"
    >
      <div className="bg-card rounded-2xl overflow-hidden shadow-lg border border-border">
        {/* Top Bar */}
        <div className="px-6 py-4 bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">{jid ? formatPhone(jid) : "Conectado"}</span>
          </div>
          <div className="flex items-center gap-4">
            <QuotaBar used={messagesUsed} limit={messagesLimit} />
            <Button size="sm">Criar Conta</Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row min-h-[400px]">
          {/* Left - Form */}
          <div className="lg:w-5/12 p-6 space-y-5">
            <TypeSelector value={messageType} onChange={setMessageType} />

            <RecipientInput
              value={phone}
              onChange={setPhone}
              validationStatus={validationStatus}
              validationResult={validationResult}
              isValidating={isValidating}
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={messageType}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                {messageType === "text" ? (
                  <TextForm message={message} onMessageChange={setMessage} />
                ) : (
                  <ImageForm
                    imageFile={imageFile}
                    imagePreview={imagePreview}
                    caption={caption}
                    onImageChange={handleImageChange}
                    onCaptionChange={setCaption}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            <Button onClick={handleSend} disabled={!canSend} className="w-full" size="lg">
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Teste
                </>
              )}
            </Button>
          </div>

          {/* Right - Code & Response */}
          <div className="lg:w-7/12 p-6 pt-0 lg:pt-6 lg:pl-0 flex flex-col gap-4">
            <div className="flex-1 min-h-0">
              <CodePreview
                messageType={messageType}
                phone={phone}
                message={message}
                apiKey={apiKey ?? "seu_token_aqui"}
                jid={jid}
                isRevealed={isTokenRevealed}
                onToggleReveal={() => setIsTokenRevealed(!isTokenRevealed)}
                apiBaseUrl={apiBaseUrl}
              />
            </div>
            <ResponseDisplay response={response} error={error} isLoading={isSending} />
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="px-6 py-4 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-sm">
            <span className="text-muted-foreground">API Key:</span>
            <code className="text-foreground">
              {apiKey ? (isTokenRevealed ? apiKey : maskToken(apiKey)) : "---"}
            </code>
            {apiKey && (
              <button
                type="button"
                onClick={handleCopyApiKey}
                className="p-1 rounded hover:bg-muted transition-colors"
                title="Copiar"
              >
                <Copy className={cn("h-3.5 w-3.5", copied ? "text-green-500" : "text-muted-foreground")} />
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            disabled={isDisconnecting}
            className="text-muted-foreground"
          >
            {isDisconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <LogOut className="h-4 w-4 mr-1" />
            )}
            Desconectar
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
