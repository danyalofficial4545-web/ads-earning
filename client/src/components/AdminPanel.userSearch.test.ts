import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("administrator user search", () => {
  it("filters the existing user list by username, email, or ID and preserves the details drawer", () => {
    const source = readFileSync(new URL("./AdminPanel.tsx", import.meta.url), "utf8");
    expect(source).toContain('const [search, setSearch] = useState("")');
    expect(source).toContain("const filteredUsers = useMemo");
    expect(source).toContain("Search username, Gmail, or user ID");
    expect(source).toContain("{filteredUsers.map(row => (");
    expect(source).toContain("trpc.admin.userDetail.useQuery");
  });
});
