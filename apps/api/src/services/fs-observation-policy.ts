// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 读前写保护（fs observation policy）— 工具层护栏，不碰 FS 原语。
 *
 * 对照取证：`@deepseek-ai/dsh-fs-observation-policy`（MIT，D:\DevEnv\dsh-ref）。
 * 对照语义：① 覆盖已存在文件之前必须在本会话观察过它（read-before-write）；
 * ② 观察记录存内容摘要，写入时与磁盘现值比对，不一致 ⇒ 过期版本拒绝；
 * ③ 观察态只在进程内存里，不跨会话持久（续跑一律先读）。
 *
 * 本仓为什么只在工具层加：`FSBridge.write` 是内部写盘原语（apply-diff 路由、
 * 配置落盘、检查点都在用），在那一层加护栏会把内部写盘一起拦死。
 *
 * 超越对照的一轴：观察表按「绝对路径 + 内容摘要」双键归一（Windows 大小写不敏感），
 * 且拒绝时返回结构化错误码 + 可执行补救，模型可据此自行重试，而不是拿到一句
 * 无出路的字符串。
 */

import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

export const FS_NOT_OBSERVED = 'FS_NOT_OBSERVED' as const
export const FS_STALE_VERSION = 'FS_STALE_VERSION' as const

export type FsDenialCode = typeof FS_NOT_OBSERVED | typeof FS_STALE_VERSION

export interface FsWriteDenial {
  ok: false
  code: FsDenialCode
  error: string
  remedy: string
}

type Observation = { state: 'present'; hash: string } | { state: 'absent' }

/** 观察表键：绝对路径归一 + Windows 大小写折叠（同一文件只能一把尺子）。 */
export function observationKey(filePath: string): string {
  const abs = resolve(filePath)
  return process.platform === 'win32' ? abs.toLowerCase() : abs
}

export function contentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

const REMEDY_NOT_OBSERVED =
  '先用 read_file 读一次该文件（拿到当前内容），再决定怎么改；新建文件不需要先读。'
const REMEDY_STALE =
  '磁盘内容与上次读到的不同：重新 read_file 一次，按最新内容重写，不要用旧内存里的版本覆盖。'

function denial(code: FsDenialCode): FsWriteDenial {
  if (code === FS_NOT_OBSERVED) {
    return {
      ok: false,
      code,
      error: '目标文件已存在，但本次会话从未读取过它；拒绝盲写覆盖。',
      remedy: REMEDY_NOT_OBSERVED,
    }
  }
  return {
    ok: false,
    code,
    error: '目标文件在读取之后被改动过（内容摘要不一致）；拒绝用过期版本覆盖。',
    remedy: REMEDY_STALE,
  }
}

export class FsObservationStore {
  private readonly records = new Map<string, Observation>()

  observePresent(filePath: string, content: string): void {
    this.records.set(observationKey(filePath), {
      state: 'present',
      hash: contentHash(content),
    })
  }

  observeAbsent(filePath: string): void {
    this.records.set(observationKey(filePath), { state: 'absent' })
  }

  /** 仅用于测试与诊断：返回已归一化的观察态，不对外暴露内部表。 */
  inspect(filePath: string): Observation | undefined {
    return this.records.get(observationKey(filePath))
  }

  forget(filePath: string): void {
    this.records.delete(observationKey(filePath))
  }

  clear(): void {
    this.records.clear()
  }

  get size(): number {
    return this.records.size
  }

  /**
   * 写前判定。`currentContent` 为 null 表示磁盘上此刻不存在该文件。
   * 返回 null 表示放行；返回结构化拒绝则调用方必须放弃本次写入。
   */
  checkWrite(filePath: string, currentContent: string | null): FsWriteDenial | null {
    if (currentContent === null) {
      // 新建：观察不到任何旧内容，盲写无害
      return null
    }
    const record = this.records.get(observationKey(filePath))
    if (!record) return denial(FS_NOT_OBSERVED)
    // 上次确认「不存在」而现在存在 ⇒ 期间被别人创建，按过期版本处理
    if (record.state === 'absent') return denial(FS_STALE_VERSION)
    if (record.hash !== contentHash(currentContent)) return denial(FS_STALE_VERSION)
    return null
  }
}

/** 应急开关：`off` 关闭护栏（默认 enforce）。关闭只影响工具面，不影响内部写盘。 */
export function isFsObservationEnforced(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env['IHUI_FS_OBSERVATION_POLICY'] ?? 'enforce').toLowerCase() !== 'off'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
