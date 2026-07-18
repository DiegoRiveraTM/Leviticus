import { createContext, useContext } from "react";

export type Lang = "es" | "en";

// diccionario UI: cada clave tiene su texto en español e inglés
const STRINGS = {
  // barra de título
  "tip.runFile": { es: "Ejecutar archivo actual", en: "Run current file" },
  "tip.runProject": {
    es: "Correr proyecto (npm install + dev)",
    en: "Run project (npm install + dev)",
  },
  "tip.menu": { es: "Menú", en: "Menu" },
  "menu.save": { es: "Guardar archivo", en: "Save file" },
  "menu.git": { es: "Git · subir a GitHub", en: "Git · push to GitHub" },
  "menu.devops": { es: "DevOps · Docker, CI/CD", en: "DevOps · Docker, CI/CD" },
  "menu.preview": { es: "Vista previa del servidor", en: "Server preview" },
  "menu.openTerm": { es: "Abrir terminal", en: "Open terminal" },
  "menu.closeTerm": { es: "Cerrar terminal", en: "Close terminal" },
  "menu.theme": { es: "Tema", en: "Theme" },
  "theme.azul": { es: "Azul espacial", en: "Space blue" },
  "theme.negro": { es: "Negro", en: "Black" },
  "theme.rojo": { es: "Rojo oscuro", en: "Dark red" },
  "menu.language": { es: "Idioma", en: "Language" },
  "tip.fullscreen": { es: "Pantalla completa (F11)", en: "Fullscreen (F11)" },
  "tip.minimize": { es: "Minimizar", en: "Minimize" },
  "tip.maximize": { es: "Maximizar", en: "Maximize" },
  "tip.close": { es: "Cerrar", en: "Close" },

  // sidebar
  "tip.explorer": { es: "Explorador", en: "Explorer" },
  "tip.search": {
    es: "Buscar en el proyecto (Ctrl+Shift+F)",
    en: "Search in project (Ctrl+Shift+F)",
  },

  // pestañas / editor
  "tip.closeTab": { es: "Cerrar (Ctrl+W)", en: "Close (Ctrl+W)" },
  "tip.mdPreview": { es: "Vista previa de Markdown", en: "Markdown preview" },
  "editor.empty": {
    es: "Abre un archivo para empezar a editar",
    en: "Open a file to start editing",
  },

  // terminal
  "tip.newTerm": { es: "Nueva terminal", en: "New terminal" },
  "tip.closeTermTab": { es: "Cerrar terminal", en: "Close terminal" },
  "tip.hideTermPanel": {
    es: "Cerrar panel de terminal (las sesiones siguen vivas)",
    en: "Close terminal panel (sessions stay alive)",
  },

  // barra de estado
  "status.unsaved": { es: "● sin guardar", en: "● unsaved" },
  "tip.autosave": { es: "Autoguardado", en: "Autosave" },
  "tip.glass": { es: "Opacidad del vidrio", en: "Glass opacity" },

  // modales genéricos
  "common.cancel": { es: "Cancelar", en: "Cancel" },
  "common.close": { es: "Cerrar", en: "Close" },
  "notice.title": { es: "Aviso", en: "Notice" },
  "notice.ok": { es: "Entendido", en: "Got it" },

  // cierre con cambios
  "unsaved.title": { es: "Cambios sin guardar", en: "Unsaved changes" },
  "unsaved.body": {
    es: "Tienes archivos con cambios sin guardar. ¿Qué quieres hacer?",
    en: "You have files with unsaved changes. What do you want to do?",
  },
  "unsaved.saveExit": { es: "Guardar todo y salir", en: "Save all and exit" },
  "unsaved.exit": { es: "Salir sin guardar", en: "Exit without saving" },

  // herramienta faltante
  "tool.title": { es: "Herramienta no encontrada", en: "Tool not found" },
  "tool.body1": { es: "Para ejecutar este archivo necesitas", en: "To run this file you need" },
  "tool.body2": {
    es: "y no está instalado en tu sistema.",
    en: "and it isn't installed on your system.",
  },
  "tool.download": { es: "Descargar", en: "Download" },

  // git
  "git.notRepo": {
    es: "Esta carpeta todavía no es un repositorio de Git.",
    en: "This folder isn't a Git repository yet.",
  },
  "git.init": { es: "Inicializar repositorio", en: "Initialize repository" },
  "git.history": { es: "Historial de commits", en: "Commit history" },
  "git.back": { es: "← Volver", en: "← Back" },
  "git.noCommits": { es: "Sin commits todavía.", en: "No commits yet." },
  "git.sensTitle": {
    es: "⚠ Información sensible detectada",
    en: "⚠ Sensitive information detected",
  },
  "git.sensBody": {
    es: "Estos archivos parecen contener credenciales y estaban por entrar al commit:",
    en: "These files look like they contain credentials and were about to be committed:",
  },
  "git.sensExclude": { es: "Excluir y confirmar", en: "Exclude and commit" },
  "git.sensAnyway": { es: "Confirmar de todos modos", en: "Commit anyway" },
  "git.noChanges": { es: "No hay cambios pendientes.", en: "No pending changes." },
  "git.remotePh": {
    es: "URL del repo de GitHub (https://github.com/usuario/repo.git)",
    en: "GitHub repo URL (https://github.com/user/repo.git)",
  },
  "git.msgPh": { es: "Mensaje del commit…", en: "Commit message…" },
  "git.commit": { es: "Confirmar", en: "Commit" },
  "git.push": { es: "Subir a GitHub ↗", en: "Push to GitHub ↗" },
  "git.branchPh": { es: "nombre de la rama nueva…", en: "new branch name…" },
  "git.tipNewBranch": { es: "Crear rama nueva", en: "Create new branch" },
  "git.tipHistory": { es: "Historial de commits", en: "Commit history" },

  // avisos
  "notice.openFileFirst": {
    es: "Abre un archivo primero para poder ejecutarlo.",
    en: "Open a file first so it can be run.",
  },
  "notice.noRunner": {
    es: "No hay un ejecutor configurado para {0}.",
    en: "There is no runner configured for {0}.",
  },
  "notice.openProjectFirst": {
    es: "Abre la carpeta de un proyecto primero.",
    en: "Open a project folder first.",
  },
  "notice.noPkg": {
    es: "No encontré un package.json en la raíz del proyecto. Usa la terminal para correr otros tipos de proyecto.",
    en: "No package.json found at the project root. Use the terminal to run other kinds of projects.",
  },
  "notice.pasteRepoUrl": {
    es: "Pega la URL del repositorio de GitHub (crea uno vacío en github.com/new y copia la URL que termina en .git).",
    en: "Paste the GitHub repository URL (create an empty one at github.com/new and copy the URL ending in .git).",
  },
  "notice.commitFirst": {
    es: "El repositorio todavía no tiene commits: confirma tus cambios antes de hacer push.",
    en: "The repository has no commits yet: commit your changes before pushing.",
  },
  "notice.termBusy": {
    es: "La terminal tiene un proceso en ejecución; el comando se abrió en una terminal nueva.",
    en: "The terminal has a running process; the command was opened in a new terminal.",
  },
  "notice.allSensitive": {
    es: "Todos los archivos seleccionados contenían información sensible; no quedó nada para confirmar. Agrega esos archivos al .gitignore.",
    en: "All selected files contained sensitive information; nothing was left to commit. Add those files to .gitignore.",
  },

  // explorador
  "ft.openFolder": { es: "Abrir carpeta", en: "Open folder" },
  "ft.createProject": { es: "+ Crear carpeta de proyecto", en: "+ Create project folder" },
  "ft.tipNewFile": { es: "Nuevo archivo", en: "New file" },
  "ft.tipNewFolder": { es: "Nueva carpeta", en: "New folder" },
  "ft.tipOpenFolder": { es: "Abrir carpeta", en: "Open folder" },
  "ft.tipCloseProject": { es: "Cerrar proyecto", en: "Close project" },
  "ft.ctxNewFile": { es: "Nuevo archivo…", en: "New file…" },
  "ft.ctxNewFolder": { es: "Nueva carpeta…", en: "New folder…" },
  "ft.ctxRename": { es: "Renombrar…", en: "Rename…" },
  "ft.ctxDelete": { es: "Eliminar (a la papelera)", en: "Delete (to trash)" },
  "ft.phRename": { es: "nuevo nombre…", en: "new name…" },
  "ft.wordFile": { es: "archivo", en: "file" },
  "ft.wordFolder": { es: "carpeta", en: "folder" },
  "ft.in": { es: "en", en: "in" },
  "ft.phNewRoot": { es: "nueva carpeta en", en: "new folder in" },
  "ft.ignoredTip": {
    es: "Ignorado por git (.gitignore)",
    en: "Ignored by git (.gitignore)",
  },

  // confirmación de borrado
  "del.title": { es: "Enviar a la papelera", en: "Send to trash" },
  "del.folderBody": {
    es: "La carpeta y todo su contenido se enviarán a la papelera de Windows.",
    en: "The folder and all its contents will be sent to the Windows recycle bin.",
  },
  "del.fileBody": {
    es: "El archivo se enviará a la papelera de Windows.",
    en: "The file will be sent to the Windows recycle bin.",
  },
  "del.restore": {
    es: "Si te arrepientes, podrás restaurarlo desde ahí.",
    en: "You can restore it from there if you change your mind.",
  },
  "del.confirm": { es: "Enviar a la papelera", en: "Send to trash" },

  // búsqueda / quick open
  "sp.searchPh": { es: "Buscar en el proyecto…", en: "Search in project…" },
  "sp.replacePh": { es: "Reemplazar por…", en: "Replace with…" },
  "sp.replaceAllTip": { es: "Reemplazar todo", en: "Replace all" },
  "sp.results": {
    es: "{0} resultado(s) en {1} archivo(s)",
    en: "{0} result(s) in {1} file(s)",
  },
  "sp.max": { es: " (máx.)", en: " (max)" },
  "sp.noResults": { es: "Sin resultados", en: "No results" },
  "sp.searching": { es: "Buscando…", en: "Searching…" },
  "sp.openProject": {
    es: "Abre un proyecto para buscar en sus archivos.",
    en: "Open a project to search its files.",
  },
  "sp.done": { es: "✓ {0} reemplazo(s) hechos", en: "✓ {0} replacement(s) made" },
  "sp.confirm": {
    es: "¿Reemplazar {0} coincidencia(s) de \"{1}\" por \"{2}\" en todo el proyecto?",
    en: "Replace {0} match(es) of \"{1}\" with \"{2}\" across the whole project?",
  },
  "qo.ph": { es: "buscar archivo por nombre…", en: "search file by name…" },
  "qo.empty": { es: "Sin coincidencias", en: "No matches" },

  // devops
  "dv.analyzing": { es: "Analizando el proyecto…", en: "Analyzing project…" },
  "dv.close": { es: "Cerrar", en: "Close" },
  "dv.installed": { es: "instalado", en: "installed" },
  "dv.download": { es: "Descargar", en: "Download" },
  "dv.dockerDetected": { es: "· Dockerfile detectado", en: "· Dockerfile detected" },
  "dv.noManifests": { es: "· sin manifests", en: "· no manifests" },
  "dv.k8sFolder": { es: "· carpeta", en: "· folder" },
  "dv.tfDetected": { es: "· archivos .tf detectados", en: "· .tf files detected" },
  "dv.noTf": { es: "· sin archivos .tf", en: "· no .tf files" },
  "dv.noWorkflows": { es: "· sin workflows", en: "· no workflows" },
  "dv.noGitignore": { es: "Proyecto · sin .gitignore", en: "Project · no .gitignore" },
  "dv.gen": { es: "+ Generar", en: "+ Generate" },
  "dv.exists": {
    es: "{0} ya existe; no lo sobrescribí.",
    en: "{0} already exists; it wasn't overwritten.",
  },
  "dv.created": { es: "✓ {0} creado en {1}", en: "✓ {0} created at {1}" },

  // popup de documentación
  "docs.title": { es: "¿Atorado con {0}?", en: "Stuck with {0}?" },
  "docs.body": {
    es: "Llevas un rato sin escribir. Quizá esto ayude:",
    en: "You haven't typed in a while. Maybe this helps:",
  },
  "docs.open": { es: "Documentación de {0} ↗", en: "{0} documentation ↗" },
  "docs.search": { es: "Buscar «{0}» ↗", en: "Search “{0}” ↗" },
  "docs.dismiss": { es: "No volver a mostrar", en: "Don't show again" },
} as const;

export type StrKey = keyof typeof STRINGS;

export function translate(lang: Lang, key: StrKey, ...args: string[]): string {
  let s: string = STRINGS[key][lang];
  args.forEach((a, i) => {
    s = s.replace(`{${i}}`, a);
  });
  return s;
}

interface I18n {
  lang: Lang;
  t: (key: StrKey, ...args: string[]) => string;
}

export const I18nContext = createContext<I18n>({
  lang: "es",
  t: (key, ...args) => translate("es", key, ...args),
});

export function useT(): I18n {
  return useContext(I18nContext);
}
