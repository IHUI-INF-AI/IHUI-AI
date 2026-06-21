# QuestionCreate

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Title** | **string** |  | 
**Content** | **string** |  | 
**Image** | Pointer to **NullableString** |  | [optional] 
**CidList** | Pointer to **[]int32** |  | [optional] 

## Methods

### NewQuestionCreate

`func NewQuestionCreate(title string, content string, ) *QuestionCreate`

NewQuestionCreate instantiates a new QuestionCreate object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewQuestionCreateWithDefaults

`func NewQuestionCreateWithDefaults() *QuestionCreate`

NewQuestionCreateWithDefaults instantiates a new QuestionCreate object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetTitle

`func (o *QuestionCreate) GetTitle() string`

GetTitle returns the Title field if non-nil, zero value otherwise.

### GetTitleOk

`func (o *QuestionCreate) GetTitleOk() (*string, bool)`

GetTitleOk returns a tuple with the Title field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTitle

`func (o *QuestionCreate) SetTitle(v string)`

SetTitle sets Title field to given value.


### GetContent

`func (o *QuestionCreate) GetContent() string`

GetContent returns the Content field if non-nil, zero value otherwise.

### GetContentOk

`func (o *QuestionCreate) GetContentOk() (*string, bool)`

GetContentOk returns a tuple with the Content field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetContent

`func (o *QuestionCreate) SetContent(v string)`

SetContent sets Content field to given value.


### GetImage

`func (o *QuestionCreate) GetImage() string`

GetImage returns the Image field if non-nil, zero value otherwise.

### GetImageOk

`func (o *QuestionCreate) GetImageOk() (*string, bool)`

GetImageOk returns a tuple with the Image field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImage

`func (o *QuestionCreate) SetImage(v string)`

SetImage sets Image field to given value.

### HasImage

`func (o *QuestionCreate) HasImage() bool`

HasImage returns a boolean if a field has been set.

### SetImageNil

`func (o *QuestionCreate) SetImageNil(b bool)`

 SetImageNil sets the value for Image to be an explicit nil

### UnsetImage
`func (o *QuestionCreate) UnsetImage()`

UnsetImage ensures that no value is present for Image, not even an explicit nil
### GetCidList

`func (o *QuestionCreate) GetCidList() []int32`

GetCidList returns the CidList field if non-nil, zero value otherwise.

### GetCidListOk

`func (o *QuestionCreate) GetCidListOk() (*[]int32, bool)`

GetCidListOk returns a tuple with the CidList field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCidList

`func (o *QuestionCreate) SetCidList(v []int32)`

SetCidList sets CidList field to given value.

### HasCidList

`func (o *QuestionCreate) HasCidList() bool`

HasCidList returns a boolean if a field has been set.

### SetCidListNil

`func (o *QuestionCreate) SetCidListNil(b bool)`

 SetCidListNil sets the value for CidList to be an explicit nil

### UnsetCidList
`func (o *QuestionCreate) UnsetCidList()`

UnsetCidList ensures that no value is present for CidList, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


