Tradle Data Modeling syntax

## Introduction

Tradle software is divided into two parts, the code and the data models. The code uses the data models to display data on the screen, to transmit data, to store data and to search for data. Each data model defines a set of properties. Any object of this model will have properties defined there. Some properties are listed as ‘required’. There are many other annotations, which are used to create rich definition of data and its handling. 

We use [Json Schema](http://json-schema.org/) as a basis for the data modeling language, but Json Schema is not rich enough for our purposes, so we have extended it.

Below is the reference on data models. See live [models on github](https://github.com/tradle/models).

To validate your models, use: [https://github.com/tradle/validate](https://github.com/tradle/validate)

To validate objects built from models, use: [https://github.com/tradle/validate-resource](https://github.com/tradle/validate-resource) 

Half-baked model builder: [https://github.com/tradle/build-model](https://github.com/tradle/build-model)  

Example:

  {

    type: 'tradle.Model',

    title: 'Over 18',

    id: 'age.police.Over18',

    interfaces: ['tradle.Message'],

    subClassOf: 'tradle.FinancialProduct',

    forms: [

      'tradle.PhotoID',

      'tradle.Selfie',

      'age.police.ParentContactInfo'

    ],

    properties: {

      isOver18: {

        type: 'boolean'

      }

    }

  

## Model attributes

1. **properties**: list of properties, each separately described. No other properties can be used in the objects of this model. 
There is one exception to this rule, a special property that represents json. It allows to include any type of structured data into the object without modeling it upfront, which is very useful for integration purposes. 

2. **type**: any object must have type, models have type ‘tradle.Model’.

3. **id**: specifies the name of the model, e.g. ‘tradle.Organization’

4. **title: **optional, to display a name different from id. Useful for evolving UI without affecting the code that may be referencing that id.

5. **subClassOf**: optional, specifies this model as an extension of another model. Use this extremely sparingly, only when you absolutely need a strong rigidity in the data model. Instead consider using interfaces, see below. One very important use for subClassOf is ‘tradle.Form’. It is the only way to  for entering structured data. Another good use for *subclassOf* is ‘tradle.Enum’. Enum classes are defined in [data directory under tradle/models](https://github.com/tradle/models/tree/3fa9b772ea0a15c175ccd2f574b8e99377518586/data), and are used to list possible values of the property, e.g. marital status, gender, etc. This mechanism is also used for longer lists, which are predefined, like currencies, countries, etc. See for example, [Country](https://github.com/tradle/models/blob/243a8ccc7ef65ab68582ce51a44fe571f4ee0a58/models/tradle.Country.json) model, and [Country list](https://github.com/tradle/models/blob/8ee099313329657d6fc043d4dad2aebeb0df54f4/data/tradle.Country.json).

6. **required**: optional, array of properties. UI enforces this, making sure user enters all of them.

7. **viewCols**: specifies properties that are displayed to the user, the rest of the properties are omitted. Also defines the order in which properties are displayed. 

8. **editCols: **specifies order of properties for edit mode. Default order is defined by viewCols. This list overrides it and used for property groups. TBD...

9. **isInterface**: optional, this model represents an interface. Interface defines the set of properties to be used, but one can not create an object for this interface. This is useful to group the properties that are repeatedly defined in multiple classes, tradle.Verifiable. 

10. **interfaces**: optional, array of interfaces which this model implements, which means this model has to have properties of those interfaces. For objects to show up in chat, they should list the "tradle.Message" interface

11. **inlined**: optional, set to true on models like Money, which never have separate object, and are always included inline into another object.

12. **sort: **property by which a list of objects of this type will be sorted when displayed

13. **plural**: title that is used in plural contact, like geese, to avoid saying gooses

14. **icon**: optional, but desired for better UI. Icon that will be displayed for objects of this type. Icon should be taken from this list: http://ionicframework.com/docs/v2/ionicons/

15. **notShareable**: optional, objects of this type will never be asked to be shared between providers. For example tradle.Selfie is used for authentication in real time, and must always be taken fresh.

## Property attributes

1. **title: **optional, to specify a name different from property’s own name. Useful for evolving property names without changing all the references to them in the code.

2. **type**: used to specify what values the property can hold: 
object, string, number, boolean, array

3. **ref**: only used for type:object, specifies the model for that object, e.g. tradle.Organization

4. **range**: only used for type:string, specifies its meaning e.g. email, phone. This is used to tie a specific function to validation, formatting, keyboard type, etc. 
One special case: as json is an object that has no model, we use *range* instead of *ref, *i.e. type:object. range: json. 

5. **inlined**: optional, set to true if this property has a complex value, like Phone, which itself is a model. For such model a separate object is not created, instead the object is inlined, that is it becomes part of the main object. Also used for arrays, like this:
"photos": { "type": "array", "inlined": true, "items": { "ref": "tradle.Photo" } }

6. **readOnly**: set to true if this property cannot be modified by the user 

7. **description**: optional, use to display it in UI, for example in data entry to guide the users.

8. **displayName**: set to true if the value of this property is part of object’s displayed title.

9. **pattern**: optional, a regular expression (regexp) that defines the pattern for property value validation.

10. **keyboard**: possible values include: default, numeric, email-address, phone-pad

