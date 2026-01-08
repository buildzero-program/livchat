"use client";

import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, MessageSquare, CreditCard, Smartphone } from "lucide-react";

import { QrCard } from "~/components/marketing/qr-card";
import { TestPanelV2 } from "~/components/marketing/test-panel";
import { useWhatsApp } from "~/hooks/useWhatsApp";

const DEMO_FEATURES = [
  { icon: Zap, text: "Teste antes de criar conta" },
  { icon: MessageSquare, text: "50 mensagens gratis/dia" },
  { icon: CreditCard, text: "Sem cartao de credito" },
];

export function DemoSectionB2B() {
  const whatsapp = useWhatsApp();

  // Handlers estaveis com useCallback para evitar re-renders infinitos
  const handleRequestPairing = useCallback(
    async (phone: string) => {
      const result = await whatsapp.pairing.mutateAsync(phone);
      return { pairingCode: result.pairingCode };
    },
    [whatsapp.pairing]
  );

  const handleValidatePhone = useCallback(
    async (phone: string) => {
      return await whatsapp.validate.mutateAsync(phone);
    },
    [whatsapp.validate]
  );

  const handleDisconnect = useCallback(() => {
    whatsapp.disconnect.mutate();
  }, [whatsapp.disconnect]);

  const handleSendMessage = useCallback(
    async (phone: string, message: string) => {
      const result = await whatsapp.send.mutateAsync({ phone, message });
      return {
        success: result.success,
        messageId: result.messageId,
        timestamp: result.timestamp,
      };
    },
    [whatsapp.send]
  );

  const handleSendImage = useCallback(
    async (phone: string, imageBase64: string, caption?: string) => {
      const result = await whatsapp.sendImage.mutateAsync({
        phone,
        image: imageBase64,
        caption,
      });
      return {
        success: result.success,
        messageId: result.messageId,
        timestamp: result.timestamp,
      };
    },
    [whatsapp.sendImage]
  );

  return (
    <section id="demo" className="relative py-24 px-6 bg-[#0A0A0F]">
      {/* Top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-[family-name:var(--font-body)] font-medium text-emerald-400">
              Teste Agora
            </span>
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold text-white mb-4">
            Conecte seu WhatsApp em{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-violet-400 bg-clip-text text-transparent">
              30 segundos
            </span>
          </h2>
          <p className="font-[family-name:var(--font-body)] text-lg text-white/50 max-w-xl mx-auto">
            Escaneie o QR code, teste a API e veja funcionando. Sem cadastro,
            sem cartao, sem friccao.
          </p>
        </motion.div>

        {/* QR Card or Test Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-12"
        >
          <AnimatePresence mode="wait">
            {whatsapp.isLoggedIn ? (
              <motion.div
                key="test-panel"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <TestPanelV2
                  onDisconnect={handleDisconnect}
                  onSendMessage={handleSendMessage}
                  onSendImage={handleSendImage}
                  onValidatePhone={handleValidatePhone}
                  isSending={
                    whatsapp.send.isPending || whatsapp.sendImage.isPending
                  }
                  isDisconnecting={whatsapp.disconnect.isPending}
                  jid={whatsapp.jid}
                  apiKey={whatsapp.apiKey}
                  messagesUsed={whatsapp.messagesUsed}
                  messagesLimit={whatsapp.messagesLimit}
                />
              </motion.div>
            ) : (
              <motion.div
                key="qr-card"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <QrCard
                  qrCode={whatsapp.qrCode}
                  isLoading={whatsapp.isLoading}
                  isError={whatsapp.isError}
                  onRequestPairing={handleRequestPairing}
                  onValidatePhone={handleValidatePhone}
                  isPairingPending={whatsapp.pairing.isPending}
                  pairingCode={whatsapp.pairing.data?.pairingCode}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Features row */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap justify-center gap-8"
        >
          {DEMO_FEATURES.map((feature, index) => (
            <div
              key={index}
              className="flex items-center gap-2 text-sm font-[family-name:var(--font-body)] text-white/50"
            >
              <feature.icon className="h-4 w-4 text-emerald-400" />
              {feature.text}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </section>
  );
}
