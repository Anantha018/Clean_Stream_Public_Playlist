document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchInput');
    let currentAudio = null;
    let loopSameSong = false; // Flag to control looping of the same song

    function triggerFilter() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        filterPlaylists(searchTerm);
    }

    searchInput.addEventListener('input', triggerFilter);
    searchInput.addEventListener('click', triggerFilter);

    document.querySelectorAll(".video-title").forEach(title => {
        title.addEventListener("click", function() {
            const videoUrl = this.getAttribute("data-audio-url");
            const titleText = this.getAttribute("data-title");
            playAudio(videoUrl, titleText);
        });
    });

    document.querySelectorAll(".thumbnail").forEach(thumbnail => {
        thumbnail.addEventListener("click", function() {
            const videoInfo = this.closest(".video-info");
            if (!videoInfo) return;
    
            const titleElement = videoInfo.querySelector(".video-title");
            if (!titleElement) return;
    
            const videoUrl = titleElement.getAttribute("data-audio-url");
            const titleText = titleElement.getAttribute("data-title");
    
            if (videoUrl) {
                playAudio(videoUrl, titleText);
            }
        });
    });

    // Function to filter playlist items based on search input
    function filterPlaylists(searchTerm) {
        document.querySelectorAll('.video-title').forEach(title => {
            const videoTitle = title.textContent.trim().toLowerCase();
            const parentLi = title.closest('li');
            parentLi.style.display = videoTitle.includes(searchTerm) ? 'flex' : 'none';
        });
    }

    function fetchAudioUrl(videoUrlOrId) {
        const match = videoUrlOrId.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/);
        const videoId = match ? match[1] : videoUrlOrId;
    
        return fetch(`/audio/?video_id=${encodeURIComponent(videoId)}`)
            .then(response => response.json())
            .then(data => data.audio_url || null)
            .catch(() => null);
    }

    function playAudio(videoUrl, title) {

        fetchAudioUrl(videoUrl).then(audioUrl => {
            if (audioUrl) {
                const audioPlayer = document.createElement('div');
                audioPlayer.classList.add('audioPlayer', 'active');
                truncatedTitle = title.length > 20 ? title.substring(0, 20) + '...' : title;
                document.title = truncatedTitle;
                audioPlayer.innerHTML = `
                    <h2>${truncatedTitle}</h2>
                    
                    <audio controls autoplay preload="auto" src="${audioUrl}"></audio> 
                    <div class="audio-controls">
                        <button class="prev-btn"><i class="fas fa-step-backward"></i></button>
                        <button class="play-btn"><i class="fas fa-pause"></i></button>
                        <button class="next-btn"><i class="fas fa-step-forward"></i></button>
                        <button class="loop-btn" id="loop-toggle-btn"><i class="fas fa-redo-alt"></i></button>
                    </div>
                `;
    
                const audioPlayerContainer = document.getElementById('audioPlayer');
                audioPlayerContainer.innerHTML = '';
                audioPlayerContainer.appendChild(audioPlayer);
                currentAudio = audioPlayer.querySelector('audio');
    
                // Highlight logic
                document.querySelectorAll('.video-title').forEach(title => {
                    title.style.color = '';
                });
    
                const currentTitle = document.querySelector(`.video-title[data-audio-url="${videoUrl}"]`);
                if (currentTitle) {
                    currentTitle.style.color = '#63c748';
                }
    
                currentAudio.addEventListener('ended', function() {
                    loopSameSong ? (currentAudio.currentTime = 0, currentAudio.play()) : playNext();
                });
    
                document.querySelector('.prev-btn').addEventListener('click', playPrevious);
                document.querySelector('.play-btn').addEventListener('click', togglePlayPause);
                document.querySelector('.next-btn').addEventListener('click', playNext);
                document.querySelector('.loop-btn').addEventListener('click', toggleLoopSameSong);
            } else {
                playNext();
            }
        }).catch(() => playNext());
    }
        
    function togglePlayPause() {
        const icon = document.querySelector('.play-btn i');
    
        if (currentAudio.paused || currentAudio.ended) {
            if (currentAudio.ended) {
                currentAudio.currentTime = 0;
            }
            currentAudio.play();
            if (icon) {
                icon.classList.remove('fa-play');
                icon.classList.add('fa-pause');
            }
        } else {
            currentAudio.pause();
            if (icon) {
                icon.classList.remove('fa-pause');
                icon.classList.add('fa-play');
            }
        }
    }
    
    if(currentAudio) {
        currentAudio.addEventListener('play', () => {
            const icon = document.querySelector('.play-btn i');
            if (icon) {
                icon.classList.remove('fa-play');
                icon.classList.add('fa-pause');
            }
        });
        
        currentAudio.addEventListener('pause', () => {
            const icon = document.querySelector('.play-btn i');
            if (icon) {
                icon.classList.remove('fa-pause');
                icon.classList.add('fa-play');
            }
        });
    }
    

    function playPrevious() {
        const titles = Array.from(document.querySelectorAll('.video-title'));
        const currentIndex = titles.findIndex(title => title.style.color === 'rgb(99, 199, 72)');

        if (currentIndex === -1) return;

        let prevIndex = (currentIndex - 1 + titles.length) % titles.length;
        const prevTitle = titles[prevIndex];

        if (prevTitle) playAudio(prevTitle.getAttribute("data-audio-url"), prevTitle.getAttribute("data-title"));
    }

    function playNext() {
        const titles = Array.from(document.querySelectorAll('.video-title'));
        const currentIndex = titles.findIndex(title => title.style.color === 'rgb(99, 199, 72)');

        if (currentIndex === -1) return;

        let nextIndex = (currentIndex + 1) % titles.length;
        const nextTitle = titles[nextIndex];

        if (nextTitle) playAudio(nextTitle.getAttribute("data-audio-url"), nextTitle.getAttribute("data-title"));
    }

    function toggleLoopSameSong() {
        loopSameSong = !loopSameSong;
        document.querySelector('.loop-btn').classList.toggle('active', loopSameSong);
    }
});
