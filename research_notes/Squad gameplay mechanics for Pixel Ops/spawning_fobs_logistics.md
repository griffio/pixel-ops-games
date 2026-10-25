# Squad (OWI): spawning, FOBs and logistics, with exact numbers, for Pixel Ops

Version context: the newest build found is Squad **10.6** (released 1 Oct 2026), followed by hotfixes 10.6.1 (7 Oct 2026) and 10.6.2 (15 Oct 2026) — [PatchBot 10.6](https://patchbot.io/games/squad/articles/1644-update-106-release-notes); [PatchBot 10.6.1](https://patchbot.io/games/squad/articles/1704-hotfix-1061-release-notes); [PatchBot 10.6.2](https://patchbot.io/games/squad/articles/1807-hotfix-1062-release-notes). Other milestones: 8.0 (10 Jun 2024), 8.1 (25 Sep 2024), 8.2 (2 Dec 2024), 9.0 (2 Sep 2025), 10.0 (10 Nov 2025), 10.3 (17 Feb 2026) — [Release Versions, Squad Wiki](https://squad.fandom.com/wiki/Release_Versions). The OWI pages give slightly different dates: 9.0 on 4 Sep 2025 and 10.0 on 12 Nov 2025 — [9.0 notes](https://www.joinsquad.com/updates/squad-9-0-release-notes); [10.0 notes](https://www.joinsquad.com/updates/squad-10-0-patch-notes).
Source caveat: most mechanic numbers come from the Official Squad Wiki (squad.fandom.com). I pulled the raw wikitext through the MediaWiki API, and each page's last-edit date is noted. Patch notes from 8.0 to 10.6 do not change the core rally, radio or HAB numbers, so the wiki figures are probably still current. In-game values can also be changed by server config, so treat any number I could not tie to a patch note as "wiki-stated".

## 1. Spawn timers and spawn waves (main, HAB, rally)

### Takeaway
Squad has two respawn models. The main base and HABs use a **personal timer**: you can spawn once you have been incapacitated or dead for about 30 s. Rally points use a **squad wave**: a fixed, repeating 60 s cycle, and you must have been dead at least 20 s before a wave to join it. Older sources give other numbers (main 25 s and FOB/HAB 45 s at V1.0; rally minimum 30 s in a 2019 build), so the base timer has moved over the years.

### Cited Findings
- "Rally Points are the only spawn points that use wave spawns. When a Rally Point is deployed, a timer will begin to count down from 60 seconds to 0 repeatedly… The minimum time to wait is 20 seconds, so if a player dies with 15 seconds remaining on the timer, they will have to wait a total of 75 seconds." (wiki page last edited 27 Aug 2025) — [Rally Point, Squad Wiki](https://squad.fandom.com/wiki/Rally_Point)
- "Other spawn points, such as spawn bunkers and main base, only require the player to have been incapacitated or dead for 30 seconds before you can spawn on." — [Rally Point, Squad Wiki](https://squad.fandom.com/wiki/Rally_Point)
- "Individual players each have a 30-second respawn timer to spawn on a spawn bunker… No confirmation button is necessary, so if the timer is 0 for that player, they will instantly spawn" (edited 28 Jul 2025) — [Spawn Bunker, Squad Wiki](https://squad.fandom.com/wiki/Spawn_Bunker)
- Rally points are "on a continuous 60-second wave spawn timer… players can potentially spawn on one after being incapacitated or dead for just 20 seconds"; spawn bunkers require 30 s (edited 9 Jul 2024) — [Spawn points, Squad Wiki](https://squad.fandom.com/wiki/Spawn_points)
- A community guide agrees: rallies spawn "on a fixed second of each minute", you "must be dead 20 seconds before the wave", and missing a wave means about 75 s in total — [Squad Academy: Rallies](https://squadacademy.me/tactics/rallies/)
- Older, conflicting figure: "As of V1.0, the standard respawn timer for FOB is 45 seconds, starting when the player enters the Incapacitated state… return to the Main Base, for which the timer only requires 25 seconds." The timer starts when you go down, so time spent incapacitated counts toward it, and pressing "give up" early gains nothing (edited 6 Jul 2024, but the text is V1.0-era, ~2020) — [Spawning, Squad Wiki](https://squad.fandom.com/wiki/Spawning)
- A community guide also gives a 45 s HAB delay from incapacitation, with no wave (seen only in a search snippet; the page would not load) — [Rusty In Places, Squad Core Mechanics](https://www.rustyinplaces.org/squad/334-squad-core-mechanics)
- A 26 Nov 2019 build ("B17") reportedly raised the minimum wait to join a rally wave from 20 s to 30 s. This is from a search snippet only; the page returned 403 and I could not confirm whether it was the live game or a test build — [SteamDB patch notes](https://steamdb.info/patchnotes/4429407/)
- 7.2 known issue: "spawn timers on HABs and rally points can become desynced" (search snippet) — [Squad 7.2 release notes](https://www.joinsquad.com/updates/squad-7-2-release-notes)
- Tickets: −1 per infantry death (bleed-out, give up or console respawn), −2 per Commander death — [Tickets, Squad Wiki](https://squad.fandom.com/wiki/Tickets)

### Inferences
- Squad's "waves" belong to each **rally**, not to the team: every rally runs its own 60 s clock, while HAB and main spawns are individual and instant once the personal timer is up.
- The best current read is: personal timer about 30 s (main and HAB), rally wave 60 s, rally join cut-off 20 s. The 45 s and 25 s figures are older.
- **Pixel Ops comparison: differs.** Pixel Ops uses a flat 15 s respawn for every spawn type, and its "squad wave" groups squadmates who died within 8 s of each other. Squad instead gives the fast, team-wide spawn (HAB, ~30 s) one timer and the cheap, squad-only spawn (rally) a slower 60 s wave. To copy that trade-off: main/FOB about 15 s personal; rally on a fixed 30 s wave with about a 10 s cut-off, scaled down for the smaller map.

### Gaps
- No 2025–2026 patch note states the current base respawn timer. The 30 s figure rests on wiki pages edited in 2024–2025. Server admins may be able to change these values; I did not confirm that.
- I could not verify whether the 2019 change to a 30 s rally minimum stuck (the wiki and Squad Academy both say 20 s now).

## 2. Main base: when players must spawn there, protection zone, vehicle spawning

### Takeaway
Main is the only spawn at round start (apart from temporary spawns on some maps). It cannot be destroyed, it restocks all ammo on spawn, it has unlimited supplies, and it spawns all vehicles. A 400 m "protection zone" (the "Dome of Defense") makes it untouchable. A 3-minute staging phase holds everyone inside at the start.

### Cited Findings
- "At the beginning of a match, players can only spawn at their respective main base. The only exception to this is temporary spawn points… available at the start of the match for approximately 5 minutes" (usually for unconventional factions or Invasion defenders) — [Spawn points, Squad Wiki](https://squad.fandom.com/wiki/Spawn_points)
- Main "can never be destroyed or deactivated", is usually in a map corner, "includes infinite supply for logistics and vehicle spawns", and spawning there "will restock all ammo", unlike FOB or rally spawns (persistent ammo). Simply entering main does not refill ammo; ammo crates and repair stations there do (edited 17 Feb 2026) — [Main Base, Squad Wiki](https://squad.fandom.com/wiki/Main_Base)
- Staging phase: "3 minutes by default" during which players "cannot leave a certain area around the main base" and cannot start vehicle engines. Squads may "hold spawns" until a HAB or rally is up — [Main Base, Squad Wiki](https://squad.fandom.com/wiki/Main_Base)
- Dome of Defense / "Protection Zone": a "radius of 400 meters [that] destroys all projectiles and vehicles and pushes back enemy soldiers"; friendlies "cannot fire within" it either; helicopters above 400 m altitude are vulnerable — [Main Base, Squad Wiki](https://squad.fandom.com/wiki/Main_Base)
- Vehicles: "With a few exceptions, all vehicles start and respawn at a team's main base"; some (MBTs, helicopters, IFVs) are on delayed timers; Invasion defenders may get a temporary forward main. Main repair stations have unlimited supply — [Main Base, Squad Wiki](https://squad.fandom.com/wiki/Main_Base)
- Recent tuning of delays (9.0, Sep 2025): the first helicopter spawn for Motorized battlegroups went from 6 to 10 min; the first MBT spawn from 15 to 20 min; Armored battlegroups gained a 10 min delay on extra MBTs; Skirmish gets a light vehicle and a truck on a delay — [Squad 9.0 release notes](https://www.joinsquad.com/updates/squad-9-0-release-notes)
- 10.6 (Oct 2026): "Grenades are no longer usable in main base"; players can now aim down sights in main — [PatchBot 10.6](https://patchbot.io/games/squad/articles/1644-update-106-release-notes)
- A radio must be at least 150 m from main (see section 4) — [Forward Operating Base, Squad Wiki](https://squad.fandom.com/wiki/Forward_Operating_Base)

### Inferences
- Players are never forced to spawn at main except at round start or when they have no other spawn. Main is simply the fallback that never fails, and it is the only place that restores a full loadout for free.
- **Pixel Ops comparison: mostly have.** Main spawns, refilling trucks at main, and the 140 m no-FOB zone around the enemy main all exist. Pixel Ops lacks a "free full restock only at main" rule (it has no ammo) and an explicit no-fire protection zone. On a 1 km map, Squad's 400 m dome would scale to about 40–60 m.

### Gaps
- No source gives the exact staging-area radius or per-map dome radii (the 400 m figure is the wiki's general value).

## 3. Rally points

### Takeaway
A rally is the Squad Leader's personal, squad-only, wave-timed spawn. It needs one squadmate within 8 m to place, has a 120 s cooldown between placements, cannot be placed with an enemy within 50 m, and is destroyed ("burned") instantly by any single enemy within 30 m. Spawns have been unlimited since Alpha 12; before that a rally gave 9 spawns. It refills for 50 ammo points.

### Cited Findings
- Who places it: the Squad Leader kit, as an inventory item. "Each squad can have one active rally point at a time." "The standard Squad Leader kit requires at least one other member of the squad to be within 8 meters to place a Rally Point." It "can be placed anywhere on the map" outside the exclusions below. SLs can pick their own rally back up — [Rally Point, Squad Wiki](https://squad.fandom.com/wiki/Rally_Point)
- Cooldown and refill: "can only be placed down once before needing a rearm. Rally points cost 50 ammo to rearm… there is a cooldown of 120 seconds before another can be placed." Placing it within 50 m of an enemy fails, and "the 120-second timer will reset"; appointing a new SL also resets the timer — [Rally Point, Squad Wiki](https://squad.fandom.com/wiki/Rally_Point)
- Squad Academy confirms the 120 s cooldown "even if it was blocked", the 50 m placement block, and the 50-ammo refill — [Squad Academy: Rallies](https://squadacademy.me/tactics/rallies/). A Rusty In Places guide gives 150 s instead (search snippet only), which conflicts with the 120 s figure — [Rusty In Places](https://www.rustyinplaces.org/squad/334-squad-core-mechanics)
- Burn: "If any enemy, including those inside a vehicle, moves within 30 meters of a Rally Point, it will be destroyed." It therefore also works as a flank alarm — [Rally Point, Squad Wiki](https://squad.fandom.com/wiki/Rally_Point). Squad Academy agrees: it burns "the moment an enemy gets within 30 m"; one enemy is enough; the rally is audible to about 35 m — [Squad Academy: Rallies](https://squadacademy.me/tactics/rallies/)
- Spawn count: "As of V12, Rally Points now have unlimited respawns. Before this, each Rally Point could only be spawned 9 times before it would disappear." — [Rally Point, Squad Wiki](https://squad.fandom.com/wiki/Rally_Point)
- Faction variants: Insurgent "buddy rally" (since Alpha 13), where a dead SL can deploy their rally next to an existing friendly rally, with a 60 s cooldown — [Rally Point, Squad Wiki](https://squad.fandom.com/wiki/Rally_Point). In 9.0 (Sep 2025), Canadian Resistance Forces SL roles "carry up to three rallies with a cheap 30-ammo rearm" — [Squad 9.0 release notes](https://www.joinsquad.com/updates/squad-9-0-release-notes)
- Rally refill price in the ammo-crate table: Rally Point 50 ammo points — [Ammo Crate, Squad Wiki](https://squad.fandom.com/wiki/Ammo_Crate)
- Placement advice (not a rule): rallies "should not be placed too close to Spawn Bunkers or objectives", to keep a backup spawn — [Rally Point, Squad Wiki](https://squad.fandom.com/wiki/Rally_Point)
- Mode dependence: 9.0 Skirmish "heavy reliance will be placed on rally points"; 10.6 added logistics vehicles to Skirmish "so teams no longer have to exclusively rely on Rally Points" — [Squad 9.0](https://www.joinsquad.com/updates/squad-9-0-release-notes); [PatchBot 10.6](https://patchbot.io/games/squad/articles/1644-update-106-release-notes)

### Inferences
- The only hard placement exclusion found is the 50 m enemy check. No minimum distance from flags, HABs, main or other rallies appears in any source, so the game relies on the 30 m burn radius to keep rallies away from fights.
- The burn radius (30 m) is smaller than the placement block (50 m), which leaves a 20 m buffer so a fresh rally is not burned immediately.
- **Pixel Ops comparison: lacks.** A direct port for 4-man squads: the SL places one rally with 1 squadmate within about 8 m; 60–90 s cooldown; blocked if an enemy is within about 30 m; burned instantly by 1 enemy within about 15–20 m; unlimited spawns on a fixed wave; costs nothing or a small ammo/supply refill at a truck or FOB. The CPU should place rallies behind cover, and the AI should hunt them as a flank target.

### Gaps
- No source states a current rally **lifetime** or despawn-when-unused timer. Older guides apparently differ on this; the first search summary mentioned "different unused-despawn behavior" but I could not verify it.
- I could not confirm whether the 8 m squadmate radius changed in recent versions (wiki only).

## 4. FOB radio (radio hub)

### Takeaway
Only the Squad Leader places the radio, and placement is **instant**. It needs a logistics vehicle within 30 m plus one teammate within 30 m. It must be at least 150 m from main and at least 400 m from other friendly radios (300 m on small maps; the exact value is set per layer). It costs no supplies itself, starts with 0 supplies, and claims a 150 m build radius. Enemies dig or blow it down. At 0 HP it goes into a 75 s "bleed": if not repaired to 50 HP, the owning team loses 20 tickets and every tech structure and emplacement on the FOB is deleted.

### Cited Findings
- Requirements: "You must be a Squad Leader"; needs "A logistics vehicle within 30m", "An additional team member within 30m", and "Lead Crewman and Lead Pilots require three teammates nearby." The radio must be "At least 150 meters from main", "At least 400 meters from other friendly radios", "On smaller maps, only 300 meters are required." "Placement is instant and does not require construction with an entrenching tool. A map's unique exclusion radius is available in the 'Layer Info' tab" (edited 5 Jul 2024) — [Forward Operating Base, Squad Wiki](https://squad.fandom.com/wiki/Forward_Operating_Base)
- Map overlay: "The 300 meter exclusion radius and 150 meter build radius of radios can be viewed on the map" — [Forward Operating Base, Squad Wiki](https://squad.fandom.com/wiki/Forward_Operating_Base). Per-map exclusion radii appear to date from the v2.9 "FOB Exclusion Radius content" (2021, search snippet) — [Steam discussion, HAB proxy/v2.9](https://steamcommunity.com/app/393380/discussions/6/3048356660224565852/)
- Starting supplies: "FOBs start with 0 Construction Points… and 0 Ammo Points"; capacity "20,000 CP + 20,000 AP" (Oct 2018 recap) — [Forward Operating Base, Squad Wiki](https://squad.fandom.com/wiki/Forward_Operating_Base)
- Noise: radios are audible to about 40 m at maximum volume and about 10 m at normal settings — [Forward Operating Base, Squad Wiki](https://squad.fandom.com/wiki/Forward_Operating_Base)
- Damage: dig it down by holding right-click with the entrenching tool, or use heavy weapons, demo charges or IEDs. "Damaging the radio hub to below 75% will disable any connected Spawn Bunkers." — [Forward Operating Base, Squad Wiki](https://squad.fandom.com/wiki/Forward_Operating_Base)
- Bleed: "If the radio is destroyed, it is put into bleedout. The friendly team has 75 seconds, as of v4.4, to rebuild… The timer can be stopped by building the radio back up to a certain threshold… If a radio bleeds out, the team that lost the radio will lose 20 tickets." — [Forward Operating Base, Squad Wiki](https://squad.fandom.com/wiki/Forward_Operating_Base). The v4.4 notes (18 Apr 2023): "Increased FOB bleed out time to 75 seconds and decreased the health required for a FOB to stop bleeding to 50 hp" — [Squad v4.4 release notes](https://www.joinsquad.com/archive/squad-update-v4-4-release-notes-34ce1)
- Self-removal: "if a friendly player digs down the radio… the radio is instantly destroyed instead of bleeding out and the team will lose no tickets", and this works even during a bleed — [Forward Operating Base, Squad Wiki](https://squad.fandom.com/wiki/Forward_Operating_Base)
- What is left behind: "all tech structures (HABs, ammo crates, vehicle repair stations) and emplacements (TOW launchers, MG bunkers)… will be destroyed as well. Fortifications such as sandbags and HESCO blocks will remain." — [Forward Operating Base, Squad Wiki](https://squad.fandom.com/wiki/Forward_Operating_Base); [Deployables, Squad Wiki](https://squad.fandom.com/wiki/Deployables)
- Ticket table: "−20 per Forward Operating Base (FOB; 'Radio') lost" — [Tickets, Squad Wiki](https://squad.fandom.com/wiki/Tickets)
- History: before Alpha 9 the radio itself was the spawn point. Since Alpha 10 (Feb 2018) supplies can be moved between FOBs — [Forward Operating Base, Squad Wiki](https://squad.fandom.com/wiki/Forward_Operating_Base)
- Commander tie-in: a conventional Commander must be within about 30 m of a fully built friendly HAB to call some abilities; unconventional Commanders can use a HAB or a vehicle (edited Apr 2026) — [Commander, Squad Wiki](https://squad.fandom.com/wiki/Commander)

### Inferences
- In Squad the radio is a free, instant "claim" that sets the spacing grid and the build zone. All the cost sits in the supplies you then haul in, and the 20-ticket bleed makes a lost radio a real loss.
- I found no rule against placing a radio near objectives or enemies. Spacing to friendly radios and to main is the only geometric limit.
- **Pixel Ops comparison: differs.** Pixel Ops' FOB is a single 20 s engineer build next to a 50-supply truck, with 80 m spacing and no placement within 140 m of the enemy main. Squad's spacing is relative to the 150 m build radius: friendly radios must be roughly 2–2.7× the build radius apart (400 m, or 300 m on small maps, against a 150 m radius), and the radio must be at least 150 m from the team's own main. Pixel Ops lacks a radio-vs-HAB split, digging down, a bleed timer with a ticket penalty, the "friendly dig-down = no penalty" rule, and cascading deletion of tech structures (fortifications survive).

### Gaps
- Number of shovel swings or seconds to dig a radio from full to 0 HP, and the radio's HP value: not found.
- Whether a destroyed radio leaves a **respawn or placement cooldown** for that area: no source mentions one. The wiki only describes the bleed and the cascade, so this may not exist.

## 5. HAB / Spawn Bunker (the spawn point separate from the radio)

### Takeaway
The HAB (conventional) or Hideout (unconventional) is the team-wide FOB spawn. It costs 500 construction points (100 for Hideouts), is limited to 1 per FOB (with exceptions), must be shovel-built, and becomes active 30 s after completion. It is disabled when enough enemies come close: the radius grows 10 m per enemy, from 2 enemies at 20 m to 9 at 90 m (v4.4, Apr 2023). It is also disabled when it or the radio is damaged. Since 10.6 (Oct 2026) HABs include a built-in ammo crate, and OWI has said it plans to roll that back.

### Cited Findings
- Cost and limit: "HABs cost 500 build, while Hideouts cost only 100." "Most factions… can only build 1 Spawn Bunker per Forward Operating Base", except all Insurgent units (2 hideouts since Alpha 13) and the Logistics/Support unit type (since 7.2). It "must be constructed with the Entrenching tool… Spawn Bunkers do not have to be fully dug up in order for players to spawn on" (edited 28 Jul 2025) — [Spawn Bunker, Squad Wiki](https://squad.fandom.com/wiki/Spawn_Bunker). Deployables table: Spawn Bunker 500 CP, FOB limit 1 for conventional; IMF 100/1; INS 100/2 — [Deployables, Squad Wiki](https://squad.fandom.com/wiki/Deployables). 9.0 gave MEI "+1 extra HAB available per FOB"; 8.0 gave US 497th Support "an extra HAB" — [Squad 9.0](https://www.joinsquad.com/updates/squad-9-0-release-notes); [Squad 8.0](https://www.joinsquad.com/updates/squad-8-0-release-notes)
- Activation: "Spawn bunkers take 30 seconds to activate once built." — [Spawn Bunker, Squad Wiki](https://squad.fandom.com/wiki/Spawn_Bunker). History: v2.0 (2020) introduced the activation delay at "10 seconds". It applies after any of the 3 ways a HAB can be disabled, to stop "Teleportation hopping" and to give attackers "breathing room… after overrunning a HAB" — [WP - Update to v2.0, Squad Wiki](https://squad.fandom.com/wiki/WP_-_Update_to_v2.0)
- Overrun ("proxy") scaling, v4.4 (18 Apr 2023): "HAB spawn disable range has been increased to 90 meters… 2 players at 20 meters, 3 players at 30 meters… 9 players at 90 meters" — [Squad v4.4 release notes](https://www.joinsquad.com/archive/squad-update-v4-4-release-notes-34ce1). The wiki puts the same rule in prose: "For every enemy infantry in close proximity of the hab, the range… is increased by 10 meters… At least 2 players are required to proxy (being able to do so at 20m)." "If the enemies leave the radius or are killed/incapacitated, the spawn point reactivates after 30 seconds" — [Spawn Bunker, Squad Wiki](https://squad.fandom.com/wiki/Spawn_Bunker)
- Earlier versions: the scaling system first went live, by accident, in v2.9 (2021) with "2 soldiers… within 20m… 8 soldiers… within 80m". OWI's stated intent was that "the ability to deploy multiple FOBs/HABs in close proximity to the surrounding objective area should not be the primary means to take control of an objective" (search snippet). An older static rule was "2+ players within a 30 meter radius" — [Steam discussion](https://steamcommunity.com/app/393380/discussions/6/3048356660224565852/); [J4F: Squad v2.10](https://www.j4f.uk/post/squad-v2-10-released)
- Damage disable: once a HAB "reaches half hitpoints… it is no longer an active spawn and must be repaired… it will take 30 seconds to reactivate". The same applies if the radio is damaged one stage. Map icon states: inactive, active, blocked — [Spawn Bunker, Squad Wiki](https://squad.fandom.com/wiki/Spawn_Bunker)
- Ammo on spawn: with persistent ammo, HAB spawns keep "the ammo they died with (all players spawn with a minimum of magazines and bandages)" — [Spawn Bunker, Squad Wiki](https://squad.fandom.com/wiki/Spawn_Bunker)
- 10.6 (1 Oct 2026): "HABs will now automatically include an Ammo Crate inside, allowing for easier resupply without additional shoveling." — [PatchBot 10.6](https://patchbot.io/games/squad/articles/1644-update-106-release-notes). 10.6.1 (7 Oct 2026) moved the crate inside the HAB, made it die with the HAB (no "ghost crate"), and split the shared health pool that let .50 cal kill HABs through the crate. 10.6.2 (15 Oct 2026) added stakes showing where the crate will appear; the devs said they would "BACK OUT the changes to the system in our next hotfix" (search snippets) — [PatchBot 10.6.1](https://patchbot.io/games/squad/articles/1704-hotfix-1061-release-notes); [PatchBot 10.6.2](https://patchbot.io/games/squad/articles/1807-hotfix-1062-release-notes)

### Inferences
- Squad never counts friendlies against enemies in the overrun rule. Every source describes only enemy count against distance, so defenders cannot cancel an overrun by stacking bodies; they have to kill or push the enemies.
- Squad has no explicit "reduced HAB function near objectives" rule. The anti-stacking intent is enforced through radio spacing (300–400 m) plus the scaling overrun radius.
- **Pixel Ops comparison: lacks.** Pixel Ops' FOB is both the radio and the spawn. A scaled port for 4-man squads on 1 km: the FOB spawn is disabled when N enemies are within about N×5–6 m (2 enemies at about 10–12 m up to 4 at about 20–24 m), with a 10–15 s reactivation after they clear, and HAB damage below 50% also disables it. A separate HAB build costing about 25–40 supplies would recreate the "claim cheap, spawn costs extra" split.

### Gaps
- Number of shovel swings or seconds to build a HAB: not found (see section 7).
- Whether the 10.6 built-in ammo crate was actually removed in a later hotfix: no notes after 10.6.2 were found.

## 6. Supplies and logistics (construction points, ammo points, vehicles, costs, consumption)

### Takeaway
Squad has two supply pools: **construction (CP)**, used to build structures and repair vehicles, and **ammo (AP)**, used to rearm infantry, vehicles and emplacements. Supplies come from main (unlimited) or are moved between FOBs. A conventional logistics truck carries 3,000 points combined in any split the driver chooses, a logistics technical 1,400, a UH-60M 1,000 and an Mi-8 1,500. FOBs hold up to 20,000 of each type. Nothing decays: supplies are only spent when something uses them.

### Cited Findings
- Roles: "Construction is primarily used to build Deployables, most notably Spawn Bunkers. It is also used to repair vehicles through Repair Stations. Ammunition is used to resupply infantry, vehicles and emplacements." (edited 10 Feb 2026) — [Logistic System, Squad Wiki](https://squad.fandom.com/wiki/Logistic_System)
- Capacities: "A conventional army logistics truck… can carry a combined 3000 supply points, and a logistics technical can carry a total of 1400 supply points. A UH-60M helicopter can carry 1000 supply points and a Mi-8 helicopter can carry 1500… e.g. 3000 construction and 0 ammo… or 600 construction and 2400 ammo." — [Logistic System, Squad Wiki](https://squad.fandom.com/wiki/Logistic_System)
- Capacity changes over time: v8.2 (Dec 2024) cut the TLF BMC logistics truck "from 3000 to 2000" (search snippet) — [Squad v8.2 release notes](https://www.joinsquad.com/updates/squad---v8-2-release-notes). Alpha 10 (Feb 2018) introduced the driver-chosen mix, with a truck example of 2,000 combined (e.g. 1,500 ammo + 500 construction) (search snippet) — [WP - Update to v10, Squad Wiki](https://squad.fandom.com/wiki/WP_-_Update_to_v10). v2.0 changed the UH-60's fixed split from 500/500 to 400/600 — [WP - Update to v2.0, Squad Wiki](https://squad.fandom.com/wiki/WP_-_Update_to_v2.0). Every M113A3 variant "store[s] 600 supply" — [M113A3, Squad Wiki](https://squad.fandom.com/wiki/M113A3)
- Loading procedure: stop near main's repair station or inside a FOB radius, then use the F radial menu (Load/Unload Construction, Load/Unload Ammo). The buttons turn red if the vehicle is "moving too fast", not in range, full or empty. "Multiple players can load or unload supplies faster." "Logi vehicles spawn with half construction and half ammo." "Many non-logistics vehicles can carry a small amount of ammo" — [Logistic System, Squad Wiki](https://squad.fandom.com/wiki/Logistic_System)
- FOB storage: starts at 0/0, capacity 20,000 CP + 20,000 AP — [Forward Operating Base, Squad Wiki](https://squad.fandom.com/wiki/Forward_Operating_Base)
- Structure costs (Combined Arms defaults; Deployables page edited 10 Feb 2026), as CP / AP / limit per FOB:
  - **Tech structures:** HAB 500/–/1 (INS/IMF Hideout 100); Repair Station 500/–/1 (INS/IMF 300); Ammo Crate 100/–/unlimited.
  - **Fortifications:** HESCO Bunker 150/–/4; HESCO Wall 150; HESCO Block 50; Observation Tower 600/–/2; Indirect-fire shelter 300/–/3.
  - **Sandbags, wire, ladders:** Sandbag line/pillbox/crescent 25 conventional, 10 INS/IMF; Razor Wire 15 (10 INS/IMF); Ladder 25/–/5.
  - **Emplacements:** HMG tripod 200/50/2; HMG bunker 350/50/2; Mk19 AGL 200/50/2; TOW/Kornet/HJ-8 ATGM 600/500/1; Mortar 300/25/2; SPG-9 (INS/IMF) 600/500/3.
  - Source: [Deployables, Squad Wiki](https://squad.fandom.com/wiki/Deployables)
- 8.0 (Jun 2024) limits: "Conventional Support units can have a maximum of six bunkers and four observation towers per FOB. All other conventional units… four bunkers and two observation towers" — [Squad 8.0 release notes](https://www.joinsquad.com/updates/squad-8-0-release-notes)
- Ammo use by players (persistent ammo): spawning at a FOB or rally keeps the ammo you died with; main restocks. Rearming at an ammo crate "will draw ammo points from the Forward Operating Base it was constructed on" — [Ammo Crate, Squad Wiki](https://squad.fandom.com/wiki/Ammo_Crate); [Spawning, Squad Wiki](https://squad.fandom.com/wiki/Spawning)
- Rearm prices in ammo points per item (table dates from Alpha 13):
  - Field dressing 5; pistol mag 1; rifle stick mag 2 (stripper clip 1, drum 8); LMG 5–30 depending on belt size.
  - Grenade 10; UGL grenade 7 (smoke 10); LAT 30–35; HAT 30–90 (e.g. NLAW 90).
  - Demo charge 50; mine 35; IED 100.
  - Infantry sandbag 25; razor wire 25; rally point 50; ammo bag 100.
  - Switching kit at a crate costs that kit's full resupply cost.
  - Source: [Ammo Crate, Squad Wiki](https://squad.fandom.com/wiki/Ammo_Crate)
- Ammo bags: riflemen place them, each holds "up to 100 ammo points", and each player can have one in the world at a time — [Ammo Bag, Squad Wiki](https://squad.fandom.com/wiki/Ammo_Bag)
- Vehicles: a FOB repair station repairs "at the cost of construction points and resupply[s] its ammo at the expense of ammo points"; repairs stop when the FOB's points run out. Example full-rearm prices: M1A2 APFSDS 800 AP, M-ATV TOW 1,800 AP, M2A3 TOW 400 AP. Main-base repair stations are unlimited — [Repair Station, Squad Wiki](https://squad.fandom.com/wiki/Repair_Station); [Main Base, Squad Wiki](https://squad.fandom.com/wiki/Main_Base)
- Emplacements "start empty and unloaded upon finishing construction" and draw on FOB ammo to reload — [Deployables, Squad Wiki](https://squad.fandom.com/wiki/Deployables)
- Logistics vehicle ticket cost: −5 per logistics or transport vehicle lost — [Tickets, Squad Wiki](https://squad.fandom.com/wiki/Tickets)

### Inferences
- FOBs need **no upkeep**. No source mentions decay or drain over time; supplies only fall when something is built, rearmed or repaired. A FOB without ammo can still spawn players (once the HAB is built) but cannot rearm them, so the pressure to keep resupplying comes from ammo, not from decay.
- Squad's ratios: one conventional truck (3,000) pays for a HAB (500), an ammo crate (100), a repair station (500), a few bunkers and sandbags, and leaves about 1,500 for ammo. On a CP-only build, a HAB uses about 1/6 of a truck.
- **Pixel Ops comparison: partly have.** Pixel Ops has one supply type: trucks carry 100 and refill at main, the FOB kit needs 50, and sandbags cost 12. Squad's matching ratios: sandbags at about 1% of a truck (Pixel Ops is at 12%), HAB at about 17%, ammo crate at about 3%. Pixel Ops lacks a second "ammo" pool, ammo-point costs for rearming and kit swaps, persistent ammo (full restock only at main), FOB-to-FOB transfer, and helicopter or technical logistics with different capacities.

### Gaps
- No current per-faction capacity table (the wiki's vehicle tables are icons that did not survive the export). The 3,000/1,400/1,000/1,500 figures have no version date on the wiki.
- Repair speed: the wiki's phrase "Each construction point will repair 10 vehicle damage per second" is ambiguous and unconfirmed.
- Time to unload or load supplies (points per second): not found.

## 7. Building: shovels, construction time, deconstruction, who can build

### Takeaway
Only the SL places FOB deployables; Fireteam Leaders can place some fortifications. **Anyone with an entrenching tool** builds by holding left-click on the stakes and digs down (own or enemy structures) by holding right-click. More shovelers build faster. Digging works at half the build rate (Destroy −0.5 against Build 1.0). Deployables dug up before completion refund 80% of their cost (v2.0).

### Cited Findings
- Placement rights: "The SL can place any deployables while Fire Team Leaders can only place certain fortifications." Deployables go within 150 m of the radio — [Forward Operating Base, Squad Wiki](https://squad.fandom.com/wiki/Forward_Operating_Base); [Deployables, Squad Wiki](https://squad.fandom.com/wiki/Deployables)
- Building: "construction stakes appear… team members need to start the construction by using their shovels… hold the Left-Mouse-Button… Except for the Radio Hub, all objects need to be shoveled… The more people that shovel, the quicker the construction is finished." Three visual stages; a structure (e.g. an ammo crate) is usable only at the final stage — [Deployables, Squad Wiki](https://squad.fandom.com/wiki/Deployables)
- Deconstruction: hold right-click with a shovel "on your own or enemy deployables". Damage reverses through the same 3 stages, and "reaching the second stage while destroying an object renders it unusable", so digging an enemy HAB to stage 2 stops spawns before it is fully gone. Explosives, rockets and large-calibre vehicle guns also work — [Deployables, Squad Wiki](https://squad.fandom.com/wiki/Deployables)
- Shovel stats: "Build Health Amount 12", "Build Percentage 1.0", "Destroy Percentage −0.5". LMB builds, RMB deconstructs (edited Apr 2024) — [Entrenching Tool, Squad Wiki](https://squad.fandom.com/wiki/Entrenching_Tool)
- Refund: "Refunds 80% of the placed deployable cost, if it was dug down without being built fully after placement" (v2.0). 9.0 fixed "unfinished FOB deployables not refunding some of their resources" — [WP - Update to v2.0, Squad Wiki](https://squad.fandom.com/wiki/WP_-_Update_to_v2.0); [Squad 9.0 release notes](https://www.joinsquad.com/updates/squad-9-0-release-notes)
- 10.6 pitched the HAB's built-in crate as "easier resupply without additional shoveling" — [PatchBot 10.6](https://patchbot.io/games/squad/articles/1644-update-106-release-notes)
- Rifleman sandbags and razor wire are drawn from the soldier's own kit (25 ammo points each to refill); 5.0 fixed IMF infantry placing unlimited sandbags instead of "the intended limit of 10 per player" — [Ammo Crate, Squad Wiki](https://squad.fandom.com/wiki/Ammo_Crate); [Squad v5.0 release notes](https://www.joinsquad.com/archive/squad-update-v5-0-release-notes-b330c)

### Inferences
- "Build Health Amount 12" probably means each shovel swing adds 12 HP, with destruction at half that, so total build time scales with structure HP divided by (12 × number of shovelers). I found no structure HP values to turn this into seconds.
- **Pixel Ops comparison: differs.** Pixel Ops uses fixed timers (FOB 20 s, sandbags 12 s) and only engineers build. Squad's model gives the planner (SL) placement and lets everyone build, with build speed scaling with the number of builders. Pixel Ops lacks digging down (own or enemy), partial-build disable thresholds, and refunds for unfinished structures. A cheap port: "enemy infantry standing on a structure removes it at 0.5× its build rate; at 50% it stops working."

### Gaps
- Shovel swings or seconds to build a HAB, radio, sandbag or ammo crate: not found in any source. Community videos may have them, but I could not confirm any figure.
- Exact HP of the radio, HAB and other structures: not found.

## 8. Vehicles as spawn points

### Takeaway
Since 8.1 (25 Sep 2024), the WPMC faction has the **M113A3 MSV** (Mobile Spawn Vehicle), described as a tracked APC with "the ability to rapidly deploy a mobile spawn point". It is still in the game in 10.0 (Nov 2025). No source I found documents its deployment timers, overrun rule or eligible spawners. Other factions use vehicles only as Commander anchors (unconventional factions) and as ammo carriers.

### Cited Findings
- "M113A3 Tracked Mobile Spawn Vehicle: An existing tracked vehicle with a new special capability: the ability to rapidly deploy a mobile spawn point." (8.1 notes dated 24 Sep 2024, release 25 Sep 2024) — [Squad 8.1 release notes](https://www.joinsquad.com/updates/squad-8-1-release-notes); [WP - Update to v8.1, Squad Wiki](https://squad.fandom.com/wiki/WP_-_Update_to_v8.1)
- The WPMC roster lists "M113A3 MSV - Armored Personnel Carrier / Mobile Spawn Vehicle" (edited Aug 2026) — [Western Private Military Contractors, Squad Wiki](https://squad.fandom.com/wiki/Western_Private_Military_Contractors)
- 10.0 (Nov 2025) fix: "Fixed WPMC Tracked MSV spawner getting disabled when one of its tracks got destroyed." So the spawn can be disabled, and track damage was not supposed to do it — [Squad 10.0 patch notes](https://www.joinsquad.com/updates/squad-10-0-patch-notes)
- A data site lists the MSV at "1000 health, 20 tickets, 15 min respawn" — [Squad Intelligence: M113A3 MSV](https://squadintelligence.com/vehicles/BP_M113A3_MSV_WPMC)
- A player on Steam (Oct 2024) warns SLs not to approve the MSV for random squad members, since they may drive the spawn around unpredictably (opinion) — [Steam discussion](https://steamcommunity.com/app/393380/discussions/6/6687373800507880487)
- WPMC (8.1) and unconventional Commanders can call abilities "next to vehicles as well as HABS" — [Squad 8.1 release notes](https://www.joinsquad.com/updates/squad-8-1-release-notes); [Commander, Squad Wiki](https://squad.fandom.com/wiki/Commander)
- 10.6 fixed CAF Combined Arms "missing two time-delayed MSVS Transport Trucks". MSVS here is a truck model (Medium Support Vehicle System), not a mobile spawn — [PatchBot 10.6](https://patchbot.io/games/squad/articles/1644-update-106-release-notes)

### Inferences
- The MSV costs 20 tickets, about the same as a FOB radio (−20) and more than an IFV (−10). OWI apparently prices a deployable spawn vehicle like a FOB.
- **Pixel Ops comparison: partly have.** The Air Assault "respawn beside a parked helicopter" is a vehicle spawn of the same kind. Squad's version requires a "deploy" mode (it is not a spawn while driving), can be disabled, and carries a high ticket cost and a 15 min respawn. Adding "must be parked or deployed" plus a HAB-style enemy-proximity disable to the helicopter spawn would match it.

### Gaps
- MSV deploy and undeploy time, whether it uses waves or the 30 s personal timer, its overrun or proximity rule, who can spawn on it (squad or team), and whether it needs supplies: not found in official notes, the wiki or community sources searched. It needs in-game testing or a dedicated guide.
- No other faction's APC or IFV acts as a spawn point in any source found.
