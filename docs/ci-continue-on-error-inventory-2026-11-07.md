<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# CI `continue-on-error: true` 清单（2026-11-07）

> 口径：以 **HEAD 的 `.github/workflows/*.yml` 实况**为准（现读 8 处，逐条对应下面 8 行）。
> 本文件是**观察期台账**，不是"全部转硬失败"的计划。总原则：先加可数读数，再谈收紧；
> 一步从软改硬、全仓一片红，结果一定是有人把整套守门一起关掉（2026-10 已真实发生过）。
>
> 现状：以下 8 处**都保留软失败，不改成硬失败**。

## 0. 结论先行

| 项 | 值 |
|---|---|
| 全仓 `continue-on-error: true` 步骤 | **8** |
| 「采集/监控类，失败只丢一列读数」 | 3（#1–#3） |
| 「发布后取证/上传类，失败不能让已完成动作回滚」 | 3（#4–#6） |
| 「下游硬断言已兜底，软只为不提前中断」 | 1（#7） |
| 「存量红观察期」 | 1（#8） |
| 已具备可数收紧判据 | **1**（#8：连续 7 夜 N=0） |
| 仍缺可数判据（下一步） | 6 |

## 1. 逐条清单

| # | workflow | step（id / name） | 跑什么 | 为什么软 | 什么时候能收紧 |
|---|---|---|---|---|---|
| 1 | [loop-daily-triage.yml](../.github/workflows/loop-daily-triage.yml#L58) | `triage`（name「loop-triage（代码卫生 + 静态分析 + 依赖健康）」） | TODO/FIXME 计数、禁用目录追踪检查、`.env.bak` 泄漏、eslint 告警数、`pnpm audit` high+critical、`tsc error TS` 计数；产出 `.loop-tmp` 指标 JSON | **可证伪**：该步失败的唯一后果是 `.loop-tmp` 某列写「未采集」；本 workflow 内没有任何后续 step 把该 JSON 的缺失/字段缺失当作成败判据。若发现某 step 以它判红，此「软」即不成立 | 先给该步产出**可数读数**（`未采集` 的指标数 + 每项是否成功采集），连续 7 天「采集完整率 100%」且趋势指标无回归 ⇒ 再区分"采集失败"与"指标真的变坏"，只对后者硬失败。可数前提：日报首行出现「本日 M 项未采集」 |
| 2 | [nativewind-monitor.yml](../.github/workflows/nativewind-monitor.yml#L40) | `check`（name「检查 NativeWind 升级就绪状态」） | `node scripts/check-nativewind-status.mjs`（读 npm dist-tags）；仅 exit 1（5.0 stable 已发布）才把 step 标失败，exit 2（网络异常）视为成功 | **可证伪**：脚本把 exit 2（网络异常）与 exit 1（stable 已发布）分开，只有 exit 1 才应触发；真正的"该升级了"由下一步创建 Issue 承载。若脚本开始把 exit 2 也当 exit 1，或 Issue 步依赖本步 success，此「软」即不成立 | 已自带"网络异常 vs 已发布"分流，**不需要收紧**；可补：把 exit 2 写进 Job summary（「本次网络异常 K 次」）看见采集失败率 |
| 3 | [mobile-rn-release.yml](../.github/workflows/mobile-rn-release.yml#L81) | name「链路体检（现读每条腿的前置与卡点）」 | `node scripts/release-mobile-rn.mjs`（只读体检：打印各发布腿的前置与卡点） | **可证伪**：脚本只读打印；同 workflow 内没有任何后续 step 读取它的 stdout/退出码来决定是否发布。真正的发布腿在下一步且**不软**。若发现某腿依赖本步结果，此「软」即不成立 | 把"读不到的腿数"变成可数输出；连续 7 次发布预检 0 条腿读不到 ⇒ 体检本身可硬失败 |
| 4 | [mobile-rn-release.yml](../.github/workflows/mobile-rn-release.yml#L93) | name「收尾回读（体检再看一次，确认渠道里 update 计数前进）」 | `node scripts/release-mobile-rn.mjs --json`（发布后回读渠道状态） | **可证伪**：该步在所有上传/发布动作之后运行，其失败不触发任何重试/重发/回滚 step。若下游按本步结果重发，此「软」即不成立 | 回读结果写进 Job summary（「update 计数前进 ΔN」）；连续 7 次发布 Δ 可读且 >0 ⇒ 回读可硬失败 |
| 5 | [npm-bootstrap.yml](../.github/workflows/npm-bootstrap.yml#L99) | name「Upload evidence + encrypted secrets」 | `actions/upload-artifact` 上传 `.github/scripts/shots/` 取证截图；`if: always()` + `timeout-minutes: 4` | **可证伪**：`if: always()` 的取证上传，下游没有 step 下载该 artifact 作为判定输入。若发现某判据读这个 artifact，此「软」即不成立 | 把"上传成功/失败"写进 Job summary 首行；连续 7 次上传成功 ⇒ 可收紧为硬失败（但仍需保留 `if: always()`，否则失败路径取证会消失） |
| 6 | [release-desktop.yml](../.github/workflows/release-desktop.yml#L243) | `tauri`（name「Build & Release」，`tauri-apps/tauri-action`） | 构建 + 签名 + 上传 Release assets | **可证伪**：2026-09-05 实证存在假失败（非 ASCII `productName` 在 Linux/macOS 路径失配报 "No artifacts were found"，而产物实际构建+签名成功）；下一步 `Verify bundle produced (fail loudly)` 独立硬判产物存在。**若该硬断言被删或也被软化，此「软」即不成立** | 上游 action 修掉非 ASCII 路径判定后（盯 tauri-action release notes），本地复跑非 ASCII 产物收集为 0 假失败 ⇒ 摘掉此行；**在此之前不许摘**（2026-09-18 已有先例：软失败吞掉 makensis 真失败，0.1.35 无 Windows 资产） |
| 7 | [release-desktop.yml](../.github/workflows/release-desktop.yml#L737) | `fetch-signed`（name「Download signed artifact」） | `actions/download-artifact` 取签名产物 | **可证伪**：下一步 `assert-signed`（不软）硬判"真缺"并判红；本步失败只意味着"还没下载到"，不是结论。**若 `assert-signed` 被删或也软，此「软」即不成立** | 不需要收紧：软只是"允许它先失败"，结论由下一步给。可补：把 download 失败原因写进 Job summary 首行 |
| 8 | [scripts-mirror-tests.yml](../.github/workflows/scripts-mirror-tests.yml#L156) | `mirror`（name「Run all mirror tests」） | `node scripts/run-script-tests.mjs`（全量 `scripts/tests/*.test.mjs` + `deploy/tests/*.test.mjs`） | **可证伪**：本机之外从未在"干净 Windows + 装好依赖"环境跑过全量；拿未验证的门阻断全队会直接诱发 `--no-verify`（2026-10 已发生过一次）。**7 夜 N=0 后"未验证"前提失效，此「软」即须收紧** | **连续 7 夜（schedule、全量、非 `--changed`）Job summary 首行「本夜 N 个测试文件失败」N=0** ⇒ 改硬失败。任一夜 N>0，连续计数归零重来（不累计） |

> 计数口径（#8）：`run-script-tests.mjs` 写入 `GITHUB_OUTPUT` 的 `soft_fail_files`
> = 红了的测试文件数 + 超时片里的文件数 + runner 解析失败片里的文件数。
> 该值由 Job summary **首行**输出（schedule 触发为「本夜 N 个测试文件失败」，其他触发为「本次 N 个」）。
> 没有这一行，清单只是又一张纸 —— 所以它是 #8 收紧的**唯一**判据。

## 2. 为什么先不全部硬失败

- 2026-10-15 那夜：`Setup pnpm` 报 "Multiple versions of pnpm specified" ⇒ 其后全部 step skipped ⇒
  一行用例都没跑，而 run 结论仍是 `success`（连续 8 晚）。这不是"红得太多"，是"根本没判"。
  把软失败一刀切改硬，遇到的是另一型：**红得太多 ⇒ 整体被关掉**。两种都会让守门归零。
- 因此顺序是：**先可数 → 再收紧**。可数读数必须能回答"这一夜到底失败了几枚文件/几条腿/几项未采集"，
  而不是只看 `success`。
- 收紧一律以"连续 N 夜 0 失败"为条件，N 默认 **7**；任何一夜 >0 就归零重来。

## 3. 下一步（未做，按优先级）

1. #1 日报：首行输出「本日 M 项未采集」。
2. #3/#4 移动发布：体检"读不到的腿数"、回读"update 计数 ΔN"进 Job summary。
3. #2/#5/#7 已自带下游判据，只需把失败原因计入 summary，不改软硬。
4. #6 桌面构建：盯上游 tauri-action 修复；未修复前保持软 + 硬断言兜底。
5. #8 已就绪：等 7 夜 N=0。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
