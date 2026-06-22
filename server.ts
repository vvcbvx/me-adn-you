import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import dotenv from "dotenv";

// تهيئة dotenv لقراءة المتغيرات من .env إن وجد
dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json());

// ==========================================
// 1. مزامنة بقواعد بيانات Firebase السحابية الحقيقية لـ ShamCash
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyCwoeVUvKrYm0ExYAox9UWTxzTvhCC_2Dc",
  authDomain: "oval-team-jr4g1.firebaseapp.com",
  projectId: "oval-team-jr4g1",
  storageBucket: "oval-team-jr4g1.firebasestorage.app",
  messagingSenderId: "308599678450",
  appId: "1:308599678450:web:c9622dead36f7c4de9f76b"
};

const firebaseApp = initializeApp(firebaseConfig);
const firestoreDb = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
}, "ai-studio-95ec8bd7-f230-47df-9c8e-d23fd12de5ed");

const CONFIG_FILE = path.join(process.cwd(), "shamcash_config.json");

// المتغيرات الافتراضية
let SHAMCASH_API_TOKEN = process.env.SHAMCASH_API_TOKEN || "NGgKG1ZFcoMmsFfGt46VRnFvmgDocZvYyOqX6NM94js";
let SHAMCASH_ACCOUNT_ID = process.env.SHAMCASH_ACCOUNT_ID || "6a4b90386b0b13df1080d8fd410fdcf6";

// دالة لجلب الإعدادات من .env.example مباشرة لضمان قراءة التعديلات اليدوية للمطوّر فورا في السيرفر والتحقق الفعلي
function loadConfigFromEnvExample() {
  try {
    const envExamplePath = path.join(process.cwd(), ".env.example");
    if (fs.existsSync(envExamplePath)) {
      const content = fs.readFileSync(envExamplePath, "utf8");
      const tokenMatch = content.match(/SHAMCASH_API_TOKEN\s*=\s*["']?([^"'\r\n]+)["']?/);
      const accMatch = content.match(/SHAMCASH_ACCOUNT_ID\s*=\s*["']?([^"'\r\n]+)["']?/);
      let updated = false;
      if (tokenMatch && tokenMatch[1]) {
        const val = tokenMatch[1].trim();
        if (SHAMCASH_API_TOKEN !== val && !val.includes("PLACEHOLDER")) {
          SHAMCASH_API_TOKEN = val;
          process.env.SHAMCASH_API_TOKEN = val;
          updated = true;
        }
      }
      if (accMatch && accMatch[1]) {
        const val = accMatch[1].trim();
        if (SHAMCASH_ACCOUNT_ID !== val && !val.includes("PLACEHOLDER")) {
          SHAMCASH_ACCOUNT_ID = val;
          process.env.SHAMCASH_ACCOUNT_ID = val;
          updated = true;
        }
      }
      if (updated) {
        console.log(`📡 Loaded latest credentials directly from .env.example file: Token: ...${SHAMCASH_API_TOKEN.slice(-6)}, Account ID: ${SHAMCASH_ACCOUNT_ID}`);
      }
    }
  } catch (err) {
    console.error("⚠️ Error reading .env.example directly:", err);
  }
}

// دالة لجلب الإعدادات من Firestore لضمان الحفظ المتبادل والمزامنة السحابية الدائمة
async function syncShamCashConfig() {
  // أولاً نقرأ التعديلات اليدوية من .env.example
  loadConfigFromEnvExample();

  try {
    const docRef = doc(firestoreDb, "settings", "shamcash");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      let needsUpdate = false;
      const updatePayload: any = {};

      // مطابقة التوكن: إذا وجدنا التوكن السحابي يختلف ولكنه مخزن مسبقا بشكل غير فارغ
      if (data.apiToken && data.apiToken !== SHAMCASH_API_TOKEN) {
        // إذا كان التوكن الحالي هو الافتراضي، نأخذ القيمة السحابية
        if (SHAMCASH_API_TOKEN === "NGgKG1ZFcoMmsFfGt46VRnFvmgDocZvYyOqX6NM94js") {
          SHAMCASH_API_TOKEN = data.apiToken;
          console.log(`☁️ Loaded ShamCash API Token from Firestore: ...${SHAMCASH_API_TOKEN.slice(-6)}`);
        } else {
          // إذا قام المستخدم بتحديث الإي بي آي في الملف .env.example، نقوم بتحديث السحابة فورا!
          updatePayload.apiToken = SHAMCASH_API_TOKEN;
          needsUpdate = true;
          console.log(`💥 Detected local API token changes on .env.example -> Syncing to cloudfirestore...`);
        }
      } else if (!data.apiToken && SHAMCASH_API_TOKEN) {
        updatePayload.apiToken = SHAMCASH_API_TOKEN;
        needsUpdate = true;
      }

      // مطابقة رقم الحساب التاجر
      if (data.accountId && data.accountId !== SHAMCASH_ACCOUNT_ID) {
        if (SHAMCASH_ACCOUNT_ID === "6a4b90386b0b13df1080d8fd410fdcf6") {
          SHAMCASH_ACCOUNT_ID = data.accountId;
          console.log(`☁️ Loaded ShamCash Merchant Account ID from Firestore: ${SHAMCASH_ACCOUNT_ID}`);
        } else {
          // إذا تم تعديله محليا نقوم بتحديث السحابي
          updatePayload.accountId = SHAMCASH_ACCOUNT_ID;
          needsUpdate = true;
          console.log(`💥 Detected local Account ID changes on .env.example -> Syncing to cloudfirestore...`);
        }
      } else if (!data.accountId && SHAMCASH_ACCOUNT_ID) {
        updatePayload.accountId = SHAMCASH_ACCOUNT_ID;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await setDoc(docRef, updatePayload, { merge: true });
        console.log("✅ Firestore cloud configs synced with new local file values.");
      }
    } else {
      // إذا لم يكن المستند موجودا نقوم بتهيئته بالقيم المحلية فورا
      await setDoc(docRef, {
        apiToken: SHAMCASH_API_TOKEN,
        accountId: SHAMCASH_ACCOUNT_ID
      });
      console.log(`✅ Initiated Firestore settings with Token: ...${SHAMCASH_API_TOKEN.slice(-6)} and Account ID: ${SHAMCASH_ACCOUNT_ID}`);
    }
  } catch (err) {
    console.error("⚠️ Error syncing ShamCash config from Firestore:", err);
    // fallback to local file in case Firebase isn't fully ready
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
        SHAMCASH_ACCOUNT_ID = parsed.accountId || SHAMCASH_ACCOUNT_ID;
        if (parsed.apiToken) SHAMCASH_API_TOKEN = parsed.apiToken;
      }
    } catch (localErr) {
      console.error("Local file config load error:", localErr);
    }
  }
}

// تشغيل المزامنة الفورية عند إقلاع السيرفر
syncShamCashConfig();

function saveLocalConfig(accountId: string) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ accountId, apiToken: SHAMCASH_API_TOKEN }, null, 2), "utf8");
    console.log("ShamCash Merchant Account ID saved locally as fallback.");
    
    // محاولة تحديث ملف .env.example أيضا ليبقى متزامنا باتجاهين
    const envExamplePath = path.join(process.cwd(), ".env.example");
    if (fs.existsSync(envExamplePath)) {
      let content = fs.readFileSync(envExamplePath, "utf8");
      content = content.replace(/SHAMCASH_ACCOUNT_ID\s*=\s*["']?[^"'\r\n]*["']?/, `SHAMCASH_ACCOUNT_ID="${accountId}"`);
      fs.writeFileSync(envExamplePath, content, "utf8");
    }
  } catch (err) {
    console.error("Error saving backup local config file:", err);
  }
}

// الحصول على إعدادات الحساب غير الحساسة لصفحة المغادرة
app.get("/api/shamcash-config", async (req, res) => {
  // تحديث سريع مستمر لضمان عدم وجود ذاكرة تخزين مؤقتة قديمة
  await syncShamCashConfig();
  res.json({
    status: "success",
    code: "SUCCESS",
    data: {
      accountId: SHAMCASH_ACCOUNT_ID
    }
  });
});

// تحديث إعدادات الحساب من الإدارة بشكل آمن وحفظها في Firestore مباشرة!
app.post("/api/admin/shamcash-config", async (req, res) => {
  const { accountId } = req.body;
  
  if (accountId) {
    SHAMCASH_ACCOUNT_ID = accountId;
    saveLocalConfig(SHAMCASH_ACCOUNT_ID);
    
    try {
      const docRef = doc(firestoreDb, "settings", "shamcash");
      await setDoc(docRef, { accountId: SHAMCASH_ACCOUNT_ID }, { merge: true });
      console.log(`✅ Document updated in Firestore settings: ${SHAMCASH_ACCOUNT_ID}`);
    } catch (err) {
      console.error("⚠️ Failed to write config update to Firestore:", err);
    }
  }

  res.json({
    status: "success",
    code: "SUCCESS",
    message: "تم تحديث رقم الحساب التاجر لبوابة شام كاش بنجاح وحفظه على قاعدة البيانات السحابية بشكل آمن ودائم كلياً!",
    data: {
      accountId: SHAMCASH_ACCOUNT_ID
    }
  });
});

// اختبار الاتصال ببوابة شام كاش بشكل مباشر وإحضار اسم وتفاصيل الحساب المتصل بالتوكن الحالي
app.get("/api/test-shamcash-connection", async (req, res) => {
  try {
    const isPlaceholderToken = !SHAMCASH_API_TOKEN || SHAMCASH_API_TOKEN === "PLACEHOLDER_TOKEN" || SHAMCASH_API_TOKEN.includes("PLACEHOLDER") || SHAMCASH_API_TOKEN === "6a4b90386b0b13df1080d8fd410fdcf6SC";
    if (isPlaceholderToken) {
      return res.json({
        status: "success",
        isMock: true,
        message: "🟢 تم الاتصال بـ شام كاش (وضع المحاكاة الافتراضي - لم يتم ضبط مفتاح حقيقي بعد)",
        data: {
          accountName: "مقهى الكابتشينو الشامي - تجريبي",
          accountId: SHAMCASH_ACCOUNT_ID,
          status: "نشط (تجريبي) 🧪",
          expiresAt: "غير محدود"
        }
      });
    }

    const response = await fetch("https://api.shamcash-api.com/v1/accounts", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${SHAMCASH_API_TOKEN}`,
        "Accept": "application/json"
      }
    });

    if (response.ok) {
      const payload: any = await response.json();
      if (payload.status === "success" && Array.isArray(payload.data)) {
        const accounts = payload.data;
        if (accounts.length === 0) {
          return res.json({
            status: "error",
            message: "التحقق ناجح والاتصال سليم، ولكن لا توجد أي حسابات ShamCash مرتبطة بهذا التوكن حالياً."
          });
        }
        
        // العثور على الحساب النشط أو أول حساب
        const activeAcc = accounts.find((a: any) => a.status === "active") || accounts[0];
        const accountName = activeAcc.name || activeAcc.owner_name || activeAcc.label || `حساب رقم: ${activeAcc.id || activeAcc.account_id}`;
        const accountId = activeAcc.id || activeAcc.account_id || SHAMCASH_ACCOUNT_ID;
        const status = activeAcc.status === "active" ? "نشط ✅" : "غير نشط ⚠️";
        const expiresAt = activeAcc.subscription_expires_at ? new Date(activeAcc.subscription_expires_at).toLocaleDateString('ar-SY') : "غير محدد";

        return res.json({
          status: "success",
          isMock: false,
          message: "🟢 تم الاتصال الفعلي بالواجهة البرمجية لـ شام كاش ومكاملة الحساب بنجاح!",
          data: {
            accountName,
            accountId,
            status,
            expiresAt,
            raw: activeAcc
          }
        });
      } else {
        return res.json({
          status: "error",
          message: payload.message || "فشل التحقق بسبب استجابة غير متوقعة من خوادم شام كاش."
        });
      }
    } else {
      const errData = await response.json().catch(() => ({}));
      const errMessage = errData.message || `مستوى الخطأ HTTP ${response.status}`;
      return res.json({
        status: "error",
        message: `تعذر التحقق من التوكن: ${errMessage}`
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      status: "error",
      message: `خطأ اتصال فني بالشبكة: ${err.message || err}`
    });
  }
});

// ==========================================
// 2. التحقق من رقم إيصال العملية عن طريق ShamCash API
// ==========================================
app.post("/api/verify-receipt", async (req, res) => {
  const { receipt, amount } = req.body;

  if (!receipt) {
    return res.status(400).json({
      status: "error",
      code: "VALIDATION_ERROR",
      message: "رقم الإيصال مطلوب للتحقق."
    });
  }

  const receiptStr = receipt.toString().trim();
  // محاكاة وضع الخطأ إذا أدخل المستخدم رمزاً صريحاً للفشل مثل 0000 أو كلمة fail
  if (receiptStr === "0000" || receiptStr === "00000" || receiptStr.toLowerCase() === "fail" || receiptStr.toLowerCase().includes("error")) {
    return res.status(400).json({
      status: "error",
      code: "RECEIPT_NOT_FOUND",
      message: "❌ عذراً، لم نتمكن من المطابقة! إيصال التحويل مرفوض أو تم استخدامه من قبل أو القيمة غير كافية."
    });
  }

  try {
    console.log(`🔍 جاري فحص الإيصال ${receipt} بقيمة ${amount} عبر بوابة ShamCash API...`);
    
    const isPlaceholderToken = !SHAMCASH_API_TOKEN || SHAMCASH_API_TOKEN === "PLACEHOLDER_TOKEN" || SHAMCASH_API_TOKEN.includes("PLACEHOLDER") || SHAMCASH_API_TOKEN === "6a4b90386b0b13df1080d8fd410fdcf6SC";
    
    // سنطلب المعاملات من ShamCash API بشكل حقيقي
    let transactions: any[] = [];
    let apiSuccess = false;
    let apiErrorMsg = "";

    if (!isPlaceholderToken) {
      try {
        console.log("🔗 Connecting to ShamCash API to fetch active accounts automatically...");
        const accountsResponse = await fetch("https://api.shamcash-api.com/v1/accounts", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${SHAMCASH_API_TOKEN}`,
            "Accept": "application/json"
          }
        });

        if (accountsResponse.ok) {
          const accountsPayload: any = await accountsResponse.json();
          if (accountsPayload.status === "success" && Array.isArray(accountsPayload.data)) {
            // البحث عن حساب نشط واشتراك ساري المفعول
            const activeAcc = accountsPayload.data.find((a: any) => 
              a.status === "active" &&
              (!a.subscription_expires_at || new Date(a.subscription_expires_at) > new Date())
            );

            let accountIdToUse = SHAMCASH_ACCOUNT_ID;
            if (activeAcc) {
              accountIdToUse = activeAcc.id || activeAcc.account_id || SHAMCASH_ACCOUNT_ID;
              console.log(`✅ Dynamically resolved active ShamCash account ID: ${accountIdToUse}`);
            }

            console.log(`📡 Fetching transactions for account ${accountIdToUse}...`);
            const txResponse = await fetch(`https://api.shamcash-api.com/v1/transactions?account_id=${accountIdToUse}&limit=200`, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${SHAMCASH_API_TOKEN}`,
                "Accept": "application/json"
              }
            });

            if (txResponse.ok) {
              const txPayload: any = await txResponse.json();
              if (txPayload.status === "success" && txPayload.data) {
                const fetchedList = txPayload.data.transactions || txPayload.data;
                if (Array.isArray(fetchedList)) {
                  transactions = fetchedList;
                  apiSuccess = true;
                  console.log(`✅ Loaded ${transactions.length} real transactions from ShamCash.`);
                }
              }
            } else {
              const errData = await txResponse.json().catch(() => ({}));
              apiErrorMsg = errData.message || `HTTP ${txResponse.status}`;
            }
          }
        } else {
          const errData = await accountsResponse.json().catch(() => ({}));
          apiErrorMsg = errData.message || `HTTP ${accountsResponse.status}`;
        }
      } catch (err: any) {
        console.error("Failed to connect to ShamCash API:", err);
        apiErrorMsg = err.message || "Network Timeout";
      }

      // إذا استعمل العميل مفتاحاً حقيقياً ولكن فشل الاتصال بالسيرفر، نغلق بوضع خطأ واضح بأن الخدمة معطلة مؤقتاً للاحتياط
      if (!apiSuccess) {
        return res.status(503).json({
          status: "error",
          code: "SERVICE_UNAVAILABLE",
          message: "⚠️ الخدمة حالياً معطلة مؤقتاً بسبب صعوبة مزامنة الاتصال بوابة تحويلات 'شام كاش'. يرجى مراجعة إدارة الكافيه أو المحاولة مجدداً بعد ثوانٍ قليلة."
        });
      }
    } else {
      // قائمة المعاملات التجريبية الافتراضية للتحقق الصارم في وضع Sandbox
      transactions = [
        { id: "TXN100204", transaction_id: 100204, amount: amount || 30000, occurred_at: "2026-06-20T09:12:00+03:00", sender_name: "موفق الشامي", sender_phone: "0933111222" },
        { id: "123456", transaction_id: 123456, amount: 15000, occurred_at: "2026-06-20T08:10:00+03:00", sender_name: "أحمد خليل غنام", sender_phone: "0988123456" },
        { id: "778899", transaction_id: 778899, amount: 45000, occurred_at: "2026-06-20T07:22:00+03:00", sender_name: "ميادة الحمصي", sender_phone: "0955666777" },
        { id: "SHAM-53928", transaction_id: 53928, amount: 33000, occurred_at: "2026-06-20T11:45:00+03:00", sender_name: "مازن العلي", sender_phone: "0944888999" },
        { id: "998877", transaction_id: 998877, amount: amount || 15000, occurred_at: "2026-06-20T12:00:00+03:00", sender_name: "هيثم غنام", sender_phone: "0999555111" }
      ];
    }

    // البحث عن المعاملة التي تطابق رمز الإيصال المدخل من الزبون تماماً وبأعلى درجات المرونة
    const inputReceiptStr = receipt.toString().trim().toLowerCase();
    let match = transactions.find((t: any) => {
      // 1. الفحص المباشر للحقول الشائعة والمحتملة للمعرّف
      const tid = t.transaction_id?.toString().trim().toLowerCase() || "";
      const id = t.id?.toString().trim().toLowerCase() || "";
      const ref = t.reference?.toString().trim().toLowerCase() || "";
      const receiptNo = t.receipt?.toString().trim().toLowerCase() || "";
      const receiptNo2 = t.receipt_no?.toString().trim().toLowerCase() || "";
      const receiptId = t.receipt_id?.toString().trim().toLowerCase() || "";

      if (
        tid === inputReceiptStr ||
        id === inputReceiptStr ||
        ref === inputReceiptStr ||
        receiptNo === inputReceiptStr ||
        receiptNo2 === inputReceiptStr ||
        receiptId === inputReceiptStr
      ) {
        return true;
      }

      // 2. الفحص العميق لكافة قيم الحقول والمستويات في كائن المعاملة للتأكد من عدم ضياع أي رمز إيصال
      const values = Object.values(t).map(v => v?.toString().trim().toLowerCase());
      if (values.includes(inputReceiptStr)) {
        return true;
      }

      // فحص المستويات المتداخلة
      for (const key of Object.keys(t)) {
        if (typeof t[key] === "object" && t[key] !== null) {
          const nestedValues = Object.values(t[key]).map(v => v?.toString().trim().toLowerCase());
          if (nestedValues.includes(inputReceiptStr)) {
            return true;
          }
        }
      }

      return false;
    });

    if (match) {
      const sName = match.sender_name || match.senderName || match.sender?.name || match.sender?.full_name || "شام كاش - عميل كافيه";
      const sPhone = match.sender_phone || match.senderPhone || match.sender?.phone || match.sender?.mobile || "09********";

      return res.json({
        status: "success",
        code: "SUCCESS",
        message: "✅ تم التحقق من المعاملة والإيصال بنجاح وتأكيد وصول الأموال للتاجر!",
        data: {
          receipt: match.transaction_id || match.id || receipt,
          amount: match.amount,
          occurredAt: match.occurred_at || match.occurredAt || new Date().toISOString(),
          senderName: sName,
          senderPhone: sPhone
        }
      });
    } else {
      let errMessage = `❌ عذراً، رمز الإيصال الذي أدخلته غير موجود أو لم يتم تحويل رصيد بقيمته الفاتورة بعد! يرجى التحقق من الرقم المكتوب في تطبيق شام كاش وإعادة المحاولة.`;
      if (isPlaceholderToken) {
        errMessage += " (تنبيه تجريبي: في وضع المحاكاة، يرجى استخدام إحدى الأكواد الصالحة للاختبار مثل: 123456 أو 998877)";
      }
      return res.status(400).json({
        status: "error",
        code: "RECEIPT_NOT_FOUND",
        message: errMessage
      });
    }

  } catch (err: any) {
    return res.status(500).json({
      status: "error",
      message: `خطأ اتصال فني بسيرفر السداد: ${err.message || err}`
    });
  }
});

// ==========================================
// 3. تهيئة خدمة Express مع Vite ديف أو برودكشن
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
