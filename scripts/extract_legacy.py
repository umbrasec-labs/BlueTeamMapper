#!/usr/bin/env python3
"""Extract the content of the legacy static Blue Team Mapper page into JSON.

The v3 site was a single hand-written index.html (kept in legacy/index.html).
This script turns its sections, cards, matrices, technique table, event IDs and
tool arsenal into structured JSON under src/data/legacy/, which the typed data
modules in src/data/ import. Re-run it after editing the legacy page:

    python3 scripts/extract_legacy.py

Requires beautifulsoup4.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "legacy" / "index.html"
OUT = ROOT / "src" / "data" / "legacy"

# Sections whose bodies are rendered by dedicated views rather than as cards.
SPECIAL = {"lifecycle", "flows", "technique-detect", "event-ids", "tools"}

TONE_BY_CLASS = {"ok": "good", "wn": "warn", "er": "bad"}
NAME_OVERRIDES = {
    ("security", 4728): "Member added to global grp",
    ("security", 4887): "Certificate issued with SAN",
    ("security", 4899): "Certificate template modified",
    ("sysmon", 15): "FileCreateStreamHash",
    ("sysmon", 23): "FileDelete (archive)",
}
TONE_BY_CALLOUT = {
    "callout-warn": "warn",
    "callout-success": "success",
    "callout-purple": "info",
    "callout-danger": "danger",
    "callout-info": "info",
}


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def inline(node: Tag) -> str:
    """Flatten inline markup, keeping <code> as `backticks`."""
    parts: list[str] = []
    for child in node.children:
        if isinstance(child, NavigableString):
            parts.append(str(child))
        elif child.name == "code":
            parts.append(f"`{child.get_text()}`")
        elif child.name == "br":
            parts.append(" ")
        else:
            parts.append(inline(child))
    return "".join(parts)


def parse_item(li: Tag) -> dict:
    note_el = li.find("span", class_="note")
    note = clean(inline(note_el)) if note_el else None
    if note_el:
        note_el.extract()
    strong = li.find("strong")
    lead = clean(inline(strong)) if strong else ""
    if strong:
        strong.extract()
    text = clean(inline(li))
    text = re.sub(r"^[-–—:]\s*", "", text)
    item = {"lead": lead, "text": text}
    if note:
        item["note"] = note
    return item


def parse_card(card: Tag) -> dict:
    tag = card.find(class_="card-tag")
    return {
        "tag": clean(tag.get_text()) if tag else "",
        "title": clean(card.find("h3").get_text()),
        "summary": clean(card.find(class_="card-sub").get_text()),
        "items": [parse_item(li) for li in card.select("ul.item-list > li")],
    }


def pre_lines(pre: Tag) -> list[Tag]:
    """Split a <pre> into per-line soups so span classes stay available."""
    html = pre.decode_contents()
    return [BeautifulSoup(line, "html.parser") for line in html.split("\n")]


def parse_matrix(block: Tag) -> dict:
    title = clean(block.find("h4").get_text())
    groups: list[dict] = []
    for line in pre_lines(block.find("pre")):
        text = line.get_text()
        if not text.strip():
            continue
        spans = line.find_all("span")
        first = spans[0] if spans else None
        if first and "k" in first.get("class", []) and not re.match(r"^\s*[├└]", text):
            note = line.find("span", class_="cm")
            groups.append(
                {
                    "heading": clean(first.get_text()),
                    "note": clean(note.get_text()).strip("()") if note else None,
                    "rows": [],
                }
            )
            continue
        label_el = next(
            (s for s in spans if set(s.get("class", [])) & {"v", "ok", "wn", "er"}), None
        )
        if not label_el:
            continue
        label = clean(label_el.get_text())
        tone = next((TONE_BY_CLASS[c] for c in label_el.get("class", []) if c in TONE_BY_CLASS), None)
        rest = text.split(label_el.get_text(), 1)[1]
        row = {"label": label, "value": clean(rest)}
        if tone:
            row["tone"] = tone
        if not groups:
            groups.append({"heading": title, "note": None, "rows": []})
        groups[-1]["rows"].append(row)
    return {"title": title, "groups": groups}


def parse_queries(block: Tag) -> list[dict]:
    """Split a hunt-query block into one entry per `// Hunt:` comment."""
    text = block.find("pre").get_text()
    queries: list[dict] = []
    for chunk in re.split(r"\n(?=// )", text.strip("\n")):
        lines = chunk.strip("\n").split("\n")
        title = lines[0].lstrip("/ ").strip()
        title = re.sub(r"^Hunt:\s*", "", title)
        queries.append({"title": title, "language": "spl", "code": "\n".join(lines[1:]).strip()})
    return queries


def parse_section(sec: Tag) -> dict:
    head = sec.find(class_="section-head")
    out: dict = {
        "id": sec["id"],
        "eyebrow": clean(head.find(class_="section-eyebrow").get_text()),
        "title": clean(head.find(class_="section-title").get_text()),
        "description": clean(head.find(class_="section-desc").get_text()),
        "callouts": [],
        "matrices": [],
        "queries": [],
        "cards": [],
    }
    if sec["id"] in SPECIAL:
        return out
    for callout in sec.find_all(class_="callout"):
        tone = next((TONE_BY_CALLOUT[c] for c in callout["class"] if c in TONE_BY_CALLOUT), "info")
        title_el = callout.find(class_="callout-title")
        title = clean(title_el.get_text())
        body_div = title_el.parent
        title_el.extract()
        out["callouts"].append({"tone": tone, "title": title, "body": clean(body_div.get_text())})
    for block in sec.find_all(class_="mono-block"):
        if "Hunt Queries" in block.find("h4").get_text():
            out["queries"].extend(parse_queries(block))
        else:
            out["matrices"].append(parse_matrix(block))
    out["cards"] = [parse_card(c) for c in sec.find_all(class_="card")]
    return out


def parse_techniques(sec: Tag) -> list[dict]:
    rows = []
    for tr in sec.select("tbody tr"):
        tds = tr.find_all("td")
        rows.append(
            {
                "name": clean(tds[0].get_text()),
                "detection": clean(tds[1].get_text()),
                "severity": {"CRIT": "critical", "HIGH": "high", "MED": "medium", "LOW": "low"}[
                    clean(tds[2].get_text())
                ],
                "response": clean(tds[3].get_text()),
            }
        )
    return rows


def parse_events(sec: Tag) -> list[dict]:
    events = []
    for block in sec.find_all(class_="mono-block"):
        source = "sysmon" if "Sysmon" in block.find("h4").get_text() else "security"
        category = "Sysmon" if source == "sysmon" else ""
        for line in pre_lines(block.find("pre")):
            text = line.get_text()
            if not text.strip():
                continue
            k = line.find("span", class_="k")
            if k:
                category = clean(k.get_text()).title().replace("&", "&")
                continue
            m = re.match(r"\s*(\d+)\s+(.+)$", text)
            if not m:
                continue
            event_id, rest = int(m.group(1)), m.group(2)
            # A few names run into the description column with a single space.
            fixed = NAME_OVERRIDES.get((source, event_id))
            if fixed and rest.startswith(fixed):
                name, description = fixed, rest[len(fixed):]
            else:
                name, _, description = re.split(r"(\s{2,})", rest, maxsplit=1)
            id_el = line.find("span")
            tone = next((TONE_BY_CLASS[c] for c in id_el.get("class", []) if c in TONE_BY_CLASS), "warn")
            events.append(
                {
                    "id": event_id,
                    "source": source,
                    "category": category,
                    "name": clean(name),
                    "description": clean(description),
                    "signal": tone,
                }
            )
    return events


def parse_tools(sec: Tag) -> list[dict]:
    tools = []
    category = ""
    for line in pre_lines(sec.find("pre")):
        text = line.get_text()
        if not text.strip():
            continue
        k = line.find("span", class_="k")
        if k:
            category = clean(k.get_text())
            continue
        desc_el = line.find("span", class_="cm")
        if not desc_el:
            continue
        desc = clean(desc_el.get_text())
        label = clean(text.split(desc_el.get_text(), 1)[0])
        names = [clean(v.get_text()) for v in line.find_all("span", class_="v")]
        tools.append({"category": category, "label": label, "names": names, "description": desc})
    return tools


def main() -> None:
    soup = BeautifulSoup(SRC.read_text(encoding="utf-8"), "html.parser")
    sections = soup.find_all("section", class_="section")
    by_id = {s["id"]: s for s in sections}
    OUT.mkdir(parents=True, exist_ok=True)

    def dump(name: str, data) -> None:
        (OUT / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    dump("sections.json", [parse_section(s) for s in sections])
    dump("techniques.json", parse_techniques(by_id["technique-detect"]))
    dump("events.json", parse_events(by_id["event-ids"]))
    dump("tools.json", parse_tools(by_id["tools"]))
    print(f"Extracted {len(sections)} sections into {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
