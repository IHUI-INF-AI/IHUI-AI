"""
文件差异对比服务
支持文本文件和二进制文件的差异检测
"""
import difflib
import hashlib
from dataclasses import dataclass
from enum import Enum


class DiffType(Enum):
    ADD = "add"
    DELETE = "delete"
    MODIFY = "modify"
    EQUAL = "equal"


@dataclass
class DiffLine:
    line_number: int
    content: str
    diff_type: DiffType


@dataclass
class DiffResult:
    additions: int
    deletions: int
    changes: int
    from_content: str
    to_content: str
    from_content_html: str
    to_content_html: str
    changes_list: list[dict]


class FileDiffService:
    @staticmethod
    def get_file_hash(file_path: str) -> str:
        """计算文件哈希值"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()

    @staticmethod
    def is_text_file(file_path: str, sample_size: int = 8192) -> bool:
        """判断是否为文本文件"""
        try:
            with open(file_path, "rb") as f:
                chunk = f.read(sample_size)
                if b'\x00' in chunk:
                    return False
                try:
                    chunk.decode('utf-8')
                    return True
                except UnicodeDecodeError:
                    try:
                        chunk.decode('gbk')
                        return True
                    except UnicodeDecodeError:
                        return False
        except Exception:
            return False

    @staticmethod
    def read_file_content(file_path: str) -> tuple[list[str], str]:
        """读取文件内容,返回行列表和原始内容"""
        try:
            with open(file_path, encoding="utf-8") as f:
                content = f.read()
                lines = content.splitlines(keepends=True)
                return lines, content
        except UnicodeDecodeError:
            try:
                with open(file_path, encoding="gbk") as f:
                    content = f.read()
                    lines = content.splitlines(keepends=True)
                    return lines, content
            except Exception:
                return [], ""
        except Exception:
            return [], ""

    @staticmethod
    def compare_text_files(
        from_path: str,
        to_path: str,
        context_lines: int = 3
    ) -> DiffResult:
        """比较两个文本文件"""
        from_lines, from_content = FileDiffService.read_file_content(from_path)
        to_lines, to_content = FileDiffService.read_file_content(to_path)

        diff = difflib.unified_diff(
            from_lines,
            to_lines,
            fromfile="from",
            tofile="to",
            lineterm=""
        )

        additions = 0
        deletions = 0
        changes_list = []
        line_number = 0

        for line in diff:
            if line.startswith('+++') or line.startswith('---') or line.startswith('@@'):
                continue
            elif line.startswith('+'):
                additions += 1
                changes_list.append({
                    "type": "add",
                    "line": line_number,
                    "content": line[1:].strip()
                })
            elif line.startswith('-'):
                deletions += 1
                changes_list.append({
                    "type": "delete",
                    "line": line_number,
                    "content": line[1:].strip()
                })
            else:
                line_number += 1

        from_html = FileDiffService._generate_html_diff(from_lines, to_lines, is_from=True)
        to_html = FileDiffService._generate_html_diff(from_lines, to_lines, is_from=False)

        return DiffResult(
            additions=additions,
            deletions=deletions,
            changes=additions + deletions,
            from_content=from_content,
            to_content=to_content,
            from_content_html=from_html,
            to_content_html=to_html,
            changes_list=changes_list[:100]
        )

    @staticmethod
    def compare_binary_files(from_path: str, to_path: str) -> DiffResult:
        """比较两个二进制文件"""
        from_hash = FileDiffService.get_file_hash(from_path)
        to_hash = FileDiffService.get_file_hash(to_path)

        from_size = 0
        to_size = 0

        try:
            import os
            from_size = os.path.getsize(from_path)
            to_size = os.path.getsize(to_path)
        except Exception:
            pass

        if from_hash == to_hash:
            return DiffResult(
                additions=0,
                deletions=0,
                changes=0,
                from_content=f"Binary file (hash: {from_hash[:16]}..., size: {from_size} bytes)",
                to_content=f"Binary file (hash: {to_hash[:16]}..., size: {to_size} bytes)",
                from_content_html="<span style='color: gray'>Binary files are identical</span>",
                to_content_html="<span style='color: gray'>Binary files are identical</span>",
                changes_list=[]
            )

        size_diff = to_size - from_size
        additions = max(0, size_diff)
        deletions = max(0, -size_diff)

        return DiffResult(
            additions=additions,
            deletions=deletions,
            changes=1,
            from_content=f"Binary file (hash: {from_hash[:16]}..., size: {from_size} bytes)",
            to_content=f"Binary file (hash: {to_hash[:16]}..., size: {to_size} bytes)",
            from_content_html=f"<span style='color: red'>Binary file changed (hash: {from_hash[:16]}...)</span>",
            to_content_html=f"<span style='color: green'>Binary file changed (hash: {to_hash[:16]}...)</span>",
            changes_list=[{
                "type": "modify",
                "line": 0,
                "content": f"Binary file content changed, size difference: {size_diff} bytes"
            }]
        )

    @staticmethod
    def compare_files(from_path: str, to_path: str) -> DiffResult:
        """比较两个文件,自动判断文件类型"""
        if FileDiffService.is_text_file(from_path) and FileDiffService.is_text_file(to_path):
            return FileDiffService.compare_text_files(from_path, to_path)
        else:
            return FileDiffService.compare_binary_files(from_path, to_path)

    @staticmethod
    def _generate_html_diff(from_lines: list[str], to_lines: list[str], is_from: bool) -> str:
        """生成HTML格式的差异显示"""
        diff = list(difflib.ndiff(from_lines, to_lines))
        html_lines = []

        for line in diff:
            if line.startswith('  '):
                html_lines.append(f"<span>{line[2:]}</span>")
            elif line.startswith('- ') and is_from:
                html_lines.append(f"<span style='background-color: #ffecec; color: #a33'>{line[2:]}</span>")
            elif line.startswith('+ ') and not is_from:
                html_lines.append(f"<span style='background-color: #eaffea; color: #270'>{line[2:]}</span>")
            elif line.startswith('? '):
                pass

        return ''.join(html_lines[:500])

    @staticmethod
    def get_similarity(from_path: str, to_path: str) -> float:
        """计算文件相似度"""
        if not FileDiffService.is_text_file(from_path) or not FileDiffService.is_text_file(to_path):
            from_hash = FileDiffService.get_file_hash(from_path)
            to_hash = FileDiffService.get_file_hash(to_path)
            return 1.0 if from_hash == to_hash else 0.0

        from_lines, _ = FileDiffService.read_file_content(from_path)
        to_lines, _ = FileDiffService.read_file_content(to_path)

        if not from_lines and not to_lines:
            return 1.0
        if not from_lines or not to_lines:
            return 0.0

        matcher = difflib.SequenceMatcher(None, from_lines, to_lines)
        return matcher.ratio()


file_diff_service = FileDiffService()
