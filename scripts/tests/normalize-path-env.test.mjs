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
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { delimiter as PATH_DELIM } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  normalizePathEnvKey,
  prependPathDir,
  variantsOfPathKey,
  pickPathVariant,
  PATH_ENV_CHOICE,
  PATH_ENV_UNDETERMINED,
} from '../lib/normalize-path-env.mjs'
import { maskComments } from '../lib/code-mask.mjs'

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

/* ── N11…N14:站点写法出口(G-1105300 的"归一之后还须再赋值一次"那一格)──────────────
 * 本块钉的不是"函数返回什么",而是**调用方按直觉写会不会静默失效**:
 * 宿主把 PATH 写成 `Path` 时,`{ ...process.env, PATH: 短patch }` 再归一 ⇒ 按"继承那份优先"
 * 选中的是完整用户 PATH,那个短 patch 整个丢掉,而站点存在的理由(把一个目录送进子环境)
 * 就此静默失效 —— 症状是"尺子跑不动"被读成"仓里没有违规"(AGENTS §12e 那一族)。 */

test('N11 前置出口:宿主只有 Path 拼写时,结果只剩一个 PATH 且目录真的在最前', () => {
  const env = { FOO: '1', Path: 'FULL_USER_PATH' }
  const out = prependPathDir(env, 'G:/git/cmd', { processPath: 'FULL_USER_PATH' })
  assert.deepEqual(pathKeys(out), ['PATH'], `应只剩大写键:${JSON.stringify(pathKeys(out))}`)
  assert.equal(out.Path, undefined, '小写拼写的键必须被摘掉(留着它就有第二份键)')
  assert.equal(
    out.PATH,
    `G:/git/cmd${PATH_DELIM}FULL_USER_PATH`,
    '目录前置 + 继承值原样在后(不抢继承条目的优先级)',
  )
  assert.equal(out.FOO, '1', '其它键逐字保留')
  const choice = out[PATH_ENV_CHOICE]
  assert.equal(choice.prependedDir, 'G:/git/cmd')
  assert.equal(choice.hadInheritedPath, true, '自述必须说清"继承值在不在",否则判不出与没有会并桶')
})

test('N12 有牙对偶:同一输入按"直觉的一步写法"做,目录就被继承值吃掉(证明出口不是包装癖)', () => {
  // 这条断言的对象是**旧写法**:它必须真的丢目录。若哪天 Node/实现改了语义让旧写法也能work,
  // 这条会翻红并逼我们重新判断"这个出口还有没有必要" —— 不许把没判的东西写成已判。
  const env = { FOO: '1', Path: 'FULL_USER_PATH' }
  const naive = normalizePathEnvKey(
    { ...env, PATH: ['G:/git/cmd', env.PATH ?? ''].join(PATH_DELIM) },
    { processPath: 'FULL_USER_PATH' },
  )
  assert.ok(
    !String(naive.PATH).includes('G:/git/cmd'),
    `夹具自证失败:旧写法在这一输入上居然保住了目录,那 N11 与站点接线判据都要重新定性:${naive.PATH}`,
  )
  assert.equal(naive.PATH, 'FULL_USER_PATH', '旧写法的真实后果:短 patch 整块丢失')
  // 同一份输入走出口 ⇒ 目录在位(两条一起成立才叫"出口解决了问题",而不是"问题不存在")
  const fixed = prependPathDir(env, 'G:/git/cmd', { processPath: 'FULL_USER_PATH' })
  assert.ok(String(fixed.PATH).startsWith(`G:/git/cmd${PATH_DELIM}`))
})

test('N13 边界:空目录退化成纯归一(不产前导分隔符);无 PATH 时显式前置可造键;入参不被就地改', () => {
  const a = prependPathDir({ Path: 'A' }, '', { processPath: 'A' })
  assert.equal(a.PATH, 'A', 'dir 为空 ⇒ 只归一,不得留下 A 前面一个孤立分隔符')
  assert.ok(!String(a.PATH).startsWith(PATH_DELIM))
  assert.equal(a[PATH_ENV_CHOICE].prependedDir, undefined, '没前置过就不能在自述里声称前置过')

  const b = prependPathDir({ FOO: '1' }, 'G:/git/cmd', { processPath: null })
  assert.equal(b.PATH, 'G:/git/cmd', '环境里本来没有 PATH ⇒ 显式前置就是调用方的指令,允许造键(与"归一时不发明继承值"不冲突)')

  const frozen = Object.freeze({ Path: 'A', PATH: 'B' })
  assert.doesNotThrow(() => prependPathDir(frozen, 'G:/git/cmd', { processPath: 'A' }), '不得就地改写入参(冻结对象会当场抛)')
  assert.equal(frozen.PATH, 'B', '入参逐字不变')
  const notObj = prependPathDir(null, 'G:/git/cmd')
  assert.equal(notObj.PATH, undefined, '入参不是对象 ⇒ 不发明值,只把"判不出"挂在 Symbol 上')
  assert.ok(notObj[PATH_ENV_UNDETERMINED], '必须留下未判定原因')
})

test('N14 装车锁:站点必须走该出口,scripts 生产面不得再出现裸的 {...process.env, PATH: ...}', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const scriptsDir = join(here, '..')
  const site = readFileSync(join(scriptsDir, 'check-principal-consumed.mjs'), 'utf8')
  const siteCode = maskComments(site)
  assert.match(siteCode, /prependPathDir\(\s*\{ \.\.\.process\.env \}\s*,\s*dirname\(GIT\)\s*\)/, 'rulerEnv 必须真的经出口(引了不用 = 半接线,守门 118 那一型)')
  assert.match(siteCode, /from '\.\/lib\/normalize-path-env\.mjs'/, 'import 必须在位')

  // 全 scripts 生产面扫一遍:测试面刻意排除 —— 本文件 N12 就是要构造坏形态来证明判据有牙,
  // 把测试面扫进来等于让门把自己的证据读成仓库违规(守门 131/135 同一课)。
  const risky = []
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'tests') continue
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        walk(p)
        continue
      }
      if (!/\.(mjs|cjs)$/.test(e.name)) continue
      const code = maskComments(readFileSync(p, 'utf8'))
      if (/\{\s*\.\.\.process\.env\s*,\s*PATH\s*:/.test(code)) risky.push(p.replace(scriptsDir, 'scripts'))
    }
  }
  walk(scriptsDir)
  assert.deepEqual(risky, [], `这些站点还在用"一步写法",短 patch 会在 Path 拼写的宿主上静默丢失:${risky.join(' | ')}`)
  assert.ok(statSync(join(scriptsDir, 'lib/normalize-path-env.mjs')).isFile(), '出口文件必须在位(被外部清理层删掉时本锁要响)')

  // 分隔符来源锁(本块测试自己就是被这条抓出来的):Node 24 已不暴露 `process.delimiter`,
  // 用它不会报错,只会让 `join(undefined)` 按 Array 缺省用**逗号**拼 PATH ⇒ 整条环境路径变成非法条目。
  // 断言用错口的话两侧会一起错(本文件的 N11/N12 第一版就是这么"全绿"的),所以锁必须钉在实现面上。
  assert.notEqual(PATH_DELIM, undefined, '测试自己的分隔符口径都不成立 ⇒ 本文件全部断言失去意义')
  const libCode = maskComments(readFileSync(join(scriptsDir, 'lib/normalize-path-env.mjs'), 'utf8'))
  assert.doesNotMatch(libCode, /process\.delimiter/, '实现必须取 node:path 的 delimiter,不得回到 process.delimiter')
  assert.match(libCode, /from 'node:path'/, 'delimiter 的 import 必须在位')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
