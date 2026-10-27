// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 头像尺寸与形状档的跨端单一源(web / 小程序 / RN 共用),模式同 `voice-input-spec.ts`。
 *
 * 立项读数(2026-10-22,门 128 `--pair-all` 现读):三端原本各写一份表 ——
 *   web `src/components/data/Avatar.tsx`  xs24/sm32/md40/lg48/xl64
 *   RN  `packages/ui-native/src/avatar.tsx` sm32/md40/lg48(与 web 同名同值)
 *   小程序 `apps/miniapp-taro/src/components/Avatar.tsx` sm24/md32/lg40/xl56(同名而整体小一档)
 * ⇒ 同名不同值就是"改一端另一端不跟随"的机器成因。机主 2026-10-22 定档:
 * **取 web/RN 已同值的五档为唯一表,小程序整体升一档**(sm 24→32、md 32→40、lg 40→48、xl 56→64),
 * 字号只有 xl 由 18→20。取值全部落在既有 Tailwind 档位上(h-6/8/10/12/16、text-xs/sm/base/xl),
 * 不引入新数字,也不写裸 px 字面量。
 *
 * 圆角不在此表另起一档:项目规则"头像外层容器禁止 rounded-full,统一 rounded-md",
 * 方形档取 `card`(lg=8),两者都由 design-tokens 的档位表映射,不在本文件写数值。
 */

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/** 逻辑 px(盒边长)。`AVATAR_TAILWIND` 是同一张表的类名形态,两端不得各写第二份。 */
export const AVATAR_PX: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
}

/**  initials 字号(逻辑 px),与 AVATAR_PX 同表同序。 */
export const AVATAR_TEXT_PX: Record<AvatarSize, number> = {
  xs: 12,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
}

/** 盒 + 字号的 Tailwind 类名(web / miniapp-taro / NativeWind 三侧同形)。 */
export const AVATAR_TAILWIND: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
}

/** RN 的 <Text> 不级联父 <View> 的 text-* 类,字号必须单独挂在 <Text> 上(web 容器可直接吃 AVATAR_TAILWIND 里的 text-*)。 */
export const AVATAR_TEXT_TAILWIND: Record<AvatarSize, string> = {
  xs: 'text-xs',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-xl',
}

/**
 * 形状 → 圆角**档位名**(xs..2xl,取自 design-tokens 的 RADIUS_STEPS,本文件不写数值)。
 * 不借用角色名:项目规则对头像写的是档位而非角色("禁止 rounded-full,统一 rounded-md"),
 * 而 `popover` 那一角色管的是贴锚点小浮层,拿它给头像换算等于给下一处误用留口子。
 */
export const AVATAR_SHAPE_STEP = {
  circle: 'md',
  square: 'lg',
} as const

export type AvatarShape = keyof typeof AVATAR_SHAPE_STEP

/** 表自证:三张表必须同序同集,少一格就是又造出一处需要人记住的隐式约束。 */
export function avatarSpecSelfCheck(): { ok: boolean; why?: string } {
  const keys = Object.keys(AVATAR_PX)
  for (const [name, tbl] of [
    ['AVATAR_TEXT_PX', AVATAR_TEXT_PX],
    ['AVATAR_TAILWIND', AVATAR_TAILWIND],
    ['AVATAR_TEXT_TAILWIND', AVATAR_TEXT_TAILWIND],
  ] as const) {
    const ks = Object.keys(tbl)
    if (ks.length !== keys.length || !ks.every((k) => keys.includes(k)))
      return { ok: false, why: `${name} 键集与 AVATAR_PX 不同形` }
  }
  const px2step = new Map<number, string>([
    [24, 'h-6 w-6'],
    [32, 'h-8 w-8'],
    [40, 'h-10 w-10'],
    [48, 'h-12 w-12'],
    [64, 'h-16 w-16'],
  ])
  for (const k of keys as AvatarSize[]) {
    const want = px2step.get(AVATAR_PX[k])
    if (!want || !AVATAR_TAILWIND[k].startsWith(want))
      return { ok: false, why: `AVATAR_TAILWIND.${k} 与 AVATAR_PX.${k}=${AVATAR_PX[k]}px 不同档` }
  }
  return { ok: true }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
