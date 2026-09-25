// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面端"清理 WebView2 缓存"不得等于删除用户数据树(2026-09-25 立)
//
// 立因:实测 `apps/desktop/src-tauri/src/lib.rs` 里两处清理都是 `remove_dir_all(<...>/EBWebView)`,
// 而那棵树里 `Default/` 下同时住着 `Local Storage`(登录态 + 已加密的本机会话)、`Session Storage`、
// `IndexedDB`、`Network`(Cookie)。用户在设置页点一次"清理缓存"、或谁跑一次 `tauri dev`
// (`cfg(dev)` 经回读 `tauri-build` 输出确认**真会被编译**,不是伪 cfg),就等于把登录与本机数据清空。
// 缓存与数据混在一个根目录下,靠"删整棵"来清缓存是形状错误,不是程度问题。
//
// 本文件判三件事:① 源码里不得再有"对 EBWebView 根本身的删除调用";② 两处清理必须走同一个
// 白名单辅助函数(不得一端改了、另一端还整树删);③ 白名单里不得混进任何数据段。
//
// 判据是**纯函数 + 构造面**(不依赖仓库瞬时状态):变异靠喂进去的字符串证明,不靠"现在正好没有"。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const LIB_RS = 'apps/desktop/src-tauri/src/lib.rs'

/** 用户数据类目录(删了就丢登录态/本机会话),任何清理动作都不得触及。 */
const DATA_SEGMENT_RE = /(Local|Session)\s+Storage|IndexedDB|Network|Local\s+State|leveldb/i

/**
 * 找出"对某个路径变量整棵 remove_dir_all"的调用点,并回溯该变量是不是直接由
 * `...join("EBWebView")` 赋值得来的。返回命中的行号数组(1 起)。
 */
export function findWholeTreeDeletes(src) {
  const lines = src.split('\n')
  // 先收集"变量 = ...(join("EBWebView"))"这一类直接绑定
  const rootBoundVars = new Set()
  lines.forEach((ln) => {
    const m = /let\s+(?:mut\s+)?([a-z_0-9]+)\s*=[^;]*join\(\s*"EBWebView"\s*\)/.exec(ln)
    if (m) rootBoundVars.add(m[1])
  })
  const hits = []
  lines.forEach((ln, i) => {
    const call = /remove_dir_all\(\s*&?([a-z_0-9]+)\s*\)/.exec(ln)
    if (!call) return
    const varName = call[1]
    // 辅助函数里删的是 webview_cache_paths(...) 逐个缓存子目录(变量名 p),那是正确形态
    if (varName === 'p') return
    if (rootBoundVars.has(varName) || /EBWebView/i.test(ln)) hits.push(i + 1)
  })
  return hits
}

/** 从源码里解析 `const WEBVIEW_DATA_NAMES: [&str; N] = [...]` 的成员。 */
export function dataNamesOf(src) {
  const at = src.indexOf('const WEBVIEW_DATA_NAMES')
  if (at < 0) throw new Error('WEBVIEW_DATA_NAMES 不在源码里:数据目录清单被摘走了')
  const open = src.indexOf('[', src.indexOf('=', at))
  const close = src.indexOf(']', open)
  const items = [...src.slice(open, close).matchAll(/"([^"]+)"/g)].map((m) => m[1])
  if (items.length === 0) throw new Error('WEBVIEW_DATA_NAMES 解析到 0 项,判据失效')
  return items
}

/** 从源码里解析缓存白名单成员。 */
export function cacheNamesOf(src) {
  const at = src.indexOf('const WEBVIEW_CACHE_NAMES')
  if (at < 0) throw new Error('WEBVIEW_CACHE_NAMES 不在源码里:缓存白名单被摘走了')
  const open = src.indexOf('[', src.indexOf('=', at))
  const close = src.indexOf(']', open)
  const items = [...src.slice(open, close).matchAll(/"([^"]+)"/g)].map((m) => m[1])
  if (items.length === 0) throw new Error('WEBVIEW_CACHE_NAMES 解析到 0 项,判据失效')
  return items
}

const src = readFileSync(path.join(ROOT, LIB_RS), 'utf-8')

test('① 源码里不得存在"对 EBWebView 根整棵删除"的调用点', () => {
  const hits = findWholeTreeDeletes(src)
  assert.deepEqual(hits, [], `${LIB_RS} 第 ${hits.join(', ')} 行在删整个 EBWebView 根目录`)
})

test('② 两处清理入口必须都走白名单辅助函数(装车证明)', () => {
  const cmd = src.slice(src.indexOf('fn clear_webview_cache()'), src.indexOf('#[cfg(test)]'))
  assert.ok(
    cmd.includes('clear_webview_caches('),
    '设置项"清理缓存"命令未走辅助函数(可能退回整树删)',
  )
  const devAt = src.indexOf('#[cfg(all(dev, target_os = "windows"))]')
  assert.ok(devAt > 0, 'dev 启动清理那段被搬走了,须同步本判据')
  const devBlock = src.slice(devAt, devAt + 1400)
  assert.ok(
    devBlock.includes('clear_webview_caches('),
    'dev 分支仍自行决定删什么(与设置页两套逻辑 = 迟早又出现整树删)',
  )
  assert.ok(!/remove_dir_all/.test(devBlock), 'dev 分支不得再有直接删除调用')
})

test('③ 白名单与数据名单不得有任何交集,且四条真实数据目录都在册', () => {
  const data = dataNamesOf(src)
  const cache = cacheNamesOf(src)
  for (const want of ['Local Storage', 'Session Storage', 'IndexedDB', 'Network']) {
    assert.ok(data.includes(want), `数据清单缺 ${want} —— 那正是登录态/本机会话的住所`)
  }
  for (const rel of cache) {
    for (const seg of rel.split('/')) {
      assert.ok(
        !DATA_SEGMENT_RE.test(seg) && !data.includes(seg),
        `缓存白名单 ${rel} 含数据段 ${seg},清理会连带删掉用户数据`,
      )
    }
  }
})

test('④ 尺子本身有牙:喂回旧写法必须判红(构造面,不靠仓库瞬时状态)', () => {
  const regressed = [
    'fn clear_webview_cache() {',
    '    let webview_cache = Path::new(&x).join("com.ihui.desktop").join("EBWebView");',
    '    std::fs::remove_dir_all(&webview_cache).unwrap();',
    '}',
  ].join('\n')
  assert.deepEqual(findWholeTreeDeletes(regressed), [3], '旧写法没被判红 ⇒ 本判据是恒绿的空尺子')
  const correct = [
    'fn helper() { for p in webview_cache_paths(root) { std::fs::remove_dir_all(&p)?; } }',
    'fn cmd() { let root = Path::new(&x).join("EBWebView"); clear_webview_caches(&root); }',
  ].join('\n')
  assert.deepEqual(findWholeTreeDeletes(correct), [], '正确写法被判红 ⇒ 本门会变成恒红门')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
