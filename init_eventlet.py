
# Arquivo de inicialização para garantir que o monkey patching do Eventlet
# seja executado antes de qualquer outro import em todo o projeto
import eventlet
eventlet.monkey_patch()
print("[INFO] Eventlet monkey patching aplicado com sucesso.")
