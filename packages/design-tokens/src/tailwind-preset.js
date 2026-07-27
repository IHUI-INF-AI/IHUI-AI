/**
 * Tailwind v3 共享 preset — mobile-rn / miniapp-taro 两端复用。
 *
 * 设计约束:
 * - 仅适用于 Tailwind v3(v3 preset 语法);web 端用 Tailwind v4 @theme,不走此 preset。
 * - 语义色映射到 CSS 变量 var(--color-*),实际值由 tokens.css 同步到各端 :root/.dark。
 * - borderRadius.sm 统一为 0.125rem(2px),符合 AGENTS.md §4 圆角守门 sm=2px。
 *
 * 消费方式:
 * - CommonJS(require): `const _p = require('@ihui/design-tokens/tailwind-preset'); const p = _p.default || _p`
 * - ESM(import):        `import preset from '@ihui/design-tokens/tailwind-preset'`
 *
 * @type {import('tailwindcss').Config}
 */
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
      },
      borderRadius: {
        sm: '0.125rem',
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
      },
    },
  },
}
