# zhs_api.CallbackApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**call_callback_api_v1_callback_call_post**](CallbackApi.md#call_callback_api_v1_callback_call_post) | **POST** /api/v1/callback/call | 外呼回调
[**call_callback_api_v1_callback_call_post_0**](CallbackApi.md#call_callback_api_v1_callback_call_post_0) | **POST** /api/v1/callback/call | 外呼回调
[**callback_log_list**](CallbackApi.md#callback_log_list) | **GET** /api/v1/callback/log/list | 回调日志
[**callback_log_list_0**](CallbackApi.md#callback_log_list_0) | **GET** /api/v1/callback/log/list | 回调日志
[**log_detail_api_v1_callback_log_lid_get**](CallbackApi.md#log_detail_api_v1_callback_log_lid_get) | **GET** /api/v1/callback/log/{lid} | 回调详情
[**log_detail_api_v1_callback_log_lid_get_0**](CallbackApi.md#log_detail_api_v1_callback_log_lid_get_0) | **GET** /api/v1/callback/log/{lid} | 回调详情
[**payment_callback_api_v1_callback_payment_post**](CallbackApi.md#payment_callback_api_v1_callback_payment_post) | **POST** /api/v1/callback/payment | 支付回调
[**payment_callback_api_v1_callback_payment_post_0**](CallbackApi.md#payment_callback_api_v1_callback_payment_post_0) | **POST** /api/v1/callback/payment | 支付回调
[**sms_callback_api_v1_callback_sms_post**](CallbackApi.md#sms_callback_api_v1_callback_sms_post) | **POST** /api/v1/callback/sms | 短信回调
[**sms_callback_api_v1_callback_sms_post_0**](CallbackApi.md#sms_callback_api_v1_callback_sms_post_0) | **POST** /api/v1/callback/sms | 短信回调


# **call_callback_api_v1_callback_call_post**
> object call_callback_api_v1_callback_call_post(biz_id=biz_id, biz_type=biz_type, source=source, body_call_callback_api_v1_callback_call_post=body_call_callback_api_v1_callback_call_post)

外呼回调

### Example


```python
import zhs_api
from zhs_api.models.body_call_callback_api_v1_callback_call_post import BodyCallCallbackApiV1CallbackCallPost
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
    api_instance = zhs_api.CallbackApi(api_client)
    biz_id = 'biz_id_example' # str |  (optional)
    biz_type = 'call' # str |  (optional) (default to 'call')
    source = 'source_example' # str |  (optional)
    body_call_callback_api_v1_callback_call_post = zhs_api.BodyCallCallbackApiV1CallbackCallPost() # BodyCallCallbackApiV1CallbackCallPost |  (optional)

    try:
        # 外呼回调
        api_response = api_instance.call_callback_api_v1_callback_call_post(biz_id=biz_id, biz_type=biz_type, source=source, body_call_callback_api_v1_callback_call_post=body_call_callback_api_v1_callback_call_post)
        print("The response of CallbackApi->call_callback_api_v1_callback_call_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CallbackApi->call_callback_api_v1_callback_call_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **biz_id** | **str**|  | [optional] 
 **biz_type** | **str**|  | [optional] [default to &#39;call&#39;]
 **source** | **str**|  | [optional] 
 **body_call_callback_api_v1_callback_call_post** | [**BodyCallCallbackApiV1CallbackCallPost**](BodyCallCallbackApiV1CallbackCallPost.md)|  | [optional] 

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

# **call_callback_api_v1_callback_call_post_0**
> object call_callback_api_v1_callback_call_post_0(biz_id=biz_id, biz_type=biz_type, source=source, body_call_callback_api_v1_callback_call_post=body_call_callback_api_v1_callback_call_post)

外呼回调

### Example


```python
import zhs_api
from zhs_api.models.body_call_callback_api_v1_callback_call_post import BodyCallCallbackApiV1CallbackCallPost
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
    api_instance = zhs_api.CallbackApi(api_client)
    biz_id = 'biz_id_example' # str |  (optional)
    biz_type = 'call' # str |  (optional) (default to 'call')
    source = 'source_example' # str |  (optional)
    body_call_callback_api_v1_callback_call_post = zhs_api.BodyCallCallbackApiV1CallbackCallPost() # BodyCallCallbackApiV1CallbackCallPost |  (optional)

    try:
        # 外呼回调
        api_response = api_instance.call_callback_api_v1_callback_call_post_0(biz_id=biz_id, biz_type=biz_type, source=source, body_call_callback_api_v1_callback_call_post=body_call_callback_api_v1_callback_call_post)
        print("The response of CallbackApi->call_callback_api_v1_callback_call_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CallbackApi->call_callback_api_v1_callback_call_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **biz_id** | **str**|  | [optional] 
 **biz_type** | **str**|  | [optional] [default to &#39;call&#39;]
 **source** | **str**|  | [optional] 
 **body_call_callback_api_v1_callback_call_post** | [**BodyCallCallbackApiV1CallbackCallPost**](BodyCallCallbackApiV1CallbackCallPost.md)|  | [optional] 

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

# **callback_log_list**
> object callback_log_list(page=page, limit=limit, biz_type=biz_type, source=source, status=status)

回调日志

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
    api_instance = zhs_api.CallbackApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    biz_type = 'biz_type_example' # str |  (optional)
    source = 'source_example' # str |  (optional)
    status = 56 # int |  (optional)

    try:
        # 回调日志
        api_response = api_instance.callback_log_list(page=page, limit=limit, biz_type=biz_type, source=source, status=status)
        print("The response of CallbackApi->callback_log_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CallbackApi->callback_log_list: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **biz_type** | **str**|  | [optional] 
 **source** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 

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

# **callback_log_list_0**
> object callback_log_list_0(page=page, limit=limit, biz_type=biz_type, source=source, status=status)

回调日志

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
    api_instance = zhs_api.CallbackApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    biz_type = 'biz_type_example' # str |  (optional)
    source = 'source_example' # str |  (optional)
    status = 56 # int |  (optional)

    try:
        # 回调日志
        api_response = api_instance.callback_log_list_0(page=page, limit=limit, biz_type=biz_type, source=source, status=status)
        print("The response of CallbackApi->callback_log_list_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CallbackApi->callback_log_list_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **biz_type** | **str**|  | [optional] 
 **source** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 

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

# **log_detail_api_v1_callback_log_lid_get**
> object log_detail_api_v1_callback_log_lid_get(lid)

回调详情

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
    api_instance = zhs_api.CallbackApi(api_client)
    lid = 56 # int | 

    try:
        # 回调详情
        api_response = api_instance.log_detail_api_v1_callback_log_lid_get(lid)
        print("The response of CallbackApi->log_detail_api_v1_callback_log_lid_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CallbackApi->log_detail_api_v1_callback_log_lid_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **lid** | **int**|  | 

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

# **log_detail_api_v1_callback_log_lid_get_0**
> object log_detail_api_v1_callback_log_lid_get_0(lid)

回调详情

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
    api_instance = zhs_api.CallbackApi(api_client)
    lid = 56 # int | 

    try:
        # 回调详情
        api_response = api_instance.log_detail_api_v1_callback_log_lid_get_0(lid)
        print("The response of CallbackApi->log_detail_api_v1_callback_log_lid_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CallbackApi->log_detail_api_v1_callback_log_lid_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **lid** | **int**|  | 

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

# **payment_callback_api_v1_callback_payment_post**
> object payment_callback_api_v1_callback_payment_post(biz_id=biz_id, body_payment_callback_api_v1_callback_payment_post=body_payment_callback_api_v1_callback_payment_post)

支付回调

### Example


```python
import zhs_api
from zhs_api.models.body_payment_callback_api_v1_callback_payment_post import BodyPaymentCallbackApiV1CallbackPaymentPost
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
    api_instance = zhs_api.CallbackApi(api_client)
    biz_id = 'biz_id_example' # str |  (optional)
    body_payment_callback_api_v1_callback_payment_post = zhs_api.BodyPaymentCallbackApiV1CallbackPaymentPost() # BodyPaymentCallbackApiV1CallbackPaymentPost |  (optional)

    try:
        # 支付回调
        api_response = api_instance.payment_callback_api_v1_callback_payment_post(biz_id=biz_id, body_payment_callback_api_v1_callback_payment_post=body_payment_callback_api_v1_callback_payment_post)
        print("The response of CallbackApi->payment_callback_api_v1_callback_payment_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CallbackApi->payment_callback_api_v1_callback_payment_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **biz_id** | **str**|  | [optional] 
 **body_payment_callback_api_v1_callback_payment_post** | [**BodyPaymentCallbackApiV1CallbackPaymentPost**](BodyPaymentCallbackApiV1CallbackPaymentPost.md)|  | [optional] 

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

# **payment_callback_api_v1_callback_payment_post_0**
> object payment_callback_api_v1_callback_payment_post_0(biz_id=biz_id, body_payment_callback_api_v1_callback_payment_post=body_payment_callback_api_v1_callback_payment_post)

支付回调

### Example


```python
import zhs_api
from zhs_api.models.body_payment_callback_api_v1_callback_payment_post import BodyPaymentCallbackApiV1CallbackPaymentPost
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
    api_instance = zhs_api.CallbackApi(api_client)
    biz_id = 'biz_id_example' # str |  (optional)
    body_payment_callback_api_v1_callback_payment_post = zhs_api.BodyPaymentCallbackApiV1CallbackPaymentPost() # BodyPaymentCallbackApiV1CallbackPaymentPost |  (optional)

    try:
        # 支付回调
        api_response = api_instance.payment_callback_api_v1_callback_payment_post_0(biz_id=biz_id, body_payment_callback_api_v1_callback_payment_post=body_payment_callback_api_v1_callback_payment_post)
        print("The response of CallbackApi->payment_callback_api_v1_callback_payment_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CallbackApi->payment_callback_api_v1_callback_payment_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **biz_id** | **str**|  | [optional] 
 **body_payment_callback_api_v1_callback_payment_post** | [**BodyPaymentCallbackApiV1CallbackPaymentPost**](BodyPaymentCallbackApiV1CallbackPaymentPost.md)|  | [optional] 

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

# **sms_callback_api_v1_callback_sms_post**
> object sms_callback_api_v1_callback_sms_post(biz_id=biz_id, body_sms_callback_api_v1_callback_sms_post=body_sms_callback_api_v1_callback_sms_post)

短信回调

### Example


```python
import zhs_api
from zhs_api.models.body_sms_callback_api_v1_callback_sms_post import BodySmsCallbackApiV1CallbackSmsPost
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
    api_instance = zhs_api.CallbackApi(api_client)
    biz_id = 'biz_id_example' # str |  (optional)
    body_sms_callback_api_v1_callback_sms_post = zhs_api.BodySmsCallbackApiV1CallbackSmsPost() # BodySmsCallbackApiV1CallbackSmsPost |  (optional)

    try:
        # 短信回调
        api_response = api_instance.sms_callback_api_v1_callback_sms_post(biz_id=biz_id, body_sms_callback_api_v1_callback_sms_post=body_sms_callback_api_v1_callback_sms_post)
        print("The response of CallbackApi->sms_callback_api_v1_callback_sms_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CallbackApi->sms_callback_api_v1_callback_sms_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **biz_id** | **str**|  | [optional] 
 **body_sms_callback_api_v1_callback_sms_post** | [**BodySmsCallbackApiV1CallbackSmsPost**](BodySmsCallbackApiV1CallbackSmsPost.md)|  | [optional] 

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

# **sms_callback_api_v1_callback_sms_post_0**
> object sms_callback_api_v1_callback_sms_post_0(biz_id=biz_id, body_sms_callback_api_v1_callback_sms_post=body_sms_callback_api_v1_callback_sms_post)

短信回调

### Example


```python
import zhs_api
from zhs_api.models.body_sms_callback_api_v1_callback_sms_post import BodySmsCallbackApiV1CallbackSmsPost
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
    api_instance = zhs_api.CallbackApi(api_client)
    biz_id = 'biz_id_example' # str |  (optional)
    body_sms_callback_api_v1_callback_sms_post = zhs_api.BodySmsCallbackApiV1CallbackSmsPost() # BodySmsCallbackApiV1CallbackSmsPost |  (optional)

    try:
        # 短信回调
        api_response = api_instance.sms_callback_api_v1_callback_sms_post_0(biz_id=biz_id, body_sms_callback_api_v1_callback_sms_post=body_sms_callback_api_v1_callback_sms_post)
        print("The response of CallbackApi->sms_callback_api_v1_callback_sms_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CallbackApi->sms_callback_api_v1_callback_sms_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **biz_id** | **str**|  | [optional] 
 **body_sms_callback_api_v1_callback_sms_post** | [**BodySmsCallbackApiV1CallbackSmsPost**](BodySmsCallbackApiV1CallbackSmsPost.md)|  | [optional] 

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

