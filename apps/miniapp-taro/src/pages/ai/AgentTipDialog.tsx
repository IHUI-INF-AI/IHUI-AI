import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'
import './AgentTipDialog.css'

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
    <View className="agent-tip-mask" onClick={onClose}>
      <View className="agent-tip-card" onClick={(e) => e.stopPropagation()}>
        <Text className="agent-tip-title">
          {tt('ai.chat.agentTipTitle', '智能体使用说明')}
        </Text>
        <View className="agent-tip-list">
          {tips.map((tip, i) => (
            <View key={i} className="agent-tip-item">
              <Text className="agent-tip-item-icon">{tip.icon}</Text>
              <View className="agent-tip-item-body">
                <Text className="agent-tip-item-title">{tip.title}</Text>
                <Text className="agent-tip-item-desc">{tip.desc}</Text>
              </View>
            </View>
          ))}
        </View>
        <View className="agent-tip-btn" onClick={onClose}>
          <Text className="agent-tip-btn-text">
            {tt('ai.chat.agentTipConfirm', '我知道了')}
          </Text>
        </View>
      </View>
    </View>
  )
}
