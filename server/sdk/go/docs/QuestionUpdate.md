# QuestionUpdate

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Id** | **int32** |  | 
**Title** | Pointer to **NullableString** |  | [optional] 
**Content** | Pointer to **NullableString** |  | [optional] 
**Image** | Pointer to **NullableString** |  | [optional] 
**Status** | Pointer to **NullableString** |  | [optional] 
**CidList** | Pointer to **[]int32** |  | [optional] 

## Methods

### NewQuestionUpdate

`func NewQuestionUpdate(id int32, ) *QuestionUpdate`

NewQuestionUpdate instantiates a new QuestionUpdate object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewQuestionUpdateWithDefaults

`func NewQuestionUpdateWithDefaults() *QuestionUpdate`

NewQuestionUpdateWithDefaults instantiates a new QuestionUpdate object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetId

`func (o *QuestionUpdate) GetId() int32`

GetId returns the Id field if non-nil, zero value otherwise.

### GetIdOk

`func (o *QuestionUpdate) GetIdOk() (*int32, bool)`

GetIdOk returns a tuple with the Id field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetId

`func (o *QuestionUpdate) SetId(v int32)`

SetId sets Id field to given value.


### GetTitle

`func (o *QuestionUpdate) GetTitle() string`

GetTitle returns the Title field if non-nil, zero value otherwise.

### GetTitleOk

`func (o *QuestionUpdate) GetTitleOk() (*string, bool)`

GetTitleOk returns a tuple with the Title field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTitle

`func (o *QuestionUpdate) SetTitle(v string)`

SetTitle sets Title field to given value.

### HasTitle

`func (o *QuestionUpdate) HasTitle() bool`

HasTitle returns a boolean if a field has been set.

### SetTitleNil

`func (o *QuestionUpdate) SetTitleNil(b bool)`

 SetTitleNil sets the value for Title to be an explicit nil

### UnsetTitle
`func (o *QuestionUpdate) UnsetTitle()`

UnsetTitle ensures that no value is present for Title, not even an explicit nil
### GetContent

`func (o *QuestionUpdate) GetContent() string`

GetContent returns the Content field if non-nil, zero value otherwise.

### GetContentOk

`func (o *QuestionUpdate) GetContentOk() (*string, bool)`

GetContentOk returns a tuple with the Content field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetContent

`func (o *QuestionUpdate) SetContent(v string)`

SetContent sets Content field to given value.

### HasContent

`func (o *QuestionUpdate) HasContent() bool`

HasContent returns a boolean if a field has been set.

### SetContentNil

`func (o *QuestionUpdate) SetContentNil(b bool)`

 SetContentNil sets the value for Content to be an explicit nil

### UnsetContent
`func (o *QuestionUpdate) UnsetContent()`

UnsetContent ensures that no value is present for Content, not even an explicit nil
### GetImage

`func (o *QuestionUpdate) GetImage() string`

GetImage returns the Image field if non-nil, zero value otherwise.

### GetImageOk

`func (o *QuestionUpdate) GetImageOk() (*string, bool)`

GetImageOk returns a tuple with the Image field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImage

`func (o *QuestionUpdate) SetImage(v string)`

SetImage sets Image field to given value.

### HasImage

`func (o *QuestionUpdate) HasImage() bool`

HasImage returns a boolean if a field has been set.

### SetImageNil

`func (o *QuestionUpdate) SetImageNil(b bool)`

 SetImageNil sets the value for Image to be an explicit nil

### UnsetImage
`func (o *QuestionUpdate) UnsetImage()`

UnsetImage ensures that no value is present for Image, not even an explicit nil
### GetStatus

`func (o *QuestionUpdate) GetStatus() string`

GetStatus returns the Status field if non-nil, zero value otherwise.

### GetStatusOk

`func (o *QuestionUpdate) GetStatusOk() (*string, bool)`

GetStatusOk returns a tuple with the Status field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStatus

`func (o *QuestionUpdate) SetStatus(v string)`

SetStatus sets Status field to given value.

### HasStatus

`func (o *QuestionUpdate) HasStatus() bool`

HasStatus returns a boolean if a field has been set.

### SetStatusNil

`func (o *QuestionUpdate) SetStatusNil(b bool)`

 SetStatusNil sets the value for Status to be an explicit nil

### UnsetStatus
`func (o *QuestionUpdate) UnsetStatus()`

UnsetStatus ensures that no value is present for Status, not even an explicit nil
### GetCidList

`func (o *QuestionUpdate) GetCidList() []int32`

GetCidList returns the CidList field if non-nil, zero value otherwise.

### GetCidListOk

`func (o *QuestionUpdate) GetCidListOk() (*[]int32, bool)`

GetCidListOk returns a tuple with the CidList field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCidList

`func (o *QuestionUpdate) SetCidList(v []int32)`

SetCidList sets CidList field to given value.

### HasCidList

`func (o *QuestionUpdate) HasCidList() bool`

HasCidList returns a boolean if a field has been set.

### SetCidListNil

`func (o *QuestionUpdate) SetCidListNil(b bool)`

 SetCidListNil sets the value for CidList to be an explicit nil

### UnsetCidList
`func (o *QuestionUpdate) UnsetCidList()`

UnsetCidList ensures that no value is present for CidList, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


