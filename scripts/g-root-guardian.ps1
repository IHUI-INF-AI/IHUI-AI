# ============================================================================
# G:\ root real-time guardian - FileSystemWatcher blacklist monitor
# ============================================================================
# Purpose:
#   Monitor G:\ root directory in real-time. Any blacklisted junk dir/file
#   created in G:\ root is immediately deleted + logged. This is the active
#   defense layer (cleanup-external-junk.ps1 is passive/reactive cleanup).
#
# Blacklist source: g:\IHUI-AI\scripts\g-root-blacklist.json (UTF-8)
# Log output:      g:\IHUI-AI\.trae-cn\tmp\g-root-guardian.log (UTF-8)
#
# Usage:
#   Foreground (debug):
#     powershell -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\g-root-guardian.ps1
#   Background (hidden window, for install/scheduled task):
#     Start-Process powershell -ArgumentList '-WindowStyle Hidden -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\g-root-guardian.ps1' -WindowStyle Hidden
#
# Design constraints:
#   - Pure ASCII comments/output (PS5 default GBK decode breaks Chinese in .ps1)
#   - Blacklist mode (NOT whitelist): only deletes known junk patterns,
#     never deletes unknown user dirs/files (safe for new legit projects)
#   - No external modules, only built-in cmdlets
#   - Log rotation at 1MB -> .bak
#   - try-catch in event handler, never crash main loop
# ============================================================================

#Requires -Version 5.0

$ErrorActionPreference = 'Continue'

# ---- Configuration (script-scoped) ----
$script:BlacklistPath = 'g:\IHUI-AI\scripts\g-root-blacklist.json'
$script:LogPath       = 'g:\IHUI-AI\.trae-cn\tmp\g-root-guardian.log'
$script:WatchPath     = 'G:\'

# ---- Load blacklist (UTF-8) ----
function Load-Blacklist {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        throw "Blacklist file not found: $Path"
    }
    $raw = Get-Content -Path $Path -Raw -Encoding UTF8
    $bl = $raw | ConvertFrom-Json
    # Normalize null arrays to empty arrays (defensive)
    if ($null -eq $bl.dirs)      { $bl | Add-Member -NotePropertyName dirs -NotePropertyValue @() -Force }
    if ($null -eq $bl.files)     { $bl | Add-Member -NotePropertyName files -NotePropertyValue @() -Force }
    if ($null -eq $bl.patterns)  { $bl | Add-Member -NotePropertyName patterns -NotePropertyValue @() -Force }
    return $bl
}

# ---- Log writer (used by main script for startup/stop messages) ----
function Write-GuardianLog {
    param([string]$Message)
    $logDir = Split-Path $script:LogPath -Parent
    if (-not (Test-Path $logDir)) {
        New-Item -Path $logDir -ItemType Directory -Force | Out-Null
    }
    if (Test-Path $script:LogPath) {
        try {
            $size = (Get-Item $script:LogPath).Length
            if ($size -gt 1048576) {
                Rename-Item -Path $script:LogPath -NewName 'g-root-guardian.log.bak' -Force -ErrorAction SilentlyContinue
            }
        } catch { }
    }
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path $script:LogPath -Value "$timestamp $Message" -Encoding UTF8
}

# ---- Main init ----
try {
    $script:blacklist = Load-Blacklist -Path $script:BlacklistPath
    $dirCount     = @($script:blacklist.dirs).Count
    $fileCount    = @($script:blacklist.files).Count
    $patternCount = @($script:blacklist.patterns).Count
    Write-GuardianLog -Message "[STARTED] G:\ root guardian started (blacklist: $dirCount dirs, $fileCount files, $patternCount patterns)"
    Write-Host "G:\ root guardian started"
    Write-Host "  Blacklist: $dirCount dirs, $fileCount files, $patternCount patterns"
    Write-Host "  Log: $($script:LogPath)"
} catch {
    Write-Host "[FATAL] Failed to init: $($_.Exception.Message)"
    exit 1
}

# ---- Create FileSystemWatcher (root only, no subdirs) ----
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $script:WatchPath
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]::FileName -bor [System.IO.NotifyFilters]::DirectoryName

# ---- Event handler (inlined matching + logging for scope safety) ----
# The blacklist is passed via -MessageData (accessible as $Event.MessageData),
# which is the most reliable cross-scope data path for Register-ObjectEvent.
# Logging logic is inlined (not via helper function) to avoid any scope issue.
$action = {
    try {
        $bl = $Event.MessageData
        $name = $Event.SourceEventArgs.Name
        $fullPath = $Event.SourceEventArgs.FullPath
        if ([string]::IsNullOrEmpty($name)) { return }

        # Match against blacklist (dirs exact / files exact / patterns wildcard)
        $isBlocked = $false
        if ($bl.dirs -contains $name)      { $isBlocked = $true }
        elseif ($bl.files -contains $name) { $isBlocked = $true }
        else {
            foreach ($p in $bl.patterns) {
                if ($name -like $p) { $isBlocked = $true; break }
            }
        }

        # Inline log writer (avoid helper-function scope issues in action block)
        $logPath = 'g:\IHUI-AI\.trae-cn\tmp\g-root-guardian.log'
        $logDir = Split-Path $logPath -Parent
        if (-not (Test-Path $logDir)) { New-Item -Path $logDir -ItemType Directory -Force | Out-Null }
        if (Test-Path $logPath) {
            try {
                $sz = (Get-Item $logPath).Length
                if ($sz -gt 1048576) {
                    Rename-Item -Path $logPath -NewName 'g-root-guardian.log.bak' -Force -ErrorAction SilentlyContinue
                }
            } catch { }
        }
        $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

        if ($isBlocked) {
            if (Test-Path $fullPath) {
                Remove-Item -Path $fullPath -Recurse -Force -ErrorAction SilentlyContinue
            }
            Add-Content -Path $logPath -Value "$ts [BLOCKED] $fullPath" -Encoding UTF8
        } else {
            Add-Content -Path $logPath -Value "$ts [ALLOWED] $fullPath" -Encoding UTF8
        }
    } catch {
        # Never crash the event pipeline; log the error and continue
        $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        $logPath = 'g:\IHUI-AI\.trae-cn\tmp\g-root-guardian.log'
        try { Add-Content -Path $logPath -Value "$ts [ERROR] $($_.Exception.Message)" -Encoding UTF8 } catch { }
    }
}

# Register Created event; pass blacklist via -MessageData for scope-safe access
Register-ObjectEvent -InputObject $watcher -EventName Created -Action $action -MessageData $script:blacklist -SourceIdentifier 'GRootGuardianCreated' | Out-Null

# ---- Main loop (keep process alive so events keep firing) ----
# IMPORTANT: use Wait-Event -Timeout 1, NOT Start-Sleep -Seconds 60.
# A long Start-Sleep blocks the PowerShell event queue for the full duration,
# delaying event delivery (and thus deletion) by up to 60s. Wait-Event pumps
# the event queue and invokes -Action scriptblocks with ~1s latency while
# keeping the process alive with near-zero CPU.
Write-Host "Guardian running. Press Ctrl+C to stop."
try {
    while ($true) { Wait-Event -Timeout 1 | Out-Null }
} finally {
    try { Unregister-Event -SourceIdentifier 'GRootGuardianCreated' -ErrorAction SilentlyContinue } catch { }
    $watcher.EnableRaisingEvents = $false
    $watcher.Dispose()
    Write-GuardianLog -Message "[STOPPED] G:\ root guardian stopped"
    Write-Host "Guardian stopped."
}
