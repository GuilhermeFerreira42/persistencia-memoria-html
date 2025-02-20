
from urllib.parse import urlparse
import re

class YouTubeValidator:
    def __init__(self):
        self._allowed_domains = {'youtube.com', 'youtu.be'}
        self._id_pattern = re.compile(r'v=([a-zA-Z0-9_-]{11})')

    def is_valid(self, url: str) -> bool:
        try:
            parsed = urlparse(url)
            return (parsed.netloc.replace('www.', '') in self._allowed_domains and
                    bool(self._id_pattern.search(url)))
        except:
            return False
