// Shared utilities extracted from aliceAgent.ts
import { agentReadToolRegistry, type AgentReadToolName } from './agentToolRegistry'

export function cleanBaseUrl(value: string | undefined, fallback: string): string {
  return String(value || fallback).trim().replace(/\/+$/, '')
}

export function cleanAnswer(value: string): string {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim()
}

export function normalizedDecision(value: string): string {
  return value.replace(/[。！!，,、；;：:\s]/g, '').slice(0, 40)
}

export function isAgentReadToolName(value: string): value is AgentReadToolName {
  return Object.hasOwn(agentReadToolRegistry, value)
}

export function toJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function parseJsonObject(value: string): Record<string, unknown> {
  try { return toJsonObject(JSON.parse(value || '{}')) } catch { return {} }
}
