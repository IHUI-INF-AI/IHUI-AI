#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-shared-platform-limits.mjs —— 把 `apps/miniapp-taro/src/rn-compat/PLATFORM-LIMITS.md`
 * 的「小程序没有等价物」清单,变成**共享屏源码**上的机读检查(只读,零写盘)。
 *
 * 立因(2026-11-08):PLATFORM-LIMITS.md 记了四条硬限制,但没有任何判据读它 ⇒ 共享屏可以
 * 随手写 `ellipsizeMode="middle"` 或 `Modal onShow=...`,web/RN 跑得好好的,到小程序静默降级,
 * 而这件事只有真机 smoke 才可能发现。文档最后一句话「不要把这些能力塞进共享屏」目前是**愿望**,
 * 不是防线。本判据把它变成可复跑的读数。
 *
 * 三档(逐条可复算,不靠模型判断):
 *   unsafe —— 小程序**行为不等价**且可能被用户看见:Modal 的 presentationStyle/onShow/onDismiss、
 *             `ellipsizeMode` 取 middle/head(小程序只有尾部省略)。当前 HEAD 应为 0。
 *   noop   —— 小程序**不会崩但静默失效**:Modal 的 animationType(Taro 侧不派发动画)。
 *             不拦提交,只报数;存量 29 文件,是「文档说不要塞、代码里已经塞了」的对照证据。
 *   review —— 语义降级需要人判:onLayout 只报首帧、坐标是可视区而非父容器相对坐标。
 *             只有 1 处(轮播测高),列出来供人判,不自动拦。
 *
 * 判定面 = `packages/app/src/**` 的**共享屏源码**(features + components),排除测试文件与注释。
 * 取材面纪律(AGENTS §0.4):默认 HEAD blob,`--worktree` 仅人工逃生舱;两面旗同给 exit 2。
 *
 * 用法:
 *   node scripts/check-shared-platform-limits.mjs            # 人读报表
 *   node scripts/check-shared-platform-limits.mjs --json     # 机读
 *   node scripts/check-shared-platform-limits.mjs --gate     # 只判 unsafe:有则 exit 1,无则 exit 0
 *   node scripts/check-shared-platform-limits.mjs --worktree # 人工逃生舱
 *   node scripts/check-shared-platform-limits.mjs --self-test
 *
 * 退出码:0 = 无 unsafe(--gate 下即绿);1 = 有 unsafe;2 = 未判定(取不到判定面/参数不明)。
 */

import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { catBatch } from './lib/face-reader.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const gateMode = argv.includes('--gate')
const selfTestMode = argv.includes('--self-test')
const worktreeMode = argv.includes('--worktree')
if (worktreeMode && argv.includes('--staged')) {
  console.error('❌ 未判定:--staged 与 --worktree 同给,取材面不明(§0.4)')
  process.exit(2)
}
const FACE = worktreeMode ? 'worktree' : 'head'
const FACE_LABEL = FACE === 'head' ? 'HEAD blob' : '工作树(磁盘,人工逃生舱)'
const SCOPE = 'packages/app/src'

/**
 * 规则表:每条的出处是 `apps/miniapp-taro/src/rn-compat/PLATFORM-LIMITS.md` 的对应小节。
 * `severity` 决定 --gate 是否拦截:只有 unsafe 拦;noop/review 只报数(§12e 不造恒红)。
 */
const RULES = [
  {
    id: 'modal-presentation-style',
    severity: 'unsafe',
    re: /\bpresentationStyle\s*=/,
    why: 'PLATFORM-LIMITS §2:RN Modal 的 presentationStyle 在 Taro 侧不派发(当前 0 处)',
  },
  {
    id: 'modal-on-show',
    severity: 'unsafe',
    re: /\bonShow\s*=/,
    why: 'PLATFORM-LIMITS §2:RN Modal 的 onShow 在 Taro 侧不派发(当前 0 处)',
  },
  {
    id: 'modal-on-dismiss',
    severity: 'unsafe',
    re: /\bonDismiss\s*=/,
    why: 'PLATFORM-LIMITS §2:RN Modal 的 onDismiss 在 Taro 侧不派发(当前 0 处)',
  },
  {
    id: 'ellipsize-middle-head',
    severity: 'unsafe',
    re: /ellipsizeMode\s*=\s*(?:\{\s*)?['"](?:middle|head)['"]/,
    why: 'PLATFORM-LIMITS §4:小程序只有尾部省略,middle/head 无等价物',
  },
  {
    id: 'modal-animation-type',
    severity: 'noop',
    re: /\banimationType\s*=/,
    why: 'PLATFORM-LIMITS §2:animationType 在 Taro 侧不派发 —— 不崩,但动画静默失效',
  },
  {
    id: 'on-layout',
    severity: 'review',
    re: /\bonLayout\s*=/,
    why: 'PLATFORM-LIMITS §1:onLayout 只报首帧,且 x/y 是可视区坐标 ⇒ 持续观察场景需显式重测',
  },
  {
    id: 'ellipsize-tail-ok',
    severity: 'ok',
    re: /ellipsizeMode\s*=\s*(?:\{\s*)?['"](?:tail|clip)['"]/,
    why: 'PLATFORM-LIMITS §4:tail/clip 与小程序默认尾部省略等价,放行',
  },
]

/** 抹掉注释但保留行号(块注释整段替换成等量换行,行注释截断)。 */
function stripComments(text) {
  return String(text)
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

/** 单文件 → 命中行(纯函数,可喂夹具)。 */
function scanText(rel, text) {
  const clean = stripComments(text)
  const hits = []
  clean.split('\n').forEach((line, i) => {
    for (const rule of RULES) {
      if (!rule.re.test(line)) continue
      // ok 档不产出记(它只是把「什么算放行」写死在同一张规则表里)
      if (rule.severity === 'ok') continue
      hits.push({ file: rel, line: i + 1, rule: rule.id, severity: rule.severity, text: line.trim().slice(0, 120) })
    }
  })
  return hits
}

function selfTest() {
  const cases = [
    ['ellipsizeMode="middle"', 'ellipsize-middle-head', 'unsafe'],
    ["ellipsizeMode={'head'}", 'ellipsize-middle-head', 'unsafe'],
    ['ellipsizeMode="tail"', null, null],
    ['<Modal animationType="fade" onRequestClose={x}>', 'modal-animation-type', 'noop'],
    ['<Modal onShow={() => 1} />', 'modal-on-show', 'unsafe'],
    ['<Modal onDismiss={fn} />', 'modal-on-dismiss', 'unsafe'],
    ['<Modal presentationStyle="pageSheet" />', 'modal-presentation-style', 'unsafe'],
    ['<View onLayout={(e) => setH(e)} />', 'on-layout', 'review'],
    ['const onShowToast = () => {}', null, null],
    ['// ellipsizeMode="middle" 注释里的不算', null, null],
    ['/* animationType="fade" */', null, null],
  ]
  const bad = []
  for (const [text, wantRule, wantSev] of cases) {
    const hits = scanText('x.tsx', text)
    const got = hits[0] ?? null
    const gotRule = got ? got.rule : null
    const gotSev = got ? got.severity : null
    if (gotRule !== wantRule || gotSev !== wantSev) bad.push(`"${text}" want=${wantRule}/${wantSev} got=${gotRule}/${gotSev}`)
  }
  if (bad.length) {
    console.error(`❌ 自检失败 ${bad.length} 条:\n  ${bad.join('\n  ')}`)
    return 1
  }
  console.info(`✅ 自检通过:${cases.length} 组夹具(含注释/onShowToast 阴性对照)全部按规则表落档`)
  return 0
}

function run() {
  const files = cov
    .faceList(FACE, SCOPE)
    .filter((f) => /\.(t|j)sx?$/.test(f))
    .filter((f) => !/\/__tests__\//.test(f) && !/\/tests\//.test(f) && !/\.test\.[jt]sx?$/.test(f))
  if (files.length === 0) {
    console.error(`❌ 未判定:${SCOPE} 在 ${FACE_LABEL} 面取不到任何共享屏源码(§0.3)`)
    return 2
  }
  const texts = new Map()
  if (FACE === 'worktree') {
    for (const f of files) {
      try {
        texts.set(f, readFileSync(join(ROOT, f), 'utf8'))
      } catch {
        texts.set(f, null)
      }
    }
  } else {
    const got = catBatch(ROOT, files.map((f) => `HEAD:${f}`), { maxBuffer: 512 * 1024 * 1024 })
    for (const f of files) texts.set(f, got.get(`HEAD:${f}`) ?? null)
  }
  const unreadable = files.filter((f) => typeof texts.get(f) !== 'string')
  if (unreadable.length) {
    console.error(`❌ 未判定:${unreadable.length} 个共享屏源码在 ${FACE_LABEL} 面读不到(首:${unreadable[0]})`)
    return 2
  }

  const hits = []
  for (const f of files) hits.push(...scanText(f, texts.get(f)))
  const bySeverity = { unsafe: [], noop: [], review: [] }
  for (const h of hits) bySeverity[h.severity]?.push(h)
  const byRule = {}
  for (const h of hits) byRule[h.rule] = (byRule[h.rule] ?? 0) + 1
  const unsafeFiles = [...new Set(bySeverity.unsafe.map((h) => h.file))]

  const payload = {
    face: FACE,
    scope: SCOPE,
    files: files.length,
    counts: { unsafe: bySeverity.unsafe.length, noop: bySeverity.noop.length, review: bySeverity.review.length },
    byRule,
    unsafeFiles,
    unsafe: bySeverity.unsafe,
    noop: bySeverity.noop,
    review: bySeverity.review,
  }
  if (jsonMode) console.info(JSON.stringify(payload, null, 2))

  if (gateMode) {
    if (bySeverity.unsafe.length > 0) {
      console.error(
        `❌ 共享屏平台限制(unsafe)${bySeverity.unsafe.length} 处:\n` +
          bySeverity.unsafe.slice(0, 20).map((h) => `  ${h.file}:${h.line} ${h.rule}  ${h.text}`).join('\n'),
      )
      return 1
    }
    if (!jsonMode) {
      console.info(
        `✅ 共享屏平台限制:unsafe=0(noop=${bySeverity.noop.length} review=${bySeverity.review.length} 只报数,不拦)`,
      )
    }
    return 0
  }
  if (jsonMode) return 0

  const log = (...a) => console.info(...a)
  log(`取材面 : ${FACE_LABEL}`)
  log(`判定面 : ${SCOPE} 共享屏源码 ${files.length} 个(已排除测试)`)
  log('')
  log(`unsafe : ${bySeverity.unsafe.length} 处 —— 小程序行为不等价,应改`)
  log(`noop   : ${bySeverity.noop.length} 处 —— 不崩但静默失效(animationType),只报数`)
  log(`review : ${bySeverity.review.length} 处 —— 需人判语义降级(onLayout 首帧/坐标)`)
  log('')
  for (const [rule, n] of Object.entries(byRule)) log(`  ${String(n).padStart(4)}  ${rule}`)
  log('')
  for (const sev of ['unsafe', 'review', 'noop']) {
    const list = bySeverity[sev]
    if (list.length === 0) continue
    log(`── ${sev}(${list.length}) ──`)
    for (const h of list.slice(0, 40)) log(`  ${h.file}:${h.line}  ${h.rule}  ${h.text}`)
    if (list.length > 40) log(`  … 另 ${list.length - 40} 处`)
    log('')
  }
  log('复跑:node scripts/check-shared-platform-limits.mjs [--gate|--json|--worktree]')
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(selfTestMode ? selfTest() : run())

export const __test__ = { RULES, scanText, stripComments }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
