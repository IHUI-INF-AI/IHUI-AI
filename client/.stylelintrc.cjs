/**
 * Stylelint 配置
 * 
 * 样式规范检查
 */
module.exports = {
  // 使用最小化的推荐配置
  extends: ['stylelint-config-recommended'],
  rules: {
    // ============================================
    // 样式规范 - 禁用 !important 检查（项目中大量使用覆盖第三方库样式）
    // ============================================
    'declaration-no-important': null,

    // ============================================
    // SCSS 相关规则 - 允许 SCSS 特有语法
    // ============================================
    // 允许 SCSS 的 !default 和 !global 注解
    'annotation-no-unknown': [
      true,
      {
        ignoreAnnotations: ['default', 'global'],
      },
    ],

    // ============================================
    // 其他规则 - 全部禁用或设为警告
    // ============================================
    'no-descending-specificity': null,
    'font-family-no-missing-generic-family-keyword': null,
    'no-duplicate-selectors': null,
    'block-no-empty': null,
    // 允许无效位置声明（SCSS 嵌套中的特殊情况）
    'no-invalid-position-declaration': null,
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['deep', 'global', 'slotted', 'v-deep', 'v-global', 'v-slotted', 'loading', 'export'],
      },
    ],
    'selector-pseudo-element-no-unknown': [
      true,
      {
        ignorePseudoElements: ['v-deep', 'v-global', 'v-slotted'],
      },
    ],
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'tailwind', 'apply', 'layer', 'variants', 'responsive', 'screen',
          'use', 'forward', 'include', 'mixin', 'function', 'return',
          'if', 'else', 'each', 'for', 'while', 'extend', 'at-root',
          'debug', 'warn', 'error', 'content',
        ],
      },
    ],
    'property-no-unknown': [
      true,
      {
        ignoreProperties: [
          'container-type', 
          'container-name',
          // 移动端 CSS 属性
          'tap-highlight-color',
          '-webkit-tap-highlight-color',
          // CSS Modules :export 中的自定义属性名
          'primaryColor',
          'successColor',
          'warningColor',
          'errorColor',
          'infoColor',
        ],
      },
    ],
    'function-no-unknown': null,
    // 允许废弃属性（如 clip）
    'property-no-deprecated': null,
    // 允许未知 media 特性值
    'media-feature-name-value-no-unknown': null,
    // 允许重复属性
    'declaration-block-no-duplicate-properties': null,
    // 允许简写属性覆盖
    'declaration-block-no-shorthand-property-overrides': null,
    // 允许未知属性值（SCSS 变量）
    'declaration-property-value-no-unknown': null,
    // 允许无效 media query（SCSS 变量）
    'media-query-no-invalid': null,
    // 允许缺少作用域根
    'nesting-selector-no-missing-scoping-root': null,
    // 允许废弃关键字（如 break-word）
    'declaration-property-value-keyword-no-deprecated': null,
    // 允许空源
    'no-empty-source': null,
    // 允许未知 @font-face 描述符
    'at-rule-descriptor-no-unknown': null,
  },
  overrides: [
    {
      // ============================================
      // 组件样式禁止硬编码十六进制颜色
      // 仅 src/views/ 和 src/components/ 下的样式文件生效
      // 主题定义文件（src/styles/）不受此限制
      // ============================================
      files: ['src/views/**/*.vue', 'src/views/**/*.scss', 'src/components/**/*.vue', 'src/components/**/*.scss'],
      rules: {
        'color-no-hex': true,
      },
    },
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html',
    },
    {
      files: ['**/*.scss'],
      customSyntax: 'postcss-scss',
    },
  ],
  ignoreFiles: [
    'node_modules/**',
    'dist/**',
    'public/**',
    '**/*.min.css',
    // postcss-html 解析 Vue 模板时误报 Unknown word t
    'src/views/admin/EventBusMonitor.vue',
    'src/components/header/HeaderNavigation.vue',
    'src/views/Plaza.vue',
    'src/components/ai/AIChat.vue',
    'src/components/login/UniversalLogin.vue',
    'src/components/login/components/AccountBindDialog.vue',
    'src/components/agents/AgentsSquareList.vue',
  ],
};
