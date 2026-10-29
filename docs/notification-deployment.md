# Bildirimler ve bu sürümün kurulumu

Yeni bölüm bildirimleri telefonun uygulamayı açmasına bağlı değildir. PostgreSQL Cron, beş dakikada bir korumalı `notification-worker` fonksiyonunu çağırır. Worker takip edilen dizileri yaklaşık saatte bir TMDB üzerinden tarar; aynı gün toplu yayımlanan bölümler dahil her bölüm için tek bir bildirim kaydı üretir. Kullanıcının saat diliminde yayın gününün 09:00 saati esas alınır. TMDB bu akışta platforma özel kesin yayın saati sağlamadığı için uygulama saatinde teslim sözü vermez.

Inbox kaydı ile telefon bildirimi farklıdır. Telefon izni kapalıysa kullanıcı “Bildirimlerim” ekranında kayıtları görebilir. Kullanıcı yeni bölüm, sosyal ve telefon bildirimlerini ayrı ayrı kapatabilir. Push kuyruğu Expo ticket ve receipt yanıtlarını kontrol eder; geçici ağ/429/5xx hatalarını artan aralıklarla yeniden dener ve geçersiz cihaz belirteçlerini devre dışı bırakır.

## Otomatik dağıtım

`main` dalına kod gönderildiğinde **Mobile OTA update** workflow'u aşağıdaki sırayı otomatik çalıştırır. Terminalden migration, fonksiyon dağıtımı veya SQL Editor'de worker kurulumu yapmanız gerekmez.

1. Dalın `main` olduğunu ve gerekli GitHub secret'larının tanımlı olduğunu doğrular.
2. TypeScript, ESLint, istemci ve dağıtım testlerini; Android/iOS export'larını; Deno kontrollerini ve testlerini; tüm migration'ların izole PostgreSQL testlerini çalıştırır.
3. Sunucu anahtarlarını kontrol eder, GitHub'da verilmiş yeni değerleri Supabase'e aktarır.
4. `supabase db push --linked --yes` ile bekleyen migration'ları uygular.
5. `catalog-api`, `notification-worker`, `delete-account` dahil repodaki Edge Functions'ı `supabase/config.toml` ayarlarıyla dağıtır.
6. Proje URL'sini Vault'a kaydeder, beş dakikalık Cron görevini doğrular ve worker'ı Cron'un kullandığı veritabanı fonksiyonuyla çağırır. `pg_net` sonucunda HTTP 200, beklenen yanıt ve sıfır tarama hatası görmeden ilerlemez. Yanıt için en fazla üç dakika bekler.
7. EAS Update ile **preview** kanalına mobil güncellemeyi gönderir.

Herhangi bir adım başarısız olursa mobil güncelleme gönderilmez. **Mobile release** mağaza derlemesi de aynı backend ve test zincirinden geçer. İki workflow ortak dağıtım kilidi kullanır; bir migration çalışırken yeni push onu yarıda kesmez. Testler ve dağıtım aynı commit üzerinde çalışır. PR ve `develop` kontrolleri üretim ortamına bağlanmaz. Yalnızca doküman/Markdown değişen push'lar dağıtımı tetiklemez.

### Bir defalık GitHub ayarı

Repository → **Settings → Secrets and variables → Actions → Repository secrets** altında şu değerler bulunmalı:

| Secret | Değer |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Hedef projeye erişen Supabase kişisel erişim token'ı. `anon` veya `service_role` anahtarı değildir. CLI link, geçici veritabanı oturumu oluşturma (`database_write`), fonksiyon dağıtımı, Edge Function secret okuma/yazma ve Management API veritabanı sorgularına yetkili olmalı. |
| `SUPABASE_PROJECT_ID` | Dashboard proje ayarlarındaki 20 karakterlik **project reference**. Tam `https://PROJECT_REF.supabase.co` URL'si de kabul edilir; baştaki/sondaki boşluklar temizlenir. |
| `EXPO_TOKEN` | Mevcut EAS dağıtım token'ı; tanımlıysa tekrar eklenmez. |

`TMDB_ACCESS_TOKEN` ve `OMDB_API_KEY`, Supabase **Edge Functions → Secrets** bölümünde zaten varsa yeniden eklemek gerekmez. GitHub Actions'a aynı adlarla eklenirlerse dağıtım bunları Supabase'e de aktarır. İki yerde de eksik olan bir anahtar varsa migration başlamadan anlaşılır bir hata verir. Expo push erişim token koruması kullanılıyorsa isteğe bağlı `EXPO_ACCESS_TOKEN` da aynı şekilde aktarılır; verilmediğinde sunucudaki mevcut değer korunur. Sunucu anahtarlarını `EXPO_PUBLIC_*` değişkenlerine koymayın.

Secret'lar bir kez tanımlandıktan ve workflow dosyaları `main` dalına gönderildikten sonra sonraki dağıtımlar otomatik olur. Secret eksikse workflow adını hata mesajında gösterir; değerini loglamaz. Supabase CLI sürümü `2.122.0` olarak sabittir.

Kalıcı PostgreSQL parolası bu workflow için gerekli değildir. CLI, erişim token'ıyla kısa ömürlü bir login role oluşturup migration bağlantısını onunla kurar. Önceden eklenen `SUPABASE_DB_PASSWORD` secret'ı kullanılmaz; güncelliğini yitirmiş bir parola bu bağlantıyı etkileyemez. Bu davranış [sabitlenmiş CLI sürümünün bağlantı kodunda](https://github.com/supabase/cli/blob/v2.122.0/apps/cli-go/internal/utils/flags/db_url.go) tanımlıdır.

Eski şema SQL Editor ile elle kurulmuş ve migration geçmişiyle eşleştirilmemişse ilk `db push` durabilir. Böyle bir durumda mevcut şema ve `supabase_migrations.schema_migrations` kayıtları karşılaştırılmalıdır; workflow geçmişi körlemesine “uygulanmış” saymaz, veritabanını sıfırlamaz. Hata düzeltildikten sonra başarısız workflow yeniden çalıştırılabilir; uygulanmış migration'lar tekrar uygulanmaz.

Worker sırrı migration tarafından rastgele oluşturulur ve Vault'ta tutulur; mobil uygulamaya veya GitHub'a kopyalanmaz. `notification-worker` için gateway JWT kontrolü kapalıdır; fonksiyon herhangi bir iş yapmadan önce özel Vault sırrını doğrular. Diğer fonksiyonlara `--no-verify-jwt` uygulamayın. Hesap silme fonksiyonu ayrıca kullanıcının JWT'sini Auth üzerinden doğrular; yalnızca doğrulanan kullanıcıya ait avatar/yorum görsellerini Storage API ile kaldırıp sonra hesabını siler.

Expo projesinin iOS APNs ve Android FCM kimlik bilgilerinin geçerli olması gerekir. Fiziksel cihazda güncel development/preview veya mağaza build'i ile bildirim izni verin. Expo Go üzerinden uzaktan push teslimini doğrulamayın. Yeni native modül eklenmedi; mevcut build bildirim desteği içeriyorsa istemci değişiklikleri OTA ile dağıtılabilir.

`main` push'ları mevcut davranışla **preview** kanalını günceller. Cihaz kontrollerinden sonra **Mobile OTA update → Run workflow → main → production** seçimi yapılabilir; bu seçim de aynı otomatik backend zincirinden geçer. Mağaza build'i için mevcut **Mobile release** seçimi korunur. Preview ve production mobil kanalları bu ayarda aynı Supabase projesini kullanır; ayrı bir staging veritabanı oluşturulmaz.

## Kontrol

```sql
select jobname, schedule, active from cron.job where jobname = 'episode-notifications';
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
select media_id, next_check_at, locked_until, last_error from public.episode_sync_state order by next_check_at limit 20;
select type, count(*) from public.notifications group by type;
select status, count(*) from public.notification_deliveries group by status;
select last_error, count(*) from public.notification_deliveries where last_error is not null group by last_error;
```

“Cron çalıştı” yalnızca HTTP çağrısının planlandığını gösterir. Edge Function loglarını, `episode_sync_state.last_error` alanını ve Expo receipt sonuçlarını birlikte kontrol edin. `TMDB_ACCESS_TOKEN` eksikse worker hatalı yapılandırmayı `503` ile raporlar. Expo ticket `ok`, bildirimin Expo tarafından kabul edildiğini; receipt `ok` ise APNs/FCM tarafından kabul edildiğini gösterir. Fiziksel telefona teslim ayrıca doğrulanmalıdır.

## Testler

```sh
npm run validate
npm run typecheck:edge
npm run test:edge
npm run test:database
npm run test:deployment
# Yukarıdakilerin tamamı; Docker çalışıyor olmalı:
npm run validate:all
```

Veritabanı testleri ağ erişimi ve dışa açık portu olmayan geçici bir Supabase PostgreSQL konteyneri oluşturur; test sonunda yalnızca kendi oluşturduğu konteyneri siler. Gerçek proje URL'si veya üretim anahtarı kullanılmaz.

Dağıtım testleri migration/fonksiyon hatalarında durmayı, anahtarların korunmasını ve hata loglarında açığa çıkmamasını, dal kısıtını, worker hatalarını/zaman aşımını ve workflow bağımlılıklarını sınar. Gerçek Supabase dağıtımı yapmaz; yalnızca GitHub Actions dağıtım adımı hedef projeyi değiştirir.

Fiziksel cihazda ayrıca: uygulama kapalıyken push alma, bildirimden doğru bölüm/yorum açma, Türkçe/İngilizce metinler, okunmamış sayacı, izin kapatma/açma, hesap değiştirme, çevrimdışı düzenlemeyi yeniden gönderme ve iki cihazdaki silme işlemini kontrol edin.

Build ve ekran bazında adım adım kabul senaryoları: [TestFlight kontrol listesi](testflight-checklist.md).

Tekrarlanabilir ayarların dayanakları: [Supabase CI/CD ve ortam yönetimi](https://supabase.com/docs/guides/deployment/managing-environments), [GitHub Actions ile fonksiyon dağıtımı](https://supabase.com/docs/guides/functions/examples/github-actions), [Management API SQL sorguları](https://supabase.com/docs/reference/api/v1-run-a-query), [Supabase zamanlanmış fonksiyonlar](https://supabase.com/docs/guides/functions/schedule-functions), [Expo gönderim ve receipt kontrolü](https://docs.expo.dev/push-notifications/sending-notifications/).
