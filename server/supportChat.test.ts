import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("AI support system contracts", () => {
  it("persists user, assistant, and admin support messages", () => {
    const schema = read("drizzle/schema.ts");
    const migration = read("drizzle/0019_thin_layla_miller.sql");
    expect(schema).toContain("supportChatMessages");
    expect(schema).toContain('mysqlEnum("role", ["user", "assistant", "admin"])');
    expect(migration).toContain("CREATE TABLE `supportChatMessages`");
  });

  it("contains the requested support knowledge base and protected procedures", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("SUPPORT_KNOWLEDGE_BASE");
    expect(router).toContain("supportFallback");
    expect(router).toContain("chatHistory: protectedProcedure");
    expect(router).toContain("ask: protectedProcedure");
    expect(router).toContain("supportChats: protectedProcedure");
    expect(router).toContain("supportChatReply: protectedProcedure");
  });

  it("exposes the requested user and admin support surfaces", () => {
    const home = read("client/src/pages/Home.tsx");
    const admin = read("client/src/components/AdminPanel.tsx");
    const chat = read("client/src/components/SupportChat.tsx");
    const app = read("client/src/App.tsx");
    expect(home).toContain('location === "/support"');
    expect(app).toContain('<Route path={"/support"} component={Home} />');
    expect(home).toContain("SupportChat");
    expect(home).toContain("wa.me/923269337570");
    expect(admin).toContain('supportChats: "/admin/support"');
    expect(admin).toContain("trpc.admin.supportChats.useQuery");
    expect(chat).toContain("Withdrawal issue");
    expect(chat).toContain("trpc.support.ask.useMutation");
  });
});
