"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownRight,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowUpLeft,
  Loader2,
  Check,
  AlertCircle,
  Info,
} from "lucide-react";
import Link from "next/link";

import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { isValidPhoneFormat } from "~/lib/phone";
import type { ValidationResult } from "~/server/api/routers/whatsapp";

// Status da validação
type ValidationState = "idle" | "validating" | "valid_unique" | "valid_variant" | "valid_ambiguous" | "invalid" | "error";

interface QrCardProps {
  qrCode?: string;
  isLoading?: boolean;
  isError?: boolean;
  // Pairing
  onRequestPairing: (phone: string) => Promise<{ pairingCode: string }>;
  onValidatePhone: (phone: string) => Promise<ValidationResult>;
  isPairingPending?: boolean;
  pairingCode?: string;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function QrCard({
  qrCode,
  isLoading = false,
  isError = false,
  onRequestPairing,
  onValidatePhone,
  isPairingPending = false,
  pairingCode: externalPairingCode,
}: QrCardProps) {
  const [phoneInput, setPhoneInput] = useState("");
  const [validationState, setValidationState] = useState<ValidationState>("idle");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [localPairingCode, setLocalPairingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debouncedPhone = useDebounce(phoneInput, 500);
  const cleanedPhone = phoneInput.replace(/\D/g, "");

  // Refs para funções estáveis (evita re-execução do useEffect)
  const onValidatePhoneRef = useRef(onValidatePhone);
  const onRequestPairingRef = useRef(onRequestPairing);

  // Atualiza refs quando funções mudam
  useEffect(() => {
    onValidatePhoneRef.current = onValidatePhone;
    onRequestPairingRef.current = onRequestPairing;
  }, [onValidatePhone, onRequestPairing]);

  // Validação automática em background quando formato válido
  useEffect(() => {
    const validatePhone = async () => {
      const cleaned = debouncedPhone.replace(/\D/g, "");

      if (!isValidPhoneFormat(debouncedPhone)) {
        setValidationState("idle");
        setValidationResult(null);
        setLocalPairingCode(null);
        return;
      }

      setValidationState("validating");
      setError(null);

      try {
        const result = await onValidatePhoneRef.current(cleaned);
        setValidationResult(result);

        if (result.status === "valid_unique") {
          setValidationState("valid_unique");
          // MÁGICA: gera pairing code automaticamente
          const pairingResult = await onRequestPairingRef.current(result.normalizedNumber!);
          setLocalPairingCode(pairingResult.pairingCode);
        } else if (result.status === "valid_variant") {
          // Variante encontrada - mostrar aviso e gerar code
          setValidationState("valid_variant");
          const pairingResult = await onRequestPairingRef.current(result.normalizedNumber!);
          setLocalPairingCode(pairingResult.pairingCode);
        } else if (result.status === "valid_ambiguous") {
          setValidationState("valid_ambiguous");
          setLocalPairingCode(null);
        } else {
          setValidationState("invalid");
          setLocalPairingCode(null);
        }
      } catch (err) {
        setValidationState("error");
        setError(err instanceof Error ? err.message : "Erro ao validar");
      }
    };

    void validatePhone();
  }, [debouncedPhone]); // Apenas debouncedPhone como dependência!

  // Handler para clique no botão (caso ambíguo ou manual)
  const handleConnectClick = useCallback(async () => {
    if (!isValidPhoneFormat(phoneInput)) return;

    setError(null);

    try {
      const result = await onRequestPairing(cleanedPhone);
      setLocalPairingCode(result.pairingCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar código");
    }
  }, [phoneInput, cleanedPhone, onRequestPairing]);

  const displayPairingCode = externalPairingCode ?? localPairingCode;
  const showPairingCode = displayPairingCode && (validationState === "valid_unique" || validationState === "valid_variant" || validationState === "valid_ambiguous");

  // Renderiza indicador de validação
  const renderValidationIndicator = () => {
    if (validationState === "validating" || isPairingPending) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    if (validationState === "valid_unique") {
      return <Check className="h-4 w-4 text-green-500" />;
    }
    if (validationState === "valid_variant") {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
    if (validationState === "invalid" || validationState === "error") {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative"
    >
      {/* Card container */}
      <div className="relative bg-card border border-border rounded-2xl p-8 shadow-xl">
        {/* Arrows pointing to QR */}
        <div className="absolute -top-6 -left-6 text-primary animate-bounce">
          <ArrowDownRight className="h-6 w-6" />
        </div>
        <div className="absolute -top-6 -right-6 text-primary animate-bounce delay-75">
          <ArrowDownLeft className="h-6 w-6" />
        </div>
        <div className="absolute -bottom-6 -left-6 text-primary animate-bounce delay-150">
          <ArrowUpRight className="h-6 w-6" />
        </div>
        <div className="absolute -bottom-6 -right-6 text-primary animate-bounce delay-300">
          <ArrowUpLeft className="h-6 w-6" />
        </div>

        {/* QR Code */}
        <div className="relative w-48 h-48 bg-white rounded-lg overflow-hidden mx-auto">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-red-500 p-4">
              <AlertCircle className="h-8 w-8 mb-2" />
              <span className="text-xs text-center">Erro ao carregar QR</span>
            </div>
          ) : qrCode ? (
            <img
              src={qrCode}
              alt="QR Code WhatsApp"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <span className="text-xs text-muted-foreground">Aguardando QR...</span>
            </div>
          )}
        </div>

        {/* Status text */}
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
            Escaneie com seu WhatsApp
            <Link href="/terms" target="_blank" title="Termos de Uso">
              <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
            </Link>
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Pairing Code Input */}
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
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {renderValidationIndicator()}
              </div>
            </div>
            <Button
              onClick={handleConnectClick}
              disabled={!isValidPhoneFormat(phoneInput) || validationState === "validating" || isPairingPending}
              size="sm"
            >
              {isPairingPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Conectar"
              )}
            </Button>
          </div>

          {/* Validation feedback */}
          {validationResult?.verifiedName && validationState === "valid_unique" && (
            <p className="text-xs text-green-500">
              {validationResult.verifiedName}
            </p>
          )}

          {validationState === "valid_variant" && validationResult && (
            <p className="text-xs text-yellow-500">
              Número não encontrado. Usando {validationResult.normalizedNumber}
              {validationResult.verifiedName && ` (${validationResult.verifiedName})`}
            </p>
          )}

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          {/* Pairing Code Display */}
          <AnimatePresence>
            {showPairingCode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg"
              >
                <p className="text-lg font-mono font-bold text-center text-primary tracking-widest">
                  {displayPairingCode}
                </p>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  WhatsApp &gt; Dispositivos vinculados &gt; Vincular com número
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl opacity-30 -z-10" />
    </motion.div>
  );
}
