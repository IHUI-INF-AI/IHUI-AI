#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 盘根残留隔离看门人 —— **影子版**(shadow,2026-10-15 立)。
 *
 * 要接班的现状:`check-disk-root-hygiene.mjs` 判"盘根一红"⇒ git-guardian 巡检 ⇒ 到人,
 * 而成因未除时它会每 4 小时发一封同因告警(本仓实测 27 封同因信的教训记在那把尺子的头注里)。
 * 终局设计是把"盘根一红就发信"升级为"自动隔离 + 台账待人工裁决";本期只建**影子能力**:
 * 同一份判据、同一套扫描,输出"将会移动什么 / 只报未动什么及原因",供人工逐条核对。
 *
 * 影子期纪律(本期刻意不做的):
 *   · 不实现 `--apply` —— 命令行收到它直接 exit 2 并说明原因;
 *   · 不接 git-guardian 自愈链、不改 AUTO_HEAL_LEDGER、不进任何自动处置通道;
 *   · 绝不删除、绝不 rename:`--check` / `--dry-run` 全程只读,连隔离目录都不创建
 *     (源码级镜像锁:四个文件系统写 API 在本文件零出现,镜像测试逐字锁);
 *   · 不动 allowlist、不动 `check-disk-root-hygiene.mjs`。
 * 升级到 `--apply` + 守护接线的前置条件(设计规格原文):**连续 ≥1 周 would-move 清单与
 * 人工判定零分歧**。分歧不为零就说明判据还有牙没长对,那时进自动隔离等于把误判自动化。
 *
 * 判据来源(§22c 单一真相源,本文件**不抄第二套**):
 *   · 白名单/盘根枚举/派生豁免/键形归一 —— `auditDiskRoot` / `deriveSanctioned` /
 *     `normalizeRootKey` / `currentDriveRoot` 全部 import 自
 *     `scripts/check-disk-root-hygiene.mjs`(那把手心"H1/H2 判据"的唯一实现处);
 *   · porcelain —— `scripts/lib/face-reader.mjs` 的 `gitRaw`(绝对路径 git + 显式 stdio
 *     + 数字 timeout,不拿裸 'git' 上 PATH 赌命);
 *   · 真 gitdir —— `scripts/lib/gitdir.mjs` 的 `resolveGitdir`;
 *   · 隔离区根 —— `scripts/seal-c-root-stray.mjs` 的 `devEnvRoot()`(按工作树所在盘
 *     运行时推导,不写死盘符;G-345④ 之后"向上数两级"是禁句);
 *   · AGENTS.md 水印行识别 —— `scripts/lib/watermark-lines.mjs` 的 `isBannerLine`。
 *
 * 八条件(全部满足才"将会移动";任一不满足或判不了 ⇒ 列入"只报未动"并给出原因;
 * 判据次序即报告优先级,短路在第一条失败上 —— 便宜的先判,贵的(目录走树)最后判):
 *   1. 盘根一级条目(扫"工作树盘 ∪ 已申报且存在的盘",机器无关枚举);
 *   2. 非白名单(config allow,含 `deriveSanctioned` 派生层的路径豁免);
 *   3. 非 git 登记 worktree(`git worktree list --porcelain` 全集路径比对 —— 多会话
 *      在飞的不能动);
 *   4. 非硬保护集(§5b 禁删项):porcelain 首条(= git 契约的主工作树)、`resolveGitdir()`
 *      本体及其 `.broken-*` 同胞、`*.git-backup-*`、`DevEnv`、`basename(REPO_ROOT)` 精确同名;
 *   5. 非新鲜(可能在飞):条目 mtime/ctime 老于 `FRESH_WINDOW`(默认 24h,env
 *      `QUARANTINE_FRESH_HOURS` 可调),且深度 ≤2 / 文件数 ≤2000 的有界浅扫取最新 mtime
 *      一并老于窗口;浅扫被截断或有不可读子目录 ⇒ 证不了"旧" ⇒ 不动;
 *   6. 可识别为项目产物:名模式(`IHUI-AI*` 但非精确 `IHUI-AI`、`ihui-*`、`*.git-backup-*`)
 *      且内容标记至少一项(`.git` gitfile 指向项目 gitdir / `pnpm-workspace.yaml` /
 *      `refs-manifest.json` / `AGENTS.md` 含水印行);只名命中无内容确认 ⇒ 不识别 ⇒ 不动;
 *   7. 同卷(条目盘符 == 隔离根盘符;跨卷只报 —— rename 跨卷会退化成复制+删除,本期不做);
 *   8. 非 reparse point(`lstatSync` 判 junction/symlink 不动;§26 穿透事故同型)。
 *
 * 用法:
 *   node scripts/quarantine-disk-root-strays.mjs --check              只读扫描(人读)
 *   node scripts/quarantine-disk-root-strays.mjs --check --json       只读扫描(机器可读)
 *   node scripts/quarantine-disk-root-strays.mjs --dry-run            同 --check,另打印
 *      预演路径与逐条 `move` 恢复命令(仍零副作用)
 *   node scripts/quarantine-disk-root-strays.mjs --self-test          判据取证(夹具端到端)
 *   --apply **不存在**:传了即 exit 2(影子版刻意不接线自动处置)
 * 测试通道:--root <dir>(替身盘根)、--wt-file <file>(替身 porcelain)、--config <file>、
 *   --devenv <dir>(替身隔离根,构造跨卷反例)、--now <ISO>(替身判据时钟,构造"旧"反例)。
 *   生产档与测试档共用同一个 `quarantineScan()`,差别只在输入来源。
 *
 * 退出码(同 `seal-c-root-stray.mjs` 惯例):
 *   0 = 无可办(wouldMove / onlyReport / undetermined 三桶皆空);
 *   1 = 有需人工关注项(任一桶非空 —— 含"只报未动"与"未判定";把"没判"报成 0 是本仓
 *       最高频失效型,故未判定同样计 1);
 *   2 = 自身异常(含收到 --apply)。
 *
 * 幂等设计(为将来 --apply 做准备,现在就能证):
 *   · 扫描是 (盘面, 时钟, 配置, porcelain) 的纯函数 —— 同输入同输出(自检与镜像测试
 *     各锁一条"重跑同形");
 *   · 预演路径含**每轮一个**的 UTC 批次戳(文件名禁 ':' ⇒ 紧凑形 `YYYYMMDDTHHMMSSZ`),
 *     重跑落新批次,不覆盖上一轮;原条目已不在盘根(被搬走)就不会再被枚举 ⇒ 无二次搬移;
 *   · 将来 --apply 遇目标已存在(同秒双跑)必须拒搬或加后缀,遇 EPERM/EBUSY 只记录不删除。
 */
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, parse, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
// 判据只此一份(§22c):盘根枚举/白名单/派生豁免/键形归一全部来自那把"盘根卫生"尺子,
// 本文件再写一套指针/gitdir 推导就是两处实现必漂移。
import {
  auditDiskRoot,
  currentDriveRoot,
  deriveSanctioned,
  normalizeRootKey,
} from './check-disk-root-hygiene.mjs'
import { devEnvRoot } from './seal-c-root-stray.mjs'
import { gitRaw } from './lib/face-reader.mjs'
import { resolveGitdir } from './lib/gitdir.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { isBannerLine } from './lib/watermark-lines.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')

/** 默认新鲜窗 24h。"可能在飞"不是洁癖:多会话并行时,刚落盘的目录很可能正被谁写着。 */
export const DEFAULT_FRESH_HOURS = 24
/** 新鲜度浅扫的两条硬闸(规格原文):深度 ≤2、文件数 ≤2000。超限即"没看完",不得当成"看完了"。 */
export const FRESH_SCAN_MAX_DEPTH = 2
export const FRESH_SCAN_MAX_FILES = 2000
/** 体积走树的上限(只对 wouldMove 候选付这份成本):超限报 sizeComplete:false,不猜。 */
const SIZE_WALK_MAX_FILES = 100_000
/** AGENTS.md 的水印横幅恒在文件头 ⇒ 有界读就够,不为一个标记把整份大文件拖进内存。 */
const AGENTS_HEAD_BYTES = 8 * 1024
/** porcelain 派生的超时(与 check-disk-root-hygiene 同档)。 */
const WORKTREE_GIT_TIMEOUT_MS = 60_000

const CONFIG_REL = join('config', 'disk-root-allowlist.json')

/** 项目产物名模式(规格原文)。精确 `IHUI-AI` 是主仓本体,刻意排除 —— 它由条件 4 兜。 */
const PROJECT_NAME_RES = [/^ihui-ai/i, /^ihui-/i, /\.git-backup-/i]
/** 内容标记的四种取证(规格原文)。只名命中无内容确认 ⇒ 不识别。 */
const CONTENT_MARKER_FILES = ['pnpm-workspace.yaml', 'refs-manifest.json']

/** 只报未动的原因 ⇒ 人读文案。键名是稳定 API(镜像测试与将来台账都认它,不改写)。 */
export const REASON_TEXT = {
  reparse: '是 junction/符号链接(重解析点)—— §26 同型教训:不穿透、不移动',
  statFailed: 'lstat 失败,形态判不了 ⇒ 不动',
  mainWorktree: 'porcelain 首条 = git 契约的主工作树(§5b 禁删项)',
  gitdirProtected: '就是 resolveGitdir() 的真 gitdir(§5b 禁删项)',
  gitdirBrokenSibling: 'gitdir 的 .broken-* 同胞(现场归档,§5b 禁删项)',
  gitBackupProtected: '*.git-backup-* = gitdir 备份源(§5b 禁删项)',
  devEnvProtected: 'DevEnv(§15b 唯一备份/缓存/临时物根)',
  repoBaseNameProtected: '与 basename(REPO_ROOT) 精确同名(项目主仓本体)',
  worktreeRegistered: 'git worktree list --porcelain 登记在册 —— 多会话在飞的不能动',
  worktreeRegistryUnavailable: 'porcelain 取不到 ⇒ 判不了"是否登记在册",不动',
  crossVolume: '与隔离根不同卷 —— rename 跨卷会退化成复制+删除,本期只报',
  sanctionedLayerUnavailable: 'deriveSanctioned() 派生层算不出 ⇒ 判不了白名单,不动',
  unidentified:
    '名字像项目物但无任何内容标记(.git gitfile / pnpm-workspace.yaml / refs-manifest.json / AGENTS.md 水印)',
  fresh: '新鲜窗口内有写入(可能在飞)',
  freshnessEvidenceIncomplete: '新鲜度浅扫被截断或有不可读子目录 ⇒ 证不了"旧",不动',
}

// ─────────────────────────────────────────────────────────────────────────────
// 纯函数层(构造面可证)
// ─────────────────────────────────────────────────────────────────────────────

/** 机械归一(不是判据):统一正斜杠、去尾分隔符。派生层的 exempt/prefixes 两种盘符形态都有,必须先穿它。 */
function normPath(p) {
  return String(p).replace(/\\/g, '/').replace(/\/+$/, '')
}

/** 平台感知的路径同义(Windows 大小写不敏感;junction 已由条件 8 前置排除,这里只比字面)。 */
function samePath(a, b) {
  const na = normPath(a)
  const nb = normPath(b)
  return process.platform === 'win32' ? na.toLowerCase() === nb.toLowerCase() : na === nb
}

/** p 等于 base 或落在 base 之内(穿过的路径都已归一)。 */
function isUnderOrEqual(p, base) {
  const np = normPath(p)
  const nb = normPath(base)
  if (process.platform === 'win32') {
    const lower = np.toLowerCase()
    const lb = nb.toLowerCase()
    return lower === lb || lower.startsWith(lb + '/')
  }
  return np === nb || np.startsWith(nb + '/')
}

/** 盘根键形:一律走 sibling 那一份 `normalizeRootKey`(盘符大写、尾分隔符归一),不本地再抄。 */
function driveRootOf(p) {
  return normalizeRootKey(parse(resolve(p)).root)
}

/**
 * 新鲜窗(毫秒)。env `QUARANTINE_FRESH_HOURS` 可调;给个非正数直接抛 —— 一个静默失效的
 * 窗口会让"可能在飞"这一维永远绿,比没有窗口坏。
 */
export function freshWindowMs(env = process.env) {
  const raw = String(env.QUARANTINE_FRESH_HOURS ?? '').trim()
  if (raw === '') return DEFAULT_FRESH_HOURS * 3_600_000
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0)
    throw new Error(`QUARANTINE_FRESH_HOURS 必须是正数(小时),实得 ${JSON.stringify(raw)}`)
  return n * 3_600_000
}

/**
 * porcelain 文本 ⇒ 登记面路径集合 + 首条(= git 契约的主工作树)。
 * 块切分与 `auditWorktreeRegistry` 同形;这里只做**路径提取**,不做落点判决
 * (那套判决在 sibling 尺子里,本工具问的是另一个问题:"这个盘根条目是不是登记在册")。
 */
export function parsePorcelain(text) {
  const blocks = String(text ?? '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
  const paths = []
  for (const block of blocks) {
    const m = block.match(/^worktree\s+(.+)$/m)
    if (m) paths.push(normPath(m[1]))
  }
  return { main: paths.length ? paths[0] : null, paths: new Set(paths) }
}

/** 名模式命中 ⇒ 返回模式名(取证用);未命中 ⇒ null(出界:不是项目产物,交由 H1 尺子管)。 */
export function matchesProjectName(name) {
  const n = String(name)
  if (n.toLowerCase() === 'ihui-ai') return null // 精确同名 = 主仓本体,条件 4 的活
  for (const re of PROJECT_NAME_RES) if (re.test(n)) return String(re)
  return null
}

/** 有界读文件头(水印横幅恒在头部;不为一个标记把巨型文件拖进内存)。 */
function readHead(p, bytes) {
  const fd = openSync(p, 'r')
  try {
    const buf = Buffer.alloc(bytes)
    const { bytesRead } = readSync(fd, buf, 0, bytes, 0)
    return buf.toString('utf8', 0, bytesRead)
  } finally {
    closeSync(fd)
  }
}

function isFile(p) {
  try {
    return lstatSync(p).isFile()
  } catch {
    return false
  }
}

/**
 * 内容标记取证(条件 6 的后半)。`gitdirNorm` 取不到时,gitfile 那一项**不**算确认 ——
 * "指向项目 gitdir"验不了就是没验,不得因为"长得像"就放行。
 */
export function contentMarkers(entryPath, gitdirNorm) {
  const markers = []
  try {
    const dotGit = join(entryPath, '.git')
    if (isFile(dotGit)) {
      const m = readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+)$/im)
      const target = m ? normPath(m[1].trim()) : null
      // 主 gitdir 或其下的 worktrees/<name> 级都算"指向项目 gitdir"
      if (target && gitdirNorm && (samePath(target, gitdirNorm) || isUnderOrEqual(target, gitdirNorm)))
        markers.push('gitfile-points-project-gitdir')
    }
  } catch {
    /* 读不到 = 没这个标记,由其它标记或 unidentified 收口 */
  }
  for (const f of CONTENT_MARKER_FILES) if (isFile(join(entryPath, f))) markers.push(f)
  try {
    const head = readHead(join(entryPath, 'AGENTS.md'), AGENTS_HEAD_BYTES)
    if (head && head.split(/\r?\n/).some(isBannerLine)) markers.push('agents-md-watermark')
  } catch {
    /* 同上 */
  }
  return markers
}

/**
 * 新鲜度浅扫(条件 5 的后半):entry 的直接子层 + 孙层内取最新 mtime。
 * 三条硬闸全是"没看完 ≠ 看完了":深度 ≤2、文件数 ≤2000、**不穿重解析点**;
 * 截断或遇不可读子目录都由调用方折成"证不了旧",不折成"旧"。
 * @returns {{newest:number|null, files:number, truncated:boolean, unreadable:string[]}}
 */
export function newestMtimeScan(entryPath, opts = {}) {
  const maxDepth = opts.maxDepth ?? FRESH_SCAN_MAX_DEPTH
  const maxFiles = opts.maxFiles ?? FRESH_SCAN_MAX_FILES
  const unreadable = []
  let newest = null
  let files = 0
  let truncated = false
  const walk = (dir, depth) => {
    if (truncated) return
    let dirents
    try {
      dirents = readdirSync(dir, { withFileTypes: true })
    } catch (e) {
      unreadable.push(`${dir} :: ${(e && e.code) || String(e)}`)
      return
    }
    for (const d of dirents) {
      if (d.isSymbolicLink()) continue // 不穿链接(§26 穿透事故同型)
      const p = join(dir, d.name)
      if (d.isDirectory()) {
        if (depth < maxDepth) walk(p, depth + 1)
        continue
      }
      if (!d.isFile()) continue
      files += 1
      try {
        const st = statSync(p)
        if (newest === null || st.mtimeMs > newest) newest = st.mtimeMs
      } catch (e) {
        unreadable.push(`${p} :: ${(e && e.code) || String(e)}`)
      }
      if (files >= maxFiles) {
        truncated = true
        return
      }
    }
  }
  walk(entryPath, 1)
  return { newest, files, truncated, unreadable }
}

/** 递归体积(只对 wouldMove 候选付这份成本)。超上限 ⇒ complete:false,绝不报一个假装完整的数。 */
export function dirSizeScan(entryPath, opts = {}) {
  const maxFiles = opts.maxFiles ?? SIZE_WALK_MAX_FILES
  let bytes = 0
  let files = 0
  let complete = true
  const stack = [entryPath]
  while (stack.length) {
    const dir = stack.pop()
    let dirents
    try {
      dirents = readdirSync(dir, { withFileTypes: true })
    } catch {
      complete = false
      continue
    }
    for (const d of dirents) {
      if (d.isSymbolicLink()) continue
      const p = join(dir, d.name)
      if (d.isDirectory()) {
        stack.push(p)
        continue
      }
      if (!d.isFile()) continue
      files += 1
      try {
        bytes += statSync(p).size
      } catch {
        complete = false
      }
      if (files > maxFiles) return { bytes, files, complete: false }
    }
  }
  return { bytes, files, complete }
}

/**
 * 隔离批次戳:紧凑 UTC 形。**冒号必须去掉** —— Windows 文件名禁 ':',一个建不出来的
 * 批次目录会让将来 --apply 在第一项上就 EINVAL。
 */
export function quarantineStamp(now = new Date()) {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
}

/**
 * 预演路径与恢复命令(纯函数,不碰盘)。形状(规格原文):
 *   `<DevEnv>/Temp/disk-root-quarantine/<UTC戳>/<盘符>/<原名>/`
 * `<盘符>` 只取字母(冒号在 Windows 路径里非法)。恢复命令逐条给出 `move` 回原位。
 */
export function planQuarantinePath(itemPath, { quarantineRoot, stamp }) {
  const drive = driveRootOf(itemPath).replace(/[\\/:]/g, '')
  const name = basename(itemPath)
  const target = join(quarantineRoot, 'Temp', 'disk-root-quarantine', stamp, drive, name)
  return { target, drive, name, restore: `move "${target}" "${itemPath}"` }
}

// ─────────────────────────────────────────────────────────────────────────────
// 判定层
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 条件 4 硬保护集(§5b 禁删项 + §15b 外置根)。抽成纯函数是为了让**每条分支都可构造
 * 证明** —— 其中 `DevEnv` / 精确 `IHUI-AI` 两条在名字管道里结构不可达(名模式刻意排除
 * 它们,它们本就该在更早一层出界),但规格要求它们在硬保护集里,分支存在就必须有牙。
 */
export function hardProtectionReason(name, path, ctx) {
  if (ctx.porcelain && ctx.porcelain.main && samePath(ctx.porcelain.main, path)) return 'mainWorktree'
  if (ctx.gitdirNorm) {
    if (samePath(ctx.gitdirNorm, path)) return 'gitdirProtected'
    if (name.startsWith(basename(ctx.gitdirNorm) + '.broken-')) return 'gitdirBrokenSibling'
  }
  if (/\.git-backup-/i.test(name)) return 'gitBackupProtected'
  if (name === 'DevEnv') return 'devEnvProtected'
  if (name === ctx.repoBaseName) return 'repoBaseNameProtected'
  return null
}

/**
 * 单条目八条件判定。返回:
 *   {status:'wouldMove', evidence}     八条全过
 *   {status:'onlyReport', reasons}     任一不过/判不了(reasons 非空)
 *   {status:'skip', skip}              压根不是候选(白名单/派生层/名字出界)
 *
 * 次序即优先级(便宜的先判,走树的最后判):reparse → 硬保护 → 登记 worktree → 跨卷 →
 * 派生层 → 可识别 → 新鲜。短路在第一条失败 —— 人读报告要的是"最先拦住它的那条"。
 */
export function evaluateEntry(entryPath, ctx) {
  const name = basename(entryPath)
  const pattern = matchesProjectName(name)
  if (!pattern) return { status: 'skip', skip: 'outOfScope' }

  const derived = ctx.derived
  if (!derived) return { status: 'onlyReport', reasons: ['sanctionedLayerUnavailable'] }
  const exempt = (derived.exempt ?? []).map(normPath)
  const prefixes = (derived.prefixes ?? []).map(normPath)
  if (exempt.some((e) => samePath(e, entryPath)) || prefixes.some((pre) => isUnderOrEqual(entryPath, pre)))
    return { status: 'skip', skip: 'sanctionedPath' }

  // ⑧ 重解析点(junction/symlink):先判它,后面的走树才不会穿透到别的现场
  let st = null
  try {
    st = lstatSync(entryPath)
  } catch {
    return { status: 'onlyReport', reasons: ['statFailed'] }
  }
  if (st.isSymbolicLink()) return { status: 'onlyReport', reasons: ['reparse'] }

  // ④ 硬保护集(§5b 禁删项 + §15b 外置根)
  const protection = hardProtectionReason(name, entryPath, ctx)
  if (protection) return { status: 'onlyReport', reasons: [protection] }

  // ③ git 登记 worktree(取不到登记面 ⇒ 判不了 ⇒ 不动)
  if (!ctx.porcelain) return { status: 'onlyReport', reasons: ['worktreeRegistryUnavailable'] }
  if ([...ctx.porcelain.paths].some((p) => samePath(p, entryPath)))
    return { status: 'onlyReport', reasons: ['worktreeRegistered'] }

  // ⑦ 同卷(跨卷只报)
  if (driveRootOf(entryPath) !== driveRootOf(ctx.quarantineRoot))
    return { status: 'onlyReport', reasons: ['crossVolume'] }

  // ⑥ 可识别为项目产物(名已命中;此处要内容确认)
  const markers = contentMarkers(entryPath, ctx.gitdirNorm)
  if (markers.length === 0) return { status: 'onlyReport', reasons: ['unidentified'] }

  // ⑤ 非新鲜:条目自身 mtime/ctime(Windows 上 ctime 即创建时间 —— 复制进来的目录
  //    mtime 可以造假,创建时间假不了,这正是"可能在飞"要的那一维)+ 有界浅扫
  const entryNewest = Math.max(st.mtimeMs, st.ctimeMs)
  const cutoff = ctx.now.getTime() - ctx.freshMs
  const scan = newestMtimeScan(entryPath)
  const newestOverall = Math.max(entryNewest, scan.newest ?? -Infinity)
  if (newestOverall >= cutoff) return { status: 'onlyReport', reasons: ['fresh'] }
  if (scan.truncated || scan.unreadable.length > 0)
    return { status: 'onlyReport', reasons: ['freshnessEvidenceIncomplete'] }

  const size = dirSizeScan(entryPath)
  return {
    status: 'wouldMove',
    evidence: {
      namePattern: pattern,
      markers,
      ageHours: Math.round(((ctx.now.getTime() - entryNewest) / 3_600_000) * 10) / 10,
      newestFileAgeHours:
        scan.newest === null ? null : Math.round(((ctx.now.getTime() - scan.newest) / 3_600_000) * 10) / 10,
      scannedFiles: scan.files,
      sizeBytes: size.bytes,
      sizeComplete: size.complete,
      gitdir: ctx.gitdirNorm,
    },
  }
}

/**
 * 主扫描(生产与测试共用)。输入全部显式:
 *   configPath      配置文件路径(缺省 = 仓内 config/disk-root-allowlist.json)
 *   root            --root 测试通道的替身盘根(缺省 = 工作树盘 ∪ 已申报且存在的盘)
 *   porcelain       字符串 = 用这份登记面(--wt-file);null = 登记面取不到;
 *                   undefined = 现读 `git worktree list --porcelain`
 *   quarantineRoot  隔离区根(缺省 = devEnvRoot(),运行时按工作树盘推导)
 *   freshHours/now  新鲜窗与判据时钟(自检可注入,求确定性)
 */
export function quarantineScan(opts = {}) {
  const now = opts.now ?? new Date()
  const freshMs = (opts.freshHours ?? DEFAULT_FRESH_HOURS) * 3_600_000
  const configPath = opts.configPath ? resolve(opts.configPath) : join(REPO_ROOT, CONFIG_REL)
  const quarantineRoot = opts.quarantineRoot ? resolve(opts.quarantineRoot) : devEnvRoot()
  const stamp = quarantineStamp(now)
  const wouldMove = []
  const onlyReport = []
  const undetermined = []
  const skipped = { allowlisted: 0, sanctionedPath: 0, outOfScope: 0 }
  const rootsMeta = []

  let config = null
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch (e) {
    undetermined.push({ root: CONFIG_REL, why: `配置读不出(${configPath}): ${(e && e.message) || e}` })
    return { wouldMove, onlyReport, undetermined, meta: { roots: rootsMeta, skipped } }
  }

  // 登记面:--wt-file 是人工夹具(字符串),生产档现读;null = 取不到(判不了 ⇒ 不动)
  let porcelainText
  let porcelainSource
  if (opts.porcelain === undefined) {
    porcelainSource = 'git'
    try {
      porcelainText = gitRaw(['worktree', 'list', '--porcelain'], REPO_ROOT, {
        timeout: WORKTREE_GIT_TIMEOUT_MS,
      })
    } catch {
      porcelainText = null
    }
  } else {
    porcelainSource = opts.porcelain === null ? 'unavailable' : 'file'
    porcelainText = opts.porcelain
  }
  const porcelain = porcelainText === null ? null : parsePorcelain(porcelainText)
  if (!porcelain)
    undetermined.push({
      root: '(worktree 登记面)',
      why: 'git worktree list 取不到 ⇒ 条件 3 判不了,本轮不判 wouldMove',
    })

  // 派生层(白名单第二层 + 硬保护的 gitdir 基准)。算不出 ⇒ 不猜,逐条落"判不了"。
  const derived = deriveSanctioned()
  if (!derived)
    undetermined.push({
      root: '(派生合法落点)',
      why: 'deriveSanctioned() 算不出(resolveGitdir 不可用)⇒ 白名单派生层与 gitdir 硬保护判不了,本轮不判 wouldMove',
    })
  let gitdirNorm = null
  try {
    const gitdir = resolveGitdir()
    gitdirNorm = gitdir ? normPath(gitdir) : null
  } catch {
    gitdirNorm = null
  }

  // 扫哪些盘根:测试通道只扫替身;生产档 = 已申报且存在的盘 ∪ 本机仓根所在盘
  let roots
  if (opts.root) {
    roots = [resolve(opts.root)]
  } else {
    const declared = Object.keys(config.roots ?? {}).map(normalizeRootKey)
    const here = currentDriveRoot()
    const all = [...new Set([...declared, ...(here ? [here] : [])])]
    roots = []
    for (const r of all) {
      let present = false
      try {
        present = existsSync(r) && statSync(r).isDirectory()
      } catch {
        present = false
      }
      if (present) roots.push(r)
      // 已申报而本机没有这块盘:单独报名(不混进"未判定"——那是另一台机的申报,
      // 不是本机没看清;也不并进"已判干净")。
      else rootsMeta.push({ root: r, declared: true, status: 'absent' })
    }
  }

  const repoBaseName = basename(REPO_ROOT)
  for (const root of roots) {
    let readable = false
    try {
      readable = existsSync(root) && statSync(root).isDirectory()
    } catch {
      readable = false
    }
    if (!readable) {
      undetermined.push({ root, why: '盘根不可读(不存在或不是目录)' })
      rootsMeta.push({ root, declared: false, status: 'unreadable' })
      continue
    }
    const rootKey = normalizeRootKey(root)
    const declared = Object.prototype.hasOwnProperty.call(config.roots ?? {}, rootKey)
    // 生产档:未申报 ≠ 无违规,只能落"未判定"(与 sibling 尺子同一条哲学);
    // --root 测试档:未申报按空白名单判(夹具通道;刻意不做 sibling 那种"替身全量放行" ——
    // 那会让每条 wouldMove 候选先被白名单吃掉,正例永远证不出来)。
    const allow = declared ? (config.roots[rootKey].allow ?? []) : opts.root ? [] : null
    if (allow === null) {
      undetermined.push({
        root,
        why: '该盘根未在 config 申报 ⇒ 白名单维度未判定(出口:向 config/disk-root-allowlist.json 增补该盘并随 commit 审批)',
      })
      rootsMeta.push({ root, declared: false, status: 'undetermined' })
      continue
    }
    rootsMeta.push({ root, declared, status: 'scanned' })

    let audit
    try {
      audit = auditDiskRoot(root, allow)
    } catch (e) {
      undetermined.push({ root, why: `枚举盘根失败: ${(e && e.message) || e}` })
      continue
    }
    for (const u of audit.undetermined) undetermined.push({ root: u.root ?? root, why: u.why })
    let entryCount = audit.violations.length
    try {
      entryCount = readdirSync(root).length
    } catch {
      /* 枚举失败已由 audit 报过;这里只为白名单计数,取不到就只数违规条数 */
    }
    skipped.allowlisted += Math.max(0, entryCount - audit.violations.length)

    for (const v of audit.violations) {
      const verdict = evaluateEntry(v.path, {
        now,
        freshMs,
        porcelain,
        derived,
        gitdirNorm,
        quarantineRoot,
        repoBaseName,
      })
      if (verdict.status === 'skip') {
        skipped[verdict.skip] += 1
        continue
      }
      if (verdict.status === 'wouldMove') {
        // 形状(规格原文):{path, sizeBytes, evidence} —— sizeBytes 在顶层,消费侧
        // (将来台账/守护)不必翻进 evidence 找它;体积是否计全由 evidence.sizeComplete 交代。
        wouldMove.push({
          path: v.path,
          sizeBytes: verdict.evidence.sizeBytes,
          evidence: verdict.evidence,
        })
      } else onlyReport.push({ path: v.path, reasons: verdict.reasons })
    }
  }

  return {
    wouldMove,
    onlyReport,
    undetermined,
    meta: {
      mode: opts.mode ?? 'check',
      quarantineRoot,
      freshWindowHours: freshMs / 3_600_000,
      stamp,
      roots: rootsMeta,
      skipped,
      porcelain: porcelainSource,
      derivedAvailable: !!derived,
      counts: { wouldMove: wouldMove.length, onlyReport: onlyReport.length, undetermined: undetermined.length },
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 自检夹具(合成盘根,G-1059131:盘符运行时现取,不赌本机)
// ─────────────────────────────────────────────────────────────────────────────

export function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg)
  }
  const eq = (a, b, msg) => {
    if (a !== b) throw new Error(`${msg}:期望 ${JSON.stringify(b)},实得 ${JSON.stringify(a)}`)
  }
  // 不复用 node:assert —— 本自检的 assert 是消息定制的那一份;throws 单起一个,
  // 免得"assert.throws is not a function"这种自查 bug 被当成判据红(第一版踩过)。
  const throws = (fn, re, msg) => {
    try {
      fn()
    } catch (e) {
      if (!re.test(String((e && e.message) || e))) throw new Error(`${msg}:抛出的消息不含 ${re}`)
      return
    }
    throw new Error(`${msg}:该抛的没抛`)
  }
  const base = (arr, name) => arr.find((x) => basename(x.path) === name) ?? null

  const scratch = mkScratch('quar-st-')
  // 夹具必须活到用例**执行完**:用例是登记后统一跑的,写在 finally 里的清理会先于
  // 任何一条用例执行(seal-c-root-stray 自检里同一坑的注释),于是每个夹具路径在
  // 断言求值时已不存在 —— 那种全红红得莫名其妙。故整段(含用例执行)都在 try 内。
  try {
    const root = join(scratch, 'root')
    mkdirSync(root, { recursive: true })
    // gitdir 判据只此一份:夹具的 .git gitfile 指向**本机真项目 gitdir**(运行时现取)
    const gitdir = resolveGitdir()
    assert(!!gitdir, 'resolveGitdir() 在本机必须算得出(算不出来这条要红,不得静默跳过)')

    // 时钟通道(不碰盘上时间戳,全平台可证):判据时钟前移 1000h ⇒ 真实新建的夹具
    // 统统"老于窗口";"新鲜"反例则把 mtime 拨到判据时钟之后 48h(utimesSync 可设未来
    // 时间戳)。Windows 上 ctime 即创建时间、任何用户态 API 都回拨不了(实测),
    // 所以正/反两例都靠"相对判据时钟的年龄"说话,而不是靠改文件的出生时间。
    const shifted = new Date(Date.now() + 1000 * 3_600_000)
    const future = new Date(shifted.getTime() + 48 * 3_600_000)
    const mkEntry = (name, { fresh = false, markers = [] } = {}) => {
      const p = join(root, name)
      mkdirSync(p, { recursive: true })
      if (markers.includes('gitfile')) writeFileSync(join(p, '.git'), `gitdir: ${gitdir}\n`)
      if (markers.includes('workspace')) writeFileSync(join(p, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n")
      if (markers.includes('refs')) writeFileSync(join(p, 'refs-manifest.json'), '{ "refs": [] }\n')
      if (markers.includes('agents'))
        writeFileSync(
          join(p, 'AGENTS.md'),
          '<!--\n  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top\n-->\n\n# fixture\n',
        )
      if (fresh) {
        const when = future
        for (const f of [...CONTENT_MARKER_FILES, 'AGENTS.md', '.git']) {
          const fp = join(p, f)
          if (existsSync(fp)) utimesSync(fp, when, when)
        }
        utimesSync(p, when, when)
      }
      return p
    }

    mkEntry('ihui-head-check', { markers: ['gitfile', 'agents'] }) // ① 正例
    mkEntry('ihui-wt-live', { markers: ['workspace'] }) // ② 登记在册
    mkEntry('ihui-main-wt', { markers: ['refs'] }) // porcelain 首条
    mkEntry('ihui-fresh-now', { fresh: true, markers: ['workspace'] }) // ③ 新鲜
    mkEntry('ihui-name-only', { markers: [] }) // ④ 无内容标记
    mkEntry('ihui-cross-vol', { markers: ['workspace'] }) // ⑥ 跨卷(配替身隔离根)
    mkEntry('ihui-allowlisted', { markers: [] }) // 白名单(夹具 config 声明)
    mkEntry('DevEnv', { markers: ['workspace'] }) // 硬保护:DevEnv
    mkEntry('IHUI-AI.git-backup-20260912', { markers: ['workspace'] }) // 硬保护:git-backup
    mkEntry(`${basename(gitdir)}.broken-20261015T000000Z`, { markers: ['workspace'] }) // 硬保护:.broken-* 同胞
    mkEntry('not-a-project-stray', { markers: [] }) // 名字出界
    const jumpTarget = join(scratch, 'jump-target')
    mkdirSync(jumpTarget, { recursive: true })
    symlinkSync(jumpTarget, join(root, 'ihui-junction'), process.platform === 'win32' ? 'junction' : 'dir') // ⑤ 重解析点

    const wtFile = join(scratch, 'porcelain.txt')
    writeFileSync(
      wtFile,
      [
        `worktree ${join(root, 'ihui-main-wt')}`,
        'HEAD aaa',
        'branch refs/heads/main',
        '',
        `worktree ${join(root, 'ihui-wt-live')}`,
        'HEAD bbb',
        'detached',
        '',
      ].join('\n'),
    )
    const cfg = join(scratch, 'cfg.json')
    writeFileSync(
      cfg,
      JSON.stringify({
        roots: { [normalizeRootKey(root)]: { allow: ['ihui-allowlisted'], note: '夹具:只放行一条' } },
        worktreePolicy: { sanctionedPrefixes: [], exemptPaths: [] },
      }),
    )

    const baseOpts = {
      configPath: cfg,
      root,
      porcelain: readFileSync(wtFile, 'utf8'),
      quarantineRoot: devEnvRoot(),
      freshHours: DEFAULT_FRESH_HOURS,
      now: shifted,
    }
    const r1 = quarantineScan(baseOpts)
    const reasonOf = (r, name) => {
      const hit = base(r.onlyReport, name)
      return hit ? hit.reasons[0] : null
    }

    t('① 老于窗口 + .git gitfile 指向项目 gitdir ⇒ wouldMove(带取证)', () => {
      const names = r1.wouldMove.map((x) => basename(x.path)).sort()
      // 同卷下 ihui-cross-vol 也八条全过(它的跨卷反例在下一轮换隔离根才现身)——
      // 正例集是这两条,不是一条。
      eq(JSON.stringify(names), JSON.stringify(['ihui-cross-vol', 'ihui-head-check']), '同卷正例集')
      const wm = base(r1.wouldMove, 'ihui-head-check')
      assert(wm.evidence.markers.includes('gitfile-points-project-gitdir'), 'gitfile 标记必须在取证里')
      assert(wm.evidence.markers.includes('agents-md-watermark'), 'AGENTS.md 水印标记必须在取证里')
      assert(typeof wm.sizeBytes === 'number' && wm.sizeBytes > 0, 'wouldMove 必须带正体积')
      assert(wm.evidence.ageHours > DEFAULT_FRESH_HOURS, '取证里的年龄必须老于窗口')
    })
    t('② porcelain 登记在册的 worktree ⇒ onlyReport(worktreeRegistered)', () => {
      eq(reasonOf(r1, 'ihui-wt-live'), 'worktreeRegistered', '登记在册不得动')
    })
    t('②b porcelain 首条(= 主工作树) ⇒ onlyReport(mainWorktree)', () => {
      eq(reasonOf(r1, 'ihui-main-wt'), 'mainWorktree', 'git 契约的首条必须豁免')
    })
    t('③ 窗口内写入的可识别项 ⇒ onlyReport(fresh)', () => {
      eq(reasonOf(r1, 'ihui-fresh-now'), 'fresh', '窗口内的写入不能动')
    })
    t('④ 名字像项目物但无内容标记 ⇒ onlyReport(unidentified)', () => {
      eq(reasonOf(r1, 'ihui-name-only'), 'unidentified', '只名命中不得放行')
    })
    t('⑤ junction ⇒ onlyReport(reparse)', () => {
      eq(reasonOf(r1, 'ihui-junction'), 'reparse', '重解析点不穿透不移动')
    })
    t('硬保护:*.git-backup-* 走管道逐条只报;.broken-* 同胞在 separate-git-dir 布局下同证', () => {
      eq(reasonOf(r1, 'IHUI-AI.git-backup-20260912'), 'gitBackupProtected', 'gitdir 备份源禁删')
      // .broken-* 同胞要走管道,前提是"gitdir 同级名"本身命中项目名模式 —— 那只在
      // separate-git-dir 布局(gitdir = <wt>-git-repo,与仓同级、真落盘根)成立;常规
      // .git 布局下同胞名是 `.git.broken-*`,名模式不命中 ⇒ 结构上进不了管道(该分支
      // 由上面那条纯函数用例证明)。这里是结构性守卫,不是"挑好过的测"。
      const brokenName = `${basename(gitdir)}.broken-20261015T000000Z`
      if (matchesProjectName(brokenName)) {
        eq(reasonOf(r1, brokenName), 'gitdirBrokenSibling', '.broken-* 同胞禁删')
      } else {
        console.log(`     ⏭ .broken-* 管道级证明跳过:本机 gitdir 同级名(${brokenName})不命中项目名模式`)
      }
    })
    t('条件 4 硬保护集逐分支(纯函数;含名字管道结构不可达的两条防御性分支)', () => {
      const ctx = {
        porcelain: { main: 'X:/ihui-main-wt', paths: new Set(['X:/ihui-main-wt']) },
        gitdirNorm: 'X:/IHUI-AI-git-repo',
        repoBaseName: 'IHUI-AI',
      }
      eq(hardProtectionReason('ihui-main-wt', 'X:/ihui-main-wt', ctx), 'mainWorktree', 'porcelain 首条')
      eq(hardProtectionReason('IHUI-AI-git-repo', 'X:/IHUI-AI-git-repo', ctx), 'gitdirProtected', '真 gitdir')
      eq(
        hardProtectionReason('IHUI-AI-git-repo.broken-1', 'X:/IHUI-AI-git-repo.broken-1', ctx),
        'gitdirBrokenSibling',
        '.broken-* 同胞',
      )
      eq(hardProtectionReason('a.git-backup-1', 'X:/a.git-backup-1', ctx), 'gitBackupProtected', 'git-backup')
      // 下面两条在**名字管道里**结构不可达(名模式刻意排除 DevEnv 与精确 IHUI-AI),
      // 但规格要求它们在硬保护集里 ⇒ 分支存在就必须有牙,直接构造证明。
      eq(hardProtectionReason('DevEnv', 'X:/DevEnv', ctx), 'devEnvProtected', 'DevEnv 防御分支')
      eq(hardProtectionReason('IHUI-AI', 'X:/IHUI-AI', ctx), 'repoBaseNameProtected', '主仓同名防御分支')
      eq(hardProtectionReason('ihui-pg', 'X:/ihui-pg', ctx), null, '普通项不得被硬保护误伤')
    })
    t('白名单条目整个跳过(不进任何桶)', () => {
      assert(!base(r1.wouldMove, 'ihui-allowlisted') && !base(r1.onlyReport, 'ihui-allowlisted'), '白名单项不该出现')
      assert(r1.meta.skipped.allowlisted >= 1, 'meta 必须量到白名单跳过数')
    })
    t('名字不像项目物 ⇒ 出界(不进任何桶)', () => {
      assert(!base(r1.onlyReport, 'not-a-project-stray'), '非项目物不是本工具的候选')
      assert(r1.meta.skipped.outOfScope >= 1, 'meta 必须量到出界跳过数')
    })

    t('⑥ 跨卷(隔离根换结构性不同的盘符,G-1059131) ⇒ onlyReport(crossVolume)', () => {
      const fakeLetter = parse(root).root[0].toUpperCase() === 'Q' ? 'R' : 'Q'
      const r2 = quarantineScan({ ...baseOpts, quarantineRoot: `${fakeLetter}:${sep}fake-quarantine-root` })
      eq(reasonOf(r2, 'ihui-cross-vol'), 'crossVolume', '跨卷只报不搬')
    })
    t('porcelain 取不到 ⇒ 全条只报 + 未判定报名,wouldMove 必须为空', () => {
      const r3 = quarantineScan({ ...baseOpts, porcelain: null })
      eq(reasonOf(r3, 'ihui-head-check'), 'worktreeRegistryUnavailable', '登记面取不到时条件 3 判不了')
      eq(r3.wouldMove.length, 0, '判不了就不得出 wouldMove')
      assert(r3.undetermined.some((u) => /worktree/.test(u.why)), '未判定桶必须报名')
    })
    t('新鲜窗放大到 2000h ⇒ 同一夹具翻成 fresh(窗口可调有牙)', () => {
      const r4 = quarantineScan({ ...baseOpts, freshHours: 2000 })
      eq(reasonOf(r4, 'ihui-head-check'), 'fresh', '窗口放大后旧夹具必须翻新鲜')
      eq(r4.wouldMove.length, 0, '窗口内不得有 wouldMove')
    })
    t('freshWindowMs:env 非法值必须抛(静默失效的窗口比没有窗口坏)', () => {
      throws(() => freshWindowMs({ QUARANTINE_FRESH_HOURS: 'abc' }), /正数/, '非数字')
      throws(() => freshWindowMs({ QUARANTINE_FRESH_HOURS: '0' }), /正数/, '零窗')
      throws(() => freshWindowMs({ QUARANTINE_FRESH_HOURS: '-3' }), /正数/, '负窗')
      eq(freshWindowMs({}), DEFAULT_FRESH_HOURS * 3_600_000, '缺省窗')
      eq(freshWindowMs({ QUARANTINE_FRESH_HOURS: '6' }), 6 * 3_600_000, 'env 覆盖')
    })
    t('幂等:重跑同形(wouldMove/onlyReport 逐字一致)', () => {
      const r5 = quarantineScan(baseOpts)
      eq(JSON.stringify(r5.wouldMove), JSON.stringify(r1.wouldMove), 'wouldMove 必须可重放')
      eq(JSON.stringify(r5.onlyReport), JSON.stringify(r1.onlyReport), 'onlyReport 必须可重放')
    })
    t('零副作用:扫描不创建隔离目录(影子版连预演目录都不建)', () => {
      assert(!existsSync(join(devEnvRoot(), 'Temp', 'disk-root-quarantine')), '扫描/预演不得创建隔离批次目录')
    })
    t('预演路径形状 + 恢复命令(纯函数,可构造)', () => {
      const plan = planQuarantinePath(join('D:\\', 'ihui-head-check'), {
        quarantineRoot: 'D:\\DevEnv',
        stamp: '20261015T120000Z',
      })
      eq(plan.drive, 'D', '盘符只取字母(冒号在 Windows 路径非法)')
      assert(plan.target.includes('disk-root-quarantine') && plan.target.includes('20261015T120000Z'), `目标形状错:${plan.target}`)
      assert(/^move ".*" ".*"$/.test(plan.restore), `恢复命令形状错:${plan.restore}`)
      eq(quarantineStamp(new Date('2026-10-15T12:00:00Z')), '20261015T120000Z', '批次戳必须去冒号')
    })
    t('parsePorcelain:首条即主工作树,全集路径可比对', () => {
      const p = parsePorcelain('worktree D:/IHUI-AI\nHEAD a\n\nworktree D:/IHUI-AI\\.worktrees\\wt-x\nHEAD b\n\n')
      eq(p.main, 'D:/IHUI-AI', '首条')
      eq(p.paths.size, 2, '两条登记路径')
      assert(p.paths.has('D:/IHUI-AI/.worktrees/wt-x'), '分隔符必须归一后才可比对')
    })
    t('matchesProjectName:精确 IHUI-AI 排除,IHUI-AI* / ihui-* / *.git-backup-* 命中', () => {
      eq(matchesProjectName('IHUI-AI'), null, '主仓本体不得成名模式候选')
      assert(matchesProjectName('IHUI-AI-wt-abc'), 'IHUI-AI*')
      assert(matchesProjectName('ihui-pg'), 'ihui-*')
      assert(matchesProjectName('x.git-backup-1'), '*.git-backup-*')
      eq(matchesProjectName('pagefile.sys'), null, '普通条目出界')
    })
    t('newestMtimeScan:不穿重解析点 + 超限即 truncated(没看完 ≠ 看完了)', () => {
      const probe = join(scratch, 'scan-probe')
      mkdirSync(join(probe, 'sub'), { recursive: true })
      writeFileSync(join(probe, 'a.txt'), 'a')
      writeFileSync(join(probe, 'sub', 'b.txt'), 'b')
      symlinkSync(join(scratch, 'jump-target'), join(probe, 'link'))
      const r = newestMtimeScan(probe, { maxFiles: 1 })
      eq(r.truncated, true, '超文件数闸必须置 truncated')
      const r2 = newestMtimeScan(probe)
      eq(r2.files, 2, '只数真实文件,不穿链接')
      eq(r2.truncated, false, '不超限时不得截断')
    })

    // 用例执行必须在清理之前(见上方关于 finally 的注)
    let failed = 0
    for (const c of cases) {
      try {
        c.fn()
        console.log(`  ✅ ${c.name}`)
      } catch (e) {
        failed += 1
        console.log(`  ❌ ${c.name}\n      ${(e && e.message) || e}`)
      }
    }
    console.log(`\n自检:pass ${cases.length - failed} / fail ${failed}`)
    return failed ? 1 : 0
  } finally {
    rmScratch(scratch)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

function parseArgv(argv) {
  const out = { _: [] }
  // apply 必须在 BOOLS:它是影子版**显式拒任**的键。若按值参解析,末位 `--apply`
  // 会吃到 undefined 而静默降级成一次普通扫描(镜像测试 T6 钉住这个回归)。
  const BOOLS = new Set(['check', 'dry-run', 'json', 'self-test', 'apply'])
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      if (BOOLS.has(key)) out[key] = true
      else {
        out[key] = argv[i + 1]
        i++
      }
    } else out._.push(argv[i])
  }
  return out
}

function printHuman(result, mode) {
  const m = result.meta
  console.log('── 盘根残留隔离看门人(影子版,只读/预演,不移动任何东西)──')
  console.log(
    `模式:${mode} | 隔离根:${m.quarantineRoot} | 新鲜窗:${m.freshWindowHours}h | 登记面:${m.porcelain}` +
      ` | 派生层:${m.derivedAvailable ? '可用' : '不可用'}`,
  )
  console.log(`\n将会移动(${result.wouldMove.length}):`)
  for (const w of result.wouldMove) {
    const e = w.evidence
    console.log(
      `  📦 ${w.path}  ${(e.sizeBytes / 1048576).toFixed(1)}MB${e.sizeComplete ? '' : '(体积未计全)'}` +
        `  年龄 ${e.ageHours}h / 最新文件 ${e.newestFileAgeHours ?? '—'}h / 浅扫 ${e.scannedFiles} 文件`,
    )
    console.log(`     取证:名模式 ${e.namePattern} + 内容标记 [${e.markers.join(', ')}]`)
  }
  console.log(`\n只报未动(${result.onlyReport.length}):`)
  for (const o of result.onlyReport) {
    const why = o.reasons.map((r) => `${r} — ${REASON_TEXT[r] ?? '(未知原因)'}`).join(';')
    console.log(`  ⚠ ${o.path}\n     原因:${why}`)
  }
  console.log(`\n未判定(${result.undetermined.length}):`)
  for (const u of result.undetermined) console.log(`  ❓ ${u.root} —— ${u.why}`)
  const s = m.skipped
  console.log(
    `\n读数:wouldMove ${result.wouldMove.length} / onlyReport ${result.onlyReport.length} / 未判定 ${result.undetermined.length}` +
      ` | 跳过:白名单 ${s.allowlisted}、派生层 ${s.sanctionedPath}、名字出界 ${s.outOfScope}`,
  )
  if (mode === 'dry-run') {
    console.log(`\n预演(不会写任何文件;批次戳 ${m.stamp}):`)
    for (const w of result.wouldMove) {
      const plan = planQuarantinePath(w.path, { quarantineRoot: m.quarantineRoot, stamp: m.stamp })
      console.log(`  将会移入 ${plan.target}${sep}`)
      console.log(`    恢复:${plan.restore}`)
      console.log('    边界:rename 若遇 EPERM/EBUSY 只记录并原样保留,绝不删除(本期无 --apply)')
    }
    if (result.wouldMove.length === 0) console.log('  (无 wouldMove 项,无可预演)')
  }
  console.log('\n⇒ 影子版:判据供人工核对;--apply 与守护接线须经 shadow 期(连续 ≥1 周零分歧)后才进')
}

function main(argv) {
  const args = parseArgv(argv)
  if (args['self-test']) return selfTest()
  if (args.apply) {
    console.error('❌ 本期为影子版:--apply 未实现(设计上须经 shadow 期:连续 ≥1 周 would-move 清单与人工判定零分歧)')
    return 2
  }
  let now = new Date()
  if (args.now) {
    now = new Date(args.now)
    if (Number.isNaN(now.getTime())) {
      console.error(`❌ --now 不是合法时间:${args.now}(测试通道,形如 2026-10-15T12:00:00Z)`)
      return 2
    }
  }
  const mode = args['dry-run'] ? 'dry-run' : 'check'
  const freshMs = freshWindowMs()
  let porcelain
  if (args['wt-file']) {
    try {
      porcelain = readFileSync(resolve(args['wt-file']), 'utf8')
    } catch (e) {
      console.error(`❌ --wt-file 读不出(${args['wt-file']}): ${(e && e.message) || e}`)
      return 2
    }
  }
  const result = quarantineScan({
    configPath: args.config,
    root: args.root,
    porcelain,
    quarantineRoot: args.devenv,
    freshHours: freshMs / 3_600_000,
    now,
    mode,
  })
  if (args.json) {
    console.log(JSON.stringify(result))
  } else {
    printHuman(result, mode)
  }
  const { wouldMove, onlyReport, undetermined } = result
  return wouldMove.length || onlyReport.length || undetermined.length ? 1 : 0
}

// §22d 双形态入口:被 import(镜像测试/守护接线将来)时不跑 main,直接跑时才跑。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error('❌ 尺子自身异常:', (e && e.message) || e)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
