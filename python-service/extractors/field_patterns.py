"""Field label synonyms and regex patterns for irregular .docx layouts."""

from __future__ import annotations

import re
import unicodedata
from typing import Iterable

FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "name": (
        "name",
        "title",
        "product name",
        "item name",
        "document name",
        "document title",
        "full name",
        "subject",
        "project name",
        "report title",
        "report name",
        "nombre",
        "nombre del producto",
        "nombre del documento",
        "nombre completo",
        "titulo",
        "título",
        "asunto",
        "nom",
        "nom du produit",
        "nom du document",
        "nom complet",
        "titre",
        "intitule",
        "intitulé",
        "objet",
        "nome",
        "nome do produto",
        "nome do documento",
        "nome completo",
        "titulo do documento",
        "título do documento",
        "naam",
        "documentnaam",
        "titel",
        "titolo",
        "nome documento",
        "nazwa",
        "tytul",
        "tytuł",
        "nume",
        "denumire",
        "nazev",
        "název",
        "isim",
        "ad",
        "baslik",
        "başlık",
        "nimi",
        "otsikko",
        "namn",
        "tên",
        "tieu de",
        "tiêu đề",
        "nama",
        "judul",
        "ชื่อ",
        "ชื่อเอกสาร",
        "όνομα",
        "τίτλος",
        "название",
        "имя",
        "заголовок",
        "наименование",
        "назва",
        "ім'я",
        "заголовок документа",
        "اسم",
        "الاسم",
        "اسم المنتج",
        "اسم المستند",
        "عنوان الوثيقة",
        "العنوان",
        "نام",
        "عنوان",
        "שם",
        "כותרת",
        "שם המסמך",
        "नाम",
        "शीर्षक",
        "নাম",
        "শিরোনাম",
        "பெயர்",
        "தலைப்பு",
        "名称",
        "姓名",
        "品名",
        "标题",
        "標題",
        "题目",
        "題目",
        "文档名称",
        "文件名稱",
        "文件名",
        "产品名称",
        "產品名稱",
        "名前",
        "氏名",
        "タイトル",
        "文書名",
        "書類名",
        "製品名",
        "이름",
        "제목",
        "문서명",
        "제품명",
        "문서 제목",
    ),
    "category": (
        "category",
        "type",
        "genre",
        "classification",
        "department",
        "topic",
        "product type",
        "document type",
        "categoria",
        "categoría",
        "tipo",
        "clasificacion",
        "clasificación",
        "departamento",
        "tema",
        "categorie",
        "catégorie",
        "genre",
        "rubrique",
        "classement",
        "tipo de documento",
        "tipo de produto",
        "classificacao",
        "classificação",
        "categorie",
        "kategorie",
        "typ",
        "abteilung",
        "thema",
        "dokumenttyp",
        "reparto",
        "argomento",
        "kategoria",
        "klasyfikacja",
        "categorie",
        "kategorie",
        "kategori",
        "sinif",
        "sınıf",
        "luokka",
        "tyyppi",
        "kategori",
        "danh muc",
        "danh mục",
        "loai",
        "loại",
        "jenis",
        "หมวดหมู่",
        "ประเภท",
        "κατηγορία",
        "είδος",
        "категория",
        "тип",
        "классификация",
        "раздел",
        "тематика",
        "категорія",
        "тип документу",
        "فئة",
        "الفئة",
        "تصنيف",
        "التصنيف",
        "نوع",
        "النوع",
        "قسم",
        "دسته",
        "دسته بندی",
        "קטגוריה",
        "סוג",
        "סיווג",
        "श्रेणी",
        "प्रकार",
        "বিভাগ",
        "வகை",
        "类别",
        "類別",
        "分类",
        "分類",
        "类型",
        "類型",
        "品类",
        "主题",
        "主題",
        "部門",
        "部门",
        "カテゴリ",
        "カテゴリー",
        "分類",
        "種別",
        "種類",
        "部門",
        "분류",
        "카테고리",
        "유형",
        "종류",
        "문서 유형",
    ),
    "summary": (
        "summary",
        "overview",
        "abstract",
        "brief",
        "synopsis",
        "short description",
        "executive summary",
        "highlights",
        "tl;dr",
        "tldr",
        "resumen",
        "sumario",
        "sinopsis",
        "descripcion breve",
        "descripción breve",
        "resume",
        "résumé",
        "apercu",
        "aperçu",
        "sommaire",
        "synthese",
        "synthèse",
        "resumo",
        "visao geral",
        "visão geral",
        "sinopse",
        "samenvatting",
        "overzicht",
        "zusammenfassung",
        "uberblick",
        "überblick",
        "kurzbeschreibung",
        "kurzzusammenfassung",
        "riepilogo",
        "sommario",
        "sintesi",
        "panoramica",
        "streszczenie",
        "podsumowanie",
        "rezumat",
        "shrnuti",
        "shrnutí",
        "ozet",
        "özet",
        "tiivistelma",
        "tiivistelmä",
        "sammanfattning",
        "oversikt",
        "tom tat",
        "tóm tắt",
        "tong quan",
        "tổng quan",
        "ringkasan",
        "ikhtisar",
        "สรุป",
        "ภาพรวม",
        "περίληψη",
        "σύνοψη",
        "краткое описание",
        "резюме",
        "обзор",
        "аннотация",
        "краткое содержание",
        "короткий опис",
        "анотація",
        "ملخص",
        "الملخص",
        "نبذة",
        "نظرة عامة",
        "خلاصه",
        "چکیده",
        "תקציר",
        "סיכום",
        "סקירה",
        "सारांश",
        "संक्षेप",
        "সারসংক্ষেপ",
        "சுருக்கம்",
        "摘要",
        "简介",
        "簡介",
        "概述",
        "概要",
        "提要",
        "简述",
        "簡述",
        "概要",
        "要約",
        "概観",
        "あらすじ",
        "요약",
        "개요",
        "초록",
        "짧은 설명",
    ),
    "description": (
        "description",
        "details",
        "detail",
        "notes",
        "about",
        "information",
        "full description",
        "long description",
        "purpose",
        "background",
        "narrative",
        "additional notes",
        "additional information",
        "descripcion",
        "descripción",
        "detalles",
        "notas",
        "informacion",
        "información",
        "acerca de",
        "proposito",
        "propósito",
        "description complete",
        "description complète",
        "details",
        "détails",
        "notes",
        "a propos",
        "à propos",
        "informations",
        "contexte",
        "descricao",
        "descrição",
        "detalhes",
        "notas",
        "informacoes",
        "informações",
        "sobre",
        "finalidade",
        "beschrijving",
        "details",
        "notities",
        "informatie",
        "doel",
        "beschreibung",
        "details",
        "hinweise",
        "anmerkungen",
        "informationen",
        "zweck",
        "hintergrund",
        "descrizione",
        "dettagli",
        "note",
        "informazioni",
        "scopo",
        "contesto",
        "opis",
        "szczegoly",
        "szczegóły",
        "uwagi",
        "informacje",
        "descriere",
        "detalii",
        "popis",
        "podrobnosti",
        "aciklama",
        "açıklama",
        "detaylar",
        "notlar",
        "kuvaus",
        "tiedot",
        "beskrivning",
        "detaljer",
        "anteckningar",
        "mo ta",
        "mô tả",
        "chi tiet",
        "chi tiết",
        "ghi chu",
        "ghi chú",
        "deskripsi",
        "rincian",
        "catatan",
        "keterangan",
        "คำอธิบาย",
        "รายละเอียด",
        "περιγραφή",
        "λεπτομέρειες",
        "σημειώσεις",
        "описание",
        "подробности",
        "детали",
        "примечания",
        "заметки",
        "информация",
        "назначение",
        "описание",
        "примітки",
        "інформація",
        "وصف",
        "الوصف",
        "تفاصيل",
        "التفاصيل",
        "ملاحظات",
        "معلومات",
        "الغرض",
        "شرح",
        "توضیحات",
        "شرح",
        "תיאור",
        "פרטים",
        "הערות",
        "מידע",
        "विवरण",
        "विस्तार",
        "नोट्स",
        "বিবরণ",
        "விவரம்",
        "描述",
        "说明",
        "說明",
        "详情",
        "詳情",
        "详细说明",
        "詳細說明",
        "备注",
        "備註",
        "简介说明",
        "内容",
        "內容",
        "目的",
        "背景",
        "説明",
        "詳細",
        "記述",
        "備考",
        "内容",
        "目的",
        "背景",
        "설명",
        "상세",
        "세부 사항",
        "내용",
        "비고",
        "목적",
        "배경",
    ),
    "author": (
        "author",
        "writer",
        "created by",
        "prepared by",
        "written by",
        "submitted by",
        "reported by",
        "owner",
        "contributor",
        "analyst",
        "autor",
        "autora",
        "escrito por",
        "preparado por",
        "creado por",
        "redactado por",
        "auteur",
        "ecrit par",
        "écrit par",
        "prepare par",
        "préparé par",
        "cree par",
        "créé par",
        "redige par",
        "rédigé par",
        "autora",
        "escrito por",
        "preparado por",
        "criado por",
        "auteur",
        "geschreven door",
        "opgesteld door",
        "gemaakt door",
        "verfasser",
        "autorin",
        "erstellt von",
        "erstellt durch",
        "geschrieben von",
        "vorbereitet von",
        "besitzer",
        "autore",
        "autrice",
        "scritto da",
        "preparato da",
        "creato da",
        "redatto da",
        "autor",
        "napisane przez",
        "przygotowane przez",
        "autor",
        "autor",
        "yazar",
        "hazirlayan",
        "hazırlayan",
        "olusturan",
        "oluşturan",
        "tekija",
        "tekijä",
        "forfattare",
        "författare",
        "skriven av",
        "tac gia",
        "tác giả",
        "nguoi soan",
        "người soạn",
        "penulis",
        "disusun oleh",
        "dibuat oleh",
        "ผู้เขียน",
        "ผู้จัดทำ",
        "συγγραφέας",
        "συντάκτης",
        "автор",
        "составитель",
        "подготовлено",
        "написал",
        "владелец",
        "автор",
        "укладач",
        "підготовлено",
        "مؤلف",
        "المؤلف",
        "كاتب",
        "الكاتب",
        "إعداد",
        "اعده",
        "أعده",
        "كتب بواسطة",
        "المعد",
        "نویسنده",
        "مولف",
        "מחבר",
        "כותב",
        "נכתב על ידי",
        "הוכן על ידי",
        "लेखक",
        "द्वारा लिखित",
        "লেখক",
        "ஆசிரியர்",
        "作者",
        "编写",
        "編寫",
        "撰写",
        "撰寫",
        "编制",
        "編制",
        "创建者",
        "建立者",
        "负责人",
        "負責人",
        "著者",
        "作者",
        "作成者",
        "執筆",
        "作成",
        "担当",
        "저자",
        "작성자",
        "글쓴이",
        "담당자",
        "작성",
    ),
    "tags": (
        "tags",
        "keywords",
        "labels",
        "topics",
        "key words",
        "key-words",
        "hashtags",
        "etiquetas",
        "palabras clave",
        "etiquettes",
        "étiquettes",
        "mots cles",
        "mots clés",
        "mots-cles",
        "mots-clés",
        "etiquetas",
        "palavras chave",
        "palavras-chave",
        "tags",
        "trefwoorden",
        "labels",
        "stichworter",
        "stichwörter",
        "schlagworter",
        "schlagwörter",
        "schlagworte",
        "stichworte",
        "tag",
        "parole chiave",
        "etichette",
        "argomenti",
        "tagi",
        "slowa kluczowe",
        "słowa kluczowe",
        "etichete",
        "cuvinte cheie",
        "stitky",
        "štítky",
        "klicova slova",
        "klíčová slova",
        "etiketler",
        "anahtar kelimeler",
        "avainsanat",
        "nyckelord",
        "etiketter",
        "thẻ",
        "tu khoa",
        "từ khóa",
        "tag",
        "kata kunci",
        "label",
        "แท็ก",
        "คำสำคัญ",
        "ετικέτες",
        "λέξεις-κλειδιά",
        "теги",
        "метки",
        "ключевые слова",
        "ключові слова",
        "теги",
        "وسوم",
        "الوسوم",
        "كلمات مفتاحية",
        "الكلمات المفتاحية",
        "كلمات دلالية",
        "برچسب",
        "کلیدواژه",
        "תגיות",
        "מילות מפתח",
        "टैग",
        "कीवर्ड",
        "ট্যাগ",
        "குறிச்சொற்கள்",
        "标签",
        "標籤",
        "关键词",
        "關鍵詞",
        "关键字",
        "關鍵字",
        "主题词",
        "主題詞",
        "タグ",
        "キーワード",
        "ラベル",
        "タグ付け",
        "태그",
        "키워드",
        "라벨",
        "검색어",
    ),
}

FIELD_ALIASES = {key: tuple(dict.fromkeys(aliases)) for key, aliases in FIELD_ALIASES.items()}

KNOWN_FIELDS = tuple(FIELD_ALIASES.keys())
BLOCK_FIELDS = {"summary", "description"}
WEAK_HEADINGS = {
    unicodedata.normalize("NFKC", item).casefold()
    for item in (
        "introduction",
        "conclusion",
        "references",
        "appendix",
        "contents",
        "table of contents",
        "index",
        "abstract",
        "overview",
        "summary",
        "acknowledgements",
        "acknowledgments",
        "introduccion",
        "introducción",
        "conclusion",
        "conclusión",
        "referencias",
        "anexo",
        "indice",
        "índice",
        "introducao",
        "introdução",
        "conclusao",
        "conclusão",
        "referencias",
        "anexo",
        "sumario",
        "sumário",
        "introduction",
        "conclusion",
        "references",
        "annexe",
        "table des matieres",
        "table des matières",
        "sommaire",
        "einleitung",
        "fazit",
        "schluss",
        "literatur",
        "anhang",
        "inhaltsverzeichnis",
        "introduzione",
        "conclusione",
        "riferimenti",
        "appendice",
        "indice",
        "inleiding",
        "conclusie",
        "bijlage",
        "inhoudsopgave",
        "wstep",
        "wstęp",
        "zakonczenie",
        "zakończenie",
        "spis tresci",
        "spis treści",
        "giris",
        "giriş",
        "sonuc",
        "sonuç",
        "ekler",
        "johdanto",
        "yhteenveto",
        "sisallys",
        "sisällys",
        "inledning",
        "slutsats",
        "innehall",
        "innehåll",
        "phan mo dau",
        "phần mở đầu",
        "ket luan",
        "kết luận",
        "pendahuluan",
        "kesimpulan",
        "daftar isi",
        "บทนำ",
        "สรุป",
        "สารบัญ",
        "εισαγωγή",
        "συμπέρασμα",
        "παράρτημα",
        "введение",
        "заключение",
        "выводы",
        "приложение",
        "оглавление",
        "содержание",
        "список литературы",
        "вступ",
        "висновки",
        "додаток",
        "зміст",
        "مقدمة",
        "خاتمة",
        "مراجع",
        "ملحق",
        "فهرس",
        "المحتويات",
        "مقدمه",
        "نتیجه",
        "پیوست",
        "מבוא",
        "סיכום",
        "נספח",
        "תוכן עניינים",
        "परिचय",
        "निष्कर्ष",
        "संदर्भ",
        "परिशिष्ट",
        "引言",
        "简介",
        "结论",
        "結論",
        "参考文献",
        "參考文獻",
        "附录",
        "附錄",
        "目录",
        "目錄",
        "目次",
        "前言",
        "序言",
        "はじめに",
        "序論",
        "結論",
        "参考文献",
        "付録",
        "目次",
        "概要",
        "서론",
        "서문",
        "결론",
        "참고문헌",
        "부록",
        "목차",
        "개요",
    )
}

_CJK = r"\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af"
_LETTER = r"[^\W\d_]"
_LABEL_CHAR = rf"(?:{_LETTER}|[\d_ &\-/'’.·])"

_LIST_PREFIX = re.compile(
    r"^\s*(?:"
    r"(?:[\(\[（]?(?:\d+|[٠-٩]+|[۰-۹]+|[ivxlcdm]+)[\)\]）．.:：-]|[-*•●▪◦])\s+"
    r"|(?:[一二三四五六七八九十]+、|\d+、)\s*"
    r")",
    re.IGNORECASE,
)
_TRAILING_HINT = re.compile(
    r"(?:\s*[\*＊]+\s*|\s*\([^)]*\)\s*|\s*\[[^\]]*\]\s*|\s*（[^）]*）\s*|\s*【[^】]*】\s*)+$"
)

# Colon (including fullwidth), ideographic space, spaced dash/equals, pipe, or tab.
_SEP = rf"(?:\t+|\u3000+|\s*[:：︰](?!//)\s*|\s+[-–—=]\s+|\s*\|\s*)"
_LABEL_HINT = r"(?:\s*[\*＊]+|\s*\([^)]*\)|\s*\[[^\]]*\]|\s*（[^）]*）|\s*【[^】]*】)*"
_LABEL = rf"{_LETTER}{_LABEL_CHAR}{{1,40}}"

_LABEL_ONLY = re.compile(
    rf"^\s*(?P<label>{_LABEL}){_LABEL_HINT}\s*[:：︰\-–—|]?\s*$",
    re.IGNORECASE,
)

_INLINE = re.compile(
    rf"^\s*(?P<label>{_LABEL}){_LABEL_HINT}\s*{_SEP}(?P<value>.+?)\s*$",
    re.IGNORECASE,
)

_EMAIL = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
_PHONE = re.compile(
    r"\b(?:\+?\d{1,3}[\s.\-])?(?:\(?\d{3}\)?[\s.\-])\d{3}[\s.\-]\d{4}\b"
)
_DATE = re.compile(
    r"(?:"
    r"\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b|"
    r"\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日|"
    r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December|"
    r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|"
    r"enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|"
    r"janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre|"
    r"januar|februar|marz|märz|april|mai|juni|juli|august|september|oktober|november|dezember"
    r")\.?\s+\d{1,2},?\s+\d{4}\b"
    r")",
    re.IGNORECASE,
)

_UNTITLED_NAMES = {
    unicodedata.normalize("NFKC", item).casefold()
    for item in (
        "document",
        "untitled",
        "untitled document",
        "doc",
        "file",
        "documento",
        "documento sin titulo",
        "documento sin título",
        "sans titre",
        "document sans titre",
        "ohne titel",
        "unbenannt",
        "documento senza titolo",
        "sem titulo",
        "sem título",
        "naamloos",
        "dokument",
        "nimetön",
        "namnlost",
        "namnlöst",
        "không có tiêu đề",
        "tanpa judul",
        "без названия",
        "новый документ",
        "без назви",
        "بدون عنوان",
        "مستند",
        "بدون عنوان",
        "ללא כותרת",
        "बिना शीर्षक",
        "无标题",
        "無標題",
        "未命名",
        "未命名文档",
        "無題",
        "無題の文書",
        "제목 없음",
        "문서",
    )
}


def _fold(text: str) -> str:
    return unicodedata.normalize("NFKC", text or "").casefold()


_ALIAS_LOOKUP: dict[str, str] = {}
for _canonical, _aliases in FIELD_ALIASES.items():
    for _alias in _aliases:
        _ALIAS_LOOKUP.setdefault(_fold(_alias), _canonical)

_ALIAS_ALT = "|".join(
    re.escape(alias)
    for alias in sorted(_ALIAS_LOOKUP, key=len, reverse=True)
    if alias
)
_GLUE = _CJK + r"\u0590-\u05ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0e00-\u0e7f"
_FIELD_START = rf"(?:^|(?<=[\s;|/；。、，،؛\u3000{_GLUE}]))"
_NEXT_FIELD = rf"(?:[\s\u3000]+|(?<=[{_GLUE}]))(?:{_ALIAS_ALT}){_LABEL_HINT}\s*{_SEP}"
_KNOWN_LABELED = re.compile(
    rf"(?i){_FIELD_START}(?P<label>{_ALIAS_ALT}){_LABEL_HINT}\s*{_SEP}(?P<value>.+?)(?={_NEXT_FIELD}|$)"
)
_EXTRA_LABELED = re.compile(
    rf"(?i)(?:^|(?<=[\s\u3000]))(?P<label>{_LABEL}){_LABEL_HINT}\s*[:：︰](?!//)\s*(?P<value>.+?)"
    rf"(?=\s+{_LABEL}{_LABEL_HINT}\s*[:：︰]|$)"
)


def strip_list_prefix(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    text = text.replace("\u00a0", " ").replace("\u202f", " ").replace("\u3000", " ")
    return _LIST_PREFIX.sub("", text.strip())


def peel_label(text: str) -> str:
    return _TRAILING_HINT.sub("", strip_list_prefix(text)).strip()


def normalize_label(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", _fold(peel_label(text)))
    return cleaned.rstrip(":-–—|=?？：︰؛، ")


def match_canonical_field(label: str) -> str | None:
    return _ALIAS_LOOKUP.get(normalize_label(label))


def clean_value(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "")
    value = value.replace("\u00a0", " ").replace("\u202f", " ")
    value = value.strip(" \t;|")
    value = re.sub(r"^[:：︰\-–—=]+\s*", "", value)
    return re.sub(r"[ \t]+", " ", value).strip()


def looks_like_label(text: str) -> bool:
    text = peel_label(text)
    if not text or len(text) > 48:
        return False
    if match_canonical_field(text):
        return True
    if re.search(r"[.!?。！？؟]$", text):
        return False
    if len(text.split()) > 4:
        return False
    return bool(_LABEL_ONLY.match(text))


def parse_labeled_line(line: str) -> tuple[str, str] | None:
    line = strip_list_prefix(line)
    match = _INLINE.match(line)
    if not match:
        return None
    value = clean_value(match.group("value"))
    if not value:
        return None
    key = match_canonical_field(match.group("label")) or normalize_label(match.group("label"))
    return key, value


def parse_all_labeled_fields(text: str) -> list[tuple[str, str]]:
    """Find one or more Label: value pairs anywhere in the text."""
    found: list[tuple[str, str]] = []
    occupied: list[tuple[int, int]] = []

    def _take(match: re.Match[str], key: str) -> None:
        value = clean_value(match.group("value"))
        if not value:
            return
        span = match.span()
        if any(span[0] < end and span[1] > start for start, end in occupied):
            return
        found.append((key, value))
        occupied.append(span)

    for match in _KNOWN_LABELED.finditer(strip_list_prefix(text or "")):
        canonical = match_canonical_field(match.group("label"))
        if canonical:
            _take(match, canonical)

    if not found:
        single = parse_labeled_line(text)
        if single:
            return [single]
        for match in _EXTRA_LABELED.finditer(text or ""):
            label = match.group("label")
            if match_canonical_field(label):
                continue
            _take(match, normalize_label(label))
    return found


def parse_label_only(line: str, *, extra: bool = False) -> str | None:
    line = strip_list_prefix(line)
    match = _LABEL_ONLY.match(line)
    if not match:
        return None
    canonical = match_canonical_field(match.group("label"))
    if canonical:
        return canonical
    if extra and line.rstrip().endswith((":", "-", "–", "—", "=", "：", "︰")):
        return normalize_label(match.group("label"))
    return None


def looks_like_field_line(text: str) -> bool:
    return bool(parse_all_labeled_fields(text))


def is_plausible_value(key: str, value: str) -> bool:
    value = (value or "").strip()
    if not value:
        return False
    if match_canonical_field(value) and key not in {"category", "tags"}:
        return False
    if key == "name":
        return 1 <= len(value) <= 160 and value.count("\n") <= 2
    if key == "author":
        return 2 <= len(value) <= 80 and not _EMAIL.search(value) and len(value.split()) <= 8
    if key == "category":
        return 1 <= len(value) <= 80
    if key == "tags":
        return 1 <= len(value) <= 240
    return True


def _is_cjk(text: str) -> bool:
    return bool(re.search(rf"[{_CJK}]", text))


def value_quality(key: str, value: str) -> int:
    value = (value or "").strip()
    if not is_plausible_value(key, value):
        return 0
    words = value.split()
    lowered = _fold(value)
    if key == "name":
        if value.isdigit() or (len(value) < 3 and not _is_cjk(value)):
            return 3
        if lowered in WEAK_HEADINGS or lowered in {
            "product sheet",
            "inventory record",
            "fact sheet",
            "cover page",
            "ficha de producto",
            "fiche produit",
            "produktblatt",
            "产品说明书",
            "產品說明書",
            "製品シート",
            "제품 시트",
        }:
            return 6
        if _is_cjk(value) and 2 <= len(value) <= 24:
            return 22
        if 2 <= len(words) <= 8 and sum(c.isalpha() for c in value) >= 6:
            return 22
        if 8 <= len(value) <= 80:
            return 16
        return 12
    if key == "author":
        if _is_cjk(value) and 2 <= len(value) <= 8:
            return 20
        if 2 <= len(words) <= 4:
            return 20
        return 12
    if key == "category":
        return 18 if 1 <= len(words) <= 6 or (_is_cjk(value) and len(value) <= 12) else 10
    if key in {"summary", "description"}:
        return 14 if len(value) >= 40 else 10
    return 10


def is_mostly_empty(text: str | None) -> bool:
    return not text or not str(text).strip()


def longest_paragraph(paragraphs: Iterable[str], *, min_length: int = 40) -> str | None:
    candidates = [p.strip() for p in paragraphs if p and len(p.strip()) >= min_length]
    if not candidates:
        return None
    return max(candidates, key=len)


def extract_contacts(text: str) -> dict[str, list[str]]:
    emails = list(dict.fromkeys(_EMAIL.findall(text or "")))
    phones = list(dict.fromkeys(m.strip() for m in _PHONE.findall(text or "")))
    dates = list(dict.fromkeys(m.strip() for m in _DATE.findall(text or "")))
    return {"emails": emails, "phones": phones, "dates": dates}


def is_untitled_filename(name: str) -> bool:
    return _fold(name) in _UNTITLED_NAMES


def is_weak_heading(text: str) -> bool:
    return _fold(text) in WEAK_HEADINGS
