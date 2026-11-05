<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# T12 · mtree 原生 PE 面 + qoder-context-hook.exe 宿主 + 钩子契约跨版本差分(goal-b47 取证席 U)

> **取证进行中@2026-11-01 03:59:46**(本机墙钟 `date` 现读;本行为防静默死亡的首行锚,结册后保留并补起止时刻)
> **取证完成@2026-11-05 21:04:47**(Z21 席按 goal-b49 分诊 §② 第 10 行结清 §1-3/§4/§5 三格;三格正文按当次实测**全部重取**,不抄同目录 goal-b46 席的现值)

- 开工 HEAD(Z21 席现读):`eff9c8e0f28f34eea81cb39715e55423d8a404db`。
- 装机当前插件版本(现读盘上目录 + `runtime-manifest.json` 的 `version` 字段逐字一致):`1.0.91.b22f2d0a`(cache 目录 mtime 2026-10-30 19:47)。Qoder CN 主客户端 `build-manifest.json` / `install-type.json` 本席**未直取**(见 §5 #5)。
- 席别:本席为 goal-b47 原生面补格;同目录 `T12-mtree-and-hook-host.md`(goal-b46 席)已存在,本席**全部数字按当次实测重取**,与其结论逐条对照,不抄其现值(两处口径差异见 §3 末「就地更正」)。

## 0. 席位边界(先声明,后取证)

- 读了什么:`G:/Qoder CN/resources/build-manifest.json`、`install-type.json`(版本字段);`C:/Users/Administrator/.qoder-cn/plugins/cache/qoderapp-bundler/qoder-context/<8 版>/` 下 `runtime/native/mtree/mtree.win32-x64-msvc.node`、`bin/qoder-context-hook.exe`、`hooks/hooks.json`、`runtime/runtime-manifest.json` 的**字节数/PE 头/节表/导出目录/导入目录/异常表/`.rdata` 字符串**;JS 声明件 `index.cjs` 的导出名行。
- 刻意没读:任何 `AppData/Roaming/**`、`*.dat`、token、cookie、SQLite 正文;`installed_plugins*.json`、`marketplaces/**`、`logs/*.log` 内容;`assets/r1/a.bin`/`b.bin` 正文。
- 红线执行:**未执行/未加载/未 require 任何靶件**(不落 `require()` 真身,解析一律用自写 PE 读字节器);未粘贴对方源码/反编译正文入册;配置只取字段名与形态。
- 三态标注:[观察]=本次命令直接量到(附可复跑命令);[推断]=由观察形态推得;[未知]/未找到=射程内无证据。"未检索到"不写成"没有"。

## 1. `mtree.win32-x64-msvc.node` 原生 PE 面(8 版)

| 版本目录 | 字节 | sha256 前 12 | 与前一版关系 |
| --- | --- | --- | --- |
| 1.0.51.fa026ec3 | 1,815,552 | `149b9d45070b` | 基线 |
| 1.0.61.7f8d7bb7 | 1,794,048 | `f92f56694b0a` | −21,504 B |
| 1.0.61.d5594762 | 1,794,048 | `71dcd577da68` | **同体积异哈希**(与 7f8d7bb7) |
| 1.0.72.34cf9e2f | 1,815,552 | `18dd4b411c11` | 回到 1.0.51 体积、异哈希 |
| 1.0.74.7a73af9 | 1,858,048 | `fb7a0e40a5b1` | +42,496 B |
| 1.0.78.26e781a | 1,858,048 | `662f2199d80b` | **同体积异哈希**(与 1.0.74) |
| 1.0.84.f756706 | 1,868,808 | `521c29904670` | +10,760 B(**恰等 cert 尺寸**,见 §2 Authenticode 段) |
| 1.0.91.b22f2d0a | 1,868,808 | `e8d795574009` | **同体积异哈希**(与 1.0.84) |

- PE 头解析(1.0.91 逐字节)[观察],复跑 = `node --input-type=module -e '...DataView 自写 PE 读字节器...'`:
  - `Machine = 0x8664` (AMD64) / `Magic = 0x20b` (PE32+) / `Subsystem = 2` (WINDOWS_GUI) / `ImageBase = 0x180000000`
  - 5 节:`.text` 1,470,513 / `.rdata` 328,964 / `.data` 4,152 / `.pdata` 49,428 / `.reloc` 4,284
  - 数据目录非空项:export / import / exception / **cert** / baseReloc / debug / tls / loadcfg / iat
  - **单一导出 = `napi_register_module_v1`**(N-API 模块注册口,标准形态;导出表 `NumberOfNames=1`)
  - 导入 9 枚 DLL:`kernel32` / `api-ms-win-core-synch-l1-2-0` / `bcryptprimitives` / `ntdll` / `VCRUNTIME140` / `api-ms-win-crt-{math,string,heap,runtime}-l1-1-0`
- 1.0.51 PE 面差异[观察]:同上,除 **cert 目录 rva=0,size=0**(未签名);`.rdata` / `.pdata` 具体尺寸本席未逐版对齐,见 §5 #1。

## 2. `qoder-context-hook.exe` 宿主 PE 面

| 版本目录 | 字节 | sha256 前 12 | `bin/` 清单 |
| --- | --- | --- | --- |
| 1.0.51 / 61.7f8d / 61.d559 / 72 | **MISSING** | — | `qoder-context.cmd` + `rg.exe`(exe 宿主未装车) |
| 1.0.74.7a73af9 | 611,840 | `a0b097cb37b2` | 首现 + `qoder-context.cmd` + `rg.exe` |
| 1.0.78.26e781a | 611,840 | `be54d00e0463` | **同体积异哈希**(与 1.0.74) + 两枚仍在 |
| 1.0.84.f756706 | 641,024 | `7cc11f7b5cfa` | +29,184 B;`qoder-context.cmd` **消失**,只剩 exe + `rg.exe` |
| 1.0.91.b22f2d0a | 641,544 | `79d6d476d1d0` | +520 B |

- PE 头解析(1.0.91 vs 1.0.74)[观察]:
  - `Machine 0x8664` / `Magic 0x20b` / `Subsystem 3` (WINDOWS_CUI 控制台) / `ImageBase 0x140000000`(两版相同)
  - 5 节;`.text` 443,525 vs 428,661 / `.rdata` 162,324 vs 159,020 / `.data` 864 vs 864(等) / `.pdata` 20,412 vs 19,788 / `.reloc` 1,980 vs 1,960
  - **无导出表**(纯可执行)
  - 导入 10 枚,1.0.74 与 1.0.91 逐字同集:`bcryptprimitives` / `kernel32` / `api-ms-win-core-synch-l1-2-0` / `ntdll` / `VCRUNTIME140` / `api-ms-win-crt-{runtime,math,stdio,locale,heap}-l1-1-0`
- **Authenticode 签名起始点(本席新增观察)[观察]**——cert 数据目录 = IMAGE_DIRECTORY_ENTRY_SECURITY(index 4),只取 rva/size,**不解 PKCS#7**:
  - `hook.exe@1.0.74` rva=0 size=0 ⇒ **未签名**
  - `hook.exe@1.0.78` rva=0 size=0 ⇒ **未签名**
  - `hook.exe@1.0.84` rva=630,272 size=10,752 ⇒ **已签名**
  - `hook.exe@1.0.91` rva=630,784 size=10,760 ⇒ **已签名**
  - `mtree@1.0.51` rva=0 size=0 ⇒ **未签名**;`mtree@1.0.91` rva=1,858,048 size=10,760 ⇒ **已签名**
  - ⇒ 签名引入落在 **exe 侧 1.0.78→1.0.84** 那一格,与 §3 转折点和 `qoder-context.cmd` 摘除同批;**mtree 侧的签名引入区间在 1.0.51→1.0.91 之间,本席未逐版核对**(见 §4 #5)
- argv 子命令(从 §3 `hooks.json` 的 `args[]` 直读,**不 launch 靶**)[观察]:
  - 1.0.74–84 只用两处:`qoder-context-prompt`、`user-prompt-submit`
  - 1.0.91 首次出现 6 枚:`session-start`、`qoder-context-prompt`、`qoder-context-prompt`(SubagentStart 复用)、`user-prompt-submit`、`post-tool-use`、`knowledge-edit-record`、`stop`、`knowledge-edit-upload`
  - ⇒ exe 至少识别 6 个不同字符串键;完整 argv 分派器是否还挂有未在册的隐藏子命令 = §5 #2(未判定)

## 3. `hooks/hooks.json` 契约跨版差分(纯文本零逆向)

| 版本目录 | 字节 | sha256 前 12 | 事件 | grp | 叶子 hook | async | matcher | 命令承载体 | env 键 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0.51.fa026ec3 | 1,135 | `62dbd869c49f` | SessionStart,UserPromptSubmit | 2 | 2 | 0 | 0 | `cmd.exe /d /c ${QODER_PLUGIN_ROOT}/bin/qoder-context.cmd <sub>` | `QODER_PRODUCT_ID` |
| 1.0.61.7f8d7bb7 | 1,135 | `62dbd869c49f` **同哈希** | 同上 | 2 | 2 | 0 | 0 | 同上 | 同上 |
| 1.0.61.d5594762 | 1,135 | `62dbd869c49f` **同哈希** | 同上 | 2 | 2 | 0 | 0 | 同上 | 同上 |
| 1.0.72.34cf9e2f | 1,135 | `62dbd869c49f` **同哈希** | 同上 | 2 | 2 | 0 | 0 | 同上 | 同上 |
| **1.0.74.7a73af9** | **1,119** | `8aa3d72d6763` | 同上 | 2 | 2 | 0 | 0 | **`${QODER_PLUGIN_ROOT}/bin/qoder-context-hook.exe <sub>`** | + `QODER_SEARCH_PRODUCT_FORM: "qoder"` |
| 1.0.78.26e781a | 1,118 | `90b3f354e1bf` | 同上 | 2 | 2 | **1**(UserPromptSubmit) | 0 | 同 1.0.74 | 同上 |
| **1.0.84.f756706** | **1,605** | `268bdc8b8cbc` | 同上 | 3 | 3 | 1 | 0 | 同 1.0.74;`qoder-context.cmd` 从 `bin/` **消失** | 同上 |
| **1.0.91.b22f2d0a** | **4,388** | `bb2502651a15` | **SessionStart,SubagentStart,UserPromptSubmit,PostToolUse,Stop** | 8 | **8** | **6** | **4** | 同 1.0.74 | 同上 |

- **1135 → 1119 那 16 字节的唯一内容**[观察]:`command` 由 `"cmd.exe"` + 4 项 args 变为 `"${QODER_PLUGIN_ROOT}/bin/qoder-context-hook.exe"` + 1 项 args,并新增 env 键 `QODER_SEARCH_PRODUCT_FORM: "qoder"`;事件名、`timeout: 2`、`name` 一族逐字未变。**不是**删事件、**不是**改超时。
- **1.0.78 唯一变化**[观察]:UserPromptSubmit 组 `async: false → true`(其他逐字同)——`1119 → 1118` 的一字节差就是 `false`(5 字)→`true`(4 字)。
- **1.0.84**[观察]:UserPromptSubmit 数组**从 1 个 grp 扩到 2 个**——第一个异步 `user-prompt-submit`,第二个同步 `qoder-context-prompt`(把 SessionStart 的 sub 复制一份到 UserPromptSubmit,同步形态保留)。事件名不变。
- **1.0.91**[观察]:
  - `description` 从 `"Qoder Context project knowledge overview hooks"` 改为 `"Qoder Context project knowledge and capability-gated workspace hooks"`(capability-gated 是新语义)
  - 事件 2→5(新增 `SubagentStart`/`PostToolUse`/`Stop`)
  - grp 2→8,叶子 hook 2→8
  - **async 6 / sync 2**(sync 剩 `SessionStart#2` 与 `SubagentStart#1`)
  - `matcher` 首次出现,共 **4 处**(全部挂在 **grp 层**,非叶子 hook 层):
    - SessionStart#2:`^(?!resume$).*`(排除 `resume` 会话)
    - SubagentStart#1:`^(general-purpose|Explore|Plan)$`
    - PostToolUse#1:`Edit|Write`
    - PostToolUse#2(knowledge-edit-record):`^(mcp_call|(mcp__[^\s]+__)?(write_wiki|edit_wiki|delete_wiki|write_knowledge|edit_knowledge|delete_knowledge|link_knowledge|unlink_knowledge))$`
  - Stop 事件的两条 hook 都**无 matcher**(对所有 Stop 触发)——与 PostToolUse 的"精准命中"形成对照两档
- **跨 8 版稳定项**[观察]:`timeout: 2` 恒为 2(即便 1.0.91 扩到 8 条叶子也没动);顶层键 `{description, hooks}` 恒定;`hooks` 是 object keyed by event,每个值是 `[{async, matcher?, hooks:[{type,command,args,name,timeout,env}]}]` 数组——**JSON 结构形态跨 8 版零漂移**。
- **`runtime/runtime-manifest.json` 20 键形态跨 8 版逐字一致**[观察](把嵌套展平成 `path:type` 集合逐版 diff):`schemaVersion / productId / target.{platform,arch} / version / javascriptRuntime.{source,command,electronRunAsNode,bundled} / mtreeNapiVersion / build.{minified,sourceMap} / files.{entry,scanWorker,legacyMigrationWorker,mtreeLoader,mtreeBinary,ripgrep,assetModule,assetBinary}`——只有 `version` 字段随行,其他键类型全同。此格旧册未覆盖。
- **`assets/r1/a.bin` / `b.bin` 跨 8 版逐字一致**[观察](`a.bin` = 3,409 B@sha `4a4c05dd031c`;`b.bin` = 111,136 B@sha `bc72337c4c0b`;两枚 8 版全部同哈希)⇒ **版本漂移维度已判定 = 无漂移**;正文语义按 §0 红线**不读**(见 §5 #4)。
- `rg.exe` vendored 上游 ripgrep(旧册已一句带过),本席不重复。

### 就地更正(与同目录 goal-b46 席 `T12-mtree-and-hook-host.md` §C1 表对齐)[观察]

| 原行 | 更正 | 依据 |
| --- | --- | --- |
| goal-b46 §C1 表 1.0.91 行「8 条里 5 条 async」 | 实测 **6 条 async / 2 条 sync** | 本次 `hooks.json` JSON.parse grp.async 逐条计数(`total:8, async:6, sync:2`);靶件 sha256 与 goal-b46 席逐字相同(`bb2502651a15`)⇒ 靶件未漂,系旧席读数口径 |
| goal-b46 §C1 表 1.0.91 行「首次出现 `matcher`」 | 属实,但位置应更精确:**matcher 挂在 grp 层(包裹 `hooks:[...]` 数组那一级),不挂在叶子 `hook` 层**;1.0.91 的 8 条叶子共带 4 处非空 matcher | 本次 `Object.keys(grp)` 出现 `{async,matcher,hooks}`,而 `Object.keys(h)` 恒为 `{type,command,args,name,timeout,env}` |

**注**:两条更正只针对**同目录 goal-b46 席的 C1 表**(不在本件文件射程内,故本席只在本件登记依据,不改对侧文件;改判归主席)。

## 4. 缺口表(本席射程内的可动格,≤8 行)

| # | 缺口 | 本席推进到哪 | 下批最小落点 |
| --- | --- | --- | --- |
| 1 | `mtree` `.rdata` 关键字 → 函数级映射(6 类符号族是否各有独立分派) | 未派生 REA/Ghidra(见 §5 #1) | 用 `D:/DevEnv/ghidra_12.1.4/support/analyzeHeadless.bat` 定点反编译 `.rdata` 常量的引用函数 |
| 2 | `qoder-context-hook.exe` argv 全集是否 == §2 观测的 6 枚 | 6 枚由 `hooks.json` 声明反推;`.rdata` 大小已量到 162,324 B | 反编译 `main` / argv 解析器,枚举 `strcmp` 分支 |
| 3 | `deny` / `ask` / `allow` 三段决策在此 exe 是否落地(旧册 §7 B2) | **射程内未检索到**相关字符串(未做穷举) | Ghidra `.rdata` 关键字扫描 |
| 4 | `assets/r1/{a,b}.bin` 正文语义(旧册 §7 B3) | 版本漂移维度已判定(见 §3);正文按 §0 红线**不读** | 若解除红线,取 header + magic bytes 定性即可 |
| 5 | Authenticode 完整链(签名者 / 时间戳 / 证书路径)与 mtree 侧签名引入区间 | 本席新增:cert rva/size **有无**已判;PKCS#7 未解;mtree 引入区间只在 1.0.51→1.0.91 之间(未逐版核对) | 不 launch 靶的只读路径:`Get-AuthenticodeSignature` 或 `signtool verify /pa /v` + mtree 中间版逐版核对 |
| 6 | `products.qoder` vs `qoder-cn` 的形态声明单源(新册 §11a #4 归本席 T12 #7 那一格) | 本席 §3 只量到 `runtime-manifest.json` 的 `productId` 恒为 `"qoder-cn"`,未见形态枚举 | 属**代码侧**落点,归 Y3 席(`PRODUCT_FORM_CAPABILITY_OVERRIDES`);取证席不代裁 |

## 5. 本席未能判定清单

| # | 未判定项 | 卡在哪 | 本席动过什么 |
| --- | --- | --- | --- |
| 1 | `mtree.win32-x64-msvc.node` 反编译正文 | 巨型原生模块 1.87 MB;REA 6.4.0 `analyze` 硬预算 5.5 min、Ghidra 330 s 超时,前席两次实测复现;本席按 AGENTS §0.11 时间盒约束**未派生 REA/Ghidra**,不冒绿 | 只做了 PE 头/节表/导出目录/导入目录级解析(readFileSync + DataView,零 require) |
| 2 | `qoder-context-hook.exe` argv 分派键**全集**(是否只有 §2 观测的 6 枚) | 需函数级反编译或 `.rdata` 全量 strcmp 分支映射(时间盒外) | 从 `hooks.json` 声明反推 6 枚叶子命令;`.rdata` 尺寸 162,324 B 已量到 |
| 3 | `deny` / `ask` / `allow` 三段决策是否在本 exe 内落地(旧册 T12 §7 B2) | 属 Qoder context-plugin 靶;新册 §5 第 2 行逐字点名"不在 Trae 席射程,未被重开";本席按 §0.11 时间盒未派生 REA | 未动 |
| 4 | `assets/r1/{a,b}.bin` 正文形态与用途(旧册 T12 §7 B3) | §0 红线"刻意没读正文";本席只量到跨 8 版字节 + sha 一致(见 §3) | 未动正文 |
| 5 | Qoder CN 主客户端 `build-manifest.json` / `install-type.json` 现读版本号 | 该路径(§0 声明"读了什么"里)属主客户端资源目录,与插件 cache 是两个面;本席本轮只在插件 cache 1.0.91 面取证,未直取主客户端版本 | 未动 |
| 6 | `mtree` 单导出 `napi_register_module_v1` 之后的完整 N-API desc 数组(即模块注册回调导出的方法名集合) | 需运行时解析或函数级反编译;本席不 require 靶件(§0 红线) | 未动 |
| 7 | `hooks.json` 的 `matcher` 语义与运行器实现是否与本仓 `apps/cli` 的 `runHook` 分派对齐 | 需函数级读对方 exe 分派器(时间盒外)或读对方 JS 侧 `runtime/qoder-search.bundle.mjs`(§0 红线只允许字节 / PE / 声明层读取) | 未动 |
| 8 | `mtree` 的签名引入**具体落点**在哪一版(本席只判了 1.0.51=未签 / 1.0.91=已签) | 只做了 51/91 两端 cert 检查,未逐版核 61/72/74/78/84;成本极低但预算内未排 | 未动 |

**特别提示(AGENTS §0.11 第④步"超越轴")**:本席的"cert rva/size 逐版核对"这一层观察**旧册未覆盖**,把「对方何时开始签名」从 [未知] 升为 [观察];结合 `Get-AuthenticodeSignature`(不 launch、不改文件)可再闭合 §4 #5。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
