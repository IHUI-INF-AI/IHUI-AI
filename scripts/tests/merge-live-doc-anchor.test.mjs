// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `merge-live-doc.mjs` 的 CLI 级装车证明(2026-09-25 立)
 *
 * 为什么这一份必须存在,而文件内 `--self-test` 的 13→16 例不够:
 * `merge-live-doc.mjs` 顶层就是 CLI 主流程、**没有 §22d 的 isDirectRun 守卫**(它的相似度
 * 工具因此早已被抽到 `lib/live-doc-similarity.mjs`),所以测试无法 `import` 它的判据函数。
 * 本测试改用**同形取证**:把脚本连同一个临时 git 仓摆好,直接 spawn 已装车的 CLI。
 *
 * 两臂都是必须的:
 *   A 就地改写(改的是行**中段**,旧行既不逐字存活、Jaccard 也低于阈值)⇒ 真丢失必须 = 0。
 *     立因:2026-09-25 我改守门 84 的登记行,工具判"真丢失"并要求 `--apply`,而照它做就是把
 *     新旧两行同时留下 —— 本仓已出现三次的重复登记行正是这么造出来的。
 *   B 整行删除 ⇒ 真丢失必须 = 1。锚点规则只能把"改写"从"丢失"里分出来,绝不能反过来
 *     替真删除洗地(那是比误报更坏的一侧)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 闭包由共用层递归求值(§0.6/§22c):测试自己列清单 = 第二份"什么算依赖",生产加一跳就必然漏拷。
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
// 按 §22c:取真值源,不在测试里复制一份实现(相似度工具正是为此被抽成 lib 的)。
import { SIM_THRESHOLD, jaccard, tokenize } from '../lib/live-doc-similarity.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GIT = 'git'

/**
 * 闭包必须一起拷(2026-09-29 立)。`anchorKey`/`classifyMissing` 从 `merge-live-doc.mjs` 搬进了
 * `scripts/lib/live-doc-classify.mjs`(唯一实现下沉,供新常驻判据 `check-live-doc-pathspec.mjs`
 * 与归并器共用同一把尺子 —— 两处各算一遍"什么算丢了"必然漂开,§22c 同一条理由)。
 * 搬走之后,只拷 `merge-live-doc.mjs` + `live-doc-similarity.mjs` 的夹具会 MODULE_NOT_FOUND:
 * 被 spawn 的 CLI **一个字都不打**,而下面 `counts()` 把"没解析出来"折成 `-1` ⇒ 五条用例同时红,
 * 红语是"改写被判吃掉/删行没报丢失" —— 夹具缺件伪装成判据失效,与本仓"取证工具坏了表现得像
 * 仓库坏了"那一族同型。所以这一件单独抽成函数,两个夹具入口共用,且 `counts()` 先判"报告在不在"。
 *
 * 〔2026-10-28 收口〕这里曾逐文件手写清单(2026-09-29 两件 → 2026-10-25 补 archive-drops 一件)。
 * 现读证据:HEAD `0a3defae5a`(2026-10-26)给 `live-doc-archive-drops.mjs` 加了 `./ledger-move-aware.mjs`
 * 与 `./plan-task-headings.mjs` 两跳,**清单没跟着加** ⇒ 本文件 5/7 例自那天起恒红(`真丢失= -1`、
 * 报告空),红语依旧长成"判据失效"的样子(§12f:判据失效的表现永远是安静)。改成走
 * `copyScriptWithClosure` 的递归闭包:闭包由**生产文件的 import 语句**现算,测试里不再有第二份清单。
 */
function copyClassifyClosure(dir) {
  copyScriptWithClosure(join(REPO, 'scripts'), 'merge-live-doc.mjs', join(dir, 'scripts'), [
    'lib/live-doc-classify.mjs',
    'lib/live-doc-archive-drops.mjs',
    'lib/ledger-move-aware.mjs',
    'lib/plan-task-headings.mjs',
  ])
}

// 两行刻意"中段全换":锚点 `- **闸门甲**(7)` 相同,正文几乎不重叠。
const OLD_LINE = '- **闸门甲**(7):旧口径把 merge 与 cherry-pick 一起整轮放行,取证 8 例'
const NEW_LINE =
  '- **闸门甲**(7):新口径只在 MERGE_HEAD 上跑三条件窄判据 ours==theirs ∧ index!=ours ∧ index∈历史祖先,取证扩到 12 例并补一把反向回归锁,真仓两条口径复测均 rc=0'

function seedRepo() {
  const dir = mkScratch('merge-live-doc-cli-')
  execFileSync(GIT, ['-c', 'safe.directory=*', 'init', '-q', '--initial-branch=main'], {
    cwd: dir,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const g = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  g('config', 'user.email', 't@t')
  g('config', 'user.name', 't')
  // 被测对象是**仓库里那份**脚本(不是复制品)—— 拷贝只为让它在新仓里可被 spawn。
  mkdirSync(join(dir, 'scripts', 'lib'), { recursive: true })
  copyFileSync(join(REPO, 'scripts/merge-live-doc.mjs'), join(dir, 'scripts/merge-live-doc.mjs'))
  copyFileSync(
    join(REPO, 'scripts/lib/live-doc-similarity.mjs'),
    join(dir, 'scripts/lib/live-doc-similarity.mjs'),
  )
  copyClassifyClosure(dir)
  const doc = (body) => writeFileSync(join(dir, 'AGENTS.md'), body, 'utf8')
  doc(`# 头\n${OLD_LINE}\n- 无关行\n`)
  g('add', '-A')
  g('commit', '-qm', 'seed')
  const run = () => {
    try {
      return execFileSync(
        process.execPath,
        [join(dir, 'scripts/merge-live-doc.mjs'), '--file', 'AGENTS.md'],
        {
          cwd: dir,
          encoding: 'utf8',
          windowsHide: true,
          timeout: 120000,
          // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )
    } catch (e) {
      // 判红时 CLI 以非零退出;报告正文仍要读出来算数
      return String(e.stdout || '')
    }
  }
  const counts = (out) => ({
    lost: Number(/真丢失\(需插回\)= (\d+)/.exec(out)?.[1] ?? -1),
    superseded: Number(/被就地改写取代\(不插回\)= (\d+)/.exec(out)?.[1] ?? -1),
    stale: Number(/工作树滞后旧态[^=]*= (\d+)/.exec(out)?.[1] ?? -1),
  })
  return { dir, doc, run, counts }
}

test('A 就地改写(锚点相同、正文全换)⇒ 真丢失=0,且不再要求 --apply', () => {
  const { dir, doc, run, counts } = seedRepo()
  try {
    doc(`# 头\n${NEW_LINE}\n- 无关行\n`)
    const out = run()
    const c = counts(out)
    assert.equal(c.lost, 0, `改写被判吃掉 ⇒ 会逼人 --apply 造出重复登记行。报告:\n${out}`)
    assert.equal(c.superseded, 1, '应恰有一行判"被就地改写取代"')
    /**
     * 2026-09-25 改的断言方向:旧版这里要求结论行写「可安全提交」,而那正是被证伪的承诺 ——
     * `lost=0` 只保证"没有整行不见",superseded/stale 两类的定义恰恰是"HEAD 的那一行文字
     * 不在工作树里"。实测 20 条登记行就在这句绿灯下被退回旧态。所以本例现在断言的是:
     * **有任一非逐字存活行时,结论行不得声称 ⊇ HEAD**。
     */
    assert.doesNotMatch(
      out,
      /工作树 ⊇ HEAD\(逐字包含/,
      '有改写行时不得再声称逐字 ⊇ HEAD(那是假保证)',
    )
    assert.match(out, /不等于\*\*工作树 ⊇ HEAD/, '结论行必须按实际形态说话')
  } finally {
    rmScratch(dir)
  }
})

test('D 工作树停在旧形态(HEAD 翻勾 + 追加注记)⇒ 报 stale=1,且与 superseded 分列', () => {
  const base =
    '一条登记行的正文长到足以进入判据集合,并且在工作树里存在一个未翻勾的旧副本,别处不留它的文字'
  const { dir, doc, run, counts } = seedRepo()
  const g = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  try {
    // 先把 HEAD 推到"已翻勾 + 追加注记"那一版并入库,再把工作树写回未翻勾的旧形态 ——
    // stale 的定义就是工作树比 HEAD 旧,所以必须先建 commit 再改盘(A 例不需要是因为它只比 seed)。
    doc(
      `# 头\n- [x] ✅(2026-09-25) ${base} 〔同日追加的注记让 HEAD 侧成为工作树的严格超集〕\n- 无关行\n`,
    )
    g('add', '-A')
    g('commit', '-qm', 'head 侧翻勾并追加注记')
    doc(`# 头\n- [ ] ${base}\n- 无关行\n`)
    const out = run()
    const c = counts(out)
    assert.equal(c.lost, 0, `旧形态行不该被判整行丢失:\n${out}`)
    assert.equal(c.stale, 1, `应恰有一行判"工作树滞后旧态",实得 ${c.stale} —— 报告:\n${out}`)
    assert.equal(c.superseded, 0, 'stale 必须与"被人改写"分列 —— 两者处置动作不同')
    assert.match(out, /stale 那几条要人工取 HEAD 形态/, '报告要给出出口,不能只报数')
  } finally {
    rmScratch(dir)
  }
})

test('B 反向对照:整行删除 ⇒ 真丢失仍=1(锚点规则不得替真删除洗地)', () => {
  const { dir, doc, run, counts } = seedRepo()
  try {
    doc('# 头\n- 无关行\n') // 登记行被整个删掉,工作树没有同锚点行
    const c = counts(run())
    assert.equal(c.lost, 1, `真删除必须报丢失,实际 lost=${c.lost}(本测试是判据失效的哨兵)`)
    assert.equal(c.superseded, 0, '没有任何同锚点的新行,不该被判成改写')
  } finally {
    rmScratch(dir)
  }
})

test('C 对照组自证:两行确实"不像",否则 A 臂测的是别的东西', () => {
  // A 臂之所以能证明锚点规则在起作用,前提是这条改写**既不逐字存活、Jaccard 也低于阈值**;
  // 若哪天有人把夹具改成"很像"的两行,A 臂就退化成容器短路的测试了 —— 这一条就是防它退化。
  assert.ok(
    jaccard(tokenize(OLD_LINE), tokenize(NEW_LINE)) < SIM_THRESHOLD,
    '夹具失效:两行已足够相似,A 臂不再能证明锚点规则',
  )
  assert.ok(!NEW_LINE.includes(OLD_LINE), '夹具失效:旧行逐字存活 ⇒ A 臂走的是容器短路而非锚点')
})

/**
 * E 表格行(2026-09-25 加):README 的守门速查表同样是「一行一件事」的登记面。
 * 立因是我改 `| 13c |` 那一行时工具判"真丢失=1"并让我跑 `--apply` —— 照做就是把旧的
 * 补齐空格那一行原样插回,同一编号留下两行。表格行的稳定身份是前两格(编号 + 脚本名),
 * 锚点规则必须认它;但**整行被删**时仍要判 lost(B 臂的表格版)。
 */
const TBL_OLD =
  '| 13c | check-project-plan-archive.mjs | **已完成任务条目防误删**                    |'
const TBL_NEW =
  '| 13c | check-project-plan-archive.mjs | **防误删 + 归档锚点存续性 A0/A1/A2/A3,blocking,自测 17 条 + 镜像 20 例,无应急跳过通道** |'

function seedTableRepo() {
  const dir = mkScratch('merge-live-doc-tbl-')
  const g = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  execFileSync(GIT, ['-c', 'safe.directory=*', 'init', '-q', '--initial-branch=main'], {
    cwd: dir,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  g('config', 'user.email', 't@t')
  g('config', 'user.name', 't')
  mkdirSync(join(dir, 'scripts', 'lib'), { recursive: true })
  copyFileSync(join(REPO, 'scripts/merge-live-doc.mjs'), join(dir, 'scripts/merge-live-doc.mjs'))
  copyFileSync(
    join(REPO, 'scripts/lib/live-doc-similarity.mjs'),
    join(dir, 'scripts/lib/live-doc-similarity.mjs'),
  )
  copyClassifyClosure(dir)
  const readme = (body) => writeFileSync(join(dir, 'README.md'), body, 'utf8')
  readme(`| 编号 | 脚本 | 说明 |\n| --- | --- | --- |\n${TBL_OLD}\n`)
  g('add', '-A')
  g('commit', '-qm', 'seed table')
  const run = () => {
    try {
      return execFileSync(
        process.execPath,
        [join(dir, 'scripts/merge-live-doc.mjs'), '--file', 'README.md'],
        {
          cwd: dir,
          encoding: 'utf8',
          windowsHide: true,
          timeout: 120000,
          // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )
    } catch (e) {
      return String(e.stdout || '')
    }
  }
  const counts = (out) => ({
    lost: Number(/真丢失\(需插回\)= (\d+)/.exec(out)?.[1] ?? -1),
    superseded: Number(/被就地改写取代\(不插回\)= (\d+)/.exec(out)?.[1] ?? -1),
  })
  return { dir, readme, run, counts }
}

test('E 表格行就地改写 ⇒ 真丢失=0(不认表格锚点就会逼人 --apply 造出同号两行)', () => {
  const { dir, readme, run, counts } = seedTableRepo()
  try {
    readme(`| 编号 | 脚本 | 说明 |\n| --- | --- | --- |\n${TBL_NEW}\n`)
    const out = run()
    const c = counts(out)
    assert.equal(c.lost, 0, `表格行改写被误判成丢失 ⇒ 报告:\n${out}`)
    assert.equal(c.superseded, 1, '应恰有一行判成"被就地改写取代"')
  } finally {
    rmScratch(dir)
  }
})

test('E-b 反向对照:表格整行被删 ⇒ 真丢失仍=1(锚点不得替删行洗地)', () => {
  const { dir, readme, run, counts } = seedTableRepo()
  try {
    readme('| 编号 | 脚本 | 说明 |\n| --- | --- | --- |\n')
    const c = counts(run())
    assert.equal(c.lost, 1, `删行必须报丢失,实得 lost=${c.lost}`)
    assert.equal(c.superseded, 0, '无同键新行时不该判成改写')
  } finally {
    rmScratch(dir)
  }
})

test('E-c 夹具自证:两条表行确实"不像"且表头/分隔行不冒充数据行', () => {
  assert.ok(
    jaccard(tokenize(TBL_OLD), tokenize(TBL_NEW)) < SIM_THRESHOLD,
    '夹具失效:两行已足够相似,E 臂不再证明表格锚点在起作用',
  )
  assert.ok(!TBL_NEW.includes(TBL_OLD), '夹具失效:旧行逐字存活 ⇒ 走的是容器短路')
})

/**
 * F 锚点缺失 ⇒ needHuman + 整路径回滚(2026-11-07 P0)
 *
 * 立因:归并器原先把"找不到锚点的 lost 段"无条件追加到文件末尾。多会话共享工作树下
 * README 的工作树副本常年滞后 HEAD ⇒ 同一批 HEAD 行被一轮一轮追加,尾部堆到 37,160 行 /
 * 8.0 MB(2026-11-07 实测),正文整体被挪到 `END RECENT UPDATES` 之后。现在锚点缺失即
 * 判 needHuman,并且在写盘(含备份)之前退出 1 —— 该路径逐字保持工作树原样。
 *
 * 三条断言(缺一臂就是拿判据洗地):
 *   F1 锚点缺失 ⇒ `--apply` 退出 1、文件逐字不变、不落 .bak,报告逐行点名缺锚点判据;
 *   F2 同一批次里的另一条正常文档照常落地 —— 路径隔离:一次缺锚点不得把别的文件一起卡死;
 *   F3 混合段(锚点存在 + 锚点缺失)⇒ 仍整路径回滚,锚点段也不得落半截结果(原子性)。
 */
const F_HEAD_A = '- 前导甲(工作树已整段重写,HEAD 这一版不再存活)\n'
const F_HEAD_B = '- 前导乙(同上,两行都找不到锚点)\n'
const F_WT_A = '- 工作树里完全不同的重写内容,与 HEAD 两行既不逐字相同也不相似 xxxx\n'
const F_KEEP = '- 尾行保留\n'

function seedP0Repo() {
  const dir = mkScratch('merge-live-doc-anchor-missing-')
  execFileSync(GIT, ['-c', 'safe.directory=*', 'init', '-q', '--initial-branch=main'], {
    cwd: dir,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const g = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  g('config', 'user.email', 't@t')
  g('config', 'user.name', 't')
  mkdirSync(join(dir, 'scripts', 'lib'), { recursive: true })
  copyFileSync(join(REPO, 'scripts/merge-live-doc.mjs'), join(dir, 'scripts/merge-live-doc.mjs'))
  copyFileSync(
    join(REPO, 'scripts/lib/live-doc-similarity.mjs'),
    join(dir, 'scripts/lib/live-doc-similarity.mjs'),
  )
  copyClassifyClosure(dir)
  return dir
}

function runP0Cli(dir, file, apply) {
  const args = [join(dir, 'scripts/merge-live-doc.mjs'), '--file', file]
  if (apply) args.push('--apply')
  try {
    const stdout = execFileSync(process.execPath, args, {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: 0, stdout }
  } catch (e) {
    return { status: e.status ?? -1, stdout: String(e.stdout || '') }
  }
}

function commitP0(dir, msg) {
  execFileSync(GIT, ['-c', 'safe.directory=*', 'add', '-A'], {
    cwd: dir,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  execFileSync(GIT, ['-c', 'safe.directory=*', 'commit', '-qm', msg], {
    cwd: dir,
    stdout: 'ignore',
    stderr: 'ignore',
  })
}

test('F1 锚点缺失 ⇒ needHuman,文件逐字不变,不落 .bak(2026-11-07 P0)', () => {
  const dir = seedP0Repo()
  try {
    // 缺锚点段必须落在文件最前(前面没有任何可锚定的存活 HEAD 行),否则会被 `# 头` 锚住。
    writeFileSync(join(dir, 'AGENTS.md'), `${F_HEAD_A}${F_HEAD_B}# 头\n${F_KEEP}`, 'utf8')
    commitP0(dir, 'seed 缺锚点')
    const before = readFileSync(join(dir, 'AGENTS.md'), 'utf8')
    writeFileSync(join(dir, 'AGENTS.md'), `# 头\n${F_WT_A}${F_KEEP}`, 'utf8')
    const afterWrite = readFileSync(join(dir, 'AGENTS.md'), 'utf8')

    const out = runP0Cli(dir, 'AGENTS.md', true)
    assert.equal(out.status, 1, `锚点缺失必须以退出码 1 交人工,实际 ${out.status}:\n${out.stdout}`)
    assert.match(out.stdout, /锚点缺失 ⇒ needHuman,本路径回滚/, '结论行必须说清回滚')
    assert.match(out.stdout, /缺锚点判据行数=2/, `缺锚点行必须逐行点名(实读报告:\n${out.stdout})`)
    assert.equal(
      readFileSync(join(dir, 'AGENTS.md'), 'utf8'),
      afterWrite,
      '回滚必须逐字保持工作树原样(不得把 HEAD 行挪到末尾)',
    )
    assert.ok(before !== afterWrite, '夹具失效:工作树没有先被改写')
    assert.ok(
      !existsSync(join(dir, '.ihui-agent', 'tmp')),
      '回滚路径不得先落备份(写盘与备份都必须在判定之后)',
    )
  } finally {
    rmScratch(dir)
  }
})

test('F2 路径隔离:同批次另一条正常文档照常落地,不被缺锚点路径卡死', () => {
  const dir = seedP0Repo()
  try {
    // A 路:缺锚点 ⇒ 回滚; B 路:锚点存在 ⇒ 正常归并写回。
    writeFileSync(join(dir, 'AGENTS.md'), `${F_HEAD_A}${F_HEAD_B}# 头\n${F_KEEP}`, 'utf8')
    writeFileSync(join(dir, 'README.md'), '# 头\n- 可定位的说明行\n- 尾行保留\n', 'utf8')
    commitP0(dir, 'seed 两文档')
    writeFileSync(join(dir, 'AGENTS.md'), `# 头\n${F_WT_A}${F_KEEP}`, 'utf8')
    const readmeBefore = readFileSync(join(dir, 'README.md'), 'utf8')
    writeFileSync(join(dir, 'README.md'), '# 头\n- 尾行保留\n', 'utf8')

    const a = runP0Cli(dir, 'AGENTS.md', true)
    const b = runP0Cli(dir, 'README.md', true)

    assert.equal(a.status, 1, `A 路必须判 needHuman:\n${a.stdout}`)
    assert.equal(
      readFileSync(join(dir, 'AGENTS.md'), 'utf8'),
      `# 头\n${F_WT_A}${F_KEEP}`,
      'A 路必须回滚成工作树原样',
    )
    assert.equal(b.status, 0, `B 路必须照常落地(一次冲突不得卡死别的文件):\n${b.stdout}`)
    assert.ok(
      readFileSync(join(dir, 'README.md'), 'utf8').includes('- 可定位的说明行'),
      'B 路没有把 HEAD 的说明行按锚点插回',
    )
    assert.ok(readmeBefore.includes('- 可定位的说明行'), '夹具失效:HEAD 侧没有待插回行')
  } finally {
    rmScratch(dir)
  }
})

test('F3 混合段(有锚点 + 缺锚点)⇒ 整路径回滚,锚点段也不得落半截', () => {
  const dir = seedP0Repo()
  try {
    // 段一(文件最前)整段缺锚点;段二在"中间保留行"之后,锚点存在 ⇒ 结果必须是一行都不写回。
    writeFileSync(
      join(dir, 'AGENTS.md'),
      '- 缺锚点前导甲\n- 缺锚点前导乙\n- 中间保留行\n- 有锚点段\n',
      'utf8',
    )
    commitP0(dir, 'seed 混合段')
    writeFileSync(
      join(dir, 'AGENTS.md'),
      '- 工作树重写行 xxxx,与 HEAD 两行都不相似\n- 中间保留行\n',
      'utf8',
    )
    const before = readFileSync(join(dir, 'AGENTS.md'), 'utf8')

    const out = runP0Cli(dir, 'AGENTS.md', true)
    assert.equal(out.status, 1, `混合段必须整路径判 needHuman:\n${out.stdout}`)
    assert.match(out.stdout, /缺锚点判据行数=2/, '缺锚点那两行必须点名')
    assert.equal(
      readFileSync(join(dir, 'AGENTS.md'), 'utf8'),
      before,
      '有锚点段也不得先落半截(路径级原子回滚)',
    )
    assert.ok(!readFileSync(join(dir, 'AGENTS.md'), 'utf8').includes('- 有锚点段'), '锚点段被写回')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
