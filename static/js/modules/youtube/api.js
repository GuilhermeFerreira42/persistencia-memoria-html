
export async function processYoutubeVideo(url) {
    try {
        const response = await fetch('/process_youtube', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao processar vídeo');
        }

        return await response.json();
    } catch (error) {
        console.error('Erro ao processar vídeo:', error);
        throw error;
    }
}
