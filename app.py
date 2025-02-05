from flask import Flask, render_template, request, jsonify, Response
import json
from datetime import datetime
import requests
from backend.database.database import init_db, get_db
from backend.utils.chat_history import save_conversation, get_conversation_history
from backend.utils.text_processor import split_text
from backend.routers.chats import chats_bp
from backend.models.conversations import Conversation
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static')
app.secret_key = 'sua_chave_secreta_aqui'

init_db()
app.register_blueprint(chats_bp, url_prefix='/api/chats')

API_URL = "http://localhost:11434/v1/chat/completions"
MODEL_NAME = "gemma2:2b"

@app.route('/')
def home():
    try:
        logger.debug("Iniciando carregamento do histórico de conversas...")
        conversations = get_conversation_history()
        logger.debug(f"Histórico carregado com sucesso: {len(conversations)} conversas encontradas")
        logger.debug(f"Dados das conversas: {json.dumps(conversations, indent=2)}")
        return render_template('index.html', conversations=conversations)
    except Exception as e:
        logger.error(f"Erro ao carregar histórico de conversas: {str(e)}", exc_info=True)
        return render_template('index.html', conversations=[])

@app.route('/send_message', methods=['POST'])
def send_message():
    try:
        data = request.json
        message = data.get('message', '')
        conversation_id = data.get('conversation_id')
        
        logger.debug(f"Recebida mensagem para conversation_id: {conversation_id}")
        logger.debug(f"Conteúdo da mensagem: {message}")

        if not conversation_id:
            logger.debug("Criando nova conversa...")
            conversation = Conversation(title="Nova Conversa")
            with get_db() as db:
                db.add(conversation)
                db.commit()
                conversation_id = conversation.id
                logger.debug(f"Nova conversa criada com ID: {conversation_id}")

        def generate_streamed_response():
            accumulated_response = ""
            for part in process_with_ai_stream(message):
                accumulated_response += part
                yield f"data: {json.dumps({'content': part})}\n\n"
            
            logger.debug(f"Salvando conversa {conversation_id}")
            logger.debug(f"Mensagem do usuário: {message}")
            logger.debug(f"Resposta acumulada: {accumulated_response}")
            
            saved_id = save_conversation(message, accumulated_response, conversation_id)
            logger.debug(f"Conversa salva com ID: {saved_id}")

        response = Response(generate_streamed_response(), content_type="text/event-stream")
        response.headers['Cache-Control'] = 'no-cache'
        return response

    except Exception as e:
        logger.error(f"Erro ao processar mensagem: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

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
