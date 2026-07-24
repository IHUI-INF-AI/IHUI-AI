# ============================================================================
# G:\ root real-time guardian v2.0 - allowlist-first FileSystemWatcher
# ============================================================================
# Purpose:
#   Monitor G:\ root in real-time. Any dir/file NOT in allowlist AND NOT
#   system-protected is immediately deleted + logged. This eliminates the
#   v1.0 blind spot where unknown junk (e.g. guardian-test-allowed) was kept
#   because it was not in the blacklist.
#
# Mode: allowlist-first
#   1. systemProtected -> ALLOWED (defensive, never delete system dirs)
#   2. allowlist       -> ALLOWED (user's legit projects/tools)
#   3. blacklist       -> BLOCKED (known junk, delete)
#   4. heuristic       -> BLOCKED (garbage signatures, delete)
#   5. otherwise       -> BLOCKED (unknown, delete + log [UNKNOWN])
#
# Config: g:\IHUI-AI\scripts\g-root-blacklist.json (v2.0 schema, UTF-8)
# Log:    g:\IHUI-AI\.trae-cn\tmp\g-root-guardian.log (UTF-8, 1MB rotation)
#
# Usage:
#   Foreground (debug):
#     powershell -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\g-root-guardian.ps1
#   Background (scheduled task, -WindowStyle Hidden):
#     install via scripts/install-g-root-guardian.ps1
#
# Design:
#   - Pure ASCII comments/output (PS5 GBK breaks Chinese in .ps1)
#   - No external modules, only built-in cmdlets
#   - try-catch in event handler, never crash main loop
# ============================================================================

#Requires -Version 5.0

$ErrorActionPreference = 'Continue'

# ---- Configuration (script-scoped) ----
$script:ConfigPath = 'g:\IHUI-AI\scripts\g-root-blacklist.json'
$script:LogPath    = 'g:\IHUI-AI\.trae-cn\tmp\g-root-guardian.log'
$script:WatchPath  = 'G:\'

# ---- Load config v2.0 (allowlist + blacklist + heuristic + systemProtected) ----
function Load-Config {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        throw "Config file not found: $Path"
    }
    $raw = Get-Content -Path $Path -Raw -Encoding UTF8
    $cfg = $raw | ConvertFrom-Json

    # Normalize null arrays to empty arrays (defensive)
    function NormArr($obj, $prop) {
        if ($null -eq $obj.$prop) {
            $obj | Add-Member -NotePropertyName $prop -NotePropertyValue @() -Force
        }
    }
    if ($null -eq $cfg.allowlist)         { $cfg | Add-Member -NotePropertyName allowlist -NotePropertyValue ([PSCustomObject]@{dirs=@(); dirPatterns=@(); files=@(); filePatterns=@()}) -Force }
    if ($null -eq $cfg.blacklist)         { $cfg | Add-Member -NotePropertyName blacklist -NotePropertyValue ([PSCustomObject]@{dirs=@(); files=@(); patterns=@()}) -Force }
    if ($null -eq $cfg.heuristic)         { $cfg | Add-Member -NotePropertyName heuristic -NotePropertyValue ([PSCustomObject]@{dirSignatures=@(); fileSignatures=@()}) -Force }
    if ($null -eq $cfg.systemProtected)   { $cfg | Add-Member -NotePropertyName systemProtected -NotePropertyValue ([PSCustomObject]@{dirs=@()}) -Force }

    NormArr $cfg.allowlist       'dirs'
    NormArr $cfg.allowlist       'dirPatterns'
    NormArr $cfg.allowlist       'files'
    NormArr $cfg.allowlist       'filePatterns'
    NormArr $cfg.blacklist       'dirs'
    NormArr $cfg.blacklist       'files'
    NormArr $cfg.blacklist       'patterns'
    NormArr $cfg.heuristic       'dirSignatures'
    NormArr $cfg.heuristic       'fileSignatures'
    NormArr $cfg.systemProtected 'dirs'

    return $cfg
}

# ---- Match helper: name against pattern list (wildcard) ----
function Test-WildcardMatch {
    param([string]$Name, [array]$Patterns)
    if ($null -eq $Patterns -or $Patterns.Count -eq 0) { return $false }
    foreach ($p in $Patterns) {
        if ($Name -like $p) { return $true }
    }
    return $false
}

# ---- Decide action: 'ALLOW' or 'BLOCK:<reason>' ----
function Decide-Action {
    param(
        [string]$Name,
        [bool]$IsDirectory,
        $Config
    )
    # 1. System-protected (defensive, never delete)
    if ($Config.systemProtected.dirs -contains $Name) { return 'ALLOW:system' }

    # 2. Allowlist (exact match first, then wildcard)
    if ($IsDirectory) {
        if ($Config.allowlist.dirs -contains $Name) { return 'ALLOW:allowlist' }
        if (Test-WildcardMatch -Name $Name -Patterns $Config.allowlist.dirPatterns) { return 'ALLOW:allowlist-pattern' }
    } else {
        if ($Config.allowlist.files -contains $Name) { return 'ALLOW:allowlist' }
        if (Test-WildcardMatch -Name $Name -Patterns $Config.allowlist.filePatterns) { return 'ALLOW:allowlist-pattern' }
    }

    # 3. Blacklist (exact match first, then wildcard)
    if ($IsDirectory) {
        if ($Config.blacklist.dirs -contains $Name) { return 'BLOCK:blacklist' }
    } else {
        if ($Config.blacklist.files -contains $Name) { return 'BLOCK:blacklist' }
    }
    if (Test-WildcardMatch -Name $Name -Patterns $Config.blacklist.patterns) { return 'BLOCK:blacklist-pattern' }

    # 4. Heuristic (garbage signatures)
    if ($IsDirectory) {
        if (Test-WildcardMatch -Name $Name -Patterns $Config.heuristic.dirSignatures) { return 'BLOCK:heuristic' }
    } else {
        if (Test-WildcardMatch -Name $Name -Patterns $Config.heuristic.fileSignatures) { return 'BLOCK:heuristic' }
    }

    # 5. Unknown - not in allowlist, not system, not in blacklist, not heuristic
    # allowlist-first mode: delete unknown to eliminate blind spots
    return 'BLOCK:unknown'
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
    $script:config = Load-Config -Path $script:ConfigPath
    $allowDirs     = @($script:config.allowlist.dirs).Count
    $allowDirPats  = @($script:config.allowlist.dirPatterns).Count
    $blackDirs     = @($script:config.blacklist.dirs).Count
    $blackFiles    = @($script:config.blacklist.files).Count
    $blackPats     = @($script:config.blacklist.patterns).Count
    $heurDirs      = @($script:config.heuristic.dirSignatures).Count
    $heurFiles     = @($script:config.heuristic.fileSignatures).Count
    $sysDirs       = @($script:config.systemProtected.dirs).Count
    $mode          = if ($script:config.mode) { $script:config.mode } else { 'allowlist-first' }
    Write-GuardianLog -Message "[STARTED] G:\ root guardian v2.0 started (mode=$mode; allowlist: $allowDirs dirs+$allowDirPats patterns; blacklist: $blackDirs+$blackFiles+$blackPats; heuristic: $heurDirs+$heurFiles; system: $sysDirs)"
    Write-Host "G:\ root guardian v2.0 started (mode=$mode)"
    Write-Host "  Allowlist: $allowDirs dirs + $allowDirPats patterns"
    Write-Host "  Blacklist: $blackDirs dirs + $blackFiles files + $blackPats patterns"
    Write-Host "  Heuristic: $heurDirs dir sigs + $heurFiles file sigs"
    Write-Host "  System:    $sysDirs protected dirs"
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

# ---- Event handler (inlined for scope safety) ----
# Config is passed via -MessageData (accessible as $Event.MessageData).
# Logging is inlined to avoid helper-function scope issues in action block.
$action = {
    try {
        $cfg = $Event.MessageData
        $name = $Event.SourceEventArgs.Name
        $fullPath = $Event.SourceEventArgs.FullPath
        if ([string]::IsNullOrEmpty($name)) { return }

        # Determine if directory or file (Test-Path with -PathType)
        $isDir = Test-Path -Path $fullPath -PathType Container
        $isFile = Test-Path -Path $fullPath -PathType Leaf

        # Inline Decide-Action logic (cannot call script-scope function from action block)
        $reason = 'BLOCK:unknown'
        # 1. System-protected
        if ($cfg.systemProtected.dirs -contains $name) { $reason = 'ALLOW:system' }
        # 2. Allowlist
        elseif ($isDir -and ($cfg.allowlist.dirs -contains $name -or ($name -in $cfg.allowlist.dirPatterns -or ($cfg.allowlist.dirPatterns | ForEach-Object { if ($name -like $_) { return $true } })))) {
            $reason = 'ALLOW:allowlist'
        }
        elseif ($isFile -and ($cfg.allowlist.files -contains $name)) {
            $reason = 'ALLOW:allowlist'
        }
        elseif ($isFile) {
            $matched = $false
            foreach ($p in $cfg.allowlist.filePatterns) { if ($name -like $p) { $matched = $true; break } }
            if ($matched) { $reason = 'ALLOW:allowlist-pattern' }
        }
        elseif ($isDir) {
            $matched = $false
            foreach ($p in $cfg.allowlist.dirPatterns) { if ($name -like $p) { $matched = $true; break } }
            if ($matched) { $reason = 'ALLOW:allowlist-pattern' }
        }

        # 3. Blacklist (only if not already allowed)
        if ($reason -like 'BLOCK:*') {
            if ($isDir -and ($cfg.blacklist.dirs -contains $name)) { $reason = 'BLOCK:blacklist' }
            elseif ($isFile -and ($cfg.allowlist.files -notcontains $name) -and ($cfg.blacklist.files -contains $name)) { $reason = 'BLOCK:blacklist' }
            else {
                $matched = $false
                foreach ($p in $cfg.blacklist.patterns) { if ($name -like $p) { $matched = $true; break } }
                if ($matched) { $reason = 'BLOCK:blacklist-pattern' }
            }
        }

        # 4. Heuristic
        if ($reason -eq 'BLOCK:unknown') {
            $sigs = if ($isDir) { $cfg.heuristic.dirSignatures } else { $cfg.heuristic.fileSignatures }
            if ($sigs) {
                foreach ($s in $sigs) { if ($name -like $s) { $reason = 'BLOCK:heuristic'; break } }
            }
        }

        # 5. Unknown remains BLOCK:unknown (allowlist-first mode)

        # Inline log writer (avoid helper-function scope issues)
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

        if ($reason -like 'ALLOW:*') {
            Add-Content -Path $logPath -Value "$ts [ALLOWED] $fullPath ($reason)" -Encoding UTF8
        } else {
            # BLOCK: delete + log
            if (Test-Path $fullPath) {
                try {
                    Remove-Item -Path $fullPath -Recurse -Force -ErrorAction Stop
                } catch {
                    # Fallback: .NET Directory.Delete for locked dirs
                    try {
                        if ($isDir) {
                            [System.IO.Directory]::Delete($fullPath, $true)
                        } else {
                            [System.IO.File]::Delete($fullPath)
                        }
                    } catch {
                        # Last resort: log failure
                        Add-Content -Path $logPath -Value "$ts [ERROR] Failed to delete $fullPath : $($_.Exception.Message)" -Encoding UTF8
                        return
                    }
                }
            }
            Add-Content -Path $logPath -Value "$ts [BLOCKED] $fullPath ($reason)" -Encoding UTF8
        }
    } catch {
        # Never crash the event pipeline; log the error and continue
        $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        $logPath = 'g:\IHUI-AI\.trae-cn\tmp\g-root-guardian.log'
        try { Add-Content -Path $logPath -Value "$ts [ERROR] $($_.Exception.Message)" -Encoding UTF8 } catch { }
    }
}

# Register Created event; pass config via -MessageData for scope-safe access
Register-ObjectEvent -InputObject $watcher -EventName Created -Action $action -MessageData $script:config -SourceIdentifier 'GRootGuardianCreated' | Out-Null

# ---- Main loop (keep process alive so events keep firing) ----
# IMPORTANT: use Wait-Event -Timeout 1, NOT Start-Sleep -Seconds 60.
# A long Start-Sleep blocks the PowerShell event queue for the full duration,
# delaying event delivery (and thus deletion) by up to 60s. Wait-Event pumps
# the event queue and invokes -Action scriptblocks with ~1s latency while
# keeping the process alive with near-zero CPU.
Write-Host "Guardian running (allowlist-first mode). Press Ctrl+C to stop."
try {
    while ($true) { Wait-Event -Timeout 1 | Out-Null }
} finally {
    try { Unregister-Event -SourceIdentifier 'GRootGuardianCreated' -ErrorAction SilentlyContinue } catch { }
    $watcher.EnableRaisingEvents = $false
    $watcher.Dispose()
    Write-GuardianLog -Message "[STOPPED] G:\ root guardian v2.0 stopped"
    Write-Host "Guardian stopped."
}
