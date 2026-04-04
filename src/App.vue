<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Button as AButton, Tooltip as ATooltip } from 'ant-design-vue'
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

interface LrcLine {
  time: number
  text: string
}

const fallbackLyrics = [
  '[00:00.00] 光从封面边缘缓慢亮起。',
  '[00:08.00] 当前歌曲如果存在同名 .lrc 文件，这里会自动同步高亮。',
  '[00:16.00] 例如：周杰伦 - 太阳之子.flac 对应 周杰伦 - 太阳之子.lrc。',
  '[00:24.00] 歌词会跟随播放进度居中滚动，也可以点击任意一句跳转。',
].join('\n')

const playModeOptions = [
  {
    value: 'list' as const,
    label: '顺序播放',
    icon: 'list',
  },
  {
    value: 'single' as const,
    label: '单曲循环',
    icon: 'single',
  },
  {
    value: 'shuffle' as const,
    label: '随机播放',
    icon: 'shuffle',
  },
]

const playlist = ref<PlaylistTrack[]>(
  sunsonTracks.map((track) => ({
    ...track,
    src: `/music/sunson/${encodeURIComponent(track.fileName)}`,
    coverUrl: null,
    duration: null,
    artist: '周杰伦',
    album: '太阳之子',
    lyrics: fallbackLyrics,
    status: 'loading',
  })),
)

const audioRef = ref<HTMLAudioElement | null>(null)
const lyricScrollerRef = ref<HTMLElement | null>(null)
const lyricLineRefs = ref<HTMLElement[]>([])

const activeId = ref(playlist.value[0]?.id ?? '')
const isPlaying = ref(false)
const currentTime = ref(0)
const totalTime = ref(0)
const pendingPlayId = ref<string | null>(null)
const playMode = ref<PlayMode>('list')

const objectUrls: string[] = []
const waveformBars = Array.from({ length: 30 }, (_, index) => index)

const activeTrack = computed(
  () => playlist.value.find((track) => track.id === activeId.value) ?? playlist.value[0],
)

const loadedCount = computed(
  () => playlist.value.filter((track) => track.status === 'ready').length,
)

const totalDuration = computed(() =>
  playlist.value.reduce((sum, track) => sum + (track.duration ?? 0), 0),
)

const lrcLines = computed(() => parseLrc(activeTrack.value?.lyrics || fallbackLyrics))
const hasTimedLyrics = computed(() => lrcLines.value.some((line) => line.time > 0))

const activeLyricIndex = computed(() => {
  const lines = lrcLines.value
  if (!lines.length) {
    return -1
  }

  let matched = 0
  for (let index = 0; index < lines.length; index += 1) {
    if (currentTime.value >= lines[index].time) {
      matched = index
    } else {
      break
    }
  }

  return matched
})

function parseLrc(rawLyrics: string) {
  const rows = rawLyrics.split(/\r?\n/).filter(Boolean)
  const parsed: LrcLine[] = []

  for (const row of rows) {
    const matches = [...row.matchAll(/\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g)]
    const text = row.replace(/\[[^\]]+\]/g, '').trim()

    if (!matches.length) {
      if (text) {
        parsed.push({ time: parsed.length * 6, text })
      }
      continue
    }

    for (const match of matches) {
      const minutes = Number(match[1])
      const seconds = Number(match[2])
      const fraction = Number((match[3] || '0').padEnd(3, '0'))
      parsed.push({
        time: minutes * 60 + seconds + fraction / 1000,
        text: text || ' ',
      })
    }
  }

  return parsed.sort((a, b) => a.time - b.time)
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

function replaceExtension(fileName: string, extension: string) {
  return fileName.replace(/\.[^.]+$/, extension)
}

function isHtmlDocument(text: string) {
  const normalized = text.trim().toLowerCase()
  return normalized.startsWith('<!doctype html') || normalized.startsWith('<html')
}

async function loadLrc(track: PlaylistTrack) {
  const preferredName = replaceExtension(track.fileName, '.lrc')
  const fallbackName = `${replaceExtension(track.fileName, '').trim()}.lrc`
  const attempts = [...new Set([preferredName, fallbackName])]

  for (const fileName of attempts) {
    const lrcPath = `/music/sunson/${encodeURIComponent(fileName)}`

    try {
      const response = await fetch(lrcPath, { cache: 'no-store' })
      if (!response.ok) {
        continue
      }

      const contentType = response.headers.get('content-type') || ''
      const text = await response.text()
      if (!text.trim() || isHtmlDocument(text) || contentType.includes('text/html')) {
        continue
      }

      track.lyrics = text
      return
    } catch {
      // Try the next candidate name.
    }
  }
}

function setLyricLineRef(el: unknown, index: number) {
  if (el instanceof HTMLElement) {
    lyricLineRefs.value[index] = el
  }
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
  lyricLineRefs.value = []

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

function jumpToLyric(time: number) {
  const audio = audioRef.value
  if (!audio || !Number.isFinite(time)) {
    return
  }

  audio.currentTime = Math.max(time, 0)
  currentTime.value = audio.currentTime
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

    await loadLrc(track)
    track.status = 'ready'
  } catch {
    await loadLrc(track)
    track.status = 'ready'
  }
}

watch(activeLyricIndex, async (index) => {
  if (index < 0) {
    return
  }

  await nextTick()
  const container = lyricScrollerRef.value
  const line = lyricLineRefs.value[index]
  if (!container || !line) {
    return
  }

  const targetTop = line.offsetTop - container.clientHeight / 2 + line.clientHeight / 2
  container.scrollTo({ top: Math.max(targetTop, 0), behavior: 'smooth' })
})

watch(activeId, async () => {
  await nextTick()
  lyricScrollerRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
})

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
        <div>
          <p class="eyebrow">Jay Chou Special Playlist</p>
          <h1>太阳之子</h1>
          <p class="hero-text">
          周杰伦第16张个人专辑《太阳之子》正式官宣！暌违3年8个月，13首全新作品重磅集结，在熟悉的周氏旋律之外，更带来极具画面感与叙事性的全新听感体验。
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
        </div>

        <section class="inline-lyrics">
          <div class="inline-lyrics-head">
            <div>
              <p class="eyebrow">Live Lyrics</p>
              <h3>{{ activeTrack?.title || '当前歌词' }}</h3>
            </div>
            <span class="lyric-status" :class="{ active: isPlaying && hasTimedLyrics }">
              <span class="lyric-dot"></span>
              {{ hasTimedLyrics ? (isPlaying ? '同步中' : '暂停中') : '等待歌词' }}
            </span>
          </div>

          <div ref="lyricScrollerRef" class="lyric-scroller">
            <p
              v-for="(line, index) in lrcLines"
              :key="`${activeTrack?.id || 'track'}-${index}`"
              :ref="(el) => setLyricLineRef(el, index)"
              class="lyric-line"
              :class="{ active: index === activeLyricIndex }"
              @click="jumpToLyric(line.time)"
            >
              {{ line.text }}
            </p>
          </div>
        </section>
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

            <div class="mode-group" role="group" aria-label="播放模式">
              <a-tooltip v-for="option in playModeOptions" :key="option.value" :title="option.label">
                <a-button
                  class="mode-icon-button"
                  :class="{ active: playMode === option.value }"
                  shape="circle"
                  @click="playMode = option.value"
                >
                  <template #icon>
                    <svg v-if="option.value === 'list'" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 7h2v2H4zM8 7h12v2H8zM4 11h2v2H4zM8 11h12v2H8zM4 15h2v2H4zM8 15h12v2H8z" />
                    </svg>
                    <svg v-else-if="option.value === 'single'" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 7h10v2H9.41l1.3 1.29-1.42 1.42L5.59 8l3.7-3.71 1.42 1.42L9.41 7H17a2 2 0 0 1 2 2v2h-2V9H7zm10 10H7v-2h7.59l-1.3-1.29 1.42-1.42 3.7 3.71-3.7 3.71-1.42-1.42L14.59 17H7a2 2 0 0 1-2-2v-2h2v2h10zm-4-7h2v6h-2v-4.27l-1 .6-1-1.65L13 10z" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M16 3h5v5h-2V6.41l-3.29 3.3-1.42-1.42L17.17 5H16V3zM8.29 14.29l1.42 1.42L6.83 18H8v2H3v-5h2v1.17l3.29-3.3zm7.42 1.42 1.42-1.42L19 16.17V15h2v5h-5v-2h1.17l-1.46-1.45zM3 3h5v2H6.83l3.88 3.88-1.42 1.42L5 6.41V8H3V3z" />
                    </svg>
                  </template>
                </a-button>
              </a-tooltip>
            </div>
          </div>

          <p class="player-meta">{{ activeTrack.artist }} · {{ activeTrack.album }}</p>
          <p class="player-note">{{ activeTrack.note }}</p>

          <div class="waveform" :class="{ playing: isPlaying }" aria-hidden="true">
            <span
              v-for="bar in waveformBars"
              :key="bar"
              class="wave-bar"
              :style="{ '--delay': `${bar * 0.08}s`, '--height': `${10 + ((bar % 6) + 1) * 7}px` }"
            ></span>
          </div>
        </div>

        <div class="player-actions">
          <a-tooltip title="上一首">
            <a-button class="icon-button" shape="circle" @click="stepTrack(-1)">
              <template #icon>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6h2v12H6zm11.5 1.2v9.6c0 .79-.87 1.27-1.54.84L9.5 13.84a1 1 0 0 1 0-1.68l6.46-3.8c.67-.43 1.54.05 1.54.84z" />
                </svg>
              </template>
            </a-button>
          </a-tooltip>

          <a-tooltip :title="isPlaying ? '暂停播放' : '开始播放'">
            <a-button class="icon-button icon-button-primary" shape="circle" @click="toggleTrack(activeTrack.id)">
              <template #icon>
                <svg v-if="!isPlaying" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5.14v13.72c0 .78.84 1.26 1.5.86l10-6.86a1 1 0 0 0 0-1.72l-10-6.86A1 1 0 0 0 8 5.14z" />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 5h4v14H7zm6 0h4v14h-4z" />
                </svg>
              </template>
            </a-button>
          </a-tooltip>

          <a-tooltip title="下一首">
            <a-button class="icon-button" shape="circle" @click="stepTrack(1)">
              <template #icon>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M16 6h2v12h-2zM6.5 7.2v9.6c0 .79.87 1.27 1.54.84l6.46-3.8a1 1 0 0 0 0-1.68l-6.46-3.8c-.67-.43-1.54.05-1.54.84z" />
                </svg>
              </template>
            </a-button>
          </a-tooltip>

          <a-tooltip title="下载">
            <a-button class="icon-button" shape="circle" :href="activeTrack.src" :download="activeTrack.fileName">
              <template #icon>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M11 4h2v8.17l2.59-2.58L17 11l-5 5-5-5 1.41-1.41L11 12.17V4zm-6 14h14v2H5z" />
                </svg>
              </template>
            </a-button>
          </a-tooltip>
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
          像不同角度的余晖，明暗层次在同一张专题里舒展。
        </p>
      </div>

      <div class="track-grid">
        <article
          v-for="(track, index) in playlist"
          :key="track.id"
          class="track-card"
          :class="{
            active: track.id === activeId,
            playing: track.id === activeId && isPlaying,
            missing: track.status === 'missing',
          }"
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
            <a-tooltip :title="track.id === activeId && isPlaying ? '暂停播放' : '开始播放'">
              <a-button class="track-icon-button" shape="circle" @click="toggleTrack(track.id)">
                <template #icon>
                  <svg v-if="track.id === activeId && isPlaying" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 5h4v14H7zm6 0h4v14h-4z" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5.14v13.72c0 .78.84 1.26 1.5.86l10-6.86a1 1 0 0 0 0-1.72l-10-6.86A1 1 0 0 0 8 5.14z" />
                  </svg>
                </template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="下载">
              <a-button class="track-icon-button" shape="circle" :href="track.src" :download="track.fileName">
                <template #icon>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M11 4h2v8.17l2.59-2.58L17 11l-5 5-5-5 1.41-1.41L11 12.17V4zm-6 14h14v2H5z" />
                  </svg>
                </template>
              </a-button>
            </a-tooltip>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
