var rpt = require('../global/report');
exports.report1 = function (req, res, next) {
    var r = req.r;
    var query = req.query;
    //res.json(__dirname.replace('controller','report'));
    var params = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10)
        // SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };

    var book = r.db('g2g').table('book').get(query.id).pluck('book_no', 'book_remark', 'cl_id', 'cl_no', 'contract_id', 'cut_date', 'cut_time', 'deli_port', 'dest_port', 'id', 'load_port',
        'notify_party', 'product_date', 'ship', 'ship_lot', 'shipline', 'surveyor', 'weight_container', 'etd_date')
    book.merge(function (m) {
        var ship = book.getField('ship');
        var surveyor = book.getField('surveyor');
        var detail = r.db('g2g').table('book_detail').getAll(m('id'), { index: 'book_id' }).coerceTo('array');
        var confirm = r.db('g2g').table('confirm_letter').get(m('cl_id')).getField('incoterms');
        var contract = r.db('g2g').table('contract').get(m('contract_id')).pluck('buyer_id', 'buyer', 'contract_date', 'contract_name', 'country');
        return contract.merge({
            contract_date: contract('contract_date').year().add(543),
            book_no: detail.getField('book_no').reduce(function (left, right) {
                return left.add(', ', right)
            }),
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
                        hamonize_th2: map('reduction')(0)('hamonize')('hamonize_th2'),
                        hamonize_en2: map('reduction')(0)('hamonize')('hamonize_en2').upcase(),
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
                    company_name: mapExporter('reduction')(0)('company')('company_name_th'),
                    company_count:detail.group('exporter_id').ungroup().count()
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
            params.COUNTRY = result.country.country_fullname_th;
            params.CL_NO = result.cl_no;
            params.YEAR = result.contract_date;
            params.SHIP_LOT = result.ship_lot;
            params.REMARK = result.book_remark;
            params.FONTSIZE = parseInt(req.query.size);
            res.ireport("rice/report1.jasper", req.query.export || "pdf", [result], params);
        });
}
exports.report2 = function (req, res, next) {
    var r = req.r;
    var query = req.query;

    var params = {
        origin_page: req.query.ori,
        nn_page: req.query.nn,
        CURRENT_DATE: new Date().toISOString().slice(0, 10)
    };

    var book = r.db('g2g').table('book').get(query.id)
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
                            hamonize_en2: map2('reduction')(0)('hamonize')('hamonize_en2'),
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
            res.ireport("rice/report2.jasper", req.query.export || "pdf", result, params);
        });
}
exports.report3 = function (req, res, next) {
    var r = req.r;
    var query = req.query;
    var params = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10)
    };

    r.db('g2g').table('book_detail').getAll(r.args(query.id.split(',')), { index: 'book_id' })
        .eqJoin('contract_id', r.db('g2g').table('contract')).pluck('left', { right: ['contract_no', 'country'] }).zip()
        .group('exporter_id')
        .ungroup()
        .map(function (m) {
            var book = m('reduction').group('book_id').sum('net_weight').ungroup();
            var book2 = book.eqJoin('group', r.db('g2g').table('book')).pluck('left', { right: ['ship', 'dest_port', 'ship_lot', 'cl_no'] }).zip();
            return {
                exporter_id: m('group'),
                company_name_th: m('reduction')(0)('company')('company_name_th'),
                country_fullname_th: m('reduction')(0)('country')('country_fullname_th'),
                contract_no: m('reduction')(0)('contract_no'),
                book: book2
                    .merge(function (m2) {
                        var ship = m2('ship');
                        return {
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
                            weight: m2('reduction')
                        }
                    }),
                ship_count: book.count(),
                net_weight: book.sum('reduction'),
                cl_no: book2.getField('cl_no')(0),
                ship_lot: book2.getField('ship_lot')(0)
            }
        })
        .run()
        .then(function (result) {
            // res.json(result);
            res.ireport("rice/report3.jasper", req.query.export || "pdf", result, params);
        })
        .error(function (err) {
            res.json(err)
        })

}
exports.report3_1 = function (req, res, next) {
    var r = req.r;
    var query = req.query;
    var params = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
    // console.log('>',req.params)
    r.db('g2g').table('book_detail').getAll((query.book_id), { index: 'book_id' })
        // //.get(req.params.id)
        // .merge({ shm_det_id: r.row('id') }).without('id')
        // .eqJoin('book_id', r.db('g2g2').table('book')).without({ right: ['id'] }).zip()
        // .merge(function (m) {
        //     return r.db('g2g2').table('book').get(m('book_id')).without('id')
        // })
        // .merge(function (ship_merge) {
        //     return {
        //         ship: ship_merge('ship')
        //             .eqJoin('ship_id', r.db('common').table('ship')).pluck("left", { right: ['ship_name'] }).zip()
        //             // .merge(function (ship_name_merge) {
        //             //     return r.db('common').table('ship').get(ship_name_merge('ship_id')).pluck('ship_name')//.without('id', 'surveyor')
        //             // })
        //             .map(function (ship_name_merge) {
        //                 return ship_name_merge('ship_name').add(' V.', ship_name_merge('ship_voy_no'))
        //             })
        //             .reduce(function (left, right) {
        //                 return left.add(' / ', right)
        //             }),
        //         port_name: r.db('common').table('port').get(ship_merge('dest_port_id')).getField('port_name')
        //     }
        // })//.without('book_id')
        // .merge(function (book_merge) {
        //     return {
        //         inv_id: r.db('g2g2').table('invoice')
        //             .getAll(book_merge('book_id'), { index: 'book_id' })
        //             .merge(function (inv_merge) {
        //                 return { invoice_id: inv_merge('id') }
        //             })
        //             .pluck('invoice_id')
        //             .coerceTo('array')
        //             .merge(function (inv_merge) {
        //                 return r.db('g2g2').table('fee_detail').filter(function (fee_det_filter) {
        //                     return fee_det_filter('invoice').contains(function (inv_contain) {
        //                         return inv_contain('invoice_id').eq(inv_merge('invoice_id'))
        //                     })
        //                 }).pluck('invoice', 'fee_foreign', 'fee_internal', 'fee_other', 'rate_bank', 'fee_id')(0)
        //             })(0)
        //     }
        // })
        // .merge(function (inv_merge) {
        //     return inv_merge('inv_id')
        // })
        // .without('inv_id')
        // .merge(function (inv_fee) {
        //     return {
        //         invoice_fee: inv_fee('invoice')
        //             .filter(function (f) {
        //                 return f('invoice_id').eq(inv_fee('invoice_id'))
        //             })(0)
        //             ('invoice_detail').filter(function (f) {
        //                 return f('shm_det_id').eq(inv_fee('shm_det_id'))
        //             })(0)
        //             ('invoice_fee')
        //     }
        // })
        // .without('invoice', 'surveyor', 'tags')
        // .merge(function (type_rice_merge) {
        //     return {
        //         type_rice_name: r.db('common').table('type_rice').get(type_rice_merge('type_rice_id')).getField('type_rice_name_th'),
        //         amount_of_rice: (type_rice_merge('shm_det_quantity')).mul(type_rice_merge('price_per_ton')),
        //         exporter_name: r.db('external').table('exporter').get(type_rice_merge('exporter_id')).getField('company_id')
        //             .do(function (company) {
        //                 return r.db('external').table('company').get(company).getField('company_name_th')
        //             })
        //     }
        // })
        // .eqJoin('fee_id', r.db('g2g2').table('fee')).pluck('left', { right: 'fee_no' }).zip()
        // .merge(function (m1) {
        //     return r.db('g2g2').table("confirm_letter").get(m1('cl_id')).pluck("contract_id")
        // })
        // .merge(function (buyer_merge) {
        //     return {
        //         country_name: r.db('g2g2').table('contract').get(buyer_merge('contract_id')).getField('buyer_id')
        //             .do(function (buyer) {
        //                 return r.db('common').table('buyer').get(buyer).getField('country_id')
        //                     .do(function (country) {
        //                         return r.db('common').table('country').get(country).getField('country_fullname_th')
        //                     })
        //             }),
        //         buyer_name: r.db('g2g2').table('contract').get(buyer_merge('contract_id')).getField('buyer_id')
        //             .do(function (buyer_name) {
        //                 return r.db('common').table('buyer').get(buyer_name).getField('buyer_name')
        //             })
        //     }
        // })
        // .merge(function (sum_merge) {
        //     return {
        //         sum_rate_bank: ((sum_merge('rate_bank')).mul(sum_merge('amount_of_rice'))).sub(sum_merge('invoice_fee'))
        //     }
        // })
        // .merge(function (sum_merge) {
        //     return {
        //         sum_bath: ((sum_merge('rate_bank')).mul(sum_merge('amount_of_rice')))
        //     }
        // })
        // .merge(function (mul_merge) {
        //     return {
        //         sum_tax: mul_merge('sum_rate_bank').mul(0.01)
        //     }
        // })
        // .merge(function (sub_merge) {
        //     return {
        //         balance: sub_merge('sum_rate_bank').sub(sub_merge('sum_tax'))
        //     }
        // })
        // .eqJoin('cl_id', r.db('g2g2').table('confirm_letter')).pluck('left', { right: 'cl_no' }).zip()
        .run()
        .then(function (result) {
            res.json(result);
            res.ireport("rice/report3_1.jasper", req.query.export || "pdf", result, params);
        });

}
exports.report3_2 = function (req, res, next) {
    var r = req.r;
    var params = {
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
            res.ireport("shipment/report3_2.jasper", req.query.export || "pdf", result, params);
        });

}
exports.report4 = function (req, res, next) {
    var r = req.r;
    var query = req.query;
    var cl = r.db('g2g').table('confirm_letter').get(query.id).pluck('cl_no', 'cl_weight');
    var book = r.db('g2g').table('book').getAll(query.id, { index: 'cl_id' }).pluck('cl_id', 'invoice_no', 'invoice_type', 'invoice_year', 'id', 'book_no', 'bl_no', 'product_date', 'packing_date'
        , 'shipline', 'ship', 'load_port', 'dest_port', 'eta_date', 'etd_date', 'cut_date', 'value_d', 'contract_id', 'ship_lot');
    // .eqJoin('contract_id', r.db('g2g').table('contract')).pluck('left', { right: 'buyer' }).zip()
    // .limit(10);

    r.expr({
        param: cl,
        data: book.coerceTo('array')
            .merge(function (m) {
                var ship = m('ship');
                return {
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
                    detail: r.db('g2g').table('book_detail').getAll(m('id'), { index: 'book_id' }).coerceTo('array')
                        .eqJoin('contract_id', r.db('g2g').table('contract')).pluck('left', { right: 'buyer' }).zip(),
                    cut_date: m('cut_date').inTimezone('+07').toISO8601().split('T')(0),
                    eta_date: m('eta_date').inTimezone('+07').toISO8601().split('T')(0),
                    etd_date: m('etd_date').inTimezone('+07').toISO8601().split('T')(0),
                    packing_date: m('packing_date').inTimezone('+07').toISO8601().split('T')(0),
                    product_date: m('product_date').inTimezone('+07').toISO8601().split('T')(0),
                }
            }).orderBy('ship_lot')
    })
        .run()
        .then(function (result) {
            // res.json(result)
            var params = result.param;
            params.current_date = new Date().toISOString().slice(0, 10);
            params = rpt.keysToUpper(params);
            // res.json(params)
            res.ireport("rice/report4.jasper", req.query.export || "pdf", result['data'], params);
        })
        .error(function (err) {
            res.json(err)
        })
}