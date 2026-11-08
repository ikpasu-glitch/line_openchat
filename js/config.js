/**
 * ค่าตั้งค่าฝั่งหน้าเว็บ (ไฟล์นี้เป็น Public ห้ามใส่รหัสผ่าน/คีย์ลับ)
 * แก้ 3 ค่านี้ก่อนใช้งานจริง
 */
window.SHOP_CONFIG = {
  // URL ของ Apps Script Web App (ได้หลัง Deploy) เช่น https://script.google.com/macros/s/XXXX/exec
  API_URL: 'https://script.google.com/macros/s/AKfycbxLyUlqa06WuDBLXkzqCtFqXinqiRHvd7V3xlzmGFfq8erGAK64dJcJlnuka2xRsZft/exec',

  // ชื่อร้าน (ใช้เป็นค่าสำรองถ้าในชีต Settings ไม่ได้ตั้ง shopName)
  SHOP_NAME: 'ร้านตัวอย่าง',

  // PromptPay ID: เบอร์มือถือ 10 หลัก (เช่น 0812345678) หรือเลขบัตรประชาชน 13 หลัก
  PROMPTPAY_ID: '0812345678',

  // ข้อความบัญชีสำรอง แสดงใต้ QR (เผื่อสแกนไม่ได้)
  BACKUP_ACCOUNT: 'ธนาคารตัวอย่าง เลขที่ 000-0-00000-0 ชื่อบัญชี ร้านตัวอย่าง'
};
