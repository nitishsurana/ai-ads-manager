export const messages = {
  wrong_password: "That password isn't right.",
  name_invalid: "Enter your name, up to 40 characters.",
} as const;

export type MessageCode = keyof typeof messages;
