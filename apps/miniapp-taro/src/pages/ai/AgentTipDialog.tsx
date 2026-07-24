import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'

export interface AgentTipDialogProps {
  visible: boolean
  onClose: () => void
}

/** 智能体提示说明弹窗(对标原 ai_index.vue 智能体使用说明弹窗,首次进入或点击 "?" 触发) */
export default function AgentTipDialog({ visible, onClose }: AgentTipDialogProps) {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

  if (!visible) return null

  const tips = [
    {
      icon: '⚡',
      title: tt('ai.chat.agentTipSkill', '选择技能'),
      desc: tt('ai.chat.agentTipSkillDesc', '点击左上角技能按钮,选择对应智能体'),
    },
    {
      icon: '💬',
      title: tt('ai.chat.agentTipTalk', '选择对话'),
      desc: tt('ai.chat.agentTipTalkDesc', '切换到对话模式,与 AI 直接交流'),
    },
    {
      icon: '🎨',
      title: tt('ai.chat.agentTipImage', '选择绘图'),
      desc: tt('ai.chat.agentTipImageDesc', '切换到绘图模式,生成图片'),
    },
    {
      icon: '⌨️',
      title: tt('ai.chat.agentTipInput', '输入问题'),
      desc: tt('ai.chat.agentTipInputDesc', '在底部输入框输入你的问题,按发送'),
    },
    {
      icon: '📜',
      title: tt('ai.chat.agentTipHistory', '历史记录'),
      desc: tt('ai.chat.agentTipHistoryDesc', '可查看历史对话'),
    },
  ]

  return (
    <View className="fixed top-0 left-0 right-0 bottom-0 bg-black/45 flex items-center justify-center z-[100]" onClick={onClose}>
      <View className="w-[600rpx] bg-card rounded-[16rpx] py-[40rpx] px-[32rpx] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <Text className="block text-[34rpx] font-semibold text-foreground text-center mb-[32rpx]">
          {tt('ai.chat.agentTipTitle', '智能体使用说明')}
        </Text>
        <View className="flex flex-col gap-[24rpx] mb-[40rpx]">
          {tips.map((tip, i) => (
            <View key={i} className="flex items-start">
              <Text className="text-[32rpx] mr-[16rpx] leading-[1.5]">{tip.icon}</Text>
              <View className="flex-1">
                <Text className="block text-[28rpx] font-medium text-foreground leading-[1.5]">{tip.title}</Text>
                <Text className="block text-[24rpx] text-muted-foreground leading-[1.5] mt-[4rpx]">{tip.desc}</Text>
              </View>
            </View>
          ))}
        </View>
        <View className="h-[80rpx] bg-primary rounded-[12rpx] flex items-center justify-center" onClick={onClose}>
          <Text className="text-[28rpx] text-foreground">
            {tt('ai.chat.agentTipConfirm', '我知道了')}
          </Text>
        </View>
      </View>
    </View>
  )
}
