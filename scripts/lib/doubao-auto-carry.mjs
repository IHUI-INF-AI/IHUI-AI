// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包「一键切号自动带对话」两阶段封装(2026-11-24 立;同日二次取证后收口)。
 *
 * 【2026-11-24 二次取证 —— 上一版「官方导入」结论只对了一半】
 * 上一版把豆包 2.37.16「设置 → 数据导入与同步」理解成「选 ChatGPT 的
 * conversations.json/ZIP 文件导入」,据此写成「逐条原生、可续聊、只差用户点一下」。
 * 本机安装包 `s2-asset-import.js` 的实际文案是「正在扫描你安装的应用」
 * 「查看我的电脑,找到需要导入的 AI 应用」「个人应用/企业应用」,且 `zip`、`上传`、
 * `选择文件`、`备份` 均 0 命中 —— 入口是**扫描本机已安装的 AI 应用**(再由用户选要
 * 导入哪一个),不是文件选择/上传。手搓的 conversations.json 在这条入口上对不上。
 * 另外账号侧 `import/entry/list` 只暴露 Coze,`import/start` 无权限,API 全自动也
 * 走不通。故本版把「官方导入已可用」降级为「入口形态待目标账号 UI 实测」。
 *
 * 因此本模块的可交付主路径改为:
 *   写回前(旧号 cookie):export 逐条导出归档 → 生成 ChatGPT 格式文件(留档)
 *                       + 生成 `handoff.md` 交接单(确定可用);
 *   写回后(新号):产出**诚实的**导入/续聊清单 —— 若安装包探针判定为文件入口,
 *                 才给「选文件导入」步骤;若判定为扫描入口,明确说手搓文件不适用,
 *                 让用户用 handoff.md 在新会话粘贴续聊。
 * 旧版「文本压包重发」(replayArchive)保留为显式兜底函数,但主路径不再默认调用。
 *
 * 时序纪律(错一步就白搬,这是本模块存在的全部理由):
 *   - export 必须在【写回前】调用:此时本机 Cookies 库还是旧号登录态,才能拉到旧号云端对话;
 *   两阶段之间的归档目录/交接单由调用方保管,本模块不存全局态。
 *
 * 纪律(§0.3/§0.6/测试隔离铁律):
 *  - 依赖全注入:readCookie / exportArchive / buildImport / buildHandoff / probeImport
 *    可由 opts.deps 替换,测试进程默认注入假件,绝不真读本机 Cookies 库、绝不真发网络请求;
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
import {
  buildConversationsJson,
  buildStoreZip,
  validateConversationsJson,
  zipPathFor,
} from './doubao-chatgpt-format.mjs'
import { buildHandoffFile as realBuildHandoffFile } from './doubao-handoff.mjs'
import { probeDoubaoImportSurface as realProbeImportSurface } from './doubao-import-surface.mjs'

/** 真依赖集(生产默认);测试经 opts.deps 整包或逐项替换 */
function resolveDeps(overrides = {}) {
  const isTestEnv = Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test'
  return {
    readCookie: realReadCookie,
    exportArchive: realExportArchive,
    replayArchive: realReplayArchive,
    defaultArchiveDir: realDefaultArchiveDir,
    fs,
    path,
    buildImportFile: realBuildImportFile,
    buildHandoffFile: realBuildHandoffFile,
    // 测试进程默认不读真实安装包(与“绝不碰真实客户端”同口径);要验探针请显式注入
    probeImportSurface: isTestEnv
      ? () => ({ ok: true, code: 'ok', mode: 'unknown', note: '测试进程默认不读安装包' })
      : realProbeImportSurface,
    ...overrides,
  }
}

/**
 * 把 export 归档转成 ChatGPT 格式留档文件。纯本地文件操作,不是官方导入承诺。
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
    const json = Buffer.from(`${JSON.stringify(built.conversations, null, 2)}\n`, 'utf8')
    fsImpl.writeFileSync(outFile, json)
    // 双格式:裸 JSON + 同形 ZIP(消除豆包 ChatGPT 来源收哪种格式的不确定)
    const zFile = zipPathFor(outFile)
    fsImpl.writeFileSync(zFile, buildStoreZip([{ name: 'conversations.json', data: json }]))
    const messages = built.conversations.reduce(
      (n, c) => n + Object.values(c.mapping).filter((x) => x?.message).length, 0)
    return {
      ok: true,
      code: 'ok',
      file: outFile,
      zipFile: zFile,
      conversations: built.conversations.length,
      messages,
      note:
        `豆包对话已留档 ✓ ${built.conversations.length} 个会话 / ${messages} 条逐条消息` +
        ` → 裸JSON ${outFile} / ZIP ${zFile}(仅留档/交外部工具,不是官方导入承诺;` +
        `已跳过 ${built.skipped.length} 个空会话)`,
    }
  } catch (e) {
    return { ok: false, code: 'build-import-threw', file: null, conversations: 0, messages: 0,
      note: `豆包导入文件生成失败:${e instanceof Error ? e.message : String(e)};写回照常` }
  }
}

/** 把「取 cookie」的失败归一化成 {code, message},两阶段共用(零明文) */
async function cookieOf(readCookie, profileDir, phase, profile) {
  let c
  try {
    const opts = {}
    if (profileDir) opts.profileDir = profileDir
    if (profile) opts.profile = profile
    c = await readCookie(Object.keys(opts).length > 0 ? opts : undefined)
  } catch (e) {
    return { code: 'cookie-read-threw', message: `${phase}读 cookie 异常:${e instanceof Error ? e.message : String(e)}` }
  }
  if (!c || c.code !== 'ok' || !c.cookieHeader) {
    return {
      code: c?.code ?? 'cookie-missing',
      message: c?.message ?? `${phase}登录态取不到`,
      profile: c?.profile ?? null,
    }
  }
  return {
    code: 'ok',
    cookieHeader: c.cookieHeader,
    count: c.count,
    source: c.source,
    profile: c.profile ?? null,
    profileSource: c.profileSource ?? null,
  }
}

/**
 * 阶段一(写回前):用【旧号】登录态把云端对话全量导出到本地归档。
 * @param {object} [opts]
 * @param {string} [opts.archiveDir] 指定归档目录;缺省用 deps.defaultArchiveDir()
 * @param {string} [opts.profileDir] 豆包 profile 目录(测试注入)
 * @param {string} [opts.profile] 豆包 profile 名(Default / Profile N / active)
 * @param {string} [opts.importFile] 指定 conversations.json 落点
 * @param {object} [opts.deps] 依赖注入(测试绝真读 cookie/真发网络)
 * @returns {Promise<{ok:boolean, code:string, archiveDir:string|null, exported:number,
 *   totalMessages:number, importFile:string|null, importZipFile:string|null, importConversations:number,
 *   handoffFile:string|null, handoffConversation:string, handoffMessages:number,
 *   profile:string|null, note:string}>}
 */
export async function exportBeforeSwitch(opts = {}) {
  const deps = resolveDeps(opts.deps)
  const empty = (code, note, extra = {}) => ({
    ok: false,
    code,
    archiveDir: null,
    exported: 0,
    totalMessages: 0,
    importFile: null,
    importZipFile: null,
    importConversations: 0,
    handoffFile: null,
    handoffConversation: '',
    handoffMessages: 0,
    profile: null,
    note,
    ...extra,
  })
  let dir
  try {
    dir = opts.archiveDir || deps.defaultArchiveDir()
  } catch (e) {
    return empty(
      'archive-dir-failed',
      `豆包对话导出未执行:归档目录创建失败(${e instanceof Error ? e.message : String(e)})`,
    )
  }
  const cookie = await cookieOf(deps.readCookie, opts.profileDir, '旧号', opts.profile)
  if (cookie.code !== 'ok') {
    return empty(
      cookie.code,
      `豆包对话导出未执行:旧号登录态不可用(${cookie.message});已跳过,写回照常`,
      { profile: cookie.profile ?? null },
    )
  }
  let res
  try {
    res = await deps.exportArchive({ cookieHeader: cookie.cookieHeader, outDir: dir })
  } catch (e) {
    return empty(
      'export-threw',
      `豆包对话导出失败:${e instanceof Error ? e.message : String(e)};已跳过,写回照常`,
      { profile: cookie.profile ?? null },
    )
  }
  if (!res || res.code !== 'ok') {
    return empty(
      res?.code ?? 'export-failed',
      `豆包对话导出失败:${res?.message ?? res?.code ?? '未知'};已跳过,写回照常`,
      { profile: cookie.profile ?? null },
    )
  }
  const archiveDir = res.dir ?? dir
  // 留档:ChatGPT 格式(公开稳定、可交外部工具;豆包当前入口不收手搓文件)
  const outFile = opts.importFile || path.join(archiveDir, 'conversations.json')
  const imp = deps.buildImportFile({ archiveDir, outFile, deps })
  // 确定可用:交接单(文本逐轮,不依赖任何官方入口)
  const hf = deps.buildHandoffFile({
    archiveDir,
    outFile: path.join(archiveDir, 'handoff.md'),
    deps,
  })
  return {
    ok: true,
    code: 'ok',
    archiveDir,
    exported: res.exported ?? 0,
    totalMessages: res.totalMessages ?? 0,
    importFile: imp.ok ? imp.file : null,
    importZipFile: imp.ok ? imp.zipFile ?? null : null,
    importConversations: imp.conversations ?? 0,
    handoffFile: hf.ok ? hf.file : null,
    handoffConversation: hf.ok ? hf.conversationId ?? '' : '',
    handoffMessages: hf.ok ? hf.messages ?? 0 : 0,
    profile: cookie.profile ?? null,
    note:
      `豆包对话导出 ✓ 旧号 ${res.exported ?? 0} 个会话 / ${res.totalMessages ?? 0} 条消息` +
      ` → ${archiveDir}(profile=${cookie.profile ?? '?'},cookie 来源 ${cookie.source ?? '?'},${cookie.count ?? 0} 条);` +
      ` ${imp.note}; ${hf.note}`,
  }
}

/**
 * 阶段二(写回后):用【新号】登录态把归档回放成新会话。
 * @param {object} [opts]
 * @param {string} [opts.archiveDir] exportBeforeSwitch 返回的归档目录
 * @param {boolean} [opts.apply=true] 是否真回放(false=只列清单,不发送)
 * @param {string} [opts.profileDir] 豆包 profile 目录(测试注入)
 * @param {string} [opts.profile] 豆包 profile 名(Default / Profile N / active)
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
  const cookie = await cookieOf(deps.readCookie, opts.profileDir, '新号', opts.profile)
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
      (applied ? ';新号侧栏会多出一条包含旧对话文本的新会话,不是原生历史' : ';未发送任何消息'),
  }
}

/**
 * 阶段二·主路径(写回后):产出**按安装包实测**的导入/续聊清单。
 *
 * 不做任何网络请求、不消耗新号额度。关键修正:豆包 2.37.16「数据导入与同步」
 * 是扫描本机已安装 AI 应用的入口,不是文件选择/上传;因此:
 *  - 探针判 `file-pick` ⇒ 才给「选 conversations.json/ZIP 导入」三步;
 *  - 探针判 `scan-apps` ⇒ 明确说手搓文件不适用,改用 handoff.md 粘贴续聊;
 *  - 探针未判定 ⇒ 不猜、不承诺,只给归档与交接单落点。
 *
 * @returns {{ok:boolean, code:string, importFile:string|null, importZipFile:string|null,
 *   handoffFile:string|null, conversations:number, importMode:string, steps:string[], note:string}}
 */
export function prepareImport(opts = {}) {
  const deps = resolveDeps(opts.deps)
  const ea = opts.exportResult ?? null
  const file = ea?.ok === true ? ea.importFile ?? null : null
  const zipFile = ea?.ok === true ? ea.importZipFile ?? null : null
  const handoffFile = ea?.handoffFile ?? null
  const conversations = ea?.importConversations ?? 0
  const hasHandoff = Boolean(handoffFile && deps.fs.existsSync(handoffFile))
  const probe = deps.probeImportSurface({ appDir: opts.appDir })
  const importMode = probe.mode ?? 'unknown'
  const base = {
    importFile: file,
    importZipFile: zipFile,
    handoffFile: hasHandoff ? handoffFile : null,
    conversations,
    importMode,
    probeNote: probe.note ?? '',
  }
  if (!file) {
    return {
      ok: false,
      code: 'no-import-file',
      ...base,
      steps: hasHandoff
        ? [
            `旧会话已导出归档,但标准导入文件未生成;交接单在 ${handoffFile}`,
            '新号新建会话 → 粘贴交接单全文作为首条消息 → 继续',
          ]
        : [],
      note: hasHandoff
        ? `豆包原生导入未执行:写回前没拿到标准导入文件(导出失败);交接单可用:${handoffFile};登录态已切好`
        : '豆包原生导入未执行:写回前没拿到导入文件(导出失败);登录态已切好,旧对话仍在新号云端之外',
    }
  }
  let exists = false
  try {
    exists = deps.fs.existsSync(file)
  } catch {
    exists = false
  }
  if (!exists) {
    return {
      ok: false,
      code: 'import-file-missing',
      ...base,
      steps: hasHandoff
        ? ['标准导入文件不在了;改粘贴交接单续聊:' + handoffFile]
        : [],
      note: `豆包导入文件不在了:${file};写回照常,需在旧号登录态重新导出`,
    }
  }
  if (importMode === 'file-pick') {
    return {
      ok: true,
      code: 'ok',
      ...base,
      steps: [
        '打开豆包(已登新号) → 左下角头像 → 设置 → 数据导入与同步',
        `来源选 ChatGPT → 选 ${zipFile ?? file}(ZIP 优先;不认再试裸 conversations.json)`,
        '导入完成后确认会话是否进入列表、能否直接续聊(以目标账号 UI 实测为准,不预承诺)',
        `若该账号的「数据导入与同步」没有 ChatGPT 来源(实测 API 只暴露 Coze),改用交接单:${handoffFile ?? '(未生成)'}`,
      ],
      note:
        `豆包导入文件已备好 ✓ ${conversations} 个会话的逐条对话 → ZIP ${zipFile ?? '(未生成)'} / 裸JSON ${file};` +
        '安装包探针判为文件选择入口;仍须以目标账号 UI 实测为准(不同账号/灰度可能不同)',
    }
  }
  if (importMode === 'scan-apps') {
    return {
      ok: false,
      code: 'import-surface-scan-only',
      ...base,
      steps: [
        '当前豆包 2.37.16 的「数据导入与同步」是扫描本机已安装应用的入口,不收手搓 conversations.json/ZIP;不要在此入口浪费时间',
        `旧会话归档已留档:${archiveDirLabel(ea)} → ZIP ${zipFile ?? '(未生成)'} / 裸JSON ${file}`,
        hasHandoff
          ? `要马上接着聊:新号新建会话 → 粘贴 ${handoffFile} 全文作为首条消息 → 直接继续`
          : '交接单未生成;需在旧号登录态重跑导出以生成 handoff.md',
      ],
      note:
        `豆包原生导入不成立:安装包文案为扫描式入口(${probe.scanHits?.length ?? 0} 条扫描文案/` +
        `${probe.fileHits?.length ?? 0} 条文件文案),手搓文件无入口;` +
        (hasHandoff ? `已生成交接单 ${handoffFile}(文本最近若干轮,可直接粘贴续聊)` : '交接单未生成'),
    }
  }
  return {
    ok: false,
    code: 'import-surface-unknown',
    ...base,
    steps: [
      '豆包导入入口未判定(安装包文案不足/版本变了):先在设置里人工看一眼入口形态,不要按旧文档直接选文件',
      `旧会话归档:${archiveDirLabel(ea)};交接单:${handoffFile ?? '(未生成)'}`,
    ],
    note: `豆包导入入口未判定:${probe.note ?? '探针无返回'};不承诺零点击原生迁移`,
  }
}

/** 归档目录展示用(不引入额外状态) */
function archiveDirLabel(ea) {
  const file = ea?.importFile ?? ''
  return file ? path.dirname(file) : ea?.archiveDir ?? '(未知)'
}

export const __test__ = { resolveDeps, cookieOf, exportBeforeSwitch, replayAfterSwitch, realBuildImportFile, prepareImport }
