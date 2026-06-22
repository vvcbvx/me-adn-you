// نظام حماية المدير وتسجيل الدخول بـ Firebase Auth ودعم الحسابات الفرعية
import { 
  auth, 
  db,
  isMock,
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  collection,
  getDocs,
  where,
  query
} from "./firebase.js";

// دالة مخصصة لإخفاء روابط القائمة الجانبية وتطويعها لملائمة صلاحيات المستخدم الحالي
function customizeSidebarForRole(role) {
  const sidebar = document.querySelector("aside");
  if (!sidebar) return;

  const links = sidebar.querySelectorAll("nav a");
  links.forEach(link => {
    const href = link.getAttribute("href") || "";
    
    if (role === "orders") {
      // فقط طلبات وإحصائيات
      if (href.includes("products.html") || href.includes("subscriptions.html")) {
        link.classList.add("hidden");
      }
    } else if (role === "products") {
      // فقط منتجات واشتراكات
      if (href.includes("dashboard.html") || href.includes("orders.html")) {
        link.classList.add("hidden");
      }
    }
  });
}

// التحقق من حالة المصادقة وحماية صفحات الإدارة
export function initAuthProtection() {
  const currentPath = window.location.pathname;
  const isLocalStorageLoggedIn = localStorage.getItem("mock_admin_logged") === "true";
  const currentRole = localStorage.getItem("admin_role") || "full";
  const currentEmail = localStorage.getItem("admin_email") || "admin@cafe.com";
  const currentName = localStorage.getItem("admin_name") || "المدير";

  // فحص حماية الصفحات والزيارات بشكل متزامن فوري لتفادي التأخير والرسم المؤقت
  if (currentPath.includes("/admin/") && !currentPath.includes("login.html")) {
    if (!isLocalStorageLoggedIn) {
      console.warn("🔒 دخول غير مصرح به. إعادة التوجيه إلى صفحة تسجيل الدخول...");
      window.location.replace("/admin/login.html");
      return;
    }

    // تطبيق حظر الصفحات الغير مصرحة للدور الحالي فوراً
    if (currentRole === "orders" && (currentPath.includes("products.html") || currentPath.includes("subscriptions.html"))) {
      console.warn("🔒 صلاحية غير كافية لمدير الطلبات.");
      window.location.replace("/admin/orders.html?denied=true");
      return;
    } else if (currentRole === "products" && (currentPath.includes("dashboard.html") || currentPath.includes("orders.html"))) {
      console.warn("🔒 صلاحية غير كافية لمدير المنتجات والمنيو.");
      window.location.replace("/admin/products.html?denied=true");
      return;
    }

    // تخصيص السايدبار لإظهار التبويبات المسموحة فقط
    customizeSidebarForRole(currentRole);

    // ملء بيانات الموظف والمسؤول في الصفحة فوراً
    const adminEmailElements = document.querySelectorAll(".admin-email-display");
    const roleLabel = currentRole === "full" ? "المدير العام" : currentRole === "orders" ? "مسؤول الطلبات" : "مسؤول المنتجات والمنيو";
    adminEmailElements.forEach(el => {
      el.textContent = `${currentName} (${roleLabel})`;
    });
  }

  // إذا كنا بصفحة تسجيل الدخول والمدير مسجل بالفعل، يتم توجيهه إلى لوحته مباشرة
  if (currentPath.includes("login.html") && isLocalStorageLoggedIn) {
    if (currentRole === "products") {
      window.location.replace("/admin/products.html");
    } else if (currentRole === "orders") {
      window.location.replace("/admin/orders.html");
    } else {
      window.location.replace("/admin/dashboard.html");
    }
    return;
  }
  
  onAuthStateChanged(auth || {}, (user) => {
    // التحقق بالخلفية لضمان تعاضد الجلسات
    const isMockLoggedIn = localStorage.getItem("mock_admin_logged") === "true";
    const loggedIn = user || isMockLoggedIn;

    if (currentPath.includes("/admin/") && !currentPath.includes("login.html")) {
      if (!loggedIn) {
        window.location.replace("/admin/login.html");
        return;
      }
      
      // تحديث متأخر للمعلومات إن لزم
      const adminEmailElements = document.querySelectorAll(".admin-email-display");
      const roleLabel = currentRole === "full" ? "المدير العام" : currentRole === "orders" ? "مسؤول الطلبات" : "مسؤول المنتجات والمنيو";
      adminEmailElements.forEach(el => {
        el.textContent = `${localStorage.getItem("admin_name") || currentName} (${roleLabel})`;
      });
      
      customizeSidebarForRole(currentRole);

      // تنبيه الحظر إن وجد في رابط الصفحة
      if (window.location.search.includes("denied=true")) {
        setTimeout(() => {
          if (window.adminPanel && window.adminPanel.showToast) {
            window.adminPanel.showToast("⚠️ عذراً! ليس لديك صلاحية لدخول هذه الصفحة.");
          } else {
            alert("⚠️ عذراً! ليس لديك صلاحية لدخول هذه الصفحة.");
          }
          window.history.replaceState({}, document.title, window.location.pathname);
        }, 500);
      }
    }
  });

  // طلب إذن للإشعارات على الهاتف لدعم الميزة المطلوبة
  if ("Notification" in window && Notification.permission === "default" && currentPath.includes("/admin/")) {
    document.addEventListener("click", () => {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }, { once: true });
  }
}

// دالة تسجيل الدخول بمستويين (المدير الرئيسي والفرعي)
export async function loginAdmin(email, password) {
  const cleanEmail = email.trim().toLowerCase();

  // 1. أولاً: فحص الحسابات الفرعية والموظفين من السحابة أو الكائن المحلي
  let foundSub = null;
  if (!isMock) {
    try {
      const q = query(collection(db, "admin_accounts"), where("email", "==", cleanEmail));
      const qSnap = await getDocs(q);
      qSnap.forEach(d => {
        const data = d.data();
        if (data.password === password) {
          foundSub = { id: d.id, ...data };
        }
      });
    } catch (e) {
      console.warn("Error querying database sub-accounts, falling back to local list:", e);
    }
  }

  // في حال فشل الاتصال بالسحابة أو كنا بالوضع التجريبي: نبحث في الـ LocalStorage
  if (!foundSub) {
    const localSubs = JSON.parse(localStorage.getItem("mock_admin_accounts")) || [];
    const match = localSubs.find(s => s.email.toLowerCase() === cleanEmail && s.password === password);
    if (match) {
      foundSub = match;
    }
  }

  // إذا وجدنا حساباً مخصصاً للموظف، نعتمد تسجيل دخوله فوراً بالصلاحيات المحددة
  if (foundSub) {
    localStorage.setItem("mock_admin_logged", "true");
    localStorage.setItem("admin_role", foundSub.role);
    localStorage.setItem("admin_name", foundSub.name);
    localStorage.setItem("admin_email", foundSub.email);
    return { success: true, user: { email: foundSub.email } };
  }

  // 2. ثانياً: تسجيل حساب المدير الرئيسي الافتراضي
  if (cleanEmail === "admin@cafe.com" && password === "admin123") {
    localStorage.setItem("mock_admin_logged", "true");
    localStorage.setItem("admin_role", "full");
    localStorage.setItem("admin_name", "المدير العام");
    localStorage.setItem("admin_email", "admin@cafe.com");
    return { success: true, user: { email: "admin@cafe.com" } };
  }

  if (isMock) {
    throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة! جرب: admin@cafe.com مع باسورود admin123");
  }

  // 3. ثالثاً: المحاولة مع Firebase Auth حركياً للحساب الحقيقي المخزن
  try {
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    // تعيين المدير الكامل كصلاحية كاملة للمدراء الأصليين المسجلين بـ Auth
    localStorage.setItem("mock_admin_logged", "true");
    localStorage.setItem("admin_role", "full");
    localStorage.setItem("admin_name", "المدير العام (سحابي)");
    localStorage.setItem("admin_email", userCredential.user.email);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error("Authentication Error:", error);
    let errorMsg = "حدث خطأ أثناء تسجيل الدخول.";
    if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
      errorMsg = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    }
    throw new Error(errorMsg);
  }
}

// دالة تسجيل الخروج لتنظيف كافة البيانات
export async function logoutAdmin() {
  localStorage.removeItem("mock_admin_logged");
  localStorage.removeItem("admin_role");
  localStorage.removeItem("admin_name");
  localStorage.removeItem("admin_email");

  if (!isMock) {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  }
  
  window.location.href = "/admin/login.html";
}

// تشغيل الفحص عالمياً بمجرد استيراد الملف في صفحات المدير
document.addEventListener("DOMContentLoaded", () => {
  initAuthProtection();

  // ربط زر تسجيل الخروج إن وجد
  const logoutBtn = document.getElementById("admin-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logoutAdmin();
    });
  }
});
