// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-85 回归锁:git-rebuild-local.mjs 的写锁判据语义。
 *
 * 为什么需要这道锁:该脚本会在判"仓库不健康"后 `rmSync(targetGitDir)` 重建 .git,
 * 而它的写锁保护只有三行。2026-11-07 审计发现判据写反 —— `run(check, allowFail=true)`
 * 成功返回 trim 后 stdout(可能是空串)、失败返回 null;`git-lock.mjs check` 的契约是
 * exit 0 = 无锁 / exit 1 = 有锁。原写法 `!== null` 只在"无锁"时为真 ⇒ **锁被别人持有
 * 时反而跳过整个取锁块直接往下重建**,正是它 2026-09-10 注释里承诺要防的那场事故
 * (两会话互删 .git)。该脚本无 --self-test、无镜像测试,所以这个写反活了两个月。
 *
 * 判据形状(不是复制实现):读源码 + import 生产函数
 * ① check 必须交给 lockHeldBlocksRebuild;null(有锁)拒绝,空串(无锁)不拒绝;
 * ② 该判据下方 12 行内必须有 `process.exit(1)`;
 * ③ acquire 的失败判据仍是 `=== null`;
 * ④ 拿到锁后必须注册 release(否则 fail 路径之外会漏释放);
 * ⑤ `check` 上的 `!== null` 反向写法必须为零。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { __test__ as rebuild } from '../git-rebuild-local.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SRC_PATH = join(here, '..', 'git-rebuild-local.mjs')
const src = readFileSync(SRC_PATH, 'utf8')
const lines = src.split(/\r?\n/)

const CHECK_RE = /lockHeldBlocksRebuild\(run\(`node "\$\{lockScript\}" check`, true\)\)/

function findCheckLine() {
  const idx = lines.findIndex((l) => CHECK_RE.test(l))
  assert.notEqual(idx, -1, '找不到 check 判据行 —— 判据被改名/挪走后本锁失效,必须同步更新')
  return idx
}

test('DBG-85 ①:锁被持有(check 结果 null)必须拒绝继续', () => {
  const idx = findCheckLine()
  assert.match(lines[idx], CHECK_RE)
  assert.equal(rebuild.lockHeldBlocksRebuild(null), true)
  assert.equal(rebuild.lockHeldBlocksRebuild(''), false)
  assert.equal(
    rebuild.lockHeldBlocksRebuild('locked: unit=other'),
    false,
    'exit 0 的 stdout 不是有锁;有锁时 run(allowFail) 返回 null',
  )
})

test('DBG-85 ②:check 判据块内必须有 process.exit(1)', () => {
  const idx = findCheckLine()
  const window = lines.slice(idx, idx + 12).join('\n')
  assert.match(
    window,
    /process\.exit\(1\)/,
    'check 判有锁后没有 fail-fast —— 必须 process.exit(1),不能继续往下走到 rmSync',
  )
})

test('DBG-85 ③:acquire 失败判据仍是 === null', () => {
  const idx = lines.findIndex((l) => /acquire --unit \$\{lockUnit\} --timeout 5000`,\s*true\)\s*===/.test(l))
  assert.notEqual(idx, -1, '找不到 acquire 判据行 —— 判据被改名/挪走后本锁失效')
  assert.match(lines[idx], /=== null/, 'acquire 判据必须是 === null(失败返回 null ⇒ 取锁失败要停)')
})

test('DBG-85 ④:取到锁之后必须注册 release', () => {
  assert.match(
    src,
    /process\.on\('exit',\s*\(\)\s*=>\s*\{[\s\S]{0,200}release --unit \$\{lockUnit\}/,
    '缺少 exit 钩子上的 release —— 异常退出会永久占锁,下一轮重建被自己挡住',
  )
})

test('DBG-85 ⑤:旧的反向写法在全文必须零出现', () => {
  const bad = lines.filter((l) =>
    /run\(`node "\$\{lockScript\}" check`, true\)\s*!==\s*null/.test(l),
  )
  assert.deepEqual(bad, [], `发现 ${bad.length} 处 !== null 反向写法(DBG-85 复发形态)`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
