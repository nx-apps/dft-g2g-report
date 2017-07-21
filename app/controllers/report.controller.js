exports.list = function (req, res) {
    r.db('g2g').table('report')
        .merge({ report_params: r.row('report_params').orderBy('no') })
        .orderBy('report_no')
        .run().then(function (data) {
            res.json(data);
        })
}
exports.get = function (req, res) {
    var val = req.query;
    if (req.method == "POST") {
        val = req.body;
    }
    r.db('g2g').table(val.report_table).getAll(val.req.value, { index: val.req.field })
        .group(function (g) {
            return g.pluck([val.res, val.view])
        }).ungroup()
        .getField('group')
        .run().then(function (data) {
            res.json(data)
        })
}