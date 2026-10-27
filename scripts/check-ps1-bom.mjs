#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 守门:`.ps1` / `.psm1` 必须以 UTF-8 with BOM(EF BB BF)写入。
 *
 * 立因(2026-10-26,实证不是假想;〔数字为立门时点历史现读,现行存量一律看末行〕):
 * `AGENTS.md` 早就规定「`.ps1` 用 UTF-8 with BOM 写」,但**全仓没有任何一道尺子校验它** ——
 * 规则只活在文档里,于是当时现读 76 个 `.ps1` 里 40 个没有 BOM,而没人知道。真害在
 * `deploy/win/deploy-window-common.ps1`(对侧新增件):满篇中文、无 BOM ⇒ Windows 自带的
 * 5.1 引擎按系统代码页(zh-CN = GBK)解码,当场报「表达式或语句中包含意外的标记」并连累
 * 整个模块「缺少右 }」;对侧自带的 `deploy-window-harness` T2 专门断言「5.1 也要能加载」,
 * 因此在 main 上恒红。那不是排版问题:该模块被 `alert-dedup.ps1` 与 `ihui-monitor.ps1`
 * dot-source,prod 上只要走一次 5.1,部署窗口控制与告警去重整条功能就是坏的。
 *
 * 为什么是**差值棘轮**而不是 blocking 全量(§0.2 / §0.5):
 * 立门时现读存量 40 枚缺 BOM 是既成事实(**存量数字不得抄头注**:§0.1 凡数字一律现读,
 * 2026-10-27 现读存量为 0;对账唯一出口 = `node scripts/check-ps1-bom.mjs` 末行的「存量缺=」,
 * 逐条列存量加 `--list-existing`)。直接判全量红 = 恒红门 ⇒ 逼人 `--no-verify` ⇒ 一次绕过等于
 * 全部守门对该提交作废。所以锚点取「该文件在 HEAD 自身的状态」:
 *   · HEAD 也没有 ⇒ **存量**,只报数,不判红;
 *   · HEAD 有、工作树没有 ⇒ 本次改动**把 BOM 弄掉了**(编辑器改写 / 生成器覆盖 / `>` 重定向
 *     都会),判红 —— 这一格可自愈,补 3 字节即可;
 *   · HEAD 里根本没有 ⇒ **新增文件**,必须带 BOM,判红。
 * 判据只判「本次改动新增的违规」;存量归零是另一件事,末行照实报数。
 *
 * CLI:
 *   node scripts/check-ps1-bom.mjs                 # 工作树面(默认)
 *   node scripts/check-ps1-bom.mjs --staged        # 索引面(pre-commit 用;与其它门同形)
 *   node scripts/check-ps1-bom.mjs --json          # 机器可读
 *   node scripts/check-ps1-bom.mjs --list-existing # 逐条列存量(修存量时用)
 *   node scripts/check-ps1-bom.mjs --strict        # 全量档:存量也判红(只在存量归零后才有意义)
 *   node scripts/check-ps1-bom.mjs --self-test     # 回归自检:判据六例 + 端到端五例,红绿两向都真跑(例数以末行现读为准)
 *
 * 镜像测试(§22c 第②步:判据一律 import 本文件末尾的 `__test__`,测试里不复制第二份判据):
 *   node --test scripts/tests/check-ps1-bom.test.mjs
 *
 * 退出码(三档,§0.3 / §5c 既有口径,不造第四个数字;2026-10-27 修法席①②重写本段):
 *   0 = 判定完整且无新增违规(「面上真的零枚 .ps1」也走这一档 —— 见下面反恒红对照);
 *   1 = 判出了新增违规(或 --strict 下有存量),且每一维都量到了;
 *   2 = 未判定 —— 单枚读不到内容,**或**整张被审面取不到/两个清单都枚举到 0(§0.3
 *       「枚举到 0 个候选判死,不记绿也不冒红」;旧版在这一格退 0 绿,即修法席①的真红)。
 *   优先级:**未判定(2)排在红(1)之前**(修法席②)。依据 = 当次现读同类门的既有排序:
 *     · check-baseline-freshness:`anyUndetermined ? 2 : anyRed ? 1 : 0`;
 *     · check-gate-face-discipline:`counts.unreadable > 0 ? 2 : red.length > 0 ? 1 : 0`;
 *     · check-gate-rot / check-gate-presence-exemption:「有判不出优先落 2(拒绝出合格证)」;
 *     (反序一族 check-env-drift / check-live-doc-pathspec / check-file-write-safety 也在仓里,
 *      两族并存时选 2 优先的理由:exit 1 断言的是「读到了、判出了违规」,只要有一维没量到
 *      这句话就不完全成立;而「红被压成 2」并不放走任何东西 —— 红行照在报告面逐条点名,
 *      执行器层(scripts/lib/gate-failure-kind.mjs 2026-10-27 立的第五档)把 exit 2 + stderr
 *      自称「未判定」独立成档,批量仍以非零码收口拦下提交。1 与 2 都 ≠ 0,失效方向恒为"多拦一道"。)
 *   「未判定」的点名同时写 stdout 与 stderr:runner 侧 detectUndetermined **只读 stderr**,
 *   不写 stderr 的 exit 2 会被读成「判据判红(exit 2)」—— 那仍是拦,但把"没判"说成了"判过"(§0.3)。
 *   反恒红对照(§12e):干净仓 + 真的零 .ps1(跟踪面有别的文件、只是没有 ps1/psm1)必须退 0;
 *   「整张面枚举到 0」与「面上确无 .ps1」由 readTrackedList 的第二问(git ls-files 全量)分开,
 *   前者判 2、后者判 0 —— 这正是修法席①要修的那一格。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
// §15b:临时夹具唯一落点(修法席③,2026-10-27 —— 旧版走 os.tmpdir()+mkdtempSync,
// 被 check-fixture-tmpdir 的 F1/F2 点名在册;不得回退)。
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const BOM = Buffer.from([0xef, 0xbb, 0xbf])
const ROOT = resolve(import.meta.dirname, '..')

function git(args, { cwd = ROOT, allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
      maxBuffer: 512 * 1024 * 1024,
      encoding: 'buffer',
      // 门 193 硬要求:派生 git 必须显式接管 stdio —— 不写时本机 0/30 成功(EBUSY)。
      // 取值按 face-reader 同族惯例 ['ignore','pipe','pipe'](这里不喂 stdin)。
      stdio: ['ignore', 'pipe', 'pipe'],
      // 门 52:本机派生进程禁弹控制台窗口(AGENTS §5b 机器级默认钩子之外的逐点参数)。
      windowsHide: true,
    })
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

/**
 * 枚举被审面 + 判定"这张面取不取到"(修法席①的落点,2026-10-27)。三态:
 *   · 射程清单非空 ⇒ 面 ok;
 *   · 射程清单空、但**整张跟踪面有别的文件** ⇒ 面上真零枚 .ps1/.psm1 ⇒ 面 ok(允许判 0,
 *     这是"仓里确实没有 PowerShell 脚本",不是空扫;§12e 反恒红对照);
 *   · 射程清单空且全量清单也枚举到 0,或 git 直接失败 ⇒ **面取不到**(face.ok=false)
 *     ⇒ 上层判 2 未判定并点名问的是哪张面、为什么(§0.3「枚举到 0 个候选判死,不记绿」)。
 * 立因(上一席补镜像测试时现读,本次复现):裸夹具面上 `git ls-files` 退 0 且零输出 ⇒
 * 旧 `scan` 得空集 ⇒ `report([])` 退 0 绿;而旧代码 `if (!buf) return []` 那一支**结构上到不了**
 * (空输出是**真值 Buffer**,不是 null;git 真失败则因 allowFail=false 直接抛错)。
 */
function readTrackedList(cwd) {
  const face = { ok: false, why: null, listed: 0, total: null, cwd }
  const firstErr = (e) => {
    const s = String(e?.stderr || e?.message || '')
    return s.split(/\r?\n/).find((l) => l.trim() !== '') || '(无回显)'
  }
  let buf
  try {
    buf = git(['ls-files', '-z', '*.ps1', '*.psm1'], { cwd })
  } catch (e) {
    face.why = `git ls-files(射程 *.ps1/*.psm1)在 cwd=${cwd} 执行失败:${firstErr(e)}`
    return { paths: [], face }
  }
  const paths = buf.toString('utf8').split('\u0000').filter((s) => s.length > 0)
  face.listed = paths.length
  if (paths.length > 0) {
    face.ok = true
    return { paths, face }
  }
  // 空清单 ⇒ 再问一句整张跟踪面,把「真的零枚 .ps1」与「面根本取不到」分开:
  try {
    const all = git(['ls-files', '-z'], { cwd })
    face.total = all
      .toString('utf8')
      .split('\u0000')
      .filter((s) => s.length > 0)
      .length
  } catch (e) {
    face.why = `射程清单为空后追问全量清单(git ls-files)在 cwd=${cwd} 执行失败:${firstErr(e)}`
    return { paths, face }
  }
  if (face.total > 0) {
    face.ok = true // 面上有跟踪文件、只是没有 .ps1/.psm1 ⇒ 真零,合法可判绿
    return { paths, face }
  }
  face.why =
    `被审面枚举到 0 个跟踪文件(cwd=${cwd}):射程清单与全量清单同为空 —— ` +
    '这不成立"该面真的没有 .ps1",而是面取不到/退化(坏 gitfile 边界、空索引、非工作树面等);' +
    '按 §0.3「枚举到 0 个候选判死」记未判定,不记绿'
  return { paths, face }
}

/** 只取清单的老出口(语义 = 成功面上的 paths;面是否取到由 readTrackedList.face 判)。 */
function listTrackedScripts(cwd) {
  return readTrackedList(cwd).paths
}

function hasBom(buf) {
  return buf.length >= 3 && buf[0] === BOM[0] && buf[1] === BOM[1] && buf[2] === BOM[2]
}

function firstBytes(buf) {
  return Buffer.from(buf.subarray(0, Math.min(3, buf.length))).toString('hex') || '(空)'
}

/** 读某一面(工作树 / 索引)的文件内容;读不到返回 null —— 不静默当成"没有 BOM" */
function readSurface(cwd, rel, surface) {
  try {
    if (surface === 'staged') return git(['cat-file', 'blob', `:${rel}`], { cwd, allowFail: true })
    return readFileSync(join(cwd, rel))
  } catch {
    return null
  }
}

/** HEAD 面:文件不在 HEAD 里返回 undefined(新增件),区别于"在但没有 BOM"(false) */
function readHead(cwd, rel) {
  const exists = git(['cat-file', '-e', `HEAD:${rel}`], { cwd, allowFail: true })
  if (!exists) return undefined
  const blob = git(['cat-file', 'blob', `HEAD:${rel}`], { cwd, allowFail: true })
  if (!blob) return undefined
  return hasBom(blob)
}

/**
 * 纯判据:给定两面读数,返回该文件的结论。
 * 抽成纯函数是为了 --self-test 能直接喂用例,不依赖真仓库状态。
 */
export function classify({ worktreeBom, headBom }) {
  if (worktreeBom === null) return 'undetermined'
  if (worktreeBom) return 'ok'
  if (headBom === undefined) return 'new-violation' // 新增件必须带 BOM
  if (headBom === false) return 'existing' // 存量:HEAD 也没有,棘轮只报数
  return 'regressed' // HEAD 有、现在没了
}

/**
 * 扫描一张面,返回 `{ rows, face }`(修法席①:face 带「这张面取不取到」的三态,
 * 空集本身不再等于"判过了")。rows 的逐枚判定链与旧版一致。
 */
function scan({ cwd = ROOT, surface = 'worktree' } = {}) {
  const { paths, face } = readTrackedList(cwd)
  face.surface = surface
  const rows = []
  for (const rel of paths) {
    const buf = readSurface(cwd, rel, surface)
    const worktreeBom = buf === null ? null : hasBom(buf)
    // 性能:只在这份文件**缺 BOM 或读不到**时才去问 HEAD —— 带 BOM 的文件结论恒为 ok,
    // 问 HEAD 只是白起一个子进程。全部被跟踪 .ps1 都带 BOM 时本门零子进程开销(立门时实测 ~50ms),
    // 否则每提交要白跑 150+ 次 git。
    const headBom = worktreeBom === true ? undefined : readHead(cwd, rel)
    rows.push({
      path: rel,
      verdict: classify({ worktreeBom, headBom }),
      first3: buf === null ? '(读不到)' : firstBytes(buf),
    })
  }
  return { rows, face }
}

function report(result, { json = false, strict = false, listExisting = false, quiet = false } = {}) {
  // 兼容直接投喂行集(镜像测试的构造面):没有 face 输入 ⇒ 视为"面 ok,只是没带清单证据"。
  const { rows, face } = Array.isArray(result) ? { rows: result, face: null } : result
  const by = (v) => rows.filter((r) => r.verdict === v)
  const ok = by('ok')
  const existing = by('existing')
  const regressed = by('regressed')
  const added = by('new-violation')
  const undetermined = by('undetermined')
  const newViolations = [...regressed, ...added]
  const faceBad = face ? face.ok === false : false
  // 未判定的总维:单枚读不到 + 整张面取不到,各算一维(末行的「未判定=」= 两者之和)。
  const unjudged = undetermined.length + (faceBad ? 1 : 0)

  const say = quiet ? () => {} : (s) => console.log(s)
  // §0.3 的点名必须**同时落 stderr**:执行器侧 detectUndetermined 只读 stderr,
  // exit 2 而 stderr 没有「未判定」字样 ⇒ 被读成「判据判红(exit 2)」= 把"没判"写成"判过"。
  const errSay = quiet ? () => {} : (s) => process.stderr.write(s + '\n')

  if (json && !quiet) {
    console.log(
      JSON.stringify(
        {
          scanned: rows.length,
          ok: ok.length,
          existingCount: existing.length,
          existing: existing.map((r) => r.path),
          regressed: regressed.map((r) => ({ path: r.path, first3: r.first3 })),
          added: added.map((r) => ({ path: r.path, first3: r.first3 })),
          undetermined: undetermined.map((r) => r.path),
          face: face
            ? { ok: face.ok, why: face.why, listed: face.listed, total: face.total, surface: face.surface, cwd: face.cwd }
            : null,
        },
        null,
        2,
      ),
    )
  } else {
    if (existing.length > 0) {
      say(
        `ℹ️  [ps1-bom] 存量缺 BOM(HEAD 也没有,棘轮只报数、不判红)共 ${existing.length} 枚` +
          (listExisting ? ':' : '(要逐条列加 --list-existing)'),
      )
      if (listExisting) for (const r of existing) say(`     ${r.first3}  ${r.path}`)
    }
    if (regressed.length > 0) {
      say(`❌ [ps1-bom] 本次改动把 BOM 弄掉了(HEAD 有、现在没有),共 ${regressed.length} 枚:`)
      for (const r of regressed) say(`     ${r.first3}  ${r.path}`)
    }
    if (added.length > 0) {
      say(`❌ [ps1-bom] 新增 .ps1 没有 BOM,共 ${added.length} 枚:`)
      for (const r of added) say(`     ${r.first3}  ${r.path}`)
    }
    if (undetermined.length > 0) {
      say(`⚠️  [ps1-bom] 读不到内容、判不了(未判定,不冒充通过)共 ${undetermined.length} 枚:`)
      for (const r of undetermined) say(`     ${r.path}`)
    }
    if (faceBad) {
      say(
        `⚠️  [ps1-bom] 被审面取不到(未判定,不记绿也不冒红):问的面=清单面 git ls-files${face.surface ? `(${face.surface} 档内容面)` : ''}@${face.cwd};原因:${face.why}`,
      )
    }
    if (newViolations.length > 0) {
      say('修复:给这些文件补 3 字节 UTF-8 BOM 前缀(正文一字节都不用动):')
      say('  node scripts/lib/ps1-add-bom.mjs <文件...>   # 见本门旁的实现,幂等、已有 BOM 不动')
    }
  }

  const red = newViolations.length > 0 || (strict && existing.length > 0)
  // 修法席②:**未判定优先于红**(2 排在 1 前;依据与不放走任何红的论证见头注「退出码」段)。
  const exit = unjudged > 0 ? 2 : red ? 1 : 0
  if (!quiet && exit === 2) {
    const parts = []
    if (undetermined.length > 0) parts.push(`单枚读不到内容 ${undetermined.length} 枚(${undetermined.map((r) => r.path).join(', ')})`)
    if (faceBad) parts.push(`整张面取不到:${face.why}`)
    errSay(`[ps1-bom] 未判定(§0.3,不记绿也不冒红,退 2):${parts.join(';')}`)
  }
  console.log(
    `[ps1-bom] 末行:面=${json ? 'json' : 'text'} 面状态=${faceBad ? '未判定' : 'ok'} 扫描=${rows.length} 带BOM=${ok.length} 存量缺=${existing.length} 新增缺=${newViolations.length} 未判定=${unjudged} 档=${strict ? 'strict' : 'ratchet'} exit=${exit}`,
  )
  return exit
}

function selfTest() {
  let fail = 0
  const cases = [
    ['带 BOM,HEAD 也有 ⇒ 绿', true, true, 'ok'],
    ['带 BOM,新增件 ⇒ 绿', true, undefined, 'ok'],
    ['无 BOM,HEAD 也没有 ⇒ 存量只报数', false, false, 'existing'],
    ['无 BOM,新增件 ⇒ 红(新增缺)', false, undefined, 'new-violation'],
    ['无 BOM,HEAD 有 ⇒ 红(本次把 BOM 弄掉了)', false, true, 'regressed'],
    ['读不到 ⇒ 未判定(不冒充通过)', null, true, 'undetermined'],
  ]
  for (const [why, worktreeBom, headBom, want] of cases) {
    const got = classify({ worktreeBom, headBom })
    const pass = got === want
    if (!pass) fail++
    console.log(`${pass ? 'PASS' : 'FAIL'}  判据:${why}  want=${want} got=${got}`)
  }

  // 端到端:临时仓里真跑扫描,红/绿/未判定三向都必须真的出现(不然就是恒绿装饰)。
  // 修法席③(2026-10-27):夹具落点从 os.tmpdir()+mkdtempSync 改走 §15b 唯一出口 mkScratch,
  // 异常路径由 finally 的 rmScratch 回收;临时 git 仓只长在 scratch 根内(§15c,门 208 对
  // .DevEnv 整枝剪除),不再往进程 TEMP 扔演练仓。
  const scratchDirs = []
  const mk = (prefix) => {
    const d = mkScratch(prefix)
    scratchDirs.push(d)
    return d
  }
  const tmp = mk('ps1bom-selftest-')
  try {
    const run = (args) =>
      execFileSync('git', args, { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    run(['init', '-q'])
    run(['config', 'user.email', 't@t'])
    run(['config', 'user.name', 't'])
    mkdirSync(join(tmp, 'd'), { recursive: true })
    const bom = Buffer.from([0xef, 0xbb, 0xbf])
    writeFileSync(join(tmp, 'd/legacy.ps1'), 'Write-Output 1\n')
    writeFileSync(join(tmp, 'd/good.ps1'), Buffer.concat([bom, Buffer.from('Write-Output 2\n')]))
    run(['add', '-A'])
    run(['commit', '-q', '-m', 'base'])

    // ① 只改内容、不碰 BOM ⇒ 必须绿(存量不算新增)
    writeFileSync(join(tmp, 'd/legacy.ps1'), 'Write-Output 11\n')
    writeFileSync(join(tmp, 'd/good.ps1'), Buffer.concat([bom, Buffer.from('Write-Output 22\n')]))
    const g1 = report(scan({ cwd: tmp }), { json: true, quiet: true })
    console.log(`${g1 === 0 ? 'PASS' : 'FAIL'}  端到端①:改内容不动 BOM ⇒ 绿(exit=${g1})`)
    if (g1 !== 0) fail++

    // ② 新增一个无 BOM 文件 ⇒ 必须红(此面每一枚都量得到,红档 1 必须可达)
    writeFileSync(join(tmp, 'd/newbie.ps1'), 'Write-Output 3\n')
    run(['add', '-A'])
    const g2 = report(scan({ cwd: tmp }), { json: true, quiet: true })
    console.log(`${g2 === 1 ? 'PASS' : 'FAIL'}  端到端②:新增无 BOM ⇒ 红(exit=${g2})`)
    if (g2 !== 1) fail++

    // ③ 把有 BOM 的文件的 BOM 弄掉 ⇒ 必须红(regressed 那一格)
    writeFileSync(join(tmp, 'd/good.ps1'), 'Write-Output 222\n')
    const g3 = report(scan({ cwd: tmp }), { json: true, quiet: true })
    console.log(`${g3 === 1 ? 'PASS' : 'FAIL'}  端到端③:原带 BOM 的文件被弄掉 BOM ⇒ 红(exit=${g3})`)
    if (g3 !== 1) fail++

    // ④ 面取不到(不 init git 的裸 scratch 面)⇒ 必须 2 未判定,绝不 0 绿(修法席①)
    const bare = mk('ps1bom-noface-')
    const r4 = scan({ cwd: bare })
    const g4 = report(r4, { json: true, quiet: true })
    const pass4 = g4 === 2 && r4.face.ok === false
    console.log(
      `${pass4 ? 'PASS' : 'FAIL'}  端到端④:面取不到(枚举到 0)⇒ 未判定(exit=${g4} 面ok=${r4.face.ok})`,
    )
    if (!pass4) fail++

    // ⑤ 有效面 + 真的零枚 .ps1(面上有别的跟踪文件)⇒ 必须 0(§12e 反恒红对照)
    const noPs = mk('ps1bom-nops-')
    const runNoPs = (args) =>
      execFileSync('git', args, { cwd: noPs, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    runNoPs(['init', '-q'])
    runNoPs(['config', 'user.email', 't@t'])
    runNoPs(['config', 'user.name', 't'])
    writeFileSync(join(noPs, 'README.md'), '# no powershell here\n')
    runNoPs(['add', '-A'])
    runNoPs(['commit', '-q', '-m', 'base'])
    const r5 = scan({ cwd: noPs })
    const g5 = report(r5, { json: true, quiet: true })
    const pass5 = g5 === 0 && r5.face.ok === true && r5.rows.length === 0
    console.log(
      `${pass5 ? 'PASS' : 'FAIL'}  端到端⑤:有效面+真零 .ps1 ⇒ 绿,不空扫判死(exit=${g5} 面ok=${r5.face.ok})`,
    )
    if (!pass5) fail++
  } finally {
    for (const d of scratchDirs) rmScratch(d, { bestEffort: true })
  }

  console.log(
    fail === 0 ? '\n自检通过(判据六例 + 端到端五例,红/绿/未判定三向都真跑)' : `\n自检失败:${fail} 例不符`,
  )
  return fail === 0 ? 0 : 1
}

// §22d 入口守卫。本门同时是 §22c 镜像测试(scripts/tests/check-ps1-bom.test.mjs)的 import 源,
// 而**没有这层守卫时测试一 import 就把宿主 process.exit 打死** —— 那等于"写了测试也跑不起来",
// 自证据通道对整族结构性不可达(守门 194 头注那一型)。取值必须走 pathToFileURL:
// 手拼 'file:///' + argv[1] 在 Windows 反斜杠下永不成立(§22d 红线)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest())
  const surface = argv.includes('--staged') ? 'staged' : 'worktree'
  process.exit(
    report(scan({ surface }), {
      json: argv.includes('--json'),
      strict: argv.includes('--strict'),
      listExisting: argv.includes('--list-existing'),
    }),
  )
}

/**
 * §22c 第①步:核心判据的**唯一**导出口。镜像测试只 import 这一份、直接用生产判据,
 * 不在测试里复制第二份常量(BOM 的三字节也由这里单源供给 —— 抄一份就是第二条真相,必漂移)。
 * 导出的是判定链的真实函数本身,不是包装:摘掉任何一支,对应测试用例必翻红。
 */
export const __test__ = {
  BOM,
  hasBom,
  firstBytes,
  readTrackedList,
  listTrackedScripts,
  readSurface,
  readHead,
  classify,
  scan,
  report,
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
