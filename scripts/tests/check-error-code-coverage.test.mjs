// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门「errorCode 覆盖率对账」镜像测试(§22c:直接 import 源模块,不复制实现)
 *
 * 钉四件事,顺序有意义:
 *  1. 判据本身咬得住(未收录码必须红 —— 阳性对照,不读脚本自述);
 *  2. **2026-09-24 崩溃回归**:词包工作树滞后 HEAD 时,默认面必须照常判完并 exit 0,
 *     面取不到必须显式 exit 2 —— 既不崩、也不把"没判成"记成绿;
 *  3. 同一轮只读一个面(--staged 判索引,坏内容进了索引就藏不住);
 *  4. 装车:runner 里真的注册了这道门(blocking + 自己的 skipEnv + id 不撞号)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { __test__ as G } from '../check-error-code-coverage.mjs'

const GIT = resolveGitBin()
const SCRIPT = 'check-error-code-coverage.mjs'

const CATALOG = `export const TURN_ERROR_CLASSES = ['TIMEOUT', 'BAD_PARAMS'] as const
export const ERROR_CODE_CATALOG: Readonly<Record<string, ErrorCatalogEntry>> = Object.freeze({
  TIMEOUT: { titleKey: 'TIMEOUT.title', actionKey: 'TIMEOUT.action', category: 'backendTimeout' },
  BAD_PARAMS: { titleKey: 'BAD_PARAMS.title', actionKey: 'BAD_PARAMS.action', category: 'invalidResponse' },
})
`
const MESSAGES =
  JSON.stringify(
    {
      ai: {
        pane: {
          errorCatalog: {
            TIMEOUT: { title: '请求超时', action: '稍后重试' },
            BAD_PARAMS: { title: '参数不合法', action: '检查参数' },
          },
        },
      },
    },
    null,
    2,
  ) + '\n'
/** 09-25 事故里磁盘副本的形状:合法 JSON,但没有 errorCatalog 子树。 */
const STALE_MESSAGES = JSON.stringify({ ai: { pane: { retry: '重试' } } }, null, 2) + '\n'

function git(dir, ...args) {
  return execFileSync(
    GIT,
    [
      '-c',
      'safe.directory=*',
      '-c',
      'init.defaultBranch=main',
      '-c',
      'user.name=gate-fixture',
      '-c',
      'user.email=gate-fixture@invalid',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'core.autocrlf=false',
      '-C',
      dir,
      ...args,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

/** 把真实门脚本 + 它 import 的 lib 复制进临时 git 仓,造一棵最小码面/词表/词包。 */
function fixture() {
  const dir = mkScratch('ihui-ecc-')
  try {
    const w = (rel, text) => {
      const p = join(dir, ...rel.split('/'))
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, text, 'utf8')
    }
    mkdirSync(join(dir, 'scripts', 'lib'), { recursive: true })
    copyFileSync(new URL(`../${SCRIPT}`, import.meta.url), join(dir, 'scripts', SCRIPT))
    copyFileSync(new URL('../lib/gitdir.mjs', import.meta.url), join(dir, 'scripts', 'lib', 'gitdir.mjs'))
    w('packages/shared/src/chat/error-catalog.ts', CATALOG)
    w('packages/i18n/messages/web/zh-CN.json', MESSAGES)
    w('packages/api-client/src/client.ts', "const e = { errorCode: 'TIMEOUT' }\n")
    w('apps/ai-service/app/r.py', 'return {"ok": False, "errorCode": "BAD_PARAMS"}\n')
    git(dir, 'init', '-q')
    git(dir, 'add', '-A')
    git(dir, 'commit', '-qm', 'ecc fixture')
  } catch (e) {
    rmScratch(dir)
    throw e
  }
  return dir
}

function run(dir, args = []) {
  return spawnSync(process.execPath, [join(dir, 'scripts', SCRIPT), ...args], {
    cwd: dir,
    windowsHide: true,
    timeout: 120000,
    encoding: 'utf8',
  })
}

test('判据单元:扫描器咬住注释位而不吃类型声明;词包缺子树抛 UndeterminedError', () => {
  assert.ok(
    G.extractCodes('a.ts', "* errorCode 'BUDGET_EXHAUSTED'", 'ts').some((h) => h.code === 'BUDGET_EXHAUSTED'),
    '注释位必须咬住(BUDGET_EXHAUSTED 只存在于注释)',
  )
  assert.equal(G.extractCodes('a.ts', 'export interface E { errorCode?: string }', 'ts').length, 0)
  assert.throws(() => G.readCatalogMessages('{"ai":{"pane":{}}}', 'fixture'), G.UndeterminedError)
  assert.throws(() => G.readCatalogMessages('{ oops', 'fixture'), G.UndeterminedError)
})

test('e2e 干净夹具:exit 0 且结论行点名判定面(判据真的跑完了,不是跳过)', () => {
  const dir = fixture()
  try {
    const r = run(dir)
    assert.equal(r.status, 0, `stdout=${r.stdout} stderr=${r.stderr}`)
    assert.match(r.stdout, /错误码覆盖率通过/)
    assert.match(r.stdout, /判定面:HEAD blob/)
    assert.match(r.stdout, /产出 2 个 errorCode/)
  } finally {
    rmScratch(dir)
  }
})

test('e2e 阳性对照:未收录码必须红并点名文件行号(判据不响=尺子坏了)', () => {
  const dir = fixture()
  try {
    writeFileSync(
      join(dir, 'apps', 'ai-service', 'app', 'leak.py'),
      'raise ApiError(errorCode="ZZ_NOT_CATALOGED_E2E")\n',
      'utf8',
    )
    git(dir, 'add', '-A')
    git(dir, 'commit', '-qm', 'leak a code')
    const r = run(dir)
    assert.equal(r.status, 1, `阳性对照必须红,实际 stdout=${r.stdout}`)
    assert.match(r.stderr, /R1/)
    assert.match(r.stderr, /ZZ_NOT_CATALOGED_E2E/)
    assert.match(r.stderr, /leak\.py/)
  } finally {
    rmScratch(dir)
  }
})

test('e2e 崩溃回归(09-25 事故形态):工作树词包滞后 HEAD —— HEAD 面照常判绿,磁盘面显式无法判定', () => {
  const dir = fixture()
  try {
    writeFileSync(join(dir, 'packages', 'i18n', 'messages', 'web', 'zh-CN.json'), STALE_MESSAGES, 'utf8')
    // ① 磁盘滞后 HEAD,未 staged:默认(HEAD)面必须仍 exit 0 —— 旧版在这里抛裸 Error、
    //    以 exit 1 冒充判据失败,逼出绕过钩子。
    const head = run(dir)
    assert.equal(head.status, 0, `HEAD 面不得被滞后工作树咬红:${head.stdout}${head.stderr}`)
    // ② --worktree 按磁盘判:取不到子树 ⇒ 必须 exit 2 并点名原因,既不崩也不记绿。
    const wt = run(dir, ['--worktree'])
    assert.equal(wt.status, 2)
    assert.match(wt.stderr, /无法判定/)
    assert.match(wt.stderr, /ai\.pane\.errorCatalog/)
    // ③ 坏内容进了索引:--staged 必须跟着红(同轮同面,坏的那一面藏不住),HEAD 面不受扰。
    git(dir, 'add', '-A')
    const staged = run(dir, ['--staged'])
    assert.equal(staged.status, 2, `索引里就是缺子树的词包,--staged 不得记绿:${staged.stdout}`)
    assert.match(staged.stderr, /无法判定/)
    assert.equal(run(dir).status, 0, 'HEAD 仍干净,不得被索引里的坏内容牵连')
  } finally {
    rmScratch(dir)
  }
})

test('e2e 两枚面旗同给 → exit 2(同一轮不得混读两个判定面)', () => {
  const dir = fixture()
  try {
    const r = run(dir, ['--staged', '--worktree'])
    assert.equal(r.status, 2)
    assert.match(r.stderr, /不得同轮混读/)
  } finally {
    rmScratch(dir)
  }
})

test('装车证明:runner 真注册了这道门,恰好一次、blocking、有自己的 skipEnv 且 id 不撞号', () => {
  const runner = readFileSync(new URL('../guardian-runner.mjs', import.meta.url), 'utf8')
  const at = [...runner.matchAll(new RegExp(`script: '${SCRIPT}'`, 'g'))]
  assert.equal(at.length, 1, `runner 里必须恰好一处调用 ${SCRIPT},实际 ${at.length}`)
  const before = runner.slice(0, at[0].index)
  const ids = [...before.matchAll(/id: '(\d+[a-z]?)',/g)]
  assert.ok(ids.length > 0, 'script 之前必须能找到 id')
  const id = ids[ids.length - 1][1]
  const all = [...runner.matchAll(/id: '(\d+[a-z]?)',/g)].map((m) => m[1])
  assert.equal(
    all.filter((x) => x === id).length,
    1,
    `id ${id} 在 runner 里重复,会串 skipEnv 与失败归属(撞号事故先例:75/76、91)`,
  )
  const entry = runner.slice(runner.lastIndexOf(`id: '${id}'`, at[0].index), at[0].index + 900)
  assert.match(entry, /mode: 'blocking'/, '必须 blocking —— warn 级挡不住码面悄悄漏')
  assert.match(entry, /skipEnv: 'HUSKY_SKIP_ERROR_CODE_COVERAGE'/, '必须有应急通道')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
