import { describe, expect, it } from "vitest";
import { createLocalSession, hashPassword, readLocalSession, verifyPassword } from "./localAuth";

describe("local credential authentication", () => {
  it("stores passwords as salted hashes and verifies only the correct password", async () => {
    const hash = await hashPassword("StrongPass123");
    expect(hash).not.toContain("StrongPass123");
    expect(await verifyPassword("StrongPass123", hash)).toBe(true);
    expect(await verifyPassword("WrongPass123", hash)).toBe(false);
  });

  it("creates a signed session that resolves only to its original local user", async () => {
    const token = await createLocalSession(314);
    expect(await readLocalSession(token)).toBe(314);
    expect(await readLocalSession(`${token}modified`)).toBeNull();
  });
});
