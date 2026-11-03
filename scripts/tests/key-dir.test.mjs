// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 密钥目录解析器取证(scripts/lib/key-dir.mjs)。
 *
 * 为什么值得单独立测:这个 lib 的全部价值就是"路径不存在时不得装作存在",
 * 而它的调用方(凭据巡检 / .env 回填)都是**只在故障时才跑**的脚本 —— 没有测试的话,
 * 判据坏掉的表现恰好是"下次真故障时报出错误的根因",正是本机 2026-09-24 那次误诊的形状。
 * 因此这里既测正向(能解析),也钉死反向(解析不到必须返回 null,不得回退成假路径)。
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { firstExisting, keyFile, resolveKeyDir, resolveSecretsRoot, SECRETS_ROOT_CANDIDATES } from '../lib/key-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/')
const SELF = join(HERE, 'key-dir.test.mjs').replace(/\\/g, '/')
const NOPE = ['Z:/definitely/not/here-1', 'Z:/definitely/not/here-2']

test('firstExisting:全不存在 ⇒ null(不得回退成候选表首项)', () => {
  assert.equal(firstExisting(NOPE), null)
})

test('firstExisting:取第一个真实存在者,并归一为正斜杠', () => {
  assert.equal(firstExisting([NOPE[0], SELF, join(HERE, 'nope-x')]), SELF)
  assert.ok(!firstExisting([SELF]).includes('\\'), '返回路径应为正斜杠')
})

test('firstExisting:空串/null/undefined 候选被跳过(调用方常传 env 拼接产物)', () => {
  assert.equal(firstExisting(['', null, undefined, SELF]), SELF)
})

test('resolveSecretsRoot:环境变量优先,且指向不存在路径时判 null 而非照收', () => {
  assert.equal(resolveSecretsRoot({ IHUI_SECRETS_ROOT: HERE }), HERE)
  assert.equal(resolveSecretsRoot({ IHUI_SECRETS_ROOT: 'Z:/nope' }), null)
})

test('resolveSecretsRoot:无 env 时只可能返回"真实存在的候选"或 null', () => {
  const r = resolveSecretsRoot({})
  if (r === null) {
    for (const c of SECRETS_ROOT_CANDIDATES) assert.equal(existsSync(c), false, `判 null 但候选 ${c} 实际存在`)
  } else {
    assert.equal(existsSync(r), true)
    assert.ok(SECRETS_ROOT_CANDIDATES.includes(r), `解析结果 ${r} 必须来自候选表(不发明第三条路径)`)
  }
})

test('resolveKeyDir:子目录不存在 ⇒ null(不是"根 + 子目录"的假路径)', () => {
  assert.equal(resolveKeyDir('这个子目录名不存在-xyz'), null)
  const root = resolveSecretsRoot({})
  if (root) assert.ok(!resolveKeyDir('.') || resolveKeyDir('.').startsWith(root))
})

test('keyFile:任一级缺失 ⇒ null', () => {
  assert.equal(keyFile('这个子目录名不存在-xyz', 'whatever.txt'), null)
  assert.equal(keyFile('.', 'no-such-file-xyz.txt'), null)
})

test('候选盘表:必须为绝对盘符路径,且 F 排在 D 之前(本机 D 不存在)', () => {
  for (const c of SECRETS_ROOT_CANDIDATES) {
    assert.match(c, /^[A-Z]:\/BaiduSyncdisk\/密钥$/, `候选必须是绝对盘符路径:${c}`)
  }
  assert.ok(
    SECRETS_ROOT_CANDIDATES.indexOf('F:/BaiduSyncdisk/密钥') < SECRETS_ROOT_CANDIDATES.indexOf('D:/BaiduSyncdisk/密钥'),
    'F 必须排在 D 之前:本机真实库在 F,写死 D 的那版直接把"读不到"报成了"凭据失效"',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
