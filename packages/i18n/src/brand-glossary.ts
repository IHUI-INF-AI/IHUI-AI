/**
 * 品牌/公司/字体名 canonical 映射表(re-export 自 scripts/brand-glossary.json 的精简子集)
 *
 * §20 i18n 守门:en/zh-TW/ko 翻译时优先使用 canonical 英文名,避免直译
 */

export interface BrandEntry {
  readonly zh: string
  readonly en: string
}

export const brandGlossary: Readonly<Record<string, BrandEntry>> = {
  '智谱清言': { zh: '智谱清言', en: 'Zhipu AI' },
  '智谱清音': { zh: '智谱清音', en: 'Zhipu AI' },
  '百度文心': { zh: '百度文心', en: 'Baidu ERNIE' },
  '宇树科技': { zh: '宇树科技', en: 'Unitree' },
  '火山引擎': { zh: '火山引擎', en: 'Volcengine' },
  '阿里云': { zh: '阿里云', en: 'Alibaba Cloud' },
  '腾讯云': { zh: '腾讯云', en: 'Tencent Cloud' },
  '九章智算云': { zh: '九章智算云', en: 'JiuZhang' },
  '百度智能云': { zh: '百度智能云', en: 'Baidu Cloud' },
  '华为云': { zh: '华为云', en: 'Huawei Cloud' },
  '致远互联': { zh: '致远互联', en: 'Seeyon' },
  '字节跳动': { zh: '字节跳动', en: 'ByteDance' },
  '微博': { zh: '微博', en: 'Weibo' },
  '抖音': { zh: '抖音', en: 'Douyin' },
  '微软': { zh: '微软', en: 'Microsoft' },
  '谷歌': { zh: '谷歌', en: 'Google' },
  '亚马逊': { zh: '亚马逊', en: 'Amazon' },
  '苹果': { zh: '苹果', en: 'Apple' },
  'OpenAI': { zh: 'OpenAI', en: 'OpenAI' },
  'Anthropic': { zh: 'Anthropic', en: 'Anthropic' },
  'DeepSeek': { zh: 'DeepSeek', en: 'DeepSeek' },
  'Moonshot': { zh: 'Moonshot', en: 'Moonshot AI' },
  '智谱': { zh: '智谱', en: 'Zhipu AI' },
  '科大讯飞': { zh: '科大讯飞', en: 'iFlytek' },
  '滴滴': { zh: '滴滴', en: 'DiDi' },
  '美团': { zh: '美团', en: 'Meituan' },
  '小米': { zh: '小米', en: 'Xiaomi' },
  '华为': { zh: '华为', en: 'Huawei' },
  '中兴': { zh: '中兴', en: 'ZTE' },
  '联想': { zh: '联想', en: 'Lenovo' },
  'OPPO': { zh: 'OPPO', en: 'OPPO' },
  'vivo': { zh: 'vivo', en: 'vivo' },
  '海康威视': { zh: '海康威视', en: 'Hikvision' },
  '比亚迪': { zh: '比亚迪', en: 'BYD' },
  '蔚来': { zh: '蔚来', en: 'NIO' },
  '小鹏': { zh: '小鹏', en: 'XPeng' },
  '理想': { zh: '理想', en: 'Li Auto' },
} as const

export const FONT_GLOSSARY: Readonly<Record<string, string>> = {
  '宋体': 'SimSun',
  '黑体': 'SimHei',
  '楷体': 'KaiTi',
  '微软雅黑': 'Microsoft YaHei',
  '仿宋': 'FangSong',
  '苹方': 'PingFang SC',
  '冬青黑体': 'Hiragino Sans GB',
  '思源黑体': 'Source Han Sans',
  '思源宋体': 'Source Han Serif',
} as const

export const TERM_GLOSSARY: Readonly<Record<string, string>> = {
  '物联网': 'IoT',
  '人工智能': 'AI',
  '大模型': 'LLM',
  '机器学习': 'Machine Learning',
  '深度学习': 'Deep Learning',
  '神经网络': 'Neural Network',
  '自然语言处理': 'NLP',
  '计算机视觉': 'Computer Vision',
  '增强现实': 'AR',
  '虚拟现实': 'VR',
  '云计算': 'Cloud Computing',
  '大数据': 'Big Data',
} as const

export function lookupBrand(zh: string): string | undefined {
  return brandGlossary[zh]?.en
}
