import { describe, expect, it } from "vitest";
import { getSessionToken, hasSameOrigin } from "./session";

describe("request session boundaries", () => {
  it("reads only the exact opaque session cookie", () => {
    const request = new Request("http://127.0.0.1:3000/api", {
      headers: { cookie: "theme=dark; cia_session=AbCdEf0123456789_-AbCdEf0123456789_-AbCdEf0; other=value" },
    });
    expect(getSessionToken(request)).toBe("AbCdEf0123456789_-AbCdEf0123456789_-AbCdEf0");
    expect(getSessionToken(new Request("http://127.0.0.1:3000/api", { headers: { cookie: "not_cia_session=token" } }))).toBeNull();
    expect(getSessionToken(new Request("http://127.0.0.1:3000/api", { headers: { cookie: "cia_session=short" } }))).toBeNull();
  });

  it("requires an exact same-origin value on state-changing requests", () => {
    const sameOrigin = new Request("http://127.0.0.1:3000/api/auth/setup", { method: "POST", headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" } });
    const foreignOrigin = new Request("http://127.0.0.1:3000/api/auth/setup", { method: "POST", headers: { origin: "https://attacker.example", host: "127.0.0.1:3000" } });
    const missingOrigin = new Request("http://127.0.0.1:3000/api/auth/setup", { method: "POST" });
    expect(hasSameOrigin(sameOrigin)).toBe(true);
    expect(hasSameOrigin(foreignOrigin)).toBe(false);
    expect(hasSameOrigin(missingOrigin)).toBe(false);
  });
});
