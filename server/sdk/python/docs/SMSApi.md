# zhs_api.SMSApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**send_code_api_v1_auth_sms_send_post**](SMSApi.md#send_code_api_v1_auth_sms_send_post) | **POST** /api/v1/auth/sms/send | Send SMS code
[**send_code_api_v1_auth_sms_send_post_0**](SMSApi.md#send_code_api_v1_auth_sms_send_post_0) | **POST** /api/v1/auth/sms/send | Send SMS code
[**verify_code_api_v1_auth_sms_verify_post**](SMSApi.md#verify_code_api_v1_auth_sms_verify_post) | **POST** /api/v1/auth/sms/verify | Verify SMS code
[**verify_code_api_v1_auth_sms_verify_post_0**](SMSApi.md#verify_code_api_v1_auth_sms_verify_post_0) | **POST** /api/v1/auth/sms/verify | Verify SMS code


# **send_code_api_v1_auth_sms_send_post**
> object send_code_api_v1_auth_sms_send_post(phone)

Send SMS code

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
    api_instance = zhs_api.SMSApi(api_client)
    phone = 'phone_example' # str | 

    try:
        # Send SMS code
        api_response = api_instance.send_code_api_v1_auth_sms_send_post(phone)
        print("The response of SMSApi->send_code_api_v1_auth_sms_send_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SMSApi->send_code_api_v1_auth_sms_send_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **str**|  | 

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

# **send_code_api_v1_auth_sms_send_post_0**
> object send_code_api_v1_auth_sms_send_post_0(phone)

Send SMS code

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
    api_instance = zhs_api.SMSApi(api_client)
    phone = 'phone_example' # str | 

    try:
        # Send SMS code
        api_response = api_instance.send_code_api_v1_auth_sms_send_post_0(phone)
        print("The response of SMSApi->send_code_api_v1_auth_sms_send_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SMSApi->send_code_api_v1_auth_sms_send_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **str**|  | 

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

# **verify_code_api_v1_auth_sms_verify_post**
> object verify_code_api_v1_auth_sms_verify_post(phone, code)

Verify SMS code

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
    api_instance = zhs_api.SMSApi(api_client)
    phone = 'phone_example' # str | 
    code = 'code_example' # str | 

    try:
        # Verify SMS code
        api_response = api_instance.verify_code_api_v1_auth_sms_verify_post(phone, code)
        print("The response of SMSApi->verify_code_api_v1_auth_sms_verify_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SMSApi->verify_code_api_v1_auth_sms_verify_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **str**|  | 
 **code** | **str**|  | 

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

# **verify_code_api_v1_auth_sms_verify_post_0**
> object verify_code_api_v1_auth_sms_verify_post_0(phone, code)

Verify SMS code

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
    api_instance = zhs_api.SMSApi(api_client)
    phone = 'phone_example' # str | 
    code = 'code_example' # str | 

    try:
        # Verify SMS code
        api_response = api_instance.verify_code_api_v1_auth_sms_verify_post_0(phone, code)
        print("The response of SMSApi->verify_code_api_v1_auth_sms_verify_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SMSApi->verify_code_api_v1_auth_sms_verify_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **str**|  | 
 **code** | **str**|  | 

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

