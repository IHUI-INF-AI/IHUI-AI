// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/normalize-path-env.mjs` 的镜像测试(G-998128 票 4)。
 *
 * §22c:判据一律 import 源文件的导出(`variantsOfPathKey` / `pickPathVariant` /
 * `normalizePathEnvKey`),本文件**不复制第二份实现** —— 在测试里重写一份"什么算大小写变体",
 * 两边就会漂开,而漂开的表现是测试继续绿、门已经瞎。
 *
 * 每条判红/放过都配一条反向对照,因为本模块最容易出的两种假绿是:
 *   ① "塌缩"其实把两份都删了(值丢失)⇒ 用 N1/N2 的 keptKey + 值断言钉;
 *   ② "取不到"被折成"写了空串"⇒ 用 N6/N7 的成对钉(空串=有值、判不出=不写)。
 *
 * N9 是**真派生**的机制回归(不是夹具自证):同一个双键对象,不归一直接 spawn ⇒ 子进程只读到
 * 大写那份(哨兵 A 丢失);归一后 spawn ⇒ 子进程读到继承那份(A 保住)。这条把"修复前后行为差异"
 * 钉成可重跑断言;非 win32 面(键名大小写敏感、不存在塌缩问题)如实 skip 并写原因。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

import {
  normalizePathEnvKey,
  variantsOfPathKey,
  pickPathVariant,
  PATH_ENV_CHOICE,
  PATH_ENV_UNDETERMINED,
} from '../lib/normalize-path-env.mjs'

const pathKeys = (o) => variantsOfPathKey(o) // 用门体那把尺子,不在测试里另写一份 filter

test('N1 双键并存 + 值等于真实进程环境 ⇒ 塌缩成单一大写 PATH,且保住的是继承那一份', () => {
  const env = { FOO: '1', Path: 'FULL_USER_PATH', PATH: 'SHORT_PATCH' }
  const out = normalizePathEnvKey(env, { processPath: 'FULL_USER_PATH' })
  assert.deepEqual(pathKeys(out), ['PATH'], `归一后应只剩大写键,实际 ${JSON.stringify(pathKeys(out))}`)
  assert.equal(out.PATH, 'FULL_USER_PATH', '真实进程环境优先 ⇒ 保住继承那份')
  const choice = out[PATH_ENV_CHOICE]
  assert.equal(choice.action, 'collapsed')
  assert.equal(choice.keptKey, 'Path')
  assert.equal(choice.matchedProcessEnv, true)
  assert.deepEqual(choice.collapsedFrom, ['Path', 'PATH'])
  // 有值可选时不得留下「未判定」凭据(与 N6 成对:未判定只在该出现时出现)
  assert.equal(Object.prototype.hasOwnProperty.call(out, PATH_ENV_UNDETERMINED), false)
})

test('N2 反向对照:没有一份等于真实进程环境 ⇒ 按键序取第一份(不猜"哪个新")', () => {
  const a = normalizePathEnvKey({ Path: 'FIRST_IN_ORDER', PATH: 'SECOND' }, { processPath: 'NEITHER' })
  assert.equal(a.PATH, 'FIRST_IN_ORDER')
  assert.equal(a[PATH_ENV_CHOICE].matchedProcessEnv, false)
  assert.equal(a[PATH_ENV_CHOICE].keptKey, 'Path')

  // 只调换插入顺序、键名集合不变 ⇒ 选中值必须随之翻转:证明判据真的按键序,而不是硬编码某个键名
  const b = normalizePathEnvKey({ PATH: 'FIRST_IN_ORDER', Path: 'SECOND' }, { processPath: 'NEITHER' })
  assert.equal(b.PATH, 'FIRST_IN_ORDER')
  assert.equal(b[PATH_ENV_CHOICE].keptKey, 'PATH')
  assert.deepEqual(pathKeys(b), ['PATH'])
})

test('N3 纯函数:入参逐字不变,返回的是新对象,且 process.env 不被就地改', () => {
  const env = { Path: 'A', PATH: 'B', KEEP: 'k' }
  const beforeKeys = Object.keys(env)
  const snapshot = { Path: env.Path, PATH: env.PATH, KEEP: env.KEEP }
  const out = normalizePathEnvKey(env, { processPath: 'A' })
  assert.notEqual(out, env, '必须返回新对象')
  assert.deepEqual(Object.keys(env), beforeKeys, '入参键集合不得变化')
  assert.deepEqual({ Path: env.Path, PATH: env.PATH, KEEP: env.KEEP }, snapshot, '入参值不得被改写')
  assert.deepEqual(pathKeys(env), ['Path', 'PATH'], '入参仍应是双键 —— 塌缩只发生在返回值上')
  assert.equal(Object.prototype.hasOwnProperty.call(env, PATH_ENV_CHOICE.toString()), false)

  // 全局态那一半:normalizePathEnvKey(process.env) 之后 process.env 的 PATH 族必须原样
  const procKeysBefore = Object.keys(process.env)
  const procPathBefore = process.env.PATH
  normalizePathEnvKey(process.env, { processPath: procPathBefore })
  assert.deepEqual(Object.keys(process.env), procKeysBefore, '绝不允许就地改 process.env(同进程其他用例会被打脏)')
  assert.equal(process.env.PATH, procPathBefore)
})

test('N4 三种拼写并存全部塌光,只留大写 PATH', () => {
  const out = normalizePathEnvKey({ pAth: 'X', Path: 'REAL', PATH: 'Y' }, { processPath: 'REAL' })
  assert.deepEqual(pathKeys(out), ['PATH'])
  assert.equal(out.PATH, 'REAL')
  assert.deepEqual(out[PATH_ENV_CHOICE].collapsedFrom, ['pAth', 'Path', 'PATH'])
})

test('N5 一份变体都没有 ⇒ 不发明值(键保持缺席);同一对象带上变体就必须写(成对)', () => {
  const clean = normalizePathEnvKey({ FOO: '1' }, { processPath: 'SHOULD_NOT_BE_INJECTED' })
  assert.equal(Object.prototype.hasOwnProperty.call(clean, 'PATH'), false, '无变体时注入进程 PATH = 替调用方改语义')
  assert.equal(clean[PATH_ENV_CHOICE].action, 'no-variant')
  assert.equal(clean[PATH_ENV_CHOICE].wrote, false)
  assert.deepEqual(pathKeys(clean), [])

  const withVariant = normalizePathEnvKey({ FOO: '1', PATH: 'V' }, { processPath: 'SHOULD_NOT_BE_INJECTED' })
  assert.equal(withVariant.PATH, 'V', '反向对照:有变体就必须写,且写的仍是变体自己的值')
})

test('N6 变体值全部不是字符串 ⇒ 判未判定,绝不静默写空串', () => {
  const out = normalizePathEnvKey({ Path: undefined, PATH: null }, { processPath: null })
  assert.equal(Object.prototype.hasOwnProperty.call(out, PATH_ENV_UNDETERMINED), true, '必须留下"未判定"凭据')
  assert.equal(Object.prototype.hasOwnProperty.call(out, 'PATH'), false, '判不出就不能写 PATH(更不能写空串)')
  assert.equal(out[PATH_ENV_CHOICE].action, 'undetermined')
  assert.deepEqual(out[PATH_ENV_CHOICE].dropped, ['Path', 'PATH'])

  // 成对:混进去的 undefined 被丢弃,可用那一份照常选
  const mixed = normalizePathEnvKey({ Path: undefined, PATH: 'OK' }, { processPath: 'OK' })
  assert.equal(mixed.PATH, 'OK')
  assert.deepEqual(mixed[PATH_ENV_CHOICE].dropped, ['Path'])
  assert.equal(Object.prototype.hasOwnProperty.call(mixed, PATH_ENV_UNDETERMINED), false)
})

test('N7 空串是"有值",与"判不出"不得并桶', () => {
  const empty = normalizePathEnvKey({ Path: '' }, { processPath: '' })
  assert.equal(empty.PATH, '')
  assert.equal(empty[PATH_ENV_CHOICE].action, 'collapsed')
  assert.equal(Object.prototype.hasOwnProperty.call(empty, PATH_ENV_UNDETERMINED), false)
  assert.equal(Object.prototype.hasOwnProperty.call(empty, 'PATH'), true)
})

test('N8 其它键逐字保留(归一不吞别的变量)', () => {
  const env = { A: '1', Path: 'REAL', B: '2', PATH: 'patch', C: '' }
  const out = normalizePathEnvKey(env, { processPath: 'REAL' })
  assert.deepEqual(
    Object.keys(out).filter((k) => k.toUpperCase() !== 'PATH').sort(),
    ['A', 'B', 'C'].sort(),
  )
  assert.equal(out.A, '1')
  assert.equal(out.B, '2')
  assert.equal(out.C, '')
})

test('N9 真派生机制回归:双键不归一 ⇒ 继承那份在子进程里丢失;归一 ⇒ 保住', { skip: process.platform !== 'win32' && '非 win32:PATH 键名大小写敏感,不存在塌缩问题' }, () => {
  const CHILD =
    'const s=Object.keys(process.env).filter(k=>k.toUpperCase()==="PATH");' +
    'const v=String(process.env.PATH===undefined?process.env.Path:process.env.PATH);' +
    'console.log(JSON.stringify({spellings:s,count:s.length,hasA:v.includes("IHUI_SENTINEL_A"),hasB:v.includes("IHUI_SENTINEL_B")}));'
  const base = { ...process.env }
  for (const k of Object.keys(base)) if (k.toUpperCase() === 'PATH') delete base[k]
  const dup = { ...base, Path: 'C:\\IHUI_SENTINEL_A', PATH: 'C:\\IHUI_SENTINEL_B' }

  const run = (env) => {
    const r = spawnSync(process.execPath, ['-e', CHILD], {
      encoding: 'utf8', windowsHide: true, timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe'], // §12g:本机不显式给 stdio 的派生稳定 EBUSY
      env,
    })
    assert.equal(r.status, 0, `子进程应正常退出,实际 ${r.status} / ${String(r.stderr).slice(0, 200)}`)
    return JSON.parse(String(r.stdout).trim())
  }

  const raw = run(dup)
  assert.equal(raw.count, 1, `Windows 子进程只应读到一份 PATH(双键即"其中一份整块消失"),实际 ${JSON.stringify(raw.spellings)}`)
  assert.equal(raw.hasB, true)
  assert.equal(raw.hasA, false, '机制现值:未归一时,继承的那一份(哨兵 A)被大写那一份顶掉')

  const fixed = run(normalizePathEnvKey(dup, { processPath: 'C:\\IHUI_SENTINEL_A' }))
  assert.equal(fixed.count, 1)
  assert.equal(fixed.hasA, true, '归一后按"真实进程环境优先"保住继承那一份')
  assert.equal(fixed.hasB, false)
})

test('N10 pickPathVariant 的 unverifiable 态不得被折成"相等"或"不等"(三态不并桶)', () => {
  const noProc = pickPathVariant([{ key: 'Path', value: 'A' }, { key: 'PATH', value: 'B' }], null, { processAvailable: false })
  assert.equal(noProc.chosen.key, 'Path')
  assert.equal(noProc.processEnvUnavailable, true)
  assert.equal(noProc.matchedProcessEnv, false)

  const withProc = pickPathVariant([{ key: 'Path', value: 'A' }, { key: 'PATH', value: 'B' }], 'B', { processAvailable: true })
  assert.equal(withProc.chosen.key, 'PATH')
  assert.equal(withProc.matchedProcessEnv, true)
  assert.equal(withProc.processEnvUnavailable, undefined)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
