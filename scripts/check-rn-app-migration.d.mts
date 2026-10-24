// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `check-rn-app-migration.mjs` 的类型声明 —— 只覆盖"内存构造面、纯函数出结论"这一组导出。
 *
 * 为什么需要这份文件:迁移完整性判据只许有一份实现(§22c / 守门 118 同条),
 * 屏级测试要复用它就会撞 TS7016(JS 模块无声明文件 ⇒ 隐式 any);
 * 补声明是"消除各测试自己再抄一个扫描器"这条漂移路径的最小动作
 * (同一做法见 `scripts/lib/default-param-tautology.d.mts`、`code-mask.d.mts`)。
 * 只声明已被真实消费的成员;其余导出留白,下一个消费者按需补,不预先抄一遍门体签名。
 */

/** 白名单条目:豁免理由 + 存活期(到期即不再豁免)。 */
export interface RnAppMigrationWhitelistEntry {
  why: string
  /** ISO 日期(字典序比较) */
  expires: string
}

export interface RnAppMigrationScreen {
  /** 文件名,如 `CarteScreen.tsx` */
  name: string
  /** 被审面上该文件的正文(面由调用方选定,门体自己不读盘) */
  text: string
}

export interface RnAppMigrationVerdictHit {
  name: string
  /** V1 = 未 import @ihui/rn-app 且无有效豁免;V2 = 有 import 但共享层无同名屏 */
  code: string
  why: string
}

export interface RnAppMigrationVerdictInput {
  screens?: RnAppMigrationScreen[]
  baseline?: Map<string, string | null>
  sharedNames?: Set<string>
  baselineSharedNames?: Set<string> | null
  headScreenNames?: Set<string>
  whitelist?: Map<string, RnAppMigrationWhitelistEntry>
  today?: string
  fullAudit?: boolean
}

export interface RnAppMigrationVerdict {
  violations: RnAppMigrationVerdictHit[]
  soft: RnAppMigrationVerdictHit[]
  rot: Array<{ name: string; why: string }>
  expired: Array<{ name: string; expires: string }>
  counted: number
}

export declare function isoToday(): string

export declare function hasRnAppImport(text: string): boolean

export declare function stemOf(fileName: string): string

export declare function isExpired(entry: RnAppMigrationWhitelistEntry, today: string): boolean

export declare function verdict(input: RnAppMigrationVerdictInput): RnAppMigrationVerdict

export declare const WHITELIST_ENTRIES: Map<string, RnAppMigrationWhitelistEntry>

/** 镜像测试的单一入口(§22c:测试 import 源脚本 `__test__`,不得复制判据)。 */
export declare const __test__: {
  ROOT: string
  SCREENS_REL: string
  APP_REL: string
  WHITELIST: Set<string>
  WHITELIST_ENTRIES: Map<string, RnAppMigrationWhitelistEntry>
  isoToday: typeof isoToday
  isExpired: typeof isExpired
  hasRnAppImport: typeof hasRnAppImport
  stemOf: typeof stemOf
  sharedScreenNames: (o: { appFileRels?: string[]; indexText?: string }) => Set<string>
  verdict: typeof verdict
  pickFace: (staged: boolean, worktree: boolean) => unknown
  readFace: (
    face: string,
    rel: string,
    opt?: { changedOnly?: boolean },
  ) => { rels: string[]; texts: Map<string, string> }
  selfTest: () => unknown
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
