# Squad (OWI): squad and command roles, infantry combat systems and vehicle rules, adapted for Pixel Ops

Scope and source note. The current game is v10.6.x (10.6 released 1 Oct 2026; hotfix 10.6.3 on 22 Oct 2026). Primary sources are OWI patch notes and dev blogs (joinsquad.com and Steam announcements) and the official Squad Wiki on Fandom (squad.fandom.com, read through its MediaWiki API). Many wiki pages date from Alpha or Beta builds (2016-2022) and are not updated for later patches. Each wiki figure below is marked "(wiki, date unclear)" unless the page states a version. The patch-note dates are the Steam announcement dates.

Release dates used below: ICO announced 8 Jun 2023; v6.0 (ICO) released 26-27 Sep 2023; 7.0 on 12 Dec 2023; 7.1 on 6 Feb 2024; 7.2 on 12 Mar 2024; 7.3 on 16 Apr 2024; 8.0 on 10 Jun 2024; 8.1 on 23 Sep 2024; 8.2 on 2 Dec 2024; 9.0 (UE5) on 2 Sep 2025; 10.0 on 10 Nov 2025; 10.1 on 1 Dec 2025; 10.2 on 19 Jan 2026; 10.3 on 17 Feb 2026; 10.4 on 30 Apr 2026; 10.5 on 15 Jun 2026; 10.5.2 on 12 Aug 2026; 10.6 on 1 Oct 2026 — [Steam announcements feed, app 393380](https://steamcommunity.com/app/393380/announcements/)

## 1. Squad structure: sizes, roles and kits, kit limits, unlocks by squad size

### Takeaway
A squad holds up to 9 players. Kits are gated in four ways: squad size, a per-role cap per squad, a cap of 3 Fire Support kits per squad, and team-wide caps that unlock as the team grows. Specialist kits (HAT, MG, Sniper, Combat Engineer) are limited to about 2 per team and 1 per squad. Pixel Ops' fixed 4-man squad with free kit choice has none of these gates.

### Cited Findings
- Squads hold up to 9 players. The SL role is called Section Leader for the BAF, Cell Leader for INS and Senior Rifleman for the VDV — [Wiki: Squad Leader](https://squad.fandom.com/wiki/Squad_Leader)
- There are four role types. Command and Support: SL, Lead Crewman, Lead Pilot, Medic, Crewman, Pilot. Direct Combat: Rifleman, Raider (INS), Ambusher (IMF), Automatic Rifleman. Fire Support: Grenadier, LAT, Marksman, Scout, Infiltrator (IMF). Specialist: Sniper, Machine Gunner, HAT, Combat Engineer, Sapper (INS), Saboteur (IMF). "Recruit" is a stripped kit for players kicked from a squad — [Wiki: Kit Role Selection](https://squad.fandom.com/wiki/Kit_Role_Selection)
- The four limitation types are squad size, number per role (e.g. Medic max 2 per squad), role type (Fire Support max 3 per squad, e.g. 1 Grenadier + 1 LAT + 1 Marksman, or 1 Grenadier + 2 LAT), and team-wide caps. A player keeps a kit that later becomes unavailable until they change kit — [Wiki: Kit Role Selection](https://squad.fandom.com/wiki/Kit_Role_Selection)
- Squad-size unlocks for conventional factions (wiki table, date unclear):
  - Squad Leader 1st and 2nd kits at size 1; optic kit at 3.
  - Lead Pilot at 1; Lead Crewman at 2; Crewman and Pilot at 2+.
  - Medic 1st kit at 2; optic kit at 5.
  - Rifleman basic kits at 1; optic kits unlock one each at 3, 6 and 9.
  - Automatic Rifleman 1st at 4; 2nd (Fire Support, optic) at 8.
  - LAT 1st at 3; 2nd at 6.
  - Grenadier, Marksman, Sniper, Machine Gunner, HAT and Combat Engineer at 5.
  - Unconventional factions are similar; Raider (INS) at 6, Sapper at 5 — [Wiki: Kit Role Selection](https://squad.fandom.com/wiki/Kit_Role_Selection)
- Sources conflict on HAT and Combat Engineer. The HAT page says a squad needs at least 3 players to claim a HAT kit, and the Combat Engineer page says 3. The Kit Role Selection table says 5 — [Wiki: Heavy Anti-Tank](https://squad.fandom.com/wiki/Heavy_Anti-Tank); [Wiki: Combat Engineer](https://squad.fandom.com/wiki/Combat_Engineer); [Wiki: Kit Role Selection](https://squad.fandom.com/wiki/Kit_Role_Selection)
- Team-wide caps (wiki, date unclear). The thresholds are team player counts:
  - AR primary: max 4, unlocking at 3/9/15/21. AR secondary: max 4, at 6/12/18/24.
  - Grenadier: max 4, at 5/15/25/35, and 1 per squad.
  - LAT primary: max 4, at 3/9/15/21. LAT secondary: max 4, at 6/12/18/24.
  - Marksman: max 4, at 10/20/30/40.
  - Sniper: max 2, at 15/20, 1 per squad.
  - Machine Gunner: max 2, at 15/20, 1 per squad.
  - HAT primary: max 1, at 15. HAT secondary: max 1, at 20. Both 1 per squad.
  - Combat Engineer: max 2, at 15/20, 1 per squad.
  - Sapper: max 4, at 5/10/15/20, 1 per squad — [Wiki: Kit Role Selection](https://squad.fandom.com/wiki/Kit_Role_Selection); [Wiki: Grenadier](https://squad.fandom.com/wiki/Grenadier)
- The LAT page gives 1 primary and 1 secondary LAT per squad, unlocking at squad sizes 3 and 6, and 4 + 4 per team, unlocking at team sizes 6/12/18/24 — [Wiki: Light Anti-Tank](https://squad.fandom.com/wiki/Light_Anti-Tank)
- Later role changes:
  - 9.0 (Sep 2025) moved the Scout into the Specialist category with a portable quad drone, max 2 per team. CRF Squad Leaders carry up to 3 rallies with a 30-ammo rearm — [Squad 9.0 release notes](https://www.joinsquad.com/updates/squad-9-0-release-notes)
  - 10.0 (Nov 2025) fixed Scout kits sharing the HAT kit limit — [Squad 10.0 patch notes](https://www.joinsquad.com/updates/squad-10-0-patch-notes)
  - 10.6 (Oct 2026) made the Squad Leader Crewman kit require being SL — [Squad 10.6 release notes](https://www.joinsquad.com/updates/squad-10-6-release-notes)
  - 10.4 (Apr 2026) set Crewman and SL Crewman to 4 magazines and some HAT 01 kits to 1 Tandem round — [Squad 10.4 patch notes (Steam)](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1831432155569227)
- Kit switching:
  - Kits can be changed at an ammo crate or a vehicle, at the cost of the kit's full ammo-point price. Switching in the deployment menu spawns you with minimum ammo, except at main or on first spawn — [Wiki: Kit Role Selection](https://squad.fandom.com/wiki/Kit_Role_Selection)
  - Most vehicles only allow switching to Crewman or Lead Crewman. APC Logistics vehicles, APCs, IFVs and transport helicopters allow any infantry kit — [Wiki: Vehicles](https://squad.fandom.com/wiki/Vehicles)
- Only Riflemen carry an ammo bag that resupplies friendly players — [Wiki: Kit Role Selection](https://squad.fandom.com/wiki/Kit_Role_Selection)
- Combat Engineer kit: C4/TNT with a 30 s timer and 5 m radius that ignores walls, 3 AT mines (conventional factions), a repair toolbox, and faster building and digging. BAF and CAF lost AT mines in v4.4 (Apr 2023) — [Wiki: Combat Engineer](https://squad.fandom.com/wiki/Combat_Engineer)

### Inferences
- Pixel Ops: kits — already have; size gating — lacks. Pixel Ops already has rifle, MG, AT, marksman, medic and engineer kits in 4-man squads. It lacks Squad's gating. A light adaptation would be team-wide caps for strong kits (for example, a heavy-AT and MG cap of 2 per side) and "fire support max N per squad". These are cheap to implement and give the CPU and the player a real composition choice.
- A squad of 4 in Squad would unlock only SL, Medic, Rifleman, AR and LAT. MG, HAT, Marksman and Grenadier need 5 or more. Pixel Ops' 4-man MG and marksman squads therefore correspond to a Squad squad of 5 or more.

### Gaps
- No current (2025-2026) official kit-limit table was found. The wiki table predates the battlegroup and unit system (7.0+) and the 9.0 Scout change, so per-faction and per-unit limits may differ.
- The wiki gives two conflicting minimum squad sizes for HAT and Combat Engineer (3 vs 5).

## 2. Squad Leader: tools, markers, orders, rally, FOB radio

### Takeaway
The SL is the only player who can place rally points and FOB radios, claim vehicles and request commander fire. The SL also talks on the command net. Rally points are the main mechanical lever: one per squad, wave spawns every 60 s, a 120 s placement cooldown, and destruction by any enemy within 30 m. Orders are mostly voice and markers; the 10.6 update (Oct 2026) added squad-wide observe markers on the compass.

### Cited Findings
- The SL has six unique abilities in a radial menu (hold T). SLs use rallies, the command channel and map markers to relay enemy positions. The SL kit carries field binoculars and a rally point — [Wiki: Squad Leader](https://squad.fandom.com/wiki/Squad_Leader)
- There are three voice channels: Local (proximity), Squad, and Command Net (SLs only). Squad Leaders can also message one other SL directly — [Wiki: Squad](https://squad.fandom.com/wiki/Squad). SLs talk to the Commander directly with Num 0 — [Wiki: Commander](https://squad.fandom.com/wiki/Commander)
- Rally point rules:
  - One active rally per squad. Placing one needs at least one other squad member within 8 m.
  - Rally points are deployables, placed once and then rearmed for 50 ammo. Placement has a 120 s cooldown.
  - A rally cannot be placed within 50 m of an enemy; a failed attempt resets the 120 s timer, and appointing a new SL resets it too.
  - Any enemy within 30 m, including enemies in vehicles, destroys the rally.
  - Rallies are the only wave spawn: a repeating 60 s countdown with a minimum wait of 20 s (so dying at 15 s left means a 75 s wait). Other spawns need 30 s dead or incapacitated.
  - Since v12 (Alpha), rallies have unlimited spawns; before that they had 9.
  - Insurgent "buddy rally": a dead SL can place a rally on an existing friendly rally, with a 60 s cooldown — [Wiki: Rally Point](https://squad.fandom.com/wiki/Rally_Point)
- The FOB radio can only be placed by an SL with an SL kit. It needs a logistics vehicle within 30 m and one more team member within 30 m. It must be at least 150 m from main and at least 400 m from other friendly radios (300 m on small maps). Deployables can be built within 150 m of the radio — [Wiki: Forward Operating Base](https://squad.fandom.com/wiki/Forward_Operating_Base)
- FOB supplies and damage:
  - FOBs start with 0 construction and 0 ammo points and hold up to 20,000 of each.
  - The HAB (spawn bunker) gives a spawn point. Radio damage below 75% disables connected spawns.
  - A destroyed radio "bleeds" for 75 s (as of v4.4) before it is gone, costing 20 tickets.
  - Fireteam Leaders can place only certain fortifications — [Wiki: Forward Operating Base](https://squad.fandom.com/wiki/Forward_Operating_Base)
- 10.6 (Oct 2026) markers:
  - Squad members can place an "Observe Marker", a blue circle shown only on the compass and only to their squad, with a set duration and cooldown.
  - Placing it plays a hand gesture, as for SL and FTL observe markers.
  - The compass was upgraded to direct soldiers to markers placed by squadmates and the SL — [Squad 10.6 release notes](https://www.joinsquad.com/updates/squad-10-6-release-notes)
- 10.6.1 (7 Oct 2026) set observe markers placed by players who are neither SL nor FTL to an 8 s cooldown and a 5 s lifetime — [Squad 10.6.1 release notes](https://www.joinsquad.com/updates/squad-10-6-1-release-notes)
- 10.6 added parties: the Party Leader automatically becomes the in-game Squad Leader, and auto-created squads default to unlocked — [Squad 10.6 release notes](https://www.joinsquad.com/updates/squad-10-6-release-notes)
- Requesting tactical support is an SL action: the SL marks a location and radius in the radial menu — [Wiki: Commander](https://squad.fandom.com/wiki/Commander)
- Only SLs can claim vehicles for their squad — [Wiki: Vehicle Claiming](https://squad.fandom.com/wiki/Vehicle_Claiming)
- 8.0 (Jun 2024) fixed squad map markers being removed when an SL was promoted to Commander — [Squad 8.0 release notes](https://www.joinsquad.com/updates/squad-8-0-release-notes)
- Most servers kick an SL without a microphone. This is a community rule, not a game mechanic — [Wiki: Squad Leader](https://squad.fandom.com/wiki/Squad_Leader)

### Inferences
- Pixel Ops: lacks. There is no SL role. The rally point is the single most portable SL mechanic for a top-down RTS:
  - a squad-owned forward spawn;
  - needs 2 units within 8 m to place;
  - cannot be placed within 50 m of enemies;
  - is destroyed if an enemy comes within 30 m;
  - spawns in waves every 60 s, with a 120 s re-place cooldown.
- An SL unit could also gate "place FOB" (with a truck within 30 m) and "request fire support" (see question 3). The rest of Squad's SL role is voice and coordination, which in Pixel Ops is the player's own job.

### Gaps
- No source lists the full SL marker set (attack, defend, move, enemy types) or SL marker durations and limits. Only the 10.6.1 figures for non-SL markers were found.
- There is no formal "order" system beyond markers; orders are voice.

## 3. Commander: selection, assets, cooldowns, requirements, comms

### Takeaway
The Commander is an SL elected by the other SLs. They get a small set of long-cooldown assets: recon (UAV or drone, about 10 min) and fire (155 mm artillery at 30 min, an airstrike at 15 min, or a heavy mortar barrage at 20 min). Firing an asset follows a request, accept, confirm, choose flow and needs the Commander within about 30 m of a built HAB (or, for unconventional factions, a vehicle). Ordnance is deliberately inaccurate and causes friendly fire. Asset lists now vary by faction and unit. OWI said in March 2024 that it plans a full commander rework; no such rework appears in patch notes up to 10.6.3.

### Cited Findings
- Selection:
  - Chosen by vote. To nominate, an SL needs 2 squad members and there must be at least 3 squads. All SLs vote. The winner's squad is renamed "CMD SQUAD".
  - A new commander can be elected after 300 s, and a new commander resets the cooldowns.
  - A Commander death costs 2 tickets instead of 1.
  - There is no Commander in Skirmish or on the small maps Logar and Sumari — [Wiki: Commander](https://squad.fandom.com/wiki/Commander)
- Two action types:
  - Strategic (recon) needs no request.
  - Tactical (weapons) is a four-step process. An SL (or the Commander) marks a location with a radius ("Request Tactical Support"). The Commander has 1 minute to accept or deny. On accept, the timer refreshes and the Commander has another 1 minute to confirm. Only then does the Commander choose the action and set direction and radius.
  - Every action has its own cooldown and an initial cooldown at match start — [Wiki: Commander](https://squad.fandom.com/wiki/Commander)
- Conventional factions (wiki):
  - UAV recon (MQ-9, CH-4A, Pchela-1T): 10 min cooldown, 30 s delivery.
  - 155 mm artillery, static or creeping: 30 min cooldown, about 60 s delivery, 2 ranging shots first.
  - Airstrike (A-10, F/A-18, JH-7A, Su-25, F-16): 15 min cooldown, about 40 s delivery, flown along a commander-drawn line.
  - To execute step 4, the Commander must be within about 30 m of a friendly fully built HAB — [Wiki: Commander](https://squad.fandom.com/wiki/Commander)
- Unconventional factions (wiki):
  - Handheld drone: 10 min cooldown plus any remaining flight time if the last drone was destroyed. Instant, with a 10 min battery and a max altitude.
  - Heavy mortar barrage (INS, IMF): 20 min cooldown, about 35 s delivery, about 65 rounds across a 150 m diameter, no ranging shots, less accurate than artillery.
  - WPMC F-16: "likely" 15 min (the wiki marks this as unconfirmed).
  - Usable within about 30 m of a built HAB or a friendly vehicle — [Wiki: Commander](https://squad.fandom.com/wiki/Commander)
- Barrage statistics (wiki):
  - Artillery: base damage 125, max splash 450, splash radius 75 m (21 m figure in parentheses), guaranteed-kill radius 16 m.
  - A static barrage fires about 42 rounds. A creeping barrage fires about 67 rounds over a lane 170-400 m long and 150 m wide.
  - Heavy mortar barrage: max splash 300, splash radius 45 m (13 m), guaranteed-kill radius 9.8 m, about 111 rpm, 110 m/s.
  - "Not 100% accurate, be wary of friendly fire" — [Wiki: Commander](https://squad.fandom.com/wiki/Commander)
- The wiki works out the earliest possible airstrike as about 16 min after the round starts (about 3:57 staging, then the 15 min initial cooldown, then 40 s delivery) — [Wiki: Commander](https://squad.fandom.com/wiki/Commander)
- Sources conflict on artillery cooldown. A community guide says players report real cooldowns of about 8-10 min for artillery (and that "90 s" is the barrage duration). It is unofficial and conflicts with the wiki's 30 min — [GuildOrder: Commander assets and cooldowns](https://guildorder.com/games/squad/wiki/commander-assets-and-cooldowns)
- 7.x (Dec 2023-Apr 2024): factions were split into units with their own vehicle and FOB lineups, "may be expanded to include ... commander abilities" — [Squad 7.2 release notes](https://www.joinsquad.com/updates/squad-7-2-release-notes)
- March 2024 Dev Q&A: "we plan to completely rework the current commander system ... that also leans into the asymmetric design of different factions and units" — [Squad Developer Q&A, March 2024](https://www.joinsquad.com/updates/squad-developer-q-a---march-2024)
- 8.0 (Jun 2024) added an indicator showing when commander abilities are unavailable on a map — [Squad 8.0 release notes](https://www.joinsquad.com/updates/squad-8-0-release-notes)
- 8.1 (Sep 2024): the WPMC Commander gets the handheld drone, the heavy mortar barrage and the F-16 rocket strike (as TLF has). They can use these next to vehicles as well as HABs — [Squad 8.1 release notes](https://www.joinsquad.com/updates/squad-8-1-release-notes)
- 9.0 (Sep 2025): the commander quad drone has a 10 min battery, against 4 min for the new Scout drone. Drones die to one shot — [Squad 9.0 release notes](https://www.joinsquad.com/updates/squad-9-0-release-notes)
- 10.0 (Nov 2025): the Ukrainian (AFU) commander gets a Precision Bomb Strike (an SU-25 dropping 2 FAB-250 bombs on a precise area), a Bayraktar TB2 recon UAV, and 152 mm static and creeping barrages. No cooldowns were published — [Squad 10.0 patch notes](https://www.joinsquad.com/updates/squad-10-0-patch-notes)
- 10.6 (Oct 2026): the Commander menu no longer closes when the player moves — [Squad 10.6 release notes](https://www.joinsquad.com/updates/squad-10-6-release-notes)
- Some support units (e.g. USA 497th, 8.0) get an extra HAB and ATGM per FOB. Unit screens list "special characteristics" such as "Intel on Enemy Vehicle Spawn Times" (7.3) — [Squad 8.0 release notes](https://www.joinsquad.com/updates/squad-8-0-release-notes); [Squad 7.3 release notes](https://www.joinsquad.com/updates/squad-7-3-release-notes)

### Inferences
- Pixel Ops: lacks. There are no player commander assets. Squad's design is a good template for a 1v1 RTS:
  - 3-4 assets on long cooldowns relative to match length (recon about 10 min, airstrike 15 min, heavy barrage 20-30 min);
  - an initial cooldown so nothing fires in the opening;
  - a placement requirement (near a HAB-equivalent or a command vehicle);
  - visible delivery delay (30-60 s) and ranging shots that warn the target;
  - scatter that can hit friendlies.
- Squad's double-confirm request flow exists to coordinate humans and could collapse to a single click in Pixel Ops. The CPU commander could use the same assets under the same cooldowns, which also gives an "enemy commander asset ready" signal.
- Scale the cooldowns to Pixel Ops' match length. Squad rounds run about 60-120 min, so a 15-30 min cooldown means 2-6 uses per match.

### Gaps
- No official current cooldown table for 2025-2026 assets (AFU bomb strike, TB2, 152 mm, WPMC rocket strike, drones) was found. The wiki's 30/15/10/20 min figures are older and unversioned.
- It is unconfirmed whether initial cooldowns equal the regular cooldowns, beyond the wiki's airstrike example.
- No evidence was found of cruise missiles, CAS helicopters or ammo/logistics drops as commander assets.

## 4. Suppression: triggers, effects, duration; ICO (v6.0) and later changes; stance effects

### Takeaway
Under ICO (v6.0, Sep 2023), suppression was a per-player meter. Near misses and explosions filled it, by different amounts per weapon class and up to a class cap; it drained at 20% per second and drove escalating blur, sway and flinch. In Aug 2026 (10.5.2) OWI reworked it: faster decay, a smaller and smarter trigger, MGs as area suppressors and marksman or battle rifles as "point" suppressors, and vignette tunnel vision instead of fullscreen blur. Suppression also disables hold-breath. In 10.6 (Oct 2026), shots must pass within 3 m to suppress well. Stance mainly changes sway, recoil and ADS speed; there is no published stance accuracy or visibility multiplier for players.

### Cited Findings
- ICO timeline: announced 8 Jun 2023; testing concluded 20 Sep 2023; released as v6.0 on 27 Sep 2023. It covered suppression, stamina, weapon stabilization, picture-in-picture optics, point-shooting and "deadzone" — [Wiki: Infantry Combat Overhaul](https://squad.fandom.com/wiki/Infantry_Combat_Overhaul)
- ICO goals:
  - Suppression is a core part of combat, gives MGs purpose, and makes firing at an enemy's general location useful. It "blurs the distance but keeps the foreground navigable".
  - Higher levels last longer. Sway and flinch penalties apply.
  - MGs suppress more, faster and longer, including vehicle HMGs and autocannons.
  - Explosions suppress in an area (grenades, mortars, artillery, autocannon HE-frag).
  - Players in protected turrets and emplacements resist suppression — [OWI: Infantry Combat Overhaul announcement, 8 Jun 2023 (archived)](https://web.archive.org/web/20231225050244/https://joinsquad.com/2023/06/08/infantry-combat-overhaul/)
- Friendly weapons do not suppress teammates, except explosives — [OWI: Revisiting the ICO, 20 Sep 2023 (archived)](https://web.archive.org/web/20230927190854/https://joinsquad.com/2023/09/20/revisiting-the-infantry-combat-overhaul/)
- ICO-era mechanics (wiki; consistent with v6.0-10.5.1; superseded in part by 10.5.2):
  - Trigger radius: 6 m (6.05 m) for rifles, carbines, bullpups and pistols; 10 m for DMRs, LMGs, battle rifles, GPMGs, sniper rifles and HMGs.
  - Per round: 9% (rifle or pistol), 15% (LMG or DMR), 20% (GPMG, battle rifle or sniper), 50% (HMG).
  - Caps: 115%, 125%, 135% and 200% respectively.
  - Full value inside 1 m, then linear falloff (pistols fall off harder). Explosives, IEDs and command artillery apply full value out to 25 m.
  - Decay is linear at 20% per second, so 10 s to clear from 200%.
  - Bullets suppress only enemies; explosions suppress everyone — [Wiki: Suppression](https://squad.fandom.com/wiki/Suppression)
- ICO-era effects by level (wiki):
  - Per hit: vignette, flinch or aim punch (with diminishing returns), and short sway.
  - Depth-of-field blur from 1%, maxing at 60%.
  - "Screen dirt" from 125% to 135%.
  - Chromatic aberration, desaturation and fish-eye from 135% to 190%.
  - Worked example: 3 M4 rounds within 1 m give 27%, which is 45% of max blur — [Wiki: Suppression](https://squad.fandom.com/wiki/Suppression)
- ICO gunplay and movement:
  - Fewer fights end in 1-2 shots. Recoil misalignment was added, and sway now has rotational and offset layers.
  - Sway is driven by stamina, movement and stance. Hold-breath benefit fades in over a couple of seconds.
  - Per-stance ADS time: faster crouched, fastest prone or on a bipod.
  - Hip-fire was replaced by point-shooting.
  - Movement speed was reduced, stamina regen slowed, no mid-air vault, and fall damage became a percentage of remaining health — [OWI: ICO announcement (archived)](https://web.archive.org/web/20231225050244/https://joinsquad.com/2023/06/08/infantry-combat-overhaul/)
- v6.0 notes: "players who are in a bad position ... are more likely to be wounded or suppressed, and less likely to be instantly killed". Nametags now show only with line of sight — [Squad v6.0 release notes (archived)](https://web.archive.org/web/20240111140016/https://joinsquad.com/2023/09/26/squad-update-6-0-release-notes/)
- ICO revisit on weapon roles:
  - Carbines and short rifles give the least suppression.
  - DMRs and battle rifles have less recoil and sway in supported stances (crouch or prone) and more when standing. Battle rifles give high suppression.
  - LMGs suit area suppression. MMGs should be bipodded or prone. HMGs give high suppression at long range.
  - Pistols always cause bleeding on a hit — [OWI: Revisiting the ICO (archived)](https://web.archive.org/web/20230927190854/https://joinsquad.com/2023/09/20/revisiting-the-infantry-combat-overhaul/)
- 7.0 (Dec 2023): helicopter pilots are no longer suppressed, and suppression now works for players in vehicles and emplacements — [Squad 7.0 release notes](https://www.joinsquad.com/updates/squad-7-0-live-release-notes)
- 7.2 (Mar 2024): BM-21 suppression power and radius up; 40 mm AGL, UGL and rifle-grenade suppression up; smoke rounds give small impact suppression; tank SABOT passbys now suppress — [Squad 7.2 release notes](https://www.joinsquad.com/updates/squad-7-2-release-notes)
- 8.2 (Dec 2024): MMG suppression slightly up. Per-stance ADS times standardized to 0.3-0.75 s (MMG), 0.3-0.55 s (some classes) and 0.3-0.45 s (rifles), and 0.2 s (pistols/SMG). Bipod ADS is always 0.3 s — [Squad 8.2 release notes](https://www.joinsquad.com/updates/squad---v8-2-release-notes)
- 9.0 (Sep 2025): suppression aim punch -10%; pistols and SMGs suppress only on very close passes; sway caps reduced; MMG total suppression increased; AI bots are less likely to notice crouched or prone enemies — [Squad 9.0 release notes](https://www.joinsquad.com/updates/squad-9-0-release-notes)
- 10.4 (Apr 2026): all weapons have the same ADS time prone and standing, which removes stance-swap ADS exploits — [Squad 10.4 patch notes (Steam)](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1831432155569227)
- 10.5.2 rework (dev blog 11 Aug 2026, patch 12 Aug 2026):
  - Faster decay. A smaller radius with smarter triggering (a max "angle off" for a miss to count).
  - A lone rifleman suppresses poorly; a fireteam suppresses well. MGs and heavy weapons get a wider radius. Marksman, sniper and battle rifles and the RPK deal "exponentially more" suppression on near misses.
  - Fullscreen blur is replaced by a tunnel-vision vignette that keeps the centre clear; explosives have their own visual.
  - Slightly more sway. Hold-breath is disabled while suppressed, while Focus Zoom is now unlimited.
  - Crack and snap audio is synced to each calibre's suppression radius. Values above 300% are reserved for explosives — [DEV BLOG: Update 10.5.2 - Reworking Suppression (Steam)](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1840310314354899); [Squad 10.5.2 patch notes (Steam)](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1840944183774689)
- 10.6 (Oct 2026):
  - Shooters must hit within 3 m to be most effective, and suppression from misses beyond 3 m is reduced.
  - Weapon alignment punch is cut by 80%, and camera punch on scopes and small-aperture irons is fixed.
  - Fixed: crouched players next to a low wall or window sill sometimes got no suppression.
  - Suppression blocks hold-breath but not zoom — [Squad 10.6 release notes](https://www.joinsquad.com/updates/squad-10-6-release-notes)

### Inferences
- Pixel Ops: already has the core (suppression from nearby rounds, stances, worse aim, smaller silhouettes), with two differences. Squad's tuning is a ready template:
  - a meter per unit;
  - per-weapon-class increments (rifle 9, LMG/DMR 15, GPMG 20, HMG 50) and caps (115/125/135/200) so that only heavy weapons reach the worst tier;
  - linear decay (20%/s before 10.5.2, faster after);
  - a trigger radius (6 m rifle, 10 m MG; about 3 m for full effect after 10.6);
  - explosions suppressing both sides.
- Pixel Ops differs in two places:
  - Squad's suppression lowers the target's accuracy and hold-breath but does not force a stance. Players choose to go prone; Pixel Ops' automatic stance-driving is an AI abstraction of that choice.
  - Squad gives no stealth bonus for stance to human observers. Only its AI bots (9.0) notice crouched or prone enemies less. Pixel Ops' "smaller silhouette" is closer to the bot rule.
- The 2026 direction (rifles weak alone, MGs as area suppressors, near-miss distance mattering) supports giving MG kits in Pixel Ops a wider suppression radius rather than higher damage.

### Gaps
- OWI published no numbers for the post-10.5.2 radius, per-round values or decay rate. The wiki table reflects pre-10.5.2 values.
- No official stance accuracy multipliers (e.g. prone sway x0.5) were found. OWI describes stance effects only qualitatively, plus the ADS-time figures.

## 5. Wounds and medical: incapacitation, bleed-out, give up, revives, healing, ticket and respawn costs

### Takeaway
Squad separates four states: wounded, bleeding, incapacitated and dead. A player at 0 HP is incapacitated for up to 300 s, minus extra time for massive damage, and can be revived. The bleed-out pool does not fully reset between downs. Revived players get up at about 20% HP and need a medic's kit to heal fully. A ticket is lost only when the player bleeds out, gives up or respawns, so revives save tickets. Commanders cost 2 tickets.

### Cited Findings
- The four states (wiki, date unclear):
  - Wounded: vision darkens and weapon stability drops. Heavily wounded players do not regain stamina until treated. Only medics can heal, with the medical kit.
  - Bleeding: starts below 75% health after taking more than 10% damage, and drains -0.3 HP per second until a field dressing is applied by self, a teammate or a medic.
  - Incapacitated at 0%: the player screams (enemies hear it), cannot act except voice, and can be revived or give up.
  - Dead or given up: costs 1 ticket — [Wiki: Health Management](https://squad.fandom.com/wiki/Health_Management)
- Revive rules (wiki, date unclear):
  - "Any teammate can use a field dressing to revive the downed player, but medics revive incapacitated soldiers 50% faster."
  - Incapacitated players survive at most 5 min (300 s), shown to friendlies as a shrinking circle.
  - Revived players regain 20% health.
  - The bleed-out timer "does not refresh until they die and respawn".
  - Massive damage shortens the initial timer or kills outright — [Wiki: Health Management](https://squad.fandom.com/wiki/Health_Management)
- An internal conflict in the same page: a tip dated A15.4 says the incap timer is cut by the damage taken, persists across multiple downs, "resets when a player spawns, and regenerates to Max when the player is alive". That contradicts "does not refresh" — [Wiki: Health Management](https://squad.fandom.com/wiki/Health_Management)
- Medic kit history:
  - 9 field dressings and a medical kit. Bandages 25% faster than other roles (A10.1), although Health Management says 50%. Medics revive "much faster than other roles" (Beta 20).
  - Two medic kits per squad.
  - A13 removed an "insta-death penalty timer". A15.4 tweaked death and revive mechanics — [Wiki: Medic](https://squad.fandom.com/wiki/Medic)
- All players can drag incapacitated teammates (prompt within 10 m, while crouched; slows the dragger and they cannot fire) — [Wiki: Health Management](https://squad.fandom.com/wiki/Health_Management)
- ICO post-revive "hurt state": after a revive, players regain a percentage of stamina at a reduced rate, which encourages them to seek a medic. Before ICO, stamina did not regenerate at all after a revive — [OWI: Revisiting the ICO (archived)](https://web.archive.org/web/20230927190854/https://joinsquad.com/2023/09/20/revisiting-the-infantry-combat-overhaul/)
- 10.6 (Oct 2026): incapacitated soldiers see a HUD progress bar for their revive, and revived players can ADS without moving first — [Squad 10.6 release notes](https://www.joinsquad.com/updates/squad-10-6-release-notes)
- 10.6.1 (Oct 2026): a "Give Up" button is now visible in the Deployment Menu — [Squad 10.6.1 release notes](https://www.joinsquad.com/updates/squad-10-6-1-release-notes)
- 10.6.3 (Oct 2026): fixed a crash when a dead player respawns while still being dragged — [Squad 10.6.3 release notes](https://www.joinsquad.com/updates/squad-hotfix-10-6-3-release-notes)
- Ticket costs: -1 per infantry lost (bleed-out, give up or console respawn) and -2 per Commander lost — [Wiki: Tickets](https://squad.fandom.com/wiki/Tickets); [Wiki: Commander](https://squad.fandom.com/wiki/Commander)
- Respawn timing:
  - Time spent incapacitated counts toward the respawn timer.
  - Main base and HAB spawns need 30 s incapacitated or dead.
  - Rally spawns use 60 s waves with a 20 s minimum — [Wiki: Health Management](https://squad.fandom.com/wiki/Health_Management); [Wiki: Rally Point](https://squad.fandom.com/wiki/Rally_Point)

### Inferences
- Pixel Ops: differs and lacks some states.
  - Same idea: a medic revives a squadmate within 12 s and the unit gets up at 50% HP.
  - Missing: a distinct downed state, give-up, and tickets charged only on death or give-up.
- A Squad-faithful but RTS-paced version:
  - downed state with a 30-60 s bleed-out, not 300 s;
  - any squadmate can revive slowly and medics 2x faster;
  - revived at 20-25% HP with a stamina or aim penalty until a medic heals;
  - the bleed-out pool does not reset between downs;
  - ticket charged only on bleed-out or give-up;
  - downed units can be dragged out of fire.
  The 12 s/50% figures in Pixel Ops are far more generous than Squad's 20% HP.

### Gaps
- Whether non-medics can still revive in 2025-2026 is not confirmed by any patch note. The only source is the undated wiki. Revive durations in seconds (medic vs non-medic) and current healing rates were not found.
- No current statement of the incap timer's damage scaling or regeneration rule was found; the wiki contradicts itself.

## 6. Vehicles: claiming, crew kits and squad-size requirements, respawn timers, ticket costs, repair and rearm, abandonment, loadouts per layer

### Takeaway
Only an SL can claim a vehicle; claim slots scale with squad size in the old wiki model. Armour needs Crewman kits (all crew seats in IFVs and MBTs, the driver in APCs) and helicopters need a Pilot kit; both kits need a squad of 2 or more. Respawn timers are long: trucks about 3 min, APCs about 10 min, IFVs about 15 min, MBTs 20 min after 8.2, helicopters 6, then 10, then 5 min. Ticket costs are about 5 for light and logistics vehicles, 10 for APCs and IFVs, 15 for MBTs, with some conflicting values. Since 7.0, vehicle lineups depend on the faction's unit (battlegroup) and the map layer.

### Cited Findings
- Claiming (wiki stub written for the first claim system, 2016; still the only wiki description):
  - Only SLs can approve claims. An SL who is first into a vehicle auto-claims it; otherwise a player requests and the SL accepts or denies.
  - Claim slots by squad size: 2 members get 2 slots, 4 get 3, 6 get 4.
  - Active claim (a squad member in the vehicle): non-squad players cannot drive, but can take other seats.
  - Passive claim: persists while the vehicle is empty, with the driver seat still locked, but another SL can take it over.
  - Dropping the vehicle at a friendly FOB or main resets the squad's claim — [Wiki: Vehicle Claiming](https://squad.fandom.com/wiki/Vehicle_Claiming)
- A community guide gives a different, unverified scheme: a 2-member minimum to claim, a second vehicle at 3 members, then one more claim per 2 members (on non-match servers). I saw this only in a search snippet; the page itself failed to load (SSL error) — [Rusty In Places: Squad Core Mechanics](https://www.rustyinplaces.org/squad/334-squad-core-mechanics)
- Many server rules require two crew in Crewman-required vehicles and squad names that state the vehicle. These are server rules, not game mechanics — [7th Cavalry Wiki: Squad Rules of Engagement](https://wiki.7cav.us/wiki/Squad_Rules_of_Engagement)
- Crew kits:
  - IFVs and MBTs need a Crewman in every crew position; APCs generally need a Crewman to drive.
  - The Crewman kit can be taken at a vehicle if it has the ammo points and the squad has the required 2 players.
  - Light vehicles and MBTs allow only Crewman kit selection — [Wiki: Crewman](https://squad.fandom.com/wiki/Crewman)
  - The Pilot kit is required to fly helicopters and can be taken from a helicopter. Lead Crewman and Lead Pilot are SL variants of these kits — [Wiki: Pilot](https://squad.fandom.com/wiki/Pilot); [Wiki: Kit Role Selection](https://squad.fandom.com/wiki/Kit_Role_Selection)
  - 10.6 made the SL Crewman kit require being SL — [Squad 10.6 release notes](https://www.joinsquad.com/updates/squad-10-6-release-notes)
- Seats: switching into a seat with F1-F10 kicks non-squad teammates out of essential seats (gunner, commander, loader) but not passenger seats. Entering, exiting and switching seats take time — [Wiki: Vehicles](https://squad.fandom.com/wiki/Vehicles)
- Example per-vehicle statistics (wiki tables, page marked "V7.0 up-to-date"):

  | Vehicle | Class | Tickets | Respawn | HP | Other |
  |---|---|---|---|---|---|
  | BTR-82A | IFV | 10 | 15 min | 1,000 | Turret 300 HP; 600 ammo points |
  | M1126 CROWS M2 | APC | 10 | 10 min | 1,250 | 600 ammo points; 10 passengers |
  | T-72B3 | MBT | 15 | 20 min | 3,000 | 50 ammo points |

  The T-72B3 page notes "all tanks being 3000hp and all tank APFSDS rounds doing 800 damage maximum" — [Wiki: BTR-82A](https://squad.fandom.com/wiki/BTR-82A); [Wiki: M1126](https://squad.fandom.com/wiki/M1126); [Wiki: T-72B3](https://squad.fandom.com/wiki/T-72B3)
- The same pages' older infoboxes conflict: BTR-82A at 10 min and 40 tickets, M1126 at 8 min and 35 tickets — [Wiki: BTR-82A](https://squad.fandom.com/wiki/BTR-82A); [Wiki: M1126](https://squad.fandom.com/wiki/M1126)
- The M939 truck infobox gives 3 min respawn, 8 tickets, 13 seats — [Wiki: M939](https://squad.fandom.com/wiki/M939)
- General ticket costs (wiki): motorcycle 1; light vehicle, transport, logistics, helicopter or cheap APC 5; APC, IFV, artillery vehicle or AT light vehicle 10; MBT 15; FOB radio 20 — [Wiki: Tickets](https://squad.fandom.com/wiki/Tickets)
- Ticket changes in patches:
  - 10.2 (Jan 2026), from the Community Design Team: transport ticket cost 5 to 3 — [Squad 10.2 patch notes (Steam)](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1821922921821975)
  - 10.4 fixed the ZSL-92A open-top APC costing 10 instead of the intended 5 — [Squad 10.4 patch notes (Steam)](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1831432155569227)
- Respawn and spawn-delay changes:
  - 7.2 (Mar 2024): helicopter respawn 6 to 10 min — [Squad 7.2 release notes](https://www.joinsquad.com/updates/squad-7-2-release-notes)
  - 8.2 (Dec 2024): MBT respawn delay 15 to 20 min on all mechanized battlegroups, except TLF (stays 15) and IMF and INS (stay 10) — [Squad 8.2 release notes](https://www.joinsquad.com/updates/squad---v8-2-release-notes)
  - 9.0 (Sep 2025): Motorized battlegroups' helicopter initial spawn delay 6 to 10 min; MBT initial delay 15 to 20 min, except older-tank factions (TLF, IMF, MEI, WPMC) — [Squad 9.0 release notes](https://www.joinsquad.com/updates/squad-9-0-release-notes)
  - 10.2 (Jan 2026): "Helicopter timing changes from 10 mins to 5 mins". It is unclear whether this is respawn or initial delay — [Squad 10.2 patch notes (Steam)](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1821922921821975)
  - 7.3 (Apr 2024): the voting and team screens show each vehicle's initial spawn delay — [Squad 7.3 release notes](https://www.joinsquad.com/updates/squad-7-3-release-notes)
- Damage, repair and rearm (wiki):
  - Armor is directional. Components can be disabled: engine (vehicle crawls), tracks and wheels (immobile or poor traction), turret (below 50% HP it slows; a repair toolbox restores it only to 25%), and ammo rack (cook-off destroys the vehicle).
  - Burning vehicles lose HP until repaired, and some need 2 crewmen repairing at once.
  - Crew in trucks, scout cars and open turrets can be shot; crew in heavier vehicles generally cannot.
  - Repair uses the repair toolbox carried by Crewman, Pilot and Combat Engineer kits.
  - Vehicles carry ammo points for infantry resupply and kit swaps, and can resupply while moving.
  - Logistics vehicles carry construction and ammo supplies; several players unload faster — [Wiki: Vehicles](https://squad.fandom.com/wiki/Vehicles); [Wiki: Crewman](https://squad.fandom.com/wiki/Crewman)
- Repair stations exist at main bases (e.g. 8.0 added one for boats on Invasion v2 and RAAS v1). 10.6 fixed repairs that restored HP but not handling — [Squad 8.0 release notes](https://www.joinsquad.com/updates/squad-8-0-release-notes); [Squad 10.6 release notes](https://www.joinsquad.com/updates/squad-10-6-release-notes)
- Abandonment (wiki, date unclear):
  - Unoccupied vehicles more than 150 m from any rally point or FOB start to burn after 20 minutes.
  - Flipped vehicles catch fire. A reset or recovery takes about 40 s (Beta 17), or about 5 s for a quick re-right.
  - Wrecks block roads until destroyed — [Wiki: Vehicles](https://squad.fandom.com/wiki/Vehicles)
- 10.4: AI bots no longer destroy abandoned enemy vehicles; they pop the tyres or tracks and leave the vehicle for players to repair — [Squad 10.4 patch notes (Steam)](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1831432155569227)
- Loadouts per layer and unit:
  - Since the 7.x voting system, factions are split into units: combined arms, air assault, armored, light infantry, mechanized, motorized, support and amphibious. Each has its own vehicle lineup and FOB emplacements — [Squad 7.2 release notes](https://www.joinsquad.com/updates/squad-7-2-release-notes)
  - Examples (8.0, Jun 2024): USA Mechanized fields M2A3 IFVs, M113A3 APCs and M1064A3 mortar carriers, and gets no FOB mortars. The USA Support unit gets 3 M939 logistics trucks, M1151s, M113A3s and M1064A3s, plus an extra HAB and ATGM per FOB — [Squad 8.0 release notes](https://www.joinsquad.com/updates/squad-8-0-release-notes)
  - 8.2 removed FOB mortars from WPMC and gave each battlegroup 2 mortar technicals — [Squad 8.2 release notes](https://www.joinsquad.com/updates/squad---v8-2-release-notes)
  - Layer-level examples from v6.0: RAAS v2 added one helicopter per team on a 10 min initial delay; RAAS v5 raised CAF Leopard 2A6M count from 1 to 2, on 15 min initial delays — [Squad v6.0 release notes (archived)](https://web.archive.org/web/20240111140016/https://joinsquad.com/2023/09/26/squad-update-6-0-release-notes/)
- 8.0 (Jun 2024): vehicle smoke launchers now break ATGM guidance; their burst distance went from 25 to 50 m — [Squad 8.0 release notes](https://www.joinsquad.com/updates/squad-8-0-release-notes)

### Inferences
- Pixel Ops: respawn timers differ.
  - Pixel Ops: truck 60 s, APC 90 s, helicopter 120 s.
  - Squad: truck about 3 min, APC about 10 min, IFV about 15 min, MBT 20 min, helicopter 5-10 min.
  - Relative to match length, Squad's heavy assets are scarcer, and losing one is a strategic event (10-15 tickets plus 10-20 min absent). A Pixel Ops adaptation could keep short truck timers but stretch APC and helicopter timers, or add an initial spawn delay before the first armour appears (Squad uses 10-20 min initial delays for tanks and helicopters).
- Pixel Ops: lacks claiming. A 1v1 game does not need anti-griefing claims. The useful parts are "a vehicle belongs to one squad, which must include a crew kit" and "abandoned vehicles far from friendly spawns burn after N minutes". The second would stop the CPU or the player from parking vehicles forever.
- Pixel Ops: repair — already have the engineer kit. Squad's component damage (tracks, engine, turret, ammo rack) and "field repair restores only part" would add depth: for example, a field repair caps at 25-50% and a full repair needs a repair station or FOB.

### Gaps
- No current (2024-2026) official description of claim rules, claim slots, claim timeouts or passive-claim expiry was found. The wiki's 2016 table may be outdated.
- No authoritative current per-class respawn table exists. Values differ by faction and unit, and wiki infoboxes conflict with wiki tables.
- The 20 min abandonment burn is undated on the wiki and was not confirmed in patch notes.

## 7. Weapon and combat ranges and AT lethality (for a top-down abstraction)

### Takeaway
Infantry fights in Squad run from tens to a few hundred metres. Grenade launchers reach 300-400 m, MGs are zeroed past 1 km, mortars reach about 1,250 m, and HAT rockets are usable to about 500 m. Damage figures: LAT HEAT rockets have about 960 base damage, HAT tandems 1,400, tanks 3,000 HP, an APC 1,250 HP and the BTR-82A 1,000 HP. Raw numbers imply about 1-2 LAT hits on a light APC or IFV and 3 or more tandem hits on a tank. Real results depend on penetration, angle and per-vehicle damage multipliers, and component kills (tracks, ammo rack) matter as much as HP.

### Cited Findings
- AT rocket statistics (wiki, date unclear):

  | Rocket | Damage type | Base damage | Max splash | Penetration | Arming distance |
  |---|---|---|---|---|---|
  | RPG-7 Tandem | Heavy Anti-Tank | 1,400 | 200 | 900 mm | 20 m |
  | RPG-7 HEAT | Light HEAT | 960 | 130 | 400 mm | 15 m |
  | RPG-7 HE | Fragmentation | 0 | 250 | 9 mm | — |
  | M72A7 LAW | Light HEAT | 960 | 100 | 300 mm | 15 m |
  | M3 MAAWS FFV751 Tandem | Heavy Anti-Tank | 1,400 | 200 | 900 mm | 20 m |
  | M3 MAAWS FFV551 HEAT | Light HEAT | 960 | 130 | 420 mm | 15 m |
  | RPG-29 | Heavy Anti-Tank | 1,400 | 200 | 900 mm | 20 m |

  Sources: [Wiki: RPG-7](https://squad.fandom.com/wiki/RPG-7); [Wiki: M72A7 LAW](https://squad.fandom.com/wiki/M72A7_LAW); [Wiki: M3 MAAWS](https://squad.fandom.com/wiki/M3_MAAWS); [Wiki: RPG-29](https://squad.fandom.com/wiki/RPG-29)
- LAT rockets do "High Explosive Anti-Tank type damage", while HAT rockets do "Heavy Anti-Tank type damage, which is calculated differently based on a vehicle's type and armor". Minimum arming distance is 15 m for LAT and 20 m for HAT. "Many vehicles require multiple hits". The advice is to disable tracks or wheels first — [Wiki: Light Anti-Tank](https://squad.fandom.com/wiki/Light_Anti-Tank); [Wiki: Heavy Anti-Tank](https://squad.fandom.com/wiki/Heavy_Anti-Tank)
- Vehicle HP: all tanks 3,000 HP, with tank APFSDS at 800 max damage; BTR-82A 1,000 HP (turret 300); M1126 1,250 HP — [Wiki: T-72B3](https://squad.fandom.com/wiki/T-72B3); [Wiki: BTR-82A](https://squad.fandom.com/wiki/BTR-82A); [Wiki: M1126](https://squad.fandom.com/wiki/M1126)
- 10.0 (Nov 2025): the RPG-7's UP7V iron sight can range tandem rounds out to 500 m — [Squad 10.0 patch notes](https://www.joinsquad.com/updates/squad-10-0-patch-notes)
- Community estimates of effective range: LAT about 200-300 m and HAT about 500-1,500 m. The guide also says LAT "can kill light vehicles in one hit"; it is unofficial and unversioned — [GuildOrder: Squad vehicle roles](https://guildorder.com/games/squad/wiki/vehicle-roles) (seen in search results)
- Grenadier HE is effective against infantry behind light cover out to about 400 m (300-400 m for a good grenadier). Five shells destroy a technical. UGL shells have 5-10 mm penetration and cannot damage most IFV hulls, but one hit deflates a tyre — [Wiki: Grenadier](https://squad.fandom.com/wiki/Grenadier)
- GPMG sights zero beyond a kilometre, for longer-range suppression — [Wiki: Machine Gunner](https://squad.fandom.com/wiki/Machine_Gunner)
- FOB mortars have about 1,250 m effective range. They damage armoured vehicles only on direct or very close (under 1.5 m) hits — [Wiki: Mortar](https://squad.fandom.com/wiki/Mortar)
- Commander artillery has a 16 m guaranteed-kill radius; the heavy mortar barrage 9.8 m — [Wiki: Commander](https://squad.fandom.com/wiki/Commander)
- Demolition charge: 5 m radius through walls. It does minimal HP damage to armour but is good for component damage; unarmoured vehicles and helicopters explode from one charge — [Wiki: Combat Engineer](https://squad.fandom.com/wiki/Combat_Engineer)
- Other reference distances:
  - Local-voice proximity dots show squadmates at 0-25 m (white) and 25-50 m (grey) — [Squad v6.0 release notes (archived)](https://web.archive.org/web/20240111140016/https://joinsquad.com/2023/09/26/squad-update-6-0-release-notes/)
  - Rally exclusion is 50 m from enemies and burn radius 30 m — [Wiki: Rally Point](https://squad.fandom.com/wiki/Rally_Point)
  - Suppression radius is 6-10 m (pre-10.5.2), about 3 m for full effect after 10.6 — [Wiki: Suppression](https://squad.fandom.com/wiki/Suppression); [Squad 10.6 release notes](https://www.joinsquad.com/updates/squad-10-6-release-notes)
- 8.0: vehicle smoke defeats ATGM guidance — [Squad 8.0 release notes](https://www.joinsquad.com/updates/squad-8-0-release-notes)

### Inferences
- Hit counts below assume a damage multiplier of 1 and full penetration:
  - MBT (3,000 HP): 3 tandem hits; a ratio of about 2.1 rounds up to 3.
  - M1126 APC (1,250 HP): 2 LAT HEAT hits.
  - BTR-82A (1,000 HP): 1-2 LAT HEAT hits, about 1.04.

  These are my calculations, not published "hits to kill". Treat them as rough guides, because Squad applies per-vehicle damage-type multipliers and armour zones.
- Pixel Ops: differs. Its APC (600 HP, five rocket hits) is tougher in hit count than Squad's light armour (about 1-2 LAT hits). To match Squad's feel, use fewer, higher-damage AT hits with directional armour (rear and side shots count more) and a mobility kill on the first hit.
- For a top-down map, scale distances proportionally. Squad's typical infantry fight is about 50-300 m and AT about 50-500 m, with a 15-20 m minimum arming distance. Pixel Ops' 150 m autocannon is short compared with Squad's IFVs, which engage out to several hundred metres; vehicle gun ranges are not documented in the sources read.

### Gaps
- No official or community "hits to kill" table per vehicle class for 2025-2026 was found, and the per-vehicle damage multipliers for Light HEAT and Heavy AT are not on the pages read.
- No authoritative statistic on typical infantry engagement distance was found. The ranges above are weapon capabilities and community guidance, not telemetry.
- IFV autocannon damage and effective ranges were not collected.
