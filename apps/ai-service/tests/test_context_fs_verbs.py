# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B2-08 ContextFS 动词面判据测试(2026-11-27)。

钉四件事:

  1. **动词面不改写鉴权结论**:URI 本身被拒,无论挂哪个动词都必须拒,且 reason 原样透传;
  2. **形状错配要拒绝**:`cat` 落在目录形状上是语义错误,不能读到目录内容再报错;
  3. **glob 的 pattern 是第一类输入**:缺了要 unjudged,含穿越/绝对注入/编码绕过要 denied;
  4. **limit 是边界不是开关**:非法值夹到默认、超上限夹到硬顶,都标记 `clamped` 而**不拒绝**——
     上限是保护性约束,不是攻击面。
"""

from __future__ import annotations

from app.core.context_fs import (
    DEFAULT_VERB_LIMIT,
    MAX_VERB_LIMIT,
    VERBS,
    Reason,
    Verb,
    VerbReason,
    Verdict,
    plan_verb,
    resolve_context_uri,
)

ROOTS = {'workspace': 'ws', 'session': 'ss', 'artifact': 'af', 'skill': 'sk'}
POLICY = {'allowed_namespaces': ['workspace', 'session', 'artifact', 'skill']}


def _ok(uri: str) -> str:
    """断言该 URI 鉴权为 allowed 并返回 canonical。"""
    auth = resolve_context_uri(uri, ROOTS, POLICY)
    assert auth['verdict'] == Verdict.ALLOWED.value, auth
    return str(auth['canonical_path'])


def test_verb_enum_covers_four_verbs() -> None:
    assert {'ls', 'cat', 'glob', 'stat'} == VERBS
    assert Verb.LS.value == 'ls'


def test_unknown_verb_is_unjudged() -> None:
    out = plan_verb('rm', 'context://workspace/a.txt', ROOTS, POLICY)
    assert out['verdict'] == Verdict.UNJUDGED.value
    assert out['reason'] == VerbReason.UNKNOWN_VERB.value
    assert out['plan'] is None


def test_non_string_verb_is_unjudged() -> None:
    out = plan_verb(None, 'context://workspace/a.txt', ROOTS, POLICY)
    assert out['verdict'] == Verdict.UNJUDGED.value
    assert out['reason'] == VerbReason.UNKNOWN_VERB.value


def test_auth_denial_is_passed_through_verbatim() -> None:
    uri = 'context://workspace/../etc/passwd'
    for verb in sorted(VERBS):
        out = plan_verb(verb, uri, ROOTS, POLICY)
        assert out['verdict'] == Verdict.DENIED.value, (verb, out)
        assert out['reason'] == Reason.TRAVERSAL.value, (verb, out)
        assert out['plan'] is None


def test_unregistered_namespace_is_passed_through() -> None:
    out = plan_verb('ls', 'context://tmp/x', ROOTS, POLICY)
    assert out['reason'] == Reason.UNREGISTERED_NAMESPACE.value


def test_cat_on_wildcard_uri_is_denied() -> None:
    _ok('context://workspace/a.txt')
    out = plan_verb('cat', 'context://workspace/*.py', ROOTS, POLICY)
    assert out['verdict'] == Verdict.DENIED.value
    assert out['reason'] == VerbReason.WILDCARD_ON_SINGLE.value
    assert out['canonical_path'] is None
    assert out['plan'] is None


def test_stat_on_wildcard_uri_is_denied() -> None:
    out = plan_verb('stat', 'context://workspace/a?.txt', ROOTS, POLICY)
    assert out['reason'] == VerbReason.WILDCARD_ON_SINGLE.value


def test_ls_accepts_wildcard_uri() -> None:
    """ls/glob 本来就是多目标动词,通配符在它们身上不是错配。"""
    out = plan_verb('ls', 'context://workspace/*.py', ROOTS, POLICY)
    assert out['verdict'] == Verdict.ALLOWED.value, out


def test_cat_on_file_is_allowed_with_plan() -> None:
    out = plan_verb('cat', 'context://workspace/a.txt', ROOTS, POLICY)
    assert out['verdict'] == Verdict.ALLOWED.value
    assert out['plan'] is not None
    assert out['plan']['verb'] == 'cat'
    assert out['plan']['canonical_path'] == 'context://workspace/ws/a.txt'


def test_ls_on_directory_is_allowed() -> None:
    out = plan_verb('ls', 'context://workspace/dir', ROOTS, POLICY)
    assert out['verdict'] == Verdict.ALLOWED.value
    assert out['plan']['verb'] == 'ls'


def test_stat_on_anything_allowed() -> None:
    for uri in ('context://workspace/a.txt', 'context://workspace/dir'):
        out = plan_verb('stat', uri, ROOTS, POLICY)
        assert out['verdict'] == Verdict.ALLOWED.value, out


def test_glob_without_pattern_is_unjudged() -> None:
    out = plan_verb('glob', 'context://workspace/dir', ROOTS, POLICY)
    assert out['verdict'] == Verdict.UNJUDGED.value
    assert out['reason'] == VerbReason.PATTERN_MISSING.value
    assert out['plan'] is None


def test_glob_with_traversal_pattern_is_denied() -> None:
    out = plan_verb('glob', 'context://workspace/src', ROOTS, POLICY, pattern='../*.py')
    assert out['verdict'] == Verdict.DENIED.value
    assert out['reason'] == VerbReason.PATTERN_UNSAFE.value


def test_glob_with_encoded_pattern_is_denied() -> None:
    out = plan_verb('glob', 'context://workspace/src', ROOTS, POLICY, pattern='%2e%2e/*')
    assert out['reason'] == VerbReason.PATTERN_UNSAFE.value


def test_glob_with_backslash_pattern_is_denied() -> None:
    out = plan_verb('glob', 'context://workspace/src', ROOTS, POLICY, pattern=r'..\*')
    assert out['reason'] == VerbReason.PATTERN_UNSAFE.value


def test_glob_with_absolute_pattern_is_denied() -> None:
    out = plan_verb('glob', 'context://workspace/src', ROOTS, POLICY, pattern='/etc/*')
    assert out['reason'] == VerbReason.PATTERN_UNSAFE.value


def test_glob_normal_pattern_kept_in_plan() -> None:
    out = plan_verb('glob', 'context://workspace/src', ROOTS, POLICY, pattern='**/*.py')
    assert out['verdict'] == Verdict.ALLOWED.value
    assert out['plan']['pattern'] == '**/*.py'


def test_limit_default_when_absent() -> None:
    out = plan_verb('ls', 'context://workspace/dir', ROOTS, POLICY)
    assert out['plan']['limit'] == DEFAULT_VERB_LIMIT
    assert out['plan']['clamped'] is False


def test_limit_invalid_values_clamp() -> None:
    for bad in (0, -3, True, 'x'):
        out = plan_verb('ls', 'context://workspace/dir', ROOTS, POLICY, limit=bad)
        assert out['plan']['limit'] == DEFAULT_VERB_LIMIT, bad
        assert out['plan']['clamped'] is True, bad


def test_limit_none_means_absent_not_clamped() -> None:
    """显式 None 与不传等价:它表示"没给",不是"给了个非法值"。"""
    out = plan_verb('ls', 'context://workspace/dir', ROOTS, POLICY, limit=None)
    assert out['plan']['limit'] == DEFAULT_VERB_LIMIT
    assert out['plan']['clamped'] is False


def test_limit_over_hard_cap_clamps() -> None:
    out = plan_verb('ls', 'context://workspace/dir', ROOTS, POLICY, limit=999_999)
    assert out['plan']['limit'] == MAX_VERB_LIMIT
    assert out['plan']['clamped'] is True


def test_limit_within_range_kept() -> None:
    out = plan_verb('ls', 'context://workspace/dir', ROOTS, POLICY, limit=57)
    assert out['plan']['limit'] == 57
    assert out['plan']['clamped'] is False


def test_allowed_always_has_plan_and_others_never_do() -> None:
    """半态不可能:allowed ⇔ canonical_path + plan 齐备。"""
    cases = [
        ('ls', 'context://workspace/dir', {}),
        ('cat', 'context://workspace/dir', {}),
        ('glob', 'context://workspace/src', {'pattern': '../x'}),
        ('wat', 'context://workspace/a.txt', {}),
        ('ls', 'context://workspace/../x', {}),
    ]
    for verb, uri, kwargs in cases:
        out = plan_verb(verb, uri, ROOTS, POLICY, **kwargs)
        if out['verdict'] == Verdict.ALLOWED.value:
            assert out['plan'] is not None and out['canonical_path'] is not None, out
        else:
            assert out['plan'] is None and out['canonical_path'] is None, out
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
