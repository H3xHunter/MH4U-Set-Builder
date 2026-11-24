"""Convert the MH4U Database SQLite file into the clean JSON the app loads.

Python 3 stdlib only. Run with: python3 -I tools/convert.py --db PATH --out public/data \
    --source-url URL --source-commit HASH
The database is untrusted data: opened read-only, never evaluated.
"""
import argparse
import hashlib
import json
import re
import sqlite3
import sys
from pathlib import Path

DATA_VERSION = 1
LICENSE = "MIT, Copyright (c) 2014 DavianCorp; applies to the app source, game data is Capcom's"
SLOTS = {"Head": "head", "Body": "chest", "Arms": "arms", "Waist": "waist", "Legs": "legs"}
HUNTER = {"Blade": "blade", "Gunner": "gunner", "Both": "both"}
GENDER = {"Male": "male", "Female": "female", "Both": "both"}
KIND = {"Create": "create", "Create A": "createA", "Create B": "createB", "Improve": "improve"}
SHARP_RE = re.compile(r"^(\d+(?:\.\d+){6}) (\d+(?:\.\d+){6})$")
INT_RE = re.compile(r"^-?\d+$")
PAIR_RE = re.compile(r"^-?\d+/-?\d+$")


class ConvertError(Exception):
    """A fatal data problem; the CLI prints it and exits non-zero."""


def blank(v):
    """Normalize '' (and whitespace-only) to None."""
    if v is None:
        return None
    if isinstance(v, str):
        return v if v.strip() else None
    return v


def num(v, what):
    v = blank(v)
    if v is None or isinstance(v, int):
        return v
    if isinstance(v, str) and INT_RE.match(v.strip()):
        return int(v)
    raise ConvertError(f"{what}: not an integer: {v!r}")


DECO_ICON_RE = re.compile(r"Jewel-([A-Za-z]+)\.png")
DECO_COLORS = frozenset({"blue", "cyan", "green", "grey", "orange", "pink", "purple", "red", "white", "yellow", "unknown"})


def deco_color(icon_name, what):
    """items.icon_name 'Jewel-<Color>.png' -> lowercase color. Anything else fails; the filename is never stored."""
    m = DECO_ICON_RE.fullmatch(icon_name) if isinstance(icon_name, str) else None
    color = m.group(1).lower() if m else None
    if color not in DECO_COLORS:
        raise ConvertError(f"{what}: unexpected decoration icon_name {icon_name!r} (expected Jewel-<Color>.png with a known color)")
    return color


def mapped(table, v, what):
    v = blank(v)
    if v is None:
        return None
    if v not in table:
        raise ConvertError(f"{what}: unknown value {v!r}")
    return table[v]


def parse_sharpness(text):
    """Return {'base': [7], 'plus': [7]} or None if the text does not match."""
    m = SHARP_RE.match(text or "")
    if not m:
        return None
    return {"base": [int(x) for x in m.group(1).split(".")],
            "plus": [int(x) for x in m.group(2).split(".")]}


def parse_affinity(text, label):
    """Return (affinity, affinityOptions). Blank -> 0 (owner-confirmed); 'a/b' -> (None, [a, b])."""
    text = blank(text)
    if text is None:
        return 0, None
    text = text.strip()
    if INT_RE.match(text):
        return int(text), None
    if PAIR_RE.match(text):
        return None, [int(x) for x in text.split("/")]
    raise ConvertError(f"{label}: unparsable affinity {text!r}")


def typed(kind, value, what):
    kind = blank(kind)
    if kind is None:
        return None
    return {"type": kind, "value": num(value, what)}


def rows(conn, sql, args=()):
    cur = conn.execute(sql, args)
    names = [d[0] for d in cur.description]
    return [dict(zip(names, r)) for r in cur]


def build(conn, warn):
    """Return (files, torso_up_tree_id) from an open read-only connection."""
    trees = rows(conn, "select * from skill_trees order by _id")
    torso = [t["_id"] for t in trees if t["name"] == "Torso Up"]
    if len(torso) != 1:
        raise ConvertError(f"expected exactly one 'Torso Up' skill tree, found {len(torso)}")
    torso_id = torso[0]

    tiers = {}
    for s in rows(conn, "select * from skills order by _id"):
        tiers.setdefault(s["skill_tree_id"], []).append(
            {"points": num(s["required_skill_tree_points"], "skills.points"),
             "name": blank(s["name"]), "description": blank(s["description"])})
    skills = [{"id": t["_id"], "name": t["name"],
               "tiers": sorted(tiers.get(t["_id"], []), key=lambda x: x["points"])}
              for t in trees if t["_id"] != torso_id]

    item_skills = {}
    for r in rows(conn, "select * from item_to_skill_tree order by _id"):
        item_skills.setdefault(r["item_id"], {})[r["skill_tree_id"]] = r["point_value"]

    def split_skills(item_id):
        pts = dict(item_skills.get(item_id, {}))
        torso_flag = torso_id in pts
        pts.pop(torso_id, None)
        return {str(k): v for k, v in sorted(pts.items()) if v}, torso_flag

    comps = {}
    for r in rows(conn, "select * from components order by _id"):
        comps.setdefault(r["created_item_id"], []).append(
            {"itemId": r["component_item_id"], "quantity": r["quantity"],
             "kind": mapped(KIND, r["type"], "components.type")})

    armor = []
    for r in rows(conn, "select i._id, i.name, i.rarity, a.* from items i join armor a on a._id=i._id "
                        "where i.type='Armor' order by i._id"):
        pts, flag = split_skills(r["_id"])
        hunter = mapped(HUNTER, r["hunter_type"], "armor.hunter_type")
        gender = mapped(GENDER, r["gender"], "armor.gender")
        if hunter is None or gender is None:
            warn(f"armor {r['_id']} {r['name']!r}: empty gender/hunter_type, kept as null")
        armor.append({
            "id": r["_id"], "name": r["name"], "slot": mapped(SLOTS, r["slot"], "armor.slot"),
            "hunterType": hunter, "gender": gender, "slots": r["num_slots"],
            "defense": r["defense"], "maxDefense": num(r["max_defense"], "armor.max_defense"),
            "res": {"fire": r["fire_res"], "water": r["water_res"], "thunder": r["thunder_res"],
                    "ice": r["ice_res"], "dragon": r["dragon_res"]},
            "skills": pts, "torsoUp": flag, "rarity": r["rarity"],
            "materials": comps.get(r["_id"], [])})

    decorations = []
    for r in rows(conn, "select i._id, i.name, i.icon_name, d.num_slots from items i join decorations d on d._id=i._id "
                        "where i.type='Decoration' order by i._id"):
        pts, _ = split_skills(r["_id"])
        decorations.append({"id": r["_id"], "name": r["name"], "size": r["num_slots"], "skills": pts,
                            "color": deco_color(r["icon_name"], f"decoration {r['_id']}")})

    weapons = []
    for r in rows(conn, "select i._id, i.name, i.sub_type, i.rarity, w.* from items i "
                        "join weapons w on w._id=i._id where i.type='Weapon' order by i._id"):
        label = f"weapon {r['_id']} {r['name']!r}"
        affinity, options = parse_affinity(r["affinity"], label)
        sharp = None
        if blank(r["sharpness"]) is not None:
            sharp = parse_sharpness(r["sharpness"])
            if sharp is None:
                warn(f"{label}: malformed sharpness {r['sharpness']!r}, set to null")
        w = {"id": r["_id"], "name": r["name"], "class": blank(r["sub_type"]),
             "parentId": r["parent_id"] or None,  # 0 means "no parent" in the source "treeDepth": r["tree_depth"],
             "final": bool(r["final"]), "rarity": r["rarity"], "attack": r["attack"],
             "maxAttack": num(r["max_attack"], label), "affinity": affinity,
             "affinityOptions": options,
             "element": typed(r["element"], r["element_attack"], label),
             "element2": typed(r["element_2"], r["element_2_attack"], label),
             "awaken": typed(r["awaken"], r["awaken_attack"], label),
             "defenseBonus": num(r["defense"], label), "sharpness": sharp,
             "slots": r["num_slots"], "hornNotes": blank(r["horn_notes"]),
             "extra": {k: blank(r[c]) for k, c in (
                 ("shellingType", "shelling_type"), ("phial", "phial"), ("charges", "charges"),
                 ("coatings", "coatings"), ("recoil", "recoil"), ("reloadSpeed", "reload_speed"),
                 ("rapidFire", "rapid_fire"), ("deviation", "deviation"), ("ammo", "ammo"),
                 ("specialAmmo", "special_ammo"))}}
        weapons.append(w)

    horn = [{k: blank(r[k]) for k in ("notes", "song", "effect1", "effect2", "duration", "extension")}
            for r in rows(conn, "select * from horn_melodies order by _id")]

    mat_ids = sorted({m["itemId"] for a in armor for m in a["materials"]})
    drops, gather = {}, {}
    for r in rows(conn, "select * from hunting_rewards order by _id"):
        drops.setdefault(r["item_id"], []).append(
            {"monsterId": r["monster_id"], "rank": blank(r["rank"]), "condition": blank(r["condition"]),
             "percentage": num(r["percentage"], "hunting_rewards.percentage"),
             "stackSize": r["stack_size"]})
    for r in rows(conn, "select * from gathering order by _id"):
        gather.setdefault(r["item_id"], []).append(
            {"locationId": r["location_id"], "area": blank(r["area"]), "site": blank(r["site"]),
             "rank": blank(r["rank"]), "quantity": num(r["quantity"], "gathering.quantity"),
             "percentage": num(r["percentage"], "gathering.percentage")})
    items = {r["_id"]: r for r in rows(conn, "select _id, name, type, rarity from items")}
    mat_set = set(mat_ids)
    src = {k: {} for k in ("quests", "arena", "combining", "veggieElder", "wyporium")}

    def add(kind, item_id, rec):
        src[kind].setdefault(item_id, []).append(rec)

    for r in rows(conn, "select * from quest_rewards order by _id"):
        if r["item_id"] in mat_set:
            add("quests", r["item_id"], {"questId": r["quest_id"], "slot": blank(r["reward_slot"]),
                                         "percentage": num(r["percentage"], "quest_rewards.percentage"),
                                         "stackSize": r["stack_size"]})
    for r in rows(conn, "select * from arena_rewards order by _id"):
        if r["item_id"] in mat_set:
            add("arena", r["item_id"], {"arenaQuestId": r["arena_id"],
                                        "percentage": num(r["percentage"], "arena_rewards.percentage"),
                                        "stackSize": r["stack_size"]})
    for r in rows(conn, "select * from combining order by _id"):
        if r["created_item_id"] in mat_set:
            add("combining", r["created_item_id"], {
                "item1Id": r["item_1_id"], "item2Id": r["item_2_id"],
                "amountMin": num(r["amount_made_min"], "combining.amount_made_min"),
                "amountMax": num(r["amount_made_max"], "combining.amount_made_max"),
                "percentage": num(r["percentage"], "combining.percentage")})
    for r in rows(conn, "select * from veggie_elder order by _id"):
        if r["receive_item_id"] in mat_set:
            add("veggieElder", r["receive_item_id"], {"offerItemId": r["offer_item_id"],
                                                      "quantity": r["quantity"]})
    for r in rows(conn, "select * from wyporium order by _id"):
        rec = {"itemInId": r["item_in_id"], "itemOutId": r["item_out_id"],
               "unlockQuestId": num(r["unlock_quest_id"], "wyporium.unlock_quest_id")}
        # direction (which side the player gives) is unverified; keep column meaning only
        for i in {r["item_in_id"], r["item_out_id"]} & mat_set:
            add("wyporium", i, rec)

    materials = []
    for i in mat_ids:
        if i not in items:
            raise ConvertError(f"armor material item {i} does not exist in items")
        materials.append({"id": i, "name": items[i]["name"], "rarity": items[i]["rarity"],
                          "drops": drops.get(i, []), "gathering": gather.get(i, []),
                          "sources": {k: v.get(i, []) for k, v in src.items()}})

    quest_ids, arena_ids, ref_items = set(), set(), set()
    for m in materials:
        s = m["sources"]
        quest_ids |= {x["questId"] for x in s["quests"]}
        quest_ids |= {x["unlockQuestId"] for x in s["wyporium"] if x["unlockQuestId"] is not None}
        arena_ids |= {x["arenaQuestId"] for x in s["arena"]}
        for x in s["combining"]:
            ref_items |= {x["item1Id"], x["item2Id"]}
        ref_items |= {x["offerItemId"] for x in s["veggieElder"]}
        for x in s["wyporium"]:
            ref_items |= {x["itemInId"], x["itemOutId"]}
    ref_items -= mat_set
    quests = [{"id": r["_id"], "kind": "quest", "name": r["name"], "hub": blank(r["hub"]),
               "type": blank(r["type"]), "stars": r["stars"]}
              for r in rows(conn, "select _id, name, hub, type, stars from quests order by _id")
              if r["_id"] in quest_ids]
    quests += [{"id": r["_id"], "kind": "arena", "name": r["name"], "hub": None, "type": None, "stars": None}
               for r in rows(conn, "select _id, name from arena_quests order by _id") if r["_id"] in arena_ids]
    ref_item_recs = [{"id": i, "name": items[i]["name"], "type": blank(items[i]["type"]),
                      "rarity": items[i]["rarity"]} for i in sorted(ref_items) if i in items]

    hz = {}
    for r in rows(conn, "select * from monster_damage order by _id"):
        hz.setdefault(r["monster_id"], []).append(
            {"part": blank(r["body_part"]), **{k: num(r[k], "monster_damage") for k in (
                "cut", "impact", "shot", "fire", "water", "ice", "thunder", "dragon", "ko")}})
    monsters = [{"id": r["_id"], "name": r["name"], "class": blank(r["class"]),
                 "hitzones": hz.get(r["_id"], [])}
                for r in rows(conn, "select * from monsters order by _id")]

    loc_ids = {g["locationId"] for m in materials for g in m["gathering"]}
    locations = [{"id": r["_id"], "name": r["name"]}
                 for r in rows(conn, "select _id, name from locations order by _id") if r["_id"] in loc_ids]
    files = {"skills": skills, "armor": armor, "decorations": decorations, "weapons": weapons,
             "horn": horn, "materials": materials, "monsters": monsters, "locations": locations,
             "quests": quests, "items": ref_item_recs}
    return files, torso_id


def check_integrity(files):
    """Raise ConvertError listing every problem found."""
    errs = []
    ids = lambda name: {x["id"] for x in files[name]}
    for name, lst in files.items():
        if name == "horn":
            continue
        seen = [(x["kind"], x["id"]) if name == "quests" else x["id"] for x in lst]
        if len(seen) != len(set(seen)):
            errs.append(f"{name}: duplicate ids")
    for t in files["skills"]:
        pts = [x["points"] for x in t["tiers"]]
        if len(pts) != len(set(pts)):
            errs.append(f"skills: tree {t['id']} has duplicate tier points")
    trees = {str(i) for i in ids("skills")}
    for name in ("armor", "decorations"):
        for x in files[name]:
            for k in x["skills"]:
                if k not in trees:
                    errs.append(f"{name} {x['id']}: unknown skill tree {k}")
    mats, mons, locs = ids("materials"), ids("monsters"), ids("locations")
    for a in files["armor"]:
        for m in a["materials"]:
            if m["itemId"] not in mats:
                errs.append(f"armor {a['id']}: unknown material {m['itemId']}")
    wids = ids("weapons")
    for w in files["weapons"]:
        if w["parentId"] is not None and w["parentId"] not in wids:
            errs.append(f"weapon {w['id']}: unknown parentId {w['parentId']}")
    quest_ids = {x["id"] for x in files["quests"] if x["kind"] == "quest"}
    arena_ids = {x["id"] for x in files["quests"] if x["kind"] == "arena"}
    item_ids = ids("items") | mats
    for m in files["materials"]:
        s = m["sources"]
        for x in s["quests"]:
            if x["questId"] not in quest_ids:
                errs.append(f"material {m['id']}: unknown quest {x['questId']}")
        for x in s["arena"]:
            if x["arenaQuestId"] not in arena_ids:
                errs.append(f"material {m['id']}: unknown arena quest {x['arenaQuestId']}")
        for x in s["combining"]:
            for k in ("item1Id", "item2Id"):
                if x[k] not in item_ids:
                    errs.append(f"material {m['id']}: unknown combining item {x[k]}")
        for x in s["veggieElder"]:
            if x["offerItemId"] not in item_ids:
                errs.append(f"material {m['id']}: unknown veggie item {x['offerItemId']}")
        for x in s["wyporium"]:
            for k in ("itemInId", "itemOutId"):
                if x[k] not in item_ids:
                    errs.append(f"material {m['id']}: unknown wyporium item {x[k]}")
            if x["unlockQuestId"] is not None and x["unlockQuestId"] not in quest_ids:
                errs.append(f"material {m['id']}: unknown wyporium unlock quest {x['unlockQuestId']}")
        for d in m["drops"]:
            if d["monsterId"] not in mons:
                errs.append(f"material {m['id']}: unknown monster {d['monsterId']}")
        for g in m["gathering"]:
            if g["locationId"] not in locs:
                errs.append(f"material {m['id']}: unknown location {g['locationId']}")
    if errs:
        more = f"\n  ... and {len(errs) - 20} more" if len(errs) > 20 else ""
        raise ConvertError("integrity check failed:\n  " + "\n  ".join(errs[:20]) + more)


def dumps(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n"


def convert(db_path, out_dir, source_url, source_commit, warn=None):
    """Run the whole conversion. Returns (counts, warnings, no_source_armor_materials)."""
    warnings = []

    def w(msg):
        warnings.append(msg)
        if warn:
            warn(msg)

    db_path = Path(db_path)
    sha = hashlib.sha256(db_path.read_bytes()).hexdigest()
    conn = sqlite3.connect(f"file:{db_path.resolve()}?mode=ro", uri=True)
    try:
        files, torso_id = build(conn, w)
    finally:
        conn.close()
    check_integrity(files)
    counts = {k: len(v) for k, v in files.items()}
    meta = {"dataVersion": DATA_VERSION, "sourceUrl": source_url, "sourceCommit": source_commit,
            "dbSha256": sha, "license": LICENSE, "torsoUpTreeId": torso_id, "counts": counts}
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for name, data in {**files, "meta": meta}.items():
        (out / f"{name}.json").write_bytes(dumps(data).encode("utf-8"))
    no_src = sorted({m["id"] for m in files["materials"]
                     if not m["drops"] and not m["gathering"] and not any(m["sources"].values())})
    return counts, warnings, no_src


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--db", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--source-url", required=True)
    p.add_argument("--source-commit", required=True)
    a = p.parse_args(argv)
    try:
        counts, warnings, no_src = convert(a.db, a.out, a.source_url, a.source_commit,
                                           warn=lambda m: print("WARNING:", m, file=sys.stderr))
    except (ConvertError, sqlite3.Error, OSError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    for k, v in sorted(counts.items()):
        print(f"{k}: {v}")
    print(f"warnings: {len(warnings)}")
    print(f"materials with no source of any kind: {len(no_src)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
