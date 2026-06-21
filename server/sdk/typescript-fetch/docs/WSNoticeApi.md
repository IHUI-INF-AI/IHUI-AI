# WSNoticeApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**pushNoticeWsNoticePushPost**](WSNoticeApi.md#pushnoticewsnoticepushpost) | **POST** /ws/notice/push | 推送实时通知到订阅者 |



## pushNoticeWsNoticePushPost

> any pushNoticeWsNoticePushPost(noticePushReq)

推送实时通知到订阅者

对应 Java: NoticeController.push  逻辑: - userId 指定: 只推送给该 userId 的 WS 连接 - 否则按 topic 广播: 复用 notice 房间, 由前端按 topic 二次过滤

### Example

```ts
import {
  Configuration,
  WSNoticeApi,
} from '';
import type { PushNoticeWsNoticePushPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WSNoticeApi();

  const body = {
    // NoticePushReq
    noticePushReq: ...,
  } satisfies PushNoticeWsNoticePushPostRequest;

  try {
    const data = await api.pushNoticeWsNoticePushPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **noticePushReq** | [NoticePushReq](NoticePushReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

