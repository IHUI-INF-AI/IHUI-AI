# zhs_api.WSTimbreApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_timbre_timbre_create_post**](WSTimbreApi.md#create_timbre_timbre_create_post) | **POST** /timbre/create | 新增音色
[**delete_timbre_timbre_delete_post**](WSTimbreApi.md#delete_timbre_timbre_delete_post) | **POST** /timbre/delete | 删除音色
[**list_timbres_timbre_list_get**](WSTimbreApi.md#list_timbres_timbre_list_get) | **GET** /timbre/list | 音色列表
[**update_timbre_timbre_update_post**](WSTimbreApi.md#update_timbre_timbre_update_post) | **POST** /timbre/update | 更新音色


# **create_timbre_timbre_create_post**
> object create_timbre_timbre_create_post(name, voice_id, language=language, gender=gender, age_range=age_range, style=style, sample_url=sample_url)

新增音色

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
    api_instance = zhs_api.WSTimbreApi(api_client)
    name = 'name_example' # str | 
    voice_id = 'voice_id_example' # str | 
    language = 'zh' # str |  (optional) (default to 'zh')
    gender = 'female' # str |  (optional) (default to 'female')
    age_range = '' # str |  (optional) (default to '')
    style = '' # str |  (optional) (default to '')
    sample_url = '' # str |  (optional) (default to '')

    try:
        # 新增音色
        api_response = api_instance.create_timbre_timbre_create_post(name, voice_id, language=language, gender=gender, age_range=age_range, style=style, sample_url=sample_url)
        print("The response of WSTimbreApi->create_timbre_timbre_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSTimbreApi->create_timbre_timbre_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **str**|  | 
 **voice_id** | **str**|  | 
 **language** | **str**|  | [optional] [default to &#39;zh&#39;]
 **gender** | **str**|  | [optional] [default to &#39;female&#39;]
 **age_range** | **str**|  | [optional] [default to &#39;&#39;]
 **style** | **str**|  | [optional] [default to &#39;&#39;]
 **sample_url** | **str**|  | [optional] [default to &#39;&#39;]

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

# **delete_timbre_timbre_delete_post**
> object delete_timbre_timbre_delete_post(timbre_id)

删除音色

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
    api_instance = zhs_api.WSTimbreApi(api_client)
    timbre_id = 'timbre_id_example' # str | 

    try:
        # 删除音色
        api_response = api_instance.delete_timbre_timbre_delete_post(timbre_id)
        print("The response of WSTimbreApi->delete_timbre_timbre_delete_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSTimbreApi->delete_timbre_timbre_delete_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **timbre_id** | **str**|  | 

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

# **list_timbres_timbre_list_get**
> object list_timbres_timbre_list_get(language=language, gender=gender, page=page, limit=limit)

音色列表

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
    api_instance = zhs_api.WSTimbreApi(api_client)
    language = 'language_example' # str |  (optional)
    gender = 'gender_example' # str |  (optional)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 音色列表
        api_response = api_instance.list_timbres_timbre_list_get(language=language, gender=gender, page=page, limit=limit)
        print("The response of WSTimbreApi->list_timbres_timbre_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSTimbreApi->list_timbres_timbre_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **language** | **str**|  | [optional] 
 **gender** | **str**|  | [optional] 
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]

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

# **update_timbre_timbre_update_post**
> object update_timbre_timbre_update_post(timbre_id, name=name, sample_url=sample_url, status=status)

更新音色

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
    api_instance = zhs_api.WSTimbreApi(api_client)
    timbre_id = 'timbre_id_example' # str | 
    name = 'name_example' # str |  (optional)
    sample_url = 'sample_url_example' # str |  (optional)
    status = 56 # int |  (optional)

    try:
        # 更新音色
        api_response = api_instance.update_timbre_timbre_update_post(timbre_id, name=name, sample_url=sample_url, status=status)
        print("The response of WSTimbreApi->update_timbre_timbre_update_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSTimbreApi->update_timbre_timbre_update_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **timbre_id** | **str**|  | 
 **name** | **str**|  | [optional] 
 **sample_url** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 

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

