// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @file install-git-hooks.test.mjs 判据单测
 * @description 钉住 scripts/install-git-hooks.mjs 的三态(0 = 已装且钩子齐全;1 = 未装;
 *   2 = 未判定)。安装器以 `dirname(fileURLToPath(import.meta.url))` 的上层为 ROOT、**不看 cwd**,
 *   所以每个用例都把安装器复制到 `<临时仓库>/scripts/` 再跑,绝不触碰真实仓库的 git 配置。
 *   - 非 git 目录 ⇒ exit 2(钩子齐不齐都不报绿)
 *   - 临时仓库未装 + 7 枚钩子齐全 ⇒ `--check` exit 1 且点名 core.hooksPath
 *   - 安装 ⇒ exit 0、core.hooksPath 落成 `.husky`、`--check` 转绿、重复安装幂等
 *   - 缺一枚钩子 ⇒ exit 2、点名缺失项,且拒绝写入 core.hooksPath
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

const INSTALLER_SRC = resolve(import.meta.dirname, '..', 'install-git-hooks.mjs')
const REQUIRED_HOOKS = [
  'pre-commit',
  'commit-msg',
  'pre-push',
  'post-commit',
  'post-merge',
  'post-checkout',
  'pre-rebase',
]

/** 剥掉会把 git 指向别处的环境变量,保证临时仓库自成一界 */
function isolatedEnv() {
  const env = { ...process.env }
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[key]
  return env
}

const ENV = isolatedEnv()

function runGit(cwd, args) {
  // 门 193:派生 git 必须显式接管 stdio,不写在本机并发下有 EBUSY 病灶(0/30 成功)
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    env: ENV,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** 每个用例独占一个 mkdtemp 目录,并在用例结束时递归清理 */
function makeTempRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'ihui-install-hooks-'))
  t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }))
  mkdirSync(join(root, 'scripts'), { recursive: true })
  copyFileSync(INSTALLER_SRC, join(root, 'scripts', 'install-git-hooks.mjs'))
  return root
}

function createHooks(root, hooks = REQUIRED_HOOKS) {
  mkdirSync(join(root, '.husky'), { recursive: true })
  for (const name of hooks) writeFileSync(join(root, '.husky', name), '')
}

/** 初始化临时仓库,并把本地 core.hooksPath 显式置空(挡住全局配置干扰) */
function initRepo(root) {
  const init = runGit(root, ['init'])
  assert.equal(init.status, 0, `git init 失败: ${init.stderr}`)
  const cfg = runGit(root, ['config', 'core.hooksPath', ''])
  assert.equal(cfg.status, 0, `置空 core.hooksPath 失败: ${cfg.stderr}`)
  assert.equal(readHooksPath(root), '', '前置条件:本地 core.hooksPath 应为空')
}

function readHooksPath(root) {
  const r = runGit(root, ['config', '--get', 'core.hooksPath'])
  return r.status === 0 ? r.stdout.trim() : ''
}

function runInstaller(root, args = []) {
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'install-git-hooks.mjs'), ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    env: ENV,
  })
  assert.equal(r.error, undefined, `安装器启动失败: ${r.error}`)
  return r
}

test('非 git 目录 ⇒ exit 2(钩子齐全也不得报绿)', (t) => {
  const root = makeTempRoot(t)
  createHooks(root)

  const probe = runGit(root, ['rev-parse', '--is-inside-work-tree'])
  assert.notEqual(probe.status, 0, '前置条件:临时目录不得落在任何 git 工作树内')

  const r = runInstaller(root, ['--check'])
  assert.equal(r.status, 2, `应未判定,实际 stdout=${r.stdout} stderr=${r.stderr}`)
  assert.match(r.stderr, /git/, 'stderr 应说明不是 git 工作树')
})

test('临时仓库未安装 + 钩子齐全 ⇒ --check exit 1 且点名 core.hooksPath', (t) => {
  const root = makeTempRoot(t)
  initRepo(root)
  createHooks(root)

  const r = runInstaller(root, ['--check'])
  assert.equal(r.status, 1, `未安装应 exit 1,实际 stderr=${r.stderr}`)
  assert.match(r.stderr, /core\.hooksPath/)
  assert.equal(readHooksPath(root), '', '--check 只对账,不得改写配置')
})

test('安装 ⇒ exit 0、core.hooksPath=.husky、--check 转绿、重复安装幂等', (t) => {
  const root = makeTempRoot(t)
  initRepo(root)
  createHooks(root)

  const first = runInstaller(root)
  assert.equal(first.status, 0, `安装应 exit 0,实际 stderr=${first.stderr}`)
  assert.equal(readHooksPath(root), '.husky')

  const check = runInstaller(root, ['--check'])
  assert.equal(check.status, 0, `已安装时 --check 应 exit 0,实际 stderr=${check.stderr}`)
  assert.equal(readHooksPath(root), '.husky')

  const second = runInstaller(root)
  assert.equal(second.status, 0, '重复安装应幂等 exit 0')
  assert.equal(readHooksPath(root), '.husky')

  const silent = runInstaller(root, ['--silent'])
  assert.equal(silent.status, 0, '--silent 不得改变退出码')
  assert.equal(silent.stdout.trim(), '', '--silent 应保持静默')
})

test('缺一枚钩子 ⇒ exit 2、点名缺失钩子且不写配置', (t) => {
  const root = makeTempRoot(t)
  initRepo(root)
  createHooks(
    root,
    REQUIRED_HOOKS.filter((name) => name !== 'pre-push'),
  )

  const r = runInstaller(root)
  assert.equal(r.status, 2, `缺钩子应未判定 exit 2,实际 stdout=${r.stdout} stderr=${r.stderr}`)
  assert.match(r.stderr, /pre-push/)
  assert.equal(readHooksPath(root), '', '钩子不全时不得写入 core.hooksPath')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
