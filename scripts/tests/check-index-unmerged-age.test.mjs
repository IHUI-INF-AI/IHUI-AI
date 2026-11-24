#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:check-index-unmerged-age.mjs(index 烂尾哨兵)+ git-guardian 的 auditIndexUnmerged 派发层。
 * 判据全部 import 生产实现(§22c:禁止在测试里复制一份判据常量)。
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as probe } from '../check-index-unmerged-age.mjs'
import { __test__ as guardian } from '../git-guardian.mjs'

function dirnameOfScript() {
  return fileURLToPath(new URL('..', import.meta.url))
}

const { parseUnmergedPaths, unmergedKey, classifyUnmerged } = probe
const { auditIndexUnmerged } = guardian

test('parseUnmergedPaths:换行与 -z(NUL)两种分隔都解出路径且去重排序', () => {
  const nl = '100644 aaa 1\tA.md\n100644 bbb 2\tA.md\n100644 ccc 3\tB.ts\n'
  assert.deepEqual(parseUnmergedPaths(nl), ['A.md', 'B.ts'])
  const z = '100644 aaa 1\tA.md\u0000100644 bbb 3\tB.ts\u0000'
  assert.deepEqual(parseUnmergedPaths(z), ['A.md', 'B.ts'])
  // NUL 输出里混入无制表符的噪声记录必须被跳过,不得产出空串。
  assert.deepEqual(parseUnmergedPaths('noise\u0000more\u0000'), [])
})

test('unmergedKey:集合序无关稳定,集合一变即变(身份不取抖动量)', () => {
  assert.equal(unmergedKey(['a', 'b']), unmergedKey(['b', 'a']))
  assert.notEqual(unmergedKey(['a', 'b']), unmergedKey(['a', 'b', 'c']))
})

test('classifyUnmerged 四分支:clean / 新现场重置 / 未超龄 fresh / 超龄 stale', () => {
  const now = Date.now()
  assert.equal(classifyUnmerged({ paths: [], state: null, now }).overall, 'clean')
  // 状态 key 与当前集不符 → 新现场:重置 firstSeen=now,报 fresh。
  const fresh = classifyUnmerged({ paths: ['A.md'], state: { key: 'other', firstSeen: now - 9 * 60_000 }, now })
  assert.equal(fresh.overall, 'fresh')
  assert.equal(fresh.nextState.firstSeen, now)
  // 同 key 未超龄 → fresh(正常合并进行中)。
  const key = unmergedKey(['A.md'])
  const still = classifyUnmerged({ paths: ['A.md'], state: { key, firstSeen: now - 9 * 60_000 }, now })
  assert.equal(still.overall, 'fresh')
  // 同 key 超龄 → stale。
  const stale = classifyUnmerged({ paths: ['A.md'], state: { key, firstSeen: now - 16 * 60_000 }, now })
  assert.equal(stale.overall, 'stale')
  assert.equal(stale.count, 1)
})

test('auditIndexUnmerged:stale 到人、fresh 只记日志、clean 静默、节流窗口内不派生', async () => {
  const dir = mkScratch('index-unmerged-')
  try {
    const tickFile = join(dir, 'tick.json')
    const logs = []
    const mails = []
    const base = {
      tickFile,
      logger: (s) => logs.push(s),
      notify: (name, detail, opts) => mails.push({ name, detail, opts }),
      now: Date.now(),
    }
    const mkRunner = (payload) => () => ({ ok: payload.overall !== 'stale', status: payload.overall === 'stale' ? 1 : 0, out: JSON.stringify(payload) })
    // stale:notify 必须被调,身份固定 dedupKey。
    const r1 = await auditIndexUnmerged({ ...base, runner: mkRunner({ overall: 'stale', count: 2, ageMin: 31, detail: 'x' }) })
    assert.equal(r1.overall, 'stale')
    assert.equal(mails.length, 1)
    assert.equal(mails[0].opts.dedupKey, 'index-unmerged-stale')
    // fresh:不喊人。
    const r2 = await auditIndexUnmerged({ ...base, now: Date.now() + 16 * 60_000, runner: mkRunner({ overall: 'fresh', count: 1, ageMin: 3, detail: 'x' }) })
    assert.equal(r2.overall, 'fresh')
    assert.equal(mails.length, 1)
    // undetermined:只 ⚠️ 不喊人(§0.3)。
    const r3 = await auditIndexUnmerged({ ...base, now: Date.now() + 32 * 60_000, runner: mkRunner({ overall: 'undetermined', detail: 'git 不可用' }) })
    assert.equal(r3.overall, 'undetermined')
    assert.equal(mails.length, 1)
    // 节流:窗口内再次调用必须 ran=false,不派生 runner。
    let runnerCalled = false
    const r4 = await auditIndexUnmerged({
      ...base,
      runner: () => {
        runnerCalled = true
        return { ok: true, status: 0, out: JSON.stringify({ overall: 'clean' }) }
      },
    })
    assert.equal(r4.ran, false)
    assert.equal(runnerCalled, false)
    // clean:心跳行必须有(这一格判别人的烂尾,自己哑了没人知道)。
    const r5 = await auditIndexUnmerged({ ...base, now: Date.now() + 48 * 60_000, runner: mkRunner({ overall: 'clean' }) })
    assert.equal(r5.overall, 'clean')
    assert.ok(logs.some((s) => s.includes('✅ index 烂尾哨兵')))
  } finally {
    rmScratch(dir)
  }
})

test('auditIndexUnmerged:真实装车路径(尺子在位,当前 index 已清偿 ⇒ clean)+ 直跑冒烟', async () => {
  const dir = mkScratch('index-unmerged-live-')
  try {
    const r = await auditIndexUnmerged({
      tickFile: join(dir, 'tick.json'),
      logger: () => {},
      notify: () => {},
      now: Date.now(),
    })
    // 装车证明:真实脚本在位 ⇒ ran=true 且判出真实结论(clean;清偿完成后不应再有 unmerged)。
    assert.equal(r.ran, true)
    assert.equal(r.overall, 'clean')
    // 直跑生产脚本兜底:退出码必须是 0 且文案带哨兵名。
    const res = execFileSync(process.execPath, [join(dirnameOfScript(), 'check-index-unmerged-age.mjs')], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.ok(String(res).includes('index 烂尾哨兵'))
  } finally {
    rmScratch(dir)
  }
})

// 形态锁:状态文件路径锚定在仓内 state 目录(不得漂到盘根/仓外,§15/§15b)。
test('STATE_FILE 落点形态', () => {
  assert.ok(probe.STATE_FILE.replaceAll('\\', '/').endsWith('.ihui-agent/state/index-unmerged-state.json'))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
