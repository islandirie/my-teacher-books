import { GOOGLE_CLIENT_ID, GOOGLE_DRIVE_FILE_SCOPE } from '../config';

export type TokenProvider = () => Promise<{
  accessToken: string;
  email?: string;
  expiresInSeconds: number;
}>;

/**
 * Thin client-side OAuth wrapper around Google Identity Services. Holds the
 * short-lived access token in memory (plus sessionStorage for tab reloads) and
 * exposes sign-in/sign-out without any token server. The real GIS-backed
 * provider is created by `createGoogleAuthService`; tests inject a fake.
 */
export class GoogleAuthService {
  private accessToken: string | null = null;
  private email: string | null = null;
  private expiresAt = 0;

  constructor(private readonly tokenProvider: TokenProvider) {
    this.restoreFromSession();
  }

  private restoreFromSession() {
    try {
      const token = sessionStorage.getItem('ll_google_token');
      const email = sessionStorage.getItem('ll_google_email');
      const expiresAt = Number(sessionStorage.getItem('ll_google_expires') || '0');
      if (token && expiresAt > Date.now()) {
        this.accessToken = token;
        this.email = email;
        this.expiresAt = expiresAt;
      }
    } catch {
      // sessionStorage unavailable; remain signed out
    }
  }

  private persist() {
    try {
      if (this.accessToken) {
        sessionStorage.setItem('ll_google_token', this.accessToken);
        sessionStorage.setItem('ll_google_email', this.email ?? '');
        sessionStorage.setItem('ll_google_expires', String(this.expiresAt));
      } else {
        sessionStorage.removeItem('ll_google_token');
        sessionStorage.removeItem('ll_google_email');
        sessionStorage.removeItem('ll_google_expires');
      }
    } catch {
      // sessionStorage unavailable; sign-in still works for this session
    }
  }

  async signIn(): Promise<{ email: string }> {
    const res = await this.tokenProvider();
    this.accessToken = res.accessToken;
    this.email = res.email ?? '';
    this.expiresAt = Date.now() + res.expiresInSeconds * 1000;
    this.persist();
    return { email: this.email };
  }

  signOut(): void {
    this.accessToken = null;
    this.email = null;
    this.expiresAt = 0;
    this.persist();
  }

  getAccessToken(): string | null {
    return this.isSignedIn() ? this.accessToken : null;
  }

  isSignedIn(): boolean {
    return Boolean(this.accessToken) && Date.now() < this.expiresAt;
  }
}

function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

/** Builds the real GIS-backed auth service, or null when no client id is configured. */
export async function createGoogleAuthService(): Promise<GoogleAuthService | null> {
  if (!GOOGLE_CLIENT_ID) return null;
  await loadGis();

  const provider: TokenProvider = () =>
    new Promise((resolve, reject) => {
      const g = window.google;
      if (!g) {
        reject(new Error('Google Identity Services not loaded'));
        return;
      }
      const client = g.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_FILE_SCOPE,
        callback: (resp) => {
          if (resp.error !== undefined) {
            reject(new Error(`Google sign-in failed: ${resp.error}`));
            return;
          }
          resolve({
            accessToken: resp.access_token,
            expiresInSeconds: Number(resp.expires_in) || 3600
          });
        }
      });
      client.requestAccessToken();
    });

  return new GoogleAuthService(provider);
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token: string; expires_in?: number; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}
