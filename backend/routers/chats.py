from flask import Blueprint, jsonify, request
from backend.models.conversations import Conversation
from backend.models.messages import Message

chats_bp = Blueprint('chats', __name__)

@chats_bp.route('/conversations', methods=['GET'])
def get_conversations():
    """Retorna lista de todas as conversas"""
    conversations = Conversation.get_all()
    return jsonify([dict(conv) for conv in conversations])

@chats_bp.route('/conversations', methods=['POST'])
def create_conversation():
    """Cria uma nova conversa"""
    data = request.json
    title = data.get('title', 'Nova Conversa')
    conversation_id = Conversation.create(title)
    return jsonify({'id': conversation_id})

@chats_bp.route('/conversations/<conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    """Retorna uma conversa específica com suas mensagens"""
    conversation = Conversation.get_by_id(conversation_id)
    if not conversation:
        return jsonify({'error': 'Conversa não encontrada'}), 404
        
    messages = Message.get_by_conversation(conversation_id)
    return jsonify({
        'conversation': dict(conversation),
        'messages': [dict(msg) for msg in messages]
    })

@chats_bp.route('/conversations/<conversation_id>/messages', methods=['POST'])
def add_message(conversation_id):
    """Adiciona uma nova mensagem a uma conversa"""
    data = request.json
    role = data.get('role')
    content = data.get('content')
    
    if not all([role, content]):
        return jsonify({'error': 'Dados incompletos'}), 400
        
    message_id = Message.create(conversation_id, role, content)
    return jsonify({'id': message_id})

@chats_bp.route('/conversations/<conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    """Deleta uma conversa e suas mensagens"""
    if Conversation.delete(conversation_id):
        return jsonify({'success': True})
    return jsonify({'error': 'Erro ao deletar conversa'}), 400