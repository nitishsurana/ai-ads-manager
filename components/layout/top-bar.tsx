import Link from "next/link";
import { NewWorkspaceLink } from "./new-workspace-link";
import { WorkspaceTabs } from "./workspace-tabs";

type TopBarProps = {
  tester: string;
  admin?: boolean;
};

export function TopBar({ tester, admin = false }: TopBarProps) {
  return (
    <header className="flex h-14 w-full items-center gap-4 border-b border-border bg-card px-4 font-sans text-sm text-foreground">
      <Link
        href="/"
        className="flex items-center gap-2.5 text-inherit no-underline"
      >
        <span
          aria-hidden="true"
          className="inline-flex size-6.5 items-center justify-center rounded-md bg-primary"
        >
          <span className="h-3.5 w-2 rounded-xs border-2 border-primary-foreground" />
        </span>
        <span className="font-semibold tracking-tight">Ad Studio</span>
        <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
          {admin ? "ADMIN" : "POC"}
        </span>
      </Link>
      <WorkspaceTabs />
      <div className="ml-auto flex items-center gap-2">
        {admin ? (
          <span className="inline-flex h-6 items-center rounded-full border border-warning-border bg-warning px-2 text-xs font-medium text-warning-foreground">
            Admin access
          </span>
        ) : (
          <>
            <NewWorkspaceLink />
            <Link
              href="/history"
              className="inline-flex h-8.5 items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px] font-medium text-inherit no-underline hover:bg-muted"
            >
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
                <path d="M12 7v5l3 2" />
              </svg>
              History
              <svg
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </Link>
          </>
        )}
        <div className="ml-1 flex items-center gap-2 border-l border-border pl-3">
          <span
            aria-hidden="true"
            className="inline-flex size-7 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold text-primary-text"
          >
            {tester.charAt(0).toUpperCase()}
          </span>
          <span className="text-[13px] font-medium">{tester}</span>
        </div>
      </div>
    </header>
  );
}
