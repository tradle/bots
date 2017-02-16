
## There are bots and there are bots

A bot can be as simple as an alarm clock, and as complex as an full blown AI with financial products.

Most simple bots enable a type of conversation with your users, or even just an interaction. For example, the [Forget Your User](https://github.com/tradle/bot-forget-user) bot only knows how to handle one message: `tradle.ForgetMe`. When it receives that message, it wipes the user state object.

[Silly Bot]('../lib/strategy/silly.js') is a tiny bot that is very bad at banter.

[Keep it Fresh Bot](https://github.com/tradle/bot-keep-fresh) is a bot that watches a volatile item, and notifies your users. It can be configured to do anything from keeping your user updated with your latest data models (see the [Require Models bot](https://github.com/tradle/bot-require-models)) or styles (see the [Require Styles bot](https://github.com/tradle/bot-require-styles)), or for distributing the joke of the day. Hooked up to a microphone module, it can be used as a baby monitor and text your user when it's time to come home from vacation because the baby's awake.

The [Hackathon Inviter bot](http://github.com/tradle/bot-inviter), live at [https://bots.tradle.io](https://bots.tradle.io), asks users to confirm their emails, then notifies the dev team of their interest. Nope, it has nothing more to say, delete it from your contact list.

The [Sell Some Products](http://github.com/tradle/bot-products) can be configured to walk users through a purchase of any product for which you've developed data models. The [example bot](https://github.com/tradle/bot-products/tree/master/example.js) for this strategy is currently live on [https://bots.tradle.io](https://bots.tradle.io) as the Age Police. It can issue you proof-of-age certificates.

[Style Me](github.com/tradle/bot-style-me) is a bot that lets you edit your provider's styles in-chat, and see the results in realtime.

As you can see, bots can range from mini-behaviors (nano-bots), which can be assembled together, and mega-bots, which have an entire complex agenda. We look forward to showcasing your bots!
