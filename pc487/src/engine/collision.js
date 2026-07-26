export function createCollisionWorld(blockers) {
    const bounds = blockers.map((blocker) => ({
        minX: blocker.position.x - blocker.size.width / 2,
        maxX: blocker.position.x + blocker.size.width / 2,
        minZ: blocker.position.z - blocker.size.depth / 2,
        maxZ: blocker.position.z + blocker.size.depth / 2,
    }));

    return {
        resolveCircleMovement(position, previousPosition, radius) {
            const resolved = position.clone();

            for (const bound of bounds) {
                if (!circleIntersectsBox(resolved, radius, bound)) {
                    continue;
                }

                if (!circleIntersectsBox(new BABYLON.Vector3(resolved.x, 0, previousPosition.z), radius, bound)) {
                    resolved.z = previousPosition.z;
                } else if (!circleIntersectsBox(new BABYLON.Vector3(previousPosition.x, 0, resolved.z), radius, bound)) {
                    resolved.x = previousPosition.x;
                } else {
                    const push = getSmallestPush(resolved, radius, bound);
                    resolved.x += push.x;
                    resolved.z += push.z;
                }
            }

            return resolved;
        },
    };
}

function circleIntersectsBox(position, radius, bound) {
    const closestX = clamp(position.x, bound.minX, bound.maxX);
    const closestZ = clamp(position.z, bound.minZ, bound.maxZ);
    const distanceX = position.x - closestX;
    const distanceZ = position.z - closestZ;

    return distanceX * distanceX + distanceZ * distanceZ < radius * radius;
}

function getSmallestPush(position, radius, bound) {
    const leftPush = bound.minX - (position.x + radius);
    const rightPush = bound.maxX - (position.x - radius);
    const bottomPush = bound.minZ - (position.z + radius);
    const topPush = bound.maxZ - (position.z - radius);

    const pushes = [
        { x: leftPush, z: 0, amount: Math.abs(leftPush) },
        { x: rightPush, z: 0, amount: Math.abs(rightPush) },
        { x: 0, z: bottomPush, amount: Math.abs(bottomPush) },
        { x: 0, z: topPush, amount: Math.abs(topPush) },
    ];

    pushes.sort((a, b) => a.amount - b.amount);
    return pushes[0];
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
