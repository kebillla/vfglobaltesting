/* ==========================================================================
   Robokassa: сборка ссылки на оплату и проверка подписей.
   Аккаунт казахстанский -> точка входа auth.robokassa.kz.
   Фискализация (Receipt) пока не подключена: параметр не передаём и в подпись
   он не входит. Когда понадобится — Receipt встаёт в подпись сразу после InvId.
   ========================================================================== */
'use strict';

const crypto = require('crypto');

const isTest = process.env.ROBOKASSA_TEST === '1';

/* В тестовом режиме Robokassa проверяет подписи ОТДЕЛЬНОЙ парой паролей —
   их задают в «Технических настройках» магазина, и они не должны совпадать
   с боевыми. Держим обе пары: переключение теста и прода — один флаг. */
const pass1 = isTest ? (process.env.ROBOKASSA_TEST_PASSWORD_1 || '') : (process.env.ROBOKASSA_PASSWORD_1 || '');
const pass2 = isTest ? (process.env.ROBOKASSA_TEST_PASSWORD_2 || '') : (process.env.ROBOKASSA_PASSWORD_2 || '');

if (isTest && !pass1) {
  console.warn('[robokassa] ROBOKASSA_TEST=1, но тестовые пароли не заданы — оплата не заработает');
}

const CFG = {
  login:    process.env.ROBOKASSA_LOGIN || '',
  pass1,
  pass2,
  endpoint: process.env.ROBOKASSA_ENDPOINT || 'https://auth.robokassa.kz/Merchant/Payment/Index',
  algo:    (process.env.ROBOKASSA_HASH_ALGO || 'md5').toLowerCase(),
  isTest,
  currency: process.env.ROBOKASSA_OUT_SUM_CURRENCY || ''   // пусто = валюта магазина
};

const configured = () => Boolean(CFG.login && CFG.pass1 && CFG.pass2);

function hash(str) {
  return crypto.createHash(CFG.algo).update(str, 'utf8').digest('hex').toUpperCase();
}

/* Shp_-параметры участвуют в подписи: сортируются по имени и дописываются
   в хвост как :Shp_key=value. Мы передаём Shp_lang для языка чека и писем. */
function shpTail(shp) {
  return Object.keys(shp).sort()
    .map((k) => `:${k}=${shp[k]}`)
    .join('');
}

function amount(sum) {
  return Number(sum).toFixed(2);
}

/* Подпись запроса: MerchantLogin:OutSum:InvId:Пароль#1[:Shp_...] */
function signRequest(outSum, invId, shp) {
  return hash(`${CFG.login}:${amount(outSum)}:${invId}:${CFG.pass1}${shpTail(shp)}`);
}

/* Подпись ResultURL (сервер-сервер): OutSum:InvId:Пароль#2[:Shp_...] */
function checkResult(outSum, invId, signature, shp) {
  const mine = hash(`${outSum}:${invId}:${CFG.pass2}${shpTail(shp)}`);
  return mine === String(signature || '').toUpperCase();
}

/* Подпись SuccessURL (возврат браузера): OutSum:InvId:Пароль#1[:Shp_...] */
function checkSuccess(outSum, invId, signature, shp) {
  const mine = hash(`${outSum}:${invId}:${CFG.pass1}${shpTail(shp)}`);
  return mine === String(signature || '').toUpperCase();
}

function payUrl({ outSum, invId, description, email, lang, shp = {} }) {
  const params = new URLSearchParams({
    MerchantLogin: CFG.login,
    OutSum: amount(outSum),
    InvId: String(invId),
    Description: String(description || '').slice(0, 100),
    SignatureValue: signRequest(outSum, invId, shp),
    Culture: lang === 'kk' ? 'kz' : 'ru'
  });
  if (email) params.set('Email', email);
  if (CFG.currency) params.set('OutSumCurrency', CFG.currency);
  if (CFG.isTest) params.set('IsTest', '1');
  Object.keys(shp).forEach((k) => params.set(k, shp[k]));
  return `${CFG.endpoint}?${params.toString()}`;
}

/* Из тела ResultURL/SuccessURL вытаскиваем только Shp_-параметры. */
function pickShp(source) {
  const out = {};
  Object.keys(source || {}).forEach((k) => {
    if (/^Shp_/i.test(k)) out[k] = source[k];
  });
  return out;
}

module.exports = { CFG, configured, payUrl, checkResult, checkSuccess, pickShp, amount, hash };
