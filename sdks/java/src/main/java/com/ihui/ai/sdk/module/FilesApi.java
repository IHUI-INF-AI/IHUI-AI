package com.ihui.ai.sdk.module;

import com.fasterxml.jackson.databind.JsonNode;
import com.ihui.ai.sdk.BaseClient;
import com.ihui.ai.sdk.model.UploadInitRequest;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

/**
 * 文件模块 — 列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传。
 *
 * <p>端点(9 个):
 * <ul>
 *   <li>GET  /v1/files(文件列表)</li>
 *   <li>POST /v1/files(上传文件,multipart/form-data)</li>
 *   <li>GET  /v1/files/:id(文件详情)</li>
 *   <li>DELETE /v1/files/:id(删除文件)</li>
 *   <li>GET  /v1/files/:id/content(文件内容,二进制流)</li>
 *   <li>GET  /v1/files/:id/versions(文件版本)</li>
 *   <li>POST /v1/files/upload-init(分片上传初始化)</li>
 *   <li>POST /v1/files/upload-chunk(上传分片)</li>
 *   <li>POST /v1/files/complete(完成上传)</li>
 * </ul>
 */
public final class FilesApi {

    private final BaseClient client;

    /**
     * 构造 FilesApi。
     *
     * @param client 底层 BaseClient
     */
    public FilesApi(BaseClient client) {
        this.client = client;
    }

    /**
     * GET /v1/files(文件列表)。
     *
     * @return 文件列表(JsonNode)
     */
    public JsonNode list() {
        return client.request("GET", "/files", null, JsonNode.class);
    }

    /**
     * POST /v1/files(上传文件,multipart/form-data)。
     *
     * @param file 本地文件路径
     * @return 上传结果(JsonNode,含 fileId / filename / bytes)
     */
    public JsonNode upload(Path file) {
        return upload(file, file.getFileName().toString());
    }

    /**
     * POST /v1/files(上传文件,multipart/form-data,自定义文件名)。
     *
     * @param file     本地文件路径
     * @param filename 上传文件名
     * @return 上传结果(JsonNode)
     */
    public JsonNode upload(Path file, String filename) {
        try {
            byte[] data = Files.readAllBytes(file);
            return upload(data, filename, Files.probeContentType(file));
        } catch (IOException e) {
            throw new RuntimeException("Failed to read file: " + file, e);
        }
    }

    /**
     * POST /v1/files(上传字节数组,multipart/form-data)。
     *
     * @param data     文件字节
     * @param filename 文件名
     * @param mimeType MIME 类型(如 image/png;可为 null)
     * @return 上传结果(JsonNode)
     */
    public JsonNode upload(byte[] data, String filename, String mimeType) {
        Map<String, String> parts = new HashMap<>();
        Map<String, BaseClient.FilePart> files = new HashMap<>();
        files.put("file", new BaseClient.FilePart(filename, data, mimeType));
        return client.requestMultipart("/files", parts, files, JsonNode.class);
    }

    /**
     * GET /v1/files/:id(文件详情)。
     *
     * @param id 文件 ID
     * @return 文件详情(JsonNode)
     */
    public JsonNode get(String id) {
        return client.request("GET", "/files/" + BaseClient.encode(id), null, JsonNode.class);
    }

    /**
     * DELETE /v1/files/:id(删除文件)。
     *
     * @param id 文件 ID
     */
    public void delete(String id) {
        client.requestRaw("DELETE", "/files/" + BaseClient.encode(id), null);
    }

    /**
     * GET /v1/files/:id/content(文件内容,返回二进制字节)。
     *
     * @param id 文件 ID
     * @return 文件内容字节
     */
    public byte[] getContent(String id) {
        return client.requestBytes("/files/" + BaseClient.encode(id) + "/content");
    }

    /**
     * GET /v1/files/:id/versions(文件版本列表)。
     *
     * @param id 文件 ID
     * @return 版本列表(JsonNode)
     */
    public JsonNode getVersions(String id) {
        return client.request("GET", "/files/" + BaseClient.encode(id) + "/versions",
                null, JsonNode.class);
    }

    /**
     * POST /v1/files/upload-init(分片上传初始化)。
     *
     * @param req 初始化请求
     * @return 初始化结果(JsonNode,含 uploadId / chunkSize)
     */
    public JsonNode uploadInit(UploadInitRequest req) {
        return client.request("POST", "/files/upload-init", req, JsonNode.class);
    }

    /**
     * POST /v1/files/upload-chunk(上传分片,multipart)。
     *
     * @param uploadId  上传 ID(来自 upload-init)
     * @param index     分片索引(0-based)
     * @param chunkData 分片字节
     * @return 上传结果(JsonNode)
     */
    public JsonNode uploadChunk(String uploadId, int index, byte[] chunkData) {
        Map<String, String> parts = new HashMap<>();
        parts.put("uploadId", uploadId);
        parts.put("index", String.valueOf(index));
        Map<String, BaseClient.FilePart> files = new HashMap<>();
        files.put("chunk", new BaseClient.FilePart("chunk-" + index, chunkData, null));
        return client.requestMultipart("/files/upload-chunk", parts, files, JsonNode.class);
    }

    /**
     * POST /v1/files/complete(完成分片上传)。
     *
     * @param req 请求体(uploadId 等)
     * @return 完成结果(JsonNode,含 fileId / status)
     */
    public JsonNode uploadComplete(Map<String, Object> req) {
        return client.request("POST", "/files/complete", req, JsonNode.class);
    }
}