<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R95 — 技能引擎：20 个容器工具、6 道质量门与两个交互契约

> 日期：2026-11-18 · 对照程序：`codex.exe` 附带的 primary runtime bundle（`bundleVersion 26.1112.11217`）
> 取证面：`plugins/*/skills/*/container_tools/` 下 20 个脚本 + 6 份 `SKILL.md` 正文（234,422 字符）

## 1. 本轮做了什么

R94 只取了 `SKILL.md` 的 frontmatter（2 个键）。剩下 234 KB 正文一直没碰。这轮把它拆成**结构**而不是当作待抄的文本：

1. 20 个容器工具全量盘点，按 plugin/技能归类，逐个体量、行数、CLI 面、退出码
2. 6 道质量门的契约（上限常量、schema 号、判定纪律）
3. 两个**跨技能统一**的交互契约：产物操作记账器、文件引用指令
4. 一个反直觉的结论：**codex 的技能没有统一骨架**

## 2. 没有统一骨架——这是结论，不是遗漏

6 份 SKILL.md 的 `##` 标题几乎没有交集。反复出现的只有四个：

| 标题 | 出现 |
| --- | --- |
| `Final response` | 4/6 |
| `Tools + Contract Requirements` | 3/6 |
| `Workflow` / `Workflows` | 3/6 |
| `Important Instructions` / `Important instructions` | 2/6 |

其余标题一律单件出现：`Fill And Validate AcroForms`、`Setup State Machine`、`Office.js Gate`、`Artifact Template Selection`、`Coverage map (scripts ↔ task guides)`……**连大小写都不统一**（`Important Instructions` 与 `Important instructions` 并存）。

⇒ codex 的技能是自由写作，只有"要不要报最终产物"这一个点是硬约定。这与其他守门体系里的"统一模板"假设相反，值得记一笔。

## 3. 20 个容器工具

四个插件带工具，template-creator 一个都没有（它是纯内容技能）。

| plugin | 工具数 | 工具总字节 |
| --- | --- | --- |
| presentations | 16 | 362,972 |
| spreadsheets | 1 | 765 |
| pdf | 1 | 735 |
| documents | 1 | 736 |
| template-creator | 0 | 0 |

82% 的工具集中在 presentations 一个插件里——它是整包工程最重的部分。

## 4. 六道质量门

presentations 的 16 个工具里，6 个是质量门，合计 **226,381 B / 5,655 行**：

| 门 | 字节 | 行 | CLI | 退出码 | 上限常量 |
| --- | --- | --- | --- | --- | --- |
| `inspect_presentation_layout_geometry` | 101,992 | 2,660 | **33** | 0/1/2 | 无（全参数驱动） |
| `native_quantitative_chart_gate` | 45,307 | 1,087 | 7 | 0/2 | 包 128 MB / 段 16 MB / 段数 10k / 页 500 / 图表 25 |
| `inspect_presentation_package_integrity` | 29,495 | 711 | 2 | 2 | 段数 10k / 解压 512 MB |
| `template_source_fidelity_gate` | 22,193 | 533 | 8 | 0/2 | 段 100 MB / 段数 2500 / 包 512 MB |
| `native_table_arithmetic_gate` | 21,259 | 520 | 3 | 0/2 | 表/页 100 / 行 2000 / 列 100 / 单元格 2048 / 契约 200 |
| `native_chart_title_gate` | 6,135 | 144 | 1 | 0/2 | 无 |

### 四条设计纪律（六门共有，逐字摘自各自 docstring）

1. **只治理显式声明**：每道门的 docstring 都自己划界——"Only explicitly declared… are governed"、"Review displayed table totals; enforce only explicitly declared arithmetic contracts"、"Validate only explicitly requested, source-approved… rules"。**不因为"存在"就成为失败**。
2. **跳过不是零**：不支持的数字格式报 `skipped`，"never silently treated as zero"。
3. **只读、无源**：包完整性门"without reading slide text, notes, formulas, or values"；图表门"source-free"。
4. **失败要显式请求**：三道门（table arithmetic / package integrity / layout geometry）默认只出诊断，`--fail-on-findings` 才判红。图表门另有 `--receipt`。

这三条与本仓守门的"差值棘轮 / 未判定不冒绿"是同一种哲学，但 codex 走得更远——**连"失败"本身都做成 opt-in**。

### 门的共享库

3 道门 `from native_quantitative_chart_gate import ...` 复用其常量与 XML 助手（`NS`、`_safe_xml`、`logical_presentation_slides`、`MAX_PACKAGE_BYTES`）。所以 45 KB 那道门实际是整个门族的基座。

## 5. 产物操作记账器：4 份，只有一个字段不同

`mark_artifact_operation_started.mjs` 在 4 个插件各有一份，**全部 23 行**，字节 735–765：

```
argv 必须恰好 6 槽，顺序固定：
  [0] --operation-kind            [1] create | edit
  [2] --expected-output-count     [3] 安全整数 1..100
  [4] --output-format             [5] 白名单内（比较前统一小写）
失败 → stderr 打 usage + exitCode 2；成功 → 不输出、exit 0
```

四份的**唯一差异是格式白名单**：

| plugin | 白名单 |
| --- | --- |
| documents | `docx` |
| pdf | `pdf` |
| presentations | `ppt`, `pptx` |
| spreadsheets | `csv`, `tsv`, `xls`, `xlsm`, `xlsx` |

合计 9 个格式。名字叫 "mark"，但**它一个字节都不写**——纯参数校验桩，只回退出码。真正的记账必然在 codex 运行时侧捕获这次调用，这也解释了为什么"记过一次"无法从文件系统验证。

## 6. 文件引用指令：7 参数 / 2 个 purpose

`:codex-file-citation{...}` 在 4 个技能里出现。观测到的参数名共 7 个：

`path / purpose / artifact_kind / mode / page_number / sheet / range`

- **`path` + `purpose` 是跨技能通用的一对**，其余按产物类型扩展（表格用 `sheet`/`range`，文档用 `page_number`/`artifact_kind`）
- `purpose` 只有两个值：`output`（交付物）/ `source`（被引用的源）
- 约束（pdf 明写）：直接输出、不加反引号/代码围栏/Markdown 链接；只用已验证的绝对路径；每个交付物只引一次；做 Q&A 时 source 引用**替代**文件名而不是追加在末尾；PDF 场景禁止 `mode` 与定位符

## 7. 覆盖率变化

| 面 | R94 | R95 |
| --- | --- | --- |
| 容器工具清单 | 0% | **100%**（20/20 名字、字节、行数） |
| 质量门契约 | 0% | **100%**（6/6 常量+CLI+退出码） |
| 记账器契约 | 0% | **100%**（4/4 + 格式表） |
| 引用指令契约 | 0% | **100%**（7 参数 + 2 purpose） |
| SKILL 正文语义 | 0% | 约 30%（6 份全读了 pdf，其余靠结构抽） |
| 门之间的判据细节 | 0% | **未做**（只取声明，未取实现） |

## 8. 诚实边界

1. **没有抄任何源码**。6 道门合计 5,655 行实现，本轮只取了它们**自我声明**的部分（docstring 边界、上限常量、CLI 面、退出码）。判据内部的真实算法未读、未抄。
2. `inspect_presentation_layout_geometry` 的 33 个 CLI 参数只记录了数量，未逐一列出语义。
3. presentations 另外 10 个工具（`artifact_tool_utils` 55 KB、`materialize_literal_chart_workbooks` 37 KB 等）只登记了体量，**契约未提取**。
4. `--receipt` 的实际输出结构、`--contract-json` 的 schema 都未取。
5. "codex 技能没有统一骨架"只由 6 份样本支撑；第三方技能不在样本内。

## 9. 验证

- 新增 2 模块 + 2 测试，**28 passed**（`-p no:randomly` 单跑）
- `ruff check` 四文件全绿
- 四文件水印已注
- 全部数字机器抽取（正则在真文件上跑），零手抄
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
