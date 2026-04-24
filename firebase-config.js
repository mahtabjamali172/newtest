// Your Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyAqfguS1ucAtklcl06eB1JIWQr46XMpe7g",
    authDomain: "safe-chat-c0b9c.firebaseapp.com",
    databaseURL: "https://safe-chat-c0b9c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "safe-chat-c0b9c",
    storageBucket: "safe-chat-c0b9c.appspot.com",
    messagingSenderId: "119640275300",
    appId: "1:119640275300:web:20ae984f4af1ffe6a62271"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();