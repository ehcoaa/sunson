export interface SunsonTrackConfig {
  id: string
  fileName: string
  title: string
  note: string
}

// Put the 13 FLAC files into /public/music/sunson using the filenames below.
export const sunsonTracks: SunsonTrackConfig[] = [
  { id: 'track-01', fileName: '周杰伦 - 太阳之子.flac', title: '太阳之子 01', note: 'Sun flare opening' },
  { id: 'track-02', fileName: '周杰伦 - 西西里.flac', title: '太阳之子 02', note: 'Golden hour pulse' },
  { id: 'track-03', fileName: '周杰伦 - 那天下雨了.flac', title: '太阳之子 03', note: 'Orbit in motion' },
  { id: 'track-04', fileName: '周杰伦 - 湘女多情.flac', title: '太阳之子 04', note: 'City lights afterglow' },
  { id: 'track-05', fileName: '周杰伦 - 谁稀罕.flac', title: '太阳之子 05', note: 'Fireline rhythm' },
  { id: 'track-06', fileName: '周杰伦 - 七月的极光.flac', title: '太阳之子 06', note: 'Daybreak reflections' },
  { id: 'track-07', fileName: '周杰伦 - 爱琴海.flac', title: '太阳之子 07', note: 'Solar tide' },
  { id: 'track-08', fileName: '周杰伦 - I Do.flac', title: '太阳之子 08', note: 'Radiant skyline' },
  { id: 'track-09', fileName: '周杰伦 - 圣徒.flac', title: '太阳之子 09', note: 'Amber drift' },
  { id: 'track-10', fileName: '周杰伦 - 女儿殿下.flac', title: '太阳之子 10', note: 'Crimson echoes' },
  { id: 'track-11', fileName: '周杰伦 - 淘金小镇.flac', title: '太阳之子 11', note: 'Sunpath memory' },
  { id: 'track-12', fileName: '周杰伦 - 乡间的路.flac', title: '太阳之子 12', note: 'Heatwave finale' },
  { id: 'track-13', fileName: '周杰伦 - 圣诞星 (feat. 杨瑞代).flac', title: '太阳之子 13', note: 'Last light encore' },
]
