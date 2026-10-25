# Squad pays for objectives, not kills

The current version is Squad 10.6.3 (22 October 2026). Its gameplay runs as a chain: a logistics truck feeds a FOB radio, the radio supports a HAB spawn, squads and their rally points push out from there, and objectives decide the tickets. The ticket rules make objectives, not body counts, decide the match. Since 9.0 (September 2025), capturing an enemy flag pays +50 tickets, as much as fifty infantry deaths. Since 4.3 (March 2023), losing a flag costs nothing. A lost FOB radio costs 20 and the priciest vehicle, a tank, costs 15. Taking every flag starts a 60-ticket-per-minute "mercy bleed" on the loser instead of ending the match. Spawning has two tiers on different clocks:

- **Team spawns (HAB and main):** about 30 s, timed from when the player goes down. A new HAB takes 30 s to go live, and enemies near it switch it off, from 2 enemies at 20 m up to 9 at 90 m.
- **Squad rally points:** a repeating 60 s wave. A single enemy within 30 m destroys one.

Pixel Ops already has the main pieces: AAS-style flag chains, Invasion, hex Territory Control, FOBs built from trucks, 1-ticket respawns that a revive saves, and suppression with stances. Scaled to pool size, its prices already match Squad's: its FOB is 8% of its 500-ticket pool, the same as Squad's radio, and its APC is 4%, the same as a Squad infantry fighting vehicle (IFV). The gaps are in how the systems are built:

- no rally tier;
- no FOB overrun rule or activation delay;
- it penalises lost flags instead of rewarding captures;
- its flat bleed runs three to six times Squad's;
- it has a 12 s, medic-only revive, against Squad's 300 s revive that any teammate can perform;
- its Invasion ticket split is the reverse of Squad's;
- its Skirmish is a deathmatch;
- its APCs return about three times faster than Squad's relative to infantry.

To convert Squad's numbers, use four facts:

- Pixel Ops' 1 km map is about the size of Sumari (1.3 km), one of Squad's smallest.
- Its 25-minute match matches Squad's 20–30-minute Skirmish target.
- Its 15 s respawn is half of Squad's 30 s.
- Its 80 m FOB spacing is a fifth of Squad's 400 m.

So halve Squad's timers and shrink its distances to between a fifth and a third. Squad's rules for vehicle claims, commander elections, kit gating and digging with shovels exist to manage human teams and can be dropped. Squad's own player-vs-bot mode, Fireteam (December 2025), is built from short missions rather than the FOB-and-logistics loop, so Squad offers no precedent for a CPU that runs that whole loop.

## Fifty tickets per flag make objectives Squad's real currency

Squad sets ticket pools by game mode, not by map. A community extraction of the 10.6 layer configs (refreshed 5 October 2026) gives these pools:

- **AAS and RAAS:** 250 per side on 76 of 85 layers, and 200 on the small maps Sumari, Mestia, Logar and Anvil.
- **Invasion:** 250 for attackers and 800 for defenders.
- **Insurgency and Destruction:** 200 against 1,000.
- **Territory Control:** 400. **Skirmish:** 200. **Seed:** 100.

([Layer data 10.6](https://github.com/aachtenberg/squadmaps-v2/blob/HEAD/data/v10_data.json)). These values are recent. 6.0.1 (4 October 2023) set pools at 300 on large maps and 250 on small ones. 7.2 (12 March 2024) cut AAS and RAAS to a flat 250 and set Invasion to 200/800. 8.1 (25 September 2024) raised Invasion attackers to 250 ([Patch 6.0.1](https://store.steampowered.com/news/app/393380/view/5220292521178505777); [Patch 7.2](https://store.steampowered.com/news/app/393380/view/5679673637671132649); [Patch 8.1](https://www.joinsquad.com/updates/squad-8-1-release-notes)).

Losses are small and fixed. An infantry ticket is charged only when the player bleeds out, gives up or respawns, never when they go down: "for every player he revives, a ticket is spared" ([Wiki: Health Management](https://squad.fandom.com/wiki/Health_Management)). Commanders cost 2 ([Wiki: Tickets](https://squad.fandom.com/wiki/Tickets)). Patch 3.2 (23 August 2022) fixed a bug that had charged only 1 ([Patch 3.2](https://store.steampowered.com/news/app/393380/view/4584122114610724983)). Vehicle costs by class:

- **1:** motorcycles and boats.
- **5:** light vehicles, logistics trucks, helicopters and light APCs.
- **10:** IFVs, heavier APCs and anti-tank (AT) light vehicles.
- **15:** main battle tanks, the most expensive loss in the game.

([Wiki: Tickets](https://squad.fandom.com/wiki/Tickets)). OWI keeps lowering these. 2.11 (18 August 2021) cut light and medium APCs from 10 to 5, and 10.2 (19 January 2026) cut transport vehicles from 5 to 3 ([Patch 2.11](https://store.steampowered.com/news/app/393380/view/4022264629308405733); [Patch 10.2](https://store.steampowered.com/news/app/393380/view/1821922921821975)).

A FOB radio costs **20 tickets**. 2.16 (17 May 2022) doubled it from 10 "to increase the incentive to defend FOBs, and attempt to address FOB spam" ([Patch 2.16](https://store.steampowered.com/news/app/393380/view/5849624375837630151)). The cost applies only after a 75-second bleed-out, during which the owners can save the radio by rebuilding it to 50 HP (4.4, 18 April 2023). If friendlies dig their own radio down, it costs nothing ([Patch 4.4](https://store.steampowered.com/news/app/393380/view/6539831519504484093); [Wiki: Forward Operating Base](https://squad.fandom.com/wiki/Forward_Operating_Base)).

Objectives outweigh all of that:

- **Capturing a flag:** since 9.0 (2 September 2025), taking an enemy-held AAS or RAAS flag pays **+50 tickets**. It had been +60 since 2.0 (February 2021), which raised it "to help losing teams make a comeback". The first capture of a neutral flag pays +20 ([Patch 9.0](https://store.steampowered.com/news/app/393380/view/1809235871756104); [Patch 2.0](https://store.steampowered.com/news/app/393380/view/4060529371699511300)).
- **Losing a flag:** has cost nothing since 4.3 (14 March 2023). OWI removed the −10 penalty because the losing team already pays through lost FOBs, give-ups and vehicles ([Patch 4.3](https://store.steampowered.com/news/app/393380/view/5070528810311080632)). The wiki's AAS page still lists −10, which is out of date.
- **Holding flags:** in AAS, each flag held on the enemy's half of the chain drains them 1 ticket per minute. On a chain with an odd number of flags, the middle flag counts for neither side. When both teams have each neutralised the other's front flag (a "double neutral"), all bleed pauses ([Wiki: Advance and Secure](https://squad.fandom.com/wiki/Advance_and_Secure)). RAAS has had no holding bleed since 4.3.
- **Taking every flag:** both modes then start a **mercy bleed of 60 tickets over 60 seconds**, which stops if the losing side retakes a point ([Patch 4.3](https://store.steampowered.com/news/app/393380/view/5070528810311080632)).

So one enemy flag is worth fifty dead riflemen, a fifth of a 250 pool. A full sweep ends the match in about four minutes unless the losing side counterattacks.

| Ticket item | Squad today (version) | Share of Squad's 250 pool | Pixel Ops today | Share of Pixel Ops' 500 pool |
|---|---|---|---|---|
| Infantry death | 1, on bleed-out or give-up | 0.4% | 1, on respawn | 0.2% |
| Transport truck | 3 (10.2, Jan 2026) | 1.2% | 10 | 2.0% |
| Logistics truck | 5 | 2.0% | 16 (supply truck) | 3.2% |
| Light APC / IFV | 5 / 10 | 2–4% | 20 (autocannon APC) | 4.0% |
| Helicopter | 5 (wiki) | 2.0% | 30 | 6.0% |
| Main battle tank | 15 | 6.0% | none | — |
| FOB radio lost | 20 (2.16) after 75 s bleed-out | 8.0% | 40, at once | 8.0% |
| Enemy flag taken | +50 to capturer (9.0) | +20% | 0 (+20 with Entrenched doctrine) | 0–4% |
| Neutral flag first taken | +20 | +8% | 0 | — |
| Own flag lost | 0 (4.3) | 0 | −20 | −4% |
| Holding bleed | AAS 1/min per flag past midpoint; RAAS 0 | ≤0.8%/min | 12/min for any majority | 2.4%/min |
| Every flag held | 60/min mercy bleed | 24%/min | instant win | — |

Scaled to pool size, Pixel Ops is closer to Squad than its raw numbers suggest. Its FOB costs 8% of the pool, exactly Squad's radio share, and its autocannon APC, at 4%, matches a Squad IFV ([rules.js](../src/game/rules.js)). The light end costs more: trucks take about 1.6 times Squad's share and helicopters three times, while Squad treats helicopters as cheap losses and tanks as expensive ones.

The real mismatch is how objectives score. Pixel Ops:

- charges the loser 20 per location;
- pays the capturer nothing unless the player picks the Entrenched doctrine (+20, which happens to equal Squad's neutral-flag reward);
- bleeds the side with fewer locations 1 ticket every 5 s from the moment the other side holds a majority.

([aas.js](../src/game/modes/aas.js); [loadout.js](../src/game/loadout.js)). That bleed is **12 per minute, or 2.4% of the pool**, three to six times Squad's AAS bleed before mercy. Over a 25-minute match it can drain 300 tickets on its own. Capturing all five locations wins instantly, where Squad gives the losing side about four minutes to break the sweep.

The Squad-style fix moves ticket pressure from losing locations to taking them:

- pay **+50 for an enemy location and +20 for a neutral one taken for the first time**;
- charge nothing for a loss;
- replace the flat majority bleed with about 2 tickets per minute for each location held past the Village midpoint;
- replace the instant win with a mercy bleed near **120 per minute** (Squad's 24% of pool per minute, applied to 500).

Strict scaling would double the capture rewards to +100/+40. Pixel Ops captures run four to eight times faster than Squad's, though: about 21 s for four soldiers on a neutral location, against Squad's 77 s with nine players. More flags will change hands per match, so start the rewards at Squad's raw values and raise them only if playtests show captures feel unrewarding. In March 2024 OWI admitted that players could not see "where ticket losses and gains were" ([Squad Developer Q&A, March 2024](https://www.joinsquad.com/updates/squad-developer-q-a---march-2024)). That argues for adding an after-action ticket breakdown alongside the change.

## Squad's eight modes reshape one flag chain in different ways

### AAS and RAAS chain five to eight flags, captured faster by bigger groups

Advance and Secure (AAS) is a fixed chain of control points between two main bases that cannot be captured. In the 10.0 layer data, 22 layers have 5 flags, 6 have 6, 16 have 7 and 2 have 8 ([Layer data 10.0](https://github.com/Squad-Wiki/squad-wiki-pipeline-map-data/blob/dev/completed_output/_Current%20Version/finished.json)). A team can attack only the next flag beyond its front. It must first drain an enemy flag to neutral, then fill it to its own colour. If both teams neutralise each other's front flags, neither can advance until one retakes its defence flag ([Wiki: Advance and Secure](https://squad.fandom.com/wiki/Advance_and_Secure); [Wiki: Control Point](https://squad.fandom.com/wiki/Control_Point)).

Capture speed depends on head count. Where both teams can capture, it depends on the difference between them. A single player can take a neutral flag that nobody can contest. Since 8.1 (25 September 2024), speed scales with up to 27 players: **77 s for one bar fill with 9 players, 46 s with 18 and 35 s with 27** ([Patch 8.1](https://www.joinsquad.com/updates/squad-8-1-release-notes)). By my calculation, fully flipping an enemy flag therefore takes nine uncontested attackers about 150 s. The median capture-zone radius is about 70 m. Matches open with a 3-minute staging phase in which everyone stays in main. 10.3 (17 February 2026) made it server-configurable from 60 to 300 s ([Patch 10.3](https://store.steampowered.com/news/app/393380/view/1824644522848347)).

Pixel Ops' AAS already matches the core. Five fixed locations are captured in chain order, with a −100 to +100 bar that neutralises and then captures. The double-neutral stalemate falls out of its `capturable()` check ([objectives.js](../src/game/objectives.js)). It differs in three ways:

- Any enemy unit in the zone stops progress outright. In Squad, defenders only slow it according to head count.
- Capture runs at 1.2 progress per soldier per second, capped at eight soldiers: 21 s for four soldiers on a neutral location, 42 s to flip an enemy one.
- Zones are 20–34 m across, not 70 m ([desert1km.js](../src/game/maps/desert1km.js)).

Switching to head-count difference would let a larger force push through a lone defender. That is what Squad's 2.15 notes said they wanted: "incentivizing capturing points en masse… rather than a lone enemy on back-cap duty" ([Patch 2.15](https://store.steampowered.com/news/app/393380/view/4353300134244517023)). Pixel Ops has no staging phase. A locked 30–45 s opening, scaled down from Squad's default 3 minutes, would give both the player and the CPU time to assign squads.

Random Advance and Secure (RAAS) randomises the same chain using "lanes":

- In the 10.6 data, all 40 RAAS layers use a lane graph. Most have 3–5 parallel lanes.
- Each lane has 7 positions on large maps (standardised in 8.0, 10 June 2024) and 5–6 on small ones.
- Each position is a cluster of 1–7 candidate capture zones, about 2 on average.

([Layer data 10.6](https://github.com/aachtenberg/squadmaps-v2/blob/HEAD/data/v10_data.json); [Layer data 10.0](https://github.com/Squad-Wiki/squad-wiki-pipeline-map-data/blob/dev/completed_output/_Current%20Version/finished.json); [Patch 8.0](https://store.steampowered.com/news/app/393380/view/5746109972564419051)). The game picks a lane and one candidate per cluster. Capturing a flag reveals the next one, and flags a team has discovered stay visible to it ([Patch 2.15](https://store.steampowered.com/news/app/393380/view/4353300134244517023)). Lanes almost never share clusters, so community tools such as Squadlanes let veteran players predict the lane after a couple of flags ([Squadlanes](https://github.com/w4rum/squadlanes)). Players complain that RAAS feels luck-based when objectives are hidden. They also defend it, because static AAS "always used the same forward bases and buildings" ([Steam: "What is the meaning of RAAS mode"](https://steamcommunity.com/app/393380/discussions/6/4009846212728766520)).

A 1 km RAAS for Pixel Ops would be 2–3 lanes of five positions, with 2–3 candidates per position. Given those complaints, and the fairness stakes against a CPU, show each side its current and next objective instead of hiding them under fog. Never let the CPU see a flag the player cannot.

### Squad's Invasion pays the attacker; Pixel Ops charges the defender

Squad's Invasion is lopsided in the opposite direction to Pixel Ops'. Defenders start with every flag and **800 tickets, against the attackers' 250** (44 of 45 layers; Lashkar gives defenders 900). Attackers earn **+125 per capture**: 8.1 raised it from 100 to 130, and 8.2 (2 December 2024) set it to 125. Other rules:

- Only attackers can capture, and captured flags cannot be retaken.
- There is no ticket bleed.
- Defenders lose nothing per flag until the last one, which costs them every remaining ticket. That rule comes from an older wiki section, but no later source contradicts it.

([Layer data 10.6](https://github.com/aachtenberg/squadmaps-v2/blob/HEAD/data/v10_data.json); [Patch 8.2](https://store.steampowered.com/news/app/393380/view/1784506359151949); [Wiki: Invasion](https://squad.fandom.com/wiki/Invasion)). 8.2 also set layouts to five flags, with the first two or three close together. It removed most forward vehicle spawns for defenders but kept temporary forward infantry spawns, and it added alternative lanes on some layers ([Patch 8.2](https://store.steampowered.com/news/app/393380/view/1784506359151949)). The ticket pools act as a soft clock. Attackers effectively get 250 + 4 × 125 = 750 tickets over four captures, close to the defenders' 800, so the attackers' pool rather than a timer limits the match. No official round timer is documented.

Pixel Ops' Invasion works differently ([invasion.js](../src/game/modes/invasion.js)):

- attackers get 650 tickets and defenders 400;
- defenders lose 30 per lost location;
- a 20-minute clock runs, and defenders win by outlasting it;
- because Invasion inherits the AAS `capturable()` check without overriding it, defenders can retake a location while they hold its neighbour.

A version faithful to Squad would:

- flip the pools (on a 500 scale, roughly 500 attackers against 1,600 defenders);
- pay attackers about half their starting pool per capture (+250);
- forbid recapture;
- drain the defenders only when they lose the final location;
- keep the clock only as a backstop.

Forbidding recapture is the cheapest and most important of these changes. It is what makes Squad's Invasion a one-way push.

### Territory Control, Skirmish and the cache modes

Territory Control (TC) is played on a hex grid. The 20 layers have 23–98 hexes each, with a median circumradius of 141 m, and 400 tickets ([Layer data 10.0](https://github.com/Squad-Wiki/squad-wiki-pipeline-map-data/blob/dev/completed_output/_Current%20Version/finished.json); [Wiki: Territory Control](https://squad.fandom.com/wiki/Territory_Control)). Its rules:

- Teams capture only hexes next to ones they own.
- "Anchor" hexes are fixed starting hexes; a team's territory must stay connected to them.
- Hexes cut off from that network cannot be recaptured until reconnected.
- A HAB placed in a hex stops enemies from neutralising it.

The core of the mode is a bleed that grows with the share of hexes held: 1/min at 55–59%, rising by one per band to 6/min at 80–84%, then **30/min at 85–89% and 120/min at 90–100%**. Holding 95% wins outright ([Wiki: Territory Control](https://squad.fandom.com/wiki/Territory_Control)).

Pixel Ops has hex-by-hex capture but bleeds a flat 12/min whenever one side holds more hexes, and it awards the win at 80% ([territory.js](../src/game/modes/territory.js)). Squad's curve is based on share, not count, so it carries over unchanged. Anchors and cut-offs add the encirclement play that sets TC apart. OWI announced a TC rework in August 2025 and hoped to playtest it in early 2026, but nothing had shipped by 10.6.3 ([Letter from the Squad Leader, Aug 2025](https://store.steampowered.com/news/app/393380/view/1809235871723313)).

9.0 rebuilt Skirmish as a 20–30-minute conquest mode focused on infantry ([Patch 9.0](https://store.steampowered.com/news/app/393380/view/1809235871756104); [Patch 10.6](https://store.steampowered.com/news/app/393380/view/1845383656383372)):

- Each team has one anchor point. Once it holds its anchor, it can capture five middle points in any order.
- The side holding the majority bleeds the other, and the bleed grows with each extra point held.
- A team can capture the enemy anchor only after it holds all five middle points. Taking it starts the mercy bleed.
- Each side gets 200 tickets, plus a light vehicle and a truck that arrive after a delay.
- From 10.6 (1 October 2026), logistics vehicles and heavy machine gun (HMG) emplacements were added "so teams no longer have to exclusively rely on Rally Points".

That 20–30-minute target is Pixel Ops' match length, so Skirmish is the Squad mode that carries over most directly. Pixel Ops' Skirmish, though, is a ticket deathmatch with no objectives ([skirmish.js](../src/game/modes/skirmish.js)). On Desert Crossing, Outpost and Relay sit next to the bases and would serve as anchors, with Airfield, Village and Depot as the middle points.

Destruction gives attackers 200 tickets against 1,000 ([Wiki: Destruction](https://squad.fandom.com/wiki/Destruction); [Layer data 10.0](https://github.com/Squad-Wiki/squad-wiki-pipeline-map-data/blob/dev/completed_output/_Current%20Version/finished.json)):

- A match has two or three phases. Each phase has two zones, and each zone hides a cache among 4–6 candidate spots 11–50 m apart.
- Only engineer demolition charges (30 s fuse) destroy caches.
- Clearing a phase pays attackers +50, costs defenders 10, and adds 1,980 s to the clock.
- The next phase opens after a 180 s delay, during which defenders get temporary spawns.

Insurgency is a cache hunt. Attackers earn intel points from kills: at 50 points on small maps or 60 on large ones, the area (not the exact spot) of a new cache is revealed, with at most two caches active at once ([Wiki: Insurgency](https://squad.fandom.com/wiki/Insurgency)).

Pixel Ops' Destruction again reverses the pools: 600 for attackers against 450 for defenders. It hunts three caches one at a time, reveals each when an attacker comes within 70 m or after 90 s, and charges defenders 80 tickets per cache ([destruction.js](../src/game/modes/destruction.js)). Two simultaneous caches per phase, hidden among candidate spots and damaged only by AT or engineer weapons, would turn it from walking up to a cache into searching for one.

The remaining modes have no single-player role:

- **Seed:** a multiplayer warm-up mode with 100 tickets.
- **Track Attack:** a 4v4 vehicle mode added in 1.0 (2020) that is absent from the 10.x layer data ([Patch 1.0](https://store.steampowered.com/news/app/393380/view/3715990047691621885)).
- **Fireteam:** OWI's own player-vs-bot mode (10.1, 1 December 2025), built from five-player missions rather than a bot-filled 50v50 ([Patch 10.1](https://store.steampowered.com/news/app/393380/view/1817483467046332)).

| Mode | Squad today | Pixel Ops today | Main change to make |
|---|---|---|---|
| AAS | 5–8 flags; 250 each; +50/+20 per capture; 1/min bleed per flag past midpoint; 60/min mercy; no clock | 5 locations; 500 each; −20 per loss; 12/min majority bleed; instant win; 25 min clock | Rewards not penalties; per-flag bleed; mercy bleed |
| RAAS | 3–5 lanes × 7 positions × ~2 candidates; no bleed until mercy | absent | 2–3 lanes × 5 × 2–3, objectives shown |
| Invasion | 250 v 800; +125 per capture; no recapture; final flag drains defender | 650 v 400; −30 per loss; recapture possible; 20 min clock | Flip pools, pay captures, lock captured locations |
| Territory Control | 400; bleed 1→120/min by share held; 95% wins; anchors, cut-offs | 500; flat 12/min; 80% wins | Port the curve and anchors |
| Skirmish | anchor + 5 conquest; 200; majority bleed; 20–30 min | ticket deathmatch | Anchor + 3 conquest on Desert Crossing |
| Destruction | 200 v 1,000; phases of 2 caches among 4–6 spots; +50/−10 and +33 min per phase | 600 v 450; 3 caches in turn; −80 each | Paired hidden caches, AT/engineer-only damage |

## Two spawn tiers on two clocks set the rhythm of every push

### Main, HAB and rally: three spawns, three rules

The main base is the spawn that never fails ([Wiki: Main Base](https://squad.fandom.com/wiki/Main_Base)):

- It cannot be destroyed.
- It sits inside a 400 m protection zone that destroys incoming projectiles and vehicles.
- Every vehicle spawns there, and its supplies are unlimited.
- It is the only spawn that refills a player's full loadout.

Forward spawning comes in two tiers with different clocks. The team-wide HAB (spawn bunker) and the main use a **personal timer of about 30 s, counted from the moment a player goes down**, so time spent incapacitated counts toward it ([Wiki: Spawn Bunker](https://squad.fandom.com/wiki/Spawn_Bunker); [Wiki: Rally Point](https://squad.fandom.com/wiki/Rally_Point)). A wiki passage from the 1.0 era gives 25 s for main and 45 s for FOBs, so the timer has changed over time ([Wiki: Spawning](https://squad.fandom.com/wiki/Spawning)). The squad-only rally point uses a **repeating 60 s wave, and a player must have been down at least 20 s before a wave to join it**. Dying with 15 s left on the wave therefore means a 75 s wait ([Wiki: Rally Point](https://squad.fandom.com/wiki/Rally_Point); [Squad Academy: Rallies](https://squadacademy.me/tactics/rallies/)). The fast spawn is the expensive, team-wide one. The cheap spawn that a squad owns is slower.

The HAB has these rules:

- It costs 500 construction points and must be built with shovels. Conventional factions get one per FOB.
- It goes live **30 s after it is finished**. The delay was 10 s in 2.0 (February 2021), rose to 20 s, and reached 30 s in 4.2 (7 February 2023) ([Wiki: Spawn Bunker](https://squad.fandom.com/wiki/Spawn_Bunker); [WP - Update to v2.0](https://squad.fandom.com/wiki/WP_-_Update_to_v2.0); [Patch 4.2](https://joinsquad.com/archive/squad-update-v4-2-release-notes)).
- Nearby enemies switch it off ("proxy" it) on a sliding scale. 4.4 (18 April 2023) set this at **2 enemies within 20 m, 3 within 30 m, and so on up to 9 within 90 m**. It comes back 30 s after they leave or die. Every source describes only enemy counts, so friendlies standing nearby apparently do not cancel it ([Patch 4.4](https://www.joinsquad.com/archive/squad-update-v4-4-release-notes-34ce1); [Wiki: Spawn Bunker](https://squad.fandom.com/wiki/Spawn_Bunker)).
- It also stops spawning at half health, or when its radio is damaged below 75% ([Wiki: Forward Operating Base](https://squad.fandom.com/wiki/Forward_Operating_Base)).

The sliding scale first shipped early, in 2.9 (June 2021). A player discussion quotes OWI's stated aim: stacking FOBs and HABs next to an objective "should not be the primary means to take control" of it ([Steam discussion](https://steamcommunity.com/app/393380/discussions/6/3048356660224565852/)).

The rally point belongs to the squad leader:

- Each squad gets one. Placing it needs one squadmate within 8 m.
- There is a 120 s cooldown between placements. The cooldown restarts if a placement fails because an enemy is within 50 m.
- A single enemy within 30 m, even one inside a vehicle, destroys it at once.
- Spawns have been unlimited since Alpha 12, and rearming the rally costs 50 ammo points.

([Wiki: Rally Point](https://squad.fandom.com/wiki/Rally_Point); [Squad Academy: Rallies](https://squadacademy.me/tactics/rallies/)). One guide gives a 150 s cooldown; the wiki and Squad Academy agree on 120 s. The 20 m gap between the 50 m placement block and the 30 m destruction radius keeps a new rally from dying the moment it is placed. The destruction rule also makes a rally work as a flank alarm. Rallies are not enough on their own: Squad's 9.0 Skirmish leaned on them, and 10.6 added logistics vehicles so teams would not "exclusively rely" on them ([Patch 10.6](https://store.steampowered.com/news/app/393380/view/1845383656383372)).

The only spawn vehicle is the WPMC faction's M113A3 MSV (8.1, September 2024). It deploys a spawn point and can be disabled. A community data site lists it at 20 tickets with a 15-minute respawn, the same price as a FOB radio ([Squad 8.1 release notes](https://www.joinsquad.com/updates/squad-8-1-release-notes); [Squad Intelligence: M113A3 MSV](https://squadintelligence.com/vehicles/BP_M113A3_MSV_WPMC)).

### The FOB radio is a free claim with a 20-ticket bill

Only a squad leader can place a radio, and placement is instant and free ([Wiki: Forward Operating Base](https://squad.fandom.com/wiki/Forward_Operating_Base)):

- A logistics vehicle and one other teammate must be within 30 m.
- It must be at least 150 m from main and 400 m from any other friendly radio. Small maps use 300 m; the value has been set per layer since 2.11 (August 2021) ([Patch 2.11](https://store.steampowered.com/news/app/393380/view/4022264629308405733)).
- It claims a 150 m build radius but starts with no supplies.

Enemies dig the radio down or blow it up. At zero health it bleeds out for 75 s. After that the owners lose 20 tickets, and every structure and weapon emplacement within its radius is deleted: HAB, ammo crate, repair station, HMG, TOW. Sandbags and HESCO barriers stay ([Wiki: Forward Operating Base](https://squad.fandom.com/wiki/Forward_Operating_Base); [Wiki: Deployables](https://squad.fandom.com/wiki/Deployables)). Friendlies digging out their own radio pay nothing, so a squad leader can abandon a FOB cleanly.

Pixel Ops' FOB is radio and spawn in one ([rules.js](../src/game/rules.js); [fob.js](../src/game/fob.js); [respawn.js](../src/game/respawn.js)):

- An engineer builds it in 20 s next to a supply truck holding 50 supplies.
- It must be 80 m from other FOBs and 140 m from the enemy main.
- It spawns infantry as soon as it stands, and nothing nearby can switch it off.
- Its destruction costs 40 tickets at once.

The 80 m spacing is a fifth of Squad's 400 m, and the 15 s respawn is half Squad's 30 s. Those two ratios give a consistent conversion for the rest of the rules.

| Spawn rule | Squad today (version) | Pixel Ops today | Suggested Pixel Ops value (scaled) |
|---|---|---|---|
| Personal respawn (main, team spawn) | ~30 s from going down | 15 s, every spawn | keep 15 s |
| Rally wave | 60 s repeating; join ≥20 s before | none (squadmates who die within 8 s return together) | 30 s wave, 10 s cut-off |
| Rally placement | squad leader + 1 within 8 m; 120 s cooldown; fails within 50 m of an enemy | none | squad leader + 1 within 8 m; 60 s cooldown; fails within 30 m |
| Rally destruction | any single enemy within 30 m | none | single enemy within 15–20 m |
| FOB claim | instant, free; truck + 1 teammate within 30 m; 400 m spacing (300 m small maps) | 20 s engineer build; 50 supplies; 80 m spacing | instant, near-free claim; keep 80 m |
| Team spawn structure | HAB 500 construction points, live 30 s after build (4.2) | the FOB itself, live at once | 20–25 supplies, live 15 s after build |
| Overrun | 2 enemies at 20 m, +10 m per extra enemy to 9 at 90 m (4.4); back 30 s after clear | none | 2 enemies at 10 m, +5 m per extra enemy, cap 30 m; back 15 s after clear |
| Damage disable | HAB below 50%; radio below 75% | none | spawn off below 50% FOB health |
| Radio loss | 75 s rebuild window, then −20; free friendly teardown; structures deleted, sandbags stay | −40 at destruction | 40 s window, then −40; free friendly teardown |

The two most valuable additions are the rally tier and the overrun rule. A rally gives each squad a cheap, fragile, wave-timed forward spawn that bridges the gap between a FOB and the fight. Hell Let Loose arrived at the same pairing: team-wide Garrisons (50 supplies, 200 m apart, in friendly territory) and free, squad-only Outposts ([Windows Central: HLL guide](https://www.windowscentral.com/hell-let-loose-guide); [Whisper of the House: HLL spawn guide](https://www.whisperofthehouse.com/hell-let-loose-vietnam/spawn-garrison-outpost-guide)).

The overrun rule turns FOB defence into a question of position, and it gives attackers a reason to assault a FOB even if they cannot destroy it. Spawn pressure is the setting OWI has retuned most often:

- **HAB activation delay:** 10 s, then 20 s, then 30 s.
- **Overrun radius:** a fixed 30 m, then a sliding scale up to 80 m, then up to 90 m.
- **HAB ammo crate:** added in 10.6 on 1 October 2026 and reverted on 22 October in 10.6.3, because it disrupted "the current gameplay or navigation around the HAB" ([Squad Hotfix 10.6.3](https://www.joinsquad.com/updates/squad-hotfix-10-6-3-release-notes)).

That history shows players feel these values directly. For the CPU, both rules need new considerations in its utility scoring: where each squad drops its rally, how many soldiers to keep inside its own FOB's overrun radius, and when to send a squad to switch off or destroy the player's spawns.

### Logistics: 3,000-point trucks, 500-point bunkers, no upkeep

Squad runs two supply pools. Construction points build structures and repair vehicles. Ammo points rearm infantry, vehicles and emplacements ([Wiki: Logistic System](https://squad.fandom.com/wiki/Logistic_System)). Carrying capacities:

- a conventional logistics truck: 3,000 points, in any split the driver chooses;
- a logistics technical (pickup truck): 1,400;
- a UH-60M helicopter: 1,000;
- an Mi-8 helicopter: 1,500.

A FOB stores up to 20,000 of each type, and nothing decays. Supplies only go down when something is built, rearmed or repaired ([Wiki: Logistic System](https://squad.fandom.com/wiki/Logistic_System); [Wiki: Forward Operating Base](https://squad.fandom.com/wiki/Forward_Operating_Base)). Costs from the wiki's structures table ([Wiki: Deployables](https://squad.fandom.com/wiki/Deployables)):

| Structure | Construction points | Ammo points |
|---|---|---|
| HAB | 500 | — |
| Repair station | 500 | — |
| Ammo crate | 100 | — |
| HESCO bunker | 150 | — |
| Sandbag | 25 | — |
| Razor wire | 15 | — |
| HMG | 200 | 50 |
| Mortar | 300 | 25 |
| TOW | 600 | 500 |

Squad leaders place structures, and anyone carrying a shovel builds them. More shovels build faster, and digging a structure out runs at half the build rate. Structures dug up before they are finished refund 80% of their cost; this came in with 2.0, and 9.0 fixed refunds that had stopped working ([Wiki: Entrenching Tool](https://squad.fandom.com/wiki/Entrenching_Tool); [WP - Update to v2.0](https://squad.fandom.com/wiki/WP_-_Update_to_v2.0); [Patch 9.0](https://store.steampowered.com/news/app/393380/view/1809235871756104)).

Measured against one truck, Squad's HAB costs 17%, an ammo crate 3% and a sandbag under 1%. Pixel Ops has a single supply pool. Its truck carries 100, a FOB takes 50 (50%) and a sandbag position 12 (12%) ([rules.js](../src/game/rules.js)). Relative to a truckload, its forward spawns therefore cost three times as much and its fortifications more than ten times as much.

Squad limits FOB numbers through spacing rather than price. If Pixel Ops adds a free radio claim and a separate spawn structure costing 20–25 supplies, its 80 m spacing would do the same job. A second ammo pool is the part to skip: Pixel Ops has no ammunition. Foxhole's logistics players went on strike in 2021–22 over the tedium of hauling supplies, a warning against turning supply into a chore ([PC Gamer: Foxhole logistics strike](https://www.pcgamer.com/uk/logistics-players-in-mmo-wargame-foxhole-go-on-strike/)). Standing supply orders, where a truck shuttles between main and a chosen FOB until told otherwise, keep the decisions (where to send supplies, when to risk the truck) and remove the chore.

## Squad's leader and commander roles are jobs Pixel Ops' player already holds

Squad's squad leader is the only player who can place rallies and radios, claim vehicles and request commander fire. The squad leader kit carries the rally and binoculars. The rest of the role is voice and map markers, over three channels: local, squad and the command net between squad leaders ([Wiki: Squad Leader](https://squad.fandom.com/wiki/Squad_Leader); [Wiki: Squad](https://squad.fandom.com/wiki/Squad)).

Squads hold up to nine players, and kits are limited in four ways ([Wiki: Kit Role Selection](https://squad.fandom.com/wiki/Kit_Role_Selection)):

- **By squad size:** for conventional factions, heavy anti-tank (HAT), machine gunner, marksman and grenadier kits unlock at five members.
- **By role:** at most two medics per squad.
- **By kit category:** at most three fire-support kits per squad.
- **Team-wide, unlocking as the team grows:** one primary HAT at 15 players and one secondary at 20; two each of machine gunner, sniper and combat engineer.

Vehicle claims scale with squad size. A forum repost of the 9.6 changelog says claims now unlock at 2, 4, 6 and 8 members ([Overclockers forum repost](https://www.overclockers.co.uk/forums/posts/30966311/)). Since 7.x each faction fields "units" with their own vehicle lineups and FOB emplacements: combined arms, armored, mechanized, motorized, air assault, light infantry, support and amphibious ([Patch 7.2](https://store.steampowered.com/news/app/393380/view/5679673637671132649)). Pixel Ops' doctrines (Mechanized, Air Assault, Light Infantry, Entrenched) already play that role within its 1,200-point force budget ([loadout.js](../src/game/loadout.js)).

The commander is a squad leader elected by the other squad leaders. A nominee needs two squad members, and the team needs at least three squads. A new election can follow after 300 s and resets the cooldowns. The commander costs 2 tickets on death. Conventional factions get a small set of assets on long cooldowns:

- **UAV:** every 10 minutes, 30 s to arrive.
- **Airstrike:** every 15 minutes, about 40 s to arrive.
- **155 mm artillery:** every 30 minutes, about 60 s to arrive, with two ranging shots first.

Irregular factions get a handheld drone on a 10-minute cooldown and a heavy mortar barrage every 20 minutes: about 65 rounds over a 150 m area, arriving after 35 s ([Wiki: Commander](https://squad.fandom.com/wiki/Commander)).

To fire, the commander must be within about 30 m of a fully built HAB (irregular factions can use a vehicle instead). Each strike goes through a request, accept and confirm sequence with one-minute windows. Every asset starts on cooldown, so the earliest airstrike lands about 16 minutes into a round. Strikes scatter enough to hit friendlies: artillery kills everything within 16 m and splashes to 75 m ([Wiki: Commander](https://squad.fandom.com/wiki/Commander)).

Three caveats apply. The wiki's cooldowns carry no version, and a community guide reports artillery at 8–10 minutes ([GuildOrder: Commander assets](https://guildorder.com/games/squad/wiki/commander-assets-and-cooldowns)). OWI promised to "completely rework the current commander system" in March 2024, and no rework appears through 10.6.3 ([Squad Developer Q&A, March 2024](https://www.joinsquad.com/updates/squad-developer-q-a---march-2024)). And Squad has no commander in Skirmish or on its small maps Logar and Sumari, the size Pixel Ops plays at ([Wiki: Commander](https://squad.fandom.com/wiki/Commander)).

In Pixel Ops the player is squad leader and commander at once. Squad's coordination machinery (elections, claims, request queues, squad-size kit limits) has nothing to coordinate there and should be dropped. What carries over is the mechanical core of each role:

- **A designated leader per squad.** It carries the rally, is required (with a truck within 30 m) to place a FOB, and its death restarts the rally cooldown, just as appointing a new squad leader does in Squad.
- **Team-wide caps.** These become force-builder limits such as "at most two AT squads".
- **Commander assets as three call-ins scaled to a 25-minute match:** a UAV reveal on about a 4-minute cooldown, and a mortar or artillery barrage on about 10 minutes, arriving in 20–30 s with visible ranging rounds. Start both on a cooldown of about 5 minutes so nothing fires in the opening, and allow them only near a live FOB.

Squad leaving out the commander on maps of Pixel Ops' size argues for keeping those numbers modest. The CPU commander must get exactly the same assets on the same cooldowns, which also gives the player a readable "enemy barrage ready" signal.

## Suppression, wounds and armour make every loss slower and costlier

### Suppression: per-weapon meters, narrowed in 2026

The Infantry Combat Overhaul (ICO, 6.0, September 2023) made suppression central. OWI's reasoning: "a lone wolf flanker can single-handedly decimate an entire squad", and "speed and aggression" should not beat coordination ([OWI: Infantry Combat Overhaul](https://joinsquad.com/archive/infantry-combat-overhaul-10b70)). In the ICO-era version documented on the wiki, each near miss adds an amount to a meter that depends on the weapon class:

| Weapon class | Added per round | Radius | Cap |
|---|---|---|---|
| Rifle or pistol | 9% | 6 m | 115% |
| Light machine gun or designated marksman rifle | 15% | 10 m | 125% |
| General-purpose machine gun, battle rifle or sniper | 20% | 10 m | 135% |
| Heavy machine gun | 50% | 10 m | 200% |

The meter drains at a steady 20% per second. Explosions apply their full value out to 25 m and suppress both sides, while bullets suppress only enemies ([Wiki: Suppression](https://squad.fandom.com/wiki/Suppression)). The caps meant only heavy weapons could push a target into the worst levels of screen blur and distortion.

10.5.2 (12 August 2026) narrowed the system ([DEV BLOG: 10.5.2 Reworking Suppression](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1840310314354899); [Squad 10.6 release notes](https://www.joinsquad.com/updates/squad-10-6-release-notes)):

- Suppression decays faster.
- The radius is smaller, and an angle check means stray rounds no longer count.
- A lone rifleman suppresses poorly, while a fireteam suppresses well. Machine guns act as area suppressors.
- Marksman and battle rifles deal "exponentially more" suppression on near misses.
- Players cannot steady their aim by holding their breath while suppressed.
- A tunnel-vision vignette replaces full-screen blur.

10.6 then made misses beyond 3 m much weaker. OWI has published no numbers since 10.5.2.

Pixel Ops' system is already shaped like Squad's current one ([combat.js](../src/game/combat.js); [units.js](../src/core/units.js)):

- Bullets suppress within 4 m and explosives within 9 m.
- Each round adds 0.07 (rifle), 0.10 (machine gun), 0.25 (heavy single shots such as the marksman's) or 0.40 (explosive). The amount doubles on the soldier being targeted.
- The meter caps at 1.0 and decays exponentially with a 2.5 s time constant.
- Above 0.5 a soldier goes prone and accuracy falls by up to 40%. Above 0.7 the rate of fire drops by a third.

Scaled to Squad's 200% ceiling, Pixel Ops' machine-gun round (0.10) equals Squad's general-purpose machine gun round. Its marksman already gets the heavier near-miss weight that 10.5.2 moved toward. Its decay, which halves the meter in about 1.7 s, is faster than the ICO's, in line with 10.5.2's direction.

Two gaps remain:

- **One cap for every weapon.** Enough rifles alone can pin a squad. Scaled the same way, Squad's rifle cap is 0.575: just above Pixel Ops' 0.5 prone threshold and below its 0.7 pin threshold. Per-class caps of about 0.55 for rifles (forces prone, never pins) and 0.8 for machine guns and marksmen would restore Squad's rule that suppression is a heavy-weapon job.
- **No friendly suppression.** Pixel Ops excludes the shooter's team from all suppression, where Squad's explosives rattle everyone. That matters once artillery call-ins exist.

Squad publishes no stance multipliers for accuracy or visibility. Only its bots, since 9.0, notice crouched and prone players less, which is the rule Pixel Ops' smaller-silhouette effect already resembles ([Patch 9.0](https://store.steampowered.com/news/app/393380/view/1809235871756104)).

### Wounds: a 300-second downed state makes revives save tickets

Squad separates four states: wounded, bleeding, incapacitated and dead. A player at zero health is incapacitated for up to 300 s. Any teammate can revive them with a field dressing, and medics do it 50% faster. Revived players return at 20% health. The ticket is spent only on bleed-out or give-up ([Wiki: Health Management](https://squad.fandom.com/wiki/Health_Management)). Later patches refined this:

- **2.7 (13 May 2021):** added a recovery state in which going down again means instant death ([Patch 2.7](https://store.steampowered.com/news/app/393380/view/4767601588111310493)).
- **2.11:** small-arms hits under 260 damage no longer shorten the downed timer ([Patch 2.11](https://store.steampowered.com/news/app/393380/view/4022264629308405733)).
- **ICO:** added a post-revive "hurt" state with slower stamina recovery, which "makes medics more relevant" ([Revisiting the ICO](https://www.joinsquad.com/archive/revisiting-the-infantry-combat-overhaul-c0926)).
- **10.6 and 10.6.1 (October 2026):** added a revive progress bar and a visible give-up button ([Patch 10.6.1](https://store.steampowered.com/news/app/393380/view/1846018067927017)).

Because the 30 s respawn timer runs while a player is down, waiting for a medic costs time, not tickets. That trade drives medic play in Squad.

Pixel Ops already charges the infantry ticket at respawn, so a revive saves it. But only medics revive. They must be within 14 m and act within a 12 s window; the revive takes 3 s and the soldier returns at 50% health ([support.js](../src/game/support.js)). The window is shorter than the 15 s respawn, so there is no real choice between waiting and respawning. A version shaped like Squad's would:

- give downed soldiers about 45 s;
- let any squadmate revive in about 6 s, and medics in 3 s;
- return revived soldiers at 20–25% health with a short accuracy penalty;
- make a second down within a minute fatal;
- have a downed soldier give up automatically when no friendly is within about 40 m.

The CPU would then need to decide between rescuing and pushing on, the kind of tactical choice its utility scoring is built for.

### Vehicles: long respawns, late arrivals, and light armour that dies in two hits

Squad makes heavy vehicles scarce over time. Wiki tables marked current as of 7.0 give these respawn times: about 3 minutes for trucks, 10 for the M1126 APC, 15 for the BTR-82A IFV and 20 for the T-72B3 tank ([Wiki: M939](https://squad.fandom.com/wiki/M939); [Wiki: M1126](https://squad.fandom.com/wiki/M1126); [Wiki: BTR-82A](https://squad.fandom.com/wiki/BTR-82A); [Wiki: T-72B3](https://squad.fandom.com/wiki/T-72B3)). Patches since:

- **7.2:** helicopters from 6 to 10 minutes ([Patch 7.2](https://store.steampowered.com/news/app/393380/view/5679673637671132649)).
- **8.2 (December 2024):** tank respawn delays of 20 minutes on most mechanized battlegroups ([Patch 8.2](https://store.steampowered.com/news/app/393380/view/1784506359151949)).
- **9.0:** first helicopters arrive at 10 minutes for motorized battlegroups, and first tanks at 20. Combined-arms battlegroups dropped from three IFVs to two to "reduce the overall amount of heavy vehicles" ([Squad 9.0 release notes](https://www.joinsquad.com/updates/squad-9-0-release-notes)).
- **10.2:** changed "helicopter timing… from 10 mins to 5 mins", without saying whether that means the respawn or the first spawn ([Patch 10.2](https://store.steampowered.com/news/app/393380/view/1821922921821975)).

Compared with the 30 s infantry timer, Squad's APC is out of action 20 times as long and its IFV 30 times. Against Pixel Ops' 15 s infantry timer, its APC (90 s) is out 6 times as long, its helicopter (120 s) 8 times and its truck (60 s) 4 times ([rules.js](../src/game/rules.js)). Matching Squad's scarcity means an APC respawn near 300 s and a first-arrival delay of a few minutes for APCs and helicopters. Trucks can stay fast.

Squad armour also takes fewer hits to kill than Pixel Ops'. Light AT rockets deal 960 base damage and heavy tandem rockets 1,400. The BTR-82A has 1,000 HP, the M1126 1,250 and every tank 3,000, before per-vehicle multipliers and armour angles ([Wiki: RPG-7](https://squad.fandom.com/wiki/RPG-7); [Wiki: T-72B3](https://squad.fandom.com/wiki/T-72B3)). Two light AT hits therefore kill most light armour, and three tandem hits kill a tank. Components such as tracks, engine, turret and ammo rack can be disabled separately ([Wiki: Vehicles](https://squad.fandom.com/wiki/Vehicles)). Pixel Ops' APC has 600 HP and takes five 120-damage rockets ([units.js](../src/core/units.js); [weapons.js](../src/game/weapons.js)). Two to three rockets, with a bonus for side and rear hits and a mobility kill on the first rear hit, would give AT squads Squad's ambush value and make a longer respawn hurt.

In Squad, unoccupied vehicles left more than 150 m from any rally or FOB start to burn after 20 minutes ([Wiki: Vehicles](https://squad.fandom.com/wiki/Vehicles)). That is a cheap guard against parked vehicles. Its claim and crew-kit rules exist to settle disputes between humans and add nothing to a 1v1.

## A ranked port list for Pixel Ops

| Rank | Change | Squad reference (version) | Pixel Ops today | Suggested starting value |
|---|---|---|---|---|
| 1 | Rally point per squad | 60 s wave, 20 s cut-off, 120 s cooldown, 8 m, 50 m block, 30 m destruction | none | 30 s wave, 10 s cut-off, 60 s cooldown, 2 within 8 m, 30 m block, 15–20 m destruction |
| 2 | FOB overrun and activation delay | 30 s activation (4.2); 2 enemies at 20 m to 9 at 90 m (4.4) | none | 15 s activation; 2 enemies at 10 m, +5 m each, cap 30 m |
| 3 | Objective-paid tickets and mercy bleed | +50/+20, 0 for loss (9.0, 4.3); 60/min mercy | −20 per loss; 12/min bleed; instant win | +50/+20, 0 for loss; 2/min per location past midpoint; 120/min mercy |
| 4 | Invasion economy | 250 v 800, +125 per capture, no recapture (8.1–8.2) | 650 v 400, −30 per loss, recapture possible | 500 v 1,600, +250 per capture, locked captures, clock as backstop |
| 5 | Downed state | 300 s down, any teammate, medic 50% faster, 20% health, second down fatal (2.7) | 12 s, medic only, 50% health | 45 s; 6 s squadmate, 3 s medic; 25% health; second down fatal |
| 6 | Radio bleed and teardown | 75 s window, −20, free friendly teardown (4.4, 2.16) | −40 at once | 40 s window, −40, free friendly teardown |
| 7 | Suppression caps by weapon class | 9/15/20/50% per round; caps 115–200% | one cap, own explosives harmless | rifle cap 0.55, machine gun/marksman 0.8; explosives suppress both sides |
| 8 | Vehicle pacing and AT damage | APC 10 min, tank 20 min, first-arrival delays (9.0); 2 light AT hits on light armour | 90/120 s respawns; 5 rockets per APC | APC 300 s; 3 min first-arrival delay; 2–3 rockets with rear bonus |
| 9 | Skirmish and TC rules | anchor + 5 (9.0); TC 1→120/min curve, 95% wins | deathmatch; flat bleed, 80% wins | anchors Outpost/Relay; TC curve unchanged |
| 10 | Commander call-ins | UAV 10, airstrike 15, artillery 30 min; within 30 m of a HAB | none | UAV 4 min, barrage 10 min, 5 min opening cooldown, near a FOB, CPU gets the same |
| 11 | Staging and RAAS | 3 min staging (60–300 s, 10.3); 3–5 lanes × 7 × ~2 | none | 30–45 s staging; 2–3 lanes × 5 × 2–3 with objectives shown |

Every item touches the utility commander, which today plans only the chain-of-flags modes (AAS and Invasion) and falls back to the built-in planner elsewhere ([utility.js](../src/game/ai/utility.js)). Squad's bot work supplies fairness rules worth copying directly:

- a 150 ms sight-reaction delay, added in 10.6 "so bots never instantly kill a player before they can reasonably react";
- reduced detection of crouched and prone players;
- no sight through smoke or thick foliage;
- half the suppression bots previously took (9.0).

([Patch 10.6](https://store.steampowered.com/news/app/393380/view/1845383656383372); [Patch 9.0](https://store.steampowered.com/news/app/393380/view/1809235871756104)). Squad's bots offer nothing on logistics. OWI's bots fight, drive and man turrets, but its player-vs-bot mode is built from short missions (Combined Arms, Destroy, Extraction, Vehicle Hunt) rather than the FOB-and-logistics loop ([OWI: Fireteam](https://joinsquad.com/updates/fireteam-a-brand-new-pve-game-mode-for-squad)). So the CPU's handling of rally placement, FOB defence against overrun, and attacks on the player's spawns has no Squad precedent, and that is where testing time should go.

## Conclusion

The gap between Pixel Ops and Squad is one of structure, not size. Scaled to pool size, Pixel Ops' FOB and APC prices already match Squad's. What differs is where ticket pressure comes from: Pixel Ops charges teams for holding less and losing ground, while Squad pays them for taking ground and makes them defend their spawns. Pixel Ops also lacks the timing layer Squad builds around spawning: rally waves, activation delays and overrun. Most of the fix is a handful of values in `rules.js` plus two new mechanics, so it is cheap to try.

Squad's history also says the values matter more than the mechanics:

- the HAB activation delay was retuned three times and the overrun radius twice;
- the flag reward went from +50 to +60 and back to +50;
- a convenience feature (the HAB ammo crate) was reverted within three weeks.

Pixel Ops should treat these values as tunable data and measure them with an after-action ticket breakdown rather than settling them by argument. Squad is also still changing: in September 2026 OWI said it would look at reworking AAS, RAAS and Insurgency, and the announced TC rework has not shipped ([CDT Progress Report, Sep 2026](https://store.steampowered.com/news/app/393380/view/1844751498232628)). Copy the ratios and design reasons rather than freezing today's numbers.
