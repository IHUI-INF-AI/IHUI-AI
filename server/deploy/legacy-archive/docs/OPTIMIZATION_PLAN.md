# 前端资源优化方案

## 问题分析

### 当前资源大小统计

| 类别 | 资源 | 当前大小 | 问题等级 |
|------|------|----------|----------|
| 字体 | HarmonyOS Sans SC (7个字重) | **56.5 MB** | 🔴 严重 |
| 字体 | EDIX 英文字体 | 0.02 MB | ✅ 正常 |
| JS | chunk-vendors.js | 1.4 MB | 🟡 较大 |
| JS | 富文本编辑器相关 | 1.3 MB | 🟡 较大 |
| CSS | chunk-vendors.css | 339 KB | 🟡 一般 |
| 图片 | favicon (3个格式) | 1.35 MB | 🔴 严重 |

### 问题根因

1. **字体文件过大**：中文字体包含数万个字符，每个字重约 8MB
2. **Element Plus 全量引入**：未使用按需加载
3. **Element Plus Icons 全量注册**：注册了所有图标组件
4. **favicon 未优化**：ico/png/svg 三种格式都是 462KB

---

## 优化方案

### 方案一：字体优化（预计减少 50+ MB）⭐ 最重要

#### 1.1 使用字体子集化（推荐）

将完整中文字体子集化，只保留常用字符（约 3000-6500 字）。

**工具选择**：
- `fonttools` + `pyftsubset` (Python)
- `font-spider` (Node.js)
- `glyphhanger` (Node.js)

**预期效果**：
- 每个字体从 ~8MB 降至 ~300-500KB
- 总计从 56.5MB 降至 ~3MB

**实施步骤**：
```bash
# 安装 fonttools
pip install fonttools brotli

# 子集化字体（保留常用 6500 字）
pyftsubset HarmonyOS_SansSC_Regular.ttf \
  --text-file=chinese-chars.txt \
  --output-file=HarmonyOS_SansSC_Regular.subset.woff2 \
  --flavor=woff2
```

#### 1.2 减少字重数量

当前使用 7 个字重，实际常用的可能只有 3-4 个：
- Regular (400) - 正文
- Medium (500) - 强调
- Semibold (600) 或 Bold (700) - 标题

**建议保留**：Regular、Medium、Bold，删除 Thin、Light、Semibold、Black

#### 1.3 转换为 WOFF2 格式

WOFF2 比 TTF 压缩率高 30-50%。

```scss
// 修改 fonts.scss
@font-face {
  font-family: 'HarmonyOS Sans SC';
  src: url('../assets/fonts/HarmonyOS_SansSC_Regular.woff2') format('woff2'),
       url('../assets/fonts/HarmonyOS_SansSC_Regular.ttf') format('truetype');
  font-weight: 400;
  font-display: swap;
}
```

#### 1.4 使用 CDN 托管字体（可选）

将字体托管到 CDN，利用浏览器缓存和边缘节点加速。

---

### 方案二：Element Plus 按需引入（预计减少 500KB+）

#### 2.1 安装按需引入插件

```bash
npm install -D unplugin-vue-components unplugin-auto-import
```

#### 2.2 配置 vue.config.js

```javascript
const AutoImport = require('unplugin-auto-import/webpack')
const Components = require('unplugin-vue-components/webpack')
const { ElementPlusResolver } = require('unplugin-vue-components/resolvers')

module.exports = {
  configureWebpack: {
    plugins: [
      AutoImport({
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        resolvers: [ElementPlusResolver()],
      }),
    ],
  },
}
```

#### 2.3 修改 main.js

```javascript
// 移除全量引入
// import ElementPlus from 'element-plus'

// 只引入必要的样式和配置
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/notification/style/css'
import 'element-plus/es/components/message-box/style/css'
import 'element-plus/es/components/loading/style/css'

// 配置语言
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
```

#### 2.4 Element Plus Icons 按需引入

当前代码已经在各组件中按需引入图标，移除 main.js 中的全量注册：

```javascript
// 删除这段代码
// for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
//   app.component(key, component)
// }
```

---

### 方案三：图片优化（预计减少 1.3MB）

#### 3.1 优化 favicon

当前 3 个 favicon 都是 462KB（很可能是同一张大图）：

```bash
# favicon.ico - 保留，但压缩为多尺寸 ICO（16x16, 32x32, 48x48）
# favicon.png - 压缩为 32x32 或 64x64，约 1-5KB
# favicon.svg - 如果是简单图标，优化后约 1-2KB
```

**推荐工具**：
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [SVGO](https://github.com/svg/svgo) - SVG 优化
- [TinyPNG](https://tinypng.com/) - PNG 压缩

#### 3.2 Logo 优化

如果 logo.png 是 462KB，考虑：
- 转换为 SVG（如果是矢量图标）
- 使用 WebP 格式（比 PNG 小 25-35%）
- 压缩 PNG（TinyPNG 可减少 50-80%）

---

### 方案四：代码分割优化

#### 4.1 路由懒加载（已实现，确认）

```javascript
// router/index.js
{
  path: '/learn',
  component: () => import('@/views/learn/index.vue')
}
```

#### 4.2 第三方库懒加载

对大型库使用动态 import：

```javascript
// 富文本编辑器懒加载
const WangEditor = () => import('@wangeditor/editor')
const TinyMCE = () => import('tinymce')
```

#### 4.3 分离大型依赖

在 vue.config.js 中配置 splitChunks：

```javascript
configureWebpack: {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        elementPlus: {
          name: 'element-plus',
          test: /[\\/]node_modules[\\/]element-plus[\\/]/,
          priority: 20,
        },
        wangEditor: {
          name: 'wangeditor',
          test: /[\\/]node_modules[\\/]@wangeditor[\\/]/,
          priority: 20,
        },
        vendors: {
          name: 'chunk-vendors',
          test: /[\\/]node_modules[\\/]/,
          priority: 10,
          chunks: 'initial',
        },
      },
    },
  },
}
```

---

## 实施计划

### 阶段一：高优先级（减少 50+ MB）

| 任务 | 预期收益 | 复杂度 | 时间 |
|------|----------|--------|------|
| 字体子集化 + WOFF2 转换 | -53 MB | 中 | 2-3h |
| 减少字重数量（7→3） | -24 MB | 低 | 30min |
| favicon 优化 | -1.3 MB | 低 | 30min |

### 阶段二：中优先级（减少 500KB-1MB）

| 任务 | 预期收益 | 复杂度 | 时间 |
|------|----------|--------|------|
| Element Plus 按需引入 | -500 KB | 中 | 2-3h |
| 移除全量图标注册 | -100 KB | 低 | 30min |
| 代码分割优化 | -200 KB | 中 | 1-2h |

### 阶段三：低优先级（性能微调）

| 任务 | 预期收益 | 复杂度 | 时间 |
|------|----------|--------|------|
| 第三方库懒加载 | 首屏加快 | 中 | 2h |
| 开启 Gzip/Brotli | 传输减少 70% | 低 | 服务器配置 |
| CDN 托管静态资源 | 加载加快 | 中 | 1-2h |

---

## 预期效果

### 优化前

| 资源类型 | 大小 |
|----------|------|
| 字体文件 | 56.5 MB |
| JS Bundle | 2.8 MB |
| CSS | 415 KB |
| 图片 | 1.5 MB |
| **总计** | **~61 MB** |

### 优化后（预估）

| 资源类型 | 大小 | 减少 |
|----------|------|------|
| 字体文件 | 1.5 MB | -55 MB (97%) |
| JS Bundle | 1.5 MB | -1.3 MB (46%) |
| CSS | 200 KB | -215 KB (52%) |
| 图片 | 50 KB | -1.45 MB (97%) |
| **总计** | **~3.3 MB** | **-57.7 MB (95%)** |

---

## 风险评估

| 优化项 | 风险 | 缓解措施 |
|--------|------|----------|
| 字体子集化 | 可能缺少生僻字 | 包含 GB2312 + 常用字 6500 |
| 减少字重 | 设计效果略有影响 | 保留 3 个常用字重 |
| 按需引入 | 遗漏组件导致报错 | 充分测试所有页面 |

---

## 执行建议

1. **先执行阶段一**：字体优化收益最大，风险最低
2. **阶段二需要测试**：Element Plus 按需引入需要完整回归测试
3. **服务器配置 Gzip**：这是零成本的优化，传输大小减少 70%+
