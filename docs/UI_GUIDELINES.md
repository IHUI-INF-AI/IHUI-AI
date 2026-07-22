# UI 设计规范

> IHUI-AI 前端设计系统:compact 紧凑 + elegant 优雅风格、圆角守门、中文字体垂直对齐、组件库使用规范。强制规则见 [AGENTS.md §4 前端 UI 约束](../AGENTS.md),本文档聚焦设计系统与组件库实操,不重复规则条款。

---

## 1. 总览

IHUI-AI 前端遵循 **compact 紧凑 + elegant 优雅** 风格,通过 `packages/ui`(Web 组件库)+ Tailwind CSS 4 + shadcn/ui 实现设计系统。

- **组件库**:`@ihui/ui`(25+ 组件,详见 [packages/ui/src/index.ts](../packages/ui/src/index.ts))
- **样式引擎**:Tailwind CSS 4(`@theme` 序列化 `--color-*` 为 `hsl()`)
- **图标**:lucide-react
- **通知**:sonner toast
- **状态**:`@tanstack/react-query` 5(服务端)+ Zustand(客户端)
- **强制规则**:见 [AGENTS.md §4 前端 UI 约束](../AGENTS.md)

### 设计原则

1. **做减法**:最小化代码,零冗余,复用现有组件和模式
2. **每页 < 250 行**:超长页面拆分组件
3. **compact 紧凑**:信息密度高,间距克制
4. **elegant 优雅**:hover 用 subtle 颜色变化,**不要蓝色发光边框**
5. **复用 `packages/ui`**:Card / Button / Input / Dialog 等基础组件,不重复造轮子
6. **时间用 `Intl.DateTimeFormat`**:不用 moment/dayjs
7. **头像用 initials**:不用默认头像图

---

## 2. 设计原则详解

### 2.1 状态徽章颜色规则

| 状态 | 颜色 | 场景 |
|------|------|------|
| draft(草稿) | 灰色(`bg-muted`) | 未发布内容 |
| published(已发布) | 绿色(`bg-success`) | 已发布内容 |
| 积分正数 | 绿色(`text-success`) | 积分增加 |
| 积分负数 | 红色(`text-destructive`) | 积分扣减 |

### 2.2 hover 规则

- 用 subtle 颜色变化(`hover:bg-accent` / `hover:bg-muted`),**不要蓝色发光边框**
- 侧边栏按钮 hover 用同色系 stroke(`--color-sidebar-item-hover-bg`)
- 登录栏 `.login-scope` 内 hover 强制为纯白(凸出 hover 语义),详见 [§7 登录弹窗视觉规范](#7-登录弹窗视觉规范)

### 2.3 时间格式化

```typescript
// 用 Intl.DateTimeFormat,不用 moment/dayjs
const formatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
formatter.format(new Date()) // 2026/07/22 14:30
```

### 2.4 头像 initials

```typescript
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
// "李思涵" → "李", "John Doe" → "JD"
```

---

## 3. 圆角守门

**禁止**纯圆形 / 胶囊形状容器。守门脚本:`scripts/check-rounded-full.mjs`(pre-commit 第 11 项,阻塞)。

### 3.1 规范圆角档位

| Tailwind 类 | 像素值 | 用途 |
|-------------|--------|------|
| `rounded-sm` | 2px | 极小元素(标签内角) |
| `rounded` | 4px | 小元素(按钮、输入框) |
| `rounded-md` | 6px | 中等元素(导航项、chip) |
| `rounded-lg` | 8px | 较大元素(卡片、下拉) |
| `rounded-xl` | 12px | 大容器(面板、弹窗) |
| `rounded-2xl` | 16px | 特大容器(主卡片) |

### 3.2 禁止模式

```
rounded-full          ❌
rounded-pill          ❌
border-radius: 9999px ❌
border-radius: 50%    ❌
```

### 3.3 唯一豁免清单

仅限**非容器装饰元素**(不承载主要内容/交互):

| 豁免 | 场景 | 检测特征 |
|------|------|----------|
| `<img>` / `<Image>` / `AvatarImage` | 头像图片本身 | `<img ... rounded-full` |
| Switch Thumb | Radix Switch 拇指 | `block rounded-full bg-background shadow-lg` / `data-[state=checked]:translate-x` |
| Radio | Radix RadioGroup Indicator | `flex h-4 w-4 items-center justify-center rounded-full border border-input` |
| `<=14px` 装饰点 | 纯装饰状态点 | `w-2 h-2` / `h-1.5 w-1.5` |
| 未读红点底 | 红点背景 | `bg-red-500` + `min-w-[16px] h-4` |
| `animate-spin` | 进度环 / LoadingSpinner | `border` + `animate-spin` |

> 详见 [GATEKEEPERS.md 第 11 项](./GATEKEEPERS.md)。

---

## 4. 中文字体 + 图标垂直对齐

中文字体(HarmonyOS Sans SC)ascent(≈11px)≠ descent(≈3px)不对称,14px 字号下 ink 几何中心比 line-box 中心低 0.4-0.5px,导致 flex `items-center` 时图标与文字视觉不齐。

### 4.1 根治方案

`apps/web/app/globals.css` 建立 CSS 变量 + 全局规则,自动应用 GPU 位移:

```css
/* globals.css 第 163 行 */
:root {
  --text-vcenter-offset: 0.3px;
}

/* globals.css 第 171 行 — 全局自动应用 */
:where(button, a, [role='button'], [role='menuitem']):has(> svg):has(> span) > span {
  transform: translateY(var(--text-vcenter-offset));
}

/* globals.css 第 179 行 — text-xs (12px) 专用 0.7px */
button.text-xs:has(> svg):has(> span) > span,
a.text-xs:has(> svg):has(> span) > span,
[role='button'].text-xs:has(> svg):has(> span) > span,
[role='menuitem'].text-xs:has(> svg):has(> span) > span {
  transform: translateY(0.7px);
}
```

**触发条件**:父级是 `button` / `a` / `[role='button']` / `[role='menuitem']` 语义元素 + 同时含 `svg` 子节点(图标)+ `span` 子节点(文字)。纯文字按钮(no svg)自动排除。

### 4.2 实测调优日志

跨 11 个侧边栏 nav 验证(`getBoundingClientRect` + Range 实测):

| 偏移值 | delta | 结论 |
|--------|-------|------|
| 0.5px | +0.4px | 过冲,文字略低于图标 |
| 0.4px | +0.2px | 可接受 |
| **0.3px** | **0.0px** | **完美居中,选定** ★ |
| 0.2px | -0.2px | 文字略高于图标 |
| 0.0px | -0.5px | 自然态,文字明显高于图标 |

### 4.3 配套组件与常量

| 资源 | 路径 | 用途 |
|------|------|------|
| `CenteredText` 组件 | `apps/web/src/components/common/CenteredText.tsx` | 非语义元素(div/li)场景显式应用偏移 |
| `NAV_ITEM_BASE_CLASS` | `apps/web/src/lib/nav-styles.ts` | 侧边栏 / 顶栏主导航项基础类 |
| `NAV_CHILD_CLASS` | `apps/web/src/lib/nav-styles.ts` | 展开子项(缩进 5 单位) |
| `BTN_NEW_CONVERSATION_CLASS` | `apps/web/src/lib/nav-styles.ts` | 通用按钮(新建任务 / 工具栏) |
| `HEADER_BAR_CLASS` | `apps/web/src/lib/nav-styles.ts` | 顶部标题栏(h-14) |
| `MODEL_SELECTOR_TRIGGER_CLASS` | `apps/web/src/lib/nav-styles.ts` | 模型选择器下拉触发器 |

**`CenteredText` 用法**:

```tsx
import { CenteredText } from '@/components/common/CenteredText'

// 非语义元素(div/li)场景用 CenteredText 显式应用偏移
<div className="flex h-9 items-center gap-2">
  <Icon className="h-4 w-4" />
  <CenteredText>我的学习</CenteredText>
</div>
```

> button/a/[role=button]/[role=menuitem] 场景无需手动包组件,全局规则自动应用。

### 4.4 严禁反向微调

```css
/* ❌ 严禁 -mt-px / margin-top: -1px 反向微调 */
/* 实测让 delta 从 0 变 -0.5,反向恶化 */
.nav-item span { margin-top: -1px; }
```

### 4.5 守门

`apps/web/e2e/icon-text-alignment.spec.ts`:5 个 case,阈值 |delta| ≤ 0.15px,跨 6 个关键 nav + 新建任务按钮 + AI panel header + CSS 变量验证。任何漏改 → CI fail。

---

## 5. 禁止分割线

| 禁止 | 替代方案 |
|------|----------|
| `<hr>` | 容器背景色对比(`bg-card` vs `bg-background`) |
| `divide-y` / `divide-x` | 间距分隔(`gap-*`) |
| 单边 `border-t`/`b`/`l`/`r` 当分割线 | 容器完整描边(`border border-border`) |

**允许**:
- 容器完整描边(`border border-border`)
- 容器背景色对比(`bg-card` vs `bg-background`)
- 间距分隔(`gap-*`)

---

## 6. 禁止渐变遮罩

| 禁止 | 替代方案 |
|------|----------|
| `mask-image` | 显式 UI 元素 |
| `-webkit-mask-image` | "查看更多"按钮 |
| `linear-gradient` 用作边缘淡出 | 计数徽章 |
| | 分页 |

---

## 7. 登录弹窗视觉规范

`.login-scope` 作用域(AuthShell 容器)为凸出 hover 语义,把 `--color-muted` 覆写为 `hsl(0 0% 100%)`(亮)/ `hsl(0 0% 22%)`(暗)。这导致作用域内所有 `bg-muted` / `bg-muted/40` 容器在亮色下与 `bg-card` 完全同色,看不出"凹槽"结构。

### 7.1 强制约束

`.login-scope` 内需要呈现"凹槽"语义的容器(TabsList、密码强度条轨道等)**必须用显式 `hsl()` 值,禁止用 `var(--color-muted)`** — 后者会被 `.login-scope` 覆写为白,绕不开继承链。

| 元素 | 选择器 | 亮色 | 暗色 | 与 bg-card L 差距 |
|------|--------|------|------|------------------|
| TabsList 凹槽容器 | `.login-scope [role='tablist']` | `hsl(0 0% 92%)` `#EBEBEB` | `hsl(0 0% 18%)` `#2E2E2E` | ~8%(对称) |
| 密码强度条轨道 | `.login-scope [data-slot='strength-track']` | `hsl(0 0% 92%)` `#EBEBEB` | `hsl(0 0% 18%)` `#2E2E2E` | ~8%(对称) |

**实现位置**:`apps/web/app/globals.css` 第 263-278 行。

**data-slot 锚点**:密码强度条轨道用 `data-slot="strength-track"` 属性(在 `PasswordStrengthIndicator.tsx`),比 class 匹配更稳定。

### 7.2 守门

`apps/web/tests/visual/login-tabs-groove.spec.ts`:2 个 test case(light + dark),断言:
- TabsList 容器亮 `rgb(235, 235, 235)` / 暗 `rgb(46, 46, 46)`
- strength-track 轨道亮 `rgb(235, 235, 235)` / 暗 `rgb(46, 46, 46)`

### 7.3 .login-scope hover 高亮

```css
/* globals.css 第 240 行 */
.login-scope {
  --color-accent: hsl(0 0% 100%);      /* 亮色:hover 凸出为纯白 */
  --color-accent-foreground: hsl(0 0% 3.9%);
  --color-muted: hsl(0 0% 100%);
}
.dark .login-scope {
  --color-accent: hsl(0 0% 22%);       /* 暗色:hover 提到 22% */
  --color-muted: hsl(0 0% 22%);
}
.login-scope .border-input:hover {
  border-color: hsl(0 0% 3.9% / 0.2);  /* 亮色:hover 边框微微变深 */
}
.dark .login-scope .border-input:hover {
  border-color: hsl(0 0% 98% / 0.2);   /* 暗色:hover 边框微微变浅 */
}
```

**作用域**:AuthShell 弹窗外壳(主站 LoginDialog + `/sso/login` + `/sso/register`)+ LoginPopup。

---

## 8. 圆角容器内 absolute 子元素避让

父容器 `rounded-xl` + `overflow-hidden` 时,贴边子元素**禁止** `h-full`/`w-full`,会撑满到圆角外溢。

### 8.1 替代方案

用 `top-<radius> bottom-<radius>`(纵向)或 `left-<radius> right-<radius>`(横向)替代:

| 父容器圆角 | 替代类(纵向) | 替代类(横向) |
|------------|----------------|----------------|
| `rounded-lg`(8px) | `top-2 bottom-2` | `left-2 right-2` |
| `rounded-xl`(12px) | `top-3 bottom-3` | `left-3 right-3` |
| `rounded-2xl`(16px) | `top-4 bottom-4` | `left-4 right-4` |

### 8.2 拖拽手柄

拖拽手柄用**双层 div 结构**(外层命中区 + 内层可见细线),**禁止** `before:` 伪元素方案:

```tsx
// ✅ 双层 div 结构
<div className="absolute left-2 right-2 top-3 bottom-3 cursor-ew-resize">
  <div className="h-full w-0.5 bg-border mx-auto" />
</div>

// ❌ 禁止 before: 伪元素
// <div className="before:content-[''] before:absolute before:h-full ..." />
```

---

## 9. 输入框规则

- **亮色**:浅灰描边(`--color-input: hsl(0 0% 89.8%)`)
- **暗色**:深灰描边(`--color-input: hsl(0 0% 22%)`)
- **不要其他颜色**

### 9.1 CSS 颜色 token 嵌套守门

**禁止** `hsl(var(--xxx))` / `rgb(var(--xxx))` 嵌套形式。根因:Tailwind v4 `@theme` 把 `--color-*` 序列化为 `hsl()`,外层包裹变成 `hsl(hsl(...))` 非法,被浏览器静默丢弃。

```css
/* ❌ 禁止 */
border-color: hsl(var(--color-input));
background: rgb(var(--color-muted));

/* ✅ 正确 */
border-color: var(--color-input);
/* 需要透明度用 color-mix */
background: color-mix(in srgb, var(--color-muted) 60%, transparent);
```

**守门**:`scripts/check-input-border-var.mjs`(pre-commit 第 17 项,阻塞)。

---

## 10. 禁止原生 title tooltip

用 `packages/ui` 的 `<Tooltip>` 替代 HTML `title` 属性(浏览器原生样式与项目 `<Tooltip>` 不一致)。

```tsx
// ❌ 禁止
<Button title="点击保存">保存</Button>
<td title="详细说明">...</td>

// ✅ 正确
<Tooltip>
  <TooltipTrigger asChild>
    <Button>保存</Button>
  </TooltipTrigger>
  <TooltipContent>点击保存</TooltipContent>
</Tooltip>
```

**豁免**:
- `<Modal>` / `<Alert>` / `<StatCard>` 等组件自带 `title` prop
- `<Button asChild title="...">`(透传)
- `<iframe title="...">`(a11y 必需)

**守门**:`scripts/check-native-title-tooltip.mjs`(pre-commit 第 18 项,阻塞)。

---

## 11. Tailwind class 冲突

防止 className 模板字面量 BASE/BRANCH 出现多套 size 类,后值覆盖前值导致 UI 实际渲染与设计意图脱节。

```tsx
// ❌ 冲突:h-4/h-2 + w-1.5/w-2,后值覆盖前值
<div className={`h-4 w-1.5 ${active ? '' : 'h-2 w-2'}`} />

// ✅ 正确:用 cn() 合并
<div className={cn('h-4 w-1.5', !active && 'h-2 w-2')} />
```

**豁免**:行内/上方一行 `// tailwind-class-conflict-allow` / 纯三元 / 纯字符串 / `cn()` 调用。

**守门**:`scripts/check-tailwind-class-conflict.mjs`(pre-commit 第 20 项,阻塞)。

---

## 12. 组件库使用

### 12.1 @ihui/ui 组件清单

`packages/ui/src/index.ts` 导出 25+ 组件:

| 分类 | 组件 |
|------|------|
| 基础 | Button、Input、Label、Checkbox、Switch |
| 容器 | Card(+ Header/Title/Description/Content/Footer)、Dialog、Sheet |
| 导航 | Sidebar(+ SidebarItem/SidebarGroup)、Tabs、TreeSelect |
| 数据 | Table(+ Header/Body/Footer/Head/Row/Cell)、DataTable、Badge、VipBadge |
| 反馈 | Tooltip、Collapsible、CodeBlock、LogViewer |
| 其他 | Select、Upload、ThemeLogo、Resizable、WebViewFrame、WorkPanel |

### 12.2 使用示例

```tsx
import { Button, Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'

export function UserCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>用户信息</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="default">编辑</Button>
      </CardContent>
    </Card>
  )
}
```

---

## 13. 新增页面 / 组件 checklist

新增页面或组件前,逐项确认:

- [ ] 页面 < 250 行,超长拆分组件
- [ ] 复用 `@ihui/ui` 组件,不重复造轮子
- [ ] 圆角用规范档位(§3),无 `rounded-full`/`9999px`/`50%`
- [ ] 中文字体 + 图标同行布局自动应用 `--text-vcenter-offset`(§4),非语义元素用 `<CenteredText>`
- [ ] 无 `<hr>` / `divide-y` / `divide-x` / 单边 border 当分割线(§5)
- [ ] 无 `mask-image` / `linear-gradient` 渐变遮罩(§6)
- [ ] 圆角容器内 absolute 子元素用 `top-<radius> bottom-<radius>` 避让(§8)
- [ ] 输入框描边用 `var(--color-input)`,无 `hsl(var(--xxx))` 嵌套(§9)
- [ ] hover 用 subtle 颜色变化,无蓝色发光边框(§2.2)
- [ ] 用 `<Tooltip>` 替代原生 `title`(§10)
- [ ] className 模板字面量用 `cn()` 合并,无 BASE/BRANCH size 冲突(§11)
- [ ] 状态徽章:draft 灰 / published 绿,积分正绿负红(§2.1)
- [ ] 时间用 `Intl.DateTimeFormat`,头像用 initials(§2.3 / §2.4)
- [ ] i18n key 已添加(见 [I18N.md §7](./I18N.md))
- [ ] 涉及 CSS 改动附 `Verified-DOM:` trailer(见 [AGENTS.md §17](../AGENTS.md))

---

## 相关文档

- [AGENTS.md §4 前端 UI 约束](../AGENTS.md) — 强制规则原文(圆角守门 / 中文字体对齐 / 禁止分割线 / 禁止渐变遮罩 / 圆角避让)
- [GATEKEEPERS.md](./GATEKEEPERS.md) — UI 守门(第 11/17/18/20 项)详解
- [architecture.md §4 前端架构](./architecture.md) — 路由组织 / API 调用 / i18n / 登录弹窗视觉规范
- [I18N.md](./I18N.md) — 前端 i18n 使用
- [PACKAGES.md](./PACKAGES.md) — `@ihui/ui` / `@ihui/ui-native` 组件库
