#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * i18n 文件完整性守门脚本(防截断事故)。
 *
 * 背景:本仓库曾发生 lint-staged 的 prettier --write 解析大 JSON 失败后
 * 写出截断版本,把 29100 行的 en.json 截断到 11066 行,丢失 ~18K 行 i18n 文案。
 *
 * 检测逻辑(2026-10-27 修法席复述;D1/D2/D3 已修,判据阈值/候选集/判红条件一字未动):
 * - 扫描 staged 中的 packages/i18n/messages/ 下所有 .json 文件(含子目录)
 * - 对比 staged 版本行数 vs HEAD 版本行数
 * - 若 staged 行数 < HEAD 行数 × 0.5 且减少量 > 100 行 → 判定截断事故(blocking)
 * - 新增文件(git 明说 HEAD 树里没有该路径的 blob 条目)跳过并如实计数;
 *   "该在 HEAD 却读不出"严格分开,落未判定(见 D1)
 *
 * 一句话:这枚门判的是「索引里的 i18n JSON 相对 HEAD 有没有**腰斩式**变薄」——
 * `TRUNCATION_RATIO`(比值)与 `MIN_DECREASE_LINES`(减量)**两条同时成立**才喊红。
 *
 * 用法: node scripts/validate-i18n-integrity.mjs [--staged] [--root <dir>] [--self-test]
 *   --staged     兼容 guardian-runner 调用约定(脚本始终检查 staged 文件;该旗无额外语义)
 *   --root       显式指定被审根(修法席 D2 新增;不给旗标则按脚本自身位置推导仓库根)
 *   --self-test  真 git 夹具取证(绝不扫真仓):三态各 ≥1 枚 + 变异自证,rc 0/1
 *
 * ## 三档退出码各由什么条件产生(2026-10-27 修法席现读)
 *   0 = 判通过:索引里没有 packages/i18n/messages/**.json 改动(打印「⏭  跳过」),
 *       或有候选但一枚都没命中双阈(打印「✅ 通过 (N 个 …)」+ 取材账面行)。
 *   1 = 判出缺口:候选里至少一枚命中双阈 ⇒ 逐条点名 HEAD/staged 行数与减少量。
 *       命中优先于未判定(红已经量出来了,不让未判定改口)。
 *   2 = 未判定,两个面:
 *       ①清单面(staged 清单整面取不到,git 派生抛错)⇒ 显式点名「未判定」并打印原因;
 *       ②逐文件面(D1 修法席新增,§0.3):候选的取材面"该存在却读不出"——HEAD 树里有
 *          blob 条目但 `git show` 失败,或索引 blob 与工作区回退双双读不出 ⇒ 逐枚点名路径+面+原因。
 *       旧形态把①打印成「跳过」退 0(自证据席已修)、把②静默 continue(本席修法席修);
 *       两者共同教训:"没量到"绝不允许长得像"判过了"。阈值、判红条件、跳过规则(仅"新增"一型)
 *       一字未改;凡旧形态真的做出判定的输入,新形态的结论与打印逐字节相同(取证:
 *       `--self-test` 的三态组 + 变异自证 + §22c 镜像测试)。
 *
 * ## 判据修法席(2026-10-27 第二席):D1/D2/D3 已修;D4 未动(注册面多人争用);D5 只调查(结论如下)
 *   D1 已修:逐文件 HEAD 面读取从"失败 null 一律 continue"改为**三态**(哨兵唯一出口 `HEAD_ABSENT`):
 *      number=量出行数;HEAD_ABSENT=git 明说 HEAD 树里没有该路径条目(合法新增,照旧跳过并计数);
 *      null=该存在却读不出 ⇒ 新增 `headUnreadable` 桶,与索引面 `unreadable` 桶一起进打印面并影响
 *      退出码(无命中时 ⇒ 2 未判定,逐枚点名原因)。"该存在"的裁决器 = `git ls-tree HEAD -- <path>`
 *      (只读树,叶子 blob 被毁/被删时条目行照样逐字报出——夹具实测:`show` 报 `bad object` 而
 *      `ls-tree` 报条目),不 parse git 错误文本(face-reader 纪律:结论走退出码与结构,不走字符串);
 *      区分"HEAD unborn(首次提交,合法:全部算新增)"与"面坏了(未判定)"靠 `rev-parse --verify
 *      --quiet` 的实得退出码(unborn=1,坏面=128,现读夹具 T4/T5)——首提交场景绝不误落未判定(§12e)。
 *      真新增文件仍然合法跳过并如实计数,本门没有因此变恒红。
 *   D2 已修:删除 ROOT = 进程 cwd 定根(§15 反模式,守门 70 恒红同型)。定根唯一出口 `resolveRoot`:
 *      `--root <dir>` / `--root=<dir>`(取值经 `lib/flag-value.mjs` 单源,给旗不给值按用法错退 2,
 *      绝不静默回落默认——G-322 三态点名)> env `I18N_INTEGRITY_ROOT` > 脚本自身位置推导仓库根
 *      (`import.meta.url` → scripts/..)。惯例取自 check-button-height / check-api-client-utf8(现读)。
 *      夹具自证的 CLI 跑全部显式带 `--root`,不再"cd 到夹具"定根(check-button-height 头注点名的事故型)。
 *   D3 已修:两枚 blob 读取(`git show HEAD:<path>` / `git show :<path>`)从裸 execSync 收口到
 *      face-reader 的 `gitRaw`(与清单腿 G-54 同一口径,§0.6;门 193 射程内该两枚裸派生随之归零):
 *      绝对路径 git、safe.directory、core.quotepath=false(中文路径不再经八进制转义/码页改写,
 *      execFileSync  argv 直传不经 cmd.exe ⇒ §5d 的 GBK 坑不适用)、windowsHide、显式 stdio(§12g)、
 *      只读动词一过性失败串行退避重试。遗留登记(不属本票,未动):索引腿失败仍回退工作区面读
 *      (§0.4 面纪律的存量味道),两路都读不出 ⇒ 落未判定。
 *   D4 未动(只交建议):建议 runner 给本门条目登记 `skipEnv: 'HUSKY_SKIP_I18N_INTEGRITY'`——
 *      理由 = 本门是 blocking 且无跳门留痕出口时,它红一次提交者只剩 --no-verify,连带废掉全部守门
 *      (§12e);同链近邻(`HUSKY_SKIP_I18N_MESSAGES_EXIST` 一类)均为 blocking+skipEnv 成套。
 *      注册面多人争用,本席不碰 `guardian-runner.mjs`(档位/id 一律 runner 现读)。
 *   D5 只调查(结论;未新增任何静默放行支):上席报"git 问不出工作树的落点对 `diff --cached`
 *      报成功+空清单"。修法席夹具枚举(现读,末行见 --self-test「射程边界」条与镜像 T8):
 *      ① scratch 根下**未 git init 的空目录**——"成功"的原因 = 命中了 mkScratch 的防逃逸边界伪仓
 *        `.no-git-boundary`(bare):对边界面 `add` 被 128 拒「must be run in a work tree」(夹具实测),
 *        而 `diff --cached` 报"成功+空清单"是该面的**如实结论**(边界仓结构上装不下任何 staged 改动,
 *        真实改动必然长在真实仓库面上)⇒ 不构成假绿,走 skip(退 0)正确;
 *      ② `git init` 后未 commit 的仓(HEAD unborn)⇒ 空索引如实;③ 真仓工作树副本被删 ⇒
 *        `diff --cached` 读的是对象/索引面不回盘,清单仍是真结论。
 *      修 D1 后这一族**不被也不应被**"空清单⇒未判定"接住:三型都是合法空面,判死反而会造恒红门。
 *      真正取不到面(GIT_DIR 指向不存在处 / git 二进制不可达)派生抛错 ⇒ 2①接住(夹具 D);
 *      "把边界面误读成绿"唯一入口是定根错位,而 D2 已把默认根钉死在脚本位置 ⇒ 该型结构性关闭。
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gitRaw, gitErrText } from './lib/face-reader.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'
import { makeRegistrar } from './lib/selftest-registrant.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
/** D2(§15):仓库根由脚本自身位置推导;禁 cwd() 定根(共享工作区 cwd 不可靠)。 */
const SCRIPT_REPO_ROOT = resolve(SCRIPT_DIR, '..')
/** 外部指定根的环境变量(照 check-button-height 的 `BUTTON_HEIGHT_ROOT` 惯例)。 */
const ROOT_ENV = 'I18N_INTEGRITY_ROOT'
const I18N_MESSAGES_PREFIX = 'packages/i18n/messages/'
const SELF_PATH = fileURLToPath(import.meta.url)

/**
 * D1 三态的唯一哨兵:git 明说"HEAD 树里没有该路径的条目"⇒ 合法新增(跳过)。
 * 它与 `null`("该存在却读不出"⇒ 未判定输入)必须严格分开——旧形态两型同形就是 D1 的立项由因。
 */
const HEAD_ABSENT = Symbol('head-absent')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

// 阈值:staged 行数 < HEAD × TRUNCATION_RATIO 且减少量 > MIN_DECREASE_LINES → 截断
const TRUNCATION_RATIO = 0.5
const MIN_DECREASE_LINES = 100

/**
 * D2(修法席):定根唯一出口。优先级 = `--root <dir>` / `--root=<dir>` > env `I18N_INTEGRITY_ROOT`
 * > 脚本自身推导仓库根。给旗不给值是用法错(经 `lib/flag-value.mjs` 单源判定,绝不静默回落默认——
 * G-322 普查的 38 处静默降级正是这型的账)。
 * @returns {{root:string, explicit:boolean, error:string|null}}
 */
function resolveRoot(argv, env = process.env) {
  const spaced = requireFlagValue(argv, '--root', { noun: '目录参数' })
  const eq = argv.find((a) => a.startsWith('--root='))
  if (spaced.value) return { root: resolve(spaced.value), explicit: true, error: null }
  if (eq !== undefined) {
    const v = eq.slice('--root='.length)
    if (!v || v.startsWith('-'))
      return {
        root: SCRIPT_REPO_ROOT,
        explicit: false,
        error: `--root= 需要一个目录参数 —— 实得:${JSON.stringify(v)}(不得静默退回默认)`,
      }
    return { root: resolve(v), explicit: true, error: null }
  }
  if (spaced.present) return { root: SCRIPT_REPO_ROOT, explicit: false, error: spaced.error }
  if (env[ROOT_ENV]) return { root: resolve(env[ROOT_ENV]), explicit: true, error: null }
  return { root: SCRIPT_REPO_ROOT, explicit: false, error: null }
}

function getStagedFiles(root) {
  try {
    // 2026-10-26 G-54:git 派生收口到 face-reader(gitRaw 内部已带绝对路径 git + safe.directory
    // + core.quotepath=false + -C ROOT + windowsHide + 显式 stdio,原 cwd/stdio/windowsHide 选项撤除)
    // 2026-10-27:不再把"取面抛错"折成"空清单"—— 空清单是**结论**,抛错不是(§0.3)。
    const output = gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], root)
    return { files: output.split('\n').filter(Boolean), error: null }
  } catch (e) {
    return { files: [], error: String(e?.message ?? e).split('\n')[0] }
  }
}

function countLines(content) {
  if (!content) return 0
  return content.split('\n').length
}

function countStagedLines(relPath, root, reasons) {
  // D3(修法席):索引 blob 经 gitRaw 读(与清单腿同一口径);失败仍回退工作区文件(原行为,
  // 面纪律存量的味道登记在头注 D3"遗留",不在本票射程)。两路都读不出 ⇒ null ⇒ 落未判定(修 D1)。
  try {
    return countLines(gitRaw(['show', `:${relPath}`], root))
  } catch (e) {
    if (reasons) reasons.set(relPath, `索引面取不到:${gitErrText(e)}`)
    // fall through to working tree
  }
  try {
    return countLines(readFileSync(join(root, relPath), 'utf8'))
  } catch (e) {
    if (reasons) reasons.set(relPath, `索引面与工作区回退都取不到:${reasons.get(relPath) || ''};工作区:${gitErrText(e)}`)
    return null
  }
}

/**
 * D1(修法席):逐文件 HEAD 面**三态**读取。
 * @param {(p:string)=>void|undefined} [reasons] 可选 Map:未判定时把原因逐枚记下(打印面点名用)
 * @returns {number|symbol|null} number=量出行数;`HEAD_ABSENT`=git 明说 HEAD 树没有该条目(合法新增);
 *   null=该存在却读不出(未判定输入)。三态绝不并桶。
 */
function readHeadLines(relPath, root, reasons) {
  try {
    return countLines(gitRaw(['show', `HEAD:${relPath}`], root))
  } catch (showErr) {
    // 取回失败 ≠ 不存在。"该不该存在"的唯一裁决器 = `git ls-tree HEAD -- <path>`:
    // 它只读 HEAD 树,叶子 blob 被毁/被删时条目行照样逐字报出(夹具实测:show 报 `bad object`
    // 而 ls-tree 报 `100644 blob <sha>\t<path>`),不 parse git 错误文本(结论走结构与退出码)。
    let tree
    try {
      tree = gitRaw(['ls-tree', 'HEAD', '--', relPath], root)
    } catch (probeErr) {
      // HEAD 本身剥不出 → 分两型(实得退出码,现读夹具 T4/T5):
      //  `rev-parse --verify --quiet HEAD` 对 unborn HEAD(首次提交)报 1(无 fatal)⇒ 合法"全无新增基线";
      //  坏面(GIT_DIR 失效等)报 128 ⇒ 未判定。首次提交场景绝不误落未判定(§12e 恒红门禁令)。
      try {
        gitRaw(['rev-parse', '--verify', '--quiet', 'HEAD'], root)
      } catch (revErr) {
        if (revErr.status === 1) return HEAD_ABSENT
        if (reasons)
          reasons.set(relPath, `HEAD 面探针不可达(取证:${gitErrText(showErr)};探针:${gitErrText(probeErr)};rev 校验:${gitErrText(revErr)})`)
        return null
      }
      if (reasons)
        reasons.set(relPath, `HEAD 树探针失败而 HEAD 有效(取证:${gitErrText(showErr)};探针:${gitErrText(probeErr)})`)
      return null
    }
    // 树里有 blob 条目(含 120000 符号链接形态)却读不回内容 ⇒ "该存在却读不出",绝不当成新增
    if (/^[0-7]{6} blob [0-9a-f]{40}\t/m.test(String(tree))) {
      if (reasons) reasons.set(relPath, `HEAD 树有 blob 条目但内容取不到:${gitErrText(showErr)}`)
      return null
    }
    return HEAD_ABSENT
  }
}

function isI18nJsonFile(relPath) {
  return relPath.startsWith(I18N_MESSAGES_PREFIX) && relPath.endsWith('.json')
}

/**
 * 判据核心(纯函数,零 IO):输入 = 候选清单 + 两把行数的取面器 + 两个阈。
 * 生产档、`--self-test` 与 §22c 镜像测试走**同一个**这里(禁止第二份判据);
 * 变异自证 = 把某个阈递进"永不成立"的那一档,看对应夹具必须翻面 —— 翻面即证明该分支
 * 承重,不翻面即证明这条夹具是恒过的假证。
 * `headLinesOf` 值域 = 三态(修 D1):number / `HEAD_ABSENT` / null,两哨位各归各桶,
 * 摘掉任一支桶分派对应夹具必须翻面(镜像 T6 M3/M3b 钉这一格)。
 * @returns {{truncations:Array, skippedNewFile:string[], unreadable:string[], headUnreadable:string[]}}
 */
function detectTruncations(candidates, deps) {
  const {
    headLinesOf,
    stagedLinesOf,
    ratio = TRUNCATION_RATIO,
    minDecrease = MIN_DECREASE_LINES,
  } = deps
  const truncations = []
  const skippedNewFile = []
  const unreadable = []
  const headUnreadable = []

  for (const relPath of candidates) {
    const headLines = headLinesOf(relPath)
    // 新增文件(HEAD 树明说没有该条目)跳过 —— D1:只有这一态能叫"新增"
    if (headLines === HEAD_ABSENT) {
      skippedNewFile.push(relPath)
      continue
    }
    // "该存在却读不出"不洗成新增(§0.3):落 headUnreadable,由 run 层折成未判定
    if (headLines === null || headLines === undefined) {
      headUnreadable.push(relPath)
      continue
    }

    const stagedLines = stagedLinesOf(relPath)
    // 索引面在清单里被枚举到 = 该存在于索引;读不出(工作区回退也失败)⇒ 未判定输入
    if (stagedLines === null) {
      unreadable.push(relPath)
      continue
    }

    const decrease = headLines - stagedLines
    if (decrease <= minDecrease) continue

    const ratioNow = stagedLines / headLines
    if (ratioNow >= ratio) continue

    truncations.push({
      relPath,
      headLines,
      stagedLines,
      decrease,
      decreasePercent: ((1 - ratioNow) * 100).toFixed(1),
    })
  }
  return { truncations, skippedNewFile, unreadable, headUnreadable }
}

/**
 * 一面判定的全过程(取面 + 过滤 + 判据),返回结论,不打印、不 exit。
 * state: 'undetermined'(①scope='list' 清单整面取不到 / ②scope='per-file' 候选取材面读不出,修 D1) |
 *        'skip'(真没有 i18n 候选) | 'pass'(有候选、零命中且零未判定) | 'fail'(命中 ≥1)
 * opts.readers 仅供自证/镜像注入判据面(生产路径走真实取面器;注入不落盘,不是放行通道)。
 */
function runI18nIntegrity(opts = {}) {
  const root = opts.root ?? SCRIPT_REPO_ROOT
  const listed = getStagedFiles(root)
  if (listed.error) return { state: 'undetermined', scope: 'list', why: listed.error, root }
  const i18nStaged = listed.files.filter(isI18nJsonFile)
  if (i18nStaged.length === 0) return { state: 'skip', i18nStaged, root }
  const reasons = new Map()
  const readers = opts.readers ?? {
    headLinesOf: (p) => readHeadLines(p, root, reasons),
    stagedLinesOf: (p) => countStagedLines(p, root, reasons),
  }
  const detected = detectTruncations(i18nStaged, readers)
  if (detected.truncations.length > 0)
    return {
      state: 'fail',
      i18nStaged,
      truncations: detected.truncations,
      skipped: detected,
      root,
    }
  // D1(修法席):"没量到"绝不写成"判过了" —— 逐文件取材失败 ⇒ 未判定,逐枚点名(§0.3)
  if (detected.headUnreadable.length > 0 || detected.unreadable.length > 0)
    return {
      state: 'undetermined',
      scope: 'per-file',
      i18nStaged,
      undeterminedFiles: [
        ...detected.headUnreadable.map((p) => ({
          relPath: p,
          face: 'HEAD',
          why: reasons.get(p) || '(原因未记录)',
        })),
        ...detected.unreadable.map((p) => ({
          relPath: p,
          face: '索引',
          why: reasons.get(p) || '(索引面与工作区回退都取不到)',
        })),
      ],
      skipped: detected,
      root,
    }
  return { state: 'pass', i18nStaged, skipped: detected, root }
}

/** D1(修法席):"新增跳过 / 读不出"永远进打印面 —— 账面诚实,不许只住在返回值阴影里。 */
function printSkippedLedger(res) {
  const s = res.skipped
  if (!s) return
  console.log(
    `${C.dim}  取材账面:候选 ${res.i18nStaged.length} · 新增跳过(HEAD 无此 blob)${s.skippedNewFile.length} · HEAD 面读不出 ${s.headUnreadable.length} · 索引面读不出 ${s.unreadable.length}${C.reset}`,
  )
  // 红档只报数不列路径(放过型不得混进点名区);通过档如实列出新增跳过者
  if (res.state === 'pass' && s.skippedNewFile.length > 0)
    console.log(`${C.dim}    新增跳过:${s.skippedNewFile.join(', ')}${C.reset}`)
}

/** 结论 → 打印 + 退出码(旧三档文案保持逐字节相同;undetermined 分 ①清单面 ②逐文件面两支)。 */
function printResult(res) {
  if (res.state === 'undetermined') {
    if (res.scope === 'per-file') {
      console.log(
        `${C.yellow}[validate-i18n-integrity] ⚠️ 未判定 (${res.undeterminedFiles.length} 枚候选的取材面读不出——"没判"绝不写成"判过",也不冒红)${C.reset}`,
      )
      for (const f of res.undeterminedFiles) {
        console.log(
          `${C.yellow}  ${f.relPath}${C.reset} ${C.dim}[${f.face}面] ${f.why ?? '(原因未记录)'}${C.reset}`,
        )
      }
      console.log(
        `${C.dim}  出路:先让 git 取材面可用(对象库/索引没坏、无并发锁残留)再重跑本门;这不是"无截断"也不是"有截断"。${C.reset}`,
      )
      return 2
    }
    console.log(
      `${C.yellow}[validate-i18n-integrity] ⚠️ 未判定 (staged 清单整面取不到,本门一个文件都没判)${C.reset}`,
    )
    console.log(`${C.dim}  取面失败:${res.why}${C.reset}`)
    console.log(
      `${C.dim}  这一档既不是"没有 i18n 改动"、也不是"判过了";先让 git 取面可用再重跑。${C.reset}`,
    )
    return 2
  }
  if (res.state === 'skip') {
    console.log(`${C.green}[validate-i18n-integrity] ⏭  跳过 (无 staged i18n 文件)${C.reset}`)
    return 0
  }
  if (res.state === 'fail') {
    console.log(`${C.red}[validate-i18n-integrity] 检测到 i18n 文件疑似被截断!${C.reset}`)
    console.log('')
    for (const t of res.truncations) {
      console.log(`${C.red}  ${t.relPath}${C.reset}`)
      console.log(
        `${C.red}    HEAD: ${t.headLines} 行 → staged: ${t.stagedLines} 行 (减少 ${t.decrease} 行, ${t.decreasePercent}%)${C.reset}`,
      )
    }
    console.log('')
    console.log(`${C.yellow}修复建议:${C.reset}`)
    console.log(`${C.dim}  可能是 lint-staged/prettier 解析大 JSON 失败导致截断事故。${C.reset}`)
    console.log(`${C.dim}  建议执行以下命令恢复后重新编辑/格式化:${C.reset}`)
    for (const t of res.truncations) {
      console.log(`  ${C.cyan}git restore --staged --worktree ${t.relPath}${C.reset}`)
    }
    console.log('')
    printSkippedLedger(res)
    return 1
  }
  console.log(
    `${C.green}[validate-i18n-integrity] ✅ 通过 (${res.i18nStaged.length} 个 i18n 文件完整性正常)${C.reset}`,
  )
  printSkippedLedger(res)
  return 0
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exit(runSelfTest())
    return
  }
  // D2(修法席):定根唯一出口 resolveRoot(禁 cwd() 定根);
  // --staged 兼容 runner 调用约定(无额外语义,本门恒判索引面)
  const rr = resolveRoot(argv)
  if (rr.error) {
    console.log(
      `${C.yellow}[validate-i18n-integrity] ⚠️ 未判定 (定根旗用法错,拒绝静默回落默认根):${rr.error}${C.reset}`,
    )
    process.exit(2)
    return
  }
  process.exit(printResult(runI18nIntegrity({ root: rr.root })))
}

// ═════════════════ self-test(真夹具,绝不扫真仓) ═════════════════
// 夹具落 mkScratch()(§15b:工作区外 + 进程退出结构性回收;守门 208 禁在仓库树内 git init)。
// 本门判的是**索引面 vs HEAD 面**的行数回退,所以夹具必须是真 git 仓 + 真 staged 改动:
// 只喂内存对象等于没量那两把 `git show`。三态各 ≥1 枚 + 四条变异自证。

/** 造一枚**恰好 n 行**的 JSON 形态文本(本门只数行、不解析,故内容无需合法)。 */
function jsonLines(n) {
  const body = []
  for (let i = 0; i < n - 2; i++) body.push(`  "k${i}": "v${i}"`)
  return `{\n${body.join(',\n')}\n}`
}

function writeRel(rootDir, rel, content) {
  const abs = join(rootDir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content, 'utf8')
}

function initRepo(dir) {
  gitRaw(['init', '-q'], dir)
  gitRaw(['config', 'user.email', 'selftest@example.invalid'], dir)
  gitRaw(['config', 'user.name', 'selftest'], dir)
  return dir
}

function runCli(cwd, args, env) {
  return spawnSync(process.execPath, [SELF_PATH, ...(args || [])], {
    encoding: 'utf8',
    cwd,
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 16 * 1024 * 1024,
    ...(env ? { env: { ...process.env, ...env } } : {}),
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function lastLine(s) {
  return String(s ?? '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .slice(-1)[0]
}

function runSelfTest() {
  const { t: ck, report } = makeRegistrar()
  const boxes = []
  const mine = (prefix) => {
    const d = mkScratch(prefix)
    boxes.push(d)
    return d
  }
  // 基线五枚:四枚在射程内(前缀 + .json)、一枚在射程外(other/)
  const baseline = {
    'packages/i18n/messages/en.json': 400,
    'packages/i18n/messages/sk.json': 400,
    'packages/i18n/messages/zh.json': 400,
    'packages/i18n/messages/ja.json': 180,
    'packages/other/data.json': 400,
  }
  // 放过型改动,四型各自**只**由一条判据守住(变异自证就是逐条摘掉那一面):
  //   sk 减 150 行(> 减量阈)但留 62.5% ⇒ 只有比值闸在守
  //   ja 减 100 行(= 减量阈,阈是 >)且比值 44.4% 已破 ⇒ 只有减量闸在守
  //   zh 减 50 行、留 87.5% ⇒ 两条闸都守(正常编辑的对照)
  //   other/data.json 腰斩但不在前缀射程内 ⇒ 根本不进候选
  const benignEdits = {
    'packages/i18n/messages/sk.json': 250,
    'packages/i18n/messages/zh.json': 350,
    'packages/i18n/messages/ja.json': 80,
    'packages/other/data.json': 10,
  }

  try {
    // ── 夹具仓 A:同仓内同时含「必红」与四种放过 ──
    const A = mine('i18n-integrity-red-')
    initRepo(A)
    for (const [rel, n] of Object.entries(baseline)) writeRel(A, rel, jsonLines(n))
    gitRaw(['add', '-A'], A)
    gitRaw(['commit', '-qm', 'fixture-baseline'], A)
    writeRel(A, 'packages/i18n/messages/en.json', jsonLines(100)) // 腰斩 ⇒ 必红
    for (const [rel, n] of Object.entries(benignEdits)) writeRel(A, rel, jsonLines(n))
    writeRel(A, 'packages/i18n/messages/ko.json', jsonLines(12)) // HEAD 无此文件 ⇒ 新增跳过
    gitRaw(['add', '-A'], A)

    ck(
      '夹具前置:jsonLines(n) 的行数 == 名义 n(用生产 countLines 量,错基底则全盘作废)',
      countLines(jsonLines(400)) === 400 && countLines(jsonLines(100)) === 100,
    )

    const redRun = runCli(A, ['--root', A])
    ck(
      `三态②判出缺口 ⇒ rc=1 且点名必红那枚(实得 rc=${redRun.status})`,
      redRun.status === 1 &&
        /疑似被截断/.test(redRun.stdout) &&
        /packages\/i18n\/messages\/en\.json/.test(redRun.stdout),
      JSON.stringify({ rc: redRun.status, out: lastLine(redRun.stdout) }),
    )
    const redJudge = runI18nIntegrity({ root: A })
    ck(
      '三态②判据面:命中集恰为 1 枚(en),四种放过型都不在命中集里',
      redJudge.state === 'fail' &&
        redJudge.truncations.length === 1 &&
        redJudge.truncations[0].relPath === 'packages/i18n/messages/en.json',
      JSON.stringify(redJudge.truncations),
    )
    ck(
      '三态②不并桶:四型放过各自如实落桶(新增跳过 = ko.json;射程外根本没进候选 ⇒ 候选 5 枚)',
      redJudge.skipped.skippedNewFile.join() === 'packages/i18n/messages/ko.json' &&
        redJudge.skipped.unreadable.length === 0 &&
        redJudge.i18nStaged.length === 5,
      JSON.stringify({ staged: redJudge.i18nStaged, skipped: redJudge.skipped }),
    )
    ck(
      '三态②反向对照:红档打印里不含放过的那几枚(账面行只报数不列路径;不是"喊了就算过")',
      !/sk\.json|zh\.json|ko\.json|ja\.json|other\/data\.json/.test(redRun.stdout),
    )
    // D1 三态①(真 git 面直读):在 HEAD 的枚量出行数;HEAD 树无条目的枚必须落 HEAD_ABSENT
    ck(
      'D1 三态①直读:en(HEAD 有)=400 行而 ko(HEAD 树无条目)=HEAD_ABSENT 哨兵,两态不同形',
      readHeadLines('packages/i18n/messages/en.json', A, null) === 400 &&
        readHeadLines('packages/i18n/messages/ko.json', A, null) === HEAD_ABSENT,
    )

    // ── 夹具仓 B:只有放过型改动 ⇒ 判通过 rc=0 ──
    const B = mine('i18n-integrity-pass-')
    initRepo(B)
    for (const [rel, n] of Object.entries(baseline)) writeRel(B, rel, jsonLines(n))
    gitRaw(['add', '-A'], B)
    gitRaw(['commit', '-qm', 'fixture-baseline'], B)
    for (const [rel, n] of Object.entries(benignEdits)) writeRel(B, rel, jsonLines(n))
    writeRel(B, 'packages/i18n/messages/ko.json', jsonLines(12))
    gitRaw(['add', '-A'], B)
    const passRun = runCli(B, ['--root', B])
    ck(
      `三态①判通过 ⇒ rc=0 + 候选数 4(sk/zh/ja/ko;实得 rc=${passRun.status})`,
      passRun.status === 0 && /\(4 个 i18n 文件完整性正常\)/.test(passRun.stdout),
      JSON.stringify({ rc: passRun.status, out: lastLine(passRun.stdout) }),
    )
    ck(
      'D1 账面进打印面:通过档列出新增跳过者(ko)且计数行含四桶报数',
      /新增跳过:.*ko\.json/.test(passRun.stdout) && /取材账面:候选 4/.test(passRun.stdout),
      JSON.stringify({ out: String(passRun.stdout).split('\n').slice(-3).join(' | ') }),
    )

    // ── 夹具仓 C:索引 == HEAD(真无改动)⇒ 合法「跳过」,与③「取不到」不得同形 ──
    const cc = mine('i18n-integrity-skip-')
    initRepo(cc)
    writeRel(cc, 'packages/i18n/messages/en.json', jsonLines(400))
    gitRaw(['add', '-A'], cc)
    gitRaw(['commit', '-qm', 'fixture-baseline'], cc)
    const skipRun = runCli(cc, ['--root', cc])
    ck(
      `三态①b 真无候选 ⇒ rc=0 + 「跳过」(实得 rc=${skipRun.status})`,
      skipRun.status === 0 && /跳过 \(无 staged i18n 文件\)/.test(skipRun.stdout),
      JSON.stringify({ rc: skipRun.status, out: lastLine(skipRun.stdout) }),
    )
    // D2(env 通道 + cwd 不作数):cwd 钉在"无改动"夹具 cc 上,env I18N_INTEGRITY_ROOT 指向红仓 A
    // ⇒ 必须判 A(rc=1)。旧形态按 cwd 定根时这一跑会读 cc 记"跳过"——定根错位即此型。
    const envRootRun = runCli(cc, [], { I18N_INTEGRITY_ROOT: A })
    ck(
      `D2 env 定根:I18N_INTEGRITY_ROOT 覆盖 cwd,判的是 env 指的仓不是站着的仓(实得 rc=${envRootRun.status})`,
      envRootRun.status === 1 && /疑似被截断/.test(envRootRun.stdout),
      JSON.stringify({ rc: envRootRun.status, out: lastLine(envRootRun.stdout) }),
    )
    const badRootRun = runCli(cc, ['--root'])
    ck(
      `D2 给旗不给值 ⇒ rc=2 用法错点名(绝不静默回落默认根,G-322 三态点名)(实得 rc=${badRootRun.status})`,
      badRootRun.status === 2 && /--root/.test(badRootRun.stdout) && /未判定/.test(badRootRun.stdout),
      JSON.stringify({ rc: badRootRun.status, out: lastLine(badRootRun.stdout) }),
    )

    // ── 夹具 D:git 面不可达 ⇒ 清单整面取不到 ⇒ 必须「未判定」rc=2 ──
    // 注入形态选 GIT_DIR=<不存在的 gitdir>:它复现的是本仓真踩过的"git 面问不出东西"
    // (IDE 自带 git 被升级烂掉 / gitdir 指针失效),而不是伪造一个假异常。
    const D = mine('i18n-integrity-nogit-')
    const brokenFace = { GIT_DIR: join(D, 'not-a-gitdir') }
    const undRun = runCli(D, ['--root', D], brokenFace)
    ck(
      `三态③取不到输入 ⇒ rc=2 且显式「未判定」(实得 rc=${undRun.status})`,
      undRun.status === 2 && /未判定/.test(undRun.stdout),
      JSON.stringify({ rc: undRun.status, out: lastLine(undRun.stdout) }),
    )
    ck(
      '三态③不记绿也不冒红:未判定档不得打印「疑似被截断」也不得打印「完整性正常」',
      !/疑似被截断/.test(undRun.stdout) && !/完整性正常/.test(undRun.stdout),
      JSON.stringify({ out: lastLine(undRun.stdout) }),
    )
    // D5 调查结论(修法席现读,全文见头注):这个"问不出工作树"的落点其实是命中了 mkScratch 的
    // 防逃逸边界伪仓 `.no-git-boundary`(bare、空索引)——`diff --cached` 报"成功 + 空清单"是
    // **那个面的如实结论**(同一面上 `git add` 被 128 拒「must be run in a work tree」,夹具实测;
    // 边界面上结构上装不下任何真实 staged 改动)⇒ 不构成假绿,走 skip(退 0)正确。
    // 真正"取不到面"(GIT_DIR 失效等)由上一组 rc=2 接住;本条只如实登记,未新增静默放行支。
    const silentEmpty = runCli(D, ['--root', D])
    ck(
      '射程边界(D5 调查结论):边界伪仓落点 git 报"成功 + 空清单"= 该面的如实空面 ⇒ skip 退 0(不判死不记红)',
      silentEmpty.status === 0 && /跳过 \(无 staged i18n 文件\)/.test(silentEmpty.stdout),
      JSON.stringify({ rc: silentEmpty.status, out: lastLine(silentEmpty.stdout) }),
    )

    // ── 夹具 F(D1 三态②,真 git 面):HEAD 树有条目而 blob 读不出 ⇒ 逐文件未判定,rc=2 逐枚点名 ──
    // 毁法 = 删 loose object(夹具实测:`git show` 报 `bad object` 而 `git ls-tree` 仍逐字报条目行)。
    // staged 侧只写 390 行的良性编辑 ⇒ 旧形态把 HEAD 读不出洗成"新增跳过"并记绿,新形态必须点名;
    // 摘掉 D1 那一支(把 null 并回 skippedNewFile)这两条即翻红(交付自证⑥)。
    const F = mine('i18n-integrity-unreadable-')
    initRepo(F)
    writeRel(F, 'packages/i18n/messages/en.json', jsonLines(400))
    gitRaw(['add', '-A'], F)
    gitRaw(['commit', '-qm', 'fixture-baseline'], F)
    const enSha = String(gitRaw(['rev-parse', 'HEAD:packages/i18n/messages/en.json'], F)).trim()
    unlinkSync(join(F, '.git', 'objects', enSha.slice(0, 2), enSha.slice(2)))
    writeRel(F, 'packages/i18n/messages/en.json', jsonLines(390)) // 良性编辑:判不出≠判过,必须未判定
    gitRaw(['add', '-A'], F)
    const fJudge = runI18nIntegrity({ root: F })
    ck(
      'D1 三态②判据面:blob 毁 ⇒ per-file 未判定,逐枚点名 en 且原因带 git 实得(bad object)',
      fJudge.state === 'undetermined' &&
        fJudge.scope === 'per-file' &&
        fJudge.undeterminedFiles.length === 1 &&
        fJudge.undeterminedFiles[0].relPath === 'packages/i18n/messages/en.json' &&
        /bad object/.test(fJudge.undeterminedFiles[0].why),
      JSON.stringify(fJudge.undeterminedFiles),
    )
    const fRun = runCli(F, ['--root', F])
    ck(
      `D1 三态②CLI 面 ⇒ rc=2 + 点名路径,既不记绿也不冒红(实得 rc=${fRun.status})`,
      fRun.status === 2 &&
        /未判定/.test(fRun.stdout) &&
        /packages\/i18n\/messages\/en\.json/.test(fRun.stdout) &&
        !/疑似被截断/.test(fRun.stdout) &&
        !/完整性正常/.test(fRun.stdout),
      JSON.stringify({ rc: fRun.status, out: lastLine(fRun.stdout) }),
    )
    // 首提交(HEAD unborn)不得被当成"读不出"(§12e 恒红门禁令):未 commit 的仓里 staged i18n 新文件
    // ⇒ 全部是合法新增 ⇒ pass,绝不 rc=2。
    const U = mine('i18n-integrity-unborn-')
    initRepo(U)
    writeRel(U, 'packages/i18n/messages/en.json', jsonLines(120))
    gitRaw(['add', '-A'], U)
    const uJudge = runI18nIntegrity({ root: U })
    ck(
      'D1 边界:HEAD unborn(首次提交)⇒ staged 新文件全部算新增跳过,不误落未判定',
      uJudge.state === 'pass' &&
        uJudge.skipped.skippedNewFile.length === 1 &&
        uJudge.skipped.headUnreadable.length === 0,
      JSON.stringify({ state: uJudge.state, skipped: uJudge.skipped }),
    )

    // ── 变异自证:摘掉某一判据分支 ⇒ 对应夹具必须翻面(证明分支承重、夹具不是恒过) ──
    const candsA = [
      'packages/i18n/messages/en.json',
      'packages/i18n/messages/sk.json',
      'packages/i18n/messages/zh.json',
      'packages/i18n/messages/ja.json',
    ]
    const depsA = {
      headLinesOf: (p) => readHeadLines(p, A, null),
      stagedLinesOf: (p) => countStagedLines(p, A),
    }
    const prod = detectTruncations(candsA, depsA)
    ck(
      '变异前置:生产阈下 candsA 恰命中 1 枚(只有 en)',
      prod.truncations.length === 1 &&
        prod.truncations[0].relPath === 'packages/i18n/messages/en.json',
      JSON.stringify(prod.truncations),
    )
    // 摘比值闸 = 把阈推到"任何比值都算破"的反面(阈 +Infinity ⇒ `ratioNow >= ratio` 永假)
    const noRatio = detectTruncations(candsA, { ...depsA, ratio: Number.POSITIVE_INFINITY })
    ck(
      '变异 M1 摘比值闸 ⇒ sk.json(留 62.5%)翻红 ⇒ 比值阈承重',
      noRatio.truncations.some((x) => x.relPath === 'packages/i18n/messages/sk.json') &&
        noRatio.truncations.length > prod.truncations.length,
    )
    const noMin = detectTruncations(candsA, { ...depsA, minDecrease: Number.NEGATIVE_INFINITY })
    ck(
      '变异 M2 摘减量闸 ⇒ ja.json(减 100 行 = 阈本身)翻红 ⇒ 减量阈承重',
      noMin.truncations.some((x) => x.relPath === 'packages/i18n/messages/ja.json') &&
        noMin.truncations.length > prod.truncations.length,
    )
    const noHead = detectTruncations(candsA, { ...depsA, headLinesOf: () => HEAD_ABSENT })
    ck(
      '变异 M3 摘 HEAD 面(全按新增)⇒ 命中集归零(en 由红转跳过)⇒ 红是量出来的,不是写出来的',
      noHead.truncations.length === 0 && noHead.skippedNewFile.length === 4,
    )
    // M3b(D1 三态分桶承重):把 HEAD 面全递成 null ⇒ 4 枚落 headUnreadable 且 skippedNewFile 恰 0。
    // 把两支并回一支(旧 D1 形态 null=新增跳过)或摘掉哨兵分派,这条即翻红(交付自证⑥)。
    const headDead = detectTruncations(candsA, { ...depsA, headLinesOf: () => null })
    ck(
      '变异 M3b 摘 D1 三态分桶 ⇒ null 全落 headUnreadable(4)且 skippedNewFile 恰 0,两桶绝不并',
      headDead.truncations.length === 0 &&
        headDead.headUnreadable.length === 4 &&
        headDead.skippedNewFile.length === 0,
      JSON.stringify(headDead),
    )
    const noPrefix = detectTruncations(['packages/other/data.json'], {
      headLinesOf: (p) => readHeadLines(p, A, null),
      stagedLinesOf: (p) => countStagedLines(p, A),
    })
    ck(
      '变异 M4 放开前缀 ⇒ other/data.json 进命中集(生产面由 isI18nJsonFile 挡在候选外)',
      noPrefix.truncations.length === 1 &&
        isI18nJsonFile('packages/other/data.json') === false &&
        isI18nJsonFile('packages/i18n/messages/en.json') === true,
    )

    // ── 阈边界成对(按生产常量推,不写死数字;§22c) ──
    const head = MIN_DECREASE_LINES + 80
    const overMin = detectTruncations(['b.json'], {
      headLinesOf: () => head,
      stagedLinesOf: () => head - (MIN_DECREASE_LINES + 1),
    })
    const atMin = detectTruncations(['b.json'], {
      headLinesOf: () => head,
      stagedLinesOf: () => head - MIN_DECREASE_LINES,
    })
    ck(
      '边界成对:减量 = MIN_DECREASE_LINES+1 ⇒ 红;恰 = MIN_DECREASE_LINES ⇒ 放过(阈是 >)',
      overMin.truncations.length === 1 && atMin.truncations.length === 0,
      JSON.stringify({ overMin: overMin.truncations, atMin: atMin.truncations }),
    )
    const atRatio = detectTruncations(['b.json'], {
      headLinesOf: () => 1000,
      stagedLinesOf: () => Math.ceil(1000 * TRUNCATION_RATIO),
    })
    const underRatio = detectTruncations(['b.json'], {
      headLinesOf: () => 1000,
      stagedLinesOf: () => Math.ceil(1000 * TRUNCATION_RATIO) - 1,
    })
    ck(
      '边界成对:比值恰 = TRUNCATION_RATIO ⇒ 放过;再少一行 ⇒ 红(阈是 <)',
      atRatio.truncations.length === 0 && underRatio.truncations.length === 1,
    )

    // ── 形状锁:§22d 入口守卫 + 三档文案互斥(摘掉即翻红,不是注释里的承诺) ──
    const selfSrc = readFileSync(SELF_PATH, 'utf8')
    ck(
      '形状锁:入口守卫是 pathToFileURL 形态(禁手拼 file:///)',
      selfSrc.includes('pathToFileURL(process.argv[1]).href') && !/'file:\/\/\/'/.test(selfSrc),
    )
    ck('形状锁:main() 走守卫位调用,顶层不裸跑', /if \(isDirectRun\)/.test(selfSrc))
    // D2 形状锁:定根不得回到 cwd 形态(字面量拆开写,免得这条断言自己把靶子造出来)
    const cwdToken = 'process.' + 'cwd()'
    ck(
      '形状锁(D2/§15):全文件不出现 cwd 定根字面量,且由 import.meta.url 推导 + flag-value 单源取 --root',
      !selfSrc.includes(cwdToken) &&
        selfSrc.includes("const SCRIPT_REPO_ROOT = resolve(SCRIPT_DIR, '..')") &&
        selfSrc.includes("requireFlagValue(argv, '--root'"),
    )
    // D3 形状锁:两枚 blob 取面已收口 face-reader;裸派生字样拆 token 构造(头注叙述含该词,
    // 整文件 includes 会误伤自己的说明文字),代码面必须为 0 且 gitRaw 两腿装车可见
    const execSyncToken = 'exec' + 'Sync'
    ck(
      '形状锁(D3/§0.6):本文件不含裸 exec 系派生调用(仅剩 spawnSync 自跑 CLI),gitRaw 两腿装车',
      !selfSrc.includes(execSyncToken + '(') &&
        !selfSrc.includes(`import { ${execSyncToken}`) &&
        selfSrc.includes("import { spawnSync } from 'node:child_process'") &&
        selfSrc.includes("gitRaw(['show', `HEAD:${relPath}`]") &&
        selfSrc.includes("gitRaw(['show', `:${relPath}`]"),
    )
  } finally {
    for (const d of boxes) {
      try {
        rmScratch(d, { bestEffort: true })
      } catch {
        /* 清理失败不得改写结论 —— 判据的红留在断言里(见 scratch-dir 头注) */
      }
    }
  }

  const r = report()
  for (const c of r.cases) {
    console.log(`${c.pass ? '  ✅' : '  ❌'} ${c.name}${c.pass ? '' : ` —— got=${c.got}`}`)
  }
  console.log(
    `[validate-i18n-integrity] --self-test ${r.pass}/${r.cases.length} 通过,${r.fail} 失败${r.fail ? ' ❌' : ' ✅'}`,
  )
  return r.fail ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  I18N_MESSAGES_PREFIX,
  TRUNCATION_RATIO,
  MIN_DECREASE_LINES,
  HEAD_ABSENT,
  SCRIPT_REPO_ROOT,
  ROOT_ENV,
  resolveRoot,
  countLines,
  countStagedLines,
  readHeadLines,
  isI18nJsonFile,
  getStagedFiles,
  detectTruncations,
  runI18nIntegrity,
  printResult,
  jsonLines,
  writeRel,
  initRepo,
  runCli,
  SELF_PATH,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
