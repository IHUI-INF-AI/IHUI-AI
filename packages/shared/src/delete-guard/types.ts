// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 删除保护链 — 共享判据层类型(纯判据、零平台 API)。
 *
 * 复现目标(goal-b49 W1-①,证据 `.ihui-agent/tmp/rea-goal-b49/` 引自
 * `docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/W1-workbuddy-main.md`
 * §2 表 #7/#9 与 §3 行 ①):对方自带回收站后端 + 批量删除两阶段护栏
 * (check/approve)、阈值、锁、重放、报告四件分离。
 * 本层只放判据与抽象(阈值判定 / 两阶段凭据 / 三态结论 / 回收站落点与恢复出口的形态校验),
 * 一切 IO(node:fs / node:crypto / 平台路径)留在端内 adapter(如 apps/cli 工具层),
 * 满足 AGENTS.md「shared 包非 Node 宿主纯度」可达闭包禁 `node:` 内建的约束。
 */

/** 三态结论:clean 放行 / blocked 需要 approve 相 / undetermined 未判定(§0.3,绝不记绿也绝不冒红) */
export type GuardVerdict = 'clean' | 'blocked' | 'undetermined'

/** 单个删除候选:path 为工作区相对路径(仅参与指纹,不做 IO);sizeBytes 取不到时为 null(不猜 0) */
export interface DeleteCandidate {
  readonly path: string
  readonly sizeBytes: number | null
}

/** check 相产出的扫描凭据:approve 相必须与"本次扫描结果"逐字节对账,而非口头保证 */
export interface BulkDeleteScanTicket {
  readonly kind: 'ihui.delete-guard.scan-ticket'
  readonly scanId: string
  /** digest(canonicalizeScan(candidates)) 的十六进制串 */
  readonly fingerprint: string
  readonly deleteCount: number
  readonly createdAtIso: string
}

/** 摘要函数注入点:端内实现(如 sha256 hex),本层不依赖任何平台件 */
export type DigestFn = (canonical: string) => string

/** 阈值判定结果(纯判据,不含 IO) */
export interface ThresholdDecision {
  readonly verdict: GuardVerdict
  readonly deleteCount: number
  readonly threshold: number
  /** 达到/超过阈值 ⇒ true,需要 approve 相凭据才可继续 */
  readonly requiresApproval: boolean
  readonly reason?: string
  /** 供人过目的样本路径(最多 sampleSize 条,且受 displayCap 截断) */
  readonly samples: readonly string[]
  readonly samplesTruncated: boolean
}

/** 两阶段护栏总判定:在阈值判定之上叠加 approve 相对账 */
export interface BulkDeleteDecision extends ThresholdDecision {
  /** blocked 时随结果下发给调用方的新签发凭据(approve 相须原样/按 scanId 重放回传) */
  readonly ticket?: BulkDeleteScanTicket
  /** approve 相对账通过 ⇒ true(端内据此决定是否落报告腿) */
  readonly approved?: boolean
}

/** 回收站条目形态:originalPath 为删除前的绝对路径原文,relativeTrashPath 相对回收站根 */
export interface TrashManifestEntry {
  readonly originalPath: string
  readonly relativeTrashPath: string
  readonly sizeBytes: number | null
  readonly kind: 'file' | 'directory'
}

/** 回收站清单形态(落点由端内 adapter 决定,本层只管结构与恢复出口的查找判据) */
export interface TrashManifest {
  readonly kind: 'ihui.delete-guard.trash-manifest'
  readonly trashId: string
  readonly createdAtIso: string
  readonly workspacePath: string
  readonly entries: readonly TrashManifestEntry[]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
