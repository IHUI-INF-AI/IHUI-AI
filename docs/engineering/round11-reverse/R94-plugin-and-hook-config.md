<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R94 — 内置插件三层契约与 hook 配置契约（含四条否证）

> 日期：2026-11-18 · 对照程序：`codex.exe`（桌面版 26.1111.2228.0 / CLI `0.169.0-alpha.11.1`，Rust PE，382,514,992 B）
> 取证面：本机已发布的 primary runtime 包（**普通文件，可直接读**）+ 二进制 serde 名字表 + 六次实跑

## 1. 本轮做了什么

R56–R93 一直在二进制里找结构。本轮换了个取证面：**codex 把它的插件系统以普通文件的形式装在了本机**，于是"抄袭"第一次不需要反汇编，只需要读文件。

两条线同时推进：

1. **插件/市场/技能三层契约**——从 `runtime.json` 到 `marketplace.json` 到 5 个 `plugin.json` 到 6 个 `SKILL.md`，逐字读出，落成可测模块。
2. **hook 配置契约**——14 个事件名、4 个 handler 变体、matcher 组、state 结构全部拿到；**但配出来不触发**，四轮否证把边界钉死。

另有一条主线成果：**codex 已用本仓 relay（反代号池）跑通**，`tokens used 7`、exit 0、无错误。运行期观测第一次有了可用载体。

## 2. 插件三层契约

### 2.1 市场层 `marketplace.json`

路径：`.agents/plugins/marketplace.json`，1,394 B。

```
{ name: "openai-primary-runtime",
  plugins: [ { name, source{ source:"local", path }, policy{ installation:"AVAILABLE", authentication:"ON_USE" }, category:"Productivity" } ] × 5 ] }
```

- 条目键 4 个：`name / source / policy / category`
- `source` 键 2 个：`source / path`；`source` 取值只观测到 `local`
- `policy` 键 2 个：`installation / authentication`；取值分别只观测到 `AVAILABLE` / `ON_USE`

### 2.2 插件层 `plugin.json`

路径：`<plugin>/.codex-plugin/plugin.json`。

- **顶层键 10 个**（五份全部一致）：`author / description / homepage / interface / keywords / license / name / repository / skills / version`
- **第 11 键 `apps` 只有 spreadsheets 有**，值是字符串指针 `"./.app.json"`
- `author` 3 键：`name / email / url`
- **`interface` 14 键**（五份完全一致）：`brandColor / capabilities / category / composerIcon / defaultPrompt / developerName / displayName / logo / longDescription / privacyPolicyURL / screenshots / shortDescription / termsOfServiceURL / websiteURL`
- `capabilities` 五份恒为 `["Interactive","Write"]`；`category` 恒 `Productivity`
- `skills` 恒为 `"./skills/"`（目录指针，不是列表）

五份 manifest 的差异只在内容，不在形状：

| plugin | brandColor | keywords | skills | SKILL 字符 |
| --- | --- | --- | --- | --- |
| documents | `#2563EB` | 12 | 1 | 41,395 |
| pdf | `#DC2626` | 12 | 1 | 7,809 |
| presentations | `#C43E1C` | 10 | 1 | 29,098 |
| spreadsheets | `#107C41` | 16 | **2** | 137,086 |
| template-creator | `#10A37F` | 15 | 1 | 19,034 |

合计 **6 个 skill / 234,422 字符**。spreadsheets 一家占 58%，它多出来的那个 skill 叫 `excel-live-control`（71,858 字符），是本包里最大的单个技能。

### 2.3 应用连接层 `.app.json`

只有 spreadsheets 带：

```
{ apps: { connected_documents: { id: "connector_openai_codex_document_control" } } }
```

键 `apps` + 连接名 + `id`。全包只观测到 **1 个 connector**。

### 2.4 技能层 `SKILL.md`

6 个技能文件的 YAML frontmatter **只有两个键**：`name / description`。这与本仓 skill 的头部契约同形，但 codex 的更短——没有 version、没有 license、没有 allowed-tools。

每个技能还随包一个 `agents/openai.yaml`：

```
interface: { display_name, short_description, icon_small, icon_large, brand_color, default_prompt }  ← 6 键
```

### 2.5 运行时包 `runtime.json`

路径：`<bundle>/runtime.json`，13 键：

`artifactToolVersion / bundleFormatVersion / bundleVersion / bundledPlugins / bundledSkills / libreOfficeVersion / nativeDependencies / nodeVersion / pnpmVersion / pythonVersion / skillsToRemove / targetArch / targetPlatform`

读出来的事实：

- `bundleVersion = 26.1112.11217`（与五份 plugin.json 的 `version` 逐字相同）
- `bundledPlugins` 只有 1 条，`bundledSkills` 是**空数组**
- `nativeDependencies` 5 个：`libheif / jxrlib / poppler / powershell / git`
- 自带 `node 24.22.1-cua.1 / pnpm 11.25.0 / python 3.12.14`
- `libreOfficeVersion: null`（声明了但没装）
- `skillsToRemove` 6 条——**这是迁移清理清单**，把旧技能名（`doc / docs / spreadsheet / slides` 及两个 `codex-primary-runtime/*`）列出来删
- `targetPlatform/targetArch = win32/x64`

## 3. hook 配置契约

从 382 MB 二进制的 serde 名字表里读出的（结构名 + 紧邻字段名）：

- **14 个事件**（snake 与 Pascal 两套拼写）：`pre_model_request / post_model_request / pre_tool_use / permission_request / post_tool_use / pre_compact / post_compact / session_start / session_end / user_prompt_submit / subagent_start / subagent_stop / stop / interrupt`
- 其中短表（193 字符那段）只拼出 12 个，缺 `pre_model_request` 与 `stop`；Pascal 表（185 字符）14 个齐全。**这个差被保留下来而不是抹平**——它本身是证据。
- **matcher 组**：`MatcherGroup { matcher, hooks }`，arity 2
- **handler 4 变体**：`Command / Prompt / Agent / McpTool` → TOML `type` 取值 `command / prompt / agent / mcp_tool`
- **state 结构**：`HookStateToml { enabled, trusted_hash, trusted_content_hash }`

## 4. 四条否证

配置层"能读出来"和"能跑起来"是两件事。本轮把后者证否了，四条各自独立：

| id | 否证 | 证据 |
| --- | --- | --- |
| `kebab-case-event-keys-ignored` | `[[hooks.pre-tool-use]]` 形态被静默接受但不触发 | 配置无报错、payload 目录不存在 |
| `hooks.state.enabled-rejects-boolean` | `[hooks.state] enabled = true` 直接报 `invalid type: boolean, expected struct HookStateToml` | 配置加载失败，会话未启动 |
| `hooks.state.enabled-table-parses-but-inert` | 改成 `[hooks.state.enabled]` 空表后配置**加载成功**，但 hook 仍不执行 | 六组 recorder 命令、零 payload |
| `missing-hook-command-raises-no-error` | 把 hook 命令写成不存在的 `NO_SUCH_BINARY_XYZ_PROBE`，codex **一声不吭** | 说明 hook 根本没进执行路径，而不是执行失败被吞 |

第四条是最锋利的一条：命令不存在却没有报错，等于直接证明"没调用"。配上 `--dangerously-bypass-hook-trust`（其自带描述是 *Run **enabled** hooks without requiring persisted hook trust*）仍然如此，说明卡点不在信任，而在**启用**本身。

另加一条数据库侧否证：`CODEX_HOME` 里 codex 自己生成了 `state_5.sqlite`，**17 张表、零个 hook 列**。所以 hook 状态不在 sqlite，只能落在 `config.toml` 的 `hooks.state`——而那条路已被上面第二、三条堵住。

## 5. relay 打通（运行期观测的载体）

这一步让"运行期观测"有了可能：

- 本仓 relay `http://127.0.0.1:8802` 暴露 `/v1/models`（返回 **1,042 个模型**）与 `/v1/responses`
- 鉴权是双因子：`Authorization: Bearer ihui_*` + `X-Api-Secret: sk_*`；本仓已有组合形态单凭据工具，正好适配 codex 只有一个 `env_key` 变量位
- 首次 401 的真因**不是鉴权失败，而是服务端 SQL 失败**——代码引用了未迁移的 `egress_region` 列。只应用那一条迁移（可空、零行为变化）后 200
- 补 `responses:write` 权限后 403 消失
- `codex exec` 实跑：`tokens used 7`、exit 0、无 ERROR、session id 正常

**诚实边界**：模型返回正文为空（只有 token 计数）。是上游 `gpt-5.1-codex` 过滤，还是 relay 的 `/v1/responses` 转换丢 content，**未查**，不在本轮结论内。

## 6. 覆盖率变化

| 面 | R93 | R94 |
| --- | --- | --- |
| 插件 manifest 契约 | 0% | **100%**（5/5 逐字 + 三键 union） |
| 市场清单契约 | 0% | **100%** |
| 技能 frontmatter 契约 | 0% | **100%**（2 键） |
| 运行时包元数据 | 0% | **100%**（13 键） |
| hook 事件名 | 60%（R63 12 家族） | **100%**（14/14 双拼写） |
| hook 配置形态 | 0% | **契约 100% / 触发 0%** |
| hook 运行期 payload | 0% | **0%**（四次尝试零捕获） |
| 非 hook 结构字段表 | 22% | 22% |

## 7. 诚实边界

1. 插件契约只有 5 个样本，第 15 个 interface 键、第 6 个 plugin **未观测 ≠ 不存在**。
2. `policy` 的 `installation` / `authentication` 各只观测到**一个取值**，枚举全集未知。
3. hook **配置合法但不执行**，本轮的结论是"配置层接受这些键"，不是"这些键能启用 hook"。
4. relay 跑通但**模型正文为空**，上游过滤与转换丢包两种可能都未排除。
5. skill 正文（234 KB）只取了 frontmatter 契约与字符数，**内容未做语义分析**——那是另一个轴。

## 8. 验证

- 新增 2 个模块 + 2 个测试文件，**27 passed**（`-p no:randomly` 单跑）
- `ruff check` 四文件全绿
- 四文件水印已注（`watermark:inject` 逐枚确认）
- 全部数据机器派生：manifest 逐字读文件、hook 名字表逐串扫二进制，**零手敲字段名**
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
