
"""
Arquivo de configuração para o Gunicorn
"""

# Endereço e porta para o servidor
bind = "0.0.0.0:5000"

# Número de processos worker
workers = 1  # Para WebSockets com Flask-SocketIO, o recomendado é 1

# Classe worker para WebSockets
worker_class = "geventwebsocket.gunicorn.workers.GeventWebSocketWorker"

# Tempo limite para processar requisições (em segundos)
timeout = 120  # Aumentado para suportar streaming de respostas longas

# Número máximo de conexões simultâneas
max_requests = 1000
max_requests_jitter = 50

# Logs
accesslog = "access.log"
errorlog = "error.log"
loglevel = "info"

# Modo de depuração (remova em produção)
reload = True
