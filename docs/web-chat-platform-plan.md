# Aurict Web Chat Platformu — Ürün ve Teknik Teslim Planı

Durum: tasarım planı; henüz yayımlanmış bir özellik değildir.
Plan tarihi: 2026-08-18.

## 1. Karar özeti

Aurict web sohbeti pazarlama sitesinden bağımsız deploy edilen bir uygulama ve üç
çalışma modu olarak geliştirilmelidir:

1. **Aurict Cloud:** `apps/chat`, `chat.aurict.com` altında çalışır. Kullanıcı Aurict
   hesabıyla burada giriş yapar; konuşma ve agent çalışmaları Aurict'in yönettiği
   altyapıda yürür.
2. **Self-host:** Aynı web, API, worker ve veri sözleşmeleri kullanıcının kendi
   altyapısında çalışır. Marka, auth sağlayıcısı, depolama ve model erişimi deployment
   ayarlarıyla değişir; kod çatallanmaz.
3. **Local connect:** Web istemcisi, açık onayla kullanıcının kendi CLI/Hoprel runtime'ına
   bağlanır. Bu mod ilk sürümün parçası değildir; mevcut uzaktan bağlantı protokolünün
   tarayıcı istemcisi olarak sonraki fazda eklenir.

Web arayüzü ayrı bir agent döngüsü kurmamalıdır. Terminal, Hoprel, mobil ve web aynı
`AgentRuntime` davranışını, aynı sürümlü olay sözleşmesini ve aynı izin semantiğini
tüketmelidir.

`apps/web` yalnız `aurict.com` pazarlama, dokümantasyon ve kamusal güven yüzeyi olarak
kalır. `apps/chat` aynı monorepo içinde ayrı build, CSP, environment ve release hattına
sahip olur. Böylece ürün bağımsız ölçeklenir; buna rağmen marka token'ları, protokol ve
auth backend'i kopyalanmaz.

İlk ürün odağı, ChatGPT/Claude kadar kolay açılan fakat Aurict'in çalışma disiplinini
görünür kılan bir sohbet alanıdır. Kod editörü, tam dosya gezgini, Hive işbirliği ve
uzaktan masaüstü yönetimi ilk sürümün kapsamı değildir.

## 2. Mevcut durumdan çıkan sınırlar

Depoda bugün şu parçalar vardır:

- `apps/web`, Next.js 16 üzerinde pazarlama, dokümantasyon, Firebase destekli hesap
  girişi ve hesap konsolu sunar.
- Web auth katmanı access/refresh token'larını HTTP-only cookie'de tutan bir BFF
  yaklaşımı kullanır ve `AURICT_API_URL` üzerinden backend'e gider.
- `packages/core` yerel Hono HTTP/SSE API'si, session depolaması ve ortak
  `AgentRuntime` olaylarını içerir.
- `apps/desktop` daha zengin sohbet, araç, izin, artifact, session arama/dallandırma
  ve hata kurtarma davranışlarına sahiptir; fakat IPC tipleri core sözleşmesini elle
  tekrarlar.
- `@aurict/sdk` yalnız temel session ve metin stream'ini kapsar; yeniden bağlanma,
  typed error, izin, araç, artifact ve idempotency sözleşmeleri yoktur.
- Mobil uzaktan bağlantı backend'i veri taşıyıcısı değil signaling katmanı olarak
  kullanır; WebRTC veri düzlemi CLI ile cihaz arasında kalır.

Yeni uygulama ayrımı, mevcut login/register, auth BFF ve hesap konsolu kodunun
`apps/chat` içine kontrollü taşınmasını gerektirir. Kod iki uygulamada kopyalanmamalı;
geçiş tamamlanınca `apps/web` yalnız `chat.aurict.com/login` bağlantısını göstermelidir.

Bunlardan dolayı başlangıçta UI yazmak yerine önce ortak web-runtime sözleşmesi
sabitlenmelidir. Mevcut `/v1/session/:id/message` stream'i yalnız metin için yeterlidir;
üretim web sohbeti için dayanıklı olay geçmişi ve devam mekanizması gerekir.

## 3. Ürün ilkeleri

### 3.1 Basit başlangıç, derinleşebilen çalışma

Yeni kullanıcı ekranda önce tek bir net eylem görmelidir: mesaj yazmak. Model,
provider, araç ve çalışma ayrıntıları erişilebilir olmalı; ancak ilk mesajı engelleyen
bir kurulum duvarına dönüşmemelidir.

### 3.2 Aurict farkı çıktıdan önce süreç güvenidir

Arayüz zincirleme düşünceyi göstermemelidir. Bunun yerine doğrulanabilir çalışma
durumlarını göstermelidir:

- bağlam hazırlanıyor;
- model seçildi;
- kaynak aranıyor;
- araç çalışıyor;
- kullanıcı izni bekleniyor;
- doğrulama yapılıyor;
- tamamlandı, engellendi, başarısız oldu veya iptal edildi.

### 3.3 Hata gizlenmez

Bağlantı kesilmesi, provider reddi, bütçe aşımı, eksik izin ve malformed event ayrı
durumlar olarak görünür. Genel bir “bir şeyler ters gitti” mesajı gerçek hata kodunun
yerini almaz. Yeniden denenebilir işlemler ile tekrar edilmesi güvenli olmayan işlemler
ayrılır.

### 3.4 Hosted ve self-host özellik semantiği aynıdır

Bir deployment adapter'ı auth veya depolama yöntemini değiştirebilir; conversation,
run, event, permission ve usage davranışını değiştiremez. Self-host ikinci sınıf ya da
gecikmiş bir UI olmamalıdır.

### 3.5 Verimlilik yalnız hız değildir

Başarı şu dört eksende ölçülür:

- kullanıcının göreve başlama süresi;
- model ilk yanıt süresi ve stream sürekliliği;
- gereksiz bağlam/token maliyeti;
- tamamlanan işin doğrulanabilirliği ve hata sonrası kurtarılabilirliği.

## 4. Bilgi mimarisi

Hosted route yapısı:

```text
aurict.com/
  marketing, docs, downloads, chat.aurict.com giriş bağlantısı

chat.aurict.com/login
  Aurict hesap girişi

chat.aurict.com/
  yeni sohbet / boş durum

chat.aurict.com/c/:conversationId
  sohbet çalışma alanı

chat.aurict.com/settings
  hesap, görünüm, model bağlantıları, veri ve güvenlik

chat.aurict.com/device
  CLI/Hoprel browser login cihaz onayı
```

Self-host `apps/chat` image'ını kendi origin'inin kökünde çalıştırır; `/`, `/login`,
`/c/:conversationId` ve `/settings` route'ları aynıdır. Marketing image'ı self-host
kurulumunun zorunlu parçası değildir.

Önerilen repo sınırı:

```text
apps/web/
  aurict.com pazarlama ve dokümantasyon

apps/chat/
  chat.aurict.com auth, product shell ve BFF

packages/sdk/
  runtime protokolü ve istemci

packages/web-ui/
  yalnız ortak Aurict token'ları, BrandMark ve erişilebilir temel primitive'ler
```

`apps/chat`, root workspace listesine eklenir ve kendi `package.json`, Next.js config,
test config, Dockerfile ve environment şemasına sahip olur. Ayrı repo açılmaz; aynı
monorepo atomik protokol değişikliklerini ve tek PR içinde contract testlerini korur.
`packages/web-ui` uygulama layout'u ya da feature component'i içermez; marketing ve chat
birbirinin iç yapısına import yapmaz.

### 4.1 Mevcut web auth akışının taşınması

Geçiş kullanıcı oturumunu veya CLI browser login akışını kırmadan yapılmalıdır:

1. `apps/chat` auth route'ları, hesap ekranı ve BFF ile staging origin'inde deploy edilir.
2. Firebase/OAuth callback ve backend allowed-origin listelerine kesin chat origin'i
   eklenir; production DNS açılmadan E2E doğrulanır.
3. `chat.aurict.com` açılır ve yeni host-only cookie'lerle bağımsız login doğrulanır.
4. `apps/web` navigation giriş/launch bağlantıları chat origin'ine çevrilir.
5. Eski `aurict.com/login` ve `/register` GET route'ları kalıcı redirect olur. Eski auth
   POST endpoint'leri redirect edilmez; istemci bağımlılığı kalmadığı kanıtlandıktan
   sonra kapatılır.
6. CLI/Hoprel device approval linkleri sürüm uyumluluğu gözetilerek chat origin'ine
   geçirilir; eski linkler destek penceresi boyunca güvenli GET redirect'i verir.
7. Marketing origin'indeki auth cookie ve hesap API yüzeyi kullanım kalmadıktan sonra
   kaldırılır.

Hesap verisi taşınmaz; her iki uygulama aynı authoritative auth backend'ini kullanır.
Taşınan şey yalnız browser entry point ve host-scoped session'dır.

## 5. Ana sohbet arayüzü

### 5.1 Masaüstü yerleşimi

```text
┌──────────── sol panel ────────────┬──────────── sohbet ────────────┬── bağlam ──┐
│ Aurict       [yeni sohbet]        │ başlık · runtime · model       │ aktivite   │
│ arama                              │                                │ kaynaklar   │
│ bugün                              │ konuşma akışı                   │ artifacts   │
│ dün                                │                                │ izinler     │
│ eski konuşmalar                    │                                │             │
│                                   │ composer                       │             │
│ hesap · bağlantı durumu           │                                │             │
└───────────────────────────────────┴────────────────────────────────┴─────────────┘
```

Sağ bağlam paneli varsayılan olarak kapalı veya dar olmalıdır. Bir araç, kaynak,
artifact ya da izin oluştuğunda sayaçla haber verir; sohbet metnini sürekli daraltmaz.

### 5.2 Sol panel

- Aurict işareti ve deployment etiketi: `cloud`, `self-host` veya `local`.
- Belirgin “yeni sohbet” eylemi.
- Başlık ve mesaj içinde arama; sonuçlarda kısa excerpt.
- Tarih gruplu ve sanallaştırılmış conversation listesi.
- Rename, archive ve delete işlemleri için erişilebilir menü.
- En altta kullanıcı menüsü, bağlantı durumu ve ayarlar.
- Dar görünümde panel drawer olur; conversation değişince kapanır.

İlk sürümde klasör/workspace hiyerarşisi eklenmemelidir. Kullanıcı davranışı
doğrulandıktan sonra etiket veya proje katmanı eklenebilir.

### 5.3 Üst çubuk

- Düzenlenebilir conversation başlığı.
- Runtime rozeti; özellikle self-host bağlantısının hangi instance'a gittiği açıkça
  görülür.
- Kompakt model seçici. Provider ve model tek açılır panelde aranabilir.
- Run sürerken model değiştirme bir sonraki turn'e uygulanır; aktif run'ı sessizce
  etkilemez.
- Paylaşma ilk sürümde yoktur. Export, güvenli ve yerel bir Markdown/JSON indirmesi
  olarak sonraki küçük faza alınabilir.

### 5.4 Boş durum

Merkezde kısa bir Aurict cümlesi, geniş composer ve en fazla dört bağlama uygun
başlangıç önerisi bulunur. Örnek öneriler kullanıcının geçmiş mesajını sunucuya
göndermeden üretilebilmelidir.

İlk giriş akışı:

1. Hesap doğrulanır.
2. Kullanılabilir runtime ve model erişimi kontrol edilir.
3. Model erişimi yoksa tek, açıklayıcı kurulum kartı açılır.
4. Erişim varsa kullanıcı doğrudan composer'a odaklanır.

### 5.5 Conversation akışı

- Kullanıcı mesajı kompakt, assistant mesajı daha geniş ve okunabilir görünür.
- Assistant cevabı `Source Serif 4`, kontroller ve metadata `IBM Plex Mono` kullanır.
- Markdown; heading, tablo, kod bloğu, alıntı, görev listesi ve linkleri destekler.
- Her assistant turn'ünde copy, yeniden dene, branch ve bildir eylemleri hover/focus
  sırasında görünür.
- Tool çalışmaları cevap içinde uzun log olarak açılmaz. Kısa bir aktivite satırı
  gösterilir; ayrıntı sağ panelde açılır.
- Kaynak iddiaları inline citation ile, tam kaynak listesi sağ panelde gösterilir.
- Artifact'ler sohbet içinde küçük preview kartı ve sağ panelde tam görünüm alır.
- Kullanıcı yukarı kaydırdıysa otomatik scroll durur; `son mesaja git` eylemi görünür.

### 5.6 Composer

Composer ürünün en yüksek öncelikli bileşenidir:

- otomatik büyüyen çok satırlı input;
- `Enter` gönderir, `Shift+Enter` satır açar; davranış ayarlardan değişebilir;
- drag/drop, paste ve dosya seçici ile attachment;
- seçilen dosyalar gönderilmeden önce boyut ve türleriyle görünür;
- aktif run sırasında gönder butonu stop butonuna döner;
- model ve çalışma modu composer altında kompakt görünür;
- desteklenmeyen dosya, bağlam limiti ve provider eksikliği gönderimden önce fail eder;
- ağ kopukken metin taslak olarak cihazda kalır, otomatik olarak sunucuya gönderilmez.

İlk sürümde ayrı “research”, “code” ve “agent” mod butonları eklenmemelidir. Core'daki
intent/capability routing kullanılmalı; yalnız kullanıcının açık kontrol gerektirdiği
durumlarda `hızlı`, `dengeli`, `derin` gibi bütçe profilleri sonraki fazda sunulmalıdır.

### 5.7 İzin deneyimi

İzin, modal yağmuru değil turn içi karar kartıdır:

- araç ve amaç;
- etkilenebilecek kapsam;
- risk seviyesi;
- `bir kez izin ver`, uygun olduğunda `bu kapsam için izin ver`, `reddet`;
- kararın hangi run/turn için geçerli olduğu.

Self-host veya local-connect modunda dosya ve shell izinleri gösterilebilir. Hosted saf
sohbette çalışma alanı yoksa bu kontroller UI'ya hiç eklenmez.

### 5.8 Durum matrisi

Her ekran aşağıdaki durumların tasarımını içermelidir:

| Durum | Kullanıcıya gösterilecek davranış |
|---|---|
| İlk yükleme | Shell hemen görünür, içerik skeleton olur |
| Boş conversation | Composer odaklı başlangıç |
| Gönderiliyor | Kullanıcı mesajı optimistic, server kabulü bekleniyor |
| Stream | Batched metin, aktif çalışma özeti ve stop |
| İzin bekliyor | Turn içi karar kartı, composer kilitlenmez ama yeni run başlatmaz |
| Reconnect | Son event sequence görünür biçimde devam ettirilir |
| Offline | Taslak korunur, otomatik gönderim yapılmaz |
| Rate limit / bütçe | Limit türü ve sıfırlanma zamanı açıkça gösterilir |
| Provider hatası | Provider hata kodu, güvenli retry ve model değiştirme |
| Run blocked | Eksik karar veya veri ve devam eylemi |
| Run failed | Kalıcı hata kaydı, retry last task |
| Run cancelled | Kısmi cevap korunur ve iptal etiketi alır |

## 6. Aurict görsel sistemi

ChatGPT minimalizmi yerleşim sadeliği için referans olabilir; görsel kimlik kopyalanmaz.
Mevcut Aurict token'ları ürün shell'ine uyarlanır:

- sıcak siyah/kahverengi arka plan;
- oxblood accent, amber ikincil vurgu;
- serif cevap metni, mono kontrol ve sistem dili;
- 1 px düşük kontrast border, 8–12 px radius;
- grain yalnız büyük arka plan yüzeyinde ve çok düşük yoğunlukta;
- glow yalnız focus, aktif runtime veya kritik durumlarda;
- kart yığınları yerine boşluk, tipografi ve ince ayraçlarla hiyerarşi.

Ürün shell'inde pazarlama sayfasına ait scroll progress, back-to-top, büyük reveal
animasyonları ve sürekli hareket eden ambient efektler yüklenmemelidir.
`prefers-reduced-motion` eksiksiz desteklenmeli, klavye odağı hiçbir durumda yalnız
renkle anlatılmamalıdır.

Responsive kırılımlar:

- `>= 1280 px`: sol panel + merkez + isteğe bağlı sağ panel;
- `768–1279 px`: sol panel dar/drawer, sağ panel overlay;
- `< 768 px`: tek kolon, üst bar ve tam ekran drawer/sheet'ler.

## 7. Hedef sistem mimarisi

```text
Browser
  │ chat.aurict.com · HTTPS · host-only HTTP-only session cookie
  ▼
Next.js chat/BFF (`apps/chat`)
  │ authenticated commands + read models
  ▼
Aurict Control API (Hono)
  ├── PostgreSQL: identity mapping, conversations, runs, events, usage
  ├── object storage: attachments and artifacts
  ├── secret-store adapter: provider credentials
  └── durable run queue
          │ leased job + short-lived capability
          ▼
      Aurict Worker
          │
          └── AgentRuntime → provider/tools/sandbox
```

### 7.1 Servis sınırları

**Next.js chat/BFF**

- HTML ve product shell;
- HTTP-only cookie yönetimi;
- same-origin CSRF kontrolü;
- browser'a uygun API projection;
- static assets ve i18n.

Uzun agent işi Next.js request process'inde çalışmamalıdır.

İlk sürümde browser, Control API'ye doğrudan bearer token ile bağlanmaz. Chat BFF,
host-only cookie'yi doğrular ve komut/SSE akışını internal API'ye proxy eder. Böylece
JavaScript token görmez ve cross-origin auth karmaşıklığı oluşmaz. Ölçümler BFF stream
proxy'sini darboğaz gösterirse sonraki optimizasyon, URL query'sine token koymak değil,
API origin'inde kısa ömürlü host-only stream oturumu olmalıdır.

**Control API**

- auth doğrulama ve workspace membership;
- conversation/run komutları;
- idempotency;
- durable event log;
- usage, kota ve audit;
- pre-signed upload/download izinleri.

**Worker**

- `AgentRuntime` çalıştırır;
- run bütçelerini uygular;
- event'leri sıralı ve dayanıklı şekilde yazar;
- hosted modda sandbox sınırını uygular;
- lease kaybında yeni side effect başlatmaz.

### 7.2 Deployment topology

Hosted topology:

```text
aurict-marketing  # apps/web, aurict.com
aurict-chat       # apps/chat, chat.aurict.com
aurict-api
aurict-worker
postgres
S3-compatible object store (attachment/artifact kullanılıyorsa)
reverse proxy
```

Marketing ve chat image'ları bağımsız deploy, health check, CSP, cache ve release
rollback alanlarına sahiptir. Marketing arızası aktif sohbeti; chat deploy'u marketing
sayfalarını etkilememelidir.

Self-host Compose yalnız `aurict-chat`, API, worker, PostgreSQL, reverse proxy ve
gerekiyorsa object store'u içerir. Next.js'in self-host streaming akışında proxy
buffering kapatılmalı ve chat process'i doğrudan internete açılmamalıdır. Kubernetes
manifestleri gerçek talep oluşmadan ilk sürüme eklenmemelidir.

Tek binary/SQLite “lite” dağıtımı çekici görünse de ilk sürümde ayrı bir veri semantiği
yaratır. Hosted ve self-host için PostgreSQL kullanmak migration, sıra, tenant izolasyonu
ve hata davranışını aynı tutar. Daha hafif embedded mod ancak ölçülen kurulum sürtünmesi
bunu gerektirirse ayrıca tasarlanmalıdır.

### 7.3 Queue kararı

İlk sürümde ek Redis bağımlılığı zorunlu tutulmamalıdır. PostgreSQL tabanlı dayanıklı
job queue veya `FOR UPDATE SKIP LOCKED` kullanan olgun bir kütüphane için kısa bir ADR
ve yük/çökme spike'ı yapılmalıdır. Seçim şu şartları sağlamalıdır:

- worker lease ve heartbeat;
- retry sayısı ve görünür dead-letter durumu;
- idempotency key;
- cancellation;
- aynı conversation'da varsayılan tek aktif run;
- process çökmesinden sonra sahiplenme;
- en az bir kez teslim altında side-effect güvenliği.

## 8. Ortak protokol

Yeni sözleşme `aurict.web-runtime/v1` olarak sürümlenmeli ve `packages/sdk` içinde
taşıma bağımsız tipler, codec/validation ve istemci olarak ayrılmalıdır. Desktop'ın
elle çoğalttığı tipler daha sonra bu canonical sözleşmeye taşınır.

### 8.1 Komutlar

Önerilen minimum yüzey:

```text
GET    /v1/me
GET    /v1/runtime-capabilities
GET    /v1/conversations?cursor=
POST   /v1/conversations
GET    /v1/conversations/:id
PATCH  /v1/conversations/:id
DELETE /v1/conversations/:id
POST   /v1/conversations/:id/turns
POST   /v1/runs/:id/cancel
POST   /v1/runs/:id/permissions/:permissionId
GET    /v1/runs/:id/events?after=:sequence
POST   /v1/attachments/initiate
POST   /v1/attachments/:id/complete
```

Her mutation `Idempotency-Key` kabul eder. `POST .../turns` uzun süre açık bir request
olarak agent'ı çalıştırmaz; kullanıcı mesajını ve run kaydını atomik oluşturup `202`
döner. İstemci run event stream'ine bağlanır.

### 8.2 Event zarfı

```ts
type RuntimeEventEnvelope<T> = {
  schemaVersion: 1
  eventId: string
  conversationId: string
  runId: string
  sequence: number
  occurredAt: string
  type: string
  payload: T
}
```

Minimum event ailesi:

- `run.accepted`
- `run.phase_changed`
- `model.selected`
- `assistant.text_delta`
- `assistant.message_completed`
- `tools.selected`
- `tool.requested`
- `tool.completed`
- `permission.requested`
- `permission.resolved`
- `artifact.updated`
- `context.compacted`
- `provider.fallback`
- `usage.updated`
- `run.completed`
- `run.blocked`
- `run.failed`
- `run.cancelled`

Kurallar:

- Sequence run içinde monoton artar.
- Her run tam bir terminal event ile biter.
- Delta event'leri geçici UI için, tamamlanmış message kaydı canonical içerik için
  kullanılır.
- Tool sonucu model içeriği ile kullanıcıya gösterilecek özet alanlarını ayırır.
- Chain-of-thought veya gizli provider reasoning'i event yapılmaz.
- Unknown schema/type sessizce atlanmaz; telemetry ve görünür uyumsuzluk durumuna gider.

### 8.3 Streaming seçimi

Server → browser için ilk tercih SSE'dir; browser → server komutları normal HTTPS
istekleridir. Bunun gerekçesi:

- mevcut Hono ve local API yönüyle uyumludur;
- reverse proxy ve self-host işletimi daha basittir;
- event `id` ve sequence ile yeniden bağlanma tanımlanabilir;
- chat çoğunlukla server'dan istemciye akan bir problemdir.

SSE heartbeat gönderir. İstemci son işlenmiş sequence'i saklar ve reconnect sonrası
kaçırdığı event'leri ister. WebSocket yalnız presence, WebRTC signaling veya gerçekten
çift yönlü düşük gecikmeli bir özellik kanıtlandığında eklenmelidir.

## 9. Veri modeli

Hosted her kullanıcıya başlangıçta kişisel bir workspace verir. İleride ekip üyeliği
eklenebilmesi için tüm ürün verileri `workspace_id` ile scope edilir; UI ilk sürümde
workspace yönetimini göstermek zorunda değildir.

Minimum tablolar:

| Tablo | Amaç |
|---|---|
| `users` | Aurict hesap kimliği |
| `auth_identities` | password/Firebase/OIDC kimlik eşlemesi |
| `workspaces` | kişisel veya ileride organizasyon scope'u |
| `workspace_members` | rol ve üyelik |
| `conversations` | başlık, durum, model varsayılanı, timestamps |
| `messages` | user/assistant/system görünür mesajları |
| `message_parts` | text, citation, tool summary, attachment, artifact referansı |
| `runs` | state, worker lease, model, bütçe, terminal sonuç |
| `run_events` | sequence'li dayanıklı olay kaydı |
| `permissions` | istek, kapsam, karar ve karar veren |
| `attachments` | metadata, object key, scan durumu |
| `artifacts` | tür, lifecycle, object key, revision |
| `provider_connections` | provider metadata ve secret reference; secret'ın kendisi değil |
| `usage_ledger` | token, maliyet, kota ve faturalama girdisi |
| `audit_events` | güvenlik ve hesap işlemleri |
| `idempotency_keys` | mutation tekrar güvenliği |

Tenant kontrolü hem uygulama servisinde hem PostgreSQL Row-Level Security ile yapılır.
RLS sahibi/bypass rolü riskine karşı API runtime rolü tablo sahibi olmamalı ve kritik
tablolarda `FORCE ROW LEVEL SECURITY` değerlendirilmelidir. Migration ve backup rolleri
ayrıdır.

Mesaj silme ile audit/usage saklama aynı şey değildir. Retention ve account deletion
politikası tablo bazında yazılmadan hosted beta açılmamalıdır.

## 10. Kimlik, model erişimi ve secret politikası

### 10.1 Hosted auth

Mevcut login/register/Firebase → backend → HTTP-only access/refresh cookie akışı
`apps/chat` içine taşınarak korunur. Hosted cookie'ler yalnız `chat.aurict.com` host'una
aittir; `Domain=.aurict.com` kullanılmaz. Marketing sitesi giriş butonuyla chat login
route'una yönlendirir, fakat chat oturumunu okuyamaz. Eklenmesi gerekenler:

- refresh token rotation ve reuse tespiti;
- aktif cihaz/session listesi ve tekil revoke;
- rate limit ve kaba kuvvet koruması;
- email verification politikası;
- Firebase/OAuth callback allowlist'inde yalnız kesin chat origin'leri;
- `returnTo` için relative-path allowlist ve open redirect testleri;
- güvenlik olayları;
- account deletion job ve retention kanıtı.

Browser access/refresh token'larını JavaScript ile okuyamaz. BFF istekleri same-origin
kalır. `aurict.com` ve `chat.aurict.com` arasında localStorage, postMessage veya geniş
kapsamlı cookie ile oturum aktarılmaz. İleride ayrı bir merkezi hesap portalı gerekirse
tek kullanımlık authorization code + PKCE benzeri bir exchange tasarlanır.

### 10.2 Self-host auth

Firebase zorunlu bağımlılık olmamalıdır. Adapter arayüzü şu modları desteklemelidir:

- ilk kurulumda local admin + password;
- standart OIDC provider;
- deployment yöneticisi isterse kayıt kapalı/invite-only.

Self-host, `auth=disabled` seçeneğini internete açık kurulum için sunmamalıdır. Yalnız
loopback geliştirici modu ayrı ve açık bir risk uyarısıyla düşünülebilir.

### 10.3 Model erişim seçenekleri

Hosted web için ürün kararı açıkça verilmelidir:

1. **Aurict kredisi:** Model erişimini Aurict hesabı sağlar; kullanıcı provider key
   vermez. En kolay deneyim, fakat billing ve abuse altyapısı gerekir.
2. **Hosted BYOK:** Kullanıcı key'i açık onayla Aurict secret store'a kaydeder. Key
   envelope encryption ile saklanır, yalnız worker'a kısa süreli çözülür ve hiçbir log,
   event veya analytics'e girmez.
3. **Local connect BYOK:** Key kullanıcının cihazında kalır; aurict.com veri düzlemi
   olmaz. En güçlü local-first seçenek, fakat yerel runtime açık olmalıdır.

Önerilen teslim sırası: self-host BYOK + sınırlı hosted beta modeli; hosted kalıcı BYOK
vault yalnız threat model ve silme/rotation akışı tamamlandıktan sonra. “Key'ler asla
sunucuya gitmez” mevcut vaadi, hosted vault açılırsa deployment modu bazında yeniden
yazılmalıdır.

## 11. Güvenlik sınırları

Hosted worker, kullanıcının isteğine göre control-plane process'inde shell veya dosya
aracı çalıştırmamalıdır. En azından process/container seviyesinde izole run alanı,
read-only base image, sınırlı writable volume, egress policy, CPU/RAM/zaman bütçesi ve
secret kapsamı gerekir.

Zorunlu kontroller:

- CSP, secure headers, origin/CSRF kontrolü;
- auth ve run endpoint'lerinde kullanıcı/IP bazlı rate limit;
- attachment boyut/tür doğrulaması, malware taraması ve karantina durumu;
- object key'lerin opaque olması, kısa ömürlü signed URL;
- SSRF koruması ve redirect tekrar doğrulaması;
- secret redaction; prompt, tool ve exception loglarında provider key taraması;
- model/tool bütçe limitleri;
- external write ve destructive action için açık izin;
- audit event'lerinde zincirleme düşünce, tam prompt veya secret bulunmaması;
- dependency ve container image taraması;
- backup restore tatbikatı;
- account export/delete ve retention job testleri.

Public paylaşım linki, ekip workspace'i ve üçüncü taraf connector'lar ayrı threat model
olmadan eklenmemelidir.

## 12. Frontend teknik tasarımı

### 12.1 Render sınırı

Server Components:

- auth guard ve initial account;
- conversation list initial page;
- conversation metadata ve tamamlanmış message snapshot;
- settings read models.

Client Components:

- composer ve draft;
- SSE aboneliği;
- incremental turn projection;
- virtualized listeler;
- drawer, model picker, permission ve attachment etkileşimleri.

Global bir client store'a tüm uygulamayı taşımak yerine feature-scope state ve server
cache kullanılmalıdır. State library ancak optimistic update, pagination ve event
reconciliation spike'ı native React yaklaşımının yetersizliğini gösterirse seçilir.

### 12.2 Önerilen modül sınırları

```text
apps/chat/src/features/chat/
  api/
  model/
  components/
  hooks/
  projections/

apps/chat/src/features/conversations/
apps/chat/src/features/attachments/
apps/chat/src/features/permissions/
apps/chat/src/features/runtime/
apps/chat/src/features/settings/

packages/sdk/src/protocol/
packages/sdk/src/client/
packages/sdk/src/stream/
packages/sdk/src/errors/
```

Hiçbir chat reducer, transcript veya workspace screen yaklaşık 500 satıra
yaklaşmamalıdır. Event → UI dönüşümü pure projection fonksiyonlarında tutulmalı;
component'ler protokol ayrıntısı parse etmemelidir.

### 12.3 Performans kuralları

- Token delta'ları her karakterde React render etmez; 16–50 ms aralıkta batch edilir.
- Streaming Markdown tüm metni her token'da baştan parse etmez; aktif block sınırlı
  aralıkta güncellenir, tamamlandığında canonical render yapılır.
- Uzun conversation ve sol panel listeleri sanallaştırılır.
- Eski tool output'ları ilk yüklemede indirilmez.
- Attachment upload doğrudan object storage'a yapılır; web server dosya taşımaz.
- Marketing kodu `apps/chat` build graph'ına girmez; yalnız küçük ortak token/primitive
  paketi paylaşılır.
- İlk shell için font ve CSS dışında üçüncü taraf script zorunlu olmaz.
- Analytics, kullanıcının prompt veya cevap metnini hiçbir zaman property yapmaz.

## 13. Gözlemlenebilirlik ve ürün ölçüleri

Teknik SLO adayları:

- composer submit → `run.accepted`: p95 < 300 ms;
- event persist → bağlı browser render: p95 < 250 ms;
- reconnect sonrası eksik event tamamlama: p95 < 2 s;
- başarılı run'larda terminal event eksikliği: 0;
- duplicate user turn: idempotency testlerinde 0;
- self-host smoke install → ilk mesaj: dokümante edilmiş tek akışta < 10 dakika.

Model TTFT ayrı ölçülür; Aurict dispatch gecikmesiyle karıştırılmaz. Dashboard kırılımları:

- auth ve onboarding dönüşümü;
- ilk mesaj başarı oranı;
- run completion/blocked/failed/cancelled oranı;
- provider/model bazında TTFT ve stream kesintisi;
- tool başarı ve permission deny oranı;
- token/cache/cost;
- reconnect ve resume başarısı;
- kullanıcı bildirimi ve retry sonucu.

Prompt, dosya içeriği, provider key ve chain-of-thought telemetry'ye girmez. Self-host
telemetry varsayılan kapalıdır; opt-in ve gönderilecek alanların önizlemesi olmalıdır.

## 14. Test stratejisi

### Contract

- Event codec golden testleri.
- Eski/yeni schema compatibility.
- Unknown event ve malformed payload fail-loud davranışı.
- Desktop/local/web projection conformance.

### Backend

- Workspace/tenant erişim matrisi ve RLS testleri.
- Idempotent turn oluşturma.
- Worker lease kaybı ve crash recovery.
- Sequence gap/duplicate event.
- Cancellation ve terminal event invariants.
- Auth refresh rotation/revocation.
- Attachment quarantine ve signed URL süresi.

### Frontend

- Composer klavye, attachment ve draft davranışı.
- Stream batching ve Markdown tamamlama.
- Auto-scroll durdurma/geri dönme.
- Permission allow/deny.
- Offline/reconnect/resume.
- Screen reader canlı bölge davranışı.
- Light/dark, reduced motion ve 320 px–geniş ekran responsive.
- Marketing origin'inin chat cookie'sini alamadığı ve chat API'sine authenticated istek
  yaptıramadığı subdomain izolasyon testi.
- Login/register `returnTo` allowlist ve open redirect testleri.

### E2E ve operasyon

- `aurict.com` giriş bağlantısı → `chat.aurict.com/login` → ilk konuşma.
- Kayıt → ilk konuşma → stream → reload → resume.
- Marketing ve chat image'larının bağımsız deploy/rollback smoke testi.
- Self-host Docker Compose clean install.
- Marketing image'ı olmadan self-host ilk mesaj testi.
- Reverse proxy buffering kapalı streaming smoke testi.
- İki farklı kullanıcının verisine erişememe testi.
- Provider timeout/rate limit/fallback.
- Worker öldürme ve job recovery.
- Backup'tan restore.
- Account deletion ve retention.
- Baseline load, uzun conversation ve yavaş istemci backpressure.

## 15. Teslim fazları

### Faz 0 — Kararları ve sözleşmeyi sabitle

Çıktılar:

- hosted model erişim ADR'si;
- auth adapter ADR'si;
- queue spike ve ADR;
- threat model ve veri sınıflandırması;
- `aurict.web-runtime/v1` codec ve contract testleri;
- tasarım token'ları ve düşük çözünürlüklü responsive wireframe.

Çıkış kriteri: mock server'dan gelen tüm run durumları web ve desktop projection
testlerinde aynı semantiğe dönüşür.

### Faz 1 — Product shell ve konuşma prototipi

Çıktılar:

- bağımsız `apps/chat` Next.js uygulaması ve root workspace kaydı;
- `chat.aurict.com` deploy/environment/CSP sınırı;
- mevcut auth BFF ve hesap ekranlarının kopyalanmadan kontrollü taşınması;
- `apps/web` navigasyonunda chat login/launch bağlantısı;
- auth guard, sol panel, boş durum, transcript, composer ve bağlam drawer;
- sahte/deterministic event stream;
- responsive, keyboard ve accessibility testleri;
- mevcut Aurict tema token'larının product varyantı.

Çıkış kriteri: gerçek provider olmadan tüm durum matrisi Playwright ile gezilebilir.

### Faz 2 — Hosted kapalı beta

Çıktılar:

- PostgreSQL data modeli ve tenant politikaları;
- Control API, worker lease ve durable SSE;
- conversation CRUD, text stream, cancel, retry ve usage;
- sınırlı model erişimi;
- log redaction, rate limit ve operasyon dashboard'u.

Çıkış kriteri: iki ayrı hesapla veri izolasyonu, worker crash recovery ve reload sonrası
stream resume E2E testlerinden geçer.

### Faz 3 — Self-host parity

Çıktılar:

- aynı image'lardan Docker Compose;
- local admin ve OIDC auth adapter'ları;
- reverse proxy örneği, health/readiness ve backup/restore dokümanı;
- self-host update/migration prosedürü;
- opt-in telemetry.

Çıkış kriteri: temiz makinede dokümante edilen kurulum, ilk sohbet, restart, upgrade ve
restore testi geçer; hosted ile contract testleri aynıdır.

### Faz 4 — Aurict çalışma derinliği

Çıktılar:

- attachments;
- tool timeline ve izinler;
- citations ve kaynak paneli;
- artifact preview/download;
- branch, search, archive ve export;
- bütçe profilleri ve görünür usage.

Çıkış kriteri: read-only, workspace write, dış ağ ve external write etkileri UI'da doğru
özetlenir; retry safety semantiği test edilir.

### Faz 5 — Local connect

Çıktılar:

- browser trusted-device kaydı;
- mevcut signaling/WebRTC protokolüyle local runtime bağlantısı;
- backend'in veri düzlemi olmadığına dair doğrulama;
- bağlantı/revocation/resume UI'sı;
- cloud, self-host ve local session'ların açık biçimde ayrılması.

Çıkış kriteri: prompt, tool output ve model cevabının signaling backend loglarına
girmediği protokol testiyle kanıtlanır.

## 16. İlk backlog sırası

1. Hosted model erişim kararını ver.
2. Canonical runtime event sözleşmesini çıkar; local API, desktop IPC ve SDK farklarını
   tablo haline getir.
3. Conversation/run/event veri modelini ve invariant'larını yaz.
4. Threat model: auth, tenant, provider key, attachment, worker ve delete akışları.
5. Product shell wireframe ve durum matrisi prototipi.
6. Deterministic mock stream ile frontend dikey dilimi.
7. PostgreSQL + worker lease dikey dilimi.
8. Tek provider ile kapalı beta E2E.
9. Self-host Compose parity.
10. Tool/permission/artifact dikey dilimleri.
11. Local-connect araştırma spike'ı.

## 17. Şimdi verilecek, ertelenmeyecek kararlar

- Aynı monorepo içinde ayrı `apps/chat` aç; ayrı repo veya `apps/web` route group'u
  kullanma.
- Marketing ve chat arasında `.aurict.com` kapsamlı ortak cookie kullanma; chat
  oturumunu host-only tut.
- Agent çalışmasını Next.js process'ine koyma; ayrı worker kullan.
- Hosted ve self-host için ayrı backend yazma; adapter ve config kullan.
- Browser state'ini canonical kayıt sayma; tamamlanmış message ve event log server'da
  authoritative olsun.
- SSE event'lerini geçici byte stream olarak görme; sequence'li resume sözleşmesi kur.
- Desktop, SDK ve web için üçüncü kez tip kopyalama; tek protokol paketi kullan.
- Provider key politikasını pazarlama metninden bağımsız bırakma; deployment moduna göre
  açıkça ifade et.
- İlk sürümü tam IDE yapma; sohbet, güvenilir stream ve self-host parity'yi bitir.

## 18. Önerilen ürün varsayımları ve onay noktaları

Maksimum kullanıcı verimliliği ve en düşük güvenlik borcu için önerilen başlangıç
varsayımları şunlardır:

1. Hosted kapalı beta, Aurict tarafından yönetilen küçük ve sert limitli bir krediyle
   başlar. Böylece kullanıcı anahtar kasası ilk kritik yola girmez ve ilk mesaj öncesi
   kurulum olmaz. Kalıcı hosted BYOK daha sonra ayrı güvenlik incelemesiyle açılır.
2. Self-host kurulumu varsayılan tek kullanıcı/local admin ile açılır; aynı auth adapter'ı
   içinde OIDC çok kullanıcı desteği Faz 3 çıkış kriteridir. İnternete açık auth'suz mod
   sunulmaz.
3. İlk hedef genel kişisel assistant shell'i + Aurict runtime'dır. Proje dosyası, shell
   ve workspace write araçları Faz 4'e kadar kapalı kalır.

Ürün sahibi bu üç varsayımı uygulama başlamadan onaylamalı veya değiştirmelidir. Görsel
shell değişmez; fakat billing, sandbox, auth ve veri saklama öncelikleri değişir.

## 19. Referanslar

- [Aurict Product Overview](product-overview.md)
- [Agent Runtime](agent-runtime.md)
- [Local HTTP API](api.md)
- [Security & Compliance](security-and-compliance.md)
- [Mobile App](mobile.md)
- [Next.js self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting)
- [Hono streaming helper](https://hono.dev/docs/helpers/streaming)
- [PostgreSQL row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [MDN server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
