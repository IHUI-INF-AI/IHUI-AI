# AppApiV1CoursesCoursesExtCommentCreate

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**CourseId** | **int32** |  | 
**Content** | **string** |  | 
**Star** | Pointer to **int32** |  | [optional] [default to 5]
**ParentId** | Pointer to **NullableInt32** |  | [optional] 
**Nickname** | Pointer to **string** |  | [optional] [default to ""]

## Methods

### NewAppApiV1CoursesCoursesExtCommentCreate

`func NewAppApiV1CoursesCoursesExtCommentCreate(courseId int32, content string, ) *AppApiV1CoursesCoursesExtCommentCreate`

NewAppApiV1CoursesCoursesExtCommentCreate instantiates a new AppApiV1CoursesCoursesExtCommentCreate object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewAppApiV1CoursesCoursesExtCommentCreateWithDefaults

`func NewAppApiV1CoursesCoursesExtCommentCreateWithDefaults() *AppApiV1CoursesCoursesExtCommentCreate`

NewAppApiV1CoursesCoursesExtCommentCreateWithDefaults instantiates a new AppApiV1CoursesCoursesExtCommentCreate object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetCourseId

`func (o *AppApiV1CoursesCoursesExtCommentCreate) GetCourseId() int32`

GetCourseId returns the CourseId field if non-nil, zero value otherwise.

### GetCourseIdOk

`func (o *AppApiV1CoursesCoursesExtCommentCreate) GetCourseIdOk() (*int32, bool)`

GetCourseIdOk returns a tuple with the CourseId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCourseId

`func (o *AppApiV1CoursesCoursesExtCommentCreate) SetCourseId(v int32)`

SetCourseId sets CourseId field to given value.


### GetContent

`func (o *AppApiV1CoursesCoursesExtCommentCreate) GetContent() string`

GetContent returns the Content field if non-nil, zero value otherwise.

### GetContentOk

`func (o *AppApiV1CoursesCoursesExtCommentCreate) GetContentOk() (*string, bool)`

GetContentOk returns a tuple with the Content field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetContent

`func (o *AppApiV1CoursesCoursesExtCommentCreate) SetContent(v string)`

SetContent sets Content field to given value.


### GetStar

`func (o *AppApiV1CoursesCoursesExtCommentCreate) GetStar() int32`

GetStar returns the Star field if non-nil, zero value otherwise.

### GetStarOk

`func (o *AppApiV1CoursesCoursesExtCommentCreate) GetStarOk() (*int32, bool)`

GetStarOk returns a tuple with the Star field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStar

`func (o *AppApiV1CoursesCoursesExtCommentCreate) SetStar(v int32)`

SetStar sets Star field to given value.

### HasStar

`func (o *AppApiV1CoursesCoursesExtCommentCreate) HasStar() bool`

HasStar returns a boolean if a field has been set.

### GetParentId

`func (o *AppApiV1CoursesCoursesExtCommentCreate) GetParentId() int32`

GetParentId returns the ParentId field if non-nil, zero value otherwise.

### GetParentIdOk

`func (o *AppApiV1CoursesCoursesExtCommentCreate) GetParentIdOk() (*int32, bool)`

GetParentIdOk returns a tuple with the ParentId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetParentId

`func (o *AppApiV1CoursesCoursesExtCommentCreate) SetParentId(v int32)`

SetParentId sets ParentId field to given value.

### HasParentId

`func (o *AppApiV1CoursesCoursesExtCommentCreate) HasParentId() bool`

HasParentId returns a boolean if a field has been set.

### SetParentIdNil

`func (o *AppApiV1CoursesCoursesExtCommentCreate) SetParentIdNil(b bool)`

 SetParentIdNil sets the value for ParentId to be an explicit nil

### UnsetParentId
`func (o *AppApiV1CoursesCoursesExtCommentCreate) UnsetParentId()`

UnsetParentId ensures that no value is present for ParentId, not even an explicit nil
### GetNickname

`func (o *AppApiV1CoursesCoursesExtCommentCreate) GetNickname() string`

GetNickname returns the Nickname field if non-nil, zero value otherwise.

### GetNicknameOk

`func (o *AppApiV1CoursesCoursesExtCommentCreate) GetNicknameOk() (*string, bool)`

GetNicknameOk returns a tuple with the Nickname field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetNickname

`func (o *AppApiV1CoursesCoursesExtCommentCreate) SetNickname(v string)`

SetNickname sets Nickname field to given value.

### HasNickname

`func (o *AppApiV1CoursesCoursesExtCommentCreate) HasNickname() bool`

HasNickname returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


