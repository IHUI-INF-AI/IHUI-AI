#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * restore-deploy-generated-summary.test.mjs — 产出层改造(治部署日志洪水)的 §22c 镜像测试
 *
 * 2026-10-29 立。判据一律 import 源文件的 `__test__`,本档不复制任何聚合/无害判定实现。
 * CLI 端到端夹具全部现造临时仓(§15c ⇒ 唯一落点 mkScratch),不碰真生产签出;
 * --apply 只在夹具仓上跑(备份根与明细落点都用 env 钉进夹具)。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', 'restore-deploy-generated.mjs')

// 备份根与明细落点必须在 import 源文件之前就钉到夹具里(源里是模块级读 env)
const base = mkScratch('restore-deploy-generated-summary')
process.env.IHUI_DEPLOY_GENERATED_BACKUP = join(base, 'backups')
const DETAIL = join(base, 'state', 'deploy-generated-yield.jsonl')
process.env.IHUI_DEPLOY_GENERATED_DETAIL = DETAIL
const { __test__: T } = await import(pathToFileURL(SRC).href)

const git = (args, cwd) =>
  execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

function mkPlan(noisy = 0, blocked = 0) {
  const actions = []
  for (let i = 0; i < noisy; i++) actions.push({ rel: `apps/web/.next/build/chunks/noise-${i}.js`, tier: 'untracked-unique', action: 'HANDS-OFF' })
  for (let i = 0; i < blocked; i++) actions.push({ rel: `blocked-${i}.txt`, tier: 'tracked-dirty-unlisted', action: '不动(不在封闭清单 ⇒ 可能是真人在写)' })
  return { backupDir: join(base, 'unused-backup'), actions, blocked: blocked > 0 }
}

const summaryOf = (plan, extra = {}) =>
  T.buildSummaryLines({ mode: 'DRY-RUN', repo: 'R:\\fixture', plan, applied: null, elapsedMs: 12, detailFile: DETAIL, ...extra })

test('① 默认产出是聚合形态:全单行读数,不含逐文件 JSON 对象,行数与文件数解耦', () => {
  const s = summaryOf(mkPlan(8000, 3))
  assert.ok(s.lines.length <= 10, `8003 枚条目聚出 ${s.lines.length} 行 ⇒ 聚合失效,洪水回来了`)
  for (const l of s.lines) {
    assert.match(l, /^GEN-YIELD/, `每行必须是单行读数形态(实得 ${l.slice(0, 40)})`)
    assert.ok(!/^\s*[{}]/.test(l), `默认产出不得出现逐文件 JSON 对象行(实得 ${l.slice(0, 40)})`)
    assert.ok(!l.includes('"rel":'), `默认产出不得内嵌 JSON 明细键(实得 ${l.slice(0, 40)})`)
  }
  assert.match(s.lines[0], /actions=8003/, '首行必须报总条目数')
  assert.match(s.lines[0], /alerts=3\b/, '首行必须报非无害条目数')
  assert.match(s.lines[0], /blocked=true/, 'blocked 必须在首行如实读出')
})

test('② --verbose 保留旧逐文件多行 JSON 对象形态(取证/调试出口)', () => {
  const dump = T.renderVerboseDump({ mode: 'DRY-RUN', repo: 'R', ...mkPlan(5, 1) })
  assert.match(dump, /"rel":/, 'verbose 档必须仍是逐文件 JSON 对象')
  assert.ok(dump.split(/\r?\n/).length > 20, `6 枚条目只出 ${dump.split(/\r?\n/).length} 行 ⇒ 不是旧的 null,1 多行形态`)
})

test('③ 非无害条目仍逐条点名(上限内一条不漏)', () => {
  const s = summaryOf(mkPlan(500, 3))
  const alerts = s.lines.filter((l) => l.startsWith('GEN-YIELD-ALERT '))
  assert.equal(alerts.length, 3, `3 枚"不动"条目只点名了 ${alerts.length} 枚`)
  for (let i = 0; i < 3; i++) assert.ok(s.lines.some((l) => l.includes(`rel=blocked-${i}.txt`)), `blocked-${i}.txt 未被点名`)
  assert.ok(!s.lines.some((l) => l.includes('未列出')), '未超限却写"另有 N 条" = 谎报')
})

test('④ 超限提示:点名截到 ALERT_LINE_CAP,"另有 N 条"计数正确且指向落盘文件', () => {
  const total = T.ALERT_LINE_CAP + 10
  const s = summaryOf(mkPlan(0, total))
  const alerts = s.lines.filter((l) => l.startsWith('GEN-YIELD-ALERT '))
  assert.equal(alerts.length, T.ALERT_LINE_CAP, `点名行数 ${alerts.length} ≠ 现读上限 ${T.ALERT_LINE_CAP}`)
  const tail = s.lines.find((l) => l.startsWith('GEN-YIELD-ALERT-TAIL'))
  assert.ok(tail, '超限却没有 TAIL 行 ⇒ 读者以为清单完整')
  assert.match(tail, new RegExp(`另有 ${total - T.ALERT_LINE_CAP} 条未列出`), `TAIL 计数错(实得 ${tail})`)
  assert.ok(tail.includes(DETAIL), 'TAIL 必须指向逐条落盘的机读清单文件')
})

test('⑤ 无害/非无害判定分桶钉死(源实现唯一真相,§22c)', () => {
  for (const harmless of ['HANDS-OFF', '盘上已无此文件(无需让位)', '备份后让位', '备份后让位(内容与 tip 同一枚 blob)', '备份后复原到 HEAD', '已备份并移除', '已备份并复原到 HEAD']) {
    assert.equal(T.isNonHarmlessOutcome(harmless), false, `${harmless} 必须判无害(否则洪水换个前缀继续淹)`)
  }
  for (const blocking of ['不动(不在封闭清单 ⇒ 可能是真人在写)', '不动(索引≠HEAD ⇒ 暂存的是别人/别的轮的活)', '失败(未动盘):boom']) {
    assert.equal(T.isNonHarmlessOutcome(blocking), true, `${blocking} 必须判非无害并点名`)
  }
})

test('⑥ 读数不得断行:结果里混进 \\n(异常原文)也必须折成单行', () => {
  const plan = { backupDir: 'X', actions: [{ rel: 'x.txt', tier: 'tracked-generated', action: '备份后复原到 HEAD' }], blocked: false }
  const applied = { done: [{ rel: 'x.txt', result: '失败(未动盘):first line\nsecond line' }] }
  const s = summaryOf(plan, { applied, mode: 'APPLY' })
  for (const l of s.lines) assert.ok(!l.includes('\n'), `产出行内含换行(断行违规): ${JSON.stringify(l.slice(0, 60))}`)
  const alert = s.lines.find((l) => l.startsWith('GEN-YIELD-ALERT '))
  assert.match(alert, /first line second line/, '多行异常原文应折成一行保留')
})

test('⑦ CLI 端到端(夹具仓):默认档行数与文件数解耦、明细落 JSONL;--verbose 仍出全量;--apply 分支真动盘且退出码 0', () => {
  const repo = join(base, `cli-${Math.random().toString(36).slice(2, 8)}`)
  mkdirSync(join(repo, 'apps', 'web', 'public'), { recursive: true })
  git(['init', '-q', '-b', 'main'], repo)
  git(['-c', 'user.name=t', '-c', 'user.email=t@e', 'commit', '-q', '--no-verify', '--allow-empty', '-m', 'base'], repo)
  const sw = join(repo, 'apps', 'web', 'public', 'sw.js')
  writeFileSync(sw, 'const V = 1\n', 'utf8')
  git(['add', 'apps/web/public/sw.js'], repo)
  git(['-c', 'user.name=t', '-c', 'user.email=t@e', 'commit', '-q', '--no-verify', '-m', 'track sw.js'], repo)
  writeFileSync(sw, 'const V = 2 // 构建重写\n', 'utf8') // 索引==HEAD ∧ 盘上≠HEAD ⇒ 登记过的 trackedYield 档
  mkdirSync(join(repo, 'apps', 'web', '.next', 'build', 'chunks'), { recursive: true })
  for (let i = 0; i < 120; i++) writeFileSync(join(repo, 'apps', 'web', '.next', 'build', 'chunks', `noise-${i}.js`), `x${i}\n`, 'utf8')

  const runCli = (args) =>
    execFileSync(process.execPath, [SRC, '--repo', repo, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

  // 默认档:聚合 + 明细落盘(退出码 0 = execFileSync 不抛)
  rmSync(DETAIL, { force: true })
  const quiet = runCli([])
  const quietLines = quiet.split(/\r?\n/).filter(Boolean)
  assert.ok(quietLines.length <= 12, `默认档 121 枚条目打出 ${quietLines.length} 行 ⇒ 洪水没治住`)
  assert.match(quietLines[0], /^GEN-YIELD mode=DRY-RUN .*actions=121/, `首行读数形态错(实得 ${quietLines[0]})`)
  assert.ok(existsSync(DETAIL), '明细必须落盘成机读 JSONL')
  const rows = readFileSync(DETAIL, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  assert.equal(rows.length, 121, `JSONL 行数应等于逐条明细数(实得 ${rows.length})`)
  assert.ok(rows.every((r) => r.rel && r.kind === 'action'), 'JSONL 每行必须是含 rel/kind 的机读记录')

  // verbose 档:旧逐文件多行 JSON 对象仍在
  const loud = runCli(['--verbose'])
  assert.match(loud, /"rel":/, '--verbose 必须保留逐文件 JSON 对象')
  assert.ok(loud.split(/\r?\n/).length > quietLines.length * 8, `verbose(${loud.split(/\r?\n/).length} 行)与默认档(${quietLines.length} 行)没有量级差 ⇒ 默认档没聚合`)

  // apply 档:登记过的 sw.js 真被复原到 HEAD,APPLY 桶计数进汇总,退出码仍 0
  const applied = runCli(['--apply'])
  // git checkout 按 autocrlf 回写可能带 \r\n ⇒ 语义是"内容回到 HEAD 版本",按换行归一比较
  assert.equal(readFileSync(sw, 'utf8').replace(/\r\n/g, '\n'), 'const V = 1\n', '--apply 分支必须真把生成物复原到 HEAD')
  assert.match(applied.split(/\r?\n/)[0], /^GEN-YIELD mode=APPLY /, 'apply 档首行必须写明 mode=APPLY')
  assert.match(applied, /bucket=APPLY\|已备份并复原到 HEAD count=1/, `APPLY 桶计数缺失(实得 ${applied.split(/\r?\n/).join(' ⏎ ').slice(0, 300)})`)
  const applyRows = readFileSync(DETAIL, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  assert.ok(applyRows.some((r) => r.kind === 'applied'), 'apply 结果也必须逐条落 JSONL')
})

process.on('exit', () => {
  try {
    rmScratch(base)
  } catch {
    /* Windows 偶发句柄占用:临时目录自清 */
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
