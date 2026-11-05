// check-file-write-safety.mjs 的类型声明(为 apps/cli 镜像测试提供真实类型,消除 TS7016)。
// 只声明测试实际消费的成员:__test__ 与其中被 import 的两项;其余导出未在此列出。

export const EXIT_MODULE: string
export const TOOL_MODULE: string
export const BARE_WRITE_APIS: readonly string[]
export const WORKSPACE_GATE_SYMBOL: string
export const REQUIRED_EXIT_EXPORTS: readonly string[]
export const FAULT_INJECTION_MODULE: string
export const EXIT_IMPORT_RE: RegExp

export function maskComments(src: string): string[]
export function maskCommentsAndStrings(src: string): string[]

export const __test__: {
  EXIT_MODULE: string
  TOOL_MODULE: string
  BARE_WRITE_APIS: readonly string[]
  WORKSPACE_GATE_SYMBOL: string
  REQUIRED_EXIT_EXPORTS: readonly string[]
  FAULT_INJECTION_MODULE: string
  EXIT_IMPORT_RE: RegExp
  maskComments(src: string): string[]
  maskCommentsAndStrings(src: string): string[]
  analyzeFile(
    rel: string,
    text: string | null,
  ): {
    rel: string
    present: boolean
    bareWrites: Array<{ line: number; api: string; text: string }>
    usesWorkspaceWriteGate: boolean
    importsAtomicExit: boolean
    callsCommitAtomic: number
    callsCaptureBaseline: number
    exports: Record<string, boolean>
  }
}
