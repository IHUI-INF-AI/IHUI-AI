# zhs_api.AISunoApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**generate_music_api_v1_ai_suno_generate_music_post**](AISunoApi.md#generate_music_api_v1_ai_suno_generate_music_post) | **POST** /api/v1/ai/suno/generate/music | Suno AI 音乐生成
[**query_music_api_v1_ai_suno_query_music_task_id_get**](AISunoApi.md#query_music_api_v1_ai_suno_query_music_task_id_get) | **GET** /api/v1/ai/suno/query/music/{task_id} | 查询Suno音乐任务状态


# **generate_music_api_v1_ai_suno_generate_music_post**
> object generate_music_api_v1_ai_suno_generate_music_post(generate_music_request)

Suno AI 音乐生成

Submit a music generation task via the Suno API.
Returns task ID that can be polled with /query/music.

Suno API flow (matching original langchain_api_mini.py):
1. POST to create task -> returns task_id
2. GET to poll task status until completed

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.generate_music_request import GenerateMusicRequest
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
    api_instance = zhs_api.AISunoApi(api_client)
    generate_music_request = zhs_api.GenerateMusicRequest() # GenerateMusicRequest | 

    try:
        # Suno AI 音乐生成
        api_response = api_instance.generate_music_api_v1_ai_suno_generate_music_post(generate_music_request)
        print("The response of AISunoApi->generate_music_api_v1_ai_suno_generate_music_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AISunoApi->generate_music_api_v1_ai_suno_generate_music_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **generate_music_request** | [**GenerateMusicRequest**](GenerateMusicRequest.md)|  | 

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

# **query_music_api_v1_ai_suno_query_music_task_id_get**
> object query_music_api_v1_ai_suno_query_music_task_id_get(task_id)

查询Suno音乐任务状态

Poll the status of a Suno music generation task.

Returns the music URLs when completed.

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
    api_instance = zhs_api.AISunoApi(api_client)
    task_id = 'task_id_example' # str | 

    try:
        # 查询Suno音乐任务状态
        api_response = api_instance.query_music_api_v1_ai_suno_query_music_task_id_get(task_id)
        print("The response of AISunoApi->query_music_api_v1_ai_suno_query_music_task_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AISunoApi->query_music_api_v1_ai_suno_query_music_task_id_get: %s\n" % e)
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

