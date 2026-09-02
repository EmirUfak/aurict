import type { AppLocale } from "@/i18n/config"

type AiCodingAgentCopy = {
  metadata: { title: string; description: string; keywords: string[] }
  breadcrumb: string
  hero: { eyebrow: string; title: string; lede: string; install: string; compare: string; proof: string[] }
  definition: { title: string; paragraphs: string[] }
  differences: { eyebrow: string; title: string; intro: string; items: Array<{ title: string; body: string }> }
  evaluation: { eyebrow: string; title: string; intro: string; items: Array<{ title: string; body: string }> }
  workflows: { eyebrow: string; title: string; intro: string; items: Array<{ title: string; body: string; href: string }> }
  alternatives: { eyebrow: string; title: string; body: string; links: Array<{ label: string; href: string }> }
  faq: { eyebrow: string; title: string; items: Array<{ question: string; answer: string }> }
  final: { title: string; body: string; docs: string; install: string }
}

const content = {
  en: {
    metadata: {
      title: "AI Coding Agent — Open Source & Terminal-Native",
      description: "Aurict is an open-source AI coding agent with project context, specialist agents, BYOK providers, MCP, explicit approvals, and verification evidence.",
      keywords: ["AI coding agent", "coding agent", "open source AI coding agent", "agentic coding", "CLI coding agent", "AI software engineering agent", "Claude Code alternative", "multi-agent coding assistant"],
    },
    breadcrumb: "AI Coding Agent",
    hero: {
      eyebrow: "open-source AI coding agent",
      title: "An AI coding agent for work beyond autocomplete.",
      lede: "Aurict can inspect a repository, coordinate specialist agents, edit project files through typed tools, run checks, and preserve completion evidence. You choose the model provider and keep the terminal as the control surface.",
      install: "install Aurict", compare: "compare coding agents", proof: ["9 specialist agents", "12 built-in providers", "MCP-compatible tools", "macOS · Linux · Windows"],
    },
    definition: {
      title: "What is an AI coding agent?",
      paragraphs: [
        "An AI coding agent is software that can move from a development request to actions inside a codebase. It goes beyond suggesting the next line: it can inspect files, reason about dependencies, use development tools, make scoped changes, run verification, and explain the result.",
        "A coding assistant usually waits for a narrowly framed prompt or offers inline suggestions. An agent can coordinate a longer workflow, but that extra autonomy needs boundaries. Useful systems make permissions, project scope, tool activity, verification, and unfinished work visible to the developer.",
        "Aurict implements that pattern as an open-source terminal runtime. Specialist roles separate exploration, implementation, review, testing, documentation, security, debugging, performance, and analytics while one coordinated task keeps the evidence connected.",
      ],
    },
    differences: {
      eyebrow: "agent vs assistant", title: "The difference is the workflow, not the label.", intro: "Evaluate what the tool can actually do after receiving a task.",
      items: [
        { title: "Repository context", body: "An agent maps relevant files, dependencies, conventions, and risks before changing code." },
        { title: "Tool use", body: "It can call explicit tools for search, file changes, documentation, browser checks, tests, and evaluation." },
        { title: "Bounded action", body: "Permissions and project scope determine which actions may proceed and which require direct approval." },
        { title: "Verification", body: "A completion record distinguishes executed checks from assumptions, waivers, and work that remains open." },
      ],
    },
    evaluation: {
      eyebrow: "buyer checklist", title: "How to choose an AI coding agent.", intro: "Compare products against your real repositories and operating constraints.",
      items: [
        { title: "Provider and model choice", body: "Check whether the runtime supports your preferred hosted or local models and whether you control the provider credentials." },
        { title: "Permission model", body: "Look for clear boundaries around shell commands, file mutations, external services, secrets, and destructive actions." },
        { title: "Context quality", body: "Confirm how the agent discovers architecture, installed dependencies, project instructions, and relevant source without flooding the model." },
        { title: "Evidence of completion", body: "Require the agent to report changed files, checks it actually ran, failures, skipped work, and unresolved risks." },
        { title: "Extensibility", body: "Evaluate MCP support, custom tools, reusable skills, and whether integrations stay inspectable." },
        { title: "Workflow fit", body: "Test terminal, IDE, remote-server, operating-system, latency, and cost tradeoffs using a representative task." },
      ],
    },
    workflows: {
      eyebrow: "coding agent use cases", title: "Use the same runtime across the engineering loop.", intro: "Start with one bounded task, then expand only when the agent proves it can preserve project constraints.",
      items: [
        { title: "Repository exploration", body: "Map architecture, dependencies, ownership, and the files relevant to a proposed change.", href: "/terminal-agent" },
        { title: "Refactoring", body: "Plan multi-file changes, preserve public contracts, and verify affected behavior.", href: "/use-cases/refactoring" },
        { title: "Code review", body: "Inspect a diff for correctness, security, performance, maintainability, and missing tests.", href: "/use-cases/code-review" },
        { title: "Testing and documentation", body: "Add meaningful coverage and update documentation from the paths that were actually changed.", href: "/use-cases/testing" },
      ],
    },
    alternatives: {
      eyebrow: "alternatives", title: "Compare AI coding agents with documented criteria.", body: "Aurict overlaps with terminal agents and AI development environments, but each product makes different tradeoffs. Review official sources and test the same task before choosing.",
      links: [
        { label: "Claude Code alternative", href: "/compare/claude-code" }, { label: "Cursor alternative", href: "/compare/cursor" },
        { label: "Aider alternative", href: "/compare/aider" }, { label: "GitHub Copilot CLI alternative", href: "/compare/github-copilot" },
        { label: "OpenCode alternative", href: "/compare/opencode" },
      ],
    },
    faq: {
      eyebrow: "AI coding agent FAQ", title: "Questions developers ask before adopting an agent.",
      items: [
        { question: "Is Aurict an AI coding agent or an autocomplete tool?", answer: "Aurict is a terminal-native agent runtime. It is designed to inspect projects, coordinate tools and specialist roles, make scoped changes, run verification, and report evidence rather than only predict inline code." },
        { question: "Is Aurict a Claude Code alternative?", answer: "Yes for developers comparing terminal coding workflows. Aurict emphasizes provider choice, specialist agents, scoped Project Auto, and durable completion evidence; Claude Code provides Anthropic's official coding workflow. Compare both against the same repository task." },
        { question: "Can I choose the AI model provider?", answer: "Yes. Aurict includes adapters for supported cloud and local providers. You supply the relevant provider credentials and choose a model available through that provider." },
        { question: "Can an AI coding agent run terminal commands?", answer: "Aurict classifies commands and applies permission rules before execution. Dangerous or out-of-scope actions require direct approval; the exact behavior depends on the active permission mode." },
        { question: "Does an AI coding agent replace code review and tests?", answer: "No. Agent output still needs proportionate human review and executable verification. Aurict's proof record is intended to show what was checked and what remains unresolved, not to replace engineering judgment." },
      ],
    },
    final: { title: "Try an agent on a real, bounded task.", body: "Install the open-source CLI, choose a provider, open an existing project, and judge the result by its diff and verification evidence.", docs: "read the documentation", install: "copy install command" },
  },
  tr: {
    metadata: {
      title: "Yapay Zekâ Kodlama Ajanı — Açık Kaynak",
      description: "Aurict; proje bağlamı, uzman ajanlar, BYOK sağlayıcıları, MCP, açık onaylar ve doğrulama kanıtı sunan açık kaynak bir yapay zekâ kodlama ajanıdır.",
      keywords: ["yapay zekâ kodlama ajanı", "AI kodlama ajanı", "açık kaynak kodlama ajanı", "terminal kodlama ajanı", "ajan tabanlı kodlama", "Claude Code alternatifi", "çoklu ajan kodlama asistanı"],
    },
    breadcrumb: "Yapay Zekâ Kodlama Ajanı",
    hero: {
      eyebrow: "açık kaynak yapay zekâ kodlama ajanı", title: "Otomatik tamamlamanın ötesindeki işler için bir kodlama ajanı.",
      lede: "Aurict bir depoyu inceleyebilir, uzman ajanları koordine edebilir, tipli araçlarla proje dosyalarını düzenleyebilir, kontrolleri çalıştırabilir ve tamamlanma kanıtını saklayabilir. Model sağlayıcısını siz seçer, kontrol yüzeyi olarak terminali kullanırsınız.",
      install: "Aurict'i kur", compare: "kodlama ajanlarını karşılaştır", proof: ["9 uzman ajan", "12 yerleşik sağlayıcı", "MCP uyumlu araçlar", "macOS · Linux · Windows"],
    },
    definition: {
      title: "Yapay zekâ kodlama ajanı nedir?",
      paragraphs: [
        "Yapay zekâ kodlama ajanı, bir geliştirme isteğini kod tabanı içindeki eylemlere dönüştürebilen yazılımdır. Bir sonraki satırı önermenin ötesine geçerek dosyaları inceler, bağımlılıkları değerlendirir, geliştirme araçlarını kullanır, kapsamlı değişiklikler yapar, doğrulama çalıştırır ve sonucu açıklar.",
        "Kodlama asistanı çoğunlukla dar bir istem bekler veya satır içi öneri sunar. Ajan daha uzun bir iş akışını koordine edebilir; ancak bu özerklik sınırlara ihtiyaç duyar. Yararlı sistemler izinleri, proje kapsamını, araç etkinliğini, doğrulamayı ve bitmemiş işi geliştiriciye görünür kılar.",
        "Aurict bu yaklaşımı açık kaynak bir terminal çalışma zamanı olarak uygular. Uzman roller keşif, uygulama, inceleme, test, dokümantasyon, güvenlik, hata ayıklama, performans ve analitiği ayırırken koordineli görev bütün kanıtları birbirine bağlar.",
      ],
    },
    differences: {
      eyebrow: "ajan ve asistan", title: "Fark etikette değil, iş akışındadır.", intro: "Aracın bir görev aldıktan sonra gerçekten neler yapabildiğini değerlendirin.",
      items: [
        { title: "Depo bağlamı", body: "Ajan kodu değiştirmeden önce ilgili dosyaları, bağımlılıkları, kuralları ve riskleri eşler." },
        { title: "Araç kullanımı", body: "Arama, dosya değişiklikleri, doküman, tarayıcı kontrolü, test ve değerlendirme için açık araçlar çağırabilir." },
        { title: "Sınırlı eylem", body: "İzinler ve proje kapsamı hangi eylemlerin ilerleyebileceğini, hangilerinin doğrudan onay gerektirdiğini belirler." },
        { title: "Doğrulama", body: "Tamamlanma kaydı çalıştırılan kontrolleri varsayımlardan, muafiyetlerden ve açık kalan işlerden ayırır." },
      ],
    },
    evaluation: {
      eyebrow: "seçim kontrol listesi", title: "Yapay zekâ kodlama ajanı nasıl seçilir?", intro: "Ürünleri gerçek depolarınız ve çalışma kısıtlarınız üzerinden karşılaştırın.",
      items: [
        { title: "Sağlayıcı ve model seçimi", body: "Çalışma zamanının tercih ettiğiniz bulut veya yerel modelleri desteklediğini ve sağlayıcı kimlik bilgilerini sizin yönettiğinizi doğrulayın." },
        { title: "İzin modeli", body: "Terminal komutları, dosya değişiklikleri, dış servisler, sırlar ve yıkıcı eylemler için açık sınırlar arayın." },
        { title: "Bağlam kalitesi", body: "Ajanın mimariyi, kurulu bağımlılıkları, proje talimatlarını ve ilgili kaynakları modele gereksiz yük bindirmeden nasıl bulduğunu inceleyin." },
        { title: "Tamamlanma kanıtı", body: "Değişen dosyaların, gerçekten çalıştırılan kontrollerin, hataların, atlanan işlerin ve çözülmemiş risklerin raporlanmasını isteyin." },
        { title: "Genişletilebilirlik", body: "MCP desteğini, özel araçları, tekrar kullanılabilir yetenekleri ve entegrasyonların denetlenebilirliğini değerlendirin." },
        { title: "İş akışı uyumu", body: "Terminal, IDE, uzak sunucu, işletim sistemi, gecikme ve maliyet dengelerini temsili bir görevle test edin." },
      ],
    },
    workflows: {
      eyebrow: "kodlama ajanı kullanım alanları", title: "Mühendislik döngüsü boyunca aynı çalışma zamanını kullanın.", intro: "Tek ve sınırlı bir görevle başlayın; ajan proje kısıtlarını koruduğunu kanıtladıkça kapsamı genişletin.",
      items: [
        { title: "Depo keşfi", body: "Mimariyi, bağımlılıkları, sahipliği ve önerilen değişiklikle ilgili dosyaları eşleyin.", href: "/terminal-agent" },
        { title: "Yeniden düzenleme", body: "Çok dosyalı değişiklikleri planlayın, açık sözleşmeleri koruyun ve etkilenen davranışı doğrulayın.", href: "/use-cases/refactoring" },
        { title: "Kod incelemesi", body: "Diff'i doğruluk, güvenlik, performans, bakım kolaylığı ve eksik testler açısından inceleyin.", href: "/use-cases/code-review" },
        { title: "Test ve dokümantasyon", body: "Anlamlı kapsam ekleyin ve dokümanları gerçekten değişen kod yollarından güncelleyin.", href: "/use-cases/testing" },
      ],
    },
    alternatives: {
      eyebrow: "alternatifler", title: "Yapay zekâ kodlama ajanlarını belgelenmiş ölçütlerle karşılaştırın.", body: "Aurict terminal ajanları ve yapay zekâ geliştirme ortamlarıyla örtüşür; ancak her ürün farklı dengeler kurar. Seçmeden önce resmî kaynakları okuyun ve aynı görevi test edin.",
      links: [
        { label: "Claude Code alternatifi", href: "/compare/claude-code" }, { label: "Cursor alternatifi", href: "/compare/cursor" },
        { label: "Aider alternatifi", href: "/compare/aider" }, { label: "GitHub Copilot CLI alternatifi", href: "/compare/github-copilot" },
        { label: "OpenCode alternatifi", href: "/compare/opencode" },
      ],
    },
    faq: {
      eyebrow: "kodlama ajanı SSS", title: "Geliştiricilerin bir ajanı kullanmadan önce sorduğu sorular.",
      items: [
        { question: "Aurict bir yapay zekâ kodlama ajanı mı, otomatik tamamlama aracı mı?", answer: "Aurict terminal tabanlı bir ajan çalışma zamanıdır. Yalnızca satır içi kod tahmin etmek yerine projeleri incelemek, araçları ve uzman rolleri koordine etmek, kapsamlı değişiklikler yapmak, doğrulama çalıştırmak ve kanıt raporlamak için tasarlanmıştır." },
        { question: "Aurict bir Claude Code alternatifi mi?", answer: "Terminal kodlama iş akışlarını karşılaştıran geliştiriciler için evet. Aurict sağlayıcı seçimine, uzman ajanlara, sınırlı Project Auto'ya ve kalıcı tamamlanma kanıtına odaklanır; Claude Code Anthropic'in resmî kodlama iş akışını sunar. İkisini aynı depo göreviyle karşılaştırın." },
        { question: "Yapay zekâ model sağlayıcısını seçebilir miyim?", answer: "Evet. Aurict desteklenen bulut ve yerel sağlayıcılar için adaptörler içerir. İlgili sağlayıcı kimlik bilgilerini siz sağlarsınız ve o sağlayıcıdaki bir modeli seçersiniz." },
        { question: "Kodlama ajanı terminal komutlarını çalıştırabilir mi?", answer: "Aurict komutları sınıflandırır ve çalıştırmadan önce izin kurallarını uygular. Tehlikeli veya kapsam dışı eylemler doğrudan onay gerektirir; tam davranış etkin izin moduna bağlıdır." },
        { question: "Yapay zekâ kodlama ajanı kod incelemesinin ve testlerin yerini alır mı?", answer: "Hayır. Ajan çıktısı yine uygun insan incelemesi ve çalıştırılabilir doğrulama gerektirir. Aurict'in kanıt kaydı neyin kontrol edildiğini ve neyin çözülmeden kaldığını gösterir; mühendislik kararının yerini almaz." },
      ],
    },
    final: { title: "Bir ajanı gerçek ve sınırlı bir görevde deneyin.", body: "Açık kaynak CLI'ı kurun, sağlayıcı seçin, mevcut bir projeyi açın ve sonucu diff ile doğrulama kanıtına göre değerlendirin.", docs: "dokümantasyonu oku", install: "kurulum komutunu kopyala" },
  },
} satisfies Record<"en" | "tr", AiCodingAgentCopy>

export function localizeAiCodingAgent(locale: AppLocale): AiCodingAgentCopy {
  return content[locale === "tr" ? "tr" : "en"]
}
