package com.ihui.ai.sdk;

import com.fasterxml.jackson.databind.JsonNode;
import okhttp3.Response;

import java.io.BufferedReader;
import java.io.IOException;
import java.util.Iterator;
import java.util.NoSuchElementException;

/**
 * 流式响应(SSE 解析迭代器)。
 *
 * <p>封装 Server-Sent Events 流式响应,逐行解析 {@code data: {json}} 格式。
 * 遇到 {@code data: [DONE]} 时结束迭代。
 *
 * <p>用法(try-with-resources):
 * <pre>
 * try (StreamResponse stream = client.ai.completionsStream(req)) {
 *     while (stream.hasNext()) {
 *         JsonNode chunk = stream.next();
 *         String delta = chunk.path("choices").path(0).path("delta").path("content").asText("");
 *         System.out.print(delta);
 *     }
 * }
 * </pre>
 */
public final class StreamResponse implements Iterator<JsonNode>, AutoCloseable {

    private final Response response;
    private final BufferedReader reader;
    private JsonNode nextEvent;
    private boolean closed = false;

    /**
     * 构造 StreamResponse。
     *
     * @param response OkHttp Response(必须已 successful 且有 body)
     * @throws IOException 打开读取流失败
     */
    public StreamResponse(Response response) throws IOException {
        this.response = response;
        this.reader = BaseClient.newReader(response);
        this.nextEvent = parseNext();
    }

    @Override
    public boolean hasNext() {
        return nextEvent != null;
    }

    @Override
    public JsonNode next() {
        if (nextEvent == null) {
            throw new NoSuchElementException("Stream exhausted");
        }
        JsonNode current = nextEvent;
        try {
            nextEvent = parseNext();
        } catch (IOException e) {
            throw new SdkException(0, "stream_read_error",
                    "Stream read failed: " + e.getMessage(), null);
        }
        return current;
    }

    private JsonNode parseNext() throws IOException {
        String line;
        while ((line = reader.readLine()) != null) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            if (!trimmed.startsWith("data:")) {
                // 跳过 event:/注释/心跳行
                continue;
            }
            String payload = trimmed.substring(5).trim();
            if ("[DONE]".equals(payload)) {
                return null;
            }
            try {
                return JsonUtil.MAPPER.readTree(payload);
            } catch (IOException e) {
                // 跳过无法解析的行
            }
        }
        return null;
    }

    @Override
    public void close() {
        if (closed) {
            return;
        }
        closed = true;
        try {
            reader.close();
        } catch (IOException e) {
            // 静默关闭
        }
        response.close();
    }
}
