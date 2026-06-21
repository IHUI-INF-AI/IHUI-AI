# zhs_api.WSNoticeApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**push_notice_ws_notice_push_post**](WSNoticeApi.md#push_notice_ws_notice_push_post) | **POST** /ws/notice/push | 推送实时通知到订阅者


# **push_notice_ws_notice_push_post**
> object push_notice_ws_notice_push_post(notice_push_req)

推送实时通知到订阅者

对应 Java: NoticeController.push

逻辑:
- userId 指定: 只推送给该 userId 的 WS 连接
- 否则按 topic 广播: 复用 notice 房间, 由前端按 topic 二次过滤

### Example


```python
import zhs_api
from zhs_api.models.notice_push_req import NoticePushReq
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.WSNoticeApi(api_client)
    notice_push_req = zhs_api.NoticePushReq() # NoticePushReq | 

    try:
        # 推送实时通知到订阅者
        api_response = api_instance.push_notice_ws_notice_push_post(notice_push_req)
        print("The response of WSNoticeApi->push_notice_ws_notice_push_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSNoticeApi->push_notice_ws_notice_push_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **notice_push_req** | [**NoticePushReq**](NoticePushReq.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

