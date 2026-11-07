// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 落地器「预演档结构上零写」的镜像锁(2026-11-05 立)。
 *
 * 立因(现读取证):档位闸原在 `runPages` 的 :577,而 stampOf → assembleBlobs → buildWithDrops
 * 全跑在闸**之前**。于是"只看不落"的 `--json` 档每轮都会
 *   ① 在 `.ihui-agent/tmp/land-cross-end-shell-pages/` 里 mkdir/写/派生 `watermark.mjs inject`/删临时件,
 *   ② 往**共享对象库**写 loose 对象(`git hash-object -w --stdin`)。
 * 守护每 30 分钟派一次预演,这些字节既不进 HEAD 也不进落地清单,只让共享 odb 长垃圾。
 *
 * 本文件钉三件事:
 *   P1 源码正则锁 —— 预演分支与"纯腿"里,writeFileSync/mkdirSync/rmSync/`'hash-object'`+`'-w'`/
 *      派生 inject/appendLanding/object-space-land **一个都不许出现**;成对反控:落地腿里它们必须
 *      还在(否则 P1 是空转的绿色)。顺序锁另钉"档位闸早于物化腿"。
 *   P2 形状锁(注入替身)—— 同一份接缝走查,预演每条 blob 恒等于 PREVIEW_SLOT(既非 oid 也非正文,
 *      结构上进不了落地清单),路径序列与枚数与落地档逐条相同;`runPages({apply:false})` 照报
 *      planned / 点名清单 / blobs,而注入的 landOf 替身一次都不被调。
 *   P3 行为锁(注入替身)—— 真起一枚 `--json` 子进程,preload 把 node:fs 写口与 node:child_process
 *      派生口全换成"记录后转调"的替身 ⇒ 零条写记录;同轮锁退出码语义与 summary 键。
 *      P3 自带失效方向:一条 read-git-* 都没记到即红(替身没接上时不许冒充"零写")。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

import { __test__ as L } from '../land-cross-end-shell-pages.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = join(import.meta.dirname, '..', '..')
const LANDER = join(ROOT, 'scripts', 'land-cross-end-shell-pages.mjs')
const SRC = readFileSync(LANDER, 'utf8')
const TMP = join(ROOT, '.ihui-agent', 'tmp', 'land-cross-end-shell-pages')

/** 写口/物化口名单 —— 预演射程内一条都不许命中 */
const WRITE_TOKENS = [
  ['writeFileSync', /writeFileSync\s*\(/],
  ['appendFileSync', /appendFileSync\s*\(/],
  ['mkdirSync', /mkdirSync\s*\(/],
  ['rmSync', /rmSync\s*\(/],
  ['hashBytes(=hash-object -w)', /\bhashBytes\s*\(/],
  ["'hash-object'", /'hash-object'/],
  ["'-w'", /'-w'/],
  ['watermarkBytesOf', /watermarkBytesOf\s*\(/],
  ["'inject'(派生 watermark.mjs)", /'inject'/],
  ['object-space-land', /object-space-land/],
  ['appendLanding', /appendLanding/],
  ['landViaObjectSpace', /landViaObjectSpace/],
]
const hitsOf = (text) => WRITE_TOKENS.filter(([, re]) => re.test(text)).map(([n]) => n)

/**
 * 把源码扫成"结构位"掩码:字符串 / 模板串 / 注释内的字符标 true(不参与括号配平)。
 * 注:命中判据(hitsOf)一律打在**原文**上 —— 写口藏在注释里也算命中,宁可多报不可漏报(§0.10)。
 */
function maskOf(src) {
  const mask = new Array(src.length).fill(false)
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      let j = i
      while (j < src.length && src[j] !== '\n') mask[j++] = true
      i = j
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end < 0 ? src.length : end + 2
      while (i < stop) mask[i++] = true
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1
      while (j < src.length) {
        mask[j] = true
        if (src[j] === '\\') {
          if (j + 1 < src.length) mask[j + 1] = true
          j += 2
          continue
        }
        if (src[j] === c) {
          j += 1
          break
        }
        j += 1
      }
      i = j
      continue
    }
    i += 1
  }
  return mask
}

/**
 * 取"函数体/分支体":先配平参数表的圆括号,再取随后第一个花括号块。
 * (旧取法直接 indexOf('{') —— `function runPages({ apply, ... } = {})` 的第一枚花括号是
 * **解构参数**,取到的是参数表,锁会静默扫错区 ⇒ 必须走圆括号这一道。)
 * 箭头表达式体(无花括号)返回那一行;`mustInclude` 是**锚点自证** —— 取错区就当场红,不假绿。
 */
function bodyOf(src, headerRe, label, mustInclude) {
  const m = headerRe.exec(src)
  assert.ok(m, `${label} 的定义/分支找不到 —— 本锁要随实现重写,不得静默失配`)
  const mask = maskOf(src)
  let i = m.index
  while (i < src.length && (mask[i] || src[i] !== '(')) i += 1
  assert.ok(i < src.length, `${label} 找不到参数表/条件的左圆括号`)
  let depth = 0
  for (; i < src.length; i += 1) {
    if (mask[i]) continue
    if (src[i] === '(') depth += 1
    else if (src[i] === ')') {
      depth -= 1
      if (depth === 0) {
        i += 1
        break
      }
    }
  }
  let j = i
  while (j < src.length && (mask[j] || /\s/.test(src[j]))) j += 1
  if (src[j] === '=') {
    const arrow = src.indexOf('>', j)
    assert.ok(arrow > 0, `${label} 的箭头体找不到 =>`)
    j = arrow + 1
    while (j < src.length && (mask[j] || /\s/.test(src[j]))) j += 1
  }
  if (src[j] !== '{') {
    const eol = src.indexOf('\n', j)
    const expr = src.slice(j, eol < 0 ? src.length : eol)
    if (mustInclude) assert.match(expr, mustInclude, `${label} 取到的表达式体里没有锚点(取错区)`)
    return expr
  }
  depth = 0
  for (let k = j; k < src.length; k += 1) {
    if (mask[k]) continue
    if (src[k] === '{') depth += 1
    else if (src[k] === '}') {
      depth -= 1
      if (depth === 0) {
        const body = src.slice(j, k + 1)
        if (mustInclude) assert.match(body, mustInclude, `${label} 取到的体里没有锚点(取错区)`)
        return body
      }
    }
  }
  throw new Error(`${label} 花括号未配平(取体法失效,需重写本锁)`)
}

// ─────────────────────────────────────────────────────────────────────────────
test('P1 源码正则锁:预演分支与纯腿零写口;落地腿仍带写口(成对反控)+ 档位闸顺序锁', () => {
  const previewBranch = bodyOf(
    SRC,
    /if \(!apply \|\| headless\)/,
    'runPages 的预演分支',
    /previewSeams\s*\(/,
  )
  assert.deepEqual(
    hitsOf(previewBranch),
    [],
    `预演分支里出现了写口:${hitsOf(previewBranch).join(', ')}`,
  )
  assert.match(previewBranch, /previewSeams\s*\(/, '预演分支必须走 previewSeams(不是 assembleBlobs)')
  assert.match(previewBranch, /buildWithDrops\s*\(/, '预演仍要过摘屏腿(接缝点名与 dropped 不得因零写而失)')
  // 探针自证:写口真塞进一段"假预演分支"必须被点名 —— 证明上面那条 deepEqual([]) 不是空判
  assert.deepEqual(
    hitsOf('if (!apply || headless) { mkdirSync(d); writeFileSync(p, x); hashBytes(t) }'),
    ['writeFileSync', 'mkdirSync', 'hashBytes(=hash-object -w)'],
    'P1 的写口名单失效(命中判据一条都点不出来)',
  )

  for (const [re, label, anchor] of [
    [/^(?:export )?function previewSeams\s*\(/m, 'previewSeams', /walkSeams/],
    [/^function previewStampOf\s*\(/m, 'previewStampOf', /PREVIEW_SLOT/],
    [/^const previewOidOf\s*=/m, 'previewOidOf', /PREVIEW_SLOT/],
    [/^function walkSeams\s*\(/m, 'walkSeams(两档共用的唯一一份走查)', /insertConfigRoot/],
  ]) {
    const body = bodyOf(SRC, re, label, anchor)
    assert.deepEqual(hitsOf(body), [], `${label} 里出现了写口:${hitsOf(body).join(', ')}`)
  }

  const rp = bodyOf(SRC, /^function runPages\s*\(/m, 'runPages', /capacityGate|gateOf/)
  const gate = rp.search(/if \(!apply \|\| headless\) \{/)
  const stampCache = rp.indexOf('const stampCache')
  assert.ok(gate >= 0 && stampCache >= 0, '档位闸或 stampCache 锚点找不到(本锁要随实现重写)')
  assert.ok(
    gate < stampCache,
    `档位闸(:${gate})必须早于物化腿(:${stampCache}) —— 否则预演又回到"先写再说"`,
  )
  assert.ok(
    rp.indexOf('watermarkBytesOf(') > gate,
    'watermarkBytesOf 的调用点必须落在档位闸之后(只属落地档)',
  )

  assert.doesNotMatch(SRC, /appendLanding/, '本器不得直接写跨端落点账本(登记归 object-space-land 侧)')

  const hashLine = SRC.match(/^const hashBytes = .*/m)
  assert.ok(hashLine, 'hashBytes 定义锚点找不到')
  const live = hitsOf(
    [
      bodyOf(SRC, /^function watermarkBytesOf\s*\(/m, 'watermarkBytesOf', /writeFileSync/),
      bodyOf(SRC, /^function landViaObjectSpace\s*\(/m, 'landViaObjectSpace', /object-space-land/),
      bodyOf(SRC, /^(?:export )?function assembleBlobs\s*\(/m, 'assembleBlobs(落地档装配)', /walkSeams/),
      hashLine[0],
      rp.slice(stampCache),
    ].join('\n'),
  )
  for (const tok of ['mkdirSync', 'writeFileSync', 'rmSync', "'hash-object'", "'-w'", "'inject'"]) {
    assert.ok(
      live.some((n) => n.includes(tok)),
      `落地腿里 ${tok} 不见了 —— 落地档行为一字不得变,P1 的成对反控失效(实得:${live.join(',')})`,
    )
  }
  assert.ok(
    /if \(!opts\.apply \|\| opts\.headless\) return r/.test(SRC),
    'run() 的两条自刷腿(账本/声明件)也必须排在预演早退之后(它们写 TMP 并派生落地器)',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
const CONFIG_FX =
  "export default defineAppConfig({\n  pages: ['pages/index/index'],\n  subPackages: [\n    {\n      root: 'pkg-user',\n      pages: [\n        'a/index',\n      ],\n    },\n  ],\n})\n"
const REGISTRY_FX =
  '{\n  "entries": [\n    {\n      "shared": "s0",\n      "rn": "r0",\n      "miniapp": "pkg-user/p0/index"\n    }\n  ]\n}\n'
const PACK_FX = '{\n  "common": {\n    "back": "返回"\n  }\n}\n'

const fxPlan = (route) => ({
  spec: `packages/app/src/features/${route}/${route}Screen.tsx`,
  route: `pkg-user/${route}/index`,
  subRoot: 'pkg-user',
  page: `${route}/index`,
  pageRel: `apps/miniapp-taro/src/pkg-user/${route}/index.tsx`,
  pageText: 'export default function P(){return null}\n',
  registryEntry: {
    shared: `packages/app/src/features/${route}/${route}Screen.tsx`,
    rn: `apps/mobile-rn/src/screens/${route}Screen.tsx`,
    miniapp: `pkg-user/${route}/index`,
  },
  langBlocks: [
    {
      packRel: 'packages/i18n/messages/miniapp-taro/en.json',
      groups: [['  "pv": {', '    "t": "T"', '  }']],
      members: [{ ns: 'pv', obj: { t: 'T' } }],
      paths: ['pv.t'],
    },
  ],
})
const fxHead = (rel) => {
  if (rel === 'apps/miniapp-taro/src/app.config.ts') return CONFIG_FX
  if (rel === 'scripts/data/cross-end-screen-registry.json') return REGISTRY_FX
  if (rel.endsWith('en.json')) return PACK_FX
  return null
}

test('P2 形状锁:同一份走查 ⇒ 预演每条都是预演槽位,路径序列与枚数与落地档逐条相同', () => {
  const plans = [fxPlan('pvA'), fxPlan('pvB')]
  const pv = L.previewSeams(plans, { headOf: fxHead })
  assert.equal(pv.ok, true, pv.why)
  assert.ok(
    pv.files.every((f) => f.blob === L.PREVIEW_SLOT),
    `预演清单必须逐条落预演槽位,实得:${pv.files.map((f) => String(f.blob).slice(0, 14)).join(',')}`,
  )
  assert.doesNotMatch(
    String(L.PREVIEW_SLOT),
    /^[0-9a-f]{40}$/,
    '预演槽位不得长得像 oid(否则预演产物可能被当成落地清单喂给落地器)',
  )
  // 落地腿这里注入"假 oid"(本条只对照清单形状,不为测试去写共享对象库)
  const ap = L.walkSeams(plans, {
    headOf: fxHead,
    stampOf: (rel, text) => ({ ok: true, blob: `${rel}|${text}` }),
    oidOf: (text) => `oid:${text.length}`,
  })
  assert.equal(ap.ok, true, ap.why)
  assert.deepEqual(
    ap.files.map((f) => f.path),
    pv.files.map((f) => f.path),
    '预演与落地的待落路径序列必须逐条同序(同一份走查;少报/多报即此条红)',
  )
  assert.equal(ap.packs, pv.packs, '词包改动条数两档必须一致')
  assert.equal(pv.files.length, 5, '2 页 + app.config + registry + 真变了的词包 = 5 枚待落')
})

test('P2b 行为锁:runPages(apply=false) 报得出待落枚数与点名,注入的 landOf 替身一次都不被调', () => {
  let landCalls = 0
  const r = L.runPages({
    apply: false,
    cap: 5,
    planOf: () => ({ planned: [fxPlan('pvC'), fxPlan('pvD')], refused: [], undetermined: [] }),
    gateOf: (arr) => ({ ok: true, admitted: arr, held: [], moves: [] }),
    headOf: fxHead,
    landOf: () => {
      landCalls += 1
      return { ok: true }
    },
  })
  assert.equal(r.state, 'pending')
  assert.equal(r.planned, 2, '待产枚数照报')
  assert.deepEqual(r.batch, ['pkg-user/pvC/index', 'pkg-user/pvD/index'], '点名清单照报')
  assert.equal(r.blobs, 5, '待落 blob 枚数照报(2 页 + app.config + registry + 词包 1 枚 = 5)')
  assert.equal(landCalls, 0, '预演档一次都不许派生落地器')
  assert.match(r.note, /预演模式/, 'note 仍点名"加 --apply 落地"')

  const bad = L.runPages({
    apply: false,
    cap: 5,
    planOf: () => ({ planned: [fxPlan('pvE')], refused: [], undetermined: [] }),
    gateOf: (arr) => ({ ok: true, admitted: arr, held: [], moves: [] }),
    headOf: () => null,
  })
  assert.equal(bad.state, 'blocked')
  assert.match(bad.why, /HEAD 面取不到/, '预演的 blocked 成因与落地档同一条判据(不是另写一套)')
})

// ─────────────────────────────────────────────────────────────────────────────
const PRELOAD_SRC = `// probe preload (mirror-test fixture): swap write legs for record-then-delegate stand-ins.
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
const fs = req('node:fs')
const cp = req('node:child_process')
const OUT = __OUT__
const records = []
const ow = fs.writeFileSync
const GIT_WRITE_CMDS = ['update-ref','commit-tree','write-tree','gc','prune','apply','checkout','reset','am','rebase','merge','push','index-pack','unpack-objects','mkpath','symbolic-ref','update-index','add','mv','rm','worktree','stash','filter-branch','fast-import','replace','notes','config']
const oefs = cp.execFileSync
const oesp = cp.spawnSync
const oes = cp.spawn
for (const k of ['writeFileSync', 'appendFileSync', 'mkdirSync', 'rmSync', 'rmdirSync', 'unlinkSync', 'renameSync', 'copyFileSync', 'truncateSync']) {
  const orig = fs[k]
  if (typeof orig !== 'function') continue
  fs[k] = function (...a) {
    records.push({ kind: 'fs.' + k, target: String(a[0]).slice(0, 160) })
    return orig.apply(fs, a)
  }
}
const classify = (file, args) => {
  const a = (Array.isArray(args) ? args : []).map(String)
  const base = String(file).split(/[\\\\/]/).pop().toLowerCase()
  if (base === 'git' || base === 'git.exe') {
    if (a.includes('hash-object') && (a.includes('-w') || a.includes('--write'))) return 'WRITE-git-hash-object-w'
    const w = a.find((x) => GIT_WRITE_CMDS.includes(x))
    if (w) return 'WRITE-git-' + w
    const cmd = a.find((x) => /^[a-z][a-z-]*$/.test(x) && !x.includes('='))
    return 'read-git-' + (cmd || '?')
  }
  const script = a.find((x) => /[.]mjs$|[.]cjs$/.test(x)) || ''
  if (/watermark[.]mjs$/.test(script)) return 'WRITE-spawn-watermark-' + (a[1] || '?')
  if (/object-space-land[.]mjs$/.test(script)) return 'WRITE-spawn-object-space-land'
  if (/report-rn-miniapp-gaps[.]mjs$/.test(script)) return 'WRITE-spawn-parity-doc-generator'
  return 'spawn-other'
}
const wrap = (fn, name) =>
  function (file, args, opts) {
    records.push({
      kind: classify(file, args),
      target: name + ':' + (Array.isArray(args) ? args.join(' ') : '').slice(0, 160),
    })
    return fn.apply(cp, arguments)
  }
cp.execFileSync = wrap(oefs, 'execFileSync')
cp.spawnSync = wrap(oesp, 'spawnSync')
cp.spawn = wrap(oes, 'spawn')
process.on('exit', () => {
  try { ow(OUT, JSON.stringify(records), 'utf8') } catch (e) {}
})
`

test(
  'P3 行为锁:真起 --json 子进程 ⇒ 写口替身零命中;退出码与 summary 读数语义不变',
  { timeout: 560_000 },
  () => {
    const dir = mkScratch('cross-end-preview-probe-')
    const preload = join(dir, 'probe-preload.mjs')
    const out = join(dir, 'probe-records.json')
    try {
      writeFileSync(preload, PRELOAD_SRC.replace('__OUT__', JSON.stringify(out)), 'utf8')
      const before = existsSync(TMP) ? readdirSync(TMP) : []
      const r = spawnSync(
        process.execPath,
        ['--import', pathToFileURL(preload).href, LANDER, '--json', '--cap=2'],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 540_000, windowsHide: true },
      )
      const after = existsSync(TMP) ? readdirSync(TMP) : []
      const records = (() => {
        try {
          return JSON.parse(readFileSync(out, 'utf8'))
        } catch {
          return null
        }
      })()
      assert.ok(
        Array.isArray(records),
        `探针没落回记录 ⇒ 子进程没起来或 preload 崩了;stdout 首行:${String(r.stdout).slice(0, 120)} stderr:${String(r.stderr).slice(0, 200)}`,
      )
      const writes = records.filter(
        (x) => x.kind.startsWith('WRITE-') || x.kind.startsWith('fs.'),
      )
      assert.deepEqual(
        writes,
        [],
        `预演档结构上零写被破:${writes.map((w) => `${w.kind}@${w.target}`).join(' | ')}`,
      )
      const reads = records.filter((x) => x.kind.startsWith('read-git-'))
      assert.ok(
        reads.length > 0,
        '一条 read-git-* 都没记到 ⇒ 替身没接进被测件,P3 会假绿(本锁的失效方向是喊人,不是冒充零写)',
      )
      assert.deepEqual(
        records.filter((x) => x.kind === 'spawn-other'),
        [],
        '预演档不该派生其它子进程',
      )
      // 环境侧第二把尺:该器临时目录不得被本档新增条目
      // (并发会话的 --apply 会写 blobs.json / doc-blob.json / shell-decl-blob.json,故只拦"水印中转件"形态)
      const added = after.filter((f) => !before.includes(f))
      assert.deepEqual(
        added.filter((f) => /\.(tsx|ts|md)$/.test(f)),
        [],
        `预演档在 ${TMP} 里留下了水印中转件:${added.join(', ')}`,
      )
      // 读数与退出码语义(交付要求 2)
      const stdout = String(r.stdout)
      const a = stdout.indexOf('{')
      const b = stdout.lastIndexOf('}')
      assert.ok(a >= 0 && b > a, `--json 没吐 JSON,末行:${stdout.split('\n').filter(Boolean).slice(-1)[0] ?? ''}`)
      const summary = JSON.parse(stdout.slice(a, b + 1)).summary
      for (const k of [
        'state',
        'planned',
        'batch',
        'blobs',
        'refused',
        'cap',
        'doc',
        'held',
        'dropped',
      ]) {
        assert.ok(Object.hasOwn(summary, k), `summary 缺键 ${k} ⇒ 调度器读的是手抄形状`)
      }
      assert.ok(
        ['clean', 'pending', 'landed', 'blocked', 'undetermined'].includes(summary.state),
        `未知 state=${summary.state}`,
      )
      assert.equal(typeof summary.planned, 'number', 'planned 必须是数出来的枚数')
      const expectExit = ['clean', 'pending', 'landed'].includes(summary.state)
        ? 0
        : summary.state === 'blocked'
          ? 1
          : 2
      assert.equal(
        r.status,
        expectExit,
        `退出码语义变了:state=${summary.state} 应 ${expectExit},实得 ${r.status}`,
      )
      if (summary.state === 'pending') {
        assert.ok(summary.planned > 0, 'pending 必带待落枚数')
        assert.ok(summary.blobs > 0, 'pending 必带待落 blob 枚数')
      }
      process.stderr.write(
        `   · P3 现读:state=${summary.state} planned=${summary.planned} blobs=${summary.blobs} ` +
          `记录总数=${records.length} 写记录=0 读git=${reads.length} TMP新增=${added.length}\n`,
      )
    } finally {
      rmScratch(dir)
    }
  },
)

/**
 * P3b 阳性对照(成对反控):同一支探针打在**会写**的那一档(--self-test 里有真落地铁的夹具跑),
 * 必须照样记到写口。P3 报"零写"只有在探针本身有牙时才算数 —— 替身没接上时 P3 也是零记录,
 * 那一格就永远是绿的(§0.3「枚举到 0 判死不记绿」的同一型)。
 */
test(
  'P3b 阳性对照:同一支探针打在 --self-test(带真物化腿)⇒ 必须记到 hash-object -w 与 fs 写口',
  { timeout: 290_000 },
  () => {
    const dir = mkScratch('cross-end-preview-control-')
    const preload = join(dir, 'probe-preload.mjs')
    const out = join(dir, 'probe-records.json')
    try {
      writeFileSync(preload, PRELOAD_SRC.replace('__OUT__', JSON.stringify(out)), 'utf8')
      const r = spawnSync(
        process.execPath,
        ['--import', pathToFileURL(preload).href, LANDER, '--self-test'],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 280_000, windowsHide: true },
      )
      const records = (() => {
        try {
          return JSON.parse(readFileSync(out, 'utf8'))
        } catch {
          return null
        }
      })()
      assert.ok(Array.isArray(records), `探针没落回记录;stderr:${String(r.stderr).slice(0, 200)}`)
      const kinds = new Set(records.map((x) => x.kind))
      const writeKinds = records
        .filter((x) => x.kind.startsWith('WRITE-') || x.kind.startsWith('fs.'))
        .map((x) => x.kind)
      assert.ok(
        writeKinds.length > 0,
        '阳性对照失效:连 --self-test 这档都没记到任何写口 ⇒ 探针是哑的,P3 的"零写"不算证明',
      )
      assert.ok(
        kinds.has('WRITE-git-hash-object-w'),
        `阳性对照里没看到 hash-object -w(实得 kind:${[...kinds].join(',')})`,
      )
      for (const need of ['fs.mkdirSync', 'fs.writeFileSync', 'fs.rmSync']) {
        assert.ok(kinds.has(need), `阳性对照里没看到 ${need}(水印中转件的写口应在 self-test 里命中)`)
      }
      assert.match(
        String(r.stdout),
        /自检 \d+\/\d+ 通过/,
        `探针转调后 self-test 仍须全绿,实得末行:${String(r.stdout).split('\n').filter(Boolean).slice(-1)[0] ?? ''}`,
      )
      process.stderr.write(
        `   · P3b 现读:写记录=${writeKinds.length} 去重 kind=${[...new Set(writeKinds)].join(',')}\n`,
      )
    } finally {
      rmScratch(dir)
    }
  },
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
