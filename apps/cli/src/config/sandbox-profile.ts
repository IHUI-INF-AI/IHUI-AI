// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 沙盒 profile 枚举域、默认值与解析 —— 唯一真相源(G-212 切片,配置/类型层)。
 *
 * 本文件只收口三件事,不碰 `src/sandbox/index.ts` 的执行路径(该文件按 profile 组装
 * 命令白名单/超时/输出上限的那张表原样不动):
 *  1. 枚举域:五档 `readonly | limited | trusted | open | full`,顺序 = 由严到宽的展示序;
 *  2. 默认值:`DEFAULT_SETTINGS` / 首跑模板 / settings 模板三处只准引 `DEFAULT_SANDBOX_PROFILE`;
 *  3. 解析:环境变量等自由字符串必须过 `parseSandboxProfile`,未知值返回 `undefined`
 *     (调用方保持低层值),**不得**原样落进 Settings。
 *
 * 为什么必须有第 3 条:`resolveSandboxOptions()` 对未知 profile 的现行行为是
 * “取不到档位就返回用户 opts”(即不加任何命令白名单/路径限制)—— 一个拼错的环境变量
 * 会静默退化成最宽行为,而配置层此前的 `type: 'string'` 让任何字符串都能穿过去。
 * 本层只做“不认识就不采用”,失效方向是保持默认档,不是放行。
 *
 * 现状(2026-10-22 现读):默认档仍是 `'trusted'`。**“默认严档”是行为变更,须机主拍板**,
 * 本切片不切换;真要切换只改本文件的 `DEFAULT_SANDBOX_PROFILE` 一处,并同笔复跑
 * `apps/cli/tests/config-merge.test.ts` 与 `apps/cli/tests/sandbox-profile-single-source.test.ts`。
 */

/** 五档 profile 的唯一枚举表(由严到宽;增删档必须同笔改本表与 sandbox/index.ts 的类型)。 */
export const SANDBOX_PROFILE_IDS = ['readonly', 'limited', 'trusted', 'open', 'full'] as const;

/** 沙盒预设档位字面量类型 —— Settings 与消费方一律引这里,不得各自重述联合。 */
export type SandboxProfile = (typeof SANDBOX_PROFILE_IDS)[number];

/**
 * 默认档位 = `'trusted'`(限工作区路径 + 命令白名单 + 屏蔽凭据 env)。
 * 严档(`'readonly'`/`'limited'`)的默认化属拍板事项,见文件头注。
 */
export const DEFAULT_SANDBOX_PROFILE: SandboxProfile = 'trusted';

const SANDBOX_PROFILE_SET: ReadonlySet<string> = new Set(SANDBOX_PROFILE_IDS);

/** 类型守卫:值是否为合法 profile 字面量(大小写与空白都不宽容,避免 ' trusted' 混进配置)。 */
export function isSandboxProfile(value: unknown): value is SandboxProfile {
  return typeof value === 'string' && SANDBOX_PROFILE_SET.has(value);
}

/** 解析自由字符串;非法值一律 `undefined`(调用方据此跳过该键,保持低层值)。 */
export function parseSandboxProfile(value: unknown): SandboxProfile | undefined {
  return isSandboxProfile(value) ? value : undefined;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
