import 'dart:math' as math;

class MobileCalculatorTool {
  const MobileCalculatorTool();

  Map<String, Object?> calculate(String expression) {
    final parser = _ExpressionParser(expression);
    final value = parser.parse();
    return {
      'expression': expression,
      'result': value,
      'formatted': _formatNumber(value),
    };
  }

  static String _formatNumber(num value) {
    final asDouble = value.toDouble();
    if (asDouble.isFinite && (asDouble - asDouble.round()).abs() < 0.0000001) {
      return asDouble.round().toString();
    }
    return asDouble
        .toStringAsFixed(6)
        .replaceFirst(RegExp(r'0+$'), '')
        .replaceFirst(RegExp(r'\.$'), '');
  }
}

class MobileTableTool {
  const MobileTableTool();

  Map<String, Object?> buildMarkdownTable({
    required List<String> columns,
    required List<List<String>> rows,
  }) {
    final safeColumns = columns.isEmpty ? ['Item', 'Value'] : columns;
    final safeRows = rows
        .map(
          (row) => [
            for (var i = 0; i < safeColumns.length; i++)
              i < row.length ? _cell(row[i]) : '',
          ],
        )
        .toList(growable: false);
    final markdown = [
      '| ${safeColumns.map(_cell).join(' | ')} |',
      '| ${safeColumns.map((_) => '---').join(' | ')} |',
      for (final row in safeRows) '| ${row.join(' | ')} |',
    ].join('\n');
    return {
      'columns': safeColumns,
      'rowCount': safeRows.length,
      'markdown': markdown,
    };
  }

  static String _cell(String value) {
    return value.replaceAll('|', r'\|').replaceAll(RegExp(r'\s+'), ' ').trim();
  }
}

class MobileCitationManagerTool {
  const MobileCitationManagerTool();

  Map<String, Object?> format({
    required String style,
    required List<Map<String, Object?>> sources,
  }) {
    final normalizedStyle = style.trim().isEmpty ? 'apa' : style.toLowerCase();
    final citations = <String>[];
    final missingFields = <Map<String, Object?>>[];
    for (var i = 0; i < sources.length; i++) {
      final source = sources[i];
      final author = source['author']?.toString() ?? '';
      final title = source['title']?.toString() ?? '';
      final year = source['year']?.toString() ?? '';
      final url = source['url']?.toString() ?? '';
      final missing = <String>[
        if (author.isEmpty) 'author',
        if (title.isEmpty) 'title',
        if (year.isEmpty) 'year',
        if (url.isEmpty) 'url',
      ];
      if (missing.isNotEmpty) {
        missingFields.add({'index': i, 'missing': missing});
      }
      citations.add(_formatOne(normalizedStyle, author, year, title, url));
    }
    return {
      'style': normalizedStyle,
      'citations': citations,
      'missingFields': missingFields,
    };
  }

  String _formatOne(
    String style,
    String author,
    String year,
    String title,
    String url,
  ) {
    final safeAuthor = author.isEmpty ? 'Unknown author' : author;
    final safeYear = year.isEmpty ? 'n.d.' : year;
    final safeTitle = title.isEmpty ? 'Untitled source' : title;
    final safeUrl = url.isEmpty ? 'URL unavailable' : url;
    return switch (style) {
      'mla' => '$safeAuthor. "$safeTitle." $safeUrl. Accessed $safeYear.',
      'chicago' => '$safeAuthor. "$safeTitle." Accessed $safeYear. $safeUrl.',
      'harvard' =>
        '$safeAuthor $safeYear, $safeTitle, viewed $safeYear, <$safeUrl>.',
      _ => '$safeAuthor. ($safeYear). $safeTitle. $safeUrl',
    };
  }
}

class _ExpressionParser {
  _ExpressionParser(String source)
    : source = source.replaceAll(RegExp(r'\s+'), ''),
      index = 0;

  final String source;
  int index;

  double parse() {
    final value = _parseExpression();
    if (index != source.length) {
      throw FormatException('Unexpected token at position $index.');
    }
    return value;
  }

  double _parseExpression() {
    var value = _parseTerm();
    while (_match('+') || _match('-')) {
      final op = source[index - 1];
      final rhs = _parseTerm();
      value = op == '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  double _parseTerm() {
    var value = _parsePower();
    while (_match('*') || _match('/') || _match('%')) {
      final op = source[index - 1];
      final rhs = _parsePower();
      value = switch (op) {
        '*' => value * rhs,
        '/' => value / rhs,
        _ => value % rhs,
      };
    }
    return value;
  }

  double _parsePower() {
    var value = _parseFactor();
    while (_match('^')) {
      value = math.pow(value, _parseFactor()).toDouble();
    }
    return value;
  }

  double _parseFactor() {
    if (_match('+')) return _parseFactor();
    if (_match('-')) return -_parseFactor();
    if (_match('(')) {
      final value = _parseExpression();
      if (!_match(')')) {
        throw const FormatException('Missing closing parenthesis.');
      }
      return value;
    }
    final start = index;
    while (index < source.length && RegExp(r'[0-9.]').hasMatch(source[index])) {
      index++;
    }
    if (start == index) {
      throw FormatException('Expected number at position $index.');
    }
    return double.parse(source.substring(start, index));
  }

  bool _match(String token) {
    if (index >= source.length || source[index] != token) return false;
    index++;
    return true;
  }
}
