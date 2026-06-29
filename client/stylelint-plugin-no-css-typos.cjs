/**
 * stylelint 自定义插件：CSS 拼写错误检查
 *
 * 检查范围：
 * 1. CSS 类名拼写错误（如 .rxp 应为 .wrap，.lex-wrap 应为 .flex-wrap）
 * 2. CSS 属性名拼写错误（如 dixplay 应为 display）
 * 3. CSS 属性值拼写错误（如 flxe 应为 flex）
 *
 * 使用方式：在 .stylelintrc.json 中添加
 *   "plugins": ["./stylelint-plugin-no-css-typos.cjs"],
 *   "rules": { "aizhs/no-css-typos": true }
 */
const stylelint = require('stylelint')

const ruleName = 'aizhs/no-css-typos'
const messages = stylelint.utils.ruleMessages(ruleName, {
  classTypo: (typo, suggestion) =>
    `类名拼写错误: ".${typo}"，应为 ".${suggestion}"`,
  propTypo: (typo, suggestion) =>
    `属性名拼写错误: "${typo}"，应为 "${suggestion}"`,
  valueTypo: (typo, suggestion) =>
    `属性值拼写错误: "${typo}"，应为 "${suggestion}"`,
})

/**
 * 常见 CSS 拼写错误映射表
 * key: 错误拼写（小写），value: 正确拼写
 */
const CLASS_TYPOS = {
  // flexbox 相关
  'flx': 'flex',
  'flxe': 'flex',
  'lex': 'flex',
  'lex-wrap': 'flex-wrap',
  'flex-warp': 'flex-wrap',
  'flex-direction': 'flex-direction',
  'flx-direction': 'flex-direction',
  'justify-contet': 'justify-content',
  'justify-conent': 'justify-content',
  'align-itmes': 'align-items',
  'align-items': 'align-items',
  'align-self': 'align-self',
  'align-slef': 'align-self',
  // grid 相关
  'grd': 'grid',
  'grid-templete': 'grid-template',
  'grid-tempalte': 'grid-template',
  // 布局相关
  'rxp': 'wrap',
  'warp': 'wrap',
  'wraper': 'wrapper',
  'wrappe': 'wrapper',
  'contianer': 'container',
  'containr': 'container',
  'containre': 'container',
  // position 相关
  'realative': 'relative',
  'relativ': 'relative',
  'absoulte': 'absolute',
  'absolte': 'absolute',
  'absolut': 'absolute',
  'fixde': 'fixed',
  'positon': 'position',
  'posotion': 'position',
  // display 相关
  'dixplay': 'display',
  'disply': 'display',
  'displsy': 'display',
  'inlin': 'inline',
  'inline-blocke': 'inline-block',
  // 文本相关
  'txt': 'text',
  'tex': 'text',
  'algn': 'align',
  'txt-align': 'text-align',
  'text-algn': 'text-align',
  'text-decoraton': 'text-decoration',
  'textdecor': 'text-decoration',
  // 尺寸相关
  'widht': 'width',
  'wdth': 'width',
  'heigth': 'height',
  'hght': 'height',
  'heght': 'height',
  'margn': 'margin',
  'maring': 'margin',
  'paddng': 'padding',
  'pading': 'padding',
  // background 相关
  'backgroud': 'background',
  'backgrund': 'background',
  'backgrond': 'background',
  'bg-color': 'bg-color',
  'bgcolor': 'bg-color',
  // overflow 相关
  'overflw': 'overflow',
  'overlfow': 'overflow',
  // 其他常见
  'visibilty': 'visibility',
  'visiblity': 'visibility',
  'opcity': 'opacity',
  'opacit': 'opacity',
  'z-indx': 'z-index',
  'zindex': 'z-index',
  'flot': 'float',
  'clearfx': 'clearfix',
  'clear-fix': 'clearfix',
}

/**
 * CSS 属性名拼写错误映射
 */
const PROPERTY_TYPOS = {
  'dixplay': 'display',
  'disply': 'display',
  'displsy': 'display',
  'posotion': 'position',
  'positon': 'position',
  'widht': 'width',
  'wdth': 'width',
  'heigth': 'height',
  'hght': 'height',
  'heght': 'height',
  'backgroud': 'background',
  'backgrund': 'background',
  'backgrond': 'background',
  'margn': 'margin',
  'maring': 'margin',
  'paddng': 'padding',
  'pading': 'padding',
  'overflw': 'overflow',
  'overlfow': 'overflow',
  'visibilty': 'visibility',
  'visiblity': 'visibility',
  'opcity': 'opacity',
  'opacit': 'opacity',
  'flot': 'float',
}

/**
 * CSS 属性值拼写错误映射
 */
const VALUE_TYPOS = {
  'flxe': 'flex',
  'flx': 'flex',
  'inlin': 'inline',
  'inline-blocke': 'inline-block',
  'realative': 'relative',
  'relativ': 'relative',
  'absoulte': 'absolute',
  'absolte': 'absolute',
  'absolut': 'absolute',
  'fixde': 'fixed',
  'lex-wrap': 'flex-wrap',
  'flex-warp': 'flex-wrap',
}

/**
 * 从选择器中提取类名
 * 支持 .class-name, .class-name:hover, .a.b.c 等形式
 */
function extractClassNames(selector) {
  const classNames = []
  // 匹配 .className 形式（支持连字符）
  const regex = /\.([a-zA-Z][\w-]*)/g
  let match
  while ((match = regex.exec(selector)) !== null) {
    classNames.push(match[1])
  }
  return classNames
}

module.exports = stylelint.createPlugin(ruleName, (primary) => {
  return (root, result) => {
    if (primary !== true) return

    // 1. 检查类名拼写
    root.walkRules((rule) => {
      // 跳过 SCSS 插值和变量选择器
      const selector = rule.selector
      if (!selector || selector.includes('#{') || selector.includes('$')) return

      const classNames = extractClassNames(selector)
      for (const className of classNames) {
        const lowerName = className.toLowerCase()
        if (CLASS_TYPOS[lowerName]) {
          stylelint.utils.report({
            message: messages.classTypo(className, CLASS_TYPOS[lowerName]),
            node: rule,
            result,
            ruleName,
          })
        }
      }
    })

    // 2. 检查属性名拼写
    root.walkDecls((decl) => {
      const prop = decl.prop.toLowerCase()
      if (PROPERTY_TYPOS[prop]) {
        stylelint.utils.report({
          message: messages.propTypo(decl.prop, PROPERTY_TYPOS[prop]),
          node: decl,
          result,
          ruleName,
        })
      }
    })

    // 3. 检查属性值拼写
    root.walkDecls((decl) => {
      const value = decl.value
      // 跳过 SCSS 变量值
      if (value.includes('$') || value.includes('#{')) return

      const lowerValue = value.toLowerCase().trim()
      if (VALUE_TYPOS[lowerValue]) {
        stylelint.utils.report({
          message: messages.valueTypo(value, VALUE_TYPOS[lowerValue]),
          node: decl,
          result,
          ruleName,
        })
      }
    })
  }
})

module.exports.ruleName = ruleName
module.exports.messages = messages
