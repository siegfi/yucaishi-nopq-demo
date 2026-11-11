/* LD1 志願清單代碼 v1：純編解碼，不傳送或儲存資料。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof define === 'function' && define.amd) define(function () { return api; });
  root.LD1 = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var VERSION = 'LD1';
  var HELP = '也可以改用手選';
  var MESSAGES = {
    EMPTY: '請貼上志願代碼，' + HELP,
    FORMAT: '志願代碼格式不正確，' + HELP,
    VERSION: '志願代碼版本不支援，' + HELP,
    YEAR: '這份志願代碼不是目前開放的學年度，' + HELP,
    COUNT: '志願數量需為 1 到 6 個，' + HELP,
    CODE: '志願代碼中的校系代碼不正確，' + HELP,
    DUPLICATE: '志願代碼中有重複的校系，' + HELP,
    CHECKSUM: '志願代碼驗證碼不正確，' + HELP
  };

  function crc8(str) {
    var crc = 0, i, j, b;
    str = String(str);
    for (i = 0; i < str.length; i++) {
      b = str.charCodeAt(i);
      if (b > 127) throw new Error('FORMAT: CRC-8 僅接受 ASCII');
      crc ^= b;
      for (j = 0; j < 8; j++) crc = (crc & 128) ? ((crc << 1) ^ 7) & 255 : (crc << 1) & 255;
    }
    return crc;
  }
  function fail(code) { return { ok: false, error: code, message: MESSAGES[code] }; }
  function invalid(code) { throw new Error(code + ': 輸入不合法'); }
  function hex2(n) { return ('0' + n.toString(16)).slice(-2); }

  function encode(input) {
    var year, channel, codes, i, seen = {}, base;
    if (!input || !/^[0-9]{3}$/.test(String(input.year))) invalid('YEAR');
    year = String(input.year);
    channel = input.channel;
    if (channel !== 'U' && channel !== 'T') invalid('FORMAT');
    codes = input.codes;
    if (!codes || typeof codes.length !== 'number' || codes.length < 1 || codes.length > 6) invalid('COUNT');
    for (i = 0; i < codes.length; i++) {
      if (!/^[0-9]{6}$/.test(String(codes[i]))) invalid('CODE');
      if (seen[codes[i]]) invalid('DUPLICATE');
      seen[codes[i]] = true;
    }
    base = VERSION + '-' + year + '-' + channel + '-' + Array.prototype.join.call(codes, '.');
    return base + '-' + hex2(crc8(base));
  }

  function decode(raw, options) {
    var str, m, prefix, year, channel, codesPart, codes, i, seen = {}, base, supplied;
    if (raw === null || raw === undefined || String(raw).replace(/\s/g, '') === '') return fail('EMPTY');
    str = String(raw).replace(/^\s+|\s+$/g, '').replace(/\s/g, '');
    prefix = str.split('-')[0];
    if (prefix && prefix.toUpperCase() !== VERSION) return fail('VERSION');
    str = VERSION + str.slice(prefix.length);
    m = /^(LD1)-(\d{3})-([UT])-([^\-]*)-([0-9a-fA-F]{2})$/.exec(str);
    if (!m) return fail('FORMAT');
    year = m[2]; channel = m[3]; codesPart = m[4]; supplied = m[5].toLowerCase();
    if (!options || String(options.openYear) !== year) return fail('YEAR');
    codes = codesPart === '' ? [] : codesPart.split('.');
    if (codes.length < 1 || codes.length > 6) return fail('COUNT');
    for (i = 0; i < codes.length; i++) {
      if (!/^[0-9]{6}$/.test(codes[i])) return fail('CODE');
      if (seen[codes[i]]) return fail('DUPLICATE');
      seen[codes[i]] = true;
    }
    base = VERSION + '-' + year + '-' + channel + '-' + codesPart;
    if (hex2(crc8(base)) !== supplied) return fail('CHECKSUM');
    return { ok: true, year: parseInt(year, 10), channel: channel, apiChannel: channel === 'U' ? 'UNI' : 'TECH', codes: codes };
  }
  return { VERSION: VERSION, crc8: crc8, encode: encode, decode: decode };
}));
