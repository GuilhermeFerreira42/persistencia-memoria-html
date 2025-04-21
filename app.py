"""
Aplicação de Chat com Persistência e Processamento de Dados

Este módulo contém a aplicação principal Flask e implementa uma interface
de chat que suporta conversas persistentes com uma IA e processamento
de vídeos do YouTube.

Funcionalidades principais:
- Interface web para conversas com IA (Ollama - gemma2:2b)
- Persistência de conversas em arquivos JSON
- Processamento de transcrições de vídeos do YouTube
- Geração de resumos para conteúdo de vídeos
- Comunicação em tempo real via WebSockets
"""

import init_eventlet

from flask import Flask, render_template, request, jsonify, Response
import json
import os
from datetime import datetime
import requests
from youtube_handler import YoutubeHandler
from flask_socketio import SocketIO, emit, join_room, leave_room
from uuid import uuid4
from utils.chat_storage import (
    create_new_conversation,
    add_message_to_conversation,
    get_conversation_by_id,
    get_conversation_history,
    delete_conversation,
    rename_conversation,
    update_message_in_conversation
)

# Inicialização da aplicação
app = Flask(__name__, static_folder='static')
app.secret_key = 'sua_chave_secreta_aqui'
socketio = SocketIO(app, async_mode='eventlet', cors_allowed_origins="*")

# Configuração da API Ollama
API_URL = "http://localhost:11434/v1/chat/completions"
MODEL_NAME = "gemma2:2b"
youtube_handler = YoutubeHandler()

# Cache para mensagens em streaming
streaming_messages = {}

@app.route('/')
def home():
    """Rota principal que renderiza a página inicial"""
    # print("[DEBUG-PYTHON] Rota principal '/' acessada em app.py")
    conversations = get_conversation_history()
    return render_template('index.html', conversations=conversations)

@app.route('/get_conversation_history')
def conversation_history():
    """Endpoint para obter o histórico de todas as conversas"""
    try:
        # print("[DEBUG-PYTHON] Rota /get_conversation_history acessada em app.py")
        conversations = get_conversation_history()
        # print(f"[DEBUG-PYTHON] Retornando {len(conversations)} conversas do histórico")
        return jsonify(conversations)
    except Exception as e:
        print(f"[ERRO-PYTHON] Falha ao obter histórico de conversas: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_conversation/<conversation_id>')
def get_conversation(conversation_id):
    """Endpoint para obter uma conversa específica pelo ID"""
    try:
        # print(f"[DEBUG-PYTHON] Rota /get_conversation/{conversation_id} acessada em app.py")
        conversation = get_conversation_by_id(conversation_id)
        if conversation:
            # print(f"[DEBUG-PYTHON] Conversa {conversation_id} encontrada e será retornada")
            return jsonify(conversation)
        print(f"[ERRO-PYTHON] Conversa não encontrada: {conversation_id}")
        return jsonify({'error': 'Conversa não encontrada'}), 404
    except Exception as e:
        print(f"[ERRO-PYTHON] Falha ao obter conversa: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_conversation/<conversation_id>/<int:offset>/<int:limit>')
def get_conversation_batch(conversation_id, offset, limit):
    """
    Endpoint para carregar mensagens em lotes para lazy loading.
    Permite carregar partes da conversa para melhorar a performance com históricos longos.
    
    Args:
        conversation_id: ID da conversa
        offset: Índice inicial das mensagens a serem carregadas
        limit: Número máximo de mensagens a serem retornadas
    """
    try:
        conversation = get_conversation_by_id(conversation_id)
        if conversation:
            messages = conversation['messages']
            # Garantir que offset e limit estão dentro dos limites
            offset = min(offset, len(messages))
            end_index = min(offset + limit, len(messages))
            batch = messages[offset:end_index]
            
            return jsonify({
                'messages': batch,
                'total': len(messages),
                'hasMore': end_index < len(messages)
            })
        
        print(f"[ERRO] Conversa não encontrada para batch loading: {conversation_id}")
        return jsonify({'error': 'Conversa não encontrada'}), 404
    except Exception as e:
        print(f"[ERRO] Falha ao obter lote de mensagens: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/stream')
def stream():
    """
    Endpoint para streaming de respostas usando Server-Sent Events (SSE).
    Permite enviar respostas da IA em tempo real para o cliente, 
    pedaço por pedaço, sem esperar a resposta completa.
    """
    conversation_id = request.args.get('conversation_id')
    message = request.args.get('message', '')
    
    if not conversation_id:
        return jsonify({'error': 'ID de conversa não fornecido'}), 400
        
    # print(f"[DEBUG] Iniciando streaming para conversa: {conversation_id}")
    
    def event_stream():
        accumulated_response = ""
        try:
            for part in process_with_ai_stream(message, conversation_id):
                if part:
                    accumulated_response += part
                    # Emitir apenas para a conversa atual
                    socketio.emit('message_chunk', {
                        'content': part,
                        'conversation_id': conversation_id
                    }, room=conversation_id)
                    yield f"data: {part}\n\n"
            
            # Salvar apenas a resposta final
            if accumulated_response:
                add_message_to_conversation(conversation_id, accumulated_response, "assistant")
                # Notificar que a resposta está completa
                socketio.emit('response_complete', {
                    'conversation_id': conversation_id
                }, room=conversation_id)
                # Notificar que a conversa foi atualizada
                # print(f"[DEBUG] Emitindo evento conversation_updated para conversation_id: {conversation_id}")
                socketio.emit('conversation_updated', {
                    'conversation_id': conversation_id
                })
                # print(f"[DEBUG] Evento conversation_updated emitido com sucesso")
        except Exception as e:
            print(f"[ERRO] Erro durante streaming: {str(e)}")
            # Em caso de erro, notificar o cliente
            socketio.emit('stream_error', {
                'conversation_id': conversation_id,
                'error': str(e)
            }, room=conversation_id)
                
    response = Response(event_stream(), content_type="text/event-stream")
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'  # Para Nginx
    return response

@app.route('/send_message', methods=['POST'])
def send_message():
    """
    Endpoint para enviar uma mensagem para a IA.
    Cria uma nova conversa se necessário, salva a mensagem do usuário
    e processa a resposta da IA em streaming.
    """
    data = request.json
    message = data.get('message', '')
    conversation_id = data.get('conversation_id')

    if not conversation_id:
        conversation_id = create_new_conversation()

    # Gerar um ID único para a mensagem da IA
    message_id = str(uuid4())
    
    # Inicializar cache para esta mensagem
    if conversation_id not in streaming_messages:
        streaming_messages[conversation_id] = {}
    streaming_messages[conversation_id][message_id] = ""

    # Salvar mensagem do usuário
    add_message_to_conversation(conversation_id, message, "user")
    
    def generate_streamed_response():
        try:
            for part in process_with_ai_stream(message, conversation_id):
                if part:
                    # Acumular no cache
                    streaming_messages[conversation_id][message_id] += part
                    
                    # Emitir via WebSocket
                    socketio.emit('message_chunk', {
                        'content': part,
                        'conversation_id': conversation_id,
                        'message_id': message_id
                    }, room=conversation_id)
                    
                    # Enviar pedaço como evento SSE
                    yield f"data: {json.dumps({'content': part, 'conversation_id': conversation_id, 'message_id': message_id})}\n\n"
            
            # Salvar resposta final
            complete_response = streaming_messages[conversation_id][message_id]
            if complete_response:
                add_message_to_conversation(conversation_id, complete_response, "assistant")
                
                # Notificar que a resposta está completa
                socketio.emit('response_complete', {
                    'conversation_id': conversation_id,
                    'message_id': message_id,
                    'complete_response': complete_response
                }, room=conversation_id)
                
                # Notificar atualização da conversa
                socketio.emit('conversation_updated', {
                    'conversation_id': conversation_id
                })
                
                # Limpar cache após finalizar
                del streaming_messages[conversation_id][message_id]
                if not streaming_messages[conversation_id]:
                    del streaming_messages[conversation_id]
                    
        except Exception as e:
            print(f"[ERRO] Erro durante streaming: {str(e)}")
            socketio.emit('stream_error', {
                'conversation_id': conversation_id,
                'message_id': message_id,
                'error': str(e)
            }, room=conversation_id)
            
            # Limpar cache em caso de erro
            if message_id in streaming_messages.get(conversation_id, {}):
                del streaming_messages[conversation_id][message_id]
                if not streaming_messages[conversation_id]:
                    del streaming_messages[conversation_id]

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
        
        print(f"[DEBUG-PYTHON] Rota /save_message acessada para conversa: {conversation_id}, role: {role}")
        add_message_to_conversation(conversation_id, content, role)
        
        # Notificar clientes via WebSocket
        socketio.emit('conversation_updated', {
            'conversation_id': conversation_id
        })
        
        return jsonify({'status': 'success', 'conversation_id': conversation_id})
    except Exception as e:
        print(f"[ERRO-PYTHON] Erro ao salvar mensagem: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/process_youtube', methods=['POST'])
def process_youtube():
    data = request.json
    conversation_id = data.get('conversation_id')
    video_url = data.get('video_url')
    
    if not conversation_id or not video_url:
        return jsonify({'error': 'Dados incompletos'}), 400
    
    # Salvar o comando do usuário no histórico
    command_message = f"/youtube {video_url}"
    add_message_to_conversation(conversation_id, command_message, "user")
    print(f"[DEBUG] Comando do usuário salvo: {command_message}")
    
    # Notificar o frontend que a mensagem do usuário foi salva
    socketio.emit('message_saved', {
        'content': command_message,
        'role': 'user',
        'conversation_id': conversation_id
    }, room=conversation_id)
    
    # Inicia o processamento em background
    socketio.start_background_task(process_youtube_background, video_url, conversation_id)
    
    return jsonify({'status': 'Processamento iniciado'})

def process_youtube_background(url, conversation_id):
    """
    Função que processa um vídeo do YouTube em background.
    Baixa as legendas, limpa e retorna como mensagem na conversa.
    
    Args:
        url: URL do vídeo do YouTube
        conversation_id: ID da conversa onde salvar o resultado
    """
    print(f"[INFO] Iniciando processamento do vídeo: {url} para conversa: {conversation_id}")
    youtube_handler = YoutubeHandler()
    
    try:
        # Notificar início do processamento
        socketio.emit('youtube_response', {
            'status': 'processing',
            'conversation_id': conversation_id,
            'content': "Processando vídeo..."
        }, room=conversation_id)
        
        # Garantir que o cliente está na sala correta
        socketio.emit('join_conversation', {
            'conversation_id': conversation_id
        }, room=conversation_id)
        
        # Substituindo as chamadas separadas pelo novo método combinado
        cleaned_subtitles, video_title = youtube_handler.download_and_clean_transcript(url)
        
        if not cleaned_subtitles:
            error_msg = f"Não foi possível processar as legendas do vídeo '{video_title or 'desconhecido'}' em PT-BR, PT ou EN."
            print(f"[ERRO] {error_msg}")
            socketio.emit('youtube_response', {
                'status': 'error',
                'conversation_id': conversation_id,
                'error': error_msg
            }, room=conversation_id)
            return
            
        print(f"[INFO] Legendas encontradas e processadas para o vídeo: {video_title}")
        
        # Formata a resposta com o título e as legendas
        response_content = f"**Legendas do vídeo '{video_title}':**\n\n{cleaned_subtitles}"
        
        # Salva a mensagem no histórico
        message_id = add_message_to_conversation(conversation_id, response_content, "assistant")
        
        # Envia a resposta para o frontend
        socketio.emit('youtube_response', {
            'status': 'success',
            'conversation_id': conversation_id,
            'content': response_content,
            'message_id': message_id
        }, room=conversation_id)
        
        # Notifica que a conversa foi atualizada
        # print(f"[DEBUG] Emitindo evento conversation_updated para conversation_id: {conversation_id}")
        socketio.emit('conversation_updated', {
            'conversation_id': conversation_id
        })
        # print(f"[DEBUG] Evento conversation_updated emitido com sucesso")
        
        print(f"[INFO] Processamento do vídeo concluído com sucesso")
        
    except Exception as e:
        error_msg = f"Erro ao processar o vídeo: {str(e)}"
        print(f"[ERRO] {error_msg}")
        socketio.emit('youtube_response', {
            'status': 'error',
            'conversation_id': conversation_id,
            'error': error_msg
        }, room=conversation_id)

@app.route('/save_youtube_message', methods=['POST'])
def save_youtube_message():
    try:
        data = request.json
        conversation_id = data.get('conversation_id')
        content = data.get('content')
        if not conversation_id or not content:
            return jsonify({'error': 'Dados incompletos'}), 400
        
        print(f"[DEBUG] Salvando mensagem do YouTube na conversa: {conversation_id}")
        add_message_to_conversation(conversation_id, content, "assistant")
        
        # Opcional: Notifica novamente via WebSocket para que o frontend atualize o histórico (se necessário)
        socketio.emit('conversation_updated', {
            'conversation_id': conversation_id
        })
        
        return jsonify({'status': 'success'})
    except Exception as e:
        print(f"[ERRO] Falha ao salvar mensagem do YouTube: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/process_youtube_resumo', methods=['POST'])
def process_youtube_resumo():
    """
    Processa um vídeo do YouTube, baixa as legendas, limpa e gera resumos por blocos.
    """
    try:
        data = request.json
        video_url = data.get('url', '').strip()
        conversation_id = data.get('conversation_id')
        
        if not video_url:
            return jsonify({'error': 'URL do vídeo não fornecida'}), 400
        if not conversation_id:
            return jsonify({'error': 'ID da conversa não fornecido'}), 400
            
        print(f"[INFO] Processando resumo do vídeo: {video_url} para conversa: {conversation_id}")
        
        # Adiciona a mensagem do usuário ao histórico
        command_message = f"/youtube_resumo {video_url}"
        add_message_to_conversation(conversation_id, command_message, "user")
        
        # Notifica que a conversa foi atualizada
        socketio.emit('conversation_updated', {
            'conversation_id': conversation_id
        })
        
        # Adiciona o cliente à sala da conversa
        socketio.emit('join_conversation', {
            'conversation_id': conversation_id
        }, room=conversation_id)
        
        # Inicia o processamento em background
        socketio.start_background_task(process_youtube_resumo_background, video_url, conversation_id)
        
        return jsonify({'status': 'Processamento de resumo iniciado'})
    except Exception as e:
        error_msg = f"Erro ao iniciar processamento do resumo: {str(e)}"
        print(f"[ERRO] {error_msg}")
        return jsonify({'error': error_msg}), 500

def process_youtube_resumo_background(url, conversation_id):
    """
    Processa um vídeo do YouTube em background, gerando resumos por blocos de transcrição.
    O processo divide a transcrição em blocos menores e gera um resumo para cada bloco
    usando a IA, permitindo um resumo mais detalhado do conteúdo completo.
    
    Args:
        url: URL do vídeo do YouTube
        conversation_id: ID da conversa onde salvar o resultado
    """
    print(f"[INFO] Iniciando processamento de resumo do vídeo: {url} para conversa: {conversation_id}")
    youtube_handler = YoutubeHandler()
    
    try:
        # Notificar início do processamento
        socketio.emit('youtube_resumo_response', {
            'status': 'processing',
            'conversation_id': conversation_id,
            'content': "Processando vídeo para resumo..."
        }, room=conversation_id)
        
        # Garantir que o cliente está na sala correta
        socketio.emit('join_conversation', {
            'conversation_id': conversation_id
        }, room=conversation_id)
        
        # Baixa e limpa a transcrição
        transcript, video_title = youtube_handler.download_and_clean_transcript(url)
        
        if not transcript:
            error_msg = f"Não foi possível processar as legendas do vídeo '{video_title or 'desconhecido'}' em PT-BR, PT ou EN."
            print(f"[ERRO] {error_msg}")
            socketio.emit('youtube_resumo_error', {
                'status': 'error',
                'conversation_id': conversation_id,
                'error': error_msg
            }, room=conversation_id)
            
            # Também exibir o erro como uma mensagem normal
            error_response = f"**Erro:** {error_msg}"
            message_id = add_message_to_conversation(conversation_id, error_response, "assistant")
            socketio.emit('message_chunk', {
                'content': error_response,
                'conversation_id': conversation_id
            }, room=conversation_id)
            socketio.emit('response_complete', {
                'conversation_id': conversation_id
            }, room=conversation_id)
            return
            
        print(f"[INFO] Legendas encontradas e processadas para o vídeo: {video_title}")
        
        # Divide a transcrição em blocos de aproximadamente 300 palavras
        transcript_chunks = youtube_handler.split_transcript_into_chunks(transcript)
        
        if not transcript_chunks:
            error_msg = f"Falha ao dividir a transcrição do vídeo '{video_title}' em blocos."
            print(f"[ERRO] {error_msg}")
            socketio.emit('youtube_resumo_error', {
                'status': 'error',
                'conversation_id': conversation_id,
                'error': error_msg
            }, room=conversation_id)
            
            # Também exibir o erro como uma mensagem normal
            error_response = f"**Erro:** {error_msg}"
            message_id = add_message_to_conversation(conversation_id, error_response, "assistant")
            socketio.emit('message_chunk', {
                'content': error_response,
                'conversation_id': conversation_id
            }, room=conversation_id)
            socketio.emit('response_complete', {
                'conversation_id': conversation_id
            }, room=conversation_id)
            return
        
        # Cria a resposta inicial com o título do vídeo
        full_response = f"**Resumo do vídeo '{video_title}':**\n\n"
        
        # Adiciona a informação sobre os blocos
        full_response += f"*O vídeo foi dividido em {len(transcript_chunks)} blocos para resumo detalhado.*\n\n"
        
        # Salva a mensagem inicial no histórico
        message_id = add_message_to_conversation(conversation_id, full_response, "assistant")
        
        # Envia a resposta inicial para o frontend
        socketio.emit('message_chunk', {
            'content': full_response,
            'conversation_id': conversation_id
        }, room=conversation_id)
        
        # Processa cada bloco com a IA para gerar resumos
        response_content = full_response
        for i, chunk in enumerate(transcript_chunks):
            # Formata o número do bloco
            block_number = i + 1
            
            # Adiciona cabeçalho do bloco
            block_header = f"\n\n### Bloco {block_number}/{len(transcript_chunks)}\n\n"
            socketio.emit('message_chunk', {
                'content': block_header,
                'conversation_id': conversation_id
            }, room=conversation_id)
            response_content += block_header
            
            # Prepara o prompt para a IA
            prompt = f"""Resumir o seguinte trecho de uma transcrição de vídeo do YouTube em um parágrafo conciso, 
            mas mantendo todos os pontos importantes:

            "{chunk}"
            
            Resumo detalhado:"""
            
            # Gera o resumo com a IA e envia em streaming
            try:
                for resumo_chunk in process_with_ai_stream(prompt, conversation_id):
                    if resumo_chunk:
                        # Enviar chunk via socket para streaming em tempo real
                        socketio.emit('message_chunk', {
                            'content': resumo_chunk,
                            'conversation_id': conversation_id
                        }, room=conversation_id)
                        response_content += resumo_chunk
            except Exception as e:
                error_msg = f"Falha ao gerar resumo para o bloco {block_number}: {str(e)}"
                print(f"[ERRO] {error_msg}")
                error_response = f"*Erro ao gerar resumo para este bloco*\n\n**Trecho original:**\n\n{chunk[:150]}..."
                socketio.emit('message_chunk', {
                    'content': error_response,
                    'conversation_id': conversation_id
                }, room=conversation_id)
                response_content += error_response
        
        # Notificar que a resposta está completa
        socketio.emit('response_complete', {
            'conversation_id': conversation_id
        }, room=conversation_id)
        
        # Atualiza a mensagem no histórico
        update_message_in_conversation(conversation_id, message_id, response_content)
        
        # Notifica que a conversa foi atualizada
        # print(f"[DEBUG] Emitindo evento conversation_updated para conversation_id: {conversation_id}")
        socketio.emit('conversation_updated', {
            'conversation_id': conversation_id
        })
        # print(f"[DEBUG] Evento conversation_updated emitido com sucesso")
        
        print(f"[INFO] Processamento do resumo do vídeo concluído com sucesso")
        
    except Exception as e:
        error_msg = f"Erro ao processar o resumo do vídeo: {str(e)}"
        print(f"[ERRO] {error_msg}")
        socketio.emit('youtube_resumo_error', {
            'status': 'error',
            'conversation_id': conversation_id,
            'error': error_msg
        }, room=conversation_id)
        
        # Também exibir o erro como uma mensagem normal
        error_response = f"**Erro:** {error_msg}"
        message_id = add_message_to_conversation(conversation_id, error_response, "assistant")
        socketio.emit('message_chunk', {
            'content': error_response,
            'conversation_id': conversation_id
        }, room=conversation_id)
        socketio.emit('response_complete', {
            'conversation_id': conversation_id
        }, room=conversation_id)

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

@app.route('/log-frontend', methods=['POST'])
def log_frontend():
    try:
        data = request.get_json()
        level = data.get('level', 'info')
        message = data.get('message', '')
        error = data.get('error')
        timestamp = data.get('timestamp', datetime.now().isoformat())
        
        # Formatar a mensagem de log
        log_message = f"[FRONTEND {level.upper()}] {message}"
        if error:
            log_message += f"\nErro: {error}"
        
        # Imprimir no console do servidor
        print(log_message)
        
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        print(f"[ERRO] Falha ao processar log do frontend: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/test_socket', methods=['POST'])
def test_socket():
    try:
        data = request.json
        conversation_id = data.get('conversation_id')
        
        if not conversation_id:
            return jsonify({'error': 'ID da conversa não fornecido'}), 400
            
        print(f"[DEBUG] Enviando evento de teste para conversation_id: {conversation_id}")
        socketio.emit('test_event', {
            'message': 'Teste de conectividade',
            'conversation_id': conversation_id,
            'timestamp': datetime.now().isoformat()
        }, room=conversation_id)
        
        return jsonify({'status': 'Evento de teste enviado'})
    except Exception as e:
        print(f"[ERRO] Falha ao enviar evento de teste: {str(e)}")
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
    """
    Processa um texto com a IA e retorna a resposta completa.
    Esta função faz uma chamada síncrona para a API da Ollama.
    
    Args:
        text: Texto/prompt a ser enviado para a IA
        conversation_id: ID da conversa (opcional, para rastreamento)
        
    Returns:
        str: Resposta gerada pela IA
    """
    try:
        # Incluir o ID da conversa no contexto para rastreamento
        context_header = f"[Conversa: {conversation_id}] " if conversation_id else ""
        print(f"{context_header}Processando com IA: {text[:50]}...")
        
        payload = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "system", "content": "Você é um assistente útil, fale somente em português brasileiro. Formate suas respostas em Markdown. Use acentos graves triplos (```) APENAS para blocos de código, especificando a linguagem (ex.: ```python). NUNCA coloque texto explicativo dentro de blocos de código."},
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
    """
    Processa um texto com a IA e retorna a resposta em streaming.
    Esta função faz chamadas para a API Ollama com streaming ativado,
    retornando cada pedaço da resposta à medida que é gerado.
    
    Args:
        text: Texto/prompt a ser enviado para a IA
        conversation_id: ID da conversa (opcional, para rastreamento)
        
    Yields:
        str: Partes da resposta gerada pela IA
    """
    try:
        context_header = f"[Conversa: {conversation_id}] " if conversation_id else ""
        print(f"{context_header}Iniciando streaming para: {text[:50]}...")
        
        messages = [
            {"role": "system", "content": "Você é um assistente útil. Formate suas respostas em Markdown."},
            {"role": "user", "content": text}
        ]
        
        payload = {
            "model": MODEL_NAME,
            "messages": messages,
            "stream": True
        }
        headers = {"Content-Type": "application/json"}
        response = requests.post(API_URL, json=payload, headers=headers, stream=True)
        response.raise_for_status()

        accumulated_response = ""
        chunk_count = 0
        
        for line in response.iter_lines(decode_unicode=True):
            if line.strip() and line.startswith("data: "):
                line = line[6:].strip()
                try:
                    response_data = json.loads(line)
                    if 'choices' in response_data and len(response_data['choices']) > 0:
                        delta = response_data['choices'][0]['delta']
                        if "content" in delta:
                            content = delta["content"].encode('latin1').decode('utf-8', errors='ignore')
                            chunk_count += 1
                            accumulated_response += content
                            
                            # print(f"{context_header}Chunk #{chunk_count}: {len(content)} caracteres")
                            # print(f"{context_header}Preview: {content[:50]}...")
                            
                            socketio.emit('message_chunk', {
                                'content': content,
                                'conversation_id': conversation_id,
                                'chunk_number': chunk_count
                            }, room=conversation_id)
                            yield content
                except json.JSONDecodeError:
                    error_msg = f"Falha ao decodificar JSON: {line}"
                    print(f"{context_header}[ERRO] {error_msg}")
        
        print(f"{context_header}Streaming concluído. Total de chunks: {chunk_count}")
        # print(f"{context_header}Tamanho total da resposta: {len(accumulated_response)} caracteres")
        
        socketio.emit('response_complete', {
            'conversation_id': conversation_id,
            'complete_response': accumulated_response,
            'total_chunks': chunk_count
        }, room=conversation_id)
        
    except requests.exceptions.RequestException as e:
        error_msg = f"Erro na requisição HTTP: {str(e)}"
        print(f"{context_header}[ERRO] {error_msg}")
    except Exception as e:
        error_msg = f"Erro inesperado: {str(e)}"
        print(f"{context_header}[ERRO] {error_msg}")

if __name__ == '__main__':
    print("Iniciando servidor com Eventlet em modo de desenvolvimento...")
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, use_reloader=False)
