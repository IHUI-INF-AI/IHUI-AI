module.exports = {
  // 基本配置
  singleQuote: true,          // 使用单引号而非双引号
  semi: false,                // 语句末尾不添加分号
  tabWidth: 2,               // 缩进宽度为2个空格
  useTabs: false,            // 使用空格而非制表符
  trailingComma: 'es5',      // 尾随逗号只在ES5语法中使用
  endOfLine: 'auto',         // 自动检测换行符类型
  bracketSpacing: true,      // 对象字面量的大括号之间使用空格
  arrowParens: 'avoid',      // 箭头函数参数只有一个时省略括号
  printWidth: 100,           // 代码行宽度限制为100个字符
  htmlWhitespaceSensitivity: 'ignore',  // HTML空白敏感度设置为忽略
  // Vue 特定配置
  vueIndentScriptAndStyle: true,  // Vue文件中<script>和<style>标签内的代码缩进
  // CSS 特定配置
  cssDeclarationSorter: true,     // 对CSS声明进行排序
  // TypeScript 特定配置
  quoteProps: 'as-needed',        // 只在必要时给对象属性添加引号
  jsxSingleQuote: true,           // JSX中使用单引号
  jsxBracketSameLine: false       // JSX标签的闭合括号放在新行
}
