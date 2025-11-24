// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyDPWj9BhDze0vYz1EeV5U538V2U8qsKtts",
    authDomain: "physical-texting.firebaseapp.com",
    databaseURL: "https://physical-texting-default-rtdb.firebaseio.com",
    projectId: "physical-texting",
    storageBucket: "physical-texting.firebasestorage.app",
    messagingSenderId: "906578216492",
    appId: "1:906578216492:web:53effa4af15ef32515f389"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
const database = firebase.database();