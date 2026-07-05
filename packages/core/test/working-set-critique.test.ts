/**
 * Faz 4.2 — working-set.ts'in zorunlu critique için eklenen fonksiyonları:
 * markCritiqueRequired / resolveCritiqueRequired / recordLinesChangedForCritique.
 */
import { describe, it, expect, afterEach } from "bun:test"
import {
  markCritiqueRequired,
  resolveCritiqueRequired,
  recordLinesChangedForCritique,
  getWorkingSetSnapshot,
  clearWorkingSet,
} from "../src/agent/working-set.js"

const SID = "critique-test-session"

afterEach(() => {
  clearWorkingSet(SID)
})

describe("markCritiqueRequired / resolveCritiqueRequired", () => {
  it("pending bir critique item'ı oluşturur", () => {
    const snapshot = markCritiqueRequired(SID, ["src/a.ts"], 80)
    const critique = snapshot.items.find(i => i.kind === "critique")
    expect(critique?.status).toBe("active")
    expect(critique?.label).toContain("80")
    expect(critique?.label).toContain("src/a.ts")
  })

  it("resolveCritiqueRequired pending item'ı resolved yapar", () => {
    markCritiqueRequired(SID, ["src/a.ts"], 80)
    const snapshot = resolveCritiqueRequired(SID)
    const critique = snapshot.items.find(i => i.kind === "critique")
    expect(critique?.status).toBe("resolved")
  })

  it("resolveCritiqueRequired hiç pending item yokken crash etmez", () => {
    expect(() => resolveCritiqueRequired(SID)).not.toThrow()
    expect(getWorkingSetSnapshot(SID).items.find(i => i.kind === "critique")).toBeUndefined()
  })

  it("tekrar markCritiqueRequired çağrısı aynı id'yi günceller, çoğaltmaz", () => {
    markCritiqueRequired(SID, ["src/a.ts"], 60)
    markCritiqueRequired(SID, ["src/b.ts"], 90)
    const critiqueItems = getWorkingSetSnapshot(SID).items.filter(i => i.kind === "critique")
    expect(critiqueItems.length).toBe(1)
    expect(critiqueItems[0]!.label).toContain("90")
  })
})

describe("recordLinesChangedForCritique — session bazlı birikim", () => {
  it("eşiğin altında kalan tek bir çağrı critique tetiklemez", () => {
    recordLinesChangedForCritique(SID, ["src/a.ts"], 10, 50)
    expect(getWorkingSetSnapshot(SID).items.find(i => i.kind === "critique")).toBeUndefined()
  })

  it("birden fazla küçük değişiklik toplamda eşiği aşınca critique tetiklenir", () => {
    recordLinesChangedForCritique(SID, ["src/a.ts"], 20, 50)
    recordLinesChangedForCritique(SID, ["src/b.ts"], 20, 50)
    expect(getWorkingSetSnapshot(SID).items.find(i => i.kind === "critique")).toBeUndefined()
    recordLinesChangedForCritique(SID, ["src/c.ts"], 15, 50)
    const critique = getWorkingSetSnapshot(SID).items.find(i => i.kind === "critique")
    expect(critique?.status).toBe("active")
  })

  it("eşik aşıldıktan sonra sayaç sıfırlanır — hemen ardından yeni birikim baştan başlar", () => {
    recordLinesChangedForCritique(SID, ["src/a.ts"], 60, 50) // tetikler, sıfırlar
    resolveCritiqueRequired(SID) // model critique çalıştırdı, kapandı

    recordLinesChangedForCritique(SID, ["src/b.ts"], 10, 50) // eşiğin altında, yeniden tetiklemez
    const critique = getWorkingSetSnapshot(SID).items.find(i => i.kind === "critique")
    expect(critique?.status).toBe("resolved")
  })

  it("tek büyük bir değişiklik (eşiğin üstünde) tek başına tetikler", () => {
    recordLinesChangedForCritique(SID, ["src/a.ts"], 200, 50)
    const critique = getWorkingSetSnapshot(SID).items.find(i => i.kind === "critique")
    expect(critique?.status).toBe("active")
    expect(critique?.label).toContain("200")
  })

  it("negatif veya sıfır linesChanged crash etmez, hiçbir şey tetiklemez", () => {
    expect(() => recordLinesChangedForCritique(SID, [], 0, 50)).not.toThrow()
    expect(() => recordLinesChangedForCritique(SID, [], -5, 50)).not.toThrow()
    expect(getWorkingSetSnapshot(SID).items.find(i => i.kind === "critique")).toBeUndefined()
  })
})
