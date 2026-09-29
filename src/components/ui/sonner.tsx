"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

// Self-contained Sonner toaster. We hardcode `theme="dark"` because the
// Stockereum dashboard is dark-first and we don't ship a ThemeProvider. This
// keeps the component free of the next-themes provider dependency.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
