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
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

const GIT = 'git'
const SCRIPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = join(SCRIPTS_DIR, 'plan-union-merge.mjs')

/**
 * 把工具连同**它的相对 import 闭包**放进演练仓。
 * 原先的 `writeFileSync(tool, readFileSync(SCRIPT))` 只拷一个文件 —— 工具一旦经共用层
 * 取道(`lib/scratch-dir.mjs` 等),子进程就以 ERR_MODULE_NOT_FOUND 退 1,症状与"被测行为坏了"
 * 一模一样(2026-09-25 该库头注记的那两次同型事故,这次是我自己踩的第三回)。
 */
const installTool = (root) => {
  copyScriptWithClosure(SCRIPTS_DIR, 'plan-union-merge.mjs', join(root, 'scripts'))
  return join(root, 'scripts', 'plan-union-merge.mjs')
}

const g = (dir, args) =>
  execFileSync(GIT, ['-C', dir, '-c', 'safe.directory=*', '-c', 'core.autocrlf=false', ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    stdio: ['ignore', 'pipe', 'pipe']
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
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
    stdio: ['ignore', 'pipe', 'pipe']
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
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
    const tool = installTool(root)
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
    const tool = installTool(root)
    const { rc, out } = runTool(tool, ['--base', 'x', '--ours', 'y', '--theirs', 'z'], root)
    assert.equal(rc, 2, `缺 PROJECT_PLAN.md 时应 rc=2 显式无法判定,实得 ${rc}:\n${out}`)
    assert.match(out, /无法判定仓根/, `文案未点名失败原因:\n${out}`)
  } finally {
    rmScratch(root)
  }
})

/**
 * A5 夹具①:两侧在同一处各追加**同一个登记键**的不同写法 —— 各自看都合法,
 * 但并集里同号重复;旧判据(d1>d0 只看超长行)放行,严格档必须红。
 */
function makeSameIdRepo(root) {
  mkdirSync(join(root, 'scripts'), { recursive: true })
  g(root, ['init', '-b', 'main'])
  g(root, ['config', 'user.email', 't@example.com'])
  g(root, ['config', 'user.name', 'fixture'])
  const PLAN = join(root, 'PROJECT_PLAN.md')
  writeFileSync(PLAN, '# 计划\n\n- [ ] 共同基底行\n', 'utf8')
  g(root, ['add', '-A'])
  g(root, ['commit', '-qm', 'base'])
  const base = g(root, ['rev-parse', 'HEAD']).trim()
  writeFileSync(PLAN, '# 计划\n\n- [ ] 共同基底行\n- [ ] Y-12 本侧写法\n', 'utf8')
  g(root, ['commit', '-aqm', 'ours'])
  const ours = g(root, ['rev-parse', 'HEAD']).trim()
  g(root, ['checkout', '-q', base])
  writeFileSync(PLAN, '# 计划\n\n- [ ] 共同基底行\n- [ ] Y-12 对侧写法\n', 'utf8')
  g(root, ['commit', '-aqm', 'theirs'])
  const theirs = g(root, ['rev-parse', 'HEAD']).trim()
  g(root, ['checkout', '-q', 'main'])
  return { base, ours, theirs }
}

/**
 * A5 夹具②:base 有一行带号待办,我方原样保留(只在文件尾追加自己的新行),
 * 对侧把这行删掉(也在文件尾追加自己的行)。并集会执行该删除 ⇒ 我方独有带号行消失。
 */
function makeDroppedIdRepo(root) {
  mkdirSync(join(root, 'scripts'), { recursive: true })
  g(root, ['init', '-b', 'main'])
  g(root, ['config', 'user.email', 't@example.com'])
  g(root, ['config', 'user.name', 'fixture'])
  const PLAN = join(root, 'PROJECT_PLAN.md')
  const baseText = '# 计划\n\n- [ ] B76 旧登记待办\n- [ ] 共同基底行\n'
  writeFileSync(PLAN, baseText, 'utf8')
  g(root, ['add', '-A'])
  g(root, ['commit', '-qm', 'base'])
  const base = g(root, ['rev-parse', 'HEAD']).trim()
  writeFileSync(PLAN, `${baseText}- [ ] 本侧新登记 O01\n`, 'utf8')
  g(root, ['commit', '-aqm', 'ours'])
  const ours = g(root, ['rev-parse', 'HEAD']).trim()
  g(root, ['checkout', '-q', base])
  writeFileSync(PLAN, '# 计划\n\n- [ ] 共同基底行\n- [ ] 对侧新登记 T02\n', 'utf8')
  g(root, ['commit', '-aqm', 'theirs'])
  const theirs = g(root, ['rev-parse', 'HEAD']).trim()
  g(root, ['checkout', '-q', 'main'])
  return { base, ours, theirs }
}

test('T5 严格档:同号重复被两份各自合法化也必须红(d1 长行判据看不见它)', () => {
  const root = mkScratch('pum-t5-')
  try {
    const { base, ours, theirs } = makeSameIdRepo(root)
    const tool = installTool(root)
    const args = ['--base', base, '--ours', ours, '--theirs', theirs]
    const legacy = runTool(tool, args, root)
    assert.equal(legacy.rc, 0, `默认档保持旧行为(只罚新增超长重复),实得 ${legacy.rc}:\n${legacy.out}`)
    assert.doesNotMatch(legacy.out, /同号重复/, '默认档不得悄悄新增判据')
    const strict = runTool(tool, [...args, '--strict-ids'], root)
    assert.equal(strict.rc, 1, `严格档遇同号重复必须阻断,实得 ${strict.rc}:\n${strict.out}`)
    assert.match(strict.out, /合并结果同号重复 1 枚\(Y-12×2\)/, '必须点名重复的键与重数')
    assert.match(strict.out, /--strict-ids/, '必须点名触发的是严格档')
  } finally {
    rmScratch(root)
  }
})

test('T6 严格档:我方独有带号行不得被静默解删 —— 无声明阻断,有理由放行', () => {
  const root = mkScratch('pum-t6-')
  try {
    const { base, ours, theirs } = makeDroppedIdRepo(root)
    const tool = installTool(root)
    const args = ['--base', base, '--ours', ours, '--theirs', theirs]
    const legacy = runTool(tool, args, root)
    assert.equal(legacy.rc, 0, `默认档仍把这次解删读成可收编的改写,实得 ${legacy.rc}:\n${legacy.out}`)
    assert.doesNotMatch(legacy.out, /阻断,不落地/, '默认档不得阻断 —— 这正是 A5 要补的洞')
    const strict = runTool(tool, [...args, '--strict-ids'], root)
    assert.equal(strict.rc, 1, `严格档遇未声明解删必须阻断,实得 ${strict.rc}:\n${strict.out}`)
    assert.match(strict.out, /我方独有带号行未存活且未声明 --attest-id-drop\(B76\)/, '必须点名被解删的键')
    assert.match(strict.out, /阻断,不落地/, '必须明说阻断')
    const attested = runTool(
      tool,
      [...args, '--strict-ids', '--attest-id-drop', 'B76=该旧票已由票主确认作废,对侧整行删除'],
      root,
    )
    assert.equal(attested.rc, 0, `有理由声明应放行,实得 ${attested.rc}:\n${attested.out}`)
    assert.match(attested.out, /B76「该旧票已由票主确认作废/, '放行必须把声明理由印出来')
    const stale = runTool(
      tool,
      [...args, '--strict-ids', '--attest-id-drop', 'B77=这条声明并不对应任何丢失行'],
      root,
    )
    assert.equal(stale.rc, 1, '陈旧声明不得被当作放行凭证')
    assert.match(stale.out, /陈旧声明不记通过|未命中任何丢失带号行/)
  } finally {
    rmScratch(root)
  }
})

/**
 * A5b:严格判据必须在**写路径默认生效** —— 事故的教训就是"默认档放行",写盘这一步不能再靠
 * 调用方记得加 `--strict-ids`。T7 只给 `--apply`(不带任何编号档旗)即须拒绝同号重复;
 * T8 给逃生阀 `--legacy-lenient` 才回到旧行为,且 stderr 必须有一行醒目告警。
 */
test('T7 写路径默认严格:只带 --apply、不加任何编号旗,同号重复也必须阻断', () => {
  const root = mkScratch('pum-t7-')
  try {
    const { base, ours, theirs } = makeSameIdRepo(root)
    const tool = installTool(root)
    const applied = runTool(tool, ['--base', base, '--ours', ours, '--theirs', theirs, '--apply'], root)
    assert.equal(applied.rc, 1, `写路径默认档不得放行同号重复,实得 ${applied.rc}:\n${applied.out}`)
    assert.match(applied.out, /合并结果同号重复 1 枚\(Y-12×2\)/, '必须点名同号重复的键')
    assert.match(applied.out, /阻断,不落地/, '写路径必须明说阻断')
  } finally {
    rmScratch(root)
  }
})

test('T8 逃生阀:--apply --legacy-lenient 放行旧行为,但 stderr 必须打醒目告警', () => {
  const root = mkScratch('pum-t8-')
  try {
    const { base, ours, theirs } = makeSameIdRepo(root)
    const tool = installTool(root)
    const legacy = runTool(
      tool,
      ['--base', base, '--ours', ours, '--theirs', theirs, '--apply', '--legacy-lenient'],
      root,
    )
    assert.equal(legacy.rc, 0, `逃生阀下应回到旧行为放行,实得 ${legacy.rc}:\n${legacy.out}`)
    assert.match(legacy.out, /--legacy-lenient/, '告警必须点名是哪枚旗开的')
    assert.match(legacy.out, /严格编号判据已关闭/, '告警必须说清关掉了什么')
    assert.doesNotMatch(legacy.out, /阻断,不落地/, '逃生阀下不得阻断')
  } finally {
    rmScratch(root)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
