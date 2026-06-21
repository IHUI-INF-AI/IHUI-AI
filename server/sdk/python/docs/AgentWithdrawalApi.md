# zhs_api.AgentWithdrawalApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**apply_withdrawal_api_v1_agents_apply_post**](AgentWithdrawalApi.md#apply_withdrawal_api_v1_agents_apply_post) | **POST** /api/v1/agents/apply | 申请 Agent 提现
[**get_withdrawal_api_v1_agents_withdrawal_id_get**](AgentWithdrawalApi.md#get_withdrawal_api_v1_agents_withdrawal_id_get) | **GET** /api/v1/agents/{withdrawal_id} | 提现详情


# **apply_withdrawal_api_v1_agents_apply_post**
> object apply_withdrawal_api_v1_agents_apply_post(amount, order_ids=order_ids)

申请 Agent 提现

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
    api_instance = zhs_api.AgentWithdrawalApi(api_client)
    amount = 56 # int | 提现金额（分）
    order_ids = '' # str | 关联订单号，逗号分隔 (optional) (default to '')

    try:
        # 申请 Agent 提现
        api_response = api_instance.apply_withdrawal_api_v1_agents_apply_post(amount, order_ids=order_ids)
        print("The response of AgentWithdrawalApi->apply_withdrawal_api_v1_agents_apply_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentWithdrawalApi->apply_withdrawal_api_v1_agents_apply_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **int**| 提现金额（分） | 
 **order_ids** | **str**| 关联订单号，逗号分隔 | [optional] [default to &#39;&#39;]

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

# **get_withdrawal_api_v1_agents_withdrawal_id_get**
> object get_withdrawal_api_v1_agents_withdrawal_id_get(withdrawal_id)

提现详情

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
    api_instance = zhs_api.AgentWithdrawalApi(api_client)
    withdrawal_id = 'withdrawal_id_example' # str | 

    try:
        # 提现详情
        api_response = api_instance.get_withdrawal_api_v1_agents_withdrawal_id_get(withdrawal_id)
        print("The response of AgentWithdrawalApi->get_withdrawal_api_v1_agents_withdrawal_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentWithdrawalApi->get_withdrawal_api_v1_agents_withdrawal_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **withdrawal_id** | **str**|  | 

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

