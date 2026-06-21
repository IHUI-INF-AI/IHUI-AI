# zhs_api.AuthIdentityApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**audit_api_v1_auth_identity_aid_audit_put**](AuthIdentityApi.md#audit_api_v1_auth_identity_aid_audit_put) | **PUT** /api/v1/auth-identity/{aid}/audit | 审核认证
[**audit_api_v1_auth_identity_aid_audit_put_0**](AuthIdentityApi.md#audit_api_v1_auth_identity_aid_audit_put_0) | **PUT** /api/v1/auth-identity/{aid}/audit | 审核认证
[**auth_identity_submit**](AuthIdentityApi.md#auth_identity_submit) | **POST** /api/v1/auth-identity/submit | 提交实名认证
[**auth_identity_submit_0**](AuthIdentityApi.md#auth_identity_submit_0) | **POST** /api/v1/auth-identity/submit | 提交实名认证
[**list_identities_api_v1_auth_identity_list_get**](AuthIdentityApi.md#list_identities_api_v1_auth_identity_list_get) | **GET** /api/v1/auth-identity/list | 认证列表(管理员)
[**list_identities_api_v1_auth_identity_list_get_0**](AuthIdentityApi.md#list_identities_api_v1_auth_identity_list_get_0) | **GET** /api/v1/auth-identity/list | 认证列表(管理员)
[**my_identity_api_v1_auth_identity_my_get**](AuthIdentityApi.md#my_identity_api_v1_auth_identity_my_get) | **GET** /api/v1/auth-identity/my | 我的认证
[**my_identity_api_v1_auth_identity_my_get_0**](AuthIdentityApi.md#my_identity_api_v1_auth_identity_my_get_0) | **GET** /api/v1/auth-identity/my | 我的认证


# **audit_api_v1_auth_identity_aid_audit_put**
> object audit_api_v1_auth_identity_aid_audit_put(aid, status, remark=remark, expire_days=expire_days)

审核认证

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
    api_instance = zhs_api.AuthIdentityApi(api_client)
    aid = 56 # int | 
    status = 56 # int | 
    remark = 'remark_example' # str |  (optional)
    expire_days = 365 # int |  (optional) (default to 365)

    try:
        # 审核认证
        api_response = api_instance.audit_api_v1_auth_identity_aid_audit_put(aid, status, remark=remark, expire_days=expire_days)
        print("The response of AuthIdentityApi->audit_api_v1_auth_identity_aid_audit_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthIdentityApi->audit_api_v1_auth_identity_aid_audit_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 
 **status** | **int**|  | 
 **remark** | **str**|  | [optional] 
 **expire_days** | **int**|  | [optional] [default to 365]

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

# **audit_api_v1_auth_identity_aid_audit_put_0**
> object audit_api_v1_auth_identity_aid_audit_put_0(aid, status, remark=remark, expire_days=expire_days)

审核认证

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
    api_instance = zhs_api.AuthIdentityApi(api_client)
    aid = 56 # int | 
    status = 56 # int | 
    remark = 'remark_example' # str |  (optional)
    expire_days = 365 # int |  (optional) (default to 365)

    try:
        # 审核认证
        api_response = api_instance.audit_api_v1_auth_identity_aid_audit_put_0(aid, status, remark=remark, expire_days=expire_days)
        print("The response of AuthIdentityApi->audit_api_v1_auth_identity_aid_audit_put_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthIdentityApi->audit_api_v1_auth_identity_aid_audit_put_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 
 **status** | **int**|  | 
 **remark** | **str**|  | [optional] 
 **expire_days** | **int**|  | [optional] [default to 365]

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

# **auth_identity_submit**
> object auth_identity_submit(real_name, id_card, phone=phone, id_card_front=id_card_front, id_card_back=id_card_back, type=type)

提交实名认证

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
    api_instance = zhs_api.AuthIdentityApi(api_client)
    real_name = 'real_name_example' # str | 
    id_card = 'id_card_example' # str | 
    phone = 'phone_example' # str |  (optional)
    id_card_front = 'id_card_front_example' # str |  (optional)
    id_card_back = 'id_card_back_example' # str |  (optional)
    type = 1 # int |  (optional) (default to 1)

    try:
        # 提交实名认证
        api_response = api_instance.auth_identity_submit(real_name, id_card, phone=phone, id_card_front=id_card_front, id_card_back=id_card_back, type=type)
        print("The response of AuthIdentityApi->auth_identity_submit:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthIdentityApi->auth_identity_submit: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **real_name** | **str**|  | 
 **id_card** | **str**|  | 
 **phone** | **str**|  | [optional] 
 **id_card_front** | **str**|  | [optional] 
 **id_card_back** | **str**|  | [optional] 
 **type** | **int**|  | [optional] [default to 1]

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

# **auth_identity_submit_0**
> object auth_identity_submit_0(real_name, id_card, phone=phone, id_card_front=id_card_front, id_card_back=id_card_back, type=type)

提交实名认证

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
    api_instance = zhs_api.AuthIdentityApi(api_client)
    real_name = 'real_name_example' # str | 
    id_card = 'id_card_example' # str | 
    phone = 'phone_example' # str |  (optional)
    id_card_front = 'id_card_front_example' # str |  (optional)
    id_card_back = 'id_card_back_example' # str |  (optional)
    type = 1 # int |  (optional) (default to 1)

    try:
        # 提交实名认证
        api_response = api_instance.auth_identity_submit_0(real_name, id_card, phone=phone, id_card_front=id_card_front, id_card_back=id_card_back, type=type)
        print("The response of AuthIdentityApi->auth_identity_submit_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthIdentityApi->auth_identity_submit_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **real_name** | **str**|  | 
 **id_card** | **str**|  | 
 **phone** | **str**|  | [optional] 
 **id_card_front** | **str**|  | [optional] 
 **id_card_back** | **str**|  | [optional] 
 **type** | **int**|  | [optional] [default to 1]

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

# **list_identities_api_v1_auth_identity_list_get**
> object list_identities_api_v1_auth_identity_list_get(page=page, limit=limit, status=status)

认证列表(管理员)

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
    api_instance = zhs_api.AuthIdentityApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    status = 56 # int |  (optional)

    try:
        # 认证列表(管理员)
        api_response = api_instance.list_identities_api_v1_auth_identity_list_get(page=page, limit=limit, status=status)
        print("The response of AuthIdentityApi->list_identities_api_v1_auth_identity_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthIdentityApi->list_identities_api_v1_auth_identity_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
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

# **list_identities_api_v1_auth_identity_list_get_0**
> object list_identities_api_v1_auth_identity_list_get_0(page=page, limit=limit, status=status)

认证列表(管理员)

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
    api_instance = zhs_api.AuthIdentityApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    status = 56 # int |  (optional)

    try:
        # 认证列表(管理员)
        api_response = api_instance.list_identities_api_v1_auth_identity_list_get_0(page=page, limit=limit, status=status)
        print("The response of AuthIdentityApi->list_identities_api_v1_auth_identity_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthIdentityApi->list_identities_api_v1_auth_identity_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
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

# **my_identity_api_v1_auth_identity_my_get**
> object my_identity_api_v1_auth_identity_my_get()

我的认证

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
    api_instance = zhs_api.AuthIdentityApi(api_client)

    try:
        # 我的认证
        api_response = api_instance.my_identity_api_v1_auth_identity_my_get()
        print("The response of AuthIdentityApi->my_identity_api_v1_auth_identity_my_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthIdentityApi->my_identity_api_v1_auth_identity_my_get: %s\n" % e)
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

# **my_identity_api_v1_auth_identity_my_get_0**
> object my_identity_api_v1_auth_identity_my_get_0()

我的认证

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
    api_instance = zhs_api.AuthIdentityApi(api_client)

    try:
        # 我的认证
        api_response = api_instance.my_identity_api_v1_auth_identity_my_get_0()
        print("The response of AuthIdentityApi->my_identity_api_v1_auth_identity_my_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthIdentityApi->my_identity_api_v1_auth_identity_my_get_0: %s\n" % e)
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

