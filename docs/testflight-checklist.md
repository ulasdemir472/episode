# TestFlight kontrol listesi

Bu liste yeni bildirim merkezi, bölüm takibi, çevrimdışı senkronizasyon, keşfet/listem ekranları, gizlilik ve ortak listeler için cihaz kabul testidir. Otomatik testler bunların bir kısmını doğrular; APNs teslimi, iOS izinleri ve gerçek cihaz görünümü bu listede ayrıca kontrol edilir.

Her kutuyu yalnızca yanındaki beklenen sonucu gördüğünde işaretle. Önce **P0** kontrollerini tamamla; bunlardan biri başarısızsa diğer kullanıcılara dağıtımı beklet.

## Doğru sürümü kur

- [ ] GitHub Actions'ta ilgili commit'in **Mobile OTA update** çalışmasındaki testler ve backend dağıtımı başarılı. Migration, fonksiyon ve worker kontrolü hatası yok.
- [ ] TestFlight'a yeni build göndermek için **Mobile release → Run workflow → main**, `platform: ios`, `auto_submit: true` seçildi. EAS build ve gönderim tamamlandı; App Store Connect işlemesi bittikten sonra yeni build TestFlight'tan kuruldu. Mevcut Apple/EAS kimlik bilgilerinin hazır olması gerekir.
- [ ] TestFlight'ta kurduğun build numarası ve test ettiğin commit not edildi. Profilde görünen `v1.0.0` tek başına doğru build'i ayırt etmez.
- [ ] Önce mevcut kurulum güncellendi; var olan liste, favori ve bölüm ilerlemesi korundu. Temiz kurulum testi bundan sonra ayrı yapılmalı.

Bu repoda `production` profili `production` güncelleme kanalını kullanır. `main` push'u ise otomatik olarak `preview` kanalını günceller. Dolayısıyla yalnızca push yapıp eski TestFlight uygulamasını açmak bu değişiklikleri test etmek için yeterli değildir. Yeni iOS build'i yukarıdaki **Mobile release** akışıyla alınabilir. Production OTA seçimi, aynı kanalı kullanan diğer uygun build'lere de gider; mevcut production OTA davranışı [Expo kanal rehberinde](https://docs.expo.dev/eas-update/getting-started/) açıklanmıştır.

## Test hazırlığı

- İki test hesabı kullan: **A** ve **B**. İkinci cihaz varsa senkronizasyon ve uygulama kapalıyken push kontrolleri daha kolaydır.
- Bir film, birkaç bölümlük bir dizi ve yakında yeni bölümü yayımlanacak bir dizi seç.
- İlk turu Türkçe yap. Dil kontrollerinde aynı akışları İngilizce tekrarla.
- İnternet açıkken ve uçak modunda dene. Hesap silme testini yalnızca silinebilecek ayrı bir test hesabında yap.

## P0 — Açılış, giriş ve mevcut veriler

- [ ] Uygulama soğuk açılışta çalışıyor; sekmeler ve geri dönüşler boş ekran veya çökme oluşturmuyor.
- [ ] A hesabıyla girişte eski filmler, diziler, favoriler, puanlar ve bölüm ilerlemeleri doğru geliyor.
- [ ] Uygulamayı kapatıp açınca oturum ve veriler korunuyor.
- [ ] Çıkış yapıp B hesabına geçince A'nın listesi, favorileri, puanları ve bildirim sayacı görünmüyor. A'ya dönünce A'nın verileri geri geliyor.
- [ ] Şifre sıfırlama e-postasındaki bağlantı doğru ekranı açıyor; yeni şifreyle giriş yapılabiliyor.

## P0 — Keşfet, arama ve “İzlendi” rozeti

- [ ] İzlemediğin bir filmi arat. Kartında **İzlendi** rozeti yok.
- [ ] Filmin detayında **İzledim** durumuna getir. Keşfet'e dönüp aynı filmi arat: posterin sol altında küçük, yeşil onay işaretli **İzlendi** rozeti görünüyor; detaya tekrar girmek gerekmiyor.
- [ ] Aynı filmi keşfet listelerinde, ana sayfa veya favoriler gibi diğer kartlarda gördüğünde durum tutarlı.
- [ ] Filmi **İzleyeceğim**, **İzliyorum** veya **Bıraktım** durumuna alınca rozet kalkıyor. Yalnızca listeye eklemek veya puan vermek izlenmiş sayılmıyor.
- [ ] Tamamlanan filmi listeden kaldırınca rozet kalkıyor; **Geri al** ile eski tamamlandı durumu geri gelince rozet de geliyor.
- [ ] Dizi kısmen izlenmişken **İzlendi** rozeti yok; mevcut bölümler tamamlanınca görünüyor. Son bölümü geri alınca kalkıyor.
- [ ] Türkçe'de **İzlendi**, İngilizce'de **Watched** yazıyor; dil değişikliği kartlara yansıyor.
- [ ] Rozet TMDB puanı, kişisel puan ve başlıkla üst üste binmiyor. Küçük ekranda ve büyütülmüş sistem yazı boyutunda okunuyor; kart dokunulabilir durumda.
- [ ] VoiceOver açıkken kart başlığıyla birlikte izlenmiş bilgisi de okunuyor.
- [ ] Film/dizi filtreleri, tür, yıl ve minimum puan seçenekleri çalışıyor. Aramayı temizleyince keşif içerikleri geri geliyor; aşağı kaydırınca tekrarlanan kartlar oluşmuyor.

## P0 — Bölüm takibi ve ana sayfa

- [ ] Bir dizide tek bölüm işaretlenince ilerleme sayısı ve sıradaki bölüm doğru değişiyor.
- [ ] **Buraya kadar hepsi** seçimi önceki bölümleri işaretliyor; başka sezon/diziye ait ilerlemeyi değiştirmiyor.
- [ ] Ana sayfadaki **Kaldığın yer** bölümünden sıradaki yayımlanmış bölümü tamamlayınca bir sonraki bölüme geçiliyor. Henüz yayımlanmamış bölüm bu hızlı işlemle izlenmiş yapılmıyor.
- [ ] Son bölüm tamamlanınca dizi tamamlandı durumuna geçiyor; bir bölüm geri alınınca yeniden izleniyor durumuna dönüyor.
- [ ] Günün bölümleri ve öneriler yükleniyor. Listesi boş kullanıcıda uygun boş durum veya keşif önerisi var.
- [ ] Aynı işlemi ikinci cihazdan yaptıktan sonra verileri yenileyince doğru ilerleme geliyor.

## P0 — Bildirimlerim ve uygulama kapalıyken push

- [ ] **Bildirimlerim / My notifications** düğmesi bildirim ekranını açıyor; okunmamış sayacı kayıtlarla tutarlı.
- [ ] B hesabından A'ya arkadaşlık isteği gibi yeni bir sosyal olay oluştur. A'nın bildirim listesinde yeni kayıt görünüyor; kendi yaptığı işlem için kendine gereksiz bildirim oluşmuyor.
- [ ] **Okunmamış** filtresi yalnızca okunmamışları gösteriyor. Bir kaydı açınca okundu oluyor ve sayaç azalıyor; **Tümünü okundu işaretle** sonrası sayaç temizleniyor.
- [ ] Sosyal bildirim bir yorum/yanıtla ilgiliyse doğru yapımı ve ilgili hedefi açıyor. Yeni bölüm bildirimi doğru diziyi, sezonu ve bölümü açıyor.
- [ ] A cihazında telefon bildirim izni verildi, uygulama arka plana alındı/kapatıldı. B'den yeni bir sosyal olay oluşturulunca iOS bildirimi geliyor; dokununca doğru ekran açılıyor.
- [ ] **Telefon bildirimleri** kapalıyken yeni olay inbox'ta görünüyor, telefona push gelmiyor. Açınca sonraki olaylar için push çalışıyor.
- [ ] iOS Ayarlar'dan bildirim iznini kapatıp uygulamaya dönünce ekran bunu doğru yansıtıyor. İzni geri açtıktan sonra tercih tekrar etkinleştirilebiliyor.
- [ ] **Yeni bölümler** ve **Sosyal bildirimler** tercihleri birbirinden bağımsız kaydediliyor; uygulamayı kapatıp açınca korunuyor.
- [ ] A'dan çıkış yapıp B'ye geçtikten sonra bu cihaz A'ya ait yeni push'ları almıyor.

### Yeni bölüm bildirimi için bekleme koşulu

Takip edilen dizi izleme listesinde **İzliyorum** veya **Tamamlandı** durumunda olmalı; ilgili bölüm henüz izlenmemiş olmalı ve yeni bölüm tercihi açık olmalı. Bugün yeni bölümü yayımlanan bir diziyle dene; yayın günü takip başlangıcından önce olan eski bölümler için geriye dönük bildirim bekleme. Worker Cron tarafından beş dakikada bir çağrılır; diziler yaklaşık saatlik aralıklarla taranır. Bildirim için kullanıcının saat diliminde yayın gününün **09:00** saati esas alınır. Herhangi bir eski bölümü veya filmi listeye eklemek anında yeni bölüm bildirimi üretmez; **İzleyeceğim** durumundaki diziler bu taramaya dahil değildir.

- [ ] Aynı bölüm için tekrar tekrar bildirim gelmiyor. Aynı gün toplu çıkan bölümlerden yalnızca ilkine takılı kalınmıyor.
- [ ] Beklenen kayıt gelmiyorsa önce inbox kontrol edildi. Inbox var/push yok ise iOS izni ve push teslimi; inbox da yok ise worker, dizi taraması, tercihler ve yayın tarihi araştırıldı. Backend sorguları [bildirim dağıtım rehberinde](notification-deployment.md).

## P0 — Çevrimdışı kullanım ve senkronizasyon

- [ ] İnternet açıkken bir film ekle ve bir dizi bölümünü tamamla. İkinci cihazda/yeniden girişte ikisi de mevcut.
- [ ] Uçak modunda liste durumunu değiştir, bölüm işaretle ve bir yapımı listeden kaldır. Uygulamayı kapatıp tekrar aç: yerel değişiklikler kaybolmuyor.
- [ ] İnternet geri gelince değişiklikler sunucuya aktarılıyor; silinen yapım eski sunucu verisiyle geri eklenmiyor.
- [ ] Bir değişikliği çevrimdışıyken yapıp tekrar geri al. Bağlantı sonrası son seçimin korunuyor; eski değişiklik sonradan üzerine yazılmıyor.
- [ ] Senkronizasyon hatası oluştuğunda Ayarlar'da hata/yeniden deneme durumu var; tekrar denemeden sonra düzeliyor.
- [ ] Çıkış/hesap değişimi sırasında senkronize olmayan değişiklik varsa uygulamanın verdiği hata anlaşılır; değişiklikler sessizce başka hesaba taşınmıyor.

## P1 — Listem ve detay ekranı

- [ ] Tümü, Favorilerim, İzliyorum, İzleyeceğim, Tamamlandı ve Bıraktım filtreleri doğru yapımları gösteriyor; film/dizi ayrımı doğru.
- [ ] Liste içi arama ve son eklenen/ad/puan/yıl sıralaması doğru; Türkçe karakter içeren başlıklarla da denendi.
- [ ] Birden fazla yapım seçilip topluca durum değiştirilebiliyor; seçilmeyen yapımlar etkilenmiyor.
- [ ] CSV dışa aktarma paylaşım ekranını açıyor; metinde filmler/diziler ve mevcut durumları var. Virgül/tırnak içeren başlıklar bozulmuyor.
- [ ] Film ve dizi detayında favori, liste durumu ve kişisel puan birbirinden bağımsız doğru çalışıyor.
- [ ] Fragman bağlantısı açılıyor; oyuncular ve yayın platformları yükleniyor. Bölge değiştirince platform bilgisi o bölgeye göre değişiyor; veri yoksa uygun boş durum gösteriliyor.
- [ ] Bildirim veya paylaşılan liste gibi doğrudan bağlantıdan açılan detay, önceden o filmi aratmadan da yükleniyor.

## P1 — Sosyal özellikler, gizlilik ve ortak listeler

- [ ] İzlemediğin film/bölüm için yorum ve puan kilidi doğru; izledikten sonra yorum/puan eklenebiliyor.
- [ ] Yorumu hızlıca iki kez gönderince çift kayıt oluşmuyor. Yanıt, beğeni ve kendi yorumunu silme işlemleri yenileme sonrası da tutarlı.
- [ ] Spoiler işaretli yorum açılmadan metni görünmüyor; açınca doğru içerik geliyor. Yorum fotoğrafı ekleme ve izin reddi akışları anlaşılır.
- [ ] Arkadaş isteği, kabul ve arkadaşların etkinlikleri A/B hesaplarıyla çalışıyor.
- [ ] A'nın profil görünürlüğü **Yalnızca ben** olduğunda B, A'nın kısıtlı liste/favori/geçmişini göremiyor. **Arkadaşlar** seçeneğini arkadaş olan ve olmayan hesaplarla karşılaştır; **Tüm üyeler** seçeneğini de doğrula.
- [ ] A, B'yi engelleyince ilgili yorumlar gizleniyor ve B'den yeni sosyal bildirim gelmiyor. Ayarlar'dan engeli kaldırma çalışıyor.
- [ ] **Ortak izleme listeleri** ekranında liste oluştur, bir arkadaş ekle ve yapım ekle. Diğer üye yenileyince aynı listeyi görüyor; birlikte izlendi durumu iki tarafta tutarlı.
- [ ] Ortak listeye üye olmayan üçüncü hesap liste içeriğine erişemiyor. Yapımı/listeyi kaldırma kontrolleri kullanıcının yetkisine uygun.
- [ ] Watch wheel'e film/dizi ve arkadaş ekle; sonuç doğru yapımı açıyor, yinelenen kayıt oluşmuyor.

## P1 — Profil, dil ve hesap işlemleri

- [ ] Profil adı, kullanıcı adı, fotoğrafı, kapağı ve favoriler kaydetme/yeniden açma sonrasında korunuyor. Fotoğraf izni reddedilince çökme yok.
- [ ] İzleme süresi ve istatistikler film/bölüm değişikliklerine uygun güncelleniyor; aynı kayıt iki kez sayılmıyor.
- [ ] Ayarlar'dan Türkçe → English → Türkçe geçişinde bildirimler, boş/hata durumları, düğmeler ve **İzlendi/Watched** rozeti doğru dilde. Dil tercihi uygulama yeniden açılınca korunuyor.
- [ ] Gizlilik ve destek bağlantıları açılıyor; klavye açıkken ve büyük yazı boyutunda temel işlemler erişilebilir.
- [ ] Ayrı bir test hesabında hesap silme onayından **vazgeçince** oturum/veriler korunuyor. Silmeyi onaylayınca hesap kapanıyor ve o hesapla tekrar giriş yapılamıyor. İşlem hata verirse başarı mesajı gösterilmiyor.

## Hata bildirirken kaydet

```text
Build numarası / commit:
iPhone modeli / iOS:
Uygulama dili / saat dilimi:
Hesap: A / B / silinebilir test hesabı
Bağlantı: Wi-Fi / hücresel / uçak modu
Adımlar:
Beklenen:
Olan:
Ekran kaydı veya ekran görüntüsü:
Bildirimse: olay saati, inbox kaydı var mı, iOS push geldi mi?
```

## Deno bu projede ne yapıyor?

Deno, JavaScript ve TypeScript kodunu çalıştıran bir ortamdır; Node.js ile aynı türde bir araçtır. TypeScript, test çalıştırıcı ve tip kontrolü desteği sağlar. [Deno belgeleri](https://docs.deno.com/runtime/)

Bu projede mobil arayüz React Native/Expo ile telefonda çalışır. Sunucu tarafındaki Supabase Edge Functions ise Deno tabanlı ortamda çalışır: `catalog-api` TMDB/OMDb erişimini ve anahtarlarını sunucuda tutar, `notification-worker` bölüm tarama ve push kuyruğunu işler, `delete-account` doğrulanmış kullanıcının hesabını siler. [Supabase Edge Functions mimarisi](https://supabase.com/docs/guides/functions/architecture)

CI'daki `deno check` bu fonksiyonların tiplerini kontrol eder; `deno test` fonksiyon davranışlarını test eder. Zamanlamayı PostgreSQL Cron yapar, fonksiyon kodunu Deno tabanlı runtime çalıştırır. TestFlight kullanıcısının ayrıca Deno kurması gerekmez.
