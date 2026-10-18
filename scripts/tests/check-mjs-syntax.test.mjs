// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:判据 import 源脚本的 __test__,本文件不复制第二份。
// 本票锁四件事:① 装车证明(注册条目 blocking + skipEnv 成套;枚内时序:本枚提交落地前
//    HEAD 里还没有 221,所以装车面读**工作树 runner**,并用门 89 自家的 idsOfRegistry 预验 R5
//    无撞号(219/220 是并发表的既有门,本门改挂 221 —— 撞号会静默顶掉别人的门,故断言恰好一枚且无重号;
//    落地后同一断言由 check-gate-wiring R5 在 HEAD 面长期守);② README 点名(R4 义务);
// ③ 真仓 CLI 三档(全量/索引面读通 + 两面旗同给 exit 2);④ "只解析不执行"的形状锁。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-mjs-syntax.mjs'
import { idsOfRegistry } from '../check-gate-wiring.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-mjs-syntax.mjs')
const stdio = ['ignore', 'pipe', 'pipe']

const run = (args = []) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300_000,
    stdio,
  })

test('装车证明:工作树 runner 有 id 221 条目,blocking + skipEnv 成套,且 idsOfRegistry 无撞号(门 89 R5 预验)', () => {
  const text = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const i = text.indexOf("'check-mjs-syntax.mjs'")
  assert.ok(i > -1, '门体未插进提交链注册表')
  const block = text.slice(Math.max(0, i - 500), i + 1200)
  assert.match(block, /mode:\s*'blocking'/, '须为 blocking')
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_MJS_SYNTAX'/, 'blocking 门必须成套带 skipEnv')
  assert.ok(!/stagedTriggers:\s*\[\s*\]/.test(block), '禁止空 stagedTriggers 数组(归一层当场抛错,R8 同型)')
  const ids = idsOfRegistry(text)
  const mine = ids.filter((v) => String(v) === '221')
  assert.equal(mine.length, 1, `id 221 应恰好登记一枚,实得 ${mine.length}`)
  const dupes = ids.filter((v, k) => ids.indexOf(v) !== k)
  assert.deepEqual(dupes, [], `注册表撞号(门 89 R5 会在 HEAD 面拦):${dupes.join(',')}`)
})

test('R4 点名义务:README 通篇点名本门(判据一句话 + 自检 + 跳过变量)', () => {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
  assert.match(readme, /check-mjs-syntax\.mjs/, 'README 未点名本门')
  assert.match(readme, /HUSKY_SKIP_MJS_SYNTAX/, 'README 点名行须带跳过变量')
})

test('形状锁:解析通道只 compile 不 evaluate(顶层代码绝不执行的实现点)', () => {
  assert.ok(gate.CHILD_SRC.includes('new vm.SourceTextModule'), '子进程必须经 SourceTextModule 编译')
  assert.ok(!gate.CHILD_SRC.includes('.evaluate('), '子进程出现 evaluate 调用 = 开始执行被检文件,判据作废')
  assert.ok(!gate.CHILD_SRC.includes('.link('), '子进程出现 link 调用 = 开始解析依赖,越出纯 parse 承诺')
})

test('判据本体 import 生产实现(§22c 反复制):构造面与门体 --self-test 同判', () => {
  assert.throws(
    () => gate.parseChildOutput('[{"p":"a.mjs","ok":true}]', 2),
    /回数 1 ≠ 送数 2/,
    '截断必须判未判定,不得记绿',
  )
  assert.throws(() => gate.parseChildOutput('{"__fatal__":"no-SourceTextModule"}', 1), /自报致命/)
  const loc = gate.locateSyntaxError('C:\\t\\probe.mjs:2\n/\n^\n\nSyntaxError: missing /\n')
  assert.equal(loc.line, 2)
  assert.equal(gate.decideStatus({ face: 'head', freshCount: 0, stockCount: 1, strict: false }), 0, '存量不拦全量档(§12e)')
  assert.equal(gate.decideStatus({ face: 'staged', freshCount: 1, stockCount: 0, strict: false }), 1, '新增臂必须有牙')
})

test('真仓正控:全量档与 --staged 都读通,且扫描面是千枚级(不是枚举 0 的假绿)', () => {
  const full = run([])
  assert.equal(full.status, 0, `全量档应 0(存量只报数),实得 ${full.status}:\n${full.stdout}\n${full.stderr}`)
  assert.match(full.stdout, /\.mjs 语法对账\(head 面/)
  const staged = run(['--staged'])
  assert.equal(staged.status, 0, `索引面零新增应 0,实得:\n${staged.stdout}\n${staged.stderr}`)
  const json = JSON.parse(run(['--json']).stdout.trim().split('\n').pop())
  assert.ok(json.scanned > 1000, `真仓 .mjs 应千枚级,实得 ${json.scanned}`)
  assert.equal(json.face, 'head')
})

test('真仓反控:两面旗同给 ⇒ exit 2 未判定(不回落任一面)', () => {
  const both = run(['--staged', '--worktree'])
  assert.equal(both.status, 2, both.stdout + both.stderr)
  assert.match(both.stdout + both.stderr, /未判定/)
})

test('自检本体真跑通(交付前置):--self-test 全过且点名例数', () => {
  const st = run(['--self-test'])
  assert.equal(st.status, 0, `${st.stdout}\n${st.stderr}`)
  assert.match(st.stdout, /✅ 自检 \d+\/\d+ 例全过/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
