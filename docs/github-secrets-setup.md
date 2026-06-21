# GitHub Secrets 配置指南

## 为什么需要配置

CI/CD 流水线（`.github/workflows/ci.yml`）在测试失败时会自动通知钉钉和飞书，但需要先配置 webhook 地址（叫"Secrets"），否则通知功能无法工作。

## 需要配置的 Secrets

| Secret 名称 | 用途 | 获取方式 |
|-------------|------|---------|
| `DINGTALK_WEBHOOK` | 钉钉机器人通知 | 钉钉群 → 群设置 → 智能群助手 → 添加机器人 → 自定义 → 复制 webhook 地址 |
| `FEISHU_WEBHOOK` | 飞书机器人通知 | 飞书群 → 群设置 → 群机器人 → 添加机器人 → 自定义机器人 → 复制 webhook 地址 |
| `STAGING_KUBECONFIG` | staging 部署的 kubeconfig | Kubernetes 集群管理员提供 |
| `PROMETHEUS_URL` | Prometheus 监控地址 | 运维团队提供 |
| `BACKEND_URL` | 后端服务地址 | 运维团队提供 |
| `SHADOW_BASE_URL` | Shadow 对比测试的后端地址 | 运维团队提供 |

## 配置步骤（以钉钉为例）

1. 打开 GitHub 仓库页面（例如 `https://github.com/用户名/仓库名`）
2. 点击 **Settings**（设置）标签
3. 在左侧菜单点击 **Secrets and variables** → **Actions**
4. 点击 **New repository secret** 按钮
5. 在 **Name** 输入框填：`DINGTALK_WEBHOOK`
6. 在 **Secret** 输入框填：你的钉钉 webhook 地址（例如 `https://oapi.dingtalk.com/robot/send?access_token=xxx`）
7. 点击 **Add secret** 保存

飞书配置步骤相同，只是 Name 填 `FEISHU_WEBHOOK`。

## 验证配置

配置完成后，下次提交代码时，如果 CI 失败，钉钉群和飞书群会自动收到失败通知。

## 注意事项

- Secrets 配置后只能看名字，不能再看内容，所以配置前请确认 webhook 地址正确
- 如果不需要通知功能，可以不配置，CI 会自动跳过通知步骤（代码里有判断 `if [ -z "$DINGTALK_WEBHOOK" ]`）
- webhook 地址是敏感信息，不要写在代码里或提交到 git 仓库
