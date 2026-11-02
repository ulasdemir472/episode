# Monitoring kurulumu

2 Kasım 2026. Backend ve mobil JS entegrasyonu kodlandı. Canlı Supabase deployment'ı, Grafana Cloud bağlantısı, OTA veya yeni native build bu çalışma sırasında yapılmadı.

## Hazır olanlar

- Gerçek katalog isteği, hata, cache ve dış API çağrı denemesi sayaçları. Notification worker'ın TMDB tüketimi ayrı kaynak olarak sayılır.
- OMDb'nin mevcut atomik 950/gün korumasından gelen rezervasyon, nominal 1.000/gün limitiyle ayrı gösterilir.
- Worker tamamlanma/başarı ve uygun bildirim kuyruğu özeti. Önceden oluşturulmuş teslimlerin enqueue zamanı bildirim oluşturulma zamanından yaklaşık doldurulur.
- Hesap sayısı ve opt-in kullanıcı aktivitesi için tekilleştirilmiş günlük özetler. Son 7/30 gün sayıları bugünün dahil olduğu son 7/30 İstanbul takvim günüdür.
- Yerelde 100 olayla sınırlı kalıcı kuyruk; aynı ID ile retry, JWT kimliğiyle eşleştirme, atomik dedupe, foreground süreleri ve hesap değişimi koruması.
- Arama, detay, kütüphane, bölüm işaretleme, yorum, arkadaşlık isteği, watch-wheel ve bildirim açma için içerik taşımayan event'ler.
- Katalog, worker ve hesap silme için güvenli loglar; seçili isteklerde Tempo trace. Katalogda cache lookup, kota rezervasyonu, upstream ve cache write adımları ayrılır.
- Grafana Cloud OTLP gönderimi; timeout, redirect engeli, kısmi reddi hata sayma ve kullanıcı işlemlerini engellemeyen background telemetry.
- Mobil Ayarlar'da isteğe bağlı **Kullanım analitiği**. Başlangıçta kapalıdır; kapatmak kimliğe bağlı server analitiğini ve yerel kuyruğu temizler. Hesap silmede analytics tabloları cascade ile silinir. Başka cihazdaki yerel kuyruk o cihaz tercih durumunu yenilediğinde temizlenir; server kapalı tercihte yeni kayıt kabul etmez.

DAU/WAU/MAU ve etkileşimler, veri gönderen sürümlerde analitiğe katılan hesapların gözlenen kullanımını temsil eder. Kayıtlı hesap sayısı bundan bağımsızdır. Oturum soğuk açılışta veya 30 dakikalık aradan sonra başlar. Süreler gözlenen foreground segmentleridir; cihaz kapanması/crash nedeniyle eksik kalabilir. Gönderim öncesi 7 günü aşan offline olaylar atılır. Analitik sunucuya ulaşamadığında uygulamanın ana işlevleri çalışmaya devam eder.

## Grafana Cloud'da yapılacaklar

### Bu kurulumun mevcut bilgileri

3 Kasım 2026'da paylaşılan bilgiler:

- **Panel:** [prudenttoffee1631.grafana.net](https://prudenttoffee1631.grafana.net)
- **Bölge:** Switzerland (İsviçre).
- **Bağlantı:** Kullanıcı iki OTLP secret'ını GitHub'a eklediğini bildirdi. Secret adları ve Grafana kimlik doğrulaması canlı gönderimle henüz doğrulanmadı; monitoring kodu henüz `main` dalına alınmadı.

Panel adresi veri gönderme adresi değildir. Switzerland seçimine veya panel adına bakarak OTLP endpoint'i tahmin etme; Grafana'nın bu stack için ürettiği değeri kullan.

### Şimdi yapılacak: iki değeri Grafana'dan GitHub'a kopyala

1. [Grafana Cloud hesabına giriş yap](https://grafana.com/auth/sign-in). Cloud Portal'da `prudenttoffee1631` stack'ini seç. **OpenTelemetry** kartındaki **Configure** düğmesine bas. Panelin içindeysen alternatif yol **Home → Setup guide → OpenTelemetry**; doğrudan gönderim için **Quickstart** akışını kullanabilirsin. [Grafana'nın bağlantı adımları](https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/).
   **Where does your application run?** ekranına gelirsen **View connection details** seçeneğine tıkla; mevcut gönderim kodu için endpoint ve authentication bilgilerini alıyoruz. Ortam seçimi ve Collector kurulum komutlarını çalıştırman gerekmiyor.
2. Ekrandaki token oluşturma adımını tamamla; ad olarak `episode-telemetry` kullanabilirsin. Yetki sorulursa bu stack için `metrics:write`, `logs:write`, `traces:write` seç. Mevcut uygulamaya ayrıca SDK kurman gerekmiyor; bağlantı bilgilerini alıyoruz.
3. Ekrandaki bağlantı çıktısında aşağıdaki iki adı bul. Her satırdaki `=` işaretinin sağındaki değeri al; `export`, değişken adı ve dış tırnakları kopyalama. Header değerinin içindeki `Authorization=...` bölümü değerin parçasıdır ve korunur.

| Grafana çıktısındaki ad | Ne işe yarar? | GitHub'da oluşturacağın Secret'ın adı |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Metrik, log ve trace göndereceğimiz OTLP base adresi. Genellikle `https://otlp-gateway-....grafana.net/otlp` biçimindedir. | `OTEL_EXPORTER_OTLP_ENDPOINT` |
| `OTEL_EXPORTER_OTLP_HEADERS` | Gönderime izin veren `Authorization=Basic ...` değeri. | `OTEL_EXPORTER_OTLP_HEADERS` |

4. [Episode GitHub Actions Secrets ekranını aç](https://github.com/ulasdemir472/episode/settings/secrets/actions). **New repository secret** düğmesine bas. **Name** alanına `OTEL_EXPORTER_OTLP_ENDPOINT`, **Secret** alanına Grafana'dan aldığın endpoint değerini yapıştır ve **Add secret** ile kaydet.
5. Yeniden **New repository secret** düğmesine bas. **Name** alanına `OTEL_EXPORTER_OTLP_HEADERS`, **Secret** alanına Grafana'daki header değerinin tamamını yapıştır ve **Add secret** ile kaydet.
6. Bu aşamada bana yalnızca **“İki secret'ı ekledim”** yazman yeterli. Token veya header içeriğini sohbete gönderme. Otomatik gönderimi etkinleştirme ve backend dağıtımı aşağıdaki 5. adımda anlatılır; secret eklemek tek başına veri akışını başlatmaz.

Örnek Grafana çıktısı; değerler temsilidir, kopyalanmaz:

```sh
export OTEL_EXPORTER_OTLP_ENDPOINT="https://otlp-gateway-ORNEK.grafana.net/otlp"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic ORNEK_GIZLI_DEGER"
```

İlk Secret'ın değeri yalnızca `https://otlp-gateway-ORNEK.grafana.net/otlp`, ikincisinin değeri yalnızca `Authorization=Basic ORNEK_GIZLI_DEGER` biçiminde olmalı. Grafana `Basic%20...` üretirse olduğu gibi kullanabilirsin. Ekranda yalnızca `glc_...` token'ı varsa henüz tam header çıktısında değilsin; OpenTelemetry bağlantı adımındaki hazır `OTEL_EXPORTER_OTLP_HEADERS` değerine dön. `OTEL_EXPORTER_OTLP_PROTOCOL` satırı için ayrıca GitHub secret'ı oluşturmana gerek yok; mevcut exporter protokolü kodda belirliyor.

Hesap oluşturma dahil tüm adımlar aşağıda yer alıyor. Veri gönderme token'ı ve Authorization değeri GitHub repository secret'larına girilir.

### 1. Hesabı aç ve stack'ini bul

1. [Grafana Cloud kayıt sayfasını](https://grafana.com/auth/sign-up/create-user) aç ve sunulan yöntemlerden biriyle kendi hesabını oluştur. E-posta doğrulaması istenirse tamamla.
2. Başlangıç için **Free** planını kullan. İlk ekranda deneme süresi görünürse **Billing** bölümünde Free planla devam durumunu kontrol et. Plan bilgisi [resmi fiyat sayfasındadır](https://grafana.com/pricing/).
3. Kurulum organizasyon adı sorarsa `Episode`, stack adı sorarsa kullanılabilir bir `episode` adı seçebilirsin. Stack, Grafana paneli ve ona bağlı metrics/logs/traces servislerinin bulunduğu ortamdır. Adın dolu olması halinde sana uygun başka bir ad seç.
4. Bölge seçimi sunulursa Supabase projenin bölgesine yakın bir bölge seç; bu bilgi henüz yoksa ekrandaki Avrupa seçeneklerinden biriyle başlayabilirsin. Seçtiğin bölge adını not et.
5. [Grafana.com](https://grafana.com/) üzerinde **My account** ile Cloud Portal'a gir. Organizasyonunda oluşturulan stack'i seç. Stack oluşturulmamışsa portalın yeni stack oluşturma adımını tamamla.
6. **Grafana** kartındaki **Launch** düğmesiyle paneli aç. Tarayıcının adres çubuğundaki `https://...grafana.net` kök adresini kopyala. `/d/...` dashboard yolu ve query parametreleri olmadan kök adres yeterlidir.

Örnek panel adresi: `https://senin-stack-adin.grafana.net`. Bu bir örnektir; kendi ekranındaki adresi kullan. Portal ve stack ekranlarının ayrımı [Grafana Cloud Portal rehberinde](https://grafana.com/docs/grafana-cloud/platform/security-and-account-management/account-management/cloud-portal/) açıklanır.

### 2. Bu sohbette neyi paylaşacaksın?

Aşağıdaki şablonu kendi bilgilerinle doldurabilirsin. **Panel adresi** ilk gerekli bilgidir; bölge ve secret durumu kurulumun hangi aşamada olduğunu anlamamızı sağlar.

```text
Grafana paneli: https://senin-stack-adin.grafana.net
Plan: Free
Bölge: ekranda seçtiğim bölge
GitHub secret'ları: henüz eklemedim
```

Secret'ları eklediğinde son satırı `eklendi` olarak değiştirebilirsin. Panel adresini paylaşmak erişim yetkisi vermez; gerçek veri gönderimi sonraki bağlantı adımlarıyla açılır.

| Bilgi | Nereye gireceksin? |
| --- | --- |
| Grafana panel adresi, plan ve bölge | Bu sohbette paylaşabilirsin. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | GitHub repository secret'ına gir. Bu veri kabul adresidir; panel adresinden farklıdır. |
| `OTEL_EXPORTER_OTLP_HEADERS` ve içindeki Authorization değeri | GitHub repository secret'ına gir; sohbette paylaşma. |
| Ham access policy token'ı, parola ve kurtarma kodları | Kendi güvenli saklama alanında tut; bu sohbette paylaşma. |

### 3. OpenTelemetry bağlantı bilgilerini oluştur

1. Cloud Portal'da ilgili stack'i seçip **OpenTelemetry → Configure** kartını aç.
2. Bu kartı bulamazsan Grafana panelinde **Home → Setup guide → OpenTelemetry** yolunu kullan. Hazır exporter'ımızı bağlayacağımız için OTLP bağlantı bilgilerini gösteren adıma ilerle. Güncel alternatif menü yolları [Grafana OpenTelemetry kurulum rehberindedir](https://grafana.com/docs/opentelemetry/grafana-cloud/).
3. Token oluşturma adımında `episode-telemetry` gibi bir ad kullan. Yetki seçimi sorulursa **`metrics:write`**, **`logs:write`** ve **`traces:write`** seç. Stack/realm seçimi sunulursa oluşturduğun Episode stack'ini hedefle. Bu entegrasyon için üç yazma yetkisi yeterlidir. [Cloud access policy kapsamları](https://grafana.com/docs/grafana-cloud/platform/security-and-account-management/security-and-access/authentication-and-permissions/access-policies/).
4. Oluşan bağlantı çıktısındaki iki değeri al: **`OTEL_EXPORTER_OTLP_ENDPOINT`** ve **`OTEL_EXPORTER_OTLP_HEADERS`**. Token yalnızca oluşturulurken gösteriliyorsa kendi güvenli saklama alanına kaydet. Süre sonu seçtiysen yenileme tarihini not et.
5. Çıktı `export DEGISKEN="değer"` biçimindeyse GitHub'a yalnızca tırnak içindeki **değeri** kopyala. `export` sözcüğünü, değişken adını veya dış tırnakları Secret alanına ekleme.

Beklenen biçimler:

```text
OTEL_EXPORTER_OTLP_ENDPOINT değeri:
https://otlp-gateway-....grafana.net/otlp

OTEL_EXPORTER_OTLP_HEADERS değeri:
Authorization=Basic BASE64_BAGLANTI_BILGISI
```

`BASE64_BAGLANTI_BILGISI` yer tutucudur; Grafana'nın ürettiği gerçek Authorization değerini kullan. Çıktı `Authorization=Basic%20...` biçimindeyse kodumuz bu biçimi de destekler. Ekranda yalnızca ham `glc_...` token'ı görüyorsan OpenTelemetry bağlantı çıktısındaki hazır header değerini al; ham token tek başına `OTEL_EXPORTER_OTLP_HEADERS` değeri değildir. Base endpoint'in sonuna `/v1/metrics`, `/v1/logs` veya `/v1/traces` ekleme. [Resmi OTLP bağlantı adımları](https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/).

### 4. Değerleri GitHub'a ekle

1. Episode kodunun bulunduğu GitHub repository'sini aç.
2. **Settings → Secrets and variables → Actions → Secrets** sekmesine gir.
3. **New repository secret** ile aşağıdaki adları ve karşılarındaki değerleri tek tek ekle. Mevcut Supabase ve Expo deployment secret'ları korunur. [GitHub repository secret oluşturma rehberi](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions).

| Secret | Değer |
| --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry base endpoint, genellikle `https://otlp-gateway-....grafana.net/otlp`. Sonuna `/v1/metrics` ekleme. |
| `OTEL_EXPORTER_OTLP_HEADERS` | Grafana'nın verdiği `Authorization=Basic ...` değeri; tırnaklar değerin parçası olmamalı. |
| `MONITORING_ENVIRONMENT` | İsteğe bağlı `production`; verilmezse production. Bu etiket OTA kanalından ayrıdır. |
| `MONITORING_TRACE_SAMPLE_RATE` | İsteğe bağlı `0.1`; her on istekten yaklaşık birinin trace'i. Sayaçlar örneklenmez. |

Bu değerler `EXPO_PUBLIC_*` değildir. Grafana write token'ı mobil bundle'a veya dashboard JSON'a eklenmez. Secret'lar doğrudan Supabase'de zaten tanımlıysa GitHub'da verilmemesi eski değerleri silmez.

### 5. Otomatik veri gönderimini etkinleştir

1. Aynı GitHub ayarlarında **Variables → New repository variable** yolunu aç.
2. Adı `MONITORING_EXPORT_ENABLED`, değeri `true` olan bir repository variable ekle. Bu bir secret değildir. Boş değer mevcut job ayarını korur; `false` açıkça kapatır.
3. Panel adresini ve secret'ları eklediğin bilgisini paylaşınca bağlantı doğrulamasına geçebiliriz. Bu aşamada Cloud panelinin boş görünmesi beklenir; kodun backend'e dağıtılması gerekir.
4. Kod gözden geçirilip `main` dalına alındıktan sonra **Actions → Monitoring backend deployment → Run workflow → main** çalıştır. Bu workflow mobil build veya OTA üretmez. Mevcut CI/Edge/DB kontrolleri sonrasında migration ve function'ları dağıtır. Cloud'a tek bir gerçek snapshot gönderip başarılı yanıt görmeden beş dakikalık export Cron'unu açmaz. Hata yanıtlarında credential değerleri loglanmaz.

### 6. Dashboard'ları içe aktar ve bağlantıyı kontrol et

1. Grafana panelinde **Dashboards → New → Import** yolunu aç. Ekranda doğrudan **Import dashboard** seçeneği varsa onu kullan.
2. [Operasyon dashboard](../observability/grafana/episode-ops-dashboard.json) dosyasını yükle ve içe aktar. Ardından aynı işlemi [kullanıcı dashboard](../observability/grafana/episode-users-dashboard.json) için tekrarla.
3. Üstteki kaynak alanlarında Cloud Prometheus, Loki ve Tempo kaynaklarını seç; ortam `production` olur. İlk bağlantıda veri kaynağı adları stack'ine göre değişebilir; kaynak türlerine bak.
4. Backend dağıtımı tamamlandıktan sonra ilk başarılı export'u ve bir sonraki beş dakikalık döngüyü bekle. **Veri yaşı**, kota ve kayıtlı hesap kartlarını kontrol et. Loki'de log ve Tempo'da örneklenmiş trace gelmesini doğrula.
5. Kullanıcı aktivitesi için aşağıdaki **Mobil aktiviteyi açma** adımı da tamamlanmalı. Toplam kayıtlı hesap kartı backend'den gelir; DAU ve özellik kullanımı, analitiğe katılan kullanıcılardan olay geldikçe oluşur.

Yeni sayaçlar deployment'tan itibaren dolar; eski katalog günlüğü eksiksiz geçmiş sayılmaz. Grafana'daki kotanın gün sınırı DB timezone'udur; kullanıcı günlük metrikleri İstanbul takvim günüdür.

Grafana'nın OTLP/JSON desteği bu düşük trafikli ilk entegrasyon için kullanılıyor. Daha yüksek hacimde Collector/Alloy ve binary OTLP ile batch/retry hattına geçilebilir. Dayanak: [Cloud OTLP bağlantısı](https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/), [format desteği](https://grafana.com/docs/grafana-cloud/send-data/otlp/otlp-format-considerations/).

## Mobil aktiviteyi açma

Backend dağıtımından sonra mobil JS değişiklikleri uygun runtime ve kanala yayımlanmalı. Bu çalışma native bağımlılık veya runtime sürümü değiştirmiyor; yeni build şartı getirmiyor. Yayımdan önce gerçek mağaza build'lerinin runtime/kanalı doğrulanmalı. Mevcut `main` push OTA workflow'u preview kanalını hedefler; mağazadaki production kurulumları kendiliğinden bu kanala geçmez.

Kullanıcılar Ayarlar → Kullanım analitiği seçeneğini açınca aktivite sayıları oluşur. Panelde katılan hesap sayısı da gösterilir. Eski app sürümleri veya katılmayan hesapların davranışı DAU'da varmış gibi gösterilmez. Toplam kayıtlı hesap kartı mobil güncelleme gerektirmez.

## İlk alarmlar

Grafana Alerting'de önce aşağıdaki kurallar kurulabilir. Bu repository'de contact point veya Cloud alarm kaynakları henüz oluşturulmadı; hedef bildirim kanalı belirlenince kaynaklar Cloud'a bağlanır.

- Snapshot yaşı: `time() - episode_telemetry_snapshot_timestamp_seconds{environment="production"} > 900`; 5 dakika sürerse uyarı. **No Data/Error** sağlıklı kabul edilmemeli.
- OMDb güvenlik bütçesi: rezervasyon / 950; %70 uyarı, %85 kritik. Nominal 1.000 kotasının yüzdesiyle karıştırılmamalı.
- Worker'ın son başarılı tamamlanması 15 dakikadan eski veya son çalışma başarısız. İlk çalışmadan önce eksik seri görünür olmalı.
- Uygun push kuyruğunda en eski vadesi gelmiş kayıt 15 dakikayı aşıyor.

Supabase dışında bağımsız HTTP kontrolü ayrıca kurulmalı. Cloud exporter'ın kendi Cron'u, Supabase tamamen erişilemez olduğunda veri gönderemez; bu durumda No Data alarmı önemlidir.

## Yerel deneme ve doğrulama

[Docker lab rehberi](../observability/README.md) yerel ortamı başlatır. `node observability/send-demo.mjs --watch` yalnızca yerel collector'a açıkça sentetik veriler gönderir; üretim hesaplarına ve provider API'lerine bağlanmaz.

Kontroller: `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, `pnpm run typecheck:edge`, `pnpm run test:edge`, `pnpm run test:deployment`, `pnpm run test:database`. DB kontrolü ağ erişimi olmayan geçici bir konteyner kullanır; production veritabanına bağlanmaz. Cloud'a gerçek credential ile teslim, hesap açılışı ve deployment sonrasında ayrıca doğrulanır.
