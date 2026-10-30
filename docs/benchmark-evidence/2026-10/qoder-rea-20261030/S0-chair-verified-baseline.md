<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# S0 主席自验证据基线(2026-10-30 夜,全部本机现读)

> 这一格是我自己复跑的,不依赖任何席位;后面所有对比结论的版本前提以本文为准。

## 1 版本存续与生效态
| 事实 | 读数 | 取法 |
| --- | --- | --- |
| 共存版本 | `0.4.9` / `0.4.11` / `0.5.1`(各带 `.qoder-update-ready.json`) | `ls G:\Qoder CN\.qoder-versions\` |
| Launcher 目标版 | targetVersion=**0.5.1**,status=healthy,updatedAt=2026-10-30T12:37:19.911Z | `AppData\Local\Qoder CN\Qoder CN Launcher\state.ini` |
| 生效版本 | **0.5.1 已激活并在运行**(S8 席一手补强:12 枚进程全部 20:37:12 起于根安装位;根 `resources/app.asar` 与 `.qoder-versions/0.5.1/resources/app.asar.qoder-pending` 哈希逐字节相等) | `Get-CimInstance Win32_Process`(ExecutablePath=`G:\Qoder CN\Qoder CN.exe`)+ `sha256sum` 双件比对 |
| ~~0.5.1 尚未激活~~ **本行原判作废** | 我先前据 `app.asar.qoder-pending` 文件名推"仍是暂存、跑的是 0.4.11"——**错**。`.qoder-pending` 只是 `payloadLayout=pending-asar-v1` 的留存副本命名,根 `resources/app.asar`(196,831,317B,mtime 10-30 13:46)已是 0.5.1 payload;`0.4.11/` 是留存旧版本目录(可回滚位) | 修正依据见上一行;教训:**文件名形态不是生效证据,进程可执行路径 + 包体哈希才是** |
| 根安装位包体 | `G:\Qoder CN\resources\app.asar` = 196,831,317B(与 0.5.1 pending 同字节),mtime 10-30 13:46 | `ls -la` |
| 0.4.11 构建 | build-manifest:electronVersion 43.1.1、commit d9996760e3d4…、buildNumber 82468212、buildTime 2026-10-23T06:45:57Z | 上一轮导出件 + 本轮复核 |
| 0.5.1 构建 | productVersion 0.5.1、electron **43.1.1**、commit `ef0366398c9f…`、buildNumber 84759508、buildTime **2026-10-30T05:45:18Z**、symbolSetId 存在 | `cat 0.5.1/resources/build-manifest.json` |
| 产品自述 | `"Qoder - Agent workbench for human and AI software teams"`,main=`./out/main/index.js`,private=true,name=qoder-cn | `benchmark-asar-read --get /package.json`(两版同) |

## 2 缓存证据是否还有效(关键:能不能省掉重跑)
- 0.4.11 `app.asar` 实测 sha256 前缀 **e9d780de8caa3d108ffe476c…** == 上一轮 REA 证据 `ev_1c03427d…` 记录的 root_artifact_sha256 ⇒ **193MB 那份证据对当前运行版本仍然有效**,可直接引用,无需重跑。取法:`sha256sum` + 与 `asar-analysis.json` 的 subject.digest 对照。
- 0.5.1 pending 包体 sha256 前缀 `7cdfc0a41795cf86…`,与 ready.json 的 `archiveSha256=361411b2aea5…` **不相等** ⇒ [未知]不能据此说"完整性异常":pending-asar-v1 布局下 archive 与 asar 本就不是同一物体,这一对比不构成判据。真要比得先拿到 archive 本体。**不得写成发现**。

## 3 Agent 运行时版本跳动(能力迭代住在哪一层)
| 版本 | worker runtime | 取法 |
| --- | --- | --- |
| 0.4.11 | **1.1.75-hotfix.1** | `.../app.asar.unpacked/node_modules/@qoder-ai/qoder-cn-agent-sdk/dist/_worker/runtime-info.json` |
| 0.5.1 | **1.1.79-hotfix.7** | 同路径 |
⇒ 壳版本 0.4.11→0.5.1 之间,agent 运行时自己走了 4 个补丁位。另:runtime-info 的 `productName=qoderclicn` ⇒ 桌面里嵌的是 CLI 同源运行时(上一轮已证,本轮复核仍在)。

## 4 0.4.11 → 0.5.1 包内字节级差集(主席自算器,脚本与产物同批落盘)
- 工具:`.ihui-agent/tmp/qoder-rea/chair-asar-diff.mjs`(自研 header 遍历,与正牌只读器同一格式约定);产物 `chair-asar-diff-0.4.11-to-0.5.1.txt`
- 条目:6,420 → 6,435(新增 155 / 删除 140);`/out/` 面 1,953 → 1,968 条
- **具名新增**(非 vite hash chunk,带语义):
  - `/out/main/qoderSdkDaemonHookMockPreload.js` 7,758B
  - `/out/main/remoteControlScopeDatabase.js` 15,963B
  - `/out/preload/chunks/pluginViewRuntime-*.css`(换 hash,6,707→7,639B)
- **具名删除**:仅 node-pty 的 MSVC tlog 目录号漂移(构建噪声,不计)
- **字节变动 top**(14 个文件内容哈希变):
  - `/out/main/electronMain.js` 17,828,077 → **19,500,750**(+1,672,673)
  - `/out/preload/pluginViewDiagramRuntime.cjs` 3,450,036 → **5,071,399**(+1,621,363,+47%)
  - `/out/preload/index.cjs` 191,036 → 222,282(+31,246)
  - `/out/preload/pluginViewRuntime.cjs` +20,930;`/out/main/pluginHost.js` +1,875
  - `/node_modules/@qoder-ai/qoder-cn-agent-sdk/dist/index.js` +1,233;`runtime-manifest.json` +2;SDK `package.json` +1
  - `/package.json` 2,373 → 2,606;`remoteSdkDaemonBridge.js` +183;`remoteControlProcess.js` −371;`dataDirectoryProcess.js` +16
  - 净变动 **+3,349,526B**(仅"同名文件尺寸差"这一维)
- **总体积差(S8 席复核)**:包体 189,505,973 → 196,831,317 = **+7,325,344B**(不是粗看的 +15MB)。差额 = 同名变动 +3,349,526 与新增/删除条目净值之和,两维口径要分开报。另:包外最大增量根本不在 asar,而在 `resources/extensions/qoder.office` **+35,615,824B**(新增 workbook/xlsm/csv 三视图与 xlsx headless 通道)。
- 推论(标 [推断]):0.5.1 的增量集中在**主进程 + 插件视图沙箱(尤其 diagram 运行时)**两处,而不是 agent 逻辑主体;agent 侧字节增量只有 SDK dist/index.js 的 +1.2KB(与 worker runtime 版本号跳 4 位不成比例 ⇒ 真正的 agent 逻辑增量在 34MB 混淆 worker 里,包外 unpacked 面,归 S2/S8 量)。
- 附带事实:agent SDK **同时存在于包内**(`/node_modules/@qoder-ai/qoder-cn-agent-sdk/dist/index.js`),unpacked 只是把原生与 worker 那部分搬出去 ⇒ 任何"SDK 只在 unpacked"的说法不成立。

## 5 本仓取证工具的三条实测边界(踩过的坑,写给下一位)
1. `scripts/benchmark-asar-read.mjs` 的 `--list` **默认只印 400 条**(`ASAR_LIMIT||400`)。我按默认值量到 401 条/`/out/` 0 条,一度读成"工具在新版包体上失能"——**错**。满限重取才是 6,420 条。引用它的条数必须同批带 `ASAR_LIMIT=200000`。
2. `--get` 的路径在 Git Bash 下会被 pathconv 吃掉(`/package.json` → `C:/Program Files/Git/package.json`),须 `MSYS_NO_PATHCONV=1`;但该变量同时会让 `/g/...` 这类盘符路径解析歪,所以**必须传 `G:/...` 形态的绝对路径**。上一册 README 只写了前半句。
3. header 解析的不变量是 `strLen` 含结尾 NUL,须 `.replace(/\0+$/,'')`;自己写遍历脚本时按 `subarray(8, 8+strLen)` + 去 NUL,少一步就是 JSON.parse 炸(我第一次就炸在这)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
