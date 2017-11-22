exports.follow1 = (req, res) => {
    req.jdbc.query('mssql', `exec sp_rpt_follow1`, [], (err, result) => {
        result = JSON.parse(result);
        const params = {
            FILE_TYPE: req.query.export || "pdf",
            OUTPUT_NAME: 'การรับมอบข้าวสารในสต็อกของรัฐ'
        };
        res.ireport("ricedb/report_follow1.jasper", params.FILE_TYPE, result, params);
    });
};
exports.follow2 = (req, res) => {
    req.jdbc.query('mssql', `exec sp_rpt_follow2`, [], (err, result) => {
        result = JSON.parse(result);
        const params = {
            FILE_TYPE: req.query.export || "pdf",
            OUTPUT_NAME: 'ข้อมูลคลังสินค้าที่ค้างรับมอบข้าว'
        };
        res.ireport("ricedb/report_follow2.jasper", params.FILE_TYPE, result, params);
    });
};
exports.follow3 = (req, res) => {
    req.jdbc.query('mssql', `exec sp_rpt_follow3`, [], (err, result) => {
        result = JSON.parse(result);
        // res.json(result)
        const params = {
            FILE_TYPE: req.query.export || "pdf",
            OUTPUT_NAME: 'สรุปรายงานการรับมอบข้าวสารในสต็อกของรัฐ'
        };
        res.ireport("ricedb/report_follow3.jasper", params.FILE_TYPE, result, params);
    });
};