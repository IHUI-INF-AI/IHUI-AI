#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 274 的镜像测试:钉「门真的装在提交链上」「地板取自档位表而不是写死的 10」「T1 绝对零的资格仍成立」。
// 判据实现一律从门体 __test__ 调(§22c)。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import { maskComments } from '../lib/code-mask.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = join(ROOT, 'scripts/check-rn-type-floor.mjs')
const RUNNER = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
const GATE_SRC = readFileSync(GATE, 'utf8')
const { __test__ } = await import(pathToFileURL(GATE).href)
const { scanText, stepsFromSource, runSelfTest, SKIP_ENV, SRC_RELS, FIXTURE } = __test__

const run = (args) =>
  spawnSync(process.execPath, [GATE, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 28,
  })

test('① 装车:runner 注册块存在,blocking + skipEnv + 三条 stagedTriggers 成套', () => {
  const at = RUNNER.indexOf("script: 'check-rn-type-floor.mjs'")
  assert.ok(at > 0, 'runner 里没有本门的注册块 ⇒ 头注自称已接线就是假的(门 89 R1/R2)')
  const block = RUNNER.slice(Math.max(0, at - 900), at + 1200)
  assert.match(block, /id:\s*'274'/, '注册块缺 id 274')
  assert.match(block, /mode:\s*'blocking'/, '必须 blocking —— warn 拦不住任何事')
  assert.match(block, new RegExp(`skipEnv:\\s*'${SKIP_ENV}'`), 'skipEnv 与门内 SKIP_ENV 必须同名')
  for (const rel of SRC_RELS)
    assert.ok(
      block.includes(`'${rel}/'`),
      `门内射程枚举有 ${rel} 而 stagedTriggers 没有 ⇒ 改了射程没改触发面(静默失效)`,
    )
})

test('② 编号唯一:代码面上 id 274 只出现一次', () => {
  const code = maskComments(RUNNER)
  assert.equal(
    (code.match(/id:\s*'274'/g) ?? []).length,
    1,
    "撞号或同一对象里写了两枚 id ⇒ 后写的会把先写的静默吞掉(门 89 R13)",
  )
})

test('③ 判据只有一份:镜像 import 门体 __test__', () => {
  assert.match(
    GATE_SRC,
    /export const __test__ = \{[\s\S]*scanText[\s\S]*stepsFromSource/,
    '门体没暴露判据 ⇒ 测试只能复制一份,复制必然漂移(§22c)',
  )
})

test('④ 地板取自档位表最小档,不写死数字', () => {
  const steps = stepsFromSource(FIXTURE)
  assert.ok(steps)
  assert.equal(Math.min(...steps.map((s) => s.size)), 10)
  // 把表里最小档抬高一档,地板必须跟着抬 —— 写死 10 的判据在这里就露馅。
  // 对照用**同一枚字面量 10**:表里有 10 档时它是合法值,表里最小档变 11 时它就是违规。
  const raised = stepsFromSource(FIXTURE.replace('badge: { size: 10', 'badge: { size: 11'))
  assert.equal(Math.min(...raised.map((s) => s.size)), 11, '地板没跟着表动 ⇒ 表里藏了一份死数字')
  assert.equal(scanText('<Text style={{ fontSize: 10 }} />', steps).t1.length, 0, '10 是本档,不该判')
  assert.equal(
    scanText('<Text style={{ fontSize: 10 }} />', raised).t1.length,
    1,
    '把最小档抬到 11 后,同一枚 10 必须翻成违规 —— 否则地板是写死的',
  )
})

test('⑤ 读不出档位表 ⇒ exit 2,不猜地板', () => {
  assert.equal(stepsFromSource('export const A = 1'), null)
  assert.equal(stepsFromSource('/* TYPE_STEPS = {\n ghost: { size: 9 },\n}\n */'), null, '注释里的表算数就是坏尺子')
  const r = run([])
  assert.match(r.stdout, /地板 \d+\(现读 packages\/design-tokens\/src\/typography\.ts 最小档/, '结论行必须自证地板来源')
})

test('⑥ T1 升绝对零的资格锁:工作树(=本枚要落的内容)必须 0 处', () => {
  const r = run(['--worktree'])
  const m = /低于地板: (\d+) 处/.exec(r.stdout)
  assert.ok(m, `读不到 T1 计数:${r.stdout.slice(0, 200)}${r.stderr.slice(0, 200)}`)
  assert.equal(
    Number(m[1]),
    0,
    'T1 在提交链上是绝对零容忍(§0.2 升档前置 = 存量归零)。存量回潮先在这里响,而不是等每个人的 pre-commit 被恒红门堵住。',
  )
})

test('⑦ T2 只报数不判红(有档不取档是第二真相维度,不是可读性缺陷)', () => {
  const steps = stepsFromSource(FIXTURE)
  const r = scanText('<Text style={{ fontSize: 14, lineHeight: 20 }} />', steps)
  assert.equal(r.t1.length, 0)
  assert.ok(r.t2.length >= 1, '恰等于档位的裸数字必须进 T2 普查,否则"有档不取档"就没人量得到')
  const out = run(['--quiet']).stdout + run([]).stdout
  assert.match(out, /有档不取档\(T2,只报数\): \d+ 处/, 'T2 计数不进结论行 = 只判不量')
})

test('⑧ --self-test 真跑通且不是空转', () => {
  assert.equal(runSelfTest(), 0)
  const r = run(['--self-test'])
  assert.equal(r.status, 0, r.stderr.slice(0, 300))
  const m = /自检 (\d+) 组通过/.exec(r.stdout)
  assert.ok(m && Number(m[1]) >= 10, `自检组数不可观测:${r.stdout.slice(0, 160)}`)
})

test('⑨ 两面旗同给 ⇒ exit 2(守门 118)', () => {
  assert.equal(run(['--staged', '--worktree']).status, 2)
})

test('⑩ 跳过变量必须显式留痕', () => {
  const r = spawnSync(process.execPath, [GATE], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, [SKIP_ENV]: '1' },
  })
  assert.equal(r.status, 0)
  assert.match(r.stderr, /已跳过/, '静默记绿就是 §0.10 禁的那一型')
})

test('⑪ 新增档必须真派生:badge 档进了 tokens.css,且门 93 的同源判据现跑为绿', () => {
  // 不在这里重实现"表→CSS 受管块"的逐值对账(那是门 93 R10 的活,§0.6 单源):
  // 这里只钉本票自己新增的那一档有没有落地,然后**现跑**那道同源门。
  const css = readFileSync(join(ROOT, 'packages/design-tokens/src/styles/tokens.css'), 'utf8')
  assert.ok(
    /--text-badge:\s*10px;/.test(css),
    'TYPE_STEPS 加了 badge 而受管块没有 ⇒ 表与 CSS 两份真相(web 侧取不到这一档,RN 就会重新写回裸数字)',
  )
  const g93 = spawnSync(process.execPath, [join(ROOT, 'scripts/check-cross-end-tokens.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 28,
  })
  assert.equal(g93.status, 0, `门 93 判红:受管块与 TS 源不同源 ${(g93.stdout + g93.stderr).slice(-300)}`)
})

test('⑫ R4 点名义务:README 的守门索引里有本门名(文档面读 HEAD blob)', () => {
  const readme = spawnSync('git', ['show', 'HEAD:README.md'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 28,
  })
  assert.equal(readme.status, 0, readme.stderr)
  assert.ok(
    readme.stdout.includes('check-rn-type-floor.mjs'),
    '门已接线而文档未点名 ⇒ 门 89 R4 判红;点名应落 README「守门脚本点名索引」',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
