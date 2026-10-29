// Peninsula's landmarks as code models in the units' DSL (core/models.js), so core/voxexport.js can voxelise them to
// models/vox/<name>.vox and gl/voxmodels.js can stand them in the map as static props (a `vox` prop in gl/world.js, with
// the map's old boxes as its fallback when the file is missing or ?vox=0). Built from the user's references (tools/make-refs.mjs:
// lighthouse, radarStation, harbourShed, fishingBoat, assaultShip). A builder returns { group, parts, height, radius, variants }
// like a unit's: `parts` names the groups that become models of their own, which keeps every model under the .vox format's
// 255 voxels a side, and `variants` lists palette recolours by material name (the sheds' and boats' colours).
// Voxel lesson: a tall tapered round shape sparkles under a high sun, because every ring of its taper is a ledge facing up;
// straight octagons (8-segment cylinders) step at 45 degrees, which reads as a clean staircase instead.
export function makeLandmarks(F) {
  const group = F.group, box = F.box, mesh = F.mesh;
  const TAU = Math.PI * 2;
  // an octagonal ring of n short rail segments at radius r (a railing's top rail, a kerb), and n posts
  const rail = (n, r, y, len, h, t, m, parent) => { for (let i = 0; i < n; i++) { const a = (i + 0.5) * TAU / n, b = box(len, h, t, m, Math.cos(a) * r, y, Math.sin(a) * r, parent); b.rotation.y = -a; } };
  const posts = (n, r, y, h, t, m, parent) => { for (let i = 0; i < n; i++) { const a = i * TAU / n; box(t, h, t, m, Math.cos(a) * r, y, Math.sin(a) * r, parent); } };
  // a sphere of radius R centred at (x, cy, z) as stacked 16-sided slices (a radome, a dome)
  const ball = (R, x, cy, z, m, parent, step = 0.4, from = -1, to = 1) => { for (let y = cy + R * from + step / 2; y < cy + R * to; y += step) { const r = Math.sqrt(Math.max(0, R * R - (y - cy) * (y - cy))); if (r > 0.2) mesh(`cyl:${r.toFixed(2)},${r.toFixed(2)},${step},16`, m, x, y, z, parent); } };

  // ---- the lighthouse (reference: an octagonal white tower to a railed gallery, two red bands, a glazed lantern under a
  // red pyramid cap, on a stone plinth). The lantern is open framing: the map's lit lamp head (an emissive cylinder that
  // comes on at night) and its turning beam stand inside it, as before.
  function lighthouse() {
    const g = group();
    mesh('cyl:4.4,4.4,0.5,8', 'stone2', 0, 0.25, 0, g); mesh('cyl:4.0,4.0,0.6,8', 'stone', 0, 0.8, 0, g);              // plinth: a wider footing, the block
    mesh('cyl:2.7,2.7,1.0,8', 'lhWhite', 0, 1.6, 0, g);                                                                   // a wider base course
    mesh('cyl:2.4,2.4,13.0,8', 'lhWhite', 0, 8.6, 0, g);                                                                  // the tower, straight-sided
    box(1.1, 2.0, 0.4, 'lhIron', 0, 2.1, -2.55, g);                                                                       // the door, on the south face
    for (const y of [5.4, 9.3]) mesh('cyl:2.6,2.6,1.3,8', 'lhRed', 0, y, 0, g);                                            // two red bands, one voxel proud
    for (const y of [4.0, 7.4, 11.6]) box(0.6, 0.9, 0.3, 'lhIron', 0, y, -2.35, g);                                       // small windows up the south face
    mesh('cyl:3.1,3.1,0.6,8', 'lhWhite', 0, 14.9, 0, g);                                                                  // the corbel the gallery stands on
    mesh('cyl:3.2,3.2,0.3,8', 'lhIron', 0, 15.35, 0, g);                                                                   // the gallery deck
    posts(16, 3.0, 16.1, 1.1, 0.2, 'lhIron', g); rail(8, 3.0, 16.65, 2.4, 0.2, 0.2, 'lhIron', g);                        // railing posts and top rail
    mesh('cyl:1.9,1.9,0.3,8', 'lhIron', 0, 15.65, 0, g);                                                                   // the lantern floor
    posts(8, 1.8, 16.8, 2.2, 0.2, 'lhIron', g);                                                                           // the lantern's corner mullions (the glazing is left open for the lamp)
    mesh('cyl:2.3,2.3,0.3,8', 'lhIron', 0, 18.05, 0, g);                                                                   // the lantern roof plate
    const cap = mesh('frustum:4.0,4.0,2.0,0.6,0.6', 'lhRed', 0, 19.2, 0, g); cap.rotation.x = Math.PI / 2;                 // the pyramid cap: its wide face down
    box(0.3, 0.9, 0.3, 'lhIron', 0, 20.6, 0, g);                                                                          // finial
    return { group: g, parts: {}, height: 21, radius: 4 };
  }

  // ---- Radar Hill's station (reference: a white radome on a square concrete blockhouse with a steel door). The lattice mast
  // beside it stays the map's own.
  function radar() {
    const g = group();
    box(7.6, 0.4, 7.6, 'concrete2', 0, 0.2, 0, g); box(7, 5, 7, 'concrete', 0, 2.9, 0, g);                                // plinth course, the blockhouse
    box(1.2, 2.2, 0.2, 'steelDoor', 0, 1.5, -3.55, g); box(1.5, 0.2, 0.3, 'steelDoor', 0, 2.7, -3.6, g);                 // the door and its lintel, south face
    for (const s of [-1, 1]) box(0.9, 0.5, 0.2, 'steelDoor', s * 2.4, 4.4, -3.55, g);                                      // vents
    box(0.6, 0.6, 0.6, 'steelDoor', 2.6, 5.7, 2.4, g); box(0.25, 2.5, 0.25, 'lhIron', -2.8, 6.6, -2.6, g);               // a cowl, an aerial
    mesh('cyl:3.7,3.7,0.5,16', 'steelDoor', 0, 5.65, 0, g); mesh('cyl:3.3,3.3,0.5,16', 'islandDark', 0, 6.15, 0, g);     // the radome's drum
    ball(3.5, 0, 9.9, 0, 'domeWhite', g, 0.4, -1, 1);                                                                     // the radome
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6, r = box(0.25, 0.25, 0.25, 'domeRib', Math.cos(a) * 3.55, 9.9, Math.sin(a) * 3.55, g); }   // panel joints at the equator
    box(0.3, 0.3, 0.3, 'lhRed', 0, 13.55, 0, g);                                                                          // the warning light
    return { group: g, parts: {}, height: 14, radius: 5 };
  }

  // ---- a harbour shed (reference: corrugated walls streaked with rust, a pitched roof with three skylights, big double
  // doors on the gable end to the quay, a bollard and a crate outside). 24 m along x, 16 m across; the doors face -x.
  function shed() {
    const g = group(), W = 24, D = 16, H = 6.5, RH = 3.2;
    box(W, H, D, 'shedWall', 0, H / 2, 0, g);
    for (let x = -W / 2 + 0.6; x < W / 2; x += 1.2) for (const s of [-1, 1]) box(0.3, H - 0.3, 0.1, 'shedRoof2', x, H / 2, s * (D / 2 + 0.03), g);     // corrugation ribs on the long faces
    for (let z = -D / 2 + 0.6; z < D / 2; z += 1.2) box(0.1, H - 0.3, 0.3, 'shedRoof2', W / 2 + 0.03, H / 2, z, g);                               // and the back gable
    for (const [x, z, h] of [[-6, 1, 3.5], [3, 1, 2.2], [8, -1, 4.0], [-9, -1, 2.8], [11, 1, 1.6]]) box(0.45, h, 0.06, 'shedRust', x, H - h / 2 - 0.2, z * (D / 2 + 0.08), g);   // rust streaks
    const roof = mesh(`wedge:${W + 0.8},${RH},${D + 0.8},${(D + 0.8) / 2},${(D + 0.8) / 2}`, 'shedRoof', 0, H + RH / 2, 0, g);                  // the pitched roof, ridge along x
    box(W + 1.0, 0.25, 0.5, 'shedRoof2', 0, H + RH + 0.05, 0, g);                                                                                 // ridge capping
    for (const [x, z] of [[-5, 3.5], [1, -3.5], [8, 3.5]]) box(1.0, 0.3, 0.8, 'shedRust', x, H + RH * (1 - Math.abs(z) / (D / 2 + 0.4)) + 0.1, z, g);   // rust patches on the slopes
    const pitch = Math.atan2(RH, (D + 0.8) / 2);
    for (const x of [-6, 0, 6]) { const s = mesh('box:2.6,0.14,2.2', 'skylight', x, H + RH * (1 - 4.0 / ((D + 0.8) / 2)) + 0.12, 4.0, g); s.rotation.x = pitch; }   // three skylights on the +z slope
    for (const s of [-1, 1]) box(3.2, 4.8, 0.2, 'shedDoor', -W / 2 - 0.08, 2.4, s * 1.7, g);                                                       // the sliding doors
    box(7.6, 0.3, 0.3, 'lhIron', -W / 2 - 0.15, 5.1, 0, g); box(0.3, 4.8, 0.3, 'lhIron', -W / 2 - 0.1, 2.4, 0, g);                                // door rail, the centre stop
    mesh('cyl:0.35,0.35,1.0,8', 'lhIron', -W / 2 - 2.0, 0.5, -5, g); box(1.6, 1.4, 1.6, 'wood', -W / 2 - 2.2, 0.7, 5, g);                        // a bollard and a crate by the doors
    return { group: g, parts: {}, height: H + RH + 0.3, radius: 14, variants: [{ shedWall: 0x8c6f5a }, { shedWall: 0x77807a }] };
  }

  // ---- a fishing boat (reference: a red wooden hull with a pointed bow, a white wheelhouse aft, a mast with a boom and
  // nets). 11 m, bow to +z, the waterline at y 0.
  function boat() {
    const g = group();
    box(3.4, 1.6, 5.6, 'boatHull', 0, -0.2, -2.7, g); mesh('frustum:0.9,1.5,5.4,3.4,1.6', 'boatHull', 0, -0.15, 2.8, g);     // the aft hull, the bow tapering to a stem
    box(0.5, 0.6, 0.5, 'boatHull', 0, 0.8, 5.3, g);                                                                      // the stem post, a little higher
    for (const s of [-1, 1]) box(0.2, 0.25, 5.6, 'wood', s * 1.6, 0.72, -2.7, g);                                         // gunwales aft
    box(3.0, 0.12, 5.6, 'boatDeck', 0, 0.56, -2.7, g); mesh('frustum:0.6,0.12,5.2,3.0,0.12', 'boatDeck', 0, 0.56, 2.7, g);   // deck planking, tapering with the bow
    box(2.2, 2.0, 2.6, 'boatHouse', 0, 1.6, -2.2, g); box(2.5, 0.16, 2.9, 'lhIron', 0, 2.66, -2.2, g);                    // the wheelhouse and its roof
    box(1.6, 0.6, 0.1, 'glass', 0, 1.9, -0.86, g); for (const s of [-1, 1]) box(0.1, 0.5, 0.7, 'glass', s * 1.11, 1.9, -2.2, g);   // windows
    box(0.16, 5.6, 0.16, 'mast', 0.5, 3.4, 1.4, g); box(0.12, 0.12, 3.2, 'mast', 0.5, 4.2, 2.9, g);                       // mast and boom
    box(0.12, 3.0, 0.12, 'mast', -0.9, 2.1, -4.3, g);                                                                     // a stern post
    box(0.9, 1.5, 0.5, 'netGrey', 1.1, 2.6, 2.6, g); box(0.7, 1.1, 0.4, 'netGrey', -0.9, 1.9, -3.6, g);                   // nets hung to dry
    box(0.4, 0.4, 0.4, 'lhIron', -1.3, 0.9, -4.6, g);                                                                    // a bitt
    return { group: g, parts: {}, height: 6.2, radius: 5.5, variants: [{ boatHull: 0x2f5f8a }, { boatHull: 0x3f6a46 }, { boatHull: 0xc9a23a }] };
  }

  // ---- the assault ship (reference: an LHD, a long flat flight deck with landing spots, the island with its bridge, mast
  // and funnel on the starboard side, an open well dock at the stern). 150 m, bow to +z, starboard to -x (east on the map),
  // the waterline at y -3 and the flight deck's top at 7.6 as the map's deck bridge expects. Three hull sections and the island
  // are parts of their own, each under 255 voxels at 0.25 m.
  function ship() {
    const g = group(), B = 28, parts = {};
    const section = (name, z0, z1) => { const s = group(); g.add(s); parts[name] = s; const L = z1 - z0, zc = (z0 + z1) / 2; return { s, L, zc }; };
    const hull = (s, L, zc, lower = true) => {
      if (lower) box(B - 4, 7, L, 'shipDark', 0, -4.5, zc, s);                                                            // the lower hull, -8 to -1
      box(B, 8, L, 'shipGrey', 0, 3, zc, s);                                                                              // the upper hull, -1 to 7
      box(B + 2, 0.6, L, 'shipDeck', 0, 7.3, zc, s);                                                                      // the flight deck, 7 to 7.6, overhanging
      for (const k of [-1, 1]) box(0.5, 0.5, L, 'islandDark', k * (B / 2 + 0.75), 7.85, zc, s);                           // deck-edge coaming
      for (let z = zc - L / 2 + 4.5; z < zc + L / 2; z += 9) box(0.5, 0.1, 5, 'deckLine', 0, 7.65, z, s);                 // the centre line
    };
    const spot = (s, z) => { mesh('cyl:4.2,4.2,0.1,16', 'spotYellow', 7, 7.65, z, s); mesh('cyl:3.4,3.4,0.1,16', 'shipDeck', 7, 7.65, z, s); box(0.5, 0.1, 3, 'deckLine', 7, 7.66, z, s); };   // a landing spot: a yellow ring, a bar
    // bow section: hull to z 70, then the bow tapering to a stem
    { const { s, L, zc } = section('bow', 25, 70); hull(s, L, zc);
      mesh('frustum:5,7,12,24,7', 'shipDark', 0, -4.5, 76, s); mesh('frustum:7,8,12,28,8', 'shipGrey', 0, 3, 76, s); mesh('frustum:10,0.6,12,30,0.6', 'shipDeck', 0, 7.3, 76, s);
      for (const k of [-1, 1]) box(0.5, 0.5, 12, 'islandDark', k * 7, 7.85, 76, s);
      spot(s, 40); box(2.5, 1.2, 2.5, 'islandDark', -9, 8.2, 66, s); box(0.3, 3, 0.3, 'islandDark', 0, 9.1, 80, s);        // a deck tractor, the jackstaff
      box(0.6, 0.6, 0.6, 'navRed', 14.3, 6.5, 55, s); box(0.6, 0.6, 0.6, 'navGreen', -14.3, 6.5, 55, s); }                // sidelights: red to port, green to starboard
    // midships: two spots, the island's footprint
    { const { s, L, zc } = section('mid', -30, 25); hull(s, L, zc); spot(s, 10); spot(s, -20);
      for (const z of [-24, -10, 4, 18]) box(2.4, 1.6, 3, 'shipGrey', 15, 5.8, z, s);                                      // sponsons along the port side
      for (const z of [-20, 0, 20]) box(2.6, 1.4, 4.6, 'islandDark', -15.5, 4.6, z, s); }                                   // boat davits to starboard
    // stern: the well dock, 16 m wide between the hull's side walls, its floor on the sea, open aft; its stern gate lowered as a ramp
    { const { s, L, zc } = section('stern', -80, -30);
      box(B - 4, 2, L, 'shipDark', 0, -7, zc, s);                                                                           // the floor, -8 to -6
      for (const k of [-1, 1]) { box(4, 5, L, 'shipDark', k * 10, -3.5, zc, s); box(6, 8, L, 'shipGrey', k * 11, 3, zc, s); }   // the side walls: lower hull, upper hull
      box(16, 1, 20, 'dockFloor', 0, -5.5, -70, s);                                                                        // the dock's wet deck, aft
      box(16, 11, 1.5, 'gateDark', 0, -0.5, -55, s);                                                                        // the bulkhead the dock ends at
      box(B, 2, L, 'shipGrey', 0, 6, zc, s); box(B + 2, 0.6, L, 'shipDeck', 0, 7.3, zc, s);                                  // the dock's roof, the deck over it
      for (const k of [-1, 1]) box(0.5, 0.5, L, 'islandDark', k * (B / 2 + 0.75), 7.85, zc, s);
      for (let z = zc - L / 2 + 4.5; z < zc + L / 2; z += 9) box(0.5, 0.1, 5, 'deckLine', 0, 7.65, z, s);
      spot(s, -50); box(4, 0.8, 6, 'islandDark', -9, 8.0, -62, s);                                                         // the aft spot, a crash crane base
      box(16, 0.5, 9, 'shipDark', 0, -2.9, -84.5, s);                                                                       // the stern gate, lowered to a ramp at the waterline
      box(B - 2, 1.6, 0.6, 'shipGrey', 0, 6.2, -80.2, s); }                                                                 // the transom's lip over the dock mouth
    // the island, starboard of the centre line: the superstructure, the bridge, the mast, the funnel, radars
    { const s = group(); g.add(s); parts.island = s; const X = -11;
      box(6, 12, 34, 'island', X, 13.6, 8, s); box(6.4, 1.6, 12, 'glass', X, 20.4, 12, s); box(5, 2.4, 10, 'island', X, 22.4, 12, s);   // the block, the bridge windows, the bridge roof
      box(1.2, 0.5, 2.4, 'islandDark', X - 3.6, 20.2, 12, s); box(1.2, 0.5, 2.4, 'islandDark', X + 3.6, 20.2, 12, s);          // bridge wings
      box(0.6, 11, 0.6, 'islandDark', X, 29.1, 12, s); box(3.2, 0.5, 0.8, 'islandDark', X, 31.2, 12, s); box(2.0, 0.4, 0.5, 'islandDark', X, 33.6, 12, s);   // the mast and its radar arrays
      box(2.6, 4.4, 4.4, 'funnel', X, 21.8, -4, s); box(2.0, 0.8, 3.8, 'lhIron', X, 24.4, -4, s);                              // the funnel, its black top
      ball(1.5, X, 25.0, 20, 'domeWhite', s, 0.3, -0.6, 1); box(0.4, 3, 0.4, 'islandDark', X - 1.6, 21.3, -12, s);            // a satellite dome, an aerial
      for (const z of [-4, 2, 20]) box(6.4, 0.9, 0.2, 'islandDark', X, 16.3, z, s);                                            // walkway rails on the island's side
      for (let z = -6; z <= 22; z += 4) box(0.2, 0.8, 1.2, 'glass', X - 3.05, 11.5, z, s); }                                  // portholes down the island
    return { group: g, parts, height: 35, radius: 80 };
  }

  return { lighthouse, radar, shed, boat, ship };
}
