import { modeFromPath, MODES, type AppMode } from "@/lib/mode";

describe("modeFromPath", () => {
  it('returns "recruiting" for root /', () => {
    expect(modeFromPath("/")).toBe<AppMode>("recruiting");
  });

  it('returns "recruiting" for /workflow', () => {
    expect(modeFromPath("/workflow")).toBe<AppMode>("recruiting");
  });

  it('returns "recruiting" for /candidates', () => {
    expect(modeFromPath("/candidates")).toBe<AppMode>("recruiting");
  });

  it('returns "recruiting" for /dashboard', () => {
    expect(modeFromPath("/dashboard")).toBe<AppMode>("recruiting");
  });

  it('returns "recruiting" for /review/[id]', () => {
    expect(modeFromPath("/review/abc-123")).toBe<AppMode>("recruiting");
  });

  it('returns "general" for /general', () => {
    expect(modeFromPath("/general")).toBe<AppMode>("general");
  });

  it('returns "general" for nested /general routes', () => {
    expect(modeFromPath("/general/results/abc")).toBe<AppMode>("general");
  });
});

describe("MODES config", () => {
  it("defines exactly two modes", () => {
    expect(MODES).toHaveLength(2);
  });

  it("includes a recruiting mode", () => {
    expect(MODES.find((m) => m.id === "recruiting")).toBeDefined();
  });

  it("includes a general mode", () => {
    expect(MODES.find((m) => m.id === "general")).toBeDefined();
  });

  it("recruiting mode links to /workflow", () => {
    const m = MODES.find((m) => m.id === "recruiting");
    expect(m?.href).toBe("/workflow");
  });

  it("general mode links to /general", () => {
    const m = MODES.find((m) => m.id === "general");
    expect(m?.href).toBe("/general");
  });

  it("every mode has a non-empty label and description", () => {
    for (const m of MODES) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
    }
  });
});
