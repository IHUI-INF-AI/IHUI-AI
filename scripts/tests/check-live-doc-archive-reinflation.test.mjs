#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 216(活文档归档回灌对账)的 §22c 镜像测试。
 *
 * 判据一律 import 门体的 __test__ 导出,**不在测试里复制一份形态清单/正则**(§22c 红线:
 * 复制 = 第二份真相,门改了判据而测试仍绿,正是本仓记过多次的安静失效)。
 * 与门内 --self-test 的分工:自检 = 纯函数注入(无 git、快);本文件 = 真仓面上端到端,
 * 证明"这一道在真仓库里给出的读数与它的自述一致",并钉住"未注册时头注不得自称已接线"。
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..')
const { __test__: G } = await import(pathToFileURL(path.join(REPO, 'scripts', 'check-live-doc-archive-reinflation.mjs')).href)

const git = (args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, maxBuffer: 128 * 1024 * 1024 })

const lineAt = (i) => `归档正文第 ${i + 1} 行 —— 这一行有足够长度与信息量,用来验证段长门槛两侧的行为`

function face(n) {
  const text = Array.from({ length: n }, (_, i) => lineAt(i)).join('\n')
  const set = new Set(Array.from({ length: Math.max(n, 1) }, (_, i) => lineAt(i)).map((l) => G.normalizeLine(l)))
  return { text, set }
}

test('T1 段长门槛取自门体常量:RUN_MIN-1 放过 / RUN_MIN 判红(两侧都钉,防止只改一边)', () => {
  const below = face(G.RUN_MIN - 1)
  const at = face(G.RUN_MIN)
  assert.equal(G.findReinflation('AGENTS.md', below.text, at.set).length, 0, `门槛之下必须绿(现读 RUN_MIN=${G.RUN_MIN})`)
  assert.equal(G.findReinflation('AGENTS.md', at.text, at.set).length, 1, '门槛上沿必须红 —— 摘掉判据这一格就当场失效')
})

test('T2 水印行与归档指针注记两条反证各不参与段长(摘掉反证会把每份带水印文件互判成回灌)', () => {
  const wm = `// [IHUI-AI-PROVENANCE]:零宽载荷那一行在两处逐字相同,长度也够 —— 但它不是正文回灌`
  const ptr = '<!-- 已归档(2026-10-14:整区逐字归档于 .ihui-agent/archive/AGENTS_x.md,完整内容在归档件) -->'
  assert.equal(G.substantive(wm), false, '水印横幅必须被反证拦住')
  assert.equal(G.substantive(ptr), false, '§1 第②步要求的指针注记形态不得判红,否则门锁死正当出路')
  const set = new Set([G.normalizeLine(wm), G.normalizeLine(ptr)])
  assert.equal(G.findReinflation('AGENTS.md', Array(G.RUN_MIN + 3).fill(wm).concat(Array(G.RUN_MIN + 3).fill(ptr)).join('\n'), set).length, 0)
})

test('T3 归一只剥换行与行尾空白:模糊化会把"引用"读成"抄回"(刻意不放宽的反证)', () => {
  const f = face(G.RUN_MIN)
  assert.equal(G.findReinflation('AGENTS.md', f.text.split('\n').map((l) => l + '  \r').join('\n'), f.set).length, 1, 'CRLF/行尾空格归一后仍逐字命中')
  const skewed = f.text.split('\n').map((l) => l.replace('第 ', '第')).join('\n')
  assert.equal(G.findReinflation('AGENTS.md', skewed, f.set).length, 0, '一处字符差即不命中 —— 归一化不得做模糊')
})

test('T4 真仓 HEAD 面读数与自述一致:对照面为空只能落未判定,绝不得冒绿', () => {
  const files = G.listArchiveFace(REPO, 'head')
  const r = G.audit(REPO, 'head')
  if (files.length === 0) {
    assert.equal(r.state, 'undetermined', '对照面枚举到 0 个归档件 ⇒ §0.3 判死,不记绿也不冒红')
    assert.match(r.why, /0 个文件/, '未判定必须点名原因')
  } else {
    assert.ok(['pass', 'violation'].includes(r.state), `对照面有 ${files.length} 件时读数只能是 pass/violation,实得 ${r.state}`)
  }
})

test('T5 两面旗同给 ⇒ exit 2(同面同轮纪律,不给混面留口子)', async () => {
  const mod = await import(pathToFileURL(path.join(REPO, 'scripts', 'check-live-doc-archive-reinflation.mjs')).href)
  const rc = mod.main(['--staged', '--worktree'])
  assert.equal(rc, 2, '一面判完再判另一面会产出两个不同结论 —— 同给必须拒判')
})

test('T6 形状锁:门体头注不得自称已接入提交链(§22c 未注册反证,注册后必须同批改头注)', () => {
  const src = readFileSync(path.join(REPO, 'scripts', 'check-live-doc-archive-reinflation.mjs'), 'utf8')
  const runner = git(['show', 'HEAD:scripts/guardian-runner.mjs'])
  const registered = runner.includes('check-live-doc-archive-reinflation.mjs')
  if (!registered) {
    assert.match(src, /尚未.{0,12}接入提交链/, '未注册时头注必须自述未注册 —— 否则守门 89 R1 把"文档声称已接"当真')
    assert.doesNotMatch(src, /注册条目见 .{0,40}guardian-runner\.mjs 的 id/, '头注不得点名一条并不存在的注册条目')
  } else {
    assert.match(src, /guardian-runner\.mjs/, '已注册则头注必须指向注册条目并按其现值写 mode/skipEnv')
  }
})

test('T7 被审清单就是那两份逐字注入对话的活文档,不得被扩成任意 md(扩面即造恒红)', () => {
  assert.deepEqual(G.DOC_PATHS, ['AGENTS.md', 'README.md'], '射程由"回灌的真实代价"定,不由"能扫多少"定')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('T8 对照面取归档目录下全部 .md,不再限定 AGENTS 族(限族=对已发生的台账侧回灌全盲)', () => {
  for (const n of [
    'AGENTS_full-pre-compact-2026-10-14.md',
    'AGENTS_dedup-removed-2026-10-15.md',
    'PROJECT_PLAN_ARCHIVE.md',
    'plan-pointer-purge-2026-10-14-d4634eb6.md',
  ]) assert.ok(G.ARCHIVE_FILE_RE.test(n), `${n} 必须进对照面 —— 真事故(枚 01bcde1141e)的正文来源就是台账侧归档件`)
  for (const n of ['README.md.bak', 'ledger.jsonl', 'run.log', '.md']) assert.ok(!G.ARCHIVE_FILE_RE.test(n), `${n} 不是 .md,不得进对照面`)
  assert.ok(!G.ARCHIVE_FILE_RE.test('dir/'), '目录名本身不算件')
})
