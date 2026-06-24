Get-ChildItem -Path 'g:\IHUI-AI\client\src' -Recurse -Include *.vue,*.scss,*.css |
  ForEach-Object {
    $lineCount = (Get-Content $_.FullName | Measure-Object -Line).Lines
    if ($lineCount -gt 1000) {
      '{0} 行 {1}' -f $lineCount, $_.FullName
    }
  } | Sort-Object {[int]($_.Split(' ')[0])}
