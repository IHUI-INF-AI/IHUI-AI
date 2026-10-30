// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 智汇值流水筛选区(消耗对象两档 + 时间范围四档)
// 可达性取证(2026-10-30):后端 GET /token/records(miniapp-compat-routes.ts)只按令牌主体
// userId 过滤,pageQuerySchema 仅解析 page/pageSize —— type 与 orderType 会被 Zod 静默剥掉,
// 所以这四档筛选当前不回真值。词条本身照常渲染(标签都在册),此处不冒充「已过滤」:
// 真按档过滤要等后端补 op_type/时间维入参(见交付报告的射程外清单)。
import { View, Text } from '@tarojs/components'
import type { TtFn } from '@/i18n'

export type TokenBarType = 'w' | 'm' | 'y' | 'a'
export type TokenActiveBtn = 'agent' | 'orders'

const BAR_LIST: Array<{ value: TokenBarType; key: string; fb: string }> = [
  { value: 'w', key: 'devEnter.modelEdit.limitedDuration7Day', fb: '7天' },
  { value: 'm', key: 'tokenBalance.d1', fb: '一个月' },
  { value: 'y', key: 'tokenBalance.d2', fb: '近一年' },
  { value: 'a', key: 'common.all', fb: '全部' },
]

interface TokenFilterBarProps {
  tt: TtFn
  active: TokenActiveBtn
  range: TokenBarType
  onPickAgent: () => void
  onPickOrders: () => void
  onPickRange: (val: TokenBarType) => void
}

/** 消耗对象切换(智能体 / 大模型)+ 时间范围四档 */
export default function TokenFilterBar({
  tt,
  active,
  range,
  onPickAgent,
  onPickOrders,
  onPickRange,
}: TokenFilterBarProps) {
  return (
    <>
      <View className="func-bar">
        <View
          className={`func-btn${active === 'agent' ? ' active' : ''}`}
          onClick={onPickAgent}
          hoverClass="opacity-60"
        >
          <Text>{tt('token.balance.agentConsume', '智能体消耗')}</Text>
        </View>
        <View
          className={`func-btn${active === 'orders' ? ' active' : ''}`}
          onClick={onPickOrders}
          hoverClass="opacity-60"
        >
          <Text>{tt('token.balance.ordersConsume', '大模型消耗')}</Text>
        </View>
      </View>

      <View className="tab-bar">
        {BAR_LIST.map((b) => (
          <View
            key={b.value}
            className={`tab-item${range === b.value ? ' active' : ''}`}
            onClick={() => onPickRange(b.value)}
            hoverClass="opacity-60"
          >
            <Text>{tt(b.key, b.fb)}</Text>
          </View>
        ))}
      </View>
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
