# Episode test rehberi

Bu doküman test adlarından çok, her test grubunun hangi kullanıcı davranışını koruduğunu açıklar.

## Komutlar

| Komut | Ne çalıştırır? | Ne zaman kullanılır? |
|---|---|---|
| `pnpm test` | Tüm Jest testleri | Günlük geliştirme sonrası |
| `pnpm test:business` | İzleme, yorum, puan ve senkronizasyon kuralları | Business davranışı değiştiğinde |
| `pnpm test:performance` | Cache ve bölüm ilerleme performans bütçeleri | Veri/cache kodu değiştiğinde |
| `pnpm test:watch` | Değişen testleri sürekli tekrarlar | Kod yazarken |
| `pnpm test:coverage` | Test kapsam raporu üretir | Eksik test alanlarını ararken |
| `pnpm validate` | TypeScript + ESLint + tüm testler | Commit ve EAS Update öncesi |

## Test grupları

### Yorum ve puan ekranı

Dosya: `src/components/__tests__/CommunityPanel.test.tsx`

- Yorum eklendiğinde ekranın güncellenmesini doğrular.
- İzlenmemiş içerikte yorum alanı ve puanların kilitli olduğunu doğrular.
- Sunucu silme işlemi başarısız olsa bile silinen yorumun eski cache verisinden geri gelmediğini doğrular.

Bu grup bozulursa kullanıcı yorum yapamayabilir, izlemediği içeriğe yorum yapabilir veya sildiği yorum tekrar görünebilir.

### Yorum gönderme kilidi

Dosya: `src/features/community/__tests__/submission-lock.test.ts`

- İlk gönderim bitmeden hızlı ikinci dokunmanın reddedildiğini doğrular.

Bu test bozulursa aynı yorum iki ayrı kayıt olarak oluşabilir. Veritabanındaki unique index ikinci güvenlik katmanıdır.

### Yorum ve puan store kuralları

Dosya: `src/store/__tests__/community-store.test.ts`

- Yorum metni/yazar adının temizlenmesini ve UUID üretilmesini doğrular.
- Silme tombstone'unun kaydedilmesini ve sunucu onayından sonra temizlenmesini doğrular.
- Sunucunun reddettiği duplicate kaydın silme kuyruğuna alınmadan atılmasını doğrular.
- Kullanıcı puanının 1–10 aralığında tutulmasını doğrular.

### İzleme listesi ve bölüm ilerlemesi

Dosya: `src/store/__tests__/library-store.test.ts`

- Film/dizi ekleme ve listeden kaldırmayı doğrular.
- Bir bölüm izlenince dizinin `watching` olmasını doğrular.
- Sonraki izlenmemiş bölümün doğru hesaplanmasını doğrular.
- İleri bir bölüme kadar tüm önceki bölümlerin işaretlenmesini doğrular.
- Bütün bölümler izlenince `completed`, bir bölüm geri alınınca tekrar `watching` olmasını doğrular.

### Yorum yapabilme yetkisi

Dosyalar:

- `src/features/sync/__tests__/user-sync-service.test.ts`
- `src/features/community/__tests__/target.test.ts`

İzlenmiş film ve bölümlerin yorumlanabilmesini; izlenmemiş veya hatalı hedeflerin senkronizasyondan önce reddedilmesini doğrular. Supabase RLS bunun sunucu tarafındaki ikinci güvenlik katmanıdır.

### Cache dayanıklılığı

Dosya: `src/services/cache/__tests__/request-cache.test.ts`

- Uygulama tekrar açıldığında fresh cache'in kullanılmasını doğrular.
- Aynı anda gelen aynı isteklerin tek dış API çağrısına birleşmesini doğrular.
- Sağlayıcı geçici olarak çöktüğünde stale verinin gösterilmesini doğrular.

### Kart ve ilerleme yardımcıları

Dosyalar:

- `src/components/__tests__/MediaCard.test.tsx`: kişisel puanın detay açılmadan kartta görünmesini korur.
- `src/utils/__tests__/progress.test.ts`: ilerleme yüzdesini ve yüzde 0–100 sınırlarını korur.

### Performans regresyonu

Dosya: `src/performance/__tests__/core-performance.test.ts`

- 2.000 eşzamanlı aynı cache isteğinin tek loader çağrısına birleşmesini ölçer.
- 5.000 hot-cache okumasının belirlenen süre bütçesinde kalmasını ölçer.
- 10.000 bölümlük ilerleme hesabının belirlenen süre bütçesinde kalmasını ölçer.

Bu testler gerçek telefon FPS, Supabase gecikmesi veya internet hızını ölçmez. Bunlar kod içi algoritmik yavaşlamaları yakalayan CI regresyon bütçeleridir. Gerçek cihaz performansı için ileride Maestro akışları ve release build profiling ayrıca kullanılmalıdır.

## Bir test geçtiğinde ne anlama gelir?

Testin geçmesi yalnızca testte tarif edilen davranışın korunduğunu gösterir; tüm uygulamanın hatasız olduğunu garanti etmez. `pnpm validate` başarılı olduğunda tip, kod standardı, mevcut business kuralları ve temel performans bütçeleri birlikte doğrulanmış olur. Supabase migration/RLS, gerçek ağ, bildirim ve iOS cihaz akışları için ayrıca entegrasyon ve cihaz testleri gerekir.
