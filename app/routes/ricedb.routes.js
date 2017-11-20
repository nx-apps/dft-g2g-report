module.exports = function (app) {
    var controller = require('../controllers/ricedb.controller');
    app.route('/follow1').get(controller.follow1);
}