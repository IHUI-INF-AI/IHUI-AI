#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
 * Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
 *
 * scripts/provenance-ledger.mjs —— 第三方 / 嵌入 / 复制代码「来源台账」判据
 *
 * 它把「每一份进过仓的外部内容是谁、什么许可、原文在哪、hash 多少」从散文声明
 * (根目录 LICENSE + NOTICE)变成机器可判的事实,并回答那个此前无人能答的问题:
 * **本次改动有没有新增一个没有来源登记的东西?**
 *
 * 四本账(都在 config/third-party-provenance/ 下,同一次读取、同一取材面):
 *   embedded.json  ① 打进产物的第三方组件(vendored crate 等)+ 本仓自著声明文件清单
 *   copied.json    ② 复制进仓库的源码 / 素材
 *   overrides.json ③ 被 pnpm override 换掉来源的依赖
 *   mechanisms.json 机制来源账(只吸收思想、不带走代码的那类,须带 clean-room 声明)
 *
 * 判据(编号沿用规格 §6 的 P1–P4,并按本仓既有守门口径补 P5–P7):
 *   L0 台账自身可 parse、必填字段齐、id 全局唯一
 *   P1 每条 roots 必须存在于**被审判的同一取材面**(登记了而实物没了 → 红)
 *   P2 反向:盘上任何 vendored 目录 / 带第三方版权或 SPDX 头的跟踪文件必须有对应条目。
 *      **这条是本门独有价值,纯清单校验做不到。**
 *   P3 许可原文按内容寻址自证:inRepo 形态实算该面 blob 的 sha256 与 byteLength 比对;
 *      text 形态对内联字符串实算比对;externalOnly 形态计入「待补登记」不判红但如实报数。
 *      全程不联网。
 *   P4 revision 不可考必须显式 null + gitRevisionNote;禁止空串、禁止猜日期
 *   P5 机制账:landsOn 每个路径必须真实存在,cleanRoom 声明与规格文件必须齐
 *   P6 自著声明清单(embedded.json 顶层 ownLicenseDeclarations)必须属实:路径存在,
 *      且文件名只能是 LICENSE/NOTICE/COPYING 一族 —— 防它被当成万能豁免表藏源码
 *   P7 覆盖账与 pnpm-workspace.yaml 双向对账:登记的说谎 → 红;yaml 换了来源而没登记 → 红
 *   P8 归属反噬:凡登记条目 roots 命中的真实文件,内容里**不得**出现我方水印横幅签名串或
 *      零宽载荷 ⇒ 判红(那等于把 Mozilla/Cargo 分发的作品声明成本仓所有)。与 P1–P7 方向相反:
 *      P2 防"拿了没登记",P8 防"登记了却盖了我们的章"。水印层(scripts/watermark.mjs)自
 *      2026-09-25 起按同一份 roots 把这些文件移出分母,P8 就是接住它们的那一层。
 *
 * 取材口径(与守门 70/77/83/98/101/103 同取向):
 *   全量判 **HEAD blob**,`--staged` 判**索引 blob**,`--worktree` 仅人工排查逃生舱。
 *   共享工作区常年滞后 HEAD,按磁盘判会在恒红/假绿之间来回跳。
 *   取不到输入一律 **exit 2「无法判定」** —— 绝不冒烟成判据红,也绝不静默记绿。
 *
 * `--staged` 的棘轮:P2 的候选只判「相对 HEAD 新出现的」,存量只报数。
 *   否则一枚与此无关的提交会被别人欠的债钉红,结局就是 `--no-verify`,连带全部守门作废。
 *
 * 为什么不新增许可原文文件(规格 §6 建议的「内容寻址许可原文库」形态)——实测冲突证据已
 * 写进 embedded.json 的 _watermarkConflictNote,摘要:watermark.mjs 的 EXT_MAP 收录 .toml/.rs
 * 等,而 vendor/** 目前只因 SKIP_DIRS 里那一条 'vendor'(watermark.mjs:172)才没被注入横幅;
 * 把原文另存成受水印管辖的文件 = 给 Apache-2.0/MIT 原文加横幅 = 改动许可原文格式。
 *
 * CLI:
 *   node scripts/provenance-ledger.mjs [--check] [--staged|--worktree] [--root <dir>]
 *   node scripts/provenance-ledger.mjs --report      # 人读盘点(条目数 / 待补登记 / 候选面)
 *   node scripts/provenance-ledger.mjs --self-test   # 真临时 git 仓取证
 * 退出码:0 通过 / 1 判据违规 / 2 无法判定 / 129 用法错(未知开关不得静默掉进默认档)
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// P8 与水印排除面共用同一个「roots → 真实文件」展开实现:两侧必须问同一件事,
// 否则"被免除横幅的文件"与"被审计归属反噬的文件"会不是同一批 —— 那正是空档。
import {
  LEDGER_DIR as THIRD_PARTY_LEDGER_DIR,
  LEDGER_FILES as THIRD_PARTY_LEDGER_FILES,
  expandRootsToFiles,
} from './lib/third-party-roots.mjs'

const SELF = fileURLToPath(import.meta.url)
const DEFAULT_ROOT = resolve(dirname(SELF), '..')
const GIT = 'git'
const GIT_TIMEOUT_MS = 30000

/**
 * 台账目录与四本账 —— 由 scripts/lib/third-party-roots.mjs 单点持有,本文件不再自持一份:
 * 水印排除面(watermark.mjs / check-watermark-coverage.mjs)与台账判据读的必须是**同一张表**,
 * 否则"排除了但没审计"或"审计了但仍在打横幅"两种空档都会出现(P8 与排除面共用
 * `expandRootsToFiles` 正是为此)。值与改动前逐字相同,故 `__test__.LEDGER_*` 的既有消费方不受影响。
 */
const LEDGER_DIR = THIRD_PARTY_LEDGER_DIR
const LEDGER_FILES = THIRD_PARTY_LEDGER_FILES

const MECHANISM_KIND = 'mechanism'
const TEXTS_PER_ENTRY_REQUIRED_KINDS = ['embedded', 'copied', 'override']

/**
 * 归属声明窗口:第三方文件的许可头实测落在第 1–9 行(逐文件量过:tray-icon lib.rs=1、
 * gradlew.bat=2、gradlew=4、pdf.worker.min.mjs=9),而全仓唯一一处"正文里提到第三方许可"
 * 是本仓自著脚本 scripts/gen-taro-lucide-icons.mjs:51 的**模板字符串**(它把
 * '<!-- @license lucide-static v1.31.0 - ISC -->' 写进生成产物,是归属的**载体**而非进件)。
 * 故判据只看前 12 行:超出即不当作该文件的许可头(面外如实写在下方注释)。
 */
const NOTICE_HEADER_WINDOW_LINES = 12
/** 承载第三方来源的目录名形态(P2/V1)。 */
const VENDOR_DIR_RE = /^(vendor|third[-_]?party|thirdparty|3rd[-_]?party|external)$/i
/** 一条「归属声明行」的形态:版权 + 年份、SPDX 标识符、或 @license 注释头。 */
const NOTICE_LINE_RE =
  /(?:copyright|\(c\)|©)\s*(?:\(c\)\s*)?(?:\d{4}|\[yyyy)|spdx-license-identifier:|@license/i
/** 本仓水印横幅 / 自著声明里必然出现的标记 —— 逐行剔除后才看是否还剩第三方归属。 */
const OWN_TOKENS = [
  'ihui ai',
  'li chunchuan',
  '李春川',
  'aizhs.top',
  'provenance-watermarked',
  '[ihui-ai-provenance]',
  '智汇ai',
]
/**
 * P8 用的「我方归属主张」形态。三条通道任一命中即算:
 *   (a) 横幅的**结构串** —— `provenance-watermarked` / `[ihui-ai-provenance]` 只可能出自我方
 *       水印工具;品牌名 / 域名 / 人名单独出现**不算**(第三方正文合法提及本仓,不等于
 *       "我们主张拥有这个文件"),所以本条刻意不直接套 use 整个 OWN_TOKENS;
 *   (b) 可见版权行的规范式 `© <年份> IHUI AI (智汇AI)` —— 归属主张本体,连"裸两行头、
 *       载荷已被剥掉"的残迹态也认得;**只在行首锚定时算**(见 OWN_COPYRIGHT_RE 处的假阳记录),
 *       否则我们自己清单里的 author / copyright 字段会被当成往别人文件上盖了章;
 *   (c) 零宽载荷的哨兵包络(U+2060 包一串 Cf 字符)—— L3 尾行没有可见文本,只有这个。
 * (a) 的两项必须是 OWN_TOKENS 的成员,由 --self-test 的 11d 钉死:两处各写一份字面量而无人
 * 对账,正是本仓最高频的失守形态;漂移时自检变红,而不是让 P8 悄悄看不见某一种横幅。
 */
const OWN_BANNER_STRUCT_TOKENS = ['provenance-watermarked', '[ihui-ai-provenance]']
/**
 * 可见版权行必须**行首锚定**成横幅形状(剥掉注释前缀后以 `© <年份> IHUI AI (智汇AI)` 开头)。
 * 不锚定的第一版把 `apps/web/package.json` 的
 *   "copyright": "© 2026 IHUI AI (智汇AI) · 李春川 · All rights reserved."
 * 判成了「归属反噬」并当场红 —— 那是**我们自己清单里的作者字段**,不是往别人文件上打的章。
 * 这条存量红是 P8 自己产出的假阳,不是被判据挖出来的真事故,故修判据而不是加豁免。
 * 锚定形状与 scripts/watermark.mjs 的 isBannerLine 同取向(剥前缀 + 行首匹配),
 * 覆盖行注释(`// © …`)、块注释正文(`  © …`)与 HTML 注释正文三种版式。
 */
const OWN_COPYRIGHT_RE = /^\s*(?:(?:\/\/|--|#|\*|\/\*|<!--)\s*)?©\s*\d{4}\s+IHUI\s+AI\s*\(智汇AI\)/m
const ZW_PAYLOAD_RE = /\u2060[\u200b\u200c\u200d]{4,}\u2060/

/** 一个文件里是否存在「我方归属主张」的任一形态(P8)。二进制内容按无归属主张处理。 */
function carriesOurAttribution(buf) {
  if (!buf || buf.includes(0)) return null
  const text = buf.toString('utf8')
  const low = text.toLowerCase()
  const struct = OWN_BANNER_STRUCT_TOKENS.find((t) => low.includes(t))
  if (struct) return `横幅结构串 "${struct}"`
  const cr = OWN_COPYRIGHT_RE.exec(text)
  if (cr) return `可见版权行 "${cr[0].slice(0, 40)}"`
  if (ZW_PAYLOAD_RE.test(text)) return '零宽溯源载荷'
  return null
}

/** git grep 的 ASCII 候选模式(只筛候选,归属判定仍由 NOTICE_LINE_RE 逐行做)。 */
const GREP_PATTERNS = [
  'Copyright (\\(c\\) )?.{0,4}[0-9]{4}',
  'SPDX-License-Identifier:',
  '@license',
]
/** 扫描面 = 仓库里可能携带第三方内容的顶层区域(与既有守门同取向:面外写进断言,不假装看过)。 */
const SCAN_PATHS = [
  'apps',
  'packages',
  'scripts',
  'config',
  'docs',
  'deploy',
  'monitoring',
  'sdks',
  'LICENSE',
  'NOTICE',
]
const SHA256_RE = /^[0-9a-f]{64}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const SOURCE_CHANGING_RE = /^(npm:|git\+|git:|file:|link:|catalog:)/
const FACES = ['head', 'staged', 'worktree']

/** 台账判定的「无法判定」——一律收敛到 exit 2,不得冒红也不得记绿。 */
class Undetermined extends Error {}

function gitRun(root, args, { encoding = 'utf8', allowFail = false } = {}) {
  try {
    return execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
      cwd: root,
      encoding,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      // stderr 一律吞掉:面探测(cat-file -e)对「不存在」这一正常结论会让 git 打一行 fatal,
      // 那些噪声会淹没判据自己的输出;真失败仍由 e.status + e.stderr 抛成无法判定。
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch (e) {
    // git grep 用退出码 1 表示「没匹配上」,那是正常结论而不是工具失效。
    if (allowFail && (e?.status === 1 || e?.status === undefined))
      return e?.status === 1 ? '' : null
    if (allowFail) return null
    throw new Undetermined(
      `git ${args.join(' ')} 调用失败: ${String(e?.message ?? e).split('\n')[0]}`,
    )
  }
}

/**
 * 取材面读取器。三种面共用一套接口,枚举与内容**同面同轮**
 * (否则「清单读盘 + 内容读 git」会造出一把自洽但基准错位的假绿尺子)。
 */
function makeReader(face, root) {
  if (!FACES.includes(face)) throw new Undetermined(`未知判定面 "${face}"(允许:${FACES.join('/')})`)
  const blobs = new Map()
  const listed = { v: null }
  const top = (gitRun(root, ['rev-parse', '--show-toplevel']) || '').trim()
  if (!top) throw new Undetermined(`${root} 不是 git 仓库,无法按${face} 面判定`)
  if (resolve(top).toLowerCase() !== resolve(root).toLowerCase()) {
    throw new Undetermined(`--root(${root})不是 git 仓库根(实测 ${top}),面判定的基准会错位,判死`)
  }
  const revPrefix = face === 'head' ? 'HEAD:' : face === 'staged' ? ':' : null

  function list() {
    if (listed.v) return listed.v
    let out
    if (face === 'head') out = gitRun(root, ['ls-tree', '-r', '--name-only', '-z', 'HEAD'])
    else out = gitRun(root, ['ls-files', '-z'])
    const files = out.split('\0').filter(Boolean)
    if (files.length === 0)
      throw new Undetermined(`${face} 面枚举到 0 个跟踪路径 —— 空扫不判绿,判死`)
    listed.v = files
    return files
  }

  function readBlob(rel) {
    if (blobs.has(rel)) return blobs.get(rel)
    let buf
    if (face === 'worktree') {
      const abs = join(root, rel)
      if (!existsSync(abs) || !statSync(abs).isFile()) {
        throw new Undetermined(`工作树取不到 ${rel}(不存在或不是普通文件)`)
      }
      buf = readFileSync(abs)
    } else {
      buf = gitRun(root, ['cat-file', 'blob', revPrefix + rel], {
        encoding: 'buffer',
        allowFail: true,
      })
      if (buf === null) throw new Undetermined(`${face === 'head' ? 'HEAD' : '索引'} 取不到 ${rel}`)
    }
    blobs.set(rel, buf)
    return buf
  }

  function has(rel) {
    if (face === 'worktree') return existsSync(join(root, rel))
    return gitRun(root, ['cat-file', '-e', revPrefix + rel], { allowFail: true }) !== null
  }

  /** 面内是否存在该目录(git 无空目录概念,前缀命中即算)。 */
  function hasDir(prefix) {
    return list().some((p) => p.startsWith(prefix + '/'))
  }

  /**
   * P2/V2 候选文件:一次 git grep 筛出带归属声明样子的跟踪文件,再逐行判归属。
   * 扫描面 = 固定源面 SCAN_PATHS ∪ 本轮量到的 vendored 目录(后者保证「vendor 在仓库根」
   * 这种形态不被固定清单漏掉;清单外的区域不假装看过,只在结论行如实报出边界)。
   */
  function grepCandidates(extraPathspecs = []) {
    const pathspecs = [
      ...new Set([...SCAN_PATHS.filter((p) => has(p) || hasDir(p)), ...extraPathspecs]),
    ]
    if (pathspecs.length === 0) return { ok: false, files: [] }
    // -E 必给:缺了它 git grep 按 BRE 解释,`(c)` 与 {0,4} 全部失效 —— 首版就这么静默漏过候选。
    const args = ['grep', '-l', '-I', '-E', '--no-color']
    for (const p of GREP_PATTERNS) args.push('-e', p)
    if (face === 'head') args.push('HEAD')
    else if (face === 'staged') args.push('--cached')
    args.push('--', ...pathspecs)
    const out = gitRun(root, args, { allowFail: true })
    if (out === null) return { ok: false, files: [] }
    return {
      ok: true,
      files: out
        .split('\n')
        .map((s) => (face === 'head' ? s.replace(/^HEAD:/, '') : s))
        .filter(Boolean),
    }
  }

  return { face, root, list, readBlob, has, hasDir, grepCandidates }
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

/** 一行是否只是本仓自己的横幅 / 归属声明(第三方归属判定前逐行剔除)。 */
function isOwnLine(line) {
  const low = line.toLowerCase()
  return OWN_TOKENS.some((t) => low.includes(t))
}

/** 文件里是否存在「非本仓」的归属声明行。 */
function hasThirdPartyNotice(buf, windowLines = NOTICE_HEADER_WINDOW_LINES) {
  if (buf.includes(0)) return false
  const lines = buf.toString('utf8').split('\n')
  for (const line of lines.slice(0, Math.max(1, windowLines))) {
    if (isOwnLine(line)) continue
    if (NOTICE_LINE_RE.test(line)) return true
  }
  return false
}

function coveredByRoots(rel, roots) {
  for (const r of roots) {
    if (rel === r || rel.startsWith(r + '/') || r.startsWith(rel + '/')) return true
  }
  return false
}

/** 台账条目里的必填字段(L0)。点号路径逐层取。 */
function requireFields(entry, file, required) {
  const errs = []
  for (const f of required) {
    const v = f.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), entry)
    if (v === undefined || v === null || v === '') errs.push(`L0 ${file} 缺必填字段 ${f}`)
  }
  return errs
}

/** P3:许可原文三形态。返回 {errs, pending}。 */
function checkText(tx, file, reader) {
  const errs = []
  const pending = []
  if (!tx || typeof tx !== 'object') return { errs: [`${file} 许可原文条目不是对象`], pending }
  if (!tx.form) return { errs: [`${file} 许可原文缺 form(inRepo / text / externalOnly)`], pending }
  const hash = typeof tx.sha256 === 'string' ? tx.sha256.toLowerCase() : ''
  if (tx.form === 'externalOnly') {
    if (!tx.fetchUrl) errs.push(`${file} externalOnly 形态必须给 fetchUrl(否则「原文在哪」不可追)`)
    if (!tx.note) errs.push(`${file} externalOnly 形态必须写明原文为何未入库`)
    pending.push(`${file} 许可原文未入库(externalOnly),待补登记:${tx.fetchUrl ?? '(无 URL)'}`)
    return { errs, pending }
  }
  if (!SHA256_RE.test(hash))
    errs.push(`${file} sha256 必须是 64 位十六进制(实得 ${JSON.stringify(tx.sha256 ?? null)})`)
  if (typeof tx.byteLength !== 'number' || !Number.isInteger(tx.byteLength) || tx.byteLength <= 0) {
    errs.push(`${file} byteLength 必须是正整数(缺了它「hash 对但长度错」那一型看不见)`)
  }
  let buf = null
  let label = ''
  if (tx.form === 'inRepo') {
    if (!tx.inRepo) return { errs: [`${file} inRepo 形态必须给仓内路径`], pending }
    label = tx.inRepo
    try {
      buf = reader.readBlob(tx.inRepo)
    } catch (e) {
      return { errs: [`${file} 许可原文在${reader.face} 面取不到:${e.message}`], pending }
    }
  } else if (tx.form === 'text') {
    if (typeof tx.text !== 'string' || tx.text.length === 0)
      return { errs: [`${file} text 形态必须内联许可原文`], pending }
    label = '(内联 text)'
    buf = Buffer.from(tx.text, 'utf8')
  } else {
    return {
      errs: [`${file} 未知许可原文形态 "${tx.form}"(只允许 inRepo / text / externalOnly)`],
      pending,
    }
  }
  const actual = sha256(buf)
  if (hash && actual !== hash)
    errs.push(`${file} 许可原文与台账不等值 ${label}:期望 ${hash} 实得 ${actual}`)
  if (typeof tx.byteLength === 'number' && tx.byteLength !== buf.length) {
    errs.push(`${file} 许可原文字节数不等值 ${label}:登记 ${tx.byteLength} 实得 ${buf.length}`)
  }
  return { errs, pending }
}

/** P4:revision 要么是真 sha,要么显式 null + 说明。 */
function checkRevision(upstream, file) {
  const errs = []
  if (!upstream || typeof upstream !== 'object') return [`${file} 缺 upstream 块`]
  const rev = upstream.gitRevision
  if (typeof rev === 'string' && rev.trim() === '') {
    errs.push(`${file} gitRevision 不得留空串 —— 不可考必须显式 null 并写 gitRevisionNote(P4)`)
  }
  if (rev === null || rev === undefined) {
    if (!upstream.gitRevisionNote) {
      errs.push(
        `${file} gitRevision 为 null 时必须写 gitRevisionNote:声明「该固定引用不主张等于当初导入版本」(P4)`,
      )
    }
  } else if (typeof rev !== 'string' || !/^[0-9a-f]{7,40}$/.test(rev.trim())) {
    errs.push(`${file} gitRevision 既不是 commit sha 也不是显式 null:${JSON.stringify(rev)}`)
  }
  if (!upstream.project) errs.push(`${file} upstream.project 必填(是谁的项目)`)
  return errs
}

/** P7:覆盖账 ↔ pnpm-workspace.yaml 双向对账。 */
function checkOverrideLedger(entries, reader, violations) {
  let yaml
  try {
    yaml = reader.readBlob('pnpm-workspace.yaml').toString('utf8')
  } catch (e) {
    throw new Undetermined(`pnpm-workspace.yaml 在${reader.face} 面取不到:${e.message}`)
  }
  const declared = new Map()
  let inOverrides = false
  for (const raw of yaml.split('\n')) {
    if (/^overrides:\s*$/.test(raw)) {
      inOverrides = true
      continue
    }
    if (!inOverrides) continue
    if (raw.trim() === '') continue
    if (/^\S/.test(raw)) {
      inOverrides = false
      continue
    }
    const m = raw.match(/^\s{2}"?([^:\s"]+)"?:\s*(.+?)\s*$/)
    if (!m) continue
    declared.set(m[1], m[2].replace(/^["']|["']$/g, ''))
  }
  const registered = new Set()
  for (const e of entries) {
    const file = `override:${e.id ?? '(无 id)'}`
    const key = e.overrideKey
    if (!key) {
      violations.push(`L0 ${file} 缺 overrideKey,无法与 pnpm-workspace.yaml 对账`)
      continue
    }
    registered.add(key)
    const actual = declared.get(key)
    if (actual === undefined) {
      violations.push(
        `P7 台账说谎:${file} 登记了 "${key}",而 pnpm-workspace.yaml 的 overrides 块里没有它`,
      )
      continue
    }
    if (!e.declaredValue) {
      violations.push(`L0 ${file} 缺 declaredValue(不登记实际值就发现不了台账与实物分叉)`)
    } else if (e.declaredValue !== actual) {
      violations.push(
        `P7 台账与实物不等值:${key} 登记 "${e.declaredValue}" 而 pnpm-workspace.yaml 记 "${actual}"`,
      )
    }
  }
  const undeclared = []
  for (const [k, v] of declared) {
    if (SOURCE_CHANGING_RE.test(v) && !registered.has(k)) undeclared.push({ key: k, value: v })
  }
  return { undeclared }
}

/** 主判定:零副作用,只读面。 */
function runCheck(root, face) {
  const reader = makeReader(face, root)
  const violations = []
  const notices = []
  const pending = []
  const entryCount = {}
  const allRoots = []
  /** root → 归属条目标签(P8 点名"谁登记的这块第三方内容被我们盖了章")。 */
  const rootOwners = new Map()

  const ledgers = {}
  let ownDeclarations = []
  for (const { file, kind } of LEDGER_FILES) {
    const rel = `${LEDGER_DIR}/${file}`
    let doc
    try {
      doc = JSON.parse(reader.readBlob(rel).toString('utf8'))
    } catch (e) {
      if (e instanceof Undetermined) throw e
      throw new Undetermined(
        `${file} 在${face} 面读取/解析失败(${String(e.message).split('\n')[0]})—— 台账坏了无法判定`,
      )
    }
    if (!Array.isArray(doc.entries)) throw new Undetermined(`${file} 没有 entries 数组,判死`)
    ledgers[kind] = doc.entries
    entryCount[kind] = doc.entries.length
    if (kind === 'embedded') {
      if (doc.ownLicenseDeclarations !== undefined) {
        if (!Array.isArray(doc.ownLicenseDeclarations))
          throw new Undetermined('embedded.json 的 ownLicenseDeclarations 必须是数组')
        ownDeclarations = doc.ownLicenseDeclarations
      }
    }
  }

  const seenIds = new Set()
  const all = []
  for (const { kind } of LEDGER_FILES) {
    for (const e of ledgers[kind] ?? []) all.push({ e, kind })
  }
  for (const { e, kind } of all) {
    const label = `${kind}:${e?.id ?? '(无 id)'}`
    if (seenIds.has(label)) violations.push(`L0 台账 id 撞号:${label}`)
    seenIds.add(label)
    if (kind === MECHANISM_KIND) continue
    if (!Array.isArray(e.roots) || e.roots.length === 0) {
      violations.push(`L0 ${label} 缺 roots(本仓真实路径)`)
      continue
    }
    allRoots.push(...e.roots)
    for (const r of e.roots) if (!rootOwners.has(r)) rootOwners.set(r, `${kind}:${e.id}`)
  }

  // ---- L0 + P1 + P3 + P4(逐条) ----
  for (const { e, kind } of all) {
    if (kind === MECHANISM_KIND) continue
    const file = `${kind}:${e.id}`
    violations.push(
      ...requireFields(e, file, [
        'id',
        'name',
        'purpose',
        'upstream',
        'modification',
        'obligations',
      ]),
    )
    violations.push(...checkRevision(e.upstream, file))
    if (!e.attributionBoundary)
      violations.push(`L0 ${file} 缺 attributionBoundary(同目录内本仓自研文件不归属上游的边界声明)`)
    for (const r of e.roots ?? []) {
      if (!reader.has(r) && !reader.hasDir(r))
        violations.push(`P1 登记的实物不存在:${file} roots → ${r}(${face} 面)`)
    }
    const texts = e.license?.texts
    if (!Array.isArray(texts) || texts.length === 0) {
      violations.push(`L0 ${file} 缺 license.texts(许可原文在哪、hash 多少)`)
      continue
    }
    for (const tx of texts) {
      const r = checkText(tx, file, reader)
      violations.push(...r.errs)
      pending.push(...r.pending)
    }
  }

  // ---- P2 反向:盘上有来源的东西必须登记 ----
  /**
   * 候选粒度刻意取「vendored 包目录」(vendor/<pkg>)而不是 vendor 本身:
   * 后者会让「在已登记的 vendor 目录旁再塞一个未登记的包」完全隐身 —— 那正是本门要抓的形态。
   */
  const dirs = new Set()
  for (const rel of reader.list()) {
    const segs = rel.split('/')
    for (let i = 0; i < segs.length - 1; i++) {
      if (!VENDOR_DIR_RE.test(segs[i])) continue
      if (i + 1 < segs.length - 1) dirs.add(segs.slice(0, i + 2).join('/'))
      else dirs.add(segs.slice(0, i + 1).join('/'))
    }
  }
  const candidateDirs = [...dirs].sort()
  for (const d of candidateDirs) {
    if (!coveredByRoots(d, allRoots))
      violations.push(`P2 拿了没登记:盘上有 vendored 目录却无台账条目 → ${d}/`)
  }

  const ownSet = new Set(ownDeclarations.filter((p) => typeof p === 'string'))
  const grep = reader.grepCandidates(candidateDirs)
  const candidateFiles = []
  if (!grep.ok) {
    notices.push('P2/V2 候选扫描未跑成(git grep 不可用)—— 本轮只判了 V1 目录面,已如实报出,不冒绿')
  }
  for (const rel of grep.files) {
    if (rel.startsWith(LEDGER_DIR + '/')) continue
    // 自著的许可/归属声明文件(Apache boilerplate 自带 Copyright 占位行)不算进件;
    // 但 P6 会逐条验它真实存在且 basename 属于 LICENSE/NOTICE/COPYING 一族 —— 藏源码即红。
    if (ownSet.has(rel)) continue
    let buf
    try {
      buf = reader.readBlob(rel)
    } catch (e) {
      violations.push(`P2 判据取不到候选内容 ${rel}:${e.message}`)
      continue
    }
    if (!hasThirdPartyNotice(buf)) continue
    candidateFiles.push(rel)
    if (!coveredByRoots(rel, allRoots))
      violations.push(`P2 拿了没登记:带第三方归属声明的跟踪文件无台账条目 → ${rel}`)
  }

  // ---- P8 归属反噬:已登记的第三方内容上不得出现我方水印 ----
  /**
   * 展开用 `expandRootsToFiles`(与水印层的排除面同一个纯函数,同一张 roots 表)——
   * 这是本条判据成立的前提:水印层自 2026-09-25 起把这些文件**移出分母**,若本条按另一种
   * 口径展开,就会出现"免除横幅却无人审计归属"或"审计了却在打横幅"的空档/重叠。
   * 内容按**当次判定面**取(reader.readBlob),不读磁盘 —— 与 P1/P3 同一把尺子。
   *
   * 立因(2026-09-25 实测):`apps/web/public/pdfjs/pdf.worker.min.mjs` 第 1–3 行是我们的
   * 归属横幅,而它在台账里登记为 `copied:pdfjs-worker-6.x`(Mozilla PDF.js,Apache-2.0)。
   * P1–P7 全部只问"来源有没有登记",没有一条问"登记过的东西上盖了谁的章" ——
   * 于是"合规登记"与"错误的归属主张"同时为真且无人报警。
   */
  const thirdPartyFiles = [...expandRootsToFiles(allRoots, reader.list())].sort()
  /** 反查某个文件由哪条台账条目登记(root 可以是目录,故逐级向上找最长前缀)。 */
  function ownerOf(rel) {
    const segs = rel.split('/')
    for (let i = segs.length; i > 0; i--) {
      const label = rootOwners.get(segs.slice(0, i).join('/'))
      if (label) return label
    }
    return '(未记名条目)'
  }
  let p8Inspected = 0
  let p8Hits = 0
  for (const rel of thirdPartyFiles) {
    let buf
    try {
      buf = reader.readBlob(rel)
    } catch (e) {
      // 取不到内容不得当作"没有横幅"放过(那是把判据失效洗成绿),但也不冒红:
      // 与全链口径一致 —— 抛无法判定,由 CLI 收敛到 exit 2。
      if (e instanceof Undetermined) throw e
      violations.push(`P8 判据取不到已登记第三方文件的内容 ${rel}:${String(e.message ?? e)}`)
      continue
    }
    p8Inspected++
    const claim = carriesOurAttribution(buf)
    if (!claim) continue
    p8Hits++
    violations.push(
      `P8 归属反噬:已登记的第三方内容上出现我方水印(${claim}) ⇒ 我们把第三方内容声明成了自己的` +
        ` → ${rel}(台账条目 ${ownerOf(rel)})。` +
        `修法:node scripts/watermark.mjs clean ${rel}(勿手删零宽字符)`,
    )
  }
  if (thirdPartyFiles.length === 0) {
    notices.push(
      'P8 未展开到任何已登记第三方文件(roots 为空或全部不在面上)—— 报数不判红,' +
        '但别把它读成"已核过零个文件"',
    )
  }

  // ---- P6 自著声明清单必须属实 ----
  for (const rel of ownDeclarations) {
    if (typeof rel !== 'string' || !rel) {
      violations.push('P6 ownLicenseDeclarations 含非字符串项')
      continue
    }
    if (!reader.has(rel)) {
      violations.push(`P6 自著声明清单过期:列了 ${rel} 而${face} 面没有它`)
      continue
    }
    if (!/^(LICENSE|NOTICE|COPYING)/i.test(posix.basename(rel))) {
      violations.push(`P6 越界豁免:${rel} 不是 LICENSE/NOTICE/COPYING 一族,不得进自著声明清单`)
    }
  }

  // ---- P5 机制账 ----
  for (const e of ledgers.mechanism ?? []) {
    const file = `mechanism:${e.id ?? '(无 id)'}`
    violations.push(
      ...requireFields(e, file, [
        'id',
        'mechanism',
        'upstreamProject',
        'specFile',
        'absorbedOn',
        'cleanRoom',
      ]),
    )
    if (!DATE_RE.test(String(e.absorbedOn ?? ''))) {
      violations.push(
        `P5 ${file} absorbedOn 必须是 YYYY-MM-DD(实得 ${JSON.stringify(e.absorbedOn)})`,
      )
    }
    if (!Array.isArray(e.landsOn) || e.landsOn.length === 0) {
      violations.push(`P5 ${file} 缺 landsOn(本侧落点路径)`)
      continue
    }
    for (const p of e.landsOn) {
      if (!reader.has(p) && !reader.hasDir(p))
        violations.push(`P5 机制账登记的落点不存在:${file} landsOn → ${p}(${face} 面)`)
    }
    // 锚点必须**随检出一起存在**,所以按被审判的面判,不按工作树判。
    // 旧写法是 `existsSync(join(root, e.specFile))`,于是"把锚点写进 gitignored 目录"这种账
    // 在作者机器上常绿、在任何别的检出上恒红(blocking)—— 而该目录会被本仓自己的
    // post-commit `--auto-clean` 清掉,结果是**每一次提交都被逼 --no-verify**(实测 G-173)。
    // 判据失效的方向必须是"多要一次耐久登记",绝不能是"多放一次恒红"。
    if (!reader.has(e.specFile) && !reader.hasDir(e.specFile)) {
      violations.push(
        `P5 ${file} 的规格锚点不在${face === 'head' ? ' HEAD' : face === 'index' ? '索引' : '工作树'}里:${e.specFile}(机制账的可审计锚点必须受版本控制 —— 落空有两解:没提交,或落在 gitignored 目录;两种都等于「声称借鉴但无从核对」)`,
      )
    }
  }

  // ---- P7 覆盖账双向对账 ----
  const { undeclared } = checkOverrideLedger(ledgers.override ?? [], reader, violations)
  for (const s of undeclared) {
    violations.push(
      `P2 拿了没登记:pnpm-workspace.yaml 把 ${s.key} 的来源换成 ${s.value},覆盖账里没有对应条目`,
    )
  }

  return {
    violations,
    notices,
    pending,
    entryCount,
    candidateDirs,
    candidateFiles,
    p8Inspected,
    p8Hits,
    thirdPartyFiles,
    textLedgerKinds: TEXTS_PER_ENTRY_REQUIRED_KINDS,
  }
}

/**
 * 暂存档的棘轮:P2 的候选只判「相对 HEAD 新出现的」。
 * HEAD 面算不出来时**不放过**(宁判不静默),并如实说明原因。
 */
function ratchetStaged(root, result) {
  let headCandidateDirs = []
  let headCandidateFiles = []
  try {
    const head = runCheck(root, 'head')
    headCandidateDirs = head.candidateDirs
    headCandidateFiles = head.candidateFiles
  } catch (e) {
    return {
      violations: result.violations,
      notices: [...result.notices, `P2 棘轮未生效(HEAD 面算不出候选,故存量照判):${e.message}`],
    }
  }
  const known = new Set([...headCandidateDirs, ...headCandidateFiles])
  const targetOf = (v) => {
    if (!v.startsWith('P2 ')) return null
    const hit = /→ (.+?)(\/?)$/.exec(v)
    return hit ? hit[1] : null
  }
  const kept = []
  let suppressed = 0
  for (const v of result.violations) {
    const t = targetOf(v)
    if (t && known.has(t)) {
      suppressed++
      continue
    }
    kept.push(v)
  }
  const notices =
    suppressed > 0
      ? [
          ...result.notices,
          `P2 存量(HEAD 面已存在)不判红 ${suppressed} 条 —— 棘轮锚点是该路径在 HEAD 的存在性,不是手工清单`,
        ]
      : result.notices
  return { violations: kept, notices }
}

function report(result, face) {
  const lines = []
  lines.push(`[provenance-ledger] 取材面=${face}`)
  lines.push(
    `  台账条目:嵌入 ${result.entryCount.embedded ?? 0} / 复制 ${result.entryCount.copied ?? 0} / 覆盖 ${result.entryCount.override ?? 0} / 机制 ${result.entryCount.mechanism ?? 0}`,
  )
  lines.push(
    `  P2 候选面:vendored 目录 ${result.candidateDirs.length} 个,带第三方归属声明的跟踪文件 ${result.candidateFiles.length} 个`,
  )
  // P8 的核对面必须打印:只报"无违规"而不报"核了几个文件",会让人把"零个文件被核"读成"都干净"。
  lines.push(
    `  P8 归属反噬:已登记第三方文件 ${result.thirdPartyFiles?.length ?? 0} 个(roots 展开),` +
      `实核 ${result.p8Inspected ?? 0} 个,发现我方归属主张 ${result.p8Hits ?? 0} 处`,
  )
  for (const d of result.candidateDirs) lines.push(`    目录:${d}/`)
  for (const f of result.candidateFiles) lines.push(`    文件:${f}`)
  if (result.pending.length) {
    lines.push(`  待补登记(许可原文未入库)${result.pending.length} 条:`)
    for (const p of result.pending) lines.push(`    ${p}`)
  }
  for (const n of result.notices) lines.push(`  NOTE ${n}`)
  if (result.violations.length === 0) lines.push('  ✅ 无未登记来源、无悬空登记、无 hash 漂移')
  else {
    lines.push(`  ❌ 违规 ${result.violations.length} 条:`)
    for (const v of result.violations) lines.push(`    ${v}`)
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------- self-test

function fixtureEntry(id, roots, opts = {}) {
  return {
    id,
    kind: opts.kind ?? 'embedded',
    name: `fixture-${id}`,
    purpose: '自检夹具条目',
    upstream: {
      project: 'fixture-upstream',
      repository: 'https://example.invalid/fixture',
      version: opts.version ?? '1.2.3',
      gitRevision: 'gitRevision' in opts ? opts.gitRevision : null,
      gitRevisionNote: opts.gitRevisionNote ?? '夹具:不主张等于上游任一 commit',
    },
    license: {
      spdx: 'MIT',
      texts: [
        opts.text ?? {
          form: 'externalOnly',
          fetchUrl: 'https://example.invalid/LICENSE',
          note: '夹具:原文未入库',
        },
      ],
    },
    roots,
    modification: 'unmodified-import',
    modificationNote: '夹具',
    attributionBoundary: '夹具目录内无自研文件',
    obligations: '夹具义务',
  }
}

async function selfTest() {
  const { mkScratch, rmScratch } = await import('./lib/scratch-dir.mjs')
  let pass = 0
  let fail = 0
  const ok = (cond, name, extra = '') => {
    if (cond) {
      pass++
      console.log(`  ✅ ${name}`)
    } else {
      fail++
      console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`)
    }
  }
  const dir = mkScratch('provenance-ledger-')
  const w = (rel, text) => {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text)
  }
  const commit = () => {
    gitRun(dir, ['add', '-A'])
    // 夹具反复写同一份台账时会出现「无 staged 改动」,那是正常态而不是失败:跳过即可,
    // 但绝不吞真错(status 其他非零码由 gitRun 抛无法判定)。
    const dirty = gitRun(dir, ['diff', '--cached', '--name-only']).trim()
    if (dirty === '') return false
    gitRun(dir, ['commit', '-q', '--no-gpg-sign', '-m', 'fixture'])
    return true
  }
  /** 写四本账 + overrides 实物面;机制账默认空(专项用例再单独写)。 */
  const writeLedgers = ({
    embedded = [],
    copied = [],
    overrides = [],
    mechanisms = [],
    own = [],
    yamlBody = '',
  }) => {
    const base = join(dir, LEDGER_DIR)
    mkdirSync(base, { recursive: true })
    writeFileSync(
      join(base, 'embedded.json'),
      JSON.stringify({ schemaVersion: 1, entries: embedded, ownLicenseDeclarations: own }, null, 2),
    )
    writeFileSync(
      join(base, 'copied.json'),
      JSON.stringify({ schemaVersion: 1, entries: copied }, null, 2),
    )
    writeFileSync(
      join(base, 'overrides.json'),
      JSON.stringify({ schemaVersion: 1, entries: overrides }, null, 2),
    )
    writeFileSync(
      join(base, 'mechanisms.json'),
      JSON.stringify({ schemaVersion: 1, entries: mechanisms }, null, 2),
    )
    writeFileSync(
      join(dir, 'pnpm-workspace.yaml'),
      `overrides:\n${yamlBody}packages:\n  - apps/demo\n`,
    )
  }
  const licenseText = 'MIT License\n\nCopyright (c) 2024 Fixture Authors\n'

  try {
    gitRun(dir, ['init', '-q', '-b', 'main'])
    gitRun(dir, ['config', 'user.email', 'fixture@invalid'])
    gitRun(dir, ['config', 'user.name', 'fixture'])
    w('vendor/demo/LICENSE-MIT', licenseText)
    w(
      'vendor/demo/src/lib.rs',
      '// Copyright 2024 Fixture Authors\n// SPDX-License-Identifier: MIT\nfn main() {}\n',
    )
    w('apps/demo/src/index.js', 'export const a = 1\n')
    w('README.md', '# fixture\n')
    const lic = {
      form: 'inRepo',
      inRepo: 'vendor/demo/LICENSE-MIT',
      sha256: sha256(readFileSync(join(dir, 'vendor/demo/LICENSE-MIT'))),
      byteLength: readFileSync(join(dir, 'vendor/demo/LICENSE-MIT')).length,
    }
    writeLedgers({ embedded: [fixtureEntry('demo', ['vendor/demo'], { text: lic })] })
    commit()

    // 1 反向对照:完整登记的 vendored 目录 ⇒ 绿
    const r1 = runCheck(dir, 'head')
    ok(
      r1.violations.length === 0,
      '1 完整登记的 vendored 目录 ⇒ 判绿(反向对照)',
      r1.violations.join(' | '),
    )
    ok(
      r1.candidateDirs.includes('vendor/demo'),
      '1b 候选面确实扫到了 vendored 包目录(粒度=vendor/<pkg>,否则 1 是空扫假绿)',
      JSON.stringify(r1.candidateDirs),
    )
    ok(
      r1.candidateFiles.includes('vendor/demo/src/lib.rs'),
      '1c 候选面确实扫到了带第三方版权头的文件',
      JSON.stringify(r1.candidateFiles),
    )

    // 2 阳性对照:未登记的 vendored 目录 ⇒ 红并点名
    w('vendor/undone/LICENSE', 'Copyright 2024 Someone Else\n')
    w('vendor/undone/a.js', '// Copyright 2024 Someone Else\nexport const a = 1\n')
    commit()
    const r2 = runCheck(dir, 'head')
    ok(
      r2.violations.some((v) => v.startsWith('P2') && v.includes('vendor/undone')),
      '2 未登记的 vendored 目录 ⇒ 判红并点名(阳性对照)',
      r2.violations.join(' | '),
    )

    // 2b 该债已在 HEAD ⇒ 暂存档放过并如实报数(不恒红)
    w('README.md', '# fixture changed\n')
    gitRun(dir, ['add', 'README.md'])
    const k2b = ratchetStaged(dir, runCheck(dir, 'staged'))
    ok(
      k2b.violations.every((v) => !v.includes('vendor/undone')),
      '2b 存量债在 HEAD 已存在 ⇒ 暂存档不判红(棘轮锚点=HEAD)',
      k2b.violations.join(' | '),
    )
    ok(
      k2b.notices.some((n) => n.includes('存量')),
      '2c 放过必须如实报数,不得静默成绿',
      JSON.stringify(k2b.notices),
    )

    // 2d 本次暂存新引入未登记件 ⇒ 判红
    w('vendor/fresh/LICENSE', 'Copyright 2024 Fresh Else\n')
    gitRun(dir, ['add', 'vendor/fresh'])
    const k2d = ratchetStaged(dir, runCheck(dir, 'staged'))
    ok(
      k2d.violations.some((v) => v.startsWith('P2') && v.includes('vendor/fresh')),
      '2d 本次暂存新引入的未登记件 ⇒ 判红(棘轮只放存量)',
      k2d.violations.join(' | '),
    )
    commit()

    // 3 许可原文 hash 漂移 ⇒ 红
    w('vendor/demo/LICENSE-MIT', `${licenseText}\n# 被改了一个字\n`)
    commit()
    const r3 = runCheck(dir, 'head')
    ok(
      r3.violations.some((v) => v.includes('许可原文与台账不等值')),
      '3 许可原文字节变了而台账没更新 ⇒ 判红(P3)',
      r3.violations.join(' | '),
    )
    w('vendor/demo/LICENSE-MIT', licenseText)
    commit()

    // 4 登记了但实物没了 ⇒ 红
    writeLedgers({ embedded: [fixtureEntry('ghost', ['vendor/nope'])] })
    commit()
    const r4 = runCheck(dir, 'head')
    ok(
      r4.violations.some((v) => v.startsWith('P1') && v.includes('vendor/nope')),
      '4 台账 roots 指向不存在的实物 ⇒ 判红(P1)',
      r4.violations.join(' | '),
    )

    // 5 P4 三形态
    writeLedgers({ embedded: [fixtureEntry('rev1', ['vendor/demo'], { gitRevision: '' })] })
    commit()
    ok(
      runCheck(dir, 'head').violations.some((v) => v.includes('不得留空串')),
      '5a gitRevision 空串 ⇒ 判红(P4)',
    )
    writeLedgers({
      embedded: [fixtureEntry('rev2', ['vendor/demo'], { gitRevision: null, gitRevisionNote: '' })],
    })
    commit()
    ok(
      runCheck(dir, 'head').violations.some((v) => v.includes('必须写 gitRevisionNote')),
      '5b null 而不写说明 ⇒ 判红(P4)',
    )
    writeLedgers({
      embedded: [
        fixtureEntry('rev3', ['vendor/demo'], {
          gitRevision: '0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d',
        }),
      ],
    })
    commit()
    const r5c = runCheck(dir, 'head')
    ok(
      !r5c.violations.some((v) => v.includes('gitRevision')),
      '5c 真 commit sha 放过(判据不能只认 null 这一支)',
      r5c.violations.join(' | '),
    )

    // 6a yaml 换了来源而覆盖账没记 ⇒ 判红(P7 反向)
    writeLedgers({ embedded: [], yamlBody: '  kept: "npm:someone-else@^1.0.0"\n' })
    commit()
    ok(
      runCheck(dir, 'head').violations.some((v) => v.startsWith('P2') && v.includes('kept')),
      '6a yaml 换了来源而覆盖账没记 ⇒ 判红(P7 反向)',
    )
    writeLedgers({
      embedded: [],
      yamlBody: '  kept: "npm:someone-else@^1.0.0"\n',
      overrides: [
        {
          ...fixtureEntry('ov', ['README.md'], { kind: 'override' }),
          overrideKey: 'kept',
          declaredValue: 'npm:someone-else@^1.0.0',
        },
      ],
    })
    commit()
    ok(
      !runCheck(dir, 'head').violations.some((v) => v.startsWith('P7')),
      '6b 登记值与 yaml 逐字等值 ⇒ 放过',
    )
    writeLedgers({
      embedded: [],
      yamlBody: '  kept: "npm:someone-else@^1.0.0"\n',
      overrides: [
        {
          ...fixtureEntry('ov2', ['README.md'], { kind: 'override' }),
          overrideKey: 'ghost-key',
          declaredValue: 'npm:x@1',
        },
      ],
    })
    commit()
    ok(
      runCheck(dir, 'head').violations.some((v) => v.startsWith('P7 台账说谎')),
      '6c 登记了 yaml 里没有的 key ⇒ 判红(P7 正向)',
    )
    writeLedgers({
      embedded: [],
      yamlBody: '  kept: "npm:someone-else@^1.0.0"\n',
      overrides: [
        {
          ...fixtureEntry('ov3', ['README.md'], { kind: 'override' }),
          overrideKey: 'kept',
          declaredValue: 'npm:drifted@^9',
        },
      ],
    })
    commit()
    ok(
      runCheck(dir, 'head').violations.some((v) => v.startsWith('P7 台账与实物不等值')),
      '6d 登记值与 yaml 不等值 ⇒ 判红(P7 值级对账)',
    )

    // 7 内联 text 形态自证
    const inline = {
      form: 'text',
      text: licenseText,
      sha256: sha256(Buffer.from(licenseText, 'utf8')),
      byteLength: Buffer.byteLength(licenseText),
    }
    writeLedgers({ embedded: [fixtureEntry('inline', ['vendor/demo'], { text: inline })] })
    commit()
    ok(
      !runCheck(dir, 'head').violations.some((v) => v.includes('内联')),
      '7a 内联原文 sha256 自证通过',
    )
    writeLedgers({
      embedded: [
        fixtureEntry('inline2', ['vendor/demo'], { text: { ...inline, text: `${licenseText}x` } }),
      ],
    })
    commit()
    ok(
      runCheck(dir, 'head').violations.some((v) => v.includes('不等值') && v.includes('内联')),
      '7b 内联原文与登记 hash 不符 ⇒ 判红',
    )

    // 8 机制账
    w('SPEC/SPEC.md', '# 规格\n')
    writeLedgers({
      embedded: [],
      mechanisms: [
        {
          id: 'm1',
          mechanism: '夹具机制',
          upstreamProject: 'fixture',
          specFile: 'SPEC/SPEC.md',
          absorbedOn: '2026-01-02',
          landsOn: ['vendor/demo/nothere.ts'],
          cleanRoom: '夹具声明',
        },
      ],
    })
    commit()
    const r8 = runCheck(dir, 'head')
    ok(
      r8.violations.some((v) => v.startsWith('P5') && v.includes('landsOn')),
      '8 机制账落点不存在 ⇒ 判红(P5)',
      r8.violations.join(' | '),
    )
    ok(
      !r8.violations.some((v) => v.includes('规格锚点')),
      '8b 锚点已提交进被审面 ⇒ 该项不判红',
    )
    // 8e 就是 G-173 那一型:锚点**在工作树上存在**,但落在 gitignored 目录 ⇒ 从未进任何检出。
    // 旧判据(existsSync)在这里必然报绿,所以这条用例同时是"新判据有牙"的证明。
    w('.gitignore', 'tmp-note/\n')
    w('tmp-note/EPHEMERAL.md', '# 只在作者机器上存在的临时笔记\n')
    commit() // 注意:被忽略的文件 add 不进去,故它只存在于工作树
    writeLedgers({
      embedded: [],
      mechanisms: [
        {
          id: 'm-ephemeral',
          mechanism: '夹具机制',
          upstreamProject: 'fixture',
          specFile: 'tmp-note/EPHEMERAL.md',
          absorbedOn: '2026-01-02',
          landsOn: ['vendor/demo/src/lib.rs'],
          cleanRoom: '夹具声明',
        },
      ],
    })
    commit()
    const r8e = runCheck(dir, 'head')
    ok(
      existsSync(join(dir, 'tmp-note/EPHEMERAL.md')),
      '8e 夹具前提坏了:锚点在工作树上本应存在(否则这条证不了事)',
    )
    ok(
      r8e.violations.some((v) => v.startsWith('P5') && v.includes('规格锚点不在')),
      '8e 锚点盘上存在但未受版本控制 ⇒ 必须判红(旧 existsSync 写法在这里是假绿)',
      r8e.violations.join(' | '),
    )
    writeLedgers({
      embedded: [],
      mechanisms: [
        {
          id: 'm2',
          mechanism: '夹具机制',
          upstreamProject: 'fixture',
          specFile: 'SPEC/SPEC.md',
          absorbedOn: '2026/01/02',
          landsOn: ['vendor/demo/src/lib.rs'],
          cleanRoom: '夹具声明',
        },
      ],
    })
    commit()
    const r8c = runCheck(dir, 'head')
    ok(
      !r8c.violations.some((v) => v.startsWith('P5') && v.includes('landsOn')),
      '8c 落点改为真实文件 ⇒ P5 该项转绿(证明 8 的红不是恒真)',
      r8c.violations.join(' | '),
    )
    ok(
      r8c.violations.some((v) => v.startsWith('P2') && v.includes('vendor/undone')),
      '8d 同一轮里其它判据仍在问责(转绿不能靠整门短路)',
    )

    // 9 P6 自著声明清单
    writeLedgers({ embedded: [], own: ['vendor/demo/src/lib.rs'] })
    commit()
    ok(
      runCheck(dir, 'head').violations.some((v) => v.startsWith('P6 越界豁免')),
      '9 把源码文件塞进自著声明清单 ⇒ 判红(P6 不得当豁免表用)',
    )
    writeLedgers({ embedded: [], own: ['LICENSE'] })
    commit()
    ok(
      runCheck(dir, 'head').violations.some((v) => v.startsWith('P6 自著声明清单过期')),
      '9b 清单里的文件不在面上了 ⇒ 判红(清单腐烂即红)',
    )
    w('LICENSE', 'MIT License\n\nCopyright (c) 2026 Fixture Own\n')
    commit()
    const r9c = runCheck(dir, 'head')
    ok(
      !r9c.violations.some((v) => v.startsWith('P6')),
      '9c 自著 LICENSE 在位 ⇒ P6 转绿',
      r9c.violations.join(' | '),
    )

    // 10 台账坏了 ⇒ 无法判定;面隔离:索引坏而盘上好 ⇒ staged 判死而 HEAD 不受影响
    const goodEmbedded = readFileSync(join(dir, LEDGER_DIR, 'embedded.json'), 'utf8')
    writeLedgers({ embedded: [], own: ['LICENSE'] })
    commit()
    writeFileSync(join(dir, LEDGER_DIR, 'embedded.json'), '{ this is not json')
    gitRun(dir, ['add', `${LEDGER_DIR}/embedded.json`])
    writeFileSync(join(dir, LEDGER_DIR, 'embedded.json'), goodEmbedded)
    let stagedErr = null
    let headErr = null
    try {
      runCheck(dir, 'staged')
    } catch (e) {
      stagedErr = e
    }
    try {
      runCheck(dir, 'head')
    } catch (e) {
      headErr = e
    }
    ok(
      stagedErr instanceof Undetermined,
      '10a 索引里的台账坏了 ⇒ staged 面必须「无法判定」',
      String(stagedErr),
    )
    ok(headErr === null, '10b 同一时刻工作树被别人半编辑不得影响 HEAD 面结论(面隔离)')

    // ---- 11 P8 归属反噬 ----
    // 立因:水印层曾把归属横幅打进已登记的第三方文件(Mozilla PDF.js),而 P1–P7 全部
    // 只问"来源有没有登记",没有一条问"登记过的东西上盖了谁的章"。
    writeLedgers({ embedded: [fixtureEntry('tp', ['vendor/demo'], { text: lic })] })
    commit()
    const r11a = runCheck(dir, 'head')
    ok(
      !r11a.violations.some((v) => v.startsWith('P8')),
      '11a 已登记的第三方文件不带我方横幅 ⇒ P8 判绿(反向对照)',
      r11a.violations.filter((v) => v.startsWith('P8')).join(' | '),
    )
    ok(
      r11a.p8Inspected >= 2 && r11a.thirdPartyFiles.includes('vendor/demo/src/lib.rs'),
      '11b P8 确实按 roots 展开并核到了文件(缺了这条,11a 只是"零个文件"的假绿)',
      JSON.stringify({ n: r11a.p8Inspected, files: r11a.thirdPartyFiles }),
    )
    // 阳性对照:往登记的第三方文件上打我方规范横幅 ⇒ 判红并点名
    w(
      'vendor/demo/src/lib.rs',
      '// Copyright 2024 Fixture Authors\n// SPDX-License-Identifier: MIT\n' +
        '// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top\n' +
        '// Provenance-watermarked. 未授权商用可被溯源追责\nfn main() {}\n',
    )
    commit()
    const r11c = runCheck(dir, 'head')
    ok(
      r11c.violations.some(
        (v) => v.startsWith('P8 归属反噬') && v.includes('vendor/demo/src/lib.rs'),
      ),
      '11c 已登记的第三方文件上出现我方横幅 ⇒ 判红并点名该文件',
      r11c.violations.filter((v) => v.startsWith('P8')).join(' | '),
    )
    ok(r11c.p8Hits === 1, '11c2 命中数如实报出(报告面与违规面不得分叉)', String(r11c.p8Hits))
    // 只剩零宽载荷(可见横幅被人手删)也必须判红 —— 否则"删掉两行头"就绕过了本条
    w('vendor/demo/src/icon.rs', 'pub fn icon() {}\n// \u2060\u200b\u200c\u200b\u200d\u2060\n')
    commit()
    ok(
      runCheck(dir, 'head').violations.some(
        (v) => v.startsWith('P8') && v.includes('零宽') && v.includes('vendor/demo/src/icon.rs'),
      ),
      '11d 剥掉可见横幅、只留零宽载荷 ⇒ 仍判红(判据不可被"删两行"绕过)',
    )
    // 范围对照:未登记的本仓自研文件带满横幅也不该被 P8 点名(P8 不是"全仓禁横幅")
    w(
      'apps/demo/src/index.js',
      '// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top\n// Provenance-watermarked. x\nexport const a = 1\n',
    )
    commit()
    const r11e = runCheck(dir, 'head')
    ok(
      !r11e.violations.some((v) => v.startsWith('P8') && v.includes('apps/demo')),
      '11e 未登记路径上的自研文件带横幅 ⇒ P8 不越界问责(它只管 roots 命中的文件)',
      r11e.violations.filter((v) => v.startsWith('P8')).join(' | '),
    )
    // 判据的字面量表不得与 P2 那份漂移:两处各写一份而无人对账是本仓最高频失守形态
    ok(
      OWN_BANNER_STRUCT_TOKENS.every((t) => OWN_TOKENS.includes(t)),
      '11f P8 的结构串必须是 OWN_TOKENS 的成员(否则两处字面量各写一份,漂移即静默失明)',
      JSON.stringify({ p8: OWN_BANNER_STRUCT_TOKENS, p2: OWN_TOKENS }),
    )
    // 11g 假阳钉死:被登记为 override 落点的**自研清单**里带 author / copyright 字段
    // (真仓 apps/web/package.json 的形状)不得算归属反噬 —— 归属主张的形态是**行首的横幅注释**,
    // 不是值里的品牌串。缺了这条,P8 会在它自己写坏的地方恒红,逼人 --no-verify。
    w(
      'vendor/demo/manifest.json',
      JSON.stringify(
        {
          author: '李春川 (Li Chunchuan) <IHUI AI (智汇AI)>',
          copyright: '© 2026 IHUI AI (智汇AI) · 李春川 · All rights reserved.',
        },
        null,
        2,
      ) + '\n',
    )
    commit()
    const r11g = runCheck(dir, 'head')
    ok(
      !r11g.violations.some((v) => v.startsWith('P8') && v.includes('manifest.json')),
      '11g 自研清单里的 copyright **值** ⇒ P8 不得判红(行首锚定才叫横幅)',
      r11g.violations.filter((v) => v.startsWith('P8')).join(' | '),
    )
    // 11h 同一条判据的阳性臂:同样的品牌串换成行首注释形态 ⇒ 必须立刻红
    w('vendor/demo/manifest.json', '// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川\n{"a":1}\n')
    commit()
    const r11h = runCheck(dir, 'head')
    ok(
      r11h.violations.some((v) => v.startsWith('P8') && v.includes('manifest.json')),
      '11h 同一文件的行首版权注释 ⇒ 判红(证明 11g 的绿来自锚定判据,不是这条路径没被扫)',
      r11h.violations.filter((v) => v.startsWith('P8')).join(' | '),
    )
  } finally {
    rmScratch(dir)
  }
  console.log(`\n[provenance-ledger --self-test] 通过 ${pass} / 失败 ${fail}`)
  return fail === 0 ? 0 : 1
}

// ---------------------------------------------------------------- CLI

const ALLOWED_FLAGS = new Set([
  '--check',
  '--report',
  '--self-test',
  '--staged',
  '--worktree',
  '--root',
  '--help',
  '-h',
])

function resolveFace(argv) {
  if (argv.includes('--staged') && argv.includes('--worktree')) {
    process.stderr.write('用法错:--staged 与 --worktree 不得同时给(基准面矛盾,判死)\n')
    process.exit(129)
  }
  if (argv.includes('--staged')) return 'staged'
  if (argv.includes('--worktree')) return 'worktree'
  return 'head'
}

async function main(argv) {
  const args = argv.slice(2)
  for (const f of args) {
    if (!f.startsWith('-')) continue
    const name = f.split('=')[0]
    if (!ALLOWED_FLAGS.has(name)) {
      process.stderr.write(
        `用法错:未知开关 ${f}(白名单:${[...ALLOWED_FLAGS].join(' ')});拒绝按默认档跑\n`,
      )
      return 129
    }
  }
  const rootIdx = args.indexOf('--root')
  const root = rootIdx >= 0 && args[rootIdx + 1] ? resolve(args[rootIdx + 1]) : DEFAULT_ROOT
  if (args.includes('--help') || args.includes('-h')) {
    console.log(
      '用法: node scripts/provenance-ledger.mjs [--check|--report|--self-test] [--staged|--worktree] [--root <dir>]\n' +
        '  --check     零副作用判定(默认)。全量判 HEAD blob,--staged 判索引 blob\n' +
        '  --report    人读盘点:台账条目数 / P2 候选面 / 待补登记清单\n' +
        '  --self-test 真临时 git 仓取证(含阳性对照 + 棘轮四向 + 面隔离变异)\n' +
        '退出码: 0 通过 / 1 违规 / 2 无法判定 / 129 用法错',
    )
    return 0
  }
  if (args.includes('--self-test')) return selfTest()
  const face = resolveFace(args)
  try {
    const result = runCheck(root, face)
    if (face === 'staged') {
      const final = ratchetStaged(root, result)
      result.violations = final.violations
      result.notices = final.notices
    }
    console.log(report(result, face))
    return result.violations.length > 0 ? 1 : 0
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`[provenance-ledger] ⚠️ 无法判定:${e.message}`)
      return 2
    }
    console.error(`[provenance-ledger] 脚本自身异常(不按判据失败处理):${e?.stack ?? e}`)
    return 2
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main(process.argv).then((code) => {
    if (code !== 0) process.exit(code)
  })
}

export const __test__ = {
  runCheck,
  ratchetStaged,
  makeReader,
  checkText,
  checkRevision,
  checkOverrideLedger,
  hasThirdPartyNotice,
  isOwnLine,
  carriesOurAttribution,
  coveredByRoots,
  requireFields,
  sha256,
  Undetermined,
  LEDGER_DIR,
  LEDGER_FILES,
  NOTICE_LINE_RE,
  VENDOR_DIR_RE,
  NOTICE_HEADER_WINDOW_LINES,
  OWN_TOKENS,
  OWN_BANNER_STRUCT_TOKENS,
  OWN_COPYRIGHT_RE,
  ZW_PAYLOAD_RE,
  FACES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
