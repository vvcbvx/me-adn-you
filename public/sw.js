const CACHE_NAME = 'ana-wa-iyak-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/cart.html',
  '/orders.html',
  '/checkout.html',
  '/assets/css/style.css',
  '/assets/js/app.js',
  '/assets/js/cart.js',
  '/assets/js/auth.js',
  '/assets/js/firebase.js',
  '/app-icon.jpg',
  '/aborashid.jpg',
  '/manifest.json'
];

// تثبيت ملف الخدمة (Service Worker) وحفظ الملفات الثابتة في الكاش
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Core assets pre-cached successfully!');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('⚠️ Some optional assets skipped caching during install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// تفعيل ملف الخدمة وحذف رصيد الكاش القديم إن وجد
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('🧹 Purging outdated PWA cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// اعتراض الطلبات وإدارتها (Network-First لطلبات API، و Cache-First للملفات الثابتة)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // استثني طلبات الـ API والخدمات الخارجية مثل الفايربيس وشام كاش لكي تعمل لحظياً دائماً
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // إذا انقطع الإنترنت تماماً عن طلب الـ API، أعد استجابة غير متصل
        return new Response(JSON.stringify({ 
          status: 'error', 
          message: 'أنت غير متصل بالإنترنت حالياً 🌐' 
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // استراتيجية Cache First مع الـ Fallback to Network للموارد الثابتة والصور والأيقونات
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // تحديث الكاش في الخلفية لضمان بقاء التطبيق حديثاً (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {/* نتجاوز الخطأ عند عدم وجود اتصال شبكة لإحضار التحديث */});
        
        return cachedResponse;
      }

      // إن لم يكن في الكاش، قم بجلبه من الشبكة وحفظه اختيارياً
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // احفظ الأصول الثابتة التي يزورها المستخدم في الكاش
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          // تجنب حفظ ملفات التعديل المؤقتة أو الـ WebSockets
          if (!url.pathname.includes('hot-update') && !url.pathname.includes('socket')) {
            cache.put(event.request, responseToCache);
          }
        });

        return response;
      }).catch(() => {
        // إذا كان يطلب صفحة HTML وانقطع الاتصال، أعد صفحة index الرئيسية
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/');
        }
      });
    })
  );
});
