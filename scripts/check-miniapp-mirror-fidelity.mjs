#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-miniapp-mirror-fidelity.mjs — 小程序镜像页「还原度」对账门(2026-10-25 立)。
 *
 * 为什么要有这件器物:跨端对齐的**声明链**已经有机判(coverage 的 R1 登记真实 / R3 镜像棘轮
 * / R4 下沉率棘轮、auto-register-cross-end 补声明),但**声明 ≠ 还原**——一个小程序页可以在
 * 首行写着「镜像 packages/app/src/features/x/YSc​​reen.tsx」,正文却只渲染两行文案,把共享屏
 * 的 40 个业务文案键丢掉 38 个。此刻所有门都是绿的:页存在、标记在、路由在册、词包有键,
 * 而用户看到的页面是个空壳。这是「对齐全绿、体验全无」型的缺口,此前**没有任何尺子能量它**。
 *
 * 实测动机(2026-10-25 现读):小程序端对 `packages/app/src/features` 的真实 import = **0 行**,
 * 123 处引用全是注释标记;38 个已标记镜像页全部经人工改写。也就是说「镜像」在今天只是声明,
 * 不是复用 —— 声明链再全也测不出还原度。本门就是把这个盲区变成可量化、可棘轮、可入账的一维。
 *
 * 判什么:
 *   对每一对 (共享屏 spec ↔ 小程序镜像页),取共享屏消费的**业务 i18n 键集**为分母,取镜像页
 *   实际消费的键集为分子,算还原度;差集 = 「声明了却没还原的文案键」,即缺口账本的一行。
 *
 *   键集抽取两通道并集(缺一即系统性低估):
 *     ① `t('ns.key')` / `tt('ns.key')` 直调形态(人工改写后的页普遍是这个形态);
 *     ② `PAIR_KEYS` / `SINGLE_KEYS` 数组字面量里的字符串(gen-miniapp-mirror 生成形制:
 *        键以字符串数组声明、JSX 里 `t(titleKey)` 间接消费,不在 t('…') 字面量里)。
 *        只取通道 ① 会让**刚生成出来的页还原度恒为 0**,那把尺子立刻失去意义。
 *
 *   分母只算**业务键**:首段落入 GENERIC_NS(common/app/nav/button/action/state/error/tip/toast)
 *   的通用键不入分母。理由:共享屏普遍引用 `common.save` 这类通用文案,而镜像页复用端内
 *   通用组件时不会重新声明它们 —— 把它们算进分母会让还原度恒低,进而逼出恒红(§12e/§12f)。
 *   GENERIC_NS 单源在 gen-miniapp-mirror.mjs(与生成器同一份清单),本门 import,不复制第二份。
 *
 * 棘轮(唯一 blocking 维):锚点 = **HEAD 面**同一 spec 的缺口集(§0.5「棘轮锚点 = 该文件
 *   HEAD 自身的违规数」)。只拦「本次改动把 HEAD 上已还原的键又丢掉」;存量缺口只报数(§12e);
 *   HEAD 面尚无镜像对的新增页不拦(那是收口,不是倒退)。
 *   为什么不拿人工基线 JSON 当锚点:coverage 已实证「补 47 条镜像后基线仍是旧读数 ⇒ 删任意
 *   一条标记门都判绿 = 假绿」。故一律 git 读 HEAD 面,免维护、不过期。
 *
 * 判据分工(§0.6 / §22c):镜像标记识别、页面枚举、面读取一律 import coverage 的 __test__
 *   (mirroredSpecs / collectShared / collectMiniapp / faceRead),键抽取 import
 *   gen-miniapp-mirror 的 extractUsedKeys —— 本门**零复制**这两把尺子与 GENERIC_NS 清单。
 *
 * 退出码:0 = 通过(含存量缺口只报数);1 = 判出倒退(blocking);2 = 未判定(取不到被审面、
 *   当前面 0 个镜像对 ⇒ 按 §0.3 不记绿也不冒红)。
 *
 * Usage:
 *   node scripts/check-miniapp-mirror-fidelity.mjs              # 默认判 HEAD 面
 *   node scripts/check-miniapp-mirror-fidelity.mjs --staged     # 提交链档(索引 blob)
 *   node scripts/check-miniapp-mirror-fidelity.mjs --worktree   # 人工逃生舱(磁盘)
 *   node scripts/check-miniapp-mirror-fidelity.mjs --json       # 机读(喂缺口账本)
 *   node scripts/check-miniapp-mirror-fidelity.mjs --top=10     # 列出缺口最大的 10 对
 *   node scripts/check-miniapp-mirror-fidelity.mjs --quiet      # 仅输出结论与失败
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch } from './lib/face-reader.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { extractUsedKeys, __test__ as gen } from './gen-miniapp-mirror.mjs'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const { collectShared, collectMiniapp, mirroredSpecs } = cov
const { GENERIC_NS } = gen.constants

/** 生成形制的键表块:PAIR_KEYS / SINGLE_KEYS 声明区内的全部字符串字面量。 */
const KEY_BLOCK_RE = /(?:PAIR_KEYS|SINGLE_KEYS)[^=]*=\s*\[([\s\S]*?)\n\]/g

/**
 * 同面批量取正文(rel -> text|null)。
 * 为什么必须走 catBatch 而不是 faceRead 逐个取:face-reader 头注实测「逐文件 git show 在
 * Windows 上 0.2~0.4s/次,~500 个屏要跑 2~3 分钟」。本门要读全部共享屏正文(取键集),
 * 逐个取会把门推到 109s —— 慢到没人愿意日常跑的尺子等于没有(提交链上尤其致命:
 * 一次绕过约等于链上全部守门对该提交作废)。故一律**一次 catBatch 取完**;取不到抛异常
 * 就向上冒,由 run() 记「未判定」,绝不把"没取到"记成 null 冒充"该面没有这份件"。
 */
export function batchReadTexts(face, rels) {
  const keys = [...new Set((rels || []).map((r) => String(r).replace(/\\/g, '/')))]
  if (face === 'worktree') {
    const out = new Map()
    for (const k of keys) {
      try { out.set(k, readFileSync(join(ROOT, k), 'utf8')) } catch { out.set(k, null) }
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  if (keys.length === 0) return new Map()
  const got = catBatch(ROOT, keys.map((k) => prefix + k), { maxBuffer: 1 << 28 })
  const out = new Map()
  for (const k of keys) out.set(k, got.get(prefix + k) ?? null)
  return out
}

/**
 * 通道 ②:键表数组里声明的键。命中 0 是合法的(人工改写后的页没有这些块),
 * 所以**不做「取不到即未判定」**——它不是必选输入,是并集的一条腿。
 */
export function extractDeclaredKeys(text) {
  const out = []
  if (!text) return out
  for (const m of String(text).matchAll(KEY_BLOCK_RE)) {
    for (const s of m[1].matchAll(/'([A-Za-z0-9_.-]+)'/g)) out.push(s[1])
  }
  return out
}

/** 首段落入通用命名空间的键不算业务键(理由见头注「分母只算业务键」)。 */
export function isBusinessKey(key) {
  return !GENERIC_NS.has(String(key || '').split('.')[0])
}

export function businessKeys(keys) {
  return (keys || []).filter(isBusinessKey)
}

/** 一个页面(共享屏或镜像页)消费的键集 = 两通道并集去重。 */
export function consumedKeys(text) {
  const set = new Set()
  for (const k of extractUsedKeys(text)) set.add(k)
  for (const k of extractDeclaredKeys(text)) set.add(k)
  return set
}

/**
 * 按给定面算全部镜像对的还原度。返回 { face, sharedCount, pairs, avg, totalMissing, rows }。
 * rows 每项 { spec, route, sharedKeys, covered, missing, fidelity }(|sharedKeys|=0 ⇒ fidelity=null)。
 */
export function computeFidelity(face) {
  const shared = collectShared(face)
  const miniapp = collectMiniapp(face)

  // 先按镜像标记反查「本次真正要判的共享屏」,再只取这一批正文(先筛后取,见 batchReadTexts 头注)。
  const paired = new Set()
  for (const p of miniapp) for (const spec of mirroredSpecs(p)) paired.add(spec)
  const specToText = batchReadTexts(face, shared.map((s) => s.spec).filter((spec) => paired.has(spec)))

  const rows = []
  for (const s of shared) {
    if (!paired.has(s.spec)) continue
    const sharedText = specToText.get(s.spec)
    if (sharedText === null || sharedText === undefined) continue
    const sharedKeys = businessKeys([...consumedKeys(sharedText)])
    if (sharedKeys.length === 0) continue
    const seen = new Set()
    for (const k of sharedKeys) seen.add(k)
    for (const p of miniapp) {
      if (!p.file) continue
      if (!mirroredSpecs(p).has(s.spec)) continue
      const mpKeys = consumedKeys(`${p.text || ''}\n${p.cssText || ''}`)
      const missing = sharedKeys.filter((k) => !mpKeys.has(k))
      rows.push({
        spec: s.spec,
        route: p.route,
        sharedKeys: sharedKeys.length,
        covered: sharedKeys.length - missing.length,
        missing,
        fidelity: (sharedKeys.length - missing.length) / sharedKeys.length,
      })
    }
  }

  const totalShared = rows.reduce((a, r) => a + r.sharedKeys, 0)
  const totalCovered = rows.reduce((a, r) => a + r.covered, 0)
  const totalMissing = rows.reduce((a, r) => a + r.missing.length, 0)
  return {
    face,
    sharedCount: shared.length,
    pairs: rows.length,
    avg: totalShared === 0 ? null : totalCovered / totalShared,
    totalShared,
    totalCovered,
    totalMissing,
    rows,
  }
}

/** 棘轮:当前面相对 HEAD 面**新增**的缺口(存量不拦)。返回 [{spec, route, added}]。 */
export function regressions(now, base) {
  const baseMissing = new Map()
  const basePaired = new Set()
  for (const r of base.rows) {
    basePaired.add(r.spec)
    baseMissing.set(r.spec, new Set(r.missing))
  }
  const out = []
  for (const r of now.rows) {
    if (!basePaired.has(r.spec)) continue
    const anchor = baseMissing.get(r.spec) || new Set()
    const added = r.missing.filter((k) => !anchor.has(k))
    if (added.length > 0) out.push({ spec: r.spec, route: r.route, added })
  }
  return out
}

function parseArgs(argv) {
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  const topArg = argv.find((a) => a.startsWith('--top='))
  const top = topArg ? Number(topArg.slice('--top='.length)) : 0
  return {
    staged,
    worktree,
    json: argv.includes('--json'),
    quiet: argv.includes('--quiet'),
    top: Number.isFinite(top) && top > 0 ? Math.floor(top) : 0,
  }
}

function run() {
  const argv = process.argv.slice(2)
  const opts = parseArgs(argv)
  if (opts.staged && opts.worktree) {
    console.error('❌ 未判定:--staged 与 --worktree 同给(两面旗互斥)')
    return 2
  }
  const face = opts.staged ? 'staged' : opts.worktree ? 'worktree' : 'head'
  const pct = (v) => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`)

  let now
  try {
    now = computeFidelity(face)
  } catch (e) {
    console.error(`❌ 未判定(${face} 面取材异常):${e?.message ?? e}`)
    return 2
  }
  if (now.sharedCount === 0) {
    console.error(`❌ 未判定:${face} 面枚举到 0 个共享屏,还原度无从判起(不记绿)`)
    return 2
  }
  if (now.pairs === 0) {
    console.error(`❌ 未判定:${face} 面 0 个镜像对,还原度无从判起(镜像标记主判据见 check-cross-end-screen-coverage R3)`)
    return 2
  }

  const base = face === 'head' ? now : computeFidelity('head')
  const reg = regressions(now, base)
  const state = reg.length > 0 ? 'regressed' : 'ok'
  const summary = {
    face,
    state,
    pairs: now.pairs,
    avg: now.avg,
    avgPct: pct(now.avg),
    totalShared: now.totalShared,
    totalMissing: now.totalMissing,
    regressions: reg,
    rows: now.rows,
  }

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2))
    return reg.length > 0 ? 1 : 0
  }

  const head = `FIDELITY-RESULT face=${face} pairs=${now.pairs} avg=${pct(now.avg)} missing=${now.totalMissing} regressions=${reg.length} state=${state}`
  console.log(head)
  if (reg.length > 0) {
    console.log('❌ 还原度倒退(本次丢掉的键):')
    for (const r of reg) console.log(`   ${r.spec} → ${r.route}\n     新增缺口(${r.added.length}):${r.added.slice(0, 8).join(', ')}${r.added.length > 8 ? ' …' : ''}`)
  }
  if (!opts.quiet && now.totalMissing > 0) {
    const worst = [...now.rows].sort((a, b) => b.missing.length - a.missing.length).slice(0, opts.top || 10)
    console.log(`ℹ️ 存量缺口(只报数,不拦)${opts.top ? ` top${opts.top}` : ' top10'}:`)
    for (const r of worst) {
      if (r.missing.length === 0) continue
      console.log(`   ${(r.fidelity * 100).toFixed(0)}% ${r.spec} → ${r.route} 缺 ${r.missing.length}/${r.sharedKeys}`)
    }
  }
  return reg.length > 0 ? 1 : 0
}

/* §22d:直执行才跑主流程;测试 import __test__ 不得触发 CLI */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(run())
  } catch (e) {
    console.error(`❌ 未判定(异常):${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  batchReadTexts,
  extractDeclaredKeys,
  isBusinessKey,
  businessKeys,
  consumedKeys,
  computeFidelity,
  regressions,
  run,
  HERE: fileURLToPath(new URL('.', import.meta.url)),
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
