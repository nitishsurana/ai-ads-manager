import { CircleAlert, LoaderCircle } from "lucide-react";

type Bullet = { label: string; text: string; aside?: string };

type AssistantMessageProps = {
  text?: string;
  tone?: "default" | "error";
  note?: string;
  status?: string;
  bullets?: Bullet[];
};

export function AssistantMessage({
  text = "",
  tone = "default",
  note = "",
  status = "",
  bullets = [],
}: AssistantMessageProps) {
  return (
    <div className="flex w-full gap-2.5 font-sans text-[13.5px] leading-normal text-foreground">
      <span
        aria-hidden="true"
        className="inline-flex size-5.5 shrink-0 items-center justify-center rounded-md bg-primary"
      >
        <span className="h-[11px] w-1.5 rounded-[1.5px] border-[1.5px] border-primary-foreground" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {text && tone === "default" && (
          <p className="m-0 break-words">{text}</p>
        )}
        {text && tone === "error" && (
          <div
            role="alert"
            className="flex gap-2 rounded-lg border border-destructive-border bg-destructive-subtle px-3 py-2.5 text-destructive"
          >
            <CircleAlert
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>{text}</span>
          </div>
        )}
        {bullets.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
            {bullets.map((bullet, index) => (
              <li key={index} className="flex gap-1.5">
                <span aria-hidden="true" className="font-semibold text-success">
                  +
                </span>
                <span>
                  <strong className="font-semibold">{bullet.label}</strong>{" "}
                  {bullet.text}{" "}
                  {bullet.aside && (
                    <span className="text-muted-foreground">
                      {bullet.aside}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {status && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <LoaderCircle
              className="size-3.5 animate-spin"
              aria-hidden="true"
            />
            {status}
          </span>
        )}
        {note && <p className="m-0 text-muted-foreground">{note}</p>}
      </div>
    </div>
  );
}
