<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# UI 设计规范

> IHUI-AI 前端设计系统:compact 紧凑 + elegant 优雅风格、圆角守门、中文字体垂直对齐、组件库使用规范。强制规则见 [AGENTS.md §4 前端 UI 约束](../AGENTS.md),本文档聚焦设计系统与组件库实操,不重复规则条款。

---

## 1. 总览

IHUI-AI 前端遵循 **compact 紧凑 + elegant 优雅** 风格,通过 `packages/ui`(Web 组件库)+ Tailwind CSS 4 + shadcn/ui 实现设计系统。

- **组件库**:`@ihui/ui-react`(25+ 组件,详见 [packages/ui/src/index.ts](../packages/ui/src/index.ts))
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

**档位值的唯一真相源是 `packages/design-tokens/src/radius.js` 的 `RADIUS_STEPS`，"哪类元素用哪档"的唯一记录是同文件的 `RADIUS_ROLES`。** 本表是它两节的展开，改档位只改 JS 表、再回头同步本表，不得在本表另立数字。

| Tailwind 类 | 像素值 | 角色键 | 用途 |
|-------------|--------|--------|------|
| `rounded-xs` | 2px | `tiny` | 极小元素（标签内角、计数点） |
| `rounded-sm` | 4px | `control` | 小元素（按钮、输入框） |
| `rounded-md` | 6px | `chip` | 中等元素（导航项、chip） |
| `rounded-lg` | 8px | `card` | **卡片、下拉、列表项容器** |
| `rounded-xl` | 12px | `panel` | 大容器（面板、弹窗） |
| `rounded-2xl` | 16px | `hero` | 特大容器（主卡片） |
| `rounded-md` | 6px | `popover` | **轻量浮层**（右键菜单、tooltip、贴锚小菜单）—— 不是 panel：一个 160px 宽的菜单套 12px 会变成卡片；也不同于**下拉列表**（下拉列表按 `card`） |
| `rounded-2xl` | 16px | `bubble` | **聊天气泡**（会话流消息盒）—— 与卡片不同类，两端实测同值 16px，并进 `card` 等于把聊天界面重新设计 |

> **身份怎么被认出来（2026-09-28 票㉘）**：守门 150 的类别证据按强弱排序，**名字与身份优先于颜色档** ——
> ① 显式取用 `rnRadiusFor.<role>`（最硬，作者已经把类别说出来）；② 元素自身的 JSX 标签名 / 样式键名；
> ③ **容器包含关系**（自称 card 而祖先模态 ⇒ 按 panel，见守门 150 C4）；④ 组件根容器的**组件名**（C5，只认根元素）；
> ⑤ **身份通道**：ARIA `role=`（`menu`/`dialog`/`tooltip`…，ARIA 角色就是元素的身份）、`data-testid`（作者给盒子起的名字）、
> 显式身份标记类 `ui-<role>`（角色名封闭集，给"连名字都没有"的元素留的出口）、以及色档里唯一算身份的 `bg-popover`（浮层类族名）。
> ⑥ 其余颜色档（`bg-card`、`bg-muted`）**只是背景档**，一律进"弱证据待裁"名单，不据此判红 ——
> 按色档批量改档 = 拿 20–70% 判错率的证据重新设计界面；要给一个元素定性，就把它写进代码（命名 / `role=` / `ui-<role>`），
> 让门从此能判。

> 本表前有两处历史漂移已随 `RADIUS_ROLES` 一并更正（2026-09-27）：`rounded-sm` 曾写 2px（现 4px，2px 由 `rounded-xs` 承载）、`rounded` 曾写 4px（现 8px，与 `rounded-lg` 同值）。这两行与档位表不符期间，照文档写就偏一档 —— 角色当初是绑在 px 上的，档位收口时没跟着搬。

> **卡片取 `lg`（8px）是 2026-09-27 的定档**，不得在某一端单独改取 `xl`：实测同一张 `UserInfoCard` 小程序 8px、App(RN) 12px 长期并存，而两端都规矩引用 token，圆角单一源守门（77）看不见这一型。跨端同名组件的圆角对账现由守门 128 负责（见其 `RADIUS_FORM_RE` 一条）。

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

> **2026-09-24 校正(实测,勿照上面代码块去 grep)**:上面两段是 2026-09-15 立项时的形态。规则本体现在
> `packages/design-tokens/src/styles/tokens.css`(不在 `globals.css`),且已于 2026-08-28 从
> `transform: translateY()` **改为 `translate` 属性**(原因见 tokens.css 内注:Tailwind v4 的 `translate-y-*`
> 编译成独立 `translate` 属性,与 `transform` 同时命中会几何叠加成 0.6px)。因此读 `getComputedStyle` 时
> **必须看 `.translate`** —— 本票复核 `ViewMoreLink` 时先读 `.transform` 得到 `none`,一度误判补偿规则没生效。

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

### 4.6 区段头「更多」入口(三端唯一实现)

用户实拍反馈"查看更多按钮图标跟文字错位"。量产后确认这不是一处疏忽,而是一类写法错误:
**箭头被当成文字写**(字符 `›` / `>`),而且给的字号比它自己的标签还大。

| 端 | 唯一实现 | 取用形态 |
| -- | -------- | -------- |
| RN(mobile-rn + packages/app) | `packages/app/src/components/MoreLink.tsx`(`@ihui/rn-app` 导出) | `<MoreLink label={t('common.more')} onPress={…} colorScheme={…} />` |
| web | `apps/web/src/components/common/view-more-link.tsx` | `<ViewMoreLink label={tc('more')} href={…} />` |
| 小程序 | 复用 `LineIcon name="chevron-right"`(`icons.ts` 已含,零新素材) | `<SectionHeader … />` 或页面级 flex 行 |

**三条硬约束**:

1. **禁止用字符 `›` / `»` / `>` 充当箭头图标**。半行距模型下,字形相对自身行盒中心的偏移
   `d = (ascent − descent) / 2 + 墨迹中心`,**与 line-height 无关、与字号无关**。用应用实际字体
   HarmonyOS Sans SC 实测:12px 的「更」d = −1.0px(墨迹偏上),而 `›` 在 14/16/18/20px 档
   d = +1.0 ~ +1.5px(墨迹偏下)—— 两者是**相加**不是相消,所以"标签 12px + 箭头 16/18px"
   的旧写法实测错位 **2.0 ~ 2.5px**。lucide `ChevronRight` 是 24 单位网格的固定几何、
   墨迹天然居中外框中心(d = 0),换掉载体即把"相加"变成"抵消"。
2. **标签与箭头必须同一光学尺寸**(web/RN 12px、小程序 24rpx),并且**必须同一缩放倍率**。
   旧写法箭头带 `allowFontScaling={false}` 而标签允许缩放,用户在系统里调大字号后两者分叉 ——
   换掉字形载体并不消除这一半病因,固定 dp 的 SVG 同样不随字号长。`MoreLink` 现把同一个
   倍率同时喂给 `Text.maxFontSizeMultiplier` 与图标尺寸(clamp 到 1..1.4)。Android 另需
   `includeFontPadding: false`(端内既有 8 处同样写法),否则 `fm.top`/`fm.bottom` 的
   不对称字体留白把行盒撑高,又变回"盒对齐、字不对齐"。
3. **禁止反向微调补丁** —— 承 §4.4。`MyAgents.tsx` 曾带 `teamArrow: { marginBottom: -2 }`,
   数值正是在补第 1 条那个 2px,换机型即失效,已随迁移删除。

**文案**:统一取 `common.more`(zh `更多` / en `More` / ja `もっと見る` / ko `더 보기`),
不得再出现"查看更多 / 查看全部 / 完整榜单"。但 `accessibilityLabel` **刻意保留更长口径**
(如"查看更多模型")—— 可见文案求短,无障碍名称必须脱离上下文也能成立。

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

### 12.1 @ihui/ui-react 组件清单

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
import { Button, Card, CardHeader, CardTitle, CardContent } from '@ihui/ui-react'

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

## 13. 读数不得断行(强制)

**任何"一格一读数"的统计格子,读数(数字 / 时长 / 比率 / 带单位量)必须整条单行显示。**
宽度不够时,唯一合法出路是**减少每行的格数或每组的栏数**;下列三种"省地方"的做法一律禁止:

- 让读数折成第二行(把 `6天19小时` 切成 `6天19小 / 时` —— 数字被切断读起来像渲染坏了);
- 截断 / 省略号 / `truncate`(大屏上的读数是给人抄进故障单里的,藏起来等于没有);
- 为塞下而缩小读数字号(同一屏内主读数只有一档)。

标签(label)允许整词折行;读数不允许。

### 13.1 立因(2026-10-24 机主指认的实测缺陷)

运维大屏「AI 号池」面板把「6天19小时」切成两行,并把同排卡片撑高留出空白。机器成因是**三层常数脱钩**,缺任何一层都会复发:

| 层 | 当时的值 | 实测需求 | 后果 |
| --- | --- | --- | --- |
| 读数容器 | 无 `white-space:nowrap` | — | 列宽一窄就折行 |
| `.wb-cells` 列宽下限 | `minmax(96px,1fr)` | 143px | 排出的列必然窄于读数 |
| `.wb-split` 两栏阈值 | `@container ≥620px` | ≥890px | 两栏后每栏 333px、每格 107px |

三层必须同批改。**只补 `nowrap` 会把"折行"变成"溢出压到相邻卡片"**(实测最多溢出 61px),比折行更难看。

### 13.2 唯一写法

需求数字必须现量,不得凭印象填。量法 = 真 Chromium + 站点自托管字体,取该组**五语言最坏读数**的单行宽,再加格子左右 padding 与边框:

```css
/* 1) 列宽下限只有一个源头(单位:格总宽,含 padding 与边框) */
.wb-root { --wb-cell-min: 143px; }
/* 2) 长读数组用这一档 ⇒ 宽度不足时 auto-fit 自动减列,而不是折断读数 */
.wb-cells-c3 { grid-template-columns: repeat(auto-fit, minmax(var(--wb-cell-min), 1fr)); }
/* 2b) 复合读数(「12.3 GB / 15.6 GB」「↓ 1.5 MB/s ↑ 1.5 MB/s」= 两个量并排 + unit 槽)
       另开一档:实测单行需 224px,用 c3 仍会溢出 51px。 */
.wb-root { --wb-cell-min-wide: 224px; }
.wb-cells-wide { grid-template-columns: repeat(auto-fit, minmax(var(--wb-cell-min-wide), 1fr)); }
/* 3) 该组住在两栏分组里时,栏阈值由同一批常数复算,不得另写数字
      890 = 2×(3×143 + 2×6) + 8   // 每栏格数×下限 + (格数-1)×列间距,再乘 2 栏 + 栏间距 */
@container (min-width: 890px) { .wb-split-c3 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
```

读数容器必须带 `whitespace-nowrap`——不只 `StatCell` 原语,**手写的 `wb-num` 大字号读数同样在册**(大屏里有 3 处 26px 手写读数,原判据只正则原语函数体,结构上打不到它们)。
**用了 `wb-split-c3` 的面板,其内每一组网格都必须落在 c3 / wide / 固定列档上**:只改栏数不改列宽,等于把折行换成溢出。

守门:`check-readout-no-break.mjs`(240,blocking)—— R1 大字号读数 nowrap / R2 常数定义且被消费 / R3 c3 档引用常数 / R4 用了 `wb-split-c3` 的面板内每组必须同档 / R5 栏阈值等于按被审面自身常数复算的值 / R6 时长读数不得停在裸 auto-fit 档 / **R8 把 R1 那条形态判据推广到 `apps/web` + `packages/ui-react` + `apps/extension` 全仓**。

镜像测试 `scripts/tests/check-readout-no-break.test.mjs`(24 例,每条判据各有"摘掉即翻红"的成对夹具)。

**R8 是差值棘轮,不是绝对零容忍**:锚点 = 该文件 HEAD 自身的违规数,只拦"本次把无-nowrap 的大字号读数加回来"。存量实测 **75 处 / 50 个文件**(2026-10-24 现读)——把它们一次性升成 blocking 就是逼人 `--no-verify` 的恒红门(§12e),连带废掉全部守门。而且**逐处补 nowrap 是有害的**:本条规范的前提是"列宽 ≥ 读数单行需求",只补 nowrap 会把折行变成溢出压邻格(大屏实测 51px)。所以存量按 13.3 那把尺逐处量,不批量刷。

### 13.3 「够不够宽」必须真渲染,所以另有一把尺

「够不够宽」取决于**运行时值的长度**,静态判必出假红(实测:把 11px 的 unit 槽也算成复合读数,一次造出 24 枚假红)。所以分两层:

| 层 | 工具 | 判什么 | 挂哪 |
| --- | --- | --- | --- |
| 结构不变量 | `scripts/check-readout-no-break.mjs` | nowrap、常数同源、栏档与列档配套 | 提交链 blocking |
| 像素够不够 | `scripts/verify-wallboard-readout.mjs` | 离线渲染(真实构建 CSS + 自托管字体)逐格量折行与溢出像素 | 只读尺子,不进提交链也不进守护巡检 |

```bash
node scripts/verify-wallboard-readout.mjs --worktree --widths 1280,1440,1600,1920
node scripts/verify-wallboard-readout.mjs --worktree --widths 1440 --locale ja   # 五语言都要跑
```

**时长读数按语种取模板**(`durationDays` 渲染后填 d=365/h=23),不得写死中文形态——最初那个缺陷的成因就是「五语言最坏读数」,尺子只按中文量就等于没检验语言无关性。2026-10-24 实测:大屏 49 格在 zh-CN / zh-TW / en / ja / ko 五语言 × 1440 与 1920 两档下**实测量级零红**;仅 en 的 `999,999sessions`、ko 的 `99999.00위안` 等 1-2 格在保守上界下临界(英文/韩文 unit 词条比中文长),按下面第二条约束只报数。

读它输出时必须同时看三条诚实约束:

- **建模取自被审文件本身**(面板 class / 网格 class / 每格 label+value 表达式全解析),不接受手工清单——手工副本会与被审面漂移(本尺第一版就因此漏掉 wide 档);解析到的格数 ≠ 源码 `<StatCell` 枚数 ⇒ 直接 exit 2 拒绝判定。
- 读数最坏形态分两档:**[实]** = 生产现读量级、**[保]** = 保守上界(999,999 这类)。**只有 [实] 档放不下才定红**,[保] 档只报数——不能拿没发生的数据逼人改布局。
- 取不到 `.next/static/chunks/*.css`,或产物里没有 `whitespace-nowrap` 工具类 ⇒ 未判定,不冒绿。

**本条无行内豁免。** 需要更窄的格子请改用纯数字读数(先格式化,如 `365天23小时` → `365d`),而不是放宽下限——格式化是数据表达决策,断行不是。

### 13.4 端侧(RN / 共享源)是同一条约束

RN 没有 `white-space`,但等分 `flex: 1` 同样会把读数压到断行。正解同构:**父行 `flexWrap: 'wrap'` + 每格 `minWidth = 最坏读数的单行宽`** ⇒ 放不下就整格换行,数字始终完整。

已收口六处(三处在 `packages/app` 共享源,改一次 RN 全端愈;2026-10-24 第二批把 AST 尺跑出的 23 处全数收口):

| 位置 | 最坏读数 | minWidth |
| --- | --- | --- |
| `features/income/IncomeScreen.tsx` 汇总行 | `¥999999.99`(10 字符 @20px) | 112 |
| `features/usage/UsageScreen.tsx` 配额行 / 统计行 | `123.4万` / `$0.0000` | 96 |
| `features/dashboard/DashboardScreen.tsx` 读数卡 | 22px 整数 | 150 |
| `features/study-record`、`check-in`、`team`、`promote`、`invite`、`distribution`、`model-income` 七屏统计行 | 20-22px 金额 / 天数 / 计数 | 112 |
| `apps/mobile-rn/…/DistributionCompanyScreen.tsx` 统计行 | 24px `999,999.99` | 128 |
| `features/model-income` 汇总页脚 | 16-18px `999999.99` | 96 |

第三处原先靠 `numberOfLines={1}` 防断行 = **把断行换成省略号**,同样违反本条 ⇒ 已摘掉,改由 minWidth 兜。

**判据已经存在,不是"只能靠真机逐屏渲染"**:`scripts/check-rn-readout-cell.mjs` 用 TypeScript AST 判 JSX 父子关系,识别真三元组

```
<View style={ROW}>            ROW: flexDirection:'row'
  <View style={CELL}>         CELL: flex: 1
    <Text style={VAL}>…       VAL: fontSize ≥ 16 且 fontWeight 600/700
```

判定两条,缺一不可(这是"唯一写法"的两半,不是两个建议):

| 档 | 判什么 | 缺了的后果 |
| --- | --- | --- |
| V1 | 格必须有 `minWidth` | `flex: 1` 的 `flexBasis` 是 0 ⇒ 永远等分压缩,读数必折行 |
| V2 | 行必须有 `flexWrap: 'wrap'` | `minWidth` 生效后不换行 ⇒ 溢出压到邻居 / 出屏 |

**「有 flexWrap 就免疫」是错的**:没有 `minWidth` 时子项总宽永不超容器,`wrap` 一次都不触发。反过来只给 `minWidth` 也等于把折行换成溢出。这条是判据第一版的设计错误(把 wrap 当豁免条件),实测时被 23 处"全绿"暴露出来 —— 已改成两条并列判据,并在镜像测试里各配反向锁。

**等分格不是唯一的宿主。** 读数还可能住在三种非等分布局里,它们同样会被压折,判据补了三档(2026-10-24,现读命中 29 处):

| 档 | 宿主形态 | 判什么 | 为什么这样判 |
| --- | --- | --- | --- |
| V3 | `flexDirection:'row'` + `justifyContent:'space-between'` 且父级**不是** `flex:1` 格 | 读数 Text 自己带 `flexShrink: 0` 或 `minWidth` | 行内两个子项都没有 flex ⇒ 读数默认 `flexShrink: 1`,行宽不够时**先压读数**,标签反而完整 —— 正好压错了那一个 |
| V4 | 祖先里有 `position: 'absolute'` | 同上 | 容器宽度由内容决定但受父宽约束,同样靠 `flexShrink: 0` 兜 |
| V5 | 格是 `width: 'NN%'`(NN<100)或带 `flexBasis` | 格自己带 `minWidth` | `flexShrink` 是**纵向主轴**属性,对横向定宽**无效**;这类只能靠 `minWidth`,给它加 flexShrink 等于没加 |

V3 与 V1 的边界刻意写死"父级不是 `flex:1`":否则同一个等分格会被 V1 和 V3 双报,而修法只需要一套。

读数与文案的区分靠**属性名词表**,且词表只认标识符、不认字符串字面量:实测 `t('connectedAccounts.title')` 的 key 里有 `count`、`t('wallet.withdraw')` 有 `withdraw`、`t('pointHistory.title')` 有 `point`,不剥字符串就会把三个纯标题判成读数。判不出的形态进 `unjudged` 只报数,**不冒红也不算绿**(§0.3)。

锁:`scripts/tests/check-rn-readout-cell.test.mjs`(10 例,含 V2 / 「只加 wrap」/ 「i18n key 里的 count」/ 「item.title」四条反向锁 + 一条"真实仓库存量必须归零"的整族不变量)。守门 `check-rn-readout-cell.mjs`(241,blocking,射程 `packages/app` + `apps/mobile-rn` + `apps/miniapp-taro`,869 枚文件全解析)。

### 13.5 本条约束当前的覆盖边界(2026-10-24 现读,不是估计)

| 面 | 状态 | 数 |
| --- | --- | --- |
| 运维大屏 49 格 | 已逐格实测(五语言 × 1440/1920 两档,实测量级零红) | 49/49 |
| web 家族存量 | **已逐处算过最坏格宽**(2026-10-24,76 处):桌面档(1440/1920)**0 处会断**、仅窄档会断**0 处**;51 处四档全安全;余 25 处"文件内找不到网格"**已逐处人工追出真实归属** —— 22 处四档全安全,3 处真缺陷已修(见下条) | 76 处,0 待判 |
| 断点语义陷阱 | 本仓 `--breakpoint-sm` = **375px**(不是 Tailwind 默认的 640),`md`=428、`lg`=576 ⇒ `sm:grid-cols-5` 等于"手机就 5 列"。**格内有 ≥16px 读数的 8 处已全部收口**(2026-10-24):`ui-react/stat-card.tsx` 的 `STAT_GRID_COLS`(3/4 列档改 `tablet:`,一处治发布历史 / 发布监控 / 模型记录三页)、`agent-timeline`、`cost-dashboard`、`admin/ai-feed`、`agent-step-recorder`、`models/eval`、`publish/monitor/MonitorCard`(4 格指标改 `grid-cols-1 md:grid-cols-2`)、`admin/relay/insights`(无响应式 `grid-cols-3` 改 `grid-cols-1 tablet:grid-cols-3`)。剩余 `lg:grid-cols-3/4` 全在 `loading.tsx` 骨架屏与无读数的普通卡片上 | 8 处已修 |
| R8 形态盲区 | 跨行 className、`cn()` 多参数、内联 `style={{fontSize}}` 三类当前实测均为 0;但判据写的是「同一行字面量内」,将来出现新写法就看不见 | 0 / 0 / 0 |
| 表格单元格、列表行、tooltip、toast 里的数字 | **已定论:在正确布局下不产生本缺陷,不建门**。`Table` 原语是 `w-full` + **auto 布局**(无 `table-fixed`)+ 外层 `overflow-auto` ⇒ 列宽由内容决定:纯数字 / ID / 时间戳**没有断点,不会折行**;容器不够宽时浏览器先压缩**可断的文本列**(描述 / 标题折行是规范允许的),数字列被压到 min-content 就停止。会折的只剩含空格或中文单位的复合读数(`6天19小时`),这类在表格里极少且无法静态批量判。**因此不给 `TableCell` 盲加 `whitespace-nowrap`** —— 那会把描述列拉成千米长行,比折行更难看;`TableHead` 有 nowrap 而 `TableCell` 没有是**有意为之**(表头是短标签、单元格是内容)。`TooltipContent` 无 `max-w`/`truncate`,自动撑开;toast 宽度自适应且是瞬时提示(不是给人抄进故障单的读数)。判据覆盖面仍为 0,但原因是"该形态不产生该缺陷",不是"没来得及做" | 定论,不建门 |
| 端侧 UI 源文件 | **已有 AST 判据**(`check-rn-readout-cell.mjs`,869 枚全解析):等分读数格 **40 处** + 非等分宿主(V3/V4/V5)**29 处**,合计 69 处,缺口已于 2026-10-24 全数收口 ⇒ 现为 0。收口分三批:23 处首批等分格、3 处剥开 `satisfies` 后暴露的等分格、29 处非等分宿主(26 个唯一位置)。三类盲区现读:① `numberOfLines={1}` 共 336 处,其中 fs≥16 的 114 处里 **111 处是标题 / 名称,读数只有 1 处**(`TopupSuccessScreen.tsx:88`,fs16 且无粗体)⇒ 补判据的收益极低;② 非等分形态已由 V3/V4/V5 覆盖,仍不覆盖的是 `FlatList` 的 `numColumns`(由 V5 的 `width%` 间接兜);③ `minWidth` 共 50 个样式带值,逐格按"字号×字符数×0.55"核算后**只有 2 处轻微不足**(Distribution 112 vs 121、DistributionCompany 128 vs 132),已分别抬到 128 / 136 | 0 缺口 / 3 类盲区 |
| 尺子的 [实] 档 | 只有号池比例与流量 PV 两处按生产量级声明,其余落保守界 ⇒「实测量级零红」这句话的强度等于那张表 | 2 条 |

**端侧判据的第四类盲区(已修,留档)**:`StyleSheet.create({…} satisfies X)` 或逐条 `as ViewStyle` 会让实参不是 `ObjectLiteral` —— 判据采不到整张样式表,里面的读数格**静默算绿**。实测射程内 17 个 `satisfies` 包装,剥开后立刻暴露出 3 处真缺口(`EarningsStatisticsCard.tsx` 的 `dataRow/dataItem`)。这是"没判写成判过"的典型形态:门是绿的,但绿的原因是它没看见。镜像测试已加两条反向锁(`satisfies` 包装 / 单样式 `as` 断言)。

**要扩面就先补这张表,别把「已装门」当成「已覆盖」。**

### 13.6 升多列必须用本仓语义档(强制)

本仓断点被改过值:`sm=375 / md=428 / lg=576 / tablet=768 / tablet-lg=1024 / laptop=1280 / desktop=1440 / xl=1920`(现读 `packages/design-tokens/src/styles/tokens.css`)。
所以 `sm:grid-cols-5` 的实际含义是**手机 375px 就切 5 列** —— 每格只剩 ~38px,任何 20px 以上读数必被切成两半。

- 一格一读数的网格要升到 3 列以上,**必须用 `tablet:`(768)或 `laptop:`(1280)起跳**,不得用 `sm:`/`md:`/`lg:`;
- 拿不准就按「该档视口 ÷ 列数 ≥ 读数单行需求」现算(算式见 §13.1 那张表);
- 侧栏只在 ≥1024 占布局宽,窄视口它是抽屉 —— 算手机档可用宽时**不要减侧栏**(2026-10-24 本条尺子第一版无脑减 160,一次造出 27 枚假红)。

格内有读数的 8 处已于 2026-10-24 全部收口(`media-tasks` 手机档每格 38.2px 而读数需 77 是最严重的一处)。剩余 `lg:grid-cols-3/4` 全落在 `loading.tsx` 骨架屏与无大字号读数的普通卡片上 —— **不要**为了"清零写法"去改它们:那只是把 `sm:` 换成 `tablet:` 的机械替换,与读数断行无关,改了等于给后续读者制造假信号。

---

## 14. 新增页面 / 组件 checklist

新增页面或组件前,逐项确认:

- [ ] 页面 < 250 行,超长拆分组件
- [ ] 复用 `@ihui/ui-react` 组件,不重复造轮子
- [ ] 圆角用规范档位(§3),无 `rounded-full`/`9999px`/`50%`
- [ ] 中文字体 + 图标同行布局自动应用 `--text-vcenter-offset`(§4),非语义元素用 `<CenteredText>`
- [ ] 统计格子的读数整条单行(§13):列宽不足时减列/减栏,不折行、不截断、不缩字号
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
- [PACKAGES.md](./PACKAGES.md) — `@ihui/ui-react` / `@ihui/ui-native` 组件库
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
