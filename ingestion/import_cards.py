"""Import text-only card details; Python standard library, no API key required."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile
from datetime import datetime, timezone
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "apps/api/src/main/resources/catalog/cards.json"
DATASET_URL = "https://raw.githubusercontent.com/slimtreble/Riftbound-card-data/main/cards.json"
RIFTCODEX_URL = "https://api.riftcodex.com/cards"


def fetch_json(url):
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "RiftboundDeckCatalog/0.1"})
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def fetch_riftcodex(fetch=fetch_json):
    records = []
    page = 1
    seen = set()
    while True:
        response = fetch(f"{RIFTCODEX_URL}?page={page}&size=100")
        items = response["items"]
        if not isinstance(items, list):
            raise ValueError("Expected a paginated items array from Riftcodex")
        for item in items:
            if item["id"] in seen:
                raise ValueError("Duplicate Riftcodex record across pages; retry the import")
            seen.add(item["id"])
        records.extend(items)
        if len(records) == response["total"]:
            return records
        if not items or len(records) > response["total"]:
            raise ValueError("Incomplete or inconsistent Riftcodex pagination")
        page += 1
        if page > 1000:
            raise ValueError("Riftcodex pagination exceeded safety limit")


def number(value):
    if value is None or value == "":
        return None
    if isinstance(value, bool) or not str(value).isdigit():
        raise ValueError(f"Unsupported numeric card attribute: {value!r}")
    return int(value)


def normalize(record, source):
    if source == "riftcodex":
        meta = record["metadata"]
        if meta["alternate_art"] or meta["signature"]:
            return None
        attributes = record["attributes"]
        classification = record["classification"]
        card = {
            "id": record["riftbound_id"].lower(), "name": record["name"],
            "type": classification["type"], "supertype": classification.get("supertype"),
            "cost": number(attributes.get("energy")), "power": number(attributes.get("power")),
            "might": number(attributes.get("might")), "domains": classification["domain"],
            "rarity": classification["rarity"], "text": record["text"]["plain"],
            "setCode": record["set"]["set_id"], "sourceId": record["id"],
            "sourceUpdatedAt": meta["updated_on"],
        }
    else:
        if record["isVariant"] or record["isAltArt"] or record["isSigned"]:
            return None
        card = {
            "id": record["id"].lower(), "name": record["name"], "type": record["type"] or "Unknown",
            "supertype": None, "cost": number(record.get("energy")),
            "power": number(record.get("power")), "might": number(record.get("might")),
            "domains": record["domains"], "rarity": record["rarity"], "text": record["text"],
            "setCode": record["set"], "sourceId": record["id"], "sourceUpdatedAt": None,
        }
    for field in ("id", "name", "type", "setCode", "sourceId"):
        if not isinstance(card[field], str) or not card[field].strip():
            raise ValueError(f"Missing card field: {field}")
    if not isinstance(card["text"], str) or not isinstance(card["domains"], list):
        raise ValueError("Invalid text or domains")
    if not all(isinstance(domain, str) for domain in card["domains"]):
        raise ValueError("Invalid domain value")
    card["source"] = source
    card["contentHash"] = hashlib.sha256(json.dumps(card, sort_keys=True).encode()).hexdigest()
    return card


def build_snapshot(records, source, previous=None):
    if not isinstance(records, list) or not records:
        raise ValueError("Refusing to import an empty or invalid catalog")
    now = datetime.now(timezone.utc).isoformat()
    old = {card["id"]: card for card in (previous or {}).get("cards", [])}
    cards = {}
    for record in records:
        card = normalize(record, source)
        if card is None:
            continue
        if card["id"] in cards:
            raise ValueError(f"Duplicate card ID: {card['id']}")
        prior = old.get(card["id"])
        card["version"] = (prior["version"] + (prior["contentHash"] != card["contentHash"])) if prior else 1
        card["createdAt"] = prior["createdAt"] if prior else now
        cards[card["id"]] = card
    if not cards:
        raise ValueError("No base printings found")
    return {
        "schemaVersion": 1, "source": source,
        "sourceUrl": RIFTCODEX_URL if source == "riftcodex" else DATASET_URL,
        "fetchedAt": now, "textStatus": "unverified-errata" if source == "riftcodex" else "printed",
        "sourceRecordCount": len(records), "excludedVariants": len(records) - len(cards),
        "cards": sorted(cards.values(), key=lambda card: (card["name"], card["id"])),
    }


def write_snapshot(snapshot, output):
    output.parent.mkdir(parents=True, exist_ok=True)
    # Replace only after the entire download and validation succeed.
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=output.parent, delete=False) as handle:
            temp_path = Path(handle.name)
            json.dump(snapshot, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temp_path, output)
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", choices=["gallery-dataset", "riftcodex"], default="gallery-dataset")
    parser.add_argument("--input", type=Path, help="Import a previously downloaded JSON array, without network access")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    try:
        records = json.loads(args.input.read_text(encoding="utf-8-sig")) if args.input else (
            fetch_riftcodex() if args.source == "riftcodex" else fetch_json(DATASET_URL)
        )
        previous = json.loads(args.output.read_text(encoding="utf-8")) if args.output.exists() else None
        snapshot = build_snapshot(records, args.source, previous)
        write_snapshot(snapshot, args.output)
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(1, f"Card import failed; existing snapshot was not replaced: {error}\n")
    print(f"Imported {len(snapshot['cards'])} cards; excluded {snapshot['excludedVariants']} variants. {args.output}")


if __name__ == "__main__":
    main()
