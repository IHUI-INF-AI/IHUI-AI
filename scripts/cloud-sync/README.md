<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

<!-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top · 许可: Apache-2.0 -->

# 无头云同步通道部署 / 运维手册（AList + WebDAV + rclone）

> 适用对象：P5「网盘同步客户端」的无头（headless / 会话 0 服务）部署场景。
> 配套实现：`scripts/cloud-sync/rclone-baidu-sync.mjs`（执行一次 sync + 健康判定）、`scripts/cloud-sync/heal-cloud-sync.mjs`（自愈入口）。

---

## 1. 为什么需要无头通道

原 P5 云同步依赖图形客户端 `BaiduNetdisk.exe`。在无人值守的守护环境（Windows 服务 / 会话 0 身份）里，守护进程**确实能拉起** `BaiduNetdisk.exe`，但它检测到自己处在无头会话后会**立即退出**，无法长期驻留。结果：

- 云同步这一步在无头环境**恒不成立**，P5 反复判红 → 反复报警；
- GUI 自愈 `healBaiduSync` 只能「尽力再拉一次」，同样立退，治标不治本。

**关键事实**：`rclone` 原生**不支持**百度网盘——其官方后端列表中没有 `Baidu` 后端，因此无法直接用 `rclone sync` 对接百度网盘。

**解决思路**：用 **AList 做中转**。AList 把百度网盘挂载并暴露为 **WebDAV** 服务，`rclone` 以 `type = webdav` 接入，再定时跑 `rclone sync`。整条链路无人值守，只有**百度授权这一步需要人机交互一次**（在 AList 内完成，refresh token 由 AList 持久化落盘）。其余（定时同步、健康检测、自愈触发）全部自动化。

---

## 2. 架构

本地数据通过 `rclone sync` 推到 AList 暴露的 WebDAV，AList 再落地到百度网盘；守护进程每 2 分钟巡检一次 P5，发现云同步不健康即触发自愈（自愈本身只「尝试」，不伪造成功）。

```
┌──────────────┐      rclone sync (webdav)      ┌──────────────────────┐      ┌─────────────────┐
│  本地源目录   │ ───────────────────────────▶   │  AList (WebDAV 服务)  │ ───▶ │   百度网盘        │
│  (LOCAL_DIRS)│   rclone.exe → AList /dav      │  127.0.0.1:5244/dav   │      │  /IHUI-AI-outbound│
└──────────────┘                                  └──────────────────────┘      └─────────────────┘
       │                                                  ▲                            ▲
       │                                                  │                            │
       └──── 凭证链路 ───────────────────────────────────┘                            │
            rclone 只用 WebDAV 账号密码;百度 refresh token 只在 AList 内持久化一次      │
                                                                (人机一次授权) ────────┘

┌──────────────── 守护 / 自愈 (每 ~2 分钟巡检 P5) ────────────────┐
│  P5 判定 red/green                                                 │
│    ├─ headless 模式(已启用):running = syncHealth.healthy           │
│    └─ gui 模式(未启用): 回退 baiduSyncRunning()                     │
│  不健康 ⇒ heal-cloud-sync:节流(30min)→[AList 不可达? net start]→runSync│
│    ⇒ 返回 attempted,verified:null(由下一轮独立判定)                │
└──────────────────────────────────────────────────────────────────┘
```

要点：

- **rclone 不持有任何百度凭证**，只持有 AList 的 WebDAV 用户名 / 密码；
- **百度授权只在 AList 内做一次**（人机一次），token 由 AList 持久化，重启后无需重授权；
- 自愈**不伪造成功**：一次 sync 是否真的「留得住」，由独立运行的下一轮 `syncHealth` 用状态文件判定。

---

## 3. 部署步骤

> 以下步骤可直接照做。涉及 AList 内部表单参数（refresh token / 扫码登录 / WebDAV 账号）的精确填法，以 **AList 官方文档**为准，本文不臆造。

### a. 安装 rclone

- 下载 **Windows 64 位** 的 `rclone.exe`，放到已在服务 PATH 中的目录（例如 `C:\Windows\System32` 或某专用 bin 目录）。
- 或在 prod 的 `.env` 里用 `IHUI_CLOUD_SYNC_RCLONE_BIN` 指定其**完整路径**（如 `C:\tools\rclone\rclone.exe`），这样服务身份也能稳定找到它。
- 验证（在将运行同步的服务身份下执行，而非仅当前交互用户）：

```powershell
& rclone --version
```

若报「不是内部或外部命令 / 找不到」，说明 PATH 或服务身份看不到该 bin，改用上面的完整路径环境变量。

### b. 以 nssm 部署 AList 服务

AList 必须是**常驻服务**（不能用交互式一次启动，否则会话 0 下同样不可靠）。用 nssm 注册成 Automatic 自启服务：

```powershell
nssm install AList "C:\path\to\alist.exe"
nssm set AList Start SERVICE_AUTO_START
nssm start AList
```

- 服务名即 `AList`（与 `IHUI_CLOUD_SYNC_ALIST_SERVICE` 默认值一致；若改名需同步改该环境变量）。
- 启动后打开 AList Web 管理页（默认 `http://127.0.0.1:5244`），后续步骤 c / d 都在该页面内完成。

> 注：AList 默认 WebDAV 路径为 `/dav`，本文所有 `url` 默认即 `http://127.0.0.1:5244/dav`，与 `IHUI_CLOUD_SYNC_ALIST_URL` 默认值一致。

### c. 在 AList 添加百度网盘存储（**必须人机交互一次**）

- 在 AList 管理页「存储」中添加「百度网盘」类型存储；
- 按 **AList 官方文档**填写百度授权信息（refresh token 或扫码登录二选一，以当前 AList 版本文档为准）；
- 这一步是整条链路里**唯一需要人操作**的环节：`refresh token` 由 AList 持久化保存，之后服务重启无需再次人工介入。

### d. 配置 AList 的 WebDAV 账号密码

- 在 AList 管理页设置 WebDAV 访问的账号 / 密码（具体入口以 AList 官方文档为准）；
- 在 rclone 侧配置一个名为 `baidu`（或你自定义的 remote 名，对应 `IHUI_CLOUD_SYNC_REMOTE`）的 WebDAV remote，关键字段：

```ini
[baidu]
type = webdav
url = http://127.0.0.1:5244/dav
vendor = other
user = <AList WebDAV 账号>
pass = <AList WebDAV 密码>
```

- `vendor` 选 `other`（AList 的 WebDAV 实现不属于 rclone 内置的知名厂商预设）；
- `user` / `pass` 用步骤 c 中设置的 AList WebDAV 账号密码。

### e. 验证 remote 可达

```powershell
rclone lsd baidu:
```

能列出远端目录即说明 AList → 百度网盘链路通。

### f. 先 dry-run 校验，再正式启用

```powershell
# 用你实际要同步的本地目录做一次空跑校验(不真传)
rclone sync "C:\path\to\local" baidu:/IHUI-AI-outbound --dry-run
```

确认 dry-run 无报错、目录结构符合预期后，再在 `.env` 里把 `IHUI_CLOUD_SYNC_ENABLED` 设为 `1` 并重启守护，让正式 sync 接管。

---

## 4. 环境变量配置清单

所有环境变量写入 **prod 的 `.env`**（该文件被 `gitignore`，**不进版本库**，需在每台 prod 机器上手动同步）。未设置的项取下表「默认值」。

| 环境变量                           | 默认值                                     | 作用                                                                           |
| ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| `IHUI_CLOUD_SYNC_ENABLED`          | `0`                                        | 设为 `1` 启用无头通道。未启用时 P5 回退原 GUI 判据、自愈回退 `healBaiduSync`。 |
| `IHUI_CLOUD_SYNC_LOCAL_DIRS`       | （空，必填）                               | 分号 `;` 分隔的本地源目录列表。为空则 sync 直接判失败。                        |
| `IHUI_CLOUD_SYNC_REMOTE`           | `baidu`                                    | rclone 的 webdav remote 名（须与步骤 d 中 `[baidu]` 段名一致）。               |
| `IHUI_CLOUD_SYNC_REMOTE_PATH`      | `/IHUI-AI-outbound`                        | 远端目录路径（推到百度网盘的目标位置）。                                       |
| `IHUI_CLOUD_SYNC_ALIST_URL`        | `http://127.0.0.1:5244/dav`                | AList 的 WebDAV 地址；健康检测与自愈都探它。                                   |
| `IHUI_CLOUD_SYNC_ALIST_SERVICE`    | `AList`                                    | AList 的 Windows 服务名；自愈在 AList 不可达时尝试 `net start` 它。            |
| `IHUI_CLOUD_SYNC_RCLONE_BIN`       | `rclone`                                   | rclone 可执行文件；默认走 PATH，可改为完整路径（服务身份找不到 PATH 时用）。   |
| `IHUI_CLOUD_SYNC_INTERVAL_MS`      | `6h`（21600000）                           | 健康阈值：超过此值**无一次成功 sync** 即判不健康。                             |
| `IHUI_CLOUD_SYNC_HEAL_INTERVAL_MS` | `30min`（1800000）                         | 自愈节流窗口：窗口内不重复触发 sync，防拉起风暴。                              |
| `IHUI_CLOUD_SYNC_BWLIMIT`          | `5M`                                       | rclone 带宽上限（如 `5M` = 5 MiB/s）。                                         |
| `IHUI_CLOUD_SYNC_TRANSFERS`        | `4`                                        | rclone 并发传输数（`--transfers`）。                                           |
| `IHUI_CLOUD_SYNC_CHECKERS`         | `8`                                        | rclone 并发校验数（`--checkers`）。                                            |
| `IHUI_CLOUD_SYNC_STATE_FILE`       | `.ihui-agent/state/cloud-sync-status.json` | 状态文件路径（健康判定的真源）。                                               |

> 提示：状态文件所在的 `.ihui-agent/state/` 目录会被脚本自动创建（`mkdir -p` 语义）；rclone 的运行日志 `rclone-sync.log` 默认落在**同一目录**下（见第 6 节）。

---

## 5. 健康检测与自愈

### 5.1 P5 行两种模式的红绿判定

`cloudSyncHealthy()` 作为 P5 行的统一入口，按 `IHUI_CLOUD_SYNC_ENABLED` 分两种模式：

- **gui 模式（未启用，`ENABLED≠1`）**：返回 `running: null, mode: 'gui'`，由 P5 dispatch 回退到原 GUI 判据 `baiduSyncRunning()`（即探 `BaiduNetdisk.exe` 是否在跑）。无头通道完全不介入。
- **headless 模式（已启用）**：`running = syncHealth().healthy`，即「最近一次成功 sync 距今是否 ≤ `INTERVAL_MS`」。`mode: 'headless'`，并附带 `lastSuccessTs / staleHours / rcloneAvailable / alistReachable`。

### 5.2 自愈如何触发、为何「不伪造成功」

`heal-cloud-sync.mjs` 的契约：

1. 未启用 ⇒ 直接 `skipped`，交回 GUI 自愈；
2. 已启用且已健康（`syncHealth.healthy`）⇒ `alreadyHealthy`，不动；
3. 已启用但不健康 ⇒ 先走 30min 节流判定，未到窗口返回 `throttled`；到窗口则：
   - 若 AList 不可达，先尝试 `net start <ALIST_SERVICE>`（更干净的服务态拉起），再触发 `runSync`；
   - 返回 `{ attempted: true, verified: null, ran: true }`。

**关键**：自愈返回 `verified: null`。它**只声明「尝试过一次 sync」**，绝不说「已修好」。一次 sync 是否真的「留得住」（状态文件里 `lastSuccessTs` 被刷新、且下一轮 `syncHealth` 判绿），由**独立运行的下一轮 `syncHealth`** 来判定。这跟原 `heal-baidu-sync` 的「尽力 + 不伪造成功」契约一致，避免自愈把假绿塞进监控。

### 5.3 30 分钟节流防风暴

自愈写入一个 tick 文件（`.ihui-agent/state/cloud-sync-heal-tick.json`，记录上次触发 ISO 时间）。两次触发间隔 < `HEAL_INTERVAL_MS`（默认 30min）时直接返回 `throttled`，不再重复拉起 / 重复 sync，防止 AList 抖动时守护高频重试把机器打爆。

### 5.4 AList 不可达时先 net start

自愈在跑 sync 前先探 `ALIST_URL`。若不可达，调 `net.exe start <ALIST_SERVICE>` 尝试把 AList 服务拉起来（服务态拉起比在会话里起进程更干净、更稳），之后再触发 sync；若仍不可达，sync 会因 `alistReachable:false` 落败，下一轮节流后重试。

---

## 6. 状态文件

健康判定的真源是状态文件，路径由 `IHUI_CLOUD_SYNC_STATE_FILE` 决定，默认：

```
.ihui-agent/state/cloud-sync-status.json
```

rclone 自身运行日志在同目录：

```
.ihui-agent/state/rclone-sync.log
```

### 6.1 `cloud-sync-status.json` 字段含义

| 字段              | 含义                                                                                  | 排查用法                                          |
| ----------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `lastSuccessTs`   | 最近一次成功 sync 的时间戳（ms）。`null`/缺失 = 从未成功。                            | 红绿核心：与 `INTERVAL_MS` 比较得 `staleHours`。  |
| `lastAttemptTs`   | 最近一次尝试 sync 的时间戳。                                                          | 看自愈是否在动；rclone/AList 不可达时也会被写入。 |
| `lastExit`        | 最近一次 sync 退出码（`0` 成功 / `1` 失败）。                                         | 快速区分成功失败。                                |
| `lastError`       | 最近一次失败原因文本（如「AList WebDAV 不可达」、「本地目录不存在」、部分目录失败）。 | 直接读失败表象。                                  |
| `rcloneAvailable` | rclone 是否可用（`true/false`）。                                                     | `false` ⇒ 见第 7 节「rclone 不可用」。            |
| `alistReachable`  | AList WebDAV 是否可达（`true/false`）。                                               | `false` ⇒ 见第 7 节「AList 不可达」。             |

`syncHealth()` 还会派生：`healthy`(bool)、`staleMs`、`staleHours`、`reason`(不健康原因文本)。

### 6.2 `rclone-sync.log` 字段含义

rclone 的 `--log-file` 输出，记录每次 `rclone sync` 的逐文件传输 / 校验 / 报错明细。状态文件只有结论，这里看过程。**sync 报诡异失败但状态文件 `lastError` 不够细时，先翻这个日志。**

---

## 7. 故障排查

| 表象                                                                              | 可能原因                                            | 处置                                                                                                                                          |
| --------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 状态文件 `rcloneAvailable:false`；或 `rclone --version` 报错                      | rclone 未装 / 服务身份 PATH 找不到                  | 步骤 a：放 bin 到 PATH，或用 `IHUI_CLOUD_SYNC_RCLONE_BIN` 指定完整路径；在服务身份下验证 `--version`。                                        |
| `alistReachable:false`；`rclone lsd baidu:` 超时 / 拒绝连                         | AList 服务没起，或端口/路径不对                     | 自愈会尝试 `net start AList`；也可手动 `nssm status AList` / `net start AList`；确认 `ALIST_URL` 默认 `:5244/dav` 未被改；查 AList 自身日志。 |
| `lastError` 提及 token / 401 / 百度授权失效                                       | 百度 refresh token 过期或被吊销（AList 持久化失效） | **需重新人机授权一次**：按 AList 文档在 AList 管理页重做百度网盘授权，刷新 refresh token。之后自愈下一轮会自动恢复正常。                      |
| 状态文件某目录 `skipped:true, why:"本地目录不存在"`；或整体报「未配置本地源目录」 | `IHUI_CLOUD_SYNC_LOCAL_DIRS` 配错 / 目录被移走      | 核对 `.env` 里 `LOCAL_DIRS` 的分号列表，确保各目录真实存在；不存在的目录会被跳过（不阻断其它目录，但会使本次整体判失败）。                    |
| P5 长期红但自愈 `throttled`                                                       | 处于 30min 节流窗口内                               | 正常节流行为，等窗口过或人工确认后下一轮触发；紧急时可手动跑 `node scripts/cloud-sync/heal-cloud-sync.mjs --json` 看返回。                    |
| 启用后 P5 仍走 GUI 判据                                                           | `IHUI_CLOUD_SYNC_ENABLED≠1`                         | 把 `.env` 里 `ENABLED` 设为 `1` 并重启守护。                                                                                                  |

---

## 8. 与原有 GUI 自愈的关系

两者**互补、不冲突**，由 `IHUI_CLOUD_SYNC_ENABLED` 切换：

- **未启用无头通道**（`ENABLED≠1`）：P5 完全回退到原 GUI 判据 `baiduSyncRunning()`，自愈完全回退 `healBaiduSync`（即尽力拉起 `BaiduNetdisk.exe` 那一套）。对有图形会话的机器，原行为不变。
- **启用无头通道**（`ENABLED=1`）：P5 走 headless 模式，自愈走 `heal-cloud-sync`，不再依赖 `BaiduNetdisk.exe`。

同一时刻只有一条路径生效；无头通道是给**无头服务会话**的彻底替代方案，原 GUI 自愈作为未启用时的回退保留，互不干扰。

---

### 附：机主需补充 / 决策的点

- **AList 安装路径与 nssm 服务名**：步骤 b 中 `alist.exe` 真实路径需按 prod 实际放置填写；若服务名不用 `AList`，须同步改 `IHUI_CLOUD_SYNC_ALIST_SERVICE`。
- **百度授权方式**：refresh token 还是扫码登录，按部署时 AList 版本文档与机主偏好二选一；token 过期后的重授权由机主执行（人机一次）。
- **本地源目录清单**：`IHUI_CLOUD_SYNC_LOCAL_DIRS` 具体要同步哪些目录，由机主按 prod 实际数据位置填写。
- **`.env` 落盘**：prod 的 `.env` 不进版本库，需机主在每台 prod 机器手动写入并随部署同步，确保无头通道在目标机真正启用。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
