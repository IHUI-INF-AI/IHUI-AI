package com.ihui.ai.sdk.module;

import com.fasterxml.jackson.databind.JsonNode;
import com.ihui.ai.sdk.BaseClient;
import com.ihui.ai.sdk.model.ImageGenerationsRequest;

/**
 * 图像模块 — 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景生成。
 *
 * <p>端点(6 个):
 * <ul>
 *   <li>POST /v1/images/generations</li>
 *   <li>POST /v1/images/edits</li>
 *   <li>POST /v1/images/inpaint</li>
 *   <li>POST /v1/images/style-transfer</li>
 *   <li>POST /v1/images/virtual-try-on</li>
 *   <li>POST /v1/images/background</li>
 * </ul>
 *
 * <p>所有端点复用 {@link ImageGenerationsRequest} 作为请求体,响应均为 JsonNode(含 images 数组)。
 */
public final class ImagesApi {

    private final BaseClient client;

    /**
     * 构造 ImagesApi。
     *
     * @param client 底层 BaseClient
     */
    public ImagesApi(BaseClient client) {
        this.client = client;
    }

    /**
     * POST /v1/images/generations(文生图)。
     *
     * @param req 图像生成请求
     * @return 生成结果(JsonNode,含 data 数组)
     */
    public JsonNode generations(ImageGenerationsRequest req) {
        return client.request("POST", "/images/generations", req, JsonNode.class);
    }

    /**
     * POST /v1/images/edits(图片编辑)。
     *
     * @param req 图像编辑请求(需 image / prompt)
     * @return 编辑结果(JsonNode)
     */
    public JsonNode edits(ImageGenerationsRequest req) {
        return client.request("POST", "/images/edits", req, JsonNode.class);
    }

    /**
     * POST /v1/images/inpaint(图片修复)。
     *
     * @param req 图像修复请求(需 image / mask / prompt)
     * @return 修复结果(JsonNode)
     */
    public JsonNode inpaint(ImageGenerationsRequest req) {
        return client.request("POST", "/images/inpaint", req, JsonNode.class);
    }

    /**
     * POST /v1/images/style-transfer(风格迁移)。
     *
     * @param req 风格迁移请求(需 image / style)
     * @return 迁移结果(JsonNode)
     */
    public JsonNode styleTransfer(ImageGenerationsRequest req) {
        return client.request("POST", "/images/style-transfer", req, JsonNode.class);
    }

    /**
     * POST /v1/images/virtual-try-on(虚拟试穿)。
     *
     * @param req 试穿请求(需 image / garment)
     * @return 试穿结果(JsonNode)
     */
    public JsonNode virtualTryOn(ImageGenerationsRequest req) {
        return client.request("POST", "/images/virtual-try-on", req, JsonNode.class);
    }

    /**
     * POST /v1/images/background(背景生成)。
     *
     * @param req 背景生成请求(需 image / prompt)
     * @return 生成结果(JsonNode)
     */
    public JsonNode background(ImageGenerationsRequest req) {
        return client.request("POST", "/images/background", req, JsonNode.class);
    }
}
