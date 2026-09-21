// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 代码块一键运行(对标 Codex/Trae 对话内运行回显,P1 #28)。
 *
 * 复用既有的沙箱执行链路:`@ihui/api-client` 的 `executeSandbox`
 * (→ POST /api/workspace/sandbox/execute → server 端 sandboxExecutor)。
 * 该 API 仅需 `workspacePath`(无需 conversationId/messageId),
 * 故直接复用 apply-code-block.ts 同款的 store 取值路径
 * (`useAiPanelStore` / `useIDEWorkspace`),不破坏 CodeBlock 既有 props 链、不引入新 Context。
 *
 * 安全边界(sandboxExecutor 白名单):仅允许 node / python3 / npx 等二进制,且拒绝 shell 元字符。
 * 因此片段需物化到临时文件后执行(JS→node <file>、TS→npx tsx <file>、Python→python3 <file>)。
 * bash/sh 虽在「可运行语言集合」内(按钮照常展示),但沙箱白名单未含 shell 二进制,
 * 运行时会由沙箱返回「命令不在白名单内」错误(安全边界生效,见报告遗留问题)。
 *
 * 只导出纯逻辑与 hook,不在此文件写 JSX(markdown-stream.tsx 负责渲染运行按钮与输出面板)。
 */

import * as React from 'react'
import { executeSandbox } from '@ihui/api-client'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { resolveWorkspaceDirectoryHandle } from '@/lib/workspace-file-save'
import { executeWorkspaceTool } from '@/lib/workspace-tool-executor'

/** 运行结果状态机 */
export type RunStatus = 'idle' | 'running' | 'success' | 'error'

/** 一次运行的输出快照 */
export interface RunResult {
  status: RunStatus
  /** 实际下发给沙箱的命令(含临时文件名) */
  command: string
  /** 合并后的 stdout/stderr */
  output: string
  /** 退出码;running/idle 时为 null */
  exitCode: number | null
}

/** 可运行语言归一化集合(含别名) */
export const RUNNABLE_LANGS: ReadonlySet<string> = new Set<string>([
  // JavaScript 家族(降级 node / tsx)
  'js',
  'javascript',
  'jsx',
  'mjs',
  'cjs',
  'ts',
  'typescript',
  'tsx',
  // Python 家族
  'py',
  'python',
  'python3',
  // Shell 家族(bash/sh 在沙箱白名单外,运行时由沙箱拦截)
  'bash',
  'sh',
  'shell',
  'zsh',
])

function normalizeLang(lang?: string): string {
  return (lang ?? '').trim().toLowerCase()
}

/** 判定某语言是否展示「运行」按钮 */
export function isRunnableLanguage(lang?: string): boolean {
  return RUNNABLE_LANGS.has(normalizeLang(lang))
}

/** 临时文件扩展名(按语言) */
const LANG_EXT: Record<string, string> = {
  js: 'mjs',
  javascript: 'mjs',
  jsx: 'mjs',
  mjs: 'mjs',
  cjs: 'cjs',
  ts: 'ts',
  typescript: 'ts',
  tsx: 'tsx',
  py: 'py',
  python: 'py',
  python3: 'py',
  bash: 'sh',
  sh: 'sh',
  shell: 'sh',
  zsh: 'sh',
}

/** 执行二进制(JS/TS/Python 走白名单内二进制;Shell 走 bash,会被沙箱白名单拦截) */
const LANG_BINARY: Record<string, string> = {
  js: 'node',
  javascript: 'node',
  jsx: 'node',
  mjs: 'node',
  cjs: 'node',
  ts: 'npx tsx',
  typescript: 'npx tsx',
  tsx: 'npx tsx',
  py: 'python3',
  python: 'python3',
  python3: 'python3',
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
}

/** 简单确定性哈希(用于生成稳定临时文件名,便于单测断言) */
function hashString(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

/** 执行计划:命令 + 工作区内相对路径(供沙箱 cwd 解析) */
export interface ExecPlan {
  command: string
  relPath: string
}

/**
 * 纯函数:根据语言与片段构造沙箱执行命令。
 * 片段物化到 `<workspace>/.ihui-run/ihui-snippet-<hash>.<ext>`,再交给白名单二进制执行。
 * 命令不含 shell 元字符(只有 <binary> + 相对路径),可通过 sandboxExecutor 的 parseShellCommand。
 */
export function buildExecPlan(language: string, code: string): ExecPlan {
  const lang = normalizeLang(language)
  const ext = LANG_EXT[lang] ?? 'txt'
  const binary = LANG_BINARY[lang] ?? 'node'
  const file = `.ihui-run/ihui-snippet-${hashString(code)}.${ext}`
  return { command: `${binary} ${file}`, relPath: file }
}

/** 解析当前活动工作区路径(与 applyCodeBlockToFile 同款降级顺序) */
function resolveWorkspacePath(): string | null {
  const aiWs = useAiPanelStore.getState().activeWorkspace?.path
  if (aiWs) return aiWs
  const ideWs = useIDEWorkspace.getState().workspacePath
  return ideWs || null
}

/** useCodeBlockRun 返回值 */
export interface UseCodeBlockRun {
  result: RunResult | null
  run: (params: { language: string; code: string }) => Promise<void>
  clear: () => void
}

/**
 * 代码块运行 hook:封装「物化临时文件 → 调 executeSandbox → 归一化结果」全流程。
 *
 * @returns result 当前运行状态;run 触发一次运行;clear 关闭输出面板。
 */
export function useCodeBlockRun(): UseCodeBlockRun {
  const [result, setResult] = React.useState<RunResult | null>(null)

  const clear = React.useCallback(() => setResult(null), [])

  const run = React.useCallback(
    async (params: { language: string; code: string }): Promise<void> => {
      const { language, code } = params

      if (!isRunnableLanguage(language)) {
        setResult({
          status: 'error',
          command: '',
          output: '当前语言暂不支持一键运行',
          exitCode: null,
        })
        return
      }

      const workspacePath = resolveWorkspacePath()
      if (!workspacePath) {
        setResult({
          status: 'error',
          command: '',
          output: '未绑定工作区，无法运行代码块',
          exitCode: null,
        })
        return
      }

      const plan = buildExecPlan(language, code)
      setResult({ status: 'running', command: plan.command, output: '', exitCode: null })

      try {
        // 物化片段到工作区临时文件(桌面端 browser FSA 与本地 server 共盘时有效;
        // 纯 Web 端无 FSA handle 时跳过,沙箱将返回「文件不存在」,由输出面板如实展示)。
        const handle = resolveWorkspaceDirectoryHandle()
        if (handle) {
          await executeWorkspaceTool('write_file', { path: plan.relPath, content: code }, handle)
        }

        const res = await executeSandbox({
          command: plan.command,
          workspacePath,
          mode: 'workspace-write',
          timeoutMs: 30000,
        })

        if (!res.success || !res.data) {
          setResult({
            status: 'error',
            command: plan.command,
            output: res.error ?? '执行请求失败',
            exitCode: null,
          })
          return
        }

        const { stdout, stderr, exitCode } = res.data
        const merged = [stdout, stderr].filter((s) => s && s.length > 0).join('\n')
        setResult({
          status: exitCode === 0 ? 'success' : 'error',
          command: plan.command,
          output: merged,
          exitCode,
        })
      } catch (e) {
        setResult({
          status: 'error',
          command: plan.command,
          output: e instanceof Error ? e.message : String(e),
          exitCode: null,
        })
      }
    },
    [],
  )

  return { result, run, clear }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
