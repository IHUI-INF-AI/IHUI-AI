"""卡片格式转换工具.

将复杂的卡片模板数据转换为简化的客户端友好格式.
迁移自 coze_zhs_py/card_converter_final.py.
"""

import json


def convert_card_to_simple_format(card_data):
    """
    将复杂的卡片模板数据转换为简化的客户端友好格式.
    提取文本和图片,放在 content 字段中.

    Args:
        card_data: 原始卡片数据(字典或 JSON 字符串)

    Returns:
        简化后的数据格式
    """
    if isinstance(card_data, str):
        try:
            card_data = json.loads(card_data)
        except json.JSONDecodeError:
            return {"error": "Invalid JSON data"}

    # 处理特殊的 verbose 类型消息(卡片数据嵌套在 tool_output_content 中)
    if "msg_type" in card_data and card_data.get("msg_type") == "stream_plugin_finish":
        try:
            tool_output = card_data.get("data", "")
            if tool_output and isinstance(tool_output, str):
                start_idx = tool_output.find('{"card_type":')
                if start_idx != -1:
                    brace_count = 0
                    end_idx = start_idx
                    for i, char in enumerate(tool_output[start_idx:], start_idx):
                        if char == "{":
                            brace_count += 1
                        elif char == "}":
                            brace_count -= 1
                            if brace_count == 0:
                                end_idx = i + 1
                                break
                    card_json = tool_output[start_idx:end_idx]
                    card_json = card_json.replace(r'\"', '"')
                    card_json = card_json.replace(r'\\\"', '"')
                    card_data = json.loads(card_json)
        except Exception:
            pass

    result = {
        "type": "text",
        "content": "",
        "metadata": {
            "card_id": card_data.get("x_properties", {}).get("card_id"),
            "card_version": card_data.get("x_properties", {}).get("card_version_code"),
        },
    }

    data_str = card_data.get("data", "")
    if not data_str:
        return result

    try:
        data_content = json.loads(data_str)
    except json.JSONDecodeError:
        result["error"] = "Failed to parse card data"
        return result

    elements = data_content.get("elements", {})
    variables = data_content.get("variables", {})

    # 提取所有文本
    text_parts = []
    for element in elements.values():
        if element.get("type") == "@flowpd/cici-components/Text":
            content = element.get("props", {}).get("content", {})
            if isinstance(content, dict) and content.get("type") == "expression":
                text_parts.append(content.get("value", ""))

    # 提取图片
    image_urls = []
    for element in elements.values():
        if element.get("type") == "@flowpd/cici-components/NewImage":
            src = element.get("props", {}).get("src", "")
            if src:
                image_urls.append(src)

    # 提取视频
    video_url = None
    for var in variables.values():
        if var.get("name") == "video_url":
            video_url = var.get("defaultValue")
            break

    if not video_url and "info_in_card" in card_data:
        info_parts = card_data["info_in_card"].split(", ")
        if len(info_parts) >= 2:
            video_url = info_parts[1]

    content_parts = []
    if text_parts:
        content_parts.extend(text_parts)
    if video_url:
        content_parts.append(f"视频: {video_url}")
    for img_url in image_urls:
        content_parts.append(f"图片: {img_url}")

    if not content_parts and "response_for_model" in card_data:
        response_parts = card_data["response_for_model"].split(", ")
        if len(response_parts) >= 2:
            content_parts.append(response_parts[1])
        elif len(response_parts) >= 1:
            content_parts.append(response_parts[0])

    if content_parts:
        result["content"] = "\n".join(content_parts)
        if video_url or image_urls:
            result["type"] = "multimodal"

    if card_data.get("card_type") == 3 and video_url:
        result["content"] = video_url
        result["type"] = "url"

    if not result.get("content"):
        result["content"] = "卡片内容处理完成"
        result["type"] = "text"

    return result
