// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-tasks-merge 的镜像测试(§22c)—— 含**自愈层的独立仓端到端 A/B**。
 *
 * 为什么自愈必须有独立仓证明:它是"会自己提交"的代码。真仓上跑一次只能证明"这次没炸",
 * 证不了三件要紧事:① 有分叉时确实产出前向修复提交;② 没分叉时**绝不**再产出提交(幂等);
 * ③ 它只推进 HEAD/索引,**不改写并发会话的工作树副本**(改了就是越权)。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { healStopReasons, buildMerge } from '../plan-tasks-merge.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const gitQ = (cwd, args) =>
  execFileSync('git', ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e', '-c', 'user.name=e2e', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  })
const PLAN_A = ['# 计划', '', '- [x] ✅(2026-09-20) **D9 同一件事**:做完了。', '- [ ] **D9 同一件事**:另一侧还挂着未勾。', '- [ ] **D8 真待办**:还没人做。', ''].join('\n')

/** 搭一个带分叉夹具的临时 git 仓,并把它的项目根返回给调用方收尾。 */
function fixtureRepo() {
  const dir = mkScratch('plan-merge-e2e')
  const sdst = path.join(dir, 'scripts')
  mkdirSync(sdst, { recursive: true })
  copyScriptWithClosure(path.join(ROOT, 'scripts'), 'plan-tasks-merge.mjs', sdst, ['lib/plan-task-index.mjs'])
  copyScriptWithClosure(path.join(ROOT, 'scripts'), 'check-plan-line-loss.mjs', sdst)
  gitQ(dir, ['init', '-q', '-b', 'main'])
  writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), PLAN_A, 'utf8')
  gitQ(dir, ['add', 'PROJECT_PLAN.md'])
  gitQ(dir, ['commit', '-q', '-m', 'fixture: 一条已做完 + 一条未翻勾的副本'])
  return { dir, entry: path.join(sdst, 'plan-tasks-merge.mjs') }
}

/** 提交条数 —— 必须 trim 后再数:gitQ 不 trim,尾换行会被数成多一条(第一版就假失败在这)。 */
const countCommits = (dir) => gitQ(dir, ['log', '--oneline']).trim().split('\n').filter(Boolean).length

const runHeal = (env) => {
  let code = 0
  let out = ''
  try {
    out = execFileSync(process.execPath, [env.entry, '--heal', '--commit'], {
      cwd: env.dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    })
  } catch (e) {
    code = e.status ?? 1
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
  return { code, out }
}

test('T1 独立仓 A 臂:有分叉 ⇒ 产出恰好一枚只含计划文档的前向修复提交', () => {
  const env = fixtureRepo()
  try {
    const r = runHeal(env)
    if (r.code !== 0) throw new Error(`exit 应为 0,实得 ${r.code}:${r.out}`)
    if (!/自愈落地/.test(r.out)) throw new Error(`输出未点名落地:${r.out.trim()}`)
    const after = gitQ(env.dir, ['show', 'HEAD:PROJECT_PLAN.md'])
    if (!after.includes('**[归并]**')) throw new Error('HEAD 里副本行未翻勾')
    if (!after.includes('- [ ] **D8 真待办**:还没人做。')) throw new Error('真待办被误动')
    const nl = (s) => s.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length
    if (nl(after) !== nl(PLAN_A)) throw new Error(`行数发生变化(应一行不加不删):${nl(PLAN_A)} → ${nl(after)}`)
    const paths = gitQ(env.dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n').filter(Boolean)
    if (paths.length !== 1 || paths[0] !== 'PROJECT_PLAN.md') throw new Error(`修复提交含意外路径:${JSON.stringify(paths)}`)
    if (countCommits(env.dir) !== 2) throw new Error('提交总数应为 2(fixture + 修复)')
  } finally {
    rmScratch(env.dir)
  }
})

test('T2 独立臂:自愈**不得改写工作树副本**(它只推进 HEAD/索引,否则就是替并发会话改盘)', () => {
  const env = fixtureRepo()
  try {
    runHeal(env)
    if (readFileSync(path.join(env.dir, 'PROJECT_PLAN.md'), 'utf8') !== PLAN_A) {
      throw new Error('工作树副本被自愈改写了 —— 越权')
    }
  } finally {
    rmScratch(env.dir)
  }
})

test('T3 独立臂(幂等):已干净时不得再产出任何提交', () => {
  const env = fixtureRepo()
  try {
    const first = runHeal(env)
    if (first.code !== 0) throw new Error(`第一次就失败:${first.out.trim()}`)
    const second = runHeal(env)
    if (second.code !== 0 || !/无状态分叉/.test(second.out)) throw new Error(`第二次应判"无需自愈":${second.out.trim()}`)
    if (countCommits(env.dir) !== 2) throw new Error(`幂等失败:提交数 ${countCommits(env.dir)}(应为 2)`)
  } finally {
    rmScratch(env.dir)
  }
})

test('T4 停手判据是纯函数:四种坏形态各自必须停手,正当结果不得停手', () => {
  const r = buildMerge(PLAN_A, '2026-09-26')
  if (healStopReasons(PLAN_A, r.text, r.changed, 0).length !== 0) throw new Error('正当归并被误停手')
  if (!healStopReasons(PLAN_A, `${r.text}\n多塞一行`, r.changed, 0).join().includes('行数不等')) throw new Error('多塞一行未停手')
  if (!healStopReasons(PLAN_A, PLAN_A, r.changed, 0).join().includes('未归零')) throw new Error('什么都没改却不停手 ⇒ 会把"跑过一次"当成"修好了"')
  if (!healStopReasons(PLAN_A, r.text, r.changed, 2).join().includes('拒写')) throw new Error('有拒写项未停手')
})

test('T5 停手判据必须能认出"偷偷改了一行没登记的东西"', () => {
  const r = buildMerge(PLAN_A, '2026-09-26')
  const tampered = r.text.replace('- [ ] **D8 真待办**:还没人做。', '- [ ] **D8 真待办**:被偷改了。')
  const reasons = healStopReasons(PLAN_A, tampered, r.changed, 0)
  if (!reasons.some((x) => x.includes('未登记行'))) throw new Error(`未登记的改动未被识别:${JSON.stringify(reasons)}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
