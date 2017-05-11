//-------------------------------------------------------------------------------------------------
//CHANGE NOTIFIER v 0.5.0
//checks web pages found in config.json and checks to see if specific content in them have changed.
//there are three types of pages; content-change, content-exclusion, and content-inclusion.
//content-change checks to see if there is any change, content-exclusion checks to see if content
//has been removed from the page, and content-inclusion checks to see if content has been added.
//
//Please see deploy/EXAMPLE_config.json for an example config.json file.
//
//running 'node app.js wait' from a bait file gives this code a delay to allow for dropbox to sync.
//(need to find a way to bullet proof this wait time)
//-------------------------------------------------------------------------------------------------
var http = require('http');
var https = require('https');
var fs = require('fs');
var mkdirp = require('mkdirp');
var nodemailer = require("nodemailer");
var jsdiff = require('diff');

var ChangeNotifier = new function() {

    var pagesToWatch = require('./config.json').pagesToWatch;
    var numberOfPages = pagesToWatch.length;
    var pagesChecked = 0;
    var pagesChanged = 0;
    var DROPBOX_DELAY = 300000;

    var DATA_PATH = '/data/';

    //mail info
    var smtpTransport = nodemailer.createTransport("SMTP", {
        service: 'Gmail',
        auth: {
            user: 'redacted@redacted.com',
            pass: 'redacted'
        }
    });

    var mailOptions = {
        from: 'URL Notifier <redacted@redacted.com>',
        to: 'redacted@redacted.com, redacted@redacted.com',
        subject: 'Something has changed in your watch list.',
        text: '',
        html: ''
    }

    this.init = function() {
        console.log('\nURL Change Notifier');
        console.log('----------------------------------------');

        mkdirp.sync(__dirname + DATA_PATH)

        if (process.argv[2] == 'wait') {
            console.log('giving dropbox some time.... please leave this window up, it will close automagically');
            setTimeout(checkPages, DROPBOX_DELAY);
        } else {
            checkPages();
        }
    }
    //-----------------------------------------------------------------------------------------
    function checkPages() {
        resetMailData();
        var i = pagesToWatch.length - 1;
        while (i >= 0) {
            getWebPageString(pagesToWatch[i]);
            i--;
        }
    }
    //-----------------------------------------------------------------------------------------
    function checkPage(node, data) {

        var dir = __dirname + DATA_PATH;

        var fileName = node.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        switch (node.type) {
            case 'content-change':
                checkPageForContentChange(node, data, dir, fileName);
                break;
            case 'content-exclusion':
                checkPageForContentExclusion(node, data, dir, fileName);
                break;
            case 'content-inclusion':
                checkPageForContentInclusion(node, data, dir, fileName);
                break;
        }
    }
    //-----------------------------------------------------------------------------------------
    function checkPageForContentExclusion(node, data, dir, fileName) {
        var contentFound = 'false';

        if (data.indexOf(node.content) > 0) {
            contentFound = 'true';
        }

        if (contentFound == 'false') {
            readFromFile(dir + fileName, function(oldData) {
                if (oldData) {
                    if (contentFound != oldData) {
                        alertContentExclusion(node);
                    }
                }

                writeToFile(dir, fileName, contentFound);
                markPageAsChecked();
            });
        } else {
            writeToFile(dir, fileName, contentFound);
            markPageAsChecked();
        }
    }
    //-----------------------------------------------------------------------------------------
    function checkPageForContentInclusion(node, data, dir, fileName) {
        var contentFound = 'false';

        if (data.indexOf(node.content) > 0) {
            contentFound = 'true';
        }

        if (contentFound == 'true') {
            readFromFile(dir + fileName, function(oldData) {
                if (oldData) {
                    if (contentFound != oldData) {
                        alertContentInclusion(node);
                    }
                }

                writeToFile(dir, fileName, contentFound);
                markPageAsChecked();
            });
        } else {
            writeToFile(dir, fileName, contentFound);
            markPageAsChecked();
        }
    }
    //-----------------------------------------------------------------------------------------
    function checkPageForContentChange(node, data, dir, fileName) {
        var data = cropData(data, {
            'start': node.cropPointStart,
            'stop': node.cropPointStop,
            'exclude': node.exclude,
        });

        readFromFile(dir + fileName, function(oldData) {
            if (oldData) {

                if (data != oldData) {
                    var diffHTML = getDiffHTML(oldData, data);
                    if (diffHTML.length > 0) {
                        alertContentChange(node, diffHTML);
                    }
                }
            }

            writeToFile(dir, fileName, data);
            markPageAsChecked();
        });
    }
    //-----------------------------------------------------------------------------------------
    function getDiffHTML(oldData, data) {
        var diff = jsdiff.diffLines(oldData, data);

        //green equals added
        //red equals removed
        //grey for common

        var color = null;
        var diffS = "";

        diff.forEach(function(part) {
            //check for white space
            part.value = part.value.replace(/\s/g, '');

            if (part.value.length > 0) {
                if (part.added) {
                    if (color != 'green') {
                        color = 'green';
                        diffS += '</span><span style="color:#0f0;">';
                    }
                    diffS += part.value;
                } else if (part.removed) {
                    if (color != 'red') {
                        color = 'red';
                        diffS += '</span><span style="color:#f00;">';
                    }
                    diffS += part.value;
                } else {
                    if (color != 'grey') {
                        color = 'grey';
                        diffS += '</span><span style="color:#666;">';
                    }
                    diffS += part.value;
                }
            }
        });

        diffS += '</span>';
        diffS = diffS.substring(7);

        return diffS;
    }
    //-----------------------------------------------------------------------------------------
    function markPageAsChecked() {
        pagesChecked++;
        if (pagesChecked == numberOfPages) {
            if (pagesChanged == 0) {
                console.log('no pages have changed.');
            } else {
                console.log(pagesChanged + ' of ' + numberOfPages + ' pages found changed.');
                sendEmailAlert();
            }
        }
    }
    //-----------------------------------------------------------------------------------------
    //ALERTS
    //-----------------------------------------------------------------------------------------
    function alertContentChange(node, diffHTML) {
        pagesChanged++;
        mailOptions.text += node.name + ' has changed! (http://' + node.host + node.path + ')\n';
        mailOptions.html += '<a href="http://' + node.host + node.path + '" target="_blank">' + node.name + '</a> has changed!<br /><div style="padding-left:10px;">diff is: ' + diffHTML + '</div><br /><br />';
    }
    //-----------------------------------------------------------------------------------------
    function alertContentExclusion(node) {
        pagesChanged++;
        mailOptions.text += node.name + ' not longer has the following in it\'s page: ' + node.content + '! (http://' + node.host + node.path + ')\n';
        mailOptions.html += '<a href="http://' + node.host + node.path + '" target="_blank">' + node.name + '</a> not longer has the following in it\'s page: ' + node.content + '!<br />';
    }
    //-----------------------------------------------------------------------------------------
    function alertContentInclusion(node) {
        pagesChanged++;
        mailOptions.text += node.name + ' has the following in it\'s page: ' + node.content + '! (http://' + node.host + node.path + ')\n';
        mailOptions.html += '<a href="http://' + node.host + node.path + '" target="_blank">' + node.name + '</a> has the following in it\'s page: ' + node.content + '!<br />';
    }
    //-----------------------------------------------------------------------------------------
    function sendEmailAlert() {
        smtpTransport.sendMail(mailOptions, function(error, response) {
            if (error) {
                console.log(error);
                smtpTransport.close();
            } else {
                console.log('Message sent: ' + response.message);
                smtpTransport.close();
            }
        });
    }
    //-----------------------------------------------------------------------------------------
    function resetMailData() {
        mailOptions.text = '';
        mailOptions.html = '';
    }
    //-----------------------------------------------------------------------------------------
    //DATA HANDLING
    //-----------------------------------------------------------------------------------------
    function getWebPageString(node) {
        var protocal = node.protocol == 'https' ? https.request : http.request;

        var request = protocal({
            'host': node.host,
            'path': node.path
        }, function(res) {
            var data = '';
            res.on('data', function(chunk) {
                data += chunk;
            });
            res.on('end', function() {
                checkPage(node, data);
            });
        });
        request.on('error', function(e) {
            console.log(e.message);
        });
        request.end();
    }
    //-----------------------------------------------------------------------------------------
    function readFromFile(file, callBack) {
        fs.readFile(file, 'utf8', function(err, data) {
            if (err) {
                callBack(false);
            } else {
                callBack(data);
            }
        });
    }
    //-----------------------------------------------------------------------------------------
    function writeToFile(dir, file, data) {
        mkdirp(dir, function() {
            fs.writeFile(dir + file, data, function(err) {
                if (err) {
                    console.log(err);
                }
            });
        });
    }
    //-----------------------------------------------------------------------------------------
    function cropData(data, limits) {

        //initial crop
        if (data.indexOf(limits.start) >= 0) {
            var dataA = data.split(limits.start);
            dataA.shift();
            var data = dataA.join('');
            if (data.indexOf(limits.stop) >= 0) {
                var dataA = data.split(limits.stop);
                dataA.pop();
                var data = dataA.join('');
            }
        }

        //exlcudes
        if (limits.exclude) {
            var i = limits.exclude.length - 1;
            while (i >= 0) {
                var regex = limits.exclude[i];
                var re = new RegExp(regex, 'g');
                data = data.replace(re, '');
                i--;
            }
        }

        //var s = "hi there and stufff \n and stuff z"
        // var re = new RegExp('hi.*?z', 'gm');
        // data = s.replace(re, '');
        // console.log(data)

        return data;
    }
    //-----------------------------------------------------------------------------------------
}

ChangeNotifier.init();