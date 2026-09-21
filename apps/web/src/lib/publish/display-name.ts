// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

/**
 * 账号 displayName 展示层清洗:移除历史数据中用户手填的「本机凭据」字样。
 *
 * 背景:所有凭据实际加密存储在服务端 PostgreSQL,页面已有「云端凭据」徽章表达这一点,
 * displayName 中的「本机凭据」字样与事实不符,因此仅在展示时过滤(不改数据库数据,
 * 编辑对话框内保留原始值)。
 *
 * 清洗规则(仅在包含「本机凭据」时生效,否则原样返回、不做任何 trim):
 * 1. 移除「本机凭据」字样及其紧跟的空白;
 * 2. 移除后产生的重复分隔符(",," / ", ," / "、、" 等,含全角逗号)合并为单个;
 * 3. 移除紧邻括号内侧的多余分隔符(如 "(," 或 ",)");
 * 4. 括号内容变空时(如 "B站(本机凭据)")把空括号 "()" 与全角 "()" 一并移除;
 * 5. 半角/全角逗号分隔符后统一保留一个空格(顿号保持原样);
 * 6. 修剪首尾空白与孤立的逗号/顿号。
 */

/** 合并重复分隔符时识别的分隔字符(半角逗号、全角逗号、顿号) */
const SEPARATORS = ',,、'

/** 需要清除的空括号(半角与全角,允许内部残留空白) */
const EMPTY_PARENS = /\(\s*\)|（\s*）/g

/**
 * 移除 displayName 中的「本机凭据」字样,并清理其留下的多余分隔符/空括号。
 * 不含该字样时原样返回(不 trim、不改动)。
 */
export function stripLocalCredLabel(displayName: string): string {
  // 不含目标字样:展示层不做任何额外处理,保持原始值
  if (!displayName.includes('本机凭据')) return displayName

  // 1. 移除「本机凭据」及其紧跟的空白(含全角空格)
  let result = displayName.replace(/本机凭据[\s\u3000]*/g, '')

  // 2. 重复分隔符合并为单个:如 ",," / ", ," / "、、"(分隔符之间允许夹杂空白)
  const runRe = new RegExp(`([${SEPARATORS}])(?:[\\s\\u3000]*[${SEPARATORS}])+`, 'g')
  result = result.replace(runRe, (_m, first: string) => first)

  // 3. 紧邻括号内侧的多余分隔符(如 "(," 或 ",)"),仅当清理「本机凭据」后产生
  result = result.replace(/([(\uFF08])[\s\u3000]*[,，、][\s\u3000]*/g, '$1')
  result = result.replace(/[,，、][\s\u3000]*([)\uFF09])/g, '$1')

  // 4. 空括号(半角/全角)整体移除
  result = result.replace(EMPTY_PARENS, '')

  // 5. 逗号(半角/全角)后统一保留一个空格:移除「本机凭据 空白」会连带吃掉
  //    日期前的空格(如 ",本机凭据 2026-09-15" → ",2026-09-15"),此处补回。
  //    顿号无空格惯例,保持原样。
  result = result.replace(/([,，])(?=[^\s\u3000,，、)）])/g, '$1 ')

  // 6. 修剪首尾空白与孤立的逗号/顿号
  result = result.replace(new RegExp(`^[\\s\\u3000${SEPARATORS}]+`), '')
  result = result.replace(new RegExp(`[\\s\\u3000${SEPARATORS}]+$`), '')

  return result
}

/** 拆分结果:主名 + 括号内的补充信息(备注/扫码时间等) */
export interface DisplayNameParts {
  /** 括号外的主名(如 "公众号(AI智汇社, 2026-09-15)" → "公众号") */
  name: string
  /** 括号内的补充信息,多段以 " · " 连接;无括号时为空串 */
  suffix: string
}

/** 匹配一组括号(半角/全角)及其内容 */
const PARENS_RE = /\(([^()]*)\)|（([^（）]*)）/g

/**
 * 把 displayName 拆成「主名 + 括号补充信息」两部分,供卡片分层展示:
 * 标题只显示主名,括号内的备注/扫码时间等弱化到副标题(小字)。
 * 先经过 stripLocalCredLabel 清洗「本机凭据」误导字样。
 */
export function splitDisplayNameParts(displayName: string): DisplayNameParts {
  const cleaned = stripLocalCredLabel(displayName)

  const suffixes: string[] = []
  const name = cleaned
    .replace(PARENS_RE, (_m, half?: string, full?: string) => {
      const content = (half ?? full ?? '').trim()
      if (content) {
        // 括号内再按逗号/顿号拆成子段,统一用 " · " 连接(如 "AI智汇社, 2026-09-15")
        const segs = content
          .split(/[,，、]/)
          .map((s) => s.trim())
          .filter(Boolean)
        if (segs.length) suffixes.push(segs.join(' · '))
      }
      return ' '
    })
    .replace(/\s+/g, ' ')
    .trim()

  return { name, suffix: suffixes.join(' · ') }
}

/** 常见平台简称 → 官方平台名(用于判断主名与平台名是否重复) */
const PLATFORM_ALIAS: Record<string, string> = {
  b站: '哔哩哔哩',
  小破站: '哔哩哔哩',
  公众号: '微信公众号',
  微信: '微信公众号',
  视频号: '微信视频号',
  头条: '今日头条',
  油管: 'youtube',
  油管频道: 'youtube',
}

/**
 * 判断账号主名与平台官方名是否指向同一平台(如主名 "B站" vs 平台名 "哔哩哔哩"),
 * 相同则副标题不再重复显示平台名。
 */
export function isSamePlatformName(name: string, platformName: string): boolean {
  const n = name.trim()
  if (!n || !platformName) return false
  const canonical = PLATFORM_ALIAS[n.toLowerCase()] ?? n.toLowerCase()
  return canonical === platformName.toLowerCase()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
