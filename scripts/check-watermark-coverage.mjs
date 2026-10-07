#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 溯源水印覆盖守门(blocking, 2026-09-12 升级为**自愈式**)
 *
 * 背景: CI 的 `node scripts/watermark.mjs verify` 要求所有可注入源文件携带**完整可解码**水印。
 * 历史两次翻车:
 *   ① 新增文件未注入水印 -> 本地提交通过、CI 红(Provenance watermark check);
 *   ② 生成器/文本级改写把已跟踪文件的水印横幅或零宽载荷弄丢/弄坏 -> 门禁**恒红**,
 *      而当时工具无法复现自己强制的版式,导致只能靠 `HUSKY_SKIP_WATERMARK_GUARD=1` 绕过提交。
 *
 * 2026-09-12 根治(不再依赖"每个生成器自觉注入"):
 *   门禁自身具备**自愈能力** —— 检出缺口后自动 `clean + inject` 回写, 并同步 `git add` 到暂存区,
 *   使"未加水印的文件进入提交"这一状态在结构上不可能发生; 无论文件是被谁(生成器/脚本/sed)改写出来的。
 *   生成器自带注入(如 scripts/gen-i18n-compressed.mjs)仍保留, 属"更早一步"的优化,
 *   不再是唯一防线。
 *
 * 判定口径: `watermark.mjs list-uncovered`(载荷损坏 + 残迹 + 未覆盖) ∩ **分母集合**
 *   分母集合 = 已跟踪 ∪ 未跟踪但未忽略(唯一实现:`scripts/lib/watermark-scope.mjs`)。
 *   2026-09-27 G-253 并上未跟踪面:此前"只看已跟踪"把两格真实缺口挡在分母之外 ——
 *   新建还没 `git add` 的文件、以及**整文件重写把已跟踪文件的横幅冲掉后尚未 add** 的那一格。
 *   两格的失效形态相同:闸门一路绿灯,而盘上真有一个无水印的源文件等着进仓库。
 *   `.gitignore` 依旧把构建产物与本机临时面挡在分母外(`--exclude-standard`),
 *   所以"本地未跟踪产物不计入"这句原口径没有被放宽 —— 放宽的只是"注定要提交的那部分"。
 *
 * 用法:
 *   node scripts/check-watermark-coverage.mjs            # 自愈模式(pre-commit 默认)
 *   node scripts/check-watermark-coverage.mjs --no-fix   # 纯判定, 不修改(CI / 审计用)
 *   node scripts/check-watermark-coverage.mjs --self-test# 逻辑自检(零 git 调用、零副作用)
 * 紧急跳过: HUSKY_SKIP_WATERMARK_GUARD=1 git commit ...   (正常流程不再需要)
 */

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { readWorktreeFile } from './lib/face-reader.mjs'
import { createExclusionPredicate, LedgerUnavailable } from './lib/third-party-roots.mjs'
import { coverageFileSet } from './lib/watermark-scope.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = join(ROOT)
const NO_FIX = process.argv.includes('--no-fix')
/**
 * G-1018220(2026-10-04 收口):`--staged` 由 `scripts/guardian-runner.mjs` 在提交档统一追加。
 * 此前本门**不认识**这面旗,于是提交档判的是「整张共享索引」—— 别人 `git add` 过、
 * 而我这次提交根本不携带的文件,它的存量水印欠账会算到我头上;更坏的是自愈分支会对它
 * `inject` + `git add`,即**门替别人补的东西,由下一个人负责提交**(污染 + 越权两型),
 * 与归因层「点名即定责」相乘 ⇒ 零风险改动任何人都不提交得动。
 * 现口径与守门 135 / 157 / 70 同形:`--staged` **只收窄"哪些文件算在本次提交头上"这一份文件清单**,
 * 内容判据(缺横幅 / 载荷损坏 / 排除面 / 自愈上限)一字未动;全量档与 `--no-fix` 仍判所有已跟踪文件,
 * 所以仓库存量欠账不会被洗成绿色,只是不再由无关的提交者承担。
 */
const STAGED = process.argv.includes('--staged')
// 安全闸: 一次性自动回写的文件数上限。超过则拒绝自愈并直接报错,
// 避免"某个批量改写脚本把半个仓库打回未水印态"时被静默整体重写。
const MAX_AUTOFIX = 200

/**
 * 逻辑自检(零git 调用、零副作用、零文件写入)。
 *
 * 覆盖的那一格(2026-10-03 补):**派生层失败时必须 fail-closed 判"不可判定",不得读成通过。**
 * 这一格在补自检之前是**洞** —— 主流程里那两条 `process.exit(1)` 没有任何用例钉住,
 * 于是任何一次"把 exit(1) 换成 return [] / 加个 allowFail 静默降级"的顺手重构,
 * 都会让门 47 在 git 不可用(本机 EBUSY 病窗就是天天发生的那一种)时**输出 ✅ 并 exit 0**。
 * 那比恒红更坏:恒红只会逼人查,假绿会让"无横幅文件进仓"这条通道重新打开而无人知情。
 *
 * 所以下面每一条 fail-closed 用例都同时断言两件事:verdict 必须是 'undetermined',
 * 且 missing 必须是空(**不是**"没缺口所以通过"的那种空)。
 */
function selfTest() {
  const cases = []
  /**
   * 用例登记。同时接受函数(求值一次)与布尔值;函数抛错按该条失败计并打印原因,
   * 不让一条坏用例把整轮 self-test 炸成未捕获异常(check-single-branch.mjs 同型约定)。
   */
  const t = (name, ok) => {
    let verdict = false
    try {
      verdict = typeof ok === 'function' ? Boolean(ok()) : Boolean(ok)
    } catch (e) {
      verdict = false
      name = `${name}(用例抛错:${e && e.message ? e.message : e})`
    }
    cases.push([name, verdict])
  }
  const noExclusion = () => false
  const scopeOf = (files) => ({ indexFiles: files, files, untrackedFiles: [] })
  const OK_SCOPE = scopeOf(['a.ts', 'b.ts'])

  // ── 组1:清单层 fail-closed ──
  t('F1 跟踪清单取不到(git 派生失败)⇒ undetermined,不得 pass', () => {
    const r = decideCoverage({
      scope: { indexFiles: [], files: [], error: '取不到 git 跟踪清单:spawnSync git EBUSY' },
      uncovered: [],
      isExcluded: noExclusion,
    })
    return r.verdict === 'undetermined' && /EBUSY/.test(r.reason || '')
  })
  t('F2 跟踪清单为空(在错的目录上跑 / 派生层静默返回空)⇒ undetermined,不得 pass', () => {
    const r = decideCoverage({ scope: scopeOf([]), uncovered: [], isExcluded: noExclusion })
    return r.verdict === 'undetermined' && /判据失明/.test(r.reason || '')
  })
  t('F3 scope 整个缺失(undefined)⇒ undetermined,不得读成通过', () => {
    const r = decideCoverage({ scope: undefined, uncovered: [], isExcluded: noExclusion })
    return r.verdict === 'undetermined'
  })

  // ── 组 2:未覆盖清单层 fail-closed(本机 EBUSY 病窗的正主) ──
  t('F4 list-uncovered 派生失败(EBUSY)⇒ undetermined,不得 pass', () => {
    const r = decideCoverage({
      scope: OK_SCOPE,
      uncovered: null,
      uncoveredError: 'spawnSync node EBUSY',
      isExcluded: noExclusion,
    })
    return r.verdict === 'undetermined' && /EBUSY/.test(r.reason || '')
  })
  t('F5 反向对照:fail-closed 不得被读成"没有缺口" —— missing 必为空且 verdict 不是 pass', () => {
    const r = decideCoverage({ scope: OK_SCOPE, uncovered: null, isExcluded: noExclusion })
    return r.verdict !== 'pass' && r.missing.length === 0
  })
  t('F6 uncovered 不是数组(取材层形状异常)⇒ undetermined', () => {
    const r = decideCoverage({ scope: OK_SCOPE, uncovered: 'a.ts', isExcluded: noExclusion })
    return r.verdict === 'undetermined'
  })
  t('F7 两层同时失败(清单+未覆盖都取不到)⇒ 仍 undetermined,不得有一格被放过', () => {
    const r = decideCoverage({
      scope: { indexFiles: [], files: [], error: 'x' },
      uncovered: null,
      uncoveredError: 'spawnSync node EBUSY',
      isExcluded: noExclusion,
    })
    return r.verdict === 'undetermined'
  })

  // ── 组 3:反向对照(证明上面那批不是"恒红门",真绿路径仍然绿) ──
  t('P1 清单齐 + 无缺口 ⇒ pass(正向对照,防自检把本门写成恒红)', () => {
    const r = decideCoverage({ scope: OK_SCOPE, uncovered: [], isExcluded: noExclusion })
    return r.verdict === 'pass' && r.missing.length === 0
  })
  t('P2 已跟踪文件缺横幅 ⇒ gap 且 missing 命中它', () => {
    const r = decideCoverage({ scope: OK_SCOPE, uncovered: ['b.ts'], isExcluded: noExclusion })
    return r.verdict === 'gap' && r.missing.length === 1 && r.missing[0] === 'b.ts'
  })
  t('P3 未跟踪面缺口 ⇒ 只报数不判红(不得越权判红别人在飞的文件)', () => {
    // 构造面必须照真实的**两层集合**给:未跟踪文件在 `files`(分母)里但不在 `indexFiles` 里。
    // 早先这里把 files 与 indexFiles 填成同一份,于是那条用例测的是"分母外的文件被忽略"
    // (=P7),而不是本条要测的"在分母内但不在索引内" —— 假绿。
    const r = decideCoverage({
      scope: { indexFiles: ['a.ts', 'b.ts'], files: ['a.ts', 'b.ts', 'new.ts'], untrackedFiles: ['new.ts'] },
      uncovered: ['new.ts'],
      isExcluded: noExclusion,
    })
    return r.verdict === 'pass' && r.untrackedGaps.length === 1 && r.missing.length === 0
  })
  t('P4 缺口数超自愈上限 ⇒ gap-too-many(拒绝自动回写)', () => {
    const files = Array.from({ length: 5 }, (_, i) => `f${i}.ts`)
    const r = decideCoverage({
      scope: scopeOf(files),
      uncovered: files,
      isExcluded: noExclusion,
      maxAutofix: 2,
    })
    return r.verdict === 'gap-too-many' && /拒绝自动回写/.test(r.reason || '')
  })
  t('P5 缺口数正好等于上限 ⇒ gap(边界不含糊:超限才拒绝)', () => {
    const files = ['a.ts', 'b.ts']
    const r = decideCoverage({
      scope: scopeOf(files),
      uncovered: files,
      isExcluded: noExclusion,
      maxAutofix: 2,
    })
    return r.verdict === 'gap' && r.missing.length === 2
  })
  t('P6 已登记第三方文件被报成缺口 ⇒ 计入 drift 且不判红(不往MIT/Apache 原文打横幅)', () => {
    const r = decideCoverage({
      scope: scopeOf(['vendor/x.ts', 'a.ts']),
      uncovered: ['vendor/x.ts'],
      isExcluded: (f) => f.startsWith('vendor/'),
    })
    return r.verdict === 'pass' && r.drift.length === 1 && r.missing.length === 0
  })
  t('P7 分母外的文件(list-uncovered 报了但既不跟踪也未跟踪)⇒ 不计缺口', () => {
    const r = decideCoverage({ scope: OK_SCOPE, uncovered: ['ghost.ts'], isExcluded: noExclusion })
    return r.verdict === 'pass' && r.missing.length === 0
  })

  // ── 组 4:提交档收窄(G-1018220)—— 每条都配同输入的全量档对照,证明**判据没被放宽** ──
  t('W1 提交档:本次携带的文件缺横幅 ⇒ 仍判红并点名它(收窄没有放过提交者自己的欠账)', () => {
    const r = decideCoverage({
      scope: OK_SCOPE,
      uncovered: ['b.ts'],
      isExcluded: noExclusion,
      stagedFace: true,
      carried: ['b.ts'],
    })
    return r.verdict === 'gap' && r.missing.join() === 'b.ts' && r.untouchedGaps.length === 0
  })
  t('W2 提交档:同一份缺横幅,但本次不携带它 ⇒ 不判红、不自愈,只报名(恒红的那一格)', () => {
    const r = decideCoverage({
      scope: OK_SCOPE,
      uncovered: ['a.ts'],
      isExcluded: noExclusion,
      stagedFace: true,
      carried: ['b.ts'],
    })
    return (
      r.verdict === 'pass' &&
      r.missing.length === 0 &&
      r.untouchedGaps.length === 1 &&
      r.untouchedGaps[0] === 'a.ts'
    )
  })
  t('W3 反向对照:同一份输入走全量档必须照旧判红(证明收窄只动"算在谁头上",没动判据)', () => {
    const r = decideCoverage({ scope: OK_SCOPE, uncovered: ['a.ts'], isExcluded: noExclusion })
    return r.verdict === 'gap' && r.missing.join() === 'a.ts' && r.untouchedGaps.length === 0
  })
  t('W4 提交档混合面:两类欠账同现 ⇒ 只有携带的那条进自愈清单(门不得 git add 别人的文件)', () => {
    const r = decideCoverage({
      scope: scopeOf(['a.ts', 'b.ts', 'c.ts']),
      uncovered: ['a.ts', 'b.ts', 'c.ts'],
      isExcluded: noExclusion,
      stagedFace: true,
      carried: ['b.ts'],
    })
    return r.verdict === 'gap' && r.missing.join() === 'b.ts' && r.untouchedGaps.join() === 'a.ts,c.ts'
  })
  t('W5 提交档:别人存量欠账不得把自愈上限顶爆(上限按"本次携带"计)', () => {
    const all = ['a.ts', 'b.ts', 'c.ts', 'd.ts']
    const r = decideCoverage({
      scope: scopeOf(all),
      uncovered: all,
      isExcluded: noExclusion,
      maxAutofix: 2,
      stagedFace: true,
      carried: ['c.ts', 'd.ts'],
    })
    return r.verdict === 'gap' && r.missing.join() === 'c.ts,d.ts'
  })
  t('W6 fail-closed:提交档取不到携带面(git 抖动)⇒ 未判定,不得冒充"本次什么都没带"', () => {
    const r = decideCoverage({
      scope: OK_SCOPE,
      uncovered: ['a.ts'],
      isExcluded: noExclusion,
      stagedFace: true,
      carried: null,
      carriedError: 'spawnSync git EBUSY',
    })
    return r.verdict === 'undetermined' && /携带/.test(r.reason || '') && r.missing.length === 0
  })
  t('W7 fail-closed:提交档 carried 不是数组(取材层形状异常)⇒ 未判定', () => {
    const r = decideCoverage({
      scope: OK_SCOPE,
      uncovered: [],
      isExcluded: noExclusion,
      stagedFace: true,
      carried: 'a.ts',
    })
    return r.verdict === 'undetermined'
  })
  t('W8 提交档空携带面(暂存==HEAD)⇒ pass 且 untouched 照旧报名,不静默', () => {
    const r = decideCoverage({
      scope: OK_SCOPE,
      uncovered: ['a.ts'],
      isExcluded: noExclusion,
      stagedFace: true,
      carried: [],
    })
    return r.verdict === 'pass' && r.untouchedGaps.join() === 'a.ts'
  })

  let bad = 0
  for (const [name, ok] of cases) {
    if (!ok) bad++
    console.log(`${ok ? '✅' : '❌'} ${name}`)
  }
  console.log(`self-test: ${cases.length - bad}/${cases.length} 通过`)
  return bad ? 1 : 0
}

if (process.argv.includes('--self-test')) process.exit(selfTest())

if (process.env.HUSKY_SKIP_WATERMARK_GUARD === '1') {
  console.log('[skip] HUSKY_SKIP_WATERMARK_GUARD=1, 跳过溯源水印覆盖守门')
  process.exit(0)
}

/**
 * 第三方排除面与 watermark.mjs 走**同一个出口**(scripts/lib/third-party-roots.mjs)。
 * 本门自己不再拼一份 roots 清单 —— 两处算同一件事各写一份,正是本仓最高频的失守形态。
 * 之所以两处都要判:本门的自愈循环(`inject` + 双横幅巡检)与 list-uncovered 是两条独立路径,
 * 只收窄其一,另一条照样会把横幅打进已登记的第三方内容。
 */
let exclusion
try {
  exclusion = createExclusionPredicate(REPO_ROOT)
} catch (e) {
  const why = e instanceof LedgerUnavailable ? e.message : String(e?.message ?? e)
  console.error('[watermark-coverage] ❌ 第三方排除面无法判定:' + why.split('\n')[0])
  console.error('  算不出"哪些是已登记第三方内容"时**拒绝**自愈 —— 自愈的动作是往文件里写归属横幅,')
  console.error(
    '  把横幅写进 Apache-2.0/MIT 许可原文比"少一个横幅"严重得多。请先修台账或 git 可用性。',
  )
  process.exit(1)
}

const run = (cmd, args) =>
  execFileSync(cmd, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    // 根治 EBUSY(errno -4082):本机会话里 Node 建子进程 stdin 管道确定性失败,而本门
    // 派生的两条命令(`watermark.mjs list-uncovered` / `inject`)都不吃 stdin ⇒ stdio[0]='ignore'。
    // 不写 stdio 就是默认全管道,门 47 在本会话必报 EBUSY 跑不出判定(2026-10-03 实测)。
    stdio: ['ignore', 'pipe', 'pipe'],
  })

/** watermark.mjs list-uncovered → 载荷损坏 + 残迹 + 未覆盖(相对仓库根, / 分隔) */
function listUncovered() {
  try {
    return run('node', ['scripts/watermark.mjs', 'list-uncovered'])
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  } catch (e) {
    console.error('[watermark-coverage] 无法获取未覆盖清单:', e.message)
    process.exit(1)
  }
}

function trackedFiles() {
  // G-253:口径与 watermark.mjs 共用 scripts/lib/watermark-scope.mjs 那一份实现。
  // 返回**两层**集合:indexFiles(可阻塞面)/ untrackedFiles(只报数面)。
  const scope = coverageFileSet({ root: REPO_ROOT })
  if (scope.error) {
    console.error(`[watermark-coverage] ❌ ${scope.error}`)
    console.error('  取不到清单时**不**按"没有缺口"放行 —— 那等于把"没判"写成"判过了"。')
    process.exit(1)
  }
  return scope
}

/**
 * 本次提交**携带**的文件面 = 索引相对 HEAD 有差异的路径(`git diff --cached --name-only`)。
 * G-1018220 的落点:提交档的门只能问"这次进来的文件有没有横幅",不能问"整张共享索引干不干净"。
 * 三条不可漂:① 取不到 ⇒ 带 error 上去,由 `decideCoverage` 判**未判定**,不得当成"没带文件";
 * ② 派生一律带 timeout(守门 80 那一型:无界只读 git 调用把提交挂死几十分钟);
 * ③ 只读动词,不碰工作树、不碰别人的在飞文件。
 * @returns {{paths:string[]|null, error:string|null}}
 */
function carriedFiles() {
  try {
    const out = execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 60_000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { paths: out.split('\n').map((s) => s.trim()).filter(Boolean), error: null }
  } catch (e) {
    return { paths: null, error: String(e && e.message ? e.message : e).split('\n')[0] }
  }
}

function reportGap(missing, reason) {
  console.error(`[watermark-coverage] ❌ ${missing.length} 个已跟踪文件缺失/损坏溯源水印${reason}:`)
  for (const f of missing.slice(0, 30)) console.error('  - ' + f)
  if (missing.length > 30) console.error(`  ... 其余 ${missing.length - 30} 个`)
  console.error('')
  console.error('  手动修复: node scripts/watermark.mjs inject <file>')
  console.error('            node scripts/watermark.mjs list-uncovered   # 列出全部缺口')
  console.error('  紧急跳过: HUSKY_SKIP_WATERMARK_GUARD=1 git commit ...')
}

/**
 * 纯判定内核(零 I/O):把「取材结果」翻译成「门 47 的判定」。
 *
 * 为什么要抽成纯函数:`scopeError` / `uncoveredError` 这两格是本门**唯一**的 fail-closed 出口,
 * 而它们在改前只以 `process.exit(1)` 的形态存在于主流程里 —— 没有可构造的接缝,自检就永远
 * 覆盖不到"派生层失败时必须判不可判定"这一格(历史洞:allowFail 式静默降级会让门 47 在
 * git 不可用时**假装通过**,而报告上写着✅)。抽出后 `--self-test` 直接喂构造面。
 *
 * @param {object} input
 * @param {{indexFiles?:string[], files?:string[], error?:string|null}} input.scope 取不到清单时的 error
 * @param {string[]|null} input.uncovered list-uncovered 的结果;null = 派生层失败
 * @param {string|null} input.scopeError
 * @param {string|null} input.uncoveredError
 * @param {(f:string)=>boolean} input.isExcluded
 * @param {number} [input.maxAutofix]
 * @param {boolean} [input.stagedFace] 提交档:只判本次提交携带的文件(G-1018220)
 * @param {string[]|null} [input.carried] 索引相对 HEAD 有差异的路径(仅 stagedFace 时必需)
 * @param {string|null} [input.carriedError] 取不到携带面的原因 ⇒ 未判定,不得冒充"本次什么都没带"
 * @returns {{verdict:'pass'|'undetermined'|'gap'|'gap-too-many', reason?:string, missing:string[], untrackedGaps:string[], untouchedGaps:string[], drift:string[]}}
 */
export function decideCoverage(input) {
  const { scope, uncovered, isExcluded, maxAutofix = MAX_AUTOFIX } = input
  const stagedFace = input.stagedFace === true
  const carriedError = input.carriedError ?? null
  const scopeError = input.scopeError ?? scope?.error ?? null
  const uncoveredError = input.uncoveredError ?? null
  const empty = { missing: [], untrackedGaps: [], untouchedGaps: [], drift: [] }
  // ── fail-closed 第一格:清单取不到 = 判据失明,**不得**按"没有缺口"放行 ──
  if (scopeError) return { ...empty, verdict: 'undetermined', reason: `取不到清单:${scopeError}` }
  // ── fail-closed 第二格:list-uncovered 派生失败(EBUSY / git 不可用 / 脚本非零退出) ──
  // 这一格就是 2026-10-03 那个洞的形状:改前它 exit 1,但没有自检钉住,任何一次
  // "把 exit 1 换成 return []"的顺手重构都会让门 47 在 git 不可用时变成绿色。
  if (uncoveredError) return { ...empty, verdict: 'undetermined', reason: `取不到未覆盖清单:${uncoveredError}` }
  if (!Array.isArray(uncovered)) return { ...empty, verdict: 'undetermined', reason: '未覆盖清单不是数组(取材层形状异常)' }
  // ── fail-closed 第三格:清单"取到了但是空的" ≠ 没有缺口。空清单同样是判据失明 ──
  // (git 在错的目录上跑 / 派生层静默返回空串,两种都长这样。)
  if (!Array.isArray(scope?.indexFiles) || scope.indexFiles.length === 0) {
    return { ...empty, verdict: 'undetermined', reason: '跟踪清单为空 ⇒ 判据失明,不按"已覆盖"放行' }
  }
  const indexSet = new Set(scope.indexFiles)
  const denominator = new Set(scope.files ?? scope.indexFiles)
  // ── fail-closed 第四格(G-1018220):提交档拿不到"本次携带面"⇒ 未判定 ──
  // 这一格必须存在:否则一次 git 抖动就把「没判」写成「本次没带文件 ⇒ 通过」,
  // 而"无横幅文件进提交"这条通道正是本门立项要堵的那一格(§5c)。
  if (stagedFace && carriedError) {
    return { ...empty, verdict: 'undetermined', reason: `取不到本次提交携带的文件面:${carriedError}` }
  }
  if (stagedFace && !Array.isArray(input.carried)) {
    return { ...empty, verdict: 'undetermined', reason: '本次提交携带的文件面不是数组(取材层形状异常)' }
  }
  // 双保险:排除面已由 watermark.mjs 的 scanCoverage 用同一个谓词移出分母,这里再筛一次 ——
  // 若哪天有人只改了一侧,本门要么把横幅打进第三方内容(自愈侧),要么恒红(判定侧)。
  const inDenominator = uncovered.filter((f) => denominator.has(f) && !isExcluded(f))
  // 只有**索引里**的那批可以判红/自愈:未跟踪面里挂着别人在飞的源文件,
  // 判红 = 与本次提交无关的恒红门(各会话只好 --no-verify,连带全部守门作废),
  // 自动注入 = 往别人的未提交文件里写字并 git add 别人的东西(污染 + 越权两型)。
  const inIndexGaps = inDenominator.filter((f) => indexSet.has(f))
  // G-1018220 的收窄:提交档只把「本次提交真的携带(索引相对 HEAD 有差异)」的文件算成判红/自愈面;
  // 别人 add 过而我这次不带的那些,降到**只报数**那一档(与未跟踪面同一处理方式),
  // 由全量档 / CI 继续问责 —— 既不洗红,也不让门替别人的欠账挡路、更不许 git add 别人的文件。
  const carriedSet = stagedFace ? new Set(input.carried) : null
  const missing = carriedSet ? inIndexGaps.filter((f) => carriedSet.has(f)) : inIndexGaps
  const untouchedGaps = carriedSet ? inIndexGaps.filter((f) => !carriedSet.has(f)) : []
  const untrackedGaps = inDenominator.filter((f) => !indexSet.has(f))
  const drift = uncovered.filter((f) => indexSet.has(f) && isExcluded(f))
  if (missing.length === 0) return { verdict: 'pass', missing, untrackedGaps, untouchedGaps, drift }
  if (missing.length > maxAutofix) {
    return {
      verdict: 'gap-too-many',
      reason: `超过自愈上限 ${maxAutofix}, 拒绝自动回写`,
      missing,
      untrackedGaps,
      untouchedGaps,
      drift,
    }
  }
  return { verdict: 'gap', missing, untrackedGaps, untouchedGaps, drift }
}

const scope = trackedFiles()
const uncoveredList = listUncovered()
// G-1018220:提交档(`--staged`,由 guardian-runner 自动下发)把**判红面与自愈面**收到"本次提交携带的文件"。
//   - 全量档 / `--no-fix` 一字未动:仍判所有已跟踪文件 ⇒ 仓库存量欠账不会被这次收窄洗成绿色。
//   - 索引里别人 add 过而我这次不带的缺口 ⇒ 降为**只报数**那一档(与既有"未跟踪面"同一处理方式),
//     既不 git add 别人的文件(污染 + 越权两型),也不让一道与本次提交无关的门替当前提交者挡路(§12e/§12f)。
//   - 携带面取不到 ⇒ 未判定并 exit 1(不得读成"这次什么都没带 ⇒ 通过")。
//   - 携带面为空(暂存集与 HEAD 逐字相同)⇒ 本次提交不携带任何文件,判"通过"但大声说明,
//     并点名索引里的存量欠账 —— 这一档的正当性来自本门的立项语义:"无水印文件进入提交"。
const face = STAGED ? carriedFiles() : { paths: null, error: null }
const decision = decideCoverage({
  scope,
  uncovered: uncoveredList,
  isExcluded: exclusion.isExcluded,
  stagedFace: STAGED,
  carried: face.paths,
  carriedError: face.error,
})
if (decision.verdict === 'undetermined') {
  console.error(`[watermark-coverage] ❌ ${decision.reason}`)
  console.error('  取不到判定面时**不**按"没有缺口"放行 —— 那等于把"没判"写成"判过了"。')
  process.exit(1)
}
const { missing, untrackedGaps, untouchedGaps, drift } = decision
const indexSet = new Set(scope.indexFiles)
// 自愈后的回读校验必须用**同一个面**(carried):沿用整张索引去复核,等于把刚收窄掉的那一格
// 从后门请回来 —— 那会让提交档再次恒红(G-1018220 的症状原样复现)。
const carriedSetForVerify = STAGED && Array.isArray(face.paths) ? new Set(face.paths) : null
if (drift.length > 0) {
  console.warn(
    `[watermark-coverage] ⚠️ 排除面两侧不一致:${drift.length} 个已登记第三方文件被 list-uncovered 报成缺口(watermark.mjs 未走同一谓词?),已跳过不注入。示例: ${drift.slice(0, 5).join(', ')}`,
  )
}
console.log(
  `[watermark-coverage] 台账登记的第三方排除面:roots ${exclusion.roots.length} 条 → 真实文件 ${exclusion.paths.size} 个(不计入水印分母,改由 provenance-ledger P8 审计)`,
)
if (exclusion.notes.length) {
  for (const n of exclusion.notes) console.warn(`[watermark-coverage] NOTE 排除面: ${n}`)
}
if (exclusion.unresolvedRoots.length) {
  console.warn(
    `[watermark-coverage] NOTE 台账登记了而当前清单里没有的 root ${exclusion.unresolvedRoots.length} 条(归 provenance-ledger P1 问责): ${exclusion.unresolvedRoots.join(', ')}`,
  )
}

// ---------- 双横幅(重复版权头)巡检:warn-only,不计入退出码 ----------
// 2026-09-22 实测:injectFile 旧版只在"见到载荷标记"时才清洗 ⇒ 已有裸横幅(无载荷)的文件
// 被前置一条新横幅,之后恒 skip-done ⇒ 重复头永久冻结,而"有载荷即完好"的判据看不见它。
// 工具已修(横幅文本存在即先清洗);这里把残留量显式报出来,便于后续下调到 0 再升 blocking。
const CANON_BANNER = /^\/\/ © \d{4} IHUI AI \(智汇AI\) · 版权所有者:/gm
let dupBanner = 0
const dupSamples = []
for (const f of scope.indexFiles) {
  if (!/\.(ts|tsx|js|mjs|cjs|css)$/.test(f)) continue
  // 已登记第三方内容不参与"双横幅"巡检:本项统计的是**我方文件重复打了几个头**,
  // 而"第三方文件上出现了我方横幅"是另一件事,由 provenance-ledger P8 独立判红。
  // 两个判据不重叠,也不留空档 —— 这里少算的那一类正是 P8 的全部射程。
  if (exclusion.isExcluded(f)) continue
  let text
  try {
    // 门 118 取材面纪律(2026-10-07):统一走 face-reader 磁盘面读入口;缺文件返 null ⇒ 与旧 ENOENT 同形跳过
    text = readWorktreeFile(REPO_ROOT, f)
  } catch {
    continue
  }
  if (text === null) continue
  const n = (text.match(CANON_BANNER) || []).length
  if (n > 1) {
    dupBanner += 1
    if (dupSamples.length < 5) dupSamples.push(`${f}(×${n})`)
  }
}
if (dupBanner > 0) {
  console.log(
    `[watermark-coverage] ⚠️ 双横幅文件 ${dupBanner} 个(warn,不阻塞;修复:node scripts/watermark.mjs clean <f> && inject <f>)`,
  )
  console.log(`   样例: ${dupSamples.join(', ')}`)
}

if (untrackedGaps.length > 0) {
  // 只报数、不判红、不代写:那批文件属别人在飞的现场(见文件头 G-253 那段)。
  // 但必须**喊出来** —— 否则"分母并上了未跟踪面"这件事与没做只差一行日志。
  console.log(
    `[watermark-coverage] ℹ️ 未跟踪面上另有 ${untrackedGaps.length} 个缺水印的源文件` +
      `(**不计入退出码、不自动往别人未提交的文件里写字**):` +
      untrackedGaps.slice(0, 5).join(', ') +
      (untrackedGaps.length > 5 ? ` … 其余 ${untrackedGaps.length - 5} 个` : ''),
  )
  console.log(
    '   出口:各自作者在被提交/落地前跑 `node scripts/watermark.mjs inject <file>`;' +
      '旁路提交由 scripts/object-space-land.mjs 兜(它拒绝落地无有效横幅的声明路径)。',
  )
}

if (untouchedGaps.length > 0) {
  // 只报数、不判红、**不代写也不代 add**:这批文件在索引里,但本次提交不携带它们(别人 add 过)。
  // 判红 = 与本次提交无关的恒红门(§12e/§12f);自愈 = 把别人的欠账连同横幅 git add 进我的提交(§12 污染型)。
  // 问责仍在:全量档与本门的 CI 侧照旧逐条判它们,所以这不是把红洗成绿,是把责任还给持有它的那一枚提交。
  console.log(
    `[watermark-coverage] ℹ️ 索引里另有 ${untouchedGaps.length} 个缺水印文件**不由本次提交携带**` +
      `(**不计入退出码、不 git add 别人的文件**):` +
      untouchedGaps.slice(0, 5).join(', ') +
      (untouchedGaps.length > 5 ? ` … 其余 ${untouchedGaps.length - 5} 个` : ''),
  )
  console.log(
    '   出口:谁提交它谁跑 `node scripts/watermark.mjs inject <file>`(或让全量档/CI 问责);' +
      '本门不得替别人补齐再由下一个人背 —— 见 PROJECT_PLAN G-1018220。',
  )
}

if (missing.length === 0) {
  // 措辞必须与**判过的面**一致:提交档只判了本次携带的文件,不能声称"已跟踪文件水印完整"
  // —— 那会把"没判的那一格"写成"判过了"(本仓最高频失效型),也正好掩盖 untouchedGaps 那一档。
  console.log(
    STAGED
      ? `[watermark-coverage] ✅ 本次提交携带的 ${face.paths ? face.paths.length : 0} 个文件水印完整` +
          `(索引存量欠账 ${untouchedGaps.length} 个只报数,由全量档/其持有者问责)${untouchedGaps.length === 0 && face.paths && face.paths.length === 0 ? ' —— 暂存面为空,本次不携带任何文件' : ''}`
      : '[watermark-coverage] ✅ 已跟踪文件水印完整(未跟踪产物不计入,见上)',
  )
  process.exit(0)
}

// ---------- 纯判定模式(CI / 审计): 不修改任何文件 ----------
if (NO_FIX) {
  reportGap(missing, '(会导致 CI 红)')
  process.exit(1)
}

// ---------- 自愈模式(pre-commit 默认) ----------
if (decision.verdict === 'gap-too-many') {
  reportGap(missing, `(超过自愈上限 ${MAX_AUTOFIX}, 拒绝自动回写)`)
  console.error('')
  console.error(`  ⚠️ 单次缺口 ${missing.length} 个 > 上限 ${MAX_AUTOFIX}: 疑似批量改写事故。`)
  console.error('     请先排查改写来源(文本级 sed/prettier/生成器), 再整体重注入:')
  console.error('     node scripts/watermark.mjs inject')
  process.exit(1)
}

console.log(`[watermark-coverage] 🔧 检出 ${missing.length} 个文件水印缺失/损坏, 自动补齐中...`)
for (const f of missing) {
  try {
    run('node', ['scripts/watermark.mjs', 'inject', f])
  } catch (e) {
    console.warn(`  ⚠️ ${f} 注入失败: ${String(e.message || e).split('\n')[0]}`)
  }
}

// 回读校验: 注入后必须彻底达标(不信任"命令返回 0"这一层)
const stillMissing = listUncovered().filter(
  (f) => indexSet.has(f) && !exclusion.isExcluded(f) && (!carriedSetForVerify || carriedSetForVerify.has(f)),
)
if (stillMissing.length > 0) {
  reportGap(stillMissing, '(自愈后仍不达标)')
  console.error('')
  console.error('  ⚠️ 自动补齐未能达标: 该文件类型可能不可注入, 或载荷被结构性破坏。')
  console.error('     请按上方清单手动排查后重试。')
  process.exit(1)
}

// 同步暂存区: 否则提交的仍是"未加水印"的旧 index blob(注入只改了工作区)
try {
  execFileSync('git', ['add', '--', ...missing], {
    cwd: REPO_ROOT,
    // 原来写的是 `stdio: 'pipe'` —— 那stdin 仍是管道,正好是 EBUSY 的触发面
    //(`'pipe'` 是三通道全管道,不是"不要 stdin")。`git add` 不吃 stdin ⇒ 必须 'ignore'。
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
} catch (e) {
  console.error('[watermark-coverage] ⚠️ git add 同步暂存区失败:', String(e.message || e))
  console.error('     注入已写入工作区, 请手动 `git add` 后重试提交。')
  process.exit(1)
}

console.log(
  `[watermark-coverage] ✅ 已自动补齐 ${missing.length} 个文件的水印并加入暂存区(无需再跳过门禁):`,
)
for (const f of missing.slice(0, 30)) console.log('  - ' + f)
if (missing.length > 30) console.log(`  ... 其余 ${missing.length - 30} 个`)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
