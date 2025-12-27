"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ============================================
// TYPES
// ============================================

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface HeaderConfig {
  /** Breadcrumb items (last one is current page) */
  breadcrumbs?: BreadcrumbItem[];
  /** Custom actions to render on the right side */
  actions?: ReactNode;
  /** Whether to show the AI chat trigger (default: true) */
  showAiChat?: boolean;
}

interface HeaderContextValue {
  config: HeaderConfig;
  setConfig: (config: HeaderConfig) => void;
  resetConfig: () => void;
}

// ============================================
// CONTEXT
// ============================================

const HeaderContext = createContext<HeaderContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

const DEFAULT_CONFIG: HeaderConfig = {
  breadcrumbs: [{ label: "Dashboard" }],
  showAiChat: true,
};

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<HeaderConfig>(DEFAULT_CONFIG);

  const setConfig = useCallback((newConfig: HeaderConfig) => {
    setConfigState(newConfig);
  }, []);

  const resetConfig = useCallback(() => {
    setConfigState(DEFAULT_CONFIG);
  }, []);

  return (
    <HeaderContext.Provider value={{ config, setConfig, resetConfig }}>
      {children}
    </HeaderContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useHeader() {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error("useHeader must be used within a HeaderProvider");
  }
  return context;
}

// ============================================
// HOOK FOR SETTING HEADER (used by pages)
// ============================================

import { useEffect } from "react";

export function useHeaderConfig(config: HeaderConfig) {
  const { setConfig, resetConfig } = useHeader();

  useEffect(() => {
    setConfig(config);
    return () => resetConfig();
  }, [config, setConfig, resetConfig]);
}
