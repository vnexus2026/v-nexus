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
    console.log('[firebase-messaging-sw.js] 收到背景推播 ', payload);

    // 加上 ?. 避免 null 導致的錯誤，並支援 data 格式
    const notificationTitle = payload.notification?.title || payload.data?.title || 'V-Nexus 新通知';
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || '您有一則新訊息',
        icon: payload.notification?.icon || 'https://duk.tw/u1jpPE.png'
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});

const IMAGE_CACHE_NAME = 'vnexus-image-cache-v5';

// 啟用新版 Service Worker 時清掉舊版圖片快取，避免快取無限膨脹。
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== IMAGE_CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// 攔截圖片請求：只快取成功的 GET 圖片回應，失敗時回退到網路錯誤。
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET' || event.request.destination !== 'image') return;

    event.respondWith(
        caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
            const cached = await cache.match(event.request);
            if (cached) return cached;

            const networkResponse = await fetch(event.request);
            if (networkResponse && networkResponse.ok) {
                cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
        }).catch(() => fetch(event.request))
    );
});
