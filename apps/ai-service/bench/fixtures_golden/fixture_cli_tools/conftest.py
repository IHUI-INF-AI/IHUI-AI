# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""使 fixture 根目录可被 pytest 导入(standalone 迷你仓库)。"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
