#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:scripts/check-desktop-event-wiring.mjs(桌面端事件链路接线守门)
 *
 * 2026-09-28 立(本票)。为什么不是 import 源函数:该脚本顶层就是 CLI 主流程(取材 → 判据 →
 * process.exit),**没有 §22d isDirectRun 守卫**,import 会把整道门跑一遍并带着测试进程一起
 * exit —— 与 merge-live-doc-anchor 同型,所以取证只能走两条通道:
 *   ① spawn `--self-test`(行为面:夹具正反例,含本票新增的表驱动形态);
 *   ② 源码形状锁(结构面:新识别必须在位、且不许退回磁盘读/第二份名单)。
 * 形状锁防的正是这一票要修的失效型:判据存在、却没人把它接进取材/调用链(守门 70/76/81 同族)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as path from 'node:path'
// 临时件一律走 §26 的落点(mkScratch 锚定工作树同盘的 DevEnv/Temp,不写 os.tmpdir())
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GATE = path.resolve(__dirname, '..', 'check-desktop-event-wiring.mjs')
const SRC = readFileSync(GATE, 'utf8')

test('T1 装车证明:--self-test 派生必须 rc=0 且逐行无 ✗(永远绿的自检与永远红的同样没用)', () => {
  // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
  const r = spawnSync(process.execPath, [GATE, '--self-test'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: 180000,
    windowsHide: true,
  })
  assert.equal(r.status, 0, `self-test 退出码 ${r.status}\n${(r.stdout ?? '') + (r.stderr ?? '')}`)
  const out = r.stdout ?? ''
  assert.match(out, /✅ 全部通过/)
  assert.doesNotMatch(out, /✗/, '自检输出里存在 ✗ 行却仍 rc=0 —— 判据汇总失效')
})

test('T2 本票新增的表驱动变异对照必须真在自检里跑过(不是只写在注释/文档里)', () => {
  const r = spawnSync(process.execPath, [GATE, '--self-test'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: 180000,
    windowsHide: true,
  })
  const out = r.stdout ?? ''
  const mustHave = [
    'H 表驱动夹具',
    'H2 表驱动形态:删掉整条 quit 分支',
    'H3 表驱动形态:quit 分支只剩注释',
    'H1 表驱动形态但登记表解析不出',
    'H1 登记表条目数与 [; N] 声明不符',
    'H2 登记表改名',
    'H3 表驱动 quit 分支只剩 .close()',
  ]
  for (const label of mustHave) {
    const line = out.split('\n').find((l) => l.includes(label))
    assert.ok(line, `自检不再包含用例「${label}」—— 判据被摘线而账面无人喊`)
    assert.match(line, /^\s*✓/, `用例「${label}」红着: ${line}`)
  }
})

test('T3 原生去向族必须认 exit_application(本门立项形态不得再被判成"没反应")', () => {
  const decl = /const TRAY_ARM_NATIVE_RE\s*=\s*\n?\s*(\/.*\/)/.exec(SRC)
  assert.ok(decl, 'TRAY_ARM_NATIVE_RE 定义形态漂移,形状锁失效')
  // 捕获组里是**正则源码文本**(\b \s \( 各带一个真反斜杠),所以本锁的模式必须再折一层:
  // `\\\(` = 匹配字面 `\(`;字面星号必须写 `\*`(若写成 `\\*` 就变成"零或多个反斜杠"的量词,
  // 锁会对着正确代码恒红 —— 第一版少 `\(` 前的反斜杠、第二版少 `\*`,均由构造面抓到)。
  assert.match(decl[1], /\\bexit_application\\s\*\\\(/, '原生族里 exit_application 被摘走')
  assert.ok(decl[1].includes('\\bexit_application\\s*\\('), 'includes 通道:T3 正则与文本对不上说明锁自身漂了')
  // 反向:close/destroy 不得被当成去向(判口放宽会放走"退出分支只剩关窗")
  assert.doesNotMatch(decl[1], /\.close/, '原生族不得包含 .close() —— 关窗 ≠ 执行该项语义')
})

test('T4 表驱动形态的识别与登记表现读必须在位,且不得留第二份手抄名单', () => {
  assert.match(SRC, /const TRAY_ITEM_ID_FORMAT_RE\s*=\s*\/MenuItemBuilder::with_id\\\(\\s\*format!\\\(/, 'format! 形态识别被摘线')
  assert.match(SRC, /function auditTrayItemDestinations\(rawRust, emittedActions = null, registryText = null\)/, '判据第三参 registryText 被摘走')
  assert.match(SRC, /extractTrayRegistryItems\(registryText/, 'audit 里没有调用登记表解析 ⇒ 表驱动形态又瞎了')
  // 装车证明:主调用点必须把 trayRegistryText 真的传进去(判据在、无人喂 = 没有)
  assert.match(SRC, /auditTrayItemDestinations\(rustLibText, TRAY_EMITTED_ACTIONS, trayRegistryText\)/, '主调用点没有喂登记表正文 —— 门对表驱动形态仍然全盲')
  assert.match(SRC, /const trayRegistryText = textOf\(CONTENTS, RUST_DESKTOP_PREFS_REL\)/, '登记表必须走被审面(CONTENTS),不得回落磁盘')
  // 登记表路径的字符串字面量全文件只许出现一次(第二份名字必漂移)
  const occurrences = SRC.split('apps/desktop/src-tauri/src/desktop_prefs.rs').length - 1
  assert.equal(occurrences, 1, `desktop_prefs.rs 路径字面量出现 ${occurrences} 次,应为 1`)
  // 判据不得在自己源码里手抄 id 名单当第二真相(守门 131 现读注册表同取向)
  assert.doesNotMatch(SRC, /const TRAY_ITEM_IDS\s*=/, '门里出现了手抄的托盘 id 名单 —— 清单会腐烂')
})

test('T5 取材面纪律:判据面必须先剥注释(blankComments 只有一份实现)', () => {
  assert.match(SRC, /function blankComments\(/, 'blankComments 被摘走')
  assert.equal(SRC.split('function blankComments(').length - 1, 1, 'blankComments 出现第二份实现 —— 两处遮噪必漂移(守门 131/135 同型)')
  // 第一版对**全文** doesNotMatch readFileSync —— 被门自己头注里那句"旧形态是 readFileSync(join(ROOT, …))"
  // 的散文假红(§22c:说明性文字也会带执行性字符)。判"有没有磁盘读取"要看执行面:
  // node:fs 的 import 行不再引 readFileSync,代码面就不可能出现该调用。
  const fsImportLines = SRC.split('\n').filter((l) => /from 'node:fs'/.test(l))
  assert.ok(fsImportLines.length >= 1, '找不到 node:fs import 行 —— 取材层结构漂移,锁需人工复核')
  for (const l of fsImportLines) {
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) continue // 纯注释行不构成执行面
    assert.ok(!l.includes('readFileSync'), `门又从磁盘直读被审内容:${l.trim()}`)
  }
})

// ============================================================================
// G9(整页导航发起点必须先触发存草稿出口,2026-09-29 · G-407 票①)
//
// 行为面(注入必红 / 补出口必绿 / 存量不得判红)已在 `--self-test` 与一次私有索引
// 端到端里证过(见该组用例与票的交付报告)。这一组是**形状锁**:G9 与 G8 的分工
// 是"同一份发起点枚举 + 同一份失明护栏",而分工一旦靠散文约束就会漂 ——
// 本仓记过最多次的失效型正是"判据在、没人接进取材/调用链"与"复制一份必漂移"。
// ============================================================================

/** 取某个顶层函数/常量声明的源码切片(到下一个顶层 `function ` / `const ` 之前),供形状锁定位 */
function srcSlice(fromMarker, toMarkers) {
  const from = SRC.indexOf(fromMarker)
  assert.ok(from >= 0, `源码里找不到「${fromMarker}」—— G9 的实现被摘线或改名`)
  let end = SRC.length
  for (const m of toMarkers) {
    const i = SRC.indexOf(m, from + fromMarker.length)
    if (i > 0 && i < end) end = i
  }
  return SRC.slice(from, end)
}

test('T6 反向依赖:G9 不得复制 G8 的"找不到发起点即失明"护栏(整仓只允许一份)', () => {
  const msg = '找不到任何整页导航发起点'
  const hits = SRC.split(msg).length - 1
  assert.equal(hits, 1, `失明护栏文案出现 ${hits} 份 —— 两份护栏会各自与取材面漂移,而 G9 那一份还从未与宿主面同步过(守门 102/70/76/81 同族)`)
  const g8 = srcSlice('  // G8 —— 整页导航发起处必须先复位闸门', ['\n  return violations'])
  assert.ok(g8.includes(msg), '那条唯一护栏必须住在 G8 里(G9 反向依赖它)')
  const g9 = srcSlice('export function auditPageNavExit', ['export function decidePageNavReds'])
  assert.ok(!g9.includes(msg), 'G9 自己不许再判一次"失明"')
})

test('T7 发起点枚举只许一份实现,且 G8 与 G9 都必须调用它', () => {
  assert.equal(SRC.split('function collectPageNavSites(').length - 1, 1, 'collectPageNavSites 被抄了第二份')
  const g8 = srcSlice('  // G8 —— 整页导航发起处必须先复位闸门', ['\n  return violations'])
  const g9 = srcSlice('export function auditPageNavExit', ['export function decidePageNavReds'])
  assert.ok(g8.includes('collectPageNavSites('), 'G8 没走共用枚举 ⇒ 两侧形态集合必然分叉')
  assert.ok(g9.includes('collectPageNavSites('), 'G9 没走共用枚举 ⇒ 同上')
  // 主流程必须真的调用 G9 的判据与棘轮出口(判据在而无人喂 = 没有,本门 G8 注册史的同型)
  assert.match(SRC, /const info = auditPageNavExit\(rel, masked, raw\)/, '主循环没调 auditPageNavExit')
  assert.match(SRC, /const dec = decidePageNavReds\(g9Judged, anchors\)/, '主流程没走棘轮出口 ⇒ G9 只打印不拦')
  assert.match(SRC, /out\.set\(p, auditPageNavExit\(p, masked, text\)\.gaps\)/, 'HEAD 锚点必须用**同一份**判据算,不得另抄正则')
})

test('T8 渲染面是"报名"不是"隐身":两侧切分与逐文件清单都必须在位', () => {
  const scopeBody = srcSlice('export function pageNavScopeOf', ['\n/**', '\n// ===='])
  assert.ok(
    scopeBody.includes("return /\\.rs$/.test(rel) ? 'host' : 'renderer'"),
    'host/renderer 切分漂移(或整个出口被摘线)',
  )
  assert.match(SRC, /g9RendererLedger\.push\(/, '渲染面站点没被收集 ⇒ "不判红"退化成"看不见"')
  assert.match(SRC, /⚠ 渲染面同类发起点/, '渲染面台账没有输出行 ⇒ 报名不成立')
})

test('T9 行内豁免出口必须带原因、逐行生效,且族已登记进门 108 的存活期表', () => {
  assert.ok(
    SRC.includes('const PAGE_NAV_EXEMPT_RE = /page-nav-exempt:\\s*(\\S.*)/'),
    '豁免正则形状漂移(捕获组一丢,"裸标记也算带了原因")',
  )
  const g9 = srcSlice('export function auditPageNavExit', ['export function decidePageNavReds'])
  assert.ok(g9.includes('NOT_A_REASON_RE'), 'G9 没剥标点/注释闭合符 ⇒ "裸标记 + */" 会被当成带了原因(守门 102 记过同一条)')
  assert.ok(g9.includes('s.line - 1, s.line - 2'), '豁免不是逐行(命中行 + 紧邻上一行)⇒ 一份标记救整棵文件')
  const expiry = readFileSync(path.resolve(__dirname, '..', 'check-exemption-expiry.mjs'), 'utf8')
  assert.match(expiry, /'page-nav-exempt':\s*30/, 'page-nav-exempt 未进 FAMILY_LIFETIME_DAYS ⇒ 一条没人管寿命的出口')
})

test('T10 端到端双向锁:私有索引注入(宿主面红 / 补出口绿 / 存量只报数 / 渲染面报名)', () => {
  const ROOT = path.resolve(__dirname, '..', '..')
  const gitBin = process.env.GIT_BIN || 'git'
  const git = (args, idx) =>
    execFileSync(gitBin, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1 << 26,
      env: { ...process.env, ...(idx ? { GIT_INDEX_FILE: idx } : {}) },
    })
  const REL = 'apps/desktop/src-tauri/src/g9probe.rs'
  const TS_REL = 'apps/web/src/lib/g9probe.ts'
  const NO_EXIT = 'fn nav(w: &tauri::WebviewWindow) {\n    let _ = w.eval("location.reload()");\n    let _ = w.eval("location.href=u");\n}\n'
  const WITH_EXIT =
    'fn nav(w: &tauri::WebviewWindow) {\n    let _ = w.emit("desktop-before-close", ());\n    let _ = w.eval("location.reload()");\n    let _ = w.eval("location.href=u");\n}\n'
  const TS_TEXT = 'export function go(u: string): void {\n  window.location.href = u\n  window.location.reload()\n}\n'
  const scratch = mkScratch('g9-mirror-e2e')
  const idx = path.join(scratch, 'i').replace(/\\/g, '/')
  try {
    const run = (files, want, extra) => {
      git(['read-tree', 'HEAD'], idx)
      for (const [rel, text] of files) {
        const tmp = path.join(scratch, 'blob.txt')
        writeFileSync(tmp, text, 'utf8')
        const blob = git(['hash-object', '-w', '-t', 'blob', tmp], idx).trim()
        git(['update-index', '--add', '--cacheinfo', `100644,${blob},${rel}`], idx)
      }
      const r = spawnSync(process.execPath, [GATE, '--staged'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 300000,
        windowsHide: true,
        env: { ...process.env, GIT_INDEX_FILE: idx },
      })
      const out = (r.stdout || '') + (r.stderr || '')
      const mine = out.includes(`✗ G9 ${REL} 新增`)
      const tsMine = out.includes(`✗ G9 ${TS_REL} 新增`)
      // "别的 G9 红"必须按**被点名的文件**判,不得用 /✗ G9 / 一律算红 —— 那会把本用例
      // 自己要求的那一条红算成"意外红",断言恒假(第一版就栽在这里)。
      const otherRed = [...out.matchAll(/✗ G9 (\S+) 新增/g)].some((m) => m[1] !== REL && m[1] !== TS_REL)
      if (want === 1)
        assert.ok(r.status === 1 && mine && !otherRed, `${extra}:exit ${r.status} 点名=${mine} 其它G9红=${otherRed}\n${out.split('\n').filter((l) => /G9|错误/.test(l)).slice(0, 6).join('\n')}`)
      else
        assert.ok(
          r.status === 0 && !mine && !tsMine && !otherRed,
          `${extra}:exit ${r.status} 点名=${mine || tsMine} 其它G9红=${otherRed}\n${out.split('\n').filter((l) => /G9|错误/.test(l)).slice(0, 6).join('\n')}`,
        )
      return out
    }
    run([], 0, 'C 索引==HEAD 必须绿(存量不得算新增)')
    run([[REL, NO_EXIT]], 1, 'A 宿主面两处无出口发起点必须红并点名')
    run([[REL, WITH_EXIT]], 0, 'B 补上 emit 必须绿(同一站点、只多一行出口)')
    const outD = run([[TS_REL, TS_TEXT]], 0, 'D 渲染面同样站点不得判红')
    assert.ok(outD.includes('⚠ 渲染面同类发起点') && outD.includes(TS_REL), 'D 渲染面必须逐文件报名,不判红也不许隐身')
  } finally {
    rmScratch(scratch)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
