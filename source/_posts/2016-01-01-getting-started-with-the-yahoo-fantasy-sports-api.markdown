---
layout: post
title: "Getting Started with the Yahoo! Fantasy Sports API"
date: 2016-01-01 20:35:47 -0500
comments: true
categories: tech
---

When I first started building my [fantasybots.com](http://fantasybots.com) service, there were many hurdles I ran across while learning to work with the Yahoo! Sports API. First off, the documentation is horrible and has actually gotten worse over the years. Also, it appears community relations with independent developers were abandoned back in 2010. The following are some tips on getting setup using Node and Express.

## Setting up Yahoo! app
Go to [https://developer.yahoo.com/apps/create/](https://developer.yahoo.com/apps/create/) and create an app. The callback domain says optional but will need to be set for the way we will be doing authentication. This callback domain needs to be a domain you control and can be used for both development and production. Under API Permissions check the Fantasy Sports box and then click the create app button. This will give you the two OAuth keys needed for the next section. 

## Communicating with the API
While you could setup your own OAuth, I went with a library that took care of most of that along with making the API easier to work with. There are a few out there but I went with [fantasy-sports](https://github.com/jcreamer898/fantasy-sports). The documentation on GitHub is straight forward with plenty of code examples. 

This library is setup for using the token stored in a browser cookie but I have had no problems storing the token on the back-end for automated request when the user is not on the site. 

The API allows you to request JSON but it is very apparent that XML is the primary format. The returned JSON is very messy and overly complicated. Also, if you ever need to POST back to the API it only accepts XML.

## Local development
Unfortunately, Yahoo! doesn’t allow you to set the callback domain to a localhost address, but it does allow you to use any subdomain of the url set. In order to have a development workflow that did not require pushing changes to a staging server, what I did was use [ngrok](https://ngrok.com/). This is an amazing service that I use almost every day at home and work. If you pay for the service, they will allow you to setup your custom domain to tunnel traffic to your localhost environment [https://ngrok.com/docs#custom-domains](https://ngrok.com/docs#custom-domains). Once all that is setup then local development is a breeze.

## The Data
Be careful when working with the JSON returned from the API. It appears to just be a conversion of XML:
```
{
  players: {
    0: {
        player: [
            [{
                    player_key: "346.p.8851"
                }, {
                    player_id: "8851"
                }, {
                    name: {
                        full: "Devin Mesoraco",
                        first: "Devin",
                        last: "Mesoraco",
                        ascii_first: "Devin",
                        ascii_last: "Mesoraco"
                    }
                }, {
                    status: "DL"
                }, {
                    on_disabled_list: "1"
                }, {
                    editorial_player_key: "mlb.p.8851"
                }, {
                    editorial_team_key: "mlb.t.17"
                }, {
                    editorial_team_full_name: "Cincinnati Reds"
                }, {
                    editorial_team_abbr: "Cin"
                }, {
                    uniform_number: "39"
                }, {
                    display_position: "C"
                }, {
                    headshot: {
                        url: "http://l.yimg.com/iu/api/res/1.2/6lZ3W5sQgW6GvYDqstn64Q--/YXBwaWQ9c2hhcmVkO2NoPTIzMzY7Y3I9MTtjdz0xNzkwO2R4PTg1NztkeT0wO2ZpPXVsY3JvcDtoPTYwO3E9MTAwO3c9NDY-/https://s.yimg.com/xe/i/us/sp/v/mlb_cutout/players_l/20150406/8851.png",
                        size: "small"
                    },
                    image_url: "http://l.yimg.com/iu/api/res/1.2/6lZ3W5sQgW6GvYDqstn64Q--/YXBwaWQ9c2hhcmVkO2NoPTIzMzY7Y3I9MTtjdz0xNzkwO2R4PTg1NztkeT0wO2ZpPXVsY3JvcDtoPTYwO3E9MTAwO3c9NDY-/https://s.yimg.com/xe/i/us/sp/v/mlb_cutout/players_l/20150406/8851.png"
                }, {
                    is_undroppable: "0"
                }, {
                    position_type: "B"
                }, {
                    eligible_positions: [{
                        position: "C"
                    }, {
                        position: "Util"
                    }, {
                        position: "DL"
                    }]
                },
                [],
                []
            ]
        ]
    }
```
Here is where a library like [lodash](https://lodash.com/) will come in handy. Also, a huge mistake I did was assume that an object in an array would always be in the same position. For example, `{ display_position: "C" }` in the above JSON is at `players['0'].player[0][10]`, however, if that player was no on the "DL" then the `{ status: "DL" }` is left out and display_position then becomes `players['0'].player[0][9]`. So what you have to do is either loop through the player[0] array or use lodash to find the object by property. 

There are many things I have encountered in my two years of working with this API. Feel free to reach out if you have any questions.

