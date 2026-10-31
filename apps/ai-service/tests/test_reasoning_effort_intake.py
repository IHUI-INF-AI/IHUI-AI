# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# D130 推理强度档位 intake 取证(2026-09-30 立)。
#
# 判的是**通道本身**而不是前端 store:同一模型带不同档位,解析出口必须给出不同生效值;
# 非法档位必须"丢弃 + 留通知",不得静默;网关 camel→snake 的转发行必须在位
# (把它注掉,本文件第二条断言当场翻红 —— 票第 6 栏的反向对照 B)。
#
# 本机无 PG/Redis/服务监听(实测端口零命中),所以**不**走完整 ASGI 端点:
# 那条路要先过鉴权、受限模型闸、试用额度三 cooperating 层,不属于本票文件清单。
# 因此这里判的是端点实际调用的那**一个**解析出口 + 被审源码里的接线证据。
import os
import re

import pytest

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))


def _read(*rel):
    return open(os.path.join(REPO, *rel), encoding='utf-8').read()


class _Req:
    """只带本判据吃的那两个字段(LLMCompleteRequest 的同形替身,不碰 DB)。"""

    def __init__(self, model, reasoning_effort):
        self.model = model
        self.reasoning_effort = reasoning_effort


def _resolve(reasoning_effort, model='deepseek-chat'):
    from app.routers.llm import _resolve_reasoning_effort

    return _resolve_reasoning_effort(_Req(model, reasoning_effort))


def test_no_selection_is_passthrough_none():
    """不发档位 ⇒ (None, None):旧客户端零行为变化(字段可选是本票的硬约束)。"""
    assert _resolve(None) == (None, None)


def test_low_and_high_produce_different_upstream_effort():
    """同一模型,low 与 high 各自的生效值必须不同 —— 这是"选择真的改变上游请求"的判据。"""
    low_eff, low_notice = _resolve('low')
    high_eff, high_notice = _resolve('high')
    assert low_eff == 'low' and high_eff == 'high'
    assert low_eff != high_eff, '档位没落到生效值 ⇒ 用户选了个寂寞'
    assert low_notice is None and high_notice is None, '生效值 == 选定值时不该有回落通知'


def test_unknown_effort_is_dropped_but_reported_not_silent():
    """不在封闭集里的档位:不发上游(会被 provider 拒或静默忽略),但**必须留通知**。"""
    eff, notice = _resolve('ultra-think')
    assert eff is None
    assert notice is not None and notice['fallback'] is True
    assert notice['requested'] == 'ultra-think' and notice['effective'] is None
    assert notice['reason'] == 'unknown-effort'


def test_gateway_transfers_camel_to_snake():
    """反向对照 B 的载体:apps/api 的转发行。把它注掉 ⇒ 本条红。

    为什么用源码证据而不是跑真链路:apps/api 是 Node 侧,pytest 跑不到它;
    而"选了档而上游收不到"这一型的**唯一**断点就是这一行(与 permission_mode / top_p
    同区同规)。判结构不判裸子串:要求它出现在 reasoning_effort 的赋值位。
    """
    src = _read('apps', 'api', 'src', 'routes', 'ai-chat-stream.ts')
    transfer = 'reasoning_effort: opts.reasoningEffort,'
    # 注释掉的转发行**不算在位** —— 本仓反复踩过"把注释当装车"的那一型:
    # 裸 `in src` 对 `// reasoning_effort: ...` 同样成立,反向对照就永远不红(尺子空转)。
    live = [
        ln
        for ln in src.split('\n')
        if transfer in ln and not ln.strip().startswith('//') and not ln.strip().startswith('*')
    ]
    assert live, (
        'apps/api 的 camel→snake 转发行缺失或被注释掉 ⇒ 前端选了推理强度而 ai-service 永远收不到;'
        '界面不会有任何报错,这正是 D130 票第 8 栏点名的静默失效。'
    )


def test_gateway_schema_declares_the_field():
    """zod 未声明 = 静默 strip(本仓记过三次同型断链),所以值域必须挂在 schema 上。"""
    src = _read('apps', 'api', 'src', 'routes', 'ai-chat-stream.ts')
    assert 'reasoningEffort: z.enum(REASONING_EFFORT_VALUES).optional()' in src, (
        'chatStreamSchema 未声明 reasoningEffort,或声明时抄了第二份字面量清单'
        '(值域唯一源 = @ihui/types 的封闭联合)。'
    )


def test_pydantic_intake_has_the_field():
    """LLMCompleteRequest 收 snake_case 的同名字段(网关出参即此拼写)。"""
    from app.routers.llm import LLMCompleteRequest

    m = LLMCompleteRequest(messages=[{'role': 'user', 'content': 'hi'}], reasoning_effort='low')
    assert m.reasoning_effort == 'low'
    assert LLMCompleteRequest(messages=[{'role': 'user', 'content': 'hi'}]).reasoning_effort is None


def test_done_frame_carries_the_notice_not_a_new_event():
    """回落可见复用**已存在的 done 帧**(不新增 SSE 事件名)。

    新增事件要动契约两侧 + sse-parse + dispatch 台账,而那些文件本票之外(并行代理持有);
    半截接入 = 给下游留断链。这里钉"通知挂在 done payload 的 reasoningEffort 字段上"。
    """
    src = _read('apps', 'ai-service', 'app', 'routers', 'llm.py')
    assert src.count('done_event["reasoningEffort"] = _reasoning_effort_notice') >= 1
    assert 'SSE_REASONING_EFFORT' not in src, '不得为回落新增 SSE 事件名(见本用例头注)'
    # api-client 侧必须真把它读出来,否则服务端写了也没人看
    client = _read('packages', 'api-client', 'src', 'client.ts')
    assert 'tryParseReasoningEffortNotice(line)' in client


def test_closed_set_is_single_source_across_surfaces():
    """档位值域:前端 / api-client / miniapp 都从 @ihui/types 取,不得有第二份字面量数组。"""
    types_src = _read('packages', 'types', 'src', 'reasoning-effort.ts')
    assert "export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'" in types_src
    for rel, name in [
        (('apps', 'api', 'src', 'routes', 'ai-chat-stream.ts'), 'apps/api'),
        (('packages', 'api-client', 'src', 'client.ts'), 'api-client'),
        (('apps', 'miniapp-taro', 'src', 'api', 'index.ts'), 'miniapp'),
    ]:
        src = _read(*rel)
        assert "'minimal', 'low', 'medium', 'high'" not in src and '"minimal", "low", "medium", "high"' not in src, (
            name + ' 里出现第二份档位字面量清单'
        )


def test_stream_kwargs_receive_the_resolved_effort():
    """流式路径(主聊天链路)必须把生效档位喂进 astream 的 kwargs。"""
    src = _read('apps', 'ai-service', 'app', 'routers', 'llm.py')
    assert '_native_fc_kwargs["reasoning_effort"] = _reasoning_effort_effective' in src
    assert 'kwargs["reasoning_effort"] = _eff_kwargs' in src


# ==================== 2026-10-31 扩档(xhigh/max,对齐对方 proto 七档) ====================


def test_xhigh_and_max_are_accepted_through_the_same_intake_exit():
    """xhigh/max 是合法档:生效值=请求值、零通知,与四旧档走**同一个**解析出口。

    刻意不为新档加任何映射表(§0.6):"厂商不支持"的剥离/降级出口沿用现状——
    非法值仍由 unknown-effort 丢弃口拦,合法值仍原样透传上游。
    """
    for tier in ('xhigh', 'max'):
        eff, notice = _resolve(tier)
        assert eff == tier, f'{tier} 未进 known_efforts ⇒ 被剥离口误杀'
        assert notice is None


def test_four_legacy_tiers_behavior_byte_identical_after_extension():
    """向后兼容:minimal/low/medium/high 的生效形态(透传 + 无通知)与扩档前逐字一致。"""
    for tier in ('minimal', 'low', 'medium', 'high'):
        assert _resolve(tier) == (tier, None)
    # 真非法值仍被既有剥离口丢弃 + 留通知(扩档不许把射程放宽到"什么都放行")
    eff, notice = _resolve('ultra-think')
    assert eff is None and notice is not None and notice['reason'] == 'unknown-effort'


def test_model_gate_degrades_xhigh_max_exactly_like_high():
    """厂商/模型不支持时不建新映射表:白名单门对 xhigh/max 与 high 行为逐字同形。

    对照 provider_caps 既有出口:filter_call_kwargs 从不处理 reasoning_effort 键
    (现读 HEAD 实测)——新档与 high 走同一条路径,本票不为其加剥离语义。
    """
    from app.core.provider_caps import filter_call_kwargs
    from app.core.reasoning_effort_pin import ReasoningEffortPin, RequestEffortUsage

    pin = ReasoningEffortPin(override_enabled=True, allowed_models=frozenset({'gpt-5'}))
    for tier in ('high', 'xhigh', 'max'):
        # 白名单外的模型:覆盖项不建立(None),请求透传且不写钉扎 —— 三档同形
        assert pin.effort_for_configuration_update('other-model', tier) is None
        assert pin.reasoning_effort_for_request('other-model', tier, RequestEffortUsage.SAMPLING) == tier
        assert pin.state.get('other-model') is None
    # 白名单内:xhigh 建立钉扎;'max' 请求被粘滞钉回 'xhigh'(与既有 high 被粘滞同型)
    assert pin.reasoning_effort_for_request('gpt-5', 'xhigh', RequestEffortUsage.SAMPLING) == 'xhigh'
    assert pin.reasoning_effort_for_request('gpt-5', 'max', RequestEffortUsage.SAMPLING) == 'xhigh'

    # 剥离口现读证据:stream_usage 被摘(该厂商 supports_stream_usage=False),
    # reasoning_effort 键原样留存 —— high 与 xhigh 同命,没有第二条通道。
    kwargs = {'stream_usage': True, 'reasoning_effort': 'xhigh'}
    out = filter_call_kwargs(kwargs, 'cloudflare_workers_ai', 'x')
    assert 'stream_usage' not in out
    assert out['reasoning_effort'] == 'xhigh'


def test_all_effort_surfaces_updated_in_the_same_batch():
    """『两处各抄必漏』型:六面一次改全的现读锁(权威对账在守门 C5/C6,本条钉工作树面)。

    面:① py known_efforts ② py agent_engine 校验白名单(第五抄写面,防漂开)
    ③ cli 运行时数组 ④ cli 编译期联合 ⑤ 契约层联合 ⑥ 契约层 VALUES 投影
    + web 轴 LABEL_KEY(必须穷尽新联合,否则 Record<ReasoningEffort, string> 编译期即红)。
    """
    from app.core.reasoning_effort_pin import ReasoningEffortPin
    from app.services.agent_engine import _REASONING_EFFORTS

    known = ReasoningEffortPin().known_efforts
    assert known == frozenset({'minimal', 'low', 'medium', 'high', 'xhigh', 'max'})
    assert set(_REASONING_EFFORTS) == known, 'agent_engine 白名单与 known_efforts 漂开(第五份表失守)'
    assert {'xhigh', 'max'} <= known

    types_src = _read('packages', 'types', 'src', 'reasoning-effort.ts')
    # 断言取"数组块内容"而非单行原文:packages/types 面在 prettier 射程内,
    # 六元素超 printWidth 会被折成多行(工作树=提交后 lint-staged 的同一终态)。
    assert re.search(r"REASONING_EFFORT_VALUES\s*=\s*\[[^\]]*'xhigh'[^\]]*'max'[^\]]*\]", types_src), 'VALUES 投影漏档'
    cli_arr = _read('apps', 'cli', 'src', 'subagents', 'precedence.ts')
    assert re.search(r"REASONING_EFFORTS: readonly string\[\]\s*=\s*\[[^\]]*'xhigh'[^\]]*'max'[^\]]*\]", cli_arr), 'cli 运行时数组漏档'
    cli_union = _read('apps', 'cli', 'src', 'subagents', 'types.ts')
    assert "'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'" in cli_union, 'cli 编译期联合漏档'
    axis_src = _read('apps', 'web', 'src', 'components', 'chat', 'reasoning-effort-axis.tsx')
    assert "xhigh: 'reasoningEffortXhigh'" in axis_src and "max: 'reasoningEffortMax'" in axis_src, (
        'web 轴 LABEL_KEY 未穷尽新联合 ⇒ 六档渲染缺词'
    )
    for loc in ('zh-CN', 'zh-TW', 'en', 'ja', 'ko'):
        pack = _read('packages', 'i18n', 'messages', 'web', f'{loc}.json')
        assert '"reasoningEffortXhigh"' in pack and '"reasoningEffortMax"' in pack, f'{loc} 词表缺档(§19 五语言同批)'


if __name__ == '__main__':
    raise SystemExit(pytest.main([__file__, '-q']))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
