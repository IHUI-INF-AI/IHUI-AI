// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * NoticeLog —— 对话内「提示留痕」的 **小程序渲染层**(2026-11 立)。
 *
 * 立因(用户原话:「那种的难道不应该在 ai 对话框里显示吗 不然怎么留痕 用户咋能记住」):
 * toast 是 4s 即逝的浮层,看完即忘、无法复盘。故每条 toast 额外落一条本记录,挂在消息列表
 * 尾部插槽(`messageListSlots.orphanTailNode`),随对话滚动、可回看、可长按复制。
 *
 * 与 RN 端(`apps/mobile-rn/src/components/chat/NoticeLog.tsx`)对齐的是**视觉语义**
 * (一行一条 = 语义色标记 + HH:mm + 原文),不是组件实现 —— 小程序没有 react-native,
 * 只能用 `@tarojs/components`。记录模型/去重/上限/编解码全部来自
 * `@ihui/shared/chat/notice-log`,本文件只做渲染。
 *
 * 图标为什么用 CSS 圆点而不是 LineIcon:端内 LineIcon 登记表(73 个字形)里
 * success→`check`、error→`x` 有同形字形,但 warning/info 没有 `alert-triangle` / `info`,
 * 四种状态只有两种有图标会让"看颜色/看形状"这一层语义自相矛盾;而补字形必须走
 * `gen:line-icons` 生成链路(改生成产物),超出本票范围。故统一用**圆点 + 语义色**:
 * 颜色本身即语义,零新增依赖,四态一致。
 *
 * 边界:
 * - **不进后端上下文/历史**:notices 是独立 state,不混入 `messages`,不会被发给模型、也不落库;
 * - 空列表返回 `null`:否则每条消息尾部都会挂一条空边框线;
 * - 文案原样来自 toast(上游已本地化),本组件零硬编码中文,不新增 i18n 键。
 */
import type { ReactElement } from 'react'
import { Text, View } from '@tarojs/components'
import type { ChatNotice, NoticeKind } from '@ihui/shared/chat/notice-log'
import { rpx } from '@/utils/rpx'

/**
 * 语义色取端内 CSS 变量(即设计 token 的运行时形态,与 RN 的 `tokens.*` 同源,
 * 浅/深色随 ThemeRoot 自动切换)。不写死十六进制,否则深色模式下这几行会刺眼。
 */
const COLORS: Readonly<Record<NoticeKind, string>> = {
  success: 'var(--color-success)',
  error: 'var(--color-danger)',
  warning: 'var(--color-warning)',
  info: 'var(--color-muted-foreground)',
}

/** 时刻口径与 RN 一致:只到分钟(HH:mm),留痕的用途是"何时发生过",秒无意义 */
function fmtTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function NoticeLog({ notices }: { notices: readonly ChatNotice[] }): ReactElement | null {
  if (notices.length === 0) return null
  return (
    <View
      style={{
        marginTop: rpx(16),
        marginLeft: rpx(24),
        marginRight: rpx(24),
        paddingTop: rpx(16),
        borderTop: `${rpx(1)} solid var(--color-border)`,
      }}
    >
      {notices.map((n) => (
        <View
          key={n.id}
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            marginBottom: rpx(8),
          }}
        >
          <View
            style={{
              width: rpx(8),
              height: rpx(8),
              borderRadius: rpx(4),
              marginTop: rpx(12),
              marginRight: rpx(8),
              backgroundColor: COLORS[n.kind],
              flexShrink: 0,
            }}
          />
          <Text
            style={{
              fontSize: rpx(22),
              lineHeight: rpx(32),
              color: 'var(--color-text-tertiary)',
              marginRight: rpx(8),
            }}
          >
            {fmtTime(n.ts)}
          </Text>
          {/* selectable:留痕要能复制出去(用户反馈/排查时贴给客服),与 RN 的 selectable 同义 */}
          <Text
            selectable
            style={{
              flex: 1,
              fontSize: rpx(24),
              lineHeight: rpx(32),
              color: 'var(--color-muted-foreground)',
            }}
          >
            {n.text}
          </Text>
        </View>
      ))}
    </View>
  )
}
