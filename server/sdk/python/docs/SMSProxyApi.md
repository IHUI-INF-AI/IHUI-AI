# zhs_api.SMSProxyApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_proxy_config_api_v1_api_sms_proxy_config_get**](SMSProxyApi.md#get_proxy_config_api_v1_api_sms_proxy_config_get) | **GET** /api/v1/api/sms-proxy/config | Get Proxy Config
[**quick_register_api_v1_api_sms_proxy_register_post**](SMSProxyApi.md#quick_register_api_v1_api_sms_proxy_register_post) | **POST** /api/v1/api/sms-proxy/register | Quick Register
[**send_sms_code_api_v1_api_sms_proxy_send_post**](SMSProxyApi.md#send_sms_code_api_v1_api_sms_proxy_send_post) | **POST** /api/v1/api/sms-proxy/send | Send Sms Code
[**verify_sms_code_api_v1_api_sms_proxy_verify_post**](SMSProxyApi.md#verify_sms_code_api_v1_api_sms_proxy_verify_post) | **POST** /api/v1/api/sms-proxy/verify | Verify Sms Code


# **get_proxy_config_api_v1_api_sms_proxy_config_get**
> object get_proxy_config_api_v1_api_sms_proxy_config_get()

Get Proxy Config

Return SMS proxy configuration.

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
    api_instance = zhs_api.SMSProxyApi(api_client)

    try:
        # Get Proxy Config
        api_response = api_instance.get_proxy_config_api_v1_api_sms_proxy_config_get()
        print("The response of SMSProxyApi->get_proxy_config_api_v1_api_sms_proxy_config_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SMSProxyApi->get_proxy_config_api_v1_api_sms_proxy_config_get: %s\n" % e)
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

# **quick_register_api_v1_api_sms_proxy_register_post**
> object quick_register_api_v1_api_sms_proxy_register_post(register_request)

Quick Register

Quick register: verify code then register user.

### Example


```python
import zhs_api
from zhs_api.models.register_request import RegisterRequest
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
    api_instance = zhs_api.SMSProxyApi(api_client)
    register_request = zhs_api.RegisterRequest() # RegisterRequest | 

    try:
        # Quick Register
        api_response = api_instance.quick_register_api_v1_api_sms_proxy_register_post(register_request)
        print("The response of SMSProxyApi->quick_register_api_v1_api_sms_proxy_register_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SMSProxyApi->quick_register_api_v1_api_sms_proxy_register_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **register_request** | [**RegisterRequest**](RegisterRequest.md)|  | 

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

# **send_sms_code_api_v1_api_sms_proxy_send_post**
> object send_sms_code_api_v1_api_sms_proxy_send_post(sms_verify_request)

Send Sms Code

Send SMS verification code (proxy).

### Example


```python
import zhs_api
from zhs_api.models.sms_verify_request import SmsVerifyRequest
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
    api_instance = zhs_api.SMSProxyApi(api_client)
    sms_verify_request = zhs_api.SmsVerifyRequest() # SmsVerifyRequest | 

    try:
        # Send Sms Code
        api_response = api_instance.send_sms_code_api_v1_api_sms_proxy_send_post(sms_verify_request)
        print("The response of SMSProxyApi->send_sms_code_api_v1_api_sms_proxy_send_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SMSProxyApi->send_sms_code_api_v1_api_sms_proxy_send_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sms_verify_request** | [**SmsVerifyRequest**](SmsVerifyRequest.md)|  | 

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

# **verify_sms_code_api_v1_api_sms_proxy_verify_post**
> object verify_sms_code_api_v1_api_sms_proxy_verify_post(sms_code_verify_request)

Verify Sms Code

Verify SMS code (proxy).

### Example


```python
import zhs_api
from zhs_api.models.sms_code_verify_request import SmsCodeVerifyRequest
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
    api_instance = zhs_api.SMSProxyApi(api_client)
    sms_code_verify_request = zhs_api.SmsCodeVerifyRequest() # SmsCodeVerifyRequest | 

    try:
        # Verify Sms Code
        api_response = api_instance.verify_sms_code_api_v1_api_sms_proxy_verify_post(sms_code_verify_request)
        print("The response of SMSProxyApi->verify_sms_code_api_v1_api_sms_proxy_verify_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SMSProxyApi->verify_sms_code_api_v1_api_sms_proxy_verify_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sms_code_verify_request** | [**SmsCodeVerifyRequest**](SmsCodeVerifyRequest.md)|  | 

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

