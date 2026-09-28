# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

#requires -Version 7
# ============================================================================
# Zombie Guardian shared guard library (dot-sourced by cleanup + daemon)
# ============================================================================
# G-266 (2026-09-27): before the zombie guardian may be registered again, its
# kill rules (R1 runaway install / R2 high-CPU low-mem / R6 orphan tsx watch)
# must be narrowed with STRUCTURAL exemptions. This is a single implementation
# on purpose (AGENTS: two implementations of one predicate always drift):
#   P1  Any process running in session 0 is NEVER killed. All IHUI* nssm
#       services (IHUI-API node 13164 / IHUI-WEB node 24464 / ai-service
#       python 21880+23532 at filing time) live in session 0; the guardian's
#       dev-process targets live in the interactive session.
#   P2  Any process whose own executable path sits under
#       deploy/prod-bundle/svc, or whose ancestor chain (<= 8 hops) contains
#       nssm.exe / services.exe / wininit.exe or a cmdline referencing
#       deploy/prod-bundle/svc, is NEVER killed. This is the "docs say run
#       the API under tsx watch again -> guardian kills the API" guard: even
#       if a service wrapper later matches R6, its ancestry excludes it.
#   P3  Trim/kill decoupling. The 60s/80%-threshold EmptyWorkingSet ladder
#       manufactures the "mem < 10MB" half of R2 for processes that are not
#       zombies at all. Every successful trim registers the PID with a
#       timestamp in a marker file; R2 (and the daemon's emergency kill)
#       skips any PID trimmed within the lookback window (default 45 min >
#       the 30 min full-pass interval), so our own trim can never become the
#       witness against the process it just trimmed.
# Failure direction is deliberately "skip more, kill less": a corrupted or
# missing marker file means no skip this pass (R2 still needs CPU>3600s AND
# mem<10MB), while P1/P2 never depend on external state.
#
# Keep this file ASCII-only in comments (console codepage trap class, cf.
# scripts/git-guardian-hidden.vbs header).
# ============================================================================

$ZombieGuardAncestorNames = @('nssm.exe', 'services.exe', 'wininit.exe')
$ZombieGuardSvcPathRegex = 'deploy[\\/]+prod-bundle[\\/]+svc([\\/]|$)'
$script:ZombieGuardTrimWindowMin = 45
$script:ZombieGuardTrimMarkerFile = $null

function Set-ZombieGuardTrimMarker {
    param([string]$Path)
    $script:ZombieGuardTrimMarkerFile = $Path
}

# Full process snapshot keyed by PID (name/session/ppid/cmdline/path), used to
# walk ancestry. Win32_Process rows keep their native properties.
function Get-ZombieGuardProcIndex {
    $rows = @{}
    try {
        foreach ($p in (Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)) {
            $rows[[int]$p.ProcessId] = $p
        }
    } catch {}
    return $rows
}

# Returns a protection reason string when the target must NEVER be killed,
# or $null when killing it is admissible. Never throws.
function Test-ZombieGuardProtected {
    param([int]$ProcessId, $Index)
    if (-not $Index) { return 'guard-lib:no-process-index' }   # fail closed: unknown = protected
    $visited = @{}
    $cur = $ProcessId
    for ($hop = 0; $hop -le 8; $hop++) {
        $p = $Index[[int]$cur]
        if (-not $p) { break }
        if ($hop -eq 0) {
            try { if ([int]$p.SessionId -eq 0) { return 'P1:session-0' } } catch { return 'P1:session-unreadable' }
            $selfPath = [string]$p.ExecutablePath
            if ($selfPath -and $selfPath -match $ZombieGuardSvcPathRegex) { return 'P2:svc-runner-path' }
        }
        $nm = ([string]$p.Name).ToLower()
        if ($nm -and ($ZombieGuardAncestorNames -contains $nm)) { return "P2:ancestor:$nm" }
        $cl = [string]$p.CommandLine
        if ($cl -and $cl -match $ZombieGuardSvcPathRegex) { return 'P2:ancestor:svc-runner-cmdline' }
        if ($visited.ContainsKey([int]$p.ProcessId)) { break }
        $visited[[int]$p.ProcessId] = $true
        $next = -1
        try { $next = [int]$p.ParentProcessId } catch { break }
        if ($next -le 4) { break }   # System / null: stop walking
        $cur = $next
    }
    return $null
}

function Read-ZombieGuardTrimMarker {
    $map = @{}
    if (-not $script:ZombieGuardTrimMarkerFile) { return $map }
    if (-not (Test-Path $script:ZombieGuardTrimMarkerFile)) { return $map }
    try {
        $raw = Get-Content -Raw -Path $script:ZombieGuardTrimMarkerFile -ErrorAction Stop
        if (-not $raw) { return $map }
        $obj = $raw | ConvertFrom-Json
        foreach ($prop in $obj.PSObject.Properties) {
            try { $map[[int]$prop.Name] = [datetime]$prop.Value } catch {}
        }
    } catch {
        # Corrupt marker: treat as empty THIS pass and let the next trim rewrite
        # it (the trimer rewrites the whole pruned map, so this self-heals).
        Write-Warning "zombie-guard trim marker unreadable, ignoring this pass: $($_.Exception.Message)"
        return @{}
    }
    return $map
}

# Called after a SUCCESSFUL EmptyWorkingSet on a live PID. Keeps only entries
# inside the lookback window, so the file cannot grow unboundedly.
function Register-ZombieTrim {
    param([int]$ProcessId)
    if (-not $script:ZombieGuardTrimMarkerFile) { return }
    $map = Read-ZombieGuardTrimMarker
    $map[$ProcessId] = Get-Date
    $cutoff = (Get-Date).AddMinutes(-([double]$script:ZombieGuardTrimWindowMin))
    $kept = [ordered]@{}
    foreach ($k in @($map.Keys)) {
        if ($map[$k] -gt $cutoff) { $kept[[string]$k] = $map[$k].ToString('o') }
    }
    try {
        $dir = Split-Path -Parent $script:ZombieGuardTrimMarkerFile
        if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        ConvertTo-Json -InputObject $kept | Set-Content -Path $script:ZombieGuardTrimMarkerFile -Encoding utf8
    } catch {}
}

function Test-ZombieTrimmedRecently {
    param([int]$ProcessId)
    $map = Read-ZombieGuardTrimMarker
    if (-not $map.ContainsKey($ProcessId)) { return $false }
    return ((Get-Date) - $map[$ProcessId]).TotalMinutes -lt ([double]$script:ZombieGuardTrimWindowMin)
}
