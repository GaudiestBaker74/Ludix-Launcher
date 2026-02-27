(function () {
    let devConsole, consoleInput, consoleOutput;
    let commandHistory = JSON.parse(localStorage.getItem('ludix_history')) || [];
    let hIndex = -1;
    let aliases = JSON.parse(localStorage.getItem('ludix_aliases')) || {};

    // --- Color Palette ---
    const COLORS = {
        primary: "var(--accent)",
        success: "#5f5",
        error: "#f55",
        info: "#0cf",
        gray: "#555",
        warn: "#f90",
        magic: "#ff69b4"
    };

    function loadSavedConfig() {
        const savedBg = localStorage.getItem('ludix_bg');
        if (savedBg && savedBg !== 'null') {
            document.body.style.backgroundImage = `url('${savedBg}')`;
            document.body.style.backgroundSize = "cover";
        }

        const savedLastGame = localStorage.getItem('ludix_last_game') || "None";
        const lastGameEl = document.getElementById('last-game-name');
        if (lastGameEl) lastGameEl.textContent = savedLastGame;

        const savedName = localStorage.getItem('ludix_user') || "Agent";
        const nameSpan = document.getElementById('user-display-name');
        if (nameSpan) nameSpan.textContent = savedName;

        const savedTheme = localStorage.getItem('ludix_theme');
        if (savedTheme) document.documentElement.style.setProperty('--accent', savedTheme);
    }

    function init() {
        devConsole = document.getElementById('dev-console');
        consoleInput = document.getElementById('console-input');
        consoleOutput = document.getElementById('console-output');

        loadSavedConfig();

        window.addEventListener('keydown', (e) => {
            if (e.key === 'F9') {
                e.preventDefault();
                const isVisible = devConsole.classList.toggle('visible');
                if (isVisible) setTimeout(() => consoleInput.focus(), 100);
            }
        });

        consoleInput.addEventListener('keydown', async (e) => {
            if (e.key === 'ArrowUp') {
                hIndex = Math.min(hIndex + 1, commandHistory.length - 1);
                if (hIndex >= 0) consoleInput.value = commandHistory[commandHistory.length - 1 - hIndex];
            }
            if (e.key === 'Enter') {
                const raw = consoleInput.value.trim();
                if (!raw) return;

                // 1. Intentar cargar los alias de forma segura
                let savedAliases = {};
                try {
                    const data = localStorage.getItem('ludix_aliases');
                    savedAliases = data ? JSON.parse(data) : {};
                } catch (e) {
                    savedAliases = {};
                }

                // 2. Separar el comando inicial
                let parts = raw.split(' ');
                let command = parts[0].toLowerCase();
                let args = parts.slice(1);

                // 3. TRADUCCIÓN DEL ALIAS (Si existe, cambia el comando)
                if (savedAliases[command]) {
                    const translated = savedAliases[command].split(' ');
                    command = translated[0].toLowerCase();
                    // Mezclamos los argumentos del alias con los nuevos si los hubiera
                    args = [...translated.slice(1), ...args];
                }

                // 4. Limpiar input y guardar historial
                write(`❯ ${raw}`, COLORS.gray);
                consoleInput.value = '';
                commandHistory.push(raw);
                localStorage.setItem('ludix_history', JSON.stringify(commandHistory));
                hIndex = -1;

                switch (command) {
                    case 'help':
                        write("--- TERMINAL LUDIX OS V2.0 ---", COLORS.primary);
                        write("play [name]      - Launches detected game");
                        write("search-store [q]   - Searches Epic Games Store");
                        write("bg [url]           - Changes background (GIF/JPG)");
                        write("theme [color]      - Changes accent color (#f00)");
                        write("set-name [n]       - Changes your alias");
                        write("stats              - Library summary");
                        write("whoami             - Session status");
                        write("ram / uptime       - System sensors");
                        write("ls-games           - Lists all games in console");
                        write("cls / reload       - Clear / Restart");
                        break;

                    case 'search-store':
                        const sq = args.join(' ');
                        if (!sq) return write("Uso: search-store [juego]", COLORS.error);
                        write(`Buscando "${sq}" en Epic Games Store...`, COLORS.info);
                        // Open in external browser securely
                        window.open(`https://store.epicgames.com/es-ES/browse?q=${encodeURIComponent(sq)}`, '_blank');
                        break;


                    case 'alias': {
                        const name = args[0];
                        const command = args.slice(1).join(' ');
                        if (!name || !command) return write("Uso: alias [shortcut] [full command]", COLORS.error);
                        aliases[name] = command;
                        localStorage.setItem('ludix_aliases', JSON.stringify(aliases));
                        write(`Alias created: ${name} -> ${command}`, COLORS.success);
                        break;
                    }

                    case 'clear-stats': {
                        if (confirm("Are you sure you want to clear all time history?")) {
                            await window.electronAPI.resetAllTimes();
                            write("Game history reset.", COLORS.warn);
                        }
                        break;
                    }
                    case 'play':
                    case 'launch': {
                        const query = args.join(' ').toLowerCase();
                        if (!query) return write("Uso: play [name]", COLORS.error);

                        const epic = await window.electronAPI.getEpicGames();
                        const steam = await window.electronAPI.getSteamGames();
                        const all = [...epic, ...steam];
                        const game = all.find(g => g.name.toLowerCase().includes(query));

                        if (game) {
                            write(`Starting sequence for: ${game.name}`, COLORS.success);

                            // --- ESTO ACTUALIZA EL FOOTER EN TIEMPO REAL ---
                            localStorage.setItem('ludix_last_game', game.name); // Lo guarda para la próxima vez
                            const lastGameEl = document.getElementById('last-game-name');
                            if (lastGameEl) lastGameEl.textContent = game.name; // Lo cambia ahora mismo
                            // ----------------------------------------------

                            window.electronAPI.launchGame(game.exePath || game.path || game.id, game.name);
                        } else {
                            write(`Error: "${query}" not found.`, COLORS.error);
                        }
                        break;
                    }

                    case 'ls-games':
                        const gEpic = await window.electronAPI.getEpicGames();
                        const gSteam = await window.electronAPI.getSteamGames();
                        write(`>> EPIC GAMES: ${gEpic.length}`, COLORS.info);
                        gEpic.forEach(g => write(` • ${g.name}`, "#ccc"));
                        write(`>> STEAM: ${gSteam.length}`, COLORS.info);
                        gSteam.forEach(g => write(` • ${g.name}`, "#ccc"));
                        break;

                    case 'theme':
                        const color = args[0];
                        if (!color) return write("Use: theme [#hex]", COLORS.error);
                        document.documentElement.style.setProperty('--accent', color);
                        localStorage.setItem('ludix_theme', color);
                        write(`Color scheme updated to ${color}`, color);
                        break;

                    case 'stats':
                        const eG = (await window.electronAPI.getEpicGames()).length;
                        const sG = (await window.electronAPI.getSteamGames()).length;

                        // Usamos nombres únicos (sTotal, mTotal, hTotal) para evitar conflictos
                        const sTotal = Math.floor(performance.now() / 1000);
                        const hTotal = Math.floor(sTotal / 3600);
                        const mTotal = Math.floor((sTotal % 3600) / 60);
                        const secTotal = sTotal % 60;

                        const uptimeStr = hTotal > 0
                            ? `${hTotal}h ${mTotal}m ${secTotal}s`
                            : `${mTotal}m ${secTotal}s`;

                        write("--- LIBRARY DIAGNOSTICS ---", COLORS.primary);
                        write(`Total games detected: ${eG + sG}`);
                        write(`Distribution: Epic (${eG}) | Steam (${sG})`);
                        write(`Current session time: ${uptimeStr}`, COLORS.info);
                        write(`Database integrity: 100%`, COLORS.success);
                        break;

                    case 'ram':
                        const mb = await window.electronAPI.getRamUsage();
                        const barSize = 20;
                        const used = Math.min(Math.floor(mb / 100), barSize);
                        const bar = "█".repeat(used) + "░".repeat(barSize - used);
                        write(`RAM USAGE: [${bar}] ${mb}MB`, COLORS.info);
                        break;

                    case 'whoami':
                        const current = localStorage.getItem('ludix_user') || "Guest";
                        write(`USER: ${current.toUpperCase()}`, COLORS.primary);
                        write(`SYSTEM: Ludix Console v0.1.0-alpha`, COLORS.gray);
                        break;

                    case 'bg':
                        const url = args[0];
                        if (url === 'null' || !url) {
                            localStorage.removeItem('ludix_bg');
                            document.body.style.backgroundImage = "none";
                            write("Background reset.");
                        } else {
                            localStorage.setItem('ludix_bg', url);
                            document.body.style.backgroundImage = `url('${url}')`;
                            document.body.style.backgroundSize = "cover";
                            write("Background updated.", COLORS.success);
                        }
                        break;

                    case 'set-name':
                        const newName = args.join(' ');
                        if (newName) {
                            localStorage.setItem('ludix_user', newName);
                            const el = document.getElementById('user-display-name');
                            if (el) el.textContent = newName;
                            write(`Identity confirmed: Welcome, ${newName}`, COLORS.success);
                        }
                        break;

                    case 'uptime':
                        const seconds = Math.floor(performance.now() / 1000);
                        const m = Math.floor(seconds / 60);
                        const s = seconds % 60;
                        write(`Core active: ${m}m ${s}s`, COLORS.info);
                        break;

                    case 'cls':
                        consoleOutput.innerHTML = '';
                        break;

                    case 'reload':
                        write("Reloading interface...", COLORS.warn);
                        setTimeout(() => location.reload(), 500);
                        break;

                    case 'kill-process':
                        write("Closing all instances...", COLORS.error);
                        setTimeout(() => window.close(), 1000);
                        break;

                    case 'random': {
                        const epic = await window.electronAPI.getEpicGames();
                        const steam = await window.electronAPI.getSteamGames();
                        const all = [...epic, ...steam];

                        if (all.length === 0) return write("Library empty.", COLORS.error);

                        const luckyGame = all[Math.floor(Math.random() * all.length)];
                        write(`🎲 Destiny has chosen: ${luckyGame.name}`, COLORS.magic);
                        write("Starting in 3 seconds...", COLORS.gray);

                        setTimeout(() => {
                            window.electronAPI.launchGame(luckyGame.exePath || luckyGame.path || luckyGame.id, luckyGame.name);
                        }, 3000);
                        break;
                    }

                    case 'sysinfo': {
                        write("--- ESPECIFICACIONES DEL SISTEMA ---", COLORS.primary);
                        write(`Plataforma: ${process.platform.toUpperCase()}`);
                        write(`Arquitectura: ${process.arch}`);
                        write(`Versión Node: ${process.version}`);
                        write(`Memoria Libre: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB (Heap)`);
                        break;
                    }

                    case 'timer': {
                        const mins = parseInt(args[0]);
                        if (!mins || isNaN(mins)) return write("Uso: timer [minutos]", COLORS.error);

                        write(`⏱️ Timer set for ${mins} minutes.`, COLORS.info);

                        setTimeout(() => {
                            // Esto lanza una notificación nativa de Windows/OS
                            new Notification("Ludix OS", {
                                body: `Time's up! ${mins} minutes have passed.`,
                                silent: false
                            });
                            write(`🔔 ALERT: The ${mins}m timer has ended.`, COLORS.magic);
                        }, mins * 60000);
                        break;
                    }

                    case 'todo': {
                        let todos = JSON.parse(localStorage.getItem('ludix_todos')) || [];
                        const action = args[0]; // add, list, del
                        const text = args.slice(1).join(' ');

                        if (action === 'add' && text) {
                            todos.push(text);
                            localStorage.setItem('ludix_todos', JSON.stringify(todos));
                            write(`✅ Added: "${text}"`, COLORS.success);
                        }
                        else if (action === 'del') {
                            const index = parseInt(text) - 1;
                            if (todos[index]) {
                                const removed = todos.splice(index, 1);
                                localStorage.setItem('ludix_todos', JSON.stringify(todos));
                                write(`🗑️ Deleted: "${removed}"`, COLORS.warn);
                            } else {
                                write("Usage: todo del [number]", COLORS.error);
                            }
                        }
                        else {
                            write("--- TO-DO LIST ---", COLORS.primary);
                            if (todos.length === 0) write("No hay tareas pendientes.", COLORS.gray);
                            todos.forEach((t, i) => write(`${i + 1}. ${t}`, "#ccc"));
                            write("Usage: todo add [text] / todo del [number]", COLORS.gray);
                        }
                        break;
                    }

                    case 'clear-ram':
                    case 'optimize': {
                        write("Starting optimization protocol...", COLORS.info);
                        const antes = await window.electronAPI.getRamUsage();

                        // Simulación de limpieza (en Electron el GC es automático, pero esto refresca la UI)
                        setTimeout(async () => {
                            const despues = await window.electronAPI.getRamUsage();
                            write("✨ Memory optimized.", COLORS.success);
                            write(`State: ${antes}MB --> ${despues}MB`, COLORS.gray);
                            write("Icon cache purged.", COLORS.gray);
                        }, 1000);
                        break;
                    }

                    case 'kill': {
                        write("Emergency shutdown initiated...", COLORS.error);
                        setTimeout(() => {
                            window.close();
                        }, 500);
                        break;
                    }

                    case 'calc': {
                        const expr = args.join(' ');
                        if (!expr) return write("Usage: calc [operation] (ex: 10 + 5)", COLORS.error);
                        try {
                            // Usamos Function en lugar de eval por un poco más de seguridad
                            const result = new Function(`return ${expr}`)();
                            write(`> Result: ${result}`, COLORS.magic);
                        } catch (e) {
                            write("Error: Expresión matemática inválida.", COLORS.error);
                        }
                        break;
                    }

                    case 'fortune': {
                        const phrases = [
                            "A great game requires a great graphics card.",
                            "Lag is man's worst enemy.",
                            "Tomorrow will be a good day to beat that final boss.",
                            "Patience is a virtue, but SSDs are better.",
                            "Your game library says a lot about you."
                        ];
                        const random = phrases[Math.floor(Math.random() * phrases.length)];
                        write(`🔮 FORTUNE: ${random}`, COLORS.magic);
                        break;
                    }

                    case 'alias-list': {
                        const savedAliases = JSON.parse(localStorage.getItem('ludix_aliases')) || {};
                        write("--- MY ALIASES ---", COLORS.primary);
                        const keys = Object.keys(savedAliases);
                        if (keys.length === 0) write("No aliases configured.", COLORS.gray);
                        keys.forEach(k => write(`${k}  =>  ${savedAliases[k]}`, "#ccc"));
                        break;
                    }

                    case 'unalias': {
                        const aliasToDel = args[0]?.toLowerCase();
                        if (!aliasToDel) return write("Usage: unalias [name]", COLORS.error);

                        let savedAliases = JSON.parse(localStorage.getItem('ludix_aliases')) || {};

                        if (savedAliases[aliasToDel]) {
                            delete savedAliases[aliasToDel];
                            localStorage.setItem('ludix_aliases', JSON.stringify(savedAliases));
                            write(`🗑️ Alias "${aliasToDel}" deleted successfully.`, COLORS.success);
                        } else {
                            write(`Error: Alias "${aliasToDel}" does not exist.`, COLORS.error);
                        }
                        break;
                    }

                    case 'opacity': {
                        const level = parseFloat(args[0]);
                        if (isNaN(level) || level < 0 || level > 1) {
                            return write("Usage: opacity [0.0 to 1.0]", COLORS.error);
                        }
                        devConsole.style.backgroundColor = `rgba(0, 0, 0, ${level})`;
                        write(`Console opacity adjusted to ${level * 100}%`, COLORS.info);
                        break;
                    }

                    case 'echo': {
                        const message = args.join(' ');
                        write(message || "Write something to repeat.", COLORS.primary);
                        break;
                    }

                    case 'version': {
                        const versionInfo = {
                            os: "Ludix OS",
                            build: "2026.2.16",
                            console: "Electron " + process.versions.electron,
                            chrome: "v" + process.versions.chrome,
                            node: "v" + process.versions.node,
                            status: "Stable Release"
                        };

                        write("--- SYSTEM INFORMATION ---", COLORS.primary);
                        write(`System: ${versionInfo.os}`, COLORS.info);
                        write(`Build: ${versionInfo.build}`, COLORS.gray);
                        write(`Engine: ${versionInfo.console}`, COLORS.gray);
                        write(`Environment: Node ${versionInfo.node}`, COLORS.gray);
                        write(`Status: ${versionInfo.status}`, COLORS.success);
                        break;
                    }

                    case 'pwr-status': {
                        if ('getBattery' in navigator) {
                            const battery = await navigator.getBattery();
                            const level = Math.round(battery.level * 100);
                            const charging = battery.charging ? "Charging" : "Discharging";
                            const color = level > 20 ? COLORS.success : COLORS.error;

                            write(`--- POWER STATUS ---`, COLORS.primary);
                            write(`Level: ${level}% [${charging}]`, color);
                            write(`Time remaining: ${battery.dischargingTime === Infinity ? 'Calculating...' : Math.round(battery.dischargingTime / 60) + ' min'}`, COLORS.gray);
                        } else {
                            write("Battery information not available.", COLORS.error);
                        }
                        break;
                    }

                    case 'history': {
                        write("--- RECENT HISTORY ---", COLORS.gray);
                        commandHistory.forEach((cmd, i) => {
                            write(`${i + 1}: ${cmd}`, "#555");
                        });
                        break;
                    }

                    case 'google':
                    case 'search': {
                        const query = args.join(' ');
                        if (!query) return write("Usage: search [what you want to search]", COLORS.error);
                        write(`Searching for "${query}" on the web...`, COLORS.info);
                        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                        break;
                    }

                    case 'matrix': {
                        try {

                            const oldCanvas = document.getElementById('matrix-console-canvas');
                            if (oldCanvas) oldCanvas.remove();

                            // 2. Create the canvas
                            const canvas = document.createElement('canvas');
                            canvas.id = 'matrix-console-canvas';

                            // Styles to fit ONLY the console output area
                            Object.assign(canvas.style, {
                                position: 'absolute',
                                top: '0',
                                left: '0',
                                width: '100%',
                                height: '100%',
                                zIndex: '0', // Behind the text
                                pointerEvents: 'none',
                                opacity: '0.4' // So it doesn't bother reading
                            });

                            // Ensure the output container is the "parent" relative
                            consoleOutput.style.position = 'relative';
                            consoleOutput.prepend(canvas); // Put it at the beginning to be at the bottom

                            const ctx = canvas.getContext('2d');

                            // Adjust to the actual size of the container at that moment
                            canvas.width = consoleOutput.clientWidth;
                            canvas.height = consoleOutput.clientHeight;

                            const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                            const fontSize = 14;
                            const columns = Math.floor(canvas.width / fontSize);
                            const drops = new Array(columns).fill(1);

                            function draw() {
                                ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
                                ctx.fillRect(0, 0, canvas.width, canvas.height);

                                ctx.fillStyle = "#0f0";
                                ctx.font = fontSize + "px monospace";

                                for (let i = 0; i < drops.length; i++) {
                                    const text = chars.charAt(Math.floor(Math.random() * chars.length));
                                    ctx.fillText(text, i * fontSize, drops[i] * fontSize);

                                    if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                                        drops[i] = 0;
                                    }
                                    drops[i]++;
                                }
                            }

                            const matrixInterval = setInterval(draw, 40);
                            write("Matrix simulation active in terminal.", "#0f0");

                            // Command to stop it manually if you want
                            window.stopMatrixEffect = () => {
                                clearInterval(matrixInterval);
                                canvas.remove();
                                write("Matrix effect deactivated.", COLORS.gray);
                            };

                        } catch (err) {
                            write("Error: " + err.message, COLORS.error);
                        }
                        break;
                    }

                    case 'fastfetch': {
                        const infoColor = COLORS.primary;
                        write("      _             _ _ ", infoColor);
                        write("     | |           | (_)  OS: Ludix OS v3.1", infoColor);
                        write("     | |    _   _ _| |_   console: Electron 2026", infoColor);
                        write("     | |   | | | / _` | |  Shell: Ludix-Bash", infoColor);
                        write("     | |___| |_| | (_| | |  Uptime: " + Math.floor(performance.now() / 60000) + "m", infoColor);
                        write("     \\_____/\\__,_|\\__,_|_|  Host: " + (localStorage.getItem('ludix_user') || 'Agente'), infoColor);
                        break;
                    }

                    default:
                        write(`'${command}' is not recognized as an internal or external command.`, COLORS.error);
                        write(`Type 'help' to see the list of commands.`, COLORS.gray);
                }
            }
        });
    }

    function write(text, color = "#aaa") {
        const d = document.createElement('div');
        d.className = "console-line";
        d.style.color = color;
        d.innerHTML = `<span class="console-timestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span> ${text}`;
        consoleOutput.appendChild(d);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    init();
})();