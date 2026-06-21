# React Grab 使用说明

## 当前状态

✅ React Grab 已成功集成到项目中
✅ 在开发环境下自动启用
✅ 可以通过 Ctrl/Cmd + C 复制元素信息

## 功能说明

### 在 Vue 项目中可用功能：

1. **复制元素信息** - 悬停元素并按 Ctrl/Cmd + C 可以复制：
   - DOM 元素类型（如 `<button>`, `<div>` 等）
   - HTML 属性和类名
   - CSS 选择器路径
   - 元素在页面中的位置

2. **复制示例**：
   ```html
   <button class="el-button el-button--primary" type="button">
     点击按钮
   </button>
   ```

### 在 Vue 项目中不可用功能：

❌ **无法显示 Vue 组件名称** - React Grab 依赖 React Fiber 架构，无法访问 Vue 组件树
❌ **无法显示组件文件路径** - Vue 组件的位置信息无法被 React Grab 读取

## 使用方法

1. 启动开发服务器：`npm run dev`
2. 打开浏览器访问 `http://127.0.0.1:8888/`
3. 打开浏览器开发者工具（F12）查看控制台
4. 鼠标悬停到任意元素上
5. 按下 **Ctrl + C** (Windows) 或 **Cmd + C** (Mac)
6. 元素信息将复制到剪贴板

## 实际用途

虽然无法显示 Vue 组件名称，但 React Grab 仍然有用：

1. **快速选择元素** - 不用手动写 CSS 选择器
2. **复制 HTML 结构** - 快速复制元素的完整 HTML
3. **配合 AI 工具** - 粘贴给 AI，让 AI 帮你修改样式或结构

## 示例工作流

```
1. 悬停在一个按钮上
2. 按 Ctrl + C
3. 粘贴给 AI："帮我修改这个按钮的样式，改成红色背景"
4. AI 会根据复制的 HTML 提供修改建议
```

## 控制台日志

如果加载成功，你应该在浏览器控制台看到：
```
[React Grab] 开始加载...
[React Grab] ✅ 加载成功！
[React Grab] 提示：悬停元素并按 Ctrl/Cmd + C 来复制组件信息
```

## Vue 项目的替代方案

如果你需要查看 Vue 组件名称和文件路径，建议使用：

1. **Vue DevTools** - 官方的 Vue 开发者工具
2. **浏览器开发者工具** - F12 查看元素和组件树
3. **源代码搜索** - 直接在 IDE 中搜索组件名

## 技术原理

React Grab 依赖以下技术：
- **React Fiber** - React 的内部数据结构
- **@babel/plugin-transform-react-jsx-source** - Babel 插件，注入组件位置信息

由于 Vue 使用不同的内部架构，React Grab 无法访问 Vue 组件的元数据。

## 配置位置

- **index.html** - 在 `<head>` 中加载 React Grab
- **仅开发环境** - 通过 `import.meta.env.DEV` 判断

## 相关文件

- `index.html` - React Grab 加载配置
- `public/test-react-grab.html` - 测试页面
