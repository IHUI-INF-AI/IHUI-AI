#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-readme-sync.mjs — README 对外能力同步守门(2026-07-22 立 / 2026-10-23 判据形状重做)
 *
 * AGENTS.md §21:新增功能模块 / API 路由 / 页面 / 端能力,必须同 commit 更新 README。
 *
 * ## 为什么重做(旧判据结构上看不到它要管的事,三条都是实测)
 *  1. 旧判据只看"本轮待提交集":`--staged` 读 `git diff --cached`,全量档读 `git diff HEAD`
 *     (工作树 vs HEAD,同样不是历史)。⇒ 一次没被提醒过的欠账,此后每一轮都判不到,
 *     **历史欠账永远审不到**。
 *  2. 旧判据里"README.md 在改动集里 ⇒ 直接 return 0",**无条件静默,一个字都不核对**。
 *     而 §21 要的恰恰是"改了功能也改了 README"那次提交里的**描述覆盖度** —— 于是最该判的那一型
 *     正是它唯一不判的一型。
 *  3. 旧判据把触发面定成 `apps/<端>/src/`、`packages/<包>/src/` 全部功能码,与"对外能力"不是一回事
 *     (改一个内部 util 也提醒),噪声大而牙小。
 *  实测对照物(2026-10-23 现读,HEAD 面):`GET /api/goods/select`、`GET /api/sign-ups`、
 *  `POST /api/auth/wechat/mini/one-tap-login` 与 web `/domains/ai`、`/domains/personal` 五项对外新增,
 *  而 `git show HEAD:README.md | grep -c '/domains/'` = 0,旧判据全量档 RC=0(通篇静默)。
 *
 * ## 新判据一句话
 *  取「窗口起点 → 被审面」这段时间里**新增的对外能力清单**,逐条问 README 面(§0.4 同面同轮:
 *  全量档 HEAD blob、`--staged` 索引 blob、`--worktree` 仅人工逃生舱)有没有对应描述;没有 ⇒ 计入违规。
 *  窗口起点 = 「被审文档最后一次被提交」与「滚动回看点(默认 7 天)」里**更旧**的那一枚 —— 只取文档
 *  锚点会失忆(本仓 README 由自动收编席高频提交,实测锚点窗口只剩 14 枚提交 ≈ 几分钟),只取回看点
 *  会丢掉"文档很久没动"的长账。
 *  能力清单的口径**全部现读仓内既有实现**,不另立一套:后端端点 = 守门 8 的唯一提取式
 *  `scripts/lib/route-registration-extract.mjs::extractApiRegistrations`;源面目录 = `SCAN_DIRS`;
 *  web 页面 = App Router 的 `page.tsx`(与 `apps/web/scripts/generate-ui-routes.mjs::toRoute` 同形)。
 *  纯判据(身份怎么取、"提到"怎么算、窗口怎么定)住在 `scripts/lib/readme-capability-surface.mjs`。
 *
 * ## 三态纪律(§0.3,绝不把"没判"写成"判过")
 *  - `covered` 面上找得到该能力的路径身份(含"资源族前缀"与 `{param}`/`:param` 混写形态);
 *  - `alias`  完整身份找不到、只找得到**多段尾巴**(去 `/api` 前缀 / 换挂载点那一族写法)
 *             ⇒ 可能是改名/别称,**不判红,逐条点名报数**;
 *  - `missing` 两种写法都不在面上 ⇒ 违规,逐条点名带出处文件;
 *  - 取不到被审面 / 取不到文档面 / 锚点解不出 / 某条腿枚举到 0 却并非"确实没有" ⇒
 *    **exit 2 显式「未判定」**,既不记绿也不冒红;
 *  - `git diff` 证明窗口内没有任何能力源文件被改动 ⇒ 是**有依据的 0**(结论行写出依据),
 *    与"枚举失效的 0"分档,不得混读。
 *
 * ## 档位纪律(§12e 恒红门禁令 —— 本门**必须留在 warn**)
 *  现读存量(2026-10-23 登记时刻读数,7 天窗口 / HEAD 面:新增 148 枚 · 已覆盖 23 · 未判定 21 ·
 *  **未描述 104**,其中"文档锚点之后新增"只 2 枚):把这些挂进提交链 = 每次提交都红 = 人人
 *  `--no-verify` = 全部守门作废。数字一律以本门末行现读为准(§0.1),不得引用本行下结论。所以:
 *  - runner 注册档位维持 **warn**(id 22 现值以 `scripts/guardian-runner.mjs` 为准,本行不定档);
 *  - 违规分两桶:`in-doc-window`(文档锚点之后新增,升档时唯一可拦的那一截)与 `backlog`(锚点之前
 *    的存量,**只报数**),归因是**单向保守**的:出处文件自锚点后没动过 ⇒ 铁存量;动过 ⇒ 计入
 *    in-doc-window(宁可多要一次定向说明,§0.10);
 *  - **升 blocking 的前置 = 全量档未描述归零**;清存量的出路是真跑得通的三条:
 *      ① `node scripts/check-readme-sync.mjs --json`  (机器可读缺口清单,逐条带 id/file/出处)
 *      ② 按 gaps[] 在 README 对应能力段把**路径身份**写进去(如 `/api/goods/select`)
 *      ③ `node scripts/check-readme-sync.mjs`         (末行须现读"未描述 0";`--strict` 再要求"未判定 0")
 *
 * ## 棘轮(2026-10-27 立,§0.5 差值棘轮)
 * 上一条只说了"留在 warn",没说"存量怎么才不会被无限加回去"—— 实测缺陷:此前 `decideExit` 只读
 * `counts.missing`,于是**一升 blocking 就因存量恒红**,而 warn 档的恒红又必然被当噪声(§12e)。
 * 补上与仓内 26 份 `*-baseline.json` 同形的差值棘轮:`scripts/readme-sync-baseline.json` 记一枚
 * `missing` 额度,判红条件改为 **现测 > 额度**(存量只报数,§0.5「棘轮锚点 = 该文件 HEAD 自身的
 * 违规数」);现测 < 额度 ⇒ 绿但点名"可下调",靠 `--update-baseline` 收额度。
 * **--update-baseline 只许降,抬不动**:额度高于现测时当场拒绝并 exit 2 —— 否则它就成了
 * "把新增写进基线消红"的洗白口(§12e「修红不得顺手削判据」)。
 * 基线件缺失 ⇒ 退回旧语义(missing > 0 即 1),不静默放宽;基线件解析不了 ⇒ exit 2 未判定(§0.3)。
 *
 * 用法:
 *   node scripts/check-readme-sync.mjs                      # 全量档:判 HEAD 面(可审历史)
 *   node scripts/check-readme-sync.mjs --staged              # 判索引面(pre-commit 钩子用)
 *   node scripts/check-readme-sync.mjs --worktree            # 人工逃生舱:盘上副本可能是别人的半编辑态
 *   node scripts/check-readme-sync.mjs --json                # 逐条缺口(清存量的入口)
 *   node scripts/check-readme-sync.mjs --strict              # 未判定/别称也计入非零出口
 *   node scripts/check-readme-sync.mjs --horizon-days 14     # 放宽回看点(默认 7)
 *   node scripts/check-readme-sync.mjs --since <rev>         # 人工问责:显式钉窗口起点
 *   node scripts/check-readme-sync.mjs --self-test           # 判据自证(构造输入,零副作用)
 *   node scripts/check-readme-sync.mjs --root <dir>          # 换基准仓(镜像测试的临时夹具用)
 *   node scripts/check-readme-sync.mjs --update-baseline     # 清理后下调棘轮额度(**只许降,抬不动**)
 *
 * 退出码:0 = 缺口未超棘轮基线 / 1 = 判出缺口超出基线(warn 档只计数,不阻塞)/ 2 = 未判定或脚本自身异常。
 * 棘轮基线件:`scripts/readme-sync-baseline.json`(§0.5 差值棘轮:锚点 = 该门全量档未描述数,只减不增)。
 * 本门 warn,结构上不需要跳门变量;档位与 skipEnv 一律以 guardian-runner.mjs 注册条目现值为准。
 *
 * 本门**不判**的格(盲区显式点名,不得读成"全覆盖"):小程序页面身份住在 `src/app.config.ts` 的
 * pages/subPackages、RN 身份住在 navigation 注册表、桌面/扩展/CLI 各有入口清单 —— 唯一口径归
 * ui-routes 生成钉(见 `scripts/check-miniapp-generated.mjs`),本门不另立第二份提取式(§0.6),
 * 只在结论行报出"窗口内动了这些面的文件数"。
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  FACE_LABEL,
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'
import * as surface from './lib/readme-capability-surface.mjs'
import { extractApiRegistrations } from './lib/route-registration-extract.mjs'
import { SCAN_DIRS } from './lib/outbound-route-facts.mjs'
import { makeRegistrar } from './lib/selftest-registrant.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120000
const GIT_MAX_BUFFER = 1 << 29
/** 棘轮基线件(§0.5 差值棘轮;锚点 = 该门全量档未描述数,只减不增) */
const BASELINE_REL = 'scripts/readme-sync-baseline.json'
/** 面标识:`:/` = 索引,`WORKTREE` = 磁盘,其余按 commit 走 ls-tree */
const REV_INDEX = ':/'
const REV_WORKTREE = 'WORKTREE'
const NEEDS_VALUE = new Set(['--horizon-days', '--since', '--root'])
const KNOWN_FLAGS = new Set([
  '--staged',
  '--worktree',
  '--json',
  '--strict',
  '--self-test',
  '--update-baseline',
  '--help',
  ...NEEDS_VALUE,
])

function gitA(args, root, opts = {}) {
  return gitRaw(args, root, { timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER, ...opts })
}

function faceToRev(face) {
  if (face === 'staged') return REV_INDEX
  if (face === 'worktree') return REV_WORKTREE
  return 'HEAD'
}

function faceOfRev(rev) {
  if (rev === REV_INDEX) return 'staged'
  if (rev === REV_WORKTREE) return 'worktree'
  return 'head'
}

/** 面内的路径清单(清单与内容同面同轮,§0.4) */
function listFiles(root, rev, dirs) {
  let out
  if (rev === REV_INDEX) {
    out = gitA(['ls-files', '--', ...dirs], root)
  } else if (rev === REV_WORKTREE) {
    out = `${gitA(['ls-files', '--', ...dirs], root)}\n${gitA(['ls-files', '--others', '--exclude-standard', '--', ...dirs], root)}`
  } else {
    out = gitA(['ls-tree', '-r', '--name-only', rev, '--', ...dirs], root)
  }
  return [
    ...new Set(
      String(out)
        .split(/\r?\n/)
        .map((s) => s.trim().replace(/\\/g, '/'))
        .filter(Boolean),
    ),
  ]
}

/** 面内的文件内容(一次 cat-file --batch 读满一批,绝不逐文件现场补派生) */
function readTexts(root, rev, rels) {
  const map = new Map()
  const unreadable = []
  if (rels.length === 0) return { map, unreadable }
  if (rev === REV_WORKTREE) {
    for (const p of rels) {
      const t = readWorktreeFile(root, p)
      if (t === null) {
        unreadable.push(p)
        continue
      }
      map.set(p, t)
    }
    return { map, unreadable }
  }
  const specs = rels.map((p) => (rev === REV_INDEX ? `:${p}` : `${rev}:${p}`))
  const got = catBatch(root, specs, { timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER })
  rels.forEach((p, i) => {
    const t = got.get(specs[i])
    if (typeof t !== 'string') {
      unreadable.push(p)
      return
    }
    map.set(p, t)
  })
  return { map, unreadable }
}

/**
 * 一条面上的后端端点集。`legs` 三档:
 *  - `noSources` 面上一个后端源文件都没有 ⇒ 该面确实没有后端(与"取材失效"不同档);
 *  - `emptyWithSources` 有源文件却一个端点都没解析出来 ⇒ 尺子失效(未判定);
 *  - `ok` 正常。
 */
function apiFaceAt(root, rev) {
  const files = listFiles(root, rev, surface.BACKEND_SOURCE_DIRS).filter((p) =>
    surface.isBackendSourceFile(p),
  )
  if (files.length === 0)
    return {
      descriptors: new Map(),
      legs: 'noSources',
      sourceFiles: 0,
      unreadable: [],
      unresolved: 0,
      unreached: 0,
    }
  const { map, unreadable } = readTexts(root, rev, files)
  const reg = extractApiRegistrations(map)
  return {
    descriptors: surface.dedupeDescriptors(surface.descriptorsFromApiEntries(reg.entries)),
    legs: reg.entries.length === 0 ? 'emptyWithSources' : 'ok',
    sourceFiles: map.size,
    unreadable,
    unresolved: reg.undetermined.length + reg.opaque.length,
    unreached: reg.unreached.length,
  }
}

function pageFaceAt(root, rev) {
  const files = listFiles(root, rev, [surface.WEB_APP_DIR]).filter((p) => surface.isWebPageFile(p))
  return {
    descriptors: surface.dedupeDescriptors(surface.descriptorsFromPageRels(files)),
    sourceFiles: files.length,
  }
}

/** 窗口内被改动过的文件清单(暂存/工作树档比的是各自面 vs 窗口起点) */
function changedFiles(root, startRev, face, dirs) {
  const pathspec = dirs.length ? ['--', ...dirs] : []
  let out
  if (face === 'staged') out = gitA(['diff', '--cached', '--name-only', startRev, ...pathspec], root)
  else if (face === 'worktree') out = gitA(['diff', '--name-only', startRev, ...pathspec], root)
  else out = gitA(['diff', '--name-only', startRev, 'HEAD', ...pathspec], root)
  return [
    ...new Set(
      String(out)
        .split(/\r?\n/)
        .map((s) => s.trim().replace(/\\/g, '/'))
        .filter(Boolean),
    ),
  ]
}

/** 被审文档面(取不到 ⇒ 抛 Undetermined,绝不回落另一个面) */
function readDoc(root, rev, docRel) {
  if (rev === REV_WORKTREE) {
    const t = readWorktreeFile(root, docRel)
    if (t === null) throw new Undetermined(`${FACE_LABEL.worktree} 取不到 ${docRel}`)
    return t
  }
  const spec = rev === REV_INDEX ? `:${docRel}` : `${rev}:${docRel}`
  const got = catBatch(root, [spec], { timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER })
  const t = got.get(spec)
  if (typeof t !== 'string')
    throw new Undetermined(`${FACE_LABEL[faceOfRev(rev)]} 取不到 ${docRel}(spec=${spec})`)
  return t
}

/**
 * 主判据:面 + 窗口 + 三态分桶。任何"取不到输入"都抛 `Undetermined`,由调用方折成 exit 2。
 * 纯判据不在本文件(§22c 单源)—— 这里只做取材、做差、归档、点名。
 */
export function analyze(opts = {}) {
  const root = opts.root || ROOT
  const face = opts.face || 'head'
  const horizonDays = Number.isFinite(opts.horizonDays)
    ? opts.horizonDays
    : surface.DEFAULT_HORIZON_DAYS
  const docRel = opts.docRel || surface.DOC_FILE
  const rev = faceToRev(face)
  const out = {
    face,
    docRel,
    horizonDays,
    exit: 0,
    docAnchor: null,
    horizonRev: null,
    start: null,
    startSource: null,
    faceSha: null,
    windowCommits: null,
    docBytes: 0,
    counts: { added: 0, covered: 0, alias: 0, missing: 0, 'in-doc-window': 0, backlog: 0 },
    gaps: [],
    aliases: [],
    coveredSample: [],
    legs: { apiFace: null, apiSources: 0, pageSources: 0 },
    undetermined: [],
    notes: [],
    blindSpots: { files: 0, dirs: [], sample: [] },
    apiUnresolved: 0,
    ratchet: null,
    elapsedMs: 0,
  }
  const t0 = Date.now()
  assertRepoRoot(root, 'check-readme-sync')
  out.faceSha = String(gitA(['rev-parse', 'HEAD'], root)).trim() || null
  if (!out.faceSha) throw new Undetermined('被审面 HEAD 解不出(仓库为空?),不判')

  // ── 被审文档面 ──
  const docText = readDoc(root, rev, docRel)
  out.docBytes = Buffer.byteLength(docText, 'utf8')
  const haystack = docText.toLowerCase()

  // ── 窗口起点 ──
  out.docAnchor = String(gitA(['log', '-1', '--format=%H', '--', docRel], root)).trim() || null
  if (opts.since) {
    const sinceRev = String(opts.since).trim()
    out.start = String(gitA(['rev-parse', '--verify', `${sinceRev}^{commit}`], root)).trim() || null
    if (!out.start) throw new Undetermined(`--since ${sinceRev} 解不出提交对象,不猜窗口`)
    out.startSource = `--since ${sinceRev}(人工钉窗口起点)`
  } else {
    const before = new Date(Date.now() - horizonDays * 86400000).toISOString()
    out.horizonRev =
      String(gitA(['rev-list', '--max-count=1', `--before=${before}`, 'HEAD'], root)).trim() || null
    if (!out.horizonRev)
      out.undetermined.push({
        what: '回看点',
        reason: `仓内没有早于 ${horizonDays} 天的提交 ⇒ 窗口只按文档锚点算;历史欠账这一格本轮判不到,不是"没有"`,
      })
    if (!out.docAnchor && !out.horizonRev)
      throw new Undetermined(`窗口起点两个锚都解不出:${docRel} 无提交历史,回看点也取不到`)
    if (!out.docAnchor)
      out.undetermined.push({
        what: '文档锚点',
        reason: `${docRel} 在被审面上没有提交历史 ⇒ in-doc-window / backlog 两桶无法分档`,
      })
    out.start = surface.pickWindowStart(out.docAnchor, out.horizonRev, (a, b) => {
      try {
        gitA(['merge-base', '--is-ancestor', a, b], root)
        return true
      } catch (e) {
        // git 用退出码 1 表示"不是祖先"(这是正常结论);其余码是"没判成" ⇒ 抛出去,不折成 false
        if (typeof e?.status === 'number' && e.status === 1) return false
        throw e
      }
    })
    if (!out.start) throw new Undetermined('窗口起点判不出(祖先关系不可解),不猜')
    out.startSource =
      out.horizonRev && out.start === out.horizonRev ? `回看点(-${horizonDays}d)` : '文档锚点'
  }
  out.windowCommits = Number(
    String(gitA(['rev-list', '--count', `${out.start}..HEAD`], root)).trim() || '0',
  )

  // ── 窗口起点就是被审面 ⇒ 无区间可审(先于 diff 判,免得把"同一枚提交"报成"0 处改动") ──
  if (out.start === out.faceSha) {
    out.notes.push({
      kind: 'same-face',
      text: `窗口起点(${out.start.slice(0, 8)})与被审面同一枚提交 ⇒ 无区间可审;新增 0 项的依据是"没有区间",不是"区间里没有"`,
    })
    out.elapsedMs = Date.now() - t0
    return out
  }

  // ── 一次全量 diff 同时供"有依据的 0"与盲区点名用 ──
  const allChanged = changedFiles(root, out.start, face, [])
  const capChanged = allChanged.filter((p) => surface.isCapabilitySourceFile(p))
  const blind = surface.blindSpotHits(allChanged)
  out.blindSpots = {
    files: blind.length,
    dirs: [...new Set(blind.map((b) => b.dir))].sort(),
    sample: blind.slice(0, 5).map((b) => b.file),
  }
  if (capChanged.length === 0) {
    out.notes.push({
      kind: 'sound-zero',
      text:
        `窗口内能力源面(${[...surface.BACKEND_SOURCE_DIRS, surface.WEB_APP_DIR].join(' / ')})` +
        `改动 0 个文件(依据 git diff --name-only ${out.start.slice(0, 8)}..${out.faceSha.slice(0, 8)})` +
        ' ⇒ 新增对外能力 0 项。这是**有依据的 0**,不是枚举失效。',
    })
    out.elapsedMs = Date.now() - t0
    return out
  }

  // ── 两条腿:面上与窗口起点上的能力集 ──
  const apiNow = apiFaceAt(root, rev)
  const pageNow = pageFaceAt(root, rev)
  out.legs = {
    apiFace: apiNow.legs,
    apiSources: apiNow.sourceFiles,
    pageSources: pageNow.sourceFiles,
  }
  out.apiUnresolved = apiNow.unresolved
  if ((apiNow.unreadable ?? []).length > 0)
    out.undetermined.push({
      what: '后端源面取材',
      reason: `${apiNow.unreadable.length} 个后端文件在面上取不到内容(未纳入判据,前 3 枚:${apiNow.unreadable.slice(0, 3).join(' ')})`,
    })
  if (apiNow.legs === 'emptyWithSources')
    throw new Undetermined(
      `后端注册面枚举到 0 个端点却有 ${apiNow.sourceFiles} 个源文件 —— 提取式失效(尺子坏了),不记绿`,
    )

  let added
  {
    const apiBase = apiFaceAt(root, out.start)
    const pageBase = pageFaceAt(root, out.start)
    let apiAdded = []
    if (apiNow.legs !== 'noSources' && apiBase.legs === 'noSources')
      out.undetermined.push({
        what: '后端腿基线',
        reason: `窗口起点 ${out.start.slice(0, 8)} 上还没有后端源面 ⇒ "新增"无从做差,后端腿本轮不判(不冒红也不记绿)`,
      })
    else if (apiNow.legs !== 'noSources' && apiBase.legs === 'emptyWithSources')
      out.undetermined.push({
        what: '后端腿基线',
        reason: `窗口起点 ${out.start.slice(0, 8)} 上一个端点都没解析出来 ⇒ 做差会把全仓读成新增,后端腿本轮不判`,
      })
    else if (apiNow.legs !== 'noSources')
      apiAdded = surface.addedDescriptors(apiNow.descriptors, apiBase.descriptors)
    const pageAdded = surface.addedDescriptors(pageNow.descriptors, pageBase.descriptors)
    added = [...apiAdded, ...pageAdded]
  }

  out.counts.added = added.length
  const buckets = surface.bucketDescriptors(added, haystack)
  out.counts.covered = buckets.covered.length
  out.counts.alias = buckets.alias.length
  out.counts.missing = buckets.missing.length
  out.coveredSample = buckets.covered.slice(0, 5).map((d) => ({ id: d.id, evidence: d.evidence }))
  out.aliases = buckets.alias.map((d) => ({ id: d.id, file: d.file, evidence: d.evidence }))
  out.gaps = buckets.missing.map((d) => ({ id: d.id, file: d.file, line: d.line, evidence: d.evidence }))

  // ── 违规按"文档锚点之后 / 之前"分档(升档前置要用这一维) ──
  if (out.docAnchor) {
    const changedSinceDoc = new Set(changedFiles(root, out.docAnchor, face, []))
    const split = surface.splitByDocAnchor(out.gaps, [...changedSinceDoc])
    for (const d of split.inDocWindow) d.bucket = 'in-doc-window'
    for (const d of split.backlog) d.bucket = 'backlog'
    out.counts['in-doc-window'] = split.inDocWindow.length
    out.counts.backlog = split.backlog.length
  } else {
    for (const d of out.gaps) d.bucket = 'backlog(无文档锚点,分不出档)'
    out.counts.backlog = out.gaps.length
  }

  if (out.apiUnresolved > 0)
    out.notes.push({
      kind: 'api-unresolved',
      text: `后端注册面另有 ${out.apiUnresolved} 处路径模板/不透明前缀解析不出(唯一提取式自带的未判定桶,逐条报名归守门 8),本门只报数`,
    })

  // ── 棘轮:存量只减不增(§0.5)。基线件读不懂 ⇒ 未判定,不静默放宽 ──
  const bl = loadBaseline(root)
  if (bl.error) throw new Undetermined(`${bl.rel} ${bl.error}`)
  out.ratchet = {
    rel: bl.rel,
    present: bl.present,
    baseline: bl.present ? bl.missing : null,
    now: out.counts.missing,
    delta: bl.present ? out.counts.missing - bl.missing : null,
  }
  out.exit = decideExit(out, { strict: opts.strict === true, baseline: bl.present ? bl : null })
  out.elapsedMs = Date.now() - t0
  return out
}

/**
 * 读棘轮基线(§0.5)。
 * 三态:present=false 且无 error ⇒ 基线件不存在,退回旧语义;**有 error ⇒ 未判定**,
 * 绝不因为读不懂就当没有基线放过(§0.3「没判绝不写成判过」)。
 */
export function loadBaseline(root) {
  const p = join(root, BASELINE_REL)
  let src
  try {
    src = readFileSync(p, 'utf8')
  } catch (e) {
    if (e && e.code === 'ENOENT') return { present: false, rel: BASELINE_REL }
    return { present: false, rel: BASELINE_REL, error: `基线件读不到(${e?.message ?? e})` }
  }
  let j
  try {
    j = JSON.parse(src)
  } catch (e) {
    return { present: false, rel: BASELINE_REL, error: `基线件不是合法 JSON(${e.message})` }
  }
  const n = Number(j?.missing)
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n))
    return {
      present: false,
      rel: BASELINE_REL,
      error: `基线件的 missing 不是非负整数(实得 ${JSON.stringify(j?.missing)})`,
    }
  return { present: true, rel: BASELINE_REL, missing: n, reason: String(j?.reason ?? '') }
}

/**
 * 出口档位:
 *  - 无基线(旧语义):判出未描述缺口 ⇒ 1;无缺口 ⇒ 0(未判定/别称只点名,不顶红 —— §12e 不造恒红门);
 *  - 有基线(§0.5 差值棘轮):**现测 > 额度** ⇒ 1;现测 ≤ 额度 ⇒ 不因存量判红(存量只报数);
 *  - `--strict`:未判定与别称桶也计入非零 —— 不许"靠未判定躲过去"。
 */
export function decideExit(out, { strict = false, baseline = null } = {}) {
  const missing = out.counts.missing
  if (baseline && Number.isFinite(baseline.missing)) {
    if (missing > baseline.missing) return 1
  } else if (missing > 0) return 1
  if (strict && (out.counts.alias > 0 || out.undetermined.length > 0)) return 1
  return 0
}

function short(s) {
  return String(s ?? '').slice(0, 8)
}

function printReport(out, { strict } = {}) {
  console.log(
    `[readme-sync] 面:${FACE_LABEL[out.face]} · 被审文档 ${out.docRel}(${out.docBytes} B)` +
      ` · 文档锚点 ${short(out.docAnchor) || '—'} · 回看点 ${short(out.horizonRev) || '—'}(-${out.horizonDays}d)` +
      ` · 窗口起点 ${short(out.start)}(${out.startSource}) · 窗口内 ${out.windowCommits} 枚提交`,
  )
  for (const n of out.notes) console.log(`[readme-sync] ℹ️  ${n.text}`)
  console.log(
    `[readme-sync] 新增对外能力 ${out.counts.added} 项` +
      ` · 已覆盖 ${out.counts.covered} · 未判定(别称/写法不同)${out.counts.alias} · 未描述 ${out.counts.missing}` +
      ` · 源面:后端 ${out.legs.apiSources} 文件(${out.legs.apiFace ?? '—'})/ web 页面 ${out.legs.pageSources}`,
  )
  const r = out.ratchet
  const overBudget = !!(r && r.present && Number.isFinite(r.baseline) && r.now > r.baseline)
  if (r && r.present) {
    console.log(
      `[readme-sync] 棘轮(§0.5):基线 ${r.baseline} / 现测 ${r.now} / 差 ${r.delta > 0 ? '+' : ''}${r.delta}` +
        (overBudget
          ? ` —— ❌ 超出额度 ${r.delta} 枚(存量只减不增,新增必须同 commit 补 README)`
          : r.delta < 0
            ? ` —— ✅ 存量下降 ${-r.delta} 枚,可跑 --update-baseline 下调额度(只许降,抬不动)`
            : ' —— ✅ 存量与基线齐平(只减不增)'),
    )
  } else {
    console.log(
      `[readme-sync] 棘轮(§0.5):基线件 ${r?.rel ?? BASELINE_REL} 不存在 ⇒ 退回旧语义(未描述 > 0 即判 1)`,
    )
  }
  console.log(
    `[readme-sync] 档位:warn(§12e)· 分桶 in-doc-window ${out.counts['in-doc-window']} / 存量 ${out.counts.backlog}` +
      ' —— 升 blocking 的前置 = 棘轮额度归零(逐批真补描述,不是改基线)',
  )
  const mark = overBudget ? '❌' : '⚠️'
  if (out.gaps.length) {
    const newest = out.gaps.filter((g) => g.bucket === 'in-doc-window')
    if (newest.length)
      console.log(
        `${mark} [readme-sync] 其中「文档锚点之后新增」${newest.length} 枚(这一截才是 §21 说的"同 commit 更新";存量另列):`,
      )
    for (const g of newest.slice(0, 10)) console.log(`   ★ ${g.id}  ← ${g.file}`)
    const shown = out.gaps.slice(0, 20)
    console.log(
      `${mark} [readme-sync] ${overBudget ? '未描述' : '登记的存量未描述'}(AGENTS.md §21 要求进 ${out.docRel}),共 ${out.gaps.length} 枚` +
        (overBudget ? ':' : ' —— 在棘轮额度内,本轮不判红,只报数:'),
    )
    for (const g of shown)
      console.log(`   - ${g.id}  ← ${g.file}${g.line ? `:${g.line}` : ''}(找过的身份:${g.evidence})`)
    if (out.gaps.length > shown.length)
      console.log(`   … 另有 ${out.gaps.length - shown.length} 枚,用 --json 逐条取全`)
    console.log('   清存量出路(warn 档不拦提交;补描述才算清账):')
    console.log('     ① node scripts/check-readme-sync.mjs --json')
    console.log(
      `     ② 按 gaps[] 在 ${out.docRel} 对应能力段写入路径身份(如 /api/goods/select、/domains/ai)`,
    )
    console.log('     ③ node scripts/check-readme-sync.mjs   # 末行须现读"未描述 0"')
  }
  if (out.aliases.length) {
    console.log(
      `⚠️  [readme-sync] 未判定(只报数不判红,§0.3):${out.aliases.length} 枚只找得到多段尾巴,可能是改名/别称:`,
    )
    for (const a of out.aliases.slice(0, 20))
      console.log(`   - ${a.id}  ← ${a.file}(命中的尾巴:${a.evidence})`)
    if (out.aliases.length > 20) console.log(`   … 另有 ${out.aliases.length - 20} 枚,用 --json 逐条取全`)
    if (!strict) console.log('   (要逼这一格也交待人:--strict 把未判定计入非零出口)')
  }
  for (const u of out.undetermined) console.log(`❌ [readme-sync] 未判定:${u.what} —— ${u.reason}`)
  if (out.blindSpots.files > 0)
    console.log(
      `⚠️  [readme-sync] 盲区(本门不判,§0.6 不另立第二份提取式):窗口内动了 ${out.blindSpots.files} 个端页面源文件,涉及 ${out.blindSpots.dirs.join(' / ')}`,
    )
  console.log(
    `[readme-sync] 末行现读:面=${out.face} 新增=${out.counts.added} 已覆盖=${out.counts.covered}` +
      ` 未判定=${out.counts.alias} 未描述=${out.counts.missing}` +
      ` 棘轮=${out.ratchet?.present ? out.ratchet.baseline : '—'}` +
      ` 尺子未判定=${out.undetermined.length}` +
      ` exit=${out.exit} 耗时=${out.elapsedMs}ms`,
  )
}

/* ─────────────────────────── 构造夹具(--self-test 与镜像测试共用) ─────────────────────────── */

export const FIXTURES = {
  readmeCovered: [
    '# IHUI-AI',
    '能力:商品可选列表走 `/api/goods/select`,报名记录走 `/api/sign-ups`。',
    '域页:`/domains/ai` 与 `/domains/personal` 是两处功能门户入口。',
  ].join('\n'),
  readmeAlias: '# IHUI-AI\n\n管理端接口写作 `admin/relay/model-catalog`(不带 /api 前缀的旧写法)。\n',
  readmeBlank: '# IHUI-AI\n\n只讲部署,一条能力路径都没写。\n',
  readmeFamilyPrefix: '# IHUI-AI\n\n广场能力见 `/api/plaza`。\n',
}

/** 纯判据自检:构造输入、零 git、零写盘(端到端三态在镜像测试里打 analyze) */
function selfTest() {
  const { t, report } = makeRegistrar()
  const hay = FIXTURES.readmeCovered.toLowerCase()

  t('①页面身份:剥 (group) 段、只认 page.tsx', () =>
    surface.pageToken('apps/web/app/(main)/domains/ai/page.tsx') === 'domains/ai')
  t('②页面身份:非 page.tsx 不认', () =>
    surface.pageToken('apps/web/app/(main)/domains/ai/layout.tsx') === null)
  t('③页面身份:根页无可匹配身份 ⇒ null(不冒充能力)', () =>
    surface.pageToken('apps/web/app/page.tsx') === null)
  t('④后端源面判据:apps/api/src/*.ts 算、apps/api/docs/*.md 不算', () =>
    surface.isBackendSourceFile('apps/api/src/routes/goods.ts') === true &&
      surface.isBackendSourceFile('apps/api/docs/readme.md') === false)
  t('⑤口径单源:BACKEND_SOURCE_DIRS 与 outbound 的 SCAN_DIRS 是同一个数组对象(没抄第二份)', () =>
    surface.BACKEND_SOURCE_DIRS === SCAN_DIRS)
  t('⑥静态前缀:剥尾部动态段', () => surface.staticPrefix('api/plaza/:id') === 'api/plaza')
  t('⑦别名尾巴:至少两段(单段词 select/settings 不构成别称凭据)', () =>
    surface.aliasTails('api/goods/select').join('|') === 'goods/select' &&
      surface.aliasTails('api/points').length === 0)
  t('⑧别名尾巴:首段动态的尾巴被排除', () =>
    surface.aliasTails('api/notifications/:id/archive').every((x) => !x.startsWith(':')))
  t('⑨身份边界:health 不命中 healthcare(阴性对照)', () =>
    surface.containsToken('a healthcare system', 'health') === false)
  t('⑩身份边界:/api/points/records 命中资源族前缀 api/points(阳性对照,防恒绿)', () =>
    surface.containsToken('走 `/api/points/records`', 'api/points') === true)
  t('⑪三态 covered:完整身份在面上', () =>
    surface.classifyDescriptor({ primary: 'api/goods/select' }, hay).state === 'covered')
  t('⑫三态 missing:面上一个字都没有(阳性对照 —— 器物真能看见缺口)', () =>
    surface.classifyDescriptor({ primary: 'api/goods/select' }, FIXTURES.readmeBlank.toLowerCase())
      .state === 'missing')
  t('⑬三态 alias:只命中多段尾巴 ⇒ 交人工判,不冒红', () =>
    surface.classifyDescriptor(
      { primary: 'api/admin/relay/model-catalog' },
      FIXTURES.readmeAlias.toLowerCase(),
    ).state === 'alias')
  t('⑭三态 covered:资源族前缀算提到(`/api/plaza` 覆盖 `/api/plaza/:id`)', () =>
    surface.classifyDescriptor(
      { primary: 'api/plaza/:id' },
      FIXTURES.readmeFamilyPrefix.toLowerCase(),
    ).state === 'covered')
  t('⑮{param} 与 :param 混写算同一格', () =>
    surface.classifyDescriptor({ primary: 'api/x/:id/y' }, 'X `/api/x/{id}/y`'.toLowerCase()).state ===
      'covered')
  t('⑯做差只算新增:基线有、面上删掉的条目不进射程', () => {
    const now = surface.dedupeDescriptors([{ kind: 'api', id: 'GET /a', primary: 'a', file: 'f' }])
    const base = surface.dedupeDescriptors([
      { kind: 'api', id: 'GET /a', primary: 'a', file: 'f' },
      { kind: 'api', id: 'GET /b', primary: 'b', file: 'f' },
    ])
    return surface.addedDescriptors(now, base).length === 0
  })
  t('⑯b 做差真能看见新增:面上多出来一枚 ⇒ 恰好多一枚', () => {
    const now = surface.dedupeDescriptors([
      { kind: 'api', id: 'GET /a', primary: 'a', file: 'f' },
      { kind: 'api', id: 'GET /c', primary: 'c', file: 'g' },
    ])
    const base = surface.dedupeDescriptors([{ kind: 'api', id: 'GET /a', primary: 'a', file: 'f' }])
    return surface.addedDescriptors(now, base).map((d) => d.id).join(',') === 'GET /c'
  })
  t('⑰窗口取更旧者:文档刚被提交 ⇒ 回看点兜住历史欠账', () =>
    surface.pickWindowStart('D', 'H', (a, b) => a === 'H' && b === 'D') === 'H')
  t('⑱窗口取更旧者:文档很久没动 ⇒ 锚点把窗口拉长', () =>
    surface.pickWindowStart('D', 'H', (a, b) => a === 'D' && b === 'H') === 'D')
  t('⑲祖先关系判不出 ⇒ null(不猜窗口,门侧落未判定)', () =>
    surface.pickWindowStart('D', 'H', () => {
      throw new Error('git 不可用')
    }) === null)
  t('⑳存量归因单向保守:文件自锚点没动 ⇒ 铁存量;动过 ⇒ 计入 in-doc-window', () => {
    const gaps = [
      { id: 'GET /a', file: 'apps/api/src/routes/a.ts' },
      { id: 'GET /b', file: 'apps/api/src/routes/b.ts' },
    ]
    const s = surface.splitByDocAnchor(gaps, ['apps/api/src/routes/b.ts'])
    return (
      s.backlog.map((g) => g.id).join() === 'GET /a' &&
      s.inDocWindow.map((g) => g.id).join() === 'GET /b'
    )
  })
  t('㉑盲区点名:已判面不算盲区', () => {
    const hits = surface.blindSpotHits([
      'apps/api/src/routes/a.ts',
      'apps/miniapp-taro/src/pages/x/index.tsx',
      'docs/foo.md',
    ])
    return hits.length === 1 && hits[0].dir === 'apps/miniapp-taro/src'
  })
  t('㉒出口档位:只有未描述缺口 ⇒ 1;未判定不顶红;--strict 才逼未判定', () => {
    const mk = (missing, alias, und) => ({
      counts: { missing, alias },
      undetermined: new Array(und).fill({}),
    })
    return (
      decideExit(mk(3, 2, 1)) === 1 &&
      decideExit(mk(0, 2, 1)) === 0 &&
      decideExit(mk(0, 2, 0), { strict: true }) === 1 &&
      decideExit(mk(0, 0, 0), { strict: true }) === 0
    )
  })
  t('㉓默认回看天数 7(定档出处见判据层头注的实测)', () => surface.DEFAULT_HORIZON_DAYS === 7)
  t('㉔形状锁:后端端点走守门 8 的唯一提取式,门体不自建第二份', () => {
    const src = gateSource()
    return (
      src.includes("from './lib/route-registration-extract.mjs'") &&
        src.includes('extractApiRegistrations(') &&
        !/server\.(get|post|put|patch|delete)\s*\(/.test(src)
    )
  })
  t('㉕形状锁:取材一律经 face-reader(半接线会被门 118 判红)', () => {
    const src = gateSource()
    return (
      src.includes("from './lib/face-reader.mjs'") &&
        src.includes('catBatch(') &&
        src.includes('gitRaw(') &&
        !/execSync\(/.test(src)
    )
  })
  t('㉖形状锁:两面旗同用当场判死,不回落另一个面', () => {
    const sel = selectFace({ staged: true, worktree: true })
    return typeof sel.error === 'string' && sel.error.includes('不得同用')
  })
  t('㉗参数锁:--since 不给值 ⇒ 报错而非静默用默认', () => {
    const a = parseArgs(['--since'])
    return typeof a.sinceError === 'string' && a.sinceError.includes('--since')
  })
  t('㉘参数锁:未知旗标点名,不静默吞', () =>
    parseArgs(['--turbo-mode']).unknown.join(' ') === '--turbo-mode')
  t('㉙棘轮(§0.5):现测 ≤ 额度 ⇒ 存量不顶红;超出额度 ⇒ 判红,且差值可点名', () => {
    const mk = (missing) => ({ counts: { missing, alias: 0 }, undetermined: [] })
    const bl = { missing: 5 }
    return (
      decideExit(mk(5), { baseline: bl }) === 0 &&
      decideExit(mk(4), { baseline: bl }) === 0 &&
      decideExit(mk(6), { baseline: bl }) === 1 &&
      // 无基线时必须退回旧语义,不得因"没读到基线"就静默放宽
      decideExit(mk(6)) === 1 &&
      decideExit(mk(0)) === 0
    )
  })
  t('㉚棘轮读不到/读不懂一律未判定,不静默当"没有基线"', () => {
    const dir = mkdtempSync(join(tmpdir(), 'readme-sync-bl-'))
    try {
      // 不存在 ⇒ present:false 且无 error(旧语义,合法)
      const absent = loadBaseline(dir)
      if (!(absent.present === false && !absent.error)) return false
      // 坏 JSON ⇒ 必须带 error(门侧据此 exit 2)
      mkdirSync(join(dir, 'scripts'), { recursive: true })
      writeFileSync(join(dir, BASELINE_REL), '{ "missing": ', 'utf8')
      const broken = loadBaseline(dir)
      if (!(broken.present === false && typeof broken.error === 'string')) return false
      // missing 不是非负整数 ⇒ 同样必须带 error
      writeFileSync(join(dir, BASELINE_REL), '{"missing": -3}', 'utf8')
      const neg = loadBaseline(dir)
      if (!(neg.present === false && typeof neg.error === 'string')) return false
      // 正常 ⇒ present:true 且额度读得到
      writeFileSync(join(dir, BASELINE_REL), '{"missing": 125}', 'utf8')
      const ok = loadBaseline(dir)
      return ok.present === true && ok.missing === 125
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  const r = report()
  for (const c of r.cases)
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.pass ? '' : ` —— got: ${c.got}`}`)
  console.log(`--self-test: ${r.pass} 通过 / ${r.fail} 失败`)
  return r.fail ? 1 : 0
}

const GATE_SOURCE = { v: null }
function gateSource() {
  if (GATE_SOURCE.v === null) GATE_SOURCE.v = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  return GATE_SOURCE.v
}

/* ───────────────────────────────── CLI ───────────────────────────────── */

export function parseArgs(argv) {
  const horizon = requireFlagValue(argv, '--horizon-days', { noun: '天数(正数)' })
  const since = requireFlagValue(argv, '--since', { noun: '提交/引用' })
  const root = requireFlagValue(argv, '--root', { noun: '目录' })
  return {
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    json: argv.includes('--json'),
    strict: argv.includes('--strict'),
    selfTest: argv.includes('--self-test'),
    updateBaseline: argv.includes('--update-baseline'),
    help: argv.includes('--help'),
    horizonDays: horizon.value === null ? undefined : Number(horizon.value),
    horizonError: horizon.error,
    since: since.value,
    sinceError: since.error,
    root: root.value,
    rootError: root.error,
    unknown: argv.filter((x) => x.startsWith('--') && !KNOWN_FLAGS.has(x.split('=')[0])),
  }
}

function main() {
  const argv = process.argv.slice(2)
  const a = parseArgs(argv)
  if (a.help) {
    console.log(
      '用法:node scripts/check-readme-sync.mjs [--staged|--worktree|--json|--strict|--self-test|--horizon-days <n>|--since <rev>|--root <dir>]',
    )
    return 0
  }
  if (a.selfTest) return selfTest()
  const paramError = a.unknown.length
    ? `未知旗标:${a.unknown.join(' ')}(全部旗标见 --help)`
    : a.horizonError || a.sinceError || a.rootError || null
  if (paramError) {
    console.error(`❌ [readme-sync] 参数不成立:${paramError}`)
    return 2
  }
  const sel = selectFace({ staged: a.staged, worktree: a.worktree })
  if (sel.error) {
    console.error(`❌ [readme-sync] 未判定:${sel.error}`)
    return 2
  }
  if (a.horizonDays !== undefined && (!Number.isFinite(a.horizonDays) || a.horizonDays <= 0)) {
    console.error(`❌ [readme-sync] 参数不成立:--horizon-days 必须是正数(实得 ${a.horizonDays})`)
    return 2
  }
  let out
  try {
    out = analyze({
      root: a.root ? resolve(a.root) : ROOT,
      face: sel.face,
      horizonDays: a.horizonDays,
      since: a.since,
      strict: a.strict,
    })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ [readme-sync] 无法判定(既不记绿也不冒红):${e.message}`)
      return 2
    }
    throw e
  }
  if (a.updateBaseline) return updateBaseline(a.root ? resolve(a.root) : ROOT, sel.face, out)
  if (a.json) console.log(JSON.stringify(out, null, 2))
  else printReport(out, { strict: a.strict })
  return out.exit
}

/** 本地日期(YYYY-MM-DD)。基线件里记的是"人哪天立的账",用 UTC 会在东八区深夜差一天。 */
function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 下调棘轮额度(§0.5)。**只许降,抬不动** —— 抬它就是 §12e「把新增写进基线消红」。
 * 额度未变 ⇒ 不动文件、exit 0;要抬 ⇒ 拒绝并 exit 2,并把"该补的是 README 不是基线"说清楚。
 * 只对全量档(head 面)生效:索引面/工作树面是过程态,拿它当锚点会把别人的半编辑钉成额度。
 */
function updateBaseline(root, face, out) {
  if (face !== 'head') {
    console.error(`❌ [readme-sync] --update-baseline 只认全量档(head 面),当前面=${face}`)
    return 2
  }
  const bl = loadBaseline(root)
  if (bl.error) {
    console.error(`❌ [readme-sync] 未判定:${bl.rel} ${bl.error}`)
    return 2
  }
  const now = out.counts.missing
  const prev = bl.present ? bl.missing : null
  if (prev !== null && now > prev) {
    console.error(
      `❌ [readme-sync] 拒绝上调额度:基线 ${prev} / 现测 ${now}(+${now - prev})。` +
        '新增未描述只能靠补 README 消,不得写进基线(§12e 修红不得顺手削判据)。',
    )
    return 2
  }
  if (prev === now) {
    console.log(`[readme-sync] 额度已是 ${now} 枚,无需改动。`)
    return 0
  }
  const payload = {
    version: 1,
    anchor: '该门全量档(HEAD 面 / 默认 7 天窗口)的未描述数:只减不增;现测超出即判红,存量只报数',
    reason:
      bl.reason ||
      '2026-10-27 立棘轮时的存量:这些端点在写下起就没有人对着 README 对过账,是历史欠账;' +
        '本条只把它们钉成"不许再涨"的额度。清账出路 = 逐批在 README 对应能力段补路径身份,' +
        '每清一批跑一次 --update-baseline 把额度压下去,归零后才谈升 blocking(§12e)。',
    recordedAt: localDate(),
    missing: now,
    prevMissing: prev,
  }
  writeFileSync(join(root, BASELINE_REL), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`✅ [readme-sync] 额度已下调:${prev ?? '(新建)'} → ${now} 枚(${BASELINE_REL})`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ [readme-sync] 脚本自身异常(按未判定处理):${e?.message ?? e}`)
    console.error(e?.stack ?? '(no stack)')
    process.exit(2)
  }
}

// §22c:判据真相只在门体/判据层一份,镜像测试从这里直连,不得在测试里重抄
export const __test__ = {
  analyze,
  decideExit,
  loadBaseline,
  BASELINE_REL,
  parseArgs,
  selfTest,
  faceToRev,
  listFiles,
  readTexts,
  apiFaceAt,
  pageFaceAt,
  changedFiles,
  FIXTURES,
  ROOT,
  REV_INDEX,
  REV_WORKTREE,
  surface,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
