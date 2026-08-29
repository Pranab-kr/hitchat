'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    // design.md Motion: "Theme switch — background and text cross-fade 250ms". That is
    // next-themes' default (it applies a ~0.3s transition to <html> around the class
    // swap); disableTransitionOnChange would suppress it. The reduced-motion CSS kill
    // in globals.css already neutralizes it for users who opt out.
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  )
}
