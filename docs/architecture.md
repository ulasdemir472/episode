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
TMDB / OMDb
```

Katmanların sorumlulukları ayrıdır:

- Ekranlar yalnızca sorgu durumunu ve kullanıcı etkileşimini yönetir.
- React Query aynı uygulama oturumundaki server-state yaşam döngüsünü yönetir.
- `CatalogService` dış sağlayıcının DTO'larını domain modellerine çevirir.
- `RequestCache` sağlayıcıdan bağımsız cache politikalarını uygular.
- `CacheStore` bir porttur; AsyncStorage yalnızca bugünkü adaptördür.
- TMDB ve OMDb erişimi zaman aşımı ve tipli hata sınırları içinden yapılır.

## Cache politikaları

| Veri | Fresh TTL | Sağlayıcı hatasında stale süre |
|---|---:|---:|
| Trend listesi | 30 dakika | 1 gün |
| Kategori keşfi | 1 saat | 3 gün |
| Arama sonucu | 1 gün | 7 gün |
| Dizi/sezon bilgisi | 12 saat–1 gün | 7 gün |
| TMDB dış kimlikleri | 30 gün | 30 gün |
| IMDb puanları | 1 gün | 7 gün |
| Bölüm yayın takvimi | 2 saat | 1 gün |

Cache en fazla 250 kalıcı ve 100 bellek içi kayıt tutar. Yeni kayıtlar sınırı aşınca en eski kayıtlar silinir. Aynı cache anahtarına eşzamanlı gelen çağrılar tek network isteğinde birleştirilir. Hatalı JSON veya başarısız cache yazımı kullanıcı akışını durdurmaz.

Arama alanında 450 ms debounce vardır. OMDb bölüm puanları bölüm başına çağrı yapmak yerine sezon başına tek çağrıyla alınır. Takip edilen dizilerin TMDB sorguları beşli gruplar halinde çalıştırılır.

## Veritabanına geçiş

Veritabanı eklendiğinde mobil uygulamanın doğrudan TMDB'ye bağlanması kaldırılmalıdır. Önerilen hedef akış:

```text
Mobile App -> Episode BFF/API -> PostgreSQL/Redis -> TMDB/OMDb
```

1. `CacheStore` için SQLite adaptörü eklenerek cihaz cache'i daha sorgulanabilir hale getirilebilir.
2. Asıl katalog cache'i backend tarafında PostgreSQL; kısa süreli hot-cache Redis üzerinde tutulabilir.
3. Mobil `CatalogService` adaptörü TMDB yerine Episode BFF endpoint'lerini çağırır. Domain ve ekran katmanları değişmez.
4. Backend sağlayıcı anahtarlarını gizler, `ETag`/`Cache-Control` üretir ve 429 yanıtlarında kontrollü backoff uygular.
5. Worker/queue yeni bölüm ve takip edilen yapımları periyodik günceller; mobil istemci yalnızca hazır veriyi okur.

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

`EXPO_PUBLIC_*` değişkenleri mobil bundle içinde görülebilir. Üretim sürümünde TMDB ve OMDb anahtarları BFF'e taşınmalıdır. Mobil uygulama yalnızca Episode API access token'ını kullanmalı; kullanıcı oturumları kısa ömürlü access token ve güvenli refresh token rotasyonuyla yönetilmelidir.
