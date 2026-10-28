// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 DOM API,web 端浏览器预览壳。
import { CHART_BG_DARK, GEOMETRY_PX, SHELL_BG_DARK } from '@ihui/design-tokens'
// 浏览器窗口远宽于手机,直接铺满会导致布局拉伸变形;
// 注入全局样式把 #root 约束为手机宽度(430px),
// 两侧深色留白 + 投影模拟手机视口。native 端不加载此文件。
// 对齐方式取"贴右边"而不是居中(2026-09-29 用户 H5 实测反馈):浮窗竖条在 App 内本就与
// 屏幕右缘齐平(量得 gap=0),居中时壳外那道左白右白会让贴边元素看起来"还留了间距",
// 把壳推到窗口右缘后,所见即真机的贴边关系。

// 壳宽单源:#root 与 Modal portal 封顶两处必须同值。值不落本文件字面量 ——
// 取仓级几何档 GEOMETRY_PX.previewShellWidth(用户 token 铁律:尺寸不许硬编码,
// 端内 `const *_W = 430` 是第二份真相;档的立档依据见 geometry.js 头注与该档注释)。
const SHELL_MAX_W = GEOMETRY_PX.previewShellWidth

const css = `
html, body { height: 100%; }
body {
  margin: 0;
  background: ${SHELL_BG_DARK};
  display: flex;
  justify-content: flex-end;
}
#root {
  width: 100%;
  max-width: ${SHELL_MAX_W}px;
  height: 100dvh;
  background: ${CHART_BG_DARK};
  box-shadow: 0 0 48px rgba(0, 0, 0, 0.55);
  /* 模拟手机屏幕裁剪:真机屏幕外的内容不可见,web 端需显式裁掉
     (如 GlobalFloatBox 收起时滑出右缘的浮窗,否则会画到壳外留白区) */
  overflow: hidden;
}
/* RN Modal portal 同步封顶(2026-10-15 用户定「跟手机屏尺寸宽度不符」):react-native-web 的
   ModalPortal 把一个无属性裸 div 挂在 body 顶层,其内部 ModalAnimation/ModalContent 是双层
   position:fixed 相对视口(IDE webview ~586px),完全不受上方 #root 430 约束 —— 弹层铺满
   全视口宽,左右超出手机壳;且面板尺寸取 useWindowDimensions()(=视口宽)算出后居中于视口,
   横向溢出壳缘。两步修复:此处 CSS 让 portal 变成定位容器把弹层按壳封顶(覆盖面板居中);
   尺寸计算半区改在消费端修 —— 需要框架实际宽的组件改用 useAppFrameWidth() 实测 #root 宽
   (如 SearchOverlay panelWidth,原按视口 586 算出 554 越壳),二者壳宽同一档 430。
   (曾计划在 Dimensions.update() 统一夹逼,但 RNW 在浏览器对 Dimensions.set 直接 invariant
   禁用,该通路不存在,故走消费端 hook。)
   对齐轨道:与 #root 同为贴右(2026-09-29 用户 H5 定),right:0 相对视口 = #root 右缘。
   选择器用引号让特异性恰为 0,1,0,与 RNW ModalContent 内联样式 inset:0 等特 —— 等特异
   时内联参与优先级竞争,故 max-width 需 !important 破平(2026-10-15 实测定档,勿删)。
   锚点必须用 aria-modal 而非 role="dialog"(2026-10-15 复测修正):RNW ModalContent 是
   role: active ? 'dialog' : null —— 多模态叠开时(如搜索浮层打开后登录弹窗降为非 active)
   非顶层那个 role 变 null,:has(role="dialog") 失配 → 该 portal 回落视口宽、整条弹窗越出壳
   (实测「立即登录」按钮 l=16 越壳)。aria-modal 恒为 true,与 active 无关,才是稳定锚。
   :has 兜底三档深度(ModalAnimation→FocusTrap Fragment→ModalContent 的层深随 RNW 版本浮动;
   本仓实测走最深档:portal > Animation > FocusTrap View > Content[aria-modal])。 */
body > div:has(> [aria-modal]),
body > div:has(> div > [aria-modal]),
body > div:has(> div > div > [aria-modal]) {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: auto;
  width: 100%;
  max-width: ${SHELL_MAX_W}px !important;
  /* transform 在此只为把该 div 建为 fixed 后代的 containing block(弹层由此相对壳定位);
     translateX(0) 不产生位移 */
  transform: translateX(0);
  margin: 0;
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
/* 占位文字恒占一行(2026-10-16 用户定:placeholder 不得折成多行)。
   textarea 本体必须保留 white-space:pre-wrap 才能换行显示多行内容,但
   ::placeholder 是独立绘制的伪元素,可单独覆写 white-space —— 输入列宽度 =
   壳宽 - 麦克风/模型钮/加号/发送与各处 padding,窄壳(375 真机档,实测仅约
   146px)下占位文字(约 171px)折行后被固定 48 高框裁掉半行。对齐原生端
   TextInput 占位文字的单行截断语义:nowrap + 省略号,内容多行换行不受影响。 */
#root textarea::placeholder {
  white-space: nowrap;
  text-overflow: ellipsis;
}
`

if (typeof document !== 'undefined' && !document.getElementById('ihui-web-shell')) {
  const el = document.createElement('style')
  el.id = 'ihui-web-shell'
  el.textContent = css
  document.head.appendChild(el)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
