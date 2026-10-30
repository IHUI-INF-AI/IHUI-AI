$root = 'D:\IHUI-AI-wt\gap-screens'
$a = [System.IO.File]::ReadAllLines((Join-Path $root 'packages\api-client\src\endpoints\status.ts'))
$headStr = ($a[0..2] -join '|')
$tailStr = $a[-1]
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
  $b = [System.IO.File]::ReadAllLines((Join-Path $root $f))
  $okHead = (($b[0..2] -join '|') -eq $headStr)
  $okTail = ($b[-1] -eq $tailStr)
  Write-Output ("{0} head={1} tail={2}" -f $f, $okHead, $okTail)
}
