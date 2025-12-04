"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

/**
 * Theme Provider - Wrapper para next-themes
 *
 * Configuração:
 * - attribute="class" - Usa classe .dark no HTML
 * - defaultTheme="system" - Começa com preferência do sistema
 * - enableSystem - Permite seguir preferência do sistema
 * - disableTransitionOnChange - Evita flash durante mudança de tema
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
