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

// 센서 값 저장
let currentItalicValue = 50; // 현재 italic 값 저장
let currentWidthValue = 50; // 현재 width 값 저장
let lastInputTime = null; // 이전 입력 시간
let currentTypingSpeed = 0; // 현재 타자 속도 (ms)
let sensorPermissionGranted = false;

// 방 이름 표시
roomNameEl.textContent = `Room: ${roomId}`;

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
    }
}

// 페이지 로드 시 센서 권한 요청
requestSensorPermission();

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

// 엔터 키로 전송 (Shift+Enter는 줄바꿈)
textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// beforeinput 이벤트로 타자 속도 측정 및 글자별 스타일 적용
textInput.addEventListener('beforeinput', (event) => {
    // 일반 텍스트 입력이 아니면 무시
    if (event.inputType !== 'insertText' && event.inputType !== 'insertLineBreak') {
        return;
    }
    
    // 기본 동작 막기
    event.preventDefault();
    
    // 타자 속도 측정
    const currentTime = Date.now();
    let typingInterval = 0;
    
    if (lastInputTime !== null) {
        typingInterval = currentTime - lastInputTime;
    }
    
    lastInputTime = currentTime;
    currentTypingSpeed = typingInterval;
    
    // 타자 간격을 width 값으로 변환 (5-85 범위)
    if (typingInterval === 0) {
        // 첫 글자
        currentWidthValue = 50;
    } else if (typingInterval < 100) {
        // 매우 빠름
        currentWidthValue = 5;
    } else if (typingInterval > 1200) {
        // 매우 느림
        currentWidthValue = 85;
    } else {
        // 100-1200ms 사이를 5-85로 선형 매핑
        currentWidthValue = 5 + ((typingInterval - 100) / (1200 - 100)) * 80;
    }
    
    // 입력될 텍스트 가져오기
    const text = event.data || '\n';
    
    // 현재 선택 영역 가져오기
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    range.deleteContents();
    
    // 각 글자를 span으로 감싸서 생성
    for (let char of text) {
        const span = document.createElement('span');
        span.textContent = char;
        span.style.fontVariationSettings = `'wght' 90, 'wdth' ${currentWidthValue}, 'ital' ${currentItalicValue}`;
        
        // span을 현재 위치에 삽입
        range.insertNode(span);
        
        // 커서를 삽입된 span 뒤로 이동
        range.setStartAfter(span);
        range.setEndAfter(span);
    }
    
    // 커서 위치 확정 (선택 없이)
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
});