// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包「扫描式导入」的 Claude Code 伪造源 staging(2026-11-26 立)。
 *
 * 立因:Doubao.dll 原生模块 `agent_asset_migration` 字符串取证(2026-11-26 实测,
 * 见 docs/chat-carry.md §6):
 *  - claude_code_asset_provider 读 `<HOME>/.claude.json`、`<HOME>/.claude`、
 *    `CLAUDE.md`、枚举 `projects`;会话面 = `<HOME>/.claude/projects/` 下的 `*.jsonl`
 *    (session_asset_utils:ENUMERATE/SNAPSHOT_SESSION_FILES、part_N.jsonl 分片、
 *    WriteLargeFilteredSessionRecord / ProjectClaudeCodeRecord);
 *  - 打包 sessions_<n>.jsonl + assets.jsonl → 上传 → 服务端按标准 Claude Code
 *    会话 jsonl 逐条投料成新号云端原生会话(入口文案「导入后,数据将会自动同步至云端」)。
 *  ⇒ 把豆包旧号归档转成**合法形态的 Claude Code 会话文件**放进 projects,
 *    豆包「数据导入与同步」即可见「Claude Code:N 条可导入」→ 点一下 = 原生续聊。
 *
 * 纪律:
 *  - 排序/过滤/多模态线索全部 import `doubao-chatgpt-format.mjs`(§0.6 单一真相源);
 *  - 落盘只新建 `projects/<编码目录>/<session>.jsonl`;目标已存在一律拒写、绝不覆盖;
 *  - 每次 apply 先落 undo 清单(`.ihui-agent/state/doubao-claude-stage/*.json`),
 *    回滚只认清单且校验首行 sessionId,不按目录名猜删;
 *  - 零 cookie、零网络、零账号动作 —— 扫描/导入由豆包 UI 与账号面发生,不归本模块。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { orderDoubaoMessages, toParts, toUnixSeconds } from './doubao-chatgpt-format.mjs'

const CLAUDE_VERSION = '2.1.153'
const MODEL_NAME = 'claude-sonnet-4-5'
const MANIFEST_MAGIC = 'doubao-claude-stage/v1'

/** 会话文件编码的项目目录名(`D:\DevEnv\Temp` → `D--DevEnv-Temp`,实测样本) */
export function encodeProjectDirName(cwd) {
  return String(cwd ?? '')
    .replace(/:/g, '-')
    .replace(/[\\/]+/g, '-')
    .replace(/-+$/g, '')
}

/** Unix 秒 → ISO8601(带毫秒),与真实 Claude 会话行同形 */
export function isoOf(unixSeconds, fallbackMs = Date.now()) {
  const n = Number(unixSeconds) || 0
  return new Date(n > 0 ? Math.round(n * 1000) : fallbackMs).toISOString()
}

/** 真实样本 user 行:content 是纯字符串;带图片线索时为 Anthropic blocks 数组 */
function userMessageContent(parts) {
  if (parts.every((p) => typeof p === 'string')) {
    const flat = parts.map(String).join('\n').trim()
    return { content: flat, hadImages: false }
  }
  const blocks = []
  let hasImage = false
  for (const p of parts) {
    if (typeof p === 'string') {
      // 图片消息的文本兜底 part("[图片] url")继续作为 text block,URL 不丢
      if (p.trim()) blocks.push({ type: 'text', text: p })
    } else if (p?.type === 'image_url' && p?.image_url?.url) {
      hasImage = true
      blocks.push({ type: 'image', source: { type: 'url', url: String(p.image_url.url) } })
    }
  }
  return { content: blocks, hadImages: hasImage }
}

/**
 * 归档会话(豆包 messages) → Claude Code 会话 jsonl 记录数组(纯函数,不碰盘不碰网)。
 * @param {object} conv 归档会话对象(含 messages)
 * @param {object} [opts]
 * @param {string} [opts.sessionId] 缺省随机 uuid
 * @param {string} [opts.cwd] 会话声明的工作目录(默认批准落点下的标识目录)
 * @param {number} [opts.limit] >0 时只取最近 N 条(试水用)
 * @param {string} [opts.testToken] 试水标记:附在首条 user 文本末尾,验证后生产不带
 * @param {string} [opts.title] 首行 summary 标题(豆包侧/导入列表辨认用)
 * @returns {{records:object[], sessionId:string, kept:number, dropped:number, stats:object}}
 */
export function buildClaudeSessionRecords(conv, opts = {}) {
  const sessionId = opts.sessionId || crypto.randomUUID()
  const cwd = opts.cwd || 'D:\\DevEnv\\Temp\\ihui-doubao-carry'
  const ordered = orderDoubaoMessages(conv?.messages)
  const dropped = (Array.isArray(conv?.messages) ? conv.messages.length : 0) - ordered.length
  let rows = ordered
  if (opts.limit > 0 && rows.length > opts.limit) rows = rows.slice(-opts.limit)

  const gitBranch = 'main'
  const records = []
  if (opts.title) {
    records.push({ type: 'summary', summary: String(opts.title), isSidechain: false })
  }
  let parentUuid = null
  let firstTextDone = false
  for (const m of rows) {
    const parts = toParts(m)
    if (parts.length === 0) continue
    const rawRole = String(m?.role ?? '').toLowerCase()
    const role = rawRole === 'assistant' ? 'assistant' : 'user'
    const ts = isoOf(toUnixSeconds(m?.createTime))
    const uuid = crypto.randomUUID()
    if (role === 'assistant') {
      const text = parts.filter((p) => typeof p === 'string').join('\n')
      const blocks = []
      if (text.trim()) blocks.push({ type: 'text', text })
      for (const p of parts) {
        if (p && typeof p === 'object' && p.type === 'image_url' && p.image_url?.url) {
          blocks.push({ type: 'image', source: { type: 'url', url: String(p.image_url.url) } })
        }
      }
      if (blocks.length === 0) continue
      records.push({
        parentUuid,
        isSidechain: false,
        type: 'assistant',
        uuid,
        timestamp: ts,
        message: {
          id: `msg_${crypto.randomUUID().replace(/-/g, '')}`,
          type: 'message',
          role: 'assistant',
          model: MODEL_NAME,
          content: blocks,
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 0, output_tokens: 0,
            cache_read_input_tokens: 0, cache_creation_input_tokens: 0,
            server_tool_use: { web_search_requests: 0, web_fetch_requests: 0 },
          },
        },
        userType: 'external',
        entrypoint: 'sdk-cli',
        cwd,
        sessionId,
        version: CLAUDE_VERSION,
        gitBranch,
      })
    } else {
      let msgParts = parts
      if (!firstTextDone && opts.testToken) {
        msgParts = parts.map((p, i) => (typeof p === 'string' && i === 0 ? `${p}\n[${opts.testToken}]` : p))
        firstTextDone = true
      }
      const { content, hadImages } = userMessageContent(msgParts)
      if (!hadImages && !String(content).trim()) continue
      records.push({
        parentUuid,
        isSidechain: false,
        promptId: crypto.randomUUID(),
        type: 'user',
        message: { role: 'user', content },
        uuid,
        timestamp: ts,
        permissionMode: 'default',
        userType: 'external',
        entrypoint: 'sdk-cli',
        cwd,
        sessionId,
        version: CLAUDE_VERSION,
        gitBranch,
      })
    }
    parentUuid = uuid
  }
  return {
    records,
    sessionId,
    cwd,
    kept: records.filter((r) => r.type === 'user' || r.type === 'assistant').length,
    dropped,
    stats: { users: records.filter((r) => r.type === 'user').length, assistants: records.filter((r) => r.type === 'assistant').length },
  }
}

/** 结构自检:链完整、必备键齐、至少一条 user+assistant 对(导入面可判"不像空壳") */
export function validateClaudeSessionRecords(records) {
  if (!Array.isArray(records) || records.length === 0) return { ok: false, code: 'empty-records' }
  const byUuid = new Map()
  let sawUser = false
  let sawAssistant = false
  for (const r of records) {
    if (r.type === 'summary') continue
    if (r.type !== 'user' && r.type !== 'assistant') return { ok: false, code: 'bad-type', uuid: r.uuid }
    if (!r.uuid || !r.sessionId || !r.timestamp) return { ok: false, code: 'missing-keys', uuid: r.uuid }
    if (byUuid.has(r.uuid)) return { ok: false, code: 'dup-uuid', uuid: r.uuid }
    if (r.parentUuid !== null && !byUuid.has(r.parentUuid) && !records.some((x) => x.uuid === r.parentUuid)) {
      return { ok: false, code: 'dangling-parent', uuid: r.uuid }
    }
    byUuid.set(r.uuid, r)
    if (r.type === 'user') sawUser = true
    else sawAssistant = true
  }
  if (!sawUser || !sawAssistant) return { ok: false, code: 'need-user-and-assistant' }
  return { ok: true, count: byUuid.size }
}

export function serializeSessionJsonl(records) {
  return `${records.map((r) => JSON.stringify(r)).join('\n')}\n`
}

function defaultManifestDir(deps) {
  const pathImpl = deps.path
  // 仓内真相源:本文件在 scripts/lib ⇒ 仓根上两级
  const here = pathImpl.dirname(fileURLToPath(import.meta.url))
  return pathImpl.join(here, '..', '..', '.ihui-agent', 'state', 'doubao-claude-stage')
}

/**
 * 规划/执行落盘:把一份(或多份)会话写入 `<homeDir>/.claude/projects/<enc(cwd)>/`。
 * apply=false 干跑只回计划;apply=true 先落 undo 清单再写文件。
 * @param {object} opts
 * @param {string} opts.homeDir 真实用户家目录(调用方负责取对;测试注入)
 * @param {{sessionId:string,cwd:string,title?:string,records:object[],origin?:object}[]} opts.sessions
 * @param {boolean} [opts.apply]
 * @param {{fs?:object,path?:object,dateNow?:()=>Date}} [opts.deps]
 * @param {string} [opts.manifestFile] 指定 undo 清单位置;缺省自动命名
 */
export function stageClaudeProjects(opts) {
  const deps = { fs: fs, path: path, dateNow: () => new Date(), ...(opts.deps ?? {}) }
  const homeDir = opts.homeDir
  if (!homeDir) return { ok: false, code: 'no-home', files: [], manifest: null }
  const sessions = Array.isArray(opts.sessions) ? opts.sessions : []
  if (sessions.length === 0) return { ok: false, code: 'no-sessions', files: [], manifest: null }

  const plans = []
  for (const s of sessions) {
    if (!s?.sessionId || !Array.isArray(s.records) || s.records.length === 0) {
      return { ok: false, code: 'bad-session', files: [], manifest: null }
    }
    const v = validateClaudeSessionRecords(s.records)
    if (!v.ok) return { ok: false, code: `invalid:${v.code}`, files: [], manifest: null }
    const dir = deps.path.join(homeDir, '.claude', 'projects', encodeProjectDirName(s.cwd || 'D:\\DevEnv\\Temp\\ihui-doubao-carry'))
    const file = deps.path.join(dir, `${s.sessionId}.jsonl`)
    plans.push({ session: s, dir, file, body: serializeSessionJsonl(s.records) })
  }
  for (const p of plans) {
    if (deps.fs.existsSync(p.file)) {
      return { ok: false, code: 'target-exists', conflict: p.file, files: [], manifest: null }
    }
  }
  const manifestFile =
    opts.manifestFile ||
    deps.path.join(defaultManifestDir(deps), `staged-${deps.dateNow().toISOString().replace(/[:.]/g, '-')}.json`)

  if (!opts.apply) {
    return {
      ok: true, code: 'dry-run', files: plans.map((p) => p.file), manifest: manifestFile,
      note: `干跑:${plans.length} 个会话将写入 ${deps.path.join(homeDir, '.claude', 'projects')};加 --apply 落盘(先写 undo 清单)`,
    }
  }
  const entries = plans.map((p) => ({
    file: p.file, dir: p.dir, sessionId: p.sessionId,
    bytes: Buffer.byteLength(p.body), origin: p.session.origin ?? null, title: p.session.title ?? '',
  }))
  deps.fs.mkdirSync(deps.path.dirname(manifestFile), { recursive: true })
  deps.fs.writeFileSync(manifestFile, `${JSON.stringify({ magic: MANIFEST_MAGIC, createdAt: deps.dateNow().toISOString(), entries }, null, 2)}\n`)
  for (const p of plans) {
    deps.fs.mkdirSync(p.dir, { recursive: true })
    deps.fs.writeFileSync(p.file, p.body)
  }
  return {
    ok: true, code: 'staged', files: plans.map((p) => p.file), manifest: manifestFile,
    note: `已写入 ${plans.length} 个 Claude Code 会话(豆包设置→数据导入与同步 扫描可见);回滚:unstageClaude ${manifestFile}`,
  }
}

/**
 * 按 undo 清单回滚:只删清单登记、首行 sessionId 对得上、且在 `.claude/projects/` 下的文件;
 * 目录仅当空时移除。删不动的点名,不硬来。
 * @returns {{ok:boolean, code:string, removed:string[], kept:string[], note:string}}
 */
export function unstageClaude(opts) {
  const deps = { fs: fs, path: path, ...(opts.deps ?? {}) }
  const manifestFile = opts.manifestFile
  if (!manifestFile || !deps.fs.existsSync(manifestFile)) {
    return { ok: false, code: 'manifest-missing', removed: [], kept: [], note: `undo 清单不存在:${manifestFile ?? '(未给)'};不做任何删除` }
  }
  let man
  try {
    man = JSON.parse(deps.fs.readFileSync(manifestFile, 'utf8'))
  } catch {
    return { ok: false, code: 'manifest-unreadable', removed: [], kept: [], note: 'undo 清单坏了;不做任何删除' }
  }
  if (man?.magic !== MANIFEST_MAGIC || !Array.isArray(man.entries)) {
    return { ok: false, code: 'manifest-bad', removed: [], kept: [], note: 'undo 清单 magic 不符;不做任何删除' }
  }
  const removed = []
  const kept = []
  for (const e of man.entries) {
    const okPath = typeof e.file === 'string' && e.file.includes(`${deps.path.sep}.claude${deps.path.sep}projects${deps.path.sep}`.replace(/\//g, deps.path.sep))
    const firstLineMatches = (() => {
      try {
        const fd = deps.fs.openSync(e.file, 'r')
        const buf = Buffer.alloc(Math.min(65536, deps.fs.statSync(e.file).size))
        const rd = deps.fs.readSync(fd, buf, 0, buf.length, 0)
        deps.fs.closeSync(fd)
        const idx = buf.indexOf('\n')
        const first = JSON.parse(buf.subarray(0, idx < 0 ? rd : idx).toString('utf8'))
        return first?.sessionId === e.sessionId || String(first?.summary ?? '').includes(e.sessionId)
      } catch {
        try {
          // summary 行是首行时,sessionId 在第二条
          const all = deps.fs.readFileSync(e.file, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
          return all.some((l) => {
            try { return JSON.parse(l)?.sessionId === e.sessionId } catch { return false }
          })
        } catch { return false }
      }
    })()
    if (!okPath || !firstLineMatches) {
      kept.push(e.file)
      continue
    }
    try {
      if (deps.fs.existsSync(e.file)) {
        if (!opts.apply) { removed.push(`${e.file}(dry)`); continue }
        deps.fs.rmSync(e.file, { force: true })
      }
      const parent = e.dir || deps.path.dirname(e.file)
      if (opts.apply && deps.fs.existsSync(parent) && deps.fs.readdirSync(parent).length === 0) {
        deps.fs.rmdirSync(parent)
      }
      removed.push(e.file)
    } catch {
      kept.push(e.file)
    }
  }
  if (opts.apply) {
    try { deps.fs.rmSync(manifestFile, { force: true }) } catch { /* 清单删不掉只影响账面,不虚报 */ }
  }
  return {
    ok: true, code: opts.apply ? 'unstaged' : 'dry-run', removed, kept,
    note: `${opts.apply ? '已回收' : '干跑'} ${removed.length} 个文件;${kept.length} 个校验不符未动${kept.length ? `:${kept.join(',')}` : ''}`,
  }
}

export const __test__ = {
  CLAUDE_VERSION, MODEL_NAME, MANIFEST_MAGIC,
  encodeProjectDirName, isoOf, userMessageContent,
  buildClaudeSessionRecords, validateClaudeSessionRecords, serializeSessionJsonl,
  stageClaudeProjects, unstageClaude,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
