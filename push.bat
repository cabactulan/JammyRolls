@echo off
setlocal enabledelayedexpansion
title JammyRolls - Auto Git Push

:: Ensure we are in the repository directory
cd /d "%~dp0"

echo ===================================================
echo             JammyRolls - Git Auto Push             
echo ===================================================
echo.

:: Check if Git is installed
git --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Git is not installed or not found in PATH.
    echo Please install Git and try again.
    goto :END
)

:: Show current repository status
echo [1/3] Checking repository status...
echo ---------------------------------------------------
git status -s
echo ---------------------------------------------------
echo.

:: Ask for commit message
set "COMMIT_MSG="
set /p "COMMIT_MSG=Enter commit message (Press Enter for 'Update JammyRolls website'): "
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=Update JammyRolls website"

:: Stage all changes
echo.
echo [2/3] Staging changes...
git add -A

:: Check if there are changes to commit
git diff --cached --quiet
if %ERRORLEVEL% equ 0 (
    echo No new changes to commit - working tree is clean.
) else (
    echo Committing changes with message: "%COMMIT_MSG%"...
    git commit -m "%COMMIT_MSG%"
)

echo.
echo ===================================================
echo  Target: https://github.com/cabactulan/JammyRolls
echo  Branch: main
echo ===================================================
echo.

:: Confirmation prompt
set "CONFIRM="
set /p "CONFIRM=Do you want to push to GitHub now? [Y/N]: "

if /i "%CONFIRM%"=="Y" (
    echo.
    echo [3/3] Pushing to GitHub...
    git push -u origin main
    if !ERRORLEVEL! equ 0 (
        echo.
        echo ===================================================
        echo   SUCCESS: Pushed to GitHub successfully!
        echo ===================================================
    ) else (
        echo.
        echo ===================================================
        echo   [ERROR] Push failed!
        echo   Please verify your GitHub credentials or access permissions.
        echo ===================================================
    )
) else (
    echo.
    echo [CANCELLED] Push cancelled by user.
)

:END
echo.
pause
