import { describe, expect, it } from "vitest";
import { can, PERMISSIONS, type Role } from "../rbac";

describe("RBAC matrix", () => {
  it("only collectors can create collections (admins cannot)", () => {
    expect(can("COLLECTOR", "collection:create")).toBe(true);
    expect(can("ADMIN", "collection:create" as never)).toBe(false);
    expect(can("CITIZEN", "collection:create" as never)).toBe(false);
  });
  it("only admins can reverse points or manage rewards", () => {
    for (const role of ["CITIZEN", "COLLECTOR"] as Role[]) {
      expect(can(role, "points:reverse" as never)).toBe(false);
      expect(can(role, "reward:manage" as never)).toBe(false);
    }
    expect(can("ADMIN", "points:reverse")).toBe(true);
  });
  it("citizens cannot see analytics or all households", () => {
    expect(can("CITIZEN", "analytics:read" as never)).toBe(false);
    expect(can("CITIZEN", "household:read:all" as never)).toBe(false);
  });
  it("collectors get no balance or analytics access", () => {
    expect(can("COLLECTOR", "points:read:all" as never)).toBe(false);
    expect(can("COLLECTOR", "analytics:read" as never)).toBe(false);
  });
  it("has no duplicate permissions per role", () => {
    for (const list of Object.values(PERMISSIONS)) {
      expect(new Set(list).size).toBe(list.length);
    }
  });
});
