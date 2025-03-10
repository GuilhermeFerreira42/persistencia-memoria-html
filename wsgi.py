
import eventlet
eventlet.monkey_patch()

from app import app, socketio

# Esta variável será usada pelo Gunicorn ou Eventlet
application = socketio.wsgi_app
