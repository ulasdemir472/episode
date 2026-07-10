# Episode

Film ve dizileri keşfetmek, izleme listelerini yönetmek ve yeni bölümleri takip etmek için iOS ve Android hedefli cross-platform React Native uygulaması.

## Neler hazır?

- Sinematik koyu tema, erişilebilir sekme navigasyonu ve responsive kartlar
- Ana sayfa, keşif/arama, yeni bölümler, kişisel liste ve detay ekranı
- TMDB üzerinden tamamen dinamik film, dizi, sezon, bölüm ve yayın takvimi
- TTL, stale-if-error ve istek birleştirme destekli kalıcı API cache katmanı
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

Gerçek katalog için [TMDB API ayarlarından](https://www.themoviedb.org/settings/api) bir **v4 Read Access Token** oluşturup `.env` içindeki `EXPO_PUBLIC_TMDB_ACCESS_TOKEN` değerine yaz. Bu değişken istemci paketine dahil olur; ilk prototip için uygundur, ancak üretimde token'ı mobil uygulamaya gömmek yerine kendi backend/BFF servisinde sakla.

### TMDB ve IMDb puanları

1. [TMDB](https://www.themoviedb.org/) hesabı aç ve e-postanı doğrula.
2. `Settings → API → Request an API Key → Developer` yolunu izleyip uygulama formunu doldur.
3. API sayfasındaki uzun **API Read Access Token** değerini `.env` dosyasına ekle:

```env
EXPO_PUBLIC_TMDB_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiJ9...
```

IMDb'nin herkese açık resmi bir API'si yoktur. İsteğe bağlı IMDb puanları için [OMDb API](https://www.omdbapi.com/apikey.aspx) anahtarı alıp ekleyebilirsin:

```env
EXPO_PUBLIC_OMDB_API_KEY=anahtarin
```

Anahtarları ekledikten sonra Metro'yu `pnpm start --clear` ile yeniden başlat. EAS preview build içinde kullanmak için aynı değişkenleri Expo dashboard'unda `Project → Environment variables → preview` alanına ekle ve yeni build oluştur. OMDb anahtarı yoksa dizi ve bölüm ekranlarında TMDB puanları gösterilmeye devam eder.

## Kontroller

```bash
npm run typecheck
npm run lint
npm test
npm run validate
```

## Üretime geçiş

1. `npx eas-cli login` ve ardından `npx eas-cli init` çalıştır; oluşan project ID'yi `app.json` içindeki yer tutucuyla değiştir.
2. Bundle ID/package adlarını kendi şirket alan adına göre güncelle.
3. GitHub repository secret olarak `EXPO_TOKEN` ekle.
4. `eas build --platform all --profile preview` ile cihaz build'i test et.
5. Store kayıtları tamamlanınca `eas build --platform all --profile production --auto-submit` çalıştır.

CI her push ve pull request'te tip, lint, test ve Android production bundle kontrolü yapar. Release workflow'u yalnızca elle tetiklenir; mağazaya yanlışlıkla build göndermez.

## Önerilen üretim mimarisi

Mobil istemcinin yanına küçük bir backend-for-frontend eklenmeli. Bu servis TMDB anahtarını gizler, kullanıcı hesabı ve cihazlar arası senkronizasyonu yönetir, takip edilen dizilerin yayın takvimini periyodik olarak günceller ve Expo Push Service/APNs/FCM üzerinden bildirim yollar. PostgreSQL için temel tablolar: `users`, `media`, `library_items`, `episodes`, `episode_progress`, `devices` ve `notification_preferences`.

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

Bu sürüm güçlü bir istemci MVP'sidir. Gerçek kullanıcı hesapları, cihazlar arası senkronizasyon ve sunucudan otomatik push gönderimi için yukarıdaki backend ayrı bir dağıtım birimi olarak geliştirilmelidir.
