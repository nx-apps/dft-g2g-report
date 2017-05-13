module.exports = function (app) {

    var shipment = require('../controllers/shipment.controller');
    app.route('/report1/:book_id').get(shipment.report1);
    app.route('/report2/:book_id').get(shipment.report2);
    app.route('/report3').get(shipment.report3);
    app.route('/report3_1/:id').get(shipment.report3_1);
    app.route('/report3_2/:id').get(shipment.report3_2);
    app.route('/report4/:cl_id').get(shipment.report4);
}