export type DnsResult = { found: true; addresses: string[] } | { found: false };

export type Dns = {
  lookup(host: string): Promise<DnsResult>;
};
