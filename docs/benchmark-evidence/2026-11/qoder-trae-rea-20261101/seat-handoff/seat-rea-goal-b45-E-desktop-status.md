<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# E 席进度心跳 — operator.rs 输入动作面补齐 + 审批门/永不重试（2026-11-01）

## 开工现场（现读）

- `git rev-parse HEAD` = `e2a418dd8456bf72c511be31116b075428638278`（分支 main）
- 工作区对 `apps/desktop/src-tauri/**` = 净（多会话在他席面有改动，与本席无关）
- 对照册已读：`docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T8-sidecar-native-surface.md` §A 全部

## `OperatorAction` 全集现读（operator.rs:63-69，改前）

```
Click    { x: i32, y: i32, button: String, count: u32 }
TypeText { text: String, delay_ms: u64 }
Scroll   { delta_y: i32, x: Option<i32>, y: Option<i32> }
Wait     { ms: u64 }
NoOp
```

⇒ 与对侧 14 档动作族对照，本仓**已有**：click / type_text / scroll（3 枚输入类）。
⇒ 本仓**缺**的输入类：`drag`（from_x/from_y/to_x/to_y）、`press_key`（X-style 键名 + 组合键 `Control_L+a` 形）。
⇒ 对侧另有的 `set_value` / `perform_secondary_action`（UIA 语义写值通道）本席不做（需 UIA 栈，非 enigo 原语）。

## 调用面现读（决定能否动 tauri command 签名）

`grep -rn "operator_execute|operator_decide"` 全仓：命中仅
- `apps/desktop/src-tauri/src/lib.rs:4210-4211`（invoke_handler 注册）
- `.ihui-agent/tmp/stale-backup/`、`.worktrees/derived-heal/`、`.worktrees/fix-residual-1031/` 的过期副本

⇒ **桌面前端零调用点**，改签名不扩大面，无需先等人裁决。

## 环境事实（现读）

- `cargo 1.97.0` / `rustc 1.97.0`，`CARGO_HOME=D:\caches\cargo`
- `enigo` 锁 0.6.1：`Keyboard::key(Key, Direction)` / `text(&str)`、`Mouse::{button, move_mouse, scroll}`、`Direction::{Press,Release,Click}`；`Key::{Control, Shift, Alt, Meta, Return, Tab, Escape, Space, Delete, Backspace, F1..}` 未加 cfg 门（全平台可用），字母走 `Key::Unicode(char)`（win 后端 435 行有 unicode 兜底分支）
- `apps/desktop/src-tauri/target/` 不存在 ⇒ 首轮为全量冷编（tauri 全家桶 + bundled sqlite），耗时需预留

## 状态(收尾)

- [x] 取证册读毕、动作面缺口定档
- [x] `Drag` / `PressKey` 入枚举(operator.rs:91 / :102)+ `run_action` 真执行分支(:573 / :608,enigo 原语,无 todo 占位)
- [x] 审批门(`check_approval` :327)+ 永不重试(`max_attempts_for` :409)+ 注入式执行体(`ActionExecutor` :644)
- [x] revision 陈旧即拒:**判定为不可做** —— `ScreenState{width,height,elements}` 无代际/版本字段,加字段属跨面契约改动 ⇒ 停下报告
- [x] cargo test 末行:`test result: ok. 330 passed; 0 failed; 7 ignored; 0 measured; 0 filtered out; finished in 1.63s`
- [x] cargo check 末行:`Finished dev profile [unoptimized + debuginfo] target(s) in 5.34s` / runner exit=0
- [x] watermark verify(operator.rs):残迹 0 / 载荷损坏 0 / 仅隐写 0 ⇒ 完整
- [x] 变异测试(证明判据不是假的):
  - `requires` 改成恒 false(门摘掉)⇒ **8 枚红**(denied/mismatch/refusal/wire/drag+key 各条)
  - `ActionClass::Input => policy.passive_max_attempts`(重试禁令可放宽)⇒ **2 枚红**(`input_action_failure_never_retries`、`input_attempt_ceiling_is_immune_to_policy`)
  - 两处变异均已逐字还原(`grep -n MUTATION` = 空)

## 验证命令原文(裸 cargo 不可行 ⇒ 走已注入 MSVC 的驱动器)

```bash
node .ihui-agent/tmp/rea-goal-b45/cargo-with-msvc.mjs cargo test --lib --color never
node .ihui-agent/tmp/rea-goal-b45/cargo-with-msvc.mjs cargo check --color never
```
驱动器只 import `scripts/lib/msvc-env.mjs`(`planBuildEnv`/`needsMsvcInjection`)、
`scripts/desktop-build.mjs` 的 `__test__.captureVsEnv`、`scripts/lib/rustup-env.mjs` 的
`applyRustupPinToEnv` —— **两个在册脚本一行未改**。实测注入源:
`C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\...\14.44.35207\bin\HostX64\x64`。
`cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`(仓库根形态)在本驱动器下会报
`manifest path ... does not exist`,因驱动器 cwd 固定在 src-tauri ⇒ 改用上面那条(cwd 同为该 crate,
判据等价,`cargo check` 与 `cargo test` 都是现编现跑,不是缓存假绿)。

## 副产物留痕(非本席所写,主席落地时自行裁决)

`apps/desktop/src-tauri/gen/schemas/capabilities.json` 被 tauri-build 在首轮 cargo 时重生
(mtime 2026-11-01 01:52,本席会话内)。内容 = 已提交的 `capabilities/default.json`
(2026-10-31 14:22 那批 R6:33 项凭据采集/设备重置命令移出 remote 授权面)的**派生态**;
HEAD 里那份是陈旧的。本席未手写它、也未回滚它(回滚 = 把陈旧派生态按回去)。

## 中途发现并当场修掉的假实现(记录以防复发)

`run_allowed` 首版算了 `max_attempts` 却没在失败支用它 ⇒ 被动类预算形同虚设(输入类"永不重试"
恰好因为"整体不重试"而看起来是对的)。Rust 的 `unused variable: max_attempts` 警告把这一格暴露出来,
`passive_action_does_retry_per_policy_positive_control` 正向对照随即会红 ⇒ 补真循环:
失败且预算未尽则再发一趟,输入类因预算=1 结构上进不了那一支。


## 实测的措辞降级(读册后的校正)

册 §1.2「没找到的东西」那段的准确形态:
- 「`.rdata` 里 approval/approve/consent/confirm_dialog/hitl/human_in_the_loop **0 命中**」= **[观察]**(可复验)
- 由它得的「人工批准门住在宿主/IDE 侧、不在原生 exe 里」= **[推断]**
- 同理速率:「`rate_limit`/`throttle`/… 0 命中」= [观察];「节流靠超时+有界步骤+有界重试,不靠 QPS 闸」= [推断]

⇒ 因此「超越」的准确说法是:**本仓在原生执行层内置了审批门与按类别的重试禁令**;
不能写成「对方产品没有审批门」——取证面只覆盖那一枚 sidecar exe。已把这条写进 operator.rs 的门注。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
