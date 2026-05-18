interface UmamiPayload {
  hostname: string;
  language: string;
  referrer: string;
  screen: string;
  title: string;
  url: string;
  website: string;
  id?: string;
  name?: string;
  data?: Record<string, string | number>;
}

interface UmamiTracker {
  track(): void;
  track(event: string, data?: Record<string, string | number>): void;
  track(payload: Partial<UmamiPayload>): void;
  track(fn: (props: UmamiPayload) => Partial<UmamiPayload>): void;
  identify(distinctId: string, data?: Record<string, string | number>): void;
  identify(data: Record<string, string | number>): void;
}

declare const umami: UmamiTracker | undefined;
