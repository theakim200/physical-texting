// URL에서 파라미터 가져오기
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || 'default';
const userName = urlParams.get('name') || 'Anonymous';

// 이름 없으면 입장 화면으로 리다이렉트
if (!urlParams.get('name')) {
    window.location.href = `index.html?room=${roomId}`;
}

// DOM 요소
const messagesContainer = document.getElementById('messages-container');
const textInput = document.getElementById('text-input');
const sendBtn = document.getElementById('send-btn');
const roomNameEl = document.getElementById('room-name');
const userCountEl = document.getElementById('user-count');
const sensorPermissionOverlay = document.getElementById('sensor-permission-overlay');
const grantSensorButton = document.getElementById('grant-sensor-permission');
const debugToggle = document.getElementById('debug-toggle');
const debugPanel = document.getElementById('debug-panel');
const debugGamma = document.getElementById('debug-gamma');
const debugBeta = document.getElementById('debug-beta');
const debugItalic = document.getElementById('debug-italic');
const debugSpeed = document.getElementById('debug-speed');
const debugWidth = document.getElementById('debug-width');
const debugRadius = document.getElementById('debug-radius');
const debugWeight = document.getElementById('debug-weight');

// 센서 값 저장
let currentItalicValue = 50; // 현재 italic 값 저장
let currentWidthValue = 45; // 현재 width 값 저장 (기본 45)
let currentWeightValue = 60; // 현재 weight 값 저장 (기본 60)
let lastInputTime = null; // 이전 입력 시간
let currentTypingSpeed = 0; // 현재 타자 속도 (ms)
let sensorPermissionGranted = false;
let currentGamma = 0;
let currentBeta = 0;
let currentRadius = 0;

// 방 이름 표시
roomNameEl.textContent = `Room: ${roomId}`;

// 디버그 패널 토글
debugToggle.addEventListener('click', () => {
    debugPanel.classList.toggle('hidden');
});

// 디버그 정보 업데이트 함수
function updateDebugInfo() {
    debugGamma.textContent = `${currentGamma.toFixed(1)}°`;
    debugBeta.textContent = `${currentBeta.toFixed(1)}°`;
    debugItalic.textContent = currentItalicValue.toFixed(1);
    debugSpeed.textContent = `${currentTypingSpeed}ms`;
    debugWidth.textContent = currentWidthValue.toFixed(1);
    debugRadius.textContent = `${currentRadius.toFixed(1)}px`;
    debugWeight.textContent = currentWeightValue.toFixed(1);
}

// 센서 권한 버튼 클릭
grantSensorButton.addEventListener('click', async () => {
    await requestSensorPermission();
    sensorPermissionOverlay.classList.add('hidden');
});

// 센서 권한 요청 및 시작
async function requestSensorPermission() {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission === 'granted') {
                startOrientationTracking();
                sensorPermissionGranted = true;
            }
        } catch (error) {
            console.error('Permission error:', error);
        }
    } else {
        // Android 또는 iOS 12 이하
        startOrientationTracking();
        sensorPermissionGranted = true;
    }
}

// 방향 센서 추적 시작
function startOrientationTracking() {
    window.addEventListener('deviceorientation', handleOrientation);
}

// 방향 센서 처리
function handleOrientation(event) {
    const gamma = event.gamma; // 좌우 기울기: -90 ~ +90
    const beta = event.beta;   // 앞뒤 기울기: -180 ~ 180
    
    if (gamma !== null && beta !== null) {
        currentGamma = gamma;
        currentBeta = beta;
        
        // 화면이 뒤를 향하는지 확인하고 gamma 보정
        let correctedGamma = gamma;
        
        if (beta > 90 || beta < -90) {
            // 화면이 뒤를 향함 (뒤집힌 상태) → gamma 부호 반전
            correctedGamma = -gamma;
        }
        
        // correctedGamma를 italic axis 값으로 변환 (40-60 범위)
        // gamma -90° → italic 40, gamma 0° → italic 50, gamma +90° → italic 60
        const italicValue = ((correctedGamma + 90) / 180) * 20 + 40;
        
        // 범위 제한
        currentItalicValue = Math.max(40, Math.min(60, italicValue));
        
        // 디버그 정보 업데이트
        updateDebugInfo();
    }
}

// Firebase 참조
const roomRef = database.ref(`rooms/${roomId}`);
const messagesRef = roomRef.child('messages');
const usersRef = roomRef.child('users');

// 고유 사용자 ID 생성
const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 사용자 입장 등록
const userRef = usersRef.child(userId);
userRef.set({
    name: userName,
    joinedAt: firebase.database.ServerValue.TIMESTAMP
});

// 사용자가 나가면 삭제
userRef.onDisconnect().remove();

// 온라인 사용자 수 추적
usersRef.on('value', (snapshot) => {
    const count = snapshot.numChildren();
    userCountEl.textContent = `${count} online`;
});

// 기존 메시지 로드 + 실시간 수신
messagesRef.orderByChild('timestamp').on('child_added', (snapshot) => {
    const message = snapshot.val();
    displayMessage(message);
    scrollToBottom();
});

// 메시지 표시 함수
function displayMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    
    // 내 메시지인지 확인
    if (message.userId === userId) {
        messageEl.classList.add('mine');
    } else {
        messageEl.classList.add('others');
    }
    
    // 보낸 사람 이름
    const nameEl = document.createElement('div');
    nameEl.className = 'message-name';
    nameEl.textContent = message.userName;
    
    // 메시지 버블
    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'message-bubble';
    bubbleEl.innerHTML = message.content; // HTML 포함 (span 태그)
    
    messageEl.appendChild(nameEl);
    messageEl.appendChild(bubbleEl);
    messagesContainer.appendChild(messageEl);
}

// 자동 스크롤
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 메시지 전송
function sendMessage() {
    const content = textInput.innerHTML.trim();
    
    if (content && content !== '<br>') {
        const message = {
            userId: userId,
            userName: userName,
            content: content,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        messagesRef.push(message);
        textInput.innerHTML = '';
        lastInputTime = null; // 메시지 전송 후 타이핑 속도 초기화
    }
}

// 전송 버튼 클릭
sendBtn.addEventListener('click', sendMessage);

// 커스텀 키보드 기능
let isShiftActive = false;
let currentKeyboardMode = 'alpha'; // 'alpha' or 'numbers'

const keyboardAlpha = document.getElementById('keyboard-alpha');
const keyboardNumbers = document.getElementById('keyboard-numbers');

// 모든 키에 터치 이벤트 추가
document.querySelectorAll('.key').forEach(key => {
    key.addEventListener('touchstart', handleKeyTouch);
});

function handleKeyTouch(event) {
    event.preventDefault();
    
    const touch = event.touches[0];
    const keyValue = event.target.dataset.key;
    
    // 모드 전환 키 처리
    if (keyValue === 'mode123') {
        keyboardAlpha.classList.add('hidden');
        keyboardNumbers.classList.remove('hidden');
        currentKeyboardMode = 'numbers';
        return;
    } else if (keyValue === 'modeABC') {
        keyboardNumbers.classList.add('hidden');
        keyboardAlpha.classList.remove('hidden');
        currentKeyboardMode = 'alpha';
        return;
    }
    
    // 터치 면적으로 압력 측정
    const radiusX = touch.radiusX || 25;
    const radiusY = touch.radiusY || 25;
    const avgRadius = (radiusX + radiusY) / 2;
    currentRadius = avgRadius;
    
    // radius를 weight로 매핑 (20px → 60, 50px → 150)
    if (avgRadius < 20) {
        currentWeightValue = 60;
    } else if (avgRadius > 50) {
        currentWeightValue = 150;
    } else {
        currentWeightValue = 60 + ((avgRadius - 20) / 30) * 90;
    }
    
    // 디버그 정보 업데이트
    updateDebugInfo();
    
    // 키 처리
    if (keyValue === 'backspace') {
        handleBackspace();
    } else if (keyValue === 'enter') {
        insertCharacter('\n');
    } else if (keyValue === 'shift') {
        isShiftActive = !isShiftActive;
        event.target.classList.toggle('active', isShiftActive);
    } else if (keyValue === 'space') {
        insertCharacter(' ');
    } else {
        const char = (isShiftActive && currentKeyboardMode === 'alpha') ? keyValue.toUpperCase() : keyValue;
        insertCharacter(char);
        if (isShiftActive) {
            isShiftActive = false;
            document.querySelector('.key-shift').classList.remove('active');
        }
    }
}

function insertCharacter(char) {
    // 타자 속도 측정
    const currentTime = Date.now();
    let typingInterval = 0;
    
    if (lastInputTime !== null) {
        typingInterval = currentTime - lastInputTime;
    }
    
    lastInputTime = currentTime;
    currentTypingSpeed = typingInterval;
    
    // 타자 간격을 width 값으로 변환
    if (typingInterval === 0) {
        currentWidthValue = 45;
    } else if (typingInterval < 100) {
        currentWidthValue = 5;
    } else if (typingInterval > 1200) {
        currentWidthValue = 85;
    } else {
        currentWidthValue = 5 + ((typingInterval - 100) / 1100) * 80;
    }
    
    // 디버그 정보 업데이트
    updateDebugInfo();
    
    // span 생성
    const span = document.createElement('span');
    
    // 줄바꿈 처리 - 실제 개행 문자로 표시
    if (char === '\n') {
        span.innerHTML = '<br>';
    } else {
        span.textContent = char;
    }
    
    span.style.fontVariationSettings = `'wght' ${currentWeightValue}, 'wdth' ${currentWidthValue}, 'ital' ${currentItalicValue}`;
    
    // textInput에 추가
    textInput.appendChild(span);
}

function handleBackspace() {
    // 마지막 자식 요소 삭제
    if (textInput.lastChild) {
        textInput.removeChild(textInput.lastChild);
    }
}