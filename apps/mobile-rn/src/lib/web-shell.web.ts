// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

// 平台特有:依赖 DOM API,web 端浏览器预览壳。
// 浏览器窗口远宽于手机,直接铺满会导致布局拉伸变形;
// 注入全局样式把 #root 约束为手机宽度(430px)并居中,
// 两侧深色留白 + 投影模拟手机视口。native 端不加载此文件。
import { rnLightTokens as tokens } from '@ihui/design-tokens'

const css = `
html, body { height: 100%; }
body {
  margin: 0;
  background: ${tokens.brand.DEFAULT};
  display: flex;
  justify-content: center;
}
#root {
  width: 100%;
  max-width: 430px;
  height: 100dvh;
  background: ${tokens.surface.dark};
  box-shadow: 0 0 48px rgba(0, 0, 0, 0.55);
  /* 模拟手机屏幕裁剪:真机屏幕外的内容不可见,web 端需显式裁掉
     (如 GlobalFloatBox 收起时滑出右缘的浮窗,否则会画到壳外留白区) */
  overflow: hidden;
}
/* TextInput 聚焦双描边修复:react-native-web 的内层 <input> 聚焦时
   触发浏览器默认 outline(Chrome: rgb(16,16,16) auto 1px),与输入框自身
   灰色边框叠加成两圈。App 在 web 预览下无额外聚焦反馈需求(原生端也无
   outline 概念),统一压掉,视觉对齐原生。 */
#root input:focus,
#root input:focus-visible,
#root input:focus-within,
#root textarea:focus,
#root textarea:focus-visible,
#root button:focus,
#root button:focus-visible,
#root [contenteditable]:focus,
/* 全元素兜底:预览宿主(IDE webview)可能注入自己的聚焦高亮,一并压掉 */
#root *:focus,
#root *:focus-visible {
  outline: none !important;
}
`

if (typeof document !== 'undefined' && !document.getElementById('ihui-web-shell')) {
  const el = document.createElement('style')
  el.id = 'ihui-web-shell'
  el.textContent = css
  document.head.appendChild(el)
}
