# zhs_api.CozeWorkflowsApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_workflow_run_api_v1_coze_workflows_workflows_runs_post**](CozeWorkflowsApi.md#create_workflow_run_api_v1_coze_workflows_workflows_runs_post) | **POST** /api/v1/coze/workflows/workflows/runs | Create Workflow Run
[**get_node_history_api_v1_coze_workflows_workflows_runs_execute_nodes_post**](CozeWorkflowsApi.md#get_node_history_api_v1_coze_workflows_workflows_runs_execute_nodes_post) | **POST** /api/v1/coze/workflows/workflows/runs/execute-nodes | Get Node History
[**get_run_history_api_v1_coze_workflows_workflows_runs_history_post**](CozeWorkflowsApi.md#get_run_history_api_v1_coze_workflows_workflows_runs_history_post) | **POST** /api/v1/coze/workflows/workflows/runs/history | Get Run History
[**resume_workflow_api_v1_coze_workflows_workflows_runs_resume_post**](CozeWorkflowsApi.md#resume_workflow_api_v1_coze_workflows_workflows_runs_resume_post) | **POST** /api/v1/coze/workflows/workflows/runs/resume | Resume Workflow
[**search_model_workflow_api_v1_coze_workflows_workflows_search_model_workflow_run_post**](CozeWorkflowsApi.md#search_model_workflow_api_v1_coze_workflows_workflows_search_model_workflow_run_post) | **POST** /api/v1/coze/workflows/workflows/search/model/workflow/run | Search Model Workflow
[**stream_workflow_api_v1_coze_workflows_workflows_runs_stream_post**](CozeWorkflowsApi.md#stream_workflow_api_v1_coze_workflows_workflows_runs_stream_post) | **POST** /api/v1/coze/workflows/workflows/runs/stream | Stream Workflow


# **create_workflow_run_api_v1_coze_workflows_workflows_runs_post**
> object create_workflow_run_api_v1_coze_workflows_workflows_runs_post(workflow_run_req)

Create Workflow Run

### Example


```python
import zhs_api
from zhs_api.models.workflow_run_req import WorkflowRunReq
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
    api_instance = zhs_api.CozeWorkflowsApi(api_client)
    workflow_run_req = zhs_api.WorkflowRunReq() # WorkflowRunReq | 

    try:
        # Create Workflow Run
        api_response = api_instance.create_workflow_run_api_v1_coze_workflows_workflows_runs_post(workflow_run_req)
        print("The response of CozeWorkflowsApi->create_workflow_run_api_v1_coze_workflows_workflows_runs_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeWorkflowsApi->create_workflow_run_api_v1_coze_workflows_workflows_runs_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflow_run_req** | [**WorkflowRunReq**](WorkflowRunReq.md)|  | 

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

# **get_node_history_api_v1_coze_workflows_workflows_runs_execute_nodes_post**
> object get_node_history_api_v1_coze_workflows_workflows_runs_execute_nodes_post(workflow_node_execute_req)

Get Node History

### Example


```python
import zhs_api
from zhs_api.models.workflow_node_execute_req import WorkflowNodeExecuteReq
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
    api_instance = zhs_api.CozeWorkflowsApi(api_client)
    workflow_node_execute_req = zhs_api.WorkflowNodeExecuteReq() # WorkflowNodeExecuteReq | 

    try:
        # Get Node History
        api_response = api_instance.get_node_history_api_v1_coze_workflows_workflows_runs_execute_nodes_post(workflow_node_execute_req)
        print("The response of CozeWorkflowsApi->get_node_history_api_v1_coze_workflows_workflows_runs_execute_nodes_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeWorkflowsApi->get_node_history_api_v1_coze_workflows_workflows_runs_execute_nodes_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflow_node_execute_req** | [**WorkflowNodeExecuteReq**](WorkflowNodeExecuteReq.md)|  | 

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

# **get_run_history_api_v1_coze_workflows_workflows_runs_history_post**
> object get_run_history_api_v1_coze_workflows_workflows_runs_history_post(workflow_run_history_req)

Get Run History

### Example


```python
import zhs_api
from zhs_api.models.workflow_run_history_req import WorkflowRunHistoryReq
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
    api_instance = zhs_api.CozeWorkflowsApi(api_client)
    workflow_run_history_req = zhs_api.WorkflowRunHistoryReq() # WorkflowRunHistoryReq | 

    try:
        # Get Run History
        api_response = api_instance.get_run_history_api_v1_coze_workflows_workflows_runs_history_post(workflow_run_history_req)
        print("The response of CozeWorkflowsApi->get_run_history_api_v1_coze_workflows_workflows_runs_history_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeWorkflowsApi->get_run_history_api_v1_coze_workflows_workflows_runs_history_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflow_run_history_req** | [**WorkflowRunHistoryReq**](WorkflowRunHistoryReq.md)|  | 

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

# **resume_workflow_api_v1_coze_workflows_workflows_runs_resume_post**
> object resume_workflow_api_v1_coze_workflows_workflows_runs_resume_post(workflow_resume_req)

Resume Workflow

### Example


```python
import zhs_api
from zhs_api.models.workflow_resume_req import WorkflowResumeReq
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
    api_instance = zhs_api.CozeWorkflowsApi(api_client)
    workflow_resume_req = zhs_api.WorkflowResumeReq() # WorkflowResumeReq | 

    try:
        # Resume Workflow
        api_response = api_instance.resume_workflow_api_v1_coze_workflows_workflows_runs_resume_post(workflow_resume_req)
        print("The response of CozeWorkflowsApi->resume_workflow_api_v1_coze_workflows_workflows_runs_resume_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeWorkflowsApi->resume_workflow_api_v1_coze_workflows_workflows_runs_resume_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflow_resume_req** | [**WorkflowResumeReq**](WorkflowResumeReq.md)|  | 

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

# **search_model_workflow_api_v1_coze_workflows_workflows_search_model_workflow_run_post**
> object search_model_workflow_api_v1_coze_workflows_workflows_search_model_workflow_run_post(model_search_req)

Search Model Workflow

### Example


```python
import zhs_api
from zhs_api.models.model_search_req import ModelSearchReq
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
    api_instance = zhs_api.CozeWorkflowsApi(api_client)
    model_search_req = zhs_api.ModelSearchReq() # ModelSearchReq | 

    try:
        # Search Model Workflow
        api_response = api_instance.search_model_workflow_api_v1_coze_workflows_workflows_search_model_workflow_run_post(model_search_req)
        print("The response of CozeWorkflowsApi->search_model_workflow_api_v1_coze_workflows_workflows_search_model_workflow_run_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeWorkflowsApi->search_model_workflow_api_v1_coze_workflows_workflows_search_model_workflow_run_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **model_search_req** | [**ModelSearchReq**](ModelSearchReq.md)|  | 

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

# **stream_workflow_api_v1_coze_workflows_workflows_runs_stream_post**
> object stream_workflow_api_v1_coze_workflows_workflows_runs_stream_post(workflow_run_req)

Stream Workflow

### Example


```python
import zhs_api
from zhs_api.models.workflow_run_req import WorkflowRunReq
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
    api_instance = zhs_api.CozeWorkflowsApi(api_client)
    workflow_run_req = zhs_api.WorkflowRunReq() # WorkflowRunReq | 

    try:
        # Stream Workflow
        api_response = api_instance.stream_workflow_api_v1_coze_workflows_workflows_runs_stream_post(workflow_run_req)
        print("The response of CozeWorkflowsApi->stream_workflow_api_v1_coze_workflows_workflows_runs_stream_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeWorkflowsApi->stream_workflow_api_v1_coze_workflows_workflows_runs_stream_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflow_run_req** | [**WorkflowRunReq**](WorkflowRunReq.md)|  | 

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

