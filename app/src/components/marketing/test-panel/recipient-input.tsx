"use client";

import { Loader2, Check, AlertCircle } from "lucide-react";
import { Input } from "~/components/ui/input";
import type { ValidationResult } from "~/server/api/routers/whatsapp";

type ValidationStatus = "idle" | "validating" | "valid" | "variant" | "invalid";

interface RecipientInputProps {
  value: string;
  onChange: (value: string) => void;
  validationStatus: ValidationStatus;
  validationResult: ValidationResult | null;
  isValidating: boolean;
}

export function RecipientInput({
  value,
  onChange,
  validationStatus,
  validationResult,
  isValidating,
}: RecipientInputProps) {
  const renderIndicator = () => {
    if (isValidating) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    if (validationStatus === "valid") {
      return <Check className="h-4 w-4 text-green-500" />;
    }
    if (validationStatus === "variant") {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
    if (validationStatus === "invalid") {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm text-muted-foreground">Destinatário</label>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="+55 11 99999-9999"
          className="pr-10"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {renderIndicator()}
        </div>
      </div>
      {validationStatus === "valid" && validationResult?.verifiedName && (
        <p className="text-xs text-green-500">{validationResult.verifiedName}</p>
      )}
      {validationStatus === "variant" && validationResult && (
        <p className="text-xs text-yellow-500">
          Usando {validationResult.normalizedNumber}
          {validationResult.verifiedName && ` (${validationResult.verifiedName})`}
        </p>
      )}
      {validationStatus === "invalid" && (
        <p className="text-xs text-red-500">Número não encontrado no WhatsApp</p>
      )}
    </div>
  );
}
