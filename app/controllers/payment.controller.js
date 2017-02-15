exports.report1 = function (req, res, next) {
    var r = req._r;
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
    r.db('g2g').table('invoice')
        .get(req.query.invoice_id)
        .merge(function (m) {
            return r.db('g2g').table('book')
                .get(m('book_id'))
                .merge(function (m1) {
                    return r.db('g2g').table("shipment").get(m1('shm_id')).pluck('cl_id')
                    //.without("id", "date_created", "date_updated", "creater", "updater")
                })
                .merge(function (m1) {
                    return r.db('g2g').table("confirm_letter").get(m1('cl_id')).pluck("cl_type_rice", "contract_id", "cl_date", "inct_id")
                    //.without("id", "date_created", "date_updated", "creater", "updater")
                })
                .merge(function (m1) {
                    return r.db('g2g').table("contract").get(m1('contract_id')).pluck("contract_date", "contract_name", "buyer_id")
                    //.without("id", "date_created", "date_updated", "creater", "updater", "contract_type_rice")
                })
                .merge(function (me) {
                    return {
                        bl_detail: r.db('g2g').table('shipment_detail')
                            .getAll(me('book_id'), { index: 'book_id' })
                            .group(function (g) {
                                return g.pluck(
                                    "type_rice_id", "package_id"
                                )
                            })
                            .sum("shm_det_quantity")
                            .ungroup()
                            .merge(function (me2) {
                                return {
                                    type_rice_id: me2('group')('type_rice_id'),
                                    package_id: me2('group')('package_id'),
                                    quantity_tons: me2('reduction'),
                                    project_en: me('cl_type_rice')
                                        .filter(function (tb) {
                                            return tb('type_rice_id').eq(me2('group')('type_rice_id'))
                                        }).getField("project_en")(0),
                                    description_en: me('cl_type_rice')
                                        .filter(function (tb) {
                                            return tb('type_rice_id').eq(me2('group')('type_rice_id'))
                                        }).getField("description_en")(0),
                                    price_per_ton: me('cl_type_rice')
                                        .filter(function (tb) {
                                            return tb('type_rice_id').eq(me2('group')('type_rice_id'))
                                        }).getField("package")(0)
                                        .filter(function (f) {
                                            return f('package_id').eq(me2('group')('package_id'))
                                        })(0)
                                        .pluck('price_per_ton')
                                        .values()(0)
                                }
                            })
                            .without("group", "reduction")
                            .eqJoin("package_id", r.db('common').table("package")).without({ right: ["id", "date_created", "date_updated", "creater", "updater"] }).zip()
                            .merge(function (me2) {
                                return {
                                    quantity_bags: me2('quantity_tons').mul(1000).div(me2('package_kg_per_bag'))
                                }
                            })
                            .merge(function (me2) {
                                return {
                                    weight_gross: me2('quantity_bags').mul(me2('package_kg_per_bag').add(me2('package_weight_bag').div(1000))).div(1000),
                                    weight_net: me2('quantity_bags').mul(me2('package_kg_per_bag')).div(1000),
                                    weight_tare: me2('quantity_bags').mul(me2('package_weight_bag').div(1000)).div(1000)

                                }
                            })
                            .merge(function (me2) {
                                return {
                                    amount_usd: me2('price_per_ton').mul(me2('weight_net'))
                                }
                            })
                            .eqJoin("type_rice_id", r.db('common').table("type_rice")).without({ right: ["id", "date_created", "date_updated", "creater", "updater"] }).zip()
                            .merge(function (me2) {
                                return {
                                    invoice_of: me2('type_rice_name_en').add(", ")
                                        .add(me2('project_en')).add(" ")
                                        .add(me2('description_en')).add('')
                                }
                            })
                            .coerceTo('array')
                    }
                })
                .merge(function (me) {
                    return {
                        weight_gross: me('bl_detail').sum('weight_gross'),
                        weight_net: me('bl_detail').sum('weight_net'),
                        weight_tare: me('bl_detail').sum('weight_tare'),
                        amount_usd: me('bl_detail').sum('amount_usd'),
                        quantity_bags: me('bl_detail').sum('quantity_bags'),
                        cl_date: me('cl_date').split('T')(0),
                        contract_date: me('contract_date').split('T')(0),
                        ship: me('ship').map(function (arr_ship) {
                            return arr_ship.merge(function (row_ship) {
                                return r.db('common').table('ship').get(row_ship('ship_id')).without('id', 'date_created', 'date_updated', 'creater', 'updater')
                            }).merge(function (me2) {
                                return { ship_name: me2('ship_name').add(' V.').add(me2('ship_voy_no')) }
                            }).getField('ship_name')
                        }).reduce(function (l, r) {
                            return r.add("/ ").add(l)
                        })

                        ,
                        invoice_of: me('bl_detail').group(function (g) {
                            return g.pluck('invoice_of')
                        })
                            .ungroup()
                            .merge(function (me2) {
                                return {
                                    invoice_of: me2('group')('invoice_of')
                                }
                            }).without('group', 'reduction')
                            .getField('invoice_of')
                            .reduce(function (l, r) {
                                return r.add(" AND ").add(l)
                            })
                    }
                })
                .merge(function (m1) {
                    return r.db('common').table("buyer").get(m1('buyer_id'))
                        .merge(function (m2) {
                            return {
                                buyer_country_id: m2('country_id')
                            }
                        })
                        .pluck("buyer_country_id", "buyer_name", "buyer_address", "buyer_masks")
                })
                .merge(function (m1) {
                    return r.db('common').table("country").get(m1('buyer_country_id'))
                        .merge(function (country) {
                            return {
                                buyer_country_fullname_en: country("country_fullname_en"),
                                buyer_country_name_en: country("country_name_en"),
                                buyer_country_name_th: country("country_name_th")
                            }
                        })
                        .pluck("buyer_country_fullname_en", "buyer_country_name_en", "buyer_country_name_th")
                })
                .merge(function (m1) {
                    return r.db('common').table("port").get(m1('dest_port_id'))
                        .merge(function (port) {
                            return {
                                dest_port_name: port("port_name"),
                                dest_port_code: port("port_code"),
                                dest_country_id: port("country_id")
                            }
                        })
                        .pluck("dest_port_name", "dest_port_code", "dest_country_id")
                })
                .merge(function (m1) {
                    return r.db('common').table("port").get(m1('deli_port_id'))
                        .merge(function (port) {
                            return {
                                deli_port_name: port("port_name"),
                                deli_port_code: port("port_code"),
                                deli_country_id: port("country_id")
                            }
                        })
                        .pluck("deli_port_name", "deli_port_code", "deli_country_id")
                })
                .merge(function (m1) {
                    return r.db('common').table("port").get(m1('load_port_id'))
                        .merge(function (port) {
                            return {
                                load_port_name: port("port_name"),
                                load_port_code: port("port_code"),
                                load_country_id: port("country_id")
                            }
                        })
                        .pluck("load_port_name", "load_port_code", "load_country_id")
                })
                .merge(function (m1) {
                    return r.db('common').table("country").get(m1('dest_country_id'))
                        .merge(function (country) {
                            return {
                                dest_country_fullname_en: country("country_fullname_en"),
                                dest_country_name_en: country("country_name_en"),
                                dest_country_name_th: country("country_name_th")
                            }
                        })
                        .pluck("dest_country_fullname_en", "dest_country_name_en", "dest_country_name_th")
                })
                .merge(function (m1) {
                    return r.db('common').table("country").get(m1('deli_country_id'))
                        .merge(function (country) {
                            return {
                                deli_country_fullname_en: country("country_fullname_en"),
                                deli_country_name_en: country("country_name_en"),
                                deli_country_name_th: country("country_name_th")
                            }
                        })
                        .pluck("deli_country_fullname_en", "deli_country_name_en", "deli_country_name_th")
                })
                .merge(function (m1) {
                    return r.db('common').table("country").get(m1('load_country_id'))
                        .merge(function (country) {
                            return {
                                load_country_fullname_en: country("country_fullname_en"),
                                load_country_name_en: country("country_name_en"),
                                load_country_name_th: country("country_name_th")
                            }
                        })
                        .pluck("load_country_fullname_en", "load_country_name_en", "load_country_name_th")
                })
                .merge(function (m1) {
                    return r.db('common').table("shipline").get(m1('shipline_id')).pluck("shipline_name")
                    //.without("id", "date_created", "date_updated", "creater", "updater")
                })
                .merge(function (m1) {
                    return r.db('common').table("incoterms").get(m1('inct_id')).pluck("inct_name")
                    //.without("id", "date_created", "date_updated", "creater", "updater")
                })
            // (0)
        })
        .merge(function (m) {
            return {
                invoice_date: m('invoice_date').split('T')(0),
                invoice_id: m('id'),
                bl_detail: m('bl_detail').merge(function (m2) {
                    return {
                        buyer_masks: m('buyer_masks'),
                        inct_name: m('inct_name'),
                        contract_name: m('contract_name'),
                        contract_date: m('contract_date'),
                        buyer_name: m('buyer_name')
                    }
                })
            }
        })
        .without('id', 'cl_type_rice')
        .run()
        .then(function (result) {
            //res.json([result]);
            res._ireport("payment/report1.jasper", req.query.export || "pdf", [result], parameters);
        });


}
exports.report2 = function (req, res, next) {
    var r = req._r;
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
    r.db('g2g').table('fee')
        .get(req.query.fee_id)
        .merge(function (fee_merge) {
            return {
                invoice: fee_merge('invoice').map(function (fee_map) {
                    return fee_map.merge(function (fee_merge1) {
                        return r.db('g2g').table('invoice')
                            .get(fee_merge1('invoice_id'))
                            .merge(function (m) {
                                return {
                                    shipment_detail: r.db('g2g').table('shipment_detail')
                                        .getAll(m('book_id'), { index: 'book_id' })
                                        .coerceTo('array')
                                        .pluck("id", "shm_id", "package_id", "exporter_id", "shm_det_quantity", "type_rice_id")
                                        .eqJoin("shm_id", r.db('g2g').table("shipment")).without({ right: ["id", "date_created", "date_updated", "creater", "updater"] }).zip()
                                        .eqJoin("cl_id", r.db('g2g').table("confirm_letter")).without({ right: ['id', 'date_created', 'date_updated', 'creater', 'updater', "cl_date", "cl_name", "cl_quality"] }).zip()
                                        .eqJoin("package_id", r.db('common').table("package")).without({ right: ["id", "date_created", "date_updated", "creater", "updater"] }).zip()
                                        .eqJoin("exporter_id", r.db('external').table("exporter")).without({ right: ["id", "date_created", "date_updated", "creater", "updater"] }).zip()
                                        // .eqJoin("trader_id", r.db('external').table("trader")).without({ right: ["id", "date_created", "date_updated", "creater", "updater"] }).zip()
                                        .eqJoin("seller_id", r.db('external').table("seller")).without({ right: ['id', 'date_created', 'date_updated', 'creater', 'updater', "country_id"] }).zip()
                                        .merge(function (m1) {
                                            return {
                                                shm_det_id: m1('id'),
                                                price_per_ton: m1('cl_type_rice')
                                                    .filter(function (tb) {
                                                        return tb('type_rice_id').eq(m1('type_rice_id'))
                                                    }).getField("package")(0)
                                                    .filter(function (f) {
                                                        return f('package_id').eq(m1('package_id'))
                                                    })(0)
                                                    .pluck('price_per_ton')
                                                    .values()(0),
                                                quantity_tons: m1('shm_det_quantity'),
                                                quantity_bags: m1('shm_det_quantity').mul(1000).div(m1('package_kg_per_bag'))

                                            }
                                        })
                                        .merge(function (m1) {
                                            return {
                                                weight_gross: m1('quantity_bags').mul(m1('package_kg_per_bag').add(m1('package_weight_bag').div(1000))).div(1000),
                                                weight_net: m1('quantity_bags').mul(m1('package_kg_per_bag')).div(1000),
                                                weight_tare: m1('quantity_bags').mul(m1('package_weight_bag').div(1000)).div(1000)
                                            }
                                        })
                                        .merge(function (m1) {
                                            return {
                                                amount_usd: m1('price_per_ton').mul(m1('weight_net'))
                                            }
                                        })
                                        .without('id', 'cl_type_rice', 'shm_det_quantity')
                                }
                            })
                            .merge(function (m) {
                                return r.db('g2g').table('book').get(m('book_id')).without('id', 'date_created', 'date_updated', 'creater', 'updater')
                            })
                            .merge(function (m) {
                                return {
                                    invoice_id: m('id'),
                                    // ship: m('group_ship')('ship')(0),
                                    // shipline_id: m('group_ship')('shipline_id')(0),
                                    // ship_lot_no: m('group_ship')('ship_lot_no')(0),
                                    //  ship_voy_no: m('group_ship')('ship_voy_no')(0),
                                    weight_gross: m('shipment_detail').sum('weight_gross'),
                                    weight_net: m('shipment_detail').sum('weight_net'),
                                    weight_tare: m('shipment_detail').sum('weight_tare'),
                                    amount_usd: m('shipment_detail').sum('amount_usd'),
                                    invoice_date: m('invoice_date').split('T')(0),
                                    invoice_detail: fee_merge1('invoice_detail').map(function (map1) {
                                        return m('shipment_detail').filter({ shm_det_id: map1('shm_det_id') })(0).merge(map1)
                                            .merge(function (m2) {
                                                return {
                                                    exporter_date_approve: m2('exporter_date_approve').split('T')(0),
                                                    // exporter_date_update: m2('exporter_date_update').split('T')(0),
                                                    invoice_date: m2('invoice_date').split('T')(0),
                                                    // trader_date_approve: m2('trader_date_approve').split('T')(0)
                                                }
                                            })
                                    })
                                }
                            })
                            .without("id", "shipment_detail")
                            .merge(function (m) {
                                return r.db('common').table("shipline").get(m('shipline_id')).without('id', 'date_created', 'date_updated', 'creater', 'updater')
                                // r.db('common').table("ship").get(m('ship_id')).without('id'),
                            })
                            .merge(function (m) {
                                return {
                                    ship: m('ship').map(function (arr_ship) {
                                        return arr_ship.merge(function (row_ship) {
                                            return r.db('common').table('ship').get(row_ship('ship_id')).without('id', 'date_created', 'date_updated', 'creater', 'updater')
                                        })
                                    })
                                }
                            })
                    })
                })
            }
        })
        .merge(function (fee_merge) {
            return {
                fee_id: fee_merge('id'),
                fee_date_receipt: fee_merge('fee_date_receipt').split('T')(0),
                amount_usd: fee_merge('invoice').sum('amount_usd'),
                weight_gross: fee_merge('invoice').sum('weight_gross'),
                weight_net: fee_merge('invoice').sum('weight_net'),
                weight_tare: fee_merge('invoice').sum('weight_tare')
            }
        })
        .without('id')
        .run()
        .then(function (result) {
            res.json(result)
        })
        .error(function (err) {
            res.json(err)
        })
}
exports.report3_1 = function (req, res, next) { 
    var r = req._r;
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
   r.db('g2g').table('fee_detail')
    .merge(function (invoice_merge){
    return {
      invoice :invoice_merge('invoice')     
      .merge(function (invoice_detail_merge){
        return { 
          invoice_detail:invoice_detail_merge('invoice_detail') 
          .merge(function (ship_det_merge){
            return r.db('g2g').table('shipment_detail').get(ship_det_merge('shm_det_id')).without('tags') 
              .merge(function (m){
                return r.db('g2g').table('book').get(m('book_id')).pluck('ship','ship_lot_no','dest_port_id')  
                  })
              .merge(function(ship_merge){
      					return {
    						  ship:ship_merge('ship')
                  .merge(function(ship_name_merge){
     								   return r.db('common').table('ship').get(ship_name_merge('ship_id')).pluck('ship_name')   
											      })
                  .map(function(ship_name_merge){
      								  return ship_name_merge('ship_name').add(' V.',ship_name_merge('ship_voy_no'))    
  													    })
                   .reduce(function(left,right){       
      										  return left.add(' / ',right)       
   											   }),
                  
                  port_name: r.db('common').table('port').get(ship_merge('dest_port_id')).getField('port_name'),
            //      country_name: r.db('g2g').table('contract').get(table_shipment('contract_id')).getField('buyer_id')
                  
                                    }
                                })
              .merge(function (rate_merge) {
                return {
                  rate_bank: (invoice_merge('rate_bank')),
                  fee_id: (invoice_merge('fee_id'))
                }
              })
               .merge(function (type_rice_merge){
                 return {
                   type_rice_name: r.db('common').table('type_rice').get(type_rice_merge('type_rice_id')).getField('type_rice_name_th'),
                   amount_of_rice:(type_rice_merge('shm_det_quantity')).mul(type_rice_merge('price_per_ton')),
                   seller_name: r.db('external').table('exporter').get(type_rice_merge('exporter_id')).getField('seller_id')
                   .do(function (seller) {
                     return r.db('external').table('seller').get(seller).getField('seller_name_th')
                  })
                 }
               })
          })
        }
      })
       .map(function (invoice_merge) {
                        return invoice_merge.getField('invoice_detail')     
                    })(0)
    }
    })
   .map(function (invoice_merge) {
            return invoice_merge.getField('invoice')                
        })
        .reduce(function(left,right){
            return left.add(right)
        })
  .eqJoin('fee_id', r.db('g2g').table('fee')).pluck('left', { right: 'fee_no'}).zip()
  .eqJoin('shm_id',r.db('g2g').table('shipment')).pluck('left', { right: ['cl_id','contract_id']}).zip()
   .merge(function (buyer_merge){
     return {country_name: r.db('g2g').table('contract').get(buyer_merge('contract_id')).getField('buyer_id')
       .do(function (buyer) {
         return r.db('common').table('buyer').get(buyer).getField('country_id')
           .do(function (country) {
             return r.db('common').table('country').get(country).getField('country_fullname_th')
           })
       }),
       buyer_name: r.db('g2g').table('contract').get(buyer_merge('contract_id')).getField('buyer_id')
       .do(function (buyer_name) {
         return r.db('common').table('buyer').get(buyer_name).getField('buyer_name')
       })
       }
   })
    .merge(function (sum_merge){
    return {
      sum_rate_bank:((sum_merge('rate_bank')).mul(sum_merge('amount_of_rice'))).sub(sum_merge('invoice_fee'))
    }
  })
  .merge(function (sum_merge){
    return {
      sum_bath:((sum_merge('rate_bank')).mul(sum_merge('amount_of_rice'))).sub(sum_merge('invoice_fee'))
    }
  })
   .merge(function (mul_merge){
    return {
   sum_tax : mul_merge('sum_rate_bank').mul(0.01)
    }
  })
   .merge(function (sub_merge){
    return {
   balance : sub_merge('sum_rate_bank').sub(sub_merge('sum_tax'))
    }
  })
 
        .run()
        .then(function (result) {
            // res.json(result);
            res._ireport("payment/report3_1.jasper", req.query.export || "pdf", result, parameters);
        });

}
exports.report3_2 = function (req, res, next) { 
    var r = req._r;
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
   r.db('g2g').table('fee_detail')
    .merge(function (invoice_merge){
    return {
      invoice :invoice_merge('invoice')     
      .merge(function (invoice_detail_merge){
        return { 
          invoice_detail:invoice_detail_merge('invoice_detail') 
          .merge(function (ship_det_merge){
            return r.db('g2g').table('shipment_detail').get(ship_det_merge('shm_det_id')).without('tags') 
              .merge(function (m){
                return r.db('g2g').table('book').get(m('book_id')).pluck('ship','ship_lot_no','dest_port_id')  
                  })
              .merge(function(ship_merge){
      					return {
    						  ship:ship_merge('ship')
                  .merge(function(ship_name_merge){
     								   return r.db('common').table('ship').get(ship_name_merge('ship_id')).pluck('ship_name')   
											      })
                  .map(function(ship_name_merge){
      								  return ship_name_merge('ship_name').add(' V.',ship_name_merge('ship_voy_no'))    
  													    })
                   .reduce(function(left,right){       
      										  return left.add(' / ',right)       
   											   }),
                  
                  port_name: r.db('common').table('port').get(ship_merge('dest_port_id')).getField('port_name'),
            //      country_name: r.db('g2g').table('contract').get(table_shipment('contract_id')).getField('buyer_id')
                  
                                    }
                                })
              .merge(function (rate_merge) {
                return {
                  rate_bank: (invoice_merge('rate_bank')),
                  fee_id: (invoice_merge('fee_id'))
                }
              })
               .merge(function (type_rice_merge){
                 return {
                   type_rice_name: r.db('common').table('type_rice').get(type_rice_merge('type_rice_id')).getField('type_rice_name_th'),
                   amount_of_rice:(type_rice_merge('shm_det_quantity')).mul(type_rice_merge('price_per_ton')),
                   seller_name: r.db('external').table('exporter').get(type_rice_merge('exporter_id')).getField('seller_id')
                   .do(function (seller) {
                     return r.db('external').table('seller').get(seller).getField('seller_name_th')
                  })
                 }
               })
          })
        }
      })
       .map(function (invoice_merge) {
                        return invoice_merge.getField('invoice_detail')     
                    })(0)
    }
    })
   .map(function (invoice_merge) {
            return invoice_merge.getField('invoice')                
        })
        .reduce(function(left,right){
            return left.add(right)
        })
  .eqJoin('fee_id', r.db('g2g').table('fee')).pluck('left', { right: 'fee_no'}).zip()
  .eqJoin('shm_id',r.db('g2g').table('shipment')).pluck('left', { right: ['cl_id','contract_id']}).zip()
   .merge(function (buyer_merge){
     return {country_name: r.db('g2g').table('contract').get(buyer_merge('contract_id')).getField('buyer_id')
       .do(function (buyer) {
         return r.db('common').table('buyer').get(buyer).getField('country_id')
           .do(function (country) {
             return r.db('common').table('country').get(country).getField('country_fullname_th')
           })
       }),
       buyer_name: r.db('g2g').table('contract').get(buyer_merge('contract_id')).getField('buyer_id')
       .do(function (buyer_name) {
         return r.db('common').table('buyer').get(buyer_name).getField('buyer_name')
       })
       }
   })
    .merge(function (sum_merge){
    return {
      sum_rate_bank:((sum_merge('rate_bank')).mul(sum_merge('amount_of_rice'))).sub(sum_merge('invoice_fee'))
    }
  })
  .merge(function (sum_merge){
    return {
      sum_bath:((sum_merge('rate_bank')).mul(sum_merge('amount_of_rice'))).sub(sum_merge('invoice_fee'))
    }
  })
   .merge(function (mul_merge){
    return {
   sum_tax : mul_merge('sum_rate_bank').mul(0.01)
    }
  })
   .merge(function (sub_merge){
    return {
   balance : sub_merge('sum_rate_bank').sub(sub_merge('sum_tax'))
    }
  })
 
        .run()
        .then(function (result) {
            // res.json(result);
            res._ireport("payment/report3_2.jasper", req.query.export || "pdf", result, parameters);
        });

}
exports.report4 = function (req, res, next) {
    var r = req._r;
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
   r.db('g2g').table('fee_detail')
  .merge(function (invoice_merge){
    return {
      invoice :invoice_merge('invoice')      
      .merge(function (invoice_detail_merge){
        return { 
          invoice_detail:invoice_detail_merge('invoice_detail')        
          .merge(function (table_shipment){
            return r.db('g2g').table('shipment_detail').get(table_shipment('shm_det_id'))   
              .merge(function (m){
                return r.db('g2g').table('book').get(m('book_id')).pluck('ship','ship_lot_no')  
                  })
              .merge(function(ship_merge){
      					return {
    						  ship:ship_merge('ship').merge(function(shipname_merge){
     								   return r.db('common').table('ship').get(shipname_merge('ship_id')).pluck('ship_name')   
											      })
                  .map(function(shipname_merge){
      								  return shipname_merge('ship_name').add(' V.',shipname_merge('ship_voy_no'))    
  													    })
                   .reduce(function(left,right){       
      										  return left.add(' / ',right)        
   											   })
                                    }
                                })
                                .merge(function (rate_merge) {                                  
                                    return {
                                        rate_bank: (invoice_merge('rate_bank')),             
                                        fee_id: (invoice_merge('fee_id')),
                                        fee_internal: (invoice_merge('fee_internal')),
                                        fee_other: (invoice_merge('fee_other')),
                                        fee_foreign: (invoice_merge('fee_foreign')),
                                        rate_tt: (invoice_merge('rate_tt')),
                                        amount_usd: (rate_merge('shm_det_quantity')).mul(rate_merge('price_per_ton'))
                                    }
                                })
                                .merge(function (amount_merge) {
                                    return {
                                        amount_bath: (amount_merge('rate_bank')).mul(amount_merge('amount_usd')),         
                                        fee_bank: (amount_merge('rate_bank')).mul(amount_merge('fee_foreign'))
                                            .add(amount_merge('fee_foreign')).add(amount_merge('fee_other'))                      
                                    }
                                })
                                .merge(function (balance_merge) {
                                    return {
                                        balance: (balance_merge('amount_bath')).sub(balance_merge('fee_bank'))       
                                    }
                                })
                                .merge(function (tax_merge) {
                                    return {
                                        tax: (tax_merge('balance')).mul(0.01)          
                                    }
                                })
                                .merge(function (balance_2_merge) {
                                    return {
                                        balance_2: (balance_2_merge('balance')).sub(balance_2_merge('tax'))
                                    }
                                })
                        })
                    }
                })
                    .map(function (invoice_merge) {
                        return invoice_merge.getField('invoice_detail')     
                    })(0)

            }
        })
        .map(function (invoice_merge) {
            return invoice_merge.getField('invoice')                
        })
        .reduce(function(left,right){
            return left.add(right)
        })
   .without('shm_det_id')
   .eqJoin('exporter_id',r.db('external').table('exporter')).pluck('left', { right: 'seller_id' }).zip()
   .eqJoin('seller_id',r.db('external_f3').table('seller')).pluck('left', { right: 'seller_name_th' }).zip()
   .without('id')
   .eqJoin('fee_id', r.db('g2g').table('fee')).pluck('left', { right: 'fee_no'}).zip()
        .run()
        .then(function (result) {
            // res.json(result);
            res._ireport("payment/report4.jasper", req.query.export || "pdf", result, parameters);
        });

}
exports.report5 = function (req, res, next) {
    var r = req._r;
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
    r.db('g2g').table('payment').get(req.params.id)
        .merge(function (m) {
            return {
                TOTAL: m('pay_amount').mul(0.01)
            }
        })
        .merge(r.db('external').table('exporter').get(r.row('exporter_id')).pluck('seller_id'))
        // .merge(r.db('external').table('trader').get(r.row('trader_id')).pluck('seller_id'))
        .merge(r.db('external').table('seller').get(r.row('seller_id')).pluck('seller_tax_id', 'seller_name_th', 'seller_address_th'))
        .without('payment_detail', 'tags')
        //   .eqJoin('exporter_id',r.db('external').table('exporter')).pluck('left',{right:'trader_id'}).zip()
        //   .eqJoin('trader_id',r.db('external').table('trader')).pluck('left',{right:'seller_id'}).zip()
        //   .eqJoin('seller_id',r.db('external').table('seller')).pluck('left',{right:['seller_tax_id','seller_name_th','seller_address_th','']}).zip()
        .run()
        .then(function (result) {
            res.json(result);
            res._ireport("payment/report5.jasper", req.query.export || "pdf", result, parameters);
        });

}
exports.report7 = function (req, res, next) {
    var r = req._r;
    var parameters = {
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
    // console.log( req.query.date_start);
    date_start = req.query.date_start;
    date_end = req.query.date_end;
    r.db('g2g').table('payment').between(date_start, date_end, { index: 'pay_date' })
        .merge(function (m) {
            return {
                TOTAL: m('pay_amount').mul(0.01).div(100)
            }
        })
        .merge(function (m) {
            return r.db('external').table('exporter').get(m('exporter_id')).pluck('seller_id')
        })
        // .merge(r.db('external_f3').table('trader').get(r.row('trader_id')).pluck('seller_id'))
        .merge(r.db('external').table('seller').get(r.row('seller_id')).pluck('seller_tax_id', 'seller_name_th', 'seller_address_th'))
        .without('payment_detail', 'tags')  
        .pluck('TOTAL','pay_amount','pay_date')  
   .merge(function (r1){
        return {
          count_exporter:r.db('g2g').table('payment').between(date_start, date_end, { index: 'pay_date' })
          .count()
        }
   }) 
    .merge(function (m) {
            return {
                page_count:  m('count_exporter').div(6).floor().add(1)
            }
    })     

        .run()
        .then(function (result) {
            // res.json(result);
            res._ireport("payment/report7.jasper", req.query.export || "pdf", result, parameters);
        });

}
exports.report8 = function (req, res, next) {
    var r = req._r;
    var parameters = {
        PAGE:'',
        CURRENT_DATE: new Date().toISOString().slice(0, 10),
        SUBREPORT_DIR: __dirname.replace('controller', 'report') + '\\' + req.baseUrl.replace("/api/", "") + '\\'
    };
    date_start = req.query.date_start;
    date_end = req.query.date_end;
    r.db('g2g').table('payment').between(date_start, date_end, { index: 'pay_date' })
        .merge(function (m) {
            return {
                TOTAL: m('pay_amount').mul(0.01).div(100)
            }
        })
        .merge(function (m) {
            return r.db('external').table('exporter').get(m('exporter_id')).pluck('seller_id')
        })
        .merge(r.db('external').table('seller').get(r.row('seller_id')).pluck('seller_tax_id', 'seller_name_th', 'seller_address_th'))
        .without('payment_detail', 'tags')
        .merge(function (row) {
            return {
                pay_date: row('pay_date').split('T')(0)
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
        parameters["PAGE"]=result.length/6;
            // res.json(result);
            res._ireport("payment/report8.jasper", req.query.export || "pdf", result, parameters);
        });

}