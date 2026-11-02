# Episode Grafana laboratuvarı

Durum: backend ve mobil JS entegrasyonu repository'de hazır; canlı Supabase/Grafana Cloud'a dağıtılmadı. Bu klasördeki Docker lab yerel deneme içindir. Gerçek veri bağlantısı adımları [kurulum rehberindedir](../docs/monitoring-setup.md).

Grafana, metrik deposu, Loki ve Tempo için resmi `grafana/otel-lgtm` geliştirme imajı kullanılır. Bileşenler tek konteynerde başlar; ayrı servisler halinde işletme pratiği sonraki adım olabilir. Bu imaj bir yerel öğrenme ortamıdır. Cloud hedef mimarisi ve metrik sözleşmesi [karar dokümanındadır](../docs/monitoring-grafana-plan.md).

## Başlatma

Docker Desktop Linux konteyner motoru açık olmalı; paketleri indirmek için internet gerekir. Proje kökünde:

```powershell
docker compose --env-file observability/.env.example -f observability/compose.yaml up -d
```

Grafana: `http://127.0.0.1:3300`. Yerel kullanıcı `admin`, örnek parola `episode-local-only`. Başka bir yerel parola seçmek için `.env.example` dosyasını `observability/.env` olarak kopyalayıp komutta `--env-file observability/.env` kullan. Bu dosya Git'e eklenmez. Kalıcı volume varsa admin parolasının değiştirilmesi Grafana üzerinden yapılır; environment değişikliği mevcut hesabın parolasını otomatik değiştirmez.

İki dashboard otomatik yüklenir: **Episode → Episode · Kotalar ve Operasyon** ve **Episode · Kullanıcılar ve Aktivite**. Üstteki veri kaynağı alanlarından ilgili kaynağı seç. İlk seçim ekranında `production` görünür; canlı bağlantı olmadığı için veri yoktur.

## Metrik, log ve trace denemesi

```powershell
node observability/send-demo.mjs --dry-run
node observability/send-demo.mjs --watch
```

Grafana'da **Ortam → local** seç; veri görünmesi için kısa süre bekle ve yenile. Kartlardaki kullanım değerleri örnektir; uygulamanın gerçek tüketimini temsil etmez. Grafikler demo çalıştıkça oluşur; geçmiş günler için veri üretilmez. Araç yalnızca `127.0.0.1:4318` adresine gönderir; Cloud veya Supabase anahtarı kullanmaz. `Ctrl+C` ile durur. `--watch` olmadan tek örnek gönderir.

Demo; 22 metrik ailesi, bağlantılı bir JSON log ve üç span üretir. İkinci dashboard'daki kullanıcı sayıları ve etkileşimler de sentetiktir. Tempo tablosundan trace'i açarak ana işlem, cache ve örnek upstream hatasını incele. Loki JSON logundaki `trace_id`, aynı işlemin trace kimliğidir. Tek tıkla logdan trace'e geçiş için Loki veri kaynağında `trace_id` derived field'ı Tempo'ya bağlanabilir.

## Kontrol ve durdurma

```powershell
docker compose --env-file observability/.env.example -f observability/compose.yaml config --quiet
docker compose --env-file observability/.env.example -f observability/compose.yaml logs --tail 80 lgtm
docker compose --env-file observability/.env.example -f observability/compose.yaml down
```

`down`, metrik/log/trace verisini saklayan named volume'u silmez. Dashboard dosyası Git'teki kaynaktır; UI'da yapılan düzenlemeler kalıcı hale getirilecekse JSON dışa aktarılıp kaynak dosyaya işlenmelidir. İmaj yerelde doğrulanan digest'e sabitlendi; yükseltmeler `LGTM_IMAGE` değiştirilip aynı kontroller tekrar yapılarak uygulanır.

## Grafana Cloud

Cloud'da [operasyon dashboard](grafana/episode-ops-dashboard.json) ve [kullanıcı dashboard](grafana/episode-users-dashboard.json) dosyalarını **Dashboards → Import** ile içe aktar. Üstteki veri kaynağı alanlarında ilgili Cloud kaynaklarını seç. Bu işlem tek başına üretim verisi toplamaz. Edge instrumentation, exporter ve mobil event kodları hazırdır; [kurulum rehberine](../docs/monitoring-setup.md) göre secret ve deployment adımları tamamlanınca gerçek veriler gelir.

Yerel OTLP portları yalnızca loopback'e bağlıdır. Telefonun veya Supabase Edge Function'ın bu adrese uzaktan veri gönderebildiği varsayılmaz. Yerel demo için Cloud yönlendirmesi varsayılan olarak yoktur.

Resmi dayanak: [Grafana OTEL LGTM geliştirme ortamı](https://github.com/grafana/docker-otel-lgtm), [Grafana dashboard JSON modeli](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/view-dashboard-json-model/).
