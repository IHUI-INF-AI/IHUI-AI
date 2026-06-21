# zhs_api.SystemCodegenApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**gen_column_list_api_v1_system_gen_column_table_id_get**](SystemCodegenApi.md#gen_column_list_api_v1_system_gen_column_table_id_get) | **GET** /api/v1/system/gen/column/{table_id} | List columns for an imported table
[**gen_db_list_api_v1_system_gen_db_list_get**](SystemCodegenApi.md#gen_db_list_api_v1_system_gen_db_list_get) | **GET** /api/v1/system/gen/db/list | List database tables from information_schema
[**gen_delete_api_v1_system_gen_table_ids_delete**](SystemCodegenApi.md#gen_delete_api_v1_system_gen_table_ids_delete) | **DELETE** /api/v1/system/gen/{table_ids} | Delete imported codegen tables
[**gen_download_api_v1_system_gen_download_table_name_get**](SystemCodegenApi.md#gen_download_api_v1_system_gen_download_table_name_get) | **GET** /api/v1/system/gen/download/{table_name} | Download generated code as zip
[**gen_import_table_api_v1_system_gen_import_table_post**](SystemCodegenApi.md#gen_import_table_api_v1_system_gen_import_table_post) | **POST** /api/v1/system/gen/import_table | Import database tables into codegen
[**gen_list_api_v1_system_gen_list_get**](SystemCodegenApi.md#gen_list_api_v1_system_gen_list_get) | **GET** /api/v1/system/gen/list | List imported codegen tables
[**gen_preview_api_v1_system_gen_preview_table_id_get**](SystemCodegenApi.md#gen_preview_api_v1_system_gen_preview_table_id_get) | **GET** /api/v1/system/gen/preview/{table_id} | Preview generated code for a table
[**gen_update_api_v1_system_gen_put**](SystemCodegenApi.md#gen_update_api_v1_system_gen_put) | **PUT** /api/v1/system/gen | Update codegen table metadata


# **gen_column_list_api_v1_system_gen_column_table_id_get**
> object gen_column_list_api_v1_system_gen_column_table_id_get(table_id)

List columns for an imported table

查询已导入表的字段列表

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
    api_instance = zhs_api.SystemCodegenApi(api_client)
    table_id = 56 # int | 

    try:
        # List columns for an imported table
        api_response = api_instance.gen_column_list_api_v1_system_gen_column_table_id_get(table_id)
        print("The response of SystemCodegenApi->gen_column_list_api_v1_system_gen_column_table_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemCodegenApi->gen_column_list_api_v1_system_gen_column_table_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **table_id** | **int**|  | 

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

# **gen_db_list_api_v1_system_gen_db_list_get**
> object gen_db_list_api_v1_system_gen_db_list_get(page=page, limit=limit, table_name=table_name, table_comment=table_comment)

List database tables from information_schema

从 information_schema 查询数据库表列表

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
    api_instance = zhs_api.SystemCodegenApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    table_name = 'table_name_example' # str |  (optional)
    table_comment = 'table_comment_example' # str |  (optional)

    try:
        # List database tables from information_schema
        api_response = api_instance.gen_db_list_api_v1_system_gen_db_list_get(page=page, limit=limit, table_name=table_name, table_comment=table_comment)
        print("The response of SystemCodegenApi->gen_db_list_api_v1_system_gen_db_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemCodegenApi->gen_db_list_api_v1_system_gen_db_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **table_name** | **str**|  | [optional] 
 **table_comment** | **str**|  | [optional] 

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

# **gen_delete_api_v1_system_gen_table_ids_delete**
> object gen_delete_api_v1_system_gen_table_ids_delete(table_ids)

Delete imported codegen tables

删除代码生成记录

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
    api_instance = zhs_api.SystemCodegenApi(api_client)
    table_ids = 'table_ids_example' # str | Comma-separated table IDs

    try:
        # Delete imported codegen tables
        api_response = api_instance.gen_delete_api_v1_system_gen_table_ids_delete(table_ids)
        print("The response of SystemCodegenApi->gen_delete_api_v1_system_gen_table_ids_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemCodegenApi->gen_delete_api_v1_system_gen_table_ids_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **table_ids** | **str**| Comma-separated table IDs | 

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

# **gen_download_api_v1_system_gen_download_table_name_get**
> object gen_download_api_v1_system_gen_download_table_name_get(table_name)

Download generated code as zip

下载生成的代码 zip 文件

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
    api_instance = zhs_api.SystemCodegenApi(api_client)
    table_name = 'table_name_example' # str | 

    try:
        # Download generated code as zip
        api_response = api_instance.gen_download_api_v1_system_gen_download_table_name_get(table_name)
        print("The response of SystemCodegenApi->gen_download_api_v1_system_gen_download_table_name_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemCodegenApi->gen_download_api_v1_system_gen_download_table_name_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **table_name** | **str**|  | 

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

# **gen_import_table_api_v1_system_gen_import_table_post**
> object gen_import_table_api_v1_system_gen_import_table_post(body_gen_import_table_api_v1_system_gen_import_table_post)

Import database tables into codegen

导入数据库表结构到代码生成

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.body_gen_import_table_api_v1_system_gen_import_table_post import BodyGenImportTableApiV1SystemGenImportTablePost
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
    api_instance = zhs_api.SystemCodegenApi(api_client)
    body_gen_import_table_api_v1_system_gen_import_table_post = zhs_api.BodyGenImportTableApiV1SystemGenImportTablePost() # BodyGenImportTableApiV1SystemGenImportTablePost | 

    try:
        # Import database tables into codegen
        api_response = api_instance.gen_import_table_api_v1_system_gen_import_table_post(body_gen_import_table_api_v1_system_gen_import_table_post)
        print("The response of SystemCodegenApi->gen_import_table_api_v1_system_gen_import_table_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemCodegenApi->gen_import_table_api_v1_system_gen_import_table_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_gen_import_table_api_v1_system_gen_import_table_post** | [**BodyGenImportTableApiV1SystemGenImportTablePost**](BodyGenImportTableApiV1SystemGenImportTablePost.md)|  | 

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

# **gen_list_api_v1_system_gen_list_get**
> object gen_list_api_v1_system_gen_list_get(page=page, limit=limit, table_name=table_name, table_comment=table_comment)

List imported codegen tables

分页查询已导入的代码生成表列表

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
    api_instance = zhs_api.SystemCodegenApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    table_name = 'table_name_example' # str |  (optional)
    table_comment = 'table_comment_example' # str |  (optional)

    try:
        # List imported codegen tables
        api_response = api_instance.gen_list_api_v1_system_gen_list_get(page=page, limit=limit, table_name=table_name, table_comment=table_comment)
        print("The response of SystemCodegenApi->gen_list_api_v1_system_gen_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemCodegenApi->gen_list_api_v1_system_gen_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **table_name** | **str**|  | [optional] 
 **table_comment** | **str**|  | [optional] 

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

# **gen_preview_api_v1_system_gen_preview_table_id_get**
> object gen_preview_api_v1_system_gen_preview_table_id_get(table_id)

Preview generated code for a table

预览生成的代码

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
    api_instance = zhs_api.SystemCodegenApi(api_client)
    table_id = 56 # int | 

    try:
        # Preview generated code for a table
        api_response = api_instance.gen_preview_api_v1_system_gen_preview_table_id_get(table_id)
        print("The response of SystemCodegenApi->gen_preview_api_v1_system_gen_preview_table_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemCodegenApi->gen_preview_api_v1_system_gen_preview_table_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **table_id** | **int**|  | 

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

# **gen_update_api_v1_system_gen_put**
> object gen_update_api_v1_system_gen_put(request_body)

Update codegen table metadata

修改代码生成业务配置

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
    api_instance = zhs_api.SystemCodegenApi(api_client)
    request_body = None # Dict[str, object] | 

    try:
        # Update codegen table metadata
        api_response = api_instance.gen_update_api_v1_system_gen_put(request_body)
        print("The response of SystemCodegenApi->gen_update_api_v1_system_gen_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SystemCodegenApi->gen_update_api_v1_system_gen_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **request_body** | [**Dict[str, object]**](object.md)|  | 

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

