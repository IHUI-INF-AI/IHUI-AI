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
 * 检测逻辑(2026-10-27 现读复述;**本席只加自证据,未动任何判据**):
 * - 扫描 staged 中的 packages/i18n/messages/ 下所有 .json 文件(含子目录)
 * - 对比 staged 版本行数 vs HEAD 版本行数
 * - 若 staged 行数 < HEAD 行数 × 0.5 且减少量 > 100 行 → 判定截断事故(blocking)
 * - 新增文件(HEAD 中不存在)跳过
 *
 * 一句话:这枚门判的是「索引里的 i18n JSON 相对 HEAD 有没有**腰斩式**变薄」——
 * `TRUNCATION_RATIO`(比值)与 `MIN_DECREASE_LINES`(减量)**两条同时成立**才喊红。
 *
 * 用法: node scripts/validate-i18n-integrity.mjs [--staged] [--self-test]
 *   --staged     兼容 guardian-runner 调用约定(脚本始终检查 staged 文件;该旗无额外语义)
 *   --self-test  真 git 夹具取证(绝不扫真仓):三态各 ≥1 枚 + 四条变异自证,rc 0/1
 *
 * ## 三档退出码各由什么条件产生(2026-10-27 现读)
 *   0 = 判通过:索引里没有 packages/i18n/messages/**.json 改动(打印「⏭  跳过」),
 *       或有候选但一枚都没命中双阈(打印「✅ 通过 (N 个 …)」)。
 *   1 = 判出缺口:候选里至少一枚命中双阈 ⇒ 逐条点名 HEAD/staged 行数与减少量。
 *   2 = 未判定:**staged 清单整面取不到**(git 派生抛错)⇒ 显式点名「未判定」并打印原因。
 *       这一档是本次(2026-10-27 自证据补齐)从"记绿"里分出来的**唯一**一处新增,而且它
 *       只在"本门一个文件都没判"时到达:旧形态把同一型打印成「跳过 (无 staged i18n 文件)」
 *       并退 0 —— 那是把"没量到"说成"量过了"(§0.3)。阈值、候选集、跳过规则、判红条件
 *       一字未改;凡旧形态真的做出判定的输入,新形态的结论与打印逐字节相同(取证:
 *       `--self-test` 的三态组 + 一次性 A/B 对照,旧 blob 与新版跑同一批夹具仓)。
 *
 * ## 已现读、本席刻意**未动**(交修法席,别当已修)
 *   D1 逐文件取面失败静默跳过:`countHeadLines()` 返回 null 既可能是"新增文件(合法跳过)",
 *      也可能是"`git show HEAD:<path>` 因别的原因失败(没量到)";`countStagedLines()` 返回
 *      null 同样只 `continue` ⇒ 一枚候选被跳过时,账面与"判过且合规"长得一样。改它要动判据面
 *      (把两型拆开),不在"只加自证据"的作用域内,故只在 `detectTruncations()` 的返回值里
 *      如实报 `skippedNewFile` / `unreadable` 两个计数,**不打印、不参与退出码**。
 *   D2 `ROOT = process.cwd()` 定根(§15 反模式,守门 70 的口径),现由 runner 的 cwd 兜住;
 *      改成按 `import.meta.url` 推导会移动取材面,属改判据。
 *   D3 两枚 blob 读取仍走裸 `execSync('git show …')`(清单枚举那一腿 2026-10-26 G-54 已收口到
 *      `face-reader` 的 `gitRaw`),同一文件两套 git 取面口径;守门 118 的射程不含 `validate-*.mjs`
 *      所以不报。统一收口会改重试/超时行为,属改判据。
 *   D4 runner 注册条目(id 与档位一律现读,勿照抄本文)**没有 `skipEnv`**,而同链近邻
 *      (`HUSKY_SKIP_I18N_MESSAGES_EXIST` 一类)成套 ⇒ 本门红一次就只能 `--no-verify`,
 *      连带废掉该提交上全部守门(§12e)。注册面是多人争用面,**本席未改**,建议登记
 *      `HUSKY_SKIP_I18N_INTEGRITY`(由 guardian-runner 分发循环 honors,门体自身不读它)。
 *   D5 2 档的射程只到"git 派生抛错":实测(`--self-test` 的「射程边界」那条现读)git 在
 *      "取到了命令、却问不出工作树"的落点上对 `diff --cached` **报成功 + 空清单**,于是
 *      `getStagedFiles()` 拿到的是合法空面 ⇒ 走 `skip` 退 0。"面取到了但面不可信"这一型
 *      不在本门可达面上,要收它得改判据(比如同轮再问一次 `rev-parse --git-dir`),交修法席。
 */
import { execSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gitRaw } from './lib/face-reader.mjs'
import { makeRegistrar } from './lib/selftest-registrant.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = process.cwd()
const I18N_MESSAGES_PREFIX = 'packages/i18n/messages/'
const SELF_PATH = fileURLToPath(import.meta.url)

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

function countStagedLines(relPath, root) {
  // 优先用 git show :path 读取 staged(index)版本;失败则回退到工作区文件
  try {
    const content = execSync(`git show :${relPath}`, {
      encoding: 'utf8',
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    })
    return countLines(content)
  } catch {
    // fall through to working tree
  }
  try {
    const content = readFileSync(join(root, relPath), 'utf8')
    return countLines(content)
  } catch {
    return null
  }
}

function countHeadLines(relPath, root) {
  // 读取 HEAD 版本;文件在 HEAD 中不存在(新增文件)返回 null → 跳过
  try {
    const content = execSync(`git show HEAD:${relPath}`, {
      encoding: 'utf8',
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    })
    return countLines(content)
  } catch {
    return null
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
 * @returns {{truncations:Array, skippedNewFile:string[], unreadable:string[]}}
 *   后两个计数只作如实报数用(头注 D1:当前不打印、不参与退出码)。
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

  for (const relPath of candidates) {
    const headLines = headLinesOf(relPath)
    // 新增文件(HEAD 中不存在)跳过
    if (headLines === null) {
      skippedNewFile.push(relPath)
      continue
    }

    const stagedLines = stagedLinesOf(relPath)
    // staged 版本读取失败(异常状态)跳过
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
  return { truncations, skippedNewFile, unreadable }
}

/**
 * 一面判定的全过程(取面 + 过滤 + 判据),返回三态结论,不打印、不 exit。
 * state: 'undetermined'(清单面整面取不到) | 'skip'(真没有 i18n 候选) |
 *        'pass'(有候选且零命中) | 'fail'(命中 ≥1)
 */
function runI18nIntegrity(opts = {}) {
  const root = opts.root ?? ROOT
  const listed = getStagedFiles(root)
  if (listed.error) return { state: 'undetermined', why: listed.error, root }
  const i18nStaged = listed.files.filter(isI18nJsonFile)
  if (i18nStaged.length === 0) return { state: 'skip', i18nStaged, root }
  const detected = detectTruncations(i18nStaged, {
    headLinesOf: (p) => countHeadLines(p, root),
    stagedLinesOf: (p) => countStagedLines(p, root),
  })
  if (detected.truncations.length > 0)
    return {
      state: 'fail',
      i18nStaged,
      truncations: detected.truncations,
      skipped: detected,
      root,
    }
  return { state: 'pass', i18nStaged, skipped: detected, root }
}

/** 结论 → 打印 + 退出码(四档文案与旧形态逐字节相同;仅 undetermined 是新增档)。 */
function printResult(res) {
  if (res.state === 'undetermined') {
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
    return 1
  }
  console.log(
    `${C.green}[validate-i18n-integrity] ✅ 通过 (${res.i18nStaged.length} 个 i18n 文件完整性正常)${C.reset}`,
  )
  return 0
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exit(runSelfTest())
    return
  }
  process.exit(printResult(runI18nIntegrity({ root: process.cwd() })))
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

    const redRun = runCli(A, [])
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
      '三态②反向对照:红档打印里不含放过的那几枚(不是"喊了就算过")',
      !/sk\.json|zh\.json|ko\.json|ja\.json|other\/data\.json/.test(redRun.stdout),
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
    const passRun = runCli(B, [])
    ck(
      `三态①判通过 ⇒ rc=0 + 候选数 4(sk/zh/ja/ko;实得 rc=${passRun.status})`,
      passRun.status === 0 && /\(4 个 i18n 文件完整性正常\)/.test(passRun.stdout),
      JSON.stringify({ rc: passRun.status, out: lastLine(passRun.stdout) }),
    )

    // ── 夹具仓 C:索引 == HEAD(真无改动)⇒ 合法「跳过」,与③「取不到」不得同形 ──
    const cc = mine('i18n-integrity-skip-')
    initRepo(cc)
    writeRel(cc, 'packages/i18n/messages/en.json', jsonLines(400))
    gitRaw(['add', '-A'], cc)
    gitRaw(['commit', '-qm', 'fixture-baseline'], cc)
    const skipRun = runCli(cc, [])
    ck(
      `三态①b 真无候选 ⇒ rc=0 + 「跳过」(实得 rc=${skipRun.status})`,
      skipRun.status === 0 && /跳过 \(无 staged i18n 文件\)/.test(skipRun.stdout),
      JSON.stringify({ rc: skipRun.status, out: lastLine(skipRun.stdout) }),
    )

    // ── 夹具 D:git 面不可达 ⇒ 清单整面取不到 ⇒ 必须「未判定」rc=2 ──
    // 注入形态选 GIT_DIR=<不存在的 gitdir>:它复现的是本仓真踩过的"git 面问不出东西"
    // (IDE 自带 git 被升级烂掉 / gitdir 指针失效),而不是伪造一个假异常。
    const D = mine('i18n-integrity-nogit-')
    const brokenFace = { GIT_DIR: join(D, 'not-a-gitdir') }
    const undRun = runCli(D, [], brokenFace)
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
    // 如实登记射程边界(交修法席,不是本门的结论):git 在"问不出工作树"的落点上对
    // `diff --cached` **报成功 + 空清单**,所以本门的 2 档只覆盖"git 派生抛错"那一型;
    // "面取到了但面根本不可信"这一型落在射程外(见头注 D5)。
    const silentEmpty = runCli(D, [])
    ck(
      '射程边界(如实登记,不粉饰):同一无工作树落点下 git 报"成功 + 空清单" ⇒ 本门退 0 记「跳过」',
      silentEmpty.status === 0 && /跳过 \(无 staged i18n 文件\)/.test(silentEmpty.stdout),
      JSON.stringify({ rc: silentEmpty.status, out: lastLine(silentEmpty.stdout) }),
    )

    // ── 变异自证:摘掉某一判据分支 ⇒ 对应夹具必须翻面(证明分支承重、夹具不是恒过) ──
    const candsA = [
      'packages/i18n/messages/en.json',
      'packages/i18n/messages/sk.json',
      'packages/i18n/messages/zh.json',
      'packages/i18n/messages/ja.json',
    ]
    const depsA = {
      headLinesOf: (p) => countHeadLines(p, A),
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
    const noHead = detectTruncations(candsA, { ...depsA, headLinesOf: () => null })
    ck(
      '变异 M3 摘 HEAD 面 ⇒ 命中集归零(en 由红转跳过)⇒ 红是量出来的,不是写出来的',
      noHead.truncations.length === 0 && noHead.skippedNewFile.length === 4,
    )
    const noPrefix = detectTruncations(['packages/other/data.json'], {
      headLinesOf: (p) => countHeadLines(p, A),
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
  countLines,
  countStagedLines,
  countHeadLines,
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
