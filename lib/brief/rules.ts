export const ruleKey = (rule: { kind: string; text: string }) =>
  `${rule.kind}:${rule.text.toLowerCase()}`;
