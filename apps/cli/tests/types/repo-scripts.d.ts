// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 测试面用到的仓根 `scripts/*.mjs` 的类型声明。
 *
 * 为什么需要:这些 `.mjs` 是纯 JS 且没有随行声明,测试 import 它们会在
 * `noImplicitAny` 下撞 TS7016。声明只覆盖测试真正取用的导出,不为"看起来完整"
 * 编造形状 —— 未列出的导出在本声明面里不可见,需要时再按真实实现补。
 *
 * 为什么住在 `apps/cli/tests` 而不是 `scripts/lib/`:`scripts/lib/` 属受保护面
 * (§12i immutable-guard),仅为测试侧的类型可见性去改判据库目录不划算;测试面的
 * 类型声明与测试同生命周期,放这里不产生跨端共享契约。
 */
declare module '*/scratch-dir.mjs' {
  /** 创建 scratch 夹具目录(§15b 唯一落点),返回目录路径。 */
  export function mkScratch(prefix: string): string
  /** 删除 scratch 夹具目录(带 §26 守卫)。 */
  export function rmScratch(dir: string, opts?: { guardDepth?: number }): void
}

declare module '*/check-file-write-safety.mjs' {
  export const __test__: {
    /** 遮掉注释,按行返回。 */
    maskComments(src: string): string[]
    /** 命中"原子写出口 import"的正则。 */
    EXIT_IMPORT_RE: RegExp
  }
}
