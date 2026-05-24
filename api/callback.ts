export const config = { runtime: "edge" };

const REDIRECT_URI = "https://spending-tracker-bramble.vercel.app/callback";
const TOKEN_URL = "https://auth.truelayer-sandbox.com/connect/token";
const APP_URL = "https://spending-tracker-bramble.vercel.app";

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return Response.redirect(`${APP_URL}/?tl_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return new Response("Missing auth code", { status: 400 });
  }

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.TRUELAYER_CLIENT_ID!,
      client_secret: process.env.TRUELAYER_CLIENT_SECRET!,
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error("Token exchange failed:", body);
    return Response.redirect(`${APP_URL}/?tl_error=token_exchange_failed`);
  }

  const { access_token, expires_in } = (await tokenRes.json()) as {
    access_token: string;
    expires_in: number;
  };

  const expiresAt = Date.now() + expires_in * 1000;

  return Response.redirect(
    `${APP_URL}/?tl_token=${encodeURIComponent(access_token)}&tl_expires=${expiresAt}`,
  );
}
