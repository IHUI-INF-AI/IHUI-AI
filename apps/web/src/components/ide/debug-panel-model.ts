// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import type { DebugVariable } from '@/lib/api/debug'

export type DebugState = 'stopped' | 'running' | 'paused'

export interface LocalVariable {
  name: string
  value: string
  type: string
  children?: LocalVariable[]
}

export interface Breakpoint {
  id: string
  file: string
  line: number
  enabled: boolean
}

export interface ConsoleLog {
  level: 'info' | 'log' | 'warn' | 'error'
  text: string
}

export const STATE_META: Record<DebugState, { labelKey: string; dot: string; text: string }> = {
  stopped: {
    labelKey: 'debug.stateStopped',
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
  },
  running: {
    labelKey: 'debug.stateRunning',
    dot: 'bg-green-500',
    text: 'text-green-600 dark:text-green-400',
  },
  paused: {
    labelKey: 'debug.statePaused',
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
  },
}

export const BREAKPOINTS_KEY = 'ide:breakpoints'
export const WATCHES_KEY = 'ide:watches'

export const LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
}

export function adaptVariable(variable: DebugVariable): LocalVariable {
  return {
    name: variable.name,
    value: variable.value,
    type: variable.type ?? 'string',
  }
}

export function getLanguageFromPath(path: string): string | undefined {
  const extension = path.split('.').pop()?.toLowerCase()
  return extension ? LANG_MAP[extension] : undefined
}
