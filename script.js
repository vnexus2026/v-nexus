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
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
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

try {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(
      "6LdINZksAAAAAF5FtNfKOOsDPaHQue3SmuAVqR4M",
    ),
    isTokenAutoRefreshEnabled: true,
  });
} catch (error) {
  console.warn("App Check:", error);
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

const LazyImage = ({
  src,
  containerCls = "",
  imgCls = "",
  alt = "",
  onClick,
}) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      onClick={onClick}
      className={`overflow-hidden ${containerCls} ${loaded ? "" : "bg-gray-700 animate-pulse"}`}
    >
      {src && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-500 ease-in-out ${loaded ? "" : "!opacity-0"} ${imgCls}`}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !currentUser || !targetVtuber?.id) return;
    if (input.trim().length > 500) return showToast("訊息不能超過 500 字！");

    const text = input;
    const now = Date.now();
    // 統一使用 getPath 確保路徑與監聽器完全一致
    const roomRef = doc(db, getPath("chat_rooms"), roomId);

    setInput("");

    try {
      // 1. 寫入訊息到子集合
      await addDoc(collection(db, getMsgPath(roomId)), {
        senderId: currentUser.uid,
        text: text,
        createdAt: now,
      });

      // 2. 取得房間資料以檢查發送頻率
      const roomSnap = await getDoc(roomRef);
      const roomData = roomSnap.exists() ? roomSnap.data() : {};
      const lastEmailTime = roomData.lastEmailSentAt || 0;
      const lastNotifTime = roomData.lastNotifSentAt || 0;

      // 3. 準備更新房間主文件
      const roomUpdate = {
        lastTimestamp: now,
        lastMessage: text,
        // 確保參與者名單正確，對方才能透過 where('participants', 'array-contains', ...) 搜到
        participants: [currentUser.uid, targetVtuber.id],
        unreadBy: arrayUnion(targetVtuber.id),
      };

      // 🌟 核心修復：合併通知邏輯，徹底刪除重複的區塊
      // 只有距離上次發送站內通知超過 1 分鐘，才發送新通知
      if (now - lastNotifTime > 1 * 60 * 1000) {
        roomUpdate.lastNotifSentAt = now;

        // 檢查是否距離上次寄 Email 超過 10 分鐘
        const shouldSendEmail = now - lastEmailTime > 10 * 60 * 1000;
        if (shouldSendEmail) roomUpdate.lastEmailSentAt = now;

        // ⚠️ 關鍵：這裡只寫入「一筆」通知！並透過 sendEmail 參數交給後端決定要不要寄信
        await addDoc(collection(db, getPath("notifications")), {
          userId: targetVtuber.id,
          fromUserId: currentUser.uid,
          fromUserName: myProfile?.name || "創作者",
          fromUserAvatar: myProfile?.avatar || "",
          message: "傳送了一則私訊，請查看右下角聊天室。",
          createdAt: now,
          read: false,
          type: "chat_notification",
          sendEmail: shouldSendEmail,
        });
      }

      // 4. 執行房間更新 (移到最後統一執行一次就好，節省資料庫寫入次數)
      await setDoc(roomRef, roomUpdate, { merge: true });

    } catch (err) {
      console.error("發送過程出錯詳細資訊:", err);
      showToast("傳送失敗，請確認登入狀態或權限");
    }
  };
  return (
    <div className="fixed bottom-4 right-4 z-[100] w-[90vw] sm:w-80 h-[450px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border-purple-500/30">
      {/* Header */}
      <div className="bg-purple-600 p-3 flex justify-between items-center text-white shadow-lg">

        {/* 🌟 修改這裡：加入手機版自動關閉視窗的邏輯 */}
        <div
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => {
            // 1. 觸發跳轉名片
            if (onNavigateProfile) onNavigateProfile(targetVtuber);

            // 2. 判斷螢幕寬度，小於 640px (Tailwind 的 sm 斷點) 視為手機版，自動關閉聊天視窗
            if (window.innerWidth < 640) {
              onClose();
            }
          }}
          title="查看名片"
        >
          <div className="relative flex-shrink-0">
            <img
              src={sanitizeUrl(targetVtuber.avatar)}
              className="w-8 h-8 rounded-full border border-white/20 object-cover"
            />
            {onlineUsers?.has(targetVtuber.id) && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-purple-600 rounded-full"></div>
            )}
          </div>
          <span className="font-bold text-sm truncate max-w-[120px]">
            {targetVtuber.name}
          </span>
        </div>

        <button
          onClick={onClose}
          className="hover:bg-purple-700 w-8 h-8 rounded-full transition-colors flex items-center justify-center"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* --- 新增：懸浮警告條 (固定在頂部) --- */}
      <div className="bg-red-950/90 backdrop-blur-md border-b border-red-500/30 px-3 py-2 z-20 flex-shrink-0">
        <p className="text-[16px] text-red-400 leading-relaxed text-center font-medium animate-pulse">
          <i className="fa-solid fa-triangle-exclamation mr-1"></i>
          訊息僅留七天，僅聯絡使用，私密訊息或龐大討論請轉至DC謝謝。
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0f111a]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.senderId === currentUser.uid ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-sm break-words whitespace-pre-wrap ${m.senderId === currentUser.uid
                ? "bg-purple-600 text-white rounded-tr-none"
                : "bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700"
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
        className="p-3 bg-gray-800/80 border-t border-gray-700 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="說點什麼..."
          // 🌟 優化：將 text-sm 改為 text-[16px]，完美阻止 iOS 手機點擊時自動放大畫面！
          className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-[16px] text-white outline-none focus:border-purple-500 transition-all"
        />
        <button
          type="submit"
          className="bg-purple-600 hover:bg-purple-500 text-white w-10 h-10 rounded-xl flex items-center justify-center transition-transform hover:scale-105 flex-shrink-0"
        >
          <i className="fa-solid fa-paper-plane"></i>
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
    const storageRef = ref(storage, `vtubers/${uid}/${fileName}`);
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

  // 🌟 終極優化：Firebase Token 免疫機制
  // 因為 Storage 規則已設定為公開 (allow read: if true)，讀取根本不需要 Token。
  // 我們直接把網址裡的 &token=... 拔掉，徹底解決舊 Token 失效導致的 403 破圖問題！
  if (u.includes("firebasestorage.googleapis.com") && u.includes("&token=")) {
    // 使用正規表達式拔除 token 參數
    return u.replace(/&token=[a-zA-Z0-9-]+/, "");
  }

  return u;
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
      if (line.startsWith('### ')) return <h3 key={idx} className="text-xl font-bold text-blue-300 mt-4 mb-2">{line.replace('### ', '')}</h3>;
      if (line.startsWith('- ')) return <li key={idx} className="text-gray-300 ml-4 mb-1 list-disc flex items-start gap-2"><span className="text-blue-500 mt-1">•</span> <span>{line.replace('- ', '')}</span></li>;
      return <p key={idx} className="text-gray-300 leading-relaxed mb-4 min-h-[1.5rem]">{line}</p>;
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-blue-400 flex items-center gap-3"><i className="fa-solid fa-book-open-reader"></i> VTuber 寶典</h2>
          <p className="text-gray-400 mt-2 text-sm">分享經驗、學習成長，讓您的 V 圈之路少走彎路。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('list')} className={`px-4 py-2 rounded-xl font-bold transition-all ${activeTab === 'list' || activeTab === 'read' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>文章列表</button>
          {isVerifiedUser && <button onClick={() => setActiveTab('mine')} className={`px-4 py-2 rounded-xl font-bold transition-all ${activeTab === 'mine' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>我的文章</button>}
          {isVerifiedUser && <button onClick={() => setActiveTab('create')} className={`px-4 py-2 rounded-xl font-bold transition-all ${activeTab === 'create' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}><i className="fa-solid fa-pen-nib mr-1"></i> 寫文章</button>}
        </div>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-6">
          {/* 👇 將原本單純的列表改成 flex 排版，左邊分類、右邊排序 */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

            {/* 左側：文章分類 */}
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar flex-1 w-full sm:w-auto">
              <button onClick={() => setFilterCategory('All')} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filterCategory === 'All' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>全部</button>
              {ARTICLE_CATEGORIES.map(c => (
                <button key={c} onClick={() => setFilterCategory(c)} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filterCategory === c ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{c}</button>
              ))}
            </div>

            {/* 右側：排序下拉選單 */}
            <div className="flex items-center gap-2 flex-shrink-0 bg-gray-800/80 p-1.5 rounded-xl border border-gray-700">
              <span className="text-sm text-gray-400 font-bold ml-2"><i className="fa-solid fa-sort"></i> 排序</span>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                className="bg-gray-900 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 transition-colors cursor-pointer"
              >
                <option value="latest">最新發布</option>
                <option value="popular">最受歡迎 (最多閱讀)</option>
              </select>
            </div>

          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayList.length === 0 ? <p className="text-gray-500 col-span-3 text-center py-10">目前尚無分類文章</p> : displayList.map(a => {
              const author = realVtubers.find(v => v.id === a.userId);
              return (
                <div key={a.id} onClick={() => { setSelectedArticle(a); setActiveTab('read'); if (onIncrementView) onIncrementView(a.id); }} className="bg-gray-800/60 border border-gray-700 rounded-2xl overflow-hidden hover:border-blue-500/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] cursor-pointer transition-all flex flex-col h-full group">
                  {a.coverUrl && (
                    <div className="h-40 overflow-hidden relative">
                      <img src={sanitizeUrl(a.coverUrl)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
                      <span className="absolute bottom-2 left-3 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">{a.category}</span>
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col">
                    {!a.coverUrl && <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow w-fit mb-2">{a.category}</span>}
                    <h3 className="font-bold text-white text-lg mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">{a.title}</h3>
                    <p className="text-sm text-gray-400 line-clamp-3 mb-4">{a.content.replace(/[#*]/g, '')}</p>
                    <div className="mt-auto pt-4 border-t border-gray-700 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={sanitizeUrl(author?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anon')} className="w-8 h-8 rounded-full border border-gray-600 object-cover flex-shrink-0" />
                        <div className="text-xs min-w-0">
                          <p className="text-gray-300 font-bold truncate">{author?.name || '匿名創作者'}</p>
                          <p className="text-gray-500">{formatTime(a.createdAt)}</p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 font-bold flex items-center gap-1.5 flex-shrink-0">
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
        <div className="bg-gray-800/40 border border-gray-700 rounded-3xl p-6 sm:p-10 shadow-2xl relative">
          <button onClick={() => setActiveTab('list')} className="text-blue-400 hover:text-white mb-6 font-bold text-sm flex items-center gap-2 transition-colors"><i className="fa-solid fa-arrow-left"></i> 返回列表</button>
          {currentArticle.coverUrl && <img src={sanitizeUrl(currentArticle.coverUrl)} className="w-full h-64 sm:h-96 object-cover rounded-2xl mb-8 border border-gray-700" />}

          <div className="flex items-center gap-3 mb-4">
            <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">{currentArticle.category}</span>
            <span className="text-gray-400 text-sm flex items-center gap-1"><i className="fa-regular fa-clock"></i>{formatTime(currentArticle.createdAt)}</span>
            {/* 👇 觀看數直接讀取最新同步的真實資料，不再使用強制 +1 的假象 */}
            <span className="text-gray-400 text-sm flex items-center gap-1"><i className="fa-solid fa-eye"></i>{currentArticle.views || 0}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-8 leading-tight">{currentArticle.title}</h1>

          <div className="flex items-center gap-4 mb-8 pb-8 border-b border-gray-700">
            <img src={sanitizeUrl(realVtubers.find(v => v.id === currentArticle.userId)?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anon')} className="w-12 h-12 rounded-full border-2 border-blue-500/50 object-cover" />
            <div>
              <p className="text-gray-200 font-bold">{realVtubers.find(v => v.id === currentArticle.userId)?.name || '匿名創作者'}</p>
              <p className="text-xs text-gray-500">文章作者</p>
            </div>
          </div>

          <article className="prose prose-invert prose-blue max-w-none text-gray-300">
            {renderContent(currentArticle.content)}
          </article>
        </div>
      )}

      {activeTab === 'mine' && (
        <div className="space-y-4">
          {myArticles.length === 0 ? <p className="text-center text-gray-500 py-10 bg-gray-800/40 rounded-2xl border border-gray-700">您尚未發表任何文章</p> : myArticles.map(a => (
            <div key={a.id} className="bg-gray-800 border border-gray-700 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-blue-500/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {a.status === 'published' ? <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded border border-green-500/30 flex items-center gap-1"><i className="fa-solid fa-check"></i>已發布</span> : <span className="bg-yellow-500/20 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded border border-yellow-500/30 flex items-center gap-1"><i className="fa-solid fa-hourglass-half"></i>審核中</span>}
                  <span className="text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">{a.category}</span>
                </div>
                <h3 className="font-bold text-white text-lg truncate">{a.title}</h3>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-xs text-gray-500">發布時間: {formatTime(a.createdAt)}</p>
                  <p className="text-xs text-gray-500 font-bold flex items-center gap-1"><i className="fa-solid fa-eye"></i> {a.views || 0}</p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                {a.status === 'published' && <button onClick={() => { setSelectedArticle(a); setActiveTab('read'); if (onIncrementView) onIncrementView(a.id); }} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">閱讀</button>}
                <button onClick={() => onDelete(a.id)} className="flex-1 sm:flex-none bg-red-900/50 hover:bg-red-800 text-red-400 hover:text-white border border-red-500/30 px-4 py-2 rounded-xl text-sm font-bold transition-colors">刪除文章</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'create' && (
        <form onSubmit={handlePublish} className="bg-gray-800/40 border border-gray-700 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
          <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl text-blue-300 text-sm mb-6 flex items-start gap-2">
            <i className="fa-solid fa-circle-info mt-1"></i>
            <span>發表文章後需經管理員審核才會公開顯示。支援簡易語法（<code>## 標題2</code>, <code>### 標題3</code>, <code>- 列表項目</code>）。</span>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">文章標題 <span className="text-red-400">*</span></label>
            <input required type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white focus:ring-purple-500 outline-none" placeholder="請輸入吸引人的標題..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">文章分類 <span className="text-red-400">*</span></label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white focus:ring-purple-500 outline-none">
                {ARTICLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">封面圖網址 (選填)</label>
              {/* 👇 替換成上傳檔案與預覽介面 */}
              <div className="flex items-center gap-4">
                {form.coverUrl && form.coverUrl.startsWith('data:image') && (
                  <div className="relative h-12 w-20 rounded-lg overflow-hidden border border-gray-600 flex-shrink-0">
                    <img src={form.coverUrl} className="w-full h-full object-cover" alt="封面預覽" />
                    <button type="button" onClick={() => setForm({ ...form, coverUrl: '' })} className="absolute top-0 right-0 bg-red-600/80 hover:bg-red-500 text-white w-5 h-5 flex items-center justify-center text-[10px] backdrop-blur-sm"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2 text-gray-400 focus:ring-purple-500 outline-none file:cursor-pointer file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 transition-colors"
                />
              </div>
              {/* 👆 替換結束 */}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">文章內容 <span className="text-red-400">*</span></label>
            <textarea required rows="15" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white focus:ring-purple-500 outline-none font-mono text-sm leading-relaxed" placeholder="在此輸入文章內容..." />
          </div>
          <div className="flex justify-end pt-4 border-t border-gray-700">
            <button type="submit" className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 flex items-center gap-2"><i className="fa-solid fa-paper-plane"></i> 送出審核</button>
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

const inputCls = "w-full min-w-0 box-border bg-gray-900 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none text-[16px]";
const btnCls =
  "w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white py-3 px-8 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 flex justify-center items-center gap-2";

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

const calculateCompatibility = (me, target) => {
  // 如果未登入或沒有名片，給予 60~89% 的隨機分數吸引註冊
  if (!me) return Math.floor(Math.random() * 30) + 60;

  let score = 50; // 基礎分數 50%

  // 1. 聯動類型相同 (每個加 12 分)
  const myCollabs = me.collabTypes || [];
  const targetCollabs = target.collabTypes || [];
  const sharedCollabs = myCollabs.filter(c => targetCollabs.includes(c));
  score += sharedCollabs.length * 12;

  // 2. 內容標籤相同 (每個加 6 分)
  const myTags = me.tags || [];
  const targetTags = target.tags || [];
  const sharedTags = myTags.filter(t => targetTags.includes(t));
  score += sharedTags.length * 6;

  // 3. 個性互補或相同
  if (me.personalityType && target.personalityType) {
    if (me.personalityType !== target.personalityType) score += 8; // 互補加分較多
    else score += 4; // 相同也加分
  }

  // 4. 演出型態相同
  if (me.streamingStyle === target.streamingStyle) score += 5;

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

const TagBadge = ({ text, onClick, selected }) => (
  <span
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors border ${selected ? "bg-purple-600 text-white border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]" : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white"}`}
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
      className={`group h-full ${isLive ? "bg-red-950/40 border-2 border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.4)] transform scale-[1.02] z-10" : "bg-gray-800/60 border border-gray-700 hover:border-red-500/50 hover:shadow-red-500/20"} rounded-3xl overflow-hidden flex flex-col transition-all relative w-full`}
    >
      {isLive && (
        <div className="absolute top-0 left-0 w-full bg-red-600 text-white text-center py-1.5 font-bold text-xs tracking-widest z-30 animate-pulse">
          <i className="fa-solid fa-satellite-dish mr-2"></i> 正在進行聯動中
        </div>
      )}
      {onDeleteCollab && (isAdmin || (user && c.userId === user.uid)) && (
        <button
          onClick={() => onDeleteCollab(c.id)}
          className={`absolute ${isLive ? "top-10" : "top-4"} right-4 z-20 bg-black/60 backdrop-blur-md text-gray-300 hover:text-red-400 hover:bg-black/80 p-2 rounded-lg transition-colors`}
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
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          alt="聯動封面"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/20 to-transparent"></div>
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-gray-600 text-white px-3 py-1.5 rounded-xl flex flex-col items-center shadow-lg transform -rotate-2">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
            {c.date}
          </span>
          <span className="text-sm text-red-400 font-extrabold">{c.time}</span>
        </div>
        {c.streamUrl && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
            <div
              className={`w-16 h-16 ${isLive ? "bg-red-500" : "bg-red-600/90"} text-white rounded-full flex items-center justify-center pl-1 shadow-[0_0_30px_rgba(220,38,38,0.8)] backdrop-blur-sm`}
            >
              <i className="fa-solid fa-play text-2xl"></i>
            </div>
          </div>
        )}
      </div>
      <div className="p-6 flex-1 flex flex-col relative z-10 bg-gray-900/80">
        <div className="mb-2">
          <span className="bg-purple-500/20 text-purple-300 text-[10px] px-2 py-1 rounded-lg border border-purple-500/30 font-bold">
            {c.category || "遊戲"}
          </span>
        </div>
        <h3
          className={`text-xl font-extrabold text-white mb-6 line-clamp-2 leading-tight transition-colors ${isLive ? "text-red-400" : "group-hover:text-red-400"}`}
        >
          {c.title}
        </h3>
        {/* 👇 加上防呆確保 isArray 才 map */}
        {Array.isArray(c.participants) && c.participants.length > 0 && (
          <div
            className="flex items-center gap-2 mb-4 cursor-pointer hover:bg-gray-800/50 p-1 -ml-1 rounded-lg transition-colors group/members"
            onClick={(e) => {
              e.stopPropagation();
              onShowParticipants(c);
            }}
          >
            <span className="text-[10px] text-gray-500 font-bold">
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
            <span className="text-[10px] text-purple-400 opacity-0 group-hover/members:opacity-100 transition-opacity ml-1">
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
              className={`w-full ${isLive ? "bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.6)] animate-pulse" : "bg-red-600 hover:bg-red-500 group-hover:shadow-[0_0_20px_rgba(220,38,38,0.4)]"} text-white py-3.5 rounded-xl font-bold transition-all flex justify-center items-center gap-2`}
            >
              <i className="fa-solid fa-play-circle text-lg"></i> 前往待機室 /
              觀看直播
            </a>
          ) : (
            <div className="w-full bg-gray-800 text-gray-500 py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 border border-gray-700">
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
              className="mt-4 pt-4 border-t border-gray-700/50 flex items-center justify-between cursor-pointer group/author hover:bg-gray-800/80 p-2 -mx-2 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <img
                  src={sanitizeUrl(vtuber.avatar)}
                  className="w-8 h-8 rounded-full border border-gray-600 object-cover"
                />
                <div className="text-left">
                  <p className="text-[10px] text-gray-400 mb-0.5">發起人</p>
                  <p className="text-sm font-bold text-white group-hover/author:text-purple-400 transition-colors truncate max-w-[150px]">
                    {vtuber.name}
                  </p>
                </div>
              </div>
              <button className="text-xs bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg group-hover/author:bg-purple-600 group-hover/author:text-white transition-colors font-bold">
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
  const { user, isVerifiedUser, onlineUsers } = useContext(AppContext);

  // 🌟 關鍵修復：先判斷是不是直播訊息，取得對應的過期時間 (3小時或24小時)
  const isLiveMsg = v.statusMessage && v.statusMessage.includes('🔴');
  const expireLimit = isLiveMsg ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  // 🌟 然後再用這個 expireLimit 來判斷動態是否有效！
  const isStatusValid = v.statusMessage && v.statusMessageUpdatedAt && (Date.now() - v.statusMessageUpdatedAt < expireLimit);
  const isLive = isStatusValid && isLiveMsg;

  // 🌟 判斷是否在線上
  const isOnline = onlineUsers?.has(v.id);

  return (
    <div onClick={onSelect}
      // 🌟 優化：加入 isStatusValid 的判斷，給予橘色邊框與發光陰影！
      // 優先級：直播中(紅) > 有發限動(橘+發光) > 待審核(黃) > 一般狀態(灰)
      className={`group h-full bg-gray-800/40 border-2 ${isLive
        ? "border-red-500/80 hover:border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
        : isStatusValid
          ? "border-orange-500/60 hover:border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.15)]"
          : !v.isVerified
            ? "border-yellow-500/50 hover:border-yellow-400"
            : "border-gray-700/50 hover:border-purple-500/50"
        } rounded-2xl overflow-hidden cursor-pointer transition-all hover:-translate-y-1 flex flex-col relative`}
    >
      {isLive && (
        <div className="absolute inset-0 border-2 border-red-500 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse pointer-events-none z-20"></div>
      )}

      {isLive && (
        <div className="absolute top-3 right-3 z-30 bg-red-600 text-white text-xs font-extrabold px-3 py-1 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse flex items-center gap-1.5">
          <i className="fa-solid fa-satellite-dish"></i> 直播中
        </div>
      )}

      <div className="absolute top-2 left-2 z-10 flex gap-1 flex-wrap max-w-[70%]">

        {/* 🌟 新增：線上狀態綠燈 */}
        {isOnline && !isLive && (
          <div className="bg-green-500/20 border border-green-500/50 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded shadow-lg flex items-center gap-1 animate-pulse">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div> 線上
          </div>
        )}
        {!v.isVerified && (
          <div className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow-lg">待審核</div>
        )}
        {v.activityStatus === "sleep" && (
          <div className="bg-gray-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg">休眠中</div>
        )}
        <div className={`text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg flex items-center gap-1 ${v.mainPlatform === "Twitch" ? "bg-purple-600" : "bg-red-600"}`}>
          <i className={`fa-brands fa-${v.mainPlatform === "Twitch" ? "twitch" : "youtube"}`}></i> {v.mainPlatform || "YouTube"}
        </div>
        <div className="bg-black/60 border border-gray-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg">
          {v.agency}
        </div>
      </div>

      {/* ▼ 橫幅圖片區塊 ▼ */}
      <div className="h-24 relative overflow-hidden flex-shrink-0 bg-gray-900">
        <LazyImage
          src={sanitizeUrl(v.banner)}
          containerCls="absolute inset-0 w-full h-full"
          imgCls="opacity-60 group-hover:scale-105 transition-transform"
        />
      </div>

      <div className="p-4 relative flex-1 flex flex-col z-30">
        {/* ▼ 頭像圖片區塊 ▼ */}
        <LazyImage
          src={sanitizeUrl(v.avatar)}
          // 🌟 優化：加入 Avatar Halo 頭像發光光環！
          // 如果是直播中，發出強烈紅光；如果有發限動，發出橘色光暈
          containerCls={`absolute -top-8 left-4 w-16 h-16 rounded-xl border-2 border-gray-800 bg-gray-900 z-10 transition-all duration-300 ${isLive ? 'ring-2 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse' : isStatusValid ? 'ring-2 ring-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.8)]' : ''}`}
          imgCls="rounded-xl"
        />

        <div className="ml-20 mb-3">
          <h3 className="font-bold text-white truncate flex items-center gap-1">
            {v.name}{" "}
            {v.isVerified && (
              <i className="fa-solid fa-circle-check text-blue-400 text-xs" title="已認證"></i>
            )}
          </h3>
          <div className="flex flex-wrap gap-2 text-xs mt-1 text-gray-400">
            {(v.youtubeSubscribers || v.subscribers || v.youtubeUrl || v.channelUrl) && (
              <span className="flex items-center gap-1">
                <i className="fa-brands fa-youtube text-red-400"></i> {v.youtubeSubscribers || v.subscribers || "未公開"}
              </span>
            )}
            {(v.twitchFollowers || v.twitchUrl) && (
              <span className="flex items-center gap-1">
                <i className="fa-brands fa-twitch text-purple-400"></i> {v.twitchFollowers || "未公開"}
              </span>
            )}
            <span className="flex items-center gap-1 text-green-400">
              <i className="fa-solid fa-thumbs-up"></i> {v.likes || 0}
            </span>
          </div>
        </div>

        {/* 🌟 優化：如果是預設的直播文字，就隱藏起來讓名片更乾淨；如果有自訂文字才顯示 */}
        {isStatusValid && (!isLive || v.statusMessage !== "🔴 正在直播中！快來找我玩！") && (
          // 🌟 將原本的 pink/purple 替換為 orange/red
          <div className={`mb-3 bg-gradient-to-r ${isLive ? 'from-red-500/20 to-orange-500/10 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'from-orange-500/10 to-red-500/10 border-orange-500/30'} rounded-lg px-3 py-2 text-xs ${isLive ? 'text-red-200' : 'text-orange-200'} font-medium flex items-start gap-2 shadow-inner relative`}>
            <i className={`fa-solid ${isLive ? 'fa-satellite-dish text-red-400 animate-pulse' : 'fa-comment-dots text-orange-400 animate-bounce'} mt-0.5 text-lg`}></i>
            <span className="line-clamp-2 leading-relaxed">{v.statusMessage}</span>
          </div>
        )}

        <p className="text-xs text-gray-400 line-clamp-2 h-8">{v.description}</p>

        {/* 🌟 優化：將直播風格與星座放在同一排，並讓星座靠右對齊 */}
        {(v.streamStyleUrl || v.zodiacSign) && (
          <div className="mt-1 mb-1 flex items-center justify-between min-h-[26px]">
            {v.streamStyleUrl ? (
              <a
                href={sanitizeUrl(v.streamStyleUrl)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-2 py-1 rounded transition-colors border border-blue-500/30 w-fit font-bold"
              >
                <i className="fa-solid fa-video"></i> 觀看我的直播風格
              </a>
            ) : (
              <div></div> /* 佔位符，確保只有星座時也能靠右 */
            )}

            {/* 🌟 新增：星座標籤顯示在最右側 */}
            {v.zodiacSign && (
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] bg-indigo-500/10 text-indigo-300 px-2 py-1 rounded border border-indigo-500/20 font-bold shadow-sm">
                <i className="fa-solid fa-star text-yellow-400"></i> {v.zodiacSign}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-2 border-t border-gray-700/50 text-xs text-gray-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
            <i className="fa-solid fa-clock text-purple-400"></i>{" "}
            <span className="truncate">{formatSchedule(v)}</span>
          </div>
          {isVerifiedUser && v.id !== user?.uid && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDislike(v);
              }}
              className="bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-50 hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1 flex-shrink-0"
              title="檢舉負面行為"
            >
              <i className="fa-solid fa-thumbs-down text-[10px]"></i>
            </button>
          )}
        </div>
        <div className="mt-2 pt-2 border-t border-gray-700/50 flex gap-2">
          {(v.youtubeUrl || v.channelUrl) &&
            (v.youtubeUrl || v.channelUrl) !== "#" ? (
            <a
              href={sanitizeUrl(v.youtubeUrl || v.channelUrl)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="bg-red-500/20 text-red-400 hover:bg-red-50 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-center flex-shrink-0 gap-1"
              title="YouTube"
            >
              <i className="fa-brands fa-youtube text-sm"></i>
              {(v.youtubeSubscribers || v.subscribers) && (
                <span className="text-[10px] font-bold">
                  {v.youtubeSubscribers || v.subscribers}
                </span>
              )}
            </a>
          ) : v.youtubeSubscribers || v.subscribers ? (
            <div
              className="bg-red-500/10 text-red-400/80 px-2.5 py-1.5 rounded-lg flex items-center justify-center flex-shrink-0 gap-1"
              title="YouTube 訂閱數"
            >
              <i className="fa-brands fa-youtube text-sm"></i>
              <span className="text-[10px] font-bold">
                {v.youtubeSubscribers || v.subscribers}
              </span>
            </div>
          ) : null}
          {v.twitchUrl && v.twitchUrl !== "#" ? (
            <a
              href={sanitizeUrl(v.twitchUrl)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="bg-purple-500/20 text-purple-400 hover:bg-purple-50 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-center flex-shrink-0 gap-1"
              title="Twitch"
            >
              <i className="fa-brands fa-twitch text-sm"></i>
              {v.twitchFollowers && (
                <span className="text-[10px] font-bold">{v.twitchFollowers}</span>
              )}
            </a>
          ) : v.twitchFollowers ? (
            <div
              className="bg-purple-500/10 text-purple-400/80 px-2.5 py-1.5 rounded-lg flex items-center justify-center flex-shrink-0 gap-1"
              title="Twitch 追隨數"
            >
              <i className="fa-brands fa-twitch text-sm"></i>
              <span className="text-[10px] font-bold">{v.twitchFollowers}</span>
            </div>
          ) : null}
          {v.xUrl && v.xUrl !== "#" && (
            <a
              href={sanitizeUrl(v.xUrl)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="bg-blue-500/20 text-blue-400 hover:bg-blue-50 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-center flex-shrink-0"
              title="X (Twitter)"
            >
              <i className="fa-brands fa-x-twitter text-sm"></i>
            </a>
          )}
          {v.igUrl && v.igUrl !== "#" && (
            <a href={sanitizeUrl(v.igUrl)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="bg-pink-500/20 text-pink-400 hover:bg-pink-50 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-center flex-shrink-0" title="Instagram">
              <i className="fa-brands fa-instagram text-sm"></i>
            </a>
          )}
        </div>

        {/* 🌟 優化：將契合度移到名片最下方，並改為低調柔和的樣式 */}
        {v.compatibilityScore && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <div className="w-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-bold py-2.5 rounded-xl flex justify-center items-center gap-2 shadow-inner transition-colors hover:bg-pink-500/20">
              <i className="fa-solid fa-heart animate-pulse"></i> 系統判定契合度 {v.compatibilityScore}%
            </div>
          </div>
        )}

      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.v.updatedAt === nextProps.v.updatedAt &&
    prevProps.v.likes === nextProps.v.likes &&
    prevProps.v.dislikes === nextProps.v.dislikes &&
    prevProps.isVerifiedUser === nextProps.isVerifiedUser &&
    prevProps.v.statusMessage === nextProps.v.statusMessage &&
    prevProps.v.statusMessageUpdatedAt === nextProps.v.statusMessageUpdatedAt
  );
});

const BulletinSkeleton = () => (
  <div className="bg-gray-800/40 border border-gray-700 rounded-3xl overflow-hidden flex flex-col shadow-lg">
    {/* 頂部圖片骨架 */}
    <div className="w-full h-48 sm:h-56 bg-gray-700/30 animate-pulse"></div>

    {/* 頭部資訊骨架 */}
    <div className="bg-gray-900/60 p-5 border-b border-gray-700/50 flex items-start gap-4">
      <div className="w-14 h-14 rounded-full bg-gray-700/50 animate-pulse flex-shrink-0"></div>
      <div className="flex-1 space-y-3 py-2">
        <div className="h-4 bg-gray-700/50 rounded-md w-1/3 animate-pulse"></div>
        <div className="h-3 bg-gray-700/50 rounded-md w-1/4 animate-pulse"></div>
      </div>
    </div>

    {/* 內容區骨架 */}
    <div className="p-6 flex-1 flex flex-col">
      <div className="space-y-3 mb-6">
        <div className="h-3 bg-gray-700/50 rounded-md w-full animate-pulse"></div>
        <div className="h-3 bg-gray-700/50 rounded-md w-5/6 animate-pulse"></div>
        <div className="h-3 bg-gray-700/50 rounded-md w-4/6 animate-pulse"></div>
      </div>

      {/* 網格資訊骨架 */}
      <div className="grid grid-cols-2 gap-3 mt-auto mb-4">
        <div className="bg-gray-900/50 h-14 rounded-xl animate-pulse"></div>
        <div className="bg-gray-900/50 h-14 rounded-xl animate-pulse"></div>
        <div className="bg-gray-900/50 h-14 rounded-xl col-span-2 animate-pulse"></div>
      </div>

      {/* 底部按鈕骨架 */}
      <div className="mt-4 pt-4 border-t border-gray-700/50 flex justify-between items-center">
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-700/50 animate-pulse"></div>
          <div className="w-6 h-6 rounded-full bg-gray-700/50 animate-pulse -ml-2"></div>
        </div>
        <div className="h-9 bg-purple-600/20 rounded-xl w-24 animate-pulse"></div>
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
  const hasApplied = Array.isArray(b.applicants)
    ? b.applicants.includes(user?.uid)
    : false;

  const targetSize = parseInt(String(b.collabSize || "0").replace(/[^0-9]/g, ""), 10) || 0;
  const currentApplicants = b.applicantsData?.length || 0;
  const isReached = targetSize > 0 && currentApplicants >= targetSize;

  useEffect(() => {
    if (openModalId === b.id) {
      setShowApplicants(true);
      if (onClearOpenModalId) onClearOpenModalId();
    }
  }, [openModalId, b.id]);

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-3xl overflow-hidden flex flex-col hover:border-purple-500/50 transition-all shadow-lg group">
      {b.image && (
        <div className="w-full h-48 sm:h-56 relative overflow-hidden flex-shrink-0 border-b border-gray-700 bg-gray-900">
          <LazyImage
            src={sanitizeUrl(b.image)}
            containerCls="absolute inset-0 w-full h-full"
            imgCls="group-hover:scale-105 transition-transform duration-700"
            alt="招募附圖"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent pointer-events-none z-10"></div>
        </div>
      )}

      <div className="bg-gray-900/80 p-5 border-b border-gray-700 flex items-start gap-4">
        {/* ▼▼▼ 發起人頭像修改處 ▼▼▼ */}
        <LazyImage
          src={sanitizeUrl(b.vtuber.avatar)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onNavigateProfile(b.vtuber, false);
          }}
          containerCls="w-14 h-14 rounded-full border-2 border-purple-500/50 flex-shrink-0 cursor-pointer hover:scale-105 transition-transform z-10"
          imgCls="rounded-full"
        />

        <div className="flex-1 flex justify-between items-start gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-purple-400 font-bold text-[10px] bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                發起人
              </span>
              <span
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onNavigateProfile(b.vtuber, false);
                }}
                className="font-extrabold text-white text-lg hover:text-purple-400 transition-colors cursor-pointer"
              >
                {b.vtuber.name}
              </span>
              {b.vtuber.isVerified && (
                <i
                  className="fa-solid fa-circle-check text-blue-400 text-sm"
                  title="已認證"
                ></i>
              )}
              <span className="text-white font-bold text-xs bg-purple-600 px-2.5 py-1 rounded-lg ml-1 shadow-sm border border-purple-500">
                {b.collabType || "未指定"}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-gray-400">
                {b.vtuber.agency}
              </span>
              <span className="text-gray-600 text-[10px]">•</span>
              <span className="text-[10px] text-gray-400">
                {b.postedAt} 發布
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col">
        {/* 找到 BulletinCard 內部的這個區塊並完整替換 */}
        <div className="mb-4">
          {/* 將 line-clamp-[10] 改為 line-clamp-4，讓未展開時更簡潔 */}
          <div
            className={`text-gray-300 whitespace-pre-wrap text-sm leading-relaxed transition-all duration-300 ${isExpanded ? "" : "line-clamp-4"}`}
          >
            {b.content}
          </div>

          {/* 移除原本的長度判斷條件，讓所有卡片都顯示按鈕 */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="text-purple-400 hover:text-purple-300 text-xs font-bold mt-2 flex items-center gap-1 transition-colors bg-purple-500/10 px-3 py-1.5 rounded-lg w-full justify-center"
          >
            {isExpanded ? (
              <>
                <i className="fa-solid fa-chevron-up"></i> 收起文案
              </>
            ) : (
              <>
                <i className="fa-solid fa-chevron-down"></i> 點擊查看完整文案
              </>
            )}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-auto mb-4">
          <div className="bg-gray-900/50 p-3 rounded-xl flex flex-col">
            <span className="text-[10px] text-gray-500 mb-1">
              <i className="fa-solid fa-users"></i> 人數
            </span>
            <span className="text-sm font-bold text-gray-200">
              {b.collabSize || "未指定"}
            </span>
          </div>
          <div className="bg-gray-900/50 p-3 rounded-xl flex flex-col">
            <span className="text-[10px] text-gray-500 mb-1">
              <i className="fa-regular fa-calendar"></i> 時間
            </span>
            <span className="text-sm font-bold text-gray-200">
              {formatDateTimeLocalStr(b.collabTime)}
            </span>
          </div>
          <div className="bg-red-500/5 p-3 rounded-xl border border-red-500/20 flex flex-col col-span-2">
            <span className="text-[10px] text-red-400/80 mb-1">
              <i className="fa-solid fa-hourglass-half"></i> 截止
            </span>
            <span className="text-sm font-bold text-red-300">
              {b.recruitEndTime ? formatTime(b.recruitEndTime) : "未指定"}
            </span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          {isAuthor ? (
            <div className="flex flex-col gap-3">
              {/* 🌟 給發起人看的達標提示 */}
              {isReached && (
                <div className="text-xs text-green-400 font-bold flex items-center gap-1.5 bg-green-500/10 px-3 py-1.5 rounded-lg w-fit border border-green-500/20">
                  <i className="fa-solid fa-circle-check"></i> 意願人數已達標！您可以開始挑選夥伴囉
                </div>
              )}
              <div
                className="flex items-center justify-between bg-gray-800/40 hover:bg-gray-800 p-3 rounded-xl border border-gray-700 cursor-pointer transition-colors"
                onClick={() => setShowApplicants(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-purple-500/20 w-8 h-8 rounded-full flex items-center justify-center text-purple-400">
                    <i className="fa-solid fa-users"></i>
                  </div>
                  <span className="text-sm font-bold text-white">
                    查看有意願的Vtuber ({b.applicantsData?.length || 0})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {b.applicantsData?.slice(0, 3).map((a) => (
                      <img
                        key={a.id}
                        src={sanitizeUrl(a.avatar)}
                        className="w-6 h-6 rounded-full ring-2 ring-gray-800 object-cover"
                      />
                    ))}
                    {b.applicantsData?.length > 3 && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 ring-2 ring-gray-900 text-[10px] text-gray-300">
                        +{b.applicantsData.length - 3}
                      </div>
                    )}
                  </div>
                  <i className="fa-solid fa-chevron-right text-gray-500 text-xs ml-2"></i>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-700/50">
                <button
                  onClick={() => onEditBulletin && onEditBulletin(b)}
                  className="text-[10px] font-bold bg-blue-600/80 hover:bg-blue-500 text-white px-3 py-1.5 rounded shadow transition-colors flex items-center"
                >
                  <i className="fa-solid fa-pen mr-1.5"></i>編輯招募
                </button>
                <button
                  onClick={() => onDeleteBulletin && onDeleteBulletin(b.id)}
                  className="text-[10px] font-bold bg-red-600/80 hover:bg-red-500 text-white px-3 py-1.5 rounded shadow transition-colors flex items-center"
                >
                  <i className="fa-solid fa-trash mr-1.5"></i>刪除招募
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* 🌟 給報名者看的達標提示 (用橘色火焰吸引目光，並強調仍可報名) */}
              {isReached && !hasApplied && (
                <div className="text-[10px] text-orange-400 font-bold flex items-center gap-1 bg-orange-500/10 px-2 py-1 rounded-lg w-fit border border-orange-500/20">
                  <i className="fa-solid fa-fire animate-pulse"></i> 意願人數達標！(發起人挑選中，仍可報名)
                </div>
              )}
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-2 cursor-pointer group/apply hover:bg-gray-800/50 p-2 -ml-2 rounded-lg transition-colors"
                  onClick={() => setShowApplicants(true)}
                >
                  <span className="text-xs text-gray-400 group-hover/apply:text-white transition-colors">
                    目前 {b.applicantsData?.length || 0} 人有意願
                  </span>
                  <div className="flex -space-x-2">
                    {b.applicantsData?.slice(0, 3).map((a) => (
                      <img
                        key={a.id}
                        src={sanitizeUrl(a.avatar)}
                        className="w-6 h-6 rounded-full ring-2 ring-gray-800 object-cover"
                      />
                    ))}
                    {b.applicantsData?.length > 3 && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 ring-2 ring-gray-900 text-[10px] text-gray-300">
                        +{b.applicantsData.length - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-purple-400 opacity-0 group-hover/apply:opacity-100 transition-opacity ml-1">
                    點擊展開
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onApply(b.id, !hasApplied, b.userId);
                  }}
                  className={`text-xs font-bold px-4 py-2 rounded-xl transition-transform hover:scale-105 ${hasApplied ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-purple-600 text-white hover:bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]"}`}
                >
                  {hasApplied ? "收回意願" : "✋ 我有意願"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showApplicants &&
        currentView !== "profile" &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowApplicants(false);
            }}
          >
            <div
              className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md flex flex-col max-h-[80vh] shadow-2xl cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-gray-900/95 backdrop-blur px-6 py-4 border-b border-gray-800 flex justify-between items-center z-10">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-users text-purple-400"></i>{" "}
                  有意願的Vtuber ({b.applicantsData?.length || 0})
                </h3>
                <button
                  onClick={() => setShowApplicants(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>
              <div className="p-4 overflow-y-auto space-y-3">
                {b.applicantsData?.length > 0 ? (
                  b.applicantsData.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between bg-gray-800/50 p-3 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-all cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowApplicants(false);
                        onNavigateProfile(a, true);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={sanitizeUrl(a.avatar)}
                          className="w-12 h-12 rounded-full object-cover border-2 border-gray-700 group-hover:border-purple-400 transition-colors"
                        />
                        <div>
                          <p className="font-bold text-white text-sm group-hover:text-purple-300 transition-colors">
                            {a.name}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            點擊查看名片
                          </p>
                        </div>
                      </div>
                      {isAuthor && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowApplicants(false);
                            onInvite(a);
                          }}
                          className="bg-purple-600 hover:bg-purple-500 text-xs text-white px-4 py-2 rounded-lg shadow-lg transition-transform hover:scale-105 font-bold"
                        >
                          發送邀約
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-6">
                    目前還沒有人表達意願喔！
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body,
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
      <h2 className="text-3xl font-extrabold text-purple-400 mb-4 flex justify-center items-center gap-3">
        <i className="fa-solid fa-dice"></i> 聯動隨機配對
      </h2>
      <p className="text-gray-400 mb-10">
        不知道該找誰玩嗎？讓 V-Nexus
        幫您隨機抽籤配對，或許會遇到意想不到的好夥伴喔！
      </p>

      <div className="bg-gray-800/40 border border-gray-700 rounded-3xl p-8 shadow-2xl max-w-2xl mx-auto relative overflow-hidden">
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl"></div>

        {!isMatching && !matchedVtuber && (
          <div className="space-y-6 relative z-10 animate-fade-in-up">
            <div className="text-left">
              <label className="block text-sm font-bold text-gray-300 mb-2">
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
              className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-4 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-transform hover:scale-105 flex justify-center items-center gap-2"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>{" "}
              開始尋找命定夥伴
            </button>

            {/* 🌟 新增：星座配對按鈕 */}
            <button
              onClick={() => handleMatch("zodiac")}
              className="w-full mt-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white py-4 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-transform hover:scale-105 flex justify-center items-center gap-2"
            >
              <i className="fa-solid fa-star"></i> 星座命定配對
            </button>
          </div>
        )}

        {isMatching && (
          <div className="py-12 flex flex-col items-center justify-center animate-fade-in-up">
            <div className="relative w-32 h-32 mb-6">
              <div className="absolute inset-0 border-4 border-gray-700 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-radar"></div>
              <i className="fa-solid fa-satellite-dish text-4xl text-purple-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></i>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 animate-pulse">
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
              <div className="mb-6 bg-indigo-900/40 border border-indigo-500/50 rounded-xl p-4 animate-bounce shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                <p className="text-indigo-200 font-bold text-lg flex items-center justify-center gap-2">
                  <i className="fa-solid fa-sparkles text-yellow-400"></i>
                  星座配對指數：<span className="text-3xl text-yellow-400 font-black">{zodiacScore}%</span>
                </p>
                <p className="text-sm text-indigo-300 mt-1">
                  你們是 {matchedVtuber.zodiacSign} 與你的完美邂逅！
                </p>
              </div>
            )}

            {/* 詳細名片資訊區 */}
            <div className="w-full bg-gray-900/90 border border-purple-500/50 rounded-2xl overflow-hidden shadow-2xl flex flex-col text-left mb-8">
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
                    className={`px-2 py-1 rounded text-[10px] text-white font-bold ${matchedVtuber.mainPlatform === "Twitch" ? "bg-purple-600" : "bg-red-600"}`}
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
                  className="absolute -top-12 left-6 w-24 h-24 rounded-2xl border-4 border-gray-900 bg-gray-800 object-cover shadow-xl"
                />
                <div className="ml-28 min-h-[80px]">
                  <h4 className="text-2xl font-bold text-white flex items-center gap-2">
                    {matchedVtuber.name}{" "}
                    {matchedVtuber.isVerified && (
                      <i className="fa-solid fa-circle-check text-blue-400 text-sm"></i>
                    )}
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs text-green-400 font-bold bg-green-500/10 px-2 py-1 rounded">
                      <i className="fa-solid fa-thumbs-up mr-1"></i>
                      {matchedVtuber.likes || 0} 推薦
                    </span>
                    <span className="text-xs text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded">
                      <i className="fa-brands fa-youtube mr-1"></i>
                      {matchedVtuber.youtubeSubscribers || "0"}
                    </span>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mt-4 line-clamp-3 leading-relaxed">
                  {matchedVtuber.description}
                </p>
                <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap gap-2">
                  {(matchedVtuber.collabTypes || []).slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-1 rounded-lg border border-purple-500/30 font-bold"
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
                  className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-heart"></i> 勇敢邀請
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedVTuber(matchedVtuber);
                  navigate(`profile/${matchedVtuber.id}`);
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-address-card"></i> 前往詳細名片
              </button>
              <button
                onClick={() => handleMatch(zodiacScore !== null ? "zodiac" : "random")}
                className="sm:col-span-2 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl font-bold border border-gray-700 transition-colors flex items-center justify-center gap-2"
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
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mt-1">
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
        <div className="space-y-3 border-t border-gray-700 pt-3">
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
        <div className="space-y-3 border-t border-gray-700 pt-3">
          {(form.scheduleSlots || []).map((slot, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center gap-2 bg-gray-800/50 p-2 rounded-lg border border-gray-700"
            >
              <select
                value={slot.day}
                onChange={(e) => updateSlot(index, "day", e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded p-1.5 text-white text-xs outline-none"
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
                className="bg-gray-800 border border-gray-600 rounded p-1.5 text-white text-xs outline-none box-border min-w-0 cursor-pointer"
              >
                {/* 防呆：如果原本資料庫存了奇怪的時間(如 14:15)，也能正常顯示出來 */}
                {!TIME_OPTIONS.includes(slot.start) && slot.start && (
                  <option value={slot.start}>{slot.start}</option>
                )}
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <span className="text-gray-400 text-xs">至</span>

              {/* 🌟 修改：將原本的 input type="time" 改成 select 下拉選單 */}
              <select
                value={slot.end}
                onChange={(e) => updateSlot(index, "end", e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded p-1.5 text-white text-xs outline-none box-border min-w-0 cursor-pointer"
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
                className="text-red-400 hover:text-red-300 ml-auto px-2 transition-colors"
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
            className="text-xs text-purple-400 hover:text-white flex items-center gap-1 mt-2 bg-purple-500/10 hover:bg-purple-500 px-3 py-1.5 rounded-lg border border-purple-500/20 transition-colors"
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
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mt-1">
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
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
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
          <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
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

  return (

    <form onSubmit={onSubmit} className="space-y-6">

      <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-5">
        <h3 className="text-purple-400 font-bold mb-3 flex items-center gap-2">
          <i className="fa-solid fa-power-off"></i> 名片顯示狀態
        </h3>
        <select
          value={form.activityStatus}
          onChange={(e) => updateForm({ activityStatus: e.target.value })}
          className={inputCls + " font-normal"}
        >
          <option value="active">🟢 活躍連動中</option>
          <option value="sleep">🟡 暫休眠</option>
          <option value="graduated">⚫ 已畢業</option>
        </select>
      </div>
      {/* 第一排：VTuber 名稱 (左) 與 專屬網址 ID (右) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* 左側：VTuber 名稱 */}
        <div className="flex flex-col justify-center">
          <label className="block text-sm font-bold text-gray-300 mb-2">
            VTuber 名稱 <span className="text-red-400">*</span>
          </label>
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) => updateForm({ name: e.target.value })}
            className={inputCls}
            placeholder="請輸入您的名稱"
          />
        </div>

        {/* 右側：專屬網址 ID */}
        <div className="bg-purple-500/5 border border-purple-500/20 p-4 rounded-xl flex flex-col justify-center">
          <label className="block text-sm font-bold text-purple-300 mb-2">
            <i className="fa-solid fa-link mr-1"></i> 設定專屬網址 ID
          </label>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 text-[10px] font-mono hidden sm:inline">
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
              className={inputCls + " font-mono text-purple-400 !p-2"}
            />
          </div>
        </div>
      </div>

      {/* 第二排：所屬勢力與演出型態 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">
              所屬勢力
            </label>
            <select
              value={form.agency}
              onChange={(e) => updateForm({ agency: e.target.value })}
              className={inputCls}
            >
              <option>個人勢</option>
              <option>企業勢</option>
              <option>社團勢</option>
              <option>合作勢</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">
              演出型態
            </label>
            <select
              value={form.streamingStyle}
              onChange={(e) => updateForm({ streamingStyle: e.target.value })}
              className={inputCls}
            >
              <option>一般型態</option>
              <option>男聲女皮 (Babiniku)</option>
              <option>女聲男皮</option>
              <option>無性別/人外</option>
              <option>其他</option>
            </select>
          </div>
        </div>
        {/* 這裡可以留空或放其他欄位 */}
        <div></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">
            國籍 (所在地)
          </label>
          <div className="flex flex-wrap gap-3 mb-2">
            {["台灣", "日本", "香港", "馬來西亞"].map((nat) => (
              <label
                key={nat}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={(form.nationalities || []).includes(nat)}
                  onChange={() => {
                    let newNats = [...(form.nationalities || [])];
                    if (newNats.includes(nat))
                      newNats = newNats.filter((n) => n !== nat);
                    else newNats.push(nat);
                    updateForm({ nationalities: newNats });
                  }}
                  className="accent-purple-500 w-4 h-4"
                />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                  {nat}
                </span>
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.isOtherNationality}
                onChange={() =>
                  updateForm({ isOtherNationality: !form.isOtherNationality })
                }
                className="accent-purple-500 w-4 h-4"
              />
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                其他(自行新增)
              </span>
            </label>
          </div>
          {form.isOtherNationality && (
            <input
              type="text"
              value={form.otherNationalityText || ""}
              onChange={(e) =>
                updateForm({ otherNationalityText: e.target.value })
              }
              placeholder="請輸入國籍/所在地"
              className={inputCls}
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">
            使用語言
          </label>
          <div className="flex flex-wrap gap-3">
            {["國", "日", "英", "粵", "台語"].map((lang) => (
              <label
                key={lang}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={(form.languages || []).includes(lang)}
                  onChange={() => {
                    let newLangs = [...(form.languages || [])];
                    if (newLangs.includes(lang))
                      newLangs = newLangs.filter((l) => l !== lang);
                    else newLangs.push(lang);
                    updateForm({ languages: newLangs });
                  }}
                  className="accent-purple-500 w-4 h-4"
                />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                  {lang}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>


      <div>
        <label className="block text-sm font-bold text-gray-300 mb-2">
          介紹一下你自己吧！ <span className="text-red-400">*</span>
        </label>
        <textarea
          required
          rows="3"
          value={form.description}
          onChange={(e) => updateForm({ description: e.target.value })}
          className={inputCls + " resize-none"}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-300 mb-2">
              你是什麼人？
            </label>
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
                onChange={(e) =>
                  updateForm({ personalityTypeOther: e.target.value })
                }
                placeholder="請輸入你是什麼人"
                className={inputCls + " mt-2"}
              />
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-300 mb-2">
              你的星座
            </label>
            <select
              value={form.zodiacSign || ""}
              onChange={(e) => updateForm({ zodiacSign: e.target.value })}
              className={inputCls}
            >
              <option value="">請選擇星座...</option>
              {ZODIAC_SIGNS.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
          {/* 新增：色系選擇 */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-300 mb-2">
              你是什麼色系? (至多三項)
            </label>
            <div className="flex flex-wrap gap-3 bg-gray-900 border border-gray-700 rounded-xl p-4">
              {COLOR_OPTIONS.map((color) => (
                <label
                  key={color}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={(form.colorSchemes || []).includes(color)}
                    onChange={() => {
                      let newColors = [...(form.colorSchemes || [])];
                      if (newColors.includes(color)) {
                        newColors = newColors.filter((c) => c !== color);
                      } else {
                        if (newColors.length >= 3)
                          return showToast("色系至多只能選擇三項喔！");
                        newColors.push(color);
                      }
                      updateForm({ colorSchemes: newColors });
                    }}
                    className="accent-purple-500 w-4 h-4"
                  />
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                    {color}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <label className="block text-sm font-bold text-gray-300 mb-2">
            內容標籤 (逗號分隔)
          </label>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => updateForm({ tags: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">
            主要願意連動類型 <span className="text-red-400">*</span>
          </label>
          <CollabTypesEditor
            formState={form}
            setFormState={updateForm}
            showToast={showToast}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-bold text-gray-300 mb-2">
          可聯動時段 <span className="text-red-400">*</span>
        </label>
        <ScheduleEditor form={form} updateForm={updateForm} />
      </div>
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">
              推薦數
            </label>
            <input
              type="number"
              value={form.likes}
              onChange={(e) => updateForm({ likes: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">
              倒讚數
            </label>
            <input
              type="number"
              value={form.dislikes}
              onChange={(e) => updateForm({ dislikes: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">
            YouTube 訂閱數
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={form.youtubeSubscribers || ""}
              placeholder="系統將自動抓取"
              className={
                inputCls + " bg-gray-800 cursor-not-allowed text-gray-400"
              }
            />
            <button
              type="button"
              onClick={handleAutoFetchSubscribers}
              disabled={
                isFetchingSubscribers ||
                (Date.now() - lastFetchTime < 24 * 60 * 60 * 1000 && !isAdmin)
              }
              className={`px-4 rounded-xl text-xs font-bold transition-colors flex-shrink-0 flex items-center justify-center ${Date.now() - lastFetchTime < 24 * 60 * 60 * 1000 && !isAdmin ? "bg-gray-800 text-gray-500 cursor-not-allowed" : "bg-gray-700 hover:bg-gray-600 text-white"}`}
            >
              {isFetchingSubscribers ? (
                <i className="fa-solid fa-spinner fa-spin"></i>
              ) : Date.now() - lastFetchTime < 24 * 60 * 60 * 1000 &&
                !isAdmin ? (
                <>
                  <i className="fa-solid fa-clock mr-1"></i>冷卻中
                </>
              ) : (
                <>
                  <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>
                  手動抓取
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-purple-400/80 mt-1">
            （填妥下方 YouTube 連結後會自動抓取，每24小時限抓一次）
          </p>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">
            Twitch 追隨數
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={form.twitchFollowers || ""}
              placeholder="系統將自動抓取"
              className={
                inputCls + " bg-gray-800 cursor-not-allowed text-gray-400"
              }
            />
            <button
              type="button"
              onClick={handleAutoFetchTwitch}
              disabled={
                isFetchingTwitch ||
                (Date.now() - lastTwitchFetchTime < 24 * 60 * 60 * 1000 &&
                  !isAdmin)
              }
              className={`px-4 rounded-xl text-xs font-bold transition-colors flex-shrink-0 flex items-center justify-center ${Date.now() - lastTwitchFetchTime < 6 * 60 * 60 * 1000 && !isAdmin ? "bg-gray-800 text-gray-500 cursor-not-allowed" : "bg-gray-700 hover:bg-gray-600 text-white"}`}
            >
              {isFetchingTwitch ? (
                <i className="fa-solid fa-spinner fa-spin"></i>
              ) : Date.now() - lastTwitchFetchTime < 24 * 60 * 60 * 1000 &&
                !isAdmin ? (
                <>
                  <i className="fa-solid fa-clock mr-1"></i>冷卻中
                </>
              ) : (
                <>
                  <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>
                  手動抓取
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-purple-400/80 mt-1">
            （填妥下方 Twitch 連結後會自動抓取，每24小時限抓一次）
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="flex items-center justify-between text-sm font-bold text-gray-300 mb-2">
            <span>YouTube 連結</span>
            <label className="flex items-center gap-1 text-xs cursor-pointer text-purple-300 font-normal">
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
            value={form.youtubeUrl}
            onChange={(e) => updateForm({ youtubeUrl: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className="flex items-center justify-between text-sm font-bold text-gray-300 mb-2">
            <span>Twitch 連結</span>
            <label className="flex items-center gap-1 text-xs cursor-pointer text-purple-300 font-normal">
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
            value={form.twitchUrl}
            onChange={(e) => updateForm({ twitchUrl: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">
            X連結
          </label>
          <input
            type="url"
            value={form.xUrl}
            onChange={(e) => updateForm({ xUrl: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">
            Instagram
          </label>
          <input
            type="url"
            value={form.igUrl}
            onChange={(e) => updateForm({ igUrl: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 mt-2">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <i className="fa-solid fa-envelopes-bulk text-purple-400"></i>{" "}
          聯絡信箱設定
        </h3>
        {/* 🌟 優化：改為單欄排版，完全移除私人信箱 */}
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">
              公開工商信箱 (選填)
              <span className="text-yellow-400 text-xs font-normal ml-2">
                (⚠️ 若您不驗證信箱，將無法在信箱收到任何邀約與提醒通知喔！請勿填寫私人信箱。)
              </span>
            </label>
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <input
                  type="email"
                  value={form.publicEmail || ""}
                  onChange={(e) => {
                    updateForm({
                      publicEmail: e.target.value,
                      publicEmailVerified: false,
                    });
                    setOtpStatus("idle");
                  }}
                  className={inputCls}
                  placeholder="例如：business@example.com"
                />
                {form.publicEmailVerified && (
                  <p className="text-green-400 text-xs mt-1.5 font-bold">
                    <i className="fa-solid fa-circle-check"></i> 信箱已驗證
                  </p>
                )}
              </div>
              {!form.publicEmailVerified &&
                form.publicEmail &&
                form.publicEmail.includes("@") && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpStatus === "sending"}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-3 rounded-xl text-xs font-bold whitespace-nowrap transition-colors border border-gray-600 flex-shrink-0"
                  >
                    {otpStatus === "sending" ? (
                      <i className="fa-solid fa-spinner fa-spin"></i>
                    ) : (
                      "發送驗證信"
                    )}
                  </button>
                )}
            </div>
            {otpStatus === "sent" && !form.publicEmailVerified && (
              <div className="mt-2 flex gap-2 animate-fade-in-up">
                <input
                  type="text"
                  maxLength="6"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="輸入6位數驗證碼"
                  className={
                    inputCls + " text-center tracking-widest font-bold py-2"
                  }
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-5 rounded-xl text-sm font-bold whitespace-nowrap shadow-lg transition-transform hover:scale-105"
                >
                  確認
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 pt-2">
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">
            我的直播風格代表作
          </label>
          <input
            type="url"
            value={form.streamStyleUrl}
            onChange={(e) => updateForm({ streamStyleUrl: e.target.value })}
            className={inputCls}
            placeholder="填入影片連結"
          />
        </div>
      </div>

      {!isAdmin && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 mt-2">
          <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
            <i className="fa-solid fa-shield-halved"></i> 真人身分驗證 (防冒用){" "}
            <span className="text-red-400">*</span>
          </h3>
          <p className="text-xs text-gray-300 mb-4">
            請將「
            <span className="text-white font-bold bg-gray-800 px-1 rounded">
              V-Nexus審核中
            </span>
            」放入X或Youtube簡介中，管理員審核後即可刪除。
            <br />
            <span className="text-yellow-400 font-bold">
              請在下方輸入您放入的平台 X 或 YT
            </span>
          </p>
          <input
            required
            type="text"
            value={form.verificationNote || ""}
            placeholder="請說明您在哪個平台的簡介放入了驗證文字（例如：已放至 X 簡介）"
            onChange={(e) => updateForm({ verificationNote: e.target.value })}
            className={inputCls}
          />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>頭像網址 / 上傳</span>
            <span className="text-xs text-purple-400 font-normal">
              建議: 300x300px
            </span>
          </label>
          <div className="flex gap-3">
            <img
              src={sanitizeUrl(form.avatar)}
              className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-gray-800"
            />
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <input
                type="text"
                value={form.avatar}
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
                <button
                  type="button"
                  className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs py-2 rounded-lg border border-gray-600 transition-colors flex items-center justify-center gap-2 relative z-0"
                >
                  <i className="fa-solid fa-cloud-arrow-up"></i> 從裝置上傳圖片
                  (自動壓縮省空間)
                </button>
              </div>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>橫幅網址 / 上傳</span>
            <span className="text-xs text-purple-400 font-normal">
              建議: 800x400px
            </span>
          </label>
          <div className="flex gap-3">
            <img
              src={sanitizeUrl(form.banner)}
              className="w-20 h-12 rounded-xl object-cover flex-shrink-0 bg-gray-800"
            />
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <input
                type="text"
                value={form.banner}
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
                <button
                  type="button"
                  className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs py-2 rounded-lg border border-gray-600 transition-colors flex items-center justify-center gap-2 relative z-0"
                >
                  <i className="fa-solid fa-cloud-arrow-up"></i> 從裝置上傳圖片
                  (自動壓縮省空間)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="pt-6 border-t border-gray-700 flex sm:justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 sm:flex-none px-2 sm:px-4 py-3 text-gray-400 hover:text-white transition-colors font-bold flex items-center justify-center"
          >
            取消
          </button>
        )}
        {!isAdmin && onDeleteSelf && (
          <button
            type="button"
            onClick={onDeleteSelf}
            // 🌟 加入 flex-1 讓手機版平分寬度，並確保內容置中 (justify-center)
            className="flex-1 sm:flex-none px-2 sm:px-6 py-3 rounded-xl font-bold text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-trash-can"></i> 刪除名片
          </button>
        )}
        <button 
          type="submit" 
          // 🌟 加入 flex-1 讓手機版平分寬度，並寫死樣式確保不受外部干擾
          className="flex-1 sm:flex-none w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white py-3 px-2 sm:px-8 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 flex justify-center items-center gap-2"
        >
          <i className="fa-solid fa-floppy-disk"></i>
          {isAdmin ? "強制儲存更新" : "儲存名片"}
        </button>
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 border-b border-gray-700 pb-4 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <i className="fa-solid fa-envelope-open-text text-purple-400"></i>{" "}
            我的信箱
          </h2>
          <p className="text-gray-400 mt-2 text-sm">您的專屬通知中心</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {notifications.some((n) => !n.read) && (
            <button
              onClick={markAllAsRead}
              className="text-sm font-bold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 px-4 py-2 rounded-xl"
            >
              <i className="fa-solid fa-check-double mr-1"></i> 全部標示為已讀
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={onDeleteAll}
              className="text-sm font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 px-4 py-2 rounded-xl"
            >
              <i className="fa-solid fa-trash-can mr-1"></i> 一鍵刪除全部
            </button>
          )}
        </div>
      </div>
      {notifications.length === 0 ? (
        <div className="text-center py-24 bg-gray-800/40 rounded-3xl border border-gray-700/50 shadow-xl">
          <i className="fa-regular fa-envelope-open text-6xl text-gray-600 mb-6"></i>
          <p className="text-gray-400 font-bold text-lg">信箱目前空空如也！</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayNotifications.map((n) => (
            <div
              key={n.id}
              className={`p-5 sm:p-6 rounded-2xl border transition-all ${n.read ? "bg-gray-800/60 border-gray-700" : "bg-gray-800 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]"}`}
            >
              <div className="flex items-start gap-4 sm:gap-5">
                <img
                  src={sanitizeUrl(
                    n.fromUserAvatar ||
                    "https://api.dicebear.com/7.x/avataaars/svg?seed=Anon",
                  )}
                  onClick={() => onNavigateProfile(n.type === "collab_invite_sent" ? n.targetUserId : n.fromUserId)}
                  className="w-14 h-14 rounded-full border-2 border-gray-700 bg-gray-900 object-cover cursor-pointer hover:border-purple-400"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                    <h4 className="font-bold text-white text-lg flex flex-wrap items-center gap-2">
                      <span
                        onClick={() => onNavigateProfile(n.fromUserId)}
                        className="cursor-pointer hover:text-purple-400"
                      >
                        {n.fromUserName}
                      </span>
                      {!n.read && (
                        <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse shadow-lg whitespace-nowrap">
                          新通知
                        </span>
                      )}
                    </h4>
                    <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                      <i className="fa-regular fa-clock mr-1"></i>
                      {formatTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap bg-gray-900/80 p-4 rounded-xl border border-gray-700/50 mt-3">
                    {n.message}
                  </p>
                  {n.type === "brave_invite" && !n.handled && (
                    <div className="flex gap-3 mt-4 pt-4 border-t border-gray-700/50">
                      <button
                        onClick={() =>
                          onBraveResponse(n.id, n.fromUserId, true)
                        }
                        className="text-xs font-bold text-white bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg shadow-md transition-transform hover:scale-105"
                      >
                        <i className="fa-solid fa-check mr-1"></i> 可以試試
                      </button>
                      <button
                        onClick={() =>
                          onBraveResponse(n.id, n.fromUserId, false)
                        }
                        className="text-xs font-bold text-gray-300 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg shadow-md transition-transform hover:scale-105"
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
                        className="text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg flex items-center shadow-md transition-transform hover:scale-105"
                      >
                        <i className="fa-solid fa-comments mr-2"></i> 查看聊天室
                      </button>
                    )}
                    <button
                      onClick={() => onNavigateProfile(n.fromUserId)}
                      className="text-xs font-bold text-gray-300 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg flex items-center shadow-md"
                    >
                      <i className="fa-solid fa-address-card mr-2"></i> 查看名片
                    </button>
                    {!n.read && (
                      <button
                        onClick={() => onMarkRead(n.id)}
                        className="text-xs font-bold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 px-4 py-2 rounded-lg flex items-center shadow-md"
                      >
                        <i className="fa-solid fa-check mr-2"></i> 標為已讀
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(n.id)}
                      className="text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-4 py-2 rounded-lg flex items-center shadow-md"
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
            className={`px-4 py-2 rounded-lg font-bold text-sm ${page === 1 ? "bg-gray-800 text-gray-600 cursor-not-allowed" : "bg-gray-700 text-white hover:bg-gray-600"}`}
          >
            上一頁
          </button>
          <span className="text-gray-400 text-sm font-bold">
            第 {page} / {totalPages} 頁
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={`px-4 py-2 rounded-lg font-bold text-sm ${page === totalPages ? "bg-gray-800 text-gray-600 cursor-not-allowed" : "bg-gray-700 text-white hover:bg-gray-600"}`}
          >
            下一頁
          </button>
        </div>
      )}
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
}) => {
  const [statusShuffleSeed, setStatusShuffleSeed] = useState(Date.now());
  // 🌟 新增：控制洗牌動畫的狀態
  const [isShuffling, setIsShuffling] = useState(false);

  // 🌟 新增：處理洗牌與微動畫的函式
  const handleShuffleStatus = () => {
    if (isShuffling) return; // 防止狂點
    setIsShuffling(true); // 1. 觸發淡出動畫

    setTimeout(() => {
      setStatusShuffleSeed(Date.now()); // 2. 在畫面最暗的時候替換資料
      setIsShuffling(false); // 3. 觸發淡入動畫顯示新資料
    }, 300); // 300毫秒的黃金微動畫時間
  };

  const safeBulletins = Array.isArray(realBulletins) ? realBulletins : [];

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
    const myProfile = user ? realVtubers.find(v => v.id === user.uid) : null;
    // 判斷是否為已認證的有效使用者
    const isVerified = myProfile?.isVerified && !myProfile?.isBlacklisted && myProfile?.activityStatus === 'active';

    const candidates = [...realVtubers]
      .filter(
        (v) =>
          v.isVerified &&
          !v.isBlacklisted &&
          v.activityStatus !== "sleep" &&
          v.activityStatus !== "graduated" &&
          !String(v.id || "").startsWith("mock") &&
          v.id !== user?.uid // 排除自己
      );

    // 🌟 修正：如果未登入或未認證，直接隨機洗牌，不計算契合度 (卡片上就不會出現分數)
    if (!isVerified) {
      return candidates.sort(() => Math.random() - 0.5).slice(0, 5);
    }

    // 已認證使用者：計算契合度
    const scoredCandidates = candidates.map(v => ({
      ...v,
      compatibilityScore: calculateCompatibility(myProfile, v)
    }));

    // 🌟 優化 1：先篩選出契合度 >= 60% 的「及格名單」
    let qualified = scoredCandidates.filter(v => v.compatibilityScore >= 80);

    // 🌟 防呆機制：如果連一個 60 分以上的都沒有，就抓取分數最高的前 5 名當作備用名單
    if (qualified.length === 0) {
      qualified = scoredCandidates
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
        .slice(0, 5);
    }

    // 🌟 優化 2：將及格名單「隨機打亂 (Shuffle)」
    return qualified
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);
  }, [realVtubers, user]);

  const activeStatuses = useMemo(() => {
    const now = Date.now();
    const validStatuses = [...realVtubers].filter(
      (v) => {
        if (!v.isVerified || v.isBlacklisted || v.activityStatus === "sleep" || v.activityStatus === "graduated" || String(v.id || "").startsWith("mock") || !v.statusMessage || !v.statusMessageUpdatedAt) return false;

        // 🌟 判斷限時動態是否有效 (直播 3 小時，一般 24 小時)
        const isLiveMsg = v.statusMessage.includes('🔴');
        const expireLimit = isLiveMsg ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        return now - v.statusMessageUpdatedAt < expireLimit;
      }
    );

    // 隨機打亂陣列，並只取前 3 名
    // 這裡依賴 statusShuffleSeed，只要按鈕更新了這個值，就會重新洗牌！
    return validStatuses
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);
  }, [realVtubers, statusShuffleSeed]);

  // 輔助組件：手機版最後一個按鈕卡片
  const MobileMoreCard = ({ onClick, icon, text, subText }) => (
    <div
      className="flex-shrink-0 w-[60vw] sm:hidden flex flex-col items-center justify-center snap-center bg-gray-800/40 border-2 border-dashed border-gray-700 rounded-3xl p-6 text-center gap-3 active:scale-95 transition-transform"
      onClick={onClick}
    >
      <div className="w-12 h-12 bg-purple-600/20 rounded-full flex items-center justify-center text-purple-400 text-xl">
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <div>
        <p className="text-white font-bold">{text}</p>
        <p className="text-[10px] text-gray-500 mt-1">{subText}</p>
      </div>
    </div>
  );

  return (
    <section className="pt-16 pb-20 px-4 text-center max-w-5xl mx-auto animate-fade-in-up">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium mb-6">
        <i className="fa-solid fa-rocket"></i>{" "}
        <span>專為 VTuber 打造的聯動平台</span>
      </div>
      <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-12 leading-tight">
        V-NEXUS <br />
        <br />
        讓是I人的你 <br className="my-2" />
        也可以找到
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-red-400">
          最佳聯動夥伴
        </span>
      </h1>
      <p className="text-gray-400 mb-4 max-w-2xl mx-auto text-lg leading-relaxed">
        大家平時要找聯動夥伴，是不是不知道該如何開口，又不敢隨便私訊怕打擾對方？
        <br className="hidden md:block" />
        註冊你的名片，找尋你的夥伴吧！
      </p>
      <p className="text-red-400 text-sm font-bold mb-10 max-w-2xl mx-auto">
        目前不開放YT訂閱或TWITCH追隨加起來低於500、尚未出道、長期準備中、一個月以上未有直播活動之Vtuber或經紀人加入，敬請見諒。
      </p>

      <div className="flex flex-col sm:flex-row justify-center items-start gap-4">
        <button
          onClick={() => navigate("grid")}
          className="h-14 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white px-8 rounded-xl font-bold shadow-[0_0_25px_rgba(168,85,247,0.5)] transition-transform hover:scale-105 w-full sm:w-auto flex items-center justify-center"
        >
          <i className="fa-solid fa-magnifying-glass mr-2"></i>開始尋找VT夥伴
        </button>
        <button
          onClick={() => navigate("dashboard")}
          className="h-14 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-8 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 w-full sm:w-auto flex items-center justify-center"
        >
          <i className="fa-solid fa-pen-to-square mr-2"></i>註冊Vtuber名片
        </button>
        <div className="flex flex-col items-center w-full sm:w-auto">
          <button
            onClick={onOpenUpdates}
            className="relative h-14 bg-blue-600 hover:bg-blue-500 text-white px-8 rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-transform hover:scale-105 flex items-center justify-center w-full sm:w-auto"
          >
            <i className="fa-solid fa-bullhorn mr-2"></i>最新消息/功能發布
            {hasUnreadUpdates && (
              <span className="absolute -top-2 -right-2 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-[#0f111a]"></span>
              </span>
            )}
          </button>
        </div>
        <div className="flex flex-col items-center w-full sm:w-auto mt-2 sm:mt-0">
          <button
            onClick={onOpenRules}
            className="h-14 bg-red-900/80 hover:bg-red-800 text-red-100 border border-red-500/50 px-8 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 flex items-center justify-center w-full sm:w-auto"
          >
            <i className="fa-solid fa-triangle-exclamation mr-2"></i>
            V-NEXUS聯動規範
          </button>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-6 mt-20 mb-8">
        <div className="bg-gray-800/40 border border-gray-700/50 px-8 py-6 rounded-3xl min-w-[220px] shadow-xl flex-1 max-w-[300px]">
          <p className="text-gray-400 text-sm font-bold mb-2 tracking-widest uppercase">
            網站總瀏覽人次
          </p>
          <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
            {siteStats?.pageViews !== null ? (
              <AnimatedCounter value={siteStats.pageViews} />
            ) : (
              <i className="fa-solid fa-spinner fa-spin text-2xl"></i>
            )}
          </p>
        </div>
        <div className="bg-gray-800/40 border border-gray-700/50 px-8 py-6 rounded-3xl min-w-[220px] shadow-xl flex-1 max-w-[300px]">
          <p className="text-gray-400 text-sm font-bold mb-2 tracking-widest uppercase">
            V-NEXUS已成功讓VTUBER聯動
          </p>
          <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
            {!isLoadingCollabs ? (
              <AnimatedCounter value={completedCollabsCount} />
            ) : (
              <i className="fa-solid fa-spinner fa-spin text-2xl"></i>
            )}
            <span className="text-xl text-gray-500 font-bold ml-1">次</span>
          </p>
        </div>
        <div className="bg-gray-800/40 border border-gray-700/50 px-8 py-6 rounded-3xl min-w-[220px] shadow-xl flex-1 max-w-[300px]">
          <p className="text-gray-400 text-sm font-bold mb-2 tracking-widest uppercase">
            目前VTUBER註冊人數
          </p>
          <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
            {registeredCount !== null ? (
              <AnimatedCounter value={registeredCount} />
            ) : (
              <i className="fa-solid fa-spinner fa-spin text-2xl"></i>
            )}
            <span className="text-xl text-gray-500 font-bold ml-1">位</span>
          </p>
        </div>
      </div>

      <p className="text-xs text-gray-500 font-medium tracking-widest mb-8 -mt-2">
        本網頁由 Gemini Pro 輔助生成｜企劃者 從APEX歸來的Dasa
      </p>

      {activeStatuses.length > 0 && (
        <div className="mt-8 mb-8 pt-12 border-t border-gray-800/50 w-full animate-fade-in-up">

          {/* 標題與按鈕區塊 */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
            <div className="text-left">
              <h2 className="text-2xl font-extrabold text-white mb-2 flex items-center gap-2">
                {/* 🌟 改為橘色 */}
                <i className="fa-solid fa-stopwatch text-orange-500 animate-pulse"></i>{" "}
                24H 最新動態
              </h2>
              <p className="text-gray-400 text-sm">
                看看大家現在正在做什麼！(至名片編輯即可發布，24小時後自動隱藏)
              </p>
            </div>
            {/* 電腦版按鈕群組 (靠右對齊) */}
            <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
              <button
                onClick={handleShuffleStatus}
                disabled={isShuffling}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-600 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {/* 🌟 改為橘色 */}
                <i className={`fa-solid fa-rotate-right ${isShuffling ? "animate-spin text-orange-400" : ""}`}></i> 換一批
              </button>
              <button
                onClick={() => navigate("status_wall")}
                // 🌟 改為橘色
                className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-pen-nib"></i> 發布我的動態
              </button>
            </div>
          </div>

          {/* 🌟 手機版橫向滑動 (flex overflow-x-auto)，電腦版 5 欄網格 (lg:grid-cols-5) */}
          <div
            className={`flex overflow-x-auto pb-6 gap-4 snap-x snap-mandatory sm:grid sm:grid-cols-3 lg:grid-cols-5 sm:overflow-visible custom-scrollbar transition-all duration-300 ease-in-out ${isShuffling ? "opacity-0 scale-95 blur-sm" : "opacity-100 scale-100 blur-0"
              }`}
          >
            {activeStatuses.map((v) => (
              <div
                key={v.id}
                onClick={() => {
                  setSelectedVTuber(v);
                  navigate(`profile/${v.id}`);
                }}
                // 🌟 改為橘色
                className="flex-shrink-0 w-[75vw] sm:w-auto snap-center bg-gray-800/60 border border-orange-500/30 hover:border-orange-400 rounded-3xl p-5 cursor-pointer transition-all hover:-translate-y-1 shadow-lg group flex flex-col gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={sanitizeUrl(v.avatar)}
                      // 🌟 改為橘色
                      className="w-12 h-12 rounded-full object-cover border-2 border-orange-500 group-hover:scale-105 transition-transform"
                    />
                    {/* 🌟 改為橘色 */}
                    <div className="absolute -bottom-1 -right-1 bg-orange-500 w-4 h-4 rounded-full border-2 border-gray-900 flex items-center justify-center">
                      <i className="fa-solid fa-bolt text-[8px] text-white"></i>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    {/* 🌟 改為橘色 */}
                    <h4 className="text-white font-bold truncate text-sm group-hover:text-orange-300 transition-colors">
                      {v.name}
                    </h4>
                    <p className="text-[10px] text-gray-400">
                      {/* 🌟 優化：套用相對時間 (發布了 X 分鐘) */}
                      {formatRelativeTime(v.statusMessageUpdatedAt)}
                    </p>
                  </div>
                </div>
                {/* 🌟 改為橘色漸層 */}
                <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl p-4 border border-orange-500/20 flex-1 text-left relative overflow-hidden">
                  <i className="fa-solid fa-quote-left absolute top-2 right-2 text-3xl text-orange-500/10"></i>
                  <p className="text-sm text-orange-100 line-clamp-3 leading-relaxed relative z-10 font-medium">
                    {v.statusMessage}
                  </p>
                </div>
              </div>
            ))}

            {/* 🌟 手機版最後的「觀看更多」卡片 */}
            <div className="flex-shrink-0 w-[60vw] sm:hidden">
              <MobileMoreCard
                onClick={() => navigate("status_wall")}
                icon="fa-bolt"
                text="觀看更多動態"
                subText="前往 24H 動態牆"
              />
            </div>
          </div>

          {/* 手機版按鈕群組 (顯示在卡片下方，並排顯示) */}
          <div className="mt-2 sm:hidden flex gap-3 justify-center">
            <button
              onClick={handleShuffleStatus}
              disabled={isShuffling}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-600 px-4 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* 🌟 改為橘色 */}
              <i className={`fa-solid fa-rotate-right ${isShuffling ? "animate-spin text-orange-400" : ""}`}></i> 換一批
            </button>
            <button
              onClick={() => navigate("status_wall")}
              // 🌟 改為橘色
              className="flex-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 px-4 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-pen-nib"></i> 發布動態
            </button>
          </div>

          {/* 🌟 電腦版下方的「觀看更多」按鈕 */}
          <div className="hidden sm:flex mt-8 justify-center">
            <button
              onClick={() => navigate("status_wall")}
              className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg transition-all hover:-translate-y-1 flex items-center gap-2 border border-gray-700"
            >
              <i className="fa-solid fa-bolt text-orange-400"></i> 觀看更多 24H 最新動態
            </button>
          </div>

        </div>
      )}

      {/* 歡迎新 VTuber */}
      {recommendedVtubers.length > 0 && (
        <div className="mt-8 mb-16 pt-12 border-t border-gray-800/50 w-full animate-fade-in-up">
          <div className="text-left mb-8">
            <h2 className="text-2xl font-extrabold text-white mb-2 flex items-center gap-2">
              <i className="fa-solid fa-heart-circle-bolt text-pink-500"></i>{" "}
              為您推薦跟你最契合的V朋朋
            </h2>
            <p className="text-gray-400 text-sm">
              系統透過 AI 與標籤分析，為您找出最適合聯動的潛在夥伴！快去看看他們的名片吧！
            </p>
          </div>

          {/* 手機版橫移，電腦版網格 */}
          <div className="flex items-stretch overflow-x-auto pb-6 gap-4 snap-x snap-mandatory sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 sm:overflow-visible custom-scrollbar">
            {recommendedVtubers.map((v) => (
              <div
                key={v.id}
                className="flex-shrink-0 w-[75vw] sm:w-auto snap-center text-left h-auto"
              >
                <VTuberCard
                  key={v.id}
                  v={v}
                  onSelect={() => {
                    setSelectedVTuber(v);
                    navigate(`profile/${v.id}`);
                  }}
                  onDislike={() => handleInitiateDislike(v)}
                />
              </div>
            ))}
            <div className="flex-shrink-0 w-[60vw] sm:hidden">
              <MobileMoreCard
                onClick={() => navigate("grid")}
                icon="fa-magnifying-glass"
                text="來這裡找更多夥伴"
                subText="查看完整 VTuber 名單"
              />
            </div>
          </div>

          <div className="hidden sm:flex mt-10 justify-center">
            <button
              onClick={() => navigate("grid")}
              className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg transition-all hover:-translate-y-1 flex items-center gap-2 border border-gray-700"
            >
              <i className="fa-solid fa-magnifying-glass text-purple-400"></i>{" "}
              來這裡找更多Vtuber夥伴
            </button>
          </div>
        </div>
      )}

      {/* 隨機招募區塊 */}
      <div className="mt-16 pt-16 border-t border-gray-800/50 w-full animate-fade-in-up">
        <div className="text-left mb-10">
          <h2 className="text-3xl font-extrabold text-white mb-2">
            <i className="fa-solid fa-bullhorn text-purple-400 mr-2"></i>
            來看看有哪些揪團！
          </h2>
          <p className="text-gray-400">
            正在尋找夥伴的企劃，或許就有你感興趣的！
          </p>
        </div>

        {randomBulletins.length > 0 ? (
          <div className="flex flex-col gap-10">
            <div className="flex overflow-x-auto pb-6 gap-4 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible custom-scrollbar">
              {randomBulletins.map((b) => (
                <div
                  key={b.id}
                  className="flex-shrink-0 w-[85vw] md:w-auto snap-center text-left"
                >
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
            <div className="hidden sm:flex justify-center">
              <button
                onClick={goToBulletin}
                className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-xl font-bold shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-transform hover:-translate-y-1 animate-pulse flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-bullhorn"></i>{" "}
                想找夥伴聯動嗎？看這裡！
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-800/30 rounded-3xl border border-gray-700">
            <p className="text-gray-500 font-bold text-lg">
              目前暫無招募中的企劃
            </p>
          </div>
        )}
      </div>

      {/* 為您隨機推薦聯動 */}
      <div className="mt-16 pt-16 border-t border-gray-800/50 w-full">
        <div className="text-left mb-10">
          <h2 className="text-3xl font-extrabold text-white mb-2">
            <i className="fa-solid fa-fire text-red-500 mr-2"></i>
            為您隨機推薦聯動
          </h2>
          <p className="text-gray-400">
            快來看看有哪些 VTuber 即將展開精彩合作！
          </p>
        </div>

        {randomCollabs.length > 0 ? (
          <div className="flex flex-col gap-10">
            <div className="flex overflow-x-auto pb-6 gap-6 snap-x snap-mandatory md:grid md:grid-cols-2 md:overflow-visible custom-scrollbar max-w-4xl mx-auto w-full">
              {randomCollabs.map((c) => (
                <div
                  key={c.id}
                  className="flex-shrink-0 w-[85vw] md:w-auto snap-center text-left"
                >
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
                icon="fa-broadcast-tower"
                text="查看完整聯動表"
                subText="掌握所有即將到來的直播"
              />
            </div>
            <div className="hidden sm:flex justify-center">
              <button
                onClick={() => navigate("collabs")}
                className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-transform hover:-translate-y-1"
              >
                查看完整確定聯動表{" "}
                <i className="fa-solid fa-arrow-right ml-2"></i>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-800/30 rounded-3xl border border-gray-700 max-w-4xl mx-auto">
            <p className="text-gray-500 font-bold text-lg">
              <i className="fa-solid fa-ghost mb-4 text-3xl block"></i>
              目前沒有即將到來的聯動行程
            </p>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-gray-700 pb-2 gap-3">
        <h3
          className={`text-xl font-bold ${isBlacklist ? "text-red-500" : title.includes("待") ? "text-yellow-400" : "text-white"}`}
        >
          {title} ({filteredList.length})
        </h3>
        {showSearch && (
          <div className="relative w-full sm:w-64">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
            <input
              type="text"
              placeholder="搜尋名稱、勢力或UID..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg py-1.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        )}
      </div>

      {filteredList.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center bg-gray-900/50 rounded-xl border border-dashed border-gray-800">
          目前無符合條件的資料
        </p>
      ) : (
        <div className="space-y-3">
          {displayList.map((v) => (
            <div
              key={v.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border ${isBlacklist ? "bg-red-950/20 border-red-900/50" : title.includes("待") ? "bg-gray-900 border-yellow-500/30" : "bg-gray-900 border-gray-700"} gap-4`}
            >
              <div className="flex items-center gap-4">
                <img
                  src={sanitizeUrl(v.avatar)}
                  className={`w-12 h-12 rounded-lg object-cover flex-shrink-0 ${isBlacklist ? "opacity-50 grayscale" : ""}`}
                />
                <div className="min-w-0">
                  <p
                    className={`font-bold text-sm flex items-center gap-2 ${isBlacklist ? "text-gray-400 line-through" : "text-white"}`}
                  >
                    {v.name || "（空白名片）"}
                    {v.isVerified && (
                      <i className="fa-solid fa-circle-check text-blue-400 text-xs"></i>
                    )}
                  </p>
                  {!isBlacklist && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {v.agency} |{" "}
                      {v.activityStatus === "sleep"
                        ? "休眠"
                        : v.activityStatus === "graduated"
                          ? "畢業"
                          : "活躍"}{" "}
                      | 推薦:{" "}
                      <span className="text-green-400">{v.likes || 0}</span> |
                      倒讚:{" "}
                      <span className="text-red-400">{v.dislikes || 0}</span>
                    </p>
                  )}

                  {/* 顯示驗證備註 */}
                  {privateDocs[v.id]?.verificationNote && (
                    <p className="text-[10px] text-yellow-400 mt-1.5 bg-yellow-500/10 p-1 rounded border border-yellow-500/20 inline-block">
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
                        className="text-[10px] text-red-400 hover:underline"
                      >
                        <i className="fa-brands fa-youtube"></i> YT
                      </a>
                    )}
                    {v.twitchUrl && (
                      <a
                        href={sanitizeUrl(v.twitchUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-purple-400 hover:underline"
                      >
                        <i className="fa-brands fa-twitch"></i> Twitch
                      </a>
                    )}
                    {v.xUrl && (
                      <a
                        href={sanitizeUrl(v.xUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-400 hover:underline"
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
                    className="text-green-400 bg-green-500/10 hover:bg-green-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    審核
                  </button>
                )}
                {onReject && (
                  <button
                    onClick={() => onReject(v.id)}
                    className="text-orange-400 bg-orange-500/10 hover:bg-orange-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    退回
                  </button>
                )}
                <button
                  onClick={() => onEdit(v)}
                  className="text-blue-400 bg-blue-500/10 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                >
                  編輯
                </button>
                <button
                  onClick={() => onDelete(v.id)}
                  className="text-red-400 bg-red-500/10 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
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
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${page === 1 ? "bg-gray-800 text-gray-600 cursor-not-allowed" : "bg-gray-700 text-white hover:bg-gray-600"}`}
          >
            上一頁
          </button>
          <span className="text-gray-400 text-xs font-bold">
            第 {page} / {totalPages} 頁
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${page === totalPages ? "bg-gray-800 text-gray-600 cursor-not-allowed" : "bg-gray-700 text-white hover:bg-gray-600"}`}
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
  handleAdminCleanBulletins // 👈 1. 補上這個缺失的 Prop
}) => {
  const [editingArticleId, setEditingArticleId] = useState(null);
  const [articleEditForm, setArticleEditForm] = useState({ title: '', category: '', content: '', coverUrl: '' });

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

      await sendSystemEmail({
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
          <h2 className="text-3xl font-extrabold text-red-400 mb-2">
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
              className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap flex items-center gap-2 ${activeTab === t.id ? "bg-red-600 text-white shadow-lg" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
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
        <div className="bg-gray-800/40 border border-gray-700 rounded-3xl p-6 shadow-2xl">
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
                <div className="mb-8 border border-orange-500/20 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setIsRejectedExpanded(!isRejectedExpanded)}
                    className="w-full flex items-center justify-between p-4 bg-orange-500/5 hover:bg-orange-500/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-orange-400">
                        已退回名單 ({rejectedVtubers.length})
                      </h3>
                      <span className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded">
                        點擊{isRejectedExpanded ? "收合" : "展開"}
                      </span>
                    </div>
                    <i
                      className={`fa-solid fa-chevron-${isRejectedExpanded ? "up" : "down"} text-orange-400`}
                    ></i>
                  </button>

                  {isRejectedExpanded && (
                    <div className="p-4 bg-gray-900/30">
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
              <div className="mt-12 pt-6 border-t border-red-500/50 flex flex-wrap gap-4">
                <button
                  onClick={onResetAllCollabTypes}
                  className="bg-red-900 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold"
                >
                  <i className="fa-solid fa-bomb mr-2"></i>重置所有人聯動類型
                </button>
                <button
                  onClick={onMassUpdateVerification}
                  disabled={isSyncingSubs}
                  className={`px-6 py-3 rounded-xl font-bold flex items-center ${isSyncingSubs ? "bg-blue-900/50 cursor-not-allowed text-gray-400" : "bg-blue-900 hover:bg-blue-700 text-white"}`}
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
                  className={`px-6 py-3 rounded-xl font-bold flex items-center ${isSyncingSubs ? "bg-red-900/50 cursor-not-allowed text-gray-400" : "bg-red-900 hover:bg-red-700 text-white"}`}
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
                  className={`px-6 py-3 rounded-xl font-bold flex items-center ${isSyncingSubs ? "bg-purple-900/50 cursor-not-allowed text-gray-400" : "bg-purple-900 hover:bg-purple-700 text-white"}`}
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
                  className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2"
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
                    className="flex justify-between bg-gray-900 p-4 rounded-xl border border-gray-700 gap-4"
                  >
                    <div className="flex-1">
                      <p className="text-sm text-gray-300 mb-1">{b.content}</p>
                      <p className="text-xs text-gray-500">
                        {authorName} | {postedAt}
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteBulletin(b.id)}
                      className="text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg font-bold"
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
                    <label className="text-xs text-gray-400 mb-1 block">
                      聯動類別 <span className="text-red-400">*</span>
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
                    <label className="text-xs text-gray-400 mb-1 block">
                      聯動時間 <span className="text-red-400">*</span>
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
                    <label className="text-xs text-gray-400 mb-1 block">
                      直播連結 <span className="text-red-400">*</span>
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
                        className="bg-gray-700 hover:bg-gray-600 text-white px-4 rounded-xl text-xs font-bold transition-colors"
                      >
                        <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>
                        抓取
                      </button>
                    </div>
                    <p className="text-[10px] text-purple-400/80 mt-1">
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
                  className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold"
                >
                  發布
                </button>
              </div>
              <div className="border-t border-gray-700 pt-6 space-y-4">
                <h3 className="text-lg font-bold text-white mb-4">現有清單</h3>
                {(collabs || []).map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between bg-gray-900 p-4 rounded-xl border border-gray-700"
                  >
                    <div>
                      <p className="font-bold text-white text-sm">
                        [{c.date} {c.time}] {c.title}
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteCollab(c.id)}
                      className="text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg"
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
                    <label className="text-xs text-gray-400 mb-1 block">
                      標題 <span className="text-red-400">*</span>
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
                    <label className="text-xs text-gray-400 mb-1 block">
                      內容 <span className="text-red-400">*</span>
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
                      className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg"
                    >
                      發布公告
                    </button>
                  </div>
                </form>
              </div>
              <div className="border-t border-gray-700 pt-6 space-y-4">
                <h3 className="text-lg font-bold text-white mb-4">歷史公告</h3>
                {(updates || []).map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col sm:flex-row sm:justify-between bg-gray-900 p-4 rounded-xl border border-gray-700 gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">
                        {u.title}{" "}
                        <span className="text-xs text-gray-500 font-normal ml-2">
                          {u.date}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {u.content}
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteUpdate(u.id)}
                      className="text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg flex-shrink-0 font-bold self-start"
                    >
                      刪除
                    </button>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-700 pt-6 mt-6">
                <h3 className="text-xl font-bold text-white mb-2">
                  <i className="fa-solid fa-envelope-open-text text-purple-400 mr-2"></i>
                  發送全站官方公告信件
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  此功能將發送 Email 至所有已填寫信箱的創作者。
                </p>
                <button
                  onClick={async () => {
                    const subject = prompt("請輸入公告信件主旨：");
                    if (!subject) return;
                    const content = prompt(
                      "請輸入公告信件內容：\n(將發送給所有有填寫公開或私人信箱的創作者)",
                    );
                    if (!content) return;
                    if (!confirm("確定要發送給所有創作者嗎？此動作不可逆！"))
                      return;
                    onSendMassEmail(subject, content);
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg"
                >
                  發送全站公告
                </button>
              </div>
            </div>
          )}

          {activeTab === 'articles' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white mb-4">寶典文章審核系統</h3>
              <div className="space-y-4">
                <h4 className="text-yellow-400 font-bold border-b border-gray-700 pb-2">待審核文章 ({(articles || []).filter(a => a.status === 'pending').length})</h4>
                {(articles || []).filter(a => a.status === 'pending').length === 0 ? <p className="text-gray-500 bg-gray-900/50 p-4 rounded-xl border border-dashed border-gray-700 text-center">無待審核文章</p> : (articles || []).filter(a => a.status === 'pending').map(a => (
                  <div key={a.id} className="bg-gray-900 border border-yellow-500/30 p-5 rounded-xl flex flex-col sm:flex-row gap-4 justify-between hover:border-yellow-500/60 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">{a.category}</span>
                        <span className="font-bold text-white text-lg">{a.title}</span>
                      </div>
                      <p className="text-gray-400 text-sm line-clamp-3 mt-2 bg-gray-800 p-3 rounded-lg">{a.content}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 self-start sm:self-center">
                      <button onClick={() => onVerifyArticle(a.id)} className="bg-green-600/80 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-transform hover:scale-105"><i className="fa-solid fa-check mr-1"></i>核准張貼</button>
                      <button onClick={() => { setEditingArticleId(a.id); setArticleEditForm({ title: a.title, category: a.category, content: a.content, coverUrl: a.coverUrl || '' }); }} className="bg-blue-600/80 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-transform hover:scale-105"><i className="fa-solid fa-pen mr-1"></i>編輯</button>
                      <button onClick={() => onDeleteArticle(a.id)} className="bg-red-600/80 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-transform hover:scale-105"><i className="fa-solid fa-xmark mr-1"></i>拒絕/刪除</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-4 mt-8 pt-8 border-t border-gray-700">
                <h4 className="text-green-400 font-bold border-b border-gray-700 pb-2">已發布文章 ({(articles || []).filter(a => a.status === 'published').length})</h4>
                {(articles || []).filter(a => a.status === 'published').map(a => (
                  <div key={a.id} className="bg-gray-800 border border-gray-700 p-4 rounded-xl flex justify-between items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-white truncate block">{a.title} <span className="text-xs text-blue-400 font-normal ml-2 bg-blue-500/10 px-2 py-0.5 rounded">({a.category})</span></span>
                    </div>
                    <button onClick={() => { setEditingArticleId(a.id); setArticleEditForm({ title: a.title, category: a.category, content: a.content, coverUrl: a.coverUrl || '' }); }} className="text-blue-400 bg-blue-500/10 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex-shrink-0">編輯</button>
                    <button onClick={() => onDeleteArticle(a.id)} className="text-red-400 bg-red-500/10 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex-shrink-0">強制刪除</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {editingArticleId && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
                <div className="bg-gray-800 px-6 py-4 border-b border-gray-700 flex justify-between items-center">
                  <h3 className="font-bold text-white"><i className="fa-solid fa-pen text-blue-400 mr-2"></i>編輯文章</h3>
                  <button onClick={() => setEditingArticleId(null)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-1">標題</label>
                    <input type="text" value={articleEditForm.title} onChange={e => setArticleEditForm({ ...articleEditForm, title: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-1">分類</label>
                      <select value={articleEditForm.category} onChange={e => setArticleEditForm({ ...articleEditForm, category: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-blue-500">
                        {ARTICLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-1">封面網址 (不改請留空)</label>
                      <input type="text" value={articleEditForm.coverUrl} onChange={e => setArticleEditForm({ ...articleEditForm, coverUrl: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-1">內文</label>
                    <textarea rows="10" value={articleEditForm.content} onChange={e => setArticleEditForm({ ...articleEditForm, content: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-blue-500 font-mono text-sm" />
                  </div>
                </div>
                <div className="bg-gray-800 px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
                  <button onClick={() => setEditingArticleId(null)} className="px-4 py-2 text-gray-400 hover:text-white font-bold transition-colors">取消</button>
                  <button onClick={() => { onEditArticle(editingArticleId, articleEditForm); setEditingArticleId(null); }} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow transition-transform hover:scale-105">儲存修改</button>
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
                  className="bg-red-600 text-white px-8 py-2.5 rounded-xl font-bold"
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
                  className="bg-red-600 text-white px-8 py-2.5 rounded-xl font-bold"
                >
                  儲存小技巧
                </button>
              </div>

              <div className="mt-8 border-t border-gray-700 pt-8">
                <h3 className="text-xl font-bold text-white mb-2">
                  <i className="fa-solid fa-images text-purple-400 mr-2"></i>
                  招募佈告欄預設圖片庫
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  當使用者發布招募沒有上傳圖片時，將從這裡隨機挑選一張顯示。
                </p>
                <div className="flex flex-wrap gap-4 mb-4">
                  {(defaultBulletinImages || []).map((img, idx) => (
                    <div key={idx} className="relative group w-32 h-24">
                      <img
                        src={sanitizeUrl(img)}
                        className="w-full h-full object-cover rounded-xl border border-gray-600"
                      />
                      <button
                        onClick={() => onDeleteDefaultBulletinImage(idx)}
                        className="absolute top-1 right-1 bg-red-600/90 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
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
                  <button className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-xl border border-gray-600 transition-colors flex items-center justify-center gap-2">
                    <i className="fa-solid fa-plus"></i> 新增預設圖片
                  </button>
                </div>
              </div>

              <div className="mt-8 border-t border-gray-700 pt-8">
                <h3 className="text-xl font-bold text-white mb-2">
                  <i className="fa-solid fa-envelope-circle-check text-blue-400 mr-2"></i>
                  Email 系統測試
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  如果 Firebase 後台沒有看到 mail
                  路徑，請點擊下方按鈕寫入一筆測試資料，路徑就會自動出現。
                </p>
                <button
                  onClick={handleTestMail}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg"
                >
                  寫入一筆測試信件
                </button>
              </div>
              <div className="mt-8 border-t border-gray-700 pt-8">
                <h3 className="text-xl font-bold text-white mb-2">
                  <i className="fa-brands fa-youtube text-red-500 mr-2"></i>
                  YouTube API 測試
                </h3>
                <p className="text-sm text-gray-400 mb-4">
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
                    className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg whitespace-nowrap"
                  >
                    測試抓取
                  </button>
                </div>
              </div>
              <div className="mt-8 border-t border-gray-700 pt-8">
                <h3 className="text-xl font-bold text-white mb-2">
                  <i className="fa-brands fa-twitch text-purple-400 mr-2"></i>
                  Twitch API 測試
                </h3>
                <p className="text-sm text-gray-400 mb-4">
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
                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg whitespace-nowrap"
                  >
                    測試抓取
                  </button>
                </div>
              </div>
              <div className="mt-8 border-t border-gray-700 pt-8">
                <h3 className="text-xl font-bold text-white mb-2">
                  <i className="fa-solid fa-mobile-screen-button text-blue-400 mr-2"></i>
                  手機推播功能測試
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  此功能僅限在手機「加入主畫面」後使用。點擊按鈕將發送一則推播通知給您自己。
                </p>
                <button
                  onClick={onTestPush}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-transform hover:scale-105"
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
                  className="bg-red-900 text-white px-4 py-2 rounded-lg ml-4"
                >
                  清理過期訊息
                </button>
              </div>

              <div className="mt-8 border-t border-gray-700 pt-8">
                <h3 className="text-xl font-bold text-white mb-2">
                  <i className="fa-solid fa-clock-rotate-left text-orange-400 mr-2"></i>
                  聯動提醒系統測試
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  點擊下方按鈕將建立一筆「1小時後開始」的虛擬聯動行程。建立後，系統會自動偵測並立即發送提醒信件至您的信箱，以確認提醒功能正常運作。
                </p>
                <button
                  onClick={onTestReminder}
                  className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-transform hover:scale-105"
                >
                  立即測試 24h 提醒寄送
                </button>
                <button
                  onClick={onMassMigrateImages}
                  disabled={isSyncingSubs}
                  className={`px-6 py-3 rounded-xl font-bold flex items-center mt-4 ${isSyncingSubs ? "bg-emerald-900/50 cursor-not-allowed text-gray-400" : "bg-emerald-700 hover:bg-emerald-600 text-white"}`}
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
                  className={`px-6 py-3 rounded-xl font-bold flex items-center mt-4 ${isSyncingSubs ? "bg-teal-900/50 cursor-not-allowed text-gray-400" : "bg-teal-700 hover:bg-teal-600 text-white"}`}
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
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl">
            <div className="sticky top-0 bg-gray-900/95 backdrop-blur px-6 py-4 border-b border-gray-800 flex justify-between items-center z-10">
              <h3 className="font-bold text-white">
                <i className="fa-solid fa-pen-to-square mr-2"></i>強制編輯：
                {editingVtuber.name}
              </h3>
              <button
                onClick={() => setEditingVtuber(null)}
                className="text-gray-400 hover:text-white"
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
      <div className="p-4 text-center text-gray-500 text-sm">
        目前沒有任何私訊紀錄
      </div>
    );

  return (
    <div className="max-h-80 overflow-y-auto bg-[#0f111a] custom-scrollbar">
      {rooms.map((room) => {

        // 🌟 核心修復 2：同樣從 roomId 切割出雙方的 UID
        const uids = room.id.split('_');
        const targetId = uids.find((id) => id !== currentUser.uid);


        if (!targetId) return null;

        let target = vtubers.find((v) => v.id === targetId) || missingUsers[targetId];

        if (!target) return (
          <div key={room.id} className="p-3 text-center text-gray-600 text-xs animate-pulse">
            載入對話資訊中...
          </div>
        );

        const isUnread = room.unreadBy && room.unreadBy.includes(currentUser.uid);
        const isOnline = onlineUsers.has(target.id);

        return (
          <div
            key={room.id}
            onClick={() => onOpenChat(target)}
            // 🌟 優化 1：加上 active:bg-gray-800，讓手機點擊時有按下去的視覺回饋
            className="flex items-center gap-3 p-3 border-b border-gray-800 hover:bg-gray-800 active:bg-gray-800 cursor-pointer transition-colors group relative"
          >
            <div className="relative flex-shrink-0">
              <img
                src={sanitizeUrl(target.avatar)}
                className="w-10 h-10 rounded-full object-cover bg-gray-900 border border-gray-700 md:group-hover:border-purple-500 transition-colors"
              />
              {/* 🌟 綠點疊加在頭像右下角 */}
              {onlineUsers?.has(target.id) && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-900 rounded-full"></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1">
                <span
                  className={`text-sm truncate ${isUnread ? "font-black text-white" : "font-bold text-gray-300"}`}
                >
                  {target.name}
                </span>
                <span className="text-[10px] text-gray-500">
                  {formatTime(room.lastTimestamp)}
                </span>
              </div>
              <p
                className={`text-xs truncate ${isUnread ? "text-purple-400 font-bold" : "text-gray-400"}`}
              >
                {room.lastMessage}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isUnread && (
                <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
              )}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // 🌟 修正：子元件接收的屬性名稱是 onDeleteChat，不是 handleDeleteChat！
                  onDeleteChat(e, room.id);
                }}
                className="relative z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 p-3 -mr-2 text-gray-500 hover:text-red-400 transition-all"
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

  // 🌟 新增：限時動態 (Stories) 狀態
  const [realStories, setRealStories] = useState([]);
  const [storyInput, setStoryInput] = useState("");

  const [onlineUsers, setOnlineUsers] = useState(new Set());

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

      await updateDoc(doc(db, getPath('vtubers'), user.uid), {
        statusMessage: content,
        statusMessageUpdatedAt: now,
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
            ? { ...v, statusMessage: content, statusMessageUpdatedAt: now, statusReactions: { plus_one: [], watching: [], fire: [] }, updatedAt: now }
            : v
        );
        syncVtuberCache(newList);
        return newList;
      });

      setProfileForm(prev => ({ ...prev, statusMessage: content }));
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
  const [user, setUser] = useState(null);
  const [realVtubers, setRealVtubers] = useState(() => {
    const cached = localStorage.getItem(VTUBER_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  });
  const isAdmin = user && user.email === "apex.dasa@gmail.com";
  const myProfile = user ? realVtubers.find((v) => v.id === user.uid) : null;
  const isVerifiedUser = isAdmin || (myProfile?.isVerified && !myProfile?.isBlacklisted && myProfile?.activityStatus === "active");

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
        await updateDoc(doc(db, getPath("vtubers"), user.uid), {
          fcmToken: currentToken,
          notificationsEnabled: true,
        });
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
        fromUserId: "system",
        fromUserName: "V-Nexus 測試員",
        fromUserAvatar: "https://duk.tw/u1jpPE.png",
        message: "🎉 恭喜！您的手機推播功能已成功啟動！",
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

  // --- 自動提醒檢查邏輯 (Lazy Cron) ---
  useEffect(() => {
    // 只有管理員在線上時才會執行掃描
    if (isLoading || !isAdmin) return;

    const checkAndSendReminders = async () => {
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      // 搜尋 24 小時內即將開始，且尚未發送提醒的行程
      const q = query(
        collection(db, getPath("collabs")),
        where("reminderSent", "==", false),
        where("startTimestamp", "<=", now + twentyFourHours),
        where("startTimestamp", ">", now),
      );

      const snap = await getDocs(q);

      for (const collabDoc of snap.docs) {
        const collab = { id: collabDoc.id, ...collabDoc.data() };

        // 立即標記為已發送，防止重複觸發
        await updateDoc(collabDoc.ref, { reminderSent: true });

        // 整理所有需要通知的人 (發起人 + 參與者)
        const allMemberIds = [collab.userId, ...(collab.participants || [])];
        const sendSystemEmail = httpsCallable(functionsInstance, "sendSystemEmail");

        for (const uid of allMemberIds) {
          // 抓取該成員的 Email (優先從資料庫抓取最新私密資料)
          const privSnap = await getDoc(doc(db, getPath("vtubers_private"), uid));
          const pubSnap = await getDoc(doc(db, getPath("vtubers"), uid));

          let targetEmail = "";
          if (privSnap.exists()) targetEmail = privSnap.data().contactEmail || privSnap.data().publicEmail;
          if (!targetEmail && pubSnap.exists()) targetEmail = pubSnap.data().publicEmail;

          if (targetEmail && targetEmail.includes('@')) {
            sendSystemEmail({
              to: targetEmail,
              subject: `[V-Nexus 聯動提醒] 行程即將開始！⏰`,
              text: `您好！提醒您，您參與的聯動行程【${collab.title}】即將在 24 小時內開始！\n\n預計時間：${collab.date} ${collab.time}\n直播連結：${collab.streamUrl}\n\n祝聯動順利！\nV-Nexus 團隊`,
            }).catch(e => console.error("提醒信發送失敗:", e));
          }
        }
      }
    };

    // 每 5 分鐘自動檢查一次
    checkAndSendReminders();
    const reminderTimer = setInterval(checkAndSendReminders, 5 * 60 * 1000);
    return () => clearInterval(reminderTimer);
  }, [isLoading, isAdmin, realCollabs]);
  // --- 提醒邏輯結束 ---

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
        "home", "grid", "profile", "match", "blacklist", "dashboard", "admin", "bulletin", "collabs", "articles"
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
        sendEmail: true,
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

      // 🔒 寫入通知並標記 sendEmail 觸發後端
      await addDoc(collection(db, getPath("notifications")), {
        userId: senderId,
        fromUserId: user.uid,
        fromUserName: myProfile?.name || user.displayName || "某位創作者",
        fromUserAvatar: myProfile?.avatar || user.photoURL,
        message: replyMsg,
        type: "brave_response",
        sendEmail: true,
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
    return ["All", ...Array.from(days).sort()];
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
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);

      // 解決手機版無法跳回頂部的問題
      setTimeout(() => {
        // 1. 執行標準滾動
        window.scrollTo({ top: 0, behavior: "auto" });

        // 2. 針對部分手機瀏覽器 (如 iOS Safari) 的強制補強
        document.body.scrollTop = 0; // 針對舊版 Chrome/Safari
        document.documentElement.scrollTop = 0; // 針對 Firefox/IE/新版 Chrome

        // 3. 如果你有導航欄遮擋問題，可以滾動到稍微靠下的位置 (選配)
        // window.scrollTo(0, 0);
      }, 50); // 50 毫秒的延遲足以讓手機完成畫面切換
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

    const targetUid = customForm.id || user.uid;
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
      const targetUid = customForm.id || user.uid;

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

      const existingProfile = realVtubers.find((v) => v.id === targetUid);
      const finalPersonality =
        customForm.personalityType === "其他"
          ? customForm.personalityTypeOther || "其他"
          : customForm.personalityType || "";

      // 🌟 關鍵修復：只要輸入框裡面有字，每次按下「儲存名片」就強制刷新 24 小時的計時器！
      // 這樣使用者隨時可以按儲存來延長動態的顯示時間。
      const newStatusMessageUpdatedAt = customForm.statusMessage?.trim() ? Date.now() : 0;

      let newStatusReactions = existingProfile?.statusReactions || { plus_one: [], watching: [], fire: [] };
      if (customForm.statusMessage !== existingProfile?.statusMessage) {
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
        slug: (customForm.slug || "").trim().toLowerCase(),
        personalityType: finalPersonality,
        // 🌟 新增：寫入限時動態資料
        statusMessage: customForm.statusMessage || "",
        statusMessageUpdatedAt: newStatusMessageUpdatedAt,
        lastActiveAt: Date.now(),
        updatedAt: Date.now(),
        createdAt: existingProfile?.createdAt || Date.now(),
      };

      // 💡 關鍵修正：移除 UI 狀態欄位與可能為 undefined 的欄位
      const uiFields = [
        "contactEmail",
        "verificationNote",
        "publicEmail",
        "publicEmailVerified",
        "isOtherCollab",
        "otherCollabText",
        "isOtherNationality",
        "otherNationalityText",
        "personalityTypeOther",
        "lastEmailSentAt",
        "lastNotifSentAt",
        "rejectionCount",
        "lastRejectedAt"
      ];
      uiFields.forEach((f) => delete publicData[f]);

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
      await setDoc(doc(db, getPath("vtubers"), targetUid), publicData, {
        merge: true,
      });
      await setDoc(
        doc(db, getPath("vtubers_private"), targetUid),
        privateData,
        { merge: true },
      );

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
      showToast(`❌ 儲存失敗: ${err.message.slice(0, 20)}...`);
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

      await updateDoc(doc(db, getPath("vtubers"), uid), {
        statusMessage: content,
        statusMessageUpdatedAt: now,
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
          v.id === uid ? { ...v, statusMessage: content, statusMessageUpdatedAt: now, statusReactions: { plus_one: [], watching: [], fire: [] }, updatedAt: now } : v
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
        sendEmail: false,
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
      console.error("發布招募失敗:", err);
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
      showToast("❌ 請先登入並建立名片！正在前往認證頁面...");
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
        // 🔒 統一寫入通知，並標記 sendEmail: true 觸發後端寄信
        addDoc(collection(db, getPath("notifications")), {
          userId: bulletinAuthorId,
          fromUserId: user.uid,
          fromUserName: myProfile?.name || user.displayName || "某位創作者",
          fromUserAvatar: myProfile?.avatar || user.photoURL,
          message: "對您的招募企劃表達了意願！快去招募佈告欄看看！",
          type: "bulletin_apply",
          sendEmail: true,
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
    try {
      const updates = {
        isVerified: true,
        verificationStatus: "approved",
        showVerificationModal: "approved",
        // 🌟 新增：審核通過後，將退回次數歸零，重新計算
        rejectionCount: 0,
      };
      // 1. 更新名片狀態
      await setDoc(doc(db, getPath("vtubers"), id), updates, { merge: true });

      setRealVtubers((prev) => {
        const newList = prev.map((v) => (v.id === id ? { ...v, ...updates } : v));
        syncVtuberCache(newList);
        return newList;
      });
      showToast("已通過審核！");

      // 2. 取得 Email (直接從資料庫抓取，防止 State 延遲)
      const targetVtuber = realVtubers.find((v) => v.id === id);
      let emailToSend = targetVtuber?.publicEmail;

      const privSnap = await getDoc(doc(db, getPath("vtubers_private"), id));
      if (privSnap.exists()) {
        const privData = privSnap.data();
        emailToSend = privData.contactEmail || privData.publicEmail || emailToSend;
      }

      if (emailToSend) {
        const sendSystemEmail = httpsCallable(functionsInstance, "sendSystemEmail");
        // 務必使用 await
        await sendSystemEmail({
          to: emailToSend,
          subject: `[V-Nexus] 關於您的創作者名片審核結果通知 🎉`,
          text: `您好，${targetVtuber?.name || '創作者'}！恭喜您的名片已通過審核並正式上架，趕快回VNEXUS找新夥伴吧！https://www.vnexus2026.com/。`,
        });
      }
    } catch (err) {
      console.error("審核通過處理出錯:", err);
      showToast("❌ 審核失敗");
    }
  };

  const handleRejectVtuber = async (id) => {
    if (!confirm("確定要退回/拒絕這張名片嗎？")) return;
    try {
      // 🌟 新增：取得目前的退回次數，並 +1
      const targetVtuber = realVtubers.find((v) => v.id === id);
      const currentRejectionCount = targetVtuber?.rejectionCount || 0;

      const updates = {
        isVerified: false,
        verificationStatus: "rejected",
        showVerificationModal: "rejected",
        // 🌟 新增：寫入新的退回次數與退回時間
        rejectionCount: currentRejectionCount + 1,
        lastRejectedAt: Date.now(),
      };

      // 1. 更新名片狀態
      await setDoc(doc(db, getPath("vtubers"), id), updates, { merge: true });

      setRealVtubers((prev) => {
        const newList = prev.map((v) => (v.id === id ? { ...v, ...updates } : v));
        syncVtuberCache(newList);
        return newList;
      });

      showToast("🟠 已退回該名片至退回名單。");

      // 2. 取得 Email
      let emailToSend = targetVtuber?.publicEmail;

      const privSnap = await getDoc(doc(db, getPath("vtubers_private"), id));
      if (privSnap.exists()) {
        const privData = privSnap.data();
        emailToSend = privData.contactEmail || privData.publicEmail || emailToSend;
      }

      if (emailToSend) {
        const sendSystemEmail = httpsCallable(functionsInstance, "sendSystemEmail");
        await sendSystemEmail({
          to: emailToSend,
          subject: `[V-Nexus] 關於您的創作者名片審核結果通知 ⚠️`,
          text: `您好，${targetVtuber?.name || '創作者'}！很抱歉，您的名片未能通過審核，請回VNEXUS查看原因並修改。https://www.vnexus2026.com/`,
        });
      }
    } catch (err) {
      console.error("審核退回處理出錯:", err);
      showToast("❌ 操作失敗");
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
          const imageRef = ref(storage, `bulletin_covers/${docSnap.id}_${Date.now()}.jpg`);

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
    let count = 0;
    const sendSystemEmail = httpsCallable(functionsInstance, "sendSystemEmail");
    for (const v of realVtubers) {
      const email = privateDocs[v.id]?.contactEmail || v.publicEmail;
      if (email && email.includes("@")) {
        sendSystemEmail({
          to: email,
          subject: `[V-Nexus 官方公告] ${subject}`,
          text: `您好，${v.name}！\n\n${content}\n\n祝 聯動順利！\nV-Nexus 團隊`,
        }).catch(console.error);
        count++;
      }
    }
    showToast(`✅ 已發送 ${count} 封官方公告信件！`);
  };

  const contextValue = useMemo(() => {
    return { user, isVerifiedUser, isAdmin, showToast, realVtubers, onlineUsers };
  }, [user, isVerifiedUser, isAdmin, showToast, realVtubers, onlineUsers]);


  return (
    <AppContext.Provider value={contextValue}>
      <div className="flex flex-col min-h-screen relative">
        {toastMsg && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-purple-500 text-white px-6 py-3 rounded-full shadow-[0_0_20px_rgba(168,85,247,0.3)] flex items-center gap-3 font-bold text-sm">
            <i className="fa-solid fa-circle-info text-purple-400"></i> {toastMsg}
          </div>
        )}

        <nav className="sticky top-0 z-40 backdrop-blur-md bg-[#0f111a]/95 border-b border-gray-800 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="h-16 flex items-center justify-between">
              <div
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => navigate("home")}
              >
                <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-lg group-hover:shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all">
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
                      <i className="fa-brands fa-google text-red-500"></i> Google
                      登入
                    </button>
                    <button
                      onClick={handleLoginOther}
                      className="hidden sm:block text-gray-400 hover:text-white text-xs font-bold transition-colors"
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
                        className="text-gray-300 hover:text-white p-2 text-xl relative transition-colors"
                      >
                        <i className="fa-solid fa-bell"></i>
                        {unreadCount > 0 && (
                          <span className="absolute top-1 right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 text-[8px] text-white flex items-center justify-center">
                              {unreadCount}
                            </span>
                          </span>
                        )}
                      </button>
                      {isNotifOpen && (
                        // 🌟 完美置中修復：改用 left-0 right-0 mx-auto，徹底避免與 animate-fade-in-up 的 transform 動畫衝突！
                        <div className="fixed left-0 right-0 mx-auto top-16 mt-2 w-[90vw] sm:absolute sm:left-auto sm:right-0 sm:mx-0 sm:w-80 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in-up">
                          <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
                            <span className="font-bold text-white text-sm">
                              站內小鈴鐺
                            </span>
                            {unreadCount > 0 && (
                              <button
                                onClick={markAllAsRead}
                                className="text-xs text-purple-400 hover:text-purple-300"
                              >
                                全部已讀
                              </button>
                            )}
                          </div>
                          <div className="max-h-80 overflow-y-auto">
                            {myNotifications.length === 0 ? (
                              <div className="p-6 text-center text-gray-500 text-sm">
                                目前沒有任何通知
                              </div>
                            ) : (
                              myNotifications.slice(0, 5).map((n) => (
                                <div
                                  key={n.id}
                                  onClick={() => handleNotifClick(n)}
                                  className={`p-3 border-b border-gray-800 flex gap-3 hover:bg-gray-800/50 cursor-pointer transition-colors ${!n.read ? "bg-purple-900/10" : ""}`}
                                >
                                  <img
                                    src={sanitizeUrl(
                                      n.fromUserAvatar ||
                                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Anon",
                                    )}
                                    className="w-10 h-10 rounded-full bg-gray-800 object-cover flex-shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-300 leading-snug">
                                      <span className="font-bold text-white hover:text-purple-400 transition-colors">
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
                                          className="flex-1 bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white text-[10px] font-bold py-1 rounded border border-green-600/30 transition-colors"
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
                                          className="flex-1 bg-gray-700/50 text-gray-400 hover:bg-gray-600 hover:text-white text-[10px] font-bold py-1 rounded border border-gray-600/50 transition-colors"
                                        >
                                          委婉拒絕
                                        </button>
                                      </div>
                                    )}
                                    <p className="text-[10px] text-gray-500 mt-1">
                                      {formatTime(n.createdAt)}
                                    </p>
                                  </div>
                                  {!n.read && (
                                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                          <div className="p-2 border-t border-gray-800 bg-gray-800/80 text-center">
                            <button
                              onClick={() => {
                                setIsNotifOpen(false);
                                navigate("inbox");
                              }}
                              className="text-xs text-purple-400 font-bold hover:text-purple-300 w-full py-1"
                            >
                              前往專屬信箱查看完整通知{" "}
                              <i className="fa-solid fa-arrow-right ml-1"></i>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => navigate("dashboard")}
                      className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 px-3 py-1.5 rounded-full transition-colors relative whitespace-nowrap"
                    >
                      <img
                        src={sanitizeUrl(
                          user.photoURL ||
                          "https://api.dicebear.com/7.x/avataaars/svg?seed=Anon",
                        )}
                        className="w-5 h-5 rounded-full"
                      />
                      <span className="text-gray-300 text-xs font-bold truncate max-w-[80px] hidden sm:block">
                        {user.displayName || "創作者"}
                      </span>
                      {realVtubers.find(
                        (v) => v.id === user.uid && !v.isVerified,
                      ) && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                          </span>
                        )}
                    </button>
                    <button
                      onClick={handleLogout}
                      className="text-gray-500 hover:text-red-400 text-xs font-bold whitespace-nowrap"
                      title="登出"
                    >
                      <i className="fa-solid fa-right-from-bracket"></i>
                    </button>
                  </div>
                )}
                {isAdmin && (
                  <button onClick={() => navigate('admin')} className={`transition-colors px-3 py-1.5 font-bold text-sm whitespace-nowrap flex items-center ${currentView === 'admin' ? 'text-red-500 border-b-2 border-red-600' : 'text-red-400/70 hover:text-red-400'}`}>
                    <i className="fa-solid fa-shield-halved mr-1"></i> 管理員
                    {(pendingVtubersCount > 0 || realArticles.filter(a => a.status === 'pending').length > 0) && (
                      <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1 animate-pulse">
                        {pendingVtubersCount + realArticles.filter(a => a.status === 'pending').length}
                      </span>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="lg:hidden text-gray-300 p-2 text-2xl ml-1"
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
                className={`transition-colors px-3 py-1.5 font-bold text-sm whitespace-nowrap ${currentView === "home" ? "text-purple-400 border-b-2 border-purple-500" : "text-gray-400 hover:text-white"}`}
              >
                首頁介紹
              </button>
              <button
                onClick={() => navigate("grid")}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-full font-bold transition-all text-sm whitespace-nowrap animate-glow-pulse ${currentView === "grid" || currentView === "profile"
                  ? "bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white shadow-[0_0_25px_rgba(168,85,247,0.8)] scale-105 border border-white/30"
                  : "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:scale-105 hover:shadow-[0_0_20px_rgba(168,85,247,0.6)]"
                  }`}
              >
                <i className="fa-solid fa-magnifying-glass"></i> 尋找 VTuber 夥伴
              </button>
              {/* 🌟 互換：24H火速揪團大廳移到前面 */}
              <button
                onClick={() => navigate("status_wall")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold transition-colors text-sm whitespace-nowrap ${currentView === "status_wall" ? "bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)]" : "bg-orange-600 text-white hover:bg-orange-500 shadow-md border border-orange-500/50"}`}
              >
                <i className="fa-solid fa-bolt"></i> 24H動態牆火速揪團
              </button>

              <button
                onClick={() => navigate("bulletin")} // 直接跳轉
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm whitespace-nowrap ${currentView === "bulletin" ? "bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)]" : "bg-rose-600 text-white hover:bg-rose-500 shadow-md border border-rose-500/50"}`}
              >
                <i className="fa-solid fa-bullhorn"></i> 揪團佈告欄
                {!isVerifiedUser && <span className="text-[10px] ml-1 opacity-70">(需認證)</span>}
              </button>

              <button
                onClick={() => navigate("collabs")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold transition-colors text-sm whitespace-nowrap ${currentView === "collabs" ? "bg-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]" : "bg-red-600 text-white hover:bg-red-500 shadow-md border border-red-500/50"}`}
              >
                <i className="fa-solid fa-broadcast-tower"></i> 確定聯動
              </button>
              <button onClick={() => { if (!isVerifiedUser) { showToast("請先認證名片解鎖此功能"); navigate('dashboard'); } else navigate('articles'); }} className={`transition-colors px-3 py-1.5 font-bold text-sm whitespace-nowrap ${currentView === 'articles' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-blue-400/70 hover:text-blue-400'}`}><i className="fa-solid fa-book-open mr-1"></i> Vtuber寶典{!isVerifiedUser && ' 🔒'}</button>
              {user && (
                <button
                  onClick={() => navigate("inbox")}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm whitespace-nowrap ${currentView === "inbox" ? "bg-purple-500 text-white shadow-lg" : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"}`}
                >
                  <i className="fa-solid fa-envelope-open-text"></i> 我的信箱
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                      {unreadCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
          {isMobileMenuOpen && (
            <div className="lg:hidden absolute top-16 left-0 w-full bg-[#0f111a]/95 backdrop-blur-md border-b border-gray-800 shadow-xl flex flex-col p-4 gap-4 z-50 animate-fade-in-up">
              <button
                onClick={() => navigate("home")}
                className={`text-left px-4 py-3 rounded-xl font-bold ${currentView === "home" ? "bg-purple-600 text-white" : "text-gray-300 hover:bg-gray-800"}`}
              >
                首頁介紹
              </button>
              <button
                onClick={() => navigate("grid")}
                className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all ${currentView === "grid" || currentView === "profile"
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.5)]"
                  : "bg-gradient-to-r from-purple-600/90 to-pink-600/90 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                  }`}
              >
                <i className="fa-solid fa-magnifying-glass w-5"></i> 尋找 VTuber
                夥伴
              </button>
              <button
                onClick={() => navigate("status_wall")}
                className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === "status_wall" ? "bg-orange-500 text-white shadow-lg" : "bg-orange-600 text-white hover:bg-orange-500"}`}
              >
                <i className="fa-solid fa-bolt w-5"></i> 24H動態牆火速揪團
              </button>

              <button
                onClick={() => {
                  if (!isVerifiedUser) {
                    showToast("請先認證名片解鎖");
                    navigate("dashboard");
                  } else navigate("bulletin");
                }}
                className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === "bulletin" ? "bg-rose-500 text-white shadow-lg" : "bg-rose-600 text-white hover:bg-rose-500"}`}
              >
                <i className="fa-solid fa-bullhorn w-5"></i> 揪團佈告欄
              </button>

              <button
                onClick={() => navigate("collabs")}
                className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === "collabs" ? "bg-red-500 text-white shadow-lg" : "bg-red-600 text-white hover:bg-red-500"}`}
              >
                <i className="fa-solid fa-broadcast-tower w-5"></i> 確定聯動
              </button>
              <button
                onClick={() => {
                  if (!isVerifiedUser) {
                    showToast("請先認證名片解鎖");
                    navigate("dashboard");
                  } else navigate("match");
                }}
                className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === "match" ? "bg-purple-600 text-white" : "text-gray-300 hover:bg-gray-800"}`}
              >
                <i className="fa-solid fa-dice w-5"></i> 聯動隨機配對
              </button>
              <button onClick={() => { if (!isVerifiedUser) { showToast("請先認證名片解鎖此功能"); navigate('dashboard'); } else navigate('articles'); }} className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === 'articles' ? 'bg-blue-900/50 text-blue-400' : 'text-blue-400/70 hover:bg-blue-900/30'}`}><i className="fa-solid fa-book-open w-5"></i> Vtuber寶典{!isVerifiedUser && ' 🔒'}</button>
              {user && (
                <button
                  onClick={() => navigate("inbox")}
                  className={`text-left px-4 py-3 rounded-xl font-bold flex items-center justify-between ${currentView === "inbox" ? "bg-purple-600 text-white" : "text-gray-300 hover:bg-gray-800"}`}
                >
                  <div className="flex items-center gap-3">
                    <i className="fa-solid fa-envelope-open-text w-5"></i>{" "}
                    我的信箱
                  </div>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>
              )}
              {isAdmin && (
                <button onClick={() => navigate('admin')} className={`text-left px-4 py-3 rounded-xl font-bold text-red-400 hover:bg-red-500/10 flex items-center justify-between`}>
                  <div className="flex items-center gap-3"><i className="fa-solid fa-shield-halved w-5"></i> 系統管理員</div>
                  {(pendingVtubersCount > 0 || realArticles.filter(a => a.status === 'pending').length > 0) && (
                    <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">
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

          {currentView === "dashboard" && (
            <div className="max-w-3xl mx-auto px-4 py-10 animate-fade-in-up">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold text-white flex items-center justify-center gap-3">
                  <i className="fa-solid fa-user-circle text-purple-400"></i>{" "}
                  創作者中心：編輯名片
                </h2>

                {user && realVtubers.find((v) => v.id === user.uid) ? (
                  realVtubers.find((v) => v.id === user.uid).isVerified ? (
                    <p className="text-green-400 mt-3 text-sm font-bold bg-green-500/10 inline-block px-4 py-1 rounded-full">
                      <i className="fa-solid fa-circle-check mr-1"></i>{" "}
                      名片已認證上線
                    </p>
                  ) : (
                    <p className="text-yellow-400 mt-3 text-sm font-bold bg-yellow-500/10 inline-block px-4 py-1 rounded-full">
                      <i className="fa-solid fa-user-clock mr-1"></i>{" "}
                      名片審核中，通過後將自動公開
                    </p>
                  )
                ) : (
                  <p className="text-gray-400 mt-2">
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
                        className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg transition-transform hover:scale-105 inline-flex items-center gap-2"
                      >
                        <i className="fa-solid fa-eye"></i> 預覽我的公開名片
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleEnableNotifications}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg transition-transform hover:scale-105 inline-flex items-center gap-2"
                    >
                      <i className="fa-solid fa-bell"></i> 啟動手機推播通知
                    </button>

                    {/* ⚠️ 這是你要的測試按鈕 */}
                  </div>
                </div>
                {/* ▲▲▲ 按鈕區塊結束 ▲▲▲ */}
              </div>{" "}
              {/* <-- 注意：這裡才是原本 text-center mb-8 關閉的地方 */}
              <div className="bg-gray-800/40 border border-gray-700 rounded-3xl p-6 sm:p-10 shadow-2xl">
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
                    <h3 className="text-2xl font-extrabold text-white mb-6 border-b border-gray-700 pb-3 flex items-center">
                      <i className="fa-solid fa-bullhorn text-purple-400 mr-3"></i>
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
            <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8 animate-fade-in-up">
              <aside
                className={`w-full lg:w-72 flex-shrink-0 space-y-6 ${isMobileFilterOpen ? "block" : "hidden lg:block"}`}
              >
                <div className="hidden lg:block relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                  <input
                    type="text"
                    placeholder="搜尋 VTuber..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-[16px] sm:text-sm text-white outline-none focus:border-purple-500"
                  />
                </div>
                <div className="bg-gray-800/30 border border-gray-800 rounded-xl p-5 space-y-5">
                  <h3 className="font-bold border-b border-gray-700 pb-2 text-gray-300">
                    <i className="fa-solid fa-filter mr-2"></i>進階篩選
                  </h3>
                  {/* 手機版專用關鍵字搜尋框 */}
                  <div className="lg:hidden mb-4">
                    <p className="text-xs text-gray-500 mb-2">
                      關鍵字搜尋 (如: ASMR、歌回、企劃)
                    </p>
                    <div className="relative">
                      <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                      <input
                        type="text"
                        placeholder="搜尋名片內任何文字..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-[16px] sm:text-sm text-white outline-none focus:border-purple-500 shadow-inner"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">所屬勢力</p>
                    <div className="grid grid-cols-2 gap-1 bg-gray-900 rounded-lg p-1 border border-gray-700">
                      {["All", "個人勢", "企業勢", "社團勢", "合作勢"].map(
                        (a) => (
                          <button
                            key={a}
                            onClick={() => setSelectedAgency(a)}
                            className={`w-full py-1.5 text-xs font-bold rounded-md ${selectedAgency === a ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}
                          >
                            {a === "All" ? "全部" : a}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">主要平台</p>
                    <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                      {["All", "YouTube", "Twitch"].map((p) => (
                        <button
                          key={p}
                          onClick={() => setSelectedPlatform(p)}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-md ${selectedPlatform === p ? "bg-purple-600 text-white" : "text-gray-400"}`}
                        >
                          {p === "All" ? "全部" : p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-2">國籍</p>
                      <select
                        value={selectedNationality} // 語言、時段、色系也一樣
                        onChange={(e) => setSelectedNationality(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-[16px] sm:text-xs outline-none font-normal"
                      >
                        {dynamicNationalities.map((n) => (
                          <option key={n} value={n}>
                            {n === "All" ? "全部" : n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-2">主要語言</p>
                      <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-[16px] sm:text-xs outline-none font-normal"
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
                    <p className="text-xs text-gray-500 mb-2">可聯動時段</p>
                    <select
                      value={selectedSchedule}
                      onChange={(e) => setSelectedSchedule(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-[16px] sm:text-xs outline-none font-normal"
                    >
                      {dynamicSchedules.map((d) => (
                        // 🌟 優化：加上 bg-gray-900 text-white
                        <option key={d} value={d} className="bg-gray-900 text-white">
                          {d === "All" ? "全部" : d}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* 新增：色系篩選 */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">代表色系</p>
                    <select
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-[16px] sm:text-xs outline-none font-normal"
                    >
                      {/* 🌟 優化：加上 bg-gray-900 text-white */}
                      <option value="All" className="bg-gray-900 text-white">全部色系</option>
                      {COLOR_OPTIONS.map((c) => (
                        <option key={c} value={c} className="bg-gray-900 text-white">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">星座</p>
                    <select
                      value={selectedZodiac}
                      onChange={(e) => setSelectedZodiac(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-[16px] sm:text-xs outline-none font-normal"
                    >
                      <option value="All" className="bg-gray-900 text-white">全部星座</option>
                      {ZODIAC_SIGNS.map((z) => (
                        <option key={z} value={z} className="bg-gray-900 text-white">
                          {z}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <p className="w-full text-xs text-gray-500 mb-1">
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
                          <span className="text-xs font-normal text-yellow-400 bg-yellow-500/10 px-3 py-1 rounded-full">
                            <i className="fa-solid fa-eye-slash mr-1"></i>隱藏中
                          </span>
                        )}
                    </h2>
                    <button
                      onClick={() => setIsTipsModalOpen(true)}
                      className="bg-yellow-500/10 text-yellow-400 px-3 py-1.5 rounded-lg text-sm font-bold"
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
                      className="bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-all border border-purple-500/20"
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

                    <button onClick={() => navigate('blacklist')} className="bg-red-900/50 text-red-400 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-all border border-red-500/50">
                      <i className="fa-solid fa-ban mr-1"></i> 黑單避雷區
                    </button>
                    <button
                      onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                      className="lg:hidden bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <i className="fa-solid fa-filter"></i> 篩選
                    </button>
                  </div>
                  <div className="flex flex-col gap-3 w-full sm:w-auto">
                    <div className="block lg:hidden relative w-full">
                      <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                      <input
                        type="text"
                        placeholder="搜尋 VTuber..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-purple-500"
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
                      className="bg-gray-800 border border-gray-700 rounded-xl p-2.5 text-[16px] sm:text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none w-full sm:w-auto"
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
                  <div className="text-center text-gray-500 py-10">
                    <i className="fa-solid fa-spinner fa-spin text-2xl"></i>
                  </div>
                ) : filteredVTubers.length === 0 ? (
                  <p className="text-center text-gray-500 mt-20">
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
                          className={`px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg flex items-center ${currentPage === 1 ? "bg-gray-800/50 text-gray-600 cursor-not-allowed border border-gray-800" : "bg-gray-800 hover:bg-purple-600 text-white border border-gray-700 hover:border-purple-500"}`}
                        >
                          <i className="fa-solid fa-chevron-left mr-2"></i> 上一頁
                        </button>
                        <div className="flex items-center gap-2 text-gray-300 font-bold bg-gray-900/50 px-4 py-2.5 rounded-xl border border-gray-700">
                          <span>第</span>
                          <select
                            value={currentPage}
                            onChange={(e) =>
                              handlePageChange(Number(e.target.value))
                            }
                            className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-white outline-none cursor-pointer"
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
                          className={`px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg flex items-center ${currentPage === totalPages ? "bg-gray-800/50 text-gray-600 cursor-not-allowed border border-gray-800" : "bg-gray-800 hover:bg-purple-600 text-white border border-gray-700 hover:border-purple-500"}`}
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
              <i className="fa-solid fa-spinner fa-spin text-4xl text-purple-500 mb-4"></i>
              <p className="text-gray-400 font-bold text-lg">載入專屬名片中...</p>
            </div>
          )}

          {currentView === "profile" && selectedVTuber && (
            <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in-up">
              <button
                onClick={() => {
                  // 執行返回導航，帶入 true 表示保留彈窗狀態
                  if (viewParticipantsCollab || openBulletinModalId) {
                    navigate(previousView || "home", true);
                  } else {
                    const target =
                      previousView === "profile"
                        ? "grid"
                        : previousView || "grid";
                    navigate(target, true);
                  }

                  setTimeout(() => {
                    window.scrollTo(0, gridScrollY.current);
                  }, 50);
                }}
                className="text-gray-400 hover:text-white mb-6 flex items-center text-sm transition-colors"
              >
                <i className="fa-solid fa-chevron-left mr-2"></i>
                {/* 判斷顯示文字 */}
                {viewParticipantsCollab
                  ? "返回聯動參與人員"
                  : openBulletinModalId
                    ? "看看其他有意願的Vtuber"
                    : previousView === "bulletin"
                      ? "返回佈告欄"
                      : previousView === "collabs"
                        ? "返回聯動表"
                        : previousView === "inbox"
                          ? "返回我的信箱"
                          : previousView === "home"
                            ? "返回首頁"
                            : previousView === "match"
                              ? "返回配對"
                              : "返回探索"}
              </button>
              <div className="bg-gray-800/40 border border-gray-700 rounded-3xl overflow-hidden shadow-2xl">
                <div className="h-48 sm:h-64 relative">
                  <LazyImage
                    src={sanitizeUrl(selectedVTuber.banner)}
                    containerCls="absolute inset-0 w-full h-full"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none z-10"></div>
                </div>
                <div className="px-6 sm:px-10 pb-10 relative">
                  <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-16 sm:-mt-20 mb-8 z-10 relative">
                    <div className="flex flex-col gap-3 items-center sm:items-start flex-shrink-0">
                      {/* ▼ 詳細名片大頭像 ▼ */}
                      <LazyImage
                        src={sanitizeUrl(selectedVTuber.avatar)}
                        containerCls="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-4 border-gray-900 bg-gray-800 flex-shrink-0"
                      />
                      {isVerifiedUser && selectedVTuber.id !== user?.uid && (
                        <button
                          onClick={() => handleBraveInvite(selectedVTuber)}
                          className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white px-4 py-2 w-full rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(244,63,94,0.4)] flex items-center justify-center transition-transform hover:scale-105"
                        >
                          <i className="fa-solid fa-heart mr-1.5"></i>勇敢邀請
                        </button>
                      )}
                    </div>
                    <div className="flex-1 w-full">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-white flex items-center gap-3">
                              {selectedVTuber.name}{" "}
                              {selectedVTuber.isVerified && (
                                <i className="fa-solid fa-circle-check text-blue-400 text-2xl"></i>
                              )}
                            </h1>
                            {/* 🌟 詳細名片的線上狀態 */}
                            {onlineUsers?.has(selectedVTuber.id) && (
                              <span className="text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-inner ml-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div> 目前在線
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 mt-2 items-center">

                            <span className="px-3 py-1 bg-gray-800 text-xs rounded-full text-gray-300 border border-gray-700">
                              {selectedVTuber.agency}
                            </span>
                            {(selectedVTuber.nationalities?.length > 0 ||
                              selectedVTuber.nationality) && (
                                <span className="px-3 py-1 bg-gray-800 text-xs rounded-full text-gray-300 border border-gray-700">
                                  <i className="fa-solid fa-earth-asia mr-1 text-blue-300"></i>
                                  {(selectedVTuber.nationalities?.length > 0
                                    ? selectedVTuber.nationalities
                                    : [selectedVTuber.nationality]
                                  ).join(", ")}
                                </span>
                              )}
                            {(selectedVTuber.languages?.length > 0 ||
                              selectedVTuber.language) && (
                                <span className="px-3 py-1 bg-gray-800 text-xs rounded-full text-gray-300 border border-gray-700">
                                  <i className="fa-solid fa-language mr-1 text-yellow-300"></i>
                                  {(selectedVTuber.languages?.length > 0
                                    ? selectedVTuber.languages
                                    : [selectedVTuber.language]
                                  ).join(", ")}
                                </span>
                              )}
                            {selectedVTuber.personalityType && (
                              <span className="px-3 py-1 bg-gray-800 text-xs rounded-full text-gray-300 border border-gray-700">
                                <i className="fa-solid fa-user-tag mr-1 text-pink-300"></i>
                                {selectedVTuber.personalityType}
                              </span>
                            )}
                            {/* 新增：名片頁面顯示色系 */}
                            {selectedVTuber.colorSchemes &&
                              selectedVTuber.colorSchemes.map((color) => (
                                <span
                                  key={color}
                                  className="px-3 py-1 bg-gray-800 text-xs rounded-full text-gray-300 border border-gray-700"
                                >
                                  <i className="fa-solid fa-palette mr-1 text-purple-400"></i>
                                  {color}系
                                </span>
                              ))}
                            <span
                              className={`text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${selectedVTuber.mainPlatform === "Twitch" ? "bg-purple-600" : "bg-red-600"}`}
                            >
                              <i
                                className={`fa-brands fa-${selectedVTuber.mainPlatform === "Twitch" ? "twitch" : "youtube"}`}
                              ></i>{" "}
                              主要平台：{selectedVTuber.mainPlatform || "YouTube"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-4 text-sm">
                            <button
                              onClick={() =>
                                isVerifiedUser && selectedVTuber.id !== user?.uid
                                  ? handleRecommend(selectedVTuber)
                                  : null
                              }
                              className="bg-green-500/10 border border-green-500/30 text-green-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold"
                            >
                              <i className="fa-solid fa-thumbs-up"></i>{" "}
                              {selectedVTuber.likes || 0} 推薦
                            </button>
                            {isVerifiedUser &&
                              selectedVTuber.id !== user?.uid && (
                                <button
                                  onClick={() =>
                                    handleInitiateDislike(selectedVTuber)
                                  }
                                  className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold"
                                >
                                  <i className="fa-solid fa-thumbs-down"></i>{" "}
                                  {selectedVTuber.dislikes || 0}
                                </button>
                              )}

                            {selectedVTuber.youtubeUrl ||
                              selectedVTuber.channelUrl ? (
                              <a
                                href={sanitizeUrl(
                                  selectedVTuber.youtubeUrl ||
                                  selectedVTuber.channelUrl,
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5"
                              >
                                <i className="fa-brands fa-youtube"></i> YouTube
                                {(selectedVTuber.youtubeSubscribers ||
                                  selectedVTuber.subscribers) && (
                                    <span className="ml-1 px-2 py-0.5 bg-red-500/20 rounded text-xs">
                                      {selectedVTuber.youtubeSubscribers ||
                                        selectedVTuber.subscribers}
                                    </span>
                                  )}
                              </a>
                            ) : selectedVTuber.youtubeSubscribers ||
                              selectedVTuber.subscribers ? (
                              <span className="bg-red-500/5 text-red-400/80 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5">
                                <i className="fa-brands fa-youtube"></i> YouTube
                                <span className="ml-1 px-2 py-0.5 bg-red-500/10 rounded text-xs">
                                  {selectedVTuber.youtubeSubscribers ||
                                    selectedVTuber.subscribers}
                                </span>
                              </span>
                            ) : null}
                            {selectedVTuber.twitchUrl ? (
                              <a
                                href={sanitizeUrl(selectedVTuber.twitchUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5"
                              >
                                <i className="fa-brands fa-twitch"></i> Twitch
                                {selectedVTuber.twitchFollowers && (
                                  <span className="ml-1 px-2 py-0.5 bg-purple-500/20 rounded text-xs">
                                    {selectedVTuber.twitchFollowers}
                                  </span>
                                )}
                              </a>
                            ) : selectedVTuber.twitchFollowers ? (
                              <span className="bg-purple-500/5 text-purple-400/80 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5">
                                <i className="fa-brands fa-twitch"></i> Twitch
                                <span className="ml-1 px-2 py-0.5 bg-purple-500/10 rounded text-xs">
                                  {selectedVTuber.twitchFollowers}
                                </span>
                              </span>
                            ) : null}
                            {selectedVTuber.xUrl && (
                              <a
                                href={sanitizeUrl(selectedVTuber.xUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg font-bold"
                              >
                                <i className="fa-brands fa-x-twitter"></i> X
                              </a>
                            )}
                            {selectedVTuber.igUrl && (
                              <a
                                href={sanitizeUrl(selectedVTuber.igUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 px-3 py-1.5 rounded-lg font-bold"
                              >
                                <i className="fa-brands fa-instagram"></i> IG
                              </a>
                            )}
                          </div>

                          {/* 🌟 新增：在詳細名片頁面也顯示 24 小時限時動態 */}
                          {selectedVTuber.statusMessage && selectedVTuber.statusMessageUpdatedAt && (Date.now() - selectedVTuber.statusMessageUpdatedAt < (selectedVTuber.statusMessage.includes('🔴') ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)) && (
                            <div className={`mt-5 bg-gradient-to-r ${selectedVTuber.statusMessage.includes('🔴') ? 'from-red-500/20 to-orange-500/10 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'from-orange-500/10 to-red-500/10 border-orange-500/30'} rounded-xl p-4 text-sm ${selectedVTuber.statusMessage.includes('🔴') ? 'text-red-100' : 'text-orange-300'} font-medium flex items-start gap-3 shadow-inner animate-fade-in-up`}>
                              <i className={`fa-solid ${selectedVTuber.statusMessage.includes('🔴') ? 'fa-satellite-dish text-red-400 animate-pulse' : 'fa-comment-dots text-orange-400 animate-bounce'} mt-1 text-xl`}></i>
                              <span className="leading-relaxed">{selectedVTuber.statusMessage}</span>
                            </div>
                          )}

                        </div>
                        <div className="flex flex-col gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                          {isVerifiedUser && selectedVTuber.id !== user?.uid && (
                            <button
                              onClick={() =>
                                handleOpenCollabModal(selectedVTuber)
                              }
                              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex-shrink-0 flex items-center justify-center"
                            >
                              <i className="fa-solid fa-envelope-open-text mr-2"></i>
                              發送站內信邀約
                            </button>
                          )}
                          {isVerifiedUser && selectedVTuber.id !== user?.uid && (
                            <button
                              onClick={() => setChatTarget(selectedVTuber)}
                              className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2"
                            >
                              <i className="fa-solid fa-comment-dots"></i>{" "}
                              即時私訊
                            </button>
                          )}
                          {selectedVTuber.streamStyleUrl && (
                            <a
                              href={sanitizeUrl(selectedVTuber.streamStyleUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:bg-blue-600 hover:text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <i className="fa-solid fa-video"></i> 觀看直播風格
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-6">
                    <div className="md:col-span-2 space-y-8">
                      <section>
                        <div className="flex flex-wrap sm:flex-nowrap justify-between items-center border-b border-gray-700 pb-2 mb-4 gap-2">

                          {/* 🌟 修改：將「關於我」與「星座」包在同一個 flex 容器中 */}
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-purple-400">
                              <i className="fa-solid fa-microphone mr-2"></i>關於我
                            </h3>
                            {selectedVTuber.zodiacSign && (
                              <span className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-inner">
                                <i className="fa-solid fa-star text-yellow-400"></i> {selectedVTuber.zodiacSign}
                              </span>
                            )}
                          </div>

                          <button // 修改 profile 視圖中的複製按鈕 onClick 邏輯
                            onClick={() => {
                              const identifier =
                                selectedVTuber.slug || selectedVTuber.id;
                              const url =
                                window.location.origin +
                                window.location.pathname +
                                "#profile/" +
                                identifier;
                              navigator.clipboard.writeText(url);
                              showToast("✅ 已複製專屬名片連結！");
                            }}
                            className="bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-gray-600 flex items-center gap-1.5"
                          >
                            <i className="fa-solid fa-link"></i> 複製我的名片連結
                          </button>
                        </div>
                        <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {selectedVTuber.description}
                        </p>
                      </section>
                      <section>
                        <h3 className="text-xl font-bold border-b border-gray-700 pb-2 mb-4 text-pink-400">
                          <i className="fa-solid fa-gamepad mr-2"></i>內容標籤
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {(selectedVTuber.tags || []).map((t) => (
                            <span
                              key={t}
                              className="px-3 py-1 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      </section>
                    </div>
                    <div className="space-y-6">
                      <div className="bg-gray-900/50 p-5 rounded-2xl border border-gray-700">
                        <h4 className="font-bold text-gray-200 mb-2">
                          <i className="fa-solid fa-mask text-green-400 mr-2"></i>
                          演出型態
                        </h4>
                        <p className="text-sm text-gray-400 mb-4">
                          {selectedVTuber.streamingStyle || "一般型態"}
                        </p>
                        <h4 className="font-bold text-gray-200 mb-3">
                          <i className="fa-solid fa-bullseye text-blue-400 mr-2"></i>
                          主要願意連動類型
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {(selectedVTuber.collabTypes || []).map((t) => (
                            <span
                              key={t}
                              className="bg-purple-900/30 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="bg-gray-900/50 p-5 rounded-2xl border border-gray-700">
                        <h4 className="font-bold text-gray-200 mb-3">
                          <i className="fa-solid fa-calendar-check text-yellow-400 mr-2"></i>
                          可聯動時段
                        </h4>
                        <div className="text-sm text-gray-300 leading-relaxed">
                          <p>{formatSchedule(selectedVTuber)}</p>
                        </div>
                      </div>
                    </div>
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
                    <i className="fa-solid fa-bullhorn text-purple-400"></i>
                    揪團佈告欄
                  </h2>
                  <p className="text-gray-400 mt-2 text-sm">
                    在這裡發布您的聯動企劃，或是尋找有興趣的邀請吧！
                    <span className="text-yellow-400 font-bold ml-2">
                      (注意：揪團時間截止前，發起人必須進入信箱發送正式邀請才算成功)
                    </span>
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => setIsLeaderboardModalOpen(true)}
                    className="bg-yellow-600 hover:bg-yellow-500 text-white px-5 py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(202,138,4,0.4)] flex items-center justify-center transition-transform hover:-translate-y-1"
                  >
                    <i className="fa-solid fa-trophy mr-2"></i>揪團成功排行榜
                  </button>
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
                    className={`${isBulletinFormOpen ? "bg-gray-700" : "bg-gradient-to-r from-purple-600 to-pink-600"} text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center transition-all hover:-translate-y-1`}
                  >
                    <i
                      className={`fa-solid ${isBulletinFormOpen ? "fa-chevron-up" : "fa-pen-nib"} mr-2`}
                    ></i>
                    {isBulletinFormOpen ? "收起揪團" : "我要揪團"}
                  </button>
                </div>
              </div>

              {isBulletinFormOpen && (
                <div
                  id="bulletin-form"
                  className="bg-gray-800/40 border border-gray-700 rounded-3xl p-6 sm:p-8 shadow-2xl mb-10 animate-fade-in-up"
                >
                  <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-3">
                    <h3 className="text-xl font-bold text-white">
                      {newBulletin.id ? "編輯揪團文" : "發布新揪團"}
                    </h3>
                    <button
                      onClick={() => setIsBulletinFormOpen(false)}
                      className="text-gray-500 hover:text-white"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">
                        揪團內容說明 <span className="text-red-400">*</span>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-gray-300 mb-2">
                          聯動類型 <span className="text-red-400">*</span>
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
                      <div>
                        <label className="block text-sm font-bold text-gray-300 mb-2">
                          預估人數 <span className="text-red-400">*</span>
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
                      <div>
                        <label className="block text-sm font-bold text-gray-300 mb-2">
                          預計聯動時間 <span className="text-red-400">*</span>
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
                      <div>
                        <label className="block text-sm font-bold text-gray-300 mb-2">
                          揪團截止時間 <span className="text-red-400">*</span>
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
                        <label className="block text-sm font-bold text-gray-300 mb-2">
                          選擇預設圖 或 自行上傳{" "}
                          <span className="text-red-400">* (必選)</span>
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
                                  className={`w-28 h-16 rounded-lg object-cover cursor-pointer border-2 transition-all flex-shrink-0 ${newBulletin.image === img ? "border-purple-500 scale-105 shadow-[0_0_15px_rgba(168,85,247,0.5)] opacity-100" : "border-transparent hover:border-gray-500 opacity-50 hover:opacity-100"}`}
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
                                    className="w-12 h-12 rounded-lg object-cover border border-gray-600"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setNewBulletin((p) => ({ ...p, image: "" }))
                                    }
                                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
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
                                className="w-full sm:w-auto px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-xl border border-gray-600 transition-colors flex items-center justify-center gap-2"
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
                                className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 bg-red-500/10 px-3 py-2 rounded-lg font-bold transition-colors"
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
                          className="px-6 py-3 text-gray-400 hover:text-white font-bold"
                        >
                          取消
                        </button>
                        <button
                          onClick={handlePostBulletin}
                          className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 h-fit whitespace-nowrap"
                        >
                          {newBulletin.id ? "儲存修改" : "發布揪團"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 overflow-x-auto pb-4 mb-6 border-b border-gray-700">
                <button
                  onClick={() => setBulletinFilter("All")}
                  className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${bulletinFilter === "All" ? "bg-purple-600 text-white shadow-lg" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                >
                  全部揪團
                </button>
                {activeBulletinTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => setBulletinFilter(t)}
                    className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${bulletinFilter === t ? "bg-purple-600 text-white shadow-lg" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
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
                <p className="text-center text-gray-500 mt-20">
                  目前沒有相關的招募文喔！
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
              <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
                <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
                  <i className="fa-solid fa-broadcast-tower text-red-400"></i>{" "}
                  確定聯動表
                </h2>
                {isVerifiedUser && (
                  <button
                    onClick={() => {
                      document
                        .getElementById("public-collab-form")
                        ?.classList.toggle("hidden");
                    }}
                    className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-transform hover:-translate-y-1"
                  >
                    <i className="fa-solid fa-plus mr-2"></i>發布聯動
                  </button>
                )}
              </div>

              {isVerifiedUser && (
                <div
                  id="public-collab-form"
                  className="hidden bg-gray-800/40 border border-gray-700 rounded-3xl p-6 sm:p-8 shadow-2xl mb-10 animate-fade-in-up"
                >
                  <h3 className="text-xl font-bold text-white mb-6 border-b border-gray-700 pb-3">
                    發布新的聯動行程
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                    <div>
                      <label className="text-sm font-bold text-gray-300 mb-2 block">
                        聯動類別 <span className="text-red-400">*</span>
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
                      <label className="text-sm font-bold text-gray-300 mb-2 block">
                        聯動時間 <span className="text-red-400">*</span>
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
                      <label className="text-sm font-bold text-gray-300 mb-2 block">
                        直播連結 (可自動抓圖){" "}
                        <span className="text-red-400">*</span>
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
                          className="bg-gray-700 hover:bg-gray-600 text-white px-4 rounded-xl text-xs font-bold transition-colors"
                        >
                          <i className="fa-solid fa-wand-magic-sparkles"></i>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="text-sm font-bold text-gray-300 mb-2 block">
                        聯動標題 <span className="text-red-400">*</span>
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
                      <label className="text-sm font-bold text-gray-300 mb-2 block">
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
                  <div className="bg-gray-900/80 p-4 rounded-2xl border border-purple-500/30 mb-6">
                    <label className="block text-sm font-bold text-purple-400 mb-3">
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
                            className="flex items-center gap-2 bg-purple-600/20 border border-purple-500/50 px-2 py-1 rounded-lg"
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
                              className="text-red-400 hover:text-red-300"
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
                        className={inputCls + " !bg-gray-800"}
                      />
                      {pSearch && (
                        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl max-h-40 overflow-y-auto">
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
                                className="flex items-center gap-3 p-2 hover:bg-purple-600/20 cursor-pointer border-b border-gray-700 last:border-0"
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
                                sendEmail: true,
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
                      className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105"
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
                    className={`px-5 py-2 rounded-full font-bold text-sm transition-all ${collabCategoryTab === cat ? "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]" : "bg-gray-800 text-gray-400 hover:text-white"}`}
                  >
                    {cat === "All" ? "全部" : cat}
                  </button>
                ))}
              </div>

              {filteredDisplayCollabs.length === 0 ? (
                <div className="text-center py-20 bg-gray-800/30 rounded-3xl border border-gray-700">
                  <p className="text-gray-500 font-bold text-lg">
                    <i className="fa-solid fa-ghost mb-4 text-4xl block"></i>
                    目前沒有即將到來的聯動行程
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
          {currentView === "status_wall" && (
            <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in-up">

              {/* 🌟 新增：浮動發布按鈕 (固定在畫面正下方) */}
              <button
                onClick={() => {
                  // 1. 平滑滾動到最上方
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  // 2. 延遲 400 毫秒等滾動差不多到了，自動對焦輸入框讓手機跳出鍵盤！
                  setTimeout(() => document.getElementById('story-input')?.focus(), 400);
                }}
                className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[80] bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-full font-bold shadow-[0_0_20px_rgba(249,115,22,0.6)] transition-transform hover:scale-105 flex items-center gap-2 border border-orange-400/50"
              >
                <i className="fa-solid fa-arrow-up"></i> 去發布限動！
              </button>

              {/* 頂部標題與按鈕 */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-gray-700 pb-4">
                <div>
                  <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
                    <i className="fa-solid fa-bolt text-orange-400"></i> 24H 動態牆
                  </h2>
                  <p className="text-gray-400 mt-2 text-sm">
                    掌握 V 圈最新脈動！這裡顯示所有人 24 小時內的最新動態。
                  </p>
                </div>
                {/* (原本在這裡的去頂部按鈕已經刪除，因為我們有浮動按鈕了) */}
              </div>

              {/* 🌟 新增：直接在動態牆發布的專屬輸入框 */}
              {isVerifiedUser && myProfile ? (
                <div className="bg-gradient-to-r from-orange-900/80 to-red-900/80 border border-orange-500/40 rounded-xl p-5 mb-8 shadow-inner">
                  <h3 className="text-orange-300 font-bold mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-stopwatch"></i> 發布我的 24H 限時動態
                  </h3>
                  <form onSubmit={handlePostStory} className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 flex flex-col">
                      <input
                        id="story-input"
                        type="text"
                        maxLength="40"
                        value={storyInput}
                        onChange={(e) => setStoryInput(e.target.value)}
                        // 🌟 修正：將 p-3 改為 px-4 h-[50px]，強制固定高度並讓文字垂直置中
                        className="w-full min-w-0 box-border bg-gray-900 border border-gray-700 rounded-xl px-4 h-[50px] text-white focus:ring-2 focus:ring-orange-500 outline-none text-[16px]"
                        placeholder="例如：今晚 8 點想找人打 APEX！ (限 40 字)"
                      />
                      <div className={`text-right text-[10px] mt-1.5 pr-2 transition-colors ${storyInput.length >= 40 ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                        {storyInput.length} / 40
                      </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto flex-shrink-0 items-start">
                      <button
                        type="submit"
                        disabled={!storyInput.trim()}
                        // 🌟 修正：加入 h-[50px] 強制與輸入框等高
                        className={`flex-1 sm:flex-none h-[50px] px-2 sm:px-6 rounded-xl text-sm font-bold shadow-lg transition-transform whitespace-nowrap flex items-center justify-center gap-1.5 ${storyInput.trim() ? 'bg-orange-600 hover:bg-orange-500 text-white hover:scale-105' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                      >
                        <i className="fa-solid fa-paper-plane"></i> 發布限動
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handlePostStory(e, "🔴 我在直播中！快來找我玩！", true)}
                        // 🌟 修正：加入 h-[50px] 強制與輸入框等高
                        className="flex-1 sm:flex-none h-[50px] px-2 sm:px-6 rounded-xl text-sm font-bold shadow-lg transition-transform whitespace-nowrap flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 text-white hover:scale-105 animate-pulse"
                      >
                        <i className="fa-solid fa-satellite-dish"></i> 我在直播
                      </button>
                      {/* 🌟 修正：清除按鈕也加入 h-[50px] */}
                      {myProfile.statusMessage && (
                        <button
                          type="button"
                          onClick={(e) => handlePostStory(e, "", false)}
                          className="flex-1 sm:flex-none h-[50px] px-2 sm:px-6 rounded-xl text-sm font-bold shadow-lg transition-transform whitespace-nowrap flex items-center justify-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white hover:scale-105"
                        >
                          <i className="fa-solid fa-eraser"></i> 清除動態
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              ) : (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-8 text-center flex flex-col sm:flex-row items-center justify-center gap-4">
                  <p className="text-gray-400 text-sm">
                    <i className="fa-solid fa-lock mr-2"></i>
                    需通過名片認證才能發布限時動態喔！
                  </p>
                  <button onClick={() => navigate("dashboard")} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                    前往認證名片
                  </button>
                </div>
              )}

              {/* 動態列表 (垂直排列，依時間排序) */}
              <div className="flex flex-col gap-6 pb-28">
                {(() => {
                  const now = Date.now();
                  // 抓取所有 24 小時內的動態，並依照時間「由新到舊」排序
                  const allActiveStatuses = [...realVtubers]
                    .filter(
                      (v) => {
                        if (!v.isVerified || v.isBlacklisted || v.activityStatus === "sleep" || v.activityStatus === "graduated" || String(v.id || "").startsWith("mock") || !v.statusMessage || !v.statusMessageUpdatedAt) return false;

                        // 🌟 判斷限時動態是否有效 (直播 3 小時，一般 24 小時)
                        const isLiveMsg = v.statusMessage.includes('🔴');
                        const expireLimit = isLiveMsg ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
                        return now - v.statusMessageUpdatedAt < expireLimit;
                      }
                    )
                    .sort((a, b) => b.statusMessageUpdatedAt - a.statusMessageUpdatedAt);

                  if (allActiveStatuses.length === 0) {
                    return (
                      <div className="text-center py-20 bg-gray-800/30 rounded-3xl border border-gray-700">
                        <p className="text-gray-500 font-bold text-lg">
                          <i className="fa-solid fa-ghost mb-4 text-4xl block"></i>
                          目前沒有任何限時動態喔！
                        </p>
                      </div>
                    );
                  }

                  return allActiveStatuses.map((v) => {
                    // 🌟 新增：判斷這則動態是否為直播通知
                    const isLiveMsg = v.statusMessage.includes('🔴');

                    return (
                      <div
                        key={v.id}
                        onClick={() => {
                          setSelectedVTuber(v);
                          navigate(`profile/${v.id}`);
                        }}
                        className={`bg-gray-800/60 border ${isLiveMsg ? 'border-red-500/80 hover:border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'border-gray-700 hover:border-orange-500/50'} rounded-3xl p-5 sm:p-6 cursor-pointer transition-all hover:-translate-y-1 shadow-lg group flex flex-col relative`}
                      >
                        {/* 頂部：頭像、名字、社群、時間與右側按鈕 */}
                        <div className="flex justify-between items-start w-full mb-4 gap-4">
                          {/* 🌟 優化：將 items-center 改為 items-start，讓頭像對齊頂部 */}
                          <div className="flex items-start gap-4 min-w-0 flex-1">
                            <div className="relative flex-shrink-0">
                              <img
                                src={sanitizeUrl(v.avatar)}
                                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 ${isLiveMsg ? 'border-red-500 ring-4 ring-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.6)]' : 'border-orange-500 ring-4 ring-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.6)]'} group-hover:scale-105 transition-transform`}
                              />
                              <div className={`absolute -bottom-1 -right-1 ${isLiveMsg ? 'bg-red-600' : 'bg-orange-500'} w-5 h-5 rounded-full border-2 border-gray-900 flex items-center justify-center z-10`}>
                                <i className={`fa-solid ${isLiveMsg ? 'fa-satellite-dish animate-pulse' : 'fa-bolt'} text-[10px] text-white`}></i>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <div className="flex items-center gap-2 min-w-0">
                                <h4 className={`text-white font-bold truncate text-base transition-colors ${isLiveMsg ? 'group-hover:text-red-400' : 'group-hover:text-orange-400'}`}>
                                  {v.name}
                                </h4>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {(v.youtubeUrl || v.channelUrl) && (v.youtubeUrl || v.channelUrl) !== "#" && (
                                    <a href={sanitizeUrl(v.youtubeUrl || v.channelUrl)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:text-red-300 w-5 h-5 rounded flex items-center justify-center transition-colors" title="前往 YouTube">
                                      <i className="fa-brands fa-youtube text-[10px]"></i>
                                    </a>
                                  )}
                                  {v.twitchUrl && v.twitchUrl !== "#" && (
                                    <a href={sanitizeUrl(v.twitchUrl)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 hover:text-purple-300 w-5 h-5 rounded flex items-center justify-center transition-colors" title="前往 Twitch">
                                      <i className="fa-brands fa-twitch text-[10px]"></i>
                                    </a>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatRelativeTime(v.statusMessageUpdatedAt)}
                              </p>

                              {/* 🌟 優化：將微互動按鈕移到這裡，並縮小為精緻的徽章尺寸 */}
                              <div className="border-t border-gray-700/50 pt-4 flex flex-col gap-3 w-full z-20">

                                {/* 互動按鈕區 (自己不能按自己的) */}
                                {(!user || v.id !== user?.uid) && (
                                  // 🌟 優化 1：手機版縮小按鈕間距 (gap-1.5)
                                  <div className="flex gap-1.5 sm:gap-2 w-full sm:w-auto">
                                    <button
                                      onClick={(e) => handleStatusReaction(e, v, 'plus_one')}
                                      // 🌟 優化 2：加入 whitespace-nowrap 強制不換行，並縮小手機版 padding (px-1.5) 與字體 (text-[11px])
                                      className="flex-1 sm:flex-none bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 px-1.5 sm:px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 shadow-sm hover:shadow-[0_0_10px_rgba(168,85,247,0.5)] whitespace-nowrap"
                                    >
                                      👋 +1 {v.statusReactions?.plus_one?.length > 0 && <span className="bg-purple-900/80 text-white px-1.5 py-0.5 rounded-md text-[10px] ml-0.5 sm:ml-1">{v.statusReactions.plus_one.length}</span>}
                                    </button>
                                    <button
                                      onClick={(e) => handleStatusReaction(e, v, 'watching')}
                                      className="flex-1 sm:flex-none bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 px-1.5 sm:px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 shadow-sm hover:shadow-[0_0_10px_rgba(37,99,235,0.5)] whitespace-nowrap"
                                    >
                                      👀 觀望中 {v.statusReactions?.watching?.length > 0 && <span className="bg-blue-900/80 text-white px-1.5 py-0.5 rounded-md text-[10px] ml-0.5 sm:ml-1">{v.statusReactions.watching.length}</span>}
                                    </button>
                                    <button
                                      onClick={(e) => handleStatusReaction(e, v, 'fire')}
                                      className="flex-1 sm:flex-none bg-orange-600/20 hover:bg-orange-600 text-orange-300 hover:text-white border border-orange-500/30 px-1.5 sm:px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 shadow-sm hover:shadow-[0_0_10px_rgba(249,115,22,0.5)] whitespace-nowrap"
                                    >
                                      🔥 幫推 {v.statusReactions?.fire?.length > 0 && <span className="bg-orange-900/80 text-white px-1.5 py-0.5 rounded-md text-[10px] ml-0.5 sm:ml-1">{v.statusReactions.fire.length}</span>}
                                    </button>
                                  </div>
                                )}

                                {/* 🌟 顯示互動者的頭像 (所有人都能看見) */}
                                {(() => {
                                  const reactions = v.statusReactions || { plus_one: [], watching: [], fire: [] };
                                  // 將三種互動的人合併，並用 Set 排除重複 (如果未來允許按多種)
                                  const allReactors = [...new Set([...(reactions.plus_one || []), ...(reactions.watching || []), ...(reactions.fire || [])])];

                                  if (allReactors.length === 0) return null;

                                  return (
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[10px] text-gray-400 font-medium">互動者：</span>
                                      <div className="flex -space-x-2">
                                        {allReactors.slice(0, 8).map(uid => {
                                          const reactor = realVtubers.find(rv => rv.id === uid);
                                          if (!reactor) return null;
                                          return (
                                            <img
                                              key={uid}
                                              src={sanitizeUrl(reactor.avatar)}
                                              className="w-6 h-6 rounded-full border-2 border-gray-800 object-cover hover:scale-110 transition-transform relative z-10 hover:z-20"
                                              title={reactor.name}
                                            />
                                          );
                                        })}
                                        {allReactors.length > 8 && (
                                          <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-800 flex items-center justify-center text-[8px] text-white font-bold relative z-0">
                                            +{allReactors.length - 8}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* 右上角按鈕 (清除/私訊) */}
                          <div className="flex-shrink-0 z-20">
                            {user && v.id === user.uid ? (
                              <button onClick={(e) => { e.stopPropagation(); if (confirm("確定要清除這則動態嗎？")) handlePostStory(e, "", false); }} className="bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-1.5">
                                <i className="fa-solid fa-eraser"></i><span className="hidden sm:inline">清除</span>
                              </button>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); if (!user) return showToast("請先登入！"); if (!isVerifiedUser) return showToast("需通過認證才能發送私訊！"); setChatTarget(v); }} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-1.5">
                                <i className="fa-solid fa-comment-dots"></i><span className="hidden sm:inline">私訊</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 中間：動態訊息 */}
                        <div className={`rounded-2xl p-4 sm:p-5 border flex-1 text-left relative overflow-hidden w-full mb-4 ${isLiveMsg ? 'bg-gradient-to-br from-red-600 to-red-900 border-red-500/50 shadow-inner' : 'bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20'}`}>
                          <i className={`fa-solid ${isLiveMsg ? 'fa-satellite-dish animate-pulse text-red-400/20' : 'fa-quote-left text-orange-500/10'} absolute top-2 right-2 text-4xl`}></i>
                          <p className={`text-sm sm:text-base leading-relaxed relative z-10 whitespace-pre-wrap ${isLiveMsg ? 'text-white font-bold tracking-wide' : 'text-orange-100 font-medium'}`}>
                            {v.statusMessage}
                          </p>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

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
              <div className="bg-red-950/30 border border-red-900 rounded-3xl p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-orange-600 to-red-600"></div>
                <i className="fa-solid fa-skull-crossbones text-6xl text-red-500 mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]"></i>
                <h2 className="text-3xl sm:text-4xl font-black text-red-400 mb-4 tracking-widest">
                  黑名單避雷區
                </h2>
                <p className="text-red-200/80 mb-8 max-w-2xl mx-auto leading-relaxed font-medium">
                  只要倒讚數超過 10 個，該名片即會被系統自動移入此區並強制下架。
                  <br className="hidden sm:block" />
                  在此區的名片無法被一般使用者看見，也無法再發送任何邀約。
                  <br />
                  <span className="text-yellow-400 text-sm mt-2 block">
                    如果發現有惡意洗倒讚的行為，請聯絡官方處理。
                  </span>
                </p>
                <div className="inline-block bg-black/50 border border-red-900 px-6 py-3 rounded-xl">
                  <span className="text-gray-400 font-bold mr-2">
                    目前黑單數量：
                  </span>
                  <span className="text-2xl font-black text-red-500">
                    {
                      realVtubers.filter(
                        (v) => v.isBlacklisted || v.dislikes >= 10,
                      ).length
                    }
                  </span>
                  <span className="text-gray-500 text-sm ml-1">人</span>
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
            />
          )}
        </main>

        {/* 站內信發送 Modal */}
        {isCollabModalOpen && selectedVTuber && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up"
            onClick={() => setIsCollabModalOpen(false)}
          >
            <div
              className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 p-6 flex flex-col items-center border-b border-gray-800">
                <img
                  src={sanitizeUrl(selectedVTuber.avatar)}
                  className="w-20 h-20 rounded-full border-4 border-gray-900 mb-3 object-cover shadow-lg"
                />
                <h3 className="text-xl font-bold text-white mb-1">
                  邀請 {selectedVTuber.name} 聯動
                </h3>
                <p className="text-xs text-purple-300 bg-purple-900/40 px-3 py-1 rounded-full">
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
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition-colors"
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
                          sendEmail: true,
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
                          sendEmail: false,
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
                    className={`flex-[2] text-white py-3 rounded-xl font-bold shadow-lg transition-all ${isSendingInvite ? "bg-purple-800 cursor-not-allowed opacity-70" : "bg-purple-600 hover:bg-purple-500 hover:scale-105"}`}
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
              className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-red-900/30 p-5 border-b border-red-900/50 flex justify-between items-center">
                <h3 className="text-xl font-bold text-red-400 flex items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation"></i> 聯動規範
                </h3>
                <button
                  onClick={() => setIsRulesModalOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">
                  {realRules}
                </div>
              </div>

              <div className="p-4 border-t border-gray-800 text-center">
                <button
                  onClick={() => setIsRulesModalOpen(false)}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-2.5 rounded-xl font-bold transition-colors w-full sm:w-auto"
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
              className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-yellow-900/30 p-5 border-b border-yellow-900/50 flex justify-between items-center">
                <h3 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
                  <i className="fa-solid fa-lightbulb"></i> 邀約小技巧
                </h3>
                <button
                  onClick={() => setIsTipsModalOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm mb-6">
                  {realTips}
                </div>
                <div className="bg-gray-800/80 p-4 rounded-xl border border-gray-700">
                  <p className="text-xs text-gray-500 mb-2 font-bold">
                    複製公版邀約詞 (可自行修改)
                  </p>
                  <div className="bg-black/50 p-3 rounded-lg text-sm text-gray-300 font-mono mb-3 select-all">
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
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg font-bold transition-colors text-sm"
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
              className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-blue-900/30 p-5 border-b border-blue-900/50 flex justify-between items-center">
                <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                  <i className="fa-solid fa-bullhorn"></i> 最新消息與功能發布
                </h3>
                <button
                  onClick={() => {
                    setIsUpdatesModalOpen(false);
                    handleMarkAllUpdatesRead();
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                {realUpdates.length === 0 ? (
                  <p className="text-center text-gray-500">目前沒有新消息。</p>
                ) : (
                  realUpdates.map((u) => (
                    <div key={u.id} className="relative">
                      {!readUpdateIds.includes(u.id) && (
                        <span className="absolute -left-2 top-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                      )}
                      <h4 className="font-bold text-white text-lg mb-1">
                        {u.title}
                      </h4>
                      <p className="text-xs text-blue-400 mb-2 font-mono">
                        {u.date}
                      </p>
                      <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {u.content}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-gray-800 bg-gray-900/90 text-center">
                <button
                  onClick={() => {
                    setIsUpdatesModalOpen(false);
                    handleMarkAllUpdatesRead();
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl font-bold transition-colors w-full sm:w-auto shadow-lg"
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
            <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-md p-8 text-center shadow-2xl relative">
              <div
                className={`absolute top-0 left-0 w-full h-2 ${myProfile.showVerificationModal === "approved" ? "bg-gradient-to-r from-green-400 to-emerald-500" : "bg-gradient-to-r from-red-500 to-orange-500"}`}
              ></div>

              <div className="mb-6">
                <div
                  className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${myProfile.showVerificationModal === "approved" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}
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
                <p className="text-gray-200 text-lg font-bold leading-relaxed mb-8">
                  恭喜你審核通過！
                  <br />
                  開始尋找聯動夥伴吧！
                </p>
              ) : (
                <p className="text-gray-300 text-sm leading-relaxed mb-8 text-left">
                  很抱歉，目前不開放YT訂閱或TWITCH追隨加起來低於500、尚未出道、長期準備中、一個月以上未有直播活動之Vtuber或經紀人加入，敬請見諒。如果以上你都有達到，那就是你沒有將「V-Nexus審核中」字樣放入你的X或YT簡介內，無法審核成功喔！
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
                    : "bg-gray-800 hover:bg-gray-700 border border-gray-600"
                    } text-white px-8 py-3 rounded-xl font-bold shadow-lg w-full transition-all`}
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
              className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-yellow-900/30 p-5 border-b border-yellow-900/50 flex justify-between items-center">
                <h3 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
                  <i className="fa-solid fa-trophy"></i> 揪團成功排行榜
                </h3>
                <button
                  onClick={() => setIsLeaderboardModalOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-3">
                {leaderboardData.length === 0 ? (
                  <p className="text-center text-gray-500 py-10">
                    目前還沒有人達成招募目標喔！
                    <br />
                    趕快成為第一個吧！
                  </p>
                ) : (
                  leaderboardData.map((vt, idx) => (
                    <div
                      key={vt.id || idx}
                      className={`flex items-center gap-4 p-3 rounded-xl border ${idx === 0 ? "bg-yellow-500/20 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)]" : idx === 1 ? "bg-gray-300/20 border-gray-300/50 shadow-[0_0_10px_rgba(209,213,219,0.2)]" : idx === 2 ? "bg-orange-500/20 border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.2)]" : "bg-gray-800/50 border-gray-700"}`}
                    >
                      <div className="w-8 text-center flex-shrink-0">
                        {idx === 0 ? (
                          <i className="fa-solid fa-crown text-2xl text-yellow-400"></i>
                        ) : idx === 1 ? (
                          <i className="fa-solid fa-medal text-xl text-gray-300"></i>
                        ) : idx === 2 ? (
                          <i className="fa-solid fa-award text-xl text-orange-400"></i>
                        ) : (
                          <span className="text-gray-500 font-bold">
                            {idx + 1}
                          </span>
                        )}
                      </div>
                      <img
                        src={sanitizeUrl(vt.avatar)}
                        className={`w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 ${idx === 0 ? "border-yellow-400" : idx === 1 ? "border-gray-300" : idx === 2 ? "border-orange-400" : "border-gray-600"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-bold truncate ${idx === 0 ? "text-yellow-400 text-lg" : idx === 1 ? "text-gray-200 text-base" : idx === 2 ? "text-orange-300 text-base" : "text-gray-300 text-sm"}`}
                        >
                          {vt.name}
                        </p>
                        <p className="text-xs text-gray-500">累積成功次數</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span
                          className={`font-black text-2xl ${idx === 0 ? "text-yellow-400" : idx === 1 ? "text-gray-300" : idx === 2 ? "text-orange-400" : "text-gray-400"}`}
                        >
                          {vt.successCount}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">次</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-gray-800 bg-gray-900/90 text-center">
                <button
                  onClick={() => setIsLeaderboardModalOpen(false)}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-2.5 rounded-xl font-bold transition-colors w-full sm:w-auto shadow-lg"
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
              className="bg-gray-900 border border-red-500/50 rounded-3xl w-full max-w-md p-8 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <i className="fa-solid fa-triangle-exclamation text-5xl text-red-500 mb-4"></i>
              <h3 className="text-xl font-bold text-white mb-2">
                確定要對 {confirmDislikeData.name} 送出倒讚？
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                倒讚功能僅用於檢舉「負面行為」或「惡意騷擾」。
                <br />
                若該名片累積超過 10 個倒讚將自動下架。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDislikeData(null)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmDislike}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105"
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
              className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md flex flex-col max-h-[80vh] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-gray-900/95 backdrop-blur px-6 py-4 border-b border-gray-800 flex justify-between items-center z-10">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-users text-purple-400"></i>{" "}
                  聯動參與成員
                </h3>
                <button
                  onClick={() => setViewParticipantsCollab(null)}
                  className="text-gray-400 hover:text-white"
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
                      className="flex items-center justify-between bg-gray-800/50 p-3 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-all cursor-pointer group"
                      onClick={() => {
                        setSelectedVTuber(vt);
                        navigate(`profile/${vt.id}`);
                        // 這裡絕對不能有 setViewParticipantsCollab(null)
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={sanitizeUrl(vt.avatar)}
                          className="w-12 h-12 rounded-full object-cover border-2 border-gray-700 group-hover:border-purple-400 transition-colors"
                        />
                        <div>
                          <p className="font-bold text-white text-sm group-hover:text-purple-300 transition-colors">
                            {vt.name}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {vt.agency} | 點擊查看名片
                          </p>
                        </div>
                      </div>
                      <i className="fa-solid fa-chevron-right text-gray-600 group-hover:text-purple-400 transition-colors"></i>
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
              <div className="absolute bottom-16 right-0 w-[90vw] sm:w-80 bg-gray-900 border border-gray-700 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.8)] overflow-hidden animate-fade-in-up">
                <div className="bg-purple-600 p-3 flex justify-between items-center text-white shadow-md">
                  <span className="font-bold text-sm flex items-center gap-2">
                    <i className="fa-solid fa-comments"></i> 訊息列表
                  </span>
                  <button
                    onClick={() => setIsChatListOpen(false)}
                    className="hover:bg-purple-700 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
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
              className="bg-purple-600 hover:bg-purple-500 text-white w-14 h-14 rounded-full shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center transition-transform hover:scale-105 border-2 border-purple-400/30 relative"
            >
              <i
                className={`fa-solid ${isChatListOpen ? "fa-xmark text-xl" : "fa-message text-2xl"}`}
              ></i>

              {/* 新增：如果有未讀私訊且列表未開啟，顯示閃爍紅點 */}
              {!isChatListOpen && hasUnreadChat && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-red-600 border-2 border-gray-900 flex items-center justify-center">
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

        <footer className="py-6 border-t border-gray-800 text-center text-gray-500 text-sm">
          <p>
            © {new Date().getFullYear()} V-Nexus. 專為 VTuber 打造的聯動平台。
          </p>
        </footer>
      </div>
    </AppContext.Provider>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
