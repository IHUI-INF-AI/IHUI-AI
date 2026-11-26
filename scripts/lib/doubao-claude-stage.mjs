// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包「扫描式导入」的 Claude Code 伪造源 staging(2026-11-26 立)。
 *
 * 立因:Doubao.dll 原生模块 `agent_asset_migration` 字符串取证(2026-11-26,
 * 结论正文见 docs/chat-carry.md §6):
 *  - claude_code_asset_provider 读 `<HOME>/.claude.json`、`<HOME>/.claude` 并枚举
 *    `projects`;会话面 = `<HOME>/.claude/projects/` 目录树下的 `*.jsonl`
 *    (session_asset_utils:ENUMERATE/SNAPSHOT_SESSION_FILES、part_N.jsonl 分片、
 *    WriteLargeFilteredSessionRecord / ProjectClaudeCodeRecord);
 *  - 打包 sessions_*.jsonl + assets.jsonl → 上传 → 服务端按标准 Claude Code
 *    会话 jsonl 逐条投料成新号云端原生会话(入口文案「导入后,数据将会自动同步至云端」)。
 *  ⇒ 把豆包旧号归档转成**合法形态的 Claude Code 会话文件**放进 projects,
 *    豆包「数据导入与同步」即可见「Claude Code:N 条可导入」→ 点导入 = 原生续聊。
 *
 * 单一真相源:消息排序/过滤/图片语音抽取**复用** `toChatGptConversation`
 * 的 mapping 链(它已是豆包归档的权威顺序与多模态归一),本模块只做
 * ChatGPT 节点 → Claude 记录的二次形态转换,不复刻豆包侧判据;
 * 共享热点文件若被别席回灌,这里不受牵连。
 *
 * 纪律:
 *  - 落盘只新建 `projects/<编码目录>/<session>.jsonl`;目标已存在一律拒写、绝不覆盖;
 *  - 每次 apply 先落 undo 清单,回滚只认清单且逐文件校验首行 sessionId;
 *  - 零 cookie、零网络、零账号动作 —— 扫描/导入发生在豆包 UI 与账号面,不归本模块。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { toChatGptConversation, toUnixSeconds } from './doubao-chatgpt-format.mjs'

const CLAUDE_VERSION = '2.1.153'
const MODEL_NAME = 'claude-sonnet-4-5'
const MANIFEST_MAGIC = 'doubao-claude-stage/v1'

/** 项目目录名编码(`D:\DevEnv\Temp` → `D--DevEnv-Temp`,2026-11-26 实测样本) */
export function encodeProjectDirName(cwd) {
  return String(cwd ?? '')
    .replace(/:/g, '-')
    .replace(/[\\/]+/g, '-')
    .replace(/-+$/g, '')
}

/** Unix 秒 → ISO8601(毫秒),与真实 Claude 会话行同形 */
export function isoOf(unixSeconds, fallbackMs = Date.now()) {
  const n = Number(unixSeconds) || 0
  return new Date(n > 0 ? Math.round(n * 1000) : fallbackMs).toISOString()
}

/** ChatGPT mapping 的 parts → Claude user message.content(纯文本字符串 / blocks) */
function userContentFromParts(parts) {
  if (parts.every((p) => typeof p === 'string')) {
    return { content: parts.map(String).join('\n').trim(), hadImage: false }
  }
  const blocks = []
  let hadImage = false
  for (const p of parts) {
    if (typeof p === 'string') {
      if (p.trim()) blocks.push({ type: 'text', text: p })
    } else if (p?.type === 'image_url' && p?.image_url?.url) {
      hadImage = true
      blocks.push({ type: 'image', source: { type: 'url', url: String(p.image_url.url) } })
    }
  }
  return { content: blocks, hadImage }
}

/** active 分支:从 current_node 沿 parent 回溯到根再倒序(与留档同一条链) */
function walkActiveNodes(convObj) {
  const mapping = convObj?.mapping ?? {}
  const chain = []
  const seen = new Set()
  let id = convObj?.current_node
  while (id !== null && id !== undefined && id !== '') {
    if (seen.has(id)) break
    seen.add(id)
    const node = mapping[id]
    if (!node) break
    if (node.message) chain.push(node)
    id = node.parent
  }
  return chain.reverse()
}

/**
 * 归档会话 → Claude Code 记录数组(纯函数)。
 * limit>0 取最近 N 条;testToken 附到首条 user(试水辨认用,生产不带)。
 */
export function buildClaudeSessionRecords(conv, opts = {}) {
  const sessionId = opts.sessionId || crypto.randomUUID()
  const cwd = opts.cwd || 'D:\\DevEnv\\Temp\\ihui-doubao-carry'
  const convObj = toChatGptConversation(conv)
  const ordered = walkActiveNodes(convObj)
  const totalSource = Array.isArray(conv?.messages) ? conv.messages.length : 0
  const keptSource = ordered.filter((n) => n?.message?.author?.role !== undefined).length
  let nodes = ordered
  if (opts.limit > 0 && nodes.length > opts.limit) nodes = nodes.slice(-opts.limit)

  const records = []
  if (opts.title) records.push({ type: 'summary', summary: String(opts.title), isSidechain: false })
  let parentUuid = null
  let tokenAttached = false
  let users = 0
  let assistants = 0
  for (const node of nodes) {
    const msg = node?.message
    if (!msg?.content) continue
    const parts = Array.isArray(msg.content?.parts) ? msg.content.parts : []
    if (parts.length === 0) continue
    const role = msg.author?.role === 'assistant' ? 'assistant' : 'user'
    const ts = isoOf(msg.create_time ?? toUnixSeconds(node?.create_time))
    const uuid = crypto.randomUUID()
    if (role === 'assistant') {
      const blocks = []
      const text = parts.filter((p) => typeof p === 'string').join('\n')
      if (text.trim()) blocks.push({ type: 'text', text })
      for (const p of parts) {
        if (p && typeof p === 'object' && p.type === 'image_url' && p.image_url?.url) {
          blocks.push({ type: 'image', source: { type: 'url', url: String(p.image_url.url) } })
        }
      }
      if (blocks.length === 0) continue
      records.push({
        parentUuid, isSidechain: false, type: 'assistant', uuid, timestamp: ts,
        message: {
          id: `msg_${crypto.randomUUID().replace(/-/g, '')}`,
          type: 'message', role: 'assistant', model: MODEL_NAME, content: blocks,
          stop_reason: 'end_turn', stop_sequence: null,
          usage: {
            input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0,
            server_tool_use: { web_search_requests: 0, web_fetch_requests: 0 },
          },
        },
        userType: 'external', entrypoint: 'sdk-cli', cwd, sessionId, version: CLAUDE_VERSION, gitBranch: 'main',
      })
      assistants += 1
    } else {
      let useParts = parts
      if (!tokenAttached && opts.testToken) {
        useParts = parts.map((p, i) => (typeof p === 'string' && i === 0 ? `${p}\n[${opts.testToken}]` : p))
        tokenAttached = true
      }
      const { content, hadImage } = userContentFromParts(useParts)
      if (!hadImage && !String(content).trim()) continue
      records.push({
        parentUuid, isSidechain: false, promptId: crypto.randomUUID(), type: 'user',
        message: { role: 'user', content },
        uuid, timestamp: ts, permissionMode: 'default',
        userType: 'external', entrypoint: 'sdk-cli', cwd, sessionId, version: CLAUDE_VERSION, gitBranch: 'main',
      })
      users += 1
    }
    parentUuid = uuid
  }
  return {
    records, sessionId, cwd,
    kept: users + assistants,
    dropped: Math.max(0, totalSource - keptSource),
    stats: { users, assistants, sourceTotal: totalSource, activeKept: keptSource },
  }
}

/** 结构自检链完整性与最小可用性 */
export function validateClaudeSessionRecords(records) {
  if (!Array.isArray(records) || records.length === 0) return { ok: false, code: 'empty-records' }
  const uuids = new Set()
  let sawUser = false
  let sawAssistant = false
  for (const r of records) {
    if (r.type === 'summary') continue
    if (r.type !== 'user' && r.type !== 'assistant') return { ok: false, code: 'bad-type', detail: String(r.type) }
    if (!r.uuid || !r.sessionId || !r.timestamp) return { ok: false, code: 'missing-keys', uuid: r.uuid ?? '(无)' }
    if (uuids.has(r.uuid)) return { ok: false, code: 'dup-uuid', uuid: r.uuid }
    if (r.parentUuid !== null && !uuids.has(r.parentUuid)) return { ok: false, code: 'dangling-parent', uuid: r.uuid }
    uuids.add(r.uuid)
    if (r.type === 'user') sawUser = true
    else sawAssistant = true
  }
  if (!sawUser || !sawAssistant) return { ok: false, code: 'need-user-and-assistant' }
  return { ok: true, count: uuids.size }
}

export function serializeSessionJsonl(records) {
  return `${records.map((r) => JSON.stringify(r)).join('\n')}\n`
}

function defaultManifestDir(pathImpl) {
  // 本文件在 scripts/lib ⇒ 仓根 = 上两级
  return pathImpl.join(pathImpl.dirname(fileURLToPath(import.meta.url)), '..', '..', '.ihui-agent', 'state', 'doubao-claude-stage')
}

/**
 * 规划/执行落盘。dry-run 只回计划;apply 先写 undo 清单再逐文件原子新建(冲突即整体拒绝)。
 */
export function stageClaudeProjects(opts) {
  const deps = { fs, path, dateNow: () => new Date(), ...(opts.deps ?? {}) }
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
    if (!v.ok) return { ok: false, code: `invalid:${v.code}`, detail: v.detail ?? '', files: [], manifest: null }
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
    deps.path.join(defaultManifestDir(deps.path), `staged-${deps.dateNow().toISOString().replace(/[:.]/g, '-')}.json`)

  if (!opts.apply) {
    return {
      ok: true, code: 'dry-run', files: plans.map((p) => p.file), manifest: manifestFile,
      note: `干跑:${plans.length} 个会话将写入 ${deps.path.join(homeDir, '.claude', 'projects')};加 apply 真落盘(先写 undo 清单)`,
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
    note: `已写入 ${plans.length} 个 Claude Code 会话;豆包 设置→数据导入与同步 扫描可见;回滚:unstageClaude ${manifestFile}`,
  }
}

/** 文件内容核验:任一行 sessionId 命中即认为是本工具产物(首行可能是 summary 无 sessionId) */
function fileBelongsToSession(deps, file, sessionId) {
  try {
    const text = deps.fs.readFileSync(file, 'utf8')
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (!t) continue
      let o
      try {
        o = JSON.parse(t)
      } catch {
        continue // 非 JSON 行跳过,不据此否定本工具产物
      }
      if (o && o.sessionId === sessionId) return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * 按 undo 清单回收:只删 清单登记 ∧ 路径含 .claude/projects ∧ 首行 sessionId 对得上 的文件。
 * 目录仅当已空时移除;删不动的点名。
 */
export function unstageClaude(opts) {
  const deps = { fs, path, ...(opts.deps ?? {}) }
  const manifestFile = opts.manifestFile
  if (!manifestFile || !deps.fs.existsSync(manifestFile)) {
    return { ok: false, code: 'manifest-missing', removed: [], kept: [], note: `undo 清单不存在:${manifestFile ?? '(未给)'};未做任何删除` }
  }
  let man
  try {
    man = JSON.parse(deps.fs.readFileSync(manifestFile, 'utf8'))
  } catch {
    return { ok: false, code: 'manifest-unreadable', removed: [], kept: [], note: 'undo 清单损坏;未做任何删除' }
  }
  if (man?.magic !== MANIFEST_MAGIC || !Array.isArray(man.entries)) {
    return { ok: false, code: 'manifest-bad', removed: [], kept: [], note: 'undo 清单 magic 不符;未做任何删除' }
  }
  const projectsMarker = deps.path.sep + '.claude' + deps.path.sep + 'projects' + deps.path.sep
  const removed = []
  const kept = []
  for (const e of man.entries) {
    const pathOk = typeof e.file === 'string' && e.file.includes(projectsMarker)
    if (!pathOk || !fileBelongsToSession(deps, e.file, e.sessionId)) {
      kept.push(e.file)
      continue
    }
    if (!deps.fs.existsSync(e.file)) {
      removed.push(`${e.file}(已不在)`)
      continue
    }
    if (!opts.apply) {
      removed.push(`${e.file}(dry)`)
      continue
    }
    try {
      deps.fs.rmSync(e.file, { force: true })
      const parent = e.dir || deps.path.dirname(e.file)
      if (deps.fs.existsSync(parent) && deps.fs.readdirSync(parent).length === 0) deps.fs.rmdirSync(parent)
      removed.push(e.file)
    } catch {
      kept.push(e.file)
    }
  }
  if (opts.apply) {
    try {
      deps.fs.rmSync(manifestFile, { force: true })
    } catch {
      /* 清单删不掉只影响账面,不虚报 */
    }
  }
  return {
    ok: true, code: opts.apply ? 'unstaged' : 'dry-run', removed, kept,
    note: `${opts.apply ? '已回收' : '干跑'} ${removed.length} 个;${kept.length} 个校验不符未动${kept.length ? `:${kept.join(',')}` : ''}`,
  }
}

export const __test__ = {
  CLAUDE_VERSION, MODEL_NAME, MANIFEST_MAGIC,
  encodeProjectDirName, isoOf, userContentFromParts, walkActiveNodes,
  buildClaudeSessionRecords, validateClaudeSessionRecords, serializeSessionJsonl,
  stageClaudeProjects, unstageClaude, fileBelongsToSession,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
