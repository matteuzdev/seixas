/**
 * SEIXAS — AbacatePay Checkout Function
 * Netlify Serverless Function — a API key fica SOMENTE aqui, nunca no frontend.
 *
 * Endpoint: POST /api/create-checkout
 * Body: { maskId, maskName, price }
 * Returns: { checkoutUrl, pixCode, pixQrCode, expiresAt }
 */

const ABACATE_URL = 'https://api.abacatepay.com/v1';
const API_KEY = process.env.ABACATEPAY_KEY;

// Produtos pré-cadastrados (IDs das masks elite no AbacatePay)
const PRODUCTS = {
    'wave-glow': { name: 'Seixas Elite — Wave Glow', price: 2990 }, // R$ 29,90
    'fire-ring': { name: 'Seixas Elite — Fire Ring', price: 2990 },
    'electric': { name: 'Seixas Elite — Electric', price: 2990 },
    'galaxy': { name: 'Seixas Elite — Galaxy', price: 2990 },
    'crystal': { name: 'Seixas Elite — Crystal', price: 2990 },
    'hud': { name: 'Seixas Elite — HUD', price: 2990 },
    // Pack completo com desconto
    'elite-pack': { name: 'Seixas Elite — Pack Completo', price: 9990 },
};

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    if (!API_KEY) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key não configurada' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body inválido' }) };
    }

    const { maskId } = body;
    if (!maskId || !PRODUCTS[maskId]) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Produto inválido' }) };
    }

    const product = PRODUCTS[maskId];

    try {
        // Cria cobrança Pix no AbacatePay
        const response = await fetch(`${ABACATE_URL}/billing/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                frequency: 'ONE_TIME',
                methods: ['PIX'],
                products: [{
                    externalId: maskId,
                    name: product.name,
                    description: `Máscara Elite Seixas — ${product.name}`,
                    quantity: 1,
                    price: product.price, // em centavos
                }],
                returnUrl: 'https://seixas.app/success',
                completionUrl: 'https://seixas.app/success',
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('AbacatePay error:', data);
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ error: data.error || 'Erro ao criar cobrança' }),
            };
        }

        // Extrai dados do Pix
        const billing = data.data;
        const pixMethod = billing?.charges?.[0]?.pix;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                checkoutUrl: billing?.url || null,
                pixCode: pixMethod?.brCode || null,
                pixQrCode: pixMethod?.brCodeBase64 || null,
                expiresAt: billing?.charges?.[0]?.expiresAt || null,
                billingId: billing?.id || null,
                product: {
                    name: product.name,
                    price: product.price,
                },
            }),
        };
    } catch (err) {
        console.error('Seixas/AbacatePay:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Erro interno ao criar cobrança' }),
        };
    }
};
