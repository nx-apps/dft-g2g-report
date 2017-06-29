exports.report1 = function (req, res, next) {
    var r = req.r;
    var query = req.query;
    //res.json(__dirname.replace('controller','report'));
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10)
        // SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };

    var book = r.db('g2g').table('book').get(query.book_id).pluck('book_no', 'book_remark', 'cl_id', 'cl_no', 'contract_id', 'cut_date', 'cut_time', 'deli_port', 'dest_port', 'id', 'load_port',
        'notify_party', 'product_date', 'ship', 'ship_lot', 'shipline', 'surveyor', 'weight_container', 'etd_date')
    book.merge(function (m) {
        var ship = book.getField('ship');
        var surveyor = book.getField('surveyor');
        var detail = r.db('g2g').table('book_detail').getAll(m('id'), { index: 'book_id' }).coerceTo('array');
        var confirm = r.db('g2g').table('confirm_letter').get(m('cl_id')).getField('incoterms');
        var contract = r.db('g2g').table('contract').get(m('contract_id')).pluck('buyer_id', 'buyer', 'contract_date', 'contract_name', 'country');
        return contract.merge({
            contract_date: contract('contract_date').year().add(543),
            ship: r.branch(ship.count().gt(1),
                ship.reduce(function (left, right) {
                    return r.branch(left.hasFields('data'),
                        {
                            data: left('data').add(', ', right('ship_name'), ' V.', right('ship_voy'))
                        },
                        {
                            data: left('ship_name').add(" V.", left('ship_voy'), ', ', right('ship_name'), ' V.', right('ship_voy'))
                        }
                    )
                })('data'),
                ship(0)('ship_name').add(" V.", ship(0)('ship_voy'))
            ),
            surveyor: r.branch(surveyor.count().gt(1),
                surveyor.reduce(function (left, right) {
                    return r.branch(left.hasFields('data'),
                        {
                            data: left('data').add(', ', right('surveyor_name'))
                        },
                        {
                            data: left('surveyor_name').add(', ', right('surveyor_name'))
                        }
                    )
                })('data'),
                surveyor(0)('surveyor_name')
            ),
            hamonize: detail.group('hamonize_id').ungroup()
                .map(function (map) {
                    var pack = map('reduction').group('package_id').ungroup().getField('reduction');
                    return {
                        weight_container: m('weight_container'),
                        hamonize_th: map('reduction')(0)('hamonize')('hamonize_th'),
                        hamonize_en: map('reduction')(0)('hamonize')('hamonize_en').upcase(),
                        project_en: map('reduction')(0)('project_en'),
                        net_weight: map('reduction').sum('net_weight'),
                        num_of_container: map('reduction').sum('num_of_container'),
                        price: pack.map(function (map2) {
                            return {
                                inct_id: r.branch(confirm.count().gt(1),
                                    confirm.reduce(function (left, right) {
                                        return r.branch(left.hasFields('data'),
                                            { data: left('data').add(', ', right('inct_id')) },
                                            { data: left('inct_id').add(', ', right('inct_id')) }
                                        )
                                    })('data'),
                                    confirm(0)('inct_id')
                                ),
                                price_d: map2(0)('price_d')
                            }
                        }),
                        package: pack.map(function (map2) {
                            return {
                                package_kg_per_bag: map2(0)('package')('package_kg_per_bag'),
                                package_weight_bag: map2(0)('package')('package_weight_bag')
                            }
                        })
                    }
                }),
            exporter: detail.group('exporter_id').ungroup().map(function (mapExporter) {
                return {
                    net_weight: mapExporter('reduction').sum('net_weight'),
                    company_name: mapExporter('reduction')(0)('company')('company_name_th')
                }
            }),
            cut_date: m('cut_date').inTimezone('+07').toISO8601(),
            etd_date: m('etd_date').inTimezone('+07').toISO8601(),
            product_date: m('product_date').inTimezone('+07').toISO8601().split('T')(0),
        })
    })
        .run()
        .then(function (result) {
            // res.json(result);
            parameters.COUNTRY = result.country.country_fullname_th;
            parameters.CL_NO = result.cl_no;
            parameters.YEAR = result.contract_date;
            parameters.SHIP_LOT = result.ship_lot;
            parameters.REMARK = result.book_remark;
            res.ireport("rice/report1.jasper", req.query.export || "pdf", [result], parameters);
        });
}

exports.report2 = function (req, res, next) {
    var r = req.r;
    var query = req.query;

    var parameters = {
        origin_page: req.query.ori,
        nn_page: req.query.nn,
        CURRENT_DATE: new Date().toISOString().slice(0, 10)
    };

    var book = r.db('g2g').table('book').get(query.book_id)
    book.merge(function (m) {
        var ship = book.getField('ship');
        var detail = r.db('g2g').table('book_detail').getAll(m('id'), { index: 'book_id' }).coerceTo('array');
        var contract = r.db('g2g').table('contract').get(m('contract_id')).pluck('buyer')
        return contract
            .merge({
                ship: r.branch(ship.count().gt(1),
                    ship.reduce(function (left, right) {
                        return r.branch(left.hasFields('data'),
                            {
                                data: left('data').add(' / ', right('ship_name'), ' V.', right('ship_voy'))
                            },
                            {
                                data: left('ship_name').add(" V.", left('ship_voy'), ' / ', right('ship_name'), ' V.', right('ship_voy'))
                            }
                        )
                    })('data'),
                    ship(0)('ship_name').add(" V.", ship(0)('ship_voy'))
                ),
                hamonize: detail.group('hamonize_id', 'package_id').ungroup()
                    .map(function (map2) {
                        return {
                            hamonize_en: map2('reduction')(0)('hamonize')('hamonize_en'),
                            project_en: map2('reduction')(0)('project_en'),
                            gross_weight: map2('reduction').sum('gross_weight'),
                            net_weight: map2('reduction').sum('net_weight'),
                            package_amount: map2('reduction').sum('package_amount'),
                            package_name_en: map2('reduction')(0)('package')('package_name_en'),
                            package_weight_bag: map2('reduction')(0)('package')('package_weight_bag'),
                            buyer_masks: contract('buyer')('buyer_masks')
                        }
                    })
            })
    })
        .run()
        .then(function (result) {
            // res.json(result);
            res.ireport("rice/report2.jasper", req.query.export || "pdf", result, parameters);
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
                    .eqJoin('exporter_id', r.db('external').table('exporter')).pluck("left", { right: "company_id" }).zip()
                    .eqJoin('company_id', r.db('external').table('company')).pluck("left", { right: "company_name_th" }).zip()
                    .eqJoin('type_rice_id', r.db('common').table('type_rice')).pluck("left", { right: "type_rice_sub_en" }).zip()
                    .eqJoin('package_id', r.db('common').table('package')).pluck("left", { right: "package_kg_per_bag" }).zip()
                    // .merge(function (m1) {
                    //     return {
                    //         exporter_name: r.db('external').table('exporter').get(m1('exporter_id')).getField('company_id')
                    //             .do(function (d1) {
                    //                 // return r.db('external').table('trader').get(d1).getField('company_id')
                    //                 //     .do(function (d2) {
                    //                 return r.db('external').table('company').get(d1).getField('company_name_th')
                    //                 // })
                    //             }),
                    //         type_rice_name: r.db('common').table('type_rice').get(m1('type_rice_id')).getField('type_rice_name_en'),
                    //         package_name: r.db('common').table('package').get(m1('package_id')).getField('package_kg_per_bag').coerceTo('string').add('KG')
                    //     }
                    // })
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
                // shipline_name: r.db('common').table('shipline').get(m('shipline_id')).getField('shipline_name'),
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
        .eqJoin('shipline_id', r.db('common').table('shipline')).pluck("left", { right: 'shipline_name' }).zip()
        .eqJoin('contract_id', r.db('g2g2').table('contract')).pluck({ right: "buyer_id" }, "left").zip()
        .eqJoin('buyer_id', r.db('common').table('buyer')).pluck({ right: "buyer_masks" }, "left").zip()
        .merge({ invoice_no: r.db('g2g2').table('invoice').getAll(r.row('book_id'), { index: 'book_id' })(0)('invoice_no') })
        .without('id', 'cl_type_rice', 'tags', 'surveyor', 'updater', 'creater', 'date_created', 'date_updated')
        .orderBy([r.row('ship_lot_no').coerceTo('number'), r.row('invoice_no')])
        .run()
        .then(function (result) {
            res.json(result)
            // res.ireport("shipment/report4.jasper", req.query.export || "pdf", result, parameters);
        })
        .error(function (err) {
            res.json(err)
        })
}