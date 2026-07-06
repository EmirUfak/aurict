// One Dark color palette — terminal syntax highlight
export const C = {
  keyword:  "#c678dd",  // purple — const, if, return...
  string:   "#98c379",  // green
  comment:  "#5c6370",  // gray
  number:   "#d19a66",  // orange
  type:     "#e5c07b",  // yellow — class, interface
  fn:       "#61afef",  // blue — function names
  operator: "#56b6c2",  // cyan — =, +, :
  builtin:  "#e06c75",  // red — error, null, undefined
  plain:    "#abb2bf",  // light gray — normal text
} as const

export type HColor = typeof C[keyof typeof C]
export interface Token { text: string; color: HColor; bold?: boolean }

// ── Dil tespiti ───────────────────────────────────────────────────────────────

export type Lang = "ts"|"js"|"python"|"bash"|"json"|"css"|"generic"

export function detectLang(hint: string): Lang {
  const h = hint.toLowerCase().trim()
  if (["ts","tsx","typescript"].includes(h)) return "ts"
  if (["js","jsx","javascript"].includes(h))  return "js"
  if (["py","python"].includes(h))            return "python"
  if (["sh","bash","shell","zsh"].includes(h)) return "bash"
  if (["json","jsonc"].includes(h))           return "json"
  if (["css","scss","less","sass"].includes(h)) return "css"
  return "generic"
}

// ── Anahtar kelimeler ─────────────────────────────────────────────────────────

const TS_KW = new Set([
  "const","let","var","function","return","if","else","for","while","do",
  "switch","case","break","continue","class","extends","new","this","super",
  "import","export","from","default","async","await","try","catch","finally",
  "throw","typeof","instanceof","void","type","interface","enum","namespace",
  "abstract","implements","public","private","protected","readonly","static",
  "declare","as","in","of","null","undefined","true","false","delete","yield",
])
const PY_KW = new Set([
  "def","class","return","if","elif","else","for","while","break","continue",
  "import","from","as","pass","raise","try","except","finally","with","yield",
  "lambda","and","or","not","in","is","True","False","None","async","await",
  "global","nonlocal","del","assert","print","len","range","type","self",
])
const BASH_KW = new Set([
  "if","then","else","elif","fi","for","do","done","while","until","case",
  "esac","function","return","exit","echo","export","local","readonly","source",
  "cd","ls","mkdir","rm","mv","cp","cat","grep","sed","awk","chmod","sudo",
  "set","unset","shift","true","false",
])

// ── Ana tokenizer ─────────────────────────────────────────────────────────────

export function tokenizeLine(line: string, lang: Lang): Token[] {
  if (lang === "json")   return tokenizeJSON(line)
  if (lang === "css")    return tokenizeCSS(line)
  if (lang === "python") return tokenizeCode(line, PY_KW,  "#")
  if (lang === "bash")   return tokenizeCode(line, BASH_KW, "#")
  return tokenizeCode(line, TS_KW, "//")
}

function t(text: string, color: HColor, bold = false): Token {
  return { text, color, bold }
}

// Regex line tokenizer — for TS/JS/Python/Bash
function tokenizeCode(line: string, kw: Set<string>, commentChar: string): Token[] {
  // Is the whole line a comment?
  const trimmed = line.trimStart()
  if (
    trimmed.startsWith(commentChar) ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("#!")
  ) {
    return [t(line, C.comment)]
  }

  const tokens: Token[] = []
  const re = new RegExp(
    // 1: template literal  2: double-quote string  3: single-quote string
    // 4: inline comment    5: number   6: ident    7: operator/punct
    "(`(?:[^`\\\\]|\\\\.)*`)" +
    "|" + '("(?:[^"\\\\]|\\\\.)*")' +
    "|" + "('(?:[^'\\\\]|\\\\.)*')" +
    "|" + `(${commentChar === "//" ? "\\/\\/.*$|\\/\\*[\\s\\S]*?\\*\\/" : "#.*$"})` +
    "|" + "(\\b\\d+\\.?\\d*[a-zA-Z]*\\b)" +
    "|" + "([A-Za-z_$][A-Za-z0-9_$]*)" +
    "|" + "([+\\-*\\/=<>!&|^~%@]+|[{}[\\]().,;:?])",
    "g"
  )

  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) tokens.push(t(line.slice(last, m.index), C.plain))
    const [, tmpl, dstr, sstr, cmt, num, ident, op] = m

    if (tmpl ?? dstr ?? sstr) {
      tokens.push(t(m[0], C.string))
    } else if (cmt) {
      tokens.push(t(cmt, C.comment))
    } else if (num) {
      tokens.push(t(num, C.number))
    } else if (ident) {
      const word = ident
      if (kw.has(word)) {
        // Special builtins
        if (["null","undefined","None","True","False","true","false"].includes(word)) {
          tokens.push(t(word, C.builtin))
        } else {
          tokens.push(t(word, C.keyword, true))
        }
      } else if (/^[A-Z][a-zA-Z0-9]*$/.test(word)) {
        tokens.push(t(word, C.type))
      } else if (line[m.index + word.length] === "(") {
        tokens.push(t(word, C.fn))
      } else {
        tokens.push(t(word, C.plain))
      }
    } else if (op) {
      tokens.push(t(op, C.operator))
    }

    last = m.index + m[0].length
  }
  if (last < line.length) tokens.push(t(line.slice(last), C.plain))
  return tokens
}

function tokenizeJSON(line: string): Token[] {
  const tokens: Token[] = []
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(\b\d+\.?\d*\b)|(true|false|null)|([{}\[\],:])|(\S+)/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(line)) !== null) {
    if (m.index > last) tokens.push(t(line.slice(last, m.index), C.plain))
    const [full, str, colon, num, kw, punct] = m

    if (str && colon) {
      tokens.push(t(str, C.fn))           // object key → mavi
      tokens.push(t(colon, C.operator))
    } else if (str) {
      tokens.push(t(str, C.string))
    } else if (num) {
      tokens.push(t(num, C.number))
    } else if (kw) {
      tokens.push(t(kw, C.builtin))
    } else if (punct) {
      tokens.push(t(punct, C.operator))
    } else {
      tokens.push(t(full, C.plain))
    }
    last = m.index + m[0].length
  }
  if (last < line.length) tokens.push(t(line.slice(last), C.plain))
  return tokens
}

function tokenizeCSS(line: string): Token[] {
  const trimmed = line.trim()
  if (trimmed.startsWith("/*") || trimmed.startsWith("*")) {
    return [t(line, C.comment)]
  }
  // property: value;
  const prop = /^(\s*)([a-z-]+)(\s*:\s*)(.+?)(;?)(\s*)$/.exec(line)
  if (prop) {
    return [
      t(prop[1]!, C.plain),
      t(prop[2]!, C.fn),
      t(prop[3]!, C.operator),
      t(prop[4]!, C.string),
      t(prop[5]!, C.operator),
    ]
  }
  if (trimmed.endsWith("{") || trimmed === "}") return [t(line, C.type)]
  return [t(line, C.plain)]
}
