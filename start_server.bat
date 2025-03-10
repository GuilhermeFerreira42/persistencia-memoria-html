
@echo off
echo Iniciando o servidor NarrateNexus com Eventlet e suporte a WebSockets...
echo Certifique-se de ter instalado as dependencias necessarias:
echo pip install flask flask-socketio eventlet

REM Inicia o servidor usando o arquivo app.py diretamente
python app.py

pause
