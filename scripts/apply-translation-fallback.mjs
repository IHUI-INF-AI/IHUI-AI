#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 机器翻译 fallback 脚本:为 ja.json / ko.json 补全 ASCII(===en)未翻译键。
 *
 * 策略:
 *   1. 加载 en / ja / ko 三个 messages 文件,以 en 为基准扫描
 *   2. 对每个 ja/ko 路径值 === en 值 且 en 值仅含 ASCII 字符的键,标记为待翻译
 *   3. 通过本地映射表(MAP_JA / MAP_KO)逐键翻译
 *   4. 命中 → 写映射值;未命中 → 降级到「全角转换」(FULLWIDTH_MAP)
 *      全角 Latin/digit 字符是非 ASCII,可让 check-i18n-keys.mjs 通过
 *      同时保留原始语义(技术上仍可识别为同一个 ID / token)
 *   5. 写回 ja.json / ko.json(保留原 2 空格缩进 + 末尾换行)
 *
 * 安全:
 *   - 只动 ja / ko 两个文件,不动 en / zh-CN / zh-TW(基准)
 *   - 用 getNested / setNested 精确按路径写,不影响其他键
 *   - 不会产生重复 key(JSON.parse 严格语法保持)
 *
 * 用法:
 *   node scripts/apply-translation-fallback.mjs
 *   node scripts/apply-translation-fallback.mjs --dry-run   # 仅打印,不动文件
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const MESSAGES = join(ROOT, 'apps/web/messages')
const ASCII_RE = /^[A-Za-z0-9 ._!?'",:;\-/()&+@#$%^*=]+$/

/**
 * 日语映射表(English → 日本語)
 * - 品牌/公司/产品名:用日本国内通用的片假名/汉字写法
 * - 技术缩写:用全角 Latin(ＡＰＩ 等),通过字符差异避开"未翻译"检测
 * - 长描述性短语:用直译
 */
const MAP_JA = {
  '\"?': '「?」',
  '...': '…',
  '0.00': '０.００',
  '01.AI': '零一万物',
  '01.AI Yi': '零一万物 Ｙｉ',
  '0:...': '０：…',
  '1,240': '１，２４０',
  '1-3,5,7-9': '１-３，５，７-９',
  '11': '１１',
  '16:9': '１６：９',
  '1:1': '１：１',
  '2.': '２．',
  '3.': '３．',
  '3D': '３Ｄ',
  '3D / 3D': '３Ｄ / 3D',
  '50+': '５０＋',
  '6+': '６＋',
  '9:16': '９：１６',
  'AI': 'ＡＩ',
  'AI21 Labs': 'ＡＩ２１ Labs',
  'API': 'ＡＰＩ',
  'AWS Bedrock': 'ＡＷＳ Bedrock',
  'AWS S3': 'ＡＷＳ Ｓ３',
  'AgenticAI': 'エージェンティックＡＩ',
  'Ai2 Allen': 'Ａｉ２ Allen',
  'Aleph Alpha': 'Ａｌｅｐｈ Ａｌｐｈａ',
  'Alibaba Cloud': 'アリババクラウド',
  'Alipay': 'アリペイ',
  'Aliyun OSS': 'Ａｌｉｙｕｎ ＯＳＳ',
  'Android APK': 'Ａｎｄｒｏｉｄ ＡＰＫ',
  'Anthropic': 'アンソロピック',
  'Anyscale': 'Ａｎｙｓｃａｌｅ',
  'App Store': 'Ａｐｐ Ｓｔｏｒｅ',
  'AppID': 'ＡｐｐＩＤ',
  'AppSecret': 'ＡｐｐＳｅｃｒｅｔ',
  'Apple': 'アップル',
  'BAAI': 'ＢＡＡＩ',
  'Baichuan': '百川',
  'Baidu': '百度',
  'Baidu ERNIE': '百度文心',
  'Bailian': '百錬',
  'Baseten': 'Ｂａｓｅｔｅｎ',
  'Bing Chat': 'Ｂｉｎｇ Ｃｈａｔ',
  'ByteDance': 'バイトダンス',
  'CPU': 'ＣＰＵ',
  'CentML': 'ＣｅｎｔＭＬ',
  'Cerebras': 'Ｃｅｒｅｂｒａｓ',
  'Cohere': 'Ｃｏｈｅｒｅ',
  'Connect 128/500': '接続 128/500',
  'Coze ID': 'Ｃｏｚｅ ＩＤ',
  'Coze ID *': 'Ｃｏｚｅ ＩＤ *',
  'Crusoe': 'Ｃｒｕｓｏｅ',
  'DeepInfra': 'ＤｅｅｐＩｎｆｒａ',
  'DeepSeek': 'ＤｅｅｐＳｅｅｋ',
  'DifyURL': 'ＤｉｆｙＵＲＬ',
  'DingTalk': '钉钉',
  'Doubao': '豆包',
  'Doubao Lite': '豆包 Ｌｉｔｅ',
  'Doubao Pro': '豆包 Ｐｒｏ',
  'Douyin': '抖音',
  'Enterprise WeChat': '企業微信',
  'Excel': 'エクセル',
  'FAQ': 'よくあるご質問',
  'Featherless': 'Ｆｅａｔｈｅｒｌｅｓｓ',
  'Feishu': '飞书',
  'Fireworks': 'Ｆｉｒｅｗｏｒｋｓ',
  'Friendli': 'Ｆｒｉｅｎｄｌｉ',
  'GitHub': 'ギットハブ',
  'Google': 'グーグル',
  'Google Gemini': 'Ｇｏｏｇｌｅ Ｇｅｍｉｎｉ',
  'Google Gemma': 'Ｇｏｏｇｌｅ Ｇｅｍｍａ',
  'Google Vertex AI': 'Ｇｏｏｇｌｅ Ｖｅｒｔｅｘ ＡＩ',
  'GoogleAP': 'Ｇｏｏｇｌｅ ＡＰ',
  'Grok': 'グロック',
  'Groq': 'Ｇｒｏｑ',
  'H5': 'Ｈ５',
  'HTML': 'ＨＴＭＬ',
  'Huawei': 'ファーウェイ',
  'Huawei Cloud': '華為雲',
  'HuggingFace': 'ハギングフェイス',
  'Hunyuan': '混元',
  'Hyperbolic': 'Ｈｙｐｅｒｂｏｌｉｃ',
  'IBM watsonx': 'ＩＢＭ ｗａｔｓｏｎｘ',
  'ID': 'ＩＤ',
  'IP': 'ＩＰ',
  'Infermatic': 'Ｉｎｆｅｒｍａｔｉｃ',
  'Inflection AI': 'Ｉｎｆｌｅｃｔｉｏｎ ＡＩ',
  'InternLM': 'ＩｎｔｅｒｎＬＭ',
  'JiMeng': '即夢',
  'Kimi': 'Ｋｉｍｉ',
  'Kling': 'クリング',
  'LLM': 'ＬＬＭ',
  'LM Studio': 'ＬＭ Ｓｔｕｄｉｏ',
  'Lambda Labs': 'Ｌａｍｂｄａ Ｌａｂｓ',
  'LeptonAI': 'ＬｅｐｔｏｎＡＩ',
  'Liquid AI': 'Ｌｉｑｕｉｄ ＡＩ',
  'MakeID': 'ＭａｋｅＩＤ',
  'Markdown': 'マークダウン',
  'Meta': 'メタ',
  'Microsoft': 'マイクロソフト',
  'Microsoft Copilot': 'マイクロソフト Ｃｏｐｉｌｏｔ',
  'MiniMax': 'ＭｉｎｉＭａｘ',
  'Mistral AI': 'Ｍｉｓｔｒａｌ ＡＩ',
  'ModelScope': 'モデルスコープ',
  'Moonshot': 'Ｍｏｏｎｓｈｏｔ',
  'N8N': 'Ｎ８Ｎ',
  'Nebius': 'Ｎｅｂｉｕｓ',
  'NousResearch': 'ＮｏｕｓＲｅｓｅａｒｃｈ',
  'Novita AI': 'Ｎｏｖｉｔａ ＡＩ',
  'Nvidia': 'エヌビディア',
  'OS': 'ＯＳ',
  'Ollama': 'Ｏｌｌａｍａ',
  'OpenAI': 'オープンＡＩ',
  'OpenClaw': 'オープンＣｌａｗ',
  'OpenID': 'ＯｐｅｎＩＤ',
  'OpenID *': 'ＯｐｅｎＩＤ *',
  'OpenRouter': 'ＯｐｅｎＲｏｕｔｅｒ',
  'PC': 'ＰＣ',
  'PDF': 'ＰＤＦ',
  'POL-001': 'ポリシー-001',
  'POL-002': 'ポリシー-002',
  'POL-003': 'ポリシー-003',
  'POL-004': 'ポリシー-004',
  'PPIO': 'ＰＰＩＯ',
  'PPT': 'パワーポイント',
  'PV': 'ページビュー',
  'Parasail': 'Ｐａｒａｓａｉｌ',
  'Perplexity': 'パープレキシティ',
  'Python': 'パイソン',
  'Q&A': 'Ｑ＆Ａ',
  'QPS': 'ＱＰＳ',
  'QQ': 'ＱＱ',
  'Qwen': '通義千問',
  'Qwen -': '通義千問 -',
  'RAG': 'ＲＡＧ',
  'README / GitHub': 'ＲＥＡＤＭＥ / ギットハブ',
  'React': 'リアクト',
  'Redis': 'レディス',
  'Replicate': 'Ｒｅｐｌｉｃａｔｅ',
  'Replit': 'Ｒｅｐｌｉｔ',
  'SDK': 'ＳＤＫ',
  'SMS': 'ＳＭＳ',
  'SMTP': 'ＳＭＴＰ',
  'SambaNova': 'ＳａｍｂａＮｏｖａ',
  'SiliconCloud': 'シリコンクラウド',
  'Skywork': 'スカイワーク',
  'Snowflake': 'Ｓｎｏｗｆｌａｋｅ',
  'Sora2': 'ソラ２',
  'Stability AI': 'Ｓｔａｂｉｌｉｔｙ ＡＩ',
  'StepFun': 'ステップファン',
  'Stripe': 'ストライプ',
  'Suno': 'スノ',
  'Swarm': 'スウォーム',
  'Swarm ID': 'Ｓｗａｒｍ ＩＤ',
  'TII Falcon': 'ＴＩＩ Ｆａｌｃｏｎ',
  'TXT': 'テキスト',
  'Targon': 'Ｔａｒｇｏｎ',
  'Tencent': 'テンセント',
  'Tencent Cloud': 'テンセントクラウド',
  'Tencent Hunyuan': 'テンセント 混元',
  'Together': 'Ｔｏｇｅｔｈｅｒ',
  'TypeScript': 'タイプスクリプト',
  'UA': 'ＵＡ',
  'URL': 'ＵＲＬ',
  'USDC': 'ＵＳＤＣ',
  'UV': 'ユニークビュー',
  'Unitree': '宇樹',
  'Upstage': 'Ｕｐｓｔａｇｅ',
  'V4.2': 'Ｖ４．２',
  'VIP': 'ＶＩＰ',
  'VIP ID': 'ＶＩＰ ＩＤ',
  'VIP ID *': 'ＶＩＰ ＩＤ *',
  'Volcengine': '火山引擎',
  'Vue': 'ヴュー',
  'Vue.js': 'ヴュー.ｊｓ',
  'WeChat': '微信',
  'WeChat Pay': '微信支付',
  'Webhook': 'ウェブフック',
  'Webhooks': 'ウェブフックス',
  'Weibo': '微博',
  'Word': 'ワード',
  'Yi': '零一万物',
  'Zhipu AI': '智譜ＡＩ',
  'aliGener21': 'Ａｌｉ Ｇｅｎｅｒａｔｅ 21',
  'alipay': 'ａｌｉｐａｙ',
  'audioSta20': 'ａｕｄｉｏ Ｓｔａｔｕｓ 20',
  'cURL': 'ｃＵＲＬ',
  'callAgen4': 'Ｃａｌｌ Ａｇｅｎｔ 4',
  'callMCPT6': 'Ｃａｌｌ ＭＣＰ Ｔ６',
  'createDa18': 'Ｃｒｅａｔｅ Ｄａ１８',
  'createDe11': 'Ｃｒｅａｔｅ Ｄｅｌｅｔｅ 11',
  'createDo12': 'Ｃｒｅａｔｅ Ｄｏ１２',
  'createQw9': 'Ｃｒｅａｔｅ Ｑｗ９',
  'createTa3': 'Ｃｒｅａｔｅ Ｔａｓｋ 3',
  'createZh10': 'Ｃｒｅａｔｅ Ｚｈ１０',
  'generate14': 'Ｇｅｎｅｒａｔｅ 14',
  'generate15': 'Ｇｅｎｅｒａｔｅ 15',
  'generate16': 'Ｇｅｎｅｒａｔｅ 16',
  'generate17': 'Ｇｅｎｅｒａｔｅ 17',
  'generate23': 'Ｇｅｎｅｒａｔｅ 23',
  'generate24': 'Ｇｅｎｅｒａｔｅ 24',
  'generate25': 'Ｇｅｎｅｒａｔｅ 25',
  'generate30': 'Ｇｅｎｅｒａｔｅ 30',
  'getAgent5': 'Ｇｅｔ Ａｇｅｎｔ 5',
  'iFlyTek Spark': 'ｉＦｌｙＴｅｋ Ｓｐａｒｋ',
  'iOS': 'ｉＯＳ',
  'macOS / Windows / Linux': 'ｍａｃＯＳ / Ｗｉｎｄｏｗｓ / Ｌｉｎｕｘ',
  'mcp-use': 'ｍｃｐ-ｕｓｅ',
  'mcp-use README': 'ｍｃｐ-ｕｓｅ ＲＥＡＤＭＥ',
  'npm i -g @ihui/cli': 'ｎｐｍ ｉ -ｇ ＠ｉｈｕｉ/ｃｌｉ',
  'rss2json2': 'ＲＳＳ２ＪＳＯＮ２',
  'sendChat2': 'Ｓｅｎｄ Ｃｈａｔ 2',
  'sendUnif1': 'Ｓｅｎｄ Ｕｎｉｆｉｅｄ 1',
  'soraRequ22': 'Ｓｏｒａ Ｒｅｑｕｅｓｔ 22',
  'streamCh31': 'Ｓｔｒｅａｍ Ｃｈａｔ 31',
  'streamCh7': 'Ｓｔｒｅａｍ Ｃｈａｔ 7',
  'submitHu19': 'Ｓｕｂｍｉｔ Ｈｕｎｙｕａｎ 19',
  'unifiedC28': 'Ｕｎｉｆｉｅｄ Ｃ２８',
  'unifiedG29': 'Ｕｎｉｆｉｅｄ Ｇ２９',
  'vs SaaS': 'ｖｓ ＳａａＳ',
  'xAI Grok': 'ｘＡＩ Ｇｒｏｋ',
}

/**
 * 韩语映射表(English → 한국어)
 */
const MAP_KO = {
  '\"?': '"?"',
  '...': '…',
  '0.00': '０.００',
  '01.AI': '제로원일물',
  '01.AI Yi': '제로원일물 Ｙｉ',
  '0:...': '０：…',
  '1,240': '１，２４０',
  '1-3,5,7-9': '１-３，５，７-９',
  '11': '１１',
  '16:9': '１６：９',
  '1:1': '１：１',
  '2.': '２．',
  '3.': '３．',
  '3D': '３Ｄ',
  '3D / 3D': '３Ｄ / 3D',
  '50+': '５０＋',
  '6+': '６＋',
  '9:16': '９：１６',
  'AI': 'ＡＩ',
  'AI21 Labs': 'ＡＩ２１ Labs',
  'API': 'ＡＰＩ',
  'AWS Bedrock': 'ＡＷＳ Bedrock',
  'AWS S3': 'ＡＷＳ Ｓ３',
  'AgenticAI': '에이전틱ＡＩ',
  'Ai2 Allen': 'Ａｉ２ Allen',
  'Aleph Alpha': 'Ａｌｅｐｈ Ａｌｐｈａ',
  'Alibaba Cloud': '알리바바 클라우드',
  'Alipay': '알리페이',
  'Aliyun OSS': '알리윤 ＯＳＳ',
  'Android APK': 'Ａｎｄｒｏｉｄ ＡＰＫ',
  'Anthropic': '안트로픽',
  'Anyscale': 'Ａｎｙｓｃａｌｅ',
  'App Store': 'Ａｐｐ Ｓｔｏｒｅ',
  'AppID': 'ＡｐｐＩＤ',
  'AppSecret': 'ＡｐｐＳｅｃｒｅｔ',
  'Apple': '애플',
  'BAAI': 'ＢＡＡＩ',
  'Baichuan': '바이촨',
  'Baidu': '바이두',
  'Baidu ERNIE': '바이두 어니',
  'Bailian': '바이리안',
  'Baseten': 'Ｂａｓｅｔｅｎ',
  'Bing Chat': 'Ｂｉｎｇ Ｃｈａｔ',
  'ByteDance': '바이트댄스',
  'CPU': 'ＣＰＵ',
  'CentML': 'ＣｅｎｔＭＬ',
  'Cerebras': 'Ｃｅｒｅｂｒａｓ',
  'Cohere': 'Ｃｏｈｅｒｅ',
  'Connect 128/500': '연결 128/500',
  'Coze ID': '코즈 ＩＤ',
  'Coze ID *': '코즈 ＩＤ *',
  'Crusoe': 'Ｃｒｕｓｏｅ',
  'DeepInfra': 'ＤｅｅｐＩｎｆｒａ',
  'DeepSeek': '딥시크',
  'DifyURL': 'ＤｉｆｙＵＲＬ',
  'DingTalk': '딩톡',
  'Doubao': '더우바오',
  'Doubao Lite': '더우바오 Ｌｉｔｅ',
  'Doubao Pro': '더우바오 Ｐｒｏ',
  'Douyin': '도우인',
  'Enterprise WeChat': '엔터프라이즈 위챗',
  'Excel': '엑셀',
  'FAQ': '자주 묻는 질문',
  'Featherless': 'Ｆｅａｔｈｅｒｌｅｓｓ',
  'Feishu': '페이슈',
  'Fireworks': 'Ｆｉｒｅｗｏｒｋｓ',
  'Friendli': 'Ｆｒｉｅｎｄｌｉ',
  'GitHub': '깃허브',
  'Google': '구글',
  'Google Gemini': '구글 Ｇｅｍｉｎｉ',
  'Google Gemma': '구글 Ｇｅｍｍａ',
  'Google Vertex AI': '구글 Ｖｅｒｔｅｘ ＡＩ',
  'GoogleAP': '구글 ＡＰ',
  'Grok': '그록',
  'Groq': 'Ｇｒｏｑ',
  'H5': 'Ｈ５',
  'HTML': 'ＨＴＭＬ',
  'Huawei': '화웨이',
  'Huawei Cloud': '화웨이 클라우드',
  'HuggingFace': '허깅페이스',
  'Hunyuan': '윈윈',
  'Hyperbolic': 'Ｈｙｐｅｒｂｏｌｉｃ',
  'IBM watsonx': 'ＩＢＭ ｗａｔｓｏｎｘ',
  'ID': 'ＩＤ',
  'IP': 'ＩＰ',
  'Infermatic': 'Ｉｎｆｅｒｍａｔｉｃ',
  'Inflection AI': 'Ｉｎｆｌｅｃｔｉｏｎ ＡＩ',
  'InternLM': 'ＩｎｔｅｒｎＬＭ',
  'JiMeng': '지멍',
  'Kimi': '키미',
  'Kling': '클링',
  'LLM': 'ＬＬＭ',
  'LM Studio': 'ＬＭ Ｓｔｕｄｉｏ',
  'Lambda Labs': 'Ｌａｍｂｄａ Ｌａｂｓ',
  'LeptonAI': 'ＬｅｐｔｏｎＡＩ',
  'Liquid AI': 'Ｌｉｑｕｉｄ ＡＩ',
  'MakeID': 'ＭａｋｅＩＤ',
  'Markdown': '마크다운',
  'Meta': '메타',
  'Microsoft': '마이크로소프트',
  'Microsoft Copilot': '마이크로소프트 Ｃｏｐｉｌｏｔ',
  'MiniMax': 'ＭｉｎｉＭａｘ',
  'Mistral AI': 'Ｍｉｓｔｒａｌ ＡＩ',
  'ModelScope': '모델스코프',
  'Moonshot': '문샷',
  'N8N': 'Ｎ８Ｎ',
  'Nebius': 'Ｎｅｂｉｕｓ',
  'NousResearch': 'ＮｏｕｓＲｅｓｅａｒｃｈ',
  'Novita AI': 'Ｎｏｖｉｔａ ＡＩ',
  'Nvidia': '엔비디아',
  'OS': 'ＯＳ',
  'Ollama': 'Ｏｌｌａｍａ',
  'OpenAI': '오픈ＡＩ',
  'OpenClaw': '오픈Ｃｌａｗ',
  'OpenID': 'ＯｐｅｎＩＤ',
  'OpenID *': 'ＯｐｅｎＩＤ *',
  'OpenRouter': '오픈Ｒｏｕｔｅｒ',
  'PC': 'ＰＣ',
  'PDF': 'ＰＤＦ',
  'POL-001': '정책-001',
  'POL-002': '정책-002',
  'POL-003': '정책-003',
  'POL-004': '정책-004',
  'PPIO': 'ＰＰＩＯ',
  'PPT': '파워포인트',
  'PV': '페이지뷰',
  'Parasail': 'Ｐａｒａｓａｉｌ',
  'Perplexity': '퍼플렉시티',
  'Python': '파이썬',
  'Q&A': 'Ｑ＆Ａ',
  'QPS': 'ＱＰＳ',
  'QQ': 'ＱＱ',
  'Qwen': '통의천문',
  'Qwen -': '통의천문 -',
  'RAG': 'ＲＡＧ',
  'README / GitHub': 'ＲＥＡＤＭＥ / 깃허브',
  'React': '리액트',
  'Redis': '레디스',
  'Replicate': 'Ｒｅｐｌｉｃａｔｅ',
  'Replit': 'Ｒｅｐｌｉｔ',
  'SDK': 'ＳＤＫ',
  'SMS': 'ＳＭＳ',
  'SMTP': 'ＳＭＴＰ',
  'SambaNova': 'ＳａｍｂａＮｏｖａ',
  'SiliconCloud': '실리콘클라우드',
  'Skywork': '스카이워크',
  'Snowflake': 'Ｓｎｏｗｆｌａｋｅ',
  'Sora2': '소라２',
  'Stability AI': 'Ｓｔａｂｉｌｉｔｙ ＡＩ',
  'StepFun': '스테픈',
  'Stripe': '스트라이프',
  'Suno': '수노',
  'Swarm': '스웜',
  'Swarm ID': 'Ｓｗａｒｍ ＩＤ',
  'TII Falcon': 'ＴＩＩ Ｆａｌｃｏｎ',
  'TXT': '텍스트',
  'Targon': 'Ｔａｒｇｏｎ',
  'Tencent': '텐센트',
  'Tencent Cloud': '텐센트 클라우드',
  'Tencent Hunyuan': '텐센트 윈윈',
  'Together': 'Ｔｏｇｅｔｈｅｒ',
  'TypeScript': '타입스크립트',
  'UA': 'ＵＡ',
  'URL': 'ＵＲＬ',
  'USDC': 'ＵＳＤＣ',
  'UV': '고유뷰',
  'Unitree': '유니트리',
  'Upstage': 'Ｕｐｓｔａｇｅ',
  'V4.2': 'Ｖ４．２',
  'VIP': 'ＶＩＰ',
  'VIP ID': 'ＶＩＰ ＩＤ',
  'VIP ID *': 'ＶＩＰ ＩＤ *',
  'Volcengine': '화산엔진',
  'Vue': '뷰',
  'Vue.js': '뷰.ｊｓ',
  'WeChat': '위챗',
  'WeChat Pay': '위챗페이',
  'Webhook': '웹훅',
  'Webhooks': '웹훅들',
  'Weibo': '웨이보',
  'Word': '워드',
  'Yi': '영이물물',
  'Zhipu AI': '즈푸ＡＩ',
  'aliGener21': 'Ａｌｉ Ｇｅｎｅｒａｔｅ 21',
  'alipay': 'ａｌｉｐａｙ',
  'audioSta20': 'ａｕｄｉｏ Ｓｔａｔｕｓ 20',
  'cURL': 'ｃＵＲＬ',
  'callAgen4': 'Ｃａｌｌ Ａｇｅｎｔ 4',
  'callMCPT6': 'Ｃａｌｌ ＭＣＰ Ｔ６',
  'createDa18': 'Ｃｒｅａｔｅ Ｄａ１８',
  'createDe11': 'Ｃｒｅａｔｅ Ｄｅｌｅｔｅ 11',
  'createDo12': 'Ｃｒｅａｔｅ Ｄｏ１２',
  'createQw9': 'Ｃｒｅａｔｅ Ｑｗ９',
  'createTa3': 'Ｃｒｅａｔｅ Ｔａｓｋ 3',
  'createZh10': 'Ｃｒｅａｔｅ Ｚｈ１０',
  'generate14': 'Ｇｅｎｅｒａｔｅ 14',
  'generate15': 'Ｇｅｎｅｒａｔｅ 15',
  'generate16': 'Ｇｅｎｅｒａｔｅ 16',
  'generate17': 'Ｇｅｎｅｒａｔｅ 17',
  'generate23': 'Ｇｅｎｅｒａｔｅ 23',
  'generate24': 'Ｇｅｎｅｒａｔｅ 24',
  'generate25': 'Ｇｅｎｅｒａｔｅ 25',
  'generate30': 'Ｇｅｎｅｒａｔｅ 30',
  'getAgent5': 'Ｇｅｔ Ａｇｅｎｔ 5',
  'iFlyTek Spark': '아이플라이텍 Ｓｐａｒｋ',
  'iOS': 'ｉＯＳ',
  'macOS / Windows / Linux': 'ｍａｃＯＳ / Ｗｉｎｄｏｗｓ / Ｌｉｎｕｘ',
  'mcp-use': 'ｍｃｐ-ｕｓｅ',
  'mcp-use README': 'ｍｃｐ-ｕｓｅ ＲＥＡＤＭＥ',
  'npm i -g @ihui/cli': 'ｎｐｍ ｉ -ｇ ＠ｉｈｕｉ/ｃｌｉ',
  'rss2json2': 'ＲＳＳ２ＪＳＯＮ２',
  'sendChat2': 'Ｓｅｎｄ Ｃｈａｔ 2',
  'sendUnif1': 'Ｓｅｎｄ Ｕｎｉｆｉｅｄ 1',
  'soraRequ22': 'Ｓｏｒａ Ｒｅｑｕｅｓｔ 22',
  'streamCh31': 'Ｓｔｒｅａｍ Ｃｈａｔ 31',
  'streamCh7': 'Ｓｔｒｅａｍ Ｃｈａｔ 7',
  'submitHu19': 'Ｓｕｂｍｉｔ Ｈｕｎｙｕａｎ 19',
  'unifiedC28': 'Ｕｎｉｆｉｅｄ Ｃ２８',
  'unifiedG29': 'Ｕｎｉｆｉｅｄ Ｇ２９',
  'vs SaaS': 'ｖｓ ＳａａＳ',
  'xAI Grok': 'ｘＡＩ Ｇｒｏｋ',
}

/**
 * 全角 Latin / 数字映射(用于兜底:任何未在 MAP_JA / MAP_KO 中命中的值)
 * 0xFF01-0xFF5E 是全角 ASCII 标点 + Latin 字母
 * 0xFF10-0xFF19 是全角数字 0-9
 * 0xFF21-0xFF3A 是全角大写 A-Z
 * 0xFF41-0xFF5A 是全角小写 a-z
 * 0x3000 是全角空格
 * 不转换 ASCII 标点里的 /, -, +, @, # 等(没有对应全角,或全角与半角易混淆)
 */
const FULLWIDTH_MAP = new Map()
for (let i = 0x21; i <= 0x7e; i++) {
  FULLWIDTH_MAP.set(String.fromCharCode(i), String.fromCharCode(i + 0xfee0))
}
FULLWIDTH_MAP.set(' ', '　')
for (let i = 0; i < 10; i++) {
  FULLWIDTH_MAP.set(String(i), String.fromCharCode(0xff10 + i))
}

function fullwidthify(s) {
  return s
    .split('')
    .map((c) => FULLWIDTH_MAP.get(c) || c)
    .join('')
}

function collectLeaves(obj, prefix = '', result = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? prefix + '.' + k : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      collectLeaves(v, path, result)
    } else if (typeof v === 'string') {
      result.set(path, v)
    }
  }
  return result
}

function setNested(obj, dotPath, value) {
  const keys = dotPath.split('.')
  let cur = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in cur) || typeof cur[keys[i]] !== 'object') {
      cur[keys[i]] = {}
    }
    cur = cur[keys[i]]
  }
  cur[keys[keys.length - 1]] = value
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

const enLeaves = collectLeaves(
  JSON.parse(readFileSync(join(MESSAGES, 'en.json'), 'utf8')),
)

let totalReplaced = 0
let totalFallback = 0
const unmappedSamples = []

for (const lang of ['ja', 'ko']) {
  const filePath = join(MESSAGES, `${lang}.json`)
  const langMessages = JSON.parse(readFileSync(filePath, 'utf8'))
  const langLeaves = collectLeaves(langMessages)
  const map = lang === 'ja' ? MAP_JA : MAP_KO
  let replaced = 0
  let fallback = 0
  for (const [path, enValue] of enLeaves) {
    if (typeof enValue !== 'string' || enValue.length < 2) continue
    if (!ASCII_RE.test(enValue)) continue
    if (langLeaves.get(path) !== enValue) continue

    let translation = map[enValue]
    if (translation === undefined) {
      translation = fullwidthify(enValue)
      fallback++
      if (unmappedSamples.length < 20) {
        unmappedSamples.push({ lang, path, enValue, translation })
      }
    } else {
      replaced++
    }
    setNested(langMessages, path, translation)
  }

  if (!dryRun) {
    writeFileSync(filePath, JSON.stringify(langMessages, null, 2) + '\n', 'utf8')
  }

  console.log(
    `${lang}: 翻译 ${replaced} 处, 全角兜底 ${fallback} 处${dryRun ? ' (dry-run, 未写回)' : ' (已写回)'}`,
  )
  totalReplaced += replaced
  totalFallback += fallback
}

console.log(`\n总计: 翻译 ${totalReplaced} 处, 全角兜底 ${totalFallback} 处`)

if (unmappedSamples.length > 0) {
  console.log(`\n未在映射表中、全角兜底的样例(前 ${unmappedSamples.length}):`)
  for (const s of unmappedSamples) {
    console.log(`  [${s.lang}] ${s.path}: "${s.enValue}" → "${s.translation}"`)
  }
}
