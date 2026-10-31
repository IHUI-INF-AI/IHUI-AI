<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 队列属于数据库:RELAY 号池队列的库身份隔离

> 立档:2026-10-31。因由是一次**真实停摆**——隔离栈换了库、没换队列,替主库跑了 7 天作业,
> 全部失败。这份文档是那不变量、那套规则、以及「下次写夹具时照抄什么」的唯一出处。

## 1. 不变量

**队列属于数据库;队列名必须能表达库身份。**

一句话的例子:一个连 `ihui_e2e` 的隔离实例,应该消费 `relay-account-pool-queue-ihui_e2e`,
它**碰不到**主库的 `relay-account-pool-queue`;反过来,主库实例也永远看不到隔离库的作业。
库是哪一个,队列名就该说清楚是哪一个。

**分隔符为什么是连字符而不是冒号:** BullMQ 的 `QueueBase` 构造时对队列名里出现 `:` 直接
`throw new Error('Queue name cannot contain :')`——用冒号会让隔离栈的 API 在 worker 启动那一步
整进程崩掉(2026-10-31 实测于 `e2e-local-supply.mjs --stack`)。落库身份的键形态由 BullMQ 自己
拼(`bull:<队列名>:<列表>`),冒号出现在那一层是合法的,不该把它抄进队列名。
顺带一个好处:`bull:relay-account-pool-queue-*` 这条扫描模式**不会**再误伤主库队列
(`bull:relay-account-pool-queue:…`),清理隔离残留时不必再逐条目检。

为什么这条必须以**队列名**为载体,而不是「记得配一下 `REDIS_URL`」:
Redis 是共享的,`DATABASE_URL` 却是每个进程各自覆盖的。只换库不换 Redis,同一个队列名就同时
挂在两套库上,谁先连上谁消费——**作业跑在哪套库上,取决于进程启动顺序,不取决于写代码的人想让它跑哪**。
队列名带上库身份之后,这种抢占在结构上就不成立了(名字不同 = 两条队列)。

## 2. 规则表

| 档 | 触发条件 | 队列名 | 备注 |
| --- | --- | --- | --- |
| ① 显式后缀 | 设了 `RELAY_QUEUE_SUFFIX=<suffix>` | `relay-account-pool-queue-<suffix>` | 最高优先级;写什么就是什么(后缀里带了冒号一律换成连字符,不让启动崩在 BullMQ 构造器里) |
| ② 隔离库自动后缀 | 未设 ①,且 `DATABASE_URL` 的库名命中下面的隔离判据,且库名 ≠ 主库名 | `relay-account-pool-queue-<库名>` | 兜底自动隔离:新写的夹具不改代码也不会抢主库队列 |
| ③ 主库零扰动 | 未设 ①,库名等于主库名(默认 `ihui`),或库名不命中隔离判据 | `relay-account-pool-queue`(不变) | 生产/主库行为**零变化**,不给存量加风险 |

**隔离库判据正则(原文,大小写不敏感):**

```js
/(^|[_-])(e2e|test|testing|ci|tmp|temp|perf\d*|sandbox|scratch)([_-]|$)/i
```

它匹配的是**库名**,不是完整 DSN:`ihui_e2e`、`ihui-test`、`perf3`、`ihui_ci_2` 命中;
`ihui`、`ihui_prod`、`ihui_e2e2`(后缀不是独立词段)不命中。

**主库名覆盖变量:** `RELAY_PRIMARY_DB_NAME`(默认 `ihui`)。当某台机器的生产库不叫 `ihui`
时用它显式指定;规则是「库名 ≠ 主库名 **才** 允许自动后缀」——同名库永远走 ③,避免把生产
队列改名成 `relay-account-pool-queue-ihui` 而造成「改名即丢存量作业」。

## 3. 隔离栈 / e2e 启动清单(写夹具时照抄)

**只要你在子进程 env 里换了 `DATABASE_URL`,就必须同时做下面二者之一:**

1. **换 `REDIS_URL`(推荐)** —— 另起一个 db index(如 `redis://127.0.0.1:6379/9`)或独立实例。
   最彻底:隔离栈连自己的 Redis,连「忘了改队列名」这种错都抢不到主库作业。
2. **设 `RELAY_QUEUE_SUFFIX`** —— 保留同一个 Redis,但队列名变成
   `relay-account-pool-queue-<后缀>`。适合「想共用 Redis、只想分队列」的场景。

另外两条纪律:

- **退出时清掉自己队列的残留作业。** 隔离栈被 Ctrl+C 掉时,BullMQ 里可能留着
  `waiting/delayed/active` 的作业;下次同后缀启动会捡起来跑。清理示例:
  `redis-cli -n <db> --scan --pattern 'bull:relay-account-pool-queue-<suffix>:*' | xargs -r redis-cli -n <db> del`
  (Windows 无 `xargs` 时用 `redis-cli -n <db> keys 'bull:relay-account-pool-queue-<suffix>:*'` 逐个删)。
- **不要「只换个库名变量」就当作隔离完了。** 换了库、继承 Redis = 事故档里那条路,一步没差。

反例(2026-10-24 事故现场,`.ihui-agent/tmp/perf5` 的原形):

```js
// ✗ 只换库,Redis 与队列名原样继承 ⇒ 该实例的 worker 会去抢主库的号池巡检作业
env: { ...process.env, DATABASE_URL: dsn, PORT: String(API_PORT), TURNSTILE_SECRET_KEY: '' }
```

正例(两种都行):

```js
// ✓ 换 Redis(推荐):隔离栈有自己的队列空间
env: { ...process.env, DATABASE_URL: dsn, REDIS_URL: 'redis://127.0.0.1:6379/9' }

// ✓ 只换后缀:同一个 Redis,不同队列名
env: { ...process.env, DATABASE_URL: dsn, RELAY_QUEUE_SUFFIX: 'e2e' }
```

## 4. 事故档:2026-10-24 ~ 10-31 号池保活停摆 7 天

**现象。** 号池巡检(`sweep`)连续 7 天全部失败,`failed` 队列被打满 500 条上限,
号池保活事实上停摆;主库的 `relay-account-pool-queue` 上看起来「有 worker 在跑」,
但作业没有一份成功。

**因果链。**

1. `.ihui-agent/tmp/perf5` 起了一次性 e2e 隔离栈,把子进程的 `DATABASE_URL` 换成隔离库
   `ihui_e2e`;`REDIS_URL` 未覆盖,继承主库那份。
2. 该栈起的 API 进程加载了 BullMQ worker,按队列名 `relay-account-pool-queue` 注册消费者。
3. 于是这条队列同时有「主库 API」和「隔离栈 API」两个消费者——**谁抢到算谁的**。
4. 隔离栈的 worker 抢到了每 5 分钟一轮的号池巡检作业,在
   **缺列的 `ihui_e2e`** 上执行 ⇒ `sweep` 抛错。
5. BullMQ 按失败重试并把最终失败落进 `failed` 集合,500 条打满后新作业继续失败;
   主库那条队列的巡检能力在这 7 天里等于没有。

**关键证据(当时最容易看错的一点):那段时间唯一在消费主库那条队列的 worker,
其实是隔离栈。** 所以「主库服务没停、日志里也有 worker 在跑」这个表象是真的,
但它证明不了作业跑在主库上——它只证明「有进程连着同名的队列」。

**根因不是「忘了配 Redis」,** 而是队列身份与库身份脱钩:换了库之后,队列名一个字符都没变。
这也就是本文 §1 那条不变量的来历,以及门 276 存在的理由。

## 5. 排障:确认当前实例消费的是哪条队列

**① 看启动日志。** 号池队列解析后会打印一行 `relay-account-pool queue resolved`:

| 字段 | 含义 |
| --- | --- |
| `queue` | 实际队列名,如 `relay-account-pool-queue-ihui_e2e` |
| `dbName` | 从 `DATABASE_URL` 解析出的库名 |
| `isolated` | 是否走了隔离后缀(`true/false`) |
| `reason` | 为什么取这个名:`explicit-suffix`(显式) / `isolated-db`(自动) / `primary`(主库零扰动) |

排查第一步永远是这一行:**`queue` 与 `dbName` 对不上**(例如 `dbName=ihui_e2e` 而
`queue=relay-account-pool-queue`)就是本事故的形状。

**② 看队列里有什么。** 以下命令按你的 Redis db index 调整 `-n`:

```bash
redis-cli -n 0 ZCARD bull:relay-account-pool-queue:failed        # 失败数(事故时是 500)
redis-cli -n 0 ZRANGE bull:relay-account-pool-queue:failed 0 4   # 最近失败的作业 id
redis-cli -n 0 --scan --pattern 'bull:relay-account-pool-queue*' # 这条队列的全部键
```

**③ 判断是不是跨库抢占。** 三个信号同时出现即高度可疑:

- 同一个 Redis 上,`bull:relay-account-pool-queue:*` 与 `bull:relay-account-pool-queue-<某后缀>:*`
  **并存**,而后者本不该在长跑;
- `failed` 里的报错集中在**缺列/缺表**(说明执行环境的库不是主库);
- 主库实例的 worker 日志里,同一时段的作业完成数远低于预期(作业被别人抢走了)。

确认后处置:停掉隔离栈 → 清掉它那条队列的残留键 → 主库侧把 `failed` 里可重放的作业重新入队。

## 6. 守门与豁免

**门 276「🔗 换库未换队列隔离」**(`scripts/guardian-runner.mjs`,当前 `mode: 'warn'` 观察档)。

判据三条(实现:`scripts/check-relay-queue-db-isolation.mjs`):

1. 找 env 覆盖块:`env: { … }`(括号配对取全文)、`Object.assign(process.env, { … })`、
   `process.env.DATABASE_URL = …` 直赋值;
2. 块内出现**换库证据**(`DATABASE_URL:` 键 / `process.env.DATABASE_URL =` / 对该变量的
   字符串替换拼接)⇒ 视为「换了库」;
3. 同一块(或块前后 30 行窗口)必须同时出现 `REDIS_URL` / `RELAY_QUEUE_SUFFIX` /
   `QUEUE_PREFIX` / `BULLMQ_PREFIX` 之一,否则记 violation。隔离证据**在注释里不算数**。

**三档豁免(逐条打印 `skip(reason)`,不静默吞):**

| 档 | 条件 | 适用 |
| --- | --- | --- |
| ① 路径 | `apps/api/tests/` 下、`*.test.*`、`*.spec.*` | 纯单测,不起 worker |
| ② 标记 | 同一块内含 `QUEUE_ISOLATION_EXEMPT` 注释 | 派生的是迁移/守护/种子这类**不起 worker** 的子进程;理由必须写在标记旁,判据只认标记本身,靠 code review 兜 |
| ③ 只读 | 块内出现 `READ_ONLY` | 显式声明这条 env 只做只读用途 |

**用法:**

```bash
node scripts/check-relay-queue-db-isolation.mjs --staged     # 默认档:本次暂存文件(读索引 blob)
node scripts/check-relay-queue-db-isolation.mjs --all        # 全量档:工作树里的启动器目录
node scripts/check-relay-queue-db-isolation.mjs --files a.mjs b.ts
node scripts/check-relay-queue-db-isolation.mjs --self-test  # 17 例,不碰真仓
node --test scripts/tests/check-relay-queue-db-isolation.test.mjs   # 镜像 13 例
```

退出码:`0` 无违规(含豁免 / `NOT_APPLICABLE`);`1` 有违规;`2` 取不到被审面
(`--staged` 且 git 不可用 / 索引里没有本次暂存文件)。

**边界(别把它当运行时隔离证明):** 本门判不出运行时行为——它看不见 `spawn` 之后那个进程
连的是哪台 Redis,也看不见队列名最终解析成什么。它只判**启动器形状**:一眼能看出「这段 env
换了库却没打算换队列」。真正的兜底是 §2 那层自动后缀(队列名携带库身份);门 276 只是让
明显没打算隔离的启动器在提交时被点名。

**为什么现在是 warn 而不是 blocking:** 2026-10-31 全量实测 3611 个文件 / 9 个换库块,
命中 4 文件 5 处,其中 `scripts/check-learn-video-mount.mjs:668` 是门体自检夹具
(env 传给进程内函数、根本没派生进程)的**假阳**——判据只看形状,分不清子进程是 API 还是
纯函数。存量未清、假阳未收之前升 blocking,得到的就是一台与提交无关的恒红门(AGENTS §12e),
唯一结局是逼人跳门。清理路径:逐条按 §3 补隔离或按 ② 档标记豁免,命中降到 0 后再议升档。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
