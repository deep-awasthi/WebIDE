/**
 * JudgeService - Connected exclusively to Wandbox Open API (Free forever, no keys).
 */
const JudgeService = {
  // Utility: helper to merge multiple Java files into a single context
  // Strips package declarations and converts all classes to package-private to allow single-file compilation in Wandbox
  mergeAndFormatJavaFiles(files, mainClassFile) {
    let mainContent = files[mainClassFile] || "";
    let merged = mainContent;

    for (const [fileName, content] of Object.entries(files)) {
      if (fileName === mainClassFile) continue;
      
      // Clean package declarations from secondary files
      let cleanContent = content.replace(/package\s+[\w.]+;/g, "");
      merged += "\n\n" + cleanContent;
    }

    // Strip ALL public modifiers from class/interface/enum/record declarations
    // Java requires public classes to reside in matching filenames. Since Wandbox executes prog.java, 
    // all classes compiled within this context must be package-private.
    return merged.replace(/\bpublic\s+(class|interface|enum|record)\b/g, "$1");
  },

  /**
   * Main execute command using Wandbox
   */
  async execute({ files, mainClass, stdin, onStatusUpdate }) {
    const mainClassFile = `${mainClass}.java`;
    if (!files[mainClassFile]) {
      throw new Error(`Main class file "${mainClassFile}" not found in project workspace.`);
    }

    onStatusUpdate({ status: "Preparing compilation context..." });

    // Merge multi-files and strip public modifiers
    const processedCode = this.mergeAndFormatJavaFiles(files, mainClassFile);

    const payload = {
      compiler: "openjdk-jdk-22+36",
      code: processedCode,
      codes: [],
      stdin: stdin
    };

    onStatusUpdate({ status: "Compiling and running code on Wandbox API..." });

    const response = await fetch("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Wandbox compilation server returned HTTP status: ${response.status}`);
    }

    const result = await response.json();
    
    // Parse result outputs:
    // status: "0" indicates success, other status values imply compiler or program exit error codes.
    const stdout = result.program_output || result.program_message || "";
    const stderr = result.program_error || "";
    const compileError = result.compiler_error || result.compiler_message || "";

    return {
      stdout: stdout,
      stderr: stderr,
      compileError: compileError,
      time: null, // Wandbox does not output execution duration details in standard responses
      memory: null,
      status: result.status === "0" ? "Success" : "Runtime Error",
      statusId: result.status === "0" ? 3 : 11
    };
  }
};
