type UserMessageProps = {
  link: string;
  text: string;
};

export function UserMessage({ link, text }: UserMessageProps) {
  return (
    <div className="flex w-full justify-end font-sans text-[13.5px] leading-normal text-foreground">
      <div className="flex max-w-[88%] flex-col gap-1 rounded-xl rounded-br-sm bg-muted px-3 py-2">
        {link && (
          <span className="font-mono text-[11.5px] break-all text-primary-text">
            {link}
          </span>
        )}
        {text && <span className="break-words">{text}</span>}
      </div>
    </div>
  );
}
