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

import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  FACES,
  FACE_LABEL,
  Undetermined,
  catBatch,
  parseBatch,
  catBatchCheck,
  catBatchOids,
  gitBinary,
  gitRaw,
  gitErrText,
  selectFace,
  packByBytes,
  spawnCauseText,
  parseBatchCheckSizes,
} from '../lib/face-reader.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const scriptsDir = join(here, '..')
const GIT = gitBinary()
const read = (f) => readFileSync(join(scriptsDir, f), 'utf8')

/** 已收敛到共用层的门(91 主题接线 / 94 错误码覆盖 / 101 锁与清单对账 / 93 跨端色值对账)。
 *  条数不写进任何断言文案 —— 它是会过期的数字,用例只按 `GATES.length` 说话。 */
const GATES = [
  'check-theme-prop-wiring.mjs',
  'check-error-code-coverage.mjs',
  'check-lock-manifest-consistency.mjs',
  // 守门 93 是全链**最后一处自带 `cat-file --batch` 解析**的门,2026-09-25 收口进来后本清单才含它。
  // 清单长度不写进断言文案(会过期),用例一律按 `GATES.length` 说话。
  'check-cross-end-tokens.mjs',
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
  assert.ok(
    sites.length >= 3,
    `层的 batch 出口现测应有 3 处(batch / batch-check / batch-check 用 oid),实得 ${sites.length}`,
  )
  for (const s of sites) {
    const block = src.slice(s.index, s.index + 700)
    assert.match(
      block,
      /stdio:\s*\[\s*'pipe',\s*'pipe',\s*'pipe'\s*\]/,
      'stdio[0] 非 pipe ⇒ 喂不进对象清单',
    )
    assert.match(block, /input:\s*Buffer\.from\(/, '对象清单必须由 input 喂进去,不得拼进 argv')
    assert.match(
      block,
      /timeout:\s*(?:opts\.timeout\s*\?\?\s*)?[A-Z_]+|timeout:\s*\d+/,
      '无数字 timeout ⇒ 守门 80 那类无界挂起',
    )
    // 2026-09-25 契约变化:批次现在**按字节装箱**,`catBatch` 的读点用的是
    // `maxBuffer: budget`,而 budget = `Math.max(maxBuffer, 本块字节数 + 1MB)`、
    // `maxBuffer = opts.maxBuffer ?? GIT_MAX_BUFFER` —— 常量仍是**下限**,所以这条判据
    // 的性质没变(不许退回 execFileSync 默认的 1MB),只是形态从"写常量"变成"常量作 floor"。
    const okMaxBuffer =
      /maxBuffer:\s*(?:opts\.maxBuffer\s*\?\?\s*)?GIT_MAX_BUFFER/.test(block) ||
      (/maxBuffer:\s*budget\b/.test(block) &&
        // budget 定义在调用点**之前**,所以往回扩 900 字符再查(只查模块会让"随便某处有个
        // Math.max"就能过 —— 那这条判据就没有牙了)
        /const maxBuffer = opts\.maxBuffer \?\? GIT_MAX_BUFFER/.test(src) &&
        /const budget = Math\.max\(maxBuffer,/.test(src.slice(Math.max(0, s.index - 900), s.index)))
    assert.ok(okMaxBuffer, 'batch 调用必须以 GIT_MAX_BUFFER 为 floor(直写常量,或经 Math.max 抬升)')
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
  assert.ok(
    String(fed).includes(' blob '),
    `喂了一个对象却什么都没取回:${String(fed).slice(0, 60)}`,
  )
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
  // **行为证明**而非文本锚点:真派生一次必然失败的 git 调用,断言抛出的是 Undetermined。
  // 原先这条锁的是 `throw new Undetermined(\`git …\`)` 那一行源码字面量 —— 它既证明不了"会抛",
  // 又会在任何等价改写(如把消息换成变量)时无端变红。文本锚点留给"必须有某段注释"这类
  // 真正无法用行为表达的约束,判据本身一律问行为。
  const bogus = join(here, 'no-such-repo-for-sure-' + process.pid)
  assert.throws(
    () => gitRaw(['rev-parse', '--verify', 'HEAD'], bogus),
    (e) => e instanceof Undetermined,
    'git 取不到必须抛 Undetermined,不得返回空让调用方当成"没有违规"',
  )
})

test('gitRaw 必须把 git 的退出码带到异常上(区分"git 说没有"与"git 没跑成")', () => {
  // `git grep` 无命中是**正常结论** rc=1,调用方(守门 93 的 R3)要据此放过。若层只留一句
  // 文本消息,调用方就只能去 parse 自己的异常字符串 —— 那是把结论建立在文本上。
  const root = join(here, '..', '..')
  // needle **必须在运行时拼出来**:第一版把字面量写死,而本文件自己就被这次 commit 写进 HEAD ⇒
  // `git grep` 命中自己、rc=0,这条用例当场变成"永远不抛"的假绿尺子(同门 93 的 checkCrashShape
  // 那条"被禁字面量不得写进被量的文件"是一课)。
  const needle = 'zznope-' + process.pid + '-' + Math.random().toString(36).slice(2)
  let e1 = null
  try {
    gitRaw(['grep', '-l', needle, 'HEAD', '--', 'scripts'], root)
  } catch (e) {
    e1 = e
  }
  assert.ok(e1 instanceof Undetermined, '无命中也必须走 Undetermined(层不猜语义)')
  assert.equal(e1.status, 1, `rc=1 必须原样带到异常上,实得 ${e1.status}`)
  // 反向对照:真失败(git 自己的 128 类错误)不得也报 1,否则本判据无法区分两态。
  // (刻意不用"不存在的子命令"当反例 —— git 对它也回 1,和"没命中"同码,区分不出来。)
  let e2 = null
  try {
    gitRaw(['--git-dir=' + join(root, 'no-such-gitdir-zz'), 'rev-parse', 'HEAD'], root)
  } catch (e) {
    e2 = e
  }
  assert.ok(e2 instanceof Undetermined)
  assert.equal(e2.status, 128, `git 自身错误必须是 128 而非 1,实得 ${e2.status}`)
})

/** 阳性对照用的"违规写法"样本:证明下面那条判据真的能抓住裸 git,而不是恒过 */
const BAD_SAMPLE = `const x = execFileSync('git', ['status'], { cwd: root })\nconsole.log(execFileSync("git", ["ls-files"]))\n`
const bareGitCount = (text) =>
  (text.match(/execFileSync\(\s*['"]git['"]/g) || []).length +
  (text.match(/execSync\(\s*['"]git\b/g) || []).length

test('判据本身不恒真:同一把尺子必须能抓住违规样本、而对已收口的门均为 0', () => {
  assert.equal(bareGitCount(BAD_SAMPLE), 2, `尺子连样本都抓不住(实得 ${bareGitCount(BAD_SAMPLE)})`)
  assert.equal(bareGitCount("execFileSync(GIT_BIN, ['status'])"), 0, '走常量的正确写法不得误报')
  for (const f of GATES) assert.equal(bareGitCount(read(f)), 0, `${f} 里仍有自拼的裸 git 派生`)
})

test(`装车证明:${GATES.length} 道门都必须真的 import 这一层`, (t) => {
  for (const f of GATES) {
    if (!existsSync(join(scriptsDir, f))) {
      t.skip(`${f} 不在盘上 ⇒ 未判定,不计为通过`)
      continue
    }
    const src = read(f)
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

/**
 * `parseBatch` 的三条分支用**构造出来的 buffer** 测(不从真仓凑):截断需要"git 少写字节且不报错",
 * 这在真仓里造不出来 —— 不可构造的分支等于没被验证过的分支,而它恰好就是"静默少扫"那一条。
 */
const hdr = (oid, size) => `${oid} blob ${size}\n`
const O1 = '1'.repeat(40)
const O2 = '2'.repeat(40)
test('parseBatch:截断必须抛"无法判定",不得静默把剩余对象当成取不到', () => {
  const revs = ['HEAD:a.ts', 'HEAD:b.ts', 'HEAD:c.ts']
  // 正例:三条都有头(中间那条是合法 missing)⇒ 不抛,missing 归 null
  const full = Buffer.from(
    hdr(O1, 1) + 'x' + '\n' + `${revs[1]} missing\n` + hdr(O2, 1) + 'y' + '\n',
    'utf8',
  )
  assert.deepEqual([...parseBatch(full, revs).values()], ['x', null, 'y'])
  // 反例:第 2 条的头根本没出现 = 管道被截。必须抛,而不是返回"一条 + 两条 null"。
  const cut = Buffer.from(hdr(O1, 1) + 'x' + '\n', 'utf8')
  assert.throws(
    () => parseBatch(cut, revs),
    (e) => e instanceof Undetermined && /截断/.test(e.message),
    '截断未大声失败 ⇒ 调用方会把它读成"没有违规"',
  )
})

test('parseBatch:非 blob 的头(tree / commit)归 null,且不得把内容当下一条头读', () => {
  // git 对 tree 也写 `<oid> tree <size>` 后跟**内容**;本层的判据面只喂 blob,
  // 但一旦有人把整棵目录喂进来,必须表现为"取不到"而不是"取到一段乱码"。
  const out = Buffer.from(`${O1} tree 3\nabc\n`, 'utf8')
  assert.equal(parseBatch(out, ['HEAD:somedir']).get('HEAD:somedir'), null)
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
 *    **最后一跳(同日 `b3816c62e7`)**:守门 93 收进取材层,4 处裸 `execFileSync('git')` 归零 ⇒
 *    A 82 → **81**。这一跳与"新增违规"方向相反,所以按当次实测把基线写下来,不留旧数字。
 *  · 型 B:本票首量 10 → 加"必须被当过派生首参"的第二道锚后 9 → 8 → **10**。
 *    涨的两处是并行会话为守门 107(第三方来源台账)新入库的两个模块
 *    `scripts/lib/third-party-roots.mjs` 与 `scripts/provenance-ledger.mjs`
 *    (commit `b68bde4a868`,11:17),形态都是 `const GIT = process.env.IHUI_GIT_BIN || 'git'`
 *    再 `execFileSync(GIT, …)` —— 型 B 的标准形态。**本票不代他人收口**(那是另一条线的门与
 *    另一条线的镜像测试),也不把数字压回去装没看见;一行修法与归属记在台账 O63·续。
 *    第二道锚(必须被当过派生首参)保留 —— `lib/gitdir.mjs` 那处 'git' 是目录名、不是二进制,
 *    第一版尺子被它骗过。不含本层自己那处**刻意**的最后一档兜底。
 *  · 型 C:首量 9 → 6 道门收口后 3 → 1 → **0**(最后一处是 `check-cross-end-tokens.mjs`,守门 93,
 *    于 `b3816c62e7` 收进取材层)。**基线自此为 0 = 零容忍**:再出现一处自拼 batch 就是新增,
 *    不再有"存量"可解释 —— 这条尺子的价值正在这里,它有牙由"棘尺本身不恒真"那条用例钉住。
 *    ⚠️ 中途两次"涨到 2/3"量的都是**我自己尺子的假阳**,不是新债:旧正则
 *    `/cat-file.{0,4}--batch/` 把 JSDoc 里的字样(`import-graph.mjs:164` "一次 cat-file --batch")
 *    与 usage 字符串里的散文(`git-push-guard.mjs:289` "一次 git cat-file --batch-check 找 missing")
 *    当成派生调用 —— 被误伤的那两个文件**都已经走本层**。现收紧成 argv 形态
 *    (`['cat-file', '--batch…']`,注释与字符串里的散文不算),并配两条成对反例。
 *    教训:**误报比漏报更贵** —— 它的下一步一定是有人为了过门去削判据。
 *  · 取材面:三把尺子一律判 **HEAD blob**(2026-09-25 从工作树面换过来)。工作树面会把并行会话
 *    **还没提交**的文件记成我的存量债(当场实测过:`third-party-roots.mjs` 当时是 `??` 未跟踪态),
 *    而一台恒红的尺子只会逼人跳门。口径与本仓所有内容型守门(70/77/83/98/101/103)一致。
 */
const BARE_GIT_BASELINE = 81
const PATH_BOUND_GIT_BASELINE = 10
const SELF_BATCH_BASELINE = 0

/**
 * 枚举与取材一律走 **HEAD**,不读工作树。
 *
 * 为什么必须换面(2026-09-25 实测):这三条棘轮原本 `readdirSync` 扫工作树,于是并行会话
 * **还没提交**的文件会直接进我的分母 —— 当场表现为"基线 8 涨到 10",而涨的那两处里
 * `scripts/lib/third-party-roots.mjs` 实测是 `??` 未跟踪态,根本不属任何已入库状态。
 * 一台恒红的尺子只有一个结局:各会话跳门,连带全部守门作废(§12e 同型)。
 * 本仓所有内容型守门(70/77/83/98/101/103)早就统一成"全量判 HEAD blob",棘轮没理由例外。
 * 代价如实说明:未入库的违规本棘轮看不见 —— 但它一旦提交就会撞上门 80 / 编译期 / 本棘轮,
 * 由提交者负责,而不是由别人替他平账。
 */

/**
 * 只抹注释(整行行注释与成对斜杠星…星斜杠包围的块注释),**不抹字符串** ——
 * 型 A 要找的派生调用里 `'git'` 本身就是字符串字面量,抹字符串等于把靶子涂掉。
 *
 * 为什么必须有这一步(2026-09-25 实测):`scripts/lib/import-graph.mjs` 明明已经 `import catBatch`
 * 走本层,却被型 C 记成"自拼 batch 的门" —— 命中的是它第 164 行**JSDoc 注释**里那句
 * "一次 cat-file --batch"。一条把注释当代码的尺子会把"已经收口"判成"又长了一枚债",
 * 而这类误报的最终出路是有人去削判据或跳门。与守门 80 的 `markHidden` 同一取向。
 *
 * (本头注刻意不写出块注释的两个闭合字符 —— 写出来就是把本注释自己提前关掉,已踩过一次。)
 */
export function hideComments(src) {
  const out = []
  let inBlock = false
  for (const line of src.split(/\r?\n/)) {
    let res = ''
    let i = 0
    let quote = null // 当前所在字符串的引号(' " `);字符串里的 // 与 /* 都不是注释
    while (i < line.length) {
      const ch = line[i]
      if (inBlock) {
        if (line.startsWith('*/', i)) {
          i += 2
          inBlock = false
        } else i += 1
        continue
      }
      if (quote) {
        res += ch
        if (ch === '\\') {
          res += line[i + 1] ?? ''
          i += 2
          continue
        }
        if (ch === quote) quote = null
        i += 1
        continue
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        quote = ch
        res += ch
        i += 1
        continue
      }
      if (line.startsWith('//', i)) {
        // 行注释:整段抹平(URL 的 `://` 落在字符串里,已由上面的 quote 分支保住)
        i = line.length
        continue
      }
      if (line.startsWith('/*', i)) {
        const end = line.indexOf('*/', i + 2)
        if (end < 0) {
          inBlock = true
          i = line.length
        } else i = end + 2
        continue
      }
      res += ch
      i += 1
    }
    // 抹掉的部分补回等量空格以外的字符会导致行内列号漂移,但三条判据都不依赖列号 ⇒ 直接截断即可;
    // 唯一必须保住的是**换行**,否则 `$`/multiline 类锚点会跨行误配。
    out.push(res)
  }
  return out.join('\n')
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

/**
 * 型 C 的靶形:**argv 形态**的 batch 派生(`['cat-file', '--batch…']`),不是"文本里出现过这几个字"。
 * 旧写法 `/cat-file.{0,4}--batch/` 会被**字符串里的散文**命中 —— 实测 `git-push-guard.mjs:289`
 * 的 usage 文案"一次 git cat-file --batch-check 找 missing"被记成一枚未收口的门,而该文件的
 * 第 9 处自拼 batch 早在 `dfadcc5ba70` 就收进层了。把说明文字当代码,红会指到一个已收口的门,
 * 而这类误报的最终出路一定是有人去削判据。`--batch-check` 同族照样命中(前缀相同)。
 * 只此一份定义:下面的 `headDerivationScan` 与本文件的反例夹具都调它,免得两处各自漂移。
 */
const hasBatchCall = (s) => /['"]cat-file['"]\s*,\s*['"]--batch/.test(s)

/**
 * ⚠️ 上面那把尺子量的是**工作树**,而并行会话未提交的改动会直接进分母 ——
 * 2026-09-25 实测:三条棘轮同时报红(型 B 8→10、型 C 1→2),新增者之一是
 * `scripts/lib/third-party-roots.mjs`,而它当时是 `??` **未跟踪态**,
 * 也就是"别人正在写的文件被记成了我的存量债"。本仓每一道内容型守门(70/77/83/98/101/103)
 * 都统一判 HEAD blob,棘轮没理由例外 ⇒ 下面换成 HEAD 面,并且用临时仓把这条口径钉死。
 *
 * 枚举与内容**同面同轮**(一次 `ls-tree` + 一次 `cat-file --batch`),不得"清单读盘 + 内容读 git"。
 */
export function headDerivationScan(root) {
  const listed = spawnSync(
    GIT,
    [
      '-c',
      'safe.directory=*',
      '-c',
      'core.quotepath=false',
      '-C',
      root,
      'ls-tree',
      '-r',
      '--name-only',
      'HEAD',
      '--',
      'scripts/',
    ],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 26 },
  )
  if (listed.status !== 0)
    throw new Error(`棘轮取材失败(不是"没有违规"):git ls-tree HEAD 退出 ${listed.status}`)
  const rel = String(listed.stdout || '')
    .split('\n')
    .filter(Boolean)
    .map((p) => p.replace(/^scripts\//, ''))
    .filter((p) => /\.(mjs|js|cjs)$/.test(p))
    // 与换面前的目录排除口径逐字一致:夹具里大量"故意写坏"的样本,计进来就是把判据当分母
    .filter((p) => !/(^|\/)(tests|__mocks__|node_modules)\//.test(p))
  if (rel.length === 0)
    throw new Error('棘轮取材失败:HEAD 的 scripts/ 下列出 0 个生产文件(空扫不记绿)')
  const blobs = catBatch(
    root,
    rel.map((p) => `HEAD:scripts/${p}`),
    { maxBuffer: 1 << 28 },
  )
  const files = rel.map((p) => ({ rel: p, text: blobs.get(`HEAD:scripts/${p}`) }))
  // 判据一律读**抹掉注释之后**的源码(见 hideComments 的头注:注释里提一句 "cat-file --batch"
  // 就把已收口的门记成未收口,这种误报的最后出路一定是削判据)
  const hitsOf = (pred) =>
    files
      .filter((f) => typeof f.text === 'string' && pred(hideComments(f.text)))
      .map((f) => `scripts/${f.rel}`)
  return {
    total: files.length,
    unreadable: files.filter((f) => typeof f.text !== 'string').length,
    bareGit: hitsOf((t) => bareGitCountOf(t) > 0),
    pathBoundGit: hitsOf((t) => pathBoundGitCountOf(t) > 0).filter(
      (p) => p !== 'scripts/lib/face-reader.mjs',
    ),
    selfBatch: hitsOf(hasBatchCall).filter(
      // 按**路径**排除,不是按内容 —— 层的源文本里并不含 "lib/face-reader" 这个串,
      // 用内容排除等于把层自己算成"未收口的门"(第一版就是这么错的,当场多算 1 枚)。
      (p) => p !== 'scripts/lib/face-reader.mjs',
    ),
  }
}

test('取材面必须是 HEAD:未跟踪文件不得进分母(工作树面会把别人的在飞改动算成我的债)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ratchet-face-'))
  try {
    const g = (...a) =>
      spawnSync(GIT, ['-c', 'safe.directory=*', ...a], {
        cwd: dir,
        encoding: 'utf8',
        windowsHide: true,
      })
    g('init', '-q', '-b', 'main')
    g('config', 'user.email', 't@t')
    g('config', 'user.name', 't')
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    mkdirSync(join(dir, 'scripts', 'lib'), { recursive: true })
    // 一枚"已入库的债":型 B 声明 + 真被当首参用
    writeFileSync(
      join(dir, 'scripts', 'committed-debt.mjs'),
      "const GIT = process.env.IHUI_GIT_BIN || 'git'\nexecFileSync(GIT, ['status'])\n",
      'utf8',
    )
    writeFileSync(join(dir, 'scripts', 'clean.mjs'), 'export const x = 1\n', 'utf8')
    g('add', '-A')
    g('commit', '-qm', 'base')
    // 一枚"未跟踪的改动中文件":同样的债,但还没进提交树
    writeFileSync(
      join(dir, 'scripts', 'lib', 'in-flight.mjs'),
      "const GIT = 'git'\nexecFileSync(GIT, ['ls-files'])\n",
      'utf8',
    )
    const scan = headDerivationScan(dir)
    assert.deepEqual(
      scan.pathBoundGit,
      ['scripts/committed-debt.mjs'],
      `未跟踪文件被算进了分母 ⇒ 面没收对,实得 ${scan.pathBoundGit.join(', ')}`,
    )
    // 反向对照:同一枚文件在**磁盘面**上确实会被数到 —— 证明上一条绿是"面选对了",不是判据没牙
    const diskHits = readdirSync(join(dir, 'scripts'), { recursive: true })
      .filter((p) => String(p).endsWith('.mjs'))
      .map((p) => join(dir, 'scripts', String(p)))
      .filter((p) => pathBoundGitCountOf(readFileSync(p, 'utf8')) > 0)
    assert.equal(
      diskHits.length,
      2,
      '磁盘面应数到 2 枚(含未跟踪那枚);数不到说明本例的两枚写法不同形,对照失效',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

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
  /**
   * 型 C 的靶形:**argv 形态**的 batch 派生(`['cat-file', '--batch…']`),不是"文本里出现过这几个字"。
   * 旧写法 `/cat-file.{0,4}--batch/` 会被**字符串里的散文**命中 —— 实测 `git-push-guard.mjs:289`
   * 的用法提示语 "一次 git cat-file --batch-check 找 missing" 被记成一枚未收口的门,
   * 而该文件第 9 处自拼 batch 早在 `dfadcc5ba70` 就收进层了。一条把说明文字当代码的尺子,
   * 报出来的红会把"已收口"的人逼去削判据。
   * 只用一份正则(下面 headDerivationScan 与本文件的反例夹具共用它),避免两处各自漂移。
   */
  const hasBatchCall = (s) => /['"]cat-file['"]\s*,\s*['"]--batch/.test(s)
  assert.equal(hasBatchCall("x = execFileSync(G, ['cat-file', '--batch'])"), true)
  // `--batch-check` 同族(同样一次问一批对象的存在性/sha,同样有 stdio/maxBuffer 陷阱),必须计入
  assert.equal(hasBatchCall("spawnSync('git', ['cat-file', '--batch-check'])"), true)
  assert.equal(hasBatchCall('const a = 1'), false)
  // ⚠️ 反向对照:散文式提及(说明文字 / 用法提示里的 `git cat-file --batch-check`)不得算债。
  // 这条不是假想 —— `git-push-guard.mjs:289` 的 usage 文案真实命中过旧正则,而该文件
  // 的自拼 batch 早在 `dfadcc5ba70` 就收进层了:把说明文字当代码,红会指到一个已收口的门。
  assert.equal(
    hasBatchCall("  '  1) for-each-ref 取 sha + 一次 git cat-file --batch-check 找 missing'"),
    false,
    '字符串里的说明文字被当成了派生调用',
  )
  assert.equal(
    hasBatchCall('// 一次 cat-file --batch 取多个 blob'),
    false,
    '注释里的字样被当成代码',
  )

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
    pathBoundGitCountOf('const GIT = resolveGitBin()\n' + USE),
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

  // 注释不得算债 —— 成对两条:同一段代码放进注释里必须归 0,留在代码里必须归 1。
  // (真仓的 import-graph.mjs 就是被 JSDoc 里那句"一次 cat-file --batch"记成未收口的门)
  assert.equal(bareGitCountOf("execFileSync('git', ['status'])"), 1, '代码形态必须计')
  assert.equal(
    bareGitCountOf(hideComments("// execFileSync('git', ['status'])\n")),
    0,
    '行注释必须不计',
  )
  assert.equal(
    bareGitCountOf(hideComments("/* execFileSync('git', ['x']) */\n")),
    0,
    '块注释必须不计',
  )
  assert.equal(
    bareGitCountOf(hideComments("const a = 1 // execFileSync('git', ['x'])\nconst b = 2\n")),
    0,
    '行尾注释必须不计',
  )
  assert.equal(
    bareGitCountOf(hideComments('/** 一次 cat-file --batch 取多个 blob */\nf()\n')),
    0,
    'JSDoc 里的 batch 字样必须不计',
  )
  assert.equal(
    hideComments("const url = 'https://aizhs.top/x'\nexecFileSync('git', ['v'])\n").includes(
      "execFileSync('git'",
    ),
    true,
    '抹注释不得连代码一起抹掉(抹字符串就会把靶子涂掉,这里只抹注释)',
  )
  assert.equal(
    hideComments("const s = '/* 这不是注释 */'\nexecFileSync('git', ['v'])\n").includes(
      "execFileSync('git'",
    ),
    true,
    '字符串里的 /* 不得把后续代码吞成注释',
  )
})

test('型 B:常量绑到裸 git 的生产文件数只减不增(型 A 的尺子看不见这一型)', () => {
  const root = join(here, '..', '..')
  // 本层自己那处 `resolveGitBin() || 'git'` 是**刻意保留的最后一档兜底**(绝对路径解析失败时
  // 退回 PATH,好过直接抛"找不到 git"),不排除它就把唯一正解也计成债。
  const hits = headDerivationScan(root).pathBoundGit
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
  const hits = headDerivationScan(root).bareGit
  assert.ok(
    hits.length <= BARE_GIT_BASELINE,
    `裸 git 派生的生产文件从基线 ${BARE_GIT_BASELINE} 涨到 ${hits.length} —— ` +
      '新增者请改用 scripts/lib/face-reader.mjs 的 gitRaw(绝对路径 git + quotepath + timeout)。\n' +
      // ⚠️ 措辞即判据:曾经这里写"本次新增候选:<前 8 个>",但前 8 个是**按路径序的存量**,
      // 与"新增"无关 —— 本棘轮刻意不持有静态清单(清单会腐烂),所以它报不出是谁新增的。
      // 2026-09-25 那次 82→83 就是这样被误读了十几分钟。现在直接把求差命令写进提示。
      `下面列出的是按路径序的前 8 个存量文件,**不是**新增清单:\n  ${hits.slice(0, 8).join('\n  ')}\n` +
      '要定位新增者,拿"定基线那枚提交"与本枚结果求差:\n' +
      '  git grep -lE "(execFileSync|execSync|spawnSync|spawn)\\(([\'\\"])git" <该提交> -- scripts/ | grep -v /tests/\n' +
      '  (本判据判 **HEAD blob**:未提交的改动不进分母,见 headDerivationScan 的头注)',
  )
  if (hits.length < BARE_GIT_BASELINE) {
    console.log(
      `◽ 裸 git 存量已降到 ${hits.length}(基线 ${BARE_GIT_BASELINE})—— 收口有效,请把基线一并下调`,
    )
  }
})

/* ── 2026-09-25 按字节装箱:三个新出口都用构造面证明,不依赖真仓恰好有多大 ───────────── */

test('packByBytes 不丢不重,且单条超预算也自成一块(绝不静默丢弃)', () => {
  const specs = Array.from({ length: 25 }, (_, i) => `:${i}`)
  const size = (s) => (s === ':7' ? 40 << 20 : 1 << 10) // 第 8 条是 40MB 的巨无霸
  const blocks = packByBytes(specs, size, { maxBytes: 8 << 20, maxCount: 4 })
  const flat = blocks.flat()
  assert.equal(flat.length, specs.length, `装箱丢了 ${specs.length - flat.length} 个规格`)
  assert.equal(new Set(flat).size, specs.length, '装箱出现重复规格')
  assert.ok(
    blocks.some((b) => b.length === 1 && b[0] === ':7'),
    '超过 maxBytes 的单条必须自己成一块 —— 丢弃它等于让下游"少扫一条却报绿"',
  )
  for (const b of blocks) assert.ok(b.length <= 4, `块内条数越界:${b.length}`)
})

test('packByBytes 的非法参数一律拒,不许退化成"空结果"', () => {
  // 空结果在下游永远是绿 —— 所以尺寸参数坏掉必须抛,而不是返回 []
  assert.throws(() => packByBytes(['a'], () => 1, { maxBytes: 0 }), /maxBytes/)
  assert.throws(() => packByBytes(['a'], () => 1, { maxCount: 0 }), /maxCount/)
  assert.throws(() => packByBytes(['a'], () => 1, { maxBytes: NaN }), /maxBytes/)
  assert.deepEqual(packByBytes([], () => 1, { maxBytes: 10, maxCount: 10 }), [], '空输入才是唯一的空输出')
})

test('spawnCauseText:缓冲区溢出不得被折成"git 无输出",超时与溢出两支要分得开', () => {
  const enobufs = spawnCauseText({ code: 'ENOBUFS', stderr: '' }, 64 << 20, '块 4/23')
  assert.match(enobufs, /maxBuffer/, 'ENOBUFS 必须报成缓冲区不足')
  assert.ok(!enobufs.includes('无输出'), '把缓冲区溢出说成"git 无输出"正是 09-25 误诊十几分钟的成因')
  assert.match(enobufs, /块 4\/23/, '要带是哪一块,否则无法定位输入形态')
  const tmo = spawnCauseText({ code: 'ETIMEDOUT', signal: 'SIGTERM', stderr: '' }, 64 << 20, '块 1/1')
  assert.match(tmo, /超时/, 'ETIMEDOUT 才是超时')
  assert.ok(!tmo.includes('maxBuffer'), '超时不得报成缓冲区(两者处置动作不同)')
  // 反向:真正的零命中仍必须是层那个常量串(守门 99 与本文件都按它逐字对账)
  assert.equal(spawnCauseText({ stderr: '' }, 64 << 20, 'x'), gitErrText({ stderr: '' }))
  assert.equal(spawnCauseText({ stderr: '' }, 64 << 20, 'x'), '(git 无输出)')
})

test('parseBatchCheckSizes:oid blob size 对齐回填,missing / tree 归 null', () => {
  const oid = 'f'.repeat(40)
  const out = `${oid} blob 123\n:no-such blob missing\n${oid} tree 4096\n`
  const m = parseBatchCheckSizes(out, [':a', ':b', ':c'])
  assert.equal(m.get(':a'), 123)
  assert.equal(m.get(':b'), null, 'missing 必须 null,不得把规格原文当数字返回')
  assert.equal(m.get(':c'), null, 'tree 不是 blob,读它没有意义')
})

test('行为等值:同一批规格,逐条一块与整块一块的结论必须完全相同(证明装箱不改语义)', () => {
  const root = join(here, '..', '..')
  const specs = ['HEAD:package.json', 'HEAD:README.md', 'HEAD:nope/missing.ts'].map((s) => s)
  const one = catBatch(root, specs, { chunkSize: 1, maxBytes: 1 })
  const all = catBatch(root, specs, { chunkSize: specs.length })
  assert.deepEqual([...one.entries()], [...all.entries()], '分块与不分块必须逐 key 同序同值')
  assert.equal(one.get('HEAD:nope/missing.ts'), null)
})

test('自拼 cat-file --batch 却不走本层的门,数量只减不增', () => {
  const root = join(here, '..', '..')
  const s = headDerivationScan(root)
  const hits = s.selfBatch
  assert.ok(
    hits.length <= SELF_BATCH_BASELINE,
    `自拼 batch 取材的门从基线 ${SELF_BATCH_BASELINE} 涨到 ${hits.length}: ${hits.join(', ')} —— ` +
      '每条 batch 都要重写一遍 stdio[0]=pipe / maxBuffer / 头解析,而这三处本仓都真踩过',
  )
  // 换面这件事本身也要有牙:HEAD 面读不出内容的文件必须为 0,否则"少了几枚分母"会伪装成"收口有效"
  assert.equal(
    s.unreadable,
    0,
    `HEAD 面有 ${s.unreadable} 个生产文件取不到内容 —— 分母在缩水,不能当作存量下降`,
  )
  if (hits.length < SELF_BATCH_BASELINE) {
    console.log(
      `◽ 未收口的自拼 batch 取材:${hits.length} 个(${hits.join(', ') || '无'})—— 请把基线一并下调`,
    )
  } else if (hits.length === 0) {
    console.log('✅ 自拼 batch 取材已清零')
  }
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
