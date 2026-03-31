import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, updateDoc, increment, arrayUnion, arrayRemove, query, where, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
// --- 務必確認這行有在頂部 ---
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";
// --- API 金鑰設定區 (請在此填入您申請到的金鑰) ---
const YOUTUBE_API_KEY = "請填入您的YouTube_API_KEY";
// --------------------------------------------------

const { useState, useEffect, useMemo, useRef } = React;

const firebaseConfig = {
  apiKey: "AIzaSyD_JJZUcT56VkHFH0ykBRJQ_nFLK_4p7kY",
  authDomain: "v-nexus.firebaseapp.com",
  projectId: "v-nexus",
  storageBucket: "v-nexus.firebasestorage.app",
  messagingSenderId: "824125737901",
  appId: "1:824125737901:web:93a4f21b56ab00dfaaaf24"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const functionsInstance = getFunctions(app);

try {
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider('6LdINZksAAAAAF5FtNfKOOsDPaHQue3SmuAVqR4M'), isTokenAutoRefreshEnabled: true });
} catch (error) { console.warn("App Check:", error); }

const provider = new GoogleAuthProvider();
const APP_ID = 'v-nexus-official';
const getPath = (collectionName) => `artifacts/${APP_ID}/public/data/${collectionName}`;

const sanitizeUrl = (url) => {
  if (typeof url !== 'string' || !url) return '';
  const u = url.trim();
  let decoded = u;
  try {
    let prevDecoded;
    do {
      prevDecoded = decoded;
      decoded = decodeURIComponent(decoded);
    } while (prevDecoded !== decoded && decoded.length < 2000);
  } catch (e) { }
  const normalized = decoded.replace(/[\s\x00-\x1f\x7f-\x9f]/g, '').toLowerCase();
  if (normalized.startsWith('javascript:') || normalized.startsWith('vbscript:') || normalized.startsWith('data:text')) {
    return 'about:blank';
  }
  return u;
};

const PREDEFINED_COLLABS = ['APEX', '瓦羅蘭', 'LOL', 'FPS', 'Minecraft', '合作遊戲', '企劃', '歌回', '雜談'];
const COLLAB_CATEGORIES = ['遊戲', '雜談歌回', '特別企劃'];
const COLOR_OPTIONS = ['紅', '橙', '黃', '綠', '藍', '紫', '灰', '黑', '白', '粉']; // 新增色系選項
const inputCls = "w-full min-w-0 box-border bg-gray-900 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none text-sm";
const btnCls = "w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white py-3 px-8 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 flex justify-center items-center gap-2";

const formatTime = (ts) => { if (!ts) return "剛剛"; const d = new Date(ts); return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const formatDateTimeLocalStr = (dtStr) => { if (!dtStr) return '未指定'; const d = new Date(dtStr); if (isNaN(d.getTime())) return dtStr; return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const formatSchedule = (v) => { if (v.isScheduleAnytime) return "我都可以 (隨時可約)"; if (v.isScheduleCustom && v.customScheduleText) return v.customScheduleText; if (v.isScheduleExcept && v.scheduleSlots?.length > 0) return "除了：" + v.scheduleSlots.map(s => `${s.day} ${s.start}~${s.end}`).join('、') + "，其餘皆可"; if (v.scheduleSlots?.length > 0) return v.scheduleSlots.map(s => `${s.day} ${s.start}~${s.end}`).join('、'); return v.schedule || '未提供時段'; };
const getYouTubeThumbnail = (url) => { if (!url || typeof url !== 'string') return null; const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/); return (match && match[2].length === 11) ? `https://img.youtube.com/vi/${match[2]}/maxresdefault.jpg` : null; };

const autoFetchYouTubeInfo = async (url, setTitle, setCoverUrl, showToast) => {
  if (!url) return showToast("請先輸入 YouTube 連結");
  const ytMatch = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  if (ytMatch && ytMatch[2].length === 11) {
    setCoverUrl(`https://img.youtube.com/vi/${ytMatch[2]}/maxresdefault.jpg`);
    try {
      const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytMatch[2]}`);
      const data = await res.json(); if (data.title) setTitle(data.title);
      showToast("✅ 已自動抓取標題與封面圖！");
    } catch (e) { showToast("✅ 已自動填入封面圖！(標題需手動輸入)"); }
  } else { showToast("這似乎不是有效的 YouTube 連結"); }
};

const parseSubscribers = (v) => {
  const parseStr = (str) => { if (!str) return 0; let s = String(str); let num = parseFloat(s.replace(/[^0-9.]/g, '')); if (isNaN(num)) return 0; if (s.toUpperCase().includes('K')) num *= 1000; if (s.toUpperCase().includes('M')) num *= 1000000; if (s.toUpperCase().includes('萬')) num *= 10000; return num; };
  return parseStr(v.youtubeSubscribers || v.subscribers) + parseStr(v.twitchFollowers);
};

const isVisible = (v, currentUser) => {
  if (!v) return false;
  if (currentUser && v.id === currentUser.uid) return true;
  if (String(v.id || '').startsWith('mock')) return true;
  if (!v.isVerified || v.isBlacklisted) return false;
  if (v.activityStatus === 'sleep' || v.activityStatus === 'graduated') return false;
  if (Date.now() - (v.lastActiveAt || v.updatedAt || v.createdAt || Date.now()) > 30 * 24 * 60 * 60 * 1000) return false;
  return true;
};

const TagBadge = ({ text, onClick, selected }) => (<span onClick={onClick} className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors border ${selected ? 'bg-purple-600 text-white border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'}`}>{text}</span>);

const CollabCard = ({ c, isLive, isAdmin, user, onDeleteCollab, vtuber, onNavigateProfile, realVtubers, onShowParticipants }) => {
  if (!c) return null;
  const displayImg = sanitizeUrl(c.coverUrl || getYouTubeThumbnail(c.streamUrl) || 'https://duk.tw/bs1Moc.jpg');
  return (
    <div className={`group ${isLive ? 'bg-red-950/40 border-2 border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.4)] transform scale-[1.02] z-10' : 'bg-gray-800/60 border border-gray-700 hover:border-red-500/50 hover:shadow-red-500/20'} rounded-3xl overflow-hidden flex flex-col transition-all relative w-full`}>
      {isLive && <div className="absolute top-0 left-0 w-full bg-red-600 text-white text-center py-1.5 font-bold text-xs tracking-widest z-30 animate-pulse"><i className="fa-solid fa-satellite-dish mr-2"></i> 正在進行聯動中</div>}
      {onDeleteCollab && (isAdmin || (user && c.userId === user.uid)) && <button onClick={() => onDeleteCollab(c.id)} className={`absolute ${isLive ? 'top-10' : 'top-4'} right-4 z-20 bg-black/60 backdrop-blur-md text-gray-300 hover:text-red-400 hover:bg-black/80 p-2 rounded-lg transition-colors`} title="刪除此行程"><i className="fa-solid fa-trash"></i></button>}
      <div className={`h-48 relative overflow-hidden flex-shrink-0 ${isLive ? 'mt-8' : ''}`}>
        <img src={displayImg} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="聯動封面" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/20 to-transparent"></div>
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-gray-600 text-white px-3 py-1.5 rounded-xl flex flex-col items-center shadow-lg transform -rotate-2">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">{c.date}</span><span className="text-sm text-red-400 font-extrabold">{c.time}</span>
        </div>
        {c.streamUrl && <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"><div className={`w-16 h-16 ${isLive ? 'bg-red-500' : 'bg-red-600/90'} text-white rounded-full flex items-center justify-center pl-1 shadow-[0_0_30px_rgba(220,38,38,0.8)] backdrop-blur-sm`}><i className="fa-solid fa-play text-2xl"></i></div></div>}
      </div>
      <div className="p-6 flex-1 flex flex-col relative z-10 bg-gray-900/80">
        <div className="mb-2"><span className="bg-purple-500/20 text-purple-300 text-[10px] px-2 py-1 rounded-lg border border-purple-500/30 font-bold">{c.category || '遊戲'}</span></div>
        <h3 className={`text-xl font-extrabold text-white mb-6 line-clamp-2 leading-tight transition-colors ${isLive ? 'text-red-400' : 'group-hover:text-red-400'}`}>{c.title}</h3>
        {/* 顯示參與成員 */}
        {c.participants && c.participants.length > 0 && (
          <div
            className="flex items-center gap-2 mb-4 cursor-pointer hover:bg-gray-800/50 p-1 -ml-1 rounded-lg transition-colors group/members"
            onClick={(e) => { e.stopPropagation(); onShowParticipants(c); }}
          >
            <span className="text-[10px] text-gray-500 font-bold">聯動成員:</span>
            <div className="flex -space-x-2">
              {c.participants.map(pId => {
                const pVt = realVtubers.find(v => v.id === pId);
                return pVt ? (
                  <img
                    key={pId}
                    src={sanitizeUrl(pVt.avatar)}
                    className="w-6 h-6 rounded-full border border-gray-900 object-cover"
                  />
                ) : null;
              })}
            </div>
            <span className="text-[10px] text-purple-400 opacity-0 group-hover/members:opacity-100 transition-opacity ml-1">查看名單</span>
          </div>
        )}
        <div className="mt-auto">
          {c.streamUrl ? <a href={sanitizeUrl(c.streamUrl)} target="_blank" rel="noopener noreferrer" className={`w-full ${isLive ? 'bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.6)] animate-pulse' : 'bg-red-600 hover:bg-red-500 group-hover:shadow-[0_0_20px_rgba(220,38,38,0.4)]'} text-white py-3.5 rounded-xl font-bold transition-all flex justify-center items-center gap-2`}><i className="fa-solid fa-play-circle text-lg"></i> 前往待機室 / 觀看直播</a> : <div className="w-full bg-gray-800 text-gray-500 py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 border border-gray-700"><i className="fa-solid fa-clock"></i> 直播連結尚未提供</div>}
          {vtuber && vtuber.id !== 'admin' && onNavigateProfile && (
            <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNavigateProfile(vtuber); }} className="mt-4 pt-4 border-t border-gray-700/50 flex items-center justify-between cursor-pointer group/author hover:bg-gray-800/80 p-2 -mx-2 rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <img src={sanitizeUrl(vtuber.avatar)} className="w-8 h-8 rounded-full border border-gray-600 object-cover" />
                <div className="text-left"><p className="text-[10px] text-gray-400 mb-0.5">發起人</p><p className="text-sm font-bold text-white group-hover/author:text-purple-400 transition-colors truncate max-w-[150px]">{vtuber.name}</p></div>
              </div>
              <button className="text-xs bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg group-hover/author:bg-purple-600 group-hover/author:text-white transition-colors font-bold"><i className="fa-solid fa-id-card mr-1.5"></i>查看名片</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const VTuberCard = ({ v, user, isVerifiedUser, onSelect, onDislike }) => (
  <div onClick={onSelect} className={`group bg-gray-800/40 border ${!v.isVerified ? 'border-yellow-500/50' : 'border-gray-700/50'} rounded-2xl overflow-hidden cursor-pointer hover:border-purple-500/50 transition-all hover:-translate-y-1 flex flex-col relative`}>
    <div className="absolute top-2 left-2 z-10 flex gap-1">
      {!v.isVerified && <div className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow-lg">待審核</div>}
      {v.activityStatus === 'sleep' && <div className="bg-gray-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg">休眠中</div>}
      <div className={`text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg flex items-center gap-1 ${v.mainPlatform === 'Twitch' ? 'bg-purple-600' : 'bg-red-600'}`}><i className={`fa-brands fa-${v.mainPlatform === 'Twitch' ? 'twitch' : 'youtube'}`}></i> {v.mainPlatform || 'YouTube'}</div>
    </div>
    <div className="h-24 relative overflow-hidden flex-shrink-0"><img src={sanitizeUrl(v.banner)} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform" /><span className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold bg-black/50 border border-gray-600 rounded text-white">{v.agency}</span></div>
    <div className="p-4 relative flex-1 flex flex-col">
      <img src={sanitizeUrl(v.avatar)} className="absolute -top-8 w-16 h-16 rounded-xl border-2 border-gray-800 bg-gray-900 object-cover" />
      <div className="ml-20 mb-3">
        <h3 className="font-bold text-white truncate flex items-center gap-1">{v.name} {v.isVerified && <i className="fa-solid fa-circle-check text-blue-400 text-xs" title="已認證"></i>}</h3>
        <div className="flex flex-wrap gap-2 text-xs mt-1 text-gray-400">
          {(v.youtubeSubscribers || v.subscribers || v.youtubeUrl || v.channelUrl) && <span className="flex items-center gap-1"><i className="fa-brands fa-youtube text-red-400"></i> {v.youtubeSubscribers || v.subscribers || '未公開'}</span>}
          {(v.twitchFollowers || v.twitchUrl) && <span className="flex items-center gap-1"><i className="fa-brands fa-twitch text-purple-400"></i> {v.twitchFollowers || '未公開'}</span>}
          <span className="flex items-center gap-1 text-green-400"><i className="fa-solid fa-thumbs-up"></i> {v.likes || 0}</span>
        </div>
      </div>
      <p className="text-xs text-gray-400 line-clamp-2 h-8">{v.description}</p>
      {v.streamStyleUrl && <div className="mt-1 mb-1"><a href={sanitizeUrl(v.streamStyleUrl)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-2 py-1 rounded transition-colors border border-blue-500/30 w-fit font-bold"><i className="fa-solid fa-video"></i> 觀看我的直播風格</a></div>}
      <div className="mt-auto pt-2 border-t border-gray-700/50 text-xs text-gray-400 flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2"><i className="fa-solid fa-clock text-purple-400"></i> <span className="truncate">{formatSchedule(v)}</span></div>
        {isVerifiedUser && v.id !== user?.uid && <button onClick={(e) => { e.stopPropagation(); onDislike(v); }} className="bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-50 hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1 flex-shrink-0" title="檢舉負面行為"><i className="fa-solid fa-thumbs-down text-[10px]"></i></button>}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-700/50 flex gap-2">
        {(v.youtubeUrl || v.channelUrl) && (v.youtubeUrl || v.channelUrl) !== '#' ? <a href={sanitizeUrl(v.youtubeUrl || v.channelUrl)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="bg-red-500/20 text-red-400 hover:bg-red-50 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-center flex-shrink-0 gap-1" title="YouTube"><i className="fa-brands fa-youtube text-sm"></i>{(v.youtubeSubscribers || v.subscribers) && <span className="text-[10px] font-bold">{v.youtubeSubscribers || v.subscribers}</span>}</a> : (v.youtubeSubscribers || v.subscribers) ? <div className="bg-red-500/10 text-red-400/80 px-2.5 py-1.5 rounded-lg flex items-center justify-center flex-shrink-0 gap-1" title="YouTube 訂閱數"><i className="fa-brands fa-youtube text-sm"></i><span className="text-[10px] font-bold">{v.youtubeSubscribers || v.subscribers}</span></div> : null}
        {v.twitchUrl && v.twitchUrl !== '#' ? <a href={sanitizeUrl(v.twitchUrl)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="bg-purple-500/20 text-purple-400 hover:bg-purple-50 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-center flex-shrink-0 gap-1" title="Twitch"><i className="fa-brands fa-twitch text-sm"></i>{v.twitchFollowers && <span className="text-[10px] font-bold">{v.twitchFollowers}</span>}</a> : v.twitchFollowers ? <div className="bg-purple-500/10 text-purple-400/80 px-2.5 py-1.5 rounded-lg flex items-center justify-center flex-shrink-0 gap-1" title="Twitch 追隨數"><i className="fa-brands fa-twitch text-sm"></i><span className="text-[10px] font-bold">{v.twitchFollowers}</span></div> : null}
        {v.xUrl && v.xUrl !== '#' && <a href={sanitizeUrl(v.xUrl)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="bg-blue-500/20 text-blue-400 hover:bg-blue-50 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-center flex-shrink-0" title="X (Twitter)"><i className="fa-brands fa-x-twitter text-sm"></i></a>}
        {v.igUrl && v.igUrl !== '#' && <a href={sanitizeUrl(v.igUrl)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="bg-pink-500/20 text-pink-400 hover:bg-pink-50 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-center flex-shrink-0" title="Instagram"><i className="fa-brands fa-instagram text-sm"></i></a>}
      </div>
    </div>
  </div>
);

const BulletinCard = ({ b, user, isVerifiedUser, onNavigateProfile, onApply, onInvite, onDeleteBulletin, onEditBulletin, openModalId, onClearOpenModalId }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showApplicants, setShowApplicants] = useState(false);
  const isAuthor = user?.uid === b.userId;
  const hasApplied = (b.applicants || []).includes(user?.uid);

  useEffect(() => {
    if (openModalId === b.id) {
      setShowApplicants(true);
      if (onClearOpenModalId) onClearOpenModalId();
    }
  }, [openModalId, b.id]);

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-3xl overflow-hidden flex flex-col hover:border-purple-500/50 transition-all shadow-lg group">
      {b.image && (
        <div className="w-full h-48 sm:h-56 relative overflow-hidden flex-shrink-0 border-b border-gray-700">
          <img src={sanitizeUrl(b.image)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="招募附圖" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
        </div>
      )}
      <div className="bg-gray-900/80 p-5 border-b border-gray-700 flex items-start gap-4">
        <img src={sanitizeUrl(b.vtuber.avatar)} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNavigateProfile(b.vtuber, false); }} className="w-14 h-14 rounded-full border-2 border-purple-500/50 object-cover flex-shrink-0 cursor-pointer hover:scale-105 transition-transform" />
        <div className="flex-1 flex justify-between items-start gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-purple-400 font-bold text-[10px] bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">發起人</span>
              <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNavigateProfile(b.vtuber, false); }} className="font-extrabold text-white text-lg hover:text-purple-400 transition-colors cursor-pointer">{b.vtuber.name}</span>
              {b.vtuber.isVerified && <i className="fa-solid fa-circle-check text-blue-400 text-sm" title="已認證"></i>}
              <span className="text-white font-bold text-xs bg-purple-600 px-2.5 py-1 rounded-lg ml-1 shadow-sm border border-purple-500">{b.collabType || '未指定'}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5"><span className="text-[10px] text-gray-400">{b.vtuber.agency}</span><span className="text-gray-600 text-[10px]">•</span><span className="text-[10px] text-gray-400">{b.postedAt} 發布</span></div>
          </div>
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col">
        {/* 找到 BulletinCard 內部的這個區塊並完整替換 */}
        <div className="mb-4">
          {/* 將 line-clamp-[10] 改為 line-clamp-4，讓未展開時更簡潔 */}
          <div className={`text-gray-300 whitespace-pre-wrap text-sm leading-relaxed transition-all duration-300 ${isExpanded ? '' : 'line-clamp-4'}`}>
            {b.content}
          </div>

          {/* 移除原本的長度判斷條件，讓所有卡片都顯示按鈕 */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className="text-purple-400 hover:text-purple-300 text-xs font-bold mt-2 flex items-center gap-1 transition-colors bg-purple-500/10 px-3 py-1.5 rounded-lg w-full justify-center"
          >
            {isExpanded ? (
              <><i className="fa-solid fa-chevron-up"></i> 收起文案</>
            ) : (
              <><i className="fa-solid fa-chevron-down"></i> 點擊查看完整文案</>
            )}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-auto mb-4">
          <div className="bg-gray-900/50 p-3 rounded-xl flex flex-col"><span className="text-[10px] text-gray-500 mb-1"><i className="fa-solid fa-users"></i> 人數</span><span className="text-sm font-bold text-gray-200">{b.collabSize || '未指定'}</span></div>
          <div className="bg-gray-900/50 p-3 rounded-xl flex flex-col"><span className="text-[10px] text-gray-500 mb-1"><i className="fa-regular fa-calendar"></i> 時間</span><span className="text-sm font-bold text-gray-200">{formatDateTimeLocalStr(b.collabTime)}</span></div>
          <div className="bg-red-500/5 p-3 rounded-xl border border-red-500/20 flex flex-col col-span-2"><span className="text-[10px] text-red-400/80 mb-1"><i className="fa-solid fa-hourglass-half"></i> 截止</span><span className="text-sm font-bold text-red-300">{b.recruitEndTime ? formatTime(b.recruitEndTime) : '未指定'}</span></div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          {isAuthor ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between bg-gray-800/40 hover:bg-gray-800 p-3 rounded-xl border border-gray-700 cursor-pointer transition-colors" onClick={() => setShowApplicants(true)}>
                <div className="flex items-center gap-3">
                  <div className="bg-purple-500/20 w-8 h-8 rounded-full flex items-center justify-center text-purple-400"><i className="fa-solid fa-users"></i></div>
                  <span className="text-sm font-bold text-white">查看有意願的Vtuber ({b.applicantsData?.length || 0})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {b.applicantsData?.slice(0, 3).map(a => <img key={a.id} src={sanitizeUrl(a.avatar)} className="w-6 h-6 rounded-full ring-2 ring-gray-800 object-cover" />)}
                    {b.applicantsData?.length > 3 && <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 ring-2 ring-gray-900 text-[10px] text-gray-300">+{b.applicantsData.length - 3}</div>}
                  </div>
                  <i className="fa-solid fa-chevron-right text-gray-500 text-xs ml-2"></i>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-700/50">
                <button onClick={() => onEditBulletin && onEditBulletin(b)} className="text-[10px] font-bold bg-blue-600/80 hover:bg-blue-500 text-white px-3 py-1.5 rounded shadow transition-colors flex items-center"><i className="fa-solid fa-pen mr-1.5"></i>編輯招募</button>
                <button onClick={() => onDeleteBulletin && onDeleteBulletin(b.id)} className="text-[10px] font-bold bg-red-600/80 hover:bg-red-500 text-white px-3 py-1.5 rounded shadow transition-colors flex items-center"><i className="fa-solid fa-trash mr-1.5"></i>刪除招募</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 cursor-pointer group/apply hover:bg-gray-800/50 p-2 -ml-2 rounded-lg transition-colors" onClick={() => setShowApplicants(true)}>
                <span className="text-xs text-gray-400 group-hover/apply:text-white transition-colors">目前 {b.applicantsData?.length || 0} 人有意願</span>
                <div className="flex -space-x-2">{b.applicantsData?.slice(0, 3).map(a => <img key={a.id} src={sanitizeUrl(a.avatar)} className="w-6 h-6 rounded-full ring-2 ring-gray-800 object-cover" />)}{b.applicantsData?.length > 3 && <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 ring-2 ring-gray-900 text-[10px] text-gray-300">+{b.applicantsData.length - 3}</div>}</div>
                <span className="text-[10px] text-purple-400 opacity-0 group-hover/apply:opacity-100 transition-opacity ml-1">點擊展開</span>
              </div>
              {isVerifiedUser && <button onClick={() => onApply(b.id, !hasApplied)} className={`text-xs font-bold px-4 py-2 rounded-xl transition-transform hover:scale-105 ${hasApplied ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-purple-600 text-white hover:bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]'}`}>{hasApplied ? '收回意願' : '✋ 我有意願'}</button>}
            </div>
          )}
        </div>
      </div>

      {showApplicants && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setShowApplicants(false); }}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md flex flex-col max-h-[80vh] shadow-2xl cursor-default" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-gray-900/95 backdrop-blur px-6 py-4 border-b border-gray-800 flex justify-between items-center z-10">
              <h3 className="font-bold text-white flex items-center gap-2"><i className="fa-solid fa-users text-purple-400"></i> 有意願的Vtuber ({b.applicantsData?.length || 0})</h3>
              <button onClick={() => setShowApplicants(false)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              {b.applicantsData?.length > 0 ? b.applicantsData.map(a => (
                <div key={a.id} className="flex items-center justify-between bg-gray-800/50 p-3 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-all cursor-pointer group" onClick={(e) => { e.stopPropagation(); setShowApplicants(false); onNavigateProfile(a, true); }}>
                  <div className="flex items-center gap-4">
                    <img src={sanitizeUrl(a.avatar)} className="w-12 h-12 rounded-full object-cover border-2 border-gray-700 group-hover:border-purple-400 transition-colors" />
                    <div>
                      <p className="font-bold text-white text-sm group-hover:text-purple-300 transition-colors">{a.name}</p>
                      <p className="text-[10px] text-gray-400 mt-1">點擊查看名片</p>
                    </div>
                  </div>
                  {isAuthor && <button onClick={(e) => { e.stopPropagation(); setShowApplicants(false); onInvite(a); }} className="bg-purple-600 hover:bg-purple-500 text-xs text-white px-4 py-2 rounded-lg shadow-lg transition-transform hover:scale-105 font-bold">發送邀約</button>}
                </div>
              )) : <p className="text-sm text-gray-500 text-center py-6">目前還沒有人表達意願喔！</p>}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const MatchPage = ({ vtubers, navigate, showToast, currentUser, setSelectedVTuber, onBraveInvite, isVerifiedUser }) => {
  const [desiredType, setDesiredType] = useState('');
  const [matchedVtuber, setMatchedVtuber] = useState(null);
  const [isMatching, setIsMatching] = useState(false);

  const handleMatch = () => {
    setIsMatching(true);
    setMatchedVtuber(null);
    // 模擬雷達掃描動畫
    setTimeout(() => {
      const candidates = (vtubers || []).filter(v => isVisible(v, currentUser) && v.id !== currentUser?.uid);
      if (candidates.length === 0) {
        setIsMatching(false);
        return showToast("目前資料庫尚無可配對的已認證創作者！");
      }
      let filtered = desiredType ? candidates.filter(v => Array.isArray(v.collabTypes) && v.collabTypes.includes(desiredType)) : candidates;
      if (filtered.length === 0) {
        showToast("找不到完全符合類型的對象，為您隨機推薦一位命定夥伴！");
        filtered = candidates;
      } else {
        showToast("🎉 配對成功！");
      }
      setMatchedVtuber(filtered[Math.floor(Math.random() * filtered.length)]);
      setIsMatching(false);
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 text-center animate-fade-in-up">
      <h2 className="text-3xl font-extrabold text-purple-400 mb-4 flex justify-center items-center gap-3"><i className="fa-solid fa-dice"></i> 聯動隨機配對</h2>
      <p className="text-gray-400 mb-10">不知道該找誰玩嗎？讓 V-Nexus 幫您隨機抽籤配對，或許會遇到意想不到的好夥伴喔！</p>

      <div className="bg-gray-800/40 border border-gray-700 rounded-3xl p-8 shadow-2xl max-w-2xl mx-auto relative overflow-hidden">
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl"></div>

        {!isMatching && !matchedVtuber && (
          <div className="space-y-6 relative z-10 animate-fade-in-up">
            <div className="text-left">
              <label className="block text-sm font-bold text-gray-300 mb-2">想要聯動的類型 (選填)</label>
              <select value={desiredType} onChange={e => setDesiredType(e.target.value)} className={inputCls}>
                <option value="">不限類型 (完全隨機)</option>
                {PREDEFINED_COLLABS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button onClick={handleMatch} className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-4 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-transform hover:scale-105 flex justify-center items-center gap-2">
              <i className="fa-solid fa-wand-magic-sparkles"></i> 開始尋找命定夥伴
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
            <h3 className="text-xl font-bold text-white mb-2 animate-pulse">雷達掃描中...</h3>
          </div>
        )}

        {matchedVtuber && !isMatching && (
          <div className="animate-fade-in-up relative z-10">
            <h3 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-6">就是決定是你了！</h3>

            {/* 詳細名片資訊區 */}
            <div className="w-full bg-gray-900/90 border border-purple-500/50 rounded-2xl overflow-hidden shadow-2xl flex flex-col text-left mb-8">
              <div className="h-32 relative overflow-hidden">
                <img src={sanitizeUrl(matchedVtuber.banner)} className="w-full h-full object-cover opacity-50" />
                <div className="absolute top-2 right-2 flex gap-2">
                  <span className="px-2 py-1 bg-black/60 rounded text-[10px] text-white font-bold">{matchedVtuber.agency}</span>
                  <span className={`px-2 py-1 rounded text-[10px] text-white font-bold ${matchedVtuber.mainPlatform === 'Twitch' ? 'bg-purple-600' : 'bg-red-600'}`}>
                    <i className={`fa-brands fa-${matchedVtuber.mainPlatform === 'Twitch' ? 'twitch' : 'youtube'} mr-1`}></i>{matchedVtuber.mainPlatform}
                  </span>
                </div>
              </div>
              <div className="p-6 relative">
                <img src={sanitizeUrl(matchedVtuber.avatar)} className="absolute -top-12 left-6 w-24 h-24 rounded-2xl border-4 border-gray-900 bg-gray-800 object-cover shadow-xl" />
                <div className="ml-28 min-h-[80px]">
                  <h4 className="text-2xl font-bold text-white flex items-center gap-2">
                    {matchedVtuber.name} {matchedVtuber.isVerified && <i className="fa-solid fa-circle-check text-blue-400 text-sm"></i>}
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs text-green-400 font-bold bg-green-500/10 px-2 py-1 rounded"><i className="fa-solid fa-thumbs-up mr-1"></i>{matchedVtuber.likes || 0} 推薦</span>
                    <span className="text-xs text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded"><i className="fa-brands fa-youtube mr-1"></i>{matchedVtuber.youtubeSubscribers || '0'}</span>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mt-4 line-clamp-3 leading-relaxed">{matchedVtuber.description}</p>
                <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap gap-2">
                  {(matchedVtuber.collabTypes || []).slice(0, 3).map(t => (
                    <span key={t} className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-1 rounded-lg border border-purple-500/30 font-bold">#{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* 按鈕群組 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isVerifiedUser && matchedVtuber.id !== currentUser?.uid && (
                <button onClick={() => onBraveInvite(matchedVtuber)} className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-heart"></i> 勇敢邀請
                </button>
              )}
              <button onClick={() => { setSelectedVTuber(matchedVtuber); navigate(`profile/${matchedVtuber.id}`); }} className="bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2">
                <i className="fa-solid fa-address-card"></i> 前往詳細名片
              </button>
              <button onClick={handleMatch} className="sm:col-span-2 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl font-bold border border-gray-700 transition-colors flex items-center justify-center gap-2">
                <i className="fa-solid fa-rotate-right"></i> 不滿意？再抽一次
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ScheduleEditor = ({ form, updateForm }) => {
  const mode = form.isScheduleAnytime ? 'anytime' : form.isScheduleExcept ? 'except' : form.isScheduleCustom ? 'custom' : 'specific';
  const handleModeChange = (e) => { const m = e.target.value; updateForm({ isScheduleAnytime: m === 'anytime', isScheduleExcept: m === 'except', isScheduleCustom: m === 'custom' }); };
  const updateSlot = (idx, field, val) => { const newSlots = [...(form.scheduleSlots || [])]; newSlots[idx][field] = val; updateForm({ scheduleSlots: newSlots }); };
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mt-1">
      <div className="mb-3"><select value={mode} onChange={handleModeChange} className={inputCls + " font-normal"}><option value="specific">✔️ 指定可聯動時段</option><option value="except">❌ 除了以下時段，其他皆可</option><option value="custom">✍️ 自訂時間 (自行手動輸入時間)</option><option value="anytime">🌟 我都可以 (隨時可約)</option></select></div>
      {mode === 'custom' && <div className="space-y-3 border-t border-gray-700 pt-3"><input type="text" value={form.customScheduleText || ''} onChange={e => updateForm({ customScheduleText: e.target.value })} placeholder="例如：每個月底的週末晚上..." className={inputCls} /></div>}
      {(mode === 'specific' || mode === 'except') && (
        <div className="space-y-3 border-t border-gray-700 pt-3">
          {(form.scheduleSlots || []).map((slot, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2 bg-gray-800/50 p-2 rounded-lg border border-gray-700"><select value={slot.day} onChange={e => updateSlot(index, 'day', e.target.value)} className="bg-gray-800 border border-gray-600 rounded p-1.5 text-white text-xs outline-none">{['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日', '平日', '週末', '每日'].map(d => <option key={d} value={d}>{d}</option>)}</select><input type="time" lang="sv-SE" step="60" value={slot.start} onChange={e => updateSlot(index, 'start', e.target.value)} className="bg-gray-800 border border-gray-600 rounded p-1.5 text-white text-xs outline-none box-border min-w-0" /><span className="text-gray-400 text-xs">至</span><input type="time" lang="sv-SE" step="60" value={slot.end} onChange={e => updateSlot(index, 'end', e.target.value)} className="bg-gray-800 border border-gray-600 rounded p-1.5 text-white text-xs outline-none box-border min-w-0" /><button type="button" onClick={() => updateForm({ scheduleSlots: form.scheduleSlots.filter((_, i) => i !== index) })} className="text-red-400 hover:text-red-300 ml-auto px-2 transition-colors"><i className="fa-solid fa-trash"></i></button></div>
          ))}
          <button type="button" onClick={() => updateForm({ scheduleSlots: [...(form.scheduleSlots || []), { day: '星期一', start: '20:00', end: '22:00' }] })} className="text-xs text-purple-400 hover:text-white flex items-center gap-1 mt-2 bg-purple-500/10 hover:bg-purple-500 px-3 py-1.5 rounded-lg border border-purple-500/20 transition-colors"><i className="fa-solid fa-plus"></i> 新增時段</button>
        </div>
      )}
    </div>
  );
};

const CollabTypesEditor = ({ formState, setFormState, showToast }) => {
  const toggleCollab = (type) => { let newTypes = Array.isArray(formState.collabTypes) ? [...formState.collabTypes] : []; if (newTypes.includes(type)) { newTypes = newTypes.filter(t => t !== type); } else { if (newTypes.length + (formState.isOtherCollab ? 1 : 0) >= 3) return showToast("主要願意連動類型至多只能選擇三項喔！"); newTypes.push(type); } setFormState({ collabTypes: newTypes }); };
  const toggleOther = () => { const willBeChecked = !formState.isOtherCollab; if (willBeChecked && (Array.isArray(formState.collabTypes) ? formState.collabTypes.length : 0) >= 3) return showToast("主要願意連動類型至多只能選擇三項喔！"); setFormState({ isOtherCollab: willBeChecked }); };
  const currentTypes = Array.isArray(formState.collabTypes) ? formState.collabTypes : [];
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mt-1">
      <div className="flex flex-wrap gap-3">{PREDEFINED_COLLABS.map(type => (<label key={type} className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" checked={currentTypes.includes(type)} onChange={() => toggleCollab(type)} className="accent-purple-500 w-4 h-4" /><span className="text-sm text-gray-300 group-hover:text-white transition-colors">{type}</span></label>))}<label className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" checked={formState.isOtherCollab} onChange={toggleOther} className="accent-purple-500 w-4 h-4" /><span className="text-sm text-gray-300 group-hover:text-white transition-colors">其他</span></label></div>
      {formState.isOtherCollab && <div className="mt-3 pl-6"><input type="text" value={formState.otherCollabText || ''} onChange={e => setFormState({ otherCollabText: e.target.value })} placeholder="請輸入您的其他連動類型..." className={inputCls} /></div>}
    </div>
  );
};

const ProfileEditorForm = ({ form, updateForm, onSubmit, onCancel, isAdmin, showToast, user }) => {
  const [otpStatus, setOtpStatus] = useState('idle');
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState(null);
  const [isFetchingSubscribers, setIsFetchingSubscribers] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(form.lastYoutubeFetchTime || 0);
  const [isFetchingTwitch, setIsFetchingTwitch] = useState(false);
  const [lastTwitchFetchTime, setLastTwitchFetchTime] = useState(form.lastTwitchFetchTime || 0);

  const handleImageUpload = (e, field, maxWidth, maxHeight) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      e.target.value = '';
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
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const base64Str = canvas.toDataURL('image/jpeg', 0.7);

        if (base64Str.length > 800000) {
          e.target.value = '';
          return showToast("❌ 壓縮後依然太大，請先自行縮小尺寸後再上傳！");
        }
        updateForm({ [field]: base64Str });
        e.target.value = '';
        showToast(`✅ ${field === 'avatar' ? '頭像' : '橫幅'}上傳並自動壓縮成功！`);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const url = form.youtubeUrl || form.channelUrl;
    if (typeof url !== 'string' || url.length < 15) return;

    const timer = setTimeout(() => {
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      if ((url.includes('youtube.com') || url.includes('youtu.be')) && (now - lastFetchTime > TWENTY_FOUR_HOURS)) {
        handleAutoFetchSubscribers(url);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [form.youtubeUrl, form.channelUrl, lastFetchTime]);

  useEffect(() => {
    const url = form.twitchUrl;
    if (typeof url !== 'string' || url.length < 15) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      const SIX_HOURS = 6 * 60 * 60 * 1000;
      if (url.includes('twitch.tv') && (now - lastTwitchFetchTime > SIX_HOURS || isAdmin)) {
        handleAutoFetchTwitch(url);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [form.twitchUrl, lastTwitchFetchTime, isAdmin]);

  const handleAutoFetchTwitch = async (autoUrl = null) => {
    const url = typeof autoUrl === 'string' ? autoUrl : form.twitchUrl;
    if (typeof url !== 'string' || !url) return showToast("請先在下方填妥 Twitch 連結！");

    const now = Date.now();
    const SIX_HOURS = 6 * 60 * 60 * 1000;

    if (!isAdmin) {
      if (now - lastTwitchFetchTime < SIX_HOURS) {
        if (typeof autoUrl !== 'string') {
          const remainHours = Math.ceil((SIX_HOURS - (now - lastTwitchFetchTime)) / (60 * 60 * 1000));
          showToast(`⏳ 為了保護額度，6小時內只能抓取一次。請 ${remainHours} 小時後再試！`);
        }
        return;
      }
    }

    setIsFetchingTwitch(true);
    try {
      const fetchTwitchStats = httpsCallable(functionsInstance, 'fetchTwitchStats');
      const result = await fetchTwitchStats({ url });
      if (result.data && result.data.success) {
        const count = result.data.followerCount;
        let formattedCount = count.toString();
        if (count >= 10000) formattedCount = (count / 10000).toFixed(1).replace('.0', '') + '萬';
        else if (count >= 1000) formattedCount = (count / 1000).toFixed(1).replace('.0', '') + 'K';
        updateForm({ twitchFollowers: formattedCount, lastTwitchFetchTime: now });
        setLastTwitchFetchTime(now);

        if (user && user.uid) {
          updateDoc(doc(db, getPath('vtubers'), form.id || user.uid), {
            twitchFollowers: formattedCount,
            lastTwitchFetchTime: now
          }).catch(() => { });
        }
        if (typeof autoUrl !== 'string') showToast("✅ 成功抓取 Twitch 追隨數！");
      } else {
        if (typeof autoUrl !== 'string') showToast("❌ 抓取失敗: " + (result.data ? result.data.message : '未知錯誤'));
      }
    } catch (err) {
      console.error("Fetch Stats Error:", err);
      if (typeof autoUrl !== 'string') showToast("❌ 伺服器連線失敗，請檢查網址或稍後再試");
    } finally {
      setIsFetchingTwitch(false);
    }
  };

  const handleAutoFetchSubscribers = async (autoUrl = null) => {
    const url = typeof autoUrl === 'string' ? autoUrl : (form.youtubeUrl || form.channelUrl);
    if (typeof url !== 'string' || !url) return showToast("請先在下方填妥 YouTube 連結！");

    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    if (!isAdmin) {
      if (now - lastFetchTime < TWENTY_FOUR_HOURS) {
        if (typeof autoUrl !== 'string') {
          const remainHours = Math.ceil((TWENTY_FOUR_HOURS - (now - lastFetchTime)) / (60 * 60 * 1000));
          showToast(`⏳ 為了保護額度，24小時內只能抓取一次。請 ${remainHours} 小時後再試！`);
        }
        return;
      }
    }

    setIsFetchingSubscribers(true);
    try {
      const fetchYouTubeStats = httpsCallable(functionsInstance, 'fetchYouTubeStats');
      const result = await fetchYouTubeStats({ url });
      if (result.data && result.data.success) {
        const count = result.data.subscriberCount;
        let formattedCount = count.toString();
        if (count >= 10000) formattedCount = (count / 10000).toFixed(1).replace('.0', '') + '萬';
        else if (count >= 1000) formattedCount = (count / 1000).toFixed(1).replace('.0', '') + 'K';
        updateForm({ youtubeSubscribers: formattedCount, lastYoutubeFetchTime: now });
        setLastFetchTime(now);

        if (user && user.uid) {
          updateDoc(doc(db, getPath('vtubers'), form.id || user.uid), {
            youtubeSubscribers: formattedCount,
            lastYoutubeFetchTime: now
          }).catch(() => { });
        }

        if (typeof autoUrl !== 'string') showToast("✅ 成功抓取 YouTube 訂閱數！");
      } else {
        if (typeof autoUrl !== 'string') showToast("❌ 抓取失敗: " + (result.data ? result.data.message : '未知錯誤'));
      }
    } catch (err) {
      console.error("Fetch Stats Error:", err);
      if (typeof autoUrl !== 'string') showToast("❌ 伺服器連線失敗，請檢查網址或稍後再試");
    } finally {
      setIsFetchingSubscribers(false);
    }
  };

  const handleSendOtp = async () => {
    const email = form.publicEmail;
    if (!email || !email.includes('@')) return showToast("請輸入有效的信箱格式！");
    setOtpStatus('sending');
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    try {
      if (user && user.uid && !isAdmin) {
        await setDoc(doc(db, getPath('vtubers_private'), user.uid), { emailOtp: otp }, { merge: true });
      }
      await addDoc(collection(db, getPath('mail')), {
        to: email,
        message: {
          subject: "[V-Nexus] 公開工商信箱驗證碼",
          text: `您的驗證碼為：${otp}\n\n請回到 V-Nexus 網站輸入此 6 位數驗證碼，以完成信箱綁定認證。\n(此驗證碼僅供本次驗證使用，請勿外流)`
        }
      });
      setGeneratedOtp(otp);
      setOtpStatus('sent');
      showToast("✅ 驗證碼已寄出！請至信箱收取");
    } catch (err) {
      setOtpStatus('idle');
      showToast("發送失敗，請稍後再試或檢查資料庫權限");
    }
  };

  const handleVerifyOtp = () => {
    if (otpInput === generatedOtp) {
      updateForm({ publicEmailVerified: true });
      setOtpStatus('verified');
      setOtpInput('');
      showToast("✅ 信箱驗證成功！(請記得點擊最下方儲存名片)");
    } else {
      showToast("❌ 驗證碼錯誤！");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-5"><h3 className="text-purple-400 font-bold mb-3 flex items-center gap-2"><i className="fa-solid fa-power-off"></i> 名片顯示狀態</h3><select value={form.activityStatus} onChange={e => updateForm({ activityStatus: e.target.value })} className={inputCls + " font-normal"}><option value="active">🟢 活躍連動中</option><option value="sleep">🟡 暫休眠</option><option value="graduated">⚫ 已畢業</option></select></div>
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
            onChange={e => updateForm({ name: e.target.value })}
            className={inputCls}
            placeholder="請輸入您的藝名"
          />
        </div>

        {/* 右側：專屬網址 ID */}
        <div className="bg-purple-500/5 border border-purple-500/20 p-4 rounded-xl flex flex-col justify-center">
          <label className="block text-sm font-bold text-purple-300 mb-2">
            <i className="fa-solid fa-link mr-1"></i> 設定專屬網址 ID
          </label>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 text-[10px] font-mono hidden sm:inline">#profile/</span>
            <input
              type="text"
              placeholder="例如: daxiong"
              value={form.slug || ''}
              onChange={e => updateForm({ slug: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() })}
              className={inputCls + " font-mono text-purple-400 !p-2"}
            />
          </div>
        </div>
      </div>

      {/* 第二排：所屬勢力與演出型態 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">所屬勢力</label>
            <select value={form.agency} onChange={e => updateForm({ agency: e.target.value })} className={inputCls}>
              <option>個人勢</option><option>企業勢</option><option>社團勢</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">演出型態</label>
            <select value={form.streamingStyle} onChange={e => updateForm({ streamingStyle: e.target.value })} className={inputCls}>
              <option>一般型態</option><option>男聲女皮 (Babiniku)</option><option>女聲男皮</option><option>無性別/人外</option><option>其他</option>
            </select>
          </div>
        </div>
        {/* 這裡可以留空或放其他欄位 */}
        <div></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">國籍 (所在地)</label>
          <div className="flex flex-wrap gap-3 mb-2">
            {['台灣', '日本', '香港', '馬來西亞'].map(nat => (
              <label key={nat} className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" checked={(form.nationalities || []).includes(nat)} onChange={() => { let newNats = [...(form.nationalities || [])]; if (newNats.includes(nat)) newNats = newNats.filter(n => n !== nat); else newNats.push(nat); updateForm({ nationalities: newNats }); }} className="accent-purple-500 w-4 h-4" /><span className="text-sm text-gray-300 group-hover:text-white transition-colors">{nat}</span></label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" checked={form.isOtherNationality} onChange={() => updateForm({ isOtherNationality: !form.isOtherNationality })} className="accent-purple-500 w-4 h-4" /><span className="text-sm text-gray-300 group-hover:text-white transition-colors">其他(自行新增)</span></label>
          </div>
          {form.isOtherNationality && <input type="text" value={form.otherNationalityText || ''} onChange={e => updateForm({ otherNationalityText: e.target.value })} placeholder="請輸入國籍/所在地" className={inputCls} />}
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">使用語言</label>
          <div className="flex flex-wrap gap-3">
            {['國', '日', '英', '粵', '台語'].map(lang => (
              <label key={lang} className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" checked={(form.languages || []).includes(lang)} onChange={() => { let newLangs = [...(form.languages || [])]; if (newLangs.includes(lang)) newLangs = newLangs.filter(l => l !== lang); else newLangs.push(lang); updateForm({ languages: newLangs }); }} className="accent-purple-500 w-4 h-4" /><span className="text-sm text-gray-300 group-hover:text-white transition-colors">{lang}</span></label>
            ))}
          </div>
        </div>
      </div>
      <div><label className="block text-sm font-bold text-gray-300 mb-2">介紹一下你自己吧！ <span className="text-red-400">*</span></label><textarea required rows="3" value={form.description} onChange={e => updateForm({ description: e.target.value })} className={inputCls + " resize-none"} /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-300 mb-2">你是什麼人？</label>
            <select value={form.personalityType || ''} onChange={e => updateForm({ personalityType: e.target.value })} className={inputCls}>
              <option value="">請選擇...</option>
              <option value="我是I人">我是I人</option>
              <option value="時I時E">時I時E</option>
              <option value="我大E人">我大E人</option>
              <option value="看心情">看心情</option>
              <option value="其他">其他(自行新增)</option>
            </select>
            {form.personalityType === '其他' && <input type="text" value={form.personalityTypeOther || ''} onChange={e => updateForm({ personalityTypeOther: e.target.value })} placeholder="請輸入你是什麼人" className={inputCls + " mt-2"} />}
          </div>
          {/* 新增：色系選擇 */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-300 mb-2">你是什麼色系? (至多三項)</label>
            <div className="flex flex-wrap gap-3 bg-gray-900 border border-gray-700 rounded-xl p-4">
              {COLOR_OPTIONS.map(color => (
                <label key={color} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={(form.colorSchemes || []).includes(color)}
                    onChange={() => {
                      let newColors = [...(form.colorSchemes || [])];
                      if (newColors.includes(color)) {
                        newColors = newColors.filter(c => c !== color);
                      } else {
                        if (newColors.length >= 3) return showToast("色系至多只能選擇三項喔！");
                        newColors.push(color);
                      }
                      updateForm({ colorSchemes: newColors });
                    }}
                    className="accent-purple-500 w-4 h-4"
                  />
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{color}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="block text-sm font-bold text-gray-300 mb-2">內容標籤 (逗號分隔)</label>
          <input type="text" value={form.tags} onChange={e => updateForm({ tags: e.target.value })} className={inputCls} />
        </div>
        <div><label className="block text-sm font-bold text-gray-300 mb-2">主要願意連動類型 <span className="text-red-400">*</span></label><CollabTypesEditor formState={form} setFormState={updateForm} showToast={showToast} /></div>
      </div>
      <div><label className="block text-sm font-bold text-gray-300 mb-2">可聯動時段 <span className="text-red-400">*</span></label><ScheduleEditor form={form} updateForm={updateForm} /></div>
      {isAdmin && <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-bold text-gray-300 mb-2">推薦數</label><input type="number" value={form.likes} onChange={e => updateForm({ likes: Number(e.target.value) })} className={inputCls} /></div><div><label className="block text-sm font-bold text-gray-300 mb-2">倒讚數</label><input type="number" value={form.dislikes} onChange={e => updateForm({ dislikes: Number(e.target.value) })} className={inputCls} /></div></div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">YouTube 訂閱數</label>
          <div className="flex gap-2">
            <input type="text" readOnly value={form.youtubeSubscribers || ''} placeholder="系統將自動抓取" className={inputCls + " bg-gray-800 cursor-not-allowed text-gray-400"} />
            <button type="button" onClick={handleAutoFetchSubscribers} disabled={isFetchingSubscribers || (Date.now() - lastFetchTime < 24 * 60 * 60 * 1000 && !isAdmin)} className={`px-4 rounded-xl text-xs font-bold transition-colors flex-shrink-0 flex items-center justify-center ${Date.now() - lastFetchTime < 24 * 60 * 60 * 1000 && !isAdmin ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}>
              {isFetchingSubscribers ? <i className="fa-solid fa-spinner fa-spin"></i> : (Date.now() - lastFetchTime < 24 * 60 * 60 * 1000 && !isAdmin) ? <><i className="fa-solid fa-clock mr-1"></i>冷卻中</> : <><i className="fa-solid fa-wand-magic-sparkles mr-1"></i>手動抓取</>}
            </button>
          </div>
          <p className="text-[10px] text-purple-400/80 mt-1">（填妥下方 YouTube 連結後會自動抓取，每24小時限抓一次）</p>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">Twitch 追隨數</label>
          <div className="flex gap-2">
            <input type="text" readOnly value={form.twitchFollowers || ''} placeholder="系統將自動抓取" className={inputCls + " bg-gray-800 cursor-not-allowed text-gray-400"} />
            <button type="button" onClick={handleAutoFetchTwitch} disabled={isFetchingTwitch || (Date.now() - lastTwitchFetchTime < 6 * 60 * 60 * 1000 && !isAdmin)} className={`px-4 rounded-xl text-xs font-bold transition-colors flex-shrink-0 flex items-center justify-center ${Date.now() - lastTwitchFetchTime < 6 * 60 * 60 * 1000 && !isAdmin ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}>
              {isFetchingTwitch ? <i className="fa-solid fa-spinner fa-spin"></i> : (Date.now() - lastTwitchFetchTime < 6 * 60 * 60 * 1000 && !isAdmin) ? <><i className="fa-solid fa-clock mr-1"></i>冷卻中</> : <><i className="fa-solid fa-wand-magic-sparkles mr-1"></i>手動抓取</>}
            </button>
          </div>
          <p className="text-[10px] text-purple-400/80 mt-1">（填妥下方 Twitch 連結後會自動抓取，每6小時限抓一次）</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div><label className="flex items-center justify-between text-sm font-bold text-gray-300 mb-2"><span>YouTube 連結</span><label className="flex items-center gap-1 text-xs cursor-pointer text-purple-300 font-normal"><input type="radio" value="YouTube" checked={form.mainPlatform === 'YouTube'} onChange={e => updateForm({ mainPlatform: e.target.value })} className="accent-purple-500" />主平台</label></label><input type="url" value={form.youtubeUrl} onChange={e => updateForm({ youtubeUrl: e.target.value })} className={inputCls} /></div>
        <div><label className="flex items-center justify-between text-sm font-bold text-gray-300 mb-2"><span>Twitch 連結</span><label className="flex items-center gap-1 text-xs cursor-pointer text-purple-300 font-normal"><input type="radio" value="Twitch" checked={form.mainPlatform === 'Twitch'} onChange={e => updateForm({ mainPlatform: e.target.value })} className="accent-purple-500" />主平台</label></label><input type="url" value={form.twitchUrl} onChange={e => updateForm({ twitchUrl: e.target.value })} className={inputCls} /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-bold text-gray-300 mb-2">X連結</label><input type="url" value={form.xUrl} onChange={e => updateForm({ xUrl: e.target.value })} className={inputCls} /></div><div><label className="block text-sm font-bold text-gray-300 mb-2">Instagram</label><input type="url" value={form.igUrl} onChange={e => updateForm({ igUrl: e.target.value })} className={inputCls} /></div></div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 mt-2">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><i className="fa-solid fa-envelopes-bulk text-purple-400"></i> 聯絡信箱設定</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><label className="block text-sm font-bold text-gray-300 mb-2">私人聯絡 Email (選填)</label><input type="email" value={form.contactEmail} onChange={e => updateForm({ contactEmail: e.target.value })} className={inputCls} placeholder="僅供系統驗證使用，不公開" /></div>
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">公開工商信箱 (選填)</label>
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <input type="email" value={form.publicEmail || ''} onChange={e => { updateForm({ publicEmail: e.target.value, publicEmailVerified: false }); setOtpStatus('idle'); }} className={inputCls} placeholder="例如：business@example.com" />
                {form.publicEmailVerified && <p className="text-green-400 text-xs mt-1.5 font-bold"><i className="fa-solid fa-circle-check"></i> 信箱已驗證</p>}
              </div>
              {!form.publicEmailVerified && form.publicEmail && form.publicEmail.includes('@') && (
                <button type="button" onClick={handleSendOtp} disabled={otpStatus === 'sending'} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-3 rounded-xl text-xs font-bold whitespace-nowrap transition-colors border border-gray-600 flex-shrink-0">
                  {otpStatus === 'sending' ? <i className="fa-solid fa-spinner fa-spin"></i> : '發送驗證信'}
                </button>
              )}
            </div>
            {otpStatus === 'sent' && !form.publicEmailVerified && (
              <div className="mt-2 flex gap-2 animate-fade-in-up">
                <input type="text" maxLength="6" value={otpInput} onChange={e => setOtpInput(e.target.value)} placeholder="輸入6位數驗證碼" className={inputCls + " text-center tracking-widest font-bold py-2"} />
                <button type="button" onClick={handleVerifyOtp} className="bg-purple-600 hover:bg-purple-500 text-white px-5 rounded-xl text-sm font-bold whitespace-nowrap shadow-lg transition-transform hover:scale-105">確認</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 pt-2"><div><label className="block text-sm font-bold text-gray-300 mb-2">我的直播風格代表作</label><input type="url" value={form.streamStyleUrl} onChange={e => updateForm({ streamStyleUrl: e.target.value })} className={inputCls} placeholder="填入影片連結" /></div></div>

      {!isAdmin && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 mt-2">
          <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2"><i className="fa-solid fa-shield-halved"></i> 真人身分驗證 (防冒用) <span className="text-red-400">*</span></h3>
          <p className="text-xs text-gray-300 mb-4">請在X或Youtube簡介暫放「<span className="text-white font-bold bg-gray-800 px-1 rounded">V-Nexus審核中</span>」，審核後可移除。</p>
          <input required type="text" value={form.verificationNote || ''} onChange={e => updateForm({ verificationNote: e.target.value })} className={inputCls} placeholder="您的驗證方式為...(請填入Youtube或X，此資料保密)" />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>頭像網址 / 上傳</span>
            <span className="text-xs text-purple-400 font-normal">建議: 300x300px</span>
          </label>
          <div className="flex gap-3">
            <img src={sanitizeUrl(form.avatar)} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-gray-800" />
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <input type="text" value={form.avatar} onChange={e => updateForm({ avatar: e.target.value })} className={inputCls} placeholder="可直接貼上圖片網址" />
              <div className="relative w-full">
                <input type="file" accept="image/png, image/jpeg, image/webp" onChange={(e) => handleImageUpload(e, 'avatar', 300, 300)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <button type="button" className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs py-2 rounded-lg border border-gray-600 transition-colors flex items-center justify-center gap-2 relative z-0"><i className="fa-solid fa-cloud-arrow-up"></i> 從裝置上傳圖片 (自動壓縮省空間)</button>
              </div>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>橫幅網址 / 上傳</span>
            <span className="text-xs text-purple-400 font-normal">建議: 800x400px</span>
          </label>
          <div className="flex gap-3">
            <img src={sanitizeUrl(form.banner)} className="w-20 h-12 rounded-xl object-cover flex-shrink-0 bg-gray-800" />
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <input type="text" value={form.banner} onChange={e => updateForm({ banner: e.target.value })} className={inputCls} placeholder="可直接貼上圖片網址" />
              <div className="relative w-full">
                <input type="file" accept="image/png, image/jpeg, image/webp" onChange={(e) => handleImageUpload(e, 'banner', 800, 400)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <button type="button" className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs py-2 rounded-lg border border-gray-600 transition-colors flex items-center justify-center gap-2 relative z-0"><i className="fa-solid fa-cloud-arrow-up"></i> 從裝置上傳圖片 (自動壓縮省空間)</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="pt-6 border-t border-gray-700 flex justify-end gap-3">
        {onCancel && <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">取消</button>}
        <button type="submit" className={btnCls}><i className="fa-solid fa-floppy-disk mr-2"></i>{isAdmin ? '強制儲存更新' : '儲存名片'}</button>
      </div>
    </form>
  );
};

const InboxPage = ({ notifications, markAllAsRead, onMarkRead, onDelete, onNavigateProfile, onBraveResponse }) => {
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(notifications.length / itemsPerPage);
  const displayNotifications = notifications.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => { if (page > totalPages && totalPages > 0) setPage(totalPages); }, [notifications.length, totalPages, page]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 border-b border-gray-700 pb-4 gap-4">
        <div><h2 className="text-3xl font-extrabold text-white flex items-center gap-3"><i className="fa-solid fa-envelope-open-text text-purple-400"></i> 我的信箱</h2><p className="text-gray-400 mt-2 text-sm">您的專屬通知中心</p></div>
        {notifications.some(n => !n.read) && <button onClick={markAllAsRead} className="text-sm font-bold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 px-4 py-2 rounded-xl"><i className="fa-solid fa-check-double mr-1"></i> 全部標示為已讀</button>}
      </div>
      {notifications.length === 0 ? (
        <div className="text-center py-24 bg-gray-800/40 rounded-3xl border border-gray-700/50 shadow-xl"><i className="fa-regular fa-envelope-open text-6xl text-gray-600 mb-6"></i><p className="text-gray-400 font-bold text-lg">信箱目前空空如也！</p></div>
      ) : (
        <div className="space-y-4">
          {displayNotifications.map(n => (
            <div key={n.id} className={`p-5 sm:p-6 rounded-2xl border transition-all ${n.read ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-800 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]'}`}>
              <div className="flex items-start gap-4 sm:gap-5">
                <img src={sanitizeUrl(n.fromUserAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anon')} onClick={() => onNavigateProfile(n.fromUserId)} className="w-14 h-14 rounded-full border-2 border-gray-700 bg-gray-900 object-cover cursor-pointer hover:border-purple-400" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                    <h4 className="font-bold text-white text-lg flex flex-wrap items-center gap-2"><span onClick={() => onNavigateProfile(n.fromUserId)} className="cursor-pointer hover:text-purple-400">{n.fromUserName}</span>{!n.read && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse shadow-lg whitespace-nowrap">新通知</span>}</h4>
                    <span className="text-xs text-gray-500 font-medium whitespace-nowrap"><i className="fa-regular fa-clock mr-1"></i>{formatTime(n.createdAt)}</span>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap bg-gray-900/80 p-4 rounded-xl border border-gray-700/50 mt-3">{n.message}</p>
                  {n.type === 'brave_invite' && !n.handled && (
                    <div className="flex gap-3 mt-4 pt-4 border-t border-gray-700/50">
                      <button onClick={() => onBraveResponse(n.id, n.fromUserId, true)} className="text-xs font-bold text-white bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg shadow-md transition-transform hover:scale-105"><i className="fa-solid fa-check mr-1"></i> 可以試試</button>
                      <button onClick={() => onBraveResponse(n.id, n.fromUserId, false)} className="text-xs font-bold text-gray-300 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg shadow-md transition-transform hover:scale-105"><i className="fa-solid fa-xmark mr-1"></i> 委婉拒絕</button>
                    </div>
                  )}
                  <div className="flex flex-wrap justify-end gap-3 mt-5">
                    <button onClick={() => onNavigateProfile(n.fromUserId)} className="text-xs font-bold text-gray-300 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg flex items-center shadow-md"><i className="fa-solid fa-address-card mr-2"></i> 查看名片</button>
                    {!n.read && <button onClick={() => onMarkRead(n.id)} className="text-xs font-bold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 px-4 py-2 rounded-lg flex items-center shadow-md"><i className="fa-solid fa-check mr-2"></i> 標為已讀</button>}
                    <button onClick={() => onDelete(n.id)} className="text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-4 py-2 rounded-lg flex items-center shadow-md"><i className="fa-solid fa-trash mr-2"></i> 刪除此信</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className={`px-4 py-2 rounded-lg font-bold text-sm ${page === 1 ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>上一頁</button>
          <span className="text-gray-400 text-sm font-bold">第 {page} / {totalPages} 頁</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={`px-4 py-2 rounded-lg font-bold text-sm ${page === totalPages ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>下一頁</button>
        </div>
      )}
    </div>
  );
};

const HomePage = ({ navigate, onOpenRules, onOpenUpdates, hasUnreadUpdates, siteStats = { pageViews: null }, realCollabs = [], displayCollabs = [], currentTime = Date.now(), isLoadingCollabs, goToBulletin, registeredCount, realVtubers = [], setSelectedVTuber, realBulletins = [] }) => {
  const safeBulletins = Array.isArray(realBulletins) ? realBulletins : [];
  const completedCollabsCount = safeBulletins.filter(b => {
    let targetSize = 0;
    if (b.collabSize) {
      targetSize = parseInt(b.collabSize.replace('人', ''), 10);
    }
    if (isNaN(targetSize)) targetSize = 0;
    const isEnded = b.recruitEndTime && currentTime > b.recruitEndTime;
    const applicantsCount = Array.isArray(b.applicants) ? b.applicants.length : 0;
    return isEnded && targetSize > 0 && applicantsCount >= targetSize;
  }).length;

  const safeDisplayCollabs = Array.isArray(displayCollabs) ? displayCollabs : [];
  const randomCollabs = useMemo(() => [...safeDisplayCollabs].sort(() => 0.5 - Math.random()).slice(0, 4), [safeDisplayCollabs.map(c => c.id).join(',')]);

  return (
    <section className="pt-16 pb-20 px-4 text-center max-w-5xl mx-auto animate-fade-in-up">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium mb-6"><i className="fa-solid fa-rocket"></i> <span>專為 VTuber 打造的聯動平台</span></div>
      <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-12 leading-tight">V-NEXUS <br /><br />讓是I人的你 <br className="my-2" />也可以找到<span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-red-400">最佳聯動夥伴</span></h1>
      <p className="text-gray-400 mb-4 max-w-2xl mx-auto text-lg leading-relaxed">大家平時要找聯動夥伴，是不是不知道該如何開口，又不敢隨便私訊怕打擾對方？<br className="hidden md:block" />註冊你的名片，找尋你的夥伴吧！</p>
      <p className="text-red-400 text-sm font-bold mb-10 max-w-2xl mx-auto">目前不開放YT訂閱或TWITCH追隨加起來低於500、尚未出道、長期準備中、一個月以上未有直播活動之Vtuber或經紀人加入，敬請見諒。</p>
      <div className="flex flex-col sm:flex-row justify-center items-start gap-4">
        <button onClick={() => navigate('grid')} className="h-14 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white px-8 rounded-xl font-bold shadow-[0_0_25px_rgba(168,85,247,0.5)] transition-transform hover:scale-105 w-full sm:w-auto flex items-center justify-center">
          <i className="fa-solid fa-magnifying-glass mr-2"></i>開始尋找VT夥伴
        </button>
        <button onClick={() => navigate('dashboard')} className="h-14 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-8 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 w-full sm:w-auto flex items-center justify-center"><i className="fa-solid fa-pen-to-square mr-2"></i>註冊Vtuber名片</button>
        <div className="flex flex-col items-center w-full sm:w-auto">
          <button onClick={onOpenUpdates} className="relative h-14 bg-blue-600 hover:bg-blue-500 text-white px-8 rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-transform hover:scale-105 flex items-center justify-center w-full sm:w-auto">
            <i className="fa-solid fa-bullhorn mr-2"></i>最新消息/功能發布
            {hasUnreadUpdates && <span className="absolute -top-2 -right-2 flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-[#0f111a]"></span></span>}
          </button>
        </div>
        <div className="flex flex-col items-center w-full sm:w-auto mt-2 sm:mt-0"><button onClick={onOpenRules} className="h-14 bg-red-900/80 hover:bg-red-800 text-red-100 border border-red-500/50 px-8 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 flex items-center justify-center w-full sm:w-auto"><i className="fa-solid fa-triangle-exclamation mr-2"></i>V-NEXUS聯動規範</button></div>
      </div>
      <div className="flex flex-wrap justify-center gap-6 mt-20 mb-8">
        <div className="bg-gray-800/40 border border-gray-700/50 px-8 py-6 rounded-3xl min-w-[220px] shadow-xl flex-1 max-w-[300px]"><p className="text-gray-400 text-sm font-bold mb-2 tracking-widest uppercase">網站總瀏覽人次</p><p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">{siteStats?.pageViews !== null ? siteStats.pageViews : <i className="fa-solid fa-spinner fa-spin text-2xl"></i>}</p></div>
        <div className="bg-gray-800/40 border border-gray-700/50 px-8 py-6 rounded-3xl min-w-[220px] shadow-xl flex-1 max-w-[300px]"><p className="text-gray-400 text-sm font-bold mb-2 tracking-widest uppercase">V-NEXUS已成功讓VTUBER聯動</p><p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">{!isLoadingCollabs ? completedCollabsCount : <i className="fa-solid fa-spinner fa-spin text-2xl"></i>} <span className="text-xl text-gray-500 font-bold">次</span></p></div>
        <div className="bg-gray-800/40 border border-gray-700/50 px-8 py-6 rounded-3xl min-w-[220px] shadow-xl flex-1 max-w-[300px]"><p className="text-gray-400 text-sm font-bold mb-2 tracking-widest uppercase">目前VTUBER註冊人數</p><p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">{registeredCount !== null && registeredCount !== undefined ? registeredCount : <i className="fa-solid fa-spinner fa-spin text-2xl"></i>} <span className="text-xl text-gray-500 font-bold">位</span></p></div>
      </div>

      <p className="text-xs text-gray-500 font-medium tracking-widest mb-8 -mt-2">本網頁由 Gemini Pro 輔助生成｜企劃者 從APEX歸來的Dasa</p>

      {randomCollabs.length > 0 && (
        <div className="mt-16 pt-16 border-t border-gray-800/50 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4">
            <div className="text-left"><h2 className="text-3xl font-extrabold text-white mb-2"><i className="fa-solid fa-fire text-red-500 mr-2"></i>為您隨機推薦聯動</h2><p className="text-gray-400">快來看看有哪些 VTuber 即將展開精彩合作！</p></div>
            <button onClick={goToBulletin} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-transform hover:-translate-y-1 animate-pulse flex items-center justify-center gap-2"><i className="fa-solid fa-bullhorn"></i> 想找夥伴聯動嗎？看這裡！</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left max-w-4xl mx-auto w-full">
            {randomCollabs.map(c => (
              <CollabCard
                key={c.id}
                c={c}
                isLive={c.startTimestamp && currentTime >= c.startTimestamp && currentTime <= c.startTimestamp + (2 * 60 * 60 * 1000)}
                vtuber={realVtubers.find(v => v.id === c.userId)}
                realVtubers={realVtubers} // <-- 補上這一行
                onNavigateProfile={(vt) => { setSelectedVTuber(vt); navigate(`profile/${vt.id}`); }}
                onShowParticipants={(collab) => setViewParticipantsCollab(collab)}
              />
            ))}
          </div>
          <button onClick={() => navigate('collabs')} className="mt-10 bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-transform hover:-translate-y-1">查看完整確定聯動表 <i className="fa-solid fa-arrow-right ml-2"></i></button>
        </div>
      )}
    </section>
  );
};

const AdminVtuberList = ({ title, list, onEdit, onDelete, onVerify, onReject, isBlacklist, privateDocs, paginate = false, showSearch = false }) => {
  const [page, setPage] = useState(1);
  const [searchQ, setSearchQ] = useState('');
  const itemsPerPage = 10;

  const filteredList = showSearch && searchQ ? list.filter(v => (v.name || '').toLowerCase().includes(searchQ.toLowerCase()) || (v.agency || '').toLowerCase().includes(searchQ.toLowerCase())) : list;
  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const displayList = paginate ? filteredList.slice((page - 1) * itemsPerPage, page * itemsPerPage) : filteredList;

  useEffect(() => { if (paginate && page > totalPages && totalPages > 0) setPage(totalPages); }, [filteredList.length, totalPages, page, paginate]);

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-gray-700 pb-2 gap-3">
        <h3 className={`text-xl font-bold ${isBlacklist ? 'text-red-500' : title.includes('待') ? 'text-yellow-400' : 'text-white'}`}>{title} ({filteredList.length})</h3>
        {showSearch && (
          <div className="relative w-full sm:w-64">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
            <input type="text" placeholder="搜尋名稱或勢力..." value={searchQ} onChange={e => { setSearchQ(e.target.value); setPage(1); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg py-1.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-purple-500" />
          </div>
        )}
      </div>
      {filteredList.length === 0 && <p className="text-gray-500 text-sm">目前無資料</p>}
      <div className="space-y-3">
        {displayList.map(v => (
          <div key={v.id} className={`flex items-center justify-between p-4 rounded-xl border ${isBlacklist ? 'bg-red-950/20 border-red-900/50' : title.includes('待') ? 'bg-gray-900 border-yellow-500/30' : 'bg-gray-900 border-gray-700'} gap-4`}>
            <div className="flex items-center gap-4">
              <img src={sanitizeUrl(v.avatar)} className={`w-12 h-12 rounded-lg object-cover flex-shrink-0 ${isBlacklist ? 'opacity-50 grayscale' : ''}`} />
              <div>
                <p className={`font-bold text-sm flex items-center gap-2 ${isBlacklist ? 'text-gray-400 line-through' : 'text-white'}`}>{v.name || '（空白名片）'}</p>
                {!isBlacklist && <p className="text-xs text-gray-400 mt-1">{v.agency} | {v.activityStatus === 'sleep' ? '休眠' : v.activityStatus === 'graduated' ? '畢業' : '活躍'} | 倒讚: <span className="text-red-400">{v.dislikes || 0}</span></p>}
                {isBlacklist && <p className="text-xs text-red-400 font-bold">倒讚數: {v.dislikes || 0}</p>}
                {privateDocs[v.id]?.verificationNote && <p className="text-xs text-yellow-400 mt-1.5 bg-yellow-500/10 p-1.5 rounded border border-yellow-500/20 inline-block"><i className="fa-solid fa-key mr-1"></i> 驗證備註: {privateDocs[v.id].verificationNote}</p>}
                {privateDocs[v.id]?.contactEmail && <p className="text-xs text-gray-400 mt-1"><i className="fa-solid fa-envelope mr-1"></i> {privateDocs[v.id].contactEmail}</p>}
                <div className="flex gap-3 mt-1.5">
                  {(v.youtubeUrl || v.channelUrl) && <a href={sanitizeUrl(v.youtubeUrl || v.channelUrl)} target="_blank" rel="noopener noreferrer" className="text-xs text-red-400 hover:text-red-300 transition-colors"><i className="fa-brands fa-youtube"></i> 檢查</a>}
                  {v.twitchUrl && <a href={sanitizeUrl(v.twitchUrl)} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:text-purple-300 transition-colors"><i className="fa-brands fa-twitch"></i> 檢查</a>}
                  {v.xUrl && <a href={sanitizeUrl(v.xUrl)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 transition-colors"><i className="fa-brands fa-x-twitter"></i> 檢查</a>}
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {onVerify && <button onClick={() => onVerify(v.id)} className="text-green-400 bg-green-500/10 px-4 py-2 rounded-lg text-sm font-bold">審核</button>}
              {onReject && <button onClick={() => onReject(v.id)} className="text-orange-400 bg-orange-500/10 px-4 py-2 rounded-lg text-sm font-bold">拒絕</button>}
              <button onClick={() => onEdit(v)} className="text-blue-400 bg-blue-500/10 px-3 py-2 rounded-lg text-sm font-bold">編輯</button>
              <button onClick={() => onDelete(v.id)} className={`text-red-400 px-3 py-2 rounded-lg text-sm font-bold ${isBlacklist ? 'bg-red-900/50 hover:bg-red-600 hover:text-white' : 'bg-red-500/10'}`}>刪除</button>
            </div>
          </div>
        ))}
      </div>
      {paginate && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className={`px-4 py-2 rounded-lg font-bold text-sm ${page === 1 ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>上一頁</button>
          <span className="text-gray-400 text-sm font-bold">第 {page} / {totalPages} 頁</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={`px-4 py-2 rounded-lg font-bold text-sm ${page === totalPages ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>下一頁</button>
        </div>
      )}
    </div>
  );
};

// 在參數大括號的最後面加上 , onTestReminder
// 找到 AdminPage 的開頭，在大括號最後面補上 , onTestPush
const AdminPage = ({ user, vtubers, bulletins, collabs, updates, rules, tips, privateDocs, onSaveSettings, onDeleteVtuber, onVerifyVtuber, onRejectVtuber, onUpdateVtuber, onDeleteBulletin, onAddCollab, onDeleteCollab, onAddUpdate, onDeleteUpdate, showToast, onResetAllCollabTypes, onResetNatAndLang, autoFetchYouTubeInfo, onMassSyncSubs, isSyncingSubs, syncProgress, onSendMassEmail, onMassSyncTwitch, defaultBulletinImages, onAddDefaultBulletinImage, onDeleteDefaultBulletinImage, onTestReminder, onTestPush
}) => {
  const [activeTab, setActiveTab] = useState('vtubers');
  const [newCollab, setNewCollab] = useState({ dateTime: '', title: '', streamUrl: '', coverUrl: '', category: '遊戲' });
  const [editRules, setEditRules] = useState(rules);
  const [editTips, setEditTips] = useState(tips);
  const [editingVtuber, setEditingVtuber] = useState(null);

  const safeVtubers = Array.isArray(vtubers) ? vtubers : [];
  const pendingVtubers = safeVtubers.filter(v => !v.isVerified && !v.isBlacklisted && v.verificationStatus !== 'rejected');
  const rejectedVtubers = safeVtubers.filter(v => !v.isVerified && v.verificationStatus === 'rejected' && !v.isBlacklisted);
  const verifiedVtubers = safeVtubers.filter(v => v.isVerified && !v.isBlacklisted);
  const blacklistedVtubers = safeVtubers.filter(v => v.isBlacklisted || v.dislikes >= 10);

  const handleEditClick = (v) => {
    const safeCollabTypes = Array.isArray(v.collabTypes) ? v.collabTypes : [];
    const standard = safeCollabTypes.filter(t => PREDEFINED_COLLABS.includes(t));
    const other = safeCollabTypes.find(t => !PREDEFINED_COLLABS.includes(t)) || '';
    const PREDEFINED_NATIONALITIES = ['台灣', '日本', '香港', '馬來西亞']; const PREDEFINED_LANGUAGES = ['國', '日', '英', '粵', '台語'];
    const PREDEFINED_PERSONALITIES = ['我是I人', '時I時E', '我大E人', '看心情'];

    const safeNats = Array.isArray(v.nationalities) ? v.nationalities : (typeof v.nationalities === 'string' ? [v.nationalities] : (v.nationality ? [v.nationality] : []));
    const safeLangs = Array.isArray(v.languages) ? v.languages : (typeof v.languages === 'string' ? [v.languages] : (v.language ? [v.language] : []));

    const isOtherN = safeNats.some(n => !PREDEFINED_NATIONALITIES.includes(n));
    const otherNatText = isOtherN ? safeNats.find(n => !PREDEFINED_NATIONALITIES.includes(n)) : '';
    const stdNats = safeNats.filter(n => PREDEFINED_NATIONALITIES.includes(n));

    const pType = v.personalityType || ''; const isOtherP = pType && !PREDEFINED_PERSONALITIES.includes(pType);

    setEditingVtuber({
      ...v,
      name: v.name || '',
      description: v.description || '',
      tags: Array.isArray(v.tags) ? v.tags.join(', ') : v.tags || '',
      collabTypes: standard, isOtherCollab: !!other, otherCollabText: other,
      nationalities: stdNats, isOtherNationality: isOtherN, otherNationalityText: otherNatText || '',
      languages: safeLangs,
      personalityType: isOtherP ? '其他' : pType, personalityTypeOther: isOtherP ? pType : '',
      colorSchemes: v.colorSchemes || [], // 新增色系
      isScheduleAnytime: v.isScheduleAnytime || false, isScheduleExcept: v.isScheduleExcept || false, isScheduleCustom: v.isScheduleCustom || false, customScheduleText: v.customScheduleText || '', scheduleSlots: Array.isArray(v.scheduleSlots) ? v.scheduleSlots : [],
      youtubeSubscribers: v.youtubeSubscribers || v.subscribers || '', lastYoutubeFetchTime: v.lastYoutubeFetchTime || 0,
      twitchFollowers: v.twitchFollowers || '', lastTwitchFetchTime: v.lastTwitchFetchTime || 0, mainPlatform: v.mainPlatform || 'YouTube', streamStyleUrl: v.streamStyleUrl || '',
      youtubeUrl: v.youtubeUrl || v.channelUrl || '', twitchUrl: v.twitchUrl || '', xUrl: v.xUrl || '', igUrl: v.igUrl || '',
      publicEmail: v.publicEmail || '', contactEmail: privateDocs[v.id]?.contactEmail || '', verificationNote: privateDocs[v.id]?.verificationNote || '',
      streamingStyle: v.streamingStyle || '一般型態', activityStatus: v.activityStatus || 'active', likes: v.likes || 0, dislikes: v.dislikes || 0
    });
  };

  const handleAdminPublish = () => {
    if (!newCollab.dateTime || !newCollab.streamUrl || !newCollab.title) return showToast("請完整填寫！");
    const dt = new Date(newCollab.dateTime);
    if (dt.getTime() < Date.now()) return showToast("聯動時間不能在過去哦！");
    onAddCollab({ ...newCollab, date: `${dt.getMonth() + 1}/${dt.getDate()} (${['日', '一', '二', '三', '四', '五', '六'][dt.getDay()]})`, time: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`, startTimestamp: dt.getTime() });
    setNewCollab({ dateTime: '', title: '', streamUrl: '', coverUrl: '', category: '遊戲' });
  };

  const handleTestMail = async () => {
    try {
      await addDoc(collection(db, getPath('mail')), {
        to: user?.email || 'apex.dasa@gmail.com',
        message: {
          subject: "[V-Nexus] 系統測試信件",
          text: "如果您收到這封信，代表 V-Nexus 的 Trigger Email 擴充功能已經成功運作，且 mail 資料庫路徑已自動生成！"
        }
      });
      showToast("✅ 測試信件任務已寫入！請去 Firebase 後台查看 mail 路徑是否出現。");
    } catch (err) {
      console.error("Test Mail Error:", err);
      showToast("❌ 寫入失敗，請按 F12 查看錯誤 (可能是 Firestore 規則阻擋)。");
    }
  };

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 py-8 relative animate-fade-in-up">
        <div className="text-center mb-8"><h2 className="text-3xl font-extrabold text-red-400 mb-2"><i className="fa-solid fa-shield-halved mr-3"></i>超級管理員中心</h2></div>
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
          {[{ id: 'vtubers', icon: 'fa-address-card', label: '名片與審核' }, { id: 'bulletins', icon: 'fa-bullhorn', label: '招募管理' }, { id: 'collabs', icon: 'fa-broadcast-tower', label: '時間表' }, { id: 'updates', icon: 'fa-newspaper', label: '發布消息' }, { id: 'settings', icon: 'fa-gear', label: '設定規範' }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap flex items-center gap-2 ${activeTab === t.id ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              <i className={`fa-solid ${t.icon}`}></i> {t.label}
              {t.id === 'vtubers' && pendingVtubers.length > 0 && <span className="bg-white text-red-600 px-2 py-0.5 rounded-full text-xs ml-1">{pendingVtubers.length}</span>}
            </button>
          ))}
        </div>
        <div className="bg-gray-800/40 border border-gray-700 rounded-3xl p-6 shadow-2xl">
          {activeTab === 'vtubers' && (
            <div className="space-y-8">
              <AdminVtuberList title="待審核名單" list={pendingVtubers} privateDocs={privateDocs} onVerify={onVerifyVtuber} onReject={onRejectVtuber} onEdit={handleEditClick} onDelete={onDeleteVtuber} />
              {rejectedVtubers.length > 0 && <AdminVtuberList title="已退回名單" list={rejectedVtubers} privateDocs={privateDocs} onVerify={onVerifyVtuber} onEdit={handleEditClick} onDelete={onDeleteVtuber} paginate={true} />}
              <AdminVtuberList title="已上架名片" list={verifiedVtubers} privateDocs={privateDocs} onEdit={handleEditClick} onDelete={onDeleteVtuber} paginate={true} showSearch={true} />
              <AdminVtuberList title="黑單避雷區" list={blacklistedVtubers} privateDocs={privateDocs} onEdit={handleEditClick} onDelete={onDeleteVtuber} isBlacklist />
              <div className="mt-12 pt-6 border-t border-red-500/50 flex flex-wrap gap-4">
                <button onClick={onResetAllCollabTypes} className="bg-red-900 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold"><i className="fa-solid fa-bomb mr-2"></i>重置所有人聯動類型</button>
                <button onClick={onResetNatAndLang} className="bg-orange-900 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold"><i className="fa-solid fa-wrench mr-2"></i>修復國籍語言格式</button>
                <button onClick={onMassSyncSubs} disabled={isSyncingSubs} className={`px-6 py-3 rounded-xl font-bold flex items-center ${isSyncingSubs ? 'bg-red-900/50 cursor-not-allowed text-gray-400' : 'bg-red-900 hover:bg-red-700 text-white'}`}>
                  {isSyncingSubs ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i> {syncProgress}</> : <><i className="fa-brands fa-youtube mr-2"></i>強制同步 YT 訂閱</>}
                </button>
                <button onClick={onMassSyncTwitch} disabled={isSyncingSubs} className={`px-6 py-3 rounded-xl font-bold flex items-center ${isSyncingSubs ? 'bg-purple-900/50 cursor-not-allowed text-gray-400' : 'bg-purple-900 hover:bg-purple-700 text-white'}`}>
                  {isSyncingSubs ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i> {syncProgress}</> : <><i className="fa-brands fa-twitch mr-2"></i>強制同步 Twitch</>}
                </button>
              </div>
            </div>
          )}
          {activeTab === 'bulletins' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white mb-4">招募文管理</h3>
              {(bulletins || []).map(b => <div key={b.id} className="flex justify-between bg-gray-900 p-4 rounded-xl border border-gray-700 gap-4"><div className="flex-1"><p className="text-sm text-gray-300 mb-1">{b.content}</p><p className="text-xs text-gray-500">{b.vtuber?.name} | {b.postedAt}</p></div><button onClick={() => onDeleteBulletin(b.id)} className="text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg font-bold">刪除</button></div>)}
            </div>
          )}
          {activeTab === 'collabs' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">新增聯動時間</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div><label className="text-xs text-gray-400 mb-1 block">聯動類別 <span className="text-red-400">*</span></label><select required value={newCollab.category} onChange={e => setNewCollab({ ...newCollab, category: e.target.value })} className={inputCls}>{COLLAB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label className="text-xs text-gray-400 mb-1 block">聯動時間 <span className="text-red-400">*</span></label><input type="datetime-local" lang="sv-SE" step="60" value={newCollab.dateTime} onChange={e => setNewCollab({ ...newCollab, dateTime: e.target.value })} className={inputCls} /></div>
                  <div className="relative"><label className="text-xs text-gray-400 mb-1 block">直播連結 <span className="text-red-400">*</span></label><div className="flex gap-2"><input type="url" placeholder="直播連結..." value={newCollab.streamUrl} onChange={e => setNewCollab({ ...newCollab, streamUrl: e.target.value })} className={inputCls} /><button type="button" onClick={() => autoFetchYouTubeInfo(newCollab.streamUrl, (t) => setNewCollab(p => ({ ...p, title: t })), (c) => setNewCollab(p => ({ ...p, coverUrl: c })), showToast)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 rounded-xl text-xs font-bold transition-colors"><i className="fa-solid fa-wand-magic-sparkles mr-1"></i>抓取</button></div><p className="text-[10px] text-purple-400/80 mt-1">（放入連結按下就可以自動抓取YT縮圖及標題）</p></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4"><input type="text" placeholder="聯動標題" value={newCollab.title} onChange={e => setNewCollab({ ...newCollab, title: e.target.value })} className={inputCls} /><input type="url" placeholder="自訂封面圖" value={newCollab.coverUrl} onChange={e => setNewCollab({ ...newCollab, coverUrl: e.target.value })} className={inputCls} /></div>
                <button onClick={handleAdminPublish} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold">發布</button>
              </div>
              <div className="border-t border-gray-700 pt-6 space-y-4">
                <h3 className="text-lg font-bold text-white mb-4">現有清單</h3>
                {(collabs || []).map(c => <div key={c.id} className="flex justify-between bg-gray-900 p-4 rounded-xl border border-gray-700"><div><p className="font-bold text-white text-sm">[{c.date} {c.time}] {c.title}</p></div><button onClick={() => onDeleteCollab(c.id)} className="text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg">刪除</button></div>)}
              </div>
            </div>
          )}
          {activeTab === 'updates' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">發布最新消息 / 功能更新</h3>
                <form onSubmit={(e) => { e.preventDefault(); onAddUpdate({ title: e.target.updateTitle.value, content: e.target.updateContent.value, date: new Date().toLocaleDateString('zh-TW') }); e.target.reset(); }}>
                  <div className="mb-4"><label className="text-xs text-gray-400 mb-1 block">標題 <span className="text-red-400">*</span></label><input required type="text" name="updateTitle" className={inputCls} placeholder="例如：新增站內信功能！" /></div>
                  <div className="mb-4"><label className="text-xs text-gray-400 mb-1 block">內容 <span className="text-red-400">*</span></label><textarea required name="updateContent" className={inputCls + " resize-none"} rows="4"></textarea></div>
                  <div className="flex justify-end"><button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg">發布公告</button></div>
                </form>
              </div>
              <div className="border-t border-gray-700 pt-6 space-y-4">
                <h3 className="text-lg font-bold text-white mb-4">歷史公告</h3>
                {(updates || []).map(u => (
                  <div key={u.id} className="flex flex-col sm:flex-row sm:justify-between bg-gray-900 p-4 rounded-xl border border-gray-700 gap-4">
                    <div className="flex-1 min-w-0"><p className="font-bold text-white text-sm truncate">{u.title} <span className="text-xs text-gray-500 font-normal ml-2">{u.date}</span></p><p className="text-xs text-gray-400 mt-1 line-clamp-2">{u.content}</p></div>
                    <button onClick={() => onDeleteUpdate(u.id)} className="text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg flex-shrink-0 font-bold self-start">刪除</button>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-700 pt-6 mt-6">
                <h3 className="text-xl font-bold text-white mb-2"><i className="fa-solid fa-envelope-open-text text-purple-400 mr-2"></i>發送全站官方公告信件</h3>
                <p className="text-sm text-gray-400 mb-4">此功能將發送 Email 至所有已填寫信箱的創作者。</p>
                <button onClick={async () => {
                  const subject = prompt("請輸入公告信件主旨：");
                  if (!subject) return;
                  const content = prompt("請輸入公告信件內容：\n(將發送給所有有填寫公開或私人信箱的創作者)");
                  if (!content) return;
                  if (!confirm("確定要發送給所有創作者嗎？此動作不可逆！")) return;
                  onSendMassEmail(subject, content);
                }} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg">發送全站公告</button>
              </div>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="space-y-8">
              <div><h3 className="text-xl font-bold text-white mb-2">編輯規範</h3><textarea value={editRules} onChange={e => setEditRules(e.target.value)} className={inputCls + " resize-none"} rows="8" /></div><div className="flex justify-end"><button onClick={() => onSaveSettings(undefined, editRules)} className="bg-red-600 text-white px-8 py-2.5 rounded-xl font-bold">儲存規範</button></div>
              <div><h3 className="text-xl font-bold text-white mb-2">編輯小技巧</h3><textarea value={editTips} onChange={e => setEditTips(e.target.value)} className={inputCls + " resize-none"} rows="8" /></div><div className="flex justify-end"><button onClick={() => onSaveSettings(editTips, undefined)} className="bg-red-600 text-white px-8 py-2.5 rounded-xl font-bold">儲存小技巧</button></div>

              <div className="mt-8 border-t border-gray-700 pt-8">
                <h3 className="text-xl font-bold text-white mb-2"><i className="fa-solid fa-images text-purple-400 mr-2"></i>招募佈告欄預設圖片庫</h3>
                <p className="text-sm text-gray-400 mb-4">當使用者發布招募沒有上傳圖片時，將從這裡隨機挑選一張顯示。</p>
                <div className="flex flex-wrap gap-4 mb-4">
                  {(defaultBulletinImages || []).map((img, idx) => (
                    <div key={idx} className="relative group w-32 h-24">
                      <img src={sanitizeUrl(img)} className="w-full h-full object-cover rounded-xl border border-gray-600" />
                      <button onClick={() => onDeleteDefaultBulletinImage(idx)} className="absolute top-1 right-1 bg-red-600/90 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-solid fa-trash text-xs"></i></button>
                    </div>
                  ))}
                </div>
                <div className="relative w-full sm:w-64">
                  <input type="file" accept="image/png, image/jpeg, image/webp" onChange={async (e) => {
                    const file = e.target.files[0]; if (!file) return;
                    if (file.size > 5 * 1024 * 1024) { e.target.value = ''; return showToast("❌ 圖片不能超過5MB"); }
                    showToast("⏳ 處理中...");
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const img = new Image();
                      img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let w = img.width, h = img.height; const maxW = 800, maxH = 800;
                        if (w > maxW || h > maxH) { const r = Math.min(maxW / w, maxH / h); w *= r; h *= r; }
                        canvas.width = w; canvas.height = h;
                        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                        onAddDefaultBulletinImage(canvas.toDataURL('image/jpeg', 0.8));
                        e.target.value = '';
                      };
                      img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                  }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <button className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-xl border border-gray-600 transition-colors flex items-center justify-center gap-2"><i className="fa-solid fa-plus"></i> 新增預設圖片</button>
                </div>
              </div>

              <div className="mt-8 border-t border-gray-700 pt-8">
                <h3 className="text-xl font-bold text-white mb-2"><i className="fa-solid fa-envelope-circle-check text-blue-400 mr-2"></i>Email 系統測試</h3>
                <p className="text-sm text-gray-400 mb-4">如果 Firebase 後台沒有看到 mail 路徑，請點擊下方按鈕寫入一筆測試資料，路徑就會自動出現。</p>
                <button onClick={handleTestMail} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg">寫入一筆測試信件</button>
              </div>
              <div className="mt-8 border-t border-gray-700 pt-8">
                <h3 className="text-xl font-bold text-white mb-2"><i className="fa-brands fa-youtube text-red-500 mr-2"></i>YouTube API 測試</h3>
                <p className="text-sm text-gray-400 mb-4">輸入任意 YouTube 頻道網址，測試後端抓取功能是否正常運作。</p>
                <div className="flex gap-2">
                  <input id="testYoutubeUrl" type="url" placeholder="https://www.youtube.com/..." className={inputCls + " flex-1"} />
                  <button onClick={async () => {
                    const url = document.getElementById('testYoutubeUrl').value;
                    if (!url) return showToast("請輸入網址");
                    showToast("⏳ 抓取中...");
                    try {
                      const res = await httpsCallable(functionsInstance, 'fetchYouTubeStats')({ url });
                      if (res.data && res.data.success) {
                        showToast(`✅ 抓取成功！訂閱數：${res.data.subscriberCount}`);
                      } else {
                        showToast(`❌ 失敗：${res.data?.message || '未知錯誤'}`);
                      }
                    } catch (e) {
                      showToast(`❌ 錯誤：${e.message}`);
                    }
                  }} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg whitespace-nowrap">測試抓取</button>
                </div>
              </div>
              <div className="mt-8 border-t border-gray-700 pt-8">
                <h3 className="text-xl font-bold text-white mb-2"><i className="fa-brands fa-twitch text-purple-400 mr-2"></i>Twitch API 測試</h3>
                <p className="text-sm text-gray-400 mb-4">輸入任意 Twitch 頻道網址，測試後端抓取功能是否正常運作。</p>
                <div className="flex gap-2">
                  <input id="testTwitchUrl" type="url" placeholder="https://www.twitch.tv/..." className={inputCls + " flex-1"} />
                  <button onClick={async () => {
                    const url = document.getElementById('testTwitchUrl').value;
                    if (!url) return showToast("請輸入網址");
                    showToast("⏳ 抓取中...");
                    try {
                      const res = await httpsCallable(functionsInstance, 'fetchTwitchStats')({ url });
                      if (res.data && res.data.success) {
                        showToast(`✅ 抓取成功！追隨數：${res.data.followerCount}`);
                      } else {
                        showToast(`❌ 失敗：${res.data?.message || '未知錯誤'}`);
                      }
                    } catch (e) {
                      showToast(`❌ 錯誤：${e.message}`);
                    }
                  }} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg whitespace-nowrap">測試抓取</button>
                </div>
              </div>
              {/* 安插在 AdminPage 的 settings 頁籤內 */}
              <div className="mt-8 border-t border-gray-700 pt-8">
                <h3 className="text-xl font-bold text-white mb-2">
                  <i className="fa-solid fa-mobile-screen-button text-blue-400 mr-2"></i>手機推播功能測試
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
              </div>

              <div className="mt-8 border-t border-gray-700 pt-8">
                <h3 className="text-xl font-bold text-white mb-2">
                  <i className="fa-solid fa-clock-rotate-left text-orange-400 mr-2"></i>聯動提醒系統測試
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
              </div>
            </div>

          )}
        </div>
      </div>
      {editingVtuber && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl">
            <div className="sticky top-0 bg-gray-900/95 backdrop-blur px-6 py-4 border-b border-gray-800 flex justify-between items-center z-10"><h3 className="font-bold text-white"><i className="fa-solid fa-pen-to-square mr-2"></i>強制編輯：{editingVtuber.name}</h3><button onClick={() => setEditingVtuber(null)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button></div>
            <div className="p-6 overflow-y-auto"><ProfileEditorForm form={editingVtuber} updateForm={(updates) => setEditingVtuber(prev => ({ ...prev, ...updates }))} onSubmit={(e) => { e.preventDefault(); onUpdateVtuber(editingVtuber.id, editingVtuber); setEditingVtuber(null); }} onCancel={() => setEditingVtuber(null)} isAdmin={true} showToast={showToast} user={user} /></div>
          </div>
        </div>
      )}
    </>
  );
};

function App() {
  const getInitialView = () => { const hash = window.location.hash.replace('#', ''); if (hash.startsWith('profile/')) return 'profile'; return hash === 'profile' ? 'grid' : (hash || 'home'); };

  const [currentView, setCurrentView] = useState(getInitialView());
  const [previousView, setPreviousView] = useState('grid');
  const [selectedVTuber, setSelectedVTuber] = useState(null);
  const [profileIdFromHash, setProfileIdFromHash] = useState(() => { const hash = window.location.hash.replace('#', ''); return hash.startsWith('profile/') ? hash.split('/')[1] : null; });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState('random');
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [siteStats, setSiteStats] = useState({ pageViews: null });
  const [viewParticipantsCollab, setViewParticipantsCollab] = useState(null);
  const [user, setUser] = useState(null);
  const [realVtubers, setRealVtubers] = useState([]);
  const [privateDocs, setPrivateDocs] = useState({});
  const [realBulletins, setRealBulletins] = useState([]);
  const [realCollabs, setRealCollabs] = useState([]);
  const [realUpdates, setRealUpdates] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedAgency, setSelectedAgency] = useState('All');
  const [selectedPlatform, setSelectedPlatform] = useState('All');
  const [selectedNationality, setSelectedNationality] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedSchedule, setSelectedSchedule] = useState('All');
  const [selectedColor, setSelectedColor] = useState('All'); // 新增色系篩選狀態
  const [collabCategoryTab, setCollabCategoryTab] = useState('All');
  const [bulletinFilter, setBulletinFilter] = useState('All');
  const [publicCollabForm, setPublicCollabForm] = useState({
    dateTime: '',
    title: '',
    streamUrl: '',
    coverUrl: '',
    category: '遊戲',
    participants: []
  });

  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isTipsModalOpen, setIsTipsModalOpen] = useState(false);
  const [isUpdatesModalOpen, setIsUpdatesModalOpen] = useState(false);
  const [confirmDislikeData, setConfirmDislikeData] = useState(null);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  const [newBulletin, setNewBulletin] = useState({ id: null, content: '', collabType: '', collabTypeOther: '', collabSize: '', collabTime: '', recruitEndTime: '', image: '' });
  const [defaultBulletinImages, setDefaultBulletinImages] = useState([]);
  const [inviteMessage, setInviteMessage] = useState('');
  const [realNotifications, setRealNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const gridScrollY = useRef(0);
  const [currentPage, setCurrentPage] = useState(1);
  // --- 手動啟動通知函式 ---
  const handleEnableNotifications = async () => {
    if (!user) return showToast("請先登入");

    // 檢查是否在 PWA 模式 (iOS 必備)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (!isStandalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      return showToast("請先點擊『分享』並『加入主畫面』後，從桌面開啟 App 才能啟動通知。");
    }

    try {
      showToast("正在註冊服務線程...");
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

      showToast("正在請求系統通知權限...");
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        const messaging = getMessaging(app);
        // 取得 Token
        const token = await getToken(messaging, {
          vapidKey: 'BDInEaWTbWBiCuiwlsSNZaz_0XbOqPlLQVE3LGaQK3eOE2TMuFpD8v_b0f00gxAmw5aB1NBEeSsF-DMwInoa-XU',
          serviceWorkerRegistration: registration
        });

        if (token) {
          await updateDoc(doc(db, getPath('vtubers'), user.uid), { fcmToken: token });
          showToast("✅ 成功！Token 已存入資料庫。");
        } else {
          showToast("❌ 無法取得 Token，請檢查 Firebase 設定。");
        }
      } else {
        showToast("❌ 權限被拒絕。請至手機『設定 > 通知 > V-Nexus』開啟。");
      }
    } catch (err) {
      console.error("FCM Error:", err);
      showToast("錯誤：" + err.message);
    }
  };
  const [pSearch, setPSearch] = useState(''); // 新增：搜尋框的文字狀態


  const [isSyncingSubs, setIsSyncingSubs] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false);
  const [openBulletinModalId, setOpenBulletinModalId] = useState(null);

  const [readUpdateIds, setReadUpdateIds] = useState(() => { try { return JSON.parse(localStorage.getItem('readUpdates') || '[]'); } catch { return []; } });
  const hasUnreadUpdates = realUpdates.some(u => !readUpdateIds.includes(u.id));

  const handleMarkAllUpdatesRead = () => { const allIds = realUpdates.map(u => u.id); setReadUpdateIds(allIds); localStorage.setItem('readUpdates', JSON.stringify(allIds)); showToast("✅ 已全部標示為已讀"); };

  const [realTips, setRealTips] = useState("您好，我是 [您的名字/頻道名]。\n想請問近期是否有機會邀請您一起進行 [企劃名稱/遊戲] 的連動呢？");
  const [realRules, setRealRules] = useState("如果聯動的V朋朋有負面行為，請在他的名片按倒讚。只要超過 10 個倒讚即會自動下架。");
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

  const getEmptyProfile = (uid) => ({
    name: '', agency: '個人勢', tags: '', description: '', avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid || Math.random()}&backgroundColor=b6e3f4`, banner: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=1000',
    nationalities: [], isOtherNationality: false, otherNationalityText: '', languages: [], personalityType: '', personalityTypeOther: '', colorSchemes: [], // 新增色系
    isScheduleAnytime: false, isScheduleExcept: false, isScheduleCustom: false, customScheduleText: '', scheduleSlots: [], collabTypes: [], isOtherCollab: false, otherCollabText: '', streamingStyle: '一般型態', activityStatus: 'active',
    youtubeSubscribers: '', twitchFollowers: '', youtubeUrl: '', twitchUrl: '', mainPlatform: 'YouTube', streamStyleUrl: '', xUrl: '', igUrl: '', publicEmail: '', publicEmailVerified: false, contactEmail: '', verificationNote: '', lastYoutubeFetchTime: 0, lastTwitchFetchTime: 0
  });
  const [profileForm, setProfileForm] = useState(getEmptyProfile());
  // --- 確保這段是放在 App 函式內，useState 的下方 ---
  const handleTestPushNotification = async () => {
    if (!user) return showToast("請先登入！");
    const myData = realVtubers.find(v => v.id === user.uid);
    if (!myData?.fcmToken) {
      return showToast("❌ 偵測不到 Token，請先點擊『啟動手機推播通知』");
    }

    showToast("⏳ 正在發送測試...");
    try {
      await addDoc(collection(db, getPath('notifications')), {
        userId: user.uid,
        fromUserId: user.uid,
        fromUserName: "V-Nexus 測試員",
        fromUserAvatar: "https://duk.tw/u1jpPE.png",
        message: "🎉 測試推播發送成功！",
        createdAt: Date.now(),
        read: false
      });
      showToast("✅ 指令已發出，請查看手機通知中心");
    } catch (err) {
      // 這裡會顯示具體的報錯，例如：Missing or insufficient permissions
      console.error("Firestore Error:", err);
      showToast("❌ 發送失敗：" + err.message);
    }
  };

  const isAdmin = user && user.email === 'apex.dasa@gmail.com';
  const myProfile = user ? realVtubers.find(v => v.id === user.uid) : null;
  const isVerifiedUser = isAdmin || (myProfile?.isVerified && !myProfile?.isBlacklisted && myProfile?.activityStatus === 'active');

  const navigate = (view, preserveScroll = false) => {
    if (view.startsWith('profile/') && currentView !== 'profile') {
      setPreviousView(currentView);
      gridScrollY.current = window.scrollY;
    }

    const cleanView = view.replace('#', '');
    if (cleanView.startsWith('profile/')) {
      setProfileIdFromHash(cleanView.split('/')[1]);
      setCurrentView('profile');
    } else {
      setProfileIdFromHash(null);
      setCurrentView(cleanView === 'profile' ? 'grid' : (cleanView || 'home'));
    }

    if (window.location.hash !== '#' + view) {
      window.history.pushState(null, null, '#' + view);
    }
    setIsMobileMenuOpen(false);
    if (!preserveScroll) {
      setTimeout(() => window.scrollTo(0, 0), 10);
    }
  };

  const goToBulletin = () => { if (!isVerifiedUser) { showToast("請先認證名片解鎖功能"); navigate('dashboard'); } else navigate('bulletin'); };

  const pendingVtubersCount = useMemo(() => realVtubers.filter(v => !v.isVerified && !v.isBlacklisted && v.verificationStatus !== 'rejected').length, [realVtubers]);

  const leaderboardData = useMemo(() => {
    const counts = {};
    realBulletins.forEach(b => {
      let targetSize = parseInt((b.collabSize || '0').replace('人', ''), 10) || 0;
      const isEnded = b.recruitEndTime && currentTime > b.recruitEndTime;
      const applicantsCount = Array.isArray(b.applicants) ? b.applicants.length : 0;
      if (isEnded && targetSize > 0 && applicantsCount >= targetSize) {
        counts[b.userId] = (counts[b.userId] || 0) + 1;
      }
    });
    return Object.keys(counts).map(uid => {
      const vt = realVtubers.find(v => v.id === uid) || { id: uid, name: '匿名', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anon' };
      return { ...vt, successCount: counts[uid] };
    }).sort((a, b) => b.successCount - a.successCount);
  }, [realBulletins, realVtubers, currentTime]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('profile/')) { setProfileIdFromHash(hash.split('/')[1]); setCurrentView('profile'); }
      else { setProfileIdFromHash(null); setCurrentView(hash === 'profile' ? 'grid' : (hash || 'home')); }
    };
    handleHashChange(); window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 替換原本處理 profileIdFromHash 的 useEffect
  useEffect(() => {
    if (currentView === 'profile' && profileIdFromHash && !isLoading) {
      // 先嘗試用 UID 找
      let vt = realVtubers.find(v => v.id === profileIdFromHash);

      // 如果找不到，嘗試用 slug 找
      if (!vt) {
        vt = realVtubers.find(v => v.slug === profileIdFromHash.toLowerCase());
      }

      if (vt) {
        setSelectedVTuber(vt);
      } else {
        showToast("找不到該名片，可能已被隱藏或網址錯誤");
        navigate('grid');
      }
    }
  }, [currentView, profileIdFromHash, realVtubers, isLoading]);

  useEffect(() => {
    const handleClickOutside = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setIsNotifOpen(false); };
    document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifRef]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => { setUser(u); setProfileForm(getEmptyProfile(u?.uid)); });
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => { unsubscribeAuth(); clearInterval(timer); };
  }, []);

  // --- 自動提醒檢查邏輯 (Lazy Cron) ---
  useEffect(() => {
    // 只有當資料載入完成且有聯動資料時才執行
    if (isLoading || realCollabs.length === 0) return;

    const checkAndSendReminders = async () => {
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      // 找出「24小時內開始」且「尚未寄過提醒」的聯動
      const upcomingCollabs = realCollabs.filter(c =>
        c.startTimestamp &&
        (c.startTimestamp - now) <= twentyFourHours &&
        (c.startTimestamp - now) > 0 &&
        c.reminderSent === false
      );

      for (const collab of upcomingCollabs) {
        // 標記為已寄出，防止重複觸發
        await updateDoc(doc(db, getPath('collabs'), collab.id), { reminderSent: true });

        // 取得所有參與者 (包含發起人)
        const allMemberIds = [collab.userId, ...(collab.participants || [])];

        allMemberIds.forEach(async (uid) => {
          const target = realVtubers.find(v => v.id === uid);
          if (!target) return;

          // 取得 Email (優先使用公開信箱)
          const email = target.publicEmail;
          if (email && email.includes('@')) {
            await addDoc(collection(db, getPath('mail')), {
              to: email,
              message: {
                subject: `[V-Nexus 聯動提醒] 行程即將在 24 小時內開始！`,
                text: `您好 ${target.name}！\n\n您參與的聯動行程【${collab.title}】即將在 24 小時內開始！\n\n時間：${collab.date} ${collab.time}\n直播連結：${collab.streamUrl}\n\n請記得準時參加喔！\n\nV-Nexus 團隊`
              }
            }).catch(e => console.error("Reminder Mail Error:", e));
          }
        });
      }
    };

    // 執行檢查
    checkAndSendReminders();
  }, [realCollabs, isLoading]);
  // --- 提醒邏輯結束 ---

  useEffect(() => {
    setIsLoading(true);
    const fetchAllData = async () => {
      try {
        getDoc(doc(db, getPath('settings'), 'stats')).then(snap => { if (snap.exists()) setSiteStats(snap.data()); });
        getDoc(doc(db, getPath('settings'), 'tips')).then(snap => { if (snap.exists() && snap.data().content) setRealTips(snap.data().content); });
        getDoc(doc(db, getPath('settings'), 'rules')).then(snap => { if (snap.exists() && snap.data().content) setRealRules(snap.data().content); });
        getDoc(doc(db, getPath('settings'), 'bulletinImages')).then(snap => { if (snap.exists() && snap.data().images) setDefaultBulletinImages(snap.data().images); });

        updateDoc(doc(db, getPath('settings'), 'stats'), { pageViews: increment(1) }).catch(() => setDoc(doc(db, getPath('settings'), 'stats'), { pageViews: 1 }, { merge: true }));

        const [vSnap, bSnap, cSnap, uSnap] = await Promise.all([
          getDocs(collection(db, getPath('vtubers'))),
          getDocs(collection(db, getPath('bulletins'))),
          getDocs(collection(db, getPath('collabs'))),
          getDocs(collection(db, getPath('updates')))
        ]);

        const vData = vSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRealVtubers(vData);
        setRealBulletins(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setRealCollabs(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setRealUpdates(uSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt));

        if (user) {
          const cp = vData.find(v => v.id === user.uid);
          if (cp) {
            const PREDEFINED_PERSONALITIES = ['我是I人', '時I時E', '我大E人', '看心情'];
            const pType = cp.personalityType || ''; const isOtherP = pType && !PREDEFINED_PERSONALITIES.includes(pType);
            const stdTypes = (cp.collabTypes || []).filter(t => PREDEFINED_COLLABS.includes(t));
            const othType = (cp.collabTypes || []).filter(t => !PREDEFINED_COLLABS.includes(t))[0] || '';

            const safeNats = Array.isArray(cp.nationalities) ? cp.nationalities : (typeof cp.nationalities === 'string' ? [cp.nationalities] : (cp.nationality ? [cp.nationality] : []));
            const safeLangs = Array.isArray(cp.languages) ? cp.languages : (typeof cp.languages === 'string' ? [cp.languages] : (cp.language ? [cp.language] : []));

            const isOtherN = safeNats.some(n => !['台灣', '日本', '香港', '馬來西亞'].includes(n));
            const otherNatText = isOtherN ? safeNats.find(n => !['台灣', '日本', '香港', '馬來西亞'].includes(n)) : '';
            const stdNats = safeNats.filter(n => ['台灣', '日本', '香港', '馬來西亞'].includes(n));

            setProfileForm(prev => ({
              ...prev, ...cp, name: cp.name || prev.name, description: cp.description || prev.description, tags: Array.isArray(cp.tags) ? cp.tags.join(', ') : cp.tags || '',
              nationalities: stdNats, isOtherNationality: isOtherN, otherNationalityText: otherNatText || '',
              languages: safeLangs, colorSchemes: cp.colorSchemes || [], // 新增色系
              personalityType: isOtherP ? '其他' : pType, personalityTypeOther: isOtherP ? pType : '',
              collabTypes: stdTypes, isOtherCollab: !!othType, otherCollabText: othType, isScheduleAnytime: cp.isScheduleAnytime || false, isScheduleExcept: cp.isScheduleExcept || false, isScheduleCustom: cp.isScheduleCustom || false, customScheduleText: cp.customScheduleText || '',
              scheduleSlots: cp.scheduleSlots || [], streamingStyle: cp.streamingStyle || prev.streamingStyle, activityStatus: cp.activityStatus || prev.activityStatus,
              youtubeSubscribers: cp.youtubeSubscribers || cp.subscribers || '', lastYoutubeFetchTime: cp.lastYoutubeFetchTime || 0, twitchFollowers: cp.twitchFollowers || '', lastTwitchFetchTime: cp.lastTwitchFetchTime || 0, youtubeUrl: cp.youtubeUrl || cp.channelUrl || '', twitchUrl: cp.twitchUrl || '', mainPlatform: cp.mainPlatform || 'YouTube', streamStyleUrl: cp.streamStyleUrl || '', xUrl: cp.xUrl || '', igUrl: cp.igUrl || '', publicEmail: cp.publicEmail || '', publicEmailVerified: cp.publicEmailVerified || false
            }));
          }
        }
      } catch (err) { console.error("讀取失敗 (可能為資料庫權限):", err); } finally { setIsLoading(false); }
    };

    fetchAllData();

    let unsubN = () => { };
    if (user && user.uid) {
      const q = query(collection(db, getPath('notifications')), where("userId", "==", user.uid));
      unsubN = onSnapshot(q, (snap) => setRealNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))), (err) => console.error(err));
    } else { setRealNotifications([]); }

    return () => { unsubN(); };
  }, [user]);

  useEffect(() => {
    if (user && user.uid) {
      getDoc(doc(db, getPath('vtubers_private'), user.uid)).then(docSnap => {
        if (docSnap.exists()) setProfileForm(prev => ({ ...prev, contactEmail: docSnap.data().contactEmail || '', verificationNote: docSnap.data().verificationNote || '' }));
      }).catch(err => console.error(err));
      updateDoc(doc(db, getPath('vtubers'), user.uid), { lastActiveAt: Date.now() }).catch(() => { });
    }
  }, [user?.uid]);

  useEffect(() => {
    if (isAdmin) {
      getDocs(collection(db, getPath('vtubers_private'))).then(snap => { const pDocs = {}; snap.docs.forEach(d => pDocs[d.id] = d.data()); setPrivateDocs(pDocs); }).catch(err => console.error(err));
    }
  }, [isAdmin]);

  const myNotifications = useMemo(() => user ? realNotifications.filter(n => n.userId === user.uid).sort((a, b) => b.createdAt - a.createdAt) : [], [realNotifications, user]);
  const unreadCount = myNotifications.filter(n => !n.read).length;
  const markAllAsRead = () => myNotifications.forEach(n => { if (!n.read) updateDoc(doc(db, getPath('notifications'), n.id), { read: true }); });

  const handleNotifClick = (n) => { const sender = realVtubers.find(v => v.id === n.fromUserId); if (sender) { setSelectedVTuber(sender); navigate(`profile/${sender.id}`); } if (!n.read) updateDoc(doc(db, getPath('notifications'), n.id), { read: true }).catch(() => { }); setIsNotifOpen(false); };
  const handleNotifProfileNav = (userId) => { const vt = realVtubers.find(v => v.id === userId); if (vt) { setSelectedVTuber(vt); navigate(`profile/${vt.id}`); } else showToast("找不到該名片，可能已被刪除或隱藏"); };
  const handleMarkNotifRead = async (id) => { try { await updateDoc(doc(db, getPath('notifications'), id), { read: true }); } catch (err) { } };
  const handleDeleteNotif = async (id) => { if (!confirm("確定要刪除這則通知嗎？")) return; try { await deleteDoc(doc(db, getPath('notifications'), id)); showToast("✅ 已刪除通知"); } catch (err) { showToast("刪除失敗"); } };

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
      await addDoc(collection(db, getPath('notifications')), { userId: target.id, fromUserId: user.uid, fromUserName: myProfile?.name || user.displayName || '某位創作者', fromUserAvatar: myProfile?.avatar || user.photoURL, message: '鼓起勇氣向您發送了「勇敢邀請」！請問您是否有意願聯動呢？', createdAt: Date.now(), read: false, type: 'brave_invite', handled: false });

      if (target.publicEmail) {
        await addDoc(collection(db, getPath('mail')), {
          to: target.publicEmail,
          message: {
            subject: `[V-Nexus] 您收到了一個「勇敢邀請」！`,
            text: `您好，${target.name}！\n\n「${myProfile?.name || user.displayName || '某位創作者'}」在 V-Nexus 上鼓起勇氣向您發送了「勇敢邀請」！\n\n請問您是否有意願聯動呢？\n\n請登入 V-Nexus https://www.vnexus2026.com/ 站內信箱查看對方的名片並回覆對方吧！\n\n祝 聯動順利！\nV-Nexus 團隊`
          }
        }).catch(err => console.error("Mail Error:", err));
      }

      localStorage.setItem(lastInviteKey, Date.now().toString());
      showToast("✅ 勇敢邀請已發送！靜待佳音");
    } catch (err) { showToast("發送失敗"); }
  };

  const handleBraveInviteResponse = async (notifId, senderId, accept) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, getPath('notifications'), notifId), { handled: true });
      const replyMsg = accept ? "可以試試看！我們站內信聯絡！" : "對不起，對方覺得暫時不適合聯動，謝謝你的邀約。";
      await addDoc(collection(db, getPath('notifications')), { userId: senderId, fromUserId: user.uid, fromUserName: myProfile?.name || user.displayName || '某位創作者', fromUserAvatar: myProfile?.avatar || user.photoURL, message: replyMsg, createdAt: Date.now(), read: false });
      setRealNotifications(prev => prev.map(n => n.id === notifId ? { ...n, handled: true } : n));
      showToast(accept ? "已回覆：可以試試" : "已回覆：委婉拒絕");
    } catch (err) { showToast("回覆失敗"); }
  };

  const handleOpenCollabModal = (targetVtuber) => {
    if (!user) return showToast("請先登入！");
    setSelectedVTuber(targetVtuber);
    setIsCollabModalOpen(true);
  };

  const handleLogin = async () => { try { await signInWithPopup(auth, provider); showToast("🎉 登入成功！"); } catch (e) { showToast("登入失敗"); } };
  const handleLogout = async () => { await signOut(auth); navigate('home'); showToast("已登出"); };

  const displayVtubers = useMemo(() => { const list = [...realVtubers]; for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[list[i], list[j]] = [list[j], list[i]]; } return list; }, [realVtubers]);
  const dynamicCollabTypes = useMemo(() => {
    const types = new Set();
    displayVtubers.filter(v => isVisible(v, user)).forEach(v => {
      if (Array.isArray(v.collabTypes)) {
        v.collabTypes.forEach(t => {
          const trimmedType = t.trim();
          // 關鍵修改：只有當該類型屬於「官方預設類型」時，才顯示在篩選標籤中
          if (trimmedType && PREDEFINED_COLLABS.includes(trimmedType)) {
            types.add(trimmedType);
          }
        });
      }
    });
    return Array.from(types).sort();
  }, [displayVtubers, user]);
  const dynamicNationalities = useMemo(() => { const nats = new Set(); displayVtubers.filter(v => isVisible(v, user)).forEach(v => { if (Array.isArray(v.nationalities)) { v.nationalities.forEach(n => nats.add(n)); } else if (v.nationality) { nats.add(v.nationality); } }); return ['All', ...Array.from(nats).sort()]; }, [displayVtubers, user]);
  const dynamicLanguages = useMemo(() => { const langs = new Set(); displayVtubers.filter(v => isVisible(v, user)).forEach(v => { if (Array.isArray(v.languages)) { v.languages.forEach(l => langs.add(l)); } else if (v.language) { langs.add(v.language); } }); return ['All', ...Array.from(langs).sort()]; }, [displayVtubers, user]);
  const dynamicSchedules = useMemo(() => { const days = new Set(); displayVtubers.filter(v => isVisible(v, user)).forEach(v => { if (v.isScheduleAnytime) days.add('隨時可約'); if (Array.isArray(v.scheduleSlots)) { v.scheduleSlots.forEach(s => { if (s.day) days.add(s.day); }); } }); return ['All', ...Array.from(days).sort()]; }, [displayVtubers, user]);

  const displayBulletins = useMemo(() => {
    return [...realBulletins].filter(b => !b.recruitEndTime || b.recruitEndTime > Date.now())
      .filter(b => { const vt = displayVtubers.find(v => v.id === b.userId); return vt ? isVisible(vt, user) : true; })
      .map(b => { const vt = displayVtubers.find(v => v.id === b.userId) || { name: "匿名", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Anon" }; const applicantsData = (b.applicants || []).map(uid => displayVtubers.find(v => v.id === uid)).filter(Boolean); return { ...b, vtuber: vt, postedAt: formatTime(b.createdAt), applicantsData }; }).sort((a, b) => b.createdAt - a.createdAt);
  }, [realBulletins, displayVtubers, user]);

  const activeBulletinTypes = useMemo(() => {
    const types = new Set();
    displayBulletins.forEach(b => {
      if (b.collabType) types.add(b.collabType);
    });
    return Array.from(types).sort();
  }, [displayBulletins]);

  const filteredDisplayBulletins = useMemo(() => {
    if (bulletinFilter === 'All') return displayBulletins;
    return displayBulletins.filter(b => b.collabType === bulletinFilter);
  }, [displayBulletins, bulletinFilter]);

  const displayCollabs = useMemo(() => [...realCollabs].filter(c => !c.startTimestamp || currentTime <= c.startTimestamp + (2 * 60 * 60 * 1000)).sort((a, b) => (a.startTimestamp || a.createdAt || 0) - (b.startTimestamp || b.createdAt || 0)), [realCollabs, currentTime]);
  const filteredDisplayCollabs = useMemo(() => { if (collabCategoryTab === 'All') return displayCollabs; return displayCollabs.filter(c => (c.category || '遊戲') === collabCategoryTab); }, [displayCollabs, collabCategoryTab]);

  const filteredVTubers = useMemo(() => {
    let result = displayVtubers.filter(v => isVisible(v, user)).filter(v => {
      const mSearch = v.name?.toLowerCase().includes(searchQuery.toLowerCase()) || v.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const mTags = selectedTags.length === 0 || selectedTags.every(t => v.collabTypes?.includes(t));
      const mAgency = selectedAgency === 'All' || v.agency?.includes(selectedAgency);
      const mPlat = selectedPlatform === 'All' || (v.mainPlatform || 'YouTube') === selectedPlatform;
      const mNat = selectedNationality === 'All' || (v.nationalities && v.nationalities.includes(selectedNationality)) || v.nationality === selectedNationality;
      const mLang = selectedLanguage === 'All' || (v.languages && v.languages.includes(selectedLanguage)) || v.language === selectedLanguage;
      const mSchedule = selectedSchedule === 'All' || (selectedSchedule === '隨時可約' && v.isScheduleAnytime) || (Array.isArray(v.scheduleSlots) && v.scheduleSlots.some(s => s.day === selectedSchedule));
      const mColor = selectedColor === 'All' || (v.colorSchemes && v.colorSchemes.includes(selectedColor)); // 色系篩選邏輯
      return mSearch && mTags && mAgency && mPlat && mNat && mLang && mSchedule && mColor;
    });
    if (sortOrder === 'likes') result.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    else if (sortOrder === 'subscribers') result.sort((a, b) => parseSubscribers(b) - parseSubscribers(a));
    else if (sortOrder === 'newest') result.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    return result;
  }, [displayVtubers, searchQuery, selectedTags, selectedAgency, selectedPlatform, selectedNationality, selectedLanguage, selectedSchedule, selectedColor, user, sortOrder]);

  const toggleTag = (tag) => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  useEffect(() => { setCurrentPage(1); }, [searchQuery, selectedTags, selectedAgency, selectedPlatform, selectedNationality, selectedLanguage, selectedSchedule, selectedColor, sortOrder]);

  const ITEMS_PER_PAGE = 18; const totalPages = Math.max(1, Math.ceil(filteredVTubers.length / ITEMS_PER_PAGE)); const paginatedVTubers = filteredVTubers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const handlePageChange = (newPage) => { if (newPage >= 1 && newPage <= totalPages) { setCurrentPage(newPage); window.scrollTo({ top: 0, behavior: 'smooth' }); } };

  const handleSaveProfile = async (e, customForm = profileForm) => {
    if (e) e.preventDefault(); if (!user) return showToast("請先登入！");

    if (!isAdmin && (!customForm.verificationNote || !customForm.verificationNote.trim())) return showToast("請填寫真人身分驗證方式！");
    if (customForm.publicEmail && customForm.publicEmail.trim() !== '' && !customForm.publicEmailVerified) return showToast("請先完成公開工商信箱驗證，或清空該欄位！");

    let finalCollabs = [...(customForm.collabTypes || [])]; if (customForm.isOtherCollab && customForm.otherCollabText?.trim()) finalCollabs.push(customForm.otherCollabText.trim());
    if (finalCollabs.length === 0) return showToast("請至少選擇一項連動類型！");
    if (!customForm.isScheduleAnytime && !customForm.isScheduleExcept) { if (customForm.isScheduleCustom) { if (!customForm.customScheduleText?.trim()) return showToast("請填寫您的自訂時段！"); } else { if (!customForm.scheduleSlots?.length) return showToast("請新增時段！"); } }
    try {
      // 在 handleSaveProfile 內的 try { 之後立即安插
      if (customForm.slug && customForm.slug.trim() !== '') {
        const slugQuery = query(collection(db, getPath('vtubers')), where("slug", "==", customForm.slug.trim()));
        const slugSnap = await getDocs(slugQuery);
        const isTaken = slugSnap.docs.some(d => d.id !== (customForm.id || user.uid));
        if (isTaken) return showToast("❌ 此專屬網址 ID 已被他人使用，請換一個！");
      }
      const tagsArray = (customForm.tags || '').split(',').map(t => t.trim()).filter(t => t);
      const existingProfile = realVtubers.find(v => v.id === (customForm.id || user.uid));
      const finalPersonality = customForm.personalityType === '其他' ? customForm.personalityTypeOther : customForm.personalityType;

      const finalNats = [...(customForm.nationalities || [])];
      if (customForm.isOtherNationality && customForm.otherNationalityText?.trim()) finalNats.push(customForm.otherNationalityText.trim());
      const finalLangs = [...(customForm.languages || [])];

      const publicData = {
        // 在 publicData 物件內安插
        slug: (customForm.slug || '').trim().toLowerCase(),
        name: customForm.name, agency: customForm.agency, streamingStyle: customForm.streamingStyle, description: customForm.description, tags: tagsArray, collabTypes: finalCollabs,
        nationalities: finalNats, languages: finalLangs, personalityType: finalPersonality || '', colorSchemes: customForm.colorSchemes || [], // 儲存色系
        isScheduleAnytime: customForm.isScheduleAnytime, isScheduleExcept: customForm.isScheduleExcept, isScheduleCustom: customForm.isScheduleCustom, customScheduleText: customForm.customScheduleText,
        scheduleSlots: customForm.scheduleSlots, mainPlatform: customForm.mainPlatform, youtubeSubscribers: customForm.youtubeSubscribers, lastYoutubeFetchTime: customForm.lastYoutubeFetchTime || 0, twitchFollowers: customForm.twitchFollowers, lastTwitchFetchTime: customForm.lastTwitchFetchTime || 0, youtubeUrl: customForm.youtubeUrl, twitchUrl: customForm.twitchUrl, xUrl: customForm.xUrl, igUrl: customForm.igUrl, streamStyleUrl: customForm.streamStyleUrl, avatar: customForm.avatar, banner: customForm.banner, activityStatus: customForm.activityStatus,
        publicEmail: customForm.publicEmail || '', publicEmailVerified: customForm.publicEmailVerified || false, likes: customForm.likes || 0, likedBy: customForm.likedBy || [], dislikes: customForm.dislikes || 0, dislikedBy: customForm.dislikedBy || [], status: customForm.status || '歡迎邀請', lastActiveAt: Date.now(), updatedAt: Date.now()
      };

      if (!existingProfile || existingProfile.verificationStatus === 'rejected') { publicData.isVerified = false; publicData.isBlacklisted = false; publicData.verificationStatus = 'pending'; publicData.showVerificationModal = null; }
      const privateData = { contactEmail: customForm.contactEmail, verificationNote: customForm.verificationNote, updatedAt: Date.now() };

      await setDoc(doc(db, getPath('vtubers'), customForm.id || user.uid), publicData, { merge: true });
      await setDoc(doc(db, getPath('vtubers_private'), customForm.id || user.uid), privateData, { merge: true });

      const updatedProfile = { id: customForm.id || user.uid, ...publicData };
      setRealVtubers(prev => { const exists = prev.find(v => v.id === updatedProfile.id); if (exists) return prev.map(v => v.id === updatedProfile.id ? { ...v, ...updatedProfile } : v); return [...prev, updatedProfile]; });

      showToast(existingProfile && existingProfile.isVerified ? "🎉 名片已更新！" : "🎉 名片已建立！等待審核。");
      if (!customForm.id) navigate('grid');
    } catch (err) { showToast("儲存失敗"); }
  };
  const handleBulletinImageUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { e.target.value = ''; return showToast("❌ 檔案太大！請選擇 5MB 以下。"); }
    showToast("⏳ 圖片壓縮中...");
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width, height = img.height; const maxWidth = 800, maxHeight = 800;
        if (width > maxWidth || height > maxHeight) { const ratio = Math.min(maxWidth / width, maxHeight / height); width *= ratio; height *= ratio; }
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const base64Str = canvas.toDataURL('image/jpeg', 0.8);
        if (base64Str.length > 800000) { e.target.value = ''; return showToast("❌ 壓縮後依然太大！"); }
        setNewBulletin(prev => ({ ...prev, image: base64Str })); e.target.value = ''; showToast(`✅ 圖片上傳成功！`);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleAddDefaultBulletinImage = async (base64) => {
    const newImages = [...defaultBulletinImages, base64];
    try { await setDoc(doc(db, getPath('settings'), 'bulletinImages'), { images: newImages }, { merge: true }); setDefaultBulletinImages(newImages); showToast("✅ 已新增預設圖片"); } catch (e) { showToast("新增失敗"); }
  };

  const handleDeleteDefaultBulletinImage = async (idx) => {
    if (!confirm("確定刪除這張預設圖片？")) return;
    const newImages = defaultBulletinImages.filter((_, i) => i !== idx);
    try { await setDoc(doc(db, getPath('settings'), 'bulletinImages'), { images: newImages }, { merge: true }); setDefaultBulletinImages(newImages); showToast("✅ 已刪除"); } catch (e) { showToast("刪除失敗"); }
  };
  const handlePostBulletin = async () => {
    if (!user) return showToast("請先登入！"); if (!newBulletin.content.trim() || !newBulletin.collabType || !newBulletin.collabSize || !newBulletin.collabTime || !newBulletin.recruitEndTime) return showToast("請完整填寫！");
    const rEnd = new Date(newBulletin.recruitEndTime).getTime(); const cTime = new Date(newBulletin.collabTime).getTime();
    if (rEnd < Date.now() && !newBulletin.id) return showToast("截止時間不能在過去！");
    if (cTime < rEnd) return showToast("⚠️ 聯動時間不能早於招募截止日！");
    if (!myProfile?.isVerified) return showToast("名片審核通過後才能發布喔！");
    try {
      const ft = newBulletin.collabType === '其他' ? newBulletin.collabTypeOther : newBulletin.collabType;
      const finalImage = newBulletin.image || (defaultBulletinImages.length > 0 ? defaultBulletinImages[Math.floor(Math.random() * defaultBulletinImages.length)] : '');
      if (newBulletin.id) {
        await updateDoc(doc(db, getPath('bulletins'), newBulletin.id), { content: newBulletin.content, collabType: ft, collabSize: newBulletin.collabSize, collabTime: newBulletin.collabTime, recruitEndTime: rEnd, image: finalImage });
        setRealBulletins(prev => prev.map(b => b.id === newBulletin.id ? { ...b, content: newBulletin.content, collabType: ft, collabSize: newBulletin.collabSize, collabTime: newBulletin.collabTime, recruitEndTime: rEnd, image: finalImage } : b));
        showToast("🚀 招募修改成功！");
      } else {
        const newDocData = { userId: user.uid, content: newBulletin.content, collabType: ft, collabSize: newBulletin.collabSize, collabTime: newBulletin.collabTime, recruitEndTime: rEnd, image: finalImage, applicants: [], createdAt: Date.now() };
        const newDocRef = await addDoc(collection(db, getPath('bulletins')), newDocData);
        setRealBulletins(prev => [{ id: newDocRef.id, ...newDocData }, ...prev]);
        showToast("🚀 發布成功！");
      }
      setNewBulletin({ id: null, content: '', collabType: '', collabTypeOther: '', collabSize: '', collabTime: '', recruitEndTime: '', image: '' });
    } catch (err) { showToast("操作失敗"); }
  };

  const handleEditBulletin = (b) => {
    const rEndD = new Date(b.recruitEndTime);
    const rEndStr = `${rEndD.getFullYear()}-${String(rEndD.getMonth() + 1).padStart(2, '0')}-${String(rEndD.getDate()).padStart(2, '0')}T${String(rEndD.getHours()).padStart(2, '0')}:${String(rEndD.getMinutes()).padStart(2, '0')}`;
    setNewBulletin({ id: b.id, content: b.content, collabType: PREDEFINED_COLLABS.includes(b.collabType) ? b.collabType : '其他', collabTypeOther: PREDEFINED_COLLABS.includes(b.collabType) ? '' : b.collabType, collabSize: b.collabSize, collabTime: b.collabTime, recruitEndTime: rEndStr, image: b.image || '' });
    navigate('bulletin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleApplyBulletin = async (bulletinId, isApplying, bulletinAuthorId) => {
    if (!user) return showToast("請先登入！"); if (!isVerifiedUser) return showToast("需通過官方認證才能報名！");
    try {
      await updateDoc(doc(db, getPath('bulletins'), bulletinId), { applicants: isApplying ? arrayUnion(user.uid) : arrayRemove(user.uid) });
      setRealBulletins(prev => prev.map(b => b.id === bulletinId ? { ...b, applicants: isApplying ? [...(b.applicants || []), user.uid] : (b.applicants || []).filter(id => id !== user.uid) } : b));
      showToast(isApplying ? "✅ 已成功送出意願！" : "已收回意願");
      if (isApplying && bulletinAuthorId !== user.uid) {
        addDoc(collection(db, getPath('notifications')), { userId: bulletinAuthorId, fromUserId: user.uid, fromUserName: myProfile?.name || user.displayName || '某位創作者', fromUserAvatar: myProfile?.avatar || user.photoURL, message: '有人有意願！快去招募佈告欄看看！', createdAt: Date.now(), read: false }).catch(() => { });
        const authorProfile = realVtubers.find(v => v.id === bulletinAuthorId);
        if (authorProfile && authorProfile.publicEmail) {
          addDoc(collection(db, getPath('mail')), {
            to: authorProfile.publicEmail,
            message: {
              subject: `[V-Nexus] 您的招募有新的意願通知！`,
              text: `您好，${authorProfile.name}！\n\n「${myProfile?.name || '某位創作者'}」剛剛對您的聯動招募表達了意願！\n\n快登入 V-Nexus https://www.vnexus2026.com/ 招募佈告欄查看並與對方聯繫吧！\n\n祝 聯動順利！\nV-Nexus 團隊`
            }
          }).catch((err) => console.error("Mail Error:", err));
        }
      }
    } catch (err) { showToast("操作失敗"); }
  };

  const handleRecommend = async (target) => {
    if (!isVerifiedUser) return showToast("需通過認證才能推薦！"); if (target.id === user.uid) return showToast("不能推薦自己！");
    if (target.likedBy && target.likedBy.includes(user.uid)) return showToast("已經推薦過囉！每人限推薦一次。");
    try {
      await updateDoc(doc(db, getPath('vtubers'), target.id), { likes: increment(1), likedBy: arrayUnion(user.uid) });
      setRealVtubers(prev => prev.map(v => v.id === target.id ? { ...v, likes: (v.likes || 0) + 1, likedBy: [...(v.likedBy || []), user.uid] } : v));
      if (selectedVTuber?.id === target.id) setSelectedVTuber(prev => ({ ...prev, likes: (prev.likes || 0) + 1, likedBy: [...(prev.likedBy || []), user.uid] }));
      showToast("✅ 已送出推薦！");
    } catch (err) { showToast("推薦失敗"); }
  };

  const handleInitiateDislike = (target) => {
    if (!isVerifiedUser) return showToast("需通過認證才能檢舉！"); if (target.id === user.uid) return showToast("不能檢舉自己！");
    if (target.dislikedBy && target.dislikedBy.includes(user.uid)) return showToast("已經倒讚過囉！"); setConfirmDislikeData(target);
  };

  const handleConfirmDislike = async () => {
    if (!confirmDislikeData || !user) return; const tId = confirmDislikeData.id;
    if (confirmDislikeData.dislikedBy && confirmDislikeData.dislikedBy.includes(user.uid)) { setConfirmDislikeData(null); return showToast("已經倒讚過囉！"); }
    const newD = (confirmDislikeData.dislikes || 0) + 1; const updates = { dislikes: increment(1), dislikedBy: arrayUnion(user.uid) };
    if (newD >= 10) { updates.isVerified = false; updates.isBlacklisted = true; }
    try {
      await updateDoc(doc(db, getPath('vtubers'), tId), updates);
      setRealVtubers(prev => prev.map(v => v.id === tId ? { ...v, dislikes: newD, dislikedBy: [...(v.dislikedBy || []), user.uid], isVerified: updates.isVerified ?? v.isVerified, isBlacklisted: updates.isBlacklisted ?? v.isBlacklisted } : v));
      setConfirmDislikeData(null); showToast("✅ 已送出倒讚。");
      if (updates.isBlacklisted) { showToast("⚠️ 該名片已自動下架。"); if (selectedVTuber?.id === tId) navigate('grid'); }
      else if (selectedVTuber?.id === tId) { setSelectedVTuber(prev => ({ ...prev, dislikes: newD, dislikedBy: [...(prev.dislikedBy || []), user.uid] })); }
    } catch (err) { showToast("操作失敗"); }
  };

  const handleVerifyVtuber = async (id) => {
    try {
      await setDoc(doc(db, getPath('vtubers'), id), { isVerified: true, isBlacklisted: false, verificationStatus: 'approved', showVerificationModal: 'approved' }, { merge: true });
      setRealVtubers(prev => prev.map(v => v.id === id ? { ...v, isVerified: true, isBlacklisted: false, verificationStatus: 'approved' } : v));
      showToast("已通過審核！");

      const targetVtuber = realVtubers.find(v => v.id === id);
      const targetPrivate = privateDocs[id];
      const emailToSend = targetPrivate?.contactEmail || targetVtuber?.publicEmail;
      if (emailToSend && targetVtuber) {
        await addDoc(collection(db, getPath('mail')), {
          to: emailToSend,
          message: {
            subject: `[V-Nexus] 恭喜！您的創作者名片已審核通過 🎉`,
            text: `您好，${targetVtuber.name}！\n\n恭喜您！您在 V-Nexus 提交的創作者名片已經審核通過並正式上架啦！\n\n趕快登入 V-Nexus 看看，並開始尋找您的聯動夥伴吧：\nhttps://www.vnexus2026.com/\n\n祝 聯動順利！\nV-Nexus 團隊`
          }
        }).catch(e => console.error("Mail Error:", e));
      }
    } catch (err) { showToast("審核失敗"); }
  };

  const handleRejectVtuber = async (id) => {
    if (!confirm("確定要退回/拒絕這張名片嗎？")) return;
    try {
      await setDoc(doc(db, getPath('vtubers'), id), { isVerified: false, verificationStatus: 'rejected', showVerificationModal: 'rejected' }, { merge: true });
      setRealVtubers(prev => prev.map(v => v.id === id ? { ...v, isVerified: false, verificationStatus: 'rejected' } : v));
      showToast("已退回該名片！");

      const targetVtuber = realVtubers.find(v => v.id === id);
      const targetPrivate = privateDocs[id];
      const emailToSend = targetPrivate?.contactEmail || targetVtuber?.publicEmail;
      if (emailToSend && targetVtuber) {
        await addDoc(collection(db, getPath('mail')), {
          to: emailToSend,
          message: {
            subject: `[V-Nexus] 關於您的創作者名片審核結果通知 ⚠️`,
            text: `您好，${targetVtuber.name}！\n\n很抱歉通知您，您在 V-Nexus 提交的創作者名片目前未能通過審核。\n\n請趕快回到網站看看是哪裡出了問題：\nhttps://www.vnexus2026.com/\n\n(常見未通過原因可能為：YT/TWITCH粉絲數加總未達500、一個月以上無活動紀錄、或是忘記將「V-Nexus審核中」放入您的社群平台簡介內以供官方驗證身分)\n\n若您已修正上述問題，歡迎隨時重新儲存名片以再次提交審核！\n\n感謝您的配合！\nV-Nexus 團隊`
          }
        }).catch(e => console.error("Mail Error:", e));
      }
    } catch (err) { showToast("操作失敗"); }
  };

  const handleAdminUpdateVtuber = async (id, updatedData) => {
    try {
      const tagsArray = typeof updatedData.tags === 'string' ? updatedData.tags.split(',').map(t => t.trim()).filter(t => t) : updatedData.tags;
      let finalCollabs = [...(updatedData.collabTypes || [])]; if (updatedData.isOtherCollab && updatedData.otherCollabText?.trim()) finalCollabs.push(updatedData.otherCollabText.trim());
      const finalPersonality = updatedData.personalityType === '其他' ? updatedData.personalityTypeOther : updatedData.personalityType;
      const publicData = { ...updatedData, tags: tagsArray, collabTypes: finalCollabs, personalityType: finalPersonality || '', colorSchemes: updatedData.colorSchemes || [], updatedAt: Date.now() };
      delete publicData.isVerified; delete publicData.isBlacklisted; delete publicData.verificationStatus; delete publicData.showVerificationModal; delete publicData.contactEmail; delete publicData.verificationNote; delete publicData.personalityTypeOther;
      await setDoc(doc(db, getPath('vtubers'), id), publicData, { merge: true }); await setDoc(doc(db, getPath('vtubers_private'), id), { contactEmail: updatedData.contactEmail, verificationNote: updatedData.verificationNote, updatedAt: Date.now() }, { merge: true });
      setRealVtubers(prev => prev.map(v => v.id === id ? { ...v, ...publicData } : v)); showToast("強制更新成功！");
    } catch (err) { showToast("更新失敗"); }
  };
  const handleDeleteVtuber = async (id) => { if (!confirm("確定要刪除這張名片嗎？(此動作無法復原)")) return; try { await deleteDoc(doc(db, getPath('vtubers'), id)); await deleteDoc(doc(db, getPath('vtubers_private'), id)); setRealVtubers(prev => prev.filter(v => v.id !== id)); showToast("已刪除名片"); } catch (err) { showToast("刪除失敗"); } };
  const handleDeleteBulletin = async (id) => { if (!confirm("確定要刪除這則招募文嗎？")) return; try { await deleteDoc(doc(db, getPath('bulletins'), id)); setRealBulletins(prev => prev.filter(b => b.id !== id)); showToast("已刪除招募文"); } catch (err) { showToast("刪除失敗"); } };
  // 找到 handleAddCollab 並修改
  const handleAddCollab = async (collabData) => {
    try {
      const docRef = await addDoc(collection(db, getPath('collabs')), {
        ...collabData,
        userId: user?.uid || 'admin',
        reminderSent: false, // <--- 補上這一行
        createdAt: Date.now()
      });
      setRealCollabs(prev => [...prev, { id: docRef.id, ...collabData, userId: user?.uid || 'admin', reminderSent: false, createdAt: Date.now() }]);
      showToast("已發布聯動行程");
    } catch (err) { showToast("新增失敗"); }
  };
  const handleDeleteCollab = async (id) => { if (!confirm("確定要刪除這個聯動行程嗎？")) return; try { await deleteDoc(doc(db, getPath('collabs'), id)); setRealCollabs(prev => prev.filter(c => c.id !== id)); showToast("已刪除聯動行程"); } catch (err) { showToast("刪除失敗"); } };
  const handleSaveSettings = async (tipsContent, rulesContent) => { try { if (tipsContent !== undefined) { await setDoc(doc(db, getPath('settings'), 'tips'), { content: tipsContent }, { merge: true }); setRealTips(tipsContent); } if (rulesContent !== undefined) { await setDoc(doc(db, getPath('settings'), 'rules'), { content: rulesContent }, { merge: true }); setRealRules(rulesContent); } showToast("系統設定已更新！"); } catch (err) { showToast("更新失敗"); } };
  const handleAdminResetAllCollabTypes = async () => { if (!confirm("⚠️ 確定要清除所有人的聯動類型嗎？")) return; try { if (prompt("請輸入 'CONFIRM'") !== 'CONFIRM') return showToast("已取消操作。"); for (const v of realVtubers) { if (!v.id.startsWith('mock')) { await setDoc(doc(db, getPath('vtubers'), v.id), { collabTypes: [] }, { merge: true }); } } setRealVtubers(prev => prev.map(v => ({ ...v, collabTypes: [] }))); showToast("✅ 已清除所有人聯動類型！"); } catch (err) { showToast("清除失敗"); } };
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
        startTimestamp: Date.now() + (1 * 60 * 60 * 1000),
        reminderSent: false,
        category: "系統測試",
        createdAt: Date.now()
      };
      const handleTestPushNotification = async () => {
        if (!user) return showToast("請先登入！");

        // 檢查資料庫中是否有你的 Token
        const myData = realVtubers.find(v => v.id === user.uid);
        if (!myData?.fcmToken) {
          return showToast("❌ 偵測不到您的推播 Token。請確保您是用手機『加入主畫面』開啟，且已點擊『允許通知』。");
        }

        showToast("⏳ 正在發送測試推播...");
        try {
          // 寫入一筆通知給自己，這會觸發後端的 Cloud Function
          await addDoc(collection(db, getPath('notifications')), {
            userId: user.uid,
            fromUserId: "system",
            fromUserName: "V-Nexus 測試員",
            fromUserAvatar: "https://duk.tw/u1jpPE.png",
            message: "🎉 恭喜！您的手機推播功能已成功啟動！",
            createdAt: Date.now(),
            read: false
          });
          showToast("✅ 測試指令已發出！請檢查手機通知中心（請先鎖屏或切換到其他 App 測試）。");
        } catch (err) {
          showToast("❌ 發送失敗：" + err.message);
        }
      };

      const docRef = await addDoc(collection(db, getPath('collabs')), testData);

      // 手動更新本地狀態，讓 useEffect 偵測到變化並執行寄信邏輯
      setRealCollabs(prev => [...prev, { id: docRef.id, ...testData }]);

      showToast("✅ 測試資料已建立！系統將在幾秒內自動偵測並寄信至您的信箱。");
    } catch (err) {
      showToast("❌ 測試失敗：" + err.message);
    }
  };
  const handleAdminResetNatAndLang = async () => {
    if (!confirm("⚠️ 確定要自動修復所有「國籍與語言格式錯誤」的名片嗎？")) return;
    try {
      let fixedCount = 0;
      for (const v of realVtubers) {
        if (!v.id.startsWith('mock')) {
          const isNatInvalid = v.nationalities !== undefined && !Array.isArray(v.nationalities);
          const isLangInvalid = v.languages !== undefined && !Array.isArray(v.languages);
          const hasOldNat = typeof v.nationality === 'string' && v.nationality;
          const hasOldLang = typeof v.language === 'string' && v.language;

          if (isNatInvalid || isLangInvalid || hasOldNat || hasOldLang) {
            let newNats = [];
            if (Array.isArray(v.nationalities)) newNats = v.nationalities;
            else if (typeof v.nationalities === 'string' && v.nationalities) newNats = [v.nationalities];
            else if (typeof v.nationality === 'string' && v.nationality) newNats = [v.nationality];

            let newLangs = [];
            if (Array.isArray(v.languages)) newLangs = v.languages;
            else if (typeof v.languages === 'string' && v.languages) newLangs = [v.languages];
            else if (typeof v.language === 'string' && v.language) newLangs = [v.language];

            await setDoc(doc(db, getPath('vtubers'), v.id), { nationalities: newNats, languages: newLangs, nationality: '', language: '' }, { merge: true });
            fixedCount++;
          }
        }
      }
      if (fixedCount > 0) {
        showToast(`✅ 已成功修復 ${fixedCount} 筆格式錯誤的名片！重新載入中...`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast(`✅ 檢查完畢，目前沒有格式錯誤的資料。`);
      }
    } catch (err) { console.error(err); showToast("修復失敗"); }
  };

  const handleMassSyncSubs = async () => {
    if (!confirm("確定要背景同步所有名片的 YouTube 粉絲數嗎？\n(將自動抓取超過24小時未更新，或「格式異常/無法讀取」的名片)")) return;
    setIsSyncingSubs(true);
    let successCount = 0;
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    const targets = realVtubers.filter(v => {
      const hasYt = v.youtubeUrl || v.channelUrl;
      if (!hasYt) return false;
      const ytExpired = hasYt && (now - (v.lastYoutubeFetchTime || 0) > TWENTY_FOUR_HOURS);
      const ytInvalid = hasYt && v.youtubeSubscribers && isNaN(parseFloat(String(v.youtubeSubscribers).replace(/,/g, '')));
      return ytExpired || ytInvalid;
    });

    for (const v of realVtubers) {
      if (!v.id.startsWith('mock')) {
        let updates = {};
        if (!(v.youtubeUrl || v.channelUrl) && v.youtubeSubscribers && isNaN(parseFloat(String(v.youtubeSubscribers).replace(/,/g, '')))) updates.youtubeSubscribers = '';
        if (Object.keys(updates).length > 0) {
          await updateDoc(doc(db, getPath('vtubers'), v.id), updates);
          setRealVtubers(prev => prev.map(rv => rv.id === v.id ? { ...rv, ...updates } : rv));
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
      if (ytUrl && (now - (v.lastYoutubeFetchTime || 0) > TWENTY_FOUR_HOURS || isNaN(parseFloat(String(v.youtubeSubscribers).replace(/,/g, ''))))) {
        try {
          const res = await httpsCallable(functionsInstance, 'fetchYouTubeStats')({ url: ytUrl });
          if (res.data && res.data.success) {
            const count = res.data.subscriberCount;
            let fmt = count.toString();
            if (count >= 10000) fmt = (count / 10000).toFixed(1).replace('.0', '') + '萬';
            else if (count >= 1000) fmt = (count / 1000).toFixed(1).replace('.0', '') + 'K';
            updates.youtubeSubscribers = fmt;
          }
          updates.lastYoutubeFetchTime = Date.now();
        } catch (e) { }
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, getPath('vtubers'), v.id), updates);
        setRealVtubers(prev => prev.map(rv => rv.id === v.id ? { ...rv, ...updates } : rv));
        successCount++;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    setSyncProgress('');
    setIsSyncingSubs(false);
    showToast(`✅ YT 同步完成！成功更新/修復 ${successCount} 筆資料。`);
  };

  const handleMassSyncTwitch = async () => {
    if (!confirm("確定要背景同步所有名片的 Twitch 追隨數嗎？\n(將自動抓取超過6小時未更新，或「格式異常/無法讀取」的名片)")) return;
    setIsSyncingSubs(true);
    let successCount = 0;
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const now = Date.now();

    const targets = realVtubers.filter(v => {
      const hasTw = v.twitchUrl;
      if (!hasTw) return false;
      const isOwnAdminCard = isAdmin && v.id === user?.uid;
      const twExpired = hasTw && (now - (v.lastTwitchFetchTime || 0) > SIX_HOURS || isOwnAdminCard);
      const twInvalid = hasTw && v.twitchFollowers && isNaN(parseFloat(String(v.twitchFollowers).replace(/,/g, '')));
      return twExpired || twInvalid;
    });

    for (const v of realVtubers) {
      if (!v.id.startsWith('mock')) {
        if (!v.twitchUrl && v.twitchFollowers && isNaN(parseFloat(String(v.twitchFollowers).replace(/,/g, '')))) {
          await updateDoc(doc(db, getPath('vtubers'), v.id), { twitchFollowers: '' });
          setRealVtubers(prev => prev.map(rv => rv.id === v.id ? { ...rv, twitchFollowers: '' } : rv));
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
      if (twUrl && (now - (v.lastTwitchFetchTime || 0) > SIX_HOURS || isNaN(parseFloat(String(v.twitchFollowers).replace(/,/g, ''))) || isOwnAdminCard)) {
        try {
          const res = await httpsCallable(functionsInstance, 'fetchTwitchStats')({ url: twUrl });
          const fetchTime = Date.now();
          let updates = { lastTwitchFetchTime: fetchTime };
          if (res.data && res.data.success) {
            const count = res.data.followerCount;
            let fmt = count.toString();
            if (count >= 10000) fmt = (count / 10000).toFixed(1).replace('.0', '') + '萬';
            else if (count >= 1000) fmt = (count / 1000).toFixed(1).replace('.0', '') + 'K';
            updates.twitchFollowers = fmt;
          }
          await updateDoc(doc(db, getPath('vtubers'), v.id), updates);
          setRealVtubers(prev => prev.map(rv => rv.id === v.id ? { ...rv, ...updates } : rv));
          successCount++;
        } catch (e) { }
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    setSyncProgress('');
    setIsSyncingSubs(false);
    showToast(`✅ Twitch 同步完成！成功更新/修復 ${successCount} 筆資料。`);
  };

  useEffect(() => {
    if (currentView === 'profile' && selectedVTuber) {
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      const SIX_HOURS = 6 * 60 * 60 * 1000;

      const syncYt = async () => {
        const url = selectedVTuber.youtubeUrl || selectedVTuber.channelUrl;
        if (url && (now - (selectedVTuber.lastYoutubeFetchTime || 0) > TWENTY_FOUR_HOURS)) {
          try {
            const res = await httpsCallable(functionsInstance, 'fetchYouTubeStats')({ url });
            const fetchTime = Date.now();
            let updates = { lastYoutubeFetchTime: fetchTime };
            if (res.data && res.data.success) {
              const count = res.data.subscriberCount;
              let fmt = count.toString();
              if (count >= 10000) fmt = (count / 10000).toFixed(1).replace('.0', '') + '萬';
              else if (count >= 1000) fmt = (count / 1000).toFixed(1).replace('.0', '') + 'K';
              updates.youtubeSubscribers = fmt;
            }
            await updateDoc(doc(db, getPath('vtubers'), selectedVTuber.id), updates);
            setSelectedVTuber(prev => ({ ...prev, ...updates }));
            setRealVtubers(prev => prev.map(v => v.id === selectedVTuber.id ? { ...v, ...updates } : v));
          } catch (err) { console.error(err); }
        }
      };

      const syncTw = async () => {
        const url = selectedVTuber.twitchUrl;
        const isOwnAdminCard = isAdmin && selectedVTuber.id === user?.uid;
        if (url && (now - (selectedVTuber.lastTwitchFetchTime || 0) > SIX_HOURS || isOwnAdminCard)) {
          try {
            const res = await httpsCallable(functionsInstance, 'fetchTwitchStats')({ url });
            const fetchTime = Date.now();
            let updates = { lastTwitchFetchTime: fetchTime };
            if (res.data && res.data.success) {
              const count = res.data.followerCount;
              let fmt = count.toString();
              if (count >= 10000) fmt = (count / 10000).toFixed(1).replace('.0', '') + '萬';
              else if (count >= 1000) fmt = (count / 1000).toFixed(1).replace('.0', '') + 'K';
              updates.twitchFollowers = fmt;
            }
            await updateDoc(doc(db, getPath('vtubers'), selectedVTuber.id), updates);
            setSelectedVTuber(prev => ({ ...prev, ...updates }));
            setRealVtubers(prev => prev.map(v => v.id === selectedVTuber.id ? { ...v, ...updates } : v));
          } catch (err) { console.error(err); }
        }
      };

      syncYt();
      syncTw();
    }
  }, [currentView, selectedVTuber?.id]);

  const handleAddUpdate = async (updateData) => { try { const docRef = await addDoc(collection(db, getPath('updates')), { ...updateData, createdAt: Date.now() }); setRealUpdates(prev => [{ id: docRef.id, ...updateData, createdAt: Date.now() }, ...prev]); showToast("✅ 已發佈最新消息"); } catch (err) { showToast("發佈失敗"); } };
  const handleDeleteUpdate = async (id) => { if (!confirm("確定要刪除這則公告嗎？")) return; try { await deleteDoc(doc(db, getPath('updates'), id)); setRealUpdates(prev => prev.filter(u => u.id !== id)); showToast("✅ 已刪除公告"); } catch (err) { showToast("刪除失敗"); } };

  const handleSendMassEmail = async (subject, content) => {
    let count = 0;
    for (const v of realVtubers) {
      const email = privateDocs[v.id]?.contactEmail || v.publicEmail;
      if (email && email.includes('@')) {
        addDoc(collection(db, getPath('mail')), {
          to: email,
          message: {
            subject: `[V-Nexus 官方公告] ${subject}`,
            text: `您好，${v.name}！\n\n${content}\n\n祝 聯動順利！\nV-Nexus 團隊`
          }
        }).catch(console.error);
        count++;
      }
    }
    showToast(`✅ 已發送 ${count} 封官方公告信件！`);
  };

  return (
    <div className="flex flex-col min-h-screen relative">
      {toastMsg && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-purple-500 text-white px-6 py-3 rounded-full shadow-[0_0_20px_rgba(168,85,247,0.3)] animate-slide-down flex items-center gap-3 font-bold text-sm"><i className="fa-solid fa-circle-info text-purple-400"></i> {toastMsg}</div>}

      <nav className="sticky top-0 z-40 backdrop-blur-md bg-[#0f111a]/95 border-b border-gray-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('home')}><div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-lg group-hover:shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all"><i className="fa-solid fa-wand-magic-sparkles text-white"></i></div><span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">V-Nexus</span></div>
            <div className="flex items-center gap-3">
              {!user ? <button onClick={handleLogin} className="flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-200 px-4 py-1.5 rounded-full transition-colors font-bold text-sm"><i className="fa-brands fa-google text-red-500"></i> Google 登入</button> : (
                <div className="flex items-center gap-3">
                  <div className="relative" ref={notifRef}>
                    <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="text-gray-300 hover:text-white p-2 text-xl relative transition-colors"><i className="fa-solid fa-bell"></i>{unreadCount > 0 && <span className="absolute top-1 right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 text-[8px] text-white flex items-center justify-center">{unreadCount}</span></span>}</button>
                    {isNotifOpen && (
                      <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in-up">
                        <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-800/50"><span className="font-bold text-white text-sm">站內小鈴鐺</span>{unreadCount > 0 && <button onClick={markAllAsRead} className="text-xs text-purple-400 hover:text-purple-300">全部已讀</button>}</div>
                        <div className="max-h-80 overflow-y-auto">
                          {myNotifications.length === 0 ? <div className="p-6 text-center text-gray-500 text-sm">目前沒有任何通知</div> : myNotifications.slice(0, 5).map(n => (
                            <div key={n.id} onClick={() => handleNotifClick(n)} className={`p-3 border-b border-gray-800 flex gap-3 hover:bg-gray-800/50 cursor-pointer transition-colors ${!n.read ? 'bg-purple-900/10' : ''}`}><img src={sanitizeUrl(n.fromUserAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anon')} className="w-10 h-10 rounded-full bg-gray-800 object-cover flex-shrink-0" /><div className="flex-1 min-w-0"><p className="text-xs text-gray-300 leading-snug"><span className="font-bold text-white hover:text-purple-400 transition-colors">{n.fromUserName}</span> {n.message}</p>
                              {n.type === 'brave_invite' && !n.handled && (
                                <div className="flex gap-2 mt-2">
                                  <button onClick={(e) => { e.stopPropagation(); handleBraveInviteResponse(n.id, n.fromUserId, true); }} className="flex-1 bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white text-[10px] font-bold py-1 rounded border border-green-600/30 transition-colors">可以試試</button>
                                  <button onClick={(e) => { e.stopPropagation(); handleBraveInviteResponse(n.id, n.fromUserId, false); }} className="flex-1 bg-gray-700/50 text-gray-400 hover:bg-gray-600 hover:text-white text-[10px] font-bold py-1 rounded border border-gray-600/50 transition-colors">委婉拒絕</button>
                                </div>
                              )}
                              <p className="text-[10px] text-gray-500 mt-1">{formatTime(n.createdAt)}</p></div>{!n.read && <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></div>}</div>
                          ))}
                        </div>
                        <div className="p-2 border-t border-gray-800 bg-gray-800/80 text-center"><button onClick={() => { setIsNotifOpen(false); navigate('inbox'); }} className="text-xs text-purple-400 font-bold hover:text-purple-300 w-full py-1">前往專屬信箱查看完整通知 <i className="fa-solid fa-arrow-right ml-1"></i></button></div>
                      </div>
                    )}
                  </div>
                  <button onClick={() => navigate('dashboard')} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 px-3 py-1.5 rounded-full transition-colors relative whitespace-nowrap"><img src={sanitizeUrl(user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=Anon")} className="w-5 h-5 rounded-full" /><span className="text-gray-300 text-xs font-bold truncate max-w-[80px] hidden sm:block">{user.displayName || '創作者'}</span>{realVtubers.find(v => v.id === user.uid && !v.isVerified) && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}</button>
                  <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 text-xs font-bold whitespace-nowrap" title="登出"><i className="fa-solid fa-right-from-bracket"></i></button>
                </div>
              )}
              {isAdmin && <button onClick={() => navigate('admin')} className="hidden sm:flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap relative"><i className="fa-solid fa-shield-halved"></i> 管理員{pendingVtubersCount > 0 && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 text-[8px] text-white flex items-center justify-center"></span></span>}</button>}
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden text-gray-300 p-2 text-2xl ml-1"><i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'}`}></i></button>
            </div>
          </div>
          <div className="hidden lg:flex items-center justify-center gap-4 pb-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
            <button onClick={() => navigate('home')} className={`transition-colors px-3 py-1.5 font-bold text-sm whitespace-nowrap ${currentView === 'home' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-gray-400 hover:text-white'}`}>首頁介紹</button>
            <button
              onClick={() => navigate('grid')}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-full font-bold transition-all text-sm whitespace-nowrap animate-glow-pulse ${currentView === 'grid' || currentView === 'profile'
                ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white shadow-[0_0_25px_rgba(168,85,247,0.8)] scale-105 border border-white/30'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:scale-105 hover:shadow-[0_0_20px_rgba(168,85,247,0.6)]'
                }`}
            >
              <i className="fa-solid fa-magnifying-glass"></i> 尋找 VTuber 夥伴
            </button>
            <button onClick={() => { if (!isVerifiedUser) { showToast("請先認證名片解鎖功能"); navigate('dashboard'); } else navigate('bulletin'); }} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm whitespace-nowrap ${currentView === 'bulletin' ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'bg-rose-600 text-white hover:bg-rose-500 shadow-md border border-rose-500/50'}`}><i className="fa-solid fa-bullhorn"></i> 招募佈告欄{!isVerifiedUser && ' 🔒'}</button>
            <button onClick={() => navigate('collabs')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold transition-colors text-sm whitespace-nowrap ${currentView === 'collabs' ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-red-600 text-white hover:bg-red-500 shadow-md border border-red-500/50'}`}><i className="fa-solid fa-broadcast-tower"></i> 確定聯動</button>
            <button onClick={() => { if (!isVerifiedUser) { showToast("請先認證名片解鎖功能"); navigate('dashboard'); } else navigate('match'); }} className={`transition-colors px-3 py-1.5 font-bold text-sm whitespace-nowrap ${currentView === 'match' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-gray-400 hover:text-white'}`}><i className="fa-solid fa-dice mr-1"></i> 聯動隨機配對{!isVerifiedUser && ' 🔒'}</button>
            <button onClick={() => navigate('blacklist')} className={`transition-colors px-3 py-1.5 font-bold text-sm whitespace-nowrap ${currentView === 'blacklist' ? 'text-red-500 border-b-2 border-red-600' : 'text-red-400/70 hover:text-red-400'}`}><i className="fa-solid fa-ban mr-1"></i> 黑單避雷區</button>
            {user && <button onClick={() => navigate('inbox')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm whitespace-nowrap ${currentView === 'inbox' ? 'bg-purple-500 text-white shadow-lg' : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700'}`}><i className="fa-solid fa-envelope-open-text"></i> 我的信箱{unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{unreadCount}</span>}</button>}
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-16 left-0 w-full bg-[#0f111a]/95 backdrop-blur-md border-b border-gray-800 shadow-xl flex flex-col p-4 gap-4 z-50 animate-fade-in-up">
            <button onClick={() => navigate('home')} className={`text-left px-4 py-3 rounded-xl font-bold ${currentView === 'home' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>首頁介紹</button>
            <button
              onClick={() => navigate('grid')}
              className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all ${currentView === 'grid' || currentView === 'profile'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.5)]'
                : 'bg-gradient-to-r from-purple-600/90 to-pink-600/90 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                }`}
            >
              <i className="fa-solid fa-magnifying-glass w-5"></i> 尋找 VTuber 夥伴
            </button>
            <button onClick={() => { if (!isVerifiedUser) { showToast("請先認證名片解鎖"); navigate('dashboard'); } else navigate('bulletin'); }} className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === 'bulletin' ? 'bg-rose-500 text-white shadow-lg' : 'bg-rose-600 text-white hover:bg-rose-500'}`}><i className="fa-solid fa-bullhorn w-5"></i> 招募佈告欄</button>
            <button onClick={() => navigate('collabs')} className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === 'collabs' ? 'bg-red-500 text-white shadow-lg' : 'bg-red-600 text-white hover:bg-red-500'}`}><i className="fa-solid fa-broadcast-tower w-5"></i> 確定聯動</button>
            <button onClick={() => { if (!isVerifiedUser) { showToast("請先認證名片解鎖"); navigate('dashboard'); } else navigate('match'); }} className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === 'match' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}><i className="fa-solid fa-dice w-5"></i> 聯動隨機配對</button>
            <button onClick={() => navigate('blacklist')} className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 ${currentView === 'blacklist' ? 'bg-red-900/50 text-red-400' : 'text-red-400/70 hover:bg-red-900/30'}`}><i className="fa-solid fa-ban w-5"></i> 黑單避雷區</button>
            {user && <button onClick={() => navigate('inbox')} className={`text-left px-4 py-3 rounded-xl font-bold flex items-center justify-between ${currentView === 'inbox' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}><div className="flex items-center gap-3"><i className="fa-solid fa-envelope-open-text w-5"></i> 我的信箱</div>{unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{unreadCount}</span>}</button>}
            {isAdmin && <button onClick={() => navigate('admin')} className={`text-left px-4 py-3 rounded-xl font-bold text-red-400 hover:bg-red-500/10 flex items-center justify-between`}><div className="flex items-center gap-3"><i className="fa-solid fa-shield-halved w-5"></i> 系統管理員</div> {pendingVtubersCount > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingVtubersCount}</span>}</button>}
          </div>
        )}
      </nav>

      <main className="flex-1 pb-10">
        {currentView === 'home' && <HomePage navigate={navigate} onOpenRules={() => setIsRulesModalOpen(true)} onOpenUpdates={() => setIsUpdatesModalOpen(true)} hasUnreadUpdates={hasUnreadUpdates} siteStats={siteStats} realCollabs={realCollabs} displayCollabs={displayCollabs} currentTime={currentTime} isLoadingCollabs={isLoading} goToBulletin={goToBulletin} registeredCount={!isLoading ? displayVtubers.length : null} realVtubers={realVtubers} setSelectedVTuber={setSelectedVTuber} realBulletins={realBulletins} />}

        {currentView === 'inbox' && user && <InboxPage notifications={myNotifications} markAllAsRead={markAllAsRead} onMarkRead={handleMarkNotifRead} onDelete={handleDeleteNotif} onNavigateProfile={handleNotifProfileNav} onBraveResponse={handleBraveInviteResponse} />}

        {currentView === 'dashboard' && (

          <div className="max-w-3xl mx-auto px-4 py-10 animate-fade-in-up">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-extrabold text-white flex items-center justify-center gap-3"><i className="fa-solid fa-user-circle text-purple-400"></i> 創作者中心：編輯名片</h2>
              {myProfile && <div className="mt-4 mb-2"><button onClick={() => { setSelectedVTuber(myProfile); navigate(`profile/${myProfile.id}`); }} className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg transition-transform hover:scale-105 inline-flex items-center gap-2"><i className="fa-solid fa-eye"></i> 預覽我的公開名片</button></div>}
              {user && realVtubers.find(v => v.id === user.uid) ? (realVtubers.find(v => v.id === user.uid).isVerified ? <p className="text-green-400 mt-3 text-sm font-bold bg-green-500/10 inline-block px-4 py-1 rounded-full"><i className="fa-solid fa-circle-check mr-1"></i> 名片已認證上線</p> : <p className="text-yellow-400 mt-3 text-sm font-bold bg-yellow-500/10 inline-block px-4 py-1 rounded-full"><i className="fa-solid fa-user-clock mr-1"></i> 名片審核中，通過後將自動公開</p>) : <p className="text-gray-400 mt-2">填寫完成後請等待管理員審核，確保社群品質！</p>}
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg transition-transform hover:scale-105 inline-flex items-center gap-2 ml-2"
              >
                <i className="fa-solid fa-bell"></i> 啟動手機推播通知
              </button>
            </div>
            {/* 安插在 Dashboard 的按鈕區 */}
            {/* 找到 Dashboard 視圖中的按鈕區 */}

            <div className="bg-gray-800/40 border border-gray-700 rounded-3xl p-6 sm:p-10 shadow-2xl">
              <ProfileEditorForm form={profileForm} updateForm={(updates) => setProfileForm(prev => ({ ...prev, ...updates }))} onSubmit={(e) => handleSaveProfile(e)} showToast={showToast} isAdmin={false} user={user} />
            </div>
            {user && myProfile && displayBulletins.filter(b => b.userId === user.uid).length > 0 && (
              <div className="mt-16 animate-fade-in-up">
                <h3 className="text-2xl font-extrabold text-white mb-6 border-b border-gray-700 pb-3 flex items-center"><i className="fa-solid fa-bullhorn text-purple-400 mr-3"></i>我的招募管理 (可在此查看誰有意願)</h3>
                <div className="grid grid-cols-1 gap-6">{displayBulletins.filter(b => b.userId === user.uid).map(b => <BulletinCard key={b.id} b={b} user={user} isVerifiedUser={isVerifiedUser} onNavigateProfile={(vtuber, isFromApplicants) => { if (vtuber && vtuber.id) { if (isFromApplicants) setOpenBulletinModalId(b.id); else setOpenBulletinModalId(null); setSelectedVTuber(vtuber); navigate(`profile/${vtuber.id}`); } else { showToast("找不到該名片！"); } }} onApply={(id, isApplying) => handleApplyBulletin(id, isApplying, b.userId)} onInvite={handleOpenCollabModal} onDeleteBulletin={handleDeleteBulletin} onEditBulletin={handleEditBulletin} openModalId={openBulletinModalId} onClearOpenModalId={() => setOpenBulletinModalId(null)} />)}</div>
              </div>
            )}
          </div>
        )}

        {currentView === 'grid' && (

          <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8 animate-fade-in-up">
            <aside className={`w-full lg:w-72 flex-shrink-0 space-y-6 ${isMobileFilterOpen ? 'block' : 'hidden lg:block'}`}>
              <div className="hidden lg:block relative"><i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i><input type="text" placeholder="搜尋 VTuber..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-purple-500" /></div>
              <div className="bg-gray-800/30 border border-gray-800 rounded-xl p-5 space-y-5">
                <h3 className="font-bold border-b border-gray-700 pb-2 text-gray-300"><i className="fa-solid fa-filter mr-2"></i>進階篩選</h3>
                <div><p className="text-xs text-gray-500 mb-2">所屬勢力</p><div className="grid grid-cols-2 gap-1 bg-gray-900 rounded-lg p-1 border border-gray-700">{['All', '個人勢', '企業勢', '社團勢'].map(a => <button key={a} onClick={() => setSelectedAgency(a)} className={`w-full py-1.5 text-xs font-bold rounded-md ${selectedAgency === a ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>{a === 'All' ? '全部' : a}</button>)}</div></div>
                <div><p className="text-xs text-gray-500 mb-2">主要平台</p><div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">{['All', 'YouTube', 'Twitch'].map(p => <button key={p} onClick={() => setSelectedPlatform(p)} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${selectedPlatform === p ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>{p === 'All' ? '全部' : p}</button>)}</div></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-gray-500 mb-2">國籍</p><select value={selectedNationality} onChange={(e) => setSelectedNationality(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-xs outline-none font-normal">{dynamicNationalities.map(n => <option key={n} value={n}>{n === 'All' ? '全部' : n}</option>)}</select></div>
                  <div><p className="text-xs text-gray-500 mb-2">主要語言</p><select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-xs outline-none font-normal">{dynamicLanguages.map(l => <option key={l} value={l}>{l === 'All' ? '全部' : l}</option>)}</select></div>
                </div>
                <div><p className="text-xs text-gray-500 mb-2">可聯動時段</p><select value={selectedSchedule} onChange={(e) => setSelectedSchedule(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-xs outline-none font-normal">{dynamicSchedules.map(d => <option key={d} value={d}>{d === 'All' ? '全部' : d}</option>)}</select></div>
                {/* 新增：色系篩選 */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">代表色系</p>
                  <select
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-xs outline-none font-normal"
                  >
                    <option value="All">全部色系</option>
                    {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2 mt-2"><p className="w-full text-xs text-gray-500 mb-1">想找什麼聯動？</p>{dynamicCollabTypes.map(tag => <TagBadge key={tag} text={tag} selected={selectedTags.includes(tag)} onClick={() => toggleTag(tag)} />)}</div>
              </div>
            </aside>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">尋找 VTuber 夥伴 {user && realVtubers.find(v => v.id === user.uid && (!v.isVerified || v.isBlacklisted || v.activityStatus !== 'active')) && <span className="text-xs font-normal text-yellow-400 bg-yellow-500/10 px-3 py-1 rounded-full"><i className="fa-solid fa-eye-slash mr-1"></i>隱藏中</span>}</h2>
                  <button onClick={() => setIsTipsModalOpen(true)} className="bg-yellow-500/10 text-yellow-400 px-3 py-1.5 rounded-lg text-sm font-bold"><i className="fa-solid fa-lightbulb"></i> 邀約小技巧</button>
                  <button onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)} className="lg:hidden bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors"><i className="fa-solid fa-filter"></i> 篩選</button>
                </div>
                <div className="flex flex-col gap-3 w-full sm:w-auto">
                  <div className="block lg:hidden relative w-full"><i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i><input type="text" placeholder="搜尋 VTuber..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-purple-500" /></div>
                  <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-xl p-2.5 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none w-full sm:w-auto"><option value="random">🔀 隨機排列</option><option value="likes">👍 最推薦</option><option value="subscribers">📺 最多訂閱</option><option value="newest">✨ 最新加入</option></select>
                </div>
              </div>
              {isLoading ? <div className="text-center text-gray-500 py-10"><i className="fa-solid fa-spinner fa-spin text-2xl"></i></div> : filteredVTubers.length === 0 ? <p className="text-center text-gray-500 mt-20">目前無公開名片</p> : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{paginatedVTubers.map(v => <VTuberCard key={v.id} v={v} user={user} isVerifiedUser={isVerifiedUser} onSelect={() => { setSelectedVTuber(v); navigate(`profile/${v.id}`); }} onDislike={() => handleInitiateDislike(v)} />)}</div>
                  {totalPages > 1 && (
                    <div className="flex flex-wrap justify-center items-center gap-4 mt-12 animate-fade-in-up">
                      <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className={`px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg flex items-center ${currentPage === 1 ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed border border-gray-800' : 'bg-gray-800 hover:bg-purple-600 text-white border border-gray-700 hover:border-purple-500'}`}><i className="fa-solid fa-chevron-left mr-2"></i> 上一頁</button>
                      <div className="flex items-center gap-2 text-gray-300 font-bold bg-gray-900/50 px-4 py-2.5 rounded-xl border border-gray-700"><span>第</span><select value={currentPage} onChange={(e) => handlePageChange(Number(e.target.value))} className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-white outline-none cursor-pointer">{[...Array(totalPages).keys()].map(n => <option key={n + 1} value={n + 1}>{n + 1}</option>)}</select><span>/ {totalPages} 頁</span></div>
                      <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className={`px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg flex items-center ${currentPage === totalPages ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed border border-gray-800' : 'bg-gray-800 hover:bg-purple-600 text-white border border-gray-700 hover:border-purple-500'}`}>下一頁 <i className="fa-solid fa-chevron-right ml-2"></i></button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {currentView === 'profile' && !selectedVTuber && isLoading && <div className="max-w-4xl mx-auto px-4 py-20 text-center animate-fade-in-up"><i className="fa-solid fa-spinner fa-spin text-4xl text-purple-500 mb-4"></i><p className="text-gray-400 font-bold text-lg">載入專屬名片中...</p></div>}

        {currentView === 'profile' && selectedVTuber && (
          <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in-up">
            <button onClick={() => {
              document.body.style.opacity = '0';
              document.body.style.transition = 'opacity 0.1s';
              const target = previousView === 'profile' ? 'grid' : (previousView || 'grid');
              navigate(target, true);
              setTimeout(() => {
                window.scrollTo(0, gridScrollY.current);
                document.body.style.opacity = '1';
                document.body.style.transition = '';
              }, 50);
            }} className="text-gray-400 hover:text-white mb-6 flex items-center text-sm transition-colors">
              <i className="fa-solid fa-chevron-left mr-2"></i>
              {openBulletinModalId ? '看看其他有意願的Vtuber' : previousView === 'bulletin' ? '返回佈告欄' : previousView === 'collabs' ? '返回聯動表' : previousView === 'inbox' ? '返回我的信箱' : previousView === 'home' ? '返回首頁' : previousView === 'match' ? '返回配對' : '返回探索'}
            </button>
            <div className="bg-gray-800/40 border border-gray-700 rounded-3xl overflow-hidden shadow-2xl">
              <div className="h-48 sm:h-64 relative"><img src={sanitizeUrl(selectedVTuber.banner)} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div></div>
              <div className="px-6 sm:px-10 pb-10 relative">
                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-16 sm:-mt-20 mb-8 z-10 relative">
                  <div className="flex flex-col gap-3 items-center sm:items-start flex-shrink-0">
                    <img src={sanitizeUrl(selectedVTuber.avatar)} className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-4 border-gray-900 bg-gray-800 object-cover" />
                    {isVerifiedUser && selectedVTuber.id !== user?.uid && <button onClick={() => handleBraveInvite(selectedVTuber)} className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white px-4 py-2 w-full rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(244,63,94,0.4)] flex items-center justify-center transition-transform hover:scale-105"><i className="fa-solid fa-heart mr-1.5"></i>勇敢邀請</button>}
                  </div>
                  <div className="flex-1 w-full">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2"><h1 className="text-3xl sm:text-4xl font-extrabold text-white flex items-center gap-3">{selectedVTuber.name} {selectedVTuber.isVerified && <i className="fa-solid fa-circle-check text-blue-400 text-2xl"></i>}</h1></div>
                        <div className="flex flex-wrap gap-2 mt-2 items-center">
                          <span className="px-3 py-1 bg-gray-800 text-xs rounded-full text-gray-300 border border-gray-700">{selectedVTuber.agency}</span>
                          {(selectedVTuber.nationalities?.length > 0 || selectedVTuber.nationality) && <span className="px-3 py-1 bg-gray-800 text-xs rounded-full text-gray-300 border border-gray-700"><i className="fa-solid fa-earth-asia mr-1 text-blue-300"></i>{(selectedVTuber.nationalities?.length > 0 ? selectedVTuber.nationalities : [selectedVTuber.nationality]).join(', ')}</span>}
                          {(selectedVTuber.languages?.length > 0 || selectedVTuber.language) && <span className="px-3 py-1 bg-gray-800 text-xs rounded-full text-gray-300 border border-gray-700"><i className="fa-solid fa-language mr-1 text-yellow-300"></i>{(selectedVTuber.languages?.length > 0 ? selectedVTuber.languages : [selectedVTuber.language]).join(', ')}</span>}
                          {selectedVTuber.personalityType && <span className="px-3 py-1 bg-gray-800 text-xs rounded-full text-gray-300 border border-gray-700"><i className="fa-solid fa-user-tag mr-1 text-pink-300"></i>{selectedVTuber.personalityType}</span>}
                          {/* 新增：名片頁面顯示色系 */}
                          {selectedVTuber.colorSchemes && selectedVTuber.colorSchemes.map(color => (
                            <span key={color} className="px-3 py-1 bg-gray-800 text-xs rounded-full text-gray-300 border border-gray-700">
                              <i className="fa-solid fa-palette mr-1 text-purple-400"></i>{color}系
                            </span>
                          ))}
                          <span className={`text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${selectedVTuber.mainPlatform === 'Twitch' ? 'bg-purple-600' : 'bg-red-600'}`}><i className={`fa-brands fa-${selectedVTuber.mainPlatform === 'Twitch' ? 'twitch' : 'youtube'}`}></i> 主要平台：{selectedVTuber.mainPlatform || 'YouTube'}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-4 text-sm">
                          <button onClick={() => isVerifiedUser && selectedVTuber.id !== user?.uid ? handleRecommend(selectedVTuber) : null} className="bg-green-500/10 border border-green-500/30 text-green-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold"><i className="fa-solid fa-thumbs-up"></i> {selectedVTuber.likes || 0} 推薦</button>
                          {isVerifiedUser && selectedVTuber.id !== user?.uid && <button onClick={() => handleInitiateDislike(selectedVTuber)} className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold"><i className="fa-solid fa-thumbs-down"></i> {selectedVTuber.dislikes || 0}</button>}
                          {isVerifiedUser && selectedVTuber.publicEmail && <a href={sanitizeUrl(`mailto:${selectedVTuber.publicEmail}`)} className="bg-gray-700/50 text-gray-300 hover:bg-gray-600 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5"><i className="fa-solid fa-envelope text-yellow-400"></i> 直接寄信{selectedVTuber.publicEmailVerified && <i className="fa-solid fa-circle-check text-green-400 ml-0.5" title="信箱已認證"></i>}</a>}
                          {(selectedVTuber.youtubeUrl || selectedVTuber.channelUrl) ? <a href={sanitizeUrl(selectedVTuber.youtubeUrl || selectedVTuber.channelUrl)} target="_blank" rel="noopener noreferrer" className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5"><i className="fa-brands fa-youtube"></i> YouTube{(selectedVTuber.youtubeSubscribers || selectedVTuber.subscribers) && <span className="ml-1 px-2 py-0.5 bg-red-500/20 rounded text-xs">{selectedVTuber.youtubeSubscribers || selectedVTuber.subscribers}</span>}</a> : ((selectedVTuber.youtubeSubscribers || selectedVTuber.subscribers) ? <span className="bg-red-500/5 text-red-400/80 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5"><i className="fa-brands fa-youtube"></i> YouTube<span className="ml-1 px-2 py-0.5 bg-red-500/10 rounded text-xs">{selectedVTuber.youtubeSubscribers || selectedVTuber.subscribers}</span></span> : null)}
                          {selectedVTuber.twitchUrl ? <a href={sanitizeUrl(selectedVTuber.twitchUrl)} target="_blank" rel="noopener noreferrer" className="bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5"><i className="fa-brands fa-twitch"></i> Twitch{(selectedVTuber.twitchFollowers) && <span className="ml-1 px-2 py-0.5 bg-purple-500/20 rounded text-xs">{selectedVTuber.twitchFollowers}</span>}</a> : selectedVTuber.twitchFollowers ? <span className="bg-purple-500/5 text-purple-400/80 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5"><i className="fa-brands fa-twitch"></i> Twitch<span className="ml-1 px-2 py-0.5 bg-purple-500/10 rounded text-xs">{selectedVTuber.twitchFollowers}</span></span> : null}
                          {selectedVTuber.xUrl && <a href={sanitizeUrl(selectedVTuber.xUrl)} target="_blank" rel="noopener noreferrer" className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg font-bold"><i className="fa-brands fa-x-twitter"></i> X</a>}
                          {selectedVTuber.igUrl && <a href={sanitizeUrl(selectedVTuber.igUrl)} target="_blank" rel="noopener noreferrer" className="bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 px-3 py-1.5 rounded-lg font-bold"><i className="fa-brands fa-instagram"></i> IG</a>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                        {isVerifiedUser && selectedVTuber.id !== user?.uid && <button onClick={() => handleOpenCollabModal(selectedVTuber)} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex-shrink-0 flex items-center justify-center"><i className="fa-solid fa-paper-plane mr-2"></i>發送站內邀約</button>}
                        {selectedVTuber.streamStyleUrl && <a href={sanitizeUrl(selectedVTuber.streamStyleUrl)} target="_blank" rel="noopener noreferrer" className="bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:bg-blue-600 hover:text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-colors flex items-center justify-center gap-2"><i className="fa-solid fa-video"></i> 觀看直播風格</a>}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-6">
                  <div className="md:col-span-2 space-y-8">
                    <section>
                      <div className="flex flex-wrap sm:flex-nowrap justify-between items-center border-b border-gray-700 pb-2 mb-4 gap-2">
                        <h3 className="text-xl font-bold text-purple-400"><i className="fa-solid fa-microphone mr-2"></i>關於我</h3>
                        <button // 修改 profile 視圖中的複製按鈕 onClick 邏輯
                          onClick={() => {
                            const identifier = selectedVTuber.slug || selectedVTuber.id;
                            const url = window.location.origin + window.location.pathname + '#profile/' + identifier;
                            navigator.clipboard.writeText(url);
                            showToast("✅ 已複製專屬名片連結！");
                          }} className="bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-gray-600 flex items-center gap-1.5"><i className="fa-solid fa-link"></i> 複製我的名片連結</button>
                      </div>
                      <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{selectedVTuber.description}</p>
                    </section>
                    <section><h3 className="text-xl font-bold border-b border-gray-700 pb-2 mb-4 text-pink-400"><i className="fa-solid fa-gamepad mr-2"></i>內容標籤</h3><div className="flex flex-wrap gap-2">{(selectedVTuber.tags || []).map(t => <span key={t} className="px-3 py-1 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300">#{t}</span>)}</div></section>
                  </div>
                  <div className="space-y-6">
                    <div className="bg-gray-900/50 p-5 rounded-2xl border border-gray-700"><h4 className="font-bold text-gray-200 mb-2"><i className="fa-solid fa-mask text-green-400 mr-2"></i>演出型態</h4><p className="text-sm text-gray-400 mb-4">{selectedVTuber.streamingStyle || '一般型態'}</p><h4 className="font-bold text-gray-200 mb-3"><i className="fa-solid fa-bullseye text-blue-400 mr-2"></i>主要願意連動類型</h4><div className="flex flex-wrap gap-2">{(selectedVTuber.collabTypes || []).map(t => <span key={t} className="bg-purple-900/30 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm">{t}</span>)}</div></div>
                    <div className="bg-gray-900/50 p-5 rounded-2xl border border-gray-700"><h4 className="font-bold text-gray-200 mb-3"><i className="fa-solid fa-calendar-check text-yellow-400 mr-2"></i>可聯動時段</h4><div className="text-sm text-gray-300 leading-relaxed"><p>{formatSchedule(selectedVTuber)}</p></div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'bulletin' && (
          <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div><h2 className="text-3xl font-extrabold text-white flex items-center gap-3"><i className="fa-solid fa-bullhorn text-purple-400"></i>招募佈告欄</h2><p className="text-gray-400 mt-2 text-sm">在這裡發布您的聯動企劃，或是尋找有興趣的邀請吧！<span className="text-yellow-400 font-bold ml-2">(注意：招募時間截止前，發起人必須進入信箱發送正式邀請才算成功)</span></p></div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button onClick={() => setIsLeaderboardModalOpen(true)} className="bg-yellow-600 hover:bg-yellow-500 text-white px-5 py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(202,138,4,0.4)] flex items-center justify-center transition-transform hover:-translate-y-1"><i className="fa-solid fa-trophy mr-2"></i>招募成功排行榜</button>
                <button onClick={() => { setNewBulletin({ id: null, content: '', collabType: '', collabTypeOther: '', collabSize: '', collabTime: '', recruitEndTime: '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); document.getElementById('bulletin-form')?.scrollIntoView({ behavior: 'smooth' }); }} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center justify-center transition-transform hover:-translate-y-1"><i className="fa-solid fa-pen-nib mr-2"></i>我要發布招募</button>
              </div>
            </div>

            <div id="bulletin-form" className="bg-gray-800/40 border border-gray-700 rounded-3xl p-6 sm:p-8 shadow-2xl mb-10">
              <h3 className="text-xl font-bold text-white mb-6 border-b border-gray-700 pb-3">{newBulletin.id ? '編輯招募文' : '發布新招募'}</h3>
              <div className="space-y-6">
                <div><label className="block text-sm font-bold text-gray-300 mb-2">招募內容說明 <span className="text-red-400">*</span></label><textarea required rows="4" placeholder="請描述您的聯動企劃內容、希望的對象條件..." value={newBulletin.content} onChange={e => setNewBulletin({ ...newBulletin, content: e.target.value })} className={inputCls + " resize-none"} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">聯動類型 <span className="text-red-400">*</span></label>
                    <select value={newBulletin.collabType} onChange={e => setNewBulletin({ ...newBulletin, collabType: e.target.value })} className={inputCls}><option value="">請選擇</option>{PREDEFINED_COLLABS.map(t => <option key={t} value={t}>{t}</option>)}<option value="其他">其他 (自行輸入)</option></select>
                    {newBulletin.collabType === '其他' && <input type="text" placeholder="請輸入類型" value={newBulletin.collabTypeOther} onChange={e => setNewBulletin({ ...newBulletin, collabTypeOther: e.target.value })} className={inputCls + " mt-2"} />}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">預估人數 <span className="text-red-400">*</span></label>
                    <select value={newBulletin.collabSize} onChange={e => setNewBulletin({ ...newBulletin, collabSize: e.target.value })} className={inputCls}><option value="">請選擇</option>{Array.from({ length: 20 }, (_, i) => i + 1).map(n => <option key={n} value={`${n}人`}>{n}人</option>)}</select>
                  </div>
                  <div><label className="block text-sm font-bold text-gray-300 mb-2">預計聯動時間 <span className="text-red-400">*</span></label><input type="datetime-local" lang="sv-SE" step="60" value={newBulletin.collabTime} onChange={e => setNewBulletin({ ...newBulletin, collabTime: e.target.value })} className={inputCls} /></div>
                  <div><label className="block text-sm font-bold text-gray-300 mb-2">招募截止時間 <span className="text-red-400">*</span></label><input type="datetime-local" lang="sv-SE" step="60" value={newBulletin.recruitEndTime} onChange={e => setNewBulletin({ ...newBulletin, recruitEndTime: e.target.value })} className={inputCls} /></div>
                </div>
                {/* 圖片上傳與按鈕同一行 (桌面版並排) */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2 mt-2">
                  <div className="flex-1 min-w-0">
                    <label className="block text-sm font-bold text-gray-300 mb-2">選擇預設圖 或 自行上傳 (未選將隨機套用)</label>
                    <div className="flex flex-col gap-3">
                      {/* 預設圖選擇區 */}
                      {defaultBulletinImages.length > 0 && (
                        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar items-center">
                          {defaultBulletinImages.map((img, idx) => (
                            <img
                              key={idx}
                              src={sanitizeUrl(img)}
                              onClick={() => setNewBulletin(p => ({ ...p, image: img }))}
                              className={`w-28 h-16 rounded-lg object-cover cursor-pointer border-2 transition-all flex-shrink-0 ${newBulletin.image === img ? 'border-purple-500 scale-105 shadow-[0_0_15px_rgba(168,85,247,0.5)] opacity-100' : 'border-transparent hover:border-gray-500 opacity-50 hover:opacity-100'}`}
                              title="點擊套用此預設圖"
                            />
                          ))}
                        </div>
                      )}

                      {/* 自行上傳與清除區 */}
                      <div className="flex gap-3 items-center">
                        {newBulletin.image && !defaultBulletinImages.includes(newBulletin.image) && (
                          <div className="relative"><img src={sanitizeUrl(newBulletin.image)} className="w-12 h-12 rounded-lg object-cover border border-gray-600" /><button type="button" onClick={() => setNewBulletin(p => ({ ...p, image: '' }))} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"><i className="fa-solid fa-xmark"></i></button></div>
                        )}
                        <div className="relative w-full sm:w-auto flex-shrink-0">
                          <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleBulletinImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                          <button type="button" className="w-full sm:w-auto px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-xl border border-gray-600 transition-colors flex items-center justify-center gap-2"><i className="fa-solid fa-cloud-arrow-up"></i> 自行上傳圖片</button>
                        </div>
                        {newBulletin.image && defaultBulletinImages.includes(newBulletin.image) && (
                          <button type="button" onClick={() => setNewBulletin(p => ({ ...p, image: '' }))} className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 bg-red-500/10 px-3 py-2 rounded-lg font-bold transition-colors">取消選取</button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 發布按鈕區塊 */}
                  <div className="flex-shrink-0 flex justify-end pb-1 md:pb-0">
                    <button onClick={handlePostBulletin} className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 h-fit whitespace-nowrap">
                      {newBulletin.id ? '儲存修改' : '發布招募'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-4 mb-6 border-b border-gray-700">
              <button onClick={() => setBulletinFilter('All')} className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${bulletinFilter === 'All' ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>全部招募</button>
              {activeBulletinTypes.map(t => (
                <button key={t} onClick={() => setBulletinFilter(t)} className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${bulletinFilter === t ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{t}</button>
              ))}
            </div>

            {filteredDisplayBulletins.length === 0 ? <p className="text-center text-gray-500 mt-20">目前沒有相關的招募文喔！</p> : <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{filteredDisplayBulletins.map(b => <BulletinCard key={b.id} b={b} user={user} isVerifiedUser={isVerifiedUser} onNavigateProfile={(vtuber, isFromApplicants) => { if (vtuber && vtuber.id) { if (isFromApplicants) setOpenBulletinModalId(b.id); else setOpenBulletinModalId(null); setSelectedVTuber(vtuber); navigate(`profile/${vtuber.id}`); } else { showToast("找不到該名片！"); } }} onApply={(id, isApplying) => handleApplyBulletin(id, isApplying, b.userId)} onInvite={handleOpenCollabModal} onDeleteBulletin={handleDeleteBulletin} onEditBulletin={handleEditBulletin} openModalId={openBulletinModalId} onClearOpenModalId={() => setOpenBulletinModalId(null)} />)}</div>}
          </div>
        )}

        {currentView === 'collabs' && (
          <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in-up">
            <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
              <h2 className="text-3xl font-extrabold text-white flex items-center gap-3"><i className="fa-solid fa-broadcast-tower text-red-400"></i> 確定聯動表</h2>
              {isVerifiedUser && (
                <button onClick={() => { document.getElementById('public-collab-form')?.classList.toggle('hidden'); }} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-transform hover:-translate-y-1">
                  <i className="fa-solid fa-plus mr-2"></i>發布聯動
                </button>
              )}
            </div>

            {isVerifiedUser && (
              <div id="public-collab-form" className="hidden bg-gray-800/40 border border-gray-700 rounded-3xl p-6 sm:p-8 shadow-2xl mb-10 animate-fade-in-up">
                <h3 className="text-xl font-bold text-white mb-6 border-b border-gray-700 pb-3">發布新的聯動行程</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                  <div><label className="text-sm font-bold text-gray-300 mb-2 block">聯動類別 <span className="text-red-400">*</span></label><select value={publicCollabForm.category} onChange={e => setPublicCollabForm({ ...publicCollabForm, category: e.target.value })} className={inputCls}>{COLLAB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label className="text-sm font-bold text-gray-300 mb-2 block">聯動時間 <span className="text-red-400">*</span></label><input type="datetime-local" lang="sv-SE" step="60" value={publicCollabForm.dateTime} onChange={e => setPublicCollabForm({ ...publicCollabForm, dateTime: e.target.value })} className={inputCls} /></div>
                  <div className="relative"><label className="text-sm font-bold text-gray-300 mb-2 block">直播連結 (可自動抓圖) <span className="text-red-400">*</span></label><div className="flex gap-2"><input type="url" placeholder="https://..." value={publicCollabForm.streamUrl} onChange={e => setPublicCollabForm({ ...publicCollabForm, streamUrl: e.target.value })} className={inputCls} /><button type="button" onClick={() => autoFetchYouTubeInfo(publicCollabForm.streamUrl, (t) => setPublicCollabForm(p => ({ ...p, title: t })), (c) => setPublicCollabForm(p => ({ ...p, coverUrl: c })), showToast)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 rounded-xl text-xs font-bold transition-colors"><i className="fa-solid fa-wand-magic-sparkles"></i></button></div></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                  <div><label className="text-sm font-bold text-gray-300 mb-2 block">聯動標題 <span className="text-red-400">*</span></label><input type="text" placeholder="輸入標題..." value={publicCollabForm.title} onChange={e => setPublicCollabForm({ ...publicCollabForm, title: e.target.value })} className={inputCls} /></div>
                  <div><label className="text-sm font-bold text-gray-300 mb-2 block">封面圖網址</label><input type="url" placeholder="自訂封面圖 (選填)..." value={publicCollabForm.coverUrl} onChange={e => setPublicCollabForm({ ...publicCollabForm, coverUrl: e.target.value })} className={inputCls} /></div>
                </div>

                {/* 搜尋成員區塊 */}
                <div className="bg-gray-900/80 p-4 rounded-2xl border border-purple-500/30 mb-6">
                  <label className="block text-sm font-bold text-purple-400 mb-3"><i className="fa-solid fa-users-plus mr-2"></i> 加入聯動成員 (搜尋站內名片)</label>

                  {/* 已選中的成員 */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(publicCollabForm.participants || []).map(uid => {
                      const vt = realVtubers.find(v => v.id === uid);
                      return vt ? (
                        <div key={uid} className="flex items-center gap-2 bg-purple-600/20 border border-purple-500/50 px-2 py-1 rounded-lg">
                          <img src={sanitizeUrl(vt.avatar)} className="w-5 h-5 rounded-full object-cover" />
                          <span className="text-xs text-white font-bold">{vt.name}</span>
                          <button type="button" onClick={() => setPublicCollabForm(p => ({ ...p, participants: p.participants.filter(id => id !== uid) }))} className="text-red-400 hover:text-red-300"><i className="fa-solid fa-xmark"></i></button>
                        </div>
                      ) : null;
                    })}
                  </div>

                  {/* 搜尋輸入框與結果 */}
                  <div className="relative">
                    <input type="text" placeholder="輸入成員名稱搜尋..." value={pSearch} onChange={e => setPSearch(e.target.value)} className={inputCls + " !bg-gray-800"} />
                    {pSearch && (
                      <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl max-h-40 overflow-y-auto">
                        {realVtubers
                          .filter(v => v.isVerified && (v.name || "").toLowerCase().includes(pSearch.toLowerCase()) && !(publicCollabForm.participants || []).includes(v.id) && v.id !== user?.uid)
                          .map(v => (
                            <div key={v.id} onClick={() => { setPublicCollabForm(p => ({ ...p, participants: [...(p.participants || []), v.id] })); setPSearch(''); }} className="flex items-center gap-3 p-2 hover:bg-purple-600/20 cursor-pointer border-b border-gray-700 last:border-0">
                              <img src={sanitizeUrl(v.avatar)} className="w-8 h-8 rounded-full object-cover" />
                              <span className="text-sm text-white">{v.name}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={async () => {
                    if (!publicCollabForm.dateTime || !publicCollabForm.streamUrl || !publicCollabForm.title) return showToast("請完整填寫必填欄位！");
                    const dt = new Date(publicCollabForm.dateTime);
                    if (dt.getTime() < Date.now()) return showToast("聯動時間不能在過去哦！");
                    const newCollabData = { ...publicCollabForm, date: `${dt.getMonth() + 1}/${dt.getDate()} (${['日', '一', '二', '三', '四', '五', '六'][dt.getDay()]})`, time: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`, startTimestamp: dt.getTime(), reminderSent: false };

                    try {
                      const docRef = await addDoc(collection(db, getPath('collabs')), { ...newCollabData, userId: user.uid, createdAt: Date.now() });

                      // 發送通知給參與者
                      publicCollabForm.participants.forEach(async (pId) => {
                        const target = realVtubers.find(v => v.id === pId);
                        if (!target) return;
                        await addDoc(collection(db, getPath('notifications')), {
                          userId: pId, fromUserId: user.uid, fromUserName: myProfile?.name || "系統", fromUserAvatar: myProfile?.avatar,
                          message: `您已被加入聯動行程：【${publicCollabForm.title}】！`, createdAt: Date.now(), read: false
                        });
                        if (target.publicEmail) {
                          await addDoc(collection(db, getPath('mail')), {
                            to: target.publicEmail,
                            message: { subject: `[V-Nexus] 聯動行程通知`, text: `您好 ${target.name}！\n\n「${myProfile?.name}」已將您加入聯動行程：${publicCollabForm.title}` }
                          });
                        }
                      });

                      setRealCollabs(prev => [...prev, { id: docRef.id, ...newCollabData, userId: user.uid }]);
                      showToast("✅ 已發布聯動行程！");
                      setPublicCollabForm({ dateTime: '', title: '', streamUrl: '', coverUrl: '', category: '遊戲', participants: [] });
                      document.getElementById('public-collab-form').classList.add('hidden');
                    } catch (err) { showToast("發布失敗"); }
                  }} className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105">送出發布</button>
                </div>
              </div>
            )}

            <div className="flex gap-4 mb-8">
              {['All', ...COLLAB_CATEGORIES].map(cat => <button key={cat} onClick={() => setCollabCategoryTab(cat)} className={`px-5 py-2 rounded-full font-bold text-sm transition-all ${collabCategoryTab === cat ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>{cat === 'All' ? '全部' : cat}</button>)}
            </div>

            {filteredDisplayCollabs.length === 0 ? (
              <div className="text-center py-20 bg-gray-800/30 rounded-3xl border border-gray-700"><p className="text-gray-500 font-bold text-lg"><i className="fa-solid fa-ghost mb-4 text-4xl block"></i>目前沒有即將到來的聯動行程</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredDisplayCollabs.map(c => (
                  <CollabCard
                    key={c.id}
                    c={c}
                    isLive={c.startTimestamp && currentTime >= c.startTimestamp && currentTime <= c.startTimestamp + (2 * 60 * 60 * 1000)}
                    isAdmin={isAdmin}
                    user={user}
                    onDeleteCollab={handleDeleteCollab}
                    vtuber={realVtubers.find(v => v.id === c.userId)}
                    realVtubers={realVtubers}
                    onShowParticipants={(collab) => setViewParticipantsCollab(collab)}
                    onNavigateProfile={(vt) => { setSelectedVTuber(vt); navigate(`profile/${vt.id}`); }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {currentView === 'match' && (
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

        {currentView === 'blacklist' && (
          <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in-up">
            <div className="bg-red-950/30 border border-red-900 rounded-3xl p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-orange-600 to-red-600"></div>
              <i className="fa-solid fa-skull-crossbones text-6xl text-red-500 mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]"></i>
              <h2 className="text-3xl sm:text-4xl font-black text-red-400 mb-4 tracking-widest">黑名單避雷區</h2>
              <p className="text-red-200/80 mb-8 max-w-2xl mx-auto leading-relaxed font-medium">只要倒讚數超過 10 個，該名片即會被系統自動移入此區並強制下架。<br className="hidden sm:block" />在此區的名片無法被一般使用者看見，也無法再發送任何邀約。<br /><span className="text-yellow-400 text-sm mt-2 block">如果發現有惡意洗倒讚的行為，請聯絡官方處理。</span></p>
              <div className="inline-block bg-black/50 border border-red-900 px-6 py-3 rounded-xl"><span className="text-gray-400 font-bold mr-2">目前黑單數量：</span><span className="text-2xl font-black text-red-500">{realVtubers.filter(v => v.isBlacklisted || v.dislikes >= 10).length}</span><span className="text-gray-500 text-sm ml-1">人</span></div>
            </div>
          </div>
        )}

        {currentView === 'admin' && isAdmin && (
          <AdminPage user={user} vtubers={realVtubers} bulletins={realBulletins} collabs={realCollabs} updates={realUpdates} rules={realRules} tips={realTips} privateDocs={privateDocs} onSaveSettings={handleSaveSettings} onDeleteVtuber={handleDeleteVtuber} onVerifyVtuber={handleVerifyVtuber} onRejectVtuber={handleRejectVtuber} onUpdateVtuber={handleAdminUpdateVtuber} onDeleteBulletin={handleDeleteBulletin} onAddCollab={handleAddCollab} onDeleteCollab={handleDeleteCollab} onAddUpdate={handleAddUpdate} onDeleteUpdate={handleDeleteUpdate} showToast={showToast} onResetAllCollabTypes={handleAdminResetAllCollabTypes} onResetNatAndLang={handleAdminResetNatAndLang} autoFetchYouTubeInfo={autoFetchYouTubeInfo} onMassSyncSubs={handleMassSyncSubs} onMassSyncTwitch={handleMassSyncTwitch} isSyncingSubs={isSyncingSubs} syncProgress={syncProgress} onSendMassEmail={handleSendMassEmail} defaultBulletinImages={defaultBulletinImages} onAddDefaultBulletinImage={handleAddDefaultBulletinImage} onDeleteDefaultBulletinImage={handleDeleteDefaultBulletinImage} onTestReminder={handleTestReminderSystem} onTestPush={handleTestPushNotification} />
        )}
      </main>

      {/* 站內信發送 Modal */}
      {isCollabModalOpen && selectedVTuber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up" onClick={() => setIsCollabModalOpen(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 p-6 flex flex-col items-center border-b border-gray-800">
              <img src={sanitizeUrl(selectedVTuber.avatar)} className="w-20 h-20 rounded-full border-4 border-gray-900 mb-3 object-cover shadow-lg" />
              <h3 className="text-xl font-bold text-white mb-1">邀請 {selectedVTuber.name} 聯動</h3>
              <p className="text-xs text-purple-300 bg-purple-900/40 px-3 py-1 rounded-full">對方主要時段：{formatSchedule(selectedVTuber)}</p>
            </div>
            <div className="p-6">
              <textarea rows="5" placeholder="嗨！我想邀請你一起玩..." value={inviteMessage} onChange={e => setInviteMessage(e.target.value)} className={inputCls + " resize-none mb-4"} />
              <div className="flex gap-3">
                <button onClick={() => setIsCollabModalOpen(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition-colors">取消</button>
                <button onClick={async () => {
                  if (!inviteMessage.trim()) return showToast("請輸入邀請內容！");
                  if (!myProfile) return showToast("請先建立並認證名片才能發信！");
                  if (inviteMessage.length > 500) return showToast("字數請控制在500字以內！");
                  const lastMsgKey = `last_msg_${user.uid}_${selectedVTuber.id}`;
                  const lastMsg = localStorage.getItem(lastMsgKey);
                  if (lastMsg && Date.now() - parseInt(lastMsg) < 60000) return showToast("發送太頻繁，請稍後再試。");
                  try {
                    await addDoc(collection(db, getPath('notifications')), { userId: selectedVTuber.id, fromUserId: user.uid, fromUserName: myProfile.name, fromUserAvatar: myProfile.avatar, message: inviteMessage, createdAt: Date.now(), read: false, type: 'collab_invite' });
                    if (selectedVTuber.publicEmail) {
                      await addDoc(collection(db, getPath('mail')), {
                        to: selectedVTuber.publicEmail,
                        message: {
                          subject: `[V-Nexus] 您收到來自 ${myProfile.name} 的站內信聯動邀約！`,
                          text: `您好，${selectedVTuber.name}！\n\n「${myProfile.name}」在 V-Nexus 上傳送了一封聯動邀約信件給您：\n\n"${inviteMessage}"\n\n請登入 V-Nexus https://www.vnexus2026.com/ 站內信箱查看並回覆對方吧！\n\n祝 聯動順利！\nV-Nexus 團隊`
                        }
                      }).catch(err => console.error("Mail Error:", err));
                    }
                    localStorage.setItem(lastMsgKey, Date.now().toString());
                    showToast("✅ 邀請已發送！");
                    setIsCollabModalOpen(false); setInviteMessage('');
                  } catch (err) { showToast("發送失敗"); }
                }} className="flex-[2] bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105">送出邀約</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 規範 Modal */}
      {isRulesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up" onClick={() => setIsRulesModalOpen(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-red-900/30 p-5 border-b border-red-900/50 flex justify-between items-center"><h3 className="text-xl font-bold text-red-400 flex items-center gap-2"><i className="fa-solid fa-triangle-exclamation"></i> 聯動規範</h3><button onClick={() => setIsRulesModalOpen(false)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button></div>
            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar"><div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">{realRules}</div></div>
            <div className="p-4 border-t border-gray-800 text-center"><button onClick={() => setIsRulesModalOpen(false)} className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-2.5 rounded-xl font-bold transition-colors w-full sm:w-auto">我了解了</button></div>
          </div>
        </div>
      )}

      {/* 邀約小技巧 Modal */}
      {isTipsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up" onClick={() => setIsTipsModalOpen(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-yellow-900/30 p-5 border-b border-yellow-900/50 flex justify-between items-center"><h3 className="text-xl font-bold text-yellow-400 flex items-center gap-2"><i className="fa-solid fa-lightbulb"></i> 邀約小技巧</h3><button onClick={() => setIsTipsModalOpen(false)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button></div>
            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm mb-6">{realTips}</div>
              <div className="bg-gray-800/80 p-4 rounded-xl border border-gray-700"><p className="text-xs text-gray-500 mb-2 font-bold">複製公版邀約詞 (可自行修改)</p><div className="bg-black/50 p-3 rounded-lg text-sm text-gray-300 font-mono mb-3 select-all">您好，我是 OOO！\n近期想規劃一個 [遊戲/企劃] 的聯動，\n想請問是否有榮幸能邀請您一起參與呢？\n時間預計在 OO/OO，詳細企劃案如下...\n期待您的回覆！</div><button onClick={() => { navigator.clipboard.writeText("您好，我是 OOO！\n近期想規劃一個 [遊戲/企劃] 的聯動，\n想請問是否有榮幸能邀請您一起參與呢？\n時間預計在 OO/OO，詳細企劃案如下...\n期待您的回覆！"); setCopiedTemplate(true); setTimeout(() => setCopiedTemplate(false), 2000); }} className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg font-bold transition-colors text-sm">{copiedTemplate ? '✅ 已複製！' : '📋 點擊複製'}</button></div>
            </div>
          </div>
        </div>
      )}

      {/* 最新消息 Modal */}
      {isUpdatesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up" onClick={() => { setIsUpdatesModalOpen(false); handleMarkAllUpdatesRead(); }}>
          <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="bg-blue-900/30 p-5 border-b border-blue-900/50 flex justify-between items-center"><h3 className="text-xl font-bold text-blue-400 flex items-center gap-2"><i className="fa-solid fa-bullhorn"></i> 最新消息與功能發布</h3><button onClick={() => { setIsUpdatesModalOpen(false); handleMarkAllUpdatesRead(); }} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button></div>
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
              {realUpdates.length === 0 ? <p className="text-center text-gray-500">目前沒有新消息。</p> : realUpdates.map(u => (
                <div key={u.id} className="relative">
                  {!readUpdateIds.includes(u.id) && <span className="absolute -left-2 top-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                  <h4 className="font-bold text-white text-lg mb-1">{u.title}</h4>
                  <p className="text-xs text-blue-400 mb-2 font-mono">{u.date}</p>
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{u.content}</p>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-800 bg-gray-900/90 text-center"><button onClick={() => { setIsUpdatesModalOpen(false); handleMarkAllUpdatesRead(); }} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl font-bold transition-colors w-full sm:w-auto shadow-lg">知道了</button></div>
          </div>
        </div>
      )}

      {/* 審核結果通知 Modal */}
      {user && myProfile && myProfile.showVerificationModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in-up">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-md p-8 text-center shadow-2xl relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-2 ${myProfile.showVerificationModal === 'approved' ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-orange-500'}`}></div>
            <div className="mb-6"><div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${myProfile.showVerificationModal === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}><i className={`fa-solid ${myProfile.showVerificationModal === 'approved' ? 'fa-check text-4xl' : 'fa-xmark text-5xl'}`}></i></div></div>
            <h2 className="text-2xl font-extrabold text-white mb-4">{myProfile.showVerificationModal === 'approved' ? '名片審核通過！' : '名片審核未通過'}</h2>
            {myProfile.showVerificationModal === 'approved' ? (<p className="text-gray-200 text-lg font-bold leading-relaxed mb-8">恭喜你審核通過！<br />開始尋找聯動夥伴吧！</p>) : (<p className="text-gray-300 text-sm leading-relaxed mb-8 text-left">很抱歉，目前不開放YT訂閱或TWITCH追隨加起來低於500、尚未出道、長期準備中、一個月以上未有直播活動之Vtuber或經紀人加入，敬請見諒。如果以上你都有達到，那就是你沒有將V-Nexus審核中放入你的X或YT簡介內，無法審核成功喔！<br /><br />請繼續加油！</p>)}
            <div className="flex justify-center">
              {myProfile.showVerificationModal === 'approved' ? (<button onClick={async () => { await updateDoc(doc(db, getPath('vtubers'), myProfile.id), { showVerificationModal: null }); setRealVtubers(prev => prev.map(v => v.id === myProfile.id ? { ...v, showVerificationModal: null } : v)); navigate('grid'); }} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg w-full">開始找夥伴</button>) : (<button onClick={async () => { await updateDoc(doc(db, getPath('vtubers'), myProfile.id), { showVerificationModal: null }); setRealVtubers(prev => prev.map(v => v.id === myProfile.id ? { ...v, showVerificationModal: null } : v)); }} className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-8 py-3 rounded-xl font-bold transition-colors w-full">我了解了</button>)}
            </div>
          </div>
        </div>
      )}

      {/* 招募成功排行榜 Modal */}
      {isLeaderboardModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up" onClick={() => setIsLeaderboardModalOpen(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="bg-yellow-900/30 p-5 border-b border-yellow-900/50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-yellow-400 flex items-center gap-2"><i className="fa-solid fa-trophy"></i> 招募成功排行榜</h3>
              <button onClick={() => setIsLeaderboardModalOpen(false)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-3">
              {leaderboardData.length === 0 ? <p className="text-center text-gray-500 py-10">目前還沒有人達成招募目標喔！<br />趕快成為第一個吧！</p> : leaderboardData.map((vt, idx) => (
                <div key={vt.id || idx} className={`flex items-center gap-4 p-3 rounded-xl border ${idx === 0 ? 'bg-yellow-500/20 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : idx === 1 ? 'bg-gray-300/20 border-gray-300/50 shadow-[0_0_10px_rgba(209,213,219,0.2)]' : idx === 2 ? 'bg-orange-500/20 border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.2)]' : 'bg-gray-800/50 border-gray-700'}`}>
                  <div className="w-8 text-center flex-shrink-0">
                    {idx === 0 ? <i className="fa-solid fa-crown text-2xl text-yellow-400"></i> : idx === 1 ? <i className="fa-solid fa-medal text-xl text-gray-300"></i> : idx === 2 ? <i className="fa-solid fa-award text-xl text-orange-400"></i> : <span className="text-gray-500 font-bold">{idx + 1}</span>}
                  </div>
                  <img src={sanitizeUrl(vt.avatar)} className={`w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 ${idx === 0 ? 'border-yellow-400' : idx === 1 ? 'border-gray-300' : idx === 2 ? 'border-orange-400' : 'border-gray-600'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold truncate ${idx === 0 ? 'text-yellow-400 text-lg' : idx === 1 ? 'text-gray-200 text-base' : idx === 2 ? 'text-orange-300 text-base' : 'text-gray-300 text-sm'}`}>{vt.name}</p>
                    <p className="text-xs text-gray-500">累積成功次數</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={`font-black text-2xl ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-orange-400' : 'text-gray-400'}`}>{vt.successCount}</span>
                    <span className="text-xs text-gray-500 ml-1">次</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-800 bg-gray-900/90 text-center"><button onClick={() => setIsLeaderboardModalOpen(false)} className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-2.5 rounded-xl font-bold transition-colors w-full sm:w-auto shadow-lg">關閉</button></div>
          </div>
        </div>
      )}

      {/* 倒讚確認 Modal */}
      {confirmDislikeData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up" onClick={() => setConfirmDislikeData(null)}>
          <div className="bg-gray-900 border border-red-500/50 rounded-3xl w-full max-w-md p-8 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <i className="fa-solid fa-triangle-exclamation text-5xl text-red-500 mb-4"></i>
            <h3 className="text-xl font-bold text-white mb-2">確定要對 {confirmDislikeData.name} 送出倒讚？</h3>
            <p className="text-gray-400 text-sm mb-6">倒讚功能僅用於檢舉「負面行為」或「惡意騷擾」。<br />若該名片累積超過 10 個倒讚將自動下架。</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDislikeData(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition-colors">取消</button>
              <button onClick={handleConfirmDislike} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105">確定送出</button>
            </div>
          </div>
        </div>
      )}
      {/* 聯動成員名單彈窗 */}
      {viewParticipantsCollab && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setViewParticipantsCollab(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md flex flex-col max-h-[80vh] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-gray-900/95 backdrop-blur px-6 py-4 border-b border-gray-800 flex justify-between items-center z-10">
              <h3 className="font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-users text-purple-400"></i> 聯動參與成員
              </h3>
              <button onClick={() => setViewParticipantsCollab(null)} className="text-gray-400 hover:text-white">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">

              {(viewParticipantsCollab.participants || []).map(pId => {
                const vt = realVtubers.find(v => v.id === pId);
                if (!vt) return null;
                return (
                  <div
                    key={vt.id}
                    className="flex items-center justify-between bg-gray-800/50 p-3 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-all cursor-pointer group"
                    onClick={() => {
                      setSelectedVTuber(vt);
                      navigate(`profile/${vt.id}`);
                      setViewParticipantsCollab(null);
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <img src={sanitizeUrl(vt.avatar)} className="w-12 h-12 rounded-full object-cover border-2 border-gray-700 group-hover:border-purple-400 transition-colors" />
                      <div>
                        <p className="font-bold text-white text-sm group-hover:text-purple-300 transition-colors">{vt.name}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{vt.agency} | 點擊查看名片</p>
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
      <footer className="py-6 border-t border-gray-800 text-center text-gray-500 text-sm"><p>© {new Date().getFullYear()} V-Nexus. 專為 VTuber 打造的聯動平台。</p></footer>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
