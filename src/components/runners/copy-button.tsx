"use client";

import { Check, Copy } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  variant?: "icon" | "pill" | "ghost";
  size?: "sm" | "md";
}

// One-tap copy-to-clipboard for contract addresses. Shows a 1.5s "Copied"
// confirmation and triggers a sonner toast so the user always sees feedback.
export function CopyButton({ value, label, className, variant = "icon", size = "sm" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      // Prefer the async clipboard API; fall back to execCommand for older
      // mobile Safari (used when the PWA is "installed" on iOS home screen).
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success("Contract address copied", { description: value });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — long-press the address to copy manually.");
    }
  }, [value]);

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label || "address"}`}
        className={cn(
          "inline-flex items-center justify-center rounded-md transition-colors",
          "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          size === "sm" ? "h-7 w-7" : "h-9 w-9",
          className,
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    );
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={onCopy}
        className={cn(
          "mono inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1",
          "text-xs text-foreground/90 transition-colors hover:border-primary/40 hover:bg-accent/40",
          className,
        )}
        title={`Copy ${label || "address"}`}
      >
        <span className="truncate max-w-[14ch] sm:max-w-[24ch]">{value}</span>
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
      </button>
    );
  }

  // ghost
  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground", className)}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
