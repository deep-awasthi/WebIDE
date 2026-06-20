/**
 * Java IDE - Main Controller Application (GFG Style Refactored)
 */

// Global State
let editorInstance = null;
let currentActiveFile = "Main.java";
let virtualFiles = {};
let openTabs = ["Main.java"];
let currentRunningController = null;

// Default starter program displaying stdin Scanner capabilities
const DEFAULT_WORKSPACE = {
  "Main.java": `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Java IDE!");
        System.out.println("This is a minimal online compiler executing on Wandbox API.");
        
        // Stdin input scanner test
        Scanner scanner = new Scanner(System.in);
        System.out.print("Enter your name: ");
        if (scanner.hasNextLine()) {
            String name = scanner.nextLine();
            System.out.println("Hello, " + name + "! Welcome.");
        } else {
            System.out.println("No input provided in the Custom Input panel.");
        }
        scanner.close();
    }
}`
};

// ----------------------------------------------------
// 1. Initial Setup and Load State
// ----------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  loadWorkspace();
  initUIListeners();
  updateConnectionStatus();
  
  // Load Monaco Editor
  initMonaco();
});

// Load files from localStorage
function loadWorkspace() {
  const savedFiles = localStorage.getItem("java_ide_vfs");
  if (savedFiles) {
    try {
      virtualFiles = JSON.parse(savedFiles);
    } catch (e) {
      console.error("Error reading saved VFS, resetting...", e);
      virtualFiles = { ...DEFAULT_WORKSPACE };
    }
  } else {
    virtualFiles = { ...DEFAULT_WORKSPACE };
  }

  // Active File validation
  const savedActive = localStorage.getItem("java_ide_active_file");
  if (savedActive && virtualFiles[savedActive]) {
    currentActiveFile = savedActive;
  } else {
    currentActiveFile = Object.keys(virtualFiles)[0] || "Main.java";
  }

  // Open tabs validation
  const savedTabs = localStorage.getItem("java_ide_open_tabs");
  if (savedTabs) {
    try {
      openTabs = JSON.parse(savedTabs).filter(t => virtualFiles[t]);
    } catch (e) {
      openTabs = [currentActiveFile];
    }
  }
  if (openTabs.length === 0) {
    openTabs = [currentActiveFile];
  }

  // Main entry class validation
  let mainClass = localStorage.getItem("java_ide_main_class") || "Main";
  if (!virtualFiles[`${mainClass}.java`]) {
    let found = false;
    for (const [name, content] of Object.entries(virtualFiles)) {
      if (content.includes("public static void main")) {
        mainClass = name.replace(".java", "");
        found = true;
        break;
      }
    }
    if (!found) {
      mainClass = currentActiveFile.replace(".java", "");
    }
  }
  localStorage.setItem("java_ide_main_class", mainClass);

  updateMainClassDropdown();
}

function saveWorkspace() {
  localStorage.setItem("java_ide_vfs", JSON.stringify(virtualFiles));
  localStorage.setItem("java_ide_active_file", currentActiveFile);
  localStorage.setItem("java_ide_open_tabs", JSON.stringify(openTabs));
}

// ----------------------------------------------------
// 2. Monaco Editor Initialization
// ----------------------------------------------------
function initMonaco() {
  const editorTarget = document.getElementById("editor-target");
  editorTarget.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted);">
      <div style="border: 4px solid var(--border-color); border-left-color: var(--accent-primary); border-radius: 50%; width: 32px; height: 32px; animation: spin 1s linear infinite; margin-bottom: 12px;"></div>
      <p style="font-size:0.85rem;">Loading Code Editor...</p>
    </div>
    <style>
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
  `;

  // Configure CDN AMD paths
  require.config({ 
    paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs' } 
  });

  require(['vs/editor/editor.main'], function () {
    editorTarget.innerHTML = "";

    // Create Monaco models for all virtual files
    for (const [fileName, content] of Object.entries(virtualFiles)) {
      createMonacoModel(fileName, content);
    }

    // Initialize editor
    editorInstance = monaco.editor.create(editorTarget, {
      model: monaco.editor.getModel(monaco.Uri.file(currentActiveFile)),
      theme: "vs-dark",
      fontSize: 14,
      fontFamily: "'Fira Code', 'Courier New', Courier, monospace",
      minimap: { enabled: false },
      automaticLayout: true,
      lineHeight: 22,
      scrollbar: {
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8
      },
      padding: { top: 12, bottom: 12 }
    });

    // Content change event
    editorInstance.onDidChangeModelContent(() => {
      if (currentActiveFile) {
        const value = editorInstance.getValue();
        virtualFiles[currentActiveFile] = value;
        saveWorkspace();
      }
    });

    // Run Shortcut binding: Cmd+Enter or Ctrl+Enter
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runCurrentCode();
    });

    refreshTabs();
    showToast("Java Editor engine initialized", "success");
  });
}

function createMonacoModel(fileName, content) {
  const uri = monaco.Uri.file(fileName);
  let model = monaco.editor.getModel(uri);
  if (!model) {
    model = monaco.editor.createModel(content, 'java', uri);
  } else {
    model.setValue(content);
  }
}

function destroyMonacoModel(fileName) {
  const uri = monaco.Uri.file(fileName);
  const model = monaco.editor.getModel(uri);
  if (model) {
    model.dispose();
  }
}

// ----------------------------------------------------
// 3. Virtual File System / Workspace UI Actions
// ----------------------------------------------------
function updateMainClassDropdown() {
  const dropdown = document.getElementById("main-class-dropdown");
  dropdown.innerHTML = "";
  
  const mainClass = localStorage.getItem("java_ide_main_class") || "Main";
  
  Object.keys(virtualFiles).sort().forEach(fileName => {
    const className = fileName.replace(".java", "");
    const opt = document.createElement("option");
    opt.value = className;
    opt.textContent = className;
    opt.selected = className === mainClass;
    dropdown.appendChild(opt);
  });
}

function openFile(fileName) {
  if (!virtualFiles[fileName]) return;
  currentActiveFile = fileName;
  
  if (!openTabs.includes(fileName)) {
    openTabs.push(fileName);
  }

  saveWorkspace();
  
  if (editorInstance) {
    const model = monaco.editor.getModel(monaco.Uri.file(fileName));
    if (model) {
      editorInstance.setModel(model);
    }
  }

  refreshTabs();
}

function refreshTabs() {
  const container = document.getElementById("tabs-container");
  container.innerHTML = "";

  const mainClass = localStorage.getItem("java_ide_main_class") || "Main";

  openTabs.forEach(fileName => {
    const isActive = fileName === currentActiveFile;
    const isMain = fileName === `${mainClass}.java`;
    
    const tab = document.createElement("div");
    tab.className = `tab ${isActive ? "active" : ""}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", isActive);
    
    tab.innerHTML = `
      <i data-lucide="file-code" style="width:14px;height:14px;color:${isMain ? 'var(--accent-success)' : 'var(--accent-indigo)'};"></i>
      <span class="tab-filename" style="${isMain ? 'font-weight:600;' : ''}">${fileName}</span>
      ${isActive ? `
        <span class="tab-actions-trigger" title="File Operations" style="display:flex;align-items:center;padding:0 2px;">
          <i data-lucide="more-vertical" style="width:12px;height:12px;"></i>
        </span>
      ` : ''}
      <span class="tab-close" data-file="${fileName}">
        <i data-lucide="x" style="width:10px;height:10px;"></i>
      </span>
    `;

    // Click tab to activate file
    tab.addEventListener("click", (e) => {
      if (e.target.closest(".tab-close") || e.target.closest(".tab-actions-trigger")) return;
      openFile(fileName);
    });

    // Tab actions context trigger
    if (isActive) {
      tab.querySelector(".tab-actions-trigger").addEventListener("click", (e) => {
        e.stopPropagation();
        toggleTabContextMenu(e.currentTarget, fileName);
      });
    }

    // Close tab action
    tab.querySelector(".tab-close").addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(fileName);
    });

    container.appendChild(tab);
  });

  lucide.createIcons();
}

// Inline tab menu utility
function toggleTabContextMenu(triggerElem, fileName) {
  let oldMenu = document.getElementById("tab-context-menu");
  if (oldMenu) {
    oldMenu.remove();
    if (oldMenu.dataset.file === fileName) return;
  }

  const rect = triggerElem.getBoundingClientRect();
  const menu = document.createElement("div");
  menu.id = "tab-context-menu";
  menu.dataset.file = fileName;
  
  menu.style.position = "fixed";
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left}px`;
  menu.style.background = "var(--bg-panel)";
  menu.style.border = "1px solid var(--border-color)";
  menu.style.borderRadius = "8px";
  menu.style.boxShadow = "var(--shadow-lg)";
  menu.style.padding = "6px";
  menu.style.zIndex = "1000";
  menu.style.display = "flex";
  menu.style.flexDirection = "column";
  menu.style.gap = "2px";

  const isMain = fileName === `${localStorage.getItem("java_ide_main_class")}.java`;

  menu.innerHTML = `
    <button class="context-item" id="ctx-set-main" style="background:transparent;border:none;color:var(--text-main);padding:6px 12px;font-size:0.78rem;text-align:left;cursor:pointer;border-radius:4px;display:flex;align-items:center;gap:6px;width:100%;" ${isMain ? 'disabled style="color:var(--text-dark);cursor:not-allowed;"' : ''}>
      <i data-lucide="play-circle" style="width:12px;height:12px;"></i> Set as Main Entry
    </button>
    <button class="context-item" id="ctx-rename" style="background:transparent;border:none;color:var(--text-main);padding:6px 12px;font-size:0.78rem;text-align:left;cursor:pointer;border-radius:4px;display:flex;align-items:center;gap:6px;width:100%;">
      <i data-lucide="edit-3" style="width:12px;height:12px;"></i> Rename
    </button>
    <button class="context-item" id="ctx-delete" style="background:transparent;border:none;color:var(--accent-danger);padding:6px 12px;font-size:0.78rem;text-align:left;cursor:pointer;border-radius:4px;display:flex;align-items:center;gap:6px;width:100%;">
      <i data-lucide="trash" style="width:12px;height:12px;"></i> Delete
    </button>
  `;

  document.body.appendChild(menu);
  lucide.createIcons();

  menu.querySelectorAll(".context-item").forEach(item => {
    item.addEventListener("mouseenter", (e) => {
      if (!e.currentTarget.disabled) {
        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
      }
    });
    item.addEventListener("mouseleave", (e) => {
      e.currentTarget.style.backgroundColor = "transparent";
    });
  });

  document.getElementById("ctx-set-main").addEventListener("click", () => {
    const nameOnly = fileName.replace(".java", "");
    localStorage.setItem("java_ide_main_class", nameOnly);
    updateMainClassDropdown();
    refreshTabs();
    showToast(`Main entry class set to "${nameOnly}"`, "info");
    menu.remove();
  });

  document.getElementById("ctx-rename").addEventListener("click", () => {
    openRenameModal(fileName);
    menu.remove();
  });

  document.getElementById("ctx-delete").addEventListener("click", () => {
    openDeleteModal(fileName);
    menu.remove();
  });

  const clickOutside = (e) => {
    if (!menu.contains(e.target) && !triggerElem.contains(e.target)) {
      menu.remove();
      document.removeEventListener("click", clickOutside);
    }
  };
  setTimeout(() => {
    document.addEventListener("click", clickOutside);
  }, 10);
}

function closeTab(fileName) {
  openTabs = openTabs.filter(t => t !== fileName);
  
  if (currentActiveFile === fileName && openTabs.length > 0) {
    openFile(openTabs[0]);
  } else if (openTabs.length === 0) {
    const firstFile = Object.keys(virtualFiles)[0] || "Main.java";
    openTabs = [firstFile];
    openFile(firstFile);
  } else {
    refreshTabs();
  }
  saveWorkspace();
}

// ----------------------------------------------------
// 4. Code Runner / Compilation Trigger
// ----------------------------------------------------
async function runCurrentCode() {
  const runBtn = document.getElementById("run-code-btn");
  const stopBtn = document.getElementById("stop-code-btn");
  const terminal = document.getElementById("stdout-terminal");
  const statTime = document.getElementById("stat-time");
  const statMem = document.getElementById("stat-mem");

  if (runBtn.classList.contains("running")) return;

  // Visual state
  runBtn.classList.add("running");
  runBtn.disabled = true;
  runBtn.innerHTML = `<div style="border: 2px solid rgba(7,10,19,0.4); border-left-color: #070a13; border-radius: 50%; width: 12px; height: 12px; animation: spin 1s linear infinite;"></div> Running...`;
  stopBtn.style.display = "flex";
  
  terminal.className = "stdout-terminal";
  terminal.textContent = "Compiling program on Wandbox. Please wait...\n";
  statTime.textContent = "-";
  statMem.textContent = "-";
  updateConnectionStatus("running");

  const mainClass = localStorage.getItem("java_ide_main_class") || "Main";
  const stdin = document.getElementById("stdin-textarea").value;

  currentRunningController = new AbortController();

  try {
    const results = await JudgeService.execute({
      files: virtualFiles,
      mainClass: mainClass,
      stdin: stdin,
      onStatusUpdate: ({ status }) => {
        terminal.textContent = `${status}\n`;
      }
    });

    if (!currentRunningController) return;

    if (results.compileError) {
      terminal.className = "stdout-terminal error";
      terminal.textContent = `[COMPILATION ERROR]\n${results.compileError}`;
      showToast("Compilation error", "error");
      updateConnectionStatus("error");
    } else {
      terminal.className = "stdout-terminal success";
      let log = "";
      if (results.stderr) {
        log += `[STDERR]\n${results.stderr}\n\n`;
      }
      log += results.stdout || "(Code executed successfully with no output to console)";
      terminal.textContent = log;
      
      statTime.textContent = "N/A";
      statMem.textContent = "N/A";
      
      if (results.statusId === 3) {
        showToast("Run complete", "success");
        updateConnectionStatus("online");
      } else {
        showToast(`Finished: ${results.status || "Runtime Error"}`, "warning");
        updateConnectionStatus("online");
      }
    }
  } catch (err) {
    if (!currentRunningController) return;
    terminal.className = "stdout-terminal error";
    terminal.textContent = `[COMPILER ERROR] Execution failed:\n${err.message}`;
    showToast("Execution failed", "error");
    updateConnectionStatus("error");
  } finally {
    currentRunningController = null;
    runBtn.classList.remove("running");
    runBtn.disabled = false;
    runBtn.innerHTML = `<i data-lucide="play" style="width:14px;height:14px;"></i> <span>Run Code</span>`;
    stopBtn.style.display = "none";
    lucide.createIcons();
  }
}

function stopCurrentRun() {
  if (currentRunningController) {
    currentRunningController = null;
    showToast("Execution cancelled", "warning");
    
    const terminal = document.getElementById("stdout-terminal");
    terminal.className = "stdout-terminal empty";
    terminal.textContent = "Execution cancelled.";
    
    const runBtn = document.getElementById("run-code-btn");
    const stopBtn = document.getElementById("stop-code-btn");
    
    runBtn.classList.remove("running");
    runBtn.disabled = false;
    runBtn.innerHTML = `<i data-lucide="play" style="width:14px;height:14px;"></i> <span>Run Code</span>`;
    stopBtn.style.display = "none";
    updateConnectionStatus("online");
    lucide.createIcons();
  }
}

// ----------------------------------------------------
// 5. UI General Event Handlers
// ----------------------------------------------------
function initUIListeners() {
  // Main Class Select Change
  document.getElementById("main-class-dropdown").addEventListener("change", (e) => {
    localStorage.setItem("java_ide_main_class", e.target.value);
    refreshTabs();
    showToast(`Main entry class set to "${e.target.value}"`, "info");
  });

  // Run Code trigger
  document.getElementById("run-code-btn").addEventListener("click", runCurrentCode);
  document.getElementById("stop-code-btn").addEventListener("click", stopCurrentRun);
  
  // Clear stdout console
  document.getElementById("clear-console-btn").addEventListener("click", () => {
    const terminal = document.getElementById("stdout-terminal");
    terminal.className = "stdout-terminal empty";
    terminal.textContent = "Press Run to compile and execute Java code...";
    document.getElementById("stat-time").textContent = "-";
    document.getElementById("stat-mem").textContent = "-";
    showToast("Console cleared", "info");
  });

  // Modal close utility
  document.querySelectorAll(".close-modal-btn").forEach(btn => {
    btn.addEventListener("click", closeModal);
  });

  // Tab Add button triggers
  document.getElementById("add-file-tab-btn").addEventListener("click", () => {
    document.getElementById("new-file-name").value = "";
    openModal("add-file-modal");
    document.getElementById("new-file-name").focus();
  });

  document.getElementById("confirm-add-file").addEventListener("click", handleAddFile);
  
  // Submit modal inputs on Enter
  document.getElementById("new-file-name").addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleAddFile();
  });
}

// ----------------------------------------------------
// 6. Modals Form Handlers (VFS manipulations)
// ----------------------------------------------------
let renameTargetFile = "";
let deleteTargetFile = "";

function openModal(modalId) {
  document.getElementById(modalId).classList.add("active");
}

function closeModal() {
  document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
}

function handleAddFile() {
  let fileName = document.getElementById("new-file-name").value.trim();
  if (!fileName) {
    showToast("Please enter a file name", "warning");
    return;
  }

  if (!fileName.endsWith(".java")) {
    fileName += ".java";
  }

  const className = fileName.replace(".java", "");

  const regex = /^[A-Z][a-zA-Z0-9_]*$/;
  if (!regex.test(className)) {
    showToast("Java class names must start with an uppercase letter.", "warning");
    return;
  }

  if (virtualFiles[fileName]) {
    showToast(`File "${fileName}" already exists in project.`, "warning");
    return;
  }

  const fileContent = `public class ${className} {\n    // Write your code here\n}`;
  virtualFiles[fileName] = fileContent;
  
  createMonacoModel(fileName, fileContent);
  openTabs.push(fileName);
  
  saveWorkspace();
  loadWorkspace();
  openFile(fileName);
  closeModal();
  showToast(`File "${fileName}" created`, "success");
}

function openRenameModal(fileName) {
  renameTargetFile = fileName;
  document.getElementById("rename-file-name").value = fileName;
  openModal("rename-file-modal");
  document.getElementById("rename-file-name").focus();
}

document.getElementById("confirm-rename-file").addEventListener("click", () => {
  let newName = document.getElementById("rename-file-name").value.trim();
  if (!newName) {
    showToast("Please enter a new name", "warning");
    return;
  }
  if (!newName.endsWith(".java")) {
    newName += ".java";
  }
  
  const className = newName.replace(".java", "");
  const regex = /^[A-Z][a-zA-Z0-9_]*$/;
  if (!regex.test(className)) {
    showToast("Java class names must start with an uppercase letter.", "warning");
    return;
  }

  if (newName !== renameTargetFile && virtualFiles[newName]) {
    showToast("A file with this name already exists.", "warning");
    return;
  }

  const oldContent = virtualFiles[renameTargetFile];
  
  delete virtualFiles[renameTargetFile];
  virtualFiles[newName] = oldContent;

  destroyMonacoModel(renameTargetFile);
  createMonacoModel(newName, oldContent);

  openTabs = openTabs.map(t => t === renameTargetFile ? newName : t);
  if (currentActiveFile === renameTargetFile) {
    currentActiveFile = newName;
  }

  const mainClass = localStorage.getItem("java_ide_main_class");
  if (`${mainClass}.java` === renameTargetFile) {
    localStorage.setItem("java_ide_main_class", className);
  }

  saveWorkspace();
  loadWorkspace();
  openFile(currentActiveFile);
  closeModal();
  showToast(`File renamed to "${newName}"`, "success");
});

function openDeleteModal(fileName) {
  deleteTargetFile = fileName;
  document.getElementById("delete-file-target").textContent = fileName;
  openModal("delete-file-modal");
}

document.getElementById("confirm-delete-file").addEventListener("click", () => {
  if (Object.keys(virtualFiles).length <= 1) {
    showToast("Cannot delete the only file in the workspace.", "warning");
    closeModal();
    return;
  }

  delete virtualFiles[deleteTargetFile];
  destroyMonacoModel(deleteTargetFile);

  openTabs = openTabs.filter(t => t !== deleteTargetFile);
  
  const mainClass = localStorage.getItem("java_ide_main_class");
  if (`${mainClass}.java` === deleteTargetFile) {
    const newMain = Object.keys(virtualFiles)[0].replace(".java", "");
    localStorage.setItem("java_ide_main_class", newMain);
  }

  if (currentActiveFile === deleteTargetFile) {
    currentActiveFile = Object.keys(virtualFiles)[0];
  }

  saveWorkspace();
  loadWorkspace();
  openFile(currentActiveFile);
  closeModal();
  showToast(`File "${deleteTargetFile}" deleted`, "success");
});

// ----------------------------------------------------
// 7. Toast Notification System
// ----------------------------------------------------
function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toast-container");
  
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let icon = "info";
  if (type === "success") icon = "check-circle";
  if (type === "error") icon = "alert-triangle";
  if (type === "warning") icon = "alert-circle";

  toast.innerHTML = `
    <i data-lucide="${icon}" style="width: 14px; height: 14px;"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.animation = "toastSlideIn 0.25s ease-in reverse forwards";
    setTimeout(() => {
      toast.remove();
    }, 250);
  }, duration);
}

function updateConnectionStatus(status = "online") {
  const ind = document.getElementById("connection-indicator");
  if (!ind) return;

  if (status === "running") {
    ind.className = "status-indicator running";
    ind.title = "Executing java code on Wandbox API...";
  } else if (status === "error") {
    ind.className = "status-indicator error";
    ind.title = "Connection timed out or compilation failed";
  } else {
    ind.className = "status-indicator online";
    ind.title = "Wandbox API Engine Online (Free Run)";
  }
}
