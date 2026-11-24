// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包「一键切号自动带对话」两阶段封装(2026-11-24 立;同日按取证结果改为官方导入通道)。
 *
 * 【2026-11-24 重要修正 —— 上一版判断错误】
 * 上一版结论是「豆包云端没有逐条写回端点 ⇒ 只能把旧对话压成一条文本重发、AI 重新生成 ⇒
 * 做不到 Trae 那种逐条无缝续聊」。这是**没查豆包官方导入通道**导致的误判。实测本机豆包
 * 2.37.16:「设置 → 数据导入与同步」支持从 ChatGPT/Claude Code/TRAE Work 的本地备份导入
 * 历史会话,导入后会话进入原生列表、**逐条保留原有上下文、打开即可接着聊**。
 * 这正是 Trae 式无缝续聊,且是官方能力(不碰私有协议、不伪造会话、不逆向加密库)。
 *
 * 因此本模块主路径改为:
 *   写回前(旧号 cookie):export 逐条导出归档 → 转成 ChatGPT conversations.json 导入文件;
 *   写回后(新号 cookie):产出导入清单 + 操作路径,用户在豆包设置里选该文件导入 ⇒ 原生续聊。
 * 旧版「文本压包重发」(replayArchive)保留为显式兜底函数,但主路径不再默认调用 —— 它
 * 消耗新号额度、AI 重新生成、丢消息结构,不该再冒充"无缝续聊"。
 *
 * 时序纪律(错一步就白搬,这是本模块存在的全部理由):
 *   - export 必须在【写回前】调用:此时本机 Cookies 库还是旧号登录态,才能拉到旧号云端对话;
 *   两阶段之间的归档目录/导入文件由调用方保管,本模块不存全局态。
 *
 * 纪律(§0.3/§0.6/测试隔离铁律):
 *  - 依赖全注入:readCookie / exportArchive / buildImport / defaultArchiveDir 可由 opts.deps 替换,
 *    测试进程默认注入假件,绝不真读本机 Cookies 库、绝不真发网络请求;
 *  - 任一腿失败只返回结构化结果(ok=false + code + note),绝不抛异常翻转切号成败;
 *  - 输出零明文:cookie 只以内部 header 传递,任何返回值/notes 都不含 cookie 值、不含 token。
 */
import fs from 'node:fs'
import path from 'node:path'

import {
  defaultArchiveDir as realDefaultArchiveDir,
  exportArchive as realExportArchive,
  readDoubaoCookie as realReadCookie,
  replayArchive as realReplayArchive,
} from './doubao-carry.mjs'
import { buildConversationsJson, validateConversationsJson } from './doubao-chatgpt-format.mjs'

/** 真依赖集(生产默认);测试经 opts.deps 整包或逐项替换 */
function resolveDeps(overrides = {}) {
  return {
    readCookie: realReadCookie,
    exportArchive: realExportArchive,
    replayArchive: realReplayArchive,
    defaultArchiveDir: realDefaultArchiveDir,
    fs,
    path,
    buildImportFile: realBuildImportFile,
    ...overrides,
  }
}

/**
 * 把 export 归档转成豆包官方导入文件(ChatGPT conversations.json)。纯本地文件操作。
 * @returns {{ok:boolean, code:string, file:string|null, conversations:number, messages:number, note:string}}
 */
export function realBuildImportFile({ archiveDir, outFile, deps = {} }) {
  const fsImpl = deps.fs ?? fs
  const pathImpl = deps.path ?? path
  try {
    const index = JSON.parse(fsImpl.readFileSync(pathImpl.join(archiveDir, 'index.json'), 'utf8'))
    const readBody = (entry) => {
      if (!entry?.file) return null
      try {
        return JSON.parse(fsImpl.readFileSync(pathImpl.join(archiveDir, entry.file), 'utf8'))
      } catch {
        return null
      }
    }
    const built = buildConversationsJson(index, readBody)
    const check = validateConversationsJson(built.conversations)
    if (!check.ok) {
      return { ok: false, code: `format-invalid:${check.code}`, file: null, conversations: 0, messages: 0,
        note: `豆包导入文件生成失败:格式校验 ${check.code};写回照常` }
    }
    fsImpl.mkdirSync(pathImpl.dirname(outFile), { recursive: true })
    fsImpl.writeFileSync(outFile, `${JSON.stringify(built.conversations, null, 2)}\n`, 'utf8')
    const messages = built.conversations.reduce(
      (n, c) => n + Object.values(c.mapping).filter((x) => x?.message).length, 0)
    return {
      ok: true,
      code: 'ok',
      file: outFile,
      conversations: built.conversations.length,
      messages,
      note:
        `豆包无缝迁移准备 ✓ ${built.conversations.length} 个会话 / ${messages} 条逐条消息` +
        ` → ${outFile}(已跳过 ${built.skipped.length} 个空会话)`,
    }
  } catch (e) {
    return { ok: false, code: 'build-import-threw', file: null, conversations: 0, messages: 0,
      note: `豆包导入文件生成失败:${e instanceof Error ? e.message : String(e)};写回照常` }
  }
}

/** 把「取 cookie」的失败归一化成 {code, message},两阶段共用(零明文) */
async function cookieOf(readCookie, profileDir, phase) {
  let c
  try {
    c = await readCookie(profileDir ? { profileDir } : undefined)
  } catch (e) {
    return { code: 'cookie-read-threw', message: `${phase}读 cookie 异常:${e instanceof Error ? e.message : String(e)}` }
  }
  if (!c || c.code !== 'ok' || !c.cookieHeader) {
    return { code: c?.code ?? 'cookie-missing', message: c?.message ?? `${phase}登录态取不到` }
  }
  return { code: 'ok', cookieHeader: c.cookieHeader, count: c.count, source: c.source }
}

/**
 * 阶段一(写回前):用【旧号】登录态把云端对话全量导出到本地归档。
 * @param {object} [opts]
 * @param {string} [opts.archiveDir] 指定归档目录;缺省用 deps.defaultArchiveDir()
 * @param {string} [opts.profileDir] 豆包 profile 目录(测试注入)
 * @param {object} [opts.deps] 依赖注入(测试绝真读 cookie/真发网络)
 * @returns {Promise<{ok:boolean, code:string, archiveDir:string|null, exported:number,
 *   totalMessages:number, importFile:string|null, importConversations:number, note:string}>}
 */
export async function exportBeforeSwitch(opts = {}) {
  const deps = resolveDeps(opts.deps)
  let dir
  try {
    dir = opts.archiveDir || deps.defaultArchiveDir()
  } catch (e) {
    return {
      ok: false,
      code: 'archive-dir-failed',
      archiveDir: null,
      exported: 0,
      totalMessages: 0,
      importFile: null,
      importConversations: 0,
      note: `豆包对话导出未执行:归档目录创建失败(${e instanceof Error ? e.message : String(e)})`,
    }
  }
  const cookie = await cookieOf(deps.readCookie, opts.profileDir, '旧号')
  if (cookie.code !== 'ok') {
    return {
      ok: false,
      code: cookie.code,
      archiveDir: null,
      exported: 0,
      totalMessages: 0,
      importFile: null,
      importConversations: 0,
      note: `豆包对话导出未执行:旧号登录态不可用(${cookie.message});已跳过,写回照常`,
    }
  }
  let res
  try {
    res = await deps.exportArchive({ cookieHeader: cookie.cookieHeader, outDir: dir })
  } catch (e) {
    return {
      ok: false,
      code: 'export-threw',
      archiveDir: null,
      exported: 0,
      totalMessages: 0,
      importFile: null,
      importConversations: 0,
      note: `豆包对话导出失败:${e instanceof Error ? e.message : String(e)};已跳过,写回照常`,
    }
  }
  if (!res || res.code !== 'ok') {
    return {
      ok: false,
      code: res?.code ?? 'export-failed',
      archiveDir: null,
      exported: 0,
      totalMessages: 0,
      importFile: null,
      importConversations: 0,
      note: `豆包对话导出失败:${res?.message ?? res?.code ?? '未知'};已跳过,写回照常`,
    }
  }
  const archiveDir = res.dir ?? dir
  // 导出成功后立即生成官方导入文件(ChatGPT conversations.json) —— 这是无缝续聊的关键产物。
  const outFile = opts.importFile || path.join(archiveDir, 'conversations.json')
  const imp = deps.buildImportFile({ archiveDir, outFile, deps })
  return {
    ok: true,
    code: 'ok',
    archiveDir,
    exported: res.exported ?? 0,
    totalMessages: res.totalMessages ?? 0,
    importFile: imp.ok ? imp.file : null,
    importConversations: imp.conversations ?? 0,
    note:
      `豆包对话导出 ✓ 旧号 ${res.exported ?? 0} 个会话 / ${res.totalMessages ?? 0} 条消息` +
      ` → ${archiveDir}(cookie 来源 ${cookie.source ?? '?'},${cookie.count ?? 0} 条); ${imp.note}`,
  }
}

/**
 * 阶段二(写回后):用【新号】登录态把归档回放成新会话。
 * @param {object} [opts]
 * @param {string} [opts.archiveDir] exportBeforeSwitch 返回的归档目录
 * @param {boolean} [opts.apply=true] 是否真回放(false=只列清单,不发送)
 * @param {string} [opts.profileDir] 豆包 profile 目录(测试注入)
 * @param {object} [opts.deps] 依赖注入
 * @returns {Promise<{ok:boolean, code:string, replayed:number, skipped:number, failed:number,
 *   note:string}>}
 */
export async function replayAfterSwitch(opts = {}) {
  const deps = resolveDeps(opts.deps)
  if (!opts.archiveDir) {
    return {
      ok: false,
      code: 'no-archive',
      replayed: 0,
      skipped: 0,
      failed: 0,
      note: '豆包对话回放未执行:写回前没拿到归档目录(导出失败或未跑);登录态已切好,需手动补跑',
    }
  }
  const cookie = await cookieOf(deps.readCookie, opts.profileDir, '新号')
  if (cookie.code !== 'ok') {
    return {
      ok: false,
      code: cookie.code,
      replayed: 0,
      skipped: 0,
      failed: 0,
      note: `豆包对话回放未执行:新号登录态不可用(${cookie.message});登录态已切好,需手动补跑`,
    }
  }
  let res
  try {
    res = await deps.replayArchive({
      cookieHeader: cookie.cookieHeader,
      archiveDir: opts.archiveDir,
      apply: opts.apply !== false,
    })
  } catch (e) {
    return {
      ok: false,
      code: 'replay-threw',
      replayed: 0,
      skipped: 0,
      failed: 0,
      note: `豆包对话回放失败:${e instanceof Error ? e.message : String(e)};登录态已切好,需手动补跑`,
    }
  }
  if (!res || res.code !== 'ok') {
    return {
      ok: false,
      code: res?.code ?? 'replay-failed',
      replayed: 0,
      skipped: 0,
      failed: 0,
      note: `豆包对话回放失败:${res?.message ?? res?.code ?? '未知'};登录态已切好,需手动补跑`,
    }
  }
  const applied = opts.apply !== false
  return {
    ok: true,
    code: 'ok',
    replayed: res.replayed ?? 0,
    skipped: res.skipped ?? 0,
    failed: res.failed ?? 0,
    note:
      (applied ? '豆包对话回放 ✓' : '豆包对话回放[干跑]') +
      ` 新会话 ${res.replayed ?? 0} / 跳过(已回放) ${res.skipped ?? 0} / 失败 ${res.failed ?? 0}` +
      (applied ? ';打开豆包(新号)侧栏最新会话即旧对话上下文' : ';未发送任何消息'),
  }
}

/**
 * 阶段二·主路径(写回后):产出豆包官方导入清单 + 操作路径。
 *
 * 不做任何网络请求、不消耗新号额度 —— 导入动作由用户在豆包客户端「设置 → 数据导入与同步
 * → ChatGPT → 选择 conversations.json」完成,导入后会话逐条原生落入新号、可接着聊。
 * 这是当前豆包能达到的、与 Trae 等价的「无缝续聊」:内容逐条原样、上下文完整、无 AI 重生成。
 *
 * @returns {{ok:boolean, code:string, importFile:string|null, conversations:number,
 *   steps:string[], note:string}}
 */
export function prepareImport(opts = {}) {
  const ea = opts.exportResult ?? null
  const file = ea.ok === true ? ea.importFile ?? null : null
  if (!file) {
    return {
      ok: false,
      code: 'no-import-file',
      importFile: null,
      conversations: 0,
      steps: [],
      note: '豆包无缝迁移未执行:写回前没拿到导入文件(导出失败);登录态已切好,旧对话仍在新号云端之外',
    }
  }
  let exists = false
  try {
    exists = (opts.deps?.fs ?? fs).existsSync(file)
  } catch {
    exists = false
  }
  if (!exists) {
    return {
      ok: false,
      code: 'import-file-missing',
      importFile: file,
      conversations: ea.importConversations ?? 0,
      steps: [],
      note: `豆包导入文件不在了:${file};写回照常,需在旧号登录态重新导出`,
    }
  }
  const n = ea.importConversations ?? 0
  return {
    ok: true,
    code: 'ok',
    importFile: file,
    conversations: n,
    steps: [
      '打开豆包(已登新号) → 左下角头像 → 设置 → 数据导入与同步',
      '来源选 ChatGPT → 上传 conversations.json',
      '导入完成后在会话列表打开旧会话,逐条上下文原样保留,直接接着聊',
    ],
    note:
      `豆包无缝迁移已备好 ✓ ${n} 个会话的逐条原生对话 → ${file};` +
      '在豆包设置「数据导入与同步」选 ChatGPT 导入即可接着聊(不重生成、不耗额度)',
  }
}

export const __test__ = { resolveDeps, cookieOf, exportBeforeSwitch, replayAfterSwitch, realBuildImportFile, prepareImport }
