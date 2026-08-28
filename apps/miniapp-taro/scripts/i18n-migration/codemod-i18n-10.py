"""pass10 v2:内容白名单精准处理(模板直接写最终字符串,无转义混乱)。"""
import io
import json
import os
import re

SRC = r"G:/IHUI-AI/apps/miniapp-taro/src"
FRAG = r"G:/IHUI-AI/tmp/i18n-batch/frag-codemod10.json"

# (文件, 原文, 替换后的完整目标串(含 __K__/__V__ 占位), 词典中文)
RULES = [
    ("components/adapters/UserInfoCard.taro.tsx", "const FALLBACK_USERNAME = '用户'", "const FALLBACK_USERNAME = t('__K__')", "用户"),
    ("components/adapters/UserInfoCard.taro.tsx", "const FALLBACK_LOGIN_TEXT = '一键登录'", "const FALLBACK_LOGIN_TEXT = t('__K__')", "一键登录"),
    ("components/adapters/UserInfoCard.taro.tsx", "const FALLBACK_EDIT_TEXT = '编辑'", "const FALLBACK_EDIT_TEXT = t('__K__')", "编辑"),
    ("components/adapters/UserInfoCard.taro.tsx", "const FALLBACK_TOKEN_LABEL = '剩余智汇值:'", "const FALLBACK_TOKEN_LABEL = t('__K__')", "剩余智汇值:"),
    ("components/adapters/UserInfoCard.taro.tsx", "const FALLBACK_RECHARGE_TEXT = '充值'", "const FALLBACK_RECHARGE_TEXT = t('__K__')", "充值"),
    ("components/EmptyState.tsx", "text = '暂无数据'", "text = t('__K__')", "暂无数据"),
    ("components/RetryButton.tsx", "text = '重试'", "text = t('__K__')", "重试"),
    ("components/PageLoading.tsx", "text = '加载中...'", "text = t('__K__')", "加载中..."),
    ("pages/ai-assistant/index.tsx", 'placeholder="请输入描述"', "placeholder={tt('__K__', '__V__')}", "请输入描述"),
    ("components/WithdrawalRecords.tsx", 'text="暂无提现记录"', "text={tt('__K__', '__V__')}", "暂无提现记录"),
    ("components/BottomActionBar.tsx", "已选模型: {modelName}", "{tt('__K__', '已选模型: __M__', { m: modelName })}", "已选模型: __M__"),
    ("components/VerifyCodeModal.tsx", "验证码已发送至 {phone}", "{tt('__K__', '验证码已发送至 __M__', { m: phone })}", "验证码已发送至 __M__"),
    ("components/TeamManager.tsx", "加入于 {member.joinedAt}", "{tt('__K__', '加入于 __M__', { m: member.joinedAt })}", "加入于 __M__"),
    ("pages/share/components/InterestTrackModal.tsx", "选择感兴趣的赛道,获取个性化推荐", "{tt('__K__', '__V__')}", "选择感兴趣的赛道,获取个性化推荐"),
    ("pages/user/index.tsx", "chat.modelName || '默认模型'", "chat.modelName || t('__K__')", "默认模型"),
    ("pages/aigc/list.tsx", "context: '以\"数据洪流\"为意象,生成一段关于数字时代创作的散文诗。'", "context: t('__K__')", "以\"数据洪流\"为意象,生成一段关于数字时代创作的散文诗。"),
]

frag = {}
touched = 0
seq = 0
for rel, old, target, zh in RULES:
    path = f"{SRC}/{rel}"
    if not os.path.exists(path):
        continue
    src = io.open(path, encoding="utf-8").read()
    if old not in src:
        print("SKIP(not found):", rel, "|", old[:36])
        continue
    seq += 1
    key = f"tail.{seq}"
    frag[key] = zh
    new = target.replace("__K__", key).replace("__V__", zh).replace("__M__", "{m}")
    src = src.replace(old, new, 1)
    io.open(path, "w", encoding="utf-8", newline="\n").write(src)
    touched += 1

io.open(FRAG, "w", encoding="utf-8").write(json.dumps(frag, ensure_ascii=False, indent=2))
print(f"pass10: {touched} 处替换, 新增 key: {len(frag)}")
