(function () {
    let devConsole, consoleInput, consoleOutput;
    let commandHistory = JSON.parse(localStorage.getItem('ludix_history')) || [];
    let hIndex = -1;
    let aliases = JSON.parse(localStorage.getItem('ludix_aliases')) || {};

    // --- PALETA DE COLORES ---
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

        const savedLastGame = localStorage.getItem('ludix_last_game') || "Ninguno";
        const lastGameEl = document.getElementById('last-game-name'); // Asegúrate de que este ID coincida con tu HTML
        if (lastGameEl) lastGameEl.textContent = savedLastGame;

        const savedName = localStorage.getItem('ludix_user') || "Agente";
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
                        write("play [nombre]      - Lanza juego detectado");
                        write("search-store [q]   - Busca en Epic Games Store");
                        write("bg [url]           - Cambia fondo (GIF/JPG)");
                        write("theme [color]      - Cambia color de acento (#f00)");
                        write("set-name [n]       - Cambia tu alias");
                        write("stats              - Resumen de biblioteca");
                        write("whoami             - Estado de la sesión");
                        write("ram / uptime       - Sensores del sistema");
                        write("ls-games           - Lista todos los juegos en consola");
                        write("cls / reload       - Limpiar / Reiniciar");
                        break;

                    case 'search-store':
                        const sq = args.join(' ');
                        if (!sq) return write("Uso: search-store [juego]", COLORS.error);
                        write(`Buscando "${sq}" en Epic Games Store...`, COLORS.info);
                        // Abrir en el navegador externo de forma segura
                        window.open(`https://store.epicgames.com/es-ES/browse?q=${encodeURIComponent(sq)}`, '_blank');
                        break;


                    case 'alias': {
                        const name = args[0];
                        const command = args.slice(1).join(' ');
                        if (!name || !command) return write("Uso: alias [atajo] [comando completo]", COLORS.error);
                        aliases[name] = command;
                        localStorage.setItem('ludix_aliases', JSON.stringify(aliases));
                        write(`Alias creado: ${name} -> ${command}`, COLORS.success);
                        break;
                    }

                    case 'clear-stats': {
                        if (confirm("¿Seguro que quieres borrar todo el historial de tiempo?")) {
                            await window.electronAPI.resetAllTimes();
                            write("Historial de juego reiniciado.", COLORS.warn);
                        }
                        break;
                    }
                    case 'play':
                    case 'launch': {
                        const query = args.join(' ').toLowerCase();
                        if (!query) return write("Uso: play [nombre]", COLORS.error);

                        const epic = await window.electronAPI.getEpicGames();
                        const steam = await window.electronAPI.getSteamGames();
                        const all = [...epic, ...steam];
                        const game = all.find(g => g.name.toLowerCase().includes(query));

                        if (game) {
                            write(`Iniciando secuencia para: ${game.name}`, COLORS.success);

                            // --- ESTO ACTUALIZA EL FOOTER EN TIEMPO REAL ---
                            localStorage.setItem('ludix_last_game', game.name); // Lo guarda para la próxima vez
                            const lastGameEl = document.getElementById('last-game-name');
                            if (lastGameEl) lastGameEl.textContent = game.name; // Lo cambia ahora mismo
                            // ----------------------------------------------

                            window.electronAPI.launchGame(game.exePath || game.path || game.id, game.name);
                        } else {
                            write(`Error: "${query}" no localizado.`, COLORS.error);
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
                        if (!color) return write("Uso: theme [#hex]", COLORS.error);
                        document.documentElement.style.setProperty('--accent', color);
                        localStorage.setItem('ludix_theme', color);
                        write(`Esquema de color actualizado a ${color}`, color);
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

                        write("--- DIAGNÓSTICO DE BIBLIOTECA ---", COLORS.primary);
                        write(`Total juegos detectados: ${eG + sG}`);
                        write(`Distribución: Epic (${eG}) | Steam (${sG})`);
                        write(`Tiempo de sesión actual: ${uptimeStr}`, COLORS.info);
                        write(`Integridad de base de datos: 100%`, COLORS.success);
                        break;

                    case 'ram':
                        const mb = await window.electronAPI.getRamUsage();
                        const barSize = 20;
                        const used = Math.min(Math.floor(mb / 100), barSize);
                        const bar = "█".repeat(used) + "░".repeat(barSize - used);
                        write(`USO DE RAM: [${bar}] ${mb}MB`, COLORS.info);
                        break;

                    case 'whoami':
                        const current = localStorage.getItem('ludix_user') || "Invitado";
                        write(`USUARIO: ${current.toUpperCase()}`, COLORS.primary);
                        write(`AUTORIZACIÓN: NIVEL 5 (ROOT)`, COLORS.success);
                        write(`SISTEMA: Ludix Kernel v3.1.0-stable`, COLORS.gray);
                        break;

                    case 'bg':
                        const url = args[0];
                        if (url === 'null' || !url) {
                            localStorage.removeItem('ludix_bg');
                            document.body.style.backgroundImage = "none";
                            write("Fondo restablecido.");
                        } else {
                            localStorage.setItem('ludix_bg', url);
                            document.body.style.backgroundImage = `url('${url}')`;
                            document.body.style.backgroundSize = "cover";
                            write("Fondo de pantalla actualizado.", COLORS.success);
                        }
                        break;

                    case 'set-name':
                        const newName = args.join(' ');
                        if (newName) {
                            localStorage.setItem('ludix_user', newName);
                            const el = document.getElementById('user-display-name');
                            if (el) el.textContent = newName;
                            write(`Identidad confirmada: Bienvenido, ${newName}`, COLORS.success);
                        }
                        break;

                    case 'uptime':
                        const seconds = Math.floor(performance.now() / 1000);
                        const m = Math.floor(seconds / 60);
                        const s = seconds % 60;
                        write(`Núcleo activo: ${m}m ${s}s`, COLORS.info);
                        break;

                    case 'neko':
                        write("(=^·^=) Meow! Sistema optimizado.", COLORS.magic);
                        break;

                    case 'cls':
                        consoleOutput.innerHTML = '';
                        break;

                    case 'reload':
                        write("Reiniciando interfaz...", COLORS.warn);
                        setTimeout(() => location.reload(), 500);
                        break;

                    case 'kill-process':
                        write("Cerrando todas las instancias...", COLORS.error);
                        setTimeout(() => window.close(), 1000);
                        break;

                    case 'random': {
                        const epic = await window.electronAPI.getEpicGames();
                        const steam = await window.electronAPI.getSteamGames();
                        const all = [...epic, ...steam];

                        if (all.length === 0) return write("Biblioteca vacía.", COLORS.error);

                        const luckyGame = all[Math.floor(Math.random() * all.length)];
                        write(`🎲 El destino ha elegido: ${luckyGame.name}`, COLORS.magic);
                        write("Iniciando en 3 segundos...", COLORS.gray);

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

                        write(`⏱️ Temporizador configurado para ${mins} minutos.`, COLORS.info);

                        setTimeout(() => {
                            // Esto lanza una notificación nativa de Windows/OS
                            new Notification("Ludix OS", {
                                body: `¡Tiempo agotado! Han pasado ${mins} minutos.`,
                                silent: false
                            });
                            write(`🔔 ALERTA: El temporizador de ${mins}m ha terminado.`, COLORS.magic);
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
                            write(`✅ Añadido: "${text}"`, COLORS.success);
                        }
                        else if (action === 'del') {
                            const index = parseInt(text) - 1;
                            if (todos[index]) {
                                const removed = todos.splice(index, 1);
                                localStorage.setItem('ludix_todos', JSON.stringify(todos));
                                write(`🗑️ Eliminado: "${removed}"`, COLORS.warn);
                            } else {
                                write("Uso: todo del [número]", COLORS.error);
                            }
                        }
                        else {
                            write("--- LISTA DE TAREAS ---", COLORS.primary);
                            if (todos.length === 0) write("No hay tareas pendientes.", COLORS.gray);
                            todos.forEach((t, i) => write(`${i + 1}. ${t}`, "#ccc"));
                            write("Uso: todo add [texto] / todo del [número]", COLORS.gray);
                        }
                        break;
                    }

                    case 'clear-ram':
                    case 'optimize': {
                        write("Iniciando protocolo de optimización...", COLORS.info);
                        const antes = await window.electronAPI.getRamUsage();

                        // Simulación de limpieza (en Electron el GC es automático, pero esto refresca la UI)
                        setTimeout(async () => {
                            const despues = await window.electronAPI.getRamUsage();
                            write("✨ Memoria optimizada.", COLORS.success);
                            write(`Estado: ${antes}MB --> ${despues}MB`, COLORS.gray);
                            write("Caché de iconos purgada.", COLORS.gray);
                        }, 1000);
                        break;
                    }

                    case 'kill': {
                        write("Cierre de emergencia iniciado...", COLORS.error);
                        setTimeout(() => {
                            window.close();
                        }, 500);
                        break;
                    }

                    case 'calc': {
                        const expr = args.join(' ');
                        if (!expr) return write("Uso: calc [operación] (ej: 10 + 5)", COLORS.error);
                        try {
                            // Usamos Function en lugar de eval por un poco más de seguridad
                            const result = new Function(`return ${expr}`)();
                            write(`> Resultado: ${result}`, COLORS.magic);
                        } catch (e) {
                            write("Error: Expresión matemática inválida.", COLORS.error);
                        }
                        break;
                    }

                    case 'upgrade': {
                        let progress = 0;
                        write("Buscando actualizaciones en el servidor...", COLORS.info);

                        const interval = setInterval(() => {
                            progress += Math.floor(Math.random() * 15);
                            if (progress > 100) progress = 100;

                            const barSize = 20;
                            const filled = Math.floor((progress / 100) * barSize);
                            const bar = "█".repeat(filled) + "░".repeat(barSize - filled);

                            // Limpiamos la última línea para que no se llene la consola (opcional)
                            // O simplemente escribimos el progreso
                            write(`Descargando Kernel v4.0: [${bar}] ${progress}%`, COLORS.primary);

                            if (progress >= 100) {
                                clearInterval(interval);
                                write("✅ Sistema actualizado correctamente. Reinicia para aplicar cambios.", COLORS.success);
                            }
                        }, 400);
                        break;
                    }

                    case 'fortune': {
                        const phrases = [
                            "Un gran juego conlleva una gran tarjeta gráfica.",
                            "El lag es el peor enemigo del hombre.",
                            "Mañana será un buen día para pasarse ese jefe final.",
                            "La paciencia es una virtud, pero los SSD son mejores.",
                            "Tu biblioteca de juegos dice mucho de ti."
                        ];
                        const random = phrases[Math.floor(Math.random() * phrases.length)];
                        write(`🔮 FORTUNA: ${random}`, COLORS.magic);
                        break;
                    }

                    case 'alias-list': {
                        const savedAliases = JSON.parse(localStorage.getItem('ludix_aliases')) || {};
                        write("--- MIS ATAJOS (ALIASES) ---", COLORS.primary);
                        const keys = Object.keys(savedAliases);
                        if (keys.length === 0) write("No hay alias configurados.", COLORS.gray);
                        keys.forEach(k => write(`${k}  =>  ${savedAliases[k]}`, "#ccc"));
                        break;
                    }

                    case 'unalias': {
    const aliasToDel = args[0]?.toLowerCase();
    if (!aliasToDel) return write("Uso: unalias [nombre]", COLORS.error);

    let savedAliases = JSON.parse(localStorage.getItem('ludix_aliases')) || {};

    if (savedAliases[aliasToDel]) {
        delete savedAliases[aliasToDel];
        localStorage.setItem('ludix_aliases', JSON.stringify(savedAliases));
        write(`🗑️ Alias "${aliasToDel}" eliminado correctamente.`, COLORS.success);
    } else {
        write(`Error: El alias "${aliasToDel}" no existe.`, COLORS.error);
    }
    break;
}

                    case 'opacity': {
                        const level = parseFloat(args[0]);
                        if (isNaN(level) || level < 0 || level > 1) {
                            return write("Uso: opacity [0.0 a 1.0]", COLORS.error);
                        }
                        devConsole.style.backgroundColor = `rgba(0, 0, 0, ${level})`;
                        write(`Opacidad de consola ajustada a ${level * 100}%`, COLORS.info);
                        break;
                    }

                    case 'echo': {
                        const message = args.join(' ');
                        write(message || "Escribe algo para repetir.", COLORS.primary);
                        break;
                    }

                    case 'version': {
    const versionInfo = {
        os: "Ludix OS",
        build: "2026.2.16",
        kernel: "Electron " + process.versions.electron,
        chrome: "v" + process.versions.chrome,
        node: "v" + process.versions.node,
        status: "Stable Release"
    };

    write("--- INFORMACIÓN DEL SISTEMA ---", COLORS.primary);
    write(`Sistema: ${versionInfo.os}`, COLORS.info);
    write(`Build: ${versionInfo.build}`, COLORS.gray);
    write(`Motor: ${versionInfo.kernel}`, COLORS.gray);
    write(`Entorno: Node ${versionInfo.node}`, COLORS.gray);
    write(`Estado: ${versionInfo.status}`, COLORS.success);
    break;
}

                    case 'pwr-status': {
                        if ('getBattery' in navigator) {
                            const battery = await navigator.getBattery();
                            const level = Math.round(battery.level * 100);
                            const charging = battery.charging ? "Cargando" : "Descargando";
                            const color = level > 20 ? COLORS.success : COLORS.error;

                            write(`--- ESTADO DE ENERGÍA ---`, COLORS.primary);
                            write(`Nivel: ${level}% [${charging}]`, color);
                            write(`Tiempo restante: ${battery.dischargingTime === Infinity ? 'Calculando...' : Math.round(battery.dischargingTime / 60) + ' min'}`, COLORS.gray);
                        } else {
                            write("Información de batería no disponible.", COLORS.error);
                        }
                        break;
                    }

                    case 'history': {
                        write("--- HISTORIAL RECIENTE ---", COLORS.gray);
                        commandHistory.forEach((cmd, i) => {
                            write(`${i + 1}: ${cmd}`, "#555");
                        });
                        break;
                    }

                    case 'google':
                    case 'search': {
                        const query = args.join(' ');
                        if (!query) return write("Uso: search [lo que quieras buscar]", COLORS.error);
                        write(`Buscando "${query}" en la red...`, COLORS.info);
                        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                        break;
                    }

                    case 'matrix': {
                        try {
                            // 1. Limpiar si ya existe
                            const oldCanvas = document.getElementById('matrix-console-canvas');
                            if (oldCanvas) oldCanvas.remove();

                            // 2. Crear el canvas
                            const canvas = document.createElement('canvas');
                            canvas.id = 'matrix-console-canvas';

                            // Estilos para que se ajuste SOLO al área de salida de la consola
                            Object.assign(canvas.style, {
                                position: 'absolute',
                                top: '0',
                                left: '0',
                                width: '100%',
                                height: '100%',
                                zIndex: '0', // Por detrás del texto
                                pointerEvents: 'none',
                                opacity: '0.4' // Para que no moleste la lectura
                            });

                            // Aseguramos que el contenedor de salida sea el "padre" relativo
                            consoleOutput.style.position = 'relative';
                            consoleOutput.prepend(canvas); // Lo ponemos al principio para que esté al fondo

                            const ctx = canvas.getContext('2d');

                            // Ajustar al tamaño real del contenedor en ese momento
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
                            write("Simulación Matrix activa en terminal.", "#0f0");

                            // Comando para detenerlo manualmente si quieres
                            window.stopMatrixEffect = () => {
                                clearInterval(matrixInterval);
                                canvas.remove();
                                write("Efecto Matrix desactivado.", COLORS.gray);
                            };

                        } catch (err) {
                            write("Error: " + err.message, COLORS.error);
                        }
                        break;
                    }

                    case 'neofetch': {
                        const infoColor = COLORS.primary;
                        write("      _             _ _ ", infoColor);
                        write("     | |           | (_)  OS: Ludix OS v3.1", infoColor);
                        write("     | |    _   _ _| |_   Kernel: Electron 2026", infoColor);
                        write("     | |   | | | / _` | |  Shell: Ludix-Bash", infoColor);
                        write("     | |___| |_| | (_| | |  Uptime: " + Math.floor(performance.now() / 60000) + "m", infoColor);
                        write("     \\_____/\\__,_|\\__,_|_|  Host: " + (localStorage.getItem('ludix_user') || 'Agente'), infoColor);
                        break;
                    }

                    default:
                        write(`'${command}' no se reconoce como comando interno o externo.`, COLORS.error);
                        write(`Escribe 'help' para ver la lista de comandos.`, COLORS.gray);
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