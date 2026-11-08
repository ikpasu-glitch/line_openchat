/** หน้าแอดมิน: ล็อกอิน ออเดอร์ สต๊อก สินค้า ประวัติ */
(function () {
  var esc = Api.esc, baht = Api.baht;
  var $ = function (id) { return document.getElementById(id); };
  var TOKEN_KEY = 'shop_admin_token';

  var S = { token: '', orders: [], statuses: [], products: [], filter: '', open: {}, tab: 'orders' };

  // ---------- เรียก API แอดมิน (แนบ token เสมอ) ----------
  function token() { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return S.token; } }
  function saveToken(t) { S.token = t; try { sessionStorage.setItem(TOKEN_KEY, t); } catch (e) {} }
  function clearToken() { S.token = ''; try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  async function call(action, extra) {
    var payload = Object.assign({ action: action, token: token() }, extra || {});
    try {
      return await Api.post(payload);
    } catch (e) {
      if (e.code === 'AUTH') { logout(e.message); }
      throw e;
    }
  }

  function flash(msg, kind) {
    $('flash').innerHTML = msg ? '<div class="msg ' + (kind || 'ok') + '">' + esc(msg) + '</div>' : '';
    if (msg) setTimeout(function () { $('flash').innerHTML = ''; }, 4000);
  }

  // ---------- ล็อกอิน / ออก ----------
  function showApp(on) {
    $('loginForm').classList.toggle('hidden', on);
    $('app').classList.toggle('hidden', !on);
    $('logoutBtn').classList.toggle('hidden', !on);
  }

  function logout(msg) {
    clearToken(); showApp(false);
    var e = $('loginErr'); e.textContent = msg || ''; e.classList.toggle('hidden', !msg);
  }

  $('loginForm').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var btn = $('loginBtn'), err = $('loginErr'); err.classList.add('hidden');
    btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ...';
    try {
      var res = await Api.post({ action: 'adminLogin', password: $('pw').value.trim() });
      saveToken(res.token); $('pw').value = '';
      showApp(true); switchTab('orders');
    } catch (e) {
      err.textContent = e.message; err.classList.remove('hidden');
    } finally { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
  });
  $('logoutBtn').addEventListener('click', function () { logout(''); });
  $('showPw').addEventListener('change', function () { $('pw').type = this.checked ? 'text' : 'password'; });

  // ---------- แท็บ ----------
  function switchTab(name) {
    S.tab = name;
    document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    ['orders', 'stock', 'products', 'log'].forEach(function (t) { $('tab-' + t).classList.toggle('hidden', t !== name); });
    ({ orders: loadOrders, stock: loadStock, products: loadProducts, log: loadLog })[name]();
  }
  document.querySelector('.tabs').addEventListener('click', function (ev) {
    if (ev.target.dataset.tab) switchTab(ev.target.dataset.tab);
  });

  function loading(id) { $(id).innerHTML = '<div class="spinner">กำลังโหลด...</div>'; }
  function failBox(id, e) { $(id).innerHTML = '<div class="msg error">' + esc(e.message) + '</div>'; }

  function badge(s) {
    var c = { 'รอชำระ': 'yellow', 'รอตรวจสลิป': 'blue', 'ชำระแล้ว': 'green', 'จัดส่งแล้ว': 'green', 'ยกเลิก': 'red' }[s] || '';
    return '<span class="badge ' + c + '">' + esc(s) + '</span>';
  }

  // =============== ออเดอร์ ===============
  async function loadOrders() {
    loading('tab-orders');
    try {
      var res = await call('adminListOrders');
      S.orders = res.orders; S.statuses = res.statuses;
      renderOrders();
    } catch (e) { failBox('tab-orders', e); }
  }

  function renderOrders() {
    var list = S.orders.filter(function (o) { return !S.filter || o.status === S.filter; });
    var opts = '<option value="">ทุกสถานะ</option>' + S.statuses.map(function (s) {
      return '<option' + (s === S.filter ? ' selected' : '') + '>' + esc(s) + '</option>';
    }).join('');
    var html = '<div class="row"><select id="orderFilter" style="max-width:200px">' + opts + '</select>' +
      '<button class="secondary small" data-act="reloadOrders" type="button">รีเฟรช</button></div>';
    if (!list.length) html += '<p class="muted">ไม่มีออเดอร์</p>';
    html += list.map(orderCard).join('');
    $('tab-orders').innerHTML = html;
  }

  function orderCard(o) {
    var open = S.open[o.orderId];
    var head = '<div class="order-head" data-act="toggleOrder" data-id="' + esc(o.orderId) + '">' +
      '<div><strong>' + esc(o.orderId) + '</strong><br><span class="muted">' + esc(o.customerName) + ' · ' + esc(Api.fmtDate(o.createdAt)) + '</span></div>' +
      '<div style="text-align:right">' + badge(o.status) + '<br><strong>' + esc(baht(o.total)) + '</strong></div></div>';
    if (!open) return '<div class="card">' + head + '</div>';

    var items = o.items.map(function (it) {
      return '<div class="row"><span>' + esc(it.name) + ' × ' + esc(it.qty) + '</span><span>' + esc(baht(it.price * it.qty)) + '</span></div>';
    }).join('');
    var locked = o.status === 'ยกเลิก';
    var statusBtns = locked ? '' : S.statuses.filter(function (s) { return s !== o.status && s !== 'ยกเลิก'; }).map(function (s) {
      return '<button class="small" data-act="setStatus" data-id="' + esc(o.orderId) + '" data-status="' + esc(s) + '" type="button">→ ' + esc(s) + '</button>';
    }).join('');
    return '<div class="card">' + head + '<hr style="border:0;border-top:1px solid var(--line)">' +
      '<div><strong>' + esc(o.customerName) + '</strong> · <a href="tel:' + esc(o.phone) + '">' + esc(o.phone) + '</a></div>' +
      '<pre class="addr">' + esc(o.address) + '</pre>' +
      '<button class="secondary small" data-act="copyAddr" data-id="' + esc(o.orderId) + '" type="button">คัดลอกที่อยู่จัดส่ง</button>' +
      items +
      '<div class="row"><span>ค่าส่ง</span><span>' + (o.shipping ? esc(baht(o.shipping)) : 'ฟรี') + '</span></div>' +
      '<div class="row total"><span>รวม</span><span>' + esc(baht(o.total)) + '</span></div>' +
      (o.slipUrl ? '<p><a href="' + esc(o.slipUrl) + '" target="_blank" rel="noopener noreferrer">เปิดรูปสลิป (ต้องล็อกอิน Google ของเจ้าของร้าน)</a></p>' : '<p class="muted">ยังไม่มีสลิป</p>') +
      (locked ? '' :
        '<label>เลขพัสดุ</label><input id="trk_' + esc(o.orderId) + '" value="' + esc(o.trackingNo) + '" maxlength="50">' +
        '<label>หมายเหตุ</label><input id="note_' + esc(o.orderId) + '" value="' + esc(o.note) + '" maxlength="300">' +
        '<div class="actions"><button class="small" data-act="saveInfo" data-id="' + esc(o.orderId) + '" type="button">บันทึกเลขพัสดุ/หมายเหตุ</button></div>' +
        '<div class="actions">' + statusBtns + '<button class="danger small" data-act="cancelOrder" data-id="' + esc(o.orderId) + '" type="button">ยกเลิก + คืนสต๊อก</button></div>') +
      '</div>';
  }

  function findOrder(id) { return S.orders.filter(function (o) { return o.orderId === id; })[0]; }

  async function updateOrder(id, fields, okMsg) {
    try {
      await call('adminUpdateOrder', Object.assign({ orderId: id }, fields));
      flash(okMsg);
      await loadOrders();
    } catch (e) { flash(e.message, 'error'); }
  }

  // =============== สต๊อก ===============
  async function loadStock() {
    loading('tab-stock');
    try {
      S.products = (await call('adminListProducts')).products;
      var rows = S.products.map(function (p) {
        var low = p.stock <= p.reorderLevel;
        return '<tr class="' + (low ? 'low' : '') + '"><td>' + esc(p.id) + '</td><td>' + esc(p.name) + (p.active ? '' : ' <span class="badge">ซ่อน</span>') + '</td>' +
          '<td><strong>' + esc(p.stock) + '</strong>' + (low ? ' <span class="badge red">ต่ำ</span>' : '') + '<div class="muted">จุดสั่งซื้อ ' + esc(p.reorderLevel) + '</div></td>' +
          '<td><button class="small" data-act="stockAdd" data-id="' + esc(p.id) + '" type="button">+ เพิ่ม</button> ' +
          '<button class="small danger" data-act="stockSub" data-id="' + esc(p.id) + '" type="button">− ลด</button></td></tr>';
      }).join('');
      $('tab-stock').innerHTML = '<div class="tablewrap"><table><tr><th>รหัส</th><th>สินค้า</th><th>คงเหลือ</th><th></th></tr>' + rows + '</table></div>';
    } catch (e) { failBox('tab-stock', e); }
  }

  var stockCtx = null;
  var REASONS = {
    add: ['รับของเข้า', 'ลูกค้าคืนสินค้า', 'อื่นๆ'],
    sub: ['ของเสีย/ชำรุด', 'ขายหน้าร้าน', 'ของหาย', 'อื่นๆ']
  };
  function openStock(id, mode) {
    var p = S.products.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    stockCtx = { id: id, mode: mode };
    $('stockTitle').textContent = (mode === 'add' ? 'เพิ่มสต๊อก: ' : 'ลดสต๊อก: ') + p.name + ' (คงเหลือ ' + p.stock + ')';
    $('sQty').value = '';
    $('sReasonSel').innerHTML = REASONS[mode].map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('');
    $('sReason').value = ''; $('stockErr').classList.add('hidden');
    $('stockDlg').showModal();
  }
  $('stockCancel').addEventListener('click', function () { $('stockDlg').close(); });
  $('stockForm').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var qty = Number($('sQty').value), sel = $('sReasonSel').value, extra = $('sReason').value.trim();
    var reason = extra ? sel + ': ' + extra : sel;
    var err = $('stockErr'); err.classList.add('hidden');
    if (!(qty >= 1) || qty % 1 !== 0) { err.textContent = 'จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1'; err.classList.remove('hidden'); return; }
    $('stockOk').disabled = true;
    try {
      await call('adminAdjustStock', { productId: stockCtx.id, delta: stockCtx.mode === 'add' ? qty : -qty, reason: reason });
      $('stockDlg').close(); flash('บันทึกสต๊อกแล้ว'); loadStock();
    } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
    finally { $('stockOk').disabled = false; }
  });

  // =============== สินค้า ===============
  async function loadProducts() {
    loading('tab-products');
    try {
      S.products = (await call('adminListProducts')).products;
      var rows = S.products.map(function (p) {
        return '<tr><td>' + esc(p.id) + '</td><td>' + esc(p.name) + '<div class="muted">' + esc(p.category) + '</div></td>' +
          '<td>' + esc(baht(p.price)) + '<div class="muted">ทุน ' + esc(p.cost) + '</div></td>' +
          '<td><button class="small secondary" data-act="editProd" data-id="' + esc(p.id) + '" type="button">แก้ไข</button> ' +
          '<button class="small ' + (p.active ? 'danger' : '') + '" data-act="toggleProd" data-id="' + esc(p.id) + '" data-active="' + (p.active ? '0' : '1') + '" type="button">' + (p.active ? 'ซ่อน' : 'แสดง') + '</button></td></tr>';
      }).join('');
      $('tab-products').innerHTML = '<button data-act="newProd" type="button" style="margin-bottom:10px">+ เพิ่มสินค้าใหม่</button>' +
        '<div class="tablewrap"><table><tr><th>รหัส</th><th>สินค้า</th><th>ราคา</th><th></th></tr>' + rows + '</table></div>';
    } catch (e) { failBox('tab-products', e); }
  }

  var prodId = '';
  function openProd(id) {
    var p = id ? S.products.filter(function (x) { return x.id === id; })[0] : null;
    prodId = p ? p.id : '';
    $('prodTitle').textContent = p ? 'แก้ไขสินค้า ' + p.id : 'เพิ่มสินค้าใหม่';
    $('pName').value = p ? p.name : ''; $('pCat').value = p ? p.category : '';
    $('pPrice').value = p ? p.price : ''; $('pCost').value = p ? p.cost : 0;
    $('pReorder').value = p ? p.reorderLevel : 0; $('pImg').value = p ? p.imageUrl : '';
    $('pDesc').value = p ? p.description : ''; $('pInit').value = 0;
    $('pInitWrap').classList.toggle('hidden', !!p);        // สต๊อกของสินค้าเดิมแก้ที่แท็บสต๊อกเท่านั้น
    $('prodErr').classList.add('hidden');
    $('pImgFile').value = ''; $('pImgMsg').textContent = '';
    setPreview();
    $('prodDlg').showModal();
  }

  /** แสดงรูปตัวอย่างจากลิงก์ในช่อง pImg (เฉพาะ https) */
  function setPreview() {
    var url = $('pImg').value.trim(), img = $('pImgPreview');
    if (/^https:\/\//i.test(url)) { img.src = url; img.classList.remove('hidden'); }
    else { img.removeAttribute('src'); img.classList.add('hidden'); }
  }
  $('pImg').addEventListener('input', setPreview);

  // เลือกรูปจากเครื่อง -> ย่อรูป -> อัปโหลดขึ้น Drive -> ได้ลิงก์ใส่ช่อง pImg อัตโนมัติ
  $('pImgFile').addEventListener('change', async function () {
    var file = this.files[0]; if (!file) return;
    var msg = $('pImgMsg'), ok = $('prodOk');
    msg.textContent = 'กำลังอัปโหลดรูป...'; ok.disabled = true;
    try {
      var b64 = await Api.prepareSlip(file);
      var res = await call('adminUploadProductImage', { imageBase64: b64 });
      $('pImg').value = res.url; setPreview();
      msg.textContent = 'อัปโหลดรูปสำเร็จ (กด "บันทึก" เพื่อใช้รูปนี้)';
    } catch (e) {
      msg.textContent = 'อัปโหลดไม่สำเร็จ: ' + e.message;
    } finally { ok.disabled = false; }
  });
  $('prodCancel').addEventListener('click', function () { $('prodDlg').close(); });
  $('prodForm').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var err = $('prodErr'); err.classList.add('hidden');
    $('prodOk').disabled = true;
    try {
      await call('adminUpsertProduct', { product: {
        id: prodId, name: $('pName').value, category: $('pCat').value, price: Number($('pPrice').value),
        cost: Number($('pCost').value || 0), reorderLevel: Number($('pReorder').value || 0),
        imageUrl: $('pImg').value, description: $('pDesc').value, initialStock: Number($('pInit').value || 0),
        active: true
      } });
      $('prodDlg').close(); flash('บันทึกสินค้าแล้ว'); loadProducts();
    } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
    finally { $('prodOk').disabled = false; }
  });

  // =============== ประวัติ ===============
  async function loadLog() {
    loading('tab-log');
    try {
      var logs = (await call('adminListStockLog', {})).logs;
      var names = {}; S.products.forEach(function (p) { names[p.id] = p.name; });
      var rows = logs.map(function (l) {
        return '<tr><td>' + esc(Api.fmtDate(l.timestamp)) + '</td><td>' + esc(names[l.productId] || l.productId) + '</td>' +
          '<td>' + esc(l.type) + '</td><td>' + (l.qty > 0 ? '+' : '') + esc(l.qty) + '<div class="muted">' + esc(l.before) + ' → ' + esc(l.after) + '</div></td>' +
          '<td>' + esc(l.actor) + '<div class="muted">' + esc(l.ref) + ' ' + esc(l.note) + '</div></td></tr>';
      }).join('');
      $('tab-log').innerHTML = '<div class="tablewrap"><table><tr><th>เวลา</th><th>สินค้า</th><th>ประเภท</th><th>จำนวน</th><th>โดย/หมายเหตุ</th></tr>' +
        (rows || '<tr><td colspan="5" class="muted">ยังไม่มีประวัติ</td></tr>') + '</table></div>';
    } catch (e) { failBox('tab-log', e); }
  }

  // =============== ปุ่มต่างๆ (event delegation) ===============
  document.addEventListener('click', async function (ev) {
    var el = ev.target.closest('[data-act]'); if (!el) return;
    var act = el.dataset.act, id = el.dataset.id;
    if (act === 'reloadOrders') loadOrders();
    else if (act === 'toggleOrder') { S.open[id] = !S.open[id]; renderOrders(); }
    else if (act === 'setStatus') updateOrder(id, { status: el.dataset.status }, 'เปลี่ยนสถานะเป็น "' + el.dataset.status + '" แล้ว');
    else if (act === 'saveInfo') updateOrder(id, { trackingNo: $('trk_' + id).value, note: $('note_' + id).value }, 'บันทึกแล้ว');
    else if (act === 'cancelOrder') {
      if (confirm('ยกเลิกออเดอร์ ' + id + ' และคืนสต๊อก? (ย้อนกลับไม่ได้)')) updateOrder(id, { status: 'ยกเลิก' }, 'ยกเลิกและคืนสต๊อกแล้ว');
    }
    else if (act === 'copyAddr') {
      var o = findOrder(id), text = o.customerName + ' ' + o.phone + '\n' + o.address;
      try { await navigator.clipboard.writeText(text); flash('คัดลอกที่อยู่แล้ว'); } catch (e) { flash('คัดลอกไม่สำเร็จ', 'error'); }
    }
    else if (act === 'stockAdd') openStock(id, 'add');
    else if (act === 'stockSub') openStock(id, 'sub');
    else if (act === 'newProd') openProd('');
    else if (act === 'editProd') openProd(id);
    else if (act === 'toggleProd') {
      try { await call('adminToggleProduct', { productId: id, active: el.dataset.active === '1' }); loadProducts(); }
      catch (e) { flash(e.message, 'error'); }
    }
  });
  document.addEventListener('change', function (ev) {
    if (ev.target.id === 'orderFilter') { S.filter = ev.target.value; renderOrders(); }
  });

  // ---------- เริ่มต้น: ถ้ายังมี token ใน session ให้ใช้ต่อ ----------
  if (token()) { S.token = token(); showApp(true); switchTab('orders'); }
})();
