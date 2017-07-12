exports.keysToUpper = function (param) {
    var keyname = Object.keys(param);
    for (var i = 0; i < keyname.length; i++) {
        param[keyname[i].toUpperCase()] = param[keyname[i]];
        if (keyname[i] != keyname[i].toLowerCase() && keyname[i] != keyname[i].toUpperCase()) { // if CURrent_DATE != current_date and CURrent_DATE != CURRENT_DATE
            delete param[keyname[i]]; //CURrent_DATE
        } else {
            delete param[keyname[i].toLowerCase()];
        }
    }
    return param;
}