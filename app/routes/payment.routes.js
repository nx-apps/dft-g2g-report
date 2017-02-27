module.exports = function (app) {
    var payment = require('../controllers/payment.controller');
    app.route('/report1').get(payment.report1);
    app.route('/report2').get(payment.report2);
    app.route('/report3_1/:id').get(payment.report3_1);
    app.route('/report3_2/:id').get(payment.report3_2);
    app.route('/report4/:id').get(payment.report4);
    app.route('/report5/:id').get(payment.report5);
    app.route('/report7').get(payment.report7);
    app.route('/report8').get(payment.report8);
    app.route('/report10/:id').get(payment.report10);
}