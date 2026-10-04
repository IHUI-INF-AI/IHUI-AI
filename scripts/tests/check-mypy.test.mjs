// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { maskComments } from '../lib/code-mask.mjs'
// 判据从**源模块**取(§22d 的 isDirectRun 保证 import 不触发 CLI 副作用),不在测试里再抄一份。
import { __test__ as mypyTest } from '../check-mypy.mjs'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPTS_DIR = join(__dirname, '..')
const SOURCE_SCRIPT = join(SCRIPTS_DIR, 'check-mypy.mjs')

// ─── 辅助:创建临时 git 仓库 + 复制脚本(含 import 闭包)+ stub mypy ─────
// 门脚本的 ROOT 由**脚本自身位置**推导(2026-09-29 起不再看 process.cwd()),
// 所以脚本必须落在 `<演练仓>/scripts/` 下,结论才对着演练仓而不是真仓。
// stub mypy(.stub-bin/mypy.cmd + mypy-stub.js)通过 PATH 注入,可控:
//   STUB_MYPY_EXIT / STUB_MYPY_OUT          —— 一律化的退出码与输出
//   STUB_MYPY_FAIL_IF_EXISTS                —— `;` 分隔的相对路径,存在即 exit 1
//   STUB_MYPY_FAIL_IF_TEXT                  —— `;` 分隔的 `相对路径::哨兵文本`,内容命中即 exit 1
//   STUB_MYPY_VERSION_EXIT                  —— 单独模拟"未安装"
// 后两条是本次改动的**判据级**证明:它们模拟的是"真 mypy 会因为某个文件在/写成某样而报错",
// 于是"未跟踪的在飞文件不得改变结论"与"面上的内容必须被真的看见"都能被端到端量出来,
// 而不是靠读实现点头(§22c:镜像测试只复读实现就是复读机)。
function createTempRepo() {
  const dir = mkScratch('ihui-mypy-')
  execSync('git init -b main', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
  execSync('git config user.email test@test.com', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
  execSync('git config user.name test', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
  execSync('git config commit.gpgsign false', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  // 门现在 import 共用层(面取材 + 临时落点),复制面必须是**整条相对 import 闭包**。
  // 手抄清单必然晚一拍:`scratch-module-closure.mjs` 头注记过两次同型(ERR_MODULE_NOT_FOUND +
  // 子进程 exit 1 + stdout 空,而被测行为一行没动),所以这里用推导而不是清单。
  copyScriptWithClosure(SCRIPTS_DIR, 'check-mypy.mjs', join(dir, 'scripts'), [
    'lib/face-reader.mjs',
    'lib/scratch-dir.mjs',
    'lib/gitdir.mjs',
  ])
  // 创建 apps/ai-service/app/(mypy 命令的 cwd 与参数路径)
  mkdirSync(join(dir, 'apps', 'ai-service', 'app'), { recursive: true })
  // 创建 stub mypy(.cmd 包装 + .js 实现可控退出)
  const binDir = join(dir, '.stub-bin')
  mkdirSync(binDir, { recursive: true })
  writeFileSync(
    join(binDir, 'mypy.cmd'),
    '@echo off\r\nnode "%~dp0mypy-stub.js" %*\r\nexit /b %errorlevel%\r\n',
  )
  // stub 必须**按动词分流**,不得对所有调用一律回同一退出码。
  // 被测 check-mypy.mjs 的「环境缺失 ≠ 代码回归」分支先跑 `mypy --version` 探测可执行性:
  // 探测失败即打印"未安装 mypy"并 exit 0。若 stub 把 --version 也按 STUB_MYPY_EXIT 返回,
  // 则注入 exit=1 时会被判成"未安装"而走放行分支 —— 夹具语义窄于真引擎,红的是夹具不是被测。
  writeFileSync(
    join(binDir, 'mypy-stub.js'),
    "const fs = require('node:fs')\n" +
      "const path = require('node:path')\n" +
      'const argv = process.argv.slice(2)\n' +
      'if (argv.includes("--version")) {\n' +
      '  console.log(process.env.STUB_MYPY_VERSION_OUT || "mypy 1.11.0 (stub)")\n' +
      '  process.exit(parseInt(process.env.STUB_MYPY_VERSION_EXIT || "0", 10))\n' +
      '}\n' +
      // 把"我到底在哪个目录被跑出来"带回 stdout —— 证明 mypy 跑在物化面上,而不是仓库目录。
      'console.log("STUBCWD=" + process.cwd())\n' +
      'const cwd = process.cwd()\n' +
      'const bad = []\n' +
      'for (const rel of (process.env.STUB_MYPY_FAIL_IF_EXISTS || "").split(";").filter(Boolean)) {\n' +
      '  if (fs.existsSync(path.join(cwd, rel))) bad.push("exists:" + rel)\n' +
      '}\n' +
      'for (const spec of (process.env.STUB_MYPY_FAIL_IF_TEXT || "").split(";").filter(Boolean)) {\n' +
      '  const i = spec.indexOf("::")\n' +
      '  if (i < 0) continue\n' +
      '  const rel = spec.slice(0, i)\n' +
      '  const needle = spec.slice(i + 2)\n' +
      '  const abs = path.join(cwd, rel)\n' +
      '  if (fs.existsSync(abs) && fs.readFileSync(abs, "utf8").includes(needle)) bad.push("text:" + rel)\n' +
      '}\n' +
      'if (bad.length) {\n' +
      '  console.log(bad.map((b) => "app/stub_caused.py:1: error: STUB-CAUSE " + b).join("\\n"))\n' +
      '  console.log("Found " + bad.length + " errors in 1 file (checked 1 source file)")\n' +
      '  process.exit(1)\n' +
      '}\n' +
      'const out = process.env.STUB_MYPY_OUT || ""\n' +
      'if (out) console.log(out)\n' +
      'process.exit(parseInt(process.env.STUB_MYPY_EXIT || "0", 10))\n',
  )
  // .gitignore 掉 stub(防止污染 staged 检测)
  writeFileSync(join(dir, '.gitignore'), '.stub-bin/\n')
  // 初始 commit(git diff --cached 需要 HEAD 作为参照)
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSync('git add README.md .gitignore', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
  execSync('git commit -m init', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
  return dir
}

// ─── 辅助:运行脚本(stdout/stderr 去除 ANSI 颜色码) ─────
// 注入 stub mypy 路径到 PATH 最前(Windows env key 大小写不确定,需探测)
// opts.cwd 是给"ROOT 必须由脚本自身位置推导"那一条用例的通道:调用者站在哪儿都不得改变判定面。
function runScript(dir, args = [], opts = {}) {
  const scriptPath = join(dir, 'scripts', 'check-mypy.mjs')
  const env = { ...process.env, ...(opts.env || {}) }
  const pathKey =
    Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'Path'
  if (opts.stub === false) {
    // 真 mypy 通道:注入调用方给定的目录(不放 stub),用于阳性对照
    env[pathKey] = `${opts.prependPath};${env[pathKey] || ''}`
  } else {
    const binDir = join(dir, '.stub-bin')
    env[pathKey] = `${binDir};${env[pathKey] || ''}`
  }
  const r = spawnSync('node', [scriptPath, ...args], {
    cwd: opts.cwd || dir,
    encoding: 'utf8',
    env,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: opts.timeout || 300000,
  })
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  r.err = (r.stderr || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

// ─── 辅助:在临时仓库创建文件并 stage ─────────────────────
function stageFile(dir, relPath, content = '') {
  const full = join(dir, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
  execSync(`git add "${relPath}"`, { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
}

/** 只写盘不入库 —— 这就是"邻居的在飞文件/未跟踪现场",判定面不该看见它。 */
function writeOnly(dir, relPath, content = '') {
  const full = join(dir, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

/** 写盘 + add + commit —— 这才是"已入库代码",阳性对照必须走这条路。 */
function commitFile(dir, relPath, content = '') {
  stageFile(dir, relPath, content)
  execSync('git commit -m feat-fixture -q', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
}

// ─── 1. CLI 行为 ─────────────────────────────────────────

test('CLI: --help → exit 0 + 打印用法', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(dir, ['--help'])
    assert.equal(r.status, 0, `--help 应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /用法/)
    assert.match(r.out, /--staged/)
    assert.match(r.out, /mypy/)
  } finally {
    rmScratch(dir)
  }
})

test('CLI: -h 别名 → exit 0 + 打印用法', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(dir, ['-h'])
    assert.equal(r.status, 0, `-h 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /用法/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 2. 跳过机制:HUSKY_SKIP_MYPY(紧急场景) ────────────

test('Skip: HUSKY_SKIP_MYPY=1 → exit 0 + 跳过提示', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(dir, [], { env: { HUSKY_SKIP_MYPY: '1' } })
    assert.equal(r.status, 0, `HUSKY_SKIP_MYPY=1 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /已跳过/)
    assert.match(r.out, /HUSKY_SKIP_MYPY=1/)
  } finally {
    rmScratch(dir)
  }
})

test('Skip 优先级: --help + HUSKY_SKIP_MYPY=1 → exit 0 + 用法(help 优先,无跳过提示)', () => {
  // 脚本先判 showHelp 再判 HUSKY_SKIP_MYPY,help 胜出
  const dir = createTempRepo()
  try {
    const r = runScript(dir, ['--help'], { env: { HUSKY_SKIP_MYPY: '1' } })
    assert.equal(r.status, 0, `应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /用法/, '应打印 help 用法')
    assert.ok(!r.out.includes('已跳过'), 'help 优先,不应打印跳过提示')
  } finally {
    rmScratch(dir)
  }
})

// ─── 3. --staged 模式:无 apps/ai-service/**/*.py 改动 → 跳过 ──

test('--staged: 无 staged 文件 → exit 0 + 跳过', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `无 staged 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /跳过/)
  } finally {
    rmScratch(dir)
  }
})

test('--staged: staged .ts(非 Python)→ exit 0 + 跳过', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/web/foo.ts', 'export const x = 1\n')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `非 Python staged 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /跳过/)
  } finally {
    rmScratch(dir)
  }
})

test('--staged: staged .py 不在 apps/ai-service/(apps/api/)→ exit 0 + 跳过', () => {
  // 脚本过滤条件:f.startsWith('apps/ai-service/') && f.endsWith('.py')
  // apps/api/main.py 前缀不匹配,应跳过
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/api/main.py', 'print(1)\n')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `apps/api/ 下 .py 不匹配前缀\nstdout: ${r.out}`)
    assert.match(r.out, /跳过/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 4. --staged 模式:有 apps/ai-service/**/*.py 改动 → 触发 mypy ──

test('--staged: staged .py 在 apps/ai-service/ + mypy success → exit 0 + ✅', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/ai-service/app/main.py', 'x: int = 1\n')
    const r = runScript(dir, ['--staged'], {
      env: {
        STUB_MYPY_EXIT: '0',
        STUB_MYPY_OUT: 'Success: no issues found in 1 source file',
      },
    })
    assert.equal(r.status, 0, `mypy success 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /检测到 1 个 Python 文件改动/)
    assert.match(r.out, /✅.*mypy 守门通过/)
    assert.match(r.out, /apps\/ai-service\/app\/main\.py/)
  } finally {
    rmScratch(dir)
  }
})

test('--staged: staged .py 在 apps/ai-service/ 子目录 → 触发 mypy(子目录匹配)', () => {
  // 前缀 startsWith('apps/ai-service/') 覆盖任意深度子目录
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/ai-service/app/services/deep.py', 'y: str = "hi"\n')
    const r = runScript(dir, ['--staged'], {
      env: {
        STUB_MYPY_EXIT: '0',
        STUB_MYPY_OUT: 'Success: no issues found in 1 source file',
      },
    })
    assert.equal(r.status, 0, `子目录 .py 应触发 mypy\nstdout: ${r.out}`)
    assert.match(r.out, /检测到 1 个 Python 文件改动/)
    assert.match(r.out, /apps\/ai-service\/app\/services\/deep\.py/)
  } finally {
    rmScratch(dir)
  }
})

test('--staged: staged .py + mypy fail → exit 1 + ❌ + 错误输出 + 修复方法', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/ai-service/app/bad.py', 'x: int = "str"\n')
    const r = runScript(dir, ['--staged'], {
      env: {
        STUB_MYPY_EXIT: '1',
        STUB_MYPY_OUT: 'app/bad.py:1: error: Incompatible types',
      },
    })
    assert.equal(r.status, 1, `mypy fail 应 exit 1\nstdout: ${r.out}`)
    assert.match(r.out, /❌.*mypy 守门失败/)
    assert.match(r.out, /Incompatible types/)
    assert.match(r.out, /修复方法/)
  } finally {
    rmScratch(dir)
  }
})

test('--staged: 混合(1 .py + 1 .ts)→ 检测计数 1 + 不列 .ts', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/web/util.ts', 'export const z = 1\n')
    stageFile(dir, 'apps/ai-service/app/util.py', 'z: int = 1\n')
    const r = runScript(dir, ['--staged'], {
      env: {
        STUB_MYPY_EXIT: '0',
        STUB_MYPY_OUT: 'Success: no issues found in 1 source file',
      },
    })
    assert.equal(r.status, 0, `mypy success 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /检测到 1 个 Python 文件改动/)
    // .ts 文件不应出现在 Python 检测列表中
    assert.ok(!r.out.includes('util.ts'), `不应列出 .ts 文件\nstdout: ${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('--staged: 12 个 .py → 截断提示 "... 及其他 2 个文件"', () => {
  // 脚本 slice(0, 10) 列前 10 个,超出则打印 "... 及其他 N 个文件"
  const dir = createTempRepo()
  try {
    for (let i = 0; i < 12; i++) {
      stageFile(dir, `apps/ai-service/app/mod${i}.py`, `v${i}: int = ${i}\n`)
    }
    const r = runScript(dir, ['--staged'], {
      env: {
        STUB_MYPY_EXIT: '0',
        STUB_MYPY_OUT: 'Success: no issues found in 12 source files',
      },
    })
    assert.equal(r.status, 0, `mypy success 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /检测到 12 个 Python 文件改动/)
    assert.match(r.out, /\.\.\. 及其他 2 个文件/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 5. 默认模式(无 --staged)→ 判 HEAD 面 ───────────────

test('默认: HEAD 面有 .py + mypy success → exit 0 + ✅ + 判定面=HEAD(物化)', () => {
  const dir = createTempRepo()
  try {
    commitFile(dir, 'apps/ai-service/app/main.py', 'x: int = 1\n')
    const r = runScript(dir, [], {
      env: {
        STUB_MYPY_EXIT: '0',
        STUB_MYPY_OUT: 'Success: no issues found in 1 source file',
      },
    })
    assert.equal(r.status, 0, `mypy success 应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /判定面=HEAD blob\(物化后判定\)/)
    assert.match(r.out, /✅.*mypy 守门通过/)
    assert.match(r.out, /实检 1 个源文件/, '覆盖面自证必须读出 mypy 实检数(读不到等于没有)')
  } finally {
    rmScratch(dir)
  }
})

test('默认: HEAD 面有 .py + mypy fail → exit 1 + ❌ + 错误输出', () => {
  const dir = createTempRepo()
  try {
    commitFile(dir, 'apps/ai-service/app/main.py', 'x: int = "str"\n')
    const r = runScript(dir, [], {
      env: {
        STUB_MYPY_EXIT: '1',
        STUB_MYPY_OUT: 'app/main.py:3: error: Some type error',
      },
    })
    assert.equal(r.status, 1, `mypy fail 应 exit 1\nstdout: ${r.out}`)
    assert.match(r.out, /❌.*mypy 守门失败/)
    assert.match(r.out, /Some type error/)
    assert.match(r.out, /修复方法/)
  } finally {
    rmScratch(dir)
  }
})

test('默认: 面上枚举到 0 个 Python 文件 → exit 2 判死(空扫不得记绿)', () => {
  // 初始 commit 里只有 README —— 若"什么都没检"被当成通过,这道门就永远绿灯。
  const dir = createTempRepo()
  try {
    const r = runScript(dir, [], { env: { STUB_MYPY_OUT: 'SENTINEL-mypy-ran' } })
    assert.equal(r.status, 2, `枚举到 0 应 exit 2\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /无法判定/)
    assert.ok(!r.out.includes('SENTINEL-mypy-ran'), '空面不得派生 mypy')
    assert.ok(!r.out.includes('✅'), '空面不得记通过')
  } finally {
    rmScratch(dir)
  }
})

// ─── 5a. 本次改动的主判据:被审内容 ≠ 机器现场 ────────────────

test('未跟踪的在飞文件不得改变结论;同一份内容入库后必须判红', () => {
  // 形态取自本仓 2026-09-29 现读:`app/services/sandbox/`(未跟踪包)与已跟踪的
  // `app/services/sandbox.py` 并存 —— 工作树跑 mypy 时包遮蔽模块,报出与任何一面都无关的红。
  const dir = createTempRepo()
  try {
    commitFile(dir, 'apps/ai-service/app/services/sandbox.py', '_DANGEROUS_PATTERNS = []\n')
    // 只写盘、不 add、不 commit ⇒ 邻居的在飞现场
    writeOnly(dir, 'apps/ai-service/app/services/sandbox/__init__.py', 'from . import queue\n')
    writeOnly(dir, 'apps/ai-service/app/services/sandbox/queue.py', 'x = 1\n')
    const failEnv = { STUB_MYPY_FAIL_IF_EXISTS: 'app/services/sandbox/queue.py' }

    const head = runScript(dir, [], { env: failEnv })
    assert.equal(head.status, 0, `未跟踪文件不得算仓库类型债\nstdout: ${head.out}\nstderr: ${head.err}`)
    assert.match(head.out, /遮蔽已跟踪模块 apps\/ai-service\/app\/services\/sandbox\.py/, '必须点名那批路径')
    assert.match(head.out, /STUBCWD=/)
    const cwdLine = ((head.out.match(/STUBCWD=([^\r\n]*)/) || [])[1] || '').trim()
    assert.ok(cwdLine.length > 0, 'stub 必须回报它自己的 cwd')
    assert.ok(
      !cwdLine.startsWith(dir),
      `mypy 必须跑在物化出来的临时面上,不是演练仓目录:${cwdLine}`,
    )
    assert.match(cwdLine, /ihui-scratch/, `临时面必须落在 scratch-dir 的落点:${cwdLine}`)
    assert.match(cwdLine, /[\\/]apps[\\/]ai-service$/, `临时面里的运行目录:${cwdLine}`)

    // 阳性对照:同一份内容进了索引 ⇒ 判定面变了 ⇒ 必须红
    execSync('git add apps/ai-service/app/services/sandbox', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
    const staged = runScript(dir, ['--staged'], { env: failEnv })
    assert.equal(staged.status, 1, `已入面的同一形态必须判红\nstdout: ${staged.out}`)
    assert.match(staged.out, /STUB-CAUSE exists:app\/services\/sandbox\/queue\.py/)
    assert.match(staged.out, /判定面=索引 blob\(物化后判定\)/)
  } finally {
    rmScratch(dir)
  }
})

test('邻居把工作树改成坏的(未 staged)不得挡住提交;把它 staged 后必须挡', () => {
  // 判据吃的是**内容**,不是路径存在性 —— 这一条证明"被审的是那一面的字节"。
  const CLEAN = 'def f() -> int:\n    return 1\n'
  const BROKEN = 'def f() -> int:\n    return "oops"\n'
  const dir = createTempRepo()
  try {
    commitFile(dir, 'apps/ai-service/app/handler.py', CLEAN)
    const failEnv = { STUB_MYPY_FAIL_IF_TEXT: 'app/handler.py::oops' }

    // HEAD 面:干净 ⇒ 绿
    assert.equal(runScript(dir, [], { env: failEnv }).status, 0)

    // 邻居只改工作树(既没 add 也没 commit)⇒ 索引面与 HEAD 面都还是干净的
    writeOnly(dir, 'apps/ai-service/app/handler.py', BROKEN)
    const worktreeDirty = runScript(dir, ['--staged'], { env: failEnv })
    // --staged 无暂存改动 ⇒ 跳过(与在飞文件无关);这正是"别人暂存 ai-service 不再被挡"的那一格
    assert.equal(worktreeDirty.status, 0, `未 staged 的在飞改动不得判红\nstdout: ${worktreeDirty.out}`)

    // 有人暂存了**自己**的另一个 .py ⇒ 面 = 索引;handler.py 的坏版本仍在磁盘、不属任何面
    stageFile(dir, 'apps/ai-service/app/other.py', 'z: int = 1\n')
    const stagedOther = runScript(dir, ['--staged'], { env: failEnv })
    assert.equal(stagedOther.status, 0, `索引面的 handler.py 仍是干净版本\nstdout: ${stagedOther.out}`)

    // 把坏版本 staged ⇒ 判定面变了 ⇒ 必须红(不得削弱判红能力)
    stageFile(dir, 'apps/ai-service/app/handler.py', BROKEN)
    const stagedBroken = runScript(dir, ['--staged'], { env: failEnv })
    assert.equal(stagedBroken.status, 1, `索引面里的真错误必须判红\nstdout: ${stagedBroken.out}`)
    assert.match(stagedBroken.out, /STUB-CAUSE text:app\/handler\.py/)
  } finally {
    rmScratch(dir)
  }
})

test('ROOT 由脚本自身位置推导:调用者站在别处,判定面不变', () => {
  // 守门 70 那一型的反向锁 —— 旧写法 `process.cwd()` 让"扫哪棵树"随调用者位置漂。
  const dir = createTempRepo()
  const elsewhere = mkScratch('ihui-mypy-cwd-')
  try {
    commitFile(dir, 'apps/ai-service/app/marker.py', 'BAD_SENTINEL = 1\n')
    const r = runScript(dir, [], {
      cwd: elsewhere,
      env: { STUB_MYPY_FAIL_IF_TEXT: 'app/marker.py::BAD_SENTINEL' },
    })
    assert.equal(r.status, 1, `换 cwd 不得换判定面(面仍来自脚本所在仓)\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /STUB-CAUSE text:app\/marker\.py/)
    // 阳性对照的对照:换一份**干净**的演练仓、同一个别处 cwd ⇒ 必须绿。
    // 少了这一臂,"红"可能只是 cwd 那条链路坏了,而不是判据真的读了演练仓。
    const clean = createTempRepo()
    try {
      commitFile(clean, 'apps/ai-service/app/marker.py', 'GOOD = 1\n')
      const ok = runScript(clean, [], {
        cwd: elsewhere,
        env: { STUB_MYPY_FAIL_IF_TEXT: 'app/marker.py::BAD_SENTINEL' },
      })
      assert.equal(ok.status, 0, `干净面 + 同一个别处 cwd ⇒ 应绿\nstdout: ${ok.out}\nstderr: ${ok.err}`)
    } finally {
      rmScratch(clean)
    }
  } finally {
    rmScratch(dir)
    rmScratch(elsewhere)
  }
})

test('--worktree 人工逃生舱:判磁盘,并把遮蔽形态点名出来', () => {
  // 这条锁的是"逃生舱还在、且它知道自己判的不是被审面" —— 它复现的正是本次消掉的那格误红。
  const dir = createTempRepo()
  try {
    commitFile(dir, 'apps/ai-service/app/services/sandbox.py', '_DANGEROUS_PATTERNS = []\n')
    writeOnly(dir, 'apps/ai-service/app/services/sandbox/__init__.py', 'from . import queue\n')
    writeOnly(dir, 'apps/ai-service/app/services/sandbox/queue.py', 'x = 1\n')
    const r = runScript(dir, ['--worktree'], {
      env: { STUB_MYPY_FAIL_IF_EXISTS: 'app/services/sandbox/queue.py' },
    })
    assert.equal(r.status, 1, `磁盘面确有该文件 ⇒ 应红(人工诊断用)\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /本档判的是磁盘/)
    assert.match(r.out, /遮蔽/)
    assert.match(r.out, /不得作为提交门禁/)
  } finally {
    rmScratch(dir)
  }
})


// ─── 5c. 三态退出码:未判定 ≠ 通过 ≠ 判红 ────────────────────

test('两面旗同给(--staged --worktree)→ exit 2(互斥,不得任选一面)', () => {
  const dir = createTempRepo()
  try {
    commitFile(dir, 'apps/ai-service/app/main.py', 'x: int = 1\n')
    const r = runScript(dir, ['--staged', '--worktree'], {
      env: { STUB_MYPY_OUT: 'SENTINEL-mypy-ran' },
    })
    assert.equal(r.status, 2, `stdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /不得同用/)
    assert.ok(!r.out.includes('SENTINEL-mypy-ran'), '矛盾旗标不得继续派生 mypy')
  } finally {
    rmScratch(dir)
  }
})

test('mypy 以 rc=2 退出(工具自身故障)→ 未判定 exit 2,不得说成类型错误', () => {
  const dir = createTempRepo()
  try {
    commitFile(dir, 'apps/ai-service/app/main.py', 'x: int = 1\n')
    const r = runScript(dir, [], {
      env: { STUB_MYPY_EXIT: '2', STUB_MYPY_OUT: 'mypy: can\'t read config file' },
    })
    assert.equal(r.status, 2, `stdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /无法判定/)
    assert.match(r.out, /rc=2/)
    assert.ok(!/❌ mypy 守门失败/.test(r.out), '工具故障不得冒充"代码有类型错误"')
  } finally {
    rmScratch(dir)
  }
})


// ─── 5b. 环境缺失分支:探测 --version 失败 → 放行而非判类型错误 ───

test('环境缺失: mypy --version 探测失败 → exit 0 + 明示未安装(不当成代码回归)', () => {
  // 反向钉住分流:真实检查被注入 exit 1,但只要 --version 探测失败,
  // 被测脚本(check-mypy.mjs:175-186)必须走"环境缺失放行"分支,
  // 不得输出 ❌ 守门失败,也不得执行真实 mypy。
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/ai-service/app/bad.py', 'x: int = "str"\n')
    const r = runScript(dir, ['--staged'], {
      env: {
        STUB_MYPY_VERSION_EXIT: '1',
        STUB_MYPY_EXIT: '1',
        STUB_MYPY_OUT: 'SENTINEL-real-mypy-ran',
      },
    })
    assert.equal(r.status, 0, `未安装应 exit 0 放行\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /未安装 mypy/, `应明示环境缺失\nstdout: ${r.out}`)
    assert.ok(!r.out.includes('SENTINEL-real-mypy-ran'), `不应执行真实检查\nstdout: ${r.out}`)
    assert.ok(!r.out.includes('❌'), `环境缺失不应报类型错误\nstdout: ${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 6. 跳过优先级:HUSKY_SKIP_MYPY > --staged 检测 ─────

test('Skip 优先级: --staged + HUSKY_SKIP_MYPY=1 + staged .py → exit 0 + 跳过(不触发 mypy)', () => {
  // HUSKY_SKIP_MYPY 判断在 --staged 检测之前,skip 胜出
  // 即使有 .py staged + stub 设为 fail,也不会触发 mypy
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/ai-service/app/skip.py', 's: int = 1\n')
    const r = runScript(dir, ['--staged'], {
      env: { HUSKY_SKIP_MYPY: '1', STUB_MYPY_EXIT: '1' },
    })
    assert.equal(r.status, 0, `HUSKY_SKIP_MYPY 应优先跳过\nstdout: ${r.out}`)
    assert.match(r.out, /已跳过/)
    // 不应出现检测计数(说明在 staged 检测之前就跳过了)
    assert.ok(!r.out.includes('检测到'), `skip 应在 staged 检测前\nstdout: ${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 6b. 纯判据的构造面/真仓证明(§22c:测试 import 源函数,不得再抄一份判据)──
// 这五条各钉一种"静默失明":物化漏文件 = 少检而账面绿;Success 版式读不成数 = 覆盖面自证
// 那条等于没写;两面同规格 = 索引面其实还在读 HEAD;rc=2 与 rc=1 并桶 = 把工具故障说成代码债。
test('S1 isMaterializable / listFacePaths 覆盖真仓 HEAD 的整个被检面', () => {
  const picked = mypyTest.listFacePaths(REPO_ROOT, 'head')
  assert.ok(picked.length > 500, `真仓 HEAD 面应有真实规模,实得 ${picked.length}`)
  const appPy = picked.filter((p) => p.startsWith('apps/ai-service/app/') && p.endsWith('.py'))
  assert.ok(appPy.length > 400, `app/ 下的 .py 必须整片在册,实得 ${appPy.length}`)
  assert.ok(picked.includes('apps/ai-service/pyproject.toml'), 'mypy 的配置源必须在面内')
  // 反向哨兵:面内不得混进 mypy 读不到的形态(只会拖慢,不会改变结论 —— 混进来就该问为什么)
  const stray = picked.filter(
    (p) => !(p.endsWith('.py') || p.endsWith('.pyi') || p === 'apps/ai-service/pyproject.toml'),
  )
  assert.equal(stray.length, 0, `漏进来的形态:${stray.slice(0, 5).join(', ')}`)
  // 单元层边界(真仓规模证明不了分支):射程外、非源码、扩展名不符都不得被收进来
  assert.equal(mypyTest.isMaterializable('apps/ai-service/app/x.py'), true)
  assert.equal(mypyTest.isMaterializable('apps/ai-service/pyproject.toml'), true)
  assert.equal(mypyTest.isMaterializable('apps/ai-service/uv.lock'), false)
  assert.equal(mypyTest.isMaterializable('packages/shared/src/x.py'), false, '射程外不得混进来')
})

test('S2 classifyMypyStatus 三态不得并桶(rc=2 是工具故障,不是类型错误)', () => {
  assert.equal(mypyTest.classifyMypyStatus(0, null), 'pass')
  assert.equal(mypyTest.classifyMypyStatus(1, null), 'errors')
  assert.equal(mypyTest.classifyMypyStatus(2, null), 'broken')
  assert.equal(mypyTest.classifyMypyStatus(null, 'SIGKILL'), 'killed')
  assert.equal(mypyTest.classifyMypyStatus(0, 'SIGTERM'), 'killed', '被信号杀掉不得当成通过')
})

test('S3 checkedCount:Success 版式也必须是数(只认 Found 版式 = 覆盖面自证读成 ?)', () => {
  assert.equal(
    mypyTest.checkedCount('Success: no issues found in 571 source files'),
    571,
    '成功版式的实检数读不出来,那条"少检必须看得见"的防线等于没有',
  )
  assert.equal(mypyTest.checkedCount('Found 2 errors in 1 file (checked 571 source files)'), 571)
  assert.equal(mypyTest.checkedCount('Success: no issues found in 1 source file'), 1)
  assert.equal(mypyTest.checkedCount('完全不含计数的输出'), null, '判不出要如实 null,不得猜 0')
})

test('S4 两面必须真的是两个规格(同规格 = 索引面其实还在读 HEAD)', () => {
  assert.equal(mypyTest.faceSpecPrefix('staged'), ':')
  assert.equal(mypyTest.faceSpecPrefix('head'), 'HEAD:')
  assert.equal(mypyTest.faceSpecPrefix('worktree'), null, 'worktree 不经物化通道')
  assert.match(mypyTest.faceLabelOf('staged'), /索引 blob/)
  assert.match(mypyTest.faceLabelOf('head'), /HEAD blob/)
  assert.match(mypyTest.faceLabelOf('worktree'), /工作树/)
})

test('S5 materializeFace 落的是 scratch 目录,缺文件必须被点名(不得静默少写)', () => {
  const dir = createTempRepo()
  try {
    commitFile(dir, 'apps/ai-service/app/a.py', 'x = 1\n')
    commitFile(dir, 'apps/ai-service/pyproject.toml', '[tool.mypy]\n')
    const paths = mypyTest.listFacePaths(dir, 'head')
    const got = mypyTest.materializeFace(dir, 'head', paths)
    try {
      assert.equal(got.missing.length, 0, `完整面不该有缺项:${got.missing.join(', ')}`)
      assert.equal(got.appPyOnFace, 1)
      assert.match(got.dir, /ihui-scratch/, '临时面必须落在 scratch-dir 的落点(§26)')
      assert.ok(
        existsSync(join(got.dir, 'apps', 'ai-service', 'app', 'a.py')),
        '面上的文件必须真在物化目录里',
      )
      // 构造一次缺项:请求一个面上并不存在的 blob ⇒ 必须进 missing,而不是"少写一个还报绿"
      const withGhost = mypyTest.materializeFace(dir, 'head', [
        ...paths,
        'apps/ai-service/app/ghost-not-on-face.py',
      ])
      try {
        assert.deepEqual(withGhost.missing, ['apps/ai-service/app/ghost-not-on-face.py'])
        assert.equal(withGhost.written, paths.length)
      } finally {
        rmScratch(withGhost.dir)
      }
    } finally {
      rmScratch(got.dir)
    }
  } finally {
    rmScratch(dir)
  }
})

// ─── 7. 阳性对照:真 mypy + 真入库错误 ⇒ 必须判红 ─────────────
// 这条锁的是本次改动最容易被"顺手弄瞎"的方向:把邻居在飞文件排除掉之后,
// 是否**连已入库的真错误也一起看不见**。判据必须吃真引擎,不能用 stub 自证。
// 拿不到真 mypy 时**如实 skip**(它不是通过),不得退化成"用 stub 假装证过"。
const REPO_ROOT = join(__dirname, '..', '..')
const REAL_MYPY_DIR = join(REPO_ROOT, 'apps', 'ai-service', '.venv', 'Scripts')
const REAL_MYPY = join(REAL_MYPY_DIR, 'mypy.exe')
const realMypyReady = existsSync(REAL_MYPY)

test(
  '阳性对照(真 mypy):HEAD 面里真类型错误 ⇒ exit 1;把它改对提交 ⇒ exit 0',
  { skip: realMypyReady ? false : `本机无真 mypy(${REAL_MYPY} 不在位)—— 未判定,不算证过` },
  () => {
    const dir = createTempRepo()
    try {
      commitFile(dir, 'apps/ai-service/app/broken.py', 'def f() -> int:\n    return "not an int"\n')
      const bad = runScript(dir, [], { stub: false, prependPath: REAL_MYPY_DIR, timeout: 240000 })
      assert.equal(bad.status, 1, `真入库错误必须判红\nstdout: ${bad.out}\nstderr: ${bad.err}`)
      assert.match(bad.out, /❌ mypy 守门失败/)
      assert.match(bad.out, /app[\\/]broken\.py:\d+: error:/)
      assert.match(bad.out, /判定面=HEAD blob\(物化后判定\)/)

      // 反向对照:同一位置改对并提交 ⇒ 绿。缺这一臂,"红"可能来自环境而不是判据。
      commitFile(dir, 'apps/ai-service/app/broken.py', 'def f() -> int:\n    return 1\n')
      const good = runScript(dir, [], { stub: false, prependPath: REAL_MYPY_DIR, timeout: 240000 })
      assert.equal(good.status, 0, `改对后应绿\nstdout: ${good.out}\nstderr: ${good.err}`)
      assert.match(good.out, /✅ mypy 守门通过/)
    } finally {
      rmScratch(dir)
    }
  },
)

// ─── 8. 源码形状锁:判据的**取材面**与**不放宽**必须被机器发现 ────
// 行为用例能证明"现在是对的",证明不了"下次不会被改回去"。守门 70/76/81 记过的正是这一型。
// 判的是**代码面**:头注/帮助文本里会**解释**旧写法(`process.cwd()`)与禁用形态,
// 拿原文做反向锁就会把"说明缺陷"当成缺陷(守门 131 那条同型)。遮噪只用共用层那一份实现。
const SRC = maskComments(readFileSync(SOURCE_SCRIPT, 'utf8'))

test('形状锁:内容必须走统一取材层,不得回到散写/磁盘判', () => {
  assert.match(SRC, /from '\.\/lib\/face-reader\.mjs'/, '面取材必须经 face-reader')
  assert.match(SRC, /catBatch\(/, '必须真的用层的读取入口(引了不用 = 半接线,守门 118 判红)')
  assert.match(SRC, /selectFace\(/, '面旗选择必须走层(--staged 与 --worktree 同给要判死)')
  assert.doesNotMatch(SRC, /process\.cwd\(\)/, 'ROOT 不得由调用者位置推导(AGENTS §15)')
  assert.doesNotMatch(SRC, /\breadFileSync\s*\(/, '不得按磁盘读被审内容')
  assert.match(SRC, /from '\.\/lib\/scratch-dir\.mjs'/, '临时面必须走 scratch-dir 落点(§26,禁 os.tmpdir)')
  assert.doesNotMatch(SRC, /os\.tmpdir|tmpdir\(\)/, '禁止 os.tmpdir()')
})

test('形状锁:判据不得被顺手放宽(--strict 双保险与暂存过滤必须在位)', () => {
  assert.match(SRC, /--ignore-missing-imports/, '第三方无 stub 的兼容位不得被摘')
  assert.match(SRC, /'--strict'/, "显式 --strict 是防 pyproject 被改回 false 的双保险")
  assert.doesNotMatch(SRC, /--no-strict-errors|--follow-imports=skip/, '不得用放宽换绿')
  // 物化面只能写进临时目录:写回仓库目录等于替别人改文件(§12)
  assert.equal(
    (SRC.match(/\bwriteFileSync\s*\(/g) || []).length,
    1,
    '全部门只允许 materializeFace 一处落盘,且它写的是 scratch 目录',
  )
  assert.match(SRC, /join\(dir, \.\.\.rel\.split\('\/'\)\)/, '落盘目标必须由物化目录拼出')
  assert.match(SRC, /rmScratch\(materialized\.dir\)|rmScratch\(dir\)/, '临时面必须被回收')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
