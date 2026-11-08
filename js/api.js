/**
 * ฟังก์ชันเรียก Google Apps Script + ตัวช่วยที่ใช้ร่วมกันทุกหน้า
 * POST ส่งเป็น text/plain เพื่อเลี่ยง CORS preflight (Apps Script ไม่รองรับ OPTIONS)
 */
(function () {
  var TIMEOUT_MS = 30000;

  /** escape ข้อความก่อนใส่ใน HTML (กัน XSS) */
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function baseUrl() {
    var u = window.SHOP_CONFIG && window.SHOP_CONFIG.API_URL;
    if (!u || u.indexOf('https://script.google.com/') !== 0) {
      throw new Error('ยังไม่ได้ตั้งค่า API_URL ในไฟล์ js/config.js');
    }
    return u;
  }

  async function request(url, options) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    var res;
    try {
      options.signal = ctrl.signal;
      res = await fetch(url, options);
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('เซิร์ฟเวอร์ตอบช้า กรุณาลองใหม่อีกครั้ง');
      throw new Error('เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    } finally {
      clearTimeout(timer);
    }
    var data;
    try { data = await res.json(); } catch (e) { throw new Error('ระบบตอบกลับผิดรูปแบบ กรุณาลองใหม่'); }
    if (!data.ok) {
      var err = new Error(data.error || 'เกิดข้อผิดพลาด');
      err.code = data.code || '';
      throw err;
    }
    return data;
  }

  function get(action) {
    return request(baseUrl() + '?action=' + encodeURIComponent(action), { method: 'GET' });
  }

  function post(payload) {
    return request(baseUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
  }

  /**
   * เตรียมรูปสลิป: ย่อให้ไม่เกิน 1280px แล้วแปลงเป็น JPEG
   * (รูปจากมือถือมักใหญ่เกิน 2 MB) คืนค่าเป็น base64 ไม่มี prefix
   */
  function prepareSlip(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('กรุณาเลือกรูปภาพ'));
      if (file.type !== 'image/jpeg' && file.type !== 'image/png') return reject(new Error('รองรับเฉพาะไฟล์ JPG และ PNG'));
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var max = 1280, w = img.width, h = img.height, scale = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * scale); c.height = Math.round(h * scale);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var b64 = c.toDataURL('image/jpeg', 0.85).split(',')[1];
        if (b64.length * 3 / 4 > 2 * 1024 * 1024) return reject(new Error('ไฟล์ใหญ่เกิน 2 MB กรุณาเลือกรูปอื่น'));
        resolve(b64);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('เปิดรูปไม่ได้ กรุณาเลือกไฟล์อื่น')); };
      img.src = url;
    });
  }

  /** แปลง "1=50,2=80" เป็น [{n:1,price:50},...] เรียงตามจำนวน */
  function parseTiers(str) {
    var out = [];
    String(str || '').split(/[,;\n]/).forEach(function (part) {
      var m = /^\s*(\d+)\s*=\s*(\d+(?:\.\d+)?)\s*$/.exec(part);
      if (m && Number(m[1]) >= 1) out.push({ n: Number(m[1]), price: Number(m[2]) });
    });
    return out.sort(function (a, b) { return a.n - b.n; });
  }

  /** ราคารวม qty หน่วย (ต้องตรงกับสูตรฝั่งเซิร์ฟเวอร์ tierPrice_) ใช้แสดงผลเท่านั้น */
  function tierPrice(base, tiersStr, qty) {
    var list = parseTiers(tiersStr);
    if (!list.length) return base * qty;
    var t = {}; list.forEach(function (x) { t[x.n] = x.price; });
    var sizes = list.map(function (x) { return x.n; });
    if (t[1] === undefined) { t[1] = base; sizes.push(1); }
    var best = [0];
    for (var i = 1; i <= qty; i++) {
      var m = Infinity;
      for (var k = 0; k < sizes.length; k++) {
        var s = sizes[k];
        if (s <= i && best[i - s] + t[s] < m) m = best[i - s] + t[s];
      }
      best[i] = m;
    }
    return Math.round(best[qty] * 100) / 100;
  }

  /** ยอดของรายการในออเดอร์ (ออเดอร์เก่าไม่มี lineTotal จึงใช้ ราคา x จำนวน) */
  function lineTotal(it) { return it.lineTotal !== undefined ? it.lineTotal : it.price * it.qty; }

  function baht(n) { return Number(n).toLocaleString('th-TH') + ' บาท'; }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  }

  window.Api = { get: get, post: post, prepareSlip: prepareSlip, esc: esc, baht: baht, fmtDate: fmtDate,
                 parseTiers: parseTiers, tierPrice: tierPrice, lineTotal: lineTotal };
})();
