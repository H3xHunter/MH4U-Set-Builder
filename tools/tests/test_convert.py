import contextlib
import io
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import convert  # noqa: E402

SCHEMA = """
create table items(_id integer primary key, name text, type text, sub_type text default '', rarity integer default 1);
create table armor(_id integer primary key, slot text, defense int, max_defense int, fire_res int, thunder_res int,
  dragon_res int, water_res int, ice_res int, gender text, hunter_type text, num_slots int);
create table decorations(_id integer primary key, num_slots int);
create table skill_trees(_id integer primary key, name text);
create table skills(_id integer primary key, skill_tree_id int, required_skill_tree_points int, name text, description text);
create table item_to_skill_tree(_id integer primary key, item_id int, skill_tree_id int, point_value int);
create table components(_id integer primary key, created_item_id int, component_item_id int, quantity int, type text);
create table weapons(_id integer primary key, parent_id int, wtype text, attack int, max_attack, element text,
  element_attack, element_2 text, element_2_attack, awaken text, awaken_attack, defense int, sharpness text,
  affinity text, horn_notes text, shelling_type text, phial text, charges text, coatings text, recoil text,
  reload_speed text, rapid_fire text, deviation text, ammo text, special_ammo text, num_slots int, tree_depth int, final int);
create table horn_melodies(_id integer primary key, notes text, song text, effect1 text, effect2 text, duration text, extension text);
create table hunting_rewards(_id integer primary key, item_id int, condition text, monster_id int, rank text, stack_size int, percentage);
create table gathering(_id integer primary key, item_id int, location_id int, area text, site text, rank text, quantity, percentage);
create table monsters(_id integer primary key, class text, name text);
create table monster_damage(_id integer primary key, monster_id int, body_part text, cut, impact, shot, fire, water, ice, thunder, dragon, ko);
create table locations(_id integer primary key, name text);
create table quests(_id integer primary key, name text, hub text, type text, stars int);
create table quest_rewards(_id integer primary key, quest_id int, item_id int, reward_slot text, percentage int, stack_size int);
create table arena_quests(_id integer primary key, name text);
create table arena_rewards(_id integer primary key, arena_id int, item_id int, percentage int, stack_size int);
create table combining(_id integer primary key, created_item_id int, item_1_id int, item_2_id int, amount_made_min int, amount_made_max int, percentage int);
create table veggie_elder(_id integer primary key, location_id int, offer_item_id int, receive_item_id int, quantity int);
create table wyporium(_id integer primary key, item_in_id int, item_out_id int, unlock_quest_id int);
"""
SHARP = "5.10.13.18.14.2.0 5.10.13.18.14.6.3"


def make_db(path, mutate=None):
    c = sqlite3.connect(path)
    c.executescript(SCHEMA)
    c.executemany("insert into skill_trees values(?,?)", [(1, "Torso Up"), (2, "Attack"), (3, "Stun")])
    c.executemany("insert into skills values(?,?,?,?,?)", [
        (1, 1, 1, "Torso Up", ""), (2, 2, 20, "Attack Up (L)", "Greatly"), (3, 2, -10, "Attack Down (S)", ""),
        (4, 2, 10, "Attack Up (S)", "Slightly")])
    c.executemany("insert into items values(?,?,?,?,?)", [
        (10, "Ore", "Ore", "", 2), (11, "Scale", "Scale", "", 3),
        (20, "Rathalos Mail", "Armor", "Body", 5), (21, "Plain Cap", "Armor", "Head", 1),
        (22, "Odd Earring", "Armor", "Head", 1), (23, "Alloy Greaves", "Armor", "Legs", 4),
        (12, "Dust", "Ore", "", 1), (13, "Gem", "Ore", "", 1),
        (50, "Ingredient A", "Bug", "", 1), (51, "Ingredient B", "Bug", "", 1),
        (52, "Veggie Offer", "Plant", "", 1), (53, "Counterpart", "Flesh", "", 2),
        (30, "Attack Jewel 2", "Decoration", "", 3),
        (40, "Great Blade", "Weapon", "Great Sword", 5), (41, "Blank Blade", "Weapon", "Great Sword", 5),
        (42, "Split Blade", "Weapon", "Great Sword", 5), (43, "Bad Sharp", "Weapon", "Great Sword", 5),
        (44, "Horn", "Weapon", "Hunting Horn", 5)])
    c.executemany("insert into armor values(?,?,?,?,?,?,?,?,?,?,?,?)", [
        (20, "Body", 23, 125, 2, -2, -3, 0, 1, "Both", "Blade", 0),
        (21, "Head", 1, 71, -1, 0, 1, 0, 0, "Both", "Both", 1),
        (22, "Head", 34, 81, 0, 0, 0, 0, 0, "", "", 0),
        (23, "Legs", 8, 114, 0, 0, 0, 0, 0, "Female", "Gunner", 2)])
    c.executemany("insert into decorations values(?,?)", [(30, 2)])
    c.executemany("insert into item_to_skill_tree(item_id,skill_tree_id,point_value) values(?,?,?)", [
        (20, 2, 2), (20, 3, -2), (23, 1, 1), (23, 2, 0), (30, 2, 1), (30, 3, -1)])
    c.executemany("insert into components(created_item_id,component_item_id,quantity,type) values(?,?,?,?)", [
        (20, 10, 3, "Create"), (20, 11, 2, "Create A"), (23, 11, 1, "Improve"),
        (21, 12, 1, "Create"), (21, 13, 1, "Create")])
    c.execute("insert into quests values(1,'Quest One','Guild','Normal',7)")
    c.execute("insert into quests values(2,'Unused Quest','Caravan','Key',1)")
    c.execute("insert into quest_rewards(quest_id,item_id,reward_slot,percentage,stack_size) values(1,11,'A',50,1)")
    c.execute("insert into arena_quests values(1,'Arena One')")
    c.execute("insert into arena_rewards(arena_id,item_id,percentage,stack_size) values(1,11,35,2)")
    c.execute("insert into combining(created_item_id,item_1_id,item_2_id,amount_made_min,amount_made_max,percentage) values(11,50,51,1,2,95)")
    c.execute("insert into veggie_elder(location_id,offer_item_id,receive_item_id,quantity) values(5,52,11,3)")
    c.executemany("insert into wyporium(item_in_id,item_out_id,unlock_quest_id) values(?,?,?)",
                  [(11, 10, 1), (53, 11, 1), (12, 12, 1)])
    c.executemany("insert into weapons values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
        (40, None, "Great Sword", 1248, "", "Fire", 300, "", "", "Ice", 410, 40, SHARP, "10", "", "", "", "", "", "", "", "", "", "", "", 3, 9, 1),
        (41, 0, "Great Sword", 100, "", "", "", "", "", "", "", 0, SHARP, "", "", "", "", "", "", "", "", "", "", "", "", 2, 1, 0),
        (42, 40, "Great Sword", 100, 120, "", "", "", "", "", "", 0, "", "-45/20", "", "", "", "", "", "", "", "", "", "", "", 0, 1, 0),
        (43, 40, "Great Sword", 100, "", "", "", "", "", "", "", 0, "1.2.3 4.5.6", "-5", "", "", "", "", "", "", "", "", "", "", "", 0, 1, 0),
        (44, None, "Hunting Horn", 100, "", "", "", "", "", "", "", 0, SHARP, "5", "PBR", "", "", "", "", "", "", "", "", "", "", 1, 1, 1)])
    c.executemany("insert into horn_melodies(notes,song,effect1,effect2,duration,extension) values(?,?,?,?,?,?)",
                  [("WBR", "WW", "Speed", "", "180", "+90")])
    c.executemany("insert into hunting_rewards(item_id,condition,monster_id,rank,stack_size,percentage) values(?,?,?,?,?,?)",
                  [(10, "Body Carve", 1, "HR", 1, 30), (10, "Shiny Drop", 1, "G", 1, "")])
    c.executemany("insert into gathering(item_id,location_id,area,site,rank,quantity,percentage) values(?,?,?,?,?,?,?)",
                  [(10, 5, "Camp", "Mine", "LR", 1, 36)])
    c.executemany("insert into monsters values(?,?,?)", [(1, "Boss", "Rathalos"), (2, "Boss", "Unused")])
    c.executemany("insert into monster_damage(monster_id,body_part,cut,impact,shot,fire,water,ice,thunder,dragon,ko) values(?,?,?,?,?,?,?,?,?,?,?)",
                  [(1, "Head", 60, 60, 60, 10, 15, 40, 30, 0, 100)])
    c.executemany("insert into locations values(?,?)", [(5, "Forest"), (6, "Unused")])
    if mutate:
        mutate(c)
    c.commit()
    c.close()


class Base(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.tmp = Path(self._tmp.name)

    def run_convert(self, mutate=None, out="out"):
        db = self.tmp / "t.db"
        if not db.exists():
            make_db(db, mutate)
        counts, warnings, no_src = convert.convert(db, self.tmp / out, "http://x", "abc")
        self.warnings, self.no_src = warnings, no_src
        return {p.stem: json.loads(p.read_text("utf-8")) for p in (self.tmp / out).glob("*.json")}


class ConvertTests(Base):
    def test_torso_up(self):
        d = self.run_convert()
        self.assertNotIn("Torso Up", [t["name"] for t in d["skills"]])
        self.assertEqual(d["meta"]["torsoUpTreeId"], 1)
        by = {a["id"]: a for a in d["armor"]}
        self.assertTrue(by[23]["torsoUp"])
        self.assertFalse(by[20]["torsoUp"])
        self.assertNotIn("1", by[23]["skills"])
        self.assertNotIn("2", by[23]["skills"])  # zero points dropped

    def test_torso_up_missing_or_duplicated_fails(self):
        for sql in ("delete from skill_trees where name='Torso Up'",
                    "insert into skill_trees values(9,'Torso Up')"):
            with self.subTest(sql=sql):
                self.tmp = Path(tempfile.mkdtemp(dir=self.tmp))
                with self.assertRaises(convert.ConvertError):
                    self.run_convert(lambda c, s=sql: c.execute(s))

    def test_tiers_sorted_with_negatives(self):
        d = self.run_convert()
        atk = next(t for t in d["skills"] if t["name"] == "Attack")
        self.assertEqual([t["points"] for t in atk["tiers"]], [-10, 10, 20])
        self.assertIsNone(atk["tiers"][0]["description"])

    def test_negative_points_kept(self):
        d = self.run_convert()
        self.assertEqual({a["id"]: a for a in d["armor"]}[20]["skills"], {"2": 2, "3": -2})
        self.assertEqual(d["decorations"][0]["skills"], {"2": 1, "3": -1})
        self.assertEqual(d["decorations"][0]["size"], 2)

    def test_slot_mapping_and_blank_to_null(self):
        d = self.run_convert()
        by = {a["id"]: a for a in d["armor"]}
        self.assertEqual(by[20]["slot"], "chest")
        self.assertEqual(by[23]["slot"], "legs")
        self.assertEqual((by[23]["gender"], by[23]["hunterType"]), ("female", "gunner"))
        self.assertEqual((by[22]["gender"], by[22]["hunterType"]), (None, None))
        self.assertTrue(any("Odd Earring" in w for w in self.warnings))
        self.assertEqual(by[20]["res"], {"fire": 2, "water": 0, "thunder": -2, "ice": 1, "dragon": -3})

    def test_unknown_slot_fails(self):
        with self.assertRaises(convert.ConvertError):
            self.run_convert(lambda c: c.execute("update armor set slot='Hat' where _id=21"))

    def test_sharpness(self):
        self.assertEqual(convert.parse_sharpness(SHARP),
                         {"base": [5, 10, 13, 18, 14, 2, 0], "plus": [5, 10, 13, 18, 14, 6, 3]})
        self.assertIsNone(convert.parse_sharpness("1.2.3 4.5.6"))
        d = self.run_convert()
        by = {w["id"]: w for w in d["weapons"]}
        self.assertEqual(by[40]["sharpness"]["plus"][5], 6)
        self.assertIsNone(by[42]["sharpness"])  # blank
        self.assertIsNone(by[43]["sharpness"])  # malformed
        self.assertTrue(any("Bad Sharp" in w and "sharpness" in w for w in self.warnings))

    def test_affinity_in_output(self):
        d = self.run_convert()
        by = {w["id"]: w for w in d["weapons"]}
        self.assertEqual((by[40]["affinity"], by[40]["affinityOptions"]), (10, None))
        self.assertEqual((by[41]["affinity"], by[41]["affinityOptions"]), (0, None))  # blank
        self.assertEqual((by[42]["affinity"], by[42]["affinityOptions"]), (None, [-45, 20]))
        self.assertEqual((by[43]["affinity"], by[43]["affinityOptions"]), (-5, None))
        self.assertTrue(all("affinityRaw" not in w for w in by.values()))
        self.assertFalse(any("affinity" in w for w in self.warnings))

    def test_parse_affinity(self):
        pa = lambda s: convert.parse_affinity(s, "x")
        self.assertEqual(pa("10"), (10, None))
        self.assertEqual(pa("-15"), (-15, None))
        self.assertEqual(pa(""), (0, None))
        self.assertEqual(pa(None), (0, None))
        self.assertEqual(pa("-30/10"), (None, [-30, 10]))
        self.assertEqual(pa("20/-5"), (None, [20, -5]))
        for bad in ("1/2/3", "abc", "10%", "1/", "/2", "1.5"):
            with self.subTest(bad=bad), self.assertRaises(convert.ConvertError):
                pa(bad)

    def test_unparsable_affinity_fails(self):
        for v in ("abc", "1/2/3"):
            with self.subTest(v=v), self.assertRaises(convert.ConvertError):
                self.tmp = Path(tempfile.mkdtemp(dir=self.tmp))
                self.run_convert(lambda c, v=v: c.execute("update weapons set affinity=? where _id=40", (v,)))

    def test_weapon_fields(self):
        d = self.run_convert()
        by = {w["id"]: w for w in d["weapons"]}
        w = by[40]
        self.assertEqual(w["element"], {"type": "Fire", "value": 300})
        self.assertEqual(w["awaken"], {"type": "Ice", "value": 410})
        self.assertIsNone(w["element2"])
        self.assertIsNone(w["maxAttack"])
        self.assertEqual(by[42]["maxAttack"], 120)
        self.assertEqual((w["defenseBonus"], w["final"], w["parentId"]), (40, True, None))
        self.assertEqual(by[44]["hornNotes"], "PBR")
        self.assertIsNone(w["hornNotes"])
        self.assertTrue(all(v is None for v in w["extra"].values()))
        self.assertEqual(len(w["extra"]), 10)

    def test_materials_link_to_drops_with_rank(self):
        d = self.run_convert()
        a = {x["id"]: x for x in d["armor"]}[20]
        self.assertEqual(a["materials"], [{"itemId": 10, "quantity": 3, "kind": "create"},
                                          {"itemId": 11, "quantity": 2, "kind": "createA"}])
        m = {x["id"]: x for x in d["materials"]}
        self.assertEqual(sorted(m), [10, 11, 12, 13])
        self.assertEqual([x["rank"] for x in m[10]["drops"]], ["HR", "G"])
        self.assertIsNone(m[10]["drops"][1]["percentage"])  # '' -> null
        self.assertEqual(m[10]["gathering"][0]["locationId"], 5)
        self.assertEqual(self.no_src, [13])
        self.assertEqual([l["id"] for l in d["locations"]], [5])
        self.assertEqual(len(d["monsters"]), 2)
        self.assertEqual(d["monsters"][0]["hitzones"][0]["part"], "Head")
        self.assertEqual(d["horn"][0]["effect2"], None)

    def test_sources(self):
        d = self.run_convert()
        m = {x["id"]: x for x in d["materials"]}
        s = m[11]["sources"]
        self.assertEqual(s["quests"], [{"questId": 1, "slot": "A", "percentage": 50, "stackSize": 1}])
        self.assertEqual(s["arena"], [{"arenaQuestId": 1, "percentage": 35, "stackSize": 2}])
        self.assertEqual(s["combining"], [{"item1Id": 50, "item2Id": 51, "amountMin": 1, "amountMax": 2, "percentage": 95}])
        self.assertEqual(s["veggieElder"], [{"offerItemId": 52, "quantity": 3}])
        # wyporium: both materials of a row see it; column meaning is kept, no direction label
        row1 = {"itemInId": 11, "itemOutId": 10, "unlockQuestId": 1}
        row2 = {"itemInId": 53, "itemOutId": 11, "unlockQuestId": 1}
        self.assertEqual(s["wyporium"], [row1, row2])
        self.assertEqual(m[10]["sources"]["wyporium"], [row1])
        # same item on both sides of one row is listed once
        self.assertEqual(m[12]["sources"]["wyporium"], [{"itemInId": 12, "itemOutId": 12, "unlockQuestId": 1}])
        # existing fields untouched, other source types empty
        self.assertEqual(len(m[10]["drops"]), 2)
        self.assertEqual(m[10]["sources"]["quests"], [])
        self.assertEqual(m[13]["sources"], {k: [] for k in ("quests", "arena", "combining", "veggieElder", "wyporium")})

    def test_quests_and_items_files(self):
        d = self.run_convert()
        self.assertEqual(d["quests"], [
            {"id": 1, "kind": "quest", "name": "Quest One", "hub": "Guild", "type": "Normal", "stars": 7},
            {"id": 1, "kind": "arena", "name": "Arena One", "hub": None, "type": None, "stars": None}])
        self.assertEqual([i["id"] for i in d["items"]], [50, 51, 52, 53])  # materials excluded
        self.assertEqual(d["items"][0], {"id": 50, "name": "Ingredient A", "type": "Bug", "rarity": 1})
        self.assertEqual(d["meta"]["counts"]["quests"], 2)
        self.assertEqual(d["meta"]["counts"]["items"], 4)

    def test_dangling_source_references_fail(self):
        for sql in ("delete from quests where _id=1",
                    "delete from arena_quests where _id=1",
                    "delete from items where _id=50",
                    "delete from items where _id=52",
                    "delete from items where _id=53"):
            with self.subTest(sql=sql):
                self.tmp = Path(tempfile.mkdtemp(dir=self.tmp))
                with self.assertRaises(convert.ConvertError):
                    self.run_convert(lambda c, s=sql: c.execute(s))

    def test_missing_reference_fails_integrity(self):
        files = json.loads(json.dumps(self.run_convert()))
        files.pop("meta")
        convert.check_integrity(files)  # sane baseline
        for mutate in (
            lambda f: f["armor"][0]["skills"].update({"99": 1}),
            lambda f: f["decorations"][0]["skills"].update({"99": 1}),
            lambda f: f["armor"][0]["materials"].append({"itemId": 99, "quantity": 1, "kind": "create"}),
            lambda f: f["materials"][0]["drops"].append({"monsterId": 99}),
            lambda f: f["materials"][0]["gathering"].append({"locationId": 99}),
            lambda f: f["armor"].append(dict(f["armor"][0])),
            lambda f: f["materials"][1]["sources"]["quests"].append({"questId": 99}),
            lambda f: f["materials"][1]["sources"]["arena"].append({"arenaQuestId": 99}),
            lambda f: f["materials"][1]["sources"]["combining"].append({"item1Id": 99, "item2Id": 50}),
            lambda f: f["materials"][1]["sources"]["veggieElder"].append({"offerItemId": 99}),
            lambda f: f["materials"][1]["sources"]["wyporium"].append({"itemInId": 99, "itemOutId": 50, "unlockQuestId": 1}),
            lambda f: f["materials"][1]["sources"]["wyporium"].append({"itemInId": 50, "itemOutId": 50, "unlockQuestId": 99}),
            lambda f: f["quests"].append(dict(f["quests"][0])),
            lambda f: f["skills"][0]["tiers"].append(dict(f["skills"][0]["tiers"][0])),
        ):
            bad = json.loads(json.dumps(files))
            mutate(bad)
            with self.assertRaises(convert.ConvertError):
                convert.check_integrity(bad)

    def test_dangling_material_in_db_fails(self):
        with self.assertRaises(convert.ConvertError):
            self.run_convert(lambda c: c.execute("insert into components(created_item_id,component_item_id,quantity,type) values(20,999,1,'Create')"))

    def test_deterministic(self):
        self.run_convert(out="a")
        self.run_convert(out="b")
        names = sorted(p.name for p in (self.tmp / "a").iterdir())
        self.assertEqual(len(names), 11)
        for n in names:
            raw = (self.tmp / "a" / n).read_bytes()
            self.assertEqual(raw, (self.tmp / "b" / n).read_bytes())
            self.assertTrue(raw.endswith(b"\n"))
            self.assertNotIn(b'": ', raw)  # compact separators
            self.assertNotIn(b'", "', raw)

    def test_meta(self):
        d = self.run_convert()
        m = d["meta"]
        self.assertEqual((m["dataVersion"], m["sourceCommit"], len(m["dbSha256"])), (1, "abc", 64))
        self.assertEqual(m["counts"]["armor"], 4)
        self.assertNotIn("generatedAt", m)


class CliTests(Base):
    def test_cli_exit_codes(self):
        db = self.tmp / "t.db"
        make_db(db)
        args = ["--db", str(db), "--out", str(self.tmp / "o"), "--source-url", "u", "--source-commit", "c"]
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(convert.main(args), 0)
        bad = self.tmp / "bad.db"
        make_db(bad, lambda c: c.execute("update weapons set affinity='abc' where _id=40"))
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(convert.main(["--db", str(bad)] + args[2:]), 1)
            self.assertEqual(convert.main(["--db", str(self.tmp / "missing.db")] + args[2:]), 1)


if __name__ == "__main__":
    unittest.main()
