#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * face-empty-guard.mjs —— 「空输入即未判定」的唯一判定 helper(2026-11-07)
 *
 * 病根:`枚举结果 = 0` / `读取结果全 null` 被当成"确实没有",于是门在**没读到任何东西**时
 * 判绿或判死。2026-11-07 的真实事故:
 *   · check-guarded-write-affected.mjs `::path` ⇒ 1411 个文件全取不到,门跑了但从未判过;
 *   · check-generator-resource-release.mjs:702 staged 面 12 个路径正文全取不到 ⇒ exit 2;
 *   · check-live-doc-duplicates.mjs --staged 把被审文档枚举成 0 份 ⇒ 判死;
 *   · check-rn-compat-coverage.mjs C10 逐文件读取失败被当成"文件不存在" ⇒ 闭包缩水。
 *
 * 口径(可复用,新门一律走这里,别再各写一份):
 *   · `count === 0` 且 `emptyIsReal !== true` ⇒ 抛 `FaceInputUnavailable`("取数面不可用");
 *   · `requested > 0` 且可读 `readable === 0` ⇒ 同上;
 *   · 只有调用方**显式声明**"这个面上确实可以没有"(如首次新增文件在 HEAD 面确实不存在)
 *     才允许 `emptyIsReal: true`,并把理由写进 `reason`(供报告原文打印,禁止口头豁免)。
 *
 * 注意:本 helper **不判"哪些缺失是合法的"** —— 那是语义判断(见防线文档 §4);
 * 它只拒绝"0 当成结论"这一种静默失败。
 */

import { maskCommentsKeepLayout } from './face-spec-scan.mjs'

export class FaceInputUnavailable extends Error {
  constructor(message, info = {}) {
    super(message)
    this.name = 'FaceInputUnavailable'
    this.code = 'FACE_INPUT_UNAVAILABLE'
    this.face = info.face ?? null
    this.stage = info.stage ?? null
    this.count = info.count ?? null
  }
}

function label(info) {
  return `${info.face ?? '未知面'}${info.stage ? `/${info.stage}` : ''}`
}

/**
 * 枚举面保护:0 条且未显式声明"确实没有" ⇒ 抛错。
 * @param {{face:string, stage?:string, count:number, emptyIsReal?:boolean, reason?:string}} arg
 */
export function assertFaceEnumeration({ face, stage = '', count, emptyIsReal = false, reason = '' }) {
  if (!Number.isInteger(count) || count < 0) {
    throw new FaceInputUnavailable(`取数面不可用:${label({ face, stage })} 枚举计数非法(${String(count)})`, { face, stage, count })
  }
  if (count === 0) {
    if (emptyIsReal !== true) {
      throw new FaceInputUnavailable(
        `取数面不可用:${label({ face, stage })} 枚举到 0 条,且未声明"确实没有"(禁止把空输入当成空结论)`,
        { face, stage, count },
      )
    }
    if (!reason) {
      throw new FaceInputUnavailable(
        `未判定:${label({ face, stage })} 声明 emptyIsReal 但未给 reason(口头豁免不算证据)`,
        { face, stage, count },
      )
    }
    return { ok: true, empty: true, reason }
  }
  return { ok: true, empty: false, reason: '' }
}

/**
 * 读取面保护:要求读了 requested 条,实际可读 0 条 ⇒ 抛错(逐条 null 的合法缺失不在此列)。
 * @param {{face:string, stage?:string, requested:number, readable:number, emptyIsReal?:boolean, reason?:string}} arg
 */
export function assertFaceRead({ face, stage = '', requested, readable, emptyIsReal = false, reason = '' }) {
  if (!Number.isInteger(requested) || requested < 0 || !Number.isInteger(readable) || readable < 0) {
    throw new FaceInputUnavailable(`取数面不可用:${label({ face, stage })} 读取计数非法`, { face, stage })
  }
  if (requested === 0) return assertFaceEnumeration({ face, stage, count: 0, emptyIsReal, reason })
  if (readable === 0) {
    throw new FaceInputUnavailable(
      `取数面不可用:${label({ face, stage })} 请求 ${requested} 个路径,正文全部取不到(不得当成"文件不存在")`,
      { face, stage, count: requested },
    )
  }
  return { ok: true, empty: false, reason: '' }
}

/** 未判定出口:统一文案,返回 exit code 2(调用方 `process.exit(undeterminedExit(e))`)。 */
export function undeterminedExit(err, log = console.error) {
  log(`未判定:${err?.message ?? err}`)
  return 2
}

/**
 * 只读静态分类(供 `check-face-empty-guard-coverage.mjs` 与测试共用):
 * 判断一个门源码是否"有三面旗 / 有枚举 / 有零值判定 / 零值旁边有 exit 2 或未判定出口"。
 * 这是**启发式盘点**,不是语义证明 —— 结论必须按 `verdict` 原文展示,不得当成绿灯依据。
 */
export function classifyFaceGateSource(src) {
  if (typeof src !== 'string' || src.length === 0) {
    return { verdict: 'not-face-gate', reason: '空源码' }
  }
  const code = maskCommentsKeepLayout(src)
  const faceFlag = /\B--(?:staged|worktree|head)\b/.test(code)
  if (!faceFlag) return { verdict: 'not-face-gate', reason: '无三面旗' }

  const enumerates = /listFaceFiles|readFaceBatch|readFaceOne|catBatch|ls-files|ls-tree|git\s+grep|readdirSync|readdir\(/.test(code)
  if (!enumerates) return { verdict: 'no-enumeration', reason: '有三面旗但未见批量枚举' }

  // 统一 helper 的调用点就是标准保护:0 值判定在 helper 内部,门里不会出现字面 `=== 0`。
  if (/assertFaceEnumeration|assertFaceRead/.test(code)) {
    return { verdict: 'guarded', reason: '走统一 helper(assertFaceEnumeration/assertFaceRead)' }
  }

  const lines = code.split('\n')
  const zeroLine = /===\s*0|\.length\s*===\s*0|length\s*===\s*0/
  const guard = /exit\s*\(\s*2\s*\)|EXIT_UNKNOWN|EXIT_UNDETERMINED|未判定|取数面不可用|取数面|判据无对象|Undetermined/
  const zeroIdx = []
  lines.forEach((l, i) => {
    if (zeroLine.test(l)) zeroIdx.push(i)
  })
  if (zeroIdx.length === 0) return { verdict: 'no-zero-check', reason: '有枚举但未见 0 值判定' }

  let guarded = false
  for (const i of zeroIdx) {
    const from = Math.max(0, i - 12)
    const to = Math.min(lines.length, i + 13)
    if (guard.test(lines.slice(from, to).join('\n'))) {
      guarded = true
      break
    }
  }
  return guarded
    ? { verdict: 'guarded', reason: '零值邻域内见到 exit 2 / 未判定出口' }
    : { verdict: 'missing-guard', reason: '有 0 值判定但邻域内没有 exit 2 / 未判定出口' }
}

export const __test__ = { classifyFaceGateSource, assertFaceEnumeration, assertFaceRead }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
