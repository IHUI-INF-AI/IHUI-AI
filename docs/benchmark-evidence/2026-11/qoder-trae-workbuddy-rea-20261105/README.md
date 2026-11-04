<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# rea goal-b49 · WorkBuddy / Qoder CN / Trae 对照取证与复现台账(2026-11-05 开批)

引擎:`rea-agents@6.4.0`(全局装于 `D:/caches/npm/prefix`,项目级 MCP 入口 `scripts/rea-mcp-entry.mjs`,配置 `.ihui/mcp.json`)。
纪律:AGENTS.md §0.11「逆向-复现-超越」四步 + 红线(不粘对方源码、不破解许可证、不绕付费、不提取凭据)。
本册三席报告均按「观察 / 推断 / 未知」三态标注,取不到输入一律记未判定,不冒绿。

## 1. 靶(现读定位,非记忆)

| 对照程序 | 版本 | 实读安装路径 | 取证席 |
| --- | --- | --- | --- |
| WorkBuddy | 5.9.3(Tencent) | `G:\workbuddy\`(Electron,`resources\app.asar` 181,996,084 B) | W1(主进程/CLI/原生面)+ W2(外围与运行时) |
| Qoder CN | 0.5.3 | `G:\Qoder CN\.qoder-versions\0.5.3\`(Electron) | Q1(主程序 bundle,结清上批遗留格) |
| Trae CN | 3.4.15 | `C:\Users\Administrator\AppData\Local\Programs\Trae CN\` | 本批未重取(goal-b44—b48 已量过,残余见 §4) |

版本与路径出处:注册表 `Uninstall` 面 + 开始菜单 `.lnk` 目标 + 进程表 `Win32_Process.ExecutablePath` 三路互证。

## 2. 本枚已落地(代码已进本仓历史)

提交:`e2d819a0a4498b5b0416eaeb49588116e574e2e9` — feat(cli): 复现并超越 WorkBuddy 的按操作分维文件访问裁决

| 件 | 动作 | 内容 |
| --- | --- | --- |
| `apps/cli/src/sandbox/glob-pattern.ts` | 新建 | glob 匹配抽成单一真相源,`checkFolderTrust` 与新裁决共用同一把尺 |
| `apps/cli/src/sandbox/file-access-policy.ts` | 新建 | read/write/delete 三轴独立裁决;凭据族读侧 deny(含根层裸形态);守护面族从 `scripts/data/immutable-guard.json` 逐枚派生,取不到或枚举到 0 条判未判定 |
| `apps/cli/src/sandbox/index.ts` | 改写 | 内联 glob 换成 import 同一原语(行为不变,`tests/sandbox.test.ts` 39 例回归绿) |
| `apps/cli/src/tools/builtins.ts` | 接线 | `read_file` 的判据排在任何 fs 动作之前,拒绝即返回 |
| `apps/cli/src/tools/index.ts` | 接线 | 写侧在 `folder_trust` 之后追加一层,只可能更严 |
| `apps/cli/tests/file-access-policy.test.ts` | 新建 | 16 例:含正向对照、例外族声明序、跨盘绝对路径、未判定不记绿、形状锁(裁决不碰 fs)、装车证明(`read_file` 真走到这层) |

超越轴(逐条可验,不是口号):
1. **清单不抄第二份** — 对方规则随安装包二进制分发(审不到也测不了);我方守护面规则由已审清单派生,门可随时重算。
2. **可测性** — 注入式清单读取器 + 纯函数,CIM 里直接断言;拒绝发生在 `existsSync` 之前由用例钉死。
3. **失效方向** — 取不到清单判「未判定」并点名原因,绝不空表冒充「本仓没有守护件」(§0.3)。
4. **不制造恒拦门** — 守护面写/删默认 advisory(出声放行),严档由 `IHUI_FILE_ACL_STRICT=1` 升;凭据族读侧恒 enforce(§12e)。

## 3. 三席取证读数(数字现读于各自报告)

- W1:40 条能力;缺口表 17 行 = 零对位 10 + 半格 7,其中「零对位且建议落地」8 条(①删除保护链 ②文件 ACL(本枚已落) ③子进程网络出口 ④Job Object ⑤工具面惰性装载 ⑥成本档位审批 ⑦对抗式多票校验 ⑪CLI 启动三件套)。方法学反差已登记:REA 对 main 的 `ipc.literal_channels=0`,人工 grep 同目录得 41 条 `wb:` 通道 ⇒ 该维以人工取证为准。
- W2:16 行缺口表(含零对位 7)。两处**自家活账**由本席顺手挖出:① `packages/database/drizzle` journal 与 sql 文件集双向差集(2 枚已入库孤儿 ⇒ 按链建库会缺表且无人知);② `apps/cli/src/commands/share.ts` 的报告 HTML 走 marked.js CDN 外链(离线不可用)。本席撞 subagent 150 轮上限中止,报告四段齐备、正文中一处「逐调用 context 内容」的关键结论**尚未完成复核** ⇒ 该条按未判定采信,不得当已证结论引用。
- Q1:上批 T12 §7 遗留格「10 枚未接线导出的真实消费方」**已结清** = 10 枚全部 0 消费方(主包未混淆、asar 内既无 mtree 二进制也无装载路径 ⇒ 结构上不可能消费);native 模块内部自调仍标未知(REA Ghidra 330 s 超时)。主程序面另取证 23 条能力,对位 15 条(5 零对位 / 7 半格)。

## 4. 残余清单(逐条给归属与解锁条件,不写「已完成」)

| 残余 | 归属 | 为什么本枚没做完 | 谁解锁 |
| --- | --- | --- | --- |
| 删除保护链(回收站 + 批量两阶段护栏) | 下一执行席 | 本枚只吃 ACL 一格 | 按 W1 §3-① 派单 |
| 子进程网络出口(DNS + TCP 代理双引擎) | 下一执行席 | 同上 | W1 §3-③ |
| Job Object 随父而终(TS 侧) | 下一执行席 | 需 Win32 作业对象封装,与 `os_sandbox.py` 那半不同栈 | W2 §3 末条 + W1 §3-④ |
| 文件 ACL 的 delete 轴消费点 | 下一执行席 | 写侧已接,delete 散在 `fs.rmSync`/`unlinkSync` 多处,需逐点接线并带回归 | 本枚落地件的自然续集 |
| 守护面 advisory 升 blocking | 机主/下一批 | 升档前置 = 并行席改动工作流先有「带理由声明」的出口(§12e) | 存量归零后升 |
| drizzle journal ↔ sql 双向对账尺 | 下一执行席 | 本枚只做代码面 | W2 §3(先只读尺挂 guardian 巡检轮) |
| `share.ts` marked.js CDN 外链改内联 | 下一执行席 | 独立小债 | W2 §3 |
| Trae 面增量 | 未开 | 本批三席全压在 WorkBuddy/Qoder 两个新靶 | goal-b44—b48 残余见 `docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/` |
| **推送未落地** | 主席(下一轮) | 本地与 `origin/main` 分叉,`git-sync-converge.mjs`(含 `--take-theirs-doc`)拒推进:自证把本侧继承的 README 派生数字行与已退役归档注释算成「被吞」;远端 5 分钟内推进三次 | 按 §16b 收敛一轮:fetch → converge → `gen-doc-numbers --markdown` 重生成派生件 → 再 push |

## 5. 复验命令

```bash
node scripts/watermark.mjs verify docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105
cd apps/cli && npx vitest run tests/file-access-policy.test.ts tests/sandbox.test.ts
node scripts/git-push-converge.mjs            # 只读六态,判「是否已同步」只认这条
node scripts/git-sync-converge.mjs            # 收敛唯一入口(勿手工 fetch/merge/push 循环)
# 三席报告的复算命令各自末段(W1 §4 / W2 §4 / Q1 §5),含 REA 与 Ghidra 的 env 前置
```
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
