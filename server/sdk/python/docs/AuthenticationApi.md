# zhs_api.AuthenticationApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**cancel_account_api_v1_auth_auth_cancel_delete**](AuthenticationApi.md#cancel_account_api_v1_auth_auth_cancel_delete) | **DELETE** /api/v1/auth/auth/cancel | User account cancellation (soft delete)
[**cancel_account_api_v1_auth_auth_cancel_delete_0**](AuthenticationApi.md#cancel_account_api_v1_auth_auth_cancel_delete_0) | **DELETE** /api/v1/auth/auth/cancel | User account cancellation (soft delete)
[**change_password_api_v1_auth_auth_profile_password_put**](AuthenticationApi.md#change_password_api_v1_auth_auth_profile_password_put) | **PUT** /api/v1/auth/auth/profile/password | Change password
[**change_password_api_v1_auth_auth_profile_password_put_0**](AuthenticationApi.md#change_password_api_v1_auth_auth_profile_password_put_0) | **PUT** /api/v1/auth/auth/profile/password | Change password
[**check_phone_exists_api_v1_auth_auth_exist_phone_get**](AuthenticationApi.md#check_phone_exists_api_v1_auth_auth_exist_phone_get) | **GET** /api/v1/auth/auth/exist/{phone} | Check if phone is registered
[**check_phone_exists_api_v1_auth_auth_exist_phone_get_0**](AuthenticationApi.md#check_phone_exists_api_v1_auth_auth_exist_phone_get_0) | **GET** /api/v1/auth/auth/exist/{phone} | Check if phone is registered
[**get_profile_api_v1_auth_auth_profile_get**](AuthenticationApi.md#get_profile_api_v1_auth_auth_profile_get) | **GET** /api/v1/auth/auth/profile | Get personal profile with roles and posts
[**get_profile_api_v1_auth_auth_profile_get_0**](AuthenticationApi.md#get_profile_api_v1_auth_auth_profile_get_0) | **GET** /api/v1/auth/auth/profile | Get personal profile with roles and posts
[**get_user_info_api_v1_auth_auth_info_get**](AuthenticationApi.md#get_user_info_api_v1_auth_auth_info_get) | **GET** /api/v1/auth/auth/info | Get current user info
[**get_user_info_api_v1_auth_auth_info_get_0**](AuthenticationApi.md#get_user_info_api_v1_auth_auth_info_get_0) | **GET** /api/v1/auth/auth/info | Get current user info
[**login_api_v1_auth_auth_login_post**](AuthenticationApi.md#login_api_v1_auth_auth_login_post) | **POST** /api/v1/auth/auth/login | Password login
[**login_api_v1_auth_auth_login_post_0**](AuthenticationApi.md#login_api_v1_auth_auth_login_post_0) | **POST** /api/v1/auth/auth/login | Password login
[**login_sms_api_v1_auth_auth_login_sms_post**](AuthenticationApi.md#login_sms_api_v1_auth_auth_login_sms_post) | **POST** /api/v1/auth/auth/login/sms | SMS code login
[**login_sms_api_v1_auth_auth_login_sms_post_0**](AuthenticationApi.md#login_sms_api_v1_auth_auth_login_sms_post_0) | **POST** /api/v1/auth/auth/login/sms | SMS code login
[**logout_api_v1_auth_auth_logout_post**](AuthenticationApi.md#logout_api_v1_auth_auth_logout_post) | **POST** /api/v1/auth/auth/logout | Logout
[**logout_api_v1_auth_auth_logout_post_0**](AuthenticationApi.md#logout_api_v1_auth_auth_logout_post_0) | **POST** /api/v1/auth/auth/logout | Logout
[**refresh_token_api_v1_auth_auth_refresh_post**](AuthenticationApi.md#refresh_token_api_v1_auth_auth_refresh_post) | **POST** /api/v1/auth/auth/refresh | Refresh access token (rotate)
[**refresh_token_api_v1_auth_auth_refresh_post_0**](AuthenticationApi.md#refresh_token_api_v1_auth_auth_refresh_post_0) | **POST** /api/v1/auth/auth/refresh | Refresh access token (rotate)
[**register_api_v1_auth_auth_register_post**](AuthenticationApi.md#register_api_v1_auth_auth_register_post) | **POST** /api/v1/auth/auth/register | Register new user
[**register_api_v1_auth_auth_register_post_0**](AuthenticationApi.md#register_api_v1_auth_auth_register_post_0) | **POST** /api/v1/auth/auth/register | Register new user
[**send_code_api_v1_auth_auth_sms_code_post**](AuthenticationApi.md#send_code_api_v1_auth_auth_sms_code_post) | **POST** /api/v1/auth/auth/sms/code | Send SMS verification code
[**send_code_api_v1_auth_auth_sms_code_post_0**](AuthenticationApi.md#send_code_api_v1_auth_auth_sms_code_post_0) | **POST** /api/v1/auth/auth/sms/code | Send SMS verification code
[**update_profile_api_v1_auth_auth_profile_put**](AuthenticationApi.md#update_profile_api_v1_auth_auth_profile_put) | **PUT** /api/v1/auth/auth/profile | Update personal profile
[**update_profile_api_v1_auth_auth_profile_put_0**](AuthenticationApi.md#update_profile_api_v1_auth_auth_profile_put_0) | **PUT** /api/v1/auth/auth/profile | Update personal profile
[**upload_avatar_api_v1_auth_auth_profile_avatar_post**](AuthenticationApi.md#upload_avatar_api_v1_auth_auth_profile_avatar_post) | **POST** /api/v1/auth/auth/profile/avatar | Upload avatar
[**upload_avatar_api_v1_auth_auth_profile_avatar_post_0**](AuthenticationApi.md#upload_avatar_api_v1_auth_auth_profile_avatar_post_0) | **POST** /api/v1/auth/auth/profile/avatar | Upload avatar


# **cancel_account_api_v1_auth_auth_cancel_delete**
> object cancel_account_api_v1_auth_auth_cancel_delete()

User account cancellation (soft delete)

Cancel user account -- soft delete user and mask phone.

Matches Java SQL:
  UPDATE users u LEFT JOIN user_auth_info uai ON u.uuid = uai.user_uuid
  SET u.status = 3, uai.cancel_phone = uai.phone, uai.phone = NULL
  WHERE u.uuid = #{uuid}

Note: Java does NOT delete third-party bindings on cancel, only masks phone.

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
    api_instance = zhs_api.AuthenticationApi(api_client)

    try:
        # User account cancellation (soft delete)
        api_response = api_instance.cancel_account_api_v1_auth_auth_cancel_delete()
        print("The response of AuthenticationApi->cancel_account_api_v1_auth_auth_cancel_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->cancel_account_api_v1_auth_auth_cancel_delete: %s\n" % e)
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

# **cancel_account_api_v1_auth_auth_cancel_delete_0**
> object cancel_account_api_v1_auth_auth_cancel_delete_0()

User account cancellation (soft delete)

Cancel user account -- soft delete user and mask phone.

Matches Java SQL:
  UPDATE users u LEFT JOIN user_auth_info uai ON u.uuid = uai.user_uuid
  SET u.status = 3, uai.cancel_phone = uai.phone, uai.phone = NULL
  WHERE u.uuid = #{uuid}

Note: Java does NOT delete third-party bindings on cancel, only masks phone.

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
    api_instance = zhs_api.AuthenticationApi(api_client)

    try:
        # User account cancellation (soft delete)
        api_response = api_instance.cancel_account_api_v1_auth_auth_cancel_delete_0()
        print("The response of AuthenticationApi->cancel_account_api_v1_auth_auth_cancel_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->cancel_account_api_v1_auth_auth_cancel_delete_0: %s\n" % e)
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

# **change_password_api_v1_auth_auth_profile_password_put**
> object change_password_api_v1_auth_auth_profile_password_put(body_change_password_api_v1_auth_auth_profile_password_put)

Change password

Change user password — verifies old password before setting new one.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.body_change_password_api_v1_auth_auth_profile_password_put import BodyChangePasswordApiV1AuthAuthProfilePasswordPut
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
    api_instance = zhs_api.AuthenticationApi(api_client)
    body_change_password_api_v1_auth_auth_profile_password_put = zhs_api.BodyChangePasswordApiV1AuthAuthProfilePasswordPut() # BodyChangePasswordApiV1AuthAuthProfilePasswordPut | 

    try:
        # Change password
        api_response = api_instance.change_password_api_v1_auth_auth_profile_password_put(body_change_password_api_v1_auth_auth_profile_password_put)
        print("The response of AuthenticationApi->change_password_api_v1_auth_auth_profile_password_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->change_password_api_v1_auth_auth_profile_password_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_change_password_api_v1_auth_auth_profile_password_put** | [**BodyChangePasswordApiV1AuthAuthProfilePasswordPut**](BodyChangePasswordApiV1AuthAuthProfilePasswordPut.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **change_password_api_v1_auth_auth_profile_password_put_0**
> object change_password_api_v1_auth_auth_profile_password_put_0(body_change_password_api_v1_auth_auth_profile_password_put)

Change password

Change user password — verifies old password before setting new one.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.body_change_password_api_v1_auth_auth_profile_password_put import BodyChangePasswordApiV1AuthAuthProfilePasswordPut
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
    api_instance = zhs_api.AuthenticationApi(api_client)
    body_change_password_api_v1_auth_auth_profile_password_put = zhs_api.BodyChangePasswordApiV1AuthAuthProfilePasswordPut() # BodyChangePasswordApiV1AuthAuthProfilePasswordPut | 

    try:
        # Change password
        api_response = api_instance.change_password_api_v1_auth_auth_profile_password_put_0(body_change_password_api_v1_auth_auth_profile_password_put)
        print("The response of AuthenticationApi->change_password_api_v1_auth_auth_profile_password_put_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->change_password_api_v1_auth_auth_profile_password_put_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_change_password_api_v1_auth_auth_profile_password_put** | [**BodyChangePasswordApiV1AuthAuthProfilePasswordPut**](BodyChangePasswordApiV1AuthAuthProfilePasswordPut.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **check_phone_exists_api_v1_auth_auth_exist_phone_get**
> object check_phone_exists_api_v1_auth_auth_exist_phone_get(phone)

Check if phone is registered

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
    api_instance = zhs_api.AuthenticationApi(api_client)
    phone = 'phone_example' # str | 

    try:
        # Check if phone is registered
        api_response = api_instance.check_phone_exists_api_v1_auth_auth_exist_phone_get(phone)
        print("The response of AuthenticationApi->check_phone_exists_api_v1_auth_auth_exist_phone_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->check_phone_exists_api_v1_auth_auth_exist_phone_get: %s\n" % e)
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

# **check_phone_exists_api_v1_auth_auth_exist_phone_get_0**
> object check_phone_exists_api_v1_auth_auth_exist_phone_get_0(phone)

Check if phone is registered

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
    api_instance = zhs_api.AuthenticationApi(api_client)
    phone = 'phone_example' # str | 

    try:
        # Check if phone is registered
        api_response = api_instance.check_phone_exists_api_v1_auth_auth_exist_phone_get_0(phone)
        print("The response of AuthenticationApi->check_phone_exists_api_v1_auth_auth_exist_phone_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->check_phone_exists_api_v1_auth_auth_exist_phone_get_0: %s\n" % e)
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

# **get_profile_api_v1_auth_auth_profile_get**
> object get_profile_api_v1_auth_auth_profile_get()

Get personal profile with roles and posts

Get detailed profile including roles and posts.

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
    api_instance = zhs_api.AuthenticationApi(api_client)

    try:
        # Get personal profile with roles and posts
        api_response = api_instance.get_profile_api_v1_auth_auth_profile_get()
        print("The response of AuthenticationApi->get_profile_api_v1_auth_auth_profile_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->get_profile_api_v1_auth_auth_profile_get: %s\n" % e)
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

# **get_profile_api_v1_auth_auth_profile_get_0**
> object get_profile_api_v1_auth_auth_profile_get_0()

Get personal profile with roles and posts

Get detailed profile including roles and posts.

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
    api_instance = zhs_api.AuthenticationApi(api_client)

    try:
        # Get personal profile with roles and posts
        api_response = api_instance.get_profile_api_v1_auth_auth_profile_get_0()
        print("The response of AuthenticationApi->get_profile_api_v1_auth_auth_profile_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->get_profile_api_v1_auth_auth_profile_get_0: %s\n" % e)
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

# **get_user_info_api_v1_auth_auth_info_get**
> object get_user_info_api_v1_auth_auth_info_get()

Get current user info

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
    api_instance = zhs_api.AuthenticationApi(api_client)

    try:
        # Get current user info
        api_response = api_instance.get_user_info_api_v1_auth_auth_info_get()
        print("The response of AuthenticationApi->get_user_info_api_v1_auth_auth_info_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->get_user_info_api_v1_auth_auth_info_get: %s\n" % e)
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

# **get_user_info_api_v1_auth_auth_info_get_0**
> object get_user_info_api_v1_auth_auth_info_get_0()

Get current user info

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
    api_instance = zhs_api.AuthenticationApi(api_client)

    try:
        # Get current user info
        api_response = api_instance.get_user_info_api_v1_auth_auth_info_get_0()
        print("The response of AuthenticationApi->get_user_info_api_v1_auth_auth_info_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->get_user_info_api_v1_auth_auth_info_get_0: %s\n" % e)
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

# **login_api_v1_auth_auth_login_post**
> object login_api_v1_auth_auth_login_post(phone, password=password)

Password login

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
    api_instance = zhs_api.AuthenticationApi(api_client)
    phone = 'phone_example' # str | 
    password = 'password_example' # str |  (optional)

    try:
        # Password login
        api_response = api_instance.login_api_v1_auth_auth_login_post(phone, password=password)
        print("The response of AuthenticationApi->login_api_v1_auth_auth_login_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->login_api_v1_auth_auth_login_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **str**|  | 
 **password** | **str**|  | [optional] 

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

# **login_api_v1_auth_auth_login_post_0**
> object login_api_v1_auth_auth_login_post_0(phone, password=password)

Password login

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
    api_instance = zhs_api.AuthenticationApi(api_client)
    phone = 'phone_example' # str | 
    password = 'password_example' # str |  (optional)

    try:
        # Password login
        api_response = api_instance.login_api_v1_auth_auth_login_post_0(phone, password=password)
        print("The response of AuthenticationApi->login_api_v1_auth_auth_login_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->login_api_v1_auth_auth_login_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **str**|  | 
 **password** | **str**|  | [optional] 

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

# **login_sms_api_v1_auth_auth_login_sms_post**
> object login_sms_api_v1_auth_auth_login_sms_post(phone, code)

SMS code login

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
    api_instance = zhs_api.AuthenticationApi(api_client)
    phone = 'phone_example' # str | 
    code = 'code_example' # str | 

    try:
        # SMS code login
        api_response = api_instance.login_sms_api_v1_auth_auth_login_sms_post(phone, code)
        print("The response of AuthenticationApi->login_sms_api_v1_auth_auth_login_sms_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->login_sms_api_v1_auth_auth_login_sms_post: %s\n" % e)
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

# **login_sms_api_v1_auth_auth_login_sms_post_0**
> object login_sms_api_v1_auth_auth_login_sms_post_0(phone, code)

SMS code login

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
    api_instance = zhs_api.AuthenticationApi(api_client)
    phone = 'phone_example' # str | 
    code = 'code_example' # str | 

    try:
        # SMS code login
        api_response = api_instance.login_sms_api_v1_auth_auth_login_sms_post_0(phone, code)
        print("The response of AuthenticationApi->login_sms_api_v1_auth_auth_login_sms_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->login_sms_api_v1_auth_auth_login_sms_post_0: %s\n" % e)
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

# **logout_api_v1_auth_auth_logout_post**
> object logout_api_v1_auth_auth_logout_post()

Logout

登出 - 把当前 token 加入黑名单, 立即失效.

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
    api_instance = zhs_api.AuthenticationApi(api_client)

    try:
        # Logout
        api_response = api_instance.logout_api_v1_auth_auth_logout_post()
        print("The response of AuthenticationApi->logout_api_v1_auth_auth_logout_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->logout_api_v1_auth_auth_logout_post: %s\n" % e)
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

# **logout_api_v1_auth_auth_logout_post_0**
> object logout_api_v1_auth_auth_logout_post_0()

Logout

登出 - 把当前 token 加入黑名单, 立即失效.

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
    api_instance = zhs_api.AuthenticationApi(api_client)

    try:
        # Logout
        api_response = api_instance.logout_api_v1_auth_auth_logout_post_0()
        print("The response of AuthenticationApi->logout_api_v1_auth_auth_logout_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->logout_api_v1_auth_auth_logout_post_0: %s\n" % e)
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

# **refresh_token_api_v1_auth_auth_refresh_post**
> object refresh_token_api_v1_auth_auth_refresh_post(refresh_token)

Refresh access token (rotate)

使用 refresh token 轮转颁发新 access + refresh.

安全机制 (Bug-53 rotate_refresh):
  - 旧 refresh 立即进入黑名单 (Redis SET, 7 天 TTL)
  - 检测同 jti 二次使用 → 整 family 失效 + 上报重放告警
  - 同 family 内的旧 jti 都失效, 用户必须重新登录

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
    api_instance = zhs_api.AuthenticationApi(api_client)
    refresh_token = 'refresh_token_example' # str | 

    try:
        # Refresh access token (rotate)
        api_response = api_instance.refresh_token_api_v1_auth_auth_refresh_post(refresh_token)
        print("The response of AuthenticationApi->refresh_token_api_v1_auth_auth_refresh_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->refresh_token_api_v1_auth_auth_refresh_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **refresh_token** | **str**|  | 

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

# **refresh_token_api_v1_auth_auth_refresh_post_0**
> object refresh_token_api_v1_auth_auth_refresh_post_0(refresh_token)

Refresh access token (rotate)

使用 refresh token 轮转颁发新 access + refresh.

安全机制 (Bug-53 rotate_refresh):
  - 旧 refresh 立即进入黑名单 (Redis SET, 7 天 TTL)
  - 检测同 jti 二次使用 → 整 family 失效 + 上报重放告警
  - 同 family 内的旧 jti 都失效, 用户必须重新登录

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
    api_instance = zhs_api.AuthenticationApi(api_client)
    refresh_token = 'refresh_token_example' # str | 

    try:
        # Refresh access token (rotate)
        api_response = api_instance.refresh_token_api_v1_auth_auth_refresh_post_0(refresh_token)
        print("The response of AuthenticationApi->refresh_token_api_v1_auth_auth_refresh_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->refresh_token_api_v1_auth_auth_refresh_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **refresh_token** | **str**|  | 

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

# **register_api_v1_auth_auth_register_post**
> object register_api_v1_auth_auth_register_post(phone, password, nickname=nickname)

Register new user

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
    api_instance = zhs_api.AuthenticationApi(api_client)
    phone = 'phone_example' # str | 
    password = 'password_example' # str | 
    nickname = 'nickname_example' # str |  (optional)

    try:
        # Register new user
        api_response = api_instance.register_api_v1_auth_auth_register_post(phone, password, nickname=nickname)
        print("The response of AuthenticationApi->register_api_v1_auth_auth_register_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->register_api_v1_auth_auth_register_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **str**|  | 
 **password** | **str**|  | 
 **nickname** | **str**|  | [optional] 

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

# **register_api_v1_auth_auth_register_post_0**
> object register_api_v1_auth_auth_register_post_0(phone, password, nickname=nickname)

Register new user

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
    api_instance = zhs_api.AuthenticationApi(api_client)
    phone = 'phone_example' # str | 
    password = 'password_example' # str | 
    nickname = 'nickname_example' # str |  (optional)

    try:
        # Register new user
        api_response = api_instance.register_api_v1_auth_auth_register_post_0(phone, password, nickname=nickname)
        print("The response of AuthenticationApi->register_api_v1_auth_auth_register_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->register_api_v1_auth_auth_register_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **str**|  | 
 **password** | **str**|  | 
 **nickname** | **str**|  | [optional] 

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

# **send_code_api_v1_auth_auth_sms_code_post**
> object send_code_api_v1_auth_auth_sms_code_post(phone)

Send SMS verification code

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
    api_instance = zhs_api.AuthenticationApi(api_client)
    phone = 'phone_example' # str | 

    try:
        # Send SMS verification code
        api_response = api_instance.send_code_api_v1_auth_auth_sms_code_post(phone)
        print("The response of AuthenticationApi->send_code_api_v1_auth_auth_sms_code_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->send_code_api_v1_auth_auth_sms_code_post: %s\n" % e)
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

# **send_code_api_v1_auth_auth_sms_code_post_0**
> object send_code_api_v1_auth_auth_sms_code_post_0(phone)

Send SMS verification code

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
    api_instance = zhs_api.AuthenticationApi(api_client)
    phone = 'phone_example' # str | 

    try:
        # Send SMS verification code
        api_response = api_instance.send_code_api_v1_auth_auth_sms_code_post_0(phone)
        print("The response of AuthenticationApi->send_code_api_v1_auth_auth_sms_code_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->send_code_api_v1_auth_auth_sms_code_post_0: %s\n" % e)
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

# **update_profile_api_v1_auth_auth_profile_put**
> object update_profile_api_v1_auth_auth_profile_put(body_update_profile_api_v1_auth_auth_profile_put=body_update_profile_api_v1_auth_auth_profile_put)

Update personal profile

Update user profile fields (nickname, email, gender).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.body_update_profile_api_v1_auth_auth_profile_put import BodyUpdateProfileApiV1AuthAuthProfilePut
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
    api_instance = zhs_api.AuthenticationApi(api_client)
    body_update_profile_api_v1_auth_auth_profile_put = zhs_api.BodyUpdateProfileApiV1AuthAuthProfilePut() # BodyUpdateProfileApiV1AuthAuthProfilePut |  (optional)

    try:
        # Update personal profile
        api_response = api_instance.update_profile_api_v1_auth_auth_profile_put(body_update_profile_api_v1_auth_auth_profile_put=body_update_profile_api_v1_auth_auth_profile_put)
        print("The response of AuthenticationApi->update_profile_api_v1_auth_auth_profile_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->update_profile_api_v1_auth_auth_profile_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_update_profile_api_v1_auth_auth_profile_put** | [**BodyUpdateProfileApiV1AuthAuthProfilePut**](BodyUpdateProfileApiV1AuthAuthProfilePut.md)|  | [optional] 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **update_profile_api_v1_auth_auth_profile_put_0**
> object update_profile_api_v1_auth_auth_profile_put_0(body_update_profile_api_v1_auth_auth_profile_put=body_update_profile_api_v1_auth_auth_profile_put)

Update personal profile

Update user profile fields (nickname, email, gender).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.body_update_profile_api_v1_auth_auth_profile_put import BodyUpdateProfileApiV1AuthAuthProfilePut
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
    api_instance = zhs_api.AuthenticationApi(api_client)
    body_update_profile_api_v1_auth_auth_profile_put = zhs_api.BodyUpdateProfileApiV1AuthAuthProfilePut() # BodyUpdateProfileApiV1AuthAuthProfilePut |  (optional)

    try:
        # Update personal profile
        api_response = api_instance.update_profile_api_v1_auth_auth_profile_put_0(body_update_profile_api_v1_auth_auth_profile_put=body_update_profile_api_v1_auth_auth_profile_put)
        print("The response of AuthenticationApi->update_profile_api_v1_auth_auth_profile_put_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->update_profile_api_v1_auth_auth_profile_put_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_update_profile_api_v1_auth_auth_profile_put** | [**BodyUpdateProfileApiV1AuthAuthProfilePut**](BodyUpdateProfileApiV1AuthAuthProfilePut.md)|  | [optional] 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **upload_avatar_api_v1_auth_auth_profile_avatar_post**
> object upload_avatar_api_v1_auth_auth_profile_avatar_post(file)

Upload avatar

Upload avatar image to MinIO and update user record.

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
    api_instance = zhs_api.AuthenticationApi(api_client)
    file = None # bytes | 

    try:
        # Upload avatar
        api_response = api_instance.upload_avatar_api_v1_auth_auth_profile_avatar_post(file)
        print("The response of AuthenticationApi->upload_avatar_api_v1_auth_auth_profile_avatar_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->upload_avatar_api_v1_auth_auth_profile_avatar_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file** | **bytes**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **upload_avatar_api_v1_auth_auth_profile_avatar_post_0**
> object upload_avatar_api_v1_auth_auth_profile_avatar_post_0(file)

Upload avatar

Upload avatar image to MinIO and update user record.

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
    api_instance = zhs_api.AuthenticationApi(api_client)
    file = None # bytes | 

    try:
        # Upload avatar
        api_response = api_instance.upload_avatar_api_v1_auth_auth_profile_avatar_post_0(file)
        print("The response of AuthenticationApi->upload_avatar_api_v1_auth_auth_profile_avatar_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthenticationApi->upload_avatar_api_v1_auth_auth_profile_avatar_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file** | **bytes**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

