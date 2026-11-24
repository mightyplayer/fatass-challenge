import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "./config";

// Telegram Login через OpenID Connect (Authorization Code + PKCE).
// Документация: https://core.telegram.org/bots/telegram-login
const ISSUER = "https://oauth.telegram.org";
const AUTH_URL = `${ISSUER}/auth`;
const TOKEN_URL = `${ISSUER}/token`;
const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

export const redirectUri = () => `${config.appUrl}/api/auth/telegram/callback`;

function b64url(buf: ArrayBuffer | Uint8Array) {
  return Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64url");
}

export function randomToken(bytes = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(digest);
}

export async function buildAuthorizeUrl(state: string, verifier: string) {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: config.telegram.clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid profile",
    state,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

export type TelegramProfile = {
  telegramId: bigint;
  name: string;
  username?: string;
  avatarUrl?: string;
};

export async function exchangeCode(code: string, verifier: string): Promise<TelegramProfile> {
  const { clientId, clientSecret } = config.telegram;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: clientId,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Telegram token endpoint: ${res.status} ${await res.text()}`);
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new Error("Telegram не вернул id_token");

  const { payload } = await jwtVerify(id_token, jwks, { issuer: ISSUER, audience: clientId });
  const claims = payload as Record<string, unknown>;
  const id = claims.id ?? claims.sub;
  if (id === undefined) throw new Error("В id_token нет идентификатора пользователя");

  return {
    telegramId: BigInt(String(id)),
    name: String(claims.name ?? claims.preferred_username ?? "Без имени"),
    username: claims.preferred_username ? String(claims.preferred_username) : undefined,
    avatarUrl: claims.picture ? String(claims.picture) : undefined,
  };
}
