import 'package:flutter/material.dart';

import '../design/aurict_typography.dart';

enum MobileMarkdownBlockType {
  heading,
  paragraph,
  unorderedList,
  orderedList,
  quote,
  code,
  table,
  rule,
}

class MobileMarkdownBlock {
  const MobileMarkdownBlock({
    required this.type,
    this.text = '',
    this.level = 0,
    this.language = '',
    this.lines = const [],
    this.rows = const [],
  });

  final MobileMarkdownBlockType type;
  final String text;
  final int level;
  final String language;
  final List<String> lines;
  final List<List<String>> rows;
}

class MobileMarkdownParser {
  const MobileMarkdownParser();

  List<MobileMarkdownBlock> parse(String input) {
    final normalized = input.replaceAll('\r\n', '\n');
    final lines = normalized.split('\n');
    final blocks = <MobileMarkdownBlock>[];
    var i = 0;
    while (i < lines.length) {
      final line = lines[i];
      if (line.trim().isEmpty) {
        i++;
        continue;
      }

      final fence = RegExp(r'^```([A-Za-z0-9_+.-]*)\s*$').firstMatch(line);
      if (fence != null) {
        final body = <String>[];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          body.add(lines[i]);
          i++;
        }
        if (i < lines.length) i++;
        blocks.add(
          MobileMarkdownBlock(
            type: MobileMarkdownBlockType.code,
            language: fence.group(1) ?? '',
            text: body.join('\n'),
          ),
        );
        continue;
      }

      final heading = RegExp(r'^(#{1,6})\s+(.+)$').firstMatch(line);
      if (heading != null) {
        blocks.add(
          MobileMarkdownBlock(
            type: MobileMarkdownBlockType.heading,
            level: heading.group(1)!.length.clamp(1, 3),
            text: heading.group(2)!.trim(),
          ),
        );
        i++;
        continue;
      }

      if (RegExp(r'^(\*\s*){3,}$|^(-\s*){3,}$').hasMatch(line.trim())) {
        blocks.add(
          const MobileMarkdownBlock(type: MobileMarkdownBlockType.rule),
        );
        i++;
        continue;
      }

      if (_isTableStart(lines, i)) {
        final rows = <List<String>>[_parseTableRow(lines[i])];
        i += 2;
        while (i < lines.length && lines[i].contains('|')) {
          rows.add(_parseTableRow(lines[i]));
          i++;
        }
        blocks.add(
          MobileMarkdownBlock(type: MobileMarkdownBlockType.table, rows: rows),
        );
        continue;
      }

      if (line.trimLeft().startsWith('>')) {
        final quote = <String>[];
        while (i < lines.length && lines[i].trimLeft().startsWith('>')) {
          quote.add(lines[i].replaceFirst(RegExp(r'^\s*> ?'), ''));
          i++;
        }
        blocks.add(
          MobileMarkdownBlock(
            type: MobileMarkdownBlockType.quote,
            lines: quote,
          ),
        );
        continue;
      }

      if (RegExp(r'^\s*[-*]\s+').hasMatch(line)) {
        final items = <String>[];
        while (i < lines.length && RegExp(r'^\s*[-*]\s+').hasMatch(lines[i])) {
          items.add(lines[i].replaceFirst(RegExp(r'^\s*[-*]\s+'), ''));
          i++;
        }
        blocks.add(
          MobileMarkdownBlock(
            type: MobileMarkdownBlockType.unorderedList,
            lines: items,
          ),
        );
        continue;
      }

      if (RegExp(r'^\s*\d+\.\s+').hasMatch(line)) {
        final items = <String>[];
        while (i < lines.length && RegExp(r'^\s*\d+\.\s+').hasMatch(lines[i])) {
          items.add(lines[i].replaceFirst(RegExp(r'^\s*\d+\.\s+'), ''));
          i++;
        }
        blocks.add(
          MobileMarkdownBlock(
            type: MobileMarkdownBlockType.orderedList,
            lines: items,
          ),
        );
        continue;
      }

      final paragraph = <String>[];
      while (i < lines.length &&
          lines[i].trim().isNotEmpty &&
          !_startsBlock(lines, i)) {
        paragraph.add(lines[i].trim());
        i++;
      }
      blocks.add(
        MobileMarkdownBlock(
          type: MobileMarkdownBlockType.paragraph,
          text: paragraph.join(' '),
        ),
      );
    }
    return blocks;
  }

  bool _startsBlock(List<String> lines, int i) {
    final line = lines[i];
    return line.startsWith('```') ||
        RegExp(r'^(#{1,6})\s+(.+)$').hasMatch(line) ||
        RegExp(r'^(\*\s*){3,}$|^(-\s*){3,}$').hasMatch(line.trim()) ||
        line.trimLeft().startsWith('>') ||
        RegExp(r'^\s*[-*]\s+').hasMatch(line) ||
        RegExp(r'^\s*\d+\.\s+').hasMatch(line) ||
        _isTableStart(lines, i);
  }

  bool _isTableStart(List<String> lines, int i) {
    if (i + 1 >= lines.length) return false;
    return lines[i].contains('|') &&
        RegExp(r'^\s*\|?[\s\-:|]+\|?\s*$').hasMatch(lines[i + 1]);
  }

  List<String> _parseTableRow(String line) {
    return line
        .replaceAll(RegExp(r'^\s*\|'), '')
        .replaceAll(RegExp(r'\|\s*$'), '')
        .split('|')
        .map((cell) => cell.trim())
        .toList(growable: false);
  }
}

class MobileMarkdownRenderer extends StatelessWidget {
  const MobileMarkdownRenderer({
    required this.content,
    required this.textColor,
    required this.mutedColor,
    required this.borderColor,
    required this.surfaceColor,
    required this.accentColor,
    required this.codeColor,
    super.key,
  });

  final String content;
  final Color textColor;
  final Color mutedColor;
  final Color borderColor;
  final Color surfaceColor;
  final Color accentColor;
  final Color codeColor;

  @override
  Widget build(BuildContext context) {
    final blocks = _MobileMarkdownParseCache.parse(content);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [for (final block in blocks) _blockFor(block)],
    );
  }

  Widget _blockFor(MobileMarkdownBlock block) {
    switch (block.type) {
      case MobileMarkdownBlockType.heading:
        return Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 7),
          child: Text.rich(
            _inline(block.text, baseWeight: FontWeight.w900),
            style: TextStyle(
              color: textColor,
              fontSize: switch (block.level) {
                1 => 21,
                2 => 17,
                _ => 15,
              },
              height: 1.2,
              letterSpacing: -.2,
            ),
          ),
        );
      case MobileMarkdownBlockType.paragraph:
        return Padding(
          padding: const EdgeInsets.only(bottom: 9),
          child: Text.rich(
            _inline(block.text),
            style: TextStyle(color: textColor, height: 1.45, fontSize: 14),
          ),
        );
      case MobileMarkdownBlockType.unorderedList:
        return _list(block.lines, ordered: false);
      case MobileMarkdownBlockType.orderedList:
        return _list(block.lines, ordered: true);
      case MobileMarkdownBlockType.quote:
        return Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          decoration: BoxDecoration(
            color: surfaceColor.withValues(alpha: .48),
            border: Border(left: BorderSide(color: accentColor, width: 3)),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Text(
            block.lines.join('\n'),
            style: TextStyle(
              color: mutedColor,
              height: 1.4,
              fontStyle: FontStyle.italic,
            ),
          ),
        );
      case MobileMarkdownBlockType.code:
        return _codeBlock(block);
      case MobileMarkdownBlockType.table:
        return _table(block.rows);
      case MobileMarkdownBlockType.rule:
        return Container(
          height: 1,
          margin: const EdgeInsets.symmetric(vertical: 12),
          color: borderColor,
        );
    }
  }

  Widget _list(List<String> items, {required bool ordered}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < items.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 5),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: ordered ? 28 : 18,
                    child: Text(
                      ordered ? '${i + 1}.' : '•',
                      style: TextStyle(
                        color: accentColor,
                        fontWeight: FontWeight.w900,
                        height: 1.38,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text.rich(
                      _inline(items[i]),
                      style: TextStyle(
                        color: textColor,
                        height: 1.38,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _codeBlock(MobileMarkdownBlock block) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: .34),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (block.language.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 9, 12, 0),
              child: Text(
                block.language,
                style: TextStyle(
                  color: mutedColor,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.all(12),
            child: Text(
              block.text.isEmpty ? ' ' : block.text,
              style: TextStyle(
                color: codeColor,
                fontFamily: AurictTypography.mono,
                fontSize: 12.5,
                height: 1.42,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _table(List<List<String>> rows) {
    if (rows.isEmpty) return const SizedBox.shrink();
    final header = rows.first;
    final body = rows.skip(1).toList(growable: false);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        border: Border.all(color: borderColor),
        borderRadius: BorderRadius.circular(16),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          headingRowHeight: 38,
          dataRowMinHeight: 36,
          dataRowMaxHeight: 54,
          dividerThickness: .4,
          columns: [
            for (final cell in header)
              DataColumn(
                label: Text(
                  cell,
                  style: TextStyle(
                    color: textColor,
                    fontWeight: FontWeight.w900,
                    fontSize: 12,
                  ),
                ),
              ),
          ],
          rows: [
            for (final row in body)
              DataRow(
                cells: [
                  for (var i = 0; i < header.length; i++)
                    DataCell(
                      Text(
                        i < row.length ? row[i] : '',
                        style: TextStyle(color: mutedColor, fontSize: 12),
                      ),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  TextSpan _inline(String input, {FontWeight? baseWeight}) {
    final spans = <InlineSpan>[];
    final re = RegExp(
      r'(\[([^\]]+)\]\(([^)]+)\)|`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|_[^_\n]+_|\*[^*\n]+\*)',
    );
    var index = 0;
    for (final match in re.allMatches(input)) {
      if (match.start > index) {
        spans.add(TextSpan(text: input.substring(index, match.start)));
      }
      final token = match.group(0)!;
      if (token.startsWith('[')) {
        spans.add(
          TextSpan(
            text: match.group(2),
            style: TextStyle(
              color: accentColor,
              decoration: TextDecoration.underline,
            ),
          ),
        );
      } else if (token.startsWith('`')) {
        spans.add(
          WidgetSpan(
            alignment: PlaceholderAlignment.middle,
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 2),
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: surfaceColor.withValues(alpha: .72),
                borderRadius: BorderRadius.circular(7),
                border: Border.all(color: borderColor),
              ),
              child: Text(
                token.substring(1, token.length - 1),
                style: TextStyle(
                  color: codeColor,
                  fontFamily: AurictTypography.mono,
                  fontSize: 12,
                ),
              ),
            ),
          ),
        );
      } else if (token.startsWith('**') || token.startsWith('__')) {
        spans.add(
          TextSpan(
            text: token.substring(2, token.length - 2),
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
        );
      } else if (token.startsWith('~~')) {
        spans.add(
          TextSpan(
            text: token.substring(2, token.length - 2),
            style: const TextStyle(decoration: TextDecoration.lineThrough),
          ),
        );
      } else {
        spans.add(
          TextSpan(
            text: token.substring(1, token.length - 1),
            style: const TextStyle(fontStyle: FontStyle.italic),
          ),
        );
      }
      index = match.end;
    }
    if (index < input.length) {
      spans.add(TextSpan(text: input.substring(index)));
    }
    return TextSpan(
      style: TextStyle(fontWeight: baseWeight),
      children: spans.isEmpty ? [TextSpan(text: input)] : spans,
    );
  }
}

class _MobileMarkdownParseCache {
  _MobileMarkdownParseCache._();

  static const _maxEntries = 80;
  static final _cache = <String, List<MobileMarkdownBlock>>{};

  static List<MobileMarkdownBlock> parse(String content) {
    final key = '${content.length}:${content.hashCode}';
    final cached = _cache.remove(key);
    if (cached != null) {
      _cache[key] = cached;
      return cached;
    }
    final parsed = const MobileMarkdownParser().parse(content);
    _cache[key] = parsed;
    if (_cache.length > _maxEntries) {
      _cache.remove(_cache.keys.first);
    }
    return parsed;
  }
}
