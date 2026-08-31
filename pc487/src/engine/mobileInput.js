const JOYSTICK_RADIUS = 52;

const joystick = {
    initialized: false,
    active: false,
    pointerId: null,
    centerX: 0,
    centerY: 0,
    forward: 0,
    right: 0,
    base: null,
    stick: null,
};

export function getMobileMoveInput() {
    initializeMobileInput();

    return {
        forward: joystick.forward,
        right: joystick.right,
    };
}

export function resetMobileMoveInput() {
    initializeMobileInput();
    resetJoystick();
}

function initializeMobileInput() {
    if (joystick.initialized) {
        return;
    }

    joystick.initialized = true;
    joystick.base = document.querySelector("#move-joystick");
    joystick.stick = document.querySelector("#move-stick");

    if (!joystick.base) {
        return;
    }

    joystick.base.classList.add("joystick-resting");
    joystick.base.addEventListener("pointerdown", onJoystickDown);
    joystick.base.addEventListener("pointermove", onJoystickMove);
    joystick.base.addEventListener("pointerup", onJoystickEnd);
    joystick.base.addEventListener("pointercancel", onJoystickEnd);
    joystick.base.addEventListener("lostpointercapture", resetJoystick);
}

function onJoystickDown(event) {
    const bounds = joystick.base.getBoundingClientRect();
    joystick.active = true;
    joystick.pointerId = event.pointerId;
    joystick.centerX = bounds.left + bounds.width / 2;
    joystick.centerY = bounds.top + bounds.height / 2;
    joystick.base.classList.remove("joystick-resting");
    joystick.base.setPointerCapture(event.pointerId);
    updateJoystick(event);
    event.preventDefault();
}

function onJoystickMove(event) {
    if (!joystick.active || event.pointerId !== joystick.pointerId) {
        return;
    }

    updateJoystick(event);
    event.preventDefault();
}

function onJoystickEnd(event) {
    if (event.pointerId !== joystick.pointerId) {
        return;
    }

    resetJoystick();
    event.preventDefault();
}

function updateJoystick(event) {
    const rawX = event.clientX - joystick.centerX;
    const rawY = event.clientY - joystick.centerY;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;

    joystick.right = clamp(x / JOYSTICK_RADIUS, -1, 1);
    joystick.forward = clamp(-y / JOYSTICK_RADIUS, -1, 1);

    if (joystick.stick) {
        joystick.stick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    }
}

function resetJoystick() {
    joystick.active = false;
    joystick.pointerId = null;
    joystick.forward = 0;
    joystick.right = 0;

    if (joystick.base) {
        joystick.base.classList.add("joystick-resting");
    }

    if (joystick.stick) {
        joystick.stick.style.transform = "translate(-50%, -50%)";
    }
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
