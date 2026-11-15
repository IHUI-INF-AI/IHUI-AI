// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * disk-root-live-watch.mjs — 盘根外流**实时**监听(2026-11-14 立,机主"根本不可能外泄")
 *
 * ## 与 disk-root-watch.mjs(10min 轮询哨兵)的关系
 *
 * 轮询哨兵是把发现时间压到 10min;本文件用 fs.watch 把发现时间压到**毫秒级**——盘根一出现
 * 非白名单条目,事件回调当场触发。两者是**兜底冗余**(§单一职责不冲突):fs.watch 管实时,
 * 轮询管 fs.watch 失效/漏事件的兜底(Windows fs.watch 偶发丢 rename 事件,轮询是它的安全网)。
 *
 * ## 能力边界(诚实交底,不冒充"阻止")
 *
 * fs.watch 是**发现**机制,不是**阻止**机制——它不能在内核层拒掉写盘动作。真正的"根本不可能
 * 外泄"要靠 OS 级强制访问控制(Windows 受控文件夹访问/AppLocker),那是系统策略层,由
 * seal-disk-root-os-enforce.md(本轮同产)给出启用步骤,需机主以管理员身份操作。
 * 本文件只做到"毫秒级发现 + 立即点名",把"外泄从发生到被知道"的窗口压到接近零。
 *
 * ## 判据单一真相源(§22c)
 *
 * 白名单**只读** config/disk-root-allowlist.json 的 roots[*].allow(与卫生尺同一份),本文件
 * 零复算、不抄第二份 allow 清单。判定逻辑只做"名字在不在 allow 里"这一层(与卫生尺 H1 同义),
 * 深判定(内容对账 H3/worktree 维/orphan 壳)仍归卫生尺,本文件不重复。
 *
 * ## 平台特有:依赖 Node fs.watch(FSEvent/ReadDirectoryChangesW)
 *   · Windows 用 ReadDirectoryChangesW,监听盘根一级;watch 的 dir 必须存在。
 *   · 递归=false:只看盘根**一级**条目(与 H1 同射程,不递归,清单不腐烂)。
 *   · fs.watch 偶发丢事件 ⇒ 10min 轮询哨兵兜底,不单点依赖本文件。
 *   · 本文件永不删文件/不阻断写盘(发现层,清理归归属席,§26)。
 */

import { existsSync, readFileSync, watch } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, '..', '..')
const ALLOWLIST_PATH = join(REPO_ROOT, 'config', 'disk-root-allowlist.json')

/**
 * 读白名单(单一真相源)。严口径:优先读 roots["liveWatch"].allow(实时层更细滤网);
 * 该节不在 ⇒ 回落同盘 roots[<盘>].allow(与卫生尺 H1 同集,只窄不宽的兜底)。
 * 返回 { roots: Map<盘根绝对路径, Set<允许条目名>> } 或 null(取不到)。
 */
export function loadAllowlist(configPath = ALLOWLIST_PATH) {
  let conf = null
  try {
    conf = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch {
    return null
  }
  const roots = conf?.roots
  if (!roots || typeof roots !== 'object') return null
  // 严口径节(实时层专属);不在就回落空(下方逐盘 fallback 到卫生尺全集)
  const strict = roots.liveWatch?.allow
  const map = new Map()
  for (const [root, decl] of Object.entries(roots)) {
    if (root === 'liveWatch') continue // 不是盘根,跳过
    // key 统一成"盘符:\"形态(node fs.watch 回调给的 path 形态不稳定,归一化再比)
    const norm = normalizeRoot(root)
    // 严口径优先:liveWatch.allow[盘] 比卫生尺 roots[盘].allow 更紧(只窄不宽)
    const strictSet = strict?.[root] ?? strict?.[norm]
    const base = decl?.allow ?? []
    map.set(norm, new Set(strictSet ?? base))
  }
  return map
}

/** 归一化一个盘根路径为 "X:\" 形态(大小写不敏感比较用 upper)。 */
export function normalizeRoot(p) {
  return (p.replace(/[\\/]+$/, '') + '\\').toUpperCase()
}

/**
 * 启动实时监听。对每个申报盘根挂一个 fs.watch(一级),非白名单条目出现 ⇒ 立即 onStray。
 *
 * @param {object} opts
 * @param {Array<string>} [opts.roots] 要监听的盘根(默认 = 白名单里申报的所有盘根)
 * @param {Map<string,Set<string>>} [opts.allowlist] 注入白名单(测试用);不给则读 config
 * @param {function} opts.onStray (path, kind) => void  kind ∈ 'add'|'change'|'unlink'
 * @param {function} [opts.logger] 日志
 * @param {object} [opts._watchImpl] 测试注入:替换 fs.watch(避免真挂系统盘)
 * @returns {{watchers: Array, close: ()=>void}} watchers 数组 + 一次性关闭句柄
 */
export function startDiskRootLiveWatch(opts = {}) {
  const { roots = null, allowlist = null, onStray = () => {}, logger = () => {}, _watchImpl = watch } = opts
  const al = allowlist || loadAllowlist()
  if (!al) {
    logger('ℹ️ 盘根实时监听:取不到 config/disk-root-allowlist.json ⇒ 无法判定,未启动')
    return { watchers: [], close: () => {}, why: '白名单取不到' }
  }
  const watchRoots = roots || [...al.keys()]
  const watchers = []
  let closed = false

  for (const root of watchRoots) {
    if (!existsSync(root)) {
      logger(`ℹ️ 盘根实时监听:${root} 不存在 ⇒ 跳过(本机没有这块盘)`)
      continue
    }
    const allowSet = al.get(normalizeRoot(root)) || new Set()
    try {
      const w = _watchImpl(root, { recursive: false }, (eventType, filename) => {
        if (closed) return
        // filename 可能是 Buffer 或 null(平台差异);非字符串一律跳过(不猜名字)。
        if (typeof filename !== 'string' || !filename) return
        // 一级条目名(排除子目录深路径——递归=false 下理论不给,防御性再滤一次)
        if (filename.includes('/') || filename.includes('\\')) return
        if (allowSet.has(filename)) return // 白名单内,放行(不算外流)
        const full = join(root, filename)
        onStray(full, eventType)
      })
      watchers.push({ root, watcher: w })
      logger(`✅ 盘根实时监听已挂:${root}(白名单 ${allowSet.size} 项)`)
    } catch (e) {
      logger(`⚠️ 盘根实时监听挂载失败:${root} — ${e?.message || e}`)
    }
  }

  return {
    watchers,
    close() {
      closed = true
      for (const { watcher } of watchers) {
        try {
          watcher.close()
        } catch {
          /* 已关/未就绪,忽略 */
        }
      }
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
