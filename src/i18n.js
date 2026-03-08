// =====================================================
// i18n.js — Ludix Launcher Multi-Language Support
// Supported: EN (English), ES (Spanish)
// =====================================================

const TRANSLATIONS = {
    en: {
        // Title bar
        appTitle: 'Ludix Launcher',

        // Tabs
        tabHome: 'MAIN PANEL',
        tabSteam: 'STEAM',
        tabEpic: 'EPIC GAMES',

        // Home panel
        greetingMorning: 'Good morning',
        greetingAfternoon: 'Good afternoon',
        greetingEvening: 'Good evening',
        totalHours: 'You have spent {0} hours enjoying your games on Ludix.',
        noStats: 'There are no game statistics yet.',
        noStatsHint: 'Start any game to start seeing your activity here!',
        weeklyReport: '📊 Weekly Report',
        launchOnStartup: '🚀 Launch on startup',

        // Weekly report modal
        weeklyTitle: '📊 Weekly Report',
        weeklySubtitle: 'Last 7 days of playtime',
        weeklyNoData: 'No games played in the last 7 days.',
        weeklyTotal: 'Total this week:',
        weeklyClose: 'Close',
        weeklyHours: '{0}h {1}m',

        // Steam
        searchSteam: 'Search on Steam...',
        noGamesFound: 'No games found.',
        loadingSteam: 'Loading Steam games...',

        // Epic
        epicTitle: 'Epic Games',
        addGame: '+ Add game',
        autoDetect: '🔍 Auto-Detect',
        noEpicGames: 'No Epic games detected yet. Click Auto-Detect!',
        autoDetectTitle: '🔍 Detected Epic Games',
        autoDetectNone: 'No new Epic games detected on this computer.',
        autoDetectFound: '{0} game(s) found! Select which to add:',
        autoDetectAdd: 'Add Selected',
        autoDetectCancel: 'Cancel',

        // Other Games
        tabOther: 'OTHER',
        otherGamesTitle: 'Other Games',
        addOtherGame: '+ Add Game',
        findExe: '🔍 Find EXEs',
        noOtherGames: 'No games added yet. Use the buttons above to add any game!',
        exeSuggestionsTitle: '🔍 EXE/App Finder',
        exeSuggestionsHint: 'Select an executable from common game directories:',
        exeSuggestionsNone: 'No executables found in common game directories.',
        exeSuggestionsUse: 'Use',

        // Add/Edit game modal
        addGameTitle: 'Add Epic Game',
        editGameTitle: 'Edit Game',
        gameName: 'Game Name',
        gameExe: 'Game.exe',
        gameImage: 'Game Image:',
        uploadImage: '📷 Upload Image',
        cancelBtn: 'Cancel',
        addBtn: 'Add',
        saveBtn: 'Save Changes',
        missingData: 'Name and executable path are required.',

        // Game card
        counting: '⏱ Counting time...',
        deleteConfirm: 'Delete {0}?',

        // Status bar
        statusOnline: 'Ludix: Online',
        lastGame: 'Last Game:',
        noneGame: 'None',

        // Settings
        settingsTitle: '⚙️ Settings',
        startupOn: 'Launch on startup: ON',
        startupOff: 'Launch on startup: OFF',

        // Console commands
        cmdUnknown: 'Unknown command. Type "help" for available commands.',
        cmdLangChanged: 'Language changed to English.',
        cmdStartupOn: 'Auto-launch enabled. Ludix will start with Windows.',
        cmdStartupOff: 'Auto-launch disabled.',
        cmdWeeklyOpened: 'Opening weekly report...',
        cmdEpicScanStart: 'Scanning for Epic Games installations...',
        cmdEpicScanDone: 'Epic scan complete. Found {0} new game(s).',

        // Notifications (main.js uses these directly, so keep in sync)
        notifBg: 'Launcher in background',
        notifBgBody: 'I will continue to count your game time from here.',
        notifSession: '🎮 Game session ended!',
        notifSessionBody: 'You have played {0} for {1}. Your total time has been updated.',
    },

    es: {
        // Title bar
        appTitle: 'Ludix Launcher',

        // Tabs
        tabHome: 'PANEL PRINCIPAL',
        tabSteam: 'STEAM',
        tabEpic: 'EPIC GAMES',

        // Home panel
        greetingMorning: 'Buenos días',
        greetingAfternoon: 'Buenas tardes',
        greetingEvening: 'Buenas noches',
        totalHours: 'Has pasado {0} horas disfrutando de tus juegos en Ludix.',
        noStats: 'Todavía no hay estadísticas de juego.',
        noStatsHint: '¡Abre cualquier juego para empezar a ver tu actividad aquí!',
        weeklyReport: '📊 Informe Semanal',
        launchOnStartup: '🚀 Inicio con Windows',

        // Weekly report modal
        weeklyTitle: '📊 Informe Semanal',
        weeklySubtitle: 'Últimos 7 días de juego',
        weeklyNoData: 'No has jugado ningún juego en los últimos 7 días.',
        weeklyTotal: 'Total esta semana:',
        weeklyClose: 'Cerrar',
        weeklyHours: '{0}h {1}m',

        // Steam
        searchSteam: 'Buscar en Steam...',
        noGamesFound: 'No se encontraron juegos.',
        loadingSteam: 'Cargando juegos de Steam...',

        // Epic
        epicTitle: 'Epic Games',
        addGame: '+ Añadir juego',
        autoDetect: '🔍 Auto-Detectar',
        noEpicGames: 'No se detectaron juegos Epic. ¡Pulsa Auto-Detectar!',
        autoDetectTitle: '🔍 Juegos Epic Detectados',
        autoDetectNone: 'No se encontraron juegos de Epic nuevos en este ordenador.',
        autoDetectFound: '¡{0} juego(s) encontrado(s)! Selecciona cuáles añadir:',
        autoDetectAdd: 'Añadir Seleccionados',
        autoDetectCancel: 'Cancelar',

        // Other Games
        tabOther: 'OTROS',
        otherGamesTitle: 'Otros Juegos',
        addOtherGame: '+ Añadir Juego',
        findExe: '🔍 Buscar EXEs',
        noOtherGames: '¡No hay juegos añadidos. Usa los botones de arriba para añadir cualquier juego!',
        exeSuggestionsTitle: '🔍 Buscador de EXE/App',
        exeSuggestionsHint: 'Selecciona un ejecutable de los directorios de juegos comunes:',
        exeSuggestionsNone: 'No se encontraron ejecutables en los directorios comunes.',
        exeSuggestionsUse: 'Usar',

        // Add/Edit game modal
        addGameTitle: 'Añadir Juego Epic',
        editGameTitle: 'Editar Juego',
        gameName: 'Nombre del juego',
        gameExe: 'Juego.exe',
        gameImage: 'Imagen del juego:',
        uploadImage: '📷 Subir Imagen',
        cancelBtn: 'Cancelar',
        addBtn: 'Añadir',
        saveBtn: 'Guardar Cambios',
        missingData: 'El nombre y la ruta del ejecutable son obligatorios.',

        // Game card
        counting: '⏱ Contando tiempo...',
        deleteConfirm: '¿Eliminar {0}?',

        // Status bar
        statusOnline: 'Ludix: En línea',
        lastGame: 'Último juego:',
        noneGame: 'Ninguno',

        // Settings
        settingsTitle: '⚙️ Ajustes',
        startupOn: 'Inicio automático: ACTIVADO',
        startupOff: 'Inicio automático: DESACTIVADO',

        // Console commands
        cmdUnknown: 'Comando desconocido. Escribe "help" para ver los comandos disponibles.',
        cmdLangChanged: 'Idioma cambiado a Español.',
        cmdStartupOn: 'Inicio automático activado. Ludix arrancará con Windows.',
        cmdStartupOff: 'Inicio automático desactivado.',
        cmdWeeklyOpened: 'Abriendo informe semanal...',
        cmdEpicScanStart: 'Buscando instalaciones de Epic Games...',
        cmdEpicScanDone: 'Búsqueda Epic completada. {0} juego(s) nuevo(s) encontrado(s).',

        // Notifications
        notifBg: 'Launcher en segundo plano',
        notifBgBody: 'Seguiré contando tu tiempo de juego desde aquí.',
        notifSession: '🎮 ¡Sesión de juego finalizada!',
        notifSessionBody: 'Has jugado {0} durante {1}. Tu tiempo total ha sido actualizado.',
    }
};

// ── Core functions ──────────────────────────────────

let _currentLang = localStorage.getItem('ludix_lang') || 'en';

function getLanguage() {
    return _currentLang;
}

function setLanguage(lang) {
    if (!TRANSLATIONS[lang]) return;
    _currentLang = lang;
    localStorage.setItem('ludix_lang', lang);
    applyTranslations();
    // Notify the rest of the app
    document.dispatchEvent(new CustomEvent('lang-changed', { detail: { lang } }));
}

/**
 * Get a translated string. Supports {0}, {1} ... placeholders.
 * @param {string} key
 * @param {...string} args
 */
function t(key, ...args) {
    const dict = TRANSLATIONS[_currentLang] || TRANSLATIONS['en'];
    let str = dict[key] || TRANSLATIONS['en'][key] || key;
    args.forEach((arg, i) => { str = str.replace(`{${i}}`, arg); });
    return str;
}

/**
 * Apply translations to all elements with data-i18n attribute.
 */
function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const attr = el.getAttribute('data-i18n-attr');
        if (attr) {
            el.setAttribute(attr, t(key));
        } else {
            el.textContent = t(key);
        }
    });

    // Update language toggle button active state
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === _currentLang);
    });
}
