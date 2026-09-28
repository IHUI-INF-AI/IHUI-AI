// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端偏好的**跨设备漫游**客户端(2026-09-28 立,G-301)。
 *
 * 三条设计前提,不得在后续改动里被顺手改掉:
 *
 * 1. **本机那份 `desktop-behavior.json` 永远是执行真相。** 这里拉到账号值之后,是经
 *    `setDesktopPrefs` 写进宿主(由宿主裁定归一,例如托盘关了就不能是 hide),
 *    而不是"前端记一份同步态去覆盖界面"。断网/未登录/接口 500  ⇒ 一律回落到本机值,
 *    窗口与托盘行为绝不允许取决于网络状态。
 * 2. **"取不到"与"没开同步"必须分得开。** 所以读出口返回三态(`on` / `off` / `unknown`),
 *    而不是把失败折叠成 `enabled:false` —— 后者会把一次网络抖动显示成"用户关掉了同步",
 *    并让下一次保存顺手把账号侧写成关闭(与本仓"把没判写成判过了"同一条禁令)。
 * 3. **推拉都只推用户改过的那一项吗?不是 —— 这里推整份 prefs。** 服务端把 payload 当不透明
 *    JSONB 存(只校验形状,不解释语义),所以整份推过去不会与后端规则打架;而"只推差异"在
 *    跨设备场景没有意义(对端设备要的是完整一份)。去重靠 `lastPushedRef` 的内容指纹,
 *    避免"套用远端值"被立刻当成"本地新改动"再推回去(那是个回环)。
 *
 * 调用面只有一个:`useDesktopPrefsSync`(见下)。不得在组件里另写 fetch —— 端内直连后端
 * 由 AGENTS §3 与守门 73 拦,这里统一走 `@/lib/api` 的 fetchApi。
 */

import * as React from 'react'

import { checkDesktopPrefs } from '@ihui/types'
import { fetchApi } from '@/lib/api'
import { normalizeDesktopPrefs, type DesktopPrefs } from './desktop-prefs-bridge'

/** 账号侧返回的原始形状(prefs 在服务端是不透明 JSONB,可能为 null 或被旧版本写成脏值)。 */
interface ServerDesktopPrefs {
  enabled?: unknown
  prefs?: unknown
}

export type DesktopPrefsSyncState = 'off' | 'on' | 'unknown'

export interface DesktopPrefsSyncRead {
  state: DesktopPrefsSyncState
  prefs: DesktopPrefs | null
}

/**
 * 读账号侧偏好。任何失败 ⇒ `unknown`(不是 `off`)。
 * `enabled:false` 或形状不合 ⇒ `off` + prefs=null。
 */
export async function fetchRoamingPrefs(): Promise<DesktopPrefsSyncRead> {
  let res: Awaited<ReturnType<typeof fetchApi<ServerDesktopPrefs>>>
  try {
    // fetchApi 返回 ApiResult 判别联合:success:false 既可能是 401 也可能是 5xx,
    // 两者都属"判不出来",一律 unknown —— 把它读成 off 会让下一次保存顺手关掉账号侧同步。
    res = await fetchApi<ServerDesktopPrefs>('/desktop/prefs')
  } catch {
    return { state: 'unknown', prefs: null }
  }
  if (!res.success) return { state: 'unknown', prefs: null }
  const raw = res.data
  if (!raw || typeof raw !== 'object') return { state: 'unknown', prefs: null }
  if (raw.enabled !== true) return { state: 'off', prefs: null }
  // 形状判定用**后端那一份**校验器(checkDesktopPrefs),不用 normalizeDesktopPrefs ——
  // 后者对脏值回退默认档,会把"账号里存了份不合形状的东西"当成一份合法偏好写进宿主,
  // 现象是"换设备后设置莫名变回默认"。校验不过 ⇒ unknown(没判出来),不是 off(用户关掉了)。
  const check = checkDesktopPrefs(raw.prefs)
  if (!check.ok) return { state: 'unknown', prefs: null }
  return { state: 'on', prefs: normalizeDesktopPrefs(check.value) }
}

/**
 * 写账号侧。`enabled:false` 只关掉漫游,不动本机值;`enabled:true` 必须带整份 prefs。
 * 返回 false 表示没写成(网络/鉴权/校验),调用方必须把它显示出来而不是静默。
 */
export async function pushRoamingPrefs(body: {
  enabled: boolean
  prefs?: DesktopPrefs
}): Promise<boolean> {
  try {
    const res = await fetchApi('/desktop/prefs', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    return res.success === true
  } catch {
    return false
  }
}

export interface UseDesktopPrefsSyncArgs {
  /** 当前生效的本机偏好(null = 宿主还没给值,此时既不拉也不推)。 */
  prefs: DesktopPrefs | null
  /** 宿主可用(IPC 就绪且真在 Tauri 里)。 */
  available: boolean
  /** 已登录 —— 未登录时这条链整条不启动,而不是"拉一次拿 401"。 */
  authenticated: boolean
  /** 账号侧拉到值后经宿主写回本机(由宿主归一,前端不自算规则)。 */
  applyRemote: (remote: DesktopPrefs) => Promise<DesktopPrefs | null>
}

export interface UseDesktopPrefsSyncResult {
  /** `unknown` 只在读失败时出现,UI 据此把开关标成"状态未知"而不是"已关闭"。 */
  state: DesktopPrefsSyncState
  busy: boolean
  /** 上一次写账号侧失败(供 toast/文案使用;成功后自动清)。 */
  lastWriteFailed: boolean
  /** 返回是否写进了账号侧(false = 失败,调用方必须喊出来,不能静默)。 */
  setEnabled: (next: boolean) => Promise<boolean>
}

/**
 * 漫游钩子:挂载时读一次(登录后)→ 有值且开着就经宿主套用;本机值变了就整份推回。
 * 去重靠内容指纹:套用远端那次写入本机后,指纹会先对齐,不会再推一遍(回环防线)。
 */
export function useDesktopPrefsSync({
  prefs,
  available,
  authenticated,
  applyRemote,
}: UseDesktopPrefsSyncArgs): UseDesktopPrefsSyncResult {
  const [state, setState] = React.useState<DesktopPrefsSyncState>('off')
  const [busy, setBusy] = React.useState(false)
  const [lastWriteFailed, setLastWriteFailed] = React.useState(false)
  const lastPushedRef = React.useRef<string | null>(null) // 内容指纹:防"刚套用又推回去"的回环

  // ① 挂载读一次:只在"真宿主 + 已登录"时才发起 —— 未登录发出去必定 401,那是噪音不是信息。
  React.useEffect(() => {
    if (!available || !authenticated) return
    let cancelled = false
    void (async () => {
      const read = await fetchRoamingPrefs()
      if (cancelled) return
      setState(read.state)
      if (read.state === 'on' && read.prefs) {
        const applied = await applyRemote(read.prefs)
        if (cancelled || !applied) return
        lastPushedRef.current = JSON.stringify(applied)
      }
    })()
    return () => {
      cancelled = true
    }
    // 有意只跑一次:available/authenticated 到位后拉一次,后续同步走 ② 与 setEnabled。
  }, [available, authenticated])

  // ② 本机值变了 ⇒ 整份推回(仅当同步已开)。指纹相同就不推(避免刚套用又推回去)。
  React.useEffect(() => {
    if (!available || !prefs || state !== 'on') return
    const json = JSON.stringify(prefs)
    if (lastPushedRef.current === json) return
    void (async () => {
      const ok = await pushRoamingPrefs({ enabled: true, prefs })
      if (!ok) {
        setLastWriteFailed(true)
        return
      }
      lastPushedRef.current = json
      setLastWriteFailed(false)
    })()
  }, [available, prefs, state])

  const setEnabled = React.useCallback(
    async (next: boolean): Promise<boolean> => {
      setBusy(true)
      try {
        const ok = next
          ? prefs
            ? await pushRoamingPrefs({ enabled: true, prefs })
            : false
          : await pushRoamingPrefs({ enabled: false })
        if (ok) {
          setState(next ? 'on' : 'off')
          setLastWriteFailed(false)
          if (next && prefs) lastPushedRef.current = JSON.stringify(prefs)
        } else {
          setLastWriteFailed(true)
        }
        return ok
      } finally {
        setBusy(false)
      }
    },
    [prefs],
  )

  return { state, busy, lastWriteFailed, setEnabled }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
