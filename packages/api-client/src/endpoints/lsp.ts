// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * LSP 四核心端点(2026-09-07 立,Web IDE 深度接线)。
 *
 * 后端:apps/ai-service/app/api/v1/lsp.py(prefix /lsp,经 web 以 /api/lsp 暴露):
 *  - POST /lsp/definition
 *  - POST /lsp/references
 *  - POST /lsp/diagnostics
 *  - POST /lsp/hover
 */

import type { ApiResult } from '@ihui/types'
import { fetchApi } from '../client'

export interface LspPositionInput {
  workspacePath: string
  file: string
  line: number
  column: number
}

export interface LspFileInput {
  workspacePath: string
  file: string
}

export interface LspReferencesInput extends LspPositionInput {
  includeDeclaration?: boolean
}

export interface LspRange {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}

export interface LspLocation {
  file: string
  line: number
  column: number
  endLine: number
  endColumn: number
  text?: string
}

export interface LspDefinitionResult {
  count: number
  locations: LspLocation[]
}

export interface LspReferencesResult {
  count: number
  locations: LspLocation[]
  includeDeclaration: boolean
}

export interface LspDiagnostic {
  line: number
  column: number
  endLine?: number
  endColumn?: number
  severity: string
  message: string
  source?: string
  code?: string | number
}

export interface LspDiagnosticsResult {
  count: number
  errors: number
  warnings: number
  diagnostics: LspDiagnostic[]
}

export interface LspHoverResult {
  hover: string
  raw?: unknown
}

export function getLspDefinition(input: LspPositionInput): Promise<ApiResult<LspDefinitionResult>> {
  return fetchApi<LspDefinitionResult>('/lsp/definition', {
    method: 'POST',
    body: JSON.stringify(input),
    timeoutMs: 12_000,
  })
}

export function getLspReferences(
  input: LspReferencesInput,
): Promise<ApiResult<LspReferencesResult>> {
  return fetchApi<LspReferencesResult>('/lsp/references', {
    method: 'POST',
    body: JSON.stringify(input),
    timeoutMs: 12_000,
  })
}

export function getLspDiagnostics(input: LspFileInput): Promise<ApiResult<LspDiagnosticsResult>> {
  return fetchApi<LspDiagnosticsResult>('/lsp/diagnostics', {
    method: 'POST',
    body: JSON.stringify(input),
    timeoutMs: 12_000,
  })
}

export function getLspHover(input: LspPositionInput): Promise<ApiResult<LspHoverResult>> {
  return fetchApi<LspHoverResult>('/lsp/hover', {
    method: 'POST',
    body: JSON.stringify(input),
    timeoutMs: 12_000,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
