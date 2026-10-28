#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具，需 console 输出诊断信息 */
/**
 * DDoS 守卫接线对账(gate-ddos-guard-wiring)—— 守门编号见 scripts/guardian-runner.mjs 现值。
 *
 * 立因(2026-10-28，本批防线自己的那一格)：这轮装了四道抗 DDoS 的闸 ——
 *   apps/api/src/plugins/http-conn-guard.ts(单 IP 并发槽 + 全局 maxConnections 硬顶)
 *   apps/api/src/plugins/ws-guard.ts(WebSocket 握手频率 + 单 IP 连接数 + 心跳)
 *   apps/api/src/plugins/rate-limit-failsafe-store.ts(限流失稳兜底)
 *   apps/ai-service/app/core/conn_guard.py(Python 侧按 IP 闸门 + ASGI 包装)
 * 它们全部靠 server.ts / main.py / sio/handlers.py 里的**一行注册**生效。一旦有人把那行摘掉
 * (合并冲突手抖、重构顺手清理、或"先注释一下排查问题"忘了改回)，后果是：防线静默消失，
 * 而 typecheck / eslint / 单测 / build 的表现与摘线前**逐字同形**(都能跑、都不报错)。
 * 这正是 AGENTS §0.9 记过的那一型 ——「判据必须在真跑它的那一刻才成立」，"造好没装车"= 没有，
 * "装过又被摘掉"同样= 没有。本门把"装车"这件事本身钉成尺子。
 *
 * 判据(三态，全部对被审面的 blob 判)：
 *  W1 实现文件在位：GUARD_SOURCES 每一枚在被审面存在且非空。文件被删 ⇒ 红。
 *  W2 注册锚点在位：WIRING 逐条列出的锚点(真实调用形态，含左括号)在该文件遮罩面上出现 ≥1 次。
 *     少任一条 ⇒ 红并点名「哪个文件的哪根线没了」。
 *  W3 清单不得为空：枚举到 0 个候选(锚点清单被清空/损坏)⇒ exit 2 显式「未判定」，不记绿(§0.3)。
 *
 * 为什么要遮罩：判"接线在不在"若按原文搜字符串，注释里写一句「这里注册 httpConnGuard」
 * 就能把摘掉的线读成在位 —— 与守门 89 R1 立因同型(声称已接而权威点零命中)。
 * 故一律先过 scripts/lib/code-mask.mjs 的 maskCommentsStringsAndRegex(遮罩唯一实现，
 * 禁止在本文件再写一份 —— §0.6)。
 *
 * 口径(照抄本仓 70/77/83/98/101/103/118/135)：全量档判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 仅人工逃生舱；两面旗同给 ⇒ exit 2；取不到被审面 ⇒ 「无法判定」且不回落另一个面。
 *
 * 档位：blocking。升 blocking 的前置 = 存量归零(§12e)—— 立门当刻四道闸都在位，
 * 现读缺口 0，因此不存在"逼所有人 --no-verify"的恒红面。
 * 应急跳过：HUSKY_SKIP_DDOS_GUARD_WIRING=1(跳门留痕由 safe-commit 侧负责，见 AGENTS §12/附加强制条款)。
 *
 * 射程(stagedTriggers)：只挂"能造出该状态的那几枚文件"(守门 253 的要求：注册门必须声明射程，
 * 否则同一份缺省在提交通道读成「任何提交都跑」、在落地通道读成「永不复跑」，两通道反义)。
 *
 * 自检：--self-test 走**主判定**(evaluateWiring 是判据唯一实现，夹具与真仓同一条码路)，
 * 每条红档都配"摘掉即翻红"的成对夹具；再对真仓面跑一次主判定，防"自检绿而门一跑就崩"。
 * 镜像测试：scripts/tests/check-ddos-guard-wiring.test.mjs(import 本文件 __test__，不复制判据)。
 *
 * 退出码：0 全在位 / 1 有缺口(逐条点名) / 2 未判定(取不到面、清单为空、两面旗同给)。
 */

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import { catBatch } from './lib/face-reader.mjs'
import { maskCommentsStringsAndRegex } from './lib/code-mask.mjs'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(SCRIPT_DIR, '..')

/**
 * Python 面上的锚点判定：逐行看，跳过整行 `#` 注释与行内 ` #` 之后的部分。
 *
 * 为什么不给 Python 套 code-mask 那几档：JS 词法器(scanSpans)按 JS 的引号规则扫 .py，
 * 本仓 main.py 上实测会漂 —— 某处引号配对一错，遮罩状态一路抹到几百行外，把真接线的
 * `other_asgi_app=WsConnGuardMiddleware(...)` 抹成空白，门当场判红(2026-10-28 立门时即抓到)。
 * maskScriptComments 的方言表里也没有 python(ps/sh/bat/vbs)，为一枚门去扩这台分词器属于
 * 顺手改多席共用的热点 lib ⇒ 不在本枚射程。
 *
 * 已知不判(如实登记)：三引号 docstring 若逐字抄写锚点原文，会被读成已接线(假绿)。
 * 失效方向只在"有人刻意把调用形态抄进文档字符串"时出现；与之相对，行注释里的锚点被正确排除。
 */
export function pyAnchorInCode(text, anchor) {
  for (const line of String(text).split('\n')) {
    if (line.trimStart().startsWith('#')) continue
    const cut = line.indexOf(' #')
    const code = cut === -1 ? line : line.slice(0, cut)
    if (code.includes(anchor)) return true
  }
  return false
}

/** 按语言分派锚点判据。 */
export function anchorPresent(file, text, anchor) {
  return file.endsWith('.py')
    ? pyAnchorInCode(text, anchor)
    : maskCommentsStringsAndRegex(text).includes(anchor)
}

/** W1 射程：防线实现文件(被摘/被删都判红)。 */
export const GUARD_SOURCES = Object.freeze([
  'apps/api/src/plugins/http-conn-guard.ts',
  'apps/api/src/plugins/ws-guard.ts',
  'apps/api/src/plugins/rate-limit-failsafe-store.ts',
  'apps/ai-service/app/core/conn_guard.py',
])

/**
 * W2 射程：注册锚点。写的是**调用形态**(带左括号/完整语句片段)，
 * 不是门名字 —— 只出现文件名的 import 行不能算接线(摘掉 register 仍留着 import 正是最典型的假绿)。
 */
export const WIRING = Object.freeze([
  {
    file: 'apps/api/src/server.ts',
    anchors: [
      'server.register(httpConnGuard',
      'server.register(wsGuard',
      'wsHandshakeGate(',
      'maxConnections = resolveMaxConnections(',
      'createFailSafeRateLimitStore(',
      'FAST_FAIL_REDIS_OPTIONS',
    ],
  },
  {
    file: 'apps/ai-service/app/main.py',
    anchors: ['WsConnGuardMiddleware('],
  },
  {
    file: 'apps/ai-service/app/sio/handlers.py',
    anchors: [
      'sio_conn_gate.allow_handshake(',
      'sio_conn_gate.acquire(',
      'sio_conn_gate.release(',
    ],
  },
])

/**
 * 判据主实现(纯函数：夹具与真仓喂同一张表，绝不为测试另写一份)。
 * @param {{files: Map<string, string|null>}} input 被审面内容(null/缺键 = 取不到该文件)
 * @returns {{gaps: Array<{kind: string, file: string, detail: string}>, checked: number}}
 */
export function evaluateWiring({ files }) {
  const gaps = []
  let checked = 0

  for (const file of GUARD_SOURCES) {
    const text = files.get(file)
    if (text === undefined || text === null) {
      gaps.push({ kind: 'W1', file, detail: '防线实现文件在被审面上取不到(被删或不在面内)' })
      continue
    }
    if (text.trim() === '') {
      gaps.push({ kind: 'W1', file, detail: '防线实现文件为空' })
      continue
    }
    checked += 1
  }

  for (const { file, anchors } of WIRING) {
    const text = files.get(file)
    if (text === undefined || text === null) {
      gaps.push({ kind: 'W2', file, detail: '注册点所在文件在被审面上取不到' })
      continue
    }
    // 注释里提一句锚点名字不能算"线还接着"(与守门 89 R1 同型)，故按语言剥注释后再搜。
    for (const anchor of anchors) {
      if (anchorPresent(file, text, anchor)) {
        checked += 1
      } else {
        gaps.push({ kind: 'W2', file, detail: `注册锚点缺失：${anchor}` })
      }
    }
  }

  return { gaps, checked }
}

/** 候选枚举是否成立(W3：清单被清空/损坏 ⇒ 判死，不记绿)。参数化是为了让"清单为空"这一档有反例夹具。 */
export function isChecklistViable(sources = GUARD_SOURCES, wiring = WIRING) {
  return (
    sources.length > 0 &&
    wiring.length > 0 &&
    wiring.every(
      (w) => typeof w.file === 'string' && Array.isArray(w.anchors) && w.anchors.length > 0,
    )
  )
}

function readWorktree(relPath) {
  try {
    return readFileSync(path.join(ROOT, relPath), 'utf8')
  } catch {
    return null
  }
}

async function runJudge({ face }) {
  if (!isChecklistViable()) {
    console.error('❌ 未判定：锚点清单为空或形状坏(W3)—— 判死不记绿(§0.3)')
    return 2
  }

  const relPaths = [...new Set([...GUARD_SOURCES, ...WIRING.map((w) => w.file)])]
  const files = new Map()

  if (face === 'worktree') {
    for (const p of relPaths) files.set(p, readWorktree(p))
  } else {
    const prefix = face === 'staged' ? ':' : 'HEAD:'
    const specs = relPaths.map((p) => `${prefix}${p}`)
    let blobs
    try {
      blobs = catBatch(ROOT, specs)
    } catch (e) {
      console.error(
        `❌ 无法判定：被审面 blob 批量预取失败(${String(e?.message ?? e).split('\n')[0].slice(0, 160)})` +
          ' —— 判据未能执行，既不记红也不记绿(§0.3)',
      )
      return 2
    }
    for (const spec of specs) {
      if (!blobs.has(spec)) {
        console.error(`❌ 无法判定：规格未被预取 ${spec}(先 prefetch 再读，禁止补一次派生)`)
        return 2
      }
      files.set(spec.slice(prefix.length), blobs.get(spec))
    }
  }

  const { gaps, checked } = evaluateWiring({ files })
  const faceLabel = face === 'staged' ? '索引 blob' : face === 'worktree' ? '工作树(人工逃生舱)' : 'HEAD blob'

  if (gaps.length > 0) {
    console.error(`❌ DDoS 守卫接线对账：判定面=${faceLabel} · 缺口 ${gaps.length} 条(在位读数 ${checked})`)
    for (const g of gaps) {
      console.error(`   · [${g.kind}] ${g.file} —— ${g.detail}`)
    }
    console.error(
      '   修复方向：把注册行原样接回(不是加注释、不是改名)；确要撤某道闸，先连同本门这条锚点与文档点名一起摘，' +
        '并在提交信息里写明理由。禁止 HUSKY_SKIP 绕过——摘线静默正是本门立因。',
    )
    return 1
  }

  console.log(
    `✅ DDoS 守卫接线对账：判定面=${faceLabel} · 实现文件 ${GUARD_SOURCES.length} 枚 / 注册锚点 ${WIRING.reduce((n, w) => n + w.anchors.length, 0)} 条 全部在位`,
  )
  return 0
}

/** 自检：走主判定，每条红档配"摘掉即翻红"的成对夹具。 */
export function selfTest() {
  const base = new Map()
  for (const p of [...GUARD_SOURCES, ...WIRING.map((w) => w.file)]) {
    base.set(p, readWorktree(p) ?? '')
  }
  const cases = []
  const ok = (name, cond) => cases.push({ name, pass: Boolean(cond) })

  ok('真仓面(工作树)主判定零缺口', evaluateWiring({ files: base }).gaps.length === 0)

  // 夹具①：摘掉 register(httpConnGuard ⇒ 必须翻红
  const m1 = new Map(base)
  const serverText = String(m1.get('apps/api/src/server.ts'))
  m1.set('apps/api/src/server.ts', serverText.replace('server.register(httpConnGuard', '// 已注释'))
  ok('摘掉 register(httpConnGuard) 即翻红', evaluateWiring({ files: m1 }).gaps.length > 0)

  // 夹具②：删掉实现文件 ⇒ W1 红
  const m2 = new Map(base)
  m2.delete('apps/api/src/plugins/ws-guard.ts')
  ok('删除 ws-guard 实现文件即翻红', evaluateWiring({ files: m2 }).gaps.some((g) => g.kind === 'W1'))

  // 夹具③：把锚点写进注释而代码摘掉 ⇒ 仍须红(遮罩锁)
  const m3 = new Map(base)
  const handlers = String(m3.get('apps/ai-service/app/sio/handlers.py'))
  m3.set(
    'apps/ai-service/app/sio/handlers.py',
    handlers.replace('sio_conn_gate.allow_handshake(', '# sio_conn_gate.allow_handshake('),
  )
  ok('锚点只活在注释里不算接线', evaluateWiring({ files: m3 }).gaps.length > 0)

  // 夹具④：清单形状坏 ⇒ 判死不记绿(两条反例：空清单、锚点被清空)
  ok('空清单判不成立(不记绿)', isChecklistViable([], []) === false)
  ok('锚点被清空的清单判不成立', isChecklistViable(GUARD_SOURCES, [{ file: 'x', anchors: [] }]) === false)
  ok('现行清单成立', isChecklistViable() === true)

  let failed = 0
  for (const c of cases) {
    if (!c.pass) failed += 1
    console.log(`${c.pass ? '✓' : '✗'} ${c.name}`)
  }
  console.log(`自检 ${cases.length - failed}/${cases.length} 通过`)
  return failed === 0 ? 0 : 1
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exitCode = selfTest()
    return
  }
  const givesStaged = argv.includes('--staged')
  const givesHead = argv.includes('--head')
  const givesWorktree = argv.includes('--worktree')
  if ([givesStaged, givesHead, givesWorktree].filter(Boolean).length > 1) {
    console.error('❌ 未判定：--staged / --head / --worktree 互斥，两面旗同给不猜意图(§0.4)')
    process.exitCode = 2
    return
  }
  const face = givesStaged ? 'staged' : givesWorktree ? 'worktree' : 'head'
  process.exitCode = await runJudge({ face })
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  evaluateWiring,
  isChecklistViable,
  pyAnchorInCode,
  anchorPresent,
  GUARD_SOURCES,
  WIRING,
  selfTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
