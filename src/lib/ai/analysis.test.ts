import { afterEach, describe, expect, it, vi } from "vitest";
import { deterministicAnalysis, optionalAI, type Analysis } from "./analysis";

const source = deterministicAnalysis(
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC", price: 42_000, change24h: 1.5 },
  "2025-01-01T00:00:00.000Z",
  { rsi: 51, sma20: 41_000, atr: 900 },
);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("optional AI boundary", () => {
  it("requires a free model id and never makes an unconfigured request", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-only");
    vi.stubEnv("OPENROUTER_FREE_MODEL", "provider/model");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(optionalAI(source)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves authoritative facts, timestamps and calculations from validated input", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-only");
    vi.stubEnv("OPENROUTER_FREE_MODEL", "provider/model:free");
    const generated: Analysis = {
      ...source,
      summary: "A generated explanation.",
      observedFacts: ["fabricated observation"],
      calculatedIndicators: [{ name: "RSI", value: "0" }],
      evidenceReferences: ["invented source"],
      limitations: ["omitted caution"],
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(generated) } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await optionalAI(source);
    expect(result?.summary).toBe("A generated explanation.");
    expect(result?.observedFacts).toEqual(source.observedFacts);
    expect(result?.calculatedIndicators).toEqual(source.calculatedIndicators);
    expect(result?.evidenceReferences).toEqual(source.evidenceReferences);
    expect(result?.limitations).toEqual(source.limitations);
  });
});
