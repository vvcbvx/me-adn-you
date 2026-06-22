// معالج منطق واجهة المستخدم وعرض المنتجات في كافيه "أنا وإياك"
// فحص فوري ونقل المدراء والمشرفين ومسؤولي الطلبات والمنتجات إلى إداراتهم مباشرة عند فتح الكافيه
// السماح للمدراء بتصفح الصفحة الرئيسية والمعاينة دون إعادة توجيه قسرية لتمكين المعاينة الفخمة
// شريط العودة العائم يتم حقنه تلقائياً من ملف cart.js المشترك لسهولة العودة للإدارة


import { db, isMock, collection, getDocs, query, orderBy } from "./firebase.js";

class CafeApp {
  constructor() {
    this.products = [];
    this.currentFilter = "all";
    this.searchQuery = "";
    this.selectedProductForModal = null;
    this.selectedSize = "medium";
    this.selectedQuantity = 1;

    this.init();
  }

  async init() {
    await this.fetchProducts();
    this.renderProducts();
    this.setupEventListeners();
  }

  // جلب المنتجات من Firestore أو المحاكي
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
    } catch (error) {
      console.error("Error fetching menu items:", error);
      // استخدام البذور الاحتياطية في حال تعثر الاتصال
      this.products = JSON.parse(localStorage.getItem("mock_menu")) || [];
    }
  }

  // رسم بطاقات المنتجات
  renderProducts() {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    // تصفية العناصر بناء على التصنيف والبحث
    const filtered = this.products.filter(prod => {
      const matchCategory = this.currentFilter === "all" || prod.category === this.currentFilter;
      const matchSearch = prod.name.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
                          prod.description.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-20 text-center flex flex-col items-center justify-center">
          <svg class="w-16 h-16 text-slate-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p class="text-slate-400 font-medium">لم نجد أي طلبات مطابقة لبحثك في المتجر حالياً.</p>
        </div>
      `;
      return;
    }

    let html = "";
    filtered.forEach(prod => {
      // الحصول على السعر الافتراضي (الحجم الوسط)
      const mediumSize = prod.sizes.find(s => s.size === "medium") || prod.sizes[0];
      const displayPrice = mediumSize.price;

      html += `
        <div class="glass-panel glass-panel-hover rounded-2xl overflow-hidden group cursor-pointer flex flex-col justify-between" 
             onclick="window.cafeApp.openProductModal('${prod.id}')" id="prod-card-${prod.id}">
          <div class="relative overflow-hidden aspect-square">
            <img src="${prod.image}" alt="${prod.name}" 
                 class="w-full h-full object-cover group-hover:scale-115 transition-transform duration-500">
            ${prod.featured ? `
              <span class="absolute top-3 right-3 bg-gold-gradient text-slate-950 font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md pulse-gold">
                عرض خاص
              </span>
            ` : ""}
          </div>

          <div class="p-4 flex-1 flex flex-col justify-between">
            <div>
              <h3 class="text-base font-extrabold text-white group-hover:text-amber-400 transition-colors mb-1.5 duration-300">
                ${prod.name}
              </h3>
              <p class="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                ${prod.description}
              </p>
            </div>

            <div class="flex items-center justify-between mt-auto">
              <div>
                <span class="text-[10px] text-slate-500 block">بدءاً من</span>
                <span class="text-sm font-black text-amber-400 font-mono">${displayPrice.toLocaleString()} ل.س</span>
              </div>
              <button class="w-9 h-9 bg-slate-850 hover:bg-gold-gradient text-slate-300 hover:text-slate-950 rounded-xl flex items-center justify-center border border-slate-750 transition-all duration-300 shadow-md">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  }

  // إعداد النوافذ المنبثقة للمنتج للتخصيص
  openProductModal(productId) {
    const prod = this.products.find(p => p.id === productId);
    if (!prod) return;

    this.selectedProductForModal = prod;
    this.selectedSize = "medium";
    this.selectedQuantity = 1;

    const modal = document.getElementById("product-detail-modal");
    if (!modal) return;

    // تعبئة البيانات في المودال
    document.getElementById("modal-prod-image").src = prod.image;
    document.getElementById("modal-prod-name").textContent = prod.name;
    document.getElementById("modal-prod-desc").textContent = prod.description;

    // رسم خيارات الأحجام
    const sizesContainer = document.getElementById("modal-sizes-container");
    let sizesHtml = "";
    
    // الأحجام المتاحة
    prod.sizes.forEach(sz => {
      const label = sz.size === "small" ? "صغير" : sz.size === "medium" ? "وسط" : "كبير";
      const isSelected = sz.size === this.selectedSize;
      
      sizesHtml += `
        <button onclick="window.cafeApp.selectSize('${sz.size}')" 
                class="flex flex-col items-center justify-center py-2.5 px-3 rounded-xl border transition-all duration-300 text-center ${
                  isSelected 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-gold' 
                    : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:border-slate-700'
                }" id="size-btn-${sz.size}">
          <span class="text-xs font-bold mb-1">${label}</span>
          <span class="text-xs font-mono opacity-80">${sz.price.toLocaleString()} ل.س</span>
        </button>
      `;
    });
    sizesContainer.innerHTML = sizesHtml;

    // تحديث الأزرار والمبالغ الإجمالية بالنافذة
    this.updateModalPriceAndQty();

    // إظهار المودال
    modal.classList.remove("hidden");
    document.getElementById("modal-overlay").classList.remove("hidden");
  }

  closeProductModal() {
    const modal = document.getElementById("product-detail-modal");
    if (modal) {
      modal.classList.add("hidden");
      document.getElementById("modal-overlay").classList.add("hidden");
    }
    this.selectedProductForModal = null;
  }

  // تعديل الحجم من المودال
  selectSize(sizeName) {
    this.selectedSize = sizeName;
    
    // تحديث التنسيق البصري للأحجام
    const prod = this.selectedProductForModal;
    prod.sizes.forEach(sz => {
      const btn = document.getElementById(`size-btn-${sz.size}`);
      if (btn) {
        if (sz.size === sizeName) {
          btn.className = "flex flex-col items-center justify-center py-2.5 px-3 rounded-xl border transition-all duration-300 text-center bg-amber-500/20 text-amber-400 border-amber-500 shadow-gold";
        } else {
          btn.className = "flex flex-col items-center justify-center py-2.5 px-3 rounded-xl border transition-all duration-300 text-center bg-slate-950/40 text-slate-400 border-slate-800 hover:border-slate-700";
        }
      }
    });

    this.updateModalPriceAndQty();
  }

  // زيادة أو نقصان كمية المودال
  updateQuantity(delta) {
    this.selectedQuantity += delta;
    if (this.selectedQuantity < 1) this.selectedQuantity = 1;
    this.updateModalPriceAndQty();
  }

  // تحديث الزر الرئيسي الحسابي بالمودال
  updateModalPriceAndQty() {
    const qtyEl = document.getElementById("modal-qty");
    const addBtn = document.getElementById("modal-add-to-cart-btn");
    
    if (!this.selectedProductForModal) return;

    if (qtyEl) qtyEl.textContent = this.selectedQuantity;

    const sizeObj = this.selectedProductForModal.sizes.find(s => s.size === this.selectedSize) || this.selectedProductForModal.sizes[0];
    const totalOrderCost = sizeObj.price * this.selectedQuantity;

    if (addBtn) {
      addBtn.textContent = `أضف إلى السلة - ${totalOrderCost.toLocaleString()} ل.س`;
    }
  }

  // إضافة طلب المودال الحالي للسلة
  addCurrentToCart() {
    if (!this.selectedProductForModal) return;
    
    const sizeObj = this.selectedProductForModal.sizes.find(s => s.size === this.selectedSize) || this.selectedProductForModal.sizes[0];
    window.cart.addItem(
      this.selectedProductForModal,
      this.selectedSize,
      sizeObj.price,
      this.selectedQuantity
    );

    this.closeProductModal();
  }

  // ضبط منسقي الأحداث
  setupEventListeners() {
    // التصفية بحسب التصنيفات
    const tabs = document.querySelectorAll(".menu-tab");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => {
          t.classList.remove("bg-gold-gradient", "text-slate-950", "px-6", "py-2", "rounded-full");
          t.classList.add("text-slate-400");
        });
        
        tab.classList.add("bg-gold-gradient", "text-slate-950", "px-6", "py-2", "rounded-full");
        tab.classList.remove("text-slate-400");

        this.currentFilter = tab.getAttribute("data-category");
        this.renderProducts();
      });
    });

    // البحث المطابق
    const searchInput = document.getElementById("product-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value;
        this.renderProducts();
      });
    }

    // إغلاق المودال
    const closeModalBtn = document.getElementById("close-modal-btn");
    const modalOverlay = document.getElementById("modal-overlay");

    if (closeModalBtn) closeModalBtn.addEventListener("click", () => this.closeProductModal());
    if (modalOverlay) modalOverlay.addEventListener("click", () => this.closeProductModal());

    const modalAddBtn = document.getElementById("modal-add-to-cart-btn");
    if (modalAddBtn) {
      modalAddBtn.addEventListener("click", () => this.addCurrentToCart());
    }

    const qtyPlus = document.getElementById("modal-qty-plus");
    const qtyMinus = document.getElementById("modal-qty-minus");

    if (qtyPlus) qtyPlus.addEventListener("click", () => this.updateQuantity(1));
    if (qtyMinus) qtyMinus.addEventListener("click", () => this.updateQuantity(-1));
  }
}

// تشغيل وتهيئة التطبيق عالمياً للتحكم
document.addEventListener("DOMContentLoaded", () => {
  const cafeApp = new CafeApp();
  window.cafeApp = cafeApp;
});
