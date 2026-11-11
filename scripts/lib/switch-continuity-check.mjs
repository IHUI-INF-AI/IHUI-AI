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
 * 2026-11-10 四端"空转"整改(dry-run 体检实测:对账器探不到真库 ⇒ continuity-broken 永不触发):
 *   - codearts:原只钉 %APPDATA%\codearts-agent\User\workspaceStorage\**\chatSessions\*.jsonl,
 *     本机该段 0 份;真会话库是 ~/.codeartsdoer/codearts-data/opencode.db 的 session/message/part
 *     (pragma 实读 20 列,含 time_archived;当日 0 行 = 被清空)。改"库优先、fileSet 回落",两数并报。
 *   - zcode:cli/db/db.sqlite 的 session 表 0 行是实情,但 ~/.zcode/v2/tasks-index.sqlite 的 tasks
 *     表 40 行(35 列;无 time_deleted 列 ⇒ 真列名 deleted INTEGER 0/1,未删 40)才是任务索引。
 *     改"两库都数、取有数据者"。
 *   - loomy:decodeIdbStringKey 原钉死 buf[2]===0x02 ⇒ 真键(00 01 <db varint> <store varint>
 *     01 <varint 字符数> UTF-16BE)全被拒 ⇒ 恒 0。修布局后活记录仍为 0:Loomy 每轮把会话记录
 *     连同索引一起 tombstone(日志尾部一整批 delete),故改"日志历史 id 全集 ∪ 活主键",并单报
 *     liveCount;局限见 listKeyCountHistoryIds 注。
 *   - opencode:2.2.6 数据根随 XDG_DATA_HOME 搬到 D:\xdg\data\opencode,且会话表改名
 *     session_v2/session_message/session_part(旧 session/message 不再存在);本机 0 行,
 *     5947 页里 3024 页空闲且 ses_ id 仍残留在空闲页 ⇒ 曾有本地会话、后被清空,不是"云端无本地面"。
 *     另:全表路径改 {home}/{appData}/{localAppData}/{xdgData} 令牌派生,不再硬编码 C:/Users/Administrator。
 *
 * 2026-11-10 尾刀:codearts / opencode **库表 0 行时的假盲区**(上一轮落点改对了,但这两台只是
 * 从"找错地方"变成"找到了空库":SQL 口径恒 0 ⇒ 永远 undetermined ⇒ 会话保全没有实际保障)。
 *   - 取证(只读,本机当日):opencode 24.4MB / freelist 3024/5947 页里 3 枚不同 ses_ 会话 id;
 *     codearts 31.9MB / freelist 7731/7785 页里 183 枚;-wal 均无额外 id。
 *   - 落法:0 行时改扫**文件字节**(主库 + `-wal`),按 id 形状 `ses_`+26 字符取游程前缀去重;
 *     快照 sessions.count = 历史 id 数、sessions.liveCount = SQL 活行数,两个数并报,mode='raw-scan'。
 *     切前/切后比 count —— 切号只"搬"不"删",历史 id 数只增不减,变少 = 真删了会话 ⇒ broken。
 *   - 不冒绿的闸:同一路径两趟扫描结果必须逐项相同,不同 ⇒ undetermined;扫不到残留 ⇒ undetermined。
 *   - 残余风险(结构决定):空闲页会被后续写入复用,VACUUM / secure_delete 会抹掉残留 ⇒
 *     本口径只承诺"同法两次快照的差集",不承诺绝对条数。
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
import { fileURLToPath } from 'node:url'
// 只借"读"这一半:Loomy 的 IndexedDB 与 local-login 写的 Local Storage 同为 LevelDB 物理格式,
// 同一份读取实现避免第二把解析尺(§0.6);本器不 import 它的写回端任何东西。
// parseLogRecords/parseBatch 只用于 Loomy 的"日志历史 id"补扫(见 listKeyCountHistoryIds)。
import { readLevelDbEntries, decodeVarint, parseLogRecords, parseBatch } from './leveldb-log.mjs'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite')

/**
 * 路径令牌(2026-11-10):注册表里一律写令牌,由 resolveDataPath(env) 展开 ——
 * 不再硬编码 `C:/Users/Administrator`(换机/换用户名/换盘符一地失真)。
 *   {home}        = env.USERPROFILE || env.HOME || os.homedir()
 *   {appData}     = env.APPDATA     || {home}/AppData/Roaming
 *   {localAppData}= env.LOCALAPPDATA|| {home}/AppData/Local
 *   {xdgData}     = env.XDG_DATA_HOME|| {home}/.local/share   ← opencode 2.2.6 数据根
 *
 * 面(face)口径:`dbCandidates`+`sessions` = SQLite 正库面;`dbs[]` = 同应用的第二/第三库
 * (zcode 的 tasks-index);`fileSet` / `keyCount` = 文件族/键族面。一个应用可同时有多种面,
 * 快照按"会话数最多者"取用,并把**每一面各自的数**一并报出(faces/fallback),
 * 绝不"取第一个存在的"冒充。
 */
export const APPS = Object.freeze({
  qoder: {
    label: 'Qoder CN',
    dbCandidates: ['{appData}/com.qodercn.app.stable/main.sqlite'],
    // 会话清单:按 session_id 计数 + FTS 覆盖数
    sessions: { table: 'chat_sessions', idCol: 'session_id', where: 'deleted_at IS NULL' },
    messages: { table: 'chat_session_messages', idCol: 'message_id', sessionCol: 'session_id' },
    accountCols: ['account_profiles.account_id'],
  },
  minimax: {
    label: 'MiniMax Code',
    dbCandidates: ['{home}/.minimax/v2/sqlite/runtime-state.sqlite'],
    sessions: { table: 'local_runtime_sessions', idCol: 'session_id' },
    messages: { table: 'local_runtime_message_rows', idCol: 'id', sessionCol: 'session_id' },
    accountCols: [],
  },
  codex: {
    label: 'Codex CLI',
    dbCandidates: ['{home}/.codex/thread_history_1.sqlite'],
    // "会话"= thread_id(thread_items 按 thread 多行堆叠,必须 DISTINCT;2026-10-30 实测 32/1398)
    sessions: { table: 'thread_items', idCol: 'thread_id', distinct: true },
    messages: { table: 'thread_items', idCol: 'item_id' },
    accountCols: [],
  },
  zcode: {
    label: '智谱 ZCode',
    // 2026-11-10:cli/db/db.sqlite 的 session 表本机 0 行(实情),但 v2/tasks-index.sqlite 的
    // tasks 表 40 行才是任务索引 ⇒ 两库都登记、都数,取有数据者。
    dbCandidates: ['{home}/.zcode/cli/db/db.sqlite'],
    sessions: { table: 'session', idCol: 'id' },
    messages: { table: 'message', idCol: 'id', sessionCol: 'session_id' },
    dbs: [
      {
        label: 'tasks-index',
        dbCandidates: ['{home}/.zcode/v2/tasks-index.sqlite'],
        // 35 列实测无 time_deleted;软删列名是 deleted(全 0=未删)、另有 cli_deleted/archived
        sessions: { table: 'tasks', idCol: 'task_id', where: 'deleted = 0' },
      },
    ],
    accountCols: [],
  },
  workbuddy: {
    label: 'WorkBuddy',
    // workbuddy.db 的 sessions 90 行 deleted_at 全非空(软删)⇒ 会话面只能取 JSONL 文件族。
    // depth 2 = projects/<项目>/<会话>.jsonl;更深一层是子代理流水(深扫 370 份 vs 两层 91 份),不是独立会话。
    fileSet: {
      root: '{home}/.workbuddy/projects',
      ext: '.jsonl',
      depth: 2,
    },
    accountCols: [],
  },
  codearts: {
    label: 'CodeArts Agent',
    // 2026-11-10:真会话库 ~/.codeartsdoer/codearts-data/opencode.db(session/message/part,
    // pragma 实读含 time_archived)。库优先,库空回落下面的 chatSessions 文件族;两数并报。
    dbCandidates: ['{home}/.codeartsdoer/codearts-data/opencode.db'],
    sessions: { table: 'session', idCol: 'id', where: 'time_archived IS NULL' },
    messages: { table: 'message', idCol: 'id', sessionCol: 'session_id' },
    // 库被清成 0 行时(本机实况)的唯一信号:id 形状 ses_ + 26 字符,残留在空闲页字节里
    rawScan: { prefix: 'ses_', idLength: 26 },
    hint: '库 session 0 行且 chatSessions 0 份 = 本机该产品当前确无会话(不是路径找错:~/.codeartsdoer/codearts-data/opencode.db 的 session/message/part 三表均已被清空)',
    // workspaceStorage 下还有别家扩展写的 jsonl ⇒ 递归但只认路径里恰有 chatSessions 段
    fileSet: {
      root: '{appData}/codearts-agent/User/workspaceStorage',
      ext: '.jsonl',
      deep: true,
      segment: 'chatSessions',
    },
    accountCols: [],
  },
  opencode: {
    label: 'OpenCode CLI',
    // 2026-11-10:数据根跟随 XDG_DATA_HOME;2.2.6 会话表已改名 session_v2/session_message/
    // session_part(旧 session/message 表不存在)。本机 0 行 = 被清空(空闲页残留 ses_ id),
    // 不是"云端无本地面"。history-snip 文件族保留为第二形态(2.2.6 已不再写,本机两处均 0 份)。
    dbCandidates: ['{xdgData}/opencode/opencode.db'],
    sessions: { table: 'session_v2', idCol: 'id', where: 'time_archived IS NULL' },
    messages: { table: 'session_message', idCol: 'id', sessionCol: 'session_id' },
    // 同 codearts:0 行时靠空闲页里 ses_ + 26 字符的历史 id 兜底(本机 5947 页 / 3024 页空闲)
    rawScan: { prefix: 'ses_', idLength: 26 },
    fileSet: {
      root: '{xdgData}/opencode/storage/plugin/history-snip',
      ext: '.json',
    },
    hint: 'OpenCode 2.2.6 的会话落点 = {xdgData}/opencode/opencode.db 的 session_v2/session_message/session_part(旧 session/message 表已不存在);本机 0 行且空闲页残留 ses_ id ⇒ 本地会话曾被清空,不是"云端无本地面"',
    accountCols: [],
  },
  loomy: {
    label: 'Loomy',
    // IndexedDB:文件数恒定(append-only .log/.ldb)⇒ 钉文件只能粗检;数活主键 ∪ 日志历史会话 id
    keyCount: {
      root: '{appData}/Loomy/IndexedDB/file__0.indexeddb.leveldb',
      keyPrefix: 'ses_',
    },
    accountCols: [],
  },
})

/** 令牌展开(纯函数:调用方/env 可注入,测试不必碰真机路径) */
export function resolveDataPath(p, env = process.env) {
  const home = String(env.USERPROFILE || env.HOME || os.homedir())
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
  const appData = String(env.APPDATA || `${home}/AppData/Roaming`).replace(/\\/g, '/')
  const localAppData = String(env.LOCALAPPDATA || `${home}/AppData/Local`).replace(/\\/g, '/')
  const xdgData = String(env.XDG_DATA_HOME || `${home}/.local/share`).replace(/\\/g, '/')
  return String(p)
    .replace(/\{home\}/g, home)
    .replace(/\{appData\}/g, appData)
    .replace(/\{localAppData\}/g, localAppData)
    .replace(/\{xdgData\}/g, xdgData)
}

/** 注册表 ⇒ 有序面清单(主库面 → 次库面 → 文件族 → 键族)。顺序即"同分时优先用谁"。 */
export function appFaces(spec) {
  if (!spec) throw new CheckError('appFaces: 缺少 spec', 'bad-app')
  const faces = []
  if (spec.dbCandidates && spec.sessions) {
    faces.push({
      kind: 'sqlite',
      label: spec.label,
      dbCandidates: spec.dbCandidates,
      sessions: spec.sessions,
      messages: spec.messages,
      rawScan: spec.rawScan,
      accountCols: spec.accountCols || [],
    })
  }
  for (const d of spec.dbs || []) {
    faces.push({
      kind: 'sqlite',
      label: d.label || spec.label,
      dbCandidates: d.dbCandidates,
      sessions: d.sessions,
      messages: d.messages,
      rawScan: d.rawScan || spec.rawScan,
      accountCols: d.accountCols || [],
    })
  }
  if (spec.fileSet) faces.push({ kind: 'fileSet', label: spec.label, fileSet: spec.fileSet })
  if (spec.keyCount) faces.push({ kind: 'keyCount', label: spec.label, keyCount: spec.keyCount })
  return faces
}

/** 一面的候选路径(未展开令牌) */
function faceCandidates(face) {
  if (face.kind === 'sqlite') return face.dbCandidates || []
  return [face.fileSet?.root ?? face.keyCount?.root].filter(Boolean)
}

export class CheckError extends Error {
  constructor(message, code = 'switch-check') {
    super(message)
    this.name = 'CheckError'
    this.code = code
  }
}

/**
 * 候选路径枚举:本机 home 展开 / 原样 / APPDATA 重定向 / 跨 profile 兜底各可能持有数据
 * (本机实锤:Loomy 沙箱身份的 .minimax 存在但 0 行,Administrator 的才有 25 场会话)。
 * 绝不"取第一个存在的" —— 那会把"从没登过记的身份"冒充成本机会话面。
 * face 省略 ⇒ 该应用**所有面**的候选并集(测试与 locate 诊断用);给 face ⇒ 只该面。
 */
export function locateDbAll(appKey, env = process.env, face = null) {
  const spec = APPS[appKey]
  if (!spec) throw new CheckError(`不认识的应用:${appKey}(可用 = ${Object.keys(APPS).join('/')})`, 'bad-app')
  const out = []
  const push = (p) => {
    if (p && fs.existsSync(p)) {
      const abs = path.resolve(p)
      if (!out.some((x) => x === abs)) out.push(abs)
    }
  }
  const home = String(env.USERPROFILE || env.HOME || os.homedir())
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
  const faces = face ? [face] : appFaces(spec)
  const templates = [...new Set(faces.flatMap(faceCandidates))]
  for (const t of templates) {
    // 1) 令牌按本 env 展开 2) APPDATA 被重定向(测试/沙箱)时,再按该 APPDATA 展开一次
    push(resolveDataPath(t, env))
    if (env.APPDATA && /^\{appData\}\//.test(t)) {
      push(`${String(env.APPDATA).replace(/\\/g, '/')}/${t.slice('{appData}/'.length)}`)
    }
  }
  // 跨 profile 兜底(与 trae-auth-extract 同法,连它的关闭开关也同法:IHUI_TRAE_SCAN_USERS=0 ⇒ 关扫描档)
  const usersRoot = path.dirname(home).replace(/\\/g, '/')
  if (
    String(env.IHUI_TRAE_SCAN_USERS ?? '').trim() !== '0' &&
    /^[A-Za-z]:\/Users$/.test(usersRoot) &&
    fs.existsSync(usersRoot)
  ) {
    for (const u of fs.readdirSync(usersRoot)) {
      for (const t of templates) {
        if (!t.startsWith('{home}/')) continue // 只对有 home 语义的候选换用户名,不猜别处
        push(`${usersRoot}/${u}/${t.slice('{home}/'.length)}`)
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
 * IndexedDB 记录键 ⇒ 字符串主键。布局(Chromium IDB leveldb,2026-11-10 按本机真键逐字节核):
 *   \x00 \x01 <database_id varint> <object_store_id varint> \x01 <varint 字符数> UTF-16**BE**
 * 旧实现把 buf[2] 钉成 0x02、store 定死在 buf[3]:真机 Loomy 键是
 *   `00 01 01 01 01 0a 0074 0068…`(db=1/store=1)与 `00 01 02 01 01 1e 0073…`(db=2/store=1,
 *   会话记录)—— 旧判据全拒收 ⇒ 数出恒 0,这就是"空转"的根。
 * 解不成(库元数据键 / 索引键 / 非字符串主键 / 编码随版本漂移)⇒ null,由调用方跳过。
 */
export function decodeIdbStringKey(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 6) return null
  if (buf[0] !== 0x00 || buf[1] !== 0x01) return null
  const db = decodeVarint(buf, 2)
  if (!db) return null
  const store = decodeVarint(buf, db.next)
  if (!store) return null
  if (buf[store.next] !== 0x01) return null // 主键类型不是 string ⇒ 跳过,不猜
  const n = decodeVarint(buf, store.next + 1)
  if (!n) return null
  const chars = Number(n.value)
  if (!Number.isSafeInteger(chars) || chars <= 0 || n.next + chars * 2 > buf.length) return null
  const body = Buffer.from(buf.subarray(n.next, n.next + chars * 2))
  body.swap16()
  return body.toString('utf16le')
}

/**
 * 活主键:只读重放 .log/.ldb ⇒ 取当前有效键(后写为准、tombstone 即删)⇒ 解字符串主键 ⇒
 * 只留 keyPrefix 前缀 ⇒ 按主键去重(同一枚会话主键会同时落在数据 store 与索引 store)。
 */
export function listKeyCountLiveIds(dir, spec) {
  const { entries } = readLevelDbEntries(dir, fs, path)
  const ids = new Set()
  for (const k of entries.keys()) {
    const s = decodeIdbStringKey(Buffer.from(k, 'latin1'))
    if (s && s.startsWith(spec.keyPrefix)) ids.add(s)
  }
  return [...ids].sort()
}

/**
 * 日志历史 id(2026-11-10 现读立因,不是补全):Loomy 每轮把整份会话记录**连索引一起 tombstone**
 * (000003.log 尾部 seq 1428–1435 就是一整批 delete),所以活主键恒 0 —— 拿"活主键"当会话面
 * 等于永远数 0(= 又一次空转)。故补扫重放日志的**每条 WriteBatch**(不折叠 tombstone):
 *   ① 键:解码成字符串且带 keyPrefix 的(会话记录主键);
 *   ② 值:Loomy 用 V8 结构克隆单字节串存值(`"` + 长度 + 原文),
 *      会话 id 以明文出现在 `{"sessionId":"ses_…"}` / `loomy-current-task` 指针 / 索引值里。
 * 两处并集 = "本机日志可证存在过的会话 id 全集"(本机现读 8 条记录 + 2 枚仅指针/索引引用 = 10)。
 * 局限(结构决定):append-only 日志被压缩成 .ldb 后历史 id 会随之消失 ⇒ 只承诺"同法两次快照
 * 的差集",不承诺跨压缩恒定;本函数只读,不加锁、不改客户端文件。
 */
export function listKeyCountHistoryIds(dir, spec) {
  const re = new RegExp(`${spec.keyPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[A-Za-z0-9_-]{8,}`, 'g')
  const ids = new Set()
  let files = []
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => /^\d+\.log$/.test(f))
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
  } catch {
    return []
  }
  for (const f of files) {
    let buf
    try {
      buf = fs.readFileSync(path.join(dir, f))
    } catch {
      continue // 读不动 ⇒ 该文件不计,不猜
    }
    for (const rec of parseLogRecords(buf)) {
      const batch = parseBatch(rec.payload)
      if (!batch) continue
      for (const e of batch.entries) {
        const fromKey = decodeIdbStringKey(Buffer.from(e.key))
        if (fromKey && fromKey.startsWith(spec.keyPrefix)) ids.add(fromKey)
        if (!e.value) continue
        // 值的字符串布局是 latin1 可见的单字节串;直接按 latin1 扫 token 即可(utf8 会丢长度前缀)
        for (const m of e.value.toString('latin1').matchAll(re)) ids.add(m[0])
      }
    }
  }
  return [...ids].sort()
}

/**
 * keyCount 形态最终清单 = 活主键 ∪ 日志历史 id(排序后即清单钉)。
 * liveCount 单独报出(snapshot.sessions.liveCount):两个数一起看才分得清
 * "客户端把记录都 tombstone 了"与"本机从没有过会话"。
 */
export function listKeyCountIds(dir, spec) {
  const ids = new Set([...listKeyCountLiveIds(dir, spec), ...listKeyCountHistoryIds(dir, spec)])
  return [...ids].sort()
}

/**
 * 字节级会话 id 残留扫描(2026-11-10 立因,不是补全):
 *   codearts / opencode 的会话表被清成 0 行 ⇒ SQL 口径恒 0 ⇒ 对账器只能报 undetermined,
 *   这两个平台的会话保全**等于没有实际保障**(切号把会话删了也看不出来)。
 * 本机当日只读实测:
 *   - opencode opencode.db 24.4MB:session_v2/session_message/session_part 全 0 行,
 *     page_count 5947 / freelist_count 3024 ⇒ 12MB 空闲页里仍有 265 处 ses_ 串、3 枚不同会话 id;
 *   - codearts opencode.db 31.9MB:session/message/part 全 0 行,freelist 7731/7785,
 *     13591 处 ses_ 串、183 枚不同会话 id;-wal 0 字节。
 * id 形状两库一致 = `ses_` + 26 字符(游程长度分布里 26 是绝对多数:opencode 167/265、
 * codearts 11951/13591;更长的游程是 id 后面**粘着 next 列**:"assistant"/"user"/"idle",
 * 因为 SQLite 记录体里相邻 text 值没有分隔符)⇒ 取游程前 idLength 字符即 id。
 * 短于 idLength 的游程是页边界截断残片(如 ses_e3f0e),**不猜**、直接丢。
 * 局限(结构决定,写进快照 note 而非藏着):这是**历史残留**,不是活会话;
 * 空闲页会被后续写入复用、VACUUM / secure_delete 会抹掉 ⇒ 只承诺"同法两次快照的差集"。
 */
export function extractSessionIds(buf, rawScan) {
  const prefix = String(rawScan?.prefix ?? 'ses_')
  const idLength = Number(rawScan?.idLength ?? 26)
  if (!Number.isSafeInteger(idLength) || idLength <= 0) return []
  // 前缀里的正则元字符必须转义(prefix 由注册表给,但仍按数据对待)
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`${esc}[A-Za-z0-9]{${idLength},}`, 'g')
  const ids = new Set()
  const s = buf.toString('latin1') // 单字节可逆:id 是 ascii,utf8 解码会在二进制里丢字节
  for (const m of s.matchAll(re)) ids.add(m[0].slice(0, prefix.length + idLength))
  return [...ids].sort()
}

/** 单趟:逐文件扫(主库 + `-wal` 各算一份,未 checkpoint 的最新行就在 WAL 里) */
export function scanRawSessionIds(files, rawScan, read = (f) => fs.readFileSync(f)) {
  const ids = new Set()
  for (const f of files) {
    let buf
    try {
      buf = read(f)
    } catch {
      continue // 读不动(被占/不存在)⇒ 该文件不计,不猜
    }
    for (const id of extractSessionIds(buf, rawScan)) ids.add(id)
  }
  return [...ids].sort()
}

/**
 * 两趟扫描 + 稳定性校验:客户端的活库/活 WAL 随时在变,单趟数出来的数不可信。
 * 两趟结果逐项相同才算数,不同 ⇒ `stable:false`(调用方必须降级 undetermined,不许冒绿)。
 * `passes` = 两趟各自的条数,写进 why 供人看出"到底抖成什么样"。
 */
export function rawScanSessionIds(files, rawScan, opts = {}) {
  const read = opts.read || ((f) => fs.readFileSync(f))
  const a = scanRawSessionIds(files, rawScan, read)
  const b = scanRawSessionIds(files, rawScan, read)
  const stable = a.join('\n') === b.join('\n')
  return { stable, ids: stable ? a : [], passes: [a.length, b.length] }
}

/** 单面(单个候选)的会话数:-1 = 读不成(被占/非 SQLite/无该表),0 = 读成但零会话 */
function countFace(face, file) {
  if (face.kind === 'fileSet') return listFileSet(file, face.fileSet).length
  if (face.kind === 'keyCount') return listKeyCountIds(file, face.keyCount).length
  let h = null
  try {
    h = new DatabaseSync(file, { readOnly: true })
    const tables = h.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => String(r.name))
    if (!tables.includes(face.sessions.table)) return 0 // 表族对不上 ⇒ 该库不是这个面
    const where = face.sessions.where ? ` WHERE ${face.sessions.where}` : ''
    return Number(h.prepare(`SELECT COUNT(*) c FROM "${face.sessions.table}"${where}`).get().c)
  } catch {
    return -1 // 读不成 ⇒ 不猜
  } finally {
    try {
      h?.close()
    } catch {
      /* ignore */
    }
  }
}

/**
 * 定位"本机现役会话面":把该应用**每一面、每个候选**都数一遍。
 * 取舍规则(2026-11-10 按四端整改定,不再"哪面数大用哪面"):
 *   ① 面之间按注册表顺序优先 —— 主库面在前,回落面在后(**库能读且不为空就用库**,
 *      库空才用文件族;zcode 的 cli 库在前、tasks-index 在后,同一面内取有数据的候选);
 *   ② 同一面内多候选(跨 profile 等)取会话数最大者;
 *   ③ 全 0 ⇒ {file:null, scored}(调用方如实报"存在会话面但零会话",不冒充未装)。
 * 排序后的 scored 仍按会话数降序,供调用方逐面报数(faces/fallback)。
 */
export function pickRichestDb(appKey, env = process.env) {
  const spec = APPS[appKey]
  if (!spec) throw new CheckError(`不认识的应用:${appKey}(可用 = ${Object.keys(APPS).join('/')})`, 'bad-app')
  const faces = appFaces(spec)
  const scored = []
  faces.forEach((face, faceIndex) => {
    for (const file of locateDbAll(appKey, env, face)) {
      let n = -1
      try {
        n = countFace(face, file)
      } catch {
        /* 该候选读不成 ⇒ 记 -1 不猜 */
      }
      scored.push({ file, kind: face.kind, faceIndex, sessions: n })
    }
  })
  // 胜出者:按面顺序找第一个有数据的面,该面内取最大候选
  let entry = null
  for (let i = 0; i < faces.length; i++) {
    const inFace = scored.filter((s) => s.faceIndex === i && s.sessions > 0)
    if (inFace.length) {
      entry = inFace.reduce((a, b) => (b.sessions > a.sessions ? b : a))
      break
    }
  }
  scored.sort((a, b) => b.sessions - a.sessions)
  return { file: entry ? entry.file : null, entry, scored }
}

/**
 * 对副本做 WAL checkpoint 后打开(只读输入哲学:绝不锁客户的活库)。
 * 副本落 <仓根>/.ihui-agent/tmp/cont-probe/(gitignored;env.IHUI_CONT_PROBE_DIR 可改),
 * 该处不可写才退 os.tmpdir();调用方读完即整目录删(见 snapshotApp 的 finally)。
 */
export function openReadOnlyCopy(dbFile, env = process.env) {
  const probeRoot =
    String(env.IHUI_CONT_PROBE_DIR || '').trim() ||
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.ihui-agent', 'tmp', 'cont-probe')
  let dir
  try {
    fs.mkdirSync(probeRoot, { recursive: true })
    dir = fs.mkdtempSync(path.join(probeRoot, 'run-'))
  } catch {
    dir = fs.mkdtempSync(path.join(os.tmpdir() || os.homedir(), 'ihui-switch-check-'))
  }
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
  return { db, dir, merged, file: copy }
}

/** 副本目录整棵删(含 -wal/-shm;Windows 句柄释放有延迟 ⇒ 退避重试 3 次,失败只告警不炸) */
function removeCopyDir(dir) {
  for (let i = 0; i < 3; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
      return
    } catch {
      const t = Date.now()
      while (Date.now() - t < 60 * (i + 1)) {
        /* 退避 */
      }
    }
  }
}

const fp = (s) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12)

/** 采一枚会话清单:ids 排序后哈希 + 条数(不含正文) */
export function digestSet(db, sql, params = []) {
  const rows = db.prepare(sql).all(...params)
  const ids = rows.map((r) => String(Object.values(r)[0])).sort()
  const h = crypto.createHash('sha1').update(ids.join('\n')).digest('hex')
  return { count: ids.length, digest: h.slice(0, 16), ids }
}

/** 面计数摘要(未判定时写进 why:必须把每一面各自的数说清楚,不能只报一个 0) */
function describeFaces(scored) {
  if (!scored.length) return '本机找不到该应用的任何会话面(未装/未登录/路径变了)'
  return scored
    .map((s) => `${s.kind === 'sqlite' ? '库' : s.kind === 'fileSet' ? '文件族' : '键族'} ${s.file}=${s.sessions < 0 ? '读不成' : `${s.sessions} 份`}`)
    .join(' | ')
}

/** 目录/键族面快照:清单钉 = 相对 id 集合(排序后哈希,零正文) */
function listFaceSnapshot(appKey, spec, face, dir, scored = []) {
  const ids = face.kind === 'fileSet' ? listFileSet(dir, face.fileSet) : listKeyCountIds(dir, face.keyCount)
  // 目录在、清单 0 ⇒ 未判定(§0.3):"读成空"与"没装"都不是"切号后完好"
  if (ids.length === 0) {
    return {
      app: appKey,
      state: 'undetermined',
      why: `会话面存在但数出 0 份会话(客户端清空/编码变了/尚未产生对话):${dir}${scored.length ? ` ｜ ${describeFaces(scored)}` : ''}`,
      faces: scored.length ? scored.map((s) => ({ kind: s.kind, path: s.file, count: s.sessions })) : undefined,
    }
  }
  const h = crypto.createHash('sha1').update(ids.join('\n')).digest('hex')
  const sessions = { count: ids.length, digest: h.slice(0, 16) }
  // Loomy 的活主键数(与"日志历史全集"分开报:两个数一起才读得出客户端把记录 tombstone 了)
  if (face.kind === 'keyCount') {
    try {
      sessions.liveCount = listKeyCountLiveIds(dir, face.keyCount).length
    } catch {
      sessions.liveCount = null
    }
  } else {
    sessions.liveCount = ids.length // 文件族:一份文件就是一份实存会话,两个数同口径
  }
  return {
    app: appKey,
    label: spec.label,
    state: 'ok',
    mode: face.kind,
    dbFile: dir,
    walMerged: null,
    takenAt: new Date().toISOString(),
    sessions,
    messageRows: null,
    sessionsWithMessages: null,
    accountDigests: [],
    sessionIds: ids.map(fp),
  }
}

/** 字节残留口径的 note(必须说清"历史残留"而不是"活会话",否则会被当绿读) */
const rawScanNote = (n) =>
  `库表 0 行,用文件字节扫描得到 ${n} 个历史会话 id(含 freelist/wal 残留)`

/**
 * SQLite 面快照(库优先;副本 + WAL checkpoint,绝不锁活库)。
 * 会话表 0 行时(或表族对不上)走 `rawScan` 字节兜底:见 extractSessionIds 的立因与局限。
 * 两个数分开报:`sessions.count`=历史 id 数(切前/切后比这个,只增不减),`sessions.liveCount`=SQL 活行数。
 */
function sqliteFaceSnapshot(appKey, spec, face, dbFile, opts = {}) {
  const { db, dir, merged: walMerged, file: copyFile } = openReadOnlyCopy(dbFile)
  try {
    const s = face.sessions
    const where = s.where ? ` WHERE ${s.where}` : ''
    const distinctKw = s.distinct ? 'DISTINCT ' : ''
    let sess
    let tableMissing = false
    try {
      sess = digestSet(db, `SELECT ${distinctKw}"${s.idCol}" FROM "${s.table}"${where}`)
    } catch (e) {
      // 表族对不上(升级改了表名)且该面有字节兜底 ⇒ 按 0 行处理,走残留扫描;否则照旧抛
      if (!face.rawScan) throw e
      tableMissing = true
      sess = { count: 0, digest: '', ids: [] }
    }
    let msgs = null
    if (face.messages) {
      const m = face.messages
      try {
        msgs = digestSet(db, `SELECT "${m.idCol}" FROM "${m.table}"`)
      } catch {
        msgs = null // 消息表被清掉/改名:不拿会话数冒充消息数
      }
    }
    const perSession = sess.count > 0 && face.messages?.sessionCol
      ? db.prepare(`SELECT COUNT(DISTINCT "${face.messages.sessionCol}") c FROM "${face.messages.table}"`).get()
      : null
    const acc = (face.accountCols || []).map((ac) => {
      const [t, c] = ac.split('.')
      try {
        return db.prepare(`SELECT DISTINCT "${c}" v FROM "${t}" LIMIT 5`).all().map((r) => fp(String(r.v)))
      } catch {
        return null
      }
    })

    // ── 0 行(或表不存在)时的字节兜底:比 count,报 liveCount,不稳定就降级 ──
    if (sess.count === 0 && face.rawScan) {
      const res = rawScanSessionIds([copyFile, `${copyFile}-wal`], face.rawScan, {
        read: opts.rawScanReader,
      })
      if (!res.stable) {
        return {
          app: appKey,
          label: spec.label,
          state: 'undetermined',
          why: `库表 ${tableMissing ? '不存在' : '0 行'},字节残留两次扫描不一致(${res.passes[0]} vs ${res.passes[1]} 枚 ⇒ 文件正被写入)⇒ 不拿不稳定的数冒绿:${dbFile}`,
          dbFile,
          walMerged,
          mode: 'raw-scan',
        }
      }
      if (res.ids.length === 0) {
        return {
          app: appKey,
          label: spec.label,
          state: 'undetermined',
          why: `库表 ${tableMissing ? '不存在' : '0 行'}且文件字节里扫不到 ${face.rawScan.prefix}* 残留(从未产生对话 / 已被 VACUUM 抹除 / id 形状变了)⇒ 未判定:${dbFile}`,
          dbFile,
          walMerged,
          mode: 'raw-scan',
        }
      }
      const rawDigest = crypto.createHash('sha1').update(res.ids.join('\n')).digest('hex')
      return {
        app: appKey,
        label: spec.label,
        state: 'ok',
        mode: 'raw-scan',
        dbFile,
        walMerged,
        takenAt: new Date().toISOString(),
        // count = 历史 id 数(切前/切后比这个:切号只搬不删,只增不减);liveCount = SQL 活行数
        sessions: { count: res.ids.length, liveCount: sess.count, digest: rawDigest.slice(0, 16) },
        messageRows: null,
        sessionsWithMessages: null,
        accountDigests: acc.filter(Boolean).flat(),
        sessionIds: res.ids.map(fp),
        note: rawScanNote(res.ids.length),
      }
    }

    return {
      app: appKey,
      label: spec.label,
      state: 'ok',
      mode: 'sqlite',
      dbFile,
      walMerged,
      takenAt: new Date().toISOString(),
      sessions: { count: sess.count, liveCount: sess.count, digest: sess.digest },
      messageRows: msgs ? { count: msgs.count, digest: msgs.digest } : null,
      sessionsWithMessages: perSession ? Number(perSession.c) : null,
      accountDigests: acc.filter(Boolean).flat(),
      sessionIds: sess.ids.map(fp),
    }
  } finally {
    db.close()
    removeCopyDir(dir)
  }
}

/** 给已选面补 faces(逐面数)与 fallback(另一形态的最高数):两边都要报,不合并成一个 0 */
function withFaceReport(snap, spec, scored, chosen) {
  if (scored.length) {
    snap.faces = scored.map((s) => ({ kind: s.kind, path: s.file, count: s.sessions }))
    const other = scored.find((s) => s.kind !== chosen.kind)
    if (other) snap.fallback = { kind: other.kind, path: other.file, count: other.sessions }
  }
  return snap
}

/**
 * 字节兜底救援:所有面的**活行数**都是 0 时才走到这里(pickRichestDb 只在 >0 里选)。
 * 逐候选两趟扫描残留 id,取最多者复拍一枚 raw-scan 快照;一条都没扫到 ⇒ null(调用方照旧报未判定)。
 * 为什么不让 countFace 直接算残留:那样会把"历史 id 数"混进"活行数",chosen 面的优先级就乱了
 * (codearts 库残留 183 枚 vs chatSessions 实存 5 份 ⇒ 会拿历史压活会话)。
 */
function rawScanRescue(appKey, spec, env, opts) {
  let best = null
  for (const face of appFaces(spec)) {
    if (face.kind !== 'sqlite' || !face.rawScan) continue
    for (const file of locateDbAll(appKey, env, face)) {
      const res = rawScanSessionIds([file, `${file}-wal`], face.rawScan, { read: opts.rawScanReader })
      if (!res.stable || res.ids.length === 0) continue
      if (!best || res.ids.length > best.n) best = { file, face, n: res.ids.length }
    }
  }
  if (!best) return null
  const snap = sqliteFaceSnapshot(appKey, spec, best.face, best.file, opts)
  if (snap.state !== 'ok') return null // 复拍不稳/无残留 ⇒ 不冒绿,交回未判定
  return { snap, face: best.face }
}

/**
 * 拍一枚会话面快照。
 *   - opts.dbPath:测试/指定路径 —— 给目录 ⇒ 文件族/键族面;给文件 ⇒ SQLite 面。
 *   - opts.rawScanReader:注入字节读取(测试夹具用,模拟"同一路径两次读到的字节不同")
 *   - 否则按 pickRichestDb 逐面打分取最大者,并把逐面数(faces)与另一形态(fallback)一并报出;
 *     全 0 时对带 rawScan 的面做字节残留兜底(见 rawScanRescue)。
 */
export function snapshotApp(appKey, opts = {}) {
  const env = opts.env ?? process.env
  const spec = APPS[appKey]
  if (!spec) throw new CheckError(`不认识的应用:${appKey}(可用 = ${Object.keys(APPS).join('/')})`, 'bad-app')
  const faces = appFaces(spec)

  if (opts.dbPath) {
    const isDir = fs.existsSync(opts.dbPath) && fs.statSync(opts.dbPath).isDirectory()
    const face = isDir
      ? faces.find((f) => f.kind === 'fileSet') ?? faces.find((f) => f.kind === 'keyCount')
      : faces.find((f) => f.kind === 'sqlite')
    if (!face) throw new CheckError(`${appKey} 没有 ${isDir ? '目录' : 'SQLite'} 形态的会话面`, 'bad-app')
    return face.kind === 'sqlite'
      ? sqliteFaceSnapshot(appKey, spec, face, opts.dbPath, opts)
      : listFaceSnapshot(appKey, spec, face, opts.dbPath)
  }

  const picked = pickRichestDb(appKey, env)
  if (!picked.file) {
    const rescued = rawScanRescue(appKey, spec, env, opts)
    if (rescued) return withFaceReport(rescued.snap, spec, picked.scored, rescued.face)
    return {
      app: appKey,
      state: 'undetermined',
      why:
        (picked.scored.length > 0
          ? `各面会话数全为 0 或读不成(可能本机该身份从未用过它):${describeFaces(picked.scored)}`
          : describeFaces([])) + (spec.hint ? ` ｜ ${resolveDataPath(spec.hint, env)}` : ''),
      faces: picked.scored.map((s) => ({ kind: s.kind, path: s.file, count: s.sessions })),
    }
  }
  const best = picked.entry
  const face = faces[best.faceIndex]
  const snap =
    face.kind === 'sqlite'
      ? sqliteFaceSnapshot(appKey, spec, face, picked.file, opts)
      : listFaceSnapshot(appKey, spec, face, picked.file)
  return withFaceReport(snap, spec, picked.scored, face)
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
  // 字节残留口径必须标在结论上:两侧都是"历史 id 数"时,ok 只代表"没有被删掉的痕迹",不代表活会话在位
  const rawSides = [before, after].filter((s) => s.mode === 'raw-scan').length
  return {
    verdict: lost.length === 0 ? 'continuity-ok' : 'continuity-broken',
    beforeSessions: before.sessions.count,
    afterSessions: after.sessions.count,
    lostFp: lost,
    gainedFp: gained,
    messageRowsBefore: before.messageRows?.count ?? null,
    messageRowsAfter: after.messageRows?.count ?? null,
    note:
      (lost.length === 0
        ? `切号后本地会话清单完整在位(${before.sessions.count} 场)`
        : `⚠️ 切号后有 ${lost.length} 场会话不在清单 ⇒ 产品 UI 按账号换列表,需做携号迁移腿`) +
      (rawSides ? ` ｜ 口径:${rawSides} 侧为文件字节残留的历史 id 数(非活会话,库表 0 行)` : ''),
  }
}

export const __test__ = {
  APPS,
  CheckError,
  appFaces,
  resolveDataPath,
  locateDbAll,
  pickRichestDb,
  countFace,
  listFileSet,
  listKeyCountIds,
  listKeyCountLiveIds,
  listKeyCountHistoryIds,
  decodeIdbStringKey,
  digestSet,
  extractSessionIds,
  scanRawSessionIds,
  rawScanSessionIds,
  snapshotApp,
  compareSnapshots,
  openReadOnlyCopy,
  fp,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
