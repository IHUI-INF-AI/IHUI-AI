# zhs_api.WeChatPayApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**check_status_api_v1_payments_wechat_status_out_trade_no_get**](WeChatPayApi.md#check_status_api_v1_payments_wechat_status_out_trade_no_get) | **GET** /api/v1/payments/wechat/status/{out_trade_no} | Check payment status
[**consecutive_product_api_v1_payments_wechat_consecutive_product_get**](WeChatPayApi.md#consecutive_product_api_v1_payments_wechat_consecutive_product_get) | **GET** /api/v1/payments/wechat/consecutive/product | Query consecutive subscription products
[**create_wx_pay_android_api_v1_payments_wechat_android_create_post**](WeChatPayApi.md#create_wx_pay_android_api_v1_payments_wechat_android_create_post) | **POST** /api/v1/payments/wechat/android/create | Create WeChat Pay order (Android app)
[**create_wx_pay_api_v1_payments_wechat_create_post**](WeChatPayApi.md#create_wx_pay_api_v1_payments_wechat_create_post) | **POST** /api/v1/payments/wechat/create | Create WeChat Pay order (JSAPI / mini program)
[**create_wx_pay_course_api_v1_payments_wechat_course_create_post**](WeChatPayApi.md#create_wx_pay_course_api_v1_payments_wechat_course_create_post) | **POST** /api/v1/payments/wechat/course/create | Create WeChat Pay order (course)
[**query_by_trade_no_api_v1_payments_wechat_query_by_trade_no_post**](WeChatPayApi.md#query_by_trade_no_api_v1_payments_wechat_query_by_trade_no_post) | **POST** /api/v1/payments/wechat/query/by-trade-no | Query by merchant trade number
[**wx_pay_close_api_v1_payments_wechat_close_post**](WeChatPayApi.md#wx_pay_close_api_v1_payments_wechat_close_post) | **POST** /api/v1/payments/wechat/close | Close WeChat Pay order
[**wx_pay_notify_api_v1_payments_wechat_notify_post**](WeChatPayApi.md#wx_pay_notify_api_v1_payments_wechat_notify_post) | **POST** /api/v1/payments/wechat/notify | WeChat Pay V3 async callback
[**wx_pay_query_api_v1_payments_wechat_query_post**](WeChatPayApi.md#wx_pay_query_api_v1_payments_wechat_query_post) | **POST** /api/v1/payments/wechat/query | Query WeChat Pay order
[**wx_pay_refund_api_v1_payments_wechat_refund_post**](WeChatPayApi.md#wx_pay_refund_api_v1_payments_wechat_refund_post) | **POST** /api/v1/payments/wechat/refund | Refund WeChat Pay order
[**wx_refund_notify_api_v1_payments_wechat_notify_refund_post**](WeChatPayApi.md#wx_refund_notify_api_v1_payments_wechat_notify_refund_post) | **POST** /api/v1/payments/wechat/notify/refund | WeChat Pay refund callback
[**wx_transfer_notify_api_v1_payments_wechat_notify_transfer_post**](WeChatPayApi.md#wx_transfer_notify_api_v1_payments_wechat_notify_transfer_post) | **POST** /api/v1/payments/wechat/notify/transfer | WeChat Pay transfer callback


# **check_status_api_v1_payments_wechat_status_out_trade_no_get**
> object check_status_api_v1_payments_wechat_status_out_trade_no_get(out_trade_no)

Check payment status

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
    api_instance = zhs_api.WeChatPayApi(api_client)
    out_trade_no = 'out_trade_no_example' # str | 

    try:
        # Check payment status
        api_response = api_instance.check_status_api_v1_payments_wechat_status_out_trade_no_get(out_trade_no)
        print("The response of WeChatPayApi->check_status_api_v1_payments_wechat_status_out_trade_no_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatPayApi->check_status_api_v1_payments_wechat_status_out_trade_no_get: %s\n" % e)
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

# **consecutive_product_api_v1_payments_wechat_consecutive_product_get**
> object consecutive_product_api_v1_payments_wechat_consecutive_product_get()

Query consecutive subscription products

Query consecutive subscription (monthly/annual) product list.

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
    api_instance = zhs_api.WeChatPayApi(api_client)

    try:
        # Query consecutive subscription products
        api_response = api_instance.consecutive_product_api_v1_payments_wechat_consecutive_product_get()
        print("The response of WeChatPayApi->consecutive_product_api_v1_payments_wechat_consecutive_product_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatPayApi->consecutive_product_api_v1_payments_wechat_consecutive_product_get: %s\n" % e)
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

# **create_wx_pay_android_api_v1_payments_wechat_android_create_post**
> object create_wx_pay_android_api_v1_payments_wechat_android_create_post(amount, product_id=product_id, order_type=order_type, description=description)

Create WeChat Pay order (Android app)

Matches Java PayManagementController.wxPay + PayAndroidServiceImpl.pay.

Android uses APP payment API (not JSAPI), uses separate APP_ID,
and notify URL is wx.app.notify (WX_ANDROID_NOTIFY_URL).

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
    api_instance = zhs_api.WeChatPayApi(api_client)
    amount = 56 # int | 
    product_id = 'product_id_example' # str |  (optional)
    order_type = 0 # int |  (optional) (default to 0)
    description = 'Purchase' # str |  (optional) (default to 'Purchase')

    try:
        # Create WeChat Pay order (Android app)
        api_response = api_instance.create_wx_pay_android_api_v1_payments_wechat_android_create_post(amount, product_id=product_id, order_type=order_type, description=description)
        print("The response of WeChatPayApi->create_wx_pay_android_api_v1_payments_wechat_android_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatPayApi->create_wx_pay_android_api_v1_payments_wechat_android_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **int**|  | 
 **product_id** | **str**|  | [optional] 
 **order_type** | **int**|  | [optional] [default to 0]
 **description** | **str**|  | [optional] [default to &#39;Purchase&#39;]

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

# **create_wx_pay_api_v1_payments_wechat_create_post**
> object create_wx_pay_api_v1_payments_wechat_create_post(amount, open_id, product_id=product_id, order_type=order_type, description=description)

Create WeChat Pay order (JSAPI / mini program)

Matches Java WXPayNowController.initiatePay + WXPayNowServiceImpl.pay.

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
    api_instance = zhs_api.WeChatPayApi(api_client)
    amount = 56 # int | Amount in fen
    open_id = 'open_id_example' # str | WeChat openid
    product_id = 'product_id_example' # str |  (optional)
    order_type = 0 # int | 0=token,1=activity,2=identity,3=agent (optional) (default to 0)
    description = 'Purchase' # str |  (optional) (default to 'Purchase')

    try:
        # Create WeChat Pay order (JSAPI / mini program)
        api_response = api_instance.create_wx_pay_api_v1_payments_wechat_create_post(amount, open_id, product_id=product_id, order_type=order_type, description=description)
        print("The response of WeChatPayApi->create_wx_pay_api_v1_payments_wechat_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatPayApi->create_wx_pay_api_v1_payments_wechat_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **int**| Amount in fen | 
 **open_id** | **str**| WeChat openid | 
 **product_id** | **str**|  | [optional] 
 **order_type** | **int**| 0&#x3D;token,1&#x3D;activity,2&#x3D;identity,3&#x3D;agent | [optional] [default to 0]
 **description** | **str**|  | [optional] [default to &#39;Purchase&#39;]

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

# **create_wx_pay_course_api_v1_payments_wechat_course_create_post**
> object create_wx_pay_course_api_v1_payments_wechat_course_create_post(amount, course_id)

Create WeChat Pay order (course)

Create a course payment order.

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
    api_instance = zhs_api.WeChatPayApi(api_client)
    amount = 56 # int | 
    course_id = 'course_id_example' # str | 

    try:
        # Create WeChat Pay order (course)
        api_response = api_instance.create_wx_pay_course_api_v1_payments_wechat_course_create_post(amount, course_id)
        print("The response of WeChatPayApi->create_wx_pay_course_api_v1_payments_wechat_course_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatPayApi->create_wx_pay_course_api_v1_payments_wechat_course_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **int**|  | 
 **course_id** | **str**|  | 

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

# **query_by_trade_no_api_v1_payments_wechat_query_by_trade_no_post**
> object query_by_trade_no_api_v1_payments_wechat_query_by_trade_no_post(out_trade_no)

Query by merchant trade number

Query local order and WeChat payment status.

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
    api_instance = zhs_api.WeChatPayApi(api_client)
    out_trade_no = 'out_trade_no_example' # str | 

    try:
        # Query by merchant trade number
        api_response = api_instance.query_by_trade_no_api_v1_payments_wechat_query_by_trade_no_post(out_trade_no)
        print("The response of WeChatPayApi->query_by_trade_no_api_v1_payments_wechat_query_by_trade_no_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatPayApi->query_by_trade_no_api_v1_payments_wechat_query_by_trade_no_post: %s\n" % e)
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

# **wx_pay_close_api_v1_payments_wechat_close_post**
> object wx_pay_close_api_v1_payments_wechat_close_post(out_trade_no)

Close WeChat Pay order

Matches Java WXPayNowServiceImpl.closeOrder -- updates status to 4 (closed).

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
    api_instance = zhs_api.WeChatPayApi(api_client)
    out_trade_no = 'out_trade_no_example' # str | 

    try:
        # Close WeChat Pay order
        api_response = api_instance.wx_pay_close_api_v1_payments_wechat_close_post(out_trade_no)
        print("The response of WeChatPayApi->wx_pay_close_api_v1_payments_wechat_close_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatPayApi->wx_pay_close_api_v1_payments_wechat_close_post: %s\n" % e)
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

# **wx_pay_notify_api_v1_payments_wechat_notify_post**
> object wx_pay_notify_api_v1_payments_wechat_notify_post(wechatpay_serial=wechatpay_serial, wechatpay_signature=wechatpay_signature, wechatpay_timestamp=wechatpay_timestamp, wechatpay_nonce=wechatpay_nonce)

WeChat Pay V3 async callback

WeChat Pay V3 callback with idempotency protection.

This endpoint handles payment success notifications from WeChat Pay V3.
Implements idempotency to prevent duplicate order status updates when
WeChat retries the callback.

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
    api_instance = zhs_api.WeChatPayApi(api_client)
    wechatpay_serial = 'wechatpay_serial_example' # str |  (optional)
    wechatpay_signature = 'wechatpay_signature_example' # str |  (optional)
    wechatpay_timestamp = 'wechatpay_timestamp_example' # str |  (optional)
    wechatpay_nonce = 'wechatpay_nonce_example' # str |  (optional)

    try:
        # WeChat Pay V3 async callback
        api_response = api_instance.wx_pay_notify_api_v1_payments_wechat_notify_post(wechatpay_serial=wechatpay_serial, wechatpay_signature=wechatpay_signature, wechatpay_timestamp=wechatpay_timestamp, wechatpay_nonce=wechatpay_nonce)
        print("The response of WeChatPayApi->wx_pay_notify_api_v1_payments_wechat_notify_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatPayApi->wx_pay_notify_api_v1_payments_wechat_notify_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **wechatpay_serial** | **str**|  | [optional] 
 **wechatpay_signature** | **str**|  | [optional] 
 **wechatpay_timestamp** | **str**|  | [optional] 
 **wechatpay_nonce** | **str**|  | [optional] 

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

# **wx_pay_query_api_v1_payments_wechat_query_post**
> object wx_pay_query_api_v1_payments_wechat_query_post(out_trade_no)

Query WeChat Pay order

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
    api_instance = zhs_api.WeChatPayApi(api_client)
    out_trade_no = 'out_trade_no_example' # str | 

    try:
        # Query WeChat Pay order
        api_response = api_instance.wx_pay_query_api_v1_payments_wechat_query_post(out_trade_no)
        print("The response of WeChatPayApi->wx_pay_query_api_v1_payments_wechat_query_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatPayApi->wx_pay_query_api_v1_payments_wechat_query_post: %s\n" % e)
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

# **wx_pay_refund_api_v1_payments_wechat_refund_post**
> object wx_pay_refund_api_v1_payments_wechat_refund_post(out_trade_no, refund_amount, reason=reason)

Refund WeChat Pay order

Matches Java WXPayNowServiceImpl.refunds.

Note: Java refund code has a bug -- it calls setOutTradeNo(outRefundNo)
overwriting the original out_trade_no. Python uses out_refund_no correctly.

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
    api_instance = zhs_api.WeChatPayApi(api_client)
    out_trade_no = 'out_trade_no_example' # str | 
    refund_amount = 56 # int | Refund amount in fen
    reason = 'User requested refund' # str |  (optional) (default to 'User requested refund')

    try:
        # Refund WeChat Pay order
        api_response = api_instance.wx_pay_refund_api_v1_payments_wechat_refund_post(out_trade_no, refund_amount, reason=reason)
        print("The response of WeChatPayApi->wx_pay_refund_api_v1_payments_wechat_refund_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatPayApi->wx_pay_refund_api_v1_payments_wechat_refund_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **out_trade_no** | **str**|  | 
 **refund_amount** | **int**| Refund amount in fen | 
 **reason** | **str**|  | [optional] [default to &#39;User requested refund&#39;]

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

# **wx_refund_notify_api_v1_payments_wechat_notify_refund_post**
> object wx_refund_notify_api_v1_payments_wechat_notify_refund_post(wechatpay_serial=wechatpay_serial, wechatpay_signature=wechatpay_signature, wechatpay_timestamp=wechatpay_timestamp, wechatpay_nonce=wechatpay_nonce)

WeChat Pay refund callback

WeChat Pay refund callback with idempotency protection.

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
    api_instance = zhs_api.WeChatPayApi(api_client)
    wechatpay_serial = 'wechatpay_serial_example' # str |  (optional)
    wechatpay_signature = 'wechatpay_signature_example' # str |  (optional)
    wechatpay_timestamp = 'wechatpay_timestamp_example' # str |  (optional)
    wechatpay_nonce = 'wechatpay_nonce_example' # str |  (optional)

    try:
        # WeChat Pay refund callback
        api_response = api_instance.wx_refund_notify_api_v1_payments_wechat_notify_refund_post(wechatpay_serial=wechatpay_serial, wechatpay_signature=wechatpay_signature, wechatpay_timestamp=wechatpay_timestamp, wechatpay_nonce=wechatpay_nonce)
        print("The response of WeChatPayApi->wx_refund_notify_api_v1_payments_wechat_notify_refund_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatPayApi->wx_refund_notify_api_v1_payments_wechat_notify_refund_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **wechatpay_serial** | **str**|  | [optional] 
 **wechatpay_signature** | **str**|  | [optional] 
 **wechatpay_timestamp** | **str**|  | [optional] 
 **wechatpay_nonce** | **str**|  | [optional] 

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

# **wx_transfer_notify_api_v1_payments_wechat_notify_transfer_post**
> object wx_transfer_notify_api_v1_payments_wechat_notify_transfer_post(wechatpay_serial=wechatpay_serial, wechatpay_signature=wechatpay_signature, wechatpay_timestamp=wechatpay_timestamp, wechatpay_nonce=wechatpay_nonce)

WeChat Pay transfer callback

WeChat Pay transfer (withdrawal) callback with idempotency.

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
    api_instance = zhs_api.WeChatPayApi(api_client)
    wechatpay_serial = 'wechatpay_serial_example' # str |  (optional)
    wechatpay_signature = 'wechatpay_signature_example' # str |  (optional)
    wechatpay_timestamp = 'wechatpay_timestamp_example' # str |  (optional)
    wechatpay_nonce = 'wechatpay_nonce_example' # str |  (optional)

    try:
        # WeChat Pay transfer callback
        api_response = api_instance.wx_transfer_notify_api_v1_payments_wechat_notify_transfer_post(wechatpay_serial=wechatpay_serial, wechatpay_signature=wechatpay_signature, wechatpay_timestamp=wechatpay_timestamp, wechatpay_nonce=wechatpay_nonce)
        print("The response of WeChatPayApi->wx_transfer_notify_api_v1_payments_wechat_notify_transfer_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatPayApi->wx_transfer_notify_api_v1_payments_wechat_notify_transfer_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **wechatpay_serial** | **str**|  | [optional] 
 **wechatpay_signature** | **str**|  | [optional] 
 **wechatpay_timestamp** | **str**|  | [optional] 
 **wechatpay_nonce** | **str**|  | [optional] 

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

