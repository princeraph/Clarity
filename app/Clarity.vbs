Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = WshShell.ExpandEnvironmentStrings("%USERPROFILE%\Personal-Work\projet-clarity\app")
WshShell.Run "cmd /c npm start", 0, False
