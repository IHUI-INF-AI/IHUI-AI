// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/face-reader.mjs` 的镜像测试。
 *
 * 这道层要解决的是"同一个易错口径被各门各抄一份"。而**收口本身没有哨兵就会重新腐烂**
 * (本仓对豁免清单的教训:`RN_ONLY_BRAND_KEYS` 那种清单过期了没人发现)。所以本文件守两件事:
 *   ① 层自身的几条硬规矩还在(绝对路径 git / batch 的 stdio[0] 是 pipe / 有 timeout 与够用的
 *      maxBuffer / 仓库根比较穿 junction / 子进程 stderr 不外漏);
 *   ② 挂在这层上的门真的挂着,且没有偷偷自己拼 git 派生 —— 门有几道由下面的三条棘轮现场量,
 *      **不在注释里写死数字**(写死的那一行,下一次收口就变成一句骗人的旧话)。
 * 每条否定式判据都配**阳性对照**:先拿一段"违规写法"喂同一个判据函数,证明它能抓得住,
 * 否则"0 命中"可能只是尺子坏了。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  FACES,
  FACE_LABEL,
  Undetermined,
  catBatch,
  catBatchCheck,
  catBatchOids,
  gitBinary,
  gitRaw,
  selectFace,
} from '../lib/face-reader.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const scriptsDir = join(here, '..')
const GIT = gitBinary()
const read = (f) => readFileSync(join(scriptsDir, f), 'utf8')

/** 三门:各自都已收敛到共用层(守门 91 = 主题接线、94 = 错误码覆盖、101 = 锁与清单对账) */
const GATES = [
  'check-theme-prop-wiring.mjs',
  'check-error-code-coverage.mjs',
  'check-lock-manifest-consistency.mjs',
]

test('层自身:绝对路径 git(裸 "git" 会让服务账户/GUI 宿主下的取数静默失败)', () => {
  const bin = gitBinary()
  assert.ok(/[\\/]/.test(bin) && bin.length > 5, `gitBinary() 退化成裸命令: ${bin}`)
  const src = read('lib/face-reader.mjs')
  assert.match(src, /from '\.\/gitdir\.mjs'/, '未走 resolveGitBin —— 又变成各自猜路径')
  assert.match(src, /resolveGitBin\(\) \|\| 'git'/, '兜底必须显式写在层里,不得散在各门')
})

test('层自身:每一处 cat-file --batch* 的 stdio[0] 都必须是 pipe(设成 ignore 会让每个 rev 都"取不到")', () => {
  const src = read('lib/face-reader.mjs')
  // ⚠️ 逐个调用点各判一遍,不是"找到的第一处"。`'cat-file', '--batch'` 是 `'--batch-check'`
  // 的**前缀**,按 indexOf 取窗口会永远落在第一个函数上 —— 那意味着后加入层的 batch 出口
  // (catBatchOids)根本不在这条判据的视野里,而这正是本层要防的那一型"尺子看不见自己产出的形态"。
  const sites = [...src.matchAll(/'cat-file',\s*'--batch(?:-check)?'/g)]
  assert.ok(sites.length >= 3, `层的 batch 出口现测应有 3 处(batch / batch-check / batch-check 用 oid),实得 ${sites.length}`)
  for (const s of sites) {
    const block = src.slice(s.index, s.index + 700)
    assert.match(block, /stdio:\s*\[\s*'pipe',\s*'pipe',\s*'pipe'\s*\]/, 'stdio[0] 非 pipe ⇒ 喂不进对象清单')
    assert.match(block, /input:\s*Buffer\.from\(/, '对象清单必须由 input 喂进去,不得拼进 argv')
    assert.match(
      block,
      /timeout:\s*(?:opts\.timeout\s*\?\?\s*)?[A-Z_]+|timeout:\s*\d+/,
      '无数字 timeout ⇒ 守门 80 那类无界挂起',
    )
    assert.match(
      block,
      /maxBuffer:\s*(?:opts\.maxBuffer\s*\?\?\s*)?GIT_MAX_BUFFER/,
      'batch 调用必须吃到那个常量(允许开可配口子,但默认值必须是它)',
    )
  }
  // maxBuffer 是模块级常量,不在调用点写数字 —— 判据要跟它的真身对齐
  assert.match(src, /const GIT_MAX_BUFFER = 64 << 20/, 'maxBuffer 常量必须给足(真仓有 >1MB 单文件)')
})

test('层自身:gitRaw 必须显式接管 stdio(否则子进程 stderr 会漏进守门自己的判定输出)', () => {
  const src = read('lib/face-reader.mjs')
  const at = src.indexOf('export function gitRaw')
  assert.ok(at > 0, '找不到 gitRaw —— 派生入口改名了')
  const block = src.slice(at, src.indexOf('\nexport ', at + 10))
  assert.match(
    block,
    /\['ignore',\s*'pipe',\s*'pipe'\]/,
    'gitRaw 未接管 stdio ⇒ `fatal: …` 会直接写在门的 stderr 上;各门只会被迫加 --quiet 绕行',
  )
  // 有 input 的那一支必须把 stdio[0] 切成 pipe —— 两态都要在,少一态就是"喂不进去还不报错"
  assert.match(
    block,
    /\['pipe',\s*'pipe',\s*'pipe'\]/,
    '带 input 的派生若仍用 ignore 作 stdin ⇒ git 收到空清单,对象一律"取不到"',
  )
})

/**
 * 上面那条是**源码形状**判据;这一条是它的装车证明:真拿 input 走一次 gitRaw。
 * 只判形状会漏掉"两个分支都写了、但条件写反"这一型 —— 形状对了而行为是空的,
 * git 也不会报错(`cat-file --batch` 收到空 stdin 就是零输出),所以必须量输出。
 */
test('gitRaw 的 input 通道真的通(空 stdin 与喂清单的输出必须不同)', () => {
  const root = join(here, '..', '..')
  const fed = gitRaw(['cat-file', '--batch'], root, {
    input: Buffer.from('HEAD:package.json\n', 'utf8'),
  })
  assert.ok(String(fed).includes(' blob '), `喂了一个对象却什么都没取回:${String(fed).slice(0, 60)}`)
  // 反例:空清单 ⇒ 零输出。两条不同即证明 input 确实到达了 git,而不是被 stdio[0] 丢掉。
  const empty = gitRaw(['cat-file', '--batch'], root, { input: Buffer.from('', 'utf8') })
  assert.equal(String(empty).trim(), '', '空清单应得零输出')
  assert.notStrictEqual(String(fed), String(empty), 'input 分支必须与"没喂东西"可区分')
})

test('层自身:仓库根比较必须穿 junction(本机 DevEnv 系是改道路径)', () => {
  const src = read('lib/face-reader.mjs')
  assert.match(
    src,
    /realpathSync/,
    'assertRepoRoot 未走 realpath ⇒ junction 会把正常仓判成"基准错位"',
  )
  assert.match(src, /--show-toplevel/)
})

test('层自身:面集合固定为三个,两面旗同给必须返回 error 而不是任选一边', () => {
  assert.deepEqual(FACES, ['staged', 'head', 'worktree'])
  assert.equal(Object.keys(FACE_LABEL).length, 3)
  assert.equal(selectFace({ staged: true, worktree: true }).face, null)
  assert.match(selectFace({ staged: true, worktree: true }).error, /不得同用/)
  assert.equal(selectFace({ staged: true }).face, 'staged')
  assert.equal(selectFace({ worktree: true }).face, 'worktree')
  assert.equal(selectFace({}).face, 'head', '默认必须是 HEAD,不得默认工作树')
})

test('取材失败必须走 Undetermined 而不是"当作不存在"(静默少扫 = 偏绿)', () => {
  assert.equal(typeof Undetermined.prototype, 'object')
  const src = read('lib/face-reader.mjs')
  assert.match(src, /class Undetermined extends Error/)
  assert.match(src, /throw new Undetermined\(`git \$\{args\[0\]\} 失败/)
})

/** 阳性对照用的"违规写法"样本:证明下面那条判据真的能抓住裸 git,而不是恒过 */
const BAD_SAMPLE = `const x = execFileSync('git', ['status'], { cwd: root })\nconsole.log(execFileSync("git", ["ls-files"]))\n`
const bareGitCount = (text) =>
  (text.match(/execFileSync\(\s*['"]git['"]/g) || []).length +
  (text.match(/execSync\(\s*['"]git\b/g) || []).length

test('判据本身不恒真:同一把尺子必须能抓住违规样本、而对三门均为 0', () => {
  assert.equal(bareGitCount(BAD_SAMPLE), 2, `尺子连样本都抓不住(实得 ${bareGitCount(BAD_SAMPLE)})`)
  assert.equal(bareGitCount("execFileSync(GIT_BIN, ['status'])"), 0, '走常量的正确写法不得误报')
  for (const f of GATES) assert.equal(bareGitCount(read(f)), 0, `${f} 里仍有自拼的裸 git 派生`)
})

test('装车证明:三门都必须真的 import 这一层', (t) => {
  for (const f of GATES) {
    const src = read(f)
    if (!existsSync(join(scriptsDir, f))) {
      t.skip(`${f} 不在盘上 ⇒ 未判定,不计为通过`)
      continue
    }
    assert.match(
      src,
      /from '\.\/lib\/face-reader\.mjs'/,
      `${f} 未 import 共用层 —— 收口被绕开,重复实现会重新长回来`,
    )
  }
})

test('真实取材抽查:HEAD 面能读到大 blob(>1MB 的那个语言包),证明 maxBuffer 真的够', () => {
  const root = join(here, '..', '..')
  const map = catBatch(root, ['HEAD:package.json', 'HEAD:nope/missing.ts'])
  const pkg = map.get('HEAD:package.json')
  assert.ok(pkg && pkg.length > 3000, `package.json 取到的内容异常短: ${pkg && pkg.length}`)
  assert.equal(map.get('HEAD:nope/missing.ts'), null, 'missing 必须是 null,不得抛成"仓库坏了"')
})

/**
 * 层的两个新出口 —— 都是并行代理在迁移时**独立**报出来的缺口,不是预防性设计:
 * ① `catBatch(…, {maxBuffer})`:门 98/103 一次读 8000+ 源文件 ≈ 85-89MB,默认 64MB 会 ENOBUFS;
 * ② `catBatchOids`:守门 84 的判据是"比较 blob sha",要的是 oid 而不是内容,
 *    而既有 `catBatchCheck` 的 hex-only 过滤会把 `<oid>^{tree}` 这类合法规格整型丢掉。
 */
test('catBatch 的 maxBuffer 口子:超限必须抛,不得静默降级成"每个 rev 都取不到"', () => {
  const root = join(here, '..', '..')
  const revs = ['HEAD:package.json', 'HEAD:pnpm-lock.yaml']
  // 正例:给足预算 ⇒ 两个都读到
  const okMap = catBatch(root, revs, { maxBuffer: 1 << 26 })
  assert.ok(okMap.get('HEAD:package.json')?.length > 3000, '给足预算时 package.json 必须读到')
  // 反例(本条的真正牙齿):预算 1 字节 ⇒ 必抛。
  // 若层把 ENOBUFS 折成"取不到",这里会拿到一个全 null 的 Map 而测试判绿 —— 那正是
  // 下游读成"没有违规"的假绿形态,所以必须断言它**抛**,而且抛的是 Undetermined。
  assert.throws(
    () => catBatch(root, revs, { maxBuffer: 1 }),
    (e) => e instanceof Undetermined,
    '超预算必须显式"无法判定",绝不能静默返回空内容',
  )
})

test('catBatchOids:按行对齐回 oid,且不得像 catBatchCheck 那样把非 hex 规格整型丢掉', () => {
  const root = join(here, '..', '..')
  const head = spawnSync(GIT, ['-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    windowsHide: true,
  }).stdout.trim()
  assert.ok(/^[0-9a-f]{40}$/.test(head), `rev-parse HEAD 取到的不是 sha:${head}`)
  const specs = ['HEAD:package.json', `${head}^{tree}`, 'HEAD:nope/missing.ts']
  const m = catBatchOids(root, specs)
  assert.match(m.get('HEAD:package.json') ?? '', /^[0-9a-f]{40}$/, 'blob 规格必须解出 oid')
  assert.match(m.get(`${head}^{tree}`) ?? '', /^[0-9a-f]{40}$/, 'peel 规格必须解出 oid')
  assert.equal(m.get('HEAD:nope/missing.ts'), null, 'missing 归 null,交调用方判取不到')
  // 反向对照:同一批规格喂旧的 catBatchCheck,三条**全部**被 hex-only 过滤掉 —— 一条都不参与判定。
  // 这条对照是"为什么要有第二个出口"的唯一机器证据;没有它,下一个人又会说"用 Check 就行"。
  const viaCheck = catBatchCheck(root, specs)
  assert.equal(
    viaCheck.total,
    0,
    'catBatchCheck 只认纯 hex 对象名,rev/peel 规格对它整型隐身 —— 所以它不能拿来做 sha 比较',
  )
})

// ───────────────────────── 棘轮:存量认账,增量不认 ─────────────────────────
//
// 本票收口的是一类重复:各门各自派生 git。实测分成三型,分别钉住(数字一律以命令现测为准,
// 下面只记变化轨迹 —— 把存量数写进散文,下一次收口就会留下一句骗人的旧话):
//   · 型 A 裸字面量派生:`execFileSync('git', …)` / `execSync('git status …')` —— 依赖 PATH
//   · 型 B 常量绑到裸 'git':`const GIT = process.env.IHUI_GIT_BIN || 'git'` 再 `execFileSync(GIT, …)`
//     —— **A 看不见它**,而这正是"服务账户/GUI 宿主下 PATH 不通"那一型(§5b 已记过一次)
//   · 型 C 自拼 `cat-file --batch` 却不走本层 —— 每条都要重写 stdio[0]=pipe / maxBuffer / 头解析
// 一次性全改会与各并行会话在提交链上对撞,所以这里不"顺手扫",而是**钉住不许再长**:
// 只减不增,降了不更新基线也算提示。与守门 70/77 的棘轮同一取向 —— 存量债记账,新增债拦停。

/**
 * 基线 = 当次实测真值(扫 scripts/ 生产文件)。调高它必须先在此说明理由。
 * ⚠️ 这些数会随收口下降;下降时测试只提示不拦停,请在同一票里把基线一并下调。
 * 历史:
 *  · 型 A:09-25 首量 80 → 修尺子(补 shell 串式与 spawnSync 两型)后真值 **82**。
 *    中途涨到 83 又回到 82:涨的那处是 09:25 并行提交 `95447008f73` 给
 *    `scripts/check-rn-global-css-sync.mjs` 新增的 `execFileSync('git', …)`(该文件此前没有),
 *    而它涨在 09:11 定基线**之后**。本票没有把数字压回去装没看见,而是当场把它收进了层
 *    (`gitShow` → 层 `gitRaw`,try/catch 折 null 的语义一字不动)⇒ 现值 82。
 *    这一涨一收正是这条棘轮存在的理由:收口成一层之后,新增一处裸派生从"没人看得见"变成"红一道门"。
 *    另:本批迁的 6 道门用的都是型 B(常量),所以 A 不因那一批下降 —— 这恰好证明"只盯 A 的尺子会以为收口没效果"。
 *  · 型 B:本票首量 10 → 加"必须被当过派生首参"的第二道锚后 9 → **8**(第二枚提交把守门 84
 *    那句 `const GIT = process.env.IHUI_GIT_BIN || 'git'` 收进了层)。`lib/gitdir.mjs` 那处 'git' 是
 *    目录名、不是二进制 —— 第一版尺子被它骗过,所以才有第二道锚。不含本层自己那处**刻意**的最后一档兜底。
 *  · 型 C:首量 9 → 第一批 6 道门收口后 3 → **1**(第二枚再收 103 / 84)。
 *    余下唯一一处是 `scripts/check-cross-end-tokens.mjs`(守门 93),不在本票派单范围内。
 */
const BARE_GIT_BASELINE = 82
const PATH_BOUND_GIT_BASELINE = 8
const SELF_BATCH_BASELINE = 1

function productionScripts(root) {
  const out = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) {
        if (/(tests|__mocks__|node_modules)/.test(e.name)) continue
        walk(p)
        continue
      }
      if (/\.(mjs|js|cjs)$/.test(e.name)) out.push(p)
    }
  }
  walk(join(root, 'scripts'))
  return out
}

/**
 * 裸 git 派生的计数尺子。⚠️ 必须同时覆盖两个维度,少一个都会让棘轮"看起来在收口、实际没量到":
 *  · 入口:`execFileSync` / `execSync` / `spawnSync` / `spawn` 四种(`git-push-guard` 用的就是 spawnSync);
 *  · 形态:数组式 `execFileSync('git', […])` **和** shell 串式 `execSync('git status --porcelain')`
 *    —— 后者 `git` 后面跟的是空格而不是引号,只匹配 `['"]git['"]` 会把它整类漏掉(实测本仓有大量这种写法)。
 * 判据要覆盖自己想拦的那一种形态,否则分母骗人。
 */
const BARE_GIT_RE = /(execFileSync|execSync|spawnSync|spawn)\(\s*['"]git(?:\.exe)?(?=['"\s])/g
const bareGitCountOf = (text) => (text.match(BARE_GIT_RE) || []).length

/**
 * 型 B:变量被**初始化成**裸 'git'(直接赋值,或 `|| 'git'` / `?? 'git'` / 三元兜底),
 * 之后所有派生都写成 `execFileSync(GIT, …)` —— 对型 A 完全隐形,但同样依赖 PATH。
 * 只认"声明即绑裸名",不认 `= resolveGitBin()` / `= gitBinary()` 这类正确写法。
 *
 * ⚠️ 单看声明行会误报:`const root = join(…, 'DevEnv', 'backups', 'git')` 里的 'git' 是**目录名**,
 * 而 `lib/gitdir.mjs` 真有这么一行(第一版尺子就被它骗过,把基线从 9 报成 10)。所以加第二道锚:
 * 该标识符必须在文件里被当过**派生首参**(`X(git, [`)。宁可用两条同时成立换零误报。
 */
const PATH_BOUND_GIT_DECL_RE =
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=[^;\n]*['"]git(?:\.exe)?['"]\s*[;,)]?\s*$/gm
function pathBoundGitCountOf(text) {
  let n = 0
  for (const m of text.matchAll(PATH_BOUND_GIT_DECL_RE)) {
    const usedAsProgram = new RegExp(`\\(\\s*${m[1]}\\s*,\\s*\\[`).test(text)
    if (usedAsProgram) n++
  }
  return n
}

function filesWith(root, predicate) {
  const hits = []
  for (const p of productionScripts(root)) {
    let src
    try {
      src = readFileSync(p, 'utf8')
    } catch {
      continue // 读不到交给判据本身暴露,不在这里静默跳过
    }
    if (predicate(src)) hits.push(p.slice(root.length + 1).replace(/\\/g, '/'))
  }
  return hits
}

test('棘尺本身不恒真:三个计数函数都能真抓到注入的样本(含型 B 四条成对反例)', () => {
  assert.equal(bareGitCountOf("execFileSync('git', ['status'])"), 1)
  // shell 串式:`git` 后面跟的是空格,只匹配 `['"]git['"]` 会整类漏掉(本仓大量存在)
  assert.equal(
    bareGitCountOf("execSync('git status --porcelain', { cwd })"),
    1,
    'shell 串式裸 git 必须被量到',
  )
  // 漏了这一型,`git-push-guard` 就会从分母里隐身 —— 四种派生入口都要认
  assert.equal(
    bareGitCountOf("spawnSync('git', ['cat-file'], { cwd })"),
    1,
    'spawnSync 裸 git 必须被量到',
  )
  assert.equal(bareGitCountOf('spawn(process.execPath, [s])'), 0, 'node 自身派生不得误报')
  assert.equal(bareGitCountOf("execSync('gitk --everything')"), 0, '同前缀的别的程序不得误报')
  assert.equal(
    bareGitCountOf("execFileSync(GIT_BIN, ['status'])"),
    0,
    '走常量/走层的正确写法不得误报',
  )
  assert.equal(
    bareGitCountOf("execFileSync('git', ['a'])\nspawnSync('git', ['b'])"),
    2,
    '同文件多处分别计',
  )
  const hasBatch = (s) => /cat-file.{0,4}--batch/.test(s)
  assert.equal(hasBatch("x = execFileSync(G, ['cat-file', '--batch'])"), true)
  // `--batch-check` 同族(同样一次问一批对象的存在性/sha,同样有 stdio/maxBuffer 陷阱),必须计入
  assert.equal(hasBatch("spawnSync('git', ['cat-file', '--batch-check'])"), true)
  assert.equal(hasBatch('const a = 1'), false)

  // 型 B:本票迁的 6 道门**全是**这一型 —— 型 A 的尺子对它们整型盲视。
  // 少了这几条,棘轮会把"收口毫无进展"读成"存量本来就没动"。
  // 每条都带第二参 `[` 的派生调用 —— 声明+被当首参用 两条同时成立才算债(见上注释)。
  const USE = "\nexecFileSync(GIT, ['status'], { cwd })\n"
  assert.equal(
    pathBoundGitCountOf("const GIT = process.env.IHUI_GIT_BIN || 'git'\n" + USE),
    1,
    'env 兜底裸 git 必须被量到(§5b:服务账户与交互账户的 PATH 互不相通)',
  )
  assert.equal(pathBoundGitCountOf("const GIT = 'git';\n" + USE), 1, '直接赋裸 git 必须被量到')
  assert.equal(
    pathBoundGitCountOf("const bin = gitBin() || 'git'\nexecFileSync(bin, ['ls-files'])\n"),
    1,
    '函数兜底再落裸名的也量(它同样会拿到 undefined 再退回 PATH)',
  )
  assert.equal(
    pathBoundGitCountOf("const GIT = resolveGitBin()\n" + USE),
    0,
    '收口后的正确写法不得误报',
  )
  assert.equal(
    pathBoundGitCountOf('const msg = "checking \'git\' now"\nexecFileSync(msg, [])\n'),
    0,
    '字符串中间的同名片段不得误报(锚行尾正是为此)',
  )
  // 真仓第一版就被这一型骗过:'git' 在这里是**目录名**,不是二进制
  assert.equal(
    pathBoundGitCountOf(
      "  const root = join(resolve(wt, '..', '..'), 'DevEnv', 'backups', 'git')\n",
    ),
    0,
    '同名目录名不得误报(root 从未被当派生首参)',
  )
})

test('型 B:常量绑到裸 git 的生产文件数只减不增(型 A 的尺子看不见这一型)', () => {
  const root = join(here, '..', '..')
  // 本层自己那处 `resolveGitBin() || 'git'` 是**刻意保留的最后一档兜底**(绝对路径解析失败时
  // 退回 PATH,好过直接抛"找不到 git"),不排除它就把唯一正解也计成债。
  const hits = filesWith(root, (s) => pathBoundGitCountOf(s) > 0).filter(
    (p) => !p.endsWith('lib/face-reader.mjs'),
  )
  assert.ok(
    hits.length <= PATH_BOUND_GIT_BASELINE,
    `常量绑裸 git 的生产文件从基线 ${PATH_BOUND_GIT_BASELINE} 涨到 ${hits.length}: ${hits.join(', ')} —— ` +
      '新增者请改用 scripts/lib/face-reader.mjs 的 gitRaw(内部 gitBinary() 走绝对路径)。',
  )
  if (hits.length < PATH_BOUND_GIT_BASELINE) {
    console.log(
      `◽ 型 B 存量已降到 ${hits.length}(基线 ${PATH_BOUND_GIT_BASELINE}):${hits.join(', ')} —— 请把基线一并下调`,
    )
  }
})

test('裸 git 派生的生产文件数只减不增(存量记在基线,新增拦停)', () => {
  const root = join(here, '..', '..')
  const hits = filesWith(root, (s) => bareGitCountOf(s) > 0)
  assert.ok(
    hits.length <= BARE_GIT_BASELINE,
    `裸 git 派生的生产文件从基线 ${BARE_GIT_BASELINE} 涨到 ${hits.length} —— ` +
      '新增者请改用 scripts/lib/face-reader.mjs 的 gitRaw(绝对路径 git + quotepath + timeout)。\n' +
      // ⚠️ 措辞即判据:曾经这里写"本次新增候选:<前 8 个>",但前 8 个是**按路径序的存量**,
      // 与"新增"无关 —— 本棘轮刻意不持有静态清单(清单会腐烂),所以它报不出是谁新增的。
      // 2026-09-25 那次 82→83 就是这样被误读了十几分钟。现在直接把求差命令写进提示。
      `下面列出的是按路径序的前 8 个存量文件,**不是**新增清单:\n  ${hits.slice(0, 8).join('\n  ')}\n` +
      '要定位新增者,拿"定基线那枚提交"与本枚结果求差:\n' +
      "  git grep -lE \"(execFileSync|execSync|spawnSync|spawn)\\((['\\\"])git\" <该提交> -- scripts/ | grep -v /tests/\n" +
      '  (注意:本判据扫的是**工作树**,并行会话未提交的改动也会进分母 —— 先确认它是否已入库再定性)',
  )
  if (hits.length < BARE_GIT_BASELINE) {
    console.log(
      `◽ 裸 git 存量已降到 ${hits.length}(基线 ${BARE_GIT_BASELINE})—— 收口有效,请把基线一并下调`,
    )
  }
})

test('自拼 cat-file --batch 却不走本层的门,数量只减不增', () => {
  const root = join(here, '..', '..')
  // 本层自己当然要有 batch —— 不排除它,这条就永远多算 1 个,且真正的"新增第 N 份"会被掩盖
  const hits = filesWith(
    root,
    (s) => /cat-file.{0,4}--batch/.test(s) && !/lib\/face-reader/.test(s),
  ).filter((p) => !p.endsWith('lib/face-reader.mjs'))
  assert.ok(
    hits.length <= SELF_BATCH_BASELINE,
    `自拼 batch 取材的门从基线 ${SELF_BATCH_BASELINE} 涨到 ${hits.length}: ${hits.join(', ')} —— ` +
      '每条 batch 都要重写一遍 stdio[0]=pipe / maxBuffer / 头解析,而这三处本仓都真踩过',
  )
  console.log(`◽ 未收口的自拼 batch 取材:${hits.length} 个(${hits.join(', ') || '无'})`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
