# zhs_api.RemoteDeviceApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**agent_by_collect_api_v1_remote_agent_by_collect_uuid_get**](RemoteDeviceApi.md#agent_by_collect_api_v1_remote_agent_by_collect_uuid_get) | **GET** /api/v1/remote/agent/by/collect/{uuid} | Agent By Collect
[**agent_by_collect_api_v1_remote_agent_by_collect_uuid_get_0**](RemoteDeviceApi.md#agent_by_collect_api_v1_remote_agent_by_collect_uuid_get_0) | **GET** /api/v1/remote/agent/by/collect/{uuid} | Agent By Collect
[**agent_by_pay_api_v1_remote_agent_by_pay_get**](RemoteDeviceApi.md#agent_by_pay_api_v1_remote_agent_by_pay_get) | **GET** /api/v1/remote/agent/by/pay | Agent By Pay
[**agent_by_pay_api_v1_remote_agent_by_pay_get_0**](RemoteDeviceApi.md#agent_by_pay_api_v1_remote_agent_by_pay_get_0) | **GET** /api/v1/remote/agent/by/pay | Agent By Pay
[**agent_by_type_api_v1_remote_agent_by_type_get**](RemoteDeviceApi.md#agent_by_type_api_v1_remote_agent_by_type_get) | **GET** /api/v1/remote/agent/by/type | Agent By Type
[**agent_by_type_api_v1_remote_agent_by_type_get_0**](RemoteDeviceApi.md#agent_by_type_api_v1_remote_agent_by_type_get_0) | **GET** /api/v1/remote/agent/by/type | Agent By Type
[**agent_category2_api_v1_remote_agent_category2_get**](RemoteDeviceApi.md#agent_category2_api_v1_remote_agent_category2_get) | **GET** /api/v1/remote/agent/category2 | Agent Category2
[**agent_category2_api_v1_remote_agent_category2_get_0**](RemoteDeviceApi.md#agent_category2_api_v1_remote_agent_category2_get_0) | **GET** /api/v1/remote/agent/category2 | Agent Category2
[**agent_category_api_v1_remote_agent_category_get**](RemoteDeviceApi.md#agent_category_api_v1_remote_agent_category_get) | **GET** /api/v1/remote/agent/category | Agent Category
[**agent_category_api_v1_remote_agent_category_get_0**](RemoteDeviceApi.md#agent_category_api_v1_remote_agent_category_get_0) | **GET** /api/v1/remote/agent/category | Agent Category
[**get_info_api_v1_remote_info_uuid_get**](RemoteDeviceApi.md#get_info_api_v1_remote_info_uuid_get) | **GET** /api/v1/remote/info/{uuid} | Get Info
[**get_info_api_v1_remote_info_uuid_get_0**](RemoteDeviceApi.md#get_info_api_v1_remote_info_uuid_get_0) | **GET** /api/v1/remote/info/{uuid} | Get Info
[**get_role_api_v1_remote_role_get**](RemoteDeviceApi.md#get_role_api_v1_remote_role_get) | **GET** /api/v1/remote/role | Get Role
[**get_role_api_v1_remote_role_get_0**](RemoteDeviceApi.md#get_role_api_v1_remote_role_get_0) | **GET** /api/v1/remote/role | Get Role
[**get_withdrawal_open_api_v1_remote_get_true_get**](RemoteDeviceApi.md#get_withdrawal_open_api_v1_remote_get_true_get) | **GET** /api/v1/remote/get/true | Get Withdrawal Open
[**get_withdrawal_open_api_v1_remote_get_true_get_0**](RemoteDeviceApi.md#get_withdrawal_open_api_v1_remote_get_true_get_0) | **GET** /api/v1/remote/get/true | Get Withdrawal Open
[**my_team_api_v1_remote_my_team_uuid_post**](RemoteDeviceApi.md#my_team_api_v1_remote_my_team_uuid_post) | **POST** /api/v1/remote/myTeam/{uuid} | My Team
[**my_team_api_v1_remote_my_team_uuid_post_0**](RemoteDeviceApi.md#my_team_api_v1_remote_my_team_uuid_post_0) | **POST** /api/v1/remote/myTeam/{uuid} | My Team
[**tencent_asr_api_v1_remote_get_tencent_sentence_post**](RemoteDeviceApi.md#tencent_asr_api_v1_remote_get_tencent_sentence_post) | **POST** /api/v1/remote/get/tencent/sentence | Tencent Asr
[**tencent_asr_api_v1_remote_get_tencent_sentence_post_0**](RemoteDeviceApi.md#tencent_asr_api_v1_remote_get_tencent_sentence_post_0) | **POST** /api/v1/remote/get/tencent/sentence | Tencent Asr
[**upload_business_card_api_v1_remote_upload_business_card_post**](RemoteDeviceApi.md#upload_business_card_api_v1_remote_upload_business_card_post) | **POST** /api/v1/remote/uploadBusinessCard | Upload Business Card
[**upload_business_card_api_v1_remote_upload_business_card_post_0**](RemoteDeviceApi.md#upload_business_card_api_v1_remote_upload_business_card_post_0) | **POST** /api/v1/remote/uploadBusinessCard | Upload Business Card


# **agent_by_collect_api_v1_remote_agent_by_collect_uuid_get**
> object agent_by_collect_api_v1_remote_agent_by_collect_uuid_get(uuid, search=search, page=page, size=size)

Agent By Collect

对应 Java: GET /remote/agent/by/collect/{uuid}?search= (查收藏表, 此处简化).

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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    uuid = 'uuid_example' # str | 
    search = 'search_example' # str |  (optional)
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # Agent By Collect
        api_response = api_instance.agent_by_collect_api_v1_remote_agent_by_collect_uuid_get(uuid, search=search, page=page, size=size)
        print("The response of RemoteDeviceApi->agent_by_collect_api_v1_remote_agent_by_collect_uuid_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->agent_by_collect_api_v1_remote_agent_by_collect_uuid_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **uuid** | **str**|  | 
 **search** | **str**|  | [optional] 
 **page** | **int**|  | [optional] [default to 1]
 **size** | **int**|  | [optional] [default to 20]

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

# **agent_by_collect_api_v1_remote_agent_by_collect_uuid_get_0**
> object agent_by_collect_api_v1_remote_agent_by_collect_uuid_get_0(uuid, search=search, page=page, size=size)

Agent By Collect

对应 Java: GET /remote/agent/by/collect/{uuid}?search= (查收藏表, 此处简化).

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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    uuid = 'uuid_example' # str | 
    search = 'search_example' # str |  (optional)
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # Agent By Collect
        api_response = api_instance.agent_by_collect_api_v1_remote_agent_by_collect_uuid_get_0(uuid, search=search, page=page, size=size)
        print("The response of RemoteDeviceApi->agent_by_collect_api_v1_remote_agent_by_collect_uuid_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->agent_by_collect_api_v1_remote_agent_by_collect_uuid_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **uuid** | **str**|  | 
 **search** | **str**|  | [optional] 
 **page** | **int**|  | [optional] [default to 1]
 **size** | **int**|  | [optional] [default to 20]

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

# **agent_by_pay_api_v1_remote_agent_by_pay_get**
> object agent_by_pay_api_v1_remote_agent_by_pay_get(uuid, search=search, type=type, var_date=var_date, page=page, size=size)

Agent By Pay

对应 Java: GET /remote/agent/by/pay?uuid=&search=&type=&date=

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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    uuid = 'uuid_example' # str | 
    search = 'search_example' # str |  (optional)
    type = 56 # int |  (optional)
    var_date = 'var_date_example' # str |  (optional)
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # Agent By Pay
        api_response = api_instance.agent_by_pay_api_v1_remote_agent_by_pay_get(uuid, search=search, type=type, var_date=var_date, page=page, size=size)
        print("The response of RemoteDeviceApi->agent_by_pay_api_v1_remote_agent_by_pay_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->agent_by_pay_api_v1_remote_agent_by_pay_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **uuid** | **str**|  | 
 **search** | **str**|  | [optional] 
 **type** | **int**|  | [optional] 
 **var_date** | **str**|  | [optional] 
 **page** | **int**|  | [optional] [default to 1]
 **size** | **int**|  | [optional] [default to 20]

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

# **agent_by_pay_api_v1_remote_agent_by_pay_get_0**
> object agent_by_pay_api_v1_remote_agent_by_pay_get_0(uuid, search=search, type=type, var_date=var_date, page=page, size=size)

Agent By Pay

对应 Java: GET /remote/agent/by/pay?uuid=&search=&type=&date=

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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    uuid = 'uuid_example' # str | 
    search = 'search_example' # str |  (optional)
    type = 56 # int |  (optional)
    var_date = 'var_date_example' # str |  (optional)
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # Agent By Pay
        api_response = api_instance.agent_by_pay_api_v1_remote_agent_by_pay_get_0(uuid, search=search, type=type, var_date=var_date, page=page, size=size)
        print("The response of RemoteDeviceApi->agent_by_pay_api_v1_remote_agent_by_pay_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->agent_by_pay_api_v1_remote_agent_by_pay_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **uuid** | **str**|  | 
 **search** | **str**|  | [optional] 
 **type** | **int**|  | [optional] 
 **var_date** | **str**|  | [optional] 
 **page** | **int**|  | [optional] [default to 1]
 **size** | **int**|  | [optional] [default to 20]

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

# **agent_by_type_api_v1_remote_agent_by_type_get**
> object agent_by_type_api_v1_remote_agent_by_type_get(search=search, code=code, page=page, size=size)

Agent By Type

对应 Java: GET /remote/agent/by/type?search=&code=

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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    search = 'search_example' # str |  (optional)
    code = 'code_example' # str |  (optional)
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # Agent By Type
        api_response = api_instance.agent_by_type_api_v1_remote_agent_by_type_get(search=search, code=code, page=page, size=size)
        print("The response of RemoteDeviceApi->agent_by_type_api_v1_remote_agent_by_type_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->agent_by_type_api_v1_remote_agent_by_type_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **search** | **str**|  | [optional] 
 **code** | **str**|  | [optional] 
 **page** | **int**|  | [optional] [default to 1]
 **size** | **int**|  | [optional] [default to 20]

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

# **agent_by_type_api_v1_remote_agent_by_type_get_0**
> object agent_by_type_api_v1_remote_agent_by_type_get_0(search=search, code=code, page=page, size=size)

Agent By Type

对应 Java: GET /remote/agent/by/type?search=&code=

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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    search = 'search_example' # str |  (optional)
    code = 'code_example' # str |  (optional)
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # Agent By Type
        api_response = api_instance.agent_by_type_api_v1_remote_agent_by_type_get_0(search=search, code=code, page=page, size=size)
        print("The response of RemoteDeviceApi->agent_by_type_api_v1_remote_agent_by_type_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->agent_by_type_api_v1_remote_agent_by_type_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **search** | **str**|  | [optional] 
 **code** | **str**|  | [optional] 
 **page** | **int**|  | [optional] [default to 1]
 **size** | **int**|  | [optional] [default to 20]

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

# **agent_category2_api_v1_remote_agent_category2_get**
> object agent_category2_api_v1_remote_agent_category2_get(type=type)

Agent Category2

对应 Java: GET /remote/agent/category2 — AjaxResult 包装 (与上同结构).

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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    type = 'type_example' # str |  (optional)

    try:
        # Agent Category2
        api_response = api_instance.agent_category2_api_v1_remote_agent_category2_get(type=type)
        print("The response of RemoteDeviceApi->agent_category2_api_v1_remote_agent_category2_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->agent_category2_api_v1_remote_agent_category2_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type** | **str**|  | [optional] 

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

# **agent_category2_api_v1_remote_agent_category2_get_0**
> object agent_category2_api_v1_remote_agent_category2_get_0(type=type)

Agent Category2

对应 Java: GET /remote/agent/category2 — AjaxResult 包装 (与上同结构).

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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    type = 'type_example' # str |  (optional)

    try:
        # Agent Category2
        api_response = api_instance.agent_category2_api_v1_remote_agent_category2_get_0(type=type)
        print("The response of RemoteDeviceApi->agent_category2_api_v1_remote_agent_category2_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->agent_category2_api_v1_remote_agent_category2_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type** | **str**|  | [optional] 

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

# **agent_category_api_v1_remote_agent_category_get**
> object agent_category_api_v1_remote_agent_category_get(type=type)

Agent Category

对应 Java: GET /remote/agent/category?type=xxx — ResponseResultInfo 包装.

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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    type = 'type_example' # str |  (optional)

    try:
        # Agent Category
        api_response = api_instance.agent_category_api_v1_remote_agent_category_get(type=type)
        print("The response of RemoteDeviceApi->agent_category_api_v1_remote_agent_category_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->agent_category_api_v1_remote_agent_category_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type** | **str**|  | [optional] 

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

# **agent_category_api_v1_remote_agent_category_get_0**
> object agent_category_api_v1_remote_agent_category_get_0(type=type)

Agent Category

对应 Java: GET /remote/agent/category?type=xxx — ResponseResultInfo 包装.

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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    type = 'type_example' # str |  (optional)

    try:
        # Agent Category
        api_response = api_instance.agent_category_api_v1_remote_agent_category_get_0(type=type)
        print("The response of RemoteDeviceApi->agent_category_api_v1_remote_agent_category_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->agent_category_api_v1_remote_agent_category_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type** | **str**|  | [optional] 

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

# **get_info_api_v1_remote_info_uuid_get**
> object get_info_api_v1_remote_info_uuid_get(uuid, x_device_type=x_device_type)

Get Info

对应 Java: GET /remote/info/{uuid} — 用户基本信息 + 第三方账号绑定.

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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    uuid = 'uuid_example' # str | 
    x_device_type = 'unknown' # str |  (optional) (default to 'unknown')

    try:
        # Get Info
        api_response = api_instance.get_info_api_v1_remote_info_uuid_get(uuid, x_device_type=x_device_type)
        print("The response of RemoteDeviceApi->get_info_api_v1_remote_info_uuid_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->get_info_api_v1_remote_info_uuid_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **uuid** | **str**|  | 
 **x_device_type** | **str**|  | [optional] [default to &#39;unknown&#39;]

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

# **get_info_api_v1_remote_info_uuid_get_0**
> object get_info_api_v1_remote_info_uuid_get_0(uuid, x_device_type=x_device_type)

Get Info

对应 Java: GET /remote/info/{uuid} — 用户基本信息 + 第三方账号绑定.

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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    uuid = 'uuid_example' # str | 
    x_device_type = 'unknown' # str |  (optional) (default to 'unknown')

    try:
        # Get Info
        api_response = api_instance.get_info_api_v1_remote_info_uuid_get_0(uuid, x_device_type=x_device_type)
        print("The response of RemoteDeviceApi->get_info_api_v1_remote_info_uuid_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->get_info_api_v1_remote_info_uuid_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **uuid** | **str**|  | 
 **x_device_type** | **str**|  | [optional] [default to &#39;unknown&#39;]

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

# **get_role_api_v1_remote_role_get**
> object get_role_api_v1_remote_role_get()

Get Role

对应 Java: GET /remote/role — 列出所有可购买的 ZhsProductIdentity.

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
    api_instance = zhs_api.RemoteDeviceApi(api_client)

    try:
        # Get Role
        api_response = api_instance.get_role_api_v1_remote_role_get()
        print("The response of RemoteDeviceApi->get_role_api_v1_remote_role_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->get_role_api_v1_remote_role_get: %s\n" % e)
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

# **get_role_api_v1_remote_role_get_0**
> object get_role_api_v1_remote_role_get_0()

Get Role

对应 Java: GET /remote/role — 列出所有可购买的 ZhsProductIdentity.

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
    api_instance = zhs_api.RemoteDeviceApi(api_client)

    try:
        # Get Role
        api_response = api_instance.get_role_api_v1_remote_role_get_0()
        print("The response of RemoteDeviceApi->get_role_api_v1_remote_role_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->get_role_api_v1_remote_role_get_0: %s\n" % e)
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

# **get_withdrawal_open_api_v1_remote_get_true_get**
> object get_withdrawal_open_api_v1_remote_get_true_get()

Get Withdrawal Open

对应 Java: GET /remote/get/true — 查 ZhsWithdrawalFlow id=1.status==1 → true.

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
    api_instance = zhs_api.RemoteDeviceApi(api_client)

    try:
        # Get Withdrawal Open
        api_response = api_instance.get_withdrawal_open_api_v1_remote_get_true_get()
        print("The response of RemoteDeviceApi->get_withdrawal_open_api_v1_remote_get_true_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->get_withdrawal_open_api_v1_remote_get_true_get: %s\n" % e)
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

# **get_withdrawal_open_api_v1_remote_get_true_get_0**
> object get_withdrawal_open_api_v1_remote_get_true_get_0()

Get Withdrawal Open

对应 Java: GET /remote/get/true — 查 ZhsWithdrawalFlow id=1.status==1 → true.

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
    api_instance = zhs_api.RemoteDeviceApi(api_client)

    try:
        # Get Withdrawal Open
        api_response = api_instance.get_withdrawal_open_api_v1_remote_get_true_get_0()
        print("The response of RemoteDeviceApi->get_withdrawal_open_api_v1_remote_get_true_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->get_withdrawal_open_api_v1_remote_get_true_get_0: %s\n" % e)
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

# **my_team_api_v1_remote_my_team_uuid_post**
> object my_team_api_v1_remote_my_team_uuid_post(uuid, x_device_type=x_device_type, my_team_query=my_team_query)

My Team

对应 Java: POST /remote/myTeam/{uuid} — 查询我的团队 (邀请树子节点).

### Example


```python
import zhs_api
from zhs_api.models.my_team_query import MyTeamQuery
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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    uuid = 'uuid_example' # str | 
    x_device_type = 'unknown' # str |  (optional) (default to 'unknown')
    my_team_query = zhs_api.MyTeamQuery() # MyTeamQuery |  (optional)

    try:
        # My Team
        api_response = api_instance.my_team_api_v1_remote_my_team_uuid_post(uuid, x_device_type=x_device_type, my_team_query=my_team_query)
        print("The response of RemoteDeviceApi->my_team_api_v1_remote_my_team_uuid_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->my_team_api_v1_remote_my_team_uuid_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **uuid** | **str**|  | 
 **x_device_type** | **str**|  | [optional] [default to &#39;unknown&#39;]
 **my_team_query** | [**MyTeamQuery**](MyTeamQuery.md)|  | [optional] 

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

# **my_team_api_v1_remote_my_team_uuid_post_0**
> object my_team_api_v1_remote_my_team_uuid_post_0(uuid, x_device_type=x_device_type, my_team_query=my_team_query)

My Team

对应 Java: POST /remote/myTeam/{uuid} — 查询我的团队 (邀请树子节点).

### Example


```python
import zhs_api
from zhs_api.models.my_team_query import MyTeamQuery
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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    uuid = 'uuid_example' # str | 
    x_device_type = 'unknown' # str |  (optional) (default to 'unknown')
    my_team_query = zhs_api.MyTeamQuery() # MyTeamQuery |  (optional)

    try:
        # My Team
        api_response = api_instance.my_team_api_v1_remote_my_team_uuid_post_0(uuid, x_device_type=x_device_type, my_team_query=my_team_query)
        print("The response of RemoteDeviceApi->my_team_api_v1_remote_my_team_uuid_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->my_team_api_v1_remote_my_team_uuid_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **uuid** | **str**|  | 
 **x_device_type** | **str**|  | [optional] [default to &#39;unknown&#39;]
 **my_team_query** | [**MyTeamQuery**](MyTeamQuery.md)|  | [optional] 

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

# **tencent_asr_api_v1_remote_get_tencent_sentence_post**
> object tencent_asr_api_v1_remote_get_tencent_sentence_post(tencent_asr_req)

Tencent Asr

对应 Java: POST /remote/get/tencent/sentence — 调用腾讯云一句话识别.

Java 端直接用腾讯云 SDK.
Python 这边如果想保真实现需安装 tencentcloud-sdk-python, 此处用占位实现
(返回模拟结果, 生产部署时配置 TENCENT_SECRET_ID/SECRET_KEY 后切换为真实 SDK).

### Example


```python
import zhs_api
from zhs_api.models.tencent_asr_req import TencentAsrReq
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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    tencent_asr_req = zhs_api.TencentAsrReq() # TencentAsrReq | 

    try:
        # Tencent Asr
        api_response = api_instance.tencent_asr_api_v1_remote_get_tencent_sentence_post(tencent_asr_req)
        print("The response of RemoteDeviceApi->tencent_asr_api_v1_remote_get_tencent_sentence_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->tencent_asr_api_v1_remote_get_tencent_sentence_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tencent_asr_req** | [**TencentAsrReq**](TencentAsrReq.md)|  | 

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

# **tencent_asr_api_v1_remote_get_tencent_sentence_post_0**
> object tencent_asr_api_v1_remote_get_tencent_sentence_post_0(tencent_asr_req)

Tencent Asr

对应 Java: POST /remote/get/tencent/sentence — 调用腾讯云一句话识别.

Java 端直接用腾讯云 SDK.
Python 这边如果想保真实现需安装 tencentcloud-sdk-python, 此处用占位实现
(返回模拟结果, 生产部署时配置 TENCENT_SECRET_ID/SECRET_KEY 后切换为真实 SDK).

### Example


```python
import zhs_api
from zhs_api.models.tencent_asr_req import TencentAsrReq
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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    tencent_asr_req = zhs_api.TencentAsrReq() # TencentAsrReq | 

    try:
        # Tencent Asr
        api_response = api_instance.tencent_asr_api_v1_remote_get_tencent_sentence_post_0(tencent_asr_req)
        print("The response of RemoteDeviceApi->tencent_asr_api_v1_remote_get_tencent_sentence_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->tencent_asr_api_v1_remote_get_tencent_sentence_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tencent_asr_req** | [**TencentAsrReq**](TencentAsrReq.md)|  | 

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

# **upload_business_card_api_v1_remote_upload_business_card_post**
> object upload_business_card_api_v1_remote_upload_business_card_post(business_card_req, x_device_type=x_device_type)

Upload Business Card

对应 Java: POST /remote/uploadBusinessCard — 上传 base64 名片到 MinIO.

### Example


```python
import zhs_api
from zhs_api.models.business_card_req import BusinessCardReq
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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    business_card_req = zhs_api.BusinessCardReq() # BusinessCardReq | 
    x_device_type = 'unknown' # str |  (optional) (default to 'unknown')

    try:
        # Upload Business Card
        api_response = api_instance.upload_business_card_api_v1_remote_upload_business_card_post(business_card_req, x_device_type=x_device_type)
        print("The response of RemoteDeviceApi->upload_business_card_api_v1_remote_upload_business_card_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->upload_business_card_api_v1_remote_upload_business_card_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **business_card_req** | [**BusinessCardReq**](BusinessCardReq.md)|  | 
 **x_device_type** | **str**|  | [optional] [default to &#39;unknown&#39;]

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

# **upload_business_card_api_v1_remote_upload_business_card_post_0**
> object upload_business_card_api_v1_remote_upload_business_card_post_0(business_card_req, x_device_type=x_device_type)

Upload Business Card

对应 Java: POST /remote/uploadBusinessCard — 上传 base64 名片到 MinIO.

### Example


```python
import zhs_api
from zhs_api.models.business_card_req import BusinessCardReq
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
    api_instance = zhs_api.RemoteDeviceApi(api_client)
    business_card_req = zhs_api.BusinessCardReq() # BusinessCardReq | 
    x_device_type = 'unknown' # str |  (optional) (default to 'unknown')

    try:
        # Upload Business Card
        api_response = api_instance.upload_business_card_api_v1_remote_upload_business_card_post_0(business_card_req, x_device_type=x_device_type)
        print("The response of RemoteDeviceApi->upload_business_card_api_v1_remote_upload_business_card_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RemoteDeviceApi->upload_business_card_api_v1_remote_upload_business_card_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **business_card_req** | [**BusinessCardReq**](BusinessCardReq.md)|  | 
 **x_device_type** | **str**|  | [optional] [default to &#39;unknown&#39;]

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

