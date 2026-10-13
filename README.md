# Episode

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
3. API sayfasındaki uzun **API Read Access Token** değerini Supabase Edge Function secret'ı olarak ekle. OMDb anahtarını da aynı komutta tanımla:

```bash
npx supabase secrets set TMDB_ACCESS_TOKEN=eyJ... OMDB_API_KEY=anahtarin --project-ref PROJECT_REF
```

IMDb'nin herkese açık resmi bir API'si yoktur; puanlar [OMDb API](https://www.omdbapi.com/apikey.aspx) üzerinden gelir. Bu anahtarları `.env` veya EAS environment içine `EXPO_PUBLIC_*` adıyla koyma; mobil paketten okunabilirler.

### Supabase auth ve veritabani

1. Supabase dashboard'da `Project Settings -> API` alanindan Project URL ve Publishable key degerlerini al.
2. `.env` ve EAS `preview` environment icine su degiskenleri ekle:

```env
EXPO_PUBLIC_SUPABASE_URL=https://project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=publishable_key
```

3. Dashboard'da `SQL Editor -> New query` ac, `supabase/migrations/202607110001_initial_schema.sql` dosyasini calistir. Bu tablo, RLS policy, yorum/puan kisiti ve realtime ayarlarini kurar.
4. `Authentication -> URL Configuration` altinda `Site URL` degerini `http://localhost:3000` yerine production web sitene ya da gecici olarak `episode://auth` degerine cek.
5. Ayni ekranda Allowed Redirect URLs listesine `episode://auth` ve `episode://**` ekle.
6. Confirm veya reset password mailleri hala localhost'a gidiyorsa `Authentication -> Email Templates -> Confirm signup` ve `Reset password` icinde hazir sablonlari kullanabilirsin: Episode logolu hazir template'ler icin `docs/supabase-confirm-signup-template.html` ve `docs/supabase-password-reset-template.html` dosyalarinin iceriklerini ilgili sablon alanlarina yapistir.
7. Preview build yukluyse JS-only degisiklikler icin EAS Update yeterlidir:

```bash
npx eas-cli@latest update --channel preview --environment preview --message "Add Supabase auth and sync"
```

Veritabani migration uygulanmadan uygulama acilir, ancak giris sonrasi liste/profil/yorum senkronizasyonu sunucuya yazamaz.

Arkadaslik ozelligi icin ayrica `supabase/migrations/202607110002_friendships.sql` dosyasini SQL Editor'de calistir.
Telefondan profil fotografi secme ve yukleme icin `supabase/migrations/202607110003_avatar_storage.sql` dosyasini da calistir. Bu ozellik `expo-image-picker` kullandigi icin mevcut preview build'e EAS Update yetmez; yeni `eas build --platform ios --profile preview` gerekir.

### Ortak katalog cache'ini kurma

1. `supabase/migrations/202607120001_external_api_cache.sql` migration'ını SQL Editor'de çalıştır.
2. Sunucu secret'larını tanımla ve fonksiyonu JWT doğrulamasını kapatmadan deploy et:

```bash
npx supabase login
npx supabase link --project-ref PROJECT_REF
npx supabase secrets set TMDB_ACCESS_TOKEN=eyJ... OMDB_API_KEY=anahtarin
npx supabase functions deploy catalog-api
```

3. `external_api_usage_daily` tablosunu Table Editor'den veya [mimari dokümanındaki](docs/architecture.md) sorguyla izle. OMDb dış istekleri günlük 950'de durur; cache'teki stale puanlar 30 güne kadar servis edilmeye devam eder.
4. Eski `EXPO_PUBLIC_TMDB_ACCESS_TOKEN` ve `EXPO_PUBLIC_OMDB_API_KEY` değerlerini EAS environment'lardan sil. Kod artık bunları kullanmaz. Mobil taraftaki değişiklik native modül içermediği için mevcut build'e EAS Update gönderilebilir.

## Test kullanicilarina dagitim

1. `eas build --platform ios --profile preview` ile internal distribution build olustur.
2. EAS'in verdigi QR/linki Apple Developer hesabinda kayitli cihazlara gonder.
3. Daha genis iOS testi icin App Store Connect'te TestFlight kullan; yeni tester email'lerini ekleyip build'i External Testing'e ac.
4. Kod tarafinda sadece JS degisiyorsa yeni build almak yerine `npx eas-cli@latest update --channel preview --environment preview --message "..."` yeterli.
5. Tester'larin farkli hesaplarla kayit olmasini, kullanici adi belirlemesini, birbirini aratip arkadas istegi gondermesini ve kabul etmesini kontrol et.

## Kontroller

```bash
npm run typecheck
npm run lint
npm test
npm run validate
```

Her testin hangi kullanıcı davranışını koruduğu ve hangi komutun ne zaman çalıştırılacağı [test rehberinde](docs/testing.md) açıklanmıştır.

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
