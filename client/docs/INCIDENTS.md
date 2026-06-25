# 事故记录 (INCIDENTS.md)

> 本文档记录开发过程中遇到的疑难问题和最终解决方案。
> 用于团队知识沉淀、避免后续踩坑、加速新成员 onboarding。
> 最后更新: 2026-06-25

---

## INC-2026-06-25-001: Vue 路由懒加载 88 条日志循环

### 现象
- 首页加载时控制台持续出现 88+ 条错误日志
- 浏览器 DevTools Console 持续被错误刷屏
- 设置页、模型记录页空白

### 根因
- `src/locales/index.ts` 中 Element Plus 语言包采用 `() => import('element-plus/es/locale/lang/zh-cn.mjs')` 动态导入
- 每次 Vite dev server HMR 后, `optimizeDeps` 重新生成 `element-plus_es_locale_lang_zh-cn__mjs.js?v=<新hash>`
- `App.vue` 的 `watch(locale, immediate: true)` 仍持有旧 hash 引用, 触发
  ```
  Failed to fetch dynamically imported module:
    element-plus_es_locale_lang_zh-cn__mjs.js?v=<旧hash>
  ```
- 5 个 locale × 多次 HMR × 循环重试 → 88 条日志

### 修复
- `src/locales/index.ts` 改为顶层 `import zhCn from 'element-plus/es/locale/lang/zh-cn.mjs'` 等 5 个语言包静态导入
- `_epLocales` 改为模块级常量, 避免每次调用重建
- 成本: 5 个 EP locale 总计 ~12KB (gzip 后 ~5KB), 可接受

### 教训
- Vite dev server HMR 不会回收顶层模块, 动态导入受 `optimizeDeps` hash 失效影响
- 任何可能被 `watch`/`onMounted` 立即触发的 `() => import(...)` 都应在顶层 import

### 关联文件
- [src/locales/index.ts](file:///g:/IHUI-AI/client/src/locales/index.ts)
- [src/App.vue](file:///g:/IHUI-AI/client/src/App.vue)
- [vite.config.ts](file:///g:/IHUI-AI/client/vite.config.ts) (optimizeDeps.include)

---

## INC-2026-06-25-002: Pinia `getActivePinia` 竞态

### 现象
- 控制台 `[Vue warn]: getActivePinia() was called but there was no active Pinia`
- 多个组件初始化失败, 导致 header / mobile menu 渲染异常

### 根因
- `useAuthStore()` 顶层 setup 内同步调用 6 个子 store (`useTokenStore`, `useUserStore` 等)
- Vite HMR 时, Pinia 注册完成前, 组件 setup 已执行, 子 store 找不到 active Pinia
- 同一问题出现在 `useEduPlatformNav.ts`, `MobileMenu.vue`, `HomePage4.vue`, `HeaderLogo.vue`, `HeaderNavigation.vue` 等

### 修复
- 顶层 6 个子 store 引用改为 `let store: T | null = null` + `try { store = useStore() } catch {}`
- 提供 `getStore()` getter, 在需要时 (computed/method 访问时) 重新尝试
- 同样模式应用在 router 上: `let router: T | null = null; try { router = useRouter() } catch {}`

### 教训
- Pinia 同 ID store 第二次调用返回缓存实例, 懒加载模式是安全的
- `useRouter()` / `useRoute()` 顶层调用同样需要 try/catch 保护
- 影响范围 50+ 文件, 但修复样板代码可复用

### 关联文件
- [src/stores/auth/index.ts](file:///g:/IHUI-AI/client/src/stores/auth/index.ts)
- [src/stores/auth/permissions.ts](file:///g:/IHUI-AI/client/src/stores/auth/permissions.ts)
- [src/stores/auth/user.ts](file:///g:/IHUI-AI/client/src/stores/auth/user.ts)
- [src/stores/auth/thirdParty.ts](file:///g:/IHUI-AI/client/src/stores/auth/thirdParty.ts)
- [src/composables/useEduPlatformNav.ts](file:///g:/IHUI-AI/client/src/composables/useEduPlatformNav.ts)
- [src/components/header/MobileMenu.vue](file:///g:/IHUI-AI/client/src/components/header/MobileMenu.vue)
- [src/components/home/HomePage4.vue](file:///g:/IHUI-AI/client/src/components/home/HomePage4.vue)

---

## INC-2026-06-25-003: Element Plus el-icon 触发 `Cannot read 'ce'`

### 现象
- `[Vue Error] Cannot read properties of null (reading 'ce')` 持续刷屏
- 错误堆栈: `renderSlot` → `es-RBA7o1T8.js:4671:22` (ElIcon 内部 render 函数)
- 错误堆栈: `renderSlot` → `es-RBA7o1T8.js:10845:16` (ElConfigProvider 内部 render 函数)

### 根因
- Element Plus 2.14.2 中 `ElIcon` 的 render 函数:
  ```js
  return (_ctx, _cache) => {
    return openBlock(), createElementBlock("i", mergeProps({
      class: unref(ns).b(),
      style: style.value
    }, _ctx.$attrs), [renderSlot(_ctx.$slots, "default")], 16);
  };
  ```
- 当 `_ctx.$slots` 为 null 时, `renderSlot` 内部读 `.ce` 属性 (slots proxy) 抛错
- 触发场景: 父组件 slots 链路异常时 (Teleport + v-if + Transition 组合)
- `ElConfigProvider` 同样在 setup 中调用 `renderSlot(slots, "default", ...)`, 受相同影响

### 修复
- `<el-icon><AlertTriangle /></el-icon>` 改为直接渲染 icon 组件:
  ```vue
  <AlertTriangle class="el-icon" :size="18" aria-hidden="true" />
  ```
- 绕过 el-icon 的 slot 处理, 避免 `_ctx.$slots` 为 null
- `el-config-provider` 包裹结构保持 Error 在内部 (作为 default slot), 但已通过 v-if 防止空 locale 触发

### 教训
- 避免在 Element Plus 组件中依赖 `<el-icon><Icon /></el-icon>` slot 模式
- 任何使用 `withInstall(defineComponent({ setup, render }))` 的 EP 组件, 都可能受 `renderSlot(null)` 影响
- 直接渲染 icon 组件比 el-icon 包裹更稳定

### 关联文件
- [src/App.vue](file:///g:/IHUI-AI/client/src/App.vue) (网络离线提示)

---

## INC-2026-06-25-004: Error Boundary 自身导致循环错误

### 现象
- 启用 Error Boundary 后, 错误反而从 1 条变 88+ 条
- 错误: `[Vue Error] Cannot read properties of null (reading 'ce')` 来自 `renderSlot`
- `<slot v-if="!hasError" />` 在 ErrorBoundary 触发后强制重渲染, 触发 null children

### 根因
- 原 `Error.vue` 模板: `<slot v-if="!hasError" />`
- 当 ErrorBoundary 触发后, 父级 `<el-config-provider>` 在 reset 前重建 slot 树
- Vue 内部 `renderSlot` 时读取 null children, 抛 "Cannot read 'ce'"

### 修复
- 改为双层守卫:
  ```vue
  <template v-if="!hasError && $slots.default">
    <slot />
  </template>
  <div v-else-if="hasError" class="error-fallback">
    ...
  </div>
  ```
- 用 `<template #default>` + v-if 双层守卫, 即使外部传入 slots 为 null/undefined 也不会触发 renderSlot 读取 null

### 教训
- Error Boundary 不应使用单一 `v-if` 守卫 slot
- 任何 `<slot v-if="..." />` 都需要 `&& $slots.default` 二次保护
- ErrorBoundary 自身错误应被外层 errorHandler 兜住, 防止循环

### 关联文件
- [src/components/Error.vue](file:///g:/IHUI-AI/client/src/components/Error.vue)

---

## INC-2026-06-24-005: vue-i18n 9.x + EP 误判 custom element

### 现象
- `el-config-provider` 内部 renderSlot(null) 错误
- 编译警告: `Tag el-xxx is not a custom element`

### 根因
- `src/locales/index.ts` 早期版本包含:
  ```ts
  compilerOptions: {
    isCustomElement: tag => tag.startsWith('el-')
  }
  ```
- 这让 vue-i18n 9.x (legacy: false) 把 el-* 当 HTML 自定义元素
- EP 组件未被 unplugin-vue-components 正确解析为 Vue 组件, 触发内部 renderSlot 异常

### 修复
- 移除 i18n 中的 `isCustomElement` 配置
- 仅保留 `vite.config.ts` 中 `vue({ template: { compilerOptions: { isCustomElement: () => false } } })`
- 由 unplugin-vue-components + ElementPlusResolver 负责 el-* 组件解析

### 教训
- vue-i18n 9.x 不应覆盖 Vue 编译器的 `isCustomElement` 设置
- 多个 `compilerOptions` 来源会冲突, 单一职责原则

### 关联文件
- [src/locales/index.ts](file:///g:/IHUI-AI/client/src/locales/index.ts)
- [vite.config.ts](file:///g:/IHUI-AI/client/vite.config.ts)

---

## 维护说明

### 添加新事故记录
1. 使用 `INC-YYYY-MM-DD-NNN` 格式编号
2. 按"现象 / 根因 / 修复 / 教训 / 关联文件"四段结构编写
3. 关联文件使用 `file:///` 协议链接
4. 教训部分应是可复用的设计原则, 而非具体解决方案

### 相关文档
- [前端样式修复索引 (FIX_INDEX.md)](file:///g:/IHUI-AI/client/docs/style/FIX_INDEX.md)
- [设计规范 (design.md)](file:///g:/IHUI-AI/client/docs/style/design.md)
- [设计令牌 (token-docs.md)](file:///g:/IHUI-AI/client/docs/style/token-docs.md)

---

**最后更新**: 2026-06-25
**记录条数**: 5
