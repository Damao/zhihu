function getOptions() {
    if (!localStorage.hasOwnProperty('options')) {
        localStorage["options"] = '1,1,1,1';
        return [1, 1, 1, 1];
    } else {
        return localStorage.options.split(',');
    }
}
var currentOpitons = getOptions();
if(currentOpitons.length<document.getElementsByClassName("switch").length){ //  update from 3 to 5 options
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
