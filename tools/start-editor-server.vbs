Option Explicit

Dim shell, nodePath, scriptPath, command
Set shell = CreateObject("WScript.Shell")

nodePath = "C:\Users\i-lov\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
scriptPath = "C:\Users\i-lov\Documents\Codex\2026-07-03\3\tools\start-editor-server.mjs"
command = Chr(34) & nodePath & Chr(34) & " " & Chr(34) & scriptPath & Chr(34) & " 4185"

shell.CurrentDirectory = "C:\Users\i-lov\Documents\Codex\2026-07-03\3"
shell.Run command, 0, False
