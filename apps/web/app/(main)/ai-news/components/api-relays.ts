/**
 * API 中转站数据(2026-07-22 立)
 *
 * 分两类:
 *  1. 公司平台性质:有公司主体、合规运营、官方文档、稳定可靠
 *  2. 个人运行性质:个人/小团队运营,价格低但稳定性参差,需自担风险
 *
 * 注:个人中转站经常变动,本表只列公开的、有文档的知名平台。
 */
export interface ApiRelay {
  /** 中转站名称 */
  name: string
  /** 类型:company 公司平台 / personal 个人运行 */
  type: 'company' | 'personal'
  /** 官网地址 */
  url: string
  /** 文档地址(可选) */
  docsUrl?: string
  /** API base URL(用于一键导入预填) */
  baseUrl: string
  /** 支持的厂商(用于 UI 标签) */
  vendors: string[]
  /** 特点说明 */
  features: string
  /** 计费方式 */
  billing: string
}

/** 公司平台性质中转站 */
export const COMPANY_RELAYS: ApiRelay[] = [
  {
    name: 'OpenRouter',
    type: 'company',
    url: 'https://openrouter.ai/',
    docsUrl: 'https://openrouter.ai/docs',
    baseUrl: 'https://openrouter.ai/api/v1',
    vendors: ['Anthropic', 'OpenAI', 'Google', 'Meta', 'Mistral', 'Cohere'],
    features: '聚合 200+ 模型,统一 OpenAI 格式,支持按量付费,无需多平台注册',
    billing: '按 token 计费,支持充值余额,部分模型有免费额度',
  },
  {
    name: 'SiliconFlow 硅基流动',
    type: 'company',
    url: 'https://siliconflow.cn/',
    docsUrl: 'https://docs.siliconflow.cn/',
    baseUrl: 'https://api.siliconflow.cn/v1',
    vendors: ['Meta', 'Alibaba', 'Z.ai', 'DeepSeek', 'Qwen', 'BAAI'],
    features: '国内主流开源模型聚合,OpenAI 格式兼容,国内直连速度快',
    billing: '按 token 计费,部分开源模型免费,送新用户额度',
  },
  {
    name: 'Together AI',
    type: 'company',
    url: 'https://www.together.ai/',
    docsUrl: 'https://docs.together.ai/',
    baseUrl: 'https://api.together.xyz/v1',
    vendors: ['Meta', 'Mistral', 'DeepSeek', 'Qwen'],
    features: '海外开源模型聚合,支持微调训练,OpenAI 格式兼容',
    billing: '按 token 计费,提供免费试用额度',
  },
  {
    name: 'Fireworks AI',
    type: 'company',
    url: 'https://fireworks.ai/',
    docsUrl: 'https://docs.fireworks.ai/',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    vendors: ['Meta', 'Mistral', 'DeepSeek', 'Qwen'],
    features: '海外开源模型聚合,低延迟推理,支持函数调用',
    billing: '按 token 计费,提供免费试用额度',
  },
  {
    name: 'DeepInfra',
    type: 'company',
    url: 'https://deepinfra.com/',
    docsUrl: 'https://deepinfra.com/docs',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    vendors: ['Meta', 'Mistral', 'DeepSeek', 'Qwen'],
    features: '海外开源模型聚合,价格低,OpenAI 格式兼容',
    billing: '按 token 计费,送新用户免费额度',
  },
]

/**
 * 个人运行性质中转站
 *
 * 注意:个人中转站通常以"低价转售官方 API"为卖点,但存在以下风险:
 *  - 可能违反官方 ToS(如 OpenAI / Anthropic 禁止转售)
 *  - Key 可能被滥用(对话记录被记录、Key 被二次出售)
 *  - 稳定性差(运营者可能随时跑路)
 *  - 数据安全无保障
 *
 * 本表不列具体个人中转站链接,只提供辨别建议。
 */
export const PERSONAL_RELAY_NOTE = {
  title: '个人运行性质中转站',
  risks: [
    '可能违反官方 Terms of Service(OpenAI / Anthropic 等明确禁止 API 转售)',
    'Key 有被滥用风险(对话记录可能被记录、Key 可能被二次出售)',
    '稳定性差,运营者可能随时停服跑路,余额无法追回',
    '数据安全无保障,敏感对话内容可能泄露',
    '部分中转站混合多用户 Key,可能导致限流 / 封号',
  ],
  tips: [
    '优先选择有公司主体的平台(如上方公司平台列表)',
    '个人中转站仅建议用于测试 / 学习,不要用于生产环境',
    '使用个人中转站时,不要提交敏感数据(公司代码、个人信息等)',
    '充值金额控制在可承受损失范围内,避免大额预存',
    '留意中转站是否提供 Key 自助管理、用量查询、对账功能',
  ],
}
