# PC487 Progression Plan

## Core Arc

PC487 should move toward a Zelda-like progression structure inside the existing sandbox.
The player begins underpowered in the Santa Ana River forest with few resources, then
earns access to the broader overworld by surviving, learning local rules, and passing
through a drainage tunnel.

The progression should feel authored without removing sandbox freedom. The player can
still explore, fight, flee, and use vehicles, but the early forest acts as a contained
first region that teaches survival, combat, interaction, and traversal.

## Opening Region: Santa Ana River Forest

The game starts in a dense river-bottom forest inspired by the Santa Ana River corridor.
The player has minimal equipment and limited safety. The area should feel overgrown,
informal, and hard to navigate, with narrow paths, tree cover, drainage infrastructure,
and small clearings.

Early resources:

- Basic movement and camera control.
- A weak starter weapon or improvised tool.
- Scarce pickups.
- Limited visibility and simple landmark navigation.

Threats:

- Mean forest dwellers who patrol or wander.
- Small ambush spaces near paths and clearings.
- Environmental pressure from low supplies and confusing terrain.

## Friendly Forest Dweller

One forest dweller should be non-hostile and act as the first quest giver. This NPC
does not need to over-explain the world. They should point the player toward a sage-like
figure who is rumored to live in a drainage tunnel.

Quest direction:

- Find the friendly forest dweller.
- Learn that someone deeper in the drainage system may know a way out.
- Follow visual clues toward the drainage tunnel entrance.

The friendly NPC should communicate the goal in grounded language, not fantasy language,
even if the structure is Zelda-like.

## Drainage Tunnel Sage

The sage probably lives in or near a drainage tunnel. This character should feel strange
and memorable, but still fit the local infrastructure setting.

The sage gives the player a substance that triggers a vision. The vision is not just a
cutscene; it should become a playable or semi-playable sequence if possible.

Vision concept:

- The player sees concrete being poured.
- The environment becomes simplified, symbolic, or dreamlike.
- The concrete vision foreshadows construction, flood control, channels, roads, and the
  built overworld beyond the forest.
- The vision can teach a mechanic or reveal the tunnel route forward.

## Tunnel To Overworld

After the vision, the player continues through the drainage tunnel. This tunnel is the
first major gate between regions.

Tunnel goals:

- Provide a linear transition after the more open forest.
- Build tension through darkness, echoing sound, water stains, debris, and narrow turns.
- End with a reveal into the overworld.

The exit should open into the larger sandbox, making the world feel bigger than the
starting forest. The player should emerge with a stronger sense of direction and a new
reason to explore.

## Implementation Notes

- Treat this as the first authored progression chain, not the whole game.
- Keep the forest, tunnel, sage, and overworld as separate scene regions or world zones.
- Use trigger volumes for quest stages and region transitions.
- The early player state should be intentionally resource-poor.
- The vision sequence can start as a color/filter/camera/audio shift before becoming a
  full custom gameplay segment.
- The overworld reveal should preserve the existing sandbox systems: vehicles, NPCs,
  items, combat, and mobile controls.

## First Quest Chain

1. Start in the Santa Ana River forest.
2. Survive hostile forest dwellers.
3. Find a friendly forest dweller.
4. Receive a clue about the tunnel sage.
5. Locate the drainage tunnel.
6. Meet the sage.
7. Receive the vision-inducing substance.
8. Experience the concrete-pouring vision.
9. Continue through the drainage tunnel.
10. Exit into the overworld.
