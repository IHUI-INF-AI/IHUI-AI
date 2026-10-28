// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 85(check-test-paths.mjs)的镜像测试。
 *
 * 两族判据,取证分两层(AGENTS.md §22c/§22d):
 *   · 前 16 例 = 既有形状(§23 的 `__*` 吞目录、反忽略双向、文件级第二层探查、计数与 --strict);
 *   · S 族 = 归属分流(`--staged` 只把"在册"的发现算本枚的红,只在盘上的记「未判定」+ exit 2)。
 * 判据函数(ownershipOf / isOnRecord / decideStagedExit / splitNulPaths / normRelPath)一律
 * **import 源脚本的 `__test__` 导出**,不抄第二份;端到端(退出码 + 逐字输出)仍 spawn CLI。
 * spawn 一律经 runScript() —— 它强制补 `--root <夹具>`,并把 windowsHide/timeout 收在一处。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { __test__ as GATE85 } from '../check-test-paths.mjs'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const HERE = dirname(__dirname)
const REPO = resolve(HERE, '..')
const SCRIPT_PATH = join(REPO, 'scripts', 'check-test-paths.mjs')
const GIT = resolveGitBin()
const ANSI = /\x1b\[[0-9;]*m/g
const strip = (s) => (s ?? '').replace(ANSI, '')

/**
 * 运行守门。⚠️ 必须显式带 `--root <夹具>`:源脚本的 ROOT 自 2026-09-27 起由 import.meta.url
 * 推导(§15,不再看 process.cwd()),靠 cwd 定位夹具的老写法会**静默变成审真仓** ——
 * 那正是"账面绿而结论与夹具无关"的守门 70 那一型,所以这里把通道封死在唯一helper里。
 */
function runScript(cwd, args = []) {
  const r = spawnSync(process.execPath, [SCRIPT_PATH, ...args, '--root', cwd], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 120000,
  })
  r.out = strip(r.stdout)
  r.err = strip(r.stderr)
  return r
}

// ─── 辅助:创建临时 git repo(check-test-paths.mjs 调用 git check-ignore,需 git 环境) ─
function createTempGitRepo(gitignoreContent = '') {
  const dir = mkScratch('ihui-test-paths-')
  gitAt(dir, ['init', '-q'])
  gitAt(dir, ['config', 'user.email', 'test@ihui.local'])
  gitAt(dir, ['config', 'user.name', 'Test'])
  gitAt(dir, ['config', 'commit.gpgsign', 'false'])
  if (gitignoreContent) writeFileSync(join(dir, '.gitignore'), gitignoreContent)
  return dir
}

function gitAt(cwd, args) {
  const r = spawnSync(GIT, ['-c', 'safe.directory=*', '-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 60000,
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败: ${r.stderr}`)
  return r.stdout
}

/** 夹具自证:提交一版让 HEAD / 索引都有内容(否则"在册"这一档无从构造) */
function commitAll(dir, ...pathspec) {
  gitAt(dir, ['add', '-f', '--', ...(pathspec.length ? pathspec : ['.'])])
  gitAt(dir, [
    '-c',
    'user.name=T',
    '-c',
    'user.email=t@l',
    'commit',
    '-q',
    '--no-verify',
    '-m',
    'fixture',
  ])
}

function writeDir(dir, relPath) {
  mkdirSync(join(dir, relPath), { recursive: true })
}

function writeFile(dir, relPath, content = '') {
  mkdirSync(join(dir, relPath, '..'), { recursive: true })
  writeFileSync(join(dir, relPath), content)
}

// ─── 1. CLI 行为 ─────────────────────────────────────────

test('CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行)', () => {
  const dir = createTempGitRepo()
  try {
    const r = runScript(dir, ['--help'])
    assert.ok(
      r.status === 0 || r.status === 1,
      `--help 不应 crash,实际 exit ${r.status}\nstderr: ${r.stderr}`,
    )
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生 Error 输出`)
  } finally {
    rmScratch(dir)
  }
})

test('CLI: 无参数运行(空目录)→ exit 0 + 未发现 __tests__/', () => {
  const dir = createTempGitRepo()
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `空目录应 exit 0\nstdout: ${r.out}\nstderr: ${r.stderr}`)
    assert.match(r.out, /未发现 __tests__\/ 目录/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 2. __tests__/ 目录检测(主项,AGENTS.md §23) ────────

test('__tests__/ 有 .gitkeep 且被 __* 规则命中 → 通过(exit 0)', () => {
  const dir = createTempGitRepo('__*\n')
  try {
    writeDir(dir, 'apps/web/__tests__')
    writeFile(dir, 'apps/web/__tests__/.gitkeep')
    const r = runScript(dir)
    assert.equal(r.status, 0, `有 .gitkeep 应通过\nstdout: ${r.out}`)
    assert.match(r.out, /__tests__/)
  } finally {
    rmScratch(dir)
  }
})

test('__tests__/ 无 .gitkeep 且被 __* 规则吞掉 → exit 1 (block,AGENTS.md §23 事故场景)', () => {
  const dir = createTempGitRepo('__*\n')
  try {
    writeDir(dir, 'apps/web/__tests__')
    // 无 .gitkeep → 命中 __* 规则 + 无标记 → block
    const r = runScript(dir)
    assert.equal(r.status, 1, `无 .gitkeep + 被 ignore 应 exit 1\nstdout: ${r.out}`)
    assert.match(r.out, /BLOCK/)
    assert.match(r.out, /__tests__/)
  } finally {
    rmScratch(dir)
  }
})

test('__tests__/ 无 .gitkeep 但未被 gitignore → 通过(exit 0,未命中 ignore 规则)', () => {
  // .gitignore 不含 __* 规则 → __tests__/ 不会被吞掉 → 通过
  const dir = createTempGitRepo('node_modules/\n')
  try {
    writeDir(dir, 'apps/web/__tests__')
    const r = runScript(dir)
    assert.equal(r.status, 0, `未被 ignore 应通过\nstdout: ${r.out}`)
    assert.match(r.out, /未命中 ignore 规则/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 3. 合法测试目录命名 → 通过 ──────────────────────────

test('tests/ 目录(推荐命名)→ 通过(exit 0,不触发 __tests__ 检测)', () => {
  const dir = createTempGitRepo('__*\n')
  try {
    writeDir(dir, 'apps/web/tests')
    const r = runScript(dir)
    assert.equal(r.status, 0, `tests/ 应通过\nstdout: ${r.out}`)
    assert.match(r.out, /未发现 __tests__\/ 目录/)
  } finally {
    rmScratch(dir)
  }
})

test('spec/ 目录 → 通过(exit 0)', () => {
  const dir = createTempGitRepo('')
  try {
    writeDir(dir, 'apps/api/spec')
    const r = runScript(dir)
    assert.equal(r.status, 0, `spec/ 应通过\nstdout: ${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 4. 临时/备份目录检测(*.tmp / *.bak) ────────────────

test('*.tmp 目录 → 默认 warn exit 0, --strict exit 1', () => {
  const dir = createTempGitRepo('')
  try {
    writeDir(dir, 'apps/web/cache.tmp')
    const rDefault = runScript(dir)
    assert.equal(rDefault.status, 0, `默认 warn-only 应 exit 0\nstdout: ${rDefault.out}`)
    assert.match(rDefault.out, /WARN/)
    const rStrict = runScript(dir, ['--strict'])
    assert.equal(rStrict.status, 1, `--strict 模式应 exit 1\nstdout: ${rStrict.out}`)
    assert.match(rStrict.out, /--strict/)
  } finally {
    rmScratch(dir)
  }
})

test('*.bak 目录 → 默认 warn exit 0, --strict exit 1', () => {
  const dir = createTempGitRepo('')
  try {
    writeDir(dir, 'packages/backup.bak')
    const rDefault = runScript(dir)
    assert.equal(rDefault.status, 0)
    assert.match(rDefault.out, /WARN/)
    const rStrict = runScript(dir, ['--strict'])
    assert.equal(rStrict.status, 1)
  } finally {
    rmScratch(dir)
  }
})

// ─── 5. 隐藏目录白名单检测 ───────────────────────────────

test('非白名单隐藏目录(.unknown/) → 默认 warn exit 0, --strict exit 1', () => {
  // .cache 在 EXCLUDE_DIRS 中会被跳过,用 .unknown 触发 findUnknownDotDirs
  const dir = createTempGitRepo('')
  try {
    writeDir(dir, 'apps/web/.unknown')
    const rDefault = runScript(dir)
    assert.equal(rDefault.status, 0, `默认 warn 应 exit 0\nstdout: ${rDefault.out}`)
    assert.match(rDefault.out, /WARN/)
    const rStrict = runScript(dir, ['--strict'])
    assert.equal(rStrict.status, 1)
  } finally {
    rmScratch(dir)
  }
})

// ─── 6. git check-ignore 调用正确性 ──────────────────────

test('git check-ignore 调用:被 ignore 的 __tests__/ 会被检测到并报告 git rule', () => {
  // 端到端验证:__tests__/ 被 __* 规则命中 → stdout 应含 git rule 来源信息
  const dir = createTempGitRepo('__*\n')
  try {
    writeDir(dir, 'apps/web/__tests__')
    const r = runScript(dir)
    assert.equal(r.status, 1)
    // 源脚本输出 "git rule: <规则来源>"
    assert.match(r.out, /git rule|__\*/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 7. 批量扫描 ─────────────────────────────────────────

test('批量扫描: 多个 __tests__/ (block) + 多个 *.tmp (warn) → exit 1 + 计数正确', () => {
  const dir = createTempGitRepo('__*\n')
  try {
    // 2 个 __tests__/ 无 .gitkeep(被 ignore)→ 2 个 block
    writeDir(dir, 'apps/web/__tests__')
    writeDir(dir, 'apps/api/__tests__')
    // 1 个 __tests__/ 有 .gitkeep → 通过
    writeDir(dir, 'packages/__tests__')
    writeFile(dir, 'packages/__tests__/.gitkeep')
    // 2 个 *.tmp 目录 → 2 个 warn
    writeDir(dir, 'apps/web/cache.tmp')
    writeDir(dir, 'scripts/build.tmp')
    const r = runScript(dir)
    assert.equal(r.status, 1, `有 block 应 exit 1\nstdout: ${r.out}`)
    assert.match(r.out, /阻断项: 2/)
    assert.match(r.out, /警告项: 2/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 反忽略与文件级探查(2026-09-24 补,两条都是"旧判据必红"的负向对照) ───

test('反忽略到位(`!` 放开目录 + 放开内容)不得判成被忽略 —— 真仓 billing/__tests__ 假阳性对照', () => {
  // 旧实现只看 `git check-ignore -v` 输出是否非空,而 git 对否定规则同样打印命中行,
  // 于是"已被 `!` 反忽略"的目录会被判 BLOCK,卡死所有无关提交(真仓 billing/__tests__ 实测)。
  // git 不能重新包含"父目录已被排除"里的文件,所以完整反忽略要两条同时到位(见下一个用例)。
  const dir = createTempGitRepo('__*\n!__tests__/\n!**/__tests__/**\n')
  try {
    writeDir(dir, 'apps/web/__tests__')
    writeFile(dir, 'apps/web/__tests__/a.test.ts', 'export {}')
    const r = runScript(dir)
    assert.equal(r.status, 0, `反忽略到位后不应 block\nstdout: ${r.out}`)
    assert.match(r.out, /未命中 ignore 规则/)
  } finally {
    rmScratch(dir)
  }
})

test('半个反忽略(只放开内容、没放开目录)→ 仍必须 BLOCK', () => {
  // 只写 `!**/__tests__/**` 是无效反忽略:目录本身仍被 `__*` 排除,git add 实测报 ignored。
  // 此例钉住"加了个 ! 就安全了"的错觉,防止有人照它改 .gitignore 后测试永久丢失。
  const dir = createTempGitRepo('__*\n!**/__tests__/**\n')
  try {
    writeDir(dir, 'apps/web/__tests__')
    writeFile(dir, 'apps/web/__tests__/a.test.ts', 'export {}')
    const r = runScript(dir)
    assert.equal(r.status, 1, `父目录仍被排除时应 block\nstdout: ${r.out}`)
    assert.match(r.out, /BLOCK/)
  } finally {
    rmScratch(dir)
  }
})

test('目录未命中但里面的 .spec.ts 被规则吞掉 → 必须 BLOCK 并点名该文件', () => {
  // 只查目录本身会漏这一类:`**/__tests__/*.spec.ts` 对目录路径不成立、对文件成立。
  const dir = createTempGitRepo('**/__tests__/*.spec.ts\n')
  try {
    writeDir(dir, 'apps/web/__tests__')
    writeFile(dir, 'apps/web/__tests__/a.spec.ts', 'export {}')
    const r = runScript(dir)
    assert.equal(r.status, 1, `文件级被吞应 exit 1\nstdout: ${r.out}`)
    assert.match(r.out, /BLOCK/)
    assert.match(r.out, /a\.spec\.ts/, '必须点名到具体不会被跟踪的文件')
  } finally {
    rmScratch(dir)
  }
})

test('parseCheckIgnoreLine:否定规则 / 普通规则 / 空输出 / 含盘符冒号的来源', async () => {
  const { parseCheckIgnoreLine } = await import('../check-test-paths.mjs')
  assert.deepEqual(
    parseCheckIgnoreLine('.gitignore:245:!**/__tests__/**\tapps/web/src/x/__tests__/'),
    { ignored: false, rule: '.gitignore:245:!**/__tests__/**' },
  )
  assert.equal(parseCheckIgnoreLine('.gitignore:154:__*\tapps/web/__tests__/').ignored, true)
  assert.equal(parseCheckIgnoreLine('').ignored, false)
  // Windows 全局忽略文件来源形如 C:\Users\...\.gitignore_global:3:foo —— 取最后一个冒号段
  assert.equal(
    parseCheckIgnoreLine('C:\\Users\\me\\.gitignore_global:3:__tests__\tapps/x/__tests__/').ignored,
    true,
  )
  assert.equal(
    parseCheckIgnoreLine('C:\\Users\\me\\.gitignore_global:3:!__tests__\tapps/x/__tests__/')
      .ignored,
    false,
  )
})

// ════════════════════════════════════════════════════════════════════════════
// S 族:归属分流(2026-09-27 立,G-268 同型)
//
// 立项缺陷:本门三条发现全部来自磁盘递归,而提交链带 pathspec —— 别人留在共享工作树的
// 未跟踪目录会让 `--staged` 判红,基线面(干净检出,物理上没有未跟踪文件)判绿,归因层据
// 差分就喊"这枚提交把跑绿的东西改红了",唯一"修法"是删别人的目录(§12 明令的事故)。
// 实测(2026-09-27,本文件 F 型夹具):旧版 `--staged` exit 1 / 全量档 exit 1(后者本应如此)。
//
// 每条 S 都配正例 + 反例;S9/S11 是"这次修复**不得**做的事"那一类。
// ════════════════════════════════════════════════════════════════════════════

/** F 型夹具:`__tests__` 只在盘上(索引 / HEAD 零在册),正是"别人的在飞文件" */
function mkForeignFixture() {
  const dir = createTempGitRepo('__*\n')
  writeFile(dir, 'apps/web/__tests__/a.test.ts', 'export {}\n')
  writeFile(dir, 'apps/web/package.json', '{}\n')
  commitAll(dir, '.gitignore', 'apps/web/package.json')
  return dir
}

/** G 型夹具:目录内既有被 `add -f` 的在册文件,又有被吞掉的未跟踪文件 ⇒ 在册,严重度不变 */
function mkOwnedByIndexFixture() {
  const dir = createTempGitRepo('__*\n')
  writeFile(dir, 'apps/api/__tests__/sub/keep.txt', 'k\n')
  writeFile(dir, 'apps/api/__tests__/a.test.ts', 'export {}\n')
  writeFile(dir, 'apps/web/package.json', '{}\n')
  commitAll(dir, '.gitignore', 'apps/api/__tests__/sub/keep.txt', 'apps/web/package.json')
  return dir
}

test('S1 §15 锁:ROOT 由脚本自身位置推导,与 process.cwd() 无关(只看打印行,不依赖真仓结论)', () => {
  const other = mkScratch('ihui-test-paths-cwd-')
  try {
    // 刻意**不带** --root 从别处 spawn:打印的扫描根必须是仓库根。
    // 只断言这一行,不断言退出码 —— 真仓的盘上现场属并行会话,拿它做结论会让本例随人抖动。
    const raw = spawnSync(process.execPath, [SCRIPT_PATH], {
      cwd: other,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 120000,
    })
    const out = strip(raw.stdout)
    assert.match(out, new RegExp(`扫描根: ${REPO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), out)
    assert.ok(!out.includes(other), 'ROOT 不得跟着 cwd 走 —— 那会把"没扫到"写成"扫过且合规"')
    assert.equal(GATE85.ROOT, REPO, '__test__ 暴露的 ROOT 必须与之一致')
  } finally {
    rmScratch(other)
  }
})

test('S2 纯判据 normRelPath / splitNulPaths / isOnRecord(正反两向)', () => {
  const { normRelPath, splitNulPaths, isOnRecord } = GATE85
  assert.equal(normRelPath(' apps\\web\\__tests__\\ '), 'apps/web/__tests__')
  assert.equal(normRelPath(''), '')
  assert.deepEqual(splitNulPaths('a/b\0c\\d\0\0'), ['a/b', 'c/d'])
  assert.deepEqual(splitNulPaths(null), [])
  const rec = ['apps/web/__tests__/sub/keep.txt', 'apps/web/package.json']
  assert.equal(isOnRecord('apps/web/__tests__', rec), true, '目录靠子项判在册')
  assert.equal(isOnRecord('apps\\web\\__tests__', rec), true, '反斜杠形态必须先归一')
  assert.equal(isOnRecord('apps/web/__tests__/', rec), true, '尾斜杠不得影响判定')
  assert.equal(isOnRecord('apps/web/__testsx', rec), false, '近似名不得算在册')
  assert.equal(isOnRecord('apps/api/__tests__', rec), false, '不在清单里就是不在')
  assert.equal(isOnRecord('', rec), false, '空前缀不得把整份清单吞成"在册"')
  assert.equal(isOnRecord('apps/web', null), false)
})

test('S3 纯判据 ownershipOf:在册 / 未在册 / fail-tight 三支各自可分', () => {
  const { ownershipOf } = GATE85
  const set = (a) => new Set(a)
  const idx = set(['apps/web/__tests__/sub/keep.txt'])
  const head = set(['apps/api/__tests__/a.test.ts'])
  assert.equal(ownershipOf('apps/web/__tests__', { index: idx, head: set([]), why: [] }), 'owned')
  assert.equal(ownershipOf('apps/api/__tests__', { index: set([]), head, why: [] }), 'owned')
  assert.equal(ownershipOf('apps/somewhere/__tests__', { index: idx, head, why: [] }), 'foreign')
  // fail-tight 三支:任何一支取不到都不得降档(否则"没取证"会被读成"都是别人的")
  assert.equal(
    ownershipOf('apps/somewhere/__tests__', null),
    'owned',
    '全量档 face=null ⇒ 恒 owned',
  )
  assert.equal(ownershipOf('apps/somewhere/__tests__', { index: null, head, why: ['x'] }), 'owned')
  assert.equal(
    ownershipOf('apps/somewhere/__tests__', { index: idx, head: null, why: ['x'] }),
    'owned',
  )
})

test('S4 纯判据 decideStagedExit:自己的红优先于未判定,只剩未判定给 2 而不是 0', () => {
  const { decideStagedExit: d } = GATE85
  assert.equal(d({ ownedBlock: 1, foreignBlock: 3 }), 1, '本枚在册的红不得被未判定洗掉')
  assert.equal(d({ ownedBlock: 0, foreignBlock: 1 }), 2, '只剩未判定 ⇒ 非零,但不是本枚的红')
  assert.equal(d({}), 0, '一条发现都没有 ⇒ 合规,不得借"未判定"制造噪声')
  assert.equal(d({ foreignWarn: 1 }), 0, '警告档未判定在默认档下仍不拦(与修复前同)')
  assert.equal(d({ foreignWarn: 1, strict: true }), 2, '--strict 下警告档升格,未判定同步升格')
  assert.equal(
    d({ ownedWarn: 1, foreignBlock: 1, strict: true }),
    1,
    'strict 下自己的警告优先于未判定',
  )
  assert.equal(d({ ownedWarn: 1, strict: true }), 1)
})

test('S5 F 型端到端(立项缺陷本身):未跟踪目录 ⇒ --staged 点名 + 未判定 1 处 + exit 2,全量档仍 exit 1', () => {
  const dir = mkForeignFixture()
  try {
    const full = runScript(dir)
    assert.equal(full.status, 1, '全量档是本门的问责面,一行都不许松')
    assert.match(full.out, /BLOCK/)
    const s = runScript(dir, ['--staged'])
    assert.equal(s.status, 2, `不在本枚提交面的发现不得判本枚红,也不得记绿:\n${s.out}${s.err}`)
    assert.match(s.out, /未判定: 1 处/)
    assert.match(s.out, /\[未判定·不计本枚提交\]/)
    assert.match(s.out, /❓ 未判定 1 处/)
    assert.match(s.out, /apps[\\/]web[\\/]__tests__/, '必须逐条点名(找不到物主就没法清账)')
    assert.match(s.out, /这不是"通过"/, 'exit 2 的措辞不得读起来像过门')
    assert.ok(!/❌ 发现 \d+ 个阻断项/.test(s.out), '未判定档不得同时被算进本枚的阻断计数')
  } finally {
    rmScratch(dir)
  }
})

test('S6 G 型(在册):目录内有被 add -f 的条目 ⇒ --staged 仍按原级判红,不记未判定', () => {
  const dir = mkOwnedByIndexFixture()
  try {
    const s = runScript(dir, ['--staged'])
    assert.equal(s.status, 1, '在册(索引里有该目录下条目)⇒ 严重度一字不改')
    assert.match(s.out, /BLOCK/)
    assert.match(s.out, /阻断项: 1/)
    assert.match(s.out, /未判定: 0 处/)
    assert.match(s.out, /判定面: 归属分流/, '必须自报判定面,否则读的人分不清"没发现"与"发现了不计"')
  } finally {
    rmScratch(dir)
  }
})

test('S7 HEAD 在册(索引里没有)同样按在册:证明 HEAD 那一档不是装饰', () => {
  const dir = mkOwnedByIndexFixture()
  try {
    gitAt(dir, ['rm', '--cached', '-q', '--', 'apps/api/__tests__/sub/keep.txt'])
    const s = runScript(dir, ['--staged'])
    assert.equal(s.status, 1, '只在 HEAD 在册(本次是删除型提交)仍属既有面,不得降成未判定')
    assert.match(s.out, /阻断项: 1/)
    assert.match(s.out, /未判定: 0 处/)
  } finally {
    rmScratch(dir)
  }
})

test('S8 fail-tight 端到端:归属面问不到 ⇒ 全部按本枚判红并显式说明,绝不退成 0 或 2', () => {
  // 刻意用"git init 但一次都没提交"的仓:索引面可读(空集),HEAD 面读不到 ⇒
  // 正是"某侧清单取不到"的真实形态。若把它读成"目录不在册 ⇒ 未判定",就是拿取证失败
  // 换一次放行 —— 本仓最贵的那一型。
  const dir = createTempGitRepo('__*\n')
  try {
    writeDir(dir, 'apps/web/__tests__')
    const s = runScript(dir, ['--staged'])
    assert.equal(s.status, 1, `取不到归属面时按修复前行为判红,实得 ${s.status}:\n${s.out}${s.err}`)
    assert.match(s.out, /归属面取证失败/)
    assert.match(s.out, /HEAD 面取不到/)
    assert.match(s.out, /fail-tight/)
    assert.match(s.out, /未判定: 0 处/, '取不到 ⇒ 一条都不许记成"未判定"(那是把没判写成已判)')
    assert.match(s.out, /BLOCK/)
  } finally {
    rmScratch(dir)
  }
})

test('S9 反向锁:全量档逐字不变 —— 不得出现任何归属/判定面字样', () => {
  const dirty = mkForeignFixture()
  const clean = createTempGitRepo('')
  try {
    const full = runScript(dirty)
    for (const banned of ['判定面:', '未判定', '归属分流', '不计本枚提交', 'fail-tight'])
      assert.ok(!full.out.includes(banned), `全量档出现了 ${banned} ⇒ 问责面被顺手改了`)
    assert.match(full.out, /阻断项: 1/)
    const c = runScript(clean)
    assert.equal(c.status, 0)
    assert.match(c.out, /✅ 所有测试路径与目录均合规/)
    assert.ok(!c.out.includes('未判定'), '合规时也不得凭空报未判定')
  } finally {
    rmScratch(dirty)
    rmScratch(clean)
  }
})

test('S10 警告档未判定:--staged 默认仍 0,--strict 升成 2(而全量档 --strict 仍 1)', () => {
  const dir = createTempGitRepo('')
  try {
    writeFile(dir, 'apps/web/package.json', '{}\n')
    commitAll(dir, 'apps/web/package.json') // 先让 HEAD 可读,再留一枚"别人的"临时目录
    writeDir(dir, 'apps/web/cache.tmp')
    assert.equal(runScript(dir, ['--strict']).status, 1, '全量档 --strict 的严重度不得变')
    assert.equal(runScript(dir, ['--staged']).status, 0, '警告档未判定在默认档下不改变退出码')
    const st = runScript(dir, ['--staged', '--strict'])
    assert.equal(st.status, 2, `--strict 下未判定不得被当成"过门":\n${st.out}${st.err}`)
    assert.match(st.out, /未判定: 1 处/)
  } finally {
    rmScratch(dir)
  }
})

test('S11 反向锁:在册红 + 未判定同时存在时按在册判红,且一条发现都不许消失', () => {
  const dir = mkOwnedByIndexFixture()
  try {
    writeFile(dir, 'apps/web/__tests__/b.test.ts', 'export {}\n')
    const s = runScript(dir, ['--staged'])
    assert.equal(s.status, 1, '本枚面上确有红 ⇒ 整体必须判红')
    assert.match(s.out, /阻断项: 1/)
    assert.match(s.out, /未判定: 1 处/)
    assert.match(s.out, /apps[\\/]web[\\/]__tests__/, '未判定那条也要点名')
    assert.match(s.out, /apps[\\/]api[\\/]__tests__/, '在册那条也要点名')
    assert.match(s.out, /盘上另有|要把它判红/, '必须给出问责面出口(全量档),不得只留一个计数')
  } finally {
    rmScratch(dir)
  }
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
