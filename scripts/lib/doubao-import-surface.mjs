// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包「数据导入与同步」入口形态探针(2026-11-24 立)。
 *
 * 立因:`docs/chat-carry.md` 旧结论把官方导入写成「在设置里选 ChatGPT 的
 * conversations.json/ZIP 文件导入」,但本机 2.37.16 安装包 `s2-asset-import.js`
 * 的实际文案是「正在扫描你安装的应用」「查看我的电脑,找到需要导入的 AI 应用」
 * —— 这是**扫描已安装 AI 应用的数据**,不是文件选择/上传。两者差一个数量级的
 * 实现成本,不能继续拿旧结论对外承诺「零点击无缝」。
 *
 * 本模块只读安装包静态文案做形态判定,零网络、零 cookie、零账号:
 *  - `scan-apps` = 扫描式入口(当前 2.37.16 实证);
 *  - `file-pick` = 文件选择/上传式入口(出现明确的选择文件/上传/ZIP 文案);
 *  - `unknown` = 文案不足或版本变了(如实报未判定,不猜)。
 *
 * 纪律:这是**静态文案判据**,不是产品功能承诺。版本升级后文案可能变,必须以
 * 新安装包重新跑一次探针为准。
 */
import fs from 'node:fs'
import path from 'node:path'

/** 扫描式入口的强文案(至少命中 2 条才判 scan-apps,防单条通用词误判) */
export const SCAN_MARKERS = Object.freeze([
  '正在扫描你安装的应用',
  '查看我的电脑，找到需要导入的 AI 应用',
  '导入其他 AI 应用',
  '个人应用',
  '企业应用',
])
/** 文件式入口的强文案(至少命中 2 条才判 file-pick) */
export const FILE_MARKERS = Object.freeze(['选择文件', '上传文件', '拖拽文件', '导入 ZIP', '选择备份文件'])

const REL_BUNDLE = path.join(
  'local_webcontents',
  'extensions',
  'ai-views',
  'static',
  'js',
  'async',
  's2-asset-import.js',
)

function defaultAppDirs(env = process.env) {
  const bases = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA].filter(Boolean)
  const out = []
  for (const base of bases) {
    const app = path.join(base, 'Doubao', 'app')
    if (fs.existsSync(path.join(app, REL_BUNDLE))) out.push(app)
  }
  return out
}

/** bundle 里的中文多以 `\uXXXX` 转义存储;先还原再匹配,否则永远 0 命中 */
export function decodeBundleText(text) {
  const s = String(text ?? '')
  return s
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16))
      } catch {
        return _
      }
    })
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * @param {object} [opts]
 * @param {string} [opts.appDir] 测试注入:豆包 `app` 目录
 * @param {NodeJS.ProcessEnv} [opts.env]
 * @param {object} [opts.deps] fs/path 注入
 */
export function probeDoubaoImportSurface(opts = {}) {
  const fsImpl = opts.deps?.fs ?? fs
  const pathImpl = opts.deps?.path ?? path
  const dirs = (opts.appDir ? [opts.appDir] : defaultAppDirs(opts.env ?? process.env)).filter((d) =>
    fsImpl.existsSync(d),
  )
  if (dirs.length === 0) {
    return {
      ok: false,
      code: 'app-not-found',
      mode: 'unknown',
      appDir: null,
      bundle: null,
      scanHits: [],
      fileHits: [],
      note: '豆包安装目录没找到(Program Files / LOCALAPPDATA 的 Doubao\\app 均无 s2-asset-import.js)⇒ 导入入口未判定',
    }
  }
  const appDir = dirs[0]
  const bundle = pathImpl.join(appDir, REL_BUNDLE)
  let text
  try {
    text = fsImpl.readFileSync(bundle, 'utf8')
  } catch (e) {
    return {
      ok: false,
      code: 'bundle-unreadable',
      mode: 'unknown',
      appDir,
      bundle,
      scanHits: [],
      fileHits: [],
      note: `导入入口 bundle 读不了:${e instanceof Error ? e.message : String(e)} ⇒ 未判定`,
    }
  }
  const decoded = decodeBundleText(text)
  const scanHits = SCAN_MARKERS.filter((m) => decoded.includes(m))
  const fileHits = FILE_MARKERS.filter((m) => decoded.includes(m))
  let mode = 'unknown'
  if (scanHits.length >= 2 && fileHits.length === 0) mode = 'scan-apps'
  else if (fileHits.length >= 2) mode = 'file-pick'
  const note =
    mode === 'scan-apps'
      ? `导入入口=扫描已安装应用(${scanHits.length} 条扫描文案/0 条文件文案);手搓 conversations.json 没有文件入口 ⇒ 不能承诺原生导入`
      : mode === 'file-pick'
        ? `导入入口=文件选择/上传(${fileHits.length} 条文件文案);仍须在目标账号 UI 实测入口存在且收 ZIP/JSON`
        : `导入入口未判定(扫描文案 ${scanHits.length} 条/文件文案 ${fileHits.length} 条);不猜、不承诺`
  return {
    ok: true,
    code: 'ok',
    mode,
    appDir,
    bundle,
    scanHits,
    fileHits,
    note,
  }
}

export const __test__ = { SCAN_MARKERS, FILE_MARKERS, defaultAppDirs, decodeBundleText, probeDoubaoImportSurface }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
