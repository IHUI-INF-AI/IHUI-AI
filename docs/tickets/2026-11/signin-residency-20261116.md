<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 签到腿 7×24 常驻裁决落地(2026-11-16)

## 机主裁决(逐字)

上一轮交付报告:「如果你希望签到这条腿**脱离 dev 习惯、7×24 常驻**,那就需要在服务驻留策略上做一档例外,你说一声我再办。」
机主回复:「**要**」(确认执行)→ 本轮结尾:「**继续按你的建议去做执行……完整收尾**」。
本票为该两轮授权的落地留痕;裁决性质 = 机主定向例外,非 agent 自扩需求。

## 病灶(实测取证)

- 签到调度器(APScheduler)与进程保活心跳住在 ai-service 进程内;本机按 2026-11-10 纪律「开发服务按需启停、禁止空常驻」。
- 现读:签到流水停在 2026-11-12 02:09,11-16 之前今日 0 条;8803 拒连 ⇒ 断供 4 天无一声响(§12f 判据失效恒安静型)。
- 同轮补账发现本机池账落后:`relay-account-pool-dedupe`(api worker 挂腿)在本机 api 长期不在位 ⇒ 跨池重复 6 组滞留、`20261114160000` 唯一索引 fail-closed 未过。

## 落地形态(最小常驻例外,不拆 11-10 的锁)

| 件 | 角色 |
| --- | --- |
| `scripts/lib/dev-stack-residency-policy.mjs` | 新增 `judgeSigninLegResidency` + `SIGNIN_RESIDENCY_RULING`(例外只覆盖 ai-service 一枚进程;`judgeDevAutostart` 原样不放宽,测试钉住) |
| `scripts/lib/ai-service-residency-runtime.mjs` | 纯判据单源:env 分层装配(根 .env ∪ apps/api/.env 覆盖,`CHECKIN_CRON_ENABLED` 未设则 true,同 run-ai.ps1:59)、`guardSingleWorker`(`--workers/--reload` 拒)、运行时二选一(venv `-m uvicorn` > `uv run`)、pid 账本形状、日志轮转线 |
| `scripts/ensure-ai-service-residency.mjs` | 幂等执行体:health 在位零动作 → AWAIT(账本活体让位,防双实例撞端口)→ SPAWN;procStart 双证记账 + 自愈补账;`--stop` 凭「pid ∧ 创建时刻」精确收口,pid 复用即拒杀 |
| `scripts/register-signin-residency-task.mjs` | 注册器:闸=上述 policy;30 分钟幂等节拍(拒绝 <5 分钟,不复活 2 分钟 watchdog 风暴);PS ScheduledTasks 主路 + Schedule.Service COM 回退,COM 模板从 `register-pool-sync-task.mjs` `__test__` import 零第二份;wscript+ASCII VBS 零黑窗;`--dry-run-task` 零写预演 |
| `scripts/tests/ai-service-residency.test.mjs` | 镜像 10 例,全部 import 生产判据(§22c,零复制) |

## 真机闭环(2026-11-16 实测)

1. dedupe 先 dry-run 决策核对 → 快照 12 行元数据落 `.ihui-agent/state/pool-dedupe-pre-apply-snapshot.json` → apply `groups=6 merged=6 droppedRows=6` → 回读重复组 0。
2. `pnpm --filter @ihui/database db:migrate` EXIT=0 → `ai_relay_account_pool_provider_uid_uniq` 现读已建(「一个上游账号=一条续期链」成为本机库不变量,防复发)。
3. 注册 → `--run-now` → ensure 拉起 python → 日志 `注册 11 个 job [checkin_daily_midnight=5 0 * * *, checkin_daily=5 8 * * *, …, checkin_local_creds_sync=*/15]` + keepalive 心跳继承(6h);同时段 O64 对账收敛器自动消化收敛余波(pool-sync `ver 6⇒7 UPDATE 0` 版本防降级实弹)。
4. `--stop` → `STOP done`(账本补齐后精确收口)→ 再 `--run-now` → 并发双 ensure 走 AWAIT 让位(不拉第二实例)→ 新实例 `RESUMED pid=24336 procStartMatched=true`。
5. 任务读数 `STATE=Ready LASTRESULT=0x0 NEXTRUN=+30min`。

## 实测中修掉的自造 bug(如实登记)

- `procStartMsOf` 用 spawnSync 却判 `r.ok`(spawnSync 无该属性)⇒ alive 恒 false,冷启动窗口会误拉第二实例;同时 `[DateTime]::Parse(CreationDate)` 带 culture 风险 — 改「退出码判定 + 直接 ToUniversalTime().ToString('o')」,并加常态补账。对照实验(同一 pid 新旧两版命令)钉死病根后再修。
- 一次盲替换脚本在 `watermark clean` 后中断,致 `ensure` 短暂丢水印;当场 inject 回灌并 verify 复验(§5c 规程)。

## 收回授权的出口(不隐式、不裸奔)

- 暂停(保留注册):环境 `IHUI_SIGNIN_RESIDENCY_DISABLE=1` ⇒ 注册器拒装点名出路。
- 卸载:`node scripts/register-signin-residency-task.mjs --unregister`;在跑的实例由日常 `pnpm dev:safe:stop` 或 `ensure --stop` 收口,不留隐藏常驻。

## 顺带发现(未修,归属点名)

- ai-service 侧 `[keepalive] 子账号失败 source=publish`:`column "display_name" does not exist` —— publish 域 keepalive 探针的库表列滞后的另一域缺陷;与签到/保活 Trae 腿无关(该轮 `checkin` 腿 `ok=22 alerted=0` 正常),不在本票射程,登记于此交后手对账。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
