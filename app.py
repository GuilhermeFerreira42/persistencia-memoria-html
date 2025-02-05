from flask import Flask, render_template, request, jsonify, Response
import json
from datetime import datetime
import requests
from backend.database.database import init_db
from backend.utils.chat_history import save_conversation, get_conversation_history
from backend.utils.text_processor import split_text
from backend.routers.chats import chats_bp
from backend.models.conversations import Conversation  # Importando o modelo de conversas

app = Flask(__name__, static_folder='static')
app.secret_key = 'sua_chave_secreta_aqui'

# Inicializa o banco de dados
init_db()

# Registra o blueprint das rotas de chat
app.register_blueprint(chats_bp, url_prefix='/api/chats')

API_URL = "http://localhost:11434/v1/chat/completions"
MODEL_NAME = "gemma2:2b"

@app.route('/')
def home():
    conversations = get_conversation_history()
    return render_template('index.html', conversations=conversations)

@app.route('/send_message', methods=['POST'])
def send_message():
    data = request.json
    message = data.get('message', '')
    conversation_id = data.get('conversation_id')

    if len(message.split()) > 300:
        chunks = split_text(message)
        responses = []
        for chunk in chunks:
            response = process_with_ai(chunk)
            responses.append(response)
        final_response = " ".join(responses)
    else:
        final_response = None

    def generate_streamed_response():
        for part in process_with_ai_stream(message):
            yield f"data: {json.dumps({'content': part})}\n\n"

    response = Response(generate_streamed_response(), content_type="text/event-stream")
    response.headers['Cache-Control'] = 'no-cache'

    if final_response is not None:
        if conversation_id is None:  # Verifica se o conversation_id é None
            conversation_id = Conversation.create()  # Gera um novo conversation_id
        conversation_id = save_conversation(message, final_response, conversation_id)

    return response

def process_with_ai(text):
    try:
        payload = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "system", "content": "Você é um assistente útil."},
                {"role": "user", "content": text}
            ],
            "stream": False
        }
        headers = {"Content-Type": "application/json"}
        response = requests.post(API_URL, json=payload, headers=headers)
        response.raise_for_status()

        response_data = response.json()
        if 'choices' in response_data and len(response_data['choices']) > 0:
            return response_data['choices'][0]['message']['content']
        return "Erro: Nenhuma resposta válida recebida da IA."
    except requests.exceptions.RequestException as e:
        print(f"[Debug] Erro na requisição HTTP: {str(e)}")
        return "Ocorreu um erro ao se conectar com a IA."
    except Exception as e:
        print(f"[Debug] Erro inesperado: {str(e)}")
        return "Ocorreu um erro inesperado ao processar sua mensagem."

def process_with_ai_stream(text):
    try:
        payload = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "system", "content": "Você é um assistente útil."},
                {"role": "user", "content": text}
            ],
            "stream": True
        }
        headers = {"Content-Type": "application/json"}
        response = requests.post(API_URL, json=payload, headers=headers, stream=True)
        response.raise_for_status()

        for line in response.iter_lines(decode_unicode=True):
            if line.strip() and line.startswith("data: "):
                line = line[6:].strip()
                try:
                    response_data = json.loads(line)
                    if 'choices' in response_data and len(response_data['choices']) > 0:
                        delta = response_data['choices'][0]['delta']
                        if "content" in delta:
                            content = delta["content"].encode('latin1').decode('utf-8', errors='ignore')
                            yield content
                except json.JSONDecodeError:
                    print(f"[Debug] Erro ao decodificar JSON: {line}")
    except requests.exceptions.RequestException as e:
        print(f"[Debug] Erro na requisição HTTP: {str(e)}")
    except Exception as e:
        print(f"[Debug] Erro inesperado: {str(e)}")

if __name__ == '__main__':
    app.run(debug=True)
