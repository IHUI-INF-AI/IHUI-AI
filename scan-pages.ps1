$root = 'g:\IHUI-AI\apps\web'
Get-ChildItem -Path $root -Recurse -Filter 'page.tsx' -ErrorAction SilentlyContinue | ForEach-Object {
  $lc = (Get-Content -LiteralPath $_.FullName | Measure-Object).Count
  if ($lc -gt 250) {
    [PSCustomObject]@{ Lines = $lc; Path = $_.FullName.Substring($root.Length + 1) }
  }
} | Sort-Object Lines -Descending | Format-Table -AutoSize
