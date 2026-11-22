// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 96 的镜像测试(§22c):直接 import 源脚本的 __test__,不复制判据实现。
// 三条重点是本仓当天真踩过的坑:① 第三方 IDE 自管态**不得**进登记表(挪一次丢一次记忆);
// ② 悬空 junction 必须判红;③ 夹具**不得**在断言前清理 —— 那样整套 fixture 断言
//    会对着不存在的路径判定,表现为"集体红"或更糟的"集体 absent = 假绿"。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { platform } from 'node:os'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G } from '../check-home-junctions.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

test('装车证明:守门 96 在 runner 中必须出现恰好一次,且为 blocking + 有 skipEnv', () => {
  const runner = readFileSync(join(HERE, '..', 'guardian-runner.mjs'), 'utf8')
  // 注册块允许 `id:` 之前带说明注释(2026-09-24 起门 96 的改判理由就写在那里)——
  // 只认"`{` 紧跟 id"的写法会让装车证明因**注释变多**而假报未接线,那是比漏判更糟的噪声。
  const block = runner.match(
    /\{\s*\n(?:\s*\/\/[^\n]*\n)*\s*id: '([0-9]+[a-z]?)',[\s\S]{0,400}?script: 'check-home-junctions\.mjs'/,
  )
  assert.ok(block, '本门未接入 runner(找不到 id→script 相邻的注册块)')
  const myId = block[1]
  const hits = runner.match(new RegExp(`id: '${myId}'`, 'g')) || []
  assert.equal(hits.length, 1, `id ${myId} 出现 ${hits.length} 次 ⇒ 与别的门撞号`)

  const ids = [...runner.matchAll(/^\s{4}id: '([0-9a-z]+)',$/gm)].map((m) => m[1])
  assert.deepEqual(
    [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))],
    [],
    'runner 存在重号(本仓同日撞号 4 次,靠这条钉死)',
  )
  const body = runner.slice(block.index, runner.indexOf('},', block.index))
  // 2026-09-24 落点改 warn(用户授权):本门判机器态、与 diff 无关 ⇒ blocking 会让人人必红 + 人人
  // --no-verify(同日 4/127 红实证),等于用 126 道门的命换这条哨兵。warn 仍"不静默":每次提交打红字。
  // 这条断言反过来钉住"不许悄悄退回 blocking 拦路",也不许被改成 mode 缺失(那才是真静默累积)。
  assert.match(body, /mode: 'warn'/, '本门须为 warn:判机器态的门拦在提交链上会逼出全量 --no-verify')
  assert.doesNotMatch(body, /mode: 'blocking'/, '不得回到 blocking(理由见 runner 内 2026-09-24 改批判据)')
  assert.match(body, /skipEnv: 'HUSKY_SKIP_HOME_JUNCTIONS'/, '缺 skipEnv 则应急无出口')
  assert.match(
    body,
    /check-home-junctions\.mjs/,
    'script 字段必须仍在(落点变了不等于摘线)',
  )
})

test('登记表不得含第三方 IDE 自管态(§26 例外条:只登记不搬动)', () => {
  const list = G.registryOf({ APPDATA: 'X:\\AppData', LOCALAPPDATA: 'X:\\Local' }, 'X:\\home')
  assert.ok(list.length >= 14, `登记表只剩 ${list.length} 项`)
  for (const forbidden of ['.workbuddy', '.qoder-cn', '.qoder', '.claude', '.codebuddy']) {
    assert.ok(
      !list.some((e) => e.p.endsWith(forbidden)),
      `${forbidden} 被加进了登记表 —— 那是别的 IDE 的运行态,判成我们的债会逼人去挪,挪一次丢一次记忆`,
    )
  }
  // 反向:本仓产品自己的两处 appdata 必须在表内,否则桌面端态回潮无人管
  for (const must of ['com.ihui.desktop', 'npm', 'pnpm-cache', '.ihui']) {
    assert.ok(list.some((e) => e.p.endsWith(must)), `${must} 不在登记表内`)
  }
})

test('audit:空登记表必须判红(空表 = 恒绿的假门)', () => {
  const r = G.audit([])
  assert.equal(r.violations.length, 1, '空表未被判违规')
  assert.equal(r.violations[0].kind, 'EMPTY-REGISTRY', '判错类型')
})

test('sizeOf 必须真加字节(量不出来会把 C 盘占用读成 0)', () => {
  const r = G.sizeOf(join(HERE, '..', 'lib'))
  assert.ok(r.bytes > 0, `量到 ${r.bytes} 字节 = 遍历失效`)
})

test('fixture:实体目录判 REAL-DIR、真 junction 不红、悬空 junction 判红', (t) => {
  if (platform() !== 'win32') {
    t.skip('非 Windows 无 junction 语义 —— 显式跳过,不得当作通过')
    return
  }
  const s = mkScratch('hj-mirror-')
  try {
    const real = join(s, 'real')
    const dest = join(s, 'dest')
    mkdirSync(real, { recursive: true })
    writeFileSync(join(real, 'a.bin'), 'x'.repeat(4321))
    mkdirSync(dest, { recursive: true })
    writeFileSync(join(dest, 'b.bin'), 'y'.repeat(9))

    const a = G.audit([{ p: real, why: 'fixture' }])
    assert.equal(a.violations.length, 1, '实体目录未被判违规')
    assert.equal(a.violations[0].kind, 'REAL-DIR')
    assert.equal(a.violations[0].bytes, 4321, '体积没量出来 ⇒ 报告会写成"合计约 0 MB"的假小量级')

    const good = join(s, 'good')
    execFileSync('cmd.exe', ['/c', 'mklink', '/J', good, dest], {
      windowsHide: true,
      timeout: 20000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const b = G.audit([{ p: good, why: 'fixture' }])
    assert.equal(b.violations.length, 0, `真 junction 被误判:${JSON.stringify(b.violations)}`)
    assert.equal(b.ok.length, 1, '未记为已改道')

    const dangling = join(s, 'dangling')
    execFileSync('cmd.exe', ['/c', 'mklink', '/J', dangling, join(s, 'nope')], {
      windowsHide: true,
      timeout: 20000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const c = G.audit([{ p: dangling, why: 'fixture' }])
    assert.equal(c.violations.length, 1, '悬空 junction 未被判违规')
    assert.equal(c.violations[0].kind, 'DANGLING')
  } finally {
    // 清理必须在**所有断言之后**(本仓当天就踩过"注册期清理 → 断言对着空气判定")
    assert.ok(existsSync(s), '夹具在断言期间不应消失')
    rmScratch(s)
  }
  assert.ok(!existsSync(s), '夹具未被清理')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
