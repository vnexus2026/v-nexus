import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  limit,
  writeBatch,
  deleteField,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  getToken as getAppCheckToken,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
// --- 務必確認這行有在頂部 ---
import {
  getMessaging,
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";
// --- API 金鑰設定區 (請在此填入您申請到的金鑰) ---
import {
  getStorage,
  ref,
  uploadString,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

import {
  getAnalytics,
  logEvent
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";
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
  if (!isLocalAppCheckHost()) return false;

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

    console.info(
      savedToken
        ? "🧪 V-Nexus 本地 App Check Debug Token 模式已啟用：會使用本機儲存的 token 測試已強制 App Check 的 Cloud Functions。"
        : "🧪 V-Nexus 本地 App Check Debug Token 模式已啟用：請將 Console 顯示的 debug token 加到 Firebase Console → App Check → Web App → Manage debug tokens。"
    );
    return true;
  } catch (error) {
    console.warn("⚠️ 本地 App Check Debug Token 初始化失敗，將嘗試使用正式 reCAPTCHA App Check：", error);
    return false;
  }
};

const isLocalAppCheckDebug = setupLocalAppCheckDebugToken();
let appCheck = null;

try {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(
      "6LdINZksAAAAAF5FtNfKOOsDPaHQue3SmuAVqR4M",
    ),
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
} catch (error) {
  console.warn("App Check:", error);
}

const auth = getAuth(app);

// 🌟 新增：初始化 Analytics (加上 try-catch 防止被擋廣告軟體攔截而當機)
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (error) {
  console.warn("Analytics 初始化被阻擋:", error);
}

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

const storage = getStorage(app);

const functionsInstance = getFunctions(app);

// ✅ 前景推播監聽：App 開著時收到訊息，也能即時顯示通知
let messagingInstance = null;
try {
  messagingInstance = getMessaging(app);
  onMessage(messagingInstance, (payload) => {
    const title = payload.notification?.title || "V-Nexus 通知";
    const body = payload.notification?.body || "";
    const icon = payload.notification?.icon || "https://duk.tw/u1jpPE.png";

    // 如果瀏覽器已授權通知權限，就顯示原生通知泡泡
    if (Notification.permission === "granted") {
      new Notification(title, {
        body: body,
        icon: icon,
        badge: "https://duk.tw/u1jpPE.png",
        vibrate: [200, 100, 200],
      });
    } else {
      // 沒有通知權限時，退而求其次在 console 記錄
      // （你也可以在這裡改成呼叫 showToast，但 showToast 在這個作用域外，建議用 console）
      console.info(`📨 前景推播收到：${title} - ${body}`);
    }
  });
  console.info("✅ FCM 前景推播監聽已啟動");
} catch (e) {
  console.warn("⚠️ Messaging 初始化失敗（可能是瀏覽器不支援或被封鎖）:", e);
}


const provider = new GoogleAuthProvider();
const APP_ID = "v-nexus-official";
const ONE_DAY = 1 * 60 * 60 * 1000; // 1小時的毫秒數
const VTUBER_CACHE_KEY = "vnexus_vtubers_data";
const VTUBER_CACHE_TS = "vnexus_vtubers_ts";
const STATS_CACHE_KEY = "vnexus_stats_data"; // ⚠️ 新增這行
const STATS_CACHE_TS = "vnexus_stats_ts"; // ⚠️ 新增這行
const STATS_CACHE_LIMIT = 1 * 30 * 60 * 1000; // ⚠️ 新增這行 (快取1小時)
const BULLETINS_CACHE_KEY = "vnexus_bulletins_data";
const BULLETINS_CACHE_TS = "vnexus_bulletins_ts";
const COLLABS_CACHE_KEY = "vnexus_collabs_data";
const COLLABS_CACHE_TS = "vnexus_collabs_ts";
const ARTICLES_CACHE_KEY = "vnexus_articles_data";
const ARTICLES_CACHE_TS = "vnexus_articles_ts";
const ACTIVITY_CACHE_LIMIT = 15 * 60 * 1000; // 快取 15 分鐘 (毫秒)
const ARTICLES_CACHE_LIMIT = 1 * 60 * 60 * 1000;

const getPath = (collectionName) =>
  `artifacts/${APP_ID}/public/data/${collectionName}`;

const generateRoomId = (uid1, uid2) => [uid1, uid2].sort().join("_");
const getRoomPath = (roomId) =>
  `artifacts/${APP_ID}/public/data/chat_rooms/${roomId}`;
const getMsgPath = (roomId) =>
  `artifacts/${APP_ID}/public/data/chat_rooms/${roomId}/messages`;


const initVnexusImageLoadingUX = (() => {
  let initialized = false;
  return () => {
    if (initialized || typeof document === "undefined") return;
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
          opacity: 0 !important;
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
        target.classList.add("vnexus-image-error");
      }
    }, true);
  };
})();

initVnexusImageLoadingUX();

const LazyImage = ({
  src,
  containerCls = "",
  imgCls = "",
  alt = "",
  onClick,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // 圖片壞掉時不要顯示瀏覽器破圖 icon，直接保留灰色底。
  // 圖片載入中加上更明顯的深色 shimmer，讓使用者知道畫面正在載入，而不是卡住。
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-[#1D2130] ${containerCls}`}
      aria-label={alt || "圖片"}
    >
      {!loaded && !hasError && (
        <div className="absolute inset-0 vnexus-image-skeleton z-0" aria-hidden="true"></div>
      )}
      {src && !hasError && (
        <img
          src={src}
          alt={alt}
          className={`relative z-10 w-full h-full object-cover transition-opacity duration-300 ease-out ${loaded ? "opacity-100 vnexus-image-loaded" : "opacity-0"} ${imgCls}`}
          onLoad={(e) => {
            e.currentTarget.classList.add("vnexus-image-loaded");
            setLoaded(true);
          }}
          onError={(e) => {
            e.currentTarget.classList.add("vnexus-image-error");
            setHasError(true);
            setLoaded(true);
          }}
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
};

const FloatingChat = ({
  targetVtuber,
  currentUser,
  myProfile,
  onClose,
  showToast,
  onNavigateProfile,
}) => {
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
    const q = query(
      collection(db, getMsgPath(roomId)),
      orderBy("createdAt", "desc"),
      limit(30),
    );

    const unsub = onSnapshot(q, (snap) => {
      // 因為我們是用 desc 拿最新的 50 筆，陣列順序會是 [最新, 次新, ... , 最舊]
      // 顯示在畫面上時，我們需要把它反過來，變成 [最舊, ..., 次新, 最新]，最新的才會在底部
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();

      setMessages(msgs);
      setTimeout(
        () => scrollRef.current?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    });
    return unsub;
  }, [roomId]);

  useEffect(() => {
    // 當訊息列表有變動（代表有新訊息）且視窗是開啟狀態時，自動清除自己的未讀狀態
    if (messages.length > 0 && currentUser) {
      const roomRef = doc(
        db,
        `artifacts/${APP_ID}/public/data/chat_rooms`,
        roomId,
      );
      updateDoc(roomRef, {
        unreadBy: arrayRemove(currentUser.uid),
      }).catch((e) => console.error("自動清除未讀失敗:", e));
    }
  }, [messages, currentUser.uid]);

  const handleSafetyAction = (type) => {
    if (type === "block") {
      showToast("封鎖入口已準備好，後續可接上封鎖名單功能。");
    } else {
      showToast("檢舉入口已準備好，若遇到騷擾請先截圖並聯絡管理員。");
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !currentUser || !targetVtuber?.id) return;
    if (input.trim().length > 500) return showToast("訊息不能超過 500 字！");

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
      } catch (readErr) {
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
        if (shouldSendEmail) roomUpdate.lastEmailSentAt = now;
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
        } catch (notifErr) {
          console.warn("聊天訊息已送出，但通知建立失敗:", notifErr);
        }
      }
    } catch (err) {
      console.error("發送過程出錯詳細資訊:", err);
      showToast(`傳送失敗：${err.code || ""} ${err.message || "請確認登入狀態或權限"}`);
    }
  };
  return (
    <div className="fixed inset-0 sm:inset-y-4 sm:left-auto sm:right-4 z-[100] w-full sm:w-[380px] lg:w-[420px] h-[100dvh] sm:h-[calc(100vh-2rem)] bg-[#0F111A] border-l sm:border border-[#2A2F3D] sm:rounded-2xl shadow-xl flex flex-col overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div className="bg-[#181B25] border-b border-[#2A2F3D] p-4 flex-shrink-0">
        <div className="flex justify-between items-start gap-3">
          <div
            className="flex items-start gap-3 cursor-pointer hover:opacity-90 transition-opacity min-w-0"
            onClick={() => {
              if (onNavigateProfile) onNavigateProfile(targetVtuber);
              if (window.innerWidth < 640) onClose();
            }}
            title="查看名片"
          >
            <div className="relative flex-shrink-0">
              <img
                src={sanitizeUrl(targetVtuber.avatar)}
                className="w-12 h-12 rounded-2xl border border-[#2A2F3D] object-cover bg-[#11131C]"
                alt={targetVtuber.name || "創作者頭像"}
              />
              {isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#22C55E] border-2 border-[#181B25] rounded-full"></div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-bold text-white text-base truncate">{targetVtuber.name}</h3>
                {targetVtuber.isVerified && <span className="text-[#38BDF8] text-xs flex-shrink-0">已認證</span>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1 ${targetStatus.text}`}>
                  <span className={`w-2 h-2 rounded-full ${targetStatus.dot}`}></span>{targetStatus.label}
                </span>
                <span className="text-[#94A3B8] truncate max-w-[220px]">偏好：{collabPreview}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="hover:bg-white/10 text-[#94A3B8] hover:text-white w-9 h-9 rounded-xl transition-colors flex items-center justify-center flex-shrink-0"
            aria-label="關閉聊天室"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleSafetyAction("block")}
            className="px-3 py-1.5 rounded-full border border-[#2A2F3D] text-[#94A3B8] hover:text-white hover:bg-[#1D2130] transition-colors"
          >
            封鎖
          </button>
          <button
            type="button"
            onClick={() => handleSafetyAction("report")}
            className="px-3 py-1.5 rounded-full border border-[#2A2F3D] text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors"
          >
            檢舉
          </button>
        </div>
      </div>

      {/* Gentle safety notice */}
      <div className="bg-[#11131C] border-b border-[#2A2F3D] px-4 py-3 flex-shrink-0">
        <p className="text-sm text-[#94A3B8] leading-relaxed">
          請保持禮貌，避免交換過度敏感資料；訊息僅留七天，長篇討論建議轉至 DC。
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0F111A]">
        {messages.length === 0 && (
          <div className="min-h-full flex items-center justify-center text-center px-6">
            <div className="max-w-xs">
              <div className="w-14 h-14 rounded-2xl bg-[#1D2130] border border-[#2A2F3D] flex items-center justify-center mx-auto mb-4 text-[#8B5CF6]">
                <i className="fa-regular fa-comment-dots text-xl"></i>
              </div>
              <p className="text-white font-bold mb-2">這裡還沒有訊息</p>
              <p className="text-sm text-[#94A3B8] leading-relaxed">打聲招呼，或先看看對方的名片，找一個適合一起直播的話題。</p>
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.senderId === currentUser.uid ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-sm break-words whitespace-pre-wrap ${m.senderId === currentUser.uid
                ? "bg-[#8B5CF6] text-white rounded-tr-none"
                : "bg-[#181B25] text-[#E2E8F0] rounded-tl-none border border-[#2A2F3D]"
                }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={scrollRef}></div>
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="p-3 sm:p-4 bg-[#181B25]/95 border-t border-[#2A2F3D] flex gap-2 flex-shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="打聲招呼，或聊聊想一起做的企劃..."
          className="flex-1 bg-[#0F111A] border border-[#2A2F3D] rounded-xl px-4 py-3 text-[16px] text-white outline-none focus:border-[#8B5CF6] transition-all"
        />
        <button
          type="submit"
          className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-4 sm:px-5 h-12 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 font-bold"
        >
          送出
        </button>
      </form>
    </div>
  );
};
const uploadImageToStorage = async (uid, dataStr, fileName) => {
  // 加上更嚴格的檢查：dataStr 必須是字串且長度大於 0
  if (
    typeof dataStr !== "string" ||
    !dataStr ||
    !dataStr.startsWith("data:image")
  )
    return dataStr || "";

  try {
    const storagePath =
      uid === "system"
        ? `system/${fileName}`
        : String(fileName).startsWith("bulletin_")
          ? `bulletin_covers/${uid}/${fileName}`
          : `vtubers/${uid}/${fileName}`;
    const storageRef = ref(storage, storagePath);
    await uploadString(storageRef, dataStr, "data_url");
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error("Storage 上傳失敗:", error);
    // 如果上傳失敗（例如沒開 Storage 權限），回傳空字串防止 Firestore 寫入失敗
    return "";
  }
};

const sanitizeUrl = (url) => {
  if (typeof url !== "string" || !url) return "";
  const u = url.trim();
  let decoded = u;
  try {
    let prevDecoded;
    do {
      prevDecoded = decoded;
      decoded = decodeURIComponent(decoded);
    } while (prevDecoded !== decoded && decoded.length < 2000);
  } catch (e) { }
  const normalized = decoded
    .replace(/[\s\x00-\x1f\x7f-\x9f]/g, "")
    .toLowerCase();
  if (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("vbscript:") ||
    normalized.startsWith("data:text")
  ) {
    return "about:blank";
  }

  // ✅ Storage / App Check 相容：保留 Firebase Storage download token，避免圖片 403。

  return u;
};


const StatusCommentsBox = ({
  storyOwner,
  currentUser,
  myProfile,
  isAdmin,
  isVerifiedUser,
  realVtubers,
  showToast,
}) => {
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
      if (!expanded && rows.length > 3) rows = rows.slice(-3);
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
    if (!currentUser) return showToast("請先登入！");
    if (!isVerifiedUser) return showToast("需通過名片認證才能留言！");
    if (!text) return;
    if (text.length > 200) return showToast("留言最多 200 字");
    setSubmitting(true);
    try {
      const authToken = await auth.currentUser?.getIdToken(true);
      const fn = httpsCallable(functionsInstance, "addStatusComment");
      await fn({ storyOwnerId: ownerId, statusMessageUpdatedAt, text, authToken });
      setInput("");
      showToast("留言已送出");
    } catch (err) {
      console.error("新增動態留言失敗:", err);
      showToast(err?.message || "留言失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!commentId || deletingId) return;
    if (!confirm("確定要刪除這則留言嗎？")) return;
    setDeletingId(commentId);
    try {
      const authToken = await auth.currentUser?.getIdToken(true);
      const fn = httpsCallable(functionsInstance, "deleteStatusComment");
      await fn({ storyOwnerId: ownerId, commentId, authToken });
      showToast("留言已刪除");
    } catch (err) {
      console.error("刪除動態留言失敗:", err);
      showToast(err?.message || "刪除留言失敗");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-[#2A2F3D]/70" onClick={(e) => e.stopPropagation()}>
      {comments.length > 0 && (
        <div className="space-y-2 mb-3">
          {comments.map((comment) => {
            const commenter = realVtubers.find((v) => v.id === comment.commenterId);
            const canDelete = isAdmin || currentUser?.uid === ownerId || currentUser?.uid === comment.commenterId;
            return (
              <div key={comment.id} className="flex items-start gap-2 group/comment">
                <img
                  src={sanitizeUrl(comment.commenterAvatar || commenter?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Anon")}
                  className="w-7 h-7 rounded-full object-cover border border-[#2A2F3D] flex-shrink-0"
                  alt={comment.commenterName || commenter?.name || "留言者"}
                />
                <div className="min-w-0 flex-1 rounded-2xl bg-[#11131C] border border-[#2A2F3D] px-3 py-2">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="min-w-0 flex items-center gap-2 text-[11px]">
                      <span className="text-[#CBD5E1] font-bold truncate">{comment.commenterName || commenter?.name || "創作者"}</span>
                      <span className="text-[#64748B] flex-shrink-0">{formatRelativeTime(comment.createdAt)}</span>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        disabled={deletingId === comment.id}
                        onClick={() => handleDelete(comment.id)}
                        className="opacity-70 sm:opacity-0 group-hover/comment:opacity-100 text-[#94A3B8] hover:text-[#EF4444] transition-all text-[11px] flex-shrink-0"
                        title="刪除留言"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    )}
                  </div>
                  <p className="text-[#E2E8F0] text-sm leading-relaxed whitespace-pre-wrap break-words">{comment.text}</p>
                </div>
              </div>
            );
          })}
          {!expanded && hasMoreComments && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-[#94A3B8] hover:text-[#F59E0B] text-xs font-bold transition-colors"
            >
              查看更多留言
            </button>
          )}
          {expanded && comments.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-[#94A3B8] hover:text-[#F59E0B] text-xs font-bold transition-colors"
            >
              收合留言
            </button>
          )}
        </div>
      )}

      {currentUser && isVerifiedUser ? (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <img
            src={sanitizeUrl(myProfile?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Me")}
            className="w-8 h-8 rounded-full object-cover border border-[#2A2F3D] flex-shrink-0"
            alt="我的頭像"
          />
          <div className="flex-1 min-w-0 relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 200))}
              maxLength="200"
              className="w-full h-10 rounded-full bg-[#0F111A] border border-[#2A2F3D] px-4 pr-14 text-sm text-white outline-none focus:border-[#F59E0B] transition-colors"
              placeholder="留言回應這則動態..."
            />
            <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-[10px] ${input.length >= 190 ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>
              {input.length}/200
            </span>
          </div>
          <button
            type="submit"
            disabled={!input.trim() || submitting}
            className={`h-10 px-3 rounded-full text-xs font-bold transition-colors flex-shrink-0 ${input.trim() && !submitting ? 'bg-[#F59E0B] hover:bg-[#D97706] text-[#0F111A]' : 'bg-[#1D2130] text-[#64748B] cursor-not-allowed'}`}
          >
            送出
          </button>
        </form>
      ) : (
        <p className="text-[11px] text-[#64748B]">需登入並通過名片認證後才能留言。</p>
      )}
    </div>
  );
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
    if (!form.title.trim() || !form.content.trim()) return showToast('標題與內容為必填！');
    if (!isVerifiedUser) return showToast('需通過名片認證才能發表文章！');
    await onPublish(form);
    setForm({ title: '', category: ARTICLE_CATEGORIES[0], content: '', coverUrl: '' });
    setActiveTab('mine');
  };

  const handleCoverUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
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
      if (line.startsWith('## ')) return <h2 key={idx} className="text-2xl font-bold text-white mt-6 mb-3">{line.replace('## ', '')}</h2>;
      if (line.startsWith('### ')) return <h3 key={idx} className="text-xl font-bold text-[#7DD3FC] mt-4 mb-2">{line.replace('### ', '')}</h3>;
      if (line.startsWith('- ')) return <li key={idx} className="text-[#CBD5E1] ml-4 mb-1 list-disc flex items-start gap-2"><span className="text-[#38BDF8] mt-1">•</span> <span>{line.replace('- ', '')}</span></li>;
      return <p key={idx} className="text-[#CBD5E1] leading-relaxed mb-4 min-h-[1.5rem]">{line}</p>;
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-[#38BDF8] flex items-center gap-3"><i className="fa-solid fa-book-open-reader"></i> VTuber 寶典</h2>
          <p className="text-[#94A3B8] mt-2 text-sm">分享經驗、學習成長，讓您的 V 圈之路少走彎路。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('list')} className={`px-4 py-2 rounded-xl font-bold transition-all ${activeTab === 'list' || activeTab === 'read' ? 'bg-[#38BDF8] text-[#0F111A]' : 'bg-[#181B25] text-[#94A3B8] hover:bg-[#1D2130]'}`}>文章列表</button>
          {isVerifiedUser && <button onClick={() => setActiveTab('mine')} className={`px-4 py-2 rounded-xl font-bold transition-all ${activeTab === 'mine' ? 'bg-[#38BDF8] text-[#0F111A]' : 'bg-[#181B25] text-[#94A3B8] hover:bg-[#1D2130]'}`}>我的文章</button>}
          {isVerifiedUser && <button onClick={() => setActiveTab('create')} className={`px-4 py-2 rounded-xl font-bold transition-all ${activeTab === 'create' ? 'bg-[#22C55E] text-[#0F111A]' : 'bg-[#181B25] text-[#94A3B8] hover:bg-[#1D2130]'}`}><i className="fa-solid fa-pen-nib mr-1"></i> 寫文章</button>}
        </div>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-6">
          {/* 👇 將原本單純的列表改成 flex 排版，左邊分類、右邊排序 */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

            {/* 左側：文章分類 */}
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar flex-1 w-full sm:w-auto">
              <button onClick={() => setFilterCategory('All')} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filterCategory === 'All' ? 'bg-[#38BDF8] text-[#0F111A]' : 'bg-[#181B25] text-[#94A3B8] hover:bg-[#1D2130]'}`}>全部</button>
              {ARTICLE_CATEGORIES.map(c => (
                <button key={c} onClick={() => setFilterCategory(c)} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filterCategory === c ? 'bg-[#38BDF8] text-[#0F111A]' : 'bg-[#181B25] text-[#94A3B8] hover:bg-[#1D2130]'}`}>{c}</button>
              ))}
            </div>

            {/* 右側：排序下拉選單 */}
            <div className="flex items-center gap-2 flex-shrink-0 bg-[#181B25]/80 p-1.5 rounded-xl border border-[#2A2F3D]">
              <span className="text-sm text-[#94A3B8] font-bold ml-2"><i className="fa-solid fa-sort"></i> 排序</span>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                className="bg-[#0F111A] border border-[#2A2F3D] text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-[#38BDF8] transition-colors cursor-pointer"
              >
                <option value="latest">最新發布</option>
                <option value="popular">最受歡迎 (最多閱讀)</option>
              </select>
            </div>

          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayList.length === 0 ? (
              <div className="col-span-3 text-center py-12 px-6 bg-[#181B25] rounded-2xl border border-[#2A2F3D]">
                <p className="text-[#F8FAFC] font-bold text-lg">這個分類還沒有文章</p>
                <p className="text-[#94A3B8] text-sm mt-2">分享你的經驗，讓下一位創作者少走一點彎路。</p>
              </div>
            ) : displayList.map(a => {
              const author = realVtubers.find(v => v.id === a.userId);
              return (
                <div key={a.id} onClick={() => { setSelectedArticle(a); setActiveTab('read'); if (onIncrementView) onIncrementView(a.id); }} className="bg-[#181B25]/60 border border-[#2A2F3D] rounded-2xl overflow-hidden hover:border-[#38BDF8]/50 hover:shadow-sm cursor-pointer transition-all flex flex-col h-full group">
                  {a.coverUrl && (
                    <div className="h-40 overflow-hidden relative">
                      <img src={sanitizeUrl(a.coverUrl)} className="w-full h-full object-cover group-transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-950/70 to-transparent"></div>
                      <span className="absolute bottom-2 left-3 bg-[#38BDF8] text-[#0F111A] text-[10px] font-bold px-2 py-0.5 rounded shadow">{a.category}</span>
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col">
                    {!a.coverUrl && <span className="bg-[#38BDF8] text-[#0F111A] text-[10px] font-bold px-2 py-0.5 rounded shadow w-fit mb-2">{a.category}</span>}
                    <h3 className="font-bold text-white text-lg mb-2 line-clamp-2 group-hover:text-[#38BDF8] transition-colors">{a.title}</h3>
                    <p className="text-sm text-[#94A3B8] line-clamp-3 mb-4">{a.content.replace(/[#*]/g, '')}</p>
                    <div className="mt-auto pt-4 border-t border-[#2A2F3D] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={sanitizeUrl(author?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anon')} className="w-8 h-8 rounded-full border border-[#2A2F3D] object-cover flex-shrink-0" />
                        <div className="text-xs min-w-0">
                          <p className="text-[#CBD5E1] font-bold truncate">{author?.name || '匿名創作者'}</p>
                          <p className="text-[#64748B]">{formatTime(a.createdAt)}</p>
                        </div>
                      </div>
                      <div className="text-xs text-[#64748B] font-bold flex items-center gap-1.5 flex-shrink-0">
                        <i className="fa-solid fa-eye"></i> {a.views || 0}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'read' && currentArticle && (
        <div className="bg-[#181B25]/40 border border-[#2A2F3D] rounded-2xl p-6 sm:p-10 shadow-sm relative">
          <button onClick={() => setActiveTab('list')} className="text-[#38BDF8] hover:text-white mb-6 font-bold text-sm flex items-center gap-2 transition-colors"><i className="fa-solid fa-arrow-left"></i> 返回列表</button>
          {currentArticle.coverUrl && <img src={sanitizeUrl(currentArticle.coverUrl)} className="w-full h-64 sm:h-96 object-cover rounded-2xl mb-8 border border-[#2A2F3D]" />}

          <div className="flex items-center gap-3 mb-4">
            <span className="bg-[#38BDF8] text-[#0F111A] text-xs font-bold px-3 py-1 rounded-full">{currentArticle.category}</span>
            <span className="text-[#94A3B8] text-sm flex items-center gap-1"><i className="fa-regular fa-clock"></i>{formatTime(currentArticle.createdAt)}</span>
            {/* 👇 觀看數直接讀取最新同步的真實資料，不再使用強制 +1 的假象 */}
            <span className="text-[#94A3B8] text-sm flex items-center gap-1"><i className="fa-solid fa-eye"></i>{currentArticle.views || 0}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-8 leading-tight">{currentArticle.title}</h1>

          <div className="flex items-center gap-4 mb-8 pb-8 border-b border-[#2A2F3D]">
            <img src={sanitizeUrl(realVtubers.find(v => v.id === currentArticle.userId)?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anon')} className="w-12 h-12 rounded-full border border-[#38BDF8]/50 object-cover" />
            <div>
              <p className="text-[#E2E8F0] font-bold">{realVtubers.find(v => v.id === currentArticle.userId)?.name || '匿名創作者'}</p>
              <p className="text-xs text-[#64748B]">文章作者</p>
            </div>
          </div>

          <article className="prose prose-invert prose-blue max-w-none text-[#CBD5E1]">
            {renderContent(currentArticle.content)}
          </article>
        </div>
      )}

      {activeTab === 'mine' && (
        <div className="space-y-4">
          {myArticles.length === 0 ? (
            <div className="text-center py-12 px-6 bg-[#181B25]/40 rounded-2xl border border-[#2A2F3D]">
              <p className="text-[#F8FAFC] font-bold text-lg">你還沒有發表文章</p>
              <p className="text-[#94A3B8] text-sm mt-2">把你的直播經驗、企劃心得或踩雷筆記分享給大家吧。</p>
            </div>
          ) : myArticles.map(a => (
            <div key={a.id} className="bg-[#181B25] border border-[#2A2F3D] p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-[#38BDF8]/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {a.status === 'published' ? <span className="bg-[#22C55E]/20 text-[#22C55E] text-[10px] font-bold px-2 py-0.5 rounded border border-[#22C55E]/30 flex items-center gap-1"><i className="fa-solid fa-check"></i>已發布</span> : <span className="bg-[#F59E0B]/20 text-[#F59E0B] text-[10px] font-bold px-2 py-0.5 rounded border border-[#F59E0B]/30 flex items-center gap-1"><i className="fa-solid fa-hourglass-half"></i>審核中</span>}
                  <span className="text-[#38BDF8] text-[10px] font-bold px-2 py-0.5 rounded bg-[#38BDF8]/10 border border-[#38BDF8]/20">{a.category}</span>
                </div>
                <h3 className="font-bold text-white text-lg truncate">{a.title}</h3>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-xs text-[#64748B]">發布時間: {formatTime(a.createdAt)}</p>
                  <p className="text-xs text-[#64748B] font-bold flex items-center gap-1"><i className="fa-solid fa-eye"></i> {a.views || 0}</p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                {a.status === 'published' && <button onClick={() => { setSelectedArticle(a); setActiveTab('read'); if (onIncrementView) onIncrementView(a.id); }} className="flex-1 sm:flex-none bg-[#38BDF8] hover:bg-[#38BDF8] text-[#0F111A] px-4 py-2 rounded-xl text-sm font-bold transition-colors">閱讀</button>}
                <button onClick={() => onDelete(a.id)} className="flex-1 sm:flex-none bg-[#3B171D]/50 hover:bg-[#7F1D1D] text-[#EF4444] hover:text-white border border-[#EF4444]/30 px-4 py-2 rounded-xl text-sm font-bold transition-colors">刪除文章</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'create' && (
        <form onSubmit={handlePublish} className="bg-[#181B25]/40 border border-[#2A2F3D] rounded-2xl p-6 sm:p-10 shadow-sm space-y-6">
          <div className="bg-blue-900/20 border border-[#38BDF8]/30 p-4 rounded-xl text-[#7DD3FC] text-sm mb-6 flex items-start gap-2">
            <i className="fa-solid fa-circle-info mt-1"></i>
            <span>發表文章後需經管理員審核才會公開顯示。支援簡易語法（<code>## 標題2</code>, <code>### 標題3</code>, <code>- 列表項目</code>）。</span>
          </div>
          <div>
            <label className="block text-sm font-bold text-[#CBD5E1] mb-2">文章標題 <span className="text-[#EF4444]">*</span></label>
            <input required type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-3 text-white focus:ring-[#8B5CF6] outline-none" placeholder="請輸入吸引人的標題..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">文章分類 <span className="text-[#EF4444]">*</span></label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-3 text-white focus:ring-[#8B5CF6] outline-none">
                {ARTICLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">封面圖網址 (選填)</label>
              {/* 👇 替換成上傳檔案與預覽介面 */}
              <div className="flex items-center gap-4">
                {form.coverUrl && form.coverUrl.startsWith('data:image') && (
                  <div className="relative h-12 w-20 rounded-lg overflow-hidden border border-[#2A2F3D] flex-shrink-0">
                    <img src={form.coverUrl} className="w-full h-full object-cover" alt="封面預覽" />
                    <button type="button" onClick={() => setForm({ ...form, coverUrl: '' })} className="absolute top-0 right-0 bg-[#EF4444]/80 hover:bg-[#EF4444] text-white w-5 h-5 flex items-center justify-center text-[10px] backdrop-blur-sm"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="w-full bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-2 text-[#94A3B8] focus:ring-[#8B5CF6] outline-none file:cursor-pointer file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-[#8B5CF6]/20 file:text-[#A78BFA] hover:file:bg-[#8B5CF6]/30 transition-colors"
                />
              </div>
              {/* 👆 替換結束 */}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-[#CBD5E1] mb-2">文章內容 <span className="text-[#EF4444]">*</span></label>
            <textarea required rows="15" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="w-full bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-3 text-white focus:ring-[#8B5CF6] outline-none font-mono text-sm leading-relaxed" placeholder="在此輸入文章內容..." />
          </div>
          <div className="flex justify-end pt-4 border-t border-[#2A2F3D]">
            <button type="submit" className="bg-[#22C55E] hover:bg-[#22C55E] text-[#0F111A] px-8 py-3 rounded-xl font-bold shadow-sm transition-transform flex items-center gap-2"><i className="fa-solid fa-paper-plane"></i> 送出審核</button>
          </div>
        </form>
      )}
    </div>
  );
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
const btnCls =
  "w-full sm:w-auto bg-[#8B5CF6] hover:bg-[#8B5CF6] text-white py-3 px-8 rounded-xl font-bold shadow-sm transition-transform flex justify-center items-center gap-2";

const formatTime = (ts) => {
  if (!ts) return "剛剛";
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// 🌟 新增：將時間戳記轉換為「發布了 X 分鐘/小時」的相對時間格式
const formatRelativeTime = (ts) => {
  if (!ts) return "剛剛發布";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (mins < 1) return "剛剛發布";
  if (mins < 60) return ` ${mins} 分鐘前發布`;
  if (hours < 24) return ` ${hours} 小時前發布`;
  return ` ${days} 天前發布`;
};

const formatDateTimeLocalStr = (dtStr) => {
  if (!dtStr) return "未指定";
  const d = new Date(dtStr);
  if (isNaN(d.getTime())) return dtStr;
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const formatDateOnly = (value) => {
  if (!value) return "可討論";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
};
const formatSchedule = (v) => {
  if (v.isScheduleAnytime) return "我都可以 (隨時可約)";
  if (v.isScheduleCustom && v.customScheduleText) return v.customScheduleText;
  if (v.isScheduleExcept && v.scheduleSlots?.length > 0)
    return (
      "除了：" +
      v.scheduleSlots.map((s) => `${s.day} ${s.start}~${s.end}`).join("、") +
      "，其餘皆可"
    );
  if (v.scheduleSlots?.length > 0)
    return v.scheduleSlots
      .map((s) => `${s.day} ${s.start}~${s.end}`)
      .join("、");
  return v.schedule || "未提供時段";
};
const getYouTubeThumbnail = (url) => {
  if (!url || typeof url !== "string") return null;
  const match = url.match(
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/,
  );
  return match && match[2].length === 11
    ? `https://img.youtube.com/vi/${match[2]}/maxresdefault.jpg`
    : null;
};

const autoFetchYouTubeInfo = async (url, setTitle, setCoverUrl, showToast) => {
  if (!url) return showToast("請先輸入 YouTube 連結");
  const ytMatch = url.match(
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/,
  );
  if (ytMatch && ytMatch[2].length === 11) {
    setCoverUrl(`https://img.youtube.com/vi/${ytMatch[2]}/maxresdefault.jpg`);
    try {
      const res = await fetch(
        `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytMatch[2]}`,
      );
      const data = await res.json();
      if (data.title) setTitle(data.title);
      showToast("✅ 已自動抓取標題與封面圖！");
    } catch (e) {
      showToast("✅ 已自動填入封面圖！(標題需手動輸入)");
    }
  } else {
    showToast("這似乎不是有效的 YouTube 連結");
  }
};

const parseSubscribers = (v) => {
  const parseStr = (str) => {
    if (!str) return 0;
    let s = String(str);
    // 關鍵修正：增加防呆，確保 replace 只作用於字串
    let num = parseFloat(s.replace(/[^0-9.]/g, ""));
    if (isNaN(num)) return 0;
    if (s.toUpperCase().includes("K")) num *= 1000;
    if (s.toUpperCase().includes("M")) num *= 1000000;
    if (s.toUpperCase().includes("萬")) num *= 10000;
    return num;
  };
  return (
    parseStr(v.youtubeSubscribers || v.subscribers) +
    parseStr(v.twitchFollowers)
  );
};


const formatSocialCount = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (/萬|K|M/i.test(raw)) return raw;
  const num = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(num) || num <= 0) return raw;
  if (num >= 10000) return `${(num / 10000).toFixed(1).replace(".0", "")}萬`;
  if (num >= 1000) return `${(num / 1000).toFixed(1).replace(".0", "")}K`;
  return num.toLocaleString("zh-TW");
};

const normalizeProfileList = (value) => {
  if (!Array.isArray(value)) return [];
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
  if (!text) return "相似的內容";

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
  if (!me) return "登入並完成名片後，AI 會依你的喜好自動判斷";

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

  const myScheduleDays = getSharedProfileItems(
    normalizeProfileList(me.scheduleSlots?.map?.((slot) => slot?.day)),
    normalizeProfileList(target.scheduleSlots?.map?.((slot) => slot?.day)),
  );
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
  if (!me) return Math.floor(Math.random() * 30) + 60;

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
    if (me.personalityType !== target.personalityType) score += 8; // 互補加分較多
    else score += 4; // 相同也加分
  }

  // 5. 創作型態相同
  if (me.streamingStyle && me.streamingStyle === target.streamingStyle) score += 5;

  return Math.min(99, score); // 最高 99%，保留一點真實感
};

const isVisible = (v, currentUser) => {
  if (!v || !v.id) return false; // 確保 v 及其 id 存在
  if (currentUser && v.id === currentUser.uid) return true;
  if (String(v.id || "").startsWith("mock")) return true;
  if (!v.isVerified || v.isBlacklisted) return false;
  if (v.activityStatus === "sleep" || v.activityStatus === "graduated")
    return false;

  // 修正：處理 Firebase Timestamp 物件轉換為數字
  const getTime = (val) => {
    if (!val) return Date.now();
    if (typeof val === "number") return val;
    if (val.toMillis) return val.toMillis();
    return Date.now();
  };

  const lastActive = getTime(v.lastActiveAt || v.updatedAt || v.createdAt);
  if (Date.now() - lastActive > 30 * 24 * 60 * 60 * 1000) return false;
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
  if (v.isBlacklisted) return { label: "暫停顯示", emoji: "⛔", cls: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30" };
  if (v.isVerified) return { label: "已認證", emoji: "✅", cls: "bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/30" };
  return { label: "待審核", emoji: "🟡", cls: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30" };
};

const StatusPill = ({ meta, className = "" }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${meta.cls} ${className}`}>
    <span aria-hidden="true">{meta.emoji}</span>
    {meta.label}
  </span>
);

const TagBadge = ({ text, onClick, selected }) => (
  <span
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors border ${selected ? "bg-[#8B5CF6] text-white border-[#8B5CF6]/60" : "bg-[#181B25] text-[#CBD5E1] border-[#2A2F3D] hover:bg-[#1D2130] hover:text-white"}`}
  >
    {text}
  </span>
);

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
      if (!startTimestamp) startTimestamp = timestamp;
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

  return <span>{displayValue.toLocaleString()}</span>;
};

const CollabCard = React.memo(({
  c,
  isLive,
  isAdmin,
  user,
  onDeleteCollab,
  vtuber,
  onNavigateProfile,
  realVtubers,
  onShowParticipants,
}) => {
  if (!c) return null;
  const displayImg = sanitizeUrl(
    c.coverUrl ||
    getYouTubeThumbnail(c.streamUrl) ||
    "https://duk.tw/bs1Moc.jpg",
  );

  return (
    <div
      className={`group h-full ${isLive ? "bg-[#2A1418]/40 border border-[#EF4444] shadow-sm transform scale-[1.02] z-10" : "bg-[#181B25]/60 border border-[#2A2F3D] hover:border-[#EF4444]/50 "} rounded-2xl overflow-hidden flex flex-col transition-all relative w-full`}
    >
      {isLive && (
        <div className="absolute top-0 left-0 w-full bg-[#EF4444] text-white text-center py-1.5 font-bold text-xs tracking-widest z-30">
          <i className="fa-solid fa-satellite-dish mr-2"></i> 正在進行聯動中
        </div>
      )}
      {onDeleteCollab && (isAdmin || (user && c.userId === user.uid)) && (
        <button
          onClick={() => onDeleteCollab(c.id)}
          className={`absolute ${isLive ? "top-10" : "top-4"} right-4 z-20 bg-black/60 backdrop-blur-md text-[#CBD5E1] hover:text-[#EF4444] hover:bg-black/80 p-2 rounded-lg transition-colors`}
          title="刪除此行程"
        >
          <i className="fa-solid fa-trash"></i>
        </button>
      )}
      <div
        className={`h-48 relative overflow-hidden flex-shrink-0 ${isLive ? "mt-8" : ""}`}
      >
        <img
          src={displayImg}
          className="w-full h-full object-cover group-transition-transform duration-700"
          alt="聯動封面"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/70 to-transparent"></div>
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-[#2A2F3D] text-white px-3 py-1.5 rounded-xl flex flex-col items-center shadow-sm transform -rotate-2">
          <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider mb-0.5">
            {c.date}
          </span>
          <span className="text-sm text-[#EF4444] font-extrabold">{c.time}</span>
        </div>
        {c.streamUrl && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
            <div
              className={`w-16 h-16 ${isLive ? "bg-[#EF4444]" : "bg-[#EF4444]/90"} text-white rounded-full flex items-center justify-center pl-1 shadow-sm backdrop-blur-sm`}
            >
              <i className="fa-solid fa-play text-2xl"></i>
            </div>
          </div>
        )}
      </div>
      <div className="p-6 flex-1 flex flex-col relative z-10 bg-[#0F111A]/80">
        <div className="mb-2">
          <span className="bg-[#8B5CF6]/20 text-[#C4B5FD] text-[10px] px-2 py-1 rounded-lg border border-white/10 font-bold">
            {c.category || "遊戲"}
          </span>
        </div>
        <h3
          className={`text-xl font-extrabold text-white mb-6 line-clamp-2 leading-tight transition-colors ${isLive ? "text-[#EF4444]" : "group-hover:text-[#EF4444]"}`}
        >
          {c.title}
        </h3>
        {/* 👇 加上防呆確保 isArray 才 map */}
        {Array.isArray(c.participants) && c.participants.length > 0 && (
          <div
            className="flex items-center gap-2 mb-4 cursor-pointer hover:bg-[#181B25]/50 p-1 -ml-1 rounded-lg transition-colors group/members"
            onClick={(e) => {
              e.stopPropagation();
              onShowParticipants(c);
            }}
          >
            <span className="text-[10px] text-[#64748B] font-bold">
              聯動成員:
            </span>
            <div className="flex -space-x-2">
              {c.participants.map((pId) => {
                const pVt = realVtubers.find((v) => v.id === pId);
                return pVt ? (
                  <img
                    key={pId}
                    src={sanitizeUrl(pVt.avatar)}
                    className="w-6 h-6 rounded-full border border-gray-900 object-cover"
                  />
                ) : null;
              })}
            </div>
            <span className="text-[10px] text-[#A78BFA] opacity-0 group-hover/members:opacity-100 transition-opacity ml-1">
              查看名單
            </span>
          </div>
        )}
        <div className="mt-auto">
          {c.streamUrl ? (
            <a
              href={sanitizeUrl(c.streamUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full ${isLive ? "bg-[#EF4444] shadow-sm" : "bg-[#EF4444] hover:bg-[#EF4444] group-hover:shadow-sm"} text-white py-3.5 rounded-xl font-bold transition-all flex justify-center items-center gap-2`}
            >
              <i className="fa-solid fa-play-circle text-lg"></i> 前往待機室 /
              觀看直播
            </a>
          ) : (
            <div className="w-full bg-[#181B25] text-[#64748B] py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 border border-[#2A2F3D]">
              <i className="fa-solid fa-clock"></i> 直播連結尚未提供
            </div>
          )}
          {vtuber && vtuber.id !== "admin" && onNavigateProfile && (
            <div
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNavigateProfile(vtuber);
              }}
              className="mt-4 pt-4 border-t border-[#2A2F3D]/50 flex items-center justify-between cursor-pointer group/author hover:bg-[#181B25]/80 p-2 -mx-2 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <img
                  src={sanitizeUrl(vtuber.avatar)}
                  className="w-8 h-8 rounded-full border border-[#2A2F3D] object-cover"
                />
                <div className="text-left">
                  <p className="text-[10px] text-[#94A3B8] mb-0.5">發起人</p>
                  <p className="text-sm font-bold text-white group-hover/author:text-[#A78BFA] transition-colors truncate max-w-[150px]">
                    {vtuber.name}
                  </p>
                </div>
              </div>
              <button className="text-xs bg-[#1D2130] text-[#CBD5E1] px-3 py-1.5 rounded-lg group-hover/author:bg-[#8B5CF6] group-hover/author:text-white transition-colors font-bold">
                <i className="fa-solid fa-id-card mr-1.5"></i>查看名片
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // 🌟 優化：自訂比對邏輯，避免 realVtubers 陣列改變導致無意義的重繪
  return (
    prevProps.c.id === nextProps.c.id &&
    prevProps.isLive === nextProps.isLive &&
    // 參與人數有變動時才重繪 (例如有人加入聯動)
    prevProps.c.participants?.length === nextProps.c.participants?.length &&
    // 登入的使用者改變時才重繪 (影響刪除按鈕的顯示)
    prevProps.user?.uid === nextProps.user?.uid &&
    prevProps.isAdmin === nextProps.isAdmin &&
    // 發起人資料改變時才重繪
    prevProps.vtuber?.id === nextProps.vtuber?.id
  );
});

const VTuberCard = React.memo(({ v, onSelect, onDislike }) => {
  const { user, realVtubers, onlineUsers } = useContext(AppContext);
  const myProfile = user ? realVtubers.find((item) => item.id === user.uid) : null;
  const compatibilityScore = user && v.id !== user.uid ? calculateCompatibility(myProfile, v) : null;
  const compatibilityReason = user && v.id !== user.uid ? buildCompatibilityInsight(myProfile, v) : "";

  const isLiveMsg = v.statusMessage && v.statusMessage.includes('🔴');
  const expireLimit = isLiveMsg ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const isStatusValid =
    v.statusMessage &&
    v.statusMessageUpdatedAt &&
    Date.now() - v.statusMessageUpdatedAt < expireLimit;
  const isLive = isStatusValid && isLiveMsg;
  const isOnline = onlineUsers?.has(v.id);

  const profileTags = Array.from(
    new Set([
      ...(Array.isArray(v.collabTypes) ? v.collabTypes : []),
      ...(Array.isArray(v.tags) ? v.tags : []),
    ].filter(Boolean)),
  ).slice(0, 3);

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
  const introText =
    (isStoryStatus && v.statusMessage) ||
    v.description ||
    '這位創作者還沒有填寫自我介紹。';

  const platformLabel = v.mainPlatform || (v.twitchUrl ? 'Twitch' : 'YouTube');

  return (
    <article
      onClick={onSelect}
      className="group h-full bg-[#181B25] hover:bg-[#1D2130] border border-[#2A2F3D] hover:border-[#8B5CF6]/40 rounded-2xl overflow-hidden cursor-pointer transition-colors flex flex-col"
    >
      <div className="h-20 relative overflow-hidden bg-[#11131C] border-b border-[#2A2F3D]">
        <LazyImage
          src={sanitizeUrl(v.banner)}
          containerCls="absolute inset-0 w-full h-full"
          imgCls="opacity-45 group-hover:opacity-55 transition-opacity"
          alt={`${v.name || 'VTuber'} 橫幅`}
        />
        <div className="absolute inset-0 bg-[#0F111A]/35"></div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start gap-3 -mt-10 mb-3 relative z-10">
          <LazyImage
            src={sanitizeUrl(v.avatar)}
            containerCls="w-16 h-16 rounded-2xl border border-[#2A2F3D] bg-[#11131C] flex-shrink-0"
            imgCls="rounded-2xl"
            alt={`${v.name || 'VTuber'} 頭像`}
          />

          <div className="min-w-0 flex-1 pt-8">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-bold text-[#F8FAFC] truncate leading-tight">
                {v.name || '未命名創作者'}
              </h3>
              {v.isVerified && (
                <i className="fa-solid fa-circle-check text-[#38BDF8] text-xs flex-shrink-0" title="已認證"></i>
              )}
            </div>
            <p className="text-xs text-[#94A3B8] truncate mt-0.5">
              {v.agency || '個人勢'} · {platformLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mb-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${statusMeta.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`}></span>
            {statusMeta.label}
          </span>
          {v.zodiacSign && (
            <span className="text-xs text-[#94A3B8] flex-shrink-0">
              {v.zodiacSign}
            </span>
          )}
        </div>

        {isStoryStatus ? (
          <div className="mb-4 min-h-[2.5rem]">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#F59E0B] mb-1">
              <i className="fa-solid fa-stopwatch"></i>
              限時動態
            </div>
            <p className="text-sm text-[#F59E0B] leading-relaxed line-clamp-2">
              {introText}
            </p>
          </div>
        ) : (
          <p className="text-sm text-[#CBD5E1] leading-relaxed line-clamp-2 min-h-[2.5rem] mb-4">
            {introText}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-4 min-h-[1.75rem]">
          {profileTags.length > 0 ? (
            profileTags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full bg-[#11131C] border border-[#2A2F3D] text-[#94A3B8] text-xs"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-[#11131C] border border-[#2A2F3D] text-[#64748B] text-xs">
              尚未設定標籤
            </span>
          )}
        </div>

        {Array.isArray(v.creatorRoles) && v.creatorRoles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4 -mt-1">
            {v.creatorRoles.slice(0, 2).map((role) => (
              <span key={role} className="px-2 py-0.5 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/25 text-[#7DD3FC] text-[11px] font-bold">
                也接{role === "繪師" ? "繪圖" : role === "剪輯師" ? "剪輯" : "建模"}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-[#2A2F3D] space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#94A3B8] min-w-0">
            <i className="fa-solid fa-clock text-[#8B5CF6] w-4 text-center flex-shrink-0"></i>
            <span className="truncate">{formatSchedule(v)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#94A3B8] min-w-0">
            <i className={`fa-brands fa-${platformLabel === 'Twitch' ? 'twitch' : 'youtube'} ${platformLabel === 'Twitch' ? 'text-[#8B5CF6]' : 'text-[#EF4444]'} w-4 text-center flex-shrink-0`}></i>
            <span className="truncate">主要平台：{platformLabel}</span>
          </div>

          {compatibilityScore !== null && (
            <div className="pt-2">
              <div className="flex items-center justify-between gap-2 text-xs mb-1.5 min-w-0">
                <span className="font-extrabold text-[#F472B6] flex items-center gap-1.5 flex-shrink-0">
                  <i className="fa-solid fa-heart"></i> {compatibilityScore}%
                </span>
                {compatibilityReason && (
                  <span className="ml-auto max-w-[70%] text-right text-[11px] text-[#FBCFE8] bg-[#F472B6]/10 border border-[#F472B6]/20 rounded-full px-2.5 py-1 truncate min-w-0">
                    {compatibilityReason}
                  </span>
                )}
              </div>
              <div className="h-2 rounded-full bg-[#0F111A] border border-[#2A2F3D] overflow-hidden" aria-label={`契合度 ${compatibilityScore}%`}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#F472B6] to-[#EC4899]"
                  style={{ width: `${Math.max(8, Math.min(100, compatibilityScore))}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.v.updatedAt === nextProps.v.updatedAt &&
    prevProps.v.likes === nextProps.v.likes &&
    prevProps.v.dislikes === nextProps.v.dislikes &&
    prevProps.v.statusMessage === nextProps.v.statusMessage &&
    prevProps.v.statusMessageUpdatedAt === nextProps.v.statusMessageUpdatedAt &&
    prevProps.v.activityStatus === nextProps.v.activityStatus
  );
});

const BulletinSkeleton = () => (
  <div className="bg-[#181B25]/40 border border-[#2A2F3D] rounded-2xl overflow-hidden flex flex-col shadow-sm">
    {/* 頂部圖片骨架 */}
    <div className="w-full h-48 sm:h-56 bg-[#1D2130]/30"></div>

    {/* 頭部資訊骨架 */}
    <div className="bg-[#0F111A]/60 p-5 border-b border-[#2A2F3D]/50 flex items-start gap-4">
      <div className="w-14 h-14 rounded-full bg-[#1D2130]/50 flex-shrink-0"></div>
      <div className="flex-1 space-y-3 py-2">
        <div className="h-4 bg-[#1D2130]/50 rounded-md w-1/3"></div>
        <div className="h-3 bg-[#1D2130]/50 rounded-md w-1/4"></div>
      </div>
    </div>

    {/* 內容區骨架 */}
    <div className="p-6 flex-1 flex flex-col">
      <div className="space-y-3 mb-6">
        <div className="h-3 bg-[#1D2130]/50 rounded-md w-full"></div>
        <div className="h-3 bg-[#1D2130]/50 rounded-md w-5/6"></div>
        <div className="h-3 bg-[#1D2130]/50 rounded-md w-4/6"></div>
      </div>

      {/* 網格資訊骨架 */}
      <div className="grid grid-cols-2 gap-3 mt-auto mb-4">
        <div className="bg-[#0F111A]/50 h-14 rounded-xl"></div>
        <div className="bg-[#0F111A]/50 h-14 rounded-xl"></div>
        <div className="bg-[#0F111A]/50 h-14 rounded-xl col-span-2"></div>
      </div>

      {/* 底部按鈕骨架 */}
      <div className="mt-4 pt-4 border-t border-[#2A2F3D]/50 flex justify-between items-center">
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-full bg-[#1D2130]/50"></div>
          <div className="w-6 h-6 rounded-full bg-[#1D2130]/50 -ml-2"></div>
        </div>
        <div className="h-9 bg-[#8B5CF6]/20 rounded-xl w-24"></div>
      </div>
    </div>
  </div>
);

const BulletinCard = React.memo(({
  b,
  user,
  isVerifiedUser,
  onNavigateProfile,
  onApply,
  onInvite,
  onDeleteBulletin,
  onEditBulletin,
  openModalId,
  onClearOpenModalId,
  currentView,
}) => {
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
      if (onClearOpenModalId) onClearOpenModalId();
    }
  }, [openModalId, b.id]);

  const statusText = isReached ? "已有足夠意願，可等待發起人挑選" : "正在找一起聯動的人";

  return (
    <div className="h-full bg-[#181B25] border border-[#2A2F3D] rounded-2xl overflow-hidden flex flex-col hover:bg-[#1D2130] hover:border-white/10 transition-colors shadow-sm">
      {b.image ? (
        <div className="w-full h-40 sm:h-44 relative overflow-hidden flex-shrink-0 border-b border-[#2A2F3D] bg-[#0F111A]">
          <LazyImage src={sanitizeUrl(b.image)} containerCls="absolute inset-0 w-full h-full" imgCls="" alt="揪團附圖" />
        </div>
      ) : (
        <div className="h-16 bg-[#11131C] border-b border-[#2A2F3D] flex items-center px-5 text-[#94A3B8] text-xs">
          沒有附圖，先看看揪團內容
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <LazyImage
            src={sanitizeUrl(vtuber.avatar)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (vtuber.id) onNavigateProfile(vtuber, false);
            }}
            containerCls="w-12 h-12 rounded-full border border-white/10 flex-shrink-0 cursor-pointer bg-[#1D2130]"
            imgCls="rounded-full"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (vtuber.id) onNavigateProfile(vtuber, false);
                }}
                className="font-bold text-[#F8FAFC] text-sm truncate hover:text-[#A78BFA] transition-colors text-left"
              >
                {vtuber.name || "匿名創作者"}
              </button>
              {vtuber.isVerified && <span className="text-[#38BDF8] text-xs" title="已認證">✅</span>}
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5 truncate">{vtuber.agency || "個人勢"} · {b.postedAt} 發布</p>
          </div>
          <span className="flex-shrink-0 bg-[#8B5CF6]/12 text-[#C4B5FD] border border-[#8B5CF6]/25 px-2.5 py-1 rounded-full text-[11px] font-bold">
            {b.collabType || "未指定"}
          </span>
        </div>

        <div className="bg-[#0F111A]/60 border border-[#2A2F3D] rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[#F8FAFC] font-bold text-base">這團在找什麼？</p>
            <span className={`text-[11px] font-bold px-2 py-1 rounded-full border ${isReached ? 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/25' : 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25'}`}>
              {isReached ? '挑選中' : '開放報名'}
            </span>
          </div>
          <div className={`text-[#CBD5E1] whitespace-pre-wrap text-sm leading-relaxed ${isExpanded ? "" : "line-clamp-4"}`}>
            {b.content || "發起人還沒有補充詳細內容。"}
          </div>
          {(b.content || "").length > 90 && (
            <button
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="text-[#A78BFA] hover:text-[#C4B5FD] text-xs font-bold mt-3"
            >
              {isExpanded ? "收起內容" : "看完整揪團內容"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
          <div className="bg-[#11131C] border border-[#2A2F3D] rounded-xl p-3">
            <p className="text-[10px] text-[#94A3B8] mb-1">想找人數</p>
            <p className="text-[#F8FAFC] font-bold truncate">{b.collabSize || "未指定"}</p>
          </div>
          <div className="bg-[#11131C] border border-[#2A2F3D] rounded-xl p-3">
            <p className="text-[10px] text-[#94A3B8] mb-1">預計時間</p>
            <p className="text-[#F8FAFC] font-bold truncate">{formatDateTimeLocalStr(b.collabTime)}</p>
          </div>
          <div className="bg-[#11131C] border border-[#EF4444]/25 rounded-xl p-3">
            <p className="text-[10px] text-[#EF4444]/80 mb-1">報名截止</p>
            <p className="text-red-200 font-bold truncate">{b.recruitEndTime ? formatTime(b.recruitEndTime) : "未指定"}</p>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-[#2A2F3D] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <button onClick={(event) => { event.preventDefault(); event.stopPropagation(); setShowApplicants(true); }} className="min-w-0 flex items-center gap-2 text-left rounded-xl hover:bg-[#11131C] transition-colors p-2 -m-2">
              <div className="flex -space-x-2 flex-shrink-0">
                {b.applicantsData?.slice(0, 3).map((a) => (
                  <img key={a.id} src={sanitizeUrl(a.avatar)} className="w-7 h-7 rounded-full ring-2 ring-[#181B25] object-cover bg-[#1D2130]" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                ))}
                {(!b.applicantsData || b.applicantsData.length === 0) && <div className="w-7 h-7 rounded-full bg-[#1D2130] ring-2 ring-[#181B25]"></div>}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#F8FAFC] font-bold truncate">{currentApplicants} 人有意願</p>
                <p className="text-[10px] text-[#94A3B8] truncate">{statusText}</p>
              </div>
            </button>

            {isAuthor ? (
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => onEditBulletin && onEditBulletin(b)} className="bg-[#38BDF8]/15 hover:bg-[#38BDF8]/25 text-[#38BDF8] border border-[#38BDF8]/25 px-3 py-2 rounded-xl text-xs font-bold transition-colors">編輯</button>
                <button onClick={() => onDeleteBulletin && onDeleteBulletin(b.id)} className="bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#FCA5A5] border border-[#EF4444]/25 px-3 py-2 rounded-xl text-xs font-bold transition-colors">刪除</button>
              </div>
            ) : (
              <button
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onApply(b.id, !hasApplied, b.userId);
                }}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${hasApplied ? "bg-[#1D2130] text-[#CBD5E1] hover:bg-[#2A2F3D]" : "bg-[#8B5CF6] text-white hover:bg-[#7C3AED]"}`}
              >
                {hasApplied ? "收回意願" : "我想參加"}
              </button>
            )}
          </div>
        </div>
      </div>

      {showApplicants && currentView !== "profile" && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75" onClick={(event) => { event.stopPropagation(); setShowApplicants(false); }}>
          <div className="bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-md flex flex-col max-h-[80vh] shadow-sm cursor-default" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 bg-[#0F111A] px-6 py-4 border-b border-[#2A2F3D] flex justify-between items-center z-10">
              <h3 className="font-bold text-white">有意願的 Vtuber ({b.applicantsData?.length || 0})</h3>
              <button onClick={() => setShowApplicants(false)} className="text-[#94A3B8] hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              {b.applicantsData?.length > 0 ? b.applicantsData.map((a) => (
                <div key={a.id} className="flex items-center justify-between bg-[#181B25]/50 p-3 rounded-xl border border-[#2A2F3D] hover:border-white/10 transition-colors cursor-pointer group" onClick={(event) => { event.stopPropagation(); setShowApplicants(false); onNavigateProfile(a, true); }}>
                  <div className="flex items-center gap-4 min-w-0">
                    <img src={sanitizeUrl(a.avatar)} className="w-12 h-12 rounded-full object-cover border border-[#2A2F3D] bg-[#1D2130]" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                    <div className="min-w-0">
                      <p className="font-bold text-white text-sm truncate group-hover:text-[#C4B5FD] transition-colors">{a.name}</p>
                      <p className="text-[10px] text-[#94A3B8] mt-1">點擊查看名片</p>
                    </div>
                  </div>
                  {isAuthor && <button onClick={(event) => { event.stopPropagation(); setShowApplicants(false); onInvite(a); }} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs text-white px-4 py-2 rounded-lg shadow-sm transition-colors font-bold flex-shrink-0">發送邀約</button>}
                </div>
              )) : (
                <div className="text-center py-8">
                  <p className="text-[#F8FAFC] font-bold">還沒有人表達意願</p>
                  <p className="text-sm text-[#94A3B8] mt-1">再等等，或把揪團內容寫得更具體一點。</p>
                </div>
              )}
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.b.id === nextProps.b.id &&
    prevProps.b.applicants?.length === nextProps.b.applicants?.length &&
    prevProps.b.applicantsData?.length === nextProps.b.applicantsData?.length &&
    prevProps.user?.uid === nextProps.user?.uid &&
    prevProps.isVerifiedUser === nextProps.isVerifiedUser &&
    prevProps.openModalId === nextProps.openModalId &&
    prevProps.currentView === nextProps.currentView
  );
});

const MatchPage = ({
  vtubers,
  navigate,
  showToast,
  currentUser,
  setSelectedVTuber,
  onBraveInvite,
  isVerifiedUser,
}) => {
  const [desiredType, setDesiredType] = useState("");
  const [matchedVtuber, setMatchedVtuber] = useState(null);
  const [isMatching, setIsMatching] = useState(false);
  const [zodiacScore, setZodiacScore] = useState(null); // 🌟 新增：儲存星座分數

  const handleMatch = (type = "random") => {
    setIsMatching(true);
    setMatchedVtuber(null);
    setZodiacScore(null);

    setTimeout(() => {
      const candidates = (vtubers || []).filter(
        (v) => isVisible(v, currentUser) && v.id !== currentUser?.uid,
      );
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
        } else {
          const zodiacCandidates = candidates.filter(v => v.zodiacSign);
          if (zodiacCandidates.length === 0) {
            showToast("找不到有填寫星座的對象，為您隨機推薦！");
            finalMatch = candidates[Math.floor(Math.random() * candidates.length)];
          } else {
            // 隨機挑選一個有星座的對象，並計算分數
            finalMatch = zodiacCandidates[Math.floor(Math.random() * zodiacCandidates.length)];
            score = ZODIAC_COMPATIBILITY[myProfile.zodiacSign][finalMatch.zodiacSign] || 50;
            showToast("✨ 星座配對成功！");
          }
        }
      } else {
        // 原本的隨機配對邏輯
        let filtered = desiredType
          ? candidates.filter(
            (v) =>
              Array.isArray(v.collabTypes) &&
              v.collabTypes.includes(desiredType),
          )
          : candidates;
        if (filtered.length === 0) {
          showToast("找不到完全符合類型的對象，為您隨機推薦一位命定夥伴！");
          filtered = candidates;
        } else {
          showToast("🎉 配對成功！");
        }
        finalMatch = filtered[Math.floor(Math.random() * filtered.length)];
      }

      setMatchedVtuber(finalMatch);
      setZodiacScore(score);
      setIsMatching(false);
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 text-center animate-fade-in-up">
      <h2 className="text-3xl font-extrabold text-[#A78BFA] mb-4 flex justify-center items-center gap-3">
        <i className="fa-solid fa-dice"></i> 聯動隨機配對
      </h2>
      <p className="text-[#94A3B8] mb-10">
        不知道該找誰玩嗎？讓 V-Nexus
        幫您隨機抽籤配對，或許會遇到意想不到的好夥伴喔！
      </p>

      <div className="bg-[#181B25]/40 border border-[#2A2F3D] rounded-2xl p-8 shadow-sm max-w-2xl mx-auto relative overflow-hidden">
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-[#8B5CF6]/10 rounded-full blur-3xl"></div>

        {!isMatching && !matchedVtuber && (
          <div className="space-y-6 relative z-10 animate-fade-in-up">
            <div className="text-left">
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
                想要聯動的類型 (選填)
              </label>
              <select
                value={desiredType}
                onChange={(e) => setDesiredType(e.target.value)}
                className={inputCls}
              >
                <option value="">不限類型 (完全隨機)</option>
                {PREDEFINED_COLLABS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => handleMatch("random")}
              className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-4 rounded-xl font-bold text-lg shadow-sm transition-transform flex justify-center items-center gap-2"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>{" "}
              開始尋找命定夥伴
            </button>

            {/* 🌟 新增：星座配對按鈕 */}
            <button
              onClick={() => handleMatch("zodiac")}
              className="w-full mt-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white py-4 rounded-xl font-bold text-lg shadow-sm transition-transform flex justify-center items-center gap-2"
            >
              <i className="fa-solid fa-star"></i> 星座命定配對
            </button>
          </div>
        )}

        {isMatching && (
          <div className="py-12 flex flex-col items-center justify-center animate-fade-in-up">
            <div className="relative w-32 h-32 mb-6">
              <div className="absolute inset-0 border-4 border-[#2A2F3D] rounded-full"></div>
              <div className="absolute inset-0 border-4 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-radar"></div>
              <i className="fa-solid fa-satellite-dish text-4xl text-[#A78BFA] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></i>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              雷達掃描中...
            </h3>
          </div>
        )}

        {matchedVtuber && !isMatching && (
          <div className="animate-fade-in-up relative z-10">
            <h3 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-6">
              就是決定是你了！
            </h3>

            {/* 🌟 新增：顯示星座配對分數 */}
            {zodiacScore !== null && (
              <div className="mb-6 bg-indigo-900/40 border border-indigo-500/50 rounded-xl p-4 animate-bounce shadow-sm">
                <p className="text-indigo-200 font-bold text-lg flex items-center justify-center gap-2">
                  <i className="fa-solid fa-sparkles text-[#F59E0B]"></i>
                  星座配對指數：<span className="text-3xl text-[#F59E0B] font-black">{zodiacScore}%</span>
                </p>
                <p className="text-sm text-indigo-300 mt-1">
                  你們是 {matchedVtuber.zodiacSign} 與你的完美邂逅！
                </p>
              </div>
            )}

            {/* 詳細名片資訊區 */}
            <div className="w-full bg-[#0F111A]/90 border border-white/10 rounded-2xl overflow-hidden shadow-sm flex flex-col text-left mb-8">
              <div className="h-32 relative overflow-hidden">
                <img
                  src={sanitizeUrl(matchedVtuber.banner)}
                  className="w-full h-full object-cover opacity-50"
                />
                <div className="absolute top-2 right-2 flex gap-2">
                  <span className="px-2 py-1 bg-black/60 rounded text-[10px] text-white font-bold">
                    {matchedVtuber.agency}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-[10px] text-white font-bold ${matchedVtuber.mainPlatform === "Twitch" ? "bg-[#8B5CF6]" : "bg-[#EF4444]"}`}
                  >
                    <i
                      className={`fa-brands fa-${matchedVtuber.mainPlatform === "Twitch" ? "twitch" : "youtube"} mr-1`}
                    ></i>
                    {matchedVtuber.mainPlatform}
                  </span>
                </div>
              </div>
              <div className="p-6 relative">
                <img
                  src={sanitizeUrl(matchedVtuber.avatar)}
                  className="absolute -top-12 left-6 w-24 h-24 rounded-2xl border-4 border-gray-900 bg-[#181B25] object-cover shadow-md"
                />
                <div className="ml-28 min-h-[80px]">
                  <h4 className="text-2xl font-bold text-white flex items-center gap-2">
                    {matchedVtuber.name}{" "}
                    {matchedVtuber.isVerified && (
                      <i className="fa-solid fa-circle-check text-[#38BDF8] text-sm"></i>
                    )}
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs text-[#22C55E] font-bold bg-[#22C55E]/10 px-2 py-1 rounded">
                      <i className="fa-solid fa-thumbs-up mr-1"></i>
                      {matchedVtuber.likes || 0} 推薦
                    </span>
                    <span className="text-xs text-[#EF4444] font-bold bg-[#EF4444]/10 px-2 py-1 rounded">
                      <i className="fa-brands fa-youtube mr-1"></i>
                      {matchedVtuber.youtubeSubscribers || "0"}
                    </span>
                  </div>
                </div>
                <p className="text-[#94A3B8] text-sm mt-4 line-clamp-3 leading-relaxed">
                  {matchedVtuber.description}
                </p>
                <div className="mt-4 pt-4 border-t border-[#2A2F3D] flex flex-wrap gap-2">
                  {(matchedVtuber.collabTypes || []).slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="text-[10px] bg-[#8B5CF6]/20 text-[#C4B5FD] px-2 py-1 rounded-lg border border-white/10 font-bold"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 按鈕群組 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isVerifiedUser && matchedVtuber.id !== currentUser?.uid && (
                <button
                  onClick={() => onBraveInvite(matchedVtuber)}
                  className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white py-3 rounded-xl font-bold shadow-sm transition-transform flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-heart"></i> 勇敢邀請
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedVTuber(matchedVtuber);
                  navigate(`profile/${matchedVtuber.id}`);
                }}
                className="bg-[#8B5CF6] hover:bg-[#8B5CF6] text-white py-3 rounded-xl font-bold shadow-sm transition-transform flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-address-card"></i> 前往詳細名片
              </button>
              <button
                onClick={() => handleMatch(zodiacScore !== null ? "zodiac" : "random")}
                className="sm:col-span-2 bg-[#181B25] hover:bg-[#1D2130] text-[#CBD5E1] py-3 rounded-xl font-bold border border-[#2A2F3D] transition-colors flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-rotate-right"></i> 不滿意？再抽一次
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
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
    } else {
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

  return (
    <div className="flex gap-2 w-full">
      <input
        type="date"
        value={datePart}
        onChange={handleDateChange}
        className={`${baseCls} flex-1 min-w-0`}
      />
      <select
        value={timePart}
        onChange={handleTimeChange}
        className={`${baseCls} flex-1 min-w-0 cursor-pointer`}
      >
        <option value="" disabled>選擇時間</option>
        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        {/* 防呆：保留舊有的特殊時間 */}
        {!TIME_OPTIONS.includes(timePart) && timePart && (
          <option value={timePart}>{timePart}</option>
        )}
      </select>
    </div>
  );
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
  return (
    <div className="bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-4 mt-1">
      <div className="mb-3">
        <select
          value={mode}
          onChange={handleModeChange}
          className={inputCls + " font-normal"}
        >
          <option value="specific">✔️ 指定可聯動時段</option>
          <option value="except">❌ 除了以下時段，其他皆可</option>
          <option value="custom">✍️ 自訂時間 (自行手動輸入時間)</option>
          <option value="anytime">🌟 我都可以 (隨時可約)</option>
        </select>
      </div>
      {mode === "custom" && (
        <div className="space-y-3 border-t border-[#2A2F3D] pt-3">
          <input
            type="text"
            value={form.customScheduleText || ""}
            onChange={(e) => updateForm({ customScheduleText: e.target.value })}
            placeholder="例如：每個月底的週末晚上..."
            className={inputCls}
          />
        </div>
      )}
      {(mode === "specific" || mode === "except") && (
        <div className="space-y-3 border-t border-[#2A2F3D] pt-3">
          {(form.scheduleSlots || []).map((slot, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center gap-2 bg-[#181B25]/50 p-2 rounded-lg border border-[#2A2F3D]"
            >
              <select
                value={slot.day}
                onChange={(e) => updateSlot(index, "day", e.target.value)}
                className="bg-[#181B25] border border-[#2A2F3D] rounded p-1.5 text-white text-xs outline-none"
              >
                {[
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
                ].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              {/* 🌟 修改：將原本的 input type="time" 改成 select 下拉選單 */}
              <select
                value={slot.start}
                onChange={(e) => updateSlot(index, "start", e.target.value)}
                className="bg-[#181B25] border border-[#2A2F3D] rounded p-1.5 text-white text-xs outline-none box-border min-w-0 cursor-pointer"
              >
                {/* 防呆：如果原本資料庫存了奇怪的時間(如 14:15)，也能正常顯示出來 */}
                {!TIME_OPTIONS.includes(slot.start) && slot.start && (
                  <option value={slot.start}>{slot.start}</option>
                )}
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <span className="text-[#94A3B8] text-xs">至</span>

              {/* 🌟 修改：將原本的 input type="time" 改成 select 下拉選單 */}
              <select
                value={slot.end}
                onChange={(e) => updateSlot(index, "end", e.target.value)}
                className="bg-[#181B25] border border-[#2A2F3D] rounded p-1.5 text-white text-xs outline-none box-border min-w-0 cursor-pointer"
              >
                {!TIME_OPTIONS.includes(slot.end) && slot.end && (
                  <option value={slot.end}>{slot.end}</option>
                )}
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <button
                type="button"
                onClick={() =>
                  updateForm({
                    scheduleSlots: form.scheduleSlots.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
                className="text-[#EF4444] hover:text-red-300 ml-auto px-2 transition-colors"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              updateForm({
                scheduleSlots: [
                  ...(form.scheduleSlots || []),
                  { day: "星期一", start: "20:00", end: "22:00" },
                ],
              })
            }
            className="text-xs text-[#A78BFA] hover:text-white flex items-center gap-1 mt-2 bg-[#8B5CF6]/10 hover:bg-[#8B5CF6] px-3 py-1.5 rounded-lg border border-[#8B5CF6]/20 transition-colors"
          >
            <i className="fa-solid fa-plus"></i> 新增時段
          </button>
        </div>
      )}
    </div>
  );
};

const CollabTypesEditor = ({ formState, setFormState, showToast }) => {
  const toggleCollab = (type) => {
    let newTypes = Array.isArray(formState.collabTypes)
      ? [...formState.collabTypes]
      : [];
    if (newTypes.includes(type)) {
      newTypes = newTypes.filter((t) => t !== type);
    } else {
      if (newTypes.length + (formState.isOtherCollab ? 1 : 0) >= 3)
        return showToast("主要願意連動類型至多只能選擇三項喔！");
      newTypes.push(type);
    }
    setFormState({ collabTypes: newTypes });
  };
  const toggleOther = () => {
    const willBeChecked = !formState.isOtherCollab;
    if (
      willBeChecked &&
      (Array.isArray(formState.collabTypes)
        ? formState.collabTypes.length
        : 0) >= 3
    )
      return showToast("主要願意連動類型至多只能選擇三項喔！");
    setFormState({ isOtherCollab: willBeChecked });
  };
  const currentTypes = Array.isArray(formState.collabTypes)
    ? formState.collabTypes
    : [];
  return (
    <div className="bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-4 mt-1">
      <div className="flex flex-wrap gap-3">
        {PREDEFINED_COLLABS.map((type) => (
          <label
            key={type}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <input
              type="checkbox"
              checked={currentTypes.includes(type)}
              onChange={() => toggleCollab(type)}
              className="accent-purple-500 w-4 h-4"
            />
            <span className="text-sm text-[#CBD5E1] group-hover:text-white transition-colors">
              {type}
            </span>
          </label>
        ))}
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={formState.isOtherCollab}
            onChange={toggleOther}
            className="accent-purple-500 w-4 h-4"
          />
          <span className="text-sm text-[#CBD5E1] group-hover:text-white transition-colors">
            其他
          </span>
        </label>
      </div>
      {formState.isOtherCollab && (
        <div className="mt-3 pl-6">
          <input
            type="text"
            value={formState.otherCollabText || ""}
            onChange={(e) => setFormState({ otherCollabText: e.target.value })}
            placeholder="請輸入您的其他連動類型..."
            className={inputCls}
          />
        </div>
      )}
    </div>
  );
};

const ProfileEditorForm = ({
  form,
  updateForm,
  onSubmit,
  onCancel,
  isAdmin,
  showToast,
  user,
  onDeleteSelf,
}) => {
  const [otpStatus, setOtpStatus] = useState("idle");
  const [otpInput, setOtpInput] = useState("");
  const [isFetchingSubscribers, setIsFetchingSubscribers] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(
    form.lastYoutubeFetchTime || 0,
  );
  const [isFetchingTwitch, setIsFetchingTwitch] = useState(false);
  const [lastTwitchFetchTime, setLastTwitchFetchTime] = useState(
    form.lastTwitchFetchTime || 0,
  );

  // ✅ 名片編輯分段導覽：切換步驟後自動回到表單頂部，避免手機版停在頁尾找不到下一段內容。
  const editorTopRef = useRef(null);
  const didMountEditorRef = useRef(false);
  const scrollEditorToTop = () => {
    const el = editorTopRef.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  };

  const handleImageUpload = (e, field, maxWidth, maxHeight) => {
    const file = e.target.files[0];
    if (!file) return;
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
        showToast(
          `✅ ${field === "avatar" ? "頭像" : "橫幅"}上傳並自動壓縮成功！`,
        );
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const url = form.youtubeUrl || form.channelUrl;
    if (typeof url !== "string" || url.length < 15) return;

    const timer = setTimeout(() => {
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      if (
        (url.includes("youtube.com") || url.includes("youtu.be")) &&
        now - lastFetchTime > TWENTY_FOUR_HOURS
      ) {
        handleAutoFetchSubscribers(url);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [form.youtubeUrl, form.channelUrl, lastFetchTime]);

  useEffect(() => {
    const url = form.twitchUrl;
    if (typeof url !== "string" || url.length < 15) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 👈 變數改名為 24 小時
      if (
        url.includes("twitch.tv") &&
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
          const remainHours = Math.ceil(
            (TWENTY_FOUR_HOURS - (now - lastTwitchFetchTime)) / (60 * 60 * 1000), // 👈 計算方式也要改
          );
          showToast(
            `⏳ 為了保護額度，24小時內只能抓取一次。請 ${remainHours} 小時後再試！`, // 👈 提示文字改 24 小時
          );
        }
        return;
      }
    }

    setIsFetchingTwitch(true);
    try {
      const fetchTwitchStats = httpsCallable(
        functionsInstance,
        "fetchTwitchStats",
      );
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
      } else {
        if (typeof autoUrl !== "string")
          showToast(
            "❌ 抓取失敗: " + (result.data ? result.data.message : "未知錯誤"),
          );
      }
    } catch (err) {
      console.error("Fetch Stats Error:", err);
      if (typeof autoUrl !== "string")
        showToast("❌ 伺服器連線失敗，請檢查網址或稍後再試");
    } finally {
      setIsFetchingTwitch(false);
    }
  };

  const handleAutoFetchSubscribers = async (autoUrl = null) => {
    const url =
      typeof autoUrl === "string"
        ? autoUrl
        : form.youtubeUrl || form.channelUrl;
    if (typeof url !== "string" || !url)
      return showToast("請先在下方填妥 YouTube 連結！");

    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    if (!isAdmin) {
      if (now - lastFetchTime < TWENTY_FOUR_HOURS) {
        if (typeof autoUrl !== "string") {
          const remainHours = Math.ceil(
            (TWENTY_FOUR_HOURS - (now - lastFetchTime)) / (60 * 60 * 1000),
          );
          showToast(
            `⏳ 為了保護額度，24小時內只能抓取一次。請 ${remainHours} 小時後再試！`,
          );
        }
        return;
      }
    }

    setIsFetchingSubscribers(true);
    try {
      const fetchYouTubeStats = httpsCallable(
        functionsInstance,
        "fetchYouTubeStats",
      );
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
      } else {
        if (typeof autoUrl !== "string")
          showToast(
            "❌ 抓取失敗: " + (result.data ? result.data.message : "未知錯誤"),
          );
      }
    } catch (err) {
      console.error("Fetch Stats Error:", err);
      if (typeof autoUrl !== "string")
        showToast("❌ 伺服器連線失敗，請檢查網址或稍後再試");
    } finally {
      setIsFetchingSubscribers(false);
    }
  };

  const handleSendOtp = async () => {
    // ✅ 新增這行：確保有登入才能發送
    if (!user) return showToast("❌ 請先登入後再進行信箱驗證！");

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
      } else {
        throw new Error(result.data ? result.data.message : "發送失敗");
      }
    } catch (err) {
      console.error("發送驗證碼出錯:", err);
      setOtpStatus("idle");
      const errorMsg = err.message || "發送失敗，請稍後再試";
      showToast("❌ " + errorMsg);
    }
  };

  const handleVerifyOtp = async () => {
    // ✅ 新增這行：確保有登入才能驗證
    if (!user) return showToast("❌ 請先登入後再進行信箱驗證！");

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
      } else {
        throw new Error(result.data ? result.data.message : "驗證失敗");
      }
    } catch (err) {
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

  return (
    <form ref={editorTopRef} onSubmit={onSubmit} className="space-y-6 scroll-mt-24">
      <div className="bg-[#181B25]/80 border border-[#2A2F3D] rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-[#94A3B8] text-xs font-bold tracking-widest uppercase mb-1">Profile editor</p>
            <h3 className="text-xl font-extrabold text-white">完成你的 V-Nexus 名片</h3>
            <p className="text-sm text-[#94A3B8] mt-1">每次只填一段，最後到「預覽」確認後再儲存。</p>
          </div>
          <div className="min-w-[180px]">
            <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-1">
              <span>完成度</span>
              <span className="text-white font-bold">{profileCompletion}%</span>
            </div>
            <div className="h-2 bg-[#0F111A] rounded-full overflow-hidden border border-[#2A2F3D]">
              <div className="h-full bg-[#8B5CF6] transition-all" style={{ width: `${profileCompletion}%` }}></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {editorSteps.map((step, idx) => (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStep(idx)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${activeStep === idx ? "bg-[#8B5CF6] border-[#8B5CF6] text-white" : idx < activeStep ? "bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]" : "bg-[#0F111A] border-[#2A2F3D] text-[#94A3B8] hover:bg-[#1D2130] hover:text-white"}`}
            >
              <i className={`fa-solid ${step.icon}`}></i>
              <span>{step.label}</span>
            </button>
          ))}
        </div>
      </div>

      {currentStepId === "basic" && (
        <div className={panelCls}>
          <div>
            <h3 className={stepTitleCls}><i className="fa-solid fa-id-card text-[#8B5CF6]"></i> 基本資料</h3>
            <p className="text-sm text-[#94A3B8] mt-1">先讓大家知道你是誰、目前是否開放聯動。</p>
          </div>

          <div className="bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-4">
            <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
              名片顯示狀態
            </label>
            <select
              value={form.activityStatus}
              onChange={(e) => updateForm({ activityStatus: e.target.value })}
              className={inputCls + " font-normal"}
            >
              <option value="active">🟢 開放聯動</option>
              <option value="creator">🎨 我是繪師 / 建模師 / 剪輯師</option>
              <option value="sleep">🌙 暫時休息</option>
              <option value="graduated">🕊️ 已畢業</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
                VTuber 名稱 <span className="text-[#EF4444]">*</span>
              </label>
              <input
                type="text"
                value={form.name || ""}
                onChange={(e) => updateForm({ name: e.target.value })}
                className={inputCls}
                placeholder="請輸入您的名稱"
              />
            </div>

            <div className="bg-[#8B5CF6]/5 border border-[#8B5CF6]/20 p-4 rounded-xl">
              <label className="block text-sm font-bold text-[#C4B5FD] mb-2">
                <i className="fa-solid fa-link mr-1"></i> 設定專屬網址 ID
              </label>
              <div className="flex items-center gap-1">
                <span className="text-[#64748B] text-[10px] font-mono hidden sm:inline">
                  #profile/
                </span>
                <input
                  type="text"
                  placeholder="例如: daxiong"
                  value={form.slug || ""}
                  onChange={(e) =>
                    updateForm({
                      slug: e.target.value
                        .replace(/[^a-zA-Z0-9_-]/g, "")
                        .toLowerCase(),
                    })
                  }
                  className={inputCls + " font-mono text-[#A78BFA] !p-2"}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
              介紹一下你自己吧！ <span className="text-[#EF4444]">*</span>
            </label>
            <textarea
              rows="6"
              value={form.description || ""}
              onChange={(e) => updateForm({ description: e.target.value })}
              className={inputCls + " resize-none"}
              placeholder="簡單介紹你的頻道風格、個性、想找怎樣的聯動夥伴。"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
                所屬勢力
              </label>
              <select
                value={form.agency || "個人勢"}
                onChange={(e) => updateForm({ agency: e.target.value })}
                className={inputCls}
              >
                <option value="個人勢">個人勢</option>
                <option value="企業勢">企業勢</option>
                <option value="社團勢">社團勢</option>
                <option value="合作勢">合作勢</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
                創作型態
              </label>
              <select
                value={form.streamingStyle || ""}
                onChange={(e) => updateForm({ streamingStyle: e.target.value })}
                className={inputCls}
              >
                <option value="">請選擇...</option>
                <option value="一般型態">一般型態</option>
                <option value="男聲女皮">男聲女皮</option>
                <option value="女聲男皮">女聲男皮</option>
                <option value="無性別/人外">無性別/人外</option>
                <option value="其他">其他</option>
              </select>
            </div>
          </div>



          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
                國籍 / 所在地
              </label>
              <div className="flex flex-wrap gap-3 bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-4">
                {["台灣", "香港", "日本", "海外"].map((n) => (
                  <label key={n} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={(form.nationalities || []).includes(n)}
                      onChange={() => {
                        let list = [...(form.nationalities || [])];
                        list = list.includes(n) ? list.filter((x) => x !== n) : [...list, n];
                        updateForm({ nationalities: list });
                      }}
                      className="accent-purple-500 w-4 h-4"
                    />
                    <span className="text-sm text-[#CBD5E1] group-hover:text-white transition-colors">{n}</span>
                  </label>
                ))}
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={!!form.isOtherNationality}
                    onChange={() => updateForm({ isOtherNationality: !form.isOtherNationality })}
                    className="accent-purple-500 w-4 h-4"
                  />
                  <span className="text-sm text-[#CBD5E1] group-hover:text-white transition-colors">其他</span>
                </label>
              </div>
              {form.isOtherNationality && (
                <input
                  type="text"
                  value={form.otherNationalityText || ""}
                  onChange={(e) => updateForm({ otherNationalityText: e.target.value })}
                  placeholder="請輸入國籍/所在地"
                  className={inputCls + " mt-2"}
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
                使用語言
              </label>
              <div className="flex flex-wrap gap-3 bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-4">
                {["國", "日", "英", "粵", "台語"].map((lang) => (
                  <label key={lang} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={(form.languages || []).includes(lang)}
                      onChange={() => {
                        let newLangs = [...(form.languages || [])];
                        newLangs = newLangs.includes(lang)
                          ? newLangs.filter((l) => l !== lang)
                          : [...newLangs, lang];
                        updateForm({ languages: newLangs });
                      }}
                      className="accent-purple-500 w-4 h-4"
                    />
                    <span className="text-sm text-[#CBD5E1] group-hover:text-white transition-colors">{lang}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
                頭像網址 / 上傳
              </label>
              <div className="flex gap-3">
                <img src={sanitizeUrl(form.avatar)} className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-[#181B25]" />
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <input
                    type="text"
                    value={form.avatar || ""}
                    onChange={(e) => updateForm({ avatar: e.target.value })}
                    className={inputCls}
                    placeholder="可直接貼上圖片網址"
                  />
                  <div className="relative w-full">
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={(e) => handleImageUpload(e, "avatar", 300, 300)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <button type="button" className={secondaryBtn + " w-full text-xs py-2 relative z-0"}>
                      <i className="fa-solid fa-cloud-arrow-up"></i> 從裝置上傳頭像
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
                橫幅、代表作品 / 上傳
              </label>
              <div className="flex gap-3">
                <img src={sanitizeUrl(form.banner)} className="w-24 h-14 rounded-xl object-cover flex-shrink-0 bg-[#181B25]" />
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <input
                    type="text"
                    value={form.banner || ""}
                    onChange={(e) => updateForm({ banner: e.target.value })}
                    className={inputCls}
                    placeholder="可直接貼上圖片網址"
                  />
                  <div className="relative w-full">
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={(e) => handleImageUpload(e, "banner", 800, 400)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <button type="button" className={secondaryBtn + " w-full text-xs py-2 relative z-0"}>
                      <i className="fa-solid fa-cloud-arrow-up"></i> 從裝置上傳橫幅 / 代表作品
                    </button>
                  </div>
                </div>
              </div>
            </div>

          <div id="creator-service-section" className="bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-4 space-y-5 md:col-span-2 scroll-mt-28">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-[#38BDF8] tracking-[0.16em] uppercase mb-1">Creator Service</p>
                <label className="block text-sm font-bold text-[#F8FAFC]">
                  創作服務專區
                </label>
                <p className="text-xs text-[#94A3B8] mt-1">如果你有接繪圖、建模或剪輯相關服務，可以在這裡補上讓委託者更容易找到你。</p>
              </div>
              <span className="text-[11px] text-[#94A3B8] whitespace-nowrap">選填，可多選</span>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-3">
                您是不是繪師 / 建模師 / 剪輯師？ <span className="text-[11px] text-[#94A3B8] font-normal">(若都不是可不填)</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {CREATOR_ROLE_OPTIONS.map((role) => {
                  const checked = (form.creatorRoles || []).includes(role);
                  return (
                    <label
                      key={role}
                      className={`flex items-center gap-2 cursor-pointer rounded-xl border px-3 py-2 transition-colors ${checked ? "bg-[#38BDF8]/10 border-[#38BDF8]/40 text-[#38BDF8]" : "bg-[#181B25] border-[#2A2F3D] text-[#CBD5E1] hover:bg-[#1D2130]"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          let list = [...(form.creatorRoles || [])];
                          list = list.includes(role) ? list.filter((x) => x !== role) : [...list, role];
                          updateForm({ creatorRoles: list });
                        }}
                        className="accent-sky-400 w-4 h-4"
                      />
                      <span className="text-sm font-bold">{role}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-3">
                創作風格 / 類型 <span className="text-[#EF4444]">*</span>
                <span className="text-[11px] text-[#94A3B8] font-normal ml-2">若有勾選創作服務，請至少選一項</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {CREATOR_STYLE_OPTIONS.map((style) => {
                  const checked = (form.creatorStyles || []).includes(style);
                  return (
                    <label
                      key={style}
                      className={`flex items-center gap-2 cursor-pointer rounded-xl border px-3 py-2 transition-colors ${checked ? "bg-[#8B5CF6]/10 border-[#8B5CF6]/40 text-[#C4B5FD]" : "bg-[#181B25] border-[#2A2F3D] text-[#CBD5E1] hover:bg-[#1D2130]"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          let list = [...(form.creatorStyles || [])];
                          list = list.includes(style) ? list.filter((x) => x !== style) : [...list, style];
                          updateForm({ creatorStyles: list });
                        }}
                        className="accent-purple-500 w-4 h-4"
                      />
                      <span className="text-sm font-bold">{style}</span>
                    </label>
                  );
                })}
              </div>
              {(form.creatorStyles || []).includes("其他(自由填寫)") && (
                <input
                  type="text"
                  value={form.creatorOtherStyleText || ""}
                  onChange={(e) => updateForm({ creatorOtherStyleText: e.target.value })}
                  className={inputCls + " mt-3"}
                  placeholder="請簡單填寫其他創作風格 / 類型"
                />
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-[#CBD5E1] mb-3">
                  接案狀態
                </label>
                <select
                  value={form.creatorStatus || ""}
                  onChange={(e) => updateForm({ creatorStatus: e.target.value })}
                  className={inputCls}
                >
                  <option value="">請選擇接案狀態</option>
                  {CREATOR_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <p className="text-xs text-[#94A3B8] mt-2">用下拉選單快速標示目前是否可接案，避免名片過長。</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#CBD5E1] mb-3">
                  預算參考 <span className="text-[#94A3B8] text-xs font-normal">選填</span>
                </label>
                <select
                  value={normalizeCreatorBudgetRange(form.creatorBudgetRange)}
                  onChange={(e) => updateForm({ creatorBudgetRange: e.target.value })}
                  className={inputCls}
                >
                  <option value="">請選擇預算參考</option>
                  {CREATOR_BUDGET_OPTIONS.map((budget) => (
                    <option key={budget} value={budget}>{budget}</option>
                  ))}
                </select>
                <p className="text-xs text-[#94A3B8] mt-2">「私訊詢價」會顯示在創作服務專區與名片上。</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
                作品集 / 委託資訊網址 <span className="text-[#94A3B8] text-xs font-normal">選填</span>
              </label>
              <input
                type="url"
                value={form.creatorPortfolioUrl || ""}
                onChange={(e) => updateForm({ creatorPortfolioUrl: e.target.value })}
                className={inputCls}
                placeholder="例如 Pixiv、X 作品串、個人網站或委託表單網址"
              />
              <p className="text-xs text-[#94A3B8] mt-2">填寫後會在繪師 / 建模師 / 剪輯師委託專區顯示「觀看作品集」按鈕。</p>
            </div>
          </div>

          </div>
        </div>
      )}

      {currentStepId === "platform" && (
        <div className={panelCls}>
          <div>
            <h3 className={stepTitleCls}><i className="fa-solid fa-satellite-dish text-[#38BDF8]"></i> 直播平台</h3>
            <p className="text-sm text-[#94A3B8] mt-1">填寫主要平台與社群連結，訂閱/追隨數會由後端安全抓取。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="flex items-center justify-between text-sm font-bold text-[#CBD5E1] mb-2">
                <span>YouTube 連結</span>
                <label className="flex items-center gap-1 text-xs cursor-pointer text-[#C4B5FD] font-normal">
                  <input
                    type="radio"
                    value="YouTube"
                    checked={form.mainPlatform === "YouTube"}
                    onChange={(e) => updateForm({ mainPlatform: e.target.value })}
                    className="accent-purple-500"
                  />
                  主平台
                </label>
              </label>
              <input
                type="url"
                value={form.youtubeUrl || ""}
                onChange={(e) => updateForm({ youtubeUrl: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-sm font-bold text-[#CBD5E1] mb-2">
                <span>Twitch 連結</span>
                <label className="flex items-center gap-1 text-xs cursor-pointer text-[#C4B5FD] font-normal">
                  <input
                    type="radio"
                    value="Twitch"
                    checked={form.mainPlatform === "Twitch"}
                    onChange={(e) => updateForm({ mainPlatform: e.target.value })}
                    className="accent-purple-500"
                  />
                  主平台
                </label>
              </label>
              <input
                type="url"
                value={form.twitchUrl || ""}
                onChange={(e) => updateForm({ twitchUrl: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">YouTube 訂閱數</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={form.youtubeSubscribers || ""}
                  placeholder="系統將自動抓取"
                  className={inputCls + " bg-[#181B25] cursor-not-allowed text-[#94A3B8]"}
                />
                <button
                  type="button"
                  onClick={handleAutoFetchSubscribers}
                  disabled={isFetchingSubscribers || (Date.now() - lastFetchTime < 24 * 60 * 60 * 1000 && !isAdmin)}
                  className={secondaryBtn + " px-4 text-xs"}
                >
                  {isFetchingSubscribers ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-wand-magic-sparkles"></i> 抓取</>}
                </button>
              </div>
              <p className="text-[10px] text-[#A78BFA]/80 mt-1">每 24 小時限抓一次。</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">Twitch 追隨數</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={form.twitchFollowers || ""}
                  placeholder="系統將自動抓取"
                  className={inputCls + " bg-[#181B25] cursor-not-allowed text-[#94A3B8]"}
                />
                <button
                  type="button"
                  onClick={handleAutoFetchTwitch}
                  disabled={isFetchingTwitch || (Date.now() - lastTwitchFetchTime < 24 * 60 * 60 * 1000 && !isAdmin)}
                  className={secondaryBtn + " px-4 text-xs"}
                >
                  {isFetchingTwitch ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-wand-magic-sparkles"></i> 抓取</>}
                </button>
              </div>
              <p className="text-[10px] text-[#A78BFA]/80 mt-1">每 24 小時限抓一次。</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">X連結</label>
              <input type="url" value={form.xUrl || ""} onChange={(e) => updateForm({ xUrl: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">Instagram</label>
              <input type="url" value={form.igUrl || ""} onChange={(e) => updateForm({ igUrl: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#CBD5E1] mb-2">我的直播風格代表作</label>
            <input
              type="url"
              value={form.streamStyleUrl || ""}
              onChange={(e) => updateForm({ streamStyleUrl: e.target.value })}
              className={inputCls}
              placeholder="填入影片連結"
            />
          </div>
        </div>
      )}

      {currentStepId === "collab" && (
        <div className={panelCls}>
          <div>
            <h3 className={stepTitleCls}><i className="fa-solid fa-handshake-angle text-[#22C55E]"></i> 聯動偏好</h3>
            <p className="text-sm text-[#94A3B8] mt-1">讓其他創作者快速判斷你適合哪些企劃或遊戲。</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#CBD5E1] mb-2">主要願意連動類型 <span className="text-[#EF4444]">*</span></label>
            <CollabTypesEditor formState={form} setFormState={updateForm} showToast={showToast} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">你是什麼人？</label>
              <select
                value={form.personalityType || ""}
                onChange={(e) => updateForm({ personalityType: e.target.value })}
                className={inputCls}
              >
                <option value="">請選擇...</option>
                <option value="我是I人">我是I人</option>
                <option value="時I時E">時I時E</option>
                <option value="我大E人">我大E人</option>
                <option value="看心情">看心情</option>
                <option value="其他">其他(自行新增)</option>
              </select>
              {form.personalityType === "其他" && (
                <input
                  type="text"
                  value={form.personalityTypeOther || ""}
                  onChange={(e) => updateForm({ personalityTypeOther: e.target.value })}
                  placeholder="請輸入你是什麼人"
                  className={inputCls + " mt-2"}
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-[#CBD5E1] mb-2">你的星座</label>
              <select value={form.zodiacSign || ""} onChange={(e) => updateForm({ zodiacSign: e.target.value })} className={inputCls}>
                <option value="">請選擇星座...</option>
                {ZODIAC_SIGNS.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#CBD5E1] mb-2">你是什麼色系? (至多三項)</label>
            <div className="flex flex-wrap gap-3 bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-4">
              {COLOR_OPTIONS.map((color) => (
                <label key={color} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={(form.colorSchemes || []).includes(color)}
                    onChange={() => {
                      let newColors = [...(form.colorSchemes || [])];
                      if (newColors.includes(color)) {
                        newColors = newColors.filter((c) => c !== color);
                      } else {
                        if (newColors.length >= 3) return showToast("色系至多只能選擇三項喔！");
                        newColors.push(color);
                      }
                      updateForm({ colorSchemes: newColors });
                    }}
                    className="accent-purple-500 w-4 h-4"
                  />
                  <span className="text-sm text-[#CBD5E1] group-hover:text-white transition-colors">{color}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#CBD5E1] mb-2">內容標籤 (逗號分隔)</label>
            <input
              type="text"
              value={Array.isArray(form.tags) ? form.tags.join(", ") : (form.tags || "")}
              onChange={(e) => updateForm({ tags: e.target.value })}
              className={inputCls}
              placeholder="例如：APEX, 雜談, 歌回"
            />
          </div>

          {isAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-[#CBD5E1] mb-2">推薦數</label>
                <input type="number" value={form.likes || 0} onChange={(e) => updateForm({ likes: Number(e.target.value) })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#CBD5E1] mb-2">倒讚數</label>
                <input type="number" value={form.dislikes || 0} onChange={(e) => updateForm({ dislikes: Number(e.target.value) })} className={inputCls} />
              </div>
            </div>
          )}
        </div>
      )}

      {currentStepId === "schedule" && (
        <div className={panelCls}>
          <div>
            <h3 className={stepTitleCls}><i className="fa-solid fa-calendar-days text-[#F59E0B]"></i> 可聯動時間</h3>
            <p className="text-sm text-[#94A3B8] mt-1">讓別人知道什麼時候比較適合邀請你。</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#CBD5E1] mb-2">可聯動時段 <span className="text-[#EF4444]">*</span></label>
            <ScheduleEditor form={form} updateForm={updateForm} />
          </div>
        </div>
      )}

      {currentStepId === "contact" && (
        <div className={panelCls}>
          <div>
            <h3 className={stepTitleCls}><i className="fa-solid fa-envelope text-[#38BDF8]"></i> 信箱與通知</h3>
            <p className="text-sm text-[#94A3B8] mt-1">設定公開工商信箱，才收得到 Email 邀約與提醒。</p>
          </div>

          <div className="bg-[#0F111A] border border-[#2A2F3D] rounded-xl p-5">
            <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
              公開工商信箱 (選填)
              <span className="text-[#F59E0B] text-xs font-normal ml-2">
                (⚠️ 若您不驗證信箱，將無法在信箱收到任何邀約與提醒通知喔！請勿填寫私人信箱。)
              </span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-start">
              <div className="flex-1">
                <input
                  type="email"
                  value={form.publicEmail || ""}
                  onChange={(e) => {
                    updateForm({ publicEmail: e.target.value, publicEmailVerified: false });
                    setOtpStatus("idle");
                  }}
                  className={inputCls}
                  placeholder="例如：business@example.com"
                />
                {form.publicEmailVerified && (
                  <p className="text-[#22C55E] text-xs mt-1.5 font-bold">
                    <i className="fa-solid fa-circle-check"></i> 信箱已驗證
                  </p>
                )}
              </div>
              {!form.publicEmailVerified && form.publicEmail && form.publicEmail.includes("@") && (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpStatus === "sending"}
                  className={secondaryBtn + " text-xs whitespace-nowrap"}
                >
                  {otpStatus === "sending" ? <i className="fa-solid fa-spinner fa-spin"></i> : "發送驗證信"}
                </button>
              )}
            </div>

            {otpStatus === "sent" && !form.publicEmailVerified && (
              <div className="mt-3 flex flex-col sm:flex-row gap-2 animate-fade-in-up">
                <input
                  type="text"
                  maxLength="6"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="輸入6位數驗證碼"
                  className={inputCls + " text-center tracking-widest font-bold py-2"}
                />
                <button type="button" onClick={handleVerifyOtp} className={successBtn + " whitespace-nowrap"}>
                  確認
                </button>
              </div>
            )}
          </div>

          {!isAdmin && (
            <div className="bg-[#38BDF8]/10 border border-[#38BDF8]/30 rounded-xl p-5">
              <h3 className="text-[#38BDF8] font-bold mb-2 flex items-center gap-2">
                <i className="fa-solid fa-shield-halved"></i> 真人身分驗證 (防冒用)
                <span className="text-[#EF4444]">*</span>
              </h3>
              <p className="text-xs text-[#CBD5E1] mb-4">
                請將「
                <span className="text-white font-bold bg-[#181B25] px-1 rounded">V-Nexus審核中</span>
                」放入X或Youtube簡介中，管理員審核後即可刪除。
                <br />
                <span className="text-[#F59E0B] font-bold">請在下方輸入您放入的平台 X 或 YT</span>
              </p>
              <input
                type="text"
                value={form.verificationNote || ""}
                placeholder="請說明您在哪個平台的簡介放入了驗證文字（例如：已放至 X 簡介）"
                onChange={(e) => updateForm({ verificationNote: e.target.value })}
                className={inputCls}
              />
            </div>
          )}
        </div>
      )}

      {currentStepId === "preview" && (
        <div className={panelCls}>
          <div>
            <h3 className={stepTitleCls}><i className="fa-solid fa-eye text-[#8B5CF6]"></i> 預覽</h3>
            <p className="text-sm text-[#94A3B8] mt-1">確認資料後即可儲存名片。</p>
          </div>

          <div className="bg-[#0F111A] border border-[#2A2F3D] rounded-2xl overflow-hidden">
            <div className="h-32 bg-[#11131C] relative z-0">
              {form.banner && <img src={sanitizeUrl(form.banner)} className="w-full h-full object-cover opacity-80" />}
            </div>
            <div className="relative z-10 p-5 pt-0">
              <img
                src={sanitizeUrl(form.avatar)}
                className="relative z-20 block w-20 h-20 rounded-2xl object-cover border-4 border-[#0F111A] bg-[#181B25] -mt-10 shadow-sm"
              />
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-extrabold text-white">{form.name || "尚未填寫名稱"}</h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30">
                    {form.activityStatus === "sleep" ? "🌙 暫時休息" : form.activityStatus === "graduated" ? "🕊️ 已畢業" : form.activityStatus === "creator" ? "🎨 繪師 / 建模師 / 剪輯師" : "🟢 開放聯動"}
                  </span>
                </div>
                <p className="text-sm text-[#94A3B8] mt-2 whitespace-pre-wrap">
                  {form.description || "這裡會顯示你的自我介紹。"}
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {(Array.isArray(form.collabTypes) ? form.collabTypes : []).slice(0, 4).map((tag) => (
                    <span key={tag} className="text-xs px-2 py-1 rounded-full bg-[#8B5CF6]/10 text-[#C4B5FD] border border-[#8B5CF6]/20">
                      {tag}
                    </span>
                  ))}
                  {(Array.isArray(form.tags) ? form.tags : String(form.tags || "").split(",").map(t => t.trim()).filter(Boolean)).slice(0, 4).map((tag) => (
                    <span key={tag} className="text-xs px-2 py-1 rounded-full bg-[#1D2130] text-[#CBD5E1] border border-[#2A2F3D]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#38BDF8]/10 border border-[#38BDF8]/30 rounded-xl p-4 text-sm text-[#BAE6FD]">
            <i className="fa-solid fa-circle-info mr-2"></i>
            儲存後如果是新名片或退回修改，會重新進入審核流程。
          </div>
        </div>
      )}

      <div className="sticky bottom-3 z-20 bg-[#0F111A]/95 backdrop-blur border border-[#2A2F3D] rounded-2xl p-3 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-[#94A3B8] font-bold tracking-wide uppercase">名片編輯</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white font-bold whitespace-nowrap">第 {activeStep + 1} / {editorSteps.length} 步</span>
              <span className="text-[#94A3B8] truncate">{editorSteps[activeStep]?.label}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
            <div className="flex items-center gap-2 order-2 sm:order-1">
              {onCancel && (
                <button type="button" onClick={onCancel} className={ghostBtn + " flex-1 sm:flex-none text-sm px-3"}>
                  取消
                </button>
              )}

              {!isAdmin && onDeleteSelf && (
                <button type="button" onClick={onDeleteSelf} className={dangerBtn + " flex-1 sm:flex-none text-sm px-3"}>
                  <i className="fa-solid fa-trash-can"></i>
                  <span className="hidden sm:inline">刪除名片</span>
                  <span className="sm:hidden">刪除</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 order-1 sm:order-2 w-full sm:w-auto">
              <button type="button" onClick={goPrevStep} disabled={isFirstStep} className={secondaryBtn + " text-sm px-2 sm:px-4 min-w-0"}>
                <i className="fa-solid fa-arrow-left"></i>
                <span>上一段</span>
              </button>

              <button type="submit" className={(isLastStep ? successBtn : secondaryBtn) + " text-sm px-2 sm:px-4 min-w-0"}>
                <i className="fa-solid fa-floppy-disk"></i>
                <span className="hidden sm:inline">{isAdmin ? "強制儲存更新" : "儲存名片"}</span>
                <span className="sm:hidden">儲存</span>
              </button>

              {!isLastStep ? (
                <button type="button" onClick={goNextStep} className={primaryBtn + " text-sm px-2 sm:px-4 min-w-0"}>
                  <span>下一段</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              ) : (
                <button type="button" disabled className={secondaryBtn + " text-sm px-2 sm:px-4 min-w-0 opacity-50 cursor-not-allowed"}>
                  <i className="fa-solid fa-check"></i>
                  <span>完成</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};

const InboxPage = ({
  notifications,
  markAllAsRead,
  onMarkRead,
  onDelete,
  onDeleteAll,
  onNavigateProfile,
  onBraveResponse,
  onOpenChat,
}) => {
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(notifications.length / itemsPerPage);
  const displayNotifications = notifications.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage,
  );

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
  }, [notifications.length, totalPages, page]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 border-b border-[#2A2F3D] pb-4 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <i className="fa-solid fa-envelope-open-text text-[#A78BFA]"></i>{" "}
            我的信箱
          </h2>
          <p className="text-[#94A3B8] mt-2 text-sm">您的專屬通知中心</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {notifications.some((n) => !n.read) && (
            <button
              onClick={markAllAsRead}
              className="text-sm font-bold text-[#A78BFA] bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 px-4 py-2 rounded-xl"
            >
              <i className="fa-solid fa-check-double mr-1"></i> 全部標示為已讀
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={onDeleteAll}
              className="text-sm font-bold text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20 px-4 py-2 rounded-xl"
            >
              <i className="fa-solid fa-trash-can mr-1"></i> 一鍵刪除全部
            </button>
          )}
        </div>
      </div>
      {notifications.length === 0 ? (
        <div className="text-center py-24 bg-[#181B25]/40 rounded-2xl border border-[#2A2F3D]/50 shadow-md">
          <i className="fa-regular fa-envelope-open text-6xl text-gray-600 mb-6"></i>
          <p className="text-[#94A3B8] font-bold text-lg">信箱目前空空如也！</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayNotifications.map((n) => (
            <div
              key={n.id}
              className={`p-5 sm:p-6 rounded-2xl border transition-all ${n.read ? "bg-[#181B25]/60 border-[#2A2F3D]" : "bg-[#181B25] border-white/10 shadow-sm"}`}
            >
              <div className="flex items-start gap-4 sm:gap-5">
                <img
                  src={sanitizeUrl(
                    n.fromUserAvatar ||
                    "https://api.dicebear.com/7.x/avataaars/svg?seed=Anon",
                  )}
                  onClick={() => onNavigateProfile(n.type === "collab_invite_sent" ? n.targetUserId : n.fromUserId)}
                  className="w-14 h-14 rounded-full border border-[#2A2F3D] bg-[#0F111A] object-cover cursor-pointer hover:border-[#A78BFA]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                    <h4 className="font-bold text-white text-lg flex flex-wrap items-center gap-2">
                      <span
                        onClick={() => onNavigateProfile(n.fromUserId)}
                        className="cursor-pointer hover:text-[#A78BFA]"
                      >
                        {n.fromUserName}
                      </span>
                      {!n.read && (
                        <span className="bg-[#EF4444] text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                          新通知
                        </span>
                      )}
                    </h4>
                    <span className="text-xs text-[#64748B] font-medium whitespace-nowrap">
                      <i className="fa-regular fa-clock mr-1"></i>
                      {formatTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-[#CBD5E1] text-sm leading-relaxed whitespace-pre-wrap bg-[#0F111A]/80 p-4 rounded-xl border border-[#2A2F3D]/50 mt-3">
                    {n.message}
                  </p>
                  {n.type === "brave_invite" && !n.handled && (
                    <div className="flex gap-3 mt-4 pt-4 border-t border-[#2A2F3D]/50">
                      <button
                        onClick={() =>
                          onBraveResponse(n.id, n.fromUserId, true)
                        }
                        className="text-xs font-bold text-white bg-[#22C55E] hover:bg-[#22C55E] px-4 py-2 rounded-lg shadow-md transition-transform"
                      >
                        <i className="fa-solid fa-check mr-1"></i> 可以試試
                      </button>
                      <button
                        onClick={() =>
                          onBraveResponse(n.id, n.fromUserId, false)
                        }
                        className="text-xs font-bold text-[#CBD5E1] bg-[#1D2130] hover:bg-[#2A2F3D] px-4 py-2 rounded-lg shadow-md transition-transform"
                      >
                        <i className="fa-solid fa-xmark mr-1"></i> 委婉拒絕
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap justify-end gap-3 mt-5">

                    {/* 🌟 新增：如果是私訊通知或站內信邀約，顯示「查看聊天室」按鈕 */}
                    {(n.type === "chat_notification" || n.type === "collab_invite") && (
                      <button
                        onClick={() => onOpenChat(n)}
                        className="text-xs font-bold text-white bg-[#8B5CF6] hover:bg-[#8B5CF6] px-4 py-2 rounded-lg flex items-center shadow-md transition-transform"
                      >
                        <i className="fa-solid fa-comments mr-2"></i> 查看聊天室
                      </button>
                    )}
                    <button
                      onClick={() => onNavigateProfile(n.fromUserId)}
                      className="text-xs font-bold text-[#CBD5E1] bg-[#1D2130] hover:bg-[#2A2F3D] px-4 py-2 rounded-lg flex items-center shadow-md"
                    >
                      <i className="fa-solid fa-address-card mr-2"></i> 查看名片
                    </button>
                    {!n.read && (
                      <button
                        onClick={() => onMarkRead(n.id)}
                        className="text-xs font-bold text-[#A78BFA] bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 border border-white/10 px-4 py-2 rounded-lg flex items-center shadow-md"
                      >
                        <i className="fa-solid fa-check mr-2"></i> 標為已讀
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(n.id)}
                      className="text-xs font-bold text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/30 px-4 py-2 rounded-lg flex items-center shadow-md"
                    >
                      <i className="fa-solid fa-trash mr-2"></i> 刪除此信
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className={`px-4 py-2 rounded-lg font-bold text-sm ${page === 1 ? "bg-[#181B25] text-gray-600 cursor-not-allowed" : "bg-[#1D2130] text-white hover:bg-[#2A2F3D]"}`}
          >
            上一頁
          </button>
          <span className="text-[#94A3B8] text-sm font-bold">
            第 {page} / {totalPages} 頁
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={`px-4 py-2 rounded-lg font-bold text-sm ${page === totalPages ? "bg-[#181B25] text-gray-600 cursor-not-allowed" : "bg-[#1D2130] text-white hover:bg-[#2A2F3D]"}`}
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
};

const CommissionPlanningPage = ({ navigate, realVtubers = [], onNavigateProfile, onOpenChat, mode = "creators" }) => {
  const { user, isAdmin, showToast } = useContext(AppContext);
  const isBoardOnly = mode === "board";
  const [activeTab, setActiveTab] = useState(() => {
    if (isBoardOnly) return "requests";
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
    if (!r || r.status === "closed") return false;
    const typeOk = requestFilter === "All" || r.requestType === requestFilter || (Array.isArray(r.requestTypes) && r.requestTypes.includes(requestFilter));
    const styles = Array.isArray(r.styles) ? r.styles : [];
    const styleOk = requestStyleFilter === "All" || styles.includes(requestStyleFilter);
    return typeOk && styleOk;
  });
  const totalRequestPages = Math.max(1, Math.ceil(filteredRequests.length / REQUEST_PAGE_SIZE));
  const safeRequestPage = Math.min(requestPage, totalRequestPages);
  const pagedRequests = filteredRequests.slice((safeRequestPage - 1) * REQUEST_PAGE_SIZE, safeRequestPage * REQUEST_PAGE_SIZE);

  const openProfile = (v) => { if (onNavigateProfile) onNavigateProfile(v); else navigate(`profile/${v.id}`); };
  const openPortfolio = (url) => { if (!url) return; const raw = String(url).trim(); const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`; window.open(sanitizeUrl(normalized), "_blank", "noopener,noreferrer"); };
  const resetRequestForm = () => setRequestForm({ id: null, title: "", description: "", requestType: "繪圖", budgetRange: "歡迎私訊報價", deadline: "", styles: [], styleOtherText: "", referenceUrl: "" });

  const handleSaveRequest = async () => {
    if (!user) return showToast("請先登入");
    if (!requestForm.title.trim() || !requestForm.description.trim()) return showToast("請填寫委託標題與需求說明");
    const selectedRequestStyles = Array.isArray(requestForm.styles) ? requestForm.styles : [];
    if (selectedRequestStyles.includes(REQUEST_STYLE_OTHER) && !String(requestForm.styleOtherText || "").trim()) return showToast("請填寫其他喜歡的風格，或取消勾選其他。");
    const deadlineAt = requestForm.deadline ? new Date(`${requestForm.deadline}T23:59:59`).getTime() : null;
    const payload = { userId: user.uid, title: requestForm.title.trim(), description: requestForm.description.trim(), requestType: requestForm.requestType || "其他", budgetRange: requestForm.budgetRange || "歡迎私訊報價", deadline: Number.isFinite(deadlineAt) ? deadlineAt : null, deadlineDate: requestForm.deadline || "", styles: selectedRequestStyles.slice(0, 12), styleOtherText: String(requestForm.styleOtherText || "").trim().slice(0, 80), referenceUrl: requestForm.referenceUrl.trim(), status: "open", updatedAt: Date.now() };
    try {
      if (requestForm.id) { await setDoc(doc(db, getPath("commission_requests"), requestForm.id), payload, { merge: true }); showToast("✅ 委託需求已更新"); }
      else { await addDoc(collection(db, getPath("commission_requests")), { ...payload, applicants: [], createdAt: Date.now() }); showToast("✅ 委託需求已發布"); }
      resetRequestForm(); setIsRequestFormOpen(false);
    } catch (err) { console.error("委託需求儲存失敗:", err); showToast(`❌ 儲存失敗：${err.code || err.message || "請稍後再試"}`); }
  };
  const handleEditRequest = (r) => { setRequestForm({ id: r.id, title: r.title || "", description: r.description || "", requestType: r.requestType || "繪圖", budgetRange: r.budgetRange || "歡迎私訊報價", deadline: r.deadlineDate || (r.deadline ? new Date(r.deadline).toISOString().slice(0, 10) : ""), styles: Array.isArray(r.styles) ? r.styles : [], styleOtherText: r.styleOtherText || "", referenceUrl: r.referenceUrl || "" }); setIsRequestFormOpen(true); setActiveTab("requests"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const handleDeleteRequest = async (id) => { if (!confirm("確定要刪除這則委託需求嗎？")) return; try { await deleteDoc(doc(db, getPath("commission_requests"), id)); showToast("✅ 已刪除委託需求"); } catch (err) { console.error("委託需求刪除失敗:", err); showToast("刪除失敗"); } };
  const handleApplyRequest = async (r) => {
    if (!user) return showToast("請先登入");
    if (r.userId === user.uid) return showToast("這是你發布的需求");
    const applicants = Array.isArray(r.applicants) ? r.applicants : [];
    const isApplying = !applicants.includes(user.uid);
    if (isApplying && applicants.length >= 5) return showToast("這則委託已達 5 名提案人上限");
    try {
      const applyCommissionRequest = httpsCallable(functionsInstance, "applyCommissionRequest");
      const result = await applyCommissionRequest({ requestId: r.id, action: isApplying ? "apply" : "cancel" });
      showToast(result?.data?.message || (isApplying ? "✅ 已送出接案意願，請等待發案人挑選" : "已取消接案意願"));
    } catch (err) {
      console.error("接案意願更新失敗:", err);
      showToast(err?.message || "操作失敗，請稍後再試");
    }
  };
  const authorOf = (uid) => (realVtubers || []).find((v) => v.id === uid);

  return (
    <div ref={commissionTopRef} className="max-w-6xl mx-auto px-4 py-10 animate-fade-in-up">
      <div className="mb-8 bg-[#181B25] border border-[#2A2F3D] rounded-2xl p-6 sm:p-8 shadow-sm">
        <p className="text-xs font-bold text-[#38BDF8] tracking-[0.18em] uppercase mb-3">{isBoardOnly ? "Commission Board" : "Creator Market"}</p>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">{isBoardOnly ? "委託佈告欄" : "繪師 / 建模師 / 剪輯師委託專區"}</h2>
            <p className="text-[#94A3B8] max-w-2xl leading-relaxed">{isBoardOnly ? "想找繪圖、建模、剪輯找不到人？來佈告欄表達需求，老師們可能就會找上你哦！" : "找作品集、看檔期，快速比較繪師、建模師與剪輯師的名片資料。"}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {isBoardOnly ? (
              <>
                <button onClick={() => navigate("commissions")} className="inline-flex items-center justify-center bg-[#1D2130] hover:bg-[#2A2F3D] text-white px-5 py-3 rounded-xl font-bold transition-colors whitespace-nowrap">找創作者</button>
              </>
            ) : (
              <>
                <button onClick={() => { navigate("dashboard"); setTimeout(() => { document.getElementById("creator-service-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 180); setTimeout(() => { document.getElementById("creator-service-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 650); }} className="inline-flex items-center justify-center bg-[#1D2130] hover:bg-[#2A2F3D] text-white px-5 py-3 rounded-xl font-bold transition-colors whitespace-nowrap">補上我的創作技能標籤</button>
                <button onClick={() => navigate("commission-board")} className="inline-flex items-center justify-center bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 py-3 rounded-xl font-bold transition-colors whitespace-nowrap">前往委託佈告欄</button>
              </>
            )}
          </div>
        </div>
      </div>

      {!isBoardOnly && false && (
        <div className="mb-6 flex gap-2 bg-[#11131C] border border-[#2A2F3D] p-1 rounded-2xl w-fit">
          <button onClick={() => setActiveTab("creators")} className={`px-4 py-2 rounded-xl text-sm font-extrabold transition-colors ${activeTab === "creators" ? "bg-[#38BDF8] text-[#0F111A]" : "text-[#94A3B8] hover:text-white"}`}>找創作者</button>
          <button onClick={() => setActiveTab("requests")} className={`px-4 py-2 rounded-xl text-sm font-extrabold transition-colors ${activeTab === "requests" ? "bg-[#8B5CF6] text-white" : "text-[#94A3B8] hover:text-white"}`}>委託佈告欄</button>
        </div>
      )}

      {!isBoardOnly && activeTab === "creators" && <>
        <div className="mb-6 bg-[#11131C] border border-[#2A2F3D] rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col xl:flex-row xl:items-end gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#94A3B8] mb-2 tracking-widest uppercase">創作者身份</p>
              <div className="flex flex-wrap gap-2">
                {roleFilters.map((role) => <button key={role} onClick={() => setActiveRoleFilter(role)} className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${activeRoleFilter === role ? "bg-[#38BDF8] text-[#0F111A] border-[#38BDF8]" : "bg-[#181B25] text-[#CBD5E1] border-[#2A2F3D] hover:bg-[#1D2130]"}`}>{role === "All" ? "全部" : role}</button>)}
              </div>
            </div>
            <div className="w-full xl:w-[320px] flex-shrink-0">
              <label className="block text-xs font-bold text-[#94A3B8] mb-2 tracking-widest uppercase">進階風格篩選</label>
              <select value={activeCreatorStyleFilter} onChange={(e) => setActiveCreatorStyleFilter(e.target.value)} className="w-full bg-[#181B25] border border-[#2A2F3D] text-white rounded-xl px-4 py-2.5 outline-none focus:border-[#38BDF8]">
                {creatorStyleFilters.map((style) => <option key={style} value={style}>{style === "All" ? "全部創作風格 / 類型" : style}</option>)}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                setCreatorShuffleSeed(Date.now());
                setCommissionPage(1);
                showToast("🎲 已重新洗牌創作者順序");
              }}
              className="w-full xl:w-auto bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#0F111A] px-5 py-2.5 rounded-xl font-extrabold transition-colors whitespace-nowrap flex-shrink-0 inline-flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-shuffle"></i>重新洗牌
            </button>
          </div>
        </div>
        {creatorList.length === 0 ? <div className="bg-[#181B25] border border-dashed border-[#2A2F3D] rounded-2xl p-8 text-center"><p className="text-white text-lg font-bold mb-2">目前還沒有繪師 / 建模師 / 剪輯師名片</p><p className="text-[#94A3B8] text-sm mb-5">如果你會繪圖、建模或剪輯，可以先到名片編輯中勾選身份，讓其他 VTuber 更容易找到你。</p><button onClick={() => navigate("dashboard")} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 py-2.5 rounded-xl font-bold transition-colors">去補上身份</button></div> : filteredCreatorList.length === 0 ? <div className="bg-[#181B25] border border-dashed border-[#2A2F3D] rounded-2xl p-8 text-center"><p className="text-white text-lg font-bold mb-2">目前沒有符合篩選條件的創作者</p><p className="text-[#94A3B8] text-sm">可以切換身份或創作風格 / 類型，之後也可以再回來看看新的委託名片。</p></div> : <>
          <div className="mb-4 flex items-center justify-end gap-2 text-sm text-[#94A3B8]">
            <p className="text-xs">目前顯示 {pagedCreatorList.length} 位 / 共 {filteredCreatorList.length} 位創作者</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch">
            {pagedCreatorList.map((v, idx) => {
              const showcase = sanitizeUrl(v.banner || v.avatar || "");
              const roles = Array.isArray(v.creatorRoles) ? v.creatorRoles : [];
              const creatorStyles = Array.isArray(v.creatorStyles) ? v.creatorStyles : [];
              const creatorStatus = v.creatorStatus || "";
              const creatorBudgetRange = normalizeCreatorBudgetRange(v.creatorBudgetRange);
              const displayStyles = creatorStyles.length > 0 ? creatorStyles : (Array.isArray(v.tags) ? v.tags : []);
              return <article key={v.id} onClick={() => openProfile(v)} className="group bg-[#181B25] border border-[#2A2F3D] rounded-[1.5rem] overflow-hidden shadow-sm hover:border-[#38BDF8]/60 hover:shadow-xl hover:shadow-[#38BDF8]/10 transition-all cursor-pointer h-full flex flex-col" title="查看詳細名片">
                <div className="aspect-square bg-[#11131C] relative overflow-hidden">
                  {showcase ? <img src={showcase} alt={v.name || "作品展示"} className="w-full h-full object-cover opacity-90 group-hover:scale-105 group-hover:opacity-100 transition-all duration-500" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : null}
                  {!showcase && <div className="w-full h-full flex flex-col items-center justify-center text-[#64748B] text-sm bg-gradient-to-br from-[#11131C] to-[#1D2130]"><i className="fa-solid fa-image text-3xl mb-3 opacity-60"></i>作品展示區規劃中</div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0F111A] via-[#0F111A]/15 to-transparent"></div>
                  <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-2">{roles.map((role) => <span key={role} className="bg-[#38BDF8] text-[#0F111A] px-3 py-1 rounded-full text-xs font-extrabold shadow-sm">{role}</span>)}</div>
                    {creatorStatus && <span className="bg-[#22C55E]/90 text-[#052E16] px-3 py-1 rounded-full text-xs font-black shadow-sm whitespace-nowrap">{creatorStatus}</span>}
                  </div>
                  <div className="absolute left-4 right-4 bottom-4">
                    <div className="flex items-end gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-[#11131C] border border-white/20 overflow-hidden flex-shrink-0 shadow-lg">
                        {v.avatar ? <img src={sanitizeUrl(v.avatar)} alt={v.name || "創作者頭像"} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-white text-xl font-black truncate flex items-center gap-2 drop-shadow">{v.name || "未命名創作者"}{v.isVerified && <span className="text-[#22C55E] text-xs font-bold bg-black/40 px-2 py-0.5 rounded-full">已認證</span>}</h3>
                        <p className="text-[#BAE6FD] text-xs font-bold mt-1 truncate">{roles.join(" / ") || "創作服務"}{creatorBudgetRange ? `｜${creatorBudgetRange}` : ""}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <p className="text-[#CBD5E1] text-sm leading-relaxed line-clamp-3 mb-4 min-h-[4rem]">{v.description || "尚未填寫作品與委託說明，先看看他的名片了解更多。"}</p>
                  <div className="flex flex-nowrap gap-2 mb-4 overflow-hidden min-h-[1.75rem]" title={displayStyles.length > 0 ? displayStyles.map((style) => style === "其他(自由填寫)" && v.creatorOtherStyleText ? v.creatorOtherStyleText : style).join("、") : "尚未填寫風格"}>
                    {displayStyles.slice(0, 4).map((style) => <span key={style} className="bg-[#11131C] border border-[#2A2F3D] text-[#CBD5E1] px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 max-w-[7.5rem] truncate">{style === "其他(自由填寫)" && v.creatorOtherStyleText ? v.creatorOtherStyleText : style}</span>)}
                    {displayStyles.length > 4 && <span className="bg-[#38BDF8]/10 border border-[#38BDF8]/30 text-[#7DD3FC] px-2.5 py-1 rounded-full text-xs font-black whitespace-nowrap flex-shrink-0">+{displayStyles.length - 4}</span>}
                    {displayStyles.length === 0 && <span className="bg-[#11131C] border border-[#2A2F3D] text-[#64748B] px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0">尚未填寫風格</span>}
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onOpenChat ? onOpenChat(v) : openProfile(v); }} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white py-2 rounded-lg font-bold transition-colors text-xs inline-flex items-center justify-center gap-1.5"><i className="fa-regular fa-comment-dots"></i>私訊檔期</button>
                    <button onClick={(e) => { e.stopPropagation(); v.creatorPortfolioUrl ? openPortfolio(v.creatorPortfolioUrl) : openProfile(v); }} className={`${v.creatorPortfolioUrl ? "bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#0F111A]" : "bg-[#1D2130] text-[#94A3B8]"} py-2 rounded-lg font-bold transition-colors text-xs inline-flex items-center justify-center gap-1.5`}><i className="fa-solid fa-images"></i>觀看作品集</button>
                  </div>
                </div>
              </article>;
            })}
          </div>

          {filteredCreatorList.length > COMMISSION_PAGE_SIZE && <div className="mt-8 flex items-center justify-center gap-3"><button onClick={() => goCommissionCreatorPage(safeCommissionPage - 1)} disabled={safeCommissionPage === 1} className={`px-4 py-2 rounded-lg font-bold text-sm ${safeCommissionPage === 1 ? "bg-[#181B25] text-gray-600 cursor-not-allowed" : "bg-[#1D2130] text-white hover:bg-[#2A2F3D]"}`}>上一頁</button><span className="text-[#94A3B8] text-sm font-bold">第 {safeCommissionPage} / {totalCommissionPages} 頁</span><button onClick={() => goCommissionCreatorPage(safeCommissionPage + 1)} disabled={safeCommissionPage === totalCommissionPages} className={`px-4 py-2 rounded-lg font-bold text-sm ${safeCommissionPage === totalCommissionPages ? "bg-[#181B25] text-gray-600 cursor-not-allowed" : "bg-[#1D2130] text-white hover:bg-[#2A2F3D]"}`}>下一頁</button></div>}
        </>}
      </>}

      {isBoardOnly && activeTab === "requests" && <div className="space-y-6">
        <div className="bg-[#11131C] border border-[#2A2F3D] rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#94A3B8] mb-2 tracking-widest uppercase">主要分類</p>
              <div className="flex flex-wrap gap-2">
                {requestFilters.map((type) => <button key={type} onClick={() => setRequestFilter(type)} className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${requestFilter === type ? "bg-[#8B5CF6] text-white border-[#8B5CF6]" : "bg-[#181B25] text-[#CBD5E1] border-[#2A2F3D] hover:bg-[#1D2130]"}`}>{type === "All" ? "全部需求" : type}</button>)}
              </div>
            </div>
            <div className="w-full xl:w-[320px] flex-shrink-0">
              <label className="block text-xs font-bold text-[#94A3B8] mb-2 tracking-widest uppercase">進階風格篩選</label>
              <select value={requestStyleFilter} onChange={(e) => setRequestStyleFilter(e.target.value)} className="w-full bg-[#181B25] border border-[#2A2F3D] text-white rounded-xl px-4 py-2.5 outline-none focus:border-[#8B5CF6]">
                {requestStyleFilters.map((style) => <option key={style} value={style}>{style === "All" ? "全部創作風格 / 類型" : style}</option>)}
              </select>
            </div>
            <button onClick={() => { resetRequestForm(); setIsRequestFormOpen(!isRequestFormOpen); }} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 py-3 rounded-xl font-bold transition-colors whitespace-nowrap flex-shrink-0">{isRequestFormOpen ? "收起需求表單" : "發布委託需求"}</button>
          </div>
        </div>
        {isRequestFormOpen && (
          <div className="bg-[#181B25] border border-[#2A2F3D] rounded-2xl p-5 sm:p-6 shadow-sm">
            <h3 className="text-white text-xl font-extrabold mb-5">{requestForm.id ? "編輯委託需求" : "發布新的委託需求"}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <label className="block text-sm font-bold text-[#CBD5E1] mb-2">需求標題 *</label>
                <input value={requestForm.title} onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })} className={inputCls} placeholder="例如：想找可愛風格頭貼繪師" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#CBD5E1] mb-2">需求類型</label>
                <select value={requestForm.requestType} onChange={(e) => setRequestForm({ ...requestForm, requestType: e.target.value })} className={inputCls}>{["繪圖", "建模", "剪輯", "其他"].map((x) => <option key={x} value={x}>{x}</option>)}</select>
              </div>
              <div>
                <label className="block text-sm font-bold text-[#CBD5E1] mb-2">預算區間</label>
                <select value={requestForm.budgetRange} onChange={(e) => setRequestForm({ ...requestForm, budgetRange: e.target.value })} className={inputCls}>{REQUEST_BUDGET_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}</select>
              </div>
              <div>
                <label className="block text-sm font-bold text-[#CBD5E1] mb-2">希望完成日期</label>
                <input type="date" value={requestForm.deadline} onChange={(e) => setRequestForm({ ...requestForm, deadline: e.target.value })} className={inputCls} />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-bold text-[#CBD5E1] mb-3">喜歡的風格 <span className="text-[#94A3B8] text-xs font-normal">可多選</span></label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {CREATOR_STYLE_OPTIONS.map((style) => {
                    const checked = Array.isArray(requestForm.styles) && requestForm.styles.includes(style);
                    return (
                      <label key={style} className={"flex items-center gap-2 cursor-pointer rounded-xl border px-3 py-2 transition-colors " + (checked ? "bg-[#8B5CF6]/10 border-[#8B5CF6]/40 text-[#C4B5FD]" : "bg-[#11131C] border-[#2A2F3D] text-[#CBD5E1] hover:bg-[#1D2130]")}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const current = Array.isArray(requestForm.styles) ? requestForm.styles : [];
                            const next = checked ? current.filter((x) => x !== style) : [...current, style].slice(0, 12);
                            setRequestForm({ ...requestForm, styles: next });
                          }}
                          className="accent-purple-500 w-4 h-4"
                        />
                        <span className="text-sm font-bold">{style}</span>
                      </label>
                    );
                  })}
                </div>
                {Array.isArray(requestForm.styles) && requestForm.styles.includes(REQUEST_STYLE_OTHER) && (
                  <input
                    value={requestForm.styleOtherText || ""}
                    onChange={(e) => setRequestForm({ ...requestForm, styleOtherText: e.target.value })}
                    className={inputCls + " mt-3"}
                    placeholder="請填寫其他喜歡的風格"
                  />
                )}
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-bold text-[#CBD5E1] mb-2">參考連結</label>
                <input value={requestForm.referenceUrl} onChange={(e) => setRequestForm({ ...requestForm, referenceUrl: e.target.value })} className={inputCls} placeholder="可放參考圖、影片或 Notion / X / Google Drive 連結" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-bold text-[#CBD5E1] mb-2">需求說明 *</label>
                <textarea value={requestForm.description} onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })} className={inputCls + " min-h-[140px]"} placeholder="簡單描述你想做什麼、用途、希望風格與注意事項。" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-5">
              <button onClick={() => { resetRequestForm(); setIsRequestFormOpen(false); }} className="bg-[#1D2130] hover:bg-[#2A2F3D] text-white px-5 py-3 rounded-xl font-bold">取消</button>
              <button onClick={handleSaveRequest} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-6 py-3 rounded-xl font-bold">{requestForm.id ? "儲存修改" : "發布需求"}</button>
            </div>
          </div>
        )}
        {filteredRequests.length === 0 ? (
          <div className="bg-[#181B25] border border-dashed border-[#2A2F3D] rounded-2xl p-8 text-center">
            <p className="text-white text-lg font-bold mb-2">還沒有委託需求</p>
            <p className="text-[#94A3B8] text-sm mb-5">有頭貼、立繪、建模或剪輯需求嗎？發一則需求，讓創作者更容易看見你。</p>
            <button onClick={() => setIsRequestFormOpen(true)} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 py-2.5 rounded-xl font-bold">發布委託需求</button>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {pagedRequests.map((r) => {
              const author = authorOf(r.userId);
              const applicants = Array.isArray(r.applicants) ? r.applicants : [];
              const applicantProfiles = applicants.map((uid) => authorOf(uid)).filter(Boolean);
              const isOwner = user && r.userId === user.uid;
              const isApplying = user && applicants.includes(user.uid);
              const displayStyles = (Array.isArray(r.styles) ? r.styles : []).map((s) => s === REQUEST_STYLE_OTHER ? (r.styleOtherText || "其他") : s).filter(Boolean);
              return (
                <article key={r.id} className="bg-[#181B25] border border-[#2A2F3D] rounded-2xl p-5 shadow-sm hover:bg-[#1D2130] transition-colors h-full flex flex-col">
                  <div className="flex items-start gap-3 mb-4">
                    <button onClick={() => author && openProfile(author)} className="w-12 h-12 rounded-2xl bg-[#11131C] border border-[#2A2F3D] overflow-hidden flex-shrink-0" title="查看發案者名片">
                      {author?.avatar ? <img src={sanitizeUrl(author.avatar)} alt={author?.name || "發案者"} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <div className="w-full h-full flex items-center justify-center text-[#64748B]"><i className="fa-solid fa-user"></i></div>}
                    </button>
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/30 px-3 py-1 rounded-full text-xs font-extrabold mb-2">{r.requestType || "委託"}</span>
                      <h3 className="text-white text-xl font-extrabold leading-tight line-clamp-2 w-full break-words">{r.title || "未命名需求"}</h3>
                      <p className="text-xs text-[#94A3B8] mt-1">
                        發案者：{author ? (
                          <button type="button" onClick={() => openProfile(author)} className="text-white font-bold hover:text-[#A78BFA] hover:underline underline-offset-4 transition-colors">
                            {author.name || "匿名創作者"}
                          </button>
                        ) : (
                          <span className="text-white font-bold">匿名創作者</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <p className="text-[#CBD5E1] text-sm leading-relaxed line-clamp-3 mb-4">{r.description}</p>
                  <div className="mt-auto flex flex-col">
                    <div className="pt-3 border-t border-[#2A2F3D]/70">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {displayStyles.slice(0, 6).map((s) => <span key={s} className="bg-[#11131C] border border-[#2A2F3D] text-[#CBD5E1] px-2.5 py-1 rounded-full text-xs font-bold">{s}</span>)}
                        {displayStyles.length === 0 && <span className="bg-[#11131C] border border-[#2A2F3D] text-[#94A3B8] px-2.5 py-1 rounded-full text-xs font-bold">風格可討論</span>}
                      </div>
                      <div className="text-xs text-[#94A3B8] space-y-1 mb-4">
                        <p>希望完成：<span className="text-white font-bold">{r.deadline ? formatDateOnly(r.deadline) : "可討論"}</span></p>
                        <p>預算：<span className="text-white font-bold">{r.budgetRange || "歡迎私訊"}</span></p>
                        <p>目前有 <span className="text-[#38BDF8] font-bold">{applicants.length}/5</span> 位創作者表示有興趣</p>
                      </div>
                    </div>
                    <div className="mb-4 rounded-xl bg-[#0F111A] border border-[#2A2F3D] p-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-xs font-extrabold text-[#CBD5E1]">提案人名單</p>
                        <span className="text-[11px] text-[#94A3B8]">最多 5 位</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {applicantProfiles.slice(0, 5).map((a) => (
                            <button key={a.id} onClick={() => openProfile(a)} className="w-8 h-8 rounded-full ring-2 ring-[#0F111A] bg-[#1D2130] overflow-hidden border border-[#2A2F3D]" title={a.name || "接案人"}>
                              {a.avatar ? <img src={sanitizeUrl(a.avatar)} alt={a.name || "接案人"} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <span className="w-full h-full flex items-center justify-center text-[#64748B] text-xs"><i className="fa-solid fa-user"></i></span>}
                            </button>
                          ))}
                          {applicantProfiles.length === 0 && <div className="w-8 h-8 rounded-full bg-[#1D2130] ring-2 ring-[#0F111A] flex items-center justify-center text-[#64748B] text-xs"><i className="fa-regular fa-user"></i></div>}
                        </div>
                        <p className="text-xs text-[#94A3B8] leading-relaxed">發案人還在挑選中；如無進一步通知，請勿主動打擾發案人。</p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      {r.referenceUrl && <button onClick={() => openPortfolio(r.referenceUrl)} className="bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#0F111A] px-4 py-2.5 rounded-xl font-bold text-sm">看參考資料</button>}
                      {!isOwner && <button disabled={!isApplying && applicants.length >= 5} onClick={() => handleApplyRequest(r)} className={(isApplying ? "bg-[#1D2130] text-[#CBD5E1]" : applicants.length >= 5 ? "bg-[#1D2130] text-[#64748B] cursor-not-allowed" : "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white") + " px-4 py-2.5 rounded-xl font-bold text-sm"}>{isApplying ? "取消接案意願" : applicants.length >= 5 ? "提案已滿" : "我想接案"}</button>}
                      {(isOwner || isAdmin) && <><button onClick={() => handleEditRequest(r)} className="bg-[#1D2130] hover:bg-[#2A2F3D] text-white px-4 py-2.5 rounded-xl font-bold text-sm">編輯</button><button onClick={() => handleDeleteRequest(r.id)} className="bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/30 px-4 py-2.5 rounded-xl font-bold text-sm">刪除委託（停止收案）</button></>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {filteredRequests.length > REQUEST_PAGE_SIZE && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => goCommissionRequestPage(safeRequestPage - 1)} disabled={safeRequestPage === 1} className={`px-4 py-2 rounded-lg font-bold text-sm ${safeRequestPage === 1 ? "bg-[#181B25] text-gray-600 cursor-not-allowed" : "bg-[#1D2130] text-white hover:bg-[#2A2F3D]"}`}>上一頁</button>
              <span className="text-[#94A3B8] text-sm font-bold">第 {safeRequestPage} / {totalRequestPages} 頁</span>
              <button onClick={() => goCommissionRequestPage(safeRequestPage + 1)} disabled={safeRequestPage === totalRequestPages} className={`px-4 py-2 rounded-lg font-bold text-sm ${safeRequestPage === totalRequestPages ? "bg-[#181B25] text-gray-600 cursor-not-allowed" : "bg-[#1D2130] text-white hover:bg-[#2A2F3D]"}`}>下一頁</button>
            </div>
          )}
          </>
        )}
      </div>}
    </div>
  );
};

const HomePage = ({
  navigate,
  onOpenRules,
  onOpenUpdates,
  hasUnreadUpdates,
  siteStats = { pageViews: null },
  realCollabs = [],
  displayCollabs = [],
  currentTime = Date.now(),
  isLoadingCollabs,
  goToBulletin,
  registeredCount,
  realVtubers = [],
  setSelectedVTuber,
  realBulletins = [],
  onShowParticipants,
  user,
  isVerifiedUser,
  onApply,
  onNavigateProfile,
  onOpenStoryComposer,
}) => {
  const [statusShuffleSeed, setStatusShuffleSeed] = useState(Date.now());
  const [isShuffling, setIsShuffling] = useState(false);

  const handleShuffleStatus = () => {
    if (isShuffling) return;
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
    const q = query(
      collection(db, getPath("commission_requests")),
      orderBy("createdAt", "desc"),
      limit(12),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setHomeCommissionRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn("首頁委託佈告欄讀取失敗:", err),
    );
    return () => unsub();
  }, []);

  const completedCollabsCount = useMemo(() => {
    return siteStats?.totalCompletedCollabs || 0;
  }, [siteStats]);

  const randomBulletins = useMemo(() => {
    const active = safeBulletins.filter(
      (b) => !b.recruitEndTime || currentTime < b.recruitEndTime,
    );
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
    if (!safeDisplayCollabs.length) return [];
    return [...safeDisplayCollabs]
      .filter((c) => c && c.id)
      .sort((a, b) => getStableRandom(a.id) - getStableRandom(b.id))
      .slice(0, 4);
  }, [safeDisplayCollabs.length]);

  const recommendedVtubers = useMemo(() => {
    const myProfile = user ? realVtubers.find((v) => v.id === user.uid) : null;
    const isVerified =
      myProfile?.isVerified &&
      !myProfile?.isBlacklisted &&
      myProfile?.activityStatus === "active";

    const candidates = [...realVtubers].filter(
      (v) =>
        v.isVerified &&
        !v.isBlacklisted &&
        v.activityStatus !== "sleep" &&
        v.activityStatus !== "graduated" &&
        !String(v.id || "").startsWith("mock") &&
        v.id !== user?.uid,
    );

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
      .filter((v) =>
        v.isVerified &&
        !v.isBlacklisted &&
        Array.isArray(v.creatorRoles) &&
        v.creatorRoles.length > 0 &&
        !String(v.id || "").startsWith("mock")
      );

    const picked = [];
    ["繪師", "建模師", "剪輯師"].forEach((role) => {
      const candidates = base
        .filter((v) => v.creatorRoles.includes(role) && !picked.some((p) => p.id === v.id))
        .sort((a, b) => getStableRandom(`${role}-${a.id || a.name}`) - getStableRandom(`${role}-${b.id || b.name}`));
      if (candidates[0]) picked.push({ ...candidates[0], recommendedRole: role });
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
    const hasSchedule =
      profile.isScheduleAnytime ||
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
      if (
        !v.isVerified ||
        v.isBlacklisted ||
        v.activityStatus === "sleep" ||
        v.activityStatus === "graduated" ||
        String(v.id || "").startsWith("mock") ||
        !v.statusMessage ||
        !v.statusMessageUpdatedAt
      )
        return false;

      const isLiveMsg = v.statusMessage.includes("🔴");
      const expireLimit = isLiveMsg ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      return now - v.statusMessageUpdatedAt < expireLimit;
    });

    return validStatuses
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);
  }, [realVtubers, statusShuffleSeed]);

  const MobileMoreCard = ({ onClick, icon, text, subText }) => (
    <div
      className="flex-shrink-0 w-[60vw] sm:hidden flex flex-col items-center justify-center snap-center bg-[#181B25] border border-dashed border-[#2A2F3D] rounded-2xl p-6 text-center gap-3 active:scale-[0.98] transition-transform"
      onClick={onClick}
    >
      <div className="w-12 h-12 bg-[#8B5CF6]/15 rounded-full flex items-center justify-center text-[#A78BFA] text-xl">
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <div>
        <p className="text-[#F8FAFC] font-bold">{text}</p>
        <p className="text-[10px] text-[#94A3B8] mt-1">{subText}</p>
      </div>
    </div>
  );

  const SectionHeader = ({ icon, iconColor = "text-[#8B5CF6]", title, desc, action }) => (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 text-left">
      <div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-[#F8FAFC] flex items-center gap-2">
          <i className={`fa-solid ${icon} ${iconColor}`}></i>
          {title}
        </h2>
        {desc && <p className="text-[#94A3B8] text-sm mt-2 leading-relaxed">{desc}</p>}
      </div>
      {action}
    </div>
  );

  const GuideCard = ({ icon, title, desc, onClick, color = "#8B5CF6" }) => (
    <button
      onClick={onClick}
      className="text-left bg-[#181B25] hover:bg-[#1D2130] border border-[#2A2F3D] rounded-2xl p-5 transition-colors group"
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: `${color}22`, color }}
      >
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <h3 className="text-[#F8FAFC] font-bold mb-1 group-hover:text-white transition-colors">
        {title}
      </h3>
      <p className="text-[#94A3B8] text-sm leading-relaxed">{desc}</p>
    </button>
  );

  return (
    <section className="pt-10 md:pt-14 pb-20 px-4 max-w-6xl mx-auto animate-fade-in-up">
      {/* 1. 簡短 Hero：社群入口，而不是產品宣傳頁 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 items-stretch mb-10">
        <div className="bg-[#181B25] border border-[#2A2F3D] rounded-2xl p-6 md:p-8 text-center lg:text-left h-full flex flex-col">
          <div className="inline-flex w-fit px-3 py-1.5 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#C4B5FD] text-xs font-bold mb-5 mx-auto lg:mx-0">
            <span>專為 VTuber 打造的聯動與創作社群</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-[#F8FAFC] mb-5">
            <span className="block">為你的 Vtuber 生涯</span>
            <span className="block">加一點朋友！</span>
          </h1>
          <p className="text-[#CBD5E1] text-lg md:text-xl leading-relaxed max-w-2xl mx-auto lg:mx-0 mb-3">
            找聯動、發企劃、認識適合一起創作的 VTuber。
          </p>
          <p className="text-[#94A3B8] text-sm md:text-base leading-relaxed max-w-2xl mx-auto lg:mx-0">
            大家平時要找聯動夥伴，是不是不知道該如何開口，又不敢隨便私訊怕打擾對方？註冊你的名片，找尋你的夥伴吧！
          </p>
          <p className="text-[#F59E0B] text-xs md:text-sm font-bold mt-5 leading-relaxed max-w-2xl mx-auto lg:mx-0 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl px-4 py-3">
            目前僅開放YT訂閱或TWITCH追隨加起來高於500、近一個月有直播活動之Vtuber或繪師、建模師、剪輯師則由管理員認定，敬請見諒。
          </p>

          {/* 2. 立即行動：桌機改成 3 + 2，避免五顆按鈕同排太擠 */}
          <div className="mt-7 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => navigate("dashboard")}
                className="h-12 bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/40 px-5 rounded-xl font-bold transition-colors flex items-center justify-center whitespace-nowrap"
              >
                <i className="fa-solid fa-pen-to-square mr-2"></i>管理名片
              </button>
              <button
                onClick={onOpenUpdates}
                className="relative h-12 bg-[#38BDF8]/12 hover:bg-[#38BDF8]/20 text-[#7DD3FC] border border-[#38BDF8]/30 px-5 rounded-xl font-bold transition-colors flex items-center justify-center whitespace-nowrap"
              >
                <i className="fa-solid fa-bullhorn mr-2"></i>最新消息
                {hasUnreadUpdates && (
                  <span className="absolute -top-1.5 -right-1.5 rounded-full h-3.5 w-3.5 bg-[#EF4444] border border-[#0F111A]"></span>
                )}
              </button>
              <button
                onClick={onOpenRules}
                className="h-12 bg-[#EF4444]/10 hover:bg-[#EF4444]/15 text-[#FCA5A5] border border-[#EF4444]/30 px-5 rounded-xl font-bold transition-colors flex items-center justify-center whitespace-nowrap"
              >
                <i className="fa-solid fa-triangle-exclamation mr-2"></i>聯動規範
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => goToBulletin ? goToBulletin() : navigate("bulletin")}
                className="h-12 bg-rose-600 hover:bg-rose-500 border border-rose-500/50 text-white px-5 rounded-xl font-bold transition-colors flex items-center justify-center whitespace-nowrap shadow-md"
              >
                <i className="fa-solid fa-bullhorn mr-2"></i>揪團佈告欄
              </button>
              <button
                onClick={goToCommissionRequests}
                className="h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border border-[#8B5CF6]/50 px-5 rounded-xl font-bold transition-colors flex items-center justify-center whitespace-nowrap shadow-md"
              >
                <i className="fa-solid fa-clipboard-list mr-2"></i>委託佈告欄
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#181B25] border border-[#2A2F3D] rounded-2xl p-6 text-left h-full flex flex-col">
          <div>
            <p className="text-[#94A3B8] text-xs font-bold tracking-widest uppercase mb-3">
              Community Snapshot
            </p>
            <h2 className="text-2xl font-extrabold text-[#F8FAFC] mb-2">
              今天就從一張名片開始
            </h2>
            <p className="text-[#94A3B8] text-sm leading-relaxed">
              管理名片、填上聯動偏好，再去看看最近有哪些創作者正在找企劃夥伴。
            </p>

            <div className="mt-5 bg-[#11131C] border border-[#2A2F3D] rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-[#F8FAFC] text-sm font-bold">現在誰有動態？</p>
                  <p className="text-[#94A3B8] text-[11px] mt-0.5">橘圈是限動、紅圈是直播中，點頭像直接看名片。</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={onOpenStoryComposer}
                    className="inline-flex items-center gap-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F111A] px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-colors whitespace-nowrap"
                  >
                    <i className="fa-solid fa-plus"></i> 我也要發
                  </button>
                  <button
                    onClick={() => navigate("status_wall")}
                    className="text-[11px] font-bold text-[#F59E0B] hover:text-[#FBBF24] transition-colors whitespace-nowrap"
                  >
                    看全部
                  </button>
                </div>
              </div>

              {activeStatuses.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-1">
                  {activeStatuses.map((v) => {
                    const isLiveMsg = String(v.statusMessage || "").includes("🔴");
                    return (
                      <button
                        key={`home-story-${v.id}`}
                        onClick={() => {
                          setSelectedVTuber(v);
                          navigate(`profile/${v.id}`);
                        }}
                        className="flex-shrink-0 w-14 text-center group"
                        title={v.statusMessage}
                      >
                        <div className={`w-12 h-12 mx-auto rounded-full p-[2px] ${isLiveMsg ? "bg-[#EF4444]" : "bg-[#F59E0B]"}`}>
                          <div className="w-full h-full rounded-full bg-[#11131C] p-[2px]">
                            <img
                              src={sanitizeUrl(v.avatar)}
                              className="w-full h-full rounded-full object-cover bg-[#1D2130]"
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                              alt={v.name || "VTuber"}
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-[#F8FAFC] mt-1.5 truncate group-hover:text-[#F59E0B] transition-colors">{v.name}</p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <button
                  onClick={() => navigate("status_wall")}
                  className="w-full text-left bg-[#181B25] hover:bg-[#1D2130] border border-dashed border-[#2A2F3D] rounded-xl px-3 py-3 transition-colors"
                >
                  <p className="text-[#F8FAFC] text-sm font-bold">還沒有人發動態</p>
                  <p className="text-[#94A3B8] text-xs mt-1">去 24H 動態牆發一句話，讓大家更容易看見你。</p>
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-auto pt-6">
            <div className="bg-[#11131C] border border-[#2A2F3D] rounded-xl px-2 sm:px-4 py-3 text-center">
              <p className="text-[#94A3B8] text-[10px] sm:text-xs font-bold mb-1">VTUBER人數</p>
              <p className="text-xl sm:text-2xl font-black text-[#22C55E]">
                {registeredCount !== null ? <AnimatedCounter value={registeredCount} /> : <i className="fa-solid fa-spinner fa-spin text-lg"></i>}
                <span className="text-[10px] sm:text-sm text-[#94A3B8] ml-1">位</span>
              </p>
            </div>
            <div className="bg-[#11131C] border border-[#2A2F3D] rounded-xl px-2 sm:px-4 py-3 text-center">
              <p className="text-[#94A3B8] text-[10px] sm:text-xs font-bold mb-1">已成功促成聯動</p>
              <p className="text-xl sm:text-2xl font-black text-[#38BDF8]">
                {!isLoadingCollabs ? <AnimatedCounter value={completedCollabsCount} /> : <i className="fa-solid fa-spinner fa-spin text-lg"></i>}
                <span className="text-[10px] sm:text-sm text-[#94A3B8] ml-1">次</span>
              </p>
            </div>
            <div className="bg-[#11131C] border border-[#2A2F3D] rounded-xl px-2 sm:px-4 py-3 text-center">
              <p className="text-[#94A3B8] text-[10px] sm:text-xs font-bold mb-1">網站總瀏覽人次</p>
              <p className="text-xl sm:text-2xl font-black text-[#8B5CF6]">
                {siteStats?.pageViews !== null ? <AnimatedCounter value={siteStats.pageViews} /> : <i className="fa-solid fa-spinner fa-spin text-lg"></i>}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 今日活躍創作者 */}
      {recommendedVtubers.length > 0 && (
        <div className="mt-10 pt-10 border-t border-[#2A2F3D] w-full animate-fade-in-up">
          <SectionHeader
            icon="fa-user-group"
            iconColor="text-[#22C55E]"
            title="今日活躍創作者"
            desc="先看看最近適合認識的創作者，從一張名片開始找到聯動可能。"
            action={
              <button
                onClick={() => navigate("grid")}
                className="hidden sm:flex bg-[#181B25] hover:bg-[#1D2130] text-[#F8FAFC] px-5 py-2.5 rounded-xl font-bold border border-[#2A2F3D] transition-colors items-center gap-2 whitespace-nowrap"
              >
                探索更多 <i className="fa-solid fa-arrow-right text-[#38BDF8]"></i>
              </button>
            }
          />

          <div className="flex items-stretch overflow-x-auto pb-6 gap-4 snap-x snap-mandatory sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 sm:overflow-visible custom-scrollbar">
            {recommendedVtubers.map((v) => (
              <div key={v.id} className="flex-shrink-0 w-[75vw] sm:w-auto snap-center text-left h-auto">
                <VTuberCard
                  v={v}
                  onSelect={() => {
                    setSelectedVTuber(v);
                    navigate(`profile/${v.id}`);
                  }}
                  onDislike={() => {}}
                />
              </div>
            ))}
            <div className="flex-shrink-0 w-[60vw] sm:hidden">
              <MobileMoreCard
                onClick={() => navigate("grid")}
                icon="fa-magnifying-glass"
                text="探索更多創作者"
                subText="查看完整 VTuber 名單"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. 最近招募 */}
      <div className="mt-10 pt-10 border-t border-[#2A2F3D] w-full animate-fade-in-up">
        <SectionHeader
          icon="fa-bullhorn"
          iconColor="text-[#8B5CF6]"
          title="最近揪團"
          desc="正在尋找夥伴的企劃，或許就有你感興趣的。"
          action={
            <button
              onClick={goToBulletin}
              className="hidden sm:flex bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 py-2.5 rounded-xl font-bold transition-colors items-center gap-2 whitespace-nowrap"
            >
              找看看誰在揪團 <i className="fa-solid fa-arrow-right"></i>
            </button>
          }
        />

        {randomBulletins.length > 0 ? (
          <div className="flex items-stretch overflow-x-auto pb-6 gap-4 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible custom-scrollbar">
            {randomBulletins.map((b) => (
              <div key={b.id} className="flex-shrink-0 w-[85vw] md:w-auto snap-center text-left h-full">
                <BulletinCard
                  b={b}
                  user={user}
                  isVerifiedUser={isVerifiedUser}
                  onNavigateProfile={onNavigateProfile}
                  onApply={onApply}
                  currentView="home"
                />
              </div>
            ))}
            <MobileMoreCard
              onClick={goToBulletin}
              icon="fa-bullhorn"
              text="查看更多招募"
              subText="尋找適合你的聯動企劃"
            />
          </div>
        ) : (
          <div className="text-center py-12 px-6 bg-[#181B25] rounded-2xl border border-[#2A2F3D]">
            <p className="text-[#F8FAFC] font-bold text-lg">還沒有揪團企劃</p>
            <p className="text-[#94A3B8] text-sm mt-2">成為第一個發一個招募企劃的人吧，讓其他 VTuber 知道你正在找夥伴。</p>
            <button
              onClick={goToBulletin}
              className="mt-5 inline-flex items-center justify-center bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 py-2.5 rounded-xl font-bold transition-colors"
            >
              發一個招募企劃
            </button>
          </div>
        )}
      </div>

      {/* 推薦繪師 / 建模師 / 剪輯師 */}
      {recommendedCreatorsForCommission.length > 0 && (
        <div className="mt-10 pt-10 border-t border-[#2A2F3D] w-full">
          <SectionHeader
            icon="fa-palette"
            iconColor="text-[#38BDF8]"
            title="推薦繪師 / 建模師 / 剪輯師"
            desc="看看可以委託或合作的創作者，先從作品與名片開始認識。"
            action={
              <button
                onClick={() => navigate("commissions")}
                className="hidden sm:flex bg-[#181B25] hover:bg-[#1D2130] text-[#F8FAFC] px-5 py-2.5 rounded-xl font-bold border border-[#2A2F3D] transition-colors items-center gap-2 whitespace-nowrap"
              >
                查看委託專區 <i className="fa-solid fa-arrow-right text-[#38BDF8]"></i>
              </button>
            }
          />

          <div className="flex items-stretch overflow-x-auto pb-6 gap-4 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible custom-scrollbar">
            {recommendedCreatorsForCommission.map((v) => (
              <div
                key={`home-commission-${v.id}`}
                className="flex-shrink-0 w-[85vw] md:w-auto snap-center bg-[#181B25] border border-[#2A2F3D] rounded-2xl overflow-hidden text-left hover:bg-[#1D2130] transition-colors h-full"
              >
                <button
                  onClick={() => {
                    setSelectedVTuber(v);
                    navigate(`profile/${v.id}`);
                  }}
                  className="block w-full text-left"
                >
                  <div className="h-36 bg-[#11131C] overflow-hidden">
                    {v.banner ? (
                      <img src={sanitizeUrl(v.banner)} alt={v.name || "creator"} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    ) : (
                      <div className="w-full h-full bg-[#1D2130]"></div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <img src={sanitizeUrl(v.avatar)} alt={v.name || "creator"} className="w-12 h-12 rounded-xl object-cover bg-[#1D2130] border border-[#2A2F3D]" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      <div className="min-w-0">
                        <h3 className="text-[#F8FAFC] font-extrabold truncate">{v.name || "未命名創作者"}</h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(v.creatorRoles || []).slice(0, 2).map((role) => (
                            <span key={role} className="text-[10px] font-bold text-[#38BDF8] bg-[#38BDF8]/10 border border-[#38BDF8]/25 rounded-full px-2 py-0.5">{role}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-[#94A3B8] text-sm line-clamp-2 leading-relaxed min-h-[2.5rem]">
                      {v.description || "這位創作者還沒有填寫作品介紹，先看看名片認識一下。"}
                    </p>
                  </div>
                </button>
              </div>
            ))}
            <MobileMoreCard
              onClick={goToCommissionRequests}
              icon="fa-palette"
              text="查看委託專區"
              subText="找繪師、建模師與剪輯師"
            />
          </div>
        </div>
      )}

      {/* 委託佈告欄 */}
      <div className="mt-10 pt-10 border-t border-[#2A2F3D] w-full animate-fade-in-up">
        <SectionHeader
          icon="fa-clipboard-list"
          iconColor="text-[#8B5CF6]"
          title="委託佈告欄"
          desc="看看最近有哪些委託需求正在尋找繪師、建模師或剪輯師，接案前先確認需求與預算。"
          action={
            <button
              onClick={goToCommissionRequests}
              className="hidden sm:flex bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 py-2.5 rounded-xl font-bold transition-colors items-center gap-2 whitespace-nowrap"
            >
              查看全部委託 <i className="fa-solid fa-arrow-right"></i>
            </button>
          }
        />

        {featuredCommissionRequests.length > 0 ? (
          <div className="flex items-stretch overflow-x-auto pb-6 gap-4 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible custom-scrollbar">
            {featuredCommissionRequests.map((r) => {
              const author = realVtubers.find((v) => v.id === r.userId);
              const styles = Array.isArray(r.styles) ? r.styles.filter((style) => style !== REQUEST_STYLE_OTHER).slice(0, 3) : [];
              const applicants = Array.isArray(r.applicants) ? r.applicants : [];
              return (
                <article key={`home-commission-request-${r.id}`} className="flex-shrink-0 w-[85vw] md:w-auto snap-center bg-[#181B25] border border-[#2A2F3D] rounded-2xl p-5 text-left hover:bg-[#1D2130] transition-colors h-full flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={sanitizeUrl(author?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Anon")} alt={author?.name || "發案者"} className="w-11 h-11 rounded-xl object-cover bg-[#1D2130] border border-[#2A2F3D] flex-shrink-0" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      <div className="min-w-0">
                        <p className="text-[#F8FAFC] font-bold truncate">{author?.name || "匿名發案者"}</p>
                        <p className="text-[#94A3B8] text-xs">{formatTime(r.createdAt)}</p>
                      </div>
                    </div>
                    <span className="flex-shrink-0 bg-[#8B5CF6]/15 text-[#C4B5FD] border border-[#8B5CF6]/30 text-xs font-extrabold px-2.5 py-1 rounded-full">{r.requestType || "委託"}</span>
                  </div>
                  <h3 className="text-[#F8FAFC] text-lg font-extrabold mb-2 line-clamp-2">{r.title || "未命名委託需求"}</h3>
                  <p className="text-[#94A3B8] text-sm leading-relaxed line-clamp-3 mb-4 flex-1">{r.description || "發案者尚未填寫詳細需求。"}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="bg-[#38BDF8]/10 text-[#7DD3FC] border border-[#38BDF8]/25 rounded-full px-2.5 py-1 text-xs font-bold">{r.budgetRange || "預算可討論"}</span>
                    <span className="bg-[#11131C] text-[#CBD5E1] border border-[#2A2F3D] rounded-full px-2.5 py-1 text-xs font-bold">{r.deadline ? formatDateOnly(r.deadline) : "日期可討論"}</span>
                    {styles.map((style) => <span key={`${r.id}-${style}`} className="bg-[#8B5CF6]/10 text-[#C4B5FD] border border-[#8B5CF6]/25 rounded-full px-2.5 py-1 text-xs font-bold">{style}</span>)}
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#2A2F3D]">
                    <p className="text-xs text-[#94A3B8]">提案 <span className="text-[#38BDF8] font-bold">{applicants.length}/5</span></p>
                    <button onClick={goToCommissionRequests} className="text-sm font-extrabold text-[#A78BFA] hover:text-[#C4B5FD] transition-colors">前往查看 <i className="fa-solid fa-arrow-right ml-1"></i></button>
                  </div>
                </article>
              );
            })}
            <MobileMoreCard
              onClick={goToCommissionRequests}
              icon="fa-clipboard-list"
              text="查看全部委託"
              subText="前往委託佈告欄接案"
            />
          </div>
        ) : (
          <div className="text-center py-12 px-6 bg-[#181B25] rounded-2xl border border-[#2A2F3D]">
            <p className="text-[#F8FAFC] font-bold text-lg">目前還沒有公開委託需求</p>
            <p className="text-[#94A3B8] text-sm mt-2">有繪圖、建模或剪輯需求時，可以直接發布到委託佈告欄。</p>
            <button
              onClick={goToCommissionRequests}
              className="mt-5 inline-flex items-center justify-center bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 py-2.5 rounded-xl font-bold transition-colors"
            >
              前往委託佈告欄
            </button>
          </div>
        )}
      </div>

      {/* 6. 新手引導 */}
      <div className="mt-10 pt-10 border-t border-[#2A2F3D] w-full animate-fade-in-up">
        <SectionHeader
          icon="fa-compass"
          iconColor="text-[#F59E0B]"
          title="第一次來 V-Nexus？"
          desc="照著這四步走，更容易找到適合一起創作的夥伴。"
        />

        <div className="bg-[#181B25] border border-[#2A2F3D] rounded-2xl p-5 md:p-6 mb-5 text-left">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-[#94A3B8] text-xs font-bold tracking-widest uppercase mb-2">Profile onboarding</p>
              <h3 className="text-[#F8FAFC] text-xl font-extrabold mb-2">
                你的 V-Nexus 名片完成度 {onboardingState.percent}%
              </h3>
              <div className="h-2.5 bg-[#11131C] border border-[#2A2F3D] rounded-full overflow-hidden max-w-xl">
                <div
                  className="h-full bg-[#8B5CF6] transition-all duration-300"
                  style={{ width: `${onboardingState.percent}%` }}
                ></div>
              </div>
              <p className="text-[#94A3B8] text-sm mt-3 leading-relaxed">
                完成名片、聯動類型與可聯動時段後，其他創作者會更容易判斷是否適合邀請你。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <button
                onClick={() => navigate("dashboard")}
                className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors whitespace-nowrap ${onboardingState.hasAvatar ? "bg-[#22C55E]/10 text-[#86EFAC] border-[#22C55E]/25" : "bg-[#11131C] text-[#F8FAFC] border-[#2A2F3D] hover:bg-[#1D2130]"}`}
              >
                {onboardingState.hasAvatar ? "已補上頭像" : "補上頭像"}
              </button>
              <button
                onClick={() => navigate("dashboard")}
                className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors whitespace-nowrap ${onboardingState.hasSchedule ? "bg-[#22C55E]/10 text-[#86EFAC] border-[#22C55E]/25" : "bg-[#11131C] text-[#F8FAFC] border-[#2A2F3D] hover:bg-[#1D2130]"}`}
              >
                {onboardingState.hasSchedule ? "已填寫時段" : "填寫聯動時段"}
              </button>
              <button
                onClick={() => navigate("dashboard")}
                className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors whitespace-nowrap ${onboardingState.hasTags ? "bg-[#22C55E]/10 text-[#86EFAC] border-[#22C55E]/25" : "bg-[#11131C] text-[#F8FAFC] border-[#2A2F3D] hover:bg-[#1D2130]"}`}
              >
                {onboardingState.hasTags ? "已新增標籤" : "新增常玩遊戲"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GuideCard
            icon="fa-id-card"
            title="Step 1：管理名片"
            desc="先讓大家知道你是誰、常玩什麼、想找哪種聯動。"
            onClick={() => navigate("dashboard")}
            color="#8B5CF6"
          />
          <GuideCard
            icon="fa-gamepad"
            title="Step 2：選擇聯動類型"
            desc="選好想找的合作內容，讓適合的人更容易找到你。"
            onClick={() => navigate("dashboard")}
            color="#38BDF8"
          />
          <GuideCard
            icon="fa-calendar-days"
            title="Step 3：填寫可聯動時段"
            desc="清楚標示時間，可以減少來回詢問，也更容易成功約到。"
            onClick={() => navigate("dashboard")}
            color="#F59E0B"
          />
          <GuideCard
            icon="fa-magnifying-glass"
            title="Step 4：開始尋找VTuber"
            desc="看看近期活躍的人、招募企劃，從一個輕鬆的邀請開始。"
            onClick={() => navigate("grid")}
            color="#22C55E"
          />
        </div>
      </div>
      {/* 即將聯動：移到首頁最下方 */}
      <div className="mt-10 pt-10 border-t border-[#2A2F3D] w-full">
        <SectionHeader
          icon="fa-calendar-check"
          iconColor="text-[#38BDF8]"
          title="即將聯動"
          desc="看看有哪些 VTuber 即將展開合作，也可以從中認識新夥伴。"
          action={
            <button
              onClick={() => navigate("collabs")}
              className="hidden sm:flex bg-[#181B25] hover:bg-[#1D2130] text-[#F8FAFC] px-5 py-2.5 rounded-xl font-bold border border-[#2A2F3D] transition-colors items-center gap-2 whitespace-nowrap"
            >
              完整聯動表 <i className="fa-solid fa-arrow-right text-[#38BDF8]"></i>
            </button>
          }
        />

        {randomCollabs.length > 0 ? (
          <div className="flex overflow-x-auto pb-6 gap-4 snap-x snap-mandatory md:grid md:grid-cols-2 md:overflow-visible custom-scrollbar max-w-5xl mx-auto w-full">
            {randomCollabs.map((c) => (
              <div key={c.id} className="flex-shrink-0 w-[85vw] md:w-auto snap-center text-left h-full">
                <CollabCard
                  c={c}
                  isLive={
                    c.startTimestamp &&
                    currentTime >= c.startTimestamp &&
                    currentTime <= c.startTimestamp + 2 * 60 * 60 * 1000
                  }
                  vtuber={realVtubers.find((v) => v.id === c.userId)}
                  realVtubers={realVtubers}
                  onNavigateProfile={(vt) => {
                    setSelectedVTuber(vt);
                    navigate(`profile/${vt.id}`);
                  }}
                  onShowParticipants={onShowParticipants}
                />
              </div>
            ))}
            <MobileMoreCard
              onClick={() => navigate("collabs")}
              icon="fa-calendar-check"
              text="查看完整聯動表"
              subText="掌握所有即將到來的直播"
            />
          </div>
        ) : (
          <div className="text-center py-12 px-6 bg-[#181B25] rounded-2xl border border-[#2A2F3D] max-w-4xl mx-auto">
            <p className="text-[#F8FAFC] font-bold text-lg">還沒有即將公開的聯動行程</p>
            <p className="text-[#94A3B8] text-sm mt-2">安排好合作後，把待機室放上來，大家就能一起來支持。</p>
            <button
              onClick={() => navigate("collabs")}
              className="mt-5 inline-flex items-center justify-center bg-[#181B25] hover:bg-[#1D2130] text-[#F8FAFC] px-5 py-2.5 rounded-xl font-bold border border-[#2A2F3D] transition-colors"
            >
              查看聯動表
            </button>
          </div>
        )}
      </div>


    </section>
  );
};
const maskEmail = (email) => {
  if (!email || !email.includes("@")) return email;
  const [name, domain] = email.split("@");
  if (name.length <= 3) return name + "***@" + domain;
  return name.substring(0, 3) + "********@" + domain;
};

const AdminVtuberList = ({
  title,
  list,
  onEdit,
  onDelete,
  onVerify,
  onReject,
  isBlacklist,
  privateDocs,
  paginate = true,
  showSearch = true,
}) => {
  const [page, setPage] = useState(1);
  const [searchQ, setSearchQ] = useState("");
  const itemsPerPage = 10;

  // 1. 搜尋過濾邏輯 (支援名稱、勢力、UID 搜尋)
  const filteredList = list.filter(
    (v) =>
      (v.name || "").toLowerCase().includes(searchQ.toLowerCase()) ||
      (v.agency || "").toLowerCase().includes(searchQ.toLowerCase()) ||
      (v.id || "").toLowerCase().includes(searchQ.toLowerCase()),
  );

  // 2. 分頁計算
  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const displayList = paginate
    ? filteredList.slice((page - 1) * itemsPerPage, page * itemsPerPage)
    : filteredList;

  // 當搜尋字串改變時，自動跳回第一頁
  useEffect(() => {
    setPage(1);
  }, [searchQ]);

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-[#2A2F3D] pb-2 gap-3">
        <h3
          className={`text-xl font-bold ${isBlacklist ? "text-[#EF4444]" : title.includes("待") ? "text-[#F59E0B]" : "text-white"}`}
        >
          {title} ({filteredList.length})
        </h3>
        {showSearch && (
          <div className="relative w-full sm:w-64">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"></i>
            <input
              type="text"
              placeholder="搜尋名稱、勢力或UID..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="w-full bg-[#181B25] border border-[#2A2F3D] rounded-lg py-1.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>
        )}
      </div>

      {filteredList.length === 0 ? (
        <div className="text-[#94A3B8] text-sm py-6 px-4 text-center bg-[#0F111A]/50 rounded-xl border border-dashed border-[#2A2F3D]">
          <p className="text-[#F8FAFC] font-bold">這裡目前沒有需要處理的項目</p>
          <p className="text-[#64748B] mt-1">換個篩選條件，或稍後再回來看看。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayList.map((v) => (
            <div
              key={v.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border ${isBlacklist ? "bg-[#2A1418]/20 border-red-900/50" : title.includes("待") ? "bg-[#0F111A] border-[#F59E0B]/30" : "bg-[#0F111A] border-[#2A2F3D]"} gap-4`}
            >
              <div className="flex items-center gap-4">
                <img
                  src={sanitizeUrl(v.avatar)}
                  className={`w-12 h-12 rounded-lg object-cover flex-shrink-0 ${isBlacklist ? "opacity-50 grayscale" : ""}`}
                />
                <div className="min-w-0">
                  <p
                    className={`font-bold text-sm flex items-center gap-2 ${isBlacklist ? "text-[#94A3B8] line-through" : "text-white"}`}
                  >
                    {v.name || "（空白名片）"}
                    {v.isVerified && (
                      <i className="fa-solid fa-circle-check text-[#38BDF8] text-xs"></i>
                    )}
                  </p>
                  {!isBlacklist && (
                    <p className="text-[10px] text-[#94A3B8] mt-1">
                      {v.agency} |{" "}
                      {v.activityStatus === "sleep"
                        ? "暫時休息"
                        : v.activityStatus === "graduated"
                          ? "已畢業"
                          : v.activityStatus === "creator"
                            ? "繪師/建模師/剪輯師"
                            : "開放聯動"}{" "}
                      | 推薦:{" "}
                      <span className="text-[#22C55E]">{v.likes || 0}</span> |
                      倒讚:{" "}
                      <span className="text-[#EF4444]">{v.dislikes || 0}</span>
                    </p>
                  )}

                  {/* 顯示驗證備註 */}
                  {privateDocs[v.id]?.verificationNote && (
                    <p className="text-[10px] text-[#F59E0B] mt-1.5 bg-[#F59E0B]/10 p-1 rounded border border-[#F59E0B]/20 inline-block">
                      <i className="fa-solid fa-key mr-1"></i> 驗證:{" "}
                      {privateDocs[v.id].verificationNote}
                    </p>
                  )}

                  <div className="flex gap-3 mt-1.5">
                    {(v.youtubeUrl || v.channelUrl) && (
                      <a
                        href={sanitizeUrl(v.youtubeUrl || v.channelUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#EF4444] hover:underline"
                      >
                        <i className="fa-brands fa-youtube"></i> YT
                      </a>
                    )}
                    {v.twitchUrl && (
                      <a
                        href={sanitizeUrl(v.twitchUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#A78BFA] hover:underline"
                      >
                        <i className="fa-brands fa-twitch"></i> Twitch
                      </a>
                    )}
                    {v.xUrl && (
                      <a
                        href={sanitizeUrl(v.xUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#38BDF8] hover:underline"
                      >
                        <i className="fa-brands fa-x-twitter"></i> X
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0 self-end sm:self-center">
                {onVerify && (
                  <button
                    onClick={() => onVerify(v.id)}
                    className="text-[#22C55E] bg-[#22C55E]/10 hover:bg-[#22C55E] hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    審核
                  </button>
                )}
                {onReject && (
                  <button
                    onClick={() => onReject(v.id)}
                    className="text-[#F59E0B] bg-[#F59E0B]/10 hover:bg-[#F59E0B] hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    退回
                  </button>
                )}
                <button
                  onClick={() => onEdit(v)}
                  className="text-[#38BDF8] bg-[#38BDF8]/10 hover:bg-[#38BDF8] hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                >
                  編輯
                </button>
                <button
                  onClick={() => onDelete(v.id)}
                  className="text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444] hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                >
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分頁按鈕 UI */}
      {paginate && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${page === 1 ? "bg-[#181B25] text-gray-600 cursor-not-allowed" : "bg-[#1D2130] text-white hover:bg-[#2A2F3D]"}`}
          >
            上一頁
          </button>
          <span className="text-[#94A3B8] text-xs font-bold">
            第 {page} / {totalPages} 頁
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${page === totalPages ? "bg-[#181B25] text-gray-600 cursor-not-allowed" : "bg-[#1D2130] text-white hover:bg-[#2A2F3D]"}`}
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
};

// 在參數大括號的最後面加上 , onTestReminder
// 找到 AdminPage 的開頭，在大括號最後面補上 , onTestPush
const AdminPage = ({
  user,
  vtubers,
  bulletins,
  collabs,
  updates,
  rules,
  tips,
  privateDocs,
  onSaveSettings,
  onDeleteVtuber,
  onVerifyVtuber,
  onRejectVtuber,
  onUpdateVtuber,
  onDeleteBulletin,
  onAddCollab,
  onDeleteCollab,
  onAddUpdate,
  onDeleteUpdate,
  showToast,
  onResetAllCollabTypes,
  onResetNatAndLang,
  autoFetchYouTubeInfo,
  onMassSyncSubs,
  isSyncingSubs,
  syncProgress,
  setIsSyncingSubs,
  setSyncProgress,
  onSendMassEmail,
  onMassSyncTwitch,
  defaultBulletinImages,
  onAddDefaultBulletinImage,
  onDeleteDefaultBulletinImage,
  onTestReminder,
  onTestPush,
  onMassUpdateVerification,
  onMassMigrateImages,
  articles,
  onVerifyArticle,
  onDeleteArticle,
  onEditArticle,
  onMigrateBulletinImages,
  handleAdminCleanBulletins,
  functionsInstance,
  massEmailSending,     // 🌟 新增
  massEmailCurrent,     // 🌟 新增
  massEmailTotal,       // 🌟 新增
  massEmailLog,
}) => {
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
      if (!val) return 0;
      if (typeof val === "number") return val;
      if (val.toMillis) return val.toMillis();
      return 0;
    };
    return getTime(v.createdAt) || getTime(v.updatedAt) || 0;
  };

  const pendingVtubers = vtubers
    .filter(
      (v) =>
        !v.isVerified &&
        !v.isBlacklisted &&
        v.verificationStatus !== "rejected",
    )
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
    if (!confirm("確定要刪除全站所有 7 天前的對話紀錄嗎？")) return;
    setIsSyncingSubs(true);
    setSyncProgress("清理聊天紀錄中...");
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    try {
      const roomsSnap = await getDocs(
        collection(db, `artifacts/${APP_ID}/public/data/chat_rooms`),
      );
      for (const room of roomsSnap.docs) {
        const oldMsgs = await getDocs(
          query(
            collection(
              db,
              `artifacts/${APP_ID}/public/data/chat_rooms/${room.id}/messages`,
            ),
            where("createdAt", "<", oneWeekAgo),
          ),
        );
        for (const m of oldMsgs.docs) {
          await deleteDoc(m.ref);
        }
      }
      showToast("✅ 已徹底清理一週前的舊訊息");
    } catch (e) {
      console.error(e);
      showToast("清理失敗");
    }
    setIsSyncingSubs(false);
    setSyncProgress("");
  };

  const handleEditClick = (v) => {
    const safeCollabTypes = Array.isArray(v.collabTypes) ? v.collabTypes : [];
    const standard = safeCollabTypes.filter((t) =>
      PREDEFINED_COLLABS.includes(t),
    );
    const other =
      safeCollabTypes.find((t) => !PREDEFINED_COLLABS.includes(t)) || "";
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

    const isOtherN = safeNats.some(
      (n) => !PREDEFINED_NATIONALITIES.includes(n),
    );
    const otherNatText = isOtherN
      ? safeNats.find((n) => !PREDEFINED_NATIONALITIES.includes(n))
      : "";
    const stdNats = safeNats.filter((n) =>
      PREDEFINED_NATIONALITIES.includes(n),
    );

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
    if (dt.getTime() < Date.now()) return showToast("聯動時間不能在過去哦！");
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
    if (!testEmail || !testEmail.includes("@")) return showToast("請輸入有效的 Email");

    try {
      const sendSystemEmail = httpsCallable(
        functionsInstance,
        "sendSystemEmail",
      );

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
    } catch (err) {
      console.error("Test Mail Error:", err);
      showToast("❌ 寫入失敗，請按 F12 查看錯誤。");
    }
  };

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 py-8 relative animate-fade-in-up">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-[#EF4444] mb-2">
            <i className="fa-solid fa-shield-halved mr-3"></i>超級管理員中心
          </h2>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
          {[
            { id: "vtubers", icon: "fa-address-card", label: "名片與審核" },
            { id: "bulletins", icon: "fa-bullhorn", label: "招募管理" },
            { id: "collabs", icon: "fa-broadcast-tower", label: "時間表" },
            { id: "updates", icon: "fa-newspaper", label: "發布消息" },
            { id: 'articles', icon: 'fa-book-open', label: '寶典審核' },
            { id: "settings", icon: "fa-gear", label: "設定規範" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap flex items-center gap-2 ${activeTab === t.id ? "bg-[#EF4444] text-white shadow-sm" : "bg-[#181B25] text-[#94A3B8] hover:bg-[#1D2130]"}`}
            >
              <i className={`fa-solid ${t.icon}`}></i> {t.label}
              {t.id === "vtubers" && pendingVtubers.length > 0 && (
                <span className="bg-white text-red-600 px-2 py-0.5 rounded-full text-xs ml-1">
                  {pendingVtubers.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="bg-[#181B25]/40 border border-[#2A2F3D] rounded-2xl p-6 shadow-sm">
          {activeTab === "vtubers" && (
            <div className="space-y-8">
              {/* 1. 待審核名單 */}
              <AdminVtuberList
                title="待審核名單"
                list={pendingVtubers}
                privateDocs={privateDocs}
                onVerify={onVerifyVtuber}
                onReject={onRejectVtuber}
                onEdit={handleEditClick}
                onDelete={onDeleteVtuber}
                paginate={true}
                showSearch={true}
              />

              {/* 2. 已退回名單 */}
              {rejectedVtubers.length > 0 && (
                <div className="mb-8 border border-[#F59E0B]/20 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setIsRejectedExpanded(!isRejectedExpanded)}
                    className="w-full flex items-center justify-between p-4 bg-[#F59E0B]/5 hover:bg-[#F59E0B]/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-[#F59E0B]">
                        已退回名單 ({rejectedVtubers.length})
                      </h3>
                      <span className="text-[10px] bg-[#F59E0B]/20 text-orange-300 px-2 py-0.5 rounded">
                        點擊{isRejectedExpanded ? "收合" : "展開"}
                      </span>
                    </div>
                    <i
                      className={`fa-solid fa-chevron-${isRejectedExpanded ? "up" : "down"} text-[#F59E0B]`}
                    ></i>
                  </button>

                  {isRejectedExpanded && (
                    <div className="p-4 bg-[#0F111A]/30">
                      <AdminVtuberList
                        title="搜尋退回名單"
                        list={rejectedVtubers}
                        privateDocs={privateDocs}
                        onVerify={onVerifyVtuber} // 退回名單也可以直接審核通過
                        onEdit={handleEditClick}
                        onDelete={onDeleteVtuber}
                        paginate={true}
                        showSearch={true}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 3. 已上架名片 */}
              <AdminVtuberList
                title="已上架名片"
                list={verifiedVtubers}
                privateDocs={privateDocs}
                onEdit={handleEditClick}
                onDelete={onDeleteVtuber}
                paginate={true}
                showSearch={true}
              />

              {/* 黑單避雷區 */}
              <AdminVtuberList
                title="黑單避雷區"
                list={blacklistedVtubers}
                privateDocs={privateDocs}
                onEdit={handleEditClick}
                onDelete={onDeleteVtuber}
                isBlacklist
                paginate={true}
                showSearch={true}
              />
              <div className="mt-12 pt-6 border-t border-[#EF4444]/50 flex flex-wrap gap-4">
                <button
                  onClick={onResetAllCollabTypes}
                  className="bg-[#3B171D] hover:bg-[#B91C1C] text-white px-6 py-3 rounded-xl font-bold"
                >
                  <i className="fa-solid fa-bomb mr-2"></i>重置所有人聯動類型
                </button>
                <button
                  onClick={onMassUpdateVerification}
                  disabled={isSyncingSubs}
                  className={`px-6 py-3 rounded-xl font-bold flex items-center ${isSyncingSubs ? "bg-blue-900/50 cursor-not-allowed text-[#94A3B8]" : "bg-blue-900 hover:bg-[#0284C7] text-white"}`}
                >
                  <i className="fa-solid fa-user-shield mr-2"></i>
                  一鍵更改驗證內容為 'X'
                </button>
                <button
                  onClick={onResetNatAndLang}
                  className="bg-orange-900 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold"
                >
                  <i className="fa-solid fa-wrench mr-2"></i>修復國籍語言格式
                </button>
                <button
                  onClick={onMassSyncSubs}
                  disabled={isSyncingSubs}
                  className={`px-6 py-3 rounded-xl font-bold flex items-center ${isSyncingSubs ? "bg-[#3B171D]/50 cursor-not-allowed text-[#94A3B8]" : "bg-[#3B171D] hover:bg-[#B91C1C] text-white"}`}
                >
                  {isSyncingSubs ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin mr-2"></i>{" "}
                      {syncProgress}
                    </>
                  ) : (
                    <>
                      <i className="fa-brands fa-youtube mr-2"></i>強制同步 YT
                      訂閱
                    </>
                  )}
                </button>
                <button
                  onClick={onMassSyncTwitch}
                  disabled={isSyncingSubs}
                  className={`px-6 py-3 rounded-xl font-bold flex items-center ${isSyncingSubs ? "bg-purple-900/50 cursor-not-allowed text-[#94A3B8]" : "bg-purple-900 hover:bg-[#7C3AED] text-white"}`}
                >
                  {isSyncingSubs ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin mr-2"></i>{" "}
                      {syncProgress}
                    </>
                  ) : (
                    <>
                      <i className="fa-brands fa-twitch mr-2"></i>強制同步
                      Twitch
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
          {activeTab === "bulletins" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">招募文管理</h3>
                <button
                  onClick={handleAdminCleanBulletins}
                  disabled={isSyncingSubs}
                  className="bg-[#D97706] hover:bg-[#F59E0B] text-[#0F111A] px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2"
                >
                  {isSyncingSubs ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-broom"></i>}
                  結算並清理過期招募
                </button>
              </div>
              {(bulletins || []).map((b) => {
                // 👈 2. 補上發布者名稱與時間的計算，避免 undefined 報錯
                const author = vtubers.find(v => v.id === b.userId);
                const authorName = author ? author.name : "未知創作者";
                const postedAt = formatTime(b.createdAt);

                return (
                  <div
                    key={b.id}
                    className="flex justify-between bg-[#0F111A] p-4 rounded-xl border border-[#2A2F3D] gap-4"
                  >
                    <div className="flex-1">
                      <p className="text-sm text-[#CBD5E1] mb-1">{b.content}</p>
                      <p className="text-xs text-[#64748B]">
                        {authorName} | {postedAt}
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteBulletin(b.id)}
                      className="text-[#EF4444] bg-[#EF4444]/10 px-3 py-1.5 rounded-lg font-bold"
                    >
                      刪除
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {activeTab === "collabs" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">
                  新增聯動時間
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1 block">
                      聯動類別 <span className="text-[#EF4444]">*</span>
                    </label>
                    <select
                      required
                      value={newCollab.category}
                      onChange={(e) =>
                        setNewCollab({ ...newCollab, category: e.target.value })
                      }
                      className={inputCls}
                    >
                      {COLLAB_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1 block">
                      聯動時間 <span className="text-[#EF4444]">*</span>
                    </label>
                    {/* 🌟 替換為 DateTimePicker */}
                    <DateTimePicker
                      value={newCollab.dateTime}
                      onChange={(val) =>
                        setNewCollab({ ...newCollab, dateTime: val })
                      }
                      className={inputCls}
                    />
                  </div>
                  <div className="relative">
                    <label className="text-xs text-[#94A3B8] mb-1 block">
                      直播連結 <span className="text-[#EF4444]">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="直播連結..."
                        value={newCollab.streamUrl}
                        onChange={(e) =>
                          setNewCollab({
                            ...newCollab,
                            streamUrl: e.target.value,
                          })
                        }
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          autoFetchYouTubeInfo(
                            newCollab.streamUrl,
                            (t) => setNewCollab((p) => ({ ...p, title: t })),
                            (c) => setNewCollab((p) => ({ ...p, coverUrl: c })),
                            showToast,
                          )
                        }
                        className="bg-[#1D2130] hover:bg-[#2A2F3D] text-white px-4 rounded-xl text-xs font-bold transition-colors"
                      >
                        <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>
                        抓取
                      </button>
                    </div>
                    <p className="text-[10px] text-[#A78BFA]/80 mt-1">
                      （放入連結按下就可以自動抓取YT縮圖及標題）
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="聯動標題"
                    value={newCollab.title}
                    onChange={(e) =>
                      setNewCollab({ ...newCollab, title: e.target.value })
                    }
                    className={inputCls}
                  />
                  <input
                    type="url"
                    placeholder="自訂封面圖"
                    value={newCollab.coverUrl}
                    onChange={(e) =>
                      setNewCollab({ ...newCollab, coverUrl: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
                <button
                  onClick={handleAdminPublish}
                  className="bg-[#EF4444] text-white px-6 py-2 rounded-lg font-bold"
                >
                  發布
                </button>
              </div>
              <div className="border-t border-[#2A2F3D] pt-6 space-y-4">
                <h3 className="text-lg font-bold text-white mb-4">現有清單</h3>
                {(collabs || []).map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between bg-[#0F111A] p-4 rounded-xl border border-[#2A2F3D]"
                  >
                    <div>
                      <p className="font-bold text-white text-sm">
                        [{c.date} {c.time}] {c.title}
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteCollab(c.id)}
                      className="text-[#EF4444] bg-[#EF4444]/10 px-3 py-1.5 rounded-lg"
                    >
                      刪除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === "updates" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">
                  發布最新消息 / 功能更新
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onAddUpdate({
                      title: e.target.updateTitle.value,
                      content: e.target.updateContent.value,
                      date: new Date().toLocaleDateString("zh-TW"),
                    });
                    e.target.reset();
                  }}
                >
                  <div className="mb-4">
                    <label className="text-xs text-[#94A3B8] mb-1 block">
                      標題 <span className="text-[#EF4444]">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      name="updateTitle"
                      className={inputCls}
                      placeholder="例如：新增站內信功能！"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="text-xs text-[#94A3B8] mb-1 block">
                      內容 <span className="text-[#EF4444]">*</span>
                    </label>
                    <textarea
                      required
                      name="updateContent"
                      className={inputCls + " resize-none"}
                      rows="4"
                    ></textarea>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="bg-[#38BDF8] hover:bg-[#38BDF8] text-[#0F111A] px-6 py-2 rounded-lg font-bold shadow-sm"
                    >
                      發布公告
                    </button>
                  </div>
                </form>
              </div>
              <div className="border-t border-[#2A2F3D] pt-6 space-y-4">
                <h3 className="text-lg font-bold text-white mb-4">歷史公告</h3>
                {(updates || []).map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col sm:flex-row sm:justify-between bg-[#0F111A] p-4 rounded-xl border border-[#2A2F3D] gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">
                        {u.title}{" "}
                        <span className="text-xs text-[#64748B] font-normal ml-2">
                          {u.date}
                        </span>
                      </p>
                      <p className="text-xs text-[#94A3B8] mt-1 line-clamp-2">
                        {u.content}
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteUpdate(u.id)}
                      className="text-[#EF4444] bg-[#EF4444]/10 px-3 py-1.5 rounded-lg flex-shrink-0 font-bold self-start"
                    >
                      刪除
                    </button>
                  </div>
                ))}
              </div>

              {/* 🌟 系統通知信：發送給全站使用者 */}
              <div className="border-t border-[#2A2F3D] pt-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      <i className="fa-solid fa-paper-plane text-[#A78BFA] mr-2"></i>
                      發送全站系統通知信
                    </h3>
                    <p className="text-sm text-[#94A3B8] mt-1">
                      將由後端寄送給全站有 Email 的使用者；創作者優先使用名片信箱，未填寫則使用登入信箱。
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      setIsTestEmailSending(true);
                      try {
                        const fn = httpsCallable(functionsInstance, "sendMassEmail");
                        const authToken = auth.currentUser ? await auth.currentUser.getIdToken(true) : "";
                        const now = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
                        const res = await fn({
                          authToken,
                          subject: "系統測試信",
                          text: `這是一封來自 V-Nexus 後端的測試信！\n\n發送時間（台北時間）：${now}\n\n如果您收到這封信，代表系統通知信功能運作正常。\n\n— V-Nexus 系統`,
                          testOnly: true,  // 告訴後端只寄給管理員自己
                        });
                        if (res.data?.success) showToast("✅ 測試信已寄出！請至信箱確認");
                        else showToast(`❌ 失敗：${res.data?.message}`);
                      } catch (e) {
                        showToast(`❌ 呼叫失敗：${e.message}`);
                      } finally {
                        setIsTestEmailSending(false);
                      }
                    }}
                    // 🌟 修正：使用 isAdminEmailSending
                    disabled={isTestEmailSending || isAdminEmailSending}
                    className="flex items-center gap-1.5 bg-[#1D2130] hover:bg-[#2A2F3D] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors flex-shrink-0"
                  >
                    {isTestEmailSending
                      ? <><i className="fa-solid fa-circle-notch animate-spin text-[#C4B5FD]"></i><span>寄送中...</span></>
                      : <><i className="fa-solid fa-flask text-[#F59E0B]"></i><span>寄測試信給自己</span></>
                    }
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                      <i className="fa-solid fa-heading mr-1 text-[#A78BFA]"></i>主旨
                    </label>
                    <input
                      type="text"
                      value={adminEmailSubject}
                      onChange={e => setAdminEmailSubject(e.target.value)}
                      placeholder="例：重要系統公告"
                      maxLength={100}
                      // 🌟 修正：使用 isAdminEmailSending
                      disabled={isAdminEmailSending}
                      className={inputCls}
                    />
                    <p className="text-right text-xs text-gray-600 mt-1">{adminEmailSubject.length} / 100</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                      <i className="fa-solid fa-align-left mr-1 text-[#A78BFA]"></i>內容
                    </label>
                    <textarea
                      value={adminEmailBody}
                      onChange={e => setAdminEmailBody(e.target.value)}
                      placeholder="請輸入信件內文……"
                      rows={5}
                      // 🌟 修正：使用 isAdminEmailSending
                      disabled={isAdminEmailSending}
                      className={inputCls + " resize-none"}
                    />
                  </div>

                  {/* 🌟 狀態提示 (取代原本的數字進度條，因為現在是後端在跑) */}
                  {isAdminEmailSending && (
                    <div className="bg-[#181B25] border border-white/10 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[#C4B5FD] font-bold">
                          <i className="fa-solid fa-server mr-2"></i>
                          伺服器背景發送中...
                        </span>
                      </div>
                      <div className="w-full bg-[#1D2130] rounded-full h-2.5 overflow-hidden relative">
                        <div className="bg-[#8B5CF6] h-2.5 rounded-full absolute top-0 left-0 w-1/3 animate-ping" style={{ animationDuration: '1.5s' }} />
                        <div className="bg-purple-400 h-2.5 rounded-full absolute top-0 left-0 w-full" />
                      </div>
                      <p className="text-xs text-[#94A3B8]">信件正由後端逐一寄出，這可能需要幾分鐘的時間，請耐心等候。</p>
                    </div>
                  )}

                  <button
                    onClick={async () => {
                      if (!adminEmailSubject.trim()) return showToast("❌ 請填寫主旨");
                      if (!adminEmailBody.trim()) return showToast("❌ 請填寫內容");
                      if (!confirm("確定要發送給全站所有有 Email 的使用者嗎？此動作不可逆！")) return;

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
                        } else {
                          showToast(`❌ ${res.data?.message}`);
                        }
                      } catch (e) {
                        showToast(`❌ 呼叫失敗：${e.message}`);
                      } finally {
                        // 🌟 修正：使用 isAdminEmailSending
                        setIsAdminEmailSending(false);
                      }
                    }}
                    // 🌟 修正：使用 isAdminEmailSending
                    disabled={isAdminEmailSending || !adminEmailSubject.trim() || !adminEmailBody.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-[#8B5CF6] hover:bg-[#8B5CF6] disabled:bg-[#1D2130] disabled:text-[#64748B] disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
                  >
                    {isAdminEmailSending
                      ? <><i className="fa-solid fa-circle-notch animate-spin"></i><span>發送中，請勿關閉視窗...</span></>
                      : <><i className="fa-solid fa-paper-plane"></i><span>發送給全站使用者</span></>
                    }
                  </button>
                </div>
              </div>
            </div>

          )}



          {activeTab === 'articles' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white mb-4">寶典文章審核系統</h3>
              <div className="space-y-4">
                <h4 className="text-[#F59E0B] font-bold border-b border-[#2A2F3D] pb-2">待審核文章 ({(articles || []).filter(a => a.status === 'pending').length})</h4>
                {(articles || []).filter(a => a.status === 'pending').length === 0 ? <p className="text-[#64748B] bg-[#0F111A]/50 p-4 rounded-xl border border-dashed border-[#2A2F3D] text-center">無待審核文章</p> : (articles || []).filter(a => a.status === 'pending').map(a => (
                  <div key={a.id} className="bg-[#0F111A] border border-[#F59E0B]/30 p-5 rounded-xl flex flex-col sm:flex-row gap-4 justify-between hover:border-[#F59E0B]/60 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs bg-[#38BDF8]/20 text-[#38BDF8] px-2 py-0.5 rounded border border-[#38BDF8]/30">{a.category}</span>
                        <span className="font-bold text-white text-lg">{a.title}</span>
                      </div>
                      <p className="text-[#94A3B8] text-sm line-clamp-3 mt-2 bg-[#181B25] p-3 rounded-lg">{a.content}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 self-start sm:self-center">
                      <button onClick={() => onVerifyArticle(a.id)} className="bg-[#22C55E]/80 hover:bg-[#22C55E] text-[#0F111A] px-4 py-2 rounded-lg font-bold text-sm transition-transform"><i className="fa-solid fa-check mr-1"></i>核准張貼</button>
                      <button onClick={() => { setEditingArticleId(a.id); setArticleEditForm({ title: a.title, category: a.category, content: a.content, coverUrl: a.coverUrl || '' }); }} className="bg-[#38BDF8]/80 hover:bg-[#38BDF8] text-[#0F111A] px-4 py-2 rounded-lg font-bold text-sm transition-transform"><i className="fa-solid fa-pen mr-1"></i>編輯</button>
                      <button onClick={() => onDeleteArticle(a.id)} className="bg-[#EF4444]/80 hover:bg-[#EF4444] text-white px-4 py-2 rounded-lg font-bold text-sm transition-transform"><i className="fa-solid fa-xmark mr-1"></i>拒絕/刪除</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-4 mt-8 pt-8 border-t border-[#2A2F3D]">
                <h4 className="text-[#22C55E] font-bold border-b border-[#2A2F3D] pb-2">已發布文章 ({(articles || []).filter(a => a.status === 'published').length})</h4>
                {(articles || []).filter(a => a.status === 'published').map(a => (
                  <div key={a.id} className="bg-[#181B25] border border-[#2A2F3D] p-4 rounded-xl flex justify-between items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-white truncate block">{a.title} <span className="text-xs text-[#38BDF8] font-normal ml-2 bg-[#38BDF8]/10 px-2 py-0.5 rounded">({a.category})</span></span>
                    </div>
                    <button onClick={() => { setEditingArticleId(a.id); setArticleEditForm({ title: a.title, category: a.category, content: a.content, coverUrl: a.coverUrl || '' }); }} className="text-[#38BDF8] bg-[#38BDF8]/10 hover:bg-[#38BDF8] hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex-shrink-0">編輯</button>
                    <button onClick={() => onDeleteArticle(a.id)} className="text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444] hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex-shrink-0">強制刪除</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {editingArticleId && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-sm overflow-hidden">
                <div className="bg-[#181B25] px-6 py-4 border-b border-[#2A2F3D] flex justify-between items-center">
                  <h3 className="font-bold text-white"><i className="fa-solid fa-pen text-[#38BDF8] mr-2"></i>編輯文章</h3>
                  <button onClick={() => setEditingArticleId(null)} className="text-[#94A3B8] hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-[#CBD5E1] mb-1">標題</label>
                    <input type="text" value={articleEditForm.title} onChange={e => setArticleEditForm({ ...articleEditForm, title: e.target.value })} className="w-full bg-[#181B25] border border-[#2A2F3D] rounded-lg p-2 text-white outline-none focus:border-[#38BDF8]" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-[#CBD5E1] mb-1">分類</label>
                      <select value={articleEditForm.category} onChange={e => setArticleEditForm({ ...articleEditForm, category: e.target.value })} className="w-full bg-[#181B25] border border-[#2A2F3D] rounded-lg p-2 text-white outline-none focus:border-[#38BDF8]">
                        {ARTICLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#CBD5E1] mb-1">封面網址 (不改請留空)</label>
                      <input type="text" value={articleEditForm.coverUrl} onChange={e => setArticleEditForm({ ...articleEditForm, coverUrl: e.target.value })} className="w-full bg-[#181B25] border border-[#2A2F3D] rounded-lg p-2 text-white outline-none focus:border-[#38BDF8]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#CBD5E1] mb-1">內文</label>
                    <textarea rows="10" value={articleEditForm.content} onChange={e => setArticleEditForm({ ...articleEditForm, content: e.target.value })} className="w-full bg-[#181B25] border border-[#2A2F3D] rounded-lg p-2 text-white outline-none focus:border-[#38BDF8] font-mono text-sm" />
                  </div>
                </div>
                <div className="bg-[#181B25] px-6 py-4 border-t border-[#2A2F3D] flex justify-end gap-3">
                  <button onClick={() => setEditingArticleId(null)} className="px-4 py-2 text-[#94A3B8] hover:text-white font-bold transition-colors">取消</button>
                  <button onClick={() => { onEditArticle(editingArticleId, articleEditForm); setEditingArticleId(null); }} className="bg-[#38BDF8] hover:bg-[#38BDF8] text-[#0F111A] px-6 py-2 rounded-lg font-bold shadow transition-transform">儲存修改</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">編輯規範</h3>
                <textarea
                  value={editRules}
                  onChange={(e) => setEditRules(e.target.value)}
                  className={inputCls + " resize-none"}
                  rows="8"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => onSaveSettings(undefined, editRules)}
                  className="bg-[#EF4444] text-white px-8 py-2.5 rounded-xl font-bold"
                >
                  儲存規範
                </button>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">
                  編輯小技巧
                </h3>
                <textarea
                  value={editTips}
                  onChange={(e) => setEditTips(e.target.value)}
                  className={inputCls + " resize-none"}
                  rows="8"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => onSaveSettings(editTips, undefined)}
                  className="bg-[#EF4444] text-white px-8 py-2.5 rounded-xl font-bold"
                >
                  儲存小技巧
                </button>
              </div>

              <div className="mt-8 border-t border-[#2A2F3D] pt-8">
                <h3 className="text-xl font-bold text-white mb-2">
                  <i className="fa-solid fa-images text-[#A78BFA] mr-2"></i>
                  招募佈告欄預設圖片庫
                </h3>
                <p className="text-sm text-[#94A3B8] mb-4">
                  當使用者發一個招募企劃沒有上傳圖片時，將從這裡隨機挑選一張顯示。
                </p>
                <div className="flex flex-wrap gap-4 mb-4">
                  {(defaultBulletinImages || []).map((img, idx) => (
                    <div key={idx} className="relative group w-32 h-24">
                      <img
                        src={sanitizeUrl(img)}
                        className="w-full h-full object-cover rounded-xl border border-[#2A2F3D]"
                      />
                      <button
                        onClick={() => onDeleteDefaultBulletinImage(idx)}
                        className="absolute top-1 right-1 bg-[#EF4444]/90 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <i className="fa-solid fa-trash text-xs"></i>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="relative w-full sm:w-64">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
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
                          let w = img.width,
                            h = img.height;
                          const maxW = 800,
                            maxH = 800;
                          if (w > maxW || h > maxH) {
                            const r = Math.min(maxW / w, maxH / h);
                            w *= r;
                            h *= r;
                          }
                          canvas.width = w;
                          canvas.height = h;
                          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
                          onAddDefaultBulletinImage(
                            canvas.toDataURL("image/jpeg", 0.8),
                          );
                          e.target.value = "";
                        };
                        img.src = event.target.result;
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <button className="w-full bg-[#181B25] hover:bg-[#1D2130] text-white py-2 rounded-xl border border-[#2A2F3D] transition-colors flex items-center justify-center gap-2">
                    <i className="fa-solid fa-plus"></i> 新增預設圖片
                  </button>
                </div>
              </div>

              <div className="mt-8 border-t border-[#2A2F3D] pt-8">
                <h3 className="text-xl font-bold text-white mb-2">
                  <i className="fa-solid fa-envelope-circle-check text-[#38BDF8] mr-2"></i>
                  Email 系統測試
                </h3>
                <p className="text-sm text-[#94A3B8] mb-4">
                  如果 Firebase 後台沒有看到 mail
                  路徑，請點擊下方按鈕寫入一筆測試資料，路徑就會自動出現。
                </p>
                <button
                  onClick={handleTestMail}
                  className="bg-[#38BDF8] hover:bg-[#38BDF8] text-[#0F111A] px-6 py-2.5 rounded-xl font-bold shadow-sm"
                >
                  寫入一筆測試信件
                </button>
              </div>
              <div className="mt-8 border-t border-[#2A2F3D] pt-8">
                <h3 className="text-xl font-bold text-white mb-2">
                  <i className="fa-brands fa-youtube text-[#EF4444] mr-2"></i>
                  YouTube API 測試
                </h3>
                <p className="text-sm text-[#94A3B8] mb-4">
                  輸入任意 YouTube 頻道網址，測試後端抓取功能是否正常運作。
                </p>
                <div className="flex gap-2">
                  <input
                    id="testYoutubeUrl"
                    type="url"
                    placeholder="https://www.youtube.com/..."
                    className={inputCls + " flex-1"}
                  />
                  <button
                    onClick={async () => {
                      const url =
                        document.getElementById("testYoutubeUrl").value;
                      if (!url) return showToast("請輸入網址");
                      showToast("⏳ 抓取中...");
                      try {
                        const res = await httpsCallable(
                          functionsInstance,
                          "fetchYouTubeStats",
                        )({ url });
                        if (res.data && res.data.success) {
                          showToast(
                            `✅ 抓取成功！訂閱數：${res.data.subscriberCount}`,
                          );
                        } else {
                          showToast(
                            `❌ 失敗：${res.data?.message || "未知錯誤"}`,
                          );
                        }
                      } catch (e) {
                        showToast(`❌ 錯誤：${e.message}`);
                      }
                    }}
                    className="bg-[#EF4444] hover:bg-[#EF4444] text-white px-6 py-2.5 rounded-xl font-bold shadow-sm whitespace-nowrap"
                  >
                    測試抓取
                  </button>
                </div>
              </div>
              <div className="mt-8 border-t border-[#2A2F3D] pt-8">
                <h3 className="text-xl font-bold text-white mb-2">
                  <i className="fa-brands fa-twitch text-[#A78BFA] mr-2"></i>
                  Twitch API 測試
                </h3>
                <p className="text-sm text-[#94A3B8] mb-4">
                  輸入任意 Twitch 頻道網址，測試後端抓取功能是否正常運作。
                </p>
                <div className="flex gap-2">
                  <input
                    id="testTwitchUrl"
                    type="url"
                    placeholder="https://www.twitch.tv/..."
                    className={inputCls + " flex-1"}
                  />
                  <button
                    onClick={async () => {
                      const url =
                        document.getElementById("testTwitchUrl").value;
                      if (!url) return showToast("請輸入網址");
                      showToast("⏳ 抓取中...");
                      try {
                        const res = await httpsCallable(
                          functionsInstance,
                          "fetchTwitchStats",
                        )({ url });
                        if (res.data && res.data.success) {
                          showToast(
                            `✅ 抓取成功！追隨數：${res.data.followerCount}`,
                          );
                        } else {
                          showToast(
                            `❌ 失敗：${res.data?.message || "未知錯誤"}`,
                          );
                        }
                      } catch (e) {
                        showToast(`❌ 錯誤：${e.message}`);
                      }
                    }}
                    className="bg-[#8B5CF6] hover:bg-[#8B5CF6] text-white px-6 py-2.5 rounded-xl font-bold shadow-sm whitespace-nowrap"
                  >
                    測試抓取
                  </button>
                </div>
              </div>
              <div className="mt-8 border-t border-[#2A2F3D] pt-8">
                <h3 className="text-xl font-bold text-white mb-2">
                  <i className="fa-solid fa-mobile-screen-button text-[#38BDF8] mr-2"></i>
                  手機推播功能測試
                </h3>
                <p className="text-sm text-[#94A3B8] mb-4">
                  此功能僅限在手機「加入主畫面」後使用。點擊按鈕將發送一則推播通知給您自己。
                </p>
                <button
                  onClick={onTestPush}
                  className="bg-[#38BDF8] hover:bg-[#38BDF8] text-[#0F111A] px-6 py-2.5 rounded-xl font-bold shadow-sm transition-transform"
                >
                  立即測試手機推播
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("確定要徹底刪除全站 7 天前的舊訊息嗎？"))
                      return;
                    showToast("⏳ 正在清理中...");
                    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                    const roomsSnap = await getDocs(
                      collection(
                        db,
                        `artifacts/${APP_ID}/public/data/chat_rooms`,
                      ),
                    );

                    for (const room of roomsSnap.docs) {
                      const oldMsgs = await getDocs(
                        query(
                          collection(db, `${room.ref.path}/messages`),
                          where("createdAt", "<", oneWeekAgo),
                        ),
                      );
                      oldMsgs.forEach((m) => deleteDoc(m.ref));
                    }
                    showToast("✅ 清理完畢");
                  }}
                  className="bg-[#3B171D] text-white px-4 py-2 rounded-lg ml-4"
                >
                  清理過期訊息
                </button>
              </div>

              <div className="mt-8 border-t border-[#2A2F3D] pt-8">
                <h3 className="text-xl font-bold text-white mb-2">
                  <i className="fa-solid fa-clock-rotate-left text-[#F59E0B] mr-2"></i>
                  聯動提醒系統測試
                </h3>
                <p className="text-sm text-[#94A3B8] mb-4">
                  點擊下方按鈕將建立一筆「1小時後開始」的虛擬聯動行程。建立後，系統會自動偵測並立即發送提醒信件至您的信箱，以確認提醒功能正常運作。
                </p>
                <button
                  onClick={onTestReminder}
                  className="bg-[#F59E0B] hover:bg-[#F59E0B] text-[#0F111A] px-6 py-2.5 rounded-xl font-bold shadow-sm transition-transform"
                >
                  立即測試 24h 提醒寄送
                </button>
                <button
                  onClick={onMassMigrateImages}
                  disabled={isSyncingSubs}
                  className={`px-6 py-3 rounded-xl font-bold flex items-center mt-4 ${isSyncingSubs ? "bg-emerald-900/50 cursor-not-allowed text-[#94A3B8]" : "bg-emerald-700 hover:bg-emerald-600 text-white"}`}
                >
                  {isSyncingSubs ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin mr-2"></i>{" "}
                      {syncProgress}
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-images mr-2"></i>一鍵遷移 Base64
                      圖片至 Storage
                    </>
                  )}
                </button>

                <button
                  onClick={onMigrateBulletinImages}
                  disabled={isSyncingSubs}
                  className={`px-6 py-3 rounded-xl font-bold flex items-center mt-4 ${isSyncingSubs ? "bg-teal-900/50 cursor-not-allowed text-[#94A3B8]" : "bg-teal-700 hover:bg-teal-600 text-white"}`}
                >
                  {isSyncingSubs ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin mr-2"></i>{" "}
                      {syncProgress}
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-bullhorn mr-2"></i>遷移佈告欄 Base64 圖片
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {editingVtuber && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90">
          <div className="bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-sm">
            <div className="sticky top-0 bg-[#0F111A]/95 backdrop-blur px-6 py-4 border-b border-[#2A2F3D] flex justify-between items-center z-10">
              <h3 className="font-bold text-white">
                <i className="fa-solid fa-pen-to-square mr-2"></i>強制編輯：
                {editingVtuber.name}
              </h3>
              <button
                onClick={() => setEditingVtuber(null)}
                className="text-[#94A3B8] hover:text-white"
              >
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <ProfileEditorForm
                form={editingVtuber}
                updateForm={(updates) =>
                  setEditingVtuber((prev) => ({ ...prev, ...updates }))
                }
                onSubmit={(e) => {
                  e.preventDefault();
                  onUpdateVtuber(editingVtuber.id, editingVtuber);
                  setEditingVtuber(null);
                }}
                onCancel={() => setEditingVtuber(null)}
                isAdmin={true}
                showToast={showToast}
                user={user}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const stableRandomCache = {};
const getStableRandom = (id) => {
  if (!id) return 0;
  if (!stableRandomCache[id]) {
    stableRandomCache[id] = Math.random();
  }
  return stableRandomCache[id];
};

// 直接接收 allChatRooms，不建立新的連線
const ChatListContent = ({
  currentUser,
  vtubers,
  onOpenChat,
  onDeleteChat,
  allChatRooms,
}) => {
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
            } else {
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

  const rooms = [...allChatRooms].sort(
    (a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0),
  );

  if (rooms.length === 0)
    return (
      <div className="p-6 text-center text-[#94A3B8] text-sm">
        <p className="text-[#F8FAFC] font-bold mb-1">這裡還沒有訊息</p>
        <p>打聲招呼，或先看看對方的名片再開始聊吧。</p>
      </div>
    );

  return (
    <div className="max-h-80 overflow-y-auto bg-[#0F111A] custom-scrollbar">
      {rooms.map((room) => {

        // 🌟 核心修復 2：同樣從 roomId 切割出雙方的 UID
        const uids = room.id.split('_');
        const targetId = uids.find((id) => id !== currentUser.uid);


        if (!targetId) return null;

        let target = vtubers.find((v) => v.id === targetId) || missingUsers[targetId];

        if (!target) return (
          <div key={room.id} className="p-3 text-center text-gray-600 text-xs">
            載入對話資訊中...
          </div>
        );

        const isUnread = room.unreadBy && room.unreadBy.includes(currentUser.uid);
        const isOnline = onlineUsers.has(target.id);

        return (
          <div
            key={room.id}
            onClick={() => onOpenChat(target)}
            // 🌟 優化 1：加上 active:bg-[#181B25]，讓手機點擊時有按下去的視覺回饋
            className="flex items-center gap-3 p-3 border-b border-[#2A2F3D] hover:bg-[#181B25] active:bg-[#181B25] cursor-pointer transition-colors group relative"
          >
            <div className="relative flex-shrink-0">
              <img
                src={sanitizeUrl(target.avatar)}
                className="w-10 h-10 rounded-full object-cover bg-[#0F111A] border border-[#2A2F3D] md:group-hover:border-[#8B5CF6] transition-colors"
              />
              {/* 🌟 綠點疊加在頭像右下角 */}
              {onlineUsers?.has(target.id) && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#22C55E] border border-gray-900 rounded-full"></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1">
                <span
                  className={`text-sm truncate ${isUnread ? "font-black text-white" : "font-bold text-[#CBD5E1]"}`}
                >
                  {target.name}
                </span>
                <span className="text-[10px] text-[#64748B]">
                  {formatTime(room.lastTimestamp)}
                </span>
              </div>
              <p
                className={`text-xs truncate ${isUnread ? "text-[#A78BFA] font-bold" : "text-[#94A3B8]"}`}
              >
                {room.lastMessage}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isUnread && (
                <div className="w-2 h-2 bg-[#EF4444] rounded-full shadow-sm"></div>
              )}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // 🌟 修正：子元件接收的屬性名稱是 onDeleteChat，不是 handleDeleteChat！
                  onDeleteChat(e, room.id);
                }}
                className="relative z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 p-3 -mr-2 text-[#64748B] hover:text-[#EF4444] transition-all"
                title="移除此對話"
              >
                <i className="fa-solid fa-trash-can text-sm"></i>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

function App() {
  const getInitialView = () => {
    const hash = window.location.hash.replace("#", "");
    if (hash.startsWith("profile/")) return "profile";
    return hash === "profile" ? "grid" : hash || "home";
  };

  const [currentView, setCurrentView] = useState(getInitialView());
  const [previousView, setPreviousView] = useState("grid");
  const [selectedVTuber, setSelectedVTuber] = useState(null);
  const [user, setUser] = useState(null);
  const [realVtubers, setRealVtubers] = useState(() => {
    const cached = localStorage.getItem(VTUBER_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  });
  const isAdmin = user && user.email === "apex.dasa@gmail.com";
  const myProfile = user ? realVtubers.find((v) => v.id === user.uid) : null;
  const isVerifiedUser = isAdmin || (myProfile?.isVerified && !myProfile?.isBlacklisted && myProfile?.activityStatus === "active");



  // 🌟 新增：限時動態 (Stories) 狀態
  const [realStories, setRealStories] = useState([]);
  const [storyInput, setStoryInput] = useState("");
  const [isStoryComposerOpen, setIsStoryComposerOpen] = useState(false);
  const [statusWallFilter, setStatusWallFilter] = useState("all");
  const [viewedStoryMap, setViewedStoryMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("vnexus_viewed_status_stories") || "{}");
    } catch (error) {
      return {};
    }
  });

  const markStatusStoryViewed = (vtuber) => {
    if (!vtuber?.id || !vtuber?.statusMessageUpdatedAt) return;
    const key = `${vtuber.id}_${Number(vtuber.statusMessageUpdatedAt || 0)}`;
    setViewedStoryMap((prev) => {
      if (prev?.[key]) return prev;
      const next = { ...(prev || {}), [key]: Date.now() };
      try {
        const entries = Object.entries(next)
          .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
          .slice(0, 300);
        const compact = Object.fromEntries(entries);
        localStorage.setItem("vnexus_viewed_status_stories", JSON.stringify(compact));
        return compact;
      } catch (error) {
        return next;
      }
    });
  };

  const isStatusStoryViewed = (vtuber) => {
    if (!vtuber?.id || !vtuber?.statusMessageUpdatedAt) return false;
    return Boolean(viewedStoryMap?.[`${vtuber.id}_${Number(vtuber.statusMessageUpdatedAt || 0)}`]);
  };

  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const [adminEmailSubject, setAdminEmailSubject] = useState("");
  const [adminEmailBody, setAdminEmailBody] = useState("");
  const [isAdminEmailSending, setIsAdminEmailSending] = useState(false);
  const [isTestEmailSending, setIsTestEmailSending] = useState(false);

  // 🌟 1. 輕量級線上狀態偵測 (心跳機制 Ping)
  useEffect(() => {
    if (!user || !isVerifiedUser) return;

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
        } catch (e) {
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
    if (!user) return;

    const fetchOnlineUsers = async () => {
      try {
        const tenMinsAgo = Date.now() - 10 * 60 * 1000;
        const q = query(
          collection(db, getPath("vtubers")),
          where("lastOnlineAt", ">", tenMinsAgo),
          limit(100)
        );
        const snap = await getDocs(q);
        setOnlineUsers(new Set(snap.docs.map(d => d.id)));
      } catch (e) {
        console.error("抓取線上名單失敗", e);
      }
    };

    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // 🌟 新增：發布限時動態 (同步更新 IG 圈圈、首頁網格與名片狀態)
  const handlePostStory = async (e, overrideContent = null, isLive = false) => {
    if (e) e.preventDefault();
    const content = overrideContent !== null ? overrideContent : storyInput.trim();

    if (overrideContent === null && !content) return;
    if (!user || !isVerifiedUser) return;

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
        const newList = prev.map(v =>
          v.id === user.uid
            ? { ...v, statusMessage: content, statusMessageUpdatedAt: content ? now : 0, statusMessageExpiresAt: statusExpiresAt, statusReactions: { plus_one: [], watching: [], fire: [] }, updatedAt: now }
            : v
        );
        syncVtuberCache(newList);
        return newList;
      });

      setProfileForm(prev => ({ ...prev, statusMessage: content, statusMessageUpdatedAt: content ? now : 0, statusMessageExpiresAt: statusExpiresAt }));
      if (overrideContent === null) setStoryInput("");

      if (!content) {
        showToast("🧹 動態已清除！");
      } else {
        showToast(isLive ? "🔴 已火速發布直播通知！(3小時後自動隱藏)" : "✅ 動態已發布！首頁與名片已同步更新");
      }
    } catch (e) {
      console.error(e);
      showToast("❌ 操作失敗，請稍後再試");
    }
  };

  // 🌟 新增 GA4 監控 1：追蹤使用者切換到了哪個頁面 (page_view)
  useEffect(() => {
    if (analytics) {
      logEvent(analytics, 'page_view', {
        page_title: currentView,
        page_location: window.location.href,
        page_path: `/${currentView}`
      });
    }
  }, [currentView]);

  // 🌟 新增 GA4 監控 2：追蹤使用者具體查看了「誰」的名片 (view_item)
  useEffect(() => {
    if (analytics && currentView === 'profile' && selectedVTuber) {
      logEvent(analytics, 'view_item', {
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
  const [isLoadingActivities, setIsLoadingActivities] = useState(() => {
    return !localStorage.getItem(BULLETINS_CACHE_KEY);
  });
  const [isLoading, setIsLoading] = useState(() => {
    return !localStorage.getItem(VTUBER_CACHE_KEY);
  });
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [siteStats, setSiteStats] = useState({ pageViews: null });
  const [viewParticipantsCollab, setViewParticipantsCollab] = useState(null);
  const [privateDocs, setPrivateDocs] = useState({});
  const [realBulletins, setRealBulletins] = useState([]);
  const [realUpdates, setRealUpdates] = useState([]);
  const [realCollabs, setRealCollabs] = useState([]);
  const [realArticles, setRealArticles] = useState(() => {
    try {
      const cached = localStorage.getItem(ARTICLES_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
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
    const q = query(
      collection(db, getPath("chat_rooms")),
      where("participants", "array-contains", user.uid),
    );
    const unsub = onSnapshot(q, (snap) => {
      setAllChatRooms(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user]);

  const prevRoomsRef = useRef([]);

  useEffect(() => {
    if (!user || allChatRooms.length === 0) return;

    allChatRooms.forEach((room) => {
      const prevRoom = prevRoomsRef.current.find(r => r.id === room.id);

      if (
        room.unreadBy && room.unreadBy.includes(user.uid) &&
        (!prevRoom || room.lastTimestamp > prevRoom.lastTimestamp)
      ) {
        // 🌟 核心修復 3：這裡也改成從 roomId 切割，確保對方刪除對話後，再傳訊息來依然能彈出視窗！
        const uids = room.id.split('_');
        const senderId = uids.find(id => id !== user.uid);

        if (senderId) {
          const triggerPopup = async () => {
            let sender = vtubersRef.current.find(v => v.id === senderId);
            if (!sender) {
              try {
                const sSnap = await getDoc(doc(db, getPath("vtubers"), senderId));
                if (sSnap.exists()) sender = { id: sSnap.id, ...sSnap.data() };
              } catch (e) { }
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
    return allChatRooms.some(
      (room) => room.unreadBy && room.unreadBy.includes(user?.uid),
    );
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
  const handleOpenChat = async (targetVtuber) => {
    setChatTarget(targetVtuber);
    setIsChatListOpen(false);

    if (user) {
      const roomId = generateRoomId(user.uid, targetVtuber.id);
      const roomRef = doc(
        db,
        `artifacts/${APP_ID}/public/data/chat_rooms`,
        roomId,
      );

      // 從未讀名單中移除自己
      try {
        await updateDoc(roomRef, {
          unreadBy: arrayRemove(user.uid),
        });
      } catch (e) {
        console.error("Clear unread error:", e);
      }
    }
  };
  const handleDeleteChat = async (e, roomId) => {
    e.stopPropagation(); // 防止觸發開啟聊天室
    if (
      !confirm(
        "確定要從列表中移除此對話嗎？\n(移除後若對方再傳訊息或您主動發訊，對話將重新出現)",
      )
    )
      return;

    try {
      const roomRef = doc(
        db,
        `artifacts/${APP_ID}/public/data/chat_rooms`,
        roomId,
      );
      // 將自己從參與者名單移除，這樣監聽器就不會抓到這間房間
      await updateDoc(roomRef, {
        participants: arrayRemove(user.uid),
      });
      showToast("✅ 已移除對話");
    } catch (err) {
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
    if (!user) return showToast("請先登入");
    if (!("Notification" in window)) return showToast("此瀏覽器不支援通知");
    if (!("serviceWorker" in navigator)) return showToast("此瀏覽器不支援 Service Worker");

    try {
      showToast("⏳ 正在啟動推播系統...");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return alert("❌ 您拒絕了通知權限。請到瀏覽器設定中開啟。");
      }

      const registration = await navigator.serviceWorker.ready;
      const messaging = getMessaging(app);
      const currentToken = await getToken(messaging, {
        serviceWorkerRegistration: registration,
        vapidKey:
          "BOsq0-39IZhc2I1Y5wiJ2mGrQIUT8zl59MlhMVh_4_41CUvJaYJlw3a1XV-6XM00fvteHsYsF3ukYKbn36SPuIw",
      });

      if (currentToken) {
        // FCM token 屬於裝置私密資料，不再寫入公開 vtubers 文件。
        await setDoc(doc(db, getPath("vtubers_private"), user.uid), {
          fcmToken: currentToken,
          notificationsEnabled: true,
          fcmTokenUpdatedAt: Date.now(),
        }, { merge: true });

        showToast("✅ 手機推播已成功啟動！");
        alert("🎉 恭喜！您的設備已成功綁定推播功能。");
      } else {
        alert("❌ 無法取得 Token，請確認您的瀏覽器支援推播。");
      }
    } catch (err) {
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
      return JSON.parse(localStorage.getItem("readUpdates") || "[]");
    } catch {
      return [];
    }
  });
  const hasUnreadUpdates = realUpdates.some(
    (u) => !readUpdateIds.includes(u.id),
  );

  const handleMarkAllUpdatesRead = () => {
    const allIds = realUpdates.map((u) => u.id);
    setReadUpdateIds(allIds);
    localStorage.setItem("readUpdates", JSON.stringify(allIds));
    showToast("✅ 已全部標示為已讀");
  };

  const [realTips, setRealTips] = useState(
    "您好，我是 [您的名字/頻道名]。\n想請問近期是否有機會邀請您一起進行 [企劃名稱/遊戲] 的連動呢？",
  );
  const [realRules, setRealRules] = useState(
    "如果聯動的V朋朋有負面行為，請在他的名片按倒讚。只要超過 10 個倒讚即會自動下架。",
  );
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
    banner:
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=1000",
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
    if (!user) return;

    // 使用 LocalStorage 紀錄該使用者的觀看時間戳記
    const storageKey = `vnexus_views_${user.uid}`;
    let viewHistory = {};
    try {
      viewHistory = JSON.parse(localStorage.getItem(storageKey)) || {};
    } catch (e) { }

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
    } catch (e) { console.error("更新閱讀數失敗", e); }
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
    } catch (e) {
      showToast("❌ 修改失敗");
      console.error(e);
    }
  };


  const handlePublishArticle = async (form) => {
    if (!user) return;
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
    } catch (e) {
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
    } catch (e) { showToast("❌ 審核失敗"); }
  };

  const handleDeleteArticle = async (id) => {
    if (!confirm("確定要刪除這篇文章嗎？")) return;
    try {
      await deleteDoc(doc(db, getPath('articles'), id));
      setRealArticles(prev => {
        const list = prev.filter(a => a.id !== id);
        localStorage.setItem(ARTICLES_CACHE_KEY, JSON.stringify(list));
        return list;
      });
      showToast("✅ 文章已刪除");
    } catch (e) { showToast("❌ 刪除失敗"); }
  };
  const handleTestPushNotification = async () => {
    if (!user) return showToast("請先登入！");
    showToast("⏳ 正在發送測試推播...");
    try {
      // 1. 先嘗試本地顯示 (確保 Service Worker 運作中)
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
    } catch (err) {
      showToast("❌ 發送失敗：" + err.message);
    }
  };

  const handleMassMigrateImagesToStorage = async () => {
    if (!confirm("確定要執行全站圖片遷移？")) return;

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
        if (v.id.startsWith("mock")) continue;

        let updates = {};
        setSyncProgress(`正在處理 (${i + 1}/${realVtubers.length}): ${v.name}`);

        // 偵測 Base64 並轉換
        try {
          if (v.avatar && v.avatar.startsWith("data:image")) {
            const newUrl = await uploadImageToStorage(
              v.id,
              v.avatar,
              "avatar.jpg",
            );
            updates.avatar = newUrl;
          }
          if (v.banner && v.banner.startsWith("data:image")) {
            const newUrl = await uploadImageToStorage(
              v.id,
              v.banner,
              "banner.jpg",
            );
            updates.banner = newUrl;
          }

          if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, getPath("vtubers"), v.id), updates);
            successCount++;
            // 即時更新本地狀態
            setRealVtubers((prev) =>
              prev.map((rv) => (rv.id === v.id ? { ...rv, ...updates } : rv)),
            );
          }
        } catch (e) {
          console.error(`${v.name} 遷移失敗:`, e);
          failCount++;
        }

        // 稍微等待，避免 Firebase 頻率限制
        await new Promise((r) => setTimeout(r, 200));
      }
      alert(
        `遷移結束！\n成功：${successCount} 筆\n失敗：${failCount} 筆\n(若失敗次數多，請檢查 Storage Rules 權限)`,
      );
    } catch (err) {
      alert("遷移過程發生嚴重錯誤: " + err.message);
    } finally {
      setIsSyncingSubs(false);
      setSyncProgress("");
    }
  };

  const handleMigrateMyImages = async () => {
    if (!user) return showToast("請先登入！");

    // 取得目前資料庫中的名片資料
    const myData = realVtubers.find((v) => v.id === user.uid);
    if (!myData) return showToast("找不到您的名片資料，請先儲存名片。");

    const hasBase64Avatar =
      myData.avatar && myData.avatar.startsWith("data:image");
    const hasBase64Banner =
      myData.banner && myData.banner.startsWith("data:image");

    if (!hasBase64Avatar && !hasBase64Banner) {
      return showToast("✅ 您的圖片已經是網址格式，不需要遷移。");
    }

    try {
      showToast("⏳ 正在將您的圖片上傳至 Storage...");
      let updates = {};

      if (hasBase64Avatar) {
        const url = await uploadImageToStorage(
          user.uid,
          myData.avatar,
          "avatar.jpg",
        );
        updates.avatar = url;
      }
      if (hasBase64Banner) {
        const url = await uploadImageToStorage(
          user.uid,
          myData.banner,
          "banner.jpg",
        );
        updates.banner = url;
      }

      await updateDoc(doc(db, getPath("vtubers"), user.uid), {
        ...updates,
        updatedAt: Date.now(),
      });

      // 更新本地狀態讓畫面即時變化
      setRealVtubers((prev) =>
        prev.map((v) => (v.id === user.uid ? { ...v, ...updates } : v)),
      );
      showToast("🎉 遷移成功！您的圖片現在儲存在 Storage 了。");
    } catch (err) {
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
    } else {
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

  const pendingVtubersCount = useMemo(
    () =>
      realVtubers.filter(
        (v) =>
          !v.isVerified &&
          !v.isBlacklisted &&
          v.verificationStatus !== "rejected",
      ).length,
    [realVtubers],
  );

  const leaderboardData = useMemo(() => {
    return realVtubers
      .filter((v) => v.successCount && v.successCount > 0)
      .sort((a, b) => b.successCount - a.successCount);
  }, [realVtubers]);

  useEffect(() => {
    const loader = document.getElementById("loading-screen");
    if (loader) {
      // 強制 300ms 後開始淡出，不論資料是否加載完成
      const timer = setTimeout(() => {
        loader.style.opacity = "0";
        loader.style.pointerEvents = "none";
        // 動畫結束後徹底隱藏
        setTimeout(() => {
          loader.style.display = "none";
        }, 800);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash.startsWith("profile/")) {
        setProfileIdFromHash(hash.split("/")[1]);
        setCurrentView("profile");
      } else {
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
        vt = realVtubers.find(
          (v) => v.slug === profileIdFromHash.toLowerCase(),
        );
      }

      if (vt) {
        setSelectedVTuber(vt);
      } else {
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
    // 註冊 Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .then((reg) => console.log("SW 註冊成功:", reg.scope))
        .catch((err) => console.error("SW 註冊失敗:", err));
    }
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      // 關鍵：當偵測到帳號變動（包含登出）
      if (!u || (user && u.uid !== user.uid)) {
        setChatTarget(null); // 關閉聊天小視窗
        setIsChatListOpen(false); // 關閉私訊列表
      }

      setUser(u);
      setProfileForm(getEmptyProfile(u?.uid));
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

  // 🌟 獨立出全站設定與廣播監聽 (只在網頁載入時執行一次，不再受 currentView 影響)
  useEffect(() => {
    const unsubStats = onSnapshot(doc(db, getPath("settings"), "stats"), async (docSnap) => {
      if (docSnap.exists()) {
        const statsData = docSnap.data();
        setSiteStats(statsData);
        localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(statsData));
        localStorage.setItem(STATS_CACHE_TS, Date.now().toString());

        const cachedTs = localStorage.getItem(VTUBER_CACHE_TS) || '0';
        const processedUpdate = localStorage.getItem("processed_global_update") || '0';

        // 🌟 終極防呆：確保這個更新時間大於快取時間，且「我們還沒處理過這個特定的更新時間」
        // 這樣就算使用者的電腦時鐘比伺服器慢，也不會陷入無限重複抓取的迴圈！
        if (
          statsData.lastGlobalUpdate &&
          statsData.lastGlobalUpdate > parseInt(cachedTs) &&
          statsData.lastGlobalUpdate.toString() !== processedUpdate
        ) {
          // 🌟 關鍵修復：如果已經在抓取中了，就直接擋掉，防止無限迴圈！
          if (isFetchingJson.current) return;
          isFetchingJson.current = true;

          console.log("🔔 偵測到全站更新，等待後端打包資料...");

          // 立刻記錄已處理，防止重複觸發
          localStorage.setItem("processed_global_update", statsData.lastGlobalUpdate.toString());

          setTimeout(async () => {
            if (isAdmin) {
              try {
                const vSnap = await getDocs(collection(db, getPath("vtubers")));
                const data = vSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
                syncVtuberCache(data);
              } catch (e) { console.error("背景更新名單失敗", e); }
            } else {
              try {
                const jsonUrl = "https://firebasestorage.googleapis.com/v0/b/v-nexus.firebasestorage.app/o/public_api%2Fvtubers.json?alt=media";
                const response = await fetch(`${jsonUrl}&t=${Date.now()}`);
                if (response.ok) {
                  const data = await response.json();
                  syncVtuberCache(data);
                  console.log("✅ 成功抓取最新 JSON 動態！畫面已自動更新");
                }
              } catch (e) { console.error("背景更新 JSON 失敗", e); }
            }
            // 🌟 抓取完畢，解開鎖
            isFetchingJson.current = false;
          }, 4000);
        }
      }
    });

    // 抓取其他靜態設定 (站規、小技巧等，只需抓一次)
    if (!hasFetchedSettings.current) {
      hasFetchedSettings.current = true;
      Promise.all([
        getDoc(doc(db, getPath("settings"), "tips")),
        getDoc(doc(db, getPath("settings"), "rules")),
        getDoc(doc(db, getPath("settings"), "bulletinImages")),
      ]).then(([tipsSnap, rulesSnap, imgSnap]) => {
        if (tipsSnap.exists()) setRealTips(tipsSnap.data().content);
        if (rulesSnap.exists()) setRealRules(rulesSnap.data().content);
        if (imgSnap.exists()) setDefaultBulletinImages(imgSnap.data().images);
      });
    }

    return () => unsubStats();
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
    if (!user?.uid) return;

    const unsubN = onSnapshot(
      query(
        collection(db, getPath("notifications")),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(30),
      ),
      async (snap) => {
        const newNotifs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const latestChatNotif = newNotifs.find(
          (n) =>
            !n.read &&
            n.type === "chat_notification" &&
            Date.now() - n.createdAt < 5000,
        );

        if (latestChatNotif) {
          let sender = vtubersRef.current.find(
            (v) => v.id === latestChatNotif.fromUserId,
          );
          if (!sender) {
            const sSnap = await getDoc(
              doc(db, getPath("vtubers"), latestChatNotif.fromUserId),
            );
            if (sSnap.exists()) sender = { id: sSnap.id, ...sSnap.data() };
          }
          if (sender && chatTargetRef.current?.id !== sender.id) {
            setChatTarget(sender);
            updateDoc(doc(db, getPath("notifications"), latestChatNotif.id), {
              read: true,
            });
          }
        }
        setRealNotifications(newNotifs);
      },
    );

    return () => unsubN();
  }, [user?.uid]);

  // --- 優化版：名片清單與佈告欄抓取 (修正首頁不顯示數字的問題) ---
  useEffect(() => {
    const fetchLargeData = async () => {
      const needsVtuberList = [
        "home", "grid", "profile", "match", "blacklist", "dashboard", "admin", "bulletin", "commission-board", "collabs", "articles", "commissions"
      ].includes(currentView);

      if (needsVtuberList) {
        const now = Date.now();
        const cachedTs = localStorage.getItem(VTUBER_CACHE_TS);

        // 🌟 關鍵修復 3：預設快取 24 小時。
        // 不用擔心看不到新資料，因為只要有人發動態，上面的 onSnapshot 就會瞬間打破這個 24 小時限制！
        let isExpired = !cachedTs || (now - parseInt(cachedTs) > 24 * 60 * 60 * 1000);

        // 管理員進入後台時，確保擁有包含待審核的完整資料
        const hasFullData = sessionStorage.getItem("has_full_admin_data") === "true";
        if (isAdmin && currentView === 'admin' && !hasFullData) {
          isExpired = true;
        }

        if (isExpired) {
          try {
            const vSnap = await getDocs(collection(db, getPath("vtubers")));
            const data = vSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            syncVtuberCache(data);
            if (isAdmin) sessionStorage.setItem("has_full_admin_data", "true");
          } catch (e) { console.error("讀取名單失敗", e); }
        }
        setIsLoading(false);
      }

      // 2. 佈告欄、行程與最新消息資料 (完美快取版，解決 Stale Closure)
      const needsActivityData = ['home', 'bulletin', 'collabs', 'admin'].includes(currentView);
      if (needsActivityData) {
        const now = Date.now();
        const bCache = localStorage.getItem(BULLETINS_CACHE_KEY);
        const bTs = localStorage.getItem(BULLETINS_CACHE_TS);
        const cCache = localStorage.getItem(COLLABS_CACHE_KEY);
        const cTs = localStorage.getItem(COLLABS_CACHE_TS);

        // 🌟 新增：讀取 Updates 的快取
        const uCache = localStorage.getItem("vnexus_updates_data");
        const uTs = localStorage.getItem("vnexus_updates_ts");

        const isBCacheValid = bCache && bTs && (now - parseInt(bTs) < ACTIVITY_CACHE_LIMIT);
        const isCCacheValid = cCache && cTs && (now - parseInt(cTs) < ACTIVITY_CACHE_LIMIT);
        const isUCacheValid = uCache && uTs && (now - parseInt(uTs) < ACTIVITY_CACHE_LIMIT);

        // 🛡️ 只有當三個快取都有效時，才完全不讀取資料庫
        if (isBCacheValid && isCCacheValid && isUCacheValid) {
          setRealBulletins(JSON.parse(bCache));
          setRealCollabs(JSON.parse(cCache));
          setRealUpdates(JSON.parse(uCache)); // 👈 直接從快取拿，徹底解決閉包問題
          setIsLoadingActivities(false);
        } else {
          setIsLoadingActivities(true);
          try {
            const nowTime = Date.now();
            const [bSnap, cSnap, uSnap] = await Promise.all([
              getDocs(query(collection(db, getPath('bulletins')), where("recruitEndTime", ">", nowTime))),
              getDocs(query(collection(db, getPath('collabs')), where("startTimestamp", ">", nowTime - 2 * 60 * 60 * 1000))),
              getDocs(query(collection(db, getPath('updates')), orderBy('createdAt', 'desc'), limit(15)))
            ]);
            const bData = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const cData = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const uData = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            syncBulletinCache(bData);
            syncCollabCache(cData);

            // 🌟 新增：將 Updates 寫入 State 與 LocalStorage 快取
            setRealUpdates(uData);
            localStorage.setItem("vnexus_updates_data", JSON.stringify(uData));
            localStorage.setItem("vnexus_updates_ts", Date.now().toString());

          } catch (e) {
            console.error("抓取活動資料失敗:", e);
          } finally {
            setIsLoadingActivities(false);
          }
        }
      }
    };

    fetchLargeData();
  }, [currentView, isAdmin]);

  useEffect(() => {
    const needsArticleData = ['articles', 'admin'].includes(currentView);
    if (!needsArticleData) return;

    const fetchArticles = async () => {
      const now = Date.now();
      const aCache = localStorage.getItem(ARTICLES_CACHE_KEY);
      const aTs = localStorage.getItem(ARTICLES_CACHE_TS);
      const isACacheValid = aCache && aTs && now - parseInt(aTs) < ARTICLES_CACHE_LIMIT;
      const forceRefresh = currentView === "admin";

      if (isACacheValid && !forceRefresh) {
        setRealArticles(JSON.parse(aCache));
        return;
      }

      try {
        const aSnap = await getDocs(collection(db, getPath("articles")));
        const aData = aSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRealArticles(aData);
        localStorage.setItem(ARTICLES_CACHE_KEY, JSON.stringify(aData));
        localStorage.setItem(ARTICLES_CACHE_TS, now.toString());
      } catch (e) {
        console.error("抓取文章失敗:", e);
      }
    };

    fetchArticles();
  }, [currentView]);

  const hasFetchedPrivate = useRef(false);
  useEffect(() => {
    // 登出時重置
    if (!user) hasFetchedPrivate.current = false;
  }, [user]);

  useEffect(() => {
    if (
      user &&
      user.uid &&
      realVtubers.length > 0 &&
      !hasFetchedPrivate.current
    ) {
      const myPublicData = realVtubers.find((v) => v.id === user.uid);

      if (myPublicData) {
        hasFetchedPrivate.current = true; // 上鎖，防止重複讀取
        getDoc(doc(db, getPath("vtubers_private"), user.uid))
          .then((docSnap) => {
            const pData = docSnap.exists() ? docSnap.data() : {};

            const rawCollabs = Array.isArray(myPublicData.collabTypes)
              ? myPublicData.collabTypes
              : [];
            const stdCollabs = rawCollabs.filter((t) =>
              PREDEFINED_COLLABS.includes(t),
            );
            const otherCollab =
              rawCollabs.find((t) => !PREDEFINED_COLLABS.includes(t)) || "";

            const PREDEFINED_NATS = ["台灣", "日本", "香港", "馬來西亞"];
            const rawNats = Array.isArray(myPublicData.nationalities)
              ? myPublicData.nationalities
              : [];
            const stdNats = rawNats.filter((n) => PREDEFINED_NATS.includes(n));
            const otherNat =
              rawNats.find((n) => !PREDEFINED_NATS.includes(n)) || "";

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
    if (
      isAdmin &&
      currentView === "admin" &&
      Object.keys(privateDocs).length === 0
    ) {
      getDocs(collection(db, getPath("vtubers_private")))
        .then((snap) => {
          const pDocs = {};
          snap.docs.forEach((d) => (pDocs[d.id] = d.data()));
          setPrivateDocs(pDocs);
        })
        .catch((err) => console.error("抓取私密資料失敗:", err));
    }
  }, [isAdmin, currentView]);

  const myNotifications = useMemo(
    () =>
      user
        ? realNotifications
          .filter((n) => n.userId === user.uid)
          .sort((a, b) => b.createdAt - a.createdAt)
        : [],
    [realNotifications, user],
  );
  const unreadCount = myNotifications.filter((n) => !n.read).length;
  const markAllAsRead = () =>
    myNotifications.forEach((n) => {
      if (!n.read)
        updateDoc(doc(db, getPath("notifications"), n.id), { read: true });
    });

  const handleNotifClick = (n) => {
    const isBackup = n.message && n.message.startsWith("【寄件備份");
    if (isBackup) {
      if (!n.read) updateDoc(doc(db, getPath("notifications"), n.id), { read: true }).catch(() => { });
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
    } else {
      setSelectedVTuber(sender);
      navigate(`profile/${sender.id}`);
    }

    if (!n.read) updateDoc(doc(db, getPath("notifications"), n.id), { read: true }).catch(() => { });
    setIsNotifOpen(false);
  };

  const handleNotifProfileNav = (userId) => {
    const vt = realVtubers.find((v) => v.id === userId);
    if (vt) {
      setSelectedVTuber(vt);
      navigate(`profile/${vt.id}`);
    } else showToast("找不到該名片，可能已被刪除或隱藏");
  };

  const handleNotifOpenChat = (n) => {
    const vt = realVtubers.find((v) => v.id === n.fromUserId);
    if (vt) {
      handleOpenChat(vt); // 呼叫原本右下角開啟聊天室的函式
    } else {
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
    } catch (err) { }
  };
  const handleDeleteNotif = async (id) => {
    if (!confirm("確定要刪除這則通知嗎？")) return;
    try {
      await deleteDoc(doc(db, getPath("notifications"), id));
      showToast("✅ 已刪除通知");
    } catch (err) {
      showToast("刪除失敗");
    }
  };

  const handleDeleteAllNotifs = async () => {
    if (myNotifications.length === 0) return showToast("信箱已經是空的囉！");
    if (!confirm("確定要刪除全部信件嗎？此動作無法復原！")) return;
    try {
      showToast("⏳ 正在清空信箱...");
      const batch = writeBatch(db);
      myNotifications.forEach((n) => {
        batch.delete(doc(db, getPath("notifications"), n.id));
      });
      await batch.commit();
      showToast("✅ 已成功清空所有信件！");
    } catch (err) {
      showToast("❌ 刪除失敗，請稍後再試。");
    }
  };

  const handleBraveInvite = async (target) => {
    if (!user) return showToast("請先登入！");
    if (!isVerifiedUser) return showToast("需通過認證才能發送邀請！");
    if (target.id === user.uid) return showToast("不能邀請自己！");

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
    } catch (err) {
      showToast("發送失敗");
    }
  };

  const handleBraveInviteResponse = async (notifId, senderId, accept) => {
    if (!user) return;
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

      setRealNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, handled: true } : n)),
      );
      showToast(accept ? "已回覆：可以試試" : "已回覆：委婉拒絕");
    } catch (err) {
      showToast("回覆失敗");
    }
  };

  const handleOpenCollabModal = (targetVtuber) => {
    if (!user) return showToast("請先登入！");
    setSelectedVTuber(targetVtuber);
    setIsCollabModalOpen(true);
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
      showToast("🎉 登入成功！");

      // 🌟 新增 GA4 監控 3：記錄使用者成功登入
      if (analytics) {
        logEvent(analytics, 'login', { method: 'Google' });
      }
    } catch (e) {
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
    } catch (e) {
      console.error("登入失敗:", e);
      showToast("登入失敗");
    }
  };

  // --- 修改後的程式碼 ---
  const displayVtubers = useMemo(() => {
    const getDeterministicOrder = (id) => {
      if (!id) return 0;
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
        if (!val) return 0;
        if (typeof val === "number") return val;
        if (val.toMillis) return val.toMillis();
        return 0;
      };
      return Math.max(
        getTime(v.lastActiveAt),
        getTime(v.updatedAt),
        getTime(v.createdAt),
      );
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
    } else {
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
        } else if (aHigh && !bHigh) {
          return -1; // a 及格，排前面
        } else if (!aHigh && bHigh) {
          return 1;  // b 及格，排前面
        } else {
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
      if (sortOrder === "likes") return (b.likes || 0) - (a.likes || 0);
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
    if (!Array.isArray(displayVtubers)) return [];

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
        } else if (v.nationality) {
          nats.add(v.nationality);
        }
      });

    // 🌟 優化：自訂排序邏輯
    const sortedNats = Array.from(nats).sort((a, b) => {
      const idxA = PREDEFINED_NATS.indexOf(a);
      const idxB = PREDEFINED_NATS.indexOf(b);

      // 如果兩個都是預設選項，依照預設陣列的順序排
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      // 如果 A 是預設選項，A 排前面
      if (idxA !== -1) return -1;
      // 如果 B 是預設選項，B 排前面
      if (idxB !== -1) return 1;
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
        } else if (v.language) {
          langs.add(v.language);
        }
      });

    // 🌟 優化：自訂排序邏輯
    const sortedLangs = Array.from(langs).sort((a, b) => {
      const idxA = PREDEFINED_LANGS.indexOf(a);
      const idxB = PREDEFINED_LANGS.indexOf(b);

      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
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
        if (v.isScheduleAnytime) days.add("隨時可約");
        if (Array.isArray(v.scheduleSlots)) {
          v.scheduleSlots.forEach((s) => {
            if (s.day) days.add(s.day);
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
          avatar:
            "[https://api.dicebear.com/7.x/avataaars/svg?seed=Anon](https://api.dicebear.com/7.x/avataaars/svg?seed=Anon)",
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
      if (b.collabType) types.add(b.collabType);
    });
    return Array.from(types).sort();
  }, [displayBulletins]);

  const filteredDisplayBulletins = useMemo(() => {
    if (bulletinFilter === "All") return displayBulletins;
    return displayBulletins.filter((b) => b.collabType === bulletinFilter);
  }, [displayBulletins, bulletinFilter]);

  const displayCollabs = useMemo(() => {
    const getTimeSafely = (val) => {
      if (!val) return 0;
      if (typeof val === "number") return val;
      if (val.toMillis) return val.toMillis();
      return 0;
    };
    return [...realCollabs]
      .filter((c) => {
        const start = getTimeSafely(c.startTimestamp);
        return !start || currentTime <= start + 2 * 60 * 60 * 1000;
      })
      .sort(
        (a, b) =>
          getTimeSafely(a.startTimestamp || a.createdAt) -
          getTimeSafely(b.startTimestamp || b.createdAt),
      );
  }, [realCollabs, currentTime]);

  const filteredDisplayCollabs = useMemo(() => {
    if (collabCategoryTab === "All") return displayCollabs;
    return displayCollabs.filter(
      (c) => (c.category || "遊戲") === collabCategoryTab,
    );
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
      if (!v || !isVisible(v, user)) return false;
      const searchLower = (searchQuery || "").toLowerCase();
      const vTags = Array.isArray(v.tags) ? v.tags : [];
      const vName = (v.name || "").toLowerCase(); // 確保 name 存在才轉小寫

      const matchSearch =
        vName.includes(searchLower) ||
        vTags.some((t) =>
          String(t || "")
            .toLowerCase()
            .includes(searchLower),
        );


      const matchTags =
        selectedTags.length === 0 ||
        selectedTags.every((t) => vTags.includes(t));
      const matchAgency =
        selectedAgency === "All" || v.agency === selectedAgency;
      const matchPlatform =
        selectedPlatform === "All" || v.mainPlatform === selectedPlatform;

      const vNats = Array.isArray(v.nationalities) ? v.nationalities : [];
      const matchNationality =
        selectedNationality === "All" || vNats.includes(selectedNationality);

      const vLangs = Array.isArray(v.languages) ? v.languages : [];
      const matchLanguage =
        selectedLanguage === "All" || vLangs.includes(selectedLanguage);

      const matchSchedule =
        selectedSchedule === "All" ||
        (selectedSchedule === "隨時可約" && v.isScheduleAnytime) ||
        (Array.isArray(v.scheduleSlots) &&
          v.scheduleSlots.some((s) => s.day === selectedSchedule));

      const vColors = Array.isArray(v.colorSchemes) ? v.colorSchemes : [];
      const matchColor =
        selectedColor === "All" || vColors.includes(selectedColor);

      const matchZodiac = selectedZodiac === "All" || v.zodiacSign === selectedZodiac;

      return (
        matchSearch &&
        matchTags &&
        matchAgency &&
        matchPlatform &&
        matchNationality &&
        matchLanguage &&
        matchSchedule &&
        matchColor &&
        matchZodiac
      );
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

  const toggleTag = (tag) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

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
  const totalPages = Math.max(
    1,
    Math.ceil(filteredVTubers.length / ITEMS_PER_PAGE),
  );
  const paginatedVTubers = filteredVTubers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );
  const scrollVtuberGridToTop = () => {
    const target = document.getElementById("vtuber-partner-page-top");
    const getTargetTop = () => {
      if (!target) return 0;
      return Math.max(0, target.getBoundingClientRect().top + window.scrollY - 88);
    };
    const doScroll = () => {
      const top = getTargetTop();
      window.scrollTo({ top, behavior: "auto" });

      // iOS Safari / 部分手機瀏覽器補強，避免切頁後停在原本的頁面底部。
      if (document.body) document.body.scrollTop = top;
      if (document.documentElement) document.documentElement.scrollTop = top;
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

  const syncVtuberCache = (newList) => {
    setRealVtubers(newList);
    localStorage.setItem(VTUBER_CACHE_KEY, JSON.stringify(newList));
    localStorage.setItem(VTUBER_CACHE_TS, Date.now().toString());
  };
  const syncBulletinCache = (newList) => {
    setRealBulletins(newList);
    localStorage.setItem(BULLETINS_CACHE_KEY, JSON.stringify(newList));
    localStorage.setItem(BULLETINS_CACHE_TS, Date.now().toString());
  };

  const syncCollabCache = (newList) => {
    setRealCollabs(newList);
    localStorage.setItem(COLLABS_CACHE_KEY, JSON.stringify(newList));
    localStorage.setItem(COLLABS_CACHE_TS, Date.now().toString());
  };

  const handleSaveProfile = async (e, customForm = profileForm) => {
    if (e) e.preventDefault();
    if (!user) return showToast("請先登入！");

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
    if (
      customForm.publicEmail &&
      customForm.publicEmail.trim() !== "" &&
      !customForm.publicEmailVerified
    ) {
      return showToast("請先完成公開工商信箱驗證，或清空該欄位！");
    }

    // 🌟 新增：3. 驗證可聯動時段 (強制必填)
    let hasValidSchedule = false;
    if (customForm.isScheduleAnytime) {
      hasValidSchedule = true;
    } else if (customForm.isScheduleCustom) {
      hasValidSchedule = customForm.customScheduleText && customForm.customScheduleText.trim() !== "";
    } else {
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
      const avatarUrl = await uploadImageToStorage(
        targetUid,
        customForm.avatar,
        "avatar.jpg",
      );
      const bannerUrl = await uploadImageToStorage(
        targetUid,
        customForm.banner,
        "banner.jpg",
      );

      // --- B. 標籤安全處理 (修正 split 報錯) ---
      let tagsArray = [];
      if (Array.isArray(customForm.tags)) {
        tagsArray = customForm.tags;
      } else if (typeof customForm.tags === "string") {
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
        if (!finalCollabs.includes(otherText)) finalCollabs.push(otherText);
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
      const finalPersonality =
        customForm.personalityType === "其他"
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

      if (
        !existingProfile ||
        existingProfile.verificationStatus === "rejected"
      ) {
        publicData.isVerified = false;
        publicData.isBlacklisted = false;
        publicData.verificationStatus = "pending";
        publicData.showVerificationModal = null;
        publicData.likes = 0;
        publicData.likedBy = [];
        publicData.dislikes = 0;
        publicData.dislikedBy = [];
        publicData.createdAt = existingProfile?.createdAt || Date.now();
      } else {
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
      console.table(
        Object.keys(publicData).map((key) => ({
          key,
          type: Array.isArray(publicData[key]) ? "array" : typeof publicData[key],
          value:
            typeof publicData[key] === "string"
              ? publicData[key].slice(0, 80)
              : JSON.stringify(publicData[key] ?? "").slice(0, 120),
        })),
      );
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
        } else {
          await updateDoc(publicRef, { ...publicData, ...publicFieldCleanup });
        }
        console.log("✅ public vtubers 寫入成功");
      } catch (err) {
        console.error("❌ public vtubers 寫入失敗:", err);
        console.log("失敗時 publicData keys:", Object.keys(publicData));
        console.log("失敗時 publicData:", publicData);
        throw err;
      }

      try {
        await setDoc(privateRef, privateData, { merge: true });
        console.log("✅ private vtubers_private 寫入成功");
      } catch (err) {
        console.error("❌ private vtubers_private 寫入失敗:", err);
        console.log("失敗時 privateData keys:", Object.keys(privateData));
        throw err;
      }

      // --- G. 同步本地與快取 ---
      setRealVtubers((prev) => {
        const newList = prev.map((v) =>
          v.id === targetUid ? { ...v, ...publicData } : v,
        );
        if (!prev.find((v) => v.id === targetUid)) newList.push(publicData);
        syncVtuberCache(newList);
        return newList;
      });

      showToast(
        existingProfile?.isVerified
          ? "🎉 名片已成功更新！"
          : "🎉 名片已建立！等待審核中。",
      );
      if (!customForm.id) navigate("grid");
    } catch (err) {
      console.error("儲存失敗詳細錯誤:", err);
      // 這裡會噴出具體的錯誤原因，請打開 F12 查看
      showToast(`❌ 儲存失敗: ${err.code || ""} ${err.message || err}`);
    }
  };

  const handleQuickStatusUpdate = async (targetId, statusMsg, isLive = false) => {
    if (!user) return showToast("請先登入！");
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
        const newList = prev.map((v) =>
          v.id === uid ? { ...v, statusMessage: content, statusMessageUpdatedAt: content ? now : 0, statusMessageExpiresAt: statusExpiresAt, statusReactions: { plus_one: [], watching: [], fire: [] }, updatedAt: now } : v
        );
        syncVtuberCache(newList);
        return newList;
      });

      if (!content) {
        showToast("🧹 動態已清除！");
      } else {
        showToast(isLive ? "🔴 已火速發布直播通知！(3小時後自動隱藏)" : "✅ 限時動態已火速發布！全站已同步");
      }
    } catch (err) {
      console.error(err);
      showToast("❌ 操作失敗，請稍後再試");
    }
  };

  const handleStatusReaction = async (e, target, type) => {
    e.stopPropagation();
    if (!user) return showToast("請先登入！");
    if (!isVerifiedUser) return showToast("需通過認證才能互動喔！");
    if (target.id === user.uid) return showToast("不能對自己的動態互動喔！");

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
    } else if (type === 'watching') {
      msg = `對您的限時動態表示：👀 觀望中 (很有興趣喔)！\n\n動態內容：「${target.statusMessage}」`;
      icon = "👀";
    } else if (type === 'fire') {
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
    } catch (err) {
      console.error(err);
      showToast("❌ 發送失敗");
    }
  };

  const handleUserDeleteSelf = async () => {
    if (!user) return;

    // 顯示自訂確認視窗
    const confirmDelete = window.confirm(
      "你確認要刪除V-NEXUS名片?\n提醒您: 刪除後需要重新審核",
    );

    if (!confirmDelete) return;

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
    } catch (err) {
      console.error("刪除失敗:", err);
      showToast("❌ 刪除失敗，請稍後再試");
    }
  };

  const handleBulletinImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      e.target.value = "";
      return showToast("❌ 檔案太大！請選擇 5MB 以下。");
    }
    showToast("⏳ 圖片壓縮中...");
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width,
          height = img.height;
        const maxWidth = 800,
          maxHeight = 800;
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
      const storageUrl = await uploadImageToStorage(
        "system",
        base64,
        `bulletin_defaults/${fileName}`,
      );

      const newImages = [...defaultBulletinImages, storageUrl];
      await setDoc(
        doc(db, getPath("settings"), "bulletinImages"),
        { images: newImages },
        { merge: true },
      );
      setDefaultBulletinImages(newImages);
      showToast("✅ 預設圖片已新增並存至 Storage");
    } catch (e) {
      console.error(e);
      showToast("❌ 新增失敗，請檢查 Storage 權限");
    }
  };

  const handleDeleteDefaultBulletinImage = async (idx) => {
    if (!confirm("確定刪除這張預設圖片？")) return;
    const newImages = defaultBulletinImages.filter((_, i) => i !== idx);
    try {
      await setDoc(
        doc(db, getPath("settings"), "bulletinImages"),
        { images: newImages },
        { merge: true },
      );
      setDefaultBulletinImages(newImages);
      showToast("✅ 已刪除");
    } catch (e) {
      showToast("刪除失敗");
    }
  };

  const handlePostBulletin = async () => {
    if (!user) return showToast("請先登入！");

    // 1. 必填檢查
    if (
      !newBulletin.content.trim() ||
      !newBulletin.collabType ||
      !newBulletin.collabSize ||
      !newBulletin.collabTime ||
      !newBulletin.recruitEndTime ||
      !newBulletin.image
    ) {
      return showToast("請完整填寫所有必填欄位，並選擇一張招募圖片！");
    }

    const rEnd = new Date(newBulletin.recruitEndTime).getTime();
    const cTime = new Date(newBulletin.collabTime).getTime();

    if (rEnd < Date.now() && !newBulletin.id)
      return showToast("截止時間不能在過去！");
    if (cTime < rEnd) return showToast("⚠️ 聯動時間不能早於招募截止日！");
    if (!myProfile?.isVerified) return showToast("名片審核通過後才能發布喔！");

    // 每位創作者最多同時保留 3 個未截止的揪團企劃。
    // 第 4 個必須等較早的揪團截止或自行刪除後才能發布。
    if (!newBulletin.id) {
      const activeMyBulletins = (realBulletins || []).filter((b) => {
        if (!b || b.userId !== user.uid) return false;
        const endTime = Number(b.recruitEndTime || 0);
        return endTime > Date.now();
      });

      if (activeMyBulletins.length >= 3) {
        return showToast("目前最多只能同時發布 3 個揪團企劃，請等其中一個截止或刪除後再發布。");
      }
    }

    try {
      showToast("⏳ 正在處理中...");

      const ft =
        newBulletin.collabType === "其他"
          ? newBulletin.collabTypeOther
          : newBulletin.collabType;
      let finalImage = newBulletin.image;

      // 圖片處理
      if (finalImage && finalImage.startsWith("data:image")) {
        const fileName = `bulletin_${Date.now()}.jpg`;
        finalImage = await uploadImageToStorage(
          user.uid,
          newBulletin.image,
          fileName,
        );
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
          const newList = prev.map((b) =>
            b.id === newBulletin.id
              ? {
                ...b,
                content: newBulletin.content,
                collabType: ft,
                collabSize: newBulletin.collabSize,
                collabTime: newBulletin.collabTime,
                recruitEndTime: rEnd,
                image: finalImage,
              }
              : b,
          );
          syncBulletinCache(newList);
          return newList;
        });
        showToast("🚀 招募修改成功！");
      } else {
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
        const newDocRef = await addDoc(
          collection(db, getPath("bulletins")),
          newDocData,
        );

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
    } catch (err) {
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

  const handleApplyBulletin = async (
    bulletinId,
    isApplying,
    bulletinAuthorId,
  ) => {
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
        const newList = prev.map((b) =>
          b.id === bulletinId
            ? {
              ...b,
              applicants: isApplying
                ? [...(b.applicants || []), user.uid]
                : (b.applicants || []).filter((id) => id !== user.uid),
            }
            : b,
        );
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
    } catch (err) {
      showToast("操作失敗");
    }
  };

  const handleRecommend = async (target) => {
    if (!isVerifiedUser) return showToast("需通過認證才能推薦！");
    if (target.id === user.uid) return showToast("不能推薦自己！");
    if (target.likedBy && target.likedBy.includes(user.uid))
      return showToast("已經推薦過囉！每人限推薦一次。");
    try {
      await updateDoc(doc(db, getPath("vtubers"), target.id), {
        likes: increment(1),
        likedBy: arrayUnion(user.uid),
      });
      setRealVtubers((prev) =>
        prev.map((v) =>
          v.id === target.id
            ? {
              ...v,
              likes: (v.likes || 0) + 1,
              likedBy: [...(v.likedBy || []), user.uid],
            }
            : v,
        ),
      );
      if (selectedVTuber?.id === target.id)
        setSelectedVTuber((prev) => ({
          ...prev,
          likes: (prev.likes || 0) + 1,
          likedBy: [...(prev.likedBy || []), user.uid],
        }));
      showToast("✅ 已送出推薦！");
    } catch (err) {
      showToast("推薦失敗");
    }
  };

  const handleInitiateDislike = (target) => {
    if (!isVerifiedUser) return showToast("需通過認證才能檢舉！");
    if (target.id === user.uid) return showToast("不能檢舉自己！");
    if (target.dislikedBy && target.dislikedBy.includes(user.uid))
      return showToast("已經倒讚過囉！");
    setConfirmDislikeData(target);
  };

  const handleConfirmDislike = async () => {
    if (!confirmDislikeData || !user) return;
    const tId = confirmDislikeData.id;
    if (
      confirmDislikeData.dislikedBy &&
      confirmDislikeData.dislikedBy.includes(user.uid)
    ) {
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
      setRealVtubers((prev) =>
        prev.map((v) =>
          v.id === tId
            ? {
              ...v,
              dislikes: newD,
              dislikedBy: [...(v.dislikedBy || []), user.uid],
              isVerified: updates.isVerified ?? v.isVerified,
              isBlacklisted: updates.isBlacklisted ?? v.isBlacklisted,
            }
            : v,
        ),
      );
      setConfirmDislikeData(null);
      showToast("✅ 已送出倒讚。");
      if (updates.isBlacklisted) {
        showToast("⚠️ 該名片已自動下架。");
        if (selectedVTuber?.id === tId) navigate("grid");
      } else if (selectedVTuber?.id === tId) {
        setSelectedVTuber((prev) => ({
          ...prev,
          dislikes: newD,
          dislikedBy: [...(prev.dislikedBy || []), user.uid],
        }));
      }
    } catch (err) {
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
      const newList = prev.map((v) =>
        v.id === id ? { ...v, ...updates, verificationNote: updates.verificationNote || undefined } : v
      );
      syncVtuberCache(newList);
      return newList;
    });

    showToast(payload.emailWarning ? `✅ 已通過審核；${payload.emailWarning}` : "✅ 已通過審核並送出通知！");
  } catch (err) {
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
      const newList = prev.map((v) =>
        v.id === id ? { ...v, ...updates } : v
      );

      if (typeof syncVtuberCache === "function") {
        syncVtuberCache(newList);
      }

      return newList;
    });

    showToast(payload.emailWarning ? `✅ 已退回審核；${payload.emailWarning}` : "✅ 已退回審核並送出通知！");
  } catch (err) {
    console.error("退回審核失敗:", err);
    const message = err?.message || err?.details || "請確認管理員權限、App Check 與 Functions 是否已部署";
    showToast(`❌ 退回審核失敗：${message}`);
  }
};

  const handleAdminUpdateVtuber = async (id, updatedData) => {
    try {
      showToast("⏳ 管理員強制更新中，正在處理圖片...");

      // --- A. 圖片上傳至 Storage ---
      const avatarUrl = await uploadImageToStorage(
        id,
        updatedData.avatar,
        "avatar.jpg",
      );
      const bannerUrl = await uploadImageToStorage(
        id,
        updatedData.banner,
        "banner.jpg",
      );

      // --- B. 準備資料 ---
      const tagsArray =
        typeof updatedData.tags === "string"
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


      await setDoc(
        doc(db, getPath("vtubers_private"), id),
        {
          // 🌟 資安優化：移除 contactEmail
          verificationNote: updatedData.verificationNote || "",
          publicEmail: updatedData.publicEmail || "",
          publicEmailVerified: updatedData.publicEmailVerified || false,
          updatedAt: Date.now(),
        },
        { merge: true },
      );

      // --- D. 更新本地狀態與快取 ---
      setRealVtubers((prev) => {
        const updatedList = prev.map((v) =>
          v.id === id ? { ...v, ...publicData } : v,
        );
        syncVtuberCache(updatedList);
        return updatedList;
      });

      showToast("✅ 管理員強制更新成功，快取已同步！");
    } catch (err) {
      console.error("管理員更新失敗:", err);
      showToast("❌ 更新失敗");
    }
  };

  const handleDeleteVtuber = async (id) => {
    if (!confirm("確定要刪除這張名片嗎？(此動作無法復原)")) return;
    try {
      await deleteDoc(doc(db, getPath("vtubers"), id));
      await deleteDoc(doc(db, getPath("vtubers_private"), id));

      setRealVtubers((prev) => {
        const newList = prev.filter((v) => v.id !== id);
        syncVtuberCache(newList); // ✅ 同步快取，防止幽靈復活
        return newList;
      });
      showToast("已刪除名片");
    } catch (err) {
      showToast("刪除失敗");
    }
  };

  const handleDeleteBulletin = async (id) => {
    if (!confirm("確定要刪除這則招募文嗎？")) return;
    try {
      await deleteDoc(doc(db, getPath("bulletins"), id));
      setRealBulletins((prev) => {
        const newList = prev.filter((b) => b.id !== id);
        syncBulletinCache(newList); // ✅ 同步快取，刪除後即時消失
        return newList;
      });
      showToast("已刪除招募文");
    } catch (err) {
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
    } catch (err) {
      console.error(err);
      showToast("❌ 新增失敗");
    }
  };

  const handleAdminCleanBulletins = async () => {
    if (!confirm("確定要結算並清理所有過期的招募文嗎？\n(達標的招募將轉換為積分，並刪除過期資料以節省讀取費)")) return;

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

    } catch (e) {
      console.error(e);
      showToast("❌ 清理失敗，請看 Console");
    } finally {
      setIsSyncingSubs(false);
      setSyncProgress("");
    }
  };

  const handleDeleteCollab = async (id) => {
    if (!confirm("確定要刪除這個聯動行程嗎？")) return;
    try {
      await deleteDoc(doc(db, getPath("collabs"), id));
      setRealCollabs((prev) => {
        const newList = prev.filter((c) => c.id !== id);
        syncCollabCache(newList); // ✅ 同步快取
        return newList;
      });
      showToast("已刪除聯動行程");
    } catch (err) {
      showToast("刪除失敗");
    }
  };
  const handleSaveSettings = async (tipsContent, rulesContent) => {
    try {
      if (tipsContent !== undefined) {
        await setDoc(
          doc(db, getPath("settings"), "tips"),
          { content: tipsContent },
          { merge: true },
        );
        setRealTips(tipsContent);
      }
      if (rulesContent !== undefined) {
        await setDoc(
          doc(db, getPath("settings"), "rules"),
          { content: rulesContent },
          { merge: true },
        );
        setRealRules(rulesContent);
      }
      showToast("系統設定已更新！");
    } catch (err) {
      showToast("更新失敗");
    }
  };
  const handleAdminResetAllCollabTypes = async () => {
    if (!confirm("⚠️ 確定要清除所有人的聯動類型嗎？")) return;
    try {
      if (prompt("請輸入 'CONFIRM'") !== "CONFIRM")
        return showToast("已取消操作。");
      for (const v of realVtubers) {
        if (!v.id.startsWith("mock")) {
          await setDoc(
            doc(db, getPath("vtubers"), v.id),
            { collabTypes: [] },
            { merge: true },
          );
        }
      }
      setRealVtubers((prev) => prev.map((v) => ({ ...v, collabTypes: [] })));
      showToast("✅ 已清除所有人聯動類型！");
    } catch (err) {
      showToast("清除失敗");
    }
  };
  const handleAdminMassUpdateVerification = async () => {
    if (
      !confirm(
        "⚠️ 確定要將所有名片的真人驗證內容一鍵更改為 'X' 嗎？\n此動作將覆蓋所有現有的驗證備註！",
      )
    )
      return;

    const confirmText = prompt("請輸入 'X-CONFIRM' 以確認執行此大規模操作：");
    if (confirmText !== "X-CONFIRM") return showToast("操作已取消");

    setIsSyncingSubs(true); // 借用同步狀態來顯示 Loading
    setSyncProgress("正在更新驗證內容...");

    try {
      let count = 0;
      // 遍歷所有 VTuber
      for (const v of realVtubers) {
        if (!v.id.startsWith("mock")) {
          // 更新私密資料庫中的 verificationNote
          await setDoc(
            doc(db, getPath("vtubers_private"), v.id),
            {
              verificationNote: "X",
              updatedAt: Date.now(),
            },
            { merge: true },
          );
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
    } catch (err) {
      console.error(err);
      showToast("❌ 更新失敗，請檢查權限或網路");
    } finally {
      setIsSyncingSubs(false);
      setSyncProgress("");
    }
  };
  // --- 聯動提醒功能測試函式 ---
  const handleTestReminderSystem = async () => {
    if (!user) return showToast("請先登入！");
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
    } catch (err) {
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
          const isNatInvalid =
            v.nationalities !== undefined && !Array.isArray(v.nationalities);
          const isLangInvalid =
            v.languages !== undefined && !Array.isArray(v.languages);
          const hasOldNat = typeof v.nationality === "string" && v.nationality;
          const hasOldLang = typeof v.language === "string" && v.language;

          if (isNatInvalid || isLangInvalid || hasOldNat || hasOldLang) {
            let newNats = [];
            if (Array.isArray(v.nationalities)) newNats = v.nationalities;
            else if (typeof v.nationalities === "string" && v.nationalities)
              newNats = [v.nationalities];
            else if (typeof v.nationality === "string" && v.nationality)
              newNats = [v.nationality];

            let newLangs = [];
            if (Array.isArray(v.languages)) newLangs = v.languages;
            else if (typeof v.languages === "string" && v.languages)
              newLangs = [v.languages];
            else if (typeof v.language === "string" && v.language)
              newLangs = [v.language];

            await setDoc(
              doc(db, getPath("vtubers"), v.id),
              {
                nationalities: newNats,
                languages: newLangs,
                nationality: "",
                language: "",
              },
              { merge: true },
            );
            fixedCount++;
          }
        }
      }
      if (fixedCount > 0) {
        showToast(
          `✅ 已成功修復 ${fixedCount} 筆格式錯誤的名片！重新載入中...`,
        );
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast(`✅ 檢查完畢，目前沒有格式錯誤的資料。`);
      }
    } catch (err) {
      console.error(err);
      showToast("修復失敗");
    }
  };

  const handleMassSyncSubs = async () => {
    if (
      !confirm(
        "確定要背景同步所有名片的 YouTube 粉絲數嗎？\n(將自動抓取超過24小時未更新，或「格式異常/無法讀取」的名片)",
      )
    )
      return;
    setIsSyncingSubs(true);
    let successCount = 0;
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    const targets = realVtubers.filter((v) => {
      const hasYt = v.youtubeUrl || v.channelUrl;
      if (!hasYt) return false;
      const ytExpired =
        hasYt && now - (v.lastYoutubeFetchTime || 0) > TWENTY_FOUR_HOURS;
      const ytInvalid =
        hasYt &&
        v.youtubeSubscribers &&
        isNaN(parseFloat(String(v.youtubeSubscribers).replace(/,/g, "")));
      return ytExpired || ytInvalid;
    });

    for (const v of realVtubers) {
      if (!v.id.startsWith("mock")) {
        let updates = {};
        if (
          !(v.youtubeUrl || v.channelUrl) &&
          v.youtubeSubscribers &&
          isNaN(parseFloat(String(v.youtubeSubscribers).replace(/,/g, "")))
        )
          updates.youtubeSubscribers = "";
        if (Object.keys(updates).length > 0) {
          await updateDoc(doc(db, getPath("vtubers"), v.id), updates);
          setRealVtubers((prev) =>
            prev.map((rv) => (rv.id === v.id ? { ...rv, ...updates } : rv)),
          );
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
      if (
        ytUrl &&
        (now - (v.lastYoutubeFetchTime || 0) > TWENTY_FOUR_HOURS ||
          isNaN(parseFloat(String(v.youtubeSubscribers).replace(/,/g, ""))))
      ) {
        try {
          const res = await httpsCallable(
            functionsInstance,
            "fetchYouTubeStats",
          )({ url: ytUrl });
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
        } catch (e) { }
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, getPath("vtubers"), v.id), updates);
        setRealVtubers((prev) =>
          prev.map((rv) => (rv.id === v.id ? { ...rv, ...updates } : rv)),
        );
        successCount++;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setSyncProgress("");
    setIsSyncingSubs(false);
    showToast(`✅ YT 同步完成！成功更新/修復 ${successCount} 筆資料。`);
  };

  const handleMigrateBulletinImages = async () => {
    if (!confirm("確定要將「佈告欄」的 Base64 圖片全部轉移到 Storage 嗎？\n這可能會花一點時間喔！")) return;

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
    } catch (error) {
      console.error("轉換佈告欄圖片失敗：", error);
      alert("發生錯誤，請按 F12 去 Console 看一下詳細狀況。");
    }
  };

  const handleMassSyncTwitch = async () => {
    if (
      !confirm(
        "確定要背景同步所有名片的 Twitch 追隨數嗎？\n(將自動抓取超過6小時未更新，或「格式異常/無法讀取」的名片)",
      )
    )
      return;
    setIsSyncingSubs(true);
    let successCount = 0;
    const SIX_HOURS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    const targets = realVtubers.filter((v) => {
      const hasTw = v.twitchUrl;
      if (!hasTw) return false;
      const isOwnAdminCard = isAdmin && v.id === user?.uid;
      const twExpired =
        hasTw &&
        (now - (v.lastTwitchFetchTime || 0) > SIX_HOURS || isOwnAdminCard);
      const twInvalid =
        hasTw &&
        v.twitchFollowers &&
        isNaN(parseFloat(String(v.twitchFollowers).replace(/,/g, "")));
      return twExpired || twInvalid;
    });

    for (const v of realVtubers) {
      if (!v.id.startsWith("mock")) {
        if (
          !v.twitchUrl &&
          v.twitchFollowers &&
          isNaN(parseFloat(String(v.twitchFollowers).replace(/,/g, "")))
        ) {
          await updateDoc(doc(db, getPath("vtubers"), v.id), {
            twitchFollowers: "",
          });
          setRealVtubers((prev) =>
            prev.map((rv) =>
              rv.id === v.id ? { ...rv, twitchFollowers: "" } : rv,
            ),
          );
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
      setSyncProgress(
        `正在同步Twitch ${i + 1} / ${targets.length} : ${v.name}`,
      );

      const twUrl = v.twitchUrl;
      const isOwnAdminCard = isAdmin && v.id === user?.uid;
      if (
        twUrl &&
        (now - (v.lastTwitchFetchTime || 0) > SIX_HOURS ||
          isNaN(parseFloat(String(v.twitchFollowers).replace(/,/g, ""))) ||
          isOwnAdminCard)
      ) {
        try {
          const res = await httpsCallable(
            functionsInstance,
            "fetchTwitchStats",
          )({ url: twUrl });
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
          setRealVtubers((prev) =>
            prev.map((rv) => (rv.id === v.id ? { ...rv, ...updates } : rv)),
          );
          successCount++;
        } catch (e) { }
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
    } catch (err) {
      showToast("發佈失敗");
    }
  };
  const handleDeleteUpdate = async (id) => {
    if (!confirm("確定要刪除這則公告嗎？")) return;
    try {
      await deleteDoc(doc(db, getPath("updates"), id));
      setRealUpdates((prev) => prev.filter((u) => u.id !== id));
      showToast("✅ 已刪除公告");
    } catch (err) {
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
      } else {
        showToast(`❌ 發送失敗：${res.data?.message || "未知錯誤"}`);
      }
    } catch (err) {
      console.error("sendMassEmail error:", err);
      showToast(`❌ 呼叫後端失敗：${err.message}`);
    } finally {
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


  return (
    <AppContext.Provider value={contextValue}>
      <div className="flex flex-col min-h-screen relative">
        {toastMsg && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#181B25] border border-[#8B5CF6] text-white px-6 py-3 rounded-full shadow-sm flex items-center gap-3 font-bold text-sm">
            <i className="fa-solid fa-circle-info text-[#A78BFA]"></i> {toastMsg}
          </div>
        )}

        <nav className="sticky top-0 z-40 backdrop-blur-md bg-[#0F111A]/95 border-b border-[#2A2F3D] shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="h-16 flex items-center justify-between">
              <div
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => navigate("home")}
              >
                <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-lg group-hover:shadow-sm transition-all">
                  <i className="fa-solid fa-wand-magic-sparkles text-white"></i>
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                  V-Nexus
                </span>
              </div>
              <div className="flex items-center gap-3">
                {!user ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleLogin}
                      className="flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-200 px-4 py-1.5 rounded-full transition-colors font-bold text-sm"
                    >
                      <i className="fa-brands fa-google text-[#EF4444]"></i> Google
                      登入
                    </button>
                    <button
                      onClick={handleLoginOther}
                      className="hidden sm:block text-[#94A3B8] hover:text-white text-xs font-bold transition-colors"
                      title="使用其他 Google 帳號"
                    >
                      <i className="fa-solid fa-user-gear mr-1"></i> 切換帳號
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="relative" ref={notifRef}>
                      <button
                        onClick={() => setIsNotifOpen(!isNotifOpen)}
                        className="text-[#CBD5E1] hover:text-white p-2 text-xl relative transition-colors"
                      >
                        <i className="fa-solid fa-bell"></i>
                        {unreadCount > 0 && (
                          <span className="absolute top-1 right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#EF4444] text-[8px] text-white flex items-center justify-center">
                              {unreadCount}
                            </span>
                          </span>
                        )}
                      </button>
                      {isNotifOpen && (
                        // 🌟 完美置中修復：改用 left-0 right-0 mx-auto，徹底避免與 animate-fade-in-up 的 transform 動畫衝突！
                        <div className="fixed left-0 right-0 mx-auto top-16 mt-2 w-[90vw] sm:absolute sm:left-auto sm:right-0 sm:mx-0 sm:w-80 bg-[#0F111A] border border-[#2A2F3D] rounded-2xl shadow-sm z-50 overflow-hidden animate-fade-in-up">
                          <div className="p-3 border-b border-[#2A2F3D] flex justify-between items-center bg-[#181B25]/50">
                            <span className="font-bold text-white text-sm">
                              站內小鈴鐺
                            </span>
                            {unreadCount > 0 && (
                              <button
                                onClick={markAllAsRead}
                                className="text-xs text-[#A78BFA] hover:text-[#C4B5FD]"
                              >
                                全部已讀
                              </button>
                            )}
                          </div>
                          <div className="max-h-80 overflow-y-auto">
                            {myNotifications.length === 0 ? (
                              <div className="p-6 text-center text-[#94A3B8] text-sm">
                                <p className="text-[#F8FAFC] font-bold mb-1">目前沒有新的通知</p>
                                <p>有邀請、私訊或審核結果時，會出現在這裡。</p>
                              </div>
                            ) : (
                              myNotifications.slice(0, 5).map((n) => (
                                <div
                                  key={n.id}
                                  onClick={() => handleNotifClick(n)}
                                  className={`p-3 border-b border-[#2A2F3D] flex gap-3 hover:bg-[#181B25]/50 cursor-pointer transition-colors ${!n.read ? "bg-purple-900/10" : ""}`}
                                >
                                  <img
                                    src={sanitizeUrl(
                                      n.fromUserAvatar ||
                                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Anon",
                                    )}
                                    className="w-10 h-10 rounded-full bg-[#181B25] object-cover flex-shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-[#CBD5E1] leading-snug">
                                      <span className="font-bold text-white hover:text-[#A78BFA] transition-colors">
                                        {n.fromUserName}
                                      </span>{" "}
                                      {n.message}
                                    </p>
                                    {n.type === "brave_invite" && !n.handled && (
                                      <div className="flex gap-2 mt-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleBraveInviteResponse(
                                              n.id,
                                              n.fromUserId,
                                              true,
                                            );
                                          }}
                                          className="flex-1 bg-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E] hover:text-white text-[10px] font-bold py-1 rounded border border-green-600/30 transition-colors"
                                        >
                                          可以試試
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleBraveInviteResponse(
                                              n.id,
                                              n.fromUserId,
                                              false,
                                            );
                                          }}
                                          className="flex-1 bg-[#1D2130]/50 text-[#94A3B8] hover:bg-[#2A2F3D] hover:text-white text-[10px] font-bold py-1 rounded border border-[#2A2F3D]/50 transition-colors"
                                        >
                                          委婉拒絕
                                        </button>
                                      </div>
                                    )}
                                    <p className="text-[10px] text-[#64748B] mt-1">
                                      {formatTime(n.createdAt)}
                                    </p>
                                  </div>
                                  {!n.read && (
                                    <div className="w-2 h-2 rounded-full bg-[#EF4444] mt-1.5 flex-shrink-0"></div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                          <div className="p-2 border-t border-[#2A2F3D] bg-[#181B25]/80 text-center">
                            <button
                              onClick={() => {
                                setIsNotifOpen(false);
                                navigate("inbox");
                              }}
                              className="text-xs text-[#A78BFA] font-bold hover:text-[#C4B5FD] w-full py-1"
                            >
                              打開我的信箱查看完整通知{" "}
                              <i className="fa-solid fa-arrow-right ml-1"></i>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => navigate("dashboard")}
                      className="flex items-center gap-2 bg-[#181B25] hover:bg-[#1D2130] border border-[#2A2F3D] px-3 py-1.5 rounded-full transition-colors relative whitespace-nowrap"
                    >
                      <img
                        src={sanitizeUrl(
                          user.photoURL ||
                          "https://api.dicebear.com/7.x/avataaars/svg?seed=Anon",
                        )}
                        className="w-5 h-5 rounded-full"
                      />
                      <span className="text-[#CBD5E1] text-xs font-bold truncate max-w-[80px] hidden sm:block">
                        {user.displayName || "創作者"}
                      </span>
                      {realVtubers.find(
                        (v) => v.id === user.uid && !v.isVerified,
                      ) && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#EF4444]"></span>
                          </span>
                        )}
                    </button>
                    <button
                      onClick={handleLogout}
                      className="text-[#64748B] hover:text-[#EF4444] text-xs font-bold whitespace-nowrap"
                      title="登出"
                    >
                      <i className="fa-solid fa-right-from-bracket"></i>
                    </button>
                  </div>
                )}
                {isAdmin && (
                  <button onClick={() => navigate('admin')} className={`transition-colors px-3 py-1.5 font-bold text-sm whitespace-nowrap flex items-center ${currentView === 'admin' ? 'text-[#EF4444] border-b-2 border-[#DC2626]' : 'text-[#EF4444]/70 hover:text-[#EF4444]'}`}>
                    <i className="fa-solid fa-shield-halved mr-1"></i> 管理員
                    {(pendingVtubersCount > 0 || realArticles.filter(a => a.status === 'pending').length > 0) && (
                      <span className="bg-[#EF4444] text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                        {pendingVtubersCount + realArticles.filter(a => a.status === 'pending').length}
                      </span>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="lg:hidden text-[#CBD5E1] p-2 text-2xl ml-1"
                >
                  <i
                    className={`fa-solid ${isMobileMenuOpen ? "fa-xmark" : "fa-bars"}`}
                  ></i>
                </button>
              </div>
            </div>
            <div className="hidden lg:flex items-center justify-center gap-4 pb-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
              <button
                onClick={() => navigate("home")}
                className={`transition-colors px-3 py-1.5 font-bold text-sm whitespace-nowrap ${currentView === "home" ? "text-[#A78BFA] border-b-2 border-[#8B5CF6]" : "text-[#94A3B8] hover:text-white"}`}
              >
                首頁介紹
              </button>
              <button
                onClick={() => navigate("grid")}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-full font-bold transition-all text-sm whitespace-nowrap animate-glow-pulse ${currentView === "grid" || currentView === "profile"
                  ? "bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white shadow-sm scale-105 border border-white/30"
                  : "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm hover:shadow-sm"
                  }`}
              >
                <i className="fa-solid fa-magnifying-glass"></i> 尋找 VTuber 夥伴
              </button>
              {/* 🌟 互換：24H火速揪團大廳移到前面 */}
              <button
                onClick={() => navigate("status_wall")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold transition-colors text-sm whitespace-nowrap ${currentView === "status_wall" ? "bg-[#F59E0B] text-[#0F111A] shadow-sm" : "bg-[#F59E0B] text-[#0F111A] hover:bg-[#F59E0B] shadow-md border border-[#F59E0B]/50"}`}
              >
                <i className="fa-solid fa-bolt"></i> 24H動態牆
              </button>

              <button
                onClick={() => navigate("bulletin")} // 直接跳轉
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm whitespace-nowrap ${currentView === "bulletin" ? "bg-rose-500 text-white shadow-sm" : "bg-rose-600 text-white hover:bg-rose-500 shadow-md border border-rose-500/50"}`}
              >
                <i className="fa-solid fa-bullhorn"></i> 揪團佈告欄
                {!isVerifiedUser && <span className="text-[10px] ml-1 opacity-70">(需認證)</span>}
              </button>

              {user && (
                <button
                  onClick={() => navigate("commissions")}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm whitespace-nowrap ${currentView === "commissions" ? "bg-[#38BDF8] text-[#0F111A] shadow-sm scale-105" : "bg-[#38BDF8] text-[#0F111A] hover:bg-[#7DD3FC] shadow-md border border-[#38BDF8]/50"}`}
                >
                  <i className="fa-solid fa-palette"></i> 繪師/建模師/剪輯師委託專區
                </button>
              )}

              <button
                onClick={() => navigate("commission-board")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm whitespace-nowrap ${currentView === "commission-board" ? "bg-[#8B5CF6] text-white shadow-sm scale-105" : "bg-[#8B5CF6] text-white hover:bg-[#7C3AED] shadow-md border border-[#8B5CF6]/50"}`}
              >
                <i className="fa-solid fa-clipboard-list"></i> 委託佈告欄
              </button>
              <button onClick={() => { if (!isVerifiedUser) { showToast("請先認證名片解鎖此功能"); navigate('dashboard'); } else navigate('articles'); }} className={`transition-colors px-3 py-1.5 font-bold text-sm whitespace-nowrap ${currentView === 'articles' ? 'text-[#38BDF8] border-b-2 border-[#38BDF8]' : 'text-[#38BDF8]/70 hover:text-[#38BDF8]'}`}><i className="fa-solid fa-book-open mr-1"></i> Vtuber寶典{!isVerifiedUser && ' 🔒'}</button>
            </div>
          </div>
          {isMobileMenuOpen && (
            <div className="lg:hidden absolute top-16 left-0 w-full bg-[#0F111A]/95 backdrop-blur-md border-b border-[#2A2F3D] shadow-md flex flex-col p-4 gap-4 z-50 animate-fade-in-up">
              <button
                onClick={() => navigate("home")}
                className={`text-left px-4 py-3 rounded-xl font-bold ${currentView === "home" ? "bg-[#8B5CF6] text-white" : "text-[#CBD5E1] hover:bg-[#181B25]"}`}
              >
                首頁介紹
              </button>
              <button
                onClick={() => navigate("grid")}
                className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all ${currentView === "grid" || currentView === "profile"
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm"
                  : "bg-gradient-to-r from-purple-600/90 to-pink-600/90 text-white shadow-sm"
                  }`}
              >
                <i className="fa-solid fa-magnifying-glass w-5"></i> 尋找 VTuber
                夥伴
              </button>
              <button
                onClick={() => navigate("status_wall")}
                className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === "status_wall" ? "bg-[#F59E0B] text-[#0F111A] shadow-sm" : "bg-[#F59E0B] text-[#0F111A] hover:bg-[#F59E0B]"}`}
              >
                <i className="fa-solid fa-bolt w-5"></i> 24H動態牆
              </button>

              <button
                onClick={() => {
                  if (!isVerifiedUser) {
                    showToast("請先認證名片解鎖");
                    navigate("dashboard");
                  } else navigate("bulletin");
                }}
                className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === "bulletin" ? "bg-rose-500 text-white shadow-sm" : "bg-rose-600 text-white hover:bg-rose-500"}`}
              >
                <i className="fa-solid fa-bullhorn w-5"></i> 揪團佈告欄
              </button>

              {user && (
                <button
                  onClick={() => navigate("commissions")}
                  className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === "commissions" ? "bg-[#38BDF8] text-[#0F111A] shadow-sm" : "bg-[#38BDF8] text-[#0F111A] hover:bg-[#7DD3FC]"}`}
                >
                  <i className="fa-solid fa-palette w-5"></i>
                  繪師/建模師/剪輯師委託專區
                </button>
              )}

              <button
                onClick={() => navigate("commission-board")}
                className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === "commission-board" ? "bg-[#8B5CF6] text-white shadow-sm" : "bg-[#8B5CF6] text-white hover:bg-[#7C3AED]"}`}
              >
                <i className="fa-solid fa-clipboard-list w-5"></i> 委託佈告欄
              </button>
              <button onClick={() => { if (!isVerifiedUser) { showToast("請先認證名片解鎖此功能"); navigate('dashboard'); } else navigate('articles'); }} className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === 'articles' ? 'bg-blue-900/50 text-[#38BDF8]' : 'text-[#38BDF8]/70 hover:bg-blue-900/30'}`}><i className="fa-solid fa-book-open w-5"></i> Vtuber寶典{!isVerifiedUser && ' 🔒'}</button>
              {isAdmin && (
                <button onClick={() => navigate('admin')} className={`text-left px-4 py-3 rounded-xl font-bold text-[#EF4444] hover:bg-[#EF4444]/10 flex items-center justify-between`}>
                  <div className="flex items-center gap-3"><i className="fa-solid fa-shield-halved w-5"></i> 系統管理員</div>
                  {(pendingVtubersCount > 0 || realArticles.filter(a => a.status === 'pending').length > 0) && (
                    <span className="bg-[#EF4444] text-white text-[10px] px-2 py-0.5 rounded-full">
                      {pendingVtubersCount + realArticles.filter(a => a.status === 'pending').length}
                    </span>
                  )}
                </button>
              )}

            </div>

          )}

        </nav>

        <main className="flex-1 pb-10">
          {currentView === "home" && (
            <HomePage
              navigate={navigate}
              onOpenRules={() => setIsRulesModalOpen(true)}
              onOpenUpdates={() => setIsUpdatesModalOpen(true)}
              hasUnreadUpdates={hasUnreadUpdates}
              siteStats={siteStats}
              realCollabs={realCollabs}
              displayCollabs={displayCollabs}
              currentTime={currentTime}
              // 這裡改為檢查 realBulletins 是否有資料，來決定統計數字是否顯示轉圈圈
              isLoadingCollabs={realBulletins.length === 0}
              goToBulletin={goToBulletin}
              // 這裡直接傳長度，讓 AnimatedCounter 自己處理 0 到 X 的動畫
              registeredCount={realVtubers.length}
              realVtubers={realVtubers}
              setSelectedVTuber={setSelectedVTuber}
              realBulletins={realBulletins}
              onShowParticipants={(collab) => setViewParticipantsCollab(collab)}
              user={user}
              isVerifiedUser={isVerifiedUser}
              onApply={(id, isApplying) =>
                handleApplyBulletin(
                  id,
                  isApplying,
                  realBulletins.find((b) => b.id === id)?.userId,
                )
              }
              onNavigateProfile={(vt) => {
                setSelectedVTuber(vt);
                navigate(`profile/${vt.id}`);
              }}
              onOpenStoryComposer={() => setIsStoryComposerOpen(true)}
            />
          )}

          {currentView === "inbox" && user && (
            <InboxPage
              notifications={myNotifications}
              markAllAsRead={markAllAsRead}
              onMarkRead={handleMarkNotifRead}
              onDelete={handleDeleteNotif}
              onDeleteAll={handleDeleteAllNotifs}
              onNavigateProfile={handleNotifProfileNav}
              onBraveResponse={handleBraveInviteResponse}
              onOpenChat={handleNotifOpenChat}
            />
          )}

          {currentView === "commissions" && (
            <CommissionPlanningPage
              mode="creators"
              navigate={navigate}
              realVtubers={realVtubers}
              onNavigateProfile={(v) => { setSelectedVTuber(v); navigate(`profile/${v.id}`); }}
              onOpenChat={(v) => {
                if (!user) return showToast("請先登入！");
                if (!isVerifiedUser) return showToast("需通過認證才能發送私訊！");
                setChatTarget(v);
              }}
            />
          )}

          {currentView === "commission-board" && (
            <CommissionPlanningPage
              mode="board"
              navigate={navigate}
              realVtubers={realVtubers}
              onNavigateProfile={(v) => { setSelectedVTuber(v); navigate(`profile/${v.id}`); }}
              onOpenChat={(v) => {
                if (!user) return showToast("請先登入！");
                if (!isVerifiedUser) return showToast("需通過認證才能發送私訊！");
                setChatTarget(v);
              }}
            />
          )}

          {currentView === "dashboard" && (
            <div className="max-w-3xl mx-auto px-4 py-10 animate-fade-in-up">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold text-white flex items-center justify-center gap-3">
                  <i className="fa-solid fa-user-circle text-[#A78BFA]"></i>{" "}
                  創作者中心：編輯名片
                </h2>

                {user && realVtubers.find((v) => v.id === user.uid) ? (
                  realVtubers.find((v) => v.id === user.uid).isVerified ? (
                    <p className="text-[#22C55E] mt-3 text-sm font-bold bg-[#22C55E]/10 inline-block px-4 py-1 rounded-full">
                      <i className="fa-solid fa-circle-check mr-1"></i>{" "}
                      名片已認證上線
                    </p>
                  ) : (
                    <p className="text-[#F59E0B] mt-3 text-sm font-bold bg-[#F59E0B]/10 inline-block px-4 py-1 rounded-full">
                      <i className="fa-solid fa-user-clock mr-1"></i>{" "}
                      名片審核中，通過後將自動公開
                    </p>
                  )
                ) : (
                  <p className="text-[#94A3B8] mt-2">
                    填寫完成後請等待管理員審核，確保社群品質！
                  </p>
                )}

                {/* ▼▼▼ 把推播按鈕移到這裡，並用 flex justify-center 包住讓他置中 ▼▼▼ */}
                <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {myProfile && (
                      <button
                        onClick={() => {
                          setSelectedVTuber(myProfile);
                          navigate(`profile/${myProfile.id}`);
                        }}
                        className="bg-[#8B5CF6] hover:bg-[#8B5CF6] text-white px-5 py-2 rounded-xl text-sm font-bold shadow-sm transition-transform inline-flex items-center gap-2"
                      >
                        <i className="fa-solid fa-eye"></i> 預覽我的公開名片
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleEnableNotifications}
                      className="bg-[#38BDF8] hover:bg-[#38BDF8] text-[#0F111A] px-5 py-2 rounded-xl text-sm font-bold shadow-sm transition-transform inline-flex items-center gap-2"
                    >
                      <i className="fa-solid fa-bell"></i> 啟動手機推播通知
                    </button>

                    {/* ⚠️ 這是你要的測試按鈕 */}
                  </div>
                </div>
                {/* ▲▲▲ 按鈕區塊結束 ▲▲▲ */}
              </div>{" "}
              {/* <-- 注意：這裡才是原本 text-center mb-8 關閉的地方 */}
              <div className="bg-[#181B25]/40 border border-[#2A2F3D] rounded-2xl p-6 sm:p-10 shadow-sm">
                <ProfileEditorForm
                  form={profileForm}
                  updateForm={(updates) =>
                    setProfileForm((prev) => ({ ...prev, ...updates }))
                  }
                  onSubmit={(e) => handleSaveProfile(e)}
                  showToast={showToast}
                  isAdmin={false}
                  user={user}
                  onDeleteSelf={
                    realVtubers.find((v) => v.id === user?.uid)
                      ? handleUserDeleteSelf
                      : null
                  }
                />
              </div>
              {user &&
                myProfile &&
                displayBulletins.filter((b) => b.userId === user.uid).length >
                0 && (
                  <div className="mt-16 animate-fade-in-up">
                    <h3 className="text-2xl font-extrabold text-white mb-6 border-b border-[#2A2F3D] pb-3 flex items-center">
                      <i className="fa-solid fa-bullhorn text-[#A78BFA] mr-3"></i>
                      我的招募管理 (可在此查看誰有意願)
                    </h3>
                    <div className="grid grid-cols-1 gap-6">
                      {displayBulletins
                        .filter((b) => b.userId === user.uid)
                        .map((b) => (
                          <BulletinCard
                            key={b.id}
                            b={b}
                            user={user}
                            isVerifiedUser={isVerifiedUser}
                            onNavigateProfile={(vtuber, isFromApplicants) => {
                              if (vtuber && vtuber.id) {
                                if (isFromApplicants)
                                  setOpenBulletinModalId(b.id);
                                else setOpenBulletinModalId(null);
                                setSelectedVTuber(vtuber);
                                navigate(`profile/${vtuber.id}`);
                              } else {
                                showToast("找不到該名片！");
                              }
                            }}
                            onApply={(id, isApplying) =>
                              handleApplyBulletin(id, isApplying, b.userId)
                            }
                            onInvite={handleOpenCollabModal}
                            onDeleteBulletin={handleDeleteBulletin}
                            onEditBulletin={handleEditBulletin}
                            openModalId={openBulletinModalId}
                            onClearOpenModalId={() =>
                              setOpenBulletinModalId(null)
                            }
                            currentView={currentView}
                          />
                        ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {currentView === "grid" && (
            <div id="vtuber-partner-page-top" className="max-w-7xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8 animate-fade-in-up">
              <aside
                className={`w-full lg:w-72 flex-shrink-0 space-y-6 ${isMobileFilterOpen ? "block" : "hidden lg:block"}`}
              >
                <div className="hidden lg:block relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"></i>
                  <input
                    type="text"
                    placeholder="搜尋 VTuber..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#181B25]/50 border border-[#2A2F3D] rounded-xl py-3 pl-10 pr-4 text-[16px] sm:text-sm text-white outline-none focus:border-[#8B5CF6]"
                  />
                </div>
                <div className="bg-[#181B25]/30 border border-[#2A2F3D] rounded-xl p-5 space-y-5">
                  <h3 className="font-bold border-b border-[#2A2F3D] pb-2 text-[#CBD5E1]">
                    <i className="fa-solid fa-filter mr-2"></i>進階篩選
                  </h3>
                  {/* 手機版專用關鍵字搜尋框 */}
                  <div className="lg:hidden mb-4">
                    <p className="text-xs text-[#64748B] mb-2">
                      關鍵字搜尋 (如: ASMR、歌回、企劃)
                    </p>
                    <div className="relative">
                      <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"></i>
                      <input
                        type="text"
                        placeholder="搜尋名片內任何文字..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#0F111A] border border-[#2A2F3D] rounded-xl py-3 pl-10 pr-4 text-[16px] sm:text-sm text-white outline-none focus:border-[#8B5CF6] shadow-inner"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-[#64748B] mb-2">所屬勢力</p>
                    <div className="grid grid-cols-2 gap-1 bg-[#0F111A] rounded-lg p-1 border border-[#2A2F3D]">
                      {["All", "個人勢", "企業勢", "社團勢", "合作勢"].map(
                        (a) => (
                          <button
                            key={a}
                            onClick={() => setSelectedAgency(a)}
                            className={`w-full py-1.5 text-xs font-bold rounded-md ${selectedAgency === a ? "bg-[#8B5CF6] text-white" : "text-[#94A3B8] hover:text-white"}`}
                          >
                            {a === "All" ? "全部" : a}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-[#64748B] mb-2">主要平台</p>
                    <div className="flex bg-[#0F111A] rounded-lg p-1 border border-[#2A2F3D]">
                      {["All", "YouTube", "Twitch"].map((p) => (
                        <button
                          key={p}
                          onClick={() => setSelectedPlatform(p)}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-md ${selectedPlatform === p ? "bg-[#8B5CF6] text-white" : "text-[#94A3B8]"}`}
                        >
                          {p === "All" ? "全部" : p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-[#64748B] mb-2">國籍</p>
                      <select
                        value={selectedNationality} // 語言、時段、色系也一樣
                        onChange={(e) => setSelectedNationality(e.target.value)}
                        className="w-full bg-[#0F111A] border border-[#2A2F3D] rounded-lg p-2 text-white text-[16px] sm:text-xs outline-none font-normal"
                      >
                        {dynamicNationalities.map((n) => (
                          <option key={n} value={n}>
                            {n === "All" ? "全部" : n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B] mb-2">主要語言</p>
                      <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="w-full bg-[#0F111A] border border-[#2A2F3D] rounded-lg p-2 text-white text-[16px] sm:text-xs outline-none font-normal"
                      >
                        {dynamicLanguages.map((l) => (
                          <option key={l} value={l}>
                            {l === "All" ? "全部" : l}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-[#64748B] mb-2">可聯動時段</p>
                    <select
                      value={selectedSchedule}
                      onChange={(e) => setSelectedSchedule(e.target.value)}
                      className="w-full bg-[#0F111A] border border-[#2A2F3D] rounded-lg p-2 text-white text-[16px] sm:text-xs outline-none font-normal"
                    >
                      {dynamicSchedules.map((d) => (
                        // 🌟 優化：加上 bg-[#0F111A] text-white
                        <option key={d} value={d} className="bg-[#0F111A] text-white">
                          {d === "All" ? "全部" : d}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* 新增：色系篩選 */}
                  <div>
                    <p className="text-xs text-[#64748B] mb-2">代表色系</p>
                    <select
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="w-full bg-[#0F111A] border border-[#2A2F3D] rounded-lg p-2 text-white text-[16px] sm:text-xs outline-none font-normal"
                    >
                      {/* 🌟 優化：加上 bg-[#0F111A] text-white */}
                      <option value="All" className="bg-[#0F111A] text-white">全部色系</option>
                      {COLOR_OPTIONS.map((c) => (
                        <option key={c} value={c} className="bg-[#0F111A] text-white">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="text-xs text-[#64748B] mb-2">星座</p>
                    <select
                      value={selectedZodiac}
                      onChange={(e) => setSelectedZodiac(e.target.value)}
                      className="w-full bg-[#0F111A] border border-[#2A2F3D] rounded-lg p-2 text-white text-[16px] sm:text-xs outline-none font-normal"
                    >
                      <option value="All" className="bg-[#0F111A] text-white">全部星座</option>
                      {ZODIAC_SIGNS.map((z) => (
                        <option key={z} value={z} className="bg-[#0F111A] text-white">
                          {z}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <p className="w-full text-xs text-[#64748B] mb-1">
                      想找什麼聯動？
                    </p>
                    {dynamicCollabTypes.map((tag) => (
                      <TagBadge
                        key={tag}
                        text={tag}
                        selected={selectedTags.includes(tag)}
                        onClick={() => toggleTag(tag)}
                      />
                    ))}
                  </div>
                </div>
              </aside>
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-start sm:items-center justify-between gap-4 mb-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      尋找 VTuber 夥伴{" "}
                      {user &&
                        realVtubers.find(
                          (v) =>
                            v.id === user.uid &&
                            (!v.isVerified ||
                              v.isBlacklisted ||
                              v.activityStatus !== "active"),
                        ) && (
                          <span className="text-xs font-normal text-[#F59E0B] bg-[#F59E0B]/10 px-3 py-1 rounded-full">
                            <i className="fa-solid fa-eye-slash mr-1"></i>隱藏中
                          </span>
                        )}
                    </h2>
                    <button
                      onClick={() => setIsTipsModalOpen(true)}
                      className="bg-[#F59E0B]/10 text-[#F59E0B] px-3 py-1.5 rounded-lg text-sm font-bold"
                    >
                      <i className="fa-solid fa-lightbulb"></i> 邀約小技巧
                    </button>
                    <button
                      onClick={() => {
                        // 🌟 修正：如果目前是「最契合夥伴」，就維持原樣只洗牌；否則才切換到「隨機排列」
                        if (sortOrder !== "compatibility" && sortOrder !== "random") {
                          setSortOrder("random");
                        }
                        // 更新種子觸發重新計算
                        setShuffleSeed(Date.now());
                        // 回到頁面頂端，讓使用者看到變化
                        window.scrollTo({ top: 0, behavior: "smooth" });
                        showToast("🎲 已重新洗牌名片順序！");
                      }}
                      className="bg-[#8B5CF6]/10 text-[#A78BFA] hover:bg-[#8B5CF6] hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-all border border-[#8B5CF6]/20"
                    >
                      <i className="fa-solid fa-shuffle mr-1"></i> 重新洗牌
                    </button>

                    {/* 🌟 新增：將聯動隨機配對按鈕移到這裡 */}
                    <button
                      onClick={() => {
                        if (!isVerifiedUser) {
                          showToast("請先認證名片解鎖功能");
                          navigate("dashboard");
                        } else {
                          navigate("match");
                        }
                      }}
                      className="bg-pink-500/10 text-pink-400 hover:bg-pink-500 hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-all border border-pink-500/20"
                    >
                      <i className="fa-solid fa-dice mr-1"></i> 聯動隨機配對 {!isVerifiedUser && " 🔒"}
                    </button>

                    <button onClick={() => navigate('blacklist')} className="bg-[#3B171D]/50 text-[#EF4444] hover:bg-[#EF4444] hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-all border border-[#EF4444]/50">
                      <i className="fa-solid fa-ban mr-1"></i> 黑單避雷區
                    </button>
                    <button
                      onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                      className="lg:hidden bg-[#181B25] hover:bg-[#1D2130] border border-[#2A2F3D] text-[#CBD5E1] hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <i className="fa-solid fa-filter"></i> 篩選
                    </button>
                  </div>
                  <div className="flex flex-col gap-3 w-full sm:w-auto">
                    <div className="block lg:hidden relative w-full">
                      <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"></i>
                      <input
                        type="text"
                        placeholder="搜尋 VTuber..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#181B25]/50 border border-[#2A2F3D] rounded-xl py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-[#8B5CF6]"
                      />
                    </div>
                    <select
                      value={sortOrder}
                      onChange={(e) => {
                        setSortOrder(e.target.value);
                        // 當選擇「隨機排列」或「最契合夥伴」時，順便更新種子，確保每次切換都能重新洗牌！
                        if (e.target.value === "random" || e.target.value === "compatibility") {
                          setShuffleSeed(Date.now());
                        }
                      }}
                      className="bg-[#181B25] border border-[#2A2F3D] rounded-xl p-2.5 text-[16px] sm:text-sm text-white focus:ring-2 focus:ring-[#8B5CF6] outline-none w-full sm:w-auto"
                    >
                      <option value="newest">✨ 最近動態 (直播中/更新)</option>

                      {/* 🌟 修改：只有登入的使用者才看得到「最契合夥伴」選項 */}
                      {user && (
                        <option value="compatibility">💖 最契合夥伴</option>
                      )}

                      <option value="random">🔀 隨機排列</option>
                      <option value="likes">👍 最推薦</option>
                      <option value="subscribers">📺 最多訂閱</option>
                    </select>
                  </div>
                </div>
                {isLoading ? (
                  <div className="text-center text-[#64748B] py-10">
                    <i className="fa-solid fa-spinner fa-spin text-2xl"></i>
                  </div>
                ) : filteredVTubers.length === 0 ? (
                  <p className="text-center text-[#64748B] mt-20">
                    目前無公開名片
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {paginatedVTubers.map((v) => (
                        <VTuberCard
                          key={v.id}
                          v={v}
                          user={user}
                          isVerifiedUser={isVerifiedUser}
                          onSelect={() => {
                            setSelectedVTuber(v);
                            navigate(`profile/${v.id}`);
                          }}
                          onDislike={() => handleInitiateDislike(v)}
                        />
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex flex-wrap justify-center items-center gap-4 mt-12 animate-fade-in-up">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className={`px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center ${currentPage === 1 ? "bg-[#181B25]/50 text-gray-600 cursor-not-allowed border border-[#2A2F3D]" : "bg-[#181B25] hover:bg-[#8B5CF6] text-white border border-[#2A2F3D] hover:border-[#8B5CF6]"}`}
                        >
                          <i className="fa-solid fa-chevron-left mr-2"></i> 上一頁
                        </button>
                        <div className="flex items-center gap-2 text-[#CBD5E1] font-bold bg-[#0F111A]/50 px-4 py-2.5 rounded-xl border border-[#2A2F3D]">
                          <span>第</span>
                          <select
                            value={currentPage}
                            onChange={(e) =>
                              handlePageChange(Number(e.target.value))
                            }
                            className="bg-[#181B25] border border-[#2A2F3D] rounded-lg px-2 py-1 text-white outline-none cursor-pointer"
                          >
                            {[...Array(totalPages).keys()].map((n) => (
                              <option key={n + 1} value={n + 1}>
                                {n + 1}
                              </option>
                            ))}
                          </select>
                          <span>/ {totalPages} 頁</span>
                        </div>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className={`px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center ${currentPage === totalPages ? "bg-[#181B25]/50 text-gray-600 cursor-not-allowed border border-[#2A2F3D]" : "bg-[#181B25] hover:bg-[#8B5CF6] text-white border border-[#2A2F3D] hover:border-[#8B5CF6]"}`}
                        >
                          下一頁{" "}
                          <i className="fa-solid fa-chevron-right ml-2"></i>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {currentView === "profile" && !selectedVTuber && isLoading && (
            <div className="max-w-4xl mx-auto px-4 py-20 text-center animate-fade-in-up">
              <i className="fa-solid fa-spinner fa-spin text-4xl text-[#8B5CF6] mb-4"></i>
              <p className="text-[#94A3B8] font-bold text-lg">載入專屬名片中...</p>
            </div>
          )}

          {currentView === "profile" && selectedVTuber && (
            <div className="bg-transparent text-slate-200 font-sans p-3 sm:p-5 min-h-screen w-full">
              <div className="max-w-4xl mx-auto animate-fade-in-up">

                {/* 頂部導航 */}
                <button
                  onClick={() => {
                    if (viewParticipantsCollab || openBulletinModalId) {
                      navigate(previousView || "home", true);
                    } else {
                      const target = previousView === "profile" ? "grid" : previousView || "grid";
                      navigate(target, true);
                    }
                    setTimeout(() => { window.scrollTo(0, gridScrollY.current); }, 50);
                  }}
                  className="group flex items-center gap-2 text-slate-400 hover:text-white mb-4 text-xs font-medium transition-all duration-300 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full w-fit backdrop-blur-md ring-1 ring-white/10"
                >
                  <i className="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
                  <span>
                    {viewParticipantsCollab ? "返回聯動參與人員"
                      : openBulletinModalId ? "看看其他有意願的Vtuber"
                        : previousView === "bulletin" ? "返回佈告欄"
                          : previousView === "collabs" ? "返回聯動表"
                            : previousView === "inbox" ? "返回我的信箱"
                              : previousView === "home" ? "返回首頁"
                                : previousView === "match" ? "返回配對"
                                  : "返回探索"}
                  </span>
                </button>

                {/* 主名片容器 (縮小整體圓角與陰影) */}
                <div className="bg-[#181B25] rounded-2xl overflow-hidden border border-[#2A2F3D] shadow-sm relative z-10">

                  {/* Banner 區域 (高度縮減) */}
                  <div className="h-36 sm:h-52 relative group bg-[#11131C]">
                    <LazyImage
                      src={sanitizeUrl(selectedVTuber.banner)}
                      containerCls="absolute inset-0 w-full h-full opacity-70"
                    />
                    {/* 質感漸層遮罩 */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#181B25]/30 to-[#181B25] z-10"></div>

                    {/* 網點裝飾 */}
                    <div className="hidden" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                    {/* 右上角平台標籤 (改為可點擊連結) */}
                    <div className="absolute top-4 right-4 z-20 flex gap-2">
                      <a
                        href={sanitizeUrl(selectedVTuber.mainPlatform === "Twitch" ? selectedVTuber.twitchUrl : selectedVTuber.youtubeUrl) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-white text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-xl ring-1 ring-white/20 shadow-md transition-all ${selectedVTuber.mainPlatform === "Twitch" ? "bg-[#8B5CF6]/80 hover:bg-[#8B5CF6]/90 shadow-sm" : "bg-[#EF4444]/80 hover:bg-[#EF4444]/90 shadow-sm"}`}
                      >
                        <i className={`fa-brands fa-${selectedVTuber.mainPlatform === "Twitch" ? "twitch" : "youtube"}`}></i>
                        主要直播平台: {selectedVTuber.mainPlatform || "YouTube"}
                        <i className="fa-solid fa-arrow-up-right-from-square ml-1 text-[10px] opacity-70"></i>
                      </a>
                    </div>
                  </div>

                  {/* 內容區域 (Padding與Margin收斂) */}
                  <div className="px-5 sm:px-8 pb-8 relative z-20 -mt-14 sm:-mt-16">

                    {/* 頭像與主要操作列 */}
                    <div className="flex flex-col sm:flex-row gap-5 sm:items-end justify-between mb-5">

                      <div className="flex items-end gap-4 min-w-0">
                        <div className="relative flex-shrink-0">
                          {/* 頭像 (尺寸適度放大，增強角色存在感) */}
                          <div className="p-2 bg-[#181B25] rounded-2xl border border-[#2A2F3D] shadow-sm inline-block relative z-20">
                            <LazyImage
                              src={sanitizeUrl(selectedVTuber.avatar)}
                              containerCls="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-[#11131C] flex-shrink-0 relative overflow-hidden"
                            />
                          </div>
                          {/* 在線狀態圓點 (配合放大的頭像微調位置與大小) */}
                          {onlineUsers?.has(selectedVTuber.id) && (
                            <div className="absolute bottom-3 -right-1 z-30 bg-[#181B25] rounded-full p-1 border border-[#2A2F3D] shadow-sm">
                              <div className="w-3.5 h-3.5 bg-green-400 rounded-full shadow-sm"></div>
                            </div>
                          )}
                        </div>

                        {/* 社群連結：固定單排顯示，避免按鈕跳排造成版面不整齊 */}
                        <div className="flex flex-nowrap items-center gap-2 pb-2 max-w-full sm:max-w-[360px] overflow-x-auto whitespace-nowrap custom-scrollbar">
                          {(selectedVTuber.youtubeUrl || selectedVTuber.youtubeSubscribers || selectedVTuber.subscribers) && (
                            <a href={sanitizeUrl(selectedVTuber.youtubeUrl || '#')} target="_blank" rel="noopener noreferrer"
                              className="flex-shrink-0 flex items-center justify-center gap-1.5 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] px-3 h-9 rounded-lg text-xs font-bold transition-colors border border-[#EF4444]/20"
                              title="YouTube">
                              <i className="fa-brands fa-youtube text-base"></i>
                              <span className="hidden sm:inline">YouTube</span>
                              {formatSocialCount(selectedVTuber.youtubeSubscribers || selectedVTuber.subscribers) && (
                                <span className="text-[11px] text-[#FCA5A5] font-semibold border-l border-[#EF4444]/25 pl-1.5">
                                  {formatSocialCount(selectedVTuber.youtubeSubscribers || selectedVTuber.subscribers)}
                                </span>
                              )}
                            </a>
                          )}
                          {(selectedVTuber.twitchUrl || selectedVTuber.twitchFollowers) && (
                            <a href={sanitizeUrl(selectedVTuber.twitchUrl || '#')} target="_blank" rel="noopener noreferrer"
                              className="flex-shrink-0 flex items-center justify-center gap-1.5 bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-[#A78BFA] px-3 h-9 rounded-lg text-xs font-bold transition-colors border border-[#8B5CF6]/20"
                              title="Twitch">
                              <i className="fa-brands fa-twitch text-base"></i>
                              <span className="hidden sm:inline">Twitch</span>
                              {formatSocialCount(selectedVTuber.twitchFollowers) && (
                                <span className="text-[11px] text-[#C4B5FD] font-semibold border-l border-[#8B5CF6]/25 pl-1.5">
                                  {formatSocialCount(selectedVTuber.twitchFollowers)}
                                </span>
                              )}
                            </a>
                          )}
                          {selectedVTuber.xUrl && (
                            <a href={sanitizeUrl(selectedVTuber.xUrl)} target="_blank" rel="noopener noreferrer"
                              className="flex-shrink-0 flex items-center justify-center w-9 h-9 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg transition-colors border border-white/10"
                              title="X / Twitter">
                              <i className="fa-brands fa-x-twitter text-base"></i>
                            </a>
                          )}
                          {selectedVTuber.igUrl && (
                            <a href={sanitizeUrl(selectedVTuber.igUrl)} target="_blank" rel="noopener noreferrer"
                              className="flex-shrink-0 flex items-center justify-center w-9 h-9 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 rounded-lg transition-colors border border-pink-500/20"
                              title="Instagram">
                              <i className="fa-brands fa-instagram text-base"></i>
                            </a>
                          )}
                        </div>
                      </div>

                      {/* 核心聯動/操作按鈕群 (修正跳行問題：移除 flex-wrap，微調手機版間距與字體) */}
                      <div className="flex gap-2 sm:gap-3 items-center w-full sm:w-auto pb-1">
                        {isVerifiedUser && selectedVTuber.id !== user?.uid && (
                          <>
                            <button
                              onClick={() => setChatTarget(selectedVTuber)}
                              className="flex-1 sm:flex-none bg-[#1D2130] hover:bg-[#2A2F3D] text-[#F8FAFC] px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors border border-[#2A2F3D] flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap"
                            >
                              <i className="fa-regular fa-comment-dots text-cyan-400"></i>
                              私訊聊聊
                            </button>
                            <button
                              onClick={() => handleBraveInvite(selectedVTuber)}
                              className="flex-1 sm:flex-none bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-pink-500/30 transition-colors flex items-center justify-center gap-1 sm:gap-1.5 group whitespace-nowrap"
                            >
                              <i className="fa-solid fa-heart group-hover:scale-[1.01] transition-transform text-white"></i>
                              勇敢邀請
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isVerifiedUser && selectedVTuber.id !== user?.uid && (
                      <div className="mb-5 bg-[#8B5CF6]/10 border border-[#8B5CF6]/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <p className="text-[#F8FAFC] font-bold text-sm">想一起直播或發起企劃嗎？</p>
                          <p className="text-[#94A3B8] text-xs mt-1">先看聯動類型與可約時段，適合就直接送出邀請。</p>
                        </div>
                        <button onClick={() => handleOpenCollabModal(selectedVTuber)} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm whitespace-nowrap">
                          邀請他聯動
                        </button>
                      </div>
                    )}

                    {/* 名稱與社群資料列 (間距與字體壓縮) */}
                    <div className="flex flex-col lg:flex-row justify-between items-start gap-5 mb-5 pb-5 border-b border-[#2A2F3D]">

                      {/* 左側：名字與屬性 */}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <h1 className="text-2xl sm:text-4xl font-black text-[#F8FAFC] tracking-tight flex items-center gap-3">
                            {selectedVTuber.name}
                            {selectedVTuber.isVerified && (
                              <i className="fa-solid fa-circle-check text-[#22C55E] text-2xl drop-shadow-sm"></i>
                            )}
                          </h1>
                        </div>

                        {/* 屬性標籤 */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium text-slate-400">
                          {selectedVTuber.agency && (
                            <span className="flex items-center gap-1.5 text-slate-200">
                              <i className="fa-solid fa-building opacity-50"></i>{selectedVTuber.agency}
                            </span>
                          )}

                          {Array.isArray(selectedVTuber.creatorRoles) && selectedVTuber.creatorRoles.length > 0 && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                              <span className="inline-flex items-center gap-1.5 flex-wrap">
                                {selectedVTuber.creatorRoles.map((role) => (
                                  <span
                                    key={role}
                                    className="inline-flex items-center rounded-full bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/25 px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap"
                                  >
                                    {role}
                                  </span>
                                ))}
                              </span>
                            </>
                          )}

                          {(selectedVTuber.nationalities?.length > 0 || selectedVTuber.nationality) && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                              <span className="flex items-center gap-1.5">
                                <i className="fa-solid fa-earth-asia opacity-50"></i>
                                {(selectedVTuber.nationalities?.length > 0 ? selectedVTuber.nationalities : [selectedVTuber.nationality]).join(", ")}
                              </span>
                            </>
                          )}

                          {(selectedVTuber.languages?.length > 0 || selectedVTuber.language) && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                              <span className="flex items-center gap-1.5">
                                <i className="fa-solid fa-language opacity-50"></i>
                                {(selectedVTuber.languages?.length > 0 ? selectedVTuber.languages : [selectedVTuber.language]).join(", ")}
                              </span>
                            </>
                          )}

                          {selectedVTuber.personalityType && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                              <span className="flex items-center gap-1.5">
                                <i className="fa-solid fa-brain text-violet-400/70"></i>{selectedVTuber.personalityType}
                              </span>
                            </>
                          )}

                          {selectedVTuber.colorSchemes && selectedVTuber.colorSchemes.length > 0 && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                              <span className="flex items-center gap-1.5">
                                <i className="fa-solid fa-palette opacity-50"></i>{selectedVTuber.colorSchemes.join(", ")}系
                              </span>
                            </>
                          )}

                        </div>
                      </div>

                      <div className="w-full lg:w-auto lg:self-start flex justify-end">
                        <div className="inline-flex items-center gap-2 bg-[#11131C]/80 border border-[#2A2F3D] rounded-xl p-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isVerifiedUser && selectedVTuber.id !== user?.uid) handleRecommend(selectedVTuber);
                            }}
                            className="inline-flex items-center gap-1.5 bg-[#22C55E]/10 hover:bg-[#22C55E]/20 text-[#22C55E] px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors border border-[#22C55E]/20 whitespace-nowrap"
                            title="推薦這張名片"
                          >
                            <i className="fa-solid fa-thumbs-up text-[10px]"></i>
                            {selectedVTuber.likes || 0} 推薦
                          </button>
                          {isVerifiedUser && selectedVTuber.id !== user?.uid && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInitiateDislike(selectedVTuber);
                              }}
                              className="inline-flex items-center gap-1.5 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors border border-[#EF4444]/20 whitespace-nowrap"
                              title="送出倒讚"
                            >
                              <i className="fa-solid fa-thumbs-down text-[10px]"></i>
                              {selectedVTuber.dislikes || 0}
                            </button>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* 限時動態 (高度縮減，間距收緊) */}
                    {/* 一眼看懂：降低詳細名片資訊雜亂感 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                      <div className="bg-[#1D2130] border border-[#2A2F3D] rounded-2xl p-4">
                        <p className="text-[11px] text-[#94A3B8] font-bold mb-1">目前狀態</p>
                        <p className={`text-sm font-bold ${selectedVTuber.activityStatus === "sleep" ? "text-[#F59E0B]" : selectedVTuber.activityStatus === "graduated" ? "text-[#94A3B8]" : selectedVTuber.activityStatus === "creator" ? "text-[#38BDF8]" : "text-[#22C55E]"}`}>
                          {selectedVTuber.activityStatus === "sleep" ? "🌙 暫時休息" : selectedVTuber.activityStatus === "graduated" ? "🕊️ 已畢業" : selectedVTuber.activityStatus === "creator" ? "🎨 繪師 / 建模師 / 剪輯師" : "🟢 開放聯動"}
                        </p>
                      </div>
                      <div className="bg-[#1D2130] border border-[#2A2F3D] rounded-2xl p-4">
                        <p className="text-[11px] text-[#94A3B8] font-bold mb-1">適合一起做</p>
                        <p className="text-sm text-[#F8FAFC] font-bold truncate">{(selectedVTuber.collabTypes || []).slice(0, 2).join("、") || "尚未填寫"}</p>
                      </div>
                      <div className="bg-[#1D2130] border border-[#2A2F3D] rounded-2xl p-4">
                        <p className="text-[11px] text-[#94A3B8] font-bold mb-1">主要平台</p>
                        <p className="text-sm text-[#38BDF8] font-bold">{selectedVTuber.mainPlatform || "YouTube"}</p>
                      </div>
                      <div className="bg-[#1D2130] border border-[#2A2F3D] rounded-2xl p-4">
                        <p className="text-[11px] text-[#94A3B8] font-bold mb-1">可約時段</p>
                        <p className="text-sm text-[#F8FAFC] font-bold line-clamp-1">{formatSchedule(selectedVTuber) || "尚未提供"}</p>
                      </div>
                    </div>

                    {selectedVTuber.statusMessage && selectedVTuber.statusMessageUpdatedAt &&
                      (Date.now() - selectedVTuber.statusMessageUpdatedAt < (selectedVTuber.statusMessage.includes('🔴') ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)) && (
                        <div className={`mb-6 relative overflow-hidden rounded-2xl p-4 flex items-center gap-4 ${selectedVTuber.statusMessage.includes('🔴') ? 'bg-[#EF4444]/10 ring-1 ring-red-500/30' : 'bg-[#F59E0B]/10 ring-1 ring-orange-500/30'} backdrop-blur-sm`}>
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${selectedVTuber.statusMessage.includes('🔴') ? 'bg-[#EF4444] shadow-sm' : 'bg-[#F59E0B] shadow-sm'}`}></div>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${selectedVTuber.statusMessage.includes('🔴') ? 'bg-[#EF4444]/20 text-[#EF4444]' : 'bg-[#F59E0B]/20 text-[#F59E0B]'}`}>
                            <i className={`fa-solid text-lg ${selectedVTuber.statusMessage.includes('🔴') ? 'fa-satellite-dish' : 'fa-comment-dots'}`}></i>
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] sm:text-xs text-slate-400 mb-0.5 uppercase tracking-wider font-semibold">
                              {selectedVTuber.statusMessage.includes('🔴') ? 'LIVE ON AIR' : '24H限時動態'}
                            </p>
                            <p className={`text-sm sm:text-base font-medium ${selectedVTuber.statusMessage.includes('🔴') ? 'text-red-100' : 'text-orange-100'}`}>
                              {selectedVTuber.statusMessage}
                            </p>
                          </div>
                        </div>
                      )}

                    {/* 詳細資訊 Grid (間距 gap-8 縮小至 gap-6) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                      {/* 左側：關於他與標籤 */}
                      <div className="lg:col-span-2 space-y-5">

                        {/* 關於他卡片 (內部 Padding 縮小) */}
                        <div className="bg-[#1D2130] rounded-2xl p-5 sm:p-7 border border-[#2A2F3D] relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>

                          <div className="relative z-10">
                            <div className="flex flex-wrap justify-between items-center mb-5 gap-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400">
                                  <i className="fa-solid fa-address-card text-base"></i>
                                </div>
                                <h3 className="text-xl font-bold text-white tracking-wide">我是誰</h3>
                                {selectedVTuber.zodiacSign && (
                                  <span className="bg-[#F59E0B]/10 text-[#F59E0B] px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold ring-1 ring-yellow-500/40 flex items-center gap-1.5">
                                    <i className="fa-solid fa-star text-[10px] text-[#F59E0B] drop-shadow-sm"></i> {selectedVTuber.zodiacSign}
                                  </span>
                                )}
                                {selectedVTuber.streamStyleUrl && (
                                  <a href={sanitizeUrl(selectedVTuber.streamStyleUrl)} target="_blank" rel="noopener noreferrer"
                                    className="bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 text-[#38BDF8] hover:text-[#7DD3FC] px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold transition-all ring-1 ring-blue-500/40 flex items-center gap-1.5 ml-1">
                                    <i className="fa-solid fa-video"></i> 觀看我的直播風格
                                  </a>
                                )}
                              </div>

                              <button
                                onClick={() => {
                                  const identifier = selectedVTuber.slug || selectedVTuber.id;
                                  const url = window.location.origin + window.location.pathname + "#profile/" + identifier;
                                  navigator.clipboard.writeText(url);
                                  showToast("✅ 已複製專屬名片連結！");
                                }}
                                className="group flex items-center gap-1.5 text-slate-400 hover:text-cyan-400 text-xs font-medium transition-colors"
                              >
                                <i className="fa-solid fa-link group-hover:rotate-45 transition-transform"></i>
                                複製我的專屬連結
                              </button>
                            </div>

                            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
                              {selectedVTuber.description || "這位 VTuber 還沒有留下自我介紹喔！"}
                            </p>
                          </div>
                        </div>

                        {/* 內容標籤卡片 */}
                        {selectedVTuber.tags && selectedVTuber.tags.length > 0 && (
                          <div className="bg-[#1D2130] rounded-2xl p-5 sm:p-7 border border-[#2A2F3D]">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                                <i className="fa-solid fa-hashtag text-base"></i>
                              </div>
                              <h3 className="text-xl font-bold text-white tracking-wide">我的喜好</h3>
                            </div>
                            {/* 標籤微縮 */}
                            <div className="flex flex-wrap gap-2">
                              {selectedVTuber.tags.map((t) => (
                                <span key={t} className="px-2.5 py-1 bg-white/[0.03] hover:bg-cyan-500/10 transition-colors rounded-md text-[11px] sm:text-xs font-medium text-slate-300 ring-1 ring-white/10 hover:ring-cyan-500/30 cursor-default">
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>

                      {/* 右側：聯動情報 */}
                      <div className="space-y-5">

                        {/* 創作型態 & 聯動意願 */}
                        <div className="bg-[#1D2130] rounded-2xl p-5 sm:p-7 border border-[#2A2F3D] relative overflow-hidden">
                          <div className="relative z-10 space-y-6">
                            <div>
                              <h4 className="font-bold text-violet-300 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
                                <i className="fa-solid fa-display"></i> 創作型態
                              </h4>
                              <p className="text-slate-200 text-base font-medium">
                                {selectedVTuber.streamingStyle || "一般型態"}
                              </p>
                            </div>

                            <div>
                              <h4 className="font-bold text-cyan-300 mb-3 flex items-center gap-2 text-xs uppercase tracking-wider">
                                <i className="fa-solid fa-people-group"></i> 適合一起做的內容
                              </h4>
                              <div className="flex flex-col gap-2">
                                {(selectedVTuber.collabTypes || []).length > 0 ? (
                                  selectedVTuber.collabTypes.map((t) => (
                                    <div key={t} className="bg-white/5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 flex items-center gap-2.5">
                                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm"></div>
                                      {t}
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-xs text-slate-400">尚未填寫</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 時段卡片 */}
                        <div className="bg-[#1D2130] rounded-2xl p-5 sm:p-7 border border-[#2A2F3D]">
                          <h4 className="font-bold text-amber-300/80 mb-3 flex items-center gap-2 text-xs uppercase tracking-wider">
                            <i className="fa-regular fa-calendar-check"></i> 可聯動時段
                          </h4>
                          <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                            {formatSchedule(selectedVTuber) || "尚未提供"}
                          </div>
                        </div>

                      </div>
                    </div>

                    {(Array.isArray(selectedVTuber.creatorRoles) && selectedVTuber.creatorRoles.length > 0) && (
                      <div className="mt-6 bg-gradient-to-br from-[#0B2A3A] via-[#10213F] to-[#24124A] rounded-2xl p-5 sm:p-7 border border-[#38BDF8]/45 shadow-lg shadow-[#38BDF8]/10 relative overflow-hidden">
                        <div className="absolute -right-16 -top-16 w-52 h-52 bg-[#38BDF8]/10 blur-3xl rounded-full"></div>
                        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-11 h-11 rounded-2xl bg-[#38BDF8]/20 border border-[#38BDF8]/35 flex items-center justify-center text-[#7DD3FC]">
                                <i className="fa-solid fa-palette text-lg"></i>
                              </div>
                              <div>
                                <p className="text-xs font-extrabold tracking-[0.18em] uppercase text-[#7DD3FC]">Creator Service</p>
                                <h3 className="text-2xl font-black text-white tracking-wide">創作服務專區</h3>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-4">
                              {(selectedVTuber.creatorRoles || []).map((role) => <span key={role} className="bg-[#38BDF8]/15 border border-[#38BDF8]/35 text-[#BAE6FD] px-3 py-1.5 rounded-full text-xs font-extrabold">{role}</span>)}
                              {selectedVTuber.creatorStatus && <span className="bg-[#22C55E]/15 border border-[#22C55E]/35 text-[#86EFAC] px-3 py-1.5 rounded-full text-xs font-extrabold">{selectedVTuber.creatorStatus}</span>}
                              {selectedVTuber.creatorBudgetRange && <span className="bg-[#F59E0B]/15 border border-[#F59E0B]/35 text-[#FBBF24] px-3 py-1.5 rounded-full text-xs font-extrabold">{normalizeCreatorBudgetRange(selectedVTuber.creatorBudgetRange)}</span>}
                            </div>
                            {(selectedVTuber.creatorStyles || []).length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {(selectedVTuber.creatorStyles || []).map((style) => <span key={style} className="bg-[#08111F]/70 border border-white/10 text-[#E0F2FE] px-2.5 py-1 rounded-full text-xs font-bold">{style === "其他(自由填寫)" && selectedVTuber.creatorOtherStyleText ? selectedVTuber.creatorOtherStyleText : style}</span>)}
                              </div>
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            {selectedVTuber.creatorPortfolioUrl ? (
                              <button onClick={() => window.open(sanitizeUrl(/^https?:\/\//i.test(selectedVTuber.creatorPortfolioUrl) ? selectedVTuber.creatorPortfolioUrl : "https://" + selectedVTuber.creatorPortfolioUrl), "_blank", "noopener,noreferrer")} className="w-full lg:w-auto inline-flex items-center justify-center gap-2 bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#0F111A] px-6 py-3 rounded-xl font-black text-sm transition-colors shadow-lg shadow-[#38BDF8]/20">
                                <i className="fa-solid fa-images"></i> 觀看作品集
                              </button>
                            ) : (
                              <p className="text-sm text-[#BAE6FD] bg-[#08111F]/60 border border-white/10 rounded-xl px-4 py-3">尚未提供作品集連結，可先用站內私訊詢問委託資訊。</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentView === "bulletin" && (
            <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in-up">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                  <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
                    <i className="fa-solid fa-bullhorn text-[#A78BFA]"></i>
                    揪團佈告欄
                  </h2>
                  <p className="text-[#94A3B8] mt-2 text-xs sm:text-sm leading-relaxed max-w-3xl">
                    發布揪團、找合適的聯動夥伴。
                    <span className="text-[#F59E0B] font-bold ml-2">揪團截止前，請到信箱發送正式邀請才算成功。</span>
                  </p>
                </div>
                <div className="flex flex-row flex-wrap sm:flex-nowrap gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => {
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
                    }}
                    className={`${isBulletinFormOpen ? "bg-[#1D2130]" : "bg-[#8B5CF6] hover:bg-[#7C3AED]"} text-white px-4 sm:px-6 py-3 rounded-xl font-bold shadow-sm flex items-center justify-center transition-colors whitespace-nowrap`}
                  >
                    <i
                      className={`fa-solid ${isBulletinFormOpen ? "fa-chevron-up" : "fa-pen-nib"} mr-2`}
                    ></i>
                    {isBulletinFormOpen ? "收起揪團" : "我要揪團"}
                  </button>
                  <button
                    onClick={() => navigate("collabs")}
                    className="bg-[#EF4444] hover:bg-[#DC2626] text-white px-4 sm:px-6 py-3 rounded-xl font-bold shadow-sm flex items-center justify-center transition-colors whitespace-nowrap"
                  >
                    <i className="fa-solid fa-calendar-check mr-2"></i>
                    確定聯動表
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsLeaderboardModalOpen(true)}
                className="w-full mb-8 bg-gradient-to-r from-[#422006] via-[#78350F] to-[#422006] border border-[#F59E0B]/45 rounded-2xl p-4 sm:p-5 text-left hover:border-[#F59E0B] hover:shadow-lg hover:shadow-[#F59E0B]/10 transition-all group"
                aria-label="開啟揪團排行榜"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-[#F59E0B] text-[#0F111A] flex items-center justify-center shadow-sm flex-shrink-0">
                      <i className="fa-solid fa-trophy text-xl"></i>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-lg font-black flex items-center gap-2">揪團排行榜 <span className="text-xs bg-black/25 text-[#FDE68A] px-2 py-0.5 rounded-full border border-[#F59E0B]/30">TOP 排行</span></p>
                      <p className="text-[#FDE68A] text-sm mt-1 line-clamp-2">看看目前成功促成最多聯動的創作者，點擊即可查看完整排行。</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:justify-end gap-3 flex-shrink-0">
                    <div className="flex -space-x-2">
                      {leaderboardData.slice(0, 3).map((vt, idx) => (
                        <button
                          key={vt.id || idx}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedVTuber(vt); navigate(`profile/${vt.id}`); }}
                          className="rounded-full hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                          title={`查看 ${vt.name || "排行榜創作者"} 的名片`}
                          aria-label={`查看 ${vt.name || "排行榜創作者"} 的名片`}
                        >
                          <img src={sanitizeUrl(vt.avatar)} alt={vt.name || "排行榜創作者"} className="w-9 h-9 rounded-full object-cover border-2 border-[#422006] bg-[#11131C]" />
                        </button>
                      ))}
                      {leaderboardData.length === 0 && <span className="text-xs text-[#FDE68A]/80 font-bold px-3 py-2 rounded-full bg-black/20 border border-[#F59E0B]/20">等待第一位上榜</span>}
                    </div>
                    <span className="inline-flex items-center gap-2 bg-[#F59E0B] text-[#0F111A] px-4 py-2.5 rounded-xl font-black group-hover:bg-[#FBBF24] transition-colors whitespace-nowrap">查看排行榜 <i className="fa-solid fa-arrow-right"></i></span>
                  </div>
                </div>
              </button>

              {isBulletinFormOpen && (
                <div
                  id="bulletin-form"
                  className="bg-[#181B25]/40 border border-[#2A2F3D] rounded-2xl p-6 sm:p-8 shadow-sm mb-10 animate-fade-in-up"
                >
                  <div className="flex justify-between items-center mb-6 border-b border-[#2A2F3D] pb-3">
                    <h3 className="text-xl font-bold text-white">
                      {newBulletin.id ? "編輯揪團文" : "發布新揪團"}
                    </h3>
                    <button
                      onClick={() => setIsBulletinFormOpen(false)}
                      className="text-[#64748B] hover:text-white"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
                        揪團內容說明 <span className="text-[#EF4444]">*</span>
                      </label>
                      <textarea
                        required
                        rows="4"
                        placeholder="請描述您的聯動企劃內容、希望的對象條件..."
                        value={newBulletin.content}
                        onChange={(e) =>
                          setNewBulletin({
                            ...newBulletin,
                            content: e.target.value,
                          })
                        }
                        className={inputCls + " resize-none"}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
                      <div className="md:col-span-1">
                        <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
                          聯動類型 <span className="text-[#EF4444]">*</span>
                        </label>
                        <select
                          value={newBulletin.collabType}
                          onChange={(e) =>
                            setNewBulletin({
                              ...newBulletin,
                              collabType: e.target.value,
                            })
                          }
                          className={inputCls}
                        >
                          <option value="">請選擇</option>
                          {PREDEFINED_COLLABS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                          <option value="其他">其他 (自行輸入)</option>
                        </select>
                        {newBulletin.collabType === "其他" && (
                          <input
                            type="text"
                            placeholder="請輸入類型"
                            value={newBulletin.collabTypeOther}
                            onChange={(e) =>
                              setNewBulletin({
                                ...newBulletin,
                                collabTypeOther: e.target.value,
                              })
                            }
                            className={inputCls + " mt-2"}
                          />
                        )}
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
                          預估人數 <span className="text-[#EF4444]">*</span>
                        </label>
                        <select
                          value={newBulletin.collabSize}
                          onChange={(e) =>
                            setNewBulletin({
                              ...newBulletin,
                              collabSize: e.target.value,
                            })
                          }
                          className={inputCls}
                        >
                          <option value="">請選擇</option>
                          {Array.from({ length: 20 }, (_, i) => i + 1).map(
                            (n) => (
                              <option key={n} value={`${n}人`}>
                                {n}人
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
                          預計聯動時間 <span className="text-[#EF4444]">*</span>
                        </label>
                        {/* 🌟 替換為 DateTimePicker */}
                        <DateTimePicker
                          value={newBulletin.collabTime}
                          onChange={(val) =>
                            setNewBulletin({
                              ...newBulletin,
                              collabTime: val,
                            })
                          }
                          className={inputCls}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
                          揪團截止時間 <span className="text-[#EF4444]">*</span>
                        </label>
                        {/* 🌟 替換為 DateTimePicker */}
                        <DateTimePicker
                          value={newBulletin.recruitEndTime}
                          onChange={(val) =>
                            setNewBulletin({
                              ...newBulletin,
                              recruitEndTime: val,
                            })
                          }
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2 mt-2">
                      <div className="flex-1 min-w-0">
                        <label className="block text-sm font-bold text-[#CBD5E1] mb-2">
                          選擇預設圖 或 自行上傳{" "}
                          <span className="text-[#EF4444]">* (必選)</span>
                        </label>
                        <div className="flex flex-col gap-3">
                          {defaultBulletinImages.length > 0 && (
                            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar items-center">
                              {defaultBulletinImages.map((img, idx) => (
                                <img
                                  key={idx}
                                  src={sanitizeUrl(img)}
                                  onClick={() =>
                                    setNewBulletin((p) => ({ ...p, image: img }))
                                  }
                                  className={`w-28 h-16 rounded-lg object-cover cursor-pointer border transition-all flex-shrink-0 ${newBulletin.image === img ? "border-[#8B5CF6] scale-105 shadow-sm opacity-100" : "border-transparent hover:border-gray-500 opacity-50 hover:opacity-100"}`}
                                  title="點擊套用此預設圖"
                                />
                              ))}
                            </div>
                          )}
                          <div className="flex gap-3 items-center">
                            {newBulletin.image &&
                              !defaultBulletinImages.includes(
                                newBulletin.image,
                              ) && (
                                <div className="relative">
                                  <img
                                    src={sanitizeUrl(newBulletin.image)}
                                    className="w-12 h-12 rounded-lg object-cover border border-[#2A2F3D]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setNewBulletin((p) => ({ ...p, image: "" }))
                                    }
                                    className="absolute -top-2 -right-2 bg-[#EF4444] text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                                  >
                                    <i className="fa-solid fa-xmark"></i>
                                  </button>
                                </div>
                              )}
                            <div className="relative w-full sm:w-auto flex-shrink-0">
                              <input
                                type="file"
                                accept="image/png, image/jpeg, image/webp"
                                onChange={handleBulletinImageUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              <button
                                type="button"
                                className="w-full sm:w-auto px-4 bg-[#181B25] hover:bg-[#1D2130] text-[#CBD5E1] text-sm py-2 rounded-xl border border-[#2A2F3D] transition-colors flex items-center justify-center gap-2"
                              >
                                <i className="fa-solid fa-cloud-arrow-up"></i>{" "}
                                自行上傳圖片
                              </button>
                            </div>
                            {newBulletin.image && (
                              <button
                                type="button"
                                onClick={() =>
                                  setNewBulletin((p) => ({ ...p, image: "" }))
                                }
                                className="text-xs text-[#EF4444] hover:text-red-300 border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 rounded-lg font-bold transition-colors"
                              >
                                取消選取圖片
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setIsBulletinFormOpen(false)}
                          className="px-6 py-3 text-[#94A3B8] hover:text-white font-bold"
                        >
                          取消
                        </button>
                        <button
                          onClick={handlePostBulletin}
                          className="bg-[#8B5CF6] hover:bg-[#8B5CF6] text-white px-8 py-3 rounded-xl font-bold shadow-sm transition-transform h-fit whitespace-nowrap"
                        >
                          {newBulletin.id ? "儲存修改" : "發布揪團"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 overflow-x-auto pb-4 mb-6 border-b border-[#2A2F3D]">
                <button
                  onClick={() => setBulletinFilter("All")}
                  className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${bulletinFilter === "All" ? "bg-[#8B5CF6] text-white shadow-sm" : "bg-[#181B25] text-[#94A3B8] hover:bg-[#1D2130]"}`}
                >
                  全部揪團
                </button>
                {activeBulletinTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => setBulletinFilter(t)}
                    className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${bulletinFilter === t ? "bg-[#8B5CF6] text-white shadow-sm" : "bg-[#181B25] text-[#94A3B8] hover:bg-[#1D2130]"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {isLoadingActivities ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 顯示 4 個骨架屏作為佔位符 */}
                  {[1, 2, 3, 4].map((n) => (
                    <BulletinSkeleton key={n} />
                  ))}
                </div>
              ) : filteredDisplayBulletins.length === 0 ? (
                <p className="text-center text-[#64748B] mt-20">
                  還沒有相關揪團。想找同好一起玩，就先發起一個企劃吧。
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredDisplayBulletins.map((b) => (
                    <BulletinCard
                      key={b.id}
                      b={b}
                      user={user}
                      isVerifiedUser={isVerifiedUser}
                      onNavigateProfile={(vtuber, isFromApplicants) => {
                        if (vtuber && vtuber.id) {
                          if (isFromApplicants) setOpenBulletinModalId(b.id);
                          else setOpenBulletinModalId(null);
                          setSelectedVTuber(vtuber);
                          navigate(`profile/${vtuber.id}`);
                        } else {
                          showToast("找不到該名片！");
                        }
                      }}
                      onApply={(id, isApplying) =>
                        handleApplyBulletin(id, isApplying, b.userId)
                      }
                      onInvite={handleOpenCollabModal}
                      onDeleteBulletin={handleDeleteBulletin}
                      onEditBulletin={handleEditBulletin}
                      openModalId={openBulletinModalId}
                      onClearOpenModalId={() => setOpenBulletinModalId(null)}
                      currentView={currentView}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {currentView === "collabs" && (
            <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in-up">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-[#2A2F3D] pb-4">
                <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
                  <i className="fa-solid fa-broadcast-tower text-[#EF4444]"></i>{" "}
                  確定聯動表
                </h2>
                <div className="flex flex-row flex-wrap gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => navigate("bulletin")}
                    className="bg-[#1D2130] hover:bg-[#2A2F3D] text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-colors"
                  >
                    <i className="fa-solid fa-arrow-left mr-2"></i>返回揪團佈告欄
                  </button>
                  {isVerifiedUser && (
                    <button
                      onClick={() => {
                        document
                          .getElementById("public-collab-form")
                          ?.classList.toggle("hidden");
                      }}
                      className="bg-[#EF4444] hover:bg-[#EF4444] text-white px-6 py-2.5 rounded-xl font-bold shadow-sm transition-transform"
                    >
                      <i className="fa-solid fa-plus mr-2"></i>發布聯動
                    </button>
                  )}
                </div>
              </div>

              {isVerifiedUser && (
                <div
                  id="public-collab-form"
                  className="hidden bg-[#181B25]/40 border border-[#2A2F3D] rounded-2xl p-6 sm:p-8 shadow-sm mb-10 animate-fade-in-up"
                >
                  <h3 className="text-xl font-bold text-white mb-6 border-b border-[#2A2F3D] pb-3">
                    發布新的聯動行程
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                    <div>
                      <label className="text-sm font-bold text-[#CBD5E1] mb-2 block">
                        聯動類別 <span className="text-[#EF4444]">*</span>
                      </label>
                      <select
                        value={publicCollabForm.category}
                        onChange={(e) =>
                          setPublicCollabForm({
                            ...publicCollabForm,
                            category: e.target.value,
                          })
                        }
                        className={inputCls}
                      >
                        {COLLAB_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-[#CBD5E1] mb-2 block">
                        聯動時間 <span className="text-[#EF4444]">*</span>
                      </label>
                      {/* 🌟 替換為 DateTimePicker */}
                      <DateTimePicker
                        value={publicCollabForm.dateTime}
                        onChange={(val) =>
                          setPublicCollabForm({
                            ...publicCollabForm,
                            dateTime: val,
                          })
                        }
                        className={inputCls}
                      />
                    </div>
                    <div className="relative">
                      <label className="text-sm font-bold text-[#CBD5E1] mb-2 block">
                        直播連結 (可自動抓圖){" "}
                        <span className="text-[#EF4444]">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="https://..."
                          value={publicCollabForm.streamUrl}
                          onChange={(e) =>
                            setPublicCollabForm({
                              ...publicCollabForm,
                              streamUrl: e.target.value,
                            })
                          }
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            autoFetchYouTubeInfo(
                              publicCollabForm.streamUrl,
                              (t) =>
                                setPublicCollabForm((p) => ({ ...p, title: t })),
                              (c) =>
                                setPublicCollabForm((p) => ({
                                  ...p,
                                  coverUrl: c,
                                })),
                              showToast,
                            )
                          }
                          className="bg-[#1D2130] hover:bg-[#2A2F3D] text-white px-4 rounded-xl text-xs font-bold transition-colors"
                        >
                          <i className="fa-solid fa-wand-magic-sparkles"></i>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="text-sm font-bold text-[#CBD5E1] mb-2 block">
                        聯動標題 <span className="text-[#EF4444]">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="輸入標題..."
                        value={publicCollabForm.title}
                        onChange={(e) =>
                          setPublicCollabForm({
                            ...publicCollabForm,
                            title: e.target.value,
                          })
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-[#CBD5E1] mb-2 block">
                        封面圖網址
                      </label>
                      <input
                        type="url"
                        placeholder="自訂封面圖 (選填)..."
                        value={publicCollabForm.coverUrl}
                        onChange={(e) =>
                          setPublicCollabForm({
                            ...publicCollabForm,
                            coverUrl: e.target.value,
                          })
                        }
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {/* 搜尋成員區塊 */}
                  <div className="bg-[#0F111A]/80 p-4 rounded-2xl border border-white/10 mb-6">
                    <label className="block text-sm font-bold text-[#A78BFA] mb-3">
                      <i className="fa-solid fa-users-plus mr-2"></i> 加入聯動成員
                      (※加入成員，成員將會在聯動24小時前被系統自動發信提醒，功能超實用真的要填一下。)
                    </label>

                    {/* 已選中的成員 */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(publicCollabForm.participants || []).map((uid) => {
                        const vt = realVtubers.find((v) => v.id === uid);
                        return vt ? (
                          <div
                            key={uid}
                            className="flex items-center gap-2 bg-[#8B5CF6]/20 border border-white/10 px-2 py-1 rounded-lg"
                          >
                            <img
                              src={sanitizeUrl(vt.avatar)}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                            <span className="text-xs text-white font-bold">
                              {vt.name}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPublicCollabForm((p) => ({
                                  ...p,
                                  participants: p.participants.filter(
                                    (id) => id !== uid,
                                  ),
                                }))
                              }
                              className="text-[#EF4444] hover:text-red-300"
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>

                    {/* 搜尋輸入框與結果 */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="輸入成員名稱搜尋..."
                        value={pSearch}
                        onChange={(e) => setPSearch(e.target.value)}
                        className={inputCls + " !bg-[#181B25]"}
                      />
                      {pSearch && (
                        <div className="absolute z-50 w-full mt-1 bg-[#181B25] border border-[#2A2F3D] rounded-xl shadow-sm max-h-40 overflow-y-auto">
                          {realVtubers
                            .filter(
                              (v) =>
                                v.isVerified &&
                                (v.name || "")
                                  .toLowerCase()
                                  .includes(pSearch.toLowerCase()) &&
                                !(publicCollabForm.participants || []).includes(
                                  v.id,
                                ) &&
                                v.id !== user?.uid,
                            )
                            .map((v) => (
                              <div
                                key={v.id}
                                onClick={() => {
                                  setPublicCollabForm((p) => ({
                                    ...p,
                                    participants: [
                                      ...(p.participants || []),
                                      v.id,
                                    ],
                                  }));
                                  setPSearch("");
                                }}
                                className="flex items-center gap-3 p-2 hover:bg-[#8B5CF6]/20 cursor-pointer border-b border-[#2A2F3D] last:border-0"
                              >
                                <img
                                  src={sanitizeUrl(v.avatar)}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                                <span className="text-sm text-white">
                                  {v.name}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        if (
                          !publicCollabForm.dateTime ||
                          !publicCollabForm.streamUrl ||
                          !publicCollabForm.title
                        )
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
                          const docRef = await addDoc(
                            collection(db, getPath("collabs")),
                            {
                              ...newCollabData,
                              userId: user.uid,
                              createdAt: Date.now(),
                            },
                          );

                          // 發送通知給參與者 (保持原樣)
                          publicCollabForm.participants.forEach(async (pId) => {
                            const target = realVtubers.find((v) => v.id === pId);
                            if (!target) return;
                            await addDoc(
                              collection(db, getPath("notifications")),
                              {
                                userId: pId,
                                fromUserId: user.uid,
                                fromUserName: myProfile?.name || "系統",
                                fromUserAvatar: myProfile?.avatar,
                                message: `您已被加入聯動行程：【${publicCollabForm.title}】！`,
                                type: "collab_added",
                                createdAt: Date.now(),
                                read: false,
                              },
                            );
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
                        } catch (err) {
                          console.error(err);
                          showToast("❌ 發布失敗");
                        }
                      }}
                      className="bg-[#EF4444] hover:bg-[#EF4444] text-white px-8 py-3 rounded-xl font-bold shadow-sm transition-transform"
                    >
                      送出發布
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-4 mb-8">
                {["All", ...COLLAB_CATEGORIES].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCollabCategoryTab(cat)}
                    className={`px-5 py-2 rounded-full font-bold text-sm transition-all ${collabCategoryTab === cat ? "bg-[#EF4444] text-white shadow-sm" : "bg-[#181B25] text-[#94A3B8] hover:text-white"}`}
                  >
                    {cat === "All" ? "全部" : cat}
                  </button>
                ))}
              </div>

              {filteredDisplayCollabs.length === 0 ? (
                <div className="text-center py-20 bg-[#181B25]/30 rounded-2xl border border-[#2A2F3D]">
                  <p className="text-[#64748B] font-bold text-lg">
                    <i className="fa-solid fa-ghost mb-4 text-4xl block"></i>
                    還沒有即將公開的聯動行程
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {filteredDisplayCollabs.map((c) => (
                    <CollabCard
                      key={c.id}
                      c={c}
                      isLive={
                        c.startTimestamp &&
                        currentTime >= c.startTimestamp &&
                        currentTime <= c.startTimestamp + 2 * 60 * 60 * 1000
                      }
                      isAdmin={isAdmin}
                      user={user}
                      onDeleteCollab={handleDeleteCollab}
                      vtuber={realVtubers.find((v) => v.id === c.userId)}
                      realVtubers={realVtubers}
                      onShowParticipants={(collab) =>
                        setViewParticipantsCollab(collab)
                      }
                      onNavigateProfile={(vt) => {
                        setSelectedVTuber(vt);
                        navigate(`profile/${vt.id}`);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 🌟 全新：24H 動態牆頁面 */}
          {currentView === "status_wall" && (() => {
            const now = Date.now();
            const hasValidStoryStatus = (v) => {
              if (!v?.statusMessage || !v?.statusMessageUpdatedAt) return false;
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

            return (
              <div className="max-w-3xl mx-auto px-4 py-6 animate-fade-in-up">
                {/* 小型提醒標題：只保留辨識與提醒，不佔版面 */}
                <div className="mb-4 rounded-2xl border border-[#2A2F3D] bg-[#181B25]/70 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                      <i className="fa-solid fa-bolt text-[#F59E0B]"></i> 24H 動態牆
                    </h2>
                    <p className="text-[#94A3B8] text-xs mt-1 leading-relaxed max-w-xl">看看誰正在直播、想揪團、找人聊天或分享近況。點頭像就能快速進入對方資料進行私訊互動。</p>
                  </div>
                  {isVerifiedUser && (
                    <button
                      type="button"
                      onClick={() => setIsStoryComposerOpen(true)}
                      className="flex-shrink-0 h-9 px-3 rounded-full bg-[#F59E0B] hover:bg-[#D97706] text-[#0F111A] text-xs font-black transition-colors inline-flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-plus"></i>
                      發布
                    </button>
                  )}
                </div>

                {/* 最上方只保留 IG 限動圈圈列 */}
                <div className="mb-4 bg-[#181B25]/80 border border-[#2A2F3D] rounded-2xl px-4 py-3">
                  <div className="flex gap-4 overflow-x-auto pb-1 custom-scrollbar">
                    {isVerifiedUser && myProfile && (
                      <button
                        onClick={() => setIsStoryComposerOpen(true)}
                        className="flex-shrink-0 w-16 text-center group"
                      >
                        <div className="w-14 h-14 mx-auto rounded-full border border-dashed border-[#F59E0B]/60 bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B] group-hover:bg-[#F59E0B]/20 transition-colors">
                          <i className="fa-solid fa-plus"></i>
                        </div>
                        <p className="text-[10px] text-[#F8FAFC] mt-1.5 truncate">發布</p>
                      </button>
                    )}

                    {storyRingUsers.length === 0 ? (
                      <div className="flex items-center text-[#94A3B8] text-sm py-3">
                        目前還沒有近期更新的創作者。
                      </div>
                    ) : (
                      storyRingUsers.map((v) => {
                        const hasActiveStory = activeStoryIds.has(v.id);
                        const storyViewed = hasActiveStory && isStatusStoryViewed(v);
                        const isLiveMsg = hasActiveStory && String(v.statusMessage || "").includes('🔴');
                        const ringClass = hasActiveStory && !storyViewed
                          ? (isLiveMsg ? 'bg-[#EF4444]' : 'bg-[#F59E0B]')
                          : 'bg-transparent border border-[#2A2F3D]';
                        const titleText = hasActiveStory
                          ? (storyViewed ? `${v.name || '創作者'} 的動態已看過` : String(v.statusMessage || ''))
                          : `${v.name || '創作者'} 最近更新了名片資料`;
                        return (
                          <button
                            key={`story-ring-${v.id}`}
                            onClick={() => { if (hasActiveStory) markStatusStoryViewed(v); setSelectedVTuber(v); navigate(`profile/${v.id}`); }}
                            className="flex-shrink-0 w-16 text-center group"
                            title={titleText}
                          >
                            <div className={`w-14 h-14 mx-auto rounded-full p-[2px] ${ringClass}`}>
                              <div className="w-full h-full rounded-full bg-[#11131C] p-[2px]">
                                <img src={sanitizeUrl(v.avatar)} className="w-full h-full rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              </div>
                            </div>
                            <p className={`text-[10px] text-[#F8FAFC] mt-1.5 truncate transition-colors ${hasActiveStory ? 'group-hover:text-[#F59E0B]' : 'group-hover:text-[#CBD5E1]'}`}>{v.name}</p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Threads / X 風格：單純牆面，只留頭像、時間、內容、幫推、+1 */}
                <div className="bg-[#181B25]/55 border border-[#2A2F3D] rounded-2xl overflow-hidden divide-y divide-[#2A2F3D]">
                  {activeStoryUsers.length === 0 ? (
                    <div className="text-center py-14 px-5">
                      <div className="w-14 h-14 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#F59E0B] mx-auto mb-4 flex items-center justify-center">
                        <i className="fa-solid fa-comment-dots text-xl"></i>
                      </div>
                      <p className="text-[#F8FAFC] font-bold">目前沒有 24H 動態</p>
                      <p className="text-[#94A3B8] text-sm mt-2">發布一句話，讓大家知道你現在想做什麼。</p>
                      {isVerifiedUser && (
                        <button
                          onClick={() => setIsStoryComposerOpen(true)}
                          className="mt-5 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F111A] px-5 py-2.5 rounded-full text-sm font-bold transition-colors"
                        >
                          發布第一則動態
                        </button>
                      )}
                    </div>
                  ) : (
                    activeStoryUsers.map((v) => {
                      const isLiveMsg = String(v.statusMessage || "").includes('🔴');
                      const plusCount = v.statusReactions?.plus_one?.length || 0;
                      const fireCount = v.statusReactions?.fire?.length || 0;
                      const displayMessage = String(v.statusMessage || "").replace(/^🔴\s*/, "").trim();

                      return (
                        <article
                          key={v.id}
                          className="px-4 sm:px-5 py-4 hover:bg-[#1D2130]/55 transition-colors"
                        >
                          <div className="flex gap-3 sm:gap-4">
                            <button
                              type="button"
                              onClick={() => { setSelectedVTuber(v); navigate(`profile/${v.id}`); }}
                              className="flex-shrink-0 self-start"
                              title="查看名片"
                            >
                              <img
                                src={sanitizeUrl(v.avatar)}
                                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover border ${isLiveMsg ? 'border-[#EF4444] ring-2 ring-red-500/25' : 'border-[#2A2F3D] hover:border-[#F59E0B]/70'} transition-colors`}
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0 text-xs text-[#94A3B8] mb-1">
                                <span className="font-bold text-[#CBD5E1] truncate">{v.name}</span>
                                <span className="text-[#64748B]">·</span>
                                <span className="flex-shrink-0">{formatRelativeTime(v.statusMessageUpdatedAt)}</span>
                                {isLiveMsg && (
                                  <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-[#EF4444]/15 text-[#FCA5A5] border border-[#EF4444]/20 px-2 py-0.5 text-[10px] font-bold">
                                    <i className="fa-solid fa-satellite-dish text-[9px]"></i> LIVE
                                  </span>
                                )}
                              </div>

                              <p className="text-[#F8FAFC] text-[15px] sm:text-base leading-relaxed whitespace-pre-wrap break-words">
                                {displayMessage || (isLiveMsg ? '我在直播中！快來找我玩！' : '發布了一則動態')}
                              </p>

                              <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                {(!user || v.id !== user?.uid) && (
                                  <>
                                    <button
                                      onClick={(e) => handleStatusReaction(e, v, 'fire')}
                                      className="h-9 px-3 rounded-full border border-[#2A2F3D] bg-[#11131C] hover:bg-[#F59E0B]/15 hover:border-[#F59E0B]/35 text-[#FCD34D] text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                                    >
                                      🔥 幫推
                                      {fireCount > 0 && <span className="text-[#94A3B8]">{fireCount}</span>}
                                    </button>
                                    <button
                                      onClick={(e) => handleStatusReaction(e, v, 'plus_one')}
                                      className="h-9 px-3 rounded-full border border-[#2A2F3D] bg-[#11131C] hover:bg-[#8B5CF6]/15 hover:border-[#8B5CF6]/35 text-[#C4B5FD] text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                                    >
                                      👋 +1
                                      {plusCount > 0 && <span className="text-[#94A3B8]">{plusCount}</span>}
                                    </button>
                                  </>
                                )}
                                {user && v.id === user.uid && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); if (confirm("確定要清除這則動態嗎？")) handlePostStory(e, "", false); }}
                                    className="h-9 px-3 rounded-full border border-[#2A2F3D] bg-[#11131C] hover:bg-[#1D2130] text-[#CBD5E1] text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                                  >
                                    <i className="fa-solid fa-eraser"></i> 清除
                                  </button>
                                )}
                              </div>

                              <StatusCommentsBox
                                storyOwner={v}
                                currentUser={user}
                                myProfile={myProfile}
                                isAdmin={isAdmin}
                                isVerifiedUser={isVerifiedUser}
                                realVtubers={realVtubers}
                                showToast={showToast}
                              />
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}

          {/* 這是原本的 MatchPage */}
          {currentView === "match" && (
            <MatchPage
              vtubers={displayVtubers}
              navigate={navigate}
              showToast={showToast}
              currentUser={user}
              setSelectedVTuber={setSelectedVTuber}
              onBraveInvite={handleBraveInvite}
              isVerifiedUser={isVerifiedUser}
            />
          )}

          {currentView === "blacklist" && (
            <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in-up">
              <div className="bg-[#2A1418]/30 border border-red-900 rounded-2xl p-8 sm:p-12 text-center shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-orange-600 to-red-600"></div>
                <i className="fa-solid fa-skull-crossbones text-6xl text-[#EF4444] mb-6 drop-shadow-sm"></i>
                <h2 className="text-3xl sm:text-4xl font-black text-[#EF4444] mb-4 tracking-widest">
                  暫停顯示名單
                </h2>
                <p className="text-red-200/80 mb-8 max-w-2xl mx-auto leading-relaxed font-medium">
                  只要倒讚數超過 10 個，該名片即會被系統自動移入此區並強制下架。
                  <br className="hidden sm:block" />
                  在此區的名片無法被一般使用者看見，也無法再發送任何邀約。
                  <br />
                  <span className="text-[#F59E0B] text-sm mt-2 block">
                    如果發現有惡意洗倒讚的行為，請聯絡官方處理。
                  </span>
                </p>
                <div className="inline-block bg-black/50 border border-red-900 px-6 py-3 rounded-xl">
                  <span className="text-[#94A3B8] font-bold mr-2">
                    目前黑單數量：
                  </span>
                  <span className="text-2xl font-black text-[#EF4444]">
                    {
                      realVtubers.filter(
                        (v) => v.isBlacklisted || v.dislikes >= 10,
                      ).length
                    }
                  </span>
                  <span className="text-[#64748B] text-sm ml-1">人</span>
                </div>
              </div>
            </div>
          )}

          {currentView === 'articles' && (
            <ArticlesPage
              articles={realArticles}
              onPublish={handlePublishArticle}
              onDelete={handleDeleteArticle}
              onIncrementView={handleIncrementArticleView}
            />
          )}

          {currentView === "admin" && isAdmin && (
            <AdminPage
              user={user}
              vtubers={realVtubers}
              bulletins={realBulletins}
              collabs={realCollabs}
              updates={realUpdates}
              rules={realRules}
              tips={realTips}
              privateDocs={privateDocs}
              onSaveSettings={handleSaveSettings}
              onDeleteVtuber={handleDeleteVtuber}
              onVerifyVtuber={handleVerifyVtuber}
              onRejectVtuber={handleRejectVtuber}
              onUpdateVtuber={handleAdminUpdateVtuber}
              onDeleteBulletin={handleDeleteBulletin}
              onAddCollab={handleAddCollab}
              onDeleteCollab={handleDeleteCollab}
              onAddUpdate={handleAddUpdate}
              onDeleteUpdate={handleDeleteUpdate}
              showToast={showToast}
              onResetAllCollabTypes={handleAdminResetAllCollabTypes}
              onResetNatAndLang={handleAdminResetNatAndLang}
              autoFetchYouTubeInfo={autoFetchYouTubeInfo}
              onMassSyncSubs={handleMassSyncSubs}
              onMassSyncTwitch={handleMassSyncTwitch}
              isSyncingSubs={isSyncingSubs}
              syncProgress={syncProgress}
              onSendMassEmail={handleSendMassEmail}
              defaultBulletinImages={defaultBulletinImages}
              onAddDefaultBulletinImage={handleAddDefaultBulletinImage}
              onDeleteDefaultBulletinImage={handleDeleteDefaultBulletinImage}
              onTestReminder={handleTestReminderSystem}
              onTestPush={handleTestPushNotification}
              onMassUpdateVerification={handleAdminMassUpdateVerification}
              setIsSyncingSubs={setIsSyncingSubs}
              setSyncProgress={setSyncProgress}
              onMassMigrateImages={handleMassMigrateImagesToStorage}
              articles={realArticles}
              onVerifyArticle={handleVerifyArticle}
              onDeleteArticle={handleDeleteArticle}
              onEditArticle={handleAdminEditArticle}
              onMigrateBulletinImages={handleMigrateBulletinImages}
              handleAdminCleanBulletins={handleAdminCleanBulletins}
              functionsInstance={functionsInstance}
              massEmailSending={massEmailSending}
              massEmailCurrent={massEmailCurrent}
              massEmailTotal={massEmailTotal}
              massEmailLog={massEmailLog}
            />
          )}
        </main>

        {/* 全站共用發布限動彈窗：首頁與 24H 動態牆都可直接開啟 */}
        {isStoryComposerOpen && (
          <div
            className="fixed inset-0 z-[9999] grid place-items-start justify-items-center p-4 pt-6 sm:pt-10 bg-black/70"
            onClick={() => setIsStoryComposerOpen(false)}
          >
            <div
              className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-[#11131C] border border-[#2A2F3D] rounded-2xl shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-[#2A2F3D] flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-[#F8FAFC] font-bold text-lg">讓大家知道你現在想做什麼</h3>
                  <p className="text-[#94A3B8] text-xs mt-1">一句話就好：想揪團、找練習、開台中，都可以讓其他創作者更快看到你。</p>
                </div>
                <button type="button" onClick={() => setIsStoryComposerOpen(false)} className="w-9 h-9 rounded-lg bg-[#181B25] hover:bg-[#1D2130] text-[#94A3B8] hover:text-white transition-colors flex-shrink-0" aria-label="關閉">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {isVerifiedUser && myProfile ? (
                <form
                  onSubmit={async (e) => {
                    const willPost = storyInput.trim();
                    await handlePostStory(e);
                    if (willPost) setIsStoryComposerOpen(false);
                  }}
                  className="p-5 space-y-4"
                >
                  <div>
                    <input
                      id="story-input-global"
                      type="text"
                      maxLength="40"
                      value={storyInput}
                      onChange={(e) => setStoryInput(e.target.value)}
                      className="w-full min-w-0 box-border bg-[#0F111A] border border-[#2A2F3D] rounded-xl px-4 h-[50px] text-white focus:ring-2 focus:ring-orange-500 outline-none text-[16px]"
                      placeholder="例如：今晚 8 點想找人打 APEX！ (限 40 字)"
                      autoFocus
                    />
                    <div className={`text-right text-[10px] mt-1.5 pr-2 transition-colors ${storyInput.length >= 40 ? 'text-[#EF4444] font-bold' : 'text-[#94A3B8]'}`}>
                      {storyInput.length} / 40
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button type="submit" disabled={!storyInput.trim()} className={`h-[46px] rounded-xl text-sm font-bold transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 ${storyInput.trim() ? 'bg-[#F59E0B] hover:bg-[#D97706] text-[#0F111A]' : 'bg-[#181B25] text-[#64748B] cursor-not-allowed'}`}>
                      發布限動
                    </button>
                    <button type="button" onClick={async (e) => { await handlePostStory(e, "🔴 我在直播中！快來找我玩！", true); setIsStoryComposerOpen(false); }} className="h-[46px] rounded-xl text-sm font-bold transition-colors whitespace-nowrap flex items-center justify-center bg-[#EF4444] hover:bg-red-500 text-white">
                      我在直播
                    </button>
                    {myProfile.statusMessage ? (
                      <button type="button" onClick={async (e) => { await handlePostStory(e, "", false); setIsStoryComposerOpen(false); }} className="h-[46px] rounded-xl text-sm font-bold transition-colors whitespace-nowrap flex items-center justify-center bg-[#1D2130] hover:bg-[#2A2F3D] text-white">
                        清除動態
                      </button>
                    ) : (
                      <button type="button" onClick={() => setIsStoryComposerOpen(false)} className="h-[46px] rounded-xl text-sm font-bold transition-colors whitespace-nowrap flex items-center justify-center bg-[#1D2130] hover:bg-[#2A2F3D] text-white">
                        取消
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="p-5 text-center">
                  <p className="text-[#94A3B8] text-sm mb-4">需通過名片認證才能發布限時動態喔！</p>
                  <button onClick={() => { setIsStoryComposerOpen(false); navigate("dashboard"); }} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                    前往認證名片
                  </button>
                </div>
              )}
            </div>
          </div>
        )}


        {/* 站內信發送 Modal */}
        {isCollabModalOpen && selectedVTuber && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
            onClick={() => setIsCollabModalOpen(false)}
          >
            <div
              className="bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-md overflow-hidden shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#181B25] p-6 flex flex-col items-center border-b border-[#2A2F3D]">
                <img
                  src={sanitizeUrl(selectedVTuber.avatar)}
                  className="w-20 h-20 rounded-full border border-[#2A2F3D] mb-3 object-cover"
                />
                <h3 className="text-xl font-bold text-white mb-1">
                  邀請 {selectedVTuber.name} 聯動
                </h3>
                <p className="text-xs text-[#C4B5FD] bg-purple-900/40 px-3 py-1 rounded-full">
                  對方主要時段：{formatSchedule(selectedVTuber)}
                </p>
              </div>
              <div className="p-6">
                <textarea
                  rows="5"
                  placeholder="嗨！我想邀請你一起玩..."
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  className={inputCls + " resize-none mb-4"}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsCollabModalOpen(false)}
                    className="flex-1 bg-[#181B25] hover:bg-[#1D2130] text-white py-3 rounded-xl font-bold transition-colors"
                  >
                    取消
                  </button>
                  <button
                    disabled={isSendingInvite} // 🌟 鎖定按鈕
                    onClick={async () => {
                      if (isSendingInvite) return; // 防呆：如果正在發送就阻擋
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
                      } catch (err) {
                        console.error("發送邀約或備份時發生錯誤:", err);
                        showToast("❌ 發送過程中發生部分錯誤，請按 F12 查看");
                      } finally {
                        setIsSendingInvite(false); // 🌟 發送結束，解除鎖定
                      }
                    }}
                    className={`flex-[2] text-white py-3 rounded-xl font-bold shadow-sm transition-all ${isSendingInvite ? "bg-purple-800 cursor-not-allowed opacity-70" : "bg-[#8B5CF6] hover:bg-[#8B5CF6]"}`}
                  >
                    {isSendingInvite ? (
                      <><i className="fa-solid fa-spinner fa-spin mr-2"></i>發送中...</>
                    ) : (
                      "送出邀約"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 規範 Modal */}
        {isRulesModalOpen && (
          /* 這裡移除了 backdrop-blur-sm 和 animate-fade-in-up */
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
            onClick={() => setIsRulesModalOpen(false)}
          >
            <div
              className="bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-lg shadow-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#3B171D]/30 p-5 border-b border-red-900/50 flex justify-between items-center">
                <h3 className="text-xl font-bold text-[#EF4444] flex items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation"></i> 聯動規範
                </h3>
                <button
                  onClick={() => setIsRulesModalOpen(false)}
                  className="text-[#94A3B8] hover:text-white"
                >
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="text-[#CBD5E1] leading-relaxed whitespace-pre-wrap text-sm">
                  {realRules}
                </div>
              </div>

              <div className="p-4 border-t border-[#2A2F3D] text-center">
                <button
                  onClick={() => setIsRulesModalOpen(false)}
                  className="bg-[#181B25] hover:bg-[#1D2130] text-white px-8 py-2.5 rounded-xl font-bold transition-colors w-full sm:w-auto"
                >
                  我了解了
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 邀約小技巧 Modal */}
        {isTipsModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
            onClick={() => setIsTipsModalOpen(false)}
          >
            <div
              className="bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-lg shadow-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-yellow-900/30 p-5 border-b border-yellow-900/50 flex justify-between items-center">
                <h3 className="text-xl font-bold text-[#F59E0B] flex items-center gap-2">
                  <i className="fa-solid fa-lightbulb"></i> 邀約小技巧
                </h3>
                <button
                  onClick={() => setIsTipsModalOpen(false)}
                  className="text-[#94A3B8] hover:text-white"
                >
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="text-[#CBD5E1] leading-relaxed whitespace-pre-wrap text-sm mb-6">
                  {realTips}
                </div>
                <div className="bg-[#181B25]/80 p-4 rounded-xl border border-[#2A2F3D]">
                  <p className="text-xs text-[#64748B] mb-2 font-bold">
                    複製公版邀約詞 (可自行修改)
                  </p>
                  <div className="bg-black/50 p-3 rounded-lg text-sm text-[#CBD5E1] font-mono mb-3 select-all">
                    您好，我是 OOO！\n近期想規劃一個 [遊戲/企劃]
                    的聯動，\n想請問是否有榮幸能邀請您一起參與呢？\n時間預計在
                    OO/OO，詳細企劃案如下...\n期待您的回覆！
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        "您好，我是 OOO！\n近期想規劃一個 [遊戲/企劃] 的聯動，\n想請問是否有榮幸能邀請您一起參與呢？\n時間預計在 OO/OO，詳細企劃案如下...\n期待您的回覆！",
                      );
                      setCopiedTemplate(true);
                      setTimeout(() => setCopiedTemplate(false), 2000);
                    }}
                    className="w-full bg-[#8B5CF6] hover:bg-[#8B5CF6] text-white py-2 rounded-lg font-bold transition-colors text-sm"
                  >
                    {copiedTemplate ? "✅ 已複製！" : "📋 點擊複製"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 最新消息 Modal */}
        {isUpdatesModalOpen && (
          /* 移除 backdrop-blur-sm 與 animate-fade-in-up */
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
            onClick={() => {
              setIsUpdatesModalOpen(false);
              handleMarkAllUpdatesRead();
            }}
          >
            <div
              className="bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-lg shadow-sm overflow-hidden flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-blue-900/30 p-5 border-b border-blue-900/50 flex justify-between items-center">
                <h3 className="text-xl font-bold text-[#38BDF8] flex items-center gap-2">
                  <i className="fa-solid fa-bullhorn"></i> 最新消息與功能發布
                </h3>
                <button
                  onClick={() => {
                    setIsUpdatesModalOpen(false);
                    handleMarkAllUpdatesRead();
                  }}
                  className="text-[#94A3B8] hover:text-white"
                >
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                {realUpdates.length === 0 ? (
                  <div className="text-center text-[#94A3B8] py-8"><p className="text-[#F8FAFC] font-bold mb-1">目前沒有新消息</p><p className="text-sm">有平台公告或重要提醒時，會整理在這裡。</p></div>
                ) : (
                  realUpdates.map((u) => (
                    <div key={u.id} className="relative">
                      {!readUpdateIds.includes(u.id) && (
                        <span className="absolute -left-2 top-1.5 w-2 h-2 rounded-full bg-[#EF4444]"></span>
                      )}
                      <h4 className="font-bold text-white text-lg mb-1">
                        {u.title}
                      </h4>
                      <p className="text-xs text-[#38BDF8] mb-2 font-mono">
                        {u.date}
                      </p>
                      <p className="text-[#CBD5E1] text-sm leading-relaxed whitespace-pre-wrap">
                        {u.content}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-[#2A2F3D] bg-[#0F111A]/90 text-center">
                <button
                  onClick={() => {
                    setIsUpdatesModalOpen(false);
                    handleMarkAllUpdatesRead();
                  }}
                  className="bg-[#38BDF8] hover:bg-[#38BDF8] text-[#0F111A] px-8 py-2.5 rounded-xl font-bold transition-colors w-full sm:w-auto shadow-sm"
                >
                  知道了
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 審核結果通知 Modal */}
        {user && myProfile && myProfile.showVerificationModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-md p-8 text-center shadow-sm relative">
              <div
                className={`absolute top-0 left-0 w-full h-2 ${myProfile.showVerificationModal === "approved" ? "bg-gradient-to-r from-green-400 to-emerald-500" : "bg-gradient-to-r from-red-500 to-orange-500"}`}
              ></div>

              <div className="mb-6">
                <div
                  className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${myProfile.showVerificationModal === "approved" ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#EF4444]/10 text-[#EF4444]"}`}
                >
                  <i
                    className={`fa-solid ${myProfile.showVerificationModal === "approved" ? "fa-check text-4xl" : "fa-xmark text-5xl"}`}
                  ></i>
                </div>
              </div>

              <h2 className="text-2xl font-extrabold text-white mb-4">
                {myProfile.showVerificationModal === "approved"
                  ? "名片審核通過！"
                  : "名片審核未通過"}
              </h2>

              {myProfile.showVerificationModal === "approved" ? (
                <p className="text-[#E2E8F0] text-lg font-bold leading-relaxed mb-8">
                  恭喜你審核通過！
                  <br />
                  開始尋找聯動夥伴吧！
                </p>
              ) : (
                <p className="text-[#CBD5E1] text-sm leading-relaxed mb-8 text-left">
                  很抱歉，目前僅開放YT訂閱或TWITCH追隨加起來高於500、近一個月有直播活動之Vtuber或繪師、建模師、剪輯師則由管理員認定，敬請見諒。如果以上你都有達到，那就是你沒有將「V-Nexus審核中」字樣放入你的X或YT簡介內，無法審核成功喔！
                  <br />
                  <br />
                  請繼續加油！
                </p>
              )}

              <div className="flex justify-center">
                <button
                  onClick={async () => {
                    const status = myProfile.showVerificationModal;
                    const updates = { showVerificationModal: null };

                    try {
                      // 1. 先更新 Firestore
                      await updateDoc(
                        doc(db, getPath("vtubers"), myProfile.id),
                        updates,
                      );

                      // 2. 關鍵：更新本地狀態的同時，強制同步更新 localStorage 快取
                      setRealVtubers((prev) => {
                        const newList = prev.map((v) =>
                          v.id === myProfile.id ? { ...v, ...updates } : v,
                        );
                        // 這裡呼叫你定義好的同步函式，把 showVerificationModal: null 存入快取
                        syncVtuberCache(newList);
                        return newList;
                      });

                      // 3. 根據結果導向不同頁面
                      if (status === "approved") {
                        navigate("grid");
                      }
                      // 如果是 rejected，就留在原地讓使用者看 dashboard
                    } catch (err) {
                      console.error("關閉通知失敗:", err);
                      // 即使資料庫失敗，本地也要先關掉，避免卡死
                      setRealVtubers((prev) =>
                        prev.map((v) =>
                          v.id === myProfile.id ? { ...v, ...updates } : v,
                        ),
                      );
                    }
                  }}
                  className={`${myProfile.showVerificationModal === "approved"
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500"
                    : "bg-[#181B25] hover:bg-[#1D2130] border border-[#2A2F3D]"
                    } text-white px-8 py-3 rounded-xl font-bold shadow-sm w-full transition-all`}
                >
                  {myProfile.showVerificationModal === "approved"
                    ? "開始找夥伴"
                    : "我了解了"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 招募成功排行榜 Modal */}
        {isLeaderboardModalOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80"
            onClick={() => setIsLeaderboardModalOpen(false)}
          >
            <div
              className="bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-md shadow-sm overflow-hidden flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-yellow-900/30 p-5 border-b border-yellow-900/50 flex justify-between items-center">
                <h3 className="text-xl font-bold text-[#F59E0B] flex items-center gap-2">
                  <i className="fa-solid fa-trophy"></i> 揪團排行榜
                </h3>
                <button
                  onClick={() => setIsLeaderboardModalOpen(false)}
                  className="text-[#94A3B8] hover:text-white"
                >
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-3">
                {leaderboardData.length === 0 ? (
                  <p className="text-center text-[#64748B] py-10">
                    目前還沒有人達成招募目標喔！
                    <br />
                    趕快成為第一個吧！
                  </p>
                ) : (
                  leaderboardData.map((vt, idx) => (
                    <div
                      key={vt.id || idx}
                      className={`flex items-center gap-4 p-3 rounded-xl border ${idx === 0 ? "bg-[#F59E0B]/20 border-[#F59E0B]/50 shadow-sm" : idx === 1 ? "bg-gray-300/20 border-gray-300/50 shadow-sm" : idx === 2 ? "bg-[#F59E0B]/20 border-[#F59E0B]/50 shadow-sm" : "bg-[#181B25]/50 border-[#2A2F3D]"}`}
                    >
                      <div className="w-8 text-center flex-shrink-0">
                        {idx === 0 ? (
                          <i className="fa-solid fa-crown text-2xl text-[#F59E0B]"></i>
                        ) : idx === 1 ? (
                          <i className="fa-solid fa-medal text-xl text-[#CBD5E1]"></i>
                        ) : idx === 2 ? (
                          <i className="fa-solid fa-award text-xl text-[#F59E0B]"></i>
                        ) : (
                          <span className="text-[#64748B] font-bold">
                            {idx + 1}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setIsLeaderboardModalOpen(false); setSelectedVTuber(vt); navigate(`profile/${vt.id}`); }}
                        className="flex-shrink-0 rounded-full hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                        title={`查看 ${vt.name || "創作者"} 的名片`}
                        aria-label={`查看 ${vt.name || "創作者"} 的名片`}
                      >
                        <img
                          src={sanitizeUrl(vt.avatar)}
                          className={`w-12 h-12 rounded-full object-cover border ${idx === 0 ? "border-yellow-400" : idx === 1 ? "border-gray-300" : idx === 2 ? "border-[#FBBF24]" : "border-[#2A2F3D]"}`}
                        />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-bold truncate ${idx === 0 ? "text-[#F59E0B] text-lg" : idx === 1 ? "text-[#E2E8F0] text-base" : idx === 2 ? "text-orange-300 text-base" : "text-[#CBD5E1] text-sm"}`}
                        >
                          {vt.name}
                        </p>
                        <p className="text-xs text-[#64748B]">累積成功次數</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span
                          className={`font-black text-2xl ${idx === 0 ? "text-[#F59E0B]" : idx === 1 ? "text-[#CBD5E1]" : idx === 2 ? "text-[#F59E0B]" : "text-[#94A3B8]"}`}
                        >
                          {vt.successCount}
                        </span>
                        <span className="text-xs text-[#64748B] ml-1">次</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-[#2A2F3D] bg-[#0F111A]/90 text-center">
                <button
                  onClick={() => setIsLeaderboardModalOpen(false)}
                  className="bg-[#181B25] hover:bg-[#1D2130] text-white px-8 py-2.5 rounded-xl font-bold transition-colors w-full sm:w-auto shadow-sm"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 倒讚確認 Modal */}
        {confirmDislikeData && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up"
            onClick={() => setConfirmDislikeData(null)}
          >
            <div
              className="bg-[#0F111A] border border-[#EF4444]/50 rounded-2xl w-full max-w-md p-8 text-center shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <i className="fa-solid fa-triangle-exclamation text-5xl text-[#EF4444] mb-4"></i>
              <h3 className="text-xl font-bold text-white mb-2">
                確定要對 {confirmDislikeData.name} 送出倒讚？
              </h3>
              <p className="text-[#94A3B8] text-sm mb-6">
                倒讚功能僅用於檢舉「負面行為」或「惡意騷擾」。
                <br />
                若該名片累積超過 10 個倒讚將自動下架。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDislikeData(null)}
                  className="flex-1 bg-[#181B25] hover:bg-[#1D2130] text-white py-3 rounded-xl font-bold transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmDislike}
                  className="flex-1 bg-[#EF4444] hover:bg-[#EF4444] text-white py-3 rounded-xl font-bold shadow-sm transition-transform"
                >
                  確定送出
                </button>
              </div>
            </div>
          </div>
        )}
        {/* 聯動成員名單彈窗 */}
        {viewParticipantsCollab && currentView !== "profile" && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setViewParticipantsCollab(null)}
          >
            <div
              className="bg-[#0F111A] border border-[#2A2F3D] rounded-2xl w-full max-w-md flex flex-col max-h-[80vh] shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-[#0F111A]/95 backdrop-blur px-6 py-4 border-b border-[#2A2F3D] flex justify-between items-center z-10">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-users text-[#A78BFA]"></i>{" "}
                  聯動參與成員
                </h3>
                <button
                  onClick={() => setViewParticipantsCollab(null)}
                  className="text-[#94A3B8] hover:text-white"
                >
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>
              <div className="p-4 overflow-y-auto space-y-3">
                {(viewParticipantsCollab.participants || []).map((pId) => {
                  const vt = realVtubers.find((v) => v.id === pId);
                  if (!vt) return null;



                  return (
                    <div
                      key={vt.id}
                      className="flex items-center justify-between bg-[#181B25]/50 p-3 rounded-xl border border-[#2A2F3D] hover:border-white/10 transition-all cursor-pointer group"
                      onClick={() => {
                        setSelectedVTuber(vt);
                        navigate(`profile/${vt.id}`);
                        // 這裡絕對不能有 setViewParticipantsCollab(null)
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={sanitizeUrl(vt.avatar)}
                          className="w-12 h-12 rounded-full object-cover border border-[#2A2F3D] group-hover:border-[#A78BFA] transition-colors"
                        />
                        <div>
                          <p className="font-bold text-white text-sm group-hover:text-[#C4B5FD] transition-colors">
                            {vt.name}
                          </p>
                          <p className="text-[10px] text-[#94A3B8] mt-1">
                            {vt.agency} | 點擊查看名片
                          </p>
                        </div>
                      </div>
                      <i className="fa-solid fa-chevron-right text-gray-600 group-hover:text-[#A78BFA] transition-colors"></i>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {user && !chatTarget && (
          <div className="fixed bottom-4 right-4 z-[90]">
            {isChatListOpen && (
              <div className="absolute bottom-16 right-0 w-[90vw] sm:w-80 bg-[#0F111A] border border-[#2A2F3D] rounded-2xl shadow-sm overflow-hidden animate-fade-in-up">
                <div className="bg-[#8B5CF6] p-3 flex justify-between items-center text-white shadow-md">
                  <span className="font-bold text-sm flex items-center gap-2">
                    <i className="fa-solid fa-comments"></i> 訊息列表
                  </span>
                  <button
                    onClick={() => setIsChatListOpen(false)}
                    className="hover:bg-[#7C3AED] w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <ChatListContent
                  currentUser={user}
                  vtubers={typeof realVtubers !== "undefined" ? realVtubers : []}
                  onOpenChat={handleOpenChat}
                  onDeleteChat={handleDeleteChat}
                  allChatRooms={allChatRooms} // ✅ 補上這行，聊天室就不會崩潰了！
                />
              </div>
            )}
            <button
              onClick={() => setIsChatListOpen(!isChatListOpen)}
              className="bg-[#8B5CF6] hover:bg-[#8B5CF6] text-white w-14 h-14 rounded-full shadow-sm flex items-center justify-center transition-transform border border-[#A78BFA]/30 relative"
            >
              <i
                className={`fa-solid ${isChatListOpen ? "fa-xmark text-xl" : "fa-message text-2xl"}`}
              ></i>

              {/* 新增：如果有未讀私訊且列表未開啟，顯示閃爍紅點 */}
              {!isChatListOpen && hasUnreadChat && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-[#EF4444] border border-gray-900 flex items-center justify-center">
                    <span className="text-[10px] text-white font-bold">!</span>
                  </span>
                </span>
              )}
            </button>
          </div>
        )}

        {user && chatTarget && (
          <FloatingChat
            targetVtuber={chatTarget}
            currentUser={user}
            myProfile={
              typeof myProfile !== "undefined"
                ? myProfile
                : typeof realVtubers !== "undefined"
                  ? realVtubers.find((v) => v.id === user.uid)
                  : null
            }
            onClose={() => setChatTarget(null)}
            showToast={
              typeof showToast !== "undefined"
                ? showToast
                : (msg) => console.log(msg)
            }
            // 🌟 新增：傳遞導航函式，讓聊天室可以跳轉名片
            onNavigateProfile={(vt) => {
              setSelectedVTuber(vt);
              navigate(`profile/${vt.id}`);
            }}
          />
        )}

        <footer className="py-6 border-t border-[#2A2F3D] text-[#64748B] text-sm">
          <div className="max-w-6xl mx-auto px-4 flex flex-col items-center justify-center gap-1 text-center">
            <p className="text-xs tracking-wide">本網頁由 Gemini Pro、Chatgpt輔助生成｜企劃者 從APEX歸來的Dasa</p>
            <p>© {new Date().getFullYear()} V-Nexus. 專為 VTuber 打造的聯動平台。</p>
          </div>
        </footer>
      </div>
    </AppContext.Provider>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
