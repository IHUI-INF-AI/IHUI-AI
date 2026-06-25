$h_drive = "H:\历史项目存档"
$services = Get-ChildItem "$h_drive\code\edu\service\service" -Directory -ErrorAction SilentlyContinue 2>$null | Where-Object { $_.Name -match "^ihui-ai-edu-" } | Select-Object -ExpandProperty Name | Sort-Object
$results = @()
foreach ($svc in $services) {
    $path = "$h_drive\code\edu\service\service\$svc\src\main\java"
    if (Test-Path $path) {
        $ctrlFiles = Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue 2>$null | Where-Object { $_.Extension -eq ".java" -and $_.FullName -match "controller" -and ($_.Name -ne "BaseController.java") -and ($_.Name -ne "RestControllerAdvice.java") }
        foreach ($f in $ctrlFiles) {
            $content = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
            $requestMap = ""
            $pat1 = '@RequestMapping\s*\(\s*value\s*=\s*"([^"]+)"'
            if ($content -match $pat1) { $requestMap = $matches[1] }
            else {
                $pat2 = '@RequestMapping\s*\(\s*"([^"]+)"'
                if ($content -match $pat2) { $requestMap = $matches[1] }
            }
            $apiTag = ""
            $pat3 = '@Api\(tags\s*=\s*"([^"]+)"'
            if ($content -match $pat3) { $apiTag = $matches[1] }
            $getCount = ([regex]::Matches($content, '@GetMapping')).Count
            $postCount = ([regex]::Matches($content, '@PostMapping')).Count
            $putCount = ([regex]::Matches($content, '@PutMapping')).Count
            $deleteCount = ([regex]::Matches($content, '@DeleteMapping')).Count
            $totalMethods = $getCount + $postCount + $putCount + $deleteCount
            $results += [PSCustomObject]@{ Service = $svc; Controller = $f.BaseName; Path = $requestMap; ApiTag = $apiTag; GET = $getCount; POST = $postCount; PUT = $putCount; DELETE = $deleteCount; Total = $totalMethods }
        }
    }
}
$results | Group-Object Service | ForEach-Object {
    Write-Output "===== $($_.Name) ====="
    $_.Group | Format-Table -AutoSize Path, Controller, ApiTag, GET, POST, PUT, DELETE, Total | Out-String -Width 250
}
$totalEndpoints = ($results | Measure-Object -Property Total -Sum).Sum
$totalControllers = $results.Count
Write-Output ""
Write-Output "==== 总计 ===="
Write-Output "业务 Controller 数: $totalControllers"
Write-Output "API 端点数: $totalEndpoints"
