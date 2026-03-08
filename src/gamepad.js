// gamepad.js - HTML5 Gamepad API integration for Ludix OS

let focusedElement = null;
let lastButtonState = {};
let lastAxisState = { x: 0, y: 0 };
const AXIS_THRESHOLD = 0.5;
const COOLDOWN_MS = 180;
let lastActionTime = 0;

function getFocusableElements() {
    // Only get visible focusable elements
    return Array.from(document.querySelectorAll('.tab-button, .game-card, .add-game-btn, .browse-btn, .upload-btn, button, input'))
        .filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && getComputedStyle(el).display !== 'none' && !el.closest('[style*="display: none"]');
        });
}

function updateVisualFocus(newEl) {
    // Remove focus class from ALL possible elements to be safe
    document.querySelectorAll('.gamepad-focus').forEach(el => el.classList.remove('gamepad-focus'));

    if (newEl) {
        newEl.classList.add('gamepad-focus');
        newEl.focus();
        focusedElement = newEl;
    }
}

function vibrate(gp, duration = 40, weak = 0.3, strong = 0) {
    if (gp && gp.vibrationActuator && gp.vibrationActuator.playEffect) {
        gp.vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: duration,
            weakMagnitude: weak,
            strongMagnitude: strong
        }).catch(() => { });
    }
}

function focusNearest(direction) {
    const now = Date.now();
    if (now - lastActionTime < COOLDOWN_MS) return;

    const elements = getFocusableElements();
    if (elements.length === 0) return;

    if (!focusedElement || !document.contains(focusedElement) || getComputedStyle(focusedElement).display === 'none') {
        updateVisualFocus(elements[0]);
        lastActionTime = now;
        if (window.playSound) window.playSound('hover', 0.15);
        return;
    }

    const currentRect = focusedElement.getBoundingClientRect();
    const currentCenter = {
        x: currentRect.left + currentRect.width / 2,
        y: currentRect.top + currentRect.height / 2
    };

    let bestDist = Infinity;
    let bestEl = null;

    elements.forEach(el => {
        if (el === focusedElement) return;
        const rect = el.getBoundingClientRect();
        const center = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };

        const dx = center.x - currentCenter.x;
        const dy = center.y - currentCenter.y;

        let isMatch = false;
        // Navigation Logic
        if (direction === 'up' && dy < -5) isMatch = true;
        if (direction === 'down' && dy > 5) isMatch = true;
        if (direction === 'left' && dx < -5) isMatch = true;
        if (direction === 'right' && dx > 5) isMatch = true;

        if (isMatch) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            // Axis Alignment Bias
            const axisPenalty = (direction === 'up' || direction === 'down') ? Math.abs(dx) * 1.5 : Math.abs(dy) * 1.5;
            const score = dist + axisPenalty;

            if (score < bestDist) {
                bestDist = score;
                bestEl = el;
            }
        }
    });

    if (bestEl) {
        updateVisualFocus(bestEl);
        lastActionTime = now;
        if (window.playSound) window.playSound('hover', 0.15);
        bestEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const gamepads = navigator.getGamepads();
        if (gamepads[0]) vibrate(gamepads[0], 20, 0.2);
    }
}

function handleGamepadInput() {
    const gamepads = navigator.getGamepads();
    if (!gamepads || !gamepads[0]) return;
    const gp = gamepads[0];

    // D-Pad and Left Stick
    let x = gp.axes[0] || 0;
    let y = gp.axes[1] || 0;

    const dpadUp = gp.buttons[12]?.pressed;
    const dpadDown = gp.buttons[13]?.pressed;
    const dpadLeft = gp.buttons[14]?.pressed;
    const dpadRight = gp.buttons[15]?.pressed;

    if (y < -AXIS_THRESHOLD || dpadUp) {
        if (lastAxisState.y !== -1) { focusNearest('up'); lastAxisState.y = -1; lastAxisState.x = 0; }
    } else if (y > AXIS_THRESHOLD || dpadDown) {
        if (lastAxisState.y !== 1) { focusNearest('down'); lastAxisState.y = 1; lastAxisState.x = 0; }
    } else if (x < -AXIS_THRESHOLD || dpadLeft) {
        if (lastAxisState.x !== -1) { focusNearest('left'); lastAxisState.x = -1; lastAxisState.y = 0; }
    } else if (x > AXIS_THRESHOLD || dpadRight) {
        if (lastAxisState.x !== 1) { focusNearest('right'); lastAxisState.x = 1; lastAxisState.y = 0; }
    } else {
        lastAxisState.x = 0;
        lastAxisState.y = 0;
    }

    // Scroll with Triggers or Right Stick
    const rt = gp.buttons[7]?.value || 0;
    const lt = gp.buttons[6]?.value || 0;
    const rsY = gp.axes[3] || 0;

    if (Math.abs(rsY) > 0.2) {
        const launcher = document.querySelector('.launcher');
        if (launcher) launcher.scrollTop += rsY * 20;
    } else if (rt > 0.1) {
        const launcher = document.querySelector('.launcher');
        if (launcher) launcher.scrollTop += rt * 15;
    } else if (lt > 0.1) {
        const launcher = document.querySelector('.launcher');
        if (launcher) launcher.scrollTop -= lt * 15;
    }

    // A Button (Confirm)
    if (gp.buttons[0]?.pressed && !lastButtonState[0]) {
        lastButtonState[0] = true;
        if (focusedElement) {
            vibrate(gp, 50, 0.4, 0.2);
            focusedElement.click();
            if (window.playSound) window.playSound('click', 0.3);
        }
    } else if (!gp.buttons[0]?.pressed) {
        lastButtonState[0] = false;
    }

    // B Button (Back)
    if (gp.buttons[1]?.pressed && !lastButtonState[1]) {
        lastButtonState[1] = true;
        const addModal = document.getElementById('addGameModal');
        const retroModal = document.getElementById('addRetroModal');
        const settingsModal = document.getElementById('settingsModal');
        const weeklyModal = document.getElementById('weeklyReportModal');

        if (addModal && getComputedStyle(addModal).display !== 'none') {
            document.getElementById('cancelAddBtn')?.click();
        } else if (retroModal && getComputedStyle(retroModal).display !== 'none') {
            document.getElementById('cancelRetroAddBtn')?.click();
        } else if (settingsModal && getComputedStyle(settingsModal).display !== 'none') {
            document.getElementById('closeSettingsBtn')?.click();
        } else if (weeklyModal && getComputedStyle(weeklyModal).display !== 'none') {
            document.getElementById('closeWeeklyReportBtn')?.click();
        }
    } else if (!gp.buttons[1]?.pressed) {
        lastButtonState[1] = false;
    }

    // X Button (Weekly Report)
    if (gp.buttons[2]?.pressed && !lastButtonState[2]) {
        lastButtonState[2] = true;
        document.getElementById('weeklyReportBtn')?.click();
    } else if (!gp.buttons[2]?.pressed) {
        lastButtonState[2] = false;
    }

    // Y Button (Search Focus)
    if (gp.buttons[3]?.pressed && !lastButtonState[3]) {
        lastButtonState[3] = true;
        const search = document.getElementById('searchInput') || document.getElementById('epicSearchInput');
        if (search) updateVisualFocus(search);
    } else if (!gp.buttons[3]?.pressed) {
        lastButtonState[3] = false;
    }

    // LB / RB (Tabs Navigation)
    const lbPressed = gp.buttons[4]?.pressed;
    const rbPressed = gp.buttons[5]?.pressed;
    const now = Date.now();

    if (lbPressed && !lastButtonState[4] && now - lastActionTime > COOLDOWN_MS) {
        lastButtonState[4] = true;
        cycleTab(-1);
        lastActionTime = now;
    } else if (!lbPressed) {
        lastButtonState[4] = false;
    }

    if (rbPressed && !lastButtonState[5] && now - lastActionTime > COOLDOWN_MS) {
        lastButtonState[5] = true;
        cycleTab(1);
        lastActionTime = now;
    } else if (!rbPressed) {
        lastButtonState[5] = false;
    }

    // Start Button (Settings)
    if (gp.buttons[9]?.pressed && !lastButtonState[9]) {
        lastButtonState[9] = true;
        document.getElementById('settingsBtn')?.click();
    } else if (!gp.buttons[9]?.pressed) {
        lastButtonState[9] = false;
    }
}

function cycleTab(direction) {
    const tabs = Array.from(document.querySelectorAll('.tab-button'));
    if (tabs.length === 0) return;
    const activeIdx = tabs.findIndex(t => t.classList.contains('active'));
    let newIdx = activeIdx + direction;
    if (newIdx < 0) newIdx = tabs.length - 1;
    if (newIdx >= tabs.length) newIdx = 0;

    if (window.playSound) window.playSound('tab', 0.4);
    tabs[newIdx].click();
    updateVisualFocus(tabs[newIdx]);

    const gamepads = navigator.getGamepads();
    if (gamepads[0]) vibrate(gamepads[0], 30, 0.3);
}

// Keep track of hover to sync gamepad focus
document.addEventListener('mouseover', (e) => {
    const validTarget = e.target.closest('.tab-button, .game-card, .add-game-btn, button, input');
    if (validTarget && validTarget !== focusedElement) {
        updateVisualFocus(validTarget);
    }
});

function loop() {
    handleGamepadInput();
    requestAnimationFrame(loop);
}

window.addEventListener('gamepadconnected', (e) => {
    console.log(`Gamepad connected: ${e.gamepad.id}`);
    const elements = getFocusableElements();
    if (elements.length > 0 && !focusedElement) {
        updateVisualFocus(elements[0]);
    }
});

loop();

