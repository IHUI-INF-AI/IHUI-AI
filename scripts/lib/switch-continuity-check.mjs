// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 切号前后可见性对账 —— 各平台本地会话清单的快照与 diff。
 *
 * 立因(2026-10-30,继 Trae 携对话切号后的两支线):
 *   取证实证对话正库**按工作区/设备组织、不含账号字段**
 *   (Qoder main.sqlite:chat_sessions/chat_session_messages 全库仅 3 表含 account 列,
 *    会话零绑定;MiniMax runtime-state.sqlite:53 会话 record_json 顶层无 user/account 键)
 *   ⇒ 机制上切号"天然随行";真正要答的问题是**产品 UI 登录新号后会不会换列表口径**
 *   (云端同步覆盖/隐藏)。答案不靠猜:切号前后各跑一次 snapshot,compare 给出逐条差集。
 *
 * 2026-10-30 全平台收口扩容(判据均本机当日现读):
 *   - codex:~/.codex/thread_history_1.sqlite 的 thread_items 按 thread_id 组织、无账号列,
 *     "会话" = DISTINCT thread_id(实测 1398 item / 32 thread);文件名带 schema 版本号
 *     (_1),上游升版会换名 ⇒ 届时在此追加候选,旧候选失效自动落"未装"不冒绿。
 *   - zcode:~/.zcode/cli/db/db.sqlite 的 session/message 表、无账号列(实测 35/3743 行)。
 *   - opencode:主库 opencode.db 的 session/message **0 行**(5.4GB 皆为空闲页,实测),
 *     会话可见面 = storage/plugin/history-snip/ses_*.json 文件族 ⇒ fileSet 形态清单钉。
 *
 * 分族口径(2026-10-31 按新取证整段重写;旧口径"workbuddy/codearts/loomy 本地无会话正库"
 * 已被本机实测推翻,不留旧文。下列计数均本机当日现读,只作形态证据,绝对值以现读为准):
 *
 *   A. **对话正库在本机、sqlite 表族**(按 session 表行数打分挑最富者):
 *      qoder / minimax / codex / zcode。
 *   B. **对话正库在本机、但是文件族/键族**(清单钉 = 文件或主键集合,一个字节正文都不读):
 *      - opencode:history-snip/ses_*.json 单层文件族(现读 63 份)。
 *      - workbuddy:~/.workbuddy/projects/<项目>/<会话>.jsonl,**两层** 91 份 / 365.7MiB。
 *        同目录 workbuddy.db 的 sessions 90 行 **deleted_at 全部非空**(软删)⇒ 不能当会话面。
 *        再往下递归会捞到 <会话>/subagents/agent-*.jsonl 等子代理流水(深扫 370 份),
 *        它们不是独立会话、由主会话派生 ⇒ depth 钉死在 2,不用 deep。
 *      - codearts:%APPDATA%\codearts-agent\User\workspaceStorage\<hash>\chatSessions\*.jsonl
 *        (现读 45 份 / 120 行)。workspaceStorage 下会有别家扩展写的非会话 jsonl ⇒
 *        递归 + 只认路径里恰有 chatSessions 这一段(不是子串匹配)。
 *        旁证 ~/.codeartsdoer/codearts-data/opencode.db(session 1 / message 2 / part 2)
 *        是另一产品的残库,不作正式面。
 *      - loomy:%APPDATA%\Loomy\IndexedDB\file__0.indexeddb.leveldb(1.28MB)。
 *        IndexedDB 是 append-only .log/.ldb,**文件数不随会话增减**,钉文件清单只能做粗检;
 *        故改钉**主键**:用 leveldb-log 的只读重放器(与 local-login 同一读取实现)取活键,
 *        再按 IDB 记录键布局解出字符串主键、只数 ses_ 前缀。
 *        现读:51 条活键(全 store,0 份解析失败)/ 历史上写过 27 枚会话主键,最终态 = 2 枚有数据、
 *        25 枚是 tombstone(客户端已删)。
 *        同一枚会话主键会同时落在数据 store 与另一 store 的短记录里(2 枚会话 ⇒ 4 条命中)⇒ 必须去重。
 *        局限(结构决定,不是实现偷懒):活日志正被客户端追加写,本器无锁只读,
 *        尾部半条记录被 parseLogRecords 当坏头丢掉 ⇒ **只承诺"同法两次快照的差集"**,
 *        不承诺绝对条数;IDB 主键编码随 Chromium 版本变 ⇒ 解不成一律跳过不猜。
 *   C. **云端缓存,不算正库**(刻意不接,接了恒"零会话/未判定"误导):
 *      - doubao:%LOCALAPPDATA%\Doubao\User Data\Default\IndexedDB\chrome_doubao-chat_*
 *        (现读 4.4MB / 211 条活键,库内 store 名只有 '' 与 sidebar-skills-v2:zh,
 *        值里 156 处 downlink_body —— 全是云端下行回包缓存,没有本地消息主表)。
 *        数它数的是"最近从云端拉过哪些会话",不是"本地存了哪些会话"。
 *   D. **不造第二把尺**:trae / trae-solo 正库是 SQLCipher 加密库,携对话腿
 *      (trae-chat-carry)自带解密-重绑-重加密三道自证(§0.6)。
 *   E. lingma / grokbot 本机未安装,无数据面可取证,不虚设条目(装上后按此先取证再登记)。
 *
 * 纪律:只读输入(对副本 checkpoint WAL,不碰在跑客户端的活库);清单只含 id 哈希与计数,
 * 绝不含消息正文/token;compare 的差集按会话 id 点名,供人工/后续腿判断。
 * 判机器状态 ⇒ 不进提交链(§12e)。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
// 只借"读"这一半:Loomy 的 IndexedDB 与 local-login 写的 Local Storage 同为 LevelDB 物理格式,
// 同一份读取实现避免第二把解析尺(§0.6);本器不 import 它的写回端任何东西。
import { readLevelDbEntries, decodeVarint } from './leveldb-log.mjs'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite')

export const APPS = Object.freeze({
  qoder: {
    label: 'Qoder CN',
    dbCandidates: ['C:/Users/Administrator/AppData/Roaming/com.qodercn.app.stable/main.sqlite'],
    // 会话清单:按 session_id 计数 + FTS 覆盖数
    sessions: { table: 'chat_sessions', idCol: 'session_id', where: 'deleted_at IS NULL' },
    messages: { table: 'chat_session_messages', idCol: 'message_id', sessionCol: 'session_id' },
    accountCols: ['account_profiles.account_id'],
  },
  minimax: {
    label: 'MiniMax Code',
    dbCandidates: ['C:/Users/Administrator/.minimax/v2/sqlite/runtime-state.sqlite'],
    sessions: { table: 'local_runtime_sessions', idCol: 'session_id' },
    messages: { table: 'local_runtime_message_rows', idCol: 'id', sessionCol: 'session_id' },
    accountCols: [],
  },
  codex: {
    label: 'Codex CLI',
    dbCandidates: ['C:/Users/Administrator/.codex/thread_history_1.sqlite'],
    // "会话"= thread_id(thread_items 按 thread 多行堆叠,必须 DISTINCT;2026-10-30 实测 32/1398)
    sessions: { table: 'thread_items', idCol: 'thread_id', distinct: true },
    messages: { table: 'thread_items', idCol: 'item_id' },
    accountCols: [],
  },
  zcode: {
    label: '智谱 ZCode',
    dbCandidates: ['C:/Users/Administrator/.zcode/cli/db/db.sqlite'],
    sessions: { table: 'session', idCol: 'id' },
    messages: { table: 'message', idCol: 'id', sessionCol: 'session_id' },
    accountCols: [],
  },
  opencode: {
    label: 'OpenCode CLI',
    // 主库 session/message 0 行(2026-10-30 实测)⇒ 清单钉取 history-snip 插件文件族(fileSet 形态)
    fileSet: {
      root: 'C:/Users/Administrator/.local/share/opencode/storage/plugin/history-snip',
      ext: '.json',
    },
    accountCols: [],
  },
  workbuddy: {
    label: 'WorkBuddy',
    // workbuddy.db 的 sessions 90 行 deleted_at 全非空(软删)⇒ 会话面只能取 JSONL 文件族。
    // depth 2 = projects/<项目>/<会话>.jsonl;更深一层是子代理流水(深扫 370 份 vs 两层 91 份),不是独立会话。
    fileSet: {
      root: 'C:/Users/Administrator/.workbuddy/projects',
      ext: '.jsonl',
      depth: 2,
    },
    accountCols: [],
  },
  codearts: {
    label: 'CodeArts Agent',
    // workspaceStorage 下还有别家扩展写的 jsonl ⇒ 递归但只认路径里恰有 chatSessions 段
    // (workspaceStorage/<hash>/chatSessions/<会话>.jsonl,现读 45 份)
    fileSet: {
      root: 'C:/Users/Administrator/AppData/Roaming/codearts-agent/User/workspaceStorage',
      ext: '.jsonl',
      deep: true,
      segment: 'chatSessions',
    },
    accountCols: [],
  },
  loomy: {
    label: 'Loomy',
    // IndexedDB:文件数恒定(append-only .log/.ldb)⇒ 钉文件只能粗检;改数活主键(ses_ 前缀)
    keyCount: {
      root: 'C:/Users/Administrator/AppData/Roaming/Loomy/IndexedDB/file__0.indexeddb.leveldb',
      keyPrefix: 'ses_',
    },
    accountCols: [],
  },
})

export class CheckError extends Error {
  constructor(message, code = 'switch-check') {
    super(message)
    this.name = 'CheckError'
    this.code = code
  }
}

/**
 * 候选库枚举:沙箱 home / 真账号 profile / APPDATA 重定向各可能持有数据(本机实锤:
 * Loomy 沙箱身份的 .minimax 存在但 0 行,Administrator 的才有 53 场会话)。
 * 绝不"取第一个存在的" —— 那会把"从没登过记的身份"冒充成本机会话面。
 */
export function locateDbAll(appKey, env = process.env) {
  const spec = APPS[appKey]
  if (!spec) throw new CheckError(`不认识的应用:${appKey}(可用 = ${Object.keys(APPS).join('/')})`, 'bad-app')
  const out = []
  const push = (p) => {
    if (p && fs.existsSync(p)) {
      const abs = path.resolve(p)
      if (!out.some((x) => x === abs)) out.push(abs)
    }
  }
  const home = os.homedir().replace(/\\/g, '/')
  // fileSet / keyCount 形态:候选是「目录」而非库文件(opencode history-snip、Loomy IndexedDB 同理)
  const candidates =
    spec.dbCandidates ?? [spec.fileSet?.root ?? spec.keyCount?.root].filter(Boolean)
  // 库文件形态里 `C:/Users/<名>/` 之后才是 profile 内相对路径;目录形态同法
  for (const c of candidates) {
    push(c.replace('C:/Users/Administrator', home))
    push(c)
    if (env.APPDATA) {
      const rel = c.replace(/^C:\/Users\/[^/]+\/AppData\/Roaming\//, '')
      if (rel !== c) push(path.join(env.APPDATA, rel))
    }
  }
  // 跨 profile 兜底(与 trae-auth-extract 同法,连它的关闭开关也同法:IHUI_TRAE_SCAN_USERS=0 ⇒ 关扫描档)
  const usersRoot = 'C:/Users'
  if (String(env.IHUI_TRAE_SCAN_USERS ?? '').trim() !== '0' && fs.existsSync(usersRoot)) {
    for (const u of fs.readdirSync(usersRoot)) {
      for (const c of candidates) {
        const rel = c.replace(/^C:\/Users\/[^/]+\//, '')
        push(`${usersRoot}/${u}/${rel}`)
      }
    }
  }
  return out
}

/**
 * fileSet 清单:返回相对 id(去扩展名、正斜杠),排序后即清单钉。
 *   - depth(默认 1)= 从 root 往下最多走几层目录:1 只数 root 直属文件(opencode 形态不动),
 *     2 = root/<项目>/<会话>.jsonl(workbuddy;再深是子代理流水,不是独立会话)。
 *   - deep:true = 任意深度(codearts 的 <hash>/chatSessions/*.jsonl 层级随产品变)。
 *   - segment = 只认相对路径里**恰有**这一段目录名的文件(workspaceStorage 下有别家扩展的 jsonl,
 *     子串匹配会把 chatSessions2 也算进来)。纯数据字段,调用方与测试可任意注入。
 * 符号链接/junction 一律跳过:递归穿 junction 会跑出 root(§26)。
 */
export function listFileSet(dir, fileSet) {
  const ext = fileSet.ext
  const maxDepth = fileSet.deep
    ? Infinity
    : Number.isFinite(fileSet.depth)
      ? Number(fileSet.depth)
      : 1
  const out = []
  const walk = (cur, relDir, depth) => {
    let entries
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true })
    } catch {
      return // 某层读不动 ⇒ 该子树不计,不猜
    }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue
      const relPath = relDir ? `${relDir}/${e.name}` : e.name
      if (e.isDirectory()) {
        if (depth < maxDepth) walk(path.join(cur, e.name), relPath, depth + 1)
        continue
      }
      if (!e.isFile() || !e.name.endsWith(ext)) continue
      if (fileSet.segment && !relDir.split('/').includes(fileSet.segment)) continue
      out.push(relPath.slice(0, -ext.length))
    }
  }
  walk(dir, '', 1)
  return out.sort()
}

/**
 * IndexedDB 记录键 ⇒ 字符串主键。布局(Chromium IDB leveldb,本机实测):
 *   \x00 \x01 \x02 <storeId> \x01 <varint 字符数> <UTF-16BE 字节>
 * 解不成(库元数据键 / 索引键 / 非字符串主键 / 编码随版本漂移)⇒ null,由调用方跳过。
 */
export function decodeIdbStringKey(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 7) return null
  if (buf[0] !== 0x00 || buf[1] !== 0x01 || buf[2] !== 0x02 || buf[4] !== 0x01) return null
  const n = decodeVarint(buf, 5)
  if (!n) return null
  const chars = Number(n.value)
  if (!Number.isSafeInteger(chars) || chars <= 0 || n.next + chars * 2 > buf.length) return null
  const body = Buffer.from(buf.subarray(n.next, n.next + chars * 2))
  body.swap16()
  return body.toString('utf16le')
}

/**
 * keyCount 形态(Loomy IndexedDB):只读重放 .log/.ldb ⇒ 取活键(同键后写为准,tombstone 即删)
 * ⇒ 解字符串主键 ⇒ 只留 keyPrefix 前缀 ⇒ **按主键去重**。
 * 去重不是洁癖:同一枚会话主键会同时存在于"数据记录"与另一 store 的短记录里
 * (2026-10-31 现读:2 枚会话 ⇒ 4 条命中),不去重会把 2 场数成 4 场。
 * 活日志正被客户端追加写而本器不加锁:尾部半条记录会被丢弃 ⇒ 这里数的是"此刻可读到的活会话",
 * 对账只比较同法两次快照的差集。
 */
export function listKeyCountIds(dir, spec) {
  const { entries } = readLevelDbEntries(dir, fs, path)
  const ids = new Set()
  for (const k of entries.keys()) {
    const s = decodeIdbStringKey(Buffer.from(k, 'latin1'))
    if (s && s.startsWith(spec.keyPrefix)) ids.add(s)
  }
  return [...ids].sort()
}

/**
 * 定位"本机现役会话面":候选按本应用会话数打分,取最大者;
 * 目录形态文件族按命中文件数、键族按活主键数(opencode/workbuddy/codearts/loomy);
 * 全 0 ⇒ {file:null, cands}(调用方如实报"存在会话面但零会话",不冒充未装)。
 */
export function pickRichestDb(appKey, env = process.env) {
  const spec = APPS[appKey]
  const cands = locateDbAll(appKey, env)
  const scored = []
  if (spec.fileSet || spec.keyCount) {
    for (const d of cands) {
      let n = -1
      try {
        n = spec.fileSet
          ? listFileSet(d, spec.fileSet).length
          : listKeyCountIds(d, spec.keyCount).length
      } catch {
        /* 该候选读不成 ⇒ 记 -1 不猜 */
      }
      scored.push({ file: d, sessions: n })
    }
  } else {
    for (const f of cands) {
      let n = -1
      let h = null
      try {
        h = new DatabaseSync(f, { readOnly: true })
        const t = h.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => String(r.name))
        if (t.includes(spec.sessions.table)) n = Number(h.prepare(`SELECT COUNT(*) c FROM "${spec.sessions.table}"`).get().c)
      } catch {
        /* 该候选读不成(被占/非 SQLite)⇒ 记 -1 不猜 */
      } finally {
        try {
          h?.close()
        } catch {
          /* ignore */
        }
      }
      scored.push({ file: f, sessions: n })
    }
  }
  scored.sort((a, b) => b.sessions - a.sessions)
  const best = scored[0]
  return { file: best && best.sessions > 0 ? best.file : null, scored }
}

/** 对副本做 WAL checkpoint 后打开(只读输入哲学:绝不锁客户的活库) */
export function openReadOnlyCopy(dbFile) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir() || os.homedir(), 'ihui-switch-check-'))
  const copy = path.join(dir, 'snap.sqlite')
  fs.copyFileSync(dbFile, copy)
  for (const ext of ['-wal', '-shm']) {
    if (fs.existsSync(dbFile + ext)) fs.copyFileSync(dbFile + ext, copy + ext)
  }
  let merged = false
  try {
    const rw = new DatabaseSync(copy)
    rw.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    rw.close()
    merged = true
  } catch {
    /* checkpoint 不成 ⇒ 退只读主库,在结果里如实标 wal_unmerged */
  }
  const db = new DatabaseSync(copy, { readOnly: true })
  return { db, dir, merged }
}

const fp = (s) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12)

/** 采一枚会话清单:ids 排序后哈希 + 条数(不含正文) */
export function digestSet(db, sql, params = []) {
  const rows = db.prepare(sql).all(...params)
  const ids = rows.map((r) => String(Object.values(r)[0])).sort()
  const h = crypto.createHash('sha1').update(ids.join('\n')).digest('hex')
  return { count: ids.length, digest: h.slice(0, 16), ids }
}

export function snapshotApp(appKey, opts = {}) {
  const env = opts.env ?? process.env
  const spec = APPS[appKey]
  if (!spec) throw new CheckError(`不认识的应用:${appKey}(可用 = ${Object.keys(APPS).join('/')})`, 'bad-app')
  // 目录形态(fileSet 文件族 / keyCount 键族):清单钉 = 相对 id 集合(排序后哈希,零正文)
  if (spec.fileSet || spec.keyCount) {
    const pickedDir = opts.dbPath ?? pickRichestDb(appKey, env).file
    if (!pickedDir) {
      const scored = opts.dbPath ? [{ file: opts.dbPath, sessions: -1 }] : pickRichestDb(appKey, env).scored
      return {
        app: appKey,
        state: 'undetermined',
        why:
          scored.length > 0
            ? `找到 ${scored.length} 个候选目录但 0 份会话(可能从未用过):${scored.map((s) => `${s.file}=${s.sessions}`).join(' | ')}`
            : '本机找不到该应用的会话面目录(未装/未登录/路径变了)',
      }
    }
    const ids = spec.fileSet
      ? listFileSet(pickedDir, spec.fileSet)
      : listKeyCountIds(pickedDir, spec.keyCount)
    // 目录在、清单 0 ⇒ 未判定(§0.3):"读成空"与"没装"都不是"切号后完好"
    if (ids.length === 0) {
      return {
        app: appKey,
        state: 'undetermined',
        why: `会话面目录存在但数出 0 份会话(客户端清空/编码变了/尚未产生对话):${pickedDir}`,
      }
    }
    const h = crypto.createHash('sha1').update(ids.join('\n')).digest('hex')
    return {
      app: appKey,
      label: spec.label,
      state: 'ok',
      dbFile: pickedDir,
      walMerged: null,
      takenAt: new Date().toISOString(),
      sessions: { count: ids.length, digest: h.slice(0, 16) },
      messageRows: null,
      sessionsWithMessages: null,
      accountDigests: [],
      sessionIds: ids.map(fp),
    }
  }
  const picked = opts.dbPath ? { file: opts.dbPath, scored: [{ file: opts.dbPath, sessions: -1 }] } : pickRichestDb(appKey, env)
  if (!picked.file) {
    const exists = picked.scored.length > 0
    return {
      app: appKey,
      state: 'undetermined',
      why: exists
        ? `找到 ${picked.scored.length} 个库文件但会话全为 0 或读不成(可能本机该身份从未用过它):${picked.scored.map((s) => `${s.file}=${s.sessions}`).join(' | ')}`
        : '本机找不到该应用的正库(未装/未登录/路径变了)',
    }
  }
  const dbFile = picked.file
  const { db, dir, merged: walMerged } = openReadOnlyCopy(dbFile)
  try {
    const s = spec.sessions
    const where = s.where ? ` WHERE ${s.where}` : ''
    const distinctKw = s.distinct ? 'DISTINCT ' : ''
    const sess = digestSet(db, `SELECT ${distinctKw}"${s.idCol}" FROM "${s.table}"${where}`)
    let msgs = null
    if (spec.messages) {
      const m = spec.messages
      msgs = digestSet(db, `SELECT "${m.idCol}" FROM "${m.table}"`)
    }
    const perSession = sess.count > 0 && spec.messages?.sessionCol
      ? db.prepare(`SELECT COUNT(DISTINCT "${spec.messages.sessionCol}") c FROM "${spec.messages.table}"`).get()
      : null
    const acc = (spec.accountCols || []).map((ac) => {
      const [t, c] = ac.split('.')
      try {
        return db.prepare(`SELECT DISTINCT "${c}" v FROM "${t}" LIMIT 5`).all().map((r) => fp(String(r.v)))
      } catch {
        return null
      }
    })
    return {
      app: appKey,
      label: spec.label,
      state: 'ok',
      dbFile,
      walMerged,
      takenAt: new Date().toISOString(),
      sessions: { count: sess.count, digest: sess.digest },
      messageRows: msgs ? { count: msgs.count, digest: msgs.digest } : null,
      sessionsWithMessages: perSession ? Number(perSession.c) : null,
      accountDigests: acc.filter(Boolean).flat(),
      sessionIds: sess.ids.map(fp),
    }
  } finally {
    db.close()
    try {
      for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true })
      fs.rmdirSync(dir)
    } catch {
      /* 残留只报不炸 */
    }
  }
}

/** 两份快照对比:新号侧丢了哪些会话(按 fp 点名)、多了哪些 */
export function compareSnapshots(before, after) {
  if (before.state !== 'ok' || after.state !== 'ok') {
    return {
      verdict: 'undetermined',
      why: `一侧快照未判定(before=${before.state} after=${after.state}):${before.why || ''}${after.why || ''}`,
    }
  }
  const b = new Set(before.sessionIds)
  const a = new Set(after.sessionIds)
  const lost = before.sessionIds.filter((x) => !a.has(x))
  const gained = after.sessionIds.filter((x) => !b.has(x))
  return {
    verdict: lost.length === 0 ? 'continuity-ok' : 'continuity-broken',
    beforeSessions: before.sessions.count,
    afterSessions: after.sessions.count,
    lostFp: lost,
    gainedFp: gained,
    messageRowsBefore: before.messageRows?.count ?? null,
    messageRowsAfter: after.messageRows?.count ?? null,
    note:
      lost.length === 0
        ? `切号后本地会话清单完整在位(${before.sessions.count} 场)`
        : `⚠️ 切号后有 ${lost.length} 场会话不在清单 ⇒ 产品 UI 按账号换列表,需做携号迁移腿`,
  }
}

export const __test__ = {
  APPS,
  CheckError,
  locateDbAll,
  pickRichestDb,
  listFileSet,
  listKeyCountIds,
  decodeIdbStringKey,
  digestSet,
  snapshotApp,
  compareSnapshots,
  openReadOnlyCopy,
  fp,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
