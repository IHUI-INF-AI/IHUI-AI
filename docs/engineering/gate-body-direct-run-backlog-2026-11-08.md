<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 直跑面判面层覆盖：48 道存量债迁移票（B 票）

> 现场：本票随 `fix/gate-body-provenance-1108` 入库，基线 `origin/main` = `f58d8df459`。
> 状态：**挂起**。本轮只交付 A（派发面全覆盖）+ C（ratchet 结构门），不做这 48 道的一次性迁移。

## 1. 为什么有这份票

同一根因在两天内发作三次，都是「门在旧树上作答」，且以 exit 0 / exit 1 的形态出现：

1. `immutable-guard` 在 merge-base 落后 `origin/main` 的树上报 3 条 `bad-kind`（旧 `PROTECTED_KINDS` 缺 `autonomy-executor` / `autonomy-cost`；在 origin/main 的 lib 上复算为 `entries=26, problems=[]`）；
2. 门 193 / 307p 报的脚本在被判树里根本不存在，307p 还用旧生成器得出了滞后结论；
3. 门 173 判 index 面，而 `sync-readme-numbers.mjs` 走 worktree 面 —— 两面读数互斥。

A + C 已落地（见 `scripts/lib/gate-body-provenance.mjs`、`scripts/lib/guardian-executor.mjs`、`scripts/gate-worker.mjs`、门 312 `scripts/check-gate-body-direct-run-coverage.mjs`）：**经派发层跑的每一道门，都会先自证「门体同代」**，门体与被判树不一致 / 被判树里不存在 / 判面未声明 ⇒ exit 2，不再可能退化成 0/1。

剩下的缝只有一条：**不经派发层、直接 `node scripts/check-x.mjs` 直跑**。这类门若没 import 判面层，就拿不到门体同代自检。当前存量 48 道（台账 `scripts/data/gate-body-direct-run-allowlist.json`）。

## 2. 为什么不一次性迁移

- 一次性红 48 条，而动的正是并发合入期间最热的 `scripts/` —— 阻塞代价大于收益；
- 但只做 A 又等于承认「直跑面永远有缝」。所以补了门 312 做只许收紧的闸：**新增门长不进这条缝，存量 48 道逐条还账**。

## 3. 每道门迁移要做什么

单一真相源是 `scripts/lib/gate-body-provenance.mjs` 的 `resolveGateFace` / `assertGateBodyProvenance`，判面层入口是 `scripts/lib/face-reader.mjs` 的 `selectFace`。逐门迁移 = 二选一：

| 档 | 做法 | 适用 |
| --- | --- | --- |
| 甲 | 改走 `selectFace({ staged, worktree, def })` 取材，并在 `scripts/data/gate-face-declarations.json` 登记 `face` + `reason` | 取材可拆成「从判面读」的门 |
| 乙 | 保留自身取材，但显式声明判面（argv `--staged` / `--worktree` 或登记表），并 import 判面层触发门体自检 | 取材靠外部命令 / 需要全树扫描的门 |

无论哪档，**必须删掉本门在 `scripts/data/gate-body-direct-run-allowlist.json` 里的条目**。留着会被门 312 判「清单腐烂」（R3：条目已覆盖却仍在册 ⇒ exit 1）。

## 4. 验收判据（每道门逐条核）

1. 直跑该门：`node scripts/check-x.mjs` ⇒ 门体与判面同代时正常出结论；
2. 故意在旧树上跑（`git stash` 后 checkout 旧 blob 于另一 worktree）⇒ **exit 2**，且 stderr 含「未判定」/「无法判定」，不打印具体违规条数；
3. 台账删条目 + 门 312 复跑 ⇒ exit 0，读数里「存量债」减 1；
4. 派发面（`guardian-runner.mjs` / `gate-worker.mjs`）读数与直跑面一致。

## 5. 48 道在册清单（只许缩短）

台账原文见 [gate-body-direct-run-allowlist.json](../../scripts/data/gate-body-direct-run-allowlist.json)，`why` / `reviewBy` 沿用 `immutable-guard` 台账习惯（到期未迁移 ⇒ 门 312 判 R4 红）。

| # | 门脚本 | 用途 | reviewBy |
| --- | --- | --- | --- |
| 1 | scripts/check-adapter-style-parity.mjs | miniapp-taro adapter 层硬编码颜色守门(2026-09-03 立)。 | 2027-06-30 |
| 2 | scripts/check-adapter-wiring.mjs | miniapp-taro 适配层「未接线即拦」守门(2026-09-22 立,P2-F.5 配套)。 | 2027-06-30 |
| 3 | scripts/check-artifact-budget.mjs | 守门:产物预算门 A8(2026-09-25 立,规格 zcode-absorb/MECHANISM-SPEC-3.md §1) | 2027-06-30 |
| 4 | scripts/check-brand-email-channel.mjs | 品牌邮件通道守门 | 2027-06-30 |
| 5 | scripts/check-c-drive-pollution.mjs | C 盘污染实地扫描 | 2027-06-30 |
| 6 | scripts/check-cli-i18n-parity.mjs | CLI i18n 文案对账（packages/i18n/messages/cli/*.json） | 2027-06-30 |
| 7 | scripts/check-config-table-existence.mjs | O20d 守门:配置表名存在性机械门 | 2027-06-30 |
| 8 | scripts/check-cross-end-parity-drift.mjs | 跨端对齐「是否正在倒退」的只读漂移尺（不进提交链） | 2027-06-30 |
| 9 | scripts/check-cross-end-spec-coverage.mjs | 跨端 spec 覆盖率守门 + 棘轮（共享视觉原子下沉到 web/RN 双端消费） | 2027-06-30 |
| 10 | scripts/check-db-schema-drift.mjs | packages/database schema drift 检测 | 2027-06-30 |
| 11 | scripts/check-dev-db-rotation-window.mjs | 本机 dev 库口令轮换窗口判定器（票 O69） | 2027-06-30 |
| 12 | scripts/check-diagnostic-redaction.mjs | 子代理 stderr/stdout 诊断尾巴脱敏守门（G-998115 / b76-08） | 2027-06-30 |
| 13 | scripts/check-dist-encoding.mjs | packages/* + apps/* dist 文件 UTF-8 BOM 守门 | 2027-06-30 |
| 14 | scripts/check-error-message-bounded.mjs | 进持久记录的错误文案「只描述形状」上限度量（G-998147 / b76-12b） | 2027-06-30 |
| 15 | scripts/check-home-junctions.mjs | AGENTS §26「家目录工具态一律 junction 改道」完整性守门 | 2027-06-30 |
| 16 | scripts/check-i18n-broken-en.mjs | en.json 破碎机翻英文检测（pre-commit 第 2e 项） | 2027-06-30 |
| 17 | scripts/check-i18n-cross-end-wording.mjs | 跨端同名键文案漂移的裁定对账尺 | 2027-06-30 |
| 18 | scripts/check-icu-locale-support.mjs | 非 web 端 ICU 子集解释器支持面守门 | 2027-06-30 |
| 19 | scripts/check-installer-assets.mjs | 安装器品牌资产「引用 ↔ 打包 ↔ 落盘」三方对账（blocking） | 2027-06-30 |
| 20 | scripts/check-lint-staged-stdio-pin.mjs | lint-staged stdio 三针只读盯针门 | 2027-06-30 |
| 21 | scripts/check-list-cap-honesty.mjs | 「有界表归生产者、淘汰必须说出来且继续可数」（b76-13 票3） | 2027-06-30 |
| 22 | scripts/check-llm-provider-schema.mjs | LLM provider 字典化阶段 3 前置守门 | 2027-06-30 |
| 23 | scripts/check-mass-deletion.mjs | 整树删除事故的结构化拦截（pre-commit blocking, 门 id 65） | 2027-06-30 |
| 24 | scripts/check-migration-ledger-drift.mjs | O20e 守门:迁移账本带外对象防回潮 | 2027-06-30 |
| 25 | scripts/check-nested-additional-properties.mjs | 工具入参闭合声明与校验必须递归到每层（b76-14 票1 / G-998176） | 2027-06-30 |
| 26 | scripts/check-no-conflict-markers.mjs | 冲突标记残留守门 | 2027-06-30 |
| 27 | scripts/check-overlay-zindex.mjs | 全屏遮罩 z-index 层级守门 | 2027-06-30 |
| 28 | scripts/check-parent-pollution.mjs | 项目父目录污染巡查（运行时项目外文件创建禁令） | 2027-06-30 |
| 29 | scripts/check-process-exit-attribution.mjs | 子进程退出归因三态守门（G-998115 / b76-08a） | 2027-06-30 |
| 30 | scripts/check-project-plan-size.mjs | PROJECT_PLAN.md 长度守门（warn-only） | 2027-06-30 |
| 31 | scripts/check-safe-parse.mjs | Fastify 路由 safeParse 反模式巡检 | 2027-06-30 |
| 32 | scripts/check-scratch-root-no-nesting.mjs | scratch 根目录不许嵌套（只读告警,G-286 判据缺位） | 2027-06-30 |
| 33 | scripts/check-service-binary-paths.mjs | Windows 服务二进制路径烂掉量算（只读,票 G-302） | 2027-06-30 |
| 34 | scripts/check-sse-frame-watermark.mjs | 帧水位与纪元（logEpoch + (fromSeq,toSeq] + gap）判据（b76-13 票1） | 2027-06-30 |
| 35 | scripts/check-staged-typecheck-mirror-sync.mjs | 源/测 export 锚点回归测试 | 2027-06-30 |
| 36 | scripts/check-stale-stashes.mjs | Stash 滞留源码改动守门（AGENTS §12d 配套） | 2027-06-30 |
| 37 | scripts/check-statusbar-single-source.mjs | 顶部状态栏避让单一源头对账（blocking） | 2027-06-30 |
| 38 | scripts/check-tagsview-visual.mjs | 选中态描边定稿守门（防回退） | 2027-06-30 |
| 39 | scripts/check-tool-schema-projection.mjs | 投影完整性守门（b76-05 票2） | 2027-06-30 |
| 40 | scripts/check-upload-budget.mjs | 分片上传聚合预算棘轮门（b76-12c-3） | 2027-06-30 |
| 41 | scripts/check-verify-tmp-files.mjs | 一次性验证/探针脚本落点守门（AGENTS §25 配套） | 2027-06-30 |
| 42 | scripts/check-watermark-syntax.mjs | 溯源水印语法门禁（2026-09-03 P1 落地 / 2026-09-24 判据缺陷修复） | 2027-06-30 |
| 43 | scripts/check-workflow-step-order.mjs | GitHub Actions 步骤顺序 + 权限声明守门（blocking） | 2027-06-30 |
| 44 | scripts/check-zh-term-quality.mjs | 中文 UI 术语机翻残留守门（PROJECT_PLAN D104 / H29） | 2027-06-30 |
| 45 | scripts/desktop-nsis-template.mjs | 桌面端 NSIS 安装器模板生成 / 漂移校验 | 2027-06-30 |
| 46 | scripts/fix-package-exports-conditions.mjs | workspace 包 `exports` 条件真值对账/修复器 | 2027-06-30 |
| 47 | scripts/gen-knip-taro-entries.mjs | 从 Taro `app.config.ts` 派生 knip entry 清单 | 2027-06-30 |
| 48 | scripts/gen-tool-name-sets.mjs | 工具名单「单一真相源 → Python 可读生成物」唯一出口 | 2027-06-30 |

## 6. 排期与边界

- **排在并发合入收口之后**；本票不与并发批次抢 `scripts/`。
- 建议分批：每批 ≤ 8 道，每批落地后复跑门 312，确认读数「存量债」递减且无 R1/R2/R3/R4。
- 削减路径只有一个：**迁移**。门 312 的台账只许缩短；删条目必须附「已迁移」证据（复跑读数 + 该门直跑/派发面一致），删而不迁会被门 312 的 R2/R3 咬住。
- 48 → 0 之前，直跑面的说法统一为：`node scripts/guardian-runner.mjs --only=<id|script>`（见 `AGENTS.md` §6），不要直接 `node scripts/check-x.mjs`。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
