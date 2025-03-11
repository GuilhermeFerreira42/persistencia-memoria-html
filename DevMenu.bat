@echo off
setlocal enabledelayedexpansion

goto menu_principal

:menu_principal
cls
echo Diretorio atual: %cd%
echo =====================================
echo MENU PRINCIPAL
echo =====================================
echo 1. Abrir no VS Code
echo 2. Atualizar Git
echo 3. Executar Script Python
echo 4. Sair
echo =====================================
set /p escolha="Escolha uma opcao: "

if "%escolha%"=="1" goto abrir_vscode
if "%escolha%"=="2" goto atualizar_git
if "%escolha%"=="3" goto executar_python
if "%escolha%"=="4" goto fim
goto menu_principal

:abrir_vscode
cls
echo Abrindo no VS Code...
start "" cmd /c "code . && exit /b 0"
echo.
echo VS Code aberto. Pressione qualquer tecla para voltar ao menu principal...
pause >nul
goto menu_principal

:atualizar_git
cd /d %~dp0
cls
echo Diretorio atual: %cd%
echo =====================================
echo GIT AUTOMATION MENU
echo =====================================
echo 1. Verificar status do repositorio
echo 2. Adicionar todas as alteracoes
echo 3. Fazer commit
echo 4. Fazer push para o GitHub
echo 5. Fazer pull do repositorio
echo 6. Mostrar log de commits
echo 7. Outras opcoes
echo 8. Voltar ao menu principal
echo =====================================
set /p escolha="Escolha uma opcao: "

if "%escolha%"=="1" goto status
if "%escolha%"=="2" goto add
if "%escolha%"=="3" goto commit
if "%escolha%"=="4" goto push
if "%escolha%"=="5" goto pull
if "%escolha%"=="6" goto log
if "%escolha%"=="7" goto outras_opcoes
if "%escolha%"=="8" goto menu_principal
goto atualizar_git

:status
echo Verificando o status do repositorio...
git status
pause
goto atualizar_git

:add
echo Adicionando todas as alteracoes...
git add .
pause
goto atualizar_git

:commit
set /p comentario="Digite o comentario do commit: "
git commit -m "%comentario%"
pause
goto atualizar_git

:push
echo Fazendo push para o GitHub...
git push
pause
goto atualizar_git

:pull
echo Fazendo pull do repositorio...
git pull
pause
goto atualizar_git

:log
echo Mostrando log de commits...
git log
pause
goto atualizar_git

:outras_opcoes
cls
echo Outras opcoes
echo =====================================
echo 1. Restaurar arquivos deletados
echo 2. Sincronizar com repositorio
echo 3. Fazer fetch do repositorio
echo 4. Fazer merge de branches
echo 5. Inicializar um novo repositorio (git init)
echo 6. Desfazer alteracoes (git reset)
echo 7. Listar branches (git branch)
echo 8. Voltar ao menu Git
echo =====================================
set /p escolha_outras="Escolha uma opcao: "

if "%escolha_outras%"=="1" goto restaurar
if "%escolha_outras%"=="2" goto sincronizar
if "%escolha_outras%"=="3" goto fetch
if "%escolha_outras%"=="4" goto merge
if "%escolha_outras%"=="5" goto init
if "%escolha_outras%"=="6" goto reset
if "%escolha_outras%"=="7" goto branch
if "%escolha_outras%"=="8" goto atualizar_git
goto outras_opcoes

:restaurar
echo Restaurando arquivos deletados...
git checkout -- .
pause
goto outras_opcoes

:sincronizar
echo Sincronizando com repositorio...
git fetch origin
pause
goto outras_opcoes

:fetch
echo Fazendo fetch do repositorio...
git fetch
pause
goto outras_opcoes

:merge
echo Fazendo merge de branches...
git merge
pause
goto outras_opcoes

:init
echo Inicializando um novo repositorio...
git init
pause
goto outras_opcoes

:reset
echo Desfazendo alteracoes...
git reset
pause
goto outras_opcoes

:branch
echo Listando branches...
git branch
pause
goto outras_opcoes

:executar_python
setlocal enabledelayedexpansion
for /f "delims=" %%P in ('where python 2^>nul') do (
    set "python_path=%%P"
    goto :list_files
)

if not defined python_path (
    echo Python nao encontrado no sistema!
    pause
    goto menu_principal
)

:list_files
cd /d %~dp0
set "counter=0"
echo.
echo Arquivos Python encontrados:
for %%i in (*.py) do (
    set /a counter+=1
    set "file_!counter!=%%i"
    echo [!counter!] %%i
)

if %counter% equ 0 (
    echo Nenhum arquivo Python encontrado neste diretorio.
    pause
    goto menu_principal
)

echo.
set /p "file_num=Digite o numero do arquivo que deseja executar: "
set /a file_num=%file_num%
for /l %%n in (1,1,%counter%) do (
    if %%n equ %file_num% (
        echo Executando: !file_%%n!
        "%python_path%" "!file_%%n!"
        echo.
        echo Pressione qualquer tecla para voltar ao menu principal...
        pause >nul
    )
)
endlocal
goto menu_principal

:fim
echo Saindo...
pause
exit