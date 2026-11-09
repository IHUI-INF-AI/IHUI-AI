// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * root-guard — 根护栏(O65 P0 · O6501,2026-10-25 立)。
 *
 * 保护的不是业务代码,是**规则自身**:守门执行器 / 判据单一真源 / AGENTS 全局铁律段。
 * 判据 = 清单内每条目标的规范化 sha256 与现盘一致;不一致时只有"与该新内容绑定的、
 * 未过期的人工解锁记录"才放行。其余一律 fail-closed —— 部署环读到非 0 退出码就拒绝推进。
 *
 * 纪律:
 *  - 取不到清单 / 清单形状坏 / 目标文件缺失 / 铁律段锚点找不到 ⇒ exit 2「未判定」,
 *    绝不回落成"没改动所以放行"(§0.3:没判绝不写成判过)。
 *  - 解锁不是"关闭护栏",而是"人已看过这次改动"的机读留痕:记录里绑定**新内容的 hash**
 *    与过期时刻;内容再变一次就重新判红。解锁必须给出理由,空理由拒写。
 *  - 哈希口径统一走 normalizeText(去 BOM / CRLF→LF / 统一结尾换行),避免同一内容在
 *    autocrlf 检出差异下被判成两个版本。
 *
 * 用法:
 *   node scripts/root-guard.mjs --check            # 部署环闸:0 通过 / 1 判红 / 2 未判定
 *                                                 # 默认闸面 = **HEAD**(刚被 ff 到、即将被构建与切流的
 *                                                 # 那一面,闸已后移到 ff 之后);取不到 ⇒ 未判定(§0.3)
 *   node scripts/root-guard.mjs --check --json
 *   node scripts/root-guard.mjs --check --against-rev <40位sha>   # 显式指定被审面(取证/人工复核)
 *   node scripts/root-guard.mjs --check --against-remote origin   # 同上,但由本器现读远端 main 的 sha
 *   node scripts/root-guard.mjs --status
 *   node scripts/root-guard.mjs --seal --reason "人工复核后重新封存"
 *   node scripts/root-guard.mjs --unlock --target agents-ironlaw --reason "..." [--ttl-min 120]
 *       # 注:默认闸面是 HEAD 而**不是** origin/main —— 生产机上那个嵌套 remote-tracking ref 会被宿主
 *       # 清理层吞掉、永不更新(见 main() 默认面那段的实证),读它就是读"好几次同步前"的那一面。
 *       # --against-rev / --against-remote 仅作取证 / 人工复核的显式覆盖。取不到被审面 ⇒ 未判定
 *       # (exit 2),绝不把"没判成"读成放行(§0.3)。
 *   node scripts/root-guard.mjs --self-test
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gitRaw } from './lib/face-reader.mjs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const MANIFEST_PATH = join(ROOT, 'scripts', 'data', 'root-guard-manifest.json')
/** 清单在 git 路径里的写法(正斜杠,跨面取材用;与 MANIFEST_PATH 同一条路径,不另立一份)。 */
export const MANIFEST_REL = 'scripts/data/root-guard-manifest.json'
export const UNLOCK_PATH = join(ROOT, '.ihui-agent', 'state', 'root-guard-unlocks.json')

export const EXIT_OK = 0
export const EXIT_DRIFT = 1
export const EXIT_UNKNOWN = 2

/** 目标清单形状(唯一真源在 manifest 内;此处只写"必须有哪几条",不写哈希)。 */
export const REQUIRED_TARGET_IDS = ['guardian-runner', 'judgement-libs', 'agents-ironlaw', 'git-guardian']
/**
 * advisory 档(2026-10-30 立):不一致只告警、**不 fail-closed**。
 *
 * 为什么 AGENTS 铁律段必须是 advisory:它是**文档**,被多席分钟级修订;而封条要求每次修订都人工重封,
 * 实测一天内同一份清单被顶掉三次(4eb3bf17 → 3ac5ea16 → 7c02479c),每次都让三处签出的部署环
 * fail-closed、连 fetch 都走不到。真正的"改行为"的文件是 guardian-runner(门注册表)与
 * judgement-libs,这两枚仍是硬判据;铁律段的一致性继续记进封条并每天被 267 点名,但不再卡部署。
 * 恢复硬判据 = 从这里删掉该 id(前提是先让"改文档即重封"成为常态)。
 */
export const ADVISORY_TARGET_IDS = new Set(['agents-ironlaw'])
const SECTION_START = '## 0. 全局铁律'
const SECTION_END_PREFIX = '## '

/** 规范化:去 BOM、CRLF→LF、统一为单个结尾换行。哈希只认这一份口径。 */
export function normalizeText(raw) {
  let s = String(raw ?? '')
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return s.replace(/\n+$/, '\n')
}

export function sha256Of(text) {
  return createHash('sha256').update(normalizeText(text), 'utf8').digest('hex')
}

/**
 * 取 Markdown 二级标题段:从 startMarker 起,到下一个 `## ` 行止(含起始行,不含终止行)。
 * 取不到起始行 ⇒ 返回 null(调用方判「未判定」,不当成空段)。
 */
export function extractSection(raw, startMarker = SECTION_START, endPrefix = SECTION_END_PREFIX) {
  const lines = normalizeText(raw).split('\n')
  // 前缀匹配而非等值:标题常带括注(`## 0. 全局铁律(先读,跨节通用)`),等值匹配会把锚点判丢。
  const start = lines.findIndex((l) => l.trim().startsWith(startMarker))
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith(endPrefix)) {
      end = i
      break
    }
  }
  const body = lines.slice(start, end).join('\n')
  return body.endsWith('\n') ? body : `${body}\n`
}

/** 读目标现文并按 mode 取哈希载荷;文件缺失或段锚点失踪 ⇒ { ok:false, why }。 */
export function hashTarget(target, readFile = (p) => readFileSync(p, 'utf8'), root = ROOT) {
  const abs = resolve(root, target.path)
  let raw
  try {
    raw = readFile(abs)
  } catch (e) {
    return { ok: false, why: `目标读不到(${target.path}):${e?.message ?? e}` }
  }
  // 取不到就是取不到:readFile 回 null/undefined(面档缺失、被审对象不存在)一律判未判定。
  // 少这一道,file 模式会把 null 哈希成空串的 sha256 ⇒ "目标不在面上"被染成"清单落后于内容"
  // 那种红(§0.3 禁型:把"没判成"写成"判过";两种红的修法完全不同)。
  if (raw === null || raw === undefined)
    return { ok: false, why: `目标取不到(${target.path})：被审面上没有这份内容` }
  if (target.mode === 'section') {
    const sec = extractSection(
      raw,
      target.start ?? SECTION_START,
      target.endPrefix ?? SECTION_END_PREFIX,
    )
    if (sec === null)
      return {
        ok: false,
        why: `铁律段锚点找不到(${target.path} 缺 "${target.start ?? SECTION_START}")`,
      }
    return { ok: true, sha256: sha256Of(sec), bytes: Buffer.byteLength(sec, 'utf8') }
  }
  if (target.mode !== 'file') return { ok: false, why: `目标 mode 非法(${target.mode})` }
  return { ok: true, sha256: sha256Of(raw), bytes: Buffer.byteLength(normalizeText(raw), 'utf8') }
}

/** 清单形状锁:缺字段/重复 id/必备条目缺席 ⇒ 抛(调用方落 exit 2)。 */
export function loadManifest(rawText) {
  let m
  try {
    m = JSON.parse(rawText)
  } catch (e) {
    throw new Error(`清单不是合法 JSON:${e?.message ?? e}`)
  }
  if (!m || typeof m !== 'object') throw new Error('清单不是对象')
  if (!Array.isArray(m.targets) || m.targets.length === 0)
    throw new Error('清单 targets 必须是非空数组')
  const seen = new Set()
  for (const t of m.targets) {
    if (!t || typeof t !== 'object') throw new Error('清单 targets 出现非对象项')
    for (const k of ['id', 'path', 'mode', 'sha256']) {
      if (typeof t[k] !== 'string' || !t[k].trim())
        throw new Error(`清单项缺 ${k}:${JSON.stringify(t).slice(0, 120)}`)
    }
    if (!/^[a-f0-9]{64}$/.test(t.sha256))
      throw new Error(`清单项 ${t.id} 的 sha256 不是 64 位小写十六进制`)
    if (!['file', 'section'].includes(t.mode))
      throw new Error(`清单项 ${t.id} 的 mode 非 file/section`)
    if (seen.has(t.id)) throw new Error(`清单 id 重复:${t.id}`)
    seen.add(t.id)
  }
  return m
}

/** 解锁记录:只认「同 id + 同新 hash + 未过期」三条同时成立,否则等于没解锁。 */
export function activeUnlocks(rawText, now = Date.now()) {
  if (!rawText) return []
  let doc
  try {
    doc = JSON.parse(rawText)
  } catch {
    return []
  }
  const list = Array.isArray(doc?.records) ? doc.records : []
  return list.filter((r) => {
    if (!r || typeof r.id !== 'string' || typeof r.sha256 !== 'string') return false
    const exp = Date.parse(r.expiresAt)
    return Number.isFinite(exp) && exp > now
  })
}

/**
 * 逐条判定。返回 { verdict: 'pass'|'fail'|'unknown', targets:[{id,state,detail}] }。
 * 单条目标读不到 ⇒ 整轮 unknown(取不到不判过)。
 */
export function checkAll({ manifest, readFile, root, unlocks = [] } = {}) {
  const targets = []
  let sawUnknown = false
  for (const t of manifest.targets) {
    const h = hashTarget(t, readFile, root)
    if (!h.ok) {
      sawUnknown = true
      targets.push({ id: t.id, state: 'unknown', expected: t.sha256, detail: h.why })
      continue
    }
    if (h.sha256 === t.sha256) {
      targets.push({
        id: t.id,
        state: 'pass',
        expected: t.sha256,
        actual: h.sha256,
        bytes: h.bytes,
        detail: '',
      })
      continue
    }
    const unlocked = unlocks.find((u) => u.id === t.id && u.sha256 === h.sha256)
    // advisory(文档面):不一致只告警,不参与 verdict —— 见 ADVISORY_TARGET_IDS 头注。
    const advisory = !unlocked && ADVISORY_TARGET_IDS.has(t.id)
    targets.push({
      id: t.id,
      state: unlocked ? 'unlocked' : advisory ? 'warn' : 'fail',
      expected: t.sha256,
      actual: h.sha256,
      bytes: h.bytes,
      detail: unlocked
        ? `人工解锁记录在有效期(理由:${unlocked.reason ?? ''};至 ${unlocked.expiresAt})`
        : advisory
          ? '文档面内容已变且未重封 —— advisory:只告警,不 fail-closed(见 ADVISORY_TARGET_IDS 头注)'
          : '内容已改动且无有效人工解锁',
    })
  }
  const verdict = sawUnknown ? 'unknown' : targets.some((t) => t.state === 'fail') ? 'fail' : 'pass'
  return { verdict, targets }
}

export function exitCodeOf(verdict) {
  return verdict === 'pass' ? EXIT_OK : verdict === 'fail' ? EXIT_DRIFT : EXIT_UNKNOWN
}

/**
 * 判红时把"到底哪一面对不上"也量出来(纯函数,不碰 git ⇒ 可被测试直接喂三面哈希)。
 *
 * 立因(2026-10-29 实测):部署环连着 40 多分钟 fail-closed,而每一次红都不是"有人改了规则",
 * 是清单 ↔ 工作树 ↔ HEAD 三面里某一面对不上(一次是他席在另一枚签出里 --seal 过,一次是
 * `chore(auto)` 收编把规则文件写回旧版)。旧输出只给 expected/actual 两个哈希,读的人只能猜,
 * 猜错就多封一次清单 —— 而多封一次清单恰恰是下一次对不上的成因。
 */
export function faceDiagnosis({ expected, actual, head }) {
  if (head === null || head === undefined)
    return 'HEAD 面取不到 ⇒ 差面未判定,不据此给处置建议(§0.3)'
  const headIsExpected = head === expected
  const headIsActual = head === actual
  if (headIsActual && !headIsExpected)
    return (
      '工作树 == HEAD 面,而清单绑的是另一份内容 ⇒ 这不是"有人改了规则",是清单与**已入库内容**对不上' +
      '(典型成因:在另一枚签出/另一时刻 --seal 过,或合并/收编把规则文件写回旧版)。' +
      '处置:复核 HEAD 面那份改动 → 重新 --seal → **把清单与规则文件同枚提交并推送**;`git checkout -- <path>` 还原工作树不解决问题。'
    )
  if (headIsExpected && !headIsActual)
    return (
      '清单 == HEAD 面,只有工作树副本不同 ⇒ 盘上那份是滞后的在飞副本或未入库改动。' +
      '处置:先确认它是不是你要交的那份 —— 是就提交,不是就 `git checkout -- <path>`,**不要**为它再封一次清单。'
    )
  return 'HEAD / 工作树 / 清单 三面互不相同 ⇒ 需人工逐面复核(本器不猜哪面是权威)'
}

/**
 * 读被审 rev 面上该目标的哈希(section 模式沿用同一条 extractSection 尺)。取不到 ⇒ null,不冒充。
 * rev 传 'HEAD' 即得"HEAD 面哈希"——原本单写的 headHashOf 只是本函数的一个特例(rev=HEAD),
 * 已被本函数取代(§22c:同尺只留一份,不留两份同构实现)。
 */
function faceHashOf(target, rev) {
  try {
    const raw = gitRaw(['show', `${rev}:${target.path}`], ROOT, {})
    return sha256Of(target.mode === 'section' ? extractSection(raw) : raw)
  } catch {
    return null
  }
}

/** 读被审 rev 面上该目标的 blob。取不到 ⇒ null(交给 hashTarget 落"未判定",不冒充内容)。 */
function faceReader(rev) {
  return (abs) => {
    const rel = relative(ROOT, abs).replace(/\\/g, '/')
    try {
      return gitRaw(['show', `${rev}:${rel}`], ROOT, {})
    } catch {
      return null
    }
  }
}

/**
 * 候选面判定(2026-11-01 立,专治部署环自锁)。
 *
 * 为什么要这一格:`ihui-deploy-loop.ps1` 的老前置闸跑在 `git merge --ff-only` **之前**,
 * 于是生产签出那枚旧 HEAD 上"清单绑的是旧 guardian-runner 哈希"会一直判红,而把清单修对的
 * 提交恰恰只存在于远端那一面 ⇒ 门越守越锁(2026-11-01 实测连续 44 轮 `FAIL 根护栏未通过`)。
 * 判据本该问"本轮真正要检出并构建的那份代码自不自洽",而不是问"上一版自不自洽"。
 * (2026-11-01 定稿:该闸已从 loop 移除,后移到 `ihui-deploy.ps1` 的 ff 成功之后,默认闸面 = HEAD。)
 *
 * 三条不许漂的纪律:
 *  ① 清单与全部目标都从**同一枚 rev** 取(§0.4 同面同轮)⇒ 候选面自洽才放,候选面自己红照样红;
 *  ② 不掺**别的面的**解锁记录(2026-11-03 更正:解锁与封存现在一律绑被审面哈希,旧写法"人工解锁
 *     绑的是工作树哈希"正是那次 47 轮冻结的另一半 —— 面只有一处定义,见 seal/unlock);
 *  ③ rev 形态不对 / 候选面取不到 ⇒ `verdict='unknown'` ⇒ 调用方维持原判,
 *     **绝不把"没判成"读成"放行"**(§0.3),也不因此新增红(§12e)。
 */
export function checkAgainstRev({
  rev,
  unlocks = [],
  readText = (r) => {
    try {
      return gitRaw(['show', `${r}:${MANIFEST_REL}`], ROOT, {})
    } catch {
      return null
    }
  },
} = {}) {
  const revText = String(rev ?? '').trim()
  if (!/^[0-9a-f]{40}$/.test(revText)) {
    return {
      verdict: 'unknown',
      targets: [],
      why: `候选 rev 不是 40 位全量 sha:${revText.slice(0, 20) || '(空)'}`,
    }
  }
  const text = readText(revText)
  if (text === null || text === undefined) {
    return {
      verdict: 'unknown',
      targets: [],
      why: `候选面取不到清单(${revText.slice(0, 11)} 上没有 ${MANIFEST_REL})`,
    }
  }
  let candManifest
  try {
    candManifest = loadManifest(text)
  } catch (e) {
    return { verdict: 'unknown', targets: [], why: `候选面清单形态坏:${e?.message ?? e}` }
  }
  const res = checkAll({
    manifest: candManifest,
    readFile: faceReader(revText),
    root: ROOT,
    // 人工解锁必须穿到被审面这一层(2026-11-01):闸面切到 HEAD 之后,本函数是闸的**唯一**判定
    // 路径,若此处硬写 `unlocks: []`,`--unlock --ttl-min` 就会静默失效 —— 锁文件照写、闸却
    // 认不出来,现象是"放了锁但仍然红"(而且没人报错)。旧注释那句"跨面不掺解锁"原本是防
    // "拿 A 面的锁去放 B 的面";但解锁记录是**按 target.id + sha256 绑定内容**的(见 checkAll
    // 的 `u.id === t.id && u.sha256 === h.sha256`),拿它放不了另一份内容的行 ⇒ 跨面传入不会
    // 放行任何未解锁的内容,该顾虑不成立。
    unlocks,
  })
  return { ...res, rev: revText }
}

/**
 * 放行裁决(把"什么时候可以因候选面而放行"收成一个可测的纯函数,判据只住这一份)。
 * 四档:当前面绿 ⇒ 照常放;当前面红 ∧ 候选面绿 ⇒ 大声放;候选面红/未判定 ⇒ 维持 fail-closed;
 * 当前面本身未判定 ⇒ 绝不借候选面翻绿(§0.3,取不到输入不是"通过"的替代品)。
 */
export function decideRelease({ currentVerdict, candidate } = {}) {
  if (currentVerdict === 'pass') return { release: true, loud: false, reason: '当前面自洽' }
  if (currentVerdict === 'unknown')
    return { release: false, loud: false, reason: '当前面未判定 ⇒ 不借任何他面翻绿' }
  if (!candidate) return { release: false, loud: false, reason: '未给候选面(未要求跨面复核)' }
  if (candidate.verdict === 'pass')
    return {
      release: true,
      loud: true,
      reason: `候选面 ${String(candidate.rev).slice(0, 11)} 清单与全部目标自洽 ⇒ 放行 ff`,
    }
  return {
    release: false,
    loud: false,
    reason: candidate.why ?? `候选面 verdict=${candidate.verdict} ⇒ 不放行`,
  }
}

function readOrDie(path, label) {
  try {
    return readFileSync(path, 'utf8')
  } catch (e) {
    const err = new Error(`${label}读不到(${path}):${e?.message ?? e}`)
    err.code = 'UNKNOWN'
    throw err
  }
}

/**
 * --seal:按**被审面(缺省 HEAD blob)**重算清单 —— 与 `--check` 同面同尺(§0.4)。
 *
 * 为什么不是"按现盘":旧实现封的是工作树字节,而本仓共享工作树常年滞后 HEAD。2026-11-03 实测:
 * 部署环连冻 47 轮,`--seal` 交出 bf5502484c51(工作树 302,612 B),而闸那一侧 `--check` 量的是
 * HEAD blob a09208df9396(315,034 B)⇒ **"重封"这件事本身结构上不可能让闸变绿**,现象正是
 * 本器自己那句差面判读写的"清单 ↔ 工作树 ↔ HEAD 三面里某一面对不上(在另一枚签出/另一时刻 --seal 过)"。
 * 现在:封被审面;工作树那份若不同,只在返回的 `faceNotes` 里点名(不静默,也不为它封)。
 * 取不到被审面 ⇒ 抛错不写盘(未判定不等于通过,§0.3)。
 */
export function seal({
  reason,
  manifestPath = MANIFEST_PATH,
  rev = 'HEAD',
  faceHash = faceHashOf,
  readFile = (p) => readFileSync(p, 'utf8'),
  root = ROOT,
  now = new Date(),
} = {}) {
  if (!reason || !reason.trim())
    throw new Error('--seal 必须给 --reason(封存是人工动作,空理由拒写)')
  const old = loadManifest(readOrDie(manifestPath, '清单'))
  const faceNotes = []
  const targets = old.targets.map((t) => {
    const h = faceHash(t, rev)
    if (typeof h !== 'string' || !h)
      throw new Error(
        `封存失败:${rev} 面上取不到 ${t.path}(未判定不封存;先确认该路径在被审面上真在位)`,
      )
    const wt = hashTarget(t, readFile, root)
    if (wt.ok && wt.sha256 !== h)
      faceNotes.push(
        `${t.id}:工作树副本 ${wt.sha256.slice(0, 12)} ≠ ${rev} 面 ${h.slice(0, 12)} ⇒ 封的是 ${rev} 面;盘上那份是未提交的在飞改动,要让它进清单必须先提交再重封`,
      )
    return { ...t, sha256: h }
  })
  const doc = {
    $comment:
      'O6501 根护栏清单:改动本清单内目标须先 --unlock 再 --seal;部署环对非 0 退出 fail-closed。',
    version: old.version ?? 1,
    sealedAt: now.toISOString(),
    sealedBy: 'root-guard --seal',
    reason: reason.trim(),
    targets,
  }
  mkdirSync(dirname(manifestPath), { recursive: true })
  const tmp = `${manifestPath}.tmp-${process.pid}`
  writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  renameSync(tmp, manifestPath)
  // faceNotes 只随返回值走(打进 CLI),**不进清单文件** —— 清单是闸的输入,掺进诊断文本会改掉它的哈希口径。
  return { ...doc, faceNotes }
}

/**
 * --unlock:把「人已复核」绑定到**被审面(缺省 HEAD blob)**的内容哈希,并写过期时刻。
 * 与 seal 同一条理由(§0.4 同面同尺):闸判的是 HEAD 面,解锁记录按 `target.id + sha256` 逐字比对,
 * 若这里绑工作树哈希,滞后的共享工作树会造出"锁放了但仍然红"——同一次事故的另一半。
 */
export function unlock({
  targetId,
  reason,
  ttlMin = 120,
  rev = 'HEAD',
  faceHash = faceHashOf,
  manifest,
  unlockPath = UNLOCK_PATH,
  now = Date.now(),
} = {}) {
  if (!reason || !reason.trim()) throw new Error('--unlock 必须给 --reason(空理由拒写)')
  if (!Number.isFinite(ttlMin) || ttlMin <= 0) throw new Error('--ttl-min 必须是正整数')
  const t = manifest.targets.find((x) => x.id === targetId)
  if (!t)
    throw new Error(
      `清单里没有目标 ${targetId}(现有:${manifest.targets.map((x) => x.id).join('/')})`,
    )
  const h = faceHash(t, rev)
  if (typeof h !== 'string' || !h)
    throw new Error(`解锁失败:${rev} 面上取不到 ${t.path}(未判定不解锁,§0.3)`)
  let doc = { records: [] }
  if (existsSync(unlockPath)) {
    try {
      const cur = JSON.parse(readFileSync(unlockPath, 'utf8'))
      if (Array.isArray(cur?.records)) doc = { records: cur.records }
    } catch {
      doc = { records: [] }
    }
  }
  const at = new Date(now)
  const expiresAt = new Date(now + ttlMin * 60_000)
  doc.records = doc.records.filter((r) => r?.id !== targetId || Date.parse(r?.expiresAt) > now)
  doc.records.push({
    id: targetId,
    sha256: h,
    reason: reason.trim(),
    at: at.toISOString(),
    expiresAt: expiresAt.toISOString(),
  })
  mkdirSync(dirname(unlockPath), { recursive: true })
  writeFileSync(unlockPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  return { id: targetId, sha256: h, expiresAt: expiresAt.toISOString() }
}

function fmt(res) {
  const lines = [`root-guard: verdict=${res.verdict}`]
  for (const t of res.targets) {
    lines.push(
      `  ${t.state.toUpperCase().padEnd(8)} ${t.id}  expected=${t.expected.slice(0, 12)} actual=${(t.actual ?? '-').slice(0, 12)}${t.detail ? `  ${t.detail}` : ''}`,
    )
  }
  return lines.join('\n')
}

function selfTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`self-test 失败:${msg}`)
  }
  const md = '# t\n\n## 0. 全局铁律\nA\nB\n\n## 1. 其它\nC\n'
  const sec = extractSection(md)
  assert(sec === '## 0. 全局铁律\nA\nB\n', '段抽取应止于下一个二级标题')
  assert(extractSection('## 1. x\n') === null, '缺锚点应返回 null 而不是空段')
  assert(sha256Of('a\r\nb') === sha256Of('a\nb'), 'CRLF 与 LF 必须同哈希')
  assert(sha256Of('\ufeffa') === sha256Of('a'), 'BOM 必须被剥')
  const m = {
    targets: [
      { id: 'x', path: 'x.mjs', mode: 'file', sha256: sha256Of('good') },
      { id: 'y', path: 'AGENTS.md', mode: 'section', start: SECTION_START, sha256: sha256Of(sec) },
    ],
  }
  const files = { 'x.mjs': 'good', 'AGENTS.md': md }
  const rf = (p) => {
    const k = String(p).replace(/\\/g, '/').split('/').pop()
    if (!(k in files)) throw new Error('ENOENT')
    return files[k]
  }
  let r = checkAll({ manifest: m, readFile: rf, root: '/r' })
  assert(r.verdict === 'pass', '无改动应 pass')
  r = checkAll({
    manifest: m,
    readFile: (p) => (String(p).endsWith('x.mjs') ? 'bad' : md),
    root: '/r',
  })
  assert(r.verdict === 'fail' && r.targets[0].state === 'fail', '改动应 fail')
  const exp = new Date(Date.now() + 60_000).toISOString()
  const unl = [{ id: 'x', sha256: sha256Of('bad'), reason: 'reviewed', expiresAt: exp }]
  r = checkAll({
    manifest: m,
    readFile: (p) => (String(p).endsWith('x.mjs') ? 'bad' : md),
    root: '/r',
    unlocks: unl,
  })
  assert(r.verdict === 'pass' && r.targets[0].state === 'unlocked', '绑定新哈希的解锁应放行')
  r = checkAll({
    manifest: m,
    readFile: (p) => (String(p).endsWith('x.mjs') ? 'bad2' : md),
    root: '/r',
    unlocks: unl,
  })
  assert(r.verdict === 'fail', '解锁后再改一次应重新判红')
  r = checkAll({
    manifest: m,
    readFile: () => {
      throw new Error('ENOENT')
    },
    root: '/r',
  })
  assert(r.verdict === 'unknown', '取不到内容应 unknown 而不是 pass')
  assert(
    exitCodeOf('pass') === 0 && exitCodeOf('fail') === 1 && exitCodeOf('unknown') === 2,
    '退出码映射',
  )
  try {
    loadManifest('{"targets":[]}')
    throw new Error('空 targets 应抛')
  } catch (e) {
    assert(/非空数组/.test(e.message), '空 targets 判错')
  }
  console.log(`self-test: 全绿(9 组断言;必备目标 ${REQUIRED_TARGET_IDS.join('/')})`)
}

/**
 * CLI 参数白名单(2026-11-03 立)。为什么必须有这一格——本器当天实测踩中:
 * `node scripts/root-guard.mjs --check --rev <40位sha>` 里的 `--rev` **不是**本器的旗标(真名是
 * `--against-rev`),而旧实现只按 `has('--check')` 之类分支挑动作,未知旗标被静默忽略 ⇒ 它判的是
 * **自己那枚 HEAD** 却让人以为判的是指定面,当场给出一个假绿(我据此差点判"清单没问题、红在别处",
 * 而同一时刻生产签出对同一枚 sha 判红)。这正是台账票 RP-79/RP-91 那一族("未知旗标⇒用法错 exit 2")
 * 在闸面上的形态:失效方向必须是"当场失败并给真名",绝不能是"照默认跑一遍还报绿"。
 */
const CLI_SWITCHES = new Set([
  '--check',
  '--json',
  '--seal',
  '--unlock',
  '--self-test',
  '--help',
  '-h',
])
const CLI_VALUE_FLAGS = new Set([
  '--reason',
  '--target',
  '--ttl-min',
  '--against-rev',
  '--against-remote',
])
/** 纯函数(自检与镜像都问它):返回 `{ ok, unknown, values }`,`values` 是已知值旗标取到的值。 */
export function parseCliArgs(argv) {
  const unknown = []
  const values = {}
  const list = Array.from(argv ?? [])
  for (let i = 0; i < list.length; i++) {
    const t = String(list[i])
    if (CLI_SWITCHES.has(t)) continue
    if (CLI_VALUE_FLAGS.has(t)) {
      const v = list[i + 1]
      if (v === undefined || String(v).startsWith('-')) {
        unknown.push(`${t}(缺值)`)
        continue
      }
      values[t] = v
      i++
      continue
    }
    if (t.startsWith('-')) unknown.push(t)
    else unknown.push(`游离参数:${t}`)
  }
  return { ok: unknown.length === 0, unknown, values }
}

function main(argv) {
  const usage = new Set(['--help', '-h'])
  const cli = parseCliArgs(argv)
  if (!cli.ok && !argv.some((a) => usage.has(a))) {
    console.error(
      `❌ 未知参数:${cli.unknown.join(' ')}\n` +
        '   本器只认 --check / --json / --seal / --unlock / --self-test / --help,值旗标只有\n' +
        '   --reason / --target / --ttl-min / --against-rev / --against-remote。\n' +
        '   想指定被审面请写 `--check --against-rev <40位全量sha>`(`--rev` 不存在);\n' +
        '   拼错若被忽略,这一轮判的就不是你点名的那一面,而账面看不出来(§0.4 同面同轮)。',
    )
    process.exitCode = EXIT_UNKNOWN
    return
  }
  const has = (f) => argv.includes(f)
  const val = (f, d = null) => {
    const i = argv.indexOf(f)
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d
  }
  if (has('--self-test')) return selfTest()
  if (has('--seal')) {
    const doc = seal({ reason: val('--reason', '') })
    console.log(
      `✅ 已按 HEAD 面封存 ${doc.targets.length} 条:${doc.targets.map((t) => `${t.id}=${t.sha256.slice(0, 12)}`).join(' / ')}`,
    )
    for (const n of doc.faceNotes ?? [])
      console.log(`⚠️ 面差点名:${n}`)
    return
  }
  let manifest
  try {
    manifest = loadManifest(readOrDie(MANIFEST_PATH, '清单'))
  } catch (e) {
    console.error(`❌ 未判定:${e.message}`)
    process.exitCode = EXIT_UNKNOWN
    return
  }
  if (has('--unlock')) {
    try {
      const rec = unlock({
        targetId: val('--target', ''),
        reason: val('--reason', ''),
        ttlMin: Number(val('--ttl-min', '120')),
        manifest,
      })
      console.log(
        `✅ 已解锁 ${rec.id}(绑定当前哈希 ${rec.sha256.slice(0, 12)},至 ${rec.expiresAt})`,
      )
    } catch (e) {
      console.error(`❌ 解锁失败:${e.message}`)
      process.exitCode = EXIT_UNKNOWN
    }
    return
  }
  const now = Date.now()
  let unlocks = []
  if (existsSync(UNLOCK_PATH)) {
    try {
      unlocks = activeUnlocks(readFileSync(UNLOCK_PATH, 'utf8'), now)
    } catch {
      unlocks = []
    }
  }
  // ── 判据与"本轮真正要跑的那份代码"同面(O6501 本格,2026-11-01 定稿)──
  // 票面症状:闸跑在 ff **之前** ⇒ 读的是换流前那一面旧 HEAD,而"把清单修对的那枚提交"只在远端
  // 那一面 ⇒ 门越守越锁(2026-11-01 实测连续 44 轮 FAIL)。修法有两条,本格走的是「闸后移到 ff
  // 之后」(见 deploy/win/ihui-deploy.ps1 的 ff 成功收尾处),因此这里的默认闸面必须是 **HEAD**:
  // 此刻 HEAD 就是刚被 ff 到、马上被构建与被切流的那一面,判据与真跑代码同面。
  //
  // 为什么**不**用 origin/main(上一席走过这条死路,主席已实证证伪,别再走回去):
  //   生产机上 `origin/main` 这个嵌套 remote-tracking ref 会被宿主清理层吞掉、永不更新 ——
  //   `deploy/win/ihui-deploy.ps1` 头注与 fetch 段记载的两条实证:2026-09-13「fetch 打印
  //   6eedf5b0f1..adcc23136a 但 rev-parse origin/main 仍读回旧值」;2026-09-28 又实测 15 秒竞态
  //   导致"安静地部署旧版本"。ff 用的根本不是它,而是 fetch 当场定格成显式 sha 的 $remoteTip
  //   (`git merge --ff-only $remoteTip`,随后用 merge-base --is-ancestor 复核 HEAD 真的包含它)。
  //   ⇒ 把默认面设成 origin/main:①自锁没解(读到的仍是旧面);②旧面若恰好自洽就**冒绿**,而 ff
  //   随后带进一枚不自洽的面照样被构建 —— 比自锁更坏。⇒ 默认面只能是 HEAD。
  //
  // --against-rev / --against-remote 仍作取证 / 人工复核的显式覆盖;取不到被审面 ⇒ 未判定(exit 2),
  // 绝不让"没判成"读成放行(§0.3;两条闸任一"取不到就放行"一律不许)。判据只住 checkAgainstRev
  // 一份(§22c 单一真源,不在此另写一份面比较)。
  const revArg = val('--against-rev', '')
  const remoteArg = val('--against-remote', '')
  let faceRev = revArg
  let faceSource = revArg ? `--against-rev ${revArg.slice(0, 11)}` : ''
  if (!faceRev && remoteArg) {
    try {
      faceRev =
        String(gitRaw(['ls-remote', remoteArg, 'refs/heads/main'], ROOT, {}))
          .split('\t')[0]
          ?.trim() ?? ''
    } catch {
      faceRev = ''
    }
    faceSource = `--against-remote ${remoteArg}`
  }
  if (!faceRev) {
    // 默认闸面 = HEAD(闸的位置在 ff 之后,见上方那段立因)。origin/main 在生产上不可信,不用。
    try {
      faceRev = gitRaw(['rev-parse', 'HEAD'], ROOT, {}).trim()
    } catch {
      faceRev = ''
    }
    faceSource = 'HEAD'
  }
  if (!/^[0-9a-f]{40}$/.test(faceRev)) {
    console.error(
      `❌ 根护栏未判定:取不到将被构建的那一面(${faceSource} 解不出 40 位 sha)⇒ 按 fail-closed 处置(不冒充通过,§0.3)`,
    )
    process.exitCode = EXIT_UNKNOWN
    return
  }
  const res = checkAgainstRev({ rev: faceRev, unlocks })
  if (has('--json')) {
    console.log(
      JSON.stringify(
        {
          verdict: res.verdict,
          targets: res.targets,
          against: { source: faceSource, rev: faceRev.slice(0, 11) },
        },
        null,
        2,
      ),
    )
  } else {
    console.log(fmt(res))
  }
  if (res.verdict === 'fail') {
    console.error(
      `❌ 根护栏判红(闸面=${faceSource},rev=${faceRev.slice(0, 11)}):清单与"将被构建的那一面"上的规则文件不一致且未重封 ⇒ 部署环 fail-closed 拒绝推进。复核后重封:node scripts/root-guard.mjs --seal --reason "..."`,
    )
    // 差面判读:以被审面(默认 HEAD / 显式 rev)的哈希为基准,点名"到底是哪一面对不上"。
    let faceManifest = null
    try {
      faceManifest = loadManifest(gitRaw(['show', `${faceRev}:${MANIFEST_REL}`], ROOT, {}))
    } catch {
      faceManifest = null
    }
    for (const t of res.targets) {
      if (t.state !== 'fail') continue
      const target = faceManifest ? faceManifest.targets.find((x) => x.id === t.id) : null
      console.error(
        `   差面判读[${t.id}]:${faceDiagnosis({ expected: t.expected, actual: t.actual, head: target ? faceHashOf(target, faceRev) : null })}`,
      )
    }
  } else if (res.verdict === 'unknown') {
    console.error(
      `❌ 根护栏未判定(闸面=${faceSource}):${res.why ?? '取不到判定输入'} ⇒ 按 fail-closed 处置(不冒充通过)`,
    )
  }
  process.exitCode = exitCodeOf(res.verdict)
}

export const __test__ = {
  normalizeText,
  sha256Of,
  extractSection,
  hashTarget,
  loadManifest,
  activeUnlocks,
  checkAgainstRev,
  decideRelease,
  checkAll,
  exitCodeOf,
  faceDiagnosis,
  parseCliArgs,
  seal,
  unlock,
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
