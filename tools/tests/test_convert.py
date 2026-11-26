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
create table items(_id integer primary key, name text, type text, sub_type text default '', rarity integer default 1, icon_name text default '');
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
  reload_speed text, rapid_fire text, deviation text, ammo text, special_ammo text, num_slots int, tree_depth int, final int,
  creation_cost, upgrade_cost);
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
    c.executemany("insert into items(_id,name,type,sub_type,rarity) values(?,?,?,?,?)", [
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
    c.execute("update items set icon_name='Jewel-Red.png' where _id=30")
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
    c.executemany("insert into weapons(_id,parent_id,wtype,attack,max_attack,element,element_attack,element_2,element_2_attack,"
                  "awaken,awaken_attack,defense,sharpness,affinity,horn_notes,shelling_type,phial,charges,coatings,recoil,"
                  "reload_speed,rapid_fire,deviation,ammo,special_ammo,num_slots,tree_depth,final) "
                  "values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
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

    def test_decoration_color(self):
        d = self.run_convert()
        self.assertEqual(d["decorations"][0]["color"], "red")
        self.assertNotIn("Jewel-", json.dumps(d))

    def test_decoration_color_unknown(self):
        d = self.run_convert(lambda c: c.execute("update items set icon_name='Jewel-Unknown.png' where _id=30"))
        self.assertEqual(d["decorations"][0]["color"], "unknown")

    def test_deco_color_mapping(self):
        for color in ("Blue", "Cyan", "Green", "Grey", "Orange", "Pink", "Purple", "Red", "White", "Yellow", "Unknown"):
            self.assertEqual(convert.deco_color(f"Jewel-{color}.png", "x"), color.lower())

    def test_bad_decoration_icon_fails(self):
        for bad in ("Jewel-Magenta.png", "jewel-red.png", "Jewel-Red.jpg", "Jewel-Red.png\n", "Jewel-.png", "", None, "x/Jewel-Red.png"):
            with self.subTest(bad=bad), self.assertRaises(convert.ConvertError):
                convert.deco_color(bad, "x")

    def test_bad_decoration_icon_fails_conversion(self):
        with self.assertRaises(convert.ConvertError) as cm:
            self.run_convert(lambda c: c.execute("update items set icon_name='Jewel-Magenta.png' where _id=30"))
        self.assertIn("decoration 30", str(cm.exception))

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


def add_recipes(c):
    """Weapons 41-43 get recipes; 40, 44 get none. New materials 60 and 61 are used only by weapons."""
    c.executemany("insert into items(_id,name,type,rarity) values(?,?,?,?)", [(60, "Weapon Ore", "Ore", 1), (61, "Weapon Fang", "Flesh", 2)])
    c.executemany("insert into components(created_item_id,component_item_id,quantity,type) values(?,?,?,?)", [
        (41, 60, 3, "Create"),
        (42, 40, 1, "Improve"), (42, 60, 2, "Improve"), (42, 61, 1, "Improve"),
        (43, 40, 1, "Create"), (43, 61, 4, "Create"), (43, 40, 1, "Improve"), (43, 60, 1, "Improve")])
    c.execute("update weapons set creation_cost='750', upgrade_cost='' where _id=41")
    c.execute("update weapons set creation_cost='', upgrade_cost=1200 where _id=42")
    c.execute("update weapons set creation_cost=0 where _id=44")


# A slice of the real Great Sword tree (ids and lines as stored in the source database).
def add_real_slice(c):
    c.executemany("insert into items(_id,name,type,sub_type,rarity) values(?,?,?,?,?)", [
        (n, name, "Ore", "", 1) for n, name in ((203, "Iron Ore"), (205, "Machalite Ore"), (206, "Dragonite Ore"),
        (207, "Lightcrystal"), (209, "Firestone"), (210, "Gossamite Ore"), (213, "Carbalite Ore"), (266, "Hercudrome"))] + [
        (n, name, "Weapon", "Great Sword", 1) for n, name in ((5001, "Iron Sword"), (5005, "Ravager Blade"),
        (5006, "Ravager Blade+"), (5007, "Lacerator Blade"))])
    c.executemany("insert into weapons(_id,parent_id,wtype,attack,num_slots,tree_depth,final,affinity,creation_cost,upgrade_cost) "
                  "values(?,?,?,?,?,?,?,?,?,?)", [
        (5001, 0, "Great Sword", 288, 0, 0, 0, "", 750, ""), (5005, 5001, "Great Sword", 300, 0, 4, 0, "", "", 1000),
        (5006, 5005, "Great Sword", 500, 0, 5, 0, "", 9525, 6350), (5007, 5006, "Great Sword", 720, 2, 6, 0, "", "", 20000)])
    c.executemany("insert into components(created_item_id,component_item_id,quantity,type) values(?,?,?,?)", [
        (5001, 203, 3, "Create"),
        (5005, 5001, 1, "Improve"), (5005, 203, 1, "Improve"),
        (5006, 209, 3, "Create"), (5006, 206, 15, "Create"), (5006, 205, 10, "Create"),
        (5006, 5005, 1, "Improve"), (5006, 209, 2, "Improve"), (5006, 206, 10, "Improve"), (5006, 210, 2, "Improve"),
        (5007, 5006, 1, "Improve"), (5007, 213, 5, "Improve"), (5007, 207, 4, "Improve"), (5007, 266, 3, "Improve")])


class WeaponRecipeTests(Base):
    def lines(self, d, wid):
        return {w["id"]: w for w in d["weapons"]}[wid]["materials"]

    def test_lines_exclude_parent_and_keep_both_kinds(self):
        d = self.run_convert(add_recipes)
        self.assertEqual(self.lines(d, 41), [{"itemId": 60, "quantity": 3, "kind": "create"}])
        self.assertEqual(self.lines(d, 42), [{"itemId": 60, "quantity": 2, "kind": "improve"},
                                             {"itemId": 61, "quantity": 1, "kind": "improve"}])  # parent 40 not listed
        self.assertEqual(self.lines(d, 43), [{"itemId": 61, "quantity": 4, "kind": "create"},
                                             {"itemId": 60, "quantity": 1, "kind": "improve"}])
        self.assertEqual((self.lines(d, 40), self.lines(d, 44)), ([], []))
        self.assertEqual({m["kind"] for w in d["weapons"] for m in w["materials"]}, {"create", "improve"})
        ids = {w["id"] for w in d["weapons"]}
        self.assertFalse(any(m["itemId"] in ids for w in d["weapons"] for m in w["materials"]))
        self.assertEqual([w for w in self.warnings if "weapon ingredient" in w], [])  # parents all match
        self.assertEqual(sum(1 for w in d["weapons"] if w["materials"]), 3)
        self.assertEqual(sum(len(w["materials"]) for w in d["weapons"]), 5)

    def test_requires_weapon(self):
        d = self.run_convert(add_recipes)
        by = {w["id"]: w for w in d["weapons"]}
        none = {"create": None, "improve": None}
        self.assertTrue(all(set(w["requiresWeapon"]) == {"create", "improve"} for w in d["weapons"]))
        self.assertEqual(by[43]["requiresWeapon"], {"create": 40, "improve": None})  # create keeps the parent; improve == parentId -> null
        self.assertEqual(by[42]["requiresWeapon"], none)  # normal improve
        self.assertEqual((by[40]["requiresWeapon"], by[41]["requiresWeapon"], by[44]["requiresWeapon"]), (none, none, none))

    def test_requires_weapon_different_from_parent_and_no_parent(self):
        def other(c):
            add_recipes(c)
            c.execute("update components set component_item_id=44 where created_item_id=42 and component_item_id=40")
            c.execute("insert into components(created_item_id,component_item_id,quantity,type) values(41,44,1,'Improve')")
        d = self.run_convert(other)
        by = {w["id"]: w for w in d["weapons"]}
        self.assertEqual(by[42]["requiresWeapon"], {"create": None, "improve": 44})  # differs from parentId 40
        self.assertEqual((by[41]["parentId"], by[41]["requiresWeapon"]), (None, {"create": None, "improve": 44}))  # no parent
        self.assertFalse(any(m["itemId"] == 44 for w in d["weapons"] for m in w["materials"]))
        self.assertTrue(any("weapon 42" in w and "does not match parentId 40" in w for w in self.warnings))  # warning kept

    def test_requires_weapon_missing_or_ambiguous_stays_null(self):
        def no_parent(c):
            add_recipes(c)
            c.execute("delete from components where created_item_id=42 and component_item_id=40")
        d = self.run_convert(no_parent)
        self.assertEqual({w["id"]: w for w in d["weapons"]}[42]["requiresWeapon"], {"create": None, "improve": None})
        self.assertTrue(any("weapon 42" in w and "none does not match" in w for w in self.warnings))
        self.tmp = Path(tempfile.mkdtemp(dir=self.tmp))
        def two(c):
            add_recipes(c)
            c.execute("insert into components(created_item_id,component_item_id,quantity,type) values(42,44,1,'Improve')")
        d = self.run_convert(two)
        self.assertEqual({w["id"]: w for w in d["weapons"]}[42]["requiresWeapon"], {"create": None, "improve": None})
        self.assertTrue(any("2 weapon ingredients" in w for w in self.warnings))

    def test_requires_weapon_cycles_and_self_references(self):
        def cycle(c):
            add_recipes(c)
            c.execute("update weapons set parent_id=43 where _id=40")  # 40 -> 43 -> 40 via parentId
        d = self.run_convert(cycle)
        self.assertTrue(any("prerequisite cycle" in w and "40" in w and "43" in w for w in self.warnings))
        self.assertIsNotNone(d)  # a cycle is reported, not fatal
        files = json.loads(json.dumps(d))
        files.pop("meta")
        for mutate in (lambda f: f["weapons"][0]["requiresWeapon"].update({"create": f["weapons"][0]["id"]}),
                       lambda f: f["weapons"][0]["requiresWeapon"].update({"improve": 99999}),
                       lambda f: f["weapons"][0].update({"parentId": f["weapons"][0]["id"]})):
            bad = json.loads(json.dumps(files))
            mutate(bad)
            with self.assertRaises(convert.ConvertError):
                convert.check_integrity(bad)
        self.tmp = Path(tempfile.mkdtemp(dir=self.tmp))
        self.run_convert(add_recipes)
        self.assertFalse(any("cycle" in w for w in self.warnings))

    def test_costs(self):
        d = self.run_convert(add_recipes)
        by = {w["id"]: w for w in d["weapons"]}
        self.assertEqual((by[41]["creationCost"], by[41]["upgradeCost"]), (750, None))  # '' -> null, text int -> int
        self.assertEqual((by[42]["creationCost"], by[42]["upgradeCost"]), (None, 1200))
        self.assertEqual(by[44]["creationCost"], 0)  # a stored 0 is kept as 0
        self.assertEqual((by[40]["creationCost"], by[40]["upgradeCost"]), (None, None))  # column is NULL

    def test_bad_costs(self):
        with self.assertRaises(convert.ConvertError):
            self.run_convert(lambda c: c.execute("update weapons set creation_cost=-5 where _id=41"))
        self.tmp = Path(tempfile.mkdtemp(dir=self.tmp))
        d = self.run_convert(lambda c: c.execute("update weapons set upgrade_cost='(varies' where _id=41"))
        self.assertIsNone({w["id"]: w for w in d["weapons"]}[41]["upgradeCost"])
        self.assertTrue(any("weapon 41" in w and "upgrade_cost" in w for w in self.warnings))

    def test_new_materials_and_no_dangling_references(self):
        d = self.run_convert(add_recipes)
        m = {x["id"]: x for x in d["materials"]}
        self.assertEqual(sorted(m), [10, 11, 12, 13, 60, 61])  # 60, 61 only used by weapons
        self.assertEqual(set(m[60]["sources"]), {"quests", "arena", "combining", "veggieElder", "wyporium"})
        self.assertNotIn(60, [i["id"] for i in d["items"]])
        files = dict(d)
        files.pop("meta")
        convert.check_integrity(files)
        bad = json.loads(json.dumps(files))
        bad["weapons"][1]["materials"].append({"itemId": 999, "quantity": 1, "kind": "create"})
        with self.assertRaises(convert.ConvertError):
            convert.check_integrity(bad)

    def test_parent_mismatch_is_flagged_not_guessed(self):
        def other_weapon(c):
            add_recipes(c)
            c.execute("update components set component_item_id=44 where created_item_id=42 and component_item_id=40")
        d = self.run_convert(other_weapon)
        self.assertTrue(any("weapon 42" in w and "[44] does not match parentId 40" in w for w in self.warnings))
        self.assertFalse(any(m["itemId"] == 44 for m in self.lines(d, 42)))

        self.tmp = Path(tempfile.mkdtemp(dir=self.tmp))
        def no_parent(c):
            add_recipes(c)
            c.execute("delete from components where created_item_id=42 and component_item_id=40")
        self.run_convert(no_parent)
        self.assertTrue(any("weapon 42" in w and "none does not match parentId 40" in w for w in self.warnings))

        self.tmp = Path(tempfile.mkdtemp(dir=self.tmp))
        def two(c):
            add_recipes(c)
            c.execute("insert into components(created_item_id,component_item_id,quantity,type) values(42,44,1,'Improve')")
        self.run_convert(two)
        self.assertTrue(any("weapon 42" in w and "2 weapon ingredients" in w for w in self.warnings))

        self.tmp = Path(tempfile.mkdtemp(dir=self.tmp))
        def create_other(c):
            add_recipes(c)
            c.execute("update components set component_item_id=44 where created_item_id=43 and type='Create' and component_item_id=40")
        self.run_convert(create_other)
        self.assertTrue(any("weapon 43" in w and "create weapon ingredient [44]" in w for w in self.warnings))

    def test_duplicate_lines(self):
        def dup(c):
            add_recipes(c)
            c.execute("insert into components(created_item_id,component_item_id,quantity,type) values(41,60,3,'Create')")
        d = self.run_convert(dup)
        self.assertEqual(self.lines(d, 41), [{"itemId": 60, "quantity": 3, "kind": "create"}])
        self.assertTrue(any("weapon 41" in w and "duplicate create line" in w for w in self.warnings))
        self.tmp = Path(tempfile.mkdtemp(dir=self.tmp))
        with self.assertRaises(convert.ConvertError):
            self.run_convert(lambda c: (add_recipes(c), c.execute(
                "insert into components(created_item_id,component_item_id,quantity,type) values(41,60,5,'Create')")))

    def test_bad_recipe_rows_fail(self):
        for sql in ("insert into components(created_item_id,component_item_id,quantity,type) values(41,60,0,'Create')",
                    "insert into components(created_item_id,component_item_id,quantity,type) values(41,61,-1,'Improve')",
                    "insert into components(created_item_id,component_item_id,quantity,type) values(41,61,1,'Create A')",
                    "insert into components(created_item_id,component_item_id,quantity,type) values(41,999,1,'Create')"):
            with self.subTest(sql=sql):
                self.tmp = Path(tempfile.mkdtemp(dir=self.tmp))
                with self.assertRaises(convert.ConvertError):
                    self.run_convert(lambda c, q=sql: (add_recipes(c), c.execute(q)))

    def test_real_slice_end_to_end(self):
        d = self.run_convert(add_real_slice)
        by = {w["id"]: w for w in d["weapons"]}
        line = lambda i, q, k: {"itemId": i, "quantity": q, "kind": k}
        self.assertEqual(by[5007]["materials"], [line(213, 5, "improve"), line(207, 4, "improve"), line(266, 3, "improve")])
        self.assertEqual((by[5007]["parentId"], by[5007]["creationCost"], by[5007]["upgradeCost"]), (5006, None, 20000))
        self.assertEqual(by[5006]["materials"], [line(209, 3, "create"), line(206, 15, "create"), line(205, 10, "create"),
                                                 line(209, 2, "improve"), line(206, 10, "improve"), line(210, 2, "improve")])
        self.assertEqual((by[5006]["creationCost"], by[5006]["upgradeCost"]), (9525, 6350))
        self.assertEqual(by[5001]["materials"], [line(203, 3, "create")])
        self.assertEqual((by[5001]["parentId"], by[5001]["creationCost"], by[5001]["upgradeCost"]), (None, 750, None))
        self.assertFalse([w for w in self.warnings if "weapon ingredient" in w])
        self.assertTrue(all(by[i]["requiresWeapon"] == {"create": None, "improve": None} for i in (5001, 5005, 5006, 5007)))
        self.assertTrue({203, 205, 206, 207, 209, 210, 213, 266} <= {m["id"] for m in d["materials"]})


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
