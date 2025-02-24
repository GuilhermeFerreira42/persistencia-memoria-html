
import os
import json
import yt_dlp
import re
from typing import Optional, Dict, Any

class YoutubeHandler:
    def __init__(self, download_path: str = "./temp"):
        self.download_path = download_path
        if not os.path.exists(download_path):
            os.makedirs(download_path)

    def download_subtitles(self, video_url: str) -> Optional[str]:
        """
        Baixa as legendas de um vídeo do YouTube, priorizando português
        Retorna o caminho do arquivo de legendas ou None se falhar
        """
        ydl_opts = {
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['pt', 'en'],  # Prioriza português
            'skip_download': True,
            'outtmpl': os.path.join(self.download_path, '%(id)s.%(ext)s'),
            'quiet': True
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                video_id = info['id']
                
                # Procura primeiro por legendas em português
                for suffix in ['.pt.vtt', '.pt-BR.vtt', '.pt-PT.vtt']:
                    pt_file = os.path.join(self.download_path, f"{video_id}{suffix}")
                    if os.path.exists(pt_file):
                        print(f"Encontradas legendas em português: {pt_file}")
                        return pt_file
                
                # Se não encontrar em português, procura em inglês
                en_file = os.path.join(self.download_path, f"{video_id}.en.vtt")
                if os.path.exists(en_file):
                    print("Usando legendas em inglês como fallback")
                    return en_file
                
                # Procura por qualquer arquivo .vtt como último recurso
                for file in os.listdir(self.download_path):
                    if file.startswith(video_id) and file.endswith('.vtt'):
                        print(f"Usando legendas disponíveis: {file}")
                        return os.path.join(self.download_path, file)
                
                return None
                
        except Exception as e:
            print(f"Erro ao baixar legendas: {str(e)}")
            return None

    def clean_subtitles(self, subtitle_file: str) -> Optional[str]:
        """
        Limpa as legendas removendo timestamps e formatação
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
            
            # Remove timestamps
            content = re.sub(r'\d{2}:\d{2}:\d{2}[\.,]\d{3} --> .*\n', '', content)
            
            # Remove números de sequência
            content = re.sub(r'^\d+\n', '', content, flags=re.MULTILINE)
            
            # Remove tags HTML e formatação
            content = re.sub(r'<[^>]+>', '', content)
            content = re.sub(r'{\\an\d}', '', content)
            
            # Processa linha por linha
            cleaned_lines = []
            for line in content.split('\n'):
                line = line.strip()
                if line and not line.startswith(('<', '{', '[')):
                    cleaned_lines.append(line)

            # Remove arquivo temporário
            os.remove(subtitle_file)
            
            # Junta as linhas com espaço
            return ' '.join(cleaned_lines)
            
        except Exception as e:
            print(f"Erro ao limpar legendas: {str(e)}")
            return None
