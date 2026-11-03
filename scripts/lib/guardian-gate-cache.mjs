// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 纯内容门的指纹结果缓存(2026-10-22 立,机主要求"提速到极致")。
 *
 * 病灶:快档一轮 268 门里 ~117 道只读门每次全跑(实测 32.9s);同一份内容在同一个 HEAD
 * 树下被重复检查(失败重试、safe-commit 内部重入、post-commit 补跑)时,这些门给出逐字
 * 相同的结论,却被重算一次。
 *
 * 三条不变量(任一条不满足就不入缓存/不命中):
 *   ① **只收纯内容门**。白名单必须是 executor 的 PAR_GATE_IDS 子集(只读门),且逐门核过:
 *      无写副作用、无网络/远端状态、无 mtime/当前时间、无生成产物依赖。新门默认**不**缓存
 *      —— 想提速必须逐门证明后加一行 id。
 *   ② **只缓存通过**。失败、崩溃、warn 一律不写;命中只发生在"同一份输入此前真的通过"时。
 *      失效方向永远是"多跑一次门",不是"多放一次行"。
 *   ③ **指纹覆盖全部输入**:门脚本 + argv + HEAD 树 OID + 索引条目流 + 未暂存 diff +
 *      未跟踪文件内容 + Node 版本。任何一项变化 ⇒ 未命中 ⇒ 门照跑。
 *
 * 为什么键里要 HEAD **树 OID** 而不是 commit sha:白名单门只读内容;但 --staged 门用
 * `git diff --cached` 划定取材面,该面由 HEAD 树与索引之差决定 ⇒ HEAD 树必须进键。
 * 同一棵树的不同提交(amend/重排)可安全复用,树一变即失效。
 *
 * 逃生舱:`GUARDIAN_NO_CACHE=1` 全关(只影响提速,不影响任何判据)。
 * 缓存文件 `.ihui-agent/state/gate-cache.json`(gitignore 已盖):读坏/写失败只当没缓存。
 */

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { gitRaw } from './face-reader.mjs'

const CACHE_VERSION = 1
export const GATE_CACHE_TTL_MS = 60 * 60 * 1000
export const GATE_CACHE_FILE_REL = '.ihui-agent/state/gate-cache.json'
/** 未跟踪文件超过这个数/总量 ⇒ 判不了完整输入,整批禁用缓存(宁多跑,不放行)。 */
const MAX_UNTRACKED_FILES = 512
const MAX_UNTRACKED_BYTES = 32 * 1024 * 1024

/**
 * 纯内容门白名单。收录纪律(与 PAR_GATE_IDS 同一安全向):
 *   · 只读文件内容 + git 索引/HEAD 树,不写任何仓库文件(自检 scratch 例外,已逐门核过);
 *   · 不读 origin/远端、不读 reflog、不读 mtime/当前日期、不读 .ihui-agent/state 状态;
 *   · 必须同时出现在 executor 的 PAR_GATE_IDS 中(镜像测试逐条锁)。
 * 刻意**不**收:`3`(schema mtime)、`4b`(dist 产物)、`8`(写报告文件)、`15`(探活 localhost)、
 * `29`/`30a`(远端)、`30c`(origin/main + git log)、`47`(自愈写回并改暂存区)、
 * `100`(合并历史)、`103`(当前日期判例外过期)、`107`(盘上 vendored 实物)、
 * `232`(当前日期判豁免过期)。
 */
export const CONTENT_CACHE_GATE_IDS = new Set([
  '2', // i18n 键完整性(仅读 tracked locale + HEAD)
  '2e-dupns', // i18n 重复命名空间/重复键
  '11', // rounded-full
  '11c', // tagsview 选中态描边
  '28', // overlay z-index
  '77', // radius 单源(+ 仅 --update-baseline 才写基线)
  '89', // 守门接线层对账(自检写 scratch)
  '91', // theme prop wiring(+ 仅 --update-baseline 才写基线)
  '112', // 压缩分母(+ 仅 --update-baseline 才写基线)
  '116', // 出站事实(+ 仅 --update 才写基线)
  '127', // 跨语言出站路由声明
  '165', // 教育欠费口径单源
  '179', // tool schema 投影(写 scratch 探针后删)
  '181', // 错误文案有界化
  '184', // 活文档点名路径存续
  '211', // PROJECT_PLAN 号池
  '221', // .mjs 语法(写 tmp 探针后删)
  // 2026-10-22 补入三门(均为提交面纯内容判定):
  //   173 —— README 生成数字 vs 现算 tracked 计数,输入全在索引/HEAD 面,无时间依赖;
  //   203 —— 台账同题多号差值棘轮,只读 HEAD blob 与索引 blob;
  //   229 —— 已闭合任务存量,只读 PROJECT_PLAN。
  // 三者都已进 executor 的 PAR_GATE_IDS(T1 镜像测试逐条锁)。
  '173', '203', '229',
])

/**
 * 计算本批输入的内容指纹。返回 null = 判不出(未合并索引/未跟踪文件超预算/git 失败)
 * ⇒ 本批缓存全禁用,门照常执行。
 *
 * 只读:不写 tree 对象(用 `ls-files --stage` 的索引条目流,不用 `git write-tree`)。
 */
export function computeStateFingerprint({ cwd = process.cwd(), git = gitRaw } = {}) {
  try {
    const h = createHash('sha256')
    h.update(`v${CACHE_VERSION}\0`)
    h.update(`${process.version}\0`)

    // HEAD 树:无提交的仓库退化为 no-head(白名单门在空仓下不依赖历史)。
    let headTree = 'no-head'
    try {
      headTree = git(['rev-parse', '--verify', 'HEAD^{tree}'], cwd).trim() || 'no-head'
    } catch {
      headTree = 'no-head'
    }
    h.update(`head:${headTree}\0`)

    // 未合并索引:判不了完整内容 ⇒ 整批禁用(失效方向 = 多跑门)。
    const unmerged = git(['ls-files', '-u', '-z'], cwd, { binary: true })
    if (unmerged.length > 0) return null

    // 索引条目流:mode + blob OID + stage + path,逐字节覆盖暂存面。
    const index = git(['ls-files', '--stage', '-z'], cwd, { binary: true })
    h.update(`index:${index.length}\0`)
    h.update(index)

    // 未暂存 diff(工作区 vs 索引):含内容、删除、mode 变化;不含未跟踪。
    const worktreeDiff = git(['diff', '--binary', '--no-color', '--no-ext-diff'], cwd, { binary: true })
    h.update(`wt:${worktreeDiff.length}\0`)
    h.update(worktreeDiff)

    // 未跟踪文件:路径 + 内容。超预算判不了 ⇒ 禁用。
    const rawOthers = git(['ls-files', '--others', '--exclude-standard', '-z'], cwd, { binary: true })
    const others = rawOthers.toString('utf8').split('\0').filter(Boolean).sort()
    if (others.length > MAX_UNTRACKED_FILES) return null
    h.update(`untracked:${others.length}\0`)
    let bytes = 0
    for (const rel of others) {
      let buf
      try {
        buf = readFileSync(resolve(cwd, rel))
      } catch {
        buf = Buffer.from(`unreadable:${rel}`, 'utf8')
      }
      bytes += buf.length
      if (bytes > MAX_UNTRACKED_BYTES) return null
      h.update(`u:${rel}\0${buf.length}\0`)
      h.update(buf)
    }

    return h.digest('hex')
  } catch {
    return null
  }
}

/**
 * 门结果缓存实例。所有 git/文件错误都收敛成"没有缓存",绝不改写判据。
 *
 * @param {object} [opts]
 * @param {string} [opts.cwd]
 * @param {string} [opts.file]
 * @param {Set<string>} [opts.gateIds]
 * @param {number} [opts.ttlMs]
 * @param {boolean} [opts.enabled]
 * @param {() => number} [opts.now]
 * @param {Function} [opts.git]
 */
export function createGateContentCache(opts = {}) {
  const {
    cwd = process.cwd(),
    file = resolve(cwd, GATE_CACHE_FILE_REL),
    gateIds = CONTENT_CACHE_GATE_IDS,
    ttlMs = GATE_CACHE_TTL_MS,
    now = () => Date.now(),
    git = gitRaw,
    enabled = process.env.GUARDIAN_NO_CACHE !== '1',
  } = opts

  const entries = new Map()
  let loaded = false
  let disabledReason = enabled ? null : 'GUARDIAN_NO_CACHE=1'
  let state = null
  let stateTried = false

  function eligible(id) {
    return enabled && gateIds.has(String(id))
  }

  function load() {
    if (loaded) return
    loaded = true
    if (!enabled) return
    try {
      const j = JSON.parse(readFileSync(file, 'utf8'))
      if (!j || j.version !== CACHE_VERSION || !j.entries || typeof j.entries !== 'object') return
      const cutoff = now() - ttlMs
      for (const [id, e] of Object.entries(j.entries)) {
        if (!gateIds.has(String(id))) continue
        if (!e || typeof e.key !== 'string' || !Number.isFinite(e.ts) || e.ts < cutoff) continue
        entries.set(String(id), { key: e.key, ts: e.ts, ms: Number.isFinite(e.ms) ? e.ms : 0 })
      }
    } catch {
      /* 读不到/坏 JSON = 冷缓存,不是错误 */
    }
  }

  function ensureState() {
    if (!enabled) return null
    if (stateTried) return state
    stateTried = true
    state = computeStateFingerprint({ cwd, git })
    if (!state) disabledReason = '内容指纹不可得(未合并索引/未跟踪文件超预算/git 失败)'
    return state
  }

  function inputKey(st, input) {
    const h = createHash('sha256')
    h.update(`${CACHE_VERSION}\0${st}\0${input.script}\0${JSON.stringify(input.args ?? [])}`)
    return h.digest('hex')
  }

  /** 命中 ⇒ { ageMs, ms };未命中/不可判 ⇒ null(门照跑)。 */
  function lookup(id, input) {
    if (!eligible(id)) return null
    load()
    const e = entries.get(String(id))
    if (!e) return null
    const st = ensureState()
    if (!st) return null
    if (e.key !== inputKey(st, input)) return null
    const age = now() - e.ts
    if (!(age >= 0 && age < ttlMs)) return null
    return { ageMs: age, ms: e.ms }
  }

  /** 只有明确 passed === true 才落缓存;返回是否写入。 */
  function record(id, input, { passed, ms } = {}) {
    if (!eligible(id) || passed !== true) return false
    load()
    const st = ensureState()
    if (!st) return false
    entries.set(String(id), {
      key: inputKey(st, input),
      ts: now(),
      ms: Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0,
    })
    persist()
    return true
  }

  function persist() {
    try {
      const cutoff = now() - ttlMs
      const out = {}
      for (const [id, e] of entries) {
        if (e.ts >= cutoff) out[id] = e
      }
      mkdirSync(dirname(file), { recursive: true })
      const text = JSON.stringify({ version: CACHE_VERSION, entries: out }) + '\n'
      const tmp = `${file}.${process.pid}.tmp`
      writeFileSync(tmp, text)
      try {
        renameSync(tmp, file)
      } catch {
        // Windows 上目标被并发进程占住时 rename 可能失败:退回直写,并清掉临时件。
        writeFileSync(file, text)
        try {
          rmSync(tmp, { force: true })
        } catch {
          /* 临时件清不掉不影响判据 */
        }
      }
    } catch {
      /* 缓存写失败 = 下一轮重跑门,不影响放行 */
    }
  }

  return {
    eligible,
    lookup,
    record,
    get disabledReason() {
      return disabledReason
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
