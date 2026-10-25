// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-shell-replace-plugin.ts —— 只在"请求发起方是 RN 侧模块"时改写两个相对请求的小插件。
 *
 * 要解决的问题:RN 壳(apps/mobile-rn/src/screens/*.tsx)写的是**相对**请求
 * `../i18n` 与 `../context/ThemeContext`。小程序要承载这些壳,就得把这两条接到端内真相源:
 * 取词 = apps/miniapp-taro/src/i18n,主题 = src/rn-compat/theme(转出口 @/lib/theme)。
 *
 * 为什么不用 resolve.alias:alias 按请求字符串前缀匹配,管不到"谁发起的",会把端内
 * 自己那条 `../i18n`(src/api/index.ts)一起改掉;而按路径 alias 又碰不到相对请求。
 * 为什么不自建第二份 i18n/主题:§0.6 单一真相源 —— 词包与主题偏好各只有一份,再建必漂移。
 *
 * 判据口径:**按发起上下文判定,不按请求文本猜**。`result.context` 是发起模块所在目录的
 * 物理路径 ⇒ 只有 RN 侧目录里的请求被改写,其余一端原样不动。
 *
 * 为什么不 require('webpack') 取 NormalModuleReplacementPlugin:端内没装 webpack 直依赖
 * (pnpm 隔离布局下 require('webpack') 不可解析,实测 MODULE_NOT_FOUND),而 workspace 里
 * 同时存在 5.91.0 与 5.109.2 两枚 —— 加直依赖有引入第二实例的风险。本插件只用 compiler
 * 传进来的对象,零新依赖。
 */
interface RewriteEntry {
  /** 精确匹配的相对请求 */
  request: string
  /** 替换目标(绝对路径) */
  to: string
}

interface ResolveDataLike {
  request?: string
  context?: string
  contextInfo?: { issuer?: string }
}

export class RnShellReplacePlugin {
  private readonly rules: RewriteEntry[]
  private readonly rootMarker: string

  constructor(rules: RewriteEntry[], rootMarker: string) {
    this.rules = rules
    this.rootMarker = rootMarker
  }

  apply(compiler: {
    options: { context?: string }
    hooks: { normalModuleFactory: { tap: (name: string, fn: (nmf: unknown) => void) => void } }
  }) {
    void compiler.options
    compiler.hooks.normalModuleFactory.tap('RnShellReplacePlugin', (nmf: unknown) => {
      const factory = nmf as {
        hooks: {
          beforeResolve: { tap: (name: string, fn: (data: ResolveDataLike) => void) => void }
        }
      }
      factory.hooks.beforeResolve.tap('RnShellReplacePlugin', (data: ResolveDataLike) => {
        if (!data || typeof data.request !== 'string') return
        const issuer = data.context ?? data.contextInfo?.issuer ?? ''
        // 只对 RN 端目录里发起的请求生效(路径分隔符两种都认,Windows 反斜杠是这里的大头)
        const fromRn = issuer.replace(/\\/g, '/').includes(this.rootMarker)
        if (!fromRn) return
        const hit = this.rules.find((r) => r.request === data.request)
        if (hit) data.request = hit.to
      })
    })
  }
}

export const __test__ = { RnShellReplacePlugin }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
