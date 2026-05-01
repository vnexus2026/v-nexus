import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, updateDoc, increment, arrayUnion, arrayRemove, query, where, getDocs, getDoc, orderBy, limit, writeBatch, deleteField, } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaV3Provider, getToken as getAppCheckToken, } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js";
import { getFunctions, httpsCallable, } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
// --- API 金鑰設定區 (請在此填入您申請到的金鑰) ---
import { getStorage, ref, uploadString, getDownloadURL, } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
// --------------------------------------------------
// 🌟 引入 createContext 與 useContext
const { useState, useEffect, useMemo, useRef, createContext, useContext } = React;
// 🌟 建立全域的 AppContext
const AppContext = createContext(null);
// --- V-Nexus 社群色彩系統 (UI/UX 調整基準) ---
// 背景 #0F111A / #11131C，卡片 #181B25，hover #1D2130，分隔線 #2A2F3D
// 主紫 #8B5CF6；資訊藍 #38BDF8；成功綠 #22C55E；警示黃 #F59E0B；危險紅 #EF4444
// 紫色只用於品牌與主要 CTA；藍/綠/黃/紅依資訊、成功、提醒、危險語意使用。
const firebaseConfig = {
    apiKey: "AIzaSyD_JJZUcT56VkHFH0ykBRJQ_nFLK_4p7kY",
    authDomain: "v-nexus.firebaseapp.com",
    projectId: "v-nexus",
    storageBucket: "v-nexus.firebasestorage.app",
    messagingSenderId: "824125737901",
    appId: "1:824125737901:web:93a4f21b56ab00dfaaaf24",
    measurementId: "G-80P1WEWY5Y" // 🌟 新增：請換成你在後台拿到的真實 ID
};
const app = initializeApp(firebaseConfig);
// ✅ App Check 必須盡量在 Auth / Firestore / Storage / Functions 初始化前啟動。
// ✅ v10 本地測試模式：正式站仍使用 reCAPTCHA App Check；localhost / 127.0.0.1 / *.local 會改用 Firebase App Check Debug Token。
// 使用方式：
// 1. 第一次在本地開啟網站時，Console 會顯示 App Check debug token。
// 2. 到 Firebase Console → App Check → Web App → Manage debug tokens 加入該 token。
// 3. 重新整理本地網站後，即使 Cloud Functions 已強制執行 App Check，也能正常測試 callable functions。
// 4. 若你已在 Console 建立固定 Debug Token，可用 ?appCheckDebugToken=你的token 或 console 執行 vnexusSetAppCheckDebugToken('你的token') 寫入本機瀏覽器。
const APP_CHECK_DEBUG_TOKEN_STORAGE_KEY = "vnexus_app_check_debug_token";
const isLocalAppCheckHost = () => {
    const host = String(location.hostname || "").toLowerCase();
    return host === "localhost"
        || host === "127.0.0.1"
        || host === "0.0.0.0"
        || host.endsWith(".local");
};
const setupLocalAppCheckDebugToken = () => {
    if (!isLocalAppCheckHost())
        return false;
    try {
        const params = new URLSearchParams(location.search || "");
        const queryToken = params.get("appCheckDebugToken") || params.get("appcheckDebugToken") || params.get("appcheckDebug");
        if (queryToken && queryToken.trim()) {
            localStorage.setItem(APP_CHECK_DEBUG_TOKEN_STORAGE_KEY, queryToken.trim());
            params.delete("appCheckDebugToken");
            params.delete("appcheckDebugToken");
            params.delete("appcheckDebug");
            const cleanUrl = `${location.pathname}${params.toString() ? `?${params.toString()}` : ""}${location.hash || ""}`;
            history.replaceState(null, document.title, cleanUrl);
            console.info("🧪 已儲存 V-Nexus 本地 App Check Debug Token，重新整理後會自動使用。未來可用 vnexusClearAppCheckDebugToken() 清除。");
        }
        const savedToken = localStorage.getItem(APP_CHECK_DEBUG_TOKEN_STORAGE_KEY);
        // Firebase Web SDK 規定必須在 initializeAppCheck 前設定這個全域值。
        // 有固定 token 就使用固定 token；沒有就設 true，讓 SDK 在 Console 印出一組可加入 Firebase Console 的 debug token。
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = savedToken || true;
        self.vnexusSetAppCheckDebugToken = (token) => {
            if (!token || !String(token).trim()) {
                console.warn("請提供 Firebase Console App Check debug token，例如：vnexusSetAppCheckDebugToken('xxxx')");
                return false;
            }
            localStorage.setItem(APP_CHECK_DEBUG_TOKEN_STORAGE_KEY, String(token).trim());
            console.info("✅ 已儲存 App Check Debug Token。請重新整理頁面後再測試 Cloud Functions。");
            return true;
        };
        self.vnexusClearAppCheckDebugToken = () => {
            localStorage.removeItem(APP_CHECK_DEBUG_TOKEN_STORAGE_KEY);
            console.info("🧹 已清除本機 App Check Debug Token。重新整理後 SDK 會重新產生並印出 debug token。");
            return true;
        };
        console.info(savedToken
            ? "🧪 V-Nexus 本地 App Check Debug Token 模式已啟用：會使用本機儲存的 token 測試已強制 App Check 的 Cloud Functions。"
            : "🧪 V-Nexus 本地 App Check Debug Token 模式已啟用：請將 Console 顯示的 debug token 加到 Firebase Console → App Check → Web App → Manage debug tokens。");
        return true;
    }
    catch (error) {
        console.warn("⚠️ 本地 App Check Debug Token 初始化失敗，將嘗試使用正式 reCAPTCHA App Check：", error);
        return false;
    }
};
const isLocalAppCheckDebug = setupLocalAppCheckDebugToken();
let appCheck = null;
try {
    appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider("6LdINZksAAAAAF5FtNfKOOsDPaHQue3SmuAVqR4M"),
        isTokenAutoRefreshEnabled: true,
    });
    console.info(isLocalAppCheckDebug ? "✅ App Check 已初始化（本地 Debug Token 模式）" : "✅ App Check 已初始化（正式 reCAPTCHA 模式）");
    // 本地測試時主動取一次 token，讓問題可以在 Console 立刻看見，不必等到按下功能才發現 Functions 被拒絕。
    if (isLocalAppCheckDebug && appCheck) {
        setTimeout(() => {
            getAppCheckToken(appCheck, false)
                .then(() => console.info("✅ 本地 App Check token 取得成功，可以測試已強制 App Check 的 Cloud Functions。"))
                .catch((error) => console.warn("⚠️ 本地 App Check token 取得失敗：請確認 debug token 已加入 Firebase Console。", error));
        }, 800);
    }
}
catch (error) {
    console.warn("App Check:", error);
}
const auth = getAuth(app);
// ✅ 未打包快速啟動版：把非首屏模組延後到瀏覽器空閒時才初始化。
// 這不改 Firebase / Firestore / Functions 安全邏輯，只避免首頁一進站就載入 Analytics 與 FCM Messaging。
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
    }),
});
const storage = getStorage(app);
const functionsInstance = getFunctions(app);
const runWhenIdle = (callback, timeout = 1800) => {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        return window.requestIdleCallback(callback, { timeout });
    }
    return setTimeout(callback, Math.min(timeout, 1200));
};
let analytics = null;
let analyticsLogEvent = null;
let analyticsImportPromise = null;
const pendingAnalyticsEvents = [];
const initDeferredAnalytics = () => {
    if (analyticsImportPromise)
        return analyticsImportPromise;
    analyticsImportPromise = import("https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js")
        .then(({ getAnalytics, logEvent }) => {
        try {
            analytics = getAnalytics(app);
            analyticsLogEvent = logEvent;
            pendingAnalyticsEvents.splice(0).forEach(({ name, params }) => {
                try {
                    analyticsLogEvent(analytics, name, params);
                }
                catch (error) { }
            });
            console.info("✅ Analytics 已延後初始化");
        }
        catch (error) {
            console.warn("Analytics 初始化被阻擋:", error);
        }
    })
        .catch((error) => console.warn("Analytics 模組延後載入失敗:", error));
    return analyticsImportPromise;
};
const trackAnalyticsEvent = (name, params = {}) => {
    if (analytics && analyticsLogEvent) {
        try {
            analyticsLogEvent(analytics, name, params);
        }
        catch (error) { }
        return;
    }
    if (pendingAnalyticsEvents.length < 25)
        pendingAnalyticsEvents.push({ name, params });
    runWhenIdle(() => initDeferredAnalytics(), 2600);
};
let messagingInstance = null;
let messagingModulePromise = null;
let foregroundMessagingStarted = false;
const loadMessagingModule = () => {
    if (!messagingModulePromise) {
        messagingModulePromise = import("https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js");
    }
    return messagingModulePromise;
};
const initForegroundMessaging = async () => {
    if (foregroundMessagingStarted)
        return messagingInstance;
    if (typeof window === "undefined" || !("Notification" in window))
        return null;
    // 沒授權通知前不需要初始化 FCM 前景監聽，避免首頁首屏多載入一包 messaging SDK。
    if (Notification.permission !== "granted")
        return null;
    try {
        const { getMessaging, onMessage } = await loadMessagingModule();
        messagingInstance = getMessaging(app);
        onMessage(messagingInstance, (payload) => {
            const title = payload.notification?.title || "V-Nexus 通知";
            const body = payload.notification?.body || "";
            const icon = payload.notification?.icon || "https://duk.tw/u1jpPE.png";
            if (Notification.permission === "granted") {
                new Notification(title, {
                    body,
                    icon,
                    badge: "https://duk.tw/u1jpPE.png",
                    vibrate: [200, 100, 200],
                });
            }
            else {
                console.info(`📨 前景推播收到：${title} - ${body}`);
            }
        });
        foregroundMessagingStarted = true;
        console.info("✅ FCM 前景推播監聽已延後啟動");
    }
    catch (error) {
        console.warn("⚠️ Messaging 延後初始化失敗（可能是瀏覽器不支援或被封鎖）:", error);
    }
    return messagingInstance;
};
let serviceWorkerRegistrationPromise = null;
const registerVnexusServiceWorker = () => {
    if (!("serviceWorker" in navigator))
        return Promise.resolve(null);
    if (serviceWorkerRegistrationPromise)
        return serviceWorkerRegistrationPromise;
    serviceWorkerRegistrationPromise = navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .then((reg) => {
        console.log("SW 延後註冊成功:", reg.scope);
        return reg;
    })
        .catch((err) => {
        console.error("SW 延後註冊失敗:", err);
        return null;
    });
    return serviceWorkerRegistrationPromise;
};
// 首屏出來後再補 Analytics / 已授權推播監聽 / Service Worker。
runWhenIdle(() => initDeferredAnalytics(), 2600);
runWhenIdle(() => initForegroundMessaging(), 3200);
runWhenIdle(() => registerVnexusServiceWorker(), 3600);
const provider = new GoogleAuthProvider();
const APP_ID = "v-nexus-official";
const ONE_DAY = 1 * 60 * 60 * 1000; // 1小時的毫秒數
const VTUBER_CACHE_KEY = "vnexus_vtubers_data";
const VTUBER_CACHE_TS = "vnexus_vtubers_ts";
const PUBLIC_VTUBERS_JSON_URL = "https://firebasestorage.googleapis.com/v0/b/v-nexus.firebasestorage.app/o/public_api%2Fvtubers.json?alt=media";
const PUBLIC_VTUBER_CACHE_LIMIT = 5 * 60 * 1000; // 公開名片 JSON 5 分鐘內不重複抓；Storage 無 Firestore reads 成本。
const STATS_CACHE_KEY = "vnexus_stats_data";
const STATS_CACHE_TS = "vnexus_stats_ts";
const STATS_CACHE_LIMIT = 30 * 60 * 1000; // 統計/廣播資料 30 分鐘快取；不再每個使用者長時間監聽。
const BULLETINS_CACHE_KEY = "vnexus_bulletins_data";
const BULLETINS_CACHE_TS = "vnexus_bulletins_ts";
const COLLABS_CACHE_KEY = "vnexus_collabs_data";
const COLLABS_CACHE_TS = "vnexus_collabs_ts";
const UPDATES_CACHE_KEY = "vnexus_updates_data";
const UPDATES_CACHE_TS = "vnexus_updates_ts";
const ARTICLES_CACHE_KEY = "vnexus_articles_data";
const ARTICLES_CACHE_TS = "vnexus_articles_ts";
const SETTINGS_CACHE_KEY = "vnexus_settings_data";
const SETTINGS_CACHE_TS = "vnexus_settings_ts";
const ACTIVITY_CACHE_LIMIT = 5 * 60 * 1000; // 首頁活動 / 揪團 / 聯動：5 分鐘快取。
const ARTICLES_CACHE_LIMIT = 60 * 60 * 1000; // 文章 / 公告：1 小時快取。
const SETTINGS_CACHE_LIMIT = 60 * 60 * 1000; // 站規 / 邀約小技巧 / 預設圖：1 小時快取。
const safeJsonParse = (raw, fallback = null) => {
    if (!raw || typeof raw !== "string")
        return fallback;
    try {
        return JSON.parse(raw);
    }
    catch (error) {
        return fallback;
    }
};
const readLocalCache = (key, fallback = null) => {
    if (typeof localStorage === "undefined")
        return fallback;
    return safeJsonParse(localStorage.getItem(key), fallback);
};
const writeLocalCache = (key, value) => {
    if (typeof localStorage === "undefined")
        return false;
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    }
    catch (error) {
        console.warn(`寫入快取失敗：${key}`, error);
        return false;
    }
};
const removeLocalCache = (...keys) => {
    if (typeof localStorage === "undefined")
        return;
    keys.forEach((key) => {
        try {
            localStorage.removeItem(key);
        }
        catch (error) { }
    });
};
const readCacheTimestamp = (key) => {
    if (typeof localStorage === "undefined")
        return 0;
    const value = Number(localStorage.getItem(key) || 0);
    return Number.isFinite(value) ? value : 0;
};
const isCacheFresh = (tsKey, maxAgeMs) => {
    const ts = readCacheTimestamp(tsKey);
    return Boolean(ts && Date.now() - ts < maxAgeMs);
};
const markCacheTimestamp = (key, timestamp = Date.now()) => {
    if (typeof localStorage === "undefined")
        return;
    try {
        localStorage.setItem(key, String(timestamp));
    }
    catch (error) { }
};
const getCachedArray = (dataKey, tsKey = null) => {
    const data = readLocalCache(dataKey, []);
    if (!Array.isArray(data)) {
        removeLocalCache(dataKey, ...(tsKey ? [tsKey] : []));
        return [];
    }
    return data;
};
const getPath = (collectionName) => `artifacts/${APP_ID}/public/data/${collectionName}`;
const generateRoomId = (uid1, uid2) => [uid1, uid2].sort().join("_");
const getRoomPath = (roomId) => `artifacts/${APP_ID}/public/data/chat_rooms/${roomId}`;
const getMsgPath = (roomId) => `artifacts/${APP_ID}/public/data/chat_rooms/${roomId}/messages`;
const BROKEN_IMAGE_CACHE_KEY = "vnexus_broken_image_urls_v1";
const BROKEN_IMAGE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const BROKEN_IMAGE_CACHE_LIMIT = 500;
let vnexusBrokenImageUrlMap = null;
function normalizeImageCacheUrl(url) {
    if (typeof url !== "string")
        return "";
    return url.trim();
}
function loadBrokenImageUrlMap() {
    if (vnexusBrokenImageUrlMap)
        return vnexusBrokenImageUrlMap;
    vnexusBrokenImageUrlMap = new Map();
    if (typeof localStorage === "undefined")
        return vnexusBrokenImageUrlMap;
    try {
        const raw = localStorage.getItem(BROKEN_IMAGE_CACHE_KEY);
        const data = raw ? JSON.parse(raw) : {};
        const now = Date.now();
        Object.entries(data || {}).forEach(([url, ts]) => {
            const time = Number(ts || 0);
            if (url && time && now - time < BROKEN_IMAGE_CACHE_TTL) {
                vnexusBrokenImageUrlMap.set(url, time);
            }
        });
    }
    catch (error) {
        console.warn("圖片錯誤快取讀取失敗，將重新建立。", error);
        try {
            localStorage.removeItem(BROKEN_IMAGE_CACHE_KEY);
        }
        catch (e) { }
    }
    return vnexusBrokenImageUrlMap;
}
function persistBrokenImageUrlMap() {
    if (typeof localStorage === "undefined" || !vnexusBrokenImageUrlMap)
        return;
    try {
        const entries = [...vnexusBrokenImageUrlMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, BROKEN_IMAGE_CACHE_LIMIT);
        localStorage.setItem(BROKEN_IMAGE_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    }
    catch (error) {
        // localStorage 滿了或被瀏覽器阻擋時，不影響主流程。
    }
}
function rememberBrokenImageUrl(url) {
    const normalized = normalizeImageCacheUrl(url);
    if (!normalized)
        return;
    const lower = normalized.toLowerCase();
    // data/blob/about 不應該被記錄；Firebase Storage 偶發 403 也先記錄 7 天，使用者可清除快取恢復。
    if (lower.startsWith("data:") || lower.startsWith("blob:") || lower.startsWith("about:"))
        return;
    const map = loadBrokenImageUrlMap();
    map.set(normalized, Date.now());
    persistBrokenImageUrlMap();
}
function forgetBrokenImageUrl(url) {
    const normalized = normalizeImageCacheUrl(url);
    if (!normalized)
        return;
    const map = loadBrokenImageUrlMap();
    if (map.delete(normalized))
        persistBrokenImageUrlMap();
}
function isKnownBrokenImageUrl(url) {
    const normalized = normalizeImageCacheUrl(url);
    if (!normalized)
        return false;
    const map = loadBrokenImageUrlMap();
    const ts = Number(map.get(normalized) || 0);
    if (!ts)
        return false;
    if (Date.now() - ts > BROKEN_IMAGE_CACHE_TTL) {
        map.delete(normalized);
        persistBrokenImageUrlMap();
        return false;
    }
    return true;
}
if (typeof window !== "undefined") {
    window.vnexusClearBrokenImageCache = () => {
        try {
            localStorage.removeItem(BROKEN_IMAGE_CACHE_KEY);
        }
        catch (e) { }
        vnexusBrokenImageUrlMap = new Map();
        console.info("✅ V-Nexus 圖片錯誤快取已清除，重新整理後會再次嘗試載入圖片。界面：vnexusClearBrokenImageCache()");
    };
}
const VNEXUS_GRAY_IMAGE_PLACEHOLDER = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#1D2130"/><path d="M52 92l18-18 17 17 13-13 24 24H36l16-10z" fill="#334155" opacity=".55"/><circle cx="58" cy="55" r="10" fill="#475569" opacity=".45"/></svg>')}`;
function setImageToGrayPlaceholder(img, failedSrc = "", options = {}) {
    if (!img)
        return;
    const { remember = true } = options || {};
    const current = failedSrc || img.currentSrc || img.src || img.getAttribute?.("src") || "";
    if (current === VNEXUS_GRAY_IMAGE_PLACEHOLDER || img.dataset?.vnexusPlaceholder === "gray")
        return;
    if (remember && current)
        rememberBrokenImageUrl(current);
    try {
        img.dataset.vnexusPlaceholder = "gray";
    }
    catch (e) { }
    img.classList?.add("vnexus-image-error", "vnexus-image-loaded");
    img.removeAttribute?.("srcset");
    img.removeAttribute?.("sizes");
    img.style.opacity = "1";
    img.style.visibility = "visible";
    img.style.backgroundColor = "#1D2130";
    img.style.objectFit = img.style.objectFit || "cover";
    img.src = VNEXUS_GRAY_IMAGE_PLACEHOLDER;
}
const initVnexusImageLoadingUX = (() => {
    let initialized = false;
    return () => {
        if (initialized || typeof document === "undefined")
            return;
        initialized = true;
        if (!document.getElementById("vnexus-image-loading-style")) {
            const style = document.createElement("style");
            style.id = "vnexus-image-loading-style";
            style.textContent = `
        @keyframes vnexusImageShimmer {
          0% { background-position: 120% 0; }
          100% { background-position: -120% 0; }
        }
        .vnexus-image-skeleton {
          background-color: #1D2130;
          background-image: linear-gradient(110deg, #1D2130 0%, #242A3A 18%, #334155 32%, #242A3A 46%, #1D2130 64%);
          background-size: 220% 100%;
          animation: vnexusImageShimmer 1.05s ease-in-out infinite;
        }
        img:not(.vnexus-image-loaded):not(.vnexus-image-error) {
          background-color: #1D2130;
          background-image: linear-gradient(110deg, #1D2130 0%, #242A3A 18%, #334155 32%, #242A3A 46%, #1D2130 64%);
          background-size: 220% 100%;
          animation: vnexusImageShimmer 1.05s ease-in-out infinite;
        }
        img.vnexus-image-error {
          opacity: 1 !important;
          visibility: visible !important;
          background: #1D2130 !important;
        }
        .vnexus-drag-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
          cursor: grab;
          user-select: none;
        }
        .vnexus-drag-scroll::-webkit-scrollbar {
          display: none;
        }
        .vnexus-drag-scroll.is-dragging {
          cursor: grabbing;
        }



        /* ✅ 手機刷新 Critical CSS：頂部說明、創作者身份、進階風格篩選、聊天室滿版 */
        @media (max-width: 639px) {
          .vnexus-commission-page * { box-sizing: border-box; }
          .vnexus-commission-hero { width: 100% !important; background: #181B25 !important; border: 1px solid #2A2F3D !important; border-radius: 1.25rem !important; padding: 1rem !important; margin-bottom: 1.25rem !important; overflow: hidden !important; }
          .vnexus-commission-hero > p:first-child { display: block !important; color: #38BDF8 !important; font-size: 10px !important; line-height: 1.25 !important; font-weight: 900 !important; letter-spacing: .18em !important; text-transform: uppercase !important; margin: 0 0 .5rem 0 !important; }
          .vnexus-commission-hero > div { display: flex !important; flex-direction: column !important; gap: .75rem !important; }
          .vnexus-commission-hero h2 { color: #fff !important; font-size: 1.5rem !important; line-height: 1.18 !important; font-weight: 950 !important; margin: 0 !important; letter-spacing: -.02em !important; }
          .vnexus-commission-hero p:not(:first-child) { color: #94A3B8 !important; font-size: .875rem !important; line-height: 1.7 !important; margin: .5rem 0 0 0 !important; max-width: 100% !important; }
          .vnexus-commission-hero-actions { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: .5rem !important; width: 100% !important; }
          .vnexus-commission-hero-actions button { display: inline-flex !important; align-items: center !important; justify-content: center !important; min-height: 42px !important; border-radius: .875rem !important; border: 0 !important; padding: .625rem .75rem !important; font-size: .875rem !important; line-height: 1.2 !important; font-weight: 900 !important; white-space: nowrap !important; }
          .vnexus-commission-controls { width: 100% !important; background: #11131C !important; border: 1px solid #2A2F3D !important; border-radius: 1.25rem !important; padding: .75rem !important; margin-bottom: 1rem !important; overflow: hidden !important; }
          .vnexus-commission-controls-grid { display: grid !important; grid-template-columns: minmax(0, 1fr) auto !important; align-items: end !important; gap: .65rem !important; }
          .vnexus-commission-controls-grid > div:first-child { grid-column: 1 / -1 !important; min-width: 0 !important; }
          .vnexus-commission-controls p, .vnexus-commission-controls label { display: block !important; color: #94A3B8 !important; font-size: 10px !important; line-height: 1.25 !important; font-weight: 900 !important; letter-spacing: .14em !important; text-transform: uppercase !important; margin: 0 0 .45rem 0 !important; }
          .vnexus-commission-role-row { display: flex !important; flex-wrap: nowrap !important; gap: .375rem !important; overflow-x: auto !important; overflow-y: hidden !important; padding: 0 .125rem .25rem .125rem !important; margin: 0 !important; scrollbar-width: none !important; }
          .vnexus-commission-role-row::-webkit-scrollbar { display: none !important; }
          .vnexus-commission-role-row button { flex: 0 0 auto !important; border-radius: 999px !important; border: 1px solid #2A2F3D !important; background: #181B25 !important; color: #CBD5E1 !important; padding: .45rem .7rem !important; font-size: 11px !important; line-height: 1.15 !important; font-weight: 900 !important; white-space: nowrap !important; }
          .vnexus-commission-role-row button[class*="bg-[#38BDF8]"] { background: #38BDF8 !important; border-color: #38BDF8 !important; color: #0F111A !important; }
          .vnexus-commission-controls select { display: block !important; width: 100% !important; height: 34px !important; border-radius: .875rem !important; border: 1px solid #2A2F3D !important; background: #181B25 !important; color: #fff !important; padding: .4rem .65rem !important; font-size: 12px !important; outline: none !important; }
          .vnexus-commission-shuffle { display: inline-flex !important; align-items: center !important; justify-content: center !important; min-width: 62px !important; height: 34px !important; border-radius: .875rem !important; border: 0 !important; background: #38BDF8 !important; color: #0F111A !important; padding: .45rem .75rem !important; font-size: 12px !important; line-height: 1.15 !important; font-weight: 950 !important; white-space: nowrap !important; }
          .vnexus-floating-chat { position: fixed !important; inset: 0 !important; width: 100vw !important; max-width: none !important; height: 100dvh !important; max-height: none !important; border-radius: 0 !important; border-left: 0 !important; z-index: 9999 !important; transform: none !important; }
        }

        /* ✅ 手機版：繪師 / 建模師 / 剪輯師委託專區卡片排版（仿使用者提供截圖） */
        @media (max-width: 639px) {
          .vnexus-commission-page {
            max-width: 100% !important;
            padding-left: 1rem !important;
            padding-right: 1rem !important;
          }
          .vnexus-commission-grid {
            gap: 1rem !important;
          }
          .vnexus-creator-market-card {
            border-radius: 1.5rem !important;
            background: #151923 !important;
            border-color: #2A2F3D !important;
            box-shadow: 0 10px 30px rgba(0,0,0,.18) !important;
          }
          .vnexus-creator-market-card > div:first-child {
            aspect-ratio: 1 / 1 !important;
            min-height: 0 !important;
          }
          .vnexus-creator-showcase-img {
            opacity: .92 !important;
            transform: none !important;
          }
          .vnexus-creator-market-card .line-clamp-4 {
            display: -webkit-box;
            -webkit-line-clamp: 4;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .vnexus-image-skeleton,
          img:not(.vnexus-image-loaded):not(.vnexus-image-error) {
            animation: none !important;
            background-image: none !important;
          }
        }
      `;
            document.head.appendChild(style);
        }
        document.addEventListener("load", (event) => {
            const target = event.target;
            if (target && target.tagName === "IMG") {
                target.classList.add("vnexus-image-loaded");
                target.classList.remove("vnexus-image-error");
            }
        }, true);
        document.addEventListener("error", (event) => {
            const target = event.target;
            if (target && target.tagName === "IMG") {
                const failedSrc = target.currentSrc || target.src || target.getAttribute("src") || "";
                if (failedSrc === VNEXUS_GRAY_IMAGE_PLACEHOLDER || target.dataset?.vnexusPlaceholder === "gray")
                    return;
                // ✅ 手機版委託專區修正：此區圖片若在重新整理瞬間載入失敗，不寫入 7 天壞圖快取，避免第二次刷新後頭像/作品圖直接消失。
                setImageToGrayPlaceholder(target, failedSrc, {
                    remember: !target.closest?.(".vnexus-creator-market-card")
                });
            }
        }, true);
        const hideKnownBrokenImages = (root = document) => {
            root.querySelectorAll?.("img").forEach((img) => {
                const src = img.currentSrc || img.src || img.getAttribute("src") || "";
                if (src && isKnownBrokenImageUrl(src)) {
                    setImageToGrayPlaceholder(img, src, { remember: false });
                }
            });
        };
        hideKnownBrokenImages();
        if (typeof MutationObserver !== "undefined") {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (!node || node.nodeType !== 1)
                            return;
                        if (node.tagName === "IMG") {
                            const src = node.currentSrc || node.src || node.getAttribute("src") || "";
                            if (src && isKnownBrokenImageUrl(src)) {
                                setImageToGrayPlaceholder(node, src, { remember: false });
                            }
                        }
                        else {
                            hideKnownBrokenImages(node);
                        }
                    });
                });
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
        }
    };
})();
initVnexusImageLoadingUX();
const LazyImage = ({ src, containerCls = "", imgCls = "", alt = "", onClick, }) => {
    const safeSrc = sanitizeUrl(src);
    const [loaded, setLoaded] = useState(false);
    const [hasError, setHasError] = useState(!safeSrc);
    useEffect(() => {
        setLoaded(false);
        setHasError(!safeSrc);
        // 防止外部圖片 / Storage 圖片在手機網路不穩時沒有觸發 onError，
        // 導致 skeleton shimmer 永遠閃爍。超過時間後直接顯示灰色底，不再讓瀏覽器破圖 icon 出現。
        if (!safeSrc)
            return;
        const timer = setTimeout(() => {
            setHasError(true);
            setLoaded(true);
        }, 9000);
        return () => clearTimeout(timer);
    }, [safeSrc]);
    // 圖片壞掉時不要顯示瀏覽器破圖 icon，直接保留灰色底。
    // 圖片載入中加上更明顯的深色 shimmer，讓使用者知道畫面正在載入，而不是卡住。
    return (React.createElement("div", { onClick: onClick, className: `relative overflow-hidden bg-[#1D2130] ${containerCls}`, "aria-label": alt || "圖片" },
        !loaded && !hasError && (React.createElement("div", { className: "absolute inset-0 vnexus-image-skeleton z-0", "aria-hidden": "true" })),
        safeSrc && !hasError && (React.createElement("img", { src: safeSrc, alt: alt, className: `relative z-10 w-full h-full object-cover transition-opacity duration-300 ease-out ${loaded ? "opacity-100" : "opacity-0"} ${imgCls}`, onLoad: (e) => {
                e.currentTarget.classList.add("vnexus-image-loaded");
                forgetBrokenImageUrl(safeSrc);
                setLoaded(true);
            }, onError: (e) => {
                setImageToGrayPlaceholder(e.currentTarget, safeSrc || e.currentTarget.currentSrc || e.currentTarget.src);
                setHasError(true);
                setLoaded(true);
            }, loading: "lazy", decoding: "async" }))));
};
const FloatingChat = ({ targetVtuber, currentUser, myProfile, onClose, showToast, onNavigateProfile, }) => {
    const { onlineUsers } = useContext(AppContext);
    const isOnline = onlineUsers.has(targetVtuber.id);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const scrollRef = useRef();
    const roomId = generateRoomId(currentUser.uid, targetVtuber.id);
    const targetStatus = targetVtuber.activityStatus === "sleep"
        ? { label: "暫時休息", dot: "bg-[#94A3B8]", text: "text-[#CBD5E1]" }
        : targetVtuber.activityStatus === "graduated"
            ? { label: "已畢業", dot: "bg-[#64748B]", text: "text-[#94A3B8]" }
            : targetVtuber.activityStatus === "creator"
                ? { label: "我是繪師 / 建模師 / 剪輯師", dot: "bg-[#38BDF8]", text: "text-[#38BDF8]" }
                : { label: "開放聯動", dot: "bg-[#22C55E]", text: "text-[#22C55E]" };
    const collabPreview = Array.isArray(targetVtuber.collabTypes) && targetVtuber.collabTypes.length > 0
        ? targetVtuber.collabTypes.slice(0, 3).join("、")
        : "尚未填寫聯動偏好";
    useEffect(() => {
        // 改為：依照時間倒序排 (最新的在前面)，並且限制最多只拿最新 50 筆
        const q = query(collection(db, getMsgPath(roomId)), orderBy("createdAt", "desc"), limit(30));
        const unsub = onSnapshot(q, (snap) => {
            // 因為我們是用 desc 拿最新的 50 筆，陣列順序會是 [最新, 次新, ... , 最舊]
            // 顯示在畫面上時，我們需要把它反過來，變成 [最舊, ..., 次新, 最新]，最新的才會在底部
            const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
            setMessages(msgs);
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        });
        return unsub;
    }, [roomId]);
    useEffect(() => {
        // 當訊息列表有變動（代表有新訊息）且視窗是開啟狀態時，自動清除自己的未讀狀態
        if (messages.length > 0 && currentUser) {
            const roomRef = doc(db, `artifacts/${APP_ID}/public/data/chat_rooms`, roomId);
            updateDoc(roomRef, {
                unreadBy: arrayRemove(currentUser.uid),
            }).catch((e) => console.error("自動清除未讀失敗:", e));
        }
    }, [messages, currentUser.uid]);
    const handleSafetyAction = (type) => {
        if (type === "block") {
            showToast("封鎖入口已準備好，後續可接上封鎖名單功能。");
        }
        else {
            showToast("檢舉入口已準備好，若遇到騷擾請先截圖並聯絡管理員。");
        }
    };
    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || !currentUser || !targetVtuber?.id)
            return;
        if (input.trim().length > 500)
            return showToast("訊息不能超過 500 字！");
        const text = input.trim();
        const now = Date.now();
        const roomRef = doc(db, getPath("chat_rooms"), roomId);
        setInput("");
        try {
            // ✅ 重要修正：先建立 / 更新聊天室主文件，確保一般使用者在 Rules 中是 participants。
            // 舊版流程是「先寫 messages，再寫 chat_rooms」，在較嚴格的 Firestore Rules 下會導致一般使用者 permission-denied。
            let roomData = {};
            try {
                const roomSnap = await getDoc(roomRef);
                roomData = roomSnap.exists() ? roomSnap.data() : {};
            }
            catch (readErr) {
                console.warn("讀取聊天室主文件失敗，仍會嘗試建立聊天室:", readErr);
            }
            const lastEmailTime = roomData.lastEmailSentAt || 0;
            const lastNotifTime = roomData.lastNotifSentAt || 0;
            const shouldCreateNotification = now - lastNotifTime > 1 * 60 * 1000;
            const shouldSendEmail = now - lastEmailTime > 10 * 60 * 1000;
            const roomUpdate = {
                lastTimestamp: now,
                lastMessage: text,
                participants: [currentUser.uid, targetVtuber.id],
                unreadBy: arrayUnion(targetVtuber.id),
            };
            if (shouldCreateNotification) {
                roomUpdate.lastNotifSentAt = now;
                if (shouldSendEmail)
                    roomUpdate.lastEmailSentAt = now;
            }
            // 1. 先確保聊天室存在，讓收件方的聊天列表可以透過 participants 查到。
            await setDoc(roomRef, roomUpdate, { merge: true });
            // 2. 再寫入訊息到子集合。
            await addDoc(collection(db, getMsgPath(roomId)), {
                senderId: currentUser.uid,
                text,
                createdAt: now,
            });
            // 3. 通知失敗不應該讓聊天訊息失敗；因此獨立 try/catch。
            if (shouldCreateNotification) {
                try {
                    await addDoc(collection(db, getPath("notifications")), {
                        userId: targetVtuber.id,
                        fromUserId: currentUser.uid,
                        fromUserName: myProfile?.name || "創作者",
                        fromUserAvatar: myProfile?.avatar || "",
                        message: "傳送了一則私訊，請到聊天室看看誰回覆了你。",
                        createdAt: now,
                        read: false,
                        type: "chat_notification",
                    });
                }
                catch (notifErr) {
                    console.warn("聊天訊息已送出，但通知建立失敗:", notifErr);
                }
            }
        }
        catch (err) {
            console.error("發送過程出錯詳細資訊:", err);
            showToast(`傳送失敗：${err.code || ""} ${err.message || "請確認登入狀態或權限"}`);
        }
    };
    return (React.createElement("div", { className: "vnexus-floating-chat fixed inset-0 sm:inset-y-4 sm:left-auto sm:right-4 z-[100] w-full sm:w-[380px] lg:w-[420px] h-[100dvh] sm:h-[calc(100vh-2rem)] bg-[#0F111A] border-l sm:border border-[#2A2F3D] sm:rounded-2xl shadow-xl flex flex-col overflow-hidden animate-fade-in-up" },
        React.createElement("div", { className: "bg-[#181B25] border-b border-[#2A2F3D] p-4 flex-shrink-0" },
            React.createElement("div", { className: "flex justify-between items-start gap-3" },
                React.createElement("div", { className: "flex items-start gap-3 cursor-pointer hover:opacity-90 transition-opacity min-w-0", onClick: () => {
                        if (onNavigateProfile)
                            onNavigateProfile(targetVtuber);
                        if (window.innerWidth < 640)
                            onClose();
                    }, title: "\u67E5\u770B\u540D\u7247" },
                    React.createElement("div", { className: "relative flex-shrink-0" },
                        React.createElement("img", { src: sanitizeUrl(targetVtuber.avatar), className: "w-12 h-12 rounded-2xl border border-[#2A2F3D] object-cover bg-[#11131C]", alt: targetVtuber.name || "創作者頭像" }),
                        isOnline && (React.createElement("div", { className: "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#22C55E] border-2 border-[#181B25] rounded-full" }))),
                    React.createElement("div", { className: "min-w-0" },
                        React.createElement("div", { className: "flex items-center gap-2 min-w-0" },
                            React.createElement("h3", { className: "font-bold text-white text-base truncate" }, targetVtuber.name),
                            targetVtuber.isVerified && React.createElement("span", { className: "text-[#38BDF8] text-xs flex-shrink-0" }, "\u5DF2\u8A8D\u8B49")),
                        React.createElement("div", { className: "mt-1 flex flex-wrap items-center gap-2 text-xs" },
                            React.createElement("span", { className: `inline-flex items-center gap-1 ${targetStatus.text}` },
                                React.createElement("span", { className: `w-2 h-2 rounded-full ${targetStatus.dot}` }),
                                targetStatus.label),
                            React.createElement("span", { className: "text-[#94A3B8] truncate max-w-[220px]" },
                                "\u504F\u597D\uFF1A",
                                collabPreview)))),
                React.createElement("button", { onClick: onClose, className: "hover:bg-white/10 text-[#94A3B8] hover:text-white w-9 h-9 rounded-xl transition-colors flex items-center justify-center flex-shrink-0", "aria-label": "\u95DC\u9589\u804A\u5929\u5BA4" },
                    React.createElement("i", { className: "fa-solid fa-xmark" }))),
            React.createElement("div", { className: "mt-3 flex items-center justify-between gap-2 text-xs" },
                React.createElement("button", { type: "button", onClick: () => handleSafetyAction("block"), className: "px-3 py-1.5 rounded-full border border-[#2A2F3D] text-[#94A3B8] hover:text-white hover:bg-[#1D2130] transition-colors" }, "\u5C01\u9396"),
                React.createElement("button", { type: "button", onClick: () => handleSafetyAction("report"), className: "px-3 py-1.5 rounded-full border border-[#2A2F3D] text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors" }, "\u6AA2\u8209"))),
        React.createElement("div", { className: "bg-[#11131C] border-b border-[#2A2F3D] px-4 py-3 flex-shrink-0" },
            React.createElement("p", { className: "text-sm text-[#94A3B8] leading-relaxed" }, "\u8ACB\u4FDD\u6301\u79AE\u8C8C\uFF0C\u907F\u514D\u4EA4\u63DB\u904E\u5EA6\u654F\u611F\u8CC7\u6599\uFF1B\u8A0A\u606F\u50C5\u7559\u4E03\u5929\uFF0C\u9577\u7BC7\u8A0E\u8AD6\u5EFA\u8B70\u8F49\u81F3 DC\u3002")),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4 space-y-3 bg-[#0F111A]" },
            messages.length === 0 && (React.createElement("div", { className: "min-h-full flex items-center justify-center text-center px-6" },
                React.createElement("div", { className: "max-w-xs" },
                    React.createElement("div", { className: "w-14 h-14 rounded-2xl bg-[#1D2130] border border-[#2A2F3D] flex items-center justify-center mx-auto mb-4 text-[#8B5CF6]" },
                        React.createElement("i", { className: "fa-regular fa-comment-dots text-xl" })),
                    React.createElement("p", { className: "text-white font-bold mb-2" }, "\u9019\u88E1\u9084\u6C92\u6709\u8A0A\u606F"),
                    React.createElement("p", { className: "text-sm text-[#94A3B8] leading-relaxed" }, "\u6253\u8072\u62DB\u547C\uFF0C\u6216\u5148\u770B\u770B\u5C0D\u65B9\u7684\u540D\u7247\uFF0C\u627E\u4E00\u500B\u9069\u5408\u4E00\u8D77\u76F4\u64AD\u7684\u8A71\u984C\u3002")))),
            messages.map((m) => (React.createElement("div", { key: m.id, className: `flex ${m.senderId === currentUser.uid ? "justify-end" : "justify-start"}` },
                React.createElement("div", { className: `max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-sm break-words whitespace-pre-wrap ${m.senderId === currentUser.uid
                        ? "bg-[#8B5CF6] text-white rounded-tr-none"
                        : "bg-[#181B25] text-[#E2E8F0] rounded-tl-none border border-[#2A2F3D]"}` }, m.text)))),
            React.createElement("div", { ref: scrollRef })),
        React.createElement("form", { onSubmit: handleSend, className: "p-3 sm:p-4 bg-[#181B25]/95 border-t border-[#2A2F3D] flex gap-2 flex-shrink-0" },
            React.createElement("input", { type: "text", value: input, onChange: (e) => setInput(e.target.value), placeholder: "\u6253\u8072\u62DB\u547C\uFF0C\u6216\u804A\u804A\u60F3\u4E00\u8D77\u505A\u7684\u4F01\u5283...", className: "flex-1 bg-[#0F111A] border border-[#2A2F3D] rounded-xl px-4 py-3 text-[16px] text-white outline-none focus:border-[#8B5CF6] transition-all" }),
            React.createElement("button", { type: "submit", className: "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-4 sm:px-5 h-12 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 font-bold" }, "\u9001\u51FA"))));
};
const uploadImageToStorage = async (uid, dataStr, fileName) => {
    // 加上更嚴格的檢查：dataStr 必須是字串且長度大於 0
    if (typeof dataStr !== "string" ||
        !dataStr ||
        !dataStr.startsWith("data:image"))
        return dataStr || "";
    try {
        const storagePath = uid === "system"
            ? `system/${fileName}`
            : String(fileName).startsWith("bulletin_")
                ? `bulletin_covers/${uid}/${fileName}`
                : `vtubers/${uid}/${fileName}`;
        const storageRef = ref(storage, storagePath);
        await uploadString(storageRef, dataStr, "data_url");
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
    }
    catch (error) {
        console.error("Storage 上傳失敗:", error);
        // 如果上傳失敗（例如沒開 Storage 權限），回傳空字串防止 Firestore 寫入失敗
        return "";
    }
};
const sanitizeUrl = (url) => {
    if (typeof url !== "string" || !url)
        return "";
    const u = url.trim();
    let decoded = u;
    try {
        let prevDecoded;
        do {
            prevDecoded = decoded;
            decoded = decodeURIComponent(decoded);
        } while (prevDecoded !== decoded && decoded.length < 2000);
    }
    catch (e) { }
    const normalized = decoded
        .replace(/[\s\x00-\x1f\x7f-\x9f]/g, "")
        .toLowerCase();
    if (normalized.startsWith("javascript:") ||
        normalized.startsWith("vbscript:") ||
        normalized.startsWith("data:text")) {
        return "about:blank";
    }
    // ✅ 手機版重新整理修正：不要因為一次暫時載入失敗就把圖片 URL 永久視為壞圖。
    // 先前 isKnownBrokenImageUrl(u) 會讓 sanitizeUrl 回傳空字串，導致再次重新整理後頭像 / 作品圖直接消失。
    // 這裡一律保留原始安全 URL，讓瀏覽器每次都能重新嘗試載入。
    return u;
};
const StatusCommentCount = ({ storyOwner }) => {
    const ownerId = storyOwner?.id || "";
    const statusMessageUpdatedAt = Number(storyOwner?.statusMessageUpdatedAt || 0);
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!ownerId || !statusMessageUpdatedAt) {
            setCount(0);
            return;
        }
        const commentsRef = collection(db, `${getPath("vtubers")}/${ownerId}/status_comments`);
        const q = query(commentsRef, where("statusMessageUpdatedAt", "==", statusMessageUpdatedAt));
        const unsub = onSnapshot(q, (snap) => {
            setCount(snap.size);
        }, (err) => {
            console.warn("讀取動態留言數失敗:", err);
            setCount(0);
        });
        return unsub;
    }, [ownerId, statusMessageUpdatedAt]);
    if (!count)
        return null;
    return (React.createElement("span", { className: "ml-1 text-[#94A3B8] text-xs font-bold leading-none" }, count > 99 ? "99+" : count));
};
const StatusCommentsBox = ({ storyOwner, currentUser, myProfile, isAdmin, isVerifiedUser, realVtubers, showToast, }) => {
    const ownerId = storyOwner?.id || "";
    const statusMessageUpdatedAt = Number(storyOwner?.statusMessageUpdatedAt || 0);
    const [comments, setComments] = useState([]);
    const [expanded, setExpanded] = useState(false);
    const [input, setInput] = useState("");
    const [hasMoreComments, setHasMoreComments] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState("");
    useEffect(() => {
        if (!ownerId || !statusMessageUpdatedAt) {
            setComments([]);
            return;
        }
        const commentsRef = collection(db, `${getPath("vtubers")}/${ownerId}/status_comments`);
        const q = query(commentsRef, orderBy("createdAt", "desc"), limit(expanded ? 50 : 4));
        const unsub = onSnapshot(q, (snap) => {
            let rows = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((c) => Number(c.statusMessageUpdatedAt || 0) === statusMessageUpdatedAt)
                .reverse();
            setHasMoreComments(!expanded && rows.length > 3);
            if (!expanded && rows.length > 3)
                rows = rows.slice(-3);
            setComments(rows);
        }, (err) => {
            console.warn("讀取動態留言失敗:", err);
            setComments([]);
        });
        return unsub;
    }, [ownerId, statusMessageUpdatedAt, expanded]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        const text = input.trim();
        if (!currentUser)
            return showToast("請先登入！");
        if (!isVerifiedUser)
            return showToast("需通過名片認證才能留言！");
        if (!text)
            return;
        if (text.length > 200)
            return showToast("留言最多 200 字");
        setSubmitting(true);
        try {
            const authToken = await auth.currentUser?.getIdToken(true);
            const fn = httpsCallable(functionsInstance, "addStatusComment");
            await fn({ storyOwnerId: ownerId, statusMessageUpdatedAt, text, authToken });
            setInput("");
            showToast("留言已送出");
        }
        catch (err) {
            console.error("新增動態留言失敗:", err);
            showToast(err?.message || "留言失敗，請稍後再試");
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleDelete = async (commentId) => {
        if (!commentId || deletingId)
            return;
        if (!confirm("確定要刪除這則留言嗎？"))
            return;
        setDeletingId(commentId);
        try {
            const authToken = await auth.currentUser?.getIdToken(true);
            const fn = httpsCallable(functionsInstance, "deleteStatusComment");
            await fn({ storyOwnerId: ownerId, commentId, authToken });
            showToast("留言已刪除");
        }
        catch (err) {
            console.error("刪除動態留言失敗:", err);
            showToast(err?.message || "刪除留言失敗");
        }
        finally {
            setDeletingId("");
        }
    };
    return (React.createElement("div", { className: "mt-3 pt-3 border-t border-[#2A2F3D]/70", onClick: (e) => e.stopPropagation() },
        comments.length > 0 && (React.createElement("div", { className: "space-y-2 mb-3" },
            comments.map((comment) => {
                const commenter = realVtubers.find((v) => v.id === comment.commenterId);
                const canDelete = isAdmin || currentUser?.uid === ownerId || currentUser?.uid === comment.commenterId;
                return (React.createElement("div", { key: comment.id, className: "flex items-start gap-2 group/comment" },
                    React.createElement("img", { src: sanitizeUrl(comment.commenterAvatar || commenter?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Anon"), className: "w-7 h-7 rounded-full object-cover border border-[#2A2F3D] flex-shrink-0", alt: comment.commenterName || commenter?.name || "留言者" }),
                    React.createElement("div", { className: "min-w-0 flex-1 rounded-2xl bg-[#11131C] border border-[#2A2F3D] px-3 py-2" },
                        React.createElement("div", { className: "flex items-center justify-between gap-2 mb-0.5" },
                            React.createElement("div", { className: "min-w-0 flex items-center gap-2 text-[11px]" },
                                React.createElement("span", { className: "text-[#CBD5E1] font-bold truncate" }, comment.commenterName || commenter?.name || "創作者"),
                                React.createElement("span", { className: "text-[#64748B] flex-shrink-0" }, formatRelativeTime(comment.createdAt))),
                            canDelete && (React.createElement("button", { type: "button", disabled: deletingId === comment.id, onClick: () => handleDelete(comment.id), className: "opacity-70 sm:opacity-0 group-hover/comment:opacity-100 text-[#94A3B8] hover:text-[#EF4444] transition-all text-[11px] flex-shrink-0", title: "\u522A\u9664\u7559\u8A00" },
                                React.createElement("i", { className: "fa-solid fa-trash-can" })))),
                        React.createElement("p", { className: "text-[#E2E8F0] text-sm leading-relaxed whitespace-pre-wrap break-words" }, comment.text))));
            }),
            !expanded && hasMoreComments && (React.createElement("button", { type: "button", onClick: () => setExpanded(true), className: "text-[#94A3B8] hover:text-[#F59E0B] text-xs font-bold transition-colors" }, "\u67E5\u770B\u66F4\u591A\u7559\u8A00")),
            expanded && comments.length > 0 && (React.createElement("button", { type: "button", onClick: () => setExpanded(false), className: "text-[#94A3B8] hover:text-[#F59E0B] text-xs font-bold transition-colors" }, "\u6536\u5408\u7559\u8A00")))),
        currentUser && isVerifiedUser ? (React.createElement("form", { onSubmit: handleSubmit, className: "flex items-center gap-2" },
            React.createElement("img", { src: sanitizeUrl(myProfile?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Me"), className: "w-8 h-8 rounded-full object-cover border border-[#2A2F3D] flex-shrink-0", alt: "\u6211\u7684\u982D\u50CF" }),
            React.createElement("div", { className: "flex-1 min-w-0 relative" },
                React.createElement("input", { value: input, onChange: (e) => setInput(e.target.value.slice(0, 200)), maxLength: "200", className: "w-full h-10 rounded-full bg-[#0F111A] border border-[#2A2F3D] px-4 pr-14 text-sm text-white outline-none focus:border-[#F59E0B] transition-colors", placeholder: "\u7559\u8A00\u56DE\u61C9\u9019\u5247\u52D5\u614B..." }),
                React.createElement("span", { className: `absolute right-4 top-1/2 -translate-y-1/2 text-[10px] ${input.length >= 190 ? 'text-[#EF4444]' : 'text-[#64748B]'}` },
                    input.length,
                    "/200")),
            React.createElement("button", { type: "submit", disabled: !input.trim() || submitting, className: `h-10 px-3 rounded-full text-xs font-bold transition-colors flex-shrink-0 ${input.trim() && !submitting ? 'bg-[#F59E0B] hover:bg-[#D97706] text-[#0F111A]' : 'bg-[#1D2130] text-[#64748B] cursor-not-allowed'}` }, "\u9001\u51FA"))) : (React.createElement("p", { className: "text-[11px] text-[#64748B]" }, "\u9700\u767B\u5165\u4E26\u901A\u904E\u540D\u7247\u8A8D\u8B49\u5F8C\u624D\u80FD\u7559\u8A00\u3002"))));
};
const PREDEFINED_COLLABS = [
    "APEX",
    "瓦羅蘭",
    "LOL",
    "FPS",
    "Minecraft",
    "合作遊戲",
    "企劃",
    "歌回",
    "雜談",
];
const COLLAB_CATEGORIES = ["遊戲", "雜談歌回", "特別企劃"];
const ARTICLE_CATEGORIES = ['新手教學', '企劃分享', '心路歷程', '設備推薦', '綜合討論']; // 
const ArticlesPage = ({ articles, onPublish, onDelete, onIncrementView }) => {
    // 🌟 2. 從 Context 直接取得全域狀態
    const { user, isVerifiedUser, isAdmin, showToast, realVtubers } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState('list');
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [filterCategory, setFilterCategory] = useState('All');
    const [form, setForm] = useState({ title: '', category: ARTICLE_CATEGORIES[0], content: '', coverUrl: '' });
    const [sortOrder, setSortOrder] = useState('latest'); // 👈 新增：排序狀態
    // 👇 修改：根據目前的排序狀態，決定文章要怎麼排
    const publishedArticles = (articles || [])
        .filter(a => a.status === 'published')
        .sort((a, b) => {
        if (sortOrder === 'popular') {
            return (b.views || 0) - (a.views || 0); // 最受歡迎：閱讀數由高到低
        }
        return b.createdAt - a.createdAt; // 最新發布：時間由新到舊 (預設)
    });
    const myArticles = (articles || []).filter(a => user && a.userId === user.uid).sort((a, b) => b.createdAt - a.createdAt);
    const displayList = filterCategory === 'All' ? publishedArticles : publishedArticles.filter(a => a.category === filterCategory);
    const currentArticle = selectedArticle ? (articles || []).find(a => a.id === selectedArticle.id) || selectedArticle : null;
    const handlePublish = async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.content.trim())
            return showToast('標題與內容為必填！');
        if (!isVerifiedUser)
            return showToast('需通過名片認證才能發表文章！');
        await onPublish(form);
        setForm({ title: '', category: ARTICLE_CATEGORIES[0], content: '', coverUrl: '' });
        setActiveTab('mine');
    };
    const handleCoverUpload = (e) => {
        const file = e.target.files[0];
        if (!file)
            return;
        if (file.size > 3 * 1024 * 1024) {
            e.target.value = '';
            return showToast("❌ 檔案太大！請選擇 3MB 以下的圖片。");
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            // 存入 base64 供預覽，發布時 App 會負責上傳
            setForm({ ...form, coverUrl: event.target.result });
            showToast("✅ 封面圖已選擇");
        };
        reader.readAsDataURL(file);
    };
    const renderContent = (text) => {
        return text.split('\n').map((line, idx) => {
            if (line.startsWith('## '))
                return React.createElement("h2", { key: idx, className: "text-2xl font-bold text-white mt-6 mb-3" }, line.replace('## ', ''));
            if (line.startsWith('### '))
                return React.createElement("h3", { key: idx, className: "text-xl font-bold text-[#7DD3FC] mt-4 mb-2" }, line.replace('### ', ''));
            if (line.startsWith('- '))
                return React.createElement("li", { key: idx, className: "text-[#CBD5E1] ml-4 mb-1 list-disc flex items-start gap-2" },
                    React.createElement("span", { className: "text-[#38BDF8] mt-1" }, "\u2022"),
                    " ",
                    React.createElement("span", null, line.replace('- ', '')));
            return React.createElement("p", { key: idx, className: "text-[#CBD5E1] leading-relaxed mb-4 min-h-[1.5rem]" }, line);
        });
    };
    return (React.createElement("div", { className: "max-w-5xl mx-auto px-4 py-8 animate-fade-in-up" },
        React.createElement("div", { className: "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8" },
            React.createElement("div", null,
                React.createElement("h2", { className: "text-3xl font-extrabold text-[#38BDF8] flex items-center gap-3" },
                    React.createElement("i", { className: "fa-solid fa-book-open-reader" }),
                    " VTuber \u5BF6\u5178"),
                React.createElement("p", { className: "text-[#94A3B8] mt-2 text-sm" }, "\u5206\u4EAB\u7D93\u9A57\u3001\u5B78\u7FD2\u6210\u9577\uFF0C\u8B93\u60A8\u7684 V \u5708\u4E4B\u8DEF\u5C11\u8D70\u5F4E\u8DEF\u3002")),
            React.createElement("div", { className: "flex gap-2" },
                React.createElement("button", { onClick: () => setActiveTab('list'), className: `px-4 py-2 rounded-xl font-bold transition-all ${activeTab === 'list' || activeTab === 'read' ? 'bg-[#38BDF8] text-[#0F111A]' : 'bg-[#181B25] text-[#94A3B8] hover:bg-[#1D2130]'}` }, "\u6587\u7AE0\u5217\u8868"),
                isVerifiedUser && React.createElement("button", { onClick: () => setActiveTab('mine'), className: `px-4 py-2 rounded-xl font-bold transition-all ${activeTab === 'mine' ? 'bg-[#38BDF8] text-[#0F111A]' : 'bg-[#181B25] text-[#94A3B8] hover:bg-[#1D2130]'}` }, "\u6211\u7684\u6587\u7AE0"),
                isVerifiedUser && React.createElement("button", { onClick: () => setActiveTab('create'), className: `px-4 py-2 rounded-xl font-bold transition-all ${activeTab === 'create' ? 'bg-[#22C55E] text-[#0F111A]' : 'bg-[#181B25] text-[#94A3B8] hover:bg-[#1D2130]'}` },
                    React.createElement("i", { className: "fa-solid fa-pen-nib mr-1" }),
                    " \u5BEB\u6587\u7AE0"))),
        activeTab === 'list' && (React.createElement("div", { className: "space-y-6" },
            React.createElement("div", { className: "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" },
                React.createElement("div", { className: "flex gap-2 overflow-x-auto pb-2 custom-scrollbar flex-1 w-full sm:w-auto" },
                    React.createElement("button", { onClick: () => setFilterCategory('All'), className: `px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filterCategory === 'All' ? 'bg-[#38BDF8] text-[#0F111A]' : 'bg-[#181B25] text-[#94A3B8] hover:bg-[#1D2130]'}` }, "\u5168\u90E8"),
                    ARTICLE_CATEGORIES.map(c => (React.createElement("button", { key: c, onClick: () => setFilterCategory(c), className: `px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filterCategory === c ? 'bg-[#38BDF8] text-[#0F111A]' : 'bg-[#181B25] text-[#94A3B8] hover:bg-[#1D2130]'}` }, c)))),
                React.createElement("div", { className: "flex items-center gap-2 flex-shrink-0 bg-[#181B25]/80 p-1.5 rounded-xl border border-[#2A2F3D]" },
                    React.createElement("span", { className: "text-sm text-[#94A3B8] font-bold ml-2" },
                        React.createElement("i", { className: "fa-solid fa-sort" }),
                        " \u6392\u5E8F"),
                    React.createElement("select", { value: sortOrder, onChange: e => setSortOrder(e.target.value), className: "bg-[#0F111A] border border-[#2A2F3D] text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-[#38BDF8] transition-colors cursor-pointer" },
                        React.createElement("option", { value: "latest" }, "\u6700\u65B0\u767C\u5E03"),
                        React.createElement("option", { value: "popular" }, "\u6700\u53D7\u6B61\u8FCE (\u6700\u591A\u95B1\u8B80)")))),
            React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" }, displayList.length === 0 ? (React.createElement("div", { className: "col-span-3 text-center py-12 px-6 bg-[#181B25] rounded-2xl border border-[#2A2F3D]" },
                React.createElement("p", { className: "text-[#F8FAFC] font-bold text-lg" }, "\u9019\u500B\u5206\u985E\u9084\u6C92\u6709\u6587\u7AE0"),
                React.createElement("p", { className: "text-[#94A3B8] text-sm mt-2" }, "\u5206\u4EAB\u4F60\u7684\u7D93\u9A57\uFF0C\u8B93\u4E0B\u4E00\u4F4D\u5275\u4F5C\u8005\u5C11\u8D70\u4E00\u9EDE\u5F4E\u8DEF\u3002"))) : displayList.map(a => {
                const author = realVtubers.find(v => v.id === a.userId);
                return (React.createElement("div", { key: a.id, onClick: () => { setSelectedArticle(a); setActiveTab('read'); if (onIncrementView)
                        onIncrementView(a.id); }, className: "bg-[#181B25]/60 border border-[#2A2F3D] rounded-2xl overflow-hidden hover:border-[#38BDF8]/50 hover:shadow-sm cursor-pointer transition-all flex flex-col h-full group" },
                    a.coverUrl && (React.createElement("div", { className: "h-40 overflow-hidden relative" },
                        React.createElement("img", { src: sanitizeUrl(a.coverUrl), className: "w-full h-full object-cover group-transition-transform duration-500" }),
                        React.createElement("div", { className: "vnexus-critical-gradient absolute inset-0 bg-gradient-to-t from-gray-950/70 to-transparent" }),
                        React.createElement("span", { className: "vnexus-article-category-badge absolute bottom-2 left-3 z-20 bg-[#38BDF8] text-[#0F111A] text-[10px] font-bold px-2 py-0.5 rounded shadow" }, a.category))),
                    React.createElement("div", { className: "p-3 sm:p-5 flex-1 flex flex-col" },
                        !a.coverUrl && React.createElement("span", { className: "bg-[#38BDF8] text-[#0F111A] text-[10px] font-bold px-2 py-0.5 rounded shadow w-fit mb-2" }, a.category),
                        React.createElement("h3", { className: "font-bold text-white text-lg mb-2 line-clamp-2 group-hover:text-[#38BDF8] transition-colors" }, a.title),
                        React.createElement("p", { className: "text-sm text-[#94A3B8] line-clamp-3 mb-4" }, a.content.replace(/[#*]/g, '')),
                        React.createElement("div", { className: "mt-auto pt-4 border-t border-[#2A2F3D] flex items-center justify-between" },
                            React.createElement("div", { className: "flex items-center gap-3" },
                                React.createElement("img", { src: sanitizeUrl(author?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anon'), className: "w-8 h-8 rounded-full border border-[#2A2F3D] object-cover flex-shrink-0" }),
                                React.createElement("div", { className: "text-xs min-w-0" },
                                    React.createElement("p", { className: "text-[#CBD5E1] font-bold truncate" }, author?.name || '匿名創作者'),
                                    React.createElement("p", { className: "text-[#64748B]" }, formatTime(a.createdAt)))),
                            React.createElement("div", { className: "text-xs text-[#64748B] font-bold flex items-center gap-1.5 flex-shrink-0" },
                                React.createElement("i", { className: "fa-solid fa-eye" }),
                                " ",
                                a.views || 0)))));
            })))),
        activeTab === 'read' && currentArticle && (React.createElement("div", { className: "bg-[#181B25]/40 border border-[#2A2F3D] rounded-2xl p-6 sm:p-10 shadow-sm relative" },
            React.createElement("button", { onClick: () => setActiveTab('list'), className: "text-[#38BDF8] hover:text-white mb-6 font-bold text-sm flex items-center gap-2 transition-colors" },
                React.createElement("i", { className: "fa-solid fa-arrow-left" }),
                " \u8FD4\u56DE\u5217\u8868"),
            currentArticle.coverUrl && React.createElement("img", { src: sanitizeUrl(currentArticle.coverUrl), className: "w-full h-64 sm:h-96 object-cover rounded-2xl mb-8 border border-[#2A2F3D]" }),
            React.createElement("div", { className: "flex items-center gap-3 mb-4" },
                React.createElement("span", { className: "bg-[#38BDF8] text-[#0F111A] text-xs font-bold px-3 py-1 rounded-full" }, currentArticle.category),
                React.createElement("span", { className: "text-[#94A3B8] text-sm flex items-center gap-1" },
                    React.createElement("i", { className: "fa-regular fa-clock" }),
                    formatTime(currentArticle.createdAt)),
                React.createElement("span", { className: "text-[#94A3B8] text-sm flex items-center gap-1" },
                    React.createElement("i", { className: "fa-solid fa-eye" }),
                    currentArticle.views || 0)),
            React.createElement("h1", { className: "text-3xl sm:text-4xl font-extrabold text-white mb-8 leading-tight" }, currentArticle.title),
            React.createElement("div", { className: "flex items-center gap-4 mb-8 pb-8 border-b border-[#2A2F3D]" },
                React.createElement("img", { src: sanitizeUrl(realVtubers.find(v => v.id === currentArticle.userId)?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anon'), className: "w-12 h-12 rounded-full border border-[#38BDF8]/50 object-cover" }),
                React.createElement("div", null,
                    React.createElement("p", { className: "text-[#E2E8F0] font-bold" }, realVtubers.find(v => v.id === currentArticle.userId)?.name || '匿名創作者'),
                    React.createElement("p", { className: "text-xs text-[#64748B]" }, "\u6587\u7AE0\u4F5C\u8005"))),
            React.createElement("article", { className: "prose prose-invert prose-blue max-w-none text-[#CBD5E1]" }, renderContent(currentArticle.content)))),
        activeTab === 'mine' && (React.createElement("div", { className: "space-y-4" }, myArticles.length === 0 ? (React.createElement("div", { className: "text-center py-12 px-6 bg-[#181B25]/40 rounded-2xl border border-[#2A2F3D]" },
            React.createElement("p", { className: "text-[#F8FAFC] font-bold text-lg" }, "\u4F60\u9084\u6C92\u6709\u767C\u8868\u6587\u7AE0"),
            React.createElement("p", { className: "text-[#94A3B8] text-sm mt-2" }, "\u628A\u4F60\u7684\u76F4\u64AD\u7D93\u9A57\u3001\u4F01\u5283\u5FC3\u5F97\u6216\u8E29\u96F7\u7B46\u8A18\u5206\u4EAB\u7D66\u5927\u5BB6\u5427\u3002"))) : myArticles.map(a => (React.createElement("div", { key: a.id, className: "bg-[#181B25] border border-[#2A2F3D] p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-[#38BDF8]/30 transition-colors" },
            React.createElement("div", { className: "col-span-2 sm:col-span-1 min-w-0" },
                React.createElement("div", { className: "flex items-center gap-2 mb-2" },
                    a.status === 'published' ? React.createElement("span", { className: "bg-[#22C55E]/20 text-[#22C55E] text-[10px] font-bold px-2 py-0.5 rounded border border-[#22C55E]/30 flex items-center gap-1" },
                        React.createElement("i", { className: "fa-solid fa-check" }),
                        "\u5DF2\u767C\u5E03") : React.createElement("span", { className: "bg-[#F59E0B]/20 text-[#F59E0B] text-[10px] font-bold px-2 py-0.5 rounded border border-[#F59E0B]/30 flex items-center gap-1" },
                        React.createElement("i", { className: "fa-solid fa-hourglass-half" }),
                        "\u5BE9\u6838\u4E2D"),
                    React.createElement("span", { className: "text-[#38BDF8] text-[10px] font-bold px-2 py-0.5 rounded bg-[#38BDF8]/10 border border-[#38BDF8]/20" }, a.category)),
                React.createElement("h3", { className: "font-bold text-white text-lg truncate" }, a.title),
                React.createElement("div", { className: "flex items-center gap-4 mt-1" },
                    React.createElement("p", { className: "text-xs text-[#64748B]" },
                        "\u767C\u5E03\u6642\u9593: ",
                        formatTime(a.createdAt)),
                    React.createElement("p", { className: "text-xs text-[#64748B] font-bold flex items-center gap-1" },
                        React.createElement("i", { className: "fa-solid fa-eye" }),
                        " ",
                        a.views || 0))),
            React.createElement("div", { className: "flex gap-2 w-full sm:w-auto" },
                a.status === 'published' && React.createElement("button", { onClick: () => { setSelectedArticle(a); setActiveTab('read'); if (onIncrementView)
                        onIncrementView(a.id); }, className: "flex-1 sm:flex-none bg-[#38BDF8] hover:bg-[#38BDF8] text-[#0F111A] px-4 py-2 rounded-xl text-sm font-bold transition-colors" }, "\u95B1\u8B80"),
                React.createElement("button", { onClick: () => onDelete(a.id), className: "flex-1 sm:flex-none bg-[#3B171D]/50 hover:bg-[#7F1D1D] text-[#EF4444] hover:text-white border border-[#EF4444]/30 px-4 py-2 rounded-xl text-sm font-bold transition-colors" }, "\u522A\u9664\u6587\u7AE0"))))))),
        activeTab === 'create' && (React.createElement("form", { onSubmit: handlePublish, className: "bg-[#181B25]/40 border border-[#2A2F3D] rounded-2xl p-6 sm:p-10 shadow-sm space-y-6" },
            React.createElement("div", { className: "bg-blue-900/20 border border-[#38BDF8]/30 p-4 rounded-xl text-[#7DD3FC] text-sm mb-6 flex items-start gap-2" },
                React.createElement("i", { className: "fa-solid fa-circle-info mt-1" }),
                React.createElement("span", null,
                    "\u767C\u8868\u6587\u7AE0\u5F8C\u9700\u7D93\u7BA1\u7406\u54E1\u5BE9\u6838\u624D\u6703\u516C\u958B\u986F\u793A\u3002\u652F\u63F4\u7C21\u6613\u8A9E\u6CD5\uFF08",
                    React.createElement("code", null, "## \u6A19\u984C2"),
                    ", ",
                    React.createElement("code", null, "### \u6A19\u984C3"),
                    ", ",
                    React.createElement("code", null, "- \u5217\u8868\u9805\u76EE"),
                    "\uFF09\u3002")),
            React.createElement("div", null,
                React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" },
                    "\u6587\u7AE0\u6A19\u984C ",
                    React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                React.createElement("input", { required: true, type: "text", value: form.title, onChange: e => setForm({ ...form, title: e.target.value }), className: "w-full bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-3 text-white focus:ring-[#8B5CF6] outline-none", placeholder: "\u8ACB\u8F38\u5165\u5438\u5F15\u4EBA\u7684\u6A19\u984C..." })),
            React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6" },
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" },
                        "\u6587\u7AE0\u5206\u985E ",
                        React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                    React.createElement("select", { value: form.category, onChange: e => setForm({ ...form, category: e.target.value }), className: "w-full bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-3 text-white focus:ring-[#8B5CF6] outline-none" }, ARTICLE_CATEGORIES.map(c => React.createElement("option", { key: c, value: c }, c)))),
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u5C01\u9762\u5716\u7DB2\u5740 (\u9078\u586B)"),
                    React.createElement("div", { className: "flex items-center gap-4" },
                        form.coverUrl && form.coverUrl.startsWith('data:image') && (React.createElement("div", { className: "relative h-12 w-20 rounded-lg overflow-hidden border border-[#2A2F3D] flex-shrink-0" },
                            React.createElement("img", { src: form.coverUrl, className: "w-full h-full object-cover", alt: "\u5C01\u9762\u9810\u89BD" }),
                            React.createElement("button", { type: "button", onClick: () => setForm({ ...form, coverUrl: '' }), className: "absolute top-0 right-0 bg-[#EF4444]/80 hover:bg-[#EF4444] text-white w-5 h-5 flex items-center justify-center text-[10px] backdrop-blur-sm" },
                                React.createElement("i", { className: "fa-solid fa-xmark" })))),
                        React.createElement("input", { type: "file", accept: "image/*", onChange: handleCoverUpload, className: "w-full bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-2 text-[#94A3B8] focus:ring-[#8B5CF6] outline-none file:cursor-pointer file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-[#8B5CF6]/20 file:text-[#A78BFA] hover:file:bg-[#8B5CF6]/30 transition-colors" })))),
            React.createElement("div", null,
                React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" },
                    "\u6587\u7AE0\u5167\u5BB9 ",
                    React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                React.createElement("textarea", { required: true, rows: "15", value: form.content, onChange: e => setForm({ ...form, content: e.target.value }), className: "w-full bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-3 text-white focus:ring-[#8B5CF6] outline-none font-mono text-sm leading-relaxed", placeholder: "\u5728\u6B64\u8F38\u5165\u6587\u7AE0\u5167\u5BB9..." })),
            React.createElement("div", { className: "flex justify-end pt-4 border-t border-[#2A2F3D]" },
                React.createElement("button", { type: "submit", className: "bg-[#22C55E] hover:bg-[#22C55E] text-[#0F111A] px-8 py-3 rounded-xl font-bold shadow-sm transition-transform flex items-center gap-2" },
                    React.createElement("i", { className: "fa-solid fa-paper-plane" }),
                    " \u9001\u51FA\u5BE9\u6838"))))));
};
const COLOR_OPTIONS = [
    "紅",
    "橙",
    "黃",
    "綠",
    "藍",
    "靛",
    "紫",
    "灰",
    "黑",
    "白",
    "粉",
    "棕",
]; // 新增色系選項
// 創作服務專區：選填，可多選
const CREATOR_ROLE_OPTIONS = ["繪師", "建模師", "剪輯師"];
const CREATOR_STYLE_OPTIONS = [
    "男生角色",
    "女生角色",
    "Q版",
    "頭貼",
    "立繪",
    "插圖",
    "Live2D",
    "精華長篇剪輯",
    "短影音",
    "PV製作",
    "動畫製作",
    "其他(自由填寫)",
];
const CREATOR_STATUS_OPTIONS = ["可接案", "排隊中", "暫不接案", "邀約制"];
const CREATOR_BUDGET_OPTIONS = ["私訊詢價", "1,000 以下", "1,000～3,000", "3,000～5,000", "5,000 以上", "依需求報價"];
const CREATOR_BUDGET_ALIASES = { "歡迎私訊詢價": "私訊詢價" };
const normalizeCreatorBudgetRange = (value) => CREATOR_BUDGET_ALIASES[value] || value || "";
const REQUEST_BUDGET_OPTIONS = ["歡迎私訊報價", "1,000 以下", "1,000～3,000", "3,000～5,000", "5,000～10,000", "10,000 以上", "依需求報價"];
const REQUEST_STYLE_OTHER = "其他(自由填寫)";
// 🌟 新增：12 星座清單
const ZODIAC_SIGNS = [
    "牡羊座", "金牛座", "雙子座", "巨蟹座", "獅子座", "處女座",
    "天秤座", "天蠍座", "射手座", "摩羯座", "水瓶座", "雙魚座"
];
// 🌟 新增：12 星座真實配對指數矩陣 (0~100%)
const ZODIAC_COMPATIBILITY = {
    "牡羊座": { "牡羊座": 90, "金牛座": 65, "雙子座": 85, "巨蟹座": 50, "獅子座": 95, "處女座": 60, "天秤座": 85, "天蠍座": 40, "射手座": 95, "摩羯座": 50, "水瓶座": 75, "雙魚座": 70 },
    "金牛座": { "牡羊座": 65, "金牛座": 90, "雙子座": 70, "巨蟹座": 85, "獅子座": 50, "處女座": 95, "天秤座": 75, "天蠍座": 85, "射手座": 60, "摩羯座": 95, "水瓶座": 50, "雙魚座": 80 },
    "雙子座": { "牡羊座": 85, "金牛座": 70, "雙子座": 90, "巨蟹座": 75, "獅子座": 85, "處女座": 65, "天秤座": 95, "天蠍座": 60, "射手座": 80, "摩羯座": 55, "水瓶座": 95, "雙魚座": 45 },
    "巨蟹座": { "牡羊座": 50, "金牛座": 85, "雙子座": 75, "巨蟹座": 90, "獅子座": 65, "處女座": 85, "天秤座": 55, "天蠍座": 95, "射手座": 60, "摩羯座": 80, "水瓶座": 50, "雙魚座": 95 },
    "獅子座": { "牡羊座": 95, "金牛座": 50, "雙子座": 85, "巨蟹座": 65, "獅子座": 90, "處女座": 70, "天秤座": 85, "天蠍座": 55, "射手座": 95, "摩羯座": 60, "水瓶座": 80, "雙魚座": 50 },
    "處女座": { "牡羊座": 60, "金牛座": 95, "雙子座": 65, "巨蟹座": 85, "獅子座": 70, "處女座": 90, "天秤座": 75, "天蠍座": 85, "射手座": 65, "摩羯座": 95, "水瓶座": 60, "雙魚座": 80 },
    "天秤座": { "牡羊座": 85, "金牛座": 75, "雙子座": 95, "巨蟹座": 55, "獅子座": 85, "處女座": 75, "天秤座": 90, "天蠍座": 70, "射手座": 85, "摩羯座": 60, "水瓶座": 95, "雙魚座": 65 },
    "天蠍座": { "牡羊座": 40, "金牛座": 85, "雙子座": 60, "巨蟹座": 95, "獅子座": 55, "處女座": 85, "天秤座": 70, "天蠍座": 90, "射手座": 65, "摩羯座": 85, "水瓶座": 55, "雙魚座": 95 },
    "射手座": { "牡羊座": 95, "金牛座": 60, "雙子座": 80, "巨蟹座": 60, "獅子座": 95, "處女座": 65, "天秤座": 85, "天蠍座": 65, "射手座": 90, "摩羯座": 75, "水瓶座": 85, "雙魚座": 55 },
    "摩羯座": { "牡羊座": 50, "金牛座": 95, "雙子座": 55, "巨蟹座": 80, "獅子座": 60, "處女座": 95, "天秤座": 60, "天蠍座": 85, "射手座": 75, "摩羯座": 90, "水瓶座": 65, "雙魚座": 80 },
    "水瓶座": { "牡羊座": 75, "金牛座": 50, "雙子座": 95, "巨蟹座": 50, "獅子座": 80, "處女座": 60, "天秤座": 95, "天蠍座": 55, "射手座": 85, "摩羯座": 65, "水瓶座": 90, "雙魚座": 60 },
    "雙魚座": { "牡羊座": 70, "金牛座": 80, "雙子座": 45, "巨蟹座": 95, "獅子座": 50, "處女座": 80, "天秤座": 65, "天蠍座": 95, "射手座": 55, "摩羯座": 80, "水瓶座": 60, "雙魚座": 90 }
};
const inputCls = "w-full min-w-0 box-border bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-3 text-white focus:ring-2 focus:ring-[#8B5CF6] outline-none text-[16px]";
const btnCls = "w-full sm:w-auto bg-[#8B5CF6] hover:bg-[#8B5CF6] text-white py-3 px-8 rounded-xl font-bold shadow-sm transition-transform flex justify-center items-center gap-2";
const formatTime = (ts) => {
    if (!ts)
        return "剛剛";
    const d = new Date(ts);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const formatMonthDayTime = (value) => {
    if (!value)
        return "未指定";
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime()))
        return String(value);
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
// 🌟 新增：將時間戳記轉換為「發布了 X 分鐘/小時」的相對時間格式
const formatRelativeTime = (ts) => {
    if (!ts)
        return "剛剛發布";
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (mins < 1)
        return "剛剛發布";
    if (mins < 60)
        return ` ${mins} 分鐘前發布`;
    if (hours < 24)
        return ` ${hours} 小時前發布`;
    return ` ${days} 天前發布`;
};
const formatDateTimeLocalStr = (dtStr) => {
    if (!dtStr)
        return "未指定";
    const d = new Date(dtStr);
    if (isNaN(d.getTime()))
        return dtStr;
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const formatDateOnly = (value) => {
    if (!value)
        return "可討論";
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime()))
        return String(value);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
};
const formatSchedule = (v) => {
    if (v.isScheduleAnytime)
        return "我都可以 (隨時可約)";
    if (v.isScheduleCustom && v.customScheduleText)
        return v.customScheduleText;
    if (v.isScheduleExcept && v.scheduleSlots?.length > 0)
        return ("除了：" +
            v.scheduleSlots.map((s) => `${s.day} ${s.start}~${s.end}`).join("、") +
            "，其餘皆可");
    if (v.scheduleSlots?.length > 0)
        return v.scheduleSlots
            .map((s) => `${s.day} ${s.start}~${s.end}`)
            .join("、");
    return v.schedule || "未提供時段";
};
const getYouTubeThumbnail = (url) => {
    if (!url || typeof url !== "string")
        return null;
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return match && match[2].length === 11
        ? `https://img.youtube.com/vi/${match[2]}/maxresdefault.jpg`
        : null;
};
const autoFetchYouTubeInfo = async (url, setTitle, setCoverUrl, showToast) => {
    if (!url)
        return showToast("請先輸入 YouTube 連結");
    const ytMatch = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    if (ytMatch && ytMatch[2].length === 11) {
        setCoverUrl(`https://img.youtube.com/vi/${ytMatch[2]}/maxresdefault.jpg`);
        try {
            const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytMatch[2]}`);
            const data = await res.json();
            if (data.title)
                setTitle(data.title);
            showToast("✅ 已自動抓取標題與封面圖！");
        }
        catch (e) {
            showToast("✅ 已自動填入封面圖！(標題需手動輸入)");
        }
    }
    else {
        showToast("這似乎不是有效的 YouTube 連結");
    }
};
const parseSubscribers = (v) => {
    const parseStr = (str) => {
        if (!str)
            return 0;
        let s = String(str);
        // 關鍵修正：增加防呆，確保 replace 只作用於字串
        let num = parseFloat(s.replace(/[^0-9.]/g, ""));
        if (isNaN(num))
            return 0;
        if (s.toUpperCase().includes("K"))
            num *= 1000;
        if (s.toUpperCase().includes("M"))
            num *= 1000000;
        if (s.toUpperCase().includes("萬"))
            num *= 10000;
        return num;
    };
    return (parseStr(v.youtubeSubscribers || v.subscribers) +
        parseStr(v.twitchFollowers));
};
const formatSocialCount = (value) => {
    if (value === null || value === undefined || value === "")
        return "";
    const raw = String(value).trim();
    if (!raw)
        return "";
    if (/萬|K|M/i.test(raw))
        return raw;
    const num = Number(raw.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(num) || num <= 0)
        return raw;
    if (num >= 10000)
        return `${(num / 10000).toFixed(1).replace(".0", "")}萬`;
    if (num >= 1000)
        return `${(num / 1000).toFixed(1).replace(".0", "")}K`;
    return num.toLocaleString("zh-TW");
};
const normalizeProfileList = (value) => {
    if (!Array.isArray(value))
        return [];
    return value
        .map((item) => String(item || "").trim())
        .filter(Boolean);
};
const getSharedProfileItems = (a, b) => {
    const source = normalizeProfileList(a);
    const targetSet = new Set(normalizeProfileList(b));
    return Array.from(new Set(source.filter((item) => targetSet.has(item))));
};
const formatInterestPhrase = (interest) => {
    const text = String(interest || "").trim();
    if (!text)
        return "相似的內容";
    const gameLikeKeywords = [
        "APEX", "Apex", "apex", "瓦羅蘭", "VALORANT", "Valorant", "LOL", "英雄聯盟",
        "Minecraft", "麥塊", "FPS", "合作遊戲", "遊戲"
    ];
    if (gameLikeKeywords.some((keyword) => text.includes(keyword))) {
        return `打${text}`;
    }
    if (text.includes("歌") || text.includes("雜談") || text.includes("企劃")) {
        return `做${text}`;
    }
    return text;
};
const buildCompatibilityInsight = (me, target) => {
    if (!me)
        return "登入並完成名片後，AI 會依你的喜好自動判斷";
    const sharedCollabs = getSharedProfileItems(me.collabTypes, target.collabTypes);
    if (sharedCollabs.length > 0) {
        return `你們都喜歡${formatInterestPhrase(sharedCollabs[0])}`;
    }
    const sharedTags = getSharedProfileItems(me.tags, target.tags);
    if (sharedTags.length > 0) {
        return `你們都有「${sharedTags[0]}」相關標籤`;
    }
    const sharedLanguages = getSharedProfileItems(me.languages, target.languages);
    if (sharedLanguages.length > 0) {
        return `你們都能使用${sharedLanguages[0]}交流`;
    }
    const myScheduleDays = getSharedProfileItems(normalizeProfileList(me.scheduleSlots?.map?.((slot) => slot?.day)), normalizeProfileList(target.scheduleSlots?.map?.((slot) => slot?.day)));
    if (myScheduleDays.length > 0) {
        return `你們在${myScheduleDays[0]}都有機會約聯動`;
    }
    if (me.streamingStyle && target.streamingStyle && me.streamingStyle === target.streamingStyle) {
        return `你們的直播風格都偏向${me.streamingStyle}`;
    }
    if (me.personalityType && target.personalityType) {
        if (me.personalityType === target.personalityType) {
            return `你們個性設定接近，都是${me.personalityType}`;
        }
        return "你們個性互補，適合嘗試不同節奏的企劃";
    }
    const sharedColors = getSharedProfileItems(me.colorSchemes, target.colorSchemes);
    if (sharedColors.length > 0) {
        return `你們的代表色系都包含${sharedColors[0]}`;
    }
    return "你們的內容方向有合作潛力";
};
const calculateCompatibility = (me, target) => {
    // 如果未登入或沒有名片，給予 60~89% 的隨機分數吸引註冊
    if (!me)
        return Math.floor(Math.random() * 30) + 60;
    let score = 50; // 基礎分數 50%
    // 1. 聯動類型相同 (每個加 12 分)
    const sharedCollabs = getSharedProfileItems(me.collabTypes, target.collabTypes);
    score += sharedCollabs.length * 12;
    // 2. 內容標籤相同 (每個加 6 分)
    const sharedTags = getSharedProfileItems(me.tags, target.tags);
    score += sharedTags.length * 6;
    // 3. 語言相同，較容易約聯動
    const sharedLanguages = getSharedProfileItems(me.languages, target.languages);
    score += Math.min(10, sharedLanguages.length * 5);
    // 4. 個性互補或相同
    if (me.personalityType && target.personalityType) {
        if (me.personalityType !== target.personalityType)
            score += 8; // 互補加分較多
        else
            score += 4; // 相同也加分
    }
    // 5. 創作型態相同
    if (me.streamingStyle && me.streamingStyle === target.streamingStyle)
        score += 5;
    return Math.min(99, score); // 最高 99%，保留一點真實感
};
const isVisible = (v, currentUser) => {
    if (!v || !v.id)
        return false; // 確保 v 及其 id 存在
    if (currentUser && v.id === currentUser.uid)
        return true;
    if (String(v.id || "").startsWith("mock"))
        return true;
    if (!v.isVerified || v.isBlacklisted)
        return false;
    if (v.activityStatus === "sleep" || v.activityStatus === "graduated")
        return false;
    // 修正：處理 Firebase Timestamp 物件轉換為數字
    const getTime = (val) => {
        if (!val)
            return Date.now();
        if (typeof val === "number")
            return val;
        if (val.toMillis)
            return val.toMillis();
        return Date.now();
    };
    const lastActive = getTime(v.lastActiveAt || v.updatedAt || v.createdAt);
    if (Date.now() - lastActive > 30 * 24 * 60 * 60 * 1000)
        return false;
    return true;
};
const getActivityStatusMeta = (status) => {
    switch (status) {
        case "sleep":
            return { label: "暫時休息", emoji: "🌙", cls: "bg-[#94A3B8]/10 text-[#CBD5E1] border-[#94A3B8]/30" };
        case "graduated":
            return { label: "已畢業", emoji: "🕊️", cls: "bg-[#64748B]/10 text-[#94A3B8] border-[#64748B]/30" };
        case "creator":
            return { label: "我是繪師 / 建模師 / 剪輯師", emoji: "🎨", cls: "bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/30" };
        case "active":
        default:
            return { label: "開放聯動", emoji: "🟢", cls: "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30" };
    }
};
const getReviewStatusMeta = (v = {}) => {
    if (v.isBlacklisted)
        return { label: "暫停顯示", emoji: "⛔", cls: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30" };
    if (v.isVerified)
        return { label: "已認證", emoji: "✅", cls: "bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/30" };
    return { label: "待審核", emoji: "🟡", cls: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30" };
};
const StatusPill = ({ meta, className = "" }) => (React.createElement("span", { className: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${meta.cls} ${className}` },
    React.createElement("span", { "aria-hidden": "true" }, meta.emoji),
    meta.label));
const TagBadge = ({ text, onClick, selected }) => (React.createElement("span", { onClick: onClick, className: `px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors border ${selected ? "bg-[#8B5CF6] text-white border-[#8B5CF6]/60" : "bg-[#181B25] text-[#CBD5E1] border-[#2A2F3D] hover:bg-[#1D2130] hover:text-white"}` }, text));
const AnimatedCounter = ({ value, duration = 1500 }) => {
    const [displayValue, setDisplayValue] = useState(0);
    useEffect(() => {
        // 如果數值為 0 或無效，不執行動畫
        if (!value || isNaN(value)) {
            setDisplayValue(0);
            return;
        }
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp)
                startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            setDisplayValue(Math.floor(progress * value));
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        // 稍微延遲 100ms 啟動，確保組件已完全掛載，肉眼能捕捉到跳動
        const timer = setTimeout(() => {
            window.requestAnimationFrame(step);
        }, 100);
        return () => clearTimeout(timer);
    }, [value, duration]);
    return React.createElement("span", null, displayValue.toLocaleString());
};
const CollabCard = React.memo(({ c, isLive, isAdmin, user, onDeleteCollab, vtuber, onNavigateProfile, realVtubers, onShowParticipants, }) => {
    if (!c)
        return null;
    const displayImg = sanitizeUrl(c.coverUrl ||
        getYouTubeThumbnail(c.streamUrl) ||
        "https://duk.tw/bs1Moc.jpg");
    return (React.createElement("div", { className: `group h-full ${isLive ? "bg-[#2A1418]/40 border border-[#EF4444] shadow-sm transform scale-[1.02] z-10" : "bg-[#181B25]/60 border border-[#2A2F3D] hover:border-[#EF4444]/50 "} rounded-2xl overflow-hidden flex flex-col transition-all relative w-full` },
        isLive && (React.createElement("div", { className: "absolute top-0 left-0 w-full bg-[#EF4444] text-white text-center py-1.5 font-bold text-xs tracking-widest z-30" },
            React.createElement("i", { className: "fa-solid fa-satellite-dish mr-2" }),
            " \u6B63\u5728\u9032\u884C\u806F\u52D5\u4E2D")),
        onDeleteCollab && (isAdmin || (user && c.userId === user.uid)) && (React.createElement("button", { onClick: () => onDeleteCollab(c.id), className: `absolute ${isLive ? "top-10" : "top-4"} right-4 z-20 bg-black/60 backdrop-blur-md text-[#CBD5E1] hover:text-[#EF4444] hover:bg-black/80 p-2 rounded-lg transition-colors`, title: "\u522A\u9664\u6B64\u884C\u7A0B" },
            React.createElement("i", { className: "fa-solid fa-trash" }))),
        React.createElement("div", { className: `h-48 relative overflow-hidden flex-shrink-0 ${isLive ? "mt-8" : ""}` },
            React.createElement("img", { src: displayImg, className: "w-full h-full object-cover group-transition-transform duration-700", alt: "\u806F\u52D5\u5C01\u9762" }),
            React.createElement("div", { className: "vnexus-critical-gradient absolute inset-0 bg-gradient-to-t from-gray-950/70 to-transparent" }),
            React.createElement("div", { className: "absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-[#2A2F3D] text-white px-3 py-1.5 rounded-xl flex flex-col items-center shadow-sm transform -rotate-2" },
                React.createElement("span", { className: "text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider mb-0.5" }, c.date),
                React.createElement("span", { className: "text-sm text-[#EF4444] font-extrabold" }, c.time)),
            c.streamUrl && (React.createElement("div", { className: "absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none" },
                React.createElement("div", { className: `w-16 h-16 ${isLive ? "bg-[#EF4444]" : "bg-[#EF4444]/90"} text-white rounded-full flex items-center justify-center pl-1 shadow-sm backdrop-blur-sm` },
                    React.createElement("i", { className: "fa-solid fa-play text-2xl" }))))),
        React.createElement("div", { className: "p-6 flex-1 flex flex-col relative z-10 bg-[#0F111A]/80" },
            React.createElement("div", { className: "mb-2" },
                React.createElement("span", { className: "bg-[#8B5CF6]/20 text-[#C4B5FD] text-[10px] px-2 py-1 rounded-lg border border-white/10 font-bold" }, c.category || "遊戲")),
            React.createElement("h3", { className: `text-xl font-extrabold text-white mb-6 line-clamp-2 leading-tight transition-colors ${isLive ? "text-[#EF4444]" : "group-hover:text-[#EF4444]"}` }, c.title),
            Array.isArray(c.participants) && c.participants.length > 0 && (React.createElement("div", { className: "flex items-center gap-2 mb-4 cursor-pointer hover:bg-[#181B25]/50 p-1 -ml-1 rounded-lg transition-colors group/members", onClick: (e) => {
                    e.stopPropagation();
                    onShowParticipants(c);
                } },
                React.createElement("span", { className: "text-[10px] text-[#64748B] font-bold" }, "\u806F\u52D5\u6210\u54E1:"),
                React.createElement("div", { className: "flex -space-x-2" }, c.participants.map((pId) => {
                    const pVt = realVtubers.find((v) => v.id === pId);
                    return pVt ? (React.createElement("img", { key: pId, src: sanitizeUrl(pVt.avatar), className: "w-6 h-6 rounded-full border border-gray-900 object-cover" })) : null;
                })),
                React.createElement("span", { className: "text-[10px] text-[#A78BFA] opacity-0 group-hover/members:opacity-100 transition-opacity ml-1" }, "\u67E5\u770B\u540D\u55AE"))),
            React.createElement("div", { className: "mt-auto" },
                c.streamUrl ? (React.createElement("a", { href: sanitizeUrl(c.streamUrl), target: "_blank", rel: "noopener noreferrer", className: `w-full ${isLive ? "bg-[#EF4444] shadow-sm" : "bg-[#EF4444] hover:bg-[#EF4444] group-hover:shadow-sm"} text-white py-3.5 rounded-xl font-bold transition-all flex justify-center items-center gap-2` },
                    React.createElement("i", { className: "fa-solid fa-play-circle text-lg" }),
                    " \u524D\u5F80\u5F85\u6A5F\u5BA4 / \u89C0\u770B\u76F4\u64AD")) : (React.createElement("div", { className: "w-full bg-[#181B25] text-[#64748B] py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 border border-[#2A2F3D]" },
                    React.createElement("i", { className: "fa-solid fa-clock" }),
                    " \u76F4\u64AD\u9023\u7D50\u5C1A\u672A\u63D0\u4F9B")),
                vtuber && vtuber.id !== "admin" && onNavigateProfile && (React.createElement("div", { onClick: (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onNavigateProfile(vtuber);
                    }, className: "mt-4 pt-4 border-t border-[#2A2F3D]/50 flex items-center justify-between cursor-pointer group/author hover:bg-[#181B25]/80 p-2 -mx-2 rounded-xl transition-colors" },
                    React.createElement("div", { className: "flex items-center gap-3" },
                        React.createElement("img", { src: sanitizeUrl(vtuber.avatar), className: "w-8 h-8 rounded-full border border-[#2A2F3D] object-cover" }),
                        React.createElement("div", { className: "text-left" },
                            React.createElement("p", { className: "text-[10px] text-[#94A3B8] mb-0.5" }, "\u767C\u8D77\u4EBA"),
                            React.createElement("p", { className: "text-sm font-bold text-white group-hover/author:text-[#A78BFA] transition-colors truncate max-w-[150px]" }, vtuber.name))),
                    React.createElement("button", { className: "text-xs bg-[#1D2130] text-[#CBD5E1] px-3 py-1.5 rounded-lg group-hover/author:bg-[#8B5CF6] group-hover/author:text-white transition-colors font-bold" },
                        React.createElement("i", { className: "fa-solid fa-id-card mr-1.5" }),
                        "\u67E5\u770B\u540D\u7247")))))));
}, (prevProps, nextProps) => {
    // 🌟 優化：自訂比對邏輯，避免 realVtubers 陣列改變導致無意義的重繪
    return (prevProps.c.id === nextProps.c.id &&
        prevProps.isLive === nextProps.isLive &&
        // 參與人數有變動時才重繪 (例如有人加入聯動)
        prevProps.c.participants?.length === nextProps.c.participants?.length &&
        // 登入的使用者改變時才重繪 (影響刪除按鈕的顯示)
        prevProps.user?.uid === nextProps.user?.uid &&
        prevProps.isAdmin === nextProps.isAdmin &&
        // 發起人資料改變時才重繪
        prevProps.vtuber?.id === nextProps.vtuber?.id);
});
const VTuberCard = React.memo(({ v, onSelect, onDislike }) => {
    const { user, realVtubers, onlineUsers } = useContext(AppContext);
    const myProfile = user ? realVtubers.find((item) => item.id === user.uid) : null;
    const compatibilityScore = user && v.id !== user.uid ? calculateCompatibility(myProfile, v) : null;
    const compatibilityReason = user && v.id !== user.uid ? buildCompatibilityInsight(myProfile, v) : "";
    const isLiveMsg = v.statusMessage && v.statusMessage.includes('🔴');
    const expireLimit = isLiveMsg ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const isStatusValid = v.statusMessage &&
        v.statusMessageUpdatedAt &&
        Date.now() - v.statusMessageUpdatedAt < expireLimit;
    const isLive = isStatusValid && isLiveMsg;
    const isOnline = onlineUsers?.has(v.id);
    const profileTags = Array.from(new Set([
        ...(Array.isArray(v.collabTypes) ? v.collabTypes : []),
        ...(Array.isArray(v.tags) ? v.tags : []),
    ].filter(Boolean))).slice(0, 3);
    const statusMeta = (() => {
        if (isLive) {
            return {
                label: '直播中',
                cls: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30',
                dot: 'bg-[#EF4444]',
            };
        }
        if (!v.isVerified) {
            return {
                label: '待審核',
                cls: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30',
                dot: 'bg-[#F59E0B]',
            };
        }
        if (v.activityStatus === 'sleep') {
            return {
                label: '暫時休息',
                cls: 'bg-[#94A3B8]/10 text-[#CBD5E1] border-[#94A3B8]/30',
                dot: 'bg-[#94A3B8]',
            };
        }
        if (v.activityStatus === 'graduated') {
            return {
                label: '已畢業',
                cls: 'bg-[#64748B]/10 text-[#94A3B8] border-[#64748B]/30',
                dot: 'bg-[#64748B]',
            };
        }
        if (v.activityStatus === 'creator') {
            return {
                label: '繪師 / 建模師 / 剪輯師',
                cls: 'bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/30',
                dot: 'bg-[#38BDF8]',
            };
        }
        if (isOnline) {
            return {
                label: '開放聯動',
                cls: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30',
                dot: 'bg-[#22C55E]',
            };
        }
        return {
            label: '開放聯動',
            cls: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/25',
            dot: 'bg-[#22C55E]',
        };
    })();
    const isStoryStatus = Boolean(isStatusValid && !isLive && v.statusMessage);
    const introText = (isStoryStatus && v.statusMessage) ||
        v.description ||
        '這位創作者還沒有填寫自我介紹。';
    const platformLabel = v.mainPlatform || (v.twitchUrl ? 'Twitch' : 'YouTube');
    return (React.createElement("article", { onClick: onSelect, className: "vnexus-vtuber-card group h-full bg-[#181B25] hover:bg-[#1D2130] border border-[#2A2F3D] hover:border-[#8B5CF6]/40 rounded-2xl overflow-hidden cursor-pointer transition-colors flex flex-col" },
        React.createElement("div", { className: "vnexus-vtuber-card-banner h-20 relative overflow-hidden bg-[#11131C] border-b border-[#2A2F3D]" },
            React.createElement(LazyImage, { src: sanitizeUrl(v.banner), containerCls: "absolute inset-0 w-full h-full", imgCls: "opacity-45 group-hover:opacity-55 transition-opacity", alt: `${v.name || 'VTuber'} 橫幅` }),
            React.createElement("div", { className: "absolute inset-0 bg-[#0F111A]/35" })),
        React.createElement("div", { className: "vnexus-vtuber-card-body p-4 flex-1 flex flex-col" },
            React.createElement("div", { className: "flex items-start gap-3 -mt-10 mb-3 relative z-10" },
                React.createElement(LazyImage, { src: sanitizeUrl(v.avatar), containerCls: "w-16 h-16 rounded-2xl border border-[#2A2F3D] bg-[#11131C] flex-shrink-0", imgCls: "rounded-2xl", alt: `${v.name || 'VTuber'} 頭像` }),
                React.createElement("div", { className: "min-w-0 flex-1 pt-8" },
                    React.createElement("div", { className: "flex items-center gap-1.5 min-w-0" },
                        React.createElement("h3", { className: "font-bold text-[#F8FAFC] truncate leading-tight" }, v.name || '未命名創作者'),
                        v.isVerified && (React.createElement("i", { className: "fa-solid fa-circle-check text-[#38BDF8] text-xs flex-shrink-0", title: "\u5DF2\u8A8D\u8B49" }))),
                    React.createElement("p", { className: "text-xs text-[#94A3B8] truncate mt-0.5" },
                        v.agency || '個人勢',
                        " \u00B7 ",
                        platformLabel))),
            React.createElement("div", { className: "flex items-center justify-between gap-3 mb-3" },
                React.createElement("span", { className: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${statusMeta.cls}` },
                    React.createElement("span", { className: `w-1.5 h-1.5 rounded-full ${statusMeta.dot}` }),
                    statusMeta.label),
                v.zodiacSign && (React.createElement("span", { className: "text-xs text-[#94A3B8] flex-shrink-0" }, v.zodiacSign))),
            isStoryStatus ? (React.createElement("div", { className: "mb-4 min-h-[2.5rem]" },
                React.createElement("div", { className: "inline-flex items-center gap-1.5 text-[11px] font-bold text-[#F59E0B] mb-1" },
                    React.createElement("i", { className: "fa-solid fa-stopwatch" }),
                    "\u9650\u6642\u52D5\u614B"),
                React.createElement("p", { className: "text-sm text-[#F59E0B] leading-relaxed line-clamp-2" }, introText))) : (React.createElement("p", { className: "text-sm text-[#CBD5E1] leading-relaxed line-clamp-2 min-h-[2.5rem] mb-4" }, introText)),
            React.createElement("div", { className: "flex flex-wrap gap-2 mb-4 min-h-[1.75rem]" }, profileTags.length > 0 ? (profileTags.map((tag) => (React.createElement("span", { key: tag, className: "px-2.5 py-1 rounded-full bg-[#11131C] border border-[#2A2F3D] text-[#94A3B8] text-xs" }, tag)))) : (React.createElement("span", { className: "px-2.5 py-1 rounded-full bg-[#11131C] border border-[#2A2F3D] text-[#64748B] text-xs" }, "\u5C1A\u672A\u8A2D\u5B9A\u6A19\u7C64"))),
            Array.isArray(v.creatorRoles) && v.creatorRoles.length > 0 && (React.createElement("div", { className: "flex flex-wrap gap-1.5 mb-4 -mt-1" }, v.creatorRoles.slice(0, 2).map((role) => (React.createElement("span", { key: role, className: "px-2 py-0.5 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/25 text-[#7DD3FC] text-[11px] font-bold" },
                "\u4E5F\u63A5",
                role === "繪師" ? "繪圖" : role === "剪輯師" ? "剪輯" : "建模"))))),
            React.createElement("div", { className: "mt-auto pt-3 border-t border-[#2A2F3D] space-y-2" },
                React.createElement("div", { className: "flex items-center gap-2 text-xs text-[#94A3B8] min-w-0" },
                    React.createElement("i", { className: "fa-solid fa-clock text-[#8B5CF6] w-4 text-center flex-shrink-0" }),
                    React.createElement("span", { className: "truncate" }, formatSchedule(v))),
                React.createElement("div", { className: "flex items-center gap-2 text-xs text-[#94A3B8] min-w-0" },
                    React.createElement("i", { className: `fa-brands fa-${platformLabel === 'Twitch' ? 'twitch' : 'youtube'} ${platformLabel === 'Twitch' ? 'text-[#8B5CF6]' : 'text-[#EF4444]'} w-4 text-center flex-shrink-0` }),
                    React.createElement("span", { className: "truncate" },
                        "\u4E3B\u8981\u5E73\u53F0\uFF1A",
                        platformLabel)),
                compatibilityScore !== null && (React.createElement("div", { className: "pt-2" },
                    React.createElement("div", { className: "flex items-center justify-between gap-2 text-xs mb-1.5 min-w-0" },
                        React.createElement("span", { className: "font-extrabold text-[#F472B6] flex items-center gap-1.5 flex-shrink-0" },
                            React.createElement("i", { className: "fa-solid fa-heart" }),
                            " ",
                            compatibilityScore,
                            "%"),
                        compatibilityReason && (React.createElement("span", { className: "ml-auto max-w-[70%] text-right text-[11px] text-[#FBCFE8] bg-[#F472B6]/10 border border-[#F472B6]/20 rounded-full px-2.5 py-1 truncate min-w-0" }, compatibilityReason))),
                    React.createElement("div", { className: "h-2 rounded-full bg-[#0F111A] border border-[#2A2F3D] overflow-hidden", "aria-label": `契合度 ${compatibilityScore}%` },
                        React.createElement("div", { className: "h-full rounded-full bg-gradient-to-r from-[#F472B6] to-[#EC4899]", style: { width: `${Math.max(8, Math.min(100, compatibilityScore))}%` } }))))))));
}, (prevProps, nextProps) => {
    return (prevProps.v.updatedAt === nextProps.v.updatedAt &&
        prevProps.v.likes === nextProps.v.likes &&
        prevProps.v.dislikes === nextProps.v.dislikes &&
        prevProps.v.statusMessage === nextProps.v.statusMessage &&
        prevProps.v.statusMessageUpdatedAt === nextProps.v.statusMessageUpdatedAt &&
        prevProps.v.activityStatus === nextProps.v.activityStatus);
});
const BulletinSkeleton = () => (React.createElement("div", { className: "bg-[#181B25]/40 border border-[#2A2F3D] rounded-2xl overflow-hidden flex flex-col shadow-sm" },
    React.createElement("div", { className: "w-full h-48 sm:h-56 bg-[#1D2130]/30" }),
    React.createElement("div", { className: "bg-[#0F111A]/60 p-5 border-b border-[#2A2F3D]/50 flex items-start gap-4" },
        React.createElement("div", { className: "w-14 h-14 rounded-full bg-[#1D2130]/50 flex-shrink-0" }),
        React.createElement("div", { className: "flex-1 space-y-3 py-2" },
            React.createElement("div", { className: "h-4 bg-[#1D2130]/50 rounded-md w-1/3" }),
            React.createElement("div", { className: "h-3 bg-[#1D2130]/50 rounded-md w-1/4" }))),
    React.createElement("div", { className: "p-6 flex-1 flex flex-col" },
        React.createElement("div", { className: "space-y-3 mb-6" },
            React.createElement("div", { className: "h-3 bg-[#1D2130]/50 rounded-md w-full" }),
            React.createElement("div", { className: "h-3 bg-[#1D2130]/50 rounded-md w-5/6" }),
            React.createElement("div", { className: "h-3 bg-[#1D2130]/50 rounded-md w-4/6" })),
        React.createElement("div", { className: "grid grid-cols-2 gap-3 mt-auto mb-4" },
            React.createElement("div", { className: "bg-[#0F111A]/50 h-14 rounded-xl" }),
            React.createElement("div", { className: "bg-[#0F111A]/50 h-14 rounded-xl" }),
            React.createElement("div", { className: "bg-[#0F111A]/50 h-14 rounded-xl col-span-2" })),
        React.createElement("div", { className: "mt-4 pt-4 border-t border-[#2A2F3D]/50 flex justify-between items-center" },
            React.createElement("div", { className: "flex gap-2" },
                React.createElement("div", { className: "w-6 h-6 rounded-full bg-[#1D2130]/50" }),
                React.createElement("div", { className: "w-6 h-6 rounded-full bg-[#1D2130]/50 -ml-2" })),
            React.createElement("div", { className: "h-9 bg-[#8B5CF6]/20 rounded-xl w-24" })))));
const BulletinCard = React.memo(({ b, user, isVerifiedUser, onNavigateProfile, onApply, onInvite, onDeleteBulletin, onEditBulletin, openModalId, onClearOpenModalId, currentView, }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showApplicants, setShowApplicants] = useState(false);
    const isAuthor = user?.uid === b.userId;
    const hasApplied = Array.isArray(b.applicants) ? b.applicants.includes(user?.uid) : false;
    const targetSize = parseInt(String(b.collabSize || "0").replace(/[^0-9]/g, ""), 10) || 0;
    const currentApplicants = b.applicantsData?.length || 0;
    const isReached = targetSize > 0 && currentApplicants >= targetSize;
    const vtuber = b.vtuber || {};
    useEffect(() => {
        if (openModalId === b.id) {
            setShowApplicants(true);
            if (onClearOpenModalId)
                onClearOpenModalId();
        }
    }, [openModalId, b.id]);
    const statusText = isReached ? "已有足夠意願，可等待發起人挑選" : "正在找一起聯動的人";
    return (React.createElement("div", { className: "h-full bg-[#181B25] border border-[#2A2F3D] rounded-2xl overflow-hidden flex flex-col hover:bg-[#1D2130] hover:border-white/10 transition-colors shadow-sm" },
        b.image ? (React.createElement("div", { className: "w-full h-40 sm:h-44 relative overflow-hidden flex-shrink-0 border-b border-[#2A2F3D] bg-[#0F111A]" },
            React.createElement(LazyImage, { src: sanitizeUrl(b.image), containerCls: "absolute inset-0 w-full h-full", imgCls: "", alt: "\u63EA\u5718\u9644\u5716" }))) : (React.createElement("div", { className: "h-16 bg-[#11131C] border-b border-[#2A2F3D] flex items-center px-5 text-[#94A3B8] text-xs" }, "\u6C92\u6709\u9644\u5716\uFF0C\u5148\u770B\u770B\u63EA\u5718\u5167\u5BB9")),
        React.createElement("div", { className: "p-5 flex-1 flex flex-col gap-4" },
            React.createElement("div", { className: "flex items-start gap-3" },
                React.createElement(LazyImage, { src: sanitizeUrl(vtuber.avatar), onClick: (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (vtuber.id)
                            onNavigateProfile(vtuber, false);
                    }, containerCls: "w-12 h-12 rounded-full border border-white/10 flex-shrink-0 cursor-pointer bg-[#1D2130]", imgCls: "rounded-full" }),
                React.createElement("div", { className: "min-w-0 flex-1" },
                    React.createElement("div", { className: "flex items-center gap-2 min-w-0" },
                        React.createElement("button", { onClick: (event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (vtuber.id)
                                    onNavigateProfile(vtuber, false);
                            }, className: "font-bold text-[#F8FAFC] text-sm truncate hover:text-[#A78BFA] transition-colors text-left" }, vtuber.name || "匿名創作者"),
                        vtuber.isVerified && React.createElement("span", { className: "text-[#38BDF8] text-xs", title: "\u5DF2\u8A8D\u8B49" }, "\u2705")),
                    React.createElement("p", { className: "text-[11px] text-[#94A3B8] mt-0.5 truncate" },
                        vtuber.agency || "個人勢",
                        " \u00B7 ",
                        b.postedAt,
                        " \u767C\u5E03")),
                React.createElement("span", { className: "flex-shrink-0 bg-[#8B5CF6]/12 text-[#C4B5FD] border border-[#8B5CF6]/25 px-2.5 py-1 rounded-full text-[11px] font-bold" }, b.collabType || "未指定")),
            React.createElement("div", { className: "bg-[#0F111A]/60 border border-[#2A2F3D] rounded-2xl p-4" },
                React.createElement("div", { className: "flex items-center justify-between gap-3 mb-2" },
                    React.createElement("p", { className: "text-[#F8FAFC] font-bold text-base" }, "\u9019\u5718\u5728\u627E\u4EC0\u9EBC\uFF1F"),
                    React.createElement("span", { className: `text-[11px] font-bold px-2 py-1 rounded-full border ${isReached ? 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/25' : 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25'}` }, isReached ? '挑選中' : '開放報名')),
                React.createElement("div", { className: `text-[#CBD5E1] whitespace-pre-wrap text-sm leading-relaxed ${isExpanded ? "" : "line-clamp-4"}` }, b.content || "發起人還沒有補充詳細內容。"),
                (b.content || "").length > 90 && (React.createElement("button", { onClick: (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }, className: "text-[#A78BFA] hover:text-[#C4B5FD] text-xs font-bold mt-3" }, isExpanded ? "收起內容" : "看完整揪團內容"))),
            React.createElement("div", { className: "grid grid-cols-3 gap-1.5 sm:gap-2 text-[11px] sm:text-sm" },
                React.createElement("div", { className: "bg-[#11131C] border border-[#2A2F3D] rounded-xl p-2 sm:p-3" },
                    React.createElement("p", { className: "text-[9px] sm:text-[10px] text-[#94A3B8] mb-1" }, "\u60F3\u627E\u4EBA\u6578"),
                    React.createElement("p", { className: "text-[#F8FAFC] font-bold truncate text-[12px] sm:text-sm" }, b.collabSize || "未指定")),
                React.createElement("div", { className: "bg-[#11131C] border border-[#2A2F3D] rounded-xl p-2 sm:p-3" },
                    React.createElement("p", { className: "text-[9px] sm:text-[10px] text-[#94A3B8] mb-1" }, "\u9810\u8A08\u6642\u9593"),
                    React.createElement("p", { className: "text-[#F8FAFC] font-bold truncate text-[12px] sm:text-sm" }, formatDateTimeLocalStr(b.collabTime))),
                React.createElement("div", { className: "bg-[#11131C] border border-[#EF4444]/25 rounded-xl p-2 sm:p-3" },
                    React.createElement("p", { className: "text-[10px] sm:text-[10px] text-[#EF4444]/80 mb-1" }, "\u5831\u540D\u622A\u6B62"),
                    React.createElement("p", { className: "text-red-200 font-bold truncate text-[12px] sm:text-sm" }, b.recruitEndTime ? formatMonthDayTime(b.recruitEndTime) : "未指定"))),
            React.createElement("div", { className: "mt-auto pt-4 border-t border-[#2A2F3D] space-y-3" },
                React.createElement("div", { className: "flex items-center justify-between gap-3" },
                    React.createElement("button", { onClick: (event) => { event.preventDefault(); event.stopPropagation(); setShowApplicants(true); }, className: "min-w-0 flex items-center gap-2 text-left rounded-xl hover:bg-[#11131C] transition-colors p-2 -m-2" },
                        React.createElement("div", { className: "flex -space-x-2 flex-shrink-0" },
                            b.applicantsData?.slice(0, 3).map((a) => (React.createElement("img", { key: a.id, src: sanitizeUrl(a.avatar), className: "w-7 h-7 rounded-full ring-2 ring-[#181B25] object-cover bg-[#1D2130]", onError: (event) => setImageToGrayPlaceholder(event.currentTarget) }))),
                            (!b.applicantsData || b.applicantsData.length === 0) && React.createElement("div", { className: "w-7 h-7 rounded-full bg-[#1D2130] ring-2 ring-[#181B25]" })),
                        React.createElement("div", { className: "min-w-0" },
                            React.createElement("p", { className: "text-xs text-[#F8FAFC] font-bold truncate" },
                                currentApplicants,
                                " \u4EBA\u6709\u610F\u9858"),
                            React.createElement("p", { className: "text-[10px] text-[#94A3B8] truncate" }, statusText))),
                    isAuthor ? (React.createElement("div", { className: "flex gap-2 flex-shrink-0" },
                        React.createElement("button", { onClick: () => onEditBulletin && onEditBulletin(b), className: "bg-[#38BDF8]/15 hover:bg-[#38BDF8]/25 text-[#38BDF8] border border-[#38BDF8]/25 px-3 py-2 rounded-xl text-xs font-bold transition-colors" }, "\u7DE8\u8F2F"),
                        React.createElement("button", { onClick: () => onDeleteBulletin && onDeleteBulletin(b.id), className: "bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#FCA5A5] border border-[#EF4444]/25 px-3 py-2 rounded-xl text-xs font-bold transition-colors" }, "\u522A\u9664"))) : (React.createElement("button", { onClick: (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onApply(b.id, !hasApplied, b.userId);
                        }, className: `flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${hasApplied ? "bg-[#1D2130] text-[#CBD5E1] hover:bg-[#2A2F3D]" : "bg-[#8B5CF6] text-white hover:bg-[#7C3AED]"}` }, hasApplied ? "收回意願" : "我想參加"))))),
        showApplicants && currentView !== "profile" && ReactDOM.createPortal(React.createElement("div", { className: "fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75", onClick: (event) => { event.stopPropagation(); setShowApplicants(false); } },
            React.createElement("div", { className: "bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-md flex flex-col max-h-[80vh] shadow-sm cursor-default", onClick: (event) => event.stopPropagation() },
                React.createElement("div", { className: "sticky top-0 bg-[#0F111A] px-6 py-4 border-b border-[#2A2F3D] flex justify-between items-center z-10" },
                    React.createElement("h3", { className: "font-bold text-white" },
                        "\u6709\u610F\u9858\u7684 Vtuber (",
                        b.applicantsData?.length || 0,
                        ")"),
                    React.createElement("button", { onClick: () => setShowApplicants(false), className: "text-[#94A3B8] hover:text-white" },
                        React.createElement("i", { className: "fa-solid fa-xmark text-xl" }))),
                React.createElement("div", { className: "p-4 overflow-y-auto space-y-3" }, b.applicantsData?.length > 0 ? b.applicantsData.map((a) => (React.createElement("div", { key: a.id, className: "flex items-center justify-between bg-[#181B25]/50 p-3 rounded-xl border border-[#2A2F3D] hover:border-white/10 transition-colors cursor-pointer group", onClick: (event) => { event.stopPropagation(); setShowApplicants(false); onNavigateProfile(a, true); } },
                    React.createElement("div", { className: "flex items-center gap-4 min-w-0" },
                        React.createElement("img", { src: sanitizeUrl(a.avatar), className: "w-12 h-12 rounded-full object-cover border border-[#2A2F3D] bg-[#1D2130]", onError: (event) => setImageToGrayPlaceholder(event.currentTarget) }),
                        React.createElement("div", { className: "min-w-0" },
                            React.createElement("p", { className: "font-bold text-white text-sm truncate group-hover:text-[#C4B5FD] transition-colors" }, a.name),
                            React.createElement("p", { className: "text-[10px] text-[#94A3B8] mt-1" }, "\u9EDE\u64CA\u67E5\u770B\u540D\u7247"))),
                    isAuthor && React.createElement("button", { onClick: (event) => { event.stopPropagation(); setShowApplicants(false); onInvite(a); }, className: "bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs text-white px-4 py-2 rounded-lg shadow-sm transition-colors font-bold flex-shrink-0" }, "\u767C\u9001\u9080\u7D04")))) : (React.createElement("div", { className: "text-center py-8" },
                    React.createElement("p", { className: "text-[#F8FAFC] font-bold" }, "\u9084\u6C92\u6709\u4EBA\u8868\u9054\u610F\u9858"),
                    React.createElement("p", { className: "text-sm text-[#94A3B8] mt-1" }, "\u518D\u7B49\u7B49\uFF0C\u6216\u628A\u63EA\u5718\u5167\u5BB9\u5BEB\u5F97\u66F4\u5177\u9AD4\u4E00\u9EDE\u3002")))))), document.body)));
}, (prevProps, nextProps) => {
    return (prevProps.b.id === nextProps.b.id &&
        prevProps.b.applicants?.length === nextProps.b.applicants?.length &&
        prevProps.b.applicantsData?.length === nextProps.b.applicantsData?.length &&
        prevProps.user?.uid === nextProps.user?.uid &&
        prevProps.isVerifiedUser === nextProps.isVerifiedUser &&
        prevProps.openModalId === nextProps.openModalId &&
        prevProps.currentView === nextProps.currentView);
});
const MatchPage = ({ vtubers, navigate, showToast, currentUser, setSelectedVTuber, onBraveInvite, isVerifiedUser, }) => {
    const [desiredType, setDesiredType] = useState("");
    const [matchedVtuber, setMatchedVtuber] = useState(null);
    const [isMatching, setIsMatching] = useState(false);
    const [zodiacScore, setZodiacScore] = useState(null); // 🌟 新增：儲存星座分數
    const handleMatch = (type = "random") => {
        setIsMatching(true);
        setMatchedVtuber(null);
        setZodiacScore(null);
        setTimeout(() => {
            const candidates = (vtubers || []).filter((v) => isVisible(v, currentUser) && v.id !== currentUser?.uid);
            if (candidates.length === 0) {
                setIsMatching(false);
                return showToast("目前資料庫尚無可配對的已認證創作者！");
            }
            let finalMatch = null;
            let score = null;
            // 🌟 處理星座配對邏輯
            if (type === "zodiac" && currentUser) {
                const myProfile = vtubers.find(v => v.id === currentUser.uid);
                if (!myProfile || !myProfile.zodiacSign) {
                    showToast("⚠️ 您尚未在名片填寫星座，將為您隨機配對！");
                    finalMatch = candidates[Math.floor(Math.random() * candidates.length)];
                }
                else {
                    const zodiacCandidates = candidates.filter(v => v.zodiacSign);
                    if (zodiacCandidates.length === 0) {
                        showToast("找不到有填寫星座的對象，為您隨機推薦！");
                        finalMatch = candidates[Math.floor(Math.random() * candidates.length)];
                    }
                    else {
                        // 隨機挑選一個有星座的對象，並計算分數
                        finalMatch = zodiacCandidates[Math.floor(Math.random() * zodiacCandidates.length)];
                        score = ZODIAC_COMPATIBILITY[myProfile.zodiacSign][finalMatch.zodiacSign] || 50;
                        showToast("✨ 星座配對成功！");
                    }
                }
            }
            else {
                // 原本的隨機配對邏輯
                let filtered = desiredType
                    ? candidates.filter((v) => Array.isArray(v.collabTypes) &&
                        v.collabTypes.includes(desiredType))
                    : candidates;
                if (filtered.length === 0) {
                    showToast("找不到完全符合類型的對象，為您隨機推薦一位命定夥伴！");
                    filtered = candidates;
                }
                else {
                    showToast("🎉 配對成功！");
                }
                finalMatch = filtered[Math.floor(Math.random() * filtered.length)];
            }
            setMatchedVtuber(finalMatch);
            setZodiacScore(score);
            setIsMatching(false);
        }, 1500);
    };
    return (React.createElement("div", { className: "max-w-4xl mx-auto px-4 py-12 text-center animate-fade-in-up" },
        React.createElement("h2", { className: "text-3xl font-extrabold text-[#A78BFA] mb-4 flex justify-center items-center gap-3" },
            React.createElement("i", { className: "fa-solid fa-dice" }),
            " \u806F\u52D5\u96A8\u6A5F\u914D\u5C0D"),
        React.createElement("p", { className: "text-[#94A3B8] mb-10" }, "\u4E0D\u77E5\u9053\u8A72\u627E\u8AB0\u73A9\u55CE\uFF1F\u8B93 V-Nexus \u5E6B\u60A8\u96A8\u6A5F\u62BD\u7C64\u914D\u5C0D\uFF0C\u6216\u8A31\u6703\u9047\u5230\u610F\u60F3\u4E0D\u5230\u7684\u597D\u5925\u4F34\u5594\uFF01"),
        React.createElement("div", { className: "bg-[#181B25]/40 border border-[#2A2F3D] rounded-2xl p-8 shadow-sm max-w-2xl mx-auto relative overflow-hidden" },
            React.createElement("div", { className: "absolute -top-16 -left-16 w-32 h-32 bg-[#8B5CF6]/10 rounded-full blur-3xl" }),
            !isMatching && !matchedVtuber && (React.createElement("div", { className: "space-y-6 relative z-10 animate-fade-in-up" },
                React.createElement("div", { className: "text-left" },
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u60F3\u8981\u806F\u52D5\u7684\u985E\u578B (\u9078\u586B)"),
                    React.createElement("select", { value: desiredType, onChange: (e) => setDesiredType(e.target.value), className: inputCls },
                        React.createElement("option", { value: "" }, "\u4E0D\u9650\u985E\u578B (\u5B8C\u5168\u96A8\u6A5F)"),
                        PREDEFINED_COLLABS.map((t) => (React.createElement("option", { key: t, value: t }, t))))),
                React.createElement("button", { onClick: () => handleMatch("random"), className: "w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-4 rounded-xl font-bold text-lg shadow-sm transition-transform flex justify-center items-center gap-2" },
                    React.createElement("i", { className: "fa-solid fa-wand-magic-sparkles" }),
                    " ",
                    "\u958B\u59CB\u5C0B\u627E\u547D\u5B9A\u5925\u4F34"),
                React.createElement("button", { onClick: () => handleMatch("zodiac"), className: "w-full mt-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white py-4 rounded-xl font-bold text-lg shadow-sm transition-transform flex justify-center items-center gap-2" },
                    React.createElement("i", { className: "fa-solid fa-star" }),
                    " \u661F\u5EA7\u547D\u5B9A\u914D\u5C0D"))),
            isMatching && (React.createElement("div", { className: "py-12 flex flex-col items-center justify-center animate-fade-in-up" },
                React.createElement("div", { className: "relative w-32 h-32 mb-6" },
                    React.createElement("div", { className: "absolute inset-0 border-4 border-[#2A2F3D] rounded-full" }),
                    React.createElement("div", { className: "absolute inset-0 border-4 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-radar" }),
                    React.createElement("i", { className: "fa-solid fa-satellite-dish text-4xl text-[#A78BFA] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" })),
                React.createElement("h3", { className: "text-xl font-bold text-white mb-2" }, "\u96F7\u9054\u6383\u63CF\u4E2D..."))),
            matchedVtuber && !isMatching && (React.createElement("div", { className: "animate-fade-in-up relative z-10" },
                React.createElement("h3", { className: "text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-6" }, "\u5C31\u662F\u6C7A\u5B9A\u662F\u4F60\u4E86\uFF01"),
                zodiacScore !== null && (React.createElement("div", { className: "mb-6 bg-indigo-900/40 border border-indigo-500/50 rounded-xl p-4 animate-bounce shadow-sm" },
                    React.createElement("p", { className: "text-indigo-200 font-bold text-lg flex items-center justify-center gap-2" },
                        React.createElement("i", { className: "fa-solid fa-sparkles text-[#F59E0B]" }),
                        "\u661F\u5EA7\u914D\u5C0D\u6307\u6578\uFF1A",
                        React.createElement("span", { className: "text-3xl text-[#F59E0B] font-black" },
                            zodiacScore,
                            "%")),
                    React.createElement("p", { className: "text-sm text-indigo-300 mt-1" },
                        "\u4F60\u5011\u662F ",
                        matchedVtuber.zodiacSign,
                        " \u8207\u4F60\u7684\u5B8C\u7F8E\u9082\u9005\uFF01"))),
                React.createElement("div", { className: "w-full bg-[#0F111A]/90 border border-white/10 rounded-2xl overflow-hidden shadow-sm flex flex-col text-left mb-8" },
                    React.createElement("div", { className: "h-32 relative overflow-hidden" },
                        React.createElement("img", { src: sanitizeUrl(matchedVtuber.banner), className: "w-full h-full object-cover opacity-50" }),
                        React.createElement("div", { className: "absolute top-2 right-2 flex gap-2" },
                            React.createElement("span", { className: "px-2 py-1 bg-black/60 rounded text-[10px] text-white font-bold" }, matchedVtuber.agency),
                            React.createElement("span", { className: `px-2 py-1 rounded text-[10px] text-white font-bold ${matchedVtuber.mainPlatform === "Twitch" ? "bg-[#8B5CF6]" : "bg-[#EF4444]"}` },
                                React.createElement("i", { className: `fa-brands fa-${matchedVtuber.mainPlatform === "Twitch" ? "twitch" : "youtube"} mr-1` }),
                                matchedVtuber.mainPlatform))),
                    React.createElement("div", { className: "p-6 relative" },
                        React.createElement("img", { src: sanitizeUrl(matchedVtuber.avatar), className: "absolute -top-12 left-6 w-24 h-24 rounded-2xl border-4 border-gray-900 bg-[#181B25] object-cover shadow-md" }),
                        React.createElement("div", { className: "ml-28 min-h-[80px]" },
                            React.createElement("h4", { className: "text-2xl font-bold text-white flex items-center gap-2" },
                                matchedVtuber.name,
                                " ",
                                matchedVtuber.isVerified && (React.createElement("i", { className: "fa-solid fa-circle-check text-[#38BDF8] text-sm" }))),
                            React.createElement("div", { className: "flex flex-wrap gap-2 mt-2" },
                                React.createElement("span", { className: "text-xs text-[#22C55E] font-bold bg-[#22C55E]/10 px-2 py-1 rounded" },
                                    React.createElement("i", { className: "fa-solid fa-thumbs-up mr-1" }),
                                    matchedVtuber.likes || 0,
                                    " \u63A8\u85A6"),
                                React.createElement("span", { className: "text-xs text-[#EF4444] font-bold bg-[#EF4444]/10 px-2 py-1 rounded" },
                                    React.createElement("i", { className: "fa-brands fa-youtube mr-1" }),
                                    matchedVtuber.youtubeSubscribers || "0"))),
                        React.createElement("p", { className: "text-[#94A3B8] text-sm mt-4 line-clamp-3 leading-relaxed" }, matchedVtuber.description),
                        React.createElement("div", { className: "mt-4 pt-4 border-t border-[#2A2F3D] flex flex-wrap gap-2" }, (matchedVtuber.collabTypes || []).slice(0, 3).map((t) => (React.createElement("span", { key: t, className: "text-[10px] bg-[#8B5CF6]/20 text-[#C4B5FD] px-2 py-1 rounded-lg border border-white/10 font-bold" },
                            "#",
                            t)))))),
                React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3" },
                    isVerifiedUser && matchedVtuber.id !== currentUser?.uid && (React.createElement("button", { onClick: () => onBraveInvite(matchedVtuber), className: "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white py-3 rounded-xl font-bold shadow-sm transition-transform flex items-center justify-center gap-2" },
                        React.createElement("i", { className: "fa-solid fa-heart" }),
                        " \u52C7\u6562\u9080\u8ACB")),
                    React.createElement("button", { onClick: () => {
                            setSelectedVTuber(matchedVtuber);
                            navigate(`profile/${matchedVtuber.id}`);
                        }, className: "bg-[#8B5CF6] hover:bg-[#8B5CF6] text-white py-3 rounded-xl font-bold shadow-sm transition-transform flex items-center justify-center gap-2" },
                        React.createElement("i", { className: "fa-solid fa-address-card" }),
                        " \u524D\u5F80\u8A73\u7D30\u540D\u7247"),
                    React.createElement("button", { onClick: () => handleMatch(zodiacScore !== null ? "zodiac" : "random"), className: "sm:col-span-2 bg-[#181B25] hover:bg-[#1D2130] text-[#CBD5E1] py-3 rounded-xl font-bold border border-[#2A2F3D] transition-colors flex items-center justify-center gap-2" },
                        React.createElement("i", { className: "fa-solid fa-rotate-right" }),
                        " \u4E0D\u6EFF\u610F\uFF1F\u518D\u62BD\u4E00\u6B21")))))));
};
const TIME_OPTIONS = [];
for (let i = 0; i < 24; i++) {
    const h = String(i).padStart(2, "0");
    TIME_OPTIONS.push(`${h}:00`);
    TIME_OPTIONS.push(`${h}:30`);
}
TIME_OPTIONS.push("23:59");
// 🌟 新增：專屬的日期+時間選擇器 (拆分日期與時間，強制 24 小時制)
const DateTimePicker = ({ value, onChange, className }) => {
    // 將 "YYYY-MM-DDTHH:mm" 拆成日期與時間
    const datePart = value ? value.split('T')[0] : '';
    const timePart = value && value.includes('T') ? value.split('T')[1].substring(0, 5) : '';
    const handleDateChange = (e) => {
        const newDate = e.target.value;
        if (!newDate) {
            onChange(''); // 如果清空日期，就全部清空
        }
        else {
            onChange(`${newDate}T${timePart || '00:00'}`);
        }
    };
    const handleTimeChange = (e) => {
        const newTime = e.target.value;
        // 如果還沒選日期就先選時間，預設帶入今天的日期
        const fallbackDate = new Date().toISOString().split('T')[0];
        onChange(`${datePart || fallbackDate}T${newTime}`);
    };
    // 移除 w-full 讓 flex-1 生效
    const baseCls = className.replace('w-full', '');
    return (React.createElement("div", { className: "flex gap-2 w-full" },
        React.createElement("input", { type: "date", value: datePart, onChange: handleDateChange, className: `${baseCls} flex-1 min-w-0` }),
        React.createElement("select", { value: timePart, onChange: handleTimeChange, className: `${baseCls} flex-1 min-w-0 cursor-pointer` },
            React.createElement("option", { value: "", disabled: true }, "\u9078\u64C7\u6642\u9593"),
            TIME_OPTIONS.map(t => React.createElement("option", { key: t, value: t }, t)),
            !TIME_OPTIONS.includes(timePart) && timePart && (React.createElement("option", { value: timePart }, timePart)))));
};
const ScheduleEditor = ({ form, updateForm }) => {
    const mode = form.isScheduleAnytime
        ? "anytime"
        : form.isScheduleExcept
            ? "except"
            : form.isScheduleCustom
                ? "custom"
                : "specific";
    const handleModeChange = (e) => {
        const m = e.target.value;
        updateForm({
            isScheduleAnytime: m === "anytime",
            isScheduleExcept: m === "except",
            isScheduleCustom: m === "custom",
        });
    };
    const updateSlot = (idx, field, val) => {
        const newSlots = [...(form.scheduleSlots || [])];
        newSlots[idx][field] = val;
        updateForm({ scheduleSlots: newSlots });
    };
    return (React.createElement("div", { className: "bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-4 mt-1" },
        React.createElement("div", { className: "mb-3" },
            React.createElement("select", { value: mode, onChange: handleModeChange, className: inputCls + " font-normal" },
                React.createElement("option", { value: "specific" }, "\u2714\uFE0F \u6307\u5B9A\u53EF\u806F\u52D5\u6642\u6BB5"),
                React.createElement("option", { value: "except" }, "\u274C \u9664\u4E86\u4EE5\u4E0B\u6642\u6BB5\uFF0C\u5176\u4ED6\u7686\u53EF"),
                React.createElement("option", { value: "custom" }, "\u270D\uFE0F \u81EA\u8A02\u6642\u9593 (\u81EA\u884C\u624B\u52D5\u8F38\u5165\u6642\u9593)"),
                React.createElement("option", { value: "anytime" }, "\uD83C\uDF1F \u6211\u90FD\u53EF\u4EE5 (\u96A8\u6642\u53EF\u7D04)"))),
        mode === "custom" && (React.createElement("div", { className: "space-y-3 border-t border-[#2A2F3D] pt-3" },
            React.createElement("input", { type: "text", value: form.customScheduleText || "", onChange: (e) => updateForm({ customScheduleText: e.target.value }), placeholder: "\u4F8B\u5982\uFF1A\u6BCF\u500B\u6708\u5E95\u7684\u9031\u672B\u665A\u4E0A...", className: inputCls }))),
        (mode === "specific" || mode === "except") && (React.createElement("div", { className: "space-y-3 border-t border-[#2A2F3D] pt-3" },
            (form.scheduleSlots || []).map((slot, index) => (React.createElement("div", { key: index, className: "flex flex-wrap items-center gap-2 bg-[#181B25]/50 p-2 rounded-lg border border-[#2A2F3D]" },
                React.createElement("select", { value: slot.day, onChange: (e) => updateSlot(index, "day", e.target.value), className: "bg-[#181B25] border border-[#2A2F3D] rounded p-1.5 text-white text-xs outline-none" }, [
                    "星期一",
                    "星期二",
                    "星期三",
                    "星期四",
                    "星期五",
                    "星期六",
                    "星期日",
                    "平日",
                    "週末",
                    "每日",
                ].map((d) => (React.createElement("option", { key: d, value: d }, d)))),
                React.createElement("select", { value: slot.start, onChange: (e) => updateSlot(index, "start", e.target.value), className: "bg-[#181B25] border border-[#2A2F3D] rounded p-1.5 text-white text-xs outline-none box-border min-w-0 cursor-pointer" },
                    !TIME_OPTIONS.includes(slot.start) && slot.start && (React.createElement("option", { value: slot.start }, slot.start)),
                    TIME_OPTIONS.map(t => React.createElement("option", { key: t, value: t }, t))),
                React.createElement("span", { className: "text-[#94A3B8] text-xs" }, "\u81F3"),
                React.createElement("select", { value: slot.end, onChange: (e) => updateSlot(index, "end", e.target.value), className: "bg-[#181B25] border border-[#2A2F3D] rounded p-1.5 text-white text-xs outline-none box-border min-w-0 cursor-pointer" },
                    !TIME_OPTIONS.includes(slot.end) && slot.end && (React.createElement("option", { value: slot.end }, slot.end)),
                    TIME_OPTIONS.map(t => React.createElement("option", { key: t, value: t }, t))),
                React.createElement("button", { type: "button", onClick: () => updateForm({
                        scheduleSlots: form.scheduleSlots.filter((_, i) => i !== index),
                    }), className: "text-[#EF4444] hover:text-red-300 ml-auto px-2 transition-colors" },
                    React.createElement("i", { className: "fa-solid fa-trash" }))))),
            React.createElement("button", { type: "button", onClick: () => updateForm({
                    scheduleSlots: [
                        ...(form.scheduleSlots || []),
                        { day: "星期一", start: "20:00", end: "22:00" },
                    ],
                }), className: "text-xs text-[#A78BFA] hover:text-white flex items-center gap-1 mt-2 bg-[#8B5CF6]/10 hover:bg-[#8B5CF6] px-3 py-1.5 rounded-lg border border-[#8B5CF6]/20 transition-colors" },
                React.createElement("i", { className: "fa-solid fa-plus" }),
                " \u65B0\u589E\u6642\u6BB5")))));
};
const CollabTypesEditor = ({ formState, setFormState, showToast }) => {
    const toggleCollab = (type) => {
        let newTypes = Array.isArray(formState.collabTypes)
            ? [...formState.collabTypes]
            : [];
        if (newTypes.includes(type)) {
            newTypes = newTypes.filter((t) => t !== type);
        }
        else {
            if (newTypes.length + (formState.isOtherCollab ? 1 : 0) >= 3)
                return showToast("主要願意連動類型至多只能選擇三項喔！");
            newTypes.push(type);
        }
        setFormState({ collabTypes: newTypes });
    };
    const toggleOther = () => {
        const willBeChecked = !formState.isOtherCollab;
        if (willBeChecked &&
            (Array.isArray(formState.collabTypes)
                ? formState.collabTypes.length
                : 0) >= 3)
            return showToast("主要願意連動類型至多只能選擇三項喔！");
        setFormState({ isOtherCollab: willBeChecked });
    };
    const currentTypes = Array.isArray(formState.collabTypes)
        ? formState.collabTypes
        : [];
    return (React.createElement("div", { className: "bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-4 mt-1" },
        React.createElement("div", { className: "flex flex-wrap gap-3" },
            PREDEFINED_COLLABS.map((type) => (React.createElement("label", { key: type, className: "flex items-center gap-2 cursor-pointer group" },
                React.createElement("input", { type: "checkbox", checked: currentTypes.includes(type), onChange: () => toggleCollab(type), className: "accent-purple-500 w-4 h-4" }),
                React.createElement("span", { className: "text-sm text-[#CBD5E1] group-hover:text-white transition-colors" }, type)))),
            React.createElement("label", { className: "flex items-center gap-2 cursor-pointer group" },
                React.createElement("input", { type: "checkbox", checked: formState.isOtherCollab, onChange: toggleOther, className: "accent-purple-500 w-4 h-4" }),
                React.createElement("span", { className: "text-sm text-[#CBD5E1] group-hover:text-white transition-colors" }, "\u5176\u4ED6"))),
        formState.isOtherCollab && (React.createElement("div", { className: "mt-3 pl-6" },
            React.createElement("input", { type: "text", value: formState.otherCollabText || "", onChange: (e) => setFormState({ otherCollabText: e.target.value }), placeholder: "\u8ACB\u8F38\u5165\u60A8\u7684\u5176\u4ED6\u9023\u52D5\u985E\u578B...", className: inputCls })))));
};
const ProfileEditorForm = ({ form, updateForm, onSubmit, onCancel, isAdmin, showToast, user, onDeleteSelf, }) => {
    const [otpStatus, setOtpStatus] = useState("idle");
    const [otpInput, setOtpInput] = useState("");
    const [isFetchingSubscribers, setIsFetchingSubscribers] = useState(false);
    const [lastFetchTime, setLastFetchTime] = useState(form.lastYoutubeFetchTime || 0);
    const [isFetchingTwitch, setIsFetchingTwitch] = useState(false);
    const [lastTwitchFetchTime, setLastTwitchFetchTime] = useState(form.lastTwitchFetchTime || 0);
    // ✅ 名片編輯分段導覽：切換步驟後自動回到表單頂部，避免手機版停在頁尾找不到下一段內容。
    const editorTopRef = useRef(null);
    const didMountEditorRef = useRef(false);
    const scrollEditorToTop = () => {
        const el = editorTopRef.current;
        if (!el)
            return;
        const y = el.getBoundingClientRect().top + window.scrollY - 88;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    };
    const handleImageUpload = (e, field, maxWidth, maxHeight) => {
        const file = e.target.files[0];
        if (!file)
            return;
        if (file.size > 5 * 1024 * 1024) {
            e.target.value = "";
            return showToast("❌ 檔案太大！請選擇 5MB 以下的圖片。");
        }
        showToast("⏳ 圖片處理與壓縮中...");
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                const base64Str = canvas.toDataURL("image/jpeg", 0.7);
                if (base64Str.length > 800000) {
                    e.target.value = "";
                    return showToast("❌ 壓縮後依然太大，請先自行縮小尺寸後再上傳！");
                }
                updateForm({ [field]: base64Str });
                e.target.value = "";
                showToast(`✅ ${field === "avatar" ? "頭像" : "橫幅"}上傳並自動壓縮成功！`);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };
    useEffect(() => {
        const url = form.youtubeUrl || form.channelUrl;
        if (typeof url !== "string" || url.length < 15)
            return;
        const timer = setTimeout(() => {
            const now = Date.now();
            const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
            if ((url.includes("youtube.com") || url.includes("youtu.be")) &&
                now - lastFetchTime > TWENTY_FOUR_HOURS) {
                handleAutoFetchSubscribers(url);
            }
        }, 1500);
        return () => clearTimeout(timer);
    }, [form.youtubeUrl, form.channelUrl, lastFetchTime]);
    useEffect(() => {
        const url = form.twitchUrl;
        if (typeof url !== "string" || url.length < 15)
            return;
        const timer = setTimeout(() => {
            const now = Date.now();
            const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 👈 變數改名為 24 小時
            if (url.includes("twitch.tv") &&
                (now - lastTwitchFetchTime > TWENTY_FOUR_HOURS || isAdmin) // 👈 這裡也要改
            ) {
                handleAutoFetchTwitch(url);
            }
        }, 1500);
        return () => clearTimeout(timer);
    }, [form.twitchUrl, lastTwitchFetchTime, isAdmin]);
    const handleAutoFetchTwitch = async (autoUrl = null) => {
        const url = typeof autoUrl === "string" ? autoUrl : form.twitchUrl;
        if (typeof url !== "string" || !url)
            return showToast("請先在下方填妥 Twitch 連結！");
        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 👈 改為 24 小時
        if (!isAdmin) {
            if (now - lastTwitchFetchTime < TWENTY_FOUR_HOURS) { // 👈 這裡也要改
                if (typeof autoUrl !== "string") {
                    const remainHours = Math.ceil((TWENTY_FOUR_HOURS - (now - lastTwitchFetchTime)) / (60 * 60 * 1000));
                    showToast(`⏳ 為了保護額度，24小時內只能抓取一次。請 ${remainHours} 小時後再試！`);
                }
                return;
            }
        }
        setIsFetchingTwitch(true);
        try {
            const fetchTwitchStats = httpsCallable(functionsInstance, "fetchTwitchStats");
            const result = await fetchTwitchStats({ url });
            if (result.data && result.data.success) {
                const count = result.data.followerCount;
                let formattedCount = count.toString();
                if (count >= 10000)
                    formattedCount = (count / 10000).toFixed(1).replace(".0", "") + "萬";
                else if (count >= 1000)
                    formattedCount = (count / 1000).toFixed(1).replace(".0", "") + "K";
                updateForm({
                    twitchFollowers: formattedCount,
                    lastTwitchFetchTime: now,
                });
                setLastTwitchFetchTime(now);
                if (user && user.uid) {
                    updateDoc(doc(db, getPath("vtubers"), form.id || user.uid), {
                        twitchFollowers: formattedCount,
                        lastTwitchFetchTime: now,
                    }).catch(() => { });
                }
                if (typeof autoUrl !== "string")
                    showToast("✅ 成功抓取 Twitch 追隨數！");
            }
            else {
                if (typeof autoUrl !== "string")
                    showToast("❌ 抓取失敗: " + (result.data ? result.data.message : "未知錯誤"));
            }
        }
        catch (err) {
            console.error("Fetch Stats Error:", err);
            if (typeof autoUrl !== "string")
                showToast("❌ 伺服器連線失敗，請檢查網址或稍後再試");
        }
        finally {
            setIsFetchingTwitch(false);
        }
    };
    const handleAutoFetchSubscribers = async (autoUrl = null) => {
        const url = typeof autoUrl === "string"
            ? autoUrl
            : form.youtubeUrl || form.channelUrl;
        if (typeof url !== "string" || !url)
            return showToast("請先在下方填妥 YouTube 連結！");
        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        if (!isAdmin) {
            if (now - lastFetchTime < TWENTY_FOUR_HOURS) {
                if (typeof autoUrl !== "string") {
                    const remainHours = Math.ceil((TWENTY_FOUR_HOURS - (now - lastFetchTime)) / (60 * 60 * 1000));
                    showToast(`⏳ 為了保護額度，24小時內只能抓取一次。請 ${remainHours} 小時後再試！`);
                }
                return;
            }
        }
        setIsFetchingSubscribers(true);
        try {
            const fetchYouTubeStats = httpsCallable(functionsInstance, "fetchYouTubeStats");
            const result = await fetchYouTubeStats({ url });
            if (result.data && result.data.success) {
                const count = result.data.subscriberCount;
                let formattedCount = count.toString();
                if (count >= 10000)
                    formattedCount = (count / 10000).toFixed(1).replace(".0", "") + "萬";
                else if (count >= 1000)
                    formattedCount = (count / 1000).toFixed(1).replace(".0", "") + "K";
                updateForm({
                    youtubeSubscribers: formattedCount,
                    lastYoutubeFetchTime: now,
                });
                setLastFetchTime(now);
                if (user && user.uid) {
                    updateDoc(doc(db, getPath("vtubers"), form.id || user.uid), {
                        youtubeSubscribers: formattedCount,
                        lastYoutubeFetchTime: now,
                    }).catch(() => { });
                }
                if (typeof autoUrl !== "string")
                    showToast("✅ 成功抓取 YouTube 訂閱數！");
            }
            else {
                if (typeof autoUrl !== "string")
                    showToast("❌ 抓取失敗: " + (result.data ? result.data.message : "未知錯誤"));
            }
        }
        catch (err) {
            console.error("Fetch Stats Error:", err);
            if (typeof autoUrl !== "string")
                showToast("❌ 伺服器連線失敗，請檢查網址或稍後再試");
        }
        finally {
            setIsFetchingSubscribers(false);
        }
    };
    const handleSendOtp = async () => {
        // ✅ 新增這行：確保有登入才能發送
        if (!user)
            return showToast("❌ 請先登入後再進行信箱驗證！");
        const email = form.publicEmail;
        if (!email || !email.includes("@"))
            return showToast("請輸入有效的信箱格式！");
        setOtpStatus("sending");
        try {
            const sendVerificationCode = httpsCallable(functionsInstance, "sendVerificationCode");
            const result = await sendVerificationCode({ email: email });
            if (result.data && result.data.success) {
                setOtpStatus("sent");
                showToast("✅ 驗證碼已寄出！請至信箱收取 (10分鐘內有效)");
            }
            else {
                throw new Error(result.data ? result.data.message : "發送失敗");
            }
        }
        catch (err) {
            console.error("發送驗證碼出錯:", err);
            setOtpStatus("idle");
            const errorMsg = err.message || "發送失敗，請稍後再試";
            showToast("❌ " + errorMsg);
        }
    };
    const handleVerifyOtp = async () => {
        // ✅ 新增這行：確保有登入才能驗證
        if (!user)
            return showToast("❌ 請先登入後再進行信箱驗證！");
        if (!otpInput || otpInput.length !== 6) {
            return showToast("請輸入 6 位數驗證碼！");
        }
        try {
            showToast("⏳ 驗證中...");
            const verifyCode = httpsCallable(functionsInstance, "verifyCode");
            const result = await verifyCode({
                email: form.publicEmail,
                code: otpInput
            });
            if (result.data && result.data.success) {
                updateForm({ publicEmailVerified: true });
                setOtpStatus("verified");
                setOtpInput("");
                showToast("✅ 信箱驗證成功！(請記得點擊最下方儲存名片)");
            }
            else {
                throw new Error(result.data ? result.data.message : "驗證失敗");
            }
        }
        catch (err) {
            console.error("驗證失敗:", err);
            const errorMsg = err.message || "驗證碼錯誤或已失效";
            showToast("❌ " + errorMsg);
        }
    };
    const editorSteps = [
        { id: "basic", label: "基本資料", icon: "fa-id-card" },
        { id: "platform", label: "直播平台", icon: "fa-satellite-dish" },
        { id: "collab", label: "聯動偏好", icon: "fa-handshake-angle" },
        { id: "schedule", label: "可聯動時間", icon: "fa-calendar-days" },
        { id: "contact", label: "信箱與通知", icon: "fa-envelope" },
        { id: "preview", label: "預覽", icon: "fa-eye" },
    ];
    const [activeStep, setActiveStep] = useState(0);
    const currentStepId = editorSteps[activeStep]?.id || "basic";
    const isFirstStep = activeStep === 0;
    const isLastStep = activeStep === editorSteps.length - 1;
    const goPrevStep = () => setActiveStep((prev) => Math.max(0, prev - 1));
    const goNextStep = () => setActiveStep((prev) => Math.min(editorSteps.length - 1, prev + 1));
    useEffect(() => {
        if (!didMountEditorRef.current) {
            didMountEditorRef.current = true;
            return;
        }
        const timer = setTimeout(scrollEditorToTop, 80);
        return () => clearTimeout(timer);
    }, [activeStep]);
    const profileCompletion = useMemo(() => {
        const checks = [
            !!String(form.name || "").trim(),
            !!String(form.description || "").trim(),
            !!String(form.avatar || "").trim(),
            !!String(form.banner || "").trim(),
            Array.isArray(form.collabTypes) && form.collabTypes.length > 0,
            !!form.isScheduleAnytime || !!form.isScheduleCustom || (Array.isArray(form.scheduleSlots) && form.scheduleSlots.length > 0),
            !!String(form.youtubeUrl || form.twitchUrl || "").trim(),
            Array.isArray(form.tags) ? form.tags.length > 0 : !!String(form.tags || "").trim(),
        ];
        return Math.round((checks.filter(Boolean).length / checks.length) * 100);
    }, [form]);
    const panelCls = "bg-[#181B25]/80 border border-[#2A2F3D] rounded-2xl p-5 sm:p-6 space-y-5";
    const stepTitleCls = "text-white font-bold text-lg flex items-center gap-2";
    const primaryBtn = "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white py-3 px-5 rounded-xl font-bold shadow-sm transition-colors flex justify-center items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed";
    const secondaryBtn = "bg-[#1D2130] hover:bg-[#2A2F3D] text-[#F8FAFC] py-3 px-5 rounded-xl font-bold border border-[#2A2F3D] transition-colors flex justify-center items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed";
    const ghostBtn = "text-[#94A3B8] hover:text-[#F8FAFC] py-3 px-4 rounded-xl font-bold transition-colors flex justify-center items-center gap-2 whitespace-nowrap";
    const dangerBtn = "bg-[#EF4444]/10 hover:bg-[#EF4444] text-[#EF4444] hover:text-white py-3 px-5 rounded-xl font-bold border border-[#EF4444]/30 transition-colors flex justify-center items-center gap-2 whitespace-nowrap";
    const successBtn = "bg-[#22C55E] hover:bg-[#16A34A] text-white py-3 px-5 rounded-xl font-bold shadow-sm transition-colors flex justify-center items-center gap-2 whitespace-nowrap";
    return (React.createElement("form", { ref: editorTopRef, onSubmit: onSubmit, className: "space-y-6 scroll-mt-24" },
        React.createElement("div", { className: "bg-[#181B25]/80 border border-[#2A2F3D] rounded-2xl p-4 sm:p-5" },
            React.createElement("div", { className: "flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4" },
                React.createElement("div", null,
                    React.createElement("p", { className: "text-[#94A3B8] text-xs font-bold tracking-widest uppercase mb-1" }, "Profile editor"),
                    React.createElement("h3", { className: "text-xl font-extrabold text-white" }, "\u5B8C\u6210\u4F60\u7684 V-Nexus \u540D\u7247"),
                    React.createElement("p", { className: "text-sm text-[#94A3B8] mt-1" }, "\u6BCF\u6B21\u53EA\u586B\u4E00\u6BB5\uFF0C\u6700\u5F8C\u5230\u300C\u9810\u89BD\u300D\u78BA\u8A8D\u5F8C\u518D\u5132\u5B58\u3002")),
                React.createElement("div", { className: "min-w-[180px]" },
                    React.createElement("div", { className: "flex items-center justify-between text-xs text-[#94A3B8] mb-1" },
                        React.createElement("span", null, "\u5B8C\u6210\u5EA6"),
                        React.createElement("span", { className: "text-white font-bold" },
                            profileCompletion,
                            "%")),
                    React.createElement("div", { className: "h-2 bg-[#0F111A] rounded-full overflow-hidden border border-[#2A2F3D]" },
                        React.createElement("div", { className: "h-full bg-[#8B5CF6] transition-all", style: { width: `${profileCompletion}%` } })))),
            React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2" }, editorSteps.map((step, idx) => (React.createElement("button", { key: step.id, type: "button", onClick: () => setActiveStep(idx), className: `px-3 py-2 rounded-xl border text-xs font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${activeStep === idx ? "bg-[#8B5CF6] border-[#8B5CF6] text-white" : idx < activeStep ? "bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]" : "bg-[#0F111A] border-[#2A2F3D] text-[#94A3B8] hover:bg-[#1D2130] hover:text-white"}` },
                React.createElement("i", { className: `fa-solid ${step.icon}` }),
                React.createElement("span", null, step.label)))))),
        currentStepId === "basic" && (React.createElement("div", { className: panelCls },
            React.createElement("div", null,
                React.createElement("h3", { className: stepTitleCls },
                    React.createElement("i", { className: "fa-solid fa-id-card text-[#8B5CF6]" }),
                    " \u57FA\u672C\u8CC7\u6599"),
                React.createElement("p", { className: "text-sm text-[#94A3B8] mt-1" }, "\u5148\u8B93\u5927\u5BB6\u77E5\u9053\u4F60\u662F\u8AB0\u3001\u76EE\u524D\u662F\u5426\u958B\u653E\u806F\u52D5\u3002")),
            React.createElement("div", { className: "bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-4" },
                React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u540D\u7247\u986F\u793A\u72C0\u614B"),
                React.createElement("select", { value: form.activityStatus, onChange: (e) => updateForm({ activityStatus: e.target.value }), className: inputCls + " font-normal" },
                    React.createElement("option", { value: "active" }, "\uD83D\uDFE2 \u958B\u653E\u806F\u52D5"),
                    React.createElement("option", { value: "creator" }, "\uD83C\uDFA8 \u6211\u662F\u7E6A\u5E2B / \u5EFA\u6A21\u5E2B / \u526A\u8F2F\u5E2B"),
                    React.createElement("option", { value: "sleep" }, "\uD83C\uDF19 \u66AB\u6642\u4F11\u606F"),
                    React.createElement("option", { value: "graduated" }, "\uD83D\uDD4A\uFE0F \u5DF2\u7562\u696D"))),
            React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-5" },
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" },
                        "VTuber \u540D\u7A31 ",
                        React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                    React.createElement("input", { type: "text", value: form.name || "", onChange: (e) => updateForm({ name: e.target.value }), className: inputCls, placeholder: "\u8ACB\u8F38\u5165\u60A8\u7684\u540D\u7A31" })),
                React.createElement("div", { className: "bg-[#8B5CF6]/5 border border-[#8B5CF6]/20 p-4 rounded-xl" },
                    React.createElement("label", { className: "block text-sm font-bold text-[#C4B5FD] mb-2" },
                        React.createElement("i", { className: "fa-solid fa-link mr-1" }),
                        " \u8A2D\u5B9A\u5C08\u5C6C\u7DB2\u5740 ID"),
                    React.createElement("div", { className: "flex items-center gap-1" },
                        React.createElement("span", { className: "text-[#64748B] text-[10px] font-mono hidden sm:inline" }, "#profile/"),
                        React.createElement("input", { type: "text", placeholder: "\u4F8B\u5982: daxiong", value: form.slug || "", onChange: (e) => updateForm({
                                slug: e.target.value
                                    .replace(/[^a-zA-Z0-9_-]/g, "")
                                    .toLowerCase(),
                            }), className: inputCls + " font-mono text-[#A78BFA] !p-2" })))),
            React.createElement("div", null,
                React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" },
                    "\u4ECB\u7D39\u4E00\u4E0B\u4F60\u81EA\u5DF1\u5427\uFF01 ",
                    React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                React.createElement("textarea", { rows: "6", value: form.description || "", onChange: (e) => updateForm({ description: e.target.value }), className: inputCls + " resize-none", placeholder: "\u7C21\u55AE\u4ECB\u7D39\u4F60\u7684\u983B\u9053\u98A8\u683C\u3001\u500B\u6027\u3001\u60F3\u627E\u600E\u6A23\u7684\u806F\u52D5\u5925\u4F34\u3002" })),
            React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-5" },
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u6240\u5C6C\u52E2\u529B"),
                    React.createElement("select", { value: form.agency || "個人勢", onChange: (e) => updateForm({ agency: e.target.value }), className: inputCls },
                        React.createElement("option", { value: "\u500B\u4EBA\u52E2" }, "\u500B\u4EBA\u52E2"),
                        React.createElement("option", { value: "\u4F01\u696D\u52E2" }, "\u4F01\u696D\u52E2"),
                        React.createElement("option", { value: "\u793E\u5718\u52E2" }, "\u793E\u5718\u52E2"),
                        React.createElement("option", { value: "\u5408\u4F5C\u52E2" }, "\u5408\u4F5C\u52E2"))),
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u5275\u4F5C\u578B\u614B"),
                    React.createElement("select", { value: form.streamingStyle || "", onChange: (e) => updateForm({ streamingStyle: e.target.value }), className: inputCls },
                        React.createElement("option", { value: "" }, "\u8ACB\u9078\u64C7..."),
                        React.createElement("option", { value: "\u4E00\u822C\u578B\u614B" }, "\u4E00\u822C\u578B\u614B"),
                        React.createElement("option", { value: "\u7537\u8072\u5973\u76AE" }, "\u7537\u8072\u5973\u76AE"),
                        React.createElement("option", { value: "\u5973\u8072\u7537\u76AE" }, "\u5973\u8072\u7537\u76AE"),
                        React.createElement("option", { value: "\u7121\u6027\u5225/\u4EBA\u5916" }, "\u7121\u6027\u5225/\u4EBA\u5916"),
                        React.createElement("option", { value: "\u5176\u4ED6" }, "\u5176\u4ED6")))),
            React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-5" },
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u570B\u7C4D / \u6240\u5728\u5730"),
                    React.createElement("div", { className: "flex flex-wrap gap-3 bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-4" },
                        ["台灣", "香港", "日本", "海外"].map((n) => (React.createElement("label", { key: n, className: "flex items-center gap-2 cursor-pointer group" },
                            React.createElement("input", { type: "checkbox", checked: (form.nationalities || []).includes(n), onChange: () => {
                                    let list = [...(form.nationalities || [])];
                                    list = list.includes(n) ? list.filter((x) => x !== n) : [...list, n];
                                    updateForm({ nationalities: list });
                                }, className: "accent-purple-500 w-4 h-4" }),
                            React.createElement("span", { className: "text-sm text-[#CBD5E1] group-hover:text-white transition-colors" }, n)))),
                        React.createElement("label", { className: "flex items-center gap-2 cursor-pointer group" },
                            React.createElement("input", { type: "checkbox", checked: !!form.isOtherNationality, onChange: () => updateForm({ isOtherNationality: !form.isOtherNationality }), className: "accent-purple-500 w-4 h-4" }),
                            React.createElement("span", { className: "text-sm text-[#CBD5E1] group-hover:text-white transition-colors" }, "\u5176\u4ED6"))),
                    form.isOtherNationality && (React.createElement("input", { type: "text", value: form.otherNationalityText || "", onChange: (e) => updateForm({ otherNationalityText: e.target.value }), placeholder: "\u8ACB\u8F38\u5165\u570B\u7C4D/\u6240\u5728\u5730", className: inputCls + " mt-2" }))),
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u4F7F\u7528\u8A9E\u8A00"),
                    React.createElement("div", { className: "flex flex-wrap gap-3 bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-4" }, ["國", "日", "英", "粵", "台語"].map((lang) => (React.createElement("label", { key: lang, className: "flex items-center gap-2 cursor-pointer group" },
                        React.createElement("input", { type: "checkbox", checked: (form.languages || []).includes(lang), onChange: () => {
                                let newLangs = [...(form.languages || [])];
                                newLangs = newLangs.includes(lang)
                                    ? newLangs.filter((l) => l !== lang)
                                    : [...newLangs, lang];
                                updateForm({ languages: newLangs });
                            }, className: "accent-purple-500 w-4 h-4" }),
                        React.createElement("span", { className: "text-sm text-[#CBD5E1] group-hover:text-white transition-colors" }, lang))))))),
            React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-5" },
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u982D\u50CF\u7DB2\u5740 / \u4E0A\u50B3"),
                    React.createElement("div", { className: "flex gap-3" },
                        React.createElement("img", { src: sanitizeUrl(form.avatar), className: "w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-[#181B25]" }),
                        React.createElement("div", { className: "flex-1 flex flex-col gap-2 min-w-0" },
                            React.createElement("input", { type: "text", value: form.avatar || "", onChange: (e) => updateForm({ avatar: e.target.value }), className: inputCls, placeholder: "\u53EF\u76F4\u63A5\u8CBC\u4E0A\u5716\u7247\u7DB2\u5740" }),
                            React.createElement("div", { className: "relative w-full" },
                                React.createElement("input", { type: "file", accept: "image/png, image/jpeg, image/webp", onChange: (e) => handleImageUpload(e, "avatar", 300, 300), className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" }),
                                React.createElement("button", { type: "button", className: secondaryBtn + " w-full text-xs py-2 relative z-0" },
                                    React.createElement("i", { className: "fa-solid fa-cloud-arrow-up" }),
                                    " \u5F9E\u88DD\u7F6E\u4E0A\u50B3\u982D\u50CF"))))),
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u6A6B\u5E45\u3001\u4EE3\u8868\u4F5C\u54C1 / \u4E0A\u50B3"),
                    React.createElement("div", { className: "flex gap-3" },
                        React.createElement("img", { src: sanitizeUrl(form.banner), className: "w-24 h-14 rounded-xl object-cover flex-shrink-0 bg-[#181B25]" }),
                        React.createElement("div", { className: "flex-1 flex flex-col gap-2 min-w-0" },
                            React.createElement("input", { type: "text", value: form.banner || "", onChange: (e) => updateForm({ banner: e.target.value }), className: inputCls, placeholder: "\u53EF\u76F4\u63A5\u8CBC\u4E0A\u5716\u7247\u7DB2\u5740" }),
                            React.createElement("div", { className: "relative w-full" },
                                React.createElement("input", { type: "file", accept: "image/png, image/jpeg, image/webp", onChange: (e) => handleImageUpload(e, "banner", 800, 400), className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" }),
                                React.createElement("button", { type: "button", className: secondaryBtn + " w-full text-xs py-2 relative z-0" },
                                    React.createElement("i", { className: "fa-solid fa-cloud-arrow-up" }),
                                    " \u5F9E\u88DD\u7F6E\u4E0A\u50B3\u6A6B\u5E45 / \u4EE3\u8868\u4F5C\u54C1"))))),
                React.createElement("div", { id: "creator-service-section", className: "bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-4 space-y-5 md:col-span-2 scroll-mt-28" },
                    React.createElement("div", { className: "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2" },
                        React.createElement("div", null,
                            React.createElement("p", { className: "text-xs font-bold text-[#38BDF8] tracking-[0.16em] uppercase mb-1" }, "Creator Service"),
                            React.createElement("label", { className: "block text-sm font-bold text-[#F8FAFC]" }, "\u5275\u4F5C\u670D\u52D9\u5C08\u5340"),
                            React.createElement("p", { className: "text-xs text-[#94A3B8] mt-1" }, "\u5982\u679C\u4F60\u6709\u63A5\u7E6A\u5716\u3001\u5EFA\u6A21\u6216\u526A\u8F2F\u76F8\u95DC\u670D\u52D9\uFF0C\u53EF\u4EE5\u5728\u9019\u88E1\u88DC\u4E0A\u8B93\u59D4\u8A17\u8005\u66F4\u5BB9\u6613\u627E\u5230\u4F60\u3002")),
                        React.createElement("span", { className: "text-[11px] text-[#94A3B8] whitespace-nowrap" }, "\u9078\u586B\uFF0C\u53EF\u591A\u9078")),
                    React.createElement("div", null,
                        React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-3" },
                            "\u60A8\u662F\u4E0D\u662F\u7E6A\u5E2B / \u5EFA\u6A21\u5E2B / \u526A\u8F2F\u5E2B\uFF1F ",
                            React.createElement("span", { className: "text-[11px] text-[#94A3B8] font-normal" }, "(\u82E5\u90FD\u4E0D\u662F\u53EF\u4E0D\u586B)")),
                        React.createElement("div", { className: "flex flex-wrap gap-3" }, CREATOR_ROLE_OPTIONS.map((role) => {
                            const checked = (form.creatorRoles || []).includes(role);
                            return (React.createElement("label", { key: role, className: `flex items-center gap-2 cursor-pointer rounded-xl border px-3 py-2 transition-colors ${checked ? "bg-[#38BDF8]/10 border-[#38BDF8]/40 text-[#38BDF8]" : "bg-[#181B25] border-[#2A2F3D] text-[#CBD5E1] hover:bg-[#1D2130]"}` },
                                React.createElement("input", { type: "checkbox", checked: checked, onChange: () => {
                                        let list = [...(form.creatorRoles || [])];
                                        list = list.includes(role) ? list.filter((x) => x !== role) : [...list, role];
                                        updateForm({ creatorRoles: list });
                                    }, className: "accent-sky-400 w-4 h-4" }),
                                React.createElement("span", { className: "text-sm font-bold" }, role)));
                        }))),
                    React.createElement("div", null,
                        React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-3" },
                            "\u5275\u4F5C\u98A8\u683C / \u985E\u578B ",
                            React.createElement("span", { className: "text-[#EF4444]" }, "*"),
                            React.createElement("span", { className: "text-[11px] text-[#94A3B8] font-normal ml-2" }, "\u82E5\u6709\u52FE\u9078\u5275\u4F5C\u670D\u52D9\uFF0C\u8ACB\u81F3\u5C11\u9078\u4E00\u9805")),
                        React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2" }, CREATOR_STYLE_OPTIONS.map((style) => {
                            const checked = (form.creatorStyles || []).includes(style);
                            return (React.createElement("label", { key: style, className: `flex items-center gap-2 cursor-pointer rounded-xl border px-3 py-2 transition-colors ${checked ? "bg-[#8B5CF6]/10 border-[#8B5CF6]/40 text-[#C4B5FD]" : "bg-[#181B25] border-[#2A2F3D] text-[#CBD5E1] hover:bg-[#1D2130]"}` },
                                React.createElement("input", { type: "checkbox", checked: checked, onChange: () => {
                                        let list = [...(form.creatorStyles || [])];
                                        list = list.includes(style) ? list.filter((x) => x !== style) : [...list, style];
                                        updateForm({ creatorStyles: list });
                                    }, className: "accent-purple-500 w-4 h-4" }),
                                React.createElement("span", { className: "text-sm font-bold" }, style)));
                        })),
                        (form.creatorStyles || []).includes("其他(自由填寫)") && (React.createElement("input", { type: "text", value: form.creatorOtherStyleText || "", onChange: (e) => updateForm({ creatorOtherStyleText: e.target.value }), className: inputCls + " mt-3", placeholder: "\u8ACB\u7C21\u55AE\u586B\u5BEB\u5176\u4ED6\u5275\u4F5C\u98A8\u683C / \u985E\u578B" }))),
                    React.createElement("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-5" },
                        React.createElement("div", null,
                            React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-3" }, "\u63A5\u6848\u72C0\u614B"),
                            React.createElement("select", { value: form.creatorStatus || "", onChange: (e) => updateForm({ creatorStatus: e.target.value }), className: inputCls },
                                React.createElement("option", { value: "" }, "\u8ACB\u9078\u64C7\u63A5\u6848\u72C0\u614B"),
                                CREATOR_STATUS_OPTIONS.map((status) => (React.createElement("option", { key: status, value: status }, status)))),
                            React.createElement("p", { className: "text-xs text-[#94A3B8] mt-2" }, "\u7528\u4E0B\u62C9\u9078\u55AE\u5FEB\u901F\u6A19\u793A\u76EE\u524D\u662F\u5426\u53EF\u63A5\u6848\uFF0C\u907F\u514D\u540D\u7247\u904E\u9577\u3002")),
                        React.createElement("div", null,
                            React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-3" },
                                "\u9810\u7B97\u53C3\u8003 ",
                                React.createElement("span", { className: "text-[#94A3B8] text-xs font-normal" }, "\u9078\u586B")),
                            React.createElement("select", { value: normalizeCreatorBudgetRange(form.creatorBudgetRange), onChange: (e) => updateForm({ creatorBudgetRange: e.target.value }), className: inputCls },
                                React.createElement("option", { value: "" }, "\u8ACB\u9078\u64C7\u9810\u7B97\u53C3\u8003"),
                                CREATOR_BUDGET_OPTIONS.map((budget) => (React.createElement("option", { key: budget, value: budget }, budget)))),
                            React.createElement("p", { className: "text-xs text-[#94A3B8] mt-2" }, "\u300C\u79C1\u8A0A\u8A62\u50F9\u300D\u6703\u986F\u793A\u5728\u5275\u4F5C\u670D\u52D9\u5C08\u5340\u8207\u540D\u7247\u4E0A\u3002"))),
                    React.createElement("div", null,
                        React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" },
                            "\u4F5C\u54C1\u96C6 / \u59D4\u8A17\u8CC7\u8A0A\u7DB2\u5740 ",
                            React.createElement("span", { className: "text-[#94A3B8] text-xs font-normal" }, "\u9078\u586B")),
                        React.createElement("input", { type: "url", value: form.creatorPortfolioUrl || "", onChange: (e) => updateForm({ creatorPortfolioUrl: e.target.value }), className: inputCls, placeholder: "\u4F8B\u5982 Pixiv\u3001X \u4F5C\u54C1\u4E32\u3001\u500B\u4EBA\u7DB2\u7AD9\u6216\u59D4\u8A17\u8868\u55AE\u7DB2\u5740" }),
                        React.createElement("p", { className: "text-xs text-[#94A3B8] mt-2" }, "\u586B\u5BEB\u5F8C\u6703\u5728\u7E6A\u5E2B / \u5EFA\u6A21\u5E2B / \u526A\u8F2F\u5E2B\u59D4\u8A17\u5C08\u5340\u986F\u793A\u300C\u89C0\u770B\u4F5C\u54C1\u96C6\u300D\u6309\u9215\u3002")))))),
        currentStepId === "platform" && (React.createElement("div", { className: panelCls },
            React.createElement("div", null,
                React.createElement("h3", { className: stepTitleCls },
                    React.createElement("i", { className: "fa-solid fa-satellite-dish text-[#38BDF8]" }),
                    " \u76F4\u64AD\u5E73\u53F0"),
                React.createElement("p", { className: "text-sm text-[#94A3B8] mt-1" }, "\u586B\u5BEB\u4E3B\u8981\u5E73\u53F0\u8207\u793E\u7FA4\u9023\u7D50\uFF0C\u8A02\u95B1/\u8FFD\u96A8\u6578\u6703\u7531\u5F8C\u7AEF\u5B89\u5168\u6293\u53D6\u3002")),
            React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-5" },
                React.createElement("div", null,
                    React.createElement("label", { className: "flex items-center justify-between text-sm font-bold text-[#CBD5E1] mb-2" },
                        React.createElement("span", null, "YouTube \u9023\u7D50"),
                        React.createElement("label", { className: "flex items-center gap-1 text-xs cursor-pointer text-[#C4B5FD] font-normal" },
                            React.createElement("input", { type: "radio", value: "YouTube", checked: form.mainPlatform === "YouTube", onChange: (e) => updateForm({ mainPlatform: e.target.value }), className: "accent-purple-500" }),
                            "\u4E3B\u5E73\u53F0")),
                    React.createElement("input", { type: "url", value: form.youtubeUrl || "", onChange: (e) => updateForm({ youtubeUrl: e.target.value }), className: inputCls })),
                React.createElement("div", null,
                    React.createElement("label", { className: "flex items-center justify-between text-sm font-bold text-[#CBD5E1] mb-2" },
                        React.createElement("span", null, "Twitch \u9023\u7D50"),
                        React.createElement("label", { className: "flex items-center gap-1 text-xs cursor-pointer text-[#C4B5FD] font-normal" },
                            React.createElement("input", { type: "radio", value: "Twitch", checked: form.mainPlatform === "Twitch", onChange: (e) => updateForm({ mainPlatform: e.target.value }), className: "accent-purple-500" }),
                            "\u4E3B\u5E73\u53F0")),
                    React.createElement("input", { type: "url", value: form.twitchUrl || "", onChange: (e) => updateForm({ twitchUrl: e.target.value }), className: inputCls }))),
            React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-5" },
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "YouTube \u8A02\u95B1\u6578"),
                    React.createElement("div", { className: "flex gap-2" },
                        React.createElement("input", { type: "text", readOnly: true, value: form.youtubeSubscribers || "", placeholder: "\u7CFB\u7D71\u5C07\u81EA\u52D5\u6293\u53D6", className: inputCls + " bg-[#181B25] cursor-not-allowed text-[#94A3B8]" }),
                        React.createElement("button", { type: "button", onClick: handleAutoFetchSubscribers, disabled: isFetchingSubscribers || (Date.now() - lastFetchTime < 24 * 60 * 60 * 1000 && !isAdmin), className: secondaryBtn + " px-4 text-xs" }, isFetchingSubscribers ? React.createElement("i", { className: "fa-solid fa-spinner fa-spin" }) : React.createElement(React.Fragment, null,
                            React.createElement("i", { className: "fa-solid fa-wand-magic-sparkles" }),
                            " \u6293\u53D6"))),
                    React.createElement("p", { className: "text-[10px] text-[#A78BFA]/80 mt-1" }, "\u6BCF 24 \u5C0F\u6642\u9650\u6293\u4E00\u6B21\u3002")),
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "Twitch \u8FFD\u96A8\u6578"),
                    React.createElement("div", { className: "flex gap-2" },
                        React.createElement("input", { type: "text", readOnly: true, value: form.twitchFollowers || "", placeholder: "\u7CFB\u7D71\u5C07\u81EA\u52D5\u6293\u53D6", className: inputCls + " bg-[#181B25] cursor-not-allowed text-[#94A3B8]" }),
                        React.createElement("button", { type: "button", onClick: handleAutoFetchTwitch, disabled: isFetchingTwitch || (Date.now() - lastTwitchFetchTime < 24 * 60 * 60 * 1000 && !isAdmin), className: secondaryBtn + " px-4 text-xs" }, isFetchingTwitch ? React.createElement("i", { className: "fa-solid fa-spinner fa-spin" }) : React.createElement(React.Fragment, null,
                            React.createElement("i", { className: "fa-solid fa-wand-magic-sparkles" }),
                            " \u6293\u53D6"))),
                    React.createElement("p", { className: "text-[10px] text-[#A78BFA]/80 mt-1" }, "\u6BCF 24 \u5C0F\u6642\u9650\u6293\u4E00\u6B21\u3002"))),
            React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-5" },
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "X\u9023\u7D50"),
                    React.createElement("input", { type: "url", value: form.xUrl || "", onChange: (e) => updateForm({ xUrl: e.target.value }), className: inputCls })),
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "Instagram"),
                    React.createElement("input", { type: "url", value: form.igUrl || "", onChange: (e) => updateForm({ igUrl: e.target.value }), className: inputCls }))),
            React.createElement("div", null,
                React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u6211\u7684\u76F4\u64AD\u98A8\u683C\u4EE3\u8868\u4F5C"),
                React.createElement("input", { type: "url", value: form.streamStyleUrl || "", onChange: (e) => updateForm({ streamStyleUrl: e.target.value }), className: inputCls, placeholder: "\u586B\u5165\u5F71\u7247\u9023\u7D50" })))),
        currentStepId === "collab" && (React.createElement("div", { className: panelCls },
            React.createElement("div", null,
                React.createElement("h3", { className: stepTitleCls },
                    React.createElement("i", { className: "fa-solid fa-handshake-angle text-[#22C55E]" }),
                    " \u806F\u52D5\u504F\u597D"),
                React.createElement("p", { className: "text-sm text-[#94A3B8] mt-1" }, "\u8B93\u5176\u4ED6\u5275\u4F5C\u8005\u5FEB\u901F\u5224\u65B7\u4F60\u9069\u5408\u54EA\u4E9B\u4F01\u5283\u6216\u904A\u6232\u3002")),
            React.createElement("div", null,
                React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" },
                    "\u4E3B\u8981\u9858\u610F\u9023\u52D5\u985E\u578B ",
                    React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                React.createElement(CollabTypesEditor, { formState: form, setFormState: updateForm, showToast: showToast })),
            React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-5" },
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u4F60\u662F\u4EC0\u9EBC\u4EBA\uFF1F"),
                    React.createElement("select", { value: form.personalityType || "", onChange: (e) => updateForm({ personalityType: e.target.value }), className: inputCls },
                        React.createElement("option", { value: "" }, "\u8ACB\u9078\u64C7..."),
                        React.createElement("option", { value: "\u6211\u662FI\u4EBA" }, "\u6211\u662FI\u4EBA"),
                        React.createElement("option", { value: "\u6642I\u6642E" }, "\u6642I\u6642E"),
                        React.createElement("option", { value: "\u6211\u5927E\u4EBA" }, "\u6211\u5927E\u4EBA"),
                        React.createElement("option", { value: "\u770B\u5FC3\u60C5" }, "\u770B\u5FC3\u60C5"),
                        React.createElement("option", { value: "\u5176\u4ED6" }, "\u5176\u4ED6(\u81EA\u884C\u65B0\u589E)")),
                    form.personalityType === "其他" && (React.createElement("input", { type: "text", value: form.personalityTypeOther || "", onChange: (e) => updateForm({ personalityTypeOther: e.target.value }), placeholder: "\u8ACB\u8F38\u5165\u4F60\u662F\u4EC0\u9EBC\u4EBA", className: inputCls + " mt-2" }))),
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u4F60\u7684\u661F\u5EA7"),
                    React.createElement("select", { value: form.zodiacSign || "", onChange: (e) => updateForm({ zodiacSign: e.target.value }), className: inputCls },
                        React.createElement("option", { value: "" }, "\u8ACB\u9078\u64C7\u661F\u5EA7..."),
                        ZODIAC_SIGNS.map((z) => React.createElement("option", { key: z, value: z }, z))))),
            React.createElement("div", null,
                React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u4F60\u662F\u4EC0\u9EBC\u8272\u7CFB? (\u81F3\u591A\u4E09\u9805)"),
                React.createElement("div", { className: "flex flex-wrap gap-3 bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-4" }, COLOR_OPTIONS.map((color) => (React.createElement("label", { key: color, className: "flex items-center gap-2 cursor-pointer group" },
                    React.createElement("input", { type: "checkbox", checked: (form.colorSchemes || []).includes(color), onChange: () => {
                            let newColors = [...(form.colorSchemes || [])];
                            if (newColors.includes(color)) {
                                newColors = newColors.filter((c) => c !== color);
                            }
                            else {
                                if (newColors.length >= 3)
                                    return showToast("色系至多只能選擇三項喔！");
                                newColors.push(color);
                            }
                            updateForm({ colorSchemes: newColors });
                        }, className: "accent-purple-500 w-4 h-4" }),
                    React.createElement("span", { className: "text-sm text-[#CBD5E1] group-hover:text-white transition-colors" }, color)))))),
            React.createElement("div", null,
                React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u5167\u5BB9\u6A19\u7C64 (\u9017\u865F\u5206\u9694)"),
                React.createElement("input", { type: "text", value: Array.isArray(form.tags) ? form.tags.join(", ") : (form.tags || ""), onChange: (e) => updateForm({ tags: e.target.value }), className: inputCls, placeholder: "\u4F8B\u5982\uFF1AAPEX, \u96DC\u8AC7, \u6B4C\u56DE" })),
            isAdmin && (React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-5" },
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u63A8\u85A6\u6578"),
                    React.createElement("input", { type: "number", value: form.likes || 0, onChange: (e) => updateForm({ likes: Number(e.target.value) }), className: inputCls })),
                React.createElement("div", null,
                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u5012\u8B9A\u6578"),
                    React.createElement("input", { type: "number", value: form.dislikes || 0, onChange: (e) => updateForm({ dislikes: Number(e.target.value) }), className: inputCls })))))),
        currentStepId === "schedule" && (React.createElement("div", { className: panelCls },
            React.createElement("div", null,
                React.createElement("h3", { className: stepTitleCls },
                    React.createElement("i", { className: "fa-solid fa-calendar-days text-[#F59E0B]" }),
                    " \u53EF\u806F\u52D5\u6642\u9593"),
                React.createElement("p", { className: "text-sm text-[#94A3B8] mt-1" }, "\u8B93\u5225\u4EBA\u77E5\u9053\u4EC0\u9EBC\u6642\u5019\u6BD4\u8F03\u9069\u5408\u9080\u8ACB\u4F60\u3002")),
            React.createElement("div", null,
                React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" },
                    "\u53EF\u806F\u52D5\u6642\u6BB5 ",
                    React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                React.createElement(ScheduleEditor, { form: form, updateForm: updateForm })))),
        currentStepId === "contact" && (React.createElement("div", { className: panelCls },
            React.createElement("div", null,
                React.createElement("h3", { className: stepTitleCls },
                    React.createElement("i", { className: "fa-solid fa-envelope text-[#38BDF8]" }),
                    " \u4FE1\u7BB1\u8207\u901A\u77E5"),
                React.createElement("p", { className: "text-sm text-[#94A3B8] mt-1" }, "\u8A2D\u5B9A\u516C\u958B\u5DE5\u5546\u4FE1\u7BB1\uFF0C\u624D\u6536\u5F97\u5230 Email \u9080\u7D04\u8207\u63D0\u9192\u3002")),
            React.createElement("div", { className: "bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-5" },
                React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" },
                    "\u516C\u958B\u5DE5\u5546\u4FE1\u7BB1 (\u9078\u586B)",
                    React.createElement("span", { className: "text-[#F59E0B] text-xs font-normal ml-2" }, "(\u26A0\uFE0F \u82E5\u60A8\u4E0D\u9A57\u8B49\u4FE1\u7BB1\uFF0C\u5C07\u7121\u6CD5\u5728\u4FE1\u7BB1\u6536\u5230\u4EFB\u4F55\u9080\u7D04\u8207\u63D0\u9192\u901A\u77E5\u5594\uFF01\u8ACB\u52FF\u586B\u5BEB\u79C1\u4EBA\u4FE1\u7BB1\u3002)")),
                React.createElement("div", { className: "flex flex-col sm:flex-row gap-2 items-stretch sm:items-start" },
                    React.createElement("div", { className: "flex-1" },
                        React.createElement("input", { type: "email", value: form.publicEmail || "", onChange: (e) => {
                                updateForm({ publicEmail: e.target.value, publicEmailVerified: false });
                                setOtpStatus("idle");
                            }, className: inputCls, placeholder: "\u4F8B\u5982\uFF1Abusiness@example.com" }),
                        form.publicEmailVerified && (React.createElement("p", { className: "text-[#22C55E] text-xs mt-1.5 font-bold" },
                            React.createElement("i", { className: "fa-solid fa-circle-check" }),
                            " \u4FE1\u7BB1\u5DF2\u9A57\u8B49"))),
                    !form.publicEmailVerified && form.publicEmail && form.publicEmail.includes("@") && (React.createElement("button", { type: "button", onClick: handleSendOtp, disabled: otpStatus === "sending", className: secondaryBtn + " text-xs whitespace-nowrap" }, otpStatus === "sending" ? React.createElement("i", { className: "fa-solid fa-spinner fa-spin" }) : "發送驗證信"))),
                otpStatus === "sent" && !form.publicEmailVerified && (React.createElement("div", { className: "mt-3 flex flex-col sm:flex-row gap-2 animate-fade-in-up" },
                    React.createElement("input", { type: "text", maxLength: "6", value: otpInput, onChange: (e) => setOtpInput(e.target.value), placeholder: "\u8F38\u51656\u4F4D\u6578\u9A57\u8B49\u78BC", className: inputCls + " text-center tracking-widest font-bold py-2" }),
                    React.createElement("button", { type: "button", onClick: handleVerifyOtp, className: successBtn + " whitespace-nowrap" }, "\u78BA\u8A8D")))),
            !isAdmin && (React.createElement("div", { className: "bg-[#38BDF8]/10 border border-[#38BDF8]/30 rounded-xl p-5" },
                React.createElement("h3", { className: "text-[#38BDF8] font-bold mb-2 flex items-center gap-2" },
                    React.createElement("i", { className: "fa-solid fa-shield-halved" }),
                    " \u771F\u4EBA\u8EAB\u5206\u9A57\u8B49 (\u9632\u5192\u7528)",
                    React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                React.createElement("p", { className: "text-xs text-[#CBD5E1] mb-4" },
                    "\u8ACB\u5C07\u300C",
                    React.createElement("span", { className: "text-white font-bold bg-[#181B25] px-1 rounded" }, "V-Nexus\u5BE9\u6838\u4E2D"),
                    "\u300D\u653E\u5165X\u6216Youtube\u7C21\u4ECB\u4E2D\uFF0C\u7BA1\u7406\u54E1\u5BE9\u6838\u5F8C\u5373\u53EF\u522A\u9664\u3002",
                    React.createElement("br", null),
                    React.createElement("span", { className: "text-[#F59E0B] font-bold" }, "\u8ACB\u5728\u4E0B\u65B9\u8F38\u5165\u60A8\u653E\u5165\u7684\u5E73\u53F0 X \u6216 YT")),
                React.createElement("input", { type: "text", value: form.verificationNote || "", placeholder: "\u8ACB\u8AAA\u660E\u60A8\u5728\u54EA\u500B\u5E73\u53F0\u7684\u7C21\u4ECB\u653E\u5165\u4E86\u9A57\u8B49\u6587\u5B57\uFF08\u4F8B\u5982\uFF1A\u5DF2\u653E\u81F3 X \u7C21\u4ECB\uFF09", onChange: (e) => updateForm({ verificationNote: e.target.value }), className: inputCls }))))),
        currentStepId === "preview" && (React.createElement("div", { className: panelCls },
            React.createElement("div", null,
                React.createElement("h3", { className: stepTitleCls },
                    React.createElement("i", { className: "fa-solid fa-eye text-[#8B5CF6]" }),
                    " \u9810\u89BD"),
                React.createElement("p", { className: "text-sm text-[#94A3B8] mt-1" }, "\u78BA\u8A8D\u8CC7\u6599\u5F8C\u5373\u53EF\u5132\u5B58\u540D\u7247\u3002")),
            React.createElement("div", { className: "bg-[#0F111A] border border-[#2A2F3D] rounded-2xl overflow-hidden" },
                React.createElement("div", { className: "h-32 bg-[#11131C] relative z-0" }, form.banner && React.createElement("img", { src: sanitizeUrl(form.banner), className: "w-full h-full object-cover opacity-80" })),
                React.createElement("div", { className: "relative z-10 p-5 pt-0" },
                    React.createElement("img", { src: sanitizeUrl(form.avatar), className: "relative z-20 block w-20 h-20 rounded-2xl object-cover border-4 border-[#0F111A] bg-[#181B25] -mt-10 shadow-sm" }),
                    React.createElement("div", { className: "mt-3" },
                        React.createElement("div", { className: "flex flex-wrap items-center gap-2" },
                            React.createElement("h3", { className: "text-xl font-extrabold text-white" }, form.name || "尚未填寫名稱"),
                            React.createElement("span", { className: "text-xs px-2 py-1 rounded-full bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30" }, form.activityStatus === "sleep" ? "🌙 暫時休息" : form.activityStatus === "graduated" ? "🕊️ 已畢業" : form.activityStatus === "creator" ? "🎨 繪師 / 建模師 / 剪輯師" : "🟢 開放聯動")),
                        React.createElement("p", { className: "text-sm text-[#94A3B8] mt-2 whitespace-pre-wrap" }, form.description || "這裡會顯示你的自我介紹。"),
                        React.createElement("div", { className: "flex flex-wrap gap-2 mt-4" },
                            (Array.isArray(form.collabTypes) ? form.collabTypes : []).slice(0, 4).map((tag) => (React.createElement("span", { key: tag, className: "text-xs px-2 py-1 rounded-full bg-[#8B5CF6]/10 text-[#C4B5FD] border border-[#8B5CF6]/20" }, tag))),
                            (Array.isArray(form.tags) ? form.tags : String(form.tags || "").split(",").map(t => t.trim()).filter(Boolean)).slice(0, 4).map((tag) => (React.createElement("span", { key: tag, className: "text-xs px-2 py-1 rounded-full bg-[#1D2130] text-[#CBD5E1] border border-[#2A2F3D]" }, tag))))))),
            React.createElement("div", { className: "bg-[#38BDF8]/10 border border-[#38BDF8]/30 rounded-xl p-4 text-sm text-[#BAE6FD]" },
                React.createElement("i", { className: "fa-solid fa-circle-info mr-2" }),
                "\u5132\u5B58\u5F8C\u5982\u679C\u662F\u65B0\u540D\u7247\u6216\u9000\u56DE\u4FEE\u6539\uFF0C\u6703\u91CD\u65B0\u9032\u5165\u5BE9\u6838\u6D41\u7A0B\u3002"))),
        React.createElement("div", { className: "sticky bottom-3 z-20 bg-[#0F111A]/95 backdrop-blur border border-[#2A2F3D] rounded-2xl p-3 shadow-sm" },
            React.createElement("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3" },
                React.createElement("div", { className: "min-w-0" },
                    React.createElement("p", { className: "text-[11px] text-[#94A3B8] font-bold tracking-wide uppercase" }, "\u540D\u7247\u7DE8\u8F2F"),
                    React.createElement("div", { className: "flex items-center gap-2 text-sm" },
                        React.createElement("span", { className: "text-white font-bold whitespace-nowrap" },
                            "\u7B2C ",
                            activeStep + 1,
                            " / ",
                            editorSteps.length,
                            " \u6B65"),
                        React.createElement("span", { className: "text-[#94A3B8] truncate" }, editorSteps[activeStep]?.label))),
                React.createElement("div", { className: "flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto" },
                    React.createElement("div", { className: "flex items-center gap-2 order-2 sm:order-1" },
                        onCancel && (React.createElement("button", { type: "button", onClick: onCancel, className: ghostBtn + " flex-1 sm:flex-none text-sm px-3" }, "\u53D6\u6D88")),
                        !isAdmin && onDeleteSelf && (React.createElement("button", { type: "button", onClick: onDeleteSelf, className: dangerBtn + " flex-1 sm:flex-none text-sm px-3" },
                            React.createElement("i", { className: "fa-solid fa-trash-can" }),
                            React.createElement("span", { className: "hidden sm:inline" }, "\u522A\u9664\u540D\u7247"),
                            React.createElement("span", { className: "sm:hidden" }, "\u522A\u9664")))),
                    React.createElement("div", { className: "grid grid-cols-3 gap-2 order-1 sm:order-2 w-full sm:w-auto" },
                        React.createElement("button", { type: "button", onClick: goPrevStep, disabled: isFirstStep, className: secondaryBtn + " text-sm px-2 sm:px-4 min-w-0" },
                            React.createElement("i", { className: "fa-solid fa-arrow-left" }),
                            React.createElement("span", null, "\u4E0A\u4E00\u6BB5")),
                        React.createElement("button", { type: "submit", className: (isLastStep ? successBtn : secondaryBtn) + " text-sm px-2 sm:px-4 min-w-0" },
                            React.createElement("i", { className: "fa-solid fa-floppy-disk" }),
                            React.createElement("span", { className: "hidden sm:inline" }, isAdmin ? "強制儲存更新" : "儲存名片"),
                            React.createElement("span", { className: "sm:hidden" }, "\u5132\u5B58")),
                        !isLastStep ? (React.createElement("button", { type: "button", onClick: goNextStep, className: primaryBtn + " text-sm px-2 sm:px-4 min-w-0" },
                            React.createElement("span", null, "\u4E0B\u4E00\u6BB5"),
                            React.createElement("i", { className: "fa-solid fa-arrow-right" }))) : (React.createElement("button", { type: "button", disabled: true, className: secondaryBtn + " text-sm px-2 sm:px-4 min-w-0 opacity-50 cursor-not-allowed" },
                            React.createElement("i", { className: "fa-solid fa-check" }),
                            React.createElement("span", null, "\u5B8C\u6210")))))))));
};
const InboxPage = ({ notifications, markAllAsRead, onMarkRead, onDelete, onDeleteAll, onNavigateProfile, onBraveResponse, onOpenChat, }) => {
    const [page, setPage] = useState(1);
    const itemsPerPage = 10;
    const totalPages = Math.ceil(notifications.length / itemsPerPage);
    const displayNotifications = notifications.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    useEffect(() => {
        if (page > totalPages && totalPages > 0)
            setPage(totalPages);
    }, [notifications.length, totalPages, page]);
    return (React.createElement("div", { className: "max-w-4xl mx-auto px-4 py-10 animate-fade-in-up" },
        React.createElement("div", { className: "flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 border-b border-[#2A2F3D] pb-4 gap-4" },
            React.createElement("div", null,
                React.createElement("h2", { className: "text-3xl font-extrabold text-white flex items-center gap-3" },
                    React.createElement("i", { className: "fa-solid fa-envelope-open-text text-[#A78BFA]" }),
                    " ",
                    "\u6211\u7684\u4FE1\u7BB1"),
                React.createElement("p", { className: "text-[#94A3B8] mt-2 text-sm" }, "\u60A8\u7684\u5C08\u5C6C\u901A\u77E5\u4E2D\u5FC3")),
            React.createElement("div", { className: "vnexus-commission-filter-scroll flex flex-nowrap sm:flex-wrap gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0" },
                notifications.some((n) => !n.read) && (React.createElement("button", { onClick: markAllAsRead, className: "text-sm font-bold text-[#A78BFA] bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 px-4 py-2 rounded-xl" },
                    React.createElement("i", { className: "fa-solid fa-check-double mr-1" }),
                    " \u5168\u90E8\u6A19\u793A\u70BA\u5DF2\u8B80")),
                notifications.length > 0 && (React.createElement("button", { onClick: onDeleteAll, className: "text-sm font-bold text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20 px-4 py-2 rounded-xl" },
                    React.createElement("i", { className: "fa-solid fa-trash-can mr-1" }),
                    " \u4E00\u9375\u522A\u9664\u5168\u90E8")))),
        notifications.length === 0 ? (React.createElement("div", { className: "text-center py-24 bg-[#181B25]/40 rounded-2xl border border-[#2A2F3D]/50 shadow-md" },
            React.createElement("i", { className: "fa-regular fa-envelope-open text-6xl text-gray-600 mb-6" }),
            React.createElement("p", { className: "text-[#94A3B8] font-bold text-lg" }, "\u4FE1\u7BB1\u76EE\u524D\u7A7A\u7A7A\u5982\u4E5F\uFF01"))) : (React.createElement("div", { className: "space-y-4" }, displayNotifications.map((n) => (React.createElement("div", { key: n.id, className: `p-5 sm:p-6 rounded-2xl border transition-all ${n.read ? "bg-[#181B25]/60 border-[#2A2F3D]" : "bg-[#181B25] border-white/10 shadow-sm"}` },
            React.createElement("div", { className: "flex items-start gap-4 sm:gap-5" },
                React.createElement("img", { src: sanitizeUrl(n.fromUserAvatar ||
                        "https://api.dicebear.com/7.x/avataaars/svg?seed=Anon"), onClick: () => onNavigateProfile(n.type === "collab_invite_sent" ? n.targetUserId : n.fromUserId), className: "w-14 h-14 rounded-full border border-[#2A2F3D] bg-[#0F111A] object-cover cursor-pointer hover:border-[#A78BFA]" }),
                React.createElement("div", { className: "col-span-2 xl:col-span-1 min-w-0" },
                    React.createElement("div", { className: "flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2" },
                        React.createElement("h4", { className: "font-bold text-white text-lg flex flex-wrap items-center gap-2" },
                            React.createElement("span", { onClick: () => onNavigateProfile(n.fromUserId), className: "cursor-pointer hover:text-[#A78BFA]" }, n.fromUserName),
                            !n.read && (React.createElement("span", { className: "bg-[#EF4444] text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap" }, "\u65B0\u901A\u77E5"))),
                        React.createElement("span", { className: "text-xs text-[#64748B] font-medium whitespace-nowrap" },
                            React.createElement("i", { className: "fa-regular fa-clock mr-1" }),
                            formatTime(n.createdAt))),
                    React.createElement("p", { className: "text-[#CBD5E1] text-sm leading-relaxed whitespace-pre-wrap bg-[#0F111A]/80 p-4 rounded-xl border border-[#2A2F3D]/50 mt-3" }, n.message),
                    n.type === "brave_invite" && !n.handled && (React.createElement("div", { className: "flex gap-3 mt-4 pt-4 border-t border-[#2A2F3D]/50" },
                        React.createElement("button", { onClick: () => onBraveResponse(n.id, n.fromUserId, true), className: "text-xs font-bold text-white bg-[#22C55E] hover:bg-[#22C55E] px-4 py-2 rounded-lg shadow-md transition-transform" },
                            React.createElement("i", { className: "fa-solid fa-check mr-1" }),
                            " \u53EF\u4EE5\u8A66\u8A66"),
                        React.createElement("button", { onClick: () => onBraveResponse(n.id, n.fromUserId, false), className: "text-xs font-bold text-[#CBD5E1] bg-[#1D2130] hover:bg-[#2A2F3D] px-4 py-2 rounded-lg shadow-md transition-transform" },
                            React.createElement("i", { className: "fa-solid fa-xmark mr-1" }),
                            " \u59D4\u5A49\u62D2\u7D55"))),
                    React.createElement("div", { className: "flex flex-wrap justify-end gap-3 mt-5" },
                        (n.type === "chat_notification" || n.type === "collab_invite") && (React.createElement("button", { onClick: () => onOpenChat(n), className: "text-xs font-bold text-white bg-[#8B5CF6] hover:bg-[#8B5CF6] px-4 py-2 rounded-lg flex items-center shadow-md transition-transform" },
                            React.createElement("i", { className: "fa-solid fa-comments mr-2" }),
                            " \u67E5\u770B\u804A\u5929\u5BA4")),
                        React.createElement("button", { onClick: () => onNavigateProfile(n.fromUserId), className: "text-xs font-bold text-[#CBD5E1] bg-[#1D2130] hover:bg-[#2A2F3D] px-4 py-2 rounded-lg flex items-center shadow-md" },
                            React.createElement("i", { className: "fa-solid fa-address-card mr-2" }),
                            " \u67E5\u770B\u540D\u7247"),
                        !n.read && (React.createElement("button", { onClick: () => onMarkRead(n.id), className: "text-xs font-bold text-[#A78BFA] bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 border border-white/10 px-4 py-2 rounded-lg flex items-center shadow-md" },
                            React.createElement("i", { className: "fa-solid fa-check mr-2" }),
                            " \u6A19\u70BA\u5DF2\u8B80")),
                        React.createElement("button", { onClick: () => onDelete(n.id), className: "text-xs font-bold text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/30 px-4 py-2 rounded-lg flex items-center shadow-md" },
                            React.createElement("i", { className: "fa-solid fa-trash mr-2" }),
                            " \u522A\u9664\u6B64\u4FE1"))))))))),
        totalPages > 1 && (React.createElement("div", { className: "flex justify-center items-center gap-4 mt-8" },
            React.createElement("button", { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1, className: `px-4 py-2 rounded-lg font-bold text-sm ${page === 1 ? "bg-[#181B25] text-gray-600 cursor-not-allowed" : "bg-[#1D2130] text-white hover:bg-[#2A2F3D]"}` }, "\u4E0A\u4E00\u9801"),
            React.createElement("span", { className: "text-[#94A3B8] text-sm font-bold" },
                "\u7B2C ",
                page,
                " / ",
                totalPages,
                " \u9801"),
            React.createElement("button", { onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages, className: `px-4 py-2 rounded-lg font-bold text-sm ${page === totalPages ? "bg-[#181B25] text-gray-600 cursor-not-allowed" : "bg-[#1D2130] text-white hover:bg-[#2A2F3D]"}` }, "\u4E0B\u4E00\u9801")))));
};
const CommissionPlanningPage = ({ navigate, realVtubers = [], onNavigateProfile, onOpenChat, mode = "creators" }) => {
    const { user, isAdmin, showToast } = useContext(AppContext);
    const isBoardOnly = mode === "board";
    const [activeTab, setActiveTab] = useState(() => {
        if (isBoardOnly)
            return "requests";
        return "creators";
    });
    const [activeRoleFilter, setActiveRoleFilter] = useState("All");
    const [activeCreatorStyleFilter, setActiveCreatorStyleFilter] = useState("All");
    const [creatorShuffleSeed, setCreatorShuffleSeed] = useState(0);
    const [commissionPage, setCommissionPage] = useState(1);
    const [requests, setRequests] = useState([]);
    const [requestFilter, setRequestFilter] = useState("All");
    const [requestStyleFilter, setRequestStyleFilter] = useState("All");
    const [requestPage, setRequestPage] = useState(1);
    const [isRequestFormOpen, setIsRequestFormOpen] = useState(false);
    const [requestForm, setRequestForm] = useState({ id: null, title: "", description: "", requestType: "繪圖", budgetRange: "歡迎私訊報價", deadline: "", styles: [], styleOtherText: "", referenceUrl: "" });
    const roleFilters = ["All", "繪師", "建模師", "剪輯師"];
    const creatorStyleFilters = ["All", ...CREATOR_STYLE_OPTIONS];
    const requestFilters = ["All", "繪圖", "建模", "剪輯"];
    const requestStyleFilters = ["All", ...CREATOR_STYLE_OPTIONS];
    const COMMISSION_PAGE_SIZE = 12;
    const REQUEST_PAGE_SIZE = 12;
    const commissionTopRef = useRef(null);
    const scrollCommissionPageTop = () => {
        const top = commissionTopRef.current
            ? commissionTopRef.current.getBoundingClientRect().top + window.pageYOffset - 88
            : 0;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    };
    const goCommissionCreatorPage = (nextPage) => {
        setCommissionPage(Math.max(1, Math.min(totalCommissionPages, nextPage)));
        setTimeout(scrollCommissionPageTop, 0);
    };
    const goCommissionRequestPage = (nextPage) => {
        setRequestPage(Math.max(1, Math.min(totalRequestPages, nextPage)));
        setTimeout(scrollCommissionPageTop, 0);
    };
    const getCommissionShuffleWeight = (id, seed) => {
        const text = `${id || "creator"}_${seed || 0}`;
        let hash = 2166136261;
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0) / 4294967295;
    };
    useEffect(() => { setCommissionPage(1); }, [activeRoleFilter, activeCreatorStyleFilter]);
    useEffect(() => { setRequestPage(1); }, [requestFilter, requestStyleFilter]);
    useEffect(() => {
        const q = query(collection(db, getPath("commission_requests")), orderBy("createdAt", "desc"), limit(80));
        const unsub = onSnapshot(q, (snap) => setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), (err) => console.warn("委託佈告欄讀取失敗:", err));
        return () => unsub();
    }, []);
    const creatorList = (Array.isArray(realVtubers) ? realVtubers : []).filter((v) => v && v.isVerified && !v.isBlacklisted && Array.isArray(v.creatorRoles) && v.creatorRoles.length > 0 && !String(v.id || "").startsWith("mock")).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    const filteredCreatorList = creatorList.filter((v) => {
        const roles = Array.isArray(v.creatorRoles) ? v.creatorRoles : [];
        const styles = Array.isArray(v.creatorStyles) ? v.creatorStyles : [];
        const roleOk = activeRoleFilter === "All" || roles.includes(activeRoleFilter);
        const styleOk = activeCreatorStyleFilter === "All" || styles.includes(activeCreatorStyleFilter);
        return roleOk && styleOk;
    });
    const shuffledCreatorList = creatorShuffleSeed
        ? [...filteredCreatorList].sort((a, b) => getCommissionShuffleWeight(a.id, creatorShuffleSeed) - getCommissionShuffleWeight(b.id, creatorShuffleSeed))
        : filteredCreatorList;
    const totalCommissionPages = Math.max(1, Math.ceil(shuffledCreatorList.length / COMMISSION_PAGE_SIZE));
    const safeCommissionPage = Math.min(commissionPage, totalCommissionPages);
    const pagedCreatorList = shuffledCreatorList.slice((safeCommissionPage - 1) * COMMISSION_PAGE_SIZE, safeCommissionPage * COMMISSION_PAGE_SIZE);
    const filteredRequests = (requests || []).filter((r) => {
        if (!r || r.status === "closed")
            return false;
        const typeOk = requestFilter === "All" || r.requestType === requestFilter || (Array.isArray(r.requestTypes) && r.requestTypes.includes(requestFilter));
        const styles = Array.isArray(r.styles) ? r.styles : [];
        const styleOk = requestStyleFilter === "All" || styles.includes(requestStyleFilter);
        return typeOk && styleOk;
    });
    const totalRequestPages = Math.max(1, Math.ceil(filteredRequests.length / REQUEST_PAGE_SIZE));
    const safeRequestPage = Math.min(requestPage, totalRequestPages);
    const pagedRequests = filteredRequests.slice((safeRequestPage - 1) * REQUEST_PAGE_SIZE, safeRequestPage * REQUEST_PAGE_SIZE);
    const openProfile = (v) => { if (onNavigateProfile)
        onNavigateProfile(v);
    else
        navigate(`profile/${v.id}`); };
    const openPortfolio = (url) => { if (!url)
        return; const raw = String(url).trim(); const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`; window.open(sanitizeUrl(normalized), "_blank", "noopener,noreferrer"); };
    const resetRequestForm = () => setRequestForm({ id: null, title: "", description: "", requestType: "繪圖", budgetRange: "歡迎私訊報價", deadline: "", styles: [], styleOtherText: "", referenceUrl: "" });
    const handleSaveRequest = async () => {
        if (!user)
            return showToast("請先登入");
        if (!requestForm.title.trim() || !requestForm.description.trim())
            return showToast("請填寫委託標題與需求說明");
        const selectedRequestStyles = Array.isArray(requestForm.styles) ? requestForm.styles : [];
        if (selectedRequestStyles.includes(REQUEST_STYLE_OTHER) && !String(requestForm.styleOtherText || "").trim())
            return showToast("請填寫其他喜歡的風格，或取消勾選其他。");
        const deadlineAt = requestForm.deadline ? new Date(`${requestForm.deadline}T23:59:59`).getTime() : null;
        const payload = { userId: user.uid, title: requestForm.title.trim(), description: requestForm.description.trim(), requestType: requestForm.requestType || "其他", budgetRange: requestForm.budgetRange || "歡迎私訊報價", deadline: Number.isFinite(deadlineAt) ? deadlineAt : null, deadlineDate: requestForm.deadline || "", styles: selectedRequestStyles.slice(0, 12), styleOtherText: String(requestForm.styleOtherText || "").trim().slice(0, 80), referenceUrl: requestForm.referenceUrl.trim(), status: "open", updatedAt: Date.now() };
        try {
            if (requestForm.id) {
                await setDoc(doc(db, getPath("commission_requests"), requestForm.id), payload, { merge: true });
                showToast("✅ 委託需求已更新");
            }
            else {
                await addDoc(collection(db, getPath("commission_requests")), { ...payload, applicants: [], createdAt: Date.now() });
                showToast("✅ 委託需求已發布");
            }
            resetRequestForm();
            setIsRequestFormOpen(false);
        }
        catch (err) {
            console.error("委託需求儲存失敗:", err);
            showToast(`❌ 儲存失敗：${err.code || err.message || "請稍後再試"}`);
        }
    };
    const handleEditRequest = (r) => { setRequestForm({ id: r.id, title: r.title || "", description: r.description || "", requestType: r.requestType || "繪圖", budgetRange: r.budgetRange || "歡迎私訊報價", deadline: r.deadlineDate || (r.deadline ? new Date(r.deadline).toISOString().slice(0, 10) : ""), styles: Array.isArray(r.styles) ? r.styles : [], styleOtherText: r.styleOtherText || "", referenceUrl: r.referenceUrl || "" }); setIsRequestFormOpen(true); setActiveTab("requests"); window.scrollTo({ top: 0, behavior: "smooth" }); };
    const handleDeleteRequest = async (id) => { if (!confirm("確定要刪除這則委託需求嗎？"))
        return; try {
        await deleteDoc(doc(db, getPath("commission_requests"), id));
        showToast("✅ 已刪除委託需求");
    }
    catch (err) {
        console.error("委託需求刪除失敗:", err);
        showToast("刪除失敗");
    } };
    const handleApplyRequest = async (r) => {
        if (!user)
            return showToast("請先登入");
        if (r.userId === user.uid)
            return showToast("這是你發布的需求");
        const applicants = Array.isArray(r.applicants) ? r.applicants : [];
        const isApplying = !applicants.includes(user.uid);
        if (isApplying && applicants.length >= 5)
            return showToast("這則委託已達 5 名提案人上限");
        try {
            const applyCommissionRequest = httpsCallable(functionsInstance, "applyCommissionRequest");
            const result = await applyCommissionRequest({ requestId: r.id, action: isApplying ? "apply" : "cancel" });
            showToast(result?.data?.message || (isApplying ? "✅ 已送出接案意願，請等待發案人挑選" : "已取消接案意願"));
        }
        catch (err) {
            console.error("接案意願更新失敗:", err);
            showToast(err?.message || "操作失敗，請稍後再試");
        }
    };
    const authorOf = (uid) => (realVtubers || []).find((v) => v.id === uid);
    return (React.createElement("div", { ref: commissionTopRef, className: "vnexus-commission-page max-w-6xl mx-auto px-4 py-6 sm:py-10 animate-fade-in-up min-h-[100dvh] overflow-x-hidden" },
        React.createElement("div", { className: "vnexus-commission-hero mb-5 sm:mb-8 bg-[#181B25] border border-[#2A2F3D] rounded-2xl p-4 sm:p-8 shadow-sm" },
            React.createElement("p", { className: "text-[10px] sm:text-xs font-bold text-[#38BDF8] tracking-[0.18em] uppercase mb-2 sm:mb-3" }, isBoardOnly ? "Commission Board" : "Creator Market"),
            React.createElement("div", { className: "flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 sm:gap-5" },
                React.createElement("div", null,
                    React.createElement("div", { className: "flex items-center justify-between gap-3 mb-2 sm:mb-3" },
                        React.createElement("h2", { className: "text-2xl sm:text-4xl font-extrabold text-white min-w-0" }, isBoardOnly ? "委託佈告欄" : "繪師 / 建模師 / 剪輯師委託專區"),
                        isBoardOnly && (React.createElement("button", { onClick: () => navigate("commissions"), className: "sm:hidden inline-flex items-center justify-center bg-[#1D2130] hover:bg-[#2A2F3D] text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex-shrink-0" }, "\u627E\u5275\u4F5C\u8005"))),
                    React.createElement("p", { className: "text-[#94A3B8] max-w-2xl leading-relaxed text-sm sm:text-base" }, isBoardOnly ? "想找繪圖、建模、剪輯找不到人？來佈告欄表達需求，老師們可能就會找上你哦！" : "找作品集、看檔期，快速比較繪師、建模師與剪輯師的名片資料。")),
                React.createElement("div", { className: "vnexus-commission-hero-actions grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3" }, isBoardOnly ? (React.createElement(React.Fragment, null,
                    React.createElement("button", { onClick: () => navigate("commissions"), className: "hidden sm:inline-flex items-center justify-center bg-[#1D2130] hover:bg-[#2A2F3D] text-white px-5 py-3 rounded-xl font-bold transition-colors whitespace-nowrap" }, "\u627E\u5275\u4F5C\u8005"))) : (React.createElement(React.Fragment, null,
                    React.createElement("button", { onClick: () => { navigate("dashboard"); setTimeout(() => { document.getElementById("creator-service-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 180); setTimeout(() => { document.getElementById("creator-service-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 650); }, className: "inline-flex items-center justify-center bg-[#1D2130] hover:bg-[#2A2F3D] text-white px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-bold transition-colors whitespace-nowrap" }, "\u88DC\u4E0A\u5275\u4F5C\u6280\u80FD"),
                    React.createElement("button", { onClick: () => navigate("commission-board"), className: "inline-flex items-center justify-center bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-bold transition-colors whitespace-nowrap" }, "\u59D4\u8A17\u4F48\u544A\u6B04")))))),
        !isBoardOnly && false && (React.createElement("div", { className: "mb-6 flex gap-2 bg-[#11131C] border border-[#2A2F3D] p-1 rounded-2xl w-fit" },
            React.createElement("button", { onClick: () => setActiveTab("creators"), className: `px-4 py-2 rounded-xl text-sm font-extrabold transition-colors ${activeTab === "creators" ? "bg-[#38BDF8] text-[#0F111A]" : "text-[#94A3B8] hover:text-white"}` }, "\u627E\u5275\u4F5C\u8005"),
            React.createElement("button", { onClick: () => setActiveTab("requests"), className: `px-4 py-2 rounded-xl text-sm font-extrabold transition-colors ${activeTab === "requests" ? "bg-[#8B5CF6] text-white" : "text-[#94A3B8] hover:text-white"}` }, "\u59D4\u8A17\u4F48\u544A\u6B04"))),
        !isBoardOnly && activeTab === "creators" && React.createElement(React.Fragment, null,
            React.createElement("div", { className: "vnexus-commission-controls mb-4 sm:mb-6 bg-[#11131C] border border-[#2A2F3D] rounded-2xl p-2.5 sm:p-5" },
                React.createElement("div", { className: "vnexus-commission-controls-grid grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_320px_auto] items-end gap-2.5 sm:gap-4" },
                    React.createElement("div", { className: "col-span-2 sm:col-span-1 min-w-0" },
                        React.createElement("p", { className: "text-[10px] sm:text-xs font-bold text-[#94A3B8] mb-1.5 sm:mb-2 tracking-widest uppercase" }, "\u5275\u4F5C\u8005\u8EAB\u4EFD"),
                        React.createElement("div", { className: "vnexus-commission-role-row flex flex-nowrap sm:flex-wrap gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-0.5 px-0.5" }, roleFilters.map((role) => React.createElement("button", { key: role, onClick: () => setActiveRoleFilter(role), className: `px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-sm font-bold border transition-colors whitespace-nowrap flex-shrink-0 ${activeRoleFilter === role ? "bg-[#38BDF8] text-[#0F111A] border-[#38BDF8]" : "bg-[#181B25] text-[#CBD5E1] border-[#2A2F3D] hover:bg-[#1D2130]"}` }, role === "All" ? "全部" : role)))),
                    React.createElement("div", { className: "min-w-0" },
                        React.createElement("label", { className: "block text-[10px] sm:text-xs font-bold text-[#94A3B8] mb-1.5 sm:mb-2 tracking-widest uppercase" }, "\u9032\u968E\u98A8\u683C\u7BE9\u9078"),
                        React.createElement("select", { value: activeCreatorStyleFilter, onChange: (e) => setActiveCreatorStyleFilter(e.target.value), className: "w-full h-[34px] sm:h-[42px] bg-[#181B25] border border-[#2A2F3D] text-white rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 outline-none focus:border-[#38BDF8] text-xs sm:text-base" }, creatorStyleFilters.map((style) => React.createElement("option", { key: style, value: style }, style === "All" ? "全部創作風格 / 類型" : style)))),
                    React.createElement("button", { type: "button", onClick: () => {
                            setCreatorShuffleSeed(Date.now());
                            setCommissionPage(1);
                            showToast("🎲 已重新洗牌創作者順序");
                        }, className: "vnexus-commission-shuffle h-[34px] sm:h-[42px] bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#0F111A] px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl font-extrabold transition-colors whitespace-nowrap flex-shrink-0 inline-flex items-center justify-center gap-1.5 text-xs sm:text-base justify-self-end self-end col-start-2 sm:col-start-auto mt-1 sm:mt-0" },
                        React.createElement("i", { className: "fa-solid fa-shuffle" }),
                        React.createElement("span", { className: "sm:hidden" }, "\u6D17\u724C"),
                        React.createElement("span", { className: "hidden sm:inline" }, "\u91CD\u65B0\u6D17\u724C")))),
            creatorList.length === 0 ? React.createElement("div", { className: "bg-[#181B25] border border-dashed border-[#2A2F3D] rounded-2xl p-8 text-center" },
                React.createElement("p", { className: "text-white text-lg font-bold mb-2" }, "\u76EE\u524D\u9084\u6C92\u6709\u7E6A\u5E2B / \u5EFA\u6A21\u5E2B / \u526A\u8F2F\u5E2B\u540D\u7247"),
                React.createElement("p", { className: "text-[#94A3B8] text-sm mb-5" }, "\u5982\u679C\u4F60\u6703\u7E6A\u5716\u3001\u5EFA\u6A21\u6216\u526A\u8F2F\uFF0C\u53EF\u4EE5\u5148\u5230\u540D\u7247\u7DE8\u8F2F\u4E2D\u52FE\u9078\u8EAB\u4EFD\uFF0C\u8B93\u5176\u4ED6 VTuber \u66F4\u5BB9\u6613\u627E\u5230\u4F60\u3002"),
                React.createElement("button", { onClick: () => navigate("dashboard"), className: "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 py-2.5 rounded-xl font-bold transition-colors" }, "\u53BB\u88DC\u4E0A\u8EAB\u4EFD")) : filteredCreatorList.length === 0 ? React.createElement("div", { className: "bg-[#181B25] border border-dashed border-[#2A2F3D] rounded-2xl p-8 text-center" },
                React.createElement("p", { className: "text-white text-lg font-bold mb-2" }, "\u76EE\u524D\u6C92\u6709\u7B26\u5408\u7BE9\u9078\u689D\u4EF6\u7684\u5275\u4F5C\u8005"),
                React.createElement("p", { className: "text-[#94A3B8] text-sm" }, "\u53EF\u4EE5\u5207\u63DB\u8EAB\u4EFD\u6216\u5275\u4F5C\u98A8\u683C / \u985E\u578B\uFF0C\u4E4B\u5F8C\u4E5F\u53EF\u4EE5\u518D\u56DE\u4F86\u770B\u770B\u65B0\u7684\u59D4\u8A17\u540D\u7247\u3002")) : React.createElement(React.Fragment, null,
                React.createElement("div", { className: "vnexus-commission-result-count mb-4 flex items-center justify-end gap-2 text-sm text-[#94A3B8]" },
                    React.createElement("p", { className: "text-xs" },
                        "\u76EE\u524D\u986F\u793A ",
                        pagedCreatorList.length,
                        " \u4F4D / \u5171 ",
                        filteredCreatorList.length,
                        " \u4F4D\u5275\u4F5C\u8005")),
                React.createElement("div", { className: "vnexus-commission-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch" }, pagedCreatorList.map((v, idx) => {
                    const showcase = sanitizeUrl(v.banner || v.avatar || "");
                    const roles = Array.isArray(v.creatorRoles) ? v.creatorRoles : [];
                    const creatorStyles = Array.isArray(v.creatorStyles) ? v.creatorStyles : [];
                    const creatorStatus = v.creatorStatus || "";
                    const creatorBudgetRange = normalizeCreatorBudgetRange(v.creatorBudgetRange);
                    const displayStyles = creatorStyles.length > 0 ? creatorStyles : (Array.isArray(v.tags) ? v.tags : []);
                    return React.createElement(React.Fragment, { key: v.id },
                        React.createElement("article", { onClick: () => openProfile(v), className: "flex vnexus-creator-market-card vnexus-critical-card group bg-[#181B25] border border-[#2A2F3D] rounded-[1.5rem] overflow-hidden shadow-sm hover:border-[#38BDF8]/60 hover:shadow-xl hover:shadow-[#38BDF8]/10 transition-all cursor-pointer h-full flex-col will-change-auto", title: "\u67E5\u770B\u8A73\u7D30\u540D\u7247" },
                            React.createElement("div", { className: "vnexus-critical-visual aspect-square h-auto bg-[#11131C] relative overflow-hidden" },
                                showcase ? React.createElement("img", { src: showcase, alt: v.name || "作品展示", className: "vnexus-creator-showcase-img vnexus-critical-showcase w-full h-full object-cover opacity-90 sm:group-hover:scale-105 sm:group-hover:opacity-100 transition-opacity sm:transition-all duration-300 sm:duration-500", onError: (e) => setImageToGrayPlaceholder(e.currentTarget) }) : null,
                                !showcase && React.createElement("div", { className: "w-full h-full flex flex-col items-center justify-center text-[#64748B] text-sm bg-gradient-to-br from-[#11131C] to-[#1D2130]" },
                                    React.createElement("i", { className: "fa-solid fa-image text-3xl mb-3 opacity-60" }),
                                    "\u4F5C\u54C1\u5C55\u793A\u5340\u898F\u5283\u4E2D"),
                                React.createElement("div", { className: "vnexus-critical-gradient absolute inset-0 bg-gradient-to-t from-[#0F111A] via-[#0F111A]/65 sm:via-[#0F111A]/15 to-transparent z-[1]" }),
                                React.createElement("div", { className: "vnexus-critical-top-badges absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 flex items-start justify-between gap-2 z-[2]" },
                                    React.createElement("div", { className: "vnexus-critical-role-list flex flex-wrap gap-1.5 sm:gap-2 min-w-0 pr-1" }, roles.map((role) => React.createElement("span", { key: role, className: "vnexus-critical-role-badge bg-[#38BDF8] text-[#0F111A] px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-extrabold shadow-sm" }, role))),
                                    creatorStatus && React.createElement("span", { className: "vnexus-critical-status-badge bg-[#22C55E]/90 text-[#052E16] px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-black shadow-sm whitespace-nowrap" }, creatorStatus)),
                                React.createElement("div", { className: "vnexus-critical-profile-row absolute left-3 sm:left-4 right-3 sm:right-4 bottom-3 sm:bottom-4 z-[2]" },
                                    React.createElement("div", { className: "flex items-end gap-3" },
                                        React.createElement("div", { className: "vnexus-critical-avatar w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#11131C] border border-white/20 overflow-hidden flex-shrink-0 shadow-lg" }, v.avatar ? React.createElement("img", { src: sanitizeUrl(v.avatar), alt: v.name || "創作者頭像", className: "vnexus-critical-avatar-img w-full h-full object-cover", onError: (e) => setImageToGrayPlaceholder(e.currentTarget) }) : null),
                                        React.createElement("div", { className: "min-w-0 flex-1" },
                                            React.createElement("h3", { className: "vnexus-critical-name text-white text-xl sm:text-xl font-black truncate flex items-center gap-2 drop-shadow leading-tight" },
                                                v.name || "未命名創作者",
                                                v.isVerified && React.createElement("span", { className: "vnexus-critical-verified text-[#22C55E] text-xs font-bold bg-black/40 px-2 py-0.5 rounded-full flex-shrink-0" }, "\u5DF2\u8A8D\u8B49")),
                                            React.createElement("p", { className: "vnexus-critical-meta text-[#BAE6FD] text-xs font-bold mt-1 truncate" },
                                                roles.join(" / ") || "創作服務",
                                                creatorBudgetRange ? `｜${creatorBudgetRange}` : ""))))),
                            React.createElement("div", { className: "vnexus-critical-body p-5 flex-1 flex flex-col" },
                                React.createElement("p", { className: "vnexus-critical-description block text-[#CBD5E1] text-sm sm:text-sm leading-relaxed line-clamp-4 sm:line-clamp-3 mb-4 min-h-[4rem]" }, v.description || "尚未填寫作品與委託說明，先看看他的名片了解更多。"),
                                React.createElement("div", { className: "vnexus-critical-style-tags flex flex-nowrap gap-2 mb-4 overflow-hidden min-h-[1.75rem]", title: displayStyles.length > 0 ? displayStyles.map((style) => style === "其他(自由填寫)" && v.creatorOtherStyleText ? v.creatorOtherStyleText : style).join("、") : "尚未填寫風格" },
                                    displayStyles.slice(0, 4).map((style) => React.createElement("span", { key: style, className: "bg-[#11131C] border border-[#2A2F3D] text-[#CBD5E1] px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 max-w-[7.5rem] truncate" }, style === "其他(自由填寫)" && v.creatorOtherStyleText ? v.creatorOtherStyleText : style)),
                                    displayStyles.length > 4 && React.createElement("span", { className: "bg-[#38BDF8]/10 border border-[#38BDF8]/30 text-[#7DD3FC] px-2.5 py-1 rounded-full text-xs font-black whitespace-nowrap flex-shrink-0" },
                                        "+",
                                        displayStyles.length - 4),
                                    displayStyles.length === 0 && React.createElement("span", { className: "bg-[#11131C] border border-[#2A2F3D] text-[#64748B] px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0" }, "\u5C1A\u672A\u586B\u5BEB\u98A8\u683C")),
                                React.createElement("div", { className: "vnexus-critical-actions mt-auto grid grid-cols-2 gap-2" },
                                    React.createElement("button", { onClick: (e) => { e.stopPropagation(); onOpenChat ? onOpenChat(v) : openProfile(v); }, className: "vnexus-critical-primary-btn bg-[#8B5CF6] hover:bg-[#7C3AED] text-white py-3 sm:py-2 rounded-xl sm:rounded-lg font-bold transition-colors text-sm sm:text-xs inline-flex items-center justify-center gap-1.5" },
                                        React.createElement("i", { className: "fa-regular fa-comment-dots" }),
                                        "\u79C1\u8A0A\u6A94\u671F"),
                                    React.createElement("button", { onClick: (e) => { e.stopPropagation(); v.creatorPortfolioUrl ? openPortfolio(v.creatorPortfolioUrl) : openProfile(v); }, className: `vnexus-critical-secondary-btn ${v.creatorPortfolioUrl ? "bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#0F111A]" : "bg-[#1D2130] text-[#94A3B8]"} py-3 sm:py-2 rounded-xl sm:rounded-lg font-bold transition-colors text-sm sm:text-xs inline-flex items-center justify-center gap-1.5` },
                                        React.createElement("i", { className: "fa-solid fa-images" }),
                                        "\u89C0\u770B\u4F5C\u54C1\u96C6")))));
                })),
                filteredCreatorList.length > COMMISSION_PAGE_SIZE && React.createElement("div", { className: "mt-8 flex items-center justify-center gap-3" },
                    React.createElement("button", { onClick: () => goCommissionCreatorPage(safeCommissionPage - 1), disabled: safeCommissionPage === 1, className: `px-4 py-2 rounded-lg font-bold text-sm ${safeCommissionPage === 1 ? "bg-[#181B25] text-gray-600 cursor-not-allowed" : "bg-[#1D2130] text-white hover:bg-[#2A2F3D]"}` }, "\u4E0A\u4E00\u9801"),
                    React.createElement("span", { className: "text-[#94A3B8] text-sm font-bold" },
                        "\u7B2C ",
                        safeCommissionPage,
                        " / ",
                        totalCommissionPages,
                        " \u9801"),
                    React.createElement("button", { onClick: () => goCommissionCreatorPage(safeCommissionPage + 1), disabled: safeCommissionPage === totalCommissionPages, className: `px-4 py-2 rounded-lg font-bold text-sm ${safeCommissionPage === totalCommissionPages ? "bg-[#181B25] text-gray-600 cursor-not-allowed" : "bg-[#1D2130] text-white hover:bg-[#2A2F3D]"}` }, "\u4E0B\u4E00\u9801")))),
        isBoardOnly && activeTab === "requests" && React.createElement("div", { className: "space-y-6" },
            React.createElement("div", { className: "bg-[#11131C] border border-[#2A2F3D] rounded-2xl p-4 sm:p-5" },
                React.createElement("div", { className: "grid grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_320px_auto] xl:items-end xl:justify-between gap-3 sm:gap-4" },
                    React.createElement("div", { className: "col-span-2 xl:col-span-1 min-w-0" },
                        React.createElement("p", { className: "text-xs font-bold text-[#94A3B8] mb-2 tracking-widest uppercase" }, "\u4E3B\u8981\u5206\u985E"),
                        React.createElement("div", { className: "flex flex-wrap gap-2" }, requestFilters.map((type) => React.createElement("button", { key: type, onClick: () => setRequestFilter(type), className: `px-4 py-2 rounded-full text-sm font-bold border transition-colors ${requestFilter === type ? "bg-[#8B5CF6] text-white border-[#8B5CF6]" : "bg-[#181B25] text-[#CBD5E1] border-[#2A2F3D] hover:bg-[#1D2130]"}` }, type === "All" ? "全部需求" : type)))),
                    React.createElement("div", { className: "min-w-0" },
                        React.createElement("label", { className: "block text-xs font-bold text-[#94A3B8] mb-2 tracking-widest uppercase" }, "\u9032\u968E\u98A8\u683C\u7BE9\u9078"),
                        React.createElement("select", { value: requestStyleFilter, onChange: (e) => setRequestStyleFilter(e.target.value), className: "w-full h-[42px] bg-[#181B25] border border-[#2A2F3D] text-white rounded-xl px-3 sm:px-4 py-2 outline-none focus:border-[#8B5CF6] text-xs sm:text-base" }, requestStyleFilters.map((style) => React.createElement("option", { key: style, value: style }, style === "All" ? "全部創作風格 / 類型" : style)))),
                    React.createElement("button", { onClick: () => { resetRequestForm(); setIsRequestFormOpen(!isRequestFormOpen); }, className: "h-[34px] sm:h-[42px] bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl font-bold transition-colors whitespace-nowrap flex-shrink-0 text-xs sm:text-base justify-self-end self-end col-start-2 sm:col-start-auto mt-1 sm:mt-0" }, isRequestFormOpen ? "收起需求表單" : "發布委託需求"))),
            isRequestFormOpen && (React.createElement("div", { className: "bg-[#181B25] border border-[#2A2F3D] rounded-2xl p-5 sm:p-6 shadow-sm" },
                React.createElement("h3", { className: "text-white text-xl font-extrabold mb-5" }, requestForm.id ? "編輯委託需求" : "發布新的委託需求"),
                React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4" },
                    React.createElement("div", { className: "md:col-span-3" },
                        React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u9700\u6C42\u6A19\u984C *"),
                        React.createElement("input", { value: requestForm.title, onChange: (e) => setRequestForm({ ...requestForm, title: e.target.value }), className: inputCls, placeholder: "\u4F8B\u5982\uFF1A\u60F3\u627E\u53EF\u611B\u98A8\u683C\u982D\u8CBC\u7E6A\u5E2B" })),
                    React.createElement("div", null,
                        React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u9700\u6C42\u985E\u578B"),
                        React.createElement("select", { value: requestForm.requestType, onChange: (e) => setRequestForm({ ...requestForm, requestType: e.target.value }), className: inputCls }, ["繪圖", "建模", "剪輯", "其他"].map((x) => React.createElement("option", { key: x, value: x }, x)))),
                    React.createElement("div", null,
                        React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u9810\u7B97\u5340\u9593"),
                        React.createElement("select", { value: requestForm.budgetRange, onChange: (e) => setRequestForm({ ...requestForm, budgetRange: e.target.value }), className: inputCls }, REQUEST_BUDGET_OPTIONS.map((x) => React.createElement("option", { key: x, value: x }, x)))),
                    React.createElement("div", null,
                        React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u5E0C\u671B\u5B8C\u6210\u65E5\u671F"),
                        React.createElement("input", { type: "date", value: requestForm.deadline, onChange: (e) => setRequestForm({ ...requestForm, deadline: e.target.value }), className: inputCls })),
                    React.createElement("div", { className: "md:col-span-3" },
                        React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-3" },
                            "\u559C\u6B61\u7684\u98A8\u683C ",
                            React.createElement("span", { className: "text-[#94A3B8] text-xs font-normal" }, "\u53EF\u591A\u9078")),
                        React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2" }, CREATOR_STYLE_OPTIONS.map((style) => {
                            const checked = Array.isArray(requestForm.styles) && requestForm.styles.includes(style);
                            return (React.createElement("label", { key: style, className: "flex items-center gap-2 cursor-pointer rounded-xl border px-3 py-2 transition-colors " + (checked ? "bg-[#8B5CF6]/10 border-[#8B5CF6]/40 text-[#C4B5FD]" : "bg-[#11131C] border-[#2A2F3D] text-[#CBD5E1] hover:bg-[#1D2130]") },
                                React.createElement("input", { type: "checkbox", checked: checked, onChange: () => {
                                        const current = Array.isArray(requestForm.styles) ? requestForm.styles : [];
                                        const next = checked ? current.filter((x) => x !== style) : [...current, style].slice(0, 12);
                                        setRequestForm({ ...requestForm, styles: next });
                                    }, className: "accent-purple-500 w-4 h-4" }),
                                React.createElement("span", { className: "text-sm font-bold" }, style)));
                        })),
                        Array.isArray(requestForm.styles) && requestForm.styles.includes(REQUEST_STYLE_OTHER) && (React.createElement("input", { value: requestForm.styleOtherText || "", onChange: (e) => setRequestForm({ ...requestForm, styleOtherText: e.target.value }), className: inputCls + " mt-3", placeholder: "\u8ACB\u586B\u5BEB\u5176\u4ED6\u559C\u6B61\u7684\u98A8\u683C" }))),
                    React.createElement("div", { className: "md:col-span-3" },
                        React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u53C3\u8003\u9023\u7D50"),
                        React.createElement("input", { value: requestForm.referenceUrl, onChange: (e) => setRequestForm({ ...requestForm, referenceUrl: e.target.value }), className: inputCls, placeholder: "\u53EF\u653E\u53C3\u8003\u5716\u3001\u5F71\u7247\u6216 Notion / X / Google Drive \u9023\u7D50" })),
                    React.createElement("div", { className: "md:col-span-3" },
                        React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" }, "\u9700\u6C42\u8AAA\u660E *"),
                        React.createElement("textarea", { value: requestForm.description, onChange: (e) => setRequestForm({ ...requestForm, description: e.target.value }), className: inputCls + " min-h-[140px]", placeholder: "\u7C21\u55AE\u63CF\u8FF0\u4F60\u60F3\u505A\u4EC0\u9EBC\u3001\u7528\u9014\u3001\u5E0C\u671B\u98A8\u683C\u8207\u6CE8\u610F\u4E8B\u9805\u3002" }))),
                React.createElement("div", { className: "flex flex-col sm:flex-row justify-end gap-3 mt-5" },
                    React.createElement("button", { onClick: () => { resetRequestForm(); setIsRequestFormOpen(false); }, className: "bg-[#1D2130] hover:bg-[#2A2F3D] text-white px-5 py-3 rounded-xl font-bold" }, "\u53D6\u6D88"),
                    React.createElement("button", { onClick: handleSaveRequest, className: "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-6 py-3 rounded-xl font-bold" }, requestForm.id ? "儲存修改" : "發布需求")))),
            filteredRequests.length === 0 ? (React.createElement("div", { className: "bg-[#181B25] border border-dashed border-[#2A2F3D] rounded-2xl p-8 text-center" },
                React.createElement("p", { className: "text-white text-lg font-bold mb-2" }, "\u9084\u6C92\u6709\u59D4\u8A17\u9700\u6C42"),
                React.createElement("p", { className: "text-[#94A3B8] text-sm mb-5" }, "\u6709\u982D\u8CBC\u3001\u7ACB\u7E6A\u3001\u5EFA\u6A21\u6216\u526A\u8F2F\u9700\u6C42\u55CE\uFF1F\u767C\u4E00\u5247\u9700\u6C42\uFF0C\u8B93\u5275\u4F5C\u8005\u66F4\u5BB9\u6613\u770B\u898B\u4F60\u3002"),
                React.createElement("button", { onClick: () => setIsRequestFormOpen(true), className: "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 py-2.5 rounded-xl font-bold" }, "\u767C\u5E03\u59D4\u8A17\u9700\u6C42"))) : (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" }, pagedRequests.map((r) => {
                    const author = authorOf(r.userId);
                    const applicants = Array.isArray(r.applicants) ? r.applicants : [];
                    const applicantProfiles = applicants.map((uid) => authorOf(uid)).filter(Boolean);
                    const isOwner = user && r.userId === user.uid;
                    const isApplying = user && applicants.includes(user.uid);
                    const displayStyles = (Array.isArray(r.styles) ? r.styles : []).map((s) => s === REQUEST_STYLE_OTHER ? (r.styleOtherText || "其他") : s).filter(Boolean);
                    return (React.createElement("article", { key: r.id, className: "bg-[#181B25] border border-[#2A2F3D] rounded-2xl p-5 shadow-sm hover:bg-[#1D2130] transition-colors h-full flex flex-col" },
                        React.createElement("div", { className: "flex items-start gap-3 mb-4" },
                            React.createElement("button", { onClick: () => author && openProfile(author), className: "w-12 h-12 rounded-2xl bg-[#11131C] border border-[#2A2F3D] overflow-hidden flex-shrink-0", title: "\u67E5\u770B\u767C\u6848\u8005\u540D\u7247" }, author?.avatar ? React.createElement("img", { src: sanitizeUrl(author.avatar), alt: author?.name || "發案者", className: "vnexus-critical-avatar-img w-full h-full object-cover", onError: (e) => setImageToGrayPlaceholder(e.currentTarget) }) : React.createElement("div", { className: "w-full h-full flex items-center justify-center text-[#64748B]" },
                                React.createElement("i", { className: "fa-solid fa-user" }))),
                            React.createElement("div", { className: "min-w-0 flex-1" },
                                React.createElement("span", { className: "inline-flex bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/30 px-3 py-1 rounded-full text-xs font-extrabold mb-2" }, r.requestType || "委託"),
                                React.createElement("h3", { className: "text-white text-xl font-extrabold leading-tight line-clamp-2 w-full break-words" }, r.title || "未命名需求"),
                                React.createElement("p", { className: "text-xs text-[#94A3B8] mt-1" },
                                    "\u767C\u6848\u8005\uFF1A",
                                    author ? (React.createElement("button", { type: "button", onClick: () => openProfile(author), className: "text-white font-bold hover:text-[#A78BFA] hover:underline underline-offset-4 transition-colors" }, author.name || "匿名創作者")) : (React.createElement("span", { className: "text-white font-bold" }, "\u533F\u540D\u5275\u4F5C\u8005"))))),
                        React.createElement("p", { className: "text-[#CBD5E1] text-sm leading-relaxed line-clamp-3 mb-4" }, r.description),
                        React.createElement("div", { className: "mt-auto flex flex-col" },
                            React.createElement("div", { className: "pt-3 border-t border-[#2A2F3D]/70" },
                                React.createElement("div", { className: "flex flex-wrap gap-2 mb-3" },
                                    displayStyles.slice(0, 6).map((s) => React.createElement("span", { key: s, className: "bg-[#11131C] border border-[#2A2F3D] text-[#CBD5E1] px-2.5 py-1 rounded-full text-xs font-bold" }, s)),
                                    displayStyles.length === 0 && React.createElement("span", { className: "bg-[#11131C] border border-[#2A2F3D] text-[#94A3B8] px-2.5 py-1 rounded-full text-xs font-bold" }, "\u98A8\u683C\u53EF\u8A0E\u8AD6")),
                                React.createElement("div", { className: "text-xs text-[#94A3B8] space-y-1 mb-4" },
                                    React.createElement("p", null,
                                        "\u5E0C\u671B\u5B8C\u6210\uFF1A",
                                        React.createElement("span", { className: "text-white font-bold" }, r.deadline ? formatDateOnly(r.deadline) : "可討論")),
                                    React.createElement("p", null,
                                        "\u9810\u7B97\uFF1A",
                                        React.createElement("span", { className: "text-white font-bold" }, r.budgetRange || "歡迎私訊")),
                                    React.createElement("p", null,
                                        "\u76EE\u524D\u6709 ",
                                        React.createElement("span", { className: "text-[#38BDF8] font-bold" },
                                            applicants.length,
                                            "/5"),
                                        " \u4F4D\u5275\u4F5C\u8005\u8868\u793A\u6709\u8208\u8DA3"))),
                            React.createElement("div", { className: "mb-4 rounded-xl bg-[#0F111A] border border-[#2A2F3D] p-3" },
                                React.createElement("div", { className: "flex items-center justify-between gap-3 mb-2" },
                                    React.createElement("p", { className: "text-xs font-extrabold text-[#CBD5E1]" }, "\u63D0\u6848\u4EBA\u540D\u55AE"),
                                    React.createElement("span", { className: "text-[11px] text-[#94A3B8]" }, "\u6700\u591A 5 \u4F4D")),
                                React.createElement("div", { className: "flex items-center gap-2" },
                                    React.createElement("div", { className: "flex -space-x-2" },
                                        applicantProfiles.slice(0, 5).map((a) => (React.createElement("button", { key: a.id, onClick: () => openProfile(a), className: "w-8 h-8 rounded-full ring-2 ring-[#0F111A] bg-[#1D2130] overflow-hidden border border-[#2A2F3D]", title: a.name || "接案人" }, a.avatar ? React.createElement("img", { src: sanitizeUrl(a.avatar), alt: a.name || "接案人", className: "vnexus-critical-avatar-img w-full h-full object-cover", onError: (e) => setImageToGrayPlaceholder(e.currentTarget) }) : React.createElement("span", { className: "w-full h-full flex items-center justify-center text-[#64748B] text-xs" },
                                            React.createElement("i", { className: "fa-solid fa-user" }))))),
                                        applicantProfiles.length === 0 && React.createElement("div", { className: "w-8 h-8 rounded-full bg-[#1D2130] ring-2 ring-[#0F111A] flex items-center justify-center text-[#64748B] text-xs" },
                                            React.createElement("i", { className: "fa-regular fa-user" }))),
                                    React.createElement("p", { className: "text-xs text-[#94A3B8] leading-relaxed" }, "\u767C\u6848\u4EBA\u9084\u5728\u6311\u9078\u4E2D\uFF1B\u5982\u7121\u9032\u4E00\u6B65\u901A\u77E5\uFF0C\u8ACB\u52FF\u4E3B\u52D5\u6253\u64FE\u767C\u6848\u4EBA\u3002"))),
                            React.createElement("div", { className: "grid grid-cols-3 sm:flex sm:flex-row gap-2" },
                                r.referenceUrl && React.createElement("button", { onClick: () => openPortfolio(r.referenceUrl), className: "bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#0F111A] px-2 sm:px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm" }, "\u770B\u53C3\u8003\u8CC7\u6599"),
                                !isOwner && React.createElement("button", { disabled: !isApplying && applicants.length >= 5, onClick: () => handleApplyRequest(r), className: (isApplying ? "bg-[#1D2130] text-[#CBD5E1]" : applicants.length >= 5 ? "bg-[#1D2130] text-[#64748B] cursor-not-allowed" : "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white") + " px-2 sm:px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm" }, isApplying ? "取消接案意願" : applicants.length >= 5 ? "提案已滿" : "我想接案"),
                                (isOwner || isAdmin) && React.createElement(React.Fragment, null,
                                    React.createElement("button", { onClick: () => handleEditRequest(r), className: "bg-[#1D2130] hover:bg-[#2A2F3D] text-white px-2 sm:px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm" }, "\u7DE8\u8F2F"),
                                    React.createElement("button", { onClick: () => handleDeleteRequest(r.id), className: "bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/30 px-2 sm:px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap" }, "\u522A\u9664\u59D4\u8A17"))))));
                })),
                filteredRequests.length > REQUEST_PAGE_SIZE && (React.createElement("div", { className: "mt-8 flex flex-wrap items-center justify-center gap-3" },
                    React.createElement("button", { onClick: () => goCommissionRequestPage(safeRequestPage - 1), disabled: safeRequestPage === 1, className: `px-4 py-2 rounded-lg font-bold text-sm ${safeRequestPage === 1 ? "bg-[#181B25] text-gray-600 cursor-not-allowed" : "bg-[#1D2130] text-white hover:bg-[#2A2F3D]"}` }, "\u4E0A\u4E00\u9801"),
                    React.createElement("span", { className: "text-[#94A3B8] text-sm font-bold" },
                        "\u7B2C ",
                        safeRequestPage,
                        " / ",
                        totalRequestPages,
                        " \u9801"),
                    React.createElement("button", { onClick: () => goCommissionRequestPage(safeRequestPage + 1), disabled: safeRequestPage === totalRequestPages, className: `px-4 py-2 rounded-lg font-bold text-sm ${safeRequestPage === totalRequestPages ? "bg-[#181B25] text-gray-600 cursor-not-allowed" : "bg-[#1D2130] text-white hover:bg-[#2A2F3D]"}` }, "\u4E0B\u4E00\u9801"))))))));
};
const HomePage = ({ navigate, onOpenRules, onOpenUpdates, hasUnreadUpdates, siteStats = { pageViews: null }, realCollabs = [], displayCollabs = [], currentTime = Date.now(), isLoadingCollabs, goToBulletin, registeredCount, realVtubers = [], setSelectedVTuber, realBulletins = [], onShowParticipants, user, isVerifiedUser, onApply, onNavigateProfile, onOpenStoryComposer, }) => {
    const [statusShuffleSeed, setStatusShuffleSeed] = useState(Date.now());
    const [isShuffling, setIsShuffling] = useState(false);
    const handleShuffleStatus = () => {
        if (isShuffling)
            return;
        setIsShuffling(true);
        setTimeout(() => {
            setStatusShuffleSeed(Date.now());
            setIsShuffling(false);
        }, 240);
    };
    const safeBulletins = Array.isArray(realBulletins) ? realBulletins : [];
    const [homeCommissionRequests, setHomeCommissionRequests] = useState([]);
    const goToCommissionRequests = () => {
        navigate("commission-board");
    };
    useEffect(() => {
        const q = query(collection(db, getPath("commission_requests")), orderBy("createdAt", "desc"), limit(12));
        const unsub = onSnapshot(q, (snap) => setHomeCommissionRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), (err) => console.warn("首頁委託佈告欄讀取失敗:", err));
        return () => unsub();
    }, []);
    const completedCollabsCount = useMemo(() => {
        return siteStats?.totalCompletedCollabs || 0;
    }, [siteStats]);
    const randomBulletins = useMemo(() => {
        const active = safeBulletins.filter((b) => !b.recruitEndTime || currentTime < b.recruitEndTime);
        return [...active]
            .sort((a, b) => getStableRandom(a.id) - getStableRandom(b.id))
            .slice(0, 3)
            .map((b) => {
            const vt = realVtubers.find((v) => v.id === b.userId) || {
                name: "匿名",
                avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Anon",
            };
            const safeApplicants = Array.isArray(b.applicants) ? b.applicants : [];
            const applicantsData = safeApplicants
                .map((uid) => realVtubers.find((v) => v.id === uid))
                .filter(Boolean);
            return {
                ...b,
                vtuber: vt,
                postedAt: formatTime(b.createdAt),
                applicantsData,
            };
        });
    }, [safeBulletins, currentTime, realVtubers]);
    const safeDisplayCollabs = Array.isArray(displayCollabs)
        ? displayCollabs
        : [];
    const randomCollabs = useMemo(() => {
        if (!safeDisplayCollabs.length)
            return [];
        return [...safeDisplayCollabs]
            .filter((c) => c && c.id)
            .sort((a, b) => getStableRandom(a.id) - getStableRandom(b.id))
            .slice(0, 4);
    }, [safeDisplayCollabs.length]);
    const recommendedVtubers = useMemo(() => {
        const myProfile = user ? realVtubers.find((v) => v.id === user.uid) : null;
        const isVerified = myProfile?.isVerified &&
            !myProfile?.isBlacklisted &&
            myProfile?.activityStatus === "active";
        const candidates = [...realVtubers].filter((v) => v.isVerified &&
            !v.isBlacklisted &&
            v.activityStatus !== "sleep" &&
            v.activityStatus !== "graduated" &&
            !String(v.id || "").startsWith("mock") &&
            v.id !== user?.uid);
        if (!isVerified) {
            return candidates
                .sort(() => Math.random() - 0.5)
                .slice(0, 5);
        }
        const scoredCandidates = candidates.map((v) => ({
            ...v,
            compatibilityScore: calculateCompatibility(myProfile, v),
        }));
        let qualified = scoredCandidates.filter((v) => v.compatibilityScore >= 80);
        if (qualified.length === 0) {
            qualified = scoredCandidates
                .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
                .slice(0, 5);
        }
        return qualified
            .sort(() => Math.random() - 0.5)
            .slice(0, 5);
    }, [realVtubers, user]);
    const recommendedCreatorsForCommission = useMemo(() => {
        const base = [...realVtubers]
            .filter((v) => v.isVerified &&
            !v.isBlacklisted &&
            Array.isArray(v.creatorRoles) &&
            v.creatorRoles.length > 0 &&
            !String(v.id || "").startsWith("mock"));
        const picked = [];
        ["繪師", "建模師", "剪輯師"].forEach((role) => {
            const candidates = base
                .filter((v) => v.creatorRoles.includes(role) && !picked.some((p) => p.id === v.id))
                .sort((a, b) => getStableRandom(`${role}-${a.id || a.name}`) - getStableRandom(`${role}-${b.id || b.name}`));
            if (candidates[0])
                picked.push({ ...candidates[0], recommendedRole: role });
        });
        if (picked.length < 3) {
            base
                .filter((v) => !picked.some((p) => p.id === v.id))
                .sort((a, b) => getStableRandom(a.id || a.name) - getStableRandom(b.id || b.name))
                .slice(0, 3 - picked.length)
                .forEach((v) => picked.push(v));
        }
        return picked.slice(0, 3);
    }, [realVtubers]);
    const featuredCommissionRequests = useMemo(() => {
        return (homeCommissionRequests || [])
            .filter((r) => r && r.status !== "closed")
            .slice(0, 3);
    }, [homeCommissionRequests]);
    const myHomeProfile = useMemo(() => {
        return user ? realVtubers.find((v) => v.id === user.uid) : null;
    }, [realVtubers, user]);
    const onboardingState = useMemo(() => {
        const profile = myHomeProfile || {};
        const hasProfile = !!myHomeProfile;
        const hasAvatar = !!profile.avatar;
        const hasCollabTypes = Array.isArray(profile.collabTypes) && profile.collabTypes.length > 0;
        const hasSchedule = profile.isScheduleAnytime ||
            profile.isScheduleCustom ||
            profile.isScheduleExcept ||
            (Array.isArray(profile.scheduleSlots) && profile.scheduleSlots.length > 0);
        const hasTags = Array.isArray(profile.tags) && profile.tags.length > 0;
        const completed = [hasProfile, hasCollabTypes, hasSchedule, hasTags].filter(Boolean).length;
        return {
            percent: Math.round((completed / 4) * 100),
            hasAvatar,
            hasCollabTypes,
            hasSchedule,
            hasTags,
        };
    }, [myHomeProfile]);
    const activeStatuses = useMemo(() => {
        const now = Date.now();
        const validStatuses = [...realVtubers].filter((v) => {
            if (!v.isVerified ||
                v.isBlacklisted ||
                v.activityStatus === "sleep" ||
                v.activityStatus === "graduated" ||
                String(v.id || "").startsWith("mock") ||
                !v.statusMessage ||
                !v.statusMessageUpdatedAt)
                return false;
            const isLiveMsg = v.statusMessage.includes("🔴");
            const expireLimit = isLiveMsg ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
            return now - v.statusMessageUpdatedAt < expireLimit;
        });
        return validStatuses
            .sort(() => Math.random() - 0.5)
            .slice(0, 5);
    }, [realVtubers, statusShuffleSeed]);
    const MobileMoreCard = ({ onClick, icon, text, subText }) => (React.createElement("div", { className: "flex-shrink-0 w-[60vw] sm:hidden flex flex-col items-center justify-center snap-center bg-[#181B25] border border-dashed border-[#2A2F3D] rounded-2xl p-6 text-center gap-3 active:scale-[0.98] transition-transform", onClick: onClick },
        React.createElement("div", { className: "w-12 h-12 bg-[#8B5CF6]/15 rounded-full flex items-center justify-center text-[#A78BFA] text-xl" },
            React.createElement("i", { className: `fa-solid ${icon}` })),
        React.createElement("div", null,
            React.createElement("p", { className: "text-[#F8FAFC] font-bold" }, text),
            React.createElement("p", { className: "text-[10px] text-[#94A3B8] mt-1" }, subText))));
    const SectionHeader = ({ icon, iconColor = "text-[#8B5CF6]", title, desc, action }) => (React.createElement("div", { className: "flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 text-left" },
        React.createElement("div", null,
            React.createElement("h2", { className: "text-2xl md:text-3xl font-extrabold text-[#F8FAFC] flex items-center gap-2" },
                React.createElement("i", { className: `fa-solid ${icon} ${iconColor}` }),
                title),
            desc && React.createElement("p", { className: "text-[#94A3B8] text-sm mt-2 leading-relaxed" }, desc)),
        action));
    const GuideCard = ({ icon, title, desc, onClick, color = "#8B5CF6" }) => (React.createElement("button", { onClick: onClick, className: "text-left bg-[#181B25] hover:bg-[#1D2130] border border-[#2A2F3D] rounded-2xl p-5 transition-colors group" },
        React.createElement("div", { className: "w-11 h-11 rounded-xl flex items-center justify-center mb-4", style: { backgroundColor: `${color}22`, color } },
            React.createElement("i", { className: `fa-solid ${icon}` })),
        React.createElement("h3", { className: "text-[#F8FAFC] font-bold mb-1 group-hover:text-white transition-colors" }, title),
        React.createElement("p", { className: "text-[#94A3B8] text-sm leading-relaxed" }, desc)));
    return (React.createElement("section", { className: "pt-10 md:pt-14 pb-20 px-4 max-w-6xl mx-auto animate-fade-in-up" },
        React.createElement("div", { className: "grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 items-stretch mb-10" },
            React.createElement("div", { className: "bg-[#181B25] border border-[#2A2F3D] rounded-2xl p-6 md:p-8 text-center lg:text-left h-full flex flex-col" },
                React.createElement("div", { className: "inline-flex w-fit px-3 py-1.5 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#C4B5FD] text-xs font-bold mb-5 mx-auto lg:mx-0" },
                    React.createElement("span", null, "\u5C08\u70BA VTuber \u6253\u9020\u7684\u806F\u52D5\u8207\u5275\u4F5C\u793E\u7FA4")),
                React.createElement("h1", { className: "text-3xl md:text-5xl font-black tracking-tight leading-tight text-[#F8FAFC] mb-5" },
                    React.createElement("span", { className: "block" }, "\u70BA\u4F60\u7684 Vtuber \u751F\u6DAF"),
                    React.createElement("span", { className: "block" }, "\u52A0\u4E00\u9EDE\u670B\u53CB\uFF01")),
                React.createElement("p", { className: "text-[#CBD5E1] text-lg md:text-xl leading-relaxed max-w-2xl mx-auto lg:mx-0 mb-3" }, "\u627E\u806F\u52D5\u3001\u767C\u4F01\u5283\u3001\u8A8D\u8B58\u9069\u5408\u4E00\u8D77\u5275\u4F5C\u7684 VTuber\u3002"),
                React.createElement("p", { className: "text-[#94A3B8] text-sm md:text-base leading-relaxed max-w-2xl mx-auto lg:mx-0" }, "\u5927\u5BB6\u5E73\u6642\u8981\u627E\u806F\u52D5\u5925\u4F34\uFF0C\u662F\u4E0D\u662F\u4E0D\u77E5\u9053\u8A72\u5982\u4F55\u958B\u53E3\uFF0C\u53C8\u4E0D\u6562\u96A8\u4FBF\u79C1\u8A0A\u6015\u6253\u64FE\u5C0D\u65B9\uFF1F\u8A3B\u518A\u4F60\u7684\u540D\u7247\uFF0C\u627E\u5C0B\u4F60\u7684\u5925\u4F34\u5427\uFF01"),
                React.createElement("p", { className: "text-[#F59E0B] text-xs md:text-sm font-bold mt-5 leading-relaxed max-w-2xl mx-auto lg:mx-0 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl px-4 py-3" }, "\u76EE\u524D\u50C5\u958B\u653EYT\u8A02\u95B1\u6216TWITCH\u8FFD\u96A8\u52A0\u8D77\u4F86\u9AD8\u65BC500\u3001\u8FD1\u4E00\u500B\u6708\u6709\u76F4\u64AD\u6D3B\u52D5\u4E4BVtuber\u6216\u7E6A\u5E2B\u3001\u5EFA\u6A21\u5E2B\u3001\u526A\u8F2F\u5E2B\u5247\u7531\u7BA1\u7406\u54E1\u8A8D\u5B9A\uFF0C\u656C\u8ACB\u898B\u8AD2\u3002"),
                React.createElement("div", { className: "mt-7 space-y-3" },
                    React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3" },
                        React.createElement("button", { onClick: () => navigate("dashboard"), className: "h-12 bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/40 px-5 rounded-xl font-bold transition-colors flex items-center justify-center whitespace-nowrap" },
                            React.createElement("i", { className: "fa-solid fa-pen-to-square mr-2" }),
                            "\u7BA1\u7406\u540D\u7247"),
                        React.createElement("button", { onClick: onOpenUpdates, className: "relative h-12 bg-[#38BDF8]/12 hover:bg-[#38BDF8]/20 text-[#7DD3FC] border border-[#38BDF8]/30 px-5 rounded-xl font-bold transition-colors flex items-center justify-center whitespace-nowrap" },
                            React.createElement("i", { className: "fa-solid fa-bullhorn mr-2" }),
                            "\u6700\u65B0\u6D88\u606F",
                            hasUnreadUpdates && (React.createElement("span", { className: "absolute -top-1.5 -right-1.5 rounded-full h-3.5 w-3.5 bg-[#EF4444] border border-[#0F111A]" }))),
                        React.createElement("button", { onClick: onOpenRules, className: "h-12 bg-[#EF4444]/10 hover:bg-[#EF4444]/15 text-[#FCA5A5] border border-[#EF4444]/30 px-5 rounded-xl font-bold transition-colors flex items-center justify-center whitespace-nowrap" },
                            React.createElement("i", { className: "fa-solid fa-triangle-exclamation mr-2" }),
                            "\u806F\u52D5\u898F\u7BC4")),
                    React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3" },
                        React.createElement("button", { onClick: () => goToBulletin ? goToBulletin() : navigate("bulletin"), className: "vnexus-mobile-bulletin-red-nav h-12 bg-rose-600 hover:bg-rose-500 border border-rose-500/50 text-white px-5 rounded-xl font-bold transition-colors flex items-center justify-center whitespace-nowrap shadow-md" },
                            React.createElement("i", { className: "fa-solid fa-bullhorn mr-2" }),
                            "\u63EA\u5718\u4F48\u544A\u6B04"),
                        React.createElement("button", { onClick: goToCommissionRequests, className: "h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border border-[#8B5CF6]/50 px-5 rounded-xl font-bold transition-colors flex items-center justify-center whitespace-nowrap shadow-md" },
                            React.createElement("i", { className: "fa-solid fa-clipboard-list mr-2" }),
                            "\u59D4\u8A17\u4F48\u544A\u6B04")))),
            React.createElement("div", { className: "bg-[#181B25] border border-[#2A2F3D] rounded-2xl p-6 text-left h-full flex flex-col" },
                React.createElement("div", null,
                    React.createElement("p", { className: "text-[#94A3B8] text-xs font-bold tracking-widest uppercase mb-3" }, "Community Snapshot"),
                    React.createElement("h2", { className: "text-2xl font-extrabold text-[#F8FAFC] mb-2" }, "\u4ECA\u5929\u5C31\u5F9E\u4E00\u5F35\u540D\u7247\u958B\u59CB"),
                    React.createElement("p", { className: "text-[#94A3B8] text-sm leading-relaxed" }, "\u7BA1\u7406\u540D\u7247\u3001\u586B\u4E0A\u806F\u52D5\u504F\u597D\uFF0C\u518D\u53BB\u770B\u770B\u6700\u8FD1\u6709\u54EA\u4E9B\u5275\u4F5C\u8005\u6B63\u5728\u627E\u4F01\u5283\u5925\u4F34\u3002"),
                    React.createElement("div", { className: "mt-5 bg-[#11131C] border border-[#2A2F3D] rounded-xl p-4" },
                        React.createElement("div", { className: "flex items-center justify-between gap-3 mb-3" },
                            React.createElement("div", null,
                                React.createElement("p", { className: "text-[#F8FAFC] text-sm font-bold" }, "\u73FE\u5728\u8AB0\u6709\u52D5\u614B\uFF1F"),
                                React.createElement("p", { className: "text-[#94A3B8] text-[11px] mt-0.5" }, "\u6A58\u5708\u662F\u9650\u52D5\u3001\u7D05\u5708\u662F\u76F4\u64AD\u4E2D\uFF0C\u9EDE\u982D\u50CF\u76F4\u63A5\u770B\u540D\u7247\u3002")),
                            React.createElement("div", { className: "flex items-center gap-2 flex-shrink-0" },
                                React.createElement("button", { onClick: onOpenStoryComposer, className: "inline-flex items-center gap-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F111A] px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-colors whitespace-nowrap" },
                                    React.createElement("i", { className: "fa-solid fa-plus" }),
                                    " \u6211\u4E5F\u8981\u767C"),
                                React.createElement("button", { onClick: () => navigate("status_wall"), className: "text-[11px] font-bold text-[#F59E0B] hover:text-[#FBBF24] transition-colors whitespace-nowrap" }, "\u770B\u5168\u90E8"))),
                        activeStatuses.length > 0 ? (React.createElement("div", { className: "flex gap-3 overflow-x-auto custom-scrollbar pb-1" }, activeStatuses.map((v) => {
                            const isLiveMsg = String(v.statusMessage || "").includes("🔴");
                            return (React.createElement("button", { key: `home-story-${v.id}`, onClick: () => {
                                    setSelectedVTuber(v);
                                    navigate(`profile/${v.id}`);
                                }, className: "flex-shrink-0 w-14 text-center group", title: v.statusMessage },
                                React.createElement("div", { className: `w-12 h-12 mx-auto rounded-full p-[2px] ${isLiveMsg ? "bg-[#EF4444]" : "bg-[#F59E0B]"}` },
                                    React.createElement("div", { className: "w-full h-full rounded-full bg-[#11131C] p-[2px]" },
                                        React.createElement("img", { src: sanitizeUrl(v.avatar), className: "w-full h-full rounded-full object-cover bg-[#1D2130]", onError: (e) => setImageToGrayPlaceholder(e.currentTarget), alt: v.name || "VTuber" }))),
                                React.createElement("p", { className: "text-[10px] text-[#F8FAFC] mt-1.5 truncate group-hover:text-[#F59E0B] transition-colors" }, v.name)));
                        }))) : (React.createElement("button", { onClick: () => navigate("status_wall"), className: "w-full text-left bg-[#181B25] hover:bg-[#1D2130] border border-dashed border-[#2A2F3D] rounded-xl px-3 py-3 transition-colors" },
                            React.createElement("p", { className: "text-[#F8FAFC] text-sm font-bold" }, "\u9084\u6C92\u6709\u4EBA\u767C\u52D5\u614B"),
                            React.createElement("p", { className: "text-[#94A3B8] text-xs mt-1" }, "\u53BB 24H \u52D5\u614B\u7246\u767C\u4E00\u53E5\u8A71\uFF0C\u8B93\u5927\u5BB6\u66F4\u5BB9\u6613\u770B\u898B\u4F60\u3002"))))),
                React.createElement("div", { className: "grid grid-cols-3 gap-2 sm:gap-3 mt-auto pt-6" },
                    React.createElement("div", { className: "bg-[#11131C] border border-[#2A2F3D] rounded-xl px-2 sm:px-4 py-3 text-center" },
                        React.createElement("p", { className: "text-[#94A3B8] text-[10px] sm:text-xs font-bold mb-1" }, "VTUBER\u4EBA\u6578"),
                        React.createElement("p", { className: "text-xl sm:text-2xl font-black text-[#22C55E]" },
                            registeredCount !== null ? React.createElement(AnimatedCounter, { value: registeredCount }) : React.createElement("i", { className: "fa-solid fa-spinner fa-spin text-lg" }),
                            React.createElement("span", { className: "text-[10px] sm:text-sm text-[#94A3B8] ml-1" }, "\u4F4D"))),
                    React.createElement("div", { className: "bg-[#11131C] border border-[#2A2F3D] rounded-xl px-2 sm:px-4 py-3 text-center" },
                        React.createElement("p", { className: "text-[#94A3B8] text-[10px] sm:text-xs font-bold mb-1" }, "\u5DF2\u6210\u529F\u4FC3\u6210\u806F\u52D5"),
                        React.createElement("p", { className: "text-xl sm:text-2xl font-black text-[#38BDF8]" },
                            !isLoadingCollabs ? React.createElement(AnimatedCounter, { value: completedCollabsCount }) : React.createElement("i", { className: "fa-solid fa-spinner fa-spin text-lg" }),
                            React.createElement("span", { className: "text-[10px] sm:text-sm text-[#94A3B8] ml-1" }, "\u6B21"))),
                    React.createElement("div", { className: "bg-[#11131C] border border-[#2A2F3D] rounded-xl px-2 sm:px-4 py-3 text-center" },
                        React.createElement("p", { className: "text-[#94A3B8] text-[10px] sm:text-xs font-bold mb-1" }, "\u7DB2\u7AD9\u7E3D\u700F\u89BD\u4EBA\u6B21"),
                        React.createElement("p", { className: "text-xl sm:text-2xl font-black text-[#8B5CF6]" }, siteStats?.pageViews !== null ? React.createElement(AnimatedCounter, { value: siteStats.pageViews }) : React.createElement("i", { className: "fa-solid fa-spinner fa-spin text-lg" })))))),
        recommendedVtubers.length > 0 && (React.createElement("div", { className: "mt-10 pt-10 border-t border-[#2A2F3D] w-full animate-fade-in-up" },
            React.createElement(SectionHeader, { icon: "fa-user-group", iconColor: "text-[#22C55E]", title: "\u4ECA\u65E5\u6D3B\u8E8D\u5275\u4F5C\u8005", desc: "\u5148\u770B\u770B\u6700\u8FD1\u9069\u5408\u8A8D\u8B58\u7684\u5275\u4F5C\u8005\uFF0C\u5F9E\u4E00\u5F35\u540D\u7247\u958B\u59CB\u627E\u5230\u806F\u52D5\u53EF\u80FD\u3002", action: React.createElement("button", { onClick: () => navigate("grid"), className: "hidden sm:flex bg-[#181B25] hover:bg-[#1D2130] text-[#F8FAFC] px-5 py-2.5 rounded-xl font-bold border border-[#2A2F3D] transition-colors items-center gap-2 whitespace-nowrap" },
                    "\u63A2\u7D22\u66F4\u591A ",
                    React.createElement("i", { className: "fa-solid fa-arrow-right text-[#38BDF8]" })) }),
            React.createElement("div", { className: "flex items-stretch overflow-x-auto pb-6 gap-4 snap-x snap-mandatory sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 sm:overflow-visible custom-scrollbar" },
                recommendedVtubers.map((v) => (React.createElement("div", { key: v.id, className: "flex-shrink-0 w-[75vw] sm:w-auto snap-center text-left h-auto" },
                    React.createElement(VTuberCard, { v: v, onSelect: () => {
                            setSelectedVTuber(v);
                            navigate(`profile/${v.id}`);
                        }, onDislike: () => { } })))),
                React.createElement("div", { className: "flex-shrink-0 w-[60vw] sm:hidden" },
                    React.createElement(MobileMoreCard, { onClick: () => navigate("grid"), icon: "fa-magnifying-glass", text: "\u63A2\u7D22\u66F4\u591A\u5275\u4F5C\u8005", subText: "\u67E5\u770B\u5B8C\u6574 VTuber \u540D\u55AE" }))))),
        React.createElement("div", { className: "mt-10 pt-10 border-t border-[#2A2F3D] w-full animate-fade-in-up" },
            React.createElement(SectionHeader, { icon: "fa-bullhorn", iconColor: "text-[#8B5CF6]", title: "\u6700\u8FD1\u63EA\u5718", desc: "\u6B63\u5728\u5C0B\u627E\u5925\u4F34\u7684\u4F01\u5283\uFF0C\u6216\u8A31\u5C31\u6709\u4F60\u611F\u8208\u8DA3\u7684\u3002", action: React.createElement("button", { onClick: goToBulletin, className: "hidden sm:flex bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 py-2.5 rounded-xl font-bold transition-colors items-center gap-2 whitespace-nowrap" },
                    "\u627E\u770B\u770B\u8AB0\u5728\u63EA\u5718 ",
                    React.createElement("i", { className: "fa-solid fa-arrow-right" })) }),
            randomBulletins.length > 0 ? (React.createElement("div", { className: "flex items-stretch overflow-x-auto pb-6 gap-4 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible custom-scrollbar" },
                randomBulletins.map((b) => (React.createElement("div", { key: b.id, className: "flex-shrink-0 w-[85vw] md:w-auto snap-center text-left h-full" },
                    React.createElement(BulletinCard, { b: b, user: user, isVerifiedUser: isVerifiedUser, onNavigateProfile: onNavigateProfile, onApply: onApply, currentView: "home" })))),
                React.createElement(MobileMoreCard, { onClick: goToBulletin, icon: "fa-bullhorn", text: "\u67E5\u770B\u66F4\u591A\u62DB\u52DF", subText: "\u5C0B\u627E\u9069\u5408\u4F60\u7684\u806F\u52D5\u4F01\u5283" }))) : (React.createElement("div", { className: "text-center py-12 px-6 bg-[#181B25] rounded-2xl border border-[#2A2F3D]" },
                React.createElement("p", { className: "text-[#F8FAFC] font-bold text-lg" }, "\u9084\u6C92\u6709\u63EA\u5718\u4F01\u5283"),
                React.createElement("p", { className: "text-[#94A3B8] text-sm mt-2" }, "\u6210\u70BA\u7B2C\u4E00\u500B\u767C\u4E00\u500B\u62DB\u52DF\u4F01\u5283\u7684\u4EBA\u5427\uFF0C\u8B93\u5176\u4ED6 VTuber \u77E5\u9053\u4F60\u6B63\u5728\u627E\u5925\u4F34\u3002"),
                React.createElement("button", { onClick: goToBulletin, className: "mt-5 inline-flex items-center justify-center bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 py-2.5 rounded-xl font-bold transition-colors" }, "\u767C\u4E00\u500B\u62DB\u52DF\u4F01\u5283")))),
        recommendedCreatorsForCommission.length > 0 && (React.createElement("div", { className: "mt-10 pt-10 border-t border-[#2A2F3D] w-full" },
            React.createElement(SectionHeader, { icon: "fa-palette", iconColor: "text-[#38BDF8]", title: "\u63A8\u85A6\u7E6A\u5E2B / \u5EFA\u6A21\u5E2B / \u526A\u8F2F\u5E2B", desc: "\u770B\u770B\u53EF\u4EE5\u59D4\u8A17\u6216\u5408\u4F5C\u7684\u5275\u4F5C\u8005\uFF0C\u5148\u5F9E\u4F5C\u54C1\u8207\u540D\u7247\u958B\u59CB\u8A8D\u8B58\u3002", action: React.createElement("button", { onClick: () => navigate("commissions"), className: "hidden sm:flex bg-[#181B25] hover:bg-[#1D2130] text-[#F8FAFC] px-5 py-2.5 rounded-xl font-bold border border-[#2A2F3D] transition-colors items-center gap-2 whitespace-nowrap" },
                    "\u67E5\u770B\u59D4\u8A17\u5C08\u5340 ",
                    React.createElement("i", { className: "fa-solid fa-arrow-right text-[#38BDF8]" })) }),
            React.createElement("div", { className: "flex items-stretch overflow-x-auto pb-6 gap-4 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible custom-scrollbar" },
                recommendedCreatorsForCommission.map((v) => (React.createElement("div", { key: `home-commission-${v.id}`, className: "flex-shrink-0 w-[85vw] md:w-auto snap-center bg-[#181B25] border border-[#2A2F3D] rounded-2xl overflow-hidden text-left hover:bg-[#1D2130] transition-colors h-full" },
                    React.createElement("button", { onClick: () => {
                            setSelectedVTuber(v);
                            navigate(`profile/${v.id}`);
                        }, className: "block w-full text-left" },
                        React.createElement("div", { className: "h-36 bg-[#11131C] overflow-hidden" }, v.banner ? (React.createElement("img", { src: sanitizeUrl(v.banner), alt: v.name || "creator", className: "vnexus-critical-avatar-img w-full h-full object-cover", onError: (e) => setImageToGrayPlaceholder(e.currentTarget) })) : (React.createElement("div", { className: "w-full h-full bg-[#1D2130]" }))),
                        React.createElement("div", { className: "p-4" },
                            React.createElement("div", { className: "flex items-center gap-3 mb-3" },
                                React.createElement("img", { src: sanitizeUrl(v.avatar), alt: v.name || "creator", className: "w-12 h-12 rounded-xl object-cover bg-[#1D2130] border border-[#2A2F3D]", onError: (e) => setImageToGrayPlaceholder(e.currentTarget) }),
                                React.createElement("div", { className: "min-w-0" },
                                    React.createElement("h3", { className: "text-[#F8FAFC] font-extrabold truncate" }, v.name || "未命名創作者"),
                                    React.createElement("div", { className: "flex flex-wrap gap-1 mt-1" }, (v.creatorRoles || []).slice(0, 2).map((role) => (React.createElement("span", { key: role, className: "text-[10px] font-bold text-[#38BDF8] bg-[#38BDF8]/10 border border-[#38BDF8]/25 rounded-full px-2 py-0.5" }, role)))))),
                            React.createElement("p", { className: "text-[#94A3B8] text-sm line-clamp-2 leading-relaxed min-h-[2.5rem]" }, v.description || "這位創作者還沒有填寫作品介紹，先看看名片認識一下。")))))),
                React.createElement(MobileMoreCard, { onClick: goToCommissionRequests, icon: "fa-palette", text: "\u67E5\u770B\u59D4\u8A17\u5C08\u5340", subText: "\u627E\u7E6A\u5E2B\u3001\u5EFA\u6A21\u5E2B\u8207\u526A\u8F2F\u5E2B" })))),
        React.createElement("div", { className: "mt-10 pt-10 border-t border-[#2A2F3D] w-full animate-fade-in-up" },
            React.createElement(SectionHeader, { icon: "fa-clipboard-list", iconColor: "text-[#8B5CF6]", title: "\u59D4\u8A17\u4F48\u544A\u6B04", desc: "\u770B\u770B\u6700\u8FD1\u6709\u54EA\u4E9B\u59D4\u8A17\u9700\u6C42\u6B63\u5728\u5C0B\u627E\u7E6A\u5E2B\u3001\u5EFA\u6A21\u5E2B\u6216\u526A\u8F2F\u5E2B\uFF0C\u63A5\u6848\u524D\u5148\u78BA\u8A8D\u9700\u6C42\u8207\u9810\u7B97\u3002", action: React.createElement("button", { onClick: goToCommissionRequests, className: "hidden sm:flex bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 py-2.5 rounded-xl font-bold transition-colors items-center gap-2 whitespace-nowrap" },
                    "\u67E5\u770B\u5168\u90E8\u59D4\u8A17 ",
                    React.createElement("i", { className: "fa-solid fa-arrow-right" })) }),
            featuredCommissionRequests.length > 0 ? (React.createElement("div", { className: "flex items-stretch overflow-x-auto pb-6 gap-4 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible custom-scrollbar" },
                featuredCommissionRequests.map((r) => {
                    const author = realVtubers.find((v) => v.id === r.userId);
                    const styles = Array.isArray(r.styles) ? r.styles.filter((style) => style !== REQUEST_STYLE_OTHER).slice(0, 3) : [];
                    const applicants = Array.isArray(r.applicants) ? r.applicants : [];
                    return (React.createElement("article", { key: `home-commission-request-${r.id}`, className: "flex-shrink-0 w-[85vw] md:w-auto snap-center bg-[#181B25] border border-[#2A2F3D] rounded-2xl p-5 text-left hover:bg-[#1D2130] transition-colors h-full flex flex-col" },
                        React.createElement("div", { className: "flex items-start justify-between gap-3 mb-4" },
                            React.createElement("div", { className: "flex items-center gap-3 min-w-0" },
                                React.createElement("img", { src: sanitizeUrl(author?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Anon"), alt: author?.name || "發案者", className: "w-11 h-11 rounded-xl object-cover bg-[#1D2130] border border-[#2A2F3D] flex-shrink-0", onError: (e) => setImageToGrayPlaceholder(e.currentTarget) }),
                                React.createElement("div", { className: "min-w-0" },
                                    React.createElement("p", { className: "text-[#F8FAFC] font-bold truncate" }, author?.name || "匿名發案者"),
                                    React.createElement("p", { className: "text-[#94A3B8] text-xs" }, formatTime(r.createdAt)))),
                            React.createElement("span", { className: "flex-shrink-0 bg-[#8B5CF6]/15 text-[#C4B5FD] border border-[#8B5CF6]/30 text-xs font-extrabold px-2.5 py-1 rounded-full" }, r.requestType || "委託")),
                        React.createElement("h3", { className: "text-[#F8FAFC] text-lg font-extrabold mb-2 line-clamp-2" }, r.title || "未命名委託需求"),
                        React.createElement("p", { className: "text-[#94A3B8] text-sm leading-relaxed line-clamp-3 mb-4 flex-1" }, r.description || "發案者尚未填寫詳細需求。"),
                        React.createElement("div", { className: "flex flex-wrap gap-2 mb-4" },
                            React.createElement("span", { className: "bg-[#38BDF8]/10 text-[#7DD3FC] border border-[#38BDF8]/25 rounded-full px-2.5 py-1 text-xs font-bold" }, r.budgetRange || "預算可討論"),
                            React.createElement("span", { className: "bg-[#11131C] text-[#CBD5E1] border border-[#2A2F3D] rounded-full px-2.5 py-1 text-xs font-bold" }, r.deadline ? formatDateOnly(r.deadline) : "日期可討論"),
                            styles.map((style) => React.createElement("span", { key: `${r.id}-${style}`, className: "bg-[#8B5CF6]/10 text-[#C4B5FD] border border-[#8B5CF6]/25 rounded-full px-2.5 py-1 text-xs font-bold" }, style))),
                        React.createElement("div", { className: "flex items-center justify-between gap-3 pt-4 border-t border-[#2A2F3D]" },
                            React.createElement("p", { className: "text-xs text-[#94A3B8]" },
                                "\u63D0\u6848 ",
                                React.createElement("span", { className: "text-[#38BDF8] font-bold" },
                                    applicants.length,
                                    "/5")),
                            React.createElement("button", { onClick: goToCommissionRequests, className: "text-sm font-extrabold text-[#A78BFA] hover:text-[#C4B5FD] transition-colors" },
                                "\u524D\u5F80\u67E5\u770B ",
                                React.createElement("i", { className: "fa-solid fa-arrow-right ml-1" })))));
                }),
                React.createElement(MobileMoreCard, { onClick: goToCommissionRequests, icon: "fa-clipboard-list", text: "\u67E5\u770B\u5168\u90E8\u59D4\u8A17", subText: "\u524D\u5F80\u59D4\u8A17\u4F48\u544A\u6B04\u63A5\u6848" }))) : (React.createElement("div", { className: "text-center py-12 px-6 bg-[#181B25] rounded-2xl border border-[#2A2F3D]" },
                React.createElement("p", { className: "text-[#F8FAFC] font-bold text-lg" }, "\u76EE\u524D\u9084\u6C92\u6709\u516C\u958B\u59D4\u8A17\u9700\u6C42"),
                React.createElement("p", { className: "text-[#94A3B8] text-sm mt-2" }, "\u6709\u7E6A\u5716\u3001\u5EFA\u6A21\u6216\u526A\u8F2F\u9700\u6C42\u6642\uFF0C\u53EF\u4EE5\u76F4\u63A5\u767C\u5E03\u5230\u59D4\u8A17\u4F48\u544A\u6B04\u3002"),
                React.createElement("button", { onClick: goToCommissionRequests, className: "mt-5 inline-flex items-center justify-center bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 py-2.5 rounded-xl font-bold transition-colors" }, "\u524D\u5F80\u59D4\u8A17\u4F48\u544A\u6B04")))),
        React.createElement("div", { className: "mt-10 pt-10 border-t border-[#2A2F3D] w-full animate-fade-in-up" },
            React.createElement(SectionHeader, { icon: "fa-compass", iconColor: "text-[#F59E0B]", title: "\u7B2C\u4E00\u6B21\u4F86 V-Nexus\uFF1F", desc: "\u7167\u8457\u9019\u56DB\u6B65\u8D70\uFF0C\u66F4\u5BB9\u6613\u627E\u5230\u9069\u5408\u4E00\u8D77\u5275\u4F5C\u7684\u5925\u4F34\u3002" }),
            React.createElement("div", { className: "bg-[#181B25] border border-[#2A2F3D] rounded-2xl p-5 md:p-6 mb-5 text-left" },
                React.createElement("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-5" },
                    React.createElement("div", { className: "min-w-0 flex-1" },
                        React.createElement("p", { className: "text-[#94A3B8] text-xs font-bold tracking-widest uppercase mb-2" }, "Profile onboarding"),
                        React.createElement("h3", { className: "text-[#F8FAFC] text-xl font-extrabold mb-2" },
                            "\u4F60\u7684 V-Nexus \u540D\u7247\u5B8C\u6210\u5EA6 ",
                            onboardingState.percent,
                            "%"),
                        React.createElement("div", { className: "h-2.5 bg-[#11131C] border border-[#2A2F3D] rounded-full overflow-hidden max-w-xl" },
                            React.createElement("div", { className: "h-full bg-[#8B5CF6] transition-all duration-300", style: { width: `${onboardingState.percent}%` } })),
                        React.createElement("p", { className: "text-[#94A3B8] text-sm mt-3 leading-relaxed" }, "\u5B8C\u6210\u540D\u7247\u3001\u806F\u52D5\u985E\u578B\u8207\u53EF\u806F\u52D5\u6642\u6BB5\u5F8C\uFF0C\u5176\u4ED6\u5275\u4F5C\u8005\u6703\u66F4\u5BB9\u6613\u5224\u65B7\u662F\u5426\u9069\u5408\u9080\u8ACB\u4F60\u3002")),
                    React.createElement("div", { className: "flex flex-wrap gap-2 md:justify-end" },
                        React.createElement("button", { onClick: () => navigate("dashboard"), className: `px-3 py-2 rounded-xl text-sm font-bold border transition-colors whitespace-nowrap ${onboardingState.hasAvatar ? "bg-[#22C55E]/10 text-[#86EFAC] border-[#22C55E]/25" : "bg-[#11131C] text-[#F8FAFC] border-[#2A2F3D] hover:bg-[#1D2130]"}` }, onboardingState.hasAvatar ? "已補上頭像" : "補上頭像"),
                        React.createElement("button", { onClick: () => navigate("dashboard"), className: `px-3 py-2 rounded-xl text-sm font-bold border transition-colors whitespace-nowrap ${onboardingState.hasSchedule ? "bg-[#22C55E]/10 text-[#86EFAC] border-[#22C55E]/25" : "bg-[#11131C] text-[#F8FAFC] border-[#2A2F3D] hover:bg-[#1D2130]"}` }, onboardingState.hasSchedule ? "已填寫時段" : "填寫聯動時段"),
                        React.createElement("button", { onClick: () => navigate("dashboard"), className: `px-3 py-2 rounded-xl text-sm font-bold border transition-colors whitespace-nowrap ${onboardingState.hasTags ? "bg-[#22C55E]/10 text-[#86EFAC] border-[#22C55E]/25" : "bg-[#11131C] text-[#F8FAFC] border-[#2A2F3D] hover:bg-[#1D2130]"}` }, onboardingState.hasTags ? "已新增標籤" : "新增常玩遊戲")))),
            React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" },
                React.createElement(GuideCard, { icon: "fa-id-card", title: "Step 1\uFF1A\u7BA1\u7406\u540D\u7247", desc: "\u5148\u8B93\u5927\u5BB6\u77E5\u9053\u4F60\u662F\u8AB0\u3001\u5E38\u73A9\u4EC0\u9EBC\u3001\u60F3\u627E\u54EA\u7A2E\u806F\u52D5\u3002", onClick: () => navigate("dashboard"), color: "#8B5CF6" }),
                React.createElement(GuideCard, { icon: "fa-gamepad", title: "Step 2\uFF1A\u9078\u64C7\u806F\u52D5\u985E\u578B", desc: "\u9078\u597D\u60F3\u627E\u7684\u5408\u4F5C\u5167\u5BB9\uFF0C\u8B93\u9069\u5408\u7684\u4EBA\u66F4\u5BB9\u6613\u627E\u5230\u4F60\u3002", onClick: () => navigate("dashboard"), color: "#38BDF8" }),
                React.createElement(GuideCard, { icon: "fa-calendar-days", title: "Step 3\uFF1A\u586B\u5BEB\u53EF\u806F\u52D5\u6642\u6BB5", desc: "\u6E05\u695A\u6A19\u793A\u6642\u9593\uFF0C\u53EF\u4EE5\u6E1B\u5C11\u4F86\u56DE\u8A62\u554F\uFF0C\u4E5F\u66F4\u5BB9\u6613\u6210\u529F\u7D04\u5230\u3002", onClick: () => navigate("dashboard"), color: "#F59E0B" }),
                React.createElement(GuideCard, { icon: "fa-magnifying-glass", title: "Step 4\uFF1A\u958B\u59CB\u5C0B\u627EVTuber", desc: "\u770B\u770B\u8FD1\u671F\u6D3B\u8E8D\u7684\u4EBA\u3001\u62DB\u52DF\u4F01\u5283\uFF0C\u5F9E\u4E00\u500B\u8F15\u9B06\u7684\u9080\u8ACB\u958B\u59CB\u3002", onClick: () => navigate("grid"), color: "#22C55E" }))),
        React.createElement("div", { className: "mt-10 pt-10 border-t border-[#2A2F3D] w-full" },
            React.createElement(SectionHeader, { icon: "fa-calendar-check", iconColor: "text-[#38BDF8]", title: "\u5373\u5C07\u806F\u52D5", desc: "\u770B\u770B\u6709\u54EA\u4E9B VTuber \u5373\u5C07\u5C55\u958B\u5408\u4F5C\uFF0C\u4E5F\u53EF\u4EE5\u5F9E\u4E2D\u8A8D\u8B58\u65B0\u5925\u4F34\u3002", action: React.createElement("button", { onClick: () => navigate("collabs"), className: "hidden sm:flex bg-[#181B25] hover:bg-[#1D2130] text-[#F8FAFC] px-5 py-2.5 rounded-xl font-bold border border-[#2A2F3D] transition-colors items-center gap-2 whitespace-nowrap" },
                    "\u5B8C\u6574\u806F\u52D5\u8868 ",
                    React.createElement("i", { className: "fa-solid fa-arrow-right text-[#38BDF8]" })) }),
            randomCollabs.length > 0 ? (React.createElement("div", { className: "flex overflow-x-auto pb-6 gap-4 snap-x snap-mandatory md:grid md:grid-cols-2 md:overflow-visible custom-scrollbar max-w-5xl mx-auto w-full" },
                randomCollabs.map((c) => (React.createElement("div", { key: c.id, className: "flex-shrink-0 w-[85vw] md:w-auto snap-center text-left h-full" },
                    React.createElement(CollabCard, { c: c, isLive: c.startTimestamp &&
                            currentTime >= c.startTimestamp &&
                            currentTime <= c.startTimestamp + 2 * 60 * 60 * 1000, vtuber: realVtubers.find((v) => v.id === c.userId), realVtubers: realVtubers, onNavigateProfile: (vt) => {
                            setSelectedVTuber(vt);
                            navigate(`profile/${vt.id}`);
                        }, onShowParticipants: onShowParticipants })))),
                React.createElement(MobileMoreCard, { onClick: () => navigate("collabs"), icon: "fa-calendar-check", text: "\u67E5\u770B\u5B8C\u6574\u806F\u52D5\u8868", subText: "\u638C\u63E1\u6240\u6709\u5373\u5C07\u5230\u4F86\u7684\u76F4\u64AD" }))) : (React.createElement("div", { className: "text-center py-12 px-6 bg-[#181B25] rounded-2xl border border-[#2A2F3D] max-w-4xl mx-auto" },
                React.createElement("p", { className: "text-[#F8FAFC] font-bold text-lg" }, "\u9084\u6C92\u6709\u5373\u5C07\u516C\u958B\u7684\u806F\u52D5\u884C\u7A0B"),
                React.createElement("p", { className: "text-[#94A3B8] text-sm mt-2" }, "\u5B89\u6392\u597D\u5408\u4F5C\u5F8C\uFF0C\u628A\u5F85\u6A5F\u5BA4\u653E\u4E0A\u4F86\uFF0C\u5927\u5BB6\u5C31\u80FD\u4E00\u8D77\u4F86\u652F\u6301\u3002"),
                React.createElement("button", { onClick: () => navigate("collabs"), className: "mt-5 inline-flex items-center justify-center bg-[#181B25] hover:bg-[#1D2130] text-[#F8FAFC] px-5 py-2.5 rounded-xl font-bold border border-[#2A2F3D] transition-colors" }, "\u67E5\u770B\u806F\u52D5\u8868"))))));
};
const maskEmail = (email) => {
    if (!email || !email.includes("@"))
        return email;
    const [name, domain] = email.split("@");
    if (name.length <= 3)
        return name + "***@" + domain;
    return name.substring(0, 3) + "********@" + domain;
};
const AdminVtuberList = ({ title, list, onEdit, onDelete, onVerify, onReject, isBlacklist, privateDocs, paginate = true, showSearch = true, }) => {
    const [page, setPage] = useState(1);
    const [searchQ, setSearchQ] = useState("");
    const itemsPerPage = 10;
    // 1. 搜尋過濾邏輯 (支援名稱、勢力、UID 搜尋)
    const filteredList = list.filter((v) => (v.name || "").toLowerCase().includes(searchQ.toLowerCase()) ||
        (v.agency || "").toLowerCase().includes(searchQ.toLowerCase()) ||
        (v.id || "").toLowerCase().includes(searchQ.toLowerCase()));
    // 2. 分頁計算
    const totalPages = Math.ceil(filteredList.length / itemsPerPage);
    const displayList = paginate
        ? filteredList.slice((page - 1) * itemsPerPage, page * itemsPerPage)
        : filteredList;
    // 當搜尋字串改變時，自動跳回第一頁
    useEffect(() => {
        setPage(1);
    }, [searchQ]);
    return (React.createElement("div", { className: "mb-8" },
        React.createElement("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-[#2A2F3D] pb-2 gap-3" },
            React.createElement("h3", { className: `text-xl font-bold ${isBlacklist ? "text-[#EF4444]" : title.includes("待") ? "text-[#F59E0B]" : "text-white"}` },
                title,
                " (",
                filteredList.length,
                ")"),
            showSearch && (React.createElement("div", { className: "relative w-full sm:w-64" },
                React.createElement("i", { className: "fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" }),
                React.createElement("input", { type: "text", placeholder: "\u641C\u5C0B\u540D\u7A31\u3001\u52E2\u529B\u6216UID...", value: searchQ, onChange: (e) => setSearchQ(e.target.value), className: "w-full bg-[#181B25] border border-[#2A2F3D] rounded-lg py-1.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-[#8B5CF6]" })))),
        filteredList.length === 0 ? (React.createElement("div", { className: "text-[#94A3B8] text-sm py-6 px-4 text-center bg-[#0F111A]/50 rounded-xl border border-dashed border-[#2A2F3D]" },
            React.createElement("p", { className: "text-[#F8FAFC] font-bold" }, "\u9019\u88E1\u76EE\u524D\u6C92\u6709\u9700\u8981\u8655\u7406\u7684\u9805\u76EE"),
            React.createElement("p", { className: "text-[#64748B] mt-1" }, "\u63DB\u500B\u7BE9\u9078\u689D\u4EF6\uFF0C\u6216\u7A0D\u5F8C\u518D\u56DE\u4F86\u770B\u770B\u3002"))) : (React.createElement("div", { className: "space-y-3" }, displayList.map((v) => (React.createElement("div", { key: v.id, className: `flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border ${isBlacklist ? "bg-[#2A1418]/20 border-red-900/50" : title.includes("待") ? "bg-[#0F111A] border-[#F59E0B]/30" : "bg-[#0F111A] border-[#2A2F3D]"} gap-4` },
            React.createElement("div", { className: "flex items-center gap-4" },
                React.createElement("img", { src: sanitizeUrl(v.avatar), className: `w-12 h-12 rounded-lg object-cover flex-shrink-0 ${isBlacklist ? "opacity-50 grayscale" : ""}` }),
                React.createElement("div", { className: "min-w-0" },
                    React.createElement("p", { className: `font-bold text-sm flex items-center gap-2 ${isBlacklist ? "text-[#94A3B8] line-through" : "text-white"}` },
                        v.name || "（空白名片）",
                        v.isVerified && (React.createElement("i", { className: "fa-solid fa-circle-check text-[#38BDF8] text-xs" }))),
                    !isBlacklist && (React.createElement("p", { className: "text-[10px] text-[#94A3B8] mt-1" },
                        v.agency,
                        " |",
                        " ",
                        v.activityStatus === "sleep"
                            ? "暫時休息"
                            : v.activityStatus === "graduated"
                                ? "已畢業"
                                : v.activityStatus === "creator"
                                    ? "繪師/建模師/剪輯師"
                                    : "開放聯動",
                        " ",
                        "| \u63A8\u85A6:",
                        " ",
                        React.createElement("span", { className: "text-[#22C55E]" }, v.likes || 0),
                        " | \u5012\u8B9A:",
                        " ",
                        React.createElement("span", { className: "text-[#EF4444]" }, v.dislikes || 0))),
                    privateDocs[v.id]?.verificationNote && (React.createElement("p", { className: "text-[10px] text-[#F59E0B] mt-1.5 bg-[#F59E0B]/10 p-1 rounded border border-[#F59E0B]/20 inline-block" },
                        React.createElement("i", { className: "fa-solid fa-key mr-1" }),
                        " \u9A57\u8B49:",
                        " ",
                        privateDocs[v.id].verificationNote)),
                    React.createElement("div", { className: "flex gap-3 mt-1.5" },
                        (v.youtubeUrl || v.channelUrl) && (React.createElement("a", { href: sanitizeUrl(v.youtubeUrl || v.channelUrl), target: "_blank", rel: "noopener noreferrer", className: "text-[10px] text-[#EF4444] hover:underline" },
                            React.createElement("i", { className: "fa-brands fa-youtube" }),
                            " YT")),
                        v.twitchUrl && (React.createElement("a", { href: sanitizeUrl(v.twitchUrl), target: "_blank", rel: "noopener noreferrer", className: "text-[10px] text-[#A78BFA] hover:underline" },
                            React.createElement("i", { className: "fa-brands fa-twitch" }),
                            " Twitch")),
                        v.xUrl && (React.createElement("a", { href: sanitizeUrl(v.xUrl), target: "_blank", rel: "noopener noreferrer", className: "text-[10px] text-[#38BDF8] hover:underline" },
                            React.createElement("i", { className: "fa-brands fa-x-twitter" }),
                            " X"))))),
            React.createElement("div", { className: "flex gap-2 flex-shrink-0 self-end sm:self-center" },
                onVerify && (React.createElement("button", { onClick: () => onVerify(v.id), className: "text-[#22C55E] bg-[#22C55E]/10 hover:bg-[#22C55E] hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors" }, "\u5BE9\u6838")),
                onReject && (React.createElement("button", { onClick: () => onReject(v.id), className: "text-[#F59E0B] bg-[#F59E0B]/10 hover:bg-[#F59E0B] hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors" }, "\u9000\u56DE")),
                React.createElement("button", { onClick: () => onEdit(v), className: "text-[#38BDF8] bg-[#38BDF8]/10 hover:bg-[#38BDF8] hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors" }, "\u7DE8\u8F2F"),
                React.createElement("button", { onClick: () => onDelete(v.id), className: "text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444] hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors" }, "\u522A\u9664"))))))),
        paginate && totalPages > 1 && (React.createElement("div", { className: "flex justify-center items-center gap-4 mt-6" },
            React.createElement("button", { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1, className: `px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${page === 1 ? "bg-[#181B25] text-gray-600 cursor-not-allowed" : "bg-[#1D2130] text-white hover:bg-[#2A2F3D]"}` }, "\u4E0A\u4E00\u9801"),
            React.createElement("span", { className: "text-[#94A3B8] text-xs font-bold" },
                "\u7B2C ",
                page,
                " / ",
                totalPages,
                " \u9801"),
            React.createElement("button", { onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages, className: `px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${page === totalPages ? "bg-[#181B25] text-gray-600 cursor-not-allowed" : "bg-[#1D2130] text-white hover:bg-[#2A2F3D]"}` }, "\u4E0B\u4E00\u9801")))));
};
// 在參數大括號的最後面加上 , onTestReminder
// 找到 AdminPage 的開頭，在大括號最後面補上 , onTestPush
const AdminPage = ({ user, vtubers, bulletins, collabs, updates, rules, tips, privateDocs, onSaveSettings, onDeleteVtuber, onVerifyVtuber, onRejectVtuber, onUpdateVtuber, onDeleteBulletin, onAddCollab, onDeleteCollab, onAddUpdate, onDeleteUpdate, showToast, onResetAllCollabTypes, onResetNatAndLang, autoFetchYouTubeInfo, onMassSyncSubs, isSyncingSubs, syncProgress, setIsSyncingSubs, setSyncProgress, onSendMassEmail, onMassSyncTwitch, defaultBulletinImages, onAddDefaultBulletinImage, onDeleteDefaultBulletinImage, onTestReminder, onTestPush, onMassUpdateVerification, onMassMigrateImages, articles, onVerifyArticle, onDeleteArticle, onEditArticle, onMigrateBulletinImages, handleAdminCleanBulletins, functionsInstance, massEmailSending, // 🌟 新增
massEmailCurrent, // 🌟 新增
massEmailTotal, // 🌟 新增
massEmailLog, }) => {
    const [editingArticleId, setEditingArticleId] = useState(null);
    const [articleEditForm, setArticleEditForm] = useState({ title: '', category: '', content: '', coverUrl: '' });
    const [adminEmailTo, setAdminEmailTo] = useState("");
    const [adminEmailSubject, setAdminEmailSubject] = useState("");
    const [adminEmailBody, setAdminEmailBody] = useState("");
    const [isAdminEmailSending, setIsAdminEmailSending] = useState(false);
    const [isTestEmailSending, setIsTestEmailSending] = useState(false);
    const [adminSendCurrent, setAdminSendCurrent] = useState(0);
    const [adminSendTotal, setAdminSendTotal] = useState(0);
    const [adminSendLog, setAdminSendLog] = useState("");
    const getAdminSortTime = (v) => {
        const getTime = (val) => {
            if (!val)
                return 0;
            if (typeof val === "number")
                return val;
            if (val.toMillis)
                return val.toMillis();
            return 0;
        };
        return getTime(v.createdAt) || getTime(v.updatedAt) || 0;
    };
    const pendingVtubers = vtubers
        .filter((v) => !v.isVerified &&
        !v.isBlacklisted &&
        v.verificationStatus !== "rejected")
        .sort((a, b) => getAdminSortTime(a) - getAdminSortTime(b));
    const rejectedVtubers = vtubers
        .filter((v) => !v.isVerified && v.verificationStatus === "rejected")
        .sort((a, b) => getAdminSortTime(b) - getAdminSortTime(a));
    const verifiedVtubers = vtubers
        .filter((v) => v.isVerified === true && !v.isBlacklisted)
        .sort((a, b) => getAdminSortTime(b) - getAdminSortTime(a));
    const blacklistedVtubers = vtubers
        .filter((v) => v.isBlacklisted)
        .sort((a, b) => getAdminSortTime(b) - getAdminSortTime(a));
    const [isRejectedExpanded, setIsRejectedExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState("vtubers");
    const [newCollab, setNewCollab] = useState({
        dateTime: "",
        title: "",
        streamUrl: "",
        coverUrl: "",
        category: "遊戲",
    });
    const [editRules, setEditRules] = useState(rules);
    const [editTips, setEditTips] = useState(tips);
    const [editingVtuber, setEditingVtuber] = useState(null);
    const handleMassCleanupChat = async () => {
        if (!confirm("確定要刪除全站所有 7 天前的對話紀錄嗎？"))
            return;
        setIsSyncingSubs(true);
        setSyncProgress("清理聊天紀錄中...");
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        try {
            const roomsSnap = await getDocs(collection(db, `artifacts/${APP_ID}/public/data/chat_rooms`));
            for (const room of roomsSnap.docs) {
                const oldMsgs = await getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/chat_rooms/${room.id}/messages`), where("createdAt", "<", oneWeekAgo)));
                for (const m of oldMsgs.docs) {
                    await deleteDoc(m.ref);
                }
            }
            showToast("✅ 已徹底清理一週前的舊訊息");
        }
        catch (e) {
            console.error(e);
            showToast("清理失敗");
        }
        setIsSyncingSubs(false);
        setSyncProgress("");
    };
    const handleEditClick = (v) => {
        const safeCollabTypes = Array.isArray(v.collabTypes) ? v.collabTypes : [];
        const standard = safeCollabTypes.filter((t) => PREDEFINED_COLLABS.includes(t));
        const other = safeCollabTypes.find((t) => !PREDEFINED_COLLABS.includes(t)) || "";
        const PREDEFINED_NATIONALITIES = ["台灣", "日本", "香港", "馬來西亞"];
        const PREDEFINED_LANGUAGES = ["國", "日", "英", "粵", "台語"];
        const PREDEFINED_PERSONALITIES = ["我是I人", "時I時E", "我大E人", "看心情"];
        const safeNats = Array.isArray(v.nationalities)
            ? v.nationalities
            : typeof v.nationalities === "string"
                ? [v.nationalities]
                : v.nationality
                    ? [v.nationality]
                    : [];
        const safeLangs = Array.isArray(v.languages)
            ? v.languages
            : typeof v.languages === "string"
                ? [v.languages]
                : v.language
                    ? [v.language]
                    : [];
        const isOtherN = safeNats.some((n) => !PREDEFINED_NATIONALITIES.includes(n));
        const otherNatText = isOtherN
            ? safeNats.find((n) => !PREDEFINED_NATIONALITIES.includes(n))
            : "";
        const stdNats = safeNats.filter((n) => PREDEFINED_NATIONALITIES.includes(n));
        const pType = v.personalityType || "";
        const isOtherP = pType && !PREDEFINED_PERSONALITIES.includes(pType);
        setEditingVtuber({
            ...v,
            name: v.name || "",
            description: v.description || "",
            tags: Array.isArray(v.tags) ? v.tags.join(", ") : v.tags || "",
            collabTypes: standard,
            isOtherCollab: !!other,
            otherCollabText: other,
            nationalities: stdNats,
            isOtherNationality: isOtherN,
            otherNationalityText: otherNatText || "",
            languages: safeLangs,
            personalityType: isOtherP ? "其他" : pType,
            personalityTypeOther: isOtherP ? pType : "",
            colorSchemes: v.colorSchemes || [],
            creatorRoles: Array.isArray(v.creatorRoles) ? v.creatorRoles : [],
            creatorPortfolioUrl: v.creatorPortfolioUrl || "",
            isScheduleAnytime: v.isScheduleAnytime || false,
            isScheduleExcept: v.isScheduleExcept || false,
            isScheduleCustom: v.isScheduleCustom || false,
            customScheduleText: v.customScheduleText || "",
            scheduleSlots: Array.isArray(v.scheduleSlots) ? v.scheduleSlots : [],
            youtubeSubscribers: v.youtubeSubscribers || v.subscribers || "",
            lastYoutubeFetchTime: v.lastYoutubeFetchTime || 0,
            twitchFollowers: v.twitchFollowers || "",
            lastTwitchFetchTime: v.lastTwitchFetchTime || 0,
            mainPlatform: v.mainPlatform || "YouTube",
            streamStyleUrl: v.streamStyleUrl || "",
            youtubeUrl: v.youtubeUrl || v.channelUrl || "",
            twitchUrl: v.twitchUrl || "",
            xUrl: v.xUrl || "",
            igUrl: v.igUrl || "",
            publicEmail: v.publicEmail || "",
            contactEmail: privateDocs[v.id]?.contactEmail || "",
            verificationNote: privateDocs[v.id]?.verificationNote || "",
            streamingStyle: v.streamingStyle || "一般型態",
            activityStatus: v.activityStatus || "active",
            likes: v.likes || 0,
            dislikes: v.dislikes || 0,
        });
    };
    const handleAdminPublish = () => {
        if (!newCollab.dateTime || !newCollab.streamUrl || !newCollab.title)
            return showToast("請完整填寫！");
        const dt = new Date(newCollab.dateTime);
        if (dt.getTime() < Date.now())
            return showToast("聯動時間不能在過去哦！");
        onAddCollab({
            ...newCollab,
            date: `${dt.getMonth() + 1}/${dt.getDate()} (${["日", "一", "二", "三", "四", "五", "六"][dt.getDay()]})`,
            time: `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`,
            startTimestamp: dt.getTime(),
        });
        setNewCollab({
            dateTime: "",
            title: "",
            streamUrl: "",
            coverUrl: "",
            category: "遊戲",
        });
    };
    // 👈 3. 修復 handleTestMail 變數未定義的問題
    const handleTestMail = async () => {
        const testEmail = prompt("請輸入要接收測試信的 Email：");
        if (!testEmail || !testEmail.includes("@"))
            return showToast("請輸入有效的 Email");
        try {
            const sendSystemEmail = httpsCallable(functionsInstance, "sendSystemEmail");
            const authToken = auth.currentUser ? await auth.currentUser.getIdToken(true) : "";
            await sendSystemEmail({
                authToken,
                to: testEmail,
                subject: "[V-Nexus] 公開工商信箱驗證碼測試",
                text: `您好，您的驗證碼是：123456\n請回到 V-Nexus 網頁輸入此 6 位數驗證碼以完成信箱綁定。`,
                otp: "123456",
                type: 'verify'
            });
            showToast("✅ 測試信件任務已發送！");
        }
        catch (err) {
            console.error("Test Mail Error:", err);
            showToast("❌ 寫入失敗，請按 F12 查看錯誤。");
        }
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "max-w-5xl mx-auto px-4 py-8 relative animate-fade-in-up" },
            React.createElement("div", { className: "text-center mb-8" },
                React.createElement("h2", { className: "text-3xl font-extrabold text-[#EF4444] mb-2" },
                    React.createElement("i", { className: "fa-solid fa-shield-halved mr-3" }),
                    "\u8D85\u7D1A\u7BA1\u7406\u54E1\u4E2D\u5FC3")),
            React.createElement("div", { className: "flex gap-2 overflow-x-auto pb-4 mb-6" }, [
                { id: "vtubers", icon: "fa-address-card", label: "名片與審核" },
                { id: "bulletins", icon: "fa-bullhorn", label: "招募管理" },
                { id: "collabs", icon: "fa-broadcast-tower", label: "時間表" },
                { id: "updates", icon: "fa-newspaper", label: "發布消息" },
                { id: 'articles', icon: 'fa-book-open', label: '寶典審核' },
                { id: "settings", icon: "fa-gear", label: "設定規範" },
            ].map((t) => (React.createElement("button", { key: t.id, onClick: () => setActiveTab(t.id), className: `px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap flex items-center gap-2 ${activeTab === t.id ? "bg-[#EF4444] text-white shadow-sm" : "bg-[#181B25] text-[#94A3B8] hover:bg-[#1D2130]"}` },
                React.createElement("i", { className: `fa-solid ${t.icon}` }),
                " ",
                t.label,
                t.id === "vtubers" && pendingVtubers.length > 0 && (React.createElement("span", { className: "bg-white text-red-600 px-2 py-0.5 rounded-full text-xs ml-1" }, pendingVtubers.length)))))),
            React.createElement("div", { className: "bg-[#181B25]/40 border border-[#2A2F3D] rounded-2xl p-6 shadow-sm" },
                activeTab === "vtubers" && (React.createElement("div", { className: "space-y-8" },
                    React.createElement(AdminVtuberList, { title: "\u5F85\u5BE9\u6838\u540D\u55AE", list: pendingVtubers, privateDocs: privateDocs, onVerify: onVerifyVtuber, onReject: onRejectVtuber, onEdit: handleEditClick, onDelete: onDeleteVtuber, paginate: true, showSearch: true }),
                    rejectedVtubers.length > 0 && (React.createElement("div", { className: "mb-8 border border-[#F59E0B]/20 rounded-2xl overflow-hidden" },
                        React.createElement("button", { onClick: () => setIsRejectedExpanded(!isRejectedExpanded), className: "w-full flex items-center justify-between p-4 bg-[#F59E0B]/5 hover:bg-[#F59E0B]/10 transition-colors" },
                            React.createElement("div", { className: "flex items-center gap-3" },
                                React.createElement("h3", { className: "text-xl font-bold text-[#F59E0B]" },
                                    "\u5DF2\u9000\u56DE\u540D\u55AE (",
                                    rejectedVtubers.length,
                                    ")"),
                                React.createElement("span", { className: "text-[10px] bg-[#F59E0B]/20 text-orange-300 px-2 py-0.5 rounded" },
                                    "\u9EDE\u64CA",
                                    isRejectedExpanded ? "收合" : "展開")),
                            React.createElement("i", { className: `fa-solid fa-chevron-${isRejectedExpanded ? "up" : "down"} text-[#F59E0B]` })),
                        isRejectedExpanded && (React.createElement("div", { className: "p-4 bg-[#0F111A]/30" },
                            React.createElement(AdminVtuberList, { title: "\u641C\u5C0B\u9000\u56DE\u540D\u55AE", list: rejectedVtubers, privateDocs: privateDocs, onVerify: onVerifyVtuber, onEdit: handleEditClick, onDelete: onDeleteVtuber, paginate: true, showSearch: true }))))),
                    React.createElement(AdminVtuberList, { title: "\u5DF2\u4E0A\u67B6\u540D\u7247", list: verifiedVtubers, privateDocs: privateDocs, onEdit: handleEditClick, onDelete: onDeleteVtuber, paginate: true, showSearch: true }),
                    React.createElement(AdminVtuberList, { title: "\u9ED1\u55AE\u907F\u96F7\u5340", list: blacklistedVtubers, privateDocs: privateDocs, onEdit: handleEditClick, onDelete: onDeleteVtuber, isBlacklist: true, paginate: true, showSearch: true }),
                    React.createElement("div", { className: "mt-12 pt-6 border-t border-[#EF4444]/50 flex flex-wrap gap-4" },
                        React.createElement("button", { onClick: onResetAllCollabTypes, className: "bg-[#3B171D] hover:bg-[#B91C1C] text-white px-6 py-3 rounded-xl font-bold" },
                            React.createElement("i", { className: "fa-solid fa-bomb mr-2" }),
                            "\u91CD\u7F6E\u6240\u6709\u4EBA\u806F\u52D5\u985E\u578B"),
                        React.createElement("button", { onClick: onMassUpdateVerification, disabled: isSyncingSubs, className: `px-6 py-3 rounded-xl font-bold flex items-center ${isSyncingSubs ? "bg-blue-900/50 cursor-not-allowed text-[#94A3B8]" : "bg-blue-900 hover:bg-[#0284C7] text-white"}` },
                            React.createElement("i", { className: "fa-solid fa-user-shield mr-2" }),
                            "\u4E00\u9375\u66F4\u6539\u9A57\u8B49\u5167\u5BB9\u70BA 'X'"),
                        React.createElement("button", { onClick: onResetNatAndLang, className: "bg-orange-900 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold" },
                            React.createElement("i", { className: "fa-solid fa-wrench mr-2" }),
                            "\u4FEE\u5FA9\u570B\u7C4D\u8A9E\u8A00\u683C\u5F0F"),
                        React.createElement("button", { onClick: onMassSyncSubs, disabled: isSyncingSubs, className: `px-6 py-3 rounded-xl font-bold flex items-center ${isSyncingSubs ? "bg-[#3B171D]/50 cursor-not-allowed text-[#94A3B8]" : "bg-[#3B171D] hover:bg-[#B91C1C] text-white"}` }, isSyncingSubs ? (React.createElement(React.Fragment, null,
                            React.createElement("i", { className: "fa-solid fa-spinner fa-spin mr-2" }),
                            " ",
                            syncProgress)) : (React.createElement(React.Fragment, null,
                            React.createElement("i", { className: "fa-brands fa-youtube mr-2" }),
                            "\u5F37\u5236\u540C\u6B65 YT \u8A02\u95B1"))),
                        React.createElement("button", { onClick: onMassSyncTwitch, disabled: isSyncingSubs, className: `px-6 py-3 rounded-xl font-bold flex items-center ${isSyncingSubs ? "bg-purple-900/50 cursor-not-allowed text-[#94A3B8]" : "bg-purple-900 hover:bg-[#7C3AED] text-white"}` }, isSyncingSubs ? (React.createElement(React.Fragment, null,
                            React.createElement("i", { className: "fa-solid fa-spinner fa-spin mr-2" }),
                            " ",
                            syncProgress)) : (React.createElement(React.Fragment, null,
                            React.createElement("i", { className: "fa-brands fa-twitch mr-2" }),
                            "\u5F37\u5236\u540C\u6B65 Twitch")))))),
                activeTab === "bulletins" && (React.createElement("div", { className: "space-y-4" },
                    React.createElement("div", { className: "flex justify-between items-center mb-4" },
                        React.createElement("h3", { className: "text-xl font-bold text-white" }, "\u62DB\u52DF\u6587\u7BA1\u7406"),
                        React.createElement("button", { onClick: handleAdminCleanBulletins, disabled: isSyncingSubs, className: "bg-[#D97706] hover:bg-[#F59E0B] text-[#0F111A] px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2" },
                            isSyncingSubs ? React.createElement("i", { className: "fa-solid fa-spinner fa-spin" }) : React.createElement("i", { className: "fa-solid fa-broom" }),
                            "\u7D50\u7B97\u4E26\u6E05\u7406\u904E\u671F\u62DB\u52DF")),
                    (bulletins || []).map((b) => {
                        // 👈 2. 補上發布者名稱與時間的計算，避免 undefined 報錯
                        const author = vtubers.find(v => v.id === b.userId);
                        const authorName = author ? author.name : "未知創作者";
                        const postedAt = formatTime(b.createdAt);
                        return (React.createElement("div", { key: b.id, className: "flex justify-between bg-[#0F111A] p-4 rounded-xl border border-[#2A2F3D] gap-4" },
                            React.createElement("div", { className: "flex-1" },
                                React.createElement("p", { className: "text-sm text-[#CBD5E1] mb-1" }, b.content),
                                React.createElement("p", { className: "text-xs text-[#64748B]" },
                                    authorName,
                                    " | ",
                                    postedAt)),
                            React.createElement("button", { onClick: () => onDeleteBulletin(b.id), className: "text-[#EF4444] bg-[#EF4444]/10 px-3 py-1.5 rounded-lg font-bold" }, "\u522A\u9664")));
                    }))),
                activeTab === "collabs" && (React.createElement("div", { className: "space-y-6" },
                    React.createElement("div", null,
                        React.createElement("h3", { className: "text-xl font-bold text-white mb-4" }, "\u65B0\u589E\u806F\u52D5\u6642\u9593"),
                        React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-4" },
                            React.createElement("div", null,
                                React.createElement("label", { className: "text-xs text-[#94A3B8] mb-1 block" },
                                    "\u806F\u52D5\u985E\u5225 ",
                                    React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                                React.createElement("select", { required: true, value: newCollab.category, onChange: (e) => setNewCollab({ ...newCollab, category: e.target.value }), className: inputCls }, COLLAB_CATEGORIES.map((c) => (React.createElement("option", { key: c, value: c }, c))))),
                            React.createElement("div", null,
                                React.createElement("label", { className: "text-xs text-[#94A3B8] mb-1 block" },
                                    "\u806F\u52D5\u6642\u9593 ",
                                    React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                                React.createElement(DateTimePicker, { value: newCollab.dateTime, onChange: (val) => setNewCollab({ ...newCollab, dateTime: val }), className: inputCls })),
                            React.createElement("div", { className: "relative" },
                                React.createElement("label", { className: "text-xs text-[#94A3B8] mb-1 block" },
                                    "\u76F4\u64AD\u9023\u7D50 ",
                                    React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                                React.createElement("div", { className: "flex gap-2" },
                                    React.createElement("input", { type: "url", placeholder: "\u76F4\u64AD\u9023\u7D50...", value: newCollab.streamUrl, onChange: (e) => setNewCollab({
                                            ...newCollab,
                                            streamUrl: e.target.value,
                                        }), className: inputCls }),
                                    React.createElement("button", { type: "button", onClick: () => autoFetchYouTubeInfo(newCollab.streamUrl, (t) => setNewCollab((p) => ({ ...p, title: t })), (c) => setNewCollab((p) => ({ ...p, coverUrl: c })), showToast), className: "bg-[#1D2130] hover:bg-[#2A2F3D] text-white px-4 rounded-xl text-xs font-bold transition-colors" },
                                        React.createElement("i", { className: "fa-solid fa-wand-magic-sparkles mr-1" }),
                                        "\u6293\u53D6")),
                                React.createElement("p", { className: "text-[10px] text-[#A78BFA]/80 mt-1" }, "\uFF08\u653E\u5165\u9023\u7D50\u6309\u4E0B\u5C31\u53EF\u4EE5\u81EA\u52D5\u6293\u53D6YT\u7E2E\u5716\u53CA\u6A19\u984C\uFF09"))),
                        React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4" },
                            React.createElement("input", { type: "text", placeholder: "\u806F\u52D5\u6A19\u984C", value: newCollab.title, onChange: (e) => setNewCollab({ ...newCollab, title: e.target.value }), className: inputCls }),
                            React.createElement("input", { type: "url", placeholder: "\u81EA\u8A02\u5C01\u9762\u5716", value: newCollab.coverUrl, onChange: (e) => setNewCollab({ ...newCollab, coverUrl: e.target.value }), className: inputCls })),
                        React.createElement("button", { onClick: handleAdminPublish, className: "bg-[#EF4444] text-white px-6 py-2 rounded-lg font-bold" }, "\u767C\u5E03")),
                    React.createElement("div", { className: "border-t border-[#2A2F3D] pt-6 space-y-4" },
                        React.createElement("h3", { className: "text-lg font-bold text-white mb-4" }, "\u73FE\u6709\u6E05\u55AE"),
                        (collabs || []).map((c) => (React.createElement("div", { key: c.id, className: "flex justify-between bg-[#0F111A] p-4 rounded-xl border border-[#2A2F3D]" },
                            React.createElement("div", null,
                                React.createElement("p", { className: "font-bold text-white text-sm" },
                                    "[",
                                    c.date,
                                    " ",
                                    c.time,
                                    "] ",
                                    c.title)),
                            React.createElement("button", { onClick: () => onDeleteCollab(c.id), className: "text-[#EF4444] bg-[#EF4444]/10 px-3 py-1.5 rounded-lg" }, "\u522A\u9664"))))))),
                activeTab === "updates" && (React.createElement("div", { className: "space-y-6" },
                    React.createElement("div", null,
                        React.createElement("h3", { className: "text-xl font-bold text-white mb-4" }, "\u767C\u5E03\u6700\u65B0\u6D88\u606F / \u529F\u80FD\u66F4\u65B0"),
                        React.createElement("form", { onSubmit: (e) => {
                                e.preventDefault();
                                onAddUpdate({
                                    title: e.target.updateTitle.value,
                                    content: e.target.updateContent.value,
                                    date: new Date().toLocaleDateString("zh-TW"),
                                });
                                e.target.reset();
                            } },
                            React.createElement("div", { className: "mb-4" },
                                React.createElement("label", { className: "text-xs text-[#94A3B8] mb-1 block" },
                                    "\u6A19\u984C ",
                                    React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                                React.createElement("input", { required: true, type: "text", name: "updateTitle", className: inputCls, placeholder: "\u4F8B\u5982\uFF1A\u65B0\u589E\u7AD9\u5167\u4FE1\u529F\u80FD\uFF01" })),
                            React.createElement("div", { className: "mb-4" },
                                React.createElement("label", { className: "text-xs text-[#94A3B8] mb-1 block" },
                                    "\u5167\u5BB9 ",
                                    React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                                React.createElement("textarea", { required: true, name: "updateContent", className: inputCls + " resize-none", rows: "4" })),
                            React.createElement("div", { className: "flex justify-end" },
                                React.createElement("button", { type: "submit", className: "bg-[#38BDF8] hover:bg-[#38BDF8] text-[#0F111A] px-6 py-2 rounded-lg font-bold shadow-sm" }, "\u767C\u5E03\u516C\u544A")))),
                    React.createElement("div", { className: "border-t border-[#2A2F3D] pt-6 space-y-4" },
                        React.createElement("h3", { className: "text-lg font-bold text-white mb-4" }, "\u6B77\u53F2\u516C\u544A"),
                        (updates || []).map((u) => (React.createElement("div", { key: u.id, className: "flex flex-col sm:flex-row sm:justify-between bg-[#0F111A] p-4 rounded-xl border border-[#2A2F3D] gap-4" },
                            React.createElement("div", { className: "flex-1 min-w-0" },
                                React.createElement("p", { className: "font-bold text-white text-sm truncate" },
                                    u.title,
                                    " ",
                                    React.createElement("span", { className: "text-xs text-[#64748B] font-normal ml-2" }, u.date)),
                                React.createElement("p", { className: "text-xs text-[#94A3B8] mt-1 line-clamp-2" }, u.content)),
                            React.createElement("button", { onClick: () => onDeleteUpdate(u.id), className: "text-[#EF4444] bg-[#EF4444]/10 px-3 py-1.5 rounded-lg flex-shrink-0 font-bold self-start" }, "\u522A\u9664"))))),
                    React.createElement("div", { className: "border-t border-[#2A2F3D] pt-6 mt-6" },
                        React.createElement("div", { className: "flex items-center justify-between mb-4" },
                            React.createElement("div", null,
                                React.createElement("h3", { className: "text-xl font-bold text-white" },
                                    React.createElement("i", { className: "fa-solid fa-paper-plane text-[#A78BFA] mr-2" }),
                                    "\u767C\u9001\u5168\u7AD9\u7CFB\u7D71\u901A\u77E5\u4FE1"),
                                React.createElement("p", { className: "text-sm text-[#94A3B8] mt-1" }, "\u5C07\u7531\u5F8C\u7AEF\u5BC4\u9001\u7D66\u5168\u7AD9\u6709 Email \u7684\u4F7F\u7528\u8005\uFF1B\u5275\u4F5C\u8005\u512A\u5148\u4F7F\u7528\u540D\u7247\u4FE1\u7BB1\uFF0C\u672A\u586B\u5BEB\u5247\u4F7F\u7528\u767B\u5165\u4FE1\u7BB1\u3002")),
                            React.createElement("button", { onClick: async () => {
                                    setIsTestEmailSending(true);
                                    try {
                                        const fn = httpsCallable(functionsInstance, "sendMassEmail");
                                        const authToken = auth.currentUser ? await auth.currentUser.getIdToken(true) : "";
                                        const now = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
                                        const res = await fn({
                                            authToken,
                                            subject: "系統測試信",
                                            text: `這是一封來自 V-Nexus 後端的測試信！\n\n發送時間（台北時間）：${now}\n\n如果您收到這封信，代表系統通知信功能運作正常。\n\n— V-Nexus 系統`,
                                            testOnly: true, // 告訴後端只寄給管理員自己
                                        });
                                        if (res.data?.success)
                                            showToast("✅ 測試信已寄出！請至信箱確認");
                                        else
                                            showToast(`❌ 失敗：${res.data?.message}`);
                                    }
                                    catch (e) {
                                        showToast(`❌ 呼叫失敗：${e.message}`);
                                    }
                                    finally {
                                        setIsTestEmailSending(false);
                                    }
                                }, 
                                // 🌟 修正：使用 isAdminEmailSending
                                disabled: isTestEmailSending || isAdminEmailSending, className: "flex items-center gap-1.5 bg-[#1D2130] hover:bg-[#2A2F3D] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors flex-shrink-0" }, isTestEmailSending
                                ? React.createElement(React.Fragment, null,
                                    React.createElement("i", { className: "fa-solid fa-circle-notch animate-spin text-[#C4B5FD]" }),
                                    React.createElement("span", null, "\u5BC4\u9001\u4E2D..."))
                                : React.createElement(React.Fragment, null,
                                    React.createElement("i", { className: "fa-solid fa-flask text-[#F59E0B]" }),
                                    React.createElement("span", null, "\u5BC4\u6E2C\u8A66\u4FE1\u7D66\u81EA\u5DF1")))),
                        React.createElement("div", { className: "space-y-3" },
                            React.createElement("div", null,
                                React.createElement("label", { className: "block text-xs font-medium text-[#94A3B8] mb-1.5" },
                                    React.createElement("i", { className: "fa-solid fa-heading mr-1 text-[#A78BFA]" }),
                                    "\u4E3B\u65E8"),
                                React.createElement("input", { type: "text", value: adminEmailSubject, onChange: e => setAdminEmailSubject(e.target.value), placeholder: "\u4F8B\uFF1A\u91CD\u8981\u7CFB\u7D71\u516C\u544A", maxLength: 100, 
                                    // 🌟 修正：使用 isAdminEmailSending
                                    disabled: isAdminEmailSending, className: inputCls }),
                                React.createElement("p", { className: "text-right text-xs text-gray-600 mt-1" },
                                    adminEmailSubject.length,
                                    " / 100")),
                            React.createElement("div", null,
                                React.createElement("label", { className: "block text-xs font-medium text-[#94A3B8] mb-1.5" },
                                    React.createElement("i", { className: "fa-solid fa-align-left mr-1 text-[#A78BFA]" }),
                                    "\u5167\u5BB9"),
                                React.createElement("textarea", { value: adminEmailBody, onChange: e => setAdminEmailBody(e.target.value), placeholder: "\u8ACB\u8F38\u5165\u4FE1\u4EF6\u5167\u6587\u2026\u2026", rows: 5, 
                                    // 🌟 修正：使用 isAdminEmailSending
                                    disabled: isAdminEmailSending, className: inputCls + " resize-none" })),
                            isAdminEmailSending && (React.createElement("div", { className: "bg-[#181B25] border border-white/10 rounded-xl p-4 space-y-3" },
                                React.createElement("div", { className: "flex justify-between items-center text-sm" },
                                    React.createElement("span", { className: "text-[#C4B5FD] font-bold" },
                                        React.createElement("i", { className: "fa-solid fa-server mr-2" }),
                                        "\u4F3A\u670D\u5668\u80CC\u666F\u767C\u9001\u4E2D...")),
                                React.createElement("div", { className: "w-full bg-[#1D2130] rounded-full h-2.5 overflow-hidden relative" },
                                    React.createElement("div", { className: "bg-[#8B5CF6] h-2.5 rounded-full absolute top-0 left-0 w-1/3 animate-ping", style: { animationDuration: '1.5s' } }),
                                    React.createElement("div", { className: "bg-purple-400 h-2.5 rounded-full absolute top-0 left-0 w-full" })),
                                React.createElement("p", { className: "text-xs text-[#94A3B8]" }, "\u4FE1\u4EF6\u6B63\u7531\u5F8C\u7AEF\u9010\u4E00\u5BC4\u51FA\uFF0C\u9019\u53EF\u80FD\u9700\u8981\u5E7E\u5206\u9418\u7684\u6642\u9593\uFF0C\u8ACB\u8010\u5FC3\u7B49\u5019\u3002"))),
                            React.createElement("button", { onClick: async () => {
                                    if (!adminEmailSubject.trim())
                                        return showToast("❌ 請填寫主旨");
                                    if (!adminEmailBody.trim())
                                        return showToast("❌ 請填寫內容");
                                    if (!confirm("確定要發送給全站所有有 Email 的使用者嗎？此動作不可逆！"))
                                        return;
                                    // 🌟 修正：使用 isAdminEmailSending
                                    setIsAdminEmailSending(true);
                                    try {
                                        const fn = httpsCallable(functionsInstance, "sendMassEmail");
                                        const authToken = auth.currentUser ? await auth.currentUser.getIdToken(true) : "";
                                        const res = await fn({ authToken, subject: adminEmailSubject.trim(), text: adminEmailBody.trim() });
                                        if (res.data?.success) {
                                            showToast(`✅ ${res.data.message}`);
                                            setAdminEmailSubject("");
                                            setAdminEmailBody("");
                                        }
                                        else {
                                            showToast(`❌ ${res.data?.message}`);
                                        }
                                    }
                                    catch (e) {
                                        showToast(`❌ 呼叫失敗：${e.message}`);
                                    }
                                    finally {
                                        // 🌟 修正：使用 isAdminEmailSending
                                        setIsAdminEmailSending(false);
                                    }
                                }, 
                                // 🌟 修正：使用 isAdminEmailSending
                                disabled: isAdminEmailSending || !adminEmailSubject.trim() || !adminEmailBody.trim(), className: "w-full flex items-center justify-center gap-2 bg-[#8B5CF6] hover:bg-[#8B5CF6] disabled:bg-[#1D2130] disabled:text-[#64748B] disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition-colors text-sm" }, isAdminEmailSending
                                ? React.createElement(React.Fragment, null,
                                    React.createElement("i", { className: "fa-solid fa-circle-notch animate-spin" }),
                                    React.createElement("span", null, "\u767C\u9001\u4E2D\uFF0C\u8ACB\u52FF\u95DC\u9589\u8996\u7A97..."))
                                : React.createElement(React.Fragment, null,
                                    React.createElement("i", { className: "fa-solid fa-paper-plane" }),
                                    React.createElement("span", null, "\u767C\u9001\u7D66\u5168\u7AD9\u4F7F\u7528\u8005"))))))),
                activeTab === 'articles' && (React.createElement("div", { className: "space-y-6" },
                    React.createElement("h3", { className: "text-xl font-bold text-white mb-4" }, "\u5BF6\u5178\u6587\u7AE0\u5BE9\u6838\u7CFB\u7D71"),
                    React.createElement("div", { className: "space-y-4" },
                        React.createElement("h4", { className: "text-[#F59E0B] font-bold border-b border-[#2A2F3D] pb-2" },
                            "\u5F85\u5BE9\u6838\u6587\u7AE0 (",
                            (articles || []).filter(a => a.status === 'pending').length,
                            ")"),
                        (articles || []).filter(a => a.status === 'pending').length === 0 ? React.createElement("p", { className: "text-[#64748B] bg-[#0F111A]/50 p-4 rounded-xl border border-dashed border-[#2A2F3D] text-center" }, "\u7121\u5F85\u5BE9\u6838\u6587\u7AE0") : (articles || []).filter(a => a.status === 'pending').map(a => (React.createElement("div", { key: a.id, className: "bg-[#0F111A] border border-[#F59E0B]/30 p-5 rounded-xl flex flex-col sm:flex-row gap-4 justify-between hover:border-[#F59E0B]/60 transition-colors" },
                            React.createElement("div", null,
                                React.createElement("div", { className: "flex items-center gap-2 mb-2" },
                                    React.createElement("span", { className: "text-xs bg-[#38BDF8]/20 text-[#38BDF8] px-2 py-0.5 rounded border border-[#38BDF8]/30" }, a.category),
                                    React.createElement("span", { className: "font-bold text-white text-lg" }, a.title)),
                                React.createElement("p", { className: "text-[#94A3B8] text-sm line-clamp-3 mt-2 bg-[#181B25] p-3 rounded-lg" }, a.content)),
                            React.createElement("div", { className: "flex gap-2 flex-shrink-0 self-start sm:self-center" },
                                React.createElement("button", { onClick: () => onVerifyArticle(a.id), className: "bg-[#22C55E]/80 hover:bg-[#22C55E] text-[#0F111A] px-4 py-2 rounded-lg font-bold text-sm transition-transform" },
                                    React.createElement("i", { className: "fa-solid fa-check mr-1" }),
                                    "\u6838\u51C6\u5F35\u8CBC"),
                                React.createElement("button", { onClick: () => { setEditingArticleId(a.id); setArticleEditForm({ title: a.title, category: a.category, content: a.content, coverUrl: a.coverUrl || '' }); }, className: "bg-[#38BDF8]/80 hover:bg-[#38BDF8] text-[#0F111A] px-4 py-2 rounded-lg font-bold text-sm transition-transform" },
                                    React.createElement("i", { className: "fa-solid fa-pen mr-1" }),
                                    "\u7DE8\u8F2F"),
                                React.createElement("button", { onClick: () => onDeleteArticle(a.id), className: "bg-[#EF4444]/80 hover:bg-[#EF4444] text-white px-4 py-2 rounded-lg font-bold text-sm transition-transform" },
                                    React.createElement("i", { className: "fa-solid fa-xmark mr-1" }),
                                    "\u62D2\u7D55/\u522A\u9664")))))),
                    React.createElement("div", { className: "space-y-4 mt-8 pt-8 border-t border-[#2A2F3D]" },
                        React.createElement("h4", { className: "text-[#22C55E] font-bold border-b border-[#2A2F3D] pb-2" },
                            "\u5DF2\u767C\u5E03\u6587\u7AE0 (",
                            (articles || []).filter(a => a.status === 'published').length,
                            ")"),
                        (articles || []).filter(a => a.status === 'published').map(a => (React.createElement("div", { key: a.id, className: "bg-[#181B25] border border-[#2A2F3D] p-4 rounded-xl flex justify-between items-center gap-4" },
                            React.createElement("div", { className: "min-w-0 flex-1" },
                                React.createElement("span", { className: "font-bold text-white truncate block" },
                                    a.title,
                                    " ",
                                    React.createElement("span", { className: "text-xs text-[#38BDF8] font-normal ml-2 bg-[#38BDF8]/10 px-2 py-0.5 rounded" },
                                        "(",
                                        a.category,
                                        ")"))),
                            React.createElement("button", { onClick: () => { setEditingArticleId(a.id); setArticleEditForm({ title: a.title, category: a.category, content: a.content, coverUrl: a.coverUrl || '' }); }, className: "text-[#38BDF8] bg-[#38BDF8]/10 hover:bg-[#38BDF8] hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex-shrink-0" }, "\u7DE8\u8F2F"),
                            React.createElement("button", { onClick: () => onDeleteArticle(a.id), className: "text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444] hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex-shrink-0" }, "\u5F37\u5236\u522A\u9664"))))))),
                editingArticleId && (React.createElement("div", { className: "fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" },
                    React.createElement("div", { className: "bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-sm overflow-hidden" },
                        React.createElement("div", { className: "bg-[#181B25] px-6 py-4 border-b border-[#2A2F3D] flex justify-between items-center" },
                            React.createElement("h3", { className: "font-bold text-white" },
                                React.createElement("i", { className: "fa-solid fa-pen text-[#38BDF8] mr-2" }),
                                "\u7DE8\u8F2F\u6587\u7AE0"),
                            React.createElement("button", { onClick: () => setEditingArticleId(null), className: "text-[#94A3B8] hover:text-white" },
                                React.createElement("i", { className: "fa-solid fa-xmark text-xl" }))),
                        React.createElement("div", { className: "p-6 overflow-y-auto space-y-4" },
                            React.createElement("div", null,
                                React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-1" }, "\u6A19\u984C"),
                                React.createElement("input", { type: "text", value: articleEditForm.title, onChange: e => setArticleEditForm({ ...articleEditForm, title: e.target.value }), className: "w-full bg-[#181B25] border border-[#2A2F3D] rounded-lg p-2 text-white outline-none focus:border-[#38BDF8]" })),
                            React.createElement("div", { className: "grid grid-cols-2 gap-4" },
                                React.createElement("div", null,
                                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-1" }, "\u5206\u985E"),
                                    React.createElement("select", { value: articleEditForm.category, onChange: e => setArticleEditForm({ ...articleEditForm, category: e.target.value }), className: "w-full bg-[#181B25] border border-[#2A2F3D] rounded-lg p-2 text-white outline-none focus:border-[#38BDF8]" }, ARTICLE_CATEGORIES.map(c => React.createElement("option", { key: c, value: c }, c)))),
                                React.createElement("div", null,
                                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-1" }, "\u5C01\u9762\u7DB2\u5740 (\u4E0D\u6539\u8ACB\u7559\u7A7A)"),
                                    React.createElement("input", { type: "text", value: articleEditForm.coverUrl, onChange: e => setArticleEditForm({ ...articleEditForm, coverUrl: e.target.value }), className: "w-full bg-[#181B25] border border-[#2A2F3D] rounded-lg p-2 text-white outline-none focus:border-[#38BDF8]" }))),
                            React.createElement("div", null,
                                React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-1" }, "\u5167\u6587"),
                                React.createElement("textarea", { rows: "10", value: articleEditForm.content, onChange: e => setArticleEditForm({ ...articleEditForm, content: e.target.value }), className: "w-full bg-[#181B25] border border-[#2A2F3D] rounded-lg p-2 text-white outline-none focus:border-[#38BDF8] font-mono text-sm" }))),
                        React.createElement("div", { className: "bg-[#181B25] px-6 py-4 border-t border-[#2A2F3D] flex justify-end gap-3" },
                            React.createElement("button", { onClick: () => setEditingArticleId(null), className: "px-4 py-2 text-[#94A3B8] hover:text-white font-bold transition-colors" }, "\u53D6\u6D88"),
                            React.createElement("button", { onClick: () => { onEditArticle(editingArticleId, articleEditForm); setEditingArticleId(null); }, className: "bg-[#38BDF8] hover:bg-[#38BDF8] text-[#0F111A] px-6 py-2 rounded-lg font-bold shadow transition-transform" }, "\u5132\u5B58\u4FEE\u6539"))))),
                activeTab === "settings" && (React.createElement("div", { className: "space-y-8" },
                    React.createElement("div", null,
                        React.createElement("h3", { className: "text-xl font-bold text-white mb-2" }, "\u7DE8\u8F2F\u898F\u7BC4"),
                        React.createElement("textarea", { value: editRules, onChange: (e) => setEditRules(e.target.value), className: inputCls + " resize-none", rows: "8" })),
                    React.createElement("div", { className: "flex justify-end" },
                        React.createElement("button", { onClick: () => onSaveSettings(undefined, editRules), className: "bg-[#EF4444] text-white px-8 py-2.5 rounded-xl font-bold" }, "\u5132\u5B58\u898F\u7BC4")),
                    React.createElement("div", null,
                        React.createElement("h3", { className: "text-xl font-bold text-white mb-2" }, "\u7DE8\u8F2F\u5C0F\u6280\u5DE7"),
                        React.createElement("textarea", { value: editTips, onChange: (e) => setEditTips(e.target.value), className: inputCls + " resize-none", rows: "8" })),
                    React.createElement("div", { className: "flex justify-end" },
                        React.createElement("button", { onClick: () => onSaveSettings(editTips, undefined), className: "bg-[#EF4444] text-white px-8 py-2.5 rounded-xl font-bold" }, "\u5132\u5B58\u5C0F\u6280\u5DE7")),
                    React.createElement("div", { className: "mt-8 border-t border-[#2A2F3D] pt-8" },
                        React.createElement("h3", { className: "text-xl font-bold text-white mb-2" },
                            React.createElement("i", { className: "fa-solid fa-images text-[#A78BFA] mr-2" }),
                            "\u62DB\u52DF\u4F48\u544A\u6B04\u9810\u8A2D\u5716\u7247\u5EAB"),
                        React.createElement("p", { className: "text-sm text-[#94A3B8] mb-4" }, "\u7576\u4F7F\u7528\u8005\u767C\u4E00\u500B\u62DB\u52DF\u4F01\u5283\u6C92\u6709\u4E0A\u50B3\u5716\u7247\u6642\uFF0C\u5C07\u5F9E\u9019\u88E1\u96A8\u6A5F\u6311\u9078\u4E00\u5F35\u986F\u793A\u3002"),
                        React.createElement("div", { className: "flex flex-wrap gap-4 mb-4" }, (defaultBulletinImages || []).map((img, idx) => (React.createElement("div", { key: idx, className: "relative group w-32 h-24" },
                            React.createElement("img", { src: sanitizeUrl(img), className: "w-full h-full object-cover rounded-xl border border-[#2A2F3D]" }),
                            React.createElement("button", { onClick: () => onDeleteDefaultBulletinImage(idx), className: "absolute top-1 right-1 bg-[#EF4444]/90 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity" },
                                React.createElement("i", { className: "fa-solid fa-trash text-xs" })))))),
                        React.createElement("div", { className: "relative w-full sm:w-64" },
                            React.createElement("input", { type: "file", accept: "image/png, image/jpeg, image/webp", onChange: async (e) => {
                                    const file = e.target.files[0];
                                    if (!file)
                                        return;
                                    if (file.size > 5 * 1024 * 1024) {
                                        e.target.value = "";
                                        return showToast("❌ 圖片不能超過5MB");
                                    }
                                    showToast("⏳ 處理中...");
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        const img = new Image();
                                        img.onload = () => {
                                            const canvas = document.createElement("canvas");
                                            let w = img.width, h = img.height;
                                            const maxW = 800, maxH = 800;
                                            if (w > maxW || h > maxH) {
                                                const r = Math.min(maxW / w, maxH / h);
                                                w *= r;
                                                h *= r;
                                            }
                                            canvas.width = w;
                                            canvas.height = h;
                                            canvas.getContext("2d").drawImage(img, 0, 0, w, h);
                                            onAddDefaultBulletinImage(canvas.toDataURL("image/jpeg", 0.8));
                                            e.target.value = "";
                                        };
                                        img.src = event.target.result;
                                    };
                                    reader.readAsDataURL(file);
                                }, className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" }),
                            React.createElement("button", { className: "w-full bg-[#181B25] hover:bg-[#1D2130] text-white py-2 rounded-xl border border-[#2A2F3D] transition-colors flex items-center justify-center gap-2" },
                                React.createElement("i", { className: "fa-solid fa-plus" }),
                                " \u65B0\u589E\u9810\u8A2D\u5716\u7247"))),
                    React.createElement("div", { className: "mt-8 border-t border-[#2A2F3D] pt-8" },
                        React.createElement("h3", { className: "text-xl font-bold text-white mb-2" },
                            React.createElement("i", { className: "fa-solid fa-envelope-circle-check text-[#38BDF8] mr-2" }),
                            "Email \u7CFB\u7D71\u6E2C\u8A66"),
                        React.createElement("p", { className: "text-sm text-[#94A3B8] mb-4" }, "\u5982\u679C Firebase \u5F8C\u53F0\u6C92\u6709\u770B\u5230 mail \u8DEF\u5F91\uFF0C\u8ACB\u9EDE\u64CA\u4E0B\u65B9\u6309\u9215\u5BEB\u5165\u4E00\u7B46\u6E2C\u8A66\u8CC7\u6599\uFF0C\u8DEF\u5F91\u5C31\u6703\u81EA\u52D5\u51FA\u73FE\u3002"),
                        React.createElement("button", { onClick: handleTestMail, className: "bg-[#38BDF8] hover:bg-[#38BDF8] text-[#0F111A] px-6 py-2.5 rounded-xl font-bold shadow-sm" }, "\u5BEB\u5165\u4E00\u7B46\u6E2C\u8A66\u4FE1\u4EF6")),
                    React.createElement("div", { className: "mt-8 border-t border-[#2A2F3D] pt-8" },
                        React.createElement("h3", { className: "text-xl font-bold text-white mb-2" },
                            React.createElement("i", { className: "fa-brands fa-youtube text-[#EF4444] mr-2" }),
                            "YouTube API \u6E2C\u8A66"),
                        React.createElement("p", { className: "text-sm text-[#94A3B8] mb-4" }, "\u8F38\u5165\u4EFB\u610F YouTube \u983B\u9053\u7DB2\u5740\uFF0C\u6E2C\u8A66\u5F8C\u7AEF\u6293\u53D6\u529F\u80FD\u662F\u5426\u6B63\u5E38\u904B\u4F5C\u3002"),
                        React.createElement("div", { className: "flex gap-2" },
                            React.createElement("input", { id: "testYoutubeUrl", type: "url", placeholder: "https://www.youtube.com/...", className: inputCls + " flex-1" }),
                            React.createElement("button", { onClick: async () => {
                                    const url = document.getElementById("testYoutubeUrl").value;
                                    if (!url)
                                        return showToast("請輸入網址");
                                    showToast("⏳ 抓取中...");
                                    try {
                                        const res = await httpsCallable(functionsInstance, "fetchYouTubeStats")({ url });
                                        if (res.data && res.data.success) {
                                            showToast(`✅ 抓取成功！訂閱數：${res.data.subscriberCount}`);
                                        }
                                        else {
                                            showToast(`❌ 失敗：${res.data?.message || "未知錯誤"}`);
                                        }
                                    }
                                    catch (e) {
                                        showToast(`❌ 錯誤：${e.message}`);
                                    }
                                }, className: "bg-[#EF4444] hover:bg-[#EF4444] text-white px-6 py-2.5 rounded-xl font-bold shadow-sm whitespace-nowrap" }, "\u6E2C\u8A66\u6293\u53D6"))),
                    React.createElement("div", { className: "mt-8 border-t border-[#2A2F3D] pt-8" },
                        React.createElement("h3", { className: "text-xl font-bold text-white mb-2" },
                            React.createElement("i", { className: "fa-brands fa-twitch text-[#A78BFA] mr-2" }),
                            "Twitch API \u6E2C\u8A66"),
                        React.createElement("p", { className: "text-sm text-[#94A3B8] mb-4" }, "\u8F38\u5165\u4EFB\u610F Twitch \u983B\u9053\u7DB2\u5740\uFF0C\u6E2C\u8A66\u5F8C\u7AEF\u6293\u53D6\u529F\u80FD\u662F\u5426\u6B63\u5E38\u904B\u4F5C\u3002"),
                        React.createElement("div", { className: "flex gap-2" },
                            React.createElement("input", { id: "testTwitchUrl", type: "url", placeholder: "https://www.twitch.tv/...", className: inputCls + " flex-1" }),
                            React.createElement("button", { onClick: async () => {
                                    const url = document.getElementById("testTwitchUrl").value;
                                    if (!url)
                                        return showToast("請輸入網址");
                                    showToast("⏳ 抓取中...");
                                    try {
                                        const res = await httpsCallable(functionsInstance, "fetchTwitchStats")({ url });
                                        if (res.data && res.data.success) {
                                            showToast(`✅ 抓取成功！追隨數：${res.data.followerCount}`);
                                        }
                                        else {
                                            showToast(`❌ 失敗：${res.data?.message || "未知錯誤"}`);
                                        }
                                    }
                                    catch (e) {
                                        showToast(`❌ 錯誤：${e.message}`);
                                    }
                                }, className: "bg-[#8B5CF6] hover:bg-[#8B5CF6] text-white px-6 py-2.5 rounded-xl font-bold shadow-sm whitespace-nowrap" }, "\u6E2C\u8A66\u6293\u53D6"))),
                    React.createElement("div", { className: "mt-8 border-t border-[#2A2F3D] pt-8" },
                        React.createElement("h3", { className: "text-xl font-bold text-white mb-2" },
                            React.createElement("i", { className: "fa-solid fa-mobile-screen-button text-[#38BDF8] mr-2" }),
                            "\u624B\u6A5F\u63A8\u64AD\u529F\u80FD\u6E2C\u8A66"),
                        React.createElement("p", { className: "text-sm text-[#94A3B8] mb-4" }, "\u6B64\u529F\u80FD\u50C5\u9650\u5728\u624B\u6A5F\u300C\u52A0\u5165\u4E3B\u756B\u9762\u300D\u5F8C\u4F7F\u7528\u3002\u9EDE\u64CA\u6309\u9215\u5C07\u767C\u9001\u4E00\u5247\u63A8\u64AD\u901A\u77E5\u7D66\u60A8\u81EA\u5DF1\u3002"),
                        React.createElement("button", { onClick: onTestPush, className: "bg-[#38BDF8] hover:bg-[#38BDF8] text-[#0F111A] px-6 py-2.5 rounded-xl font-bold shadow-sm transition-transform" }, "\u7ACB\u5373\u6E2C\u8A66\u624B\u6A5F\u63A8\u64AD"),
                        React.createElement("button", { onClick: async () => {
                                if (!confirm("確定要徹底刪除全站 7 天前的舊訊息嗎？"))
                                    return;
                                showToast("⏳ 正在清理中...");
                                const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                                const roomsSnap = await getDocs(collection(db, `artifacts/${APP_ID}/public/data/chat_rooms`));
                                for (const room of roomsSnap.docs) {
                                    const oldMsgs = await getDocs(query(collection(db, `${room.ref.path}/messages`), where("createdAt", "<", oneWeekAgo)));
                                    oldMsgs.forEach((m) => deleteDoc(m.ref));
                                }
                                showToast("✅ 清理完畢");
                            }, className: "bg-[#3B171D] text-white px-4 py-2 rounded-lg ml-4" }, "\u6E05\u7406\u904E\u671F\u8A0A\u606F")),
                    React.createElement("div", { className: "mt-8 border-t border-[#2A2F3D] pt-8" },
                        React.createElement("h3", { className: "text-xl font-bold text-white mb-2" },
                            React.createElement("i", { className: "fa-solid fa-clock-rotate-left text-[#F59E0B] mr-2" }),
                            "\u806F\u52D5\u63D0\u9192\u7CFB\u7D71\u6E2C\u8A66"),
                        React.createElement("p", { className: "text-sm text-[#94A3B8] mb-4" }, "\u9EDE\u64CA\u4E0B\u65B9\u6309\u9215\u5C07\u5EFA\u7ACB\u4E00\u7B46\u300C1\u5C0F\u6642\u5F8C\u958B\u59CB\u300D\u7684\u865B\u64EC\u806F\u52D5\u884C\u7A0B\u3002\u5EFA\u7ACB\u5F8C\uFF0C\u7CFB\u7D71\u6703\u81EA\u52D5\u5075\u6E2C\u4E26\u7ACB\u5373\u767C\u9001\u63D0\u9192\u4FE1\u4EF6\u81F3\u60A8\u7684\u4FE1\u7BB1\uFF0C\u4EE5\u78BA\u8A8D\u63D0\u9192\u529F\u80FD\u6B63\u5E38\u904B\u4F5C\u3002"),
                        React.createElement("button", { onClick: onTestReminder, className: "bg-[#F59E0B] hover:bg-[#F59E0B] text-[#0F111A] px-6 py-2.5 rounded-xl font-bold shadow-sm transition-transform" }, "\u7ACB\u5373\u6E2C\u8A66 24h \u63D0\u9192\u5BC4\u9001"),
                        React.createElement("button", { onClick: onMassMigrateImages, disabled: isSyncingSubs, className: `px-6 py-3 rounded-xl font-bold flex items-center mt-4 ${isSyncingSubs ? "bg-emerald-900/50 cursor-not-allowed text-[#94A3B8]" : "bg-emerald-700 hover:bg-emerald-600 text-white"}` }, isSyncingSubs ? (React.createElement(React.Fragment, null,
                            React.createElement("i", { className: "fa-solid fa-spinner fa-spin mr-2" }),
                            " ",
                            syncProgress)) : (React.createElement(React.Fragment, null,
                            React.createElement("i", { className: "fa-solid fa-images mr-2" }),
                            "\u4E00\u9375\u9077\u79FB Base64 \u5716\u7247\u81F3 Storage"))),
                        React.createElement("button", { onClick: onMigrateBulletinImages, disabled: isSyncingSubs, className: `px-6 py-3 rounded-xl font-bold flex items-center mt-4 ${isSyncingSubs ? "bg-teal-900/50 cursor-not-allowed text-[#94A3B8]" : "bg-teal-700 hover:bg-teal-600 text-white"}` }, isSyncingSubs ? (React.createElement(React.Fragment, null,
                            React.createElement("i", { className: "fa-solid fa-spinner fa-spin mr-2" }),
                            " ",
                            syncProgress)) : (React.createElement(React.Fragment, null,
                            React.createElement("i", { className: "fa-solid fa-bullhorn mr-2" }),
                            "\u9077\u79FB\u4F48\u544A\u6B04 Base64 \u5716\u7247")))))))),
        editingVtuber && (React.createElement("div", { className: "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90" },
            React.createElement("div", { className: "bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-sm" },
                React.createElement("div", { className: "sticky top-0 bg-[#0F111A]/95 backdrop-blur px-6 py-4 border-b border-[#2A2F3D] flex justify-between items-center z-10" },
                    React.createElement("h3", { className: "font-bold text-white" },
                        React.createElement("i", { className: "fa-solid fa-pen-to-square mr-2" }),
                        "\u5F37\u5236\u7DE8\u8F2F\uFF1A",
                        editingVtuber.name),
                    React.createElement("button", { onClick: () => setEditingVtuber(null), className: "text-[#94A3B8] hover:text-white" },
                        React.createElement("i", { className: "fa-solid fa-xmark text-xl" }))),
                React.createElement("div", { className: "p-6 overflow-y-auto" },
                    React.createElement(ProfileEditorForm, { form: editingVtuber, updateForm: (updates) => setEditingVtuber((prev) => ({ ...prev, ...updates })), onSubmit: (e) => {
                            e.preventDefault();
                            onUpdateVtuber(editingVtuber.id, editingVtuber);
                            setEditingVtuber(null);
                        }, onCancel: () => setEditingVtuber(null), isAdmin: true, showToast: showToast, user: user })))))));
};
const stableRandomCache = {};
const getStableRandom = (id) => {
    if (!id)
        return 0;
    if (!stableRandomCache[id]) {
        stableRandomCache[id] = Math.random();
    }
    return stableRandomCache[id];
};
// 直接接收 allChatRooms，不建立新的連線
const ChatListContent = ({ currentUser, vtubers, onOpenChat, onDeleteChat, allChatRooms, }) => {
    const { onlineUsers } = useContext(AppContext);
    const [missingUsers, setMissingUsers] = useState({});
    const fetchedIds = useRef(new Set());
    useEffect(() => {
        allChatRooms.forEach((room) => {
            // 🌟 核心修復 1：直接從 roomId 切割出雙方的 UID，不再依賴 participants 陣列
            const uids = room.id.split('_');
            const targetId = uids.find((id) => id !== currentUser.uid);
            if (targetId && !vtubers.find((v) => v.id === targetId) && !fetchedIds.current.has(targetId)) {
                fetchedIds.current.add(targetId);
                getDoc(doc(db, getPath("vtubers"), targetId))
                    .then((snap) => {
                    if (snap.exists()) {
                        setMissingUsers((prev) => ({ ...prev, [targetId]: { id: snap.id, ...snap.data() } }));
                    }
                    else {
                        setMissingUsers((prev) => ({
                            ...prev, [targetId]: {
                                id: targetId,
                                name: "未知/已隱藏創作者",
                                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetId}`
                            }
                        }));
                    }
                })
                    .catch((e) => {
                    console.error("抓取缺失的使用者失敗:", e);
                    setMissingUsers((prev) => ({
                        ...prev,
                        [targetId]: {
                            id: targetId,
                            name: "讀取失敗",
                            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetId}`
                        }
                    }));
                });
            }
        });
    }, [allChatRooms, vtubers, currentUser.uid]);
    const rooms = [...allChatRooms].sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
    if (rooms.length === 0)
        return (React.createElement("div", { className: "p-6 text-center text-[#94A3B8] text-sm" },
            React.createElement("p", { className: "text-[#F8FAFC] font-bold mb-1" }, "\u9019\u88E1\u9084\u6C92\u6709\u8A0A\u606F"),
            React.createElement("p", null, "\u6253\u8072\u62DB\u547C\uFF0C\u6216\u5148\u770B\u770B\u5C0D\u65B9\u7684\u540D\u7247\u518D\u958B\u59CB\u804A\u5427\u3002")));
    return (React.createElement("div", { className: "max-h-80 overflow-y-auto bg-[#0F111A] custom-scrollbar" }, rooms.map((room) => {
        // 🌟 核心修復 2：同樣從 roomId 切割出雙方的 UID
        const uids = room.id.split('_');
        const targetId = uids.find((id) => id !== currentUser.uid);
        if (!targetId)
            return null;
        let target = vtubers.find((v) => v.id === targetId) || missingUsers[targetId];
        if (!target)
            return (React.createElement("div", { key: room.id, className: "p-3 text-center text-gray-600 text-xs" }, "\u8F09\u5165\u5C0D\u8A71\u8CC7\u8A0A\u4E2D..."));
        const isUnread = room.unreadBy && room.unreadBy.includes(currentUser.uid);
        const isOnline = onlineUsers.has(target.id);
        return (React.createElement("div", { key: room.id, onClick: () => onOpenChat(target), 
            // 🌟 優化 1：加上 active:bg-[#181B25]，讓手機點擊時有按下去的視覺回饋
            className: "flex items-center gap-3 p-3 border-b border-[#2A2F3D] hover:bg-[#181B25] active:bg-[#181B25] cursor-pointer transition-colors group relative" },
            React.createElement("div", { className: "relative flex-shrink-0" },
                React.createElement("img", { src: sanitizeUrl(target.avatar), className: "w-10 h-10 rounded-full object-cover bg-[#0F111A] border border-[#2A2F3D] md:group-hover:border-[#8B5CF6] transition-colors" }),
                onlineUsers?.has(target.id) && (React.createElement("div", { className: "absolute bottom-0 right-0 w-3 h-3 bg-[#22C55E] border border-gray-900 rounded-full" }))),
            React.createElement("div", { className: "flex-1 min-w-0" },
                React.createElement("div", { className: "flex justify-between items-center mb-1" },
                    React.createElement("span", { className: `text-sm truncate ${isUnread ? "font-black text-white" : "font-bold text-[#CBD5E1]"}` }, target.name),
                    React.createElement("span", { className: "text-[10px] text-[#64748B]" }, formatTime(room.lastTimestamp))),
                React.createElement("p", { className: `text-xs truncate ${isUnread ? "text-[#A78BFA] font-bold" : "text-[#94A3B8]"}` }, room.lastMessage)),
            React.createElement("div", { className: "flex items-center gap-2" },
                isUnread && (React.createElement("div", { className: "w-2 h-2 bg-[#EF4444] rounded-full shadow-sm" })),
                React.createElement("button", { onClick: (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // 🌟 修正：子元件接收的屬性名稱是 onDeleteChat，不是 handleDeleteChat！
                        onDeleteChat(e, room.id);
                    }, className: "relative z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 p-3 -mr-2 text-[#64748B] hover:text-[#EF4444] transition-all", title: "\u79FB\u9664\u6B64\u5C0D\u8A71" },
                    React.createElement("i", { className: "fa-solid fa-trash-can text-sm" })))));
    })));
};
function App() {
    const getInitialView = () => {
        const hash = window.location.hash.replace("#", "");
        if (hash.startsWith("profile/"))
            return "profile";
        return hash === "profile" ? "grid" : hash || "home";
    };
    const [currentView, setCurrentView] = useState(getInitialView());
    const [previousView, setPreviousView] = useState("grid");
    const [selectedVTuber, setSelectedVTuber] = useState(null);
    const [user, setUser] = useState(null);
    const [realVtubers, setRealVtubers] = useState(() => getCachedArray(VTUBER_CACHE_KEY, VTUBER_CACHE_TS));
    const isAdmin = user && user.email === "apex.dasa@gmail.com";
    const myProfile = user ? realVtubers.find((v) => v.id === user.uid) : null;
    const isVerifiedUser = isAdmin || (myProfile?.isVerified && !myProfile?.isBlacklisted && myProfile?.activityStatus === "active");
    // 🌟 新增：限時動態 (Stories) 狀態
    const [realStories, setRealStories] = useState([]);
    const [storyInput, setStoryInput] = useState("");
    const [isStoryComposerOpen, setIsStoryComposerOpen] = useState(false);
    const [statusWallFilter, setStatusWallFilter] = useState("all");
    const [openStatusCommentKeys, setOpenStatusCommentKeys] = useState({});
    const [viewedStoryMap, setViewedStoryMap] = useState(() => {
        try {
            return readLocalCache("vnexus_viewed_status_stories", {}) || {};
        }
        catch (error) {
            return {};
        }
    });
    const markStatusStoryViewed = (vtuber) => {
        if (!vtuber?.id || !vtuber?.statusMessageUpdatedAt)
            return;
        const key = `${vtuber.id}_${Number(vtuber.statusMessageUpdatedAt || 0)}`;
        setViewedStoryMap((prev) => {
            if (prev?.[key])
                return prev;
            const next = { ...(prev || {}), [key]: Date.now() };
            try {
                const entries = Object.entries(next)
                    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
                    .slice(0, 300);
                const compact = Object.fromEntries(entries);
                localStorage.setItem("vnexus_viewed_status_stories", JSON.stringify(compact));
                return compact;
            }
            catch (error) {
                return next;
            }
        });
    };
    const isStatusStoryViewed = (vtuber) => {
        if (!vtuber?.id || !vtuber?.statusMessageUpdatedAt)
            return false;
        return Boolean(viewedStoryMap?.[`${vtuber.id}_${Number(vtuber.statusMessageUpdatedAt || 0)}`]);
    };
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [adminEmailSubject, setAdminEmailSubject] = useState("");
    const [adminEmailBody, setAdminEmailBody] = useState("");
    const [isAdminEmailSending, setIsAdminEmailSending] = useState(false);
    const [isTestEmailSending, setIsTestEmailSending] = useState(false);
    // 🌟 1. 輕量級線上狀態偵測 (心跳機制 Ping)
    useEffect(() => {
        if (!user || !isVerifiedUser)
            return;
        const pingOnlineStatus = async () => {
            const now = Date.now();
            const lastPing = parseInt(localStorage.getItem('last_online_ping') || '0');
            // 距離上次 ping 超過 5 分鐘才更新，避免寫入費爆表
            if (now - lastPing > 5 * 60 * 1000) {
                try {
                    await updateDoc(doc(db, getPath("vtubers"), user.uid), {
                        lastOnlineAt: now
                    });
                    localStorage.setItem('last_online_ping', now.toString());
                    setOnlineUsers(prev => new Set(prev).add(user.uid)); // 讓自己立刻看到自己上線
                }
                catch (e) {
                    console.error("更新線上狀態失敗", e);
                }
            }
        };
        pingOnlineStatus(); // 切換頁面時觸發
        const interval = setInterval(pingOnlineStatus, 5 * 60 * 1000); // 停留時每 5 分鐘觸發
        return () => clearInterval(interval);
    }, [user, isVerifiedUser, currentView]);
    // 🌟 2. 抓取全站線上名單 (獨立於 JSON 快取，確保即時性且極度省錢)
    useEffect(() => {
        // 🛡️ 核心防護：如果未登入，直接中斷，不抓取也不設定定時器！
        if (!user)
            return;
        const fetchOnlineUsers = async () => {
            try {
                const tenMinsAgo = Date.now() - 10 * 60 * 1000;
                const q = query(collection(db, getPath("vtubers")), where("lastOnlineAt", ">", tenMinsAgo), limit(100));
                const snap = await getDocs(q);
                setOnlineUsers(new Set(snap.docs.map(d => d.id)));
            }
            catch (e) {
                console.error("抓取線上名單失敗", e);
            }
        };
        fetchOnlineUsers();
        const interval = setInterval(fetchOnlineUsers, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user]);
    // 🌟 新增：發布限時動態 (同步更新 IG 圈圈、首頁網格與名片狀態)
    const handlePostStory = async (e, overrideContent = null, isLive = false) => {
        if (e)
            e.preventDefault();
        const content = overrideContent !== null ? overrideContent : storyInput.trim();
        if (overrideContent === null && !content)
            return;
        if (!user || !isVerifiedUser)
            return;
        try {
            const now = Date.now();
            const statusDuration = isLive ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
            const statusExpiresAt = content ? now + statusDuration : 0;
            await updateDoc(doc(db, getPath('vtubers'), user.uid), {
                statusMessage: content,
                statusMessageUpdatedAt: content ? now : 0,
                statusMessageExpiresAt: statusExpiresAt,
                // 🌟 新增：發布新動態時，清空互動名單
                statusReactions: { plus_one: [], watching: [], fire: [] },
                updatedAt: now
            });
            // 廣播給全站使用者
            await setDoc(doc(db, getPath("settings"), "stats"), {
                lastGlobalUpdate: now
            }, { merge: true });
            // 同步更新本地快取
            setRealVtubers(prev => {
                const newList = prev.map(v => v.id === user.uid
                    ? { ...v, statusMessage: content, statusMessageUpdatedAt: content ? now : 0, statusMessageExpiresAt: statusExpiresAt, statusReactions: { plus_one: [], watching: [], fire: [] }, updatedAt: now }
                    : v);
                syncVtuberCache(newList);
                return newList;
            });
            setProfileForm(prev => ({ ...prev, statusMessage: content, statusMessageUpdatedAt: content ? now : 0, statusMessageExpiresAt: statusExpiresAt }));
            if (overrideContent === null)
                setStoryInput("");
            if (!content) {
                showToast("🧹 動態已清除！");
            }
            else {
                showToast(isLive ? "🔴 已火速發布直播通知！(3小時後自動隱藏)" : "✅ 動態已發布！首頁與名片已同步更新");
            }
        }
        catch (e) {
            console.error(e);
            showToast("❌ 操作失敗，請稍後再試");
        }
    };
    // 🌟 新增 GA4 監控 1：追蹤使用者切換到了哪個頁面 (page_view)
    useEffect(() => {
        trackAnalyticsEvent('page_view', {
            page_title: currentView,
            page_location: window.location.href,
            page_path: `/${currentView}`
        });
    }, [currentView]);
    // 🌟 新增 GA4 監控 2：追蹤使用者具體查看了「誰」的名片 (view_item)
    useEffect(() => {
        if (currentView === 'profile' && selectedVTuber) {
            trackAnalyticsEvent('view_item', {
                item_id: selectedVTuber.id,
                item_name: selectedVTuber.name,
                item_category: 'vtuber_profile'
            });
        }
    }, [currentView, selectedVTuber]);
    const [profileIdFromHash, setProfileIdFromHash] = useState(() => {
        const hash = window.location.hash.replace("#", "");
        return hash.startsWith("profile/") ? hash.split("/")[1] : null;
    });
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
    const [sortOrder, setSortOrder] = useState("compatibility");
    useEffect(() => {
        if (!user && sortOrder === "compatibility") {
            setSortOrder("random");
        }
    }, [user, sortOrder]);
    const [isLoadingActivities, setIsLoadingActivities] = useState(() => getCachedArray(BULLETINS_CACHE_KEY, BULLETINS_CACHE_TS).length === 0);
    const [isLoading, setIsLoading] = useState(() => getCachedArray(VTUBER_CACHE_KEY, VTUBER_CACHE_TS).length === 0);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [siteStats, setSiteStats] = useState({ pageViews: null });
    const [viewParticipantsCollab, setViewParticipantsCollab] = useState(null);
    const [privateDocs, setPrivateDocs] = useState({});
    const [realBulletins, setRealBulletins] = useState([]);
    const [realUpdates, setRealUpdates] = useState([]);
    const [realCollabs, setRealCollabs] = useState([]);
    const [realArticles, setRealArticles] = useState(() => getCachedArray(ARTICLES_CACHE_KEY, ARTICLES_CACHE_TS));
    const viewedArticles = useRef(new Set());
    const [shuffleSeed, setShuffleSeed] = useState(Date.now());
    const [isBulletinFormOpen, setIsBulletinFormOpen] = useState(false);
    const [chatTarget, setChatTarget] = useState(null);
    const [allChatRooms, setAllChatRooms] = React.useState([]);
    useEffect(() => {
        if (!user) {
            setAllChatRooms([]);
            return;
        }
        const q = query(collection(db, getPath("chat_rooms")), where("participants", "array-contains", user.uid));
        const unsub = onSnapshot(q, (snap) => {
            setAllChatRooms(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, [user]);
    const prevRoomsRef = useRef([]);
    useEffect(() => {
        if (!user || allChatRooms.length === 0)
            return;
        allChatRooms.forEach((room) => {
            const prevRoom = prevRoomsRef.current.find(r => r.id === room.id);
            if (room.unreadBy && room.unreadBy.includes(user.uid) &&
                (!prevRoom || room.lastTimestamp > prevRoom.lastTimestamp)) {
                // 🌟 核心修復 3：這裡也改成從 roomId 切割，確保對方刪除對話後，再傳訊息來依然能彈出視窗！
                const uids = room.id.split('_');
                const senderId = uids.find(id => id !== user.uid);
                if (senderId) {
                    const triggerPopup = async () => {
                        let sender = vtubersRef.current.find(v => v.id === senderId);
                        if (!sender) {
                            try {
                                const sSnap = await getDoc(doc(db, getPath("vtubers"), senderId));
                                if (sSnap.exists())
                                    sender = { id: sSnap.id, ...sSnap.data() };
                            }
                            catch (e) { }
                        }
                        if (sender && chatTargetRef.current?.id !== sender.id) {
                            setChatTarget(sender);
                            setToastMsg(`💬 收到來自 ${sender.name} 的新訊息！`);
                            setTimeout(() => setToastMsg(""), 3000);
                        }
                    };
                    triggerPopup();
                }
            }
        });
        prevRoomsRef.current = allChatRooms;
    }, [allChatRooms, user]);
    // 計算是否有任何未讀訊息
    const hasUnreadChat = useMemo(() => {
        return allChatRooms.some((room) => room.unreadBy && room.unreadBy.includes(user?.uid));
    }, [allChatRooms, user]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTags, setSelectedTags] = useState([]);
    const [selectedAgency, setSelectedAgency] = useState("All");
    const [selectedPlatform, setSelectedPlatform] = useState("All");
    const [selectedNationality, setSelectedNationality] = useState("All");
    const [selectedLanguage, setSelectedLanguage] = useState("All");
    const [selectedSchedule, setSelectedSchedule] = useState("All");
    const [selectedColor, setSelectedColor] = useState("All"); // 新增色系篩選狀態
    const [selectedZodiac, setSelectedZodiac] = useState("All");
    const [collabCategoryTab, setCollabCategoryTab] = useState("All");
    const [bulletinFilter, setBulletinFilter] = useState("All");
    const [publicCollabForm, setPublicCollabForm] = useState({
        dateTime: "",
        title: "",
        streamUrl: "",
        coverUrl: "",
        category: "遊戲",
        participants: [],
    });
    const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
    const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
    const [isTipsModalOpen, setIsTipsModalOpen] = useState(false);
    const [isUpdatesModalOpen, setIsUpdatesModalOpen] = useState(false);
    const [confirmDislikeData, setConfirmDislikeData] = useState(null);
    const [copiedTemplate, setCopiedTemplate] = useState(false);
    const [isChatListOpen, setIsChatListOpen] = useState(false); // 控制聊天列表打開或關閉的開關
    const [isSendingInvite, setIsSendingInvite] = useState(false);
    const isFetchingJson = useRef(false);
    const fetchPublicVtubersJson = async ({ force = false } = {}) => {
        if (!force && isCacheFresh(VTUBER_CACHE_TS, PUBLIC_VTUBER_CACHE_LIMIT) && realVtubers.length > 0) {
            return realVtubers;
        }
        if (isFetchingJson.current)
            return realVtubers;
        isFetchingJson.current = true;
        try {
            const separator = PUBLIC_VTUBERS_JSON_URL.includes("?") ? "&" : "?";
            const response = await fetch(`${PUBLIC_VTUBERS_JSON_URL}${force ? `${separator}t=${Date.now()}` : ""}`, {
                cache: force ? "reload" : "default",
            });
            if (!response.ok)
                throw new Error(`public vtubers json ${response.status}`);
            const payload = await response.json();
            const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.vtubers) ? payload.vtubers : []);
            if (!Array.isArray(list))
                throw new Error("public vtubers json format invalid");
            syncVtuberCache(list);
            return list;
        }
        catch (error) {
            console.warn("公開名片 JSON 讀取失敗，將使用既有快取或 Firestore 備援：", error);
            return null;
        }
        finally {
            isFetchingJson.current = false;
        }
    };
    const handleOpenChat = async (targetVtuber) => {
        setChatTarget(targetVtuber);
        setIsChatListOpen(false);
        if (user) {
            const roomId = generateRoomId(user.uid, targetVtuber.id);
            const roomRef = doc(db, `artifacts/${APP_ID}/public/data/chat_rooms`, roomId);
            // 從未讀名單中移除自己
            try {
                await updateDoc(roomRef, {
                    unreadBy: arrayRemove(user.uid),
                });
            }
            catch (e) {
                console.error("Clear unread error:", e);
            }
        }
    };
    const handleDeleteChat = async (e, roomId) => {
        e.stopPropagation(); // 防止觸發開啟聊天室
        if (!confirm("確定要從列表中移除此對話嗎？\n(移除後若對方再傳訊息或您主動發訊，對話將重新出現)"))
            return;
        try {
            const roomRef = doc(db, `artifacts/${APP_ID}/public/data/chat_rooms`, roomId);
            // 將自己從參與者名單移除，這樣監聽器就不會抓到這間房間
            await updateDoc(roomRef, {
                participants: arrayRemove(user.uid),
            });
            showToast("✅ 已移除對話");
        }
        catch (err) {
            console.error("移除對話失敗:", err);
            showToast("移除失敗");
        }
    };
    const [newBulletin, setNewBulletin] = useState({
        id: null,
        content: "",
        collabType: "",
        collabTypeOther: "",
        collabSize: "",
        collabTime: "",
        recruitEndTime: "",
        image: "",
    });
    const [defaultBulletinImages, setDefaultBulletinImages] = useState([]);
    const [inviteMessage, setInviteMessage] = useState("");
    const [realNotifications, setRealNotifications] = useState([]);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const notifRef = useRef(null);
    const gridScrollY = useRef(0);
    const [currentPage, setCurrentPage] = useState(1);
    // --- 手動啟動通知函式 ---
    const handleEnableNotifications = async () => {
        if (!user)
            return showToast("請先登入");
        if (!("Notification" in window))
            return showToast("此瀏覽器不支援通知");
        if (!("serviceWorker" in navigator))
            return showToast("此瀏覽器不支援 Service Worker");
        try {
            showToast("⏳ 正在啟動推播系統...");
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                return alert("❌ 您拒絕了通知權限。請到瀏覽器設定中開啟。");
            }
            await registerVnexusServiceWorker();
            const registration = await navigator.serviceWorker.ready;
            const { getMessaging, getToken } = await loadMessagingModule();
            const messaging = getMessaging(app);
            const currentToken = await getToken(messaging, {
                serviceWorkerRegistration: registration,
                vapidKey: "BOsq0-39IZhc2I1Y5wiJ2mGrQIUT8zl59MlhMVh_4_41CUvJaYJlw3a1XV-6XM00fvteHsYsF3ukYKbn36SPuIw",
            });
            if (currentToken) {
                // FCM token 屬於裝置私密資料，不再寫入公開 vtubers 文件。
                await setDoc(doc(db, getPath("vtubers_private"), user.uid), {
                    fcmToken: currentToken,
                    notificationsEnabled: true,
                    fcmTokenUpdatedAt: Date.now(),
                }, { merge: true });
                await initForegroundMessaging();
                showToast("✅ 手機推播已成功啟動！");
                alert("🎉 恭喜！您的設備已成功綁定推播功能。");
            }
            else {
                alert("❌ 無法取得 Token，請確認您的瀏覽器支援推播。");
            }
        }
        catch (err) {
            console.error("啟動推播失敗:", err);
            alert("❌ 啟動失敗: " + err.message);
        }
    };
    const [pSearch, setPSearch] = useState(""); // 新增：搜尋框的文字狀態
    const [isSyncingSubs, setIsSyncingSubs] = useState(false);
    const [syncProgress, setSyncProgress] = useState("");
    const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false);
    const [openBulletinModalId, setOpenBulletinModalId] = useState(null);
    const [readUpdateIds, setReadUpdateIds] = useState(() => {
        try {
            return readLocalCache("readUpdates", []) || [];
        }
        catch {
            return [];
        }
    });
    const hasUnreadUpdates = realUpdates.some((u) => !readUpdateIds.includes(u.id));
    const handleMarkAllUpdatesRead = () => {
        const allIds = realUpdates.map((u) => u.id);
        setReadUpdateIds(allIds);
        localStorage.setItem("readUpdates", JSON.stringify(allIds));
        showToast("✅ 已全部標示為已讀");
    };
    const [realTips, setRealTips] = useState("您好，我是 [您的名字/頻道名]。\n想請問近期是否有機會邀請您一起進行 [企劃名稱/遊戲] 的連動呢？");
    const [realRules, setRealRules] = useState("如果聯動的V朋朋有負面行為，請在他的名片按倒讚。只要超過 10 個倒讚即會自動下架。");
    const [toastMsg, setToastMsg] = useState("");
    const showToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(""), 3000);
    };
    const getEmptyProfile = (uid) => ({
        name: "",
        agency: "個人勢",
        tags: "",
        description: "",
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid || Math.random()}&backgroundColor=b6e3f4`,
        banner: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=1000",
        nationalities: [],
        isOtherNationality: false,
        otherNationalityText: "",
        languages: [],
        zodiacSign: "",
        personalityType: "",
        personalityTypeOther: "",
        colorSchemes: [], // 新增色系
        creatorRoles: [],
        creatorPortfolioUrl: "",
        creatorStyles: [],
        creatorStatus: "",
        creatorBudgetRange: "",
        creatorOtherStyleText: "",
        isScheduleAnytime: false,
        isScheduleExcept: false,
        isScheduleCustom: false,
        customScheduleText: "",
        scheduleSlots: [],
        collabTypes: [],
        isOtherCollab: false,
        otherCollabText: "",
        streamingStyle: "一般型態",
        activityStatus: "active",
        youtubeSubscribers: "",
        twitchFollowers: "",
        youtubeUrl: "",
        twitchUrl: "",
        mainPlatform: "YouTube",
        streamStyleUrl: "",
        xUrl: "",
        igUrl: "",
        publicEmail: "",
        publicEmailVerified: false,
        contactEmail: "",
        verificationNote: "",
        lastYoutubeFetchTime: 0,
        lastTwitchFetchTime: 0,
        statusMessage: "",
        statusMessageUpdatedAt: 0,
        statusMessageExpiresAt: 0,
        rejectionCount: 0,
        lastRejectedAt: 0,
        statusReactions: { plus_one: [], watching: [], fire: [] }
    });
    const [profileForm, setProfileForm] = useState(getEmptyProfile());
    // --- 確保這段是放在 App 函式內，useState 的下方 ---
    const handleIncrementArticleView = async (id) => {
        if (!user)
            return;
        // 使用 LocalStorage 紀錄該使用者的觀看時間戳記
        const storageKey = `vnexus_views_${user.uid}`;
        let viewHistory = {};
        try {
            viewHistory = JSON.parse(localStorage.getItem(storageKey)) || {};
        }
        catch (e) { }
        const lastViewed = viewHistory[id] || 0;
        const now = Date.now();
        // 防呆：如果 24 小時內 (24 * 60 * 60 * 1000 毫秒) 已經點過，就不重複 +1
        if (now - lastViewed < 24 * 60 * 60 * 1000) {
            console.log("⚠️ 24小時內已觀看過，不再重複計算閱讀數！");
            return;
        }
        // 更新最新觀看時間
        viewHistory[id] = now;
        localStorage.setItem(storageKey, JSON.stringify(viewHistory));
        // 1. 畫面數字瞬間 +1
        setRealArticles(prev => {
            const list = prev.map(a => a.id === id ? { ...a, views: (a.views || 0) + 1 } : a);
            localStorage.setItem(ARTICLES_CACHE_KEY, JSON.stringify(list));
            return list;
        });
        // 2. 背景發送給 Firebase 執行精準的 +1
        try {
            await updateDoc(doc(db, getPath('articles'), id), { views: increment(1) });
        }
        catch (e) {
            console.error("更新閱讀數失敗", e);
        }
    };
    // --- 👇 補上：管理員專用的文章編輯方法 ---
    const handleAdminEditArticle = async (id, updatedForm) => {
        try {
            await updateDoc(doc(db, getPath('articles'), id), updatedForm);
            setRealArticles(prev => {
                const list = prev.map(a => a.id === id ? { ...a, ...updatedForm } : a);
                localStorage.setItem(ARTICLES_CACHE_KEY, JSON.stringify(list));
                return list;
            });
            showToast("✅ 文章修改成功！");
        }
        catch (e) {
            showToast("❌ 修改失敗");
            console.error(e);
        }
    };
    const handlePublishArticle = async (form) => {
        if (!user)
            return;
        const status = isAdmin ? 'published' : 'pending';
        try {
            let finalCoverUrl = form.coverUrl || "";
            // 👇 新增：如果封面圖是新上傳的圖片 (以 data:image 開頭)，則先上傳到 Storage
            if (finalCoverUrl.startsWith('data:image')) {
                showToast("⏳ 正在上傳封面圖...");
                const fileName = `article_cover_${Date.now()}.jpg`;
                // 呼叫原本寫好的上傳函式
                finalCoverUrl = await uploadImageToStorage(user.uid, finalCoverUrl, fileName);
            }
            const safeForm = {
                title: form.title || "",
                category: form.category || "新手教學",
                content: form.content || "",
                coverUrl: finalCoverUrl // 👈 存入剛取得的真實 Storage 網址
            };
            const docRef = await addDoc(collection(db, getPath('articles')), {
                ...safeForm,
                userId: user.uid,
                status: status,
                createdAt: Date.now()
            });
            const newArticle = { id: docRef.id, ...safeForm, userId: user.uid, status, createdAt: Date.now() };
            setRealArticles(prev => {
                const list = [newArticle, ...prev];
                localStorage.setItem(ARTICLES_CACHE_KEY, JSON.stringify(list));
                return list;
            });
            showToast(isAdmin ? "✅ 文章已直接發布！" : "✅ 文章已送出，等待管理員審核！");
        }
        catch (e) {
            console.error("發布文章詳細錯誤:", e);
            showToast("❌ 發布失敗：" + e.message);
        }
    };
    const handleVerifyArticle = async (id) => {
        try {
            await updateDoc(doc(db, getPath('articles'), id), { status: 'published' });
            setRealArticles(prev => {
                const list = prev.map(a => a.id === id ? { ...a, status: 'published' } : a);
                localStorage.setItem(ARTICLES_CACHE_KEY, JSON.stringify(list));
                return list;
            });
            showToast("✅ 文章已核准發布！");
        }
        catch (e) {
            showToast("❌ 審核失敗");
        }
    };
    const handleDeleteArticle = async (id) => {
        if (!confirm("確定要刪除這篇文章嗎？"))
            return;
        try {
            await deleteDoc(doc(db, getPath('articles'), id));
            setRealArticles(prev => {
                const list = prev.filter(a => a.id !== id);
                localStorage.setItem(ARTICLES_CACHE_KEY, JSON.stringify(list));
                return list;
            });
            showToast("✅ 文章已刪除");
        }
        catch (e) {
            showToast("❌ 刪除失敗");
        }
    };
    const handleTestPushNotification = async () => {
        if (!user)
            return showToast("請先登入！");
        showToast("⏳ 正在發送測試推播...");
        try {
            // 1. 先嘗試本地顯示（確保 Service Worker 運作中）
            await registerVnexusServiceWorker();
            const registration = await navigator.serviceWorker.ready;
            if (registration) {
                await registration.showNotification("V-Nexus 系統測試", {
                    body: "🎉 恭喜！您的設備已成功接收到通知！",
                    icon: "https://duk.tw/u1jpPE.png",
                    badge: "https://duk.tw/u1jpPE.png",
                    vibrate: [200, 100, 200],
                });
            }
            // 2. 寫入通知資料庫 (這會觸發後端 Cloud Functions 發送真正的 FCM 推播)
            await addDoc(collection(db, getPath("notifications")), {
                userId: user.uid,
                fromUserId: user.uid,
                fromUserName: "V-Nexus 測試員",
                fromUserAvatar: "https://duk.tw/u1jpPE.png",
                message: "🎉 恭喜！您的手機推播功能已成功啟動！",
                type: "test_push",
                createdAt: Date.now(),
                read: false,
            });
            showToast("✅ 測試指令已發出！");
        }
        catch (err) {
            showToast("❌ 發送失敗：" + err.message);
        }
    };
    const handleMassMigrateImagesToStorage = async () => {
        if (!confirm("確定要執行全站圖片遷移？"))
            return;
        setIsSyncingSubs(true);
        let successCount = 0;
        let failCount = 0;
        try {
            // 這裡確保 realVtubers 有資料
            if (realVtubers.length === 0) {
                alert("目前清單中沒有 VTuber 資料可供遷移");
                setIsSyncingSubs(false);
                return;
            }
            for (let i = 0; i < realVtubers.length; i++) {
                const v = realVtubers[i];
                if (v.id.startsWith("mock"))
                    continue;
                let updates = {};
                setSyncProgress(`正在處理 (${i + 1}/${realVtubers.length}): ${v.name}`);
                // 偵測 Base64 並轉換
                try {
                    if (v.avatar && v.avatar.startsWith("data:image")) {
                        const newUrl = await uploadImageToStorage(v.id, v.avatar, "avatar.jpg");
                        updates.avatar = newUrl;
                    }
                    if (v.banner && v.banner.startsWith("data:image")) {
                        const newUrl = await uploadImageToStorage(v.id, v.banner, "banner.jpg");
                        updates.banner = newUrl;
                    }
                    if (Object.keys(updates).length > 0) {
                        await updateDoc(doc(db, getPath("vtubers"), v.id), updates);
                        successCount++;
                        // 即時更新本地狀態
                        setRealVtubers((prev) => prev.map((rv) => (rv.id === v.id ? { ...rv, ...updates } : rv)));
                    }
                }
                catch (e) {
                    console.error(`${v.name} 遷移失敗:`, e);
                    failCount++;
                }
                // 稍微等待，避免 Firebase 頻率限制
                await new Promise((r) => setTimeout(r, 200));
            }
            alert(`遷移結束！\n成功：${successCount} 筆\n失敗：${failCount} 筆\n(若失敗次數多，請檢查 Storage Rules 權限)`);
        }
        catch (err) {
            alert("遷移過程發生嚴重錯誤: " + err.message);
        }
        finally {
            setIsSyncingSubs(false);
            setSyncProgress("");
        }
    };
    const handleMigrateMyImages = async () => {
        if (!user)
            return showToast("請先登入！");
        // 取得目前資料庫中的名片資料
        const myData = realVtubers.find((v) => v.id === user.uid);
        if (!myData)
            return showToast("找不到您的名片資料，請先儲存名片。");
        const hasBase64Avatar = myData.avatar && myData.avatar.startsWith("data:image");
        const hasBase64Banner = myData.banner && myData.banner.startsWith("data:image");
        if (!hasBase64Avatar && !hasBase64Banner) {
            return showToast("✅ 您的圖片已經是網址格式，不需要遷移。");
        }
        try {
            showToast("⏳ 正在將您的圖片上傳至 Storage...");
            let updates = {};
            if (hasBase64Avatar) {
                const url = await uploadImageToStorage(user.uid, myData.avatar, "avatar.jpg");
                updates.avatar = url;
            }
            if (hasBase64Banner) {
                const url = await uploadImageToStorage(user.uid, myData.banner, "banner.jpg");
                updates.banner = url;
            }
            await updateDoc(doc(db, getPath("vtubers"), user.uid), {
                ...updates,
                updatedAt: Date.now(),
            });
            // 更新本地狀態讓畫面即時變化
            setRealVtubers((prev) => prev.map((v) => (v.id === user.uid ? { ...v, ...updates } : v)));
            showToast("🎉 遷移成功！您的圖片現在儲存在 Storage 了。");
        }
        catch (err) {
            console.error(err);
            showToast("❌ 遷移失敗，請檢查 Storage 權限。");
        }
    };
    const navigate = (view, preserveScroll = false) => {
        if (!preserveScroll && !view.startsWith("profile/")) {
            setViewParticipantsCollab(null);
            setOpenBulletinModalId(null);
        }
        if (view.startsWith("profile/") && currentView !== "profile") {
            setPreviousView(currentView);
            gridScrollY.current = window.scrollY;
        }
        const cleanView = view.replace("#", "");
        if (cleanView.startsWith("profile/")) {
            setProfileIdFromHash(cleanView.split("/")[1]);
            setCurrentView("profile");
        }
        else {
            setProfileIdFromHash(null);
            setCurrentView(cleanView === "profile" ? "grid" : cleanView || "home");
        }
        if (window.location.hash !== "#" + view) {
            window.history.pushState(null, null, "#" + view);
        }
        setIsMobileMenuOpen(false);
        if (!preserveScroll) {
            setTimeout(() => window.scrollTo(0, 0), 10);
        }
    };
    const goToBulletin = () => {
        // 移除 isVerifiedUser 的判斷，讓所有人都能進入
        navigate("bulletin");
    };
    const pendingVtubersCount = useMemo(() => realVtubers.filter((v) => !v.isVerified &&
        !v.isBlacklisted &&
        v.verificationStatus !== "rejected").length, [realVtubers]);
    const leaderboardData = useMemo(() => {
        return realVtubers
            .filter((v) => v.successCount && v.successCount > 0)
            .sort((a, b) => b.successCount - a.successCount);
    }, [realVtubers]);
    useEffect(() => {
        // ✅ 短暫完整啟動版：不在 React 一掛載就立刻關閉 loading。
        // 右上角登入/頭像需要等 Firebase Auth 第一次回報狀態；由 onAuthStateChanged 觸發 __vnexusSignalBootReady。
        // index.html 仍有 max fallback，避免 Auth 異常時卡住。
    }, []);
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace("#", "");
            if (hash.startsWith("profile/")) {
                setProfileIdFromHash(hash.split("/")[1]);
                setCurrentView("profile");
            }
            else {
                setProfileIdFromHash(null);
                setCurrentView(hash === "profile" ? "grid" : hash || "home");
            }
        };
        handleHashChange();
        window.addEventListener("hashchange", handleHashChange);
        return () => window.removeEventListener("hashchange", handleHashChange);
    }, []);
    // 替換原本處理 profileIdFromHash 的 useEffect
    useEffect(() => {
        if (currentView === "profile" && profileIdFromHash && !isLoading) {
            // 先嘗試用 UID 找
            let vt = realVtubers.find((v) => v.id === profileIdFromHash);
            // 如果找不到，嘗試用 slug 找
            if (!vt) {
                vt = realVtubers.find((v) => v.slug === profileIdFromHash.toLowerCase());
            }
            if (vt) {
                setSelectedVTuber(vt);
            }
            else {
                showToast("找不到該名片，可能已被隱藏或網址錯誤");
                navigate("grid");
            }
        }
    }, [currentView, profileIdFromHash, realVtubers, isLoading]);
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target))
                setIsNotifOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [notifRef]);
    useEffect(() => {
        // Service Worker 已改成進站後 idle 延後註冊；啟用推播時會主動確保註冊完成。
        const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
            // 關鍵：當偵測到帳號變動（包含登出）
            if (!u || (user && u.uid !== user.uid)) {
                setChatTarget(null); // 關閉聊天小視窗
                setIsChatListOpen(false); // 關閉私訊列表
            }
            setUser(u);
            setProfileForm(getEmptyProfile(u?.uid));
            // ✅ Firebase Auth 第一次完成後再關閉啟動畫面，避免右上角登入按鈕/頭像跳動。
            if (typeof window !== "undefined" && typeof window.__vnexusSignalBootReady === "function") {
                window.__vnexusSignalBootReady();
            }
        });
        const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
        return () => {
            unsubscribeAuth();
            clearInterval(timer);
        };
    }, []);
    // --- 自動提醒檢查邏輯已移至 Cloud Functions sendCollabReminders ---
    // 前端不再負責排程寄信，避免管理員沒開頁面時提醒失效或重複寄信。
    const hasFetchedSettings = useRef(false);
    useEffect(() => {
        if (currentView === "home" && !sessionStorage.getItem("hasCountedView")) {
            updateDoc(doc(db, getPath("settings"), "stats"), { pageViews: increment(1) }).catch(() => { });
            sessionStorage.setItem("hasCountedView", "true");
        }
    }, [currentView]);
    // 🌟 全站統計 / 靜態設定：改成快取 + 偶爾刷新，不再讓每位訪客常駐監聽 settings。
    // 即時性真正需要保留的是通知、私訊、自己的私密資料；公開大清單由 Storage JSON 承擔。
    useEffect(() => {
        let isMounted = true;
        const applyStatsAndRefreshPublicJsonIfNeeded = async (statsData) => {
            if (!statsData || !isMounted)
                return;
            setSiteStats(statsData);
            writeLocalCache(STATS_CACHE_KEY, statsData);
            markCacheTimestamp(STATS_CACHE_TS);
            const cachedTs = readCacheTimestamp(VTUBER_CACHE_TS);
            const processedUpdate = typeof localStorage !== "undefined"
                ? localStorage.getItem("processed_global_update") || "0"
                : "0";
            if (statsData.lastGlobalUpdate &&
                Number(statsData.lastGlobalUpdate) > cachedTs &&
                String(statsData.lastGlobalUpdate) !== processedUpdate) {
                try {
                    localStorage.setItem("processed_global_update", String(statsData.lastGlobalUpdate));
                }
                catch (error) { }
                console.log("🔔 偵測到公開名片更新，改抓 Storage JSON，不讀 Firestore 整包。 ");
                setTimeout(async () => {
                    if (!isMounted)
                        return;
                    if (isAdmin) {
                        try {
                            const vSnap = await getDocs(collection(db, getPath("vtubers")));
                            syncVtuberCache(vSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
                            sessionStorage.setItem("has_full_admin_data", "true");
                        }
                        catch (e) {
                            console.error("管理員背景更新完整名單失敗", e);
                        }
                    }
                    else {
                        await fetchPublicVtubersJson({ force: true });
                    }
                }, 4000);
            }
        };
        const loadStatsAndSettings = async () => {
            const cachedStats = readLocalCache(STATS_CACHE_KEY, null);
            if (cachedStats && isMounted)
                setSiteStats(cachedStats);
            if (!cachedStats || !isCacheFresh(STATS_CACHE_TS, STATS_CACHE_LIMIT)) {
                try {
                    const statsSnap = await getDoc(doc(db, getPath("settings"), "stats"));
                    if (statsSnap.exists())
                        await applyStatsAndRefreshPublicJsonIfNeeded(statsSnap.data());
                }
                catch (error) {
                    console.warn("讀取統計資料失敗，沿用快取。", error);
                }
            }
            else {
                await applyStatsAndRefreshPublicJsonIfNeeded(cachedStats);
            }
            if (!hasFetchedSettings.current) {
                hasFetchedSettings.current = true;
                const cachedSettings = readLocalCache(SETTINGS_CACHE_KEY, null);
                if (cachedSettings && isMounted) {
                    if (cachedSettings.tips !== undefined)
                        setRealTips(cachedSettings.tips);
                    if (cachedSettings.rules !== undefined)
                        setRealRules(cachedSettings.rules);
                    if (Array.isArray(cachedSettings.bulletinImages))
                        setDefaultBulletinImages(cachedSettings.bulletinImages);
                }
                if (!cachedSettings || !isCacheFresh(SETTINGS_CACHE_TS, SETTINGS_CACHE_LIMIT)) {
                    try {
                        const [tipsSnap, rulesSnap, imgSnap] = await Promise.all([
                            getDoc(doc(db, getPath("settings"), "tips")),
                            getDoc(doc(db, getPath("settings"), "rules")),
                            getDoc(doc(db, getPath("settings"), "bulletinImages")),
                        ]);
                        const nextSettings = {
                            tips: tipsSnap.exists() ? tipsSnap.data().content : realTips,
                            rules: rulesSnap.exists() ? rulesSnap.data().content : realRules,
                            bulletinImages: imgSnap.exists() ? (imgSnap.data().images || []) : defaultBulletinImages,
                        };
                        if (!isMounted)
                            return;
                        setRealTips(nextSettings.tips);
                        setRealRules(nextSettings.rules);
                        setDefaultBulletinImages(nextSettings.bulletinImages);
                        writeLocalCache(SETTINGS_CACHE_KEY, nextSettings);
                        markCacheTimestamp(SETTINGS_CACHE_TS);
                    }
                    catch (error) {
                        console.warn("讀取站規/邀約小技巧/預設揪團圖失敗，沿用快取。", error);
                    }
                }
            }
        };
        loadStatsAndSettings();
        return () => { isMounted = false; };
    }, [isAdmin]);
    // 2. 使用 useRef 緩存動態變數，避免監聽器因為陣列長度改變而頻繁重建
    const vtubersRef = useRef(realVtubers);
    const chatTargetRef = useRef(chatTarget);
    useEffect(() => {
        vtubersRef.current = realVtubers;
    }, [realVtubers]);
    useEffect(() => {
        chatTargetRef.current = chatTarget;
    }, [chatTarget]);
    // 3. 處理通知監聽 (只依賴 user.uid，無論怎麼切換頁面都不會重建連線！)
    useEffect(() => {
        if (!user?.uid)
            return;
        const unsubN = onSnapshot(query(collection(db, getPath("notifications")), where("userId", "==", user.uid), orderBy("createdAt", "desc"), limit(30)), async (snap) => {
            const newNotifs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            const latestChatNotif = newNotifs.find((n) => !n.read &&
                n.type === "chat_notification" &&
                Date.now() - n.createdAt < 5000);
            if (latestChatNotif) {
                let sender = vtubersRef.current.find((v) => v.id === latestChatNotif.fromUserId);
                if (!sender) {
                    const sSnap = await getDoc(doc(db, getPath("vtubers"), latestChatNotif.fromUserId));
                    if (sSnap.exists())
                        sender = { id: sSnap.id, ...sSnap.data() };
                }
                if (sender && chatTargetRef.current?.id !== sender.id) {
                    setChatTarget(sender);
                    updateDoc(doc(db, getPath("notifications"), latestChatNotif.id), {
                        read: true,
                    });
                }
            }
            setRealNotifications(newNotifs);
        });
        return () => unsubN();
    }, [user?.uid]);
    // --- 公開資料分層讀取：名片大清單走 Storage JSON；活動資料 5 分鐘快取；後台才讀完整 Firestore。 ---
    useEffect(() => {
        let isMounted = true;
        const fetchLargeData = async () => {
            const needsVtuberList = [
                "home", "grid", "profile", "match", "blacklist", "dashboard", "admin", "bulletin", "commission-board", "collabs", "articles", "commissions"
            ].includes(currentView);
            if (needsVtuberList) {
                const cachedVtubers = getCachedArray(VTUBER_CACHE_KEY, VTUBER_CACHE_TS);
                if (cachedVtubers.length > 0) {
                    setRealVtubers(cachedVtubers);
                    setIsLoading(false);
                }
                const hasFullAdminData = sessionStorage.getItem("has_full_admin_data") === "true";
                const shouldFetchFullForAdmin = isAdmin && currentView === "admin" && !hasFullAdminData;
                const shouldRefreshPublicJson = !shouldFetchFullForAdmin && (!cachedVtubers.length || !isCacheFresh(VTUBER_CACHE_TS, PUBLIC_VTUBER_CACHE_LIMIT));
                if (shouldFetchFullForAdmin) {
                    try {
                        const vSnap = await getDocs(collection(db, getPath("vtubers")));
                        if (!isMounted)
                            return;
                        syncVtuberCache(vSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
                        sessionStorage.setItem("has_full_admin_data", "true");
                    }
                    catch (e) {
                        console.error("管理員讀取完整名單失敗", e);
                    }
                    finally {
                        if (isMounted)
                            setIsLoading(false);
                    }
                }
                else if (shouldRefreshPublicJson) {
                    const publicList = await fetchPublicVtubersJson({ force: cachedVtubers.length === 0 });
                    if (!publicList && cachedVtubers.length === 0) {
                        // 最後備援：只有 public JSON 尚未建立且本機沒有任何快取時才讀 Firestore，避免訪客每次都讀整包。
                        try {
                            const vSnap = await getDocs(collection(db, getPath("vtubers")));
                            if (!isMounted)
                                return;
                            syncVtuberCache(vSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
                            console.warn("⚠️ public_api/vtubers.json 尚未可用，本次使用 Firestore 備援。請部署後端並等待/觸發 JSON 生成。 ");
                        }
                        catch (e) {
                            console.error("公開名單備援讀取失敗", e);
                        }
                    }
                    if (isMounted)
                        setIsLoading(false);
                }
                else {
                    setIsLoading(false);
                }
            }
            const needsActivityData = ["home", "bulletin", "collabs", "admin", "commissions", "commission-board"].includes(currentView);
            if (needsActivityData) {
                const cachedBulletins = getCachedArray(BULLETINS_CACHE_KEY, BULLETINS_CACHE_TS);
                const cachedCollabs = getCachedArray(COLLABS_CACHE_KEY, COLLABS_CACHE_TS);
                const cachedUpdates = getCachedArray(UPDATES_CACHE_KEY, UPDATES_CACHE_TS);
                if (cachedBulletins.length || cachedCollabs.length || cachedUpdates.length) {
                    setRealBulletins(cachedBulletins);
                    setRealCollabs(cachedCollabs);
                    setRealUpdates(cachedUpdates);
                    setIsLoadingActivities(false);
                }
                const allActivityCachesFresh = isCacheFresh(BULLETINS_CACHE_TS, ACTIVITY_CACHE_LIMIT) &&
                    isCacheFresh(COLLABS_CACHE_TS, ACTIVITY_CACHE_LIMIT) &&
                    isCacheFresh(UPDATES_CACHE_TS, ACTIVITY_CACHE_LIMIT);
                if (!allActivityCachesFresh || currentView === "admin") {
                    if (!cachedBulletins.length && !cachedCollabs.length && !cachedUpdates.length)
                        setIsLoadingActivities(true);
                    try {
                        const nowTime = Date.now();
                        const [bSnap, cSnap, uSnap] = await Promise.all([
                            getDocs(query(collection(db, getPath("bulletins")), where("recruitEndTime", ">", nowTime))),
                            getDocs(query(collection(db, getPath("collabs")), where("startTimestamp", ">", nowTime - 2 * 60 * 60 * 1000))),
                            getDocs(query(collection(db, getPath("updates")), orderBy("createdAt", "desc"), limit(15))),
                        ]);
                        if (!isMounted)
                            return;
                        const bData = bSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
                        const cData = cSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
                        const uData = uSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
                        syncBulletinCache(bData);
                        syncCollabCache(cData);
                        setRealUpdates(uData);
                        writeLocalCache(UPDATES_CACHE_KEY, uData);
                        markCacheTimestamp(UPDATES_CACHE_TS);
                    }
                    catch (e) {
                        console.error("抓取活動資料失敗:", e);
                    }
                    finally {
                        if (isMounted)
                            setIsLoadingActivities(false);
                    }
                }
            }
        };
        fetchLargeData();
        return () => { isMounted = false; };
    }, [currentView, isAdmin]);
    useEffect(() => {
        const needsArticleData = ["articles", "admin"].includes(currentView);
        if (!needsArticleData)
            return;
        let isMounted = true;
        const fetchArticles = async () => {
            const cachedArticles = getCachedArray(ARTICLES_CACHE_KEY, ARTICLES_CACHE_TS);
            if (cachedArticles.length > 0)
                setRealArticles(cachedArticles);
            const forceRefresh = currentView === "admin";
            if (!forceRefresh && cachedArticles.length > 0 && isCacheFresh(ARTICLES_CACHE_TS, ARTICLES_CACHE_LIMIT))
                return;
            try {
                const aSnap = await getDocs(collection(db, getPath("articles")));
                if (!isMounted)
                    return;
                const aData = aSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
                setRealArticles(aData);
                writeLocalCache(ARTICLES_CACHE_KEY, aData);
                markCacheTimestamp(ARTICLES_CACHE_TS);
            }
            catch (e) {
                console.error("抓取文章失敗:", e);
            }
        };
        fetchArticles();
        return () => { isMounted = false; };
    }, [currentView]);
    const hasFetchedPrivate = useRef(false);
    useEffect(() => {
        // 登出時重置
        if (!user)
            hasFetchedPrivate.current = false;
    }, [user]);
    useEffect(() => {
        if (user &&
            user.uid &&
            realVtubers.length > 0 &&
            !hasFetchedPrivate.current) {
            const myPublicData = realVtubers.find((v) => v.id === user.uid);
            if (myPublicData) {
                hasFetchedPrivate.current = true; // 上鎖，防止重複讀取
                getDoc(doc(db, getPath("vtubers_private"), user.uid))
                    .then((docSnap) => {
                    const pData = docSnap.exists() ? docSnap.data() : {};
                    const rawCollabs = Array.isArray(myPublicData.collabTypes)
                        ? myPublicData.collabTypes
                        : [];
                    const stdCollabs = rawCollabs.filter((t) => PREDEFINED_COLLABS.includes(t));
                    const otherCollab = rawCollabs.find((t) => !PREDEFINED_COLLABS.includes(t)) || "";
                    const PREDEFINED_NATS = ["台灣", "日本", "香港", "馬來西亞"];
                    const rawNats = Array.isArray(myPublicData.nationalities)
                        ? myPublicData.nationalities
                        : [];
                    const stdNats = rawNats.filter((n) => PREDEFINED_NATS.includes(n));
                    const otherNat = rawNats.find((n) => !PREDEFINED_NATS.includes(n)) || "";
                    const PREDEFINED_PERSONALITIES = [
                        "我是I人",
                        "時I時E",
                        "我大E人",
                        "看心情",
                    ];
                    const pType = myPublicData.personalityType || "";
                    const isOtherP = pType && !PREDEFINED_PERSONALITIES.includes(pType);
                    setProfileForm((prev) => ({
                        ...getEmptyProfile(user.uid),
                        ...myPublicData,
                        ...pData,
                        tags: Array.isArray(myPublicData.tags)
                            ? myPublicData.tags.join(", ")
                            : myPublicData.tags || "",
                        collabTypes: stdCollabs,
                        isOtherCollab: !!otherCollab,
                        otherCollabText: otherCollab,
                        nationalities: stdNats,
                        isOtherNationality: !!otherNat,
                        otherNationalityText: otherNat,
                        personalityType: isOtherP ? "其他" : pType,
                        personalityTypeOther: isOtherP ? pType : "",
                        publicEmailVerified: pData.publicEmailVerified || false,
                        scheduleSlots: Array.isArray(myPublicData.scheduleSlots)
                            ? myPublicData.scheduleSlots
                            : [],
                        colorSchemes: Array.isArray(myPublicData.colorSchemes)
                            ? myPublicData.colorSchemes
                            : [],
                        creatorRoles: Array.isArray(myPublicData.creatorRoles)
                            ? myPublicData.creatorRoles
                            : [],
                        creatorBudgetRange: normalizeCreatorBudgetRange(myPublicData.creatorBudgetRange),
                    }));
                })
                    .catch((err) => {
                    console.error("抓取私密資料失敗:", err);
                    hasFetchedPrivate.current = false; // 如果失敗，允許重試
                });
            }
        }
    }, [user?.uid, realVtubers]);
    useEffect(() => {
        // 只有當前頁面是 admin 且 user 確定是管理員時才抓取
        if (isAdmin &&
            currentView === "admin" &&
            Object.keys(privateDocs).length === 0) {
            getDocs(collection(db, getPath("vtubers_private")))
                .then((snap) => {
                const pDocs = {};
                snap.docs.forEach((d) => (pDocs[d.id] = d.data()));
                setPrivateDocs(pDocs);
            })
                .catch((err) => console.error("抓取私密資料失敗:", err));
        }
    }, [isAdmin, currentView]);
    const myNotifications = useMemo(() => user
        ? realNotifications
            .filter((n) => n.userId === user.uid)
            .sort((a, b) => b.createdAt - a.createdAt)
        : [], [realNotifications, user]);
    const unreadCount = myNotifications.filter((n) => !n.read).length;
    const markAllAsRead = () => myNotifications.forEach((n) => {
        if (!n.read)
            updateDoc(doc(db, getPath("notifications"), n.id), { read: true });
    });
    const handleNotifClick = (n) => {
        const isBackup = n.message && n.message.startsWith("【寄件備份");
        if (isBackup) {
            if (!n.read)
                updateDoc(doc(db, getPath("notifications"), n.id), { read: true }).catch(() => { });
            setIsNotifOpen(false);
            return;
        }
        const targetId = n.type === "collab_invite_sent" ? n.targetUserId : n.fromUserId;
        // 🌟 修正：加上防呆，確保點擊通知時即使快取沒這個人，也能強制打開聊天室
        const sender = realVtubers.find((v) => v.id === targetId) || {
            id: targetId,
            name: n.fromUserName || "新創作者",
            avatar: n.fromUserAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetId}`
        };
        if (n.type === "chat_notification" || n.type === "collab_invite") {
            setChatTarget(sender);
        }
        else {
            setSelectedVTuber(sender);
            navigate(`profile/${sender.id}`);
        }
        if (!n.read)
            updateDoc(doc(db, getPath("notifications"), n.id), { read: true }).catch(() => { });
        setIsNotifOpen(false);
    };
    const handleNotifProfileNav = (userId) => {
        const vt = realVtubers.find((v) => v.id === userId);
        if (vt) {
            setSelectedVTuber(vt);
            navigate(`profile/${vt.id}`);
        }
        else
            showToast("找不到該名片，可能已被刪除或隱藏");
    };
    const handleNotifOpenChat = (n) => {
        const vt = realVtubers.find((v) => v.id === n.fromUserId);
        if (vt) {
            handleOpenChat(vt); // 呼叫原本右下角開啟聊天室的函式
        }
        else {
            showToast("找不到該創作者，可能已被刪除或隱藏");
        }
        // 順便幫使用者把這則通知標記為已讀
        if (!n.read) {
            handleMarkNotifRead(n.id);
        }
    };
    const handleMarkNotifRead = async (id) => {
        try {
            await updateDoc(doc(db, getPath("notifications"), id), { read: true });
        }
        catch (err) { }
    };
    const handleDeleteNotif = async (id) => {
        if (!confirm("確定要刪除這則通知嗎？"))
            return;
        try {
            await deleteDoc(doc(db, getPath("notifications"), id));
            showToast("✅ 已刪除通知");
        }
        catch (err) {
            showToast("刪除失敗");
        }
    };
    const handleDeleteAllNotifs = async () => {
        if (myNotifications.length === 0)
            return showToast("信箱已經是空的囉！");
        if (!confirm("確定要刪除全部信件嗎？此動作無法復原！"))
            return;
        try {
            showToast("⏳ 正在清空信箱...");
            const batch = writeBatch(db);
            myNotifications.forEach((n) => {
                batch.delete(doc(db, getPath("notifications"), n.id));
            });
            await batch.commit();
            showToast("✅ 已成功清空所有信件！");
        }
        catch (err) {
            showToast("❌ 刪除失敗，請稍後再試。");
        }
    };
    const handleBraveInvite = async (target) => {
        if (!user)
            return showToast("請先登入！");
        if (!isVerifiedUser)
            return showToast("需通過認證才能發送邀請！");
        if (target.id === user.uid)
            return showToast("不能邀請自己！");
        const lastInviteKey = `brave_invite_${user.uid}_${target.id}`;
        const lastInvite = localStorage.getItem(lastInviteKey);
        if (lastInvite && Date.now() - parseInt(lastInvite) < 24 * 60 * 60 * 1000) {
            return showToast("一天只能邀約一次哦！");
        }
        try {
            // 🔒 只寫通知，交給後端處理信件
            await addDoc(collection(db, getPath("notifications")), {
                userId: target.id,
                fromUserId: user.uid,
                fromUserName: myProfile?.name || user.displayName || "某位創作者",
                fromUserAvatar: myProfile?.avatar || user.photoURL,
                message: "鼓起勇氣向您發送了「勇敢邀請」！請問您是否有意願聯動呢？",
                type: "brave_invite",
                createdAt: Date.now(),
                read: false,
                handled: false,
            });
            localStorage.setItem(lastInviteKey, Date.now().toString());
            showToast("✅ 勇敢邀請已發送！靜待佳音");
        }
        catch (err) {
            showToast("發送失敗");
        }
    };
    const handleBraveInviteResponse = async (notifId, senderId, accept) => {
        if (!user)
            return;
        try {
            await updateDoc(doc(db, getPath("notifications"), notifId), {
                handled: true,
            });
            const replyMsg = accept
                ? "可以試試看！我們站內信聯絡！"
                : "對不起，對方覺得暫時不適合聯動，謝謝你的邀約。";
            // 🔒 寫入通知；寄信由後端依 type 與節流規則判斷
            await addDoc(collection(db, getPath("notifications")), {
                userId: senderId,
                fromUserId: user.uid,
                fromUserName: myProfile?.name || user.displayName || "某位創作者",
                fromUserAvatar: myProfile?.avatar || user.photoURL,
                message: replyMsg,
                type: "brave_response",
                createdAt: Date.now(),
                read: false,
            });
            setRealNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, handled: true } : n)));
            showToast(accept ? "已回覆：可以試試" : "已回覆：委婉拒絕");
        }
        catch (err) {
            showToast("回覆失敗");
        }
    };
    const handleOpenCollabModal = (targetVtuber) => {
        if (!user)
            return showToast("請先登入！");
        setSelectedVTuber(targetVtuber);
        setIsCollabModalOpen(true);
    };
    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, provider);
            showToast("🎉 登入成功！");
            // 🌟 新增 GA4 監控 3：記錄使用者成功登入
            trackAnalyticsEvent('login', { method: 'Google' });
        }
        catch (e) {
            showToast("登入失敗");
        }
    };
    const handleLogout = async () => {
        await signOut(auth);
        navigate("home");
        showToast("已登出");
    };
    const handleLoginOther = async () => {
        const otherProvider = new GoogleAuthProvider();
        // 關鍵：強制要求 Google 顯示帳號選擇器
        otherProvider.setCustomParameters({ prompt: "select_account" });
        try {
            await signInWithPopup(auth, otherProvider);
            showToast("🎉 登入成功！");
        }
        catch (e) {
            console.error("登入失敗:", e);
            showToast("登入失敗");
        }
    };
    // --- 修改後的程式碼 ---
    const displayVtubers = useMemo(() => {
        const getDeterministicOrder = (id) => {
            if (!id)
                return 0;
            const idStr = String(id);
            let hash = 0;
            for (let i = 0; i < idStr.length; i++) {
                hash = (hash << 5) - hash + idStr.charCodeAt(i);
                hash |= 0;
            }
            return Math.sin(hash ^ shuffleSeed);
        };
        const getLatestActivityTime = (v) => {
            const getTime = (val) => {
                if (!val)
                    return 0;
                if (typeof val === "number")
                    return val;
                if (val.toMillis)
                    return val.toMillis();
                return 0;
            };
            return Math.max(getTime(v.lastActiveAt), getTime(v.updatedAt), getTime(v.createdAt));
        };
        // 🌟 取得自己的名片資料 (用於計算契合度)
        const myProfile = user ? realVtubers.find(v => v.id === user.uid) : null;
        let list = Array.isArray(realVtubers) ? [...realVtubers] : [];
        // 🌟 核心邏輯：只有選擇「契合度」排序時，才把分數算進去並顯示
        if (sortOrder === "compatibility") {
            list = list
                .filter(v => v.id !== user?.uid) // 排除自己的名片
                .map(v => ({
                ...v,
                compatibilityScore: calculateCompatibility(myProfile, v)
            }));
        }
        else {
            // 如果選其他排序，強制把分數拔掉，這樣卡片就不會顯示契合度標籤了！
            list = list.map(v => {
                const { compatibilityScore, ...rest } = v;
                return rest;
            });
        }
        return list.sort((a, b) => {
            // 🌟 新增：契合度排序邏輯 (>=60% 隨機洗牌，<60% 依分數排序)
            if (sortOrder === "compatibility") {
                const aHigh = a.compatibilityScore >= 60;
                const bHigh = b.compatibilityScore >= 60;
                if (aHigh && bHigh) {
                    // 兩者都 >= 60%，使用 shuffleSeed 進行隨機洗牌
                    return getDeterministicOrder(a.id) - getDeterministicOrder(b.id);
                }
                else if (aHigh && !bHigh) {
                    return -1; // a 及格，排前面
                }
                else if (!aHigh && bHigh) {
                    return 1; // b 及格，排前面
                }
                else {
                    // 兩者都 < 60%，乖乖依分數高低排序
                    if (b.compatibilityScore !== a.compatibilityScore) {
                        return b.compatibilityScore - a.compatibilityScore;
                    }
                    // 分數相同看活躍度
                    return getLatestActivityTime(b) - getLatestActivityTime(a);
                }
            }
            if (sortOrder === "random") {
                return getDeterministicOrder(a.id) - getDeterministicOrder(b.id);
            }
            if (sortOrder === "likes")
                return (b.likes || 0) - (a.likes || 0);
            if (sortOrder === "subscribers")
                return parseSubscribers(b) - parseSubscribers(a);
            if (sortOrder === "newest") {
                return getLatestActivityTime(b) - getLatestActivityTime(a);
            }
            return 0;
        });
    }, [realVtubers, sortOrder, shuffleSeed, user]);
    const dynamicCollabTypes = useMemo(() => {
        const types = new Set(); // 👈 補上這一行宣告
        if (!Array.isArray(displayVtubers))
            return [];
        displayVtubers
            .filter((v) => v && isVisible(v, user))
            .forEach((v) => {
            if (Array.isArray(v.collabTypes)) {
                v.collabTypes.forEach((t) => {
                    if (typeof t === "string") {
                        const trimmedType = t.trim();
                        if (trimmedType && PREDEFINED_COLLABS.includes(trimmedType)) {
                            types.add(trimmedType);
                        }
                    }
                });
            }
        });
        return Array.from(types).sort();
    }, [displayVtubers, user]);
    const dynamicNationalities = useMemo(() => {
        const PREDEFINED_NATS = ["台灣", "日本", "香港", "馬來西亞"]; // 🌟 預設選項
        const nats = new Set();
        displayVtubers
            .filter((v) => isVisible(v, user))
            .forEach((v) => {
            if (Array.isArray(v.nationalities)) {
                v.nationalities.forEach((n) => nats.add(n));
            }
            else if (v.nationality) {
                nats.add(v.nationality);
            }
        });
        // 🌟 優化：自訂排序邏輯
        const sortedNats = Array.from(nats).sort((a, b) => {
            const idxA = PREDEFINED_NATS.indexOf(a);
            const idxB = PREDEFINED_NATS.indexOf(b);
            // 如果兩個都是預設選項，依照預設陣列的順序排
            if (idxA !== -1 && idxB !== -1)
                return idxA - idxB;
            // 如果 A 是預設選項，A 排前面
            if (idxA !== -1)
                return -1;
            // 如果 B 是預設選項，B 排前面
            if (idxB !== -1)
                return 1;
            // 如果兩個都是自訂選項，依照中文筆畫/字母排序
            return a.localeCompare(b, 'zh-TW');
        });
        return ["All", ...sortedNats];
    }, [displayVtubers, user]);
    const dynamicLanguages = useMemo(() => {
        const PREDEFINED_LANGS = ["國", "日", "英", "粵", "台語"]; // 🌟 預設選項
        const langs = new Set();
        displayVtubers
            .filter((v) => isVisible(v, user))
            .forEach((v) => {
            if (Array.isArray(v.languages)) {
                v.languages.forEach((l) => langs.add(l));
            }
            else if (v.language) {
                langs.add(v.language);
            }
        });
        // 🌟 優化：自訂排序邏輯
        const sortedLangs = Array.from(langs).sort((a, b) => {
            const idxA = PREDEFINED_LANGS.indexOf(a);
            const idxB = PREDEFINED_LANGS.indexOf(b);
            if (idxA !== -1 && idxB !== -1)
                return idxA - idxB;
            if (idxA !== -1)
                return -1;
            if (idxB !== -1)
                return 1;
            return a.localeCompare(b, 'zh-TW');
        });
        return ["All", ...sortedLangs];
    }, [displayVtubers, user]);
    const dynamicSchedules = useMemo(() => {
        const days = new Set();
        const preferredOrder = [
            "隨時可約",
            "平日",
            "週末",
            "星期一",
            "星期二",
            "星期三",
            "星期四",
            "星期五",
            "星期六",
            "星期日",
        ];
        displayVtubers
            .filter((v) => isVisible(v, user))
            .forEach((v) => {
            if (v.isScheduleAnytime)
                days.add("隨時可約");
            if (Array.isArray(v.scheduleSlots)) {
                v.scheduleSlots.forEach((s) => {
                    if (s.day)
                        days.add(s.day);
                });
            }
        });
        const ordered = preferredOrder.filter((d) => days.has(d));
        const custom = Array.from(days).filter((d) => !preferredOrder.includes(d)).sort((a, b) => a.localeCompare(b, 'zh-TW'));
        return ["All", ...ordered, ...custom];
    }, [displayVtubers, user]);
    const displayBulletins = useMemo(() => {
        return [...realBulletins]
            .filter((b) => !b.recruitEndTime || b.recruitEndTime > Date.now())
            .filter((b) => {
            const vt = realVtubers.find((v) => v.id === b.userId); // 改用 realVtubers
            return vt ? isVisible(vt, user) : true;
        })
            .map((b) => {
            const vt = realVtubers.find((v) => v.id === b.userId) || {
                name: "匿名",
                avatar: "[https://api.dicebear.com/7.x/avataaars/svg?seed=Anon](https://api.dicebear.com/7.x/avataaars/svg?seed=Anon)",
            };
            // 👇 【防呆修改】：確保 applicants 必定是陣列，防止舊資料格式錯誤導致 .map() 崩潰
            const safeApplicants = Array.isArray(b.applicants) ? b.applicants : [];
            const applicantsData = safeApplicants
                .map((uid) => realVtubers.find((v) => v.id === uid))
                .filter(Boolean);
            return {
                ...b,
                vtuber: vt,
                postedAt: formatTime(b.createdAt),
                applicantsData,
            };
        })
            .sort((a, b) => b.createdAt - a.createdAt);
    }, [realBulletins, realVtubers, user, displayVtubers]); // 加入相關依賴
    const activeBulletinTypes = useMemo(() => {
        const types = new Set();
        displayBulletins.forEach((b) => {
            if (b.collabType)
                types.add(b.collabType);
        });
        return Array.from(types).sort();
    }, [displayBulletins]);
    const filteredDisplayBulletins = useMemo(() => {
        if (bulletinFilter === "All")
            return displayBulletins;
        return displayBulletins.filter((b) => b.collabType === bulletinFilter);
    }, [displayBulletins, bulletinFilter]);
    const displayCollabs = useMemo(() => {
        const getTimeSafely = (val) => {
            if (!val)
                return 0;
            if (typeof val === "number")
                return val;
            if (val.toMillis)
                return val.toMillis();
            return 0;
        };
        return [...realCollabs]
            .filter((c) => {
            const start = getTimeSafely(c.startTimestamp);
            return !start || currentTime <= start + 2 * 60 * 60 * 1000;
        })
            .sort((a, b) => getTimeSafely(a.startTimestamp || a.createdAt) -
            getTimeSafely(b.startTimestamp || b.createdAt));
    }, [realCollabs, currentTime]);
    const filteredDisplayCollabs = useMemo(() => {
        if (collabCategoryTab === "All")
            return displayCollabs;
        return displayCollabs.filter((c) => (c.category || "遊戲") === collabCategoryTab);
    }, [displayCollabs, collabCategoryTab]);
    const [searchInput, setSearchInput] = useState("");
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(searchInput);
        }, 300); // 使用者停止打字 300 毫秒後才執行過濾
        return () => clearTimeout(timer);
    }, [searchInput]);
    const filteredVTubers = useMemo(() => {
        return displayVtubers.filter((v) => {
            if (!v || !isVisible(v, user))
                return false;
            const searchLower = (searchQuery || "").toLowerCase();
            const vTags = Array.isArray(v.tags) ? v.tags : [];
            const vName = (v.name || "").toLowerCase(); // 確保 name 存在才轉小寫
            const matchSearch = vName.includes(searchLower) ||
                vTags.some((t) => String(t || "")
                    .toLowerCase()
                    .includes(searchLower));
            const matchTags = selectedTags.length === 0 ||
                selectedTags.every((t) => vTags.includes(t));
            const matchAgency = selectedAgency === "All" || v.agency === selectedAgency;
            const matchPlatform = selectedPlatform === "All" || v.mainPlatform === selectedPlatform;
            const vNats = Array.isArray(v.nationalities) ? v.nationalities : [];
            const matchNationality = selectedNationality === "All" || vNats.includes(selectedNationality);
            const vLangs = Array.isArray(v.languages) ? v.languages : [];
            const matchLanguage = selectedLanguage === "All" || vLangs.includes(selectedLanguage);
            const matchSchedule = selectedSchedule === "All" ||
                (selectedSchedule === "隨時可約" && v.isScheduleAnytime) ||
                (Array.isArray(v.scheduleSlots) &&
                    v.scheduleSlots.some((s) => s.day === selectedSchedule));
            const vColors = Array.isArray(v.colorSchemes) ? v.colorSchemes : [];
            const matchColor = selectedColor === "All" || vColors.includes(selectedColor);
            const matchZodiac = selectedZodiac === "All" || v.zodiacSign === selectedZodiac;
            return (matchSearch &&
                matchTags &&
                matchAgency &&
                matchPlatform &&
                matchNationality &&
                matchLanguage &&
                matchSchedule &&
                matchColor &&
                matchZodiac);
        });
    }, [
        displayVtubers,
        searchQuery,
        selectedTags,
        selectedAgency,
        selectedPlatform,
        selectedNationality,
        selectedLanguage,
        selectedSchedule,
        selectedZodiac,
        selectedColor,
        user,
    ]);
    const toggleTag = (tag) => setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
    useEffect(() => {
        setCurrentPage(1);
    }, [
        searchQuery,
        selectedTags,
        selectedAgency,
        selectedPlatform,
        selectedNationality,
        selectedLanguage,
        selectedSchedule,
        selectedColor,
        selectedZodiac,
        sortOrder,
        shuffleSeed,
    ]);
    const ITEMS_PER_PAGE = 18;
    const totalPages = Math.max(1, Math.ceil(filteredVTubers.length / ITEMS_PER_PAGE));
    const paginatedVTubers = filteredVTubers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const scrollVtuberGridToTop = () => {
        const target = document.getElementById("vtuber-partner-page-top");
        const getTargetTop = () => {
            if (!target)
                return 0;
            return Math.max(0, target.getBoundingClientRect().top + window.scrollY - 88);
        };
        const doScroll = () => {
            const top = getTargetTop();
            window.scrollTo({ top, behavior: "auto" });
            // iOS Safari / 部分手機瀏覽器補強，避免切頁後停在原本的頁面底部。
            if (document.body)
                document.body.scrollTop = top;
            if (document.documentElement)
                document.documentElement.scrollTop = top;
        };
        requestAnimationFrame(() => {
            doScroll();
            setTimeout(doScroll, 80);
        });
    };
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
            setCurrentPage(newPage);
            scrollVtuberGridToTop();
        }
    };
    // ✅ 手機版 grid 頁穩定化：從其他頁刷新後再回到「尋找 VTuber 夥伴」時，
    // 清掉手機選單/篩選殘留並鎖住橫向溢出，避免上一頁狀態影響 grid 版面。
    useEffect(() => {
        if (currentView !== "grid") {
            setIsMobileFilterOpen(false);
            return;
        }
        setIsMobileMenuOpen(false);
        requestAnimationFrame(() => {
            const root = document.getElementById("vtuber-partner-page-top");
            if (root)
                root.style.removeProperty("transform");
            if (document.documentElement)
                document.documentElement.style.overflowX = "hidden";
            if (document.body)
                document.body.style.overflowX = "hidden";
        });
    }, [currentView]);
    const syncVtuberCache = (newList, timestamp = Date.now()) => {
        const safeList = Array.isArray(newList) ? newList : [];
        setRealVtubers(safeList);
        writeLocalCache(VTUBER_CACHE_KEY, safeList);
        markCacheTimestamp(VTUBER_CACHE_TS, timestamp);
    };
    const syncBulletinCache = (newList, timestamp = Date.now()) => {
        const safeList = Array.isArray(newList) ? newList : [];
        setRealBulletins(safeList);
        writeLocalCache(BULLETINS_CACHE_KEY, safeList);
        markCacheTimestamp(BULLETINS_CACHE_TS, timestamp);
    };
    const syncCollabCache = (newList, timestamp = Date.now()) => {
        const safeList = Array.isArray(newList) ? newList : [];
        setRealCollabs(safeList);
        writeLocalCache(COLLABS_CACHE_KEY, safeList);
        markCacheTimestamp(COLLABS_CACHE_TS, timestamp);
    };
    const handleSaveProfile = async (e, customForm = profileForm) => {
        if (e)
            e.preventDefault();
        if (!user)
            return showToast("請先登入！");
        const targetUid = isAdmin ? (customForm.id || user.uid) : user.uid;
        const existingProfile = realVtubers.find((v) => v.id === targetUid);
        // 🌟 新增：檢查是否被限制提交 (退回 >= 3 次且在 24 小時內)
        if (!isAdmin && existingProfile && existingProfile.rejectionCount >= 3) {
            const now = Date.now();
            const blockDuration = 24 * 60 * 60 * 1000; // 24 小時
            const timeSinceLastRejection = now - (existingProfile.lastRejectedAt || 0);
            if (timeSinceLastRejection < blockDuration) {
                const remainHours = Math.ceil((blockDuration - timeSinceLastRejection) / (60 * 60 * 1000));
                return showToast(`❌ 您的名片已被退回 3 次以上。為維護審核品質，請於 ${remainHours} 小時後再重新提交！`);
            }
        }
        // 1. 驗證身分說明 (非管理員必須填寫 X 或 YT)
        if (!isAdmin && !customForm.verificationNote?.trim()) {
            alert("請填寫身分驗證說明，告知管理員您在哪個平台放入了驗證文字。");
            return;
        }
        // 2. 驗證信箱
        if (customForm.publicEmail &&
            customForm.publicEmail.trim() !== "" &&
            !customForm.publicEmailVerified) {
            return showToast("請先完成公開工商信箱驗證，或清空該欄位！");
        }
        // 🌟 新增：3. 驗證可聯動時段 (強制必填)
        let hasValidSchedule = false;
        if (customForm.isScheduleAnytime) {
            hasValidSchedule = true;
        }
        else if (customForm.isScheduleCustom) {
            hasValidSchedule = customForm.customScheduleText && customForm.customScheduleText.trim() !== "";
        }
        else {
            // 選擇「指定時段」或「除了以下時段」時，陣列裡面必須至少有一個時段
            hasValidSchedule = customForm.scheduleSlots && customForm.scheduleSlots.length > 0;
        }
        if (!hasValidSchedule) {
            return showToast("❌ 請務必填寫「可聯動時段」！(若選擇自訂請輸入內容，若選擇指定時段請新增至少一個時段)");
        }
        try {
            showToast("⏳ 正在處理圖片並儲存名片...");
            const targetUid = isAdmin ? (customForm.id || user.uid) : user.uid;
            // --- A. 圖片上傳至 Storage ---
            const avatarUrl = await uploadImageToStorage(targetUid, customForm.avatar, "avatar.jpg");
            const bannerUrl = await uploadImageToStorage(targetUid, customForm.banner, "banner.jpg");
            // --- B. 標籤安全處理 (修正 split 報錯) ---
            let tagsArray = [];
            if (Array.isArray(customForm.tags)) {
                tagsArray = customForm.tags;
            }
            else if (typeof customForm.tags === "string") {
                tagsArray = customForm.tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter((t) => t);
            }
            // --- C. 連動類型處理 ---
            let finalCollabs = Array.isArray(customForm.collabTypes)
                ? [...customForm.collabTypes]
                : [];
            if (customForm.isOtherCollab && customForm.otherCollabText?.trim()) {
                const otherText = customForm.otherCollabText.trim();
                if (!finalCollabs.includes(otherText))
                    finalCollabs.push(otherText);
            }
            if (finalCollabs.length === 0)
                return showToast("請至少選擇一項連動類型！");
            const finalCreatorRoles = Array.isArray(customForm.creatorRoles) ? customForm.creatorRoles : [];
            const finalCreatorStyles = Array.isArray(customForm.creatorStyles) ? customForm.creatorStyles : [];
            if (finalCreatorRoles.length > 0 && finalCreatorStyles.length === 0) {
                return showToast("請至少選擇一項創作風格 / 類型！");
            }
            if (finalCreatorStyles.includes("其他(自由填寫)") && !String(customForm.creatorOtherStyleText || "").trim()) {
                return showToast("請填寫其他創作風格 / 類型，或取消勾選其他。");
            }
            const existingProfile = realVtubers.find((v) => v.id === targetUid);
            const finalPersonality = customForm.personalityType === "其他"
                ? customForm.personalityTypeOther || "其他"
                : customForm.personalityType || "";
            // ✅ 限時動態防重發：儲存名片時不再刷新舊動態時間戳。
            // 若舊動態已過期且使用者沒有重新輸入新內容，就直接清空，避免 24 小時後被快取或儲存動作重新帶回來。
            const statusDraft = String(customForm.statusMessage || "").trim();
            const existingStatusMessage = String(existingProfile?.statusMessage || "").trim();
            const existingStatusUpdatedAt = Number(existingProfile?.statusMessageUpdatedAt || 0);
            const existingStatusExpiresAt = Number(existingProfile?.statusMessageExpiresAt || 0);
            const existingStatusIsLive = existingStatusMessage.includes("🔴");
            const existingExpireLimit = existingStatusIsLive ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
            const existingStatusStillActive = !!existingStatusMessage && !!existingStatusUpdatedAt && (existingStatusExpiresAt ? Date.now() < existingStatusExpiresAt : Date.now() - existingStatusUpdatedAt < existingExpireLimit);
            const statusChangedByEditor = statusDraft !== existingStatusMessage;
            const newStatusMessageUpdatedAt = statusDraft ? (statusChangedByEditor ? Date.now() : (existingStatusStillActive ? existingStatusUpdatedAt : 0)) : 0;
            const newStatusMessageExpiresAt = statusDraft && newStatusMessageUpdatedAt
                ? newStatusMessageUpdatedAt + (statusDraft.includes("🔴") ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)
                : 0;
            let newStatusReactions = existingProfile?.statusReactions || { plus_one: [], watching: [], fire: [] };
            if (statusDraft !== existingStatusMessage || !newStatusMessageUpdatedAt) {
                newStatusReactions = { plus_one: [], watching: [], fire: [] };
            }
            // --- D. 準備寫入 Firestore 的公開資料 ---
            const publicData = {
                ...customForm,
                id: targetUid,
                avatar: avatarUrl || "",
                banner: bannerUrl || "",
                tags: tagsArray,
                collabTypes: finalCollabs,
                creatorRoles: finalCreatorRoles,
                creatorStyles: finalCreatorStyles,
                creatorStatus: customForm.creatorStatus || "",
                creatorBudgetRange: normalizeCreatorBudgetRange(customForm.creatorBudgetRange),
                creatorOtherStyleText: String(customForm.creatorOtherStyleText || "").trim(),
                creatorPortfolioUrl: customForm.creatorPortfolioUrl || "",
                slug: (customForm.slug || "").trim().toLowerCase(),
                personalityType: finalPersonality,
                // 🌟 新增：寫入限時動態資料
                statusMessage: newStatusMessageUpdatedAt ? statusDraft : "",
                statusMessageUpdatedAt: newStatusMessageUpdatedAt,
                statusMessageExpiresAt: newStatusMessageExpiresAt,
                statusReactions: newStatusReactions,
                updatedAt: Date.now(),
            };
            // 💡 關鍵修正：移除 UI 狀態欄位與可能為 undefined 的欄位
            const uiFields = [
                // 私密 / UI 暫存欄位
                "id",
                "emailOtp",
                "contactEmail",
                "verificationNote",
                "publicEmail",
                "publicEmailVerified",
                "isOtherCollab",
                "otherCollabText",
                "isOtherNationality",
                "otherNationalityText",
                "personalityTypeOther",
                // 使用者不應透過「儲存名片」改動的系統 / 互動欄位
                "likes",
                "likedBy",
                "dislikes",
                "dislikedBy",
                "fcmToken",
                "privateEmail",
                "admin",
                "role",
                "customClaims",
                "lastActiveAt",
                "lastOnlineAt",
                "lastEmailSentAt",
                "lastNotifSentAt",
                "rejectionCount",
                "lastRejectedAt",
                "status"
            ];
            uiFields.forEach((f) => delete publicData[f]);
            // ✅ Firestore Rules 會阻擋 name / description 內類似 HTML tag 的內容
            const stripHtmlTags = (val) => typeof val === "string" ? val.replace(/<[^>]+>/g, "") : val;
            publicData.name = stripHtmlTags(publicData.name || "");
            publicData.description = stripHtmlTags(publicData.description || "");
            // Firestore 不允許 undefined，將所有 undefined 轉為 null 或空字串
            Object.keys(publicData).forEach((key) => {
                if (publicData[key] === undefined) {
                    publicData[key] = "";
                }
            });
            if (!existingProfile ||
                existingProfile.verificationStatus === "rejected") {
                publicData.isVerified = false;
                publicData.isBlacklisted = false;
                publicData.verificationStatus = "pending";
                publicData.showVerificationModal = null;
                publicData.likes = 0;
                publicData.likedBy = [];
                publicData.dislikes = 0;
                publicData.dislikedBy = [];
                publicData.createdAt = existingProfile?.createdAt || Date.now();
            }
            else {
                // ✅ 已存在且非退回的名片：一般儲存不碰審核欄位，避免 Rules 判定為竄改
                delete publicData.isVerified;
                delete publicData.isBlacklisted;
                delete publicData.verificationStatus;
                delete publicData.showVerificationModal;
                delete publicData.createdAt;
            }
            // --- E. 準備私密資料 ---
            const privateData = {
                // 🌟 資安優化：徹底移除 contactEmail，不再收集與儲存私人信箱
                verificationNote: customForm.verificationNote || "",
                publicEmail: customForm.publicEmail || "",
                publicEmailVerified: !!customForm.publicEmailVerified,
                updatedAt: Date.now(),
            };
            // --- F. 執行寫入 ---
            const publicRef = doc(db, getPath("vtubers"), targetUid);
            const privateRef = doc(db, getPath("vtubers_private"), targetUid);
            const isNewProfile = !existingProfile;
            console.group("🧪 V-Nexus 名片儲存 Debug");
            console.log("目前登入 uid:", user?.uid);
            console.log("目標 targetUid:", targetUid);
            console.log("是否管理員:", !!isAdmin);
            console.log("是否新名片:", isNewProfile);
            console.log("publicData keys:", Object.keys(publicData));
            console.table(Object.keys(publicData).map((key) => ({
                key,
                type: Array.isArray(publicData[key]) ? "array" : typeof publicData[key],
                value: typeof publicData[key] === "string"
                    ? publicData[key].slice(0, 80)
                    : JSON.stringify(publicData[key] ?? "").slice(0, 120),
            })));
            console.groupEnd();
            // ✅ 舊公開名片如果殘留 fcmToken/contactEmail 等敏感欄位，
            // 新版 Rules 的 noPublicSensitiveKeys 會導致任何後續更新被拒絕。
            // 因此更新舊名片時一併刪除這些欄位。
            const publicFieldCleanup = isNewProfile ? {} : {
                fcmToken: deleteField(),
                privateEmail: deleteField(),
                contactEmail: deleteField(),
                publicEmail: deleteField(),
                publicEmailVerified: deleteField(),
                verificationNote: deleteField(),
                emailOtp: deleteField(),
                admin: deleteField(),
                role: deleteField(),
                customClaims: deleteField(),
                lastEmailSentAt: deleteField(),
                lastNotifSentAt: deleteField(),
                rejectionCount: deleteField(),
                lastRejectedAt: deleteField(),
                status: deleteField(),
            };
            try {
                if (isNewProfile) {
                    await setDoc(publicRef, publicData, { merge: true });
                }
                else {
                    await updateDoc(publicRef, { ...publicData, ...publicFieldCleanup });
                }
                console.log("✅ public vtubers 寫入成功");
            }
            catch (err) {
                console.error("❌ public vtubers 寫入失敗:", err);
                console.log("失敗時 publicData keys:", Object.keys(publicData));
                console.log("失敗時 publicData:", publicData);
                throw err;
            }
            try {
                await setDoc(privateRef, privateData, { merge: true });
                console.log("✅ private vtubers_private 寫入成功");
            }
            catch (err) {
                console.error("❌ private vtubers_private 寫入失敗:", err);
                console.log("失敗時 privateData keys:", Object.keys(privateData));
                throw err;
            }
            // --- G. 同步本地與快取 ---
            setRealVtubers((prev) => {
                const newList = prev.map((v) => v.id === targetUid ? { ...v, ...publicData } : v);
                if (!prev.find((v) => v.id === targetUid))
                    newList.push(publicData);
                syncVtuberCache(newList);
                return newList;
            });
            showToast(existingProfile?.isVerified
                ? "🎉 名片已成功更新！"
                : "🎉 名片已建立！等待審核中。");
            if (!customForm.id)
                navigate("grid");
        }
        catch (err) {
            console.error("儲存失敗詳細錯誤:", err);
            // 這裡會噴出具體的錯誤原因，請打開 F12 查看
            showToast(`❌ 儲存失敗: ${err.code || ""} ${err.message || err}`);
        }
    };
    const handleQuickStatusUpdate = async (targetId, statusMsg, isLive = false) => {
        if (!user)
            return showToast("請先登入！");
        const uid = targetId || user.uid;
        const existingProfile = realVtubers.find((v) => v.id === uid);
        if (!existingProfile) {
            return showToast("⚠️ 請先填寫下方必填欄位並「儲存名片」後，才能獨立發布動態喔！");
        }
        try {
            showToast("⏳ 處理中...");
            const now = Date.now();
            const content = statusMsg || "";
            const statusDuration = isLive ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
            const statusExpiresAt = content ? now + statusDuration : 0;
            await updateDoc(doc(db, getPath("vtubers"), uid), {
                statusMessage: content,
                statusMessageUpdatedAt: content ? now : 0,
                statusMessageExpiresAt: statusExpiresAt,
                // 🌟 新增：發布新動態時，清空互動名單
                statusReactions: { plus_one: [], watching: [], fire: [] },
                updatedAt: now
            });
            // 廣播給全站使用者
            await setDoc(doc(db, getPath("settings"), "stats"), {
                lastGlobalUpdate: now
            }, { merge: true });
            // 即時更新本地畫面與快取
            setRealVtubers((prev) => {
                const newList = prev.map((v) => v.id === uid ? { ...v, statusMessage: content, statusMessageUpdatedAt: content ? now : 0, statusMessageExpiresAt: statusExpiresAt, statusReactions: { plus_one: [], watching: [], fire: [] }, updatedAt: now } : v);
                syncVtuberCache(newList);
                return newList;
            });
            if (!content) {
                showToast("🧹 動態已清除！");
            }
            else {
                showToast(isLive ? "🔴 已火速發布直播通知！(3小時後自動隱藏)" : "✅ 限時動態已火速發布！全站已同步");
            }
        }
        catch (err) {
            console.error(err);
            showToast("❌ 操作失敗，請稍後再試");
        }
    };
    const handleStatusReaction = async (e, target, type) => {
        e.stopPropagation();
        if (!user)
            return showToast("請先登入！");
        if (!isVerifiedUser)
            return showToast("需通過認證才能互動喔！");
        if (target.id === user.uid)
            return showToast("不能對自己的動態互動喔！");
        // 🌟 優化：改用資料庫真實數據判斷是否已互動，取代 localStorage (跨裝置也能同步)
        const reactions = target.statusReactions || { plus_one: [], watching: [], fire: [] };
        const hasReacted = (reactions.plus_one || []).includes(user.uid) ||
            (reactions.watching || []).includes(user.uid) ||
            (reactions.fire || []).includes(user.uid);
        if (hasReacted) {
            return showToast("您已經對這則動態表達過心意囉！");
        }
        let msg = "";
        let icon = "";
        if (type === 'plus_one') {
            msg = `對您的限時動態表示：👋 +1 (想了解/參加)！\n\n動態內容：「${target.statusMessage}」`;
            icon = "👋";
        }
        else if (type === 'watching') {
            msg = `對您的限時動態表示：👀 觀望中 (很有興趣喔)！\n\n動態內容：「${target.statusMessage}」`;
            icon = "👀";
        }
        else if (type === 'fire') {
            msg = `對您的限時動態表示：🔥 企劃超讚！幫推！\n\n動態內容：「${target.statusMessage}」`;
            icon = "🔥";
        }
        try {
            // 1. 寫入通知資料庫
            await addDoc(collection(db, getPath("notifications")), {
                userId: target.id,
                fromUserId: user.uid,
                fromUserName: myProfile?.name || "創作者",
                fromUserAvatar: myProfile?.avatar || "",
                message: msg,
                type: "status_reaction",
                createdAt: Date.now(),
                read: false,
            });
            // 🌟 2. 更新名片上的互動名單 (使用 arrayUnion 確保不重複)
            await updateDoc(doc(db, getPath("vtubers"), target.id), {
                [`statusReactions.${type}`]: arrayUnion(user.uid)
            });
            // 🌟 3. 即時更新本地畫面，讓按鈕數字瞬間 +1
            setRealVtubers(prev => prev.map(v => {
                if (v.id === target.id) {
                    const currentReactions = v.statusReactions || { plus_one: [], watching: [], fire: [] };
                    return {
                        ...v,
                        statusReactions: {
                            ...currentReactions,
                            [type]: [...(currentReactions[type] || []), user.uid]
                        }
                    };
                }
                return v;
            }));
            showToast(`✅ 已發送 ${icon} 給對方！`);
            if (type === 'plus_one') {
                setChatTarget(target);
            }
        }
        catch (err) {
            console.error(err);
            showToast("❌ 發送失敗");
        }
    };
    const handleUserDeleteSelf = async () => {
        if (!user)
            return;
        // 顯示自訂確認視窗
        const confirmDelete = window.confirm("你確認要刪除V-NEXUS名片?\n提醒您: 刪除後需要重新審核");
        if (!confirmDelete)
            return;
        try {
            showToast("⏳ 正在刪除您的名片...");
            // 1. 刪除 Firestore 中的公開與私密資料
            await deleteDoc(doc(db, getPath("vtubers"), user.uid));
            await deleteDoc(doc(db, getPath("vtubers_private"), user.uid));
            // 2. 更新本地狀態與快取
            setRealVtubers((prev) => {
                const newList = prev.filter((v) => v.id !== user.uid);
                syncVtuberCache(newList);
                return newList;
            });
            // 3. 重置表單狀態
            setProfileForm(getEmptyProfile(user.uid));
            showToast("✅ 名片已成功刪除");
            // 4. 導向首頁或探索頁
            navigate("home");
        }
        catch (err) {
            console.error("刪除失敗:", err);
            showToast("❌ 刪除失敗，請稍後再試");
        }
    };
    const handleBulletinImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file)
            return;
        if (file.size > 5 * 1024 * 1024) {
            e.target.value = "";
            return showToast("❌ 檔案太大！請選擇 5MB 以下。");
        }
        showToast("⏳ 圖片壓縮中...");
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width, height = img.height;
                const maxWidth = 800, maxHeight = 800;
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                canvas.getContext("2d").drawImage(img, 0, 0, width, height);
                const base64Str = canvas.toDataURL("image/jpeg", 0.8);
                if (base64Str.length > 800000) {
                    e.target.value = "";
                    return showToast("❌ 壓縮後依然太大！");
                }
                setNewBulletin((prev) => ({ ...prev, image: base64Str }));
                e.target.value = "";
                showToast(`✅ 圖片上傳成功！`);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };
    const handleAddDefaultBulletinImage = async (base64) => {
        showToast("⏳ 正在上傳預設圖片至 Storage...");
        try {
            // 將預設圖存放在 system/bulletin_defaults 資料夾下
            const fileName = `default_${Date.now()}.jpg`;
            const storageUrl = await uploadImageToStorage("system", base64, `bulletin_defaults/${fileName}`);
            const newImages = [...defaultBulletinImages, storageUrl];
            await setDoc(doc(db, getPath("settings"), "bulletinImages"), { images: newImages }, { merge: true });
            setDefaultBulletinImages(newImages);
            showToast("✅ 預設圖片已新增並存至 Storage");
        }
        catch (e) {
            console.error(e);
            showToast("❌ 新增失敗，請檢查 Storage 權限");
        }
    };
    const handleDeleteDefaultBulletinImage = async (idx) => {
        if (!confirm("確定刪除這張預設圖片？"))
            return;
        const newImages = defaultBulletinImages.filter((_, i) => i !== idx);
        try {
            await setDoc(doc(db, getPath("settings"), "bulletinImages"), { images: newImages }, { merge: true });
            setDefaultBulletinImages(newImages);
            showToast("✅ 已刪除");
        }
        catch (e) {
            showToast("刪除失敗");
        }
    };
    const handlePostBulletin = async () => {
        if (!user)
            return showToast("請先登入！");
        // 1. 必填檢查
        if (!newBulletin.content.trim() ||
            !newBulletin.collabType ||
            !newBulletin.collabSize ||
            !newBulletin.collabTime ||
            !newBulletin.recruitEndTime ||
            !newBulletin.image) {
            return showToast("請完整填寫所有必填欄位，並選擇一張招募圖片！");
        }
        const rEnd = new Date(newBulletin.recruitEndTime).getTime();
        const cTime = new Date(newBulletin.collabTime).getTime();
        if (rEnd < Date.now() && !newBulletin.id)
            return showToast("截止時間不能在過去！");
        if (cTime < rEnd)
            return showToast("⚠️ 聯動時間不能早於招募截止日！");
        if (!myProfile?.isVerified)
            return showToast("名片審核通過後才能發布喔！");
        // 每位創作者最多同時保留 3 個未截止的揪團企劃。
        // 第 4 個必須等較早的揪團截止或自行刪除後才能發布。
        if (!newBulletin.id) {
            const activeMyBulletins = (realBulletins || []).filter((b) => {
                if (!b || b.userId !== user.uid)
                    return false;
                const endTime = Number(b.recruitEndTime || 0);
                return endTime > Date.now();
            });
            if (activeMyBulletins.length >= 3) {
                return showToast("目前最多只能同時發布 3 個揪團企劃，請等其中一個截止或刪除後再發布。");
            }
        }
        try {
            showToast("⏳ 正在處理中...");
            const ft = newBulletin.collabType === "其他"
                ? newBulletin.collabTypeOther
                : newBulletin.collabType;
            let finalImage = newBulletin.image;
            // 圖片處理
            if (finalImage && finalImage.startsWith("data:image")) {
                const fileName = `bulletin_${Date.now()}.jpg`;
                finalImage = await uploadImageToStorage(user.uid, newBulletin.image, fileName);
            }
            setIsBulletinFormOpen(false);
            if (newBulletin.id) {
                // --- 編輯模式 ---
                await updateDoc(doc(db, getPath("bulletins"), newBulletin.id), {
                    content: newBulletin.content,
                    collabType: ft,
                    collabSize: newBulletin.collabSize,
                    collabTime: newBulletin.collabTime,
                    recruitEndTime: rEnd,
                    image: finalImage,
                });
                // ✨ 更新 State 且同步更新快取
                setRealBulletins((prev) => {
                    const newList = prev.map((b) => b.id === newBulletin.id
                        ? {
                            ...b,
                            content: newBulletin.content,
                            collabType: ft,
                            collabSize: newBulletin.collabSize,
                            collabTime: newBulletin.collabTime,
                            recruitEndTime: rEnd,
                            image: finalImage,
                        }
                        : b);
                    syncBulletinCache(newList);
                    return newList;
                });
                showToast("🚀 招募修改成功！");
            }
            else {
                // --- 新增模式 ---
                const newDocData = {
                    userId: user.uid,
                    content: newBulletin.content,
                    collabType: ft,
                    collabSize: newBulletin.collabSize,
                    collabTime: newBulletin.collabTime,
                    recruitEndTime: rEnd,
                    image: finalImage,
                    applicants: [],
                    createdAt: Date.now(),
                };
                const newDocRef = await addDoc(collection(db, getPath("bulletins")), newDocData);
                // ✨ 更新 State 且同步更新快取
                setRealBulletins((prev) => {
                    const newList = [{ id: newDocRef.id, ...newDocData }, ...prev];
                    syncBulletinCache(newList);
                    return newList;
                });
                showToast("🚀 發布成功！");
            }
            // 重置表單
            setNewBulletin({
                id: null,
                content: "",
                collabType: "",
                collabTypeOther: "",
                collabSize: "",
                collabTime: "",
                recruitEndTime: "",
                image: "",
            });
        }
        catch (err) {
            console.error("發一個招募企劃失敗:", err);
            showToast("❌ 操作失敗，請檢查網路或圖片大小");
        }
    };
    const handleEditBulletin = (b) => {
        const rEndD = new Date(b.recruitEndTime);
        const rEndStr = `${rEndD.getFullYear()}-${String(rEndD.getMonth() + 1).padStart(2, "0")}-${String(rEndD.getDate()).padStart(2, "0")}T${String(rEndD.getHours()).padStart(2, "0")}:${String(rEndD.getMinutes()).padStart(2, "0")}`;
        setNewBulletin({
            id: b.id,
            content: b.content,
            collabType: PREDEFINED_COLLABS.includes(b.collabType)
                ? b.collabType
                : "其他",
            collabTypeOther: PREDEFINED_COLLABS.includes(b.collabType)
                ? ""
                : b.collabType,
            collabSize: b.collabSize,
            collabTime: b.collabTime,
            recruitEndTime: rEndStr,
            image: b.image || "",
        });
        setIsBulletinFormOpen(true);
        navigate("bulletin");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const handleApplyBulletin = async (bulletinId, isApplying, bulletinAuthorId) => {
        if (!user) {
            showToast("❌ 請先登入並管理名片！正在前往認證頁面...");
            setTimeout(() => {
                navigate("dashboard");
            }, 1500);
            return;
        }
        if (!isVerifiedUser) {
            showToast("❌ 需通過名片認證才能報名！正在前往認證頁面...");
            // 延遲一下讓使用者看清楚 Toast，然後跳轉到註冊頁面
            setTimeout(() => {
                navigate("dashboard");
            }, 1500);
            return;
        }
        try {
            await updateDoc(doc(db, getPath("bulletins"), bulletinId), {
                applicants: isApplying ? arrayUnion(user.uid) : arrayRemove(user.uid),
            });
            setRealBulletins((prev) => {
                const newList = prev.map((b) => b.id === bulletinId
                    ? {
                        ...b,
                        applicants: isApplying
                            ? [...(b.applicants || []), user.uid]
                            : (b.applicants || []).filter((id) => id !== user.uid),
                    }
                    : b);
                syncBulletinCache(newList);
                return newList;
            });
            showToast(isApplying ? "✅ 已成功送出意願！" : "已收回意願");
            if (isApplying && bulletinAuthorId !== user.uid) {
                // 🔒 統一寫入通知；寄信由後端依 type 與節流規則判斷
                addDoc(collection(db, getPath("notifications")), {
                    userId: bulletinAuthorId,
                    fromUserId: user.uid,
                    fromUserName: myProfile?.name || user.displayName || "某位創作者",
                    fromUserAvatar: myProfile?.avatar || user.photoURL,
                    message: "對您的招募企劃表達了意願！快去招募佈告欄看看！",
                    type: "bulletin_apply",
                    createdAt: Date.now(),
                    read: false,
                }).catch(() => { });
            }
        }
        catch (err) {
            showToast("操作失敗");
        }
    };
    const handleRecommend = async (target) => {
        if (!isVerifiedUser)
            return showToast("需通過認證才能推薦！");
        if (target.id === user.uid)
            return showToast("不能推薦自己！");
        if (target.likedBy && target.likedBy.includes(user.uid))
            return showToast("已經推薦過囉！每人限推薦一次。");
        try {
            await updateDoc(doc(db, getPath("vtubers"), target.id), {
                likes: increment(1),
                likedBy: arrayUnion(user.uid),
            });
            setRealVtubers((prev) => prev.map((v) => v.id === target.id
                ? {
                    ...v,
                    likes: (v.likes || 0) + 1,
                    likedBy: [...(v.likedBy || []), user.uid],
                }
                : v));
            if (selectedVTuber?.id === target.id)
                setSelectedVTuber((prev) => ({
                    ...prev,
                    likes: (prev.likes || 0) + 1,
                    likedBy: [...(prev.likedBy || []), user.uid],
                }));
            showToast("✅ 已送出推薦！");
        }
        catch (err) {
            showToast("推薦失敗");
        }
    };
    const handleInitiateDislike = (target) => {
        if (!isVerifiedUser)
            return showToast("需通過認證才能檢舉！");
        if (target.id === user.uid)
            return showToast("不能檢舉自己！");
        if (target.dislikedBy && target.dislikedBy.includes(user.uid))
            return showToast("已經倒讚過囉！");
        setConfirmDislikeData(target);
    };
    const handleConfirmDislike = async () => {
        if (!confirmDislikeData || !user)
            return;
        const tId = confirmDislikeData.id;
        if (confirmDislikeData.dislikedBy &&
            confirmDislikeData.dislikedBy.includes(user.uid)) {
            setConfirmDislikeData(null);
            return showToast("已經倒讚過囉！");
        }
        const newD = (confirmDislikeData.dislikes || 0) + 1;
        const updates = {
            dislikes: increment(1),
            dislikedBy: arrayUnion(user.uid),
        };
        if (newD >= 10) {
            updates.isVerified = false;
            updates.isBlacklisted = true;
        }
        try {
            await updateDoc(doc(db, getPath("vtubers"), tId), updates);
            setRealVtubers((prev) => prev.map((v) => v.id === tId
                ? {
                    ...v,
                    dislikes: newD,
                    dislikedBy: [...(v.dislikedBy || []), user.uid],
                    isVerified: updates.isVerified ?? v.isVerified,
                    isBlacklisted: updates.isBlacklisted ?? v.isBlacklisted,
                }
                : v));
            setConfirmDislikeData(null);
            showToast("✅ 已送出倒讚。");
            if (updates.isBlacklisted) {
                showToast("⚠️ 該名片已自動下架。");
                if (selectedVTuber?.id === tId)
                    navigate("grid");
            }
            else if (selectedVTuber?.id === tId) {
                setSelectedVTuber((prev) => ({
                    ...prev,
                    dislikes: newD,
                    dislikedBy: [...(prev.dislikedBy || []), user.uid],
                }));
            }
        }
        catch (err) {
            showToast("操作失敗");
        }
    };
    const handleVerifyVtuber = async (id) => {
        const targetVtuber = realVtubers.find((v) => v.id === id);
        if (!targetVtuber) {
            showToast("❌ 找不到該名片資料");
            return;
        }
        try {
            if (!auth.currentUser) {
                showToast("❌ 請先登入管理員帳號");
                return;
            }
            showToast("⏳ 正在審核名片...");
            const authToken = await auth.currentUser.getIdToken(true);
            const reviewVtuberCard = httpsCallable(functionsInstance, "reviewVtuberCard");
            const result = await reviewVtuberCard({ uid: id, action: "approve", authToken });
            const payload = result?.data || {};
            const updates = payload.updates || {
                isVerified: true,
                verificationStatus: "approved",
                showVerificationModal: "approved",
                rejectionCount: 0,
                verificationNote: "",
            };
            setRealVtubers((prev) => {
                const newList = prev.map((v) => v.id === id ? { ...v, ...updates, verificationNote: updates.verificationNote || undefined } : v);
                syncVtuberCache(newList);
                return newList;
            });
            showToast(payload.emailWarning ? `✅ 已通過審核；${payload.emailWarning}` : "✅ 已通過審核並送出通知！");
        }
        catch (err) {
            console.error("審核通過失敗:", err);
            const message = err?.message || err?.details || "請確認管理員權限、App Check 與 Functions 是否已部署";
            showToast(`❌ 審核失敗：${message}`);
        }
    };
    const handleRejectVtuber = async (id) => {
        const targetVtuber = realVtubers.find((v) => v.id === id);
        if (!targetVtuber) {
            showToast("❌ 找不到該名片資料");
            return;
        }
        const reason = prompt("請輸入退回原因：", targetVtuber?.verificationNote || "");
        if (reason === null) {
            return;
        }
        const trimmedReason = reason.trim();
        if (!trimmedReason) {
            showToast("❌ 請輸入退回原因");
            return;
        }
        try {
            if (!auth.currentUser) {
                showToast("❌ 請先登入管理員帳號");
                return;
            }
            showToast("⏳ 正在退回名片...");
            const authToken = await auth.currentUser.getIdToken(true);
            const reviewVtuberCard = httpsCallable(functionsInstance, "reviewVtuberCard");
            const result = await reviewVtuberCard({ uid: id, action: "reject", reason: trimmedReason, authToken });
            const payload = result?.data || {};
            const updates = payload.updates || {
                isVerified: false,
                verificationStatus: "rejected",
                showVerificationModal: "rejected",
                verificationNote: trimmedReason,
                rejectionCount: (targetVtuber.rejectionCount || 0) + 1,
                lastRejectedAt: Date.now(),
                updatedAt: Date.now(),
            };
            setRealVtubers((prev) => {
                const newList = prev.map((v) => v.id === id ? { ...v, ...updates } : v);
                if (typeof syncVtuberCache === "function") {
                    syncVtuberCache(newList);
                }
                return newList;
            });
            showToast(payload.emailWarning ? `✅ 已退回審核；${payload.emailWarning}` : "✅ 已退回審核並送出通知！");
        }
        catch (err) {
            console.error("退回審核失敗:", err);
            const message = err?.message || err?.details || "請確認管理員權限、App Check 與 Functions 是否已部署";
            showToast(`❌ 退回審核失敗：${message}`);
        }
    };
    const handleAdminUpdateVtuber = async (id, updatedData) => {
        try {
            showToast("⏳ 管理員強制更新中，正在處理圖片...");
            // --- A. 圖片上傳至 Storage ---
            const avatarUrl = await uploadImageToStorage(id, updatedData.avatar, "avatar.jpg");
            const bannerUrl = await uploadImageToStorage(id, updatedData.banner, "banner.jpg");
            // --- B. 準備資料 ---
            const tagsArray = typeof updatedData.tags === "string"
                ? updatedData.tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter((t) => t)
                : Array.isArray(updatedData.tags)
                    ? updatedData.tags
                    : [];
            const publicData = {
                ...updatedData,
                id: id,
                avatar: avatarUrl,
                banner: bannerUrl,
                tags: tagsArray,
                updatedAt: Date.now(),
            };
            // 移除私密資料庫的欄位，避免重複存入公開庫
            delete publicData.contactEmail;
            delete publicData.verificationNote;
            // --- C. 執行寫入資料庫 ---
            await setDoc(doc(db, getPath("vtubers"), id), publicData, {
                merge: true,
            });
            await setDoc(doc(db, getPath("vtubers_private"), id), {
                // 🌟 資安優化：移除 contactEmail
                verificationNote: updatedData.verificationNote || "",
                publicEmail: updatedData.publicEmail || "",
                publicEmailVerified: updatedData.publicEmailVerified || false,
                updatedAt: Date.now(),
            }, { merge: true });
            // --- D. 更新本地狀態與快取 ---
            setRealVtubers((prev) => {
                const updatedList = prev.map((v) => v.id === id ? { ...v, ...publicData } : v);
                syncVtuberCache(updatedList);
                return updatedList;
            });
            showToast("✅ 管理員強制更新成功，快取已同步！");
        }
        catch (err) {
            console.error("管理員更新失敗:", err);
            showToast("❌ 更新失敗");
        }
    };
    const handleDeleteVtuber = async (id) => {
        if (!confirm("確定要刪除這張名片嗎？(此動作無法復原)"))
            return;
        try {
            await deleteDoc(doc(db, getPath("vtubers"), id));
            await deleteDoc(doc(db, getPath("vtubers_private"), id));
            setRealVtubers((prev) => {
                const newList = prev.filter((v) => v.id !== id);
                syncVtuberCache(newList); // ✅ 同步快取，防止幽靈復活
                return newList;
            });
            showToast("已刪除名片");
        }
        catch (err) {
            showToast("刪除失敗");
        }
    };
    const handleDeleteBulletin = async (id) => {
        if (!confirm("確定要刪除這則招募文嗎？"))
            return;
        try {
            await deleteDoc(doc(db, getPath("bulletins"), id));
            setRealBulletins((prev) => {
                const newList = prev.filter((b) => b.id !== id);
                syncBulletinCache(newList); // ✅ 同步快取，刪除後即時消失
                return newList;
            });
            showToast("已刪除招募文");
        }
        catch (err) {
            showToast("刪除失敗");
        }
    };
    // 找到 handleAddCollab 並修改
    const handleAddCollab = async (collabData) => {
        try {
            const docRef = await addDoc(collection(db, getPath("collabs")), {
                ...collabData,
                userId: user?.uid || "admin",
                reminderSent: false,
                createdAt: Date.now(),
            });
            const newItem = {
                id: docRef.id,
                ...collabData,
                userId: user?.uid || "admin",
                reminderSent: false,
                createdAt: Date.now(),
            };
            setRealCollabs((prev) => {
                const newList = [...prev, newItem];
                syncCollabCache(newList); // ✨ 關鍵：同步更新快取
                return newList;
            });
            showToast("✅ 已發布聯動行程");
        }
        catch (err) {
            console.error(err);
            showToast("❌ 新增失敗");
        }
    };
    const handleAdminCleanBulletins = async () => {
        if (!confirm("確定要結算並清理所有過期的招募文嗎？\n(達標的招募將轉換為積分，並刪除過期資料以節省讀取費)"))
            return;
        setIsSyncingSubs(true);
        setSyncProgress("正在結算與清理中...");
        try {
            const now = Date.now();
            // 這裡必須抓取「全部」招募文來找出過期的
            const snap = await getDocs(collection(db, getPath('bulletins')));
            let successCount = 0;
            let deleteCount = 0;
            for (const docSnap of snap.docs) {
                const b = { id: docSnap.id, ...docSnap.data() };
                // 判斷是否過期
                if (b.recruitEndTime && b.recruitEndTime < now) {
                    let targetSize = parseInt(String(b.collabSize || "0").replace(/[^0-9]/g, ""), 10) || 0;
                    const applicantsCount = Array.isArray(b.applicants) ? b.applicants.length : 0;
                    // 判斷是否達標 (成功)
                    if (targetSize > 0 && applicantsCount >= targetSize) {
                        // 幫發起人的名片加上 1 點成功積分
                        await updateDoc(doc(db, getPath("vtubers"), b.userId), {
                            successCount: increment(1)
                        });
                        successCount++;
                    }
                    // 無論成功或失敗，過期了就從資料庫刪除，節省空間
                    await deleteDoc(docSnap.ref);
                    deleteCount++;
                }
            }
            // 如果有成功的聯動，更新全站的總成功次數
            if (successCount > 0) {
                await updateDoc(doc(db, getPath("settings"), "stats"), {
                    totalCompletedCollabs: increment(successCount)
                });
            }
            showToast(`✅ 清理完畢！共刪除 ${deleteCount} 筆過期招募，其中 ${successCount} 筆達成目標並已轉換為積分。`);
            // 重新整理網頁以更新所有快取
            setTimeout(() => window.location.reload(), 2000);
        }
        catch (e) {
            console.error(e);
            showToast("❌ 清理失敗，請看 Console");
        }
        finally {
            setIsSyncingSubs(false);
            setSyncProgress("");
        }
    };
    const handleDeleteCollab = async (id) => {
        if (!confirm("確定要刪除這個聯動行程嗎？"))
            return;
        try {
            await deleteDoc(doc(db, getPath("collabs"), id));
            setRealCollabs((prev) => {
                const newList = prev.filter((c) => c.id !== id);
                syncCollabCache(newList); // ✅ 同步快取
                return newList;
            });
            showToast("已刪除聯動行程");
        }
        catch (err) {
            showToast("刪除失敗");
        }
    };
    const handleSaveSettings = async (tipsContent, rulesContent) => {
        try {
            if (tipsContent !== undefined) {
                await setDoc(doc(db, getPath("settings"), "tips"), { content: tipsContent }, { merge: true });
                setRealTips(tipsContent);
            }
            if (rulesContent !== undefined) {
                await setDoc(doc(db, getPath("settings"), "rules"), { content: rulesContent }, { merge: true });
                setRealRules(rulesContent);
            }
            const nextSettingsCache = {
                tips: tipsContent !== undefined ? tipsContent : realTips,
                rules: rulesContent !== undefined ? rulesContent : realRules,
                bulletinImages: defaultBulletinImages,
            };
            writeLocalCache(SETTINGS_CACHE_KEY, nextSettingsCache);
            markCacheTimestamp(SETTINGS_CACHE_TS);
            showToast("系統設定已更新！");
        }
        catch (err) {
            showToast("更新失敗");
        }
    };
    const handleAdminResetAllCollabTypes = async () => {
        if (!confirm("⚠️ 確定要清除所有人的聯動類型嗎？"))
            return;
        try {
            if (prompt("請輸入 'CONFIRM'") !== "CONFIRM")
                return showToast("已取消操作。");
            for (const v of realVtubers) {
                if (!v.id.startsWith("mock")) {
                    await setDoc(doc(db, getPath("vtubers"), v.id), { collabTypes: [] }, { merge: true });
                }
            }
            setRealVtubers((prev) => prev.map((v) => ({ ...v, collabTypes: [] })));
            showToast("✅ 已清除所有人聯動類型！");
        }
        catch (err) {
            showToast("清除失敗");
        }
    };
    const handleAdminMassUpdateVerification = async () => {
        if (!confirm("⚠️ 確定要將所有名片的真人驗證內容一鍵更改為 'X' 嗎？\n此動作將覆蓋所有現有的驗證備註！"))
            return;
        const confirmText = prompt("請輸入 'X-CONFIRM' 以確認執行此大規模操作：");
        if (confirmText !== "X-CONFIRM")
            return showToast("操作已取消");
        setIsSyncingSubs(true); // 借用同步狀態來顯示 Loading
        setSyncProgress("正在更新驗證內容...");
        try {
            let count = 0;
            // 遍歷所有 VTuber
            for (const v of realVtubers) {
                if (!v.id.startsWith("mock")) {
                    // 更新私密資料庫中的 verificationNote
                    await setDoc(doc(db, getPath("vtubers_private"), v.id), {
                        verificationNote: "X",
                        updatedAt: Date.now(),
                    }, { merge: true });
                    count++;
                }
            }
            showToast(`✅ 已成功將 ${count} 筆名片的驗證內容更改為 'X'！`);
            // 更新本地的 privateDocs 狀態，讓管理員介面即時顯示
            const newPrivateDocs = { ...privateDocs };
            Object.keys(newPrivateDocs).forEach((id) => {
                newPrivateDocs[id] = { ...newPrivateDocs[id], verificationNote: "X" };
            });
            setPrivateDocs(newPrivateDocs);
        }
        catch (err) {
            console.error(err);
            showToast("❌ 更新失敗，請檢查權限或網路");
        }
        finally {
            setIsSyncingSubs(false);
            setSyncProgress("");
        }
    };
    // --- 聯動提醒功能測試函式 ---
    const handleTestReminderSystem = async () => {
        if (!user)
            return showToast("請先登入！");
        showToast("⏳ 正在建立測試聯動資料...");
        try {
            const testData = {
                title: "🔔 提醒系統測試信件",
                date: "測試日期",
                time: "測試時間",
                streamUrl: "https://www.vnexus2026.com",
                userId: user.uid,
                participants: [],
                // 設定為 1 小時後開始，確保落在 24 小時的偵測範圍內
                startTimestamp: Date.now() + 1 * 60 * 60 * 1000,
                reminderSent: false,
                category: "系統測試",
                createdAt: Date.now(),
            };
            const docRef = await addDoc(collection(db, getPath("collabs")), testData);
            // 手動更新本地狀態，讓 useEffect 偵測到變化並執行寄信邏輯
            setRealCollabs((prev) => [...prev, { id: docRef.id, ...testData }]);
            showToast("✅ 測試資料已建立！系統將在幾秒內自動偵測並寄信至您的信箱。");
        }
        catch (err) {
            showToast("❌ 測試失敗：" + err.message);
        }
    };
    const handleAdminResetNatAndLang = async () => {
        if (!confirm("⚠️ 確定要自動修復所有「國籍與語言格式錯誤」的名片嗎？"))
            return;
        try {
            let fixedCount = 0;
            for (const v of realVtubers) {
                if (!v.id.startsWith("mock")) {
                    const isNatInvalid = v.nationalities !== undefined && !Array.isArray(v.nationalities);
                    const isLangInvalid = v.languages !== undefined && !Array.isArray(v.languages);
                    const hasOldNat = typeof v.nationality === "string" && v.nationality;
                    const hasOldLang = typeof v.language === "string" && v.language;
                    if (isNatInvalid || isLangInvalid || hasOldNat || hasOldLang) {
                        let newNats = [];
                        if (Array.isArray(v.nationalities))
                            newNats = v.nationalities;
                        else if (typeof v.nationalities === "string" && v.nationalities)
                            newNats = [v.nationalities];
                        else if (typeof v.nationality === "string" && v.nationality)
                            newNats = [v.nationality];
                        let newLangs = [];
                        if (Array.isArray(v.languages))
                            newLangs = v.languages;
                        else if (typeof v.languages === "string" && v.languages)
                            newLangs = [v.languages];
                        else if (typeof v.language === "string" && v.language)
                            newLangs = [v.language];
                        await setDoc(doc(db, getPath("vtubers"), v.id), {
                            nationalities: newNats,
                            languages: newLangs,
                            nationality: "",
                            language: "",
                        }, { merge: true });
                        fixedCount++;
                    }
                }
            }
            if (fixedCount > 0) {
                showToast(`✅ 已成功修復 ${fixedCount} 筆格式錯誤的名片！重新載入中...`);
                setTimeout(() => window.location.reload(), 1500);
            }
            else {
                showToast(`✅ 檢查完畢，目前沒有格式錯誤的資料。`);
            }
        }
        catch (err) {
            console.error(err);
            showToast("修復失敗");
        }
    };
    const handleMassSyncSubs = async () => {
        if (!confirm("確定要背景同步所有名片的 YouTube 粉絲數嗎？\n(將自動抓取超過24小時未更新，或「格式異常/無法讀取」的名片)"))
            return;
        setIsSyncingSubs(true);
        let successCount = 0;
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        const now = Date.now();
        const targets = realVtubers.filter((v) => {
            const hasYt = v.youtubeUrl || v.channelUrl;
            if (!hasYt)
                return false;
            const ytExpired = hasYt && now - (v.lastYoutubeFetchTime || 0) > TWENTY_FOUR_HOURS;
            const ytInvalid = hasYt &&
                v.youtubeSubscribers &&
                isNaN(parseFloat(String(v.youtubeSubscribers).replace(/,/g, "")));
            return ytExpired || ytInvalid;
        });
        for (const v of realVtubers) {
            if (!v.id.startsWith("mock")) {
                let updates = {};
                if (!(v.youtubeUrl || v.channelUrl) &&
                    v.youtubeSubscribers &&
                    isNaN(parseFloat(String(v.youtubeSubscribers).replace(/,/g, ""))))
                    updates.youtubeSubscribers = "";
                if (Object.keys(updates).length > 0) {
                    await updateDoc(doc(db, getPath("vtubers"), v.id), updates);
                    setRealVtubers((prev) => prev.map((rv) => (rv.id === v.id ? { ...rv, ...updates } : rv)));
                }
            }
        }
        if (targets.length === 0) {
            showToast("✅ 所有名片的 YouTube 粉絲數皆為最新狀態，無異常資料！");
            setIsSyncingSubs(false);
            return;
        }
        for (let i = 0; i < targets.length; i++) {
            const v = targets[i];
            setSyncProgress(`正在同步YT ${i + 1} / ${targets.length} : ${v.name}`);
            let updates = {};
            const ytUrl = v.youtubeUrl || v.channelUrl;
            if (ytUrl &&
                (now - (v.lastYoutubeFetchTime || 0) > TWENTY_FOUR_HOURS ||
                    isNaN(parseFloat(String(v.youtubeSubscribers).replace(/,/g, ""))))) {
                try {
                    const res = await httpsCallable(functionsInstance, "fetchYouTubeStats")({ url: ytUrl });
                    if (res.data && res.data.success) {
                        const count = res.data.subscriberCount;
                        let fmt = count.toString();
                        if (count >= 10000)
                            fmt = (count / 10000).toFixed(1).replace(".0", "") + "萬";
                        else if (count >= 1000)
                            fmt = (count / 1000).toFixed(1).replace(".0", "") + "K";
                        updates.youtubeSubscribers = fmt;
                    }
                    updates.lastYoutubeFetchTime = Date.now();
                }
                catch (e) { }
            }
            if (Object.keys(updates).length > 0) {
                await updateDoc(doc(db, getPath("vtubers"), v.id), updates);
                setRealVtubers((prev) => prev.map((rv) => (rv.id === v.id ? { ...rv, ...updates } : rv)));
                successCount++;
            }
            await new Promise((r) => setTimeout(r, 1500));
        }
        setSyncProgress("");
        setIsSyncingSubs(false);
        showToast(`✅ YT 同步完成！成功更新/修復 ${successCount} 筆資料。`);
    };
    const handleMigrateBulletinImages = async () => {
        if (!confirm("確定要將「佈告欄」的 Base64 圖片全部轉移到 Storage 嗎？\n這可能會花一點時間喔！"))
            return;
        try {
            // 抓取所有佈告欄資料
            const bulletinsSnapshot = await getDocs(collection(db, getPath('bulletins')));
            let successCount = 0;
            for (const docSnap of bulletinsSnapshot.docs) {
                const data = docSnap.data();
                // 檢查圖片欄位 (假設你的佈告欄圖片欄位叫做 coverImage，如果是 image 請自行更改)
                // 並確認它是不是以 "data:image" 開頭 (代表它是肥大的 Base64 字串)
                if (data.coverImage && data.coverImage.startsWith('data:image')) {
                    console.log(`正在轉換企劃：${data.title || docSnap.id} ...`);
                    // 1. 在 Storage 建立專屬路徑 (放進 bulletin_covers 資料夾)
                    const imageRef = ref(storage, `bulletin_covers/${user.uid}/${docSnap.id}_${Date.now()}.jpg`);
                    // 2. 將 Base64 字串上傳到 Storage ('data_url' 格式)
                    await uploadString(imageRef, data.coverImage, 'data_url');
                    // 3. 取得上傳後的真實圖片網址 (https://...)
                    const downloadURL = await getDownloadURL(imageRef);
                    // 4. 更新 Firestore，把原本的 Base64 替換成短短的網址
                    await updateDoc(doc(db, getPath('bulletins'), docSnap.id), {
                        coverImage: downloadURL
                    });
                    successCount++;
                }
            }
            alert(`🎉 轉換完成！成功把 ${successCount} 個佈告欄企劃的圖片瘦身完畢囉！`);
        }
        catch (error) {
            console.error("轉換佈告欄圖片失敗：", error);
            alert("發生錯誤，請按 F12 去 Console 看一下詳細狀況。");
        }
    };
    const handleMassSyncTwitch = async () => {
        if (!confirm("確定要背景同步所有名片的 Twitch 追隨數嗎？\n(將自動抓取超過6小時未更新，或「格式異常/無法讀取」的名片)"))
            return;
        setIsSyncingSubs(true);
        let successCount = 0;
        const SIX_HOURS = 24 * 60 * 60 * 1000;
        const now = Date.now();
        const targets = realVtubers.filter((v) => {
            const hasTw = v.twitchUrl;
            if (!hasTw)
                return false;
            const isOwnAdminCard = isAdmin && v.id === user?.uid;
            const twExpired = hasTw &&
                (now - (v.lastTwitchFetchTime || 0) > SIX_HOURS || isOwnAdminCard);
            const twInvalid = hasTw &&
                v.twitchFollowers &&
                isNaN(parseFloat(String(v.twitchFollowers).replace(/,/g, "")));
            return twExpired || twInvalid;
        });
        for (const v of realVtubers) {
            if (!v.id.startsWith("mock")) {
                if (!v.twitchUrl &&
                    v.twitchFollowers &&
                    isNaN(parseFloat(String(v.twitchFollowers).replace(/,/g, "")))) {
                    await updateDoc(doc(db, getPath("vtubers"), v.id), {
                        twitchFollowers: "",
                    });
                    setRealVtubers((prev) => prev.map((rv) => rv.id === v.id ? { ...rv, twitchFollowers: "" } : rv));
                }
            }
        }
        if (targets.length === 0) {
            showToast("✅ 所有名片的 Twitch 追隨數皆為最新狀態，無異常資料！");
            setIsSyncingSubs(false);
            return;
        }
        for (let i = 0; i < targets.length; i++) {
            const v = targets[i];
            setSyncProgress(`正在同步Twitch ${i + 1} / ${targets.length} : ${v.name}`);
            const twUrl = v.twitchUrl;
            const isOwnAdminCard = isAdmin && v.id === user?.uid;
            if (twUrl &&
                (now - (v.lastTwitchFetchTime || 0) > SIX_HOURS ||
                    isNaN(parseFloat(String(v.twitchFollowers).replace(/,/g, ""))) ||
                    isOwnAdminCard)) {
                try {
                    const res = await httpsCallable(functionsInstance, "fetchTwitchStats")({ url: twUrl });
                    const fetchTime = Date.now();
                    let updates = { lastTwitchFetchTime: fetchTime };
                    if (res.data && res.data.success) {
                        const count = res.data.followerCount;
                        let fmt = count.toString();
                        if (count >= 10000)
                            fmt = (count / 10000).toFixed(1).replace(".0", "") + "萬";
                        else if (count >= 1000)
                            fmt = (count / 1000).toFixed(1).replace(".0", "") + "K";
                        updates.twitchFollowers = fmt;
                    }
                    await updateDoc(doc(db, getPath("vtubers"), v.id), updates);
                    setRealVtubers((prev) => prev.map((rv) => (rv.id === v.id ? { ...rv, ...updates } : rv)));
                    successCount++;
                }
                catch (e) { }
            }
            await new Promise((r) => setTimeout(r, 1500));
        }
        setSyncProgress("");
        setIsSyncingSubs(false);
        showToast(`✅ Twitch 同步完成！成功更新/修復 ${successCount} 筆資料。`);
    };
    const handleAddUpdate = async (updateData) => {
        try {
            const docRef = await addDoc(collection(db, getPath("updates")), {
                ...updateData,
                createdAt: Date.now(),
            });
            setRealUpdates((prev) => [
                { id: docRef.id, ...updateData, createdAt: Date.now() },
                ...prev,
            ]);
            showToast("✅ 已發佈最新消息");
        }
        catch (err) {
            showToast("發佈失敗");
        }
    };
    const handleDeleteUpdate = async (id) => {
        if (!confirm("確定要刪除這則公告嗎？"))
            return;
        try {
            await deleteDoc(doc(db, getPath("updates"), id));
            setRealUpdates((prev) => prev.filter((u) => u.id !== id));
            showToast("✅ 已刪除公告");
        }
        catch (err) {
            showToast("刪除失敗");
        }
    };
    const handleSendMassEmail = async (subject, content) => {
        if (!subject?.trim() || !content?.trim()) {
            return showToast("❌ 請輸入主旨與內容");
        }
        setMassEmailSending(true);
        setMassEmailCurrent(0);
        setMassEmailTotal(1);
        setMassEmailLog("正在交給後端批次寄送...");
        try {
            const fn = httpsCallable(functionsInstance, "sendMassEmail");
            const authToken = auth.currentUser ? await auth.currentUser.getIdToken(true) : "";
            const res = await fn({
                authToken,
                subject: subject.trim(),
                text: content.trim(),
                testOnly: false,
            });
            if (res.data?.success) {
                showToast(`✅ ${res.data.message || "全站通知信已送出"}`);
            }
            else {
                showToast(`❌ 發送失敗：${res.data?.message || "未知錯誤"}`);
            }
        }
        catch (err) {
            console.error("sendMassEmail error:", err);
            showToast(`❌ 呼叫後端失敗：${err.message}`);
        }
        finally {
            setMassEmailSending(false);
            setMassEmailLog("");
            setMassEmailCurrent(0);
            setMassEmailTotal(0);
        }
    };
    const [massEmailSending, setMassEmailSending] = useState(false);
    const [massEmailCurrent, setMassEmailCurrent] = useState(0);
    const [massEmailTotal, setMassEmailTotal] = useState(0);
    const [massEmailLog, setMassEmailLog] = useState("");
    const contextValue = useMemo(() => {
        return { user, isVerifiedUser, isAdmin, showToast, realVtubers, onlineUsers };
    }, [user, isVerifiedUser, isAdmin, showToast, realVtubers, onlineUsers]);
    return (React.createElement(AppContext.Provider, { value: contextValue },
        React.createElement("div", { className: "flex flex-col min-h-screen relative" },
            toastMsg && (React.createElement("div", { className: "fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#181B25] border border-[#8B5CF6] text-white px-6 py-3 rounded-full shadow-sm flex items-center gap-3 font-bold text-sm" },
                React.createElement("i", { className: "fa-solid fa-circle-info text-[#A78BFA]" }),
                " ",
                toastMsg)),
            React.createElement("nav", { className: "sticky top-0 z-40 backdrop-blur-md bg-[#0F111A]/95 border-b border-[#2A2F3D] shadow-md" },
                React.createElement("div", { className: "max-w-7xl mx-auto px-4 sm:px-6" },
                    React.createElement("div", { className: "h-16 flex items-center justify-between" },
                        React.createElement("div", { className: "flex items-center gap-2 cursor-pointer group", onClick: () => navigate("home") },
                            React.createElement("div", { className: "bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-lg group-hover:shadow-sm transition-all" },
                                React.createElement("i", { className: "fa-solid fa-wand-magic-sparkles text-white" })),
                            React.createElement("span", { className: "text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400" }, "V-Nexus")),
                        React.createElement("div", { className: "flex items-center gap-3" },
                            !user ? (React.createElement("div", { className: "flex items-center gap-2" },
                                React.createElement("button", { onClick: handleLogin, className: "flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-200 px-4 py-1.5 rounded-full transition-colors font-bold text-sm" },
                                    React.createElement("i", { className: "fa-brands fa-google text-[#EF4444]" }),
                                    " Google \u767B\u5165"),
                                React.createElement("button", { onClick: handleLoginOther, className: "hidden sm:block text-[#94A3B8] hover:text-white text-xs font-bold transition-colors", title: "\u4F7F\u7528\u5176\u4ED6 Google \u5E33\u865F" },
                                    React.createElement("i", { className: "fa-solid fa-user-gear mr-1" }),
                                    " \u5207\u63DB\u5E33\u865F"))) : (React.createElement("div", { className: "flex items-center gap-3" },
                                React.createElement("div", { className: "relative", ref: notifRef },
                                    React.createElement("button", { onClick: () => setIsNotifOpen(!isNotifOpen), className: "text-[#CBD5E1] hover:text-white p-2 text-xl relative transition-colors" },
                                        React.createElement("i", { className: "fa-solid fa-bell" }),
                                        unreadCount > 0 && (React.createElement("span", { className: "absolute top-1 right-1 flex h-3 w-3" },
                                            React.createElement("span", { className: "animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" }),
                                            React.createElement("span", { className: "relative inline-flex rounded-full h-3 w-3 bg-[#EF4444] text-[8px] text-white flex items-center justify-center" }, unreadCount)))),
                                    isNotifOpen && (
                                    // 🌟 完美置中修復：改用 left-0 right-0 mx-auto，徹底避免與 animate-fade-in-up 的 transform 動畫衝突！
                                    React.createElement("div", { className: "fixed left-0 right-0 mx-auto top-16 mt-2 w-[90vw] sm:absolute sm:left-auto sm:right-0 sm:mx-0 sm:w-80 bg-[#0F111A] border border-[#2A2F3D] rounded-2xl shadow-sm z-50 overflow-hidden animate-fade-in-up" },
                                        React.createElement("div", { className: "p-3 border-b border-[#2A2F3D] flex justify-between items-center bg-[#181B25]/50" },
                                            React.createElement("span", { className: "font-bold text-white text-sm" }, "\u7AD9\u5167\u5C0F\u9234\u943A"),
                                            unreadCount > 0 && (React.createElement("button", { onClick: markAllAsRead, className: "text-xs text-[#A78BFA] hover:text-[#C4B5FD]" }, "\u5168\u90E8\u5DF2\u8B80"))),
                                        React.createElement("div", { className: "max-h-80 overflow-y-auto" }, myNotifications.length === 0 ? (React.createElement("div", { className: "p-6 text-center text-[#94A3B8] text-sm" },
                                            React.createElement("p", { className: "text-[#F8FAFC] font-bold mb-1" }, "\u76EE\u524D\u6C92\u6709\u65B0\u7684\u901A\u77E5"),
                                            React.createElement("p", null, "\u6709\u9080\u8ACB\u3001\u79C1\u8A0A\u6216\u5BE9\u6838\u7D50\u679C\u6642\uFF0C\u6703\u51FA\u73FE\u5728\u9019\u88E1\u3002"))) : (myNotifications.slice(0, 5).map((n) => (React.createElement("div", { key: n.id, onClick: () => handleNotifClick(n), className: `p-3 border-b border-[#2A2F3D] flex gap-3 hover:bg-[#181B25]/50 cursor-pointer transition-colors ${!n.read ? "bg-purple-900/10" : ""}` },
                                            React.createElement("img", { src: sanitizeUrl(n.fromUserAvatar ||
                                                    "https://api.dicebear.com/7.x/avataaars/svg?seed=Anon"), className: "w-10 h-10 rounded-full bg-[#181B25] object-cover flex-shrink-0" }),
                                            React.createElement("div", { className: "flex-1 min-w-0" },
                                                React.createElement("p", { className: "text-xs text-[#CBD5E1] leading-snug" },
                                                    React.createElement("span", { className: "font-bold text-white hover:text-[#A78BFA] transition-colors" }, n.fromUserName),
                                                    " ",
                                                    n.message),
                                                n.type === "brave_invite" && !n.handled && (React.createElement("div", { className: "flex gap-2 mt-2" },
                                                    React.createElement("button", { onClick: (e) => {
                                                            e.stopPropagation();
                                                            handleBraveInviteResponse(n.id, n.fromUserId, true);
                                                        }, className: "flex-1 bg-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E] hover:text-white text-[10px] font-bold py-1 rounded border border-green-600/30 transition-colors" }, "\u53EF\u4EE5\u8A66\u8A66"),
                                                    React.createElement("button", { onClick: (e) => {
                                                            e.stopPropagation();
                                                            handleBraveInviteResponse(n.id, n.fromUserId, false);
                                                        }, className: "flex-1 bg-[#1D2130]/50 text-[#94A3B8] hover:bg-[#2A2F3D] hover:text-white text-[10px] font-bold py-1 rounded border border-[#2A2F3D]/50 transition-colors" }, "\u59D4\u5A49\u62D2\u7D55"))),
                                                React.createElement("p", { className: "text-[10px] text-[#64748B] mt-1" }, formatTime(n.createdAt))),
                                            !n.read && (React.createElement("div", { className: "w-2 h-2 rounded-full bg-[#EF4444] mt-1.5 flex-shrink-0" }))))))),
                                        React.createElement("div", { className: "p-2 border-t border-[#2A2F3D] bg-[#181B25]/80 text-center" },
                                            React.createElement("button", { onClick: () => {
                                                    setIsNotifOpen(false);
                                                    navigate("inbox");
                                                }, className: "text-xs text-[#A78BFA] font-bold hover:text-[#C4B5FD] w-full py-1" },
                                                "\u6253\u958B\u6211\u7684\u4FE1\u7BB1\u67E5\u770B\u5B8C\u6574\u901A\u77E5",
                                                " ",
                                                React.createElement("i", { className: "fa-solid fa-arrow-right ml-1" })))))),
                                React.createElement("button", { onClick: () => navigate("dashboard"), className: "flex items-center gap-2 bg-[#181B25] hover:bg-[#1D2130] border border-[#2A2F3D] px-3 py-1.5 rounded-full transition-colors relative whitespace-nowrap" },
                                    React.createElement("img", { src: sanitizeUrl(user.photoURL ||
                                            "https://api.dicebear.com/7.x/avataaars/svg?seed=Anon"), className: "w-5 h-5 rounded-full" }),
                                    React.createElement("span", { className: "text-[#CBD5E1] text-xs font-bold truncate max-w-[80px] hidden sm:block" }, user.displayName || "創作者"),
                                    realVtubers.find((v) => v.id === user.uid && !v.isVerified) && (React.createElement("span", { className: "absolute -top-1 -right-1 flex h-3 w-3" },
                                        React.createElement("span", { className: "animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" }),
                                        React.createElement("span", { className: "relative inline-flex rounded-full h-3 w-3 bg-[#EF4444]" })))),
                                React.createElement("button", { onClick: handleLogout, className: "text-[#64748B] hover:text-[#EF4444] text-xs font-bold whitespace-nowrap", title: "\u767B\u51FA" },
                                    React.createElement("i", { className: "fa-solid fa-right-from-bracket" })))),
                            isAdmin && (React.createElement("button", { onClick: () => navigate('admin'), className: `transition-colors px-3 py-1.5 font-bold text-sm whitespace-nowrap flex items-center ${currentView === 'admin' ? 'text-[#EF4444] border-b-2 border-[#DC2626]' : 'text-[#EF4444]/70 hover:text-[#EF4444]'}` },
                                React.createElement("i", { className: "fa-solid fa-shield-halved mr-1" }),
                                " \u7BA1\u7406\u54E1",
                                (pendingVtubersCount > 0 || realArticles.filter(a => a.status === 'pending').length > 0) && (React.createElement("span", { className: "bg-[#EF4444] text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1" }, pendingVtubersCount + realArticles.filter(a => a.status === 'pending').length)))),
                            React.createElement("button", { onClick: () => setIsMobileMenuOpen(!isMobileMenuOpen), className: "lg:hidden text-[#CBD5E1] p-2 text-2xl ml-1" },
                                React.createElement("i", { className: `fa-solid ${isMobileMenuOpen ? "fa-xmark" : "fa-bars"}` })))),
                    React.createElement("div", { className: "hidden lg:flex items-center justify-center gap-4 pb-4 overflow-x-auto whitespace-nowrap scrollbar-hide" },
                        React.createElement("button", { onClick: () => navigate("home"), className: `transition-colors px-3 py-1.5 font-bold text-sm whitespace-nowrap ${currentView === "home" ? "text-[#A78BFA] border-b-2 border-[#8B5CF6]" : "text-[#94A3B8] hover:text-white"}` }, "\u9996\u9801\u4ECB\u7D39"),
                        React.createElement("button", { onClick: () => navigate("grid"), className: `flex items-center gap-1.5 px-5 py-2 rounded-full font-bold transition-all text-sm whitespace-nowrap animate-glow-pulse ${currentView === "grid" || currentView === "profile"
                                ? "bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white shadow-sm scale-105 border border-white/30"
                                : "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm hover:shadow-sm"}` },
                            React.createElement("i", { className: "fa-solid fa-magnifying-glass" }),
                            " \u5C0B\u627E VTuber \u5925\u4F34"),
                        React.createElement("button", { onClick: () => navigate("status_wall"), className: `flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold transition-colors text-sm whitespace-nowrap ${currentView === "status_wall" ? "bg-[#F59E0B] text-[#0F111A] shadow-sm" : "bg-[#F59E0B] text-[#0F111A] hover:bg-[#F59E0B] shadow-md border border-[#F59E0B]/50"}` },
                            React.createElement("i", { className: "fa-solid fa-bolt" }),
                            " 24H\u52D5\u614B\u7246"),
                        React.createElement("button", { onClick: () => navigate("bulletin"), className: `flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm whitespace-nowrap ${currentView === "bulletin" ? "bg-rose-500 text-white shadow-sm" : "bg-rose-600 text-white hover:bg-rose-500 shadow-md border border-rose-500/50"}` },
                            React.createElement("i", { className: "fa-solid fa-bullhorn" }),
                            " \u63EA\u5718\u4F48\u544A\u6B04",
                            !isVerifiedUser && React.createElement("span", { className: "text-[10px] ml-1 opacity-70" }, "(\u9700\u8A8D\u8B49)")),
                        user && (React.createElement("button", { onClick: () => navigate("commissions"), className: `flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm whitespace-nowrap ${currentView === "commissions" ? "bg-[#38BDF8] text-[#0F111A] shadow-sm scale-105" : "bg-[#38BDF8] text-[#0F111A] hover:bg-[#7DD3FC] shadow-md border border-[#38BDF8]/50"}` },
                            React.createElement("i", { className: "fa-solid fa-palette" }),
                            " \u7E6A\u5E2B/\u5EFA\u6A21\u5E2B/\u526A\u8F2F\u5E2B\u59D4\u8A17\u5C08\u5340")),
                        React.createElement("button", { onClick: () => navigate("commission-board"), className: `flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm whitespace-nowrap ${currentView === "commission-board" ? "bg-[#8B5CF6] text-white shadow-sm scale-105" : "bg-[#8B5CF6] text-white hover:bg-[#7C3AED] shadow-md border border-[#8B5CF6]/50"}` },
                            React.createElement("i", { className: "fa-solid fa-clipboard-list" }),
                            " \u59D4\u8A17\u4F48\u544A\u6B04"),
                        React.createElement("button", { onClick: () => { if (!isVerifiedUser) {
                                showToast("請先認證名片解鎖此功能");
                                navigate('dashboard');
                            }
                            else
                                navigate('articles'); }, className: `transition-colors px-3 py-1.5 font-bold text-sm whitespace-nowrap ${currentView === 'articles' ? 'text-[#38BDF8] border-b-2 border-[#38BDF8]' : 'text-[#38BDF8]/70 hover:text-[#38BDF8]'}` },
                            React.createElement("i", { className: "fa-solid fa-book-open mr-1" }),
                            " Vtuber\u5BF6\u5178",
                            !isVerifiedUser && ' 🔒'))),
                isMobileMenuOpen && (React.createElement("div", { className: "lg:hidden absolute top-16 left-0 w-full bg-[#0F111A]/95 backdrop-blur-md border-b border-[#2A2F3D] shadow-md flex flex-col p-4 gap-4 z-50 animate-fade-in-up" },
                    React.createElement("button", { onClick: () => navigate("home"), className: `text-left px-4 py-3 rounded-xl font-bold ${currentView === "home" ? "bg-[#8B5CF6] text-white" : "text-[#CBD5E1] hover:bg-[#181B25]"}` }, "\u9996\u9801\u4ECB\u7D39"),
                    React.createElement("button", { onClick: () => navigate("grid"), className: `text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all ${currentView === "grid" || currentView === "profile"
                            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm"
                            : "bg-gradient-to-r from-purple-600/90 to-pink-600/90 text-white shadow-sm"}` },
                        React.createElement("i", { className: "fa-solid fa-magnifying-glass w-5" }),
                        " \u5C0B\u627E VTuber \u5925\u4F34"),
                    React.createElement("button", { onClick: () => navigate("status_wall"), className: `text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === "status_wall" ? "bg-[#F59E0B] text-[#0F111A] shadow-sm" : "bg-[#F59E0B] text-[#0F111A] hover:bg-[#F59E0B]"}` },
                        React.createElement("i", { className: "fa-solid fa-bolt w-5" }),
                        " 24H\u52D5\u614B\u7246"),
                    React.createElement("button", { onClick: () => {
                            if (!isVerifiedUser) {
                                showToast("請先認證名片解鎖");
                                navigate("dashboard");
                            }
                            else
                                navigate("bulletin");
                        }, className: `text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === "bulletin" ? "bg-rose-500 text-white shadow-sm" : "bg-rose-600 text-white hover:bg-rose-500"}` },
                        React.createElement("i", { className: "fa-solid fa-bullhorn w-5" }),
                        " \u63EA\u5718\u4F48\u544A\u6B04"),
                    user && (React.createElement("button", { onClick: () => navigate("commissions"), className: `text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === "commissions" ? "bg-[#38BDF8] text-[#0F111A] shadow-sm" : "bg-[#38BDF8] text-[#0F111A] hover:bg-[#7DD3FC]"}` },
                        React.createElement("i", { className: "fa-solid fa-palette w-5" }),
                        "\u7E6A\u5E2B/\u5EFA\u6A21\u5E2B/\u526A\u8F2F\u5E2B\u59D4\u8A17\u5C08\u5340")),
                    React.createElement("button", { onClick: () => navigate("commission-board"), className: `text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === "commission-board" ? "bg-[#8B5CF6] text-white shadow-sm" : "bg-[#8B5CF6] text-white hover:bg-[#7C3AED]"}` },
                        React.createElement("i", { className: "fa-solid fa-clipboard-list w-5" }),
                        " \u59D4\u8A17\u4F48\u544A\u6B04"),
                    React.createElement("button", { onClick: () => { if (!isVerifiedUser) {
                            showToast("請先認證名片解鎖此功能");
                            navigate('dashboard');
                        }
                        else
                            navigate('articles'); }, className: `text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === 'articles' ? 'bg-blue-900/50 text-[#38BDF8]' : 'text-[#38BDF8]/70 hover:bg-blue-900/30'}` },
                        React.createElement("i", { className: "fa-solid fa-book-open w-5" }),
                        " Vtuber\u5BF6\u5178",
                        !isVerifiedUser && ' 🔒'),
                    isAdmin && (React.createElement("button", { onClick: () => navigate('admin'), className: `text-left px-4 py-3 rounded-xl font-bold text-[#EF4444] hover:bg-[#EF4444]/10 flex items-center justify-between` },
                        React.createElement("div", { className: "flex items-center gap-3" },
                            React.createElement("i", { className: "fa-solid fa-shield-halved w-5" }),
                            " \u7CFB\u7D71\u7BA1\u7406\u54E1"),
                        (pendingVtubersCount > 0 || realArticles.filter(a => a.status === 'pending').length > 0) && (React.createElement("span", { className: "bg-[#EF4444] text-white text-[10px] px-2 py-0.5 rounded-full" }, pendingVtubersCount + realArticles.filter(a => a.status === 'pending').length))))))),
            React.createElement("main", { className: "flex-1 pb-10" },
                currentView === "home" && (React.createElement(HomePage, { navigate: navigate, onOpenRules: () => setIsRulesModalOpen(true), onOpenUpdates: () => setIsUpdatesModalOpen(true), hasUnreadUpdates: hasUnreadUpdates, siteStats: siteStats, realCollabs: realCollabs, displayCollabs: displayCollabs, currentTime: currentTime, 
                    // 這裡改為檢查 realBulletins 是否有資料，來決定統計數字是否顯示轉圈圈
                    isLoadingCollabs: realBulletins.length === 0, goToBulletin: goToBulletin, 
                    // 這裡直接傳長度，讓 AnimatedCounter 自己處理 0 到 X 的動畫
                    registeredCount: realVtubers.length, realVtubers: realVtubers, setSelectedVTuber: setSelectedVTuber, realBulletins: realBulletins, onShowParticipants: (collab) => setViewParticipantsCollab(collab), user: user, isVerifiedUser: isVerifiedUser, onApply: (id, isApplying) => handleApplyBulletin(id, isApplying, realBulletins.find((b) => b.id === id)?.userId), onNavigateProfile: (vt) => {
                        setSelectedVTuber(vt);
                        navigate(`profile/${vt.id}`);
                    }, onOpenStoryComposer: () => setIsStoryComposerOpen(true) })),
                currentView === "inbox" && user && (React.createElement(InboxPage, { notifications: myNotifications, markAllAsRead: markAllAsRead, onMarkRead: handleMarkNotifRead, onDelete: handleDeleteNotif, onDeleteAll: handleDeleteAllNotifs, onNavigateProfile: handleNotifProfileNav, onBraveResponse: handleBraveInviteResponse, onOpenChat: handleNotifOpenChat })),
                currentView === "commissions" && (React.createElement(CommissionPlanningPage, { mode: "creators", navigate: navigate, realVtubers: realVtubers, onNavigateProfile: (v) => { setSelectedVTuber(v); navigate(`profile/${v.id}`); }, onOpenChat: (v) => {
                        if (!user)
                            return showToast("請先登入！");
                        if (!isVerifiedUser)
                            return showToast("需通過認證才能發送私訊！");
                        setChatTarget(v);
                    } })),
                currentView === "commission-board" && (React.createElement(CommissionPlanningPage, { mode: "board", navigate: navigate, realVtubers: realVtubers, onNavigateProfile: (v) => { setSelectedVTuber(v); navigate(`profile/${v.id}`); }, onOpenChat: (v) => {
                        if (!user)
                            return showToast("請先登入！");
                        if (!isVerifiedUser)
                            return showToast("需通過認證才能發送私訊！");
                        setChatTarget(v);
                    } })),
                currentView === "dashboard" && (React.createElement("div", { className: "max-w-3xl mx-auto px-4 py-10 animate-fade-in-up" },
                    React.createElement("div", { className: "text-center mb-8" },
                        React.createElement("h2", { className: "text-3xl font-extrabold text-white flex items-center justify-center gap-3" },
                            React.createElement("i", { className: "fa-solid fa-user-circle text-[#A78BFA]" }),
                            " ",
                            "\u5275\u4F5C\u8005\u4E2D\u5FC3\uFF1A\u7DE8\u8F2F\u540D\u7247"),
                        user && realVtubers.find((v) => v.id === user.uid) ? (realVtubers.find((v) => v.id === user.uid).isVerified ? (React.createElement("p", { className: "text-[#22C55E] mt-3 text-sm font-bold bg-[#22C55E]/10 inline-block px-4 py-1 rounded-full" },
                            React.createElement("i", { className: "fa-solid fa-circle-check mr-1" }),
                            " ",
                            "\u540D\u7247\u5DF2\u8A8D\u8B49\u4E0A\u7DDA")) : (React.createElement("p", { className: "text-[#F59E0B] mt-3 text-sm font-bold bg-[#F59E0B]/10 inline-block px-4 py-1 rounded-full" },
                            React.createElement("i", { className: "fa-solid fa-user-clock mr-1" }),
                            " ",
                            "\u540D\u7247\u5BE9\u6838\u4E2D\uFF0C\u901A\u904E\u5F8C\u5C07\u81EA\u52D5\u516C\u958B"))) : (React.createElement("p", { className: "text-[#94A3B8] mt-2" }, "\u586B\u5BEB\u5B8C\u6210\u5F8C\u8ACB\u7B49\u5F85\u7BA1\u7406\u54E1\u5BE9\u6838\uFF0C\u78BA\u4FDD\u793E\u7FA4\u54C1\u8CEA\uFF01")),
                        React.createElement("div", { className: "mt-5 flex flex-col sm:flex-row justify-center gap-3" },
                            React.createElement("div", { className: "mt-6 flex flex-wrap justify-center gap-3" },
                                myProfile && (React.createElement("button", { onClick: () => {
                                        setSelectedVTuber(myProfile);
                                        navigate(`profile/${myProfile.id}`);
                                    }, className: "bg-[#8B5CF6] hover:bg-[#8B5CF6] text-white px-5 py-2 rounded-xl text-sm font-bold shadow-sm transition-transform inline-flex items-center gap-2" },
                                    React.createElement("i", { className: "fa-solid fa-eye" }),
                                    " \u9810\u89BD\u6211\u7684\u516C\u958B\u540D\u7247")),
                                React.createElement("button", { type: "button", onClick: handleEnableNotifications, className: "bg-[#38BDF8] hover:bg-[#38BDF8] text-[#0F111A] px-5 py-2 rounded-xl text-sm font-bold shadow-sm transition-transform inline-flex items-center gap-2" },
                                    React.createElement("i", { className: "fa-solid fa-bell" }),
                                    " \u555F\u52D5\u624B\u6A5F\u63A8\u64AD\u901A\u77E5")))),
                    " ",
                    React.createElement("div", { className: "bg-[#181B25]/40 border border-[#2A2F3D] rounded-2xl p-6 sm:p-10 shadow-sm" },
                        React.createElement(ProfileEditorForm, { form: profileForm, updateForm: (updates) => setProfileForm((prev) => ({ ...prev, ...updates })), onSubmit: (e) => handleSaveProfile(e), showToast: showToast, isAdmin: false, user: user, onDeleteSelf: realVtubers.find((v) => v.id === user?.uid)
                                ? handleUserDeleteSelf
                                : null })),
                    user &&
                        myProfile &&
                        displayBulletins.filter((b) => b.userId === user.uid).length >
                            0 && (React.createElement("div", { className: "mt-16 animate-fade-in-up" },
                        React.createElement("h3", { className: "text-2xl font-extrabold text-white mb-6 border-b border-[#2A2F3D] pb-3 flex items-center" },
                            React.createElement("i", { className: "fa-solid fa-bullhorn text-[#A78BFA] mr-3" }),
                            "\u6211\u7684\u62DB\u52DF\u7BA1\u7406 (\u53EF\u5728\u6B64\u67E5\u770B\u8AB0\u6709\u610F\u9858)"),
                        React.createElement("div", { className: "grid grid-cols-1 gap-6" }, displayBulletins
                            .filter((b) => b.userId === user.uid)
                            .map((b) => (React.createElement(BulletinCard, { key: b.id, b: b, user: user, isVerifiedUser: isVerifiedUser, onNavigateProfile: (vtuber, isFromApplicants) => {
                                if (vtuber && vtuber.id) {
                                    if (isFromApplicants)
                                        setOpenBulletinModalId(b.id);
                                    else
                                        setOpenBulletinModalId(null);
                                    setSelectedVTuber(vtuber);
                                    navigate(`profile/${vtuber.id}`);
                                }
                                else {
                                    showToast("找不到該名片！");
                                }
                            }, onApply: (id, isApplying) => handleApplyBulletin(id, isApplying, b.userId), onInvite: handleOpenCollabModal, onDeleteBulletin: handleDeleteBulletin, onEditBulletin: handleEditBulletin, openModalId: openBulletinModalId, onClearOpenModalId: () => setOpenBulletinModalId(null), currentView: currentView })))))))),
                currentView === "grid" && (React.createElement("div", { id: "vtuber-partner-page-top", className: "vnexus-vtuber-grid-page w-full max-w-7xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8 animate-fade-in-up overflow-x-hidden" },
                    React.createElement("aside", { className: `vnexus-vtuber-filter-panel w-full lg:w-72 flex-shrink-0 space-y-6 ${isMobileFilterOpen ? "block" : "hidden lg:block"}` },
                        React.createElement("div", { className: "hidden lg:block relative" },
                            React.createElement("i", { className: "fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" }),
                            React.createElement("input", { type: "text", placeholder: "\u641C\u5C0B VTuber...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full bg-[#181B25]/50 border border-[#2A2F3D] rounded-xl py-3 pl-10 pr-4 text-[16px] sm:text-sm text-white outline-none focus:border-[#8B5CF6]" })),
                        React.createElement("div", { className: "bg-[#181B25]/30 border border-[#2A2F3D] rounded-xl p-5 space-y-5" },
                            React.createElement("h3", { className: "font-bold border-b border-[#2A2F3D] pb-2 text-[#CBD5E1]" },
                                React.createElement("i", { className: "fa-solid fa-filter mr-2" }),
                                "\u9032\u968E\u7BE9\u9078"),
                            React.createElement("div", { className: "lg:hidden mb-4" },
                                React.createElement("p", { className: "text-xs text-[#64748B] mb-2" }, "\u95DC\u9375\u5B57\u641C\u5C0B (\u5982: ASMR\u3001\u6B4C\u56DE\u3001\u4F01\u5283)"),
                                React.createElement("div", { className: "relative" },
                                    React.createElement("i", { className: "fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" }),
                                    React.createElement("input", { type: "text", placeholder: "\u641C\u5C0B\u540D\u7247\u5167\u4EFB\u4F55\u6587\u5B57...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full bg-[#0F111A] border border-[#2A2F3D] rounded-xl py-3 pl-10 pr-4 text-[16px] sm:text-sm text-white outline-none focus:border-[#8B5CF6] shadow-inner" }))),
                            React.createElement("div", null,
                                React.createElement("p", { className: "text-xs text-[#64748B] mb-2" }, "\u6240\u5C6C\u52E2\u529B"),
                                React.createElement("div", { className: "grid grid-cols-2 gap-1 bg-[#0F111A] rounded-lg p-1 border border-[#2A2F3D]" }, ["All", "個人勢", "企業勢", "社團勢", "合作勢"].map((a) => (React.createElement("button", { key: a, onClick: () => setSelectedAgency(a), className: `w-full py-1.5 text-xs font-bold rounded-md ${selectedAgency === a ? "bg-[#8B5CF6] text-white" : "text-[#94A3B8] hover:text-white"}` }, a === "All" ? "全部" : a))))),
                            React.createElement("div", null,
                                React.createElement("p", { className: "text-xs text-[#64748B] mb-2" }, "\u4E3B\u8981\u5E73\u53F0"),
                                React.createElement("div", { className: "flex bg-[#0F111A] rounded-lg p-1 border border-[#2A2F3D]" }, ["All", "YouTube", "Twitch"].map((p) => (React.createElement("button", { key: p, onClick: () => setSelectedPlatform(p), className: `flex-1 py-1.5 text-xs font-bold rounded-md ${selectedPlatform === p ? "bg-[#8B5CF6] text-white" : "text-[#94A3B8]"}` }, p === "All" ? "全部" : p))))),
                            React.createElement("div", { className: "grid grid-cols-2 gap-3" },
                                React.createElement("div", null,
                                    React.createElement("p", { className: "text-xs text-[#64748B] mb-2" }, "\u570B\u7C4D"),
                                    React.createElement("select", { value: selectedNationality, onChange: (e) => setSelectedNationality(e.target.value), className: "w-full bg-[#0F111A] border border-[#2A2F3D] rounded-lg p-2 text-white text-[16px] sm:text-xs outline-none font-normal" }, dynamicNationalities.map((n) => (React.createElement("option", { key: n, value: n }, n === "All" ? "全部" : n))))),
                                React.createElement("div", null,
                                    React.createElement("p", { className: "text-xs text-[#64748B] mb-2" }, "\u4E3B\u8981\u8A9E\u8A00"),
                                    React.createElement("select", { value: selectedLanguage, onChange: (e) => setSelectedLanguage(e.target.value), className: "w-full bg-[#0F111A] border border-[#2A2F3D] rounded-lg p-2 text-white text-[16px] sm:text-xs outline-none font-normal" }, dynamicLanguages.map((l) => (React.createElement("option", { key: l, value: l }, l === "All" ? "全部" : l)))))),
                            React.createElement("div", null,
                                React.createElement("p", { className: "text-xs text-[#64748B] mb-2" }, "\u53EF\u806F\u52D5\u6642\u6BB5"),
                                React.createElement("select", { value: selectedSchedule, onChange: (e) => setSelectedSchedule(e.target.value), className: "w-full bg-[#0F111A] border border-[#2A2F3D] rounded-lg p-2 text-white text-[16px] sm:text-xs outline-none font-normal" }, dynamicSchedules.map((d) => (
                                // 🌟 優化：加上 bg-[#0F111A] text-white
                                React.createElement("option", { key: d, value: d, className: "bg-[#0F111A] text-white" }, d === "All" ? "全部" : d))))),
                            React.createElement("div", null,
                                React.createElement("p", { className: "text-xs text-[#64748B] mb-2" }, "\u4EE3\u8868\u8272\u7CFB"),
                                React.createElement("select", { value: selectedColor, onChange: (e) => setSelectedColor(e.target.value), className: "w-full bg-[#0F111A] border border-[#2A2F3D] rounded-lg p-2 text-white text-[16px] sm:text-xs outline-none font-normal" },
                                    React.createElement("option", { value: "All", className: "bg-[#0F111A] text-white" }, "\u5168\u90E8\u8272\u7CFB"),
                                    COLOR_OPTIONS.map((c) => (React.createElement("option", { key: c, value: c, className: "bg-[#0F111A] text-white" }, c))))),
                            React.createElement("div", null,
                                React.createElement("p", { className: "text-xs text-[#64748B] mb-2" }, "\u661F\u5EA7"),
                                React.createElement("select", { value: selectedZodiac, onChange: (e) => setSelectedZodiac(e.target.value), className: "w-full bg-[#0F111A] border border-[#2A2F3D] rounded-lg p-2 text-white text-[16px] sm:text-xs outline-none font-normal" },
                                    React.createElement("option", { value: "All", className: "bg-[#0F111A] text-white" }, "\u5168\u90E8\u661F\u5EA7"),
                                    ZODIAC_SIGNS.map((z) => (React.createElement("option", { key: z, value: z, className: "bg-[#0F111A] text-white" }, z))))),
                            React.createElement("div", { className: "flex flex-wrap gap-2 mt-2" },
                                React.createElement("p", { className: "w-full text-xs text-[#64748B] mb-1" }, "\u60F3\u627E\u4EC0\u9EBC\u806F\u52D5\uFF1F"),
                                dynamicCollabTypes.map((tag) => (React.createElement(TagBadge, { key: tag, text: tag, selected: selectedTags.includes(tag), onClick: () => toggleTag(tag) })))))),
                    React.createElement("div", { className: "vnexus-vtuber-grid-main flex-1 min-w-0 w-full" },
                        React.createElement("div", { className: "vnexus-vtuber-grid-toolbar flex flex-col sm:flex-row sm:items-start sm:items-center justify-between gap-4 mb-6" },
                            React.createElement("div", { className: "vnexus-vtuber-grid-actions flex flex-wrap items-center gap-3" },
                                React.createElement("h2", { className: "text-2xl font-bold text-white flex items-center gap-2" },
                                    "\u5C0B\u627E VTuber \u5925\u4F34",
                                    " ",
                                    user &&
                                        realVtubers.find((v) => v.id === user.uid &&
                                            (!v.isVerified ||
                                                v.isBlacklisted ||
                                                v.activityStatus !== "active")) && (React.createElement("span", { className: "text-xs font-normal text-[#F59E0B] bg-[#F59E0B]/10 px-3 py-1 rounded-full" },
                                        React.createElement("i", { className: "fa-solid fa-eye-slash mr-1" }),
                                        "\u96B1\u85CF\u4E2D"))),
                                React.createElement("button", { onClick: () => setIsTipsModalOpen(true), className: "bg-[#F59E0B]/10 text-[#F59E0B] px-3 py-1.5 rounded-lg text-sm font-bold" },
                                    React.createElement("i", { className: "fa-solid fa-lightbulb" }),
                                    " \u9080\u7D04\u5C0F\u6280\u5DE7"),
                                React.createElement("button", { onClick: () => {
                                        // 🌟 修正：如果目前是「最契合夥伴」，就維持原樣只洗牌；否則才切換到「隨機排列」
                                        if (sortOrder !== "compatibility" && sortOrder !== "random") {
                                            setSortOrder("random");
                                        }
                                        // 更新種子觸發重新計算
                                        setShuffleSeed(Date.now());
                                        // 回到頁面頂端，讓使用者看到變化
                                        window.scrollTo({ top: 0, behavior: "smooth" });
                                        showToast("🎲 已重新洗牌名片順序！");
                                    }, className: "bg-[#8B5CF6]/10 text-[#A78BFA] hover:bg-[#8B5CF6] hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-all border border-[#8B5CF6]/20" },
                                    React.createElement("i", { className: "fa-solid fa-shuffle mr-1" }),
                                    " \u91CD\u65B0\u6D17\u724C"),
                                React.createElement("button", { onClick: () => {
                                        if (!isVerifiedUser) {
                                            showToast("請先認證名片解鎖功能");
                                            navigate("dashboard");
                                        }
                                        else {
                                            navigate("match");
                                        }
                                    }, className: "bg-pink-500/10 text-pink-400 hover:bg-pink-500 hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-all border border-pink-500/20" },
                                    React.createElement("i", { className: "fa-solid fa-dice mr-1" }),
                                    " \u806F\u52D5\u96A8\u6A5F\u914D\u5C0D ",
                                    !isVerifiedUser && " 🔒"),
                                React.createElement("button", { onClick: () => navigate('blacklist'), className: "bg-[#3B171D]/50 text-[#EF4444] hover:bg-[#EF4444] hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-all border border-[#EF4444]/50" },
                                    React.createElement("i", { className: "fa-solid fa-ban mr-1" }),
                                    " \u9ED1\u55AE\u907F\u96F7\u5340"),
                                React.createElement("button", { onClick: () => setIsMobileFilterOpen(!isMobileFilterOpen), className: "vnexus-mobile-filter-toggle lg:hidden bg-[#181B25] hover:bg-[#1D2130] border border-[#2A2F3D] text-[#CBD5E1] hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors" },
                                    React.createElement("i", { className: "fa-solid fa-filter" }),
                                    " \u7BE9\u9078")),
                            React.createElement("div", { className: "vnexus-vtuber-grid-search-sort flex flex-col gap-3 w-full sm:w-auto" },
                                React.createElement("div", { className: "block lg:hidden relative w-full" },
                                    React.createElement("i", { className: "fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" }),
                                    React.createElement("input", { type: "text", placeholder: "\u641C\u5C0B VTuber...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full bg-[#181B25]/50 border border-[#2A2F3D] rounded-xl py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-[#8B5CF6]" })),
                                React.createElement("select", { value: sortOrder, onChange: (e) => {
                                        setSortOrder(e.target.value);
                                        // 當選擇「隨機排列」或「最契合夥伴」時，順便更新種子，確保每次切換都能重新洗牌！
                                        if (e.target.value === "random" || e.target.value === "compatibility") {
                                            setShuffleSeed(Date.now());
                                        }
                                    }, className: "vnexus-vtuber-sort-select bg-[#181B25] border border-[#2A2F3D] rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[#8B5CF6] outline-none w-full sm:w-auto" },
                                    React.createElement("option", { value: "newest" }, "\u2728 \u6700\u8FD1\u52D5\u614B (\u76F4\u64AD\u4E2D/\u66F4\u65B0)"),
                                    user && (React.createElement("option", { value: "compatibility" }, "\uD83D\uDC96 \u6700\u5951\u5408\u5925\u4F34")),
                                    React.createElement("option", { value: "random" }, "\uD83D\uDD00 \u96A8\u6A5F\u6392\u5217"),
                                    React.createElement("option", { value: "likes" }, "\uD83D\uDC4D \u6700\u63A8\u85A6"),
                                    React.createElement("option", { value: "subscribers" }, "\uD83D\uDCFA \u6700\u591A\u8A02\u95B1")))),
                        isLoading ? (React.createElement("div", { className: "text-center text-[#64748B] py-10" },
                            React.createElement("i", { className: "fa-solid fa-spinner fa-spin text-2xl" }))) : filteredVTubers.length === 0 ? (React.createElement("p", { className: "text-center text-[#64748B] mt-20" }, "\u76EE\u524D\u7121\u516C\u958B\u540D\u7247")) : (React.createElement(React.Fragment, null,
                            React.createElement("div", { className: "vnexus-vtuber-grid-list grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" }, paginatedVTubers.map((v) => (React.createElement(VTuberCard, { key: v.id, v: v, user: user, isVerifiedUser: isVerifiedUser, onSelect: () => {
                                    setSelectedVTuber(v);
                                    navigate(`profile/${v.id}`);
                                }, onDislike: () => handleInitiateDislike(v) })))),
                            totalPages > 1 && (React.createElement("div", { className: "flex flex-wrap justify-center items-center gap-4 mt-12 animate-fade-in-up" },
                                React.createElement("button", { onClick: () => handlePageChange(currentPage - 1), disabled: currentPage === 1, className: `px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center ${currentPage === 1 ? "bg-[#181B25]/50 text-gray-600 cursor-not-allowed border border-[#2A2F3D]" : "bg-[#181B25] hover:bg-[#8B5CF6] text-white border border-[#2A2F3D] hover:border-[#8B5CF6]"}` },
                                    React.createElement("i", { className: "fa-solid fa-chevron-left mr-2" }),
                                    " \u4E0A\u4E00\u9801"),
                                React.createElement("div", { className: "flex items-center gap-2 text-[#CBD5E1] font-bold bg-[#0F111A]/50 px-4 py-2.5 rounded-xl border border-[#2A2F3D]" },
                                    React.createElement("span", null, "\u7B2C"),
                                    React.createElement("select", { value: currentPage, onChange: (e) => handlePageChange(Number(e.target.value)), className: "bg-[#181B25] border border-[#2A2F3D] rounded-lg px-2 py-1 text-white outline-none cursor-pointer" }, [...Array(totalPages).keys()].map((n) => (React.createElement("option", { key: n + 1, value: n + 1 }, n + 1)))),
                                    React.createElement("span", null,
                                        "/ ",
                                        totalPages,
                                        " \u9801")),
                                React.createElement("button", { onClick: () => handlePageChange(currentPage + 1), disabled: currentPage === totalPages, className: `px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center ${currentPage === totalPages ? "bg-[#181B25]/50 text-gray-600 cursor-not-allowed border border-[#2A2F3D]" : "bg-[#181B25] hover:bg-[#8B5CF6] text-white border border-[#2A2F3D] hover:border-[#8B5CF6]"}` },
                                    "\u4E0B\u4E00\u9801",
                                    " ",
                                    React.createElement("i", { className: "fa-solid fa-chevron-right ml-2" }))))))))),
                currentView === "profile" && !selectedVTuber && isLoading && (React.createElement("div", { className: "max-w-4xl mx-auto px-4 py-20 text-center animate-fade-in-up" },
                    React.createElement("i", { className: "fa-solid fa-spinner fa-spin text-4xl text-[#8B5CF6] mb-4" }),
                    React.createElement("p", { className: "text-[#94A3B8] font-bold text-lg" }, "\u8F09\u5165\u5C08\u5C6C\u540D\u7247\u4E2D..."))),
                currentView === "profile" && selectedVTuber && (React.createElement("div", { className: "bg-transparent text-slate-200 font-sans p-3 sm:p-5 min-h-screen w-full" },
                    React.createElement("div", { className: "max-w-4xl mx-auto animate-fade-in-up" },
                        React.createElement("button", { onClick: () => {
                                if (viewParticipantsCollab || openBulletinModalId) {
                                    navigate(previousView || "home", true);
                                }
                                else {
                                    const target = previousView === "profile" ? "grid" : previousView || "grid";
                                    navigate(target, true);
                                }
                                setTimeout(() => { window.scrollTo(0, gridScrollY.current); }, 50);
                            }, className: "group flex items-center gap-2 text-slate-400 hover:text-white mb-4 text-xs font-medium transition-all duration-300 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full w-fit backdrop-blur-md ring-1 ring-white/10" },
                            React.createElement("i", { className: "fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform" }),
                            React.createElement("span", null, viewParticipantsCollab ? "返回聯動參與人員"
                                : openBulletinModalId ? "看看其他有意願的Vtuber"
                                    : previousView === "bulletin" ? "返回佈告欄"
                                        : previousView === "collabs" ? "返回聯動表"
                                            : previousView === "inbox" ? "返回我的信箱"
                                                : previousView === "home" ? "返回首頁"
                                                    : previousView === "match" ? "返回配對"
                                                        : "返回探索")),
                        React.createElement("div", { className: "bg-[#181B25] rounded-2xl overflow-hidden border border-[#2A2F3D] shadow-sm relative z-10" },
                            React.createElement("div", { className: "h-36 sm:h-52 relative group bg-[#11131C]" },
                                React.createElement(LazyImage, { src: sanitizeUrl(selectedVTuber.banner), containerCls: "absolute inset-0 w-full h-full opacity-70" }),
                                React.createElement("div", { className: "absolute inset-0 bg-gradient-to-b from-transparent via-[#181B25]/30 to-[#181B25] z-10" }),
                                React.createElement("div", { className: "hidden", style: { backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' } }),
                                React.createElement("div", { className: "absolute top-4 right-4 z-20 flex gap-2" },
                                    React.createElement("a", { href: sanitizeUrl(selectedVTuber.mainPlatform === "Twitch" ? selectedVTuber.twitchUrl : selectedVTuber.youtubeUrl) || '#', target: "_blank", rel: "noopener noreferrer", className: `text-white text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-xl ring-1 ring-white/20 shadow-md transition-all ${selectedVTuber.mainPlatform === "Twitch" ? "bg-[#8B5CF6]/80 hover:bg-[#8B5CF6]/90 shadow-sm" : "bg-[#EF4444]/80 hover:bg-[#EF4444]/90 shadow-sm"}` },
                                        React.createElement("i", { className: `fa-brands fa-${selectedVTuber.mainPlatform === "Twitch" ? "twitch" : "youtube"}` }),
                                        "\u4E3B\u8981\u76F4\u64AD\u5E73\u53F0: ",
                                        selectedVTuber.mainPlatform || "YouTube",
                                        React.createElement("i", { className: "fa-solid fa-arrow-up-right-from-square ml-1 text-[10px] opacity-70" })))),
                            React.createElement("div", { className: "px-5 sm:px-8 pb-8 relative z-20 -mt-14 sm:-mt-16" },
                                React.createElement("div", { className: "flex flex-col sm:flex-row gap-5 sm:items-end justify-between mb-5" },
                                    React.createElement("div", { className: "flex items-end gap-4 min-w-0" },
                                        React.createElement("div", { className: "relative flex-shrink-0" },
                                            React.createElement("div", { className: "p-2 bg-[#181B25] rounded-2xl border border-[#2A2F3D] shadow-sm inline-block relative z-20" },
                                                React.createElement(LazyImage, { src: sanitizeUrl(selectedVTuber.avatar), containerCls: "w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-[#11131C] flex-shrink-0 relative overflow-hidden" })),
                                            onlineUsers?.has(selectedVTuber.id) && (React.createElement("div", { className: "absolute bottom-3 -right-1 z-30 bg-[#181B25] rounded-full p-1 border border-[#2A2F3D] shadow-sm" },
                                                React.createElement("div", { className: "w-3.5 h-3.5 bg-green-400 rounded-full shadow-sm" })))),
                                        React.createElement("div", { className: "flex flex-nowrap items-center gap-2 pb-2 max-w-full sm:max-w-[360px] overflow-x-auto whitespace-nowrap custom-scrollbar" },
                                            (selectedVTuber.youtubeUrl || selectedVTuber.youtubeSubscribers || selectedVTuber.subscribers) && (React.createElement("a", { href: sanitizeUrl(selectedVTuber.youtubeUrl || '#'), target: "_blank", rel: "noopener noreferrer", className: "flex-shrink-0 flex items-center justify-center gap-1.5 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] px-3 h-9 rounded-lg text-xs font-bold transition-colors border border-[#EF4444]/20", title: "YouTube" },
                                                React.createElement("i", { className: "fa-brands fa-youtube text-base" }),
                                                React.createElement("span", { className: "hidden sm:inline" }, "YouTube"),
                                                formatSocialCount(selectedVTuber.youtubeSubscribers || selectedVTuber.subscribers) && (React.createElement("span", { className: "text-[11px] text-[#FCA5A5] font-semibold border-l border-[#EF4444]/25 pl-1.5" }, formatSocialCount(selectedVTuber.youtubeSubscribers || selectedVTuber.subscribers))))),
                                            (selectedVTuber.twitchUrl || selectedVTuber.twitchFollowers) && (React.createElement("a", { href: sanitizeUrl(selectedVTuber.twitchUrl || '#'), target: "_blank", rel: "noopener noreferrer", className: "flex-shrink-0 flex items-center justify-center gap-1.5 bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-[#A78BFA] px-3 h-9 rounded-lg text-xs font-bold transition-colors border border-[#8B5CF6]/20", title: "Twitch" },
                                                React.createElement("i", { className: "fa-brands fa-twitch text-base" }),
                                                React.createElement("span", { className: "hidden sm:inline" }, "Twitch"),
                                                formatSocialCount(selectedVTuber.twitchFollowers) && (React.createElement("span", { className: "text-[11px] text-[#C4B5FD] font-semibold border-l border-[#8B5CF6]/25 pl-1.5" }, formatSocialCount(selectedVTuber.twitchFollowers))))),
                                            selectedVTuber.xUrl && (React.createElement("a", { href: sanitizeUrl(selectedVTuber.xUrl), target: "_blank", rel: "noopener noreferrer", className: "flex-shrink-0 flex items-center justify-center w-9 h-9 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg transition-colors border border-white/10", title: "X / Twitter" },
                                                React.createElement("i", { className: "fa-brands fa-x-twitter text-base" }))),
                                            selectedVTuber.igUrl && (React.createElement("a", { href: sanitizeUrl(selectedVTuber.igUrl), target: "_blank", rel: "noopener noreferrer", className: "flex-shrink-0 flex items-center justify-center w-9 h-9 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 rounded-lg transition-colors border border-pink-500/20", title: "Instagram" },
                                                React.createElement("i", { className: "fa-brands fa-instagram text-base" }))))),
                                    React.createElement("div", { className: "flex gap-2 sm:gap-3 items-center w-full sm:w-auto pb-1" }, isVerifiedUser && selectedVTuber.id !== user?.uid && (React.createElement(React.Fragment, null,
                                        React.createElement("button", { onClick: () => setChatTarget(selectedVTuber), className: "flex-1 sm:flex-none bg-[#1D2130] hover:bg-[#2A2F3D] text-[#F8FAFC] px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors border border-[#2A2F3D] flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap" },
                                            React.createElement("i", { className: "fa-regular fa-comment-dots text-cyan-400" }),
                                            "\u79C1\u8A0A\u804A\u804A"),
                                        React.createElement("button", { onClick: () => handleBraveInvite(selectedVTuber), className: "flex-1 sm:flex-none bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-pink-500/30 transition-colors flex items-center justify-center gap-1 sm:gap-1.5 group whitespace-nowrap" },
                                            React.createElement("i", { className: "fa-solid fa-heart group-hover:scale-[1.01] transition-transform text-white" }),
                                            "\u52C7\u6562\u9080\u8ACB"))))),
                                isVerifiedUser && selectedVTuber.id !== user?.uid && (React.createElement("div", { className: "mb-5 bg-[#8B5CF6]/10 border border-[#8B5CF6]/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" },
                                    React.createElement("div", null,
                                        React.createElement("p", { className: "text-[#F8FAFC] font-bold text-sm" }, "\u60F3\u4E00\u8D77\u76F4\u64AD\u6216\u767C\u8D77\u4F01\u5283\u55CE\uFF1F"),
                                        React.createElement("p", { className: "text-[#94A3B8] text-xs mt-1" }, "\u5148\u770B\u806F\u52D5\u985E\u578B\u8207\u53EF\u7D04\u6642\u6BB5\uFF0C\u9069\u5408\u5C31\u76F4\u63A5\u9001\u51FA\u9080\u8ACB\u3002")),
                                    React.createElement("button", { onClick: () => handleOpenCollabModal(selectedVTuber), className: "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm whitespace-nowrap" }, "\u9080\u8ACB\u4ED6\u806F\u52D5"))),
                                React.createElement("div", { className: "flex flex-col lg:flex-row justify-between items-start gap-5 mb-5 pb-5 border-b border-[#2A2F3D]" },
                                    React.createElement("div", { className: "flex-1" },
                                        React.createElement("div", { className: "flex flex-wrap items-center gap-3 mb-3" },
                                            React.createElement("h1", { className: "text-2xl sm:text-4xl font-black text-[#F8FAFC] tracking-tight flex items-center gap-3" },
                                                selectedVTuber.name,
                                                selectedVTuber.isVerified && (React.createElement("i", { className: "fa-solid fa-circle-check text-[#22C55E] text-2xl drop-shadow-sm" })))),
                                        React.createElement("div", { className: "flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium text-slate-400" },
                                            selectedVTuber.agency && (React.createElement("span", { className: "flex items-center gap-1.5 text-slate-200" },
                                                React.createElement("i", { className: "fa-solid fa-building opacity-50" }),
                                                selectedVTuber.agency)),
                                            Array.isArray(selectedVTuber.creatorRoles) && selectedVTuber.creatorRoles.length > 0 && (React.createElement(React.Fragment, null,
                                                React.createElement("span", { className: "w-1 h-1 rounded-full bg-slate-700" }),
                                                React.createElement("span", { className: "inline-flex items-center gap-1.5 flex-wrap" }, selectedVTuber.creatorRoles.map((role) => (React.createElement("span", { key: role, className: "inline-flex items-center rounded-full bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/25 px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap" }, role)))))),
                                            (selectedVTuber.nationalities?.length > 0 || selectedVTuber.nationality) && (React.createElement(React.Fragment, null,
                                                React.createElement("span", { className: "w-1 h-1 rounded-full bg-slate-700" }),
                                                React.createElement("span", { className: "flex items-center gap-1.5" },
                                                    React.createElement("i", { className: "fa-solid fa-earth-asia opacity-50" }),
                                                    (selectedVTuber.nationalities?.length > 0 ? selectedVTuber.nationalities : [selectedVTuber.nationality]).join(", ")))),
                                            (selectedVTuber.languages?.length > 0 || selectedVTuber.language) && (React.createElement(React.Fragment, null,
                                                React.createElement("span", { className: "w-1 h-1 rounded-full bg-slate-700" }),
                                                React.createElement("span", { className: "flex items-center gap-1.5" },
                                                    React.createElement("i", { className: "fa-solid fa-language opacity-50" }),
                                                    (selectedVTuber.languages?.length > 0 ? selectedVTuber.languages : [selectedVTuber.language]).join(", ")))),
                                            selectedVTuber.personalityType && (React.createElement(React.Fragment, null,
                                                React.createElement("span", { className: "w-1 h-1 rounded-full bg-slate-700" }),
                                                React.createElement("span", { className: "flex items-center gap-1.5" },
                                                    React.createElement("i", { className: "fa-solid fa-brain text-violet-400/70" }),
                                                    selectedVTuber.personalityType))),
                                            selectedVTuber.colorSchemes && selectedVTuber.colorSchemes.length > 0 && (React.createElement(React.Fragment, null,
                                                React.createElement("span", { className: "w-1 h-1 rounded-full bg-slate-700" }),
                                                React.createElement("span", { className: "flex items-center gap-1.5" },
                                                    React.createElement("i", { className: "fa-solid fa-palette opacity-50" }),
                                                    selectedVTuber.colorSchemes.join(", "),
                                                    "\u7CFB"))))),
                                    React.createElement("div", { className: "w-full lg:w-auto lg:self-start flex justify-end" },
                                        React.createElement("div", { className: "inline-flex items-center gap-2 bg-[#11131C]/80 border border-[#2A2F3D] rounded-xl p-1.5" },
                                            React.createElement("button", { onClick: (e) => {
                                                    e.stopPropagation();
                                                    if (isVerifiedUser && selectedVTuber.id !== user?.uid)
                                                        handleRecommend(selectedVTuber);
                                                }, className: "inline-flex items-center gap-1.5 bg-[#22C55E]/10 hover:bg-[#22C55E]/20 text-[#22C55E] px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors border border-[#22C55E]/20 whitespace-nowrap", title: "\u63A8\u85A6\u9019\u5F35\u540D\u7247" },
                                                React.createElement("i", { className: "fa-solid fa-thumbs-up text-[10px]" }),
                                                selectedVTuber.likes || 0,
                                                " \u63A8\u85A6"),
                                            isVerifiedUser && selectedVTuber.id !== user?.uid && (React.createElement("button", { onClick: (e) => {
                                                    e.stopPropagation();
                                                    handleInitiateDislike(selectedVTuber);
                                                }, className: "inline-flex items-center gap-1.5 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors border border-[#EF4444]/20 whitespace-nowrap", title: "\u9001\u51FA\u5012\u8B9A" },
                                                React.createElement("i", { className: "fa-solid fa-thumbs-down text-[10px]" }),
                                                selectedVTuber.dislikes || 0))))),
                                React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6" },
                                    React.createElement("div", { className: "bg-[#1D2130] border border-[#2A2F3D] rounded-2xl p-4" },
                                        React.createElement("p", { className: "text-[11px] text-[#94A3B8] font-bold mb-1" }, "\u76EE\u524D\u72C0\u614B"),
                                        React.createElement("p", { className: `text-sm font-bold ${selectedVTuber.activityStatus === "sleep" ? "text-[#F59E0B]" : selectedVTuber.activityStatus === "graduated" ? "text-[#94A3B8]" : selectedVTuber.activityStatus === "creator" ? "text-[#38BDF8]" : "text-[#22C55E]"}` }, selectedVTuber.activityStatus === "sleep" ? "🌙 暫時休息" : selectedVTuber.activityStatus === "graduated" ? "🕊️ 已畢業" : selectedVTuber.activityStatus === "creator" ? "🎨 繪師 / 建模師 / 剪輯師" : "🟢 開放聯動")),
                                    React.createElement("div", { className: "bg-[#1D2130] border border-[#2A2F3D] rounded-2xl p-4" },
                                        React.createElement("p", { className: "text-[11px] text-[#94A3B8] font-bold mb-1" }, "\u9069\u5408\u4E00\u8D77\u505A"),
                                        React.createElement("p", { className: "text-sm text-[#F8FAFC] font-bold truncate" }, (selectedVTuber.collabTypes || []).slice(0, 2).join("、") || "尚未填寫")),
                                    React.createElement("div", { className: "bg-[#1D2130] border border-[#2A2F3D] rounded-2xl p-4" },
                                        React.createElement("p", { className: "text-[11px] text-[#94A3B8] font-bold mb-1" }, "\u4E3B\u8981\u5E73\u53F0"),
                                        React.createElement("p", { className: "text-sm text-[#38BDF8] font-bold" }, selectedVTuber.mainPlatform || "YouTube")),
                                    React.createElement("div", { className: "bg-[#1D2130] border border-[#2A2F3D] rounded-2xl p-4" },
                                        React.createElement("p", { className: "text-[11px] text-[#94A3B8] font-bold mb-1" }, "\u53EF\u7D04\u6642\u6BB5"),
                                        React.createElement("p", { className: "text-sm text-[#F8FAFC] font-bold line-clamp-1" }, formatSchedule(selectedVTuber) || "尚未提供"))),
                                selectedVTuber.statusMessage && selectedVTuber.statusMessageUpdatedAt &&
                                    (Date.now() - selectedVTuber.statusMessageUpdatedAt < (selectedVTuber.statusMessage.includes('🔴') ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)) && (React.createElement("div", { className: `mb-6 relative overflow-hidden rounded-2xl p-4 flex items-center gap-4 ${selectedVTuber.statusMessage.includes('🔴') ? 'bg-[#EF4444]/10 ring-1 ring-red-500/30' : 'bg-[#F59E0B]/10 ring-1 ring-orange-500/30'} backdrop-blur-sm` },
                                    React.createElement("div", { className: `absolute left-0 top-0 bottom-0 w-1 ${selectedVTuber.statusMessage.includes('🔴') ? 'bg-[#EF4444] shadow-sm' : 'bg-[#F59E0B] shadow-sm'}` }),
                                    React.createElement("div", { className: `w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${selectedVTuber.statusMessage.includes('🔴') ? 'bg-[#EF4444]/20 text-[#EF4444]' : 'bg-[#F59E0B]/20 text-[#F59E0B]'}` },
                                        React.createElement("i", { className: `fa-solid text-lg ${selectedVTuber.statusMessage.includes('🔴') ? 'fa-satellite-dish' : 'fa-comment-dots'}` })),
                                    React.createElement("div", { className: "flex-1" },
                                        React.createElement("p", { className: "text-[10px] sm:text-xs text-slate-400 mb-0.5 uppercase tracking-wider font-semibold" }, selectedVTuber.statusMessage.includes('🔴') ? 'LIVE ON AIR' : '24H限時動態'),
                                        React.createElement("p", { className: `text-sm sm:text-base font-medium ${selectedVTuber.statusMessage.includes('🔴') ? 'text-red-100' : 'text-orange-100'}` }, selectedVTuber.statusMessage)))),
                                React.createElement("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6" },
                                    React.createElement("div", { className: "lg:col-span-2 space-y-5" },
                                        React.createElement("div", { className: "bg-[#1D2130] rounded-2xl p-5 sm:p-7 border border-[#2A2F3D] relative overflow-hidden" },
                                            React.createElement("div", { className: "absolute top-0 right-0 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl -mr-16 -mt-16" }),
                                            React.createElement("div", { className: "relative z-10" },
                                                React.createElement("div", { className: "flex flex-wrap justify-between items-center mb-5 gap-3" },
                                                    React.createElement("div", { className: "flex flex-wrap items-center gap-3" },
                                                        React.createElement("div", { className: "w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400" },
                                                            React.createElement("i", { className: "fa-solid fa-address-card text-base" })),
                                                        React.createElement("h3", { className: "text-xl font-bold text-white tracking-wide" }, "\u6211\u662F\u8AB0"),
                                                        selectedVTuber.zodiacSign && (React.createElement("span", { className: "bg-[#F59E0B]/10 text-[#F59E0B] px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold ring-1 ring-yellow-500/40 flex items-center gap-1.5" },
                                                            React.createElement("i", { className: "fa-solid fa-star text-[10px] text-[#F59E0B] drop-shadow-sm" }),
                                                            " ",
                                                            selectedVTuber.zodiacSign)),
                                                        selectedVTuber.streamStyleUrl && (React.createElement("a", { href: sanitizeUrl(selectedVTuber.streamStyleUrl), target: "_blank", rel: "noopener noreferrer", className: "bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 text-[#38BDF8] hover:text-[#7DD3FC] px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold transition-all ring-1 ring-blue-500/40 flex items-center gap-1.5 ml-1" },
                                                            React.createElement("i", { className: "fa-solid fa-video" }),
                                                            " \u89C0\u770B\u6211\u7684\u76F4\u64AD\u98A8\u683C"))),
                                                    React.createElement("button", { onClick: () => {
                                                            const identifier = selectedVTuber.slug || selectedVTuber.id;
                                                            const url = window.location.origin + window.location.pathname + "#profile/" + identifier;
                                                            navigator.clipboard.writeText(url);
                                                            showToast("✅ 已複製專屬名片連結！");
                                                        }, className: "group flex items-center gap-1.5 text-slate-400 hover:text-cyan-400 text-xs font-medium transition-colors" },
                                                        React.createElement("i", { className: "fa-solid fa-link group-hover:rotate-45 transition-transform" }),
                                                        "\u8907\u88FD\u6211\u7684\u5C08\u5C6C\u9023\u7D50")),
                                                React.createElement("p", { className: "text-slate-300 leading-relaxed whitespace-pre-wrap text-sm sm:text-base" }, selectedVTuber.description || "這位 VTuber 還沒有留下自我介紹喔！"))),
                                        selectedVTuber.tags && selectedVTuber.tags.length > 0 && (React.createElement("div", { className: "bg-[#1D2130] rounded-2xl p-5 sm:p-7 border border-[#2A2F3D]" },
                                            React.createElement("div", { className: "flex items-center gap-3 mb-4" },
                                                React.createElement("div", { className: "w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400" },
                                                    React.createElement("i", { className: "fa-solid fa-hashtag text-base" })),
                                                React.createElement("h3", { className: "text-xl font-bold text-white tracking-wide" }, "\u6211\u7684\u559C\u597D")),
                                            React.createElement("div", { className: "flex flex-wrap gap-2" }, selectedVTuber.tags.map((t) => (React.createElement("span", { key: t, className: "px-2.5 py-1 bg-white/[0.03] hover:bg-cyan-500/10 transition-colors rounded-md text-[11px] sm:text-xs font-medium text-slate-300 ring-1 ring-white/10 hover:ring-cyan-500/30 cursor-default" }, t))))))),
                                    React.createElement("div", { className: "space-y-5" },
                                        React.createElement("div", { className: "bg-[#1D2130] rounded-2xl p-5 sm:p-7 border border-[#2A2F3D] relative overflow-hidden" },
                                            React.createElement("div", { className: "relative z-10 space-y-6" },
                                                React.createElement("div", null,
                                                    React.createElement("h4", { className: "font-bold text-violet-300 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider" },
                                                        React.createElement("i", { className: "fa-solid fa-display" }),
                                                        " \u5275\u4F5C\u578B\u614B"),
                                                    React.createElement("p", { className: "text-slate-200 text-base font-medium" }, selectedVTuber.streamingStyle || "一般型態")),
                                                React.createElement("div", null,
                                                    React.createElement("h4", { className: "font-bold text-cyan-300 mb-3 flex items-center gap-2 text-xs uppercase tracking-wider" },
                                                        React.createElement("i", { className: "fa-solid fa-people-group" }),
                                                        " \u9069\u5408\u4E00\u8D77\u505A\u7684\u5167\u5BB9"),
                                                    React.createElement("div", { className: "flex flex-col gap-2" }, (selectedVTuber.collabTypes || []).length > 0 ? (selectedVTuber.collabTypes.map((t) => (React.createElement("div", { key: t, className: "bg-white/5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 flex items-center gap-2.5" },
                                                        React.createElement("div", { className: "w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm" }),
                                                        t)))) : (React.createElement("div", { className: "text-xs text-slate-400" }, "\u5C1A\u672A\u586B\u5BEB")))))),
                                        React.createElement("div", { className: "bg-[#1D2130] rounded-2xl p-5 sm:p-7 border border-[#2A2F3D]" },
                                            React.createElement("h4", { className: "font-bold text-amber-300/80 mb-3 flex items-center gap-2 text-xs uppercase tracking-wider" },
                                                React.createElement("i", { className: "fa-regular fa-calendar-check" }),
                                                " \u53EF\u806F\u52D5\u6642\u6BB5"),
                                            React.createElement("div", { className: "text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-medium" }, formatSchedule(selectedVTuber) || "尚未提供")))),
                                (Array.isArray(selectedVTuber.creatorRoles) && selectedVTuber.creatorRoles.length > 0) && (React.createElement("div", { className: "mt-6 bg-gradient-to-br from-[#0B2A3A] via-[#10213F] to-[#24124A] rounded-2xl p-5 sm:p-7 border border-[#38BDF8]/45 shadow-lg shadow-[#38BDF8]/10 relative overflow-hidden" },
                                    React.createElement("div", { className: "absolute -right-16 -top-16 w-52 h-52 bg-[#38BDF8]/10 blur-3xl rounded-full" }),
                                    React.createElement("div", { className: "relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5" },
                                        React.createElement("div", { className: "min-w-0 flex-1" },
                                            React.createElement("div", { className: "flex items-center gap-3 mb-4" },
                                                React.createElement("div", { className: "w-11 h-11 rounded-2xl bg-[#38BDF8]/20 border border-[#38BDF8]/35 flex items-center justify-center text-[#7DD3FC]" },
                                                    React.createElement("i", { className: "fa-solid fa-palette text-lg" })),
                                                React.createElement("div", null,
                                                    React.createElement("p", { className: "text-xs font-extrabold tracking-[0.18em] uppercase text-[#7DD3FC]" }, "Creator Service"),
                                                    React.createElement("h3", { className: "text-2xl font-black text-white tracking-wide" }, "\u5275\u4F5C\u670D\u52D9\u5C08\u5340"))),
                                            React.createElement("div", { className: "flex flex-wrap gap-2 mb-4" },
                                                (selectedVTuber.creatorRoles || []).map((role) => React.createElement("span", { key: role, className: "bg-[#38BDF8]/15 border border-[#38BDF8]/35 text-[#BAE6FD] px-3 py-1.5 rounded-full text-xs font-extrabold" }, role)),
                                                selectedVTuber.creatorStatus && React.createElement("span", { className: "bg-[#22C55E]/15 border border-[#22C55E]/35 text-[#86EFAC] px-3 py-1.5 rounded-full text-xs font-extrabold" }, selectedVTuber.creatorStatus),
                                                selectedVTuber.creatorBudgetRange && React.createElement("span", { className: "bg-[#F59E0B]/15 border border-[#F59E0B]/35 text-[#FBBF24] px-3 py-1.5 rounded-full text-xs font-extrabold" }, normalizeCreatorBudgetRange(selectedVTuber.creatorBudgetRange))),
                                            (selectedVTuber.creatorStyles || []).length > 0 && (React.createElement("div", { className: "flex flex-wrap gap-2" }, (selectedVTuber.creatorStyles || []).map((style) => React.createElement("span", { key: style, className: "bg-[#08111F]/70 border border-white/10 text-[#E0F2FE] px-2.5 py-1 rounded-full text-xs font-bold" }, style === "其他(自由填寫)" && selectedVTuber.creatorOtherStyleText ? selectedVTuber.creatorOtherStyleText : style))))),
                                        React.createElement("div", { className: "flex-shrink-0" }, selectedVTuber.creatorPortfolioUrl ? (React.createElement("button", { onClick: () => window.open(sanitizeUrl(/^https?:\/\//i.test(selectedVTuber.creatorPortfolioUrl) ? selectedVTuber.creatorPortfolioUrl : "https://" + selectedVTuber.creatorPortfolioUrl), "_blank", "noopener,noreferrer"), className: "w-full lg:w-auto inline-flex items-center justify-center gap-2 bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#0F111A] px-6 py-3 rounded-xl font-black text-sm transition-colors shadow-lg shadow-[#38BDF8]/20" },
                                            React.createElement("i", { className: "fa-solid fa-images" }),
                                            " \u89C0\u770B\u4F5C\u54C1\u96C6")) : (React.createElement("p", { className: "text-sm text-[#BAE6FD] bg-[#08111F]/60 border border-white/10 rounded-xl px-4 py-3" }, "\u5C1A\u672A\u63D0\u4F9B\u4F5C\u54C1\u96C6\u9023\u7D50\uFF0C\u53EF\u5148\u7528\u7AD9\u5167\u79C1\u8A0A\u8A62\u554F\u59D4\u8A17\u8CC7\u8A0A\u3002"))))))))))),
                currentView === "bulletin" && (React.createElement("div", { className: "max-w-5xl mx-auto px-4 py-8 animate-fade-in-up" },
                    React.createElement("div", { className: "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8" },
                        React.createElement("div", null,
                            React.createElement("h2", { className: "vnexus-bulletin-page-title text-4xl sm:text-5xl font-extrabold text-white flex items-center gap-3 leading-tight" },
                                React.createElement("i", { className: "fa-solid fa-bullhorn text-[#A78BFA]" }),
                                "\u63EA\u5718\u4F48\u544A\u6B04"),
                            React.createElement("p", { className: "text-[#94A3B8] mt-2 text-xs sm:text-sm leading-relaxed max-w-3xl" },
                                "\u767C\u5E03\u63EA\u5718\u3001\u627E\u5408\u9069\u7684\u806F\u52D5\u5925\u4F34\u3002",
                                React.createElement("span", { className: "text-[#F59E0B] font-bold ml-2" }, "\u63EA\u5718\u622A\u6B62\u524D\uFF0C\u8ACB\u5230\u4FE1\u7BB1\u767C\u9001\u6B63\u5F0F\u9080\u8ACB\u624D\u7B97\u6210\u529F\u3002"))),
                        React.createElement("div", { className: "flex flex-row flex-wrap sm:flex-nowrap gap-3 w-full sm:w-auto" },
                            React.createElement("button", { onClick: () => {
                                    if (!isBulletinFormOpen) {
                                        setNewBulletin({
                                            id: null,
                                            content: "",
                                            collabType: "",
                                            collabTypeOther: "",
                                            collabSize: "",
                                            collabTime: "",
                                            recruitEndTime: "",
                                            image: "",
                                        });
                                    }
                                    setIsBulletinFormOpen(!isBulletinFormOpen);
                                }, className: `${isBulletinFormOpen ? "bg-[#1D2130]" : "bg-[#8B5CF6] hover:bg-[#7C3AED]"} text-white px-3 sm:px-6 py-3 rounded-xl font-bold shadow-sm flex items-center justify-center transition-colors whitespace-nowrap text-sm sm:text-base` },
                                React.createElement("i", { className: `fa-solid ${isBulletinFormOpen ? "fa-chevron-up" : "fa-pen-nib"} mr-2` }),
                                isBulletinFormOpen ? "收起揪團" : "我要揪團"),
                            React.createElement("button", { onClick: () => navigate("collabs"), className: "bg-[#EF4444] hover:bg-[#DC2626] text-white px-3 sm:px-6 py-3 rounded-xl font-bold shadow-sm flex items-center justify-center transition-colors whitespace-nowrap text-sm sm:text-base" },
                                React.createElement("i", { className: "fa-solid fa-calendar-check mr-2" }),
                                "\u78BA\u5B9A\u806F\u52D5\u8868"),
                            React.createElement("button", { type: "button", onClick: () => setIsLeaderboardModalOpen(true), className: "sm:hidden bg-[#F59E0B] hover:bg-[#FBBF24] text-[#0F111A] px-3 py-3 rounded-xl font-black shadow-sm flex items-center justify-center transition-colors whitespace-nowrap", "aria-label": "\u958B\u555F\u63EA\u5718\u6392\u884C\u699C" },
                                React.createElement("i", { className: "fa-solid fa-trophy mr-1.5" }),
                                "\u6392\u884C\u699C"))),
                    React.createElement("button", { type: "button", onClick: () => setIsLeaderboardModalOpen(true), className: "hidden sm:block w-full mb-8 bg-gradient-to-r from-[#422006] via-[#78350F] to-[#422006] border border-[#F59E0B]/45 rounded-2xl p-4 sm:p-5 text-left hover:border-[#F59E0B] hover:shadow-lg hover:shadow-[#F59E0B]/10 transition-all group", "aria-label": "\u958B\u555F\u63EA\u5718\u6392\u884C\u699C" },
                        React.createElement("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between gap-4" },
                            React.createElement("div", { className: "flex items-center gap-4 min-w-0" },
                                React.createElement("div", { className: "w-12 h-12 rounded-2xl bg-[#F59E0B] text-[#0F111A] flex items-center justify-center shadow-sm flex-shrink-0" },
                                    React.createElement("i", { className: "fa-solid fa-trophy text-xl" })),
                                React.createElement("div", { className: "min-w-0" },
                                    React.createElement("p", { className: "text-white text-lg font-black flex items-center gap-2" },
                                        "\u63EA\u5718\u6392\u884C\u699C ",
                                        React.createElement("span", { className: "text-xs bg-black/25 text-[#FDE68A] px-2 py-0.5 rounded-full border border-[#F59E0B]/30" }, "TOP \u6392\u884C")),
                                    React.createElement("p", { className: "text-[#FDE68A] text-sm mt-1 line-clamp-2" }, "\u770B\u770B\u76EE\u524D\u6210\u529F\u4FC3\u6210\u6700\u591A\u806F\u52D5\u7684\u5275\u4F5C\u8005\uFF0C\u9EDE\u64CA\u5373\u53EF\u67E5\u770B\u5B8C\u6574\u6392\u884C\u3002"))),
                            React.createElement("div", { className: "flex items-center justify-between md:justify-end gap-3 flex-shrink-0" },
                                React.createElement("div", { className: "flex -space-x-2" },
                                    leaderboardData.slice(0, 3).map((vt, idx) => (React.createElement("button", { key: vt.id || idx, type: "button", onClick: (e) => { e.stopPropagation(); setSelectedVTuber(vt); navigate(`profile/${vt.id}`); }, className: "rounded-full hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-[#F59E0B]", title: `查看 ${vt.name || "排行榜創作者"} 的名片`, "aria-label": `查看 ${vt.name || "排行榜創作者"} 的名片` },
                                        React.createElement("img", { src: sanitizeUrl(vt.avatar), alt: vt.name || "排行榜創作者", className: "w-9 h-9 rounded-full object-cover border-2 border-[#422006] bg-[#11131C]" })))),
                                    leaderboardData.length === 0 && React.createElement("span", { className: "text-xs text-[#FDE68A]/80 font-bold px-3 py-2 rounded-full bg-black/20 border border-[#F59E0B]/20" }, "\u7B49\u5F85\u7B2C\u4E00\u4F4D\u4E0A\u699C")),
                                React.createElement("span", { className: "inline-flex items-center gap-2 bg-[#F59E0B] text-[#0F111A] px-4 py-2.5 rounded-xl font-black group-hover:bg-[#FBBF24] transition-colors whitespace-nowrap" },
                                    "\u67E5\u770B\u6392\u884C\u699C ",
                                    React.createElement("i", { className: "fa-solid fa-arrow-right" }))))),
                    isBulletinFormOpen && (React.createElement("div", { id: "bulletin-form", className: "bg-[#181B25]/40 border border-[#2A2F3D] rounded-2xl p-6 sm:p-8 shadow-sm mb-10 animate-fade-in-up" },
                        React.createElement("div", { className: "flex justify-between items-center mb-6 border-b border-[#2A2F3D] pb-3" },
                            React.createElement("h3", { className: "text-xl font-bold text-white" }, newBulletin.id ? "編輯揪團文" : "發布新揪團"),
                            React.createElement("button", { onClick: () => setIsBulletinFormOpen(false), className: "text-[#64748B] hover:text-white" },
                                React.createElement("i", { className: "fa-solid fa-xmark" }))),
                        React.createElement("div", { className: "space-y-6" },
                            React.createElement("div", null,
                                React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" },
                                    "\u63EA\u5718\u5167\u5BB9\u8AAA\u660E ",
                                    React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                                React.createElement("textarea", { required: true, rows: "4", placeholder: "\u8ACB\u63CF\u8FF0\u60A8\u7684\u806F\u52D5\u4F01\u5283\u5167\u5BB9\u3001\u5E0C\u671B\u7684\u5C0D\u8C61\u689D\u4EF6...", value: newBulletin.content, onChange: (e) => setNewBulletin({
                                        ...newBulletin,
                                        content: e.target.value,
                                    }), className: inputCls + " resize-none" })),
                            React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-6 gap-5" },
                                React.createElement("div", { className: "md:col-span-1" },
                                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" },
                                        "\u806F\u52D5\u985E\u578B ",
                                        React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                                    React.createElement("select", { value: newBulletin.collabType, onChange: (e) => setNewBulletin({
                                            ...newBulletin,
                                            collabType: e.target.value,
                                        }), className: inputCls },
                                        React.createElement("option", { value: "" }, "\u8ACB\u9078\u64C7"),
                                        PREDEFINED_COLLABS.map((t) => (React.createElement("option", { key: t, value: t }, t))),
                                        React.createElement("option", { value: "\u5176\u4ED6" }, "\u5176\u4ED6 (\u81EA\u884C\u8F38\u5165)")),
                                    newBulletin.collabType === "其他" && (React.createElement("input", { type: "text", placeholder: "\u8ACB\u8F38\u5165\u985E\u578B", value: newBulletin.collabTypeOther, onChange: (e) => setNewBulletin({
                                            ...newBulletin,
                                            collabTypeOther: e.target.value,
                                        }), className: inputCls + " mt-2" }))),
                                React.createElement("div", { className: "md:col-span-1" },
                                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" },
                                        "\u9810\u4F30\u4EBA\u6578 ",
                                        React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                                    React.createElement("select", { value: newBulletin.collabSize, onChange: (e) => setNewBulletin({
                                            ...newBulletin,
                                            collabSize: e.target.value,
                                        }), className: inputCls },
                                        React.createElement("option", { value: "" }, "\u8ACB\u9078\u64C7"),
                                        Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (React.createElement("option", { key: n, value: `${n}人` },
                                            n,
                                            "\u4EBA"))))),
                                React.createElement("div", { className: "md:col-span-2" },
                                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" },
                                        "\u9810\u8A08\u806F\u52D5\u6642\u9593 ",
                                        React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                                    React.createElement(DateTimePicker, { value: newBulletin.collabTime, onChange: (val) => setNewBulletin({
                                            ...newBulletin,
                                            collabTime: val,
                                        }), className: inputCls })),
                                React.createElement("div", { className: "md:col-span-2" },
                                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" },
                                        "\u63EA\u5718\u622A\u6B62\u6642\u9593 ",
                                        React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                                    React.createElement(DateTimePicker, { value: newBulletin.recruitEndTime, onChange: (val) => setNewBulletin({
                                            ...newBulletin,
                                            recruitEndTime: val,
                                        }), className: inputCls }))),
                            React.createElement("div", { className: "flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2 mt-2" },
                                React.createElement("div", { className: "flex-1 min-w-0" },
                                    React.createElement("label", { className: "block text-sm font-bold text-[#CBD5E1] mb-2" },
                                        "\u9078\u64C7\u9810\u8A2D\u5716 \u6216 \u81EA\u884C\u4E0A\u50B3",
                                        " ",
                                        React.createElement("span", { className: "text-[#EF4444]" }, "* (\u5FC5\u9078)")),
                                    React.createElement("div", { className: "flex flex-col gap-3" },
                                        defaultBulletinImages.length > 0 && (React.createElement("div", { className: "flex gap-3 overflow-x-auto pb-2 custom-scrollbar items-center" }, defaultBulletinImages.map((img, idx) => (React.createElement("img", { key: idx, src: sanitizeUrl(img), onClick: () => setNewBulletin((p) => ({ ...p, image: img })), className: `w-28 h-16 rounded-lg object-cover cursor-pointer border transition-all flex-shrink-0 ${newBulletin.image === img ? "border-[#8B5CF6] scale-105 shadow-sm opacity-100" : "border-transparent hover:border-gray-500 opacity-50 hover:opacity-100"}`, title: "\u9EDE\u64CA\u5957\u7528\u6B64\u9810\u8A2D\u5716" }))))),
                                        React.createElement("div", { className: "flex gap-3 items-center" },
                                            newBulletin.image &&
                                                !defaultBulletinImages.includes(newBulletin.image) && (React.createElement("div", { className: "relative" },
                                                React.createElement("img", { src: sanitizeUrl(newBulletin.image), className: "w-12 h-12 rounded-lg object-cover border border-[#2A2F3D]" }),
                                                React.createElement("button", { type: "button", onClick: () => setNewBulletin((p) => ({ ...p, image: "" })), className: "absolute -top-2 -right-2 bg-[#EF4444] text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]" },
                                                    React.createElement("i", { className: "fa-solid fa-xmark" })))),
                                            React.createElement("div", { className: "relative w-full sm:w-auto flex-shrink-0" },
                                                React.createElement("input", { type: "file", accept: "image/png, image/jpeg, image/webp", onChange: handleBulletinImageUpload, className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" }),
                                                React.createElement("button", { type: "button", className: "w-full sm:w-auto px-4 bg-[#181B25] hover:bg-[#1D2130] text-[#CBD5E1] text-sm py-2 rounded-xl border border-[#2A2F3D] transition-colors flex items-center justify-center gap-2" },
                                                    React.createElement("i", { className: "fa-solid fa-cloud-arrow-up" }),
                                                    " ",
                                                    "\u81EA\u884C\u4E0A\u50B3\u5716\u7247")),
                                            newBulletin.image && (React.createElement("button", { type: "button", onClick: () => setNewBulletin((p) => ({ ...p, image: "" })), className: "text-xs text-[#EF4444] hover:text-red-300 border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 rounded-lg font-bold transition-colors" }, "\u53D6\u6D88\u9078\u53D6\u5716\u7247"))))),
                                React.createElement("div", { className: "flex gap-3" },
                                    React.createElement("button", { onClick: () => setIsBulletinFormOpen(false), className: "px-6 py-3 text-[#94A3B8] hover:text-white font-bold" }, "\u53D6\u6D88"),
                                    React.createElement("button", { onClick: handlePostBulletin, className: "bg-[#8B5CF6] hover:bg-[#8B5CF6] text-white px-8 py-3 rounded-xl font-bold shadow-sm transition-transform h-fit whitespace-nowrap" }, newBulletin.id ? "儲存修改" : "發布揪團")))))),
                    React.createElement("div", { className: "flex gap-2 overflow-x-auto pb-4 mb-6 border-b border-[#2A2F3D]" },
                        React.createElement("button", { onClick: () => setBulletinFilter("All"), className: `px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${bulletinFilter === "All" ? "bg-[#8B5CF6] text-white shadow-sm" : "bg-[#181B25] text-[#94A3B8] hover:bg-[#1D2130]"}` }, "\u5168\u90E8\u63EA\u5718"),
                        activeBulletinTypes.map((t) => (React.createElement("button", { key: t, onClick: () => setBulletinFilter(t), className: `px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${bulletinFilter === t ? "bg-[#8B5CF6] text-white shadow-sm" : "bg-[#181B25] text-[#94A3B8] hover:bg-[#1D2130]"}` }, t)))),
                    isLoadingActivities ? (React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6" }, [1, 2, 3, 4].map((n) => (React.createElement(BulletinSkeleton, { key: n }))))) : filteredDisplayBulletins.length === 0 ? (React.createElement("p", { className: "text-center text-[#64748B] mt-20" }, "\u9084\u6C92\u6709\u76F8\u95DC\u63EA\u5718\u3002\u60F3\u627E\u540C\u597D\u4E00\u8D77\u73A9\uFF0C\u5C31\u5148\u767C\u8D77\u4E00\u500B\u4F01\u5283\u5427\u3002")) : (React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6" }, filteredDisplayBulletins.map((b) => (React.createElement(BulletinCard, { key: b.id, b: b, user: user, isVerifiedUser: isVerifiedUser, onNavigateProfile: (vtuber, isFromApplicants) => {
                            if (vtuber && vtuber.id) {
                                if (isFromApplicants)
                                    setOpenBulletinModalId(b.id);
                                else
                                    setOpenBulletinModalId(null);
                                setSelectedVTuber(vtuber);
                                navigate(`profile/${vtuber.id}`);
                            }
                            else {
                                showToast("找不到該名片！");
                            }
                        }, onApply: (id, isApplying) => handleApplyBulletin(id, isApplying, b.userId), onInvite: handleOpenCollabModal, onDeleteBulletin: handleDeleteBulletin, onEditBulletin: handleEditBulletin, openModalId: openBulletinModalId, onClearOpenModalId: () => setOpenBulletinModalId(null), currentView: currentView }))))))),
                currentView === "collabs" && (React.createElement("div", { className: "max-w-5xl mx-auto px-4 py-8 animate-fade-in-up" },
                    React.createElement("div", { className: "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-[#2A2F3D] pb-4" },
                        React.createElement("h2", { className: "text-3xl font-extrabold text-white flex items-center gap-3" },
                            React.createElement("i", { className: "fa-solid fa-broadcast-tower text-[#EF4444]" }),
                            " ",
                            "\u78BA\u5B9A\u806F\u52D5\u8868"),
                        React.createElement("div", { className: "flex flex-row flex-wrap gap-3 w-full sm:w-auto" },
                            React.createElement("button", { onClick: () => navigate("bulletin"), className: "bg-[#1D2130] hover:bg-[#2A2F3D] text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-colors" },
                                React.createElement("i", { className: "fa-solid fa-arrow-left mr-2" }),
                                "\u8FD4\u56DE\u63EA\u5718\u4F48\u544A\u6B04"),
                            isVerifiedUser && (React.createElement("button", { onClick: () => {
                                    document
                                        .getElementById("public-collab-form")
                                        ?.classList.toggle("hidden");
                                }, className: "bg-[#EF4444] hover:bg-[#EF4444] text-white px-6 py-2.5 rounded-xl font-bold shadow-sm transition-transform" },
                                React.createElement("i", { className: "fa-solid fa-plus mr-2" }),
                                "\u767C\u5E03\u806F\u52D5")))),
                    isVerifiedUser && (React.createElement("div", { id: "public-collab-form", className: "hidden bg-[#181B25]/40 border border-[#2A2F3D] rounded-2xl p-6 sm:p-8 shadow-sm mb-10 animate-fade-in-up" },
                        React.createElement("h3", { className: "text-xl font-bold text-white mb-6 border-b border-[#2A2F3D] pb-3" }, "\u767C\u5E03\u65B0\u7684\u806F\u52D5\u884C\u7A0B"),
                        React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6 mb-4" },
                            React.createElement("div", null,
                                React.createElement("label", { className: "text-sm font-bold text-[#CBD5E1] mb-2 block" },
                                    "\u806F\u52D5\u985E\u5225 ",
                                    React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                                React.createElement("select", { value: publicCollabForm.category, onChange: (e) => setPublicCollabForm({
                                        ...publicCollabForm,
                                        category: e.target.value,
                                    }), className: inputCls }, COLLAB_CATEGORIES.map((c) => (React.createElement("option", { key: c, value: c }, c))))),
                            React.createElement("div", null,
                                React.createElement("label", { className: "text-sm font-bold text-[#CBD5E1] mb-2 block" },
                                    "\u806F\u52D5\u6642\u9593 ",
                                    React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                                React.createElement(DateTimePicker, { value: publicCollabForm.dateTime, onChange: (val) => setPublicCollabForm({
                                        ...publicCollabForm,
                                        dateTime: val,
                                    }), className: inputCls })),
                            React.createElement("div", { className: "relative" },
                                React.createElement("label", { className: "text-sm font-bold text-[#CBD5E1] mb-2 block" },
                                    "\u76F4\u64AD\u9023\u7D50 (\u53EF\u81EA\u52D5\u6293\u5716)",
                                    " ",
                                    React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                                React.createElement("div", { className: "flex gap-2" },
                                    React.createElement("input", { type: "url", placeholder: "https://...", value: publicCollabForm.streamUrl, onChange: (e) => setPublicCollabForm({
                                            ...publicCollabForm,
                                            streamUrl: e.target.value,
                                        }), className: inputCls }),
                                    React.createElement("button", { type: "button", onClick: () => autoFetchYouTubeInfo(publicCollabForm.streamUrl, (t) => setPublicCollabForm((p) => ({ ...p, title: t })), (c) => setPublicCollabForm((p) => ({
                                            ...p,
                                            coverUrl: c,
                                        })), showToast), className: "bg-[#1D2130] hover:bg-[#2A2F3D] text-white px-4 rounded-xl text-xs font-bold transition-colors" },
                                        React.createElement("i", { className: "fa-solid fa-wand-magic-sparkles" }))))),
                        React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6" },
                            React.createElement("div", null,
                                React.createElement("label", { className: "text-sm font-bold text-[#CBD5E1] mb-2 block" },
                                    "\u806F\u52D5\u6A19\u984C ",
                                    React.createElement("span", { className: "text-[#EF4444]" }, "*")),
                                React.createElement("input", { type: "text", placeholder: "\u8F38\u5165\u6A19\u984C...", value: publicCollabForm.title, onChange: (e) => setPublicCollabForm({
                                        ...publicCollabForm,
                                        title: e.target.value,
                                    }), className: inputCls })),
                            React.createElement("div", null,
                                React.createElement("label", { className: "text-sm font-bold text-[#CBD5E1] mb-2 block" }, "\u5C01\u9762\u5716\u7DB2\u5740"),
                                React.createElement("input", { type: "url", placeholder: "\u81EA\u8A02\u5C01\u9762\u5716 (\u9078\u586B)...", value: publicCollabForm.coverUrl, onChange: (e) => setPublicCollabForm({
                                        ...publicCollabForm,
                                        coverUrl: e.target.value,
                                    }), className: inputCls }))),
                        React.createElement("div", { className: "bg-[#0F111A]/80 p-4 rounded-2xl border border-white/10 mb-6" },
                            React.createElement("label", { className: "block text-sm font-bold text-[#A78BFA] mb-3" },
                                React.createElement("i", { className: "fa-solid fa-users-plus mr-2" }),
                                " \u52A0\u5165\u806F\u52D5\u6210\u54E1 (\u203B\u52A0\u5165\u6210\u54E1\uFF0C\u6210\u54E1\u5C07\u6703\u5728\u806F\u52D524\u5C0F\u6642\u524D\u88AB\u7CFB\u7D71\u81EA\u52D5\u767C\u4FE1\u63D0\u9192\uFF0C\u529F\u80FD\u8D85\u5BE6\u7528\u771F\u7684\u8981\u586B\u4E00\u4E0B\u3002)"),
                            React.createElement("div", { className: "flex flex-wrap gap-2 mb-3" }, (publicCollabForm.participants || []).map((uid) => {
                                const vt = realVtubers.find((v) => v.id === uid);
                                return vt ? (React.createElement("div", { key: uid, className: "flex items-center gap-2 bg-[#8B5CF6]/20 border border-white/10 px-2 py-1 rounded-lg" },
                                    React.createElement("img", { src: sanitizeUrl(vt.avatar), className: "w-5 h-5 rounded-full object-cover" }),
                                    React.createElement("span", { className: "text-xs text-white font-bold" }, vt.name),
                                    React.createElement("button", { type: "button", onClick: () => setPublicCollabForm((p) => ({
                                            ...p,
                                            participants: p.participants.filter((id) => id !== uid),
                                        })), className: "text-[#EF4444] hover:text-red-300" },
                                        React.createElement("i", { className: "fa-solid fa-xmark" })))) : null;
                            })),
                            React.createElement("div", { className: "relative" },
                                React.createElement("input", { type: "text", placeholder: "\u8F38\u5165\u6210\u54E1\u540D\u7A31\u641C\u5C0B...", value: pSearch, onChange: (e) => setPSearch(e.target.value), className: inputCls + " !bg-[#181B25]" }),
                                pSearch && (React.createElement("div", { className: "absolute z-50 w-full mt-1 bg-[#181B25] border border-[#2A2F3D] rounded-xl shadow-sm max-h-40 overflow-y-auto" }, realVtubers
                                    .filter((v) => v.isVerified &&
                                    (v.name || "")
                                        .toLowerCase()
                                        .includes(pSearch.toLowerCase()) &&
                                    !(publicCollabForm.participants || []).includes(v.id) &&
                                    v.id !== user?.uid)
                                    .map((v) => (React.createElement("div", { key: v.id, onClick: () => {
                                        setPublicCollabForm((p) => ({
                                            ...p,
                                            participants: [
                                                ...(p.participants || []),
                                                v.id,
                                            ],
                                        }));
                                        setPSearch("");
                                    }, className: "flex items-center gap-3 p-2 hover:bg-[#8B5CF6]/20 cursor-pointer border-b border-[#2A2F3D] last:border-0" },
                                    React.createElement("img", { src: sanitizeUrl(v.avatar), className: "w-8 h-8 rounded-full object-cover" }),
                                    React.createElement("span", { className: "text-sm text-white" }, v.name)))))))),
                        React.createElement("div", { className: "flex justify-end" },
                            React.createElement("button", { onClick: async () => {
                                    if (!publicCollabForm.dateTime ||
                                        !publicCollabForm.streamUrl ||
                                        !publicCollabForm.title)
                                        return showToast("請完整填寫必填欄位！");
                                    const dt = new Date(publicCollabForm.dateTime);
                                    if (dt.getTime() < Date.now())
                                        return showToast("聯動時間不能在過去哦！");
                                    const newCollabData = {
                                        ...publicCollabForm,
                                        date: `${dt.getMonth() + 1}/${dt.getDate()} (${["日", "一", "二", "三", "四", "五", "六"][dt.getDay()]})`,
                                        time: `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`,
                                        startTimestamp: dt.getTime(),
                                        reminderSent: false,
                                    };
                                    try {
                                        showToast("⏳ 正在發布...");
                                        const docRef = await addDoc(collection(db, getPath("collabs")), {
                                            ...newCollabData,
                                            userId: user.uid,
                                            createdAt: Date.now(),
                                        });
                                        // 發送通知給參與者 (保持原樣)
                                        publicCollabForm.participants.forEach(async (pId) => {
                                            const target = realVtubers.find((v) => v.id === pId);
                                            if (!target)
                                                return;
                                            await addDoc(collection(db, getPath("notifications")), {
                                                userId: pId,
                                                fromUserId: user.uid,
                                                fromUserName: myProfile?.name || "系統",
                                                fromUserAvatar: myProfile?.avatar,
                                                message: `您已被加入聯動行程：【${publicCollabForm.title}】！`,
                                                type: "collab_added",
                                                createdAt: Date.now(),
                                                read: false,
                                            });
                                        });
                                        // ✨ 修正重點：同時更新狀態與快取
                                        const finalizedItem = {
                                            id: docRef.id,
                                            ...newCollabData,
                                            userId: user.uid,
                                        };
                                        setRealCollabs((prev) => {
                                            const newList = [...prev, finalizedItem];
                                            syncCollabCache(newList); // ✨ 確保存入 localStorage
                                            return newList;
                                        });
                                        showToast("✅ 已成功發布聯動行程！");
                                        setPublicCollabForm({
                                            dateTime: "",
                                            title: "",
                                            streamUrl: "",
                                            coverUrl: "",
                                            category: "遊戲",
                                            participants: [],
                                        });
                                        document
                                            .getElementById("public-collab-form")
                                            .classList.add("hidden");
                                    }
                                    catch (err) {
                                        console.error(err);
                                        showToast("❌ 發布失敗");
                                    }
                                }, className: "bg-[#EF4444] hover:bg-[#EF4444] text-white px-8 py-3 rounded-xl font-bold shadow-sm transition-transform" }, "\u9001\u51FA\u767C\u5E03")))),
                    React.createElement("div", { className: "flex gap-4 mb-8" }, ["All", ...COLLAB_CATEGORIES].map((cat) => (React.createElement("button", { key: cat, onClick: () => setCollabCategoryTab(cat), className: `px-5 py-2 rounded-full font-bold text-sm transition-all ${collabCategoryTab === cat ? "bg-[#EF4444] text-white shadow-sm" : "bg-[#181B25] text-[#94A3B8] hover:text-white"}` }, cat === "All" ? "全部" : cat)))),
                    filteredDisplayCollabs.length === 0 ? (React.createElement("div", { className: "text-center py-20 bg-[#181B25]/30 rounded-2xl border border-[#2A2F3D]" },
                        React.createElement("p", { className: "text-[#64748B] font-bold text-lg" },
                            React.createElement("i", { className: "fa-solid fa-ghost mb-4 text-4xl block" }),
                            "\u9084\u6C92\u6709\u5373\u5C07\u516C\u958B\u7684\u806F\u52D5\u884C\u7A0B"))) : (React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8" }, filteredDisplayCollabs.map((c) => (React.createElement(CollabCard, { key: c.id, c: c, isLive: c.startTimestamp &&
                            currentTime >= c.startTimestamp &&
                            currentTime <= c.startTimestamp + 2 * 60 * 60 * 1000, isAdmin: isAdmin, user: user, onDeleteCollab: handleDeleteCollab, vtuber: realVtubers.find((v) => v.id === c.userId), realVtubers: realVtubers, onShowParticipants: (collab) => setViewParticipantsCollab(collab), onNavigateProfile: (vt) => {
                            setSelectedVTuber(vt);
                            navigate(`profile/${vt.id}`);
                        } }))))))),
                currentView === "status_wall" && (() => {
                    const now = Date.now();
                    const hasValidStoryStatus = (v) => {
                        if (!v?.statusMessage || !v?.statusMessageUpdatedAt)
                            return false;
                        const isLiveMsg = String(v.statusMessage || "").includes('🔴');
                        const expireLimit = isLiveMsg ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
                        return now - Number(v.statusMessageUpdatedAt || 0) < expireLimit;
                    };
                    const isStoryEligibleProfile = (v) => v.isVerified && !v.isBlacklisted && v.activityStatus !== "sleep" && v.activityStatus !== "graduated" && !String(v.id || "").startsWith("mock");
                    const activeStoryUsers = [...realVtubers]
                        .filter((v) => isStoryEligibleProfile(v) && hasValidStoryStatus(v))
                        .sort((a, b) => Number(b.statusMessageUpdatedAt || 0) - Number(a.statusMessageUpdatedAt || 0));
                    const unreadStoryUsers = activeStoryUsers.filter((v) => !isStatusStoryViewed(v));
                    const viewedStoryUsers = activeStoryUsers.filter((v) => isStatusStoryViewed(v));
                    const activeStoryIds = new Set(activeStoryUsers.map((v) => v.id));
                    const recentlyUpdatedUsers = [...realVtubers]
                        .filter((v) => isStoryEligibleProfile(v) && !activeStoryIds.has(v.id) && (v.updatedAt || v.createdAt || v.submittedAt))
                        .sort((a, b) => Number(b.updatedAt || b.createdAt || b.submittedAt || 0) - Number(a.updatedAt || a.createdAt || a.submittedAt || 0));
                    const storyRingUsers = [...unreadStoryUsers, ...viewedStoryUsers, ...recentlyUpdatedUsers].slice(0, 24);
                    return (React.createElement("div", { className: "max-w-3xl mx-auto px-4 py-6 animate-fade-in-up" },
                        React.createElement("div", { className: "mb-4 rounded-2xl border border-[#2A2F3D] bg-[#181B25]/70 px-4 py-3 flex items-center justify-between gap-3" },
                            React.createElement("div", { className: "min-w-0" },
                                React.createElement("h2", { className: "text-lg sm:text-xl font-black text-white flex items-center gap-2" },
                                    React.createElement("i", { className: "fa-solid fa-bolt text-[#F59E0B]" }),
                                    " 24H \u52D5\u614B\u7246"),
                                React.createElement("p", { className: "text-[#94A3B8] text-xs mt-1 leading-relaxed max-w-xl" }, "\u770B\u770B\u8AB0\u6B63\u5728\u76F4\u64AD\u3001\u60F3\u63EA\u5718\u3001\u627E\u4EBA\u804A\u5929\u6216\u5206\u4EAB\u8FD1\u6CC1\u3002\u9EDE\u982D\u50CF\u5C31\u80FD\u5FEB\u901F\u9032\u5165\u5C0D\u65B9\u8CC7\u6599\u9032\u884C\u79C1\u8A0A\u4E92\u52D5\u3002"))),
                        React.createElement("div", { className: "mb-4 bg-[#181B25]/80 border border-[#2A2F3D] rounded-2xl px-4 py-3" },
                            React.createElement("div", { className: "flex gap-4 overflow-x-auto pb-1 vnexus-drag-scroll", onMouseDown: (e) => {
                                    const el = e.currentTarget;
                                    el.dataset.dragging = "1";
                                    el.dataset.dragStartX = String(e.pageX);
                                    el.dataset.dragScrollLeft = String(el.scrollLeft);
                                    el.dataset.dragMoved = "0";
                                    el.classList.add("is-dragging");
                                }, onMouseMove: (e) => {
                                    const el = e.currentTarget;
                                    if (el.dataset.dragging !== "1")
                                        return;
                                    e.preventDefault();
                                    const startX = Number(el.dataset.dragStartX || 0);
                                    const startLeft = Number(el.dataset.dragScrollLeft || 0);
                                    const delta = e.pageX - startX;
                                    if (Math.abs(delta) > 4)
                                        el.dataset.dragMoved = "1";
                                    el.scrollLeft = startLeft - delta;
                                }, onMouseUp: (e) => {
                                    const el = e.currentTarget;
                                    el.dataset.dragging = "0";
                                    el.classList.remove("is-dragging");
                                }, onMouseLeave: (e) => {
                                    const el = e.currentTarget;
                                    el.dataset.dragging = "0";
                                    el.classList.remove("is-dragging");
                                }, onClickCapture: (e) => {
                                    const el = e.currentTarget;
                                    if (el.dataset.dragMoved === "1") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        el.dataset.dragMoved = "0";
                                    }
                                } }, storyRingUsers.length === 0 ? (React.createElement("div", { className: "flex items-center text-[#94A3B8] text-sm py-3" }, "\u76EE\u524D\u9084\u6C92\u6709\u8FD1\u671F\u66F4\u65B0\u7684\u5275\u4F5C\u8005\u3002")) : (storyRingUsers.map((v) => {
                                const hasActiveStory = activeStoryIds.has(v.id);
                                const storyViewed = hasActiveStory && isStatusStoryViewed(v);
                                const isLiveMsg = hasActiveStory && String(v.statusMessage || "").includes('🔴');
                                const ringClass = hasActiveStory && !storyViewed
                                    ? (isLiveMsg ? 'bg-[#EF4444]' : 'bg-[#F59E0B]')
                                    : 'bg-transparent border border-[#2A2F3D]';
                                const titleText = hasActiveStory
                                    ? (storyViewed ? `${v.name || '創作者'} 的動態已看過` : String(v.statusMessage || ''))
                                    : `${v.name || '創作者'} 最近更新了名片資料`;
                                return (React.createElement("button", { key: `story-ring-${v.id}`, onClick: () => { if (hasActiveStory)
                                        markStatusStoryViewed(v); setSelectedVTuber(v); navigate(`profile/${v.id}`); }, className: "flex-shrink-0 w-16 text-center group", title: titleText },
                                    React.createElement("div", { className: `w-14 h-14 mx-auto rounded-full p-[2px] ${ringClass}` },
                                        React.createElement("div", { className: "w-full h-full rounded-full bg-[#11131C] p-[2px]" },
                                            React.createElement("img", { src: sanitizeUrl(v.avatar), className: "w-full h-full rounded-full object-cover", onError: (e) => setImageToGrayPlaceholder(e.currentTarget) }))),
                                    React.createElement("p", { className: `text-[10px] text-[#F8FAFC] mt-1.5 truncate transition-colors ${hasActiveStory ? 'group-hover:text-[#F59E0B]' : 'group-hover:text-[#CBD5E1]'}` }, v.name)));
                            })))),
                        isVerifiedUser && myProfile && (React.createElement("div", { className: "mb-4 bg-[#181B25]/55 border-y sm:border border-[#2A2F3D] sm:rounded-2xl px-4 sm:px-5 py-4" },
                            React.createElement("form", { onSubmit: async (e) => {
                                    const willPost = storyInput.trim();
                                    await handlePostStory(e);
                                    if (willPost)
                                        setStoryInput("");
                                }, className: "flex items-start gap-3" },
                                React.createElement("button", { type: "button", onClick: () => { setSelectedVTuber(myProfile); navigate(`profile/${myProfile.id || user?.uid}`); }, className: "flex-shrink-0 mt-0.5", title: "\u67E5\u770B\u6211\u7684\u540D\u7247" },
                                    React.createElement("img", { src: sanitizeUrl(myProfile.avatar), className: "w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border border-[#2A2F3D]", onError: (e) => setImageToGrayPlaceholder(e.currentTarget) })),
                                React.createElement("div", { className: "min-w-0 flex-1" },
                                    React.createElement("textarea", { id: "status-wall-inline-input", maxLength: "40", rows: "1", value: storyInput, onChange: (e) => setStoryInput(e.target.value), className: "w-full bg-transparent border-0 outline-none resize-none text-white placeholder:text-[#64748B] text-[16px] leading-relaxed min-h-[42px] py-2", placeholder: "\u73FE\u5728\u60F3\u627E\u4EBA\u505A\u4EC0\u9EBC\uFF1F" }),
                                    React.createElement("div", { className: "flex items-center justify-between gap-3 pt-2 border-t border-[#2A2F3D]/70" },
                                        React.createElement("span", { className: `text-[10px] ${storyInput.length >= 40 ? 'text-[#EF4444] font-bold' : 'text-[#64748B]'}` },
                                            storyInput.length,
                                            " / 40"),
                                        React.createElement("div", { className: "flex items-center gap-2 flex-shrink-0" },
                                            React.createElement("button", { type: "submit", disabled: !storyInput.trim(), className: `h-8 px-3 rounded-full text-xs font-black transition-colors inline-flex items-center gap-1.5 ${storyInput.trim() ? 'bg-[#F59E0B] hover:bg-[#D97706] text-[#0F111A]' : 'bg-[#1D2130] text-[#64748B] cursor-not-allowed'}` }, "\u767C\u5E03"),
                                            React.createElement("button", { type: "button", onClick: async (e) => { await handlePostStory(e, "🔴 我在直播中！快來找我玩！", true); }, className: "h-8 px-3 rounded-full bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#FCA5A5] border border-[#EF4444]/25 text-xs font-black transition-colors inline-flex items-center gap-1.5" },
                                                React.createElement("i", { className: "fa-solid fa-satellite-dish text-[10px]" }),
                                                " \u76F4\u64AD"))))))),
                        !isVerifiedUser && (React.createElement("div", { className: "mb-4 bg-[#181B25]/45 border border-[#2A2F3D] rounded-2xl px-4 py-3 text-xs text-[#94A3B8] flex items-center gap-2" },
                            React.createElement("i", { className: "fa-solid fa-circle-info text-[#F59E0B]" }),
                            "\u901A\u904E\u540D\u7247\u8A8D\u8B49\u5F8C\uFF0C\u5C31\u80FD\u76F4\u63A5\u5728\u9019\u88E1\u767C\u5E03 24H \u52D5\u614B\u3002")),
                        React.createElement("div", { className: "bg-[#181B25]/55 border border-[#2A2F3D] rounded-2xl overflow-hidden divide-y divide-[#2A2F3D]" }, activeStoryUsers.length === 0 ? (React.createElement("div", { className: "text-center py-14 px-5" },
                            React.createElement("div", { className: "w-14 h-14 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#F59E0B] mx-auto mb-4 flex items-center justify-center" },
                                React.createElement("i", { className: "fa-solid fa-comment-dots text-xl" })),
                            React.createElement("p", { className: "text-[#F8FAFC] font-bold" }, "\u76EE\u524D\u6C92\u6709 24H \u52D5\u614B"),
                            React.createElement("p", { className: "text-[#94A3B8] text-sm mt-2" }, "\u767C\u5E03\u4E00\u53E5\u8A71\uFF0C\u8B93\u5927\u5BB6\u77E5\u9053\u4F60\u73FE\u5728\u60F3\u505A\u4EC0\u9EBC\u3002"),
                            isVerifiedUser && (React.createElement("button", { onClick: () => setTimeout(() => document.getElementById('status-wall-inline-input')?.focus(), 50), className: "mt-5 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F111A] px-5 py-2.5 rounded-full text-sm font-bold transition-colors" }, "\u767C\u5E03\u7B2C\u4E00\u5247\u52D5\u614B")))) : (activeStoryUsers.map((v) => {
                            const isLiveMsg = String(v.statusMessage || "").includes('🔴');
                            const plusCount = v.statusReactions?.plus_one?.length || 0;
                            const fireCount = v.statusReactions?.fire?.length || 0;
                            const displayMessage = String(v.statusMessage || "").replace(/^🔴\s*/, "").trim();
                            const commentKey = `${v.id}_${Number(v.statusMessageUpdatedAt || 0)}`;
                            const isCommentsOpen = !!openStatusCommentKeys[commentKey];
                            return (React.createElement("article", { key: v.id, className: "px-4 sm:px-5 py-4 hover:bg-[#1D2130]/55 transition-colors" },
                                React.createElement("div", { className: "flex gap-3 sm:gap-4" },
                                    React.createElement("button", { type: "button", onClick: () => { setSelectedVTuber(v); navigate(`profile/${v.id}`); }, className: "flex-shrink-0 self-start", title: "\u67E5\u770B\u540D\u7247" },
                                        React.createElement("img", { src: sanitizeUrl(v.avatar), className: `w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover border ${isLiveMsg ? 'border-[#EF4444] ring-2 ring-red-500/25' : 'border-[#2A2F3D] hover:border-[#F59E0B]/70'} transition-colors`, onError: (e) => setImageToGrayPlaceholder(e.currentTarget) })),
                                    React.createElement("div", { className: "min-w-0 flex-1" },
                                        React.createElement("div", { className: "flex items-center gap-2 min-w-0 text-xs text-[#94A3B8] mb-1" },
                                            React.createElement("span", { className: "font-bold text-[#CBD5E1] truncate" }, v.name),
                                            React.createElement("span", { className: "text-[#64748B]" }, "\u00B7"),
                                            React.createElement("span", { className: "flex-shrink-0" }, formatRelativeTime(v.statusMessageUpdatedAt)),
                                            isLiveMsg && (React.createElement("span", { className: "flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-[#EF4444]/15 text-[#FCA5A5] border border-[#EF4444]/20 px-2 py-0.5 text-[10px] font-bold" },
                                                React.createElement("i", { className: "fa-solid fa-satellite-dish text-[9px]" }),
                                                " LIVE"))),
                                        React.createElement("p", { className: "text-[#F8FAFC] text-[15px] sm:text-base leading-relaxed whitespace-pre-wrap break-words" }, displayMessage || (isLiveMsg ? '我在直播中！快來找我玩！' : '發布了一則動態')),
                                        React.createElement("div", { className: "mt-3 flex items-center gap-2", onClick: (e) => e.stopPropagation() },
                                            (!user || v.id !== user?.uid) && (React.createElement(React.Fragment, null,
                                                React.createElement("button", { onClick: (e) => handleStatusReaction(e, v, 'fire'), className: "h-9 px-3 rounded-full border border-[#2A2F3D] bg-[#11131C] hover:bg-[#F59E0B]/15 hover:border-[#F59E0B]/35 text-[#FCD34D] text-xs font-bold transition-colors inline-flex items-center gap-1.5" },
                                                    "\uD83D\uDD25 \u5E6B\u63A8",
                                                    fireCount > 0 && React.createElement("span", { className: "text-[#94A3B8]" }, fireCount)),
                                                React.createElement("button", { onClick: (e) => handleStatusReaction(e, v, 'plus_one'), className: "h-9 px-3 rounded-full border border-[#2A2F3D] bg-[#11131C] hover:bg-[#8B5CF6]/15 hover:border-[#8B5CF6]/35 text-[#C4B5FD] text-xs font-bold transition-colors inline-flex items-center gap-1.5" },
                                                    "\uD83D\uDC4B +1",
                                                    plusCount > 0 && React.createElement("span", { className: "text-[#94A3B8]" }, plusCount)))),
                                            React.createElement("button", { type: "button", onClick: (e) => {
                                                    e.stopPropagation();
                                                    setOpenStatusCommentKeys((prev) => ({ ...prev, [commentKey]: !prev[commentKey] }));
                                                }, className: `h-9 px-3 rounded-full border text-xs font-bold transition-colors inline-flex items-center justify-center ${isCommentsOpen ? 'border-[#F59E0B]/45 bg-[#F59E0B]/15 text-[#F59E0B]' : 'border-[#2A2F3D] bg-[#11131C] hover:bg-[#38BDF8]/15 hover:border-[#38BDF8]/35 text-[#7DD3FC]'}`, title: isCommentsOpen ? '收合留言' : '查看留言' },
                                                React.createElement("i", { className: "fa-regular fa-comment-dots" }),
                                                React.createElement(StatusCommentCount, { storyOwner: v })),
                                            user && v.id === user.uid && (React.createElement("button", { onClick: (e) => { e.stopPropagation(); if (confirm("確定要清除這則動態嗎？"))
                                                    handlePostStory(e, "", false); }, className: "h-9 px-3 rounded-full border border-[#2A2F3D] bg-[#11131C] hover:bg-[#1D2130] text-[#CBD5E1] text-xs font-bold transition-colors inline-flex items-center gap-1.5" },
                                                React.createElement("i", { className: "fa-solid fa-eraser" }),
                                                " \u6E05\u9664"))),
                                        isCommentsOpen && (React.createElement(StatusCommentsBox, { storyOwner: v, currentUser: user, myProfile: myProfile, isAdmin: isAdmin, isVerifiedUser: isVerifiedUser, realVtubers: realVtubers, showToast: showToast }))))));
                        })))));
                })(),
                currentView === "match" && (React.createElement(MatchPage, { vtubers: displayVtubers, navigate: navigate, showToast: showToast, currentUser: user, setSelectedVTuber: setSelectedVTuber, onBraveInvite: handleBraveInvite, isVerifiedUser: isVerifiedUser })),
                currentView === "blacklist" && (React.createElement("div", { className: "max-w-5xl mx-auto px-4 py-8 animate-fade-in-up" },
                    React.createElement("div", { className: "bg-[#2A1418]/30 border border-red-900 rounded-2xl p-8 sm:p-12 text-center shadow-sm relative overflow-hidden" },
                        React.createElement("div", { className: "absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-orange-600 to-red-600" }),
                        React.createElement("i", { className: "fa-solid fa-skull-crossbones text-6xl text-[#EF4444] mb-6 drop-shadow-sm" }),
                        React.createElement("h2", { className: "text-3xl sm:text-4xl font-black text-[#EF4444] mb-4 tracking-widest" }, "\u66AB\u505C\u986F\u793A\u540D\u55AE"),
                        React.createElement("p", { className: "text-red-200/80 mb-8 max-w-2xl mx-auto leading-relaxed font-medium" },
                            "\u53EA\u8981\u5012\u8B9A\u6578\u8D85\u904E 10 \u500B\uFF0C\u8A72\u540D\u7247\u5373\u6703\u88AB\u7CFB\u7D71\u81EA\u52D5\u79FB\u5165\u6B64\u5340\u4E26\u5F37\u5236\u4E0B\u67B6\u3002",
                            React.createElement("br", { className: "hidden sm:block" }),
                            "\u5728\u6B64\u5340\u7684\u540D\u7247\u7121\u6CD5\u88AB\u4E00\u822C\u4F7F\u7528\u8005\u770B\u898B\uFF0C\u4E5F\u7121\u6CD5\u518D\u767C\u9001\u4EFB\u4F55\u9080\u7D04\u3002",
                            React.createElement("br", null),
                            React.createElement("span", { className: "text-[#F59E0B] text-sm mt-2 block" }, "\u5982\u679C\u767C\u73FE\u6709\u60E1\u610F\u6D17\u5012\u8B9A\u7684\u884C\u70BA\uFF0C\u8ACB\u806F\u7D61\u5B98\u65B9\u8655\u7406\u3002")),
                        React.createElement("div", { className: "inline-block bg-black/50 border border-red-900 px-6 py-3 rounded-xl" },
                            React.createElement("span", { className: "text-[#94A3B8] font-bold mr-2" }, "\u76EE\u524D\u9ED1\u55AE\u6578\u91CF\uFF1A"),
                            React.createElement("span", { className: "text-2xl font-black text-[#EF4444]" }, realVtubers.filter((v) => v.isBlacklisted || v.dislikes >= 10).length),
                            React.createElement("span", { className: "text-[#64748B] text-sm ml-1" }, "\u4EBA"))))),
                currentView === 'articles' && (React.createElement(ArticlesPage, { articles: realArticles, onPublish: handlePublishArticle, onDelete: handleDeleteArticle, onIncrementView: handleIncrementArticleView })),
                currentView === "admin" && isAdmin && (React.createElement(AdminPage, { user: user, vtubers: realVtubers, bulletins: realBulletins, collabs: realCollabs, updates: realUpdates, rules: realRules, tips: realTips, privateDocs: privateDocs, onSaveSettings: handleSaveSettings, onDeleteVtuber: handleDeleteVtuber, onVerifyVtuber: handleVerifyVtuber, onRejectVtuber: handleRejectVtuber, onUpdateVtuber: handleAdminUpdateVtuber, onDeleteBulletin: handleDeleteBulletin, onAddCollab: handleAddCollab, onDeleteCollab: handleDeleteCollab, onAddUpdate: handleAddUpdate, onDeleteUpdate: handleDeleteUpdate, showToast: showToast, onResetAllCollabTypes: handleAdminResetAllCollabTypes, onResetNatAndLang: handleAdminResetNatAndLang, autoFetchYouTubeInfo: autoFetchYouTubeInfo, onMassSyncSubs: handleMassSyncSubs, onMassSyncTwitch: handleMassSyncTwitch, isSyncingSubs: isSyncingSubs, syncProgress: syncProgress, onSendMassEmail: handleSendMassEmail, defaultBulletinImages: defaultBulletinImages, onAddDefaultBulletinImage: handleAddDefaultBulletinImage, onDeleteDefaultBulletinImage: handleDeleteDefaultBulletinImage, onTestReminder: handleTestReminderSystem, onTestPush: handleTestPushNotification, onMassUpdateVerification: handleAdminMassUpdateVerification, setIsSyncingSubs: setIsSyncingSubs, setSyncProgress: setSyncProgress, onMassMigrateImages: handleMassMigrateImagesToStorage, articles: realArticles, onVerifyArticle: handleVerifyArticle, onDeleteArticle: handleDeleteArticle, onEditArticle: handleAdminEditArticle, onMigrateBulletinImages: handleMigrateBulletinImages, handleAdminCleanBulletins: handleAdminCleanBulletins, functionsInstance: functionsInstance, massEmailSending: massEmailSending, massEmailCurrent: massEmailCurrent, massEmailTotal: massEmailTotal, massEmailLog: massEmailLog }))),
            isStoryComposerOpen && (React.createElement("div", { className: "fixed inset-0 z-[9999] grid place-items-start justify-items-center p-4 pt-6 sm:pt-10 bg-black/70", onClick: () => setIsStoryComposerOpen(false) },
                React.createElement("div", { className: "w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-[#11131C] border border-[#2A2F3D] rounded-2xl shadow-sm", onClick: (e) => e.stopPropagation() },
                    React.createElement("div", { className: "px-5 py-4 border-b border-[#2A2F3D] flex items-center justify-between gap-4" },
                        React.createElement("div", null,
                            React.createElement("h3", { className: "text-[#F8FAFC] font-bold text-lg" }, "\u8B93\u5927\u5BB6\u77E5\u9053\u4F60\u73FE\u5728\u60F3\u505A\u4EC0\u9EBC"),
                            React.createElement("p", { className: "text-[#94A3B8] text-xs mt-1" }, "\u4E00\u53E5\u8A71\u5C31\u597D\uFF1A\u60F3\u63EA\u5718\u3001\u627E\u7DF4\u7FD2\u3001\u958B\u53F0\u4E2D\uFF0C\u90FD\u53EF\u4EE5\u8B93\u5176\u4ED6\u5275\u4F5C\u8005\u66F4\u5FEB\u770B\u5230\u4F60\u3002")),
                        React.createElement("button", { type: "button", onClick: () => setIsStoryComposerOpen(false), className: "w-9 h-9 rounded-lg bg-[#181B25] hover:bg-[#1D2130] text-[#94A3B8] hover:text-white transition-colors flex-shrink-0", "aria-label": "\u95DC\u9589" },
                            React.createElement("i", { className: "fa-solid fa-xmark" }))),
                    isVerifiedUser && myProfile ? (React.createElement("form", { onSubmit: async (e) => {
                            const willPost = storyInput.trim();
                            await handlePostStory(e);
                            if (willPost)
                                setIsStoryComposerOpen(false);
                        }, className: "p-5 space-y-4" },
                        React.createElement("div", null,
                            React.createElement("input", { id: "story-input-global", type: "text", maxLength: "40", value: storyInput, onChange: (e) => setStoryInput(e.target.value), className: "w-full min-w-0 box-border bg-[#0F111A] border border-[#2A2F3D] rounded-xl px-4 h-[50px] text-white focus:ring-2 focus:ring-orange-500 outline-none text-[16px]", placeholder: "\u4F8B\u5982\uFF1A\u4ECA\u665A 8 \u9EDE\u60F3\u627E\u4EBA\u6253 APEX\uFF01 (\u9650 40 \u5B57)", autoFocus: true }),
                            React.createElement("div", { className: `text-right text-[10px] mt-1.5 pr-2 transition-colors ${storyInput.length >= 40 ? 'text-[#EF4444] font-bold' : 'text-[#94A3B8]'}` },
                                storyInput.length,
                                " / 40")),
                        React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-2" },
                            React.createElement("button", { type: "submit", disabled: !storyInput.trim(), className: `h-[46px] rounded-xl text-sm font-bold transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 ${storyInput.trim() ? 'bg-[#F59E0B] hover:bg-[#D97706] text-[#0F111A]' : 'bg-[#181B25] text-[#64748B] cursor-not-allowed'}` }, "\u767C\u5E03\u9650\u52D5"),
                            React.createElement("button", { type: "button", onClick: async (e) => { await handlePostStory(e, "🔴 我在直播中！快來找我玩！", true); setIsStoryComposerOpen(false); }, className: "h-[46px] rounded-xl text-sm font-bold transition-colors whitespace-nowrap flex items-center justify-center bg-[#EF4444] hover:bg-red-500 text-white" }, "\u6211\u5728\u76F4\u64AD"),
                            myProfile.statusMessage ? (React.createElement("button", { type: "button", onClick: async (e) => { await handlePostStory(e, "", false); setIsStoryComposerOpen(false); }, className: "h-[46px] rounded-xl text-sm font-bold transition-colors whitespace-nowrap flex items-center justify-center bg-[#1D2130] hover:bg-[#2A2F3D] text-white" }, "\u6E05\u9664\u52D5\u614B")) : (React.createElement("button", { type: "button", onClick: () => setIsStoryComposerOpen(false), className: "h-[46px] rounded-xl text-sm font-bold transition-colors whitespace-nowrap flex items-center justify-center bg-[#1D2130] hover:bg-[#2A2F3D] text-white" }, "\u53D6\u6D88"))))) : (React.createElement("div", { className: "p-5 text-center" },
                        React.createElement("p", { className: "text-[#94A3B8] text-sm mb-4" }, "\u9700\u901A\u904E\u540D\u7247\u8A8D\u8B49\u624D\u80FD\u767C\u5E03\u9650\u6642\u52D5\u614B\u5594\uFF01"),
                        React.createElement("button", { onClick: () => { setIsStoryComposerOpen(false); navigate("dashboard"); }, className: "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors" }, "\u524D\u5F80\u8A8D\u8B49\u540D\u7247")))))),
            isCollabModalOpen && selectedVTuber && (React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80", onClick: () => setIsCollabModalOpen(false) },
                React.createElement("div", { className: "bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-md overflow-hidden shadow-sm", onClick: (e) => e.stopPropagation() },
                    React.createElement("div", { className: "bg-[#181B25] p-6 flex flex-col items-center border-b border-[#2A2F3D]" },
                        React.createElement("img", { src: sanitizeUrl(selectedVTuber.avatar), className: "w-20 h-20 rounded-full border border-[#2A2F3D] mb-3 object-cover" }),
                        React.createElement("h3", { className: "text-xl font-bold text-white mb-1" },
                            "\u9080\u8ACB ",
                            selectedVTuber.name,
                            " \u806F\u52D5"),
                        React.createElement("p", { className: "text-xs text-[#C4B5FD] bg-purple-900/40 px-3 py-1 rounded-full" },
                            "\u5C0D\u65B9\u4E3B\u8981\u6642\u6BB5\uFF1A",
                            formatSchedule(selectedVTuber))),
                    React.createElement("div", { className: "p-6" },
                        React.createElement("textarea", { rows: "5", placeholder: "\u55E8\uFF01\u6211\u60F3\u9080\u8ACB\u4F60\u4E00\u8D77\u73A9...", value: inviteMessage, onChange: (e) => setInviteMessage(e.target.value), className: inputCls + " resize-none mb-4" }),
                        React.createElement("div", { className: "flex gap-3" },
                            React.createElement("button", { onClick: () => setIsCollabModalOpen(false), className: "flex-1 bg-[#181B25] hover:bg-[#1D2130] text-white py-3 rounded-xl font-bold transition-colors" }, "\u53D6\u6D88"),
                            React.createElement("button", { disabled: isSendingInvite, onClick: async () => {
                                    if (isSendingInvite)
                                        return; // 防呆：如果正在發送就阻擋
                                    if (!inviteMessage.trim())
                                        return showToast("請輸入邀請內容！");
                                    if (!myProfile)
                                        return showToast("請先建立並認證名片才能發信！");
                                    if (inviteMessage.length > 500)
                                        return showToast("字數請控制在500字以內！");
                                    const lastMsgKey = `last_msg_${user.uid}_${selectedVTuber.id}`;
                                    const lastMsg = localStorage.getItem(lastMsgKey);
                                    if (lastMsg && Date.now() - parseInt(lastMsg) < 60000)
                                        return showToast("發送太頻繁，請稍後再試。");
                                    try {
                                        setIsSendingInvite(true); // 🌟 開始發送，鎖定按鈕
                                        const now = Date.now();
                                        // 1. 發送給對方的通知
                                        await addDoc(collection(db, getPath("notifications")), {
                                            userId: selectedVTuber.id,
                                            fromUserId: user.uid,
                                            fromUserName: myProfile.name || "創作者",
                                            fromUserAvatar: myProfile.avatar || "",
                                            message: inviteMessage,
                                            type: "collab_invite",
                                            createdAt: now,
                                            read: false,
                                        });
                                        // 2. 發送給自己的「寄件備份」
                                        await addDoc(collection(db, getPath("notifications")), {
                                            userId: user.uid,
                                            fromUserId: user.uid,
                                            fromUserName: myProfile.name || "創作者",
                                            fromUserAvatar: myProfile.avatar || "",
                                            message: `【寄件備份 - 寄給 ${selectedVTuber.name}】\n\n${inviteMessage}`,
                                            type: "collab_invite",
                                            createdAt: now + 1,
                                            read: false,
                                        });
                                        localStorage.setItem(lastMsgKey, Date.now().toString());
                                        showToast("✅ 邀請已發送！並已儲存至寄件備份");
                                        setIsCollabModalOpen(false);
                                        setInviteMessage("");
                                    }
                                    catch (err) {
                                        console.error("發送邀約或備份時發生錯誤:", err);
                                        showToast("❌ 發送過程中發生部分錯誤，請按 F12 查看");
                                    }
                                    finally {
                                        setIsSendingInvite(false); // 🌟 發送結束，解除鎖定
                                    }
                                }, className: `flex-[2] text-white py-3 rounded-xl font-bold shadow-sm transition-all ${isSendingInvite ? "bg-purple-800 cursor-not-allowed opacity-70" : "bg-[#8B5CF6] hover:bg-[#8B5CF6]"}` }, isSendingInvite ? (React.createElement(React.Fragment, null,
                                React.createElement("i", { className: "fa-solid fa-spinner fa-spin mr-2" }),
                                "\u767C\u9001\u4E2D...")) : ("送出邀約"))))))),
            isRulesModalOpen && (
            /* 這裡移除了 backdrop-blur-sm 和 animate-fade-in-up */
            React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80", onClick: () => setIsRulesModalOpen(false) },
                React.createElement("div", { className: "bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-lg shadow-sm overflow-hidden", onClick: (e) => e.stopPropagation() },
                    React.createElement("div", { className: "bg-[#3B171D]/30 p-5 border-b border-red-900/50 flex justify-between items-center" },
                        React.createElement("h3", { className: "text-xl font-bold text-[#EF4444] flex items-center gap-2" },
                            React.createElement("i", { className: "fa-solid fa-triangle-exclamation" }),
                            " \u806F\u52D5\u898F\u7BC4"),
                        React.createElement("button", { onClick: () => setIsRulesModalOpen(false), className: "text-[#94A3B8] hover:text-white" },
                            React.createElement("i", { className: "fa-solid fa-xmark text-xl" }))),
                    React.createElement("div", { className: "p-6 max-h-[70vh] overflow-y-auto custom-scrollbar" },
                        React.createElement("div", { className: "text-[#CBD5E1] leading-relaxed whitespace-pre-wrap text-sm" }, realRules)),
                    React.createElement("div", { className: "p-4 border-t border-[#2A2F3D] text-center" },
                        React.createElement("button", { onClick: () => setIsRulesModalOpen(false), className: "bg-[#181B25] hover:bg-[#1D2130] text-white px-8 py-2.5 rounded-xl font-bold transition-colors w-full sm:w-auto" }, "\u6211\u4E86\u89E3\u4E86"))))),
            isTipsModalOpen && (React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80", onClick: () => setIsTipsModalOpen(false) },
                React.createElement("div", { className: "bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-lg shadow-sm overflow-hidden", onClick: (e) => e.stopPropagation() },
                    React.createElement("div", { className: "bg-yellow-900/30 p-5 border-b border-yellow-900/50 flex justify-between items-center" },
                        React.createElement("h3", { className: "text-xl font-bold text-[#F59E0B] flex items-center gap-2" },
                            React.createElement("i", { className: "fa-solid fa-lightbulb" }),
                            " \u9080\u7D04\u5C0F\u6280\u5DE7"),
                        React.createElement("button", { onClick: () => setIsTipsModalOpen(false), className: "text-[#94A3B8] hover:text-white" },
                            React.createElement("i", { className: "fa-solid fa-xmark text-xl" }))),
                    React.createElement("div", { className: "p-6 max-h-[70vh] overflow-y-auto custom-scrollbar" },
                        React.createElement("div", { className: "text-[#CBD5E1] leading-relaxed whitespace-pre-wrap text-sm mb-6" }, realTips),
                        React.createElement("div", { className: "bg-[#181B25]/80 p-4 rounded-xl border border-[#2A2F3D]" },
                            React.createElement("p", { className: "text-xs text-[#64748B] mb-2 font-bold" }, "\u8907\u88FD\u516C\u7248\u9080\u7D04\u8A5E (\u53EF\u81EA\u884C\u4FEE\u6539)"),
                            React.createElement("div", { className: "bg-black/50 p-3 rounded-lg text-sm text-[#CBD5E1] font-mono mb-3 select-all" }, "\u60A8\u597D\uFF0C\u6211\u662F OOO\uFF01\\n\u8FD1\u671F\u60F3\u898F\u5283\u4E00\u500B [\u904A\u6232/\u4F01\u5283] \u7684\u806F\u52D5\uFF0C\\n\u60F3\u8ACB\u554F\u662F\u5426\u6709\u69AE\u5E78\u80FD\u9080\u8ACB\u60A8\u4E00\u8D77\u53C3\u8207\u5462\uFF1F\\n\u6642\u9593\u9810\u8A08\u5728 OO/OO\uFF0C\u8A73\u7D30\u4F01\u5283\u6848\u5982\u4E0B...\\n\u671F\u5F85\u60A8\u7684\u56DE\u8986\uFF01"),
                            React.createElement("button", { onClick: () => {
                                    navigator.clipboard.writeText("您好，我是 OOO！\n近期想規劃一個 [遊戲/企劃] 的聯動，\n想請問是否有榮幸能邀請您一起參與呢？\n時間預計在 OO/OO，詳細企劃案如下...\n期待您的回覆！");
                                    setCopiedTemplate(true);
                                    setTimeout(() => setCopiedTemplate(false), 2000);
                                }, className: "w-full bg-[#8B5CF6] hover:bg-[#8B5CF6] text-white py-2 rounded-lg font-bold transition-colors text-sm" }, copiedTemplate ? "✅ 已複製！" : "📋 點擊複製")))))),
            isUpdatesModalOpen && (
            /* 移除 backdrop-blur-sm 與 animate-fade-in-up */
            React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80", onClick: () => {
                    setIsUpdatesModalOpen(false);
                    handleMarkAllUpdatesRead();
                } },
                React.createElement("div", { className: "bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-lg shadow-sm overflow-hidden flex flex-col max-h-[80vh]", onClick: (e) => e.stopPropagation() },
                    React.createElement("div", { className: "bg-blue-900/30 p-5 border-b border-blue-900/50 flex justify-between items-center" },
                        React.createElement("h3", { className: "text-xl font-bold text-[#38BDF8] flex items-center gap-2" },
                            React.createElement("i", { className: "fa-solid fa-bullhorn" }),
                            " \u6700\u65B0\u6D88\u606F\u8207\u529F\u80FD\u767C\u5E03"),
                        React.createElement("button", { onClick: () => {
                                setIsUpdatesModalOpen(false);
                                handleMarkAllUpdatesRead();
                            }, className: "text-[#94A3B8] hover:text-white" },
                            React.createElement("i", { className: "fa-solid fa-xmark text-xl" }))),
                    React.createElement("div", { className: "p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6" }, realUpdates.length === 0 ? (React.createElement("div", { className: "text-center text-[#94A3B8] py-8" },
                        React.createElement("p", { className: "text-[#F8FAFC] font-bold mb-1" }, "\u76EE\u524D\u6C92\u6709\u65B0\u6D88\u606F"),
                        React.createElement("p", { className: "text-sm" }, "\u6709\u5E73\u53F0\u516C\u544A\u6216\u91CD\u8981\u63D0\u9192\u6642\uFF0C\u6703\u6574\u7406\u5728\u9019\u88E1\u3002"))) : (realUpdates.map((u) => (React.createElement("div", { key: u.id, className: "relative" },
                        !readUpdateIds.includes(u.id) && (React.createElement("span", { className: "absolute -left-2 top-1.5 w-2 h-2 rounded-full bg-[#EF4444]" })),
                        React.createElement("h4", { className: "font-bold text-white text-lg mb-1" }, u.title),
                        React.createElement("p", { className: "text-xs text-[#38BDF8] mb-2 font-mono" }, u.date),
                        React.createElement("p", { className: "text-[#CBD5E1] text-sm leading-relaxed whitespace-pre-wrap" }, u.content)))))),
                    React.createElement("div", { className: "p-4 border-t border-[#2A2F3D] bg-[#0F111A]/90 text-center" },
                        React.createElement("button", { onClick: () => {
                                setIsUpdatesModalOpen(false);
                                handleMarkAllUpdatesRead();
                            }, className: "bg-[#38BDF8] hover:bg-[#38BDF8] text-[#0F111A] px-8 py-2.5 rounded-xl font-bold transition-colors w-full sm:w-auto shadow-sm" }, "\u77E5\u9053\u4E86"))))),
            user && myProfile && myProfile.showVerificationModal && (React.createElement("div", { className: "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" },
                React.createElement("div", { className: "bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-md p-8 text-center shadow-sm relative" },
                    React.createElement("div", { className: `absolute top-0 left-0 w-full h-2 ${myProfile.showVerificationModal === "approved" ? "bg-gradient-to-r from-green-400 to-emerald-500" : "bg-gradient-to-r from-red-500 to-orange-500"}` }),
                    React.createElement("div", { className: "mb-6" },
                        React.createElement("div", { className: `inline-flex items-center justify-center w-20 h-20 rounded-full ${myProfile.showVerificationModal === "approved" ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#EF4444]/10 text-[#EF4444]"}` },
                            React.createElement("i", { className: `fa-solid ${myProfile.showVerificationModal === "approved" ? "fa-check text-4xl" : "fa-xmark text-5xl"}` }))),
                    React.createElement("h2", { className: "text-2xl font-extrabold text-white mb-4" }, myProfile.showVerificationModal === "approved"
                        ? "名片審核通過！"
                        : "名片審核未通過"),
                    myProfile.showVerificationModal === "approved" ? (React.createElement("p", { className: "text-[#E2E8F0] text-lg font-bold leading-relaxed mb-8" },
                        "\u606D\u559C\u4F60\u5BE9\u6838\u901A\u904E\uFF01",
                        React.createElement("br", null),
                        "\u958B\u59CB\u5C0B\u627E\u806F\u52D5\u5925\u4F34\u5427\uFF01")) : (React.createElement("p", { className: "text-[#CBD5E1] text-sm leading-relaxed mb-8 text-left" },
                        "\u5F88\u62B1\u6B49\uFF0C\u76EE\u524D\u50C5\u958B\u653EYT\u8A02\u95B1\u6216TWITCH\u8FFD\u96A8\u52A0\u8D77\u4F86\u9AD8\u65BC500\u3001\u8FD1\u4E00\u500B\u6708\u6709\u76F4\u64AD\u6D3B\u52D5\u4E4BVtuber\u6216\u7E6A\u5E2B\u3001\u5EFA\u6A21\u5E2B\u3001\u526A\u8F2F\u5E2B\u5247\u7531\u7BA1\u7406\u54E1\u8A8D\u5B9A\uFF0C\u656C\u8ACB\u898B\u8AD2\u3002\u5982\u679C\u4EE5\u4E0A\u4F60\u90FD\u6709\u9054\u5230\uFF0C\u90A3\u5C31\u662F\u4F60\u6C92\u6709\u5C07\u300CV-Nexus\u5BE9\u6838\u4E2D\u300D\u5B57\u6A23\u653E\u5165\u4F60\u7684X\u6216YT\u7C21\u4ECB\u5167\uFF0C\u7121\u6CD5\u5BE9\u6838\u6210\u529F\u5594\uFF01",
                        React.createElement("br", null),
                        React.createElement("br", null),
                        "\u8ACB\u7E7C\u7E8C\u52A0\u6CB9\uFF01")),
                    React.createElement("div", { className: "flex justify-center" },
                        React.createElement("button", { onClick: async () => {
                                const status = myProfile.showVerificationModal;
                                const updates = { showVerificationModal: null };
                                try {
                                    // 1. 先更新 Firestore
                                    await updateDoc(doc(db, getPath("vtubers"), myProfile.id), updates);
                                    // 2. 關鍵：更新本地狀態的同時，強制同步更新 localStorage 快取
                                    setRealVtubers((prev) => {
                                        const newList = prev.map((v) => v.id === myProfile.id ? { ...v, ...updates } : v);
                                        // 這裡呼叫你定義好的同步函式，把 showVerificationModal: null 存入快取
                                        syncVtuberCache(newList);
                                        return newList;
                                    });
                                    // 3. 根據結果導向不同頁面
                                    if (status === "approved") {
                                        navigate("grid");
                                    }
                                    // 如果是 rejected，就留在原地讓使用者看 dashboard
                                }
                                catch (err) {
                                    console.error("關閉通知失敗:", err);
                                    // 即使資料庫失敗，本地也要先關掉，避免卡死
                                    setRealVtubers((prev) => prev.map((v) => v.id === myProfile.id ? { ...v, ...updates } : v));
                                }
                            }, className: `${myProfile.showVerificationModal === "approved"
                                ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500"
                                : "bg-[#181B25] hover:bg-[#1D2130] border border-[#2A2F3D]"} text-white px-8 py-3 rounded-xl font-bold shadow-sm w-full transition-all` }, myProfile.showVerificationModal === "approved"
                            ? "開始找夥伴"
                            : "我了解了"))))),
            isLeaderboardModalOpen && (React.createElement("div", { className: "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80", onClick: () => setIsLeaderboardModalOpen(false) },
                React.createElement("div", { className: "bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-md shadow-sm overflow-hidden flex flex-col max-h-[80vh]", onClick: (e) => e.stopPropagation() },
                    React.createElement("div", { className: "bg-yellow-900/30 p-5 border-b border-yellow-900/50 flex justify-between items-center" },
                        React.createElement("h3", { className: "text-xl font-bold text-[#F59E0B] flex items-center gap-2" },
                            React.createElement("i", { className: "fa-solid fa-trophy" }),
                            " \u63EA\u5718\u6392\u884C\u699C"),
                        React.createElement("button", { onClick: () => setIsLeaderboardModalOpen(false), className: "text-[#94A3B8] hover:text-white" },
                            React.createElement("i", { className: "fa-solid fa-xmark text-xl" }))),
                    React.createElement("div", { className: "p-6 overflow-y-auto flex-1 custom-scrollbar space-y-3" }, leaderboardData.length === 0 ? (React.createElement("p", { className: "text-center text-[#64748B] py-10" },
                        "\u76EE\u524D\u9084\u6C92\u6709\u4EBA\u9054\u6210\u62DB\u52DF\u76EE\u6A19\u5594\uFF01",
                        React.createElement("br", null),
                        "\u8D95\u5FEB\u6210\u70BA\u7B2C\u4E00\u500B\u5427\uFF01")) : (leaderboardData.map((vt, idx) => (React.createElement("div", { key: vt.id || idx, className: `flex items-center gap-4 p-3 rounded-xl border ${idx === 0 ? "bg-[#F59E0B]/20 border-[#F59E0B]/50 shadow-sm" : idx === 1 ? "bg-gray-300/20 border-gray-300/50 shadow-sm" : idx === 2 ? "bg-[#F59E0B]/20 border-[#F59E0B]/50 shadow-sm" : "bg-[#181B25]/50 border-[#2A2F3D]"}` },
                        React.createElement("div", { className: "w-8 text-center flex-shrink-0" }, idx === 0 ? (React.createElement("i", { className: "fa-solid fa-crown text-2xl text-[#F59E0B]" })) : idx === 1 ? (React.createElement("i", { className: "fa-solid fa-medal text-xl text-[#CBD5E1]" })) : idx === 2 ? (React.createElement("i", { className: "fa-solid fa-award text-xl text-[#F59E0B]" })) : (React.createElement("span", { className: "text-[#64748B] font-bold" }, idx + 1))),
                        React.createElement("button", { type: "button", onClick: (e) => { e.stopPropagation(); setIsLeaderboardModalOpen(false); setSelectedVTuber(vt); navigate(`profile/${vt.id}`); }, className: "flex-shrink-0 rounded-full hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-[#F59E0B]", title: `查看 ${vt.name || "創作者"} 的名片`, "aria-label": `查看 ${vt.name || "創作者"} 的名片` },
                            React.createElement("img", { src: sanitizeUrl(vt.avatar), className: `w-12 h-12 rounded-full object-cover border ${idx === 0 ? "border-yellow-400" : idx === 1 ? "border-gray-300" : idx === 2 ? "border-[#FBBF24]" : "border-[#2A2F3D]"}` })),
                        React.createElement("div", { className: "flex-1 min-w-0" },
                            React.createElement("p", { className: `font-bold truncate ${idx === 0 ? "text-[#F59E0B] text-lg" : idx === 1 ? "text-[#E2E8F0] text-base" : idx === 2 ? "text-orange-300 text-base" : "text-[#CBD5E1] text-sm"}` }, vt.name),
                            React.createElement("p", { className: "text-xs text-[#64748B]" }, "\u7D2F\u7A4D\u6210\u529F\u6B21\u6578")),
                        React.createElement("div", { className: "flex-shrink-0 text-right" },
                            React.createElement("span", { className: `font-black text-2xl ${idx === 0 ? "text-[#F59E0B]" : idx === 1 ? "text-[#CBD5E1]" : idx === 2 ? "text-[#F59E0B]" : "text-[#94A3B8]"}` }, vt.successCount),
                            React.createElement("span", { className: "text-xs text-[#64748B] ml-1" }, "\u6B21"))))))),
                    React.createElement("div", { className: "p-4 border-t border-[#2A2F3D] bg-[#0F111A]/90 text-center" },
                        React.createElement("button", { onClick: () => setIsLeaderboardModalOpen(false), className: "bg-[#181B25] hover:bg-[#1D2130] text-white px-8 py-2.5 rounded-xl font-bold transition-colors w-full sm:w-auto shadow-sm" }, "\u95DC\u9589"))))),
            confirmDislikeData && (React.createElement("div", { className: "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up", onClick: () => setConfirmDislikeData(null) },
                React.createElement("div", { className: "bg-[#0F111A] border border-[#EF4444]/50 rounded-2xl w-full max-w-md p-8 text-center shadow-sm", onClick: (e) => e.stopPropagation() },
                    React.createElement("i", { className: "fa-solid fa-triangle-exclamation text-5xl text-[#EF4444] mb-4" }),
                    React.createElement("h3", { className: "text-xl font-bold text-white mb-2" },
                        "\u78BA\u5B9A\u8981\u5C0D ",
                        confirmDislikeData.name,
                        " \u9001\u51FA\u5012\u8B9A\uFF1F"),
                    React.createElement("p", { className: "text-[#94A3B8] text-sm mb-6" },
                        "\u5012\u8B9A\u529F\u80FD\u50C5\u7528\u65BC\u6AA2\u8209\u300C\u8CA0\u9762\u884C\u70BA\u300D\u6216\u300C\u60E1\u610F\u9A37\u64FE\u300D\u3002",
                        React.createElement("br", null),
                        "\u82E5\u8A72\u540D\u7247\u7D2F\u7A4D\u8D85\u904E 10 \u500B\u5012\u8B9A\u5C07\u81EA\u52D5\u4E0B\u67B6\u3002"),
                    React.createElement("div", { className: "flex gap-3" },
                        React.createElement("button", { onClick: () => setConfirmDislikeData(null), className: "flex-1 bg-[#181B25] hover:bg-[#1D2130] text-white py-3 rounded-xl font-bold transition-colors" }, "\u53D6\u6D88"),
                        React.createElement("button", { onClick: handleConfirmDislike, className: "flex-1 bg-[#EF4444] hover:bg-[#EF4444] text-white py-3 rounded-xl font-bold shadow-sm transition-transform" }, "\u78BA\u5B9A\u9001\u51FA"))))),
            viewParticipantsCollab && currentView !== "profile" && (React.createElement("div", { className: "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm", onClick: () => setViewParticipantsCollab(null) },
                React.createElement("div", { className: "bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-md flex flex-col max-h-[80vh] shadow-sm", onClick: (e) => e.stopPropagation() },
                    React.createElement("div", { className: "sticky top-0 bg-[#0F111A]/95 backdrop-blur px-6 py-4 border-b border-[#2A2F3D] flex justify-between items-center z-10" },
                        React.createElement("h3", { className: "font-bold text-white flex items-center gap-2" },
                            React.createElement("i", { className: "fa-solid fa-users text-[#A78BFA]" }),
                            " ",
                            "\u806F\u52D5\u53C3\u8207\u6210\u54E1"),
                        React.createElement("button", { onClick: () => setViewParticipantsCollab(null), className: "text-[#94A3B8] hover:text-white" },
                            React.createElement("i", { className: "fa-solid fa-xmark text-xl" }))),
                    React.createElement("div", { className: "p-4 overflow-y-auto space-y-3" }, (viewParticipantsCollab.participants || []).map((pId) => {
                        const vt = realVtubers.find((v) => v.id === pId);
                        if (!vt)
                            return null;
                        return (React.createElement("div", { key: vt.id, className: "flex items-center justify-between bg-[#181B25]/50 p-3 rounded-xl border border-[#2A2F3D] hover:border-white/10 transition-all cursor-pointer group", onClick: () => {
                                setSelectedVTuber(vt);
                                navigate(`profile/${vt.id}`);
                                // 這裡絕對不能有 setViewParticipantsCollab(null)
                            } },
                            React.createElement("div", { className: "flex items-center gap-4" },
                                React.createElement("img", { src: sanitizeUrl(vt.avatar), className: "w-12 h-12 rounded-full object-cover border border-[#2A2F3D] group-hover:border-[#A78BFA] transition-colors" }),
                                React.createElement("div", null,
                                    React.createElement("p", { className: "font-bold text-white text-sm group-hover:text-[#C4B5FD] transition-colors" }, vt.name),
                                    React.createElement("p", { className: "text-[10px] text-[#94A3B8] mt-1" },
                                        vt.agency,
                                        " | \u9EDE\u64CA\u67E5\u770B\u540D\u7247"))),
                            React.createElement("i", { className: "fa-solid fa-chevron-right text-gray-600 group-hover:text-[#A78BFA] transition-colors" })));
                    }))))),
            user && !chatTarget && (React.createElement("div", { className: "vnexus-chat-launcher fixed bottom-4 right-4 z-[90]" },
                isChatListOpen && (React.createElement("div", { className: "absolute bottom-16 right-0 w-[90vw] sm:w-80 bg-[#0F111A] border border-[#2A2F3D] rounded-2xl shadow-sm overflow-hidden animate-fade-in-up" },
                    React.createElement("div", { className: "bg-[#8B5CF6] p-3 flex justify-between items-center text-white shadow-md" },
                        React.createElement("span", { className: "font-bold text-sm flex items-center gap-2" },
                            React.createElement("i", { className: "fa-solid fa-comments" }),
                            " \u8A0A\u606F\u5217\u8868"),
                        React.createElement("button", { onClick: () => setIsChatListOpen(false), className: "hover:bg-[#7C3AED] w-6 h-6 rounded-full flex items-center justify-center transition-colors" },
                            React.createElement("i", { className: "fa-solid fa-xmark" }))),
                    React.createElement(ChatListContent, { currentUser: user, vtubers: typeof realVtubers !== "undefined" ? realVtubers : [], onOpenChat: handleOpenChat, onDeleteChat: handleDeleteChat, allChatRooms: allChatRooms }))),
                React.createElement("button", { onClick: () => setIsChatListOpen(!isChatListOpen), className: "bg-[#8B5CF6] hover:bg-[#8B5CF6] text-white w-14 h-14 rounded-full shadow-sm flex items-center justify-center transition-transform border border-[#A78BFA]/30 relative" },
                    React.createElement("i", { className: `fa-solid ${isChatListOpen ? "fa-xmark text-xl" : "fa-message text-2xl"}` }),
                    !isChatListOpen && hasUnreadChat && (React.createElement("span", { className: "absolute -top-1 -right-1 flex h-5 w-5" },
                        React.createElement("span", { className: "animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" }),
                        React.createElement("span", { className: "relative inline-flex rounded-full h-5 w-5 bg-[#EF4444] border border-gray-900 flex items-center justify-center" },
                            React.createElement("span", { className: "text-[10px] text-white font-bold" }, "!"))))))),
            user && chatTarget && (React.createElement(FloatingChat, { targetVtuber: chatTarget, currentUser: user, myProfile: typeof myProfile !== "undefined"
                    ? myProfile
                    : typeof realVtubers !== "undefined"
                        ? realVtubers.find((v) => v.id === user.uid)
                        : null, onClose: () => setChatTarget(null), showToast: typeof showToast !== "undefined"
                    ? showToast
                    : (msg) => console.log(msg), 
                // 🌟 新增：傳遞導航函式，讓聊天室可以跳轉名片
                onNavigateProfile: (vt) => {
                    setSelectedVTuber(vt);
                    navigate(`profile/${vt.id}`);
                } })),
            React.createElement("footer", { className: "py-6 border-t border-[#2A2F3D] text-[#64748B] text-sm" },
                React.createElement("div", { className: "max-w-6xl mx-auto px-4 flex flex-col items-center justify-center gap-1 text-center" },
                    React.createElement("p", { className: "text-xs tracking-wide" }, "\u672C\u7DB2\u9801\u7531 Gemini Pro\u3001Chatgpt\u8F14\u52A9\u751F\u6210\uFF5C\u4F01\u5283\u8005 \u5F9EAPEX\u6B78\u4F86\u7684Dasa"),
                    React.createElement("p", null,
                        "\u00A9 ",
                        new Date().getFullYear(),
                        " V-Nexus. \u5C08\u70BA VTuber \u6253\u9020\u7684\u806F\u52D5\u5E73\u53F0\u3002"))))));
}
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App, null));
