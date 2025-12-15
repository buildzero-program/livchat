"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Send,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  Clock,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { mockLastTest, formatRelativeTime } from "~/lib/mock-dashboard";

export function QuickTestWidget() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const lastTest = mockLastTest;

  const handleSend = async () => {
    if (!phone || !message) return;

    setIsSending(true);
    // Simula envio
    await new Promise((r) => setTimeout(r, 1000));
    setIsSending(false);
    setPhone("");
    setMessage("");
  };

  return (
    <Card className="col-span-full relative overflow-hidden">
      {/* Gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-chart-2 to-primary" />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Teste Rápido
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              Compacto <ChevronUp className="h-3 w-3 ml-1" />
            </>
          ) : (
            <>
              Expandir <ChevronDown className="h-3 w-3 ml-1" />
            </>
          )}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            /* Modo Compacto - Uma linha */
            <motion.div
              key="compact"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-2"
            >
              <Input
                placeholder="+55 11 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 max-w-[180px]"
              />
              <Input
                placeholder="Sua mensagem..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                size="icon"
                disabled={!phone || !message || isSending}
                onClick={handleSend}
              >
                <Send className={`h-4 w-4 ${isSending ? "animate-pulse" : ""}`} />
              </Button>
            </motion.div>
          ) : (
            /* Modo Expandido - Formulário completo */
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Número de destino
                  </label>
                  <Input
                    placeholder="+55 11 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Contato frequente
                  </label>
                  <Button variant="outline" className="w-full justify-start">
                    <User className="h-4 w-4 mr-2" />
                    Selecionar contato
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Mensagem
                </label>
                <Textarea
                  placeholder="Digite sua mensagem de teste..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                className="w-full"
                disabled={!phone || !message || isSending}
                onClick={handleSend}
              >
                <Send className={`h-4 w-4 mr-2 ${isSending ? "animate-pulse" : ""}`} />
                {isSending ? "Enviando..." : "Enviar Mensagem"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Último envio */}
        {lastTest && (
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span suppressHydrationWarning>
                Último envio: {formatRelativeTime(lastTest.timestamp)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                {lastTest.phone}
              </span>
              <Badge
                variant="secondary"
                className="bg-green-500/10 text-green-500 text-xs"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Entregue
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
