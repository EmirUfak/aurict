import { describe, expect, it } from "bun:test"
import { PUBLIC_PRODUCT_CATALOG } from "../src/marketing/public-catalog.js"
import { ProviderRegistry } from "../src/provider/registry.js"

describe("public product catalog", () => {
  it("keeps public provider facts aligned with the runtime registry", () => {
    const catalogIds = PUBLIC_PRODUCT_CATALOG.providers.map((provider) => provider.id).sort()
    const registryIds = ProviderRegistry.available().map((provider) => provider.id).sort()

    expect(catalogIds).toEqual(registryIds)
  })
})
