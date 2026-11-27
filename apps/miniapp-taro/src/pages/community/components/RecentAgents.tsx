// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RecentAgents — 最近使用的智能体横向滚动列表(小程序端适配层)
 *
 * 2026-11-27 样式对齐:此前直接复用 `AgentRecentUsed` 的 60px 头像 Chip,
 * 与 web / RN 共享屏的 224px 横向卡片(32 头像 + 名称 + 「最近使用」提示 + 右上「更多」)
 * 不是同一形态;且该组件自带 12px 横向内边距,叠加页面 16px 后内容被推到 28px。
 * 这里改为页面内联卡片行,标题/More/卡宽/边框/字号全部与共享屏同档。
 */
import { useTt } from '@/i18n'
import Taro from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import { onToast } from '@/host/on-toast'
import { getUserInfo } from '@/utils/auth'
import { rpx } from '@/utils/rpx'
import { taroType } from '@ihui/design-tokens'
import { resolveWebAssetUrl } from '@/utils/web-asset-url'
import LineIcon from '@/components/LineIcon'

export interface RecentAgent {
  id: string
  agentName: string
  agentAvatar: string
  /** 可选:智能体类型 3/5 为付费模型,点击时跳过跳转 */
  type?: number
  /** 可选:来源标识,如 'n8n' 跳转专用页面 */
  source?: string
  agentId?: string
}

export interface RecentAgentsProps {
  recentAgents: RecentAgent[]
}

export default function RecentAgents({ recentAgents }: RecentAgentsProps) {
  const tt = useTt()

  function navigateTo(agent: RecentAgent, idx: number) {
    const userData = getUserInfo()
    if (!userData) {
      onToast(tt('ai.aiAssistant.pleaseLogin', '请先登录'), { kind: 'error' })
      return
    }
    if (agent.type === 3 || agent.type === 5) {
      return
    }
    // XUI-018:旧 /pages/tools/* 路由已删除,改用 pkg-ai 分包在册路径。
    const targetUrl =
      agent.source === 'n8n' ? '/pkg-ai/ai-assistant-n8n/index' : '/pkg-ai/ai-assistant/index'
    const agentId = agent.agentId || agent.id
    Taro.navigateTo({
      url: `${targetUrl}?modelNamea=${encodeURIComponent(agent.agentName)}&pitcha=${idx}&agentId=${encodeURIComponent(agentId)}&type=${agent.type ?? ''}`,
    })
  }

  return (
    <View>
      {/* 标题行:与共享屏 sectionHead 同构,右侧 More 不再只在空态出现 */}
      <View
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: rpx(24),
        }}
      >
        <Text
          style={{
            display: 'block',
            fontSize: taroType.heading.fontSize,
            lineHeight: taroType.heading.lineHeight,
            fontWeight: 600,
            color: 'var(--color-foreground)',
          }}
        >
          {tt('communityRecentAgents.text1', '最近使用')}
        </Text>
        <View
          hoverClass="opacity-60"
          onClick={() =>
            Taro.navigateTo({
              url: '/pkg-content/category-detail/index',
              fail: () => onToast(tt('community.detail16', '分类详情页未配置'), { kind: 'error' }),
            })
          }
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: rpx(8) }}
        >
          <Text
            style={{
              display: 'block',
              fontSize: taroType.body.fontSize,
              lineHeight: taroType.body.lineHeight,
              color: 'var(--color-muted-foreground)',
            }}
          >
            {tt('common.more', '更多')}
          </Text>
          <LineIcon name="chevron-right" size={32} color="var(--color-muted-foreground)" />
        </View>
      </View>

      <ScrollView scrollX showScrollbar={false} style={{ width: '100%' }}>
        <View style={{ display: 'flex', flexDirection: 'row', gap: rpx(16) }}>
          {recentAgents.slice(0, 8).map((agent, idx) => {
            const avatar = resolveWebAssetUrl(agent.agentAvatar)
            const name = agent.agentName || '?'
            return (
              <View
                key={agent.id}
                hoverClass="opacity-60"
                onClick={() => navigateTo(agent, idx)}
                ariaRole="button"
                ariaLabel={name}
                style={{
                  width: rpx(448),
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: rpx(16),
                  padding: rpx(16),
                  borderRadius: rpx(12),
                  border: '2rpx solid var(--color-border)',
                  background: 'var(--color-card)',
                  boxSizing: 'border-box',
                }}
              >
                {avatar ? (
                  <Image
                    src={avatar}
                    mode="aspectFill"
                    style={{
                      width: rpx(64),
                      height: rpx(64),
                      borderRadius: rpx(32),
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: rpx(64),
                      height: rpx(64),
                      borderRadius: rpx(32),
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--color-muted)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: taroType.body.fontSize,
                        fontWeight: 600,
                        color: 'var(--color-foreground)',
                      }}
                    >
                      {name.trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      display: 'block',
                      fontSize: taroType.body.fontSize,
                      lineHeight: taroType.body.lineHeight,
                      fontWeight: 500,
                      color: 'var(--color-foreground)',
                    }}
                  >
                    {name}
                  </Text>
                  <View
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: rpx(8),
                      marginTop: rpx(4),
                    }}
                  >
                    <LineIcon name="clock" size={24} color="var(--color-muted-foreground)" />
                    <Text
                      style={{
                        display: 'block',
                        fontSize: taroType.caption.fontSize,
                        lineHeight: taroType.caption.lineHeight,
                        color: 'var(--color-muted-foreground)',
                      }}
                    >
                      {tt('community.recentHint', '最近用过')}
                    </Text>
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
