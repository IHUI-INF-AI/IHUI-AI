<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D 席（sidecar 原生件取证）状态留痕

- 开工时刻：2026-11-01 00:54（本机）
- HEAD sha（开工现读）：`e28e5f6e4b0340cb181a741a55fcfb6025c01d8a`（分支 `main`）
- 取证对象（盘上 sha256 已现读核验一致）：
  - `D:/DevEnv/Temp/rea-b44/new/qoder-computer-use/QoderComputerUse.exe` 2,530,288 B / `9501bb0d…44eaa`
  - `D:/DevEnv/Temp/rea-b44/xlsx/xlsx-sidecar.exe` 9,147,400 B / `18bee47b…f5ae3a`

## 选定脚本路线（照 T4 §3 已验证流程，不自创）

1. **不用 `rea analyze` 整包**：`.ihui-agent/tmp/rea-goal-b44/{computer-use,xlsx}.analyze.json` 实测 `provider_timeout`(`op=list_documents,timeout_ms=330000`) + 件 2 叠 `cleanup_incomplete`（残留 `D:\DevEnv\Temp\rea-ghidra-6aa05de858a704cd01895e2ef9bd0f9c`）。
2. **走 `analyzeHeadless.bat` + Java 脚本**（Ghidra 12.1.4 + JDK21，PyGhidra 不可用 ⇒ 必 Java）。脚本 `D:/DevEnv/Temp/ihui-scratch/goal-b44-ghidra/SidecarSurvey.java`（五段：导出/导入/全函数名/已定义串/汇总+命名聚类）。
3. 产物全落项目外 `D:/DevEnv/Temp/ihui-scratch/goal-b44-ghidra/`；仓库树内零产物、零 `.c`。
4. 补充只读字节工具（本席临时件）：`strings-pe.mjs` / `pe-imports.mjs` / `pe-pdata-funcs.mjs`。
5. 红线：不执行 exe、不 commit/push、不贴反编译整段。

## 已踩平的两个坑（后席必读）

- `analyzeHeadless.bat` 的项目**父目录必须预先存在**，否则 `Directory not found` 且**仍 exit 0**（静默假绿）。
- 脚本任一处 Java 编译错 ⇒ `GhidraScriptLoadException: The class could not be found` ⇒ **零产物**，同样不影响退出码。前席 `goal-b42/b43-ghidra` 目录里零 `.txt`/`.c` 即此型失效（其 `harness_surface.java:28` 还含非法转义 `"D:\DevEnv\..."`）。
- ⇒ 纪律：**核验产物文件存在性，不看退出码**。复用已分析工程走 `-process <file> -noanalysis -postScript …`（≈1 分钟）。

## 进度（按产物 mtime）

- [x] 首行留痕
- [x] 静态层：两件 PE（导出 0/0；导入 238/110；`.pdata` 函数 6,831/14,998）、串层（CU 25,677 条 / XL 56,302 条）、crate 台账、`.rdata` 段内协议串
- [x] 件 1 Ghidra 全量分析 00:59→01:06 + 读数 01:10 落盘（`cu_summary.txt`：TOTAL_FUNCS=6995 / EXPORTS=1(entry) / IMPORTS=233 / NAMED=69 / STRINGS=1913）
- [x] 件 2 Ghidra 全量分析 + 读数 01:07 → 01:23:14 落盘（`xl_summary.txt`：TOTAL_FUNCS=15168 / EXPORTS=2（`entry`+`tls_callback_0`）/ IMPORTS=102 / NAMED=172 / STRINGS=3864；`.pdata` 口径 14,998 互验）
- [x] 证据册 `docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T8-sidecar-native-surface.md`（A/B/C 三问 + 未知清单 + 复验命令）
- [x] 水印 inject + verify（完整载荷）

## 本席结论摘要（供主席拼矩阵）

- A：CU = Rust/Mono 工作区 `crates/qoder-cua`，**14 个工具**（含 UIA 语义 `set_value`/`perform_secondary_action` 与批量 `run_steps`）；边界实装 = revision 陈旧拒执 / 前台校验 / 启动路径核验 + `elevation_required` / `userInterruptedLatched` / 输入类永不自动重试 / 体积与树预算 / 日志脱敏黑名单 / 逐动作环境位摘线 / overlay 看门狗 / 捕获子进程隔离；**无人工审批门、无速率闸**（0 命中，不冒充）。传输 = 宿主 `spawn(... stdio:"inherit")` + MCP 形态 JSON-RPC（`mcp.initialize`/`mcp.tools_list`/`protocolVersion`）；命名管道只用于自身捕获子进程；无 TCP。另有**父进程/签名父进程校验**（启动器注释明文）。
- B：xlsx-sidecar = **含写回**（`save_archive`/`convert_workbook`/`recalc_cells` + `ZipWriter`）；协议 = 自研 sidecar 命令枚举（serde 内部标签，**14 命令** + `version` 握手 + `requestId` + `cancel`）；引擎 = **包装开源栈**：vendored `calamine` 分叉（读）+ `ironcalc 0.7.1`（算，只见 `import/` 不见 `export/`）+ `zip`/`quick-xml`/`roxmltree`（容器/XML），写回疑为条目级 zip 增量重写。
- C：导出目录两件皆 0（Ghidra 只把入口点/TLS 回调算作外部入口：件 1 为 `entry`，件 2 为 `entry`+`tls_callback_0`）；函数件 1 = 6,995（Ghidra）/6,831（`.pdata`），件 2 = 15,168（Ghidra）/14,998（`.pdata`）；两件皆 Rust 且 **rustc commit 不同**；无嵌入 `.ps1/.vbs/JS` 脚本资源。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
