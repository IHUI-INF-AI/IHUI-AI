// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useAuthStore } from '@/stores/auth'
import { getSidebarNavPreference, updateSidebarNavPreference } from '@ihui/api-client'

/**
 * 自定义侧边栏功能键(2026-10-16 立)
 *
 * 需求:登录态下,用户在侧边栏「自定义」栏中添加自己常用的侧边栏功能键,
 * 数据按用户 id 隔离,并随账号持久化在服务端(本地 localStorage 只做缓存)。
 *
 * 设计要点:
 * - 仅存储 href 字符串,图标/文案/翻译全部在渲染期从当前可见导航项解析,
 *   保证与现有导航项视觉、active 高亮、预取行为完全一致,且后续改导航文案零维护成本。
 * - **本层不判断"某个 href 还有效吗"**(2026-10-25 改,原为"按允许集剔除失效项"):
 *   可见项集合是异步攒出来的(admin 后台路由每次挂载由 useAdminRouters() 现拉,刻意无
 *   模块级缓存),任何一刻的快照都不完整。拿不完整当"已删除"⇒ 用户收藏里那些还没加载
 *   出来的项被抹掉,并随下一次编辑写回服务端 ⇒ 换设备必须重设、各设备还不一致。
 *   死链由视图层挡(渲染期在可见项表里查不到就不出链接),不靠删数据挡。
 *   代价:路由被永久删除后,这条 href 会以"不可见"形态留在列表里占一个槽位(服务端上限 50)。
 *   这个代价小于静默丢用户数据。
 * - SSR 安全:首帧 userId 为空(无 cookie),组件不渲染;客户端 auth 水合后再决定显隐。
 */

const STORAGE_PREFIX = 'sidebar-custom-nav-'

/** 基线哨兵:与任何合法序列化值都不同,用于"下次变更必须重推" */
const NEEDS_PUSH = 'needs-push'

/**
 * 只清洗形状,不判断有效性:非字符串丢掉、同 href 去重(保持顺序)。
 *
 * 去重是必需的(不是洁癖):同一 href 出现两次会产生重复 React key,并且自定义栏的
 * 拖拽 sortable id 就是 href —— 重复 id 下 dnd-kit 行为未定义。服务端口径只在 PUT
 * 侧去重,GET 侧没有,客户端必须自己兜住。
 */
function filterValid(hrefs: unknown): string[] {
  if (!Array.isArray(hrefs)) return []
  const out: string[] = []
  for (const h of hrefs) {
    if (typeof h !== 'string' || out.includes(h)) continue
    out.push(h)
  }
  return out
}

function readUserHrefs(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + userId)
    if (!raw) return []
    return filterValid(JSON.parse(raw))
  } catch {
    return []
  }
}

export interface CustomNavApi {
  /** 当前登录用户 id;null 表示未登录 */
  userId: string | null
  /** 是否已从 localStorage 水合(用于避免 SSR/client 闪烁) */
  hydrated: boolean
  /** 当前用户的自定义 href 列表(仅清洗形状,顺序即显示顺序) */
  customHrefs: string[]
  /** 添加一个 href(已存在则幂等) */
  addHref: (href: string) => void
  /** 移除一个 href */
  removeHref: (href: string) => void
  /** 拖拽排序:把 fromHref 这一项搬到 toHref 所在的位置 */
  reorderHref: (fromHref: string, toHref: string) => void
  /** 判断某 href 是否已被收藏 */
  isCustom: (href: string) => boolean
}

export function useCustomNav(): CustomNavApi {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const [hrefs, setHrefs] = React.useState<string[]>([])
  const [hydrated, setHydrated] = React.useState(false)
  // 服务端已确认过状态的用户 id:同步只做一次,避免每次重渲染都打接口。
  // 用 ref 而非 state —— 它不参与渲染,变化不该触发重渲染。
  const syncedUserRef = React.useRef<string | null>(null)
  // 上一次处理的用户 id(用于换号时重置基线/重试计数)
  const lastUserRef = React.useRef<string | null>(null)
  // 上推基线:已推上远端的最后一次序列化值(见下方"变更上推")
  const lastSyncedRef = React.useRef<string | null>(null)
  // 本次挂载从本地读到的那一份快照:同步在飞期间的新增要靠它认出来(见服务端同步)
  const loadedSnapshotRef = React.useRef<string[]>([])

  // 当前 hrefs 的镜像 ref:跨设备重拉在事件回调里读它,而不是把 hrefs 塞进依赖 ——
  // 塞进依赖会让回调每次渲染重建、监听器反复重挂。
  const hrefsRef = React.useRef<string[]>(hrefs)
  hrefsRef.current = hrefs

  // 登录态变化 / 首次挂载:按用户 id 从 localStorage 载入该用户的自定义项(先给本地态,
  // 远端随后覆盖)。本 hook 每个用户只认这一次载入 —— 有效性与可见性无关(见文件头),
  // 所以导航结构后续怎么变都不需要重读本地。
  React.useEffect(() => {
    if (lastUserRef.current !== userId) {
      lastUserRef.current = userId
      // 换号:基线必须重置。否则 B 账号归并后的串若恰好等于 A 账号留下的基线,
      // 上推判等会直接 return ⇒ B 的收藏永远上不了云。
      lastSyncedRef.current = null
    }
    if (!userId) {
      loadedSnapshotRef.current = []
      setHrefs([])
      setHydrated(true)
      return
    }
    const stored = readUserHrefs(userId)
    loadedSnapshotRef.current = stored
    setHrefs(stored)
    setHydrated(true)
  }, [userId])

  // 服务端同步(2026-10-16 立):登录后拉一次远端,与本地归并。
  //
  // 归并规则(必须是可判定的,不能靠"哪边新"猜):
  //  - 远端从未设置过(exists=false)⇒ 以本地为准,并把本地推上去。
  //    这是老用户升级路径:他以前只在 localStorage 存过,第一次上云时不能丢。
  //  - 远端设置过 ⇒ **以远端为准**(服务端是唯一真相源),本地差异直接丢弃。
  //    不做双向并集:并集会让"我在 B 设备删掉的项"被 A 设备的陈旧缓存复活。
  //    唯一例外(2026-10-25 补):GET 在飞期间本机**新增**的项要跟着采用后的远端一起留下,
  //    并按完整列表推上云 —— 那一下是用户刚做的操作,盖掉它等于"新设备上加的第一项没保存"。
  //  - 网络失败 ⇒ 保持本地态,不打标记,**退避重试**(2026-10-17 修)。
  //    原实现只 return,而同步 effect 的依赖是 [userId, hydrated],同一次挂载内
  //    永远不会再跑 ⇒ 登录瞬间网络抖一下,整会话的远端通路就关死了:后面的
  //    增删改一条都推不上云(上推被"同步未完成"闸门挡住),跨设备同步静默失效。
  React.useEffect(() => {
    if (!userId || !hydrated) return
    if (syncedUserRef.current === userId) return
    let cancelled = false
    let retries = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const attempt = async () => {
      const res = await getSidebarNavPreference()
      if (cancelled) return
      if (!res.success) {
        // 5s / 15s / 45s 退避,最多 3 次;再失败就交给下次挂载(不无限重试)
        if (retries >= 3) return
        timer = setTimeout(() => void attempt(), [5000, 15000, 45000][retries])
        retries += 1
        return
      }
      syncedUserRef.current = userId
      const remote = filterValid(res.data.hrefs)
      // 远端从未设置过时的首次上云内容(本地也空则无需写)
      const local = readUserHrefs(userId)
      // GET 在飞期间本机加上的项(现在列表里有、而载入快照里没有)是本会话刚做的那一下,
      // 不是陈旧缓存 ⇒ 采用远端时要带上它们(见"归并规则"里的例外)。
      // 只做新增方向:删除方向仍由远端裁决,否则别的设备删掉的项会被陈旧缓存复活。
      const pendingAdds = hrefsRef.current.filter(
        (h) => !loadedSnapshotRef.current.includes(h) && !remote.includes(h),
      )

      // 上推基线由「同步」这个动作建立,而不是由「上推 effect 的第一次运行」建立
      // (2026-10-19 修:新账号/新设备的第一项永远存不进账号)
      //
      // 立因:存在一条「同步成功但状态零变化」的路径 —— exists=false 且本地为空时,
      // 两个分支都不 setHrefs ⇒ 不重渲染 ⇒ 上推 effect 不会再跑 ⇒ 基线一直是 null。
      // 于是用户登录后的**第一次**改动正好撞进 `lastSyncedRef.current === null`
      // 的「首次只立基线,不推」分支,被当成基线静默吞掉(实测 PUT 尝试 0 次)。
      // 症状:每台新设备收藏第一项永远不落账号、换设备必须重来;而只要再收藏第二项,
      // 第二次改动触发 PUT 且带上完整列表 —— 于是「加两项就正常、加一项就丢」,自查极难。
      //
      // 基线取「远端那一份」:远端有记录 ⇒ 采用值 = 远端 ∪ 本机待落库的新增,后者与基线
      // 不等时由"变更上推"那条 effect 自动把完整列表推上去(本机无新增则不推,不产生回声)。
      lastSyncedRef.current = JSON.stringify(res.data.exists ? remote : local)

      if (res.data.exists) {
        setHrefs(pendingAdds.length > 0 ? [...remote, ...pendingAdds] : remote)
        return
      }
      if (local.length > 0) {
        setHrefs(local)
        void updateSidebarNavPreference(local)
      }
    }
    void attempt()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [userId, hydrated])

  // 仅当用户已登录且已水合后才持久化(未登录不写、不残留)
  React.useEffect(() => {
    if (!userId || !hydrated) return
    try {
      window.localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(hrefs))
    } catch {
      // localStorage 不可用(隐私模式等),静默降级为内存态
    }
  }, [userId, hydrated, hrefs])

  // 变更上推(2026-10-16 立):本地即时生效(乐观),远端异步写、失败不影响本地。
  // 首次同步完成的那个瞬间不推 —— 那次 hrefs 是"归并结果"本身,推上去等于自己写回自己。
  // 判据:以同步完成时的 hrefs 序列化为基线,之后只有序列化值变了才推。
  React.useEffect(() => {
    if (!userId || !hydrated) return
    // 同步未完成期间不写:那时 hrefs 还是"载入中"的中间态,推上去会污染远端。
    if (syncedUserRef.current !== userId) return
    const serialized = JSON.stringify(hrefs)
    if (lastSyncedRef.current === null) {
      lastSyncedRef.current = serialized // 立基线,不推
      return
    }
    if (lastSyncedRef.current === serialized) return
    lastSyncedRef.current = serialized
    // 写失败要复位基线(2026-10-17 修):服务端有 50 项上限,超限会 400;
    // 而基线此时已推进 ⇒ 之后所有变更都判"与基线相同"⇒ 静默全丢、再也不重试。
    // 复位后下一次变更会重新尝试写入。
    void Promise.resolve(updateSidebarNavPreference(hrefs)).then((res) => {
      // 复位成"必推哨兵"而不是 null:null 在下一次变更时会被当成"首次立基线",
      // 于是照样不推(等于没修)。哨兵与任何序列化值都不同 ⇒ 下次变更必推。
      if (res && res.success === false) lastSyncedRef.current = NEEDS_PUSH
    })
  }, [userId, hydrated, hrefs])

  // 跨标签页/多窗口同步(2026-10-17 立):另一个标签页改了同一个用户的收藏,
  // 本页要跟上(否则两边各写全量数组,互相覆盖)。
  React.useEffect(() => {
    if (!userId || !hydrated) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_PREFIX + userId) return
      setHrefs(readUserHrefs(userId))
      // 别把别处写的结果当成自己的基线:置空后下次变更会再推一次(幂等,无害)
      lastSyncedRef.current = null
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [userId, hydrated])

  // 跨设备实时同步(2026-10-19 立):窗口重新获得焦点 / 页面重新可见时重拉远端。
  //
  // 立因:此前只在挂载时拉一次,之后本页再也不问服务端 ⇒ 用户在 A 设备改了收藏,
  // B 设备开着的标签页永远停在旧值 —— 表现就是"同步没生效、每台设备各是一套"。
  //
  // 为什么不用轮询:侧边栏常驻,标签页可能开几小时,常驻定时器是纯空闲负载;
  // 焦点/可见性才是"用户真的在用这个页面"的信号。零空闲开销,业界通行做法。
  //
  // 三条保护(重拉会用远端盖掉本地,所以每次都必须先回答"现在覆盖安全吗"):
  //  1) 同步未完成 ⇒ 远端状态未知,不拉(否则用半截远端盖掉刚载入的本地)
  //  2) 基线是 NEEDS_PUSH ⇒ 本机有推失败的改动正待落库,不拉(否则未落库的改动被抹掉)
  //  3) 请求期间基线变了 ⇒ 本机刚发生过改动/推送,本次结果已过期,丢弃
  // 三条同一个方向:宁可晚点同步,不可丢用户刚做的操作。
  React.useEffect(() => {
    if (!userId || !hydrated) return
    let inFlight = false
    let debounce: ReturnType<typeof setTimeout> | null = null

    const pull = async () => {
      if (inFlight) return
      if (syncedUserRef.current !== userId) return
      if (lastSyncedRef.current === NEEDS_PUSH) return
      const baselineAtStart = lastSyncedRef.current
      inFlight = true
      try {
        const res = await getSidebarNavPreference()
        // await 期间可能换号/登出:这批结果属于另一个用户,丢弃
        if (syncedUserRef.current !== userId) return
        if (!res.success) return // 单次失败静默跳过,下次聚焦自然重来(不做退避重试打爆接口)
        // 远端仍无记录 ⇒ 没有任何新东西可跟随,保持本地(基线也别动)
        if (!res.data.exists) return
        if (lastSyncedRef.current !== baselineAtStart) return // 期间本机动过,结果过期
        const remote = filterValid(res.data.hrefs)
        const settled = JSON.stringify(remote)
        // 基线必须跟着换:否则"采用远端"这一下会被上推 effect 当成本机改动原样回写,
        // 形成"A 删 → B 跟随删 → B 又推一遍"的乒乓。
        lastSyncedRef.current = settled
        if (settled === JSON.stringify(hrefsRef.current)) return // 无变化,不动 state
        setHrefs(remote)
      } finally {
        inFlight = false
      }
    }

    // focus 与 visibilitychange 在切标签页时会连发,去抖到 300ms 只拉一次
    const schedule = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => void pull(), 300)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') schedule()
    }

    window.addEventListener('focus', schedule)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      if (debounce) clearTimeout(debounce)
      window.removeEventListener('focus', schedule)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, hydrated])

  const addHref = React.useCallback((href: string) => {
    setHrefs((prev) => (prev.includes(href) ? prev : [...prev, href]))
  }, [])

  const removeHref = React.useCallback((href: string) => {
    setHrefs((prev) => prev.filter((h) => h !== href))
  }, [])

  const isCustom = React.useCallback((href: string) => hrefs.includes(href), [hrefs])

  /**
   * 把 fromHref 搬到 toHref 所在的位置(拖拽排序)。
   *
   * 为什么按 href 而不是按下标(2026-10-25):列表里可以夹着"此刻不可见"的收藏项
   * (后台路由没加载出来、或该角色现在看不到它),渲染出来的行与内部数组不同形 ——
   * 拿行下标去搬数组下标会搬错东西。dnd-kit 的 sortable id 本来就是 href,直接用它。
   * 任一 href 不在列表里 / 原地不动 ⇒ 返回原数组引用,不触发无意义的重渲染与远端写。
   */
  const reorderHref = React.useCallback((fromHref: string, toHref: string) => {
    setHrefs((prev) => {
      const from = prev.indexOf(fromHref)
      const to = prev.indexOf(toHref)
      if (from < 0 || to < 0 || from === to) return prev
      const next = [...prev]
      // splice 的返回类型是 string[](索引访问在 noUncheckedIndexedAccess 下为 string|undefined),
      // 索引已在上面判过、取值必然存在;仍显式兜一层,避免未来改动把这里变成 undefined 注入点 —
      // 往 hrefs 里塞 undefined 会一路传到 NavLink 的 href 上,症状离病灶很远。
      const [moved] = next.splice(from, 1)
      if (moved === undefined) return prev
      next.splice(to, 0, moved)
      return next
    })
  }, [])

  return { userId, hydrated, customHrefs: hrefs, addHref, removeHref, reorderHref, isCustom }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
