// إدارة رموز الاشتراكات بالوقت الفعلي لكافيه "أنا وإياك"
import { 
  db, 
  isMock, 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  query,
  orderBy
} from "./firebase.js";

class AdminSubscriptionsPanel {
  constructor() {
    this.subscriptions = [];
    this.init();
  }

  init() {
    this.setupRealtimeSubscriptions();
    this.setupFormListeners();
  }

  // ==========================================
  // 1. جلب وتحديث رموز الاشتراك بالوقت الفعلي
  // ==========================================
  setupRealtimeSubscriptions() {
    if (isMock) {
      // محاكاة سحابية محلية بالـ LocalStorage
      const pollAndRender = () => {
        this.subscriptions = JSON.parse(localStorage.getItem("mock_subscriptions")) || [];
        this.renderSubscriptions();
      };
      
      pollAndRender();
      this.pollInterval = setInterval(pollAndRender, 1500);
      return;
    }

    // الربط مع كوكيز وقاعدة بيانات Firestore الحقيقية
    try {
      const q = query(collection(db, "subscriptions"), orderBy("createdAt", "desc"));
      onSnapshot(q, (snapshot) => {
        const items = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() });
        });
        this.subscriptions = items;
        this.renderSubscriptions();
      }, (error) => {
        console.warn("Firestore Subscriptions Listen Error, falling back to mock:", error);
        this.subscriptions = JSON.parse(localStorage.getItem("mock_subscriptions")) || [];
        this.renderSubscriptions();
      });
    } catch (error) {
      console.error("Firestore Subscriptions Listen Error:", error);
    }
  }

  // ==========================================
  // 2. تفعيل المستمعات والأزرار التفاعلية
  // ==========================================
  setupFormListeners() {
    // توليد كود عشوائي جديد عند الضغط على الزر
    const genBtn = document.getElementById("generate-code-btn");
    if (genBtn) {
      genBtn.addEventListener("click", () => {
        const generated = "ANA-SUB-" + Math.floor(100000 + Math.random() * 900000);
        const codeInput = document.getElementById("sub-code");
        if (codeInput) {
          codeInput.value = generated;
          this.showToast("تم توليد رمز اشتراك عشوائي مميز!");
        }
      });
    }

    // تسليم الفورم بالكامل للعميل والمدير
    const form = document.getElementById("subscription-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const ownerName = document.getElementById("sub-owner").value.trim();
        const contact = document.getElementById("sub-contact").value.trim();
        const code = document.getElementById("sub-code").value.trim().toUpperCase();

        if (!ownerName || !contact || !code) {
          alert("يرجى ملء جميع الحقول المطلوبة بالكامل.");
          return;
        }

        // فحص مسبق لمنع تكرار الرموز نهائياً بالمؤسسة
        const exists = this.subscriptions.some(s => s.code === code);
        if (exists) {
          alert("❌ رمز الاشتراك هذا مكرر ومسجل لزبون آخر بالفعل! يرجى توليد رمز جديد أو تغييره.");
          return;
        }

        const subData = {
          code: code,
          ownerName: ownerName,
          contact: contact,
          createdAt: isMock ? { seconds: Math.floor(Date.now() / 1000) } : new Date().toISOString()
        };

        if (isMock) {
          const mSubs = JSON.parse(localStorage.getItem("mock_subscriptions")) || [];
          const newId = "sub-" + Date.now();
          mSubs.unshift({ ...subData, id: newId });
          localStorage.setItem("mock_subscriptions", JSON.stringify(mSubs));
          this.subscriptions = mSubs;
          this.showToast("تم إنشاء وتعميد رمز الاشتراك بنجاح في النظام!");
        } else {
          try {
            await addDoc(collection(db, "subscriptions"), subData);
            this.showToast("تم إنشاء وتعميد رمز الاشتراك السحابي بنجاح!");
          } catch (err) {
            console.error("Firestore Save Subscription Error", err);
            this.showToast("فشلت عملية الحفظ على السحابة.");
          }
        }

        form.reset();
        this.renderSubscriptions();
      });
    }

    // ربط ميثودات الحذف والنسخ بالمدير عالمياً
    window.adminPanelSub = {
      deleteSub: (id) => this.deleteSubscription(id),
      copySubCode: (code) => this.copySubscriptionCode(code)
    };
  }

  // ==========================================
  // 3. عرض رموز الاشتراك النشطة بالجدول (Render UI)
  // ==========================================
  renderSubscriptions() {
    const tableBody = document.getElementById("subscriptions-table-body");
    const countBadge = document.getElementById("sub-count-badge");
    if (!tableBody) return;

    if (countBadge) countBadge.textContent = `${this.subscriptions.length} كود فعال`;

    if (this.subscriptions.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" class="py-12 text-center text-slate-500">
            لا توجد رموز اشتراكات سارية أو مخزنة بالبوابة حالياً. أنشئ الرمز الأول الآن!
          </td>
        </tr>
      `;
      return;
    }

    let html = "";
    this.subscriptions.forEach(sub => {
      html += `
        <tr class="border-b border-slate-900 hover:bg-slate-900/30 transition duration-150">
          <td class="py-3.5 text-right font-bold text-white max-w-[120px] truncate" title="${sub.ownerName}">
            ${sub.ownerName}
          </td>
          <td class="py-3.5 text-right font-mono font-bold text-amber-400 select-all">
            ${sub.code}
          </td>
          <td class="py-3.5 text-center font-mono text-slate-350 text-[11px]">
            ${sub.contact}
          </td>
          <td class="py-3.5 text-left">
            <div class="flex items-center gap-1.5">
              <button onclick="window.adminPanelSub.copySubCode('${sub.code}')" 
                      class="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-md text-[10px] font-bold border border-slate-800 transition flex items-center gap-1 cursor-pointer">
                <span>نسخ الرمز</span>
              </button>
              <button onclick="window.adminPanelSub.deleteSub('${sub.id || sub.code}')" 
                      class="p-1 px-2 bg-red-950/25 hover:bg-red-550/15 text-red-400 hover:text-red-300 rounded-md text-[10px] font-bold border border-transparent hover:border-red-500/20 transition cursor-pointer">
                <span>تعطيل</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  }

  // ==========================================
  // 4. العمليات الإدارية (نسخ الكود، الحذف والتعطيل)
  // ==========================================
  copySubscriptionCode(code) {
    navigator.clipboard.writeText(code)
      .then(() => this.showToast(`📋 تم نسخ الكود الجاهز: ${code}`))
      .catch(err => {
        console.error("Clipboard Error", err);
        alert(`كود الاشتراك الخاص بالعميل هو: ${code}`);
      });
  }

  async deleteSubscription(subId) {
    if (!confirm("⚠️ هل أنت متأكد من رغبتك في تعطيل وإلغاء رمز الاشتراك هذا لفرع الزبون؟ لن يتمكن من استخدامه بالدفع مجدداً.")) {
      return;
    }

    if (isMock) {
      let mSubs = JSON.parse(localStorage.getItem("mock_subscriptions")) || [];
      mSubs = mSubs.filter(sub => (sub.id !== subId && sub.code !== subId));
      localStorage.setItem("mock_subscriptions", JSON.stringify(mSubs));
      this.subscriptions = mSubs;
      this.showToast("تم تعطيل وإلغاء رمز الاشتراك بنجاح.");
    } else {
      try {
        await deleteDoc(doc(db, "subscriptions", subId));
        this.showToast("تم إلغاء وشطب الاشتراك الفعال من خوادم السحابة!");
      } catch (err) {
        console.error("Firestore Delete Subscription Error", err);
        this.showToast("فشلت عملية الإلغاء السحابية.");
      }
    }

    this.renderSubscriptions();
  }

  // إظهار التنبيهات المنزلقة (Toasts UI)
  showToast(message) {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "fixed bottom-6 right-6 left-6 sm:left-auto z-50 flex flex-col gap-2 pointer-events-none";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "glass-panel bg-slate-900 border border-amber-500/30 text-white px-5 py-3.5 rounded-xl shadow-xl slide-in-left pointer-events-auto flex items-center justify-between gap-3 text-sm font-semibold max-w-sm font-Cairo";
    toast.innerHTML = `
      <span>${message}</span>
      <button onclick="this.parentElement.remove()" class="text-amber-400 hover:text-amber-300 font-bold">×</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("opacity-0", "transition-all", "duration-500");
      setTimeout(() => toast.remove(), 500);
    }, 3500);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new AdminSubscriptionsPanel();
});
