$remote = @'
$ProgressPreference='SilentlyContinue'
$u='https://gh-proxy.com/https://github.com/keycloak/keycloak/releases/download/26.1.4/keycloak-26.1.4.zip'
$sw=[Diagnostics.Stopwatch]::StartNew()
curl.exe -sL --max-time 15 -o D:\DevEnv\kc_speed.bin -r 0-5242879 $u 2>&1
$sw.Stop()
$sz=(Get-Item D:\DevEnv\kc_speed.bin).Length
"ELAPSED_MS=$($sw.ElapsedMilliseconds) BYTES=$sz SPEED_KBPS=$([math]::Round($sz/1024/($sw.ElapsedMilliseconds/1000),1))"
del D:\DevEnv\kc_speed.bin -Force -ErrorAction SilentlyContinue
'@
$b64 = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($remote))
$ps = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
ssh -i C:/Users/Administrator/.ssh/ihui_ssh ssh.aizhs.top "$ps -NoProfile -NonInteractive -EncodedCommand $b64" 2>&1