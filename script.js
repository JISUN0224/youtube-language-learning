let player, subtitles = [], currentSubtitleIndex = -1;

// jieba 사전 로딩
jieba.load();

// 시간 문자열("00:01:23,456") → 초(float)로 변환
function timeStringToSeconds(timeStr) {
    const [hms, ms] = timeStr.split(',');
    const [h, m, s] = hms.split(':').map(Number);
    return h * 3600 + m * 60 + s + (parseInt(ms) || 0) / 1000;
}

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '390',
        width: '640',
        videoId: '',
        events: {
            'onReady': () => document.getElementById('loadVideo').addEventListener('click', loadVideo),
            'onStateChange': (e) => {
                if (e.data === YT.PlayerState.PLAYING) {
                    clearInterval(window.subtitleInterval); // 중복 방지
                    window.subtitleInterval = setInterval(updateSubtitleHighlight, 100);
                } else {
                    clearInterval(window.subtitleInterval);
                }
            }
        }
    });
}

function loadVideo() {
    const videoId = document.getElementById('videoId').value;
    if (videoId) {
        player.loadVideoById(videoId);
        fetchSubtitles();
    }
}

async function fetchSubtitles() {
    try {
        const res = await fetch('shanzhashuzhilian_cn.json');
        const raw = await res.json();

        // 문자열 시간 → 초로 변환
        subtitles = raw.map(item => ({
            start: timeStringToSeconds(item.start_time),
            end: timeStringToSeconds(item.end_time),
            text: item.text
        }));

        processSubtitles();
        displaySubtitles();
    } catch (err) {
        console.error("자막 로드 오류:", err);
        document.getElementById('subtitles').innerHTML = "<div class='error'>자막 데이터를 불러오는 데 실패했습니다.</div>";
    }
}

function processSubtitles() {
    subtitles.forEach(sub => {
        const text = sub.text;
        const match = text.match(/[\u4e00-\u9fa5]{2,}/); // 2자 이상 한자
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
    if (!player || !subtitles.length) return;

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
