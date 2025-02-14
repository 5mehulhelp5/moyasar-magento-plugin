<?php

namespace Moyasar\Magento2\Model\Config;

use Magento\Checkout\Model\ConfigProviderInterface;
use Magento\Checkout\Model\Session;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Store\Model\StoreManager;
use Moyasar\Magento2\Helper\CurrencyHelper;
use Moyasar\Magento2\Helper\MoyasarHelper;
use Moyasar\Magento2\Model\Payment\MoyasarPayments;
use Moyasar\Magento2\Model\Payment\MoyasarPaymentsApplePay;
use Moyasar\Magento2\Model\Payment\MoyasarPaymentsStcPay;

class PaymentConfigProvider implements ConfigProviderInterface
{

    const XML_PATH_STORE_NAME = 'general/store_information/name';

    /**
     * @var ScopeConfigInterface
     */
    protected $scopeConfig;

    /**
     * @var StoreManager
     */
    protected $storeManager;

    /**
     * @var MoyasarHelper
     */
    protected $moyasarHelper;

    /**
     * @var CurrencyHelper
     */
    protected $currencyHelper;


    protected $checkoutSession;

    public function __construct(
        ScopeConfigInterface $scopeConfig,
        Session $checkoutSession,
        StoreManager $storeManager,
        MoyasarHelper $moyasarHelper,
        CurrencyHelper $currencyHelper
    ) {
        $this->scopeConfig = $scopeConfig;
        $this->storeManager = $storeManager;
        $this->moyasarHelper = $moyasarHelper;
        $this->currencyHelper = $currencyHelper;
        $this->checkoutSession = $checkoutSession;
    }

    public function getConfig()
    {
        $storeUrl = $this->storeManager->getStore()->getBaseUrl();
        preg_match('/^.+:\/\/([A-Za-z0-9\-\.]+)\/?.*$/', $storeUrl, $matches);
        $enabled_method = [];
        // Credit Card
        if ($this->scopeConfig->getValue('payment/moyasar_payments/active')) {
            $enabled_method[] = 'creditcard';
        }
        // Apple Pay
        if ($this->scopeConfig->getValue('payment/moyasar_payments_apple_pay/active')) {
            $enabled_method[] = 'applepay';
        }
        // Stc Pay
        if ($this->scopeConfig->getValue('payment/moyasar_payments_stc_pay/active')) {
            $enabled_method[] = 'stcpay';
        }
        // Samsung Pay
        if ($this->scopeConfig->getValue('payment/moyasar_payments_samsung_pay/active')) {
            $enabled_method[] = 'samsungpay';
        }

        $supported_networks = $this->scopeConfig->getValue('payment/moyasar_payments/schemes');
        $samsung_supported_networks = $this->scopeConfig->getValue('payment/moyasar_payments_samsung_pay/schemes');


        $config = [
            'api_key' => $this->moyasarHelper->publishableApiKey(),
            'base_url' => $this->moyasarHelper->apiBaseUrl(),
            'country' => $this->scopeConfig->getValue('general/country/default'),
            'store_name' => $this->getStoreName(),
            'apple_store_name' => $this->getAppleStoreName(),
            'samsung' => [
                'store_name' => $this->getSamsungStoreName(),
                'service_id' => $this->scopeConfig->getValue('payment/moyasar_payments_samsung_pay/service_id'),
                'supported_networks' => $samsung_supported_networks ? explode(',',  $samsung_supported_networks) : []
            ],
            'domain_name' => $matches[1],
            'supported_networks' => $supported_networks ? explode(',', $supported_networks ) : [],
            'methods' => $enabled_method,
            'version' => 'Moyasar Http; Magento Plugin v' . MoyasarHelper::VERSION
        ];

        return [
            MoyasarPayments::CODE => $config
        ];
    }

    /**
     * Get store name
     *
     * @return string
     */
    public function getStoreName($name = null)
    {
        $store_name = $name ?? $this->scopeConfig->getValue(self::XML_PATH_STORE_NAME) ?? $this->storeManager->getStore()->getName() ?? 'Store';
        // Check is store english (Regex)
        if (!preg_match('/\A[\x00-\x7F]+\z/', $store_name)) {
            $store_name = 'Store';
        }
        return $store_name;
    }

    /**
     * Get Apple store name
     *
     * @return string
     */
    public function getAppleStoreName()
    {
        return $this->getStoreName($this->scopeConfig->getValue('payment/moyasar_payments_apple_pay/apple_store_name'));
    }

    /**
     * Get Samsung store name
     *
     * @return string
     */
    public function getSamsungStoreName()
    {
        return $this->getStoreName($this->scopeConfig->getValue('payment/moyasar_payments_samsung_pay/samsung_store_name'));
    }
}
