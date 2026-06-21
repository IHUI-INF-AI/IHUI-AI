/**
 * 字体加载模块 (TypeScript)
 * 统一字体管理，使用 CSS Layers 确保优先级
 */

/**
 * 字体CSS变量定义
 * 使用 utilities 层确保优先级，用层顺序控制
 */
export const fontCSS: string = `
  @layer utilities {
    :root {
      /* 使用安全的字体栈，添加系统字体回退 */
      --font-family-chinese: 'HarmonyOS Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
    }
  }
`
