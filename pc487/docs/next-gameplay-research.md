# PC487 Next Gameplay Research

## Practical Direction

The next slice should teach one readable loop at a time:

- A silly charging enemy asks the player to notice a wind-up, move sideways, and punish the recovery.
- Rocks should be a low-risk ranged tool: gather a few near boulders, throw one, get instant hit feedback.
- Early vertical traversal should use obvious geometry: ramps, short ledges, and clear chasm edges before adding precise jumping.

## Useful References

- The Level Design Book, enemy design: enemy types need readable silhouette, behavior, health, speed, damage, and range.
- Game Developer, "Enemy Attacks and Telegraphing": attacks should include a clear pre-attack warning so damage feels fair.
- The Level Design Book, combat: PvE combat should create delayed but reliable player victory, using mechanics like territory control, timing, traps, and weak points.
- The Level Design Book, verticality: up/down movement gives players a strong sense of progression and orientation.
- Game Developer, "Traversal Level Design Principles": traversal works best when layouts create readable movement goals and recovery space.

## Prototype Targets

1. Add a "mud zombie" that charges in an exaggerated stop-start pattern.
2. Make successful hits audible even when the NPC survives.
3. Add throwable rocks as a projectile weapon with limited ammo.
4. Let boulders refill rock ammo when the player is close.
5. Add a small height/chasm greybox area that tests movement readability before committing to full platforming.
