// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "share-keeper" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "share-keeper.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from share-keeper !!!");
    }
  );

  context.subscriptions.push(disposable);

  const cmdSayHi = vscode.commands.registerCommand("share-keeper.sayHi", () => {
    vscode.window.showInformationMessage("Hi from pyaephyowin!");
  });

  context.subscriptions.push(cmdSayHi);

  const cmdCheckSharedComponents = vscode.commands.registerCommand(
    "share-keeper.checkSharedComponents",
    async () => {
      const errors = await getUnstagedChanges();

      const panel = vscode.window.createWebviewPanel(
        "shareKeeper", // Identifies the type of the webview. Used internally
        "Share Keeper", // Title of the panel displayed to the user
        vscode.ViewColumn.One, // Editor column to show the new webview panel in.
        {} // Webview options. More on these later.
      );

      // And set its HTML content
      panel.webview.html = getWebviewContent(errors);
    }
  );

  context.subscriptions.push(cmdCheckSharedComponents);
}

// This method is called when your extension is deactivated
export function deactivate() {}

function getWebviewContent(errors?: Error[]) {
  const totalErrorContent = errors?.flatMap((e) => e.contents).length || 0;
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Share Keeper</title>
</head>
<body>
    ${
      errors && errors?.length > 0
        ? `<img src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" width="300" />`
        : ` <img src="https://media3.giphy.com/media/bqSkJ4IwNcoZG/giphy.gif" width="500" />`
    }

    ${
      errors && errors?.length > 0
        ? `${errors?.length}<h1>You have got ${totalErrorContent} direct imports in ${errors?.length} files</h1>`
        : `
        <div style="border: 1px solid black; padding: 10px;">
        <h1>Good, You have no direct import from next ui.</h1>
        `
    }

    ${errors?.map(
      (err) =>
        `
      <div style="border: 1px solid black; padding: 10px;">
        <h3> ${err.contents.length} direct imports in ${getTrimmedPath(
          err.file
        )}</h3>
        <ul>
        ${err.contents.map((content) => `<li>${content}</li>`).join("")}
        </ul>
        </div>
        `
    )}
</body>
</html>`;
}

async function getGitApi() {
  const gitExtension = vscode.extensions.getExtension("vscode.git");
  if (!gitExtension) {
    return null;
  }

  const gitApi = gitExtension.exports.getAPI(1);
  return gitApi;
}

type Error = { file: string; contents: string[] };

async function getUnstagedChanges() {
  const errors: Error[] = [];
  const gitApi = await getGitApi();
  if (!gitApi) {
    vscode.window.showInformationMessage("Please install Git extension");
    return;
  }

  const repositories = gitApi.repositories;
  for (const repository of repositories) {
    const unstagedChanges = repository.state.workingTreeChanges;

    for (const change of unstagedChanges) {
      // changes in a file
      let error: Error = {
        file: change.uri.fsPath,
        contents: [],
      };
      const filePath = change.uri.fsPath;
      const isReactComponent = reactComponent(filePath);
      const isSharedComponent = sharedComponent(filePath);
      const isSourceFile = sourceFile(filePath);

      if (!isReactComponent || isSharedComponent || !isSourceFile) {
        continue;
      }

      const diff = await repository.diffWithHEAD(filePath);
      const addedLines = parseAddedLines(diff);

      for (const line of addedLines) {
        if (nextUiImport(line)) {
          error.contents.push(line);
        }
      }

      if (error.contents.length > 0) {
        errors.push(error);
      }
    }
  }

  return errors;
}

function parseAddedLines(diff: string): string[] {
  const addedLines: string[] = [];
  const lines = diff.split("\n");

  let isInDiffSection = false;
  for (const line of lines) {
    if (line.startsWith("@@")) {
      isInDiffSection = true;
      continue;
    }

    if (isInDiffSection && line.startsWith("+")) {
      addedLines.push(line);
    }
  }

  return addedLines;
}

function sharedComponent(path: string) {
  const updatedPath = path.replace(/\\/g, "/");
  const componentsPath = "src/components";
  if (updatedPath.includes(componentsPath)) {
    return true;
  }
  return false;
}

function sourceFile(path: string) {
  if (path.includes("src")) {
    return true;
  }
  return false;
}

function reactComponent(path: string) {
  const updatedPath = path.replace(/\\/g, "/");
  if (updatedPath.endsWith(".tsx") || updatedPath.endsWith(".jsx")) {
    return true;
  }
  return false;
}

function nextUiImport(line: string) {
  const prefix = `from "@nextui-org/react"`;
  if (line.includes(prefix)) {
    return true;
  }

  return false;
}

function getTrimmedPath(filePath: string) {
  const srcIndex = filePath.indexOf("src");
  if (srcIndex !== -1) {
    // Extract the substring from "src" to the end
    return filePath.substring(srcIndex);
  } else {
    return filePath;
  }
}
