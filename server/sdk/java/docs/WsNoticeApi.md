# WsNoticeApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**pushNoticeWsNoticePushPost**](WsNoticeApi.md#pushNoticeWsNoticePushPost) | **POST** /ws/notice/push | 推送实时通知到订阅者 |


<a id="pushNoticeWsNoticePushPost"></a>
# **pushNoticeWsNoticePushPost**
> Object pushNoticeWsNoticePushPost(noticePushReq)

推送实时通知到订阅者

对应 Java: NoticeController.push  逻辑: - userId 指定: 只推送给该 userId 的 WS 连接 - 否则按 topic 广播: 复用 notice 房间, 由前端按 topic 二次过滤

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsNoticeApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    WsNoticeApi apiInstance = new WsNoticeApi(defaultClient);
    NoticePushReq noticePushReq = new NoticePushReq(); // NoticePushReq | 
    try {
      Object result = apiInstance.pushNoticeWsNoticePushPost(noticePushReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsNoticeApi#pushNoticeWsNoticePushPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **noticePushReq** | [**NoticePushReq**](NoticePushReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

