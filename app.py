import init_eventlet

from flask import Flask, render_template, request, jsonify, Response
import json
import os
from datetime import datetime
import requests
from utils.text_processor import split_text, clean_and_format_text
from youtube_handler import YoutubeHandler
from flask_socketio import SocketIO, emit, join_room, leave_room
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
socketio = SocketIO(app, async_mode='eventlet', cors_allowed_origins="*")

API_URL = "http://localhost:11434/v1/chat/completions"
MODEL_NAME = "gemma2:2b"
youtube_handler = YoutubeHandler()

@app.route('/')
def home():
    conversations = get_conversation_history()
    return render_template('index.html', conversations=conversations)

@app.route('/get_conversation_history')
def conversation_history():
    try:
        conversations = get_conversation_history()
        return jsonify(conversations)
    except Exception as e:
        print(f"[ERRO] Falha ao obter histórico de conversas: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_conversation/<conversation_id>')
def get_conversation(conversation_id):
    try:
        conversation = get_conversation_by_id(conversation_id)
        if conversation:
            return jsonify(conversation)
        print(f"[ERRO] Conversa não encontrada: {conversation_id}")
        return jsonify({'error': 'Conversa não encontrada'}), 404
    except Exception as e:
        print(f"[ERRO] Falha ao obter conversa: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_conversation/<conversation_id>/<int:offset>/<int:limit>')
def get_conversation_paginated(conversation_id, offset, limit):
    try:
        conversation = get_conversation_by_id(conversation_id)
        if not conversation:
            print(f"[ERRO] Conversa não encontrada: {conversation_id}")
            return jsonify({'error': 'Conversa não encontrada'}), 404
            
        # Extrair mensagens com paginação
        messages = conversation.get('messages', [])
        total_messages = len(messages)
        
        # Verificar limites
        if offset >= total_messages:
            return jsonify([])
            
        # Obter o subconjunto de mensagens
        paginated_messages = messages[offset:offset+limit]
        
        # Incluir metadados de paginação
        result = {
            'messages': paginated_messages,
            'pagination': {
                'total': total_messages,
                'offset': offset,
                'limit': limit,
                'has_more': (offset + limit) < total_messages
            }
        }
        
        return jsonify(result)
    except Exception as e:
        print(f"[ERRO] Falha ao obter mensagens paginadas: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/stream')
def stream():
    """Endpoint para streaming de respostas usando Server-Sent Events (SSE)"""
    conversation_id = request.args.get('conversation_id')
    message = request.args.get('message', '')
    
    if not conversation_id:
        return jsonify({'error': 'ID de conversa não fornecido'}), 400
        
    print(f"[DEBUG] Iniciando streaming para conversa: {conversation_id}")
    
    def event_stream():
        for part in process_with_ai_stream(message, conversation_id):
            if part:
                yield f"data: {part}\n\n"
                
    response = Response(event_stream(), content_type="text/event-stream")
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'  # Para Nginx
    return response

@app.route('/send_message', methods=['POST'])
def send_message():
    data = request.json
    message = data.get('message', '')
    conversation_id = data.get('conversation_id')

    if not conversation_id:
        conversation_id = create_new_conversation()
        print(f"[DEBUG] Nova conversa criada com ID: {conversation_id}")
    else:
        print(f"[DEBUG] Usando conversa existente: {conversation_id}")

    # Salvar mensagem do usuário
    add_message_to_conversation(conversation_id, message, "user")
    print(f"[DEBUG] Mensagem do usuário salva na conversa: {conversation_id}")

    # Processar resposta da IA
    accumulated_response = []
    
    def generate_streamed_response():
        for part in process_with_ai_stream(message, conversation_id):
            if part:
                accumulated_response.append(part)
                # Emitir via WebSocket além do SSE
                socketio.emit('message_chunk', {
                    'content': part, 
                    'conversation_id': conversation_id
                }, room=conversation_id)
                yield f"data: {json.dumps({'content': part, 'conversation_id': conversation_id})}\n\n"
        
        # Salvar a resposta completa da IA - APENAS UMA VEZ
        if accumulated_response:
            complete_response = ''.join(accumulated_response)
            print(f"[DEBUG] Salvando resposta única para {conversation_id}")
            add_message_to_conversation(conversation_id, complete_response, "assistant")
            # Notificar todas as abas conectadas que a conversa foi atualizada
            socketio.emit('conversation_updated', {
                'conversation_id': conversation_id
            })
            print(f"[DEBUG] Resposta completa da IA salva na conversa: {conversation_id}")

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
        
        print(f"[DEBUG] Salvando mensagem para conversa: {conversation_id}, role: {role}")
        add_message_to_conversation(conversation_id, content, role)
        
        # Notificar clientes via WebSocket
        socketio.emit('conversation_updated', {
            'conversation_id': conversation_id
        })
        
        return jsonify({'status': 'success', 'conversation_id': conversation_id})
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
            print(f"[DEBUG] Comando do usuário salvo na conversa: {conversation_id}")

        # Salvar transcrição com título na conversa
        formatted_response = f"📹 {video_title}\n\n{cleaned_text}"
        if conversation_id:
            add_message_to_conversation(
                conversation_id,
                formatted_response,
                "assistant"
            )
            print(f"[DEBUG] Resposta do YouTube salva na conversa: {conversation_id}")
            
            # Notificar via WebSocket
            socketio.emit('conversation_updated', {
                'conversation_id': conversation_id
            })
            
        return jsonify({
            'text': formatted_response,
            'title': video_title,
            'conversation_id': conversation_id
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/rename_conversation/<conversation_id>', methods=['POST'])
def handle_rename_conversation(conversation_id):
    try:
        print(f"[BACKEND] Recebendo solicitação para renomear conversa: {conversation_id}")
        
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
            
            # Notificar via WebSocket
            socketio.emit('conversation_renamed', {
                'conversation_id': conversation_id,
                'new_title': new_title
            })
            
            return jsonify({'success': True, 'new_title': new_title, 'conversation_id': conversation_id})
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
        
        success = delete_conversation(conversation_id)
        if success:
            print(f"[BACKEND] Conversa {conversation_id} excluída com sucesso")
            
            # Notificar via WebSocket
            socketio.emit('conversation_deleted', {
                'conversation_id': conversation_id
            })
            
            return jsonify({'success': True, 'conversation_id': conversation_id})
        else:
            print(f"[BACKEND] Falha ao excluir conversa {conversation_id}")
            return jsonify({'error': 'Falha ao excluir conversa'}), 500
    except Exception as e:
        print(f"[BACKEND] Erro ao excluir conversa: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ---- WebSocket event handlers ----

@socketio.on('connect')
def handle_connect():
    print(f"[SOCKET] Cliente conectado: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"[SOCKET] Cliente desconectado: {request.sid}")

@socketio.on('join_conversation')
def handle_join_conversation(data):
    conversation_id = data.get('conversation_id')
    if conversation_id:
        join_room(conversation_id)
        print(f"[SOCKET] Cliente {request.sid} entrou na sala: {conversation_id}")

@socketio.on('leave_conversation')
def handle_leave_conversation(data):
    conversation_id = data.get('conversation_id')
    if conversation_id:
        leave_room(conversation_id)
        print(f"[SOCKET] Cliente {request.sid} saiu da sala: {conversation_id}")

def process_with_ai(text, conversation_id=None):
    try:
        # Incluir o ID da conversa no contexto para rastreamento
        context_header = f"[Conversa: {conversation_id}] " if conversation_id else ""
        print(f"{context_header}Processando com IA: {text[:50]}...")
        
        payload = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "system", "content": "Você é um assistente útil. Formate suas respostas em Markdown. Use acentos graves triplos (```) APENAS para blocos de código, especificando a linguagem (ex.: ```python). NUNCA coloque texto explicativo dentro de blocos de código."},
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

def process_with_ai_stream(text, conversation_id=None):
    try:
        # Incluir o ID da conversa no contexto para rastreamento
        context_header = f"[Conversa: {conversation_id}] " if conversation_id else ""
        print(f"{context_header}Iniciando streaming para: {text[:50]}...")
        
        # Opção para incluir histórico de mensagens da conversa específica
        conversation = None
        if conversation_id:
            conversation = get_conversation_by_id(conversation_id)
        
        # Mensagem do sistema é sempre necessária
        messages = [{"role": "system", "content": "Você é um assistente útil. Formate suas respostas em Markdown. Use acentos graves triplos (```) APENAS para blocos de código, especificando a linguagem (ex.: ```python). NUNCA coloque texto explicativo dentro de blocos de código. Exemplo:\nTexto normal aqui.\n```python\nprint('Código aqui')\n```\nMais texto normal aqui."}]
        
        # Adicionar mensagem do usuário
        messages.append({"role": "user", "content": text})
        
        payload = {
            "model": MODEL_NAME,
            "messages": messages,
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
                            print(f"{context_header}Chunk: {len(content)} caracteres")
                            yield content
                except json.JSONDecodeError:
                    print(f"[Debug] Erro ao decodificar JSON: {line}")
    except requests.exceptions.RequestException as e:
        print(f"[Debug] Erro na requisição HTTP: {str(e)}")
    except Exception as e:
        print(f"[Debug] Erro inesperado: {str(e)}")

if __name__ == '__main__':
    print("Iniciando servidor com Eventlet em modo de desenvolvimento...")
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, use_reloader=False)
