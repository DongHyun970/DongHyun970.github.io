const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzaFF1zzcXg21ACQ3LdvKyXKE7Trn4Ch5Ml0Hqff_msnUdIMl0sE29h0KjGWq9yGRY/exec";

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
}

/** 입출고 타입에 따라 로케이션 필드 활성화/비활성화 */
function toggleLocationFields() {
    const isIncoming = typeSelect.value === '입고';
    rackSelect.disabled = !isIncoming;
    columnInput.disabled = !isIncoming;
    levelInput.disabled = !isIncoming;
    sideSelect.disabled = !isIncoming;
    
    // 출고 시 로케이션 정보는 조회된 데이터로 보여주는 게 일반적.
    // 수동 입력을 막기 위해 비활성화합니다.
}

/** 바코드 스캐너를 시작합니다. */
async function startScanner() {
    clearInputs();
    toggleLocationFields(); // 초기 설정
    
    try {
        const devices = await codeReader.listVideoInputDevices();
        const backCamera = devices.find(d => d.label.toLowerCase().includes('back')) || devices[0];
        
        // 1초 간격으로 스캔하도록 최적화 (실제 사용 환경에 따라 조정 필요)
        await codeReader.decodeFromVideoDevice(backCamera.deviceId, videoElement, (result, err) => {
            if (result) {
                const scannedBarcode = result.text;
                // 중복 스캔 방지 (이전 스캔과 동일할 경우 무시)
                if (barcodeInput.value !== scannedBarcode) {
                    barcodeInput.value = scannedBarcode;
                    loadProductInfo(scannedBarcode);
                }
            }
        }, { delay: 500 }); // 0.5초 딜레이 추가
        
    } catch (e) {
        statusText.textContent = '카메라 불러오기 실패: ' + e.message;
    }
}

async function loadProductInfo(barcode) {
    productInfo.innerHTML = '불러오는 중...';
    // 로케이션 필드 초기화 (조회 데이터로 덮어쓸 예정)
    rackSelect.value = ''; columnInput.value = ''; levelInput.value = ''; sideSelect.value = ''; 

    try {
        const res = await fetch(`${WEB_APP_URL}?barcode=${barcode}`);
        
        if (!res.ok) {
            // 403, 404 등의 HTTP 오류를 정확히 표시
            throw new Error(`Apps Script 요청 실패: HTTP ${res.status}`);
        }
        
        // 응답을 텍스트로 받은 후 수동으로 JSON 파싱 시도
        const textData = await res.text();
        let data;
        
        try {
            data = JSON.parse(textData); 
        } catch (e) {
            // JSON 파싱 실패 시: Apps Script에서 유효하지 않은 응답을 보냈거나(예: HTML 오류 페이지), 
            // 응답이 잘렸을 가능성.
            console.error("JSON 파싱 오류:", e, "수신 텍스트:", textData);
            throw new Error(`데이터 파싱 오류: 응답 형식이 유효한 JSON이 아닙니다.`);
        }
        
        // ⭐️⭐️ 신규 등록 로직 (조회 성공 및 데이터 없음) ⭐️⭐️
        if (data.length > 0) {
            // ... (기존 상품 발견 로직)
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
            // 이 부분이 정상적으로 실행되면, 연결은 성공했고 바코드만 없는 경우임
            productInfo.innerHTML = '⚠️ **신규 상품입니다.** 상품명과 코드를 입력하고 위치를 지정하세요.';
            productInput.value = '';
            itemCodeInput.value = '';
        }
    } catch (err) {
        // 연결 실패 또는 HTTP/파싱 오류
        statusText.textContent = `⚠️ 오류: ${err.message}`;
        productInfo.innerHTML = '❌ **조회 실패: Apps Script 연결 또는 처리 문제**';
        console.error("최종 연결/처리 오류:", err);
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
        // 로케이션 정보
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
        
        // POST 요청의 응답은 텍스트로 받습니다.
        const result = await res.text();
        statusText.textContent = `✅ 저장 완료: ${result}`;
        
        // 저장 성공 후 입력 필드 초기화
        clearInputs();
        
    } catch (e) {
        statusText.textContent = '⚠️ 오류: Apps Script에 연결할 수 없습니다. ' + e.message;
    }
});

// 입출고 타입 변경 시 로케이션 필드 상태 토글
typeSelect.addEventListener('change', toggleLocationFields);

// 초기 실행
startScanner();


