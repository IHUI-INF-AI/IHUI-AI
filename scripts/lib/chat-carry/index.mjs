// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池全平台「切号对话随行」统一注册面(2026-11-22 立,机主令:所有平台都要有这能力)。
 *
 * 立因:此前只有 trae / workbuddy 两条重绑链,其余平台靠一句「本地无账号维度、切号后历史
 * 天然在」的静态结论 —— 那是断言,不是能力:客户端换个版本加了 user_id / uid 前缀过滤,
 * 历史就会静悄悄消失而切号仍报成功。本模块把「能力」落成可执行的三档,并对每个平台
 * 每次切号都真跑一遍:
 *
 *   rebind —— 会话带账号维度,切号必须改归属(现在两平台:trae / workbuddy)。
 *              trae 由 scripts/switch-trae-client-with-chat.mjs 专用链负责(解密正库 + 四处重绑);
 *              workbuddy 由 lib/workbuddy-chat-carry.mjs 负责(三表重绑 + 可见性复活 + 快照合并)。
 *   local  —— 会话库不带账号维度 ⇒ 切号后历史天然在。能力 = 每次切号现场只读核验:
 *              找到库 → 数条数 → 确认没有账号维度;发现多了账号列就立刻升档报
 *              `account-scoped-store`(绝不继续冒绿)。
 *   cloud  —— 会话在云端且绑账号、本地零副本(豆包):本地无迁移路径,走
 *              scripts/doubao-carry.mjs 的导出 + 回放(新号下以新会话重建)。
 *
 * 纪律(§0.3/§0.6):判据全部在本文件与 local-store 探针里单源;切号编排层只拿结论,
 * 不自己发明"应该没事"。任何取不到 ⇒ ok:false + code,绝不返回"0 条 = 成功"。
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import * as wbCarry from '../workbuddy-chat-carry.mjs'
import { probeLeveldb, probeSqlite, probeVscdb } from './local-store.mjs'

const require = createRequire(import.meta.url)

export const CARRY_KINDS = Object.freeze(['rebind', 'local', 'cloud'])

/** 平台能力矩阵(单源)。UI/CLI/切换编排都从这里取,不再各写一份文案。 */
export const CARRY_MATRIX = Object.freeze({
  trae: {
    kind: 'rebind',
    label: 'Trae',
    auto: 'dedicated',
    detail: '正库(SQLCipher)+ vscdb 键前缀 + storage.json 四处重绑,切完直接接着聊',
  },
  workbuddy: {
    kind: 'rebind',
    label: 'WorkBuddy',
    auto: 'switch-entry',
    detail: 'sessions/spaces/automations 重绑 + 侧边栏快照合并 + 可见性复活(切号瞬间被软删的行)',
  },
  qoder: { kind: 'local', label: 'Qoder', auto: 'verify', detail: '本地 main.sqlite/chat_sessions 不含账号列,切号后历史天然在' },
  minimax: {
    kind: 'local',
    label: 'MiniMax Code',
    auto: 'verify',
    detail: '本地 runtime-state.sqlite/local_runtime_sessions 不含账号列,切号后历史天然在',
  },
  codearts: {
    kind: 'local',
    label: 'CodeArts',
    auto: 'verify',
    detail: '本地 state.vscdb 键面;发现 uid 前缀键即判定需重绑并报错',
  },
  zcode: { kind: 'local', label: 'ZCode', auto: 'verify', detail: '本地 cli/db/db.sqlite/session 不含账号列,切号后历史天然在' },
  opencode: {
    kind: 'local',
    label: 'OpenCode',
    auto: 'verify',
    detail: '本地 storage/session 按会话落文件,不含账号维度,切号后历史天然在',
  },
  loomy: {
    kind: 'local',
    label: 'Loomy',
    auto: 'verify',
    detail: '本地 Local Storage/LevelDB;DOM Storage 无账号键,切号后历史天然在',
  },
  codex: {
    kind: 'local',
    label: 'Codex',
    auto: 'verify',
    detail: '本地 state_5.sqlite/threads + sessions/*.jsonl;creator_* 列实测全 NULL,切号后历史天然在',
  },
  raccoon: {
    kind: 'local',
    label: '小浣熊',
    auto: 'verify',
    detail: '本地 vscdb/LevelDB 面;探不到会话库时如实 unlocated,不冒充通过',
  },
  doubao: {
    kind: 'cloud',
    label: '豆包',
    auto: 'replay',
    detail: '云端账号库、本地零副本:用 scripts/doubao-carry.mjs --export/--replay 回放迁移',
  },
})

export const POOL_PROVIDERS = Object.freeze(Object.keys(CARRY_MATRIX))

/** 每个平台的存储探针描述(只读;路径全部走 ${ENV}/~ 展开,测试可注入 env) */
export const STORE_SPECS = Object.freeze({
  trae: () => ({
    probe: probeVscdb,
    spec: {
      provider: 'trae',
      candidates: [
        '${APPDATA}/Trae CN/User/globalStorage/state.vscdb',
      ],
    },
  }),
  codearts: () => ({
    probe: probeVscdb,
    spec: {
      provider: 'codearts',
      candidates: ['${APPDATA}/codearts-agent/User/globalStorage/state.vscdb'],
    },
  }),
  raccoon: () => ({
    probe: probeVscdb,
    spec: {
      provider: 'raccoon',
      candidates: [
        '${APPDATA}/office-raccoon/User/globalStorage/state.vscdb',
        '${LOCALAPPDATA}/office-raccoon/User/globalStorage/state.vscdb',
      ],
    },
  }),
  qoder: () => ({
    probe: probeSqlite,
    spec: {
      provider: 'qoder',
      candidates: [
        '${APPDATA}/com.qodercn.app.stable/main.sqlite',
        '${APPDATA}/com.qoder.app.stable/main.sqlite',
      ],
      table: 'chat_sessions',
      idCol: 'session_id',
      titleCol: 'title',
      deletedCol: 'deleted_at',
    },
  }),
  minimax: () => ({
    probe: probeSqlite,
    spec: {
      provider: 'minimax',
      candidates: ['~/.minimax/v2/sqlite/runtime-state.sqlite', '${APPDATA}/MiniMax/runtime-state.sqlite'],
      table: 'local_runtime_sessions',
      idCol: 'session_id',
      titleCol: 'title',
      deletedCol: 'archived',
    },
  }),
  zcode: () => ({
    probe: probeSqlite,
    spec: {
      provider: 'zcode',
      candidates: ['~/.zcode/cli/db/db.sqlite', '${APPDATA}/ZCode/cli/db/db.sqlite'],
      table: 'session',
      idCol: 'id',
      titleCol: 'title',
      deletedCol: 'time_deleted',
    },
  }),
  codex: () => ({
    probe: probeSqlite,
    spec: {
      provider: 'codex',
      candidates: ['~/.codex/state_5.sqlite', '${APPDATA}/codex/state_5.sqlite'],
      table: 'threads',
      idCol: 'id',
      titleCol: 'title',
      deletedCol: 'archived_at',
    },
  }),
  opencode: () => ({
    probe: probeLeveldb,
    spec: {
      provider: 'opencode',
      candidates: [
        '${APPDATA}/ai.opencode.desktop/Local Storage/leveldb',
        '~/.local/share/opencode/storage',
      ],
    },
  }),
  loomy: () => ({
    probe: probeLeveldb,
    spec: {
      provider: 'loomy',
      candidates: ['${APPDATA}/Loomy/Local Storage/leveldb'],
    },
  }),
  doubao: () => ({
    probe: null,
    spec: null,
  }),
  workbuddy: () => ({
    probe: null, // 走 lib/workbuddy-chat-carry.mjs 的专用读写链,不走通用只读探针
    spec: null,
  }),
})

/** 平台是否装在本机(探不到会话库时用来区分"没装"与"落点变了") */
const INSTALL_NAME_RE = {
  raccoon: /raccoon/i,
  opencode: /opencode/i,
  loomy: /loomy/i,
  codearts: /codearts/i,
}

function probeInstalled(provider, env = process.env) {
  const re = INSTALL_NAME_RE[provider]
  if (!re) return null // 不在表内的平台:不做"未装"判定,未定位一律按真问题报
  for (const base of [env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs'), env.ProgramFiles]) {
    if (!base) continue
    try {
      for (const e of fs.readdirSync(base, { withFileTypes: true })) {
        if (re.test(e.name)) return true
      }
    } catch {
      /* 目录不存在 */
    }
  }
  return false
}

export function getMatrix(provider) {
  return CARRY_MATRIX[provider] ?? null
}

export function listProviders() {
  return POOL_PROVIDERS.map((p) => ({ provider: p, ...CARRY_MATRIX[p] }))
}

/**
 * 只读核验一个平台的本地会话面。
 * @returns {{provider:string, kind:string, located:boolean, sessions:number|null,
 *            visible:number|null, accountScoped:boolean, notes:string[], raw:object|null}}
 */
export function probeProvider(provider, { env = process.env } = {}) {
  const m = getMatrix(provider)
  if (!m) {
    return { provider, kind: 'unknown', located: false, sessions: null, visible: null, accountScoped: false, notes: [`未登记的平台:${provider}(不猜)`], raw: null }
  }
  if (provider === 'workbuddy') {
    const home = wbCarry.resolveWorkbuddyHome(env)
    const dbPath = path.join(home, 'workbuddy.db')
    const uid = wbCarry.currentUid(wbCarry.resolveWorkbuddyAuthFile(env))
    let db
    try {
      if (!uid) throw new Error('本机登录态取不到 uid')
      const { DatabaseSync } = require('node:sqlite')
      db = new DatabaseSync(dbPath, { readOnly: true })
      const c = wbCarry.countByOwner(db, uid)
      return {
        provider,
        kind: m.kind,
        located: true,
        sessions: c.total,
        visible: c.localVisible,
        accountScoped: true, // 会话表确有 user_id 维度(见文件头实证)
        notes: [
          `本机当前号 ${uid.slice(0, 8)}:会话 ${c.total}(可见 ${c.localVisible},legacy -1 ${c.localLegacyNegOne})`,
          '该平台带账号维度:切号必须重绑,并复活客户端换号瞬间软删的可见行',
        ],
        raw: { home, uid, counts: c, path: dbPath },
      }
    } catch (e) {
      return {
        provider,
        kind: m.kind,
        located: false,
        sessions: null,
        visible: null,
        accountScoped: true,
        notes: [`WorkBuddy 探针未判定:${e instanceof Error ? e.message : String(e)}`],
        raw: null,
      }
    } finally {
      try {
        db?.close()
      } catch {
        /* 关不掉不影响结论 */
      }
    }
  }
  if (m.kind === 'cloud') {
    return { provider, kind: 'cloud', located: false, sessions: 0, visible: 0, accountScoped: true, notes: [m.detail], raw: null }
  }
  if (provider === 'trae') {
    // trae 的正库是 SQLCipher 加密件,通用探针只核对 vscdb 键面;条数由专用链自证
    const { probe, spec } = STORE_SPECS.trae()
    const r = probe({ ...spec, env })
    return {
      provider,
      kind: 'rebind',
      located: r.located,
      sessions: null,
      visible: r.visible,
      accountScoped: true,
      notes: [...r.notes, '正库条数与重绑结果由 switch-trae-client-with-chat.mjs 专用链自证'],
      raw: r,
    }
  }
  const factory = STORE_SPECS[provider]
  if (!factory) {
    return { provider, kind: m.kind, located: false, sessions: null, visible: null, accountScoped: false, notes: [`${provider} 未登记存储探针(不猜)`], raw: null }
  }
  const { probe, spec } = factory()
  const r = probe({ ...spec, env })
  return {
    provider,
    kind: m.kind,
    located: r.located,
    sessions: r.sessions,
    visible: r.visible,
    accountScoped: r.accountScoped,
    notes: r.notes ?? [],
    raw: r,
  }
}

/**
 * 切号时的对话随行总入口(编排层只调这一个函数)。
 *
 * @param {object} opts
 * @param {string} opts.provider 平台代码
 * @param {string} [opts.fromUid] 切号前本机登录号(workbuddy 重绑必需)
 * @param {string} [opts.toUid]   目标号
 * @param {boolean} [opts.dryRun]
 * @param {string[]} [opts.reviveSessionIds] 切号前抓到的可见会话 id(workbuddy 复活名单)
 * @param {boolean} [opts.reviveHistory] 是否把旧号全部软删会话复活
 * @param {string} [opts.home] 覆盖用户根(测试)
 * @param {Function} [opts.wbImpl] 测试注入 workbuddy runCarry
 */
export function switchCarry(opts = {}) {
  const provider = String(opts.provider ?? '')
  const m = getMatrix(provider)
  if (!m) {
    return { ok: false, provider, kind: 'unknown', action: 'none', code: 'unknown-provider', notes: [`未登记平台:${provider}(不猜)`], moved: null }
  }
  if (m.kind === 'cloud') {
    return {
      ok: true,
      provider,
      kind: 'cloud',
      action: 'replay-required',
      code: '',
      notes: [m.detail, '本次切号未自动回放(网络写入需显式执行 doubao-carry 的 --replay)'],
      moved: null,
    }
  }
  if (m.kind === 'rebind' && provider === 'workbuddy') {
    const fromUid = String(opts.fromUid ?? '').trim()
    const toUid = String(opts.toUid ?? '').trim()
    if (!fromUid || !toUid) {
      return { ok: false, provider, kind: 'rebind', action: 'rebind', code: 'no-uid', notes: ['缺旧号/新号 uid ⇒ 不知道从哪搬到哪,不猜'], moved: null }
    }
    const run = opts.wbImpl ?? wbCarry.runCarry
    try {
      const r = run({
        fromUid,
        toUid,
        home: opts.home ?? wbCarry.resolveWorkbuddyHome(),
        dryRun: Boolean(opts.dryRun),
        reviveSessionIds: opts.reviveSessionIds ?? [],
        reviveHistory: Boolean(opts.reviveHistory),
        runId: opts.runId,
      })
      return {
        ok: true,
        provider,
        kind: 'rebind',
        action: 'rebind',
        code: '',
        moved: r.moved,
        revive: r.revive ?? null,
        snapshot: r.snapshot ?? null,
        notes: r.notes ?? [],
        raw: r,
      }
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : 'carry-failed'
      return { ok: false, provider, kind: 'rebind', action: 'rebind', code, notes: [e instanceof Error ? e.message : String(e)], moved: null }
    }
  }
  if (m.kind === 'rebind' && provider === 'trae') {
    return {
      ok: true,
      provider,
      kind: 'rebind',
      action: 'dedicated',
      code: '',
      notes: ['trae 的重绑由 scripts/switch-trae-client-with-chat.mjs 专用链执行(解密正库→四处重绑→自证);本层只登记能力,不重复搬'],
      moved: null,
    }
  }
  // local:能力 = 现场只读核验;发现账号维度或探不到库 ⇒ 如实失败,不冒绿
  const p = probeProvider(provider, { env: opts.env ?? process.env })
  if (!p.located) {
    return { ok: false, provider, kind: 'local', action: 'verify', code: 'unlocated', notes: p.notes, probe: p }
  }
  if (p.accountScoped) {
    return {
      ok: false,
      provider,
      kind: 'local',
      action: 'verify',
      code: 'account-scoped-store',
      notes: [...p.notes, '该平台本地库出现账号维度 ⇒ 需要新增重绑适配器,不能只靠"本地不带账号"的旧结论',],
      probe: p,
    }
  }
  return {
    ok: true,
    provider,
    kind: 'local',
    action: 'verify',
    code: '',
    notes: [...p.notes, `只读核验通过:会话 ${p.sessions ?? '?'} 条,无账号维度 ⇒ 切号后历史天然在`],
    probe: p,
  }
}

/** 全平台巡检(只读;CLI --audit 用) */
export function auditProviders({ env = process.env } = {}) {
  return POOL_PROVIDERS.map((provider) => {
    const p = probeProvider(provider, { env })
    const installed = p.located ? true : probeInstalled(provider, env)
    const ok =
      p.kind === 'cloud'
        ? true // 云端平台:本地无路径是事实,能力在 doubao-carry 回放链,不算失败
        : installed === false
          ? true // 本机没装:没有可核验的本地面,不算能力缺陷(装/登录后再核验)
          : p.kind === 'rebind'
            ? p.located
            : p.located && !p.accountScoped
    const notes = installed === false ? [...p.notes, '本机未安装该客户端 ⇒ 跳过核验(装/登录后再跑)'] : p.notes
    return {
      provider,
      kind: p.kind,
      installed,
      located: p.located,
      sessions: p.sessions,
      visible: p.visible,
      accountScoped: p.accountScoped,
      ok,
      notes,
      store: p.raw?.path ?? p.raw?.home ?? '',
    }
  })
}

export const __test__ = { STORE_SPECS, CARRY_MATRIX, POOL_PROVIDERS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
