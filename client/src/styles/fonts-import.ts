/**
 * 字体导入模块 (TypeScript)
 * 统一字体管理，使用 CSS Layers 确保优先级
 */

/**
 * HarmonyOS Sans SC 字体栈 - 强制使用，不允许系统字体回退
 */
// 使用安全的字体栈，添加系统字体回退
const HARMONY_FONT_STACK =
  "'HarmonyOS Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif"

/**
 * 创建字体样式并添加到文档
 * 使用 CSS Layers 确保优先级，用层顺序控制
 */
export function loadFontStyles(): void {
  // 检查是否已经加载过字体样式
  if (document.getElementById('font-styles')) {
    return
  }

  const style = document.createElement('style')
  style.id = 'font-styles'
  // 使用 utilities 层确保优先级
  style.textContent = `
    @layer utilities {
      :root {
        --font-family-chinese: ${HARMONY_FONT_STACK};
      }
    }
  `
  document.head.appendChild(style)
}

/**
 * 应用全局字体
 * 使用 CSS Layers 确保优先级，用层顺序控制
 */
export function applyGlobalFont(): void {
  const root = document.documentElement

  root.style.setProperty('--font-family-chinese', HARMONY_FONT_STACK)

  // 应用到body元素和html元素
  if (document.documentElement) {
    document.documentElement.style.setProperty('font-family', HARMONY_FONT_STACK)
  }
  if (document.body) {
    document.body.style.setProperty('font-family', HARMONY_FONT_STACK)
  }

  // 确保所有文本元素使用字体，但排除特殊字体类
  // 注意：EDIX 字体只在标题标签（h1-h6）且带有 .font-edix 类时使用，由全局样式控制
  if (!document.getElementById('font-global')) {
    const style = document.createElement('style')
    style.id = 'font-global'
    // 使用 utilities 层确保优先级
    style.textContent = `
      @layer utilities {
        /* EDIX 字体 - 必须在全局规则之前定义，确保优先级最高 */
        h1.font-edix, h2.font-edix, h3.font-edix, h4.font-edix, h5.font-edix, h6.font-edix,
        h1[class*="title-english"].font-edix, h2[class*="title-english"].font-edix, h3[class*="title-english"].font-edix,
        h4[class*="title-english"].font-edix, h5[class*="title-english"].font-edix, h6[class*="title-english"].font-edix,
        h1[class*="welcome"].font-edix, h1[class*="brand"].font-edix,
        #first-page h1.brand-welcome-text.font-edix,
        #second-page h3.second-page-title-english.font-edix,
        #second-page h4.advantages-title-english.font-edix,
        #third-page h3.news-title-english.font-edix,
        #fourth-page h2.pricing-title-english.font-edix,
        #fifth-page h3.fifth-page-title-english.font-edix {
          font-family: 'EDIX', sans-serif;
        }
        
        /* 全局字体规则 - 排除 .font-edix 类 */
        *:not(.el-icon):not(.fas):not(.far):not(.fab):not(.fa):not([class*="icon"]):not([class*="Icon"]):not(svg):not(path):not(.font-edix) {
          font-family: ${HARMONY_FONT_STACK};
        }
        
        /* 非标题标签不应该使用 EDIX 字体 */
        *:not(h1):not(h2):not(h3):not(h4):not(h5):not(h6).font-edix {
          font-family: ${HARMONY_FONT_STACK};
        }
      }
    `
    if (document.head) {
      document.head.appendChild(style)
    }
  }
}
