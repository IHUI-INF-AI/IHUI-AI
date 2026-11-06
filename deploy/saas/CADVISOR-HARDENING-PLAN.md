<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# cAdvisor / admin-api 容器权限整改方案(需生产窗口)

> 状态:**未执行**。本文件是带回滚步骤的整改方案,不是已完成变更。
> 触发项:P2-4 复核时确认 `deploy/saas/docker-compose.yml` 存在两处高权限面:
> cAdvisor `privileged: true` + `/dev/kmsg`,admin-api 挂载 `/var/run/docker.sock` **读写**。
> 二者都属"能自证才改"的范畴——本机无 docker、无生产等价负载,盲改会把
> "指标变少/客户容器管理失效"这类损失藏进灰度期,故只出方案,留生产窗口执行。

## 1. 现状(证据)

- cAdvisor:`deploy/saas/docker-compose.yml` 的 `cadvisor` 服务 —— `privileged: true`、
  `devices: /dev/kmsg`、`--docker_only=true`、`--port=8808`,卷
  `/:/rootfs:ro`、`/var/run:ro`、`/sys:ro`、`/var/lib/docker:ro`、`docker.sock:ro`。
- admin-api:同文件 `admin-api` 服务 —— `/var/run/docker.sock:/var/run/docker.sock`(**无 `:ro`**),
  `./scripts` 以 `:ro` 挂入,脚本直接调 `docker` 做客户容器 create/pause/resume/backup/restore/destroy。

## 2. 目标

1. 收掉 cAdvisor 的 `privileged: true`(先做,风险低);
2. 把 admin-api 的 docker.sock 直挂改成 **socket-proxy 白名单**(后做,风险高);
3. 任何一步都可**单步回滚**,且回滚判据是"指标/接口与改动前等价",不是"容器起来了"。

## 3. 阶段 A:cAdvisor 去 privileged(建议先做)

### 3.1 变更

```yaml
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:v0.49.1
-   privileged: true
    devices:
      - /dev/kmsg
    # 其余 volumes/command 不动
```

保留 `/dev/kmsg` 设备映射(它本身已是最小授权,不依赖 privileged);若去掉 privileged
后 `devices` 也被拒绝启动,则**连同 devices 一起移除**(见 3.3 的指标损失清单)。

### 3.2 去掉 privileged 后可能丢的指标(必须先知道会丢什么)

cAdvisor 的 `privileged` 主要买三样东西,去掉后按项核对:

| 能力                          | 依赖                                     | 去掉后受影响的面                                                                                |
| ----------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 读 `/dev/kmsg`(内核日志)      | 设备权限(privileged 放大)                | `container_oom_events_total`(OOM 事件计数)、部分 `machine_*` 内核类指标                         |
| 全量 `/dev` 与全部 capability | privileged                               | 设备插件类指标(如某些 GPU/NVMe 采集器);纯 Docker 容器指标不受影响                               |
| 宿主机 cgroup/`/sys` 的越权读 | privileged(部分宿主 SELinux/AppArmor 下) | 若 ro 挂载已被策略挡住,`container_cpu_*`/`container_memory_*` 可能采不到;多数发行版 ro 挂载足够 |

**不受影响(高置信)**:`--docker_only=true` 下的 `container_cpu_usage_seconds_total`、
`container_memory_working_set_bytes`、`container_fs_reads/writes_bytes_total`、
`container_network_receive/transmit_bytes_total`、`container_spec_*` —— 这些走
`/var/lib/docker` + `/proc` + `/sys` 只读挂载。

### 3.3 验证"没丢"的方法(改前改后各采一次,做差集)

1. **指标族快照**(改前):
   ```bash
   curl -s http://127.0.0.1:8808/metrics | grep -E '^# (HELP|TYPE)' | awk '{print $3}' | sort -u > /tmp/cadvisor-before.txt
   curl -s http://127.0.0.1:8808/metrics | grep -v '^#' > /tmp/cadvisor-before-values.txt
   ```
2. 改 compose → `docker compose up -d --force-recreate cadvisor`,等 `healthcheck` 转 healthy
   (`docker inspect --format '{{.State.Health.Status}}' ihui-saas-cadvisor`)。
3. **指标族快照**(改后)按同法存 `/tmp/cadvisor-after.txt`。
4. 判据:
   - `diff /tmp/cadvisor-before.txt /tmp/cadvisor-after.txt` **只允许出现**上表"可能丢"的族;
     出现任何 `container_cpu_*` / `container_memory_*` / `container_fs_*` / `container_network_*`
     缺失 ⇒ **判失败,立即回滚**。
   - Prometheus 侧:改前 24h 的 `container_*` 序列在改后 30min 内仍在增长(至少覆盖
     `container_cpu_usage_seconds_total`、`container_memory_working_set_bytes` 两条)。
   - Grafana 既有面板逐块目视:CPU/内存/磁盘/网络四类曲线无 "No data"。
5. 若确认只剩 `container_oom_events_total` 缺失:接受该损失并在监控文档登记
   (OOM 事件可由宿主机 `journalctl -k` / Windows 对应事件源旁路覆盖)。

### 3.4 回滚(阶段 A)

1. 恢复备份:`cp deploy/saas/docker-compose.yml.bak deploy/saas/docker-compose.yml`
   (改动前 `cp docker-compose.yml docker-compose.yml.bak` 留档)。
2. `docker compose up -d --force-recreate cadvisor`。
3. 复采 `/tmp/cadvisor-rollback.txt`,与 `cadvisor-before.txt` 做 diff,要求**零差异**。
4. 回滚判据:healthcheck 转 healthy、指标族集合与改前一致、Prometheus 序列恢复增长。

## 4. 阶段 B:admin-api 的 docker.sock 改 socket-proxy 白名单

### 4.1 变更

新增 `docker-socket-proxy`(推荐 `tecnativa/docker-socket-proxy`),只放行脚本真正用到的端点:

```yaml
docker-proxy:
  image: tecnativa/docker-socket-proxy:0.2
  container_name: ihui-saas-docker-proxy
  restart: unless-stopped
  environment:
    - CONTAINERS=1 # create/start/stop/inspect/rm 都走这里
    - IMAGES=0
    - VOLUMES=1 # 客户卷备份/恢复
    - NETWORKS=1
    - EXEC=0
    - POST=1
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
  networks:
    - ihui-saas-net
```

admin-api:

```yaml
-   - /var/run/docker.sock:/var/run/docker.sock
+   # 不再直挂宿主 socket;脚本走白名单代理
+   - DOCKER_HOST=tcp://docker-proxy:2375
```

`deploy/saas/scripts/*.sh` 需确认全部使用 `docker` CLI(会读 `DOCKER_HOST`)而非硬编码
`socket` 路径;有 `docker compose` 调用时,compose 也需要能访问同一 `DOCKER_HOST`。

### 4.2 为什么不由本机盲改

- 放行端点一旦漏配(如 `EXEC` / `IMAGES`),create/restore 会在生产窗口才失败,且失败点
  在客户生命周期脚本中段(可能已创建工作目录/半成品容器)。
- 需要先用 `docker events` + 脚本清单核对端点矩阵,再在灰度客户上跑一遍
  create→pause→resume→backup→restore→destroy 全链。

### 4.3 验证

1. 端点矩阵核对:对每个脚本列出调用的 `docker` 子命令,映射到代理环境变量白名单。
2. 灰度客户全链:在 1 个非关键客户上跑完整生命周期,逐步比对
   `docker ps -a` / 卷列表 / 备份目录 与直连 socket 时的结果**完全一致**。
3. 反例:显式调用未放行端点(如 `docker exec`)必须被代理拒绝(HTTP 403),证明白名单生效。
4. admin-api healthcheck 与 `/admin/api/customers` 列表接口在改后仍返回正常。

### 4.4 回滚(阶段 B)

1. 恢复 `docker-compose.yml.bak`,移除 `docker-proxy` 服务。
2. `docker compose up -d --force-recreate admin-api`。
3. 判据:客户列表接口 200、`docker ps -a` 计数与改前一致、任一客户 pause/resume 成功。
4. 保留旧 `docker-compose.yml.bak` 至少一个发布周期再删。

## 5. 执行顺序与准入

| 阶段            | 前置                  | 窗口            | 回滚耗时 | 失败影响                     |
| --------------- | --------------------- | --------------- | -------- | ---------------------------- |
| A 去 privileged | 指标基线快照已留档    | 低峰 30min      | < 5min   | 指标缺失,监控盲区(可回滚)    |
| B socket 代理   | 端点矩阵+灰度客户清单 | 独立窗口,需值班 | < 10min  | 客户生命周期接口失败(可回滚) |

**本仓库本次不改这两项**;执行时另开变更单,按上面的验证/回滚步骤逐阶段落地。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
