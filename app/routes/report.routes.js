module.exports = function (app) {
    var controller = require('../controllers/report.controller');
    app.get('/list', controller.list);
    app.route('/get').get(controller.get).post(controller.get);

}