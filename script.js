const codeReader = new ZXing.BrowserMultiFormatReader();
const videoElement = document.getElementById('preview');
const barcodeInput = document.getElementById('barcode');
const saveBtn = document.getElementById('saveBtn');
const statusText = document.getElementById('status');

async function startScanner() {
  try {
    const devices = await codeReader.listVideoInputDevices();
    const backCamera = devices.find(d => d.label.toLowerCase().includes('back')) || devices[0];
    await codeReader.decodeFromVideoDevice(backCamera.deviceId, videoElement, (result, err) => {
      if (result) {
        barcodeInput.value = result.text;
      }
    });
  } catch (e) {
    statusText.textContent = '카메라를 불러오지 못했습니다: ' + e;
  }
}

startScanner();

// 저장 버튼 클릭 시 Google Sheets API 호출
saveBtn.addEventListener('click', async () => {
  const barcode = barcodeInput.value;
  const qty = document.getElementById('quantity').value;
  const loc = document.getElementById('location').value;
  const inout = document.getElementById('inout').value;

  if (!barcode) return alert('바코드가 인식되지 않았습니다.');

  statusText.textContent = '저장 중...';

  try {
    // Google Apps Script 웹앱 URL로 POST
    const response = await fetch('https://script.google.com/macros/s/웹앱_URL/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode, qty, loc, inout })
    });

    const text = await response.text();
    if (text === 'OK') statusText.textContent = '✅ 저장 완료';
    else statusText.textContent = '⚠️ 저장 실패: ' + text;
  } catch (e) {
    statusText.textContent = '⚠️ 오류: ' + e.message;
  }
});
