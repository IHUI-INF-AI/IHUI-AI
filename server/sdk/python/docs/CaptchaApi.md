# zhs_api.CaptchaApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_captcha_api_v1_auth_captcha_get**](CaptchaApi.md#get_captcha_api_v1_auth_captcha_get) | **GET** /api/v1/auth/captcha | 获取验证码图片
[**verify_captcha_endpoint_api_v1_auth_captcha_verify_post**](CaptchaApi.md#verify_captcha_endpoint_api_v1_auth_captcha_verify_post) | **POST** /api/v1/auth/captcha/verify | 校验验证码


# **get_captcha_api_v1_auth_captcha_get**
> object get_captcha_api_v1_auth_captcha_get()

获取验证码图片

Generate a new image captcha.

Returns a ``captcha_key`` (to send back on login) and a base64-encoded
PNG image string (to render in an ``<img>`` tag).

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
    api_instance = zhs_api.CaptchaApi(api_client)

    try:
        # 获取验证码图片
        api_response = api_instance.get_captcha_api_v1_auth_captcha_get()
        print("The response of CaptchaApi->get_captcha_api_v1_auth_captcha_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CaptchaApi->get_captcha_api_v1_auth_captcha_get: %s\n" % e)
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

# **verify_captcha_endpoint_api_v1_auth_captcha_verify_post**
> object verify_captcha_endpoint_api_v1_auth_captcha_verify_post(captcha_verify_request)

校验验证码

Verify a captcha submission.

Returns success/failure.  Each captcha can only be verified once.

### Example


```python
import zhs_api
from zhs_api.models.captcha_verify_request import CaptchaVerifyRequest
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
    api_instance = zhs_api.CaptchaApi(api_client)
    captcha_verify_request = zhs_api.CaptchaVerifyRequest() # CaptchaVerifyRequest | 

    try:
        # 校验验证码
        api_response = api_instance.verify_captcha_endpoint_api_v1_auth_captcha_verify_post(captcha_verify_request)
        print("The response of CaptchaApi->verify_captcha_endpoint_api_v1_auth_captcha_verify_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CaptchaApi->verify_captcha_endpoint_api_v1_auth_captcha_verify_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **captcha_verify_request** | [**CaptchaVerifyRequest**](CaptchaVerifyRequest.md)|  | 

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

