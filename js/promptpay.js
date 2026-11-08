/**
 * สร้าง payload PromptPay QR (EMVCo / Thai QR Payment)
 * ใช้: PromptPay.payload('0812345678', 150.50)  -> ข้อความสำหรับแปลงเป็น QR
 */
(function () {
  function tlv(id, value) {
    var len = String(value.length);
    return id + (len.length < 2 ? '0' + len : len) + value;
  }

  // CRC16-CCITT (poly 0x1021, init 0xFFFF) ตามมาตรฐาน EMVCo
  function crc16(str) {
    var crc = 0xFFFF;
    for (var i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (var j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
        crc &= 0xFFFF;
      }
    }
    var hex = crc.toString(16).toUpperCase();
    return ('0000' + hex).slice(-4);
  }

  function payload(id, amount) {
    var target = String(id).replace(/[^0-9]/g, '');
    var accountTag, accountValue;
    if (target.length === 13) {                 // เลขบัตรประชาชน / เลขผู้เสียภาษี
      accountTag = '02'; accountValue = target;
    } else if (target.length === 10 || target.length === 9) {   // เบอร์มือถือ -> 0066 + เลขไม่รวม 0 นำหน้า
      accountTag = '01'; accountValue = '0066' + target.replace(/^0/, '');
    } else {
      throw new Error('PromptPay ID ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขบัตร 13 หลัก');
    }

    var hasAmount = typeof amount === 'number' && amount > 0;
    var merchant = tlv('00', 'A000000677010111') + tlv(accountTag, accountValue);

    var data =
      tlv('00', '01') +
      tlv('01', hasAmount ? '12' : '11') +      // 12 = ใช้ครั้งเดียว (มียอด), 11 = ใช้ซ้ำ
      tlv('29', merchant) +
      tlv('53', '764') +                         // สกุลเงินบาท
      (hasAmount ? tlv('54', amount.toFixed(2)) : '') +
      tlv('58', 'TH') +
      '6304';
    return data + crc16(data);
  }

  /** แปลงข้อความเป็นรูป QR (data URL) ด้วยไลบรารี qrcode-generator จาก CDN */
  function qrDataUrl(text) {
    if (typeof qrcode !== 'function') throw new Error('โหลดไลบรารี QR ไม่สำเร็จ');
    var qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createDataURL(6, 4);
  }

  window.PromptPay = { payload: payload, qrDataUrl: qrDataUrl };
})();
