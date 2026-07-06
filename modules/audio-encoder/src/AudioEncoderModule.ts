import { NativeModule, requireNativeModule } from 'expo';

// Encodeur natif Android (MediaCodec + MediaMuxer). Prend un WAV PCM 16 bits
// et le ré-encode en AAC dans un conteneur MP4 (.m4a). L'encodage tourne sur
// un thread natif (AsyncFunction) et ne bloque jamais le fil JS.
declare class AudioEncoderModule extends NativeModule<{}> {
  encodeWavToM4a(inputUri: string, outputUri: string, bitRate: number): Promise<string>;
}

export default requireNativeModule<AudioEncoderModule>('AudioEncoder');
