# zhs_api.CozeWorkflowsAsyncApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**run_workflow_async_api_v1_coze_workflows_async_workflows_async_post**](CozeWorkflowsAsyncApi.md#run_workflow_async_api_v1_coze_workflows_async_workflows_async_post) | **POST** /api/v1/coze/workflows/async/workflows/async | Run Workflow Async
[**stream_workflow_async_api_v1_coze_workflows_async_workflows_async_stream_post**](CozeWorkflowsAsyncApi.md#stream_workflow_async_api_v1_coze_workflows_async_workflows_async_stream_post) | **POST** /api/v1/coze/workflows/async/workflows/async/stream | Stream Workflow Async
[**workflow_chat_api_v1_coze_workflows_async_workflows_async_chat_post**](CozeWorkflowsAsyncApi.md#workflow_chat_api_v1_coze_workflows_async_workflows_async_chat_post) | **POST** /api/v1/coze/workflows/async/workflows/async/chat | Workflow Chat


# **run_workflow_async_api_v1_coze_workflows_async_workflows_async_post**
> object run_workflow_async_api_v1_coze_workflows_async_workflows_async_post(async_workflow_req)

Run Workflow Async

### Example


```python
import zhs_api
from zhs_api.models.async_workflow_req import AsyncWorkflowReq
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
    api_instance = zhs_api.CozeWorkflowsAsyncApi(api_client)
    async_workflow_req = zhs_api.AsyncWorkflowReq() # AsyncWorkflowReq | 

    try:
        # Run Workflow Async
        api_response = api_instance.run_workflow_async_api_v1_coze_workflows_async_workflows_async_post(async_workflow_req)
        print("The response of CozeWorkflowsAsyncApi->run_workflow_async_api_v1_coze_workflows_async_workflows_async_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeWorkflowsAsyncApi->run_workflow_async_api_v1_coze_workflows_async_workflows_async_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **async_workflow_req** | [**AsyncWorkflowReq**](AsyncWorkflowReq.md)|  | 

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

# **stream_workflow_async_api_v1_coze_workflows_async_workflows_async_stream_post**
> object stream_workflow_async_api_v1_coze_workflows_async_workflows_async_stream_post(async_workflow_stream_req)

Stream Workflow Async

### Example


```python
import zhs_api
from zhs_api.models.async_workflow_stream_req import AsyncWorkflowStreamReq
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
    api_instance = zhs_api.CozeWorkflowsAsyncApi(api_client)
    async_workflow_stream_req = zhs_api.AsyncWorkflowStreamReq() # AsyncWorkflowStreamReq | 

    try:
        # Stream Workflow Async
        api_response = api_instance.stream_workflow_async_api_v1_coze_workflows_async_workflows_async_stream_post(async_workflow_stream_req)
        print("The response of CozeWorkflowsAsyncApi->stream_workflow_async_api_v1_coze_workflows_async_workflows_async_stream_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeWorkflowsAsyncApi->stream_workflow_async_api_v1_coze_workflows_async_workflows_async_stream_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **async_workflow_stream_req** | [**AsyncWorkflowStreamReq**](AsyncWorkflowStreamReq.md)|  | 

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

# **workflow_chat_api_v1_coze_workflows_async_workflows_async_chat_post**
> object workflow_chat_api_v1_coze_workflows_async_workflows_async_chat_post(async_workflow_stream_req)

Workflow Chat

### Example


```python
import zhs_api
from zhs_api.models.async_workflow_stream_req import AsyncWorkflowStreamReq
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
    api_instance = zhs_api.CozeWorkflowsAsyncApi(api_client)
    async_workflow_stream_req = zhs_api.AsyncWorkflowStreamReq() # AsyncWorkflowStreamReq | 

    try:
        # Workflow Chat
        api_response = api_instance.workflow_chat_api_v1_coze_workflows_async_workflows_async_chat_post(async_workflow_stream_req)
        print("The response of CozeWorkflowsAsyncApi->workflow_chat_api_v1_coze_workflows_async_workflows_async_chat_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeWorkflowsAsyncApi->workflow_chat_api_v1_coze_workflows_async_workflows_async_chat_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **async_workflow_stream_req** | [**AsyncWorkflowStreamReq**](AsyncWorkflowStreamReq.md)|  | 

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

