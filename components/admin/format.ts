export const COLUMNS = 9;

export const money = (amount: number) => `$${amount.toFixed(2)}`;

export const angleLabel = (angle: string) =>
  angle.charAt(0).toUpperCase() + angle.slice(1).replaceAll("_", " ");

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export const dateLabel = (iso: string) => dateFormat.format(new Date(iso));

export function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} min ${seconds % 60} s` : `${seconds} s`;
}
