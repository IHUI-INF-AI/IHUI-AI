# AppApiV1CoursesCoursesExtCommentCreate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**course_id** | **int** |  | 
**content** | **str** |  | 
**star** | **int** |  | [optional] [default to 5]
**parent_id** | **int** |  | [optional] 
**nickname** | **str** |  | [optional] [default to '']

## Example

```python
from zhs_api.models.app_api_v1_courses_courses_ext_comment_create import AppApiV1CoursesCoursesExtCommentCreate

# TODO update the JSON string below
json = "{}"
# create an instance of AppApiV1CoursesCoursesExtCommentCreate from a JSON string
app_api_v1_courses_courses_ext_comment_create_instance = AppApiV1CoursesCoursesExtCommentCreate.from_json(json)
# print the JSON string representation of the object
print(AppApiV1CoursesCoursesExtCommentCreate.to_json())

# convert the object into a dict
app_api_v1_courses_courses_ext_comment_create_dict = app_api_v1_courses_courses_ext_comment_create_instance.to_dict()
# create an instance of AppApiV1CoursesCoursesExtCommentCreate from a dict
app_api_v1_courses_courses_ext_comment_create_from_dict = AppApiV1CoursesCoursesExtCommentCreate.from_dict(app_api_v1_courses_courses_ext_comment_create_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


