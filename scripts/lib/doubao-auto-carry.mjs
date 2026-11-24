// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包「一键切号自动对话回放」两阶段封装(2026-11-24 立,机主令:豆包切号也要像 Trae 那样自动带对话)。
 *
 * 立因:CARRY_MATRIX 把 doubao 归为 cloud(kind=cloud/auto=replay),此前写回成功后只回一句
 * `switchCarry => action=replay-required` 的静态提示,对话迁移要人手动敲两条命令。本模块把
 * 「旧号导出归档 + 新号回放」收成可编排的两阶段,让一键切号一次点击就完成。
 *
 * 时序纪律(错一步就白搬,这是本模块存在的全部理由):
 *   - export 必须在【写回前】调用:此时本机 Cookies 库还是旧号登录态,才能拉到旧号云端对话;
 *   - replay 必须在【写回后】调用:此时 Cookies 库已是新号登录态,回放请求的 cookie 才是新号。
 *   两阶段之间的归档目录由调用方保管(export 返回 dir → replay 入参 archiveDir),本模块不存全局态。
 *
 * 诚实边界(不对用户夸大):豆包云端没有逐条消息写回端点,回放语义 = 旧对话压成一条 user 文本
 * 发进新会话、服务端重新生成 AI 回复 ⇒ 内容搬过去了,但不是 Trae 那种逐条原位续聊。
 *
 * 纪律(§0.3/§0.6/测试隔离铁律):
 *  - 依赖全注入:readCookie / exportArchive / replayArchive / defaultArchiveDir 可由 opts.deps 替换,
 *    测试进程默认注入假件,绝不真读本机 Cookies 库、绝不真发网络请求;
 *  - 任一腿失败只返回结构化结果(ok=false + code + note),绝不抛异常翻转切号成败 —— 与切号
 *    编排腿既有的「对话随行失败只记 note,不翻转切号成败」同口径;
 *  - 输出零明文:cookie 只以内部 header 传递,任何返回值/notes 都不含 cookie 值、不含 token。
 */
import {
  defaultArchiveDir as realDefaultArchiveDir,
  exportArchive as realExportArchive,
  readDoubaoCookie as realReadCookie,
  replayArchive as realReplayArchive,
} from './doubao-carry.mjs'

/** 真依赖集(生产默认);测试经 opts.deps 整包或逐项替换 */
function resolveDeps(overrides = {}) {
  return {
    readCookie: realReadCookie,
    exportArchive: realExportArchive,
    replayArchive: realReplayArchive,
    defaultArchiveDir: realDefaultArchiveDir,
    ...overrides,
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
 *   totalMessages:number, note:string}>}
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
      note: `豆包对话导出失败:${res?.message ?? res?.code ?? '未知'};已跳过,写回照常`,
    }
  }
  return {
    ok: true,
    code: 'ok',
    archiveDir: res.dir ?? dir,
    exported: res.exported ?? 0,
    totalMessages: res.totalMessages ?? 0,
    note:
      `豆包对话导出 ✓ 旧号 ${res.exported ?? 0} 个会话 / ${res.totalMessages ?? 0} 条消息` +
      ` → ${res.dir ?? dir}(cookie 来源 ${cookie.source ?? '?'},${cookie.count ?? 0} 条)`,
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

export const __test__ = { resolveDeps, cookieOf, exportBeforeSwitch, replayAfterSwitch }
