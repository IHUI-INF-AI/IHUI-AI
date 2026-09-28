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
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GATE = path.resolve(__dirname, '..', 'check-desktop-event-wiring.mjs')
const SRC = readFileSync(GATE, 'utf8')

test('T1 装车证明:--self-test 派生必须 rc=0 且逐行无 ✗(永远绿的自检与永远红的同样没用)', () => {
  const r = spawnSync(process.execPath, [GATE, '--self-test'], {
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
