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

// 방 이름 표시
roomNameEl.textContent = `Room: ${roomId}`;

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