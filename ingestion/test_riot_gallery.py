import json
import unittest

from import_cards import build_snapshot
from riot_gallery import gallery_records, flatten_gallery, plain_text


def card(**changes):
    record = {
        "id": "RAD-001-167", "publicCode": "RAD-001/167", "name": "Ahri", "subtitle": "Alluring",
        "set": {"value": {"id": "RAD"}}, "cardType": {"type": [{"label": "Unit"}], "superType": [{"label": "Champion"}]},
        "domain": {"values": [{"label": "Mind"}]}, "energy": {"value": {"label": "0"}},
        "might": {"value": {"label": "4"}}, "power": None, "rarity": {"value": {"label": "Rare"}},
        "text": {"richText": {"body": "<p>Draw 1.<br />Pay :rb_energy_2: &amp; :rb_rune_mind:.</p><p>+1 :rb_might:</p>"}},
        "cardImage": {"url": "https://example.invalid/card.png"},
    }
    record.update(changes)
    return record


def page(records):
    return "<html><script type='application/json' id='__NEXT_DATA__'>" + json.dumps({"props": {"pageProps": {"blades": [{"cards": {"items": records}}]}}}) + "</script></html>"


class RiotGalleryTest(unittest.TestCase):
    def test_subtitles_champion_metadata_symbols_and_no_images(self):
        snapshot = build_snapshot(gallery_records(page([card()])), "riot-gallery")
        result = snapshot["cards"][0]
        self.assertEqual(result["name"], "Ahri, Alluring")
        self.assertEqual(result["id"], "rad-001-167")
        self.assertEqual(result["supertype"], "Champion")
        self.assertEqual(result["cost"], 0)
        self.assertIsNone(result["power"])
        self.assertEqual(result["might"], 4)
        self.assertEqual(result["text"], "Draw 1.\nPay {energy:2} & {power:mind}.\n+1 {might}")
        self.assertNotIn("image", json.dumps(snapshot).lower())
        self.assertEqual(flatten_gallery(card(name="Ahri, Alluring"))["name"], "Ahri, Alluring")
        self.assertEqual(flatten_gallery(card(subtitle=None))["name"], "Ahri")

    def test_identical_duplicates_deduplicated_but_conflicts_and_missing_data_fail(self):
        self.assertEqual(len(gallery_records(page([card(), card()]))), 1)
        for body in (page([card(), card(name="Different")]), '<html></html>', page([]), '<script id="__NEXT_DATA__">invalid</script>'):
            with self.assertRaises(ValueError):
                gallery_records(body)

    def test_variants_filtered_and_additions_only_preserves_existing_details(self):
        base = card()
        flattened = flatten_gallery(base)
        previous = build_snapshot([flattened], "gallery-dataset")
        snapshot = build_snapshot([base, card(id="alt", publicCode="RAD-001a/167"), card(id="signed", publicCode="RAD-179*/167")], "riot-gallery", previous, additions_only=True)
        self.assertEqual(snapshot["excludedVariants"], 2)
        self.assertEqual(snapshot["cards"][0]["version"], 1)
        self.assertEqual(snapshot["cards"][0]["createdAt"], previous["cards"][0]["createdAt"])
        self.assertEqual(snapshot["cards"][0], previous["cards"][0])
        expanded = build_snapshot([card(id="rad-002-167")], "riot-gallery", previous, additions_only=True)
        self.assertEqual(len(expanded["cards"]), 2)
        self.assertIn(previous["cards"][0], expanded["cards"])
        self.assertEqual(flatten_gallery(card(subtitle="Annie", cardType={"type": [{"label": "Unit"}], "superType": [{"label": "Signature"}]}))["name"], "Ahri")
        self.assertEqual(flatten_gallery(card(subtitle="Starter"))["name"], "Ahri - Starter")
        updated = build_snapshot([card(subtitle="Changed")], "riot-gallery", snapshot)
        self.assertEqual(updated["cards"][0]["version"], 2)

    def test_invalid_cost_and_conflicting_normalized_ids_are_rejected(self):
        with self.assertRaises(ValueError):
            build_snapshot([card(energy={"value": {"label": "unknown"}})], "riot-gallery")
        with self.assertRaises(ValueError):
            build_snapshot([card(), card()], "riot-gallery")
        self.assertEqual(plain_text("<p>:rb_exhaust: :rb_rune_rainbow:</p>"), "{exhaust} {power:any}")


if __name__ == "__main__":
    unittest.main()
