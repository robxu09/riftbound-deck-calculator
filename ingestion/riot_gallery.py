"""Read card details embedded in Riot's public gallery; no images are downloaded."""
import html
import json
import re
from html.parser import HTMLParser
from urllib.request import Request, urlopen

GALLERY_URL = "https://playriftbound.com/en-us/card-gallery/"


class PageDataParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.collecting = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "script" and dict(attrs).get("id") == "__NEXT_DATA__":
            self.collecting = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.collecting = False

    def handle_data(self, data):
        if self.collecting:
            self.parts.append(data)


def gallery_records(page):
    parser = PageDataParser()
    parser.feed(page)
    if not parser.parts:
        raise ValueError("Gallery page data not found; the page structure may have changed")
    data = json.loads("".join(parser.parts))
    candidates = []

    def walk(node):
        if isinstance(node, list):
            if node and isinstance(node[0], dict) and "publicCode" in node[0]:
                candidates.append(node)
            else:
                for item in node:
                    walk(item)
        elif isinstance(node, dict):
            for item in node.values():
                walk(item)

    walk(data.get("props", data))
    if len(candidates) != 1:
        raise ValueError("Expected exactly one gallery card list")
    # The gallery sometimes repeats the exact same record. Conflicting IDs fail.
    unique = {}
    for card in candidates[0]:
        key = card["id"].lower()
        if key in unique and unique[key] != card:
            raise ValueError(f"Conflicting gallery records for {key}")
        unique[key] = card
    return list(unique.values())


def fetch_gallery():
    request = Request(GALLERY_URL, headers={"User-Agent": "RiftboundDeckCatalog/0.1"})
    with urlopen(request, timeout=30) as response:
        return gallery_records(response.read().decode("utf-8"))


def value(record, *keys):
    for key in keys:
        if not isinstance(record, dict):
            return None
        record = record.get(key)
    return record


def plain_text(body):
    if not isinstance(body, str):
        raise ValueError("Invalid gallery card text")
    text = re.sub(r"<br\s*/?>", "\n", body, flags=re.I)
    text = re.sub(r"</p>\s*<p>", "\n", text, flags=re.I)
    text = html.unescape(re.sub(r"</?[a-zA-Z][^>]*>", "", text))
    symbols = {":rb_might:": "{might}", ":rb_exhaust:": "{exhaust}", ":rb_rune_rainbow:": "{power:any}"}
    symbols.update({f":rb_rune_{domain}:": "{power:" + domain + "}" for domain in ("fury", "calm", "mind", "body", "chaos", "order")})
    for token, replacement in symbols.items():
        text = text.replace(token, replacement)
    text = re.sub(r":rb_energy_(\d+):", lambda match: "{energy:" + match[1] + "}", text)
    return "\n".join(line.strip() for line in text.splitlines() if line.strip())


def flatten_gallery(record):
    # Keep the dataset's printing-ID and variant convention for saved-deck compatibility.
    code = record["publicCode"]
    suffix = code.split("/")[0].split("-", 1)[-1]
    alternate = bool(re.fullmatch(r"\d+[a-z]", suffix))
    signed = "*" in code
    name = record["name"]
    subtitle = record.get("subtitle")
    # Signature subtitles identify the associated champion, not part of the card name.
    supertypes = [item["label"] for item in (value(record, "cardType", "superType") or [])]
    if subtitle and "Signature" not in supertypes:
        separator = " - " if subtitle == "Starter" else ", "
        if not name.endswith(separator + subtitle):
            name += separator + subtitle
    return {
        "id": record["id"], "name": name,
        "set": value(record, "set", "value", "id"),
        "type": " / ".join(item["label"] for item in (value(record, "cardType", "type") or [])),
        "supertype": " / ".join(item["label"] for item in (value(record, "cardType", "superType") or [])) or None,
        "domains": [item["label"] for item in (value(record, "domain", "values") or [])],
        "rarity": value(record, "rarity", "value", "label"),
        "energy": value(record, "energy", "value", "label"),
        "power": value(record, "power", "value", "label"),
        "might": value(record, "might", "value", "label"),
        "text": plain_text(value(record, "text", "richText", "body") or ""),
        "isVariant": alternate or signed, "isAltArt": alternate, "isSigned": signed,
    }
