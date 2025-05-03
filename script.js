let player, subtitles = [], currentSubtitleIndex = -1;

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '390', width: '640', videoId: '',
        events: {
            'onReady': () => document.getElementById('loadVideo').addEventListener('click', loadVideo),
            'onStateChange': (e) => {
                if (e.data === YT.PlayerState.PLAYING)
                    setInterval(updateSubtitleHighlight, 100);
            }
        }
    });
}

function loadVideo() {
    const videoId = document.getElementById('videoId').value;
    if (videoId) {
        player.loadVideoById(videoId);
        fetchSubtitles();  // 항상 subtitles.json 불러옴
    }
}

async function fetchSubtitles() {
    const res = await fetch('subtitles.json');
    subtitles = await res.json();
    processSubtitles();
    displaySubtitles();
}

function processSubtitles() {
    subtitles.forEach(sub => {
        // 간단한 괄호 처리 (2글자 이상 단어를 랜덤으로)
        const text = sub.text;
        const match = text.match(/[\u4e00-\u9fa5]{2,}/); // 예: 한자 2글자 이상
        if (match) {
            const word = match[0];
            sub.processedText = text.replace(word, `<span class="placeholder" data-word="${word}">(___)</span>`);
        } else {
            sub.processedText = text;
        }
    });
}

function displaySubtitles() {
    const container = document.getElementById('subtitles');
    container.innerHTML = '';
    subtitles.forEach((sub, index) => {
        const div = document.createElement('div');
        div.className = 'subtitle-line';
        div.dataset.index = index;
        div.innerHTML = sub.processedText;
        container.appendChild(div);
    });

    document.querySelectorAll('.placeholder').forEach(el => {
        el.addEventListener('click', function () {
            this.innerText = this.dataset.word;
            this.classList.add('revealed');
        });
    });
}

function updateSubtitleHighlight() {
    const currentTime = player.getCurrentTime();
    subtitles.forEach((sub, index) => {
        const el = document.querySelector(`.subtitle-line[data-index='${index}']`);
        if (currentTime >= sub.start && currentTime <= sub.end) {
            el.classList.add('highlight');
        } else {
            el.classList.remove('highlight');
        }
    });
}
