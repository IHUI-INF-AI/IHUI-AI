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
  "http://127.0.0.1:8803/api/checkin/accounts/7/tasks"

# 跑一轮(单族 / 全族)
curl -X POST -H "Authorization: Bearer <你的会话令牌>" -H "Content-Type: application/json" \
  -d '{"kind":"all","dry_run":true}' \
  "http://127.0.0.1:8803/api/checkin/accounts/7/task-run"
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
- **上报端点族只有 `/v2/report` 一条。** 真机打 `/v2/report-assistant` 在令牌域与 WEB 域**均 404「404 Route Not Found」**;官方客户端 asar(`G:\workbuddy\resources\app.asar`)内 `v2/report` 命中 9 次、`report-assistant` **0 次**。客户端另有 `reportEndpoint` 选项 ⇒ 真正的「另一个上报端点」是**另一个主机**不是另一个路径(对应本仓 `WORKBUDDY_TASKS_ACTIVITY_HOSTS` 按事件码路由主机)。- **号池账号默认没有浏览器会话。** 现读 5 个 workbuddy 号池账号:`login_type` 全为 `null`、`web_cookie` 全缺。所以「有浏览器会话才计分」这条路在当前号池形态下**根本走不到**;真要有会话,走网页登录取得 `web_cookie` 再落 `device_map`(见 `scripts/sync-workbuddy-client-session.mjs` 会话回灌腿)。
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

## 8. 「专家体验」类成长任务:真客户端驱动(2026-11-05 立)

### 8.1 为什么必须驱动真客户端

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

- **用完必须断开 inspector**:不断 ⇒ 主进程被调试通道占住 ⇒ `taskkill` 不带 `/F` 会失败
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



```bash
node scripts/workbuddy-growth-daily.mjs --checkin                                    # 每日签到
node scripts/workbuddy-growth-experts.mjs --do-all                                   # 行为类任务
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


<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
