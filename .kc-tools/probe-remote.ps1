$remote = @'
Write-Output '=== JAVA ==='
java -version 2>&1
Write-Output 'JAVA_HOME=' + $env:JAVA_HOME
Write-Output '=== PGSQL ==='
Get-Service -Name '*postgres*' -ErrorAction SilentlyContinue | Select-Object Name,Status | Format-Table -AutoSize
psql --version 2>&1
Write-Output '=== LISTENERS 88xx ==='
netstat -ano | Select-String ':(8801|8802|8803|8080|8443|5432)\s'
Write-Output '=== NSSM SERVICES ==='
nssm 2>&1 | Select-Object -First 1
sc query type= service state= all | Select-String 'SERVICE_NAME' | Select-Object -First 40
Write-Output '=== CLOUDFLARED ==='
Get-Process cloudflared -ErrorAction SilentlyContinue | Select-Object Id,Path | Format-Table -AutoSize
Get-ChildItem 'C:\Windows\System32\config\systemprofile\.cloudflared' -ErrorAction SilentlyContinue
Get-ChildItem "$env:USERPROFILE\.cloudflared" -ErrorAction SilentlyContinue
Write-Output '=== RUN=DISK ==='
Get-PSDrive -PSProvider FileSystem | Select-Object Name,@{n='FreeGB';e={[math]::Round($_.Free/1GB,1)}},@{n='UsedGB';e={[math]::Round($_.Used/1GB,1)}} | Format-Table -AutoSize
'@
$b64 = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($remote))
$ps = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
ssh -i C:/Users/Administrator/.ssh/ihui_ssh ssh.aizhs.top "$ps -NoProfile -NonInteractive -EncodedCommand $b64" 2>&1