$root = 'D:\IHUI-AI-wt\gap-screens'
$src = Join-Path $root 'packages\api-client\src\endpoints\status.ts'
$lines = [System.IO.File]::ReadAllLines($src)
$head = $lines[0..2]
$tail = $lines[-1]
$enc = New-Object System.Text.UTF8Encoding($false)
$files = @(
  'packages\api-client\src\endpoints\student.ts',
  'packages\app\src\features\student\student-styles.ts',
  'packages\app\src\features\student\ListPager.tsx',
  'packages\app\src\features\student\StudentCenterScreen.tsx',
  'packages\app\src\features\student\MyCommentsScreen.tsx',
  'packages\app\src\features\student\MyLessonsScreen.tsx',
  'packages\app\src\features\student\MyResourcesScreen.tsx',
  'packages\app\src\features\student\OfflineRecordsScreen.tsx',
  'apps\mobile-rn\src\screens\StudentCenterScreen.tsx',
  'apps\mobile-rn\src\screens\MyCommentsScreen.tsx',
  'apps\mobile-rn\src\screens\MyLessonsScreen.tsx',
  'apps\mobile-rn\src\screens\MyResourcesScreen.tsx',
  'apps\mobile-rn\src\screens\OfflineRecordsScreen.tsx'
)
foreach ($f in $files) {
  $p = Join-Path $root $f
  $body = [System.IO.File]::ReadAllLines($p)
  if ($body[0] -eq $head[0]) { Write-Output ('SKIP already watermarked: ' + $f); continue }
  $out = @()
  $out += $head
  $out += ''
  $out += $body
  $out += $tail
  [System.IO.File]::WriteAllLines($p, $out, $enc)
  Write-Output ('OK: ' + $f)
}
