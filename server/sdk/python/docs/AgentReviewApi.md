# zhs_api.AgentReviewApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**approve_examine_api_v1_agents_record_id_approve_put**](AgentReviewApi.md#approve_examine_api_v1_agents_record_id_approve_put) | **PUT** /api/v1/agents/{record_id}/approve | Approve agent examination
[**examine_stats_api_v1_agents_stats_summary_get**](AgentReviewApi.md#examine_stats_api_v1_agents_stats_summary_get) | **GET** /api/v1/agents/stats/summary | Examination statistics
[**reject_examine_api_v1_agents_record_id_reject_put**](AgentReviewApi.md#reject_examine_api_v1_agents_record_id_reject_put) | **PUT** /api/v1/agents/{record_id}/reject | Reject agent examination
[**submit_examine_api_v1_agents_submit_post**](AgentReviewApi.md#submit_examine_api_v1_agents_submit_post) | **POST** /api/v1/agents/submit | Submit agent for examination


# **approve_examine_api_v1_agents_record_id_approve_put**
> object approve_examine_api_v1_agents_record_id_approve_put(record_id, body_approve_examine_api_v1_agents_record_id_approve_put=body_approve_examine_api_v1_agents_record_id_approve_put)

Approve agent examination

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.body_approve_examine_api_v1_agents_record_id_approve_put import BodyApproveExamineApiV1AgentsRecordIdApprovePut
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
    api_instance = zhs_api.AgentReviewApi(api_client)
    record_id = 56 # int | 
    body_approve_examine_api_v1_agents_record_id_approve_put = zhs_api.BodyApproveExamineApiV1AgentsRecordIdApprovePut() # BodyApproveExamineApiV1AgentsRecordIdApprovePut |  (optional)

    try:
        # Approve agent examination
        api_response = api_instance.approve_examine_api_v1_agents_record_id_approve_put(record_id, body_approve_examine_api_v1_agents_record_id_approve_put=body_approve_examine_api_v1_agents_record_id_approve_put)
        print("The response of AgentReviewApi->approve_examine_api_v1_agents_record_id_approve_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentReviewApi->approve_examine_api_v1_agents_record_id_approve_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **record_id** | **int**|  | 
 **body_approve_examine_api_v1_agents_record_id_approve_put** | [**BodyApproveExamineApiV1AgentsRecordIdApprovePut**](BodyApproveExamineApiV1AgentsRecordIdApprovePut.md)|  | [optional] 

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

# **examine_stats_api_v1_agents_stats_summary_get**
> object examine_stats_api_v1_agents_stats_summary_get()

Examination statistics

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
    api_instance = zhs_api.AgentReviewApi(api_client)

    try:
        # Examination statistics
        api_response = api_instance.examine_stats_api_v1_agents_stats_summary_get()
        print("The response of AgentReviewApi->examine_stats_api_v1_agents_stats_summary_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentReviewApi->examine_stats_api_v1_agents_stats_summary_get: %s\n" % e)
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

# **reject_examine_api_v1_agents_record_id_reject_put**
> object reject_examine_api_v1_agents_record_id_reject_put(record_id, body_reject_examine_api_v1_agents_record_id_reject_put)

Reject agent examination

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.body_reject_examine_api_v1_agents_record_id_reject_put import BodyRejectExamineApiV1AgentsRecordIdRejectPut
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
    api_instance = zhs_api.AgentReviewApi(api_client)
    record_id = 56 # int | 
    body_reject_examine_api_v1_agents_record_id_reject_put = zhs_api.BodyRejectExamineApiV1AgentsRecordIdRejectPut() # BodyRejectExamineApiV1AgentsRecordIdRejectPut | 

    try:
        # Reject agent examination
        api_response = api_instance.reject_examine_api_v1_agents_record_id_reject_put(record_id, body_reject_examine_api_v1_agents_record_id_reject_put)
        print("The response of AgentReviewApi->reject_examine_api_v1_agents_record_id_reject_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentReviewApi->reject_examine_api_v1_agents_record_id_reject_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **record_id** | **int**|  | 
 **body_reject_examine_api_v1_agents_record_id_reject_put** | [**BodyRejectExamineApiV1AgentsRecordIdRejectPut**](BodyRejectExamineApiV1AgentsRecordIdRejectPut.md)|  | 

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

# **submit_examine_api_v1_agents_submit_post**
> object submit_examine_api_v1_agents_submit_post(agent_id)

Submit agent for examination

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
    api_instance = zhs_api.AgentReviewApi(api_client)
    agent_id = 'agent_id_example' # str | 

    try:
        # Submit agent for examination
        api_response = api_instance.submit_examine_api_v1_agents_submit_post(agent_id)
        print("The response of AgentReviewApi->submit_examine_api_v1_agents_submit_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentReviewApi->submit_examine_api_v1_agents_submit_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 

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

