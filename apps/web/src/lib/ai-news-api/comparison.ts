import type { ComparisonTable, AiFundingItem } from './types'

const FALLBACK_FUNDING: AiFundingItem[] = [
  {
    id: 'mock-fund-spacex-cursor',
    title: 'SpaceX 600 亿美元收购 Cursor',
    amount: '600 亿美元',
    source: 'ZDNnet',
    date: '2026-07-08',
    summary: '马斯克旗下 SpaceX 宣布以 600 亿美元收购 AI 编程工具 Cursor,xAI 将与之深度整合。',
  },
  {
    id: 'mock-fund-deepseek-500',
    title: 'DeepSeek 完成 500 亿元融资',
    amount: '500 亿元',
    source: '观察者网',
    date: '2026-07-15',
    summary: 'DeepSeek 7 月完成 500 亿元融资,首次对外发布开源技术成果,估值进入独角兽俱乐部。',
  },
  {
    id: 'mock-fund-sk-hynix',
    title: 'SK hynix 265 亿美元 IPO',
    amount: '265 亿美元',
    source: 'TechCrunch',
    date: '2026-07-10',
    summary: 'SK hynix 美国 IPO 募资 265 亿美元,首日上涨 13%,HBM4 4 个月卖了 10 亿美元。',
  },
]

const FALLBACK_COMPARISON: ComparisonTable = {
  models: [
    {
      id: 'gemini-3-6-flash',
      name: 'Gemini 3.6 Flash',
      vendor: 'Google',
      highlight: '07-21 GA · 成本最低',
    },
    { id: 'qwen-3-8', name: 'Qwen3.8-Max', vendor: 'Alibaba', highlight: '2.4T 全模态开源旗舰' },
    { id: 'kimi-k3', name: 'Kimi K3', vendor: 'Moonshot', highlight: '2.8T 原生视觉理解' },
    { id: 'deepseek-v4', name: 'DeepSeek V4', vendor: 'DeepSeek', highlight: '峰谷定价 + DSpark' },
    { id: 'gpt-5-6', name: 'GPT-5.6', vendor: 'OpenAI', highlight: 'Sol 旗舰 Coding Index 80' },
  ],
  rows: [
    {
      label: '上下文窗口',
      values: {
        'gemini-3-6-flash': '1M',
        'qwen-3-8': '1M',
        'kimi-k3': '1M',
        'deepseek-v4': '128K',
        'gpt-5-6': '1.05M',
      },
    },
    {
      label: '最大输出',
      values: {
        'gemini-3-6-flash': '64K',
        'qwen-3-8': '32K',
        'kimi-k3': '32K',
        'deepseek-v4': '16K',
        'gpt-5-6': '128K',
      },
    },
    {
      label: '价格 (Input/Output)',
      values: {
        'gemini-3-6-flash': '$0.15 / $0.6',
        'qwen-3-8': '¥2 / ¥6',
        'kimi-k3': '开源',
        'deepseek-v4': '¥3-6 / ¥6-12',
        'gpt-5-6': '$5 / $30',
      },
    },
    {
      label: '核心亮点',
      values: {
        'gemini-3-6-flash': '知识截止 2026-03 · agent planning',
        'qwen-3-8': '全模态 · 对手 1/10 价格',
        'kimi-k3': '原生视觉理解',
        'deepseek-v4': 'DSpark 加速 85%',
        'gpt-5-6': 'Coding Index 80 分',
      },
    },
    {
      label: '发布时间',
      values: {
        'gemini-3-6-flash': '2026-07-21',
        'qwen-3-8': '2026-07-19',
        'kimi-k3': '2026-07-17',
        'deepseek-v4': '2026-07-17',
        'gpt-5-6': '2026-07-09',
      },
    },
  ],
}

export function getComparisonTable(): ComparisonTable {
  return FALLBACK_COMPARISON
}

export function getFundingItems(): AiFundingItem[] {
  return FALLBACK_FUNDING
}
