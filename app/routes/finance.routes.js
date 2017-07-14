module.exports = function (app) {
    var finance = require('../controllers/finance.controller');
    app.route('/report1').get(finance.report1);
    app.route('/report2').get(finance.report2);
    app.route('/report3').get(finance.report3);
    app.route('/report4').get(finance.report4);
    app.route('/report5').get(finance.report5);
    app.route('/report6').get(finance.report6);
    // app.route('/report3_1/:id').get(finance.report3_1);
    // app.route('/report3_2/:id').get(finance.report3_2);
    app.route('/report7').get(finance.report7);
    app.route('/report8').get(finance.report8); 
    app.route('/report8_1').get(finance.report8_1); //ok
    app.route('/report9').get(finance.report9); //ok
    app.route('/report10/:id').get(finance.report10); //ok
    app.route('/report11').get(finance.report11);
}