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
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'
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
