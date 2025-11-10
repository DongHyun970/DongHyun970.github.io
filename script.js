const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwr6WoArv3AyykLkKjbo5AVYkMo6ZLDUaciWlo2kyHX0tnfnV9w07_vjHcTAGmG8AYHpw/exec"; // ⚠️ 이 URL을 새로 배포한 URL로 바꿔야 합니다.

// DOM 요소 맵핑
const codeReader = new ZXing.BrowserMultiFormatReader();
const videoElement = document.getElementById('preview');
const barcodeInput = document.getElementById('barcode');
const productInfo = document.getElementById('productInfo');
const saveBtn = document.getElementById('saveBtn');
const statusText = document.getElementById('status');

// 입력 필드 맵핑
const typeSelect = document.getElementById('type');
const productInput = document.getElementById('product');
const itemCodeInput = document.getElementById('itemCode');
const batchInput = document.getElementById('batch');
const qtyInput = document.getElementById('qty');
const managerSelect = document.getElementById('manager');
const rackSelect = document.getElementById('rack');
const columnInput = document.getElementById('column');
const levelInput = document.getElementById('level');
const sideSelect = document.getElementById('side');

/** 모든 입력 필드를 비웁니다. */
function clearInputs() {
    barcodeInput.value = '';
    productInput.value = '';
    itemCodeInput.value = '';
    batchInput.value = '';
    qtyInput.value = '';
    productInfo.innerHTML = '';
    statusText.textContent = '';
    rackSelect.value = '';
    columnInput.value = '';
    levelInput.value = '';
    sideSelect.value = '';
    managerSelect.value = '';
    typeSelect.value = '입고'; // 기본값 설정
    toggleLocationFields(); // 로케이션 필드 상태 초기화
}

/** 입출고 타입에 따라 로케이션 필드 활성화/비활성화 */
function toggleLocationFields() {
    const isIncoming = typeSelect.value === '입고';
    rackSelect.disabled = !isIncoming;
    columnInput.disabled = !isIncoming;
    levelInput.disabled = !isIncoming;
    sideSelect.disabled = !isIncoming;
}

/** 바코드 스캐너를 시작합니다. */
async function startScanner() {
    clearInputs();
    
    try {
        const devices = await codeReader.listVideoInputDevices();
        const backCamera = devices.find(d => d.label.toLowerCase().includes('back')) || devices[0];
        
        await codeReader.decodeFromVideoDevice(backCamera.deviceId, videoElement, (result, err) => {
            if (result) {
                const scannedBarcode = result.text;
                if (barcodeInput.value !== scannedBarcode) {
                    barcodeInput.value = scannedBarcode;
                    loadProductInfo(scannedBarcode);
                }
            }
        }, { delay: 500 });
        
    } catch (e) {
        statusText.textContent = '카메라 불러오기 실패: ' + e.message;
    }
}

/** 바코드를 이용해 상품 정보를 스프레드시트에서 조회합니다. */
async function loadProductInfo(barcode) {
    productInfo.innerHTML = '불러오는 중...';
    // 로케이션 필드 초기화
    rackSelect.value = ''; columnInput.value = ''; levelInput.value = ''; sideSelect.value = ''; 

    try {
        const res = await fetch(`${WEB_APP_URL}?barcode=${barcode}`);
        
        if (!res.ok) {
            // HTTP 403 (권한 없음) 또는 404 (URL 오류)를 여기서 정확히 잡아냅니다.
            throw new Error(`Apps Script 요청 실패: HTTP ${res.status}`);
        }
        
        // ⭐️⭐️ 핵심 수정: JSON 파싱 오류 회피를 위해 텍스트로 받은 후 수동으로 JSON 파싱 ⭐️⭐️
        const textData = await res.text();
        let data;
        try {
            data = JSON.parse(textData); 
        } catch (e) {
            console.error("JSON 파싱 오류:", e, "수신 텍스트:", textData.substring(0, 100));
            throw new Error(`데이터 파싱 오류: 서버 응답 형식이 유효하지 않습니다.`);
        }
        
        // Apps Script에서 반환한 JSON 객체에 error 필드가 있다면 (시트 없음 등)
        if (data && data.error) {
            throw new Error(`Apps Script 오류: ${data.error}`);
        }
        
        if (data.length > 0) {
            // 기존 상품 발견 로직
            const last = data[data.length - 1]; 
            
            productInput.value = last[1];
            itemCodeInput.value = last[2];
            
            // 로케이션 정보는 조회된 정보로 필드를 채웁니다.
            rackSelect.value = last[4];
            columnInput.value = last[5];
            levelInput.value = last[6];
            sideSelect.value = last[7];
            
            productInfo.innerHTML = `
                ✅ **재고 정보 발견**<br>
                상품: ${last[1]} / 코드: ${last[2]}<br>
                현재 수량: ${last[8]}<br>
                최근 위치: ${last[4]}-${last[5]}-${last[6]}-${last[7]}
            `;
        } else {
            // ⭐️⭐️ 연결은 성공했고, 바코드만 없는 경우: 신규 등록 유도 ⭐️⭐️
            productInfo.innerHTML = '⚠️ **신규 상품입니다.** 상품명과 코드를 입력하고 위치를 지정하세요.';
            productInput.value = '';
            itemCodeInput.value = '';
        }
    } catch (err) {
        productInfo.innerHTML = '❌ 조회 실패: ' + err.message;
        statusText.textContent = '⚠️ 연결 오류: ' + err.message;
    }
}

/** 저장 버튼 클릭 이벤트 처리 */
saveBtn.addEventListener('click', async () => {
    const payload = {
        type: typeSelect.value,
        barcode: barcodeInput.value,
        product: productInput.value,
        itemCode: itemCodeInput.value,
        batch: batchInput.value,
        qty: qtyInput.value,
        manager: managerSelect.value,
        rack: rackSelect.value,
        column: columnInput.value,
        level: levelInput.value,
        side: sideSelect.value,
    };
    
    // 필수 유효성 검사
    if (!payload.barcode || !payload.qty || !payload.batch || !payload.manager) {
        alert('바코드, 수량, 배치번호, 작업자는 필수입니다.');
        return;
    }
    
    // 입고 시 로케이션 필수 검사
    if (payload.type === '입고') {
        if (!payload.rack || !payload.column || !payload.level || !payload.side) {
            alert('입고 시에는 랙, 열, 층, 측면 정보를 반드시 입력(선택)해야 합니다.');
            return;
        }
    }

statusText.textContent = '저장 중...';

    try {
        const res = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        // ⭐️⭐️ 핵심 수정: HTTP 오류 코드가 떴는지 확인 (403, 404 등) ⭐️⭐️
        if (!res.ok) {
            // 이 오류는 주로 403 Forbidden (권한) 문제일 때 발생합니다.
            throw new Error(`Apps Script 요청 실패: HTTP ${res.status}. 배포 권한을 확인하세요.`);
        }

        // POST 요청의 응답은 텍스트로 받습니다.
        const result = await res.text();
        
        if (result.startsWith('❌') || result.startsWith('오류:')) {
            statusText.textContent = `❌ 서버 처리 오류: ${result}`;
        } else {
            statusText.textContent = `✅ 저장 완료: ${result}`;
            clearInputs();
        }
        
    } catch (e) {
        statusText.textContent = '⚠️ 오류: Apps Script에 연결할 수 없습니다. ' + e.message;
    }
});

// 입출고 타입 변경 시 로케이션 필드 상태 토글
typeSelect.addEventListener('change', toggleLocationFields);

// 초기 실행
startScanner();



