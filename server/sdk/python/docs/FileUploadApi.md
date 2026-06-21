# zhs_api.FileUploadApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**upload_base64_file_api_v1_coze_zhs_api_file_upload_base64_post**](FileUploadApi.md#upload_base64_file_api_v1_coze_zhs_api_file_upload_base64_post) | **POST** /api/v1/cozeZhsApi/file/upload/base64 | Upload base64 file
[**upload_form_file_api_v1_coze_zhs_api_file_upload_form_post**](FileUploadApi.md#upload_form_file_api_v1_coze_zhs_api_file_upload_form_post) | **POST** /api/v1/cozeZhsApi/file/upload/form | Upload file via form-data
[**upload_octet_file_api_v1_coze_zhs_api_file_upload_octet_post**](FileUploadApi.md#upload_octet_file_api_v1_coze_zhs_api_file_upload_octet_post) | **POST** /api/v1/cozeZhsApi/file/upload/octet | Upload file via octet-stream


# **upload_base64_file_api_v1_coze_zhs_api_file_upload_base64_post**
> object upload_base64_file_api_v1_coze_zhs_api_file_upload_base64_post(base64_upload_request)

Upload base64 file

Upload a base64-encoded file. Auto-converts webp to png.

### Example


```python
import zhs_api
from zhs_api.models.base64_upload_request import Base64UploadRequest
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
    api_instance = zhs_api.FileUploadApi(api_client)
    base64_upload_request = zhs_api.Base64UploadRequest() # Base64UploadRequest | 

    try:
        # Upload base64 file
        api_response = api_instance.upload_base64_file_api_v1_coze_zhs_api_file_upload_base64_post(base64_upload_request)
        print("The response of FileUploadApi->upload_base64_file_api_v1_coze_zhs_api_file_upload_base64_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FileUploadApi->upload_base64_file_api_v1_coze_zhs_api_file_upload_base64_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **base64_upload_request** | [**Base64UploadRequest**](Base64UploadRequest.md)|  | 

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

# **upload_form_file_api_v1_coze_zhs_api_file_upload_form_post**
> object upload_form_file_api_v1_coze_zhs_api_file_upload_form_post(file)

Upload file via form-data

Upload any file via multipart/form-data.

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
    api_instance = zhs_api.FileUploadApi(api_client)
    file = None # bytes | 

    try:
        # Upload file via form-data
        api_response = api_instance.upload_form_file_api_v1_coze_zhs_api_file_upload_form_post(file)
        print("The response of FileUploadApi->upload_form_file_api_v1_coze_zhs_api_file_upload_form_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FileUploadApi->upload_form_file_api_v1_coze_zhs_api_file_upload_form_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file** | **bytes**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **upload_octet_file_api_v1_coze_zhs_api_file_upload_octet_post**
> object upload_octet_file_api_v1_coze_zhs_api_file_upload_octet_post(file_name)

Upload file via octet-stream

Upload file via raw octet-stream body. file_name in query.

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
    api_instance = zhs_api.FileUploadApi(api_client)
    file_name = 'file_name_example' # str | 

    try:
        # Upload file via octet-stream
        api_response = api_instance.upload_octet_file_api_v1_coze_zhs_api_file_upload_octet_post(file_name)
        print("The response of FileUploadApi->upload_octet_file_api_v1_coze_zhs_api_file_upload_octet_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FileUploadApi->upload_octet_file_api_v1_coze_zhs_api_file_upload_octet_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file_name** | **str**|  | 

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

