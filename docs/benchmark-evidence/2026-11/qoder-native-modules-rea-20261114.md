<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Qoder 四枚底层原生模块 · 能力面对账(2026-11-14)

> 靶:`G:\Qoder CN\resources\bin\*.node`(Qoder CN 0.5.6,N-API 原生 addon)。
> 引擎:`craft-anything` 0.5.0(deep_mode=on,clean_room=builtin lifter)。
> 为什么取这四个:历史册(`qoder-trae-workbuddy-rea-20261105/README.md` Q1 席)明确记「native 模块内部自调仍标未知(REA Ghidra 330s 超时)」——本册用 craft-anything 的 **import-table 判据**把这格补掉。导入表是 stripped 二进制最快且最可靠的能力清单:函数名可被 strip,但 OS 调用必须留名才能解析。
> 红线遵守:不粘对方源码、不破解许可证、不绕付费、不提取凭据(仅取导入名与反编译伪码作观察证据)。

## 1. 四枚模块 sha256 与体量(现读)

| 模块 | 字节 | sha256(前 16) | 函数数 | 导入数 | 符号 |
| --- | --- | --- | --- | --- | --- |
| `dji_mic_button.node` | 785,408 | `8ed11c4347f44ac8` | 2849 | 197 | **带 N-API 注册符** |
| `native_clipboard.node` | 721,408 | `978f9405ad97b366` | — | 121 | stripped |
| `system_commit.node` | 685,568 | `d31eed556046bb66` | 2492 | 121 | stripped |
| `notification_permission.node` | 1,537,536 | `78df72c1a80ce1b7` | 2582 | 124 | stripped |

## 2. 逐枚能力面与判定

### 2.1 `native_clipboard.node` —— 🟢 已对等(读/写文本) + 🟡 一处真差距(剪贴板序号监听)

导入面(观察,USER32 + KERNEL32):
`OpenClipboard` / `GetClipboardData` / `SetClipboardData` / `GetClipboardSequenceNumber` / `CreateFileW` / `ReadFile` / `WriteFile` / `CloseHandle` / `MultiByteToWideChar` / `WideCharToMultiByte` / `GetModuleFileNameW` / `GetCurrentProcess(Id)` / **`IsDebuggerPresent`**。

判定:
- 我方 `apps/cli/src/tools/clipboard.ts`(323 行,PowerShell `Set-Clipboard`/`Get-Clipboard` + macOS `pbcopy/pbpaste` + Linux `xclip`)已覆盖**文本**读写、长度裁剪、平台降级、dangerLevel 分档 ⇒ 文本维**已对等**。
- **真差距(🟡)**:`GetClipboardSequenceNumber` —— 对侧用系统剪贴板**序号**判"内容有没有被别人改过"。我方 read 每次都直读,无法区分"还是上次那份"与"用户刚重新复制"。这是对侧独有的能力点。
- 反调试 `IsDebuggerPresent`:属产品自我保护,非 Agent 能力 ⇒ ⚫ 不搬(搬了等于给自己的 CLI 加反逆向,与本仓开源定位冲突)。

### 2.2 `notification_permission.node` —— ⚫ 平台绑定(WinRT Toast),我方 CLI 无宿主承载面

导入面(观察,WinRT 三件套 + CRT):
`RoInitialize` / `RoUninitialize` / `RoGetActivationFactory` / `WindowsCreateString` / `WindowsDeleteString` + 一整套静态链接 CRT(Heap*/Tls*/Console*/Locale*)。

判定:走 **WinRT Toast** 通知权限路径。我方 `apps/cli` 是本地优先 TUI,无桌面通知宿主(通知面在 `apps/desktop`,非本轮射程)⇒ 判 ⚫ 平台绑定。**不是缺功能,是宿主形态不同**(与 W6 席 `onChatMention` 同型:如实不补)。

### 2.3 `dji_mic_button.node` —— 🟡 真差距(全局热键 + HID 设备侧按键),但前提需 GUI 消息泵

导入面(观察,这是四枚里唯一带真硬件/输入能力的):
- **HID 设备枚举**(HID.DLL):`HidD_GetHidGuid` / `HidD_GetAttributes` / `HidD_GetPreparsedData` / `HidD_GetManufacturerString` / `HidP_GetCaps` / `HidP_GetButtonCaps` / `HidP_GetUsages` / `HidP_MaxUsageListLength` / `HidD_FreePreparsedData`。
- **设备接口枚举**(SETUPAPI.dll):`SetupDiGetClassDevsW` / `SetupDiEnumDeviceInterfaces` / `SetupDiGetDeviceInterfaceDetailW` / `SetupDiDestroyDeviceInfoList`。
- **全局输入**(USER32.dll):`SetWindowsHookExW` / `UnhookWindowsHookEx` / `CallNextHookEx`(**全局键盘钩子**)+ `RegisterHotKey` / `UnregisterHotKey`(**全局热键**)+ `SendInput`(**模拟按键**)。

判定:这是 **DJI 麦克风侧键 → 全局热键**的原生桥(把硬件设备的按键转成系统级输入事件)。它带 `napi_register_module_v1` 符号 ⇒ 模块未 strip,可精确分析。
- 对本仓 CLI:全局热键/全局钩子需 **GUI 消息泵 + 常驻窗口线程**(USER32 hook 必须挂在有消息循环的线程上),纯 Node TUI 无此宿主 ⇒ 全局热键维 ⚫ 前提缺失。
- **可取的一格(🟡)**:`SendInput` **模拟按键**是纯函数式、无需消息泵(注入到系统输入队列即可)。我方 CLI 若要"按快捷键触发某动作/给终端发按键",这是对侧验证过的原生路径。当前我方无此工具 ⇒ 登记为**可选真差距**,非阻塞。

### 2.4 `system_commit.node` —— 🔵 非业务模块(静态链接 CRT 样板),名不符实

反编译观察(`sub_18000150f` / `_1505` / `_b4f` / `_519` / `_a9b` / `_1802`,clean-room lifter 伪码):
- `sub_18000150f`:SIMD(`pcmpeqb`/`vpcmpeqb ymm`)**strlen**——CRT 样板。
- `sub_180001b4f/505/519`:整数→字符串(`itow` 变体,0x30='0' 偏移 + 0x37 处理 >9)——CRT 样板。
- `sub_180001a9b`:路径清理(跳 `\\` + 去 `.E`/`.e` 后缀)——CRT 样板。
- `sub_180001802`:代码页常量映射(0xdead/0xc435…)→尾调 `MultiByteToWideChar`——CRT 样板。

导入面无 `CreateProcess` / `git` / 网络套接字 / 注册表写 ⇒ **不构成 git 提交或系统写入逻辑**。
判定:这枚 685KB 几乎全是**静态链接的 MSVC CRT**,名字叫 `system_commit` 但承载的是运行时样板,非 Agent 能力。⇒ 🔵 无业务价值,不搬(历史册"内部自调未知"这一格就此收口:所谓内部逻辑 = CRT,无自研逻辑)。

## 3. 与我方架构的对账结论(诚实边界,不为"榨干"硬凑)

| 对侧原生能力 | 我方承接点 | 判定 |
| --- | --- | --- |
| 剪贴板文本读/写 | `apps/cli/src/tools/clipboard.ts`(PowerShell/pbcopy/xclip) | 🟢 已对等 |
| 剪贴板序号监听(`GetClipboardSequenceNumber`) | 无 | 🟡 真差距(可选) |
| `SendInput` 模拟按键 | 无 | 🟡 真差距(可选,纯函数可做) |
| 全局键盘钩子(`SetWindowsHookExW`) | 无(需 GUI 消息泵) | ⚫ 前提缺失,不搬 |
| HID/SETUPAPI 硬件枚举(DJI 侧键) | 无(DJI 专有硬件) | ⚫ 产品绑定,不搬 |
| WinRT Toast 通知 | 无(宿主在 apps/desktop) | ⚫ 平台绑定 |
| 反调试(`IsDebuggerPresent`) | 无 | ⚫ 刻意不搬(开源定位) |
| CRT 运行时样板(system_commit) | N/A | 🔵 非业务,不搬 |

**两枚 🟡 是本轮唯一"可在当前架构内落地"的候选**——但都属"新增一个工具"而非"补齐已有机制的缺陷",且非用户本轮点名的会话编排/多 agent/执行环境主线。按 AGENTS.md §0.9「不为无人消费的能力立声明」,此处**只登记不擅自落地**:是否做剪贴板序号监听、是否做 `SendInput` 按键注入,属产品决策,留给机主拍板。

## 4. 验证

- 取证引擎:`craft-anything` 0.5.0,`native_functions_search`(导入表判据)+ `native_functions_decompile`(clean-room lifter 伪码)。
- 全部读数来自工具返回的 `authority:"original-files"`,sha256 逐枚记录,可复跑。
- 与历史册关系:本册把 `qoder-trae-workbuddy-rea-20261105/README.md` Q1 席 §1「native 模块内部自调仍标未知」这一格**收口**——结论是 `system_commit` 内部 = CRT 样板无自研逻辑,其余三枚能力面已枚清,不存在被 strip 掩盖的隐藏业务能力。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
