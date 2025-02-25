
import os
import json
import yt_dlp
import re
from typing import Optional, Dict, Any, Tuple

class YoutubeHandler:
    def __init__(self, download_path: str = "./temp"):
        self.download_path = download_path
        if not os.path.exists(download_path):
            os.makedirs(download_path)

    def download_subtitles(self, video_url: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Baixa as legendas de um vídeo do YouTube, priorizando PT-BR
        Retorna uma tupla (caminho_do_arquivo, título_do_vídeo)
        """
        ydl_opts = {
            'writesubtitles': True,
            'writeautomaticsub': True,  # Aceita legendas automáticas como fallback
            'subtitleslangs': ['pt-BR', 'pt', 'en'],  # Prioridade: PT-BR > PT > EN
            'skip_download': True,
            'outtmpl': os.path.join(self.download_path, '%(id)s.%(ext)s'),
            'quiet': True
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                video_id = info['id']
                video_title = info.get('title', 'Vídeo sem título')
                
                # Procura primeiro por legendas em PT-BR
                pt_br_files = ['.pt-BR.vtt', '.pt_BR.vtt', '.pt-br.vtt']
                for suffix in pt_br_files:
                    file = os.path.join(self.download_path, f"{video_id}{suffix}")
                    if os.path.exists(file):
                        print(f"Encontradas legendas em PT-BR: {file}")
                        return file, video_title
                
                # Procura por legendas em PT
                pt_files = ['.pt.vtt', '.pt-PT.vtt']
                for suffix in pt_files:
                    file = os.path.join(self.download_path, f"{video_id}{suffix}")
                    if os.path.exists(file):
                        print(f"Encontradas legendas em PT: {file}")
                        return file, video_title
                
                # Fallback para EN
                en_file = os.path.join(self.download_path, f"{video_id}.en.vtt")
                if os.path.exists(en_file):
                    print("Usando legendas em inglês como fallback")
                    return en_file, video_title
                
                # Último recurso: qualquer arquivo .vtt disponível
                for file in os.listdir(self.download_path):
                    if file.startswith(video_id) and file.endswith('.vtt'):
                        print(f"Usando legendas disponíveis: {file}")
                        return os.path.join(self.download_path, file), video_title
                
                return None, None
                
        except Exception as e:
            print(f"Erro ao baixar legendas: {str(e)}")
            return None, None

    def clean_subtitles(self, subtitle_file: str) -> Optional[str]:
        """
        Limpa as legendas removendo timestamps, formatação e repetições
        Retorna o texto limpo
        """
        if not os.path.exists(subtitle_file):
            return None

        try:
            # Tenta diferentes codificações
            content = None
            for encoding in ['utf-8', 'latin1', 'cp1252']:
                try:
                    with open(subtitle_file, 'r', encoding=encoding) as f:
                        content = f.read()
                        break
                except UnicodeDecodeError:
                    continue
            
            if content is None:
                raise Exception("Não foi possível ler o arquivo com nenhuma codificação suportada")

            # Remove cabeçalho WEBVTT e metadados
            content = re.sub(r'WEBVTT.*\n', '', content)
            content = re.sub(r'Kind:.*\n', '', content)
            content = re.sub(r'Language:.*\n', '', content)
            
            # Remove timestamps e números de sequência
            content = re.sub(r'\d{2}:\d{2}:\d{2}[\.,]\d{3} --> .*\n', '', content)
            content = re.sub(r'^\d+$', '', content, flags=re.MULTILINE)
            
            # Remove tags HTML e formatação
            content = re.sub(r'<[^>]+>', '', content)
            content = re.sub(r'{\\an\d}', '', content)
            content = re.sub(r'\[.*?\]', '', content)
            
            # Processa linha por linha removendo duplicatas
            seen_lines = set()
            cleaned_lines = []
            
            for line in content.split('\n'):
                line = line.strip()
                if line and not line.startswith(('<', '{', '[')) and line not in seen_lines:
                    cleaned_lines.append(line)
                    seen_lines.add(line)

            # Remove arquivo temporário
            os.remove(subtitle_file)
            
            # Junta as linhas com espaço e remove espaços extras
            return ' '.join(cleaned_lines).strip()
            
        except Exception as e:
            print(f"Erro ao limpar legendas: {str(e)}")
            return None
