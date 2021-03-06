module.exports = function (app) {
    var payment = require('../controllers/payment.controller');
    app.route('/report1').get(payment.report1);
    app.route('/report2').get(payment.report2);
    // app.route('/report3_1/:id').get(payment.report3_1);
    // app.route('/report3_2/:id').get(payment.report3_2);
    app.route('/report4/:id').get(payment.report4);
    app.route('/report6/:id').get(payment.report6);
    app.route('/report7').get(payment.report7); //ok
    app.route('/report8').get(payment.report8); //ok
    app.route('/report10/:id').get(payment.report10); //ok
    app.route('/report11').get(payment.report11);
}