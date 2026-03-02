@echo off
cls

:: ================================
:: CONFIGURACAO FIXA
:: ================================
set GIT_NAME=Mockerz
set GIT_EMAIL=sefoda95@gmail.com
set GITHUB_USER=Mockerz
set REPO_NAME=insta-timer-volume-control

:: ================================
:: REMOVE GIT ANTIGO
:: ================================
echo REMOVENDO HISTORICO GIT ANTIGO...
rmdir /s /q .git

:: ================================
:: CONFIG GIT
:: ================================
git config --global user.name "%GIT_NAME%"
git config --global user.email "%GIT_EMAIL%"

:: ================================
:: CRIA .gitignore CORRETO
:: ================================
echo CRIANDO .gitignore...

(
echo .vs/
echo *.ipch
echo *.db
echo *.opendb
echo *.suo
echo *.user
echo *.log
echo bin/
echo obj/
echo Debug/
echo Release/
) > .gitignore

:: ================================
:: INIT LIMPO
:: ================================
git init
git branch -M main

git add .
git commit -m "initial commit (clean)"

:: ================================
:: REMOTE
:: ================================
git remote add origin https://github.com/%GITHUB_USER%/%REPO_NAME%.git

:: ================================
:: PUSH
:: ================================
git push -u origin main --force

echo.
echo ================================
echo PUSH LIMPO FINALIZADO COM SUCESSO
echo ================================
pause
