import type { Pair, Quad, Triple } from "@/content/landing-translations"

type ExtraLocale = "de" | "fr" | "es"

type LandingContent = {
  why: Triple[]
  capabilities: Triple[]
  security: Quad[]
  install: Quad[]
  mobile: Pair[]
  faqs: Pair[]
}

export const LANDING_CONTENT_EXTRA: Record<ExtraLocale, LandingContent> = {
  de: {
    why: [
      ["01", "Agenten statt nur Prompts.", "Aufgaben werden an Spezialisten für Analyse, Code, Review, Tests, Dokumentation, Sicherheit, Debugging, Performance und Analytics verteilt. Komplexe Arbeit kann parallel laufen."],
      ["02", "Liest die Codebasis vor dem Prompt.", "Aurict untersucht beim Start den Verzeichnisbaum, erkennt Framework und Paketmanager und priorisiert relevante Dateien — ohne manuell angehängten Kontext."],
      ["03", "Native und plattformübergreifend.", "Ein Installationsbefehl liefert eine kompilierte Binärdatei für macOS, Linux und Windows. Zur Laufzeit ist kein Node.js erforderlich."],
      ["04", "Offen und erweiterbar.", "Binden Sie kompatible MCP-Server, eigene Befehle und Team-Skills ein. Verbindungen und Werkzeuge bleiben im Terminal sichtbar."],
    ],
    capabilities: [
      ["Bash-Klassifikator", "Shell-Befehle werden vor der Ausführung geprüft. Riskante Befehle warten auf eine Bestätigung.", "oklch(0.65 0.19 25)"],
      ["Sandbox-Ausführung", "Richtlinien steuern Freigaben, geschützte Pfade, bereinigte Umgebungen, Zeitlimits und Auditdaten.", "oklch(0.65 0.19 25)"],
      ["Multi-Agent-Orchestrierung", "Neun Spezialisten arbeiten isoliert an Analyse, Code, Review, Tests, Dokumentation und weiteren Aufgaben.", "var(--accent)"],
      ["218+ Kontext-Skills", "Framework- und werkzeugspezifischer Kontext wird passend zum erkannten Stack geladen.", "oklch(0.72 0.15 145)"],
      ["MCP-Client", "Importieren Sie kompatible Konfigurationen und prüfen Sie verbundene Server samt Werkzeugen.", "oklch(0.72 0.15 145)"],
      ["Nativ unter Windows", "Kompilierte x64-Binärdatei ohne WSL; die Shell wird automatisch erkannt.", "oklch(0.78 0.15 80)"],
      ["Dauerhafter Speicher", "Projektentscheidungen und Konventionen werden lokal gespeichert und sitzungsbezogen abgerufen.", "var(--accent)"],
      ["Design-Agent", "Mehr als 150 Designsysteme und 111 Skill-Vorlagen unterstützen konkrete UI-Briefings.", "var(--accent)"],
      ["Belegte Fertigstellung", "Geänderte Dateien, Prüfnachweise und offene Arbeit bleiben in einem dauerhaften Nachweis sichtbar.", "oklch(0.72 0.15 145)"],
      ["Workspace-Intelligenz", "Semantische Suche, Paketdokumentation, Bildanalyse und Browser- oder Eval-Prüfungen unterstützen die Arbeit.", "#818cf8"],
    ],
    security: [
      ["sicher · standard", "Passiv", "Defensive Prüfung und Berichte. Dem Modell werden keine offensiven Werkzeuge angeboten.", "oklch(0.72 0.15 145)"],
      ["warnung · optional", "Active Lite", "Kontrollierte Docker-Scans gegen ausdrücklich freigegebene Ziele.", "oklch(0.78 0.15 80)"],
      ["risiko · explizit", "Kali Full", "Größeres experimentelles Image für bewusste Einsätze; jede Nutzung benötigt eine Freigabe.", "oklch(0.65 0.19 25)"],
    ],
    install: [
      ["01 · installieren", "$ npm install -g aurict", "macOS, Linux oder Windows — überall derselbe Befehl.", "var(--accent)"],
      ["02 · starten", "$ aurict", "In einem beliebigen Projektverzeichnis starten.", "var(--accent)"],
      ["03 · konfigurieren", "# Anbieter, Schlüssel, Modell, Project Auto", "Interaktive Einrichtung mit klar begrenzten Projektfreigaben.", "var(--accent)"],
      ["04 · sicherheit", "$ aurict /config security active-lite", "Optional; Ziele müssen weiterhin ausdrücklich erlaubt werden.", "oklch(0.78 0.15 80)"],
    ],
    mobile: [
      ["BYOK-Chat", "Nutzen Sie eigene Schlüssel für OpenAI, Anthropic, Google, OpenRouter, xAI, Azure, Bedrock oder lokale Modelle."],
      ["Recherchemodus", "Fordern Sie Marktanalysen, technische Vergleiche, Repository-Recherche oder Quellenzusammenfassungen an."],
      ["Dokumentausgabe", "Erstellen Sie aus Gesprächen PDFs, Spezifikationen, Berichte, Checklisten oder Release Notes."],
      ["Terminal-Begleiter", "Verwenden Sie dasselbe Konto für Browser-Login, mobile Freigaben und die Steuerung laufender CLI-Sitzungen."],
    ],
    faqs: [
      ["Ist Aurict kostenlos?", "Ja. Aurict ist unter AGPLv3 als Open Source verfügbar. Sie verwenden den API-Schlüssel Ihres gewählten Modellanbieters."],
      ["Was unterscheidet Aurict von einem einzelnen Chat-Agenten?", "Aurict verteilt Arbeit auf neun Fachagenten und unterstützt mehrere Modellanbieter innerhalb desselben Ablaufs."],
      ["Läuft Aurict nativ unter Windows?", "Ja. Es gibt eine kompilierte Windows-x64-Binärdatei ohne WSL-Pflicht."],
      ["Was bietet die mobile App?", "Sie verbindet BYOK-Chat, Recherche, PDF- und Berichtserstellung mit mobilen Freigaben für die CLI."],
      ["Brauche ich Node.js?", "Nur npm wird optional zur Installation verwendet. Aurict selbst läuft als eigenständige kompilierte Binärdatei."],
      ["Kann ich vorhandene MCP-Server nutzen?", "Kompatible MCP-Konfigurationen können importiert und ihre Verbindungen und Werkzeuge mit /mcp geprüft werden."],
    ],
  },
  fr: {
    why: [
      ["01", "Des agents avant les prompts.", "Chaque tâche est confiée à un spécialiste : exploration, code, revue, tests, documentation, sécurité, débogage, performance ou analyse. Les travaux complexes peuvent avancer en parallèle."],
      ["02", "Lit votre code avant votre demande.", "Au démarrage, Aurict parcourt le projet, détecte le framework et le gestionnaire de paquets, puis classe les fichiers pertinents sans ajout manuel de contexte."],
      ["03", "Natif et multiplateforme.", "Une commande installe un binaire compilé pour macOS, Linux ou Windows. Node.js n’est pas requis à l’exécution."],
      ["04", "Ouvert et extensible.", "Ajoutez des serveurs MCP compatibles, vos commandes et les compétences de l’équipe. Les connexions restent visibles dans le terminal."],
    ],
    capabilities: [
      ["classificateur bash", "Chaque commande shell est analysée avant exécution ; les opérations risquées attendent une approbation.", "oklch(0.65 0.19 25)"],
      ["exécution sandbox", "Les politiques gèrent approbations, chemins protégés, environnement nettoyé, délais et audit.", "oklch(0.65 0.19 25)"],
      ["orchestration multi-agent", "Neuf spécialistes isolés prennent en charge exploration, code, revue, tests, documentation et plus encore.", "var(--accent)"],
      ["218+ compétences contextuelles", "Le contexte propre au framework et aux outils est chargé dès que votre stack est détectée.", "oklch(0.72 0.15 145)"],
      ["client MCP", "Importez une configuration compatible, puis inspectez chaque serveur connecté et ses outils.", "oklch(0.72 0.15 145)"],
      ["Windows natif", "Un véritable binaire x64 compilé, sans WSL, avec détection automatique du shell.", "oklch(0.78 0.15 80)"],
      ["mémoire persistante", "Les décisions et conventions du projet sont stockées localement et rappelées par session.", "var(--accent)"],
      ["agent de design", "Plus de 150 systèmes de design et 111 modèles de compétences produisent des briefs UI précis.", "var(--accent)"],
      ["résultat vérifié", "Fichiers modifiés, preuves de vérification et travaux ouverts restent visibles dans une preuve durable.", "oklch(0.72 0.15 145)"],
      ["intelligence du workspace", "Recherche sémantique, documentation des dépendances, lecture d’images et validation navigateur ou eval.", "#818cf8"],
    ],
    security: [
      ["sûr · défaut", "Passif", "Revue défensive et rapports uniquement. Aucun outil offensif n’est exposé au modèle.", "oklch(0.72 0.15 145)"],
      ["attention · option", "Active Lite", "Scans Docker contrôlés sur une cible explicitement autorisée.", "oklch(0.78 0.15 80)"],
      ["danger · explicite", "Kali Full", "Image expérimentale plus complète, avec approbation obligatoire à chaque utilisation.", "oklch(0.65 0.19 25)"],
    ],
    install: [
      ["01 · installer", "$ npm install -g aurict", "macOS, Linux ou Windows — la même commande partout.", "var(--accent)"],
      ["02 · lancer", "$ aurict", "Démarrez dans n’importe quel dossier de projet.", "var(--accent)"],
      ["03 · configurer", "# fournisseur, clé, modèle, Project Auto", "Configuration interactive avec autorisations de projet limitées.", "var(--accent)"],
      ["04 · sécurité", "$ aurict /config security active-lite", "Facultatif ; chaque cible doit toujours être autorisée.", "oklch(0.78 0.15 80)"],
    ],
    mobile: [
      ["chat BYOK", "Utilisez vos clés OpenAI, Anthropic, Google, OpenRouter, xAI, Azure, Bedrock ou de modèles locaux."],
      ["mode recherche", "Demandez une étude de marché, une comparaison technique, une analyse de dépôt ou une synthèse sourcée."],
      ["création de documents", "Transformez les conversations en PDF, spécifications, rapports, checklists ou notes de version."],
      ["compagnon du terminal", "Gardez le même compte pour la connexion web, les approbations mobiles et le contrôle des sessions CLI."],
    ],
    faqs: [
      ["Aurict est-il gratuit ?", "Oui. Aurict est open source sous licence AGPLv3. Vous utilisez la clé API du fournisseur de modèle choisi."],
      ["Quelle différence avec un agent de chat unique ?", "Aurict répartit le travail entre neuf agents spécialisés et permet de changer de fournisseur sans changer de workflow."],
      ["Aurict fonctionne-t-il nativement sous Windows ?", "Oui. Un binaire Windows x64 compilé est fourni sans nécessiter WSL."],
      ["Que fait l’application mobile ?", "Elle réunit chat BYOK, recherche, PDF, rapports et approbations mobiles pour la CLI."],
      ["Node.js est-il nécessaire ?", "npm peut servir à l’installation, mais Aurict s’exécute ensuite comme un binaire autonome."],
      ["Puis-je utiliser mes serveurs MCP ?", "Les configurations MCP compatibles peuvent être importées, puis leurs connexions et outils contrôlés avec /mcp."],
    ],
  },
  es: {
    why: [
      ["01", "Agentes antes que prompts.", "Cada tarea se dirige a un especialista en exploración, código, revisión, pruebas, documentación, seguridad, depuración, rendimiento o analítica. El trabajo complejo puede avanzar en paralelo."],
      ["02", "Lee tu código antes de la petición.", "Al iniciar, Aurict recorre el proyecto, detecta el framework y el gestor de paquetes y prioriza los archivos relevantes sin adjuntar contexto manualmente."],
      ["03", "Nativo y multiplataforma.", "Un comando instala un binario compilado para macOS, Linux o Windows. Node.js no es necesario durante la ejecución."],
      ["04", "Abierto y extensible.", "Añade servidores MCP compatibles, comandos propios y habilidades compartidas. Las conexiones siguen visibles en la terminal."],
    ],
    capabilities: [
      ["clasificador de bash", "Cada comando de shell se analiza antes de ejecutarse; las operaciones arriesgadas esperan aprobación.", "oklch(0.65 0.19 25)"],
      ["ejecución aislada", "Las políticas controlan aprobaciones, rutas protegidas, entorno limpio, tiempos límite y auditoría.", "oklch(0.65 0.19 25)"],
      ["orquestación multiagente", "Nueve especialistas aislados cubren exploración, código, revisión, pruebas, documentación y más.", "var(--accent)"],
      ["218+ habilidades contextuales", "El contexto de frameworks y herramientas se carga automáticamente al detectar tu stack.", "oklch(0.72 0.15 145)"],
      ["cliente MCP", "Importa configuraciones compatibles e inspecciona cada servidor conectado y sus herramientas.", "oklch(0.72 0.15 145)"],
      ["Windows nativo", "Binario x64 compilado sin WSL y con detección automática de shell.", "oklch(0.78 0.15 80)"],
      ["memoria persistente", "Las decisiones y convenciones del proyecto se almacenan localmente y se recuerdan por sesión.", "var(--accent)"],
      ["agente de diseño", "Más de 150 sistemas de diseño y 111 plantillas ayudan a crear briefs de UI concretos.", "var(--accent)"],
      ["finalización verificada", "Archivos cambiados, pruebas de verificación y trabajo pendiente permanecen visibles.", "oklch(0.72 0.15 145)"],
      ["inteligencia del proyecto", "Búsqueda semántica, documentación de dependencias, lectura de imágenes y validación con navegador o evals.", "#818cf8"],
    ],
    security: [
      ["seguro · predeterminado", "Pasivo", "Solo revisión defensiva e informes. El modelo no recibe herramientas ofensivas.", "oklch(0.72 0.15 145)"],
      ["aviso · opcional", "Active Lite", "Escaneos controlados con Docker sobre objetivos autorizados explícitamente.", "oklch(0.78 0.15 80)"],
      ["peligro · explícito", "Kali Full", "Imagen experimental ampliada, con aprobación obligatoria en cada uso.", "oklch(0.65 0.19 25)"],
    ],
    install: [
      ["01 · instalar", "$ npm install -g aurict", "macOS, Linux o Windows — el mismo comando en todos.", "var(--accent)"],
      ["02 · ejecutar", "$ aurict", "Inicia Aurict dentro de cualquier proyecto.", "var(--accent)"],
      ["03 · configurar", "# proveedor, clave, modelo, Project Auto", "Configuración interactiva con permisos de proyecto limitados.", "var(--accent)"],
      ["04 · seguridad", "$ aurict /config security active-lite", "Opcional; cada objetivo aún requiere autorización explícita.", "oklch(0.78 0.15 80)"],
    ],
    mobile: [
      ["chat BYOK", "Usa tus claves de OpenAI, Anthropic, Google, OpenRouter, xAI, Azure, Bedrock o modelos locales."],
      ["modo investigación", "Solicita análisis de mercado, comparaciones técnicas, investigación de repositorios o resúmenes con fuentes."],
      ["documentos", "Convierte conversaciones en PDF, especificaciones, informes, listas o notas de versión."],
      ["compañero de terminal", "Usa la misma cuenta para iniciar sesión, aprobar desde el móvil y controlar sesiones CLI activas."],
    ],
    faqs: [
      ["¿Aurict es gratis?", "Sí. Aurict es código abierto con licencia AGPLv3. Tú aportas la clave API del proveedor de modelos elegido."],
      ["¿En qué se diferencia de un único agente de chat?", "Aurict reparte el trabajo entre nueve agentes especialistas y permite cambiar de proveedor sin alterar el flujo."],
      ["¿Funciona de forma nativa en Windows?", "Sí. Incluye un binario compilado para Windows x64 sin necesidad de WSL."],
      ["¿Qué hace la aplicación móvil?", "Combina chat BYOK, investigación, PDF, informes y aprobaciones móviles para la CLI."],
      ["¿Necesito Node.js?", "npm puede utilizarse para instalar, pero Aurict se ejecuta como un binario compilado independiente."],
      ["¿Puedo usar mis servidores MCP?", "Puedes importar configuraciones MCP compatibles y comprobar conexiones y herramientas con /mcp."],
    ],
  },
}
