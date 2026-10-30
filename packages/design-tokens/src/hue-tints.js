// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 色相族 tint 表 —— RN / 共享屏侧「按色相给业务分类配底色」的唯一真相源。
 *
 * 立因(2026-10-31 实测):同一族 emerald tint 在 packages/app 里被手抄进 8 个文件
 * (edu-ai-styles / plan-styles / status-styles / support-styles / student-styles /
 * SignUpScreen / ArtifactsScreen / AgentCard),抄本之间已漂开三种实缺陷:
 *  ① 同族 alpha 不一致 —— emerald 有 0.10 也有 0.12;
 *  ② 族名与色相对不上 —— sign-up 把 blue-600 `#2563eb` + `rgba(59,130,246)` 登记成 `sky`;
 *  ③ 同一族灰三张名字两种值 —— `rgba(115,115,115)` 分别叫 slate(edu-ai)、muted(sign-up)、
 *     doc(ArtifactsScreen),而 doc 的 fg 取 #737373、另两张取 #52525b。
 * 各表头注都自称"与 web 端 tailwind 同源",可那句同源没有任何机器在看:web 端取的是
 * Tailwind utility class(text-emerald-600 全仓 739 处),值住在 Tailwind 内置色板里;
 * RN 端取的是端内手抄字面量 —— 两份出处,改一处另一处不跟随,正是守门 128 立门时写的
 * "两句注释都对,而屏幕上差 2px"那一型。
 *
 * 取值规则(不是审美偏好,逐条可复核):
 *  - `fg` = 该族 Tailwind -600 档(web 侧同类元素实际用的那一档);
 *  - `dot` = 该族 -500 档(状态点/图标墨迹,web 侧 bg-emerald-500 同值);
 *  - `tint` = -500 通道 + alpha **0.10**;`tintStrong` = 同通道 + alpha **0.12**;
 *    两档命名沿用本仓既成法(`--color-danger-tint` / `--color-danger-tint-strong`,
 *    `--color-info-tint/-strong` 同族),不新造第三种写法。
 *  - 消费方**按它原本用的 alpha 选档**(0.10 走 tint、0.12 走 tintStrong)⇒ 收编前后像素等值,
 *    本表不做观感裁决;要统一 alpha 得另开一票并带真机复核。
 *
 * 与本仓 `gray.*` 档的关系(易混,写死在这里):`rnTokens.gray.500` = `#737373` 是 Tailwind
 * **neutral** 系,而 Tailwind **gray** 系是 `#6b7280`。两族不同值、不得互换,故本表把它们
 * 分列为 `neutral` 与 `tailwindGray` 两个族名 —— 用 `gray` 当族名会被读成本仓 gray 档。
 *
 * 同值但不重复登记的两枚,由锁测试逐条对账(见 scripts/tests/hue-tints.test.mjs):
 *  - `amber.dot` 与 `rnTokens.warning.amber` 同值(#f59e0b)
 *  - `neutral.fg` 与 `rnTokens.gray.500` 同值(#737373)
 * 本文件刻意不 import rn-tokens(.js 引不了 .ts,反向依赖会成环),同值关系交给机器判而不是注释。
 */

const ALPHA_TINT = 0.1
const ALPHA_TINT_STRONG = 0.12

/** 族名 → [Tailwind -500 的 rgb 三元组, -600 前景, 可选 -500 圆点] */
const FAMILIES = {
  sky: { rgb: [14, 165, 233], fg: '#0284c7', dot: '#0ea5e9' },
  // plan-styles 的同一族前景取 -700,edu-ai 取 -600 —— 实测第五个漂移实例,故本表把两档都登记,
  // 由消费方按语义选档;只登记一个值就等于替 8 个屏做观感裁决(那需要真机复核,不属本票)。
  blue: { rgb: [59, 130, 246], fg: '#2563eb', fgStrong: '#1d4ed8', dot: '#3b82f6' },
  indigo: { rgb: [99, 102, 241], fg: '#4f46e5' },
  violet: { rgb: [139, 92, 246], fg: '#7c3aed' },
  purple: { rgb: [168, 85, 247], fg: '#9333ea' },
  fuchsia: { rgb: [217, 70, 239], fg: '#c026d3' },
  rose: { rgb: [244, 63, 94], fg: '#e11d48', dot: '#f43f5e' },
  amber: { rgb: [245, 158, 11], fg: '#d97706' },
  emerald: { rgb: [16, 185, 129], fg: '#059669', dot: '#10b981' },
  orange: { rgb: [249, 115, 22], fg: '#ea580c' },
  slate: { rgb: [100, 116, 139], fg: '#475569', dot: '#64748b' },
  zinc: { rgb: [115, 115, 115], fg: '#52525b' },
  // neutral 只留底档:它的前景 #737373 **已经**由 tokens.css 派生进 RN 令牌表
  // (rnDarkTokens.text.tertiary ← --color-text-tertiary),在这里再写一枚就等于新造
  // 守门 93 R8 明令禁止的第二真相。消费方取前景一律走语义档 tk.text.tertiary。
  // 同理 amber 的圆点取 rnTokens.warning.amber(#f59e0b),不在本表登字面量。
  neutral: { rgb: [115, 115, 115] },
  tailwindGray: { rgb: [107, 114, 128], fg: '#6b7280' },
  // red / green 两族是 Tailwind 的另一组同名色:support 的驳回底用 red-500(107 通道族),
  // AgentCard 的图标底用 green-500(34,197,94),而**本仓的 danger/success 档是 #dc2626/#22c55e**
  // —— 同语义不同族,正是"看起来是绿、实际不是同一张表"的成因。这里按现网实取的 rgb 落档,
  // 前景暂不登记(仓内没有消费方;§4 明令新档须同笔有消费者)。
  red: { rgb: [239, 68, 68] },
  green: { rgb: [34, 197, 94] },
}

// alpha 固定两位小数:端内既成字面量都写成 `rgba(14,165,233,0.10)`,
// 数值等价而字符串不等会被跨端同源对账判成漂移。
const rgba = ([r, g, b], alpha) => `rgba(${r},${g},${b},${alpha.toFixed(2)})`

/**
 * 展平后的消费入口,与 `rnGeometry` 同形:`rnHue.emerald.fg` / `rnHue.emerald.tint`。
 * 族名取自本表,不得在端内再写 `const *_TINT = 'rgba(…)'`(geometry.js 头注同一条禁令)。
 */
export const rnHue = Object.fromEntries(
  Object.entries(FAMILIES).map(([name, f]) => [
    name,
    {
      ...(f.fg ? { fg: f.fg } : {}),
      ...(f.fgStrong ? { fgStrong: f.fgStrong } : {}),
      ...(f.dot ? { dot: f.dot } : {}),
      tint: rgba(f.rgb, ALPHA_TINT),
      tintStrong: rgba(f.rgb, ALPHA_TINT_STRONG),
    },
  ]),
)

/** 函数形态(族名来自变量时用,如分类配置表驱动渲染) */
export function hueFamilies() {
  return Object.keys(FAMILIES)
}

export function hueTint(name) {
  const entry = rnHue[name]
  if (!entry) throw new Error(`hueTint:色相族 ${name} 不在表内(要加族请在本表落档,不得端内自立)`)
  return entry.tint
}

export function hueTintStrong(name) {
  const entry = rnHue[name]
  if (!entry) throw new Error(`hueTintStrong:色相族 ${name} 不在表内`)
  return entry.tintStrong
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
