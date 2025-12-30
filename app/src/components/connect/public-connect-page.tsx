"use client";

/**
 * PublicConnectPage
 *
 * UI da página pública de conexão remota de WhatsApp.
 * Mesmas features do QrPanel: QR code + pairing code por número.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Check,
  AlertCircle,
  Smartphone,
  QrCode,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { isValidPhoneFormat, cleanPhoneNumber } from "~/lib/phone";

type PageState = "loading" | "ready" | "connecting" | "success" | "error";

interface PublicConnectPageProps {
  code: string;
}

export function PublicConnectPage({ code }: PublicConnectPageProps) {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [instanceName, setInstanceName] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [qrCode, setQrCode] = useState<string | null>(null);

  // Phone input e pairing code (mesmos do QrPanel)
  const [phoneInput, setPhoneInput] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const qrRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Limpar intervals ao desmontar
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
    };
  }, []);

  // Verificar código ao montar
  useEffect(() => {
    checkStatus();
  }, [code]);

  const checkStatus = async () => {
    try {
      const response = await fetch(`/api/connect/${code}/status`);
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error ?? "Link inválido ou expirado");
        setPageState("error");
        return;
      }

      setInstanceName(data.instanceName ?? "WhatsApp");

      if (data.status === "connected") {
        setPageState("success");
      } else {
        setPageState("ready");
      }
    } catch {
      setErrorMessage("Erro ao verificar link. Tente novamente.");
      setPageState("error");
    }
  };

  const startConnection = async () => {
    setPageState("connecting");

    try {
      // 1. Iniciar sessão
      const sessionResponse = await fetch(`/api/connect/${code}/session`, {
        method: "POST",
      });

      if (!sessionResponse.ok) {
        const data = await sessionResponse.json();
        setErrorMessage(data.error ?? "Falha ao iniciar conexão");
        setPageState("error");
        return;
      }

      // 2. Aguardar e buscar QR
      await new Promise((r) => setTimeout(r, 2000));
      await fetchQrCode();

      // 3. Iniciar polling de status (cada 2s)
      startStatusPolling();
    } catch {
      setErrorMessage("Erro ao conectar. Tente novamente.");
      setPageState("error");
    }
  };

  const startStatusPolling = () => {
    // Polling de status (cada 2s)
    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/connect/${code}/status`);
        const data = await response.json();

        if (data.status === "connected") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
          setPageState("success");
        }
      } catch {
        // Ignora erro de polling
      }
    }, 2000);

    // Auto-refresh QR (cada 15s)
    qrRefreshRef.current = setInterval(fetchQrCode, 15000);

    // Timeout após 5 minutos
    setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
    }, 300000);
  };

  const fetchQrCode = async () => {
    try {
      const response = await fetch(`/api/connect/${code}/session`);
      const data = await response.json();

      if (data.loggedIn) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
        setPageState("success");
        return;
      }

      if (data.qrCode) {
        setQrCode(data.qrCode);
      }
    } catch {
      // Ignora erro, vai tentar novamente
    }
  };

  // Handler para pairing code (mesmo do QrPanel)
  const handleConnectByPhone = async () => {
    if (!isValidPhoneFormat(phoneInput)) return;

    setPairingLoading(true);

    try {
      const response = await fetch(`/api/connect/${code}/pairing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhoneNumber(phoneInput) }),
      });

      if (!response.ok) {
        const data = await response.json();
        setErrorMessage(data.error ?? "Erro ao gerar código");
        return;
      }

      const data = await response.json();
      setPairingCode(data.pairingCode);

      // Iniciar polling se ainda não estiver rodando
      if (!pollingRef.current) {
        startStatusPolling();
      }
    } catch {
      setErrorMessage("Erro ao gerar código de pareamento");
    } finally {
      setPairingLoading(false);
    }
  };

  const isConnecting = pairingCode !== null || pairingLoading;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-card border rounded-xl p-8 shadow-lg">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">Conectar WhatsApp</h1>
            {instanceName && pageState !== "loading" && (
              <p className="text-sm text-muted-foreground mt-1">
                {instanceName}
              </p>
            )}
          </div>

          <AnimatePresence mode="wait">
            {/* Loading */}
            {pageState === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 text-center"
              >
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-4">
                  Verificando link...
                </p>
              </motion.div>
            )}

            {/* Ready */}
            {pageState === "ready" && (
              <motion.div
                key="ready"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 text-center"
              >
                <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-6">
                  Clique para gerar o QR code e conectar seu WhatsApp
                </p>
                <Button onClick={startConnection} size="lg">
                  Conectar WhatsApp
                </Button>
              </motion.div>
            )}

            {/* Connecting - QR Code + Phone Input (mesmo layout do QrPanel) */}
            {pageState === "connecting" && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* QR Code */}
                <div className="relative">
                  <div className="relative w-48 h-48 bg-white rounded-xl overflow-hidden mx-auto">
                    {qrCode ? (
                      <img
                        src={qrCode}
                        alt="QR Code WhatsApp"
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Status text */}
                <p className="text-sm text-muted-foreground text-center">
                  Escaneie com seu WhatsApp
                </p>

                {/* Divider (mesmo do QrPanel) */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">ou</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Phone Input Section (mesmo do QrPanel) */}
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
                        {pairingLoading && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {pairingCode && !pairingLoading && (
                          <Check className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={handleConnectByPhone}
                      disabled={!isValidPhoneFormat(phoneInput) || pairingLoading || !!pairingCode}
                    >
                      {pairingLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Conectar"
                      )}
                    </Button>
                  </div>

                  {/* Pairing Code Display (mesmo do QrPanel) */}
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

                {/* Waiting indicator (se não tem pairing code) */}
                {!pairingCode && (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Aguardando conexão...</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Success */}
            {pageState === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
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
                <h3 className="text-lg font-semibold mb-1">
                  WhatsApp Conectado!
                </h3>
                <p className="text-sm text-muted-foreground">
                  Você pode fechar esta página.
                </p>
              </motion.div>
            )}

            {/* Error */}
            {pageState === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Link inválido</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {errorMessage}
                </p>
                <p className="text-xs text-muted-foreground">
                  Peça um novo link para quem compartilhou com você.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Powered by{" "}
          <a
            href="https://livchat.ai"
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            LivChat.ai
          </a>
        </p>
      </motion.div>
    </div>
  );
}
