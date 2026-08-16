import { parse } from "yaml";
import { PolicyConfigSchema, type PolicyConfig } from "@clauseguard/schemas";

export function parsePolicyConfig(yamlText: string): PolicyConfig {
  const raw = parse(yamlText);
  return PolicyConfigSchema.parse(raw);
}
