import type { KvStore } from '@engine/storage';
import type {
  EmailTransport,
  ParentVerification,
  VerificationStatus,
  VerificationToken,
} from './types';

const KV_STATUS_KEY = 'parent-verification:status';
const KV_TOKEN_KEY = 'parent-verification:token';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateParentVerificationOptions = {
  kv: KvStore;
  transport: EmailTransport;
  now?: () => number;
  generateToken?: () => string;
};

export class VerificationError extends Error {
  override readonly name = 'VerificationError';
  constructor(
    message: string,
    public readonly code: 'INVALID_EMAIL' | 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'NOT_AWAITING',
  ) {
    super(message);
  }
}

export function createParentVerification(
  opts: CreateParentVerificationOptions,
): ParentVerification {
  const { kv, transport } = opts;
  const now = opts.now ?? (() => Date.now());
  const generateToken =
    opts.generateToken ??
    (() => {
      // Web Crypto random hex; no security claims for MVP — the real
      // backend (bd-priv.3-email) will issue server-signed tokens.
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    });

  return {
    async status(): Promise<VerificationStatus> {
      const stored = await kv.get<VerificationStatus>(KV_STATUS_KEY);
      return stored ?? { state: 'unverified' };
    },

    async beginVerification(email: string): Promise<VerificationStatus> {
      if (!EMAIL_RE.test(email)) {
        throw new VerificationError('Email format is invalid.', 'INVALID_EMAIL');
      }
      const sentAt = now();
      const token: VerificationToken = {
        token: generateToken(),
        email,
        expiresAt: sentAt + TOKEN_TTL_MS,
      };
      await kv.set(KV_TOKEN_KEY, token);
      await transport.sendMagicLink({ email, token });
      const status: VerificationStatus = { state: 'awaiting_link', email, sentAt };
      await kv.set(KV_STATUS_KEY, status);
      return status;
    },

    async completeVerification(submittedToken: string): Promise<VerificationStatus> {
      const stored = await kv.get<VerificationToken>(KV_TOKEN_KEY);
      const current = await kv.get<VerificationStatus>(KV_STATUS_KEY);
      if (!stored || !current || current.state !== 'awaiting_link') {
        throw new VerificationError('No verification in progress.', 'NOT_AWAITING');
      }
      if (stored.token !== submittedToken) {
        throw new VerificationError('Token does not match.', 'INVALID_TOKEN');
      }
      if (now() > stored.expiresAt) {
        await kv.delete(KV_TOKEN_KEY);
        throw new VerificationError('Token has expired.', 'TOKEN_EXPIRED');
      }
      const verified: VerificationStatus = {
        state: 'verified',
        email: stored.email,
        verifiedAt: now(),
      };
      await kv.set(KV_STATUS_KEY, verified);
      await kv.delete(KV_TOKEN_KEY);
      return verified;
    },

    async reset(): Promise<void> {
      await kv.delete(KV_STATUS_KEY);
      await kv.delete(KV_TOKEN_KEY);
    },
  };
}

/** No-op email transport — the MVP default. Records calls for inspection. */
export function createNoopEmailTransport(): EmailTransport & {
  readonly sent: ReadonlyArray<{ email: string; token: VerificationToken }>;
} {
  const sent: { email: string; token: VerificationToken }[] = [];
  return {
    get sent() {
      return sent;
    },
    async sendMagicLink(args) {
      sent.push(args);
    },
  };
}
