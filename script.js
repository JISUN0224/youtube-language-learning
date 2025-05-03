let player, subtitles = [], currentSubtitleIndex = -1;

// 시간 문자열 "00:01:23,456" → 초(float)로 변환
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
            'onReady': () => {
                document.getElementById('loadVideo').addEventListener('click', loadVideo);
            },
            'onStateChange': (e) => {
                if (e.data === YT.PlayerState.PLAYING) {
                    clearInterval(window.subtitleInterval);
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

        subtitles = raw.map(item => ({
            start: timeStringToSeconds(item.start_time),
            end: timeStringToSeconds(item.end_time),
            text: item.text
        }));

        displaySubtitles();
    } catch (err) {
        console.error("자막 로드 오류:", err);
        document.getElementById('subtitles').innerHTML =
            "<div class='error'>자막 데이터를 불러오는 데 실패했습니다.</div>";
    }
}

function displaySubtitles() {
    const container = document.getElementById('subtitles');
    container.innerHTML = '';
    subtitles.forEach((sub, index) => {
        const div = document.createElement('div');
        div.className = 'subtitle-line';
        div.dataset.index = index;
        div.innerText = sub.text;
        container.appendChild(div);
    });
}

function updateSubtitleHighlight() {
    if (!player || !subtitles.length) return;

    const currentTime = player.getCurrentTime() + 8; // 🔧 동기화 보정

    subtitles.forEach((sub, index) => {
        const el = document.querySelector(`.subtitle-line[data-index='${index}']`);
        if (el) {
            if (currentTime >= sub.start && currentTime <= sub.end) {
                el.classList.add('highlight');
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                el.classList.remove('highlight');
            }
        }
    });
}
