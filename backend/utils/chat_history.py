from datetime import datetime
from backend.models.conversations import Conversation
from backend.models.messages import Message
import logging

logger = logging.getLogger(__name__)

def save_conversation(message, response, conversation_id=None):
    """
    Salva ou atualiza uma conversa no banco de dados.
    Se conversation_id for fornecido, adiciona mensagens à conversa existente.
    Caso contrário, cria uma nova conversa.
    """
    try:
        if not conversation_id:
            conversation_id = Conversation.create()
            logger.info(f"Nova conversa criada com ID: {conversation_id}")
        
        Message.create(conversation_id, 'user', message)
        Message.create(conversation_id, 'assistant', response)
        logger.info(f"Mensagens salvas na conversa {conversation_id}")
        
        return conversation_id
    except Exception as e:
        logger.error(f"Erro ao salvar conversa: {str(e)}")
        raise

def get_conversation_history():
    """Retorna o histórico completo de conversas"""
    try:
        conversations = Conversation.get_all()
        history = []
        
        for conv in conversations:
            messages = Message.get_by_conversation(conv.id)
            history.append({
                'id': conv.id,
                'timestamp': conv.timestamp.isoformat(),
                'messages': [{
                    'role': msg.role,
                    'content': msg.content,
                    'timestamp': msg.timestamp.isoformat()
                } for msg in messages]
            })
        
        return history
    except Exception as e:
        logger.error(f"Erro ao buscar histórico: {str(e)}")
        return []

def get_conversation_by_id(conversation_id):
    """Busca uma conversa específica com suas mensagens"""
    try:
        conversation = Conversation.get_by_id(conversation_id)
        if not conversation:
            return None
            
        messages = Message.get_by_conversation(conversation_id)
        return {
            'id': conversation.id,
            'timestamp': conversation.timestamp.isoformat(),
            'messages': [{
                'role': msg.role,
                'content': msg.content,
                'timestamp': msg.timestamp.isoformat()
            } for msg in messages]
        }
    except Exception as e:
        logger.error(f"Erro ao buscar conversa {conversation_id}: {str(e)}")
        return None