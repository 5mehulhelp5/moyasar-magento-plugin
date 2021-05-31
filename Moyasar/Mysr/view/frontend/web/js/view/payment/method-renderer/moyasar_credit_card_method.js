/*browser:true*/
/*global define*/
define(
    [
        'Magento_Checkout/js/view/payment/default',
        'Magento_Checkout/js/model/quote',
        'jquery',
        'Magento_Checkout/js/model/full-screen-loader',
        'Magento_Checkout/js/action/place-order',
        'Magento_Checkout/js/model/payment/additional-validators',
        'mage/url',
        'jquery/ui',
        'Moyasar_Mysr/js/model/create-payment',
        'Magento_Ui/js/model/messageList',
        'mage/translate'
    ],
    function (
        Component,
        quote,
        $,
        fullScreenLoader,
        placeOrderAction,
        additionalValidators,
        url,
        jqueryUi,
        createMoyasarPayment,
        globalMessageList,
        mage
    ) {
        'use strict';
        return Component.extend({
            defaults: {
                template: 'Moyasar_Mysr/payment/moyasar_credit_card'
            },
            getCode: function () {
                return 'moyasar_credit_card';
            },
            isActive: function () {
                return true;
            },
            getBaseUrl: function () {
                return url.build('moyasar_mysr/redirect/response');
            },
            getCancelOrderUrl: function () {
                return url.build('moyasar_mysr/order/cancel');
            },
            getOrderId: function () {
                return $.ajax({
                    url: url.build('moyasar_mysr/order/data'),
                    method: 'GET',
                    dataType: 'json'
                });
            },
            getApiKey: function () {
                return window.checkoutConfig.moyasar_credit_card.api_key;
            },
            getCardsType: function () {
                return window.checkoutConfig.moyasar_credit_card.supported_cards.split(',');
            },
            isShowLegend: function () {
                return true;
            },
            getAmount: function () {
                return parseFloat(quote.totals()['base_grand_total']).toFixed(2);
            },
            getCurrency: function () {
                var totals = quote.getTotals()();

                if (totals) {
                    return totals.base_currency_code;
                }

                return quote.base_currency_code;
            },
            getAmountSmallUnit: function (amount) {
                var currency = this.getCurrency();
                var fractionSize = window.checkoutConfig.moyasar_credit_card.currencies_fractions[currency];

                if (!fractionSize) {
                    fractionSize = window.checkoutConfig.moyasar_credit_card.currencies_fractions['DEFAULT'];
                }

                var total = amount ? amount : this.getAmount();

                return total * (10 ** fractionSize);
            },
            getEmail: function () {
                if (quote.guestEmail) {
                    return "Order By a guest : " + quote.guestEmail;
                }

                return "Order By a customer : " + window.checkoutConfig.customerData.email;
            },
            validateName: function () {
                var validator = $('#' + this.getCode() + '-form').validate();
                validator.element('#credit_card_name');
            },
            validateNumber: function () {
                var validator = $('#' + this.getCode() + '-form').validate();
                validator.element('#credit_card_number');
            },
            validateExp: function () {
                var validator = $('#' + this.getCode() + '-form').validate();
                validator.element('#credit_card_year');
                validator.element('#credit_card_month');
            },
            validate: function () {
                var $form = $('#' + this.getCode() + '-form');
                return $form.validation() && $form.validation('isValid');
            },
            moyasarPaymentUrl: function () {
                return window.checkoutConfig.moyasar_credit_card.payment_url;
            },
            redirectAfterPlaceOrder: false,
            placeOrder: function (data, event) {
                var self = this;

                if (event) {
                    event.preventDefault();
                }

                if (!this.validate() || !additionalValidators.validate()) {
                    return false;
                }

                this.isPlaceOrderActionAllowed(false);

                var $form = $('#' + this.getCode() + '-form');
                var formData = $form.serialize();

                fullScreenLoader.startLoader();

                this.placeMagentoOrder().done(function (orderId) {
                    self.getOrderId().done(function (orderData) {

                        var paymentData = formData.concat(
                            `&amount=${self.getAmountSmallUnit(orderData['total'])}`+
                            `&currency=${self.getCurrency()}`+
                            `&description=${self.getEmail()}`+
                            `&metadata[order_id]=${orderData['orderId']}`
                        );

                        var mPaymentResult = createMoyasarPayment(paymentData, self.moyasarPaymentUrl());

                        mPaymentResult
                            .done(function (paymentObject) {
                                self.updateOrderPayment(paymentObject).done(function (){
                                    if (paymentObject.source.transaction_url) {
                                        self.afterPlaceOrder(paymentObject.source.transaction_url) 
                                    } else {
                                        self.afterPlaceOrder(
                                            self.getCancelOrderUrl() +
                                            '?id=' + paymentObject.id +
                                            '&message=' + paymentObject.source.message ,
                                            true
                                        );
                                    }
                                    
                                })
                                .fail(function (){
                                    self.isPlaceOrderActionAllowed(true);
                                    globalMessageList.addErrorMessage({
                                        message: mage('Error! Could not place order.')
                                    });
                                    self.afterPlaceOrder(self.getCancelOrderUrl(), true);
                                });
                            })
                            .fail(function (xhr, status, error) {
                                self.isPlaceOrderActionAllowed(true);
                                globalMessageList.addErrorMessage({ message: mage('Error! Payment failed, please try again later.') });
                                if (xhr.responseJSON.message) {
                                    globalMessageList.addErrorMessage({
                                        message: xhr.responseJSON.message + ' : ' + JSON.stringify(xhr.responseJSON.errors)
                                    });
                                }
                                self.afterPlaceOrder(self.getCancelOrderUrl(), true);
                            });
                        })
                        .fail(function () {
                            self.isPlaceOrderActionAllowed(true);
                            self.afterPlaceOrder(self.getCancelOrderUrl(), true);
                        })
                    })
                    .fail(function () {
                        self.isPlaceOrderActionAllowed(true);
                        self.afterPlaceOrder(self.getCancelOrderUrl(), true);
                    });

                return true;
            },
            placeMagentoOrder: function () {
                return $.when(placeOrderAction(this.getData(), this.messageContainer));
            },
            updateOrderPayment: function (payment) {
                return $.ajax({
                    url: url.build('moyasar_mysr/order/update'),
                    method: 'POST',
                    data: payment,
                    dataType: 'json'
                });
            },
            afterPlaceOrder: function (redirectUrl, failed) {
                if (failed) {
                    globalMessageList.addErrorMessage({ message: mage('Error! Payment failed, please try again later.') });
                }
                fullScreenLoader.stopLoader();
                window.location.href = redirectUrl;
            }
        });
    }
);
