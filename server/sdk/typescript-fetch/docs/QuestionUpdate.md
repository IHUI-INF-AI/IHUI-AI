
# QuestionUpdate


## Properties

Name | Type
------------ | -------------
`id` | number
`title` | string
`content` | string
`image` | string
`status` | string
`cidList` | Array&lt;number&gt;

## Example

```typescript
import type { QuestionUpdate } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "title": null,
  "content": null,
  "image": null,
  "status": null,
  "cidList": null,
} satisfies QuestionUpdate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as QuestionUpdate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


