// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/safe-commit.mjs` 的 §22c 镜像测试(票 G-1079146 剩余半格,2026-10-08 新建)。
 *
 * 为什么全部走 **CLI 端到端** 而不是 import 判据函数:`safe-commit.mjs` 的整个主体就是顶层
 * 线性 CLI 脚本(它没有、也不该有 §22d `isDirectRun` 守卫 —— 把主体包进 if 是重写它),
 * import 它会当场执行 argv 解析并 `exit 2`。所以能证的只有一件事:**真跑它**。
 * 这恰好是票面第 4 条要的形态("safe-commit 必须拒绝并点名该行"),也顺带把闭包完整性
 * (safe-commit → live-doc-edit → lib/*)当场验了一遍 —— 少拷一跳的失效形态是
 * ERR_MODULE_NOT_FOUND + 子进程 exit 1 + stdout 空,读起来像"判据判红"而实际是夹具缺件
 * (本仓在 merge-live-doc / plan-sha 那两格踩过,现由 copyScriptWithClosure 收口)。
 *
 * 三条判读纪律(写在这里是因为它们决定了每条断言的方向):
 *  ① **判红必须只来自新行**。存量 sha(HEAD 里本来就在的)不得被本次提交顶红 —— 那是
 *     §12e 的恒红门,唯一出路是各会话跳门。SC5a/SC5b/SC5c 三条各钉一种"不该回判"的形态。
 *  ② **未判定 ⇒ 放行**。SC3 与 SC10 是这条分流的载体臂(HEAD 面取不到 / 行差集超闸)。
 *     把这一支改成拒绝,翻红的必须是 SC3+SC10,而不是 SC1/SC2 —— 变异自证据此量,
 *     证明分流有牙而不是恒绿。
 *  ③ **判据只有一份**。SC8 的源码锁禁止本器出现第二条 hex 抽取式、并要求行差集走
 *     `lib/stale-content-analysis.mjs` 那一份实现;SC7 从行为侧证明同一件事:全数字串由
 *     权威门的形状档摘掉,本器没有自己判它(两处各写一遍,这条必红)。
 *
 * 夹具回收一律 `t.after(() => rmScratch(dir, { bestEffort: true }))`,不写在 try/finally 里:
 * 实测 Windows 上首删临时 git 仓常撞 EPERM(git 对象是只读文件),而 `finally` 抛错会**吞掉
 * try 块里的断言结论** —— 清理失败不该改写判据的红绿(scratch-dir 自己把这条写成 `bestEffort`
 * 出口的存在理由);未清掉的目录仍在退出清扫注册表里,进程退出时兜第二次。
 *
 * 全程只在 `mkScratch` 的临时 git 仓里跑,**不动真仓、不动共享索引、不 push**。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS = join(HERE, '..')

/** 一枚在本仓/临时仓都问不到的 sha 形态串(10 位 hex、非全数字 ⇒ 权威门判 candidate)。 */
const SHA_BAD = 'deadcafe12'
/** 会被权威门形状档摘掉的同形串(全数字 ⇒ ambiguous),用于证明"没有第二份形状判据"。 */
const SHA_SHAPE_OUT = '20260926'

const HEAD1 = 'line1\nline2\n'

const git = (dir, ...args) => {
  const r = spawnSync('git', ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:\n${r.stdout}\n${r.stderr}`)
  return (r.stdout || '').trim()
}

/**
 * safe-commit 的日志带 ANSI 颜色码(`C.cyan` / `C.reset`)。不断开就把
 * `来自:PROJECT_PLAN.md` 这种"锚点 + 值"的匹配整体变成假阴 —— 而匹配失败会被读成
 * "这一步没跑",实际只是锚点和值之间夹了 4 字节转义序列。所有断言一律在剥色后的文本上做。
 */
const plain = (s) => String(s || '').replace(/\x1b\[[0-9;]*m/g, '')
const outputOf = (r) => plain(`${r.stdout || ''}${r.stderr || ''}`)

/**
 * 夹具回收:先给 Windows 句柄一点时间再删。
 *
 * 实测的直接成因:safe-commit 会 spawn 一个 **detached** 的
 * `git-lock.mjs heartbeat --parent-pid <safe-commit 的 pid>`,它的工作目录就是这把临时仓;
 * 父进程退出后它要跑完自己那一轮轮询才消亡 —— 在它活着之前,Windows 不允许删除那个目录
 * (EPERM,报的是顶层目录本身)。所以"首删必红"不是判据问题,是句柄问题:
 * 重试几次即可,而不该因此把断言结论换掉(见上面对 `finally` 的说明)。
 */
async function dropRepo(dir) {
  for (let i = 0; i < 10; i++) {
    try {
      rmScratch(dir)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 700))
    }
  }
  // 还是删不掉:交给 scratch-dir 的退出清扫兜第二次,本条测试的结论不由它决定。
  rmScratch(dir, { bestEffort: true })
}

/**
 * 造一个带一份活文档的临时 git 仓,并把 safe-commit 连同它的**整条相对 import 闭包**
 * 拷进 `<临时仓>/scripts/`(它按脚本自身位置推导仓根,不拷进去就审不到临时仓)。
 * `git-lock.mjs` 与 `merge-live-doc.mjs` 是被**按路径 spawn** 的(不是 import),
 * 闭包推导结构上看不见它们 ⇒ 必须各拷一次,少一个就是"夹具缺件被读成判据判红"。
 */
function makeRepo(t) {
  const dir = mkScratch('g1079146-sc-')
  t.after(() => dropRepo(dir))
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  git(dir, 'init', '-q', '.')
  git(dir, 'config', 'user.name', 'fixture')
  git(dir, 'config', 'user.email', 'fixture@example.invalid')
  git(dir, 'config', 'commit.gpgsign', 'false')
  git(dir, 'config', 'core.hooksPath', join(dir, '.git', 'hooks'))
  const copied = copyScriptWithClosure(SCRIPTS, 'safe-commit.mjs', join(dir, 'scripts'), [
    'live-doc-edit.mjs',
    'lib/face-reader.mjs',
    'lib/stale-content-analysis.mjs',
    'lib/scratch-dir.mjs',
  ])
  copyScriptWithClosure(SCRIPTS, 'git-lock.mjs', join(dir, 'scripts'))
  copyScriptWithClosure(SCRIPTS, 'merge-live-doc.mjs', join(dir, 'scripts'))
  return { dir, copied }
}

/** 跑一次真正的 safe-commit(不注入任何判据,判据由被拷进临时仓的那份实现自己跑)。 */
function runSafe(dir, { files, message = 'docs: fixture', env = {} }) {
  return spawnSync(
    process.execPath,
    [join(dir, 'scripts', 'safe-commit.mjs'), '-m', message, '--', ...files],
    {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 240_000,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      // 真仓的会话环境里可能挂着 IHUI_GIT_LOCK_UNIT / AGENT_SCOPE / LIVE_SHA_ALLOW,
      // 泄漏进夹具会让"这一步有没有跑"取决于调用方此刻站着哪。逐一清成空值。
      env: {
        ...process.env,
        IHUI_GIT_LOCK_UNIT: '',
        AGENT_SCOPE: '',
        AGENT_NAME: '',
        AGENT_SCOPE_OVERRIDE: '',
        LIVE_SHA_ALLOW: '',
        IHUI_SKIP_LIVE_DOC_CHECK: '',
        IHUI_SAFE_COMMIT_SHA_INTAKE_CAP: '',
        IHUI_SAFE_COMMIT_LOCK_RETRIES: '2',
        ...env,
      },
    },
  )
}

function seed(dir, headText) {
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), headText)
  git(dir, 'add', '-A', '--', 'PROJECT_PLAN.md')
  git(dir, 'commit', '-qm', 'seed')
  return git(dir, 'rev-parse', 'HEAD')
}

test('SC1 活文档新增行含问不到的 sha ⇒ safe-commit 拒绝、点名该行、且不产生提交', (t) => {
  const { dir } = makeRepo(t)
  const before = seed(dir, HEAD1)
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `${HEAD1}- 登记:提交 \`${SHA_BAD}\` 那枚落地\n`)
  const r = runSafe(dir, { files: ['PROJECT_PLAN.md'] })
  const out = outputOf(r)
  assert.equal(r.status, 1, `应拒绝,实得 ${r.status}:\n${out}`)
  assert.match(out, new RegExp(SHA_BAD), '必须点名 token')
  assert.match(out, /拒绝落该行/, '必须说清是拒绝,不是提醒')
  assert.match(out, new RegExp(`所在行:.*${SHA_BAD}`), '必须点名行文本')
  assert.match(out, /来自:PROJECT_PLAN\.md/, '必须点名是哪个文档')
  assert.match(out, /git rev-parse --verify/, '给出的判据命令必须就是真跑的那一条')
  assert.equal(git(dir, 'rev-parse', 'HEAD'), before, '拒绝的那一次不许留下提交')
})

test('SC2 同一位置塞一枚真能解析的 sha ⇒ 放行且提交落地(与 SC1 只差 token 的可解析性)', (t) => {
  const { dir } = makeRepo(t)
  const before = seed(dir, HEAD1)
  // 用 seed 那枚**真 commit** 做指针 ⇒ 全量 40 位形态,`rev-parse --verify <tok>^{commit}` 必过。
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `${HEAD1}- 登记:落地 ${before} 修复\n`)
  const r = runSafe(dir, { files: ['PROJECT_PLAN.md'] })
  const out = outputOf(r)
  assert.equal(r.status, 0, `应放行,实得 ${r.status}:\n${out}`)
  assert.match(out, /取值:新行 1 枚 sha 形态指针全部可解析/, '放行也要报名,不许静默通过')
  assert.notEqual(git(dir, 'rev-parse', 'HEAD'), before, '放行 ⇒ 必须真的落了一枚提交')
})

test('SC3 未判定臂:文档在 HEAD 取不到(首次入库)⇒ 放行不判,且不被 3e 的出路一并关掉', (t) => {
  const { dir } = makeRepo(t)
  // 仓里必须先有一枚提交(否则 Step 1 的 `git reset HEAD` 在零提交仓里必失败,那是既有语义,
  // 不是本步的锅 —— 见本条曾经实测量到的 exit 2),再让 PROJECT_PLAN.md 首次入库。
  writeFileSync(join(dir, 'seed.txt'), 'seed\n')
  git(dir, 'add', '-A', '--', 'seed.txt')
  git(dir, 'commit', '-qm', 'seed-without-livedoc')
  // 首次入库:PROJECT_PLAN.md 从没进过 HEAD。同时借 3e 那条已文档化的出路跳过整文档对账,
  // 以证明 **IHUI_SKIP_LIVE_DOC_CHECK 不放行本步** —— 两笔不同形态的债,一道闸不替另一道作主。
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# 台账\n\n- 登记:提交 \`${SHA_BAD}\` 那枚落地\n`)
  const r = runSafe(dir, { files: ['PROJECT_PLAN.md'], env: { IHUI_SKIP_LIVE_DOC_CHECK: '1' } })
  const out = outputOf(r)
  assert.equal(r.status, 0, `未判定必须放行,实得 ${r.status}:\n${out}`)
  assert.match(out, /取值未判定/, '未判定必须喊出来,不许静默通过')
  assert.match(out, /HEAD 面正文取不到/)
  assert.match(out, /已跳过活文档对账\(IHUI_SKIP_LIVE_DOC_CHECK=1\)/, '3e 的原措辞逐字未改')
  assert.doesNotMatch(out, /拒绝落该行/, '3f 不得被 3e 的出路顺带关掉')
})

test('SC4 非活文档路径 ⇒ 本步不介入(它判的是活文档写入路径,不是任意提交路径)', (t) => {
  const { dir } = makeRepo(t)
  seed(dir, HEAD1)
  writeFileSync(join(dir, 'notes.txt'), `随手记 ${SHA_BAD}\n`)
  const r = runSafe(dir, { files: ['notes.txt'] })
  const out = outputOf(r)
  assert.equal(r.status, 0, `普通提交不该被牵连:\n${out}`)
  assert.doesNotMatch(out, /取值/, '声明面不含活文档时这一步一行都不该说')
})

test('SC5a 存量不回判:HEAD 里本来就有的坏指针,本次只加别的行 ⇒ 放行', (t) => {
  const { dir } = makeRepo(t)
  seed(dir, `${HEAD1}- 登记:三周前落地 ${SHA_BAD} 待办\n`)
  writeFileSync(
    join(dir, 'PROJECT_PLAN.md'),
    `${HEAD1}- 登记:三周前落地 ${SHA_BAD} 待办\n- 新增:一条不含指针的登记\n`,
  )
  const r = runSafe(dir, { files: ['PROJECT_PLAN.md'] })
  const out = outputOf(r)
  assert.equal(r.status, 0, `存量 sha 不得顶红本次提交(§12e 恒红门):\n${out}`)
  assert.doesNotMatch(out, /拒绝落该行/)
})

test('SC5b 携带存量:翻勾一行时把本来就在的旧指针带过去 ⇒ 不判(与 live-doc-edit 的 carriedOver 同义)', (t) => {
  const { dir } = makeRepo(t)
  seed(dir, `${HEAD1}- [ ] G-9 落地 ${SHA_BAD} 待办\n`)
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `${HEAD1}- [x] ✅ G-9 落地 ${SHA_BAD} 已完成\n`)
  // 整行改写必然让 HEAD 那一行在工作树里消失 ⇒ 先撞上 3e 的"工作树 ⊇ HEAD"(那是它的本职,
  // 不是本步的锅)。本条要量的是 3f 的携带档,所以借 3e 那条出路把 3f 单独隔离出来。
  const r = runSafe(dir, { files: ['PROJECT_PLAN.md'], env: { IHUI_SKIP_LIVE_DOC_CHECK: '1' } })
  const out = outputOf(r)
  assert.equal(r.status, 0, `别人的历史指针不该把这次的结清动作钉红:\n${out}`)
  assert.doesNotMatch(out, /拒绝落该行/)
  assert.match(out, /携带存量 sha 1 枚/, '携带要报名,不许读成"这一格没判"')
})

test('SC5c 重复副本:同一行文本 HEAD 里已存在,本次多写一份 ⇒ 按携带处理,不判', (t) => {
  const { dir } = makeRepo(t)
  seed(dir, `${HEAD1}- 登记:落地 ${SHA_BAD}\n`)
  writeFileSync(
    join(dir, 'PROJECT_PLAN.md'),
    `${HEAD1}- 登记:落地 ${SHA_BAD}\n- 登记:落地 ${SHA_BAD}\n`,
  )
  const r = runSafe(dir, { files: ['PROJECT_PLAN.md'] })
  const out = outputOf(r)
  assert.equal(r.status, 0, `重复副本不该判红:\n${out}`)
  assert.match(out, /按重复副本处理,不回判/, '这一格必须是"报了名的携带",不是"什么都没判"')
})

test('SC6 应急通道逐 token 且必须带原因:无原因照旧拦,带原因放行并打留痕', (t) => {
  const { dir } = makeRepo(t)
  seed(dir, HEAD1)
  const dirty = `${HEAD1}- 登记:提交 \`${SHA_BAD}\` 那枚落地\n`
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), dirty)
  const bare = runSafe(dir, { files: ['PROJECT_PLAN.md'], env: { LIVE_SHA_ALLOW: SHA_BAD } })
  assert.equal(bare.status, 1, `无原因的 LIVE_SHA_ALLOW 不得放行:\n${outputOf(bare)}`)
  const why = runSafe(dir, {
    files: ['PROJECT_PLAN.md'],
    env: { LIVE_SHA_ALLOW: `${SHA_BAD}=外部仓 revision,非本机 commit` },
  })
  const out = outputOf(why)
  assert.equal(why.status, 0, `带原因应放行:\n${out}`)
  assert.match(out, /取值放行留痕\(G-1079146 应急通道 LIVE_SHA_ALLOW\)/, '放行必须留痕')
  assert.match(out, /外部仓 revision/)
})

test('SC7 形状档只有权威门那一份:全数字串不探不拦(两处各写一遍的话这一条必红)', (t) => {
  const { dir } = makeRepo(t)
  seed(dir, HEAD1)
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `${HEAD1}- 窗口 ${SHA_SHAPE_OUT} 的读数\n`)
  const r = runSafe(dir, { files: ['PROJECT_PLAN.md'] })
  const out = outputOf(r)
  assert.equal(r.status, 0, out)
  assert.doesNotMatch(out, /拒绝落该行/)
  assert.doesNotMatch(out, /取值:/, '形状被权威门摘掉 ⇒ 零探测零输出,本器没有第二条形状规则')
})

test('SC10 行差集超闸 ⇒ 未判定放行并报名,而不是把一次提交拖成挂死', (t) => {
  const { dir } = makeRepo(t)
  // 纯追加 ⇒ 不撞 3e;"新增行只多不少"也把差集干净地推到闸之上(5200 行新增 > 常量闸 5000)。
  const base = Array.from({ length: 40 }, (_, i) => `- 存量登记 ${i}`)
  const fresh = Array.from({ length: 5200 }, (_, i) => `- 登记 ${i}:落地 ${SHA_BAD}`)
  seed(dir, `${base.join('\n')}\n`)
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `${[...base, ...fresh].join('\n')}\n`)
  const r = runSafe(dir, { files: ['PROJECT_PLAN.md'] })
  const out = outputOf(r)
  assert.equal(r.status, 0, `超闸必须放行而不是判红:\n${out.slice(0, 900)}`)
  assert.match(out, /取值未判定/)
  assert.match(out, /> 闸 5000/, '闸命中要说清是哪个闸、量到多少行')
  assert.doesNotMatch(out, /拒绝落该行/)
})

test('SC10b 成对对照:同一构造只是不过闸 ⇒ 必须判红(证明 SC10 放行的是"闸",不是别的东西在兜)', (t) => {
  const { dir } = makeRepo(t)
  // 与 SC10 同一构造、同一个 token、同一种纯追加,只有新增行数不过闸(200 < 5000)。
  const base = Array.from({ length: 40 }, (_, i) => `- 存量登记 ${i}`)
  const fresh = Array.from({ length: 200 }, (_, i) => `- 登记 ${i}:落地 ${SHA_BAD}`)
  seed(dir, `${base.join('\n')}\n`)
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `${[...base, ...fresh].join('\n')}\n`)
  const r = runSafe(dir, { files: ['PROJECT_PLAN.md'] })
  const out = outputOf(r)
  assert.equal(
    r.status,
    1,
    `不过闸时同一构造必须判红,实得 ${r.status}:\n${out.slice(0, 900)}`,
  )
  assert.match(out, /拒绝落该行/)
  assert.doesNotMatch(out, /取值未判定/)
})

test('SC8 源码锁(判据只有一份):取值必须 import live-doc-edit,行差必须走 lib,不得自抄正则/自拼派生', () => {
  const src = readFileSync(join(SCRIPTS, 'safe-commit.mjs'), 'utf8')
  assert.match(src, /from '\.\/live-doc-edit\.mjs'/, '不从 live-doc-edit 取判据 ⇒ 两份必然漂开(§22c)')
  const imp = src.match(/import\s*\{([\s\S]*?)\}\s*from '\.\/live-doc-edit\.mjs'/)
  assert.ok(imp, 'live-doc-edit 的具名 import 块整块不见')
  for (const fn of [
    'judgeNewLineShas',
    'makeShaProber',
    'parseShaAllow',
    'rewriteEntryOf',
    'shaGateReport',
  ])
    assert.ok(imp[1].includes(fn), `具名 import 里少了 ${fn}(缺一个就是又抄一份的预付款)`)
  // 差集与行多重集只许有一份:门 84 / object-space-land 用的就是这两个出口。
  assert.match(src, /lineDeltaMaps\(/)
  assert.match(src, /tallyLines\(/)
  assert.match(src, /from '\.\/lib\/stale-content-analysis\.mjs'/)
  // 反向锁①:本器内不得出现"自己数 hex 位"的抽取式(与 live-doc-edit 的 SH13 同一条形状)。
  assert.doesNotMatch(src, /\/\^?\[0-9a-f\]\{7,/, '出现自建 [0-9a-f]{7,…} ⇒ 与权威门各写一遍')
  // 反向锁②:git 派生走层,不自拼 execFileSync(本机漏 stdio 是稳定 EBUSY)。
  assert.match(src, /import\s*\{\s*gitRaw\s*\}\s*from '\.\/lib\/face-reader\.mjs'/)
  assert.doesNotMatch(src, /execFileSync\([\s\S]{0,40}rev-parse/, '自拼派生 ⇒ 丢掉层的 stdio/timeout 纪律')
})

test('SC9 既有行为未被改写:5 步法、活文档对账措辞、归因链与 --no-verify 路径都逐字还在', () => {
  const src = readFileSync(join(SCRIPTS, 'safe-commit.mjs'), 'utf8')
  // Step 1–5 的日志锚点一个都不许少(新增一步不许顺手改掉既有那五步)。
  for (const s of ['Step 0/5', 'Step 1/5', 'Step 2/5', 'Step 3/5', 'Step 4/5', 'Step 5/5'])
    assert.ok(src.includes(s), `既有档位 ${s} 的日志锚点被改掉了`)
  assert.match(src, /git reset HEAD/, '5 步法第 1 步不许动')
  assert.match(src, /gitStagedPaths/, '第 3 步的校验口径不许动')
  assert.match(src, /classifyHookFailure/, '归因链那条铰链不许被顺手摘')
  assert.match(src, /decideWithSelfRunBatch/, '归因链的自跑分支不许被顺手摘')
  assert.match(src, /已跳过活文档对账\(IHUI_SKIP_LIVE_DOC_CHECK=1\)/, '3e 原措辞逐字未改')
  assert.match(src, /--no-verify/, '--no-verify 应急路径不许被删')
  assert.match(src, /process\.on\('exit'/, 'git 写锁的退出释放不许被摘')
})

test('SC11 闭包完整:取值判据与共用层都在被拷进临时仓的那一跳里(少一跳就是 ERR_MODULE_NOT_FOUND 冒充判据红)', (t) => {
  const { dir, copied } = makeRepo(t)
  for (const rel of [
    'safe-commit.mjs',
    'live-doc-edit.mjs',
    'lib/face-reader.mjs',
    'lib/stale-content-analysis.mjs',
  ])
    assert.ok(copied.includes(rel), `推导出的闭包里没 ${rel},实拷:${copied.join(' ')}`)
  assert.ok(existsSync(join(dir, 'scripts', 'git-lock.mjs')), '按路径 spawn 的 git-lock 不在位')
  assert.ok(
    existsSync(join(dir, 'scripts', 'merge-live-doc.mjs')),
    '按路径 spawn 的 merge-live-doc 不在位',
  )
})

// ── G-1118437:Step 5 之后写的 sha 绑定正证,必须真能被统计器读成 normal ──
// 为什么必须在**临时仓里真跑一次 safe-commit**:这条证据的整条链是"落地器写下 → 统计器读回",
// 任何一环用注入代替都会变成"测我自己写的那段话"。统计侧的构造面在
// `plan-bypass-ledger-report.mjs --self-test`(四臂:绑定/无 gatesRan/缺 sha/新旧条件对照)。
test('G-1118437 一次真实的 safe-commit 提交 ⇒ 留痕含 gates-then-commit 且统计器按 sha 判 normal', async (t) => {
  const { indexLedger, classifyAll } = await import('../plan-bypass-ledger-report.mjs')
  const { COMMITTED_KIND } = await import('../lib/commit-attestation.mjs')
  const { dir } = makeRepo(t)
  writeFileSync(join(dir, 'a.txt'), 'seed\n')
  git(dir, 'add', '--', 'a.txt')
  git(dir, 'commit', '-qm', 'base')
  writeFileSync(join(dir, 'b.txt'), 'change\n')
  git(dir, 'add', '--', 'b.txt')
  const ran = runSafe(dir, { files: ['b.txt'], message: 'test: landed proof' })
  assert.equal(ran.status, 0, `safe-commit 在夹具里失败了:\n${ran.stdout}\n${ran.stderr}`)
  const sha = git(dir, 'rev-parse', 'HEAD').trim()
  const ledgerFile = join(dir, '.ihui-agent', 'state', 'safe-commit-attestation.jsonl')
  assert.ok(existsSync(ledgerFile), 'Step 5 判干净之后必须落一条正证留痕(没落 = 统计器永远读不到)')
  const recs = readFileSync(ledgerFile, 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l))
  const landed = recs.find((r) => r.kind === COMMITTED_KIND)
  assert.ok(landed, `留痕里找不到 ${COMMITTED_KIND} 一族:${recs.map((r) => r.kind).join(',')}`)
  assert.equal(landed.landedSha, sha, '正证必须绑到**这一枚**提交,不是别的')
  assert.equal(landed.gatesRan, true, '钩子没跳过 ⇒ gatesRan 必须为 true')
  assert.deepEqual(landed.commitFiles, ['b.txt'])
  const commits = [{ sha, parent: git(dir, 'rev-parse', 'HEAD~1').trim(), ms: Date.now(), day: 'fixture', files: ['b.txt'] }]
  const r = classifyAll({ commits, index: indexLedger(recs), rounds: [], ledgerReadable: true })
  assert.equal(r.rows[0].normal, 1, `统计器没把这枚读成 normal:${JSON.stringify(r.detail)}`)
  assert.equal(r.rows[0].unknown, 0)
})


test('收尾顺序锁:prune 必须排在 rmScratch 之后(旧形态每轮提交永久留一条 prunable worktree)', () => {
  const src = readFileSync(join(HERE, '..', 'safe-commit.mjs'), 'utf8')
  const prunes = [...src.matchAll(/gitStep\(\['worktree', 'prune'\]/g)].map((m) => m.index)
  assert.ok(prunes.length >= 3, `prune 调用点少于预期(${prunes.length}),锁失效`)
  for (const i of prunes) {
    const before = src.slice(Math.max(0, i - 600), i)
    assert.match(
      before,
      /rmScratch\(scratch\)/,
      `prune@${i} 之前必须先删目录:目录还在时 prune 结构上清不到,目录一删条目就变 prunable 且再无人处理 ⇒ 每轮提交永久多一条,编辑器 SCM 把它们当独立仓合计成 10K/20K 徽标`,
    )
  }
  assert.equal(
    /gitStep\(\['worktree', 'prune'\][^\n]*\n\s*try \{\n\s*rmScratch\(/.test(src),
    false,
    '旧形态(prune → rmScratch)不得回来',
  )
})

// ── SC11 / SC12:AI 代码归属 notes 的「主体缺失必须出声」(2026-11-01 逆向复现超越轮补) ──
// 立因(一手现场,不是假想):读侧尺 `ai-authorship-report.mjs` 首次量真仓 ⇒
// `refs/notes/ihui-ai` 这个 ref **根本不存在**,全史 43246 枚 0 带记录。
// 而写侧在 safe-commit 里是接了的(`import { recordForCommit }`),问题是那段写作
// `if (authorshipSession) { … }` 无 else —— 主体缺失时整段静默跳过,连一行 warn 都不出。
// 于是「接线在」与「一枚都没落」在日志上长得一模一样。这正是 §0.3 禁的"没判悄悄变成像是没参与"。
// 两条用例合起来才成立:SCA1 钉出声,SCA2 钉「给了主体就真能落笔」—— 只钉一头都能被绕过去。
// 编号用 SCA 前缀而非 SC:本文件已有 SC11「闭包完整」占位,同号异题会让引用指错(§0 一号一行同义纪律)。

test('SCA1 会话主体缺失 ⇒ 提交照旧放行,但归属未落笔必须出声(fail-open 不等于静默)', (t) => {
  const { dir } = makeRepo(t)
  seed(dir, HEAD1)
  writeFileSync(join(dir, 'x.md'), 'fixture content\n')
  const r = runSafe(dir, {
    files: ['x.md'],
    env: { IHUI_AGENT_SESSION_ID: '', AGENT_NAME: '' },
  })
  const out = outputOf(r)
  assert.equal(r.status, 0, `fail-open:主体缺失不得影响提交,实得 ${r.status}:\n${out}`)
  assert.match(out, /AI 归属 notes 未落笔/, '必须出声说"没落笔"')
  assert.match(out, /IHUI_AGENT_SESSION_ID/, '必须点名该传哪个 env,不能只说"缺失"')
  assert.match(out, /不得读成「人类写的」/, '必须把读侧口径写进去(§0.3)')
  assert.equal(git(dir, 'for-each-ref', 'refs/notes/').trim(), '', '无主体时确实一条 notes 都没造')
})

test('SCA2 给了会话主体 ⇒ notes 真落到 refs/notes/ 且报告口径记为已写入(与 SCA1 只差那一个 env)', (t) => {
  const { dir } = makeRepo(t)
  seed(dir, HEAD1)
  writeFileSync(join(dir, 'x.md'), 'fixture content\n')
  const r = runSafe(dir, {
    files: ['x.md'],
    env: { IHUI_AGENT_SESSION_ID: 'fixture-sess-SC12', AGENT_NAME: '' },
  })
  const out = outputOf(r)
  assert.equal(r.status, 0, `应放行,实得 ${r.status}:\n${out}`)
  assert.match(out, /AI 归属 notes 已写入|AI 归属 notes 未判定/, '两条出路之一,不许静默')
  const refs = git(dir, 'for-each-ref', 'refs/notes/').trim()
  assert.notEqual(refs, '', '给了主体就必须真落 notes —— 接线在而零落笔正是本票要杀的那一型')
  assert.match(
    git(dir, 'notes', '--ref=' + (refs.split(/\s+/).pop() || 'refs/notes/ihui-ai'), 'list', 'HEAD'),
    /^[0-9a-f]{40}/,
    'notes 必须挂在本枚 commit 上可按对象名读出',
  )
})

// ── HRS1–HRS5:堵掉 not-ours 静默追加 --no-verify 的兜底(2026-11-02,事故 5c8aec3653) ──
// 立因(一手现场):那枚提交 32/32 守门自跑全绿、blockingFailed=0,但钩子路径**从未跑过**,
// safe-commit 自己补了 `--no-verify`,台账记 gatesRan:false/hookSkipped:true —— 历史里只留下
// 一枚看不出异常的提交。新策略:not-ours ⇒ 退避重试**带钩子**的普通提交;耗尽 ⇒ 非零退出。
//
// 判据纪律:断言必须抓"命令行里到底有没有 --no-verify"。这里用 `GIT_TRACE2_EVENT`:
// git 每个进程的 trace2 `start` 事件都把**顶层 argv 原文**写进文件(实测含 `--no-verify`),
// 所以不是靠退出码/日志猜,而是逐条读真实发令。`HRS4` 是正控:逃生口那一枚**必须**读到
// `--no-verify`,否则 HRS1–HRS3 的"没读到"可能只是探针本身不灵。

/**
 * 在夹具仓装一枚可**按次数失败**的 pre-commit(输出一轮完整的守门汇总 + 批外步骤)。
 * `failText` 覆盖失败正文的形态(用于"钩子判 mine"那一臂:没有汇总块、内容错点名本次文件)。
 */
function installFixturePreCommit(dir, { files, failTimes, lockAfterFail = false, failText = null }) {
  mkdirSync(join(dir, '.husky'), { recursive: true })
  const echo = [`staged 文件清单(${files.length} 个):`, ...files.map((f) => `- ${f}`)]
  const failLines = failText
    ? String(failText).split(/\r?\n/)
    : [
        ...echo,
        '🛡️  守门脚本批量检查汇总',
        '  总检查数: 32(已执行 32)',
        '🚫 0 道 blocking 门失败 —— 本轮已跑完全部 32 项:',
        '❌ Pre-commit 守门失败,提交已阻止',
        "fatal: Unable to create '.git/index.lock': File exists. Another git process seems to be running",
      ]
  const body = [
    '#!/bin/sh',
    'n=0',
    '[ -f .ihui-hook-calls ] && n=$(cat .ihui-hook-calls)',
    'n=$((n + 1))',
    "printf '%s\\n' \"$n\" > .ihui-hook-calls",
    failText ? 'if true; then' : `if [ "$n" -le ${failTimes} ]; then`,
    "  cat >&2 <<'EOF'",
    ...failLines,
    'EOF',
    ...(lockAfterFail ? ['  : > "$(git rev-parse --git-dir)/index.lock"'] : []),
    '  exit 1',
    'fi',
    'exit 0',
    '',
  ].join('\n')
  writeFileSync(join(dir, '.husky', 'pre-commit'), body)
}

const hookCallCount = (dir) => {
  const p = join(dir, '.ihui-hook-calls')
  return existsSync(p) ? Number(readFileSync(p, 'utf8').trim() || 0) : 0
}

/** 逐条读 `git commit` 的**真实 argv**(trace2 start 事件);失败/读不到一律返回 []。 */
function commitArgvs(traceFile) {
  if (!existsSync(traceFile)) return []
  const rows = []
  for (const line of readFileSync(traceFile, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue
    let o
    try {
      o = JSON.parse(line)
    } catch {
      continue
    }
    if (o?.event !== 'start' || !Array.isArray(o.argv) || !o.argv.includes('commit')) continue
    rows.push(o.argv.join(' '))
  }
  return rows
}

/** 读夹具仓的台账(没有文件 ⇒ 空数组;坏行跳过 —— 判据只关心有值的那些)。 */
function ledgerRecords(dir) {
  const p = join(dir, '.ihui-agent', 'state', 'safe-commit-attestation.jsonl')
  if (!existsSync(p)) return []
  const out = []
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      out.push(JSON.parse(line))
    } catch {
      /* 坏行不影响本判据 */
    }
  }
  return out
}

const landedRecords = (dir) => ledgerRecords(dir).filter((r) => r.kind === 'gates-then-commit')

test('HRS1 正常路径:钩子真跑、提交落地,且真实发令里没有任何 --no-verify', (t) => {
  const { dir } = makeRepo(t)
  seed(dir, HEAD1)
  const trace = join(dir, 'trace-hrs1.json')
  installFixturePreCommit(dir, { files: ['notes.txt'], failTimes: 0 })
  writeFileSync(join(dir, 'notes.txt'), 'fixture\n')
  const r = runSafe(dir, { files: ['notes.txt'], env: { GIT_TRACE2_EVENT: trace } })
  const out = outputOf(r)
  assert.equal(r.status, 0, `正常路径必须放行,实得 ${r.status}:\n${out}`)
  assert.equal(hookCallCount(dir), 1, '钩子必须真跑且只跑一次(没跑 = 探针失败;多跑 = 进了重试)')
  const argvs = commitArgvs(trace)
  assert.ok(argvs.length >= 1, `trace2 里没读到 commit 发令,探针失效:\n${readFileSync(trace, 'utf8').slice(0, 400)}`)
  assert.deepEqual(
    argvs.filter((a) => a.includes('--no-verify')),
    [],
    `正常路径不许出现 --no-verify,实得发令:\n${argvs.join('\n')}`,
  )
  assert.doesNotMatch(out, /退避重试/, '正常路径不该进 not-ours 退避段')
  const landed = landedRecords(dir).at(-1)
  assert.ok(landed, '正常落地必须留一条 gates-then-commit')
  assert.equal(landed.gatesRan, true)
  assert.equal(landed.hookSkipped, false)
})

test('HRS2 not-ours 退避重试后拿到钩子:第二次真跑钩子并落地,全程无 --no-verify', (t) => {
  const { dir } = makeRepo(t)
  seed(dir, HEAD1)
  const trace = join(dir, 'trace-hrs2.json')
  installFixturePreCommit(dir, { files: ['notes.txt'], failTimes: 1 })
  writeFileSync(join(dir, 'notes.txt'), 'fixture v2\n')
  const r = runSafe(dir, {
    files: ['notes.txt'],
    env: { GIT_TRACE2_EVENT: trace, IHUI_SAFE_COMMIT_HOOK_RETRIES: '2', IHUI_SAFE_COMMIT_HOOK_RETRY_BASE_MS: '80' },
  })
  const out = outputOf(r)
  assert.equal(r.status, 0, `重试后应拿到钩子并落地,实得 ${r.status}:\n${out}`)
  assert.match(out, /钩子退避重试 1\/2 拿到了钩子/, '必须点名"第几次重试拿到了钩子"')
  assert.equal(hookCallCount(dir), 2, '第一次失败 + 第二次成功 ⇒ 钩子实跑 2 次')
  const argvs = commitArgvs(trace)
  assert.ok(argvs.length >= 2, `应至少 2 次 commit 发令(实测 ${argvs.length})`)
  assert.deepEqual(
    argvs.filter((a) => a.includes('--no-verify')),
    [],
    `not-ours 重试路径不许追加 --no-verify:\n${argvs.join('\n')}`,
  )
  const landed = landedRecords(dir).at(-1)
  assert.ok(landed, '重试成功后必须留一条 gates-then-commit')
  assert.equal(landed.gatesRan, true, '钩子真跑过 ⇒ gatesRan 必须是 true')
  assert.equal(landed.hookSkipped, false)
})

test('HRS3 重试耗尽:非零退出、点名锁与持锁方,且真实发令里没有 --no-verify', (t) => {
  const { dir } = makeRepo(t)
  const before = seed(dir, HEAD1)
  const trace = join(dir, 'trace-hrs3.json')
  // 第一次提交:钩子跑起来并就红(归因 not-ours),同时留下一把持久的 index.lock
  // ⇒ 后续重试在"重新暂存"这一步就撞真锁,拿不到钩子,直到耗尽。
  installFixturePreCommit(dir, { files: ['notes.txt'], failTimes: 1, lockAfterFail: true })
  writeFileSync(join(dir, 'notes.txt'), 'fixture v3\n')
  const r = runSafe(dir, {
    files: ['notes.txt'],
    env: {
      GIT_TRACE2_EVENT: trace,
      // 耗尽用例要的是"外层重试预算",不是 stageDeclared 内部那 10×3s 的锁等待 ⇒ 关掉内层等待。
      IHUI_SAFE_COMMIT_LOCK_RETRIES: '0',
      IHUI_SAFE_COMMIT_HOOK_RETRIES: '2',
      IHUI_SAFE_COMMIT_HOOK_RETRY_BASE_MS: '60',
    },
  })
  const out = outputOf(r)
  assert.notEqual(r.status, 0, `耗尽必须非零退出:\n${out}`)
  assert.match(out, /退避重试 2 次仍未拿到钩子/, '必须点名"重试耗尽仍拿不到钩子"')
  assert.match(out, /拒绝追加 --no-verify/, '必须写明拒绝跳门')
  assert.match(out, /index\.lock/, '必须点名是哪把锁')
  assert.match(out, /git-lock\.mjs check/, '必须给出"谁持锁"的现读命令')
  assert.equal(hookCallCount(dir), 1, '重试一次钩子都没跑到(拿不到钩子才是耗尽的前提)')
  assert.equal(git(dir, 'rev-parse', 'HEAD'), before, '耗尽不许留下提交')
  const argvs = commitArgvs(trace)
  assert.ok(argvs.length >= 1, '至少读到第一次 commit 发令')
  assert.deepEqual(
    argvs.filter((a) => a.includes('--no-verify')),
    [],
    `耗尽路径绝不许追加 --no-verify,实得发令:\n${argvs.join('\n')}`,
  )
  assert.doesNotMatch(out, /已用 --no-verify 落地/, '耗尽路径不许出现跳门落地的日志')
  assert.equal(landedRecords(dir).length, 0, '没有落地就不该有 gates-then-commit')
})

test('HRS4 显式逃生口 IHUI_SAFE_COMMIT_ALLOW_SKIP_HOOKS=1:仅在显式设置时生效,且台账带原因', (t) => {
  const { dir } = makeRepo(t)
  seed(dir, HEAD1)
  const trace = join(dir, 'trace-hrs4.json')
  installFixturePreCommit(dir, { files: ['notes.txt'], failTimes: 99 })
  writeFileSync(join(dir, 'notes.txt'), 'fixture v4\n')
  const r = runSafe(dir, {
    files: ['notes.txt'],
    env: { GIT_TRACE2_EVENT: trace, IHUI_SAFE_COMMIT_ALLOW_SKIP_HOOKS: '1' },
  })
  const out = outputOf(r)
  assert.equal(r.status, 0, `显式逃生口应放行,实得 ${r.status}:\n${out}`)
  assert.match(out, /IHUI_SAFE_COMMIT_ALLOW_SKIP_HOOKS=1/, '必须点名是哪个 env 放行的')
  assert.equal(hookCallCount(dir), 1, '逃生口不重试 ⇒ 钩子只被尝试 1 次')
  // 正控:这一枚**必须**读到 --no-verify —— 否则上面几条"没读到"可能只是探针坏了。
  const argvs = commitArgvs(trace)
  assert.ok(
    argvs.some((a) => a.includes('--no-verify')),
    `逃生口应显式带 --no-verify,实得发令:\n${argvs.join('\n')}`,
  )
  const landed = landedRecords(dir).at(-1)
  assert.ok(landed, '逃生口落地也必须留一条 gates-then-commit')
  assert.equal(landed.hookSkipped, true)
  assert.equal(landed.gatesRan, false)
  assert.match(String(landed.hookSkipReason || ''), /IHUI_SAFE_COMMIT_ALLOW_SKIP_HOOKS=1/, '台账必须记原因')
})

test('HRS5 正常提交不被误归因:钩子判 mine 时当场拒绝,不进 not-ours 退避段,也不许 --no-verify', (t) => {
  // 立因(2026-11-02 机主要求):not-ours 是按并发特征判的,改动只该影响"真 not-ours"。
  // 这一臂是**误伤方向的端到端对照**:钩子没有汇总块、内容错点名了本次声明的文件 ⇒ 判据给
  // mine ⇒ 立刻 exit 1。若改动把 mine 也送进退避重试,本条的"钩子只跑 1 次 / 无退避日志"必红。
  const { dir } = makeRepo(t)
  const before = seed(dir, HEAD1)
  const trace = join(dir, 'trace-hrs5.json')
  installFixturePreCommit(dir, {
    files: ['notes.txt'],
    failTimes: 99,
    failText: [
      'node scripts/check-eslint.mjs',
      'notes.txt',
      "  1:1  error  'x' is not defined  no-undef",
      '❌ Pre-commit 守门失败,提交已阻止',
    ].join('\n'),
  })
  writeFileSync(join(dir, 'notes.txt'), 'fixture v5\n')
  const r = runSafe(dir, {
    files: ['notes.txt'],
    env: {
      GIT_TRACE2_EVENT: trace,
      // 万一判据误判成 not-ours,这两个值让退避段立刻跑完并让断言先撞上 —— 不许靠长等待掩盖。
      IHUI_SAFE_COMMIT_HOOK_RETRIES: '1',
      IHUI_SAFE_COMMIT_HOOK_RETRY_BASE_MS: '40',
      IHUI_SAFE_COMMIT_LOCK_RETRIES: '0',
    },
  })
  const out = outputOf(r)
  assert.notEqual(r.status, 0, `mine 必须非零退出:\n${out}`)
  assert.match(out, /拒绝 --no-verify/, 'mine 的出口措辞必须保留')
  assert.equal(hookCallCount(dir), 1, 'mine 不进退避重试 ⇒ 钩子只被尝试 1 次')
  assert.doesNotMatch(out, /退避重试/, 'mine 不得进 not-ours 退避段(那会把本任务自己的红拖成等待)')
  const argvs = commitArgvs(trace)
  assert.deepEqual(
    argvs.filter((a) => a.includes('--no-verify')),
    [],
    `mine 路径绝不许出现 --no-verify,实得发令:\n${argvs.join('\n')}`,
  )
  assert.equal(git(dir, 'rev-parse', 'HEAD'), before, 'mine 不许留下提交')
  assert.equal(landedRecords(dir).length, 0, '没有落地就不该有 gates-then-commit')
})
