# zhs_api.CoursesApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_course_api_v1_courses_create_post**](CoursesApi.md#create_course_api_v1_courses_create_post) | **POST** /api/v1/courses/create | Create course
[**delete_course_api_v1_courses_course_id_delete**](CoursesApi.md#delete_course_api_v1_courses_course_id_delete) | **DELETE** /api/v1/courses/{course_id} | Delete course (soft)
[**delist_course_api_v1_courses_course_id_delist_post**](CoursesApi.md#delist_course_api_v1_courses_course_id_delist_post) | **POST** /api/v1/courses/{course_id}/delist | Delist (hide) course
[**get_course_api_v1_courses_course_id_get**](CoursesApi.md#get_course_api_v1_courses_course_id_get) | **GET** /api/v1/courses/{course_id} | Get course detail
[**list_courses_api_v1_courses_list_get**](CoursesApi.md#list_courses_api_v1_courses_list_get) | **GET** /api/v1/courses/list | List courses
[**update_course_api_v1_courses_course_id_put**](CoursesApi.md#update_course_api_v1_courses_course_id_put) | **PUT** /api/v1/courses/{course_id} | Update course


# **create_course_api_v1_courses_create_post**
> object create_course_api_v1_courses_create_post(course_create)

Create course

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.course_create import CourseCreate
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
    api_instance = zhs_api.CoursesApi(api_client)
    course_create = zhs_api.CourseCreate() # CourseCreate | 

    try:
        # Create course
        api_response = api_instance.create_course_api_v1_courses_create_post(course_create)
        print("The response of CoursesApi->create_course_api_v1_courses_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesApi->create_course_api_v1_courses_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **course_create** | [**CourseCreate**](CourseCreate.md)|  | 

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

# **delete_course_api_v1_courses_course_id_delete**
> object delete_course_api_v1_courses_course_id_delete(course_id)

Delete course (soft)

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
    api_instance = zhs_api.CoursesApi(api_client)
    course_id = 56 # int | 

    try:
        # Delete course (soft)
        api_response = api_instance.delete_course_api_v1_courses_course_id_delete(course_id)
        print("The response of CoursesApi->delete_course_api_v1_courses_course_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesApi->delete_course_api_v1_courses_course_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **course_id** | **int**|  | 

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

# **delist_course_api_v1_courses_course_id_delist_post**
> object delist_course_api_v1_courses_course_id_delist_post(course_id)

Delist (hide) course

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
    api_instance = zhs_api.CoursesApi(api_client)
    course_id = 56 # int | 

    try:
        # Delist (hide) course
        api_response = api_instance.delist_course_api_v1_courses_course_id_delist_post(course_id)
        print("The response of CoursesApi->delist_course_api_v1_courses_course_id_delist_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesApi->delist_course_api_v1_courses_course_id_delist_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **course_id** | **int**|  | 

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

# **get_course_api_v1_courses_course_id_get**
> object get_course_api_v1_courses_course_id_get(course_id)

Get course detail

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
    api_instance = zhs_api.CoursesApi(api_client)
    course_id = 56 # int | 

    try:
        # Get course detail
        api_response = api_instance.get_course_api_v1_courses_course_id_get(course_id)
        print("The response of CoursesApi->get_course_api_v1_courses_course_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesApi->get_course_api_v1_courses_course_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **course_id** | **int**|  | 

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

# **list_courses_api_v1_courses_list_get**
> object list_courses_api_v1_courses_list_get(page=page, limit=limit, keyword=keyword, stage=stage, is_hidden=is_hidden, audit_status=audit_status)

List courses

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
    api_instance = zhs_api.CoursesApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    keyword = 'keyword_example' # str |  (optional)
    stage = 'stage_example' # str |  (optional)
    is_hidden = 56 # int |  (optional)
    audit_status = 56 # int |  (optional)

    try:
        # List courses
        api_response = api_instance.list_courses_api_v1_courses_list_get(page=page, limit=limit, keyword=keyword, stage=stage, is_hidden=is_hidden, audit_status=audit_status)
        print("The response of CoursesApi->list_courses_api_v1_courses_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesApi->list_courses_api_v1_courses_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **keyword** | **str**|  | [optional] 
 **stage** | **str**|  | [optional] 
 **is_hidden** | **int**|  | [optional] 
 **audit_status** | **int**|  | [optional] 

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

# **update_course_api_v1_courses_course_id_put**
> object update_course_api_v1_courses_course_id_put(course_id, course_update)

Update course

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.course_update import CourseUpdate
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
    api_instance = zhs_api.CoursesApi(api_client)
    course_id = 56 # int | 
    course_update = zhs_api.CourseUpdate() # CourseUpdate | 

    try:
        # Update course
        api_response = api_instance.update_course_api_v1_courses_course_id_put(course_id, course_update)
        print("The response of CoursesApi->update_course_api_v1_courses_course_id_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesApi->update_course_api_v1_courses_course_id_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **course_id** | **int**|  | 
 **course_update** | [**CourseUpdate**](CourseUpdate.md)|  | 

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

