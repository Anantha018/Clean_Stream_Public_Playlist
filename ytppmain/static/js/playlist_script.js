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
            const thumbnail = this.closest(".video-info")?.querySelector(".thumbnail");
            const thumbnail_url = thumbnail ? thumbnail.src : '';
            playAudio(videoUrl, titleText, thumbnail_url);
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
            const thumbnailElement = videoInfo.querySelector(".thumbnail");
            const thumbnail_url = thumbnailElement ? thumbnailElement.src : '';

            if (videoUrl) {
                playAudio(videoUrl, titleText, thumbnail_url);
            }
        });
    });

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

    function playAudio(videoUrl, title, thumbnail_url) {
        requestWakeLock(); // Request wake lock when audio starts playing

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
                        <button class="loop-btn" id="loop-toggle-btn"><i class="fa-solid fa-repeat"></i></button>
                    </div>
                `;

                const audioPlayerContainer = document.getElementById('audioPlayer');
                audioPlayerContainer.innerHTML = '';
                audioPlayerContainer.appendChild(audioPlayer);
                currentAudio = audioPlayer.querySelector('audio');

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

                setupMediaSession(currentAudio, title, thumbnail_url);

                document.querySelector('.prev-btn').addEventListener('click', playPrevious);
                document.querySelector('.play-btn').addEventListener('click', togglePlayPause);
                document.querySelector('.next-btn').addEventListener('click', playNext);
                document.querySelector('.loop-btn').addEventListener('click', toggleLoopSameSong);
            } else {
                playNext();
            }
        }).catch(() => playNext());
    }

    function setupMediaSession(audio, title, thumbnailUrl) {
        if ('mediaSession' in navigator && audio) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artwork: [
                    { src: thumbnailUrl || 'default_thumbnail.png', sizes: '96x96', type: 'image/png' },
                    { src: thumbnailUrl || 'default_thumbnail.png', sizes: '128x128', type: 'image/png' },
                    { src: thumbnailUrl || 'default_thumbnail.png', sizes: '192x192', type: 'image/png' }
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => { audio.play(); updatePlayPauseIcon(); });
            navigator.mediaSession.setActionHandler('pause', () => { audio.pause(); updatePlayPauseIcon(); });
            navigator.mediaSession.setActionHandler('previoustrack', playPrevious);
            navigator.mediaSession.setActionHandler('nexttrack', playNext);

            audio.addEventListener('timeupdate', () => {
                if ('setPositionState' in navigator.mediaSession) {
                    try {
                        navigator.mediaSession.setPositionState({
                            duration: audio.duration || 0,
                            playbackRate: audio.playbackRate || 1,
                            position: audio.currentTime || 0
                        });
                    } catch {}
                }
            });
        }
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

    function updatePlayPauseIcon() {
        const icon = document.querySelector('.play-btn i');
        if (!currentAudio || !icon) return;
    
        if (currentAudio.paused) {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
        } else {
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
        }
    }
    
    function playPrevious() {
        requestWakeLock();  // Request wake lock when audio starts playing
        const titles = Array.from(document.querySelectorAll('.video-title'));
        const currentIndex = titles.findIndex(title => title.style.color === 'rgb(99, 199, 72)');

        if (currentIndex === -1) return;

        let prevIndex = (currentIndex - 1 + titles.length) % titles.length;
        const prevTitle = titles[prevIndex];

        if (prevTitle) {
            const videoInfo = prevTitle.closest('.video-info');
            const thumbnail = videoInfo?.querySelector('.thumbnail');
            const thumbnail_url = thumbnail ? thumbnail.src : '';
            playAudio(prevTitle.getAttribute("data-audio-url"), prevTitle.getAttribute("data-title"), thumbnail_url);
        }
    }

    function playNext() {
        requestWakeLock(); // Request wake lock when audio starts playing
        const titles = Array.from(document.querySelectorAll('.video-title'));
        const currentIndex = titles.findIndex(title => title.style.color === 'rgb(99, 199, 72)');

        if (currentIndex === -1) return;

        let nextIndex = (currentIndex + 1) % titles.length;
        const nextTitle = titles[nextIndex];

        if (nextTitle) {
            const videoInfo = nextTitle.closest('.video-info');
            const thumbnail = videoInfo?.querySelector('.thumbnail');
            const thumbnail_url = thumbnail ? thumbnail.src : '';
            playAudio(nextTitle.getAttribute("data-audio-url"), nextTitle.getAttribute("data-title"), thumbnail_url);
        }
    }

    function toggleLoopSameSong() {
        loopSameSong = !loopSameSong;
        document.querySelector('.loop-btn').classList.toggle('active', loopSameSong);
    }

    
});

// Function to request a wake lock
async function requestWakeLock() {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
            // console.log('Wake lock released; re-requesting...');
            
            requestWakeLock();
        });
    } catch (err) {
        // console.error(`${err.name}, ${err.message}`);
    }
}

// Function to release the wake lock
function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release()
        .then(() => {
            wakeLock = null;
        });
    }
}

// Re-acquire wake lock on visibility change if needed
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
    } else {
      // Optionally release the lock when the page is hidden
      // releaseWakeLock();
    }
});

// Release wake lock when playback stops
audioPlayer.addEventListener('pause', releaseWakeLock);
audioPlayer.addEventListener('ended', releaseWakeLock);
