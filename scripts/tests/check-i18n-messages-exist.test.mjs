// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:夹具按被测脚本导出的**同一份布局**生成,测试内不写死任何存量语言包路径。
// (教训:"棘轮守门的自测夹具别写死存量路径" —— 同一张票里删条目会让自测变红,看起来像改坏了守门。)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as gate } from '../check-i18n-messages-exist.mjs'

const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(SELF_DIR, '..', '..')
const SCRIPT = join(REPO, 'scripts', 'check-i18n-messages-exist.mjs')
// AGENTS.md §15:临时夹具一律项目内(.ihui-agent/tmp/ 已 gitignore),不落 os.tmpdir()
const FIXTURE_BASE = join(REPO, '.ihui-agent', 'tmp', 'i18n-messages-exist')

// ─── 夹具:全部路径取自 gate(ENDPOINTS / LOCALES / LOADER_TARGETS),零硬编码 ───
const localeRel = (endpoint, locale) => join(endpoint.dir, endpoint.filePattern(locale))
const loaderContent = (target) => {
  const pad = 'a'.repeat(Math.max(0, (target.minBytes || 0) + 128))
  return `export const messages: Record<string, string> = { pad: '${pad}' }\n`
}

function makeFixtureRoot() {
  mkdirSync(FIXTURE_BASE, { recursive: true })
  return mkdtempSync(join(FIXTURE_BASE, 'case-'))
}

/** 写出一份"全合法"的项目根:每项配置都落到文件上 */
function writeValidProject(root) {
  for (const endpoint of gate.ENDPOINTS) {
    const dir = join(root, endpoint.dir)
    mkdirSync(dir, { recursive: true })
    for (const locale of gate.LOCALES) {
      writeFileSync(join(root, localeRel(endpoint, locale)), JSON.stringify({ [locale]: { greeting: 'hi' } }))
    }
  }
  for (const target of gate.LOADER_TARGETS) {
    const file = join(root, target.file)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, loaderContent(target))
  }
  return root
}

function runScript(args, opts = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    cwd: opts.cwd ?? REPO,
    windowsHide: true,
    timeout: 60000,
    env: { ...process.env, ...opts.env },
  })
}

const SOURCE = readFileSync(SCRIPT, 'utf8')
// 只看代码行:注释里合法地记着历史写法(如"原实现 const ROOT = process.cwd()")
const CODE_ONLY = SOURCE.split('\n')
  .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
  .join('\n')
// git 输出的路径分隔符恒为 `/`(与 path.join 在 Windows 上的 `\` 不同),
// 喂给 collectStagedEndpoints 的样例必须按 git 形态构造。
const gitRel = (endpoint, locale) => `${endpoint.dir}/${endpoint.filePattern(locale)}`
const pickEndpoint = (i) => gate.ENDPOINTS[i % gate.ENDPOINTS.length]
const pickLocale = (i) => gate.LOCALES[i % gate.LOCALES.length]
const minByteLoader = gate.LOADER_TARGETS.find((t) => t.minBytes)

// ─── 1. 尺子先自证:根目录解析优先级 CLI > env > 仓库根 ─────────
test('resolveRoot: --root > I18N_MESSAGES_EXIST_ROOT > 仓库根', () => {
  assert.equal(gate.resolveRoot(['node', SCRIPT], {}), gate.REPO_ROOT, '默认必须是仓库根')
  assert.equal(
    gate.resolveRoot(['node', SCRIPT], { [gate.ROOT_ENV_KEY]: join(REPO, 'packages') }),
    join(REPO, 'packages'),
    'env 兜底应生效',
  )
  assert.equal(
    gate.resolveRoot(['node', SCRIPT, '--root', join(REPO, 'apps')], { [gate.ROOT_ENV_KEY]: join(REPO, 'packages') }),
    join(REPO, 'apps'),
    'CLI 必须压过 env',
  )
  // --root 后紧跟另一个 flag 时不得把 flag 当路径吃掉
  assert.equal(gate.resolveRoot(['node', SCRIPT, '--root', '--staged'], {}), gate.REPO_ROOT)
  // 等号形态 `--root=<dir>` 必须同样生效:早期只认空格形态,于是
  // `--root=<不存在的目录>` 被静默忽略 → 扫真仓 → 假绿 exit 0(2026-09-24 实测)
  assert.equal(
    gate.resolveRoot(['node', SCRIPT, `--root=${join(REPO, 'apps')}`], {}),
    join(REPO, 'apps'),
    '等号形态必须压过默认根',
  )
  assert.equal(
    gate.resolveRoot(['node', SCRIPT, `--root=${join(REPO, 'apps')}`], {
      [gate.ROOT_ENV_KEY]: join(REPO, 'packages'),
    }),
    join(REPO, 'apps'),
    '等号形态同样压过 env',
  )
  // `--root=` 空值:必须抛错(由入口统一转成 exit 2),不得回落到默认根
  assert.throws(() => gate.resolveRoot(['node', SCRIPT, '--root='], {}), /缺少目录值/)
})

test('检查清单非空(空清单即"0 项恒绿"的入口)', () => {
  assert.ok(gate.ENDPOINTS.length > 0 && gate.LOCALES.length > 0)
  assert.ok(gate.LOADER_TARGETS.length > 0)
  assert.equal(
    gate.EXPECTED_ITEM_COUNT,
    gate.ENDPOINTS.length * gate.LOCALES.length + gate.LOADER_TARGETS.length,
  )
  assert.ok(gate.EXPECTED_ITEM_COUNT > 0)
  // 守卫装车证明:源码里必须真的存在"清单为空即 exit 2"的分支
  assert.match(CODE_ONLY, /EXPECTED_ITEM_COUNT === 0[\s\S]{0,300}return 2/)
  // 根因不得复活:ROOT 不允许再取 process.cwd()(注释里的历史说明不算)
  assert.doesNotMatch(CODE_ONLY, /const\s+ROOT\s*=\s*process\.cwd\(\)/)
  assert.doesNotMatch(CODE_ONLY, /resolveRoot\([^)]*process\.cwd/)
  // AGENTS.md §5b:派生子进程必须 windowsHide + 有界超时(漏了会弹控制台窗口 / 无界挂起)
  assert.match(CODE_ONLY, /execFileSync\([\s\S]{0,200}windowsHide:\s*true[\s\S]{0,80}timeout:/)
  assert.doesNotMatch(CODE_ONLY, /\bexecSync\(/)
})

// ─── 2. 正例:全部合法 → exit 0 ────────────────────────────────
test('正例: 夹具全合法 → exit 0 且报告核对到每一项', () => {
  const root = makeFixtureRoot()
  try {
    writeValidProject(root)
    const r = runScript(['--root', root])
    assert.equal(r.status, 0, `全合法应 exit 0,实际 ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`)
    assert.match(r.stdout, /通过/)
    assert.ok(r.stdout.includes(String(gate.EXPECTED_ITEM_COUNT)), `结论行应核对 ${gate.EXPECTED_ITEM_COUNT} 项`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 3. 反例 A:缺一个语言包文件 → exit 1 且点名该路径 ─────────
test('反例A: 缺单个语言包文件 → exit 1 + 点名相对路径(file-missing)', () => {
  const root = makeFixtureRoot()
  try {
    writeValidProject(root)
    const endpoint = pickEndpoint(0)
    const rel = localeRel(endpoint, pickLocale(1))
    rmSync(join(root, rel))
    const r = runScript(['--root', root])
    assert.equal(r.status, 1, `缺 ${rel} 应 exit 1,实际 ${r.status}\nstdout:${r.stdout}`)
    assert.ok(r.stderr.includes(rel), `输出须点名 ${rel},实际:${r.stderr}`)
    assert.match(r.stderr, /file-missing/)
    assert.ok(r.stderr.includes(endpoint.name), '须点名所属端')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4. 反例 B:整个端目录缺失 → exit 1 且点名目录 ─────────────
test('反例B: 整端目录缺失 → exit 1 + 点名目录(directory-missing)', () => {
  const root = makeFixtureRoot()
  try {
    writeValidProject(root)
    const endpoint = pickEndpoint(1)
    rmSync(join(root, endpoint.dir), { recursive: true, force: true })
    const r = runScript(['--root', root])
    assert.equal(r.status, 1, `缺 ${endpoint.dir} 应 exit 1,实际 ${r.status}`)
    assert.ok(r.stderr.includes(endpoint.dir), `输出须点名 ${endpoint.dir}`)
    assert.match(r.stderr, /directory-missing/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 5. 反例 C:JSON 解析失败 → 独立判 exit 1 ──────────────────
test('反例C: 语言包 JSON 语法错 → exit 1 + 点名路径(json-parse-error)', () => {
  const root = makeFixtureRoot()
  try {
    writeValidProject(root)
    const endpoint = pickEndpoint(2)
    const rel = localeRel(endpoint, pickLocale(0))
    writeFileSync(join(root, rel), '{ "broken": ')
    const r = runScript(['--root', root])
    assert.equal(r.status, 1, `坏 JSON 应 exit 1,实际 ${r.status}\nstdout:${r.stdout}`)
    assert.ok(r.stderr.includes(rel), `输出须点名 ${rel}`)
    assert.match(r.stderr, /json-parse-error/)
    // 必须是"解析错误"这一类,不能与缺文件混为一类
    assert.doesNotMatch(r.stderr, /缺失文件\/目录\(1个\)/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 6. 反例 D:合法 JSON 但空对象 → 仍判 exit 1(不是 warn) ───
test('反例D: 语言包为空对象 → exit 1(no-top-level-keys,文案不得称"警告")', () => {
  const root = makeFixtureRoot()
  try {
    writeValidProject(root)
    const endpoint = pickEndpoint(3)
    const rel = localeRel(endpoint, pickLocale(2))
    writeFileSync(join(root, rel), '{}')
    const r = runScript(['--root', root])
    assert.equal(r.status, 1, `空对象应 exit 1,实际 ${r.status}\nstdout:${r.stdout}`)
    assert.ok(r.stderr.includes(rel), `输出须点名 ${rel}`)
    assert.match(r.stderr, /no-top-level-keys/)
    // 退出码与文案必须一致:计入失败就不许写"警告"
    assert.match(r.stderr, /空内容.*判失败/)
    assert.doesNotMatch(r.stderr, /空文件警告/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 7. 反例 E:签入产物体积不足 → 独立判 exit 1 ───────────────
test('反例E: 产物低于体积下限 → exit 1 + 点名路径(too-small)', () => {
  assert.ok(minByteLoader, '夹具依赖 LOADER_TARGETS 至少一项声明了 minBytes')
  const root = makeFixtureRoot()
  try {
    writeValidProject(root)
    writeFileSync(
      join(root, minByteLoader.file),
      'export const remoteLocales = { zh: {} }\n',
    )
    const r = runScript(['--root', root])
    assert.equal(r.status, 1, `体积不足应 exit 1,实际 ${r.status}\nstdout:${r.stdout}`)
    assert.ok(r.stderr.includes(minByteLoader.file), `输出须点名 ${minByteLoader.file}`)
    assert.match(r.stderr, /too-small/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 8. 三类反例互不替代:同时命中时逐条点名 ───────────────────
test('批量: 三类问题同时存在 → 三处路径全部点名', () => {
  const root = makeFixtureRoot()
  try {
    writeValidProject(root)
    const missingEp = pickEndpoint(4)
    const missingRel = localeRel(missingEp, pickLocale(3))
    rmSync(join(root, missingRel))
    const parseEp = pickEndpoint(5)
    const parseRel = localeRel(parseEp, pickLocale(1))
    writeFileSync(join(root, parseRel), '[1,2,3]')
    const emptyEp = pickEndpoint(6)
    const emptyRel = localeRel(emptyEp, pickLocale(4))
    writeFileSync(join(root, emptyRel), '{}')
    const r = runScript(['--root', root])
    assert.equal(r.status, 1, `三类问题应 exit 1,实际 ${r.status}`)
    assert.ok(r.stderr.includes(missingRel), '缺文件路径未点名')
    assert.ok(r.stderr.includes(parseRel), '非对象 JSON 路径未点名')
    assert.ok(r.stderr.includes(emptyRel), '空对象路径未点名')
    assert.match(r.stderr, /发现 3 处问题/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 9. 空夹具:每一项都被点名,而不是只报总数 ─────────────────
test('空夹具: 全部配置项缺失 → exit 1 且逐项点名', () => {
  const root = makeFixtureRoot()
  try {
    const r = runScript(['--root', root])
    assert.equal(r.status, 1, '空夹具应 exit 1(绝不因"没东西可查"报绿)')
    for (const endpoint of gate.ENDPOINTS) {
      assert.ok(r.stderr.includes(endpoint.dir), `未点名 ${endpoint.dir}`)
    }
    for (const target of gate.LOADER_TARGETS) {
      assert.ok(r.stderr.includes(target.file), `未点名 ${target.file}`)
    }
    assert.match(r.stderr, /发现 \d+ 处问题/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 10. 注入通道自身的负路径:--root 不存在必须明确报错 ───────
test('--root 指向不存在的目录 → exit 2 明确报错(不静默 exit 0)', () => {
  const nope = join(FIXTURE_BASE, 'definitely-not-here-9x7')
  rmSync(nope, { recursive: true, force: true })
  // 两种形态都必须走到"根目录不存在"分支,而不是回落到真仓报绿
  for (const args of [['--root', nope], [`--root=${nope}`]]) {
    const r = runScript(args)
    assert.notEqual(r.status, 0, `${args[0]} 根目录不存在绝不能报绿,实际 exit ${r.status}`)
    assert.equal(r.status, 2, `${args[0]} 脚本自身判定不了应按 §22d 退 2,实际 ${r.status}`)
    assert.ok(r.stderr.includes(nope), `错误须点名该目录:${r.stderr}`)
    assert.match(r.stderr, /根目录不存在/)
  }
})

// ─── 10b. 等号形态确实在驱动扫描(而不是又被忽略) ─────────────
test('--root=<夹具> 等号形态注入生效(反例仍判红)', () => {
  const root = makeFixtureRoot()
  try {
    writeValidProject(root)
    const endpoint = pickEndpoint(2)
    const rel = localeRel(endpoint, pickLocale(4))
    rmSync(join(root, rel))
    const r = runScript([`--root=${root}`])
    assert.equal(r.status, 1, `等号形态下缺文件应 exit 1,实际 ${r.status}\nstdout:${r.stdout}`)
    assert.ok(r.stderr.includes(rel), `须点名 ${rel}:${r.stderr}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 11. --staged 不得在夹具下偷读外层真仓暂存区 ───────────────
test('--staged + --root 夹具 → exit 2 拒绝(暂存区数据与夹具无关)', () => {
  const root = makeFixtureRoot()
  try {
    writeValidProject(root)
    const r = runScript(['--staged', '--root', root])
    assert.equal(r.status, 2, `应拒绝该组合,实际 ${r.status}\nstdout:${r.stdout}`)
    assert.match(r.stderr, /--staged 必须作用于仓库根/)
    // 等号形态同样不得被忽略(忽略 = 拿真仓暂存区冒充夹具结论)
    const r2 = runScript(['--staged', `--root=${root}`])
    assert.equal(r2.status, 2, `等号形态也应拒绝,实际 ${r2.status}\nstdout:${r2.stdout}`)
    assert.match(r2.stderr, /--staged 必须作用于仓库根/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 12. 默认行为未变:cwd 不再左右扫描根 ──────────────────────
test('默认: 不带 --root 时扫仓库根(即便 cwd 是空目录)', () => {
  const emptyDir = makeFixtureRoot()
  try {
    // 旧实现 ROOT = process.cwd(),此处会报 40 项全缺 → exit 1
    const r = runScript([], { cwd: emptyDir })
    assert.equal(r.status, 0, `默认应扫仓库根并判合法,实际 ${r.status}\nstderr:${r.stderr}`)
    assert.ok(r.stdout.includes(gate.REPO_ROOT), `结论行应回显仓库根 ${gate.REPO_ROOT}:${r.stdout}`)
  } finally {
    rmSync(emptyDir, { recursive: true, force: true })
  }
})

// ─── 13. 真仓全量(注入仓库根)与默认同结论 ────────────────────
test('真仓: --root=<仓库根> 与默认同结论 exit 0', () => {
  const r = runScript(['--root', gate.REPO_ROOT])
  assert.equal(r.status, 0, `真仓应全绿,实际 ${r.status}\nstderr:${r.stderr}`)
  assert.ok(r.stdout.includes(String(gate.EXPECTED_ITEM_COUNT)))
})

// ─── 14. staged 收窄判据(纯函数,不碰 git) ───────────────────
test('collectStagedEndpoints: 只认 <端目录>/ 前缀', () => {
  const files = [
    gitRel(gate.ENDPOINTS[0], gate.LOCALES[0]),
    'apps/web/src/app/page.tsx',
    `${gate.MSG_ROOT}/not-an-endpoint/zh-CN.json`,
    // 前缀相同但不是该端子目录的名字,不得被认作命中
    `${gate.MSG_ROOT}/${gate.ENDPOINTS[0].name}-backup/zh-CN.json`,
  ]
  const hit = gate.collectStagedEndpoints(files, gate.ENDPOINTS)
  assert.equal(hit.size, 1, `只应命中一个端,实际 ${[...hit].join(',')}`)
  assert.ok(hit.has(gate.ENDPOINTS[0].name))
})

// ─── 15. 布局表自证(2026-09-24 补回被重写吞掉的一条显式覆盖) ───────────
// 夹具是**按脚本自带的表生成**的 ⇒ 表本身写错时夹具与判据自洽,测试恒绿。旧版有一条
// "miniapp-taro 的 loader 在 src/i18n/ 而不是 src/i18n/messages/" 的字面量用例钉住这点,
// 重写时并入了"按表生成",覆盖就丢了。下面两条用**手写字面量 + git 版本树真值**补回来,
// 二者都不读脚本的表,所以表漂移必红。
const EXPECTED_PACK_DIRS = [
  'packages/i18n/messages/shared',
  'packages/i18n/messages/web',
  'packages/i18n/messages/miniapp-taro',
  'packages/i18n/messages/mobile-rn',
  'packages/i18n/messages/cli',
  'packages/i18n/messages/extension',
  'packages/i18n/messages/api',
]
const EXPECTED_LOADERS = [
  'apps/miniapp-taro/src/i18n/index.tsx',
  'apps/mobile-rn/src/i18n/index.tsx',
  'apps/extension/src/i18n/index.tsx',
  'apps/cli/src/i18n/index.ts',
  'apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts',
]
const EXPECTED_LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']
const GIT_BIN = process.env.IHUI_GIT_BIN || 'git'

test('脚本的布局表与手写字面量逐字相等(表漂移即红)', () => {
  assert.deepEqual(
    gate.ENDPOINTS.map((e) => e.dir).sort(),
    [...EXPECTED_PACK_DIRS].sort(),
  )
  const loaders = gate.LOADER_TARGETS.map((t) => (typeof t === 'string' ? t : t.file))
  assert.deepEqual(loaders.sort(), [...EXPECTED_LOADERS].sort())
  assert.deepEqual([...gate.LOCALES].sort(), [...EXPECTED_LOCALES].sort())
})

test('手写字面量在 git 版本树里真实存在(独立真值,不读脚本表)', () => {
  const r = spawnSync(GIT_BIN, ['-c', 'safe.directory=*', 'ls-tree', '-r', '--name-only', 'HEAD'], {
    cwd: REPO,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    maxBuffer: 64 * 1024 * 1024,
  })
  assert.equal(r.status, 0, `git ls-tree 失败: ${r.stderr}`)
  const tracked = new Set(r.stdout.split('\n').filter(Boolean))
  for (const dir of EXPECTED_PACK_DIRS) {
    for (const loc of EXPECTED_LOCALES) {
      assert.ok(tracked.has(`${dir}/${loc}.json`), `语言包未入库: ${dir}/${loc}.json`)
    }
  }
  for (const f of EXPECTED_LOADERS) {
    assert.ok(tracked.has(f), `端内 loader/产物未入库: ${f}`)
  }
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
