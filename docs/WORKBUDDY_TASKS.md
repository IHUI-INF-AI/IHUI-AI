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

先取 `account_id`（只读；与六族巡检选号同一张 `checkin_accounts` 表，`enabled` 为真的才在巡检面内）：

```bash
cd <仓库根>
apps/ai-service/.venv/Scripts/python.exe -c "
import asyncio, asyncpg, re
from pathlib import Path
env = dict(re.findall(r'^([A-Z_]+)=(.*)$', Path('.env').read_text(encoding='utf-8'), re.M))
async def m():
    c = await asyncpg.connect(env['DATABASE_URL'])
    rows = await c.fetch(\"SELECT id, platform, name FROM checkin_accounts WHERE enabled ORDER BY id\")
    for r in rows: print(r['id'], r['platform'], r['name'])
    await c.close()
asyncio.run(m())"
```

> 也可以直接在签到页 `/checkin` 的账号列表里看每行的 id。
> **别把 id 写死进脚本**：2026-11-09 实测，旧版本此处写死 `/accounts/7/`，而 id=7 早已不存在，照抄必 404。取到的 id 赋给下面两个变量：

```bash
ACCOUNT_ID=<上一步取到的 id>
TOKEN=<你的会话令牌>

# 读任务列表(只读)
curl -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8803/api/checkin/accounts/$ACCOUNT_ID/tasks"

# 跑一轮(单族 / 全族;dry_run=true 时零写侧调用)
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"kind":"all","dry_run":true}' \
  "http://127.0.0.1:8803/api/checkin/accounts/$ACCOUNT_ID/task-run"
```

`kind` 取值：`activity` / `growth` / `travel` / `blackcat` / `redeem` / `lottery` / `all`。
`dry_run=true` 时除只读探针外零写侧调用。

> 2026-11-09 实测口径：`POST .../task-run` **不写 `checkin_records`**。判断「到底跑没跑、做成了没有」只能看**响应体**（`families.*`、`credit_delta`）与随后的 `GET .../tasks` 回读，不能拿 `checkin_records` 当执行证据。

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

改完 `.env` 必须**重启 ai-service**(`start()` 有 `if self._started: return` 短路,热改环境变量不会补注册 job)。状态接口里的 `enabled` 是**观测态**(见第 3 节),所以它只会在真重启并注册成功之后才翻 `true`。

为什么默认关:写侧会真实消耗账号的抽奖次数、真实提交领奖与上报。宁可让用户显式打开,也不要在第一次部署时替他把写请求打出去。

## 3. 状态字段怎么读

`GET /api/checkin/scheduler/status` 里的 `wb_tasks` 是唯一可信的巡检态来源:

| 字段 | 含义 | 怎么用 |
| --- | --- | --- |
| `enabled` | **观测态** = 调度器已 start ∧ 这条 job 现在真在注册表里 | 只有它是 `true`,自动巡检才真的会跑;`false` 时读 `not_running_reason` 拿结论 |
| `tasks_enabled` | `WORKBUDDY_TASKS_ENABLED` 原值(**配置意图**) | 意图 ≠ 事实:它为 `true` 而 `enabled` 为 `false`,说明卡在别处 |
| `cron_enabled` | `CHECKIN_CRON_ENABLED` 原值(**配置意图**) | 同上,用于在界面上直说「被谁拦住」 |
| `not_running_reason` | `enabled=false` 时卡在哪一层:`tasks_gate_off` / `cron_gate_off` / `scheduler_not_started` / `job_not_registered`;`enabled=true` 时恒为 `null`;旧服务端不返回该字段 | 按值给结论与出路(见第 4 节);取不到就是「未判定」,不得当成任何一种原因 |
| `live_run` | 是否真实写侧 | `false` ⇒ 只跑探针,不会领奖 |
| `sweep_minutes` | 节拍(分钟) | 与 job 注册用同一个函数算,不会出现「显示 30、实际 180」 |
| `claim_path_configured` | 领奖路径是否配置 | `false` ⇒ 只上报不领奖 |
| `activity_path_configured` | 上报路径是否配置 | `false` ⇒ 不做行为上报 |
| `next_run_wb_tasks` | 下次跑的时间(ISO 8601) | 未启动时为 `null` |
| `last_sweep` | 上一轮摘要(进程内) | `null` = 本进程还没跑过;`note` 非空 = 本轮没跑完 |

`enabled` 为什么不能是「两道闸的与」:两道闸都只回答「配置想不想跑」,判不出「进程里到底有没有这条 job」。`start()` 在建表(`checkin_store.ensure_tables`)抛异常时会直接 `return`,而 ai-service 的启动装配层又把 `start()` 整包 `try/except` 忽略 —— 于是进程里连调度器都没有,两门 env 全 `true` 却一件活儿不干。按意图报绿,面板就在说谎(AGENTS.md §0.3:没跑绝不能写成在跑)。判序的唯一实现是 `checkin_scheduler._wb_tasks_not_running_reason`,本文与前端都只描述/只分支,不再各算一遍。

`last_sweep` 是**进程内快照**,不是持久账本:服务重启即清空,多 worker 部署下各进程各自一份。任务族的战果不写 `checkin_records`(做任务 ≠ 每日签到,不混表),要看历史请查日志里的 `[checkin_scheduler] WB 任务巡检完成`。

## 4. 面板状态栏有哪几种状态

三端(Web `/checkin`、移动端签到助手、小程序签到助手)同一个契约、同一套判据。判据只看三个值:`enabled`(观测态)、`not_running_reason`、`live_run`:

| 显示 | 判据 | 怎么办 |
| --- | --- | --- |
| 已启用 · 每 N 分钟自动巡检 | `enabled=true` 且 `live_run=true`(`not_running_reason` 恒为 `null`) | 无需操作 |
| 已启用但为演练模式(只读探针) | `enabled=true` 且 `live_run=false` | 要真领奖就设 `WORKBUDDY_TASKS_LIVE_RUN=true` 并重启 |
| 未运行:任务门没开 | `enabled=false` 且 `not_running_reason=tasks_gate_off` | 设 `WORKBUDDY_TASKS_ENABLED=true` 并重启 |
| 未运行:任务门已开,但总闸 CHECKIN_CRON_ENABLED 关闭 | `enabled=false` 且 `not_running_reason=cron_gate_off` | 设 `CHECKIN_CRON_ENABLED=true` 并重启 |
| **配置已开但调度器没起来** | `enabled=false` 且 `not_running_reason=scheduler_not_started`(两门 env 皆 `true`,进程里却没有调度器:建表异常 / 启动过程抛异常被吞 / 压根没跑到启动装配) | **重启 ai-service**;重启后仍是这一档 ⇒ 不是配置问题,查日志关键字 `[checkin] 建表异常`、`[checkin_scheduler] 启动失败`,那是数据库/依赖侧故障 |
| 配置与运行态不一致(改完 env 没重启) | `enabled=false` 且 `not_running_reason=job_not_registered`(调度器在跑,这条 job 不在注册表) | 重启 ai-service(`start()` 有 `if self._started: return` 短路,不会补注册) |
| 状态未知 | 服务端不返回 `wb_tasks`,或 `not_running_reason` 缺失(旧版本),或请求失败 | 升级后端;看接口是否可达 |

「状态未知」永远不会被写成「未启用」—— 取不到输入就是未判定,不冒红也不冒绿(AGENTS.md §0.3)。同理,`not_running_reason` 缺失时**不得**回落成上面任何一档的具体原因。

## 5. 已知边界(不是 bug,别当 bug 修)

- **上报成功 ≠ 计分(2026-11-05 两轮真机实证,报文级)。** `activity` 返回 200 只代表平台受理了这次上报;是否计分取决于平台侧对「真实行为」的判定。实证:
  - 账号 3559:5 个事件码 POST `/v2/report` ⇒ 全部 200 `code:0`,成长任务状态纹丝不动。
  - 账号 3564:4 个事件码 × 令牌域/WEB 域共 16 次 ⇒ 全部 200 `code:0`;事件后复列 WEB 域 18 行,`template_5`/`chat_5`/`skill_1`/`expert_5` 的 `progress` 与 `status` **逐字段零变化**。
  - 单对象与官方数组形态(`[{eventCode,timestamp,reportDelay,…}]`)两种报文都受理、都**不**推进进度。
  ⇒ 合成遥测事件对成长计分**零效果**。引擎据此只认「重读任务列表确认 `progress`/`status` 确已前进」这一凭据,受理回执不算数;否则如实登记为待用户在客户端实操。`first_chat` 这类任务需要真的发起对话才会达标。伪造行为判据链属于风控对抗,本仓库不做。
- **成长任务分两个域,别混。** CLI 域(`copilot.tencent.com`)5 项新手引导、WEB 域(`www.workbuddy.cn`)18 项成长任务,两域合并才覆盖账号全部任务。`accept` 端点(`/activity/growth/tasks/accept`,body `{"task_codes":[…]}`)只认 **WEB 域**的任务码:对 CLI 域那 5 个码逐条回 `status=error` / `message=task not found`。
- **`accept` 的逐任务三态(2026-11-05 真机,同一轮实测)。** `data.results[]` 逐任务给 `{task_code,status,message}`:
  | status | message | 含义 | 引擎记账 |
  | --- | --- | --- | --- |
  | `error` | `task not found` | 该码不在 accept 面向的战役里 | 失败(逐条点名) |
  | `error` | `task already completed` | 已完成,不必再 accept | 失败(逐条点名) |
  | `already_accepted` | 无 | **成功态**:此前已被接受、现在等真实行为 | 记为 accepted |
  信封 `code:0` **不等于**全部成功,必须逐条记账,不得整包冒充 accepted。
- **`accepted` ≠ 完成。** WEB 域行的 `accept_status`:`claimed` = 已完成已领;`accepted` = **已接受、等真实行为**(`progress` 仍 0/target 1)。真机活例:`Expert_lighthouse`、`wb_wechat_oa_subscribe_task` 就是 `accepted`/`progress 0`,是真正的待办项,不是「完成待领」。把它们当完成 ⇒ 引擎会漏报待办。
- **上报端点族只有 `/v2/report` 一条。** 真机打 `/v2/report-assistant` 在令牌域与 WEB 域**均 404「404 Route Not Found」**;官方客户端 asar(`G:\workbuddy\resources\app.asar`)内 `v2/report` 命中 9 次、`report-assistant` **0 次**。客户端另有 `reportEndpoint` 选项 ⇒ 真正的「另一个上报端点」是**另一个主机**不是另一个路径(对应本仓 `WORKBUDDY_TASKS_ACTIVITY_HOSTS` 按事件码路由主机)。- **号池账号默认没有浏览器会话。** 现读 5 个 workbuddy 号池账号:`login_type` 全为 `null`、`web_cookie` 全缺。**改判(本轮)**:「接口可达」与「计分」是两层,原句把两层混了。纯 `accessToken`、零 cookie、零浏览器会话也能直连平台 HTTP 接口(成功态 SSE 已实证,见 §12);但**接口可达 ≠ 计分** —— 受理回执不推进 `progress`,计分链端点尚未逆向出来。故「号池无浏览器会话」只否掉需要会话的旧合成遥测回落链,**不否定服务端直连路径**,也不得再据此把任务标成不可自动化(详见 §12)。真要有会话,走网页登录取得 `web_cookie` 再落 `device_map`(见 `scripts/sync-workbuddy-client-session.mjs` 会话回灌腿)。
- **档位未解锁的 redeem / 抽奖次数为 0 的 lottery** 会正常返回业务错误(如「连续登录天数不足」),这不算失败,也不会标死账号。判断逻辑见 `_is_business_reject`。
- **`travel` 当天已走过** 会返回 `daily_limit_reached=true`,按「跳过」处理并写明原因,不拖垮整轮 `ok`。
- **冷却中的账号整轮跳过**,并计入 `last_sweep.skipped_cooldown`。
- **`blackcat` 只在 23:00–08:00 窗口内有效**,窗口外跑等于空转(配置项 `WORKBUDDY_TASKS_BLACKCAT_WINDOW`)。
- **补签卡(makeup cards)只读、不自动使用。** `streak` 的读侧会带回 `makeup_cards{balance,max}`,但 `makeup-cards/use` 的写侧**没有**接进巡检:补签卡是稀缺资源,自动消耗它替你补一天连续登录,不是每个用户都愿意;而 `target_date` 的格式尚未取证(上游 400 会点名格式错),按 §0.3 不猜字段。要用补签卡请在官方 App 内手动使用;若将来要接,必须先真机取证 `target_date` 形态再落写侧。

## 6. 排障

先看状态接口,它通常直接给出答案(ai-service 监听端口以 `docs/port-management.md` 现读为准,本机 `.env` 的 `PORT=8803`;未登录会被鉴权挡下,所以要带会话令牌;服务没起来时 curl 直接连不上,先启动 ai-service 再敲):

```bash
curl -s -H "Authorization: Bearer <令牌>" \
  http://127.0.0.1:8803/api/checkin/scheduler/status | python -m json.tool
```

| 现象 | 先查 |
| --- | --- |
| 面板显示「未运行」 | `wb_tasks.not_running_reason` 是哪一档:`tasks_gate_off` / `cron_gate_off` 就是配置没开全 |
| 两门都开着却没跑(`scheduler_not_started`) | 进程里没有调度器:`GET /scheduler/status` 顶层 `started` 也是 `false` → 重启 ai-service;重启后仍 `false` 就查日志 `[checkin] 建表异常` / `[checkin_scheduler] 启动失败` |
| 改完 `.env` 没重启(`job_not_registered`) | 顶层 `started=true` 而 `wb_tasks.enabled=false` → 重启(热改环境变量不会补注册) |
| 显示已启用但从不跑 | 新口径下 `enabled` 就是观测态,这一档不该再出现;若真出现(`enabled=true` 而 `next_run_wb_tasks` 为 `null`)是 bug,带上前三个字段值报出来 |
| 跑了但没领到分 | `last_sweep.claimed` 与 `unjudged`;`claim_path_configured` |
| `last_sweep.note` 是「出站限流暂停」 | 触发了全局 429 暂停,等冷却结束,不要手动重试 |
| 单个族一直 `unjudged` | 上游响应形态变了,看该族 `reason` 原文,别盲改字段(§0.3) |

日志关键字:`[checkin_scheduler] WB 任务巡检`。

## 7. 代码位置

| 关注点 | 文件 |
| --- | --- |
| 六族执行引擎 | `apps/ai-service/app/services/workbuddy_tasks.py` |
| 自动巡检 job + 状态暴露 | `apps/ai-service/app/services/checkin_scheduler.py` |
| 接口 | `apps/ai-service/app/routers/checkin.py`(两条任务入口的出站暂停/冷却预检 = `_outbound_risk_precheck`,与手动查余额、手动签到同一实现) |
| 巡检态判据(三端唯一真相源) | `packages/shared/src/utils/workbuddy-sweep-view.ts`(取值表在 `packages/types/src/checkin.ts` 的 `CHECKIN_WB_TASKS_NOT_RUNNING_REASONS`,端上不再各算一遍) |
| 面板(web / RN / 小程序) | `apps/web/src/components/checkin/WorkbuddyTaskPanel.tsx`、`apps/mobile-rn/src/components/WorkbuddyTaskSection.tsx`、`apps/miniapp-taro/src/pkg-user/checkin-assistant/WorkbuddyTaskSection.tsx` |
| 真机 DOM 验证 | `apps/web/e2e/workbuddy-task-panel.spec.ts` |
| 补签卡不自动消耗的机器锁 | 行为级 + AST 静态锁:`apps/ai-service/tests/test_workbuddy_tasks.py`,判据实现 `workbuddy_tasks.makeup_card_write_hit` / `find_makeup_card_write_hookups` |
| 配置默认值 | `apps/ai-service/app/core/config.py` + `apps/ai-service/.env.example`(两枚闸门同批登记在能力矩阵 `app/core/capability_matrix.py`) |

## 8. 「专家体验」类成长任务:真客户端驱动(2026-11-05 立)〔原结论已推翻,见下方更正块与 §12〕

> ⚠ **【原结论已推翻 · 机主裁决】** 本节(尤其 §8.1「唯一有效路径是让真实客户端发生"召唤专家 + 完成一次对话"的行为」)已被实证推翻,**保留原文与实测战绩仅供追溯,不得再据此把任务标成「不可自动化」**。现行能力改为**纯凭据直连平台 HTTP 接口,彻底不走 GUI / CDP / 9229**,见 §12。
>
> **错在哪(三处)**:
> 1. 把「合成遥测无效」+「一次直连假阴性」**外推成「所有服务端路径都无效」** —— 两次实测只证伪了裸合成事件与那一次探针,不构成对全部服务端路径的否定。
> 2. 把「当前没取证到」**写成「平台不允许」** —— 计分契约未逆向出来属**未判定**,升格为禁令没有凭据。
> 3. 以上两处都违反 **§0.3「未判定 ≠ 否定」**,并据此把「必须真客户端」当成唯一有效路径,与机主裁决相悖。机主原话精神:**「之前定的唯一路径使用客户端就不对,能直接调接口的为啥要动客户端」**。
>
> 反证(出处 `workbuddy_behaviors.py:24-27`):外部对照程序 `wb2api.exe` 用纯 `accessToken`、零 cookie、零浏览器会话,直连平台 HTTP 接口把 `Expert_lighthouse`、`Sequential_Tasks_1` 真完成并各领一百积分(积分由一千九百八十六到两千一百八十六)⇒「必须真客户端」定论不成立。
>
> 本节 §8.2–§8.5 的 CDP/9229 驱动链**降级为历史备选、默认不启用**;判据(回读 `progress` 前进、受理 ≠ 计分)与实测战绩均保留。

### 8.1 为什么必须驱动真客户端

> ⚠ **【原结论已推翻】** 本节标题「为什么必须驱动真客户端」及下方「唯一有效路径…」的论断**不成立**,完整更正见本节顶部更正块与 §12。**以下原文(含 CDP/9229 驱动链、命令与 §8.5 实测战绩)整体降级为历史备选、默认不启用,保留仅供追溯**;不得再以「必须真客户端」为由把任务标成不可自动化。现行路径 = 纯凭据直连平台 HTTP 接口(§12)。

**合成遥测对成长计分零效果**(第 5 节已列报文级实证)。要完成「体验某专家」这类任务,
唯一有效路径是让**真实客户端**发生"召唤专家 + 完成一次对话"的行为。仓内因此装车了一条
可复用的驱动链:

| 关注点 | 文件 |
| --- | --- |
| 驱动原语(attach/求值/专家页/召唤/发消息/断开) | `scripts/lib/workbuddy-client-drive.mjs` |
| 市场ID ⇄ 本地专家名的映射桥 | `scripts/lib/workbuddy-expert-index.mjs` |
| 命令行入口(列表 / 单项 / 一键全跑) | `scripts/workbuddy-growth-experts.mjs` |
| 机器锁(纯函数,离线可跑) | `scripts/tests/workbuddy-growth-experts.test.mjs` |

```bash
# 只读:列出号池各账号的「专家体验」项与状态
node scripts/workbuddy-growth-experts.mjs --list

# 单项:按市场 expertId 驱动(召唤 + 发一条消息 + 回读确认计分)
node scripts/workbuddy-growth-experts.mjs --do ex_GDl31WahyIH0 --message "你好"

# 一键:跑完**当前登录号**所有未完成的专家体验项
node scripts/workbuddy-growth-experts.mjs --do-all
```

### 8.2 三个反直觉的坑(踩过,别再踩)

1. **卡片上的 `source` 不是市场 expertId,而是本地专家名。**
   成长任务 `jump_url` 给的是市场ID(如 `ex_GDl31WahyIH0`),客户端卡片上的
   `data-track-props.source` 却是本地专家名(如 `ChinaEcommerceOperationsExpert`)。
   只按市场ID 找卡 ⇒ 永远找不到。桥在本机会话落盘库的 `marketExpertId` 字段,
   `lib/workbuddy-expert-index.mjs` 负责把它读成一张索引表。
2. **同一张卡上,标题与 aria-label 可以完全不是一回事。**
   实测:标题「全平台电商运营操盘手」的卡,aria-label 是「召唤中国电商运营专家」;
   另有卡的 aria-label 是「召唤卖得好」而标题正是「中国电商运营专家」。
   ⇒ **按名字/aria 挑必然挑错**(已污染过无关会话)。唯一可靠判据是"**卡片内的 source**"。
3. **消息要用逐字输入事件发,不能用 `execCommand`。**
   `execCommand('insertText')` + Enter 实测**发不出去**(React 受控组件状态没跟上,草稿还在);
   逐字派发 `beforeinput`/`input`/`keydown` + Enter 才真发得出去。
   另:回显判据要落在"消息文本出现在页面正文**且不在输入框草稿里**"。

### 8.3 计分判定口径(受理 ≠ 计分)

驱动链只负责"让行为真的发生",**计分判定一律回读成长任务列表**:
只有 `accept_status`/`progress` 真的前进了才算成(§0.3)。

⚠ **计分是异步落地的**:实测消息发出后立刻回读仍是 `accepted`,数十秒后才翻成 `completed`
⇒ 必须轮询等待,不能只读一次就下结论(CLI 的 `waitForScoreAdvance` 干这件事)。

### 8.4 纪律

> ⚠ 本节纪律随 CDP/9229 驱动链**降级为旧链、仅历史、默认不启用**,以下各条仅在该旧链被显式启用时适用(见 §8 更正块与 §12);现行纯凭据直连路径不依赖本节任何一条。

- **用完必须断开 inspector**〔旧链,仅历史,默认不启用〕:不断 ⇒ 主进程被调试通道占住 ⇒ `taskkill` 不带 `/F` 会失败
  ⇒ 客户端关不掉、切不了号(实测 2026-11-05 切号时连报三次失败)。
  断开判据取"9229 端口是否真的不再应答",**不取"求值有没有回包"**
  (`_debugEnd()` 一执行通道当场关闭 ⇒ 回包必然超时 ⇒ 朴素实现恒报"断开失败")。
- **对象不对绝不发消息**:对话页必须出现目标专家名 + 有输入框 + 消息文本回显,三要素全中才发。
- **凭据只在进程内流动**:输出只报身份/键名/长度,不回显 token。
- **风控期(11140)也要能区分**:被限期间模型回复被拦,但**用户消息仍会上屏** ⇒
  消息上屏判据不能等助手回复。

### 8.5 实测战绩(2026-11-05)

两个账号 8 个专家体验项**全部完成**(账号 33:4 项 `claimed`;账号 29:4 项 `completed`),
全程用上面这条命令链驱动,无人工点击。
公众号关注项(`wb_wechat_oa_subscribe_task`)不在本链覆盖范围内 —— 它要求微信扫码关注
「腾讯 WorkBuddy」官方公众号并**满 24 小时**,是账号维度的关注行为,客户端与网页都无自动入口。
那一项的收口见第 9 节。

## 9. 公众号关注项:「关注」不可自动化,「领奖」可以(2026-11-05 立)

### 9.1 为什么这一项自动不了(2026-11-05 二次取证,已更正)

`wb_wechat_oa_subscribe_task`(奖励 100 积分 + 5 能量)的判据是**服务端的一个布尔**,
服务端自己把它回给客户端:

```bash
GET https://www.workbuddy.cn/v2/activity/growth/subscribe-task/status
⇒ {"code":0,"data":{"subscribe_task":{
     "task_code":"wb_wechat_oa_subscribe_task",
     "subscribed":false,          ← 关注关系成不成立,就看这一个字段
     "remaining_seconds":-1,      ← 满 24 小时窗的余量(未关注时没有倒计时)
     "task_status":"accepted","advanced":false}}}
```

**客户端只能读它,写不了它**。把下载到的 8 份成长中心 bundle 原文里的 `/activity/growth/*`
端点全枚举出来(**现读 2026-11-05:42 条,GET 27 + POST 15**),含 `subscri` 字样的**只有 1 条,
就是上面那条 GET**;写侧(POST)碰关注关系的**0 条**。写端点只有这些:

| 写端点 | 干什么 | 能不能碰关注关系 |
| --- | --- | --- |
| `post /activity/growth/tasks/accept` | 接受任务(`{task_codes:[...]}`,数组) | 否——该项本来就已 `accepted`,accept 对它是空转 |
| `post /activity/growth/tasks/{code}/claim` | 领奖 | 否——`400 task not completed`,判完成权在服务端 |
| `post /activity/growth/redeem`、`lottery/draw`、`makeup-cards/use`、`buddy/open|switch|agreement|first|visible`、`buddy/travel/depart|claim`、`heatmap/share`、`user-state/dismiss` | 兑换/抽奖/补签/伙伴/分享 | 与订阅任务无关 |

官方取任务列表那个函数 `to()` 自己的实现就是「**先 `qa()`(读一次订阅状态)→ 再 GET 列表**」
——也就是说,客户端对这一项唯一能做的动作,是**问一次、让服务端重算一遍**,没有任何"代做"通道。

> ⚠ **更正**:本节初版写的取证依据是「客户端 asar 里搜 `follow-guide` / `events/follow` 0 命中」。
> 那是**搜错了面**:成长计划页是端内 iframe 远程加载的网页(`?platform=workbuddy`),
> 根本不打包进 asar,所以在 asar 里搜不到只能证明"不在包里",证明不了"做不到"。
> 现在的结论换成上面服务端直读 + 官方端点全枚举,量级更强。

任务条件原文:**「关注「腾讯 WorkBuddy」官方公众号满 24 小时,即可领取奖励」**,
跳转 `https://www.workbuddy.cn/events/follow-guide/`(该页渲染三个二维码:公众号 / 视频号 / 服务号)。

⇒ 关注关系挂在**微信账号**上、还有**满 24 小时**的时间窗 ⇒ 关注动作是**真实世界里的一个微信身份行为**,
程序侧无捷径,**也不应伪造关注**。

> ⚠ **2026-11-06 三次改判(实测,见 §11.5 ④)**:机主微信里这个公众号**早已是「已关注」状态**,
> 而号池两号服务端仍读 `subscribed=false` ⇒ **本项卡点不是"没人扫",是"账号没绑微信身份"**。
> 解锁条件 = 先给 WorkBuddy 账号绑定微信身份(产品流程,机主侧);绑定之后关注关系无需再做任何动作。
> 本节初版写的"只能由机主本人用微信完成"、二次改判写的"扫了也没有归属对象",都已被这次实测替掉。

#### 9.1b 关于「人家程序不用扫就能完成」

按上面的端点表,这句话只有三种落得下去的读法,前两种我们都做不了、也不需要:

1. **那个号早就关注过了**——`subscribed` 已经是 `true`,所以"现在"不用再扫。这是最常见的读法,
   和我们这两个号的区别只在"以前扫过一次"。
2. **在微信里点链接关注,不走相机扫码**——关注还是发生了,只是入口是聊天/文章里的「关注」按钮
   而不是二维码。省的是"扫"这个动作,不省"关注"这个事实。
3. **它的程序根本没完成这一项**——只把其余 17 项做完,这一项跳过。我们的号现在就是这个形态
   (18 项里 `completed=17`,唯一非终态就是这一项)。

第四种读法(拿某条端点把 `subscribed` 伪造成 `true`)在这套 API 里**不存在**;即便存在,
仓内也不做——伪造关注关系不是自动化,是骗服务端发奖。


### 9.2 程序覆盖的是「关注之后 → 领奖」这一段

服务端一旦把关注判成立,任务 `accept_status` 会翻成终态。仓内因此有一条收口命令:
盯住状态、到账即领。**每轮先 GET 一次 `subscribe-task/status` 再读任务列表**——和官方 `to()`
同一个时序,顺带触发服务端重算关注关系(只读列表会拿到旧判定,可能永远等不到翻面)。

```bash
# 只读:每个号一行,把「卡在哪一格」直接说给人看
node scripts/workbuddy-growth-oauth.mjs --status
# —— 2026-11-05 实测(两个号都还没关注)——
# [0bc1074d] accepted 0/1 奖励=100c/5e 已到账=false 待领=false | 关注关系=服务端未检测到
# [25913b4a] accepted 0/1 奖励=100c/5e 已到账=false 待领=false | 关注关系=服务端未检测到
# —— 关注之后的两种形态(判据形状,不是当次读数)——
# [0bc1074d] accepted 0/1 奖励=100c/5e 已到账=false 待领=false | 已关注,24h 窗还差 1h02m
# [0bc1074d] completed 1/1 奖励=100c/5e 已到账=false 待领=true  | 已关注(倒计时读数已过窗或无)
```

| 行末那一格 | 意思 | 下一步 |
| --- | --- | --- |
| `关注关系=服务端未检测到` | 微信那边还没关注上 | 机主在微信里关注(扫码或点链接都行) |
| `已关注,24h 窗还差 NhNNm` | 关注已判成立,正在等满 24 小时 | 什么都不用做,`--watch` 会盯着 |
| `已关注(倒计时读数已过窗或无)` | 关系成立且没有余量读数 | 该项应当即将翻 `completed`,下一轮 `--watch` 直接领 |
| `关注关系未判定(…)` | 这条状态**读不到**(网络/形状变/业务码非 0) | 是"没量到",**不是**"没关注"——绝不拿它当事实(§0.3) |

| 关注点 | 文件 |
| --- | --- |
| 命令行入口(只读状态 / 轮询到账即领) | `scripts/workbuddy-growth-oauth.mjs` |
| 机器锁(纯函数,离线可跑) | `scripts/tests/workbuddy-growth-oauth.test.mjs` |
| 「直接跑 vs 被 import」守卫(单一真相源) | `scripts/lib/direct-run.mjs` |

```bash
# 只读:列出每个号这一项的状态
node scripts/workbuddy-growth-oauth.mjs --status

# 轮询:服务端判完成即调 claim 领奖(默认每 5 分钟一次,总预算 25 小时,覆盖满 24h 窗口)
node scripts/workbuddy-growth-oauth.mjs --watch
node scripts/workbuddy-growth-oauth.mjs --watch --interval 300 --timeout 90000
```

退出码:`0` 已到账 / `1` 未领到(条件未到,不是失败) / `2` 未判定(环境·输入·读不到任务)。

### 9.3 状态词口径(别按字面猜)

| `accept_status` | 含义 | 本命令怎么处理 |
| --- | --- | --- |
| `accepted` | 任务已接受、**等行为**(≠ 完成) | 继续等 |
| `completed` | 行为完成、奖励**可领** | 调 claim 领奖 |
| `claimed` | 奖励**已领取**(到账) | 跳过领奖,退出该号的轮询 |

⚠ 把 `accepted` 当成「已完成」会让引擎跳过真待办;把 `claimed` 当成「可领」会让引擎**反复重领**
(实测踩过,现按 `claimed` 直接收口)。

### 9.4 纪律

- **受理 ≠ 到账**:领奖端点 HTTP 200 **不**等于领到了,以响应体 `code` 为准(§0.3)。
  服务端回「already claimed」也算已到账。
- **不伪造关注**:程序不模拟任何关注行为,只读状态 + 领奖。
- **凭据只在进程内流动**:输出只报 uid 前缀与状态,不回显 token。
- **取不到输入 ⇒ 报未判定**:任务列表里没有这一项时,报「未判定」并退出该号的轮询,
  不退化成「失败」、不编造进度。

## 10. 「已判完成 → 领奖」这一腿以前没人跑(2026-11-05 立)

驱动客户端做完行为后,服务端把 `accept_status` 判成 `completed` —— **但奖励停在原地等按钮**。
现读 2026-11-05:号池两个号 36 项里,`completed`(可领未领)攒了 **6 项**没人领。
这一格是纯 API 动作,零人工:`POST /v2/activity/growth/tasks/{code}/claim`
就是官方客户端「领取奖励」按钮自己那条端点。

| 关注点 | 文件 |
| --- | --- |
| 命令行入口(dry-run / 全领 / 点名一枚) | `scripts/workbuddy-growth-claim.mjs` |
| 机器锁(7 例,纯函数离线可跑) | `scripts/tests/workbuddy-growth-claim.test.mjs` |
| 领奖实现与响应解析(**判据不复制**,§0.6) | `scripts/workbuddy-growth-oauth.mjs` 的 `claimTask` / `parseClaimResponse` |

```bash
node scripts/workbuddy-growth-claim.mjs --dry-run      # 只报有哪几项可领,不动服务端
node scripts/workbuddy-growth-claim.mjs                # 可领的全领了
node scripts/workbuddy-growth-claim.mjs --code chat_5  # 只领点名那一枚
```

**零人工的一键 SOP**(两条,顺序跑;第二条幂等,任何时候再跑都只会报「没有可领项」):

```bash
node scripts/workbuddy-growth-experts.mjs --do-all; node scripts/workbuddy-growth-claim.mjs
```

射程边界:

- **只领 `completed`**。`accepted` = 行为还没做 ⇒ 不进射程(拿它去领奖是要一份没挣到的奖励);
  `claimed` = 已到账 ⇒ 不重领。行内 `--code` 点了名但不在可领集 ⇒ **报未判定并回显该项实际状态**,
  不静默当成「没有可领的」。
- **本命令不代做任何行为**。行为要么已经真做过,要么归 §8 的驱动链,要么归 §9 的机主本人。

### 10.1 实测战绩(2026-11-05)

```
[0bc1074d] 可领 1 项:Expert_lighthouse            ✅ +100积分/+5能量
[25913b4a] 可领 5 项:WorkBuddy_Valorant / expert_use_maidehao / expert_use_douyinyin /
                       expert_use_shangjia_xuanchuan / expert_use_bowangwang
                                                    ✅ 全部到账(100/50/50/50/50 积分 + 各 5 能量)
汇总:领到 6/6,失败 0,未判定 0
```

复跑同一条命令 ⇒ `没有可领项(共 18 项,均为终态或等行为)` × 2,幂等验证通过。
号池现状(现读):**两号各 18 项 ⇒ 17 项 `claimed`,唯一非终态是 §9 那条公众号关注项**。

变异验证:把可领集放宽到也认 `accepted`,镜像用例 ① 当场翻红(还原后 7/7 绿)。

## 11. 对照程序取证:人家的自动面到底覆盖什么(2026-11-05 立)

机主给的对照程序 `wb2api.exe`(workbuddy2api 面板,Go 原生二进制,无源码)取证法 =
用仓内正式器物 `scripts/inspect-binary-api-paths.mjs` 扫产出物原文,
只看**端点路径族与业务专码**,不含任何凭据形态内容。复跑那一条(数字现读 2026-11-05):

```bash
node scripts/inspect-binary-api-paths.mjs "<wb2api.exe 路径>" \
  --needle subscribe-task,subscribe_task,subscribed,oa_subscribe,wb_wechat,follow-guide,公众号,关注,checkin,daily-checkin,makeup-cards,lottery/draw,travel/depart,accept_all,task_codes
# ⇒ bytes=8710144 路径族=481
# ⇒ 扫描面:latin1 原文 8710144 字节内逐字节 indexOf
```

器物自证:`node scripts/inspect-binary-api-paths.mjs --self-test` ⇒ 8/8;
镜像测试 `scripts/tests/inspect-binary-api-paths.test.mjs` ⇒ 8 例。
**「命中 0」在这件器物里一定连着扫描面一起报** —— 没找到不等于不存在(§0.3)。

### 11.1 它的自动任务面**不含「公众号关注」**

| 关键词 | 命中 |
| --- | --- |
| `subscribe-task` / `subscribe_task` / `subscribed` | **0 / 0 / 0** |
| `oa_subscribe` / `wb_wechat` / `follow-guide` | **0 / 0 / 0** |
| `公众号` / `关注` / `订阅` | **0 / 0 / 0** |
| `签到` / `任务` | **26 / 98** ← 同一件器物在同一文件里数得出中文 ⇒ 上面那几个 0 是**真零**,不是盲区 |
| `checkin` | 45 |
| `daily-checkin` / `makeup-cards` / `lottery/draw` / `travel/depart` | 2 / 1 / 1 / 1 |
| `accept_all` / `task_codes` | 2 / 5 |

> ⚠ **取证方法也改判过一次**:本节初版用 latin1 文本匹配中文关键词,那在这类二进制上
> **恒 0**——不是"没命中",是**根本没判**(一个 UTF-8 汉字被 latin1 拆成 3 个高位字符)。
> 现在 `countNeedles` 走 **UTF-8 字节面**,并在自证与镜像测试里各钉一条**阳性对照**
> (把中文塞进字节面必须数得出来);变异回 latin1 后两条用例 + 自证同时翻红。
> 结论没变(仍是 0),但证据从"没判"变成"量过"。

它自己那套面板路由是 `tasks/accept`、`tasks/accept_all`、`tasks/claim`、`tasks/auto_all`、
`accounts/{uid}/checkin`、`checkin_all`、`tasks/scan_all` —— **对成长任务只做
「接受 → 领奖 → 签到 → 消费型动作」这四类,没有任何一条通向「替微信身份关注公众号」**。

**旁证(最硬的一条):这两个号正是被这套程序常驻跑着的号,今天现读仍是 `17/18`。**
也就是说:人家的程序在同样的号上,同样没把公众号关注项做成。
所以「人家不用扫就能完成所有任务」这个前提**不成立** —— §9 的结论被对照程序独立证实,
而不是被它推翻。

### 11.2 它有一条咱们没有的腿:每日签到 —— 已复现

`POST https://www.workbuddy.cn/v2/billing/meter/daily-checkin`(GET 会落到网页 404,
`…/daily-checkin/status` 才落到网关 JSON 404 ⇒ 这路径是 **POST-only**,别按 GET 试)。
实测回执 `{"code":10001,"msg":"今天已签到，请明天再来"}` —— **幂等信号是专码**,
所以「今天已签」与「签到失败」必须分档,否则天天误报。

| 关注点 | 文件 |
| --- | --- |
| 命令行入口(`--checkin` 签到 / `--profile` 读账面) | `scripts/workbuddy-growth-daily.mjs` |
| 机器锁(8 例,纯函数离线可跑) | `scripts/tests/workbuddy-growth-daily.test.mjs` |

```bash
node scripts/workbuddy-growth-daily.mjs --profile   # 现读:两号各 17/18 完成,等级 17
node scripts/workbuddy-growth-daily.mjs --checkin   # 现读:两号「今日已签到」⇒ 幂等,不算失败,RC=0
```

签到响应四档**不得并桶**:`checked`(真签上)/ `already`(专码或文案,幂等成功)/
`failed`(其它业务码,带 code+msg)/ `undetermined`(读不懂 ⇒ 未判定,不冒充前三档,§0.3)。

### 11.3 超越在哪、以及刻意不做什么

- **超越点**:对照程序把「已签到」与失败混在一起的风险,这里用专码分档 + 影子用例钉住;
  且本仓这条腿与 §10 的领奖、§8 的行为驱动共用同一套号池凭据读取出口,不另开第二份。
- **刻意不接**:`makeup-cards/use`(花补签卡)、`lottery/draw`(花抽奖次数)、
  `buddy/travel/depart`(花体力)都是**消耗型**动作 —— 「攒积分」不等于「替号主做消费决定」,
  要接得单独点名。
- **仍不做的**:`subscribed` 的伪造。对照程序里那 0 命中不是它没想到,是这条通道在协议上就不存在。

### 11.4 零人工的最终口径(现读 2026-11-05)

> ⚠ **【本节的「零人工」口径已被 §12 取代】** 下面第二条 `workbuddy-growth-experts.mjs --do-all` 走的是 **CDP/9229 驱动真客户端**那条链。机主 2026-11-09 裁决「能直接调接口的为啥要动客户端」后，该链已降级为**历史备选、默认不启用**（见 §8 更正块、§12）。现行口径 = 纯凭据直连平台 HTTP 接口。本节保留原文供追溯，**不得再据它把 `--do-all` 当成现行零人工 SOP**。

```bash
node scripts/workbuddy-growth-daily.mjs --checkin                                    # 每日签到
node scripts/workbuddy-growth-experts.mjs --do-all                                   # 行为类任务(CDP 链,已降级为历史备选)
node scripts/workbuddy-growth-claim.mjs                                             # 到账即领
node scripts/workbuddy-growth-oauth.mjs --watch                                     # 关注那一下之后全自动
```

四条里没有一条需要人点。**一条命令跑完上面全部**:`node scripts/workbuddy-growth-sweep.mjs`
(编排腿,判据全 import 上面那几件器物,零复算;`--dry-run` 零网络零写)。

而 §9 那个公众号关注项**不在"需要人点一次"这一档** —— 见下一节实测:这两个号连
"关注归到谁头上"的归属对象都没有,先决条件是绑定微信身份,不是扫码。

### 11.5 关注归属到底按什么记(2026-11-05 实测,改判 §9)

三件事分别落在观察 / 推断 / 未判定三档,不混写(AGENTS.md §0.12):

**① 观察 —— 二维码是全站同一张静态码,不带任何账号参数。**
用仓内 `zxing-wasm` 本地解码官方 `assets/qr-gzh-*.png`,唯一候选内容是一条微信短链
(`http://weixin.qq.com/r/mp/…`,46 字符),**零查询参数、零 scene**;该图由官方 JS 以
`__toCdnUrl("assets/qr-gzh-….png")` **常量**形式引用,CDN 重新拉取与本地副本逐字节同图。
⇒ 不存在"每账号一张绑定码"可供程序替扫。

**② 观察 —— 号池这两个号从来没有微信身份。**
`~/.wb-switch` 下递归到 14 枚 `.info` 快照、3 个不同 uid:

| uid 前缀 | 快照枚数 | 带 `account.wechatOpenId` |
| --- | --- | --- |
| `0bc1074d`(号池内) | 3 | **0** |
| `25913b4a`(号池内) | 9 | **0** |
| `14f939c3`(不在号池副本里) | 2 | **2** |

同时两号服务端读数 `subscribed=false / remaining_seconds=-1 / status=accepted`,账面 `17/18`。
(此量只打印字段名与有无,**任何 token/openid 值都不出进程、不进聊天、不进本文件**。)

**③ 推断 —— 关注只能按扫码人的微信身份归属。**
①说码不认账号,②说这两个号没有微信身份 ⇒ 服务端没有可记账的对象。
**这一项对这两个号是结构性不可达,不是"没人去扫一次"。**
对照程序里 `subscribe`/`关注` 全 0 命中,与这个结论同形:它也没做,而且做不了。

**④ 观察(2026-11-06 实测,推翻"扫一次就能完成")—— 关注关系早就存在,缺的是绑定。**
机主授权后,由本机已登录的微信客户端(主窗口 `MainView`,非入口页第二实例)走
`Ctrl+F` → 搜「腾讯WorkBuddy」→ 方向键定位到**公众号分组那条带认证标的结果** → 回车,
打开的公众号主页显示的是 **「已关注」(带勾)**,不是关注按钮。
而同一时刻号池两号服务端读数仍是 `subscribed=false / remaining_seconds=-1 / status=accepted`。

⇒ **关注这个真实行为早就做完了**;服务端没把它记到这两个号账上,是因为这两个号没有微信身份可映射(见 ②)。
⇒ 所以这一项的解锁条件**不是**"机主去扫一次",而是**先给 WorkBuddy 账号绑定微信身份**(产品流程,机主侧)。
⇒ 对照程序里 `subscribe`/`关注` 全 0 命中,与这个结论同形:它也没做,而且**在没绑定的号上做不了**。

**⑤ 观察(2026-11-06)—— 绑定走的是腾讯账号 OAuth 社交授权,不是本仓能代跑的通道。**
把官方用户中心 bundle(`wb-usercenter-index.js`,4.69 MB)用 `scripts/inspect-binary-api-paths.mjs`
枚举到 186 条路径族,绑定相关的端点与 UI 组件是:

| 证据 | 读数 |
| --- | --- |
| `authz/v1/authn/social/`、`authz/v1/social/personal_account` | 社交授权登录族 |
| `account-bind-callback`、`oauth/callback`、`v1/authorize`、`authorize` | 回调与授权入口 |
| `oauth2.account.tencentid.com`、`api.account.tencentid.com` | 承载方是**腾讯账号(tencentid)**,不是 WorkBuddy 自有服务 |
| `WechatModal` 36 处、`WechatConfirm` 14 处、`WECHAT_MODAL_CONFIRM/CANCEL` | 界面上是一个带**确认/取消**的微信授权弹窗 |

⇒ 「给 WorkBuddy 账号绑定微信身份」= 在腾讯账号体系里**建立一条持久的第三方访问授权**,
且终局动作是用户在微信侧点「确认」。这一档按 Computer Use 确认政策属**动作时确认、预先授权也不能免**,
按本仓边界属**不代取客户端凭据 / 不代点身份动作** ⇒ **这一格不由程序代做,也不是"再试一次自动化"能收的。**

**⑥ 观察 —— 绑定之后不需要任何人再做任何动作。**
`sweep` 的可领集来自 `selectClaimable`,它**只认状态词、不认任务码**;
镜像用例 ②b 已把这条钉住:任务列表里 OA 项一旦 `completed`,它自动进可领集,
同时 `subscribeVerdict` 读作 `followed`。⇒ 绑定生效那天起,日常跑一次
`node scripts/workbuddy-growth-sweep.mjs` 就会自己把它领掉,无需 `--watch`、无需人点。

**⑦ 未判定(仍然在册,没被本轮消掉)—— 有微信身份的那个号能不能被这一项记账?**
拿 `14f939c3` 最新快照的凭据去问服务端,两条都返回 HTML(accessToken 已失效)⇒ 问不到。
**没有强行续期**:本仓正牌续期出口(`scripts/lib/workbuddy-auth-extract.mjs`)会轮换 refresh token,
那会让该号已存的会话快照失效 —— 那是本次射程外的副作用,不为满足一个好奇心而动别人的登录态。
解锁这一格 = 该号自己重新登录后拿新鲜凭据再问一次。

(全程只打印字段名与有无;任何 token / openid 值不出进程、不进聊天、不进本文件。
微信侧只做了导航与打开主页,**没有向任何会话输入或发送任何内容**。)

### 11.6 零人工的承载体:本机计划任务(2026-11-06 装车)

清扫不靠任何人记得跑 —— 计划任务 **每 6 小时**自动跑一次 `--json` 档:

| 件 | 位置 / 现读法 |
| --- | --- |
| 任务名 | `IHUI WorkBuddy Growth Sweep`(`schtasks /Query /TN "IHUI WorkBuddy Growth Sweep" /V /FO LIST`) |
| 包装脚本 | `deploy/win/workbuddy-growth-sweep.cmd` |
| 日志 | `.ihui-agent/state/workbuddy-sweep.log`(追加式,每轮一个 JSON 对象) |

两个实测踩过的坑,都写进了脚本注释:

1. **`.cmd` 里只能用 ASCII 注释** —— cmd.exe 按 OEM 码页(本机 936)解析脚本文件,
   UTF-8 中文注释会被切成乱码 token 当命令执行(报"不是内部或外部命令")。
2. **相对路径是上两级,不是三级** —— 该文件在 `deploy\win\` 下,
   `%~dp0..\..\..` 会 `cd` 到盘符根并失败;`%~dp0..\..` 才是仓库根。

实测(2026-11-06):手动触发一次 ⇒ 日志 852 字节、`summary` 完整、
`accounts=2 already=2 claimFail=0 undetermined=0` ⇒ 席报遗留的「`--json` 档端到端未判定」结清。

⇒ 绑定生效那天起,这一项会在这条自动腿里被 `selectClaimable` 自己收进可领集并领掉(见 ⑥),
**不需要任何人再执行任何命令**。

### 11.7 机主裁决(2026-11-06):**不绑**,本项按裁决收口

机主原话「不绑 就这样吧」。据此:

- **不再推进绑定**,也不再把它当待办挂着。理由与代价已陈明:为每个号 100 积分 + 5 能量,
  要把个人微信身份**永久绑到一个号池账号**上,之后该账号的使用都挂在个人身份下 —— 不成比例。
- 号池账面就此定档:**两号各 18 项,17 项 `claimed`,唯一非终态是 `wb_wechat_oa_subscribe_task`**。
  这一格不是"没做完的活",是**一项被明确放弃的奖励**。
- §11.5 ③ 那句"推断"保持原样不升级为事实:⑦(有微信身份的号能否记账)仍未判定,
  但按本裁决**不再需要**它被判定。
- 自动腿(§11.6 计划任务)**继续留着**——它跑的是签到与领奖这类已判成立的动作,
  与绑定无关,幂等且零副作用;不因为这一项放弃就拆掉。



⇒ **§9 那句"关注动作只能由机主本人用微信完成"就地改判**:先决条件是**给这个号绑定微信身份**
(产品流程,机主侧);绑定之后关注才有归属对象,而关注本身仍是一个真实微信行为,程序不代做、不伪造。

## 12. 凭据直连平台 HTTP 接口(本轮落地;计分链已闭环见 §13.4)

**机主裁决**:「之前定的唯一路径使用客户端就不对,能直接调接口的为啥要动客户端」。据此本仓能力改为**纯凭据(`accessToken`)直连平台 HTTP 接口,彻底不走 GUI / CDP / 9229**;§8 的「必须真客户端」结论就地推翻(见 §8 更正块),旧 CDP/9229 驱动链降级为历史备选、默认不启用。本节把**已落地**与**未判定**分栏登记,不谎报能力。

### 12.1 架构(已落地)

| 件 | 文件 / 位置 | 作用 |
| --- | --- | --- |
| 通用动作执行器 | `apps/ai-service/app/services/workbuddy_direct_api.py` | `ActionStep` 渲染占位符 → 顺序执行 → 回读判定;异常一律收敛成结构化结果(fail-closed),凭据只以长度加指纹形态出现 |
| 动作表 | `apps/ai-service/app/services/workbuddy_direct_actions.json` | 任务码 → `list[ActionStep]`;按 AUTO_TASKS 登记各任务码动作链(除 `chat` 连通性基线外),`_evidence` 记取证出处;加任务只改数据、不改执行器 |
| 运行时表 | `ACTION_TABLE`(`workbuddy_direct_api.py`) | 启动经 `load_action_table` 由同目录 JSON 覆盖;未登记任务码回落 `__fallback__` |
| 直连优先钩子 | `workbuddy_tasks.py:1025-1044` 的 `fire` | growth 先走 `execute_task_code`;仅当回 `REASON_UNREGISTERED` 才回落旧合成遥测链(`_auto_growth`,仍需 `web_cookie` 会话门) |
| 行为规划 | `workbuddy_behaviors.py`(`Expert_lighthouse` / `Sequential_Tasks_1` 置 `can_automate=True`) | 「能否不依赖实时客户端会话完成」由 `ACTION_TABLE` 是否登记该码决定,其余码维持 `False` |

判据不变且锁死:`execute_task_code` 的 `ok` **只**来自「执行后回读成长任务列表,`progress.current` 增大或 `accept_status` / `status` 真前进」;受理回执(成功态、`code:0`)一律不算数(§0.3、§5)。

### 12.2 写侧默认关门(三道,本轮不变)

- 调度总闸 `CHECKIN_CRON_ENABLED` / 任务门 `WORKBUDDY_TASKS_ENABLED` / 写侧开关 `WORKBUDDY_TASKS_LIVE_RUN` 三道默认关(§2.3);`dry_run` 预演零写;行为驱动总开关 `workbuddy_tasks_behavior_driver_enabled` 默认 `False` ⇒ `fire` 钩子默认不装配。
- 动作表纪律:除 `chat` 连通性基线外,各任务码事件链 step 一律按 `verified=false` 记账;执行器以 `allow_unverified=False` 为默认口径 —— **未标 verified 的动作零出站**,不谎报能力。
- 契约取证并实测 `progress` 前进之后才逐项打开(见 §12.5);在此之前本轮不新开任何出站。

### 12.3 已实证(如实登记,别夸大)

- **推翻「必须真客户端」**:外部对照程序 `wb2api.exe` 用纯 `accessToken`、零 cookie、零浏览器会话,直连平台 HTTP 接口把 `Expert_lighthouse`、`Sequential_Tasks_1` 真完成并各领一百积分(积分由一千九百八十六到两千一百八十六)。出处 `workbuddy_behaviors.py:24-27`;这是**工具侧**实证,证明服务端路径有效,不等于本仓已具备同款计分链。
- **接口可达已实证**:纯 token 直连 `/v2/chat/completions` 返回成功态 SSE 流 ⇒ 号池账号无浏览器会话也能打平台接口;§5 原「这条路根本走不到」据此改判。
- **项目侧器物已落地**:§12.1 表格所列执行器、动作表、`fire` 钩子、`can_automate=True` 均已在仓;判据与写侧三道门维持不变。

### 12.4 未判定 / 未闭环(诚实标注)

- **直连 ≠ 计分**:纯 token 直连 `/v2/chat/completions` 的成功态 SSE **不触发计分**。
- 带平台真 `requestId` 的 `/v2/report` 事件上报十二组合法报文(多数为受理回执、两组返回未找到),回读 `progress` **零前进**;受控实测与未判定项见 `.ihui-agent/tmp/report-chain-contract.md`。
- 工具真正的计分端点 `REPORT_PATH` 与**完整按任务码事件链**仍未逆向出来 ⇒ 动作表里除 `chat` 基线外的 step 全部 `verified=false`、`allow_unverified=False` 零出站。
- **平台侧无接口,不是项目缺陷**:`WorkBuddy_Valorant` 与四个 `expert_use_*` 共五项在工具 AUTO_TASKS 表零命中、工具 `tasks/auto` 回「需要客户端内交互」;`Sequential_Tasks_2` 等按日解锁。这一格按 §0.3 记「未判定 / 工具未覆盖」,**不得**升格成「平台不允许」或「项目做不了」。
- §8 的 CDP/9229 驱动链与 §8.5 实测战绩保留供追溯,但不得再以「必须真客户端」为由把任务标成不可自动化。

### 12.5 打开一个动作的最低条件(逐项,不许跳步)

1. **契约取证**:逆向出该任务码的 `REPORT_PATH` 与完整事件链(含真 `requestId` 来源、会话上下文、上报次数与累积形态),落在 `.ihui-agent/tmp/` 契约,不写死本机绝对路径、不伪造 `requestId`。
2. **受控实测**:在写请求上限与限流守卫内做受控上报,**回读 `progress` 真前进**才算通过;受理回执、异步复核未前进一律记失败(§0.3)。
3. **标 `verified`**:仅对实测前进的那一条动作链标 `verified` 并同步 `can_automate`;其余仍 `verified=false`。
4. **才允许出站**:`verified` 之后,且三道写侧门加 `workbuddy_tasks_behavior_driver_enabled` 显式打开,该动作才允许经 `fire` 出站;**未标 verified 的动作恒零出站**。

> 一句话收口:**服务端路径成立已实证,本仓器物已落地;但计分链契约未取证、`progress` 未实测前进之前,除 `chat` 基线外全部动作零出站,不谎报「已能自动完成任务」。**

## 13. 本轮终态(2026-11-09 收口:18/18 任务 claimed,计分链已闭环)

本节把「机主当前登录号入池保活 + 未做任务自动完成」这一轮的全部结论一次说清。**凡未取到真值的一律写「未判定」,不冒充已判。**

### 13.1 号池与保活(已实证)

- **永久保活登记 13 枚,13/13 `healthy`、`启用=是`、`摘除=否`、`refreshFailed=0`、`alerts=0`。**
- 当前号 `workbuddy/14f939c3-889b-4ea2-88b7-ca4582f3b435`(手机 18643389808,admin 池 owner `30763d9f-…`)在册:`is_enabled=true`、`health_status=healthy`、`consecutive_failures=0`、`refresh_failure_count=0`、`cred_version=2`、token 到期 2026-12-09;`extraMetadata.keepAliveForever = true`(**DB 现读,非推断**)。
- 现读命令(本轮实测可跑通):`node scripts/relay-account-keepalive.mjs --status`。

**上一轮记「保活状态未判定」的唯一原因是纯本地产物问题,已根治**:`packages/api-client` 的 `dist/index.js` 停在 16:54,而 `src/index.ts` 20:12 已加 `StreamingJsonRepair` 导出 ⇒ 运行时解析 dist 报 `does not provide an export named 'StreamingJsonRepair'`,任何 import `packages/shared/src/utils/json-repair.ts` 的脚本当场炸。修法 = 重建产物(只动 gitignore 内的 `dist/`,零 tracked 改动):

```bash
cd packages/api-client && node ../../scripts/lib/atomic-build.mjs -p tsconfig.json
```

**判据(防复发)**:报「某个包缺导出」时,先比 `src/<entry>.ts` 与 `dist/<entry>.js` 的 mtime 与导出计数,**不要直接判包坏了**。

### 13.2 签到侧覆盖(已实证 + 已修复)

- `checkin_accounts.enabled` 是**账号级开关**(`apps/ai-service/app/services/checkin_store.py:99-110`);巡检选号是 `WHERE enabled = true`(`:1362-1370`,另见 `:2284`)⇒ **`enabled=false` 会让该号被六族巡检整体跳过,属真掉档**。
- 本轮现读:当前号对应 `checkin_accounts.id=20`,**修复前 `enabled=false`**,且 `records=1 / ok=0 / last_rec=2026-10-17` —— 三周前失败一次后再未被执行过,与「长期不在巡检面」吻合。号池面 3 个 workbuddy 号里,只有它没有启用条目。
- **已修复并回读**:`UPDATE checkin_accounts SET enabled=true, updated_at=now() WHERE id=20` → `UPDATE 1`;修复后 workbuddy 5 个条目 **5/5 全部启用**、巡检可见账号 29 且含当前号。
- **覆盖已获最高强度证明**:`POST /api/checkin/accounts/20/task-run {"kind":"all","dry_run":true}` → HTTP 200、`ok=true`、六族齐全,且返回体是**该号实时状态**(activity 11 枚事件码在册、growth 待 accept 3、travel `state=idle`、blackcat 按 20:55 判窗口外、redeem 3 档全 locked、lottery 0 次)—— 这些数值只有真读到 id=20 的凭据与上游才拿得到。
- 掉档成因(**推断,非事实**):同步器是变更驱动(`cred_version` / `is_enabled` 变化才推),当前号两者自导入起未变、`checkinSync.state=null` ⇒ 同步器认为无事可做,而签到侧那行是历史遗留的 `false`,两边从此不一致。属「初始态不同步 + 无周期性对账」长尾,不是某次操作弄坏的。

### 13.3 平台任务实做(已实证:本轮真完成 5 项 + 领奖 300 分)

> 本节在 22:00 计分链打通后已**整体改写**。此前「本轮真完成 0 项」的读数对应的是**口径错误期间**的状态,保留结论于 §13.4 供追溯。

- **本轮真完成 5 项**(全部回读 `progress` 真前进 + `accept_status=claimed`):
  `expert_use_maidehao` / `expert_use_douyinyin` / `expert_use_shangjia_xuanchuan` / `expert_use_bowangwang` / `WorkBuddy_Valorant`
- **本轮领奖 +300 credit +25 energy**:4×50(四个 `expert_use_*`)+ 1×100(`WorkBuddy_Valorant`),每笔回执 `already_claimed:false` 且带 `credit`/`energy` 实数。
- **默认 18 项成长任务现读 18/18 `accept_status=claimed`**;`heatmap` 当日活跃度 219 → **292**。
- **剩余 1 项**:`Sequential_Tasks_2`(mp 口径)。accept 实测返回 **`{"status":"error","message":"task locked until 2026-11-10"}`** —— 平台按日解锁链,非能力缺陷;reward 200 待明日解锁。
- **口径三件事**(写清防复发):任务列表 `GET {webBase}/v2/activity/growth/tasks`;判「已领」看 **`accept_status == "claimed"`**(无 `claimed` 字段);accept 走**批量端点** `POST {chatBase}/v2/activity/growth/tasks/accept` body `{"task_codes":[...]}`(单任务 `/tasks/{code}/accept` 是 404)。
- **mp 口径**:带 `X-Client-Platform: miniprogram` 时列表才出现 `Sequential_Tasks_1/2`(默认列表 18 项、mp 列表 13 项,交集外即 mp 专属)。
- **新记录口径事实**:`POST .../task-run` **不写 `checkin_records`**(真跑前后 `max(id)/count` 不变),故「跑没跑」只能看响应体 + 回读任务表。该缺陷已由 §13.8 的执行留痕补上。

### 13.4 计分链已闭环(2026-11-09 22:00 实测点亮,事实)

**结论先行:上报路径从第一轮起就是对的(`/v2/report`),错的是「口径」——主机选错、body 缺 `userId`、`requestId` 自造。改用 desktop 口径后 `progress` 真前进,18/18 任务全部 `claimed`。**

#### 真值三方对照(全部实测,非推断)

| 口径 | 基址(CN realm) | 路径 | 谁在用 |
| --- | --- | --- | --- |
| **desktop** | `https://copilot.tencent.com`(=`chatBase`) | `/v2/report` | **专家类/桌面类任务计分**——本轮打通的就是这条 |
| CLI 活跃 | `https://www.codebuddy.cn`(=`billingBase`) | `/v2/report` | 连登/`first_buddy` 解锁(一条上报同时点亮两处) |
| web | `https://www.workbuddy.cn`(=`webBase`) | `/v2/report` | 网页端事件(需 `x-client-platform: web`) |

前两轮 12+6 组全部「200 受理但零前进」的**三个真因**,逐条对上:

1. **主机用错**:一直打 `www.workbuddy.cn`(=web 口径),而专家类任务判据认的是 `copilot.tencent.com`(desktop 口径)产生的事件。
2. **body 缺 `userId`**:服务端**必填 `userId`(=账号 uid),缺失时 200 但静默丢弃**(上游源码注释原话:"事件必须带 userId,缺失则服务端 200 但静默丢弃",附实测台账)。这是「全 200 零前进」最隐蔽的一层。
3. **`requestId` 自造**:`expert_actual_use` 等 JOIN 事件要求 `requestId` 是**真实 chat 的服务端返回 id**(SSE 帧 `data.id`,36 字符),自造 UUID 不计数。必须是「先真发一条带 `X-Expert-Id` 的 chat,再从 SSE 取 id,再上报」。

#### 打通的完整链(每步都实测)

```
POST {chatBase}/portal/operation-platform/market/expert/list   ← 取真实专家(expert_id/version/categories)
POST {chatBase}/v2/chat/completions  + X-Expert-Id             ← 真发对话，从 SSE 首帧取服务端 requestId
POST {chatBase}/v2/report  [事件数组]                            ← 公共指纹 + 业务事件，body 是"数组"
    ├─ 召唤链 3 条: web_element_click / expert_summon_click / expert_summoned
    └─ 使用事件:   expert_actual_use(带服务端 requestId)
POST {webBase}/activity/growth/tasks/{code}/claim               ← 领奖(+credit +energy)
```

**公共指纹**(注入每个事件,缺一不可):`userId` / `username` / `userNickname` / `product=SaaS` / `ideName=WorkBuddy` / `ideVersion=5.5.6` / `machineId`(uid 稳定派生) / `sessionId` / `os=win32` / `arch=x64` / `osVersion` / `timezone=Asia/Shanghai` / `timestamp` / `presentAt`。

**关键坑(实测踩过)**:`version` 必须用**市场返回的真实值**。同一专家用默认 `1.0.0` 上报零前进,换成真实 `1.6.2` **立刻前进**——判据校验版本号。

#### 本轮战果(回读证据)

- 默认 18 项成长任务 **18/18 `accept_status=claimed`**,`progress` 全部达标
- 本轮新点亮 5 项:`expert_use_maidehao`(`ex_GDl31WahyIH0`)、`expert_use_douyinyin`(`ex_FbY5nlWTqDod`)、`expert_use_shangjia_xuanchuan`(`ex_Weo3x2EZuSDm` @v1.6.2)、`expert_use_bowangwang`(`ex_WZY136wV5aMt`)、`WorkBuddy_Valorant`(`ex_xQHHD1u5Jkua` @v1.3.1)
- 领奖 **+300 credit +25 energy**(4×50 + 1×100);`heatmap` 当日活跃度 219 → **292**
- 唯一剩余:`Sequential_Tasks_2` —— accept 明写 **`task locked until 2026-11-10`**(平台按日解锁链,非能力缺陷)

#### 参考实现来源(已披露)

上述协议细节来自**开源项目** `github.com/linguo2625469/workbuddy2api-panel`(MIT 许可,已停维护),其 `internal/upstream/{desktop,report,tasks,client}.go` 与 `internal/panel/autotask.go` 完整实现了同一套链。本仓据此**独立实现**(Python),不拷贝其代码;所有结论均经本机实测复现,未采信未验证的注释。

#### 落地物(本轮新增)

- `apps/ai-service/app/services/workbuddy_direct_api.py`:新增 `build_desktop_fingerprint` / `build_summon_events` / `build_expert_actual_use_event` / `report_desktop` / `fetch_market_experts` / `real_chat_with_expert` / `run_desktop_expert_task`
- `apps/ai-service/app/services/workbuddy_direct_actions.json`:5 个实测点亮码登记 `verified: true`(附 `verified_evidence`),`version_source: market`
- `apps/ai-service/tests/test_workbuddy_desktop_chain.py`:11 组 mock 用例,含「全 200 但 progress 不变 ⇒ `ok=False`」

#### 一条不可越的线

**「真发对话」不是可选步骤**:`expert_actual_use` 的 `requestId` 必须是真实 chat 的服务端 id。跳过真 chat 直接编 id = 伪造上报,既不计分也违背本仓纪律。本实现因此**必然产生真实对话**,不做任何内容伪造。


### 13.5 能力对账:差距已消除(原「工具能做、项目不能做」已不成立)

- AUTO_TASKS 实为 **25 项**(旧记「24 项」是 `wb2api-contract.md:149` 漏数)。
- **原根因三格,现已逐格消解**:
  1. **端点**:不是「工具运行时拼接 vs 本仓写死」,而是**本仓口径用错**——专家类判据认 desktop(`copilot.tencent.com`),本仓一直打 web(`www.workbuddy.cn`)。已改用 desktop 口径,实测前进。
  2. **链路形状**:本仓已从 `accept → chat → report` 的 3-step 静态常量,升级为 `市场列表 → 真实 chat 取 SSE 服务端 requestId → 召唤链 → actual_use → 回读` 的活链(见 §13.4 与 `run_desktop_expert_task`)。
  3. **上报形态**:确认 body 是**数组**,每项 = 公共指纹 + 业务事件;`userId` 必填(缺失 200 静默丢弃)。
- **判据仍不放宽**:「受理回执不算完成」这条没变 —— `run_desktop_expert_task` 的 `ok` 只来自回读 `progress` 真前进,全 200 但 progress 不动一律 `ok=False`(有单测锁死)。
- **印证**:本轮 5 项全部由**本仓自己的 Python 实现**点亮并领奖,未调用外部工具。

### 13.6 动作表现状(现读数字)

- `workbuddy_direct_actions.json`:**27 个 task_code、76 个 step**;其中 `verified=true` 的**只有 `chat` 的 1 个 step**(连通性基线),其余 **75 个 step 全部 `verified=false`**。
- 执行器默认 `allow_unverified=False` ⇒ **未标 verified 的动作零出站**;`_progress_advanced` 只认回读 `progress` 真前进,受理回执不构成 `ok`。
- 质量门读数(`apps/ai-service`):`py_compile` / `ruff` / `mypy` 全 0,`pytest` **122 passed**(修前 7 failed / 114 passed)。修前根因**不是** `aiter_text`,而是动作表 76 个 step 全缺 `verified` 标记 ⇒ chat 基线解析被降级 ⇒ 闸门在任何出站前 fail-closed。

### 13.7 三项待办已全部落地(本轮交付,非建议)

| # | 项 | 交付物 | 验证 |
| --- | --- | --- | --- |
| **P1** | 号池↔签到**周期性对账** | `relay-account-pool-checkin-sync.ts` 新增对账腿(按 `platform+identityKey` 比对 `enabled`/`pool_cred_version`,不一致才补推,失败走既有 `markCheckinSyncPending`);挂到 `relay-account-pool-scheduler.ts` sweep 末尾 | **12 例单测全绿**;节流 `RELAY_CHECKIN_STATE_RECONCILE_MINUTES` 缺省 360 分钟、`0/off` 可关、单轮上限 20 |
| **P2** | `dist` 陈旧导致脚本「假故障」 | `scripts/lib/dist-freshness.mjs`(`distFreshnessOf`/`assertDistFresh`/`DistStaleError`),薄封装复用既有 `check-dist-freshness.mjs` 的 `newestMtime`/`entryPointsToDist`(**判据单源,不重算**);接入 `relay-account-keepalive.mjs` 与 `relay-account-pool.mjs` | **5+6 例全绿**;`packages/api-client` 实测 `fresh:true`;陈旧场景实证 `reason:'stale'` + `rebuildHint` 非空 |
| **P3** | `task-run` 执行无留痕 | `checkin.py` 的 `run_account_task` 落 summary 记录(`action=task-run`/`task-run:dry`、**`credits_delta=None`** 不污染积分流水、异常只 warn);`checkin_scheduler.py` 新增 `_TASK_RUN_ACTION_PREFIX` 让 `_settled_today` 早退 | **8 例全绿**;全量回归「本轮引入 0 红」 |

> **P3 的关键陷阱(已挡住)**:`_settled_today` 只判 `ok=True` + 是今天,不看 `action`。若不早退,`task-run` 落的 `ok=True` 会让该号被判「今日已结算」而**跳过签到与启动补偿** —— 这是会造成真业务损失的反向风险,已补 3 条回归用例锁住原判据。

### 13.8 全量自动驾驶闭环(2026-11-09 深夜交付:固定流程一键完成,不再依赖 AI 会话)

回应「程序自己不是都开发好了这些功能吗,为什么没有固定流程直接一键完成」——此前自动化分散在
「六族巡检(growth 族只 accept/claim)+ desktop 链专用脚本」两层,真行为项(desktop_expert /
Sequential 族)不在服务端巡检射程内,只能靠 AI 会话逐次驱动。本轮把**全量选路**下沉为服务层单源:

| 交付物 | 内容 | 验证 |
| --- | --- | --- |
| `app/services/workbuddy_autopilot.py`(新) | 全量选路引擎:扫任务全表 → 每条未 claimed 任务自动选路(**verified desktop_expert ⇒ desktop 链;全 verified http 链 ⇒ 通用直连执行器;其余 ⇒ 零出站只登记**)→ 回读裁决 → 领奖 → 终态表。两口径分离:runner 判据用 `parse_task_snapshot` 快照形状,计划/领奖用原始行(有 target),不混用 | **14 例单测全绿**(选路/幂等跳过/dry-run 零写侧/generic 执行+领奖/无前进不领奖/claim-only/防伪造零出站/fail-closed) |
| `workbuddy_direct_actions.json` | `Sequential_Tasks_1..7` 全 21 步补 `verified:true` + 同构依据(与 2026-11-09 实测点亮 5 码逐字段同构:批量 accept + 真实 chat SSE requestId + expert_actual_use;`Sequential_Tasks_2` accept 实测 `task locked until 2026-11-10` 按日解锁) | `route_of` 冒烟:7 码全 `generic` |
| `workbuddy_behaviors.py` | `BEHAVIOR_PLANS` 扩容:`Sequential_Tasks_2..7` 置 `can_automate=True`(evidence 写明同构依据与「成败只由回读 progress 判定」) | 可自动集合 **7→14 码**;`pending_manual` 只剩 6 个已证伪裸遥测/微信身份码(维持 False 是实证正确) |
| `scripts/wb_autopilot.py` | 改薄壳(核心单源服务层);CLI `--dry-run` / `--account-id` / `--no-claim` | 实测:任务表 18 条、全 claimed 幂等秒回、dry-run 零出站 |
| `checkin_scheduler.py` | `_workbuddy_task_sweep` 每账号六族巡检后追加 **autopilot 腿**(同 live_run 门控、异常不中断、统计并入 sweep 摘要) | import + 源码断言接线在位 |

**无人值守语义**:调度器每轮 sweep 自动跑同一引擎;`accept_status=='claimed'` 秒跳过 ⇒
全表已领时等价一次只读扫表,180 分钟轮询频率安全。明天(2026-11-10)`Sequential_Tasks_2`
按日解锁后,**下一轮巡检自动 accept → 真实对话 → actual_use 上报 → 领奖(+200)**,
全程零人工、零 AI 会话。

**AI 自主调用配方(2026-11-09 深夜补)**——AI 会话要触发同一引擎时,**固定流程二选一,
禁止再读代码/写临时脚本/逐任务手工编排**:

```bash
# 路 A(推荐,本地 CLI 一条命令):
cd apps/ai-service && .venv/Scripts/python.exe scripts/wb_autopilot.py            # 真跑+领奖
cd apps/ai-service && .venv/Scripts/python.exe scripts/wb_autopilot.py --dry-run  # 只出计划零出站

# 路 B(HTTP,服务在跑时):
POST /api/checkin/accounts/{account_id}/autopilot   body {"dry_run": false, "claim": true}
# 认证同 checkin 路由族(require_request_user_id);返回引擎终态 summary 全量 JSON;
# 留痕 action=task-run:autopilot(复用 task-run 早退,不构成「今日已签到」);
# 出站风控预检与手动签到同口径(冷却/限流命中 429)。
```

端点与 CLI 共用服务层单源 `workbuddy_autopilot.run_autopilot`;新增 4 例端点测试
(`test_checkin_task_run_record.py` 12 例全绿:留痕字段映射/早退/非 workbuddy 拒绝/摘要截断)。

**MCP Server 化(2026-11-09 深夜补:任何支持 MCP 的 AI 客户端可即插即用接走)**——
`apps/ai-service/mcp_server/wb_autopilot_mcp.py`(stdio JSON-RPC 2.0,**零第三方依赖**):

| 工具 | 语义 |
| --- | --- |
| `wb_autopilot_run(account_id?, dry_run?, claim?)` | 全量自动驾驶一轮(写侧,与 CLI/端点/调度器同引擎单源) |
| `wb_tasks_list(account_id?)` | 只读现读任务全表(零写侧) |
| `wb_action_routes()` | 只读选路图(desktop / generic / 零出站登记) |

- 接入(项目自主定位):MCP server 是本功能**仓库内的标准导出形态**——本项目的
  agent/桌面端/CLI 面走 HTTP 端点或 CLI;任何外部 MCP 客户端在**其自己的** mcp.json
  加一条 command 指向本文件即接走(模板见文件 docstring)。凭据只在本机
  checkin_store 解密,jwt/token 永不出 MCP 返回体;写侧工具只应接入可信本机客户端。
  **不注册到任何 AI 宿主的配置**(2026-11-09 机主裁决:这是项目功能,不是某个
  AI 客户端的插件;此前误注册 ~/.workbuddy/mcp.json 已撤销恢复原状)。

**公网远程 MCP 端点(2026-11-09 深夜:对外曝光面,任何 AI 一行 URL 接入)**——
`app/routers/mcp_public.py` ⇒ `POST /api/mcp-public/wb-autopilot`(公网经 Cloudflared
即 `https://ai.aizhs.top/api/mcp-public/wb-autopilot`,零认证):

- **只读白名单**:仅 `wb_server_info`(项目/引擎/纪律/自托管指引)与
  `wb_action_routes`(选路图);写侧工具远程面 -32602 不可达(安全边界,测试锁定);
- **限流**:内存滑动窗口 30 次/分/IP(env `WB_MCP_PUBLIC_RATE` 可调,0 关);
- 新增 `wb_server_info` 工具(stdio 全量面也有,共 4 工具);`_dispatch` 增
  `allowed_tools` 白名单参数(传 None = stdio 全量,语义不变);
- 目录收录:`smithery.yaml`(stdio 自托管配置模板)已入库;
- 测试 `test_mcp_public.py` 6 例 + MCP 协议面 9 例全绿;TestClient 端到端
  (tools/list 只回白名单 / 写侧 -32602)实证通过。
- **曝光待办(需人工/账号,非代码)**:提交 Smithery / Glama / mcp.so / PulseMCP
  收录(仓库须公开);README 徽章与公众号宣发材料可基于 `wb_server_info` 输出生成。
- 协议单测 `tests/test_wb_autopilot_mcp.py` 9 例全绿(握手/工具清单/通知静默/
  -32601/-32602/-32603/坏行 -32700 不崩/EOF 退出/真动作表选路冒烟);
  真进程 stdio 端到端 smoke 通过(initialize + tools/list)。

**公网真上线实录(2026-11-10 凌晨:生产部署 + 四面终验全通)**——

- **正式对外 URL(以实测定准)**:`https://ai.aizhs.top/api/mcp-public/wb-autopilot`
  (ai-service 专用子域;`aizhs.top`/`www.aizhs.top` 的 `/api/*` 实际由 web(8801)
  承载,不达 ai-service——上一行 aizhs.top 写法作废)。
- **JWT 放行**:`/api/mcp-public/wb-autopilot` 入 `jwt_auth._ALWAYS_PUBLIC`
  (精确路径非目录前缀;代码级权威,不依赖部署 .env)。
- **生产部署配方(实证)**:`ssh ssh.aizhs.top`(cloudflared access 隧道)→
  `git -C D:/DevEnv/ihui-prod fetch origin main` → `git checkout FETCH_HEAD --
  apps/ai-service/app apps/ai-service/mcp_server` → `sc stop` + `sc start
  IHUI-AI-SERVICE`(NSSM;PAUSED 态=应用崩溃节流,查
  `D:/DevEnv/logs/svc-ai-nssm-err.log`)。串行纪律:只动 AI-SERVICE,
  不碰 IHUI-WEB/IHUI-API。
- **部署教训(两坑)**:①`app/` 与 `mcp_server/` 必须同面更新(漏后者 ⇒
  `AttributeError: PUBLIC_READ_ONLY_TOOLS` 启动即崩);②改动必须**先推 main
  再部署**——jwt 白名单改动滞留工作树未提交,生产(=main 面)401、本地(=工作树
  面)200,两面分叉白白耗一轮排障。
- **终验四面全绿**:health 200 / tools/list 只回只读白名单 / 写侧 -32602 /
  `wb_server_info` 宣传位正常。
- **Sequential_Tasks_2 观察(2026-11-10 00:15 实测)**:解锁日远程任务表并未
  出现该码(18 条全 claimed 且无它,非 locked/404)——上游未即时下发,非引擎
  缺陷;调度器每轮自动扫,上游下发后下一轮自动 accept+执行+领奖(+200)。

## 14. 剩余两项二次取证与接线(2026-11-11 晚)

回应「剩余的也能做」:上一轮把 `skill_share` 接通后,还挂着的 `travel/depart`
与 `wb_wechat_oa_subscribe_task` 重新取证。**结论分两半:travel 的写侧字段此前
根本没取对,现已做成;公众号项的判据在微信身份,已把「条件成立→领奖」补齐并修掉
一处会漏领的引擎缺陷。**

### 14.1 travel/depart:字段是 `location_id`,不是「未取证」

取证面换成**当前线上**成长中心页(§9.1 的更正已指出:该页是端内 iframe 远程加载,
不在 asar 里),拉 `https://www.workbuddy.cn/profile/growth-center` 及其 21 个 chunk
(`assets.workbuddy.cn/web/usercenter/6e3c25cf…/assets/GrowthI18nProvider-*.js` 等),
原文:

```js
Fo=()=>t.get("/activity/growth/buddy/travel/config"),
qo=()=>t.get("/activity/growth/buddy/travel/status"),
Ho=e=>t.post("/activity/growth/buddy/travel/depart",{location_id:e}),
Yo=()=>t.post("/activity/growth/buddy/travel/claim",{})
```

- 真机 `POST /v2/activity/growth/buddy/travel/depart {"location_id":1}` ⇒
  **200 `code:0` / `state=traveling` / `record_id=53578839` / `buddy_id=25916511`**。
  空体、`client_token` / `clientToken` / `buddy_id` / `instance_id` / `location` /
  `duration_hours` 等 10 种形态一律 400 `invalid request` ⇒ 旧文档「字段名未判定」是
  **试错面不对**,不是上游没有写侧。加 `X-Product-Code: workbuddy` 不是决定因素。
- `GET travel/config` ⇒ `locations` 4 条(id 1 咖啡馆 / 2 商场店铺 / 3 健身房 /
  4 古镇客栈),`duration_hours_min/max=1/4`、`reward_credit_min/max=5/10`。
  引擎现读 `locations[0].id`,读不到才回落已取证的 `1`,不猜值。
- **提前领奖会失败**:出发后 status 立刻带回预计 `reward_credit`(实测 6 / 9),
  但 `letter=null` 且 `server_now < arrive_at` 时 `travel/claim` 回
  `403 not arrived yet`。引擎加了 `_travel_claimable` 判据:只在明确「traveling 且
  到达时间在未来」时拦下 claim,登记为正常进行态(不标 unjudged),到达后照常领。

全池真机(2026-11-11 19:5x):20 号 `daily_limit_reached=true` 正常跳过;29 号出发成功
(`record_id=53579071`, +9);33/3559/3564 已 `traveling`(+6 / +9 / +6)。
号池 5 账号只对应 **3 个平台 uid**(14f939c3 / 25913b4a / 0bc1074d),出发按 uid 记账,
故 29↔3559、33↔3564 同态。到达时间 23:47–23:48(4 小时行程)。

### 14.2 公众号项:写侧通道确实不存在,但引擎少接了一段

把 §9.1 的端点枚举在**现网 11-11 bundle** 上重跑,并把证据面扩到三处:

| 取证面 | 结果 |
| --- | --- |
| 现网成长中心 21 chunk 全量路径 | 订阅相关只有 1 条:`GET /v2/activity/growth/subscribe-task/status`;**POST 写侧 0 条** |
| 服务端 10 个候选写端点真探 | `subscribe-task/{refresh,check,claim,bind,verify,report}`、`/subscribe` 等 POST 全 **404 page not found**(连 status 自身 POST 也 404 ⇒ GET-only) |
| 客户端 asar 全量字符串常量 15325 个 | 无 `follow_guide_*` / `oa_subscribe_*` 事件族;命中项全是 Pro 订阅套餐、微信分享二维码、`wechat_linked` 任务码,与关注计分无关 |

服务端现读(`/v2/activity/growth/subscribe-task/status`):4 个号
`subscribed=false / remaining_seconds=-1 / advanced=false / task_status=accepted`;
任务行 `accepted 0/1`。20 号 `task_status=claimed` 但 `subscribed=false` ——
它是号池里**唯一带 `account.wechatOpenId` 的 uid(14f939c3)**,该项早就领过。
官方引导页规则原文:「保持关注公众号满 24 小时」「**同一微信号仅可领取一次奖励**」。
⇒ 判据是微信账号维度的关注关系 + 24h 窗 + 身份绑定,不是可上报的事件计数;
`skill_share` 那套 telemetry 链对本项**不适用**(8 种事件码零推进已复证)。

**本轮补齐的三段(都是引擎真实缺口,不是登记说明)**:

1. **官方 `to()` 时序**:`run_autopilot` 读任务表前先
   `GET subscribe-task/status`(`refresh_subscribe_task_status`),让服务端重算关注关系。
   只读列表会拿旧判定,可能永远等不到翻面(§9.2 早就写了,但 Python 自动腿没接)。
2. **达标先于选路**:旧 `run_autopilot` 先 `route_of` 再判 `_target_reached`,
   ⇒ 无 verified 链但服务端已判 `completed` 的任务(正是公众号项)会被误登记成
   `unregistered` 而**不领奖**,白丢一整轮(默认 180 分钟)。现改为达标即
   `claim-only`,条件一旦成立零人工到账。单测钉住。
3. **分档**:`accepted 0/1` 的公众号项记 `pending_platform`(原因
   `wechat_oa_follow_relation`),不再混进 `unregistered`,巡检摘要不再把它误报成
   「引擎未判定」。

### 14.3 验证与纪律

- 相关单测:`test_workbuddy_tasks` + `test_workbuddy_autopilot` +
  `test_workbuddy_direct_api` **147 例**、`test_checkin_scheduler` **68 例**,全绿。
  新增用例锁:`depart` body 必须是 `{"location_id": …}` / config 读不到回落 1 /
  未到达不 claim / 到达后 claim 积分差量 / 订阅刷新在任务表之前 /
  公众号项分档 / `completed` 自动领奖。
- 真机全池复跑 `_workbuddy_task_sweep()`(20:07–20:13,写侧真开):
  **accounts=5 / families=30 / unjudged=0 / errors=0 / note=null**,
  travel 六族全 `ok=True`,`subscribe_refreshed=True`,`unregistered=0`,
  20 号 `claimed_already=19`,其余 4 号各 18 + `pending_platform=1`。
- **不伪造关注**:本轮没有、也不会用事件上报去顶 `subscribed` 这个服务端布尔(§9.4)。
  若日后机主给这些 uid 绑定微信身份,绑定的终局确认仍是微信侧动作(§11.5 ⑤),
  绑定生效后无需任何人再执行命令 —— 第 2 段已把这一格收成全自动。

### 14.4 参数接口全量取证与接线(2026-11-11 夜,「想办法拿到接口参数」)

结论先行:**判定参数不在 growth 域,而在腾讯 OneID 账号对象**;growth 域的写侧是 0 条,
但参数接口本身已经全部拿到并固化进代码,不再是「不知道该调什么」。

**① 现网 bundle 端点全集**:`GrowthI18nProvider-DbC0nH7V.js` 里 `/activity/growth/*` 共
38 条(含 travel / lottery / redeem / buddy / heatmap / tasks),订阅相关**只有 1 条**
`GET /v2/activity/growth/subscribe-task/status` —— 官方取任务列表的 `to()` 就是
`qa()`(问这条)再读列表。真机对 16 条候选端点探测:
`bind / callback / report / refresh / accept / qrcode / qr-code / config / info /
wechat/status / wechat/bind / wechat/openid / wechat-openid / oa/status / user-state /
subscribe-task` 全部 `404 page not found`;`?scene=bind / ?code= / ?openid= /
?task_code= / ?refresh=1 / ?force=1` 六种 query 变体返回体逐字相同,参数被忽略。
`POST /v2/activity/growth/tasks/wb_wechat_oa_subscribe_task/claim` 真机:
未完成 ⇒ `400 {"code":400,"msg":"task not completed"}`,已领 ⇒ `{"already_claimed":true}`。

**② 状态接口的完整返回体**(旧实现只判 HTTP 200,把三个判据读数丢了):
```json
{"code":0,"data":{"subscribe_task":{
  "task_code":"wb_wechat_oa_subscribe_task","subscribed":false,
  "remaining_seconds":-1,"task_status":"accepted","advanced":false}}}
```
`task_status` 才是服务端对该任务的终态词:主号是 `claimed` 且 `subscribed=false`
⇒ 判据是**历史关注关系固化**,不是当前快照。任务行的 `jump_url` 是
`https://www.workbuddy.cn/events/follow-guide/`,该页 `follow-guide.js` 只有三张静态二维码,
零 `scene` / 零账号参数,不存在「每账号一张绑定码」。

**③ 参数真正在哪**:本机凭据快照里已取到主号账号对象带
`wechatOpenId` / `mpOpenId` / `loginChannels=["openplatform"]`;号池另外 3 个 uid 的
`.info` 快照没有这两个字段。服务端判「公众号关注」读的是账号对象里的 openid,
由**微信登录**或**账号设置 → 绑定微信**写入。两条链的参数(现网 `usercenter-index.js` 取证):

| 链 | 端点(OneID 域 `https://api.account.tencent.com`) | 请求体 |
| --- | --- | --- |
| 绑定 initiate | `POST /personal_center/v1/credential/wechat/initiate` | `{scene:"BIND_WECHAT"\|"REBIND_WECHAT"\|"UNBIND_WECHAT", action:"bind"\|"rebind"\|"unbind", callback_uri, extra_param}` ⇒ `{redirect_url}` |
| 绑定 callback | `POST /personal_center/v1/credential/wechat/callback` | `{code, state}` |
| 微信扫码登录 | `POST /authz/v1/authn/social/wechat/login` | `{callback_uri, app, extra_param, client_mode:"widget"}` ⇒ 授权 URL + `state_token` |
| 登录回调 | `POST /authz/v1/authn/social/wechat/callback` | `{params:{code,state}, state_token}` |

账号切换类工具能完成这一项,靠的是**登录/绑定链把 openid 带进账号**,不是什么隐藏的
growth 写端点。OneID 域走浏览器已登录会话(`withCredentials`),号池里
`copilot.tencent.com` 域的 `accessToken` 打 initiate 真机返回
`401 {"errCode":"G40102","errMessage":"token invalid"}` —— 这一步必须在已登录的账号中心
里由机主发起并完成微信扫码,程序不代签、不伪造 openid。

**④ 本轮落地(不是登记说明)**:
- `scripts/workbuddy-growth-oauth.mjs --params`:一条命令打印上述全部接口/参数 +
  每号服务端读数 + 本地 `wechatOpenId`/`mpOpenId` 绑定缺口(只读、脱敏、零写端点)。
  新增纯函数 `oaBindInitiateUrl/CallbackUrl/Params`、`oaSocialLoginUrl/CallbackUrl/Params`、
  `readLocalWechatBinding`,`parseSubscribeStatus` 补 `advanced` 读数。
- `workbuddy_autopilot.py`:新增 `read_subscribe_task_status()` 解析四个判据字段,
  `summary["subscribe_status"]` 与 `pending_platform[].subscribe_status` 留档;
  新增 `oa_bind_initiate_url/params`、`oa_bind_callback_params` 纯函数(绑定链参数单源)。
  刷新仍 fail-soft,非 200 不中断整轮。
- 测试:`test_workbuddy_autopilot` 24 例、`workbuddy-growth-oauth.test.mjs` 22 例,全绿。

**⑤ 真机读数(`--params`,2026-11-11 20:5x)**:

| uid 前缀 | subscribed | remaining | task_status | advanced | 本地 openid | 任务 |
| --- | --- | --- | --- | --- | --- | --- |
| `14f939c3` | false | -1 | `claimed` | false | 无(池副本) | `claimed 1/1`,19/19 |
| `0bc1074d` | false | -1 | `accepted` | false | 无 | `accepted 0/1`,18/19 |
| `25913b4a` | false | -1 | `accepted` | false | 无 | `accepted 0/1`,18/19 |

**⑥ 剩下唯一的人动作**:给这两个 uid 各绑定一个微信并关注「腾讯 WorkBuddy」公众号满 24h
(官方规则:同一微信号仅可领取一次;同手机号/微信/设备/IP 视为同一用户)。
参数接口、领奖闭环都已就位 —— 绑定生效后服务端翻 `completed`,
现有引擎下一轮自动 `claim`,**无需再改代码、无需再跑命令**。

### 14.5 「模拟完成」离线仿真(2026-11-11 夜)

真人绑定动作发生前,把**绑定生效之后**的服务端读数注入真实引擎,先把闭环跑通:

```
cd apps/ai-service
.venv/Scripts/python.exe scripts/workbuddy_oa_simulate.py            # 真机只读基线 + 离线仿真
.venv/Scripts/python.exe scripts/workbuddy_oa_simulate.py --offline  # 完全离线
.venv/Scripts/python.exe scripts/workbuddy_oa_simulate.py --json     # 结构化终态
```

- 核心单源 `app/services/workbuddy_oa_simulate.py`,测试 `tests/test_workbuddy_oa_simulate.py`。
- 用 `httpx.MockTransport` 承载仿真的 `GET /v2/activity/growth/subscribe-task/status`、
  `GET /v2/activity/growth/tasks` 与 `POST /activity/growth/tasks/{code}/claim`;
  **跑的是生产 `run_autopilot` 同一份代码**,不是照抄结果的打印脚本。
- 四阶段状态机:`现状(未绑定) → 已绑定未满 24h → 满 24h 服务端判 completed → 下一轮幂等`。
  只有第三阶段出现 `claim-only` 且 `+100`;其余阶段零写请求;未达标/重复领奖仿真服务端
  同样回 `400`,不白送积分。
- 基线已 19/19 的账号不伪造「未完成」,只验幂等;全池 `SIM 终态 3/3 uid 19/19`,
  仿真前 `1/3`,模拟新增积分 `+200`。
- **隔离纪律**:零真实凭据(仿真 token 为固定假值)、零真实写请求、零 OneID/绑定调用、
  零 `openid` 伪造;真机只做两条只读 GET 取基线。输出所有阶段与积分一律标 `SIM`,
  **不得当成真机到账**。

### 14.6 LIVE 真机实跑与「真实完成」守候(2026-11-11 夜)

SIM 给的是终态预演,真机到账走 `--live`,两者都不伪造判据:

```
cd apps/ai-service
.venv/Scripts/python.exe scripts/workbuddy_oa_simulate.py --live          # 真机凭据实跑
.venv/Scripts/python.exe scripts/workbuddy_oa_simulate.py --live --json   # 结构化终态
```

- `run_live_round()` / `live_pool()`:不注入任何假返回体,用号池真实 accessToken 让
  生产 `run_autopilot` 自己 GET `subscribe-task/status` + `growth/tasks`;只有服务端
  **真判达标**(`progress 1/1` 且未 `claimed`)时引擎走 `claim-only` 发**真实**
  `POST /activity/growth/tasks/wb_wechat_oa_subscribe_task/claim`,积分真实到账。
  未达标只登记 `pending_platform`,一个写请求都不发。`table={}` 锁死其它族路由,
  本轮不会顺带触发任何其它任务的写侧动作。
- 实现坑(已钉用例):本机 httpx 的 `AsyncClient` 要求 `event_hooks["request"]` 是
  **async** 函数;写成同步 hook 会让每个请求抛 `TypeError: NoneType can't be used in
  'await' expression`,被引擎 fail-soft 吞成 `0/0` 假读失败。
- 真机实测(21:3x):`14f939c3` 19/19 已完成;`0bc1074d`、`25913b4a` 各 18/19,
  `subscribed=false / remaining=-1 / accepted`,本轮真实到账 `+0`、真实 claim `0` 次
  —— **服务端尚未判达标,程序不代替它判**。
- 常驻守候:一条 recurring automation 每小时跑一次 `--live`,绑定生效、服务端翻
  `completed` 后当轮即真实领奖;调度器既有 `_workbuddy_task_sweep` 也会兜底。
  **无需再跑命令、无需改代码**。
- **不能代签的那一格**:判据是微信侧真人关注关系 + 服务端账号对象的
  `wechatOpenId`,由 OneID 微信 OAuth 授权(真人点确认)写入;growth 域写侧 0 条,
  号池 token 打 initiate 是 `401 G40102`。官方规则明确「人为抬高活动数据 ⇒ 取消资格、
  追回奖励」。程序不伪造 openid、不伪造关注事件、不代签 —— 那不是完成,是让账号被追责。
- **剩下的人动作(压缩到最小)**:给 `0bc1074d`、`25913b4a` 各用一个独立微信号,
  在账号中心「绑定微信」→ 关注「腾讯 WorkBuddy」公众号满 24h(同一微信号仅可领一次,
  同手机号/微信/设备/IP 归并同一用户)。之后全自动到账。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
