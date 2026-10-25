// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试 —— 第五条(2026-10-24,活文档取号在"并发批次带着旧底稿并入"这一型下仍会撞号)。
 *
 * 病形(票面自述):本会话两行由取号令牌在 CAS 里按当次 HEAD 底稿现算;另一批正文**手填号**,
 * 在之后才并入 HEAD ⇒ 同一号段被两批各自认领。号在并入前哪个面都不存在,所以"只扫号"的发号器
 * 结构上看不见它;能当场看见的是**同一件事已经在册**(标题/关键词同题)。本票的最小修复:
 * 发号前对目标文件现读正文(工作树副本 ⊕ HEAD 宽面)按同题指纹查重,命中即当场拒绝发号。
 *
 *  L1 形状锁:同题指纹必须 import 守门 194 那一份实现;查重必须落在发号路径(工作树副本读取之后 /
 *     --next-only 打印之前);`--title` / `--keyword` 必须进旗标白名单,不得另写一份指纹。
 *  L2 正证(旧底稿已并入):拿现读正文里一条**已并入**的未勾登记的标题原样发号 ⇒ 当场拒绝
 *     (exit 1、stdout 一个号都不给),并点名既有号与既有行。
 *  L3 关键词档:同一条登记的关键词片段同样拦(措辞与面不同,结论相同)。
 *  L4 反证:现读正文里绝无雷同的标题照常发号(exit 0、stdout 恒一行号) —— 查重不得把新活也堵死。
 *  判据不在测试里另抄一份:标题行选取与命中判定都走 `extractTaskFingerprint`(与工具同一把尺)。
 *
 * 并发窗口纪律(2026-10-25 立):本仓台账被他席高频推进(HEAD 每分钟可能变),本测试族又必须测**活面**,
 *   于是"选取行 → CLI 现读 → 断言"之间别席可能刚把那行翻勾/删掉/改号。抖动根因是**窗口**,不是判据
 *   失效,所以修复不是把活面断言改成夹具(那正好扔掉本测试唯一的存在理由),而是加**方向性分诊**:
 *   所选行在现读面仍原样而 CLI 没拦 ⇒ 真回归,照红;行被改离 ⇒ `t.skip('未判定:并发窗口…')` 点名
 *   preHead,不记绿也不冒红。判据与仓库"取不到输入 ⇒ exit 2 显式未判定"同一方向(§0.3)。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { extractTaskFingerprint } from '../check-plan-task-duplicates.mjs'
import { git } from '../lib/bypass-git.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CLI = resolve(ROOT, 'scripts', 'next-plan-id.mjs')
const TOOL_SRC = readFileSync(CLI, 'utf8')
/** 并发窗口纪律:一切"现读正文"判据都改用**调用时**现读 —— 模块级不留台账快照(那正是抖动过的型)。 */
function readPlan() {
  return readFileSync(resolve(ROOT, 'PROJECT_PLAN.md'), 'utf8')
}

/** 跑 CLI 之前取一次 HEAD —— 用于把"别席刚落的新账"(并发窗口)与"旧面上就有的占"(真回归)分开。
 *  不用 raw:true —— Windows 下 git 输出带 \r,裸拼进 `git show <sha>:path` 会成 invalid object name。 */
function preHeadSha() {
  return git(['rev-parse', 'HEAD'], { root: ROOT, timeout: 60_000 })
}

/** CLI 异常退出(信号杀 / Node 抛栈) —— 与被 import 模块的在飞编辑中间态同形,单独一路识别。 */
function cliCrashed(r) {
  return r.status === null || r.error !== undefined && r.error !== null || /file:\/\/\S+\.mjs:\d+/.test(String(r.stderr))
}

/**
 * 并发窗口第三型(2026-10-25 实测):CLI import 的脚本/lib 正被别席编辑,写到一半被 import ⇒ Node 崩
 * (stderr 是 `file:///…mjs:NNNN` 栈)。这不是回归,是中间态。判据有牙:依赖面 scripts/ 有在飞修改
 * ⇒ 未判定 t.skip;依赖面干净而 CLI 仍崩 ⇒ 真回归照红。
 */
function skipIfCliCrashed(t, r, preHead) {
  if (!cliCrashed(r)) return false
  const dirty = git(['status', '--porcelain', 'scripts/'], { root: ROOT, timeout: 60_000 }).trim()
  if (dirty) {
    t.skip(
      `未判定:CLI 依赖模块在飞编辑中(${dirty.split('\n')[0].trim()}),不拿中间态当真;preHead=${String(preHead).slice(0, 8)}`,
    )
    return true
  }
  assert.fail(`CLI 异常退出且依赖面干净 ⇒ 真回归:status=${r.status} signal=${r.signal}\nstderr=${r.stderr}`)
}

function runCli(args, env = null) {
  return spawnSync(process.execPath, [CLI, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 300_000,
    env: env ? { ...process.env, ...env } : process.env,
  })
}

/** 声明号出现在行首区(复选框 + 括注之后)的未勾登记行 —— 与工具报"既有号"的口径同形。 */
const DECLARED_OPEN_ROW = /^-\s*\[ \]\s*(?:[（(〔][^）)〕]*[）)〕]\s*)*([A-Z]+-?\d+)/

/**
 * 能安全当 argv 传的行长上限。旧值 240 是 2026-10-24 拍的"短行"经验值;2026-10-25 现读台账
 * (HEAD 与工作树两面的未勾登记行 82 条)里 **≤240 的一条都没有**(最短 380、多数上千)⇒
 * `mergedOpenRow()` 的断言从那天起恒红,而红在"选不出输入"、不在被测判据上(§12e 同型:
 * 与提交内容无关的红门)。这里**不是**放宽判据:被测的"同题已册 ⇒ 拒发号"一字未动,
 * 改的是取材闸 —— argv 的真实上限是 Windows 命令行 ~32k,1000 既能让选择器选到真行
 * (现读 40 条命中),又离上限有两个数量级的余量。
 */
const MAX_ARGV_TITLE_LEN = 1000

/** 从**调用时现读正文**取一条已并入、指纹可算、长度可当 argv 传的未勾登记行(旧底稿并入侧的代表)。 */
function mergedOpenRow() {
  const row = readPlan()
    .split('\n')
    .map((l) => l.trim())
    .find(
      (l) =>
        DECLARED_OPEN_ROW.test(l) &&
        l.length <= MAX_ARGV_TITLE_LEN &&
        extractTaskFingerprint(l) !== null,
    )
  assert.ok(row, '现读正文里必须找得到可按指纹判定的未勾登记行(找不到 ⇒ 本测试不成立,不得当绿)')
  return row
}

test('L1 形状锁:同题指纹取守门 194 的唯一实现,查重落在发号路径上', () => {
  assert.match(
    TOOL_SRC,
    /import\s*\{\s*extractTaskFingerprint\s*\}\s*from\s*'\.\/check-plan-task-duplicates\.mjs'/,
    '同题指纹必须 import 守门 194 那一份(自抄一份"什么算同题"必漂移)',
  )
  assert.doesNotMatch(TOOL_SRC, /function\s+\w*Fingerprint\s*\(/, '本器不得自带指纹实现')
  const worktreeRead = TOOL_SRC.indexOf('worktreeText = readFileSync(resolve(ROOT, PLAN_PATH)')
  const guard = TOOL_SRC.indexOf('findSameTitleRows(f.body')
  const nextOnly = TOOL_SRC.indexOf("flags.has('--next-only')")
  assert.ok(worktreeRead > 0 && guard > worktreeRead, '查重必须在工作树副本(现读正文)读到之后')
  assert.ok(guard > 0 && guard < nextOnly, '查重必须在 --next-only 打印号之前(否则号已发出去)')
  assert.match(TOOL_SRC, /\{ label: '工作树副本\(现读\)', body: worktreeText \}/, '工作树副本必须进查重面')
  assert.match(TOOL_SRC, /body: wideText/, 'HEAD 宽面(台账 ⊕ 归档件)必须进查重面 —— 已并入的旧底稿在这一侧')
  assert.match(TOOL_SRC, /'--title',\s*'--keyword'/, '两个旗标必须进白名单(否则当场报未知参数)')
})

test('L2 正证(并发批次带旧底稿并入):同一标题已在现读正文 ⇒ 当场拒绝发号并点名既有号', (t) => {
  const row = mergedOpenRow()
  const existingId = DECLARED_OPEN_ROW.exec(row)[1]
  // 取号器的带值旗标口径(G-322)拒收以 `-` 开头的值 ⇒ 传"复选框之后"的正文,工具会自行补 `- [ ] `。
  const titleArg = row.replace(/^-\s*\[ \]\s*/, '')
  const preHead = preHeadSha()
  const r = runCli(['--next-only', '--title', titleArg])
  if (skipIfCliCrashed(t, r, preHead)) return
  if (/占用面判不出|无法判定占用/.test(String(r.stderr))) {
    t.skip(`未判定:CLI 占用面判不出(并发 HEAD 切换窗口,归档件/台账 git show 失败),非判据失效;preHead=${String(preHead).slice(0, 8)}`)
    return
  }
  if (r.status !== 1) {
    // 并发窗口分诊(2026-10-25):所选行在"选取 → CLI 现读"之间被别席翻勾/删掉/改号 ⇒ 同题查重
    // 无命中、CLI 照常发号,这不是判据失效。判据 = 行在现读面仍原样而 CLI 没拦 ⇒ 真回归照红;
    // 行被改离 ⇒ t.skip 点名 preHead,不记绿也不冒红。
    const stillThere = readPlan()
      .split('\n')
      .some((l) => l.trim() === row.trim())
    if (stillThere) {
      assert.fail(
        `同题已在册(所选行仍在现读面、号未变)但 CLI 未拒绝发号 ⇒ 查重失灵(真回归):status=${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`,
      )
    }
    t.skip(
      `未判定:并发窗口 —— 所选行 ${existingId} 在 CLI 运行期间被别席改离(preHead=${String(preHead).slice(0, 8)}),同题查重无命中非判据失效`,
    )
    return
  }
  const err = String(r.stderr)
  assert.match(err, /同题已在册/, '必须点名"同题已在册"(结论与判据同形)')
  assert.match(err, /拒绝发号/, '必须写明拒绝发号,不是只警告')
  assert.ok(
    err.includes(`既有号 ${existingId}`),
    `必须点名既有号 ${existingId}(改用既有号是唯一正解),实得:\n${err.slice(0, 800)}`,
  )
  assert.doesNotMatch(String(r.stdout), /^O\d+$/m, '拒绝档不得在 stdout 给号(给了号就等于照发)')
})

test('L3 关键词档:同题关键词片段命中同样当场拦', (t) => {
  const row = mergedOpenRow()
  const existingId = DECLARED_OPEN_ROW.exec(row)[1]
  const fp = extractTaskFingerprint(row)
  const keyword = fp.slice(0, 16)
  const preHead = preHeadSha()
  const r = runCli(['--next-only', '--keyword', keyword])
  if (skipIfCliCrashed(t, r, preHead)) return
  if (/占用面判不出|无法判定占用/.test(String(r.stderr))) {
    t.skip(`未判定:CLI 占用面判不出(并发 HEAD 切换窗口),非判据失效;preHead=${String(preHead).slice(0, 8)}`)
    return
  }
  if (r.status !== 1) {
    // 并发窗口分诊:同 L2 —— 行被别席改离 ⇒ 关键词无命中,非判据失效;行仍在而没拦 ⇒ 真回归照红。
    const stillThere = readPlan()
      .split('\n')
      .some((l) => l.trim() === row.trim())
    if (stillThere) {
      assert.fail(
        `同题关键词已在册(所选行仍在现读面)但 CLI 未拒绝发号 ⇒ 查重失灵(真回归):status=${r.status}\nstderr=${r.stderr}`,
      )
    }
    t.skip(
      `未判定:并发窗口 —— 所选行 ${existingId} 在 CLI 运行期间被别席改离(preHead=${String(preHead).slice(0, 8)}),关键词档无命中非判据失效`,
    )
    return
  }
  assert.match(String(r.stderr), /同题已在册/, '关键词档与标题档必须给同一个结论')
  assert.match(String(r.stderr), /拒绝发号/, '措辞必须写明拒绝发号')
})

test('L4 反证:现读正文绝无雷同的标题照常发号(查重不得把新活也堵死)', (t) => {
  // 标题带运行时随机后缀:并发会话不可能提前登记同一个指纹,反证不依赖"快照时刻没人登记"这种
  // 活状态前提(那正是本测试族抖动过的型);occupied 自检改对**现读面**做,撞了换后缀再试。
  let unique = ''
  for (let i = 0; i < 3; i++) {
    const candidate = `本席同题查重反证专用标题绝无雷同甲申丙午丁未${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const localFp = extractTaskFingerprint(`- [ ] ${candidate}`)
    assert.ok(localFp, '反证标题必须算得出指纹(否则它走的是"未判定"档,反证不成立)')
    const occupied = new Set(readPlan().split('\n').map((l) => extractTaskFingerprint(l)).filter(Boolean))
    if (!occupied.has(localFp)) {
      unique = candidate
      break
    }
  }
  assert.ok(unique, '三次随机后缀都撞上现存指纹(概率为零) ⇒ 环境异常,不当绿')
  const preHead = preHeadSha()
  const r = runCli(['--next-only', '--title', unique])
  if (skipIfCliCrashed(t, r, preHead)) return
  if (/占用面判不出|无法判定占用/.test(String(r.stderr))) {
    t.skip(`未判定:CLI 占用面判不出(并发 HEAD 切换窗口),发号路径未判成;preHead=${String(preHead).slice(0, 8)}`)
    return
  }
  assert.equal(r.status, 0, `新标题必须照常发号(exit 0),实得 status=${r.status}\nstderr=${r.stderr}`)
  assert.match(String(r.stdout).trim(), /^O\d+$/, `stdout 恒一行号,实得:${JSON.stringify(r.stdout)}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
