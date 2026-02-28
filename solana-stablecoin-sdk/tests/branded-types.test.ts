import { describe, it, expect } from "vitest";
import { preset, roleType, roleId, Presets, ROLE_MAP } from "../src/types";

describe("Branded types", () => {
  it("preset factory returns correct string", () => {
    const val = preset("sss-1");
    expect(val).toBe("sss-1");
  });

  it("roleType factory returns correct string", () => {
    const val = roleType("admin");
    expect(val).toBe("admin");
  });

  it("roleId factory returns correct number", () => {
    const val = roleId(0);
    expect(val).toBe(0);
  });

  it("ROLE_MAP keys work at compile and runtime", () => {
    const roleMapVal = (ROLE_MAP as any)[roleType("admin")];
    expect(roleMapVal).toBe(0);
  });

  it("Presets object retains properties", () => {
    expect(Presets.SSS_1).toBe("sss-1");
    expect(Presets.SSS_2).toBe("sss-2");
    expect(Presets.SSS_3).toBe("sss-3");
  });
});
