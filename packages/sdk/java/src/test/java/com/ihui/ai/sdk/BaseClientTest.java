// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

package com.ihui.ai.sdk;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * BaseClient 单元测试 — 请求拼装 / 错误映射 / 重试契约。
 *
 * <p>使用 JDK 内置 com.sun.net.httpserver 构造本地假服务,无外部 mock 依赖。
 */
class BaseClientTest {

    private HttpServer server;
    private String baseUrl;
    private final ObjectMapper mapper = new ObjectMapper();

    // 请求捕获
    private volatile String lastPath;
    private volatile String lastAuth;
    private volatile String lastSecret;
    private volatile String lastMethod;
    private volatile String lastBody;

    // 响应脚本
    private volatile int respondStatus = 200;
    private volatile String respondBody = "{}";
    private final AtomicInteger callCount = new AtomicInteger();

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/", exchange -> {
            callCount.incrementAndGet();
            lastPath = exchange.getRequestURI().getPath();
            lastAuth = exchange.getRequestHeaders().getFirst("Authorization");
            lastSecret = exchange.getRequestHeaders().getFirst("X-Api-Secret");
            lastMethod = exchange.getRequestMethod();
            byte[] reqBody = exchange.getRequestBody().readAllBytes();
            lastBody = new String(reqBody, StandardCharsets.UTF_8);

            byte[] resp = respondBody.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(respondStatus, resp.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(resp);
            }
        });
        server.start();
        baseUrl = "http://localhost:" + server.getAddress().getPort();
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    private BaseClient newClient(int maxRetries) {
        return new BaseClient(SdkConfig.builder()
                .apiKey("ihui_test_key")
                .baseUrl(baseUrl)
                .maxRetries(maxRetries)
                .build());
    }

    @Test
    void postAssemblesUrlHeadersAndJsonBody() {
        Map<String, Object> body = new HashMap<>();
        body.put("model", "gpt-4o");
        body.put("messages", java.util.List.of(Map.of("role", "user", "content", "hi")));

        ModelsResponse resp = newClient(0).request("POST", "/chat/completions", body, ModelsResponse.class);
        assertNotNull(resp);
        assertEquals("/v1/chat/completions", lastPath);
        assertEquals("POST", lastMethod);
        assertEquals("Bearer ihui_test_key", lastAuth);
        assertTrue(lastBody.contains("\"model\":\"gpt-4o\""), "body should contain model field: " + lastBody);
    }

    @Test
    void secretHeaderPresentOnlyWhenConfigured() {
        BaseClient withSecret = new BaseClient(SdkConfig.builder()
                .apiKey("ihui_test_key").baseUrl(baseUrl).secret("sec_123").maxRetries(0).build());
        withSecret.requestRaw("GET", "/models", null);
        assertEquals("sec_123", lastSecret);
        assertEquals("Bearer ihui_test_key", lastAuth);
    }

    @Test
    void baseUrlTrailingSlashNormalized() {
        BaseClient c = new BaseClient(SdkConfig.builder()
                .apiKey("k").baseUrl(baseUrl + "///").maxRetries(0).build());
        assertEquals(baseUrl, c.getBaseUrl());
    }

    @Test
    void maps401ToAuthenticationException() {
        respondStatus = 401;
        respondBody = "{\"code\":\"auth_invalid_api_key\",\"message\":\"bad key\"}";
        SdkException e = assertThrows(SdkException.class,
                () -> newClient(0).requestRaw("GET", "/models", null));
        assertTrue(e instanceof AuthenticationException, "want AuthenticationException, got " + e.getClass());
        assertEquals(401, e.getStatus());
    }

    @Test
    void maps429ToQuotaExceededExceptionWithoutRetry() {
        respondStatus = 429;
        respondBody = "{\"code\":\"rate_limited\",\"message\":\"slow down\"}";
        SdkException e = assertThrows(SdkException.class,
                () -> newClient(2).requestRaw("GET", "/x", null));
        assertTrue(e instanceof QuotaExceededException, "want QuotaExceededException, got " + e.getClass());
        assertEquals(1, callCount.get(), "429 must not retry");
    }

    @Test
    void maps500ToServerExceptionWithRetries() {
        respondStatus = 500;
        respondBody = "{\"code\":\"boom\",\"message\":\"x\"}";
        SdkException e = assertThrows(SdkException.class,
                () -> newClient(1).requestRaw("GET", "/x", null));
        assertTrue(e instanceof ServerException, "want ServerException, got " + e.getClass());
        assertEquals(2, callCount.get(), "1 original + 1 retry");
    }

    @Test
    void maps404ToNotFoundExceptionWithNestedError() {
        respondStatus = 404;
        respondBody = "{\"error\":{\"code\":\"model_not_found\",\"message\":\"no such model\"}}";
        SdkException e = assertThrows(SdkException.class,
                () -> newClient(0).requestRaw("GET", "/models/gpt-9", null));
        assertTrue(e instanceof NotFoundException, "want NotFoundException, got " + e.getClass());
        assertEquals(404, e.getStatus());
    }

    @Test
    void invalidJsonErrorBodyFallsBackGracefully() {
        respondStatus = 418;
        respondBody = "<html>teapot</html>";
        SdkException e = assertThrows(SdkException.class,
                () -> newClient(0).requestRaw("GET", "/x", null));
        assertEquals(418, e.getStatus());
    }

    @Test
    void nullApiKeyRejectedByConfig() {
        assertThrows(NullPointerException.class,
                () -> SdkConfig.builder().baseUrl(baseUrl).build());
    }
}
