# zhs_api.CourseAuditApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**audit_course_api_v1_course_audit_aid_audit_put**](CourseAuditApi.md#audit_course_api_v1_course_audit_aid_audit_put) | **PUT** /api/v1/course-audit/{aid}/audit | 审核操作
[**audit_course_api_v1_course_audit_aid_audit_put_0**](CourseAuditApi.md#audit_course_api_v1_course_audit_aid_audit_put_0) | **PUT** /api/v1/course-audit/{aid}/audit | 审核操作
[**course_audit_submit**](CourseAuditApi.md#course_audit_submit) | **POST** /api/v1/course-audit/submit | 提交课程审核
[**course_audit_submit_0**](CourseAuditApi.md#course_audit_submit_0) | **POST** /api/v1/course-audit/submit | 提交课程审核
[**get_audit_api_v1_course_audit_aid_get**](CourseAuditApi.md#get_audit_api_v1_course_audit_aid_get) | **GET** /api/v1/course-audit/{aid} | 审核详情
[**get_audit_api_v1_course_audit_aid_get_0**](CourseAuditApi.md#get_audit_api_v1_course_audit_aid_get_0) | **GET** /api/v1/course-audit/{aid} | 审核详情
[**list_audits_api_v1_course_audit_list_get**](CourseAuditApi.md#list_audits_api_v1_course_audit_list_get) | **GET** /api/v1/course-audit/list | 审核列表
[**list_audits_api_v1_course_audit_list_get_0**](CourseAuditApi.md#list_audits_api_v1_course_audit_list_get_0) | **GET** /api/v1/course-audit/list | 审核列表


# **audit_course_api_v1_course_audit_aid_audit_put**
> object audit_course_api_v1_course_audit_aid_audit_put(aid, status, remark=remark, score=score, is_final=is_final)

审核操作

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
    api_instance = zhs_api.CourseAuditApi(api_client)
    aid = 56 # int | 
    status = 56 # int | 
    remark = 'remark_example' # str |  (optional)
    score = 0 # int |  (optional) (default to 0)
    is_final = False # bool |  (optional) (default to False)

    try:
        # 审核操作
        api_response = api_instance.audit_course_api_v1_course_audit_aid_audit_put(aid, status, remark=remark, score=score, is_final=is_final)
        print("The response of CourseAuditApi->audit_course_api_v1_course_audit_aid_audit_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CourseAuditApi->audit_course_api_v1_course_audit_aid_audit_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 
 **status** | **int**|  | 
 **remark** | **str**|  | [optional] 
 **score** | **int**|  | [optional] [default to 0]
 **is_final** | **bool**|  | [optional] [default to False]

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

# **audit_course_api_v1_course_audit_aid_audit_put_0**
> object audit_course_api_v1_course_audit_aid_audit_put_0(aid, status, remark=remark, score=score, is_final=is_final)

审核操作

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
    api_instance = zhs_api.CourseAuditApi(api_client)
    aid = 56 # int | 
    status = 56 # int | 
    remark = 'remark_example' # str |  (optional)
    score = 0 # int |  (optional) (default to 0)
    is_final = False # bool |  (optional) (default to False)

    try:
        # 审核操作
        api_response = api_instance.audit_course_api_v1_course_audit_aid_audit_put_0(aid, status, remark=remark, score=score, is_final=is_final)
        print("The response of CourseAuditApi->audit_course_api_v1_course_audit_aid_audit_put_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CourseAuditApi->audit_course_api_v1_course_audit_aid_audit_put_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 
 **status** | **int**|  | 
 **remark** | **str**|  | [optional] 
 **score** | **int**|  | [optional] [default to 0]
 **is_final** | **bool**|  | [optional] [default to False]

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

# **course_audit_submit**
> object course_audit_submit(course_id, course_title=course_title)

提交课程审核

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
    api_instance = zhs_api.CourseAuditApi(api_client)
    course_id = 56 # int | 
    course_title = 'course_title_example' # str |  (optional)

    try:
        # 提交课程审核
        api_response = api_instance.course_audit_submit(course_id, course_title=course_title)
        print("The response of CourseAuditApi->course_audit_submit:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CourseAuditApi->course_audit_submit: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **course_id** | **int**|  | 
 **course_title** | **str**|  | [optional] 

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

# **course_audit_submit_0**
> object course_audit_submit_0(course_id, course_title=course_title)

提交课程审核

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
    api_instance = zhs_api.CourseAuditApi(api_client)
    course_id = 56 # int | 
    course_title = 'course_title_example' # str |  (optional)

    try:
        # 提交课程审核
        api_response = api_instance.course_audit_submit_0(course_id, course_title=course_title)
        print("The response of CourseAuditApi->course_audit_submit_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CourseAuditApi->course_audit_submit_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **course_id** | **int**|  | 
 **course_title** | **str**|  | [optional] 

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

# **get_audit_api_v1_course_audit_aid_get**
> object get_audit_api_v1_course_audit_aid_get(aid)

审核详情

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
    api_instance = zhs_api.CourseAuditApi(api_client)
    aid = 56 # int | 

    try:
        # 审核详情
        api_response = api_instance.get_audit_api_v1_course_audit_aid_get(aid)
        print("The response of CourseAuditApi->get_audit_api_v1_course_audit_aid_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CourseAuditApi->get_audit_api_v1_course_audit_aid_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 

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

# **get_audit_api_v1_course_audit_aid_get_0**
> object get_audit_api_v1_course_audit_aid_get_0(aid)

审核详情

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
    api_instance = zhs_api.CourseAuditApi(api_client)
    aid = 56 # int | 

    try:
        # 审核详情
        api_response = api_instance.get_audit_api_v1_course_audit_aid_get_0(aid)
        print("The response of CourseAuditApi->get_audit_api_v1_course_audit_aid_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CourseAuditApi->get_audit_api_v1_course_audit_aid_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 

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

# **list_audits_api_v1_course_audit_list_get**
> object list_audits_api_v1_course_audit_list_get(page=page, limit=limit, status=status, course_id=course_id)

审核列表

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
    api_instance = zhs_api.CourseAuditApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    status = 56 # int |  (optional)
    course_id = 56 # int |  (optional)

    try:
        # 审核列表
        api_response = api_instance.list_audits_api_v1_course_audit_list_get(page=page, limit=limit, status=status, course_id=course_id)
        print("The response of CourseAuditApi->list_audits_api_v1_course_audit_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CourseAuditApi->list_audits_api_v1_course_audit_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **status** | **int**|  | [optional] 
 **course_id** | **int**|  | [optional] 

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

# **list_audits_api_v1_course_audit_list_get_0**
> object list_audits_api_v1_course_audit_list_get_0(page=page, limit=limit, status=status, course_id=course_id)

审核列表

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
    api_instance = zhs_api.CourseAuditApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    status = 56 # int |  (optional)
    course_id = 56 # int |  (optional)

    try:
        # 审核列表
        api_response = api_instance.list_audits_api_v1_course_audit_list_get_0(page=page, limit=limit, status=status, course_id=course_id)
        print("The response of CourseAuditApi->list_audits_api_v1_course_audit_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CourseAuditApi->list_audits_api_v1_course_audit_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **status** | **int**|  | [optional] 
 **course_id** | **int**|  | [optional] 

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

