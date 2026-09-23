// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对话流交代区(RN 端共享组件):引用来源 + 本轮上下文注入。
//
// 为什么单独成文件:`CitationList` / `InjectionDisclosure` 最早是 `AiAssistantN8nScreen.tsx`
// 里的局部函数,`ChatScreen` 要接同一批 SSE 帧时只有两条路 —— 再抄一份(违 §3 共享层优先,
// 且两处措辞/样式必然漂移)或抽成组件。这里选后者,并让取词键也从 `aiAssistantN8n.*`
// 抬到 `chatDisclosure.*`(交代区不再是 N8n 屏专属,命名空间跟着归属走)。
import { useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronDown, ChevronRight, Zap } from 'lucide-react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useI18n } from '../i18n'
import { rpx } from '../utils/rpx'
import type { MessageCitation, MessageInjection, SteerNotice } from '../utils/chat-render-model'

/**
 * 引用来源列表:来源标签 + 条目文字。
 * 只有 **http(s)** 外链才给跳转(仓库相对路径在手机端没有可打开的目标,给了就是死链)。
 */
export function CitationList({
  items,
}: {
  items: readonly MessageCitation[]
}): React.JSX.Element | null {
  const { t } = useI18n()
  if (!items.length) return null
  return (
    <View style={disclosureStyles.block}>
      <Text style={disclosureStyles.blockTitle}>{t('chatDisclosure.citationTitle')}</Text>
      {items.map((item, index) => {
        const url = item.url
        const external = typeof url === 'string' && /^https?:\/\//i.test(url)
        const body = (
          <>
            <Text style={disclosureStyles.meta}>{item.source}</Text>
            <Text style={disclosureStyles.text} numberOfLines={2}>
              {item.label}
            </Text>
          </>
        )
        return (
          <View key={`${item.source}_${index}`} style={disclosureStyles.card}>
            {external && url ? (
              <Pressable
                style={disclosureStyles.cardHead}
                accessibilityRole="link"
                accessibilityLabel={url}
                onPress={() => {
                  void Linking.openURL(url)
                }}
              >
                {body}
              </Pressable>
            ) : (
              <View style={disclosureStyles.cardHead}>{body}</View>
            )}
          </View>
        )
      })}
    </View>
  )
}

/** 注入来源 kind → 本端取词键(与 apps/ai-service llm.py 的 injection_frames 同源) */
const INJECTION_KIND_KEYS = {
  developer_instructions: 'chatDisclosure.kindDeveloper',
  workspace_memory: 'chatDisclosure.kindWorkspace',
  repo_wiki: 'chatDisclosure.kindRepoWiki',
  auto_context: 'chatDisclosure.kindAutoContext',
} as const

/** 注入交代条:一行一个来源;只有帧里确实带了 fullText 才给展开入口(不给假按钮) */
export function InjectionDisclosure({
  items,
}: {
  items: readonly MessageInjection[]
}): React.JSX.Element | null {
  const { t } = useI18n()
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({})
  if (!items.length) return null
  return (
    <View style={disclosureStyles.block}>
      <Text style={disclosureStyles.blockTitle}>{t('chatDisclosure.injectionTitle')}</Text>
      {items.map((item, index) => {
        const key = `${item.kind}_${index}`
        const open = openKeys[key] === true
        const kindKey =
          item.kind in INJECTION_KIND_KEYS
            ? INJECTION_KIND_KEYS[item.kind as keyof typeof INJECTION_KIND_KEYS]
            : undefined
        return (
          <View key={key} style={disclosureStyles.card}>
            <Pressable
              style={disclosureStyles.cardHead}
              onPress={() => setOpenKeys((prev) => ({ ...prev, [key]: !open }))}
              accessibilityRole="button"
              accessibilityLabel={item.collapsed}
            >
              {item.fullText ? (
                open ? (
                  <ChevronDown size={10} color={tokens.text.tertiary} />
                ) : (
                  <ChevronRight size={10} color={tokens.text.tertiary} />
                )
              ) : null}
              {/* 界面文本出自本端词表;后端中文 collapsed 仅在未知 kind 时兜底 */}
              <Text style={disclosureStyles.text}>{kindKey ? t(kindKey) : item.collapsed}</Text>
              {typeof item.count === 'number' ? (
                <Text style={disclosureStyles.meta}>{item.count}</Text>
              ) : null}
            </Pressable>
            {open && item.fullText ? (
              <View style={disclosureStyles.cardBody}>
                <Text style={disclosureStyles.text}>{item.fullText}</Text>
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

/** 单条引导文本的展示截断长度(对齐 web SteerNoticeBar STEER_NOTICE_PREVIEW_LIMIT:原文 ≤4000
 *  字符已入 LLM 上下文,交代侧只做预览) */
const STEER_NOTICE_PREVIEW_LIMIT = 120

/**
 * 引导交代条(D106 Steer 中途引导可视化):SSE steer 事件(phase='injected')回执,
 * 经 api-client onSteer → 屏内 appendSteerFrames 落到 assistant 消息上渲染本组件。
 * 形态对齐 web SteerNoticeBar:计数标题 + Zap 图标,正文为每条引导文本预览(超长截断)。
 */
export function SteerNoticeList({
  items,
}: {
  items: readonly SteerNotice[]
}): React.JSX.Element | null {
  const { t } = useI18n()
  if (!items.length) return null
  return (
    <View style={disclosureStyles.block}>
      <View style={disclosureStyles.steerHead}>
        <Zap size={10} color={tokens.text.tertiary} />
        <Text style={disclosureStyles.blockTitle}>
          {t('chatDisclosure.steerTitle', { count: items.length })}
        </Text>
      </View>
      {items.slice(0, 3).map((item, index) => (
        <View key={`steer_${index}`} style={disclosureStyles.card}>
          <View style={disclosureStyles.cardHead}>
            <Text style={disclosureStyles.text} numberOfLines={3}>
              {item.text.length > STEER_NOTICE_PREVIEW_LIMIT
                ? `${item.text.slice(0, STEER_NOTICE_PREVIEW_LIMIT)}…`
                : item.text}
            </Text>
          </View>
        </View>
      ))}
      {items.length > 3 ? (
        <Text style={disclosureStyles.meta}>
          {t('chatDisclosure.steerMore', { count: items.length - 3 })}
        </Text>
      ) : null}
    </View>
  )
}

const disclosureStyles = StyleSheet.create({
  block: {
    maxWidth: '78%',
    marginTop: rpx(8),
    gap: rpx(6),
  },
  blockTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.text.tertiary,
  },
  steerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(4),
  },
  card: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.muted,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
    paddingHorizontal: rpx(12),
    paddingVertical: rpx(8),
  },
  cardBody: {
    paddingHorizontal: rpx(12),
    paddingBottom: rpx(10),
    gap: rpx(6),
  },
  text: { flex: 1, fontSize: 12, lineHeight: 18, color: tokens.text.primary },
  meta: { fontSize: 10, color: tokens.text.tertiary },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
