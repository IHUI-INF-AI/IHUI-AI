# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。


import pytest

# =============================================================================
# .env 复合键名形态(2026-10-03 第二次整改)
#
# 背景:原通用规则的键名是 `\b(api_key|token|secret|password…)\b`,而 `_` 本身
# 就是正则的词字符 ⇒ `DB_PASSWORD=` 里 `PASSWORD` 前的 `_` **不构成词边界**
# ⇒ 这类最常见的 .env 命名整体漏网。而模型 `printenv` / `cat .env` 的输出
# 里几乎全是这种名字,正是凭据随命令输出外发的主通道。
#
# 本组用例钉死三件事:
#   1. 真实 .env 命名(DB_PASSWORD / AWS_SECRET_ACCESS_KEY / MY_TOKEN …)被脱敏;
#   2. **键名完整保留** —— 键名是排障的关键信息,截断成 `API_KEY=` 就丢了
#      "这是 OpenAI 的还是 Stripe 的"这条线索(端到端测试同款断言);
#   3. 敏感词只是某个普通名词的一部分(token_count / password_policy /
#      KEY_FILE / public_key_material)时**不得**误伤。
# =============================================================================


@pytest.mark.parametrize(
    "line",
    [
        "DB_PASSWORD=hunter2hunter2",
        "AWS_SECRET_ACCESS_KEY=wJalrFAKE12345678",
        "MY_TOKEN=abcdef1234567890",
        "STRIPE_API_KEY=sk_live_abcdefgh12345",
        "PG_PASSWORD=realpw12345",
        "A_B_SECRET_C=v1alue1234",
        "KEY_VALUE=v1alue1234567",
    ],
)
def test_dotenv_composite_key_names_are_redacted(line):
    """带前缀/复合段的 .env 凭据名必须脱敏(这是本次整改的主目标)。"""
    assert "[REDACTED_SECRET]" in redact_secrets(line), f"漏网:{line}"


@pytest.mark.parametrize(
    "line",
    [
        "DB_PASSWORD=hunter2hunter2",
        "AWS_SECRET_ACCESS_KEY=wJalrFAKE12345678",
        "OPENAI_API_KEY=sk-FAKEFAKEFAKE1234",
    ],
)
def test_dotenv_key_name_is_preserved_in_full(line):
    """键名必须**完整**保留,不能被截成 API_KEY= / PASSWORD=。

    这条是本次整改翻过两次车的地方:非捕获组前缀会吃掉键名头
    (`OPENAI_API_KEY=` → `API_KEY=`),既丢排障信息又被端到端测试判红。
    """
    key = line.split("=", 1)[0]
    out = redact_secrets(line)
    assert f"{key}=" in out, f"键名被截断:{line} -> {out}"


@pytest.mark.parametrize(
    "line",
    [
        "token_count=1234",
        "password_policy=strict1234",
        "secret_name=mysecretname",
        "key_type=primary1234",
        "token_type=bearer1234",
        "password_rule_name=complexity",
        "public_key_material=abc1234567",
        "API_KEY_NAME=mykeyname1234",
        "PASSWORD_MIN_LENGTH=12ab34",
        "KEY_ID_PREFIX=pk_1234",
        "key_path=/etc/ssl/private",
        "KEY_SOURCE=env",
        "CREDENTIAL_FILE=/tmp/c.json",
        "KEY_FILE=/etc/k.pem",
        "SECRET_PATH=/run/secrets/x",
        "total_tokens = 12345678",
    ],
)
def test_non_credential_words_are_not_redacted(line):
    """敏感词只是普通名词的一部分时不得误伤(宁可漏网不可把正常文本改坏)。"""
    assert redact_secrets(line) == line, f"误伤:{line}"


def test_monkey_and_keyboard_not_redacted():
    """MONKEY / keyboard 里的 key 不是凭据词 —— 词边界必须真的生效。"""
    assert redact_secrets("MONKEY=abcdefgh1234") == "MONKEY=abcdefgh1234"
    assert redact_secrets("keyboard=qwerty12345") == "keyboard=qwerty12345"


def test_realistic_dotenv_block():
    """端到端:一份典型 .env 输出,凭据全盖、正常配置全留。"""
    env = (
        "DB_HOST=localhost\n"
        "DB_PASSWORD=hunter2hunter2\n"
        "AWS_SECRET_ACCESS_KEY=wJalrFAKE12345678\n"
        "REDIS_URL=redis://localhost:6379\n"
        "total_tokens = 12345678\n"
        "password_policy=strict1234\n"
    )
    out = redact_secrets(env)
    assert "hunter2hunter2" not in out
    assert "wJalrFAKE12345678" not in out
    assert "DB_PASSWORD=" in out
    assert "DB_HOST=localhost" in out
    assert "total_tokens = 12345678" in out
    assert "password_policy=strict1234" in out


# =============================================================================
# 第四次整改:裸敏感键名 / 复数形态 / 单字母(2026-10-03)
#
# 三条各有独立根因,都是上一轮之后实测仍漏的形态:
#   1. 复数:`GOOGLE_APPLICATION_CREDENTIALS=` —— 词表只有单数 credential,
#      而它后接 `_` 不接分隔符 ⇒ 整条规则失配(Google 官方 SDK 的标准命名)。
#   2. 单字母 K:`K=` / `API_K=` —— .env 与 systemd EnvironmentFile 里真实存在。
#   3. 裸敏感键名 + 纯小写值:`KEY=abcdefgh` —— 闸 2 的 E4「短标识符路径」
#      把它判成变量名放过了。这是本轮最微妙的一条,判据与顺序都关键:
#      · 判据用"取值含不含引用标记"(点号/括号/下标/插值/占位符);
#        `self.service_api_key` 有点号 ⇒ 引用 ⇒ 放过;`abcdefgh` 没有 ⇒ 凭据 ⇒ 盖。
#      · 闸 3 必须排在闸 2 **之前**,否则 E4 先 return,闸 3 永远执行不到
#        (第一版就排错了,现象是"改了没效果")。
#      · 闸 3 还必须排除占位符(`<your-secret-here>` / `${VAR}` / `%s` / `None`),
#        否则打破既有 test_placeholders_are_kept —— 排障日志里全是
#        [REDACTED_SECRET] 就失去了意义,而排障正是这条规则存在的原因。
# =============================================================================


@pytest.mark.parametrize(
    "line",
    [
        "GOOGLE_APPLICATION_CREDENTIALS=abc1234567def",
        "CREDENTIALS=abc123456789012",
        "A_CREDENTIALS=abc123456789012",
        "K=abcdefgh",
        "API_K=abcdefgh",
        "KEY=abcdefgh",
        "KEY=abcdefghijkl",
        "PRIVATE=abcdefghij",
        "SECRET=abcdefghij",
    ],
)
def test_bare_secret_key_with_literal_value_is_redacted(line):
    """裸敏感键名 + 裸字面量取值必须脱敏(第四轮的 3 条根因都在这里)。"""
    assert "[REDACTED_SECRET]" in redact_secrets(line), f"仍漏:{line}"


@pytest.mark.parametrize(
    "line",
    [
        "api_key = self.service_api_key",
        "api_key = config.api_key",
        "api_key = process.env.API_KEY",
        "api_key = settings.secret_key",
        "MY_CREDENTIAL = db.credential",
        "cache_key = self.cache_key",
        'api_key=os.getenv("X")',
    ],
)
def test_bare_secret_key_with_reference_value_is_kept(line):
    """键名敏感但取值是**代码引用**时必须放过(盖掉会让日志失去排障价值)。"""
    assert redact_secrets(line) == line, line


@pytest.mark.parametrize(
    "line",
    [
        "secret = <your-secret-here>",
        "api_key: ${ENV_VAR}",
        "api_key=$API_KEY",
        "token = %s",
        "secret = None",
    ],
)
def test_placeholders_still_kept_after_fourth_round(line):
    """占位符仍须放过 —— 第四轮的闸 3 不得破坏既有占位符语义。"""
    assert redact_secrets(line) == line, line


def test_key_name_preserved_when_redacting_bare_key():
    """键名必须完整保留(截断成 KEY= 就丢了"这是谁的凭据"这条线索)。"""
    out = redact_secrets("GOOGLE_APPLICATION_CREDENTIALS=abc1234567def")
    assert out.startswith("GOOGLE_APPLICATION_CREDENTIALS=")
    assert "abc1234567def" not in out


def test_looks_like_bare_literal_rejects_placeholders():
    """判据本身:占位符不算裸字面量(这是闸 3 不误伤的关键前提)。"""
    from app.core.output_cleaning import _looks_like_bare_literal

    assert _looks_like_bare_literal("abcdefgh") is True
    assert _looks_like_bare_literal("abc12345") is True
    for ph in ("<your-secret-here>", "${VAR}", "$API_KEY", "%s", "None", "self.api_key",
               "os.getenv('X')", "env['X']", ""):
        assert _looks_like_bare_literal(ph) is False, f"占位/引用不该算裸字面量:{ph!r}"

# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""出站脱敏漏网形态整改单测(2026-10-03 数据出域合规整改审计)。

覆盖两块:
- 要求 1:Bearer / Authorization / x-api-key 等 HTTP 凭据头形态
- 要求 2:通用 k=v 规则「负向前瞻」收窄后的判据分支
  (E1 占位 / E2 取值调用 / E3 下标 / E4 短标识符路径 / E5 随机串否决,
   R1 运算符 / R2 引号字面量 / R3 形态不匹配)

用例按「正例=该拦的拦住」「反例=不该拦的别拦」成对书写,并对同一条判据
(如标识符路径长度闸)成对取边界值,确保判据是被测出来的而不是碰巧过的。

测试样本一律用运行时拼接 / 明显假串,不在源码里落任何"形似真实凭据"的整串
字面量:一是纪律要求,二是 GitHub push protection 会对提交的文本做密钥扫描,
形似真值的假样本会被判为 GH013 直接拒推(与 test_engine_harness_fifteenth 同因)。
"""


from app.core.output_cleaning import _REF_NAME_MAX_LEN, redact_secrets

R = "[REDACTED_SECRET]"

# 明显假串:含 FAKE / 占位重复串,不含任何真实凭据特征
_FAKE_BEARER = "FAKE" * 8          # 32 位
_FAKE_B64 = "RkFLR" * 5 + "QUE="  # base64 风格,带 = 填充
_FAKE_SK = "sk-FAKEFAKEFAKE"
_FAKE_HEX = "AAAA1111BBBB2222"
_FAKE_MIXED = "ABCD1234EFGH5678"
_FAKE_WORD = "hunter2hunter2"


# =============================================================================
# 要求 1 · HTTP 凭据头形态
# =============================================================================
# 正例:必须拦
def test_bearer_token_is_redacted_and_scheme_preserved():
    out = redact_secrets(f"Authorization: Bearer {_FAKE_BEARER}")
    assert _FAKE_BEARER not in out
    # scheme 保留:模型仍能看出"这是个 Bearer 头",排障信息不丢
    assert out == f"Authorization: Bearer {R}"


def test_authorization_basic_is_redacted():
    """Basic 形态此前完全不在任何规则内(审计漏网点)。"""
    out = redact_secrets(f"Authorization: Basic {_FAKE_B64}")
    assert _FAKE_B64 not in out
    assert out == f"Authorization: Basic {R}"


def test_authorization_digest_is_redacted():
    out = redact_secrets(f"Authorization: Digest {_FAKE_MIXED}")
    assert _FAKE_MIXED not in out
    assert out == f"Authorization: Digest {R}"


def test_proxy_authorization_is_redacted():
    out = redact_secrets(f"Proxy-Authorization: Bearer {_FAKE_BEARER}")
    assert _FAKE_BEARER not in out
    assert out == f"Proxy-Authorization: Bearer {R}"


def test_x_api_key_header_forms_are_redacted():
    for text, needle in (
        (f"x-api-key: {_FAKE_HEX}", _FAKE_HEX),
        (f"X-Api-Key: {_FAKE_SK}", _FAKE_SK),
        (f"x-api-key={_FAKE_HEX}", _FAKE_HEX),
        (f"x-auth-token: {_FAKE_HEX}", _FAKE_HEX),
    ):
        out = redact_secrets(text)
        assert needle not in out, text
        assert R in out, text


def test_scheme_form_catches_token_shorter_than_legacy_bearer_floor():
    """旧 Bearer 规则要求 >=16 位;头部形态下 8 位即可判定为凭据。"""
    short = "abcdefgh"
    out = redact_secrets(f"Authorization: Bearer {short}")
    assert short not in out
    assert out == f"Authorization: Bearer {R}"


# 反例:不该拦(头部规则不得比通用规则更激进)
def test_bare_scheme_word_without_credential_is_not_redacted():
    for text in (
        "Authorization: Negotiate",
        "Authorization: Basic",
        "x-api-key: short",
    ):
        assert redact_secrets(text) == text, text


def test_non_credential_headers_are_untouched():
    text = f"x-request-id: {_FAKE_HEX}"
    assert redact_secrets(text) == text


def test_header_rule_defers_to_reference_judgement():
    """`authorization = settings.authorization_header` 是引用式赋值,不是凭据。

    与 test_reference_shaped_dotted_path_is_kept 同一判据:头部规则不允许
    比通用规则更激进,否则 `=` 形式的 .env 行会被整行打码。
    """
    text = "authorization = settings.authorization_header"
    assert redact_secrets(text) == text


# =============================================================================
# 要求 2 · 负向前瞻新判据 —— 正例(该拦的拦住)
# =============================================================================
def test_long_dotted_credential_reference_is_redacted():
    """审计点名的核心形态:代码片段形态的凭据引用(超长标识符路径)。"""
    out = redact_secrets("api_key = settings.CREDENTIALS_ENCRYPTION_KEY")
    assert out == f"api_key = {R}"


def test_prefix_lookalike_literals_are_redacted():
    """旧负向前瞻按**前缀**放行,真字面量以前缀开头就整条漏掉。"""
    for text, needle in (
        (f"api_key = os.get{_FAKE_SK}", _FAKE_SK),
        (f"password = get_{_FAKE_WORD}", _FAKE_WORD),
        (f"secret = process.env.{_FAKE_HEX}", _FAKE_HEX),
    ):
        out = redact_secrets(text)
        assert needle not in out, text
        assert R in out, text


def test_reference_wrapping_a_literal_is_redacted():
    """引用形态里裹着真字面量:前半段像引用,旧实现整条放过。"""
    for text, needle in (
        (f'token = get_token() or "{_FAKE_SK}"', _FAKE_SK),
        (f"secret = settings.FOO or '{_FAKE_HEX}'", _FAKE_HEX),
        (f"password = settings.FOO + '{_FAKE_WORD}'", _FAKE_WORD),
        (f"token = settings.FOO || '{_FAKE_HEX}'", _FAKE_HEX),
    ):
        out = redact_secrets(text)
        assert needle not in out, text
        assert R in out, text


def test_call_with_default_literal_is_redacted():
    """os.environ.get('K', 'sk-real…'):单看首参是引用,整体带第二个字面量。"""
    out = redact_secrets(f"token = os.environ.get('K', '{_FAKE_SK}')")
    assert _FAKE_SK not in out
    assert out == f"token = {R}"


def test_quoted_literal_is_redacted_even_if_it_looks_like_a_reference():
    out = redact_secrets(f"password = '{_FAKE_SK}'")
    assert _FAKE_SK not in out
    assert out == f"password = '{R}'"


def test_short_but_random_value_is_redacted():
    """E5 否决:长度在闸内,但数字+字母混杂 = 随机串而非变量名。"""
    for text in (
        f"api_key = {_FAKE_MIXED}",
        f"password = {_FAKE_HEX}",
    ):
        out = redact_secrets(text)
        assert R in out, text


def test_call_with_random_literal_argument_is_redacted():
    """E2 的随机串否决:单参调用,但参数本身是随机串。"""
    out = redact_secrets(f"password = lookup('{_FAKE_MIXED}')")
    assert _FAKE_MIXED not in out
    assert R in out


# =============================================================================
# 要求 2 · 反例(不该拦的别拦)—— 误伤会让日志失去排障价值
# =============================================================================
def test_reference_shaped_dotted_path_is_kept():
    """与 test_long_dotted_credential_reference_is_redacted 成对:短路径放行。"""
    for text in (
        "token = settings.AUTH_TOKEN",
        "token = settings.auth_token",
        "api_key = self.service_api_key",
        "password = config.db_password",
    ):
        assert redact_secrets(text) == text, text


def test_reference_shaped_calls_and_subscripts_are_kept():
    for text in (
        "password = os.getenv('DB_PASSWORD')",
        "token = get_token()",
        "secret = env['MY_SECRET']",
        'api_key = os.environ["APP_API_KEY"]',
        "secret = vault.read('secret/data/app')",
        "api_key = os.environ.get('API_KEY')",
    ):
        assert redact_secrets(text) == text, text


def test_placeholders_are_kept():
    for text in (
        "api_key: ${ENV_VAR}",
        "api_key=$API_KEY",
        "secret = <your-secret-here>",
        "token = %s",
        "secret = None",
    ):
        assert redact_secrets(text) == text, text


def test_similar_key_names_are_not_matched():
    """键名必须整体匹配:\b 边界之外的长键名不是凭据键。"""
    for text in (
        f"token_count = {_FAKE_MIXED}",
        "password_policy = min_length_8_chars",
        "secret_name = db_password_field",
        f"tokens_used = {_FAKE_HEX}",
    ):
        assert redact_secrets(text) == text, text


def test_short_values_are_kept():
    """{8,} 下限保留:短值无法与「值本来就短」区分,宁漏勿伤。"""
    for text in (
        "secret = short",
        "password: hunter2",
        "token = 1234567",
    ):
        assert redact_secrets(text) == text, text


def test_plain_output_is_untouched():
    plain = "nothing to see here; 正常运行输出 12345"
    assert redact_secrets(plain) == plain


# =============================================================================
# 判据边界:把阈值钉在测试里,防止后续调参悄悄改变行为
# =============================================================================
def test_reference_name_length_gate_boundary():
    """长度闸边界:总长 <= _REF_NAME_MAX_LEN 放行,超一位即拦。

    样本用纯字母(无数字、无符号),确保 E5 不参与判定 —— 隔离出长度闸本身。
    """
    prefix = "settings."
    at_limit = prefix + "A" * (_REF_NAME_MAX_LEN - len(prefix))
    over_limit = prefix + "A" * (_REF_NAME_MAX_LEN - len(prefix) + 1)
    assert _REF_NAME_MAX_LEN == 32, "阈值变更需同步更新本用例的意图说明"
    assert redact_secrets(f"token = {at_limit}") == f"token = {at_limit}"
    assert redact_secrets(f"token = {over_limit}") == f"token = {R}"


# =============================================================================
# 不降低既有能力
# =============================================================================
def test_known_credential_forms_still_redacted():
    """既有能力回归:通用赋值 / URL 内联 / 裸 key 形态。"""
    assert redact_secrets(f'password: "{_FAKE_WORD}"') == f'password: "{R}"'
    assert redact_secrets("api_key=abcdefgh12345678") == f"api_key={R}"
    out = redact_secrets("postgres://user:supersecret@db.host:5432/app")
    assert "supersecret" not in out
    assert out == f"postgres://user:{R}@db.host:5432/app"


def test_closing_quote_is_preserved():
    """闭引号不在匹配范围内,须原样留在占位符之后。"""
    assert redact_secrets(f"password: '{_FAKE_WORD}'") == f"password: '{R}'"


def test_mixed_env_dump_only_redacts_literals():
    """真实 printenv 输出的混合形态:只有字面量被盖,引用行原样保留。

    键名一律用通用规则**认得**的裸敏感词(password / API_KEY / token / secret)。
    带前缀的键名(DB_PASSWORD、OPENAI_API_KEY)不在通用规则的 \\\\b 覆盖内 ——
    那是本次整改范围外的既有缺口,见交付说明「未做部分」,不在此用例里混进来。
    """
    text = (
        f"password={_FAKE_WORD}\n"
        "API_KEY=${API_KEY}\n"
        "token=settings.AUTH_TOKEN\n"
        f"api_key={_FAKE_SK}\n"
        "secret=env['SESSION_SECRET']\n"
        'token=os.environ["UPSTREAM_TOKEN"]\n'
    )
    out = redact_secrets(text)
    assert _FAKE_WORD not in out
    assert _FAKE_SK not in out
    assert out.count(R) == 2, out
    # 引用行必须逐字保留 —— 这是"误伤会让日志失去排障价值"的底线
    assert "API_KEY=${API_KEY}\n" in out
    assert "token=settings.AUTH_TOKEN\n" in out
    assert "secret=env['SESSION_SECRET']\n" in out
    assert 'token=os.environ["UPSTREAM_TOKEN"]\n' in out


def test_idempotent_across_all_new_branches():
    for text in (
        f"Authorization: Bearer {_FAKE_BEARER}",
        f"x-api-key: {_FAKE_HEX}",
        "api_key = settings.CREDENTIALS_ENCRYPTION_KEY",
        f'token = get_token() or "{_FAKE_SK}"',
        f"password: '{_FAKE_WORD}'",
        f"api_key = {_FAKE_MIXED}",
    ):
        once = redact_secrets(text)
        assert redact_secrets(once) == once, text


def test_header_rules_are_a_superset_of_generic_rule():
    """锁定「头规则排在通用规则之前」这条不变式的实际收益。

    头部名不含通用规则的敏感词,故 `Authorization: Basic <b64>` 这类行
    通用规则永远匹配不到 —— 头规则是它的超集。移除头规则后必须漏,否则说明
    有别的规则在兜底、本次新增的规则形同虚设(将来有人删掉它也不会有测试报警)。
    """
    import app.core.output_cleaning as oc

    text = f"Authorization: Basic {_FAKE_B64}"
    assert redact_secrets(text) == f"Authorization: Basic {R}"

    without_header = [
        (p, r)
        for p, r in oc._SECRET_PATTERNS
        if "authorization" not in p.pattern.lower()
    ]
    redacted = text
    for pattern, replacement in without_header:
        redacted = pattern.sub(replacement, redacted)
    assert redacted == text, "去掉头规则后竟然没漏,头规则可能是冗余的"
# =============================================================================
# 2026-10-03 第三次整改:敏感词独占一段、且尾段可为零段
#
# 漏网根因(实测,非推测):复合键名规则的**尾段量词写的是 `+`(一段以上)而不是
# `*`**。`X_KEY=` 里 `key` 后面没有下划线段,整条规则直接失配 —— 与排除词表无关,
# 也不是 `[A-Za-z0-9_]*` 的贪婪问题。
#
# 为什么不能只把 `+` 改成 `*`:`[A-Za-z0-9_]*` 能把 `MON` / `hot` / `sort_` 当成
# 前缀而把 `key` 当成段内子串,实测 `MONKEY=` / `hotkey=` / `sort_key=` 三条
# 全部由放行变脱敏。故键名段改成**段感知**形式:敏感词必须独占一整段才算命中。
#
# 本组钉死:正例该盖、机主点名的 16 条反例原样放过、键名完整保留。
# =============================================================================

_R = "[REDACTED_SECRET]"

# 明显假串:不含任何真实凭据特征(与本文件既有纪律一致)
_FAKE_V1 = "v1alue" + "12345678"      # 13 位,含数字
_FAKE_V2 = "abcd" + "efgh1234"        # 12 位,含数字
_FAKE_V3 = "FAKE" + "cred1234"        # 12 位,含数字


@pytest.mark.parametrize(
    "line",
    [
        # 本次点名的两条漏网:敏感词后没有下划线段
        f"X_KEY={_FAKE_V1}",
        f"MY_CREDENTIAL={_FAKE_V2}",
        # 裸敏感词独占整段
        f"KEY={_FAKE_V1}",
        f"CREDENTIAL={_FAKE_V1}",
        # 多段前缀 + 敏感词收尾
        f"A_B_KEY={_FAKE_V1}",
        f"MY_DB_KEY={_FAKE_V1}",
        # 既有能力不得退化(敏感词在首段/中段的老形态)
        f"A_B_SECRET_C={_FAKE_V2}",
        f"KEY_VALUE={_FAKE_V2}",
        f"DB_PASSWORD={_FAKE_V2}",
        f"AWS_SECRET_ACCESS_KEY={_FAKE_V1}",
        f"MY_TOKEN={_FAKE_V2}",
    ],
)
def test_bare_sensitive_segment_without_trailing_word_is_redacted(line):
    """敏感词独占一段、后面**没有**下划线段时必须脱敏(第三次整改主目标)。"""
    assert _R in redact_secrets(line), f"漏网:{line}"


@pytest.mark.parametrize(
    "line",
    [
        f"X_KEY={_FAKE_V1}",
        f"MY_CREDENTIAL={_FAKE_V2}",
        f"KEY={_FAKE_V1}",
        f"A_B_KEY={_FAKE_V1}",
        f"A_B_SECRET_C={_FAKE_V2}",
        f"KEY_VALUE={_FAKE_V2}",
    ],
)
def test_bare_segment_key_name_is_preserved_in_full(line):
    """键名必须完整保留 —— 段感知改造不得把键名截短。

    与上面的脱敏用例成对:盖住值的同时前缀段与敏感词段都要原样回填。
    """
    key = line.split("=", 1)[0]
    assert f"{key}=" in redact_secrets(line), f"键名被截断:{line}"


@pytest.mark.parametrize(
    "line",
    [
        # 机主点名的 16 条反例,逐条钉死
        f"MONKEY={_FAKE_V1}",
        f"keyboard={_FAKE_V2}",
        "KEY_FILE=/etc/ssl/private",
        "CREDENTIAL_FILE=/tmp/cred.json",
        f"public_key_material={_FAKE_V1}",
        f"key_type=primary{_FAKE_V3}",
        f"token_type=bearer{_FAKE_V3}",
        "token_count=12345678",
        f"password_policy=strict{_FAKE_V3}",
        "key_path=/etc/ssl/private",
        "KEY_SOURCE=env",
        f"API_KEY_NAME=mykeyname{_FAKE_V3}",
        "PASSWORD_MIN_LENGTH=12ab34",
        f"key_id_prefix=pk{_FAKE_V3}",
        # 段感知改造的同族反例:敏感词只是某个词的**一段**,而非独立段
        f"hotkey={_FAKE_V1}",
        "total_tokens = 12345678",
        f"tokens_used = {_FAKE_V1}",
        f"secret_name=mysecret{_FAKE_V3}",
        "SECRET_PATH=/run/secret/x",
    ],
)
def test_non_credential_composite_key_names_are_not_redacted(line):
    """敏感词不独占一整段时不得误伤(段感知改造的主要风险面)。"""
    assert redact_secrets(line) == line, f"误伤:{line}"


@pytest.mark.parametrize(
    "line",
    [
        # 首段词表闸:「前缀 + 敏感词」构成的普通名词(与末段词表对称)
        f"primary_key={_FAKE_V1}",
        f"foreign_key=user_id{_FAKE_V3}",
        f"sort_key=created_at{_FAKE_V3}",
        f"cache_key=user:42{_FAKE_V3}",
        f"row_key=r1{_FAKE_V3}",
        f"partition_key=shard01{_FAKE_V3}",
    ],
)
def test_data_structure_key_names_are_not_redacted(line):
    """`primary_key` / `sort_key` / `cache_key` 是结构描述字段,不是凭据名。

    首段词表闸只认首段**恰好**是这些词,故 `secret_key` / `private_key` 这类
    真凭据不受影响(首段 secret/private 不在表内)。
    """
    assert redact_secrets(line) == line, f"误伤:{line}"


@pytest.mark.parametrize(
    "line",
    [
        # 尾段放宽到零段后,引用式赋值也会落进复合规则 —— 引用闸必须仍然生效
        "key = settings.auth_token_value",
        "credential = vault.path_value",
        "private_key = os.getenv('DB_PRIVATE_KEY')",
        "X_KEY = config.settings_value",
    ],
)
def test_bare_segment_key_defers_to_reference_judgement(line):
    """值是变量引用时原样放过,与通用规则/头部规则保持同一判据。

    这是尾段 `+`→`*` 放宽的必然后果:不放引用闸的话
    `password = os.getenv('DB_PASSWORD')` 这类**引用式赋值**会被误伤。
    """
    assert redact_secrets(line) == line, f"误伤:{line}"


def test_bare_segment_fix_does_not_touch_similar_key_words():
    """MONKEY / keyboard / hotkey 与 KEY 的判定只差「是否独占一段」。"""
    for text in (
        f"MONKEY={_FAKE_V1}",
        f"keyboard={_FAKE_V2}",
        f"hotkey={_FAKE_V1}",
    ):
        assert redact_secrets(text) == text, text
    assert _R in redact_secrets(f"KEY={_FAKE_V1}")


def test_bare_segment_fix_is_idempotent():
    """二次脱敏不得产生 `[REDACTED_SECRET][REDACTED_SECRET]` 之类的叠加。"""
    for text in (
        f"X_KEY={_FAKE_V1}",
        f"MY_CREDENTIAL={_FAKE_V2}",
        f"KEY={_FAKE_V1}",
        f"A_B_KEY={_FAKE_V1}",
    ):
        once = redact_secrets(text)
        assert redact_secrets(once) == once, text
        assert once.count(_R) == 1, text


def test_realistic_env_block_with_bare_segment_keys():
    """端到端:一份典型 .env,裸段凭据全盖、正常配置与引用行全留。"""
    env = (
        f"X_KEY={_FAKE_V1}\n"
        f"MY_CREDENTIAL={_FAKE_V2}\n"
        f"DB_PASSWORD={_FAKE_V2}\n"
        "REDIS_URL=redis://localhost:6379\n"
        "token_count=12345678\n"
        "primary_key=id\n"
        f"key_type=primary{_FAKE_V3}\n"
        "key = settings.auth_token_value\n"
    )
    out = redact_secrets(env)
    assert _FAKE_V1 not in out
    assert _FAKE_V2 not in out
    assert out.count(_R) == 3, out
    assert "X_KEY=" in out and "MY_CREDENTIAL=" in out
    assert "DB_PASSWORD=" in out
    assert "REDIS_URL=redis://localhost:6379\n" in out
    assert "token_count=12345678\n" in out
    assert "primary_key=id\n" in out
    assert "key = settings.auth_token_value\n" in out
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
