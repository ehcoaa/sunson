<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { sunsonTracks } from './data/sunsonTracks'
import { loadFlacMetadata } from './utils/flac'

type TrackStatus = 'loading' | 'ready' | 'missing'
type PlayMode = 'list' | 'single' | 'shuffle'

interface PlaylistTrack {
  id: string
  title: string
  note: string
  fileName: string
  src: string
  coverUrl: string | null
  duration: number | null
  artist: string
  album: string
  lyrics: string
  status: TrackStatus
}

const fallbackLyrics = [
  '在炽热与夜色之间，太阳之子的旋律像日冕一样扩散。',
  '如果 FLAC 文件内嵌了歌词标签，这里会自动展示真实歌词内容。',
  '你也可以继续告诉我，我会把歌词同步歌词、高亮滚动等能力继续补上。',
].join('\n')

const playlist = ref<PlaylistTrack[]>(
  sunsonTracks.map((track) => ({
    ...track,
    src: `/music/sunson/${track.fileName}`,
    coverUrl: null,
    duration: null,
    artist: '周杰伦专题收藏',
    album: '太阳之子',
    lyrics: fallbackLyrics,
    status: 'loading',
  })),
)

const playModeOptions: Array<{ value: PlayMode; label: string; short: string }> = [
  { value: 'list', label: '顺序播放', short: '顺序' },
  { value: 'single', label: '单曲循环', short: '单曲' },
  { value: 'shuffle', label: '随机播放', short: '随机' },
]

const audioRef = ref<HTMLAudioElement | null>(null)
const activeId = ref(playlist.value[0]?.id ?? '')
const isPlaying = ref(false)
const currentTime = ref(0)
const totalTime = ref(0)
const pendingPlayId = ref<string | null>(null)
const playMode = ref<PlayMode>('list')
const isLyricsOpen = ref(false)
const objectUrls: string[] = []
const waveformBars = Array.from({ length: 18 }, (_, index) => index)

const activeTrack = computed(
  () => playlist.value.find((track) => track.id === activeId.value) ?? playlist.value[0],
)

const loadedCount = computed(
  () => playlist.value.filter((track) => track.status === 'ready').length,
)

const totalDuration = computed(() =>
  playlist.value.reduce((sum, track) => sum + (track.duration ?? 0), 0),
)

const activeLyrics = computed(() => splitLyrics(activeTrack.value?.lyrics || fallbackLyrics))

const currentModeLabel = computed(
  () => playModeOptions.find((option) => option.value === playMode.value)?.label ?? '顺序播放',
)

function splitLyrics(rawLyrics: string) {
  return rawLyrics
    .split(/\r?\n/)
    .map((line) => line.replace(/\[[^\]]+\]/g, '').trim())
    .filter(Boolean)
}

function formatTime(seconds: number | null) {
  if (!seconds || Number.isNaN(seconds)) {
    return '--:--'
  }

  const total = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function formatTrackIndex(index: number) {
  return String(index + 1).padStart(2, '0')
}

function syncAudioState() {
  const audio = audioRef.value
  if (!audio) {
    return
  }

  currentTime.value = audio.currentTime
  totalTime.value = Number.isFinite(audio.duration) ? audio.duration : activeTrack.value?.duration ?? 0
  isPlaying.value = !audio.paused
}

async function tryPlayCurrent() {
  const audio = audioRef.value
  if (!audio) {
    return
  }

  try {
    await audio.play()
    syncAudioState()
  } catch {
    isPlaying.value = false
  }
}

async function activateTrack(trackId: string, autoplay = true) {
  activeId.value = trackId
  currentTime.value = 0
  totalTime.value = playlist.value.find((track) => track.id === trackId)?.duration ?? 0
  isPlaying.value = false

  if (!autoplay) {
    return
  }

  pendingPlayId.value = trackId
  await nextTick()

  if (pendingPlayId.value === trackId) {
    await tryPlayCurrent()
    pendingPlayId.value = null
  }
}

async function toggleTrack(trackId: string) {
  const audio = audioRef.value
  if (!audio) {
    return
  }

  if (activeId.value !== trackId) {
    await activateTrack(trackId, true)
    return
  }

  if (audio.paused) {
    await tryPlayCurrent()
    return
  }

  audio.pause()
  syncAudioState()
}

function seekAudio(event: Event) {
  const audio = audioRef.value
  const input = event.target as HTMLInputElement
  if (!audio) {
    return
  }

  const nextValue = Number(input.value)
  audio.currentTime = nextValue
  currentTime.value = nextValue
}

function getTrackIndex(trackId: string) {
  return playlist.value.findIndex((track) => track.id === trackId)
}

function getNextTrackId(direction: 1 | -1) {
  const currentIndex = getTrackIndex(activeId.value)
  if (currentIndex === -1 || playlist.value.length === 0) {
    return null
  }

  if (playMode.value === 'shuffle') {
    if (playlist.value.length === 1) {
      return playlist.value[0].id
    }

    let nextIndex = currentIndex
    while (nextIndex === currentIndex) {
      nextIndex = Math.floor(Math.random() * playlist.value.length)
    }
    return playlist.value[nextIndex]?.id ?? null
  }

  if (playMode.value === 'single' && direction === 1) {
    return playlist.value[currentIndex]?.id ?? null
  }

  const nextIndex = (currentIndex + direction + playlist.value.length) % playlist.value.length
  return playlist.value[nextIndex]?.id ?? null
}

async function stepTrack(direction: 1 | -1) {
  const nextTrackId = getNextTrackId(direction)
  if (!nextTrackId) {
    return
  }

  await activateTrack(nextTrackId, true)
}

function cyclePlayMode() {
  const currentIndex = playModeOptions.findIndex((option) => option.value === playMode.value)
  playMode.value = playModeOptions[(currentIndex + 1) % playModeOptions.length].value
}

async function handleEnded() {
  currentTime.value = 0
  isPlaying.value = false

  const nextTrackId = getNextTrackId(1)
  if (!nextTrackId) {
    totalTime.value = activeTrack.value?.duration ?? 0
    return
  }

  await activateTrack(nextTrackId, true)
}

function closeLyrics() {
  isLyricsOpen.value = false
}

async function loadTrackMeta(track: PlaylistTrack) {
  try {
    const response = await fetch(track.src, { method: 'HEAD' })
    if (!response.ok) {
      track.status = 'missing'
      return
    }

    const metadata = await loadFlacMetadata(track.src)
    track.coverUrl = metadata.pictureUrl ?? null
    track.duration = metadata.duration ?? null
    track.artist = metadata.artist || track.artist
    track.album = metadata.album || track.album
    track.title = metadata.title || track.title
    track.lyrics = metadata.lyrics?.trim() || track.lyrics

    if (metadata.pictureUrl) {
      objectUrls.push(metadata.pictureUrl)
    }

    track.status = 'ready'
  } catch {
    track.status = 'ready'
  }
}

onMounted(async () => {
  await Promise.all(playlist.value.map((track) => loadTrackMeta(track)))
  totalTime.value = activeTrack.value?.duration ?? 0
})

onBeforeUnmount(() => {
  objectUrls.forEach((url) => URL.revokeObjectURL(url))
})
</script>

<template>
  <div class="sunson-page">
    <section class="hero-shell">
      <div class="hero-copy">
        <p class="eyebrow">Jay Chou Special Playlist</p>
        <h1>太阳之子</h1>
        <p class="hero-text">
          以日冕、热浪与夜幕余晖为舞台，整理《太阳之子》专题的 13 首 FLAC 音乐。封面从音频内嵌图中自动提取，页面支持在线播放、下载、歌词阅读与多种播放模式。
        </p>

        <div class="hero-stats">
          <div class="stat-card">
            <span class="stat-label">专题曲目</span>
            <strong>{{ playlist.length }}</strong>
          </div>
          <div class="stat-card">
            <span class="stat-label">已就绪</span>
            <strong>{{ loadedCount }}</strong>
          </div>
          <div class="stat-card">
            <span class="stat-label">总时长</span>
            <strong>{{ formatTime(totalDuration) }}</strong>
          </div>
        </div>

        <div class="feature-ribbon">
          <span>封面解析</span>
          <span>歌词弹层</span>
          <span>{{ currentModeLabel }}</span>
          <span>波形动效</span>
        </div>
      </div>

      <div class="featured-player" v-if="activeTrack">
        <div class="cover-frame" :class="{ empty: !activeTrack.coverUrl }">
          <img
            v-if="activeTrack.coverUrl"
            :src="activeTrack.coverUrl"
            :alt="`${activeTrack.title} cover`"
          />
          <div v-else class="fallback-cover">
            <span>Sun</span>
            <strong>{{ activeTrack.title.slice(-2) }}</strong>
          </div>
          <div class="cover-glow"></div>
        </div>

        <div class="player-copy">
          <div class="player-headline">
            <div>
              <p class="player-kicker">Now Featuring</p>
              <h2>{{ activeTrack.title }}</h2>
            </div>
            <button class="mode-switch" type="button" @click="cyclePlayMode">
              <span>播放模式</span>
              <strong>{{ currentModeLabel }}</strong>
            </button>
          </div>

          <p class="player-meta">{{ activeTrack.artist }} · {{ activeTrack.album }}</p>
          <p class="player-note">{{ activeTrack.note }}</p>

          <div class="waveform" :class="{ playing: isPlaying }" aria-hidden="true">
            <span
              v-for="bar in waveformBars"
              :key="bar"
              class="wave-bar"
              :style="{ '--delay': `${bar * 0.08}s`, '--height': `${28 + ((bar % 6) + 1) * 7}px` }"
            ></span>
          </div>
        </div>

        <div class="player-actions">
          <button class="ghost-icon-btn" type="button" @click="stepTrack(-1)">上一首</button>
          <button class="primary-btn" type="button" @click="toggleTrack(activeTrack.id)">
            {{ isPlaying ? '暂停播放' : '开始播放' }}
          </button>
          <button class="ghost-icon-btn" type="button" @click="stepTrack(1)">下一首</button>
          <button class="ghost-btn" type="button" @click="isLyricsOpen = true">查看歌词</button>
          <a class="ghost-btn" :href="activeTrack.src" :download="activeTrack.fileName">下载 FLAC</a>
        </div>

        <div class="progress-block">
          <span>{{ formatTime(currentTime) }}</span>
          <input
            type="range"
            min="0"
            :max="Math.max(totalTime, 1)"
            step="1"
            :value="Math.min(currentTime, totalTime)"
            @input="seekAudio"
          />
          <span>{{ formatTime(totalTime) }}</span>
        </div>

        <audio
          ref="audioRef"
          :src="activeTrack.src"
          preload="metadata"
          @timeupdate="syncAudioState"
          @loadedmetadata="syncAudioState"
          @play="syncAudioState"
          @pause="syncAudioState"
          @ended="handleEnded"
        />
      </div>
    </section>

    <section class="playlist-shell">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Solar Tracklist</p>
          <h3>音乐列表</h3>
        </div>
        <p class="section-note">
          点击任意卡片即可切换当前播放，封面、标题和歌词会优先读取 FLAC 内嵌元数据。
        </p>
      </div>

      <div class="track-grid">
        <article
          v-for="(track, index) in playlist"
          :key="track.id"
          class="track-card"
          :class="{ active: track.id === activeId, missing: track.status === 'missing' }"
        >
          <button class="track-main" type="button" @click="activateTrack(track.id, false)">
            <span class="track-index">{{ formatTrackIndex(index) }}</span>
            <div class="track-cover" :class="{ empty: !track.coverUrl }">
              <img v-if="track.coverUrl" :src="track.coverUrl" :alt="`${track.title} cover`" />
              <div v-else class="fallback-cover small">
                <span>Sun</span>
                <strong>{{ formatTrackIndex(index) }}</strong>
              </div>
            </div>
            <div class="track-copy">
              <h4>{{ track.title }}</h4>
              <p>{{ track.artist }}</p>
              <small>{{ track.status === 'missing' ? '文件待放入' : track.note }}</small>
            </div>
          </button>

          <div class="track-actions">
            <span class="time-pill">{{ formatTime(track.duration) }}</span>
            <button class="mini-btn" type="button" @click="toggleTrack(track.id)">
              {{ track.id === activeId && isPlaying ? '暂停' : '播放' }}
            </button>
            <button class="mini-link" type="button" @click="activateTrack(track.id, false); isLyricsOpen = true">
              歌词
            </button>
            <a class="mini-link" :href="track.src" :download="track.fileName">下载</a>
          </div>
        </article>
      </div>
    </section>

    <div v-if="isLyricsOpen && activeTrack" class="lyrics-overlay" @click.self="closeLyrics">
      <section class="lyrics-panel">
        <div class="lyrics-header">
          <div>
            <p class="eyebrow">Lyrics View</p>
            <h3>{{ activeTrack.title }}</h3>
            <p class="lyrics-meta">{{ activeTrack.artist }} · {{ activeTrack.album }}</p>
          </div>
          <button class="close-btn" type="button" @click="closeLyrics">关闭</button>
        </div>

        <div class="lyrics-body">
          <div class="lyrics-cover" :class="{ empty: !activeTrack.coverUrl }">
            <img
              v-if="activeTrack.coverUrl"
              :src="activeTrack.coverUrl"
              :alt="`${activeTrack.title} cover`"
            />
            <div v-else class="fallback-cover">
              <span>Sun</span>
              <strong>{{ activeTrack.title.slice(-2) }}</strong>
            </div>
          </div>

          <div class="lyrics-lines">
            <p v-for="(line, index) in activeLyrics" :key="`${activeTrack.id}-${index}`">{{ line }}</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
