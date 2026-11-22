import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
  footer: ReactNode;
};

export function AuthShell({ children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-[400px] flex-col gap-5">
        <div className="flex items-center justify-center gap-2.5">
          <span
            aria-hidden="true"
            className="inline-flex size-8 items-center justify-center rounded-lg bg-primary"
          >
            <span className="h-[17px] w-2.5 rounded-xs border-2 border-primary-foreground" />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            AI Ads Manager
          </span>
          <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
            POC
          </span>
        </div>
        {children}
        <p className="m-0 text-center text-xs text-muted-foreground">
          {footer}
        </p>
      </div>
    </div>
  );
}
