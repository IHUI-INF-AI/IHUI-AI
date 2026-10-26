// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * safe-commit 失败分诊的形状锁(2026-10-26 立;当天本机实测打穿旧判据)。
 *
 * 立因:`isGitLockFailure` 写的是 `status === 128 || GIT_LOCK_MISS.test(out)` ——
 * **任何** 128 都被读成"索引锁争用"。当天两次命中:
 *  ① 本会话身份下 `git config --get user.email` 取不到(rc=1)⇒ `Author identity unknown` + 128
 *     ⇒ 整条守门链(本机实测 9~15 分钟/轮)被同一确定性失败重跑 10 轮,约 100 分钟白烧,
 *     最后照样落不了地;
 *  ② 出网代理腿死(`unable to access … Recv failure`)同一族。
 * 本锁只钉**形状**(判据本体住在 safe-commit.mjs,这里不复制判定实现,§22c):
 * 任何一格被改回旧形态即红。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', 'safe-commit.mjs'), 'utf8')

test('① 裸 128 不得再算锁争用', () => {
  assert.doesNotMatch(
    src,
    /isGitLockFailure\s*=\s*\(status,\s*out\)\s*=>\s*status\s*===\s*128\s*\|\|/,
    '旧形态(任何 128 都是锁)回潮:会把署名缺失/网络断当成锁并重跑 10 轮全量门',
  )
  assert.match(
    src,
    /isGitLockFailure\s*=\s*\(status,\s*out\)\s*=>\s*status\s*===\s*128\s*&&\s*GIT_LOCK_MISS\.test\(out\)/,
    '新形态(128 ∧ 锁特征)不在位',
  )
})

test('② 确定性致命因有专档,且不退 --no-verify', () => {
  assert.match(src, /const GIT_DETERMINISTIC_FATAL\s*=/, '确定性致命因表不见了')
  assert.match(src, /GIT_DETERMINISTIC_FATAL\.test\(out\)/, '分支没真的判它')
  const at = src.indexOf('GIT_DETERMINISTIC_FATAL.test(out))')
  const end = src.indexOf('process.exit(1)', at)
  assert.ok(at > 0 && end > at, '命中后必须当场退出(不得继续烧下一轮全量门,也不得落入跳门归因链)')
  const body = src.slice(at, end)
  assert.doesNotMatch(body, /--no-verify/, '确定性致命因那一档绝不许跳门')
  assert.doesNotMatch(body, /sleep\(/, '那一档绝不许"睡 3 秒再赌一次"')
  assert.doesNotMatch(body, /break/, '那一档不得 break 回主环(break 会被下游归因升级成 --no-verify)')
  assert.match(body, /hookFailed = false/, '必须明写"没有门被跳过",否则事后账面上像跳了门')
})

test('③ 身份来自唯一出口,不在端内抄第二份', () => {
  assert.match(src, /import \{ REPO_GIT_IDENTITY_ARGS \} from '\.\/lib\/bypass-git\.mjs'/)
  assert.doesNotMatch(src, /user\.name=[^'"]*社区|user\.email=[^'"]*@/m, '端内出现了硬编码署名')
  // 探针方向:问不到 ⇒ 当作"有身份"(绝不代人署名)
  assert.match(src, /catch \{\s*return true \/\/ 问不到/, '探针失效方向被改:问不到却补署名 = 伪造作者')
})

test('③a 两个发令点都走 commitArgv(裸 commitArgs 发令会漏身份)', () => {
  assert.match(src, /const commitArgv = \(skipHooks, extraCfg = \[\]\) =>/, '拼装出口不见了')
  const viaArgv = [...src.matchAll(/commitArgv\((?:false|true)/g)].map((m) => m.index)
  assert.equal(viaArgv.length, 2, `走 commitArgv 的发令点应恰为 2(首次 + 跳门重试),实得 ${viaArgv.length}`)
  // 定义体里那一次 commitArgs(skipHooks) 不算发令点:发令点必须只写 commitArgv
  const bare = [...src.matchAll(/commitArgs\((?:false|true)\)/g)]
  assert.equal(bare.length, 0, '存在绕过 commitArgv 直接 commitArgs 的发令点 ⇒ 身份会漏')
})

test('④ 身份注入排在 git 子命令之前(git 语法要求 -c 前置)', () => {
  assert.match(src, /\[\.\.\.extraCfg,\s*\.\.\.IDENTITY_CFG_ARGS,\s*\.\.\.commitArgs\(skipHooks\)\]/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
