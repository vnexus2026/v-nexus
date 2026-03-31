importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyD_JJZUcT56VkHFH0ykBRJQ_nFLK_4p7kY",
    authDomain: "v-nexus.firebaseapp.com",
    projectId: "v-nexus",
    messagingSenderId: "824125737901",
    appId: "1:824125737901:web:93a4f21b56ab00dfaaaf24"
});

const messaging = firebase.messaging();

// 當 App 在背景時收到通知的處理
messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: 'https://duk.tw/u1jpPE.png'
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});