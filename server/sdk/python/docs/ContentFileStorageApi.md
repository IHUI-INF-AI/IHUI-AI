# zhs_api.ContentFileStorageApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**delete_file_api_v1_content_files_file_id_delete**](ContentFileStorageApi.md#delete_file_api_v1_content_files_file_id_delete) | **DELETE** /api/v1/content/files/{file_id} | 删除文件
[**list_files_api_v1_content_files_list_get**](ContentFileStorageApi.md#list_files_api_v1_content_files_list_get) | **GET** /api/v1/content/files/list | 文件列表
[**upload_file_api_v1_content_files_upload_post**](ContentFileStorageApi.md#upload_file_api_v1_content_files_upload_post) | **POST** /api/v1/content/files/upload | 上传文件记录


# **delete_file_api_v1_content_files_file_id_delete**
> object delete_file_api_v1_content_files_file_id_delete(file_id)

删除文件

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
    api_instance = zhs_api.ContentFileStorageApi(api_client)
    file_id = 56 # int | 

    try:
        # 删除文件
        api_response = api_instance.delete_file_api_v1_content_files_file_id_delete(file_id)
        print("The response of ContentFileStorageApi->delete_file_api_v1_content_files_file_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentFileStorageApi->delete_file_api_v1_content_files_file_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file_id** | **int**|  | 

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

# **list_files_api_v1_content_files_list_get**
> object list_files_api_v1_content_files_list_get(page=page, limit=limit, file_type=file_type)

文件列表

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
    api_instance = zhs_api.ContentFileStorageApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    file_type = 'file_type_example' # str | 按文件类型过滤 (optional)

    try:
        # 文件列表
        api_response = api_instance.list_files_api_v1_content_files_list_get(page=page, limit=limit, file_type=file_type)
        print("The response of ContentFileStorageApi->list_files_api_v1_content_files_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentFileStorageApi->list_files_api_v1_content_files_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **file_type** | **str**| 按文件类型过滤 | [optional] 

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

# **upload_file_api_v1_content_files_upload_post**
> object upload_file_api_v1_content_files_upload_post(file_upload_body)

上传文件记录

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.file_upload_body import FileUploadBody
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
    api_instance = zhs_api.ContentFileStorageApi(api_client)
    file_upload_body = zhs_api.FileUploadBody() # FileUploadBody | 

    try:
        # 上传文件记录
        api_response = api_instance.upload_file_api_v1_content_files_upload_post(file_upload_body)
        print("The response of ContentFileStorageApi->upload_file_api_v1_content_files_upload_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentFileStorageApi->upload_file_api_v1_content_files_upload_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file_upload_body** | [**FileUploadBody**](FileUploadBody.md)|  | 

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

