# AGENT.md — AI Agent 协作规则（项目单一权威来源 · 必须先读再开工）

> ## ⛔ 强制前置指令（MUST-READ BEFORE ANY WORK · 红线）
>
> **任何 AI Agent（包括但不限于 Cursor / Cursor IDE、Trae / Trae Work CN、WorkBuddy / CodeBuddy、Copilot、Claude Code 等）在为本项目执行任何任务之前，必须完整读取本文件全部内容，并严格遵守其中每一条规范。**
>
> - **本文件是项目所有编码、设计、提交、自验规范的【单一权威来源】（Single Source of Truth）。**
> - 开始工作前：**先读完本文件，再动手；未读取即开工视为违规，违背即视为任务失败。**
> - 本文件已完整整合原 `client/.cursorrules` 全局主规则 与 `client/.cursor/rules/` 下全部 **23 个** `.mdc` 模块规则（见本文件「第三节·Cursor 规则完整整合」）。
> - 启动后无需再单独读取那些文件；本文件即为权威版，原文件保留仅作 Cursor 编辑器副本。
> - 既有硬约束（开发服务器管理、主题色、纯白/纯黑边框、AI 面板模式分离、端口、行尾、i18n、暗色模式、commit 留痕等）**依旧全部有效**，与本整合章节互补，不得互相覆盖或弱化。
> - **红线（❌）条款为不可协商的强制约束，违反即视为回归。**
> - **本文件无任何豁免条款**；如确有特殊情况，需由用户明确书面授权，并在最终汇报中记录豁免理由。

---

## 目录

- [第一节 · 铁律（最高优先级 · 必须先读）](#第一节--铁律最高优先级--必须先读)
- [第二节 · 铁律与自检速查表](#第二节--铁律与自检速查表)
- [第三节 · Cursor 规则完整整合（原 .cursorrules + 23 条 .mdc 单一事实来源）](#第三节--cursor-规则完整整合原-cursorrules--23-条-mdc-单一事实来源)
- [第四节 · 修订记录](#第四节--修订记录)
- [第五节 · 例外条款](#第五节--例外条款)

---

# 第一节 · 铁律（最高优先级 · 必须先读）

> 以下 4 条铁律是本项目 AI Agent 行为的【最高优先级】硬约束。任何 Agent 不得以任何理由（包括"时间紧"/"用户催"/"这是个小修改"）降低本节条款的强度。

---

## 🔒 铁律 #0：每次 AI 任务后必须立即 `git commit` 留痕

### 规则条文

**任何 AI Agent 在本仓库完成任何代码修改后，必须在退出任务前执行一次 `git commit` 留痕，不允许留下未提交的修改。**

### 适用范围

- 修改源代码（.vue / .ts / .js / .scss / .json / .py 等）
- 修改配置（.env / .gitignore / package.json / vite.config.ts 等）
- 修改文档（.md）
- 新建文件
- 删除文件

### 触发时机

每完成以下任一动作，**立即** commit，**不允许累积**：

| 场景 | 是否必须 commit |
|------|------------------|
| 完成一个功能的实现 | ✅ 必须 |
| 修复一个 bug | ✅ 必须 |
| 调整一段 UI 样式 | ✅ 必须 |
| 新增一个文件 | ✅ 必须 |
| 删除一个文件 | ✅ 必须 |
| 重构一个函数 | ✅ 必须 |
| 修改一个 i18n key | ✅ 必须 |
| 仅做了诊断/搜索/查询 | ❌ 不需要（无修改） |
| 修改后又回滚到原状 | ⚠️ 仍需 commit（记录尝试） |

### 提交命令模板

```bash
# 1. 检查状态
git status

# 2. 添加修改文件（指定具体文件，禁止 git add -A）
git add <file1> <file2> ...

# 3. 提交
git commit -m "<类型>(<模块>): <一句话说明>

- <关键变更点 1>
- <关键变更点 2>

Ref: <issue/需求来源>
"

# 4. 验证
git status  # 应显示 clean
```

### 提交信息规范

格式：`<类型>(<模块>): <一句话说明>`

类型：
- `feat` - 新功能
- `fix` - 修复 bug
- `refactor` - 重构（既不新增功能也不修复 bug）
- `style` - 仅样式调整
- `docs` - 文档变更
- `test` - 测试相关
- `chore` - 构建/工具/配置变更
- `wip` - 半成品（必须在 24 小时内 follow-up 完成）

### 禁止事项

❌ **禁止 `git add -A` 或 `git add .`** - 必须指定具体文件，避免误提交敏感文件（.env / 凭据 / 临时调试文件）
❌ **禁止 `--no-verify` 跳过 hooks** - 除非用户明确要求
❌ **禁止 `--amend` 修改已发布 commit** - 永远创建新 commit
❌ **禁止 `git reset --hard`** - 除非用户明确要求
❌ **禁止累积多个独立修改一起 commit** - 每个独立修改点单独 commit
❌ **禁止"先做完所有事，最后一起 commit"** - 边做边 commit

### 任务结束前自检清单

AI Agent 在每次回复结束、声明"任务完成"之前，**必须**执行：

```bash
# 1. 检查工作区状态
git status

# 2. 确认输出为：
#    nothing to commit, working tree clean
#    或
#    仅剩预期内的未追踪文件（如 .log / .tmp）

# 3. 如果有未提交修改 → 立即 commit 后再结束任务
```

如果未通过自检，**不能结束任务**。如果用户已经离开屏幕，**必须**自动 commit 留痕，并在最终汇报中说明。

---

## 🔒 铁律 #1：修改后必须实际验证

不要"看起来应该工作"就报告完成。**必须**：
- 改完前端代码后，**主动重启 Vite dev server** 并用浏览器访问确认效果
- 改完后端代码后，**主动重启服务**并 curl 验证
- 跑相关测试（单元测试 / e2e 测试）
- 用 lint / typecheck 验证语法

如果验证手段不可用，**必须**在汇报中明确说明"未验证"，不允许暗示"已通过"。

---

## 🔒 铁律 #2：失而复得 ≠ 没有发生

如果在工作中发现"之前做过的修改不见了"：
1. **不要**直接相信"我没做过"
2. **必须**执行 [深度搜索流程](G:\IHUI-AI\docs\recovery-playbook.md)：
   - 工作区 + `.git` 全量搜索
   - `git reflog` / `git fsck --unreachable` / `git stash list`
   - IDE 历史目录扫描（Trae CN / TRAE SOLO CN / VSCode）
   - 关键 SQLite 数据库（state.vscdb）查询
3. **不要**编造"恢复完成" - 找到就说找到，找不到就明确说"未找到，依据如下"
4. **不要**为了安抚用户而把过时 commit 包装成"已恢复"

---

## 🔒 铁律 #3：禁止跳过规则

> **"时间紧" / "用户催" / "这是个小修改" 永远不是跳过 commit 的理由。**

任何 Agent 都不允许以任何理由（包括"用户体验"、"加快速度"、"避免打扰"）跳过本文件的铁律。如果遇到无法 commit 的情况（如无 git 仓库 / 权限不足），**必须**：
1. 在最终汇报中明确说明
2. 把"无法 commit"本身作为任务失败的原因之一

---

# 第二节 · 铁律与自检速查表

## 📋 快速参考

| 场景 | 动作 |
|------|------|
| 完成任务 | 立即 `git add <file> && git commit` |
| 任务结束前 | `git status` 确认 clean |
| 发现代码丢失 | 走铁律 #2 深度搜索 |
| 用户催促 | **不**降低规则等级，照常 commit |
| 多个独立修改 | 每个独立 commit，不合并 |
| 修改了一半 | `wip: <说明>` commit，24 小时内 follow-up |
| 不知道要不要 commit | **commit**，留痕永远比丢了好 |

---

# 第三节 · Cursor 规则完整整合（原 .cursorrules + 23 条 .mdc 单一事实来源）

> 以下为本文件核心整合章节，**完整收录**：
> 1. 原 `client/.cursorrules` 全局主规则（已翻译整理）。
> 2. 原 `client/.cursor/rules/` 目录下 **23 条** `.mdc` 模块规则全文。
>
> AI 只需读取本文件即可获得全部规范；原始 Cursor 文件保留作编辑器副本，本文件为权威版。

---

## 3.1 全局主规则（原 `client/.cursorrules`）

```
You are an intelligent programming assistant.
ALWAYS respond in Simplified Chinese (简体中文).
```

### 3.1.1 开发服务器管理规则

**自动启动开发服务器：**
- 当用户要求"打开页面"、"启动"、"运行"或类似请求时，**立即自动启动开发服务器**，不要询问用户是否要启动
- 使用 `npm run dev` 或项目配置的启动命令在后台启动开发服务器
- 不要询问"是否需要启动服务器"、"服务器是否在运行"等问题
- 直接执行启动操作，然后告知用户服务器已启动

**检查服务器状态：**
- 如果需要检查服务器是否运行，静默检查，不要询问用户
- 如果服务器未运行，直接启动；如果已运行，继续后续操作

**页面打开：**
- 启动服务器后，自动在浏览器中打开相关页面（如果可能）
- 提供正确的本地 URL（通常是 http://localhost:端口号 或 http://127.0.0.1:端口号）

### 3.1.2 扁平化设计规范（强制遵守）

**本项目采用扁平化设计，严格禁止以下视觉效果：**

1. **文本投影（Text Shadow）**
   - ❌ **绝对禁止**使用 `text-shadow` 属性
   - ✅ 使用高对比度颜色确保文本可读性
   - ✅ 通过调整字体粗细和颜色来增强视觉层次
   - 全局样式已强制移除所有文本投影，任何新增代码不得添加

2. **盒阴影（Box Shadow）**
   - ❌ 禁止使用 `box-shadow` 创建深度效果
   - ✅ 使用边框（border）来分隔元素
   - ✅ 使用背景色变化来区分状态

3. **代码生成规则：**
   - 生成任何 CSS/SCSS 代码时，**永远不要添加 `text-shadow`**
   - 生成任何 CSS/SCSS 代码时，**永远不要添加不必要的 `box-shadow`**
   - 使用边框而非阴影来分隔元素
   - 使用颜色对比而非阴影来创建层次

**检查清单（生成代码后必须验证）：**
- [ ] 没有使用 `text-shadow`
- [ ] 没有使用不必要的 `box-shadow`
- [ ] 使用边框而非阴影来分隔元素
- [ ] 颜色对比度符合可访问性标准

### 3.1.3 CSS 优先级规范（强制遵守）

**硬性规定：不允许使用 `!important`，不允许使用高特异性选择器。** 违反会导致后续修改、调整、维护时样式难以覆盖，修改不生效。

1. **禁止 `!important`**
   - ❌ 任何 CSS/SCSS 中**不得**使用 `!important`
   - ✅ 需要覆盖时：用更具体但**单一职责**的类名、或调整样式加载顺序、或使用 CSS Layer 控制优先级
   - ✅ 覆盖第三方/组件库：在全局样式中用**一层**类名包裹（如 `.page-container .el-input`），避免长链与多重类名堆叠

2. **禁止高特异性选择器**
   - ❌ **不得**通过「堆叠类名」提高特异性（如 `.foo.foo`、`.a .b .c .d` 长链）
   - ❌ **不得**为覆盖而写 `html.dark body .page .section .component` 等长链（应用 `:where()` 包裹前缀以降特异性）
   - ✅ 单条选择器尽量保持「一个类或 1～2 层关系」（如 `.block__element`、`.parent .child`）
   - ✅ 需要覆盖时：用 `:where()` 降低上游特异性，或使用 CSS Layer 把「基础样式」放在低优先级层

3. **推荐做法**
   - 组件内：使用 BEM 或单一类名，不写 `!important`，不写超过 2 层深度的选择器
   - 全局覆盖：用 CSS 变量统一颜色/尺寸，或单独一个「覆盖层」文件，用 Layer 控制顺序
   - 第三方覆盖：尽量只改 CSS 变量；若必须改类，用 `.wrapper .third-party-class` 一层包裹即可

**检查清单（写样式后必须自检）：**
- [ ] 没有使用 `!important`
- [ ] 没有 `.class.class` 或超过 2 层深度的长链选择器
- [ ] 覆盖样式优先用变量或 Layer，而非加更多类名/更长的选择器

---

## 3.2 模块化规则全集（原 `client/.cursor/rules/*.mdc` · 共 23 条）

> 每条规则标注其**作用域**：匹配文件（globs）与是否常驻生效（alwaysApply）。
> `alwaysApply: true` 表示对所有文件全局常驻；`false` 表示仅在匹配到对应文件类型时生效。

---

### 规则 1：`api-development.mdc`

> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`["**/api/**/*.ts", "**/services/**/*.ts"]` · 说明：API 接口开发自动规则

#### API 函数结构（强制）

```typescript
import request from '@/utils/request'

// 1. 类型定义
interface GetUserListParams {
  page?: number
  pageSize?: number
  keyword?: string
}

interface User {
  id: number
  name: string
  email: string
}

interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// 2. API 函数
/**
 * 获取用户列表
 * @param params 查询参数
 * @returns 分页用户数据
 */
export const getUserList = (params?: GetUserListParams) => {
  return request<PaginatedResponse<User>>({
    url: '/api/users',
    method: 'GET',
    params,
  })
}

/**
 * 创建用户
 * @param data 用户数据
 * @returns 创建的用户
 */
export const createUser = (data: Omit<User, 'id'>) => {
  return request<User>(({
    url: '/api/users',
    method: 'POST',
    data,
  })
}
```

#### 自动执行

1. **类型定义** - 为所有 API 添加请求/响应类型
2. **JSDoc 注释** - 添加函数说明、参数说明、返回值说明
3. **错误处理** - 确保使用统一的 request 封装
4. **命名规范** - get/create/update/delete + 资源名

#### RESTful 规范

| 操作 | 方法 | 路径 | 函数名 |
|------|------|------|--------|
| 查询列表 | GET | /api/users | getUserList |
| 查询详情 | GET | /api/users/:id | getUserById |
| 创建 | POST | /api/users | createUser |
| 更新 | PUT | /api/users/:id | updateUser |
| 删除 | DELETE | /api/users/:id | deleteUser |

---

### 规则 2：`auto-lint-fix.mdc`

> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`["**/*.ts", "**/*.tsx", "**/*.vue", "**/*.js", "**/*.jsx"]` · 说明：自动 Lint 检查修复规则

**每次修改代码文件后，我必须自动检查并修复 linter 错误。**

#### 自动执行流程

```
修改文件 → ReadLints 检查 → 发现错误 → 自动修复 → 再次检查 → 循环直到无错误
```

#### 检查步骤

##### 1. 使用 ReadLints 工具

```
每次修改 .ts/.tsx/.vue/.js/.jsx 文件后
立即调用 ReadLints 工具检查该文件
```

##### 2. 错误分类处理

| 错误类型 | 处理方式 |
|----------|----------|
| TypeScript 类型错误 | 修复类型定义 |
| ESLint 规则违反 | 按规则修复代码 |
| 未使用的变量 | 删除或添加使用 |
| 缺少导入 | 添加导入语句 |
| 格式错误 | 修复格式 |

##### 3. 常见错误自动修复

```typescript
// ❌ 错误：'xxx' is defined but never used
const unused = 'value' // 删除此行

// ❌ 错误：Type 'string' is not assignable to type 'number'
const num: number = '123' // 修复类型

// ❌ 错误：Cannot find module 'xxx'
// 添加导入语句
import xxx from 'xxx'

// ❌ 错误：Expected 2 arguments, but got 1
fn(a) // 添加缺失参数
fn(a, undefined)

// ❌ 错误：Object is possibly 'undefined'
obj.prop // 添加可选链
obj?.prop
```

##### 4. 修复后重新检查

```
修复完成后必须再次运行 ReadLints
确保所有错误都已修复
如果还有错误，继续修复
```

#### 禁止行为

- ❌ **禁止**修改代码后不检查 linter
- ❌ **禁止**忽略 linter 错误
- ❌ **禁止**让用户自己修复 linter 错误
- ❌ **禁止**在有 linter 错误的情况下说"完成"

#### 自动执行声明

**我承诺在每次修改代码后自动运行 ReadLints 检查，发现错误自动修复，直到文件无 linter 错误。**

---

### 规则 3：`auto-verify-fix.mdc`

> **作用域**：常驻生效（alwaysApply=true） · 匹配文件：`[]` · 说明：自动测试验证修复规则（核心规则）

**这是核心规则，我在每次代码修改后必须自动执行。**

#### 核心原则

**每次修改代码后，我必须自己验证修改是否生效，发现问题必须自动修复，直到完全解决后才告知用户。**

#### 强制工作流程

```
修改代码 → 检查 Linter → Playwright 验证 → 发现问题 → 自动修复 → 再次验证 → 循环直到成功 → 告知用户
```

##### 第一步：修改代码
- 根据用户需求修改代码

##### 第二步：检查 Linter 错误
```bash
# 使用 ReadLints 工具检查修改的文件
# 如果有 linter 错误，立即修复
```

##### 第三步：Playwright 验证

```javascript
// 1. 打开浏览器访问页面
browser_navigate({ url: 'http://localhost:5173/目标路径' })

// 2. 等待页面加载
browser_wait({ time: 2 })

// 3. 获取页面快照
browser_snapshot()

// 4. 验证样式修改
const styles = await page.locator('.target-element').evaluate(el => {
  const computed = window.getComputedStyle(el)
  return {
    backgroundColor: computed.backgroundColor,
    color: computed.color,
    // 其他需要验证的属性
  }
})

// 5. 验证功能修改
await page.click('.button')
// 检查预期结果

// 6. 截图记录
browser_screenshot()
```

##### 第四步：问题修复循环

```
如果验证失败:
  1. 分析失败原因（HMR 问题？缓存？代码错误？）
  2. 自动修复问题
  3. 返回第二步重新验证
  4. 重复直到成功
```

##### 第五步：确认成功后告知用户

只有在以下条件全部满足后才能告知用户：
- ✅ Linter 无错误
- ✅ Playwright 验证通过
- ✅ 功能符合预期
- ✅ 截图确认效果

#### 特别注意场景

以下场景 HMR 可能不会正确更新，需要特别处理：

| 场景 | 处理方式 |
|------|----------|
| CSS/样式修改 | 可能需要硬刷新验证 |
| `:global()` 选择器 | 检查样式是否生效 |
| Teleport 组件样式 | 验证目标位置样式 |
| SCSS 复杂嵌套 | 检查编译结果 |
| 环境变量修改 | 需要重启服务器 |
| 配置文件修改 | 需要重启服务器 |

#### 严格禁止

- ❌ **禁止**修改代码后直接告诉用户"刷新页面查看效果"
- ❌ **禁止**让用户当测试人员
- ❌ **禁止**假设"代码修改 = 生效"
- ❌ **禁止**在没有验证前就说"已完成修改"
- ❌ **禁止**让用户自己测试或验证
- ❌ **禁止**给用户布置验证任务
- ❌ **禁止**发现问题后询问"是否需要继续修复"，必须自动修复
- ❌ **禁止**中途停下来询问用户，发现问题就要彻底解决

#### 验证类型

##### 1. 样式验证
```javascript
// 获取计算样式
const style = await page.locator('.element').evaluate(el => {
  const s = window.getComputedStyle(el)
  return {
    display: s.display,
    color: s.color,
    backgroundColor: s.backgroundColor,
    fontSize: s.fontSize,
    padding: s.padding,
    margin: s.margin,
  }
})
// 对比期望值
```

##### 2. 功能验证
```javascript
// 点击按钮
await page.click('.submit-btn')

// 等待响应
await page.waitForSelector('.success-message')

// 验证结果
const text = await page.textContent('.result')
expect(text).toContain('预期文本')
```

##### 3. 表单验证
```javascript
// 填写表单
await page.fill('input[name="username"]', 'testuser')
await page.fill('input[name="password"]', 'password123')
await page.click('button[type="submit"]')

// 验证提交结果
await page.waitForNavigation()
```

##### 4. API 验证
```javascript
// 监听网络请求
const response = await page.waitForResponse('/api/endpoint')
const data = await response.json()
expect(data.code).toBe(200)
```

#### 错误处理

当验证失败时，按以下顺序排查：

1. **检查控制台错误** - `browser_console` 查看错误日志
2. **检查网络请求** - 确认 API 是否正常
3. **检查元素存在** - 确认 DOM 结构正确
4. **检查样式计算** - 确认 CSS 生效
5. **HMR 问题** - 尝试硬刷新
6. **缓存问题** - 清理缓存重试

#### 自动执行声明

**我承诺在每次代码修改后自动执行以上验证流程，绝不跳过验证步骤，发现问题自动修复直到完全解决。**

---

### 规则 4：`browser-testing.mdc`

> **作用域**：常驻生效（alwaysApply=true） · 匹配文件：`[]` · 说明：Cursor 内置浏览器自动测试规则

**修改前端代码后，必须使用 Cursor 内置浏览器（cursor-ide-browser MCP）自动验证效果。**

#### 重要：禁止使用外部浏览器

- ❌ **禁止** 打开外部 Chrome/Firefox/Edge 等浏览器进行测试
- ❌ **禁止** 让用户手动打开浏览器查看效果
- ✅ **必须** 使用 Cursor 内置浏览器 (cursor-ide-browser MCP)
- ✅ **必须** 自动验证修改效果，不通过不告知用户完成

#### MCP 浏览器工具使用

##### 正确的工作流程（必须遵守）

```
1. browser_navigate → 打开页面
2. browser_lock → 锁定浏览器（如果需要交互）
3. browser_snapshot → 获取页面结构和元素引用
4. 交互操作（click/fill/hover 等）
5. browser_snapshot → 验证结果
6. browser_unlock → 解锁浏览器（完成所有操作后）
```

##### 关键规则

1. **browser_lock 必须在 browser_navigate 之后** - 不能在没有页面的情况下锁定
2. **browser_snapshot 必须在任何交互之前** - 获取元素引用
3. **browser_unlock 必须在完成所有操作后** - 释放浏览器控制
4. **短时等待策略** - 使用 1-3 秒的短等待，配合 snapshot 检查，而不是一次长等待

##### 1. 导航到页面

```javascript
// 打开目标页面
browser_navigate({ url: 'http://localhost:5173/path' })
```

##### 2. 锁定浏览器（交互前）

```javascript
// 锁定浏览器以进行交互
browser_lock()
```

##### 3. 获取页面快照

```javascript
// 获取当前页面结构和元素引用
browser_snapshot()
```

##### 4. 等待页面加载

```javascript
// 短时等待（推荐 1-3 秒）
browser_wait({ time: 2 })

// 然后用 snapshot 检查是否就绪
browser_snapshot()
```

##### 5. 交互操作

```javascript
// 点击元素（使用 snapshot 中的 ref）
browser_click({ ref: 'element-ref' })

// 输入文本（append 模式）
browser_type({ ref: 'input-ref', text: 'test text' })

// 清空并输入（replace 模式）
browser_fill({ ref: 'input-ref', value: 'new value' })

// 悬停
browser_hover({ ref: 'element-ref' })

// 滚动
browser_scroll({ ref: 'element-ref', scrollIntoView: true })
```

##### 6. 截图验证

```javascript
// 截取页面截图
browser_screenshot()
```

##### 7. 检查控制台

```javascript
// 检查控制台错误
browser_console()
```

##### 8. 解锁浏览器（完成后）

```javascript
// 完成所有操作后解锁
browser_unlock()
```

#### 验证流程

##### UI/样式修改验证

```
1. browser_navigate → 打开页面
2. browser_wait({ time: 2 }) → 等待加载
3. browser_snapshot → 查看元素
4. browser_screenshot → 截图确认
5. 对比期望效果
6. 不符合 → 修改代码 → 重新验证
```

##### 交互功能验证

```
1. browser_navigate → 打开页面
2. browser_lock → 锁定浏览器
3. browser_snapshot → 获取元素引用
4. browser_click/fill → 执行交互
5. browser_wait({ time: 1 }) → 短暂等待
6. browser_snapshot → 检查结果
7. browser_console → 检查错误
8. browser_unlock → 解锁浏览器
9. 不符合 → 修改代码 → 重新验证
```

##### 表单提交验证

```
1. browser_navigate → 打开表单页面
2. browser_lock → 锁定浏览器
3. browser_snapshot → 获取表单元素
4. browser_fill → 填写表单字段
5. browser_click → 点击提交
6. browser_wait({ time: 2 }) → 等待提交结果
7. browser_snapshot → 验证成功/失败提示
8. browser_unlock → 解锁浏览器
9. 不符合 → 修改代码 → 重新验证
```

#### 常见验证场景

##### 样式验证

```javascript
// 通过截图验证样式
browser_navigate({ url: 'http://localhost:5173/target-page' })
browser_wait({ time: 2 })
browser_screenshot()

// 通过 snapshot 查看元素属性
browser_snapshot()
// 检查元素是否有正确的 class
```

##### 显示/隐藏验证

```javascript
// 锁定浏览器
browser_lock()

// 获取元素引用
browser_snapshot()

// 执行操作
browser_click({ ref: 'toggle-button' })

// 等待动画
browser_wait({ time: 0.5 })

// 检查元素是否显示/隐藏
browser_snapshot()

// 完成后解锁
browser_unlock()
```

##### 路由跳转验证

```javascript
// 锁定浏览器
browser_lock()

// 获取链接引用
browser_snapshot()

// 点击链接
browser_click({ ref: 'nav-link' })

// 等待跳转
browser_wait({ time: 1 })

// 验证 URL 和页面内容
browser_snapshot()

// 完成后解锁
browser_unlock()
```

##### 错误处理验证

```javascript
// 锁定浏览器
browser_lock()

// 获取按钮引用
browser_snapshot()

// 触发错误场景
browser_click({ ref: 'submit-button' })

// 等待错误提示
browser_wait({ time: 1 })

// 检查错误提示
browser_snapshot()

// 完成后解锁
browser_unlock()
```

#### 验证检查清单

每次前端代码修改后，确认以下内容：

- [ ] 使用 Cursor 内置浏览器（cursor-ide-browser MCP）
- [ ] 页面无 JS 错误（browser_console）
- [ ] 元素正确渲染（browser_snapshot）
- [ ] 样式符合预期（browser_screenshot）
- [ ] 交互功能正常（browser_click/fill）
- [ ] 响应式布局正确（可选）

#### 自动执行声明

**我承诺在每次修改前端代码后：**
1. **只使用 Cursor 内置浏览器进行测试，不打开外部浏览器**
2. **自动验证修改效果，不通过不告知用户完成**
3. **遵循正确的 lock/unlock 工作流程**

---

### 规则 5：`code-review.mdc`

> **作用域**：常驻生效（alwaysApply=true） · 匹配文件：`[]` · 说明：代码审查自动规则

在编写或修改代码时，我会自动进行代码审查：

#### 审查维度（自动检查）

##### 1. 代码质量

- **命名规范** - 变量/函数/类名是否清晰有意义
- **代码结构** - 是否遵循单一职责原则
- **重复代码** - 是否有可以抽取的重复逻辑
- **注释完整** - 关键逻辑是否有注释

##### 2. 类型安全

- **显式类型** - 是否有 any 类型需要替换
- **空值处理** - 是否正确处理 null/undefined
- **类型收窄** - 是否使用类型守卫

##### 3. 性能考虑

- **避免重渲染** - Vue 组件是否正确使用 computed
- **内存泄漏** - 是否清理定时器/事件监听
- **大数据处理** - 列表是否使用虚拟滚动

##### 4. 安全性

- **XSS 防护** - 是否安全使用 v-html
- **敏感信息** - 是否暴露密钥或密码
- **输入验证** - 用户输入是否经过验证

##### 5. 可维护性

- **代码可读** - 逻辑是否容易理解
- **错误处理** - 是否有完善的错误处理
- **边界条件** - 是否考虑边界情况

#### 自动执行流程

每次代码修改后，我会自动：

1. **静态检查** - 检查 linter 错误
2. **类型检查** - 确保类型正确
3. **逻辑审查** - 检查潜在问题
4. **优化建议** - 提供改进建议
5. **安全扫描** - 检查安全隐患

#### 问题等级

| 等级 | 标识 | 说明 |
|------|------|------|
| 必须修复 | 🔴 | 严重问题，必须修复后才能提交 |
| 建议修复 | 🟡 | 潜在问题，建议修复 |
| 可选优化 | 🟢 | 优化建议，可以考虑 |

#### 审查输出格式

```
## 代码审查结果

### 🔴 必须修复
1. [文件:行号] 问题描述
   建议：修复方案

### 🟡 建议修复
1. [文件:行号] 问题描述
   建议：修复方案

### 🟢 优化建议
1. [文件:行号] 优化点
   建议：优化方案

### ✅ 优点
- 代码中做得好的地方
```

---

### 规则 6：`composables.mdc`

> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`["**/composables/**/*.ts", "**/hooks/**/*.ts"]` · 说明：Composables 开发自动规则

#### Composable 结构（强制）

```typescript
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { Ref, MaybeRef } from 'vue'

/**
 * useXxx - 功能描述
 * @param options 配置选项
 * @returns 返回值说明
 * @example
 * ```ts
 * const { data, loading, execute } = useXxx({ immediate: true })
 * ```
 */
export function useXxx(options: UseXxxOptions = {}) {
  // ============ 配置解构 ============
  const {
    immediate = true,
    onSuccess,
    onError,
  } = options

  // ============ 响应式状态 ============
  const data = ref<DataType | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  // ============ 计算属性 ============
  const isReady = computed(() => data.value !== null && !loading.value)
  const hasError = computed(() => error.value !== null)

  // ============ 核心方法 ============
  const execute = async () => {
    loading.value = true
    error.value = null
    
    try {
      const result = await fetchData()
      data.value = result
      onSuccess?.(result)
      return result
    } catch (e) {
      const err = e as Error
      error.value = err
      onError?.(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const reset = () => {
    data.value = null
    loading.value = false
    error.value = null
  }

  // ============ 生命周期 ============
  onMounted(() => {
    if (immediate) {
      execute()
    }
  })

  onUnmounted(() => {
    // 清理逻辑（取消请求、清除定时器等）
  })

  // ============ 返回 ============
  return {
    // 状态
    data,
    loading,
    error,
    // 计算属性
    isReady,
    hasError,
    // 方法
    execute,
    reset,
  }
}

// ============ 类型定义 ============
export interface UseXxxOptions {
  /** 是否立即执行 */
  immediate?: boolean
  /** 成功回调 */
  onSuccess?: (data: DataType) => void
  /** 错误回调 */
  onError?: (error: Error) => void
}

export type UseXxxReturn = ReturnType<typeof useXxx>
```

#### 自动执行

1. **命名规范** - 函数名以 `use` 开头
2. **参数类型** - 使用 Options 对象模式
3. **返回类型** - 返回对象包含状态和方法
4. **生命周期** - 正确处理 mounted/unmounted
5. **清理逻辑** - 在 unmounted 中清理副作用
6. **JSDoc** - 提供完整的文档注释
7. **导出类型** - 导出 Options 和 Return 类型

---

### 规则 7：`continuous-fix.mdc`

> **作用域**：常驻生效（alwaysApply=true） · 匹配文件：`[]` · 说明：持续修复直到完成规则

**发现任何问题都必须持续修复，直到完全解决，中途不停下询问用户。**

#### 核心原则

```
发现问题 → 分析原因 → 修复问题 → 验证修复 → 还有问题？→ 继续修复 → 完全解决 → 告知用户
```

#### 持续修复场景

##### 1. 代码错误
```
发现错误 → 修复 → 检查是否引入新错误 → 修复新错误 → 直到无错误
```

##### 2. 功能不符预期
```
功能不对 → 分析原因 → 修改代码 → 验证功能 → 不对继续改 → 直到正确
```

##### 3. 样式不正确
```
样式不对 → 检查 CSS → 修改样式 → 验证效果 → 不对继续改 → 直到正确
```

##### 4. 测试失败
```
测试失败 → 分析失败原因 → 修复代码 → 重新测试 → 失败继续改 → 直到通过
```

##### 5. 构建失败
```
构建失败 → 查看错误日志 → 修复问题 → 重新构建 → 失败继续改 → 直到成功
```

#### 修复策略

##### 第一次尝试
- 根据错误信息直接修复

##### 第二次尝试
- 如果第一次失败，深入分析根本原因
- 可能需要查看更多上下文代码

##### 第三次尝试
- 如果仍然失败，考虑替代方案
- 可能需要重构相关代码

##### 第四次及以后
- 系统性地排查所有可能原因
- 逐一验证排除

#### 禁止行为

- ❌ **禁止**发现问题后询问"是否需要继续修复"
- ❌ **禁止**说"这个问题比较复杂，需要您..."
- ❌ **禁止**中途停下来等待用户指示
- ❌ **禁止**在问题未完全解决时说"完成"
- ❌ **禁止**把未解决的问题留给用户
- ❌ **禁止**说"您可以尝试..."而不是自己去做

#### 正确的做法

- ✅ 发现问题立即着手修复
- ✅ 修复失败尝试其他方案
- ✅ 验证失败继续调试
- ✅ 记录尝试过的方案（内部记录，不需告知用户）
- ✅ 完全解决后才告知用户结果

#### 例外情况

只有以下情况可以向用户确认：

1. **需要用户提供信息**
   - 缺少必要的业务需求信息
   - 需要用户做出设计决策

2. **涉及破坏性操作**
   - 需要删除重要数据
   - 需要回滚大量代码

3. **超出技术能力**
   - 需要访问我无法访问的系统
   - 需要物理操作（如重启电脑）

#### 自动执行声明

**我承诺在发现任何问题后持续修复，不中途停下询问，直到问题完全解决后才告知用户结果。**

---

### 规则 8：`css-styles.mdc`

> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`["**/*.css", "**/*.scss", "**/*.less", "**/*.vue"]` · 说明：CSS/SCSS 样式自动规则

#### 样式覆盖策略（强制）

##### ✅ 使用高特异性选择器和 CSS 变量

1. **增加选择器特异性**
```css
/* 使用更精确的选择器链 */
.dialog-wrapper .footer .button {
  background-color: #000;
}
```

2. **使用 :deep() 穿透**
```vue
<style scoped>
.dialog-wrapper :deep(.el-button) {
  background-color: #000;
}
</style>
```

3. **使用属性选择器**
```css
.button[type="primary"] {
  background-color: #000;
}
```

4. **使用 ID 选择器（谨慎）**
```css
#main-dialog .button {
  background-color: #000;
}
```

#### 样式组织（强制）

```scss
.component {
  // 1. 布局属性
  display: flex;
  flex-direction: column;
  
  // 2. 盒模型
  width: 100%;
  padding: 16px;
  margin: 0;
  
  // 3. 视觉样式
  background-color: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  
  // 4. 文字样式
  font-size: 14px;
  color: #333;
  
  // 5. 其他
  cursor: pointer;
  transition: all 0.3s ease;
  
  // 6. 伪类
  &:hover {
    background-color: #f5f5f5;
  }
  
  // 7. 子元素
  &__title {
    font-weight: bold;
  }
  
  &__content {
    flex: 1;
  }
}
```

#### 响应式规范

```scss
.component {
  padding: 16px;
  
  // 移动优先，从小到大
  @media (min-width: 768px) {
    padding: 24px;
  }
  
  @media (min-width: 1024px) {
    padding: 32px;
  }
}
```

#### 自动执行

1. 优化选择器特异性
2. 规范化属性顺序
3. 添加响应式断点
4. 使用 CSS 变量实现样式定制

---

### 规则 9：`design-language.mdc`

> **作用域**：常驻生效（alwaysApply=true） · 匹配文件：`["**/*.vue", "**/*.scss", "**/*.css"]` · 说明：项目高级设计语言与审美规范 (Premium AI UI)

为了确保 iHui AI 平台拥有国际顶尖 AI 产品（如 Linear, Vercel, Claude）的质感，所有 UI 开发必须遵循以下进阶准则：

#### 1. 深度与空间 (Depth & Space)
- **空气感 (Breathability)**：大幅增加留白。不要把内容塞满，利用空间引导视觉重心。
- **分层设计 (Layering)**：
  - 底层背景：亮色 `#FFFFFF` / 暗色 `#000000`。
  - 浮层容器：亮色 `#FAFAFA` 或带极低透明度的玻璃材质。
  - 极细描边：统一使用 `1px` 实线，亮色 `#EAEAEA`，暗色 `#1F1F1F`。不要使用默认的粗边框。

#### 2. 精密色彩 (Industrial Palette)
- **非绝对黑白**：避免使用完全刺眼的黑白对比。
  - 文字主色：`#111111` (亮) / `#EDEDED` (暗)。
  - 文字次色：`#666666` (亮) / `#A1A1A1` (暗)。
  - 禁用/辅助色：`#888888`。
- **中性灰度**：利用 50 到 900 的灰度阶梯营造精密感，而非使用彩色。

#### 3. 字体与排版 (Typography)
- **字体层级**：标题采用 `Font-Weight: 600` 或 `800`，正文 `400`。
- **字间距 (Tracking)**：大标题适当收缩 `-0.02em` 增加力度感；正文和短标签增加 `0.01em` 增加易读性。
- **等宽元素**：代码、数字、角标优先使用 `Monospace` 字体，体现"工业、精密"属性。

#### 4. 动态逻辑 (Motion Logic)
- **物理特性**：所有动效必须符合物理直觉。
  - 进入：`Cubic Bezier (0.4, 0, 0.2, 1)`。
  - 悬停：禁止生硬的颜色跳变。使用背景色淡入、描边加深或极轻微的 `Scale (1.02)`。
- **微光效果 (Glow)**：关键元素悬停时可带有极淡的径向发光效果。

#### 5. 组件细节 (Component Nuance)
- **圆角规范**：
  - 超大容器：`24px` 或 `32px`。
  - 标准组件：`12px`。
  - 标签/小按钮：`6px` 或 `8px`。
- **禁止项**：
  - ❌ 禁止使用 Element Plus 默认的深蓝颜色。
  - ❌ 禁止使用多重阴影或厚重的 Drop Shadow。
  - ❌ 禁止使用非对齐的布局。

#### 6. 自动审计
- 检查色彩是否符合"精密灰度"体系。
- 检查描边是否足够细腻。
- 确保交互响应时间在 `150ms` 以内。

---

### 规则 10：`documentation.mdc`

> **作用域**：常驻生效（alwaysApply=true） · 匹配文件：`[]` · 说明：文档注释自动规则

在编写代码时，我会自动添加完善的文档注释：

#### 函数/方法注释

```typescript
/**
 * 获取用户信息
 * 
 * @description 根据用户 ID 从服务器获取用户详细信息
 * @param id - 用户唯一标识符
 * @param options - 可选配置
 * @param options.includeProfile - 是否包含用户资料
 * @param options.includeSettings - 是否包含用户设置
 * @returns 用户信息对象
 * @throws {NotFoundError} 当用户不存在时抛出
 * @throws {UnauthorizedError} 当无权限访问时抛出
 * 
 * @example
 * ```typescript
 * // 基础使用
 * const user = await getUser(123)
 * 
 * // 包含额外信息
 * const userWithProfile = await getUser(123, { 
 *   includeProfile: true 
 * })
 * ```
 */
async function getUser(
  id: number, 
  options?: GetUserOptions
): Promise<User> {
  // ...
}
```

#### Vue 组件注释

```vue
<script setup lang="ts">
/**
 * 用户卡片组件
 * 
 * @description 展示用户基本信息的卡片组件，支持编辑和删除操作
 * @example
 * ```vue
 * <UserCard 
 *   :user="userData"
 *   :editable="true"
 *   @edit="handleEdit"
 *   @delete="handleDelete"
 * />
 * ```
 */

// Props 定义
interface Props {
  /** 用户数据对象 */
  user: User
  /** 是否显示编辑按钮 */
  editable?: boolean
  /** 是否显示删除按钮 */
  deletable?: boolean
  /** 加载状态 */
  loading?: boolean
}

// Events 定义
/**
 * @event edit - 点击编辑按钮时触发
 * @event delete - 点击删除按钮时触发
 * @event click - 点击卡片时触发
 */
const emit = defineEmits<{
  /** 编辑事件，返回用户对象 */
  (e: 'edit', user: User): void
  /** 删除事件，返回用户 ID */
  (e: 'delete', id: number): void
  /** 点击事件 */
  (e: 'click'): void
}>()
</script>
```

#### 类型/接口注释

```typescript
/**
 * 用户信息接口
 * @interface User
 */
interface User {
  /** 用户唯一标识符 */
  id: number
  /** 用户名（2-20字符） */
  username: string
  /** 邮箱地址 */
  email: string
  /** 用户状态 */
  status: 'active' | 'inactive' | 'banned'
  /** 创建时间 (ISO 8601) */
  createdAt: string
  /** 用户资料（可选） */
  profile?: UserProfile
}

/**
 * API 响应包装类型
 * @template T - 响应数据类型
 */
interface ApiResponse<T> {
  /** 状态码 */
  code: number
  /** 提示信息 */
  message: string
  /** 响应数据 */
  data: T
}
```

#### 自动执行

我会自动为以下内容添加注释：

1. **公共函数** - 完整的 JSDoc 注释
2. **组件** - 组件说明、Props、Events、Slots
3. **接口/类型** - 字段说明
4. **复杂逻辑** - 行内注释说明
5. **API** - 请求说明、参数、返回值
6. **常量** - 用途说明

---

### 规则 11：`error-handling.mdc`

> **作用域**：常驻生效（alwaysApply=true） · 匹配文件：`[]` · 说明：错误处理自动规则

在编写代码时，我会自动添加完善的错误处理：

#### 异步操作（强制）

```typescript
// ✅ 标准的异步错误处理
const fetchData = async () => {
  loading.value = true
  error.value = null
  
  try {
    const response = await api.getData()
    data.value = response.data
    return response.data
  } catch (e) {
    const err = e as Error
    error.value = err.message
    
    // 根据错误类型处理
    if (isAxiosError(e)) {
      handleHttpError(e)
    } else if (e instanceof TypeError) {
      console.error('类型错误:', e)
    } else {
      console.error('未知错误:', e)
    }
    
    throw e // 允许上层继续处理
  } finally {
    loading.value = false
  }
}

// HTTP 错误处理
const handleHttpError = (error: AxiosError) => {
  const status = error.response?.status
  
  switch (status) {
    case 401:
      // 未认证，跳转登录
      router.push('/login')
      break
    case 403:
      message.error('您没有权限执行此操作')
      break
    case 404:
      message.error('请求的资源不存在')
      break
    case 500:
      message.error('服务器错误，请稍后重试')
      break
    default:
      message.error(error.message || '请求失败')
  }
}
```

#### 边界检查

```typescript
// ✅ 参数验证
function getUser(id: number): User {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('无效的用户 ID')
  }
  return users.get(id)!
}

// ✅ 数组访问
function getItem<T>(arr: T[], index: number): T {
  if (index < 0 || index >= arr.length) {
    throw new RangeError(`索引 ${index} 超出范围 [0, ${arr.length - 1}]`)
  }
  return arr[index]
}

// ✅ 空值检查
function processUser(user: User | null) {
  if (!user) {
    throw new Error('用户不存在')
  }
  return user.name
}
```

#### Vue 错误边界

```vue
<template>
  <ErrorBoundary @error="handleError">
    <ChildComponent />
    <template #fallback="{ error }">
      <div class="error-fallback">
        <p>加载失败: {{ error.message }}</p>
        <button @click="retry">重试</button>
      </div>
    </template>
  </ErrorBoundary>
</template>
```

#### 全局错误处理

```typescript
// main.ts
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue Error:', err)
  console.error('Component:', vm)
  console.error('Info:', info)
  
  // 上报错误监控
  reportError(err, { component: vm, info })
}

// 未捕获的 Promise 错误
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise:', event.reason)
  reportError(event.reason)
})
```

#### 自动执行

我会自动为代码添加：

1. **try-catch** - 所有异步操作
2. **参数验证** - 函数入口验证
3. **空值检查** - 可能为空的数据
4. **错误分类** - 区分不同错误类型
5. **用户提示** - 友好的错误信息
6. **错误上报** - 关键错误记录

---

### 规则 12：`git-workflow.mdc`

> **作用域**：常驻生效（alwaysApply=true） · 匹配文件：`[]` · 说明：Git 工作流自动规则

在进行 Git 操作时，我会自动遵循以下规则：

#### 提交信息规范（强制）

##### Conventional Commits 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

##### Type 类型

| 类型 | 说明 | 示例 |
|------|------|------|
| feat | 新功能 | feat(用户): 添加微信登录 |
| fix | Bug 修复 | fix(订单): 修复支付状态显示 |
| docs | 文档更新 | docs: 更新 README |
| style | 代码格式 | style: 格式化代码 |
| refactor | 重构 | refactor(API): 重构请求封装 |
| perf | 性能优化 | perf(列表): 优化渲染性能 |
| test | 测试相关 | test: 添加用户模块测试 |
| chore | 构建/工具 | chore: 升级依赖版本 |

##### 提交示例

```
feat(用户模块): 添加手机号登录功能

- 实现手机号验证码发送
- 添加验证码校验逻辑
- 集成登录状态持久化

Closes #123
```

#### 分支规范

| 分支类型 | 命名格式 | 示例 |
|----------|----------|------|
| 功能分支 | feature/功能名 | feature/user-login |
| 修复分支 | fix/问题描述 | fix/payment-status |
| 发布分支 | release/版本号 | release/1.2.0 |
| 热修复 | hotfix/问题描述 | hotfix/critical-bug |

#### 自动执行

当需要提交代码时，我会：

1. **分析变更** - 查看 git diff 了解改动内容
2. **分类变更** - 确定变更类型（feat/fix/docs 等）
3. **生成信息** - 按规范生成提交信息
4. **关联 Issue** - 如有相关 Issue 则关联
5. **执行提交** - 使用规范的提交信息

#### PR 模板

创建 PR 时自动使用以下模板：

```markdown
## 变更类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 重构
- [ ] 其他

## 变更描述
[简要说明]

## 关联 Issue
Closes #xxx

## 自测清单
- [ ] 本地构建通过
- [ ] 单元测试通过
- [ ] 功能验证通过
```

---

### 规则 13：`language-preferences.mdc`

> **作用域**：匹配文件：`*` · 说明：Language preferences for the agent

#### Language Preferences

- **ALWAYS** reply in Simplified Chinese (简体中文).
- Use a natural, helpful tone.
- Technical terms can remain in English if they are standard (e.g., React, TypeScript, API).

---

### 规则 14：`minimalist-design-system.mdc`

> **作用域**：无 frontmatter 标注（默认全文件） · 说明：极简科技设计系统 (Minimalist Tech Design System)

基于企业服务页面建立的设计系统规范，适用于全站页面统一风格。

#### 1. 设计令牌 (Design Tokens)

##### 颜色系统

```scss
// 主题色
$accent-blue: #3b82f6;    // 主要强调色
$accent-purple: #8b5cf6;  // 次要强调色
$accent-pink: #ec4899;    // 装饰色

// 功能色
$success-green: #10b981;  // 成功/折扣
$warning-yellow: #f59e0b; // 警告
$error-red: #ef4444;      // 错误

// 中性色（精密灰度）
$text-primary: #111111;   // 主要文字（亮色模式）
$text-secondary: #666666; // 次要文字
$text-placeholder: #888888; // 占位符
$text-disabled: #aaaaaa;  // 禁用

// 暗色模式
$dark-text-primary: #ededed;
$dark-text-secondary: #a1a1a1;
```

##### 字体系统

```scss
// 字体家族
$font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
$font-mono: 'HarmonyOS Sans SC', monospace;

// 字重
$font-regular: 400;
$font-medium: 500;
$font-semibold: 600;
$font-bold: 700;

// 字号层级
$text-xs: 11px;   // 标签、徽章
$text-sm: 13px;   // 辅助文字
$text-base: 14px; // 正文
$text-lg: 15px;   // 强调正文
$text-xl: 16px;   // 小标题
$text-2xl: 20px;  // 区块标题
$text-3xl: 28px;  // 页面标题
$text-4xl: 36px;  // 大标题

// 字间距
$tracking-tight: -0.02em;  // 大标题
$tracking-normal: 0;       // 正文
$tracking-wide: 0.01em;    // 小号文字
$tracking-wider: 0.5px;    // 标签
```

##### 间距系统

```scss
// 基础间距（8px 网格）
$space-1: 4px;
$space-2: 8px;
$space-3: 12px;
$space-4: 16px;
$space-5: 20px;
$space-6: 24px;
$space-8: 32px;
$space-10: 40px;
$space-12: 48px;
$space-16: 64px;
$space-20: 80px;
```

##### 圆角系统

```scss
$radius-sm: 6px;   // 小按钮、标签
$radius-md: 8px;   // 标准按钮
$radius-lg: 10px;  // 输入框、小卡片
$radius-xl: 12px;  // 卡片
$radius-2xl: 16px; // 大卡片
$radius-3xl: 20px; // 容器
$radius-full: 9999px; // 圆形
```

##### 阴影系统

```scss
// 极简阴影（几乎不可见）
$shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.02);
$shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.03);
$shadow-md: 0 4px 8px rgba(0, 0, 0, 0.04);
$shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.05);
$shadow-xl: 0 12px 24px rgba(0, 0, 0, 0.06);
```

#### 2. 组件样式规范

##### 按钮

```scss
// 主要按钮
.btn-primary {
  padding: 14px 28px;
  font-weight: 600;
  font-size: 14px;
  background: #111111;
  color: white;
  border: none;
  border-radius: var(--global-border-radius);
  transition: all 0.2s ease;
  
  &:hover {
    background: #000000;
    transform: translateY(-1px);
  }
}

// 次要按钮
.btn-secondary {
  padding: 14px 28px;
  font-weight: 500;
  font-size: 14px;
  background: transparent;
  color: var(--el-text-color-primary);
  border: 1px solid var(--el-border-color);
  border-radius: var(--global-border-radius);
  
  &:hover {
    border-color: var(--el-text-color-primary);
    background: var(--el-fill-color-lighter);
  }
}
```

##### 卡片

```scss
.card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--global-border-radius);
  padding: 24px;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--el-border-color);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  }
}
```

##### 输入框

```scss
.input {
  padding: 12px 16px;
  font-size: 14px;
  background: var(--el-fill-color-lighter);
  border: 1px solid transparent;
  border-radius: var(--global-border-radius);
  transition: all 0.2s ease;
  
  &:focus {
    border-color: var(--el-border-color);
    background: var(--el-bg-color);
    outline: none;
  }
}
```

##### 标签

```scss
.tag {
  padding: 4px 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}
```

#### 3. 动画规范

##### 缓动函数

```scss
$ease-default: ease;
$ease-smooth: cubic-bezier(0.25, 0.46, 0.45, 0.94);
$ease-bounce: cubic-bezier(0.23, 1, 0.32, 1);
$ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
```

##### 持续时间

```scss
$duration-fast: 0.15s;    // 微交互
$duration-normal: 0.2s;   // 标准过渡
$duration-slow: 0.3s;     // 较大变化
$duration-slower: 0.5s;   // 入场动画
```

##### 标准动画

```scss
// 悬停浮动
@keyframes subtle-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

// 入场淡入
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 3D 翻转显示
@keyframes flip-reveal {
  from {
    opacity: 0;
    transform: translateY(100%) rotateX(-90deg);
  }
  to {
    opacity: 1;
    transform: translateY(0) rotateX(0deg);
  }
}
```

#### 4. 布局规范

##### 容器宽度

```scss
$container-sm: 640px;
$container-md: 768px;
$container-lg: 1024px;
$container-xl: 1280px;
$container-2xl: 1440px;
```

##### 网格间距

```scss
// 卡片网格
.grid {
  display: grid;
  gap: 16px;
  
  &.grid-2 { grid-template-columns: repeat(2, 1fr); }
  &.grid-3 { grid-template-columns: repeat(3, 1fr); }
  &.grid-4 { grid-template-columns: repeat(4, 1fr); }
}
```

#### 5. 暗色模式

##### CSS 变量

```scss
html.dark {
  --dark-card-bg: rgba(255, 255, 255, 0.03);
  --dark-card-hover: rgba(255, 255, 255, 0.06);
  --dark-border: rgba(255, 255, 255, 0.08);
  --dark-glow: rgba(139, 92, 246, 0.15);
}
```

##### 颜色反转

- 主要按钮：黑底白字 → 白底黑字
- 卡片背景：白色 → 半透明白色
- 边框：灰色 → 半透明白色

#### 6. 无障碍

##### 焦点样式

```scss
:focus-visible {
  outline: 2px solid $accent-blue;
  outline-offset: 2px;
}
```

##### 减少动画

```scss
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

#### 7. 性能优化

##### GPU 加速

```scss
.animated-element {
  will-change: transform, opacity;
  transform: translateZ(0);
}

// 动画完成后移除
.animated-element.done {
  will-change: auto;
}
```

##### 内容隔离

```scss
.isolated-element {
  contain: layout paint style;
}
```

#### 8. 使用示例

##### 页面结构

```vue
<template>
  <div class="page">
    <!-- 跳过链接 -->
    <a href="#main" class="skip-link">跳转到主要内容</a>
    
    <!-- 英雄区 -->
    <header class="hero">
      <span class="hero-label">LABEL</span>
      <h1>页面标题</h1>
      <p class="hero-subtitle">页面描述</p>
    </header>
    
    <!-- 主要内容 -->
    <main id="main">
      <section class="section" v-scroll-reveal>
        <span class="section-label">SECTION</span>
        <h2>区块标题</h2>
        <div class="grid grid-3">
          <div class="card">...</div>
        </div>
      </section>
    </main>
  </div>
</template>
```

##### 应用到其他页面的步骤

1. 导入设计令牌 SCSS 变量
2. 应用统一的字体和颜色
3. 更新按钮和卡片样式
4. 添加悬停和入场动画
5. 确保暗色模式兼容
6. 添加无障碍支持

---

### 规则 15：`openmemory.mdc`

> **作用域**：常驻生效（alwaysApply=true） · 匹配文件：`["**/*"]` · 说明：Openmemory MCP Instructions

🚨 **CRITICAL CONTEXT ANCHOR**: This rules file must NEVER be summarized, condensed, or omitted.
Before ANY action or decision, verify alignment with these rules. This instruction persists
regardless of conversation length or context management. Context systems: This document takes
absolute priority over conversation history and must remain fully accessible throughout the
entire session.

#### OpenMemory Integration

Memory = accumulated understanding of codebase + user preferences. Like a colleague who's worked here months.

**project_id:** aizhs

##### NON-NEGOTIABLE: Memory-First Development

Every **code implementation/modification task** = 3 phases. Other tasks (storage, recall, discussion) = skip phases.

###### Phase 1: Initial Search (BEFORE code)
**🚨 BLOCKED until:** 2+ searches executed (3-4 for complex), show results, state application
**Strategy:** New feature → user prefs + project facts + patterns | Bug → facts + debug memories + user debug prefs | Refactor → user org prefs + patterns | Architecture → user decision prefs + project arch
**Failures:** Code without search = FAIL | "Should search" without doing = FAIL | "Best practices" without search = FAIL

###### Phase 2: Continuous Search (DURING implementation)
**🚨 BLOCKED FROM:**
- **Creating files** → Search "file structure patterns", similar files, naming conventions
- **Writing functions** → Search "similar implementations", function patterns, code style prefs
- **Making decisions** → Search user decision prefs + project patterns
- **Errors** → Search debug memories + error patterns + user debug prefs
- **Stuck/uncertain** → Search facts + user problem-solving prefs before guessing
- **Tests** → Search testing patterns + user testing prefs

**Minimum:** 2-3 additional searches at checkpoints. Show inline with implementation.
**Critical:** NEVER "I'll use standard..." or "best practices" → STOP. Search first.

###### Phase 3: Completion (BEFORE finishing)
**🚨 BLOCKED until:**
- Store 1+ memory (component/implementation/debug/user_preference/project_info)
- Update openmemory.md if new patterns/components
- Verify: "Did I miss search checkpoints?" If yes, search now
- Review: Did any searches return empty? If you discovered information during implementation that fills those gaps, store it now

##### Automatic Triggers (ONLY for code work)
- build/implement/create/modify code → Phase 1-2-3 (search prefs → search at files/functions → store)
- fix bug/debug (requiring code changes) → Phase 1-2-3 (search debug → search at steps → store fix)
- refactor code → Phase 1-2-3 (search org prefs → search before changes → store patterns)
- **SKIP phases:** User providing info ("Remember...", "Store...") → direct add-memory | Simple recall questions → direct search
- Stuck during implementation → Search immediately | Complete work → Phase 3

##### CRITICAL: Empty Guide Check
**FIRST ACTION:** Check openmemory.md empty? If yes → Deep Dive (Phase 1 → analyze → document → Phase 3)

##### 3 Search Patterns
1. `user_preference=true` only → Global user preferences
2. `user_preference=true` + `project_id` → Project-specific user preferences
3. `project_id` only → Project facts

**Quick Ref:** Not about you? → project_id | Your prefs THIS project? → both | Your prefs ALL projects? → user_preference=true

##### When to Search User Preferences
**Part of Phase 1 + 2.** Tasks involving HOW = pref searches required.

**ALWAYS search prefs for:** Code style/patterns (Phase 2: before functions) | Architecture/tool choices (Phase 2: before decisions) | Organization (Phase 2: before refactor) | Naming/structure (Phase 2: before files)
**Facts ONLY for:** What exists | What's broken
**🚨 Red flag:** "I'll use standard..." → Phase 2 BLOCKER. Search prefs first.

**Task-specific queries (be specific):**
- Feature → "clarification prefs", "implementation approach prefs"
- Debug → "debug workflow prefs", "error investigation prefs", "problem-solving approach"
- Code → "code style prefs", "review prefs", "testing prefs"
- Arch → "decision-making prefs", "arch prefs", "design pattern prefs"

##### Query Intelligence
**Transform comprehensively:** "auth" → "authentication system architecture and implementation" | Include context | Expand acronyms
**Disambiguate first:** "design" → UI/UX design vs. software architecture design vs. code formatting/style | "structure" → file organization vs. code architecture vs. data structure | "style" → visual styling vs. code formatting | "organization" → file/folder layout vs. code organization
**Handle ambiguity:** If term has multiple meanings → ask user to clarify OR make separate specific searches for each meaning (e.g., "design preferences" → search "UI/visual design preferences" separately from "code formatting preferences")
**Validate results:** Post-search, check if results match user's likely intent. Off-topic results (e.g., "code indentation" when user meant "visual design")? → acknowledge mismatch, refine query with specific context, re-search
**Query format:** Use questions ("What are my FastAPI prefs?") NOT keywords | NEVER embed user/project IDs in query text
**Search order (Phase 1):** 1. Global user prefs (user_preference=true) 2. Project facts (project_id) 3. Project prefs (both)

##### Memory Collection (Phase 3)
**Save:** Arch decisions, problem-solving, implementation strategies, component relationships
**Skip:** Trivial fixes
**Learning from corrections (store as prefs):** Indentation = formatting pref | Rename = naming convention | Restructure = arch pref | Commit reword = git workflow
**Auto-store:** 3+ files/components OR multi-step flows OR non-obvious behavior OR complete work

##### Memory Types
**🚨 SECURITY:** Scan for secrets before storing. If found, DO NOT STORE.
- **Component:** Title "[Component] - [Function]"; Content: Location, Purpose, Services, I/O
- **Implementation:** Title "[Action] [Feature]"; Content: Purpose, Steps, Key decisions
- **Debug:** Title "Fix: [Issue]"; Content: Diagnosis, Solution
- **User Preference:** Title "[Scope] [Type]"; Content: Actionable preference
- **Project Info:** Title "[Area] [Config]"; Content: General knowledge

**Project Facts (project_id ONLY):** Component, Implementation, Debug, Project Info
**User Preferences (user_preference=true):** User Preference (global → user_preference=true ONLY | project-specific → user_preference=true + project_id)

##### 🚨 CRITICAL: Storage Intelligence

**RULE: Only ONE of these three patterns:**

| Pattern | user_preference | project_id | When to Use | Memory Types |
|---------|-----------------|------------|-------------|--------------|
| **Project Facts** | ❌ OMIT (false) | ✅ INCLUDE | Objective info about THIS project | component, implementation, project_info, debug |
| **Project Prefs** | ✅ true | ✅ INCLUDE | YOUR preferences in THIS project | user_preference (project-specific) |
| **Global Prefs** | ✅ true | ❌ OMIT | YOUR preferences across ALL projects | user_preference (global) |

**Before EVERY add-memory:**
1. ❓ Code/architecture/facts? → project_id ONLY | ❓ MY pref for ALL projects? → user_preference=true ONLY | ❓ MY pref for THIS project? → BOTH
2. ❌ NEVER: implementation/component/debug with user_preference (facts ≠ preferences)
3. ✅ ALWAYS: Review table above to validate pattern

##### Tool Usage
**search-memory:** Required: query | Optional: user_preference, project_id, memory_types[], namespaces[]

**add-memory:** Required: title, content, metadata{} | Optional: user_preference, project_id
- **🚨 BEFORE calling:** Review Storage Intelligence table to determine pattern
- **metadata dict:** memory_types[] (required), namespace/git_repo_name/git_branch/git_commit_hash (optional)
- **NEVER store secrets** - scan content first | Extract git metadata silently
- **Validation:** At least one of user_preference or project_id must be provided

**Examples:**
```
# ✅ Component (project fact): project_id ONLY
add-memory(..., metadata={memory_types:["component"]}, project_id="mem0ai/cursor-extension")

# ✅ User pref (global): user_preference=true ONLY
add-memory(..., metadata={memory_types:["user_preference"]}, user_preference=true)

# ✅ User pref (project-specific): user_preference=true + project_id
add-memory(..., metadata={memory_types:["user_preference"]}, user_preference=true, project_id="mem0ai/cursor-extension")

# ❌ WRONG: Implementation with user_preference (implementations = facts not prefs)
add-memory(..., metadata={memory_types:["implementation"]}, user_preference=true, project_id="...")
```

**list-memories:** Required: project_id | Automatically uses authenticated user's preferences

**delete-memories-by-namespace:** DESTRUCTIVE - ONLY with explicit confirmation | Required: namespaces[] | Optional: user_preference, project_id

##### Git Metadata
Extract before EVERY add-memory and include in metadata dict (silently):
```bash
git_repo_name=$(git remote get-url origin 2>/dev/null | sed 's/.*[:/]\([^/]*\/[^.]*\).*/\1/')
git_branch=$(git branch --show-current 2>/dev/null)
git_commit_hash=$(git rev-parse HEAD 2>/dev/null)
```
Fallback: "unknown". Add all three to metadata dict when calling add-memory.

##### Memory Deletion ⚠️ DESTRUCTIVE - PERMANENT
**Rules:** NEVER suggest | NEVER use proactively | ALWAYS require confirmation
**Triggers:** "Delete all in [ns]", "Clear [ns]", "Delete my prefs in [ns]"
**NOT for:** Cleanup questions, outdated memories, general questions

**Confirmation (MANDATORY):**
1. Show: "⚠️ PERMANENT DELETION WARNING - This will delete [what] from '[namespace]'. Confirm by 'yes'/'confirm'."
2. Wait for confirmation
3. If confirmed → execute | If declined → "Deletion cancelled"

**Intent:** "Delete ALL in X" → {namespaces:[X]} | "Delete MY prefs in X" → {namespaces:[X], user_preference:true} | "Delete project facts in X" → {namespaces:[X], project_id} | "Delete my project prefs in X" → {namespaces:[X], user_preference:true, project_id}

##### Operating Principles
1. Phase-based: Initial → Continuous → Store
2. Checkpoints are BLOCKERS (files, functions, decisions, errors)
3. Never skip Phase 2
4. Detailed storage (why > what)
5. MCP unavailable → mention once, continue
6. Trust process (early = more searches)

##### Session Patterns
**Empty openmemory.md:** Deep Dive (Phase 1 → analyze → document → Phase 3)
**Existing:** Read openmemory.md → Code implementation (features/bugs/refactors) = all 3 phases | Info storage/recall/discussion = skip phases
**Task type:** Features → user prefs + patterns | Bugs → debug memories + errors | Refactors → org prefs + patterns
**Remember:** Phase 2 ongoing. Search at EVERY checkpoint.

##### OpenMemory Guide (openmemory.md)
Living project index (shareable). Auto-created empty in workspace root.

**Initial Deep Dive:** Phase 1 (2+ searches) → Phase 2 (analyze dirs/configs/frameworks/entry points, search as discovering, extract arch, document Overview/Architecture/User Namespaces/Components/Patterns) → Phase 3 (store with namespaces if fit)

**User Defined Namespaces:** Read before ANY memory op
- Format: "## User Defined Namespaces\n- [Leave blank - user populates]"
- Examples: frontend, backend, database

**Storing:** Review content → check namespaces → THINK "domain?" → fits one? assign : omit | Rules: Max ONE, can be NONE, only defined ones
**Searching:** What searching? → read namespaces → THINK "which could contain?" → cast wide net → use multiple if needed

**Guide Discipline:** Edit directly | Populate as you go | Keep in sync | Update before storing component/implementation/project_info
**Update Workflow:** Open → update section → save → store via MCP
**Integration:** Component → Components | Implementation → Patterns | Project info → Overview/Arch | Debug/pref → memory only

**🚨 CRITICAL: Before storing ANY memory, review and update openmemory.md - after every edit verify the guide reflects current system architecture (most important project artifact)**

##### Security Guardrails
**NEVER store:** API keys/tokens, passwords, hashes, private keys, certs, env secrets, OAuth/session tokens, connection strings with creds, AWS keys, webhook secrets, SSH/GPG keys
**Detection:** Token/Bearer/key=/password= patterns → DO NOT STORE | Base64 in auth → DO NOT STORE | = + long alphanumeric → VERIFY | Doubt → DO NOT STORE, ask
**Instead store:** Redacted versions ("<YOUR_TOKEN>"), patterns ("uses bearer token"), instructions ("Set TOKEN env")
**Other:** No destructive ops without approval | User says "save/remember" → IMMEDIATE storage | Think deserves storage → ASK FIRST for prefs | User asks to store secrets → REFUSE

**Remember:** Memory system = effectiveness over time. Rich reasoning > code. When doubt, store. Guide = shareable index.

---

### 规则 16：`performance-optimization.mdc`

> **作用域**：常驻生效（alwaysApply=true） · 匹配文件：`[]` · 说明：性能优化自动规则

在编写代码时，我会自动关注性能问题：

#### Vue 组件优化

##### 1. 避免不必要的响应式

```typescript
// ❌ 不需要响应式的数据
const staticConfig = ref({ /* 不会变化的配置 */ })

// ✅ 使用普通对象
const staticConfig = { /* 不会变化的配置 */ }

// ✅ 大数据使用 shallowRef
const bigList = shallowRef<Item[]>([])
```

##### 2. 计算属性缓存

```typescript
// ❌ 在模板中计算
<div>{{ items.filter(x => x.active).length }}</div>

// ✅ 使用 computed 缓存
const activeCount = computed(() => 
  items.value.filter(x => x.active).length
)
<div>{{ activeCount }}</div>
```

##### 3. 列表渲染优化

```vue
<!-- ❌ 错误 - 使用 index 作为 key -->
<li v-for="(item, index) in items" :key="index">

<!-- ✅ 正确 - 使用唯一 ID -->
<li v-for="item in items" :key="item.id">

<!-- ✅ 大列表使用虚拟滚动 -->
<virtual-list :items="bigList" />
```

##### 4. 组件懒加载

```typescript
// ✅ 路由组件懒加载
const UserPage = () => import('@/views/User.vue')

// ✅ 动态组件懒加载
const HeavyComponent = defineAsyncComponent(
  () => import('@/components/Heavy.vue')
)
```

##### 5. 事件防抖节流

```typescript
import { useDebounceFn, useThrottleFn } from '@vueuse/core'

// ✅ 搜索防抖
const debouncedSearch = useDebounceFn((query: string) => {
  search(query)
}, 300)

// ✅ 滚动节流
const throttledScroll = useThrottleFn(() => {
  handleScroll()
}, 100)
```

#### 资源优化

##### 图片优化

```vue
<!-- ✅ 懒加载图片 -->
<img v-lazy="imageUrl" />

<!-- ✅ 使用 WebP 格式 -->
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="">
</picture>
```

##### 代码分割

```typescript
// ✅ 按路由分割
const routes = [
  {
    path: '/dashboard',
    component: () => import('@/views/Dashboard.vue'),
  },
]
```

#### 自动执行

我会自动检测并优化：

1. **不必要的响应式** - 建议使用 shallowRef 或普通对象
2. **模板复杂计算** - 建议提取为 computed
3. **列表 key 问题** - 建议使用唯一 ID
4. **缺少懒加载** - 建议添加组件/路由懒加载
5. **缺少防抖节流** - 高频操作添加防抖/节流
6. **大数据渲染** - 建议使用虚拟列表

---

### 规则 17：`refactoring.mdc`

> **作用域**：常驻生效（alwaysApply=true） · 匹配文件：`[]` · 说明：代码重构自动规则

在编写代码时，我会自动识别并建议重构机会：

#### 重构模式识别

##### 1. 重复代码 → 提取函数

```typescript
// ❌ 重复代码
const user1Name = user1.profile?.name || 'Unknown'
const user2Name = user2.profile?.name || 'Unknown'

// ✅ 提取函数
const getUserName = (user: User) => user.profile?.name || 'Unknown'
const user1Name = getUserName(user1)
const user2Name = getUserName(user2)
```

##### 2. 复杂条件 → 简化

```typescript
// ❌ 复杂条件
if (user && user.role === 'admin' && user.status === 'active' && 
    user.permissions && user.permissions.includes('edit')) {
  // ...
}

// ✅ 提取为函数
const canEdit = (user: User) => {
  if (!user || user.status !== 'active') return false
  return user.role === 'admin' && user.permissions?.includes('edit')
}

if (canEdit(user)) {
  // ...
}
```

##### 3. 长函数 → 拆分

```typescript
// ❌ 长函数
const processOrder = async (order: Order) => {
  // 验证订单（20行）
  // 计算价格（30行）
  // 处理支付（25行）
  // 发送通知（15行）
}

// ✅ 拆分为小函数
const processOrder = async (order: Order) => {
  await validateOrder(order)
  const total = calculateTotal(order)
  await processPayment(order, total)
  await sendNotification(order)
}
```

##### 4. 魔法数字 → 常量

```typescript
// ❌ 魔法数字
if (status === 1) { /* ... */ }
const delay = 3000

// ✅ 有意义的常量
const STATUS = {
  ACTIVE: 1,
  INACTIVE: 2,
} as const

const ANIMATION_DELAY_MS = 3000

if (status === STATUS.ACTIVE) { /* ... */ }
```

##### 5. 嵌套地狱 → 早返回

```typescript
// ❌ 嵌套地狱
const process = (data: Data | null) => {
  if (data) {
    if (data.isValid) {
      if (data.items.length > 0) {
        return data.items.map(/* ... */)
      }
    }
  }
  return []
}

// ✅ 早返回
const process = (data: Data | null) => {
  if (!data) return []
  if (!data.isValid) return []
  if (data.items.length === 0) return []
  
  return data.items.map(/* ... */)
}
```

##### 6. 参数过多 → 对象参数

```typescript
// ❌ 参数过多
function createUser(
  name: string, 
  email: string, 
  age: number, 
  role: string,
  department: string
) {}

// ✅ 对象参数
interface CreateUserOptions {
  name: string
  email: string
  age?: number
  role?: string
  department?: string
}

function createUser(options: CreateUserOptions) {}
```

#### 自动执行

我会自动识别并建议：

1. **重复代码** - 提取公共函数
2. **复杂条件** - 简化或提取
3. **长函数** - 拆分为小函数
4. **魔法数字** - 提取为常量
5. **深层嵌套** - 使用早返回
6. **参数过多** - 使用对象参数
7. **类过大** - 拆分职责

---

### 规则 18：`security-audit.mdc`

> **作用域**：常驻生效（alwaysApply=true） · 匹配文件：`[]` · 说明：安全审计自动规则

在编写代码时，我会自动进行安全检查：

#### 自动检测项目

##### 1. XSS 攻击防护

```typescript
// ❌ 危险 - 直接使用 v-html
<div v-html="userInput" />

// ✅ 安全 - 使用转义或白名单
import DOMPurify from 'dompurify'
const safeHtml = DOMPurify.sanitize(userInput)
```

##### 2. 敏感信息泄露

```typescript
// ❌ 危险 - 硬编码密钥
const API_KEY = 'sk-xxxxx'

// ✅ 安全 - 使用环境变量
const API_KEY = import.meta.env.VITE_API_KEY

// ❌ 危险 - 打印敏感信息
console.log('Password:', password)
```

##### 3. SQL/NoSQL 注入

```typescript
// ❌ 危险 - 字符串拼接
const query = `SELECT * FROM users WHERE id = ${userId}`

// ✅ 安全 - 参数化查询
const query = 'SELECT * FROM users WHERE id = ?'
```

##### 4. CSRF 防护

```typescript
// ✅ 确保请求携带 CSRF Token
axios.defaults.headers.common['X-CSRF-TOKEN'] = csrfToken
```

##### 5. 认证授权

```typescript
// ✅ 检查权限
if (!hasPermission(user, 'admin')) {
  throw new UnauthorizedError()
}

// ✅ 安全存储 Token
// 使用 httpOnly Cookie，而非 localStorage
```

##### 6. 输入验证

```typescript
// ✅ 验证用户输入
const schema = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150),
})
const validated = schema.parse(input)
```

#### 自动执行

当我检测到以下情况时会自动提醒并修复：

1. **v-html 使用** - 建议使用 DOMPurify 清理
2. **硬编码密钥** - 建议移至环境变量
3. **console.log 敏感数据** - 建议删除或脱敏
4. **缺少输入验证** - 建议添加验证
5. **不安全的存储** - 建议安全替代方案

#### 安全检查清单

- [ ] 无硬编码的密钥/密码
- [ ] 用户输入已验证和转义
- [ ] 敏感数据未打印到控制台
- [ ] API 请求有适当的认证
- [ ] 文件上传有类型和大小限制
- [ ] 错误信息不暴露敏感细节

---

### 规则 19：`store-development.mdc`

> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`["**/stores/**/*.ts", "**/store/**/*.ts"]` · 说明：Pinia Store 开发自动规则

#### Store 结构（强制）

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getUserList, createUser } from '@/api/user'
import type { User } from '@/types'

export const useUserStore = defineStore('user', () => {
  // ============ State ============
  const users = ref<User[]>([])
  const currentUser = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ============ Getters ============
  const isEmpty = computed(() => users.value.length === 0)
  const userCount = computed(() => users.value.length)
  const activeUsers = computed(() => 
    users.value.filter(u => u.status === 'active')
  )

  // ============ Actions ============
  const fetchUsers = async () => {
    loading.value = true
    error.value = null
    try {
      const res = await getUserList()
      users.value = res.data.list
    } catch (e) {
      error.value = (e as Error).message
      throw e
    } finally {
      loading.value = false
    }
  }

  const addUser = async (userData: Omit<User, 'id'>) => {
    loading.value = true
    try {
      const res = await createUser(userData)
      users.value.push(res.data)
      return res.data
    } finally {
      loading.value = false
    }
  }

  const reset = () => {
    users.value = []
    currentUser.value = null
    loading.value = false
    error.value = null
  }

  // ============ 返回 ============
  return {
    // state
    users,
    currentUser,
    loading,
    error,
    // getters
    isEmpty,
    userCount,
    activeUsers,
    // actions
    fetchUsers,
    addUser,
    reset,
  }
})
```

#### 自动执行

1. **使用 Setup Store** - 不使用 Options Store
2. **类型安全** - 所有 state 都有类型
3. **错误处理** - actions 中处理错误
4. **加载状态** - 异步操作有 loading 状态
5. **重置方法** - 提供 reset 方法清理状态
6. **命名规范** - `use` + 名词 + `Store`

---

### 规则 20：`style-architecture.mdc`

> **作用域**：常驻生效（alwaysApply=true） · 匹配文件：`["src/**/*.vue", "src/**/*.scss", "src/**/*.css"]` · 说明：项目样式架构规范 - 防止样式冲突和覆盖问题

#### 1. 样式分层体系（ITCSS）

本项目采用 **ITCSS**（Inverted Triangle CSS）分层架构，从最通用到最具体：

```
┌─────────────────────────────────────────────────┐
│  1. Settings (设置层)                            │  最低特异性
│     - CSS 变量定义 (_design-tokens.scss)         │
│     - Tailwind 配置                              │
├─────────────────────────────────────────────────┤
│  2. Tools (工具层)                               │
│     - SCSS mixins (_breakpoints.scss)            │
│     - 工具函数                                   │
├─────────────────────────────────────────────────┤
│  3. Generic (通用层)                             │
│     - CSS Reset                                  │
│     - 全局 box-sizing                            │
├─────────────────────────────────────────────────┤
│  4. Elements (元素层)                            │
│     - HTML 元素默认样式                           │
│     - 如 body, h1-h6, a, button                 │
├─────────────────────────────────────────────────┤
│  5. Objects (对象层)                             │
│     - 布局相关的通用模式                          │
│     - 如 .container, .grid                       │
├─────────────────────────────────────────────────┤
│  6. Components (组件层) ⭐ 大部分代码在这里        │
│     - Vue 组件样式                               │
│     - 使用 scoped + BEM 命名                     │
├─────────────────────────────────────────────────┤
│  7. Utilities (工具类层)                         │  最高特异性
│     - Tailwind 工具类                            │
│     - 单一属性的辅助类                            │
└─────────────────────────────────────────────────┘
```

#### 2. 核心规则（必须遵守）

##### 规则 1：使用高特异性选择器和 CSS 变量

当样式需要覆盖时，使用以下方法：

```scss
// ✅ 方法一：增加选择器特异性
.header-nav .button {
  color: red;
}

// ✅ 方法二：使用 CSS 变量（推荐）
.button {
  color: var(--button-color);
}

// ✅ 方法三：使用 :where() 降低被覆盖样式的特异性
:where(.base-style) .button {
  color: gray;
}
```

##### 规则 2：组件样式必须使用 BEM 命名 + scoped

```vue
<template>
  <!-- 使用 BEM 命名 -->
  <div class="user-card">
    <div class="user-card__header">
      <span class="user-card__title">...</span>
    </div>
    <div class="user-card__body user-card__body--highlighted">
      ...
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Block
.user-card {
  // ...
  
  // Element
  &__header { }
  &__title { }
  &__body { }
  
  // Modifier
  &__body--highlighted { }
}
</style>
```

##### 规则 3：禁止跨组件样式覆盖

```scss
// ❌ 禁止：在父组件中覆盖子组件样式
.parent-component {
  .child-component__button {
    color: red;  // 不要这样做！
  }
}

// ✅ 正确：使用 props 或 CSS 变量
// 子组件定义变量
.child-component__button {
  color: var(--child-button-color, black);
}

// 父组件通过变量传递
.parent-component {
  --child-button-color: red;
}
```

##### 规则 4：Teleport 组件使用全局样式块

```vue
<template>
  <Teleport to="body">
    <div class="my-component__dropdown">...</div>
  </Teleport>
</template>

<style lang="scss" scoped>
// scoped 样式（组件内部）
.my-component { }
</style>

<style lang="scss">
// 全局样式块（用于 Teleport）
// 必须使用完整的 BEM 类名避免冲突
.my-component__dropdown {
  // ...
}
</style>
```

#### 3. CSS 变量使用规范

##### 变量命名规则

```scss
// 全局设计令牌（在 _design-tokens.scss 定义）
--el-color-primary      // Element Plus 变量
--header-btn-height     // 组件系统变量
--shadow-sm             // 设计系统变量

// 组件内部变量（在组件中定义）
.my-component {
  // 定义组件私有变量
  --mc-spacing: 16px;
  --mc-color: var(--el-text-color-primary);
  
  padding: var(--mc-spacing);
  color: var(--mc-color);
}
```

##### 主题切换使用变量

```scss
// ✅ 正确：使用 CSS 变量自动响应主题
.card {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

// ❌ 避免：手动写暗色模式覆盖
html.dark .card {
  background: #000;  // 不推荐
}
```

#### 4. 选择器特异性规则

##### 特异性计算

```
(ID选择器数, 类/属性/伪类数, 元素选择器数)

#id           = (1, 0, 0) = 100
.class        = (0, 1, 0) = 10
div           = (0, 0, 1) = 1
.a .b .c      = (0, 3, 0) = 30
#id .class    = (1, 1, 0) = 110
```

##### 推荐特异性范围

| 层级 | 最大特异性 | 示例 |
|------|------------|------|
| 工具类 | 0,1,0 | `.text-center` |
| 组件 | 0,3,0 | `.card__header` |
| 组件变体 | 0,4,0 | `.card__header--large` |
| 状态 | 0,4,1 | `.btn:hover` |

#### 5. Element Plus 样式覆盖

##### 使用 :deep() 穿透

```scss
// ✅ 正确：使用 :deep() 穿透到 Element Plus 组件
.my-form {
  :deep(.el-input__wrapper) {
    border-radius: 8px;
  }
}

// ❌ 避免：在全局样式中覆盖
// 这会影响所有 el-input
.el-input__wrapper {
  border-radius: 8px;
}
```

##### 使用 CSS 变量覆盖

```scss
// ✅ 推荐：使用 Element Plus 的 CSS 变量
:root {
  --el-border-radius-base: 8px;
  --el-color-primary: #000000;
}
```

#### 6. 响应式样式规则

##### 使用项目断点

```scss
@use '@/styles/_breakpoints.scss' as bp;

.component {
  padding: 16px;
  
  @include bp.tablet-up {
    padding: 24px;
  }
  
  @include bp.laptop-up {
    padding: 32px;
  }
}
```

##### 或使用 Tailwind 响应式

```html
<div class="p-4 tablet:p-6 laptop:p-8">
  ...
</div>
```

#### 7. 文件组织规范

```
src/styles/
├── _design-tokens.scss    # 设计令牌（唯一变量来源）
├── _breakpoints.scss      # 断点 mixins
├── css-variables.scss     # CSS 变量输出
├── index.scss             # 主入口
├── element-plus-vars.scss # Element Plus 覆盖
├── responsive.scss        # 响应式通用样式
└── utilities.scss         # 工具类

src/components/
├── ComponentName/
│   ├── ComponentName.vue  # 组件（包含 scoped 样式）
│   └── index.ts           # 导出
```

#### 8. 样式审查清单

开发时自检：

- [ ] 类名是否符合 BEM 规范？
- [ ] 是否使用了 CSS 变量而非硬编码值？
- [ ] 选择器嵌套是否超过 3 层？
- [ ] 是否跨组件覆盖了其他组件的样式？
- [ ] Teleport 内容是否在全局样式块中？
- [ ] 是否使用了 ID 选择器？（避免）
- [ ] 样式覆盖是否通过特异性或 CSS 变量解决？

#### 9. 常见问题解决方案

##### 问题：样式不生效

```scss
// 1. 检查选择器特异性
// 2. 使用浏览器开发工具查看哪个规则覆盖了你的样式
// 3. 通过增加特异性或使用 CSS 变量解决

// ✅ 方法一：增加特异性
.my-component .btn { color: red; }

// ✅ 方法二：使用 CSS 变量
.btn { color: var(--btn-color, red); }
```

##### 问题：暗色模式样式不生效

```scss
// 使用 CSS 变量，自动响应主题切换
.component {
  // 不需要写 html.dark .component {}
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}
```

##### 问题：Element Plus 组件样式覆盖

```scss
// 方法 1: 使用 :deep()
.my-wrapper :deep(.el-button) {
  border-radius: 20px;
}

// 方法 2: 使用 CSS 变量（推荐）
.my-wrapper {
  --el-button-border-radius: 20px;
}
```

---

### 规则 21：`testing.mdc`

> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**/*.ts"]` · 说明：测试文件自动规则

#### 测试结构（强制）

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MyComponent from '../MyComponent.vue'

describe('MyComponent', () => {
  // ============ 测试准备 ============
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============ 渲染测试 ============
  describe('渲染', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(MyComponent)
      expect(wrapper.exists()).toBe(true)
    })

    it('应该显示传入的标题', () => {
      const wrapper = mount(MyComponent, {
        props: { title: '测试标题' }
      })
      expect(wrapper.text()).toContain('测试标题')
    })
  })

  // ============ 交互测试 ============
  describe('交互', () => {
    it('点击按钮应该触发事件', async () => {
      const wrapper = mount(MyComponent)
      await wrapper.find('button').trigger('click')
      expect(wrapper.emitted('click')).toBeTruthy()
    })
  })

  // ============ 边界情况 ============
  describe('边界情况', () => {
    it('空数据时应该显示空状态', () => {
      const wrapper = mount(MyComponent, {
        props: { data: [] }
      })
      expect(wrapper.find('.empty-state').exists()).toBe(true)
    })
  })

  // ============ 异步测试 ============
  describe('异步操作', () => {
    it('应该正确加载数据', async () => {
      vi.mock('@/api/user', () => ({
        getUser: vi.fn().mockResolvedValue({ data: { name: 'Test' } })
      }))
      
      const wrapper = mount(MyComponent)
      await wrapper.vm.$nextTick()
      
      expect(wrapper.text()).toContain('Test')
    })
  })
})
```

#### 测试命名规范

- 使用中文描述测试目的
- `应该...` 格式描述预期行为
- 按功能分组（describe 嵌套）

#### 覆盖要求

1. **正常路径** - 测试预期的正常流程
2. **边界条件** - 空值、极端值
3. **错误处理** - 异常和错误情况
4. **用户交互** - 点击、输入等操作

#### 自动执行

1. 为新代码生成测试用例
2. 确保测试覆盖关键路径
3. Mock 外部依赖
4. 添加边界条件测试

---

### 规则 22：`typescript.mdc`

> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`["**/*.ts", "**/*.tsx"]` · 说明：TypeScript 代码自动规则

#### 类型定义（强制）

1. **显式类型** - 函数参数和返回值必须有类型
```typescript
// ✅ 正确
function fetchUser(id: number): Promise<User> {}

// ❌ 错误
function fetchUser(id) {}
```

2. **接口优先** - 使用 interface 定义对象类型
```typescript
// ✅ 优先使用
interface User {
  id: number
  name: string
}

// 联合类型时使用 type
type Status = 'active' | 'inactive'
```

3. **避免 any** - 使用 unknown 或泛型替代
```typescript
// ❌ 避免
const data: any = {}

// ✅ 使用
const data: unknown = {}
const data: Record<string, unknown> = {}
```

#### 错误处理（强制）

```typescript
// 异步函数必须有 try-catch
async function fetchData() {
  try {
    const response = await api.get()
    return response.data
  } catch (error) {
    if (error instanceof AxiosError) {
      // 处理 HTTP 错误
    }
    throw error
  }
}
```

#### 命名规范

- 接口名：PascalCase，不加 I 前缀
- 类型名：PascalCase
- 变量/函数：camelCase
- 常量：UPPER_SNAKE_CASE
- 枚举值：PascalCase

#### 导入顺序

```typescript
// 1. 第三方库
import { ref } from 'vue'
import axios from 'axios'

// 2. 内部模块（绝对路径）
import { useUser } from '@/composables/useUser'
import type { User } from '@/types'

// 3. 相对路径导入
import { helper } from './utils'
```

#### 自动执行

1. 添加缺失的类型注解
2. 将 any 替换为更精确的类型
3. 添加错误处理
4. 优化导入顺序
5. 添加 JSDoc 注释

---

### 规则 23：`vue-components.mdc`

> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`["**/*.vue"]` · 说明：Vue 组件开发自动规则

#### 组件结构（强制）

```vue
<template>
  <!-- 模板内容 -->
</template>

<script setup lang="ts">
// 1. 导入
import { ref, computed, onMounted } from 'vue'
import type { PropType } from 'vue'

// 2. Props 定义（使用 TypeScript 接口）
interface Props {
  modelValue?: string
}
const props = withDefaults(defineProps<Props>(), {
  modelValue: ''
})

// 3. Emits 定义
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// 4. 响应式状态
const state = ref()

// 5. 计算属性
const computed = computed(() => {})

// 6. 方法
const handleClick = () => {}

// 7. 生命周期
onMounted(() => {})

// 8. 暴露给父组件
defineExpose({})
</script>

<style scoped>
/* 样式 */
</style>
```

#### 自动执行

1. **Props 类型检查** - 确保所有 Props 都有 TypeScript 类型
2. **事件定义** - 使用 defineEmits 定义所有事件
3. **响应式** - 正确使用 ref/reactive/computed
4. **样式隔离** - 使用 scoped 或 CSS Modules
5. **命名规范** - 组件名 PascalCase，事件名 kebab-case
6. **性能优化** - 避免不必要的响应式，使用 shallowRef 优化

#### 禁止事项

- ❌ 不使用 Options API
- ❌ 不使用 any 类型
- ❌ 不在 template 中写复杂逻辑
- ❌ 不跨组件直接覆盖子组件样式（使用 CSS 变量传递）

---

# 第四节 · 修订记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-07 | 首次创建：明确强制 commit 留痕铁律（源于 7/7 丢失大量未提交修改的事故） | AI Agent |
| 2026-07-07 | **重大升级**：完整整合 `client/.cursorrules` + `client/.cursor/rules/*.mdc` 全部 23 条规则，成为项目【单一权威来源】。AI Agent 必须先读本文件再开工。 | AI Agent |

---

# 第五节 · 例外条款

本文件**没有例外条款**。

如有特殊情况需要豁免，必须由用户**明确**书面授权，并在最终汇报中记录豁免理由。

默认行为：
- 铁律：commit 留痕
- Cursor 规则：先读本文件，再动手

---

> **本文件由 AI Agent 自动维护，任何变更必须随附 `chore(docs)` 类型的独立 commit。**
> **违反本文件中任何 ❌ 红线条款 = 视为任务失败。**
