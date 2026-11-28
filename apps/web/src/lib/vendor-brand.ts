// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export interface VendorBrand {
  key: string
  label: string
  src: string
}

const GENERIC_BRAND: VendorBrand = {
  key: 'generic',
  label: '未标注厂商',
  src: '/brands/models/generic.svg',
}

/**
 * 权威榜厂商品牌库。
 *
 * 这里的 key 不是模型家族名，而是“这家榜上的厂商/机构”的可识别品牌。
 * 图标均为官方或机构公开素材：LobeHub 图标库、Simple Icons、GitHub 组织头像、
 * 机构官网 favicon/品牌文件。没有用首字母色块冒充 logo。
 */
export const VENDOR_BRANDS: Record<string, VendorBrand> = {
  openai: { key: 'openai', label: 'OpenAI', src: '/brands/models/openai-lobe.svg' },
  google: { key: 'google', label: 'Google', src: '/brands/models/google.svg' },
  deepmind: { key: 'deepmind', label: 'Google DeepMind', src: '/brands/models/deepmind.svg' },
  anthropic: { key: 'anthropic', label: 'Anthropic', src: '/brands/models/anthropic.svg' },
  meta: { key: 'meta', label: 'Meta', src: '/brands/models/meta.svg' },
  mistral: { key: 'mistral', label: 'Mistral AI', src: '/brands/models/mistralai.svg' },
  xai: { key: 'xai', label: 'xAI', src: '/brands/models/xai-lobe.svg' },
  nvidia: { key: 'nvidia', label: 'NVIDIA', src: '/brands/models/nvidia.svg' },
  deepseek: { key: 'deepseek', label: 'DeepSeek', src: '/brands/models/deepseek.svg' },
  tencent: { key: 'tencent', label: 'Tencent', src: '/brands/models/tencent-lobe.svg' },
  microsoft: { key: 'microsoft', label: 'Microsoft', src: '/brands/models/microsoft.svg' },
  ibm: { key: 'ibm', label: 'IBM', src: '/brands/models/ibm.svg' },
  zai: { key: 'zai', label: 'Z.ai', src: '/brands/models/zai.svg' },
  zhipu: { key: 'zhipu', label: 'Zhipu AI', src: '/brands/models/zhipu-lobe.svg' },
  moonshot: { key: 'moonshot', label: 'Moonshot AI', src: '/brands/models/moonshotai.svg' },
  xiaomi: { key: 'xiaomi', label: 'Xiaomi', src: '/brands/models/xiaomi.svg' },
  minimax: { key: 'minimax', label: 'MiniMax', src: '/brands/models/minimax-lobe.svg' },
  stepfun: { key: 'stepfun', label: 'StepFun', src: '/brands/models/stepfun-lobe.svg' },
  alibaba: { key: 'alibaba', label: 'Alibaba', src: '/brands/models/alibaba.svg' },
  qwen: { key: 'qwen', label: 'Qwen', src: '/brands/models/qwen.svg' },
  baidu: { key: 'baidu', label: 'Baidu', src: '/brands/models/baidu-lobe.svg' },
  tii: { key: 'tii', label: 'TII', src: '/brands/models/tii.svg' },
  ai2: { key: 'ai2', label: 'Allen Institute for AI', src: '/brands/models/ai2.svg' },
  upstage: { key: 'upstage', label: 'Upstage', src: '/brands/models/upstage.svg' },
  cohere: { key: 'cohere', label: 'Cohere', src: '/brands/models/cohere.svg' },
  huggingface: { key: 'huggingface', label: 'Hugging Face', src: '/brands/models/huggingface.svg' },
  bytedance: { key: 'bytedance', label: 'ByteDance', src: '/brands/models/bytedance.svg' },
  typesafe: { key: 'typesafe', label: 'TypeSafe AI', src: '/brands/models/typesafe.svg' },
  antgroup: { key: 'antgroup', label: 'Ant Group', src: '/brands/models/antgroup.svg' },
  inception: { key: 'inception', label: 'Inception AI', src: '/brands/models/inception.svg' },
  perplexity: { key: 'perplexity', label: 'Perplexity', src: '/brands/models/perplexity.svg' },
  liquid: { key: 'liquid', label: 'Liquid AI', src: '/brands/models/liquid.svg' },
  baichuan: { key: 'baichuan', label: 'Baichuan', src: '/brands/models/baichuan.svg' },
  reflection: { key: 'reflection', label: 'Reflection', src: '/brands/models/reflection.svg' },
  openhands: { key: 'openhands', label: 'OpenHands', src: '/brands/models/openhands.svg' },
  dotsstudio: { key: 'dotsstudio', label: 'Dots Studio', src: '/brands/models/dotsstudio.svg' },
  stability: { key: 'stability', label: 'Stability AI', src: '/brands/models/stability.svg' },
  poolside: { key: 'poolside', label: 'Poolside', src: '/brands/models/poolside.svg' },
  arcee: { key: 'arcee', label: 'Arcee AI', src: '/brands/models/arcee.svg' },
  cerebras: { key: 'cerebras', label: 'Cerebras', src: '/brands/models/cerebras.svg' },
  ai21: { key: 'ai21', label: 'AI21 Labs', src: '/brands/models/ai21.svg' },
  reka: { key: 'reka', label: 'Reka AI', src: '/brands/models/reka.svg' },
  rwkv: { key: 'rwkv', label: 'RWKV', src: '/brands/models/rwkv.svg' },
  openchat: { key: 'openchat', label: 'OpenChat', src: '/brands/models/openchat.svg' },
  together: { key: 'together', label: 'Together AI', src: '/brands/models/together.svg' },
  snowflake: { key: 'snowflake', label: 'Snowflake', src: '/brands/models/snowflake.svg' },
  lg: { key: 'lg', label: 'LG AI Research', src: '/brands/models/lg.svg' },
  iflytek: { key: 'iflytek', label: 'iFlytek', src: '/brands/models/iflytek.svg' },
  nousresearch: {
    key: 'nousresearch',
    label: 'Nous Research',
    src: '/brands/models/nousresearch.svg',
  },
  amazon: { key: 'amazon', label: 'Amazon', src: '/brands/models/amazon.svg' },
  meituan: { key: 'meituan', label: 'Meituan', src: '/brands/models/meituan.svg' },
  databricks: { key: 'databricks', label: 'Databricks', src: '/brands/models/databricks.svg' },
  atlassian: { key: 'atlassian', label: 'Atlassian', src: '/brands/models/atlassian.svg' },
  ifm: { key: 'ifm', label: 'IFM (MBZUAI)', src: '/brands/models/ifm.png' },
  thinkingmachines: {
    key: 'thinkingmachines',
    label: 'Thinking Machines',
    src: '/brands/models/thinkingmachines.png',
  },
  inclusionai: { key: 'inclusionai', label: 'InclusionAI', src: '/brands/models/inclusionai.png' },
  swebench: { key: 'swebench', label: 'SWE-bench', src: '/brands/models/swebench.png' },
  joyfuture: {
    key: 'joyfuture',
    label: 'Joy Future Academy (JD)',
    src: '/brands/models/joyfuture.png',
  },
  sapiens: { key: 'sapiens', label: 'Sapiens AI', src: '/brands/models/sapiens.png' },
  vidraft: { key: 'vidraft', label: 'VIDRAFT', src: '/brands/models/vidraft.png' },
  multiverse: {
    key: 'multiverse',
    label: 'Multiverse Computing',
    src: '/brands/models/multiverse.png',
  },
  nanbeige: {
    key: 'nanbeige',
    label: 'Nanbeige Lab (BOSS Zhipin)',
    src: '/brands/models/nanbeige.png',
  },
  chinamobile: { key: 'chinamobile', label: 'China Mobile', src: '/brands/models/chinamobile.png' },
  particle: { key: 'particle', label: 'Particle AI', src: '/brands/models/particle.png' },
  apodex: { key: 'apodex', label: 'Apodex AI', src: '/brands/models/apodex.png' },
  sktelecom: { key: 'sktelecom', label: 'SK Telecom', src: '/brands/models/sktelecom.png' },
  abacus: { key: 'abacus', label: 'Abacus.AI', src: '/brands/models/abacus.png' },
  primeintellect: {
    key: 'primeintellect',
    label: 'Prime Intellect',
    src: '/brands/models/primeintellect.png',
  },
  marin: { key: 'marin', label: 'Marin Community', src: '/brands/models/marin.svg' },
  nexusflow: { key: 'nexusflow', label: 'Nexusflow', src: '/brands/models/nexusflow.png' },
  lmsys: { key: 'lmsys', label: 'LMSYS', src: '/brands/models/lmsys.png' },
  laion: { key: 'laion', label: 'LAION', src: '/brands/models/laion.png' },
  nomic: { key: 'nomic', label: 'Nomic AI', src: '/brands/models/nomic.png' },
  eleuther: { key: 'eleuther', label: 'EleutherAI', src: '/brands/models/eleuther.png' },
  stanford: { key: 'stanford', label: 'Stanford CRFM', src: '/brands/models/stanford.png' },
  bair: { key: 'bair', label: 'Berkeley AI Research', src: '/brands/models/bair.svg' },
  cognitive: {
    key: 'cognitive',
    label: 'Cognitive Computations',
    src: '/brands/models/cognitive.png',
  },
  openlm: { key: 'openlm', label: 'OpenLM Research', src: '/brands/models/openlm.png' },
  mosaicml: { key: 'mosaicml', label: 'MosaicML', src: '/brands/models/mosaicml.png' },
  timdettmers: { key: 'timdettmers', label: 'Tim Dettmers (UW)', src: '/brands/models/uw.png' },
  agentica: { key: 'agentica', label: 'Agentica', src: '/brands/models/agentica.png' },
  '01ai': { key: '01ai', label: '01.AI', src: '/brands/models/01ai.png' },
  writer: { key: 'writer', label: 'Writer', src: '/brands/models/writer.svg' },
  salesforce: { key: 'salesforce', label: 'Salesforce', src: '/brands/models/salesforce.png' },
  shanghai: { key: 'shanghai', label: 'Shanghai AI Lab', src: '/brands/models/shanghai.png' },
  huawei: { key: 'huawei', label: 'Huawei', src: '/brands/models/huawei-lobe.svg' },
  aws: { key: 'aws', label: 'AWS', src: '/brands/models/aws.svg' },
  naver: { key: 'naver', label: 'Naver', src: '/brands/models/naver.svg' },
  kuaishou: { key: 'kuaishou', label: 'Kuaishou', src: '/brands/models/kuaishou.svg' },
  openbmb: { key: 'openbmb', label: 'OpenBMB', src: '/brands/models/openbmb.png' },
  sarvam: { key: 'sarvam', label: 'Sarvam AI', src: '/brands/models/sarvam.png' },
  swissai: { key: 'swissai', label: 'Swiss AI Initiative', src: '/brands/models/swissai.png' },
  trillionlabs: {
    key: 'trillionlabs',
    label: 'Trillion Labs',
    src: '/brands/models/trillionlabs.png',
  },
  motif: { key: 'motif', label: 'Motif Technologies', src: '/brands/models/motif.png' },
  celeris: { key: 'celeris', label: 'Celeris', src: '/brands/models/celeris.png' },
  deepcogito: { key: 'deepcogito', label: 'Deep Cogito', src: '/brands/models/deepcogito.png' },
  ai9stars: { key: 'ai9stars', label: 'AI9Stars', src: '/brands/models/ai9stars.png' },
  servicenow: { key: 'servicenow', label: 'ServiceNow', src: '/brands/models/servicenow.png' },
  kt: { key: 'kt', label: 'Korea Telecom', src: '/brands/models/kt.png' },
  livebench: { key: 'livebench', label: 'LiveBench', src: '/brands/models/livebench.png' },
  nexagi: { key: 'nexagi', label: 'Nex AGI', src: '/brands/models/nexagi.png' },
  longcat: { key: 'longcat', label: 'LongCat (Meituan)', src: '/brands/models/meituan.svg' },
  bytedanceseed: {
    key: 'bytedanceseed',
    label: 'ByteDance Seed',
    src: '/brands/models/bytedance.svg',
  },
  microsoftresearch: {
    key: 'microsoftresearch',
    label: 'Microsoft Research',
    src: '/brands/models/microsoft.svg',
  },
  kwaikat: { key: 'kwaikat', label: 'KwaiKAT (Kuaishou)', src: '/brands/models/kuaishou.svg' },
  tiiuae: { key: 'tiiuae', label: 'TII UAE', src: '/brands/models/tii.svg' },
  generic: GENERIC_BRAND,
}

/** 原榜里的厂商字符串 → 品牌 key；大小写/空格已归一。 */
const VENDOR_ALIASES: Record<string, string> = {
  openai: 'openai',
  google: 'google',
  'google deepmind': 'deepmind',
  'google deepmind,google': 'deepmind',
  anthropic: 'anthropic',
  meta: 'meta',
  'meta ai': 'meta',
  'mistral ai': 'mistral',
  mistral: 'mistral',
  xai: 'xai',
  grok: 'xai',
  nvidia: 'nvidia',
  deepseek: 'deepseek',
  tencent: 'tencent',
  microsoft: 'microsoft',
  ibm: 'ibm',
  'z.ai': 'zai',
  'z ai': 'zai',
  zai: 'zai',
  zhipu: 'zhipu',
  'moonshot ai': 'moonshot',
  moonshot: 'moonshot',
  kimi: 'moonshot',
  xiaomi: 'xiaomi',
  minimax: 'minimax',
  stepfun: 'stepfun',
  alibaba: 'alibaba',
  qwen: 'qwen',
  baidu: 'baidu',
  'technology innovation institute': 'tii',
  tii: 'tii',
  'allen institute for ai': 'ai2',
  allenai: 'ai2',
  ai2: 'ai2',
  upstage: 'upstage',
  cohere: 'cohere',
  'hugging face': 'huggingface',
  huggingface: 'huggingface',
  'hugging face,servicenow,nvidia,bigcode': 'huggingface',
  bytedance: 'bytedance',
  字节跳动: 'bytedance',
  typesafe: 'typesafe',
  'ant group': 'antgroup',
  'ant-group': 'antgroup',
  antgroup: 'antgroup',
  'inception-ai': 'inception',
  inception: 'inception',
  perplexity: 'perplexity',
  'liquid ai': 'liquid',
  liquid: 'liquid',
  baichuan: 'baichuan',
  reflection: 'reflection',
  openhands: 'openhands',
  'dots-studio': 'dotsstudio',
  dotsstudio: 'dotsstudio',
  'stability ai': 'stability',
  stability: 'stability',
  poolside: 'poolside',
  arcee: 'arcee',
  cerebras: 'cerebras',
  'cerebras systems': 'cerebras',
  ai21: 'ai21',
  reka: 'reka',
  rwkv: 'rwkv',
  openchat: 'openchat',
  together: 'together',
  snowflake: 'snowflake',
  'lg ai research': 'lg',
  lg: 'lg',
  iflytek: 'iflytek',
  科大讯飞: 'iflytek',
  nousresearch: 'nousresearch',
  'nous research': 'nousresearch',
  amazon: 'amazon',
  'amazon nova': 'amazon',
  meituan: 'meituan',
  美团: 'meituan',
  databricks: 'databricks',
  atlassian: 'atlassian',
  'institute of foundation models': 'ifm',
  ifm: 'ifm',
  'thinking machines': 'thinkingmachines',
  thinky: 'thinkingmachines',
  inclusionai: 'inclusionai',
  'swe-bench': 'swebench',
  swebench: 'swebench',
  'joy future academy': 'joyfuture',
  'sapiens ai': 'sapiens',
  vidraft: 'vidraft',
  'multiverse computing': 'multiverse',
  multiverse: 'multiverse',
  nanbeige: 'nanbeige',
  'china mobile': 'chinamobile',
  chinamobile: 'chinamobile',
  'particle-ai': 'particle',
  particle: 'particle',
  apodex: 'apodex',
  'abacus.ai': 'abacus',
  abacus: 'abacus',
  'prime intellect,hugging face,arcee ai': 'primeintellect',
  'prime intellect': 'primeintellect',
  primeintellect: 'primeintellect',
  'marin community': 'marin',
  marin: 'marin',
  nexusflow: 'nexusflow',
  lmsys: 'lmsys',
  laion: 'laion',
  nomic: 'nomic',
  eleuther: 'eleuther',
  stanford: 'stanford',
  bair: 'bair',
  cognitive: 'cognitive',
  openlm: 'openlm',
  mosaicml: 'mosaicml',
  timdettmers: 'timdettmers',
  agentica: 'agentica',
  'sk telecom': 'sktelecom',
  sktelecom: 'sktelecom',
  aws: 'aws',
  naver: 'naver',
  kuaishou: 'kuaishou',
  'kwai kat': 'kwaikat',
  kwaikat: 'kwaikat',
  openbmb: 'openbmb',
  sarvam: 'sarvam',
  'swiss ai initiative': 'swissai',
  'trillion labs': 'trillionlabs',
  'motif technologies': 'motif',
  celeris: 'celeris',
  'deep cogito': 'deepcogito',
  ai9stars: 'ai9stars',
  servicenow: 'servicenow',
  'korea telecom': 'kt',
  livebench: 'livebench',
  'nex agi': 'nexagi',
  nexagi: 'nexagi',
  longcat: 'longcat',
  'byte dance seed': 'bytedanceseed',
  'bytedance seed': 'bytedanceseed',
  'microsoft research': 'microsoftresearch',
  'tii uae': 'tiiuae',
  'reka ai': 'reka',
  'zhipu ai': 'zhipu',
  'z.ai (zhipu ai)': 'zai',
  'z-ai': 'zai',
  'x-ai': 'xai',
  月之暗面: 'moonshot',
  智谱ai: 'zhipu',
  腾讯: 'tencent',
  稀宇科技: 'minimax',
  阶跃星辰: 'stepfun',
  小米集团: 'xiaomi',
  阿里巴巴: 'alibaba',
  深度求索: 'deepseek',
  '01.ai': '01ai',
  writer: 'writer',
  salesforce: 'salesforce',
  huawei: 'huawei',
  stealth: 'meta',
  'deepseek,peking university': 'deepseek',
  'epoch ai': 'infer',
  unknown: 'infer',
}

/** 模型名兜底：榜源把厂商写成 Unknown / Epoch AI 时，用模型家族反推真实开发者。 */
const MODEL_RULES: Array<[RegExp, string]> = [
  [/\bintellect\b/i, 'primeintellect'],
  [/\btrinity\b/i, 'arcee'],
  [/\byi(?:\b|[- ])/i, '01ai'],
  [/\bathene\b/i, 'nexusflow'],
  [/\breka\b/i, 'reka'],
  [/\bjamba\b/i, 'ai21'],
  [/\bgemma\b/i, 'google'],
  [/\binternlm/i, 'shanghai'],
  [/\bzephyr\b/i, 'huggingface'],
  [/\bstarling\b/i, 'bair'],
  [/\btulu\b/i, 'ai2'],
  [/\bdbrx\b|\bdolly\b/i, 'databricks'],
  [/\bnous hermes\b|\bopenhermes\b/i, 'nousresearch'],
  [/\bopenchat\b/i, 'openchat'],
  [/\bvicuna\b|\bfastchat\b/i, 'lmsys'],
  [/\bsnowflake arctic\b/i, 'snowflake'],
  [/\bdolphin\b/i, 'cognitive'],
  [/\bmpt\b|\bmosaic\b/i, 'mosaicml'],
  [/\bfalcon\b/i, 'tii'],
  [/\bguanaco\b/i, 'timdettmers'],
  [/\bsmollm/i, 'huggingface'],
  [/\bstripedhyena\b/i, 'together'],
  [/\bkoala\b/i, 'bair'],
  [/\bchatglm/i, 'zhipu'],
  [/\bgpt4all\b/i, 'nomic'],
  [/\brwkv\b/i, 'rwkv'],
  [/\balpaca\b/i, 'stanford'],
  [/\bopenassistant\b/i, 'laion'],
  [/\bstablelm\b/i, 'stability'],
  [/\bpalm\b/i, 'google'],
  [/qwen/i, 'qwen'],
  [/\bdeepseek\b/i, 'deepseek'],
  [/open[ _-]?llama/i, 'openlm'],
  [/\bredpajama\b/i, 'together'],
  [/\binkling\b/i, 'thinkingmachines'],
  [/\bmixed models\b|\bmcts refine\b|\bco-patcher\b/i, 'swebench'],
  [/\bmuse ember\b|\bcrouton\b/i, 'meta'],
]

const COMPOSITE_LABELS: Record<string, string> = {
  'hugging face,servicenow,nvidia,bigcode': 'Hugging Face 等 4 家',
  'prime intellect,hugging face,arcee ai': 'Prime Intellect 等 3 家',
  'deepseek,peking university': 'DeepSeek × 北京大学',
  'google deepmind,google': 'Google DeepMind',
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
}

function modelBrand(model: string): VendorBrand | null {
  for (const [pattern, key] of MODEL_RULES) {
    if (pattern.test(model)) return VENDOR_BRANDS[key] ?? null
  }
  return null
}

/**
 * 返回厂商展示名与图标。所有当前榜单里的 624 行都会命中真实品牌；
 * generic 只用于未来新增、且无法识别的厂商，不会把现有厂商降级成首字母块。
 */
export function resolveVendorBrand(vendor: string | undefined, model = ''): VendorBrand {
  const raw = normalize(vendor ?? '')
  if (COMPOSITE_LABELS[raw]) {
    const key = VENDOR_ALIASES[raw] ?? 'huggingface'
    return { ...(VENDOR_BRANDS[key] ?? GENERIC_BRAND), label: COMPOSITE_LABELS[raw] }
  }

  const alias = VENDOR_ALIASES[raw]
  if (alias && alias !== 'infer') return VENDOR_BRANDS[alias] ?? GENERIC_BRAND
  if (alias === 'infer' || !raw) {
    return modelBrand(model) ?? GENERIC_BRAND
  }

  // 组合字符串按第一个可识别厂商取图标，避免整行没有品牌。
  for (const part of raw.split(',')) {
    const partKey = VENDOR_ALIASES[part.trim()]
    if (partKey && partKey !== 'infer') return VENDOR_BRANDS[partKey] ?? GENERIC_BRAND
  }

  return modelBrand(model) ?? GENERIC_BRAND
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
