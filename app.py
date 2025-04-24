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
import logging
import traceback
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

# Configuração do sistema de logging
def setup_logger():
    log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    logger = logging.getLogger('chat_app')
    logger.setLevel(logging.DEBUG)
    
    # Log para arquivo
    file_handler = logging.FileHandler(os.path.join(log_dir, f'app_{datetime.now().strftime("%Y%m%d")}.log'))
    file_handler.setLevel(logging.DEBUG)
    
    # Log para console
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    # Formato dos logs
    formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger

# Inicialização do logger
logger = setup_logger()
logger.info("Iniciando aplicação de chat")

# Inicialização da aplicação
app = Flask(__name__, static_folder='static')
app.secret_key = 'sua_chave_secreta_aqui'
socketio = SocketIO(app, async_mode='eventlet', cors_allowed_origins="*")
logger.info("Aplicação Flask e Socket.IO inicializados")

# Configuração da API Ollama
API_URL = "http://localhost:11434/v1/chat/completions"
MODEL_NAME = "gemma2:2b"
youtube_handler = YoutubeHandler()
logger.info(f"API configurada: {API_URL}, Modelo: {MODEL_NAME}")

# Cache para mensagens em streaming
streaming_messages = {}

@app.route('/')
def home():
    """Rota principal que renderiza a página inicial"""
    logger.info("Requisição para página principal recebida")
    conversations = get_conversation_history()
    logger.debug(f"Carregadas {len(conversations)} conversas do histórico")
    return render_template('index.html', conversations=conversations)

@app.route('/get_conversation_history')
def conversation_history():
    """Endpoint para obter o histórico de todas as conversas"""
    try:
        logger.info("Requisição para obter histórico de conversas")
        conversations = get_conversation_history()
        logger.debug(f"Retornando {len(conversations)} conversas do histórico")
        return jsonify(conversations)
    except Exception as e:
        logger.error(f"Falha ao obter histórico de conversas: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/get_conversation/<conversation_id>')
def get_conversation(conversation_id):
    """Endpoint para obter uma conversa específica pelo ID"""
    try:
        logger.info(f"Requisição para obter conversa: {conversation_id}")
        conversation = get_conversation_by_id(conversation_id)
        if conversation:
            logger.debug(f"Conversa {conversation_id} encontrada com {len(conversation.get('messages', []))} mensagens")
            return jsonify(conversation)
        logger.warning(f"Conversa não encontrada: {conversation_id}")
        return jsonify({'error': 'Conversa não encontrada'}), 404
    except Exception as e:
        logger.error(f"Falha ao obter conversa {conversation_id}: {str(e)}")
        logger.error(traceback.format_exc())
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
        logger.info(f"Requisição de lote para conversa: {conversation_id} (offset={offset}, limit={limit})")
        conversation = get_conversation_by_id(conversation_id)
        if conversation:
            messages = conversation['messages']
            # Garantir que offset e limit estão dentro dos limites
            offset = min(offset, len(messages))
            end_index = min(offset + limit, len(messages))
            batch = messages[offset:end_index]
            
            logger.debug(f"Retornando lote {offset}-{end_index} de {len(messages)} mensagens")
            return jsonify({
                'messages': batch,
                'total': len(messages),
                'hasMore': end_index < len(messages)
            })
        
        logger.warning(f"Conversa não encontrada para batch loading: {conversation_id}")
        return jsonify({'error': 'Conversa não encontrada'}), 404
    except Exception as e:
        logger.error(f"Falha ao obter lote de mensagens: {str(e)}")
        logger.error(traceback.format_exc())
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
    
    logger.info(f"Mensagem recebida para envio - conversação: {conversation_id}")
    logger.debug(f"Conteúdo da mensagem: {message[:50]}{'...' if len(message) > 50 else ''}")

    if not conversation_id:
        logger.warning("ID da conversa não fornecido, criando nova conversa")
        conversation_id = create_new_conversation()
        logger.info(f"Nova conversa criada com ID: {conversation_id}")

    # Gerar um ID único para a mensagem da IA
    message_id = str(uuid4())
    logger.debug(f"ID de mensagem gerado: {message_id}")
    
    # Inicializar cache para esta mensagem
    if conversation_id not in streaming_messages:
        streaming_messages[conversation_id] = {}
    streaming_messages[conversation_id][message_id] = ""

    # Salvar mensagem do usuário
    add_message_to_conversation(conversation_id, message, "user")
    logger.debug(f"Mensagem do usuário salva para conversa: {conversation_id}")
    
    def generate_streamed_response():
        chunks_sent = 0
        total_length = 0
        
        try:
            logger.debug(f"Iniciando streaming para conversa: {conversation_id}")
            
            for part in process_with_ai_stream(message, conversation_id):
                chunks_sent += 1
                if part:
                    # Acumular no cache
                    streaming_messages[conversation_id][message_id] += part
                    total_length += len(part)
                    
                    # Emitir via Socket.IO para cliente específico
                    socketio.emit('message_chunk', {
                        'content': part,
                        'conversation_id': conversation_id,
                        'chunk_number': chunks_sent,
                        'message_id': message_id
                    }, room=conversation_id)
                    
                    logger.debug(f"Chunk {chunks_sent} enviado: {len(part)} caracteres")
                    
                    # Enviar via SSE também
                    yield f"data: {json.dumps({'content': part, 'conversation_id': conversation_id, 'chunk_number': chunks_sent})}\n\n"
            
            # Resposta completa
            full_response = streaming_messages[conversation_id][message_id]
            
            if full_response:
                logger.info(f"Streaming concluído: {chunks_sent} chunks, {total_length} caracteres totais")
                
                # Salvar a resposta completa
                add_message_to_conversation(conversation_id, full_response, "assistant")
                logger.debug(f"Resposta completa salva no histórico da conversa: {conversation_id}")
                
                # Notificar que a resposta está completa
                socketio.emit('response_complete', {
                    'conversation_id': conversation_id,
                    'message_id': message_id,
                    'total_chunks': chunks_sent
                }, room=conversation_id)
                
                # Notificar que a conversa foi atualizada
                socketio.emit('conversation_updated', {
                    'conversation_id': conversation_id
                })
                
                # Limpar cache dessa mensagem
                if conversation_id in streaming_messages and message_id in streaming_messages[conversation_id]:
                    del streaming_messages[conversation_id][message_id]
                    if not streaming_messages[conversation_id]:
                        del streaming_messages[conversation_id]
                
                logger.debug(f"Cache de streaming limpo para mensagem: {message_id}")
                
        except Exception as e:
            logger.error(f"Erro durante streaming: {str(e)}")
            logger.error(traceback.format_exc())
            
            # Notificar cliente sobre o erro
            socketio.emit('stream_error', {
                'conversation_id': conversation_id,
                'error': str(e),
                'message_id': message_id
            }, room=conversation_id)
            
            # Limpar cache em caso de erro
            if conversation_id in streaming_messages and message_id in streaming_messages[conversation_id]:
                del streaming_messages[conversation_id][message_id]
    
    logger.debug(f"Iniciando resposta em stream para requisição")
    response = Response(generate_streamed_response(), content_type="text/event-stream")
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'  # Para Nginx
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
    """Endpoint para registrar logs do frontend"""
    try:
        log_data = request.json
        log_level = log_data.get('level', 'INFO')
        message = log_data.get('message', '')
        data = log_data.get('data', {})
        conversation_id = data.get('conversationId') or log_data.get('currentConversation')
        
        # Mapear níveis de log do frontend para os do Python
        level_map = {
            'DEBUG': logging.DEBUG,
            'INFO': logging.INFO,
            'WARN': logging.WARNING,
            'ERROR': logging.ERROR
        }
        
        log_level_num = level_map.get(log_level, logging.INFO)
        
        # Formatar a mensagem de log
        if conversation_id:
            log_message = f"[FRONTEND] [{conversation_id}] {message}"
        else:
            log_message = f"[FRONTEND] {message}"
            
        if data:
            # Limitar tamanho dos dados para evitar logs muito grandes
            data_str = str(data)
            if len(data_str) > 500:
                data_str = data_str[:500] + "..."
            log_message += f" - {data_str}"
            
        # Registrar o log
        logger.log(log_level_num, log_message)
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Erro ao processar log do frontend: {str(e)}")
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
    """Evento de conexão do Socket.IO"""
    logger.info(f"Nova conexão Socket.IO estabelecida: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    """Evento de desconexão do Socket.IO"""
    logger.info(f"Conexão Socket.IO encerrada: {request.sid}")

@socketio.on('join_conversation')
def handle_join_conversation(data):
    """Evento para entrar em uma sala de conversa"""
    conversation_id = data.get('conversation_id')
    if conversation_id:
        join_room(conversation_id)
        logger.debug(f"Cliente {request.sid} entrou na sala: {conversation_id}")
        return {'status': 'success', 'joined': conversation_id}
    return {'status': 'error', 'message': 'ID da conversa não fornecido'}

@socketio.on('leave_conversation')
def handle_leave_conversation(data):
    """Evento para sair de uma sala de conversa"""
    conversation_id = data.get('conversation_id')
    if conversation_id:
        leave_room(conversation_id)
        logger.debug(f"Cliente {request.sid} saiu da sala: {conversation_id}")
        return {'status': 'success', 'left': conversation_id}
    return {'status': 'error', 'message': 'ID da conversa não fornecido'}

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
    Processa o texto com a IA em modo streaming.
    Retorna a resposta incrementalmente em formato de gerador.
    
    Args:
        text: Texto da mensagem
        conversation_id: ID da conversa
    """
    try:
        logger.debug(f"Iniciando processamento com IA para conversa: {conversation_id}")
        
        # Obter histórico da conversa para contexto
        conversation = get_conversation_by_id(conversation_id) if conversation_id else None
        messages = []
        
        if conversation and 'messages' in conversation:
            # Carregar apenas as últimas mensagens para respeitar limite de tokens
            history = conversation['messages'][-10:]  # Ajuste conforme necessário
            
            for msg in history:
                if msg['role'] == 'user':
                    messages.append({
                        "role": "user", 
                        "content": msg['content']
                    })
                elif msg['role'] == 'assistant':
                    messages.append({
                        "role": "assistant", 
                        "content": msg['content']
                    })
        
        # Adicionar a mensagem atual se ainda não estiver no histórico carregado
        if not messages or messages[-1]['content'] != text:
            messages.append({
                "role": "user",
                "content": text
            })
            
        logger.debug(f"Preparado contexto com {len(messages)} mensagens para IA")
        
        # Configuração da chamada para o modelo
        payload = {
            "model": MODEL_NAME,
            "messages": messages,
            "stream": True,
            "temperature": 0.7,
            "max_tokens": 2000
        }
        
        logger.debug(f"Enviando requisição para API: {API_URL}")
        
        # Enviar requisição em streaming
        response = requests.post(
            API_URL,
            json=payload,
            stream=True,
            timeout=60
        )
        
        if response.status_code != 200:
            logger.error(f"Erro na API: {response.status_code} - {response.text}")
            yield f"Erro ao processar a resposta: {response.status_code}"
            return
            
        logger.debug("Conexão estabelecida com a API, iniciando streaming")
        
        buffer = ""
        for line in response.iter_lines():
            if line:
                try:
                    line_text = line.decode('utf-8')
                    
                    # Pular prefixo de dados
                    if line_text.startswith('data: '):
                        line_text = line_text[6:]
                        
                    # Verificar se é o marcador de fim    
                    if line_text == '[DONE]':
                        logger.debug("Marcador [DONE] recebido, finalizando streaming")
                        break
                        
                    # Decodificar JSON
                    data = json.loads(line_text)
                    
                    if 'choices' in data and len(data['choices']) > 0:
                        choice = data['choices'][0]
                        if 'delta' in choice and 'content' in choice['delta']:
                            content = choice['delta']['content']
                            if content:
                                buffer += content
                                
                                # Enviar buffer quando atingir certo tamanho ou tiver pontuação
                                if len(buffer) >= 10 or any(c in buffer for c in '.!?'):
                                    logger.debug(f"Enviando chunk de {len(buffer)} caracteres")
                                    yield buffer
                                    buffer = ""
                except Exception as e:
                    logger.error(f"Erro ao processar linha do streaming: {str(e)}")
                    logger.error(traceback.format_exc())
        
        # Enviar resto do buffer se houver
        if buffer:
            logger.debug(f"Enviando chunk final de {len(buffer)} caracteres")
            yield buffer
            
        logger.info(f"Streaming concluído para conversa: {conversation_id}")
        
    except Exception as e:
        logger.error(f"Erro no processo de streaming: {str(e)}")
        logger.error(traceback.format_exc())
        yield f"Erro no processamento: {str(e)}"

if __name__ == '__main__':
    logger.info("Iniciando servidor Socket.IO")
    try:
        socketio.run(app, debug=True)
    except Exception as e:
        logger.critical(f"Falha ao iniciar servidor: {str(e)}")
        logger.critical(traceback.format_exc())
