"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import { Zap, MessageSquare, CreditCard } from "lucide-react";

import { QrCard } from "./qr-card";
import { TestPanel } from "./test-panel";
import { useWhatsApp } from "~/hooks/useWhatsApp";

const features = [
  { icon: Zap, text: "Teste antes de criar conta" },
  { icon: MessageSquare, text: "50 mensagens grátis/dia" },
  { icon: CreditCard, text: "Sem cartão de crédito" },
];

export function Hero() {
  const whatsapp = useWhatsApp();

  // Handlers estáveis com useCallback para evitar re-renders infinitos
  const handleRequestPairing = useCallback(async (phone: string) => {
    const result = await whatsapp.pairing.mutateAsync(phone);
    return { pairingCode: result.pairingCode };
  }, [whatsapp.pairing]);

  const handleValidatePhone = useCallback(async (phone: string) => {
    return await whatsapp.validate.mutateAsync(phone);
  }, [whatsapp.validate]);

  const handleDisconnect = useCallback(() => {
    whatsapp.disconnect.mutate();
  }, [whatsapp.disconnect]);

  const handleSendMessage = useCallback(async (phone: string, message: string) => {
    const result = await whatsapp.send.mutateAsync({ phone, message });
    return {
      success: result.success,
      messageId: result.messageId,
      timestamp: result.timestamp,
    };
  }, [whatsapp.send]);

  return (
    <section className="relative min-h-screen pt-32 pb-20 px-6 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-7xl">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center mb-8"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary">
            <Zap className="h-4 w-4" />
            Usado por +500 devs e agências
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center text-4xl md:text-5xl lg:text-7xl font-bold mb-6 max-w-4xl mx-auto"
        >
          Conecte seu WhatsApp{" "}
          <span className="bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">
            em 30 segundos
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center text-lg md:text-xl text-muted-foreground mb-16 max-w-2xl mx-auto"
        >
          Escaneie o QR code, teste a API e integre em minutos. Sem cadastro,
          sem cartão, sem fricção.
        </motion.p>

        {/* QR Card or Test Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center mb-16"
        >
          {whatsapp.isLoggedIn ? (
            <TestPanel
              onDisconnect={handleDisconnect}
              onSendMessage={handleSendMessage}
              onValidatePhone={handleValidatePhone}
              isSending={whatsapp.send.isPending}
              isDisconnecting={whatsapp.disconnect.isPending}
              jid={whatsapp.jid}
              apiKey={whatsapp.apiKey}
            />
          ) : (
            <QrCard
              qrCode={whatsapp.qrCode}
              isLoading={whatsapp.isLoading}
              isError={whatsapp.isError}
              onRequestPairing={handleRequestPairing}
              onValidatePhone={handleValidatePhone}
              isPairingPending={whatsapp.pairing.isPending}
              pairingCode={whatsapp.pairing.data?.pairingCode}
            />
          )}
        </motion.div>

        {/* Features row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap justify-center gap-8"
        >
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <feature.icon className="h-4 w-4 text-primary" />
              {feature.text}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
