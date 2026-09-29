"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KeyRound, WifiOff, AlertTriangle, SearchX, Loader2 } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ title, description, icon: Icon = SearchX, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed border-border bg-card/40 p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/40">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{description}</p>}
      {action && (
        <Button size="sm" variant="outline" onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </Card>
  );
}

export function LoadingState({ label = "Loading runners…" }: { label?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="border-border bg-card/40 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-accent/30 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 rounded bg-accent/30 animate-pulse" />
              <div className="h-2.5 w-3/4 rounded bg-accent/20 animate-pulse" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-8 rounded bg-accent/20 animate-pulse" />
            ))}
          </div>
          <div className="mt-3 h-8 rounded bg-accent/20 animate-pulse" />
        </Card>
      ))}
      <div className="col-span-full flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {label}
      </div>
    </div>
  );
}

export function ErrorState({
  message,
  demoMode,
  onRetry,
}: {
  message: string;
  demoMode?: boolean;
  onRetry?: () => void;
}) {
  const isAuth = /api key|AVE_AUTH|AVE_NO_API_KEY/i.test(message);
  const Icon = isAuth ? KeyRound : /rate limit/i.test(message) ? AlertTriangle : WifiOff;
  return (
    <Card className="border-amber-500/30 bg-amber-500/5 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
        <Icon className="h-6 w-6 text-amber-400" />
      </div>
      <h3 className="text-sm font-semibold">
        {isAuth ? "Ave.ai API key required" : "Couldn't load runners"}
      </h3>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
        {isAuth ? (
          <>
            Set <code className="mono rounded bg-card/60 px-1.5 py-0.5 text-[11px]">AVE_API_KEY</code> in your
            environment to pull live Stockereum runners. Showing demo data
            instead — see the README for setup.
          </>
        ) : (
          message
        )}
      </p>
      {demoMode && (
        <p className="mt-2 text-[10px] uppercase tracking-wide text-cyan-300/80">Demo mode is on</p>
      )}
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-4">
          Retry
        </Button>
      )}
    </Card>
  );
}
