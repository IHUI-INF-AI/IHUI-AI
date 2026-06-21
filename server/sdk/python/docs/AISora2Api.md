# zhs_api.AISora2Api

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**generate_video_api_v1_ai_sora2_generate_video_post**](AISora2Api.md#generate_video_api_v1_ai_sora2_generate_video_post) | **POST** /api/v1/ai/sora2/generate/video | Sora2/Veo AI 视频生成
[**query_video_api_v1_ai_sora2_video_task_id_get**](AISora2Api.md#query_video_api_v1_ai_sora2_video_task_id_get) | **GET** /api/v1/ai/sora2/video/{task_id} | 查询Sora2视频生成任务状态


# **generate_video_api_v1_ai_sora2_generate_video_post**
> object generate_video_api_v1_ai_sora2_generate_video_post(generate_video_request)

Sora2/Veo AI 视频生成

Submit a video generation task via the yunwu.ai proxy.

Flow (matching original luyala_proxy.py):
1. POST to create video task -> returns task id
2. Sync poll for up to 5 minutes (30 x 10s)
3. If not done, return pending + continue background poll for 10 minutes

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.generate_video_request import GenerateVideoRequest
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.AISora2Api(api_client)
    generate_video_request = zhs_api.GenerateVideoRequest() # GenerateVideoRequest | 

    try:
        # Sora2/Veo AI 视频生成
        api_response = api_instance.generate_video_api_v1_ai_sora2_generate_video_post(generate_video_request)
        print("The response of AISora2Api->generate_video_api_v1_ai_sora2_generate_video_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AISora2Api->generate_video_api_v1_ai_sora2_generate_video_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **generate_video_request** | [**GenerateVideoRequest**](GenerateVideoRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **query_video_api_v1_ai_sora2_video_task_id_get**
> object query_video_api_v1_ai_sora2_video_task_id_get(task_id)

查询Sora2视频生成任务状态

Query the status and result of a Sora 2 video generation task.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.AISora2Api(api_client)
    task_id = 'task_id_example' # str | 

    try:
        # 查询Sora2视频生成任务状态
        api_response = api_instance.query_video_api_v1_ai_sora2_video_task_id_get(task_id)
        print("The response of AISora2Api->query_video_api_v1_ai_sora2_video_task_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AISora2Api->query_video_api_v1_ai_sora2_video_task_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **task_id** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

