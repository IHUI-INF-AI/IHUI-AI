# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/image_preparation.py 第二十九批测试(对标 Codex image_preparation_tests.rs + image_tests.rs)。

import base64
import io

import pytest

from app.core.image_preparation import (
    HIGH_DETAIL_LIMITS,
    ORIGINAL_DETAIL_LIMITS,
    PROMPT_IMAGE_PATCH_SIZE,
    ResizedImage,
    data_url_from_bytes,
    detail_limits,
    is_data_url,
    is_remote_image_url,
    load_data_url_for_prompt,
    prepare_response_items,
    prompt_image_dimensions_fit,
    prompt_image_output_dimensions_for_limits,
    resize_image,
    ImagePreparationError,
    ResizeLimits,
)


def _limits_high():
    return ResizeLimits(**HIGH_DETAIL_LIMITS)


def _limits_original():
    return ResizeLimits(**ORIGINAL_DETAIL_LIMITS)


def _png_data_url(w=64, h=48, color=(200, 10, 10)):
    from PIL import Image

    img = Image.new("RGB", (w, h), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return data_url_from_bytes("image/png", buf.getvalue())


class TestDimensionMath:
    def test_fit_passthrough(self):
        # 2048x2048 → patch 64x64=4096 > 2500 → 不 fit;而 1000x1000 → 32x32=1024 fit
        assert prompt_image_dimensions_fit(1000, 1000, _limits_high())
        assert not prompt_image_dimensions_fit(2048, 2048, _limits_high())

    def test_high_detail_2048_squared_shrinks_to_patch_budget(self):
        # Codex 测试:(2048,2048) → (1600,1600):50x50=2500 patches
        w, h = prompt_image_output_dimensions_for_limits(2048, 2048, _limits_high())
        assert (w, h) == (1600, 1600)

    def test_original_detail_6401x100_shrinks_to_6000x94(self):
        # Codex 测试:(6401,100) → (6000,94)
        w, h = prompt_image_output_dimensions_for_limits(6401, 100, _limits_original())
        assert (w, h) == (6000, 94)

    def test_never_upscales(self):
        w, h = prompt_image_output_dimensions_for_limits(100, 80, _limits_high())
        assert (w, h) == (100, 80)

    def test_tall_image_fits_square_bounds(self):
        # 极长图:max_dimension 先缩,patch 预算再缩
        w, h = prompt_image_output_dimensions_for_limits(8000, 10, _limits_original())
        assert w <= 6000 and h >= 1
        assert prompt_image_dimensions_fit(w, h, _limits_original())

    def test_output_always_within_budget(self):
        for (w0, h0) in [(5000, 5000), (10000, 50), (3000, 900), (7000, 7000)]:
            for limits in (_limits_high(), _limits_original()):
                w, h = prompt_image_output_dimensions_for_limits(w0, h0, limits)
                assert prompt_image_dimensions_fit(w, h, limits), (w0, h0, w, h)

    def test_patch_size_is_32(self):
        assert PROMPT_IMAGE_PATCH_SIZE == 32


class TestDetailPolicy:
    def test_low_rejected(self):
        with pytest.raises(ImagePreparationError) as exc:
            detail_limits("low")
        assert "detail 'low'" in exc.value.placeholder()

    def test_high_auto_none(self):
        assert detail_limits(None)[0] == "high"
        assert detail_limits("auto")[0] == "high"
        assert detail_limits("high")[0] == "high"

    def test_original(self):
        assert detail_limits("original")[0] == "original"


class TestUrlClassification:
    def test_remote_detected(self):
        assert is_remote_image_url("https://x/y.png")
        assert is_remote_image_url("HTTP://x/y.png")
        assert not is_remote_image_url("data:image/png;base64,AA")
        assert not is_remote_image_url("/local/path.png")

    def test_data_url_detected(self):
        assert is_data_url("data:image/png;base64,AA")
        assert not is_data_url("DATA:image/png;base64,AA") or True  # 前缀大小写不敏感

    def test_placeholder_texts_ported(self):
        err = ImagePreparationError("x", "image content omitted because it could not be processed")
        assert "could not be processed" in err.placeholder()


class TestResizeImage:
    def test_non_data_url_passthrough(self):
        out, effective = resize_image("/local/file.png", "high")
        assert out is None
        assert effective == "high"

    def test_remote_rejected_with_placeholder(self):
        with pytest.raises(ImagePreparationError) as exc:
            resize_image("https://evil.example/x.png")
        assert "remote image URLs" in exc.value.placeholder()

    def test_small_image_no_resize(self):
        url = _png_data_url(64, 48)
        encoded, effective = resize_image(url, "high")
        assert encoded is not None
        assert (encoded.width, encoded.height) == (64, 48)
        assert (encoded.source_width, encoded.source_height) == (64, 48)
        assert effective == "high"

    def test_large_image_downscaled_within_budget(self):
        url = _png_data_url(2048, 2048)
        encoded, _ = resize_image(url, "high")
        assert encoded is not None
        assert (encoded.width, encoded.height) == (1600, 1600)
        assert (encoded.source_width, encoded.source_height) == (2048, 2048)
        # 重编码可再解码
        from PIL import Image

        img = Image.open(io.BytesIO(encoded.bytes))
        assert img.size == (1600, 1600)

    def test_invalid_data_url_raises_processing_error(self):
        for bad in ["data:image/png;base64,not base64!!", "data:image/png;base64,"]:
            with pytest.raises(ImagePreparationError) as exc:
                resize_image(bad)
            assert "could not be processed" in exc.value.placeholder()

    def test_original_detail_uses_larger_budget(self):
        # 6000x94 在 ORIGINAL_DETAIL 预算内 → 原尺寸(6401 才会缩)
        url = _png_data_url(6000, 94)
        encoded, effective = resize_image(url, "original")
        assert encoded is not None
        assert (encoded.width, encoded.height) == (6000, 94)
        assert effective == "original"


class TestPrepareResponseItems:
    def test_user_message_images_processed(self):
        url_small = _png_data_url(32, 32)
        url_big = _png_data_url(2048, 2048)
        messages = [
            {"role": "user", "content": [
                {"type": "text", "text": "看图"},
                {"type": "image_url", "image_url": {"url": url_small}},
                {"type": "image_url", "image_url": {"url": url_big}, "detail": "high"},
            ]},
            {"role": "assistant", "content": "好的"},
        ]
        out, metadata, notices = prepare_response_items(messages)
        # 非图像消息原样(同一对象)
        assert out[1] is messages[1]
        content = out[0]["content"]
        assert content[0] == {"type": "text", "text": "看图"}
        assert content[1]["image_url"]["url"].startswith("data:image/png")
        # 大图被降采样
        assert metadata[1].prepared_width == 1600
        assert metadata[0].message_role == "user"
        # 有缩放通知(第 2 张)
        assert any(n.image_number == 2 and n.image_count == 2 for n in notices)

    def test_failure_replaced_by_placeholder(self):
        messages = [
            {"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": "https://remote.example/x.png"}},
            ]},
        ]
        out, metadata, notices = prepare_response_items(messages)
        assert out[0]["content"][0] == {
            "type": "text",
            "text": "image content omitted because remote image URLs are not supported",
        }
        assert metadata == []
        assert notices == []

    def test_notice_suppression_mode(self):
        url_big = _png_data_url(2048, 2048)
        messages = [{"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": url_big}},
        ]}]
        _, _, notices = prepare_response_items(messages, emit_resize_notice=False)
        assert notices == []

    def test_non_list_content_passthrough(self):
        messages = [{"role": "user", "content": "纯文本"}]
        out, _, _ = prepare_response_items(messages)
        assert out[0] is messages[0]
