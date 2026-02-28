import { describe, it, expect } from "vitest";

// Simulate consuming specific paths through dynamic imports
// In a real project with node environment, Vitest uses ESM
describe("Tree shaking and explicit exports", () => {
  it("deriveConfigPda can be imported from pda submodule", async () => {
    const pdaSdk = await import("../src/pda");
    expect(typeof pdaSdk.deriveConfigPda).toBe("function");
  });

  it("Presets can be imported from types submodule", async () => {
    const typesSdk = await import("../src/types");
    expect(typesSdk.Presets).toBeDefined();
    expect(typesSdk.Presets.SSS_1).toBe("sss-1");
  });
  
  it("Client is not required when importing types", async () => {
    const typesSdk = await import("../src/types");
    expect((typesSdk as any).SSS).toBeUndefined();
  });
});
