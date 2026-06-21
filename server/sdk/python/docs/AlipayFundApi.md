# zhs_api.AlipayFundApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**alipay_fund_notify**](AlipayFundApi.md#alipay_fund_notify) | **POST** /api/v1/payments/alipay/notify | Alipay Notify
[**alipay_fund_notify_0**](AlipayFundApi.md#alipay_fund_notify_0) | **POST** /api/v1/payments/alipay/notify | Alipay Notify
[**alipay_return_api_v1_payments_alipay_return_get**](AlipayFundApi.md#alipay_return_api_v1_payments_alipay_return_get) | **GET** /api/v1/payments/alipay/return | Alipay Return
[**alipay_return_api_v1_payments_alipay_return_get_0**](AlipayFundApi.md#alipay_return_api_v1_payments_alipay_return_get_0) | **GET** /api/v1/payments/alipay/return | Alipay Return
[**create_pay_api_v1_payments_create_post**](AlipayFundApi.md#create_pay_api_v1_payments_create_post) | **POST** /api/v1/payments/create | Create Pay
[**create_pay_api_v1_payments_create_post_0**](AlipayFundApi.md#create_pay_api_v1_payments_create_post_0) | **POST** /api/v1/payments/create | Create Pay
[**create_pay_json_api_v1_payments_create2_post**](AlipayFundApi.md#create_pay_json_api_v1_payments_create2_post) | **POST** /api/v1/payments/create2 | Create Pay Json
[**create_pay_json_api_v1_payments_create2_post_0**](AlipayFundApi.md#create_pay_json_api_v1_payments_create2_post_0) | **POST** /api/v1/payments/create2 | Create Pay Json
[**pay_fail_api_v1_payments_fail_get**](AlipayFundApi.md#pay_fail_api_v1_payments_fail_get) | **GET** /api/v1/payments/fail | Pay Fail
[**pay_fail_api_v1_payments_fail_get_0**](AlipayFundApi.md#pay_fail_api_v1_payments_fail_get_0) | **GET** /api/v1/payments/fail | Pay Fail
[**pay_success_api_v1_payments_success_get**](AlipayFundApi.md#pay_success_api_v1_payments_success_get) | **GET** /api/v1/payments/success | Pay Success
[**pay_success_api_v1_payments_success_get_0**](AlipayFundApi.md#pay_success_api_v1_payments_success_get_0) | **GET** /api/v1/payments/success | Pay Success


# **alipay_fund_notify**
> object alipay_fund_notify()

Alipay Notify

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
    api_instance = zhs_api.AlipayFundApi(api_client)

    try:
        # Alipay Notify
        api_response = api_instance.alipay_fund_notify()
        print("The response of AlipayFundApi->alipay_fund_notify:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AlipayFundApi->alipay_fund_notify: %s\n" % e)
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

# **alipay_fund_notify_0**
> object alipay_fund_notify_0()

Alipay Notify

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
    api_instance = zhs_api.AlipayFundApi(api_client)

    try:
        # Alipay Notify
        api_response = api_instance.alipay_fund_notify_0()
        print("The response of AlipayFundApi->alipay_fund_notify_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AlipayFundApi->alipay_fund_notify_0: %s\n" % e)
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

# **alipay_return_api_v1_payments_alipay_return_get**
> object alipay_return_api_v1_payments_alipay_return_get()

Alipay Return

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
    api_instance = zhs_api.AlipayFundApi(api_client)

    try:
        # Alipay Return
        api_response = api_instance.alipay_return_api_v1_payments_alipay_return_get()
        print("The response of AlipayFundApi->alipay_return_api_v1_payments_alipay_return_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AlipayFundApi->alipay_return_api_v1_payments_alipay_return_get: %s\n" % e)
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

# **alipay_return_api_v1_payments_alipay_return_get_0**
> object alipay_return_api_v1_payments_alipay_return_get_0()

Alipay Return

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
    api_instance = zhs_api.AlipayFundApi(api_client)

    try:
        # Alipay Return
        api_response = api_instance.alipay_return_api_v1_payments_alipay_return_get_0()
        print("The response of AlipayFundApi->alipay_return_api_v1_payments_alipay_return_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AlipayFundApi->alipay_return_api_v1_payments_alipay_return_get_0: %s\n" % e)
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

# **create_pay_api_v1_payments_create_post**
> object create_pay_api_v1_payments_create_post()

Create Pay

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
    api_instance = zhs_api.AlipayFundApi(api_client)

    try:
        # Create Pay
        api_response = api_instance.create_pay_api_v1_payments_create_post()
        print("The response of AlipayFundApi->create_pay_api_v1_payments_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AlipayFundApi->create_pay_api_v1_payments_create_post: %s\n" % e)
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

# **create_pay_api_v1_payments_create_post_0**
> object create_pay_api_v1_payments_create_post_0()

Create Pay

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
    api_instance = zhs_api.AlipayFundApi(api_client)

    try:
        # Create Pay
        api_response = api_instance.create_pay_api_v1_payments_create_post_0()
        print("The response of AlipayFundApi->create_pay_api_v1_payments_create_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AlipayFundApi->create_pay_api_v1_payments_create_post_0: %s\n" % e)
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

# **create_pay_json_api_v1_payments_create2_post**
> object create_pay_json_api_v1_payments_create2_post()

Create Pay Json

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
    api_instance = zhs_api.AlipayFundApi(api_client)

    try:
        # Create Pay Json
        api_response = api_instance.create_pay_json_api_v1_payments_create2_post()
        print("The response of AlipayFundApi->create_pay_json_api_v1_payments_create2_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AlipayFundApi->create_pay_json_api_v1_payments_create2_post: %s\n" % e)
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

# **create_pay_json_api_v1_payments_create2_post_0**
> object create_pay_json_api_v1_payments_create2_post_0()

Create Pay Json

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
    api_instance = zhs_api.AlipayFundApi(api_client)

    try:
        # Create Pay Json
        api_response = api_instance.create_pay_json_api_v1_payments_create2_post_0()
        print("The response of AlipayFundApi->create_pay_json_api_v1_payments_create2_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AlipayFundApi->create_pay_json_api_v1_payments_create2_post_0: %s\n" % e)
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

# **pay_fail_api_v1_payments_fail_get**
> object pay_fail_api_v1_payments_fail_get()

Pay Fail

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
    api_instance = zhs_api.AlipayFundApi(api_client)

    try:
        # Pay Fail
        api_response = api_instance.pay_fail_api_v1_payments_fail_get()
        print("The response of AlipayFundApi->pay_fail_api_v1_payments_fail_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AlipayFundApi->pay_fail_api_v1_payments_fail_get: %s\n" % e)
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

# **pay_fail_api_v1_payments_fail_get_0**
> object pay_fail_api_v1_payments_fail_get_0()

Pay Fail

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
    api_instance = zhs_api.AlipayFundApi(api_client)

    try:
        # Pay Fail
        api_response = api_instance.pay_fail_api_v1_payments_fail_get_0()
        print("The response of AlipayFundApi->pay_fail_api_v1_payments_fail_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AlipayFundApi->pay_fail_api_v1_payments_fail_get_0: %s\n" % e)
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

# **pay_success_api_v1_payments_success_get**
> object pay_success_api_v1_payments_success_get(order_no=order_no)

Pay Success

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
    api_instance = zhs_api.AlipayFundApi(api_client)
    order_no = '' # str | order number (optional) (default to '')

    try:
        # Pay Success
        api_response = api_instance.pay_success_api_v1_payments_success_get(order_no=order_no)
        print("The response of AlipayFundApi->pay_success_api_v1_payments_success_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AlipayFundApi->pay_success_api_v1_payments_success_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **order_no** | **str**| order number | [optional] [default to &#39;&#39;]

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

# **pay_success_api_v1_payments_success_get_0**
> object pay_success_api_v1_payments_success_get_0(order_no=order_no)

Pay Success

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
    api_instance = zhs_api.AlipayFundApi(api_client)
    order_no = '' # str | order number (optional) (default to '')

    try:
        # Pay Success
        api_response = api_instance.pay_success_api_v1_payments_success_get_0(order_no=order_no)
        print("The response of AlipayFundApi->pay_success_api_v1_payments_success_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AlipayFundApi->pay_success_api_v1_payments_success_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **order_no** | **str**| order number | [optional] [default to &#39;&#39;]

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

