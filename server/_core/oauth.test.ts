import { describe, expect, it, vi } from "vitest";
import { COOKIE_NAME, OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

const mocks = vi.hoisted(() => ({
  linkOAuthUser: vi.fn(), exchangeCodeForToken: vi.fn(), getUserInfo: vi.fn(), createSessionToken: vi.fn(),
}));

vi.mock("../db", () => ({ linkOAuthUser: mocks.linkOAuthUser }));
vi.mock("./sdk", () => ({ sdk: { exchangeCodeForToken: mocks.exchangeCodeForToken, getUserInfo: mocks.getUserInfo, createSessionToken: mocks.createSessionToken } }));

import { registerOAuthRoutes } from "./oauth";

describe("OAuth callback", () => {
  it("links the Google identity through the existing-email-safe path and starts a session", async () => {
    let handler: any;
    registerOAuthRoutes({ get: vi.fn((_path: string, registered: any) => { handler = registered; }) } as any);
    const nonce = "verified-nonce";
    const state = encodeOAuthState({ redirectUri: "https://example.test/api/oauth/callback", nonce });
    mocks.exchangeCodeForToken.mockResolvedValue({ accessToken: "access-token" });
    mocks.getUserInfo.mockResolvedValue({ openId: "google-open-id", email: "muhammaddanyal4545@gmail.com", emailVerified: true, name: "Danyal", loginMethod: "google" });
    mocks.createSessionToken.mockResolvedValue("oauth-session");
    const res = { clearCookie: vi.fn(), cookie: vi.fn(), redirect: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler({ query: { code: "code", state }, headers: { cookie: `${OAUTH_STATE_COOKIE}=${nonce}` }, protocol: "https" }, res);
    expect(mocks.linkOAuthUser).toHaveBeenCalledWith(expect.objectContaining({ openId: "google-open-id", email: "muhammaddanyal4545@gmail.com", emailVerified: true }));
    expect(res.cookie).toHaveBeenCalledWith(COOKIE_NAME, "oauth-session", expect.objectContaining({ httpOnly: true }));
    expect(res.redirect).toHaveBeenCalledWith(302, "/");
  });
});
