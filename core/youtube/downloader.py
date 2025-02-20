
import yt_dlp
import tempfile
from pathlib import Path
from .exceptions import SubtitleNotFoundError, InvalidVideoError

class YouTubeDownloader:
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp(prefix="yt_dl_")
        
    def _get_ydl_config(self) -> dict:
        return {
            'writesubtitles': True,
            'writeautomaticsub': True,  # Permitir legendas automáticas
            'subtitleslangs': ['pt', 'en'],
            'skip_download': True,
            'outtmpl': str(Path(self.temp_dir) / '%(id)s'),
            'socket_timeout': 15,
            'ignoreerrors': False
        }

    def fetch(self, url: str) -> str:
        try:
            with yt_dlp.YoutubeDL(self._get_ydl_config()) as ydl:
                info = ydl.extract_info(url, download=True)
                return self._find_subtitle_file(info['id'])
        except yt_dlp.utils.DownloadError as e:
            raise InvalidVideoError(f"Falha crítica: {str(e)}") from e

    def _find_subtitle_file(self, video_id: str) -> str:
        for f in Path(self.temp_dir).glob(f"{video_id}*.vtt"):
            return str(f)
        raise SubtitleNotFoundError("Arquivo .vtt não encontrado")
