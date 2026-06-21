# zhs_api.EnterpriseWeChatApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**enterprise_pc_callback_api_v1_auth_login_enterprise_pc_callback_post**](EnterpriseWeChatApi.md#enterprise_pc_callback_api_v1_auth_login_enterprise_pc_callback_post) | **POST** /api/v1/auth/login/enterprise/pc/callback | Enterprise Pc Callback
[**enterprise_pc_wx_code_api_v1_auth_login_enterprise_pc_wx_code_get**](EnterpriseWeChatApi.md#enterprise_pc_wx_code_api_v1_auth_login_enterprise_pc_wx_code_get) | **GET** /api/v1/auth/login/enterprise/pc/wxCode | Enterprise Pc Wx Code


# **enterprise_pc_callback_api_v1_auth_login_enterprise_pc_callback_post**
> object enterprise_pc_callback_api_v1_auth_login_enterprise_pc_callback_post(msg_signature=msg_signature, timestamp=timestamp, nonce=nonce)

Enterprise Pc Callback

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
    api_instance = zhs_api.EnterpriseWeChatApi(api_client)
    msg_signature = '' # str |  (optional) (default to '')
    timestamp = '' # str |  (optional) (default to '')
    nonce = '' # str |  (optional) (default to '')

    try:
        # Enterprise Pc Callback
        api_response = api_instance.enterprise_pc_callback_api_v1_auth_login_enterprise_pc_callback_post(msg_signature=msg_signature, timestamp=timestamp, nonce=nonce)
        print("The response of EnterpriseWeChatApi->enterprise_pc_callback_api_v1_auth_login_enterprise_pc_callback_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EnterpriseWeChatApi->enterprise_pc_callback_api_v1_auth_login_enterprise_pc_callback_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **msg_signature** | **str**|  | [optional] [default to &#39;&#39;]
 **timestamp** | **str**|  | [optional] [default to &#39;&#39;]
 **nonce** | **str**|  | [optional] [default to &#39;&#39;]

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

# **enterprise_pc_wx_code_api_v1_auth_login_enterprise_pc_wx_code_get**
> object enterprise_pc_wx_code_api_v1_auth_login_enterprise_pc_wx_code_get(code)

Enterprise Pc Wx Code

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
    api_instance = zhs_api.EnterpriseWeChatApi(api_client)
    code = 'code_example' # str | WeCom js_code

    try:
        # Enterprise Pc Wx Code
        api_response = api_instance.enterprise_pc_wx_code_api_v1_auth_login_enterprise_pc_wx_code_get(code)
        print("The response of EnterpriseWeChatApi->enterprise_pc_wx_code_api_v1_auth_login_enterprise_pc_wx_code_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EnterpriseWeChatApi->enterprise_pc_wx_code_api_v1_auth_login_enterprise_pc_wx_code_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**| WeCom js_code | 

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

