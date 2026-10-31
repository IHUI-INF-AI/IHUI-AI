<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# WorkBuddy 任务中心:自动做任务

> 适用范围:`apps/ai-service`(执行侧) + `apps/web` 签到页(手动入口)。
> 本文所有命令与字段均以仓库当前实现为准;改代码请同步改本文(文档写跑不通的出路 = 违规,见 AGENTS.md §0.8)。

## 1. 它做什么

WorkBuddy 任务中心有六族可赚积分的入口。「自动做任务」按固定顺序跑完一轮:

| 顺序 | 族 `kind` | 做什么 | 写侧 |
| --- | --- | --- | --- |
| 1 | `activity` | 行为上报(把「我做了某事」报给平台计分) | 是 |
| 2 | `growth` | 读任务列表 + 达标领奖 | 是 |
| 3 | `travel` | 猫猫旅行(出发/召回) | 是 |
| 4 | `blackcat` | 夜猫子闲聊(23:00–08:00 窗口) | 是 |
| 5 | `redeem` | 连登档位兑换 | 是 |
| 6 | `lottery` | 抽奖(默认抽 5 次) | 是 |

顺序不是随手排的:`activity` 必须排在 `growth` 之前 —— 上报计分先落地,`growth` 同一轮读列表就能看到「刚达标」的任务并当轮领奖;反序要等下一轮(默认 180 分钟)才领,白丢一轮积分。顺序的唯一真源是 `workbuddy_tasks.SWEEP_ORDER`,页面与调度器都读它,不要在别处再写一份。

## 2. 三条使用路径

### 2.1 页面手动(最快)

签到页(`/checkin`)底部的「自动做任务」面板:

1. 选择 WorkBuddy 账号;
2. **预演(不写入)** —— 只打只读探针,零写侧调用,用来看「这轮会做什么」;
3. **一键做任务** —— 发 `kind=all`,后端按 `SWEEP_ORDER` 跑完六族;
4. **读取任务** —— 只看 growth 任务列表(只读,不触发任何写)。

面板顶部那条状态栏告诉你**自动巡检**在不在跑、下次什么时候跑、上一轮跑了什么。见第 4 节。

### 2.2 接口直调

```bash
# 读任务列表(只读)
curl -H "Authorization: Bearer <你的会话令牌>" \
  "http://127.0.0.1:8000/api/checkin/accounts/7/tasks"

# 跑一轮(单族 / 全族)
curl -X POST -H "Authorization: Bearer <你的会话令牌>" -H "Content-Type: application/json" \
  -d '{"kind":"all","dry_run":true}' \
  "http://127.0.0.1:8000/api/checkin/accounts/7/task-run"
```

`kind` 取值:`activity` / `growth` / `travel` / `blackcat` / `redeem` / `lottery` / `all`。
`dry_run=true` 时除只读探针外零写侧调用。

### 2.3 定时自动(不需要人点)

`apps/ai-service` 的调度器里有一条独立 job(`workbuddy_task_sweep`),按 `WORKBUDDY_TASKS_SWEEP_MINUTES` 的节拍自动跑**全部 WorkBuddy 账号 × 六族**。

默认是关的。开启需要**两个开关同时打开**:

```dotenv
# apps/ai-service/.env

# ① 调度总闸(不打开,整个签到调度器都不启动,这条 job 也不会注册)
CHECKIN_CRON_ENABLED=true

# ② 任务门(控制这条 job 是否注册)
WORKBUDDY_TASKS_ENABLED=true

# ③ 写侧开关(不打开 ⇒ 只跑只读探针,不会真的领奖/抽奖/上报)
WORKBUDDY_TASKS_LIVE_RUN=true

# 可选:节拍(分钟,最小 5;默认 180 = 3 小时)
WORKBUDDY_TASKS_SWEEP_MINUTES=180
```

改完 `.env` 必须**重启 ai-service**(`start()` 有 `if self._started: return` 短路,热改环境变量不会补注册 job)。

为什么默认关:写侧会真实消耗账号的抽奖次数、真实提交领奖与上报。宁可让用户显式打开,也不要在第一次部署时替他把写请求打出去。

## 3. 状态字段怎么读

`GET /api/checkin/scheduler/status` 里的 `wb_tasks` 是唯一可信的巡检态来源:

| 字段 | 含义 | 怎么用 |
| --- | --- | --- |
| `enabled` | **任务门 ∧ 总闸** = 这条 job 现在真会被注册 | 只有它是 `true`,自动巡检才真的会跑 |
| `tasks_enabled` | `WORKBUDDY_TASKS_ENABLED` 原值 | 为 `true` 而 `enabled` 为 `false` ⇒ 被总闸拦住 |
| `cron_enabled` | `CHECKIN_CRON_ENABLED` 原值 | 同上,用于在界面上直说「被谁拦住」 |
| `live_run` | 是否真实写侧 | `false` ⇒ 只跑探针,不会领奖 |
| `sweep_minutes` | 节拍(分钟) | 与 job 注册用同一个函数算,不会出现「显示 30、实际 180」 |
| `claim_path_configured` | 领奖路径是否配置 | `false` ⇒ 只上报不领奖 |
| `activity_path_configured` | 上报路径是否配置 | `false` ⇒ 不做行为上报 |
| `next_run_wb_tasks` | 下次跑的时间(ISO 8601) | 未启动时为 `null` |
| `last_sweep` | 上一轮摘要(进程内) | `null` = 本进程还没跑过;`note` 非空 = 本轮没跑完 |

`last_sweep` 是**进程内快照**,不是持久账本:服务重启即清空,多 worker 部署下各进程各自一份。任务族的战果不写 `checkin_records`(做任务 ≠ 每日签到,不混表),要看历史请查日志里的 `[checkin_scheduler] WB 任务巡检完成`。

## 4. 面板状态栏的四种颜色

| 显示 | 含义 | 怎么办 |
| --- | --- | --- |
| 已启用 · 每 N 分钟自动巡检 | 两门都开 + 写侧开 | 无需操作 |
| 已启用但为演练模式(只读探针) | 两门都开但 `LIVE_RUN=false` | 要真领奖就设 `WORKBUDDY_TASKS_LIVE_RUN=true` |
| 未运行:任务门已开,但总闸 CHECKIN_CRON_ENABLED 关闭 | 被总闸拦住 | 设 `CHECKIN_CRON_ENABLED=true` |
| 未启用:仅手动执行 | 任务门没开 | 设 `WORKBUDDY_TASKS_ENABLED=true` 并重启 |
| 状态未知 | 服务端版本较旧不返回该字段,或请求失败 | 升级后端;看接口是否可达 |

「状态未知」永远不会被写成「未启用」—— 取不到输入就是未判定,不冒红也不冒绿(AGENTS.md §0.3)。

## 5. 已知边界(不是 bug,别当 bug 修)

- **上报成功 ≠ 计分。** `activity` 返回 200 只代表平台受理了这次上报;是否计分取决于平台侧对「真实行为」的判定。`first_chat` 这类任务需要真的发起对话才会达标。伪造行为判据链属于风控对抗,本仓库不做。
- **档位未解锁的 redeem / 抽奖次数为 0 的 lottery** 会正常返回业务错误(如「连续登录天数不足」),这不算失败,也不会标死账号。判断逻辑见 `_is_business_reject`。
- **`travel` 当天已走过** 会返回 `daily_limit_reached=true`,按「跳过」处理并写明原因,不拖垮整轮 `ok`。
- **冷却中的账号整轮跳过**,并计入 `last_sweep.skipped_cooldown`。
- **`blackcat` 只在 23:00–08:00 窗口内有效**,窗口外跑等于空转(配置项 `WORKBUDDY_TASKS_BLACKCAT_WINDOW`)。

## 6. 排障

先看状态接口,它通常直接给出答案:

```bash
curl -s -H "Authorization: Bearer <令牌>" \
  http://127.0.0.1:8000/api/checkin/scheduler/status | python -m json.tool
```

| 现象 | 先查 |
| --- | --- |
| 面板显示「未启用」 | `wb_tasks.tasks_enabled` 与 `cron_enabled` 谁是 `false` |
| 显示已启用但从不跑 | `next_run_wb_tasks` 是否为 `null`(job 没注册) → 是否改完 `.env` 没重启 |
| 跑了但没领到分 | `last_sweep.claimed` 与 `unjudged`;`claim_path_configured` |
| `last_sweep.note` 是「出站限流暂停」 | 触发了全局 429 暂停,等冷却结束,不要手动重试 |
| 单个族一直 `unjudged` | 上游响应形态变了,看该族 `reason` 原文,别盲改字段(§0.3) |

日志关键字:`[checkin_scheduler] WB 任务巡检`。

## 7. 代码位置

| 关注点 | 文件 |
| --- | --- |
| 六族执行引擎 | `apps/ai-service/app/services/workbuddy_tasks.py` |
| 自动巡检 job + 状态暴露 | `apps/ai-service/app/services/checkin_scheduler.py` |
| 接口 | `apps/ai-service/app/routers/checkin.py` |
| 面板 | `apps/web/src/components/checkin/WorkbuddyTaskPanel.tsx` |
| 配置默认值 | `apps/ai-service/app/core/config.py` + `apps/ai-service/.env.example` |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
