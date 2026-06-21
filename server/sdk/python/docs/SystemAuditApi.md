# zhs_api.SystemAuditApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**clean_login_info_api_v1_system_audit_logininfor_clean_post**](SystemAuditApi.md#clean_login_info_api_v1_system_audit_logininfor_clean_post) | **POST** /api/v1/system/audit/logininfor/clean | 清理登录日志
[**clean_oper_log_api_v1_system_audit_operlog_clean_post**](SystemAuditApi.md#clean_oper_log_api_v1_system_audit_operlog_clean_post) | **POST** /api/v1/system/audit/operlog/clean | 清理 N 天前的操作日志
[**create_login_info_api_v1_system_audit_logininfor_create_post**](SystemAuditApi.md#create_login_info_api_v1_system_audit_logininfor_create_post) | **POST** /api/v1/system/audit/logininfor/create | 记录一条登录日志
[**create_oper_log_api_v1_system_audit_operlog_create_post**](SystemAuditApi.md#create_oper_log_api_v1_system_audit_operlog_create_post) | **POST** /api/v1/system/audit/operlog/create | 写入一条操作日志（内部调用）
[**export_login_info_api_v1_system_audit_logininfor_export_get**](SystemAuditApi.md#export_login_info_api_v1_system_audit_logininfor_export_get) | **GET** /api/v1/system/audit/logininfor/export | 导出登录日志到Excel
[**export_oper_logs_api_v1_system_audit_operlog_export_get**](SystemAuditApi.md#export_oper_logs_api_v1_system_audit_operlog_export_get) | **GET** /api/v1/system/audit/operlog/export | 导出操作日志到Excel
[**list_login_info_api_v1_system_audit_logininfor_list_get**](SystemAuditApi.md#list_login_info_api_v1_system_audit_logininfor_list_get) | **GET** /api/v1/system/audit/logininfor/list | 登录日志列表
[**list_oper_logs_api_v1_system_audit_operlog_list_get**](SystemAuditApi.md#list_oper_logs_api_v1_system_audit_operlog_list_get) | **GET** /api/v1/system/audit/operlog/list | 操作日志列表


# **clean_login_info_api_v1_system_audit_logininfor_clean_post**
> object clean_login_info_api_v1_system_audit_logininfor_clean_post(days=days)

清理登录日志

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
    api_instance = zhs_api.SystemAuditApi(api_client)
    days = 90 # int |  (optional) (default to 90)

    try:
        # 清理登录日志
        api_response = api_instance.clean_login_info_api_v1_system_audit_logininfor_clean_post(days=days)
        print("The response of SystemAuditApi->clean_login_info_api_v1_system_audit_logininfor_clean_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAuditApi->clean_login_info_api_v1_system_audit_logininfor_clean_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **days** | **int**|  | [optional] [default to 90]

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

# **clean_oper_log_api_v1_system_audit_operlog_clean_post**
> object clean_oper_log_api_v1_system_audit_operlog_clean_post(days=days)

清理 N 天前的操作日志

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
    api_instance = zhs_api.SystemAuditApi(api_client)
    days = 90 # int | 保留天数 (optional) (default to 90)

    try:
        # 清理 N 天前的操作日志
        api_response = api_instance.clean_oper_log_api_v1_system_audit_operlog_clean_post(days=days)
        print("The response of SystemAuditApi->clean_oper_log_api_v1_system_audit_operlog_clean_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAuditApi->clean_oper_log_api_v1_system_audit_operlog_clean_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **days** | **int**| 保留天数 | [optional] [default to 90]

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

# **create_login_info_api_v1_system_audit_logininfor_create_post**
> object create_login_info_api_v1_system_audit_logininfor_create_post(user_name, ipaddr=ipaddr, login_location=login_location, browser=browser, os=os, status=status, msg=msg)

记录一条登录日志

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
    api_instance = zhs_api.SystemAuditApi(api_client)
    user_name = 'user_name_example' # str | 
    ipaddr = '' # str |  (optional) (default to '')
    login_location = '' # str |  (optional) (default to '')
    browser = '' # str |  (optional) (default to '')
    os = '' # str |  (optional) (default to '')
    status = '0' # str |  (optional) (default to '0')
    msg = '' # str |  (optional) (default to '')

    try:
        # 记录一条登录日志
        api_response = api_instance.create_login_info_api_v1_system_audit_logininfor_create_post(user_name, ipaddr=ipaddr, login_location=login_location, browser=browser, os=os, status=status, msg=msg)
        print("The response of SystemAuditApi->create_login_info_api_v1_system_audit_logininfor_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAuditApi->create_login_info_api_v1_system_audit_logininfor_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **user_name** | **str**|  | 
 **ipaddr** | **str**|  | [optional] [default to &#39;&#39;]
 **login_location** | **str**|  | [optional] [default to &#39;&#39;]
 **browser** | **str**|  | [optional] [default to &#39;&#39;]
 **os** | **str**|  | [optional] [default to &#39;&#39;]
 **status** | **str**|  | [optional] [default to &#39;0&#39;]
 **msg** | **str**|  | [optional] [default to &#39;&#39;]

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

# **create_oper_log_api_v1_system_audit_operlog_create_post**
> object create_oper_log_api_v1_system_audit_operlog_create_post(title, business_type=business_type, method=method, request_method=request_method, oper_url=oper_url, oper_name=oper_name, oper_ip=oper_ip, status=status, error_msg=error_msg)

写入一条操作日志（内部调用）

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
    api_instance = zhs_api.SystemAuditApi(api_client)
    title = 'title_example' # str | 
    business_type = 0 # int | 0 其它 1 新增 2 修改 3 删除 4 查询 (optional) (default to 0)
    method = '' # str |  (optional) (default to '')
    request_method = '' # str |  (optional) (default to '')
    oper_url = '' # str |  (optional) (default to '')
    oper_name = 'system' # str |  (optional) (default to 'system')
    oper_ip = '127.0.0.1' # str |  (optional) (default to '127.0.0.1')
    status = 0 # int | 0 成功 1 失败 (optional) (default to 0)
    error_msg = '' # str |  (optional) (default to '')

    try:
        # 写入一条操作日志（内部调用）
        api_response = api_instance.create_oper_log_api_v1_system_audit_operlog_create_post(title, business_type=business_type, method=method, request_method=request_method, oper_url=oper_url, oper_name=oper_name, oper_ip=oper_ip, status=status, error_msg=error_msg)
        print("The response of SystemAuditApi->create_oper_log_api_v1_system_audit_operlog_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAuditApi->create_oper_log_api_v1_system_audit_operlog_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | 
 **business_type** | **int**| 0 其它 1 新增 2 修改 3 删除 4 查询 | [optional] [default to 0]
 **method** | **str**|  | [optional] [default to &#39;&#39;]
 **request_method** | **str**|  | [optional] [default to &#39;&#39;]
 **oper_url** | **str**|  | [optional] [default to &#39;&#39;]
 **oper_name** | **str**|  | [optional] [default to &#39;system&#39;]
 **oper_ip** | **str**|  | [optional] [default to &#39;127.0.0.1&#39;]
 **status** | **int**| 0 成功 1 失败 | [optional] [default to 0]
 **error_msg** | **str**|  | [optional] [default to &#39;&#39;]

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

# **export_login_info_api_v1_system_audit_logininfor_export_get**
> object export_login_info_api_v1_system_audit_logininfor_export_get(user_name=user_name, status=status)

导出登录日志到Excel

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
    api_instance = zhs_api.SystemAuditApi(api_client)
    user_name = 'user_name_example' # str |  (optional)
    status = 'status_example' # str |  (optional)

    try:
        # 导出登录日志到Excel
        api_response = api_instance.export_login_info_api_v1_system_audit_logininfor_export_get(user_name=user_name, status=status)
        print("The response of SystemAuditApi->export_login_info_api_v1_system_audit_logininfor_export_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAuditApi->export_login_info_api_v1_system_audit_logininfor_export_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **user_name** | **str**|  | [optional] 
 **status** | **str**|  | [optional] 

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

# **export_oper_logs_api_v1_system_audit_operlog_export_get**
> object export_oper_logs_api_v1_system_audit_operlog_export_get(title=title, oper_name=oper_name, business_type=business_type)

导出操作日志到Excel

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
    api_instance = zhs_api.SystemAuditApi(api_client)
    title = 'title_example' # str |  (optional)
    oper_name = 'oper_name_example' # str |  (optional)
    business_type = 56 # int |  (optional)

    try:
        # 导出操作日志到Excel
        api_response = api_instance.export_oper_logs_api_v1_system_audit_operlog_export_get(title=title, oper_name=oper_name, business_type=business_type)
        print("The response of SystemAuditApi->export_oper_logs_api_v1_system_audit_operlog_export_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAuditApi->export_oper_logs_api_v1_system_audit_operlog_export_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | [optional] 
 **oper_name** | **str**|  | [optional] 
 **business_type** | **int**|  | [optional] 

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

# **list_login_info_api_v1_system_audit_logininfor_list_get**
> object list_login_info_api_v1_system_audit_logininfor_list_get(page=page, limit=limit, user_name=user_name, status=status)

登录日志列表

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
    api_instance = zhs_api.SystemAuditApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    user_name = 'user_name_example' # str |  (optional)
    status = 'status_example' # str | 0 成功 1 失败 (optional)

    try:
        # 登录日志列表
        api_response = api_instance.list_login_info_api_v1_system_audit_logininfor_list_get(page=page, limit=limit, user_name=user_name, status=status)
        print("The response of SystemAuditApi->list_login_info_api_v1_system_audit_logininfor_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAuditApi->list_login_info_api_v1_system_audit_logininfor_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **user_name** | **str**|  | [optional] 
 **status** | **str**| 0 成功 1 失败 | [optional] 

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

# **list_oper_logs_api_v1_system_audit_operlog_list_get**
> object list_oper_logs_api_v1_system_audit_operlog_list_get(page=page, limit=limit, title=title, oper_name=oper_name, business_type=business_type)

操作日志列表

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
    api_instance = zhs_api.SystemAuditApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    title = 'title_example' # str |  (optional)
    oper_name = 'oper_name_example' # str |  (optional)
    business_type = 56 # int |  (optional)

    try:
        # 操作日志列表
        api_response = api_instance.list_oper_logs_api_v1_system_audit_operlog_list_get(page=page, limit=limit, title=title, oper_name=oper_name, business_type=business_type)
        print("The response of SystemAuditApi->list_oper_logs_api_v1_system_audit_operlog_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemAuditApi->list_oper_logs_api_v1_system_audit_operlog_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **title** | **str**|  | [optional] 
 **oper_name** | **str**|  | [optional] 
 **business_type** | **int**|  | [optional] 

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

