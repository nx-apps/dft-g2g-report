module.exports = function (app) {
    var controller = require('../controllers/ricedb.controller');
    app.route('/follow1').get(controller.follow1);
    app.route('/follow2').get(controller.follow2);
    app.route('/follow3').get(controller.follow3);
}