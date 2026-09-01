const HIT_RADIUS = 4.1;
const MIN_DAMAGE_SPEED = 5;
const MAX_DAMAGE_SPEED = 24;
const MIN_DAMAGE = 12;
const MAX_DAMAGE = 110;
const HIT_COOLDOWN_SECONDS = 0.75;
const MIN_IMPULSE = 10;
const MAX_IMPULSE = 34;

export function createVehicleImpactSystem({ scene, vehicleController, npcSystem, audioSystem, onPromptChange }) {
    const hitTimers = new WeakMap();

    const observer = scene.onBeforeRenderObservable.add(() => {
        const deltaSeconds = scene.getEngine().getDeltaTime() / 1000;
        updateVehicleImpacts({
            vehicleController,
            npcSystem,
            audioSystem,
            hitTimers,
            onPromptChange,
            deltaSeconds,
        });
    });

    return {
        dispose() {
            scene.onBeforeRenderObservable.remove(observer);
        },
    };
}

function updateVehicleImpacts({ vehicleController, npcSystem, audioSystem, hitTimers, onPromptChange, deltaSeconds }) {
    const vehicleSpeed = Math.abs(vehicleController.speed);

    if (!vehicleController.active || vehicleSpeed < MIN_DAMAGE_SPEED) {
        tickHitTimers(npcSystem.npcs, hitTimers, deltaSeconds);
        return;
    }

    for (const npc of npcSystem.npcs) {
        if (npc.ridden) {
            continue;
        }

        const cooldown = hitTimers.get(npc) ?? 0;

        if (cooldown > 0) {
            hitTimers.set(npc, Math.max(0, cooldown - deltaSeconds));
            continue;
        }

        const distance = BABYLON.Vector3.Distance(vehicleController.mesh.position, npc.proxy.position);

        if (distance > HIT_RADIUS) {
            continue;
        }

        const impulse = calculateImpactImpulse(vehicleController, npc, vehicleSpeed);
        const result = npc.defeated
            ? { health: 0, defeated: true }
            : npcSystem.damageNpc(npc, calculateImpactDamage(vehicleSpeed));

        audioSystem.playVehicleNpcHit();
        npcSystem.applyImpulseToNpc(npc, impulse);
        hitTimers.set(npc, HIT_COOLDOWN_SECONDS);
        onPromptChange(result.defeated ? "Vehicle impact: NPC down" : `Vehicle impact: ${result.health} HP`, { holdMs: 900 });
        vehicleController.applyImpactSlowdown(0.72);
    }
}

function tickHitTimers(npcs, hitTimers, deltaSeconds) {
    for (const npc of npcs) {
        const cooldown = hitTimers.get(npc) ?? 0;

        if (cooldown > 0) {
            hitTimers.set(npc, Math.max(0, cooldown - deltaSeconds));
        }
    }
}

function calculateImpactDamage(speed) {
    const speedRatio = clamp((speed - MIN_DAMAGE_SPEED) / (MAX_DAMAGE_SPEED - MIN_DAMAGE_SPEED), 0, 1);
    return Math.round(MIN_DAMAGE + (MAX_DAMAGE - MIN_DAMAGE) * speedRatio);
}

function calculateImpactImpulse(vehicleController, npc, speed) {
    const speedRatio = clamp((speed - MIN_DAMAGE_SPEED) / (MAX_DAMAGE_SPEED - MIN_DAMAGE_SPEED), 0, 1);
    const impulseAmount = MIN_IMPULSE + (MAX_IMPULSE - MIN_IMPULSE) * speedRatio;
    const forward = vehicleController.forward;
    const away = npc.proxy.position.subtract(vehicleController.mesh.position);
    away.y = 0;

    if (away.lengthSquared() > 0.001) {
        away.normalize();
    } else {
        away.copyFrom(forward);
    }

    const travelDirection = vehicleController.speed < 0 ? forward.scale(-1) : forward;
    const shoveDirection = travelDirection.scale(0.9).add(away.scale(0.1));
    shoveDirection.normalize();
    return shoveDirection.scale(impulseAmount);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
