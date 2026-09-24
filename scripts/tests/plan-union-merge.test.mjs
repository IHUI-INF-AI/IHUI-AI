// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/plan-union-merge.mjs 的镜像测试(此前**根本没有**)。
 *
 * 立因:该工具把仓根写死成 `D:/IHUI-AI`。同一份仓在 `G:/IHUI-AI` 也活着
 * (`git-rebuild-local.mjs:38-39` 记过同型迁盘事故),于是在本机它 **12 处 `git -C` 全部打空**,
 * 2026-09-25 实跑 rc=1(`fetch 失败:git -C D:/IHUI-AI …`),且给出的原因会把人引向
 * "远端/网络坏了"这个错方向。
 * (写本票时我一度把它写成"`git-sync-converge` 撞冲突时**唯一**的解阻塞器"—— **实测不成立**:
 *  `git-sync-converge:468-481` 冲突即报错退出,活文档并集走 `union-converge.mjs`,并不调用本脚本。
 *  已在源码注释与本注就地更正;本脚本的真实定位是 AGENTS §15/§26 口径里点名的
 *  "计划文档冲突时的人工并集恢复工具"。)
 *
 * 四条判据的取向:
 *  - T1 钉**不变量**(不得出现写死仓根的盘符字面量 / 必须由自身位置推导),不钉某一条注释;
 *  - T2 端到端造一次**真冲突**(两侧在同一处各追一行),证明它会去合并而不是提前退出;
 *  - T3 **变异对照**:就地构造"旧形状"(推导行换成写死的绝对路径 + 摘掉存在性护栏),放进**同一个夹具**
 *        跑,必须拿不到 T2 的结论 —— 缺这条,T2 有可能只是"任何脚本都会打印点什么"(本项目当天连遇三次假对照);
 *        刻意**不**用 HEAD 旧版做对照,那会让本测试在修复提交落地后自毁。
 *  - T4 推导失败必须 rc=2 显式"无法判定",绝不回退到任何写死路径继续跑 git。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const GIT = 'git'
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'plan-union-merge.mjs')

const g = (dir, args) =>
  execFileSync(GIT, ['-C', dir, '-c', 'safe.directory=*', '-c', 'core.autocrlf=false', ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  })

/** 造一个真冲突:base 一行,两侧各自在同一处追加不同的行。 */
function makeConflictedRepo(root) {
  mkdirSync(join(root, 'scripts'), { recursive: true })
  g(root, ['init', '-b', 'main'])
  g(root, ['config', 'user.email', 't@example.com'])
  g(root, ['config', 'user.name', 'fixture'])
  const PLAN = join(root, 'PROJECT_PLAN.md')
  writeFileSync(PLAN, '# 计划\n\n- [ ] 共同基底行\n', 'utf8')
  writeFileSync(join(root, 'other.txt'), '未参与\n', 'utf8')
  g(root, ['add', '-A'])
  g(root, ['commit', '-qm', 'base'])
  const base = g(root, ['rev-parse', 'HEAD']).trim()

  writeFileSync(PLAN, '# 计划\n\n- [ ] 共同基底行\n- [ ] 本侧登记行 O01\n', 'utf8')
  g(root, ['commit', '-aqm', 'ours'])
  const ours = g(root, ['rev-parse', 'HEAD']).trim()

  g(root, ['checkout', '-q', base])
  writeFileSync(PLAN, '# 计划\n\n- [ ] 共同基底行\n- [ ] 对侧登记行 T02\n', 'utf8')
  g(root, ['commit', '-aqm', 'theirs'])
  const theirs = g(root, ['rev-parse', 'HEAD']).trim()
  g(root, ['checkout', '-q', 'main'])
  const oursText = g(root, ['show', `${ours}:PROJECT_PLAN.md`])
  const theirsText = g(root, ['show', `${theirs}:PROJECT_PLAN.md`])
  return { base, ours, theirs, oursText, theirsText }
}

/** 两侧行多重集取 max 的并集行数 —— 与工具自己声明的语义逐字同口径。 */
function unionMultisetCount(aText, bText) {
  const count = (t) => {
    const map = new Map()
    for (const line of t.replace(/\r\n/g, '\n').split('\n')) map.set(line, (map.get(line) || 0) + 1)
    return map
  }
  const a = count(aText)
  const b = count(bText)
  let n = 0
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    n += Math.max(a.get(key) || 0, b.get(key) || 0)
  }
  return n
}

function runTool(scriptPath, args, cwd) {
  const r = spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf8',
    cwd,
    windowsHide: true,
    timeout: 120000,
  })
  return { rc: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
}

test('T1 不变量:仓根必须由脚本自身位置推导,不得写死盘符', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  // 剥注释后再判,否则会被"解释为什么不能写死"的那段说明文字自己判红。
  const code = src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
  assert.doesNotMatch(
    code,
    /["'][A-Za-z]:[\\/][^"']*["']/,
    '源码里出现写死的盘符绝对路径 ⇒ 换机/换盘即失效',
  )
  assert.match(code, /import\.meta\.url/, '仓根没有从脚本自身位置推导')
})

test('T2 端到端:真冲突下它确实去合并,且要求双方每一行都存活', () => {
  const root = mkScratch('pum-t2-')
  try {
    const { base, ours, theirs, oursText, theirsText } = makeConflictedRepo(root)
    const 期望并集行数 = unionMultisetCount(oursText, theirsText)
    const tool = join(root, 'scripts', 'plan-union-merge.mjs')
    writeFileSync(tool, readFileSync(SCRIPT, 'utf8'), 'utf8')
    const { rc, out } = runTool(tool, ['--base', base, '--ours', ours, '--theirs', theirs], root)
    assert.doesNotMatch(out, /无法判定仓根|fetch 失败/, `工具没按推导出的根跑:\n${out}`)
    assert.match(out, /C1 冲突路径 = PROJECT_PLAN\.md/, `冲突面没被认成该文件:\n${out}`)
    // 断的是**不变量**而不是措辞:结果必须逐行等于"两侧行多重集取 max"的并集 ——
    // 这正是该工具承诺的语义(每行重数 = max(ours, theirs)),少一行就是吞了别人登记行。
    const m = out.match(/C2 结果行数=(\d+) 我方行数=(\d+) 对方行数=(\d+)/)
    assert.ok(m, `没报出 C2 行数对照:\n${out}`)
    assert.equal(Number(m[1]), 期望并集行数, `并集行数不等于"两侧多重集取 max"(有侧被整块丢掉)`)
    assert.ok(Number(m[1]) >= Math.max(Number(m[2]), Number(m[3])), '并集小于某一侧 ⇒ 会吞别人登记行')
    assert.match(out, /三条安全边界全过/, `这份夹具应当三条全过(不该放弃):\n${out}`)
    assert.ok(rc === 0 || rc === 1, `退出码只能是 0/1,实得 ${rc}:\n${out}`)
  } finally {
    rmScratch(root)
  }
})

test('T3 变异对照:把仓根换成"写死的一个绝对路径"后,同一夹具必须拿不到 T2 的结论', () => {
  // 刻意不读 HEAD 旧版做对照 —— 那会让本测试在修复提交落地后自毁(棘轮夹具写死存量路径同型)。
  // 这里就地构造"旧形状":推导行 → 写死路径 + 去掉存在性护栏,模拟的正是 D:/IHUI-AI 那一版。
  const src = readFileSync(SCRIPT, 'utf8')
  const mutant = src
    .replace(
      /const REPO = resolve\(fileURLToPath\(new URL\('\.\.\/', import\.meta\.url\)\)\)/,
      `const REPO = ${JSON.stringify(join('Z:', 'definitely-not-a-repo-root'))}`,
    )
    .replace(/if \(!existsSync\(join\(REPO, FILE\)\)\) \{[\s\S]*?\n\}\n/, '')
  assert.notEqual(mutant, src, '变异注入失败(推导行没被替掉)⇒ 本对照无效')

  const root = mkScratch('pum-t3-')
  try {
    const { base, ours, theirs } = makeConflictedRepo(root)
    const tool = join(root, 'scripts', 'plan-union-merge.mjs')
    writeFileSync(tool, mutant, 'utf8')
    const { rc, out } = runTool(tool, ['--base', base, '--ours', ours, '--theirs', theirs], root)
    const 像样结论 = /C2 结果行数=\d+ 我方行数=\d+ 对方行数=\d+/.test(out) &&
      !/No such file|not a git repository|ENOENT/i.test(out)
    assert.ok(
      !像样结论 || rc !== 0,
      `写死仓根的变异体竟然在临时仓里给出了正常结论 ⇒ T2 是恒真断言,对照失效:\n${out.slice(0, 400)}`,
    )
  } finally {
    rmScratch(root)
  }
})

test('T4 护栏:推导不到该仓时显式"无法判定"(rc=2),绝不回退写死路径', () => {
  const root = mkScratch('pum-t4-')
  try {
    mkdirSync(join(root, 'scripts'), { recursive: true })
    const tool = join(root, 'scripts', 'plan-union-merge.mjs')
    writeFileSync(tool, readFileSync(SCRIPT, 'utf8'), 'utf8')
    const { rc, out } = runTool(tool, ['--base', 'x', '--ours', 'y', '--theirs', 'z'], root)
    assert.equal(rc, 2, `缺 PROJECT_PLAN.md 时应 rc=2 显式无法判定,实得 ${rc}:\n${out}`)
    assert.match(out, /无法判定仓根/, `文案未点名失败原因:\n${out}`)
  } finally {
    rmScratch(root)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
