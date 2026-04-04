export interface FlacMetadata {
  title?: string
  artist?: string
  album?: string
  duration?: number
  pictureUrl?: string
  lyrics?: string
}

class NeedMoreDataError extends Error {
  constructor() {
    super('Need more FLAC data to finish parsing metadata blocks.')
  }
}

const textDecoder = new TextDecoder()

function ensureWithin(length: number, offset: number, size: number) {
  if (offset + size > length) {
    throw new NeedMoreDataError()
  }
}

function readUint24BE(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2]
}

function readUint32BE(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0
}

function readUint32LE(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0
}

function parseStreamInfo(bytes: Uint8Array, offset: number) {
  ensureWithin(bytes.length, offset, 18)

  const sampleRate =
    (bytes[offset + 10] << 12) |
    (bytes[offset + 11] << 4) |
    ((bytes[offset + 12] & 0xf0) >> 4)

  const totalSamples =
    (BigInt(bytes[offset + 13] & 0x0f) << 32n) |
    (BigInt(bytes[offset + 14]) << 24n) |
    (BigInt(bytes[offset + 15]) << 16n) |
    (BigInt(bytes[offset + 16]) << 8n) |
    BigInt(bytes[offset + 17])

  if (!sampleRate || totalSamples === 0n) {
    return undefined
  }

  return Number(totalSamples) / sampleRate
}

function parseVorbisComment(bytes: Uint8Array, offset: number, blockLength: number) {
  const end = offset + blockLength
  ensureWithin(bytes.length, offset, blockLength)

  let cursor = offset
  const vendorLength = readUint32LE(bytes, cursor)
  cursor += 4 + vendorLength

  ensureWithin(end, cursor, 4)
  const commentCount = readUint32LE(bytes, cursor)
  cursor += 4

  const comments: Record<string, string> = {}

  for (let i = 0; i < commentCount; i += 1) {
    ensureWithin(end, cursor, 4)
    const length = readUint32LE(bytes, cursor)
    cursor += 4
    ensureWithin(end, cursor, length)

    const value = textDecoder.decode(bytes.slice(cursor, cursor + length))
    cursor += length

    const separatorIndex = value.indexOf('=')
    if (separatorIndex > 0) {
      const key = value.slice(0, separatorIndex).toUpperCase()
      comments[key] = value.slice(separatorIndex + 1)
    }
  }

  return comments
}

function parsePicture(bytes: Uint8Array, offset: number, blockLength: number) {
  const end = offset + blockLength
  ensureWithin(bytes.length, offset, blockLength)

  let cursor = offset
  cursor += 4

  const mimeLength = readUint32BE(bytes, cursor)
  cursor += 4
  ensureWithin(end, cursor, mimeLength)
  const mime = textDecoder.decode(bytes.slice(cursor, cursor + mimeLength)) || 'image/jpeg'
  cursor += mimeLength

  const descriptionLength = readUint32BE(bytes, cursor)
  cursor += 4 + descriptionLength

  cursor += 16

  const pictureLength = readUint32BE(bytes, cursor)
  cursor += 4
  ensureWithin(end, cursor, pictureLength)

  const binary = bytes.slice(cursor, cursor + pictureLength)
  const blob = new Blob([binary], { type: mime })
  return URL.createObjectURL(blob)
}

export function parseFlacMetadata(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  ensureWithin(bytes.length, 0, 4)

  if (textDecoder.decode(bytes.slice(0, 4)) !== 'fLaC') {
    throw new Error('Invalid FLAC file.')
  }

  let offset = 4
  let isLastBlock = false
  let title: string | undefined
  let artist: string | undefined
  let album: string | undefined
  let duration: number | undefined
  let pictureUrl: string | undefined
  let lyrics: string | undefined

  while (!isLastBlock) {
    ensureWithin(bytes.length, offset, 4)

    const header = bytes[offset]
    isLastBlock = Boolean(header & 0x80)
    const blockType = header & 0x7f
    const blockLength = readUint24BE(bytes, offset + 1)
    offset += 4

    ensureWithin(bytes.length, offset, blockLength)

    if (blockType === 0 && duration === undefined) {
      duration = parseStreamInfo(bytes, offset)
    }

    if (blockType === 4) {
      const comments = parseVorbisComment(bytes, offset, blockLength)
      title = comments.TITLE || title
      artist = comments.ARTIST || artist
      album = comments.ALBUM || album
      lyrics =
        comments.LYRICS ||
        comments.UNSYNCEDLYRICS ||
        comments.UNSYNCED_LYRICS ||
        comments.LYRIC ||
        comments.TEXT ||
        lyrics
    }

    if (blockType === 6 && !pictureUrl) {
      pictureUrl = parsePicture(bytes, offset, blockLength)
    }

    offset += blockLength
  }

  return {
    title,
    artist,
    album,
    duration,
    pictureUrl,
    lyrics,
  } satisfies FlacMetadata
}

export async function loadFlacMetadata(url: string) {
  const attempts = [262_144, 1_048_576, 4_194_304, null] as const
  let latestError: unknown

  for (const limit of attempts) {
    try {
      const response = await fetch(url, {
        headers: limit ? { Range: `bytes=0-${limit - 1}` } : undefined,
      })

      if (!response.ok) {
        throw new Error(`Unable to fetch FLAC file: ${response.status}`)
      }

      const buffer = await response.arrayBuffer()
      return parseFlacMetadata(buffer)
    } catch (error) {
      latestError = error
      if (!(error instanceof NeedMoreDataError)) {
        break
      }
    }
  }

  throw latestError instanceof Error ? latestError : new Error('Unable to parse FLAC metadata.')
}
