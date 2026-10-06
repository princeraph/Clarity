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
  !insertmacro clarityLanguage
  ${if} ${isUpdated}
    SetSilent normal
  ${endif}
!macroend

; The installer speaks the language chosen in Clarity: the app writes it to
; locale.txt in its profile folder on every change (electron/main.js). With no
; such file — a first install — it follows Windows' language, and English when
; Windows speaks neither (the first language in package.json's
; installerLanguages). Read from the current user's profile even for an
; installation for everyone, which switches $APPDATA to ProgramData.
!macro clarityLanguage
  SetShellVarContext current
  ClearErrors
  FileOpen $0 "$APPDATA\${PRODUCT_NAME}\locale.txt" r
  ${ifNot} ${Errors}
    FileRead $0 $1 5
    FileClose $0
    StrCpy $1 $1 2
    ${if} $1 == "fr"
      StrCpy $LANGUAGE 1036
    ${elseif} $1 == "en"
      StrCpy $LANGUAGE 1033
    ${endif}
  ${endif}
  ${if} $installMode == "all"
    SetShellVarContext all
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
