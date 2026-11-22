// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面构建 MSVC 注入链的镜像测试(判据全部 import 自 scripts/lib/msvc-env.mjs,本文件一份都不抄 —— §22c)。
//
// 形状照 scripts/tests/desktop-artifact-invariant.test.mjs;临时夹具走 mkScratch/rmScratch(§15b)。
// 每个用例都成对:正例 + 会让它变红的反例,判据只认一侧通过不算数。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { maskCommentsAndStrings, maskComments } from '../lib/code-mask.mjs'
// 直接跑生产判据(唯一实现住 check-direct-run-guard),本文件不重写一遍顶层语句切分
import { judgeSource } from '../check-direct-run-guard.mjs'

import { __test__ as M } from '../lib/msvc-env.mjs'
import { __test__ as P } from '../desktop-build.mjs'
import {
  ALLOW_UNSIGNED_ENV,
  UNSIGNED_CONFIG_CONTENT,
  allowUnsignedFrom,
  ensureUnsignedConfig,
  removeUnsignedConfig,
  unsignedConfigPath,
} from '../lib/desktop-unsigned-config.mjs'

const { parseVsEnv, findVcvarsCandidates, sanitizePathForMsvc, planBuildEnv } = M

const readSrc = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

const GIT_USR_BIN = 'C:\\Program Files\\Git\\usr\\bin'
const MSVC_BIN =
  'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC\\14.44.35207\\bin\\HostX64\\x64'
const VCTOOLS_DIR = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC\\14.44.35207\\'

/** 夹具路径一律用 win32 拼法:判据内部对分隔符大小写都不敏感,于是本测试在 win32 与 posix 上同值。 */
const W = (...parts) => parts.join('\\')
const norm = (p) => String(p).replace(/\//g, '\\').toUpperCase()

/** 假 existsSync:只有列入白名单的路径"存在"(大小写与分隔符不敏感)。 */
const existsOnly = (...paths) => {
  const set = new Set(paths.map(norm))
  return (p) => set.has(norm(p))
}

const FAKE_ENV = {
  VSINSTALLDIR: 'C:\\VS\\2022\\BuildTools\\',
  ProgramFiles: 'C:\\PF',
  'ProgramFiles(x86)': 'C:\\PF86',
}
const VCVARS_FROM_VAR = W(FAKE_ENV.VSINSTALLDIR.replace(/\\+$/, ''), 'VC', 'Auxiliary', 'Build', 'vcvars64.bat')
const VCVARS_PF86 = W('C:\\PF86', 'Microsoft Visual Studio', '2022', 'BuildTools', 'VC', 'Auxiliary', 'Build', 'vcvars64.bat')
const VCVARS_PF = W('C:\\PF', 'Microsoft Visual Studio', '2022', 'Enterprise', 'VC', 'Auxiliary', 'Build', 'vcvars64.bat')

/** 取 env 里那一份 PATH 段(Windows 大小写不敏感 ⇒ 先按不敏感找键,并断言只有一份)。 */
const segsOf = (env) => {
  const keys = Object.keys(env).filter((k) => k.toUpperCase() === 'PATH')
  assert.equal(keys.length, 1, `PATH 键必须只有一份(实际:${keys.join(',')})`)
  return env[keys[0]].split(';').filter(Boolean)
}

// ── parseVsEnv ──

test('正例:cmd set 形态(CRLF / 空行 / 无=行 / 隐藏变量)逐条按判据处理', () => {
  const text = [
    'ALLUSERSPROFILE=C:\\ProgramData',
    `Path=${MSVC_BIN};${GIT_USR_BIN}`,
    '',
    '   ',
    'this-line-has-no-equals-at-all',
    '=C:=C:\\Users\\Administrator',
    `VCToolsInstallDir=${VCTOOLS_DIR}`,
  ].join('\r\n')
  const out = parseVsEnv(text)
  assert.equal(out.ALLUSERSPROFILE, 'C:\\ProgramData')
  assert.equal(out.Path, `${MSVC_BIN};${GIT_USR_BIN}`)
  assert.equal(out.VCToolsInstallDir, VCTOOLS_DIR)
  assert.equal(Object.prototype.hasOwnProperty.call(out, 'this-line-has-no-equals-at-all'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(out, ''), false, '键名为空的隐藏变量必须被忽略')
  assert.equal(Object.keys(out).length, 3)
})

test('正例:值里含 = 时按首个 = 切分(键名之后的每个 = 都属于值)', () => {
  const out = parseVsEnv('SOMEVAR=a=b=c\r\nPath=x=y')
  assert.equal(out.SOMEVAR, 'a=b=c')
  assert.equal(out.Path, 'x=y')
  assert.equal(out.SOMEVAR.split('=').length, 3)
})

test('反例:垃圾输入(空串 / 纯空白 / 只有换行 / 只有 =)⇒ 空对象,不得凭空造键', () => {
  for (const bad of ['', '   ', '\r\n\r\n', '=\n==\n===', '﻿']) {
    assert.deepEqual(parseVsEnv(bad), {}, `输入 ${JSON.stringify(bad)} 不该产出任何键`)
  }
  assert.deepEqual(parseVsEnv(null), {})
  assert.deepEqual(parseVsEnv(undefined), {})
})

// ── findVcvarsCandidates ──

test('正例:按 ①变量 ②PF86-BuildTools ③PF-四档 的顺序返回,且只返回存在的那些', () => {
  const cands = findVcvarsCandidates({ env: FAKE_ENV, existsSync: existsOnly(VCVARS_PF, VCVARS_PF86) })
  assert.deepEqual(cands, [VCVARS_PF86, VCVARS_PF])
})

test('反例:一个都不存在 ⇒ 空数组(不是"退回到第一条候选碰运气")', () => {
  assert.deepEqual(findVcvarsCandidates({ env: FAKE_ENV, existsSync: () => false }), [])
})

test('正例:重复候选只出现一次(②与④的 BuildTools 同一条,不得在清单里出现两遍)', () => {
  const dup = W('C:\\PF86', 'Microsoft Visual Studio', '2022', 'BuildTools', 'VC', 'Auxiliary', 'Build', 'vcvars64.bat')
  const cands = findVcvarsCandidates({ env: { 'ProgramFiles(x86)': 'C:\\PF86' }, existsSync: existsOnly(dup) })
  assert.deepEqual(cands, [dup])
  assert.equal(new Set(cands.map(norm)).size, cands.length)
})

test('正例:接真实文件系统(mkScratch 里真放一个 vcvars64.bat,用真 existsSync 判)', () => {
  const dir = mkScratch('ihui-msvc-env-')
  try {
    const bat = W(dir, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat')
    mkdirSync(W(dir, 'VC', 'Auxiliary', 'Build'), { recursive: true })
    writeFileSync(bat, '@echo off\r\n')
    const cands = findVcvarsCandidates({ env: { VSINSTALLDIR: dir }, existsSync })
    assert.ok(cands.includes(bat), `真实存在的 vcvars 没被选中: ${JSON.stringify(cands)}`)
    assert.ok(cands.every((c) => existsSync(c)))
  } finally {
    rmScratch(dir)
  }
})

// ── sanitizePathForMsvc ──

test('正例:剔掉 Git usr\\bin、MSVC 前插、其余保序、去重、忽略空段', () => {
  const input = [`${GIT_USR_BIN}`, '', 'C:\\Windows\\system32', GIT_USR_BIN, `C:\\Windows`, MSVC_BIN, '  '].join(';')
  const out = sanitizePathForMsvc(input, MSVC_BIN).split(';').filter(Boolean)
  assert.deepEqual(out, [MSVC_BIN, 'C:\\Windows\\system32', 'C:\\Windows'])
})

test('反例:像遮蔽目录但不是的段必须留下(usr\\bin-extra / binx / 嵌在更深处)', () => {
  const input = ['C:\\tools\\usr\\bin-extra', 'C:\\tools\\usr\\binx', 'C:\\tools\\usr\\bin\\keep', 'C:\\tools\\usr'].join(';')
  const out = sanitizePathForMsvc(input, MSVC_BIN).split(';').filter(Boolean)
  assert.deepEqual(out, [MSVC_BIN, 'C:\\tools\\usr\\bin-extra', 'C:\\tools\\usr\\binx', 'C:\\tools\\usr\\bin\\keep', 'C:\\tools\\usr'])
})

test('正例:遮蔽段的大小写与分隔符变体照样命中(判据按段不按串)', () => {
  const out = sanitizePathForMsvc(['c:\\program files\\git\\USR\\BIN', 'C:/Program Files/Git/usr/bin'].join(';'), MSVC_BIN)
  assert.deepEqual(out.split(';').filter(Boolean), [MSVC_BIN])
})

test('反证对照:同族但非 MSVC 的 GNU 目录(MSYS2 的 usr\\bin)同样被剔 —— 这是判据的已知超集,不是漏判', () => {
  const out = sanitizePathForMsvc('C:\\msys64\\usr\\bin;C:\\Windows', MSVC_BIN).split(';').filter(Boolean)
  assert.deepEqual(out, [MSVC_BIN, 'C:\\Windows'])
})

test('正例:不传 msvcBinDir 时只做剔除,不得凭空在前面加东西', () => {
  assert.equal(sanitizePathForMsvc(`${GIT_USR_BIN};C:\\Windows`, ''), 'C:\\Windows')
  assert.equal(sanitizePathForMsvc(`${GIT_USR_BIN};C:\\Windows`, undefined), 'C:\\Windows')
})

// ── planBuildEnv ──

test('失败档 NO_VCVARS:一个候选都不存在 ⇒ 未判定,且 tried 点名试过的全部候选', () => {
  const r = planBuildEnv({ env: FAKE_ENV, existsSync: () => false, runCapture: () => '' })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'NO_VCVARS')
  assert.ok(r.tried.includes(VCVARS_FROM_VAR), 'tried 必须含变量指向的候选')
  assert.ok(r.tried.includes(VCVARS_PF86))
  assert.deepEqual(r.candidates, [])
})

test('失败档 VCPARSE_EMPTY:vcvars 跑了但输出里没有可解析的 PATH ⇒ 未判定', () => {
  for (const junk of ['', 'vcvars 初始化完毕\r\n', '=C:=C:\\Users\\Administrator']) {
    const r = planBuildEnv({ env: FAKE_ENV, existsSync: existsOnly(VCVARS_PF86), runCapture: () => junk })
    assert.equal(r.ok, false)
    assert.equal(r.reason, 'VCPARSE_EMPTY', `输出 ${JSON.stringify(junk)} 的 reason 不对`)
    assert.ok(r.details.length > 0 && r.details[0].error.includes('PATH'))
  }
})

test('失败档 NO_MSVCLINK:有 PATH 但里面没有 MSVC 链接器目录 ⇒ 未判定(不得放行裸 env 硬跑)', () => {
  const set = [`Path=${GIT_USR_BIN};C:\\Windows\\system32`, 'ALLUSERSPROFILE=C:\\ProgramData'].join('\r\n')
  const r = planBuildEnv({ env: FAKE_ENV, existsSync: existsOnly(VCVARS_PF86), runCapture: () => set })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'NO_MSVCLINK')
  assert.equal(r.vcvars, undefined)
})

test('失败档 VC_RUN_FAILED:每个候选都跑不起来(异常原文进 details,不留空)', () => {
  const r = planBuildEnv({
    env: FAKE_ENV,
    existsSync: existsOnly(VCVARS_PF86),
    runCapture: () => {
      throw new Error('spawn cmd.exe ENOENT')
    },
  })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'VC_RUN_FAILED')
  assert.equal(r.details.length, 1)
  assert.ok(r.details[0].error.includes('ENOENT'))
})

test('成功档:MSVC 链接器目录排在 Git usr\\bin 之前,且被剔的目录逐条点名', () => {
  const set = [
    'ALLUSERSPROFILE=C:\\ProgramData',
    `PATH=${GIT_USR_BIN};${MSVC_BIN};C:\\Windows\\system32;C:\\Windows`,
    `VCToolsInstallDir=${VCTOOLS_DIR}`,
  ].join('\r\n')
  const r = planBuildEnv({
    env: { ...FAKE_ENV, Path: `${GIT_USR_BIN}`, IHUI_TEST_KEEP: '1' },
    existsSync: existsOnly(VCVARS_PF86),
    runCapture: () => set,
  })
  assert.equal(r.ok, true)
  assert.equal(r.vcvars, VCVARS_PF86)
  assert.equal(r.linkFrom, MSVC_BIN)
  assert.deepEqual(r.removedDirs, [GIT_USR_BIN])
  const segs = segsOf(r.env)
  assert.equal(segs[0], MSVC_BIN, 'MSVC 链接器目录必须排在最前')
  assert.ok(!segs.some((s) => norm(s) === norm(GIT_USR_BIN)), '遮蔽 MSVC 的目录必须已被剔除')
  assert.ok(segs.includes('C:\\Windows\\system32'), '无关目录必须原样保留')
  assert.equal(r.env.IHUI_TEST_KEEP, '1', '调用方自有变量不得被 vcvars 输出吃掉')
  assert.equal(r.env.ALLUSERSPROFILE, 'C:\\ProgramData', 'vcvars 注入的变量必须进来')
})

test('反例对照:输入 PATH 里 Git usr\\bin 排在 MSVC 前面时,输出必须被纠正(不能"照抄输入顺序")', () => {
  const set = `PATH=${GIT_USR_BIN};${MSVC_BIN};${GIT_USR_BIN}`
  const r = planBuildEnv({ env: FAKE_ENV, existsSync: existsOnly(VCVARS_PF86), runCapture: () => set })
  assert.equal(r.ok, true)
  assert.deepEqual(segsOf(r.env), [MSVC_BIN])
  assert.equal(new Set(segsOf(r.env).map(norm)).size, 1, '重复段必须去重')
})

test('大小写不敏感对照:本机 set 输出的键是 Path,调用方 env 里也可能是 PATH ⇒ 合并后只留一份', () => {
  const set = `Path=${MSVC_BIN};${GIT_USR_BIN}`
  const r = planBuildEnv({ env: { ...FAKE_ENV, PATH: 'C:\\Windows' }, existsSync: existsOnly(VCVARS_PF86), runCapture: () => set })
  assert.equal(r.ok, true)
  const keys = Object.keys(r.env).filter((k) => k.toUpperCase() === 'PATH')
  assert.deepEqual(keys, ['Path'], '键名沿用 set 输出的拼写,且同名不同拼写必须被合并掉')
  assert.equal(segsOf(r.env).includes('C:\\Windows'), false, '调用方那份 PATH 已被 vcvars 注入的那份取代')
})

// ── CLI 形状锁:参数解析(判据在 desktop-build.mjs,本文件只 import,一份都不抄 §22c)──

test('正例:--dev / --debug / --no-artifact-check / -- 透传 各自落到对应档', () => {
  assert.deepEqual(P.parseArgv([]), {
    help: false,
    debug: false,
    dev: false,
    artifactCheck: true,
    passthrough: [],
    unknown: [],
  })
  const dev = P.parseArgv(['--dev', '--', '--config', 'src-tauri/tauri.dev.json'])
  assert.equal(dev.dev, true)
  assert.equal(dev.debug, false)
  assert.deepEqual(dev.passthrough, ['--config', 'src-tauri/tauri.dev.json'])
  assert.deepEqual(dev.unknown, [])
  const dbg = P.parseArgv(['--debug', '--no-artifact-check'])
  assert.equal(dbg.debug, true)
  assert.equal(dbg.artifactCheck, false)
  assert.equal(dbg.dev, false)
})

test('反例对照:`--` 之后的字面 --debug/--dev 是 tauri 的参数,不是本 CLI 的档位', () => {
  // 透传段里的同名 flag 若被误当成本 CLI 的开关,--config 就会被吃掉 → 必须逐条反证
  const p = P.parseArgv(['--dev', '--', '--config', 'src-tauri/tauri.dev.json', '--debug'])
  assert.equal(p.dev, true, '透传段里的 --debug 不得反向打开 debug 档')
  assert.ok(p.passthrough.includes('--debug'))
  assert.ok(p.passthrough.includes('--config'))
})

test('反例对照:未知参数必须被收进 unknown 而不是被静默丢掉(丢了就等于没告诉调用方)', () => {
  const p = P.parseArgv(['--release', '--dev'])
  assert.deepEqual(p.unknown, ['--release'])
  assert.equal(p.dev, true)
})

test('形状锁:派生 stdio 恒取第一支(本文件两处派生都不吃 input),且带 input 时必须给管道', () => {
  assert.deepEqual(P.stdioFor({}), ['ignore', 'pipe', 'pipe'])
  assert.deepEqual(P.stdioFor({ input: undefined }), ['ignore', 'pipe', 'pipe'])
  assert.deepEqual(P.stdioFor({ input: 'abc' }), ['pipe', 'pipe', 'pipe'])
})

test('反例对照:透传参数里的换行符必须被识别出来(它会打断任何一层参数解析)', () => {
  assert.equal(P.hasLineBreak('--config\r\nx'), true)
  assert.equal(P.hasLineBreak('--config\nx'), true)
  assert.equal(P.hasLineBreak('--config src-tauri/tauri.dev.json'), false)
})

test('形状锁:收敛钩子与桌面目录都锚在仓根推出来的绝对路径上(禁 cwd 假设,§15)', () => {
  assert.ok(path.isAbsolute(P.DESKTOP))
  assert.ok(P.DESKTOP.endsWith(path.join('apps', 'desktop')))
  assert.ok(path.isAbsolute(P.ARTIFACT_HOOK))
  assert.ok(P.ARTIFACT_HOOK.endsWith('desktop-artifact-single.mjs'))
})

test('正例:收敛钩子判的产物目录随档位走 —— debug 不许去判 release 目录', () => {
  // 反证锁:debug 档若落到 release 目录,判据就变成"上次 release 构建的结论"冒充本次(§0.9)
  const rel = P.artifactDirFor(false)
  const dbg = P.artifactDirFor(true)
  assert.notEqual(rel, dbg, '两档必须指向不同目录')
  assert.ok(norm(dbg).includes(`${norm('debug')}`), `debug 档应落 debug 目录,实际 ${dbg}`)
  assert.ok(norm(rel).includes(`${norm('release')}`), `release 档应落 release 目录,实际 ${rel}`)
  for (const d of [rel, dbg]) assert.ok(path.isAbsolute(d))
})

test('正例:只有 win32 需要 MSVC 注入(macOS 用 clang / Linux 用 cc,压根没有 MSVC)', () => {
  // 这条判据漏掉过一次,代价是 desktop-build.yml 的 ubuntu/macos 两条腿在 tauri 启动前就 exit 2
  assert.equal(P.needsMsvcInjection('win32'), true)
  for (const other of ['darwin', 'linux', 'freebsd', 'aix', 'sunos', '']) {
    assert.equal(P.needsMsvcInjection(other), false, `${other} 不该要求 MSVC 注入`)
  }
})

test('形状锁:三个调用点共用同一份 needsMsvcInjection(判据单源,§0.6)', () => {
  // ① 实现只许有一份,且住在纯判据层 lib 里
  const libSrc = readSrc('../lib/msvc-env.mjs')
  assert.match(libSrc, /export function needsMsvcInjection\(platform = process\.platform\)/)
  assert.ok(!/needsMsvcInjection/.test(readSrc('../lib/desktop-unsigned-config.mjs')), '豁免层与平台闸无关')

  // ② 每个注入调用点都必须**问**这个判据(而不是自己判平台)
  //    注意:不能反向断言"文件里不许出现 platform === 'win32'"——
  //    desktop-dev-saas.mjs 本来就有几处与工具链无关的 win32 判断
  //    (netstat / Get-CimInstance 停残留进程 / Start-Process 隐藏窗口),
  //    把它们一起禁掉会逼出第二份判据,方向正好相反(§0.6)。
  for (const rel of ['../desktop-build.mjs', '../desktop-dev-saas.mjs', '../desktop-build-saas.mjs']) {
    const raw = readSrc(rel)
    const masked = maskCommentsAndStrings(raw)
    assert.match(
      masked,
      /needsMsvcInjection\(\)/,
      `${rel} 必须在代码里实调 needsMsvcInjection(),不得只 import 不用(那等于没设闸)`,
    )
    // import 的模块说明符本身是字符串,遮罩会把它抹掉 ⇒ 这一条读**未遮罩**原文
    // (只挡注释,别用 maskCommentsAndStrings,否则 import 源路径被抹成空格)
    assert.match(
      maskComments(raw),
      /import\s*\{[^}]*\bneedsMsvcInjection\b[^}]*\}\s*from\s*'\.\/lib\/msvc-env\.mjs'/,
      `${rel} 必须从唯一真相源 scripts/lib/msvc-env.mjs import needsMsvcInjection`,
    )
  }

  // ③ 反向锁:三处的注入块都必须在平台闸的分支里,不许无条件跑
  for (const rel of ['../desktop-build.mjs', '../desktop-dev-saas.mjs', '../desktop-build-saas.mjs']) {
    const masked = maskCommentsAndStrings(readSrc(rel))
    const gate = masked.indexOf('needsMsvcInjection()')
    const call = masked.indexOf('planBuildEnv(')
    assert.ok(call !== -1, `${rel} 应当有 planBuildEnv 调用点(形状锁自身失效?)`)
    assert.ok(gate < call, `${rel}:平台闸必须排在 planBuildEnv 之前(无条件注入 = 那次漏判的原样)`)
  }
})

test('形状锁:四个桌面入口都接了 rustup 家钉正,判据与三态日志全仓只有一份(§0.6)', () => {
  // 立因(2026-10-27 本机实测):agent 会话在沙箱里跑桌面构建,HOME 被沙箱根接管 ⇒ rustup
  // 找不到 settings.toml ⇒ "no default toolchain",报错长得像"没装 Rust"。判据本身
  // (lib/rustup-env.mjs)当天已写好,但只接了 desktop-build.mjs 与 release-desktop-local.mjs
  // 两处 —— 两个 saas 入口由脚本**亲自** spawn tauri/cargo,漏在这一格上就是沙箱里必挂,
  // 而失败形态是"MSVC 注入成功、构建照样死",日志里没有任何一行指向归属问题。
  const entries = [
    '../desktop-build.mjs',
    '../release-desktop-local.mjs',
    '../desktop-build-saas.mjs',
    '../desktop-dev-saas.mjs',
  ]

  // ① 唯一出口必须住在 lib
  assert.match(readSrc('../lib/rustup-env.mjs'), /export function applyRustupPinToEnv\(/)

  for (const rel of entries) {
    const raw = readSrc(rel)
    // import 的模块说明符是字符串 ⇒ 这一条只能读未遮罩原文(maskCommentsAndStrings 会把路径抹成空格)
    assert.match(
      maskComments(raw),
      /import\s*\{[^}]*\bapplyRustupPinToEnv\b[^}]*\}\s*from\s*'\.\/lib\/rustup-env\.mjs'/,
      `${rel} 必须从唯一真相源 scripts/lib/rustup-env.mjs import applyRustupPinToEnv`,
    )
    const masked = maskCommentsAndStrings(raw)
    assert.match(
      masked,
      /applyRustupPinToEnv\(|applyRustupPin\(/,
      `${rel} 必须实调钉正出口,不得只 import 不用(那等于沙箱里没接)`,
    )
    // ② 反第二份:入口不许自己再抄一遍三态日志文案。
    //    用 maskComments(只挡注释、保留字符串):日志是模板字符串,全遮罩会把重复实现一起遮没。
    assert.ok(
      !maskComments(raw).includes('rustup 归属'),
      `${rel} 不得自写 "rustup 归属" 日志行(那是 lib 那份出口的活;两份必然漂移)`,
    )
  }

  // ③ 顺序:钉正必须排在 planBuildEnv **之后** —— 本判据从 PATH 反推 cargo 档案位,
  //    而 PATH 正是 planBuildEnv 刚重写过的那一份(前插 MSVC bin、剔掉 Git 的 usr/bin)。
  for (const rel of entries) {
    const masked = maskCommentsAndStrings(readSrc(rel))
    const msvc = masked.indexOf('planBuildEnv(')
    const pin = Math.max(
      masked.indexOf('applyRustupPinToEnv('),
      masked.indexOf('applyRustupPin('),
    )
    assert.ok(pin !== -1, `${rel} 缺钉正调用点`)
    if (msvc === -1) continue
    assert.ok(
      msvc < pin,
      `${rel}:planBuildEnv 必须排在钉正之前(反序 ⇒ 钉正读的是重写前的 PATH,可能找不到 cargo)`,
    )
  }

  // ④ 钉正的结果必须真的落到那次 spawn 的 env 上(只调用不赋值 = 又一层假接线)
  const pairs = [
    ['../desktop-build.mjs', 'applyRustupPin(plan.env)'],
    ['../release-desktop-local.mjs', 'env: buildEnv'],
    ['../desktop-build-saas.mjs', 'env: buildEnv'],
    ['../desktop-dev-saas.mjs', 'env: childEnv'],
  ]
  for (const [rel, anchor] of pairs) {
    assert.ok(readSrc(rel).includes(anchor), `${rel} 钉正结果未落到 spawn env(锚点 ${anchor} 不见了)`)
  }
})

test('正例:VCVARS 捕获命令必须先切 UTF-8 码页(cmd 默认 OEM 码页,按 utf8 解会把中文路径读成 U+FFFD)', () => {
  // 判据住在源码里,这里只钉住"chcp 65001 必须在 set 之前、且 call 用裸文件名"
  const src = readSrc('../desktop-build.mjs')
  const masked = maskCommentsAndStrings(src)
  assert.ok(!masked.includes('chcp 65001'), '本断言读的是字面量面,须在遮罩前验;若结构变了请同步改这里')
  const at = src.indexOf("'chcp 65001 >nul && call vcvars64.bat >nul 2>&1 && set'")
  assert.ok(at !== -1, 'captureVsEnv 的命令串必须含 chcp 65001 前缀')
  assert.ok(src.indexOf('chcp 65001', at) < src.indexOf('&& set', at), 'chcp 必须排在 set 之前')
  assert.ok(src.includes("['/d', '/s', '/c'"), '必须带 /d /s /c(关 AutoRun + 正确取参)')
})

test('正例:开发会话被 Ctrl+C 中断 = 正常结束,不是失败', () => {
  for (const r of [{ code: 130 }, { code: 3221225786 }, { code: null, signal: 'SIGINT' }]) {
    const j = P.judgeInterrupt(r)
    assert.equal(j.interrupted, true, `${JSON.stringify(r)} 应当判为被用户中断`)
    assert.ok(j.observed && j.observed.length > 0, '必须报出实际观测到的那一个码,不许含糊成"可能是"')
  }
})

test('反例对照:普通失败码 / 成功码 / 其它信号一律**不得**被读成"被用户中断"', () => {
  for (const r of [{ code: 0 }, { code: 1 }, { code: 2 }, { code: 101 }, { code: null, signal: 'SIGKILL' }, { code: null, signal: null }]) {
    const j = P.judgeInterrupt(r)
    assert.equal(j.interrupted, false, `${JSON.stringify(r)} 不该被读成中断`)
    assert.equal(j.observed, null)
  }
})

test('反例对照:build 档不因本判据放行(build 被 Ctrl+C 打断仍然是"这次没建成")', () => {
  // 锁住"只对 --dev 生效"这件事:judgeInterrupt 本身无档位概念,档位判在 main()。
  // 这里钉的是 INTERRUPT_CODES 的成员集合 —— 加码进来必须是有据的,不能顺手把 SIGTERM 之类塞进去。
  assert.deepEqual([...P.INTERRUPT_CODES.keys()].sort((a, b) => a - b), [130, 3221225786])
})

// ── 未签名豁免(§0.8:写了就必须真跑得通 —— 判据是"开关落得到地",不是"开关存在")──

test('正例:开关只认字面量 1,其余一律不认(不得把 "true"/"0"/空串当放行)', () => {
  assert.equal(ALLOW_UNSIGNED_ENV, 'DESKTOP_ALLOW_UNSIGNED')
  assert.equal(allowUnsignedFrom({ [ALLOW_UNSIGNED_ENV]: '1' }), true)
  for (const bad of ['0', 'true', 'TRUE', 'yes', '', ' 1']) {
    assert.equal(allowUnsignedFrom({ [ALLOW_UNSIGNED_ENV]: bad }), false, `${JSON.stringify(bad)} 不该放行`)
  }
  assert.equal(allowUnsignedFrom({}), false)
  assert.equal(allowUnsignedFrom(undefined), false)
})

test('形状锁:临时 config 只关 updater 产物,发版形态一个字段都不许动', () => {
  const parsed = JSON.parse(UNSIGNED_CONFIG_CONTENT)
  assert.deepEqual(Object.keys(parsed), ['bundle'])
  assert.deepEqual(Object.keys(parsed.bundle), ['createUpdaterArtifacts'])
  assert.equal(parsed.bundle.createUpdaterArtifacts, false)
  // 明钉"不得顺手加的字段":一旦有人往这里塞 targets/pubkey/version,
  // 未签名包就会变成"半个发版形态",那比缺签名更难认。
  for (const forbidden of ['targets', 'pubkey', 'productName', 'version', 'identifier']) {
    assert.equal(forbidden in parsed.bundle, false, `临时 config 不得覆盖 ${forbidden}`)
  }
})

test('正例:落盘 → 读回逐字节一致 → 收掉后目录与文件都不在', () => {
  const root = mkScratch('ihui-unsigned-cfg-')
  try {
    const p = ensureUnsignedConfig(root, 'slot-a')
    assert.equal(p, unsignedConfigPath(root, 'slot-a'))
    assert.ok(norm(p).includes(norm('slot-a')), 'slot 名必须进路径 ⇒ 不同入口各占一格')
    assert.equal(readFileSync(p, 'utf8'), UNSIGNED_CONFIG_CONTENT)
    // 幂等:重复落地不改变字节
    assert.equal(ensureUnsignedConfig(root, 'slot-a'), p)
    assert.equal(readFileSync(p, 'utf8'), UNSIGNED_CONFIG_CONTENT)
    const r = removeUnsignedConfig(root, 'slot-a')
    assert.equal(r.removed, true)
    assert.equal(existsSync(p), false)
    assert.equal(existsSync(path.dirname(p)), false, '空目录要一并收掉,不得留残留')
  } finally {
    rmScratch(root)
  }
})

test('反例对照:那一格里的内容不是本仓写出的那份 ⇒ 绝不删(共享工作区里那是别人的现场)', () => {
  const root = mkScratch('ihui-unsigned-cfg-foreign-')
  try {
    const p = ensureUnsignedConfig(root, 'slot-b')
    writeFileSync(p, '{"bundle":{"targets":["msi"]}}\n')
    const r = removeUnsignedConfig(root, 'slot-b')
    assert.equal(r.removed, false)
    assert.ok(r.reason, '必须点名为什么没收')
    assert.equal(existsSync(p), true, '别人的文件必须还在')
  } finally {
    rmScratch(root)
  }
})

test('反例对照:文件已不在 ⇒ 报"无残留"而不是当成失败或当成删成功', () => {
  const root = mkScratch('ihui-unsigned-cfg-gone-')
  try {
    const r = removeUnsignedConfig(root, 'slot-c')
    assert.equal(r.removed, false)
    assert.ok(r.reason.includes('不存在'))
  } finally {
    rmScratch(root)
  }
})

test('正例:不同 slot 互不干扰(并发两个入口各占一格,不会互删)', () => {
  const root = mkScratch('ihui-unsigned-cfg-slot-')
  try {
    const a = ensureUnsignedConfig(root, 'desktop-build')
    const b = ensureUnsignedConfig(root, 'desktop-build-saas')
    assert.notEqual(a, b)
    removeUnsignedConfig(root, 'desktop-build')
    assert.equal(existsSync(a), false)
    assert.equal(existsSync(b), true, '收掉一格不得连带删掉另一格')
    removeUnsignedConfig(root, 'desktop-build-saas')
  } finally {
    rmScratch(root)
  }
})

// ── 形状锁:两个模块都不得在 import 时就 spawn(§22d isDirectRun)──

/**
 * 遮罩后文本在 idx 处的花括号深度(字符串/注释已被 code-mask 清空,剩下的括号就是代码自己的)。
 * 深度 0 = 顶层语句序列 —— 那正是"import 就跑起来"的位置。
 */
function braceDepthBefore(masked, idx) {
  let depth = 0
  for (let i = 0; i < idx; i++) {
    if (masked[i] === '{') depth += 1
    else if (masked[i] === '}') depth -= 1
  }
  return depth
}

test('形状锁:desktop-build.mjs 与 msvc-env.mjs 顶层都没有裸 main()/裸 spawn', () => {
  const cli = readSrc('../desktop-build.mjs')
  const lib = readSrc('../lib/msvc-env.mjs')

  // 判据唯一实现住 check-direct-run-guard(不重写顶层语句切分)
  for (const [rel, src] of [
    ['scripts/desktop-build.mjs', cli],
    ['scripts/lib/msvc-env.mjs', lib],
  ]) {
    const j = judgeSource(rel, src)
    assert.notEqual(j.state, 'hit', `${rel} 顶层出现裸 main():${JSON.stringify(j.hits)}`)
    if (rel.endsWith('desktop-build.mjs')) {
      assert.ok(j.forms.length > 0, 'CLI 必须带 §22d 入口守卫')
      assert.ok(/pathToFileURL\s*\(\s*process\.argv\[1\]\s*\)/.test(src), '守卫必须用 pathToFileURL(禁手拼 file:///)')
    }
  }

  // 纯判据层不得有 IO 出口(判据与执行分离;否则测试就得赌本机装没装 VS)
  assert.ok(!/from\s+'node:child_process'/.test(lib), 'msvc-env.mjs 不得导入 node:child_process')

  // 派生调用点必须落在函数体内(顶层 spawn 会在 import 时就跑起来)
  const masked = maskCommentsAndStrings(cli)
  for (const call of ['spawn(', 'execFileSync(']) {
    let at = masked.indexOf(call)
    let n = 0
    while (at !== -1) {
      n += 1
      assert.ok(braceDepthBefore(masked, at) >= 1, `${call} 出现在顶层语句序列上(花括号深度 0)`)
      at = masked.indexOf(call, at + call.length)
    }
    assert.ok(n > 0, `没找到 ${call} 调用点 —— 形状锁自身失效`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
