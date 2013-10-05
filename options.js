function getOptions() {
    if (!localStorage.hasOwnProperty('options')) {
        localStorage["options"] = '1,1,1,1';
        return [1, 1, 1, 1];
    } else {
        return localStorage.options.split(',');
    }
}
var currentOpitons = getOptions();
if (currentOpitons.length < document.getElementsByClassName("switch").length) { //  update from 3 to 5 options
    localStorage["options"] = '1,1,1,1';
    window.location.reload();
}
function isSwitch(order) {
    if (currentOpitons[order] == 1) {
        document.getElementById('option' + order).className = 'switch-on switch-animate';
    } else {
        document.getElementById('option' + order).className = 'switch-off switch-animate';
    }
}
function updateOptions() {
    localStorage["options"] = currentOpitons.toString();
}
function setSwitch(i) {
    document.getElementById('option' + i).onclick = function () {
        if (currentOpitons[i] == 1) {
            this.className = 'switch-off switch-animate';
            currentOpitons[i] = 0;
        } else {
            this.className = 'switch-on switch-animate';
            currentOpitons[i] = 1;
        }
        updateOptions();
    }
}
for (var i = 0; i < document.getElementsByClassName("switch").length; i++) {
    isSwitch(i);
    setSwitch(i);
}

var notificationCloseTimeout = localStorage.notificationCloseTimeout;
var idNotificationCloseTimeout = document.getElementById("notificationCloseTimeout");
idNotificationCloseTimeout.value = notificationCloseTimeout;

idNotificationCloseTimeout.onfocus = function () {
    this.value = '';
    console.log('focused')
}
idNotificationCloseTimeout.onblur = function () {
    if (this.value == '') {
        this.value = 10;
        localStorage.notificationCloseTimeout = 10
    } else {
        localStorage.notificationCloseTimeout = this.value;
    }
    // Create a simple text notification:
    var notification = webkitNotifications.createNotification(
        'img/zhihu-logo_48.png',  // icon url - can be relative
        '测试桌面通知',  // notification title
        '这是一坨持续'+this.value+'秒的桌面通知,\n点我脸上关闭'  // notification body text
    );
    notification.onclick = function () {
        if (notification) {
            notification.cancel();
        }
    };
    var notificationCloseTimeout = this.value * 1000;
    if (notificationCloseTimeout != 0) {
        setTimeout(function () {
            if (notification) {
                notification.cancel();
            }
        }, notificationCloseTimeout);
    }
    notification.show();

}