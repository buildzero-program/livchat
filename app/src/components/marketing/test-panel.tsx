"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Copy, Check, LogOut, Loader2, AlertCircle } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatPhone } from "~/lib/constants";
import { getApiBaseUrl, extractPhoneFromJid } from "~/lib/api-url";
import type { ValidationResult } from "~/server/api/routers/whatsapp";
import { QuotaIndicator } from "./quota-indicator";

interface SendResponse {
  success: boolean;
  messageId: string;
  timestamp: number;
}

interface TestPanelProps {
  onDisconnect: () => void;
  onSendMessage: (phone: string, message: string) => Promise<SendResponse>;
  onValidatePhone: (phone: string) => Promise<ValidationResult>;
  isSending?: boolean;
  isDisconnecting?: boolean;
  jid?: string;
  apiKey?: string;
  // Quota info
  messagesUsed?: number;
  messagesLimit?: number;
}

const TABS = ["MENSAGEM", "MÍDIA", "GRUPOS", "WEBHOOK"] as const;

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Valida formato do telefone
function isValidPhoneFormat(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 10 && cleaned.length <= 15;
}

export function TestPanel({
  onDisconnect,
  onSendMessage,
  onValidatePhone,
  isSending = false,
  isDisconnecting = false,
  jid,
  apiKey,
  messagesUsed = 0,
  messagesLimit = 50,
}: TestPanelProps) {
  const [activeTab, setActiveTab] = useState<string>("MENSAGEM");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Olá! Teste de integração LivChat");
  const [response, setResponse] = useState<SendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  // Validação do número destino
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const debouncedPhone = useDebounce(phone, 500);
  const cleanedPhone = phone.replace(/\D/g, "");

  // Ref para função estável (evita re-execução do useEffect)
  const onValidatePhoneRef = useRef(onValidatePhone);

  useEffect(() => {
    onValidatePhoneRef.current = onValidatePhone;
  }, [onValidatePhone]);

  // Limpa estado local quando inicia desconexão (evita flash de dados antigos)
  useEffect(() => {
    if (isDisconnecting) {
      setResponse(null);
      setError(null);
      setValidationResult(null);
    }
  }, [isDisconnecting]);

  // Valida número destino em background
  useEffect(() => {
    const validateDestination = async () => {
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

    void validateDestination();
  }, [debouncedPhone]); // Apenas debouncedPhone como dependência!

  const handleSend = async () => {
    setError(null);
    setResponse(null);

    // Usa número normalizado se disponível
    const targetPhone = validationResult?.normalizedNumber ?? cleanedPhone;

    try {
      const result = await onSendMessage(targetPhone, message);
      setResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar mensagem");
    }
  };

  // Gera exemplo de cURL com dados reais (token real para copy/paste funcional)
  const apiBaseUrl = getApiBaseUrl();
  const fromNumber = extractPhoneFromJid(jid);

  const curlExample = `curl -X POST ${apiBaseUrl}/v1/messages/send \\
  -H "Authorization: Bearer ${apiKey || "seu_token_aqui"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "${cleanedPhone || "5511999999999"}",
    "body": "${message.slice(0, 50)}${message.length > 50 ? "..." : ""}"${fromNumber ? `,
    "from": "${fromNumber}"` : ""}
  }'`;

  const handleCopy = () => {
    void navigator.clipboard.writeText(curlExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyApiKey = () => {
    if (apiKey) {
      void navigator.clipboard.writeText(apiKey);
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 2000);
    }
  };

  // Determina se pode enviar
  const canSend =
    isValidPhoneFormat(phone) &&
    message.trim().length > 0 &&
    !isSending &&
    validationResult?.status !== "invalid";

  // Renderiza indicador de validação
  const renderValidationIndicator = () => {
    if (isValidating) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    if (validationResult?.status === "valid_unique") {
      return <Check className="h-4 w-4 text-green-500" />;
    }
    if (validationResult?.status === "valid_variant") {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
    if (validationResult?.status === "invalid") {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-5xl"
    >
      {/* Success Banner */}
      <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-green-500/10 border-l-4 border-green-500 rounded-r-lg">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm text-green-400">
          Conectado! Agora teste sua primeira mensagem.
        </span>
        {jid && (
          <span className="text-xs text-muted-foreground ml-auto">
            {jid}
          </span>
        )}
      </div>

      {/* Main Panel */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Left Side - Form */}
          <div className="md:w-5/12 p-6 border-b md:border-b-0 md:border-r border-border">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-4 mb-6">
                {TABS.map((tab) => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="text-xs"
                    disabled={tab !== "MENSAGEM"}
                  >
                    {tab}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Para (WhatsApp)
                </label>
                <div className="relative">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+55 11 99999-9999"
                    className="pr-8"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {renderValidationIndicator()}
                  </div>
                </div>
                {validationResult?.status === "valid_unique" && validationResult.verifiedName && (
                  <p className="text-xs text-green-500 mt-1">
                    {validationResult.verifiedName}
                  </p>
                )}
                {validationResult?.status === "valid_variant" && (
                  <p className="text-xs text-yellow-500 mt-1">
                    Usando {validationResult.normalizedNumber}
                    {validationResult.verifiedName && ` (${validationResult.verifiedName})`}
                  </p>
                )}
                {validationResult?.status === "invalid" && (
                  <p className="text-xs text-red-500 mt-1">
                    Número não encontrado no WhatsApp
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Mensagem
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full h-32 px-3 py-2 bg-background border border-input rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Sua mensagem aqui..."
                />
              </div>

              {error && (
                <div className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded">
                  {error}
                </div>
              )}

              <Button
                onClick={handleSend}
                disabled={!canSend}
                className="w-full"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    ENVIAR TESTE
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Side - Response */}
          <div className="md:w-7/12 bg-[#0D0D0D] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex gap-2">
                <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">
                  cURL
                </span>
                <span className="text-xs px-2 py-1 text-muted-foreground">
                  Node
                </span>
                <span className="text-xs px-2 py-1 text-muted-foreground">
                  Python
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Code Display */}
            <div className="flex-1 p-4 overflow-auto font-mono text-xs">
              <pre className="text-muted-foreground whitespace-pre-wrap">
                {curlExample}
              </pre>

              {/* Response */}
              <AnimatePresence>
                {response && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-border"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                        200 OK
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Enviado!
                      </span>
                    </div>
                    <pre className="text-green-300/90">
                      {JSON.stringify(response, null, 2)}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="text-green-500">● Conectado</span>
                <span>TLS 1.3</span>
              </div>
              <span>v2.4.0-stable</span>
            </div>
          </div>
        </div>

        {/* Bottom Status */}
        <div className="px-6 py-4 bg-[#111111] border-t border-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm">
            {jid && <span>{formatPhone(jid)}</span>}
            {apiKey && (
              <button
                onClick={handleCopyApiKey}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors font-mono"
                title="Clique para copiar"
              >
                <span>key: {apiKey}</span>
                {apiKeyCopied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            )}
            <QuotaIndicator used={messagesUsed} limit={messagesLimit} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              Criar Conta
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDisconnect}
              disabled={isDisconnecting}
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
      </div>
    </motion.div>
  );
}
