# zhs_api.TongyiImageEditApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**text_to_image_api_v1_tongyi_image_edit_text_to_image_post**](TongyiImageEditApi.md#text_to_image_api_v1_tongyi_image_edit_text_to_image_post) | **POST** /api/v1/tongyi-image-edit/text-to-image | 通义文生图
[**text_to_image_api_v1_tongyi_image_edit_text_to_image_post_0**](TongyiImageEditApi.md#text_to_image_api_v1_tongyi_image_edit_text_to_image_post_0) | **POST** /api/v1/tongyi-image-edit/text-to-image | 通义文生图
[**tongyi_image_edit**](TongyiImageEditApi.md#tongyi_image_edit) | **POST** /api/v1/tongyi-image-edit/image-edit | 通义图像编辑
[**tongyi_image_edit_0**](TongyiImageEditApi.md#tongyi_image_edit_0) | **POST** /api/v1/tongyi-image-edit/image-edit | 通义图像编辑
[**tongyi_image_edit_list_models**](TongyiImageEditApi.md#tongyi_image_edit_list_models) | **GET** /api/v1/tongyi-image-edit/models | 通义可用模型
[**tongyi_image_edit_list_models_0**](TongyiImageEditApi.md#tongyi_image_edit_list_models_0) | **GET** /api/v1/tongyi-image-edit/models | 通义可用模型


# **text_to_image_api_v1_tongyi_image_edit_text_to_image_post**
> object text_to_image_api_v1_tongyi_image_edit_text_to_image_post(body_text_to_image_api_v1_tongyi_image_edit_text_to_image_post, api_key=api_key)

通义文生图

### Example


```python
import zhs_api
from zhs_api.models.body_text_to_image_api_v1_tongyi_image_edit_text_to_image_post import BodyTextToImageApiV1TongyiImageEditTextToImagePost
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
    api_instance = zhs_api.TongyiImageEditApi(api_client)
    body_text_to_image_api_v1_tongyi_image_edit_text_to_image_post = zhs_api.BodyTextToImageApiV1TongyiImageEditTextToImagePost() # BodyTextToImageApiV1TongyiImageEditTextToImagePost | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 通义文生图
        api_response = api_instance.text_to_image_api_v1_tongyi_image_edit_text_to_image_post(body_text_to_image_api_v1_tongyi_image_edit_text_to_image_post, api_key=api_key)
        print("The response of TongyiImageEditApi->text_to_image_api_v1_tongyi_image_edit_text_to_image_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TongyiImageEditApi->text_to_image_api_v1_tongyi_image_edit_text_to_image_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_text_to_image_api_v1_tongyi_image_edit_text_to_image_post** | [**BodyTextToImageApiV1TongyiImageEditTextToImagePost**](BodyTextToImageApiV1TongyiImageEditTextToImagePost.md)|  | 
 **api_key** | **str**|  | [optional] 

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

# **text_to_image_api_v1_tongyi_image_edit_text_to_image_post_0**
> object text_to_image_api_v1_tongyi_image_edit_text_to_image_post_0(body_text_to_image_api_v1_tongyi_image_edit_text_to_image_post, api_key=api_key)

通义文生图

### Example


```python
import zhs_api
from zhs_api.models.body_text_to_image_api_v1_tongyi_image_edit_text_to_image_post import BodyTextToImageApiV1TongyiImageEditTextToImagePost
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
    api_instance = zhs_api.TongyiImageEditApi(api_client)
    body_text_to_image_api_v1_tongyi_image_edit_text_to_image_post = zhs_api.BodyTextToImageApiV1TongyiImageEditTextToImagePost() # BodyTextToImageApiV1TongyiImageEditTextToImagePost | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 通义文生图
        api_response = api_instance.text_to_image_api_v1_tongyi_image_edit_text_to_image_post_0(body_text_to_image_api_v1_tongyi_image_edit_text_to_image_post, api_key=api_key)
        print("The response of TongyiImageEditApi->text_to_image_api_v1_tongyi_image_edit_text_to_image_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TongyiImageEditApi->text_to_image_api_v1_tongyi_image_edit_text_to_image_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_text_to_image_api_v1_tongyi_image_edit_text_to_image_post** | [**BodyTextToImageApiV1TongyiImageEditTextToImagePost**](BodyTextToImageApiV1TongyiImageEditTextToImagePost.md)|  | 
 **api_key** | **str**|  | [optional] 

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

# **tongyi_image_edit**
> object tongyi_image_edit(body_tongyi_image_edit, api_key=api_key)

通义图像编辑

### Example


```python
import zhs_api
from zhs_api.models.body_tongyi_image_edit import BodyTongyiImageEdit
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
    api_instance = zhs_api.TongyiImageEditApi(api_client)
    body_tongyi_image_edit = zhs_api.BodyTongyiImageEdit() # BodyTongyiImageEdit | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 通义图像编辑
        api_response = api_instance.tongyi_image_edit(body_tongyi_image_edit, api_key=api_key)
        print("The response of TongyiImageEditApi->tongyi_image_edit:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TongyiImageEditApi->tongyi_image_edit: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_tongyi_image_edit** | [**BodyTongyiImageEdit**](BodyTongyiImageEdit.md)|  | 
 **api_key** | **str**|  | [optional] 

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

# **tongyi_image_edit_0**
> object tongyi_image_edit_0(body_tongyi_image_edit, api_key=api_key)

通义图像编辑

### Example


```python
import zhs_api
from zhs_api.models.body_tongyi_image_edit import BodyTongyiImageEdit
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
    api_instance = zhs_api.TongyiImageEditApi(api_client)
    body_tongyi_image_edit = zhs_api.BodyTongyiImageEdit() # BodyTongyiImageEdit | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 通义图像编辑
        api_response = api_instance.tongyi_image_edit_0(body_tongyi_image_edit, api_key=api_key)
        print("The response of TongyiImageEditApi->tongyi_image_edit_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TongyiImageEditApi->tongyi_image_edit_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_tongyi_image_edit** | [**BodyTongyiImageEdit**](BodyTongyiImageEdit.md)|  | 
 **api_key** | **str**|  | [optional] 

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

# **tongyi_image_edit_list_models**
> object tongyi_image_edit_list_models()

通义可用模型

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
    api_instance = zhs_api.TongyiImageEditApi(api_client)

    try:
        # 通义可用模型
        api_response = api_instance.tongyi_image_edit_list_models()
        print("The response of TongyiImageEditApi->tongyi_image_edit_list_models:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TongyiImageEditApi->tongyi_image_edit_list_models: %s\n" % e)
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

# **tongyi_image_edit_list_models_0**
> object tongyi_image_edit_list_models_0()

通义可用模型

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
    api_instance = zhs_api.TongyiImageEditApi(api_client)

    try:
        # 通义可用模型
        api_response = api_instance.tongyi_image_edit_list_models_0()
        print("The response of TongyiImageEditApi->tongyi_image_edit_list_models_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TongyiImageEditApi->tongyi_image_edit_list_models_0: %s\n" % e)
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

