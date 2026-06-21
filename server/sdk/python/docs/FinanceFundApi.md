# zhs_api.FinanceFundApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**agent_transfer_notify_api_v1_finance_fund_agent_transfer_notify_post**](FinanceFundApi.md#agent_transfer_notify_api_v1_finance_fund_agent_transfer_notify_post) | **POST** /api/v1/finance/fund/agent/transfer/notify | Agent Transfer Notify
[**file_to_stream_api_v1_finance_fund_file_to_stream_post**](FinanceFundApi.md#file_to_stream_api_v1_finance_fund_file_to_stream_post) | **POST** /api/v1/finance/fund/file/to/stream | File To Stream
[**fund_app_notify_api_v1_finance_fund_app_notify_post**](FinanceFundApi.md#fund_app_notify_api_v1_finance_fund_app_notify_post) | **POST** /api/v1/finance/fund/app/notify | Fund App Notify
[**fund_notify_api_v1_finance_fund_notify_post**](FinanceFundApi.md#fund_notify_api_v1_finance_fund_notify_post) | **POST** /api/v1/finance/fund/notify | Fund Notify
[**get_info_api_v1_finance_fund_get_info_get**](FinanceFundApi.md#get_info_api_v1_finance_fund_get_info_get) | **GET** /api/v1/finance/fund/getInfo | Get Info
[**get_product_api_v1_finance_fund_get_product_get**](FinanceFundApi.md#get_product_api_v1_finance_fund_get_product_get) | **GET** /api/v1/finance/fund/getProduct | Get Product
[**get_statistics_api_v1_finance_fund_get_statistics_get**](FinanceFundApi.md#get_statistics_api_v1_finance_fund_get_statistics_get) | **GET** /api/v1/finance/fund/getStatistics | Get Statistics
[**use_token_api_v1_finance_fund_use_token_post**](FinanceFundApi.md#use_token_api_v1_finance_fund_use_token_post) | **POST** /api/v1/finance/fund/useToken | Use Token


# **agent_transfer_notify_api_v1_finance_fund_agent_transfer_notify_post**
> object agent_transfer_notify_api_v1_finance_fund_agent_transfer_notify_post()

Agent Transfer Notify

### Example


```python
import zhs_api
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
    api_instance = zhs_api.FinanceFundApi(api_client)

    try:
        # Agent Transfer Notify
        api_response = api_instance.agent_transfer_notify_api_v1_finance_fund_agent_transfer_notify_post()
        print("The response of FinanceFundApi->agent_transfer_notify_api_v1_finance_fund_agent_transfer_notify_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceFundApi->agent_transfer_notify_api_v1_finance_fund_agent_transfer_notify_post: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **file_to_stream_api_v1_finance_fund_file_to_stream_post**
> object file_to_stream_api_v1_finance_fund_file_to_stream_post()

File To Stream

### Example


```python
import zhs_api
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
    api_instance = zhs_api.FinanceFundApi(api_client)

    try:
        # File To Stream
        api_response = api_instance.file_to_stream_api_v1_finance_fund_file_to_stream_post()
        print("The response of FinanceFundApi->file_to_stream_api_v1_finance_fund_file_to_stream_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceFundApi->file_to_stream_api_v1_finance_fund_file_to_stream_post: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fund_app_notify_api_v1_finance_fund_app_notify_post**
> object fund_app_notify_api_v1_finance_fund_app_notify_post()

Fund App Notify

### Example


```python
import zhs_api
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
    api_instance = zhs_api.FinanceFundApi(api_client)

    try:
        # Fund App Notify
        api_response = api_instance.fund_app_notify_api_v1_finance_fund_app_notify_post()
        print("The response of FinanceFundApi->fund_app_notify_api_v1_finance_fund_app_notify_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceFundApi->fund_app_notify_api_v1_finance_fund_app_notify_post: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fund_notify_api_v1_finance_fund_notify_post**
> object fund_notify_api_v1_finance_fund_notify_post()

Fund Notify

### Example


```python
import zhs_api
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
    api_instance = zhs_api.FinanceFundApi(api_client)

    try:
        # Fund Notify
        api_response = api_instance.fund_notify_api_v1_finance_fund_notify_post()
        print("The response of FinanceFundApi->fund_notify_api_v1_finance_fund_notify_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceFundApi->fund_notify_api_v1_finance_fund_notify_post: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_info_api_v1_finance_fund_get_info_get**
> object get_info_api_v1_finance_fund_get_info_get(token)

Get Info

### Example


```python
import zhs_api
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
    api_instance = zhs_api.FinanceFundApi(api_client)
    token = 'token_example' # str | user uuid

    try:
        # Get Info
        api_response = api_instance.get_info_api_v1_finance_fund_get_info_get(token)
        print("The response of FinanceFundApi->get_info_api_v1_finance_fund_get_info_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceFundApi->get_info_api_v1_finance_fund_get_info_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **token** | **str**| user uuid | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_product_api_v1_finance_fund_get_product_get**
> object get_product_api_v1_finance_fund_get_product_get()

Get Product

### Example


```python
import zhs_api
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
    api_instance = zhs_api.FinanceFundApi(api_client)

    try:
        # Get Product
        api_response = api_instance.get_product_api_v1_finance_fund_get_product_get()
        print("The response of FinanceFundApi->get_product_api_v1_finance_fund_get_product_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceFundApi->get_product_api_v1_finance_fund_get_product_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_statistics_api_v1_finance_fund_get_statistics_get**
> object get_statistics_api_v1_finance_fund_get_statistics_get()

Get Statistics

### Example


```python
import zhs_api
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
    api_instance = zhs_api.FinanceFundApi(api_client)

    try:
        # Get Statistics
        api_response = api_instance.get_statistics_api_v1_finance_fund_get_statistics_get()
        print("The response of FinanceFundApi->get_statistics_api_v1_finance_fund_get_statistics_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceFundApi->get_statistics_api_v1_finance_fund_get_statistics_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **use_token_api_v1_finance_fund_use_token_post**
> object use_token_api_v1_finance_fund_use_token_post(platform=platform)

Use Token

### Example


```python
import zhs_api
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
    api_instance = zhs_api.FinanceFundApi(api_client)
    platform = 'WEB' # str |  (optional) (default to 'WEB')

    try:
        # Use Token
        api_response = api_instance.use_token_api_v1_finance_fund_use_token_post(platform=platform)
        print("The response of FinanceFundApi->use_token_api_v1_finance_fund_use_token_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FinanceFundApi->use_token_api_v1_finance_fund_use_token_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform** | **str**|  | [optional] [default to &#39;WEB&#39;]

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

