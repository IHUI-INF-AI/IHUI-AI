<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R11 续轮取证：Codex 26.1111 execpolicy 网络规则建规则时验证层

> 承接上一轮 `R11-codex-26.1111-engine-permission-enforcement.md` §7 遗留缺口，本轮
> 把火力下潜到 **execpolicy 网络规则的建规则时 host/protocol 验证判据**——上一轮榨的是
> 「Windows sandbox 能不能强制」，本轮榨的是「一条网络规则能不能合法建表」，再深一层。

## 0. 本轮换什么目标

上一轮复现了 `sandbox_enforcement_gate.py`（Windows sandbox 强制可行性三态）。本轮在
`codex-command-runner.exe`（MSIX `26.1111.2228.0`）上继续定向 strings，命中 execpolicy
模块源码路径（补上一轮缺口）：

```
codex_execpolicy::parser::POLICY_BUILTINS_STATICS
execpolicy\src\executable_name.rs
execpolicy\src\parser.rs
execpolicy\src\rule.rs
```

由此下潜到**网络规则（network_rule）建表时的 host/protocol 验证层**——这是策略语言
的「语法/类型检查」阶段，比上一轮的「运行时强制」更靠前。

## 1. 网络规则 host 六条拒绝判据（逐字）

```
network_rule host cannot be empty
network_rule host cannot contain whitespace
network_rule host must be a specific host; wildcards are not allowed
network_rule host contains an unsupported suffix: <suffix>
network_rule host has an invalid bracketed IPv6 literal
network_rule host must be a hostname or IP literal (without scheme or path)
```

协议枚举（逐字）：``network_rule protocol must be one of http, https, socks5_tcp, socks5_udp``。

「unsupported suffix」的具体值取证到 **`.localhost`**（含去尾点 `.localhost.` 形态）——
即 codex 拒绝把 `.localhost` 域写进规则表（本机回环域走别的路径）。

## 2. 与既有模块的分工（不重复造轮子）

| 模块 | 职责 | 阶段 |
|---|---|---|
| `permission_profiles.normalize_host` | host **归一化**（剥端口/括号/尾点/小写） | 求值时转换 |
| `network_rule_amendments_58` | 规则保存后的**审批流**（NetworkApprovalContext/Amendment） | 运行时审批 |
| **`network_rule_host_gate`（本轮）** | **建规则时六条 host 拒绝判据 + 四值 protocol** | 策略写入前把关 |

`normalize_host` 回答「这个 host 归一后长什么样」；本 gate 回答「这个 host 能不能进
规则表」。前者转换、后者把关，互补不重复。

## 3. 本轮复现：`app/core/network_rule_host_gate.py`

把「一条网络规则能否合法建表」抽成**策略写入前的纯函数 gate**：

- `NetworkRuleProtocol`：四值协议枚举（http/https/socks5_tcp/socks5_udp）+ serde 别名
  （`https_connect` / `http-connect` → HTTPS，对齐 approvals.rs:68 既有取证）。
- `validate_network_rule_host()`：六条 host 判据，固定顺序——空值 → 空白 → 通配符 →
  scheme/path → 非法 bracketed IPv6 → unsupported suffix → ACCEPTED。
- `validate_network_rule()`：组合验证，先 protocol（有限枚举、判据最便宜）再 host。
- 三态：`ACCEPTED / REJECTED / UNDETERMINED`（host/protocol 非字符串 ⇒ UNDETERMINED
  点名原因，不冒充结论——§0.3「没判绝不写成判过」）。

每条 REJECTED 都带 rule_id（如 `network_rule.host.wildcard`）+ 逐字 codex_error 锚，
审计可追溯到对侧具体校验。

### 判据顺序的取舍（诚实记录）

host 六条按「先拦语法非法、再拦语义非法」排序；protocol 判据放在 host 之前（有限枚举
最便宜、错误最具体）。这是本仓的显式选择，非对侧原文顺序——对侧把校验埋在 serde 反
序列化层，逐字段顺序未取证到，本仓按可读性与性能自定并在此声明。

## 4. 一轴超越

对照把六条校验埋在 Rust 引擎 serde 反序列化里，错误只在**引擎加载规则那一刻**抛（晚了
——规则已下发）。本仓把校验抽成**规则表写入前**的纯函数 gate：结论可 diff、可单测、
可在策略下发前拦下非法 host/protocol，且拒绝原因结构化成 rule id + codex 错误锚。零
第三方依赖、零执行、纯函数 + 结构化 verdict。

## 5. 验证

- 34 个测试全过（`tests/test_network_rule_host_gate.py`）：六条 host 判据各覆盖正/反例、
  protocol 四值 + 别名 + 大小写归一、组合验证、UNDETERMINED、以及**合法 host 防过宽**
  边界（`localhost` 裸域 / `[2001:db8::1]` / punycode IDN 不被误拒）。
- **反向变异验证**：禁用 wildcard 判据（`if False:`）后 3 个测试失败（含组合验证透传），
  证明判据非恒真；恢复后全绿。
- ruff 全绿（UP042 按项目既定例外 `# noqa`；import 排序 --fix）。
- 回归：既有 `test_network_rule_amendments_58.py`（32）+ `test_network_approval_52.py`
  （18）+ `test_permission_profiles_58.py`（26）全过，新 gate 未破坏既有网络/权限层。
- 水印：新增两文件各 1 处 `IHUI-AI-PROVENANCE`。
- 红线遵守：只读 strings 取证、不反编译、不运行对侧程序、不粘源码、不碰在飞文件（新
  文件独立，未改 `network_rule_amendments.py` / `permission_profiles.py`）。

## 6. 诚实修正记录（本轮踩坑）

- **serde 别名归一 bug**：`parse()` 先把 `-` 归一成 `_`，但 aliases 表误存连字符形态
  `http-connect` → 永远匹配不到。测试抓出后修正为归一后 key `http_connect`。教训：
  alias 表的 key 必须与归一后的 key 同形态。
- **无证据别名**：最初误加 `http_connect`（下划线）别名，核对既有 `network_rule_amendments.py`
  只登记 `http-connect`（连字符）+ `https_connect`；修正为只保留有据的两个。

## 7. 遗留缺口

- `PrefixPattern { canonical_matching, first, rest }` 前缀匹配算法未展开（canonical_matching
  是大小写归一开关？first/rest 是前缀分词？需续挖 rule.rs）。
- `example string has invalid shell syntax` / `POLICY_BUILTINS_STATICS`：execpolicy 的
  Starlark 策略示例自测机制（`match`/`not_match` 正反例）本仓 policy_dsl 已复现，本轮未重复。
- `executable_name.rs` 的 `host_executable name must be a bare executable name` 校验未展开。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
