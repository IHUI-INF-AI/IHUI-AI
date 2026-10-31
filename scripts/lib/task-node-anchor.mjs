// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 计划任务的 node 锚点判据(全仓唯一一份,2026-10-31 立)。
 *
 * 立因(本机一手现场):四台注册器一律把 `process.execPath` 烤进任务 action ⇒「谁跑就烤谁」。
 * 有一次注册是经第三方 AI IDE 自带的 node 跑的,于是 `IHUI-DevStack` 与
 * `IHUI-DevStackWatchdog` 两枚常驻任务长期烤着
 * `…\.workbuddy\binaries\node\versions\22.22.2-6\node.exe`。那枚 node 住在**别人的产品目录**里,
 * 随对方升级/卸载就消失,守护与看门狗会一起静默停摆(今天的停摆面:dev 栈整棵树都跑在那枚 node 上)。
 *
 * 判据(失效方向 = 多要一次定向说明,绝不「多放一次跳门」,AGENTS §0.10):
 *   ① PATH 上第一个真实存在的 node ⇒ 用它。**「本机规范 node」只按当次实测的 PATH 取值,
 *      不写死盘符**(AGENTS 抬头:盘符/解释器身份等七类机器事实必须现读)。
 *   ② PATH 取不到 node,而 `process.execPath` 真实存在且不在第三方私有目录里 ⇒ 用它并如实标 fallback。
 *   ③ `execPath` 落在第三方私有目录 ⇒ **拒绝**(哪怕 PATH 也取不到):那正是本判据要拦的形态,
 *      点名「请用本机规范 node 重跑注册」,不静默降级。
 *   ④ 两样都取不到 ⇒ `ok:false, undetermined:true` ⇒ 调用方 exit 2 未判定(§0.3),不猜、不回落。
 *
 * 纯判据、零 IO:`exists` 由调用方注入(测试用替身,生产用 `fs.existsSync`)。
 */

/**
 * 第三方产品私有目录特征(小写、正斜杠形态,子串命中即算)。
 * 只登记**在本机实测见过或上游公开布局**的那几族,不写通用 `/node_modules/`(那是依赖目录,
 * 不是解释器锚点;把它当禁语会让合法形态一律未判定)。
 */
export const THIRD_PARTY_NODE_DIR_MARKERS = [
  '/.workbuddy/',
  '/.trae/',
  '/.trae-cn/',
  '/.codebuddy/',
  '/.windsurf/',
  '/.cursor-server/',
  '/.lingma/',
  '/binaries/node/versions/',
]

const normalize = (p) => String(p ?? '').replace(/\\/g, '/').toLowerCase()

/**
 * 回各平台的原生分隔符。
 *
 * 判据内部一律按正斜杠比,但**产出的锚点要嵌进 PowerShell 单引号里当可执行体路径**:
 * 混合分隔符(`C:\dir/node.exe`)虽然 WinAPI 认,却会给下游的字符串判据与 VBS 生成物留下
 * 两种写法要认的坑,而 `process.execPath` 本来就是全反斜杠形态 —— 保持同形。
 */
const toNative = (p, platform) => (platform === 'win32' ? p.replace(/[\\/]+/g, '\\') : p)

/** 路径是否落在第三方产品的私有目录里(锚点禁地)。 */
export function isThirdPartyNodePath(p) {
  const n = normalize(p)
  if (!n) return false
  return THIRD_PARTY_NODE_DIR_MARKERS.some((marker) => n.includes(marker))
}

/**
 * 解析这一轮注册该烤进任务 action 的 node 可执行体。
 *
 * @param {object} opts
 * @param {string} [opts.execPath] 当次进程的可执行体(process.execPath)
 * @param {string[]} [opts.pathEntries] PATH 分段(process.env.PATH.split(path.delimiter))
 * @param {(p:string)=>boolean} [opts.exists] 存在性探针(生产传 fs.existsSync)
 * @param {string} [opts.platform] 平台,决定可执行体文件名(win32 ⇒ node.exe)
 * @returns {{ok:boolean, undetermined?:boolean, anchor?:string, source?:string, why?:string, note?:string}}
 */
export function resolveTaskNodeAnchor({
  execPath = '',
  pathEntries = [],
  exists = () => false,
  platform = process.platform,
} = {}) {
  const bin = platform === 'win32' ? 'node.exe' : 'node'

  let canonical = null
  for (const rawDir of pathEntries) {
    const dir = String(rawDir ?? '').trim()
    if (!dir) continue
    const candidate = `${dir.replace(/[\\/]+$/, '')}/${bin}`
    if (exists(candidate)) {
      canonical = candidate
      break
    }
  }

  if (canonical) {
    const anchor = toNative(canonical, platform)
    const same = normalize(canonical) === normalize(execPath)
    return {
      ok: true,
      anchor,
      source: 'path-canonical',
      note: same
        ? ''
        : `当次 execPath(${execPath})与 PATH 规范 node 不同 ⇒ 任务锚点改用 ${anchor}(第三方捆绑目录随对方升级即消失,不许烤进任务)`,
    }
  }

  if (execPath && exists(execPath)) {
    if (isThirdPartyNodePath(execPath)) {
      return {
        ok: false,
        undetermined: false,
        why: `PATH 取不到规范 node,而当次解释器 ${execPath} 落在第三方产品私有目录 ⇒ 拒绝注册(出路:用本机 PATH 上的 node 重跑本注册器,或先修 PATH)`,
      }
    }
    return {
      ok: true,
      anchor: execPath,
      source: 'execPath-fallback',
      note: 'PATH 上量不到 node,已如实按当次解释器落地',
    }
  }

  return {
    ok: false,
    undetermined: true,
    why: 'PATH 与 execPath 都取不到可执行的 node ⇒ 未判定(不回落、不猜、不注册)',
  }
}

export const __test__ = { resolveTaskNodeAnchor, isThirdPartyNodePath, THIRD_PARTY_NODE_DIR_MARKERS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
