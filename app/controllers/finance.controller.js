function keysToUpper(param) {
    var keyname = Object.keys(param);
    for (var i = 0; i < keyname.length; i++) {
        param[keyname[i].toUpperCase()] = param[keyname[i]];
        if (keyname[i] != keyname[i].toLowerCase() && keyname[i] != keyname[i].toUpperCase()) { // if CURrent_DATE != current_date and CURrent_DATE != CURRENT_DATE
            delete param[keyname[i]]; //CURrent_DATE
        } else {
            delete param[keyname[i].toLowerCase()];
        }
    }
    return param;
}
exports.report1 = function (req, res, next) {
    var r = req.r;
    var query = req.query;
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        MINISTRY_ADDRESS: req.query.address //|| "44/100 NONTHABURI 1 ROAD NONTHABURI 11000, THAILAND"
        // SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
    // res.json('123')
    r.db('g2g').table('book').get(query.id)
        .pluck('id', 'cl_id', 'ship', 'load_port', 'dest_port', 'deli_port', 'bl_no', 'contract_id', 'invoice_no', 'invoice_date', 'made_out_to', 'invoice_status', 'invoice_type', 'invoice_year')
        .merge(function (m) {
            var detail = r.table('book_detail').getAll(req.query.id, { index: 'book_id' }).coerceTo('array')
                .pluck('package_amount', 'package', 'price_d', 'gross_weight', 'tare_weight', 'net_weight', 'value_d',
                'hamonize', 'hamonize_id', 'project_en', 'package_id');
            var contract = r.table('contract').get(m('contract_id')).pluck('buyer', 'contract_name', 'contract_date');
            return contract
                .merge(function (m2) {
                    var count = detail.group('hamonize_id', 'package_id').ungroup().count();
                    return {
                        invoice_of: detail.group('hamonize_id').ungroup()
                            .map(function (m3) {
                                return {
                                    hamonize: m3('reduction')(0)('hamonize')('hamonize_en2'),
                                    package_amount: m3('reduction').sum('package_amount'),
                                    project_en: m3('reduction')(0)('project_en')
                                }
                            }),
                        ship: r.branch(m('ship').count().gt(1),
                            m('ship').reduce(function (left, right) {
                                return r.branch(left.hasFields('data'),
                                    {
                                        data: left('data').add(', ', right('ship_name'), ' V.', right('ship_voy'))
                                    },
                                    {
                                        data: left('ship_name').add(" V.", left('ship_voy'), ', ', right('ship_name'), ' V.', right('ship_voy'))
                                    }
                                )
                            })('data'),
                            m('ship')(0)('ship_name').add(" V.", m('ship')(0)('ship_voy'))
                        ),
                        jasper_count: count,
                        detail: detail.group('hamonize_id', 'package_id').ungroup()
                            .map(function (map2) {
                                var data = map2('reduction');
                                return data(0).pluck('hamonize', 'package', 'price_d', 'project_en')
                                    .merge({
                                        jasper_count: count,
                                        gross_weight: data.sum('gross_weight'),
                                        tare_weight: data.sum('tare_weight'),
                                        net_weight: data.sum('net_weight'),
                                        package_amount: data.sum('package_amount'),
                                        value_d: data.sum('value_d'),
                                        incoterms: r.table('confirm_letter').get(m('cl_id')).getField('incoterms')
                                            .concatMap(function (c) {
                                                return [c('inct_name')]
                                            }).reduce(function (left, right) {
                                                return left.add(', ', right)
                                            })
                                    })
                                    .merge(contract.pluck('contract_name', 'contract_date', { buyer: ['buyer_masks', 'buyer_name'] }))
                                // .merge(contract('buyer').pluck('buyer_masks', 'buyer_name'))
                            }),

                    }
                })
        })
        .run()
        .then(function (result) {
            // res.json(result);
            res.ireport("finance/report1.jasper", req.query.export || "pdf", [result], parameters);
        });


}
exports.report2 = function (req, res, next) {
    var r = req.r;
    var query = req.query;
    var cl = r.db('g2g').table('confirm_letter').get(query.cl_id)
        .merge(function (m) {
            var contract = r.table('contract').get(m('contract_id'));
            return contract
                .merge(contract('country').pluck('country_name_th'))
        }).pluck('cl_no', 'contract_no', 'country_name_th');

    var book = r.db('g2g').table('book').getAll(query.cl_id, { index: 'cl_id' })
        .pluck('cl_id', 'ship_lot', 'invoice_date', 'invoice_no', 'invoice_type', 'invoice_year', 'id', 'book_no', 'bl_no', 'deli_port', 'ship', 'load_port', 'dest_port', 'value_d', 'contract_id', 'notify_party')
        .eqJoin('contract_id', r.db('g2g').table('contract')).pluck('left', { right: ['buyer', 'contract_name'] }).zip();


    r.expr({
        param: cl,
        data: book.coerceTo('array')
            .merge(function (m) {
                return {
                    detail: r.db('g2g').table('book_detail').getAll(m('id'), { index: 'book_id' }).coerceTo('array')
                        .group('hamonize_id', 'package_id').ungroup()
                        .merge(function (m2) {
                            var data = m2('reduction');
                            return data(0).pluck('hamonize', 'package', 'price_d', 'project_en', 'value_d')
                                .merge({
                                    net_weight: data.sum('net_weight'),
                                })
                                .merge(function (con_merge) {
                                    // var contract = r.table('contract').get(m('contract_id'))
                                    return {
                                        reduction: m2('reduction')
                                            .merge(function (con2_merge) {
                                                return r.table('contract').get(m('contract_id')).pluck('buyer', 'company')
                                            })
                                    }
                                })
                        })
                }
            })
            .orderBy('ship_lot')
    })
        .run()
        .then(function (result) {
            // res.json(result)
            var params = result.param;
            params.current_date = new Date().toISOString().slice(0, 10);
            params = keysToUpper(params);
            // res.json(params)
            res.ireport("finance/report2.jasper", req.query.export || "pdf", result['data'], params);
        })
        .error(function (err) {
            res.json(err)
        })
}
exports.report3 = function (req, res, next) {
    var r = req.r;
    var query = req.query;
    var params = {
        date_start: query.date
    };
    var date = req.query.date + "T00:00:00+07:00";

    var datas = r.db('g2g').table('fee').getAll(query.contract_id, { index: 'contract_id' })
        .filter(function (row) {
            return row('fee_date').date().eq(r.ISO8601(date))
        })
    datas = r.expr(r.branch(datas.count().gt(0),
        datas.group(function (g) {
            return g.pluck('cl_no', 'fee_no', 'fee_round')
        }).ungroup()
            .getField('reduction')
            .reduce(function (left, right) {
                return left.add(right)
            })
            .merge(function (m) {
                return {
                    fee_date: m('fee_date').inTimezone('+07').toISO8601().split('T')(0),
                    book: m('book').pluck('invoice_no', 'invoice_type', 'invoice_year', 'invoice_date', 'detail').orderBy('invoice_no')
                        .merge(function (m2) {
                            return {
                                detail: m2('detail').pluck('price_d', 'value_d', 'net_weight')
                                    .group('price_d').ungroup()
                                    .orderBy('invoice_date')
                                    .map(function (m3) {
                                        return m2.without('detail').merge({
                                            price_d: m3('group'),
                                            net_weight: m3('reduction').sum('net_weight'),
                                            value_d: m3('reduction').sum('value_d'),
                                            invoice_date: m2('invoice_date').inTimezone('+07').toISO8601().split('T')(0)
                                        })
                                    })
                            }
                        }).getField('detail')
                        .reduce(function (left, right) {
                            return left.add(right)
                        })
                }
            })
            .pluck('cl_no', 'contract_id', 'fee_no', 'fee_date', 'fee_round', 'book')
            .eqJoin('contract_id', r.db('g2g').table('contract')).pluck('left', { right: [{ 'country': 'country_name_th' }, { 'buyer': 'buyer_name' }] }).zip()
            .map(function (m) {
                return m.getField('book').merge(m.without('book'))
            })
            .reduce(function (left, right) {
                return left.add(right)
            })
            .orderBy('cl_no', 'fee_no', 'fee_round'),
        []
    ))

    r.expr({
        datas: datas.without('country', 'buyer', 'contract_id'),
        params: r.branch(datas.count().gt(0), {
            country_name_th: datas(0)('country')('country_name_th'),
            buyer_name: datas(0)('buyer')('buyer_name')
        }, {})
    })
        .run()
        .then(function (result) {
            // res.json(result)
            var params = result['params'];
            // params.current_date = new Date().toISOString().slice(0, 10);
            params = keysToUpper(params);
            // res.json(params)
            res.ireport("finance/report3.jasper", req.query.export || "pdf", result['datas'], params);
        })
        .error(function (err) {
            res.json(err)
        })
}
exports.report4 = function (req, res, next) {
    var r = req.r;
    var query = req.query;
    var params = {
        date_start: query.date
    };
    var date = req.query.date + "T00:00:00+07:00";

    var datas = r.db('g2g').table('fee').getAll(query.contract_id, { index: 'contract_id' })
        .filter(function (row) {
            return row('fee_date').date().eq(r.ISO8601(date))
        })
    datas = r.expr(r.branch(datas.count().gt(0),
        datas.group(function (g) {
            return g.pluck('cl_no', 'fee_no', 'fee_round')
        })
            .ungroup()
            .getField('reduction')
            .reduce(function (left, right) {
                return left.add(right)
            })
            .merge(function (m) {
                var invoice = m('book').orderBy('invoice_no').getField('invoice_no');
                var amount_d = m('value_d').sub(m('fee_ex_d'));
                var amount_b = m('rate_bank_b').mul(amount_d);
                return {
                    fee_date: m('fee_date').inTimezone('+07').toISO8601().split('T')(0),
                    invoice_type: m('book')(0)('invoice_type'),
                    invoice_no: invoice.reduce(function (left, right) {
                        return left.coerceTo('string').add(',', right.coerceTo('string'))
                    }),
                    invoice_year: m('book')(0)('invoice_year'),
                    count_invoice: invoice.count(),
                    amount_d: amount_d,
                    amount_b: amount_b,
                    get_b: amount_b.sub(m('fee_in_b'))
                }
            })
            .eqJoin('contract_id', r.db('g2g').table('contract')).pluck('left', { right: [{ 'country': 'country_name_th' }, { 'buyer': 'buyer_name' }] }).zip()
            .without('book', 'cl_id', 'creater', 'date_created', 'date_updated', 'fee_status', 'fin_status', 'id', 'rice_status', 'updater')
            .orderBy('cl_no', 'fee_no', 'fee_round'),
        []
    ))

    r.expr({
        datas: datas.without('country', 'buyer', 'contract_id'),
        params: r.branch(datas.count().gt(0), {
            country_name_th: datas(0)('country')('country_name_th'),
            buyer_name: datas(0)('buyer')('buyer_name')
        }, {})
    })
        .run()
        .then(function (result) {
            // res.json(result);
            var params = result['params'];
            // params.current_date = new Date().toISOString().slice(0, 10);
            params = keysToUpper(params);
            // res.json(params)
            res.ireport("finance/report4.jasper", req.query.export || "pdf", result['datas'], params);
        });

}
exports.report5 = function (req, res, next) {
    var r = req.r;
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
    r.db('g2g2').table('fee')
        .get(req.query.fee_id)
        .merge(function (fee_merge) {
            return {
                invoice: fee_merge('invoice').map(function (fee_map) {
                    return fee_map.merge(function (fee_merge1) {
                        return r.db('g2g2').table('invoice')
                            .get(fee_merge1('invoice_id'))
                        // .merge(function (m) {
                        //     return {
                        //         shipment_detail: r.db('g2g2').table('shipment_detail')
                        //             .getAll(m('book_id'), { index: 'book_id' })
                        //             .coerceTo('array')
                        //             .pluck("id", "cl_id", "package_id", "exporter_id", "shm_det_quantity", "type_rice_id")
                        //             // .eqJoin("shm_id", r.db('g2g2').table("shipment")).without({ right: ["id", "date_created", "date_updated", "creater", "updater"] }).zip()
                        //             .eqJoin("cl_id", r.db('g2g2').table("confirm_letter")).without({ right: ['id', 'date_created', 'date_updated', 'creater', 'updater', "cl_date", "cl_name", "cl_quality"] }).zip()
                        //             .eqJoin("package_id", r.db('common').table("package")).without({ right: ["id", "date_created", "date_updated", "creater", "updater"] }).zip()
                        //             .eqJoin("exporter_id", r.db('external').table("exporter")).without({ right: ["id", "date_created", "date_updated", "creater", "updater"] }).zip()
                        //             // .eqJoin("trader_id", r.db('external').table("trader")).without({ right: ["id", "date_created", "date_updated", "creater", "updater"] }).zip()
                        //             .eqJoin("company_id", r.db('external').table("company")).without({ right: ['id', 'date_created', 'date_updated', 'creater', 'updater', "country_id"] }).zip()
                        //             .merge(function (m1) {
                        //                 return {
                        //                     shm_det_id: m1('id'),
                        //                     price_per_ton: m1('price_per_ton'),
                        //                     // price_per_ton: m1('cl_type_rice')
                        //                     //     .filter(function (tb) {
                        //                     //         return tb('type_rice_id').eq(m1('type_rice_id'))
                        //                     //     }).getField("package")(0)
                        //                     //     .filter(function (f) {
                        //                     //         return f('package_id').eq(m1('package_id'))
                        //                     //     })(0)
                        //                     //     .pluck('price_per_ton')
                        //                     //     .values()(0),
                        //                     quantity_tons: m1('shm_det_quantity'),
                        //                     quantity_bags: m1('shm_det_quantity').mul(1000).div(m1('package_kg_per_bag'))

                        //                 }
                        //             })
                        //             .merge(function (m1) {
                        //                 return {
                        //                     weight_gross: m1('quantity_bags').mul(m1('package_kg_per_bag').add(m1('package_weight_bag').div(1000))).div(1000),
                        //                     weight_net: m1('quantity_bags').mul(m1('package_kg_per_bag')).div(1000),
                        //                     weight_tare: m1('quantity_bags').mul(m1('package_weight_bag').div(1000)).div(1000)
                        //                 }
                        //             })
                        //             .merge(function (m1) {
                        //                 return {
                        //                     amount_usd: m1('price_per_ton').mul(m1('weight_net'))
                        //                 }
                        //             })
                        //             .without('id', 'cl_type_rice', 'shm_det_quantity')
                        //     }
                        // })
                        // .merge(function (m) {
                        //     return r.db('g2g2').table('book').get(m('book_id')).without('id', 'date_created', 'date_updated', 'creater', 'updater')
                        // })
                        // .merge(function (m) {
                        //     return {
                        //         invoice_id: m('id'),
                        //         // ship: m('group_ship')('ship')(0),
                        //         // shipline_id: m('group_ship')('shipline_id')(0),
                        //         // ship_lot_no: m('group_ship')('ship_lot_no')(0),
                        //         //  ship_voy_no: m('group_ship')('ship_voy_no')(0),
                        //         weight_gross: m('shipment_detail').sum('weight_gross'),
                        //         weight_net: m('shipment_detail').sum('weight_net'),
                        //         weight_tare: m('shipment_detail').sum('weight_tare'),
                        //         amount_usd: m('shipment_detail').sum('amount_usd'),
                        //         invoice_date: m('invoice_date').split('T')(0),
                        //         invoice_detail: fee_merge1('invoice_detail').map(function (map1) {
                        //             return m('shipment_detail').filter({ shm_det_id: map1('shm_det_id') })(0).merge(map1)
                        //                 .merge(function (m2) {
                        //                     return {
                        //                         exporter_date_approve: m2('exporter_date_approve').split('T')(0),
                        //                         // exporter_date_update: m2('exporter_date_update').split('T')(0),
                        //                         invoice_date: m2('invoice_date').split('T')(0),
                        //                         // trader_date_approve: m2('trader_date_approve').split('T')(0)
                        //                     }
                        //                 })
                        //         })
                        //     }
                        // })
                        // .without("id", "shipment_detail")
                        // .merge(function (m) {
                        //     return r.db('common').table("shipline").get(m('shipline_id')).without('id', 'date_created', 'date_updated', 'creater', 'updater')
                        //     // r.db('common').table("ship").get(m('ship_id')).without('id'),
                        // })
                        // .merge(function (m) {
                        //     return {
                        //         ship: m('ship').map(function (arr_ship) {
                        //             return arr_ship.merge(function (row_ship) {
                        //                 return r.db('common').table('ship').get(row_ship('ship_id')).without('id', 'date_created', 'date_updated', 'creater', 'updater')
                        //             })
                        //         })
                        //     }
                        // })
                    })
                })
            }
        })
        // .merge(function (fee_merge) {
        //     return {
        //         fee_id: fee_merge('id'),
        //         fee_date_receipt: fee_merge('fee_date_receipt').split('T')(0),
        //         amount_usd: fee_merge('invoice').sum('amount_usd'),
        //         weight_gross: fee_merge('invoice').sum('weight_gross'),
        //         weight_net: fee_merge('invoice').sum('weight_net'),
        //         weight_tare: fee_merge('invoice').sum('weight_tare')
        //     }
        // })
        .without('id')
        .run()
        .then(function (result) {
            res.json(result)
        })
        .error(function (err) {
            res.json(err)
        })
}
exports.report6 = function (req, res, next) {
    var r = req.r;
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
    r.db('g2g2').table('payment').get(req.params.id)
        .merge(function (m) {
            return {
                TOTAL: m('pay_amount').mul(0.01)
            }
        })
        .merge(r.db('external').table('exporter').get(r.row('exporter_id')).pluck('company_id'))
        // .merge(r.db('external').table('trader').get(r.row('trader_id')).pluck('company_id'))
        .merge(r.db('external').table('company').get(r.row('company_id')).pluck('company_taxno', 'company_name_th', 'company_address_th'))
        .without('payment_detail', 'tags')
        //   .eqJoin('exporter_id',r.db('external').table('exporter')).pluck('left',{right:'trader_id'}).zip()
        //   .eqJoin('trader_id',r.db('external').table('trader')).pluck('left',{right:'company_id'}).zip()
        //   .eqJoin('company_id',r.db('external').table('company')).pluck('left',{right:['company_taxno','company_name_th','company_address_th','']}).zip()
        .run()
        .then(function (result) {
            // res.json([result]);
            res.ireport("payment/report6.jasper", req.query.export || "pdf", result, parameters);
        });

}
exports.report7 = function (req, res, next) {
    var r = req.r;
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
    // console.log( req.query.date_start);
    // date_start = req.query.date_start;
    // date_end = req.query.date_end;
    var year = parseInt(req.query.year);
    var month = parseInt(req.query.month);
    r.db('g2g2').table('payment')//.between(date_start, date_end, { index: 'pay_date' })
        .filter(function (f) {
            return f('pay_date').year().eq(year).and(
                f('pay_date').month().eq(month)
            )
        })
        .merge(function (m) {
            return {
                count_exporter: m.count(),
                TOTAL: m('pay_amount').mul(0.01)//.div(100)
            }
        })
        .eqJoin('exporter_id', r.db('external').table('exporter')).pluck("left", { right: "company_id" }).zip()
        // .merge(function (m) {
        //     return r.db('external').table('exporter').get(m('exporter_id')).pluck('company_id')
        // })
        // .merge(r.db('external_f3').table('trader').get(r.row('trader_id')).pluck('company_id'))
        .merge(r.db('external').table('company').get(r.row('company_id')).pluck('company_taxno', 'company_name_th', 'company_address_th'))
        .without('payment_detail', 'tags')
        // .pluck('TOTAL', 'pay_amount', 'pay_date')
        // .merge(function (r1) {
        //     return {
        //         count_exporter:
        //          r.db('g2g2').table('payment')//.between(date_start, date_end, { index: 'pay_date' })
        //             .filter(function (f) {
        //                 return f('pay_date').year().eq(year).and(
        //                     f('pay_date').month().eq(month)
        //                 )
        //             })
        //             .count()
        //     }
        // })
        .merge(function (m) {
            return {
                page_count: m('count_exporter').div(6).floor().add(1)
            }
        })

        .run()
        .then(function (result) {
            // res.json(result);
            res.ireport("payment/report7.jasper", req.query.export || "pdf", result, parameters);
        });

}
exports.report8 = function (req, res, next) {
    var r = req.r;
    var parameters = {
        PAGE: '',
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
    // date_start = req.query.date_start;
    // date_end = req.query.date_end;
    var year = parseInt(req.query.year);
    var month = parseInt(req.query.month);
    r.db('g2g2').table('payment')//.between(date_start, date_end, { index: 'pay_date' })
        .filter(function (f) {
            return f('pay_date').year().eq(year).and(
                f('pay_date').month().eq(month)
            )
        })
        .merge(function (m) {
            return {
                TOTAL: m('pay_amount').mul(0.01)//.div(100)
            }
        })
        .eqJoin('exporter_id', r.db('external').table('exporter')).pluck("left", { right: "company_id" }).zip()
        // .merge(function (m) {
        //     return r.db('external').table('exporter').get(m('exporter_id')).pluck('company_id')
        // })
        .merge(r.db('external').table('company').get(r.row('company_id')).pluck('company_taxno', 'company_name_th', 'company_address_th'))
        .without('payment_detail', 'tags')
        .merge(function (row) {
            return {
                pay_date: row('pay_date').inTimezone("+07").toISO8601()//.split('T')(0)
            }
        })
        .run()
        .then(function (result) {
            // for (var i = 0; i < 5; i++) {
            //     result.push({});
            // }
            var count = result.length;
            for (var i = 0; i < (6 - count % 6); i++) {
                result.push({});
            }
            // console.log(result.length/6)
            parameters["PAGE"] = result.length / 6;
            // res.json(result);
            res.ireport("payment/report8.jasper", req.query.export || "pdf", result, parameters);
        });

}
exports.report10 = function (req, res, next) {
    var r = req.r;
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
    r.db('g2g2').table('fee_detail').getAll(req.params.id, { index: 'fee_id' }) //a557f317-e295-46d6-9d3a-45a0b4525f51
        .merge({ fee_det_id: r.row('id') }).without('id')
        .eqJoin('fee_id', r.db('g2g2').table('fee')).pluck('left', { right: 'fee_no' }).zip()
        .merge(function (inv_m) {
            return {
                invoice: inv_m('invoice')
                    .merge(function (inv_det_m) {
                        return {
                            invoice_detail: inv_det_m('invoice_detail')
                                .merge(function (shm_merge) {
                                    return r.db('g2g2').table('shipment_detail').get(shm_merge('shm_det_id')).pluck('price_per_ton', 'shm_det_quantity', 'type_rice_id', 'package_id')
                                })
                                .group(function (g) {
                                    return g.pluck('type_rice_id', 'package_id', 'price_per_ton')
                                })
                                .sum('shm_det_quantity')
                                .ungroup()
                                .merge(function (inv_det_merge) {
                                    return {
                                        package_id: inv_det_merge('group')('package_id'),
                                        price_per_ton: inv_det_merge('group')('price_per_ton'),
                                        type_rice_id: inv_det_merge('group')('type_rice_id'),
                                        quantity: inv_det_merge('reduction')
                                    }
                                })
                                .without('group', 'reduction')
                                .merge(function (inv_det_merge) {
                                    return {
                                        amount: inv_det_merge('price_per_ton').mul(inv_det_merge('quantity'))
                                    }
                                })
                        }
                    })
                    .merge(function (m) {
                        return {
                            sum_price: m('invoice_detail').sum('price_per_ton'),
                            sum_quantity: m('invoice_detail').sum('quantity'),
                            sum_amount: m('invoice_detail').sum('amount')
                        }
                    })
                    .merge(function (invoice_merge) {
                        return r.db('g2g2').table('invoice').get(invoice_merge('invoice_id')).pluck('invoice_no', 'invoice_date')
                    })

            }
        })
        .merge(function (m) {
            return {
                sum_value: m('invoice').sum('sum_amount')
            }
        })

        .merge(function (m) {
            return r.db('g2g2').table('confirm_letter')
                .filter(function (f) {
                    return r.expr(m('tags')).contains(f('id'))
                })(0).pluck('cl_no', 'contract_id')
        })
        .eqJoin('contract_id', r.db('g2g2').table('contract')).pluck("left", { right: "buyer_id" }).zip()
        .eqJoin('buyer_id', r.db('common').table('buyer')).pluck("left", { right: ["buyer_name", "country_id"] }).zip()
        .eqJoin('country_id', r.db('common').table('country')).pluck("left", { right: "country_name_th" }).zip()
        .merge(function (inv_m) {
            return {
                invoice: inv_m('invoice')

                    .merge(function (shm_merge) {
                        return {
                            sum_value: inv_m('sum_value')
                        }
                    })
            }
        })
        .run()
        .then(function (result) {
            var no = 1;
            for (var x = 0; x < result.length; x++) {
                for (var y = 0; y < result[x].invoice.length; y++) {
                    result[x].invoice[y].counter = no++;
                }
            }
            // res.json(result);
            res.ireport("payment/report10.jasper", req.query.export || "pdf", result, parameters);
        });

}
exports.report11 = function (req, res, next) {
    var r = req.r;
    var async = require('async');
    var year = parseInt(req.query.year);
    var month = parseInt(req.query.month);

    var arrMonths = ["", "มกราคม", 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    async.waterfall([
        function (callback) {
            r.db('g2g2').table('payment').getAll(req.query.contract_id, { index: 'tags' })
                .filter(function (f) {
                    return f('pay_date').year().eq(year).and(
                        f('pay_date').month().eq(month)
                    )
                })
                .merge({
                    pay_date: r.row('pay_date').inTimezone('+07').toISO8601(),
                    pay_year: r.row('pay_date').inTimezone('+07').year()
                })
                .eqJoin('exporter_id', r.db('external').table('exporter')).pluck("left", { right: 'company_id' }).zip()
                .eqJoin('company_id', r.db('external').table('company')).pluck("left", { right: 'company_name_th' }).zip()
                .pluck('company_name_th', 'runing_no', 'pay_year', 'pay_date', 'pay_full', 'pay_tax', 'pay_times')
                .orderBy('pay_times')
                .run()
                .then(function (result) {
                    callback(null, result);
                })

        },
        function (data, callback) {
            r.db('g2g2').table('contract').get(req.query.contract_id)
                .merge(function (m) {
                    return {
                        contract_year: m('contract_date').split('-')(0)
                    }
                })
                .merge(function (m) {
                    return r.db('common').table('buyer').get(m('buyer_id')).pluck('buyer_name')
                })
                .merge(function (m) {
                    return r.db('common').table('country').get(m('tags')(0)).pluck('country_name_th')
                })
                .run()
                .then(function (contract) {
                    callback(null, data, contract);
                })

        }
    ], function (err, data, contract) {
        var parameters = {
            CURRENT_DATE: new Date().toISOString().slice(0, 10),
            SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\',
            TITLE_MONTH: arrMonths[month],
            TITLE_YEAR: parseInt(year) + 543,
            COUNTRY_NAME: contract.country_name_th,
            CONTRACT_YEAR: parseInt(contract.contract_year) + 543,
            BUYER_NAME: contract.buyer_name
        };
        // res.json(parameters);
        res.ireport("payment/report11.jasper", req.query.export || "pdf", data, parameters);
    });

}
exports.test = function (req, res) {
    var r = req.r;
    r.db('g2g2').table('shipment_detail').getAll(('2e49a709-6c78-431d-bf0b-704a9d6a9b83'), { index: 'book_id' })
        .merge({ shm_det_id: r.row('id') }).without('id')
        .merge(function (m) {
            return r.db('g2g2').table('book').get(m('book_id')).without('id')
        })
        .merge(function (ship_merge) {
            return {
                ship: ship_merge('ship')
                    .merge(function (ship_name_merge) {
                        return r.db('common').table('ship').get(ship_name_merge('ship_id')).pluck('ship_name')//.without('id', 'surveyor')
                    })
                    .map(function (ship_name_merge) {
                        return ship_name_merge('ship_name').add(' V.', ship_name_merge('ship_voy_no'))
                    })
                    .reduce(function (left, right) {
                        return left.add(' / ', right)
                    }),
                port_name: r.db('common').table('port').get(ship_merge('dest_port_id')).getField('port_name')
            }
        })//.without('book_id')
        .merge(function (book_merge) {
            return {
                inv_id: r.db('g2g2').table('invoice')
                    .getAll(book_merge('book_id'), { index: 'book_id' })
                    .merge(function (inv_merge) {
                        return { invoice_id: inv_merge('id') }
                    })
                    .pluck('invoice_id')
                    .coerceTo('array')
                    .merge(function (inv_merge) {
                        return r.db('g2g2').table('fee_detail').filter(function (fee_det_filter) {
                            return fee_det_filter('invoice').contains(function (inv_contain) {
                                return inv_contain('invoice_id').eq(inv_merge('invoice_id'))
                            })
                        }).pluck('invoice', 'fee_foreign', 'fee_internal', 'fee_other', 'rate_bank', 'fee_id')(0)
                    })
                    .merge(function (inv_merge) {
                        return {
                            invoice_fee: ''
                        }
                    })

            }
        })
        .run()
        .then(function (data) {
            res.json(data);
        })
}