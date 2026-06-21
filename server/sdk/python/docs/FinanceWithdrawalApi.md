# zhs_api.FinanceWithdrawalApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**apply_agent_withdrawal_api_v1_finance_agent_apply_post**](FinanceWithdrawalApi.md#apply_agent_withdrawal_api_v1_finance_agent_apply_post) | **POST** /api/v1/finance/agent/apply | Agent 收益提现申请
[**apply_withdrawal_api_v1_finance_apply_post**](FinanceWithdrawalApi.md#apply_withdrawal_api_v1_finance_apply_post) | **POST** /api/v1/finance/apply | 申请提现
[**available_balance_api_v1_finance_available_get**](FinanceWithdrawalApi.md#available_balance_api_v1_finance_available_get) | **GET** /api/v1/finance/available | 个人可收款查询
[**list_agent_withdrawals_api_v1_finance_agent_list_get**](FinanceWithdrawalApi.md#list_agent_withdrawals_api_v1_finance_agent_list_get) | **GET** /api/v1/finance/agent/list | Agent 提现记录
[**list_withdrawals_api_v1_finance_list_get**](FinanceWithdrawalApi.md#list_withdrawals_api_v1_finance_list_get) | **GET** /api/v1/finance/list | 我的提现记录
[**withdrawal_summary_api_v1_finance_summary_get**](FinanceWithdrawalApi.md#withdrawal_summary_api_v1_finance_summary_get) | **GET** /api/v1/finance/summary | 提现详情面板数据（总提现/待审核/已到账）


# **apply_agent_withdrawal_api_v1_finance_agent_apply_post**
> object apply_agent_withdrawal_api_v1_finance_agent_apply_post(amount)

Agent 收益提现申请

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
    api_instance = zhs_api.FinanceWithdrawalApi(api_client)
    amount = 56 # int | 提现金额（分）

    try:
        # Agent 收益提现申请
        api_response = api_instance.apply_agent_withdrawal_api_v1_finance_agent_apply_post(amount)
        print("The response of FinanceWithdrawalApi->apply_agent_withdrawal_api_v1_finance_agent_apply_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceWithdrawalApi->apply_agent_withdrawal_api_v1_finance_agent_apply_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **int**| 提现金额（分） | 

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

# **apply_withdrawal_api_v1_finance_apply_post**
> object apply_withdrawal_api_v1_finance_apply_post(amount)

申请提现

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
    api_instance = zhs_api.FinanceWithdrawalApi(api_client)
    amount = 56 # int | 提现金额（分）

    try:
        # 申请提现
        api_response = api_instance.apply_withdrawal_api_v1_finance_apply_post(amount)
        print("The response of FinanceWithdrawalApi->apply_withdrawal_api_v1_finance_apply_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceWithdrawalApi->apply_withdrawal_api_v1_finance_apply_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **int**| 提现金额（分） | 

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

# **available_balance_api_v1_finance_available_get**
> object available_balance_api_v1_finance_available_get()

个人可收款查询

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
    api_instance = zhs_api.FinanceWithdrawalApi(api_client)

    try:
        # 个人可收款查询
        api_response = api_instance.available_balance_api_v1_finance_available_get()
        print("The response of FinanceWithdrawalApi->available_balance_api_v1_finance_available_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceWithdrawalApi->available_balance_api_v1_finance_available_get: %s\n" % e)
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

# **list_agent_withdrawals_api_v1_finance_agent_list_get**
> object list_agent_withdrawals_api_v1_finance_agent_list_get(page=page, limit=limit)

Agent 提现记录

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
    api_instance = zhs_api.FinanceWithdrawalApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # Agent 提现记录
        api_response = api_instance.list_agent_withdrawals_api_v1_finance_agent_list_get(page=page, limit=limit)
        print("The response of FinanceWithdrawalApi->list_agent_withdrawals_api_v1_finance_agent_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceWithdrawalApi->list_agent_withdrawals_api_v1_finance_agent_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]

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

# **list_withdrawals_api_v1_finance_list_get**
> object list_withdrawals_api_v1_finance_list_get(page=page, limit=limit)

我的提现记录

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
    api_instance = zhs_api.FinanceWithdrawalApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 我的提现记录
        api_response = api_instance.list_withdrawals_api_v1_finance_list_get(page=page, limit=limit)
        print("The response of FinanceWithdrawalApi->list_withdrawals_api_v1_finance_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceWithdrawalApi->list_withdrawals_api_v1_finance_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]

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

# **withdrawal_summary_api_v1_finance_summary_get**
> object withdrawal_summary_api_v1_finance_summary_get()

提现详情面板数据（总提现/待审核/已到账）

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
    api_instance = zhs_api.FinanceWithdrawalApi(api_client)

    try:
        # 提现详情面板数据（总提现/待审核/已到账）
        api_response = api_instance.withdrawal_summary_api_v1_finance_summary_get()
        print("The response of FinanceWithdrawalApi->withdrawal_summary_api_v1_finance_summary_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceWithdrawalApi->withdrawal_summary_api_v1_finance_summary_get: %s\n" % e)
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

