# zhs_api.ReconciliationApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**alipay_reconcile_api_v1_payments_alipay_get**](ReconciliationApi.md#alipay_reconcile_api_v1_payments_alipay_get) | **GET** /api/v1/payments/alipay | 拉取支付宝某天账单并对账
[**all_reconcile_api_v1_payments_all_get**](ReconciliationApi.md#all_reconcile_api_v1_payments_all_get) | **GET** /api/v1/payments/all | 拉取支付宝 + 微信双边对账
[**auto_reconcile_api_v1_payments_auto_post**](ReconciliationApi.md#auto_reconcile_api_v1_payments_auto_post) | **POST** /api/v1/payments/auto | 手动触发自动对账（昨天）
[**close_expired_api_v1_payments_close_expired_post**](ReconciliationApi.md#close_expired_api_v1_payments_close_expired_post) | **POST** /api/v1/payments/close_expired | 关闭 30 分钟未支付订单
[**list_pending_api_v1_payments_pending_get**](ReconciliationApi.md#list_pending_api_v1_payments_pending_get) | **GET** /api/v1/payments/pending | 查询超时未支付订单
[**wechat_reconcile_api_v1_payments_wechat_get**](ReconciliationApi.md#wechat_reconcile_api_v1_payments_wechat_get) | **GET** /api/v1/payments/wechat | 拉取微信某天账单并对账


# **alipay_reconcile_api_v1_payments_alipay_get**
> object alipay_reconcile_api_v1_payments_alipay_get(bill_date=bill_date)

拉取支付宝某天账单并对账

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
    api_instance = zhs_api.ReconciliationApi(api_client)
    bill_date = 'bill_date_example' # str | yyyy-MM-dd，默认昨天 (optional)

    try:
        # 拉取支付宝某天账单并对账
        api_response = api_instance.alipay_reconcile_api_v1_payments_alipay_get(bill_date=bill_date)
        print("The response of ReconciliationApi->alipay_reconcile_api_v1_payments_alipay_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ReconciliationApi->alipay_reconcile_api_v1_payments_alipay_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bill_date** | **str**| yyyy-MM-dd，默认昨天 | [optional] 

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

# **all_reconcile_api_v1_payments_all_get**
> object all_reconcile_api_v1_payments_all_get(bill_date=bill_date)

拉取支付宝 + 微信双边对账

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
    api_instance = zhs_api.ReconciliationApi(api_client)
    bill_date = 'bill_date_example' # str | yyyy-MM-dd，默认昨天 (optional)

    try:
        # 拉取支付宝 + 微信双边对账
        api_response = api_instance.all_reconcile_api_v1_payments_all_get(bill_date=bill_date)
        print("The response of ReconciliationApi->all_reconcile_api_v1_payments_all_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ReconciliationApi->all_reconcile_api_v1_payments_all_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bill_date** | **str**| yyyy-MM-dd，默认昨天 | [optional] 

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

# **auto_reconcile_api_v1_payments_auto_post**
> object auto_reconcile_api_v1_payments_auto_post()

手动触发自动对账（昨天）

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
    api_instance = zhs_api.ReconciliationApi(api_client)

    try:
        # 手动触发自动对账（昨天）
        api_response = api_instance.auto_reconcile_api_v1_payments_auto_post()
        print("The response of ReconciliationApi->auto_reconcile_api_v1_payments_auto_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ReconciliationApi->auto_reconcile_api_v1_payments_auto_post: %s\n" % e)
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

# **close_expired_api_v1_payments_close_expired_post**
> object close_expired_api_v1_payments_close_expired_post()

关闭 30 分钟未支付订单

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
    api_instance = zhs_api.ReconciliationApi(api_client)

    try:
        # 关闭 30 分钟未支付订单
        api_response = api_instance.close_expired_api_v1_payments_close_expired_post()
        print("The response of ReconciliationApi->close_expired_api_v1_payments_close_expired_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ReconciliationApi->close_expired_api_v1_payments_close_expired_post: %s\n" % e)
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

# **list_pending_api_v1_payments_pending_get**
> object list_pending_api_v1_payments_pending_get()

查询超时未支付订单

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
    api_instance = zhs_api.ReconciliationApi(api_client)

    try:
        # 查询超时未支付订单
        api_response = api_instance.list_pending_api_v1_payments_pending_get()
        print("The response of ReconciliationApi->list_pending_api_v1_payments_pending_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ReconciliationApi->list_pending_api_v1_payments_pending_get: %s\n" % e)
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

# **wechat_reconcile_api_v1_payments_wechat_get**
> object wechat_reconcile_api_v1_payments_wechat_get(bill_date=bill_date)

拉取微信某天账单并对账

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
    api_instance = zhs_api.ReconciliationApi(api_client)
    bill_date = 'bill_date_example' # str | yyyy-MM-dd，默认昨天 (optional)

    try:
        # 拉取微信某天账单并对账
        api_response = api_instance.wechat_reconcile_api_v1_payments_wechat_get(bill_date=bill_date)
        print("The response of ReconciliationApi->wechat_reconcile_api_v1_payments_wechat_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ReconciliationApi->wechat_reconcile_api_v1_payments_wechat_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bill_date** | **str**| yyyy-MM-dd，默认昨天 | [optional] 

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

