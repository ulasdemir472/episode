# Episode — Proje Özeti ve AI Çalışma Kuralları

Bu dosya, yapay zekanın (Gemini / Antigravity) projeyi her seferinde tümden taramasını önlemek ve **token tasarrufu sağlamak** amacıyla hazırlanmış mimari ve kural özetidir.

---

## 1. Proje ve Teknoloji Yığını
- **Framework:** Expo (SDK 57) + React Native (0.86) + TypeScript
- **Yönlendirme:** Expo Router (Dosya tabanlı yönlendirme: `app/`)
- **Server State:** `@tanstack/react-query` (Oturum içi cache ve query lifecycle)
- **Client State:** `zustand` (Kullanıcı oturumu, tema, filtreler vb.)
- **Backend & Veritabanı:** Supabase (Auth, PostgreSQL RLS, Edge Functions)
- **Yerel Cache:** `@react-native-async-storage/async-storage` (CacheStore adaptörü)
- **Animasyon & UI:** `react-native-reanimated`, `expo-blur`, `expo-linear-gradient`
- **Paket Yöneticisi:** `pnpm`

---

## 2. Klasör ve Modül Haritası
- `app/` → Ekranlar, navigation stack'leri ve modal rotaları (`Expo Router`).
- `src/components/` → Ortak, yeniden kullanılabilir UI bileşenleri (Butonlar, kartlar, listeler).
- `src/domain/` → Domain modelleri, veri tipleri ve DTO dönüşüm fonksiyonları.
- `src/features/` → İşlev bazlı modüller (`community`, `sync` vb.).
- `src/hooks/` → Özel React hook'ları (`useQuery` sarmalayıcıları vb.).
- `src/infrastructure/` → Cache mekanizması (`RequestCache`, `CacheStore`), Supabase client ve depolama adaptörleri.
- `src/services/` → `CatalogService` ve harici servis çağrıları.
- `src/store/` → Zustand store tanımları.
- `src/theme/` → Renk paleti, tipografi, spacing ve tasarım token'ları.
- `src/types/` → Proje genelinde kullanılan TypeScript arayüz ve tipleri.
- `supabase/` → Edge Functions ve veritabanı migrasyonları.
- `docs/` → Detaylı mimari (`docs/architecture.md`) ve test rehberleri.

---

## 3. Mimari ve Veri Akışı Kuralları
1. **Veri Akış Zinciri:**
   `Screen / Expo Router` ➔ `React Query` ➔ `CatalogService` ➔ `RequestCache` ➔ `Supabase Edge Function` ➔ `TMDB / OMDb`
2. **API Anahtarları:** TMDB ve OMDb anahtarları **asla** istemci koduna (`EXPO_PUBLIC_*`) yazılmaz; yalnızca Supabase Edge Function secret'larında tutulur.
3. **Doğrudan Servis Çağrısı Yapma:** Ekranlar harici API'lere doğrudan bağlanmaz; daima `CatalogService` ve `RequestCache` üzerinden veri çeker.
4. **Cache & Kota:** Arama 450ms debounced'dır. OMDb kota limiti (günlük 1000) sebebiyle sezonluk tek çağrı ve PostgreSQL ortak cache kullanılır.

---

## 4. Token Tasarrufu ve Agent Davranış Kuralları
- **Körlemesine Tarama Yapma:** Kullanıcı belirli bir özellik veya hata belirttiğinde tüm dizinleri (`src/`, `app/` vb.) sırayla listelemek yerine doğrudan ilgili alt klasöre ve dosyaya git.
- **Büyük Dosyaları Okuma:** `pnpm-lock.yaml`, build çıktıları, `node_modules` veya binary varlıkları asla okuma.
- **Doğrulama Komutları:**
  - Tip kontrolü: `pnpm run typecheck`
  - Lint: `pnpm run lint`
  - Test: `pnpm run test:business` veya `pnpm test`
