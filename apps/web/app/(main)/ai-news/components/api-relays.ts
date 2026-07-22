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
  {
    name: '火山方舟 Volc Ark',
    type: 'company',
    url: 'https://www.volcengine.com/product/ark',
    docsUrl: 'https://www.volcengine.com/docs/82379',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    vendors: ['Bytedance', 'DeepSeek', 'Moonshot', 'Alibaba'],
    features: '字节跳动旗下,聚合豆包 / DeepSeek / Kimi / Qwen 多家模型,国内直连速度快',
    billing: '按 token 计费,送新用户试用额度,支持包年包月',
  },
  {
    name: 'Replicate',
    type: 'company',
    url: 'https://replicate.com/',
    docsUrl: 'https://replicate.com/docs',
    baseUrl: 'https://api.replicate.com/v1',
    vendors: ['Meta', 'Black Forest Labs', 'Stability', 'Mistral'],
    features: '海外开源模型聚合,主打生图 / 视频 / 多模态,支持模型微调部署',
    billing: '按秒计费 (GPU 时长),按用量付费,部分模型有免费试用',
  },
  {
    name: 'Novita AI',
    type: 'company',
    url: 'https://novita.ai/',
    docsUrl: 'https://docs.novita.ai/',
    baseUrl: 'https://api.novita.ai/v3/openai',
    vendors: ['Meta', 'DeepSeek', 'Qwen', 'Mistral'],
    features: '海外开源模型聚合,价格低,支持生图 / LLM / 嵌入,OpenAI 格式兼容',
    billing: '按 token 计费,送新用户免费额度',
  },
  {
    name: 'HuggingFace Inference',
    type: 'company',
    url: 'https://huggingface.co/inference-api',
    docsUrl: 'https://huggingface.co/docs/api-inference',
    baseUrl: 'https://api-inference.huggingface.co/v1',
    vendors: ['Meta', 'Mistral', 'BAAI', 'Qwen'],
    features: '全球最大模型托管平台,免费 Inference API,支持 30 万+ 开源模型',
    billing: '免费额度有限,超出后按请求计费,Pro 账户更高配额',
  },
  {
    name: 'Mistral La Plateforme',
    type: 'company',
    url: 'https://console.mistral.ai/',
    docsUrl: 'https://docs.mistral.ai/',
    baseUrl: 'https://api.mistral.ai/v1',
    vendors: ['Mistral'],
    features: 'Mistral 官方平台,OpenAI 格式兼容,支持函数调用 / JSON 模式 / 微调',
    billing: '按 token 计费,提供免费试用额度,有 Pay-as-you-go 套餐',
  },
  {
    name: 'ModelScope 魔搭社区',
    type: 'company',
    url: 'https://modelscope.cn/',
    docsUrl: 'https://modelscope.cn/docs',
    baseUrl: 'https://api-inference.modelscope.cn/v1',
    vendors: ['Alibaba', 'Qwen', 'BAAI', 'Meta', 'DeepSeek'],
    features: '阿里达摩院 + 中国信通院联合打造,国内最大开源模型社区,DashScope 兼容',
    billing: '免费额度充足,部分模型完全免费,Pro 账户更高配额',
  },
  {
    name: 'GroqCloud',
    type: 'company',
    url: 'https://groq.com/',
    docsUrl: 'https://console.groq.com/docs',
    baseUrl: 'https://api.groq.com/openai/v1',
    vendors: ['Meta', 'Mistral', 'Google', 'DeepSeek'],
    features: 'Groq LPU 推理引擎,极速低延迟(>500 tokens/s),OpenAI 格式兼容',
    billing: '免费额度充足(每日 100 万 tokens),付费版更高配额',
  },
  {
    name: 'Cerebras Inference',
    type: 'company',
    url: 'https://cerebras.ai/',
    docsUrl: 'https://inference-docs.cerebras.ai/',
    baseUrl: 'https://api.cerebras.ai/v1',
    vendors: ['Meta', 'Qwen', 'Mistral'],
    features: 'Cerebras Wafer-Scale Engine 推理,极速低延迟(>2000 tokens/s),OpenAI 格式兼容',
    billing: '免费额度可用,付费版按 token 计费',
  },
  {
    name: 'Anyscale Endpoints',
    type: 'company',
    url: 'https://www.anyscale.com/',
    docsUrl: 'https://docs.endpoints.anyscale.com/',
    baseUrl: 'https://api.endpoints.anyscale.com/v1',
    vendors: ['Meta', 'Mistral', 'Cohere'],
    features: 'Ray 框架厂商,支持开源模型推理 + 微调训练,OpenAI 格式兼容',
    billing: '按 token 计费,送新用户免费额度',
  },
  {
    name: 'TitanML',
    type: 'company',
    url: 'https://titanml.co/',
    docsUrl: 'https://docs.titanml.co/',
    baseUrl: 'https://api.titanml.co/v1',
    vendors: ['Meta', 'Mistral', 'Cohere', 'Qwen'],
    features: '英国推理优化厂商,主打低延迟 + 高吞吐,企业级部署',
    billing: '按 token 计费,提供免费试用,企业版按部署收费',
  },
  {
    name: 'AI/ML API',
    type: 'company',
    url: 'https://aimlapi.com/',
    docsUrl: 'https://docs.aimlapi.com/',
    baseUrl: 'https://api.aimlapi.com/v1',
    vendors: ['OpenAI', 'Anthropic', 'Google', 'Meta', 'Mistral'],
    features: '聚合 100+ 模型,统一 OpenAI 格式,价格比官方低 30-50%',
    billing: '按 token 计费,送新用户免费额度,支持按月套餐',
  },
  {
    name: 'Predibase',
    type: 'company',
    url: 'https://predibase.com/',
    docsUrl: 'https://docs.predibase.com/',
    baseUrl: 'https://serving.app.predibase.com/v1',
    vendors: ['Meta', 'Mistral', 'Qwen'],
    features: 'LoRA 微调专家,支持开源模型 fine-tune + 推理,OpenAI 格式兼容',
    billing: '按 token 计费,微调按 GPU 时长,送新用户免费额度',
  },
  {
    name: 'Lepton AI',
    type: 'company',
    url: 'https://www.lepton.ai/',
    docsUrl: 'https://www.lepton.ai/docs',
    baseUrl: 'https://api.lepton.ai/v1',
    vendors: ['Meta', 'Mistral', 'Qwen', 'DeepSeek'],
    features: 'Lepton AI 推理平台,Jian Yang 创办,OpenAI 格式兼容,支持自定义模型部署',
    billing: '按 token 计费,提供免费试用额度',
  },
  {
    name: 'Infermatic',
    type: 'company',
    url: 'https://infermatic.ai/',
    docsUrl: 'https://docs.infermatic.ai/',
    baseUrl: 'https://api.infermatic.ai/v1',
    vendors: ['Meta', 'Mistral', 'Qwen', 'DeepSeek'],
    features: '海外开源模型聚合,主打企业级 API,OpenAI 格式兼容,支持批量推理',
    billing: '按 token 计费,提供免费试用额度,企业版按套餐',
  },
  {
    name: 'MonsterAPI',
    type: 'company',
    url: 'https://monsterapi.ai/',
    docsUrl: 'https://monsterapi.ai/docs',
    baseUrl: 'https://api.monsterapi.ai/v1',
    vendors: ['Meta', 'Mistral', 'Stability', 'DeepSeek'],
    features: '海外开源模型聚合,主打生图 + LLM,支持模型微调,OpenAI 格式兼容',
    billing: '按 token 计费,送新用户免费额度,支持按月套餐',
  },
  {
    name: 'Chub AI',
    type: 'company',
    url: 'https://chub.ai/',
    docsUrl: 'https://docs.chub.ai/',
    baseUrl: 'https://api.chub.ai/v1',
    vendors: ['Meta', 'Mistral', 'OpenAI', 'Anthropic'],
    features: '海外聚合平台,支持角色扮演 / 对话类模型,OpenAI 格式兼容',
    billing: '按 token 计费,提供免费试用额度,支持按月套餐',
  },
  {
    name: 'FallAI',
    type: 'company',
    url: 'https://fallai.ai/',
    docsUrl: 'https://docs.fallai.ai/',
    baseUrl: 'https://api.fallai.ai/v1',
    vendors: ['Meta', 'Mistral', 'Qwen', 'DeepSeek'],
    features: '海外开源模型聚合,主打低延迟推理,OpenAI 格式兼容,支持流式输出',
    billing: '按 token 计费,提供免费试用额度,送新用户额度',
  },
  {
    name: 'AutoDL',
    type: 'company',
    url: 'https://www.autodl.com/',
    docsUrl: 'https://www.autodl.com/docs/',
    baseUrl: 'https://api.autodl.com/v1',
    vendors: ['Meta', 'Qwen', 'DeepSeek', 'BAAI'],
    features: '国内 GPU 算力租用平台,支持按小时计费租卡 + 模型部署,国内直连速度快',
    billing: '按 GPU 时长计费(元/小时),送新用户代金券,支持包日 / 包周 / 包月',
  },
  {
    name: '矩池云 Matpool',
    type: 'company',
    url: 'https://matpool.com/',
    docsUrl: 'https://matpool.com/docs/',
    baseUrl: 'https://api.matpool.com/v1',
    vendors: ['Meta', 'Qwen', 'BAAI', 'Stability'],
    features: '国内 GPU 算力租用平台,主打学生 / 学术优惠,支持模型训练 + 推理',
    billing: '按 GPU 时长计费(元/小时),学生认证更优惠,送新用户额度',
  },
  {
    name: '极客云 GeekCloud',
    type: 'company',
    url: 'https://www.geekyun.com/',
    docsUrl: 'https://www.geekyun.com/docs/',
    baseUrl: 'https://api.geekyun.com/v1',
    vendors: ['Meta', 'Qwen', 'DeepSeek', 'BAAI'],
    features: '国内 GPU 算力租用平台,支持主流 GPU 型号,按需租用 + 长期租赁',
    billing: '按 GPU 时长计费(元/小时),送新用户代金券,支持包日 / 包月套餐',
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
