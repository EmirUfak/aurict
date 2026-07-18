import { AsyncLocalStorage } from "node:async_hooks"
import type { OmniConfig } from "../config/config.js"

const credentialScope = new AsyncLocalStorage<Readonly<Record<string, string>>>()

export const PROVIDER_CREDENTIAL_ENV: Readonly<Record<string, string>> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  opencode: "OPENCODE_API_KEY",
  xai: "XAI_API_KEY",
  azure: "AZURE_OPENAI_API_KEY",
  bedrock: "AWS_ACCESS_KEY_ID",
  nvidia: "NVIDIA_API_KEY",
  zai: "ZAI_API_KEY",
  alibaba: "DASHSCOPE_API_KEY",
}

export function providerEnvironmentFromConfig(config: OmniConfig): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [provider, envName] of Object.entries(PROVIDER_CREDENTIAL_ENV)) {
    const value = config.providers?.[provider]?.apiKey?.trim()
    if (value) env[envName] = value
  }
  return env
}

export function withProviderEnvironment<T>(environment: Readonly<Record<string, string>>, task: () => T): T {
  return credentialScope.run(environment, task)
}

export function providerEnv(name: string): string | undefined {
  return credentialScope.getStore()?.[name] ?? process.env[name]
}
