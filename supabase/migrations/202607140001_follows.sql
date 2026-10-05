begin;

-- Takipçi/takip edilen görünümü artık kabul edilmiş arkadaşlıklardan türetiliyor.
-- Uzak projeye hiç uygulanmamış eski follows tablosunu oluşturup bir sonraki
-- migration'da silmek yerine bu migration bilinçli olarak veri değiştirmez.

commit;
