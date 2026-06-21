# zhs_api.WeChatAuthApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_wechat_phone_api_v1_auth_auth_wechat_mini_phone_post**](WeChatAuthApi.md#get_wechat_phone_api_v1_auth_auth_wechat_mini_phone_post) | **POST** /api/v1/auth/auth/wechat/mini/phone | Get WeChat phone number
[**get_wechat_phone_api_v1_auth_auth_wechat_mini_phone_post_0**](WeChatAuthApi.md#get_wechat_phone_api_v1_auth_auth_wechat_mini_phone_post_0) | **POST** /api/v1/auth/auth/wechat/mini/phone | Get WeChat phone number
[**get_wechat_qrcode_api_v1_auth_auth_wechat_mini_qrcode_get**](WeChatAuthApi.md#get_wechat_qrcode_api_v1_auth_auth_wechat_mini_qrcode_get) | **GET** /api/v1/auth/auth/wechat/mini/qrcode | Get WeChat mini-program QR code
[**get_wechat_qrcode_api_v1_auth_auth_wechat_mini_qrcode_get_0**](WeChatAuthApi.md#get_wechat_qrcode_api_v1_auth_auth_wechat_mini_qrcode_get_0) | **GET** /api/v1/auth/auth/wechat/mini/qrcode | Get WeChat mini-program QR code
[**wechat_mini_login_api_v1_auth_auth_wechat_mini_login_get**](WeChatAuthApi.md#wechat_mini_login_api_v1_auth_auth_wechat_mini_login_get) | **GET** /api/v1/auth/auth/wechat/mini/login | WeChat mini-program login
[**wechat_mini_login_api_v1_auth_auth_wechat_mini_login_get_0**](WeChatAuthApi.md#wechat_mini_login_api_v1_auth_auth_wechat_mini_login_get_0) | **GET** /api/v1/auth/auth/wechat/mini/login | WeChat mini-program login
[**wechat_rebind_api_v1_auth_auth_wechat_mini_rebind_post**](WeChatAuthApi.md#wechat_rebind_api_v1_auth_auth_wechat_mini_rebind_post) | **POST** /api/v1/auth/auth/wechat/mini/rebind | Rebind WeChat mini-program account
[**wechat_rebind_api_v1_auth_auth_wechat_mini_rebind_post_0**](WeChatAuthApi.md#wechat_rebind_api_v1_auth_auth_wechat_mini_rebind_post_0) | **POST** /api/v1/auth/auth/wechat/mini/rebind | Rebind WeChat mini-program account
[**wechat_rebind_by_phone_api_v1_auth_auth_wechat_mini_rebind_by_phone_post**](WeChatAuthApi.md#wechat_rebind_by_phone_api_v1_auth_auth_wechat_mini_rebind_by_phone_post) | **POST** /api/v1/auth/auth/wechat/mini/rebind_by_phone | Rebind WeChat by phone number
[**wechat_rebind_by_phone_api_v1_auth_auth_wechat_mini_rebind_by_phone_post_0**](WeChatAuthApi.md#wechat_rebind_by_phone_api_v1_auth_auth_wechat_mini_rebind_by_phone_post_0) | **POST** /api/v1/auth/auth/wechat/mini/rebind_by_phone | Rebind WeChat by phone number


# **get_wechat_phone_api_v1_auth_auth_wechat_mini_phone_post**
> object get_wechat_phone_api_v1_auth_auth_wechat_mini_phone_post(code)

Get WeChat phone number

Get phone number via WeChat mini-program getuserphonenumber API.

Matches Java LoginService.getPhoneNumber(code, openId):
1. Get access_token, call getuserphonenumber API
2. If phone exists with no openId (visitor): delete visitor, bind phone to current user
3. If phone exists with same openId: return existing user
4. If phone exists with different openId: error 'already bound'
5. Otherwise: update user's phone and set isVIP=0

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
    api_instance = zhs_api.WeChatAuthApi(api_client)
    code = 'code_example' # str | Code from wx.getPhoneNumber component

    try:
        # Get WeChat phone number
        api_response = api_instance.get_wechat_phone_api_v1_auth_auth_wechat_mini_phone_post(code)
        print("The response of WeChatAuthApi->get_wechat_phone_api_v1_auth_auth_wechat_mini_phone_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatAuthApi->get_wechat_phone_api_v1_auth_auth_wechat_mini_phone_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**| Code from wx.getPhoneNumber component | 

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

# **get_wechat_phone_api_v1_auth_auth_wechat_mini_phone_post_0**
> object get_wechat_phone_api_v1_auth_auth_wechat_mini_phone_post_0(code)

Get WeChat phone number

Get phone number via WeChat mini-program getuserphonenumber API.

Matches Java LoginService.getPhoneNumber(code, openId):
1. Get access_token, call getuserphonenumber API
2. If phone exists with no openId (visitor): delete visitor, bind phone to current user
3. If phone exists with same openId: return existing user
4. If phone exists with different openId: error 'already bound'
5. Otherwise: update user's phone and set isVIP=0

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
    api_instance = zhs_api.WeChatAuthApi(api_client)
    code = 'code_example' # str | Code from wx.getPhoneNumber component

    try:
        # Get WeChat phone number
        api_response = api_instance.get_wechat_phone_api_v1_auth_auth_wechat_mini_phone_post_0(code)
        print("The response of WeChatAuthApi->get_wechat_phone_api_v1_auth_auth_wechat_mini_phone_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatAuthApi->get_wechat_phone_api_v1_auth_auth_wechat_mini_phone_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**| Code from wx.getPhoneNumber component | 

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

# **get_wechat_qrcode_api_v1_auth_auth_wechat_mini_qrcode_get**
> object get_wechat_qrcode_api_v1_auth_auth_wechat_mini_qrcode_get(scene, page=page)

Get WeChat mini-program QR code

Generate WeChat mini-program unlimited QR code via getwxacodeunlimit.

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
    api_instance = zhs_api.WeChatAuthApi(api_client)
    scene = 'scene_example' # str | Scene string for QR code
    page = 'pages/index/index' # str | Mini-program page path (optional) (default to 'pages/index/index')

    try:
        # Get WeChat mini-program QR code
        api_response = api_instance.get_wechat_qrcode_api_v1_auth_auth_wechat_mini_qrcode_get(scene, page=page)
        print("The response of WeChatAuthApi->get_wechat_qrcode_api_v1_auth_auth_wechat_mini_qrcode_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatAuthApi->get_wechat_qrcode_api_v1_auth_auth_wechat_mini_qrcode_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **scene** | **str**| Scene string for QR code | 
 **page** | **str**| Mini-program page path | [optional] [default to &#39;pages/index/index&#39;]

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

# **get_wechat_qrcode_api_v1_auth_auth_wechat_mini_qrcode_get_0**
> object get_wechat_qrcode_api_v1_auth_auth_wechat_mini_qrcode_get_0(scene, page=page)

Get WeChat mini-program QR code

Generate WeChat mini-program unlimited QR code via getwxacodeunlimit.

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
    api_instance = zhs_api.WeChatAuthApi(api_client)
    scene = 'scene_example' # str | Scene string for QR code
    page = 'pages/index/index' # str | Mini-program page path (optional) (default to 'pages/index/index')

    try:
        # Get WeChat mini-program QR code
        api_response = api_instance.get_wechat_qrcode_api_v1_auth_auth_wechat_mini_qrcode_get_0(scene, page=page)
        print("The response of WeChatAuthApi->get_wechat_qrcode_api_v1_auth_auth_wechat_mini_qrcode_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatAuthApi->get_wechat_qrcode_api_v1_auth_auth_wechat_mini_qrcode_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **scene** | **str**| Scene string for QR code | 
 **page** | **str**| Mini-program page path | [optional] [default to &#39;pages/index/index&#39;]

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

# **wechat_mini_login_api_v1_auth_auth_wechat_mini_login_get**
> object wechat_mini_login_api_v1_auth_auth_wechat_mini_login_get(code, parent_id=parent_id)

WeChat mini-program login

WeChat mini-program login.

Matches Java LoginService.login(openId, parentId):
- If user not found: create new user with invite_code, nickname 'AI_' + 4 random chars,
  is_vip=-1 (guest), parent_id, isVIP defaults.
- If user exists and parent_id is set but user has no parent: update parent_id.
- If user exists but has no phone: return 40101 '未验证手机号'.
- Returns JWT token with user info.

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
    api_instance = zhs_api.WeChatAuthApi(api_client)
    code = 'code_example' # str | 
    parent_id = '' # str | Parent invite code for referral (optional) (default to '')

    try:
        # WeChat mini-program login
        api_response = api_instance.wechat_mini_login_api_v1_auth_auth_wechat_mini_login_get(code, parent_id=parent_id)
        print("The response of WeChatAuthApi->wechat_mini_login_api_v1_auth_auth_wechat_mini_login_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatAuthApi->wechat_mini_login_api_v1_auth_auth_wechat_mini_login_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**|  | 
 **parent_id** | **str**| Parent invite code for referral | [optional] [default to &#39;&#39;]

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

# **wechat_mini_login_api_v1_auth_auth_wechat_mini_login_get_0**
> object wechat_mini_login_api_v1_auth_auth_wechat_mini_login_get_0(code, parent_id=parent_id)

WeChat mini-program login

WeChat mini-program login.

Matches Java LoginService.login(openId, parentId):
- If user not found: create new user with invite_code, nickname 'AI_' + 4 random chars,
  is_vip=-1 (guest), parent_id, isVIP defaults.
- If user exists and parent_id is set but user has no parent: update parent_id.
- If user exists but has no phone: return 40101 '未验证手机号'.
- Returns JWT token with user info.

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
    api_instance = zhs_api.WeChatAuthApi(api_client)
    code = 'code_example' # str | 
    parent_id = '' # str | Parent invite code for referral (optional) (default to '')

    try:
        # WeChat mini-program login
        api_response = api_instance.wechat_mini_login_api_v1_auth_auth_wechat_mini_login_get_0(code, parent_id=parent_id)
        print("The response of WeChatAuthApi->wechat_mini_login_api_v1_auth_auth_wechat_mini_login_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatAuthApi->wechat_mini_login_api_v1_auth_auth_wechat_mini_login_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**|  | 
 **parent_id** | **str**| Parent invite code for referral | [optional] [default to &#39;&#39;]

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

# **wechat_rebind_api_v1_auth_auth_wechat_mini_rebind_post**
> object wechat_rebind_api_v1_auth_auth_wechat_mini_rebind_post(code)

Rebind WeChat mini-program account

Rebind WeChat: unbind old openid, bind new one from code.

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
    api_instance = zhs_api.WeChatAuthApi(api_client)
    code = 'code_example' # str | New WeChat login code

    try:
        # Rebind WeChat mini-program account
        api_response = api_instance.wechat_rebind_api_v1_auth_auth_wechat_mini_rebind_post(code)
        print("The response of WeChatAuthApi->wechat_rebind_api_v1_auth_auth_wechat_mini_rebind_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatAuthApi->wechat_rebind_api_v1_auth_auth_wechat_mini_rebind_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**| New WeChat login code | 

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

# **wechat_rebind_api_v1_auth_auth_wechat_mini_rebind_post_0**
> object wechat_rebind_api_v1_auth_auth_wechat_mini_rebind_post_0(code)

Rebind WeChat mini-program account

Rebind WeChat: unbind old openid, bind new one from code.

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
    api_instance = zhs_api.WeChatAuthApi(api_client)
    code = 'code_example' # str | New WeChat login code

    try:
        # Rebind WeChat mini-program account
        api_response = api_instance.wechat_rebind_api_v1_auth_auth_wechat_mini_rebind_post_0(code)
        print("The response of WeChatAuthApi->wechat_rebind_api_v1_auth_auth_wechat_mini_rebind_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatAuthApi->wechat_rebind_api_v1_auth_auth_wechat_mini_rebind_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**| New WeChat login code | 

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

# **wechat_rebind_by_phone_api_v1_auth_auth_wechat_mini_rebind_by_phone_post**
> object wechat_rebind_by_phone_api_v1_auth_auth_wechat_mini_rebind_by_phone_post(phone, open_id)

Rebind WeChat by phone number

Rebind WeChat open_id by phone number.

Matches Java LoginService.editWxOpenId(phone, openId):
  UPDATE zhs_user SET open_id = #{openId} WHERE phone = #{phone}

This is the original ZHS phone-based rebind endpoint.

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
    api_instance = zhs_api.WeChatAuthApi(api_client)
    phone = 'phone_example' # str | User phone number
    open_id = 'open_id_example' # str | New WeChat open_id to bind

    try:
        # Rebind WeChat by phone number
        api_response = api_instance.wechat_rebind_by_phone_api_v1_auth_auth_wechat_mini_rebind_by_phone_post(phone, open_id)
        print("The response of WeChatAuthApi->wechat_rebind_by_phone_api_v1_auth_auth_wechat_mini_rebind_by_phone_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatAuthApi->wechat_rebind_by_phone_api_v1_auth_auth_wechat_mini_rebind_by_phone_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **str**| User phone number | 
 **open_id** | **str**| New WeChat open_id to bind | 

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

# **wechat_rebind_by_phone_api_v1_auth_auth_wechat_mini_rebind_by_phone_post_0**
> object wechat_rebind_by_phone_api_v1_auth_auth_wechat_mini_rebind_by_phone_post_0(phone, open_id)

Rebind WeChat by phone number

Rebind WeChat open_id by phone number.

Matches Java LoginService.editWxOpenId(phone, openId):
  UPDATE zhs_user SET open_id = #{openId} WHERE phone = #{phone}

This is the original ZHS phone-based rebind endpoint.

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
    api_instance = zhs_api.WeChatAuthApi(api_client)
    phone = 'phone_example' # str | User phone number
    open_id = 'open_id_example' # str | New WeChat open_id to bind

    try:
        # Rebind WeChat by phone number
        api_response = api_instance.wechat_rebind_by_phone_api_v1_auth_auth_wechat_mini_rebind_by_phone_post_0(phone, open_id)
        print("The response of WeChatAuthApi->wechat_rebind_by_phone_api_v1_auth_auth_wechat_mini_rebind_by_phone_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WeChatAuthApi->wechat_rebind_by_phone_api_v1_auth_auth_wechat_mini_rebind_by_phone_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **str**| User phone number | 
 **open_id** | **str**| New WeChat open_id to bind | 

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

