from sqlalchemy import Column, String, DateTime, Text
from backend.database.database import Base
from datetime import datetime
import uuid

class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow)
    meta = Column(Text, default='{}')

    @staticmethod
    def create(title="Nova Conversa"):
        """Cria uma nova conversa"""
        from backend.database.database import SessionLocal
        
        db = SessionLocal()
        try:
            conversation = Conversation(title=title)
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
            return conversation.id
        finally:
            db.close()

    @staticmethod
    def get_all():
        """Retorna todas as conversas"""
        from backend.database.database import SessionLocal
        
        db = SessionLocal()
        try:
            return db.query(Conversation).order_by(Conversation.timestamp.desc()).all()
        finally:
            db.close()

    @staticmethod
    def get_by_id(conversation_id):
        """Busca uma conversa específica pelo ID"""
        from backend.database.database import SessionLocal
        
        db = SessionLocal()
        try:
            return db.query(Conversation).filter_by(id=conversation_id).first()
        finally:
            db.close()

    @staticmethod
    def delete(conversation_id):
        """Deleta uma conversa e suas mensagens"""
        from backend.database.database import SessionLocal
        
        db = SessionLocal()
        try:
            conversation = db.query(Conversation).filter_by(id=conversation_id).first()
            if conversation:
                db.delete(conversation)
                db.commit()
                return True
            return False
        finally:
            db.close()