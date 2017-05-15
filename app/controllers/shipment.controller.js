exports.report1 = function (req, res, next) {
    var r = req.r;
    //res.json(__dirname.replace('controller','report'));
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10)
        // SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };

    r.db('g2g2').table('book')
        .get(req.params.book_id)
        .merge(function (row) {
            return r.db('g2g2').table('confirm_letter').get(row('cl_id')).pluck('cl_no', 'cl_type_rice', 'incoterms', 'contract_id')
        })
        .merge(function (row) {
            return r.db('g2g2').table('contract').get(row('contract_id')).pluck('buyer_id', 'contract_date', 'contract_name')
        })
        .merge(function (row) {
            return r.db('common').table('buyer').get(row('buyer_id')).without('id', 'date_created', 'date_updated', 'creater', 'updater')
        })
        .merge(function (row) {
            return r.db('common').table('country').get(row('country_id')).pluck('country_fullname_en', 'country_fullname_th', 'country_name_en', 'country_name_th')
        })
        .merge(function (row) {
            return {
                cl_no: row('cl_no').coerceTo('string'),
                book_id: row('id'),
                contract_year: row('contract_date').split('T')(0).split('-')(0).coerceTo('number').add(543),
                eta_date: row('eta_date').split('T')(0),
                ship: row('ship')
                    .merge(function (m1) {
                        return r.db('common').table('ship').get(m1('ship_id')).pluck('ship_name')
                    }).without('ship_id')
                    .map(function (m1) {
                        return m1('ship_name').add(" V.").add(m1('ship_voy_no'))
                    })
                    .reduce(function (l, r) {
                        return r.add("/ ").add(l)
                    }),
                surveyor_name: row('surveyor')
                    .map(function (m1) {
                        return r.db('common').table('surveyor').get(m1('surveyor_id')).pluck('surveyor_name')
                    }).without('surveyor_id')
                    .map(function (m1) {
                        return m1('surveyor_name')
                    })
                    .reduce(function (l, r) {
                        return r.add("/ ").add(l)
                    }),
                type_rice: r.db('g2g2').table('shipment_detail')
                    .getAll(row('id'), { index: 'book_id' })
                    .coerceTo('array')
                    .pluck(
                    'type_rice_id', 'shm_det_quantity'
                    )
                    .group('type_rice_id')
                    .sum("shm_det_quantity")
                    .ungroup()
                    .merge(function (m1) {
                        return {
                            type_rice_id: m1('group'),
                            type_rice_name_th: r.db('common').table('type_rice').get(m1('group')).getField('type_rice_name_th'),
                            type_rice_name_en: r.db('common').table('type_rice').get(m1('group')).getField('type_rice_name_en'),
                            weight_all: m1('reduction'),
                            weight_per_container: row('weight_per_container'),
                            num_of_container: r.db('g2g2').table('shipment_detail')
                                .getAll(row('id'), { index: 'book_id' })
                                .filter({
                                    type_rice_id: m1('group')
                                })
                                .sum('num_of_container'),
                            project: row('cl_type_rice')
                                .filter(function (tb) {
                                    return tb('type_rice_id').eq(m1('group'))
                                }).getField("project_en")(0),
                            package: r.db('g2g2').table('shipment_detail')
                                .getAll(row('id'), { index: 'book_id' })
                                .filter({ type_rice_id: m1('group') })
                                .pluck('package_id', 'price_per_ton', 'shm_det_quantity')
                                .coerceTo('array')
                                .merge(function (m2) {
                                    return r.db('common').table('package').get(m2('package_id')).pluck('package_name_th', 'package_name_en', 'package_weight_bag')
                                }),
                            incoterms: row('incoterms').getField('inct_id')
                                .reduce(function (left, right) {
                                    return left.add(', ', right)
                                })
                        }
                    })
                    .merge(function (m1) {
                        return {
                            incoterms: m1('package').map(function (m2) {
                                return m1('incoterms').add(' ตันละ ', m2('price_per_ton').coerceTo('string'), ' USD')
                            })
                                .reduce(function (l, r) {
                                    return l.add(' / ', r)
                                })
                        }
                    })
                    .without('group', 'reduction'),
                exporter: r.db('g2g2').table('shipment_detail')
                    .getAll(row('id'), { index: 'book_id' })
                    .coerceTo('array')
                    .pluck('exporter_id', 'shm_det_quantity')
                    .group('exporter_id')
                    .sum('shm_det_quantity')
                    .ungroup()
                    .map(function (m1) {
                        return {
                            exporter_name: r.db('external').table('exporter').get(m1('group')).getField('company_id')
                                .do(function (d1) {
                                    return r.db('external').table('company').get(d1).getField('company_name_th')
                                }),
                            weight: m1('reduction')
                        }
                    }),
                notify_name: r.db('common').table('notify_party').filter({
                    port_id: row('deli_port_id'),
                    buyer_id: row('buyer_id')
                }).getField('notify_name')(0),
                notify_address: r.db('common').table('notify_party').filter({
                    port_id: row('deli_port_id'),
                    buyer_id: row('buyer_id')
                }).getField('notify_address')(0),
                notify_tel: r.db('common').table('notify_party').filter({
                    port_id: row('deli_port_id'),
                    buyer_id: row('buyer_id')
                }).getField('notify_tel')(0),
                notify_fax: r.db('common').table('notify_party').filter({
                    port_id: row('deli_port_id'),
                    buyer_id: row('buyer_id')
                }).getField('notify_fax')(0),
                shipline_name: r.db('common').table('shipline').get(row('shipline_id')).getField('shipline_name'),
                shipline_tel: r.db('common').table('shipline').get(row('shipline_id')).getField('shipline_tel'),
                deli_port_name: r.db('common').table('port').get(row('deli_port_id')).getField('port_name'),
                dest_port_name: r.db('common').table('port').get(row('dest_port_id')).getField('port_name'),
                load_port_name: r.db('common').table('port').get(row('load_port_id')).getField('port_name'),
                product_date: row('product_date').split('T')(0),
                cut_of_date: row('cut_of_date').split('T')(0)

            }
        })
        .without('id', 'contract_date', 'cl_type_rice', 'date_created', 'date_updated', 'creater', 'updater')
        .without('book_id', 'book_status', 'buyer_id', 'carrier_id', 'cl_id', 'continent_id', 'contract_id', 'country_id')
        .without('shipline_id', 'surveyor', 'incoterms', 'tags')
        .run()
        .then(function (result) {
            // res.json(result);
            res.ireport("shipment/report1.jasper", req.query.export || "pdf", [result], parameters);
        });
}

exports.report2 = function (req, res, next) {
    var r = req.r;

    var parameters = {
        origin_page: req.query.ori,
        nn_page: req.query.nn,
        CURRENT_DATE: new Date().toISOString().slice(0, 10)
        // SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };

    r.db('g2g2').table('book')
        .get(req.params.book_id)
        .merge(function (row) {
            return r.db('g2g2').table('confirm_letter').get(row('cl_id')).pluck('cl_no', 'cl_type_rice', 'incoterms', 'contract_id')
        })
        .merge(function (row) {
            return r.db('g2g2').table('contract').get(row('contract_id')).pluck('buyer_id', 'contract_date', 'contract_name')
        })
        .merge(function (row) {
            return r.db('common').table('buyer').get(row('buyer_id')).without('id', 'date_created', 'date_updated', 'creater', 'updater')
        })
        // .merge(function (row) {
        //     return r.db('common').table('country').get(row('country_id')).pluck('country_fullname_en', 'country_fullname_th', 'country_name_en', 'country_name_th')
        // })
        .merge(function (row) {
            return {
                book_id: row('id'),
                ship: row('ship')
                    .merge(function (m1) {
                        return r.db('common').table('ship').get(m1('ship_id')).pluck('ship_name')
                    }).without('ship_id')
                    .map(function (m1) {
                        return m1('ship_name').add(" V.").add(m1('ship_voy_no'))
                    })
                    .reduce(function (l, r) {
                        return r.add("/ ").add(l)
                    }),
                surveyor_name: row('surveyor')
                    .merge(function (m1) {
                        return r.db('common').table('surveyor').get(m1('surveyor_id')).pluck('surveyor_name')
                    }).without('ship_id')
                    .map(function (m1) {
                        return m1('surveyor_name')
                    })
                    .reduce(function (l, r) {
                        return r.add("/ ").add(l)
                    }),

                type_rice: r.db('g2g2').table('shipment_detail')
                    .getAll(row('id'), { index: 'book_id' })
                    .coerceTo('array')
                    .pluck(
                    'type_rice_id', 'package_id', 'shm_det_quantity', 'price_per_ton'
                    )
                    .group(function (g1) {
                        return g1.pluck('type_rice_id', 'package_id', 'price_per_ton')
                    })
                    .sum("shm_det_quantity").ungroup()
                    .merge(function (m1) {
                        return {
                            type_rice_id: m1('group')('type_rice_id'),
                            package_id: m1('group')('package_id'),
                            price_per_ton: m1('group')('price_per_ton'),
                            incoterms: row('incoterms').getField('inct_id')
                                .reduce(function (left, right) {
                                    return left.add(', ', right)
                                }),
                            buyer_masks: row('buyer_masks'),
                            num_of_container: r.db('g2g2').table('shipment_detail')
                                .getAll(row('id'), { index: 'book_id' })
                                .filter({
                                    type_rice_id: m1('group')('type_rice_id'),
                                    package_id: m1('group')('package_id')
                                })
                                .sum('num_of_container'),
                            weight_per_container: row('weight_per_container'),
                            project: row('cl_type_rice')
                                .filter(function (tb) {
                                    return tb('type_rice_id').eq(m1('group')('type_rice_id'))
                                }).getField("project_en")(0),
                            weight_net: m1('reduction'),
                            type_rice_name_en: r.db('common').table('type_rice').get(m1('group')('type_rice_id')).getField('type_rice_name_en')

                        }
                    }).without('group', 'reduction')
                    .merge(function (m1) {
                        return r.db('common').table('package').get(m1('package_id')).pluck('package_name_en', 'package_kg_per_bag', 'package_weight_bag')
                    })
                    .merge(function (m1) {
                        return {
                            quantity_bags: m1('weight_net').mul(1000).div(m1('package_kg_per_bag'))
                        }
                    })
                    .merge(function (m1) {
                        return {
                            weight_gross: m1('quantity_bags').mul(m1('package_kg_per_bag').add(m1('package_weight_bag').div(1000)).div(1000))
                        }
                    })
                    .merge(function (m1) {
                        return {
                            weight_bags: m1('weight_gross').sub(m1('weight_net'))
                        }
                    })
                ,
                // exporter: r.db('g2g2').table('shipment_detail')
                //     .getAll(row('id'), { index: 'book_id' })
                //     .coerceTo('array')
                //     .pluck('exporter_id')
                //     .getField('exporter_id')
                //     .map(function (m1) {
                //         return r.db('external').table('exporter').get(m1).getField('company_id')
                //             .do(function (d1) {
                //                 // return r.db('external').table('trader').get(d1).getField('company_id')
                //                 //     .do(function (d2) {
                //                 return r.db('external').table('company').get(d1).getField('company_name_th')
                //                 // })
                //             })
                //     })
                //     .reduce(function (l, r) {
                //         return r.add("/ ").add(l)
                //     }),
                notify_name: r.db('common').table('notify_party').filter({
                    port_id: row('deli_port_id'),
                    buyer_id: row('buyer_id')
                }).getField('notify_name')(0),
                notify_address: r.db('common').table('notify_party').filter({
                    port_id: row('deli_port_id'),
                    buyer_id: row('buyer_id')
                }).getField('notify_address')(0),
                notify_tel: r.db('common').table('notify_party').filter({
                    port_id: row('deli_port_id'),
                    buyer_id: row('buyer_id')
                }).getField('notify_tel')(0),
                notify_fax: r.db('common').table('notify_party').filter({
                    port_id: row('deli_port_id'),
                    buyer_id: row('buyer_id')
                }).getField('notify_fax')(0)
            }
        })
        .merge(function (m) {
            return {
                shipline_name: r.db('common').table('shipline').get(m('shipline_id')).getField('shipline_name'),
                shipline_tel: r.db('common').table('shipline').get(m('shipline_id')).getField('shipline_tel'),
                deli_port_name: r.db('common').table('port').get(m('deli_port_id')).getField('port_name'),
                deli_country_id: r.db('common').table('port').get(m('deli_port_id')).getField('country_id'),
                dest_port_name: r.db('common').table('port').get(m('dest_port_id')).getField('port_name'),
                dest_country_id: r.db('common').table('port').get(m('dest_port_id')).getField('country_id'),
                load_port_name: r.db('common').table('port').get(m('load_port_id')).getField('port_name'),
                load_country_id: r.db('common').table('port').get(m('load_port_id')).getField('country_id'),
                product_date: m('product_date').split('T')(0),
                cut_of_date: m('cut_of_date').split('T')(0)
            }
        })
        .merge(function (m) {
            return {
                deli_country_fullname: r.db('common').table('country').get(m('deli_country_id')).getField('country_fullname_en'),
                dest_country_fullname: r.db('common').table('country').get(m('dest_country_id')).getField('country_fullname_en'),
                load_country_fullname: r.db('common').table('country').get(m('load_country_id')).getField('country_fullname_en'),
                deli_country_name: r.db('common').table('country').get(m('deli_country_id')).getField('country_name_en'),
                dest_country_name: r.db('common').table('country').get(m('dest_country_id')).getField('country_name_en'),
                load_country_name: r.db('common').table('country').get(m('load_country_id')).getField('country_name_en')
            }
        })
        .without('id', 'contract_date', 'cl_type_rice', 'date_created', 'date_updated', 'creater', 'updater')
        .without('incoterms', 'surveyor', 'tags')
        .run()
        .then(function (result) {
            // res.json(result);
            res.ireport("shipment/report2.jasper", req.query.export || "pdf", result, parameters);
        });
}

exports.report3 = function (req, res, next) {
    var r = req.r;
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10)
    };

    r.db('g2g2').table('shipment_detail')
        .getAll(r.args(req.query.book_id.split(',')), { index: 'book_id' })
        .coerceTo('array')
        .group('exporter_id')
        .ungroup()
        .map(function (expt_map) {
            return {
                exporter: r.db('external').table('exporter').get(expt_map('group')).getField('company_id')
                    .do(function (d1) {
                        return r.db('external').table('company').get(d1).getField('company_name_th')
                    }),
                ship: expt_map('reduction')
                    .group('book_id')
                    .sum('shm_det_quantity')
                    .ungroup()
                    .eqJoin('group', r.db('g2g2').table('book')).map(function (j_map) {
                        return {
                            book_id: j_map('left')('group'),
                            weight: j_map('left')('reduction'),
                            ship: j_map('right')('ship')
                                .map(function (m1) {
                                    return r.db('common').table('ship').get(m1('ship_id')).getField('ship_name')
                                        .add(" V.", m1('ship_voy_no'))
                                })
                                .reduce(function (l, r) {
                                    return r.add("/ ").add(l)
                                }),
                            ship_lot_no: j_map('right')('ship_lot_no'),
                            dest_port_name: r.db('common').table('port').get(j_map('right')('dest_port_id')).getField('port_name')
                        }
                    })
            }
        })
        .merge(function (expt_merge) {
            return {
                weight: expt_merge('ship').sum('weight'),
                ship_count: expt_merge('ship').count(),
                ship_lot_no: expt_merge('ship').getField('ship_lot_no')
                    .reduce(function (l, r) {
                        return l.add(', ', r)
                    }),
                cl_id: r.db('g2g2').table('book').get(expt_merge('ship')(0)('book_id')).getField('cl_id')
            }
        })
        .eqJoin('cl_id', r.db('g2g2').table('confirm_letter')).pluck("left", { right: ["cl_no", "contract_id"] }).zip()
        .eqJoin('contract_id', r.db('g2g2').table('contract')).pluck("left", { right: ["contract_name", "buyer_id"] }).zip()
        .eqJoin('buyer_id', r.db('common').table('buyer')).pluck("left", { right: 'country_id' }).zip()
        .eqJoin('country_id', r.db('common').table('country')).pluck("left", { right: 'country_fullname_th' }).zip()
        .run()
        .then(function (result) {
            // res.json(result);
            res.ireport("shipment/report3.jasper", req.query.export || "pdf", result, parameters);
        })
        .error(function (err) {
            res.json(err)
        })

}
exports.report3_1 = function (req, res, next) {
    var r = req.r;
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
    // console.log('>',req.params)
    r.db('g2g2').table('shipment_detail').getAll((req.params.id), { index: 'book_id' })
        //.get(req.params.id)
        .merge({ shm_det_id: r.row('id') }).without('id')
        .eqJoin('book_id', r.db('g2g2').table('book')).without({ right: ['id'] }).zip()
        // .merge(function (m) {
        //     return r.db('g2g2').table('book').get(m('book_id')).without('id')
        // })
        .merge(function (ship_merge) {
            return {
                ship: ship_merge('ship')
                    .eqJoin('ship_id', r.db('common').table('ship')).pluck("left", { right: ['ship_name'] }).zip()
                    // .merge(function (ship_name_merge) {
                    //     return r.db('common').table('ship').get(ship_name_merge('ship_id')).pluck('ship_name')//.without('id', 'surveyor')
                    // })
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
                    })(0)
            }
        })
        .merge(function (inv_merge) {
            return inv_merge('inv_id')
        })
        .without('inv_id')
        .merge(function (inv_fee) {
            return {
                invoice_fee: inv_fee('invoice')
                    .filter(function (f) {
                        return f('invoice_id').eq(inv_fee('invoice_id'))
                    })(0)
                    ('invoice_detail').filter(function (f) {
                        return f('shm_det_id').eq(inv_fee('shm_det_id'))
                    })(0)
                    ('invoice_fee')
            }
        })
        .without('invoice', 'surveyor', 'tags')
        .merge(function (type_rice_merge) {
            return {
                type_rice_name: r.db('common').table('type_rice').get(type_rice_merge('type_rice_id')).getField('type_rice_name_th'),
                amount_of_rice: (type_rice_merge('shm_det_quantity')).mul(type_rice_merge('price_per_ton')),
                exporter_name: r.db('external').table('exporter').get(type_rice_merge('exporter_id')).getField('company_id')
                    .do(function (company) {
                        return r.db('external').table('company').get(company).getField('company_name_th')
                    })
            }
        })
        .eqJoin('fee_id', r.db('g2g2').table('fee')).pluck('left', { right: 'fee_no' }).zip()
        .merge(function (m1) {
            return r.db('g2g2').table("confirm_letter").get(m1('cl_id')).pluck("contract_id")
        })
        .merge(function (buyer_merge) {
            return {
                country_name: r.db('g2g2').table('contract').get(buyer_merge('contract_id')).getField('buyer_id')
                    .do(function (buyer) {
                        return r.db('common').table('buyer').get(buyer).getField('country_id')
                            .do(function (country) {
                                return r.db('common').table('country').get(country).getField('country_fullname_th')
                            })
                    }),
                buyer_name: r.db('g2g2').table('contract').get(buyer_merge('contract_id')).getField('buyer_id')
                    .do(function (buyer_name) {
                        return r.db('common').table('buyer').get(buyer_name).getField('buyer_name')
                    })
            }
        })
        .merge(function (sum_merge) {
            return {
                sum_rate_bank: ((sum_merge('rate_bank')).mul(sum_merge('amount_of_rice'))).sub(sum_merge('invoice_fee'))
            }
        })
        .merge(function (sum_merge) {
            return {
                sum_bath: ((sum_merge('rate_bank')).mul(sum_merge('amount_of_rice')))
            }
        })
        .merge(function (mul_merge) {
            return {
                sum_tax: mul_merge('sum_rate_bank').mul(0.01)
            }
        })
        .merge(function (sub_merge) {
            return {
                balance: sub_merge('sum_rate_bank').sub(sub_merge('sum_tax'))
            }
        })
        .eqJoin('cl_id', r.db('g2g2').table('confirm_letter')).pluck('left', { right: 'cl_no' }).zip()
        .run()
        .then(function (result) {
            // res.json(result);
            res.ireport("shipment/report3_1.jasper", req.query.export || "pdf", result, parameters);
        });

}
exports.report3_2 = function (req, res, next) {
    var r = req.r;
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
    r.db('g2g2').table('shipment_detail').getAll((req.params.id), { index: 'book_id' })
        //.get(req.params.id)
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
                    })(0)
            }
        })
        .merge(function (inv_merge) {
            return inv_merge('inv_id')
        })
        .without('inv_id')
        .merge(function (inv_fee) {
            return {
                invoice_fee: inv_fee('invoice')
                    .filter(function (f) {
                        return f('invoice_id').eq(inv_fee('invoice_id'))
                    })(0)
                    ('invoice_detail').filter(function (f) {
                        return f('shm_det_id').eq(inv_fee('shm_det_id'))
                    })(0)
                    ('invoice_fee')
            }
        })
        .without('invoice', 'surveyor', 'tags')
        .merge(function (type_rice_merge) {
            return {
                type_rice_name: r.db('common').table('type_rice').get(type_rice_merge('type_rice_id')).getField('type_rice_name_th'),
                amount_of_rice: (type_rice_merge('shm_det_quantity')).mul(type_rice_merge('price_per_ton')),
                company_name: r.db('external').table('exporter').get(type_rice_merge('exporter_id')).getField('company_id')
                    .do(function (company) {
                        return r.db('external').table('company').get(company).getField('company_name_th')
                    })
            }
        })
        .eqJoin('fee_id', r.db('g2g2').table('fee')).pluck('left', { right: 'fee_no' }).zip()
        .merge(function (m1) {
            return r.db('g2g2').table("confirm_letter").get(m1('cl_id')).pluck("contract_id")
        })
        .merge(function (buyer_merge) {
            return {
                country_name: r.db('g2g2').table('contract').get(buyer_merge('contract_id')).getField('buyer_id')
                    .do(function (buyer) {
                        return r.db('common').table('buyer').get(buyer).getField('country_id')
                            .do(function (country) {
                                return r.db('common').table('country').get(country).getField('country_fullname_th')
                            })
                    }),
                buyer_name: r.db('g2g2').table('contract').get(buyer_merge('contract_id')).getField('buyer_id')
                    .do(function (buyer_name) {
                        return r.db('common').table('buyer').get(buyer_name).getField('buyer_name')
                    })
            }
        })
        .merge(function (sum_merge) {
            return {
                sum_rate_bank: ((sum_merge('rate_bank')).mul(sum_merge('amount_of_rice'))).sub(sum_merge('invoice_fee'))
            }
        })
        .merge(function (sum_merge) {
            return {
                sum_bath: ((sum_merge('rate_bank')).mul(sum_merge('amount_of_rice')))
            }
        })
        .merge(function (mul_merge) {
            return {
                sum_tax: mul_merge('sum_rate_bank').mul(0.01)
            }
        })
        .merge(function (sub_merge) {
            return {
                balance: sub_merge('sum_rate_bank').sub(sub_merge('sum_tax'))
            }
        })
        .eqJoin('cl_id', r.db('g2g2').table('confirm_letter')).pluck('left', { right: 'cl_no' }).zip()
        .run()
        .then(function (result) {
            // res.json(result);
            res.ireport("shipment/report3_2.jasper", req.query.export || "pdf", result, parameters);
        });

}
exports.report4 = function (req, res, next) {
    var r = req.r;
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        // SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };

    r.db('g2g2').table('book').getAll(req.params.cl_id, { index: 'cl_id' })
        .filter({ book_status: true })
        .eqJoin('cl_id', r.db('g2g2').table('confirm_letter')).pluck({ right: ["cl_type_rice", "contract_id", "cl_no"] }, "left").zip()
        .merge(function (m) {
            return {
                book_id: m('id'),
                shipment_detail: r.db('g2g2').table('shipment_detail').getAll(m('id'), { index: 'book_id' }).coerceTo('array')
                    .merge(function (m1) {
                        return {
                            exporter_name: r.db('external').table('exporter').get(m1('exporter_id')).getField('company_id')
                                .do(function (d1) {
                                    // return r.db('external').table('trader').get(d1).getField('company_id')
                                    //     .do(function (d2) {
                                    return r.db('external').table('company').get(d1).getField('company_name_th')
                                    // })
                                }),
                            type_rice_name: r.db('common').table('type_rice').get(m1('type_rice_id')).getField('type_rice_name_en'),
                            package_name: r.db('common').table('package').get(m1('package_id')).getField('package_kg_per_bag').coerceTo('string').add('KG'),
                            // price_per_ton: m('cl_type_rice')
                            //     .filter(function (tb) {
                            //         return tb('type_rice_id').eq(m1('type_rice_id'))
                            //     }).getField("package")(0)
                            //     .filter(function (f) {
                            //         return f('package_id').eq(m1('package_id'))
                            //     })(0)
                            //     .pluck('price_per_ton')
                            //     .values()(0)
                        }
                    })
                    .merge(function (m1) {
                        return {
                            values_usd: m1('price_per_ton').mul(m1('shm_det_quantity'))
                        }
                    })
                    .without('tags', 'updater', 'creater', 'date_created', 'date_updated'),
                ship: m('ship')
                    .merge(function (m1) {
                        return r.db('common').table('ship').get(m1('ship_id')).pluck('ship_name')
                    }).without('ship_id')
                    .map(function (m1) {
                        return m1('ship_name').add(" V.").add(m1('ship_voy_no'))
                    })
                    .reduce(function (l, r) {
                        return r.add("/ ").add(l)
                    }),
                shipline_name: r.db('common').table('shipline').get(m('shipline_id')).getField('shipline_name'),
                dest_port_name: r.db('common').table('port').get(m('dest_port_id')).getField('port_name'),
                dest_country_id: r.db('common').table('port').get(m('dest_port_id')).getField('country_id'),
                load_port_name: r.db('common').table('port').get(m('load_port_id')).getField('port_name'),
                load_country_id: r.db('common').table('port').get(m('load_port_id')).getField('country_id')
            }
        })
        .merge(function (m) {
            return {
                values_usd: m('shipment_detail').sum('values_usd'),
                dest_country_name: r.db('common').table('country').get(m('dest_country_id')).getField('country_name_en'),
                load_country_name: r.db('common').table('country').get(m('load_country_id')).getField('country_name_en'),
                type_rice_quantity: m('cl_type_rice').sum('type_rice_quantity')
            }
        })
        .eqJoin('contract_id', r.db('g2g2').table('contract')).pluck({ right: "buyer_id" }, "left").zip()
        .eqJoin('buyer_id', r.db('common').table('buyer')).pluck({ right: "buyer_masks" }, "left").zip()
        .merge({ invoice_no: r.db('g2g2').table('invoice').getAll(r.row('book_id'), { index: 'book_id' })(0)('invoice_no') })
        .without('id', 'cl_type_rice', 'tags', 'surveyor', 'updater', 'creater', 'date_created', 'date_updated')
        .orderBy([r.row('ship_lot_no').coerceTo('number'), r.row('invoice_no')])
        .run()
        .then(function (result) {
            // res.json(result)
            res.ireport("shipment/report4.jasper", req.query.export || "pdf", result, parameters);
        })
        .error(function (err) {
            res.json(err)
        })
}