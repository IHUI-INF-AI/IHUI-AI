# zhs_api.AITencentApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_active_jobs_api_v1_ai_tencent_hunyuan3d_active_jobs_get**](AITencentApi.md#get_active_jobs_api_v1_ai_tencent_hunyuan3d_active_jobs_get) | **GET** /api/v1/ai/tencent/hunyuan3d/active-jobs | 查看当前活跃任务
[**query_hunyuan3d_api_v1_ai_tencent_hunyuan3d_task_task_id_get**](AITencentApi.md#query_hunyuan3d_api_v1_ai_tencent_hunyuan3d_task_task_id_get) | **GET** /api/v1/ai/tencent/hunyuan3d/task/{task_id} | 查询混元3D任务状态
[**query_hunyuan3d_post_api_v1_ai_tencent_hunyuan3d_query_post**](AITencentApi.md#query_hunyuan3d_post_api_v1_ai_tencent_hunyuan3d_query_post) | **POST** /api/v1/ai/tencent/hunyuan3d/query | 查询混元3D任务状态
[**submit_hunyuan3d_api_v1_ai_tencent_hunyuan3d_submit_post**](AITencentApi.md#submit_hunyuan3d_api_v1_ai_tencent_hunyuan3d_submit_post) | **POST** /api/v1/ai/tencent/hunyuan3d/submit | 提交混元3D任务


# **get_active_jobs_api_v1_ai_tencent_hunyuan3d_active_jobs_get**
> object get_active_jobs_api_v1_ai_tencent_hunyuan3d_active_jobs_get()

查看当前活跃任务

View currently active polling jobs.

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
    api_instance = zhs_api.AITencentApi(api_client)

    try:
        # 查看当前活跃任务
        api_response = api_instance.get_active_jobs_api_v1_ai_tencent_hunyuan3d_active_jobs_get()
        print("The response of AITencentApi->get_active_jobs_api_v1_ai_tencent_hunyuan3d_active_jobs_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AITencentApi->get_active_jobs_api_v1_ai_tencent_hunyuan3d_active_jobs_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **query_hunyuan3d_api_v1_ai_tencent_hunyuan3d_task_task_id_get**
> object query_hunyuan3d_api_v1_ai_tencent_hunyuan3d_task_task_id_get(task_id)

查询混元3D任务状态

Query the status and result of a Hunyuan 3D task via path parameter.

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
    api_instance = zhs_api.AITencentApi(api_client)
    task_id = 'task_id_example' # str | 

    try:
        # 查询混元3D任务状态
        api_response = api_instance.query_hunyuan3d_api_v1_ai_tencent_hunyuan3d_task_task_id_get(task_id)
        print("The response of AITencentApi->query_hunyuan3d_api_v1_ai_tencent_hunyuan3d_task_task_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AITencentApi->query_hunyuan3d_api_v1_ai_tencent_hunyuan3d_task_task_id_get: %s\n" % e)
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

# **query_hunyuan3d_post_api_v1_ai_tencent_hunyuan3d_query_post**
> object query_hunyuan3d_post_api_v1_ai_tencent_hunyuan3d_query_post(query_hunyuan3_d_request)

查询混元3D任务状态

Query the status and result of a Hunyuan 3D task via POST body.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.query_hunyuan3_d_request import QueryHunyuan3DRequest
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
    api_instance = zhs_api.AITencentApi(api_client)
    query_hunyuan3_d_request = zhs_api.QueryHunyuan3DRequest() # QueryHunyuan3DRequest | 

    try:
        # 查询混元3D任务状态
        api_response = api_instance.query_hunyuan3d_post_api_v1_ai_tencent_hunyuan3d_query_post(query_hunyuan3_d_request)
        print("The response of AITencentApi->query_hunyuan3d_post_api_v1_ai_tencent_hunyuan3d_query_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AITencentApi->query_hunyuan3d_post_api_v1_ai_tencent_hunyuan3d_query_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **query_hunyuan3_d_request** | [**QueryHunyuan3DRequest**](QueryHunyuan3DRequest.md)|  | 

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

# **submit_hunyuan3d_api_v1_ai_tencent_hunyuan3d_submit_post**
> object submit_hunyuan3d_api_v1_ai_tencent_hunyuan3d_submit_post(submit_hunyuan3_d_request)

提交混元3D任务

Submit a Hunyuan 3D model generation task (text-to-3D or image-to-3D).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.submit_hunyuan3_d_request import SubmitHunyuan3DRequest
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
    api_instance = zhs_api.AITencentApi(api_client)
    submit_hunyuan3_d_request = zhs_api.SubmitHunyuan3DRequest() # SubmitHunyuan3DRequest | 

    try:
        # 提交混元3D任务
        api_response = api_instance.submit_hunyuan3d_api_v1_ai_tencent_hunyuan3d_submit_post(submit_hunyuan3_d_request)
        print("The response of AITencentApi->submit_hunyuan3d_api_v1_ai_tencent_hunyuan3d_submit_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AITencentApi->submit_hunyuan3d_api_v1_ai_tencent_hunyuan3d_submit_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **submit_hunyuan3_d_request** | [**SubmitHunyuan3DRequest**](SubmitHunyuan3DRequest.md)|  | 

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

