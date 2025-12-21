"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Check,
  Smartphone,
  Link2,
  Copy,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

// ============================================
// TYPES
// ============================================

type DialogStep = "creating" | "connecting" | "success" | "error";

interface InstanceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (instanceData: InstanceData) => void;
  /** Se passado, reconecta instância existente em vez de criar nova */
  existingInstanceId?: string;
  /** Nome da instância existente (para exibição) */
  existingInstanceName?: string;
}

interface InstanceData {
  id: string;
  name: string;
  phoneNumber: string;
  whatsappName: string;
  pictureUrl: string | null;
}

// ============================================
// HELPERS
// ============================================

function isValidPhoneFormat(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 10 && cleaned.length <= 15;
}

function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

// generateMockShareCode removido - usando API real agora

// ============================================
// QR PANEL - Connected to real tRPC
// ============================================

interface QrPanelProps {
  instanceId: string;
  initialQrCode: string | null;
  onSuccess: (data: InstanceData) => void;
  onError: (error: string) => void;
}

function QrPanel({ instanceId, initialQrCode, onSuccess, onError }: QrPanelProps) {
  const [phoneInput, setPhoneInput] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  // Polling de status da instância específica
  const { data: statusData, error: statusError } = api.whatsapp.status.useQuery(
    { instanceId },
    {
      refetchInterval: pairingCode ? 2000 : 3000, // Mais rápido quando esperando pairing
      enabled: true,
    }
  );

  // Mutation para gerar pairing code
  const pairingMutation = api.whatsapp.pairing.useMutation({
    onSuccess: (data) => {
      setPairingCode(data.pairingCode);
    },
    onError: (error) => {
      onError(error.message);
    },
  });

  // Detectar quando conectou
  useEffect(() => {
    if (statusData?.loggedIn) {
      onSuccess({
        id: instanceId,
        name: "WhatsApp",
        phoneNumber: statusData.jid ?? "",
        whatsappName: statusData.deviceName ?? "WhatsApp User",
        pictureUrl: statusData.pictureUrl ?? null,
      });
    }
  }, [statusData?.loggedIn, statusData?.jid, statusData?.deviceName, statusData?.pictureUrl, instanceId, onSuccess]);

  // Handle error
  useEffect(() => {
    if (statusError) {
      onError(statusError.message);
    }
  }, [statusError, onError]);

  const handleConnectClick = () => {
    if (!isValidPhoneFormat(phoneInput)) return;
    pairingMutation.mutate({ phone: cleanPhoneNumber(phoneInput) });
  };

  const handleShareLink = async () => {
    setShareLoading(true);

    try {
      const response = await fetch("/api/connect/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId }),
      });

      if (!response.ok) {
        const data = await response.json();
        onError(data.error ?? "Erro ao gerar link");
        setShareLoading(false);
        return;
      }

      const data = await response.json();
      setShareLink(data.shareUrl);

      try {
        await navigator.clipboard.writeText(data.shareUrl);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 3000);
      } catch {
        // Fallback: just show the link
      }
    } catch {
      onError("Erro ao gerar link de compartilhamento");
    } finally {
      setShareLoading(false);
    }
  };

  // Use QR from polling status or initial
  const qrCode = statusData?.qrCode ?? initialQrCode;
  const isLoadingQr = !qrCode && !statusData;
  const isConnecting = pairingCode !== null || pairingMutation.isPending;

  return (
    <div className="space-y-6">
      {/* QR Code Area */}
      <div className="relative w-48 h-48 bg-white rounded-xl overflow-hidden mx-auto">
        {isLoadingQr ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : qrCode ? (
          <img
            src={qrCode}
            alt="QR Code WhatsApp"
            className="w-full h-full object-contain p-2"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <AlertCircle className="h-8 w-8" />
          </div>
        )}
      </div>

      {/* Status text */}
      <p className="text-sm text-muted-foreground text-center">
        Escaneie com seu WhatsApp
      </p>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Phone Input Section */}
      <div className="space-y-3">
        <label className="text-sm text-muted-foreground block">
          Conecte pelo número:
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="+55 11 99999-9999"
              className="pr-8"
              disabled={isConnecting}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {pairingMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {pairingCode && !pairingMutation.isPending && (
                <Check className="h-4 w-4 text-green-500" />
              )}
            </div>
          </div>
          <Button
            onClick={handleConnectClick}
            disabled={!isValidPhoneFormat(phoneInput) || pairingMutation.isPending || !!pairingCode}
          >
            {pairingMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Conectar"
            )}
          </Button>
        </div>

        {/* Pairing Code Display */}
        <AnimatePresence>
          {pairingCode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 bg-primary/10 border border-primary/20 rounded-lg"
            >
              <p className="text-xl font-mono font-bold text-center text-primary tracking-[0.3em]">
                {pairingCode}
              </p>
              <p className="text-xs text-muted-foreground text-center mt-2">
                WhatsApp → Dispositivos vinculados → Vincular com número
              </p>
              <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Aguardando conexão...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Share Link - Subtle at bottom */}
      <div className="pt-2 border-t">
        {!shareLink ? (
          <button
            onClick={handleShareLink}
            disabled={shareLoading}
            className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {shareLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            <span>{shareLoading ? "Gerando link..." : "Gerar link para conectar remotamente"}</span>
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 bg-transparent text-xs text-muted-foreground truncate outline-none"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={async () => {
                  await navigator.clipboard.writeText(shareLink);
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2000);
                }}
              >
                {shareCopied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {shareCopied ? "Link copiado!" : "Link válido por 24 horas"}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ============================================
// SUCCESS STEP
// ============================================

function SuccessStep({ data }: { data: InstanceData }) {
  const formatPhone = (phone: string) => {
    if (!phone || phone.length < 10) return phone;
    return `+${phone.slice(0, 2)} ${phone.slice(2, 4)} ${phone.slice(4, 9)}-${phone.slice(9)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="py-8 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4"
      >
        <Check className="h-8 w-8 text-green-500" />
      </motion.div>

      <h3 className="text-lg font-semibold mb-1">WhatsApp Conectado!</h3>

      <div className="text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">{data.whatsappName}</p>
        <p>{formatPhone(data.phoneNumber)}</p>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Você pode renomear esta instância a qualquer momento.
      </p>
    </motion.div>
  );
}

// ============================================
// ERROR STEP
// ============================================

function ErrorStep({
  message,
  onRetry,
  onClose,
  isLimitError
}: {
  message: string;
  onRetry: () => void;
  onClose: () => void;
  isLimitError: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="py-8 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
      </div>

      <h3 className="text-lg font-semibold mb-1">
        {isLimitError ? "Limite atingido" : "Erro ao conectar"}
      </h3>

      <p className="text-sm text-muted-foreground mb-6">{message}</p>

      <div className="flex gap-2 justify-center">
        {isLimitError ? (
          <Button onClick={onClose} variant="outline">
            Entendi
          </Button>
        ) : (
          <Button onClick={onRetry} variant="outline">
            Tentar novamente
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function InstanceFormDialog({
  open,
  onOpenChange,
  onSuccess,
  existingInstanceId,
  existingInstanceName,
}: InstanceFormDialogProps) {
  // Se existingInstanceId, é reconexão (pula criação)
  const isReconnect = !!existingInstanceId;

  const [step, setStep] = useState<DialogStep>(isReconnect ? "connecting" : "creating");
  const [instanceId, setInstanceId] = useState<string | null>(existingInstanceId ?? null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<InstanceData | null>(null);
  const createCalledRef = useRef(false);

  // Tradução de erros para português
  const translateError = (message: string): string => {
    if (message.includes("limit reached")) {
      return "Você atingiu o limite de instâncias do seu plano. Delete uma existente ou faça upgrade.";
    }
    if (message.includes("Organization not found")) {
      return "Organização não encontrada. Por favor, faça login novamente.";
    }
    if (message.includes("UNAUTHORIZED")) {
      return "Sessão expirada. Por favor, faça login novamente.";
    }
    if (message.includes("Failed to create")) {
      return "Não foi possível criar a instância. Tente novamente em alguns segundos.";
    }
    return message;
  };

  // Mutation para criar instância
  const createMutation = api.whatsapp.create.useMutation({
    onSuccess: (data) => {
      setInstanceId(data.instance.id);
      setQrCode(data.qrCode);
      setStep("connecting");
    },
    onError: (error) => {
      setErrorMessage(translateError(error.message));
      setStep("error");
    },
  });

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      // Se é reconexão, começa no step "connecting" com instanceId já setado
      if (existingInstanceId) {
        setStep("connecting");
        setInstanceId(existingInstanceId);
      } else {
        setStep("creating");
        setInstanceId(null);
      }
      setQrCode(null);
      setErrorMessage(null);
      setSuccessData(null);
      createCalledRef.current = false;
    }
  }, [open, existingInstanceId]);

  // Criar instância ao abrir o dialog (apenas se não for reconexão)
  useEffect(() => {
    if (open && step === "creating" && !createCalledRef.current && !isReconnect) {
      createCalledRef.current = true;
      createMutation.mutate({});
    }
  }, [open, step, isReconnect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-close after success
  useEffect(() => {
    if (step === "success" && successData) {
      const timer = setTimeout(() => {
        onOpenChange(false);
        onSuccess?.(successData);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [step, successData, onOpenChange, onSuccess]);

  const handleConnectionSuccess = useCallback((data: InstanceData) => {
    setSuccessData(data);
    setStep("success");
  }, []);

  const handleError = useCallback((error: string) => {
    setErrorMessage(error);
    setStep("error");
  }, []);

  const handleRetry = useCallback(() => {
    setStep("creating");
    setInstanceId(null);
    setQrCode(null);
    setErrorMessage(null);
    createCalledRef.current = false;
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {step === "creating" && "Criando instância..."}
            {step === "connecting" && (isReconnect ? `Conectar ${existingInstanceName ?? "WhatsApp"}` : "Conectar WhatsApp")}
            {step === "success" && "Conectado!"}
            {step === "error" && "Erro"}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "creating" && (
            <motion.div
              key="creating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 text-center"
            >
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-4">
                Preparando conexão...
              </p>
            </motion.div>
          )}

          {step === "connecting" && instanceId && (
            <motion.div
              key="connecting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <QrPanel
                instanceId={instanceId}
                initialQrCode={qrCode}
                onSuccess={handleConnectionSuccess}
                onError={handleError}
              />
            </motion.div>
          )}

          {step === "success" && successData && (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <SuccessStep data={successData} />
            </motion.div>
          )}

          {step === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ErrorStep
                message={errorMessage ?? "Erro desconhecido"}
                onRetry={handleRetry}
                onClose={() => onOpenChange(false)}
                isLimitError={errorMessage?.includes("limite") ?? false}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
