import type { CrownLevel, Movement, Track } from "./types";

// 60 movements, 10 per track. Home variants are bodyweight; gym variants use common equipment.
const m = (id: string, name: string, track: Track, difficulty: 1 | 2 | 3 | 4 | 5, env: Movement["env"], unit: Movement["unit"], cue: string, flags: Movement["flags"] = [], extra: Partial<Movement> = {}): Movement => ({ id, name, track, difficulty, env, unit, cue, flags, ...extra });

export const MOVEMENTS: Movement[] = [
  // PUSH
  m("wall_pushup", "Wall push-up", "push", 1, ["home", "travel"], "reps", "Hands at shoulder height, body straight, lean in and press away.", [], { seated: false, progression: "incline_pushup" }),
  m("incline_pushup", "Incline push-up", "push", 2, ["home", "travel"], "reps", "Hands on a counter or bed edge. Chest to the edge, elbows at 45°.", ["wrists"], { regression: "wall_pushup", progression: "knee_pushup" }),
  m("knee_pushup", "Knee push-up", "push", 2, ["home", "travel"], "reps", "Knees down, hips in line with shoulders, chest to a fist off the floor.", ["wrists"], { regression: "incline_pushup", progression: "full_pushup" }),
  m("full_pushup", "Full push-up", "push", 3, ["home", "travel"], "reps", "Elbows at 45°, chest to a fist's height off the floor. Breathe out on the push.", ["wrists", "shoulders"], { regression: "knee_pushup", progression: "pike_pushup" }),
  m("pike_pushup", "Pike push-up", "push", 4, ["home", "travel"], "reps", "Hips high, head toward the floor between your hands.", ["wrists", "shoulders"], { regression: "full_pushup", progression: "diamond_pushup" }),
  m("diamond_pushup", "Diamond push-up", "push", 5, ["home", "travel"], "reps", "Thumbs and index fingers touching. Elbows stay close.", ["wrists", "shoulders"], { regression: "full_pushup" }),
  m("plank", "Plank hold", "push", 2, ["home", "travel", "gym"], "seconds", "Forearms down, squeeze glutes, don't let the hips sag.", ["shoulders"], { seated: false }),
  m("incline_bench", "Incline bench press", "push", 2, ["gym"], "reps", "Bar to upper chest, elbows under the bar, feet planted.", ["shoulders"]),
  m("flat_bench", "Flat bench press", "push", 3, ["gym"], "reps", "Shoulder blades pinched, bar to mid-chest, press up and slightly back.", ["shoulders"]),
  m("overhead_press", "Overhead press", "push", 4, ["gym"], "reps", "Ribs down, press straight up, head through at the top.", ["shoulders", "low_back"]),
  m("seated_press", "Seated band press", "push", 1, ["home", "travel", "gym"], "reps", "Band behind the back, press forward at chest height.", [], { seated: true }),
  // PULL
  m("towel_row", "Towel row", "pull", 1, ["home", "travel"], "reps", "Towel around a post or door handle, lean back, pull chest to hands.", [], { progression: "door_row" }),
  m("door_row", "Door-frame row", "pull", 2, ["home", "travel"], "reps", "Hold both sides of a door frame, lean back, pull in. Elbows back.", [], { regression: "towel_row", progression: "table_row" }),
  m("table_row", "Table row", "pull", 3, ["home"], "reps", "Lie under a sturdy table, pull chest to the edge.", ["shoulders"], { regression: "door_row", progression: "negative_pullup" }),
  m("negative_pullup", "Negative pull-up", "pull", 4, ["home", "gym"], "reps", "Jump to the top, lower over 4 seconds.", ["shoulders"], { regression: "table_row", progression: "pullup" }),
  m("pullup", "Pull-up", "pull", 5, ["home", "gym"], "reps", "Dead hang to chin over bar, no kicking.", ["shoulders"], { regression: "negative_pullup" }),
  m("superman", "Superman hold", "pull", 1, ["home", "travel"], "seconds", "Face down, lift arms and legs, hold. Look at the floor.", ["low_back"]),
  m("lat_pulldown", "Lat pulldown", "pull", 2, ["gym"], "reps", "Bar to upper chest, elbows down and back.", []),
  m("seated_row", "Seated cable row", "pull", 3, ["gym"], "reps", "Chest up, pull to the belly button, squeeze shoulder blades.", []),
  m("band_row", "Seated band row", "pull", 1, ["home", "travel", "gym"], "reps", "Band around feet or a post, pull to ribs.", [], { seated: true }),
  m("band_pullapart", "Band pull-apart", "pull", 1, ["home", "travel", "gym"], "reps", "Arms straight, pull the band to your chest.", [], { seated: true }),
  // LEGS
  m("chair_squat", "Chair squat", "legs", 1, ["home", "travel"], "reps", "Sit back to the chair, tap it, stand. Knees track over toes.", ["knees"], { progression: "bodyweight_squat" }),
  m("bodyweight_squat", "Bodyweight squat", "legs", 2, ["home", "travel"], "reps", "Feet shoulder width, hips below knees if you can, chest up.", ["knees"], { regression: "chair_squat", progression: "split_squat" }),
  m("split_squat", "Split squat", "legs", 3, ["home", "travel"], "reps", "One foot forward, back knee to an inch off the floor.", ["knees"], { regression: "bodyweight_squat", progression: "bulgarian" }),
  m("bulgarian", "Bulgarian split squat", "legs", 4, ["home", "gym"], "reps", "Back foot on a chair or bench, drop straight down.", ["knees"], { regression: "split_squat", progression: "pistol_box" }),
  m("pistol_box", "Pistol squat to box", "legs", 5, ["home", "gym"], "reps", "One leg, sit back to the box, stand without the other foot touching.", ["knees"], { regression: "bulgarian" }),
  m("glute_bridge", "Glute bridge", "legs", 1, ["home", "travel"], "reps", "Heels close, squeeze up, hold for one breath at the top.", []),
  m("goblet_squat", "Goblet squat", "legs", 2, ["gym"], "reps", "Dumbbell at chest, elbows inside the knees at the bottom.", ["knees"]),
  m("leg_press", "Leg press", "legs", 3, ["gym"], "reps", "Feet mid-plate, lower until knees at 90°, don't lock out.", ["knees"]),
  m("rdl", "Romanian deadlift", "legs", 4, ["gym"], "reps", "Hinge at the hips, bar close, flat back, feel the hamstrings.", ["low_back"]),
  m("seated_leg_ext", "Seated leg extension", "legs", 1, ["home", "travel", "gym"], "reps", "Sit tall, straighten one leg, hold a second at the top.", [], { seated: true }),
  // PRD 7 · the monthly Test Set move (30-second chair stand)
  m("chair_stand_30s", "Chair stands", "legs", 1, ["home", "gym", "travel"], "reps", "Arms crossed. Stand all the way up, sit all the way down. Count every full stand in 30 seconds.", []),
  // CORE
  m("dead_bug", "Dead bug", "core", 1, ["home", "travel"], "reps", "Back flat on the floor, opposite arm and leg extend, slow.", []),
  m("hollow_hold", "Hollow hold", "core", 3, ["home", "travel", "gym"], "seconds", "Low back pressed into the floor, arms and legs hovering.", ["low_back"]),
  m("side_plank", "Side plank", "core", 2, ["home", "travel", "gym"], "seconds", "Elbow under shoulder, hips lifted, body straight.", ["shoulders"]),
  m("bird_dog", "Bird dog", "core", 1, ["home", "travel"], "reps", "On all fours, extend opposite arm and leg, don't rotate.", ["wrists", "knees"]),
  m("leg_raise", "Lying leg raise", "core", 3, ["home", "travel", "gym"], "reps", "Hands under hips, legs straight, lower slow.", ["low_back"]),
  m("v_up", "V-up", "core", 4, ["home", "travel", "gym"], "reps", "Fold at the hips, hands to toes.", ["low_back"]),
  m("hanging_knee_raise", "Hanging knee raise", "core", 5, ["gym", "home"], "reps", "Hang, bring knees to chest, no swing.", ["shoulders"]),
  m("cable_crunch", "Cable crunch", "core", 3, ["gym"], "reps", "Kneeling, rope at the forehead, crunch down.", []),
  m("pallof_press", "Pallof press", "core", 2, ["gym", "home"], "reps", "Band or cable at chest, press straight out, resist the twist.", []),
  m("seated_twist", "Seated twist", "core", 1, ["home", "travel", "gym"], "reps", "Sit tall, rotate slow to each side.", [], { seated: true }),
  // CARDIO
  m("march_in_place", "March in place", "cardio", 1, ["home", "travel"], "seconds", "Knees up, arms swinging, breathe.", [], { seated: false }),
  m("step_ups", "Step-ups", "cardio", 2, ["home", "travel", "gym"], "reps", "Full foot on the step, drive through the heel.", ["knees"]),
  m("jumping_jacks", "Jumping jacks", "cardio", 2, ["home", "travel"], "seconds", "Land soft. Half-jacks if your knees say so.", ["knees", "low_impact"]),
  m("mountain_climbers", "Mountain climbers", "cardio", 3, ["home", "travel", "gym"], "seconds", "Hips low, knees drive to chest, steady pace.", ["wrists", "shoulders"]),
  m("burpee_step", "Step-back burpee", "cardio", 3, ["home", "travel"], "reps", "Step back, not jump. Stand tall at the top.", ["wrists", "low_impact"]),
  m("burpee", "Burpee", "cardio", 5, ["home", "travel", "gym"], "reps", "Chest to floor, jump at the top.", ["wrists", "knees", "low_impact"]),
  m("high_knees", "High knees", "cardio", 4, ["home", "travel"], "seconds", "Fast feet, knees to hip height.", ["knees", "low_impact"]),
  m("rower", "Rowing machine", "cardio", 3, ["gym"], "seconds", "Legs, then back, then arms. Reverse on the way in.", []),
  m("bike_sprint", "Bike intervals", "cardio", 4, ["gym"], "seconds", "20 hard, 40 easy. Keep the cadence up.", []),
  m("seated_punches", "Seated punches", "cardio", 1, ["home", "travel", "gym"], "seconds", "Sit tall, alternate punches fast, breathe out on each.", [], { seated: true }),
  // MOBILITY
  m("neck_rolls", "Neck rolls", "mobility", 1, ["home", "travel", "gym"], "reps", "Slow half-circles, chin to each shoulder.", [], { seated: true }),
  m("cat_cow", "Cat-cow", "mobility", 1, ["home", "travel"], "reps", "On all fours, arch and round, move with your breath.", ["wrists", "knees"]),
  m("hip_hinge", "Hip hinge", "mobility", 1, ["home", "travel", "gym"], "reps", "Hands on hips, push them back, flat back, feel the hamstrings.", []),
  m("wall_reach", "Wall reach", "mobility", 1, ["home", "travel", "gym"], "reps", "Back to the wall, arms slide up like a snow angel.", ["shoulders"], { seated: true }),
  m("worlds_greatest", "World's greatest stretch", "mobility", 2, ["home", "travel", "gym"], "reps", "Lunge, elbow to instep, rotate and reach up.", ["knees"]),
  m("deep_squat_hold", "Deep squat hold", "mobility", 3, ["home", "travel", "gym"], "seconds", "Heels down, elbows push knees out, breathe.", ["knees"]),
  m("couch_stretch", "Couch stretch", "mobility", 3, ["home"], "seconds", "Back foot up on the couch, squeeze the glute, tall posture.", ["knees"]),
  m("thoracic_rot", "Thoracic rotation", "mobility", 2, ["home", "travel", "gym"], "reps", "Side-lying, top arm opens like a book.", []),
  m("ankle_circles", "Ankle circles", "mobility", 1, ["home", "travel", "gym"], "reps", "Big slow circles both directions.", [], { seated: true }),
  m("pigeon", "Pigeon stretch", "mobility", 4, ["home", "gym"], "seconds", "Shin across, square the hips, fold forward slow.", ["knees"]),
];

export const MOVEMENT_BY_ID: Record<string, Movement> = Object.fromEntries(MOVEMENTS.map((x) => [x.id, x]));

const L = (track: Track, level: 1 | 2 | 3 | 4 | 5, requirements: CrownLevel["requirements"], gym: CrownLevel["gym"]): CrownLevel => ({ track, level, requirements, gym });

export const CROWN_LEVELS: CrownLevel[] = [
  L("push", 1, [{ movement: "wall_pushup", target: 10 }, { movement: "incline_pushup", target: 5 }], [{ movement: "incline_bench", target: 8 }, { movement: "plank", target: 15 }]),
  L("push", 2, [{ movement: "incline_pushup", target: 10 }, { movement: "knee_pushup", target: 8 }], [{ movement: "incline_bench", target: 10 }, { movement: "flat_bench", target: 6 }]),
  L("push", 3, [{ movement: "knee_pushup", target: 12 }, { movement: "full_pushup", target: 8 }], [{ movement: "flat_bench", target: 8 }, { movement: "plank", target: 30 }]),
  L("push", 4, [{ movement: "full_pushup", target: 12 }, { movement: "pike_pushup", target: 6 }], [{ movement: "flat_bench", target: 10 }, { movement: "overhead_press", target: 6 }]),
  L("push", 5, [{ movement: "full_pushup", target: 20 }, { movement: "diamond_pushup", target: 8 }, { movement: "plank", target: 30 }], [{ movement: "overhead_press", target: 10 }, { movement: "flat_bench", target: 12 }, { movement: "plank", target: 45 }]),
  L("pull", 1, [{ movement: "towel_row", target: 10 }, { movement: "superman", target: 15 }], [{ movement: "lat_pulldown", target: 8 }, { movement: "band_pullapart", target: 12 }]),
  L("pull", 2, [{ movement: "door_row", target: 10 }, { movement: "superman", target: 25 }], [{ movement: "lat_pulldown", target: 10 }, { movement: "seated_row", target: 8 }]),
  L("pull", 3, [{ movement: "table_row", target: 8 }, { movement: "door_row", target: 15 }], [{ movement: "seated_row", target: 10 }, { movement: "lat_pulldown", target: 12 }]),
  L("pull", 4, [{ movement: "negative_pullup", target: 5 }, { movement: "table_row", target: 12 }], [{ movement: "negative_pullup", target: 5 }, { movement: "seated_row", target: 12 }]),
  L("pull", 5, [{ movement: "pullup", target: 5 }, { movement: "table_row", target: 15 }], [{ movement: "pullup", target: 5 }, { movement: "lat_pulldown", target: 15 }]),
  L("legs", 1, [{ movement: "chair_squat", target: 10 }, { movement: "glute_bridge", target: 10 }], [{ movement: "leg_press", target: 10 }, { movement: "glute_bridge", target: 10 }]),
  L("legs", 2, [{ movement: "bodyweight_squat", target: 15 }, { movement: "glute_bridge", target: 15 }], [{ movement: "goblet_squat", target: 10 }, { movement: "leg_press", target: 12 }]),
  L("legs", 3, [{ movement: "split_squat", target: 8 }, { movement: "bodyweight_squat", target: 20 }], [{ movement: "goblet_squat", target: 12 }, { movement: "rdl", target: 8 }]),
  L("legs", 4, [{ movement: "bulgarian", target: 8 }, { movement: "split_squat", target: 12 }], [{ movement: "bulgarian", target: 8 }, { movement: "rdl", target: 10 }]),
  L("legs", 5, [{ movement: "pistol_box", target: 5 }, { movement: "bulgarian", target: 12 }], [{ movement: "pistol_box", target: 5 }, { movement: "rdl", target: 12 }]),
  L("core", 1, [{ movement: "dead_bug", target: 10 }, { movement: "bird_dog", target: 10 }], [{ movement: "dead_bug", target: 10 }, { movement: "pallof_press", target: 10 }]),
  L("core", 2, [{ movement: "side_plank", target: 20 }, { movement: "dead_bug", target: 16 }], [{ movement: "side_plank", target: 20 }, { movement: "pallof_press", target: 12 }]),
  L("core", 3, [{ movement: "hollow_hold", target: 20 }, { movement: "leg_raise", target: 10 }], [{ movement: "cable_crunch", target: 12 }, { movement: "hollow_hold", target: 20 }]),
  L("core", 4, [{ movement: "v_up", target: 10 }, { movement: "hollow_hold", target: 30 }], [{ movement: "hanging_knee_raise", target: 8 }, { movement: "cable_crunch", target: 15 }]),
  L("core", 5, [{ movement: "v_up", target: 15 }, { movement: "hollow_hold", target: 45 }, { movement: "side_plank", target: 45 }], [{ movement: "hanging_knee_raise", target: 12 }, { movement: "hollow_hold", target: 45 }]),
  L("cardio", 1, [{ movement: "march_in_place", target: 60 }], [{ movement: "rower", target: 120 }]),
  L("cardio", 2, [{ movement: "step_ups", target: 20 }, { movement: "jumping_jacks", target: 45 }], [{ movement: "rower", target: 180 }, { movement: "step_ups", target: 20 }]),
  L("cardio", 3, [{ movement: "mountain_climbers", target: 30 }, { movement: "burpee_step", target: 8 }], [{ movement: "bike_sprint", target: 180 }, { movement: "mountain_climbers", target: 30 }]),
  L("cardio", 4, [{ movement: "high_knees", target: 45 }, { movement: "burpee_step", target: 12 }], [{ movement: "bike_sprint", target: 300 }, { movement: "high_knees", target: 45 }]),
  L("cardio", 5, [{ movement: "burpee", target: 10 }, { movement: "high_knees", target: 60 }], [{ movement: "burpee", target: 10 }, { movement: "rower", target: 300 }]),
  L("mobility", 1, [{ movement: "neck_rolls", target: 6 }, { movement: "hip_hinge", target: 10 }, { movement: "wall_reach", target: 8 }], [{ movement: "neck_rolls", target: 6 }, { movement: "hip_hinge", target: 10 }, { movement: "wall_reach", target: 8 }]),
  L("mobility", 2, [{ movement: "cat_cow", target: 10 }, { movement: "thoracic_rot", target: 8 }], [{ movement: "cat_cow", target: 10 }, { movement: "thoracic_rot", target: 8 }]),
  L("mobility", 3, [{ movement: "worlds_greatest", target: 6 }, { movement: "deep_squat_hold", target: 30 }], [{ movement: "worlds_greatest", target: 6 }, { movement: "deep_squat_hold", target: 30 }]),
  L("mobility", 4, [{ movement: "couch_stretch", target: 45 }, { movement: "deep_squat_hold", target: 45 }], [{ movement: "pigeon", target: 45 }, { movement: "deep_squat_hold", target: 45 }]),
  L("mobility", 5, [{ movement: "pigeon", target: 60 }, { movement: "deep_squat_hold", target: 60 }], [{ movement: "pigeon", target: 60 }, { movement: "deep_squat_hold", target: 60 }]),
];

export const TRACKS: { id: Track; name: string }[] = [
  { id: "push", name: "Push" }, { id: "pull", name: "Pull" }, { id: "legs", name: "Legs" },
  { id: "core", name: "Core" }, { id: "cardio", name: "Cardio" }, { id: "mobility", name: "Mobility" },
];

export const GOAL_MINUTES = { casual: 5, regular: 10, serious: 15 } as const;
export const TIER_SCALE = { foundation: 0.7, standard: 1, advanced: 1.3 } as const;

export function crownLevel(track: Track, level: number): CrownLevel {
  return CROWN_LEVELS.find((c) => c.track === track && c.level === Math.min(5, Math.max(1, level)))!;
}
