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
        if (req.query.export === 'excel2') {
            // console.log('excel', result);
            const XLSX = require('xlsx');
            /* create workbook & set props*/
            const wb = {
                SheetNames: [], Sheets: {}
            };
            /*create sheet data & add to workbook*/
            const ws = XLSX.utils.json_to_sheet(result,
                {
                    header: [
                        "follow_year",
                        "follow_no",
                        "follow_type",
                        "associate",
                        "warehouse_name",
                        "province_name",
                        "typerice_name",
                        "project_name",
                        "bidder_name",
                        "weight_approve",
                        "weight_contract",
                        "weight_received",
                        "weight_balance",
                        "weight_lost",
                        "contract_no",
                        "save_date",
                        "limit_date",
                        "remark",
                        "problem_found",
                        "problem_fix",
                        "contract_mistake"
                    ]
                });
            const ws_name = "Sheet1";
            XLSX.utils.book_append_sheet(wb, ws, ws_name);

            /* create file 'in memory' */
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
            const filename = encodeURIComponent('ข้อมูลคลังสินค้าที่ค้างรับมอบข้าว.xlsx');
            res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
            res.type('application/octet-stream');
            res.send(wbout);
            // res.json(result);
        } else {
            const params = {
                FILE_TYPE: req.query.export || "pdf",
                OUTPUT_NAME: 'ข้อมูลคลังสินค้าที่ค้างรับมอบข้าว'
            };
            res.ireport("ricedb/report_follow2.jasper", params.FILE_TYPE, result, params);
        }

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