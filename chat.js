// URL에서 파라미터 가져오기
const urlParams = new URLSearchParams(window.location.search);
const userName = urlParams.get('name') || 'Anonymous';

// 이름 없으면 입장 화면으로 리다이렉트
if (!urlParams.get('name')) {
    window.location.href = 'entry.html';
}

// DOM 요소
const messagesContainer = document.getElementById('messages-container');
const textInput = document.getElementById('text-input');
const sendBtn = document.getElementById('send-btn');
const roomNameEl = document.getElementById('room-name');
const userCountEl = document.getElementById('user-count');
const headerIconEl = document.getElementById('header-icon');
const statusNotifications = document.getElementById('status-notifications');

// 센서 값 저장
let currentItalicValue = 50; // 현재 italic 값 저장
let currentWidthValue = 45; // 현재 width 값 저장 (기본 45)
let currentWeightValue = 60; // 현재 weight 값 저장 (기본 60)
let lastInputTime = null; // 이전 입력 시간
let currentTypingSpeed = 0; // 현재 타자 속도 (ms)
let currentGamma = 0;
let currentBeta = 0;
let currentRadius = 0;

// 상태 추적
let currentStatuses = []; // 현재 유저 상태들 (배열로 변경)
let statusCheckInterval = null;
let recentTypingSpeeds = []; // { speed: number, timestamp: number }[] 형태로 변경
let passionateStartTime = null; // passionate 상태 시작 시간
let lyingStartTime = null; // lying 상태 시작 시간

// 센서 권한은 이미 entry.html에서 요청했으므로 바로 시작
    console.log('Protocol:', window.location.protocol);
    console.log('DeviceOrientationEvent exists:', typeof DeviceOrientationEvent !== 'undefined');
// 센서 권한은 이미 entry.html에서 요청했으므로 바로 시작
// 방향 센서 추적 시작
function startOrientationTracking() {
    window.addEventListener('deviceorientation', handleOrientation);
}

// 페이지 로드 시 센서 추적 시작
startOrientationTracking();

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
    }
}

// Firebase 참조 (고정된 단일 방)
const roomRef = database.ref('rooms/default');
const messagesRef = roomRef.child('messages');
const usersRef = roomRef.child('users');
const statusesRef = roomRef.child('statuses');

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

// 상태도 나가면 삭제
const userStatusRef = statusesRef.child(userId);
userStatusRef.onDisconnect().remove();

// 온라인 사용자 수 추적
usersRef.on('value', (snapshot) => {
    const count = snapshot.numChildren();
    userCountEl.textContent = `${count} online`;
    
    // 온라인 인원수에 따라 헤더 아이콘 변경
    if (count === 1) {
        headerIconEl.src = 'assets/1online.png';
    } else if (count === 2) {
        headerIconEl.src = 'assets/2online.png';
    } else if (count === 3) {
        headerIconEl.src = 'assets/3online.png';
    } else if (count === 4) {
        headerIconEl.src = 'assets/4online.png';
    } else if (count === 5) {
        headerIconEl.src = 'assets/5online.png';
    } else if (count >= 6) {
        headerIconEl.src = 'assets/6ormore.png';
    }
});

// 사용자가 나가면 해당 사용자의 상태도 제거
usersRef.on('child_removed', (snapshot) => {
    const removedUserId = snapshot.key;
    statusesRef.child(removedUserId).remove();
});

// 상태 변경 리스너
statusesRef.on('value', (snapshot) => {
    displayStatuses(snapshot.val());
    scrollToBottom();
});

// 상태 표시 함수
function displayStatuses(statusesData) {
    statusNotifications.innerHTML = '';
    
    if (!statusesData) return;
    
    // 각 유저별로 처리
    Object.entries(statusesData).forEach(([uid, userData]) => {
        const userStatuses = userData.statuses || [];
        
        // 각 상태를 별도 줄로 표시
        userStatuses.forEach(status => {
            const notification = document.createElement('div');
            notification.className = 'status-notification';
            
            let iconSrc = '';
            let message = '';
            let color = '';
            
            if (status === 'gone') {
                iconSrc = 'assets/gone.svg';
                message = `${userData.userName} might be away right now`;
                color = '#FF9500';
            } else if (status === 'thinking') {
                iconSrc = 'assets/time.svg';
                message = `${userData.userName} is thinking for a long time`;
                color = '#5AC8FA';
            } else if (status === 'fast') {
                iconSrc = 'assets/fast.svg';
                message = `${userData.userName} is talking fast`;
                color = '#FFCC00';
            } else if (status === 'lying') {
                iconSrc = 'assets/lying.svg';
                message = `${userData.userName} is lying down`;
                color = '#5856D6';
            } else if (status === 'passionate') {
                iconSrc = 'assets/passionate.svg';
                message = `${userData.userName} is passionately typing`;
                color = '#FF2D55';
            }
            
            notification.innerHTML = `
                <span class="icon"><img src="${iconSrc}" alt="${status}"></span>
                <span style="color: ${color}">${message}</span>
            `;
            statusNotifications.appendChild(notification);
        });
    });
}

// 상태 업데이트 함수
function updateUserStatus(statuses) {
    // 배열 비교 (순서 무관)
    const isSame = statuses.length === currentStatuses.length &&
                   statuses.every(s => currentStatuses.includes(s));
    
    if (isSame) return;
    
    currentStatuses = statuses;
    
    if (statuses.length > 0) {
        statusesRef.child(userId).set({
            userName: userName,
            statuses: statuses,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    } else {
        statusesRef.child(userId).remove();
    }
}

// 상태 체크 시작
function startStatusChecking() {
    statusCheckInterval = setInterval(() => {
        checkUserStatus();
    }, 1000); // 1초마다 체크
}

function checkUserStatus() {
    const now = Date.now();
    const statuses = [];
    
    // 1. Gone 체크 (10초 이상 타이핑 안함)
    if (lastInputTime && (now - lastInputTime) > 10000) {
        statuses.push('gone');
    }
    // 2. Thinking 체크 (5초 이상 ~ 10초 미만 타이핑 안함)
    else if (lastInputTime && (now - lastInputTime) > 5000 && (now - lastInputTime) <= 10000) {
        statuses.push('thinking');
    }
    
    // 3. Fast 체크 (최근 3초간 평균 속도 < 200ms)
    const threeSecondsAgo = now - 3000;
    const recentSpeeds = recentTypingSpeeds.filter(
        item => item.timestamp > threeSecondsAgo
    );
    
    if (recentSpeeds.length >= 3) {
        const avgSpeed = recentSpeeds.reduce((sum, item) => sum + item.speed, 0) / recentSpeeds.length;
        if (avgSpeed < 200) {
            statuses.push('fast');
        }
    }
    
    // 4. Lying down 체크 (italic 45 이하 or 55 이상, 5초 유지)
    if (currentItalicValue <= 45 || currentItalicValue >= 55) {
        if (!lyingStartTime) {
            lyingStartTime = now;
        }
        
        if (now - lyingStartTime >= 5000) {
            statuses.push('lying');
        }
    } else {
        lyingStartTime = null;
    }
    
    // 5. Passionate 체크 (radius 35px 이상 3초 유지 + 계속 타이핑 중)
    // 타이핑을 멈추면 (2초 이상 경과) passionate 리셋
    if (lastInputTime && (now - lastInputTime) > 2000) {
        passionateStartTime = null;
    }
    
    // radius가 35px 이상이고, 3초 유지되었으면 passionate
    if (passionateStartTime && (now - passionateStartTime) >= 3000) {
        statuses.push('passionate');
    }
    
    updateUserStatus(statuses);
}

// 페이지 떠날 때 상태 정리
window.addEventListener('beforeunload', () => {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    statusesRef.child(userId).remove();
});

// 상태 체크 시작
startStatusChecking();

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
    
    // 프로필 이미지
    const profileEl = document.createElement('img');
    profileEl.className = 'message-profile';
    profileEl.src = 'assets/profile.jpg';
    profileEl.alt = message.userName;
    
    // 메시지 콘텐츠 래퍼
    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    
    // 보낸 사람 이름
    const nameEl = document.createElement('div');
    nameEl.className = 'message-name';
    nameEl.textContent = message.userName;
    
    // 메시지 버블 + 꼬리 래퍼
    const bubbleWrapperEl = document.createElement('div');
    bubbleWrapperEl.className = 'message-bubble-wrapper';
    
    // 메시지 버블
    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'message-bubble';
    bubbleEl.innerHTML = message.content; // HTML 포함 (span 태그)
    
    // 꼬리
    const tailEl = document.createElement('img');
    tailEl.className = 'message-tail';
    if (message.userId === userId) {
        tailEl.src = 'assets/tail_right.svg';
    } else {
        tailEl.src = 'assets/tail_left.svg';
    }
    
    // 조립: 버블을 먼저, tail을 나중에 (order로 위치 조정)
    bubbleWrapperEl.appendChild(bubbleEl);
    bubbleWrapperEl.appendChild(tailEl);
    
    contentEl.appendChild(nameEl);
    contentEl.appendChild(bubbleWrapperEl);
    
    messageEl.appendChild(profileEl);
    messageEl.appendChild(contentEl);
    
    // status-notifications 앞에 메시지 삽입
    const statusNotifications = document.getElementById('status-notifications');
    messagesContainer.insertBefore(messageEl, statusNotifications);
    
    scrollToBottom();
}

// 자동 스크롤
function scrollToBottom() {
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 50);
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

// 멀티터치 처리
let isProcessingTouch = false;
let accumulatedRadius = [];

const keyboardAlpha = document.getElementById('keyboard-alpha');
const keyboardNumbers = document.getElementById('keyboard-numbers');

// 모든 키에 터치 이벤트 추가
document.querySelectorAll('.key').forEach(key => {
    key.addEventListener('touchstart', handleKeyTouch);
});

function handleKeyTouch(event) {
    event.preventDefault();
    
    const keyValue = event.currentTarget.dataset.key;
    
    // 모드 전환 키 처리 (즉시 처리)
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
    
    // Shift 키 처리 (즉시 처리)
    if (keyValue === 'shift') {
        isShiftActive = !isShiftActive;
        event.currentTarget.classList.toggle('active', isShiftActive);
        return;
    }
    
    // 모든 터치의 radius 수집
    for (let i = 0; i < event.touches.length; i++) {
        const touch = event.touches[i];
        const radiusX = touch.radiusX || 25;
        const radiusY = touch.radiusY || 25;
        accumulatedRadius.push((radiusX + radiusY) / 2);
    }
    
    // 첫 번째 키만 처리 (동시 터치 시 하나만 입력)
    if (!isProcessingTouch) {
        isProcessingTouch = true;
        
        // 모든 터치의 평균 radius 계산 (넓게 터치할수록 큰 값)
        const avgRadius = accumulatedRadius.reduce((a, b) => a + b, 0) / accumulatedRadius.length;
        currentRadius = avgRadius;
        
        // radius를 weight로 매핑 (20px → 60, 50px → 150)
        if (avgRadius < 20) {
            currentWeightValue = 60;
        } else if (avgRadius > 50) {
            currentWeightValue = 150;
        } else {
            currentWeightValue = 60 + ((avgRadius - 20) / 30) * 90;
        }
        
        // Passionate 상태 추적 (35px 이상 3초 유지)
        if (avgRadius >= 35) {
            if (!passionateStartTime) {
                passionateStartTime = Date.now();
            }
        } else {
            passionateStartTime = null;
        }
        
        // 키 처리
        if (keyValue === 'backspace') {
            handleBackspace();
        } else if (keyValue === 'enter') {
            insertCharacter('\n');
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
        
        // 리셋 (100ms 후)
        setTimeout(() => {
            isProcessingTouch = false;
            accumulatedRadius = [];
        }, 100);
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
    
    // 최근 타이핑 속도 기록 (timestamp 포함)
    if (typingInterval > 0 && typingInterval < 2000) {
        recentTypingSpeeds.push({
            speed: typingInterval,
            timestamp: currentTime
        });
        
        // 10초 이상 된 기록 제거
        const tenSecondsAgo = currentTime - 10000;
        recentTypingSpeeds = recentTypingSpeeds.filter(
            item => item.timestamp > tenSecondsAgo
        );
    }
    
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