# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# =============================================================================
# 健康门禁结论的单一判据(纯函数,零副作用)
# =============================================================================
# 立因(2026-10-19 现读一枚真事故):ihui-deploy.ps1 的 Test-HealthGate 把
# `$lastFails` 每轮**覆盖**,所以"前 5 轮 web 明确 HTTP 502、最后一轮恰好退化成
# unknown"这一型会绕过 `if ($lastFails.Count -gt 0) → return $false`,走到
# "无明确失败项 ⇒ 按未知放行 ⇒ return $true",调用方紧接着打印
# `Ok "健康门禁通过,部署成功"`。而函数自己的注释(2026-09-27 那段)声称
# "若此前某轮拿得出明确失败项,既有判据仍先 return $false"——**注释与实现相反**,
# 于是线上一次"整轮没被证明活着"的发布,账面记成了成功。
#
# 本模块只补"诚实"这一维,**刻意不改回滚策略**(判序:末轮明确失败 > 曾全绿 > 只剩未知):
#   · 最后一轮拿着明确 fail → Decision='fail'          (与改前逐字同判 ⇒ 照样回滚)
#   · 从未全绿且末轮只剩未知 → Decision='pass-unproven' (与改前同放行、不回滚,
#     但绝不允许被读成"通过":Markers 里第一枚就是 ASCII `GATE-UNPROVEN`,
#     供日志/告警/将来的人按它数得出来)
#   · 某一轮三项全绿(且末轮无 fail)→ Decision='pass'   Proven=$true
# 为什么"最后一轮有 fail 才回滚"这个策略保留原样:探测走的是**经 Cloudflare 的公网
# URL**,隧道抖动会把好的发布读成 502;把"任一轮 fail"升成回滚条件等于给发布链
# 加一道恒红门(§12e)。要收这一格得先给门禁加一条不经隧道的源站直探,那是另一张票。
# 2026-10-19 该票已落地(ihui-deploy.ps1 给 llm 加源站直探腿 + "公网 unknown 而源站 pass"折算为绿),
# 但**折算发生在调用方**:调用方把折算后的 fails/unknown 传进来,本模块的 Proven(上文 57-62 行)只认
# 这份折算后的证据表 —— 某一维公网 unknown 且折算后的 fails/unknown 均不含它 ⇒ 该维算绿。webOrigin/
# apiOrigin/llmOrigin 键仍只用于上文 fail vs entry-broken 分流(78-84 行)。本模块自身零功能改动。
#
# 计数只许进日志与邮件正文(-Detail),**绝不进告警身份**(§5e-3 / 门 224 判据):
# 轮次与计数每轮抖动 ⇒ 每轮一个新身份 ⇒ 同一场故障连寄 N 封。
# =============================================================================

function Get-HealthGateVerdict {
    [CmdletBinding()]
    param(
        # 每枚 = @{ web; api; llm; fails = @(...); unknown = @(...) },按轮次顺序
        [object[]]$Rounds = @()
    )

    # 注意:不能写成「先建空壳再 foreach 遍历 Keys 赋值」—— 在枚举 OrderedDictionary.Keys
    # 的同时写它的键,.NET 会抛「Collection was modified; enumeration operation may not execute」
    # (本模块第一版就是这么崩在 harness 第 1 个用例上的,不是测试写错了)。
    $dims = [ordered]@{
        web = @{ pass = 0; fail = 0; unknown = 0 }
        api = @{ pass = 0; fail = 0; unknown = 0 }
        llm = @{ pass = 0; fail = 0; unknown = 0 }
    }
    foreach ($r in $Rounds) {
        foreach ($d in @('web', 'api', 'llm')) {
            $v = [string]$r.$d
            if ($v -eq 'pass') { $dims[$d].pass++ }
            elseif ($v -eq 'fail') { $dims[$d].fail++ }
            else { $dims[$d].unknown++ }
        }
    }

    $proven = $false
    $everFailed = $false
    foreach ($r in $Rounds) {
        $rf = @($r.fails).Count
        $ru = @($r.unknown).Count
        if ($rf -eq 0 -and $ru -eq 0) { $proven = $true }
        if ($rf -gt 0) { $everFailed = $true }
    }

    $last = if (@($Rounds).Count -gt 0) { $Rounds[@($Rounds).Count - 1] } else { $null }
    $lastFails = @(if ($last) { $last.fails })
    $lastUnknown = @(if ($last) { $last.unknown })

    # 第二条腿:源站直探(不经 Cloudflare)。为什么非要有它 —— 公网那一路的读数把两种
    # 完全不同的故障混成同一个"fail":① 新构建真的坏了;② 构建是好的,但入口(隧道/边缘)
    # 不通。②被当成①就会**回滚一个好版本**,让访客侧故障更长;①被当成②则放行了坏构建。
    # 只有源站直探能分开这两者。取不到源站读数(老调用方不传 origin 维)⇒ 一律算"不成立",
    # 即退回改前语义(公网 fail ⇒ 回滚),绝不因为多了一条腿就更容易放行。
    # 源站维"有没有传"必须对 Hashtable 与 OrderedDictionary **两种形状都成立**:
    # .ContainsKey() 只有 Hashtable 有,OrderedDictionary 调它会抛 InvalidOperation,
    # 而异常一抛 $originOk 就停在 $false ⇒ 判成 fail ⇒ 把一个好构建回滚掉
    # (2026-10-19 拿真实生产数据干跑时才抓到;离线夹具全用普通哈希表,32 例一起骗人)。
    # 所以改用 .Keys -contains —— 两种字典都支持,且取不到就是"不成立",不猜。
    $originOk = $false
    $hasOrigin = ($last -and (($last.Keys -contains 'webOrigin') -or ($last.Keys -contains 'apiOrigin')))
    if ($hasOrigin) {
        $wo = [string]$last.webOrigin
        $ao = [string]$last.apiOrigin
        $originOk = ($wo -eq 'pass' -and $ao -eq 'pass')
    }

    # 判序:末轮明确失败 > 曾全绿 > 只剩未知。
    #   · 末轮有明确 fail 且源站也不应答 → 'fail'(真坏了,回滚)
    #   · 末轮有明确 fail 但源站两端都正常 → 'entry-broken'(入口坏了,回滚没用且不冒绿)
    #   · 某一轮三项全绿(且末轮无 fail)→ 'pass' Proven=$true
    #   · 其余 → 'pass-unproven'(与改前同放行,但绝不允许被读成"通过")
    # 真实调用方在拿到全绿那一轮就立刻 return,所以"先绿后坏"这一型在现网走不到这里 ——
    # 但纯函数不能依赖调用方才成立,否则换个调用姿势它就悄悄放行。
    $decision = if ($lastFails.Count -gt 0 -and -not $originOk) { 'fail' }
        elseif ($lastFails.Count -gt 0 -and $originOk) { 'entry-broken' }
        elseif ($proven) { 'pass' }
        else { 'pass-unproven' }

    # 一行 ASCII 计数摘要:只进日志/正文,不进身份
    $counts = (@('web', 'api', 'llm') | ForEach-Object {
        "$_=$($dims[$_].pass)/$($dims[$_].fail)/$($dims[$_].unknown)"
    }) -join ' '

    $markers = @()
    if ($decision -eq 'pass-unproven') {
        $markers += "GATE-UNPROVEN rounds=$(@($Rounds).Count) everFailed=$([int]$everFailed) counts=[$counts]"
        $markers += 'WARN  本轮发布未经健康证明:没有任何一轮拿到三项全绿(上面 counts 为 pass/fail/unknown 逐维计数)'
    }
    if ($decision -eq 'entry-broken') {
        $markers += "GATE-ENTRY-BROKEN rounds=$(@($Rounds).Count) lastFails=[$($lastFails -join ' ')] counts=[$counts]"
        $markers += 'WARN  公网入口读不到但源站直探正常 ⇒ 判为入口(隧道/边缘)故障:回滚好版本只会让故障更长,故不回滚,但绝不记为通过'
    }
    if ($decision -eq 'fail') {
        $markers += "GATE-FAIL-ON-EVIDENCE rounds=$(@($Rounds).Count) everFailed=1 lastFails=[$($lastFails -join ' ')]"
    }

    return @{
        Decision    = $decision
        Proven      = $proven
        EverFailed  = $everFailed
        OriginOk    = $originOk
        LastFails   = $lastFails
        LastUnknown = $lastUnknown
        Counts      = $counts
        Markers     = $markers
    }
}

# =============================================================================
# 取证面的两把纯尺子(2026-10-31 立;零判定改动,Get-HealthGateVerdict 判序一位未动)
# =============================================================================
# 立因(现读):2026-10-31 两轮(11:02 / 11:16)门禁在新构建上 8×12s 内未全过 ⇒ 自动回滚,
# 而事后唯一能拿到的读数只有一句
#   「健康门禁 第 N/8 轮: web=pass api=pass llm=fail 源站直探=web:pass/api:pass/llm:pass」
# llm 那一格到底是 401(探测令牌被拒,探针自己没资格)、403(同上,角色不匹配)、
# 404(新构建里路由没了)、502(边缘/隧道)还是 15s 操作超时,这句话结构上分辨不出来 ——
# 判据给了红,却没留下能定论的那一条读数,等于把"为什么红"永久丢失(§0.3 同族:
# 结论与证据必须一起落盘)。回滚链本身是好的,坏的是取证面沉默。
#
# 本段只产**证据**,不参与任何 Decision:
#   · Get-GateProbeClass      —— 把一个探测结果压成一个 ASCII 类别词(auth/http502/neterr/…)
#   · Format-GateProbeEvidence —— 六个探测结果 → 一行单行纯 ASCII 的 GATE-DIM 行
#   · Get-GateWebDimension    —— 公网 web 与源站直探的折算,**逐字等价**于 ihui-deploy.ps1
#                                原内联三行,只多识别"公网 pass 而源站 fail"(EdgeOne 缓存刷绿)
# 为什么必须是纯 ASCII:部署日志经 LocalSystem 子进程管道后中文会烂成 U+FFFD(实测
# deploy-loop.log),取证行必须能在烂掉之后仍逐字可读 —— 与 GATE-ITER / GATE-UNPROVEN 同一条纪律。

function Get-GateProbeClass {
    # 输入 = Invoke-Probe 的返回(@{ Verdict; Status; Reason })。输出恒为 ASCII 短词,永不抛。
    [CmdletBinding()]
    param([object]$Probe)

    if (-not $Probe) { return 'noprobe' }
    $verdict = ''
    $reason = ''
    try { $verdict = [string]$Probe.Verdict } catch { $verdict = '' }
    try { $reason = [string]$Probe.Reason } catch { $reason = '' }
    $status = 0
    try { $status = [int]$Probe.Status } catch { $status = 0 }

    if ($status -eq 429) { return 'ratelimit' }
    # 401/403 = 探针自己的凭据被拒,不是网关坏。这一格必须能从日志里一眼分辨:
    # 2026-10-27 那场"admin 口令轮换 ⇒ 门禁恒 401"就是靠这一格定论的。
    if ($status -eq 401 -or $status -eq 403) { return 'auth' }
    if ($status -ge 400) { return "http$status" }
    if ($status -ge 200 -and $status -lt 400) {
        # 200 但内容不符 ⇒ Invoke-Probe 判 fail 且 Reason 带「应答不含」;那是构建不对,不是网络不对
        if ($verdict -eq 'fail') { return 'content' }
        return 'ok'
    }
    # Status=0:传输层没拿到应答(Invoke-Probe 把这类一律判 unknown)
    if ($verdict -eq 'unknown') { return 'neterr' }
    return 'nostatus'
}

function Format-GateProbeEvidence {
    # 六个探测结果 → 一行取证行。形状:
    #   GATE-DIM web=pass(200/ok) api=fail(502/http502) llm=fail(401/auth) origin=web:pass(200/ok)/api:pass(200/ok)/llm:pass(200/ok)
    # 任何取不到的输入都写成 noprobe(§0.3:取不到不记绿,也不假装有读数),绝不抛、绝不换行。
    [CmdletBinding()]
    param(
        [object]$Probes = @{},
        [string]$Prefix = 'GATE-DIM'
    )

    $hit = { param($k) ($Probes -and ($Probes.Keys -contains $k)) }
    $cell = {
        param($k)
        $p = if (& $hit $k) { $Probes[$k] } else { $null }
        $v = if ($p) { [string]$p.Verdict } else { 'noprobe' }
        if (-not $v) { $v = 'noprobe' }
        $s = 0
        try { $s = [int]$p.Status } catch { $s = 0 }
        "$k=$v($s/$(Get-GateProbeClass $p))"
    }
    $main = @('web', 'api', 'llm') | ForEach-Object { & $cell $_ }
    $orig = @('webOrigin', 'apiOrigin', 'llmOrigin') | ForEach-Object {
        $short = ($_ -replace 'Origin$', '')
        $p = if (& $hit $_) { $Probes[$_] } else { $null }
        $v = if ($p) { [string]$p.Verdict } else { 'noprobe' }
        if (-not $v) { $v = 'noprobe' }
        $s = 0
        try { $s = [int]$p.Status } catch { $s = 0 }
        "$short`:$v($s/$(Get-GateProbeClass $p))"
    }
    $line = "$Prefix " + ($main -join ' ') + ' origin=' + ($orig -join '/')
    # 单行 + ASCII 净化:控制字符/中文会让这一行在坏日志里读不出来(§5f 同族实测)
    $line = ($line -replace "[\r\n\t]", ' ')
    $line = ($line -replace '[^\x20-\x7E]', '?')
    return $line.TrimEnd()
}

function Get-GateWebDimension {
    # 公网 web 维 × 源站直探的折算。判据与 ihui-deploy.ps1 原内联写法逐条等价:
    #   公网 fail                      ⇒ 进 Fails(明确证据,原样回滚判序输入)
    #   公网非 pass 且源站 pass        ⇒ Rescued(折算为绿,原样)
    #   公网非 pass 且源站非 pass      ⇒ 进 Unknown(原样)
    # 唯一新增:公网 **pass** 而源站 **fail** ⇒ 进 Unknown + CacheBlind。
    # 立因:公网 web 探的是 https://www.aizhs.top,该页由 TencentEdgeOne 缓存应答
    # (本仓 2026-10-28 实测 eo-cache-status=HIT、age=11506 秒,见 ihui-deploy.ps1 切流后
    # 就绪等待那段头注)⇒ 缓存命中时的 pass **不构成"源站正在出页面"的证据**。旧写法让这一型
    # 直接算绿,于是"三项全绿"可以由一份旧缓存 + 两条正常腿拼出来,调用方随即打印部署成功。
    # 方向 = fail-closed 的取证侧:降为 Unknown ⇒ 最多走到 pass-unproven(GATE-UNPROVEN +
    # 到人告警 + 不打印成功),**不据此回滚**(单条 unknown 不进 LastFails)。
    [CmdletBinding()]
    param([object]$Public, [object]$Origin)

    $pv = if ($Public) { [string]$Public.Verdict } else { 'unknown' }
    $ov = if ($Origin) { [string]$Origin.Verdict } else { 'unknown' }
    $res = @{ Fails = @(); Unknown = @(); Rescued = $false; CacheBlind = $false; Marker = '' }

    if ($pv -eq 'fail') {
        $res.Fails = @("web(HTTP $($Public.Status) $($Public.Reason))")
        return $res
    }
    if ($pv -ne 'pass') {
        if ($ov -eq 'pass') { $res.Rescued = $true } else { $res.Unknown = @('web') }
        return $res
    }
    if ($ov -eq 'fail') {
        $res.Unknown = @('web')
        $res.CacheBlind = $true
        $cls = Get-GateProbeClass $Origin
        $st = 0
        try { $st = [int]$Origin.Status } catch { $st = 0 }
        $res.Marker = "GATE-CACHE-BLIND dim=web public=pass($([int]$Public.Status)) origin=fail($st/$cls) -- public reading may come from EdgeOne cache; treating web as NOT proven (no rollback from this alone)"
    }
    return $res
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
