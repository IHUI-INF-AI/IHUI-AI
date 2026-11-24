<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Trae / WorkBuddy 原生面 · 能力清单对账(2026-11-14)

> 续 `qoder-native-modules-rea-20261114.md`。本册把同一套 **import-table 判据**套到本轮点名的另两个在位靶。
> 引擎:`craft-anything` 0.5.0(deep_mode=on)。全部读数 `authority:"original-files"`,sha256 逐枚记录可复跑。
> 红线:只取导入名与反编译伪码作观察证据,不粘源码、不破解许可证、不绕付费、不提取凭据。

## 0. 归属更正(先说,免得下批照抄错的)

`apps/cli/src/util/parent-bound.ts` 头注写「对照 **WorkBuddy** Win32 Job Object,取证见 W1 §3④」。本轮实测:

| 二进制 | Job Object 族 |
| --- | --- |
| `G:\workbuddy\WorkBuddy.exe`(204MB) | **✅ 完整**:`CreateJobObjectW`/`AssignProcessToJobObject`/`SetInformationJobObject`/`QueryInformationJobObject`/`TerminateJobObject` |
| `...\workbuddy-switch\wb-switch-rust.exe`(27MB) | ❌ 无(它是 rust 切换器,只有 SendInput/ShellExecute/socket/CreateProcessW) |
| `G:\Trae CN\...\ai-agent\toolhost.dll`(99MB) | **✅ 完整**:`CreateJobObjectW`/`AssignProcessToJobObject`/`SetInformationJobObject`(无 Terminate/Query) |

**结论:S6 的归属正确**——Job Object 对照源就是 `WorkBuddy.exe` 主程序,`parent-bound.ts` 头注无需改。新增观察:Trae `toolhost.dll` **独立**用同一族做进程沙箱(两靶殊途同归,佐证这是 Win32 进程隔离的正解)。

## 1. Trae 原生三件套(`G:\Trae CN\resources\app\modules\ai-agent\`)

历史册(T1 席)只量过这三枚的字节数/sha256 与"16 锚点权限决策块",**函数级原生面从未枚清**。本轮补齐:

### 1.1 `ai_agent.dll` — 285,861,264 B · sha `62f6a4e43c778a8114d0b77073d8425c9bd855ffeb815ba1946d0357c133448d`

唯一导出 `ai_agent_ipc_connect`,反编译(`native_functions_decompile`)= **空转发器**(size=1,`return;`)⇒ 真实现藏在 thunk 后,函数级不可达(50000 函数上限截断)。

导入面能力清单(观察):

| 能力族 | 导入证据 |
| --- | --- |
| **Named-pipe IPC**(Agent↔宿主主通道) | `ai_agent_ipc_connect`(导出)+ `CreatePipe`/`CreateNamedPipeFile`(ntdll)/`SetNamedPipeHandleState` |
| **HTTP(S) 客户端**(模型/API 调用) | WinHttp 全套:`WinHttpOpen/Connect/OpenRequest/SendRequest/ReceiveResponse/ReadData/QueryHeaders/AddRequestHeaders/SetCredentials/SetTimeouts/CloseHandle` |
| **裸 TCP/UDP 套接字** | ws2_32 全套:`WSAStartup/WSASocketW/WSAPoll/WSADuplicateSocketW/connect/send/recv/sendto/recvfrom/ioctlsocket/closesocket/getaddrinfo` |
| **内嵌 libgit2**(git 操作不外 spawn) | `git_remote_connect`/`git_remote_connect_ext`/`git_remote_connected`/`git_remote_disconnect`/`git_remote_connect_options_{init,dispose}`/`git_transport_remote_connect_options` |
| **子进程 + IPC** | `CreateProcessW`/`CreatePipe`/`ReadFile(Ex)`/`WriteFile(Ex)`/`GetExitCodeProcess`/`TerminateProcess`/`WaitForSingleObject(Ex)`/`RegisterWaitForSingleObject` |
| **网络适配器枚举**(内网探测) | `GetAdaptersAddresses`(iphlpapi) |
| **注册表** | `RegOpenKeyExW`/`RegOpenKeyTransactedW`/`RegQueryValueExW`/`RegEnumKeyExW` |
| **COM** | `CoInitializeEx`/`CoInitializeSecurity`/`CoCreateInstance` |
| **反调试** | `IsDebuggerPresent`(在 toolhost/harness 各自带) |

**对本仓判定**:
- WinHttp/裸 socket 全套 —— 我方 B6/S-egress 已用 Node `net`/`http` + 自建 DNS 域名裁决引擎对位,🟢 已对等(对侧走原生 WinHttp,我方走 Node 栈,能力等价)。
- **内嵌 libgit2**(🟡 观察):对侧把 git 操作编译进原生层、不走 `git` CLI 子进程。我方 `plugins/git-runner.ts` 走子进程 git。这是**实现路径差异**,非能力差距——但意味着对侧 git 操作不依赖用户装没装 git(我方 W1 §3 第⑩行已为"git 可用性不取决于别人装没装 WorkBuddy"补过兜底位)。**不搬**:内嵌 libgit2 是巨型 C 依赖,Node 侧 `isomorphic-git`/`nodegit` 已是成熟替代,引入只增面不值。
- `GetAdaptersAddresses` 内网探测 —— 我方 egress 域名裁决已覆盖内网段判定,🟢 对位。

### 1.2 `toolhost.dll` — 99,805,584 B · sha `db8706e1ff3a1b72b569de69d502d80726ec3188d892f864186942574edf8f3a`

**这是 Trae 的进程执行沙箱宿主**(名字直白)。导入面:

| 能力族 | 导入证据 |
| --- | --- |
| **Job Object 进程沙箱**(随父而终) | `CreateJobObjectW`/`AssignProcessToJobObject`/`SetInformationJobObject` |
| **受限令牌**(降权执行) | `OpenProcessToken`/`GetTokenInformation` |
| **子进程 stdio 管道** | `CreateProcessW`/`CreatePipe`/`SetNamedPipeHandleState`/`GetStdHandle`/`ReadFile(Ex)`/`WriteFile(Ex)`/`WaitForSingleObject(Ex)`/`GetExitCodeProcess`/`TerminateProcess` |
| **裸 socket** | `socket`/`WSASocketW` |
| **注册表 / 反调试** | `RegOpenKeyExW`/`IsDebuggerPresent` |

**对本仓判定**:
- Job Object 随父而终 —— S6 已用脱离式看门狗复现并超越(判据纯函数化 + 看门狗自带死亡机制 + unjudged 不动手),🟢 **已落地并超越**(两靶独立佐证这是正解)。
- **受限令牌降权**(`OpenProcessToken`/`GetTokenInformation`)🟡 观察:对侧用令牌信息判"当前是否提权/是否特定组",作为命令执行前的决策输入。我方 `command_policy_tiers.py` 的三段决策(allow/ask/deny)是**策略层**判据,不读 OS 令牌。**不搬**:我方 CLI 不做 OS 级提权执行,策略层 deny 已足够,读令牌只会加一个 Windows-only 分支。

### 1.3 `harness.dll` — 263,771,536 B · sha `11b4c76ac34c31a93a5bf4992444e4c406cfd293dcefd89a73d11801841dcb48`

导入面(能力族):

| 能力族 | 导入证据 |
| --- | --- |
| **权限/令牌决策**(16 锚点权限块的运行时面) | `GetTokenInformation`/`OpenProcessToken`/`CheckTokenMembership`/`GetUserNameW` |
| **内存保护**(自改/保护代码段) | `VirtualProtect` |
| **证书链策略校验** | `CertVerifyCertificateChainPolicy`(crypt32) |

**对本仓判定**:harness 的令牌/组成员判定 = T1 席记的"企业命令黑名单 + 命令级三段决策"的原生承载。我方 Y2 席已把该机制复现为 `command_policy_merge.py`/`command_policy_tiers.py` + `mcp_server._tool_run_command` 真消费点(21 测试),🟢 已对等并超越(逐条可解释 `matched_rules` 带来源档位 + deny 档不可绕门)。`CertVerifyCertificateChainPolicy` 属对侧更新器证书校验,我方走 Node TLS,🟢 对位。

## 2. WorkBuddy 原生面(`G:\workbuddy\WorkBuddy.exe` 204,590,360 B · sha `b5b065a19cc66f23855bd4f122283f799e290d58a5c13603e14e3442f415f733`)

W1/W2 席量过能力清单(40+16 条)但走的是 asar/grep 面;本轮从**原生导入表**补一层:

| 能力族 | 导入证据 | 对本仓判定 |
| --- | --- | --- |
| **Job Object 沙箱**(完整族) | `CreateJobObjectW`/`AssignProcessToJobObject`/`SetInformationJobObject`/`QueryInformationJobObject`/`TerminateJobObject` | 🟢 S6 已复现并超越 |
| **Named-pipe 服务端**(完整) | `CreateNamedPipeA/W`/`ConnectNamedPipe`/`DisconnectNamedPipe`/`PeekNamedPipe`/`TransactNamedPipe`/`WaitNamedPipeW`/`GetNamedPipe{Client,Server}ProcessId` | 🟢 我方 stdio/pipe IPC 对位 |
| **管道客户端冒充 + 降权执行** | `ImpersonateNamedPipeClient`/`CreateProcessAsUserW`/`OpenProcessToken`/`CheckTokenMembership` | 🟡 见下 |
| **系统代理解析**(🟡 关注) | `WinHttpGetProxyForUrl`/`WinHttpGetIEProxyConfigForCurrentUser`/`WinHttpCrackUrl` + WinHttp 全套 | 🟡 见下 |
| **网络适配器枚举** | `GetAdaptersAddresses` | 🟢 egress 内网段判定已对位 |
| **全局输入**(键鼠) | `SendInput`/`GetAsyncKeyState`/`SetWindowsHookExW` | ⚫ 需 GUI 消息泵,不搬 |
| **Shell 启动** | `ShellExecuteW`/`ShellExecuteExW` | 🟢 我方 spawn/open 对位 |
| **反调试** | `IsDebuggerPresent` | ⚫ 刻意不搬(开源定位) |

**两处值得登记的 🟡(只登记,不擅动)**:

1. **系统代理解析**(`WinHttpGetProxyForUrl` + `WinHttpGetIEProxyConfigForCurrentUser`):对侧 HTTP 客户端会读 **Windows 系统/IE 代理配置**并按 URL 解析该走哪个代理。我方 B6 子进程网络出口走的是显式 `HTTP_PROXY`/`HTTPS_PROXY` env,**不读系统代理**。对企业内网用户(代理由组策略下发、不设 env)这是真实差距。**但** AGENTS.md Z3 头注已登记"裸 TCP / 不读代理 env 的客户端要机器级硬拦截属内核/驱动面(WinDivert/LSP),不落地"——读系统代理是**另一轴**(让 egress 尊重系统代理),可在 Node 侧用 `WinHttpGetProxyForUrl` 等价物(读注册表 `Internet Settings` 或调 `WinHTTP` 自动发现)实现。属**可选增量**,留机主拍板。

2. **管道客户端冒充 + 降权执行**(`ImpersonateNamedPipeClient` + `CreateProcessAsUserW`):这是 Windows 服务进程的经典 **IPC 降权沙箱模型**——服务在命名管道上冒充连接方身份,再以该(更低的)令牌起子进程。对侧用它做"以用户身份而非 SYSTEM 跑工具"。我方 CLI 本就跑在用户态、无需降权 ⇒ 🟢 **结构上不需要**,非差距。

## 3. 与 Qoder 册合并的横向结论

跨三个在位靶 + Qoder 四模块,原生层反复出现的能力族与本仓承接状态:

| 原生能力族 | 出现于 | 本仓承接 |
| --- | --- | --- |
| Job Object 随父而终 | WorkBuddy.exe · Trae toolhost | 🟢 S6 已复现并超越 |
| Named-pipe IPC | Trae ai_agent · WorkBuddy.exe | 🟢 stdio/pipe 对位 |
| WinHttp / 裸 socket | 三靶全有 | 🟢 B6/S-egress 对位 |
| 命令执行前权限决策(令牌/组) | Trae harness/toolhost · WorkBuddy | 🟢 Y2 三段决策对位超越 |
| 内嵌 libgit2(不 spawn git) | Trae ai_agent | 🟢 路径差异非差距(我方有 git 兜底位) |
| 系统代理解析 | WorkBuddy.exe | 🟡 可选增量(egress 尊重系统代理) |
| `SendInput` 模拟按键 | Qoder dji_mic · WorkBuddy.exe · wb-switch | 🟡 可选增量(纯函数可做) |
| 剪贴板序号监听 | Qoder native_clipboard | 🟡 可选增量 |
| 全局键盘钩子 / GUI 消息泵 | 三靶 | ⚫ 前提缺失,不搬 |
| 反调试 `IsDebuggerPresent` | 全部 | ⚫ 刻意不搬(开源定位) |

**诚实收口**:三个在位靶的原生层**能在本仓当前架构内落地的通用机制已全部对位或超越**(Job Object / pipe IPC / HTTP / 命令决策 / 内网探测)。余下三枚 🟡(系统代理、SendInput、剪贴板序号)都是"新增一个工具"而非"补齐已有机制缺陷",且都需机主拍板是否要——按 §0.9 不为无人消费的能力立声明,只登记。

## 4. 验证

- 引擎:`craft-anything` 0.5.0 `native_functions_search`(导入表)+ `native_functions_decompile`(clean-room lifter)。
- 五个二进制 sha256 逐枚记录,可复跑。
- 已知限制:`ai_agent.dll`/`harness.dll`/`toolhost.dll`/`WorkBuddy.exe` 均 **50000 函数 / 600 万指令上限截断**,函数级映射不完整——但导入表判据**不受此限**(导入在 PE 头,先于函数发现),故能力清单完整、函数级细节未穷尽。此边界与历史册"Ghidra >1h / REA 5.5min 硬预算"同源,如实钉死。
- DeepSeek:本机只剩 updater 残留、无主程序体,无法取证(如实缺口)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
