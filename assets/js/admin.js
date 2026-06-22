// لوحة إدارة كافيه "أنا وإياك" - المنتجات والطلبات والتحليلات بالوقت الحقيقي
import { 
  db, 
  isMock, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  query,
  orderBy
} from "./firebase.js";

class AdminPanel {
  constructor() {
    this.products = [];
    this.orders = [];
    this.filterStatus = "all";
    this.editingProductId = null;
    this.loadedOrderIds = null; // تتبع الـ IDs للتبليغ المباشر الفوري عن الطلبات الجديدة
    this.alarmInterval = null; // مؤقت المنبه المتكرر للطلبات الجديدة

    // طلب صلاحيات الإشعارات فوراً من المتصفح لتفعيل التنبيهات المنبثقة للجميع
    if ("Notification" in window && Notification.permission === "default") {
      document.addEventListener('click', () => {
        if (Notification.permission === "default") {
          Notification.requestPermission().then(permission => {
            console.log("🔔 Notification permission response:", permission);
          });
        }
      }, { once: true });
    }

    this.init();
  }

  async init() {
    const isDashboard = document.getElementById("admin-stats-container");
    const isOrdersPage = document.getElementById("admin-orders-container");
    const isProductsPage = document.getElementById("admin-products-container");

    if (isDashboard) {
      this.setupRealtimeOrders();
      this.fetchAndRenderDashboard();
      this.setupShamCashConfigForm();
      this.setupSubaccountsManagement(); // تشغيل إدارة الموظفين وصلاحياتهم
    }
    
    if (isOrdersPage) {
      this.setupRealtimeOrders();
    }

    if (isProductsPage) {
      await this.fetchProducts();
      this.renderProducts();
      this.setupProductFormListener();
      this.setupImagePickerListener();
    }
  }

  // ==========================================
  // 1. الطلبات في الوقت الفعلي (onSnapshot)
  // ==========================================
  setupRealtimeOrders() {
    if (isMock) {
      // الوضع التجريبي: محاكاة تحديث الطلبات عبر localStorage ومستمع أحداث نافذة
      const pollAndRender = () => {
        this.orders = JSON.parse(localStorage.getItem("mock_orders")) || [];
        this.calculateDashboardStats();
        this.renderOrders();
        this.updateFilterBadges();
        this.trackIncomingOrders(this.orders);
      };
      
      pollAndRender();
      // استطلاع كل ثانيتين لمحاكاة الوقت الحقيقي بدقة في المتصفح
      this.pollInterval = setInterval(pollAndRender, 2000);
      return;
    }

    // الوضع الحقيقي: ربط مستمع Firestore الفعلي بالوقت الحقيقي
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      onSnapshot(q, (snapshot) => {
        const items = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() });
        });
        this.orders = items;
        this.calculateDashboardStats();
        this.renderOrders();
        this.updateFilterBadges();
        this.trackIncomingOrders(items);
      }, (error) => {
        console.warn("Firestore Real-time Orders Listen Error, falling back to mock:", error);
        const pollAndRender = () => {
          this.orders = JSON.parse(localStorage.getItem("mock_orders")) || [];
          this.calculateDashboardStats();
          this.renderOrders();
          this.updateFilterBadges();
          this.trackIncomingOrders(this.orders);
        };
        pollAndRender();
        this.pollInterval = setInterval(pollAndRender, 2000);
      });
    } catch (error) {
      console.error("Firestore Listen Error:", error);
    }
  }

  // ==========================================
  // 2. تحديث لوحة التحكم والإحصائيات ديركت
  // ==========================================
  async fetchAndRenderDashboard() {
    await this.fetchProducts();
    this.calculateDashboardStats();
  }

  calculateDashboardStats() {
    // تحديث الإحصائيات بالواجهة (دعم تسميات لوحة المؤشرات المكتوبة بـ dashboard.html)
    const totalOrdersEl = document.getElementById("stat-total-orders") || document.getElementById("dash-total-orders");
    const activeOrdersEl = document.getElementById("stat-active-orders") || document.getElementById("dash-active-orders");
    const totalSalesEl = document.getElementById("stat-total-sales") || document.getElementById("dash-total-revenue");
    const menuCountEl = document.getElementById("stat-menu-count") || document.getElementById("dash-total-menu");

    if (!totalOrdersEl && !activeOrdersEl && !totalSalesEl && !menuCountEl) return;

    const totalOrders = this.orders.length;
    
    // المبيعات التقريبية من الطلبات غير الملغاة
    const totalSales = this.orders
      .filter(o => o.status !== "canceled")
      .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    const activeOrders = this.orders.filter(o => o.status === "new" || o.status === "preparing").length;

    if (totalOrdersEl) {
      if (totalOrdersEl.id === "dash-total-orders") {
        totalOrdersEl.textContent = `${totalOrders} طلب`;
      } else {
        totalOrdersEl.textContent = totalOrders;
      }
    }
    if (activeOrdersEl) {
      if (activeOrdersEl.id === "dash-active-orders") {
        activeOrdersEl.textContent = `${activeOrders} طلب`;
      } else {
        activeOrdersEl.textContent = activeOrders;
      }
    }
    if (totalSalesEl) totalSalesEl.textContent = `${totalSales.toLocaleString()} ل.س`;
    
    if (menuCountEl) {
      let count = 0;
      if (isMock) {
        count = (JSON.parse(localStorage.getItem("mock_menu")) || []).length;
      } else {
        count = this.products.length;
      }
      if (menuCountEl.id === "dash-total-menu") {
        menuCountEl.textContent = `${count} صنف`;
      } else {
        menuCountEl.textContent = count;
      }
    }

    // تعبئة جدول آخر 5 طلبات نشطة مسجلة المضافة حديثاً
    this.renderRecentOrdersTable();
  }

  // ==========================================
  // 3. عرض وإدارة الطلبات (Orders UI)
  // ==========================================
  renderOrders() {
    const container = document.getElementById("admin-orders-container");
    if (!container) return;

    const filtered = this.filterStatus === "all" 
      ? this.orders 
      : this.orders.filter(o => o.status === this.filterStatus);

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-20 text-center flex flex-col items-center justify-center">
          <svg class="w-16 h-16 text-slate-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
          </svg>
          <p class="text-slate-400">لا يوجد أي طلبات جارية تطابق الفلتر المختار حالياً.</p>
        </div>
      `;
      return;
    }

    let html = "";
    filtered.forEach(order => {
      // تفاصيل حالة الطلب للتلوين
      let statusColor = "";
      let statusLabel = "";
      switch (order.status) {
        case "new":
          statusColor = "bg-amber-500/10 text-amber-500 border border-amber-500/20 pulse-gold";
          statusLabel = "طلب جديد";
          break;
        case "preparing":
          statusColor = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
          statusLabel = "قيد التحضير";
          break;
        case "delivered":
          statusColor = "bg-green-500/10 text-green-400 border border-green-500/20";
          statusLabel = "تم التوصيل";
          break;
        case "canceled":
          statusColor = "bg-red-500/10 text-red-400 border border-red-500/20";
          statusLabel = "ملغي";
          break;
        default:
          statusColor = "bg-slate-500/10 text-slate-400";
          statusLabel = order.status;
      }

      // رسم العناصر المطلوبة بالطلب
      let itemsHtml = "";
      order.items.forEach(it => {
        itemsHtml += `
          <div class="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/50 last:border-0 font-medium">
            <div class="text-white">
              <span>${it.name}</span>
              <span class="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-md mr-1">${it.size === 'small' ? 'صغير' : it.size === 'medium' ? 'وسط' : 'كبير'}</span>
            </div>
            <div class="font-mono text-slate-400">
              <span>${it.quantity} ×</span>
              <span class="text-white">${it.price.toLocaleString()} ل.س</span>
            </div>
          </div>
        `;
      });

      // الوقت واليوم للطلب
      const orderDate = order.createdAt && order.createdAt.seconds 
        ? new Date(order.createdAt.seconds * 1000).toLocaleString("ar-SY", { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
        : "الآن";

      html += `
        <div class="glass-panel p-5 rounded-2xl flex flex-col justify-between" id="order-card-${order.orderId || order.id}">
          <div>
            <div class="flex justify-between items-start gap-2 mb-4">
              <div>
                <h3 class="text-base font-black text-white font-mono">${order.orderId || "ORD-XXXX"}</h3>
                <span class="text-[10px] text-slate-500 mt-1 block">${orderDate}</span>
              </div>
              <span class="px-2.5 py-1 text-xs rounded-full font-bold ${statusColor}">
                ${statusLabel}
              </span>
            </div>

            <!-- معلومات الزبون -->
            <div class="bg-slate-950/40 border border-slate-800 rounded-xl p-3 mb-4 space-y-1.5 text-xs text-right font-Cairo">
              <p class="text-white font-bold"><span class="text-slate-500 font-normal">الزبون:</span> ${order.customerName}</p>
              ${order.phone ? `<p class="text-white font-mono"><span class="text-slate-500 font-normal">الهاتف:</span> <a href="tel:${order.phone}" class="text-amber-400 hover:underline">${order.phone}</a></p>` : ""}
              <p class="text-white"><span class="text-slate-500 font-normal">العنوان:</span> ${order.address}</p>
              ${order.locationLink ? `
                <div class="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-900 border-dashed">
                  <span class="text-slate-500 font-normal">موقع الـGPS:</span>
                  <a href="${order.locationLink}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-350 border border-amber-500/25 rounded-md font-bold text-[10px] transition inline-flex items-center gap-1">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>فتح الموقع الجغرافي</span>
                  </a>
                </div>
              ` : ""}
              ${order.notes ? `<p class="text-amber-300"><span class="text-slate-500 font-normal">ملاحظات:</span> ${order.notes}</p>` : ""}
              
              <!-- إثبات ودعم طريقة سداد الطلب -->
              <div class="mt-2 pt-2 border-t border-slate-900 flex flex-col gap-1 text-[11px] font-Cairo">
                <div>
                  <span class="text-slate-500">طريقة السداد:</span>
                  ${order.paymentMethod === 'subscription' 
                    ? `<span class="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-black text-[10px]">كود الاشتراك المسبق</span>`
                    : `<span class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-black text-[10px]">شام كاش (سريع)</span>`
                  }
                </div>
                ${order.paymentMethod === 'subscription' && order.subscriptionCode
                  ? `<div class="font-mono text-amber-500 font-bold bg-amber-500/5 p-1.5 rounded border border-amber-500/10 mt-1 flex justify-between items-center">
                       <span>كود العميل:</span>
                       <span>${order.subscriptionCode}</span>
                     </div>`
                  : ""
                }
                ${order.paymentMethod !== 'subscription' && order.shamCashReceipt
                  ? `<div class="font-mono text-emerald-400 font-bold bg-emerald-500/5 p-1.5 rounded border border-emerald-500/10 mt-1 flex justify-between items-center">
                       <span class="font-Cairo text-slate-500 text-[10px]">رقم إيصال المعاملة:</span>
                       <span class="select-all">${order.shamCashReceipt}</span>
                     </div>`
                  : ""
                }
              </div>
            </div>

            <!-- العناصر المطلوبة -->
            <div class="mb-4">
              <h4 class="text-xs font-bold text-slate-400 mb-2">العناصر الفرعية بالطلب</h4>
              <div class="bg-slate-900/30 border border-slate-800 rounded-xl p-3">
                ${itemsHtml}
              </div>
            </div>
          </div>

          <!-- السعر وحركات تغيير الحالة -->
          <div class="mt-auto border-t border-slate-800 pt-4 flex flex-col gap-3">
            <div class="flex justify-between items-center">
              <span class="text-xs text-slate-400 font-bold">الحساب الكلي</span>
              <span class="text-base font-black text-amber-400 font-mono">${(order.totalPrice || 0).toLocaleString()} ل.س</span>
            </div>

            <div class="grid grid-cols-4 gap-1">
              <button onclick="window.adminPanel.updateOrderStatus('${order.id || order.orderId}', 'new')" 
                      class="text-[10px] py-1.5 px-0.5 text-center font-bold rounded-lg border transition ${order.status === 'new' ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-gold' : 'border-slate-800 text-slate-400 hover:border-slate-700 bg-slate-950/20'}">جديد</button>
              <button onclick="window.adminPanel.updateOrderStatus('${order.id || order.orderId}', 'preparing')" 
                      class="text-[10px] py-1.5 px-0.5 text-center font-bold rounded-lg border transition ${order.status === 'preparing' ? 'bg-blue-500 border-blue-500 text-slate-950 shadow-md' : 'border-slate-800 text-slate-400 hover:border-slate-700 bg-slate-950/20'}">تحضير</button>
              <button onclick="window.adminPanel.updateOrderStatus('${order.id || order.orderId}', 'delivered')" 
                      class="text-[10px] py-1.5 px-0.5 text-center font-bold rounded-lg border transition ${order.status === 'delivered' ? 'bg-green-500 border-green-500 text-slate-950 shadow-md' : 'border-slate-800 text-slate-400 hover:border-slate-700 bg-slate-950/20'}">توصيل</button>
              <button onclick="window.adminPanel.updateOrderStatus('${order.id || order.orderId}', 'canceled')" 
                      class="text-[10px] py-1.5 px-0.5 text-center font-bold rounded-lg border transition ${order.status === 'canceled' ? 'bg-red-500 border-red-500 text-slate-950 shadow-md' : 'border-slate-800 text-slate-400 hover:border-slate-700 bg-slate-950/20'}">إلغاء</button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // تحديث حالة الطلب
  async updateOrderStatus(orderId, newStatus) {
    if (isMock) {
      const orders = JSON.parse(localStorage.getItem("mock_orders")) || [];
      const index = orders.findIndex(o => (o.id === orderId || o.orderId === orderId));
      if (index > -1) {
        orders[index].status = newStatus;
        localStorage.setItem("mock_orders", JSON.stringify(orders));
        this.orders = orders;
        this.renderOrders();
        this.calculateDashboardStats();
        this.showToast("تم تحديث الحالة بنجاح!");
      }
      return;
    }

    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: newStatus });
      this.showToast("تم تحديث حالة الطلب فورياً بنجاح!");
    } catch (error) {
      console.error("Error updating order status:", error);
      this.showToast("فشل تحديث حالة الطلب.");
    }
  }

  // تصفية فلتر عرض الطلبات بحسب الحالة
  setFilterStatus(status) {
    this.filterStatus = status;
    this.renderOrders();
    
    // إبراز الأزرار الفعالة وتظليلها باللون المناسب
    const filterContainer = document.getElementById("orders-filter-container");
    if (filterContainer) {
      const buttons = filterContainer.querySelectorAll("button");
      buttons.forEach(btn => {
        btn.className = "px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-350 hover:text-white rounded-xl text-xs font-bold transition duration-300";
      });
      // إيجاد وزر الفلتر النشط
      const activeBtn = Array.from(buttons).find(b => b.getAttribute("onclick")?.includes(`'${status}'`));
      if (activeBtn) {
        if (status === "all") {
          activeBtn.className = "px-4 py-2 bg-gold-gradient text-slate-950 rounded-xl text-xs font-bold transition duration-300 shadow-gold";
        } else if (status === "new") {
          activeBtn.className = "px-4 py-2 bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 rounded-xl text-xs font-bold transition duration-300";
        } else if (status === "preparing") {
          activeBtn.className = "px-4 py-2 bg-amber-500/20 border border-amber-500/40 text-amber-500 rounded-xl text-xs font-bold transition duration-300";
        } else if (status === "delivered") {
          activeBtn.className = "px-4 py-2 bg-green-500/20 border border-green-500/40 text-green-400 rounded-xl text-xs font-bold transition duration-300";
        } else if (status === "canceled") {
          activeBtn.className = "px-4 py-2 bg-rose-500/20 border border-rose-500/40 text-rose-450 rounded-xl text-xs font-bold transition duration-300";
        }
      }
    }
  }

  // ==========================================
  // 4. عرض وإدارة المنتجات (Products UI)
  // ==========================================
  async fetchProducts() {
    if (isMock) {
      this.products = JSON.parse(localStorage.getItem("mock_menu")) || [];
      return;
    }

    try {
      const q = query(collection(db, "menu"));
      const querySnapshot = await getDocs(q);
      const items = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      this.products = items;
    } catch (e) {
      console.error(e);
      this.products = JSON.parse(localStorage.getItem("mock_menu")) || [];
    }
  }

  renderProducts() {
    const listContainer = document.getElementById("admin-products-list");
    if (!listContainer) return;

    if (this.products.length === 0) {
      listContainer.innerHTML = `
        <div class="col-span-full py-20 text-center text-slate-400">لا يوجد منتجات في القائمة حالياً. أضف بعض المنتجات مجدداً بالنموذج المرفق!</div>
      `;
      return;
    }

    let html = "";
    this.products.forEach(p => {
      const smPrice = p.sizes.find(s => s.size === "small")?.price || 0;
      const mdPrice = p.sizes.find(s => s.size === "medium")?.price || 0;
      const lgPrice = p.sizes.find(s => s.size === "large")?.price || 0;

      let categoryLabel = "";
      switch (p.category) {
        case "coffee": categoryLabel = "قهوة ساخنة"; break;
        case "cold": categoryLabel = "مشروبات باردة"; break;
        case "sweets": categoryLabel = "حلويات فاخرة"; break;
        default: categoryLabel = p.category;
      }

      html += `
        <div class="glass-panel p-4 rounded-2xl flex items-center justify-between gap-4 border border-slate-800" id="prod-row-${p.id}">
          <div class="flex items-center gap-4 min-w-0">
            <img src="${p.image}" alt="${p.name}" class="w-16 h-16 rounded-xl object-cover border border-slate-700/60">
            <div class="min-w-0">
              <h3 class="text-sm font-extrabold text-white truncate">${p.name}</h3>
              <span class="text-[10px] text-amber-500 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-md mt-1 inline-block">${categoryLabel}</span>
              ${p.featured ? `
                <span class="text-[10px] text-green-400 font-semibold bg-green-500/10 px-2 py-0.5 rounded-md mt-1 inline-block">مميز</span>
              ` : ""}
              
              <!-- استعراض الأسعار بالتتابع -->
              <div class="flex flex-wrap gap-2 mt-2 font-mono text-[10px] text-slate-400">
                <span>صغير: ${smPrice.toLocaleString()}</span>
                <span>وسط: ${mdPrice.toLocaleString()}</span>
                <span>كبير: ${lgPrice.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div class="flex gap-1">
            <button onclick="window.adminPanel.editProduct('${p.id}')" 
                    class="p-2 text-amber-400 hover:text-amber-300 hover:bg-slate-800/40 rounded-xl transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            </button>
            <button onclick="window.adminPanel.deleteProduct('${p.id}')" 
                    class="p-2 text-red-400 hover:text-red-300 hover:bg-slate-800/40 rounded-xl transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = html;
  }

  // مستمع تقديم نموذج تعديل/إضافة منتج
  setupProductFormListener() {
    const form = document.getElementById("product-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const pName = document.getElementById("p-name").value;
      const pCategory = document.getElementById("p-category").value;
      const pImage = document.getElementById("p-image").value || "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=600";
      const pDesc = document.getElementById("p-description").value;
      const pFeatured = document.getElementById("p-featured").checked;
      
      const pPriceSmall = parseFloat(document.getElementById("p-price-small").value) || 0;
      const pPriceMedium = parseFloat(document.getElementById("p-price-medium").value) || 0;
      const pPriceLarge = parseFloat(document.getElementById("p-price-large").value) || 0;

      const productData = {
        name: pName,
        category: pCategory,
        image: pImage,
        description: pDesc,
        featured: pFeatured,
        sizes: [
          { size: "small", price: pPriceSmall },
          { size: "medium", price: pPriceMedium },
          { size: "large", price: pPriceLarge }
        ]
      };

      if (this.editingProductId) {
        // تحديث منتج موجود
        if (isMock) {
          const mMenu = JSON.parse(localStorage.getItem("mock_menu")) || [];
          const idx = mMenu.findIndex(i => i.id === this.editingProductId);
          if (idx > -1) {
            mMenu[idx] = { ...productData, id: this.editingProductId };
            localStorage.setItem("mock_menu", JSON.stringify(mMenu));
            this.showToast("تم تحديث المنتج بالوضع التجريبي!");
          }
        } else {
          try {
            const docRef = doc(db, "menu", this.editingProductId);
            await updateDoc(docRef, productData);
            this.showToast("تم تحديث معلومات المنتج بـ Firestore!");
          } catch (err) {
            console.error(err);
            this.showToast("فشلت عملية التعديل بكلاود.");
          }
        }
        this.editingProductId = null;
        document.getElementById("form-submit-btn").textContent = "إضافة منتج جديد";
        document.getElementById("form-title").textContent = "إضافة أو تعديل منتج";
      } else {
        // إنشاء منتج جديد مضاف
        if (isMock) {
          const mMenu = JSON.parse(localStorage.getItem("mock_menu")) || [];
          const newId = "prod-" + Date.now();
          mMenu.push({ ...productData, id: newId });
          localStorage.setItem("mock_menu", JSON.stringify(mMenu));
          this.showToast("تمت إضافة المنتج بنجاح بالوضع التجريبي!");
        } else {
          try {
            await addDoc(collection(db, "menu"), productData);
            this.showToast("تم حفظ ونشر المنتج على Firestore بنجاح!");
          } catch (err) {
            console.error(err);
            this.showToast("فشل الحفظ بـ Firestore.");
          }
        }
      }

      form.reset();
      
      // إعادة ضبط الصورة والمعاينة لبيئتنا الرسومية التفاعلية الجديدة
      const imgInput = document.getElementById("p-image");
      if (imgInput) imgInput.value = "";
      const previewContainer = document.getElementById("p-image-preview-container");
      if (previewContainer) previewContainer.classList.add("hidden");
      
      await this.fetchProducts();
      this.renderProducts();
    });
  }

  // مستمع التقاط وتمرير وتحويل صور الأجهزة محلياً لتخزينها
  setupImagePickerListener() {
    const fileInput = document.getElementById("p-image-file");
    const hiddenInput = document.getElementById("p-image");
    const previewContainer = document.getElementById("p-image-preview-container");
    const previewImg = document.getElementById("p-image-preview");

    if (!fileInput) return;

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        // فحص حجم الصورة حتى لا تتجاوز الحدود المريحة لسرعة تحميل وعرض المنتجات (مثلاً 1.5 ميغابايت)
        if (file.size > 1.5 * 1024 * 1024) {
          this.showToast("⚠️ حجم الصورة كبير! الرجاء اختيار صورة أقل من 1.5 ميغابايت.");
          fileInput.value = "";
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Str = event.target.result;
          if (hiddenInput) hiddenInput.value = base64Str;
          if (previewImg && previewContainer) {
            previewImg.src = base64Str;
            previewContainer.classList.remove("hidden");
          }
          this.showToast("📸 تم اختيار الصورة ومعاينتها بنجاح!");
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // تحرير منتج
  editProduct(productId) {
    const p = this.products.find(item => item.id === productId);
    if (!p) return;

    this.editingProductId = p.id;

    document.getElementById("p-name").value = p.name;
    document.getElementById("p-category").value = p.category;
    document.getElementById("p-image").value = p.image || "";
    const previewContainer = document.getElementById("p-image-preview-container");
    const previewImg = document.getElementById("p-image-preview");
    if (previewContainer && previewImg && p.image) {
      previewImg.src = p.image;
      previewContainer.classList.remove("hidden");
    } else if (previewContainer) {
      previewContainer.classList.add("hidden");
    }
    document.getElementById("p-description").value = p.description;
    document.getElementById("p-featured").checked = p.featured;

    const sm = p.sizes.find(s => s.size === "small")?.price || 0;
    const md = p.sizes.find(s => s.size === "medium")?.price || 0;
    const lg = p.sizes.find(s => s.size === "large")?.price || 0;

    document.getElementById("p-price-small").value = sm;
    document.getElementById("p-price-medium").value = md;
    document.getElementById("p-price-large").value = lg;

    document.getElementById("form-submit-btn").textContent = "تحديث المنتج";
    document.getElementById("form-title").textContent = "تعديل المنتج الـحالي";

    // تمرير شريط التمرير إلى النموذج
    document.getElementById("product-form").scrollIntoView({ behavior: "smooth" });
  }

  // حذف منتج
  async deleteProduct(productId) {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا المنتج من المنيو؟")) return;

    if (isMock) {
      let mMenu = JSON.parse(localStorage.getItem("mock_menu")) || [];
      mMenu = mMenu.filter(i => i.id !== productId);
      localStorage.setItem("mock_menu", JSON.stringify(mMenu));
      this.showToast("تم حذف المنتج من النسخة المؤقتة.");
    } else {
      try {
        await deleteDoc(doc(db, "menu", productId));
        this.showToast("تم حذف المنتج من قاعدة البيانات السحابية!");
      } catch (err) {
        console.error(err);
        this.showToast("فشل في حذف المنتج من السحابة.");
      }
    }

    await this.fetchProducts();
    this.renderProducts();
  }

  // إظهار تنبيهات الـ Toast
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

  // تعبئة جدول آخر 5 طلبات نشطة مسجلة المضافة حديثاً
  renderRecentOrdersTable() {
    const tbody = document.getElementById("dashboard-recent-orders-table");
    if (!tbody) return;

    // تصفية أحدث 5 طلبات نشطة (جديد أو قيد التحضير)
    const recentActive = this.orders
      .filter(o => o.status === "new" || o.status === "preparing")
      .slice(0, 5);

    if (recentActive.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-8 text-center text-slate-500 font-Cairo font-semibold">🙌 ممتاز جداً! لا يوجد حالياً طلبات نشطة تنتظر التحضير.</td>
        </tr>
      `;
      return;
    }

    let html = "";
    recentActive.forEach(order => {
      let statusStr = order.status === "new" ? "طلب جديد" : "قيد التحضير";
      let statusClass = order.status === "new" ? "text-amber-500 bg-amber-500/10" : "text-blue-400 bg-blue-500/10";
      
      html += `
        <tr class="border-b border-slate-900 hover:bg-slate-900/10 transition font-Cairo">
          <td class="py-3 font-mono text-white font-bold text-right">${order.orderId || order.id || "ORD-XXX"}</td>
          <td class="py-3 text-slate-300 font-semibold text-right">${order.customerName}</td>
          <td class="py-3 text-slate-400 font-mono text-center">${order.phone || "بلا هاتف"}</td>
          <td class="py-3 text-amber-400 font-mono text-center font-bold">${(order.totalPrice || 0).toLocaleString()} ل.س</td>
          <td class="py-3 text-center">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${statusClass}">${statusStr}</span>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  // إدارة نموذج إعدادات ShamCash ومزامنتها بشكل آمن مع السيرفر
  async setupShamCashConfigForm() {
    const form = document.getElementById("admin-shamcash-config-form");
    if (!form) return;

    // جلب الإعدادات الحالية من السيرفر عند تحميل الصفحة لعرضها للمشرف
    try {
      const res = await fetch("/api/shamcash-config");
      if (res.ok) {
        const payload = await res.json();
        if (payload.status === "success" && payload.data) {
          const accInput = document.getElementById("sc-account-id-input");
          if (accInput) {
            accInput.value = payload.data.accountId || "";
          }
        }
      }
    } catch (err) {
      console.error("Error fetching ShamCash configurations:", err);
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const accountId = document.getElementById("sc-account-id-input").value.trim();

      if (!accountId) {
        this.showToast("⚠️ رقم حساب التاجر مطلوب.");
        return;
      }

      try {
        const response = await fetch("/api/admin/shamcash-config", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ accountId })
        });

        if (response.ok) {
          const data = await response.json();
          this.showToast("✅ " + data.message);
        } else {
          this.showToast("❌ تعذر حفظ الإعدادات على الخادم.");
        }
      } catch (err) {
        console.error("Error updating ShamCash configurations:", err);
        this.showToast("❌ حدث خطأ أثناء إرسال البيانات.");
      }
    });
  }

  // تتبع الطلبات السريعة وإطلاق تنبيهات
  trackIncomingOrders(incomingOrders) {
    if (!incomingOrders || incomingOrders.length === 0) return;

    const currentIds = incomingOrders.map(o => o.id || o.orderId);

    // إذا كانت هذه المرة الأولى للتحميل، نقر بالمعرفات الحالية فقط دون تفجير إشعارات قديمة
    if (this.loadedOrderIds === null) {
      this.loadedOrderIds = new Set(currentIds);
      return;
    }

    // فرز ومراجعة كل الاستحواذات الجديدة التي تحمل حالة "new"
    incomingOrders.forEach(order => {
      const orderId = order.id || order.orderId;
      if (!this.loadedOrderIds.has(orderId) && order.status === "new") {
        console.log("🚨 كشف هطول طلب جديد حركي - تفعيل جرس الإنذار المستمر:", order);
        
        // إشارة التنبيه المتكررة (نظام المنبه الشامل)
        this.startAlarmLoop();
        this.triggerNativeNotification(order);
        this.showNewOrderPopup(order);
      }
    });

    this.loadedOrderIds = new Set(currentIds);
  }

  // تفعيل نظام رنين المنبه المتكرر ليكون غير قابل للتجاهل كبوابة صوتية
  startAlarmLoop() {
    this.stopAlarmLoop(); // تجنب المكررات
    console.log("🔔 تم تفعيل جرس إنذار الطلبات المستمر...");
    this.playChimeSound();
    
    // رنين متكرر فوري مكثف كل 1.5 ثانية (على غرار المنبه)
    this.alarmInterval = setInterval(() => {
      this.playChimeSound();
    }, 1500);
  }

  // إيقاف جرس إنذار الطلبات
  stopAlarmLoop() {
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
      console.log("🔕 تم إيقاف منبه الطلبات المفتوح.");
    }
  }

  // تجميع نغمة واضحة للأذن عبر WebAudio API (بتردد عالي التنبيه وأكثر حدة)
  playChimeSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        // حماية المتصفحات: يحتاج إلى تفاعل سابق
        return;
      }
      
      // نغمة أولى حادة
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
      gain1.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.5);
      
      // نغمة ثانية حادة جداً بعد 120 مللي ثانية للتنبيه المكثف
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime); // A5
        gain2.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.5);
      }, 120);

      // نغمة ثالثة مرتجفة لتوليد طابع صفارة الإنذار الرهيب
      setTimeout(() => {
        const osc3 = audioCtx.createOscillator();
        const gain3 = audioCtx.createGain();
        osc3.type = "triangle";
        osc3.frequency.setValueAtTime(987.77, audioCtx.currentTime); // B5 (alarm feel)
        gain3.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain3.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        osc3.connect(gain3);
        gain3.connect(audioCtx.destination);
        osc3.start();
        osc3.stop(audioCtx.currentTime + 0.6);
      }, 240);
    } catch (e) {
      console.warn("Chime WebAudio disabled/not interactive:", e);
    }
  }

  // إرسال إشعار الهاتف الأصلي عبر بروتوكول المتصفح (Notification API) باهتزاز مكثف
  triggerNativeNotification(order) {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const title = `🚨 طلب كافيه جديد فوري مستلم!`;
        const options = {
          body: `الزبون: ${order.customerName}\nالمبلغ: ${(order.totalPrice || 0).toLocaleString()} ل.س\nاضغط هنا لمباشرة التحضير فوراً!`,
          icon: "/favicon.ico",
          vibrate: [500, 110, 500, 110, 400, 110, 300], // اهتزاز عالي الشدة لمنع الغفلة
          tag: "new-order-alert",
          requireInteraction: true, // يبقى ظاهراً على الشاشة حتى يقوم المسؤول بالتفاعل معه
          silent: false
        };
        const notification = new Notification(title, options);
        notification.onclick = () => {
          this.stopAlarmLoop();
          window.focus();
          window.location.href = "/admin/orders.html";
        };
      } catch (e) {
        console.warn("Failed creating native notification:", e);
      }
    }
  }

  // شاشة منبثقة ملحمية كاملة (Full-screen Overlay) بنظام وميض أحمر وأصفر لتنبيه منبه كلي
  showNewOrderPopup(order) {
    const existing = document.getElementById("new-order-popup-modal");
    if (existing) existing.remove();

    const prices = order.totalPrice ? order.totalPrice.toLocaleString() : "0";

    const modal = document.createElement("div");
    modal.id = "new-order-popup-modal";
    // شاشة الفول سكرين مع وميض أحمر ناعم في الخلفية للإشعار بالخطر العاجل
    modal.className = "fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-red-955/95 backdrop-blur-xl animate-[pulse_1.5s_infinite] font-Cairo";
    
    // حقن كود تصميم منبه عائم مضيء ونابض
    modal.innerHTML = `
      <div class="relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border-4 border-red-500 rounded-[36px] p-8 text-center shadow-[0_0_50px_rgba(239,68,68,0.7)] overflow-hidden scale-100 animate-slide-up" dir="rtl">
        <!-- وميض علوي -->
        <div class="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-600 via-yellow-500 to-red-600 animate-pulse"></div>
        
        <!-- أيقونة الجرس الدوارة والمهتزة بشكل فوري وثابت -->
        <div class="w-24 h-24 bg-red-500/10 text-red-500 rounded-full mx-auto flex items-center justify-center mb-6 border-2 border-red-500/40 animate-[bounce_1s_infinite]">
          <svg class="w-12 h-12 text-red-500 animate-[spin_3s_linear_infinite]" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        
        <h2 class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-amber-400 to-red-500 tracking-tight">🚨 جرس الإنذار: طلب جديد فوري!</h2>
        <p class="text-sm text-slate-300 mt-2 font-bold animate-pulse">منبه متكرر مستمر - الرجاء تأكيد الطلب فوراً</p>
        
        <div class="bg-slate-950/85 border border-red-500/30 rounded-3xl p-5 my-6 text-right space-y-3 shadow-inner">
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-400 font-bold">رقم الفاتورة:</span>
            <span class="font-mono text-white bg-slate-900 border border-slate-800 px-3 py-1 rounded-full font-bold select-all">${order.orderId || order.id || "ORD-XXXX"}</span>
          </div>
          <div class="flex justify-between items-center border-t border-slate-850 pt-2 text-xs">
            <span class="text-slate-400 font-bold">اسم العميل:</span>
            <span class="text-white text-sm font-extrabold text-amber-400">${order.customerName}</span>
          </div>
          ${order.phone ? `
          <div class="flex justify-between items-center border-t border-slate-850 pt-2 text-xs">
            <span class="text-slate-400 font-bold">رقم التواصل:</span>
            <span class="text-red-400 text-sm font-bold font-mono dir-ltr select-all">${order.phone}</span>
          </div>` : ""}
          <div class="flex justify-between items-center border-t border-slate-850 pt-2 text-xs">
            <span class="text-slate-400 font-bold">عنوان العميل:</span>
            <span class="text-slate-200 font-bold text-xs max-w-[200px] text-left truncate" title="${order.address || "غير محدد"}">${order.address || "غير محدد"}</span>
          </div>
          <div class="flex justify-between items-center border-t border-slate-850 pt-2">
            <span class="text-slate-400 font-bold text-xs">المبلغ الإجمالي المطلوب:</span>
            <span class="text-emerald-400 font-black font-mono text-base">${prices} ل.س</span>
          </div>
        </div>
        
        <!-- خيارات إيقاف المنبه والذهاب -->
        <div class="flex flex-col gap-3 font-Cairo">
          <button id="popup-go-to-orders" class="w-full py-4 bg-gradient-to-r from-red-600 via-amber-600 to-red-600 hover:from-red-700 hover:to-amber-700 text-slate-100 rounded-2xl font-black shadow-lg transform hover:scale-[1.01] active:scale-95 transition-all text-sm cursor-pointer flex items-center justify-center gap-2">
            <span>🔕 إيقاف جرس الإنذار واستلام الطلب</span>
          </button>
          
          <button id="popup-close-btn" class="w-full py-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 rounded-2xl text-xs font-bold transition-all hover:text-slate-200">
            صامت (إغلاق التنبيه المؤقت)
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // إضافة وميض في الخلفية لكامل الصفحة
    const styleId = "alarm-color-blink-style";
    if (!document.getElementById(styleId)) {
      const bStyle = document.createElement("style");
      bStyle.id = styleId;
      bStyle.textContent = `
        .bg-red-955\\/95 {
          background-color: rgba(26, 4, 4, 0.96) !important;
        }
        @keyframes alarm-pulse {
          0%, 100% { background-color: rgba(26, 4, 4, 0.96); }
          50% { background-color: rgba(45, 6, 6, 0.98); }
        }
      `;
      document.head.appendChild(bStyle);
    }

    const clearActions = () => {
      this.stopAlarmLoop();
      modal.remove();
    };

    document.getElementById("popup-close-btn").onclick = clearActions;
    document.getElementById("popup-go-to-orders").onclick = () => {
      clearActions();
      window.location.href = "/admin/orders.html";
    };
  }

  // تحديث محكم لأحجام وأعداد الطلبات في مرشحات التبويب الفراغي
  updateFilterBadges() {
    const filterContainer = document.getElementById("orders-filter-container");
    if (!filterContainer) return;

    const buttons = filterContainer.querySelectorAll("button");
    const counts = {
      all: this.orders.length,
      new: this.orders.filter(o => o.status === "new").length,
      preparing: this.orders.filter(o => o.status === "preparing").length,
      delivered: this.orders.filter(o => o.status === "delivered").length,
      canceled: this.orders.filter(o => o.status === "canceled").length
    };

    buttons.forEach(btn => {
      const clickAttr = btn.getAttribute("onclick") || "";
      let status = "all";
      if (clickAttr.includes("'new'")) status = "new";
      else if (clickAttr.includes("'preparing'")) status = "preparing";
      else if (clickAttr.includes("'delivered'")) status = "delivered";
      else if (clickAttr.includes("'canceled'")) status = "canceled";

      const count = counts[status];
      let label = "";
      switch (status) {
        case "all": label = "الكل"; break;
        case "new": label = "الجديدة"; break;
        case "preparing": label = "قيد التحضير"; break;
        case "delivered": label = "النجاح والتسليم"; break;
        case "canceled": label = "الملغاة"; break;
      }

      // إذا كانت هناك طلبات جديدة، نبرز التبويب مع تأثير نبضي لافت ومتحرك!
      if (status === "new" && count > 0) {
        btn.innerHTML = `🔔 ${label} <span class="bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-black text-[10px] ml-1 shrink-0 animate-pulse">${count}</span>`;
      } else {
        btn.innerHTML = `${label} <span class="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full text-[10px] mr-1 shrink-0 font-mono">${count}</span>`;
      }
    });
  }

  // ==========================================
  // 5. إدارة الحسابات الفرعية وصلاحيات الموظفين
  // ==========================================
  async setupSubaccountsManagement() {
    const section = document.getElementById("admin-subaccounts-section");
    if (!section) return;

    const currentRole = localStorage.getItem("admin_role") || "full";
    if (currentRole !== "full") {
      section.classList.add("hidden");
      return;
    }

    section.classList.remove("hidden");
    this.renderSubaccountsList();

    const form = document.getElementById("create-subaccount-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const name = document.getElementById("sub-name").value.trim();
        const email = document.getElementById("sub-email").value.trim().toLowerCase();
        const password = document.getElementById("sub-pass").value.trim();
        const role = document.getElementById("sub-role").value;

        if (!name || !email || !password || !role) {
          this.showToast("⚠️ الرجاء ملء كافة الحقول.");
          return;
        }

        const newAccount = {
          id: "sub-" + Math.floor(Math.random() * 100000),
          name,
          email,
          password,
          role,
          createdAt: { seconds: Math.floor(Date.now() / 1000) }
        };

        if (!isMock) {
          try {
            await addDoc(collection(db, "admin_accounts"), newAccount);
            this.showToast("✅ تم إنشاء حساب الموظف وحفظه بالسحابة!");
          } catch (err) {
            console.error("Firebase Sub-account Error:", err);
            this.showToast("⚠️ فشل الرفع لـ Firebase، تم الحفظ محلياً.");
            this.saveSubaccountLocally(newAccount);
          }
        } else {
          this.saveSubaccountLocally(newAccount);
          this.showToast("✅ تم إنشاء حساب الموظف وحفظه محلياً بنجاح!");
        }

        form.reset();
        this.renderSubaccountsList();
      });
    }
  }

  saveSubaccountLocally(account) {
    const subs = JSON.parse(localStorage.getItem("mock_admin_accounts")) || [];
    subs.push(account);
    localStorage.setItem("mock_admin_accounts", JSON.stringify(subs));
  }

  async renderSubaccountsList() {
    const tbody = document.getElementById("subaccounts-table-body");
    if (!tbody) return;

    let subAccounts = [];

    if (!isMock) {
      try {
        const querySnapshot = await getDocs(collection(db, "admin_accounts"));
        querySnapshot.forEach((doc) => {
          subAccounts.push({ id: doc.id, ...doc.data() });
        });
      } catch (err) {
        console.warn("Firestore Sub-accounts fetch failed:", err);
      }
    }

    const localSubs = JSON.parse(localStorage.getItem("mock_admin_accounts")) || [];
    localSubs.forEach(ls => {
      if (!subAccounts.find(s => s.email === ls.email)) {
        subAccounts.push(ls);
      }
    });

    if (subAccounts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-6 text-center text-slate-500 font-Cairo font-semibold">لا يوجد حسابات فرعية نشطة حالياً. أضف موظفاً لبدء تفويض الصلاحيات!</td>
        </tr>
      `;
      return;
    }

    let html = "";
    subAccounts.forEach(sub => {
      const roleText = sub.role === "orders" ? "إدارة الطلبات المباشرة" : "إدارة منيو المنتجات والاشتراكات";
      const roleColor = sub.role === "orders" ? "text-amber-400 bg-amber-500/10 border-amber-500/10" : "text-blue-400 bg-blue-500/10 border-blue-500/10";
      
      html += `
        <tr class="border-b border-slate-900 hover:bg-slate-900/10 transition font-Cairo">
          <td class="py-3.5 text-white font-bold text-right">${sub.name}</td>
          <td class="py-3.5 text-slate-300 text-right font-mono">${sub.email}</td>
          <td class="py-3.5 text-slate-400 text-center font-mono">••••••••</td>
          <td class="py-3.5 text-center">
            <span class="px-2.5 py-1 rounded-lg border text-[10px] font-black ${roleColor}">${roleText}</span>
          </td>
          <td class="py-3.5 text-left">
            <button onclick="window.adminPanel.deleteSubaccount('${sub.id}', '${sub.email}')" 
                    class="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 hover:text-rose-450 border border-rose-500/20 rounded-lg text-[10px] font-bold transition-all cursor-pointer">
              حذف الحساب
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  async deleteSubaccount(subId, email) {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف حساب الموظف (${email})؟`)) return;

    if (!isMock) {
      try {
        await deleteDoc(doc(db, "admin_accounts", subId));
        this.showToast("✅ تم حذف حساب الموظف من قاعدة البيانات السحابية!");
      } catch (err) {
        console.warn("Delete subaccount Firestore failed, trying local removal:", err);
      }
    }

    let localSubs = JSON.parse(localStorage.getItem("mock_admin_accounts")) || [];
    localSubs = localSubs.filter(s => s.id !== subId && s.email !== email);
    localStorage.setItem("mock_admin_accounts", JSON.stringify(localSubs));
    
    this.showToast("✅ تم تحديث قائمة الموظفين بنجاح.");
    this.renderSubaccountsList();
  }
}

// تشغيل اللوحة وتهيئة تحكم المدير عالمياً
document.addEventListener("DOMContentLoaded", () => {
  const adminPanel = new AdminPanel();
  window.adminPanel = adminPanel;
});
