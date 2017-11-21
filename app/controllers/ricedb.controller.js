exports.follow1 = (req, res) => {
    req.jdbc.query('mssql', `exec sp_rpt_follow1`, [], (err, result) => {
        result = JSON.parse(result);
        res.ireport("ricedb/report_follow1.jasper", req.query.export || "pdf", result, {});
    });
};
exports.follow2 = (req, res) => {
    req.jdbc.query('mssql', `exec sp_rpt_follow2`, [], (err, result) => {
        result = JSON.parse(result);
        res.ireport("ricedb/report_follow2.jasper", req.query.export || "pdf", result, {});
    });
};
exports.follow3 = (req, res) => {
    req.jdbc.query('mssql', `exec sp_rpt_follow3`, [], (err, result) => {
        result = JSON.parse(result);
        // res.json(result)
        res.ireport("ricedb/report_follow3.jasper", req.query.export || "pdf", result, {});
    });
};