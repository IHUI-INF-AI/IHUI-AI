# zhs_api.AgentUploadApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**delete_upload_api_v1_agent_upload_uid_delete**](AgentUploadApi.md#delete_upload_api_v1_agent_upload_uid_delete) | **DELETE** /api/v1/agent-upload/{uid} | 删除上传记录
[**delete_upload_api_v1_agent_upload_uid_delete_0**](AgentUploadApi.md#delete_upload_api_v1_agent_upload_uid_delete_0) | **DELETE** /api/v1/agent-upload/{uid} | 删除上传记录
[**list_uploads_api_v1_agent_upload_list_get**](AgentUploadApi.md#list_uploads_api_v1_agent_upload_list_get) | **GET** /api/v1/agent-upload/list | 我的上传
[**list_uploads_api_v1_agent_upload_list_get_0**](AgentUploadApi.md#list_uploads_api_v1_agent_upload_list_get_0) | **GET** /api/v1/agent-upload/list | 我的上传
[**record_upload_api_v1_agent_upload_post**](AgentUploadApi.md#record_upload_api_v1_agent_upload_post) | **POST** /api/v1/agent-upload | 记录上传
[**record_upload_api_v1_agent_upload_post_0**](AgentUploadApi.md#record_upload_api_v1_agent_upload_post_0) | **POST** /api/v1/agent-upload | 记录上传


# **delete_upload_api_v1_agent_upload_uid_delete**
> object delete_upload_api_v1_agent_upload_uid_delete(uid)

删除上传记录

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
    api_instance = zhs_api.AgentUploadApi(api_client)
    uid = 56 # int | 

    try:
        # 删除上传记录
        api_response = api_instance.delete_upload_api_v1_agent_upload_uid_delete(uid)
        print("The response of AgentUploadApi->delete_upload_api_v1_agent_upload_uid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentUploadApi->delete_upload_api_v1_agent_upload_uid_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **uid** | **int**|  | 

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

# **delete_upload_api_v1_agent_upload_uid_delete_0**
> object delete_upload_api_v1_agent_upload_uid_delete_0(uid)

删除上传记录

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
    api_instance = zhs_api.AgentUploadApi(api_client)
    uid = 56 # int | 

    try:
        # 删除上传记录
        api_response = api_instance.delete_upload_api_v1_agent_upload_uid_delete_0(uid)
        print("The response of AgentUploadApi->delete_upload_api_v1_agent_upload_uid_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentUploadApi->delete_upload_api_v1_agent_upload_uid_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **uid** | **int**|  | 

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

# **list_uploads_api_v1_agent_upload_list_get**
> object list_uploads_api_v1_agent_upload_list_get(page=page, limit=limit, agent_id=agent_id, biz_type=biz_type, file_type=file_type)

我的上传

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
    api_instance = zhs_api.AgentUploadApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    agent_id = 'agent_id_example' # str |  (optional)
    biz_type = 'biz_type_example' # str |  (optional)
    file_type = 'file_type_example' # str |  (optional)

    try:
        # 我的上传
        api_response = api_instance.list_uploads_api_v1_agent_upload_list_get(page=page, limit=limit, agent_id=agent_id, biz_type=biz_type, file_type=file_type)
        print("The response of AgentUploadApi->list_uploads_api_v1_agent_upload_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentUploadApi->list_uploads_api_v1_agent_upload_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **agent_id** | **str**|  | [optional] 
 **biz_type** | **str**|  | [optional] 
 **file_type** | **str**|  | [optional] 

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

# **list_uploads_api_v1_agent_upload_list_get_0**
> object list_uploads_api_v1_agent_upload_list_get_0(page=page, limit=limit, agent_id=agent_id, biz_type=biz_type, file_type=file_type)

我的上传

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
    api_instance = zhs_api.AgentUploadApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    agent_id = 'agent_id_example' # str |  (optional)
    biz_type = 'biz_type_example' # str |  (optional)
    file_type = 'file_type_example' # str |  (optional)

    try:
        # 我的上传
        api_response = api_instance.list_uploads_api_v1_agent_upload_list_get_0(page=page, limit=limit, agent_id=agent_id, biz_type=biz_type, file_type=file_type)
        print("The response of AgentUploadApi->list_uploads_api_v1_agent_upload_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentUploadApi->list_uploads_api_v1_agent_upload_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **agent_id** | **str**|  | [optional] 
 **biz_type** | **str**|  | [optional] 
 **file_type** | **str**|  | [optional] 

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

# **record_upload_api_v1_agent_upload_post**
> object record_upload_api_v1_agent_upload_post(file_name, file_url, file_type=file_type, file_size=file_size, mime_type=mime_type, ext=ext, agent_id=agent_id, agent_name=agent_name, biz_type=biz_type)

记录上传

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
    api_instance = zhs_api.AgentUploadApi(api_client)
    file_name = 'file_name_example' # str | 
    file_url = 'file_url_example' # str | 
    file_type = 'file_type_example' # str |  (optional)
    file_size = 0 # int |  (optional) (default to 0)
    mime_type = 'mime_type_example' # str |  (optional)
    ext = 'ext_example' # str |  (optional)
    agent_id = 'agent_id_example' # str |  (optional)
    agent_name = 'agent_name_example' # str |  (optional)
    biz_type = 'avatar' # str |  (optional) (default to 'avatar')

    try:
        # 记录上传
        api_response = api_instance.record_upload_api_v1_agent_upload_post(file_name, file_url, file_type=file_type, file_size=file_size, mime_type=mime_type, ext=ext, agent_id=agent_id, agent_name=agent_name, biz_type=biz_type)
        print("The response of AgentUploadApi->record_upload_api_v1_agent_upload_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentUploadApi->record_upload_api_v1_agent_upload_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file_name** | **str**|  | 
 **file_url** | **str**|  | 
 **file_type** | **str**|  | [optional] 
 **file_size** | **int**|  | [optional] [default to 0]
 **mime_type** | **str**|  | [optional] 
 **ext** | **str**|  | [optional] 
 **agent_id** | **str**|  | [optional] 
 **agent_name** | **str**|  | [optional] 
 **biz_type** | **str**|  | [optional] [default to &#39;avatar&#39;]

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

# **record_upload_api_v1_agent_upload_post_0**
> object record_upload_api_v1_agent_upload_post_0(file_name, file_url, file_type=file_type, file_size=file_size, mime_type=mime_type, ext=ext, agent_id=agent_id, agent_name=agent_name, biz_type=biz_type)

记录上传

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
    api_instance = zhs_api.AgentUploadApi(api_client)
    file_name = 'file_name_example' # str | 
    file_url = 'file_url_example' # str | 
    file_type = 'file_type_example' # str |  (optional)
    file_size = 0 # int |  (optional) (default to 0)
    mime_type = 'mime_type_example' # str |  (optional)
    ext = 'ext_example' # str |  (optional)
    agent_id = 'agent_id_example' # str |  (optional)
    agent_name = 'agent_name_example' # str |  (optional)
    biz_type = 'avatar' # str |  (optional) (default to 'avatar')

    try:
        # 记录上传
        api_response = api_instance.record_upload_api_v1_agent_upload_post_0(file_name, file_url, file_type=file_type, file_size=file_size, mime_type=mime_type, ext=ext, agent_id=agent_id, agent_name=agent_name, biz_type=biz_type)
        print("The response of AgentUploadApi->record_upload_api_v1_agent_upload_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentUploadApi->record_upload_api_v1_agent_upload_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file_name** | **str**|  | 
 **file_url** | **str**|  | 
 **file_type** | **str**|  | [optional] 
 **file_size** | **int**|  | [optional] [default to 0]
 **mime_type** | **str**|  | [optional] 
 **ext** | **str**|  | [optional] 
 **agent_id** | **str**|  | [optional] 
 **agent_name** | **str**|  | [optional] 
 **biz_type** | **str**|  | [optional] [default to &#39;avatar&#39;]

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

