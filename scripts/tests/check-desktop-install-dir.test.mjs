#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-desktop-install-dir.mjs 的自测(守门的守门)。
 *
 * ## 为什么需要它
 * `scripts/check-desktop-install-dir.mjs` 是「桌面端安装器默认安装目录 / 向导语言」的回归断言。
 * 但它自己也可能被人「顺手改弱」——比如把某条断言删掉、把 exit(1) 改成 exit(0)、把
 * 「找不到证据」当成「通过」。一旦守门本身失效,回退就又能静默通过,等于防线归零。
 * 本测试用**对抗性用例**把守门钉住:逐条注入真实的回退场景,断言它**确实拦得住**,
 * 而且报的是**预期的断言 id**(不是"随便报了个错"就算数)。
 *
 * ## 覆盖
 *   1. 静态不变量 A2~A6 / B1~B7 / C1:每条回退场景都必须 exit 1 且命中预期 id;
 *      基线未改动必须 exit 0(防"恒红"式假警报)。
 *   2. 平台适用性门:`--check` 在非 Windows 上必须**显式跳过并 exit 0**(不是漂移);
 *      `--write` 在非 Windows 上仍必须 exit 1;Windows 上定位不到 CLI 且带
 *      `--require-cli` 必须 exit 1。这三条锁住的是 2026-09-18 两次真实 CI 假失败。
 *
 * ## 实现要点
 * - 沙盒从**仓库里的真实文件**复制(不硬编码模板内容),所以断言跟着真实定制块走,
 *   不会因模板演进变成"测试自己过期"。
 * - 守门的根目录取自 `process.cwd()`,因此只要 `cwd` 指到沙盒即可,无需复制脚本。
 * - 平台用 `-r <preload.cjs>` 在加载目标脚本前改写 `process.platform`;
 *   并**清空 PATH / APPDATA**,避免命中本机**全局**安装的 `@tauri-apps/cli`
 *   而让"定位不到 CLI"的用例假通过。
 *
 * 运行: node --test scripts/tests/check-desktop-install-dir.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const HERE = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')
const GUARD = join(REPO_ROOT, 'scripts', 'check-desktop-install-dir.mjs')
const TEMPLATE_SCRIPT = join(REPO_ROOT, 'scripts', 'desktop-nsis-template.mjs')

const CONF_REL = join('apps', 'desktop', 'src-tauri', 'tauri.conf.json')
const NSI_REL = join('apps', 'desktop', 'src-tauri', 'windows', 'installer.nsi')
const HOOKS_REL = join('apps', 'desktop', 'src-tauri', 'windows', 'hooks.nsi')

// 定制块标记(与生成器 scripts/desktop-nsis-template.mjs 保持一致)
const BLOCK_START = '; ==== IHUI 定制:默认安装目录(向导首屏即生效)===='
const BLOCK_END = '; ==== IHUI 定制结束 ===='

const ANSI = /\u001b\[[0-9;]*m/g

// ─── 沙盒 ────────────────────────────────────────────────
/** 从仓库真实文件现造一个最小仓库骨架(只含守门需要的 3 个文件)。 */
function buildSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-nsis-guard-'))
  mkdirSync(join(dir, 'apps', 'desktop', 'src-tauri', 'windows'), { recursive: true })
  for (const rel of [CONF_REL, NSI_REL, HOOKS_REL]) {
    copyFileSync(join(REPO_ROOT, rel), join(dir, rel))
  }
  return dir
}

/** 运行守门(静态不变量组),返回 exit code 与去 ANSI 的输出。 */
function runGuard(dir) {
  const r = spawnSync(process.execPath, [GUARD], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(ANSI, '') }
}

/** 从输出里抽出命中的断言 id(形如 `1. [A2] ...`)。 */
function idsOf(out) {
  return new Set([...out.matchAll(/\d+\.\s*\[([A-Z0-9-]+)\]/g)].map((m) => m[1]))
}

// ─── 变更器 ──────────────────────────────────────────────
const confPath = (dir) => join(dir, CONF_REL)
const readConf = (dir) => JSON.parse(readFileSync(confPath(dir), 'utf8'))
const writeConf = (dir, c) => writeFileSync(confPath(dir), JSON.stringify(c, null, 2))

function setNsis(dir, patch) {
  const c = readConf(dir)
  Object.assign(c.bundle.windows.nsis, patch)
  writeConf(dir, c)
}

function dropNsisKey(dir, key) {
  const c = readConf(dir)
  delete c.bundle.windows.nsis[key]
  writeConf(dir, c)
}

function editNsi(dir, fn) {
  const f = join(dir, NSI_REL)
  writeFileSync(f, fn(readFileSync(f, 'utf8')))
}

function appendHooks(dir, text) {
  const f = join(dir, HOOKS_REL)
  writeFileSync(f, readFileSync(f, 'utf8') + text)
}

/** 把整个定制块搬到指定锚点之前(用于验 B5 位置约束)。 */
function moveBlock(dir, anchor) {
  editNsi(dir, (s) => {
    const start = s.indexOf(BLOCK_START)
    const end = s.indexOf(BLOCK_END) + BLOCK_END.length
    const block = s.slice(start, end)
    const rest = s.slice(0, start) + s.slice(end)
    const at = rest.indexOf(anchor)
    return rest.slice(0, at) + block + '\n\n' + rest.slice(at)
  })
}

// ─── 用例表 ──────────────────────────────────────────────
// expect: null = 必须通过(exit 0);字符串 = 必须 exit 非 0 且命中该断言 id
const CASES = [
  { name: '基线未改动 → 必须通过', expect: null },

  // A. tauri.conf.json 配置不变量
  {
    name: 'A2/A3/A4 三项配置全部置 null',
    mutate: (d) => setNsis(d, { template: null, installerHooks: null, languages: null }),
    expect: 'A2',
  },
  { name: 'A2 template 置空字符串', mutate: (d) => setNsis(d, { template: '' }), expect: 'A2' },
  { name: 'A2 template 改回内置(删键)', mutate: (d) => dropNsisKey(d, 'template'), expect: 'A2' },
  { name: 'A3 installerHooks 置空', mutate: (d) => setNsis(d, { installerHooks: '' }), expect: 'A3' },
  { name: 'A3 hooks.nsi 文件被删', mutate: (d) => rmSync(join(d, HOOKS_REL)), expect: 'A3' },
  {
    name: 'A4 languages = ["zh-CN","English"](0.1.35 事故复现)',
    mutate: (d) => setNsis(d, { languages: ['zh-CN', 'English'] }),
    expect: 'A4',
  },
  { name: 'A4 languages = ["zh_CN"]', mutate: (d) => setNsis(d, { languages: ['zh_CN'] }), expect: 'A4' },
  { name: 'A4 languages 只有 English', mutate: (d) => setNsis(d, { languages: ['English'] }), expect: 'A4' },
  { name: 'A4 languages 清空', mutate: (d) => setNsis(d, { languages: [] }), expect: 'A4' },
  {
    name: 'A4 languages 是字符串而非数组',
    mutate: (d) => setNsis(d, { languages: 'SimpChinese' }),
    expect: 'A4',
  },
  { name: 'A5 installMode = both(静默击穿)', mutate: (d) => setNsis(d, { installMode: 'both' }), expect: 'A5' },
  {
    name: 'A6 compression = lzma(关闭产物级校验前提)',
    mutate: (d) => setNsis(d, { compression: 'lzma' }),
    expect: 'A6',
  },

  // B. installer.nsi 定制块
  {
    name: 'B1 定制块起始标记被删',
    mutate: (d) => editNsi(d, (s) => s.replace(BLOCK_START, '; 默认目录')),
    expect: 'B1',
  },
  {
    name: 'B1 定制块结束标记被删',
    mutate: (d) => editNsi(d, (s) => s.replace(BLOCK_END, '; 结束')),
    expect: 'B1',
  },
  {
    name: 'B1 结束标记跑到起始之前(次序颠倒)',
    mutate: (d) =>
      editNsi(d, (s) => s.replace(BLOCK_END, '').replace(BLOCK_START, `${BLOCK_END}\n${BLOCK_START}`)),
    expect: 'B1',
  },
  {
    name: 'B2 中文目录被改成 ProgramFiles',
    mutate: (d) =>
      editNsi(d, (s) => s.replace('StrCpy $INSTDIR "D:\\智汇AI"', 'StrCpy $INSTDIR "$PROGRAMFILES64\\智汇AI"')),
    expect: 'B2',
  },
  {
    name: 'B2 英文目录被改成 ProgramFiles',
    mutate: (d) =>
      editNsi(d, (s) => s.replace('StrCpy $INSTDIR "D:\\IHUI AI"', 'StrCpy $INSTDIR "$PROGRAMFILES\\IHUI AI"')),
    expect: 'B2',
  },
  {
    name: 'B3 语言判别 2052 → 2051',
    mutate: (d) => editNsi(d, (s) => s.replace('${If} $LANGUAGE == 2052', '${If} $LANGUAGE == 2051')),
    expect: 'B3',
  },
  {
    name: 'B3 判别变量换成字面量比较(旧 0.1.39 假分支)',
    mutate: (d) => editNsi(d, (s) => s.replace('${If} $LANGUAGE == 2052', '${If} $R0 == "zh-CN"')),
    expect: 'B3',
  },
  {
    name: 'B3 删掉 ${Else} 分支',
    mutate: (d) =>
      editNsi(d, (s) => s.replace('      StrCpy $INSTDIR "D:\\智汇AI"\n    ${Else}\n', '      StrCpy $INSTDIR "D:\\智汇AI"\n')),
    expect: 'B3',
  },
  {
    name: 'B4 删掉块内 RestorePreviousInstallLocation',
    mutate: (d) =>
      editNsi(d, (s) => s.replace(`    Call RestorePreviousInstallLocation\n    ${BLOCK_END}`, `    ${BLOCK_END}`)),
    expect: 'B4',
  },
  { name: 'B5 定制块移到 Section 之后', mutate: (d) => moveBlock(d, 'Section EarlyChecks'), expect: 'B5' },
  { name: 'B5 定制块移到 .onInit 之前', mutate: (d) => moveBlock(d, 'Function .onInit'), expect: 'B5' },
  {
    name: 'B6 包裹层条件被上游改掉',
    mutate: (d) =>
      editNsi(d, (s) => s.replace('${If} $INSTDIR == "${PLACEHOLDER_INSTALL_DIR}"', '${If} $INSTDIR == ""')),
    expect: 'B6',
  },
  {
    name: 'B6 包裹层整行被删',
    mutate: (d) => editNsi(d, (s) => s.replace('  ${If} $INSTDIR == "${PLACEHOLDER_INSTALL_DIR}"\n', '')),
    expect: 'B6',
  },
  {
    name: 'B7 MULTIUSER_INIT 的 INSTALLMODE 条件守卫被删',
    mutate: (d) =>
      editNsi(d, (s) =>
        s.replace('  !if "${INSTALLMODE}" == "both"\n    !insertmacro MULTIUSER_INIT\n  !endif', '  !insertmacro MULTIUSER_INIT'),
      ),
    expect: 'B7',
  },

  // C. hooks.nsi 职责边界
  {
    name: 'C1 hooks.nsi 里私写 StrCpy $INSTDIR(死路修复)',
    mutate: (d) => appendHooks(d, '\n!macro NSIS_HOOK_POSTINSTALL\n  StrCpy $INSTDIR "C:\\temp"\n!macroend\n'),
    expect: 'C1',
  },
  {
    name: 'C1 hooks.nsi 里间接赋值 StrCpy $INSTDIR $0',
    mutate: (d) => appendHooks(d, '\n!macro NSIS_HOOK_PREINSTALL\n  StrCpy $INSTDIR $0\n!macroend\n'),
    expect: 'C1',
  },
]

for (const c of CASES) {
  test(`守门对抗 · ${c.name}`, () => {
    const dir = buildSandbox()
    try {
      c.mutate?.(dir)
      const { status, out } = runGuard(dir)
      if (c.expect === null) {
        assert.equal(status, 0, `基线不应被拦截,实际 exit ${status}\n${out}`)
        return
      }
      assert.notEqual(status, 0, `应被拦截,实际 exit 0\n${out}`)
      const ids = idsOf(out)
      assert.ok(ids.has(c.expect), `应命中断言 ${c.expect},实际命中 [${[...ids].join(', ')}]\n${out}`)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
}

// ─── 平台适用性门(锁住 2026-09-18 两次 CI 假失败) ────────
/**
 * ⚠️ 这两个脚本推导根目录的方式**不同**,必须分别处理:
 *   · `check-desktop-install-dir.mjs` 用 `process.cwd()`  → 把 cwd 指到沙盒即可;
 *   · `desktop-nsis-template.mjs` 用**自身位置**(`import.meta.url`)推 ROOT
 *     → 必须把脚本**复制进沙盒**再跑,否则它会去读真实仓库(实测过:会真的
 *     找到仓库 node_modules 里的 Tauri CLI,甚至在 `--write` 下重写真实
 *     `installer.nsi`)。
 * 另外清空 PATH + 把 APPDATA 指向沙盒,确保不可能命中本机全局 `@tauri-apps/cli`
 * ——否则"定位不到 CLI"的用例会**假通过**。
 */
function buildSandboxWithScripts() {
  const dir = buildSandbox()
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  copyFileSync(TEMPLATE_SCRIPT, join(dir, 'scripts', 'desktop-nsis-template.mjs'))
  copyFileSync(GUARD, join(dir, 'scripts', 'check-desktop-install-dir.mjs'))
  return dir
}

function runSandboxed(relScript, platform, extraArgs = []) {
  const dir = buildSandboxWithScripts()
  const preload = join(dir, 'force-platform.cjs')
  writeFileSync(preload, `Object.defineProperty(process, 'platform', { value: ${JSON.stringify(platform)} })\n`)
  const r = spawnSync(process.execPath, ['-r', preload, join(dir, relScript), ...extraArgs], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      SystemRoot: process.env.SystemRoot ?? '',
      APPDATA: join(dir, 'appdata'),
      LOCALAPPDATA: join(dir, 'appdata'),
      PATH: '', // 空 PATH:脚本内部不可能找到 npm
    },
  })
  rmSync(dir, { recursive: true, force: true })
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(ANSI, '') }
}

const TEMPLATE_REL = join('scripts', 'desktop-nsis-template.mjs')
const GUARD_REL = join('scripts', 'check-desktop-install-dir.mjs')

test('平台门 · 非 Windows + --check + --require-cli → 必须 exit 0(不是漂移)', () => {
  const { status, out } = runSandboxed(TEMPLATE_REL, 'linux', ['--check', '--require-cli'])
  assert.equal(status, 0, `非 Windows 上 NSIS 模板没有对照物,必须显式跳过而不是报漂移\n${out}`)
  assert.match(out, /跳过漂移校验/, '跳过原因必须**显式打印**,不允许静默放过')
})

test('平台门 · 非 Windows + --write → 必须 exit 1(无上游模板无法生成)', () => {
  const { status, out } = runSandboxed(TEMPLATE_REL, 'linux', ['--write'])
  assert.notEqual(status, 0, `--write 需要真模板,非 Windows 上必须失败(不能被平台门放过)\n${out}`)
})

test('平台门 · Windows + 定位不到 CLI + --require-cli → 必须 exit 1(不得静默跳过)', () => {
  const { status, out } = runSandboxed(TEMPLATE_REL, 'win32', ['--check', '--require-cli'])
  assert.notEqual(status, 0, `Windows 上定位不到 CLI 视为失败,否则漂移校验会被静默跳过\n${out}`)
})

test('平台门 · 父脚本在非 Windows + --template --require-cli → 必须 exit 0 且显式说明跳过', () => {
  const { status, out } = runSandboxed(GUARD_REL, 'linux', ['--template', '--require-cli'])
  assert.equal(status, 0, `父脚本应把平台判定上提,不进入子脚本比对\n${out}`)
  assert.match(out, /平台不适用/, '必须打印"平台不适用"的显式跳过原因')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
