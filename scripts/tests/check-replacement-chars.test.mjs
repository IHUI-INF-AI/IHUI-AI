// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:判据的形态与接线,只能用真实文件 + 构造面证明,不得在测试里再抄一份源判据。
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as gate } from '../check-replacement-chars.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GIT = process.env.IHUI_GIT_BIN || 'git'
const SCRIPT = 'scripts/check-replacement-chars.mjs'
const REPL = String.fromCharCode(0xfffd)

const headBlob = (rel) =>
  execFileSync(GIT, ['-C', ROOT, '-c', 'safe.directory=*', '-c', 'core.quotePath=false', 'show', `HEAD:${rel}`], {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 28,
    encoding: 'utf8',
  })

/**
 * T1/T2 装车证明与摘线方向锁 —— 读 **HEAD 面的 runner**,不读磁盘。
 * 磁盘那份常年滞后(旁路落地只推 HEAD/索引),按磁盘判会把刚接进去的门读成"未接"。
 */
function registrationOf(text) {
  const blocks = text.split(/\n  {\n/).slice(1)
  return blocks.find((b) => b.includes(`script: '${SCRIPT.split('/').pop()}'`) || b.includes(`script: "${SCRIPT.split('/').pop()}"`)) || null
}

test('T1 门已接进 runner 且定级为 blocking、skipEnv 在位(读 HEAD 面)', () => {
  const block = registrationOf(headBlob('scripts/guardian-runner.mjs'))
  assert.ok(block, 'runner 的 HEAD 面里没有 check-replacement-chars.mjs 的注册块 ⇒ 未装车')
  assert.match(block, /mode: 'blocking'/, '本门必须 blocking —— warn 等于判对了也不打断提交(守门 105 那一课)')
  assert.match(block, /skipEnv: 'HUSKY_SKIP_REPLACEMENT_CHARS'/, '缺应急开关会让真出事时只能手改注册表')
  assert.match(block, /id: '\d+'/)
})

test('T2 摘线不得被读成已装车(反向对照)', () => {
  const real = registrationOf(headBlob('scripts/guardian-runner.mjs'))
  assert.ok(real, '前置:本门此刻必须已注册,否则这条反向锁是无牙的')
  const stripped = headBlob('scripts/guardian-runner.mjs').replace(real, '')
  assert.equal(registrationOf(stripped), null, '把注册块删掉后必须判"未注册"')
})

test('T3 取材面纪律:门体必须走 face-reader 的读取入口,不得散写 git / 按磁盘判被审内容', () => {
  const src = headBlob(SCRIPT)
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '未引取材层 ⇒ 守门 118 会把它判成 loose')
  assert.match(src, /catBatch\(/, '内容必须经 catBatch 取被审面')
  assert.doesNotMatch(src, /execFileSync\([^)]*'show',\s*\[`HEAD:/, '不得再自己散写 git show 读被审内容')
  assert.match(src, /selectFace\(/, '面选择必须走层的 selectFace(两面旗同给由它判死)')
})

test('T4 遮罩只许一份实现:必须引 code-mask,不得自带注释状态机', () => {
  const src = headBlob(SCRIPT)
  assert.match(src, /from '\.\/lib\/code-mask\.mjs'/)
  assert.match(src, /maskedSpans\(/)
  assert.doesNotMatch(src, /function\s+scanCommentSpans|let\s+inBlockComment\s*=/, '第二份分词器就是本仓记过最多次的漂移源')
})

test('T5 判据有牙:替换符数得出、完好文本不计、取不到不得冒充 0', () => {
  assert.equal(gate.occ('a ' + REPL + ' b'), 1)
  assert.equal(gate.occ('没有替换符的一行'), 0)
  assert.equal(gate.occ(null), null, '取不到必须是 null —— 把没判写成 0 是本仓最高频失效型')
})

test('T6 outsideComments 成对:只动注释⇒全等,动代码⇒必不等', () => {
  const clean = '// 中文说明\nconst a = 1\n'
  const damaged = '// 中文' + REPL + '说明\nconst a = 1\n'
  assert.equal(gate.outsideComments(clean), gate.outsideComments(damaged))
  assert.notEqual(gate.outsideComments(clean), gate.outsideComments(clean.replace('a = 1', 'a = 2')))
})

test('T7 自检登记侧必须真求值(守门 156 那一型:cond 传函数 ⇒ 恒绿)', () => {
  const src = headBlob(SCRIPT)
  const bad = /^\s*t\([^,]+,\s*\(?(\)|async)/gm
  assert.doesNotMatch(src, bad, 'self-test 不得把箭头函数当断言传给登记函数')
})

test('T8 存量与新增分档:全量档不得因存量判红', () => {
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  const out = execFileSync(process.execPath, [resolve(ROOT, SCRIPT)], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 1 << 28 })
  assert.match(out, /面=head/, '全量档必须自报判定面')
  assert.match(out, /只报数|零 U\+FFFD/, '有存量时必须写明"只报数",不得静默')
})

test('T9 未判定与通过不得同色:枚举到 0 个源码文件必须判死', () => {
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  const out = execFileSync(process.execPath, [resolve(ROOT, SCRIPT), '--self-test'], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 1 << 28 })
  assert.match(out, /self-test: \d+ 通过 \/ 0 失败/, '自检必须现跑现绿')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
