import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chromePath = process.env.CHROME_PATH ?? "/usr/bin/google-chrome-stable";
const port = Number(process.env.CHROME_DEBUG_PORT ?? 9223);
const url = process.env.PC487_URL ?? "http://127.0.0.1:5173/pc487/?smoke=1";
const userDataDir = await mkdtemp(join(tmpdir(), "pc487-chrome-"));
const failures = [];

const chrome = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--no-first-run",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--window-size=1280,800",
    url,
], {
    stdio: ["ignore", "pipe", "pipe"],
});

chrome.stderr.setEncoding("utf8");
chrome.stderr.on("data", (chunk) => {
    if (chunk.includes("DevTools listening")) {
        process.stderr.write(chunk);
    }
});

try {
    const wsUrl = await waitForPageTarget(port);
    const cdp = await connect(wsUrl);

    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");

    cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
        failures.push(`Exception: ${exceptionDetails.text}`);
    });
    cdp.on("Runtime.consoleAPICalled", ({ type, args }) => {
        if (type !== "error") {
            return;
        }

        failures.push(`Console error: ${args.map(formatRemoteValue).join(" ")}`);
    });

    await waitForExpression(cdp, "window.__pc487?.testControls && window.__pc487.scene?.isReady()", 15000);
    await cdp.send("Runtime.evaluate", {
        expression: `
            window.__pc487.testControls.grantPistol();
            window.__pc487.testControls.enterVehicle();
            window.__pc487.__shotsBefore = window.__pc487.testControls.shotsFired;
            document.querySelector("#render-canvas").dispatchEvent(new PointerEvent("pointerdown", {
                button: 0,
                bubbles: true,
                cancelable: true,
                pointerType: "mouse",
                clientX: 640,
                clientY: 400,
            }));
        `,
    });
    await waitForExpression(
        cdp,
        "window.__pc487.testControls.shotsFired > window.__pc487.__shotsBefore",
        3000,
    );

    await cdp.send("Runtime.evaluate", {
        expression: `
            await new Promise((resolve) => setTimeout(resolve, 350));
            window.__pc487.__shotsBefore = window.__pc487.testControls.shotsFired;
            document.querySelector("#mobile-shoot").dispatchEvent(new PointerEvent("pointerdown", {
                button: 0,
                bubbles: true,
                cancelable: true,
                pointerType: "touch",
            }));
        `,
        awaitPromise: true,
    });
    await waitForExpression(
        cdp,
        "window.__pc487.testControls.shotsFired > window.__pc487.__shotsBefore",
        3000,
    );

    if (failures.length > 0) {
        throw new Error(failures.join("\n"));
    }

    console.log("PC487 smoke passed: loaded, entered vehicle, fired pistol, no uncaught browser errors.");
} finally {
    chrome.kill("SIGTERM");
}

async function waitForPageTarget(debugPort) {
    const endpoint = `http://127.0.0.1:${debugPort}/json/list`;
    const deadline = Date.now() + 10000;

    while (Date.now() < deadline) {
        try {
            const response = await fetch(endpoint);
            if (response.ok) {
                const data = await response.json();
                const page = data.find((target) => target.type === "page" && target.url.includes("/pc487/"));

                if (page) {
                    return page.webSocketDebuggerUrl;
                }
            }
        } catch {
            // Chrome is still starting.
        }

        await delay(100);
    }

    throw new Error(`Timed out waiting for PC487 page target on port ${debugPort}`);
}

function connect(wsUrl) {
    const socket = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    const listeners = new Map();

    socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);

        if (message.id && pending.has(message.id)) {
            const { resolve, reject } = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) {
                reject(new Error(message.error.message));
            } else {
                resolve(message.result);
            }
            return;
        }

        const callbacks = listeners.get(message.method) ?? [];
        for (const callback of callbacks) {
            callback(message.params ?? {});
        }
    });

    return new Promise((resolve, reject) => {
        socket.addEventListener("open", () => {
            resolve({
                send(method, params = {}) {
                    const id = nextId++;
                    socket.send(JSON.stringify({ id, method, params }));
                    return new Promise((sendResolve, sendReject) => {
                        pending.set(id, { resolve: sendResolve, reject: sendReject });
                    });
                },
                on(method, callback) {
                    listeners.set(method, [...(listeners.get(method) ?? []), callback]);
                },
            });
        }, { once: true });
        socket.addEventListener("error", reject, { once: true });
    });
}

async function waitForExpression(cdp, expression, timeoutMs) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const result = await cdp.send("Runtime.evaluate", {
            expression,
            awaitPromise: true,
            returnByValue: true,
        });

        if (result.result?.value === true) {
            return;
        }

        await delay(100);
    }

    throw new Error(`Timed out waiting for expression: ${expression}`);
}

function formatRemoteValue(value) {
    return value.value ?? value.description ?? value.type;
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
