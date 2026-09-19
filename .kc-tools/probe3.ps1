$remote = @'
Write-Output '=== FIND APP DEPLOY DIRS ==='
Get-ChildItem 'D:\DevEnv' -Directory -ErrorAction SilentlyContinue | Select-Object FullName | Format-Table -AutoSize
# look for .env files referencing OIDC or CORS anywhere under likely deploy roots
Get-ChildItem 'D:\' -Filter '.env*' -Depth 4 -File -ErrorAction SilentlyContinue | Select-Object FullName -First 40 | Format-Table -AutoSize
Write-Output '=== CLOUDFLARED TOKEN FILE ==='
Get-Content 'C:\ProgramData\cloudflared\token' -ErrorAction SilentlyContinue
Write-Output '=== PORT PROCS (8801/8802/8803) ==='
foreach($p in 8801,8802,8803){
  $proc = netstat -ano | Select-String (":"+$p+"\s") | Select-String 'LISTENING' | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -First 1
  if($proc){ $x=Get-Process -Id $proc -ErrorAction SilentlyContinue; Write-Output ("${p}: PID=$proc NAME=" + $x.ProcessName + " PATH=" + $x.Path) }
}
'@
$b64 = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($remote))
$ps = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
ssh -i C:/Users/Administrator/.ssh/ihui_ssh ssh.aizhs.top "$ps -NoProfile -NonInteractive -EncodedCommand $b64" 2>&1