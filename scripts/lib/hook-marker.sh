# ============================================================================
# scripts/lib/hook-marker.sh  --  sh-layer machine-readable evidence writer
#
# Sourced by .husky/pre-commit (see the "sh layer evidence" block). Kept in its
# own file so the rotation + concurrency behaviour can be tested directly
# (scripts/tests/hook-marker-rotate.test.mjs) instead of being trapped inside
# a hook that exits the shell.
#
# WHY (2026-11-04, same family as the hook-run-hidden.vbs log-contention fix):
#   The old writer did `printf ... | tr ... >> hook-markers.jsonl` with no
#   upper bound. Two problems, both measured in this repo (multi-session
#   parallel commits share one worktree):
#     1. The file grows forever (one JSON line per rejected sh-layer path).
#     2. Concurrent appends from several hooks can interleave inside a line
#        (`tr` may emit more than one write), producing JSON that no reader
#        can parse -- the evidence is there but unreadable.
#
# FIX SHAPE (mirrors the .vbs fix: never let N processes fight one handle):
#   - All writes go through an atomic mkdir lock. Under the lock we (a) check
#     size and rotate when needed, (b) append exactly one line. One writer at
#     a time, so lines cannot interleave.
#   - Rotation never drops lines: hook-markers.jsonl.1 -> .2 -> ... (all
#     generations are kept, oldest first for readers).
#   - If the lock cannot be taken (stale lock from a killed hook, or a stuck
#     holder), the line is appended to a per-process shard under
#     hook-markers.d/ instead of being lost. Readers concatenate
#     rotated generations -> active file -> shards.
#
# ASCII-ONLY: this file is read in the same chain as wscript wrappers; non-ASCII
# text has already caused compile-time "Syntax error" there. Keep it ASCII.
# ============================================================================

# Size threshold for rotation. Override is a TEST/ops knob, NOT a skip switch:
# it never suppresses a gate or an evidence line.
IHUI_MARKER_MAX_BYTES=${IHUI_MARKER_MAX_BYTES:-1048576}

hook_marker() {
  _m_dir=${IHUI_MARKER_DIR:-.ihui-agent/state/hook-logs}
  mkdir -p "$_m_dir" 2>/dev/null || return 0

  _m_ts=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)
  # Strip non-printable/non-ASCII (keep TAB/CR/LF) so the JSON stays parseable
  # even if a caller passes a localized message.
  _m_line=$(printf '{"hook":"pre-commit","stage":"sh","event":"%s","ts":"%s","expected":"%s","got":"%s"}\n' \
    "$1" "$_m_ts" "$2" "$3" \
    | tr -cd '\11\12\15\40-\176')

  _m_active="$_m_dir/hook-markers.jsonl"
  _m_lock="$_m_dir/.hook-markers.lock"
  _m_got_lock=0
  _m_try=0
  while [ "$_m_try" -lt 50 ]; do
    if mkdir "$_m_lock" 2>/dev/null; then
      _m_got_lock=1
      break
    fi
    # Stale lock recovery: a killed hook must not block evidence forever.
    if [ -d "$_m_lock" ]; then
      if [ -n "$(find "$_m_lock" -maxdepth 0 -mmin +2 2>/dev/null)" ]; then
        rmdir "$_m_lock" 2>/dev/null || true
      fi
    fi
    _m_try=$((_m_try + 1))
    sleep 0.02 2>/dev/null || sleep 1
  done

  if [ "$_m_got_lock" = 1 ]; then
    _m_size=0
    if [ -f "$_m_active" ]; then
      _m_size=$(wc -c <"$_m_active" 2>/dev/null | tr -cd '0-9')
    fi
    [ -n "$_m_size" ] || _m_size=0
    if [ "$_m_size" -ge "$IHUI_MARKER_MAX_BYTES" ]; then
      # Shift every generation up by one, highest first. No generation is
      # deleted, so no line is lost.
      _m_gen=0
      for _m_f in "$_m_dir"/hook-markers.jsonl.*; do
        [ -f "$_m_f" ] || continue
        _m_n=${_m_f##*.}
        case "$_m_n" in
          *[!0-9]*) continue ;;
        esac
        [ "$_m_n" -gt "$_m_gen" ] && _m_gen=$_m_n
      done
      while [ "$_m_gen" -ge 1 ]; do
        mv -f "$_m_dir/hook-markers.jsonl.$_m_gen" "$_m_dir/hook-markers.jsonl.$((_m_gen + 1))" 2>/dev/null || true
        _m_gen=$((_m_gen - 1))
      done
      mv -f "$_m_active" "$_m_dir/hook-markers.jsonl.1" 2>/dev/null || true
    fi
    if printf '%s\n' "$_m_line" >>"$_m_active" 2>/dev/null; then
      _m_got_lock=2
    fi
    rmdir "$_m_lock" 2>/dev/null || true
  fi

  if [ "$_m_got_lock" != 2 ]; then
    # Lock timeout or append failure: durable per-process shard, never lost.
    mkdir -p "$_m_dir/hook-markers.d" 2>/dev/null || true
    printf '%s\n' "$_m_line" \
      >>"$_m_dir/hook-markers.d/$(date -u +%Y%m%dT%H%M%SZ)-$$-${_m_try}.jsonl" 2>/dev/null || true
  fi
  return 0
}
