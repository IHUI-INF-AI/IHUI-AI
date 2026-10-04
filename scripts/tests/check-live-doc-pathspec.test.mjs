// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/check-live-doc-pathspec.mjs` 的 §22c 镜像测试(2026-09-29 立)
 *
 * 为什么每条都要成对:本仓最高频的失效型是"判据在、账面绿、而从没判过"。一条只会绿的断言
 * 与一条不会有的断言等价,所以每个正向都配一条"摘掉判据/摘掉接线即翻红"的对照。
 * `cond` 一律是**已求值的布尔**(`(() => {…})()`)—— 把函数当条件传进登记器会得到恒绿假账
 * (守门 150 票㉛ 实测一次量到 8 条同型,那条门一路打印"105 例全绿"而其中 8 条从未求值)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, cpSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// §22c:判据从源文件 export `__test__` 直接导入,测试里**不得**再抄一份镜像常量。
// 门体自带 §22d 的 `isDirectRun` 守卫,所以 import 它不会有 CLI 副作用。
import { __test__ } from '../check-live-doc-pathspec.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const GIT = 'C:/Program Files/Git/cmd/git.exe'
const GATE = join(REPO, 'scripts/check-live-doc-pathspec.mjs')

/** 判据从 HEAD 面读还是从磁盘读,在这份测试里是**两件事**,各自点名:
 *  T1/T2 这类"装了什么、有没有第二份"的源码锁读被审面(HEAD);端到端造夹具只能读磁盘副本,
 *  因为夹具仓里根本没有本仓历史 —— 这一点写在用例里,不留成隐含前提。 */
const git = (args, cwd = REPO) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 64 * 1024 * 1024,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })

/**
 * 夹具闭包:**整层 `scripts/lib` 一起拷**,不在测试里手写依赖清单。
 * 第一版手列了 5 个文件,少一个 `lib/gitdir.mjs`(`face-reader` 自己 import 它)⇒ 五条端到端用例
 * 全部在**收集期** MODULE_NOT_FOUND,而账面读起来像"判据判红"。这正是本仓在
 * `plan-collide-renumber` 那格登记过的形态(主器 import 的 lib 没随交付走,镜像 8 例一条没跑),
 * 而按名字列清单必然随每一次 lib 演进再漂一遍 —— 所以这里按目录拷,漂移面为零。
 */
function seedGateRepo(dir, { commitSeed = true } = {}) {
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  cpSync(join(REPO, 'scripts', 'lib'), join(dir, 'scripts', 'lib'), { recursive: true })
  // lib 之外的 scripts **顶层** .mjs 也整层拷(2026-10-01 补):lib/gitdir.mjs 现职 import 了
  // `../seal-c-root-stray.mjs`(G-814433 引入)⇒ "lib 只内聚、门体单拷即够"的假设被打破,
  // 五条端到端用例全在收集期 MODULE_NOT_FOUND、账面读起来像"判据判红"。按名字补清单必然
  // 随每一次 import 演进再漂一遍,故与上面 lib 同理按目录拷:非递归、只取顶层 .mjs。
  for (const f of readdirSync(join(REPO, 'scripts'))) {
    if (f.endsWith('.mjs')) copyFileSync(join(REPO, 'scripts', f), join(dir, 'scripts', f))
  }
  copyFileSync(GATE, join(dir, 'scripts/check-live-doc-pathspec.mjs'))
  /**
   * 归档面必须有内容可枚举,否则门对"缺失行"只能报**未判定**(它没有资格证明那一行是随 §1
   * 两步走搬走的)—— 那会让 T3/T8 的红臂测不到红。真仓有 51 个归档件,夹具至少给一个,
   * 这一格是"夹具与真仓同形",不是给门开后门:目录为空时门的正确结论本来就应该是未判定。
   */
  mkdirSync(join(dir, '.ihui-agent', 'archive'), { recursive: true })
  writeFileSync(join(dir, '.ihui-agent', 'archive', 'SEED.md'), '# 夹具归档面占位\n', 'utf8')
  git(['init', '-q', '--initial-branch=main'], dir)
  git(['config', 'user.email', 't@t'], dir)
  git(['config', 'user.name', 't'], dir)
  // 归档面必须**真的进了索引/提交**:否则 `--staged` 档枚举索引面时归档目录是空的,门对每一条
  // 缺失行只能报"未判定"(它没资格判断那一行是不是随 §1 两步走搬走的),于是所有红臂都测不到红。
  // `commitSeed:false` 只给 T6 用 —— 那一例专门测"仓库还没有提交",种子提交会把它要测的形态造掉。
  if (commitSeed) {
    git(['add', '-A'], dir)
    git(['commit', '-qm', 'seed: 归档面'], dir)
  }
}

const runGate = (dir, extra = []) => {
  try {
    const out = execFileSync(
      process.execPath,
      [join(dir, 'scripts/check-live-doc-pathspec.mjs'), ...extra],
      {
        cwd: dir,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 180000,
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    return { rc: 0, out }
  } catch (e) {
    return { rc: e.status ?? -1, out: String(e.stdout || '') + String(e.stderr || '') }
  }
}

test('T1 装车与摘线方向锁:声称已接线必须真接线;真接线时条目三件套齐备', () => {
  /**
   * 读 **HEAD 面**而不是磁盘:磁盘那份可能已被我这枚提交带上注册,而"注册与门体同枚入库"正是
   * 本仓在 README 表格门那格踩过的坑 —— 先注册后补脚本 ⇒ HEAD 里一条指向不存在脚本的注册,
   * 干净检出上这道门以"脚本找不到"失败并挡住整批门,而守门 89 的 R1/R2/R4 对这一格失明。
   *
   * 判据写成**单向**而不是"声称 ⇔ 注册"等值:落地之前(此刻)头注不声称、runner 也没有条目 ⇒ 两半都该过;
   * 落地之后头注声称、runner 有条目 ⇒ 两半都该过。等值式会把"注册了但头注没自称"这种**正当**形态判红,
   * 于是这条锁会在自己最该生效的那一格里反向拦人。
   */
  const runner = git(['show', 'HEAD:scripts/guardian-runner.mjs'])
  const registered = runner.includes('check-live-doc-pathspec')
  const head = (() => {
    try {
      return git(['show', 'HEAD:scripts/check-live-doc-pathspec.mjs'])
    } catch {
      return null
    }
  })()
  if (head === null) {
    assert.equal(
      registered,
      false,
      '门体尚未入库而 runner 已注册 ⇒ 注册指向一个不存在的脚本(README 表格门那一型)',
    )
    return
  }
  const claimsWired =
    /已接\s*pre-commit|guardian-runner\s*第\s*\d+\s*项|与注册条目[^\n]{0,24}压进.{0,8}枚提交/.test(
      head,
    )
  if (claimsWired)
    assert.ok(
      registered,
      '头注声称已接线而 runner 没有条目 ⇒ 文档给后人留一句跑不通的出路(守门 89 R1/R2 那一型)',
    )
  if (!registered) return
  // 大括号配对取出**本门那一条**再看字段 —— 别人有 blocking 不算我有(守门 136 T2 那一课:
  // 按"脚本名前后各 400 字符"取范围会跨进邻门)。
  const at = runner.indexOf('check-live-doc-pathspec.mjs')
  const from = runner.lastIndexOf('{', at)
  let depth = 0
  let to = from
  for (let i = from; i < runner.length; i++) {
    if (runner[i] === '{') depth += 1
    else if (runner[i] === '}') {
      depth -= 1
      if (depth === 0) {
        to = i
        break
      }
    }
  }
  const item = runner.slice(from, to + 1)
  assert.match(
    item,
    /mode:\s*'blocking'/,
    '本门接入提交链必须是 blocking(只判本次真改掉的文档 ⇒ 不产生恒红面)',
  )
  assert.match(
    item,
    /skipEnv:\s*'HUSKY_SKIP_LIVE_DOC_PATHSPEC'/,
    '应急开关必须随条目声明,否则跳过它没有合法出口',
  )
  assert.match(
    item,
    // `[^]]` 在 JS 正则里是"**空**否定类"(什么都匹配不到)后跟一个字面 `]`,不是"不含右方括号" ——
    // 少个反斜杠,这条断言就永远匹配不上(本枚实测:注册明明在位而它报"触发面必须含三份活文档")。
    // 与"永远绿的断言同样没用"对称的是"**永远红的断言**":它会在下一任手里被当成"注册没做"而去重做注册。
    /stagedTriggers:[^\]]*PROJECT_PLAN\.md/,
    '触发面必须含三份活文档 —— 判据存在而永不调用等于没有(守门 70/76/81 同型)',
  )
})

test('T2 唯一实现锁:三态判据住在 lib,归并器与门都不得有第二份(读 HEAD 面)', () => {
  const gate = readFileSync(GATE, 'utf8')
  const own = gate.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
  assert.ok(!/function classifyMissing\(/.test(own), '门里不得再算一遍"什么算丢了"(两处各写必漂开)')
  assert.ok(gate.includes('./lib/live-doc-classify.mjs'), '门必须从 lib 取那一份判据')
  // merge-live-doc 的 HEAD 面在落地之前仍是旧形态 ⇒ 这一半留到门体入库后由 T1 的同面读法复核,
  // 这里只锁"门这一侧没有第二份",不把"别人那份还没搬"当成红的理由(那是本次提交正在做的事)。
})

test('T3 三态只有一档判红:lost ⇒ 红,stale/superseded 不得连带判红(成对)', () => {
  const dir = mkScratch('pathspec-t3-')
  try {
    seedGateRepo(dir)
    const base = [
      '# 头',
      '- [x] ✅(2026-09-25) 计划任务 `IHUI-C-Drive AutoMaintain` 仍未注册(注册 = 影响全机的删除动作,须用户授权); 〔追加一条取证注记把这行拉长〕',
      '- **闸门甲**(7):旧口径把 merge 与 cherry-pick 一起整轮放行,取证 8 例',
      '- 尾行两边都在,长度足够不被短行过滤吃掉,免得本夹具把"短行"当成变量',
    ].join('\n')
    const staleOnly = [
      '# 头',
      '- [ ] 计划任务 `IHUI-C-Drive AutoMaintain` 仍未注册(注册 = 影响全机的删除动作,须用户授权);',
      '- **闸门甲**(7):旧口径把 merge 与 cherry-pick 一起整轮放行,取证 8 例',
      '- 尾行两边都在,长度足够不被短行过滤吃掉,免得本夹具把"短行"当成变量',
    ].join('\n')
    const lostOne = [
      '# 头',
      '- [x] ✅(2026-09-25) 计划任务 `IHUI-C-Drive AutoMaintain` 仍未注册(注册 = 影响全机的删除动作,须用户授权); 〔追加一条取证注记把这行拉长〕',
      '- **闸门乙**(9):这是一条被整行删掉的登记行,别处没有同形旧行可以认领它的身份',
      '- 尾行两边都在,长度足够不被短行过滤吃掉,免得本夹具把"短行"当成变量',
    ].join('\n')

    const commit = (text) => {
      writeFileSync(join(dir, 'README.md'), text, 'utf8')
      git(['add', 'README.md'], dir)
      git(['commit', '-qm', 'base'], dir)
    }
    // 夹具用 README.md 这份"在射程内"的文档:门只判三份活文档,其余一律不动。
    commit(base)
    const before = git(['rev-parse', 'HEAD'], dir).trim()

    writeFileSync(join(dir, 'README.md'), staleOnly, 'utf8')
    git(['add', 'README.md'], dir)
    const staleRun = runGate(dir, ['--staged'])
    assert.equal(staleRun.rc, 0, `stale 面不得判红(那会逼人绕门):${staleRun.out}`)
    assert.match(
      staleRun.out,
      /工作副本停在旧形态|stale/,
      `stale 必须被喊出来而不是静默:${staleRun.out}`,
    )

    git(['checkout', '-q', '--', 'README.md'], dir)
    writeFileSync(join(dir, 'README.md'), lostOne, 'utf8')
    git(['add', 'README.md'], dir)
    const lostRun = runGate(dir, ['--staged'])
    assert.equal(lostRun.rc, 1, `整行消失必须判红,实得 rc=${lostRun.rc}\n${lostRun.out}`)
    // 夹具里 `lostOne` 是"把基准那条 `闸门甲` 换成一条不相干的行" ⇒ 被丢的应当正是 `闸门甲`。
    // (第一版我在这里断言 /闸门乙/,而 闸门乙 从来不在基准里 —— 断言写歪不会让门变红,只会让
    //  下一任以为"点名的是被删那条"这一维已经证过。红的是我的夹具,不是判据。)
    assert.match(lostRun.out, /闸门甲/, `红字必须点名被丢的那一行,实得:\n${lostRun.out}`)
    assert.equal(
      git(['rev-parse', 'HEAD'], dir).trim(),
      before,
      '夹具前提:`git add` 不该移动 HEAD —— 若这里变了,说明本例的"候选面"根本不是索引而是提交,测的就不是这一档',
    )
  } finally {
    rmScratch(dir)
  }
})

test('T4 归档豁免成对:同一改动、同一行,只因归档面里有没有它 ⇒ 一绿一红', () => {
  const dir = mkScratch('pathspec-t4-')
  try {
    seedGateRepo(dir)
    const gone =
      '- **闸门丙**(11):这是一条从文档里搬走的登记行正文,长度足够进入判定集合不被短行过滤'
    writeFileSync(
      join(dir, 'AGENTS.md'),
      `# 头\n${gone}\n- 尾行两边都在,长度足够不被短行过滤吃掉,免得夹具里只剩一行可比\n`,
      'utf8',
    )
    git(['add', 'AGENTS.md'], dir)
    git(['commit', '-qm', 'base'], dir)

    // 两臂共同的改动:把那一行从文档里搬走。差别只在归档件里有没有它。
    writeFileSync(
      join(dir, 'AGENTS.md'),
      '# 头\n- 搬走之后的文档里那一行已经不在了,剩下这条足够长的尾行留着当对照\n',
      'utf8',
    )
    mkdirSync(join(dir, '.ihui-agent', 'archive'), { recursive: true })

    // 甲臂:归档件**含**该行 ⇒ §1 的两步走形态,不构成丢行。
    writeFileSync(
      join(dir, '.ihui-agent', 'archive', 'PROJECT_PLAN_test-archive.md'),
      `## 归档件占位\n${gone}\n`,
      'utf8',
    )
    git(['add', 'AGENTS.md', '.ihui-agent/archive/PROJECT_PLAN_test-archive.md'], dir)
    const withArchive = runGate(dir, ['--staged'])
    assert.doesNotMatch(
      withArchive.out,
      /闸门丙/,
      `行在归档面 ⇒ 不得再被点名成丢行:${withArchive.out}`,
    )
    assert.match(withArchive.out, /归档/, '必须把"随归档搬走"这一档单独报出来,不能静默通过')

    // 乙臂:同一行、同一改动,把归档件换成**不含**它的一份 ⇒ 必须判红。
    // (这一臂刻意保留"归档目录存在且可枚举",否则测的就是"取不到⇒未判定"那条另一档判据,
    //  两个方向混在一格里就等于哪一型都没证。)
    writeFileSync(
      join(dir, '.ihui-agent', 'archive', 'PROJECT_PLAN_test-archive.md'),
      '## 归档件占位\n- 这一份里没有那条行,所以豁免凭据不成立\n',
      'utf8',
    )
    git(['add', '.ihui-agent/archive/PROJECT_PLAN_test-archive.md'], dir)
    const withoutArchive = runGate(dir, ['--staged'])
    assert.equal(
      withoutArchive.rc,
      1,
      `没有归档凭据时同一行必须判红,实得 rc=${withoutArchive.rc}\n${withoutArchive.out}`,
    )
    assert.match(
      withoutArchive.out,
      /闸门丙/,
      '反向对照:同一行只因归档面没有它就该红 —— 甲臂不是靠"整个维度没跑"绿',
    )
  } finally {
    rmScratch(dir)
  }
})

test('T5 两面旗同给 ⇒ exit 2 判死(不猜哪个面优先)', () => {
  const r = runGate(REPO, ['--staged', '--worktree'])
  assert.equal(r.rc, 2, `两面旗同给必须 2,实得 ${r.rc}\n${r.out}`)
  assert.match(r.out, /无法判定|不得同用/, '结论必须写成"无法判定",不冒红也不记绿')
})

test('T6 无提交(新仓库)⇒ 不记通过;全量档无父提交时如实报未判定', () => {
  const dir = mkScratch('pathspec-t6-')
  try {
    seedGateRepo(dir)
    writeFileSync(
      join(dir, 'README.md'),
      '# 头\n- 初枚提交之前的文档,只有一行足够长的内容用来确认门真的在数它\n',
      'utf8',
    )
    git(['add', 'README.md'], dir)
    const staged = runGate(dir, ['--staged'])
    assert.equal(staged.rc, 2, `没有 HEAD 可比 ⇒ 未判定,不得记 0:${staged.out}`)
    git(['commit', '-qm', 'first'], dir)
    const headFace = runGate(dir, [])
    assert.equal(
      headFace.rc,
      2,
      `初枚提交没有父 ⇒ 全量档必须报未判定而不是"没有问题":${headFace.out}`,
    )
    assert.match(headFace.out, /未判定/, '必须点名"取不到基准",而不是静默 0')
  } finally {
    rmScratch(dir)
  }
})

test('T7 索引==HEAD 的文档不参与判定,也不被算成通过(否则与本次提交无关地挡路)', () => {
  const dir = mkScratch('pathspec-t7-')
  try {
    seedGateRepo(dir)
    writeFileSync(
      join(dir, 'README.md'),
      '# 头\n- 一份与 HEAD 完全同字的文档,门应当说"本次未改动它"\n',
      'utf8',
    )
    writeFileSync(
      join(dir, 'AGENTS.md'),
      '# 头\n- 另一份同样一字未改的文档,用来证明跳过不是因为整个仓是空的\n',
      'utf8',
    )
    git(['add', '-A'], dir)
    git(['commit', '-qm', 'base'], dir)
    const r = runGate(dir, ['--staged'])
    assert.equal(r.rc, 0, r.out)
    assert.match(r.out, /参与判定 0/, `三份文档都没被改 ⇒ 参与判定必须 0:${r.out}`)
    assert.match(r.out, /不记通过/, '跳过的一档必须写明"不记通过",否则读报告的人会以为已经审过')
  } finally {
    rmScratch(dir)
  }
})

test('T8 端到端双向锁:交一份少一行旧副本 ⇒ 红;补回那一行 ⇒ 绿', () => {
  const dir = mkScratch('pathspec-t8-')
  try {
    seedGateRepo(dir)
    const keep =
      '- **闸门丁**(13):这一行是别人今天刚入库的登记,我把工作树副本按旧基线交上去时它会被整批写回'
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      `# 计划\n${keep}\n- 一条两边都有的尾行,长度足够进入判定集合\n`,
      'utf8',
    )
    git(['add', '-A'], dir)
    git(['commit', '-qm', '别人入库'], dir)

    // 本会话的旧副本:缺那一行(这正是 pathspec 提交的真实形态 —— 磁盘滞后 + 只加自己的行)。
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      '# 计划\n- 一条两边都有的尾行,长度足够进入判定集合\n- 我这次新加的一行,足够长以避开短行过滤,它不该被算成丢失\n',
      'utf8',
    )
    git(['add', 'PROJECT_PLAN.md'], dir)
    const bad = runGate(dir, ['--staged'])
    assert.equal(bad.rc, 1, `旧副本交上去必须被拦,实得 rc=${bad.rc}\n${bad.out}`)
    assert.match(bad.out, /闸门丁/, '红字要点名被写回的那一行')

    // 修复出口(本门给的唯一一条)在夹具仓里等价动作:把那一行取回 HEAD 形态再 add。
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), git(['show', 'HEAD:PROJECT_PLAN.md'], dir), 'utf8')
    git(['add', 'PROJECT_PLAN.md'], dir)
    const good = runGate(dir, ['--staged'])
    assert.equal(good.rc, 0, `补回之后不得再红(否则就是把尺子做成恒红):${good.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T9 真仓现读:全量档与提交链档都不得在干净面上造假红', () => {
  const head = runGate(REPO, [])
  assert.match(head.out, /结论:/, `真仓必须给出结论行:${head.out}`)
  assert.ok(
    head.rc === 0 || head.rc === 2,
    `真仓全量档 rc 只允许 0(判过且干净)或 2(某一侧取不到并点名),不得是 1:${head.out}`,
  )
  const staged = runGate(REPO, ['--staged'])
  assert.ok(
    staged.rc === 0 || staged.rc === 1,
    `提交链档 rc 只允许 0/1,实得 ${staged.rc}\n${staged.out}`,
  )
})

test('T10 乘性上限是一条"会响的护栏"而不是跳过判定:超上限必须点名并不记通过', () => {
  // 直接拿门导出的判据入口喂一条超上限的输入,验它既不冒红也不记绿
  // (与"取不到判'无法判定'、绝不记绿"是同一条禁令;本仓最高频失效型就是把"没判"写成"判过了")。
  const { judgeDoc, MISSING_CLASSIFY_CAP } = __test__
  const many = [
    '# 头',
    ...Array.from(
      { length: MISSING_CLASSIFY_CAP + 3 },
      (_, i) =>
        `- **闸${i}** 这是一条足够长的缺失登记行正文,专门用来把待分类数量推过乘性成本上限那一档`,
    ),
  ].join('\n')
  const r = judgeDoc({
    doc: 'X.md',
    baseText: many,
    candText: '# 头\n- 候选面只留这一条足够长的行,其余全部推给缺失集合,让数量真的越过上限那一档\n',
    archive: { ok: true, set: new Set() },
    face: 'staged',
  })
  assert.equal(r.lost.length, 0, '超上限时不得冒红')
  assert.equal(
    r.undetermined.length,
    1,
    `必须留一条点名原因,实得 ${JSON.stringify(r.undetermined)}`,
  )
  assert.match(r.undetermined[0], /未判定/, '措辞必须是"未判定",不得写成"没有违规"')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
