// Copyright (c) 2013 http://bigC.at. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var animationFrames = 36;
var animationSpeed = 10; // ms
var canvas = document.getElementById('canvas');
var loggedInImage = document.getElementById('logged_in');
var canvasContext = canvas.getContext('2d');
var pollIntervalMin = 1;  // 1 minute
var pollIntervalMax = 60;  // 1 hour
var requestTimeout = 1000 * 2;  // 2 seconds
var rotation = 0;
var loadingAnimation = new LoadingAnimation();
var permission = 7; //options 1 2 4

// Legacy support for pre-event-pages.
var oldChromeVersion = !chrome.runtime;
var requestTimerId;

function getZhihuUrl() {
    return "http://www.zhihu.com";
}
function getMsgUrl() {
    return getZhihuUrl() + '/noti7/new';
}

function isZhihuUrl(url) {
    // Return whether the URL starts with the Zhihu prefix.
    return url.indexOf(getZhihuUrl()) == 0;
}

// A "loading" animation displayed while we wait for the first response from
// Zhihu. This animates the badge text with a dot that cycles from left to
// right.
function LoadingAnimation() {
    this.timerId_ = 0;
    this.maxCount_ = 8;  // Total number of states in animation
    this.current_ = 0;  // Current state
    this.maxDot_ = 4;  // Max number of dots in animation
}

LoadingAnimation.prototype.paintFrame = function () {
    var text = "";
    for (var i = 0; i < this.maxDot_; i++) {
        text += (i == this.current_) ? "." : " ";
    }
    if (this.current_ >= this.maxDot_)
        text += "";

    chrome.browserAction.setBadgeText({text: text});
    this.current_++;
    if (this.current_ == this.maxCount_)
        this.current_ = 0;
};

LoadingAnimation.prototype.start = function () {
    if (this.timerId_)
        return;

    var self = this;
    this.timerId_ = window.setInterval(function () {
        self.paintFrame();
    }, 100);
};

LoadingAnimation.prototype.stop = function () {
    if (!this.timerId_)
        return;

    window.clearInterval(this.timerId_);
    this.timerId_ = 0;
};

function updateIcon() {
    if (permission == 0) {
        chrome.browserAction.setIcon({path: "img/zhihu_logged_in.png"});
        chrome.browserAction.setBadgeBackgroundColor({color: [190, 190, 190, 230]});
        chrome.browserAction.setBadgeText({text: ""});
        return;
    }
    if (!localStorage.hasOwnProperty('unreadCount')) {
        chrome.browserAction.setIcon({path: "img/zhihu_not_logged_in.png"});
        chrome.browserAction.setBadgeBackgroundColor({color: [190, 190, 190, 230]});
        chrome.browserAction.setBadgeText({text: "?"});
    } else if (localStorage.unreadCount == "0") {
        chrome.browserAction.setIcon({path: "img/zhihu_not_logged_in.png"});
        chrome.browserAction.setBadgeBackgroundColor({color: [190, 190, 190, 230]});
        chrome.browserAction.setBadgeText({text: ""});
    } else {
        chrome.browserAction.setIcon({path: "img/zhihu_logged_in.png"});
        chrome.browserAction.setBadgeBackgroundColor({color: [208, 0, 24, 255]});
        chrome.browserAction.setBadgeText({
            text: localStorage.unreadCount != "0" ? localStorage.unreadCount : ""
        });
    }
}

function scheduleRequest() {
    console.log('scheduleRequest');
    var randomness = Math.random() * 2;
    var exponent = Math.pow(2, localStorage.requestFailureCount || 0);
    var multiplier = Math.max(randomness * exponent, 1);
    var delay = Math.min(multiplier * pollIntervalMin, pollIntervalMax);
    delay = Math.round(delay);
    console.log('Scheduling for: ' + delay);

    if (oldChromeVersion) {
        if (requestTimerId) {
            window.clearTimeout(requestTimerId);
        }
        requestTimerId = window.setTimeout(onAlarm, delay * 60 * 1000);
    } else {
        console.log('Creating alarm');
        // Use a repeating alarm so that it fires again if there was a problem
        // setting the next alarm.
        chrome.alarms.create('refresh', {periodInMinutes: delay});
    }
}

// ajax stuff
function startRequest(params) {
    // Schedule request immediately. We want to be sure to reschedule, even in the
    // case where the extension process shuts down while this request is
    // outstanding.
    if (params && params.scheduleRequest) scheduleRequest();

    function stopLoadingAnimation() {
        if (params && params.showLoadingAnimation) loadingAnimation.stop();
    }

    if (params && params.showLoadingAnimation)
        loadingAnimation.start();

    getInboxCount(
        function (count) {
            stopLoadingAnimation();
            updateUnreadCount(count);
        },
        function () {
            stopLoadingAnimation();
            delete localStorage.unreadCount;
            updateIcon();
        }
    );
}
function getOptions() {
    if (!localStorage.hasOwnProperty('options')) {
        localStorage["options"] = '1,1,1';
        return [1, 1, 1];
    } else {
        return localStorage.options.split(',');
    }
}
function getInboxCount(onSuccess, onError) {
    var xhr = new XMLHttpRequest();
    var abortTimerId = window.setTimeout(function () {
        xhr.abort();  // synchronously calls onreadystatechange
    }, requestTimeout);

    function handleSuccess(count) {
        localStorage.requestFailureCount = 0;
        window.clearTimeout(abortTimerId);
        if (onSuccess)
            onSuccess(count);
    }

    var invokedErrorCallback = false;

    function handleError() {
        ++localStorage.requestFailureCount;
        window.clearTimeout(abortTimerId);
        if (onError && !invokedErrorCallback)
            onError();
        invokedErrorCallback = true;
    }

    try {
        xhr.onreadystatechange = function () {
            if (xhr.readyState != 4)
                return;
            if (xhr.responseText) {
                var responseJSON = JSON.parse(xhr.responseText);
//                var responseJSON = JSON.parse('["noti7",[1,2,7]]');
                var responseArray = responseJSON[1].toString();
                responseArray = responseArray.split(",").map(Number);
                var lastResponseArray = localStorage["lastResponseArray"];
//                console.log('lastResponseArray = ', lastResponseArray);
//                console.log('responseArray.toString() = ', responseArray.toString());
                if (lastResponseArray == responseArray.toString()) {
                    console.log('nothing changed,break my heart;');
                    localStorage["hasChanged"] = false;
                } else {
                    localStorage["lastResponseArray"] = responseArray;
                    localStorage["hasChanged"] = true;
                }
                if (responseArray) {
                    localStorage.msg1 = responseArray[0];
                    localStorage.msg2 = responseArray[1];
                    localStorage.msg3 = responseArray[2];
                    var currentOptions = getOptions();
                    if (currentOptions[0] == 0) {
                        permission = permission - 1;
                    }
                    if (currentOptions[1] == 0) {
                        permission = permission - 2;
                    }
                    if (currentOptions[2] == 0) {
                        permission = permission - 4;
                    }
                    switch (permission) {
                        case 7:
                            handleSuccess(responseArray[0] + responseArray[1] + responseArray[2]);
                            updateTitle(responseArray[0], responseArray[1], responseArray[2]);
                            break;
                        case 6:
                            handleSuccess(responseArray[1] + responseArray[2]);
                            updateTitle(0, responseArray[1], responseArray[2]);
                            break;
                        case 5:
                            handleSuccess(responseArray[0] + responseArray[2]);
                            updateTitle(responseArray[0], 0, responseArray[2]);
                            break;
                        case 4:
                            handleSuccess(responseArray[2]);
                            updateTitle(0, 0, responseArray[2]);
                            break;
                        case 3:
                            handleSuccess(responseArray[0] + responseArray[1]);
                            updateTitle(responseArray[0], responseArray[1], 0);
                            break;
                        case 2:
                            handleSuccess(responseArray[1]);
                            updateTitle(0, responseArray[1], 0);
                            break;
                        case 1:
                            handleSuccess(responseArray[0]);
                            updateTitle(responseArray[0], 0, 0);
                            break;
                        case 0:
                            handleSuccess(0);
                            updateTitle(0);
                            break;
                    }

                    return;
                } else {
                    console.error(chrome.i18n.getMessage("zhihucheck_node_error"));
                }
            }

            handleError();
        };

        xhr.onerror = function () {
            handleError();
        };
        var timeStamp = +new Date();
        xhr.open("GET", getMsgUrl() + '?' + timeStamp, true);
        xhr.send(null);
    } catch (e) {
        console.error(chrome.i18n.getMessage("zhihucheck_exception", e));
        handleError();
    }
}


function updateUnreadCount(count) {
    var changed = localStorage.unreadCount != count;
    localStorage.unreadCount = count;
    updateIcon();
    if (changed)
        animateFlip();
}

function updateTitle(msg1, msg2, msg3) {
    var contents = "";
    var content1 = chrome.i18n.getMessage("zhihumsg_content1", [msg1]);
    var content2 = chrome.i18n.getMessage("zhihumsg_content2", [msg2]);
    var content3 = chrome.i18n.getMessage("zhihumsg_content3", [msg3]);
    var title = chrome.i18n.getMessage("zhihumsg_title");

    if (msg1 != 0 && msg1 != undefined) {
        contents += ' ' + content1;
    } else {
        msg1 = 0
    }
    if (msg2 != 0 && msg2 != undefined) {
        contents += ' ' + content2;
    } else {
        msg2 = 0
    }
    if (msg3 != 0 && msg3 != undefined) {
        contents += ' ' + content3;
    } else {
        msg3 = 0
    }
    chrome.browserAction.setTitle({title: contents});
    var currentOptions = getOptions();
    console.log('currentOptions[3] == 1', currentOptions[3] == 1, 'msg1 + msg2 + msg3', (msg1 + msg2 + msg3) != "0", 'localStorage.hasChanged=="true"', localStorage.hasChanged == "true");
    if (currentOptions[3] == 1 && (msg1 + msg2 + msg3) != "0" && localStorage.hasChanged == "true") {
        // Create a simple text notification:
        var notification = webkitNotifications.createNotification(
            'img/zhihu-logo_48.png',  // icon url - can be relative
            title,  // notification title
            contents  // notification body text
        );
        notification.onclick = function () {
            goToInbox();
            if (notification) {
                notification.cancel();
            }
        };
        function getNotificationCloseTimeout(){
            var timer=localStorage.notificationCloseTimeout;
            if(timer){
                return timer;
            }else{
                localStorage["notificationCloseTimeout"]=10;
                return 10;
            }
        }
        var notificationCloseTimeout = getNotificationCloseTimeout()*1000;
        console.log('notificationCloseTimeout',notificationCloseTimeout);
        if (notificationCloseTimeout != 0) {
            setTimeout(function () {
                if (notification) {
                    notification.cancel();
                }
            }, notificationCloseTimeout);
        }
        notification.show();
        console.log("start notification");
    }
}


function ease(x) {
    return (1 - Math.sin(Math.PI / 2 + x * Math.PI)) / 2;
}

function animateFlip() {
    rotation += 1 / animationFrames;
    drawIconAtRotation();

    if (rotation <= 1) {
        setTimeout(animateFlip, animationSpeed);
    } else {
        rotation = 0;
        updateIcon();
    }
}

function drawIconAtRotation() {
    canvasContext.save();
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    canvasContext.translate(
        Math.ceil(canvas.width / 2),
        Math.ceil(canvas.height / 2));
    canvasContext.rotate(2 * Math.PI * ease(rotation));
    canvasContext.drawImage(loggedInImage,
        -Math.ceil(canvas.width / 2),
        -Math.ceil(canvas.height / 2));
    canvasContext.restore();

    chrome.browserAction.setIcon({imageData: canvasContext.getImageData(0, 0,
        canvas.width, canvas.height)});
}
function activeInbox(tabId) {
    if (localStorage.unreadCount != "0") {
        chrome.tabs.executeScript(tabId,
            {code: "document.getElementById('zh-top-nav-count-wrap').click()"});
    }
}
function goToInbox() {
    console.log('Going to inbox...');
    chrome.tabs.getAllInWindow(undefined, function (tabs) {
        for (var i = 0, tab; tab = tabs[i]; i++) {
            if (tab.url && isZhihuUrl(tab.url)) {
                console.log('Found Zhihu tab: ' + tab.url + '. ' +
                    'Focusing and refreshing count...');
                chrome.tabs.update(tab.id, {selected: true});
                startRequest({scheduleRequest: false, showLoadingAnimation: false});
                activeInbox(tab.id);
                return;
            }
        }
        console.log('Could not find Zhihu tab. Creating one...');
        chrome.tabs.create({url: getZhihuUrl()});
        activeInbox(null);
    });
}

function onInit() {
    console.log('onInit');
    localStorage.requestFailureCount = 0;  // used for exponential backoff
    startRequest({scheduleRequest: true, showLoadingAnimation: true});
    if (!oldChromeVersion) {
        // (mpcomplete): We should be able to remove this now, but leaving it
        // for a little while just to be sure the refresh alarm is working nicely.
        chrome.alarms.create('watchdog', {periodInMinutes: 5});
    }
}

function onAlarm(alarm) {
    console.log('Got alarm', alarm);
    // |alarm| can be undefined because onAlarm also gets called from
    // window.setTimeout on old chrome versions.
    if (alarm && alarm.name == 'watchdog') {
        onWatchdog();
    } else {
        startRequest({scheduleRequest: true, showLoadingAnimation: false});
    }
}

function onWatchdog() {
    chrome.alarms.get('refresh', function (alarm) {
        if (alarm) {
            console.log('Refresh alarm exists. Yay.');
        } else {
            console.log('Refresh alarm doesn\'t exist!? ' +
                'Refreshing now and rescheduling.');
            startRequest({scheduleRequest: true, showLoadingAnimation: false});
        }
    });
}

if (oldChromeVersion) {
    updateIcon();
    onInit();
} else {
    chrome.runtime.onInstalled.addListener(onInit);
    chrome.alarms.onAlarm.addListener(onAlarm);
}

var filters = {
    // (aa): Cannot use urlPrefix because all the url fields lack the protocol
    // part. See crbug.com/140238.
    url: [
        {urlContains: getZhihuUrl().replace(/^https?\:\/\//, '')}
    ]
};

function onNavigate(details) {
    if (details.url && isZhihuUrl(details.url)) {
        console.log('Recognized Zhihu navigation to: ' + details.url + '.' +
            'Refreshing count...');
        startRequest({scheduleRequest: false, showLoadingAnimation: false});
    }
}
if (chrome.webNavigation && chrome.webNavigation.onDOMContentLoaded &&
    chrome.webNavigation.onReferenceFragmentUpdated) {
    chrome.webNavigation.onDOMContentLoaded.addListener(onNavigate, filters);
    chrome.webNavigation.onReferenceFragmentUpdated.addListener(
        onNavigate, filters);
} else {
    chrome.tabs.onUpdated.addListener(function (_, details) {
        onNavigate(details);
    });
}

chrome.browserAction.onClicked.addListener(goToInbox);

if (chrome.runtime && chrome.runtime.onStartup) {
    chrome.runtime.onStartup.addListener(function () {
        console.log('Starting browser... updating icon.');
        startRequest({scheduleRequest: false, showLoadingAnimation: false});
        updateIcon();
    });
} else {
    // This hack is needed because Chrome 22 does not persist browserAction icon
    // state, and also doesn't expose onStartup. So the icon always starts out in
    // wrong state. We don't actually use onStartup except as a clue that we're
    // in a version of Chrome that has this problem.
    chrome.windows.onCreated.addListener(function () {
        console.log('Window created... updating icon.');
        startRequest({scheduleRequest: false, showLoadingAnimation: false});
        updateIcon();
    });
}
