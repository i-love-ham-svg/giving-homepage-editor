Option Explicit

Dim shell, fileSystem, workspacePath, command
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

workspacePath = fileSystem.GetParentFolderName(fileSystem.GetParentFolderName(WScript.ScriptFullName))
command = "cmd.exe /c " & Chr(34) & Chr(34) & workspacePath & "\open-editor.cmd" & Chr(34) & " --no-open" & Chr(34)

shell.CurrentDirectory = workspacePath
shell.Run command, 0, False
