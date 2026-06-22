// نظام إدارة السلة بالكامل لكافيه "أنا وإياك"
// يحفظ السلة في الـ LocalStorage ويوفر واجهة وسيطة تفاعلية

// الغاء تحويل المشرف والسماح له بتصفح واجهة الموقع العامة مع شريط العودة السهل للإدارة
if (localStorage.getItem("mock_admin_logged") === "true") {
  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("admin-preview-floating-bar")) return;

    const adminBar = document.createElement("div");
    adminBar.id = "admin-preview-floating-bar";
    adminBar.className = "fixed bottom-5 left-5 z-[99999] flex items-center gap-3 bg-slate-900/95 backdrop-blur-xl border border-amber-500/40 p-3 px-4 rounded-2xl shadow-[0_12px_45px_rgba(245,158,11,0.2)] font-Cairo text-xs text-white text-right select-none animate-bounce hover:animate-none transition-all duration-300";
    
    let dashboardPath = "/admin/dashboard.html";
    const currentRole = localStorage.getItem("admin_role") || "full";
    if (currentRole === "products") {
      dashboardPath = "/admin/products.html";
    } else if (currentRole === "orders") {
      dashboardPath = "/admin/orders.html";
    }

    adminBar.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="flex h-2.5 w-2.5 relative">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
        </span>
        <span class="font-bold text-amber-400">تصفح بصفتك مشرف كافيه ☕</span>
      </div>
      <div class="h-4 w-[1px] bg-slate-800"></div>
      <a href="${dashboardPath}" class="flex items-center gap-1 bg-amber-500 hover:bg-amber-450 hover:scale-[1.03] text-slate-950 font-black rounded-xl p-1.5 px-3 shadow transition-all duration-205">
        <span>العودة للوحة الإدارة ⬅️</span>
      </a>
    `;
    document.body.appendChild(adminBar);
  });
}

// فحص الاتصال بالخادم للكشف الفوري عن انقطاع الشبكة أو إيقاف التطبيق والخدمات محلياً
async function checkServerOfflineStatus() {
  const showOfflineScreen = () => {
    if (document.getElementById("offline-crash-screen")) return; // معروض ومنشط في الصفحة

    const crashScreen = document.createElement("div");
    crashScreen.id = "offline-crash-screen";
    // شاشة كاملة مصممة بفخامة بالغة تعكس طابع السحر والاحتراف السحابي
    crashScreen.className = "fixed inset-0 z-[999999] bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none font-Cairo overflow-y-auto animate-fade-in";
    crashScreen.innerHTML = `
      <div class="w-full max-w-sm bg-slate-900 border-2 border-red-500/40 rounded-[2.5rem] p-6 shadow-[0_0_55px_rgba(239,68,68,0.22)] space-y-6 relative overflow-hidden">
        
        <!-- حزام فخم مستدير مرن لرمز وصورة المطور أبو راشد -->
        <div class="relative w-36 h-36 mx-auto rounded-full p-1 bg-gradient-to-tr from-amber-500 to-red-600 shadow-2xl animate-pulse">
          <img src="/aborashid.jpg" alt="المطور أبو راشد" 
               class="w-full h-full object-cover rounded-full border-4 border-slate-900" 
               onerror="this.src='https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=500'">
        </div>

        <div class="space-y-2">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/15 text-red-400 border border-red-500/20 text-[10px] font-black rounded-lg">
            🚨 تفعيل وضع السقوط والطوارئ المحلي
          </span>
          <h2 class="text-white text-base font-black">تم إيقاف التطبيق من قبل المطور</h2>
          <p class="text-slate-400 text-xs leading-relaxed font-semibold">
            عذراً، انقطع اتصال التطبيق بالخلفية أو تم تعطيل خدمات كافيه أنا وإياك مؤقتاً من قبل المطور أبو راشد. يمكنك المحاولة مجدداً أو الاتصال بنا فوراً للحل.
          </p>
        </div>

        <!-- أزرار التواصل الحقيقية متلائمة مع الهاتف -->
        <div class="space-y-2.5 pt-3 border-t border-slate-850">
          <a href="https://wa.me/963956979465" target="_blank" 
             class="w-full py-3 h-12 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-555 active:scale-[0.98] text-white font-black rounded-2xl text-xs shadow-lg transition duration-200">
            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.022-.015-.072-.03-.142-.065s-.35-.173-.41-.195c-.06-.023-.1-.035-.143.03-.043.065-.168.21-.206.253a.51.51 0 01-.354.12c-.06-.015-.253-.086-.481-.287a2.204 2.204 0 01-.384-.337 1.408 1.408 0 01-.1-.137.525.525 0 01.033-.188c.015-.015.033-.035.051-.055s.03-.03.045-.05.022-.05.03-.095a.3.3 0 00-.015-.143c-.008-.035-.143-.346-.195-.473a.807.807 0 00-.143-.131h-.03a.571.571 0 00-.285-.05c-.095 0-.253.035-.385.176a1.992 1.992 0 00-.54 1.341c0 .878.64 1.727.728 1.847s1.238 1.895 2.996 2.654c1.472.637 1.77.51 2.396.452.628-.058 2.015-.824 2.3-1.583a1.865 1.865 0 00.128-.823c-.023-.04-.083-.06-.142-.09z"/>
              <path d="M12.35 1a11.002 11.002 0 00-9.61 16.34L1 23l5.82-1.53A11.002 11.002 0 1012.35 1zm0 20.06a9.056 9.056 0 01-4.6-1.26l-.33-.2-3.41.9.91-3.32-.22-.35a9.056 9.056 0 117.65 4.23z"/>
            </svg>
            <span>واتساب: +963956979465 💬</span>
          </a>

          <a href="https://t.me/aborashid00" target="_blank" 
             class="w-full py-3 h-12 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-450 active:scale-[0.98] text-slate-950 font-black rounded-2xl text-xs shadow-lg transition duration-200">
            <svg class="w-4 h-4 text-slate-950" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.94-4.22 2.78-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z"/>
            </svg>
            <span>تليجرام: @aborashid00 ✈️</span>
          </a>
        </div>

        <div class="text-[9px] text-slate-500 font-bold">
          © كافيه أنا وإياك والمطور أبو راشد للتطوير البرمجي
        </div>
      </div>
    `;
    document.body.appendChild(crashScreen);
  };

  if (!navigator.onLine) {
    showOfflineScreen();
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    const res = await fetch("/api/shamcash-config", { 
      method: "GET",
      signal: controller.signal
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (!res || res.status !== 200) {
      showOfflineScreen();
    }
  } catch (err) {
    showOfflineScreen();
  }
}

// تشغيل الفحص على الفور
window.addEventListener("offline", showOfflineScreen => {
  if (document.getElementById("offline-crash-screen")) return;
  checkServerOfflineStatus();
});

document.addEventListener("DOMContentLoaded", () => {
  checkServerOfflineStatus();
  setInterval(checkServerOfflineStatus, 15000); // فحص مستمر كل 15 ثانية للاتصال بسيرفر السداد
});

export class CafeCart {
  constructor() {
    this.items = JSON.parse(localStorage.getItem("ana_cart")) || [];
    this.deliveryFee = 3000; // تكلفة التوصيل الافتراضية
  }

  // إضافة منتج للسلة
  addItem(product, sizeName, price, quantity = 1) {
    // التحقق مما إذا كان المنتج بنفس الحجم موجوداً بالفعل
    const existingIndex = this.items.findIndex(
      item => item.id === product.id && item.size === sizeName
    );

    if (existingIndex > -1) {
      this.items[existingIndex].quantity += quantity;
    } else {
      this.items.push({
        id: product.id,
        name: product.name,
        image: product.image,
        category: product.category,
        size: sizeName,
        price: price,
        quantity: quantity
      });
    }

    this.saveCart();
    this.renderSideCart();
    this.showToast(`تمت إضافة ${product.name} (${sizeName}) إلى السلة!`);
  }

  // تقليل أو زيادة الكمية
  updateQuantity(productId, sizeName, delta) {
    const itemIndex = this.items.findIndex(
      item => item.id === productId && item.size === sizeName
    );

    if (itemIndex > -1) {
      this.items[itemIndex].quantity += delta;
      
      if (this.items[itemIndex].quantity <= 0) {
        this.items.splice(itemIndex, 1);
        this.showToast("تم حذف المنتج من السلة");
      }
      
      this.saveCart();
      this.renderSideCart();
      this.renderCartPage(); // ميثود في حال كنا على صفحة السلة المنفصلة
    }
  }

  // حذف نوع منتج بالكامل
  removeItem(productId, sizeName) {
    this.items = this.items.filter(
      item => !(item.id === productId && item.size === sizeName)
    );
    this.saveCart();
    this.renderSideCart();
    this.renderCartPage();
    this.showToast("تمت إزالة المنتج");
  }

  // تفريغ السلة
  clearCart() {
    this.items = [];
    this.saveCart();
    this.renderSideCart();
    this.renderCartPage();
  }

  // إجمالي السعر الفرعي
  getSubtotal() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  // إجمالي السعر الكلي مع التوصيل
  getTotal() {
    const sub = this.getSubtotal();
    return sub > 0 ? sub + this.deliveryFee : 0;
  }

  // عدد العناصر الفردية بالسلة
  getItemsCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  // حفظ في localStorage
  saveCart() {
    localStorage.setItem("ana_cart", JSON.stringify(this.items));
    // تحديث شارات الأرقام على أي صفحة مفتوحة
    const badges = document.querySelectorAll(".cart-badge");
    const count = this.getItemsCount();
    badges.forEach(badge => {
      badge.textContent = count;
      if (count > 0) {
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    });

    // تحديث وتفعيل زر إتمام الطلب الفوري العائم في الصفحة الرئيسية
    const stickyBar = document.getElementById("sticky-checkout-bar");
    const stickyTotalEl = document.getElementById("sticky-total");
    if (stickyBar) {
      if (count > 0) {
        if (stickyTotalEl) {
          stickyTotalEl.textContent = `${this.getTotal().toLocaleString()} ل.س`;
        }
        stickyBar.classList.remove("hidden");
        setTimeout(() => {
          stickyBar.classList.remove("translate-y-20", "opacity-0");
        }, 50);
      } else {
        stickyBar.classList.add("translate-y-20", "opacity-0");
        setTimeout(() => {
          // التحقق من أن العدد ما يزال صفر بعد انتهاء الأنيميشن
          if (this.getItemsCount() === 0) {
            stickyBar.classList.add("hidden");
          }
        }, 500);
      }
    }
  }

  // رسم السلة الجانبية (Slide-Over Drawer)
  renderSideCart() {
    const container = document.getElementById("cart-items-container");
    if (!container) return; // السلة غير مطروحة حالياً في هذه الصفحة

    if (this.items.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <svg class="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
          </svg>
          <p class="text-slate-400 font-medium">سلتك فارغة تماماً</p>
          <a href="/" class="mt-4 text-xs text-amber-500 hover:underline">تصفح المنتجات وأضف المشروبات</a>
        </div>
      `;
      this.updateTotalElements(0, 0, 0);
      return;
    }

    let html = "";
    this.items.forEach(item => {
      html += `
        <div class="flex items-center gap-3 p-3 bg-slate-900/30 border border-slate-800 rounded-xl mb-3 glass-panel">
          <img src="${item.image}" alt="${item.name}" class="w-14 h-14 rounded-lg object-cover border border-slate-700/50">
          
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-bold text-white truncate">${item.name}</h4>
            <p class="text-xs text-amber-400/90 mt-1 font-mono">${item.size === 'small' ? 'صغير' : item.size === 'medium' ? 'وسط' : 'كبير'}</p>
            <p class="text-xs text-slate-400 mt-1 font-mono">${item.price.toLocaleString()} ل.س</p>
          </div>

          <div class="flex flex-col items-end justify-between self-stretch">
            <button onclick="window.cart.removeItem('${item.id}', '${item.size}')" class="text-slate-500 hover:text-red-400 p-1 rounded-md hover:bg-slate-800/50 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
            
            <div class="flex items-center gap-2 bg-slate-950/60 rounded-lg px-2 py-0.5 border border-slate-800">
              <button onclick="window.cart.updateQuantity('${item.id}', '${item.size}', 1)" class="text-slate-400 hover:text-amber-500 text-sm font-bold">+</button>
              <span class="text-xs text-white font-mono min-w-4 text-center">${item.quantity}</span>
              <button onclick="window.cart.updateQuantity('${item.id}', '${item.size}', -1)" class="text-slate-400 hover:text-amber-500 text-sm font-bold">-</button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    this.updateTotalElements(this.getSubtotal(), this.deliveryFee, this.getTotal());
  }

  // تحديث نصوص المبالغ بالواجهات
  updateTotalElements(subtotal, delivery, total) {
    const subEl = document.getElementById("cart-subtotal");
    const delEl = document.getElementById("cart-delivery");
    const totEl = document.getElementById("cart-total");

    if (subEl) subEl.textContent = `${subtotal.toLocaleString()} ل.س`;
    if (delEl) delEl.textContent = delivery > 0 ? `${delivery.toLocaleString()} ل.س` : "مجاني";
    if (totEl) totEl.textContent = `${total.toLocaleString()} ل.س`;
  }

  // رسم صفحة السلة المنفصلة (cart.html)
  renderCartPage() {
    const container = document.getElementById("cart-page-container");
    if (!container) return;

    if (this.items.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
          <div class="w-20 h-20 bg-slate-900/60 rounded-full flex items-center justify-center border border-slate-800 mb-6 pulse-gold">
            <svg class="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-white mb-2">سلتك فارغة حالياً</h2>
          <p class="text-slate-400 text-sm mb-6 leading-relaxed">لم تقم بإضافة أي مشروبات أو حلويات منعشة إلى سلتك بعد. تصفح منيو "أنا وإياك" الفاخرة واختر ما يروق لك.</p>
          <a href="/index.html" class="px-6 py-3 bg-gold-gradient text-slate-950 font-bold rounded-xl btn-gold inline-block w-full">العودة للرئيسية</a>
        </div>
      `;
      
      const summaryContainer = document.getElementById("cart-summary-card");
      if (summaryContainer) summaryContainer.classList.add("hidden");
      return;
    }

    const summaryContainer = document.getElementById("cart-summary-card");
    if (summaryContainer) summaryContainer.classList.remove("hidden");

    let html = "";
    this.items.forEach(item => {
      html += `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-900/40 border border-slate-800 rounded-2xl glass-panel relative">
          <div class="flex items-center gap-4">
            <img src="${item.image}" alt="${item.name}" class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-slate-750">
            <div>
              <h3 class="text-base sm:text-lg font-bold text-white mb-1">${item.name}</h3>
              <p class="text-xs text-amber-500 font-medium mb-1">الحجم: ${item.size === 'small' ? 'صغير' : item.size === 'medium' ? 'وسط' : 'كبير'}</p>
              <p class="text-sm text-slate-400 font-mono">${item.price.toLocaleString()} ل.س</p>
            </div>
          </div>

          <div class="flex items-center justify-between w-full sm:w-auto gap-4 sm:self-center">
            <div class="flex items-center gap-3 bg-slate-950/60 rounded-xl px-3 py-1.5 border border-slate-800">
              <button onclick="window.cart.updateQuantity('${item.id}', '${item.size}', 1)" class="text-slate-400 hover:text-amber-500 font-bold text-lg">+</button>
              <span class="text-white font-mono min-w-6 text-center">${item.quantity}</span>
              <button onclick="window.cart.updateQuantity('${item.id}', '${item.size}', -1)" class="text-slate-400 hover:text-amber-500 font-bold text-lg">-</button>
            </div>

            <div class="text-left">
              <p class="text-base font-extrabold text-white font-mono mb-1">${(item.price * item.quantity).toLocaleString()} ل.س</p>
              <button onclick="window.cart.removeItem('${item.id}', '${item.size}')" class="text-xs text-red-400 hover:text-red-300 transition-colors">إزالة</button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    
    // تحديث ملخص السعر في الصفحة
    const pageSubtotal = document.getElementById("page-subtotal");
    const pageDelivery = document.getElementById("page-delivery");
    const pageTotal = document.getElementById("page-total");

    if (pageSubtotal) pageSubtotal.textContent = `${this.getSubtotal().toLocaleString()} ل.س`;
    if (pageDelivery) pageDelivery.textContent = `${this.deliveryFee.toLocaleString()} ل.س`;
    if (pageTotal) pageTotal.textContent = `${this.getTotal().toLocaleString()} ل.س`;
  }

  // لوحة تحذيرات 토스트 (Toasts)
  showToast(message) {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "fixed bottom-6 right-6 left-6 sm:left-auto z-50 flex flex-col gap-2 pointer-events-none";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "glass-panel bg-slate-900 border border-amber-500/30 text-white px-5 py-3.5 rounded-xl shadow-xl slide-in-left pointer-events-auto flex items-center justify-between gap-3 text-sm font-semibold max-w-sm";
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

// تهيئة السلة عالمياً للوصول إليها من أي صفحة html
const cart = new CafeCart();
window.cart = cart;

// مستمعي التحكم بالنوافذ الجانبية وعرض السلة
document.addEventListener("DOMContentLoaded", () => {
  cart.saveCart(); // لتحديث الشارات على الفور
  
  // شريط السلة الجانبي
  const openCartBtn = document.querySelectorAll(".open-cart-btn");
  const closeCartBtn = document.getElementById("close-cart-btn");
  const sideCart = document.getElementById("side-cart");
  const cartOverlay = document.getElementById("cart-overlay");

  if (sideCart) {
    const showCart = () => {
      cart.renderSideCart();
      sideCart.classList.remove("translate-x-full");
      if (cartOverlay) cartOverlay.classList.remove("hidden");
    };

    const hideCart = () => {
      sideCart.classList.add("translate-x-full");
      if (cartOverlay) cartOverlay.classList.add("hidden");
    };

    openCartBtn.forEach(btn => btn.addEventListener("click", (e) => {
      e.preventDefault();
      showCart();
    }));
    
    if (closeCartBtn) closeCartBtn.addEventListener("click", hideCart);
    if (cartOverlay) cartOverlay.addEventListener("click", hideCart);
  }

  // إذا كنا على صفحة السلة المنفصلة
  cart.renderCartPage();
});
