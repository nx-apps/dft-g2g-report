module.exports = function (app) {

    var rice = require('../controllers/rice.controller');
    app.route('/report1').get(rice.report1);
    app.route('/report2').get(rice.report2);
    app.route('/report3').get(rice.report3);
    app.route('/report3_1').get(rice.report3_1);
    app.route('/report3_2/:id').get(rice.report3_2);
    app.route('/report4').get(rice.report4);
}