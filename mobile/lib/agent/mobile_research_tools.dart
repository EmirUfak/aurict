import 'dart:convert';
import 'dart:io';

enum MobileSearchProviderKind {
  wikimedia,
  arxiv,
  crossref,
  openAlex,
  pubMed,
  exactUrl,
  htmlFallback,
}

class MobileSearchProvider {
  const MobileSearchProvider({
    required this.kind,
    required this.name,
    required this.endpoint,
    required this.requiresApiKey,
    required this.isFree,
    required this.notes,
  });

  final MobileSearchProviderKind kind;
  final String name;
  final Uri endpoint;
  final bool requiresApiKey;
  final bool isFree;
  final String notes;
}

class MobileResearchPlan {
  const MobileResearchPlan({
    required this.query,
    required this.providers,
    required this.exactUrls,
    required this.requiresNetwork,
  });

  final String query;
  final List<MobileSearchProvider> providers;
  final List<Uri> exactUrls;
  final bool requiresNetwork;

  String get providerSummary =>
      providers.map((provider) => provider.name).join(', ');
}

class MobileSearchRequest {
  const MobileSearchRequest({
    required this.provider,
    required this.uri,
    required this.method,
  });

  final MobileSearchProvider provider;
  final Uri uri;
  final String method;
}

class MobileSearchRequestBuilder {
  const MobileSearchRequestBuilder();

  List<MobileSearchRequest> build(MobileResearchPlan plan) {
    return plan.providers
        .where((provider) => provider.kind != MobileSearchProviderKind.exactUrl)
        .map((provider) {
          final uri = switch (provider.kind) {
            MobileSearchProviderKind.wikimedia => provider.endpoint.replace(
              queryParameters: {'q': plan.query, 'limit': '8'},
            ),
            MobileSearchProviderKind.arxiv => provider.endpoint.replace(
              queryParameters: {
                'search_query': 'all:${plan.query}',
                'start': '0',
                'max_results': '8',
              },
            ),
            MobileSearchProviderKind.crossref => provider.endpoint.replace(
              queryParameters: {'query': plan.query, 'rows': '8'},
            ),
            MobileSearchProviderKind.openAlex => provider.endpoint.replace(
              queryParameters: {'search': plan.query, 'per-page': '8'},
            ),
            MobileSearchProviderKind.pubMed => provider.endpoint.replace(
              queryParameters: {
                'db': 'pubmed',
                'term': plan.query,
                'retmode': 'json',
                'retmax': '8',
              },
            ),
            MobileSearchProviderKind.htmlFallback => provider.endpoint.replace(
              queryParameters: {'q': plan.query},
            ),
            MobileSearchProviderKind.exactUrl => provider.endpoint,
          };
          return MobileSearchRequest(
            provider: provider,
            uri: uri,
            method: 'GET',
          );
        })
        .toList(growable: false);
  }
}

class MobileSourceRecord {
  const MobileSourceRecord({
    required this.url,
    required this.title,
    required this.text,
    required this.sourceType,
    this.statusCode,
    this.fetchedAt,
  });

  final Uri url;
  final String title;
  final String text;
  final String sourceType;
  final int? statusCode;
  final DateTime? fetchedAt;
}

class MobileSearchHit {
  const MobileSearchHit({
    required this.title,
    required this.url,
    required this.snippet,
    required this.provider,
  });

  final String title;
  final Uri url;
  final String snippet;
  final String provider;

  Map<String, Object?> toJson() => {
    'title': title,
    'url': url.toString(),
    'snippet': snippet,
    'provider': provider,
  };
}

class MobileWebSearchResult {
  const MobileWebSearchResult({
    required this.query,
    required this.hits,
    required this.providers,
    required this.limitations,
  });

  final String query;
  final List<MobileSearchHit> hits;
  final List<String> providers;
  final List<String> limitations;

  Map<String, Object?> toJson() => {
    'query': query,
    'hits': hits.map((hit) => hit.toJson()).toList(growable: false),
    'providers': providers,
    'limitations': limitations,
  };
}

class MobileResearchPlanner {
  const MobileResearchPlanner();

  static final _urlPattern = RegExp(
    r'https?://[^\s)>\]]+',
    caseSensitive: false,
  );

  static final freeProviders = <MobileSearchProvider>[
    MobileSearchProvider(
      kind: MobileSearchProviderKind.wikimedia,
      name: 'Wikimedia',
      endpoint: Uri.https(
        'api.wikimedia.org',
        '/core/v1/wikipedia/en/search/page',
      ),
      requiresApiKey: false,
      isFree: true,
      notes: 'Open knowledge search for encyclopedic/background sources.',
    ),
    MobileSearchProvider(
      kind: MobileSearchProviderKind.arxiv,
      name: 'arXiv',
      endpoint: Uri.https('export.arxiv.org', '/api/query'),
      requiresApiKey: false,
      isFree: true,
      notes: 'Academic preprints for technical and scientific research.',
    ),
    MobileSearchProvider(
      kind: MobileSearchProviderKind.crossref,
      name: 'Crossref',
      endpoint: Uri.https('api.crossref.org', '/works'),
      requiresApiKey: false,
      isFree: true,
      notes: 'DOI and scholarly metadata; should use polite rate limits.',
    ),
    MobileSearchProvider(
      kind: MobileSearchProviderKind.openAlex,
      name: 'OpenAlex',
      endpoint: Uri.https('api.openalex.org', '/works'),
      requiresApiKey: false,
      isFree: true,
      notes: 'Open scholarly index with metadata and source URLs.',
    ),
    MobileSearchProvider(
      kind: MobileSearchProviderKind.pubMed,
      name: 'PubMed',
      endpoint: Uri.https(
        'eutils.ncbi.nlm.nih.gov',
        '/entrez/eutils/esearch.fcgi',
      ),
      requiresApiKey: false,
      isFree: true,
      notes:
          'Biomedical literature identifiers; best for health/science topics.',
    ),
  ];

  MobileResearchPlan plan(String input) {
    final exactUrls = _urlPattern
        .allMatches(input)
        .map((match) => Uri.tryParse(match.group(0)!))
        .whereType<Uri>()
        .toList(growable: false);
    final providers = <MobileSearchProvider>[
      if (exactUrls.isNotEmpty)
        MobileSearchProvider(
          kind: MobileSearchProviderKind.exactUrl,
          name: 'Exact URL fetch',
          endpoint: Uri(scheme: 'https', host: 'user-provided-url'),
          requiresApiKey: false,
          isFree: true,
          notes: 'Fetches user-provided URLs directly from the device.',
        ),
      ...freeProviders,
      MobileSearchProvider(
        kind: MobileSearchProviderKind.htmlFallback,
        name: 'HTML fallback',
        endpoint: Uri.https('html.duckduckgo.com', '/html/'),
        requiresApiKey: false,
        isFree: true,
        notes: 'Best-effort fallback; not guaranteed stable and never primary.',
      ),
    ];

    return MobileResearchPlan(
      query: input.trim(),
      providers: providers,
      exactUrls: exactUrls,
      requiresNetwork: true,
    );
  }
}

class MobileWebSearchTool {
  const MobileWebSearchTool({
    this.planner = const MobileResearchPlanner(),
    this.requestBuilder = const MobileSearchRequestBuilder(),
  });

  final MobileResearchPlanner planner;
  final MobileSearchRequestBuilder requestBuilder;

  Future<MobileWebSearchResult> search(String query) async {
    final plan = planner.plan(query);
    final requests = requestBuilder
        .build(plan)
        .where(
          (request) =>
              request.provider.kind != MobileSearchProviderKind.htmlFallback,
        )
        .take(4)
        .toList(growable: false);
    final hits = <MobileSearchHit>[];
    final limitations = <String>[];
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 12)
      ..userAgent = 'AurictMobile/1.0 public-search';
    try {
      final results = await Future.wait(
        requests.map((request) => _searchProvider(client, request)),
      );
      for (final result in results) {
        hits.addAll(result.hits);
        if (result.error != null) limitations.add(result.error!);
      }
    } finally {
      client.close(force: true);
    }
    return MobileWebSearchResult(
      query: query,
      hits: _dedupeHits(hits).take(12).toList(growable: false),
      providers: [for (final request in requests) request.provider.name],
      limitations: limitations,
    );
  }

  Future<_ProviderSearchResult> _searchProvider(
    HttpClient client,
    MobileSearchRequest request,
  ) async {
    try {
      final httpRequest = await client.getUrl(request.uri);
      httpRequest.headers.set(HttpHeaders.acceptHeader, 'application/json,*/*');
      final response = await httpRequest.close().timeout(
        const Duration(seconds: 16),
      );
      final limited = await response
          .take(128)
          .expand((chunk) => chunk)
          .take(384 * 1024)
          .toList()
          .timeout(const Duration(seconds: 16));
      final body = utf8.decode(limited, allowMalformed: true);
      return _ProviderSearchResult(
        hits: parseProviderBody(
          request.provider,
          body,
        ).take(6).toList(growable: false),
      );
    } catch (error) {
      return _ProviderSearchResult(
        hits: const [],
        error: '${request.provider.name}: ${error.toString()}',
      );
    }
  }

  List<MobileSearchHit> parseProviderBody(
    MobileSearchProvider provider,
    String body,
  ) {
    return switch (provider.kind) {
      MobileSearchProviderKind.wikimedia => _parseWikimedia(provider, body),
      MobileSearchProviderKind.crossref => _parseCrossref(provider, body),
      MobileSearchProviderKind.openAlex => _parseOpenAlex(provider, body),
      MobileSearchProviderKind.arxiv => _parseArxiv(provider, body),
      MobileSearchProviderKind.pubMed => _parsePubMed(provider, body),
      MobileSearchProviderKind.exactUrl ||
      MobileSearchProviderKind.htmlFallback => const <MobileSearchHit>[],
    };
  }

  List<MobileSearchHit> _parseWikimedia(
    MobileSearchProvider provider,
    String body,
  ) {
    final decoded = jsonDecode(body);
    if (decoded is! Map<String, Object?>) return const [];
    final pages = decoded['pages'];
    if (pages is! List) return const [];
    return pages
        .whereType<Map<String, Object?>>()
        .map((page) {
          final title = page['title']?.toString() ?? 'Wikimedia result';
          final key = page['key']?.toString() ?? title.replaceAll(' ', '_');
          final description = page['description']?.toString() ?? '';
          final excerpt = page['excerpt']?.toString() ?? '';
          return MobileSearchHit(
            title: title,
            url: Uri.https('en.wikipedia.org', '/wiki/$key'),
            snippet: _cleanSnippet('$description $excerpt'),
            provider: provider.name,
          );
        })
        .toList(growable: false);
  }

  List<MobileSearchHit> _parseCrossref(
    MobileSearchProvider provider,
    String body,
  ) {
    final decoded = jsonDecode(body);
    if (decoded is! Map<String, Object?>) return const [];
    final message = decoded['message'];
    if (message is! Map<String, Object?>) return const [];
    final items = message['items'];
    if (items is! List) return const [];
    return items
        .whereType<Map<String, Object?>>()
        .map((item) {
          final titles = item['title'];
          final title = titles is List && titles.isNotEmpty
              ? titles.first.toString()
              : 'Crossref result';
          final url =
              Uri.tryParse(item['URL']?.toString() ?? '') ??
              Uri.https('doi.org', '/${item['DOI'] ?? ''}');
          final publisher = item['publisher']?.toString() ?? '';
          return MobileSearchHit(
            title: title,
            url: url,
            snippet: _cleanSnippet(publisher),
            provider: provider.name,
          );
        })
        .toList(growable: false);
  }

  List<MobileSearchHit> _parseOpenAlex(
    MobileSearchProvider provider,
    String body,
  ) {
    final decoded = jsonDecode(body);
    if (decoded is! Map<String, Object?>) return const [];
    final results = decoded['results'];
    if (results is! List) return const [];
    return results
        .whereType<Map<String, Object?>>()
        .map((item) {
          final title = item['display_name']?.toString() ?? 'OpenAlex result';
          final url =
              Uri.tryParse(item['doi']?.toString() ?? '') ??
              Uri.tryParse(item['id']?.toString() ?? '') ??
              Uri.https('openalex.org');
          final year = item['publication_year']?.toString() ?? '';
          return MobileSearchHit(
            title: title,
            url: url,
            snippet: _cleanSnippet(
              year.isEmpty ? 'Open scholarly metadata.' : 'Published $year.',
            ),
            provider: provider.name,
          );
        })
        .toList(growable: false);
  }

  List<MobileSearchHit> _parseArxiv(
    MobileSearchProvider provider,
    String body,
  ) {
    final entries = RegExp(
      r'<entry>([\s\S]*?)</entry>',
      caseSensitive: false,
    ).allMatches(body);
    return entries
        .map((match) {
          final entry = match.group(1) ?? '';
          final title = _xmlTag(entry, 'title') ?? 'arXiv result';
          final summary = _xmlTag(entry, 'summary') ?? '';
          final id = _xmlTag(entry, 'id') ?? 'https://arxiv.org';
          return MobileSearchHit(
            title: _cleanSnippet(title),
            url: Uri.tryParse(id) ?? Uri.https('arxiv.org'),
            snippet: _cleanSnippet(summary),
            provider: provider.name,
          );
        })
        .toList(growable: false);
  }

  List<MobileSearchHit> _parsePubMed(
    MobileSearchProvider provider,
    String body,
  ) {
    final decoded = jsonDecode(body);
    if (decoded is! Map<String, Object?>) return const [];
    final result = decoded['esearchresult'];
    if (result is! Map<String, Object?>) return const [];
    final ids = result['idlist'];
    if (ids is! List) return const [];
    return ids
        .take(8)
        .map((id) {
          final pmid = id.toString();
          return MobileSearchHit(
            title: 'PubMed PMID $pmid',
            url: Uri.https('pubmed.ncbi.nlm.nih.gov', '/$pmid/'),
            snippet:
                'PubMed identifier result. Fetch the page for title/abstract details.',
            provider: provider.name,
          );
        })
        .toList(growable: false);
  }

  List<MobileSearchHit> _dedupeHits(List<MobileSearchHit> hits) {
    final seen = <String>{};
    final deduped = <MobileSearchHit>[];
    for (final hit in hits) {
      final key = hit.url.toString().toLowerCase();
      if (seen.add(key)) deduped.add(hit);
    }
    return deduped;
  }

  static String? _xmlTag(String xml, String tag) {
    final match = RegExp(
      '<$tag[^>]*>([\\s\\S]*?)</$tag>',
      caseSensitive: false,
    ).firstMatch(xml);
    if (match == null) return null;
    return _cleanSnippet(match.group(1) ?? '');
  }

  static String _cleanSnippet(String value) {
    final text = value
        .replaceAll(RegExp(r'<[^>]+>'), ' ')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    return text.length <= 320 ? text : '${text.substring(0, 317)}...';
  }
}

class _ProviderSearchResult {
  const _ProviderSearchResult({required this.hits, this.error});

  final List<MobileSearchHit> hits;
  final String? error;
}

class MobileWebFetchTool {
  const MobileWebFetchTool();

  Future<MobileSourceRecord> fetch(Uri url) async {
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 12)
      ..userAgent = 'AurictMobile/1.0 local-research';
    try {
      final request = await client.getUrl(url);
      final response = await request.close();
      final body = await response.transform(utf8.decoder).join();
      return MobileSourceRecord(
        url: url,
        title: extractTitle(body) ?? url.host,
        text: extractReadableText(body),
        sourceType: 'webfetch',
        statusCode: response.statusCode,
        fetchedAt: DateTime.now(),
      );
    } finally {
      client.close(force: true);
    }
  }

  static String? extractTitle(String html) {
    final match = RegExp(
      r'<title[^>]*>(.*?)</title>',
      caseSensitive: false,
      dotAll: true,
    ).firstMatch(html);
    if (match == null) return null;
    return _cleanText(match.group(1) ?? '');
  }

  static String extractReadableText(String html) {
    final withoutScripts = html
        .replaceAll(
          RegExp(
            r'<script[^>]*>.*?</script>',
            caseSensitive: false,
            dotAll: true,
          ),
          ' ',
        )
        .replaceAll(
          RegExp(
            r'<style[^>]*>.*?</style>',
            caseSensitive: false,
            dotAll: true,
          ),
          ' ',
        );
    final text = withoutScripts
        .replaceAll(RegExp(r'<[^>]+>'), ' ')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>');
    return _cleanText(text);
  }

  static String _cleanText(String value) {
    return value.replaceAll(RegExp(r'\s+'), ' ').trim();
  }
}
