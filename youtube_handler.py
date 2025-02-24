
import os
import json
import yt_dlp
from typing import Optional, Dict, Any

class YoutubeHandler:
    def __init__(self, download_path: str = "./temp"):
        self.download_path = download_path
        if not os.path.exists(download_path):
            os.makedirs(download_path)

    def download_subtitles(self, video_url: str) -> Optional[str]:
        """
        Baixa as legendas de um vídeo do YouTube
        Retorna o caminho do arquivo de legendas ou None se falhar
        """
        ydl_opts = {
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['pt', 'en'],
            'skip_download': True,
            'outtmpl': os.path.join(self.download_path, '%(id)s.%(ext)s'),
            'quiet': True
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                video_id = info['id']
                # Procura pelo arquivo de legendas
                for file in os.listdir(self.download_path):
                    if file.startswith(video_id) and file.endswith('.vtt'):
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

        cleaned_text = []
        try:
            with open(subtitle_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                
            for line in lines:
                # Pula linhas com timestamps e números
                if '-->' in line or line.strip().isdigit() or 'WEBVTT' in line:
                    continue
                # Remove tags HTML
                line = line.strip()
                if line and not line.startswith(('<', '{')):
                    cleaned_text.append(line)

            # Remove arquivo de legendas após processamento
            os.remove(subtitle_file)
            
            return ' '.join(cleaned_text)
        except Exception as e:
            print(f"Erro ao limpar legendas: {str(e)}")
            return None
