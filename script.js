const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzaFF1zzcXg21ACQ3LdvKyXKE7Trn4Ch5Ml0Hqff_msnUdIMl0sE29h0KjGWq9yGRY/exec";

const codeReader = new ZXing.BrowserMultiFormatReader();
const videoElement = document.getElementById('preview');
const barcodeInput = document.getElementById('barcode');
const productInfo = document.getElementById('productInfo');
const saveBtn = document.getElementById('saveBtn');
const statusText = document.getElementById('status');

async function startScanner() {
  try {
    const devices = await codeReader.listVideoInputDevices();
    const backCamera = devices.find(d => d.label.toLowerCase().includes('back')) || devices[0];
    await codeReader.decodeFromVideoDevice(backCamera.deviceId, videoElement, (result, err) => {
      if (result) {
        barcodeInput.value = result.text;
        loadProductInfo(result.text);
      }
    });
  } catch (e) {
    statusText.textContent = '카메라 불러오기 실패: ' + e;
  }
}

async function loadProductInfo(barcode) {
  productInfo.innerHTML = '불러오는 중...';
  try {
    const res = await fetch(`${WEB_APP_URL}?barcode=${barcode}`);
    const data = await res.json();
    if (data.length > 0) {
      const last = data[data.length - 1];
      document.getElementById('product').value = last[1];
      document.getElementById('itemCode').value = last[2];
      productInfo.innerHTML = `최근 배치: ${last[3]} / 수량: ${last[8]} / 위치: ${last[4]}-${last[5]}-${last[6]}-${last[7]}`;
    } else {
      productInfo.innerHTML = '신규 상품입니다.';
      document.getElementById('product').value = '';
      document.getElementById('itemCode').value = '';
    }
  } catch (err) {
    productInfo.innerHTML = '조회 실패';
  }
}

saveBtn.addEventListener('click', async () => {
  const payload = {
    type: document.getElementById('type').value,
    barcode: barcodeInput.value,
    product: document.getElementById('product').value,
    itemCode: document.getElementById('itemCode').value,
    batch: document.getElementById('batch').value,
    rack: document.getElementById('rack').value,
    column: document.getElementById('column').value,
    level: document.getElementById('level').value,
    side: document.getElementById('side').value,
    qty: document.getElementById('qty').value,
    manager: document.getElementById('manager').value
  };

  if (!payload.barcode || !payload.qty || !payload.batch) {
    alert('바코드, 수량, 배치번호는 필수입니다.');
    return;
  }

  statusText.textContent = '저장 중...';

  try {
    const res = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.text();
    statusText.textContent = `✅ ${result}`;
  } catch (e) {
    statusText.textContent = '⚠️ 오류: ' + e.message;
  }
});

startScanner();
