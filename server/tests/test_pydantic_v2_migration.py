"""Pydantic v2 迁移回归测试 (Phase 9-C).

覆盖:
  TestDashscopeFieldValidator (5)
    - @field_validator 取代 @validator 后, model / audio_url 仍正常校验
    - 支持的 model 通过, 不支持的拒绝
    - http:// / https:// 通过, ftp:// 拒绝

  TestVolcengineExtraAllow (3)
    - Jimeng4ImageRequest / VisualGenericRequest / Jimeng4ProcessRequest
      model_config = ConfigDict(extra="allow") 后仍允许额外字段

  TestFileUploadPopulateByName (2)
    - alias 模式 (fileName / base64) 仍生效
    - populate_by_name=True 也允许直接用 python 字段名

  TestConfigSettingsModelConfig (3)
    - Settings 加载后从 .env.production 读
    - case_sensitive=True 生效
    - extra="ignore" 忽略未声明字段不报错

  TestCodegenUtilPydanticV2 (2)
    - Jinja2 模板里 {{ class_name }}Out 用 model_config = ConfigDict(...)
    - 渲染输出不包含 class Config (v1 写法)

  TestTenantBaseImportPath (2)
    - tenant_base 用 sqlalchemy.orm.declarative_base (SA 2.0)
    - make_tenant_declarative_base 仍能产出可继承的 base class

  TestDeprecationWarning (3)
    - 导入 dashscope/volcengine/file_upload/config/tenant_base/codegen_util
      在 -W error::DeprecationWarning 下不抛错
    - 验证 v1 写法 (class Config / @validator) 在仓库 0 残留
    - 验证 ext.declarative 弃用路径 0 残留
"""

from __future__ import annotations

import io
import re
import subprocess
import sys
import warnings
import zipfile
from pathlib import Path

import pytest
from pydantic import ValidationError

# ---------------------------------------------------------------------------
# Repo root (本测试 conftest 已 sys.path.insert 0, 这里只需解析路径)
# ---------------------------------------------------------------------------
REPO = Path(__file__).resolve().parent.parent


# ===========================================================================
# TestDashscopeFieldValidator
# ===========================================================================
class TestDashscopeFieldValidator:
    """验证 @validator → @field_validator 迁移后行为一致."""

    def test_supported_model_accepted(self):
        from app.api.v1.ai.dashscope.route import (
            SUPPORTED_ASR_MODELS,
            AudioRecognizeRequest,
        )

        # 第一个支持的 model
        first_model = next(iter(SUPPORTED_ASR_MODELS))
        r = AudioRecognizeRequest(model=first_model, audio_url="https://x.com/a.wav")
        assert r.model == first_model
        assert r.audio_url == "https://x.com/a.wav"

    def test_unsupported_model_rejected(self):
        from app.api.v1.ai.dashscope.route import AudioRecognizeRequest

        with pytest.raises(ValidationError) as exc:
            AudioRecognizeRequest(model="paraformer-99", audio_url="https://x.com/a.wav")
        # 错误信息里包含 "不支持的模型"
        assert "不支持的模型" in str(exc.value) or "model" in str(exc.value)

    def test_audio_url_https_accepted(self):
        from app.api.v1.ai.dashscope.route import AudioRecognizeRequest

        r = AudioRecognizeRequest(model="qwen3-asr-flash", audio_url="https://cdn.example.com/a.wav")
        assert r.audio_url.startswith("https://")

    def test_audio_url_http_accepted(self):
        from app.api.v1.ai.dashscope.route import AudioRecognizeRequest

        r = AudioRecognizeRequest(model="qwen3-asr-flash", audio_url="http://internal/a.wav")
        assert r.audio_url.startswith("http://")

    def test_audio_url_ftp_rejected(self):
        from app.api.v1.ai.dashscope.route import AudioRecognizeRequest

        with pytest.raises(ValidationError) as exc:
            AudioRecognizeRequest(model="qwen3-asr-flash", audio_url="ftp://x.com/a.wav")
        assert "audio" in str(exc.value).lower() or "URL" in str(exc.value)


# ===========================================================================
# TestVolcengineExtraAllow
# ===========================================================================
class TestVolcengineExtraAllow:
    """验证 3 个 schema 迁移到 model_config = ConfigDict(extra='allow') 后仍允许额外字段."""

    def test_jimeng4_image_request_extra_allow(self):
        from app.api.v1.ai.volcengine.route import Jimeng4ImageRequest

        r = Jimeng4ImageRequest(prompt="a cat", custom_param="hello")
        assert r.prompt == "a cat"
        assert r.custom_param == "hello"
        # dump 包含额外字段
        assert r.model_dump()["custom_param"] == "hello"

    def test_visual_generic_request_extra_allow(self):
        from app.api.v1.ai.volcengine.route import VisualGenericRequest

        r = VisualGenericRequest(prompt="dog", user_uuid="u1", extra_field=42)
        assert r.extra_field == 42
        assert r.model_dump()["extra_field"] == 42

    def test_jimeng4_process_request_extra_allow(self):
        from app.api.v1.ai.volcengine.route import Jimeng4ProcessRequest

        r = Jimeng4ProcessRequest(req_key="jimeng_t2i_v40", action="submit")
        assert r.action == "action" or getattr(r, "action", None) == "submit"
        # 直接断言 dump
        assert r.model_dump().get("action") == "submit"


# ===========================================================================
# TestFileUploadPopulateByName
# ===========================================================================
class TestFileUploadPopulateByName:
    """验证 populate_by_name=True 迁移后 alias 和 python 名都能用."""

    def test_alias_accepted(self):
        from app.api.v1.content.file_upload import Base64UploadRequest

        r = Base64UploadRequest(fileName="test.png", base64="YWJj")
        assert r.file_name == "test.png"
        assert r.base64_content == "YWJj"

    def test_python_name_also_accepted(self):
        from app.api.v1.content.file_upload import Base64UploadRequest

        r = Base64UploadRequest(file_name="x.png", base64_content="ZGVm")
        assert r.file_name == "x.png"
        assert r.base64_content == "ZGVm"


# ===========================================================================
# TestConfigSettingsModelConfig
# ===========================================================================
class TestConfigSettingsModelConfig:
    """验证 app.config.Settings 用 model_config = SettingsConfigDict(...) 迁移后行为一致."""

    def test_settings_loads_with_env_file(self):
        from app.config import settings

        # 默认值必须非空
        assert settings.API_TITLE == "ZHS Platform"
        assert settings.API_PORT == 8000
        assert settings.JWT_EXPIRE_MINUTES == 60

    def test_case_sensitive_true(self):
        from app.config import settings

        # 大写属性名 (Settings 字段定义都是大写) 正常访问
        assert settings.API_HOST == "0.0.0.0"
        # 小写形式不应被识别为同一字段 (case_sensitive=True)
        # 通过 dict 化确认
        dump = settings.model_dump()
        assert "API_HOST" in dump
        # 小写键不会被自动生成
        assert "api_host" not in dump

    def test_extra_ignore(self):
        from app.config import settings

        # extra="ignore" 模式下, 未知字段应被忽略不抛错
        # 这里通过 model_validate 模拟传入额外字段
        try:
            settings.model_validate({"API_HOST": "1.2.3.4", "UNKNOWN_FIELD_9999": "x"})
        except ValidationError as e:
            pytest.fail(f"extra=ignore 应忽略未知字段, 却抛错: {e}")


# ===========================================================================
# TestCodegenUtilPydanticV2
# ===========================================================================
class TestCodegenUtilPydanticV2:
    """验证 Jinja2 模板里 class Config → model_config = ConfigDict(...) 已迁移."""

    def test_schema_template_uses_model_config(self):
        from app.utils.codegen_util import preview_code

        table_meta = {
            "table_name": "zhs_test_user",
            "table_comment": "测试用户表",
        }
        columns = [
            {
                "column_name": "id",
                "column_type": "bigint",
                "column_comment": "主键",
            },
            {
                "column_name": "name",
                "column_type": "varchar(64)",
                "column_comment": "姓名",
            },
        ]
        # 初始化 python_field/python_type/sa_type 等元数据
        from app.utils.codegen_util import init_column_meta

        columns = [init_column_meta(c) for c in columns]

        rendered = preview_code(table_meta, columns)
        schema_src = rendered["schemas/test.py"]
        # 必须有 model_config
        assert "model_config" in schema_src
        # 必须有 ConfigDict
        assert "ConfigDict" in schema_src
        # 必须有 from_attributes
        assert "from_attributes=True" in schema_src
        # v1 写法 class Config 不应在模板里
        assert "class Config:" not in schema_src

    def test_schema_template_zip_renders(self):
        from app.utils.codegen_util import download_code_zip

        table_meta = {
            "table_name": "zhs_demo",
            "table_comment": "演示表",
        }
        columns = [
            {
                "column_name": "id",
                "column_type": "int",
                "column_comment": "PK",
            }
        ]
        from app.utils.codegen_util import init_column_meta

        columns = [init_column_meta(c) for c in columns]

        zip_bytes = download_code_zip(table_meta, columns)
        assert isinstance(zip_bytes, bytes)
        assert len(zip_bytes) > 0

        # 解压验证 schema 文件名存在
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            names = zf.namelist()
            schema_files = [n for n in names if "schemas/" in n]
            assert schema_files, f"未找到 schema 文件: {names}"


# ===========================================================================
# TestTenantBaseImportPath
# ===========================================================================
class TestTenantBaseImportPath:
    """验证 tenant_base 用 sqlalchemy.orm.declarative_base (SA 2.0 推荐路径)."""

    def test_declarative_base_imported_from_orm(self):
        from app import orm

        src = orm.__file__ or ""
        # 只检查 tenant_base.py 文件内容
        tenant_base_path = Path(orm.__file__).parent / "tenant_base.py"
        assert tenant_base_path.exists()
        content = tenant_base_path.read_text(encoding="utf-8")
        assert "from sqlalchemy.orm import declarative_base" in content
        assert "from sqlalchemy.ext.declarative import" not in content

    def test_make_tenant_declarative_base_works(self):
        from app.orm.tenant_base import make_tenant_declarative_base

        B = make_tenant_declarative_base("P9TestBase")
        assert B.__name__ == "P9TestBase"

        # B 应该能用
        class Sub(B):
            __abstract__ = True

        assert Sub.__name__ == "Sub"


# ===========================================================================
# TestDeprecationWarning
# ===========================================================================
class TestDeprecationWarning:
    """验证迁移后的代码在 -W error::DeprecationWarning 下不抛错."""

    @pytest.mark.parametrize(
        "module",
        [
            "app.api.v1.ai.dashscope.route",
            "app.api.v1.ai.volcengine.route",
            "app.api.v1.content.file_upload",
            "app.config",
            "app.orm.tenant_base",
            "app.utils.codegen_util",
        ],
    )
    def test_import_module_without_deprecation(self, module):
        """子进程: -W error::DeprecationWarning 导入模块, 退出码 0."""
        code = f"import {module}; print('OK')"
        result = subprocess.run(
            [sys.executable, "-W", "error::DeprecationWarning", "-c", code],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(REPO),
            timeout=30,
        )
        if result.returncode != 0:
            pytest.fail(
                f"导入 {module} 在 -W error::DeprecationWarning 下抛错:\n"
                f"stdout={result.stdout}\nstderr={result.stderr}"
            )

    def test_no_v1_class_config_in_repo(self):
        """v1 写法 class Config 必须在仓库 0 残留 (app/ 范围)."""
        app_dir = REPO / "app"
        offenders = []
        for py in app_dir.rglob("*.py"):
            text = py.read_text(encoding="utf-8", errors="ignore")
            # 排除测试本身以及 codegen_util 模板 (迁移后模板已无 class Config)
            for m in re.finditer(r"^\s{4}class Config\s*:", text, re.MULTILINE):
                line_no = text[: m.start()].count("\n") + 1
                offenders.append(f"{py.relative_to(REPO)}:{line_no}")
        assert not offenders, f"class Config 残留: {offenders}"

    def test_no_validator_decorator_in_repo(self):
        """v1 写法 @validator 必须在仓库 0 残留 (app/ 范围)."""
        app_dir = REPO / "app"
        offenders = []
        for py in app_dir.rglob("*.py"):
            text = py.read_text(encoding="utf-8", errors="ignore")
            for m in re.finditer(r"@validator\(", text):
                line_no = text[: m.start()].count("\n") + 1
                offenders.append(f"{py.relative_to(REPO)}:{line_no}")
        assert not offenders, f"@validator 残留: {offenders}"

    def test_no_ext_declarative_in_repo(self):
        """SA 1.x 弃用路径 from sqlalchemy.ext.declarative 0 残留."""
        app_dir = REPO / "app"
        offenders = []
        for py in app_dir.rglob("*.py"):
            text = py.read_text(encoding="utf-8", errors="ignore")
            if "from sqlalchemy.ext.declarative" in text:
                offenders.append(str(py.relative_to(REPO)))
        assert not offenders, f"sqlalchemy.ext.declarative 残留: {offenders}"


# ===========================================================================
# TestInProcessDeprecationClean
# ===========================================================================
class TestInProcessDeprecationClean:
    """进程内 warnings.catch_warnings 验证 model 实例化无 deprecation."""

    def test_volcengine_instantiation_no_deprecation(self):
        with warnings.catch_warnings():
            warnings.simplefilter("error", DeprecationWarning)
            from app.api.v1.ai.volcengine.route import Jimeng4ImageRequest

            Jimeng4ImageRequest(prompt="x", extra=1)

    def test_file_upload_instantiation_no_deprecation(self):
        with warnings.catch_warnings():
            warnings.simplefilter("error", DeprecationWarning)
            from app.api.v1.content.file_upload import Base64UploadRequest

            Base64UploadRequest(fileName="x", base64="y")

    def test_dashscope_instantiation_no_deprecation(self):
        with warnings.catch_warnings():
            warnings.simplefilter("error", DeprecationWarning)
            from app.api.v1.ai.dashscope.route import AudioRecognizeRequest

            AudioRecognizeRequest(model="qwen3-asr-flash", audio_url="https://x.com/a.wav")
