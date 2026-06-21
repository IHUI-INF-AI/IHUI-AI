# WSNoticeApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**pushNoticeWsNoticePushPost**](#pushnoticewsnoticepushpost) | **POST** /ws/notice/push | 推送实时通知到订阅者|

# **pushNoticeWsNoticePushPost**
> any pushNoticeWsNoticePushPost(noticePushReq)

对应 Java: NoticeController.push  逻辑: - userId 指定: 只推送给该 userId 的 WS 连接 - 否则按 topic 广播: 复用 notice 房间, 由前端按 topic 二次过滤

### Example

```typescript
import {
    WSNoticeApi,
    Configuration,
    NoticePushReq
} from './api';

const configuration = new Configuration();
const apiInstance = new WSNoticeApi(configuration);

let noticePushReq: NoticePushReq; //

const { status, data } = await apiInstance.pushNoticeWsNoticePushPost(
    noticePushReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **noticePushReq** | **NoticePushReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

