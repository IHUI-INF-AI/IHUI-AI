'use client'

/**
 * 设计器页面入口(路由解析点)。
 *
 * 原 ~1922 行巨型文件已拆分为语义子组件:
 *  - DesignPage.tsx        — 组合根(状态/副作用/回调 + 区块编排)
 *  - DesignToolbar.tsx     — 顶部工具栏(模板/AI/保存/导出/响应式设备/参考线)
 *  - DesignLeftPanel.tsx   — 左栏(预览列表 + 组件树)
 *  - HtmlSourceEditor.tsx  — 中左 HTML 源码编辑 + 撤销/重做/渲染
 *  - PreviewCanvas.tsx     — 中 iframe 画布(响应式预览)
 *  - InspectorPanel.tsx    — 右栏(CSS 检视 / 评论 tab)
 *  - TemplateDialog.tsx    — 模板库弹窗
 *  - TreeView.tsx / DeviceIcon.tsx / CssInspector.tsx — 纯展示子组件
 *  - css-config.ts / design-utils.ts / design-types.ts — 配置/工具/类型
 *
 * 本文件仅作为 barrel,保持路由默认导出不变。
 */
export { default } from './DesignPage'
