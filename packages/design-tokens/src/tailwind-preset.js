// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Tailwind v3 共享 preset — mobile-rn / miniapp-taro 两端复用。
 *
 * 设计约束:
 * - 仅适用于 Tailwind v3(v3 preset 语法);web 端用 Tailwind v4 @theme,不走此 preset。
 * - 语义色映射到 CSS 变量 var(--color-*),实际值由 tokens.css 同步到各端 :root/.dark。
 * - 圆角档位由 ./radius.js 单表提供(RADIUS_REM),与 web tokens.css 的 --radius-* 逐档同值;
 *   类名语义按 web(Tailwind v4)对齐:xs=2px / sm=4px / md=6px / lg=8px / xl=12px / 2xl=16px。
 *   改档位一律改 ./radius.js,不得在本文件或任何端内再抄一份。
 *
 * 消费方式:
 * - CommonJS(require): `const _p = require('@ihui/design-tokens/tailwind-preset'); const p = _p.default || _p`
 * - ESM(import):        `import preset from '@ihui/design-tokens/tailwind-preset'`
 *
 * @type {import('tailwindcss').Config}
 */
import { RADIUS_REM } from './radius.js'
import alphaCompatPlugin from './tailwind-alpha-plugin.js'

export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: 'var(--color-border)',
        input: 'var(--color-input)',
        ring: 'var(--color-ring)',
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          foreground: 'var(--color-primary-foreground)',
        },
        /* 品牌实底档(2026-09-24 立)。miniapp-taro / mobile-rn 走 Tailwind **v3**,
         * 色值来自这份 JS theme 而**不是** tokens.css 的 @theme —— 只在 CSS 侧落
         * `--color-cta` 的话,这两端写 `bg-cta` 会**静默生成不出任何规则**(类名在、样式无,
         * 不报错也不红)。这里补映射,值仍指同一个 CSS 变量 ⇒ 单一源头不变。
         * 与 `--color-*` 的对应关系由守门 check-cross-end-tokens 的镜像测试钉住。 */
        cta: {
          DEFAULT: 'var(--color-cta)',
          foreground: 'var(--color-cta-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          foreground: 'var(--color-secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--color-destructive)',
          foreground: 'var(--color-destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--color-muted)',
          foreground: 'var(--color-muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          foreground: 'var(--color-accent-foreground)',
        },
        popover: {
          DEFAULT: 'var(--color-popover)',
          foreground: 'var(--color-popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--color-card)',
          foreground: 'var(--color-card-foreground)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          foreground: 'var(--color-success-foreground)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          foreground: 'var(--color-warning-foreground)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          foreground: 'var(--color-info-foreground)',
        },
        /* 以下四档此前只在 tokens.css 有、preset 没有 —— 因为 v3 端(miniapp-taro / mobile-rn)
         * 当时**一处都没用到**,所以不是 bug 而是缺口没被触发。补齐是为了让
         * "tokens.css @theme 里凡 X + X-foreground 成对的色档,preset 必须有对应键"
         * 这条不变量可以**无条件成立**(不留豁免表 = 没有会腐烂的清单)。
         * 由 scripts/tests/check-cross-end-tokens.test.mjs 钉死。 */
        danger: {
          DEFAULT: 'var(--color-danger)',
          foreground: 'var(--color-danger-foreground)',
        },
        sidebar: {
          DEFAULT: 'var(--color-sidebar)',
          foreground: 'var(--color-sidebar-foreground)',
        },
        scrim: {
          DEFAULT: 'var(--color-scrim)',
          foreground: 'var(--color-scrim-foreground)',
        },
        'brand-accent': {
          DEFAULT: 'var(--color-brand-accent)',
          foreground: 'var(--color-brand-accent-foreground)',
        },
      },
      borderRadius: RADIUS_REM,
    },
  },
  /* alpha 兼容插件(2026-09-25 立):v3 无法从 `var(--color-*)` 解析通道 ⇒ `/NN` 透明度形态
   * 在这两端静默产出零条规则。插件**只用 addUtilities 追加选择器**,不改动上面任何一档的
   * 既有取值 ⇒ 对已生成的样式表是纯增量(实测 REMOVED 0 / MUTATED 0)。
   * 挂在 preset 上而不是端内 config 上:miniapp 与 mobile-rn 共用这一份,不留第二个装车点。 */
  plugins: [alphaCompatPlugin],
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
