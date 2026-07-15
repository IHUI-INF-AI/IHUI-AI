#!/usr/bin/env pwsh
# 测试 admin 账号登录 + 不可变性
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ihui"
$env:JWT_SECRET = "dev-secret-change-in-production-min-32-chars"
$env:REDIS_URL = "redis://localhost:6379"
$env:PORT = "3001"

$api = Start-Process -FilePath "node" -ArgumentList "dist/server.js" -PassThru -NoNewWindow -RedirectStandardOutput "g:\IHUI-AI\api-test-stdout.log" -RedirectStandardError "g:\IHUI-AI\api-test-stderr.log" -WorkingDirectory "g:\IHUI-AI\apps\api"

Start-Sleep -Seconds 5
$log = Get-Content g:\IHUI-AI\api-test-stderr.log -Tail -10 -ErrorAction SilentlyContinue
Write-Host "stderr log:" -ForegroundColor Yellow
$log | ForEach-Object { Write-Host "  $_" }

Write-Host "`n--- 测试 1: admin 登录 ---" -ForegroundColor Cyan
$loginBody = @{ account = "admin"; password = "admin123" } | ConvertTo-Json
$login = Invoke-WebRequest -Uri "http://localhost:3001/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -ErrorAction SilentlyContinue
if ($login) {
  Write-Host "HTTP: $($login.StatusCode)"
  $login.Content | Select-Object -First 3
  $token = ($login.Content | ConvertFrom-Json).data.accessToken
  if ($token) {
    Write-Host "TOKEN LEN: $($token.Length)"

    Write-Host "`n--- 测试 2: GET /api/admin/member/users ---" -ForegroundColor Cyan
    $list = Invoke-WebRequest -Uri "http://localhost:3001/api/admin/member/users?page=1&pageSize=5" -Method GET -Headers @{ "Authorization" = "Bearer $token" } -ErrorAction SilentlyContinue
    if ($list) {
      Write-Host "HTTP: $($list.StatusCode)"
      $list.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3 | Select-Object -First 30
    }

    Write-Host "`n--- 测试 3: 尝试 PATCH system admin(应被拒)---" -ForegroundColor Cyan
    $sysAdmin = ($list.Content | ConvertFrom-Json).data.list | Where-Object { $_.isSystemAdmin -eq $true } | Select-Object -First 1
    if ($sysAdmin) {
      Write-Host "system admin id: $($sysAdmin.id)"
      $patch = Invoke-WebRequest -Uri "http://localhost:3001/api/admin/member/users/$($sysAdmin.id)" -Method PATCH -ContentType "application/json" -Headers @{ "Authorization" = "Bearer $token" } -Body '{"status":0}' -ErrorAction SilentlyContinue
      if ($patch) {
        Write-Host "HTTP: $($patch.StatusCode) (期望 403)"
        $patch.Content
      }
    }

    Write-Host "`n--- 测试 4: 尝试 DELETE system admin(应被拒)---" -ForegroundColor Cyan
    if ($sysAdmin) {
      $del = Invoke-WebRequest -Uri "http://localhost:3001/api/admin/member/users/$($sysAdmin.id)" -Method DELETE -Headers @{ "Authorization" = "Bearer $token" } -ErrorAction SilentlyContinue
      if ($del) {
        Write-Host "HTTP: $($del.StatusCode) (期望 403)"
        $del.Content
      }
    }

    Write-Host "`n--- 测试 5: 验证系统管理员行 password_hash 不在响应中 ---" -ForegroundColor Cyan
    $detail = Invoke-WebRequest -Uri "http://localhost:3001/api/admin/member/users/$($sysAdmin.id)" -Method GET -Headers @{ "Authorization" = "Bearer $token" } -ErrorAction SilentlyContinue
    if ($detail) {
      $body = $detail.Content | ConvertFrom-Json
      $hasHash = $body.data.PSObject.Properties.Name -contains "passwordHash" -or $body.data.PSObject.Properties.Name -contains "password_hash"
      Write-Host "HTTP: $($detail.StatusCode)"
      Write-Host "包含 passwordHash: $hasHash (期望 False)"
      Write-Host "isSystemAdmin 字段: $($body.data.isSystemAdmin) (期望 True)"
    }
  }
}

Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue
Write-Host "`n--- 测试完成 ---" -ForegroundColor Green
