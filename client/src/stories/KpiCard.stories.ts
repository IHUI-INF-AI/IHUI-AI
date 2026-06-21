import type { Meta, StoryObj } from '@storybook/vue3'
import { User, ShoppingCart, Money, ChatLineRound } from '@element-plus/icons-vue'
import KpiCard from '@/views/admin/components/KpiCard.vue'

const meta: Meta<typeof KpiCard> = {
  title: '业务组件/KpiCard',
  component: KpiCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'KPI 指标卡,用于管理端首页展示关键数据。支持 5 种色调、上升/下降趋势、动态图标。',
      },
    },
  },
  argTypes: {
    label: { control: 'text', description: '指标名称' },
    value: { control: 'text', description: '指标数值' },
    unit: { control: 'text', description: '单位(可选)' },
    trend: { control: 'number', description: '趋势百分比(正数上升,负数下降)' },
    icon: { control: false, description: 'Element Plus 图标组件' },
    tone: {
      control: 'select',
      options: ['primary', 'success', 'warning', 'danger', 'info'],
      description: '色调',
    },
    description: { control: 'text', description: '补充说明' },
  },
  decorators: [
    () => ({
      template: '<div style="max-width: 320px;"><story /></div>',
    }),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

/* ═══ 默认/Primary ═══ */
export const Primary: Story = {
  args: {
    label: '注册用户',
    value: '12,486',
    trend: 8.2,
    icon: User,
    tone: 'primary',
    description: '本月新增 1,243',
  },
}

/* ═══ Success(订单) ═══ */
export const Success: Story = {
  args: {
    label: '今日订单',
    value: '328',
    unit: '单',
    trend: 12.5,
    icon: ShoppingCart,
    tone: 'success',
    description: '较昨日 +37 单',
  },
}

/* ═══ Warning(收入) ═══ */
export const Warning: Story = {
  args: {
    label: '今日收入',
    value: '¥18,260',
    trend: -2.3,
    icon: Money,
    tone: 'warning',
    description: '退款 ¥420',
  },
}

/* ═══ Danger(待办/工单) ═══ */
export const Danger: Story = {
  args: {
    label: '待处理工单',
    value: '7',
    unit: '个',
    trend: -15.0,
    icon: ShoppingCart,
    tone: 'danger',
    description: '紧急 2 条',
  },
}

/* ═══ Info(AI 对话) ═══ */
export const Info: Story = {
  args: {
    label: 'AI 对话',
    value: '9,142',
    unit: '次',
    trend: 23.6,
    icon: ChatLineRound,
    tone: 'info',
    description: '用户平均 3.2 轮',
  },
}

/* ═══ 下降趋势(负数) ═══ */
export const TrendingDown: Story = {
  args: {
    label: '页面跳出率',
    value: '38.4',
    unit: '%',
    trend: -8.6,
    icon: User,
    tone: 'success',
    description: '优于行业平均',
  },
}

/* ═══ 无单位、无描述 ═══ */
export const Minimal: Story = {
  args: {
    label: '在线用户',
    value: '542',
    trend: 4.2,
    icon: User,
    tone: 'primary',
  },
}

/* ═══ 多个并排(展示网格) ═══ */
export const Grid: Story = {
  render: () => ({
    components: { KpiCard },
    setup() {
      return { User, ShoppingCart, Money, ChatLineRound }
    },
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
        <KpiCard
          label="注册用户"
          value="12,486"
          :trend="8.2"
          :icon="User"
          tone="primary"
          description="本月新增 1,243"
        />
        <KpiCard
          label="今日订单"
          value="328"
          unit="单"
          :trend="12.5"
          :icon="ShoppingCart"
          tone="success"
          description="较昨日 +37 单"
        />
        <KpiCard
          label="今日收入"
          value="¥18,260"
          :trend="-2.3"
          :icon="Money"
          tone="warning"
          description="退款 ¥420"
        />
        <KpiCard
          label="AI 对话"
          value="9,142"
          unit="次"
          :trend="23.6"
          :icon="ChatLineRound"
          tone="info"
          description="用户平均 3.2 轮"
        />
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story: '实际使用中 4 张卡组成 KPI 网格的效果。',
      },
    },
  },
}
