
from flask import Flask, render_template, request, jsonify, Response
import json
import os
from datetime import datetime
import requests
from utils.text_processor import split_text, clean_and_format_text
from youtube_handler import YoutubeHandler
from utils.chat_storage import (
    create_new_conversation,
    add_message_to_conversation,
    get_conversation_by_id,
    get_conversation_history,
    delete_conversation,
    rename_conversation
)

app = Flask(__name__, static_folder='static')
app.secret_key = 'sua_chave_secreta_aqui'

API_URL = "http://localhost:11434/v1/chat/completions"
MODEL_NAME = "gemma2:2b"
youtube_handler = YoutubeHandler()

@app.route('/')
def home():
    conversations = get_conversation_history()
    return render_template('index.html', conversations=conversations)

@app.route('/get_conversation_history')
def conversation_history():
    conversations = get_conversation_history()
    return jsonify(conversations)

@app.route('/get_conversation/<conversation_id>')
def get_conversation(conversation_id):
    conversation = get_conversation_by_id(conversation_id)
    if conversation:
        return jsonify(conversation)
    return jsonify({'error': 'Conversa não encontrada'}), 404

@app.route('/send_message', methods=['POST'])
def send_message():
    data = request.json
    message = data.get('message', '')
    conversation_id = data.get('conversation_id')

    if not conversation_id:
        conversation_id = create_new_conversation()

    # Salvar mensagem do usuário
    add_message_to_conversation(conversation_id, message, "user")

    # Processar resposta da IA
    accumulated_response = []
    
    def generate_streamed_response():
        for part in process_with_ai_stream(message):
            if part:
                accumulated_response.append(part)
                yield f"data: {json.dumps({'content': part})}\n\n"
        
        # Salvar a resposta completa da IA
        if accumulated_response:
            complete_response = ''.join(accumulated_response)
            add_message_to_conversation(conversation_id, complete_response, "assistant")

    response = Response(generate_streamed_response(), content_type="text/event-stream")
    response.headers['Cache-Control'] = 'no-cache'
    return response

@app.route('/save_message', methods=['POST'])
def save_message():
    try:
        data = request.json
        conversation_id = data.get('conversation_id')
        content = data.get('content')
        role = data.get('role')
        
        if not all([conversation_id, content, role]):
            return jsonify({'error': 'Dados incompletos'}), 400
            
        add_message_to_conversation(conversation_id, content, role)
        return jsonify({'status': 'success'})
    except Exception as e:
        print(f"Erro ao salvar mensagem: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/process_youtube', methods=['POST'])
def process_youtube():
    try:
        data = request.json
        video_url = data.get('video_url')
        conversation_id = data.get('conversation_id')
        comando = data.get('comando')  # Novo: pegar o comando original
        
        if not video_url:
            return jsonify({'error': 'URL não fornecida'}), 400
            
        # Baixar legendas e obter título
        subtitle_file, video_title = youtube_handler.download_subtitles(video_url)
        if not subtitle_file:
            return jsonify({'error': 'Não foi possível baixar as legendas deste vídeo'}), 404
            
        # Limpar legendas
        cleaned_text = youtube_handler.clean_subtitles(subtitle_file)
        if not cleaned_text:
            return jsonify({'error': 'Erro ao processar legendas'}), 500

        # Salvar comando do usuário na conversa
        if conversation_id and comando:
            add_message_to_conversation(
                conversation_id,
                comando,
                "user"
            )

        # Salvar transcrição com título na conversa
        formatted_response = f"📹 {video_title}\n\n{cleaned_text}"
        if conversation_id:
            add_message_to_conversation(
                conversation_id,
                formatted_response,
                "assistant"
            )
            
        return jsonify({
            'text': formatted_response,
            'title': video_title
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/rename_conversation/<conversation_id>', methods=['POST'])
def handle_rename_conversation(conversation_id):
    try:
        print(f"[BACKEND] Recebendo solicitação para renomear conversa: {conversation_id}")
        
        # Validação básica do ID para prevenir path traversal
        if not conversation_id.isalnum() and not '-' in conversation_id:
            print("[BACKEND] ID inválido")
            return jsonify({'error': 'ID inválido'}), 400
        
        # Forçar decodificação do corpo JSON
        data = request.get_json(force=True, silent=True)
        if not data:
            data = {}
            print("[BACKEND] Request body vazio ou inválido")
        
        new_title = data.get('title', '').strip()
        print(f"[BACKEND] Novo título: '{new_title}'")
        
        if not new_title:
            print("[BACKEND] Título inválido")
            return jsonify({'error': 'Título inválido'}), 400
            
        success = rename_conversation(conversation_id, new_title)
        if success:
            print(f"[BACKEND] Conversa renomeada com sucesso para: {new_title}")
            return jsonify({'success': True, 'new_title': new_title})
        else:
            print("[BACKEND] Falha ao renomear conversa")
            return jsonify({'error': 'Falha ao renomear conversa'}), 500
    except Exception as e:
        print(f"[BACKEND] Erro ao renomear conversa: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/delete_conversation/<conversation_id>', methods=['DELETE'])
def handle_delete_conversation(conversation_id):
    try:
        print(f"[BACKEND] Recebendo solicitação para excluir conversa: {conversation_id}")
        
        # Validação básica do ID para prevenir path traversal
        if not conversation_id.isalnum() and not '-' in conversation_id:
            print("[BACKEND] ID inválido")
            return jsonify({'error': 'ID inválido'}), 400
        
        success = delete_conversation(conversation_id)
        if success:
            print(f"[BACKEND] Conversa {conversation_id} excluída com sucesso")
            return jsonify({'success': True})
        else:
            print(f"[BACKEND] Falha ao excluir conversa {conversation_id}")
            return jsonify({'error': 'Falha ao excluir conversa'}), 500
    except Exception as e:
        print(f"[BACKEND] Erro ao excluir conversa: {str(e)}")
        return jsonify({'error': str(e)}), 500

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
    print("[APLICAÇÃO] Iniciando servidor Flask...")
    app.run(debug=True)
