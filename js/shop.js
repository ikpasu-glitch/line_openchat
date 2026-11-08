/** ตรรกะหน้าร้าน: โหลดสินค้า ตะกร้า checkout แสดง QR แนบสลิป */
(function () {
  var esc = Api.esc, baht = Api.baht;
  var $ = function (id) { return document.getElementById(id); };

  var state = { products: [], config: {}, cart: {}, category: 'ทั้งหมด', submitting: false, order: null, phone: '' };

  // ---------- โหลดสินค้า ----------
  async function load() {
    try {
      var data = await Api.get('products');
      state.products = data.products;
      state.config = data.config;
      $('shopName').textContent = SHOP_CONFIG.SHOP_NAME || data.config.shopName;
      document.title = $('shopName').textContent;
      $('loading').classList.add('hidden');
      renderChips();
      renderGrid();
    } catch (e) {
      $('loading').classList.add('hidden');
      var box = $('loadError');
      box.textContent = e.message + ' — ลองรีเฟรชหน้านี้อีกครั้ง';
      box.classList.remove('hidden');
    }
  }

  function findProduct(id) { return state.products.filter(function (p) { return p.id === id; })[0]; }

  // ---------- แสดงสินค้า ----------
  function renderChips() {
    var cats = ['ทั้งหมด'];
    state.products.forEach(function (p) { if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category); });
    $('chips').innerHTML = cats.map(function (c) {
      return '<button type="button" class="chip' + (c === state.category ? ' active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
  }

  function safeImg(url) { return /^https:\/\//i.test(url) ? url : ''; }

  function renderGrid() {
    var list = state.products.filter(function (p) { return state.category === 'ทั้งหมด' || p.category === state.category; });
    if (!list.length) { $('grid').innerHTML = '<p class="muted">ยังไม่มีสินค้า</p>'; return; }
    $('grid').innerHTML = list.map(function (p) {
      var q = state.cart[p.id] || 0, out = p.stock <= 0;
      var img = safeImg(p.imageUrl), tiers = Api.parseTiers(p.priceTiers);
      return '<div class="product' + (out ? ' soldout' : '') + '">' +
        '<div class="img"' + (img ? ' style="background-image:url(\'' + esc(encodeURI(img)) + '\')"' : '') + '>' + (img ? '' : '🛍️') + '</div>' +
        '<div class="body"><div class="name">' + esc(p.name) + '</div>' +
        '<div class="muted">' + esc(p.description) + '</div>' +
        '<div class="price">' + (tiers.length ? 'เริ่ม ' : '') + esc(baht(p.price)) + (tiers.length ? ' / กรัม' : '') + '</div>' +
        (tiers.length && !out ? '<div class="tiers">' + tiers.map(function (t) {
          return '<button type="button" class="tier' + (q === t.n ? ' on' : '') + '" data-set="' + esc(p.id) + '" data-n="' + t.n + '"' + (t.n > p.stock ? ' disabled' : '') + '>' +
            t.n + ' ก.<br>' + esc(t.price) + '฿</button>';
        }).join('') + '</div>' : '') +
        (out ? '<span class="badge red">สินค้าหมด</span>' :
          '<div class="qty"><button type="button" data-dec="' + esc(p.id) + '"' + (q ? '' : ' disabled') + '>−</button>' +
          '<span>' + q + (tiers.length ? ' ก.' : '') + '</span>' +
          '<button type="button" data-inc="' + esc(p.id) + '"' + (q >= p.stock ? ' disabled' : '') + '>+</button></div>') +
        '</div></div>';
    }).join('');
  }

  // ---------- ตะกร้า ----------
  function cartItems() {
    return Object.keys(state.cart).map(function (id) {
      var p = findProduct(id);
      return p ? { p: p, qty: state.cart[id] } : null;
    }).filter(Boolean);
  }

  function totals() {
    var sub = 0, count = 0;
    cartItems().forEach(function (it) { sub += Api.tierPrice(it.p.price, it.p.priceTiers, it.qty); count += it.qty; });
    var c = state.config;
    var ship = count === 0 ? 0 : (c.freeShippingOver > 0 && sub >= c.freeShippingOver ? 0 : c.shippingFee);
    return { sub: sub, count: count, ship: ship, total: sub + ship };
  }

  function changeQty(id, delta) {
    var p = findProduct(id); if (!p) return;
    var q = Math.max(0, Math.min(p.stock, (state.cart[id] || 0) + delta));
    if (q === 0) delete state.cart[id]; else state.cart[id] = q;
    renderGrid(); renderCart();
  }

  function renderCart() {
    var t = totals();
    $('cartCount').textContent = t.count;
    $('cartTotal').textContent = baht(t.sub);
    $('openCart').disabled = t.count === 0;

    var items = cartItems();
    if (!items.length) { $('cartLines').innerHTML = '<p class="muted">ยังไม่มีสินค้าในตะกร้า</p>'; return; }
    var freeNote = state.config.freeShippingOver > 0 && t.ship > 0
      ? '<div class="muted">ซื้อครบ ' + esc(baht(state.config.freeShippingOver)) + ' ส่งฟรี</div>' : '';
    $('cartLines').innerHTML = items.map(function (it) {
      var tiered = Api.parseTiers(it.p.priceTiers).length > 0;
      return '<div class="row"><span>' + esc(it.p.name) + ' × ' + it.qty + (tiered ? ' ก.' : '') + '</span><span>' + esc(baht(Api.tierPrice(it.p.price, it.p.priceTiers, it.qty))) + '</span></div>';
    }).join('') +
      '<div class="row"><span>ค่าสินค้า</span><span>' + esc(baht(t.sub)) + '</span></div>' +
      '<div class="row"><span>ค่าส่ง</span><span>' + (t.ship === 0 ? 'ฟรี' : esc(baht(t.ship))) + '</span></div>' +
      '<div class="row total"><span>รวมทั้งหมด</span><span>' + esc(baht(t.total)) + '</span></div>' + freeNote +
      '<div class="muted">ยอดสุดท้ายคำนวณโดยระบบหลังกดสั่งซื้อ</div>';
  }

  function openDrawer(open) {
    $('drawer').classList.toggle('hidden', !open);
    $('drawerBg').classList.toggle('hidden', !open);
    if (open) renderCart();
  }

  // ---------- ส่งออเดอร์ ----------
  function showFormError(msg) {
    var b = $('formError');
    b.textContent = msg; b.classList.toggle('hidden', !msg);
  }

  async function submitOrder(ev) {
    ev.preventDefault();
    if (state.submitting) return;                 // กันกดซ้ำ
    showFormError('');
    var name = $('fName').value.trim(), phone = $('fPhone').value.replace(/[\s-]/g, ''),
        address = $('fAddress').value.trim(), note = $('fNote').value.trim();
    if (!name) return showFormError('กรุณากรอกชื่อ');
    if (!/^0\d{8,9}$/.test(phone)) return showFormError('เบอร์โทรไม่ถูกต้อง (ตัวอย่าง 0812345678)');
    if (address.length < 10) return showFormError('กรุณากรอกที่อยู่จัดส่งให้ครบถ้วน');
    if (!$('fPdpa').checked) return showFormError('กรุณายอมรับการเก็บข้อมูลก่อนสั่งซื้อ');
    if (!cartItems().length) return showFormError('ตะกร้าว่างเปล่า');

    state.submitting = true;
    var btn = $('submitOrder'); btn.disabled = true; btn.textContent = 'กำลังส่งออเดอร์...';
    try {
      var res = await Api.post({
        action: 'createOrder', customerName: name, phone: phone, address: address, note: note, pdpaAccepted: true,
        items: cartItems().map(function (it) { return { id: it.p.id, qty: it.qty }; })
      });
      state.order = res; state.phone = phone;
      showDone(res);
    } catch (e) {
      showFormError(e.message);
      load();                                      // รีเฟรชสต๊อกล่าสุด
    } finally {
      state.submitting = false; btn.disabled = false; btn.textContent = 'ยืนยันสั่งซื้อ';
    }
  }

  // ---------- หน้าสำเร็จ: QR + แนบสลิป ----------
  function showDone(o) {
    openDrawer(false);
    $('cartBar').classList.add('hidden');
    $('viewShop').classList.add('hidden');
    $('viewDone').classList.remove('hidden');
    $('doneOrderId').textContent = o.orderId;
    $('doneTotal').textContent = baht(o.total);
    $('doneBreakdown').textContent = 'ค่าสินค้า ' + baht(o.subtotal) + ' + ค่าส่ง ' + (o.shipping ? baht(o.shipping) : 'ฟรี');
    $('backupAccount').textContent = SHOP_CONFIG.BACKUP_ACCOUNT || '';
    try {
      $('qrImg').src = PromptPay.qrDataUrl(PromptPay.payload(SHOP_CONFIG.PROMPTPAY_ID, o.total));
    } catch (e) {
      $('qrImg').classList.add('hidden');
      $('backupAccount').textContent = 'สร้าง QR ไม่สำเร็จ กรุณาโอนเข้าพร้อมเพย์ ' + SHOP_CONFIG.PROMPTPAY_ID + (SHOP_CONFIG.BACKUP_ACCOUNT ? ' หรือ ' + SHOP_CONFIG.BACKUP_ACCOUNT : '');
    }
    window.scrollTo(0, 0);
  }

  async function sendSlip() {
    var msg = $('slipMsg'), btn = $('slipBtn');
    msg.innerHTML = '';
    try {
      var b64 = await Api.prepareSlip($('slipFile').files[0]);
      btn.disabled = true; btn.textContent = 'กำลังส่งสลิป...';
      await Api.post({ action: 'uploadSlip', orderId: state.order.orderId, phone: state.phone, slipBase64: b64 });
      msg.innerHTML = '<div class="msg ok">ขอบคุณค่ะ ได้รับสลิปแล้ว ร้านจะตรวจสอบโดยเร็ว<br>โปรดจดเลขออเดอร์ <strong>' + esc(state.order.orderId) + '</strong> ไว้เช็คสถานะ</div>';
      btn.textContent = 'ส่งสลิปแล้ว';
    } catch (e) {
      msg.innerHTML = '<div class="msg error">' + esc(e.message) + '</div>';
      btn.disabled = false; btn.textContent = 'ส่งสลิป';
    }
  }

  // ---------- events ----------
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var tb = t.closest ? t.closest('[data-set]') : null;
    if (tb) {                                      // กดปุ่มขนาด เช่น 3 ก. = ตั้งจำนวนเป็น 3
      var tp = findProduct(tb.dataset.set);
      if (tp) {
        var want = Number(tb.dataset.n);
        if (state.cart[tp.id] === want) delete state.cart[tp.id]; else state.cart[tp.id] = Math.min(want, tp.stock);
        renderGrid(); renderCart();
      }
    }
    else if (t.dataset.inc) changeQty(t.dataset.inc, 1);
    else if (t.dataset.dec) changeQty(t.dataset.dec, -1);
    else if (t.dataset.cat) { state.category = t.dataset.cat; renderChips(); renderGrid(); }
  });
  $('openCart').addEventListener('click', function () { openDrawer(true); });
  $('closeCart').addEventListener('click', function () { openDrawer(false); });
  $('drawerBg').addEventListener('click', function () { openDrawer(false); });
  $('orderForm').addEventListener('submit', submitOrder);
  $('slipBtn').addEventListener('click', sendSlip);
  $('copyOrderId').addEventListener('click', function () {
    if (navigator.clipboard) navigator.clipboard.writeText(state.order.orderId).then(function () { $('copyOrderId').textContent = 'คัดลอกแล้ว ✓'; });
  });

  renderCart();
  load();
})();
