"""使 fixture 根目录可被 pytest 导入(standalone 迷你仓库)。"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
