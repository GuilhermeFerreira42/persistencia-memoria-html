
@echo off
echo Iniciando o servidor NarrateNexus com Eventlet e suporte a WebSockets...
echo Certifique-se de ter instalado as dependencias necessarias:
echo pip install flask flask-socketio eventlet

REM Configuração de variáveis de ambiente (opcional)
REM set FLASK_ENV=development
REM set FLASK_DEBUG=1

REM Inicia o servidor usando Eventlet
python -c "import eventlet; import eventlet.wsgi; from wsgi import application; eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5000)), application)"

pause
