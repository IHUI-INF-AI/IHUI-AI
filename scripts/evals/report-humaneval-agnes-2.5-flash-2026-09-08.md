<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# HumanEval 评测报告

- **Benchmark**: HumanEval (OpenAI, MIT) — 164 题 pass@1 行业口径
- **Model**: `agnes-2.5-flash`
- **Temperature**: 0.0
- **Samples/problem**: 1（pass@1 ≈ solved/total，单样本）
- **Date**: 2026-09-08

## 汇总

| 指标          | 值                   |
| ------------- | -------------------- |
| 总题数        | 164                  |
| 通过 (passed) | 141                  |
| **pass@1**    | **0.8598** (141/164) |
| 平均时延 (ms) | 7710.2               |
| 失败题数      | 23                   |

## 状态分布

- passed: 141
- failed: 22
- extraction_fail: 1

## 失败题清单

| task_id       | entry_point                    | status          | reason                                                                                                      |
| ------------- | ------------------------------ | --------------- | ----------------------------------------------------------------------------------------------------------- |
| HumanEval/0   | has_close_elements             | failed          | def has_close_elements(numbers: List[float], threshold: float) -> bool: \| ^^^^                             |
| HumanEval/10  | make_palindrome                | failed          | assert candidate('xyz') == 'xyzyx' \| ^^^^^^^^^^^^^^^^^^^^^^^^^^^ \| AssertionError                         |
| HumanEval/116 | sort_array                     | failed          | assert candidate([-2,-3,-4,-5,-6]) == [-4, -2, -6, -5, -3] \| ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   |
| HumanEval/12  | longest                        | failed          | def longest(strings: List[str]) -> Optional[str]: \| ^^^^ \| NameError: name 'List' is not                  |
| HumanEval/120 | maximum                        | failed          | assert candidate([-3, -4, 5], 3) == [-4, -3, 5] \| ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ \| AssertionE   |
| HumanEval/126 | is_sorted                      | failed          | assert candidate([1, 2, 2, 3, 3, 4]) == True, "This prints if this assert fails 7 (good for debugging!)" \| |
| HumanEval/130 | tri                            | failed          | assert candidate(3) == [1, 3, 2.0, 8.0] \| ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ \| AssertionError               |
| HumanEval/132 | is_nested                      | failed          | for l in range(first_close + 1, n \| ^ \| SyntaxError: '(' was never closed                                 |
| HumanEval/134 | check_if_last_char_is_a_letter | failed          | assert candidate("eeeee e ") == False \| ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ \| AssertionError                   |
| HumanEval/145 | order_by_points                | failed          | assert candidate([1, 11, -1, -11, -12]) == [-1, -11, 1, -12, 11] \| ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   |
| HumanEval/147 | get_max_triples                | failed          | assert candidate(6) == 4 \| ^^^^^^^^^^^^^^^^^ \| AssertionError                                             |
| HumanEval/151 | double_the_difference          | failed          | assert candidate([-1, -2, 8]) == 0, "This prints if this assert fails 5 (also good for debugging!)" \| ^^   |
| HumanEval/163 | generate_integers              | failed          | assert candidate(132, 2) == [2, 4, 6, 8], "Test 3" \| ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ \| AssertionError   |
| HumanEval/38  | decode_cyclic                  | failed          | encoded_str = encode_cyclic(str) \| ^^^^^^^^^^^^^ \| NameError: name 'encode_cyclic' is not define          |
| HumanEval/50  | decode_shift                   | failed          | encoded_str = encode_shift(str) \| ^^^^^^^^^^^^ \| NameError: name 'encode_shift' is not defined.           |
| HumanEval/64  | vowels_count                   | failed          | assert candidate("keY") == 2, "Test 5" \| ^^^^^^^^^^^^^^^^^^^^^ \| AssertionError: Test 5                   |
| HumanEval/7   | filter_by_substring            | failed          | def filter_by_substring(strings: List[str], substring: str) -> List[str]: \| ^^                             |
| HumanEval/8   | sum_product                    | failed          | def sum_product(numbers: List[int]) -> Tuple[int, int]: \| ^^^^ \| NameError: name 'Lis                     |
| HumanEval/81  | numerical_letter_grade         | failed          | assert candidate([4.0, 3, 1.7, 2, 3.5]) == ['A+', 'B', 'C-', 'C', 'A-'] \| ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   |
| HumanEval/82  | prime_length                   | extraction_fail | no code block extracted                                                                                     |
| HumanEval/9   | rolling_max                    | failed          | def rolling_max(numbers: List[int]) -> List[int]: \| ^^^^ \| NameError: name 'List' is                      |
| HumanEval/91  | is_bored                       | failed          | assert candidate("Is the sky blue?") == 0, "Test 2" \| ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ \| AssertionErr   |
| HumanEval/97  | multiply                       | failed          | assert candidate(148, 412) == 16, "First test error: " + str(candidate(148, 412)) \|                        |

## 说明

- 数据集为 OpenAI 官方 HumanEval (MIT)，164 题；逐题仅将 prompt 发给模型，未发送 canonical_solution。
- 执行在沙箱子进程内进行，环境清空（禁网络），单题超时强杀并清理临时文件。
- pass@1 仅来自真实执行结果；.cache 与 report 均为程序生成未手改。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
