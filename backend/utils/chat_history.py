from datetime import datetime
from backend.database.database import get_db
from backend.models.conversations import Conversation
from backend.models.messages import Message
import logging

logger = logging.getLogger(__name__)

def save_conversation(message, response, conversation_id=None):
    """
    Salva ou atualiza uma conversa no banco de dados.
    """
    try:
        with get_db() as db:
            if not conversation_id:
                conversation = Conversation(title="Nova Conversa")
                db.add(conversation)
                db.commit()
                conversation_id = conversation.id
                logger.debug(f"Nova conversa criada com ID: {conversation_id}")
            else:
                conversation = db.query(Conversation).filter_by(id=conversation_id).first()
                if not conversation:
                    logger.warning(f"Conversa {conversation_id} não encontrada, criando nova")
                    conversation = Conversation(title="Nova Conversa")
                    db.add(conversation)
                    db.commit()
                    conversation_id = conversation.id

            # Salva a mensagem do usuário
            user_message = Message(
                conversation_id=conversation_id,
                role='user',
                content=message
            )
            db.add(user_message)
            
            # Salva a resposta do assistente
            assistant_message = Message(
                conversation_id=conversation_id,
                role='assistant',
                content=response
            )
            db.add(assistant_message)
            
            db.commit()
            logger.debug(f"Mensagens salvas para conversa {conversation_id}")
            
            return conversation_id
            
    except Exception as e:
        logger.error(f"Erro ao salvar conversa: {str(e)}")
        raise

def get_conversation_history():
    """Retorna o histórico completo de conversas com suas mensagens"""
    try:
        with get_db() as db:
            conversations = db.query(Conversation).order_by(Conversation.timestamp.desc()).all()
            history = []
            
            for conv in conversations:
                messages = db.query(Message).filter_by(conversation_id=conv.id).order_by(Message.timestamp).all()
                history.append({
                    'id': conv.id,
                    'title': conv.title,
                    'timestamp': conv.timestamp.isoformat(),
                    'messages': [{
                        'role': msg.role,
                        'content': msg.content,
                        'timestamp': msg.timestamp.isoformat()
                    } for msg in messages]
                })
            
            logger.debug(f"Carregadas {len(history)} conversas do histórico")
            return history
            
    except Exception as e:
        logger.error(f"Erro ao carregar histórico: {str(e)}")
        return []