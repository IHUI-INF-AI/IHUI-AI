# zhs_api.AIN8NApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**add_agent_api_v1_ai_n8n_add_agent_post**](AIN8NApi.md#add_agent_api_v1_ai_n8n_add_agent_post) | **POST** /api/v1/ai/n8n/addAgent | 通过N8N接口新增智能体
[**get_n8n_workflows_api_v1_ai_n8n_workflows_post**](AIN8NApi.md#get_n8n_workflows_api_v1_ai_n8n_workflows_post) | **POST** /api/v1/ai/n8n/workflows | 查询N8N工作流列表
[**run_workflow_api_v1_ai_n8n_workflow_run_post**](AIN8NApi.md#run_workflow_api_v1_ai_n8n_workflow_run_post) | **POST** /api/v1/ai/n8n/workflow/run | 运行N8N工作流


# **add_agent_api_v1_ai_n8n_add_agent_post**
> object add_agent_api_v1_ai_n8n_add_agent_post(add_agent_request)

通过N8N接口新增智能体

Add a new agent to the agents table and create an examination record.
Matches the original n8n_proxy.py /addAgent endpoint.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.add_agent_request import AddAgentRequest
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
    api_instance = zhs_api.AIN8NApi(api_client)
    add_agent_request = zhs_api.AddAgentRequest() # AddAgentRequest | 

    try:
        # 通过N8N接口新增智能体
        api_response = api_instance.add_agent_api_v1_ai_n8n_add_agent_post(add_agent_request)
        print("The response of AIN8NApi->add_agent_api_v1_ai_n8n_add_agent_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIN8NApi->add_agent_api_v1_ai_n8n_add_agent_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **add_agent_request** | [**AddAgentRequest**](AddAgentRequest.md)|  | 

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

# **get_n8n_workflows_api_v1_ai_n8n_workflows_post**
> object get_n8n_workflows_api_v1_ai_n8n_workflows_post(n8_n_workflows_request)

查询N8N工作流列表

Queries n8n workflows and returns a formatted list.
Matches the original n8n_proxy.py /workflows endpoint.

/cozeZhsApi/n8n/workflows -> POST here

### Example


```python
import zhs_api
from zhs_api.models.n8_n_workflows_request import N8NWorkflowsRequest
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
    api_instance = zhs_api.AIN8NApi(api_client)
    n8_n_workflows_request = zhs_api.N8NWorkflowsRequest() # N8NWorkflowsRequest | 

    try:
        # 查询N8N工作流列表
        api_response = api_instance.get_n8n_workflows_api_v1_ai_n8n_workflows_post(n8_n_workflows_request)
        print("The response of AIN8NApi->get_n8n_workflows_api_v1_ai_n8n_workflows_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIN8NApi->get_n8n_workflows_api_v1_ai_n8n_workflows_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **n8_n_workflows_request** | [**N8NWorkflowsRequest**](N8NWorkflowsRequest.md)|  | 

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

# **run_workflow_api_v1_ai_n8n_workflow_run_post**
> object run_workflow_api_v1_ai_n8n_workflow_run_post(workflow_run_request)

运行N8N工作流

Trigger an N8N workflow execution via webhook or API.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.workflow_run_request import WorkflowRunRequest
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
    api_instance = zhs_api.AIN8NApi(api_client)
    workflow_run_request = zhs_api.WorkflowRunRequest() # WorkflowRunRequest | 

    try:
        # 运行N8N工作流
        api_response = api_instance.run_workflow_api_v1_ai_n8n_workflow_run_post(workflow_run_request)
        print("The response of AIN8NApi->run_workflow_api_v1_ai_n8n_workflow_run_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIN8NApi->run_workflow_api_v1_ai_n8n_workflow_run_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflow_run_request** | [**WorkflowRunRequest**](WorkflowRunRequest.md)|  | 

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

