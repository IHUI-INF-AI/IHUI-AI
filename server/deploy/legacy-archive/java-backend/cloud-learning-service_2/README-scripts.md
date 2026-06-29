# 微服务启动脚本

## 一键启动

```powershell
cd g:\edu\service\service

# 启动所有服务（带监测）
powershell -ExecutionPolicy Bypass -File .\start.ps1

# 快速启动（跳过监测）
powershell -ExecutionPolicy Bypass -File .\start.ps1 -Fast

# 停止所有服务
powershell -ExecutionPolicy Bypass -File .\start.ps1 -Stop

# 查看服务状态
powershell -ExecutionPolicy Bypass -File .\start.ps1 -Status
```

## 脚本说明

| 脚本 | 用途 |
|------|------|
| `start.ps1` | 一键启动/停止/状态查询 |

## 端口映射

| 服务 | 端口 | 服务 | 端口 |
|------|------|------|------|
| gateway | 6600 | circle | 6611 |
| auth | 6601 | behavior | 6612 |
| member | 6602 | pay | 6613 |
| usercenter | 6603 | point | 6614 |
| setting | 6604 | message | 6615 |
| resource | 6605 | notification | 6616 |
| content | 6606 | oss | 6617 |
| learn | 6607 | search | 6618 |
| live | 6608 | schedule | 6619 |
| exam | 6609 | visit-tracking | 6620 |
| ask | 6610 | order | 6621 |
