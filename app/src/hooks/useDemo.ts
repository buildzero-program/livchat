"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import type { ValidationResult } from "~/server/api/routers/demo";

const POLLING_INTERVAL_MS = 2000;
const STORAGE_KEY = "livchat_demo_state";

// Estado cacheado no localStorage
interface CachedState {
  loggedIn: boolean;
  jid?: string;
  apiKey?: string;
}

// Funções de localStorage (safe para SSR)
function getStoredState(): CachedState | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return null;
    return JSON.parse(cached) as CachedState;
  } catch {
    return null;
  }
}

function setStoredState(state: CachedState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

function clearStoredState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export interface UseDemoReturn {
  // Status
  isConnected: boolean;
  isLoggedIn: boolean;
  qrCode: string | undefined;
  jid: string | undefined;
  apiKey: string | undefined;
  isLoading: boolean;
  isError: boolean;

  // Mutations
  pairing: {
    mutate: (phone: string) => void;
    mutateAsync: (phone: string) => Promise<{ success: boolean; pairingCode: string }>;
    isPending: boolean;
    data: { success: boolean; pairingCode: string } | undefined;
    error: unknown;
    reset: () => void;
  };

  validate: {
    mutate: (phone: string) => void;
    mutateAsync: (phone: string) => Promise<ValidationResult>;
    isPending: boolean;
    data: ValidationResult | undefined;
    error: unknown;
    reset: () => void;
  };

  send: {
    mutate: (params: { phone: string; message: string }) => void;
    mutateAsync: (params: { phone: string; message: string }) => Promise<{
      success: boolean;
      messageId: string;
      timestamp: number;
    }>;
    isPending: boolean;
    data: { success: boolean; messageId: string; timestamp: number } | undefined;
    error: unknown;
    reset: () => void;
  };

  disconnect: {
    mutate: () => void;
    mutateAsync: () => Promise<{ success: boolean }>;
    isPending: boolean;
  };

  // Refetch status manually
  refetchStatus: () => void;
}

export function useDemo(): UseDemoReturn {
  // Estado otimista do localStorage (sem TTL!)
  const [optimisticState, setOptimisticState] = useState<CachedState | null>(null);

  // Carrega estado do localStorage no mount (client-side only)
  useEffect(() => {
    setOptimisticState(getStoredState());
  }, []);

  // Query status with polling when not logged in
  const statusQuery = api.demo.status.useQuery(undefined, {
    refetchInterval: (query) => {
      // Poll every 2s while waiting for login
      const data = query.state.data;
      if (!data?.loggedIn) {
        return POLLING_INTERVAL_MS;
      }
      // Once logged in, poll less frequently (10s)
      return 10000;
    },
  });

  // Sincroniza localStorage quando backend retorna dados
  useEffect(() => {
    if (statusQuery.data) {
      const newState: CachedState = {
        loggedIn: statusQuery.data.loggedIn,
        jid: statusQuery.data.jid,
        apiKey: statusQuery.data.apiKey,
      };
      setStoredState(newState);
      setOptimisticState(newState);
    }
  }, [statusQuery.data]);

  // Mutations
  const pairingMutation = api.demo.pairing.useMutation();
  const validateMutation = api.demo.validate.useMutation();
  const sendMutation = api.demo.send.useMutation();
  const disconnectMutation = api.demo.disconnect.useMutation({
    onSuccess: async () => {
      // Limpa cache local no logout
      clearStoredState();
      setOptimisticState(null);
      // Refetch status after disconnect - AGUARDA para evitar race condition
      await statusQuery.refetch();
    },
  });

  // Usa estado otimista enquanto carrega (evita flash visual)
  const isLoggedIn = statusQuery.isLoading && optimisticState
    ? optimisticState.loggedIn
    : statusQuery.data?.loggedIn ?? false;

  const jid = statusQuery.isLoading && optimisticState
    ? optimisticState.jid
    : statusQuery.data?.jid;

  const apiKey = statusQuery.isLoading && optimisticState
    ? optimisticState.apiKey
    : statusQuery.data?.apiKey;

  return {
    // Status - usa estado otimista para evitar flash
    isConnected: statusQuery.data?.connected ?? optimisticState?.loggedIn ?? false,
    isLoggedIn,
    qrCode: statusQuery.data?.qrCode,
    jid,
    apiKey, // Usa cache otimista para evitar flash
    isLoading: statusQuery.isLoading && !optimisticState, // Só mostra loading se não tem cache
    isError: statusQuery.isError,

    // Pairing mutation
    pairing: {
      mutate: (phone: string) => pairingMutation.mutate({ phone }),
      mutateAsync: (phone: string) => pairingMutation.mutateAsync({ phone }),
      isPending: pairingMutation.isPending,
      data: pairingMutation.data,
      error: pairingMutation.error,
      reset: pairingMutation.reset,
    },

    // Validate mutation
    validate: {
      mutate: (phone: string) => validateMutation.mutate({ phone }),
      mutateAsync: (phone: string) => validateMutation.mutateAsync({ phone }),
      isPending: validateMutation.isPending,
      data: validateMutation.data,
      error: validateMutation.error,
      reset: validateMutation.reset,
    },

    // Send mutation
    send: {
      mutate: (params: { phone: string; message: string }) => sendMutation.mutate(params),
      mutateAsync: (params: { phone: string; message: string }) => sendMutation.mutateAsync(params),
      isPending: sendMutation.isPending,
      data: sendMutation.data,
      error: sendMutation.error,
      reset: sendMutation.reset,
    },

    // Disconnect mutation
    disconnect: {
      mutate: () => disconnectMutation.mutate(),
      mutateAsync: () => disconnectMutation.mutateAsync(),
      isPending: disconnectMutation.isPending,
    },

    // Manual refetch
    refetchStatus: () => void statusQuery.refetch(),
  };
}
