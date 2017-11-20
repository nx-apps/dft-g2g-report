exports.follow1 = (req, res) => {
    req.jdbc.query('mssql', `exec sp_rpt_follow1`, [], (err, result) => {
        result = JSON.parse(result);
        res.ireport("ricedb/report_follow1.jasper", req.query.export || "pdf", result, {});
    });

}