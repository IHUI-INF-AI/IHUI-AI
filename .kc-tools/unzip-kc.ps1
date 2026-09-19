$remote = @'
$ProgressPreference='SilentlyContinue'
$zip='D:\DevEnv\keycloak-kc.zip'
$root='D:\DevEnv\runtimes'
if(-not (Test-Path $root)){ New-Item -ItemType Directory -Path $root -Force | Out-Null }
try{
  Expand-Archive -LiteralPath $zip -DestinationPath $root -Force
  $out = Join-Path $root 'keycloak-26.1.4'
  if(Test-Path $out){ "UNZIP_OK dir=" + $out }
  else { "UNZIP_NO_DIR" }
}catch{ "UNZIP_ERR " + $_ }
'@
$b64 = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($remote))
$ps = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
ssh -i C:/Users/Administrator/.ssh/ihui_ssh ssh.aizhs.top "$ps -NoProfile -NonInteractive -EncodedCommand $b64" 2>&1