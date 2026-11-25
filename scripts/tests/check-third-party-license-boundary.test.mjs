// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/check-third-party-license-boundary.test.mjs
 *
 * 镜像测试:scripts/check-third-party-license-boundary.mjs
 *
 * 与 --self-test 的分工:self-test 在临时目录造 R1/R2/R3 阳性 + 阴性夹具,证明判据会红也会绿;
 * 本文件钉不随内容腐烂的不变量 —— __test__ 接线、真仓面判绿、未知开关 129、白名单口径、
 * 允许集不含传染/非商业许可证。不断言台账必须存在某某条目(清单会腐烂)。
 *
 * ROOT 由本文件自身位置推导(守门 70 的教训:靠 cwd 定位夹具会让脚本按定义忽略 cwd)。
 */

import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REAL_ROOT = resolve(HERE, '..', '..')
const SRC = join(REAL_ROOT, 'scripts', 'check-third-party-license-boundary.mjs')

const mod = await import('../check-third-party-license-boundary.mjs')
const G = mod.__test__

test('源文件必须 export __test__ 且测试必须真 import 它(不许复制判据)', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.ok(/export const __test__ = \{/.test(src), '源文件缺 export const __test__ 锚点')
  for (const key of ['runCheck', 'checkR1', 'checkR2', 'checkR3', 'rejectedMatch', 'loadLedger']) {
    assert.ok(src.includes(`${key},`) || src.includes(`${key}:`), `__test__ 缺导出键 ${key}`)
  }
  const self = readFileSync(import.meta.filename, 'utf8')
  assert.ok(
    /import\s*\(\s*['"]\.\.\/check-third-party-license-boundary\.mjs['"]\s*\)/.test(self) &&
      /__test__/.test(self),
    '测试文件未取用源脚本的 __test__',
  )
})

test('真仓扫描必须判绿(新门不得落地即红),且取材面不是空扫', () => {
  const res = G.runCheck(REAL_ROOT)
  assert.ok(res.scanned > 1000, `取材面只枚举到 ${res.scanned} 个文件,尺子坏了(空扫即绿是最坏失效)`)
  assert.deepEqual(res.violations, [], `真仓判红:\n${res.violations.map((v) => `[${v.rule}] ${v.rel} —— ${v.reason}`).join('\n')}`)
})

test('未知 CLI 开关不得静默掉进默认档(必须 129)', () => {
  const run = (args) => {
    try {
      return execFileSync(process.execPath, [SRC, ...args], {
        cwd: REAL_ROOT,
        encoding: 'utf8',
        timeout: 120000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (e) {
      return { status: e?.status, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}` }
    }
  }
  const unknown = run(['--chekc'])
  assert.equal(typeof unknown === 'string' ? 0 : unknown.status, 129, `拼错的开关没被拒:${JSON.stringify(unknown).slice(0, 200)}`)
  const noValue = run(['--root'])
  assert.equal(typeof noValue === 'string' ? 0 : noValue.status, 2, '--root 缺值必须未判定(2),不得回落默认根')
})

test('R1/R2/R3 夹具:阳性判红、阴性不判(与 --self-test 同一组断言)', () => {
  const root = mkdtempSync(join(tmpdir(), 'license-boundary-test-'))
  try {
    const ledgerRel = `${G.LEDGER_DIR}/copied.json`
    mkdirSync(join(root, G.LEDGER_DIR), { recursive: true })
    writeFileSync(join(root, ledgerRel), JSON.stringify(G.FIXTURE_LEDGER, null, 2), 'utf8')
    for (const [rel, content] of Object.entries(G.FIXTURE_FILES)) {
      const abs = join(root, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, content, 'utf8')
    }
    const res = G.runCheck(root, { files: G.listDiskFiles(root) })
    const byRule = new Map()
    for (const v of res.violations) {
      if (!byRule.has(v.rel)) byRule.set(v.rel, [])
      byRule.get(v.rel).push(v.rule)
    }
    for (const [rel, expected] of Object.entries(G.EXPECTED)) {
      const got = byRule.get(rel) ?? []
      assert.deepEqual(got.sort(), [...expected].sort(), `阳性夹具 ${rel}:期望 [${expected.join(',')}],实得 [${got.join(',')}]`)
    }
    for (const rel of Object.keys(G.FIXTURE_FILES)) {
      if (G.EXPECTED[rel]) continue
      const got = byRule.get(rel) ?? []
      assert.deepEqual(got, [], `阴性夹具 ${rel} 不应判红,实得 [${got.join(',')}]`)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('R2 纯函数:注释/散文提及不命中,导入 / require / 调用 / 成员访问形态命中', () => {
  assert.equal(G.rejectedMatch('WeChatFerry', '// WeChatFerry 或 mock 桥,仅作文档参照'), false)
  assert.equal(G.rejectedMatch('AstrBot', '// 备注:曾评估 AstrBot 框架'), false)
  assert.equal(G.rejectedMatch('pywechat', "const w = require('pywechat-sdk')"), true)
  assert.equal(G.rejectedMatch('AstrBot', 'import AstrBot'), true)
  assert.equal(G.rejectedMatch('wx4py', 'wx4py.init()'), true)
  assert.equal(G.rejectedMatch('WeChatPadGo', 'WeChatPadGo.client.send()'), true)
  // ChatLabel 这类含 "chatlab" 子串的自造词不得被误命中
  assert.equal(G.rejectedMatch('chatlab', 'addedToChatLabel'), false)
})

test('白名单口径:docs/licensing 前缀与本门自身按规则放行,普通路径不放行', () => {
  assert.equal(G.inWhitelist('docs/licensing/third-party-audit.md', 'R2'), true)
  assert.equal(G.inWhitelist('docs/licensing/third-party-audit.md', 'R3'), true)
  assert.equal(G.inWhitelist('scripts/check-third-party-license-boundary.mjs', 'R1'), true)
  assert.equal(G.inWhitelist('scripts/check-third-party-license-boundary.mjs', 'R2'), true)
  assert.equal(G.inWhitelist('scripts/tests/check-third-party-license-boundary.test.mjs', 'R1'), true)
  assert.equal(G.inWhitelist('scripts/tests/check-third-party-license-boundary.test.mjs', 'R2'), true)
  // 既有台账守门仅 R1 豁免夹具字符串,R2/R3 不享受白名单
  assert.equal(G.inWhitelist('scripts/provenance-ledger.mjs', 'R1'), true)
  assert.equal(G.inWhitelist('scripts/provenance-ledger.mjs', 'R2'), false)
  assert.equal(G.inWhitelist('scripts/provenance-ledger.mjs', 'R3'), false)
  assert.equal(G.inWhitelist('apps/api/src/services/wechat-hub/views.ts', 'R2'), false)
})

test('允许集不含传染 / 非商业许可证;被拒标识清单完整', () => {
  for (const forbidden of ['AGPL-3.0', 'AGPL-3.0-or-later', 'CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0', 'GPL-3.0', 'OFL-1.1']) {
    assert.equal(G.ALLOWED_SPDX.includes(forbidden), false, `${forbidden} 不应在允许集`)
  }
  for (const ident of ['wcferry', 'WeChatFerry', 'pywechat', 'pyweixin', 'wx4py', 'WeChatPadGo', 'weflow', 'AstrBot', 'chatlab']) {
    assert.ok(G.REJECTED_IDENTIFIERS.includes(ident), `被拒清单缺 ${ident}`)
  }
})

test('台账登记面可读:roots 不为空且每条带来源字段', () => {
  const ledger = G.loadLedger(REAL_ROOT)
  assert.ok(ledger.length > 0, '台账 roots 枚举为空')
  for (const entry of ledger) {
    assert.ok(typeof entry.root === 'string' && entry.root.length > 0)
    assert.ok(typeof entry.source === 'string' && entry.source.endsWith('.json'))
  }
})
