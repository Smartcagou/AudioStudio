package expo.modules.audioencoder

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.RandomAccessFile

// En-tête WAV analysé : position et taille du bloc de données PCM.
private class WavInfo(
  val channels: Int,
  val sampleRate: Int,
  val bitsPerSample: Int,
  val dataOffset: Long,
  val dataSize: Long,
)

class AudioEncoderException(message: String) : CodedException(message)

class AudioEncoderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AudioEncoder")

    // AsyncFunction : dispatché sur un thread natif, jamais sur le fil JS.
    AsyncFunction("encodeWavToM4a") { inputUri: String, outputUri: String, bitRate: Int ->
      encodeWavToM4a(uriToPath(inputUri), uriToPath(outputUri), bitRate)
    }
  }

  private fun uriToPath(uri: String): String {
    return if (uri.startsWith("file://")) uri.removePrefix("file://") else uri
  }

  private fun leShort(b: ByteArray, off: Int): Int {
    return (b[off].toInt() and 0xff) or ((b[off + 1].toInt() and 0xff) shl 8)
  }

  private fun leInt(b: ByteArray, off: Int): Int {
    return (b[off].toInt() and 0xff) or
      ((b[off + 1].toInt() and 0xff) shl 8) or
      ((b[off + 2].toInt() and 0xff) shl 16) or
      ((b[off + 3].toInt() and 0xff) shl 24)
  }

  // Parcourt les sous-blocs RIFF pour trouver fmt et data. Robuste aux blocs
  // additionnels (LIST, fact...) et au padding à l'octet pair.
  private fun readWavInfo(raf: RandomAccessFile): WavInfo {
    val header = ByteArray(12)
    raf.seek(0)
    raf.readFully(header)
    if (String(header, 0, 4) != "RIFF" || String(header, 8, 4) != "WAVE") {
      throw AudioEncoderException("Fichier WAV invalide (en-tête RIFF/WAVE absent).")
    }

    var channels = 0
    var sampleRate = 0
    var bitsPerSample = 0
    var pos = 12L
    val len = raf.length()

    while (pos + 8 <= len) {
      raf.seek(pos)
      val chunkHeader = ByteArray(8)
      raf.readFully(chunkHeader)
      val id = String(chunkHeader, 0, 4)
      val size = leInt(chunkHeader, 4).toLong() and 0xffffffffL
      val bodyPos = pos + 8

      if (id == "fmt ") {
        val fmt = ByteArray(16)
        raf.seek(bodyPos)
        raf.readFully(fmt)
        channels = leShort(fmt, 2)
        sampleRate = leInt(fmt, 4)
        bitsPerSample = leShort(fmt, 14)
      } else if (id == "data") {
        return WavInfo(channels, sampleRate, bitsPerSample, bodyPos, size)
      }

      pos = bodyPos + size + (size and 1L)
    }

    throw AudioEncoderException("Bloc de données introuvable dans le WAV.")
  }

  private fun ptsForFrames(frames: Long, sampleRate: Int): Long {
    return frames * 1_000_000L / sampleRate
  }

  private fun encodeWavToM4a(inputPath: String, outputPath: String, bitRate: Int): String {
    val raf = RandomAccessFile(inputPath, "r")
    try {
      val wav = readWavInfo(raf)
      if (wav.bitsPerSample != 16) {
        throw AudioEncoderException("Seul le PCM 16 bits est supporté (reçu ${wav.bitsPerSample}).")
      }
      if (wav.channels < 1 || wav.sampleRate < 1) {
        throw AudioEncoderException("Format WAV illisible (canaux/fréquence).")
      }

      // Taille de données parfois nulle ou surdimensionnée (fichiers streamés) :
      // borner à ce qui reste réellement dans le fichier.
      val available = raf.length() - wav.dataOffset
      var bytesRemaining = if (wav.dataSize in 1..available) wav.dataSize else available

      val outFile = File(outputPath)
      if (outFile.exists()) {
        outFile.delete()
      }

      val format = MediaFormat.createAudioFormat(
        MediaFormat.MIMETYPE_AUDIO_AAC,
        wav.sampleRate,
        wav.channels,
      )
      format.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
      format.setInteger(MediaFormat.KEY_BIT_RATE, bitRate)
      format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384)

      val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
      codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      codec.start()

      val muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      var trackIndex = -1
      var muxerStarted = false

      val bufferInfo = MediaCodec.BufferInfo()
      val timeoutUs = 10_000L
      val bytesPerFrame = wav.channels * 2

      raf.seek(wav.dataOffset)
      var totalFramesRead = 0L
      var inputDone = false
      var outputDone = false

      try {
        while (!outputDone) {
          if (!inputDone) {
            val inIndex = codec.dequeueInputBuffer(timeoutUs)
            if (inIndex >= 0) {
              val inBuf = codec.getInputBuffer(inIndex)!!
              inBuf.clear()
              val toRead = minOf(bytesRemaining, inBuf.capacity().toLong()).toInt()
              var read = 0
              if (toRead > 0) {
                val chunk = ByteArray(toRead)
                read = raf.read(chunk, 0, toRead)
                if (read > 0) {
                  inBuf.put(chunk, 0, read)
                }
              }
              val pts = ptsForFrames(totalFramesRead, wav.sampleRate)
              if (read <= 0) {
                codec.queueInputBuffer(inIndex, 0, 0, pts, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                inputDone = true
              } else {
                codec.queueInputBuffer(inIndex, 0, read, pts, 0)
                totalFramesRead += read / bytesPerFrame
                bytesRemaining -= read
              }
            }
          }

          val outIndex = codec.dequeueOutputBuffer(bufferInfo, timeoutUs)
          if (outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
            if (muxerStarted) {
              throw AudioEncoderException("Format de sortie changé deux fois.")
            }
            trackIndex = muxer.addTrack(codec.outputFormat)
            muxer.start()
            muxerStarted = true
          } else if (outIndex >= 0) {
            val outBuf = codec.getOutputBuffer(outIndex)!!
            // Ignorer l'en-tête de configuration du codec (non muxé).
            if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) {
              bufferInfo.size = 0
            }
            if (bufferInfo.size > 0 && muxerStarted) {
              outBuf.position(bufferInfo.offset)
              outBuf.limit(bufferInfo.offset + bufferInfo.size)
              muxer.writeSampleData(trackIndex, outBuf, bufferInfo)
            }
            codec.releaseOutputBuffer(outIndex, false)
            if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
              outputDone = true
            }
          }
        }
      } finally {
        codec.stop()
        codec.release()
        if (muxerStarted) {
          muxer.stop()
        }
        muxer.release()
      }

      return "file://$outputPath"
    } finally {
      raf.close()
    }
  }
}
