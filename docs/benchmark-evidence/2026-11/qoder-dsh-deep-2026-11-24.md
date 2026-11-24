<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Qoder 加密大包 × DeepSeek Harness 协议面深读（2026-11-24）

> 纯只读取证：未运行 Qoder / DSH 本体，未 frida attach，未提取凭据，未写目标安装目录，未破解许可证。
> 证据分级：**观察**（静态直读）/ **推断**（由观察推导，未动态验证）/ **未知**（本轮静态不可见，写明具体卡点）。
> 单条连续源码片段 ≤10 行；每条证据带真跑过的复核命令。

## 0. 取证面与现读路径

| 项 | 现值（本轮现读） | 复核命令 |
|---|---|---|
| 仓库 | `C:\IHUI-AI`（main） | `Test-Path C:\IHUI-AI` |
| Qoder 安装根 | `C:\Qoder CN\resources`（任务书给的 `AppData\Local\Qoder CN\resources` 不存在；该 Local 目录下只有 `Qoder CN\Qoder CN Launcher`） | `Get-ChildItem C:\Users\Administrator\AppData\Local -Directory \| ? Name -match 'qoder'` |
| Qoder 包版本 | `package.json` → `qoder-cn` **0.5.6**，`main: ./out/main/index.js` | `node C:\IHUI-AI\scripts\benchmark-asar-read.mjs "C:\Qoder CN\resources\app.asar" --get /package.json` |
| Qoder 主包 | `resources\app.asar`，200,556,966 B（≈191 MiB）；头树解析见 E1-1 | 同上阵读器 `--list`；本轮自写只读脚本 `_scratch\qoder\asar-tree.mjs` |
| DSH 安装根 | `C:\Apps\DeepSeekHarness\resources`（任务书给的 `AppData\Local\@deepseek-ai\dsh-desktop-updater` 不存在；实测目录名为 `@deepseek-aidsh-desktop-updater`，仅含 `pending/`、`current.blockmap`、`installer.exe` 299.6MB） | `Get-ChildItem C:\Apps\DeepSeekHarness`；`Get-ChildItem "C:\Users\Administrator\AppData\Local\@deepseek-aidsh-desktop-updater"` |
| DSH 主包 | `resources\app.asar`，209,083,008 B；已解出 SDK 源码 `docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\dsh\out\@deepseek-ai\`（复用，未重解） | 上一轮取证目录列文件 |
| 只读工具 | `scripts\benchmark-asar-read.mjs`；`craft-anything-cli 0.5.0`（`C:\Users\Administrator\AppData\Local\craft-anything\0.5.0\craft-anything-cli.exe`）；rizin `C:\Program Files\Rizin\bin\rizin.exe`（本轮未动用） | `craft-anything-cli --version` |
| 上一轮资产 | `deep-native-2026-11-23\README.md / block1-dsh.md / block3-qoder.md`；`_scratch\qoder\map.json`（上一轮 js-app-map 证据 JSON） | 目录列文件 |
| Qoder scratch 根 | `C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\qoder\`（本文 prose 中 `_scratch\qoder\…` 均指此根；12 个 `.mjs` + `map.json` + `map-raised.json` 实测在位） | `Get-ChildItem "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\qoder" -Filter *.mjs` |
| DSH scratch 根 | `C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\dsh\out\@deepseek-ai\`（prose 中 `_scratch\dsh\…` 均指此根） | 目录列文件 |

---

## 目标 1 · Qoder js-app-map 覆盖率真相

> 上一轮结论：1394 文件只列到 16，源码模块 0 / IPC 0 / 路由 0。本轮要分清三种成因：**上限截断** / **加密不可解** / **动态 IPC 不在静态包内**；并把「拿不到」与「不存在」分开。

### E1-1 asar 头树实有 6448 条目（不是 1394），分三大组

- **证据**：
  - 只读脚本 `_scratch\qoder\asar-tree.mjs` 解析 asar pickle 头（前 8 字节前言 + header JSON），直读头树元数据，不解数据区：
    - `TOTAL_ENTRIES 6448`；`HEADER_SIZE 1,691,140`；`DATA_START 1,691,148`；`FILE_SIZE 200,556,966`。
    - 顶层分组：`node_modules` **4513**、`out` **1934**、`package.json` **1**。
    - 扩展名直方图（前几位）：`js 3345 / webp 876 / cjs 551 / bcmap 336 / json 290 / svg 197 / noext 164 / ts 128 / mjs 82 / mts 43 / wasm 36 ...`。
  - 上一轮 `_scratch\qoder\map.json` 自报 `stats.listed = 1394`、`stats.files = 16`、`coverage.examined = 16 / total = 1394`，limitation code `input: the ASAR listing was cut short by the file-count limit`。
  - 复核命令：
    ```powershell
    node "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\qoder\asar-tree.mjs" "C:\Qoder CN\resources\app.asar"
    Get-Content "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\qoder\map.json" | ConvertFrom-Json | Select-Object -ExpandProperty stats
    ```
- **三档**：观察 = 6448 / 4513 / 1934 / 1 为头树直读；1394 与 16 为上一轮 CLI 证据 JSON 原值。推断 = 1394 是 craft-anything 在文件计数闸前枚举到的条目数，并非 asar 头里的真实总量（头树 6448 才是包内全部登记条目）。未知 = 6448 中 `.unpacked` 外置条目占比、空 size 条目数（脚本未单独出账，下一轮补）。
- **IHUI 现状**：`Grep "asar" scripts\ -i -files_with_matches` → 23 文件；其中仅 `scripts\benchmark-asar-read.mjs` 是常驻只读解包器（`--list/--get/--grep`，自带 `ASAR_LIMIT` 默认 400 行、`ASAR_MAX` 默认 80 文件两道打印闸，见该脚本 :320 / :333），其余 `qoder-chat-bridge.mjs / qoder-local-probe.mjs / qoder-sdk-chat-probe.mjs` 为探针与桥接。**本仓没有**等价的 asar 头树递归 flatten + 顶层分组 + 扩展名直方图盘点器；解包器清单本身受 400 行闸截断（本轮 E1-1 的 6448 条目数来自 scratch 直解析脚本，不是常驻工具产出）。复核命令：
  ```powershell
  Grep "asar" C:\IHUI-AI\scripts -i -files_with_matches
  Select-String -Path C:\IHUI-AI\scripts\benchmark-asar-read.mjs -Pattern "ASAR_LIMIT|ASAR_MAX"
  ```
- **落点建议**：`scripts/` 常驻取证工具补一个 asar 头树计数/分组只读子命令（本轮 scratch 脚本 `asar-tree.mjs` 可作为原型）。
- **超越轴**：可测性。头树计数与文件总字节对账（DATA_START + 数据区长 == 文件大小），夹具自检防解析器读歪偏移。
- **最小复现范围**：解析 asar 头 → 递归 flatten → 输出条目总数、顶层分组、扩展名直方图；不读数据区内容。

### E1-2 `/out` 业务包体是**明文压缩 JS**，asar 层未加密

- **证据**：
  - 只读脚本 `_scratch\qoder\asar-out-sign.mjs` 对 `/out` 条目取首 32 字节签名：
    - 主进程：`/out/main/electronMain.js` **21,018,667 B**；`/out/main/index.js` 7,618 B；`/out/main/pluginHost.js` 60,163 B；`/out/main/remoteControlProcess.js` 16,919 B；`/out/main/workspaceFileWatchProcess.js` 8,490 B；`/out/main/dataDirectoryProcess.js` 6,611 B；preload：`/out/preload/index.cjs` 232,962 B、`pluginViewRuntime.cjs` 2,649,786 B、`pluginViewDiagramRuntime.cjs` 5,072,929 B。
    - 渲染层 1878 条目；最大 `assets/2NXLGhal.js` **16,153,805 B**，首字节明文 `const __vite__mapDeps=(i,m=__vit...`（Vite/Rollup chunk 签名）；`assets/S__Wc8-4.js` 3.30MB 同签名；`assets/DidgxRds.js` 2.63MB 首字节 `import{aP as jt,aQ as zt,...`；worker chunk `function IH(_Q,YB){return YB.for...`。
    - 非 JS 资产：`.wasm`（OfficeReader / DocumentFormat.OpenXml / System.Private.CoreLib / dotnet.native）、`.webp/.svg/.wav/.mp4` 各自文件头签名正常。
  - 复核命令：
    ```powershell
    node "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\qoder\asar-out-sign.mjs" "C:\Qoder CN\resources\app.asar"
    ```
- **三档**：观察 = 首 32 字节 hex + 可打印 ASCII 直读；业务 JS 以 `const/import/var/function` 开头，不是密文/字节码（无 V8 bytecode 魔数、无整体 base64 包裹）。推断 = 上一轮「打包 + 字符串加密」的描述需要收敛：**asar 容器与 `/out` 业务 bundle 未做容器级加密**；混淆/加密只发生在个别产物（见目标 2 的 `obf.mjs` 与依赖内个别压缩包）。未知 = 21MB `electronMain.js` 内部是否嵌有运行时才求值的加密子串（需逐串扫，本轮未做全量）。
- **IHUI 现状**：`Grep "bytenode|v8-compile-cache|\.jsc|encrypted.*bundle|signed.*bytecode" apps\ -i -files_with_matches` → 仅 1 个测试夹具命中（`apps\api\src\routes\__tests__\wechat-mini-one-tap-login.test.ts`），生产代码 0 命中。本仓 web/RN/小程序源码与桌面端 Tauri Rust 均为正常构建产物，无容器级加密或 V8 bytecode 包裹面。
- **落点建议**：无生产落点；取证台账修正上一轮「主包加密」表述。
- **超越轴**：可测性。文件头签名表（JS/wasm/webp/mp4/bytecode 魔数）落到判据，自动区分「容器加密」「bundle 压缩混淆」「单产物混淆」三态。
- **最小复现范围**：对每个文本型条目取首 32B，按魔数归类明文 JS / 密文 / 字节码 / 资产。

### E1-3 上一轮 16 文件的截断归因：craft 计数/字节闸，而非内容不可解

- **证据**：
  - `map.json` 参数原值：`params.limit=200`、`params.max_nodes=25000`、`params.offset=0`、`include_node_modules=false`；CLI 帮助（0.5.0）暴露可调闸：`--max-files`（Most files read）、`--max-total-bytes`（Most bytes read in total）、`--max-file-bytes`（Largest single file read）、`--max-nodes`、`--limit`、`--offset`。
  - 复核命令：
    ```powershell
    & "C:\Users\Administrator\AppData\Local\craft-anything\0.5.0\craft-anything-cli.exe" --deep js-app-map --help
    ```
  - 上一轮未显式传 `--max-files/--max-total-bytes/--max-file-bytes`，走默认闸；200MB 包 + 21MB 单文件最易在文件计数闸与单文件字节闸同时提前退出，只吃到 9 个 native module 节点 + 7 个 vendor package.json（`map.json.nodes` 9 条全为 native-module；`vendors` 17 条全来自 package.json）。
- **三档**：观察 = CLI 选项名、默认参数值、上一轮节点构成直读。推断 = 16 文件 / 0 模块 / 0 IPC / 0 路由的主因是**工具侧计数与字节上限截断**，不是包内没有这些面；明文 bundle（E1-2）本应能被静态解析器读到字面量通道名。未知 = 默认闸的具体阈值数值（CLI 帮助未给默认值；需 raised-limit 重跑对照，见 E1-4）。
- **IHUI 现状**：常驻解包器 `benchmark-asar-read.mjs` 自身带 `ASAR_LIMIT=400` 行 / `ASAR_MAX=80` 文件闸（:320 / :333），超闸即截断；上一轮 `map.json` 记录了 `params.limit=200 / max_nodes=25000`，但证据面未把「工具闸值」与「实读条目数 / 包内真实条目数」分栏对账。`scripts\benchmark-ours-quantitative.mjs`、`scripts\benchmark-diff-matrix.mjs` 未见「默认闸 vs 抬高闸重跑对照」的既有惯例。复核命令：
  ```powershell
  Select-String -Path C:\IHUI-AI\scripts\benchmark-asar-read.mjs -Pattern "ASAR_LIMIT|ASAR_MAX"
  Grep "max-files|max_files|max-total-bytes" C:\IHUI-AI\scripts
  ```
- **落点建议**：无生产落点；后续 benchmark 跑 craft 时显式抬高 `--max-files/--max-total-bytes/--max-file-bytes` 并在证据 JSON 里记录所用闸值。
- **超越轴**：可测性。证据台账必须区分「工具没读到」与「包内不存在」：截断 limitation 与解析为空结论分栏登记。
- **最小复现范围**：同一 asar 跑默认闸 vs 抬高闸两次，对比 `stats.files/modules/ipc/routes` 差值，量化每道闸的截断贡献。

### E1-4 抬高闸重跑 js-app-map：截断是模块/路由/窗口为 0 的主因

- **证据**：同一 asar 显式抬高闸值重跑（证据 JSON `_scratch\qoder\map-raised.json`，44.6MB）：
  - 复核命令：
    ```powershell
    & "C:\Users\Administrator\AppData\Local\craft-anything\0.5.0\craft-anything-cli.exe" --deep js-app-map `
      --input-path "C:\Qoder CN\resources\app.asar" `
      --source-paths "C:\Qoder CN\resources\app.asar.unpacked" `
      --max-files 6448 --max-total-bytes 500000000 --max-file-bytes 30000000 --max-nodes 100000 `
      --limit 2000 --output-format json
    node "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\qoder\map-summarize.mjs" "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\qoder\map-raised.json"
    ```
  - 前后对照（上一轮 `map.json` → 本轮 `map-raised.json`）：

    | 指标 | 默认闸（上轮） | 抬高闸（本轮） |
    |---|---|---|
    | listed 条目 | 1394 | **6778**（头树 6448 + unpacked 332，差 2 为 CLI 枚举口径） |
    | examined 文件 | 16 | **813** |
    | modules / bundle_modules | 0 / 0 | **637 / 198** |
    | functions / edges / nodes | 0 / 0 / 9 | **67925 / 124511 / 70274** |
    | routes | 0 | **154**（152 `/api/v1/collaboration/*` + `/livez` + `/`） |
    | endpoints | 0 | **200**（98 endpoint 节点） |
    | windows | 0 | **8**（7 窗口节点：5 BrowserWindow + 1 WebContentsView + 1 webPreferences 动态） |
    | workers | 0 | **9**（`out/main/chunks/*.js`） |
    | storage 键 | 0 | **47**；events 1098；effects 77；vendors 187；native modules 27；source maps 1（未解析） |
    | ipc_channels / paired | 0 / 0 | **0 / 0**（未随抬闸回升） |

  - 抬高闸后 CLI 自报 limitation 两条：`dynamic_ipc_channels`（**5** 个 IPC 调用通道名运行时计算，不在通道图内）；`static_only`（eval/computed require/远程内容静态不可见，IPC 配对需要字面量通道名）。
- **三档**：观察 = 两侧 stats/limitations 为证据 JSON 直读；154 条路由前缀直方图、窗口 webPreferences 字段、9 个 worker 入口均由 `_scratch\qoder\map-detail.mjs` 从 JSON 抽出。推断 = 上一轮「0 模块 / 0 路由 / 0 窗口」主要是**工具文件计数与单文件字节闸提前退出**，不是包内不存在；抬高闸后这些面基本被吃到。未知 = 813/6778 仍为 partial 覆盖，未 examined 的 ~5965 条目以静态资产（webp/wasm/woff/svg/mp4/wav）与次要 chunk 为主，是否藏有未识别代码面未逐条对账。
- **IHUI 现状**：`Grep "benchmark-asar-read|js-app-map|craft-anything" scripts\` → 仅命中常驻只读解包器 `scripts\benchmark-asar-read.mjs` 与定量对照脚本；本仓**没有**等价的 Electron 应用图解析器（模块/路由/窗口/IPC 配对图）。桌面端桥接为 Tauri Rust：`Grep "#\[tauri::command\]|generate_handler|invoke\(" apps\desktop\src-tauri\src` → 15 文件 108 处；`Grep "ipcMain|contextBridge|exposeInMainWorld|ipcRenderer" apps\` → **0 命中**（IHUI 不走 Electron IPC 全局面）。
- **落点建议**：无生产落点；benchmark 工具链补一个 asar 头树只读盘点（条目总数/分组/扩展名直方图，原型 `_scratch\qoder\asar-tree.mjs`），并在跑 craft 时显式记录所用 `--max-*` 闸值，避免把截断空图误记为「包内不存在」。
- **超越轴**：可测性。证据台账分栏「工具没读到（截断/解析缺口）」与「包内不存在（多手段复核后为空）」；夹具合成大包 asar 验证闸值抬升后计数单调回升。
- **最小复现范围**：同一 asar 默认闸 vs 抬高闸两次跑图，diff 模块/路由/窗口/端点计数；头树条目数与 CLI listed 对账。

### E1-5 IPC 为 0 的归因：压缩别名 + 主包二次混淆 + preload 字符串打包，非「无 IPC」

- **证据**（只读直扫，脚本 `_scratch\qoder\bundle-ipc-scan.mjs` / `alias-ipc-scan.mjs` / `main-on-context.mjs`）：
  - 12 个 main/preload bundle 直扫标准全局：`ipcMain.handle/on`、`ipcRenderer.invoke/send/on`、`contextBridge`、`exposeInMainWorld` 字面量 **0 命中**；全包 4325 个文本条目 `--grep` 这四个 token，仅 `electronMain.js` 命中 1 文件。
  - `electronMain.js`（21,018,667 B）电子模块压缩别名导入：`dialog as Lz, BrowserWindow as Je, shell as E4, safeStorage as hA, net as JL, session as _9, ipcMain as Yw, powerMonitor as th, ...`；别名后实测 `Yw.on(` **5 处**、`Yw.handle(` **0 处**；5 处通道名均为变量（`f0[...]`、`Ocr`、`Xcr`、`Pix`、`Mix`），无字面量。
  - 主包自带第二层字符串/VM 混淆：通道与消息字段走数值对解码器 `e(49708,57188)` / `t(n-286,r)`；`Yw.on(Ocr, async (x,e)=>{ ... f=JSON.parse(e); ... {method:f,payload:n}=e })` —— 自定义 `{method, payload}` 信封挂在 IPC 消息上（观察级片段，上下文见 `main-on-context.mjs` 输出 @20797364 / @20797722）。
  - `preload/index.cjs`（232,962 B）头 300B 即字符串数组打包器：`"use strict";(function(e,a){function n(o,i){return h(i-588,o)} ... parseInt(n(...))/1 ...`，`ipcRenderer/require('electron')/contextBridge/expose/window./postMessage/addEventListener/MessageChannel` 计数全 **0** —— 符号名在打包串内，静态不可见。
  - `preload/pluginViewRuntime.cjs`（2,649,786 B）：`window.*` 198、`postMessage` 25、`addEventListener` 253、`MessageChannel` 6、`expose*` 6；渲染侧桥走 window/postMessage/MessageChannel，不走 contextBridge/ipcRenderer。
  - 复核命令：
    ```powershell
    node "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\qoder\bundle-ipc-scan.mjs" "C:\Qoder CN\resources\app.asar"
    node "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\qoder\alias-ipc-scan.mjs"
    node "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\qoder\main-on-context.mjs"
    ```
- **三档**：观察 = 别名映射、5 处 `Yw.on`、打包器头片段、postMessage/MessageChannel 计数均为静态直读。推断 = 渲染↔主进程通信实况存在（主侧 5 个 on 注册 + 渲染侧 postMessage/MessageChannel 面），但通道名与暴露面被压缩别名和字符串打包遮住，静态解析器按标准全局字面量配对必然落空；CLI 报的 5 个 `dynamic_ipc_channels` 与这 5 处变量通道对应。未知 = 5 个通道名明文、preload/index.cjs 暴露的全局 API 面、`{method,payload}` 信封的方法清单，需解码主包字符串表（见目标 2 同类混淆）或动态观察；本轮受只读约束未解码。
- **拿不到 vs 不存在**（本轮判据）：
  - **拿不到（静态缺口，不等于无）**：别名后的 `Yw.*` 调用配对；主包 `e(num,num)` 表内通道名；preload 打包串内符号；运行时 computed 通道；webPreferences/preload 路径动态值；eval/computed require/远程内容。
  - **未见存在证据**：标准 `ipcRenderer.*` 调用面、`contextBridge.exposeInMainWorld` 暴露面、`ipcMain.handle`（invoke 风格注册）在 12 个 bundle 中 0 命中；但渲染侧是否另有独立 preload 走 ipcRenderer，静态未排除（preload 路径运行时才确定）。
- **IHUI 现状**：Tauri 命令桥 15 文件 108 处（`terminal_ipc.rs` / `workspace_fs_ipc.rs` / `sandbox_ipc.rs` / `git_channel_ipc.rs` 等），命令名在 Rust 侧静态可见；无 Electron 别名/打包混淆问题。
- **落点建议**：无生产落点；取证侧若后续要补 Qoder 通道面，先解主包与 preload 的字符串表（目标 2 同款方案），再做别名调用配对，不直接跑动态 attach。
- **超越轴**：fail-closed 边界 + 可测性。桥接判据支持别名导入映射还原；通道名取不到时记「未判定」，不记「无通道」；夹具模拟压缩别名与字符串打包两种混淆，钉住解析器不把别名调用漏判为缺失。
- **最小复现范围**：解析 `X as Y` 导入别名 → 跟踪 `Y.handle/on/invoke/send`；收集变量形通道注册；字符串打包器产物单列「待解码」档，不并入「不存在」。

---

## 目标 2 · Qoder XOR 字符串池可解性判定

### E2-1 首行即内联解码函数：密钥是模块内默认常量，非运行时注入

- **证据**：
  - 文件：`C:\Qoder CN\resources\app.asar.unpacked\node_modules\@qoder-ai\qoder-cn-agent-sdk\dist\_worker\qoder-worker-runtime.obf.mjs`，**34,873,160 B（33.26 MiB）**。
  - 首行（≤10 行片段，逐字直读）：
    ```js
    const _$d1=(s,k="9cuktO7efVDf")=>{const b=Buffer.from(s,"base64");for(let i=0;i<b.length;i++)b[i]^=k.charCodeAt(i%k.length);return b.toString()};
    ```
  - 方案拆解（观察级）：入参 `s` 先 `Buffer.from(s,"base64")` 解码；再按 `k` 做**循环重复密钥 XOR**（`i % k.length`）；`k` 默认值常量 `"9cuktO7efVDf"`（13 字符）；输出 `b.toString()`（默认 utf8）。
  - 复核命令：
    ```powershell
    $obf="C:\Qoder CN\resources\app.asar.unpacked\node_modules\@qoder-ai\qoder-cn-agent-sdk\dist\_worker\qoder-worker-runtime.obf.mjs"
    $fs=[System.IO.File]::OpenRead($obf); $b=New-Object byte[] 600; $fs.Read($b,0,600)|Out-Null; $fs.Close()
    [System.Text.Encoding]::UTF8.GetString($b)
    ```
- **三档**：观察 = 函数体、默认密钥字面量、XOR 下标取模写法逐字直读。推断 = 字符串池由同一 `_$d1` 包裹 base64 密文串，静态可解（密钥住产物本身，不依赖宿主下发/登录态/远端派生）。未知 = 是否存在第二参数覆写 `k` 的调用点、是否还有第二个解码器（E2-2 核验）。
- **IHUI 现状**：复用 E2-2 同组 grep：`Grep "charCodeAt(... )^|RC4|rc4" apps\ai-service\app` → 0 命中；`apps\desktop` → 0 命中。本仓无 base64+循环 XOR 的字符串混淆产物，也无对应离线解码工具；文案、字段名以明文源码与 PostgreSQL 台账为准。复核命令：
  ```powershell
  Grep "RC4|rc4" C:\IHUI-AI\apps\ai-service\app -files_with_matches
  Grep "RC4|rc4" C:\IHUI-AI\apps\desktop -files_with_matches
  ```
- **落点建议**：无生产落点（不复制其混淆）；取证侧可写一个只读离线解包器，对 `_$d1("...")` 字面量批量还原做行为分析。
- **超越轴**：可测性。解码器纯函数 + 夹具：已知明文 → base64 → XOR → 密文，往返对称断言；密钥轮换时以参数注入而非改函数体。
- **最小复现范围**：默认密钥循环 XOR + base64 往返；只解抽样串，不全量 dump 34.8MB。

### E2-2 覆盖性核验：17,325 个调用点零覆写；另有第二层 RC4 字符串数组混淆

- **证据**（只读扫描，脚本 `_scratch\qoder\obf-scan.mjs` / `obf-scan2.mjs` / `obf-scan3.mjs` / `obf-scan4.mjs`）：
  - 主解码器 `_$d1(` 调用点 **17,325**；带第二参数（覆写密钥）的调用 **0**；密钥字面量 `"9cuktO7efVDf"` 全文件出现 **1** 次；解码器定义在偏移 0，未被二次赋值。
  - 外部密钥来源排查：`process.env` 753 处、`readFileSync` 116 处、`import.meta` 35 处均为应用配置/资源读取，不在解码器取数路径上；未发现 env/宿主消息/磁盘文件向解码器喂密钥。
  - **第二层 RC4 字符串数组**（两处重复 chunk，函数 `Vc` @23,321,496 与 `bo` @32,076,687）：
    - 外层按索引查字符串数组 `zft()` / `q4t()`（`A-=225` / `A-=396` 索引基偏移），懒构建内层 RC4 解码器并缓存。
    - 内层：先按自定义字母表做类 base64 解码，字母表串本身由第一层解出 —— `_$d1("WAEWDxEp...REk=")` 解码结果 = `"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/="`（标准 base64 字母表）；随后 RC4 KSA：`n=(n+r[i]+e.charCodeAt(i%e.length))%256` 置换 s-box，PRGA：`o+=String.fromCharCode(A.charCodeAt(e)^r[(r[i]+r[n])%256])`。
    - 调用点：`Vc` 30 处、`bo` 128 处；第二参数（RC4 键）实测为内联 4 字符字面量：`hufI` / `pE20` / `%V[[` / `T0eb` / `cMka` / `yv4h`；多数调用为单参形式（数组索引），键形待逐点复核。
  - 其余候选排除：11 处 `atob(` 为 JWT 段解码校验、zod base64 refine、Uint8Array 转换等应用逻辑；44 处 `Buffer.from(...,"base64")` 中 1 处为主解码器，余为 base64 工具/协议字段；133 处 `fromCharCode`/`^=` 为压缩代码算术，非字符串解码器。
  - 复核命令：
    ```powershell
    node "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\qoder\obf-scan.mjs"  <obf.mjs>
    node "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\qoder\obf-scan2.mjs" <obf.mjs>
    node "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\qoder\obf-scan3.mjs" <obf.mjs>
    node "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\qoder\obf-scan4.mjs" <obf.mjs>
    ```
- **三档**：观察 = 调用点数、零覆写、密钥出现次数、RC4 KSA/PRGA 片段、内联键样本、字母表解码结果均为静态直读。推断 = 两层混淆串联：第一层 XOR 池供第二层字母表与部分明文；第二层 RC4 保护字符串数组条目。未知 = ① 字符串数组在加载时是否经洗牌 IIFE 旋转（索引基偏移已见，洗牌例程未逐行复核）；② 单参 RC4 调用的键来源；③ 长尾巴密文（最大 76,800 b64 字符）是否内嵌模板/资产及其编码形态。
- **IHUI 现状**：`Grep "charCodeAt(... )^|RC4|rc4" apps\ai-service\app` → **0 命中**；`apps\desktop` → **0 命中**。本仓源码无同类字符串混淆/解码例程（对照面仅作取证记录，不引入混淆）。
- **落点建议**：无生产落点；取证侧可写只读离线还原器：先复刻第一层 XOR 解字母表，再复刻数组洗牌 + RC4 例程解第二层；输出明文词表供行为分析，不回写目标目录。
- **超越轴**：可测性。两层解码均为纯函数可夹具化：已知明文往返对称；键与字母表注入参数；解码失败（非 base64 / 长度不齐）显式抛「未判定」，不冒认明文。
- **最小复现范围**：第一层 base64 + 13B 循环 XOR 往返；第二层类 base64 字母表 + RC4 KSA/PRGA；数组索引偏移与洗牌复刻；抽样解码，不全量 dump 34.8MB。

### E2-3 抽样解码验证与池结构特征

- **证据**：
  - 抽样前 25 个第一层密文，按默认密钥离线解码，**25/25 为可读 UTF-8**（printable 比例 1.00）。明文类别样本：
    - CLI/校验报错：`must be a valid directory name after NFC normalization: 1-64 Unicode characters...`、`--config-dir requires a directory path`、`failed to extract native modules`、`Infinite recursion detected in robustRealpath: `；
    - 环境变量名：`GEMINI_CLI_MAX_MCP_OUTPUT_TOKENS`、`GEMINI_CLI_ACTIVITY_LOG_TARGET`、`GEMINI_FORCE_ENCRYPTED_FILE_STORAGE`、`QODER_SECURITY_SCAN_SETTINGS_JSON`、`SYNC_PLUGIN_INSTALL_TIMEOUT_MS`；
    - SSE 字段路径：`response.reasoning_summary_text.delta`、`response.function_call_arguments.delta`；
    - 远端地址：`qoder-ide.oss-ap-southeast-1.aliyuncs.com`；ASCII art 横幅；注释串 `# Qoder local files (private, not committed)\n`；zod 校验词表（`maxLength/maxProperties/maxItems`）；审批/会话状态词（`cancelled/unavailable/completed/assistant`）。
  - 密文 base64 长度分布（16 字符桶，前几位）：32B×3180、48B×5845、64B×3062、80B×1633、96B×960、112B×552、128B×365 …… 主体集中在 **32–112 b64 字符**（短串：变量名/字段路径/短句）；长尾 128–2912B 成百条，极端 3376–76,800B 各 1 条（疑似内嵌模板/横幅/资产）。
  - 相邻字节规律：密文为标准 base64 可打印字符集；第一层为逐字节循环 XOR（密钥 13 字符周期），短串明文以 ASCII 字母/空格为主，未观察到压缩或二次加密痕迹。
  - 复核命令：`node <Qoder scratch 根>\obf-scan.mjs <obf.mjs>`（样本解码与长度直方图在输出内；`<obf.mjs>` 路径见 E2-1 证据行）。
- **三档**：观察 = 25 条样本明文、长度桶计数直读。推断 = 池内主体是 CLI 文案、env 名、协议字段路径与状态枚举；长尾大条目需单独抽样定性。未知 = 全量 17,325 条的类别占比、第二层 RC4 数组条目明文、长尾巴条目内容（本轮未全量解码，未暴力穷举）。
- **IHUI 现状**：无对照混淆池；本仓文案/字段名以明文源码与 PostgreSQL 台账为准。
- **落点建议**：无生产落点；取证报告引用明文样本时逐条标注「第一层抽样解码」，不把样本外推为全池内容。
- **超越轴**：可测性。解码器输出附可读率/长度分布/类别标签，低可读条目单列待核，不并入已解池。
- **最小复现范围**：抽样 ≤25 条验证方案；长度直方图全量统计不解内容；长尾条目单独标记待二次抽样。

---

## 目标 3 · DeepSeek Harness 协议逐帧对照

> 源码面：`_scratch\dsh\out\@deepseek-ai\`（上一轮已解出，只读复用）。本仓对照件：
> `apps\ai-service\app\services\tool_result_pruner.py`、`apps\ai-service\app\core\compaction_retention.py`（均存在，已 `Test-Path` 确认）。

### E3-1 SDK JSON-RPC 帧格式：方法名清单 / 必填字段 / 错误码枚举

- **证据**：
  - 源码包 `_scratch\dsh\out\@deepseek-ai\dsh-sdk-protocol\`：`src/index.ts`（导出面 :11-43）、`src/transport.ts`（287 行）、`src/types.ts`（243 行）、`README.zh.md`。
  - **帧封装**（transport.ts）：
    - :2-4 头注：Newline-delimited JSON-RPC 2.0 over byte streams；带 `id`+`method` 是请求，仅 `id` 是响应，仅 `method` 是通知；畸形行忽略；handler 失败转错误帧。
    - :188 `buffer.indexOf('\n')` 按换行分帧；:219-223 三态分类；:279-281 `objectParams`：params 为非数组对象才透传，数组/标量塌成 `{}`。
    - :128 请求 id = `req_${randomUUID().replaceAll('-','')}`；:129 出站请求 `{jsonrpc:'2.0',id,method,params}`；:165 通知无 params 时省略 `params` 成员。
    - :270-275 `failPending`：一次失败粘性拒绝全部挂起请求；abort 删挂起、迟到响应忽略（pending Map 内）。
  - **client→server 请求**（types.ts:210-219 `HarnessSdkRequestMap`），必填字段：

    | 方法 | 必填 params | result | 源码行 |
    |---|---|---|---|
    | `initialize` | `cwd: string`、`provider: string`、`model: string`；可选 `approvalRequests?`、`reasoningEffort?`、`maxTokens?`、`capabilities.userQuestions?` | `serverInfo:{name,version}`；name 固定 `deepseek-harness-sdk-runtime`，version `0.0.1`，无版本协商、客户端不校验 | types.ts:18-33, 65-68；README:80,140 |
    | `session/prompt` | `sessionId: string`、`contentBlocks: SdkPromptContentBlock[]` | `{messageId}` | :71-76, 93-96 |
    | `session/query` | `sessionId`、`contentBlocks[]` | `{kind:'prompt',messageId}` \| `{kind:'command',execution}` | :99-113 |
    | `session/resume` | `sessionId` | `{}` | :119-122 |
    | `session/wait` | `sessionId` | `{}` | :125-128 |
    | `session/working-directory/get` | `sessionId` | `{cwd}` | :131-134, 143-146 |
    | `session/working-directory/set` | `sessionId`、`path: string` | `{cwd}` | :137-140 |
    | `shutdown` | 无 params | `{}` | :218 |

  - **server→client 请求**（需 opt-in）：`approval/request`（:222-237；params `sessionId`、`toolName`，可选 `callId?`、`reason?`；result `outcome: 'allowed-once'|'rejected'|'cancelled'`）；`user-question/ask`（:36-49, :61；params `requestId`、`sessionId`、`questions[]`；result 答案批 `[{id,selected,custom?}]` 或 `{cancelled:true}`）。
  - **通知**（:194-207 `HarnessSdkNotificationMap`）：`user-question.cancelled`、`session.event`、`session.status`（`idle|running`）、`session.query.completed`、`subagent.started`、`subagent.finished`。
  - **错误码**：
    - 传输级数值码（transport.ts:62-63）：`-32601` 无对应 handler；`-32603` handler 失败；无 handler 的通知丢弃。
    - 业务级码（`dsh-user-questions/src/index.ts` `UserQuestionError`，:46-51，code 为字符串）：观察到 `ASK_ABORTED`(:56)、`CALLER_NOT_LIVE`(:142)、`DELEGATED_CALLER`(:148)、`REPLY_QUEUED`(:178)、`BAD_ANSWER`(:189)、`BAD_TIMEOUT`(:245)、`DUPLICATE_WAIT`(:249)、`ASK_TIMED_OUT`(:251)、`EMPTY_QUESTIONS`(:296)、`BAD_INTENT`(:327/330/333/336)、`NO_PROVIDER`(:342)；协议 README:74 另列 `PROVIDER_ERROR`、`ASK_CANCELLED`。
  - 复核命令：
    ```powershell
    Select-String -Path "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\dsh\out\@deepseek-ai\dsh-sdk-protocol\src\transport.ts" -Pattern "32601|32603|indexOf|objectParams|req_|failPending"
    Grep "':" "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\dsh\out\@deepseek-ai\dsh-sdk-protocol\src\types.ts"
    ```
- **三档**：观察 = 方法名、字段可选性、传输码、业务码串均为源码直读。推断 = 业务码经错误帧 `error.data`/message 上呈（README:74「无效答案批次返回 BAD_ANSWER，宿主或传输失败返回 PROVIDER_ERROR」）。未知 = 业务码到 JSON-RPC error 对象的精确封装位置（`UserQuestionError` → 服务端插件 `dsh-sdk-jsonrpc-server` 的映射代码不在本轮解出包清单内，未见该包目录）；请求方法表内**无取消方法**（无 `session/cancel` 类条目），`shutdown` 为进程级关闭；问题等待仅当前进程（README 已知限制侧观察）。
- **IHUI 现状**：`apps\ai-service\app\services\acp_bridge.py` 同走 JSON-RPC 2.0，但承载是 **HTTP 请求/响应 + 批量数组（上限 20，:38）**，不是 stdio 换行分帧；方法集 `initialize / authenticate / session/new / session/load / session/list`（:51），流式方法 `session/prompt / session/cancel / session/set_mode / session/set_model` 在 HTTP 桥显式拒为 `-32001 unsupported`（:52, :151-155）。错误码：规范值 `-32700 / -32600 / -32601 / -32602 / -32603`（:41-45）+ 自定义段 `-32000 unsupported`、`-32001 unsupported-streaming`（:47-48）；响应信封 `{jsonrpc:'2.0',id,result|error}`（:57-65）。仓内另有两处 stdio/JSON-RPC 面，均非 DSH 式换行分帧 SDK 会话协议：`api\v1\lsp.py` 是 LSP 子进程客户端，走 **Content-Length 头帧**（:18, :242, :344, :463）；`core\agent_plugin_mcp_server.py` 只登记 MCP 传输族 `Sse / Stdio / StreamableHttp`（:36-38），无 DSH `session/prompt|query|wait|working-directory/*` 方法集。复核命令：
  ```powershell
  Grep "jsonrpc|METHOD_NOT_FOUND|UNSUPPORTED|_HANDLED_METHODS" C:\IHUI-AI\apps\ai-service\app\services\acp_bridge.py
  Grep "Content-Length|stdio|jsonrpc" C:\IHUI-AI\apps\ai-service\app\api\v1\lsp.py
  Grep "Sse|Stdio|StreamableHttp" C:\IHUI-AI\apps\ai-service\app\core\agent_plugin_mcp_server.py
  ```
- **落点建议**：`apps\ai-service\app\services\acp_bridge.py`——若后续要接 stdio 换行分帧的 SDK 客户端（对标 DSH `dsh-sdk-client` / Python SDK），帧解析（换行分帧 + 三态分类 + `objectParams` 塌缩 + 粘性失败拒绝挂起）抽成协议适配层独立纯函数；现有 HTTP 桥不动。
- **超越轴**：契约可测性。方法名/必填字段/错误码枚举落 schema 夹具：畸形行、数组 params、迟到响应、粘性失败四组用例钉住；协议方法清单单一真相源，客户端/服务端两侧同表对账。
- **最小复现范围**：换行分帧解析器（buffer 切行 → JSON.parse → id/method 三态分流）；方法表 + 必填字段校验；错误码映射表；不接真实子进程。

### E3-2 `dsh-schedule` 跨会话提醒语义：触发条件 / 去重 / 错过窗口处理

- **证据**：包 `dsh-schedule\`；README.zh.md、`src/runtime.ts`、`src/domain.ts`、`src/delivery-history.ts`、`src/types.ts`、`src/storage.ts`。
  - **持久化与存活**：任务在 Host 打开时全量载入内存并校验（README:84）；存 `<DSH_HOME>/storages/schedule.json` 或 SQLite `u_schedule_tasks.value`（README:82）；任务重启后保留，但投递时宿主必须运行（README:12, 279）。
  - **触发条件**：七种 timing `after / at / every / daily / weekly / cron / rrule`（README:63）；runtime.ts:196-225 `drive()` 到期判据 `status==='active' && !executing.has(id) && Date.parse(scheduledAt) <= scanNow`；单定时器 `setTimeout` unref，每次 drive 后按最近到期时点重算（:213-223）。
  - **投递目标**：`session`（复用已有未归档非委派 Session）、`new_once`（预留 Session id，首投创建后复用）、`new`（每次投递新建 Session）（README:71, 112；runtime.ts:59-64 批次分组）。
  - **去重 / 准入闸**：`nextAdmissionAt`（runtime.ts:288-297）——`new` 目标用 `newSessionIntervalMs`（默认 60s，范围 60–604800，README:59），其余 `MIN_DELIVERY_INTERVAL_MS`（≥60s）；锚点逻辑保证回执延迟不跨发生时点累积；`executing` Set 持有复用目标执行槽直到 whole-agent idle，`new` 目标无槽、可并发重叠（:70, :175-179；README:285）。
  - **投递历史与保留**：`appendDelivery`（delivery-history.ts:19-38）——历史按 `days`（默认 30，1–3650）窗口 + `records`（默认 200，1–10000）双限裁剪，新的存活；裁剪置 `earlierRecordsUnavailable / earlierRecordsPruned` 标记；分页按 `messageId` 游标、newest-first（:47-65）。
  - **错过窗口（关机/离线）**：
    - 重复任务只取**最近一次**错过的发生时点，不回放积压：`resolveEveryOccurrence`（domain.ts:625-655）`steps=floor((acceptedAt-target)/interval)`，occurrence=target+steps·interval；daily/weekly 走 `latestDueOccurrence`（:697 起向前回溯到最近匹配日）；头注 :86「One latest-only recurring decision derived without enumerating a backlog」。
    - 重启后在途投递恢复：`recoverOutstandingExecution`（runtime.ts:309-330）——按 `lastDelivery.messageId` 在恢复会话 inbox 中查找，仍排队则重新占槽；归档会话闸拦住该轮；找不到消息则不占槽。
    - 至少一次投递：Session flush 与回执是独立提交，崩溃后可能重复投递；回执只证明收件箱持久化，不证明执行完成（README:280）。
    - 失败不自动重试：投递被拒/恢复/入队失败保留任务并警告，无重试循环；后续管理变更、唤醒或重启可再试（README:279）；`deliverDue` 失败成员留在 due 集，定时器跳过直到下一次 drive 请求（runtime.ts:277-284）。
    - 批投：同 `session` 目标的到期重复任务合并一条批次消息；`after/at` 绑定 Session、`new_once` 首投、`new` 每次投递、`run()` 手动触发走单条消息（README:229；runtime.ts:207-210, 258-262）。
  - 复核命令：
    ```powershell
    Grep "resolveRecurringOccurrence|latestDueOccurrence|nextAdmissionAt|executing|appendDelivery" "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\dsh\out\@deepseek-ai\dsh-schedule\src"
    ```
- **三档**：观察 = 触发判据、锚点公式、双限裁剪、latest-only 选取、恢复查找均为源码直读。推断 = 错过窗口策略是「醒后补最近一次 + 其余丢弃」，积压发生时点不逐条补投。未知 = ① 跨时区 DST 边界日的发生时点选取细节（`resolveLocalInstant` 返回 undefined 的跳过分支，本轮未逐行跑用例）；② `run()` 手动触发与最小间隔闸在 `new` 目标上的边界；③ SQLite 后端下崩溃恢复与 JSON 后端是否同语义（存储层未逐行对账）。
- **IHUI 现状**：`Grep "schedule|cron|reminder" apps\ai-service\app -i -files_with_matches` → 后台周期调度器一组：`self_media_scheduler`、`news_scheduler`、`checkin_scheduler`、`db_sync_scheduler`、`dream_scheduler`、`skill_evolution_scheduler`、`meta_learner_scheduler`、`ab_test_scheduler`（main.py:458-694 启动）；`dag_scheduler.py` 是依赖图流水线引擎（节点重试/退避/trace，:5-15），其 `scheduledAt` 是队列节点时间，不是会话提醒目标。**未见**对标 DSH 的：持久化发生时点 + `session/new_once/new` 三类投递目标、投递回执历史与双限裁剪、错过时点 latest-only 合并、在途投递重启恢复占槽。复核命令：
  ```powershell
  Grep "create_thread|enqueue|user_message|delivery_history|receipt" C:\IHUI-AI\apps\ai-service\app\services -glob "*scheduler*.py"
  ```
- **落点建议**：`apps\ai-service\app\services\` 新增会话提醒服务（对标 dsh-schedule，建议文件名 `session_scheduler.py`），持久化落 PostgreSQL（项目偏好禁 sqlite）：任务表（kind/规则/目标类型/目标 sessionId/scheduledAt/status）+ 投递回执表（scheduleId/messageId/sessionId/scheduledAt/deliveredAt/digest）；复用现有周期调度器入口驱动 drive()。
- **超越轴**：语义严谨性。① 回执延迟不跨时点累积的锚点公式（DSH runtime.ts:293-295）复刻为纯函数夹具；② 错过窗口策略显式建模为枚举（latest-only / replay-all / drop），不藏在调度器实现里；③ 至少一次投递与「回执≠执行完成」在台账字段上分列；④ 归档/委派会话准入闸独立可测。
- **最小复现范围**：任务 CRUD + 单定时器 drive 循环；到期过滤 + 最小间隔闸；latest-only 发生时点计算（every/daily 两类先做）；回执追加与双限裁剪；不接真实 Agent 会话，目标用桩。

### E3-3 `dsh-spill-policy` 与本仓 pruner / compaction_retention 边界对照

- **证据**：
  - **DSH 侧三层分工**（scratch 包清单直读）：
    1. `dsh-output-retention`：低层 retainer 库——`ItemRetainer`（仅 head，逐项精确省略计数）、`TextRetainer`（head/tail/headTail 字节窗口，UTF-8 边界修剪）、`formatRetentionNotice` 标准省略子句、`truncateWithoutSplittingSurrogatePair`；分组/行号/spill 文件/提供方错误归工具（README:12, 28-44, 115-119）。
    2. `dsh-spill-policy`：单工具结果策略层——`Config.maxInlineTokens?`（省略即禁用，index.ts:50-51；非安全整数/负数加载期抛错 :52-54）；文字+图片+说明+提示共享估算 token 预算（README:43, 83）；超预算先 `spillStore.saveText` 存完整结果（:104-107），预告留 worstNotice 预算，提示本身超预算则该次替换禁用（:112-114）；`retainContent` 头尾各半预算（retention.ts:58, 75），图片整张不可切、文字二分拟合单调价格（:27-37, 68-72），省略计数 `omittedBytes / omittedImages`（:95-103）；fail-open：缺归属/后端/图片计价/不可读路径 → warn 并保留原内容（:128-131；README:65）；监听 `tools/post-execute`（prepend，跳过 `read`/被阻止决策/值替换，:134-141）与 `tools/ptc-dispatch-log`（:153-156）；纯文本子调用日志异步设限，不延迟返回值（README:69）。
    3. 会话级保留区：本轮解出包清单内**未见**对标 `compaction_retention` 的 session 级压缩/保留区包（`dsh-agent-team` 内部可能含，未逐文件核）。
  - **IHUI 侧三层**（已读源码）：
    1. `services\tool_result_pruner.py`：确定性无模型头/中/尾裁剪；默认阈值 `threshold 8192` 码点、head 4096、tail 1024（:51-53）；`PruneConfig.__post_init__` 构造期校验 head+marker+tail ≤ threshold（:75-88）；`measure_content` 非 text 块计 0、text 计 Unicode 码点（:113-119）；`prune_content` 单次 marker 插入 + 裁后必须更小且 ≤ threshold 否则抛 ValueError（:122-168）；marker 文案 `… [tool result trimmed — full output omitted] …`（:56），**无落盘路径、无省略字节/图片计数**。
    2. `services\tool_output_artifacts.py`：独立落盘续读层——完整输出存 `.ihui-agent/tmp/tool-output/<artifactId>.txt` + `.json` 元数据（:11-13）；上下文只留 sha256 digest + 预览 + 五项凭据（artifactId/offset/next/complete/digest，agent_loop_v2.py:2613-2621）；`read_tool_output` 按 offset 分页续读；单工件 2M 字符上限，超出标 `truncatedOnDisk`（:20-21, :45）；7 天惰性清理（:47）；落盘失败退回历史临时文件路径并在正文明示未能落盘（agent_loop_v2.py:2630-2634）。
    3. `core\compaction_retention.py`：会话级保留区——总预算 64,000 token、单条 agent 消息上限 10,000（:57-59）；按轮组（assistant + tool 回复同进同退）从最新向旧纳入，整组不 fit 即淘汰该组及更旧（:197-208）；图片预算开关：Disabled 默认剥 base64 计 0，Enabled 按占位成本（:68-97, :171）；token 估算复用 tiktoken `estimate_messages_tokens`；历史窗口超限走 governor 具名拒绝，不静默少给行（:142-164）；摘要头前置（:263-267）。
  - **边界对照**：

    | 维度 | DSH spill-policy | IHUI pruner + artifacts | 谁更严 / 缺什么 |
    |---|---|---|---|
    | 预算单位 | 估算 token（文字 token-meter + 模型图片计价 imageRequestPricing） | pruner 码点；artifacts 字符；主循环入参前先 `_estimate_tokens_len` 估 token（agent_loop_v2.py:2588, 2594） | DSH 图文共享同一 token 预算；IHUI pruner 层图片计 0 直通，图片成本只在保留区层开关处理 |
    | 头尾分配 | 预告留预算后剩余预算头尾各半（ceil/floor）；不可切图片占用空间闲置 | head 4/5、tail 1/5（`_prune_preview`，agent_loop_v2.py:2553-2554）；构造期 head+marker+tail ≤ threshold 硬校验 | IHUI 构造期不变量更硬；DSH 预算为估算、允许提示装不下时整次禁用替换 |
    | 可恢复性 | 完整结果存 spill 后端，提示带可读路径 + 省略字节数 + 省略图片数；图片附件路径记录、字节不入 spill 文件 | 完整输出落工件文件，正文带 artifactId 凭据（非文件路径）+ digest + 总字符 + truncatedOnDisk；`read_tool_output` 分页续读 | 两侧都可恢复；DSH 提示直给路径与图片计数，IHUI 走凭据 + 独立读取工具；IHUI 有 2M 落盘硬上限与 7 天保留，DSH 保留期归 spill 后端/附件存储 |
    | 故障行为 | fail-open：计价/后端/归属/路径任一不可用 → warn + 保留原内容（index.ts:128-131） | pruner 不变量违例抛 ValueError，主循环 `except ValueError` 退回纯截断（agent_loop_v2.py:2564-2565）；artifacts 落盘失败退回临时文件并明示 | DSH 故障语义更显式（保留原文 + 记因）；IHUI 退回路径有兜底但「未能落盘」仅在 artifacts 分支标注 |
    | 日志副本 | PTC 程序收完整规范值；含图片子结果转发前设限；纯文本子调用日志异步设限不延迟返回 | 账行/事件与上下文共用同一份 artifact 凭据（agent_loop_v2.py:1229-1232）；模块本身不出双副本语义 | DSH 明确区分模型可见副本与程序完整值；IHUI 凭据先行、完整值在工件层 |
    | 会话级保留区 | 本轮解出包内未见对照包 | 64k token 轮组淘汰 + 10k 单条截断 + 图片开关 + 摘要头 | IHUI 此层无 DSH 静态对照（未知：dsh-agent-team 内部压缩策略未核） |

  - 复核命令：
    ```powershell
    Grep "maxInlineTokens|spillStore|retainContent|omittedImages|keeping the inline content" "C:\IHUI-AI\docs\benchmark-evidence\2026-11\deep-native-2026-11-23\_scratch\dsh\out\@deepseek-ai\dsh-spill-policy\src"
    Select-String -Path C:\IHUI-AI\apps\ai-service\app\services\tool_result_pruner.py -Pattern "THRESHOLD|HEAD|TAIL|MARKER|post_init"
    ```
- **三档**：观察 = 两侧阈值、字段、分支、保留参数均为源码直读。推断 = DSH 策略层与 retainer 库分离（机制归库、业务归工具），IHUI 裁剪纯函数与落盘工件分离（pruner 零 IO、artifacts 管持久化），分工思路同构。未知 = ① DSH spill 后端本地实现（`dsh-spill-local`）的保留期/容量上限未在本轮清单内；② IHUI 图片块在 pruner 直通后是否在 artifacts 落盘（`serialize_tool_payload` 对图片 part 的形态未逐行核）；③ DSH 会话级压缩对照包的位置与预算参数。
- **IHUI 现状**：见上表；本仓已有「确定性裁剪 + 工件落盘续读 + 会话保留区」三层，缺的是 DSH 式图文共享 token 计价、省略字节/图片精确计数、fail-open 保留原文的显式分支。
- **落点建议**：
  - `apps\ai-service\app\services\tool_result_pruner.py`：`ContentBlock` 扩展 image 形态与计价注入点（价格函数作参数，复刻 retention.ts `price(block)` 签名），补 `omittedBytes/omittedImages` 计数返回值；不动现有码点默认值。
  - `apps\ai-service\app\services\tool_output_artifacts.py`：省略提示补「省略字符数 + 图片数」字段（对齐 `formatSpillNotice` 的 exact 计数语义）；落盘失败分支补原因记日志（对齐 DSH warn-and-keep）。
  - `apps\ai-service\app\core\compaction_retention.py`：图片计价若接模型图片计算器，对齐 DSH `visualTokens + 说明文字` 的共享预算口径。
- **超越轴**：可恢复性与诚实计数。① 省略计数按实际返回内容反推（DSH output-retention README:119 批评「仅按预算推导的通知会高估保留文本」），IHUI 工件层已有 `chars/bytes` 实测，可下沉到 pruner 返回值；② 图片不可切、文字可切的两档保留策略夹具化；③ fail-open 路径记因不静默；④ 预览截断与落盘凭据共用同一来源，杜绝两套 offset。
- **最小复现范围**：纯函数 `retainContent` 等价物（head/tail + 价格函数 + 省略计数）；pruner 配置不变量校验；工件落盘 + 分页续读 + truncatedOnDisk 标记；不接真实 LLM 计价，价格函数桩注入。

---

## 进度与未判定登记（本轮持续更新）

| 目标 | 走到哪一步 | 未判定项与具体卡点 |
|---|---|---|
| 1 Qoder 覆盖率 | **已闭合**：头树 6448 条目直读；`/out` bundle 明文签名取证；默认闸 vs 抬高闸对照完成（examined 16→813，modules 0→637，routes 0→154，IPC 仍 0）；IPC 为 0 归因到压缩别名 + 主包二次混淆 + preload 字符串打包 | ① 813/6778 未 examined 条目是否藏未识别代码面（静态资产为主，未逐条对账）；② 5 个变量通道名明文、preload/index.cjs 暴露的全局 API 面、`{method,payload}` 信封方法清单（卡在主包字符串表未解码，受只读约束未动态观察） |
| 2 XOR 池 | **已闭合（第一层可解，第二层部分未判定）**：首行默认密钥 `"9cuktO7efVDf"`，base64 + 13B 循环 XOR；17,325 调用点零覆写；抽样 25/25 可读 UTF-8；第二层 RC4 字符串数组例程与内联键样本已定位 | ① RC4 数组加载时是否经洗牌 IIFE 旋转（洗牌例程未逐行复核）；② 单参 RC4 调用键来源；③ 76,800B 长尾密文条目形态；未对 34.8MB 暴力穷举（任务书时限内定案：第一层可离线解，第二层记部分可解） |
| 3 DSH 协议 | **已闭合（静态源码面）**：JSON-RPC 换行分帧 + 8 client→server / 2 server→client / 6 通知方法与必填字段、传输码 -32601/-32603、业务码串清单已取；schedule 触发/去重/错过窗口/回执历史语义已逐帧对照；spill-policy 与本仓 pruner/artifacts/compaction_retention 六层边界已对照 | ① 业务码 → JSON-RPC error 对象的封装位置（`dsh-sdk-jsonrpc-server` 插件不在本轮解出包清单内）；② DSH 会话级压缩/保留区对照包位置（`dsh-agent-team` 内部未逐文件核）；③ `dsh-spill-local` 后端保留期/容量上限；④ schedule DST 边界与 SQLite/JSON 后端恢复语义差异，未跑动态用例 |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
