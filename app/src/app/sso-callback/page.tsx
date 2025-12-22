"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useEffect } from "react";

export default function SSOCallbackPage() {
  useEffect(() => {
    // Se aberto em popup, fecha automaticamente após auth completar
    if (window.opener) {
      const timer = setTimeout(() => {
        window.close();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
        <p className="text-muted-foreground">Autenticando...</p>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
