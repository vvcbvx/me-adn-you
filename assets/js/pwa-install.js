/**
 * PWA Install Prompt - أنا وإياك
 * Handles showing the PWA installation button for mobile platforms (Android and iOS).
 */

let deferredPrompt;

// Check if app is already running in standalone mode (installed)
const isRunningStandalone = () => {
  return window.matchMedia('(display-mode: standalone)').matches || 
         navigator.standalone || 
         document.referrer.includes('android-app://');
};

// Check if device is iOS (iPhone/iPad)
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

// Check if device is mobile
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  
  // Show PWA install banner on mobile
  if (isMobileDevice() && !isRunningStandalone()) {
    showPWAInstallBanner('android');
  }
});

// Run this on load to check for iOS installation prompt
window.addEventListener('load', () => {
  // iOS doesn't fire beforeinstallprompt. We show instructions if they are on mobile Safari and not installed.
  if (isMobileDevice() && isIOS() && !isRunningStandalone()) {
    // Only show if they haven't dismissed it in this session
    if (!sessionStorage.getItem('dismissed-pwa-banner-ios')) {
      showPWAInstallBanner('ios');
    }
  }
});

function showPWAInstallBanner(platform) {
  // Remove existing banner if present
  const existing = document.getElementById('pwa-install-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.className = 'fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 bg-slate-950/95 border border-amber-500/30 backdrop-blur-xl p-4 rounded-2xl shadow-2xl shadow-black/80 flex flex-col gap-3 font-Cairo animate-slide-up transform transition-all duration-300';
  
  if (platform === 'android') {
    banner.innerHTML = `
      <div class="flex items-start gap-3">
        <img src="/app-icon.jpg" alt="أنا وإياك" class="w-11 h-11 rounded-xl object-cover border border-amber-500/20">
        <div class="flex-1">
          <h4 class="text-xs font-black text-white">تثبيت تطبيق "أنا وإياك"</h4>
          <p class="text-[10px] text-slate-400 mt-1">تصفح القائمة السريعة واطلب مشروبك المفضل بسهولة بنقرة واحدة من شاشتك الرئيسية!</p>
        </div>
      </div>
      <div class="flex items-center gap-2 mt-1">
        <button id="pwa-install-btn" class="flex-1 py-1.5 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-[11px] rounded-xl shadow-lg transition-transform active:scale-95 duration-200">
          تثبيت التطبيق الآن 📱
        </button>
        <button id="pwa-close-btn" class="py-1.5 px-3 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-bold text-[11px] rounded-xl transition-all">
          لاحقاً
        </button>
      </div>
    `;
  } else if (platform === 'ios') {
    banner.innerHTML = `
      <div class="flex items-start gap-3">
        <img src="/app-icon.jpg" alt="أنا وإياك" class="w-11 h-11 rounded-xl object-cover border border-amber-500/20">
        <div class="flex-1">
          <h4 class="text-xs font-black text-white">إضافة تطبيق "أنا وإياك" للايفون</h4>
          <p class="text-[10px] text-slate-400 mt-1">لتثبيت التطبيق على جهازك: انقر على زر المشاركة <span class="bg-slate-900 p-0.5 px-1 rounded text-white font-mono">⎋</span> ثم اختر <span class="text-amber-400 font-bold">"إضافة إلى الصفحة الرئيسية ⊞"</span>.</p>
        </div>
      </div>
      <div class="flex items-center gap-2 mt-1">
        <button id="pwa-close-btn" class="w-full py-1.5 px-3 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-black text-[11px] rounded-xl text-center">
          حسناً، فهمت
        </button>
      </div>
    `;
  }

  document.body.appendChild(banner);

  // Hook event handlers
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      // We've used the prompt, and can't use it again
      deferredPrompt = null;
      banner.remove();
    });
  }

  const closeBtn = document.getElementById('pwa-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (platform === 'ios') {
        sessionStorage.setItem('dismissed-pwa-banner-ios', 'true');
      }
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(15px)';
      setTimeout(() => banner.remove(), 300);
    });
  }
}

// =========================================================================
// نظام مراقبة جودة الاتصال وخادم كافيه "أنا وإياك" الذكي (Smart Connection Monitor)
// =========================================================================

function initConnectionMonitor() {
  let offlineOverlay = null;

  // حقن الأنماط المتحركة المخصصة للتحقق من الاتصال لضماتها بشكل مستقل
  const offlineStyleId = 'offline-monitor-styles';
  if (!document.getElementById(offlineStyleId)) {
    const style = document.createElement('style');
    style.id = offlineStyleId;
    style.textContent = `
      @keyframes offline-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes offline-slide-up {
        from { transform: translateY(20px) scale(0.95); opacity: 0; }
        to { transform: translateY(0) scale(1); opacity: 1; }
      }
      @keyframes offline-shake {
        0%, 100% { transform: translateX(0); }
        15%, 45%, 75% { transform: translateX(-8px); }
        30%, 60%, 90% { transform: translateX(8px); }
      }
      .animate-fade-in {
        animation: offline-fade-in 0.3s ease-out forwards;
      }
      .animate-slide-up {
        animation: offline-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      .animate-shake {
        animation: offline-shake 0.5s ease-in-out;
      }
    `;
    document.head.appendChild(style);
  }

  async function pingServer() {
    try {
      // إرسال طلب خفيف للتحقق من استجابة خادم كافية "أنا وإياك" الفعلي
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 ثواني كحد أقصى
      
      const response = await fetch('/?_ping=' + Date.now(), {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);
      return response.ok || response.status < 500;
    } catch (err) {
      return false;
    }
  }

  async function checkConnectionAndShowScreen(forceCheck = false) {
    // إزالة السقوط القسري ليعتمد فقط على الحالة الحقيقية للاتصال
    localStorage.removeItem("ana_forced_developer_fall");

    const isBrowserOnline = navigator.onLine;
    
    // إذا كان المتصفح غير متصل بالشبكة أساساً
    if (!isBrowserOnline) {
      showOfflineScreen("offline");
      return;
    }

    // إذا كان متصلاً بالمتصفح، نتحقق من استجابة الخادم السحابي فعلاً
    if (forceCheck || !offlineOverlay) {
      const isServerResponding = await pingServer();
      if (!isServerResponding) {
        showOfflineScreen("server-down");
      } else {
        hideOfflineScreen();
      }
    }
  }

  function showOfflineScreen(type) {
    if (document.getElementById('offline-fall-screen')) {
      if (type === "offline" || type === "server-down") {
        document.getElementById('offline-fall-screen').remove();
        offlineOverlay = null;
      } else {
        return;
      }
    }

    offlineOverlay = document.createElement('div');
    offlineOverlay.id = 'offline-fall-screen';
    offlineOverlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/98 backdrop-blur-lg p-4 font-Cairo select-none animate-fade-in transition-all duration-300';
    
    let heading = "انقطع دفء القهوة! ☕🌐";
    let desc = "يبدو أنك غير متصل بالإنترنت حالياً أو أن الخادم السحابي الخاص بكافيه <b>'أنا وإياك'</b> متوقف للتو. نحن بانتظار عودتك بفارغ الصبر لنثري تصفحك بالمنتجات الطازجة.";
    let statusText = "الشبكة المحلية: متصلة 🟢 | خادم السحابة: متوقف عن العمل 🔴";

    if (type === "offline") {
      heading = "انقطع اتصال الإنترنت! 🔌🚫";
      desc = "جهازك غير متصل بالشبكة المحلية حالياً. يرجى تفعيل بيانات الهاتف المحمول أو الاتصال بـ Wi-Fi لتتمكن من حجز طلباتك الساخنة والباردة.";
      statusText = "الشبكة المحلية: غير متصلة 🔴 | خادم السحابة: لا يمكن فحصه ⚠";
    }

    offlineOverlay.innerHTML = `
      <div id="offline-card" class="max-w-md w-full glass-panel border border-amber-500/25 bg-slate-900/90 text-center p-8 rounded-3xl shadow-2xl shadow-black/80 flex flex-col items-center gap-6 transform scale-95 transition-all duration-500 animate-slide-up">
        
        <!-- أيقونة انقطاع الاتصال المشعة المضيئة -->
        <div class="relative w-20 h-20 bg-slate-950/80 rounded-full border border-red-500/30 flex items-center justify-center p-4 shadow-xl shadow-red-500/5 animate-pulse">
          <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18M10.268 5.732a10.268 10.268 0 0110.463 3.535M7.671 8.329a6.269 6.269 0 017.514 1.157M5.074 10.926a3.504 3.504 0 013.852-1.928M12 18h.01M9 15h.01M15 15h.01"></path>
          </svg>
          <div class="absolute -inset-1 rounded-full bg-red-500/10 blur-md -z-10 animate-ping"></div>
        </div>

        <div class="space-y-3">
          <h2 class="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 tracking-tight leading-8">${heading}</h2>
          <p class="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto font-medium">${desc}</p>
        </div>

        <!-- حالة التشخيص الدقيقة -->
        <div class="w-full bg-slate-950/60 border border-slate-850 py-2 px-4 rounded-xl">
          <p class="text-[10px] text-amber-500/80 font-mono font-bold tracking-wider" dir="ltr">${statusText}</p>
        </div>

        <!-- زر إعادة المحاولة الفعال -->
        <button id="offline-retry-btn" class="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all active:scale-[0.98] duration-200 cursor-pointer flex items-center justify-center gap-2">
          <span>تنشيط والتحقق من الاتصال فورا</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3"></path>
          </svg>
        </button>

      </div>
    `;

    document.body.appendChild(offlineOverlay);

    // ربط ميثود التحديث وزر المحاولة
    const retryBtn = document.getElementById('offline-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', async () => {
        // تأثير التحميل المؤقت
        retryBtn.disabled = true;
        retryBtn.classList.add('opacity-70', 'cursor-not-allowed');
        const originalText = retryBtn.innerHTML;
        retryBtn.innerHTML = `
          <svg class="animate-spin h-4 w-4 text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          جاري فحص حالة السيرفر...
        `;

        const isOk = await pingServer();
        if (isOk) {
          hideOfflineScreen();
          // عرض إشعار سريع يفيد بالعودة بنجاح
          if (window.showNotification) {
            window.showNotification("🟢 تم استعادة الاتصال بالخادم بنجاح! متواجدون لخدمتكم.", "success");
          }
        } else {
          // تأثير اهتزاز الكارت دليلاً على الفشل
          const card = document.getElementById('offline-card');
          if (card) {
            card.classList.add('animate-shake');
            setTimeout(() => card.classList.remove('animate-shake'), 600);
          }
          // استعادة حالة الزر
          retryBtn.disabled = false;
          retryBtn.classList.remove('opacity-70', 'cursor-not-allowed');
          retryBtn.innerHTML = originalText;
        }
      });
    }
  }

  function hideOfflineScreen() {
    const screen = document.getElementById('offline-fall-screen');
    if (screen) {
      screen.style.opacity = '0';
      const card = document.getElementById('offline-card');
      if (card) {
        card.style.transform = 'scale(0.9) translateY(15px)';
      }
      setTimeout(() => screen.remove(), 300);
      offlineOverlay = null;
    }
  }

  // مستمعين الأحداث المباشرين من المتصفح
  window.addEventListener('online', () => checkConnectionAndShowScreen(true));
  window.addEventListener('offline', () => showOfflineScreen("offline"));
  window.addEventListener('focus', () => checkConnectionAndShowScreen(false));

  // بدء الفحص والمراقبة الفوري عند تحميل الصفحة بعد ثوان قليلة
  setTimeout(() => checkConnectionAndShowScreen(false), 1500);

  // فحص دوري ذكي في الخلفية كل 20 ثانية صامت للتأكد من حالة الخادم دون تطفل
  setInterval(() => {
    if (!offlineOverlay) {
      pingServer().then(online => {
        if (!online) {
          showOfflineScreen("server-down");
        }
      });
    }
  }, 20000);
}

// تشغيل النظام على الفور عند تحميل الموديل
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initConnectionMonitor();
  });
} else {
  initConnectionMonitor();
}

