"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Smartphone,
  Wifi,
  WifiOff,
  Clock,
  Power,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  mockConnection,
  formatRelativeTime,
  formatPhoneNumber,
} from "~/lib/mock-dashboard";

export function ConnectionWidget() {
  const [uptime, setUptime] = useState("");
  const connection = mockConnection;

  // Atualiza uptime a cada minuto
  useEffect(() => {
    const updateUptime = () => {
      if (connection.connectedSince) {
        setUptime(formatRelativeTime(connection.connectedSince).replace("há ", ""));
      }
    };

    updateUptime();
    const interval = setInterval(updateUptime, 60000);
    return () => clearInterval(interval);
  }, [connection.connectedSince]);

  const isOnline = connection.connected && connection.loggedIn;

  return (
    <Card className="relative overflow-hidden">
      {/* Glow effect quando online */}
      {isOnline && (
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
      )}

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          Conexão WhatsApp
        </CardTitle>
        <Badge
          variant={isOnline ? "default" : "destructive"}
          className={
            isOnline
              ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20"
              : ""
          }
        >
          <motion.span
            className={`w-2 h-2 rounded-full mr-1.5 ${isOnline ? "bg-green-500" : "bg-red-500"}`}
            animate={isOnline ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />
          {isOnline ? "Online" : "Offline"}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {isOnline ? (
          <>
            {/* Número conectado */}
            <div className="space-y-1">
              <p className="text-2xl font-bold tracking-tight">
                {formatPhoneNumber(connection.jid)}
              </p>
              <p className="text-xs text-muted-foreground">
                {connection.deviceName}
              </p>
            </div>

            {/* Status indicators */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5 text-green-500" />
                <span>Conectado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{uptime}</span>
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Reconectar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
              >
                <Power className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Estado desconectado */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <WifiOff className="h-5 w-5" />
                <p className="text-lg font-medium">Desconectado</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Conecte seu WhatsApp para começar
              </p>
            </div>

            <Button className="w-full" size="sm">
              <Wifi className="h-4 w-4 mr-2" />
              Conectar WhatsApp
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
