// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
/**
 * BUG-0015:测试面借用 `scripts/lib` 下的 tooling 模块(.mjs),它们没有也不该在
 * 被测仓里长出一份手写类型。这里用**通配模块声明**给出最小契约,替代此前
 * 36 条 `TS7016: 隐式 any`。
 *
 * 约束:
 * - 只声明测试实际用到的导出;新增用法请补在此处,不要退回 `any`。
 * - 这些声明只在 `tsconfig.tests.json` 的 include 内生效,不影响生产编译。
 */

declare module '*/scratch-dir.mjs' {
  /** scratch 落点目录名,全仓唯一一份(与实现同源)。 */
  export const SCRATCH_DIR_NAME: string
  export const NEST_SCAN_DEFAULTS: { maxDepth: number; entryBudget: number }
  /** scratch 根(绝对路径)。 */
  export function scratchRoot(): string
  /** 建一个带前缀的临时目录并返回绝对路径。 */
  export function mkScratch(prefix: string): string
  /** 递归删除 mkScratch 产出的目录;不存在时静默。 */
  export function rmScratch(dir: string, opts?: { force?: boolean }): void
}

declare module '*/check-file-write-safety.mjs' {
  export interface BareWriteFact {
    line: number
    api: string
    text: string
  }
  export interface FileWriteFacts {
    rel: string
    present: boolean
    bareWrites: BareWriteFact[]
    usesWorkspaceWriteGate: boolean
    inStateStoreSurface: boolean
    importsAtomicExit: boolean
    callsCommitAtomic: number
    callsCaptureBaseline: number
    exports: Record<string, boolean | number>
  }
  /** 守门自身的纯函数转手面(§22c:镜像测试必须 import 被判门体本身)。 */
  export const __test__: {
    analyzeFile(rel: string, text: string | null | undefined): FileWriteFacts
    maskComments(src: string): string[]
    maskCommentsAndStrings(src: string): string[]
  }
}
