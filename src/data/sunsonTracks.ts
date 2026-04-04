export interface SunsonTrackConfig {
  id: string
  fileName: string
  title: string
  note: string
}

// Put the 13 FLAC files into /public/music/sunson using the filenames below.
export const sunsonTracks: SunsonTrackConfig[] = [
  { id: 'track-01', fileName: '周杰伦 - 太阳之子.flac', title: '太阳之子 01', note: '开场像第一束光落下，整张专题从这里被点亮。' },
  { id: 'track-02', fileName: '周杰伦 - 西西里.flac', title: '太阳之子 02', note: '海风与热度交错，旋律带着缓慢推进的金色脉冲。' },
  { id: 'track-03', fileName: '周杰伦 - 那天下雨了.flac', title: '太阳之子 03', note: '雨意与余温并存，情绪在节奏里缓缓回旋。' },
  { id: 'track-04', fileName: '周杰伦 - 湘女多情.flac', title: '太阳之子 04', note: '温柔的线条里藏着明亮张力，像夜色刚刚亮起。' },
  { id: 'track-05', fileName: '周杰伦 - 谁稀罕.flac', title: '太阳之子 05', note: '火线般的节奏一路延展，副歌与律动都更饱满。' },
  { id: 'track-06', fileName: '周杰伦 - 七月的极光.flac', title: '太阳之子 06', note: '像清晨反光掠过耳边，细节在后段慢慢发亮。' },
  { id: 'track-07', fileName: '周杰伦 - 爱琴海.flac', title: '太阳之子 07', note: '层层推高的情绪像潮汐一样，一直拍向远处。' },
  { id: 'track-08', fileName: '周杰伦 - I Do.flac', title: '太阳之子 08', note: '天际线被照亮的瞬间，整首歌都显得格外开阔。' },
  { id: 'track-09', fileName: '周杰伦 - 圣徒.flac', title: '太阳之子 09', note: '琥珀色余温缓慢扩散，越到后面越耐人回放。' },
  { id: 'track-10', fileName: '周杰伦 - 女儿殿下.flac', title: '太阳之子 10', note: '低频与回声交错，像晚风穿过明亮的街灯。' },
  { id: 'track-11', fileName: '周杰伦 - 淘金小镇.flac', title: '太阳之子 11', note: '叙事感一路铺开，像沿着记忆继续向前走。' },
  { id: 'track-12', fileName: '周杰伦 - 乡间的路.flac', title: '太阳之子 12', note: '热度在尾声前再次抬高，空气里全是余晖的味道。' },
  { id: 'track-13', fileName: '周杰伦 - 圣诞星 (feat. 杨瑞代).flac', title: '太阳之子 13', note: '当最后一段旋律落下，只留下长久停驻的微光。' },
]
