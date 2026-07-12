# Episode sistem mimarisi

## Bugünkü veri akışı

```text
Screen / Expo Router
        |
        v
React Query (oturum içi cache, tekrar deneme ve istek durumu)
        |
        v
Catalog Service (use-case odaklı API)
        |
        v
Request Cache (TTL, stale-if-error, aynı istekleri birleştirme)
        |
        +----> CacheStore portu ----> AsyncStorage adaptörü
        |
        v
Supabase Edge Function (JWT, endpoint allowlist, sunucu anahtarları)
        |
        +----> PostgreSQL ortak cache + günlük kullanım sayaçları
        |
        v (yalnızca ortak cache miss)
TMDB / OMDb
```

Katmanların sorumlulukları ayrıdır:

- Ekranlar yalnızca sorgu durumunu ve kullanıcı etkileşimini yönetir.
- React Query aynı uygulama oturumundaki server-state yaşam döngüsünü yönetir.
- `CatalogService` dış sağlayıcının DTO'larını domain modellerine çevirir.
- `RequestCache` sağlayıcıdan bağımsız cache politikalarını uygular.
- `CacheStore` bir porttur; AsyncStorage yalnızca bugünkü adaptördür.
- TMDB ve OMDb anahtarları yalnızca Edge Function secret'larında bulunur.
- Edge Function izinli endpoint listesini, ortak TTL cache'i, günlük sayaçları ve OMDb güvenlik limitini uygular.

## Cache politikaları

| Veri | Fresh TTL | Sağlayıcı hatasında stale süre |
|---|---:|---:|
| Trend listesi | 30 dakika | 1 gün |
| Kategori keşfi | 1–2 saat | 3 gün |
| Arama sonucu | 1 gün | 7 gün |
| Dizi/sezon bilgisi | 12 saat–1 gün | 7 gün |
| TMDB dış kimlikleri | 30 gün | 30 gün |
| IMDb puanları | 7 gün | 30 gün |
| Bölüm yayın takvimi | 2 saat | 1 gün |

Cihaz cache'i en fazla 250 kalıcı ve 100 bellek içi kayıt tutar. Ortak PostgreSQL cache'inde stale süresi dolmuş kayıtlar örneklemeli temizlikle kaldırılır. Aynı cihazdaki eşzamanlı çağrılar tek network isteğinde birleştirilir. Hatalı cache yazımı kullanıcı akışını durdurmaz.

Arama alanında 450 ms debounce vardır. OMDb bölüm puanları bölüm başına çağrı yapmak yerine sezon başına tek çağrıyla alınır. Takip edilen dizilerin TMDB sorguları beşli gruplar halinde çalıştırılır.

## Kota ve ölçek sınırları

OMDb için günlük 1.000 isteğin 950'si atomik olarak rezerve edilebilir; kalan pay operasyonel testler için bırakılır. Limit dolduğunda geçerli stale kayıt varsa sunulur, yoksa kontrollü `429` üretilir. Bu tasarım kotaya hiç ulaşılmayacağını garanti etmez; benzersiz başlık/sezon sayısı cache hit oranından hızlı büyürse limite ulaşılabilir.

`external_api_usage_daily` tablosu dış istek, fresh cache hit, stale hit ve hata sayılarını tutar. Operasyon kontrolü:

```sql
select usage_date, service, request_count, cache_hit_count,
       stale_hit_count, error_count,
       round(100.0 * cache_hit_count / nullif(cache_hit_count + request_count, 0), 1) as cache_hit_percent
from public.external_api_usage_daily
order by usage_date desc, service;
```

PostgreSQL cache erken aşama ve orta trafik için doğru maliyet/karmaşıklık dengesidir. Sürekli yüksek eşzamanlılıkta aynı cache miss'in birden fazla dış çağrı üretmesi mümkündür. OMDb günlük tüketimi düzenli olarak 700'ü veya katalog Edge Function p95 süresi 500 ms'yi geçerse Redis tabanlı distributed lock/hot cache ve arka plan yenileme worker'ına geçilmelidir. IMDb puanı ürün için kritik hale gelirse 1.000/gün ücretsiz OMDb planına güvenmek yerine lisanslı veri sağlayıcı veya ücretli plan seçilmelidir.

Önerilen ilk tablolar:

- `users`
- `media` ve `media_translations`
- `seasons` ve `episodes`
- `library_items` ve `episode_progress`
- `favorites`
- `ratings` ve `comments`
- `devices` ve `notification_preferences`
- `provider_sync_state` ve `outbox_events`

Kullanıcı işlemleri için benzersiz kısıtlar ve idempotency anahtarları kullanılmalıdır. Yorumlar soft-delete ve moderasyon durumu taşımalıdır. Bildirim/senkronizasyon olayları transactional outbox üzerinden kuyruğa aktarılmalıdır.

## Üretim güvenliği

`EXPO_PUBLIC_*` değişkenleri mobil bundle içinde görülebilir. TMDB ve OMDb anahtarları yalnızca Supabase secret olarak saklanır. Ortak cache ve sayaç tablolarında RLS açıktır ve istemci policy'si yoktur; yalnızca Edge Function service role ile erişir. Edge Function varsayılan JWT doğrulamasıyla deploy edilmelidir.
