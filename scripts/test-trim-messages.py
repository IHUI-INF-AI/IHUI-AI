"""Test sliding window trim_messages."""
import asyncio
import sys
sys.path.insert(0, 'apps/ai-service')

from app.core.llm_gateway import trim_messages

# Test 1: Long history with 20 messages
msgs = [{'role': 'system', 'content': 'sys'}]
for i in range(10):
    msgs.append({'role': 'user', 'content': f'u{i}'})
    msgs.append({'role': 'assistant', 'content': f'a{i}'})
msgs.append({'role': 'user', 'content': 'current'})

trimmed = trim_messages(msgs, window=6)
print(f"Original: {len(msgs)} msgs, Trimmed: {len(trimmed)} msgs (window=6)")
print(f"First role: {trimmed[0]['role']}, last 2: {[m['role'] for m in trimmed[-2:]]}")
print(f"Last content: {trimmed[-1]['content']}")
# Expected: 1 system + 12 turn msgs (last 6 user+assistant pairs) + 1 current user = 14
# Actually trim should keep: 1 system + 12 turns (window*2) + 1 current = 14
# But our is_current_input logic: max_keep=12, current is 1, so 12 + 1 = 13
# Let me re-read the logic...
# Actually: is_current_input=True, history = turn_msgs[-12-1:-1] = turn_msgs[-13:-1] (12 items), trimmed_turns = history + [current] = 12+1 = 13
# So trimmed = 1 system + 13 turns = 14
