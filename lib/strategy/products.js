
const models = require('@tradle/models')
const {
  co
} = require('../utils')

const STRINGS = {
  PLEASE_FILL_FIRM: 'Please fill out this form',
  TELL_ME_MORE: 'tell me more about this "{0}," it sounds interesting',
  NO_COMPRENDO: 'Huh? What\'s a "{0}"? I only understand simple messages. One day, when I\'m a real boy...',
  HOT_NAME: '{0}, eh? Hot name!',
  GOT_PRODUCT: 'Yes! You got a {0}. You know, we don\'t give those out to just anybody',
  APPLICATION_NOT_FOUND: 'Hm, application not found. Please re-apply, but be happy about it!',
  SORRY_TO_FORGET_YOU: 'You\'re pretty unforgettable, but alright',
  NICE_TO_MEET_YOU: 'Nice to meet you!'
}

const DEFAULT_PRODUCTS = [
  'tradle.MortgageProduct'
]

module.exports = function productsStrategy (bot, products=DEFAULT_PRODUCTS) {
  const send = bot.send.bind(bot)
  const save = bot.users.save.bind(bot.users)
  const productList = createProductList(products)

  function oncreate (user) {
    user.forms = {}
    user.applications = {}
    user.products = {}
    user.importedVerifications = []

    save(user)

    send(user.id, STRINGS.NICE_TO_MEET_YOU)
  }

  const onmessage = co(function* (data) {
    const { user, payload } = data
    const type = getType(payload)
    const model = models[type]

    switch (type) {
    case 'tradle.SelfIntroduction':
    case 'tradle.IdentityPublishRequest':
      if (!payload.profile) break

      let name = payload.profile.firstName
      let oldName = user.profile && user.profile.firstName
      user.profile = payload.profile
      save(user)
      if (name !== oldName) {
        yield send(user, format(STRINGS.HOT_NAME, name))
      }

      send(user, productList)
      break
    case 'tradle.SimpleMessage':
      handleSimpleMessage(data)
      break
    case 'tradle.CustomerWaiting':
      send(user, productList)
      break
    case 'tradle.Verification':
      handleVerification(data)
      break
    case 'tradle.ProductApplication':
      handleProductApplication(data)
      break
    case 'tradle.ForgetMe':
      yield send(user, STRINGS.SORRY_TO_FORGET_YOU)
      yield send(user, { _t: 'tradle.ForgotYou' })

      ;['forms', 'applications', 'products', 'importedVerifications', 'history'].forEach(prop => {
        const val = user[prop]
        if (Array.isArray(val)) val.length = 0
        else user[prop] = {}
      })

      save(user)
      break
    default:
      if (model && model.subClassOf === 'tradle.Form') {
        handleForm(data)
        break
      }

      let title = model ? model.title : type
      send(user, format(STRINGS.NO_COMPRENDO, title))
      break
    }
  })

  bot.users.on('create', oncreate)
  bot.on('message', onmessage)

  const handleSimpleMessage = co(function* handleSimpleMessage (data) {
    const { user, payload } = data
    send(user, format(STRINGS.TELL_ME_MORE, payload.message))
  })

  const handleProductApplication = co(function* handleProductApplication (data) {
    const { user, payload, message } = data
    if (user.products[payload.product]) {
      const productModel = models[payload.product]
      yield send(user, `Another ${productModel.title}? Whooaah!!`)
    }

    if (!user.applications[message.context]) {
      user.applications[message.context] = payload
    }

    return sendNextForm(data)
  })

  const handleForm = co(function* handleForm (data) {
    const { user, payload } = data
    user.forms[getType(payload)] = payload
    return sendNextForm(data)
  })

  const sendNextForm = co(function* sendNextForm ({ user, payload, message }) {
    const application = user.applications[message.context]
    if (!application) {
      send(user, STRINGS.APPLICATION_NOT_FOUND)
      return
    }

    const productType = application.product
    const productModel = models[productType]
    const next = productModel.forms.find(form => !user.forms[form])
    if (!next) {
      // we're done!
      user.products[productType] = true
      return send(user, format(STRINGS.GOT_PRODUCT, productModel.title))
    }

    send(user, createFormRequest(productModel.id, next))
  })

  const handleVerification = co(function* ({ user, payload }) {
    user.importedVerifications.push(payload)
  })

  return function disable () {
    bot.removeListener('message', onmessage)
    bot.users.removeListener('create', oncreate)
  }
}

function createFormRequest (product, form) {
  return {
    _t: 'tradle.FormRequest',
    form,
    product,
    message: STRINGS.PLEASE_FILL_FIRM
  }
}

function getFormModels (productModelIds) {
  return productModelIds
    .map(id => models[id].forms)
    .reduce((soFar, forms) => {
      const additional = forms.filter(f => soFar.indexOf(f) === -1)
      return soFar.concat(additional)
    })
    .map(id => models[id])
}

function createProductList (productModelIds) {
  const productModels = productModelIds.map(id => models[id])
  const formModels = getFormModels(productModelIds)
  return {
    _t: "tradle.ProductList",
    welcome: true,
    message: "[I can see you're curious!](Click for a list of products)",
    list: productModels.concat(formModels)
  }
}

function getType (payload) {
  return payload._t
}

// source: http://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format
function format (str, ...args) {
  return str.replace(/{(\d+)}/g, function (match, number) {
    return typeof args[number] !== 'undefined'
      ? args[number]
      : match
    ;
  })
}
