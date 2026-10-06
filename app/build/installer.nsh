; Clarity's additions to the electron-builder installer (picked up from the
; build resources folder by name).
;
; An update installs in a visible window, and closes it by itself. The app
; asks for a silent install (electron-updater passes /S), and it is the
; INSTALLER that overrides it: the app running the update is the old version,
; and its code decides nothing new — the 1.3.1 -> 1.3.2 update showed nothing
; on screen because 1.3.1 had nothing to show. The installer is always the
; new version's, so this applies from the very update that brings it.
;
; A first install is untouched: its wizard is the one on the download page.

!macro customInit
  ${if} ${isUpdated}
    SetSilent normal
  ${endif}
!macroend

; Updating keeps the existing installation (for me / for everyone) without
; asking which one: initMultiUser has already read it from the registry.
!macro customInstallMode
  ${if} ${isUpdated}
    ${if} $installMode == "all"
      StrCpy $isForceMachineInstall "1"
    ${else}
      StrCpy $isForceCurrentInstall "1"
    ${endif}
  ${endif}
!macroend

; The default finish page, except during an update: no "Finish" to click —
; Clarity reopens (when the app asked for it) and the installer closes.
!macro customFinishPage
  Function ClarityStartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  Function ClarityFinishPre
    ${if} ${isUpdated}
      ${if} ${isForceRun}
        Call ClarityStartApp
      ${endif}
      Abort
    ${endif}
  FunctionEnd

  !define MUI_PAGE_CUSTOMFUNCTION_PRE ClarityFinishPre
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "ClarityStartApp"
  !insertmacro MUI_PAGE_FINISH
!macroend
