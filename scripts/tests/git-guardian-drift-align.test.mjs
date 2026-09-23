// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 幻影漂移周期自愈「装车证明」+ 守护所依赖的 CLI 契约回归
//
// 成因(2026-09-24 实测):§5b 的三层工作区存续自愈里,第二层 `--align-drift`(幻影漂移对齐)
// 只挂在 `git-sync-converge` 的成功出口 —— 而 converge 仅在真有分叉要收敛时才跑。共享工作区
// 里 HEAD 每被并发会话推进一次,不 checkout 的提交方式就多一批"内容==祖先版本"的落后文件,
// 实测一次积到 262 个(其中含在役守门脚本本体,导致该脚本在运行态**根本没有** alignDrift 层,
// 即"修漂移的工具自己就是漂移的"）。故把对齐层挂进 git-guardian 的 2 分钟周期。
//
// 本测试钉三件事:
//   ① 装车证明 —— guardian 的 healWorktreeTracked() 体内真的调了 `--align-drift`,且 spawn 带
//      windowsHide(§5b:漏此参数在计划任务下必弹控制台窗)。
//   ② CLI 契约 —— 守护是"取 stdout 最后一行 JSON.parse",所以 `--align-drift --json` 必须在
//      **有漂移/无漂移**两种态下都以 exit 0 收场且最后一行可解析(曾因把人类可读行混在 JSON
//      之后而让守护每轮记一条"自愈失败")。
//   ③ 逃生舱 —— IHUI_SKIP_DRIFT_ALIGN=1 在对齐层生效(与恢复层的 IHUI_SKIP_WORKTREE_HEAL 分开,
//      紧急停一侧不得连带停另一侧)。
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GUARDIAN = join(REPO, 'scripts', 'git-guardian.mjs')
const HEAL_DIR = join(REPO, 'scripts')

/** 取函数体(按大括号配平,不用正则猜行) */
function funcBody(src, name) {
  const start = src.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `源文件里找不到 ${name}()`)
  const open = src.indexOf('{', start)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1)
  }
  assert.fail(`${name}() 花括号未配平`)
}

test('装车证明:git-guardian 周期守护真的调用 --align-drift', () => {
  const body = funcBody(readFileSync(GUARDIAN, 'utf8'), 'healWorktreeTracked')
  assert.match(body, /run\(\['--json'\]\)/, '恢复层调用丢失 —— 对齐层不得顶掉缺失恢复')
  assert.match(body, /run\(\['--align-drift',\s*'--json'\]\)/, '对齐层没装车 = §5b 第二层形同虚设')
  assert.match(body, /windowsHide:\s*true/, 'spawn 漏 windowsHide ⇒ 计划任务下必弹控制台窗(§5b)')
})

test('逃生舱只对对齐层生效,不影响恢复层', () => {
  const body = funcBody(readFileSync(GUARDIAN, 'utf8'), 'healWorktreeTracked')
  const atSkip = body.indexOf('IHUI_SKIP_DRIFT_ALIGN')
  const atAlign = body.indexOf("'--align-drift'")
  assert.ok(atSkip > 0 && atAlign > atSkip, 'IHUI_SKIP_DRIFT_ALIGN 必须早于对齐层调用')
  assert.ok(body.indexOf("run(['--json'])") < atSkip, '跳过开关不得挡在恢复层之前')
})

/**
 * 造一个最小仓:v1 → v2(HEAD),再把工作区写回 v1(索引==HEAD ⇒ 幻影漂移)。
 * 自愈 CLI 的 repoRoot 由**脚本自身位置**推导(`resolve(dirname(import.meta.url),'..')`),
 * 所以必须把 CLI 连同它唯一的依赖(check-stale-revert.mjs)复制进演练仓再执行 ——
 * 直接跑仓内 CLI 会去对齐真实工作区(第一版就犯了这个错,断言读到的是真仓漂移数 2)。
 */
function makeDrillRepo() {
  const tmp = mkdtempSync(join(tmpdir(), 'gk-drift-'))
  mkdirSync(join(tmp, 'scripts'), { recursive: true })
  for (const f of ['heal-worktree-tracked.mjs', 'check-stale-revert.mjs']) {
    copyFileSync(HEAL_DIR + '/' + f, join(tmp, 'scripts', f))
  }
  const g = (args) =>
    execFileSync('git', ['-c', 'safe.directory=*', '-C', tmp, ...args], { encoding: 'utf8' })
  g(['init', '-q', '--initial-branch=main'])
  g(['config', 'core.autocrlf', 'false']) // 否则 restore 写回 CRLF,断言随本机 git 配置漂移(与本仓自愈自检同法)
  g(['config', 'user.email', 't@t'])
  g(['config', 'user.name', 't'])
  writeFileSync(join(tmp, 'a.ts'), 'v1\n')
  g(['add', '-A'])
  g(['commit', '-qm', 'A: v1'])
  writeFileSync(join(tmp, 'a.ts'), 'v2\n')
  g(['add', '-A'])
  g(['commit', '-qm', 'B: v2'])
  return { tmp, g }
}

function runAlign(tmp, env = {}) {
  const r = spawnSync(
    process.execPath,
    [join(tmp, 'scripts', 'heal-worktree-tracked.mjs'), '--align-drift', '--json'],
    {
      cwd: tmp,
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, ...env },
    },
  )
  return { status: r.status, last: (r.stdout || '').trim().split('\n').pop() }
}

test('CLI 契约:有漂移时 exit 0 且最后一行是 aligned>=1 的 JSON,文件回到 HEAD', () => {
  const { tmp, g } = makeDrillRepo()
  try {
    writeFileSync(join(tmp, 'a.ts'), 'v1\n') // 写回祖先版本 = 静默回滚的形态
    const { status, last } = runAlign(tmp)
    assert.equal(status, 0, `--align-drift 应 exit 0,实得 ${status};stdout 末行=${last}`)
    const r = JSON.parse(last) // 守护正是这样解析的
    assert.equal(r.aligned, 1, `应识别并对齐 1 个漂移文件,实得 ${JSON.stringify(r)}`)
    assert.deepEqual(r.paths, ['a.ts'])
    assert.equal(readFileSync(join(tmp, 'a.ts'), 'utf8'), 'v2\n', '对齐后内容必须等于 HEAD')
    assert.equal(g(['status', '--porcelain']).trim(), '', '对齐后工作区应干净')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('CLI 契约:无漂移时同样 exit 0 + 最后一行可解析(守护不得每轮记失败)', () => {
  const { tmp } = makeDrillRepo()
  try {
    const { status, last } = runAlign(tmp)
    assert.equal(status, 0, `干净仓应 exit 0,实得 ${status}`)
    const r = JSON.parse(last)
    assert.equal(r.aligned, 0)
    // 真编辑(非祖先版本)不得被覆盖 —— 这一条把"对齐层=无差别 checkout"的误解钉死
    writeFileSync(join(tmp, 'a.ts'), 'mine\n')
    const r2 = JSON.parse(runAlign(tmp).last)
    assert.equal(r2.aligned, 0, '独有编辑内容被误判为漂移并覆盖')
    assert.equal(readFileSync(join(tmp, 'a.ts'), 'utf8'), 'mine\n')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
