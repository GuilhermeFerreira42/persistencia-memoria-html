import sqlite3
from contextlib import contextmanager
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

DATABASE_PATH = 'backend/database/nosso_projeto.db'

def ensure_data_directory():
    """Garante que o diretório data/ existe"""
    os.makedirs('backend/database', exist_ok=True)

# Configuração SQLAlchemy
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DATABASE_PATH}"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def init_db():
    """Inicializa o banco de dados e cria as tabelas se não existirem"""
    ensure_data_directory()
    Base.metadata.create_all(bind=engine)

@contextmanager
def get_db():
    """Context manager para conexão com o banco"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()