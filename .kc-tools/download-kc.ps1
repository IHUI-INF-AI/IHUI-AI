$remote = @'
$ProgressPreference='SilentlyContinue'
# clean leftovers from the killed job
Get-Process curl -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
$dst='D:\DevEnv\keycloak-kc.zip'
Remove-Item $dst -Force -ErrorAction SilentlyContinue
$target=148521809
$urls=@(
  'https://gh-proxy.com/https://github.com/keycloak/keycloak/releases/download/26.1.4/keycloak-26.1.4.zip',
  'https://ghfast.top/https://github.com/keycloak/keycloak/releases/download/26.1.4/keycloak-26.1.4.zip'
)
$ok=$false
foreach($u in $urls){
  for($i=0;$i -lt 8;$i++){
    curl.exe -sL -C - -o $dst $u
    $sz=0
    if(Test-Path $dst){ $sz=(Get-Item $dst).Length }
    if($sz -ge $target){ "DONE $sz"; $ok=$true; break }
    "partial $sz"
    Start-Sleep -Seconds 3
  }
  if($ok){ break }
}
if(-not $ok){ "FAILED" }
'@
$b64 = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($remote))
$ps = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
ssh -i C:/Users/Administrator/.ssh/ihui_ssh ssh.aizhs.top "$ps -NoProfile -NonInteractive -EncodedCommand $b64" 2>&1