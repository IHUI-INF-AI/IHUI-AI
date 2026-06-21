# zhs_api.AlipayApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**alipay_query_api_v1_payments_alipay_query_post**](AlipayApi.md#alipay_query_api_v1_payments_alipay_query_post) | **POST** /api/v1/payments/alipay/query | Query Alipay order
[**alipay_refund_api_v1_payments_alipay_refund_post**](AlipayApi.md#alipay_refund_api_v1_payments_alipay_refund_post) | **POST** /api/v1/payments/alipay/refund | Alipay 退款（调用 alipay.trade.refund）
[**create_alipay_api_v1_payments_alipay_create_post**](AlipayApi.md#create_alipay_api_v1_payments_alipay_create_post) | **POST** /api/v1/payments/alipay/create | Create Alipay PC / H5 page pay
[**create_alipay_app_api_v1_payments_alipay_app_create_post**](AlipayApi.md#create_alipay_app_api_v1_payments_alipay_app_create_post) | **POST** /api/v1/payments/alipay/app/create | Create Alipay order for mobile app


# **alipay_query_api_v1_payments_alipay_query_post**
> object alipay_query_api_v1_payments_alipay_query_post(out_trade_no)

Query Alipay order

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
    api_instance = zhs_api.AlipayApi(api_client)
    out_trade_no = 'out_trade_no_example' # str | 

    try:
        # Query Alipay order
        api_response = api_instance.alipay_query_api_v1_payments_alipay_query_post(out_trade_no)
        print("The response of AlipayApi->alipay_query_api_v1_payments_alipay_query_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AlipayApi->alipay_query_api_v1_payments_alipay_query_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **out_trade_no** | **str**|  | 

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

# **alipay_refund_api_v1_payments_alipay_refund_post**
> object alipay_refund_api_v1_payments_alipay_refund_post(out_trade_no, refund_amount, reason=reason)

Alipay 退款（调用 alipay.trade.refund）

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
    api_instance = zhs_api.AlipayApi(api_client)
    out_trade_no = 'out_trade_no_example' # str | 
    refund_amount = 3.4 # float | 退款金额（元）
    reason = '用户申请退款' # str |  (optional) (default to '用户申请退款')

    try:
        # Alipay 退款（调用 alipay.trade.refund）
        api_response = api_instance.alipay_refund_api_v1_payments_alipay_refund_post(out_trade_no, refund_amount, reason=reason)
        print("The response of AlipayApi->alipay_refund_api_v1_payments_alipay_refund_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AlipayApi->alipay_refund_api_v1_payments_alipay_refund_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **out_trade_no** | **str**|  | 
 **refund_amount** | **float**| 退款金额（元） | 
 **reason** | **str**|  | [optional] [default to &#39;用户申请退款&#39;]

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

# **create_alipay_api_v1_payments_alipay_create_post**
> object create_alipay_api_v1_payments_alipay_create_post(amount, product_id=product_id, order_type=order_type, subject=subject)

Create Alipay PC / H5 page pay

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
    api_instance = zhs_api.AlipayApi(api_client)
    amount = 3.4 # float | 金额（元）
    product_id = 'product_id_example' # str |  (optional)
    order_type = 0 # int |  (optional) (default to 0)
    subject = '订单支付' # str |  (optional) (default to '订单支付')

    try:
        # Create Alipay PC / H5 page pay
        api_response = api_instance.create_alipay_api_v1_payments_alipay_create_post(amount, product_id=product_id, order_type=order_type, subject=subject)
        print("The response of AlipayApi->create_alipay_api_v1_payments_alipay_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AlipayApi->create_alipay_api_v1_payments_alipay_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **float**| 金额（元） | 
 **product_id** | **str**|  | [optional] 
 **order_type** | **int**|  | [optional] [default to 0]
 **subject** | **str**|  | [optional] [default to &#39;订单支付&#39;]

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

# **create_alipay_app_api_v1_payments_alipay_app_create_post**
> object create_alipay_app_api_v1_payments_alipay_app_create_post(amount, product_id=product_id, order_type=order_type, subject=subject)

Create Alipay order for mobile app

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
    api_instance = zhs_api.AlipayApi(api_client)
    amount = 3.4 # float | 
    product_id = 'product_id_example' # str |  (optional)
    order_type = 0 # int |  (optional) (default to 0)
    subject = '订单支付' # str |  (optional) (default to '订单支付')

    try:
        # Create Alipay order for mobile app
        api_response = api_instance.create_alipay_app_api_v1_payments_alipay_app_create_post(amount, product_id=product_id, order_type=order_type, subject=subject)
        print("The response of AlipayApi->create_alipay_app_api_v1_payments_alipay_app_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AlipayApi->create_alipay_app_api_v1_payments_alipay_app_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **float**|  | 
 **product_id** | **str**|  | [optional] 
 **order_type** | **int**|  | [optional] [default to 0]
 **subject** | **str**|  | [optional] [default to &#39;订单支付&#39;]

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

