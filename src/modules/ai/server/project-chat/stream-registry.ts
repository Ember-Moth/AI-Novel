import { createId } from "@/shared/lib/domain";

interface ActiveStream {
  chatId: string;
  abortController: AbortController;
  createdAt: number;
}

class StreamRegistry {
  private streams = new Map<string, ActiveStream>();

  register(chatId: string, abortController: AbortController): string {
    const streamId = createId("stream");
    this.streams.set(streamId, {
      chatId,
      abortController,
      createdAt: Date.now(),
    });
    return streamId;
  }

  unregister(streamId: string): void {
    this.streams.delete(streamId);
  }

  abort(streamId: string): boolean {
    const stream = this.streams.get(streamId);
    if (!stream) {
      return false;
    }
    stream.abortController.abort();
    this.streams.delete(streamId);
    return true;
  }

  abortByChatId(chatId: string): boolean {
    for (const [streamId, stream] of this.streams.entries()) {
      if (stream.chatId === chatId) {
        stream.abortController.abort();
        this.streams.delete(streamId);
        return true;
      }
    }
    return false;
  }

  getStreamIdByChatId(chatId: string): string | null {
    for (const [streamId, stream] of this.streams.entries()) {
      if (stream.chatId === chatId) {
        return streamId;
      }
    }
    return null;
  }

  cleanupStaleStreams(maxAgeMs: number = 5 * 60 * 1000): void {
    const now = Date.now();
    for (const [streamId, stream] of this.streams.entries()) {
      if (now - stream.createdAt > maxAgeMs) {
        stream.abortController.abort();
        this.streams.delete(streamId);
      }
    }
  }
}

// Global singleton instance
export const streamRegistry = new StreamRegistry();

// Periodically clean up stale streams
setInterval(() => {
  streamRegistry.cleanupStaleStreams();
}, 60 * 1000);
