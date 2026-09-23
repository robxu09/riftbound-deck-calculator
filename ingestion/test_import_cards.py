import json
from pathlib import Path
import tempfile
import unittest

from import_cards import build_snapshot, fetch_riftcodex, write_snapshot


def record(**changes):
    return dict(id="ogn-001-298", name="Example", type="Unit", energy="0", power=None,
                might="5", domains=["Fury"], rarity="Common", text="Printed text",
                set="OGN", isVariant=False, isAltArt=False, isSigned=False,
                imageUrl="https://example.invalid/art.png", **changes)


class ImportCardsTest(unittest.TestCase):
    def test_details_preserve_zero_null_and_exclude_images_and_variants(self):
        variant = record()
        variant.update(id="alternate", isVariant=True)
        snapshot = build_snapshot([record(), variant], "gallery-dataset")
        self.assertEqual(snapshot["excludedVariants"], 1)
        card = snapshot["cards"][0]
        self.assertEqual(card["cost"], 0)
        self.assertIsNone(card["power"])
        self.assertNotIn("image", json.dumps(snapshot).lower())

    def test_reimport_keeps_revision_and_changed_text_increments_it(self):
        first = build_snapshot([record()], "gallery-dataset")
        same = build_snapshot([record()], "gallery-dataset", first)
        changed = record()
        changed["text"] = "Changed text"
        updated = build_snapshot([changed], "gallery-dataset", same)
        self.assertEqual(same["cards"][0]["version"], 1)
        self.assertEqual(updated["cards"][0]["version"], 2)
        self.assertEqual(first["cards"][0]["createdAt"], updated["cards"][0]["createdAt"])

    def test_invalid_records_do_not_replace_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cards.json"
            first = build_snapshot([record()], "gallery-dataset")
            write_snapshot(first, path)
            before = path.read_bytes()
            for records in ([], [record(), record()]):
                with self.assertRaises(ValueError):
                    write_snapshot(build_snapshot(records, "gallery-dataset"), path)
                self.assertEqual(path.read_bytes(), before)

    def test_unknown_type_is_explicit_and_invalid_cost_is_rejected(self):
        incomplete = record()
        incomplete["type"] = ""
        self.assertEqual(build_snapshot([incomplete], "gallery-dataset")["cards"][0]["type"], "Unknown")
        incomplete["energy"] = "not a cost"
        with self.assertRaises(ValueError):
            build_snapshot([incomplete], "gallery-dataset")

    def test_riftcodex_pagination_and_repeated_page_detection(self):
        responses = iter([{"items": [{"id": "a"}], "total": 2}, {"items": [{"id": "b"}], "total": 2}])
        self.assertEqual(len(fetch_riftcodex(lambda _: next(responses))), 2)
        with self.assertRaises(ValueError):
            fetch_riftcodex(lambda _: {"items": [{"id": "a"}], "total": 2})

    def test_riftcodex_mapping(self):
        item = {
            "id": "source-id", "riftbound_id": "OGN-001-298", "name": "Example",
            "attributes": {"energy": 0, "power": 1, "might": 2},
            "classification": {"type": "Unit", "supertype": "Champion", "domain": ["Fury"], "rarity": "Rare"},
            "text": {"plain": "Example text"}, "set": {"set_id": "OGN"},
            "metadata": {"alternate_art": False, "signature": False, "updated_on": "2026-09-22T00:00:00Z"},
        }
        card = build_snapshot([item], "riftcodex")["cards"][0]
        self.assertEqual(card["id"], "ogn-001-298")
        self.assertEqual(card["supertype"], "Champion")
        self.assertEqual(card["sourceId"], "source-id")


if __name__ == "__main__":
    unittest.main()
