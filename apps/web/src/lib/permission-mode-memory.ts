// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * "上次主动选择的权限模式"的读写出口(票 G-414 ② 的第二格)
 *
 * 立因(现读复验于本票开工那枚 HEAD):
 * - 写侧住在 `apps/web/src/hooks/use-permission-mode-cycle.ts`(setItem),
 *   而它的注释承诺"首次绑定工作区时如果 store 没指定,优先用这个值" —— 全仓 `getItem` **零命中**。
 *   只写不读 = 第二份真相:存储里躺着一个没人兑现的约定。
 * - 顺带那行注释的第二处口径也不符:"仅记忆非默认模式" —— 旧写侧把 default 也写进去了。
 *
 * 现在读写同住这一处,读侧接线点用**封闭枚举**登记,不是散在各处的 if:
 * - `cycle-start`(已接线):Shift+Tab 循环在"既没绑定工作区、也没有暂存档位"时,
 *   以上次主动选择的档位为起点 —— 这只决定"下一档是谁",不产生任何切换动作,
 *   进 bypass-permissions 仍要走确认弹窗(见 @/lib/full-access-suppression)。
 * - `workspace-bind-apply`(**待拍板,未接线**):首次绑定工作区时是否据此**自动改档**。
 *   这一格会把"上一台的偏好"落到"新工作区的授权"上,属产品口径,不由实现票自行拍;
 *   翻成已接线之前,任何调用点都不得私自读这个 key 去切档。
 */

import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'
import { permissionModeWire } from '@ihui/types/permission-mode'

/** localStorage 键(沿用旧名,不改数据归属) */
export const PREFERRED_MODE_MEMORY_KEY = 'ihui:preferred-permission-mode'

/** 读侧接线点的封闭集 —— 新增一种用法必须先在这里登记,再在调用点真的用上。 */
export const PREFERRED_MODE_READ_USES = ['cycle-start', 'workspace-bind-apply'] as const
export type PreferredModeReadUse = (typeof PREFERRED_MODE_READ_USES)[number]

/** 已接线的读侧。差集就是"注释承诺过但今天还没兑现"的那一格(现读:只剩待拍板那一格)。 */
export const WIRED_PREFERRED_MODE_READ_USES: readonly PreferredModeReadUse[] = ['cycle-start']

/**
 * 写入上次主动选择的档位(归一到 wire 拼写,认不出的值一律清掉而不是留着半成品)。
 *
 * 两条刻意口径:
 * - `default` 不落盘:记 default 与"没有记忆"是同义,存它只会让存储里多出一个看起来不同的状态,
 *   而旧注释本来承诺的就是"仅记忆非默认模式"(旧写侧把 default 也写进去了 ⇒ 随本票一并兑现)。
 * - 解除绑定(mode 为 null/undefined)与非法值都走 remove:避免下次自动套用过时或认不出的档位。
 */
export function rememberPreferredPermissionMode(mode: string | null | undefined): void {
  if (typeof window === 'undefined') return
  try {
    const wire = mode === null || mode === undefined ? null : permissionModeWire(mode)
    if (wire === null || wire === undefined || wire === 'default') {
      window.localStorage.removeItem(PREFERRED_MODE_MEMORY_KEY)
      return
    }
    window.localStorage.setItem(PREFERRED_MODE_MEMORY_KEY, wire)
  } catch {
    // 隐私模式 / quota 超出:静默失败,但读侧会按"没有记忆"处理,不会读到半成品
  }
}

/** 读回上次主动选择的档位;没有记录 / 记录认不出来 ⇒ null(不猜、不兜成某个档) */
export function readPreferredPermissionMode(): WorkspacePermissionMode | null {
  if (typeof window === 'undefined') return null
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(PREFERRED_MODE_MEMORY_KEY)
  } catch {
    return null
  }
  if (raw === null || raw === '') return null
  return permissionModeWire(raw) ?? null
}

/**
 * Shift+Tab 的循环起点(`cycle-start` 那一格读侧)。
 *
 * 优先级刻意为"当场生效的档位 > 记忆 > default":记忆**永远不得覆盖**已绑定工作区的真实档位,
 * 否则界面显示与后端授权会分叉(而这类分叉在本仓的表现是"看着是 A 档、跑的是 B 档")。
 */
export function resolveCycleStartMode(
  liveMode: WorkspacePermissionMode | null | undefined,
  remembered: WorkspacePermissionMode | null = readPreferredPermissionMode(),
): WorkspacePermissionMode {
  return permissionModeWire(liveMode ?? remembered ?? 'default') ?? 'default'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
