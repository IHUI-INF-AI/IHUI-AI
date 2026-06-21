# zhs_api.CozeFilesApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**upload_file_api_v1_coze_files_files_upload_post**](CozeFilesApi.md#upload_file_api_v1_coze_files_files_upload_post) | **POST** /api/v1/coze/files/files/upload | Upload File


# **upload_file_api_v1_coze_files_files_upload_post**
> object upload_file_api_v1_coze_files_files_upload_post(file)

Upload File

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
    api_instance = zhs_api.CozeFilesApi(api_client)
    file = None # bytes | 

    try:
        # Upload File
        api_response = api_instance.upload_file_api_v1_coze_files_files_upload_post(file)
        print("The response of CozeFilesApi->upload_file_api_v1_coze_files_files_upload_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeFilesApi->upload_file_api_v1_coze_files_files_upload_post: %s\n" % e)
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

