document.addEventListener('DOMContentLoaded', function () {
    const playButtons = document.querySelectorAll('.play-audio');
    const searchInput = document.getElementById('searchInput');
    let currentAudio = null;
    let loopSameSong = false; // Flag to control looping of the same song

    function triggerFilter() {
        const searchTerm = searchInput.value.trim().toLowerCase(); //  Get lowercase search term
        filterPlaylists(searchTerm); //  Call filtering function
    }

    searchInput.addEventListener('input', triggerFilter); //  Trigger on typing
    searchInput.addEventListener('click', triggerFilter); //  Trigger on click

    document.querySelectorAll(".video-title").forEach(title => {
        title.addEventListener("click", function() {
            const audioUrl = this.getAttribute("data-audio-url");
            const titleText = this.getAttribute("data-title");
            playAudio(audioUrl, titleText);
        });
    });

    document.querySelectorAll(".thumbnail").forEach(thumbnail => {
        thumbnail.addEventListener("click", function() {
            const videoInfo = this.closest(".video-info"); //  Get parent container
            if (!videoInfo) return;
    
            const titleElement = videoInfo.querySelector(".video-title"); //  Find title
            if (!titleElement) return;
    
            const audioUrl = titleElement.getAttribute("data-audio-url");
            const titleText = titleElement.getAttribute("data-title");
    
            if (audioUrl) {
                playAudio(audioUrl, titleText);
            } else {
                // console.error("No audio URL found for this thumbnail.");
            }
        });
    });
    

    // Function to handle filtering of playlist items based on search input
    function filterPlaylists(searchTerm) {
        const titles = document.querySelectorAll('.video-title'); //  Get all titles
    
        titles.forEach(title => {
            const videoTitle = title.textContent.trim().toLowerCase(); //  Get text
            const parentLi = title.closest('li'); //  Find the correct <li> element
    
            if (videoTitle.includes(searchTerm)) {
                parentLi.style.display = 'flex';  //  Show matching items
            } else {
                parentLi.style.display = 'none';  //  Hide non-matching items
            }
        });
    }
    

    // Function to play audio
    function playAudio(audioUrl, title) {

        if (!audioUrl) {
            console.error("Error: audioUrl is null or undefined");
            return; // Stop execution if audioUrl is missing
        }

        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        fetch(`/audio/${audioUrl.split('/').pop()}`)
            .then(response => response.json())
            .then(data => {
                if (data.audio_url) {
                    document.title = title;
                    const audioPlayer = document.createElement('div');
                    audioPlayer.classList.add('audioPlayer', 'active');
                    audioPlayer.innerHTML = `
                        <h2>${title}</h2>
                        <audio controls autoplay>
                            <source src="${data.audio_url}" type="audio/mpeg">
                            Your browser does not support the audio element.
                        </audio>
                        
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

                    // Reset color of all titles
                    document.querySelectorAll('.video-title').forEach(title => {
                        title.style.color = ''; // Reset to default color
                    });

                    // Highlight the currently playing title
                    const currentTitle = document.querySelector(`.video-title[data-audio-url="${audioUrl}"]`);
                    if (currentTitle) {
                        currentTitle.style.color = '#63c748'; // Change playing title to green
                    }

                    currentAudio.addEventListener('ended', function() {
                        if (loopSameSong) {
                            currentAudio.currentTime = 0; // Reset audio to beginning
                            currentAudio.play(); // Play the same song again
                        } else {
                            playNext(); // Play the next song in the playlist
                        }
                    });
                    
                    const prevButton = audioPlayer.querySelector('.prev-btn');
                    prevButton.addEventListener('click', playPrevious);
                    
                    const playPauseButton = audioPlayer.querySelector('.play-btn');
                    playPauseButton.addEventListener('click', togglePlayPause);
                    
                    const nextButton = audioPlayer.querySelector('.next-btn');
                    nextButton.addEventListener('click', playNext);
                    
                    const loopButton = audioPlayer.querySelector('.loop-btn');
                    loopButton.addEventListener('click', toggleLoopSameSong);

                    currentAudio.addEventListener('timeupdate', function() {
                        if (!currentAudio) return; // Prevent error if currentAudio is null
                    
                        if (currentAudio.paused) {
                            playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
                        } else {
                            playPauseButton.innerHTML = '<i class="fas fa-pause"></i>';
                        }
                    });                    
                    // Update playButtons to reflect current playing state
                    playButtons.forEach(btn => btn.classList.remove('playing'));
                    const currentButton = Array.from(playButtons).find(btn => btn.dataset.audioUrl === audioUrl);
                    if (currentButton) {
                        currentButton.classList.add('playing');
                    }
                } else {
                    playNext();
                }
            })
            .catch(error => {
                // console.error('Error fetching audio:');
                playNext();
            });
    }

    // Function to toggle play/pause
    function togglePlayPause() {
        if (currentAudio.paused || currentAudio.ended) {
            if (currentAudio.ended) {
                currentAudio.currentTime = 0;
            }
            currentAudio.play();
        } else {
            currentAudio.pause();
        }
    }
    
    // Function to play previous song
    function playPrevious() {
        const titles = Array.from(document.querySelectorAll('.video-title'));
        const currentIndex = titles.findIndex(title => title.style.color === 'rgb(99, 199, 72)'); // Green color
    
        if (currentIndex === -1) {
            console.error("No currently playing song found.");
            return;
        }
    
        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) {
            prevIndex = titles.length - 1; // Loop to last song
        }
    
        const prevTitle = titles[prevIndex];
        if (!prevTitle) {
            console.error("No previous song found.");
            return;
        }
    
        const audioUrl = prevTitle.getAttribute("data-audio-url");
        const titleText = prevTitle.getAttribute("data-title");
    
        if (audioUrl) {
            playAudio(audioUrl, titleText);
        }
    }    

    // Function to play next song
    function playNext() {
        const titles = Array.from(document.querySelectorAll('.video-title')); // Get all titles
        const currentIndex = titles.findIndex(title => title.style.color === 'rgb(99, 199, 72)'); // Green color

        if (currentIndex === -1) {
            console.error("No currently playing song found.");
            return; // Stop execution if no song is playing
        }

        let nextIndex = currentIndex + 1;
        if (nextIndex >= titles.length) {
            nextIndex = 0; // Loop back to the first song if at the end
        }

        const nextTitle = titles[nextIndex];
        if (!nextTitle) {
            console.error("No next song found.");
            return;
        }

        const audioUrl = nextTitle.getAttribute("data-audio-url");
        const titleText = nextTitle.getAttribute("data-title");

        if (audioUrl) {
            playAudio(audioUrl, titleText);
        }
    }

    
    // Function to toggle loopSameSong flag
    function toggleLoopSameSong() {
        loopSameSong = !loopSameSong; // Toggle the flag
        const loopButton = document.querySelector('.loop-btn');
        loopButton.classList.toggle('active', loopSameSong); // Toggle active class based on loopSameSong flag
    }
    // Attach click event listeners to playButtons
    playButtons.forEach(button => {
        button.addEventListener('click', function (event) {
            event.preventDefault();
            playButtons.forEach(btn => btn.classList.remove('playing'));
            button.classList.add('playing');
            playAudio(button.dataset.audioUrl, button.dataset.title);
        });
    });
    // Automatically play the first song if available
    if (playButtons.length > 0) {
        const firstButton = playButtons[0];
        if (firstButton.dataset.audioUrl) {
            firstButton.classList.add('playing');
            playAudio(firstButton.dataset.audioUrl, firstButton.dataset.title);
        }
    }
    const container = document.querySelector('.container');
    const audioPlayer = document.getElementById('audioPlayer');
    // Toggle active class on audioPlayer based on scroll position
    window.addEventListener('scroll', function() {
        const rect = container.getBoundingClientRect();
        audioPlayer.classList.toggle('active', rect.top <= 0);
    });
});
