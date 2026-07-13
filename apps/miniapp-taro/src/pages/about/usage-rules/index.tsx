import { View, Text } from '@tarojs/components'
import './index.css'

interface RuleSection {
  title: string
  items: string[]
}

const RULES: RuleSection[] = [
  {
    title: '一、账号管理',
    items: [
      '用户应使用真实手机号注册，每个手机号仅可注册一个账号。',
      '账号密码请妥善保管，因密码泄露导致的损失由用户自行承担。',
      '禁止转让、出借账号，一经发现将予以封禁处理。',
    ],
  },
  {
    title: '二、内容规范',
    items: [
      '禁止发布违法、色情、暴力、恐怖等不良信息。',
      '禁止侵犯他人知识产权、隐私权等合法权益。',
      'AI 生成内容应标注来源，不得冒充真人发布。',
      '禁止发布广告、垃圾信息等与平台无关的内容。',
    ],
  },
  {
    title: '三、使用限制',
    items: [
      '禁止利用平台服务从事任何违法违规活动。',
      '禁止使用自动化工具恶意攻击、爬取平台数据。',
      '禁止对平台进行反向工程、反编译等操作。',
      '每日 AI 调用次数受会员等级限制，请合理使用。',
    ],
  },
  {
    title: '四、免责声明',
    items: [
      'AI 生成内容仅供参考，平台不对其准确性、完整性承担责任。',
      '因不可抗力导致服务中断，平台不承担责任。',
      '用户因违反规范导致的损失，由用户自行承担。',
    ],
  },
]

export default function UsageRules() {
  return (
    <View className="page">
      {RULES.map((section) => (
        <View key={section.title} className="card">
          <Text className="section-title">{section.title}</Text>
          {section.items.map((item, idx) => (
            <View key={idx} className="rule-item">
              <Text className="dot">·</Text>
              <Text className="rule-text">{item}</Text>
            </View>
          ))}
        </View>
      ))}
      <View className="tips">
        <Text>本规范自发布之日起生效，平台保留最终解释权。</Text>
      </View>
    </View>
  )
}
