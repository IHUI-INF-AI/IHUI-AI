<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# deepseek-tui 原生层函数级取证（Ghidra 12.1.4）

> 性质：**证据升级**，不是新能力项。本件把 2026-11-19 报告里"deepseek-tui 仅字符串级取证"这一条限制抬到函数级；对照能力矩阵与 20 项落点**不变**。
> 取证对象：`C:\Users\Administrator\AppData\Local\deepseek-tui\deepseek-tui-windows-x64.exe`（主体，36 MB）、`deepseek-windows-x64.exe`（副件，9.5 MB）。
> 只读取证：不改二进制、不脱壳、不提取凭据。

## 1. 工具链（现读，可复核）

| 项 | 值 |
| --- | --- |
| Ghidra | 12.1.4，`D:\DevEnv\ghidra_12.1.4`（`ghidra_12.1.4_PUBLIC_20260921.zip`，sha256 `ddac49f903da9d5bac833e5cc79395098b9c33cfd3279be5f31bd00387d2d4db`，与发布说明逐字一致） |
| JDK | Temurin `21.0.13+9`，`D:\DevEnv\jdk-21.0.13+9` |
| 自检 | `rea doctor`：ghidra / ghidra-platform / ghidra-architecture / ghidra-installation / ghidra-version / ghidra-headless / ghidra-native_decompiler / ghidra-java 全 `healthy` |
| 驱动器 | `analyzeHeadless.bat` + 两个自写 Java 脚本（见 §5） |

### 为什么关掉 Decompiler 系分析器

首次按默认档跑：`Decompiler Parameter ID` 在 36 MB Rust 主体上以 10 路 `decompile.exe` 并行，45 分钟未收敛（日志 11 MB 仍停在 `Decompiling …`），单次会话内拿不到结果。
处置：把 `Ghidra/Features/Decompiler/os/win_x86_64/decompile.exe` 临时移开（跑完即还原），使反编译类分析器快速跳过，其余分析（Disassemble / Function / Reference / ASCII Strings / PE 结构）照常跑完。**本件结论全部来自非反编译通道**：函数边界、调用/数据引用、结构体与枚举的字段名串，属静态可复核事实；语义判断从这些串与结构名推出，逐条标"推断"。

代价与边界：不做反编译 ⇒ 拿不到控制流与语句序；本件不据此推断"某分支一定在何时执行"。这正是 §4 里逐条标"观察/推断"的原因。

## 2. 结果规模（现读末行）

| 对象 | 函数数 | 关键字引用行 | 有关键字上下文的函数 |
| --- | --- | --- | --- |
| `deepseek-tui-windows-x64.exe` | 100,518 | 380 | 199 |
| `deepseek-windows-x64.exe` | 23,476 | 175 | — |

关键字族 26 个（`max_subagents` / `subagent` / `rlm` / `recursive` / `compact` / `skim` / `todo` / `approval` / `sandbox` / `artifact` / `mcp` / `acp` / `handoff` / `edit_file` / `read_file` / `grep` / `glob` / `list_dir` / `write_file` / `permission` / `budget` / `token` / `context` 等），每族上限 120–160 行，防单族淹没。

## 3. 关键证据（函数入口均为镜像内 RVA，非文件偏移）

| # | 事实（观察） | 函数入口 | 对应能力项 | 推断（明确标注） |
| --- | --- | --- | --- | --- |
| 1 | 同一函数引用 `max_subagents` 及 37 字段配置串（`approval_policy` / `sandbox_mode` / `capacity` / `snapshots` / `memory` / `lsp` / `context` …） | `FUN_14041cae0` | 19 并发子代理闸 | 配置结构在**一个**反序列化函数里成型，字段名即配置键名 |
| 2 | `--max-subagents` 与 `max-subagents` 两串同函数 | `FUN_140623630` | 19 | CLI 侧上限参数与配置键是同一语义的两个入口 |
| 3 | `DEEPSEEK_MAX_SUBAGENTS` 与 `DEEPSEEK_MCP_CONFIG` / `DEEPSEEK_APPROVAL_POLICY` / `DEEPSEEK_SANDBOX_MODE` … 同函数 | `FUN_1403ed140` | 19 / 审批 / 沙箱 | 这些是**环境变量**入口，优先级链由本函数合并 |
| 4 | `SubagentsConfig` 结构名单独成串 | `FUN_1404407c0` | 19 | 子代理配置是独立结构，不是散字段 |
| 5 | `struct SubAgentAssignment with 2 elements` / `PersistedSubAgentState with 2 elements` / `SubAgentResult` / `SubAgentStatus{Interrupted,Failed,Cancelled}` / `PersistedSubAgent with 13 elements` | `FUN_140353930` / `FUN_140325f80` / `FUN_140a38ff0` / `FUN_140a392f0` / `FUN_140a483b0` | 19 / 子代理持久化 | 子代理结果有独立状态机（中断/失败/取消三终态）并可跨会话持久化 |
| 6 | `is_subagent` 与 `crates\tui\src\core\engine\turn_loop.rs:1797` 同函数 | `FUN_140a2e240` | 19 / turn loop | 子代理标志在**同一 turn loop**里分支，不是独立循环 |
| 7 | `Usage: /rlm <prompt>  Process a prompt using a Recursive Language Model (RLM). The prompt is stored in a REPL and the model writes code to decompose and process it recursively.` + 源路径 `crates\tui\src\commands\skills.rs` | `FUN_140486980` | 20 RLM | `/rlm` 是斜杠命令，REPL 内由模型**写代码**做分解（对照件原设计，非本仓实现） |
| 8 | `llm_batch` / `rlm_batch` 相邻串；`exec_shell` / `rlm` / `file` 相邻串 | `1419473cf` / `141942cbb` | 20 | 批处理调用面按 `*_batch` 命名，RLM 有独立 batch 通道 |
| 9 | `auto_compact` 两处不同函数；`compaction` 消息带 `crates\tui\src\compaction.rs:1099` | `FUN_14029f370` / `FUN_1405f4810` / `FUN_140470dc0` | 上下文压缩（对照侧） | 自动压缩有触发点与"compaction 消息"事件，压缩被当成可观测事件 |
| 10 | `deepseek-v4flash` / `external-sandbox` / `danger-full-access` 同函数 | `FUN_1403f2c20` | 沙箱档 | 沙箱模式枚举值含 `danger-full-access`（对照件把"全权"当显式档） |
| 11 | `default|allow|deny|audit` 四值一组 | `FUN_1403f52a0` | 审批策略 | 审批策略是四值枚举，`audit` 是独立档而非布尔 |
| 12 | `allowed_approval` / `allowed_sandbox_` / `ed_sandbox_modes` 同函数 | `FUN_140447d20` | 审批 / 沙箱 | 允许集与模式集在同一处过滤 |
| 13 | `exec_shell` / `edit_file` / `write_file` / `read_file` 四串同函数；`tool` 注册表里另有 `list_dir` | `FUN_14071c7c0` / `141942c9f` | 1–11 工具层 | 文件类工具在同一注册表分派 |
| 14 | `todo_add` / `todo_write` 同函数；`todo.rs` 源路径 | `FUN_140b1e5e0` | 待办（对照侧） | 待办是"写整表 + 加单条"两原语 |
| 15 | `mcp_read_resource` / `read_mcp_resourc…` 同函数 | `FUN_14012a500` / `FUN_140bb8200` | 5.13 MCP apps | MCP 资源读取走独立工具名 |
| 16 | `.deepseek/handoff.md` | `FUN_1401cf810` | 5.15 交接文档 | 交接产物落盘为仓库内固定路径 `.deepseek/handoff.md` |
| 17 | `SavedSession { messages, context_references } with 5 elements`；`archived_context` | `FUN_140367550` / `FUN_1403d4a20` | 上下文 | 会话存档带上下文引用表，压缩另存 `archived_context` |
| 18 | `ApprovalModeValue` 枚举名三处 | `FUN_1402f0f20` / `FUN_140529be0` / `FUN_140705e10` | 审批 | 同一枚举在三层（配置 UI / 解析 / 运行）复用，无第二套类型 |

> 观察与推断的分界：表内"函数入口 + 它引用的字符串"是**观察**（可用 §5 命令原样复现）；"对应能力项 / 推断"列是从观察推出的**解读**，不构成实现细节结论。全部函数名为 `FUN_*`（符号被剥离），所以用"它引用的文案 + 结构体名"认领，而不是猜名字。

## 4. 与主报告的关系

- 主报告 §7 原第 2 条"deepseek-tui 仅字符串级取证"**已作废**，改为"字符串级 + 函数级引用图（非反编译通道）"。
- 不新增能力项：本件不改 §4 矩阵、不改 §5 的 20 项落点；第 20 项 RLM 的落点仍是"`TeamOrchestrator.run_recursive` + `orchestrate_agents` 的 `mode=recursive`"，本件只把对照件的 `/rlm` 设计证据钉到函数入口。
- 仍然未知（不冒判）：`/rlm` 的 REPL 代码执行边界、各沙箱档的实际系统调用差异、子代理上限的实际夹紧位置（配置层看得见，闸门执行点在关闭反编译后不可见）。

## 5. 复现命令（本机现跑即得同样末行）

```powershell
$env:JAVA_HOME='D:\DevEnv\jdk-21.0.13+9'
# ① 主体：导入 + 选择性分析 + 导出"串 → 引用函数"（脚本见 .ihui-agent/tmp/recon/ghidra-scripts/DumpStringXrefs.java）
& 'D:\DevEnv\ghidra_12.1.4\support\analyzeHeadless.bat' 'D:\DevEnv\ghidra-projects' dsk `
  -import 'C:\Users\Administrator\AppData\Local\deepseek-tui\deepseek-tui-windows-x64.exe' `
  -scriptPath '.ihui-agent\tmp\recon\ghidra-scripts' -postScript 'DumpStringXrefs.java'
# 末行：DONE rows=380 functions=100518

# ② 同一库上按函数聚合上下文（不重新分析）
& 'D:\DevEnv\ghidra_12.1.4\support\analyzeHeadless.bat' 'D:\DevEnv\ghidra-projects' dsk `
  -process 'deepseek-tui-windows-x64.exe' -noanalysis `
  -scriptPath '.ihui-agent\tmp\recon\ghidra-scripts' -postScript 'DumpFuncContext.java'
# 末行：DONE functions_with_keys=199

# ③ 还原反编译器（跑完必须还原，否则 REA 的反编译通道会失效）
Move-Item 'D:\DevEnv\ghidra_12.1.4\Ghidra\Features\Decompiler\os\win_x86_64\decompile.exe.off' `
        'D:\DevEnv\ghidra_12.1.4\Ghidra\Features\Decompiler\os\win_x86_64\decompile.exe'
```

原始产物（未入库，路径为机器本地）：

- `.ihui-agent/tmp/recon/dsk/xrefs-main.tsv`（380 行，关键字 → 函数 → 入口 → 串地址 → 串）
- `.ihui-agent/tmp/recon/dsk/funcs-main.tsv`（199 行，函数 → 入口 → 它引用的关键字串）
- `.ihui-agent/tmp/recon/dsk/xrefs-small.tsv`（副件 175 行）

本目录同时存了两份同名 TSV 快照，便于无 Ghidra 的机器复核文本层证据。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
