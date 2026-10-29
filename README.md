# Episode

GitHub Actions testleri, Supabase migration/fonksiyon dağıtımını ve bildirim worker kontrolünü mobil güncellemeden önce otomatik çalıştırır. Bir defalık secret ayarları: [bildirim ve dağıtım rehberi](docs/notification-deployment.md).

Film ve dizileri keşfetmek, izleme listelerini yönetmek ve yeni bölümleri takip etmek için iOS ve Android hedefli cross-platform React Native uygulaması.

## Neler hazır?

- Sinematik koyu tema, erişilebilir sekme navigasyonu ve responsive kartlar
- Ana sayfa, keşif/arama, yeni bölümler, kişisel liste ve detay ekranı
- TMDB üzerinden tamamen dinamik film, dizi, sezon, bölüm ve yayın takvimi
- Cihaz + Supabase ortak cache, stale-if-error, kota sayacı ve sunucuda gizlenen API anahtarları
- AsyncStorage üzerinde kalıcı izleme listesi
- Bildirim izni ve yerel hatırlatıcı altyapısı
- TypeScript strict mode, ESLint, Jest ve GitHub Actions kalite kapısı
- EAS Build profilleri, PR preview workflow'u ve manuel mağaza build workflow'u

## Yerelde çalıştırma

Gereksinimler: Node.js `22.13+`, npm ve telefonda Expo Go. iOS simülatörü yalnızca macOS'ta çalışır; Windows'ta Android Emulator veya fiziksel telefon kullanılabilir.

```bash
corepack enable
pnpm install
copy .env.example .env
pnpm start
```

Terminalde çıkan QR kodu Expo Go ile okut. Android emülatör için `pnpm android` kullan.

### TMDB ve IMDb puanları

1. [TMDB](https://www.themoviedb.org/) hesabı aç ve e-postanı doğrula.
2. `Settings → API → Request an API Key → Developer` yolunu izleyip uygulama formunu doldur.
3. API sayfasındaki uzun **API Read Access Token** değerini GitHub Actions'a `TMDB_ACCESS_TOKEN`, OMDb anahtarını `OMDB_API_KEY` secret'ı olarak ekle. Workflow bunları Supabase Edge Functions'a aktarır. Supabase'de zaten tanımlılarsa tekrar eklemek gerekmez.

IMDb'nin herkese açık resmi bir API'si yoktur; puanlar [OMDb API](https://www.omdbapi.com/apikey.aspx) üzerinden gelir. Bu anahtarları `.env` veya EAS environment içine `EXPO_PUBLIC_*` adıyla koyma; mobil paketten okunabilirler.

### Supabase auth ve veritabani

1. Supabase dashboard'da `Project Settings -> API` alanindan Project URL ve Publishable key degerlerini al.
2. `.env` ve EAS `preview` environment icine su degiskenleri ekle:

```env
EXPO_PUBLIC_SUPABASE_URL=https://project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=publishable_key
```

3. [Dağıtım rehberindeki](docs/notification-deployment.md) GitHub Actions secret'larını tanımla. `main` push'larında tüm bekleyen migration'lar otomatik uygulanır; SQL Editor'de dosyaları tek tek çalıştırma.
4. `Authentication -> URL Configuration` altinda `Site URL` degerini `http://localhost:3000` yerine production web sitene ya da gecici olarak `episode://auth` degerine cek.
5. Ayni ekranda Allowed Redirect URLs listesine `episode://auth`, `episode://reset-password` ve `episode://**` ekle.
6. Confirm veya reset password mailleri hala localhost'a gidiyorsa `Authentication -> Email Templates -> Confirm signup` ve `Reset password` icinde hazir sablonlari kullanabilirsin: Episode logolu hazir template'ler icin `docs/supabase-confirm-signup-template.html` ve `docs/supabase-password-reset-template.html` dosyalarinin iceriklerini ilgili sablon alanlarina yapistir.
7. Preview build yüklüyse JS değişiklikleri `main` push'undan sonra otomatik OTA ile gelir. Migration veya worker kontrolü başarısız olursa OTA gönderilmez.

Arkadaşlık ve avatar Storage migration'ları da aynı zincirde uygulanır. Mevcut build `expo-image-picker` içermiyorsa fotoğraf yükleme için yeni native build gerekir.

### Ortak katalog cache'ini kurma

1. Yukarıdaki GitHub Actions/Supabase secret ayarlarını tamamla. Katalog cache migration'ı ve `catalog-api` fonksiyonu otomatik dağıtılır; JWT ayarları `supabase/config.toml` üzerinden korunur.
2. `external_api_usage_daily` tablosunu Table Editor'den veya [mimari dokümanındaki](docs/architecture.md) sorguyla izle. OMDb dış istekleri günlük 950'de durur; cache'teki stale puanlar 30 güne kadar servis edilmeye devam eder.
3. Eski `EXPO_PUBLIC_TMDB_ACCESS_TOKEN` ve `EXPO_PUBLIC_OMDB_API_KEY` değerlerini EAS environment'lardan sil. Kod artık bunları kullanmaz.

## Test kullanicilarina dagitim

1. `eas build --platform ios --profile preview` ile internal distribution build olustur.
2. EAS'in verdigi QR/linki Apple Developer hesabinda kayitli cihazlara gonder.
3. Daha genis iOS testi icin App Store Connect'te TestFlight kullan; yeni tester email'lerini ekleyip build'i External Testing'e ac.
4. Yalnızca JS değişiklikleri için `main` push'u preview OTA güncellemesini otomatik gönderir.
5. Tester'larin farkli hesaplarla kayit olmasini, kullanici adi belirlemesini, birbirini aratip arkadas istegi gondermesini ve kabul etmesini kontrol et.

## Kontroller

```bash
npm run typecheck
npm run lint
npm test
npm run validate
```

Her testin hangi kullanıcı davranışını koruduğu ve hangi komutun ne zaman çalıştırılacağı [test rehberinde](docs/testing.md) açıklanmıştır.

iPhone'daki sürüm kabulü için [TestFlight kontrol listesini](docs/testflight-checklist.md) kullan. Bu listede yeni “İzlendi / Watched” rozeti, bildirimler, hesap/veri ayrımı ve çevrimdışı senaryolar için beklenen sonuçlar bulunur; Deno'nun görevi de açıklanır.

## Üretime geçiş

1. `npx eas-cli login` ve ardından `npx eas-cli init` çalıştır; oluşan project ID'yi `app.json` içindeki yer tutucuyla değiştir.
2. Bundle ID/package adlarını kendi şirket alan adına göre güncelle.
3. [Dağıtım rehberindeki](docs/notification-deployment.md) GitHub repository secret'larını ekle.
4. `eas build --platform all --profile preview` ile cihaz build'i test et.
5. Store kayıtları tamamlanınca GitHub Actions'ta **Mobile release → Run workflow → main** seç. Backend ve testler tamamlandıktan sonra production build/gönderim başlar.

CI pull request'lerde, `develop` push'larında ve dağıtım zincirinde tip, lint, istemci/dağıtım testleri, Android/iOS bundle, Deno kontrolleri ve izole PostgreSQL migration/RLS testlerini çalıştırır. Kod içeren `main` push'ları testlerden sonra Supabase'i dağıtır, worker'ı doğrular ve preview OTA kanalını günceller. Production OTA ve mağaza build'i elle seçilir; backend adımları onlar için de otomatiktir.

## Üretim mimarisi

Supabase Auth ve RLS kullanıcı verisini korur; katalog Edge Function'ı TMDB/OMDb anahtarlarını sunucuda tutar. Kalıcı değişiklik günlüğü cihazlar arası senkronizasyonu yönetir. Zamanlanmış bildirim worker'ı yeni bölümleri tarar ve kalıcı inbox/outbox üzerinden Expo Push Service/APNs/FCM'e gönderir. Ana tablolar `profiles`, `library_items`, `episode_progress`, `devices`, `notification_preferences`, `notifications`, `notification_deliveries` ve `episode_release_catalog`'dur.

Kimlik doğrulama için passkey/Apple/Google, hata takibi için Sentry, ürün analitiği için gizlilik odaklı PostHog ve backend tarafında idempotent cron/queue işleri önerilir. TMDB görsel ve veri kullanım şartları ile zorunlu atıf metni mağaza yayını öncesinde eklenmelidir.

İstemci cache politikaları, veri akışı ve veritabanına geçiş sınırları [mimari dokümanında](docs/architecture.md) açıklanmıştır.

## Klasör yapısı

```text
app/                 Expo Router ekranları
src/components/      Tekrar kullanılabilir UI
src/domain/          Framework bağımsız alan tipleri
src/hooks/           Tekrar kullanılabilir React hook'ları
src/services/        Dış servis ve cihaz adaptörleri
src/store/           Kalıcı istemci durumu
src/theme/           Tasarım tokenları
.github/workflows/   CI ve release otomasyonu
.eas/workflows/      EAS preview build otomasyonu
```

İstemci ve backend ayrı dağıtım birimleridir. GitHub Actions bağımlılıkları backend dağıtımını ve worker kontrolünü istemci yayınının önkoşulu yapar; akış [dağıtım rehberinde](docs/notification-deployment.md) açıklanmıştır.
