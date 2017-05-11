# URL Change Notifier

This is a node app that monitors web pages and notifies the user when a url changes. All monitored pages are in config.json and can be edited using the example below as reference.

## Example for config.json
 
    //name           | name of page
    //host           | host of page
    //path           | path to page
    //type           | type of content check, see app.js for details
    //cropPointStart | string found in content that tells the notifier
                       from this string back ignore this content.
                       Needs to be an anticipated unique string on 
                       the page source.
    //cropPointStop  | string found in content that tells the notifier
                       from this string forward ignore this content.
                       Needs to be an anticipated unique string on
                       the page source.
    //exclude        | an array of regex expresions that will exclude
                       all matching from the return of cropPointStart
                       and cropPointStop.
    //content        | the string that content-exclusion or
                        content-inclusion is searching for.

    {
        "pagesToWatch": [{
            "name": "Angry Beavers Schedule",
            "host": "www.kcicecenter.com",
            "path": "/page/show/976683-angry-beavers?subseason=131702",
            "type": "content-change",
            "cropPointStart": "Angry Beavers Calendar",
            "cropPointStop": "Recent Angry Beavers News",
            "exclude": [{
                "start": "extendedOptions",
                "stop": "</div>"
            }]
        }, {
            "name": "Bauer Pro Sr. Goal Skate",
            "host": "www.goaliemonkey.com",
            "path": "/equipment/skates/sr-goalie-skates/bauer-goalie-skate-pro-sr.html",
            "type": "content-exclusion",
            "content": "<span class=\"price\">$599.99</span>"
        }, {
            "name": "Amazon Video Homeland Season 2",
            "host": "www.amazon.com",
            "path": "/The-Smile-HD/dp/B00F34Z6TS/",
            "type": "content-inclusion",
            "content": "<h2 class=\"avodAction-head\">Prime Instant Video</h2>"
        }]
    }
    
## Helpful regex

For exclusing here is a [helpfull example](http://regexr.com/3ek9i).
    
## Deployment

You will want to run app.js regularly in a cron tab so run

    sudo crontab -e
    
And add the following to run the check everyday at 10am

    0 10 * * * /usr/bin/node /home/troy/tasks/url-change-notifier/app.js