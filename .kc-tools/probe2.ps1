$remote = @'
Write-Output '=== CLOUDFLARED SERVICE ==='
sc.exe qc Cloudflared
Write-Output '=== CLOUDFLARED CFG ==='
Get-ChildItem 'C:\Program Files\cloudflared' -ErrorAction SilentlyContinue | Select-Object Name,Length | Format-Table -AutoSize
$candidates=@('C:\Program Files\cloudflared\config.yml','C:\Program Files\cloudflared\.cloudflared\config.yml','C:\Windows\System32\config\systemprofile\.cloudflared\config.yml','C:\Users\Administrator\.cloudflared\config.yml')
foreach($f in $candidates){ if(Test-Path $f){ Write-Output ("--- "+$f); Get-Content $f } }
Write-Output '=== POSTGRES ==='
Get-Service -Name '*postgres*' -ErrorAction SilentlyContinue | Select-Object Name,Status,StartType | Format-Table -AutoSize
sc.exe qc postgresql-x64-18 2>&1
netstat -ano | Select-String '5432'
Write-Output '=== PGPASS / ENV ==='
Get-ChildItem "$env:APPDATA\postgresql\pgpass.conf" -ErrorAction SilentlyContinue
Get-ChildItem 'D:\DevEnv\runtimes\pgsql' -ErrorAction SilentlyContinue | Select-Object Name | Format-Table -AutoSize
'@
$b64 = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($remote))
$ps = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
ssh -i C:/Users/Administrator/.ssh/ihui_ssh ssh.aizhs.top "$ps -NoProfile -NonInteractive -EncodedCommand $b64" 2>&1